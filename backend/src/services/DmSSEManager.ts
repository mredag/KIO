import { Response } from 'express';

export interface DmSSEEvent {
  type: 'dm:new' | 'dm:alert' | 'dm:health_update';
  data: any;
}

/**
 * Manages SSE connections for the DM Kontrol Merkezi page.
 * Pushes real-time DM pipeline events to connected frontend clients.
 * Follows the CommsSSEManager singleton pattern (simplified, no board scoping).
 */
export class DmSSEManager {
  private static instance: DmSSEManager | null = null;
  private clients: Set<Response> = new Set();
  private errorTimestamps: number[] = []; // rolling window for alert threshold

  private static readonly ALERT_THRESHOLD = 5;
  private static readonly ALERT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  private constructor() {}

  static getInstance(): DmSSEManager {
    if (!DmSSEManager.instance) {
      DmSSEManager.instance = new DmSSEManager();
    }
    return DmSSEManager.instance;
  }

  static resetInstance(): void {
    if (DmSSEManager.instance) {
      DmSSEManager.instance.clients.clear();
      DmSSEManager.instance.errorTimestamps = [];
      DmSSEManager.instance = null;
    }
  }

  /**
   * Register an SSE client. Sets SSE headers and auto-cleanup on disconnect.
   */
  addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    this.clients.add(res);

    // Send connected event with current client count
    const connectedPayload = `data: ${JSON.stringify({ type: 'connected', data: { clientCount: this.clients.size } })}\n\n`;
    try {
      res.write(connectedPayload);
    } catch {
      this.clients.delete(res);
    }

    res.on('close', () => {
      this.removeClient(res);
    });
  }

  /**
   * Remove a client from the active connections set.
   */
  removeClient(res: Response): void {
    this.clients.delete(res);
  }

  /**
   * Push an SSE event to all connected clients.
   * If the event is dm:new with a pipelineError, tracks the error timestamp
   * and checks the alert threshold.
   */
  pushEvent(event: DmSSEEvent): void {
    // Track error timestamps for alert threshold
    if (event.type === 'dm:new' && event.data?.pipelineError) {
      this.errorTimestamps.push(Date.now());
      this.checkAlertThreshold();
    }

    if (this.clients.size === 0) return;

    const payload = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        // Silently remove clients on write failure
        this.clients.delete(client);
      }
    }
  }

  /**
   * Get the number of currently connected SSE clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if the error count exceeds the alert threshold within the rolling window.
   * Cleans timestamps older than 10 minutes, then pushes dm:alert if 5+ errors remain.
   */
  private checkAlertThreshold(): void {
    const now = Date.now();
    const windowStart = now - DmSSEManager.ALERT_WINDOW_MS;

    // Clean timestamps older than the window
    this.errorTimestamps = this.errorTimestamps.filter(ts => ts >= windowStart);

    if (this.errorTimestamps.length >= DmSSEManager.ALERT_THRESHOLD) {
      const alertEvent: DmSSEEvent = {
        type: 'dm:alert',
        data: {
          errorCount: this.errorTimestamps.length,
          windowMinutes: 10,
          message: `${this.errorTimestamps.length} pipeline hatası son 10 dakikada tespit edildi`,
        },
      };

      if (this.clients.size === 0) return;

      const payload = `data: ${JSON.stringify(alertEvent)}\n\n`;

      for (const client of this.clients) {
        try {
          client.write(payload);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }
}
