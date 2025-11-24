# Türkçe Yerelleştirme Uygulama Planı

- [ ] 1. Frontend i18n altyapısını kur





- [x] 1.1 i18n kütüphanelerini yükle ve yapılandır


  - react-i18next, i18next, i18next-browser-languagedetector paketlerini yükle
  - frontend/src/i18n/config.ts dosyasını oluştur
  - i18n yapılandırmasını App.tsx'e entegre et
  - TypeScript tip tanımlarını oluştur (frontend/src/types/i18n.ts)
  - _Gereksinimler: 9.1, 9.2, 14.1_

- [x] 1.2 Çeviri dosyası yapısını oluştur


  - frontend/src/locales/tr/ dizinini oluştur
  - Boş çeviri dosyalarını oluştur (kiosk.json, admin.json, common.json, validation.json)
  - JSON dosyalarını i18n config'e import et
  - _Gereksinimler: 9.1, 9.3_

- [ ]* 1.3 Frontend i18n yapılandırması için unit test yaz
  - i18n'in Türkçe yüklendiğini test et
  - Tüm namespace'lerin yüklendiğini test et
  - Temel çeviri fonksiyonunun çalıştığını test et
  - Interpolation'ın çalıştığını test et
  - _Gereksinimler: 13.1, 13.2_

- [ ] 2. Kiosk arayüzü çevirilerini oluştur



- [x] 2.1 Kiosk çeviri dosyasını doldur


  - frontend/src/locales/tr/kiosk.json dosyasını tamamla
  - Dijital menü çevirilerini ekle (menu.*)
  - Anket çevirilerini ekle (survey.satisfaction.*, survey.discovery.*)
  - Google İnceleme çevirilerini ekle (googleReview.*)
  - Slayt gösterisi çevirilerini ekle (slideshow.*)
  - Çevrimdışı mod çevirilerini ekle (offline.*)
  - Amaç etiketleri çevirilerini ekle (purposeTags.*)
  - _Gereksinimler: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.4_

- [x] 2.2 Kiosk bileşenlerini çevirilerle güncelle


  - MassageList.tsx'i useTranslation ile güncelle
  - MassageDetailPanel.tsx'i useTranslation ile güncelle
  - SlideshowMode.tsx'i useTranslation ile güncelle
  - SurveyMode.tsx'i useTranslation ile güncelle (satisfaction ve discovery)
  - GoogleQRMode.tsx'i useTranslation ile güncelle
  - KioskModeRouter.tsx'i useTranslation ile güncelle (offline indicator)
  - _Gereksinimler: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ]* 2.3 Kiosk Türkçe görüntüleme için property test yaz
  - **Özellik 1: Kiosk Arayüzü Tam Türkçe**
  - **Doğrular: Gereksinim 1.1**
- [ ] 3. Yönetim paneli çevirilerini oluştur




- [ ] 3. Yönetim paneli çevirilerini oluştur


- [x] 3.1 Admin çeviri dosyasını doldur

  - frontend/src/locales/tr/admin.json dosyasını tamamla
  - Navigasyon çevirilerini ekle (navigation.*)
  - Giriş sayfası çevirilerini ekle (login.*)
  - Dashboard çevirilerini ekle (dashboard.*)
  - Masaj yönetimi çevirilerini ekle (massages.*)
  - Anket yönetimi çevirilerini ekle (surveys.*)
  - Anket yanıtları çevirilerini ekle (responses.*)
  - Kiosk kontrolü çevirilerini ekle (kioskControl.*)
  - Ayarlar çevirilerini ekle (settings.*)
  - Yedekleme çevirilerini ekle (backup.*)
  - Sistem logları çevirilerini ekle (logs.*)
  - _Gereksinimler: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3.2 Admin panel bileşenlerini çevirilerle güncelle


  - AdminLayout.tsx navigasyonunu güncelle
  - LoginPage.tsx'i güncelle
  - DashboardPage.tsx'i güncelle
  - MassagesPage.tsx ve MassageFormPage.tsx'i güncelle
  - SurveysPage.tsx ve SurveyEditorPage.tsx'i güncelle
  - SurveyResponsesPage.tsx'i güncelle
  - KioskControlPage.tsx'i güncelle
  - SettingsPage.tsx'i güncelle
  - BackupPage.tsx'i güncelle
  - SystemLogsPage.tsx'i güncelle
  - _Gereksinimler: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ]* 3.3 Admin panel Türkçe görüntüleme için property test yaz
  - **Özellik 2: Yönetim Paneli Tam Türkçe**
  - **Doğrular: Gereksinim 2.1**

- [ ] 4. Ortak ve doğrulama çevirilerini oluştur





