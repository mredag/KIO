import Database from 'better-sqlite3';

export interface DMInboundAggregationFragment {
  text: string;
  receivedAt: string;
}

export interface DMInboundAggregationTrace {
  aggregated: boolean;
  fragmentCount: number;
  fragments: string[];
  firstReceivedAt: string;
  lastReceivedAt: string;
  windowMs: number;
  trigger: 'timer' | 'immediate';
}

export interface DMInboundAggregationDispatchPayload {
  channel: string;
  customerId: string;
  messageText: string;
  trace: DMInboundAggregationTrace;
}

export interface DMInboundAggregationIngestParams {
  channel: string;
  customerId: string;
  messageText: string;
  receivedAt?: string;
}

export interface DMInboundAggregationIngestResult {
  action: 'buffered' | 'dispatch_now';
  messageText?: string;
  trace: DMInboundAggregationTrace | null;
}

interface DMInboundBufferRow {
  channel: string;
  customerId: string;
  mergedText: string;
  fragments: DMInboundAggregationFragment[];
  fragmentCount: number;
  firstReceivedAt: string;
  lastReceivedAt: string;
  flushAfter: string;
  status: 'buffering' | 'processing';
}

type DispatchHandler = (payload: DMInboundAggregationDispatchPayload) => Promise<void> | void;

export class DMInboundAggregationService {
  private db: Database.Database;
  private bufferWindowMs: number;
  private timerHandles = new Map<string, ReturnType<typeof setTimeout>>();
  private dispatchHandler: DispatchHandler | null = null;

  constructor(
    db: Database.Database,
    options: {
      bufferWindowMs?: number;
      onDispatch?: DispatchHandler | null;
    } = {},
  ) {
    this.db = db;
    this.bufferWindowMs = Math.max(800, options.bufferWindowMs ?? 5000);
    this.dispatchHandler = options.onDispatch || null;
    this.restorePendingBuffers();
  }

  setDispatchHandler(handler: DispatchHandler | null): void {
    this.dispatchHandler = handler;
    this.restorePendingBuffers();
  }

  dispose(): void {
    for (const key of Array.from(this.timerHandles.keys())) {
      this.clearTimer(key);
    }
  }

  ingest(params: DMInboundAggregationIngestParams): DMInboundAggregationIngestResult {
    const normalizedText = this.normalizeText(params.messageText);
    if (!normalizedText) {
      return {
        action: 'dispatch_now',
        messageText: '',
        trace: null,
      };
    }

    const channel = params.channel.trim().toLowerCase();
    const customerId = params.customerId.trim();
    const receivedAt = params.receivedAt || new Date().toISOString();
    const existing = this.getBuffer(channel, customerId);

    if (!existing) {
      if (!this.shouldStartBuffer(normalizedText)) {
        return {
          action: 'dispatch_now',
          messageText: normalizedText,
          trace: null,
        };
      }

      const created = this.buildNewBuffer(channel, customerId, normalizedText, receivedAt);
      this.saveBuffer(created);
      this.scheduleBuffer(created);
      return {
        action: 'buffered',
        trace: this.buildTrace(created, 'timer'),
      };
    }

    const appended = this.appendToBuffer(existing, normalizedText, receivedAt);
    if (this.shouldDispatchMerged(normalizedText)) {
      this.clearTimer(this.makeKey(channel, customerId));
      this.deleteBuffer(channel, customerId);
      return {
        action: 'dispatch_now',
        messageText: appended.mergedText,
        trace: this.buildTrace(appended, 'immediate'),
      };
    }

    this.saveBuffer(appended);
    this.scheduleBuffer(appended);
    return {
      action: 'buffered',
      trace: this.buildTrace(appended, 'timer'),
    };
  }

  private restorePendingBuffers(): void {
    const rows = this.db.prepare(`
      SELECT
        channel,
        customer_id,
        merged_text,
        fragments_json,
        fragment_count,
        first_received_at,
        last_received_at,
        flush_after,
        status
      FROM dm_inbound_buffer
    `).all() as Array<{
      channel: string;
      customer_id: string;
      merged_text: string;
      fragments_json: string;
      fragment_count: number;
      first_received_at: string;
      last_received_at: string;
      flush_after: string;
      status: 'buffering' | 'processing';
    }>;

    if (rows.length === 0) {
      return;
    }

    for (const row of rows) {
      if (row.status === 'processing') {
        this.db.prepare(`
          UPDATE dm_inbound_buffer
          SET status = 'buffering', updated_at = ?
          WHERE channel = ? AND customer_id = ?
        `).run(new Date().toISOString(), row.channel, row.customer_id);
      }

      const refreshed = this.getBuffer(row.channel, row.customer_id);
      if (refreshed) {
        this.scheduleBuffer(refreshed);
      }
    }
  }

