const Database = require('better-sqlite3');

const db = new Database('./backend/data/kiosk.db');

console.log('Updating system settings...');

db.prepare(`
  UPDATE system_settings 
  SET 
    sheets_sheet_id = ?,
    sheets_sheet_name = ?,
    google_review_url = ?,
    google_review_title = ?,
    google_review_description = ?,
    google_qr_display_duration = ?,
    updated_at = datetime('now')
  WHERE id = 1
`).run(
  '1Vced4zf9eOMzsmwzsYTKdDyaGroiQtvC457YVKt3qZI',
  'Sayfa1',
  'https://g.page/r/YOUR_GOOGLE_PLACE_ID/review',
  'Bizi Google\'da Değerlendirin',
  'QR kodu telefonunuzla tarayın ve görüşlerinizi paylaşın',
  60
);

console.log('✅ Settings updated!');

const settings = db.prepare('SELECT sheets_sheet_id, sheets_sheet_name, google_review_url FROM system_settings WHERE id = 1').get();
console.log('\nVerification:');
console.log('  Sheet ID:', settings.sheets_sheet_id);
console.log('  Sheet Name:', settings.sheets_sheet_name);
console.log('  Review URL:', settings.google_review_url);

db.close();
