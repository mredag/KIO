import { Response } from 'express';

export interface SSEEvent {
  type: 'message' | 'message_complete' | 'status' | 'typing' | 'error' | 'agent_status';
  data: Record<string, unknown>;
}

/**
 * Manages per-session SSE connections for pushing real-time Jarvis updates to the frontend.
 * Each planning session can have multiple connected clients (browser tabs).
 */
export class JarvisSSEManager {
  private static instance: JarvisSSEManager | null = null;
  private clients: Map<string, Set<Response>> = new Map();

  private constructor() {}

  static getInstance(): JarvisSSEManager {
    if (!JarvisSSEManager.instance) {
      JarvisSSEManager.instance = new JarvisSSEManager();
    }
    return JarvisSSEManager.instance;
  }

  static resetInstance(): void {
    if (JarvisSSEManager.instance) {
      // Clean up all clients
      JarvisSSEManager.instance.clients.clear();
      JarvisSSEManager.instance = null;
    }
  }

  /**
   * Register an SSE client for a specific session.
   * Sets up SSE headers and auto-cleanup on disconnect.
   */
  addClient(sessionId: string, res: Response): void {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Get or create the client set for this session
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId)!.add(res);

    // Auto-cleanup when client disconnects
    res.on('close', () => {
      this.removeClient(sessionId, res);
    });
  }

  /**
   * Remove a specific client from a session's client set.
   */
  removeClient(sessionId: string, res: Response): void {
    const sessionClients = this.clients.get(sessionId);
    if (sessionClients) {
      sessionClients.delete(res);
      // Clean up empty sets
      if (sessionClients.size === 0) {
        this.clients.delete(sessionId);
      }
    }
  }

  /**
   * Push an SSE event to all clients watching a specific session.
   */
  pushEvent(sessionId: string, event: SSEEvent): void {
    const sessionClients = this.clients.get(sessionId);
    if (!sessionClients || sessionClients.size === 0) {
      return;
    }

    const payload = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of sessionClients) {
      try {
        client.write(payload);
      } catch {
        // Client likely disconnected, remove it
        this.removeClient(sessionId, client);
      }
    }
  }

  /**
   * Get the number of active SSE clients for a session.
   */
  getClientCount(sessionId: string): number {
    return this.clients.get(sessionId)?.size ?? 0;
  }
}