  private getBuffer(channel: string, customerId: string): DMInboundBufferRow | null {
    const row = this.db.prepare(`
      SELECT
        channel,
        customer_id,
        merged_text,
        fragments_json,
        fragment_count,
        first_received_at,
        last_received_at,
        flush_after,
        status
      FROM dm_inbound_buffer
      WHERE channel = ? AND customer_id = ?
    `).get(channel, customerId) as {
      channel: string;
      customer_id: string;
      merged_text: string;
      fragments_json: string;
      fragment_count: number;
      first_received_at: string;
      last_received_at: string;
      flush_after: string;
      status: 'buffering' | 'processing';
    } | undefined;

    if (!row) {
      return null;
    }

    const fragments = this.parseFragments(row.fragments_json);
    return {
      channel: row.channel,
      customerId: row.customer_id,
      mergedText: row.merged_text,
      fragments,
      fragmentCount: row.fragment_count || fragments.length,
      firstReceivedAt: row.first_received_at,
      lastReceivedAt: row.last_received_at,
      flushAfter: row.flush_after,
      status: row.status,
    };
  }

  private buildNewBuffer(channel: string, customerId: string, messageText: string, receivedAt: string): DMInboundBufferRow {
    const flushAfter = new Date(new Date(receivedAt).getTime() + this.bufferWindowMs).toISOString();
    return {
      channel,
      customerId,
      mergedText: messageText,
      fragments: [{ text: messageText, receivedAt }],
      fragmentCount: 1,
      firstReceivedAt: receivedAt,
      lastReceivedAt: receivedAt,
      flushAfter,
      status: 'buffering',
    };
  }

  private appendToBuffer(buffer: DMInboundBufferRow, messageText: string, receivedAt: string): DMInboundBufferRow {
    const fragments = [...buffer.fragments, { text: messageText, receivedAt }];
    const flushAfter = new Date(new Date(receivedAt).getTime() + this.bufferWindowMs).toISOString();
    return {
      ...buffer,
      mergedText: this.normalizeText(`${buffer.mergedText} ${messageText}`),
      fragments,
      fragmentCount: fragments.length,
      lastReceivedAt: receivedAt,
      flushAfter,
      status: 'buffering',
    };
  }

