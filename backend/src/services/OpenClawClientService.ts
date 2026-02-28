import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { randomUUID, generateKeyPairSync, createPrivateKey, createPublicKey, createHash, sign } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OpenClawClientConfig {
  gatewayUrl: string;
  gatewayToken: string;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
  requestTimeoutMs: number;
}

export interface SessionInfo {
  id: string;
  channel?: string;
  peer?: string;
  createdAt?: string;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface RpcFrame {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  ok?: boolean;
  payload?: unknown;
  error?: { code?: number | string; message: string };
  event?: string;
  data?: Record<string, unknown>;
}

// ── Device Identity (OpenClaw v2026.2.22+ requires Ed25519 device auth) ───────

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const spki = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  if (spki.length === ED25519_SPKI_PREFIX.length + 32 &&
      spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem: string): string {
  return createHash('sha256').update(derivePublicKeyRaw(publicKeyPem)).digest('hex');
}

interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

function loadOrCreateDeviceIdentity(): DeviceIdentity {
  const identityPath = join(homedir(), '.openclaw', 'kio-backend-identity.json');
  try {
    if (existsSync(identityPath)) {
      const parsed = JSON.parse(readFileSync(identityPath, 'utf8'));
      if (parsed.deviceId && parsed.publicKeyPem && parsed.privateKeyPem) return parsed;
    }
  } catch { /* regenerate */ }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const identity: DeviceIdentity = {
    deviceId: fingerprintPublicKey(publicKey.export({ type: 'spki', format: 'pem' }).toString()),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };

  try {
    mkdirSync(dirname(identityPath), { recursive: true });
    writeFileSync(identityPath, JSON.stringify(identity, null, 2) + '\n', { mode: 0o600 });
    console.log('[OpenClawClient] Generated new device identity:', identity.deviceId.substring(0, 16) + '...');
  } catch (err: any) {
    console.warn('[OpenClawClient] Could not persist device identity:', err.message);
  }
  return identity;
}

// ── Service ────────────────────────────────────────────────────────────────────


export class OpenClawClientService extends EventEmitter {
  private static instance: OpenClawClientService | null = null;

  private config: OpenClawClientConfig;
  private ws: WebSocket | null = null;
  private authenticated = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private deviceIdentity: DeviceIdentity;
  private challengeNonce = '';

  private constructor(config: Partial<OpenClawClientConfig> = {}) {
    super();
    // Default error listener prevents Node.js from throwing uncaught exceptions
    // when 'error' events are emitted with no external listener attached
    this.on('error', () => {});
    this.config = {
      gatewayUrl: config.gatewayUrl ?? `ws://127.0.0.1:${process.env.OPENCLAW_GATEWAY_PORT || '18789'}`,
      gatewayToken: config.gatewayToken ?? (process.env.OPENCLAW_GATEWAY_TOKEN || ''),
      reconnectBaseMs: config.reconnectBaseMs ?? 800,
      reconnectMaxMs: config.reconnectMaxMs ?? 15000,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
    };
    this.deviceIdentity = loadOrCreateDeviceIdentity();
  }

  /**
   * Get or create the singleton instance.
   * Only connects if OPENCLAW_JARVIS_ENABLED=true.
   */
  static getInstance(config?: Partial<OpenClawClientConfig>): OpenClawClientService {
    if (!OpenClawClientService.instance) {
      OpenClawClientService.instance = new OpenClawClientService(config);
    }
    return OpenClawClientService.instance;
  }

