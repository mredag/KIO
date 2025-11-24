import Database from 'better-sqlite3';
import path from 'path';

/**
 * Migration script to update existing database content to Turkish
 * This updates:
 * - Survey templates (questions, options, titles)
 * - System settings (Google review text)
 * - Purpose tags in existing massages
 */

const PURPOSE_TAG_MAPPING: Record<string, string> = {
  'Relaxation': 'Rahatlama',
  'Pain Relief': 'Ağrı Giderme',
  'Detox': 'Detoks',
  'Flexibility': 'Esneklik',
  'Post-Sport Recovery': 'Spor Sonrası İyileşme',
};

function migrateToTurkish() {
  const dbPath = path.join(__dirname, '../../data/kiosk.db');
  const db = new Database(dbPath);

  console.log('Starting migration to Turkish...');

  try {
    db.exec('BEGIN TRANSACTION');

    // 1. Update Satisfaction Survey Template
    console.log('Updating satisfaction survey template...');
    const satisfactionQuestions = JSON.stringify([
      {
        id: 'q1',
        text: 'Genel memnuniyet dereceniz nedir?',
        type: 'rating',
        options: ['1', '2', '3', '4', '5'],
        isRequired: true
      },
      {
        id: 'q2',
        text: 'Neden memnun kalmadınız?',
        type: 'single-choice',
        options: [
          'Masaj beklediğim gibi değildi',
          'Ortam sıcaklığı veya gürültü rahatsız ediciydi',
          'Personel ile ilgili sorun',
          'Fiyat',
          'Diğer'
        ],
        isRequired: true,
        conditionalOn: {
          questionId: 'q1',
          values: ['1', '2', '3']
        }
      }
    ]);

    db.prepare(`
      UPDATE survey_templates
      SET name = ?,
          title = ?,
          description = ?,
          questions = ?
      WHERE type = 'satisfaction'
    `).run(
      'Memnuniyet Anketi',
      'Memnuniyet Anketi',
      'Hizmetimiz hakkındaki görüşlerinizi öğrenmek isteriz',
      satisfactionQuestions
    );

    // 2. Update Discovery Survey Template
    console.log('Updating discovery survey template...');
    const discoveryQuestions = JSON.stringify([
      {
        id: 'q1',
        text: 'Bizi nasıl duydunuz?',
        type: 'single-choice',
        options: [
          'Google arama sonuçları',
          'Instagram',
          'Arkadaş tavsiyesi',
          'Geçerken gördüm',
          'Diğer'
        ],
        isRequired: true
      },
      {
        id: 'q2',
        text: 'Daha önce spa deneyiminiz oldu mu?',
        type: 'single-choice',
        options: ['Evet', 'Hayır'],
        isRequired: false
      }
    ]);

    db.prepare(`
      UPDATE survey_templates
      SET name = ?,
          title = ?,
          description = ?,
          questions = ?
      WHERE type = 'discovery'
    `).run(
      'Keşif Anketi',
      'Keşif Anketi',
      'Bizi nasıl keşfettiğinizi öğrenmek isteriz',
      discoveryQuestions
    );

    // 3. Update System Settings (Google Review text)
    console.log('Updating system settings...');
    db.prepare(`
      UPDATE system_settings
      SET google_review_title = ?,
          google_review_description = ?
      WHERE id = 1
    `).run(
      'Bizi Google\'da Değerlendirin',
      'QR kodu telefonunuzla tarayın ve görüşlerinizi paylaşın'
    );

    // 4. Update Purpose Tags in existing massages
    console.log('Updating purpose tags in massages...');
    const massages = db.prepare('SELECT id, purpose_tags FROM massages').all() as Array<{
      id: string;
      purpose_tags: string;
    }>;

    for (const massage of massages) {
      try {
        const tags = JSON.parse(massage.purpose_tags || '[]');
        const translatedTags = tags.map((tag: string) => PURPOSE_TAG_MAPPING[tag] || tag);
        
        db.prepare('UPDATE massages SET purpose_tags = ? WHERE id = ?').run(
          JSON.stringify(translatedTags),
          massage.id
        );
      } catch (error) {
        console.warn(`Warning: Could not update purpose tags for massage ${massage.id}:`, error);
      }
    }

    db.exec('COMMIT');
    console.log('Migration completed successfully!');
    console.log(`Updated ${massages.length} massage(s) with Turkish purpose tags`);

  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToTurkish();
}

export { migrateToTurkish };