  private saveBuffer(buffer: DMInboundBufferRow): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO dm_inbound_buffer (
        channel,
        customer_id,
        merged_text,
        fragments_json,
        fragment_count,
        first_received_at,
        last_received_at,
        flush_after,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel, customer_id) DO UPDATE SET
        merged_text = excluded.merged_text,
        fragments_json = excluded.fragments_json,
        fragment_count = excluded.fragment_count,
        first_received_at = excluded.first_received_at,
        last_received_at = excluded.last_received_at,
        flush_after = excluded.flush_after,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      buffer.channel,
      buffer.customerId,
      buffer.mergedText,
      JSON.stringify(buffer.fragments),
      buffer.fragmentCount,
      buffer.firstReceivedAt,
      buffer.lastReceivedAt,
      buffer.flushAfter,
      buffer.status,
      now,
      now,
    );
  }

  private deleteBuffer(channel: string, customerId: string): void {
    this.db.prepare(`
      DELETE FROM dm_inbound_buffer
      WHERE channel = ? AND customer_id = ?
    `).run(channel, customerId);
  }

  private scheduleBuffer(buffer: DMInboundBufferRow): void {
    if (!this.dispatchHandler) {
      return;
    }

    const key = this.makeKey(buffer.channel, buffer.customerId);
    this.clearTimer(key);

    const flushAtMs = new Date(buffer.flushAfter).getTime();
    const delayMs = Number.isNaN(flushAtMs)
      ? this.bufferWindowMs
      : Math.max(0, flushAtMs - Date.now());

    const timerHandle = setTimeout(() => {
      void this.flushDueBuffer(buffer.channel, buffer.customerId);
    }, delayMs);

    this.timerHandles.set(key, timerHandle);
  }

  private async flushDueBuffer(channel: string, customerId: string): Promise<void> {
    if (!this.dispatchHandler) {
      return;
    }

    const buffer = this.claimDueBuffer(channel, customerId);
    if (!buffer) {
      return;
    }

    const key = this.makeKey(channel, customerId);
    this.clearTimer(key);

    try {
      await this.dispatchHandler({
        channel: buffer.channel,
        customerId: buffer.customerId,
        messageText: buffer.mergedText,
        trace: this.buildTrace(buffer, 'timer'),
      });
      this.deleteBuffer(buffer.channel, buffer.customerId);
    } catch (error) {
      const retryAt = new Date(Date.now() + Math.max(1500, Math.floor(this.bufferWindowMs / 2))).toISOString();
      this.db.prepare(`
        UPDATE dm_inbound_buffer
        SET status = 'buffering', flush_after = ?, updated_at = ?
        WHERE channel = ? AND customer_id = ?
      `).run(retryAt, new Date().toISOString(), buffer.channel, buffer.customerId);
      const refreshed = this.getBuffer(buffer.channel, buffer.customerId);
      if (refreshed) {
        this.scheduleBuffer(refreshed);
      }
      console.error('[DMInboundAggregation] Dispatch failed, rescheduled buffer:', error);
    }
  }

  private claimDueBuffer(channel: string, customerId: string): DMInboundBufferRow | null {
    const buffer = this.getBuffer(channel, customerId);
    if (!buffer || buffer.status !== 'buffering') {
      return null;
    }

    const flushAtMs = new Date(buffer.flushAfter).getTime();
    if (!Number.isNaN(flushAtMs) && flushAtMs > Date.now()) {
      this.scheduleBuffer(buffer);
      return null;
    }

    const changes = this.db.prepare(`
      UPDATE dm_inbound_buffer
      SET status = 'processing', updated_at = ?
      WHERE channel = ? AND customer_id = ? AND status = 'buffering'
    `).run(new Date().toISOString(), channel, customerId).changes;

    if (changes === 0) {
      return null;
    }

    return {
      ...buffer,
      status: 'processing',
    };
  }

  private shouldStartBuffer(messageText: string): boolean {
    const tokenCount = this.tokenize(messageText).length;
    if (tokenCount === 0) {
      return false;
    }
    if (/[?!.:;]/.test(messageText)) {
      return false;
    }
    if (messageText.length > 24 || tokenCount > 3) {
      return false;
    }
    return true;
  }

  private shouldDispatchMerged(latestMessage: string): boolean {
    return !this.shouldStartBuffer(latestMessage);
  }

  private buildTrace(buffer: DMInboundBufferRow, trigger: 'timer' | 'immediate'): DMInboundAggregationTrace {
    return {
      aggregated: buffer.fragmentCount > 1,
      fragmentCount: buffer.fragmentCount,
      fragments: buffer.fragments.map(fragment => fragment.text),
      firstReceivedAt: buffer.firstReceivedAt,
      lastReceivedAt: buffer.lastReceivedAt,
      windowMs: this.bufferWindowMs,
      trigger,
    };
  }

  private parseFragments(rawValue: string): DMInboundAggregationFragment[] {
    try {
      const parsed = JSON.parse(rawValue) as Array<{ text?: unknown; receivedAt?: unknown }>;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const text = this.normalizeText(String(item.text ?? ''));
          const receivedAt = String(item.receivedAt ?? '').trim();
          if (!text || !receivedAt) {
            return null;
          }
          return { text, receivedAt };
        })
        .filter((item): item is DMInboundAggregationFragment => item !== null);
    } catch {
      return [];
    }
  }

  private tokenize(text: string): string[] {
    return this.normalizeText(text)
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean);
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private makeKey(channel: string, customerId: string): string {
    return `${channel}:${customerId}`;
  }

  private clearTimer(key: string): void {
    const existing = this.timerHandles.get(key);
    if (existing) {
      clearTimeout(existing);
      this.timerHandles.delete(key);
    }
  }
}
