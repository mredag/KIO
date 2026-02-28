/**
 * AutoPilotSSEManager — Broadcasts real-time AutoPilot events to connected clients.
 * Same singleton pattern as JarvisSSEManager but global (not per-session).
 */
import { Response } from 'express';

export interface AutoPilotSSEEvent {
  type: 'status' | 'scan_complete' | 'job_dispatched' | 'job_completed' | 'job_failed' | 'auto_approved' | 'needs_review' | 'config_updated';
  data: Record<string, unknown>;
}

export class AutoPilotSSEManager {
  private static instance: AutoPilotSSEManager | null = null;
  private clients: Set<Response> = new Set();

  private constructor() {}

  static getInstance(): AutoPilotSSEManager {
    if (!AutoPilotSSEManager.instance) {
      AutoPilotSSEManager.instance = new AutoPilotSSEManager();
    }
    return AutoPilotSSEManager.instance;
  }

  addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(event: AutoPilotSSEEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
