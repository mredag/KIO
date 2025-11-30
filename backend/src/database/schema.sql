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
