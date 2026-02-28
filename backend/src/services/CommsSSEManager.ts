import { Response } from 'express';

export interface CommsSSEEvent {
  type: string;
  data: any;
  boardId?: string;
}

/**
 * Manages board-scoped and global SSE connections for real-time agent comms updates.
 * Follows the JarvisSSEManager singleton pattern.
 */
export class CommsSSEManager {
  private static instance: CommsSSEManager | null = null;
  private clients: Map<string, Set<Response>> = new Map();
  private globalClients: Set<Response> = new Set();

  private constructor() {}

  static getInstance(): CommsSSEManager {
    if (!CommsSSEManager.instance) {
      CommsSSEManager.instance = new CommsSSEManager();
    }
    return CommsSSEManager.instance;
  }

  static resetInstance(): void {
    if (CommsSSEManager.instance) {
      CommsSSEManager.instance.clients.clear();
      CommsSSEManager.instance.globalClients.clear();
      CommsSSEManager.instance = null;
    }
  }

  /**
   * Register an SSE client for a specific board.
   * Sets up SSE headers and auto-cleanup on disconnect.
   */
  addClient(boardId: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    if (!this.clients.has(boardId)) {
      this.clients.set(boardId, new Set());
    }
    this.clients.get(boardId)!.add(res);

    res.on('close', () => {
      this.removeClient(boardId, res);
    });
  }

  /**
   * Remove a specific client from a board's client set.
   */
  private removeClient(boardId: string, res: Response): void {
    const boardClients = this.clients.get(boardId);
    if (boardClients) {
      boardClients.delete(res);
      if (boardClients.size === 0) {
        this.clients.delete(boardId);
      }
    }
  }

  /**
   * Push an SSE event to all clients watching a specific board.
   */
  pushEvent(boardId: string, event: CommsSSEEvent): void {
    const boardClients = this.clients.get(boardId);
    if (!boardClients || boardClients.size === 0) return;

    const payload = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of boardClients) {
      try {
        client.write(payload);
      } catch {
        this.removeClient(boardId, client);
      }
    }
  }

  /**
   * Register a global SSE client that watches all boards.
   */
  addGlobalClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    this.globalClients.add(res);

    res.on('close', () => {
      this.globalClients.delete(res);
    });
  }

  /**
   * Push an SSE event to all global watchers.
   */
  pushGlobalEvent(event: CommsSSEEvent): void {
    if (this.globalClients.size === 0) return;

    const payload = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of this.globalClients) {
      try {
        client.write(payload);
      } catch {
        this.globalClients.delete(client);
      }
    }
  }
}
