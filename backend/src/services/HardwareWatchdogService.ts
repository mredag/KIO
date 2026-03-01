/**
 * HardwareWatchdogService — Monitors Pi 5 system health (CPU temp, RAM, disk, load, fan).
 *
 * Runs on a cron interval (default: every 5 minutes). Collects OS-level metrics via
 * child_process commands, evaluates against configurable thresholds, and sends Telegram
 * alerts when anomalies are detected. Stores snapshots in mc_events for history.
 *
 * Works on both Linux (Pi) and Windows (dev) — gracefully degrades for unavailable metrics.
 *
 * Config stored in mc_policies (id: 'hardware_watchdog_config') — runtime-editable via API.
 */
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import os from 'os';
import cron from 'node-cron';
import { TelegramNotificationService, TelegramMessage } from './TelegramNotificationService.js';

// ── Interfaces ──

export interface HardwareSnapshot {
  timestamp: string;
  cpu: {
    tempCelsius: number | null;
    loadPercent: number;
    load1m: number;
    load5m: number;
    load15m: number;
    cores: number;
  };
  memory: {
    totalMB: number;
    usedMB: number;
    freeMB: number;
    usedPercent: number;
  };
  disk: {
    totalGB: number;
    usedGB: number;
    freeGB: number;
    usedPercent: number;
    path: string;
  };
  fan: {
    rpm: number | null;
    state: number | null;
    driverLoaded: boolean;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  network: {
    hostname: string;
    interfaces: { name: string; ip: string }[];
  };
  platform: string;
  nodeVersion: string;
}

export interface WatchdogThresholds {
  cpuTempCritical: number;   // °C — send alert above this
  cpuTempWarning: number;    // °C — send warning above this
  ramUsedPercent: number;    // % — alert above this
  diskUsedPercent: number;   // % — alert above this
  loadPerCore: number;       // load avg / cores — alert above this
  fanRpmMin: number;         // RPM — alert if fan driver loaded but RPM below this
}

export interface WatchdogConfig {
  enabled: boolean;
  cronSchedule: string;
  timezone: string;
  thresholds: WatchdogThresholds;
  cooldownMinutes: number;   // min time between repeated alerts for same issue
  snapshotRetentionHours: number;
}

interface AlertState {
  lastAlertAt: string | null;
  issueType: string;
}

// ── Defaults ──

const DEFAULT_CONFIG: WatchdogConfig = {
  enabled: true,
  cronSchedule: '*/5 * * * *',  // every 5 minutes
  timezone: 'Europe/Istanbul',
  thresholds: {
    cpuTempCritical: 80,
    cpuTempWarning: 70,
    ramUsedPercent: 90,
    diskUsedPercent: 85,
    loadPerCore: 2.0,
    fanRpmMin: 500,
  },
  cooldownMinutes: 30,
  snapshotRetentionHours: 72,
};

const CONFIG_ID = 'hardware_watchdog_config';

export class HardwareWatchdogService {
  private db: Database.Database;
  private telegram: TelegramNotificationService;
  private config: WatchdogConfig;
  private task: cron.ScheduledTask | null = null;
  private alertCooldowns: Map<string, AlertState> = new Map();
  private lastSnapshot: HardwareSnapshot | null = null;
  private isRunning = false;

  constructor(db: Database.Database, telegram: TelegramNotificationService) {
    this.db = db;
    this.telegram = telegram;
    this.ensureConfigExists();
    this.config = this.loadConfig();
    console.log('[HardwareWatchdog] Initialized (enabled: %s, schedule: %s)', this.config.enabled, this.config.cronSchedule);
  }

  // ── Config persistence ──

  private ensureConfigExists(): void {
    const existing = this.db.prepare(`SELECT id FROM mc_policies WHERE id = ?`).get(CONFIG_ID);
    if (!existing) {
      this.db.prepare(`
        INSERT INTO mc_policies (id, name, type, conditions, actions, is_active, created_at, updated_at)
        VALUES (?, 'Donanım İzleyici Ayarları', 'guardrail', ?, '{}', 1, datetime('now'), datetime('now'))
      `).run(CONFIG_ID, JSON.stringify(DEFAULT_CONFIG));
    }
  }

