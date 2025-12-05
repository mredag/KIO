import type { DatabaseService } from '../database/DatabaseService.js';

/**
 * Unified Interaction interface
 * Requirements: 1.1, 1.2
 */
export interface UnifiedInteraction {
  id: string;
  platform: 'whatsapp' | 'instagram';
  customer_id: string;
  direction: 'inbound' | 'outbound';
  message_text: string;
  intent: string | null;
  sentiment: string | null;
  ai_response: string | null;
  response_time_ms: number | null;
  created_at: string;
}

/**
 * Interaction filters
 * Requirements: 1.3, 1.4, 1.5
 */
export interface InteractionFilters {
  platform?: 'whatsapp' | 'instagram' | 'all';
  startDate?: string;
  endDate?: string;
  customerId?: string;
  intent?: string;
  sentiment?: string;
  limit?: number;
  offset?: number;
}

/**
 * Analytics data
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export interface InteractionAnalytics {
  total_messages: number;
  unique_customers: number;
  avg_response_time_ms: number | null;
  intent_breakdown: Record<string, number>;
  sentiment_breakdown: Record<string, number>;
  daily_trends: Array<{ date: string; count: number }>;
}

/**
 * Unified Interactions Service
 * Manages combined view of WhatsApp and Instagram interactions
 * Requirements: 1.1, 1.3, 1.4, 1.5, 5.1, 6.1, 6.2
 */
export class UnifiedInteractionsService {
  constructor(private db: DatabaseService) {}

  /**
   * Get interactions with optional filters
   * Requirements: 1.1, 1.3, 1.4, 1.5
   */
  getInteractions(filters: InteractionFilters = {}): UnifiedInteraction[] {
    let query = 'SELECT * FROM unified_interactions WHERE 1=1';
    const params: any[] = [];

    // Platform filter
    if (filters.platform && filters.platform !== 'all') {
      query += ' AND platform = ?';
      params.push(filters.platform);
    }

    // Date range filter
    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    // Customer ID filter
    if (filters.customerId) {
      query += ' AND customer_id = ?';
      params.push(filters.customerId);
    }

    // Intent filter
    if (filters.intent) {
      query += ' AND intent = ?';
      params.push(filters.intent);
    }

    // Sentiment filter
    if (filters.sentiment) {
      query += ' AND sentiment = ?';
      params.push(filters.sentiment);
    }

    // Order by timestamp descending
    query += ' ORDER BY created_at DESC';

    // Pagination
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return this.db['db'].prepare(query).all(...params) as UnifiedInteraction[];
  }

  /**
   * Get analytics for interactions
   * Requirements: 5.1, 5.2, 5.3, 5.4
   */
  getAnalytics(filters: InteractionFilters = {}): InteractionAnalytics {
    // Build base query with filters
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.platform && filters.platform !== 'all') {
      whereClause += ' AND platform = ?';
      params.push(filters.platform);
    }

    if (filters.startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    // Total messages
    const totalQuery = `SELECT COUNT(*) as count FROM unified_interactions ${whereClause}`;
    const totalResult = this.db['db'].prepare(totalQuery).get(...params) as { count: number };

    // Unique customers
    const uniqueQuery = `SELECT COUNT(DISTINCT customer_id) as count FROM unified_interactions ${whereClause}`;
    const uniqueResult = this.db['db'].prepare(uniqueQuery).get(...params) as { count: number };

    // Average response time
    const avgQuery = `
      SELECT AVG(response_time_ms) as avg_time 
      FROM unified_interactions 
      ${whereClause} AND response_time_ms IS NOT NULL
    `;
    const avgResult = this.db['db'].prepare(avgQuery).get(...params) as { avg_time: number | null };

    // Intent breakdown
    const intentQuery = `
      SELECT intent, COUNT(*) as count 
      FROM unified_interactions 
      ${whereClause} AND intent IS NOT NULL
      GROUP BY intent
    `;
    const intentResults = this.db['db'].prepare(intentQuery).all(...params) as Array<{
      intent: string;
      count: number;
    }>;
    const intentBreakdown: Record<string, number> = {};
    for (const row of intentResults) {
      intentBreakdown[row.intent] = row.count;
    }

    // Sentiment breakdown
    const sentimentQuery = `
      SELECT sentiment, COUNT(*) as count 
      FROM unified_interactions 
      ${whereClause} AND sentiment IS NOT NULL
      GROUP BY sentiment
    `;
    const sentimentResults = this.db['db'].prepare(sentimentQuery).all(...params) as Array<{
      sentiment: string;
      count: number;
    }>;
    const sentimentBreakdown: Record<string, number> = {};
    for (const row of sentimentResults) {
      sentimentBreakdown[row.sentiment] = row.count;
    }

    // Daily trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const trendsWhereClause = whereClause + ' AND created_at >= ?';
    const trendsParams = [...params, thirtyDaysAgo];

    const trendsQuery = `
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM unified_interactions 
      ${trendsWhereClause}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    const dailyTrends = this.db['db'].prepare(trendsQuery).all(...trendsParams) as Array<{
      date: string;
      count: number;
    }>;

    return {
      total_messages: totalResult.count,
      unique_customers: uniqueResult.count,
      avg_response_time_ms: avgResult.avg_time,
      intent_breakdown: intentBreakdown,
      sentiment_breakdown: sentimentBreakdown,
      daily_trends: dailyTrends,
    };
  }

  /**
   * Export interactions as CSV
   * Requirements: 6.1, 6.2
   */
  exportCsv(filters: InteractionFilters = {}): string {
    const interactions = this.getInteractions(filters);

    // CSV header
    const headers = [
      'platform',
      'customer_id',
      'direction',
      'message_text',
      'intent',
      'sentiment',
      'created_at',
    ];

    // Build CSV rows
    const rows = interactions.map((interaction) => {
      return [
        interaction.platform,
        interaction.customer_id,
        interaction.direction,
        `"${interaction.message_text.replace(/"/g, '""')}"`, // Escape quotes
        interaction.intent || '',
        interaction.sentiment || '',
        interaction.created_at,
      ].join(',');
    });

    // Combine header and rows
    return [headers.join(','), ...rows].join('\n');
  }
}
