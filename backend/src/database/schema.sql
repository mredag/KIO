-- SPA Digital Kiosk Database Schema
-- SQLite database with WAL mode for concurrent access

-- Massages table
CREATE TABLE IF NOT EXISTS massages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  long_description TEXT,
  duration TEXT,
  media_type TEXT CHECK(media_type IN ('video', 'photo')),
  media_url TEXT,
  purpose_tags TEXT, -- JSON array
  sessions TEXT, -- JSON array of {name, price}
  is_featured INTEGER DEFAULT 0,
  is_campaign INTEGER DEFAULT 0,
  layout_template TEXT DEFAULT 'price-list',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Survey templates table
CREATE TABLE IF NOT EXISTS survey_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('satisfaction', 'discovery')),
  title TEXT NOT NULL,
  description TEXT,
  questions TEXT NOT NULL, -- JSON array
  is_active INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Survey responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  answers TEXT NOT NULL, -- JSON object
  synced INTEGER DEFAULT 0,
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (survey_id) REFERENCES survey_templates(id)
);

-- Kiosk state table (single row)
CREATE TABLE IF NOT EXISTS kiosk_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT CHECK(mode IN ('digital-menu', 'survey', 'google-qr', 'coupon-qr')),
  active_survey_id TEXT,
  coupon_qr_url TEXT,
  coupon_token TEXT,
  last_heartbeat DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (active_survey_id) REFERENCES survey_templates(id)
);

