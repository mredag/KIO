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
  
  // Seed default data
  seedDatabase(db);
  
  return db;
}
