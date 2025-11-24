import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

/**
 * Seed default data into the database
 * - Default survey templates (Satisfaction and Discovery)
 * - Initial admin user
 * - Default kiosk state
 * - Default system settings
 */
export function seedDatabase(db: Database.Database): void {
  // Check if data already exists
  const existingTemplates = db.prepare('SELECT COUNT(*) as count FROM survey_templates').get() as { count: number };
  
  if (existingTemplates.count > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database with default data...');

  // Seed Satisfaction Survey Template (Turkish)
  const satisfactionId = randomUUID();
  const satisfactionTemplate = {
    id: satisfactionId,
    name: 'Memnuniyet Anketi',
    type: 'satisfaction',
    title: 'Memnuniyet Anketi',
    description: 'Hizmetimiz hakkındaki görüşlerinizi öğrenmek isteriz',
    questions: JSON.stringify([
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
    ]),
    is_active: 1
  };

  db.prepare(`
    INSERT INTO survey_templates (id, name, type, title, description, questions, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    satisfactionTemplate.id,
    satisfactionTemplate.name,
    satisfactionTemplate.type,
    satisfactionTemplate.title,
    satisfactionTemplate.description,
    satisfactionTemplate.questions,
    satisfactionTemplate.is_active
  );

  // Seed Discovery Survey Template (Turkish)
  const discoveryId = randomUUID();
  const discoveryTemplate = {
    id: discoveryId,
    name: 'Keşif Anketi',
    type: 'discovery',
    title: 'Keşif Anketi',
    description: 'Bizi nasıl keşfettiğinizi öğrenmek isteriz',
    questions: JSON.stringify([
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
    ]),
    is_active: 0
  };

  db.prepare(`
    INSERT INTO survey_templates (id, name, type, title, description, questions, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    discoveryTemplate.id,
    discoveryTemplate.name,
    discoveryTemplate.type,
    discoveryTemplate.title,
    discoveryTemplate.description,
    discoveryTemplate.questions,
    discoveryTemplate.is_active
  );

  // Seed default kiosk state
  db.prepare(`
    INSERT INTO kiosk_state (id, mode, active_survey_id, last_heartbeat)
    VALUES (1, 'digital-menu', ?, CURRENT_TIMESTAMP)
  `).run(satisfactionId);

  // Seed default system settings with initial admin password
  // Default password: "admin123" (should be changed on first login)
  const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
  
  db.prepare(`
    INSERT INTO system_settings (
      id,
      slideshow_timeout,
      survey_timeout,
      google_qr_display_duration,
      google_review_url,
      google_review_title,
      google_review_description,
      admin_password_hash
    )
    VALUES (1, 60, 60, 60, ?, ?, ?, ?)
  `).run(
    'https://g.page/r/YOUR_GOOGLE_PLACE_ID/review',
    'Bizi Google\'da Değerlendirin',
    'QR kodu telefonunuzla tarayın ve görüşlerinizi paylaşın',
    defaultPasswordHash
  );

  console.log('Database seeded successfully!');
  console.log('Default admin password: admin123 (please change this)');
}
