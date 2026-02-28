/**
 * Unit tests for OpenClawClientService
 * Tests: challenge-response handshake, RPC call timeout, connection gating on env var
 * Requirements: 2.1, 2.2, 2.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { OpenClawClientService } from './OpenClawClientService.js';

const TEST_PORT = 19876;
const TEST_URL = `ws://127.0.0.1:${TEST_PORT}`;

describe('OpenClawClientService — Unit Tests', () => {
  let gateway: WebSocketServer | null = null;
  let serverConnections: WsWebSocket[] = [];
  let lastConnectParams: Record<string, unknown> | null = null;

  function startGateway(opts?: {
    rejectAuth?: boolean;
    noChallenge?: boolean;
    silentRpc?: boolean;
  }) {
    gateway = new WebSocketServer({ port: TEST_PORT });
    gateway.on('connection', (ws) => {
      serverConnections.push(ws);

      if (!opts?.noChallenge) {
        ws.send(JSON.stringify({
          type: 'event',
          event: 'connect.challenge',
          data: { challenge: 'test' },
        }));
      }

      ws.on('message', (raw) => {
        const frame = JSON.parse(raw.toString());

        if (frame.method === 'connect') {
          lastConnectParams = frame.params;
          if (opts?.rejectAuth) {
            ws.send(JSON.stringify({
              type: 'res',
              id: frame.id,
              error: { code: 401, message: 'Invalid token' },
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'res',
              id: frame.id,
              result: { status: 'ok' },
            }));
          }
          return;
        }

        // For non-connect RPC calls, only respond if not silentRpc
        if (frame.type === 'req' && !opts?.silentRpc) {
          ws.send(JSON.stringify({
            type: 'res',
            id: frame.id,
            result: { echo: frame.method },
          }));
        }
      });
    });
  }

  function stopGateway(): Promise<void> {
    return new Promise((resolve) => {
      serverConnections.forEach((ws) => {
        try { ws.close(); } catch { /* ignore */ }
      });
      serverConnections = [];
      if (gateway) {
        gateway.close(() => resolve());
        gateway = null;
      } else {
        resolve();
      }
    });
  }

  beforeEach(() => {
    OpenClawClientService.resetInstance();
    lastConnectParams = null;
  });

  afterEach(async () => {
    OpenClawClientService.resetInstance();
    await stopGateway();
  });


  // ── Challenge-Response Handshake Tests ──────────────────────────────────

  describe('challenge-response handshake', () => {
    it('should complete auth with correct token, role, scopes, and protocol version', async () => {
      startGateway();
      const client = OpenClawClientService.getInstance({
        gatewayUrl: TEST_URL,
        gatewayToken: 'valid-token',
        requestTimeoutMs: 5000,
      });

      await client.connect();

      expect(client.isConnected()).toBe(true);
      // Verify the connect frame sent correct params
      expect(lastConnectParams).toBeTruthy();
      expect(lastConnectParams!.token).toBe('valid-token');
      expect(lastConnectParams!.protocolVersion).toBe(3);
      expect(lastConnectParams!.role).toBe('operator');
      expect(lastConnectParams!.scopes).toEqual(['operator.admin', 'operator.read', 'operator.write']);
      expect(lastConnectParams!.client).toEqual({ name: 'jarvis-orchestrator', version: '1.0.0' });
    });

    it('should reject connection when auth token is invalid', async () => {
      startGateway({ rejectAuth: true });
      const client = OpenClawClientService.getInstance({
        gatewayUrl: TEST_URL,
        gatewayToken: 'bad-token',
        requestTimeoutMs: 5000,
      });

      await expect(client.connect()).rejects.toThrow('Auth failed');
      expect(client.isConnected()).toBe(false);
    });

    it('should emit "connected" event after successful auth', async () => {
      startGateway();
      const client = OpenClawClientService.getInstance({
        gatewayUrl: TEST_URL,
        gatewayToken: 'valid-token',
        requestTimeoutMs: 5000,
      });

      const connected = new Promise<void>((resolve) => {
        client.on('connected', () => resolve());
      });

      await client.connect();
      await connected; // Should resolve without timeout
    });
  });


  // ── RPC Call Timeout Tests ──────────────────────────────────────────────

  describe('RPC call timeout', () => {
    it('should reject with timeout error when server does not respond', async () => {
      // silentRpc: server won't respond to non-connect RPC calls
      startGateway({ silentRpc: true });
      const client = OpenClawClientService.getInstance({
        gatewayUrl: TEST_URL,
        gatewayToken: 'valid-token',
        requestTimeoutMs: 500, // Short timeout for test speed
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);

      await expect(client.call('sessions.list')).rejects.toThrow(/RPC timeout/);
    });

    it('should throw when calling RPC while not connected', async () => {
      const client = OpenClawClientService.getInstance({
        gatewayUrl: TEST_URL,
        gatewayToken: 'valid-token',
      });

      // Never called connect()
      await expect(client.call('sessions.list')).rejects.toThrow('OpenClaw client not connected');
    });
  });


  // ── Connection Gating on Env Var ────────────────────────────────────────

  describe('connection gating on env var', () => {
    it('getInstance should return a client instance regardless of env var (gating is at startup level)', () => {
      // The service itself always creates an instance via getInstance.
      // The OPENCLAW_JARVIS_ENABLED gating happens at the startup level (index.ts),
      // not inside the service. Verify the service can be instantiated.
      const client = OpenClawClientService.getInstance({
        gatewayUrl: TEST_URL,
        gatewayToken: 'some-token',
      });
      expect(client).toBeTruthy();
      expect(client.isConnected()).toBe(false);
    });

    it('should use OPENCLAW_GATEWAY_PORT env var for default URL when no config provided', () => {
      const originalPort = process.env.OPENCLAW_GATEWAY_PORT;
      process.env.OPENCLAW_GATEWAY_PORT = '29999';

      try {
        const client = OpenClawClientService.getInstance({});
        // Access private config to verify
        const config = (client as any).config;
        expect(config.gatewayUrl).toBe('ws://127.0.0.1:29999');
      } finally {
        if (originalPort !== undefined) {
          process.env.OPENCLAW_GATEWAY_PORT = originalPort;
        } else {
          delete process.env.OPENCLAW_GATEWAY_PORT;
        }
      }
    });

    it('should use OPENCLAW_GATEWAY_TOKEN env var when no token in config', () => {
      const originalToken = process.env.OPENCLAW_GATEWAY_TOKEN;
      process.env.OPENCLAW_GATEWAY_TOKEN = 'env-token-123';

      try {
        const client = OpenClawClientService.getInstance({});
        const config = (client as any).config;
        expect(config.gatewayToken).toBe('env-token-123');
      } finally {
        if (originalToken !== undefined) {
          process.env.OPENCLAW_GATEWAY_TOKEN = originalToken;
        } else {
          delete process.env.OPENCLAW_GATEWAY_TOKEN;
        }
      }
    });
  });
});