- [x] 4.1 Common çeviri dosyasını doldur


  - frontend/src/locales/tr/common.json dosyasını tamamla
  - Aksiyon çevirilerini ekle (actions.*)
  - Durum çevirilerini ekle (status.*)
  - Zaman çevirilerini ekle (time.*)
  - Birim çevirilerini ekle (units.*)
  - Mesaj çevirilerini ekle (messages.*)
  - _Gereksinimler: 12.1, 12.3, 12.4, 12.5_

- [x] 4.2 Validation çeviri dosyasını doldur


  - frontend/src/locales/tr/validation.json dosyasını tamamla
  - Tüm doğrulama mesajlarını ekle
  - Hata mesajlarını ekle
  - _Gereksinimler: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4.3 Ortak bileşenleri çevirilerle güncelle


  - ErrorBoundary.tsx'i güncelle
  - ErrorMessage.tsx'i güncelle
  - SuccessMessage.tsx'i güncelle
  - LoadingSpinner.tsx'i güncelle
  - ProtectedRoute.tsx'i güncelle
  - _Gereksinimler: 3.2, 4.1, 4.2_

- [ ]* 4.4 Hata mesajları Türkçe için property test yaz
  - **Özellik 3: Hata Mesajları Türkçe**
  - **Doğrular: Gereksinim 3.2**

- [ ]* 4.5 Doğrulama mesajları Türkçe için property test yaz
  - **Özellik 4: Doğrulama Mesajları Türkçe**
  - **Doğrular: Gereksinim 3.1**

- [x] 5. Backend i18n altyapısını kur




- [x] 5.1 Backend i18n kütüphanelerini yükle ve yapılandır


  - i18next ve i18next-fs-backend paketlerini yükle
  - backend/src/i18n/config.ts dosyasını oluştur
  - i18n'i backend index.ts'e entegre et
  - _Gereksinimler: 7.1, 7.2, 9.4_

- [x] 5.2 Backend çeviri dosyası yapısını oluştur


  - backend/src/locales/tr/ dizinini oluştur
  - Boş çeviri dosyalarını oluştur (errors.json, validation.json, success.json, logs.json)
  - _Gereksinimler: 9.4_

- [ ]* 5.3 Backend i18n yapılandırması için unit test yaz
  - i18n'in Türkçe yüklendiğini test et
  - Hata mesajlarının çevrildiğini test et
  - Parametreli çevirilerin çalıştığını test et
  - _Gereksinimler: 13.5_

- [x] 6. Backend çeviri dosyalarını doldur




- [x] 6.1 Backend errors.json dosyasını tamamla


  - Tüm hata mesajlarını Türkçe ekle
  - notFound, unauthorized, forbidden, badRequest, internalError vb.
  - _Gereksinimler: 7.2, 7.6, 7.7_

- [x] 6.2 Backend validation.json dosyasını tamamla


  - Tüm doğrulama mesajlarını Türkçe ekle
  - required, invalid, tooShort, tooLong, outOfRange vb.
  - _Gereksinimler: 7.3_

- [x] 6.3 Backend success.json dosyasını tamamla


  - Tüm başarı mesajlarını Türkçe ekle
  - created, updated, deleted, saved, uploaded vb.
  - _Gereksinimler: 7.1_

- [x] 6.4 Backend logs.json dosyasını tamamla


  - Sistem log mesajlarını Türkçe ekle
  - _Gereksinimler: 8.6_

- [ ]* 6.5 API yanıtları Türkçe için property test yaz
  - **Özellik 9: API Yanıtları Türkçe**
  - **Doğrular: Gereksinim 7.1, 7.2**

- [x] 7. Backend API yanıtlarını çevirilerle güncelle





- [x] 7.1 Admin routes'ları güncelle


  - adminRoutes.ts'deki tüm yanıt mesajlarını i18n ile değiştir
  - Başarı mesajlarını çevir
  - Hata mesajlarını çevir
  - Doğrulama mesajlarını çevir
  - _Gereksinimler: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7.2 Kiosk routes'ları güncelle


  - kioskRoutes.ts'deki tüm yanıt mesajlarını i18n ile değiştir
  - _Gereksinimler: 7.1, 7.2_

- [x] 7.3 Middleware'leri güncelle


  - errorHandler.ts'i i18n ile güncelle
  - validationMiddleware.ts'i i18n ile güncelle
  - authMiddleware.ts'i i18n ile güncelle
  - _Gereksinimler: 7.2, 7.3, 7.4, 7.5_

- [x] 7.4 Service'leri güncelle


  - LoggerService.ts log mesajlarını i18n ile güncelle
  - BackupService.ts mesajlarını i18n ile güncelle
  - GoogleSheetsService.ts mesajlarını i18n ile güncelle
  - _Gereksinimler: 7.1, 7.2, 8.6_

