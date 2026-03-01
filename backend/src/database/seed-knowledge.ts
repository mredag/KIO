/**
 * Seed knowledge base with Eform Spor Merkezi data.
 * Key names match the enrichment module (enrich_context_v31_ai_driven.js).
 * 
 * Usage: Run directly with node after compile, or via inline eval.
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';

const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '..', '..', 'data', 'kiosk.db');

export function seedKnowledge(dbPath?: string) {
  const db = new Database(dbPath || DB_PATH);
  db.pragma('journal_mode = WAL');

  const findByKey = db.prepare('SELECT id FROM knowledge_base WHERE category = ? AND key_name = ?');
  const insertStmt = db.prepare(`
    INSERT INTO knowledge_base (id, category, key_name, value, description, is_active, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  const updateStmt = db.prepare(`
    UPDATE knowledge_base SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;

  function upsert(category: string, key_name: string, value: string, description: string) {
    const existing = findByKey.get(category, key_name) as { id: string } | undefined;
    if (existing) {
      updateStmt.run(value, description, existing.id);
      updated++;
    } else {
      insertStmt.run(randomUUID(), category, key_name, value, description);
      inserted++;
    }
  }

  // ===== SERVICES =====
  upsert('services', 'facility_overview',
    'Eform Spor Merkezi: Fitness salonu, SPA & wellness, reformer pilates stüdyosu, yüzme havuzu, hamam-sauna-buhar odası, çocuk ve kadın kursları (taekwondo, jimnastik, kickboks, boks, yüzme). Steel Towers A Blok Kat 4, İskenderun.',
    'Tesis genel tanıtım');

  upsert('services', 'massage_programs',
    'MIX masaj (klasik+medikal), Klasik masaj, Sıcak taş masajı, Medikal masaj, Bali masajı, Endonezya masajı, Uzakdoğu masajı. Tüm masajlar profesyonel terapistler tarafından yapılır.',
    'Masaj türleri listesi');

  upsert('services', 'therapist_info',
    'Tüm masaj ve SPA hizmetlerimiz yalnızca kadın terapistlerimiz tarafından verilmektedir. Erkek terapistimiz bulunmamaktadır. Tüm terapistlerimiz sertifikalı ve deneyimlidir.',
    'Terapist bilgisi');

  upsert('services', 'reformer_pilates_details',
    'Reformer Pilates: Profesyonel eğitmenler eşliğinde, küçük gruplar halinde dersler. Başlangıç ve ileri seviye grupları mevcuttur.',
    'Pilates detay');

  upsert('services', 'courses_kids',
    'Çocuk kursları: Taekwondo (6-14 yaş), Jimnastik (4-10 yaş), Yüzme (6+ yaş), Kickboks (10+ yaş).',
    'Çocuk kursları');

  upsert('services', 'courses_women',
    'Kadın kursları: Kadın yüzme (kadınlara özel seanslarda), Fitness grupları.',
    'Kadın kursları');

  upsert('services', 'membership_includes',
    'Üyelik ile: Fitness salonu, grup dersleri, sauna-hamam-buhar odası, yüzme havuzu kullanımı dahildir.',
    'Üyelik içeriği');

  // ===== PRICING =====
  upsert('pricing', 'spa_massage',
    '30dk masaj: 800₺ | 30dk masaj + kese + köpük: 900₺ | 40dk masaj + köpük: 1.000₺ | 40dk masaj + kese + köpük: 1.100₺ | 60dk masaj + köpük: 1.300₺ | 60dk masaj + kese + köpük: 1.400₺ | 90dk masaj + köpük: 2.400₺ | 90dk masaj + kese + köpük: 2.500₺ | Kese köpük: 800₺. Tüm masajlarda havuz, hamam, sauna ve buhar odası kullanımı dahildir.',
    'SPA masaj fiyatları');

  upsert('pricing', 'other_massage_programs',
    'MIX Masaj (70dk): 2.000₺ | Sıcak Taş (60dk): 1.600₺ | Medikal Masaj (30dk): 1.200₺ | Medikal Masaj (50dk): 1.800₺',
    'Diğer masaj programları fiyatları');

  upsert('pricing', 'membership_individual',
    'Ferdi Üyelik: Aylık 3.000 TL | 3 Aylık 7.500 TL | 6 Aylık 13.000 TL | Yıllık 22.000 TL. Fitness+havuz+sauna+hamam dahil.',
    'Ferdi üyelik fiyatları');

  upsert('pricing', 'membership_family',
    'Aile Üyeliği (2 kişi): Aylık 5.000 TL | 3 Aylık 13.000 TL | Yıllık 38.000 TL. Ek aile ferdi +1.500 TL/ay.',
    'Aile üyelik fiyatları');

  upsert('pricing', 'reformer_pilates',
    'Reformer Pilates: Aylık (8 ders) 4.000 TL | Tek ders 600 TL. Küçük grup (max 6 kişi).',
    'Pilates fiyatları');

  upsert('pricing', 'pt_pricing',
    '💪 Personal Trainer (PT) Paketleri:\n- 12 saat: 8.000₺\n- 24 saat: 14.000₺\n- 36 saat: 20.000₺',
    'PT fiyatları');

  upsert('pricing', 'courses_kids',
    'Çocuk Kursları: Taekwondo aylık 2.000 TL | Jimnastik aylık 2.000 TL | Yüzme aylık 2.500 TL | Kickboks aylık 2.000 TL.',
    'Çocuk kurs fiyatları');

  upsert('pricing', 'courses_women',
    'Kadın Yüzme: Aylık 2.500 TL (haftada 2 seans, kadınlara özel).',
    'Kadın kurs fiyatları');

  // ===== HOURS =====
  upsert('hours', 'spa_working_hours',
    'SPA & Masaj: Her gün 13:00 - 23:00 (son randevu 22:00)',
    'SPA çalışma saatleri');

  upsert('hours', 'facility_working_hours',
    'Fitness & Havuz: Pazartesi-Cumartesi 07:00-23:00 | Pazar 09:00-21:00',
    'Spor salonu çalışma saatleri');

  upsert('hours', 'taekwondo_schedule',
    'Taekwondo: Salı-Perşembe 17:00-18:00 (küçükler), 18:00-19:00 (büyükler)',
    'Taekwondo ders programı');

  upsert('hours', 'kickboxing_schedule',
    'Kickboks: Pazartesi-Çarşamba-Cuma 18:00-19:00',
    'Kickboks ders programı');

  upsert('hours', 'gymnastics_schedule',
    'Jimnastik: Salı-Perşembe 16:00-17:00',
    'Jimnastik ders programı');

  upsert('hours', 'swim_kids_schedule',
    'Çocuk Yüzme: Pazartesi-Çarşamba-Cuma 15:00-16:00 ve 16:00-17:00',
    'Çocuk yüzme programı');

  upsert('hours', 'swim_women_schedule',
    'Kadın Yüzme: Salı-Perşembe 10:00-12:00 (kadınlara özel seans)',
    'Kadın yüzme programı');

  // ===== CONTACT =====
  upsert('contact', 'address',
    'Eform Spor Merkezi, Çay Mahallesi, Tayfur Sökmen Bulvarı, Steel Towers A Blok Kat 4, İskenderun/Hatay. Google Maps: https://maps.app.goo.gl/s2w3ahbc8ZJnzn9u8',
    'Fiziksel adres');

  upsert('contact', 'phone',
    'Sabit: 0326 502 58 58 | Cep/WhatsApp: 0530 250 05 58',
    'Telefon numarası');

  upsert('contact', 'instagram',
    'Instagram: @eformspa — DM ile 7/24 iletişime geçebilirsiniz',
    'Instagram hesabı');

  // ===== POLICIES =====
  upsert('policies', 'inappropriate_requests',
    'Eform Spa olarak sadece profesyonel ve terapötik masaj hizmetleri sunmaktayız. Tüm hizmetlerimiz sağlık ve wellness odaklıdır. Uygunsuz taleplere hizmet vermemekteyiz.',
    'Uygunsuz talep politikası');

  upsert('policies', 'cancellation',
    'Randevu iptali en az 2 saat önceden yapılmalıdır. Haber verilmeden gelinmemesi durumunda bir sonraki randevuda ön ödeme istenir.',
    'İptal politikası');

  upsert('policies', 'age_groups',
    'Çocuk kursları: 4-14 yaş arası. Fitness: 16 yaş ve üzeri (16-18 yaş veli izni gerekli). SPA/masaj: 18 yaş ve üzeri.',
    'Yaş grupları');

  upsert('policies', 'legitimate_services',
    'MIX masaj, Klasik masaj, Sıcak taş masajı, Medikal masaj, Bali masajı, Kese köpük, Hamam, Sauna, Buhar odası, Fitness, Reformer Pilates, Yüzme kursları, Jimnastik, Taekwondo, Kickboks, Boks, Personal Trainer',
    'Meşru hizmet listesi');

  upsert('policies', 'what_to_bring',
    'Havlu, terlik ve şort tesiste ücretsiz sağlanır. Tek kullanımlık şort seçeneği de var. Havuz için bone zorunlu, tesisten temin edilebilir.',
    'Yanında ne getirmeli');

  upsert('policies', 'payment_methods',
    'Nakit, kredi kartı, banka kartı kabul edilir. Üyeliklerde taksit seçeneği mevcuttur.',
    'Ödeme yöntemleri');

  // ===== FAQ =====
  upsert('faq', 'kadinlar_gunu',
    'Tesisimiz karma hizmet verir. Kadınlara özel gün bulunmamaktadır. Kadın yüzme seansları Salı-Perşembe 10:00-12:00 arasındadır.',
    'Kadınlar günü var mı');

  upsert('faq', 'kese_kopuk_personel',
    'Hamam kese ve köpük hizmeti kadın spa personelimiz tarafından yapılır.',
    'Kese köpük kim yapıyor');

  upsert('faq', 'personal_trainer',
    'Birebir personal trainer hizmetimiz vardır. Hedefinize göre plan ve uygun saat bilgisi için bilgi alabilirsiniz. Aylık 6.000 TL (12 seans).',
    'PT var mı');

  upsert('faq', 'yaninda_ne_getir',
    'Özel bir şey getirmeniz gerekmez. Havlu, terlik ve şort tesisimizde bulunur. Havuz kullanımı için bone zorunludur, tesisimizden temin edebilirsiniz.',
    'Yanımda ne getireyim');

  upsert('faq', 'havuz_sicaklik',
    'Yüzme havuzumuz yıl boyunca 28-30 derece arasında tutulmaktadır. Çocuk havuzu ise 30-32 derece arasındadır.',
    'Havuz sıcaklığı bilgisi');

  upsert('faq', 'terapist_yasal_belge',
    'Eform Spa terapistleri yasal çalışma izinlerine sahiptir. Hijyen ve hizmet standartlarına uygun şekilde çalışırız.',
    'Terapist yasal mı');

  upsert('faq', 'randevu_nasil',
    'Randevu SADECE telefonla alınır: 0326 502 58 58. Instagram DM üzerinden randevu oluşturulamaz. Online rezervasyon sistemimiz henüz bulunmamaktadır.',
    'Randevu nasıl alınır');

  upsert('faq', 'ileri_tarih_randevu',
    'Günlük randevu sistemi ile çalışırız. Aynı gün içinde uygun saat için telefonla bilgi alabilirsiniz: 0326 502 58 58. SPA hizmet saatleri: 13:00-23:00. DM ile randevu alınamaz.',
    'İleri tarih randevu');

  // ===== GENERAL =====
  upsert('general', 'welcome_message',
    'Merhaba! Ben Eform Spor Merkezi dijital asistanıyım. Size nasıl yardımcı olabilirim?',
    'Karşılama mesajı');

  upsert('general', 'parking',
    'Steel Towers binasının kapalı otoparkını kullanabilirsiniz.',
    'Otopark bilgisi');

  upsert('general', 'loyalty_program',
    'Her 4 masajda 1 masaj ücretsiz! Kupon sistemi hakkında bilgi için resepsiyona sorunuz veya WhatsApp üzerinden YARDIM yazın.',
    'Sadakat programı');

  db.close();
  console.log(`\nKnowledge base seeded: ${inserted} inserted, ${updated} updated.`);
}

// Run directly
seedKnowledge();
