/**
 * ActivitySSEManager — Broadcasts real-time activity events to connected clients.
 * Aggregates ALL system events: mc_events, DM pipeline, autopilot, comms, approvals.
 * Same singleton pattern as AutoPilotSSEManager.
 */
import { Response } from 'express';

export interface ActivityEvent {
  type: string;
  data: {
    id?: number | string;
    event_type: string;
    entity_type?: string;
    message?: string;
    agent_id?: number | string | null;
    agent_name?: string | null;
    board_id?: number | string | null;
    board_name?: string | null;
    created_at?: string;
    metadata?: Record<string, unknown>;
  };
}

export class ActivitySSEManager {
  private static instance: ActivitySSEManager | null = null;
  private clients: Set<Response> = new Set();

  private constructor() {}

  static getInstance(): ActivitySSEManager {
    if (!ActivitySSEManager.instance) {
      ActivitySSEManager.instance = new ActivitySSEManager();
    }
    return ActivitySSEManager.instance;
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

  broadcast(event: ActivityEvent): void {
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
