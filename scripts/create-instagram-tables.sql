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

-- Instagram interactions table
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
