const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./data/kiosk.db');
const massages = db.prepare('SELECT * FROM massages').all();

let sql = '-- Massages export\n';
sql += 'DELETE FROM massages;\n\n';

for (const m of massages) {
  const values = [
    `'${m.id}'`,
    `'${(m.name || '').replace(/'/g, "''")}'`,
    `'${(m.short_description || '').replace(/'/g, "''")}'`,
    m.long_description ? `'${m.long_description.replace(/'/g, "''")}'` : 'NULL',
    m.duration ? `'${m.duration}'` : 'NULL',
    m.media_type ? `'${m.media_type}'` : 'NULL',
    m.media_url ? `'${m.media_url}'` : 'NULL',
    m.purpose_tags ? `'${m.purpose_tags.replace(/'/g, "''")}'` : 'NULL',
    m.sessions ? `'${m.sessions.replace(/'/g, "''")}'` : 'NULL',
    m.is_featured || 0,
    m.is_campaign || 0,
    m.layout_template ? `'${m.layout_template}'` : "'price-list'",
    m.sort_order || 0,
    m.created_at ? `'${m.created_at}'` : 'CURRENT_TIMESTAMP',
    m.updated_at ? `'${m.updated_at}'` : 'CURRENT_TIMESTAMP'
  ];
  
  sql += `INSERT INTO massages (id, name, short_description, long_description, duration, media_type, media_url, purpose_tags, sessions, is_featured, is_campaign, layout_template, sort_order, created_at, updated_at) VALUES (${values.join(', ')});\n`;
}

fs.writeFileSync('massages-import.sql', sql);
console.log(`Exported ${massages.length} massages to massages-import.sql`);

db.close();