-- System settings table (single row)
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  slideshow_timeout INTEGER DEFAULT 60,
  survey_timeout INTEGER DEFAULT 60,
  google_qr_display_duration INTEGER DEFAULT 10,
  google_review_url TEXT,
  google_review_title TEXT,
  google_review_description TEXT,
  kiosk_theme TEXT DEFAULT 'classic',
  sheets_sheet_id TEXT,
  sheets_sheet_name TEXT,
  sheets_credentials TEXT,
  admin_password_hash TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT CHECK(level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  details TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Coupon tokens table
CREATE TABLE IF NOT EXISTS coupon_tokens (
  token TEXT PRIMARY KEY,
  status TEXT CHECK(status IN ('issued', 'used', 'expired')) DEFAULT 'issued',
  issued_for TEXT,
  kiosk_id TEXT,
  phone TEXT,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Coupon wallets table
CREATE TABLE IF NOT EXISTS coupon_wallets (
  phone TEXT PRIMARY KEY,
  coupon_count INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_redeemed INTEGER DEFAULT 0,
  opted_in_marketing INTEGER DEFAULT 0,
  last_message_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Coupon redemptions table
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  coupons_used INTEGER DEFAULT 4,
  status TEXT CHECK(status IN ('pending', 'completed', 'rejected')) DEFAULT 'pending',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME,
  completed_at DATETIME,
  rejected_at DATETIME
);

-- Coupon events table
CREATE TABLE IF NOT EXISTS coupon_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  event TEXT NOT NULL,
  token TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Coupon rate limits table
CREATE TABLE IF NOT EXISTS coupon_rate_limits (
  phone TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  reset_at DATETIME NOT NULL,
  PRIMARY KEY (phone, endpoint)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_massages_featured ON massages(is_featured);
CREATE INDEX IF NOT EXISTS idx_massages_campaign ON massages(is_campaign);
CREATE INDEX IF NOT EXISTS idx_massages_sort ON massages(sort_order);
CREATE INDEX IF NOT EXISTS idx_survey_responses_synced ON survey_responses(synced);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created ON survey_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);

-- Coupon table indexes
CREATE INDEX IF NOT EXISTS idx_coupon_tokens_status ON coupon_tokens(status);
CREATE INDEX IF NOT EXISTS idx_coupon_tokens_expires ON coupon_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_coupon_tokens_phone ON coupon_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_wallets_phone ON coupon_wallets(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_status ON coupon_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_coupon_events_phone ON coupon_events(phone);
CREATE INDEX IF NOT EXISTS idx_coupon_events_created ON coupon_events(created_at);
CREATE INDEX IF NOT EXISTS idx_coupon_rate_limits_reset ON coupon_rate_limits(reset_at);


-- WhatsApp message deduplication table
CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
  message_id TEXT PRIMARY KEY,
  phone TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_processed ON whatsapp_processed_messages(processed_at);

-- Instagram customers table
CREATE TABLE IF NOT EXISTS instagram_customers (
  instagram_id TEXT PRIMARY KEY,
  phone TEXT,
  name TEXT,
  last_visit DATETIME,
  last_interaction_at DATETIME,
  interaction_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instagram_customers_phone ON instagram_customers(phone);
CREATE INDEX IF NOT EXISTS idx_instagram_customers_last_interaction ON instagram_customers(last_interaction_at);

-- Instagram interactions table (for marketing analytics)
CREATE TABLE IF NOT EXISTS instagram_interactions (
  id TEXT PRIMARY KEY,
  instagram_id TEXT NOT NULL,
  direction TEXT CHECK(direction IN ('inbound', 'outbound')) NOT NULL,
  message_text TEXT NOT NULL,
  intent TEXT,
  sentiment TEXT,
  ai_response TEXT,
  response_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instagram_id) REFERENCES instagram_customers(instagram_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_interactions_user ON instagram_interactions(instagram_id);
CREATE INDEX IF NOT EXISTS idx_instagram_interactions_created ON instagram_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_instagram_interactions_intent ON instagram_interactions(intent);
CREATE INDEX IF NOT EXISTS idx_instagram_interactions_sentiment ON instagram_interactions(sentiment);

-- WhatsApp interactions table (mirrors instagram_interactions schema)
-- Requirements: 8.1, 8.2
CREATE TABLE IF NOT EXISTS whatsapp_interactions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  direction TEXT CHECK(direction IN ('inbound', 'outbound')) NOT NULL,
  message_text TEXT NOT NULL,
  intent TEXT,
  sentiment TEXT,
  ai_response TEXT,
  response_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_phone ON whatsapp_interactions(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_created ON whatsapp_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_intent ON whatsapp_interactions(intent);

-- Service settings table for automation control
-- Requirements: 2.1, 2.2, 2.3
CREATE TABLE IF NOT EXISTS service_settings (
  service_name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  config TEXT, -- JSON
  last_activity DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default service settings
INSERT OR IGNORE INTO service_settings (service_name, enabled, updated_at)
VALUES 
  ('whatsapp', 1, CURRENT_TIMESTAMP),
  ('instagram', 1, CURRENT_TIMESTAMP);

-- Knowledge base table for dynamic AI context
-- Requirements: 3.1, 3.2, 4.1
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('services', 'pricing', 'hours', 'policies', 'contact', 'general', 'faq')),
  key_name TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, key_name)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON knowledge_base(is_active);

CREATE TABLE IF NOT EXISTS dm_response_cache (
  id TEXT PRIMARY KEY,
  lookup_key TEXT NOT NULL,
  cache_class TEXT NOT NULL,
  normalized_message TEXT NOT NULL,
  kb_signature TEXT NOT NULL,
  config_signature TEXT NOT NULL,
  conduct_state TEXT NOT NULL,
  cache_version TEXT NOT NULL,
  response_hash TEXT NOT NULL,
  response_text TEXT NOT NULL,
  source_execution_id TEXT,
  observation_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK(status IN ('candidate', 'active')) DEFAULT 'candidate',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(lookup_key, response_hash)
);

CREATE INDEX IF NOT EXISTS idx_dm_response_cache_lookup ON dm_response_cache(lookup_key, status);
CREATE INDEX IF NOT EXISTS idx_dm_response_cache_expires ON dm_response_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dm_response_cache_class ON dm_response_cache(cache_class, status);

CREATE TABLE IF NOT EXISTS dm_inbound_buffer (
  channel TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  merged_text TEXT NOT NULL,
  fragments_json TEXT NOT NULL,
  fragment_count INTEGER NOT NULL DEFAULT 1,
  first_received_at TEXT NOT NULL,
  last_received_at TEXT NOT NULL,
  flush_after TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('buffering', 'processing')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (channel, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_inbound_buffer_flush ON dm_inbound_buffer(flush_after, status);

CREATE TABLE IF NOT EXISTS dm_review_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'completed', 'failed')),
  channel TEXT NOT NULL CHECK(channel IN ('instagram', 'whatsapp', 'both')),
  days_back INTEGER NOT NULL DEFAULT 7,
  model TEXT NOT NULL,
  total_threads INTEGER NOT NULL DEFAULT 0,
  reviewed_threads INTEGER NOT NULL DEFAULT 0,
  total_customers INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  progress_message TEXT,
  error TEXT,
  summary_json TEXT,
  settings_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dm_review_runs_status_created ON dm_review_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_review_runs_completed ON dm_review_runs(completed_at DESC);

CREATE TABLE IF NOT EXISTS dm_review_findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('instagram', 'whatsapp')),
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  conversation_id TEXT,
  thread_key TEXT NOT NULL,
  thread_started_at TEXT NOT NULL,
  thread_ended_at TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  transcript_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  grounding_json TEXT NOT NULL,
  review_json TEXT NOT NULL,
  overall_score REAL NOT NULL,
  overall_status TEXT NOT NULL CHECK(overall_status IN ('strong', 'mixed', 'weak', 'critical')),
  primary_need TEXT,
  flags_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES dm_review_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dm_review_findings_run_score ON dm_review_findings(run_id, overall_score ASC);
CREATE INDEX IF NOT EXISTS idx_dm_review_findings_customer ON dm_review_findings(customer_id, thread_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_review_findings_status ON dm_review_findings(overall_status, thread_started_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_base_change_sets (
  id TEXT PRIMARY KEY,
  requested_by TEXT,
  reason TEXT,
  summary_text TEXT,
  status TEXT NOT NULL CHECK(status IN ('previewed', 'applied', 'rolled_back')),
  preview_payload TEXT NOT NULL,
  apply_payload TEXT,
  rollback_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  applied_at TEXT,
  rolled_back_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_kb_change_sets_status ON knowledge_base_change_sets(status);
CREATE INDEX IF NOT EXISTS idx_kb_change_sets_created ON knowledge_base_change_sets(created_at);

CREATE TABLE IF NOT EXISTS knowledge_base_history (
  id TEXT PRIMARY KEY,
  change_set_id TEXT NOT NULL,
  operation_index INTEGER NOT NULL,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('create', 'update', 'delete', 'rollback')),
  entry_id TEXT,
  before_state TEXT,
  after_state TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (change_set_id) REFERENCES knowledge_base_change_sets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kb_history_change_set ON knowledge_base_history(change_set_id);
CREATE INDEX IF NOT EXISTS idx_kb_history_entry ON knowledge_base_history(entry_id);

-- AI system prompts table for dynamic workflow configuration
CREATE TABLE IF NOT EXISTS ai_system_prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  system_message TEXT NOT NULL,
  workflow_type TEXT CHECK(workflow_type IN ('whatsapp', 'instagram', 'general')) DEFAULT 'general',
  is_active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_workflow_type ON ai_system_prompts(workflow_type);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_system_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_name ON ai_system_prompts(name);

-- Unified interactions view combining WhatsApp and Instagram
-- Requirements: 1.1, 8.3
CREATE VIEW IF NOT EXISTS unified_interactions AS
SELECT 
  id,
  'whatsapp' as platform,
  phone as customer_id,
  direction,
  message_text,
  intent,
  sentiment,
  ai_response,
  response_time_ms,
  created_at
FROM whatsapp_interactions
UNION ALL
SELECT 
  id,
  'instagram' as platform,
  instagram_id as customer_id,
  direction,
  message_text,
  intent,
  sentiment,
  ai_response,
  response_time_ms,
  created_at
FROM instagram_interactions;