  /** Reset singleton — useful for tests */
  static resetInstance(): void {
    if (OpenClawClientService.instance) {
      OpenClawClientService.instance.disconnect();
      OpenClawClientService.instance = null;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionalClose = false;

    return new Promise<void>((resolve, reject) => {
      let connectSettled = false;
      const url = `${this.config.gatewayUrl}?token=${encodeURIComponent(this.config.gatewayToken)}`;
      this.ws = new WebSocket(url);

      const connectTimeout = setTimeout(() => {
        if (!connectSettled) {
          connectSettled = true;
          reject(new Error('Connection timeout'));
          this.ws?.close();
        }
      }, this.config.requestTimeoutMs);

      this.ws.on('open', () => {
        console.log('[OpenClawClient] WebSocket connected, waiting for challenge...');
      });

      this.ws.on('message', (raw: WebSocket.Data) => {
        let frame: RpcFrame;
        try {
          frame = JSON.parse(raw.toString());
        } catch {
          console.error('[OpenClawClient] Failed to parse frame:', raw.toString().substring(0, 200));
          return;
        }

        // Challenge-response auth flow
        if (frame.type === 'event' && frame.event === 'connect.challenge') {
          const payload = frame.payload as { nonce?: string; ts?: number } | undefined;
          this.challengeNonce = (payload?.nonce as string) || '';
          this.handleChallenge();
          return;
        }

        // Auth success response
        if (frame.type === 'res' && frame.id && this.pendingRequests.has(frame.id)) {
          const pending = this.pendingRequests.get(frame.id)!;
          this.pendingRequests.delete(frame.id);
          clearTimeout(pending.timer);

          if (frame.ok === false && frame.error) {
            pending.reject(new Error(frame.error.message));
            if (!this.authenticated && !connectSettled) {
              connectSettled = true;
              clearTimeout(connectTimeout);
              reject(new Error(`Auth failed: ${frame.error.message}`));
            }
            return;
          }
          if (frame.error) {
            pending.reject(new Error(frame.error.message));
            if (!this.authenticated && !connectSettled) {
              connectSettled = true;
              clearTimeout(connectTimeout);
              reject(new Error(`Auth failed: ${frame.error.message}`));
            }
            return;
          }

          // Resolve with payload (new format) or result (legacy)
          const value = frame.payload !== undefined ? frame.payload : frame.result;
          pending.resolve(value);

          // If we just authenticated
          if (!this.authenticated) {
            this.authenticated = true;
            this.reconnectAttempts = 0;
            clearTimeout(connectTimeout);
            if (!connectSettled) {
              connectSettled = true;
              console.log('[OpenClawClient] Authenticated successfully');
              this.emit('connected');
              resolve();
            }
          }
          return;
        }

        // Incoming events (chat messages from agents)
        if (frame.type === 'event' && frame.event === 'chat') {
          const sessionKey = (frame.data?.sessionKey as string) || '';
          this.emit('chat', { sessionKey, data: frame.data });
          return;
        }

        // Other events
        if (frame.type === 'event') {
          this.emit(`event:${frame.event}`, frame.data);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(connectTimeout);
        const wasAuthenticated = this.authenticated;
        this.authenticated = false;
        this.rejectAllPending('Connection closed');

        // Reject the connect promise if we never authenticated
        if (!wasAuthenticated && !connectSettled) {
          connectSettled = true;
          reject(new Error(`Connection closed before auth (code=${code})`));
          return; // Don't auto-reconnect on initial connect failure
        }

        if (wasAuthenticated) {
          console.log(`[OpenClawClient] Disconnected (code=${code}, reason=${reason.toString()})`);
          this.emit('disconnected', { code, reason: reason.toString() });
        }

        // Only auto-reconnect if we were previously authenticated (not initial connect failure)
        if (!this.intentionalClose && wasAuthenticated) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err: Error) => {
        console.error('[OpenClawClient] WebSocket error:', err.message);
        // Don't emit 'error' here — the 'close' event will fire next and handle cleanup.
        // Emitting 'error' on EventEmitter can cause uncaught exceptions if no listener.
      });
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending('Client disconnecting');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  // ── JSON-RPC ───────────────────────────────────────────────────────────────

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.isConnected()) {
      throw new Error('OpenClaw client not connected');
    }

    const id = randomUUID();
    const frame: RpcFrame = { type: 'req', id, method, params: params ?? {} };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method} (${this.config.requestTimeoutMs}ms)`));
      }, this.config.requestTimeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(frame));
    });
  }

  // ── Convenience methods ────────────────────────────────────────────────────

  /**
   * Create or patch a session entry in the gateway store.
   * Returns the session key used.
   */
  async createSession(channel: string, peer?: string): Promise<SessionInfo> {
    const sessionKey = peer ? `agent:main:${channel}:${peer}` : `agent:main:${channel}`;
    const result = await this.call<{ ok: boolean; key: string; entry?: Record<string, unknown> }>('sessions.patch', {
      key: sessionKey,
      label: peer || channel,
    });
    return {
      id: result.key || sessionKey,
      channel,
      peer,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Send a message to an agent via chat.send.
   * sessionKey is the full key like "agent:main:jarvis:xxx"
   */
  async sendMessage(sessionKey: string, content: string): Promise<void> {
    const idempotencyKey = randomUUID();
    await this.call('chat.send', {
      sessionKey,
      message: content,
      idempotencyKey,
    });
  }

  async getSessionHistory(sessionKey: string): Promise<ChatMessage[]> {
    const result = await this.call<{ messages: ChatMessage[] }>('chat.history', {
      sessionKey,
    });
    return result.messages || [];
  }

  async listSessions(): Promise<SessionInfo[]> {
    const result = await this.call<{ sessions: SessionInfo[] }>('sessions.list', {});
    return result.sessions || [];
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private handleChallenge(): void {
    // Read token at call time — singleton may be created before dotenv.config()
    const token = this.config.gatewayToken || process.env.OPENCLAW_GATEWAY_TOKEN || '';
    const id = randomUUID();

    const CLIENT_ID = 'cli';
    const CLIENT_MODE = 'cli';
    const ROLE = 'operator';
    const SCOPES = ['operator.read', 'operator.write', 'operator.admin'];

    // Build v2 device auth payload and sign with Ed25519
    const signedAtMs = Date.now();
    const authPayload = [
      'v2',
      this.deviceIdentity.deviceId,
      CLIENT_ID,
      CLIENT_MODE,
      ROLE,
      SCOPES.join(','),
      String(signedAtMs),
      token,
      this.challengeNonce,
    ].join('|');

    const privateKey = createPrivateKey(this.deviceIdentity.privateKeyPem);
    const signature = base64UrlEncode(sign(null, Buffer.from(authPayload, 'utf8'), privateKey));
    const publicKeyB64Url = base64UrlEncode(derivePublicKeyRaw(this.deviceIdentity.publicKeyPem));

    const connectFrame: RpcFrame = {
      type: 'req',
      id,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: CLIENT_ID,
          version: '1.0.0',
          platform: 'node',
          mode: CLIENT_MODE,
        },
        role: ROLE,
        scopes: SCOPES,
        auth: {
          token,
        },
        device: {
          id: this.deviceIdentity.deviceId,
          publicKey: publicKeyB64Url,
          signature,
          signedAt: signedAtMs,
          nonce: this.challengeNonce,
        },
      },
    };

    const timer = setTimeout(() => {
      this.pendingRequests.delete(id);
      console.error('[OpenClawClient] Auth timeout');
    }, this.config.requestTimeoutMs);

    this.pendingRequests.set(id, {
      resolve: () => {},
      reject: (err: Error) => console.error('[OpenClawClient] Auth error:', err.message),
      timer,
    });

    this.ws!.send(JSON.stringify(connectFrame));
  }

  /** Calculate backoff: min(base * 2^(attempts-1), max) */
  getReconnectDelay(): number {
    const delay = this.config.reconnectBaseMs * Math.pow(2, this.reconnectAttempts);
    return Math.min(delay, this.config.reconnectMaxMs);
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;

    const delay = this.getReconnectDelay();
    this.reconnectAttempts++;
    console.log(`[OpenClawClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (err: any) {
        console.error('[OpenClawClient] Reconnect failed:', err.message);
        // scheduleReconnect will be called again from the close handler
      }
    }, delay);
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }
}