- [ ]* 7.5 Başarı mesajları Türkçe için property test yaz
  - **Özellik 5: Başarı Mesajları Türkçe**
  - **Doğrular: Gereksinim 4.1, 4.2, 4.3**

- [x] 8. Tarih ve saat formatlarını uygula




- [x] 8.1 Tarih formatı yardımcı fonksiyonlarını oluştur


  - date-fns ve date-fns/locale/tr paketlerini yükle
  - frontend/src/utils/dateFormatter.ts dosyasını oluştur
  - formatDate, formatDateTime, formatTime, formatRelativeTime fonksiyonlarını yaz
  - _Gereksinimler: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 8.2 Tüm tarih görüntülemelerini güncelle


  - Dashboard'daki tarih/saat gösterimlerini güncelle
  - Anket yanıtları tarihlerini güncelle
  - Sistem logları tarihlerini güncelle
  - Yedekleme tarihlerini güncelle
  - Son görülme zamanlarını güncelle
  - _Gereksinimler: 5.1, 5.2, 5.3, 5.4_

- [ ]* 8.3 Tarih formatı için property test yaz
  - **Özellik 6: Tarih Formatı Türkiye Standardı**
  - **Doğrular: Gereksinim 5.1**

- [ ]* 8.4 Saat formatı için property test yaz
  - **Özellik 7: Saat Formatı 24 Saat**
  - **Doğrular: Gereksinim 5.2**

- [x] 9. Para birimi formatlarını uygula



- [x] 9.1 Para birimi formatı yardımcı fonksiyonunu oluştur


  - frontend/src/utils/currencyFormatter.ts dosyasını oluştur
  - formatCurrency fonksiyonunu Intl.NumberFormat ile yaz
  - _Gereksinimler: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9.2 Tüm fiyat görüntülemelerini güncelle


  - Masaj detay panelindeki fiyatları güncelle
  - Masaj listesindeki fiyatları güncelle
  - Admin panel masaj formundaki fiyatları güncelle
  - _Gereksinimler: 6.1, 6.2, 6.3, 6.4_

- [ ]* 9.3 Para birimi formatı için property test yaz
  - **Özellik 8: Para Birimi TL Formatı**
  - **Doğrular: Gereksinim 6.1, 6.2, 6.3, 6.4**
- [x] 10. Veritabanı seed'ini Türkçe içerikle güncelle




- [ ] 10. Veritabanı seed'ini Türkçe içerikle güncelle

- [x] 10.1 Seed dosyasını Türkçe içerikle güncelle


  - backend/src/database/seed.ts dosyasını güncelle
  - Memnuniyet anketi şablonunu Türkçe oluştur
  - Keşif anketi şablonunu Türkçe oluştur
  - Varsayılan Google İnceleme ayarlarını Türkçe oluştur
  - Amaç etiketlerini Türkçe tanımla
  - _Gereksinimler: 8.1, 8.2, 8.3, 8.4, 8.5_


- [x] 10.2 Mevcut veritabanını güncelle

  - Mevcut anket şablonlarını Türkçe güncelle
  - Mevcut sistem ayarlarını Türkçe güncelle
  - Migration script'i oluştur (gerekirse)
  - _Gereksinimler: 8.1, 8.2, 8.3, 8.5_

- [ ]* 10.3 Veritabanı içeriği Türkçe için property test yaz
  - **Özellik 10: Veritabanı İçeriği Türkçe**
  - **Doğrular: Gereksinim 8.1, 8.2, 8.3**
- [ ] 11. Erişilebilirlik için aria-label'ları güncelle



- [ ] 11. Erişilebilirlik için aria-label'ları güncelle

- [x] 11.1 Kiosk bileşenlerinde aria-label'ları ekle/güncelle


  - Tüm butonlara Türkçe aria-label ekle
  - Tüm linklere Türkçe aria-label ekle
  - Tüm form alanlarına Türkçe aria-label ekle
  - _Gereksinimler: 11.1, 11.2, 11.3_

- [x] 11.2 Admin panel bileşenlerinde aria-label'ları ekle/güncelle


  - Navigasyon öğelerine Türkçe aria-label ekle
  - Form alanlarına Türkçe aria-label ekle
  - Aksiyon butonlarına Türkçe aria-label ekle
  - _Gereksinimler: 11.1, 11.2, 11.3, 11.4_

- [ ]* 11.3 Aria-label Türkçe için property test yaz
  - **Özellik 13: Aria-label Türkçe**
  - **Doğrular: Gereksinim 11.1, 11.2**

- [ ] 12. Çeviri tutarlılığını sağla




