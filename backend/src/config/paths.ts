import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Centralized path configuration
 * Ensures consistent paths across development and production
 */

// Get the directory of this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is 2 levels up from backend/src/config
export const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Public directories
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
export const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

// Data directories
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
export const DATABASE_PATH = path.join(DATA_DIR, 'kiosk.db');

// Frontend build directory (for production)
export const FRONTEND_DIST = path.join(PROJECT_ROOT, 'frontend', 'dist');

// Log paths for debugging
if (process.env.NODE_ENV !== 'test') {
  console.log('Path Configuration:');
  console.log('  PROJECT_ROOT:', PROJECT_ROOT);
  console.log('  UPLOADS_DIR:', UPLOADS_DIR);
  console.log('  DATA_DIR:', DATA_DIR);
  console.log('  BACKUPS_DIR:', BACKUPS_DIR);
}

export default {
  PROJECT_ROOT,
  PUBLIC_DIR,
  UPLOADS_DIR,
  DATA_DIR,
  BACKUPS_DIR,
  DATABASE_PATH,
  FRONTEND_DIST,
};
