const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./data/kiosk.db');

// Read and execute schema
const schema = fs.readFileSync('./src/database/schema.sql', 'utf8');
db.exec(schema);

// Read massages export
const massages = JSON.parse(fs.readFileSync('/home/eform-kio/massages-export.json', 'utf8'));

// Insert massages
const stmt = db.prepare(`
  INSERT INTO massages (
    id, title_tr, title_en, description_tr, description_en, 
    duration, price, image_url, video_url, purpose_tags, 
    is_featured, display_order, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const m of massages) {
  stmt.run(
    m.id, m.title_tr, m.title_en, m.description_tr, m.description_en,
    m.duration, m.price, m.image_url, m.video_url, m.purpose_tags,
    m.is_featured, m.display_order, m.created_at, m.updated_at
  );
}

console.log('Imported', massages.length, 'massages');
db.close();