- [x] 12.1 Terminoloji tutarlılığını kontrol et


  - Tüm çeviri dosyalarında aynı terimlerin tutarlı kullanıldığını doğrula
  - Buton metinlerinin tutarlı olduğunu doğrula (Kaydet, Güncelle, Sil, İptal)
  - Durum ifadelerinin tutarlı olduğunu doğrula (Aktif/Pasif, Açık/Kapalı)
  - _Gereksinimler: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 12.2 Çeviri anahtarı tutarlılığı script'i oluştur


  - scripts/check-translations.ts dosyasını oluştur
  - Tüm çeviri anahtarlarının var olduğunu kontrol et
  - Kullanılmayan anahtarları tespit et
  - Eksik çevirileri raporla
  - _Gereksinimler: 9.5, 9.6, 13.1, 13.6_

- [ ]* 12.3 Çeviri anahtarı tutarlılığı için property test yaz
  - **Özellik 11: Çeviri Anahtarı Tutarlılığı**
  - **Doğrular: Gereksinim 12.1**

- [ ]* 12.4 Eksik çeviri tespiti için property test yaz
  - **Özellik 12: Eksik Çeviri Tespiti**
  - **Doğrular: Gereksinim 9.5, 9.6**
-

- [ ] 13. E2E testlerini çalıştır




- [x] 13.1 Kiosk Türkçe E2E testlerini yaz


  - Kiosk ana sayfasının Türkçe olduğunu test et
  - Dijital menü modunun Türkçe olduğunu test et
  - Anket modunun Türkçe olduğunu test et
  - Google QR modunun Türkçe olduğunu test et
  - Çevrimdışı göstergesinin Türkçe olduğunu test et
  - _Gereksinimler: 13.2_

- [x] 13.2 Admin panel Türkçe E2E testlerini yaz


  - Giriş sayfasının Türkçe olduğunu test et
  - Dashboard'un Türkçe olduğunu test et
  - Masaj yönetiminin Türkçe olduğunu test et
  - Anket yönetiminin Türkçe olduğunu test et
  - Ayarlar sayfasının Türkçe olduğunu test et
  - _Gereksinimler: 13.2_

- [x] 13.3 Hata mesajları E2E testlerini yaz


  - Form doğrulama hatalarının Türkçe olduğunu test et
  - API hata mesajlarının Türkçe olduğunu test et
  - Ağ hatası mesajlarının Türkçe olduğunu test et
  - _Gereksinimler: 13.3, 13.4_

- [x] 13.4 Tarih ve para birimi formatları E2E testlerini yaz


  - Tarihlerin GG.AA.YYYY formatında olduğunu test et
  - Saatlerin 24 saat formatında olduğunu test et
  - Fiyatların ₺ sembolü ile gösterildiğini test et
  - _Gereksinimler: 13.2_

- [ ] 14. Performans optimizasyonu





- [x] 14.1 Çeviri yükleme performansını optimize et


  - Çeviri dosyalarının 500ms içinde yüklendiğini doğrula
  - Lazy loading stratejisi uygula (gerekirse)
  - Çeviri önbellekleme ekle
  - _Gereksinimler: 14.1, 14.2, 14.3_

- [x] 14.2 Service worker ile çeviri önbellekleme ekle


  - Çeviri dosyalarını service worker ile önbelleğe al
  - Çevrimdışı modda önbellekteki çevirileri kullan
  - _Gereksinimler: 14.5_

- [ ]* 14.3 Çeviri yükleme performansı için property test yaz
  - **Özellik 14: Çeviri Dosyası Yükleme Performansı**
  - **Doğrular: Gereksinim 14.1**

- [x] 15. Dokümantasyon ve son kontroller







- [x] 15.1 Çeviri rehberi oluştur

  - Yeni çeviri ekleme sürecini dokümante et
  - Çeviri güncelleme sürecini dokümante et
  - Çeviri silme sürecini dokümante et
  - Terminoloji kılavuzu oluştur
  - _Gereksinimler: Tüm gereksinimler_

- [x] 15.2 Tüm ekranları manuel test et


  - Kiosk tüm modlarını test et
  - Admin panel tüm sayfalarını test et
  - Tüm hata senaryolarını test et
  - Tüm başarı senaryolarını test et
  - Mobil responsive görünümü test et
  - _Gereksinimler: 13.2, 13.3, 13.4_

- [x] 15.3 Çeviri bütünlüğü kontrolü yap


  - check-translations script'ini çalıştır
  - Eksik çevirileri tamamla
  - Kullanılmayan çevirileri temizle
  - _Gereksinimler: 13.1, 13.6_
- [x] 16. Final checkpoint - Tüm testlerin geçtiğinden emin ol






- [ ] 16. Final checkpoint - Tüm testlerin geçtiğinden emin ol

  - Tüm testlerin geçtiğinden emin ol, sorular çıkarsa kullanıcıya sor.
