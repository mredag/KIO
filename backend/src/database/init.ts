import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize the SQLite database with schema and default data
 * Enables WAL mode for concurrent access
 */
export function initializeDatabase(dbPath: string): Database.Database {
  console.log(`Initializing database at: ${dbPath}`);
  
  // Ensure the directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  }
  
  // Create database connection
  const db = new Database(dbPath);
  
  // Enable WAL mode for concurrent access
  // WAL allows multiple readers + one writer simultaneously
  db.pragma('journal_mode = WAL');
  
  // Additional optimizations
  db.pragma('synchronous = NORMAL'); // Faster writes, still safe with WAL
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = MEMORY'); // Temp tables in RAM
  db.pragma('foreign_keys = ON'); // Enable foreign key constraints
  
  console.log('WAL mode enabled with optimized pragma settings');
  
  // Read and execute schema
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  
  // Execute schema (split by semicolon and execute each statement)
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const statement of statements) {
    db.exec(statement);
  }
  
  console.log('Database schema created successfully');

  // Ensure new columns exist on existing installations
  const massageColumns = db.prepare('PRAGMA table_info(massages)').all() as Array<{ name: string }>;
  const hasLayoutTemplate = massageColumns.some((column) => column.name === 'layout_template');
  if (!hasLayoutTemplate) {
    db.prepare("ALTER TABLE massages ADD COLUMN layout_template TEXT DEFAULT 'price-list'").run();
    console.log('Added layout_template column to massages table');
  }

  const settingsColumns = db.prepare('PRAGMA table_info(system_settings)').all() as Array<{ name: string }>;
  const hasKioskTheme = settingsColumns.some((column) => column.name === 'kiosk_theme');
  if (!hasKioskTheme) {
    db.prepare("ALTER TABLE system_settings ADD COLUMN kiosk_theme TEXT DEFAULT 'classic'").run();
    console.log('Added kiosk_theme column to system_settings table');
  }

  // Add coupon QR columns to kiosk_state for existing installations
  const kioskStateColumns = db.prepare('PRAGMA table_info(kiosk_state)').all() as Array<{ name: string }>;
  const hasCouponQrUrl = kioskStateColumns.some((column) => column.name === 'coupon_qr_url');
  if (!hasCouponQrUrl) {
    db.prepare("ALTER TABLE kiosk_state ADD COLUMN coupon_qr_url TEXT").run();
    console.log('Added coupon_qr_url column to kiosk_state table');
  }
  const hasCouponToken = kioskStateColumns.some((column) => column.name === 'coupon_token');
  if (!hasCouponToken) {
    db.prepare("ALTER TABLE kiosk_state ADD COLUMN coupon_token TEXT").run();
    console.log('Added coupon_token column to kiosk_state table');
  }

  // Check if coupon tables exist (for existing installations)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  
  const couponTables = [
    'coupon_tokens',
    'coupon_wallets', 
    'coupon_redemptions',
    'coupon_events',
    'coupon_rate_limits'
  ];
  
  const missingCouponTables = couponTables.filter(table => !tableNames.includes(table));
  
  if (missingCouponTables.length > 0) {
    console.log(`Creating missing coupon tables: ${missingCouponTables.join(', ')}`);
    // Re-run schema to create missing tables (CREATE IF NOT EXISTS will skip existing ones)
    for (const statement of statements) {
      if (statement.includes('coupon_')) {
        db.exec(statement);
      }
    }
    console.log('Coupon tables created successfully');
  }

  // Check for dynamic automation management tables (for existing installations)
  const automationTables = [
    'whatsapp_interactions',
    'instagram_interactions',
    'service_settings',
    'knowledge_base'
  ];
  
  const missingAutomationTables = automationTables.filter(table => !tableNames.includes(table));
  
  if (missingAutomationTables.length > 0) {
    console.log(`Creating missing automation tables: ${missingAutomationTables.join(', ')}`);
    // Re-run schema to create missing tables
    for (const statement of statements) {
      if (statement.includes('whatsapp_interactions') || 
          statement.includes('instagram_interactions') ||
          statement.includes('service_settings') || 
          statement.includes('knowledge_base') ||
          statement.includes('unified_interactions')) {
        db.exec(statement);
      }
    }
    console.log('Automation management tables created successfully');
  }

  const kbSafetyTables = [
    'knowledge_base_change_sets',
    'knowledge_base_history',
  ];

  const missingKbSafetyTables = kbSafetyTables.filter(table => !tableNames.includes(table));

  if (missingKbSafetyTables.length > 0) {
    console.log(`Creating missing KB safety tables: ${missingKbSafetyTables.join(', ')}`);
    for (const statement of statements) {
      if (statement.includes('knowledge_base_change_sets') ||
          statement.includes('knowledge_base_history')) {
        db.exec(statement);
      }
    }
    console.log('KB safety tables created successfully');
  }

  // Check if unified_interactions view exists
  const views = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all() as Array<{ name: string }>;
  const viewNames = views.map(v => v.name);
  
  if (!viewNames.includes('unified_interactions')) {
    console.log('Creating unified_interactions view...');
    for (const statement of statements) {
      if (statement.includes('unified_interactions')) {
        db.exec(statement);
      }
    }
    console.log('unified_interactions view created successfully');
  }

  // Check for AI system prompts table (for existing installations)
  const updatedTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const updatedTableNames = updatedTables.map(t => t.name);
  
  if (!updatedTableNames.includes('ai_system_prompts')) {
    console.log('Creating ai_system_prompts table...');
    for (const statement of statements) {
      if (statement.includes('ai_system_prompts')) {
        db.exec(statement);
      }
    }
    console.log('ai_system_prompts table created successfully');
  }
  
  // Jarvis Task Orchestration tables (mc_jarvis_sessions, mc_jarvis_messages)
  // Uses CREATE TABLE IF NOT EXISTS — safe to run on every startup
  try {
    const { runJarvisMigration } = require('./migrate-jarvis.cjs');
    runJarvisMigration(db);
  } catch (error: any) {
    console.error('Jarvis migration failed:', error.message);
  }

  // Instagram DM Intelligence — model_used, tokens_estimated, execution_id columns + MC indexes
  try {
    const igCols = db.prepare('PRAGMA table_info(instagram_interactions)').all() as Array<{ name: string }>;
    const igColNames = igCols.map(c => c.name);
    if (!igColNames.includes('model_used')) {
      db.prepare('ALTER TABLE instagram_interactions ADD COLUMN model_used TEXT').run();
      console.log('Added model_used column to instagram_interactions');
    }
    if (!igColNames.includes('tokens_estimated')) {
      db.prepare('ALTER TABLE instagram_interactions ADD COLUMN tokens_estimated INTEGER DEFAULT 0').run();
      console.log('Added tokens_estimated column to instagram_interactions');
    }
    if (!igColNames.includes('execution_id')) {
      db.prepare('ALTER TABLE instagram_interactions ADD COLUMN execution_id TEXT').run();
      console.log('Added execution_id column to instagram_interactions');
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_conversations_channel_customer ON mc_conversations(channel, customer_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_instagram_interactions_model ON instagram_interactions(model_used)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_instagram_interactions_execution ON instagram_interactions(execution_id)');
    console.log('Instagram Intelligence migration complete');
  } catch (error: any) {
    console.error('Instagram Intelligence migration failed:', error.message);
  }

  // WhatsApp OpenClaw Integration — new tables, ALTER columns, unified view, MC seeds
  try {
    // 1. Create whatsapp_appointment_requests table
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_appointment_requests (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        service_requested TEXT,
        preferred_date TEXT,
        preferred_time TEXT,
        status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
        staff_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_wa_appointments_phone ON whatsapp_appointment_requests(phone)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_wa_appointments_status ON whatsapp_appointment_requests(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_wa_appointments_created ON whatsapp_appointment_requests(created_at)');

    // 2. Create whatsapp_ignore_list table
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_ignore_list (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        label TEXT,
        added_by TEXT DEFAULT 'admin',
        created_at TEXT NOT NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_wa_ignore_phone ON whatsapp_ignore_list(phone)');

    // 3. ALTER TABLE whatsapp_interactions — add new columns (try/catch each)
    const waCols = db.prepare('PRAGMA table_info(whatsapp_interactions)').all() as Array<{ name: string }>;
    const waColNames = waCols.map(c => c.name);

    if (!waColNames.includes('model_used')) {
      db.prepare('ALTER TABLE whatsapp_interactions ADD COLUMN model_used TEXT').run();
      console.log('Added model_used column to whatsapp_interactions');
    }
    if (!waColNames.includes('tokens_estimated')) {
      db.prepare('ALTER TABLE whatsapp_interactions ADD COLUMN tokens_estimated INTEGER').run();
      console.log('Added tokens_estimated column to whatsapp_interactions');
    }
    if (!waColNames.includes('model_tier')) {
      db.prepare('ALTER TABLE whatsapp_interactions ADD COLUMN model_tier TEXT').run();
      console.log('Added model_tier column to whatsapp_interactions');
    }
    if (!waColNames.includes('pipeline_trace')) {
      db.prepare('ALTER TABLE whatsapp_interactions ADD COLUMN pipeline_trace TEXT').run();
      console.log('Added pipeline_trace column to whatsapp_interactions');
    }
    if (!waColNames.includes('pipeline_error')) {
      db.prepare('ALTER TABLE whatsapp_interactions ADD COLUMN pipeline_error TEXT').run();
      console.log('Added pipeline_error column to whatsapp_interactions');
    }
    if (!waColNames.includes('media_type')) {
      db.prepare('ALTER TABLE whatsapp_interactions ADD COLUMN media_type TEXT').run();
      console.log('Added media_type column to whatsapp_interactions');
    }
    if (!waColNames.includes('execution_id')) {
      db.prepare('ALTER TABLE whatsapp_interactions ADD COLUMN execution_id TEXT').run();
      console.log('Added execution_id column to whatsapp_interactions');
    }

    // 4. Recreate unified_interactions view with new columns
    db.exec('DROP VIEW IF EXISTS unified_interactions');
    db.exec(`
      CREATE VIEW unified_interactions AS
      SELECT 
        id, 'whatsapp' as platform, phone as customer_id,
        direction, message_text, intent, sentiment, ai_response,
        response_time_ms, model_used, tokens_estimated, model_tier,
        pipeline_trace, pipeline_error, execution_id, created_at
      FROM whatsapp_interactions
      UNION ALL
      SELECT 
        id, 'instagram' as platform, instagram_id as customer_id,
        direction, message_text, intent, sentiment, ai_response,
        response_time_ms, model_used, tokens_estimated, model_tier,
        pipeline_trace, pipeline_error, execution_id, created_at
      FROM instagram_interactions
    `);

    // 5. Seed mc_agents with whatsapp-dm agent
    // mc_agents uses channel_scope (JSON array), not a channel column
    // status CHECK allows: active, idle, error, disabled
    db.prepare(`
      INSERT OR IGNORE INTO mc_agents (id, name, role, model, status, channel_scope, created_at, updated_at)
      VALUES ('whatsapp-dm', 'WhatsApp DM Asistan', 'responder', 'moonshotai/kimi-k2', 'idle', '["whatsapp"]', datetime('now'), datetime('now'))
    `).run();

    // 6. Seed mc_policies with wa_pipeline_config
    const waPipelineConfig = JSON.stringify({
      directResponse: {
        enabled: true,
        tiers: {
          light: { enabled: true, modelId: 'google/gemini-2.5-flash-lite' },
          standard: { enabled: true, modelId: 'moonshotai/kimi-k2' },
          advanced: { enabled: false, modelId: 'openai/gpt-4o-mini' }
        }
      },
      policy: {
        enabled: true,
        maxRetries: 2,
        validationModel: 'google/gemini-2.5-flash-lite',
        correctionModel: 'moonshotai/kimi-k2',
        timeoutMs: 15000,
        appointmentClaimRule: true
      },
      directPrompt: {
        systemTemplate: "Sen Eform Spor Merkezi'nin WhatsApp asistanısın. SADECE BİLGİ BANKASINI KULLAN.\n\n{{knowledge}}\n\nKurallar:\n- Sadece yukarıdaki bilgileri kullan\n- Bilmediğin konularda 'Detaylı bilgi için bizi arayabilirsiniz: 0326 502 58 58' de\n- Randevu oluşturma, ödeme işleme, üyelik değiştirme, terapist atama, müsaitlik garantisi YAPAMAZ\n- Düz metin kullan, markdown kullanma\n- Kısa ve öz cevap ver (4-5 cümle max)\n- 1-2 emoji kullanabilirsin",
        maxResponseLength: 500
      },
      fallbackMessage: 'Detaylı bilgi için bizi arayabilirsiniz: 0326 502 58 58 📞',
      ignoreList: { enabled: true },
      appointmentFlow: { enabled: true, telegramNotification: true }
    });

    db.prepare(`
      INSERT OR IGNORE INTO mc_policies (id, name, type, conditions, actions, is_active, priority, created_at, updated_at)
      VALUES ('wa_pipeline_config', 'WhatsApp Pipeline Config', 'guardrail', '{}', ?, 1, 0, datetime('now'), datetime('now'))
    `).run(waPipelineConfig);

    console.log('WhatsApp OpenClaw Integration migration complete');
  } catch (error: any) {
    console.error('WhatsApp OpenClaw Integration migration failed:', error.message);
  }

  // DM conversation state â€” compact per-customer context memory for follow-up handling
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dm_conversation_state (
        channel TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        active_topic TEXT NOT NULL,
        active_topic_confidence REAL NOT NULL DEFAULT 0,
        topic_source_message TEXT,
        last_question_type TEXT NOT NULL DEFAULT 'general',
        pending_categories TEXT NOT NULL DEFAULT '[]',
        last_customer_message TEXT NOT NULL,
        last_assistant_message TEXT,
        turn_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (channel, customer_id)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_dm_conversation_state_expires ON dm_conversation_state(expires_at)');
    console.log('DM conversation state migration complete');
  } catch (error: any) {
    console.error('DM conversation state migration failed:', error.message);
  }

  // Seed default data
  seedDatabase(db);
  
  return db;
}