  private loadConfig(): WatchdogConfig {
    const row = this.db.prepare(`SELECT conditions FROM mc_policies WHERE id = ?`).get(CONFIG_ID) as any;
    if (!row?.conditions) return { ...DEFAULT_CONFIG };
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(row.conditions) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  getConfig(): WatchdogConfig {
    this.config = this.loadConfig();
    return { ...this.config };
  }

  saveConfig(partial: Partial<WatchdogConfig>): WatchdogConfig {
    const current = this.loadConfig();
    const merged: WatchdogConfig = {
      ...current,
      ...partial,
      thresholds: { ...current.thresholds, ...(partial.thresholds || {}) },
    };
    this.db.prepare(`UPDATE mc_policies SET conditions = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(merged), CONFIG_ID);
    this.config = merged;

    // Restart cron if schedule changed
    if (partial.cronSchedule || partial.enabled !== undefined) {
      this.stop();
      if (merged.enabled) this.start();
    }
    return { ...merged };
  }

  // ── Lifecycle ──

  start(): void {
    if (this.task) this.task.stop();
    if (!this.config.enabled) {
      console.log('[HardwareWatchdog] Disabled — not starting');
      return;
    }
    this.task = cron.schedule(this.config.cronSchedule, () => this.runCheck(), {
      timezone: this.config.timezone,
    });
    console.log('[HardwareWatchdog] Started (%s, tz: %s)', this.config.cronSchedule, this.config.timezone);
  }

  stop(): void {
    if (this.task) { this.task.stop(); this.task = null; }
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      running: !!this.task,
      schedule: this.config.cronSchedule,
      lastSnapshot: this.lastSnapshot,
      alertCooldowns: Object.fromEntries(this.alertCooldowns),
    };
  }

  // ── Core: Collect + Evaluate ──

  async runCheck(): Promise<{ snapshot: HardwareSnapshot; alerts: string[] }> {
    if (this.isRunning) return { snapshot: this.lastSnapshot!, alerts: [] };
    this.isRunning = true;

    try {
      const snapshot = this.collectSnapshot();
      this.lastSnapshot = snapshot;
      const alerts = await this.evaluate(snapshot);

      // Store snapshot as mc_event
      this.emitEvent('hardware_snapshot', 'hardware', 'hardware_check',
        alerts.length > 0
          ? `⚠️ ${alerts.length} donanım uyarısı: ${alerts.join(', ')}`
          : `✅ Donanım normal — CPU: ${snapshot.cpu.tempCelsius ?? '?'}°C, RAM: ${snapshot.memory.usedPercent}%, Disk: ${snapshot.disk.usedPercent}%`,
        snapshot
      );

      // Cleanup old snapshots
      this.cleanupOldSnapshots();

      return { snapshot, alerts };
    } catch (err: any) {
      console.error('[HardwareWatchdog] Check failed:', err.message);
      return { snapshot: this.lastSnapshot!, alerts: [`check_failed: ${err.message}`] };
    } finally {
      this.isRunning = false;
    }
  }

  // ── Metric Collection ──

  collectSnapshot(): HardwareSnapshot {
    const isLinux = os.platform() === 'linux';
    const now = new Date().toISOString();

    // CPU temperature
    let cpuTemp: number | null = null;
    if (isLinux) {
      cpuTemp = this.readLinuxTemp();
    } else {
      // Windows — try wmic (may not work on all systems)
      cpuTemp = this.readWindowsTemp();
    }

    // CPU load
    const loads = os.loadavg();
    const cores = os.cpus().length;
    const loadPercent = Math.round((loads[0] / cores) * 100);

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Disk
    const diskInfo = this.getDiskUsage(isLinux);

    // Fan (Pi 5 only)
    const fanInfo = isLinux ? this.getLinuxFanInfo() : { rpm: null, state: null, driverLoaded: false };

    // Uptime
    const uptimeSec = os.uptime();

    // Network
    const netInterfaces = os.networkInterfaces();
    const ips: { name: string; ip: string }[] = [];
    for (const [name, addrs] of Object.entries(netInterfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          ips.push({ name, ip: addr.address });
        }
      }
    }

    return {
      timestamp: now,
      cpu: {
        tempCelsius: cpuTemp,
        loadPercent,
        load1m: Math.round(loads[0] * 100) / 100,
        load5m: Math.round(loads[1] * 100) / 100,
        load15m: Math.round(loads[2] * 100) / 100,
        cores,
      },
      memory: {
        totalMB: Math.round(totalMem / 1048576),
        usedMB: Math.round(usedMem / 1048576),
        freeMB: Math.round(freeMem / 1048576),
        usedPercent: Math.round((usedMem / totalMem) * 100),
      },
      disk: diskInfo,
      fan: fanInfo,
      uptime: {
        seconds: uptimeSec,
        formatted: this.formatUptime(uptimeSec),
      },
      network: {
        hostname: os.hostname(),
        interfaces: ips,
      },
      platform: `${os.platform()} ${os.arch()} ${os.release()}`,
      nodeVersion: process.version,
    };
  }

  private readLinuxTemp(): number | null {
    // Pi 5: vcgencmd is the most reliable
    try {
      const out = execSync('vcgencmd measure_temp 2>/dev/null', { timeout: 3000 }).toString().trim();
      const match = out.match(/temp=([\d.]+)/);
      if (match) return parseFloat(match[1]);
    } catch {}

    // Fallback: thermal zone
    try {
      const out = execSync('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null', { timeout: 3000 }).toString().trim();
      const val = parseInt(out);
      if (!isNaN(val)) return val / 1000;
    } catch {}

    return null;
  }

  private readWindowsTemp(): number | null {
    // Windows dev machine — best effort, often requires admin
    try {
      const out = execSync('powershell -Command "Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi 2>$null | Select -First 1 -ExpandProperty CurrentTemperature"', { timeout: 5000 }).toString().trim();
      const val = parseInt(out);
      if (!isNaN(val)) return Math.round((val / 10 - 273.15) * 10) / 10;
    } catch {}
    return null;
  }

  private getDiskUsage(isLinux: boolean): HardwareSnapshot['disk'] {
    const fallback = { totalGB: 0, usedGB: 0, freeGB: 0, usedPercent: 0, path: '/' };
    try {
      if (isLinux) {
        const out = execSync("df -BG / | tail -1", { timeout: 3000 }).toString().trim();
        const parts = out.split(/\s+/);
        // Filesystem 1G-blocks Used Available Use% Mounted
        if (parts.length >= 6) {
          const total = parseInt(parts[1]);
          const used = parseInt(parts[2]);
          const free = parseInt(parts[3]);
          const pct = parseInt(parts[4]);
          return { totalGB: total, usedGB: used, freeGB: free, usedPercent: pct, path: parts[5] };
        }
      } else {
        // Windows
        const out = execSync('powershell -Command "(Get-PSDrive C).Used, (Get-PSDrive C).Free"', { timeout: 5000 }).toString().trim();
        const lines = out.split(/\r?\n/).map(l => parseInt(l.trim()));
        if (lines.length >= 2 && !isNaN(lines[0]) && !isNaN(lines[1])) {
          const usedGB = Math.round(lines[0] / 1073741824);
          const freeGB = Math.round(lines[1] / 1073741824);
          const totalGB = usedGB + freeGB;
          return { totalGB, usedGB, freeGB, usedPercent: Math.round((usedGB / totalGB) * 100), path: 'C:' };
        }
      }
    } catch {}
    return fallback;
  }

  private getLinuxFanInfo(): HardwareSnapshot['fan'] {
    let rpm: number | null = null;
    let state: number | null = null;
    let driverLoaded = false;

    try {
      const typeOut = execSync('cat /sys/class/thermal/cooling_device0/type 2>/dev/null', { timeout: 3000 }).toString().trim();
      driverLoaded = typeOut === 'cooling_fan';
    } catch {}

    if (driverLoaded) {
      try {
        const rpmOut = execSync('cat /sys/class/hwmon/*/fan1_input 2>/dev/null | head -1', { timeout: 3000 }).toString().trim();
        const val = parseInt(rpmOut);
        if (!isNaN(val)) rpm = val;
      } catch {}

      try {
        const stateOut = execSync('cat /sys/class/thermal/cooling_device0/cur_state 2>/dev/null', { timeout: 3000 }).toString().trim();
        const val = parseInt(stateOut);
        if (!isNaN(val)) state = val;
      } catch {}
    }

    return { rpm, state, driverLoaded };
  }

  // ── Threshold Evaluation + Alerting ──

  private async evaluate(snap: HardwareSnapshot): Promise<string[]> {
    const t = this.config.thresholds;
    const alerts: string[] = [];
    const issues: { type: string; severity: TelegramMessage['severity']; detail: string }[] = [];

    // CPU Temperature
    if (snap.cpu.tempCelsius !== null) {
      if (snap.cpu.tempCelsius >= t.cpuTempCritical) {
        issues.push({
          type: 'cpu_temp_critical',
          severity: 'critical',
          detail: `CPU sıcaklığı ${snap.cpu.tempCelsius}°C (limit: ${t.cpuTempCritical}°C)`,
        });
        alerts.push(`CPU ${snap.cpu.tempCelsius}°C KRİTİK`);
      } else if (snap.cpu.tempCelsius >= t.cpuTempWarning) {
        issues.push({
          type: 'cpu_temp_warning',
          severity: 'medium',
          detail: `CPU sıcaklığı ${snap.cpu.tempCelsius}°C (uyarı: ${t.cpuTempWarning}°C)`,
        });
        alerts.push(`CPU ${snap.cpu.tempCelsius}°C yüksek`);
      }
    }

    // RAM
    if (snap.memory.usedPercent >= t.ramUsedPercent) {
      issues.push({
        type: 'ram_high',
        severity: snap.memory.usedPercent >= 95 ? 'critical' : 'high',
        detail: `RAM kullanımı %${snap.memory.usedPercent} (${snap.memory.usedMB}MB / ${snap.memory.totalMB}MB)`,
      });
      alerts.push(`RAM %${snap.memory.usedPercent}`);
    }

    // Disk
    if (snap.disk.usedPercent >= t.diskUsedPercent) {
      issues.push({
        type: 'disk_high',
        severity: snap.disk.usedPercent >= 95 ? 'critical' : 'high',
        detail: `Disk kullanımı %${snap.disk.usedPercent} (${snap.disk.usedGB}GB / ${snap.disk.totalGB}GB, boş: ${snap.disk.freeGB}GB)`,
      });
      alerts.push(`Disk %${snap.disk.usedPercent}`);
    }

    // CPU Load
    const loadPerCore = snap.cpu.load1m / snap.cpu.cores;
    if (loadPerCore >= t.loadPerCore) {
      issues.push({
        type: 'cpu_load_high',
        severity: loadPerCore >= 4.0 ? 'critical' : 'high',
        detail: `CPU yükü ${snap.cpu.load1m} (${snap.cpu.cores} çekirdek, çekirdek başı: ${loadPerCore.toFixed(1)})`,
      });
      alerts.push(`Load ${snap.cpu.load1m}`);
    }

    // Fan (only on Pi with fan driver)
    if (snap.fan.driverLoaded) {
      if (snap.fan.rpm !== null && snap.fan.rpm < t.fanRpmMin && snap.cpu.tempCelsius !== null && snap.cpu.tempCelsius > 50) {
        issues.push({
          type: 'fan_stopped',
          severity: 'critical',
          detail: `Fan RPM: ${snap.fan.rpm} (min: ${t.fanRpmMin}), CPU: ${snap.cpu.tempCelsius}°C — fan çalışmıyor olabilir`,
        });
        alerts.push(`Fan ${snap.fan.rpm} RPM`);
      }
    }

    // Send alerts (with cooldown)
    for (const issue of issues) {
      if (this.shouldAlert(issue.type)) {
        await this.sendAlert(issue.type, issue.severity, issue.detail, snap);
        this.recordAlert(issue.type);
      }
    }

    return alerts;
  }

  private shouldAlert(issueType: string): boolean {
    const state = this.alertCooldowns.get(issueType);
    if (!state?.lastAlertAt) return true;
    const elapsed = Date.now() - new Date(state.lastAlertAt).getTime();
    return elapsed >= this.config.cooldownMinutes * 60 * 1000;
  }

  private recordAlert(issueType: string): void {
    this.alertCooldowns.set(issueType, {
      lastAlertAt: new Date().toISOString(),
      issueType,
    });
  }

  private async sendAlert(
    issueType: string,
    severity: TelegramMessage['severity'],
    detail: string,
    snap: HardwareSnapshot
  ): Promise<void> {
    const summaryLines = [
      `🌡️ CPU: ${snap.cpu.tempCelsius ?? '?'}°C | Load: ${snap.cpu.load1m}`,
      `💾 RAM: %${snap.memory.usedPercent} (${snap.memory.freeMB}MB boş)`,
      `💿 Disk: %${snap.disk.usedPercent} (${snap.disk.freeGB}GB boş)`,
    ];
    if (snap.fan.driverLoaded) {
      summaryLines.push(`🌀 Fan: ${snap.fan.rpm ?? '?'} RPM (state: ${snap.fan.state ?? '?'})`);
    }
    summaryLines.push(`⏱️ Uptime: ${snap.uptime.formatted}`);
    summaryLines.push(`🖥️ ${snap.network.hostname} (${snap.network.interfaces.map(i => i.ip).join(', ')})`);

    const body = `<b>Sorun:</b> ${detail}\n\n<b>Sistem Özeti:</b>\n${summaryLines.join('\n')}`;

    const msg: TelegramMessage = {
      jobId: `hw_${issueType}_${Date.now()}`,
      severity,
      title: `🖥️ Donanım Uyarısı: ${issueType.replace(/_/g, ' ')}`,
      body,
      source: 'autopilot' as any,
    };

    try {
      await this.telegram.notify(msg);
      console.log('[HardwareWatchdog] Alert sent: %s (%s)', issueType, severity);
    } catch (err: any) {
      console.error('[HardwareWatchdog] Failed to send alert:', err.message);
    }
  }

  // ── History ──

  getHistory(limit: number = 50): any[] {
    return this.db.prepare(`
      SELECT id, event_type, message, metadata, created_at
      FROM mc_events
      WHERE entity_type = 'hardware' AND event_type = 'hardware_check'
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  }

  getAlertHistory(limit: number = 20): any[] {
    return this.db.prepare(`
      SELECT id, event_type, message, metadata, created_at
      FROM mc_events
      WHERE entity_type = 'hardware' AND message LIKE '%uyarı%'
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  }

  getLastSnapshot(): HardwareSnapshot | null {
    return this.lastSnapshot;
  }

  // ── Helpers ──

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}g`);
    if (h > 0) parts.push(`${h}s`);
    parts.push(`${m}dk`);
    return parts.join(' ');
  }

  private emitEvent(entityId: string, entityType: string, eventType: string, message: string, metadata?: any): void {
    try {
      this.db.prepare(`
        INSERT INTO mc_events (id, entity_type, entity_id, event_type, message, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `hw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        entityType,
        entityId,
        eventType,
        message,
        metadata ? JSON.stringify(metadata) : null,
        new Date().toISOString()
      );
    } catch (err: any) {
      console.error('[HardwareWatchdog] Failed to emit event:', err.message);
    }
  }

  private cleanupOldSnapshots(): void {
    try {
      const cutoff = new Date(Date.now() - this.config.snapshotRetentionHours * 3600000).toISOString();
      this.db.prepare(`
        DELETE FROM mc_events
        WHERE entity_type = 'hardware' AND event_type = 'hardware_check' AND created_at < ?
      `).run(cutoff);
    } catch {}
  }

  destroy(): void {
    this.stop();
  }
}
