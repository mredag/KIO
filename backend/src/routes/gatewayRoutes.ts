/**
 * Gateway Management API Routes — CRUD for OpenClaw gateway connections
 * plus a lightweight OpenClaw Ops summary surface for Mission Control.
 *
 * Factory pattern: createGatewayRoutes(db)
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

const execFileAsync = promisify(execFile);

let _db: Database.Database;

interface OpenClawCliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error: string | null;
  command: string;
  args: string[];
}

type OpenClawCliRunner = (
  args: string[],
  options?: { timeoutMs?: number }
) => Promise<OpenClawCliResult>;

const OPENCLAW_CLI_BIN =
  process.env.OPENCLAW_CLI_BIN || (process.platform === 'win32' ? 'openclaw.cmd' : 'openclaw');

let cliRunner: OpenClawCliRunner = defaultOpenClawCliRunner;

export function setGatewayCliRunner(runner: OpenClawCliRunner | null): void {
  cliRunner = runner ?? defaultOpenClawCliRunner;
}

async function defaultOpenClawCliRunner(
  args: string[],
  options?: { timeoutMs?: number }
): Promise<OpenClawCliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(OPENCLAW_CLI_BIN, args, {
      timeout: options?.timeoutMs ?? 12000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      env: process.env,
    });

    return {
      ok: true,
      stdout,
      stderr,
      exitCode: 0,
      error: null,
      command: OPENCLAW_CLI_BIN,
      args,
    };
  } catch (error: any) {
    return {
      ok: false,
      stdout: typeof error?.stdout === 'string' ? error.stdout : '',
      stderr: typeof error?.stderr === 'string' ? error.stderr : '',
      exitCode: typeof error?.code === 'number' ? error.code : null,
      error: error?.message || 'OpenClaw command failed',
      command: OPENCLAW_CLI_BIN,
      args,
    };
  }
}

function tryParseJson(text: string): unknown | null {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sanitizeGateway(gateway: any) {
  if (!gateway) return null;
  const { token: _token, ...rest } = gateway;
  return rest;
}

async function buildOpenClawOpsSummary() {
  const activeGateway = _db
    .prepare('SELECT * FROM mc_gateways WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1')
    .get() as any;

  const [versionRun, gatewayStatusRun, gatewayHealthRun, securityAuditRun] = await Promise.all([
    cliRunner(['--version'], { timeoutMs: 4000 }),
    cliRunner(['gateway', 'status', '--json', '--timeout', '3000'], { timeoutMs: 5000 }),
    cliRunner(['gateway', 'health', '--json', '--timeout', '3000'], { timeoutMs: 5000 }),
    cliRunner(['security', 'audit', '--json'], { timeoutMs: 8000 }),
  ]);

  const gatewayStatus = tryParseJson(gatewayStatusRun.stdout) as Record<string, any> | null;
  const gatewayHealthJson = tryParseJson(gatewayHealthRun.stdout) as Record<string, any> | null;
  const securityAudit = tryParseJson(securityAuditRun.stdout) as Record<string, any> | null;

  const gatewayHealth = gatewayHealthJson || {
    ok: false,
    error:
      gatewayHealthRun.error ||
      gatewayHealthRun.stderr ||
      gatewayHealthRun.stdout ||
      'Gateway health check failed',
  };

  return {
    checkedAt: new Date().toISOString(),
    activeGateway: sanitizeGateway(activeGateway),
    cli: {
      available: versionRun.ok,
      version: versionRun.ok ? versionRun.stdout.trim() : null,
      error: versionRun.ok ? null : versionRun.error || versionRun.stderr || null,
      command: versionRun.command,
    },
    gatewayStatus,
    gatewayHealth,
    securityAudit,
    summary: {
      runtimeStatus: gatewayStatus?.service?.runtime?.status ?? null,
      rpcOk: gatewayStatus?.rpc?.ok ?? null,
      securityCounts: securityAudit?.summary ?? null,
      configAuditIssues: gatewayStatus?.service?.configAudit?.issues ?? [],
    },
  };
}

export function createGatewayRoutes(db: Database.Database): Router {
  _db = db;
  const router = Router();

  _db.exec(`
    CREATE TABLE IF NOT EXISTS mc_gateways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      token TEXT,
      workspace_root TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('online','offline','unknown','error')),
      last_check_at TEXT,
      last_error TEXT,
      allow_insecure_tls INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const count = (_db.prepare('SELECT COUNT(*) as c FROM mc_gateways').get() as any)?.c || 0;
  if (count === 0) {
    const gwUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
    _db.prepare(`
      INSERT INTO mc_gateways (name, url, token, workspace_root, is_active, status)
      VALUES (?, ?, ?, ?, 1, 'unknown')
    `).run('Yerel Gateway', gwUrl, process.env.OPENCLAW_GATEWAY_TOKEN || '', '');
  }

  router.get('/', (_req: Request, res: Response) => {
    try {
      const rows = _db.prepare('SELECT * FROM mc_gateways ORDER BY is_active DESC, created_at DESC').all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/ops/summary', async (_req: Request, res: Response) => {
    try {
      const summary = await buildOpenClawOpsSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to build OpenClaw ops summary' });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, url, token, workspace_root, allow_insecure_tls } = req.body;
      if (!name || !url) return res.status(400).json({ error: 'name and url required' });
      const result = _db.prepare(`
        INSERT INTO mc_gateways (name, url, token, workspace_root, allow_insecure_tls)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, url, token || '', workspace_root || '', allow_insecure_tls ? 1 : 0);
      const gw = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(gw);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ error: 'Gateway not found' });

      const fields: string[] = [];
      const values: any[] = [];
      for (const key of ['name', 'url', 'token', 'workspace_root', 'allow_insecure_tls']) {
        if (req.body[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(key === 'allow_insecure_tls' ? (req.body[key] ? 1 : 0) : req.body[key]);
        }
      }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      fields.push("updated_at = datetime('now')");
      values.push(id);
      _db.prepare(`UPDATE mc_gateways SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      const updated = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const gw = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id) as any;
      if (!gw) return res.status(404).json({ error: 'Gateway not found' });
      if (gw.is_active) return res.status(400).json({ error: 'Cannot delete active gateway' });
      _db.prepare('DELETE FROM mc_gateways WHERE id = ?').run(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/check', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const gw = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id) as any;
      if (!gw) return res.status(404).json({ error: 'Gateway not found' });

      const httpUrl = gw.url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`${httpUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        const status = resp.ok ? 'online' : 'error';
        const lastError = resp.ok ? null : `HTTP ${resp.status}`;
        _db
          .prepare(
            `UPDATE mc_gateways SET status = ?, last_check_at = datetime('now'), last_error = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .run(status, lastError, id);
        const updated = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id);
        res.json(updated);
      } catch (fetchErr: any) {
        _db
          .prepare(
            `UPDATE mc_gateways SET status = 'offline', last_check_at = datetime('now'), last_error = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .run(fetchErr.message, id);
        const updated = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id);
        res.json(updated);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/activate', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const gw = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id);
      if (!gw) return res.status(404).json({ error: 'Gateway not found' });
      _db.prepare("UPDATE mc_gateways SET is_active = 0, updated_at = datetime('now')").run();
      _db.prepare("UPDATE mc_gateways SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
      const updated = _db.prepare('SELECT * FROM mc_gateways WHERE id = ?').get(id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
