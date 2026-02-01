import type { DatabaseService } from '../database/DatabaseService.js';

/**
 * Service Status interface
 * Requirements: 2.1, 9.1, 9.2
 */
export interface ServiceStatus {
  service_name: 'whatsapp' | 'instagram';
  enabled: number;
  last_activity: string | null;
  message_count_24h: number;
  config: string | null;
  updated_at: string;
}

/**
 * Service Control Service
 * Manages automation service states and health monitoring
 * Requirements: 2.1, 2.2, 2.3, 2.4, 9.1, 9.2
 */
export class ServiceControlService {
  constructor(private db: DatabaseService) {}

  /**
   * Get all services with status and health metrics
   * Requirements: 2.1, 9.1, 9.2
   */
  getAll(): ServiceStatus[] {
    const services = this.db['db']
      .prepare('SELECT * FROM service_settings ORDER BY service_name')
      .all() as ServiceStatus[];

    // Enrich with health metrics
    return services.map((service) => this.enrichWithMetrics(service));
  }

  /**
   * Get status for a specific service
   * Requirements: 2.1, 2.4
   */
  getStatus(serviceName: string): ServiceStatus | null {
    const service = this.db['db']
      .prepare('SELECT * FROM service_settings WHERE service_name = ?')
      .get(serviceName) as ServiceStatus | undefined;

    if (!service) {
      return null;
    }

    return this.enrichWithMetrics(service);
  }

  /**
   * Enable or disable a service
   * Requirements: 2.2, 2.3, 2.4
   */
  setEnabled(serviceName: string, enabled: boolean): ServiceStatus {
    const now = new Date().toISOString();

    const query = `
      UPDATE service_settings 
      SET enabled = ?, updated_at = ? 
      WHERE service_name = ?
    `;

    this.db['db'].prepare(query).run(enabled ? 1 : 0, now, serviceName);

    return this.getStatus(serviceName)!;
  }

  /**
   * Update service configuration
   * Requirements: 2.4
   */
  updateConfig(serviceName: string, config: Record<string, any>): ServiceStatus {
    const now = new Date().toISOString();

    const query = `
      UPDATE service_settings 
      SET config = ?, updated_at = ? 
      WHERE service_name = ?
    `;

    this.db['db'].prepare(query).run(JSON.stringify(config), now, serviceName);

    return this.getStatus(serviceName)!;
  }

  /**
   * Get blocking system status for a service
   */
  getBlockingEnabled(serviceName: string): boolean {
    const service = this.getStatus(serviceName);
    if (!service || !service.config) {
      return false; // Default: blocking disabled
    }

    try {
      const config = JSON.parse(service.config);
      return config.blocking_enabled === true;
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable blocking system for a service
   */
  setBlockingEnabled(serviceName: string, enabled: boolean): ServiceStatus {
    const service = this.getStatus(serviceName);
    let config: Record<string, any> = {};

    if (service?.config) {
      try {
        config = JSON.parse(service.config);
      } catch {
        config = {};
      }
    }

    config.blocking_enabled = enabled;
    return this.updateConfig(serviceName, config);
  }

  /**
   * Update last activity timestamp for a service
   * Called when interactions are logged
   * Requirements: 9.1
   */
  updateLastActivity(serviceName: string): void {
    const now = new Date().toISOString();

    const query = `
      UPDATE service_settings 
      SET last_activity = ?, updated_at = ? 
      WHERE service_name = ?
    `;

    this.db['db'].prepare(query).run(now, now, serviceName);
  }

  /**
   * Enrich service status with health metrics
   * Requirements: 9.1, 9.2
   */
  private enrichWithMetrics(service: ServiceStatus): ServiceStatus {
    // Calculate message count in last 24 hours
    const messageCount24h = this.getMessageCount24h(service.service_name);

    // Get last activity from most recent interaction
    const lastActivity = this.getLastActivityFromInteractions(service.service_name);

    return {
      ...service,
      message_count_24h: messageCount24h,
      last_activity: lastActivity || service.last_activity,
    };
  }

  /**
   * Get message count in last 24 hours for a service
   * Requirements: 9.2
   */
  private getMessageCount24h(serviceName: string): number {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query: string;
    if (serviceName === 'whatsapp') {
      query = `
        SELECT COUNT(*) as count 
        FROM whatsapp_interactions 
        WHERE created_at >= ?
      `;
    } else if (serviceName === 'instagram') {
      query = `
        SELECT COUNT(*) as count 
        FROM instagram_interactions 
        WHERE created_at >= ?
      `;
    } else {
      return 0;
    }

    const result = this.db['db'].prepare(query).get(twentyFourHoursAgo) as { count: number };
    return result.count;
  }

  /**
   * Get last activity timestamp from interactions
   * Requirements: 9.1
   */
  private getLastActivityFromInteractions(serviceName: string): string | null {
    let query: string;
    if (serviceName === 'whatsapp') {
      query = `
        SELECT created_at 
        FROM whatsapp_interactions 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
    } else if (serviceName === 'instagram') {
      query = `
        SELECT created_at 
        FROM instagram_interactions 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
    } else {
      return null;
    }

    const result = this.db['db'].prepare(query).get() as { created_at: string } | undefined;
    return result?.created_at || null;
  }
}
