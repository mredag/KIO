import { Response } from 'express';

/**
 * Kiosk Event Types
 */
export interface KioskEvent {
  type: 'connected' | 'mode-change' | 'survey-update' | 'menu-update' | 'settings-update';
  data?: any;
  timestamp: string;
}

/**
 * KioskEventService
 * Manages Server-Sent Events (SSE) connections for real-time kiosk updates
 * 
 * Features:
 * - Real-time mode change broadcasts
 * - Survey update notifications
 * - Menu update notifications
 * - Automatic heartbeat to keep connections alive
 * - Connection management and cleanup
 */
export class KioskEventService {
  private clients: Map<string, Response> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
  }

  /**
   * Add a new SSE client connection
   */
  addClient(id: string, res: Response): void {
    this.clients.set(id, res);
    console.log(`[SSE] Client connected: ${id} (Total: ${this.clients.size})`);
  }

  /**
   * Remove a client connection
   */
  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[SSE] Client disconnected: ${id} (Total: ${this.clients.size})`);
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: KioskEvent): void {
    const data = JSON.stringify(event);
    const deadClients: string[] = [];

    this.clients.forEach((client, id) => {
      try {
        // Send event with type field for addEventListener to work
        client.write(`event: ${event.type}\ndata: ${data}\n\n`);
      } catch (error) {
        console.error(`[SSE] Failed to send event to client ${id}:`, error);
        deadClients.push(id);
      }
    });

    // Clean up dead connections
    deadClients.forEach(id => this.removeClient(id));
  }

  /**
   * Broadcast mode change to all kiosks
   */
  broadcastModeChange(mode: string, activeSurveyId?: string | null, couponData?: { couponQrUrl: string; couponToken: string }): void {
    console.log(`[SSE] Broadcasting mode change: ${mode}${activeSurveyId ? ` (survey: ${activeSurveyId})` : ''}${couponData ? ` (coupon: ${couponData.couponToken})` : ''}`);
    
    this.broadcast({
      type: 'mode-change',
      data: { 
        mode, 
        activeSurveyId: activeSurveyId || null,
        couponQrUrl: couponData?.couponQrUrl || null,
        couponToken: couponData?.couponToken || null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast survey update notification
   */
  broadcastSurveyUpdate(surveyId: string): void {
    console.log(`[SSE] Broadcasting survey update: ${surveyId}`);
    
    this.broadcast({
      type: 'survey-update',
      data: { surveyId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast menu update notification
   */
  broadcastMenuUpdate(): void {
    console.log('[SSE] Broadcasting menu update');
    
    this.broadcast({
      type: 'menu-update',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast settings update notification
   */
  broadcastSettingsUpdate(): void {
    console.log('[SSE] Broadcasting settings update');
    
    this.broadcast({
      type: 'settings-update',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send heartbeat to all clients to keep connections alive
   */
  private sendHeartbeat(): void {
    const deadClients: string[] = [];

    this.clients.forEach((client, id) => {
      try {
        // Send comment as heartbeat (doesn't trigger event listener)
        client.write(': heartbeat\n\n');
      } catch (error) {
        console.error(`[SSE] Heartbeat failed for client ${id}:`, error);
        deadClients.push(id);
      }
    });

    // Clean up dead connections
    deadClients.forEach(id => this.removeClient(id));
  }

  /**
   * Start heartbeat interval (every 30 seconds)
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.clients.size > 0) {
        this.sendHeartbeat();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Close all connections and cleanup
   */
  closeAll(): void {
    console.log('[SSE] Closing all connections');
    
    this.clients.forEach((client, id) => {
      try {
        client.end();
      } catch (error) {
        console.error(`[SSE] Error closing client ${id}:`, error);
      }
    });

    this.clients.clear();
    this.stopHeartbeat();
  }
}

// Singleton instance
export const kioskEventService = new KioskEventService();
