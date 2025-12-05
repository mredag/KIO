-- Seed service settings
INSERT OR IGNORE INTO service_settings (service_name, enabled, config, last_activity, updated_at)
VALUES 
  ('whatsapp', 1, NULL, NULL, CURRENT_TIMESTAMP),
  ('instagram', 1, NULL, NULL, CURRENT_TIMESTAMP);

-- Seed knowledge base entries (Turkish content)
INSERT OR IGNORE INTO knowledge_base (id, category, key_name, value, description, is_active, version, created_at, updated_at)
VALUES 
  -- Services
  ('kb-services-1', 'services', 'massage_types', 'İsveç masajı, derin doku masajı, aromaterapi masajı, sıcak taş masajı, refleksoloji', 'Sunulan masaj türleri', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-services-2', 'services', 'spa_facilities', 'Sauna, buhar odası, jakuzi, dinlenme alanı, soyunma odaları', 'SPA tesisleri', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-services-3', 'services', 'special_packages', 'Çift masajı paketi, gün spa paketi, romantik paket, detoks paketi', 'Özel paketler', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Pricing
  ('kb-pricing-1', 'pricing', 'massage_60min', '500 TL - 60 dakikalık masaj seansı', '60 dakikalık masaj fiyatı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-pricing-2', 'pricing', 'massage_90min', '700 TL - 90 dakikalık masaj seansı', '90 dakikalık masaj fiyatı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-pricing-3', 'pricing', 'couple_package', '1.800 TL - Çift masajı paketi (2 kişi, 90 dakika)', 'Çift paketi fiyatı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-pricing-4', 'pricing', 'day_spa', '1.200 TL - Gün spa paketi (masaj + sauna + jakuzi)', 'Gün spa paketi fiyatı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Hours
  ('kb-hours-1', 'hours', 'weekdays', 'Pazartesi-Cumartesi: 10:00-22:00', 'Hafta içi çalışma saatleri', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-hours-2', 'hours', 'sunday', 'Pazar: 11:00-20:00', 'Pazar günü çalışma saatleri', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-hours-3', 'hours', 'holidays', 'Resmi tatil günlerinde kapalıyız', 'Tatil günleri durumu', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-hours-4', 'hours', 'last_appointment', 'Son randevu kapanıştan 1 saat önce', 'Son randevu saati', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Policies
  ('kb-policies-1', 'policies', 'cancellation', '24 saat önceden iptal ücretsizdir. Daha geç iptallerde %50 ücret alınır.', 'İptal politikası', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-policies-2', 'policies', 'late_arrival', '15 dakikadan fazla geç kalınırsa seans süresi kısalır', 'Geç kalma politikası', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-policies-3', 'policies', 'payment_methods', 'Nakit, kredi kartı, banka kartı kabul edilir', 'Ödeme yöntemleri', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-policies-4', 'policies', 'age_requirement', '18 yaş altı müşteriler veli eşliğinde kabul edilir', 'Yaş sınırı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-policies-5', 'policies', 'health_conditions', 'Hamilelik, kalp rahatsızlığı veya cilt hastalığı varsa lütfen önceden bildiriniz', 'Sağlık durumu bildirimi', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Contact
  ('kb-contact-1', 'contact', 'phone', '+90 XXX XXX XXXX', 'Ana iletişim telefonu', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-contact-2', 'contact', 'whatsapp', '+90 XXX XXX XXXX', 'WhatsApp numarası', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-contact-3', 'contact', 'email', 'info@spa-merkezi.com', 'E-posta adresi', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-contact-4', 'contact', 'address', 'Örnek Mahallesi, Spa Sokak No:1, İstanbul', 'Fiziksel adres', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-contact-5', 'contact', 'instagram', '@spa_merkezi', 'Instagram hesabı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- General
  ('kb-general-1', 'general', 'welcome_message', 'Hoş geldiniz! Size nasıl yardımcı olabilirim?', 'Karşılama mesajı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-general-2', 'general', 'parking', 'Ücretsiz otopark mevcuttur', 'Otopark bilgisi', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-general-3', 'general', 'wifi', 'Ücretsiz WiFi: SPA_Guest / Şifre: welcome2024', 'WiFi bilgileri', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-general-4', 'general', 'loyalty_program', 'Her 4 masajda 1 masaj ücretsiz! Kupon sistemi hakkında bilgi için resepsiyona sorunuz.', 'Sadakat programı', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('kb-general-5', 'general', 'gift_certificates', 'Hediye çekleri mevcuttur. Sevdiklerinize özel bir hediye!', 'Hediye çeki bilgisi', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
