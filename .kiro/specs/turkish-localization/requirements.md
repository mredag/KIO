# Türkçe Yerelleştirme Gereksinimleri

## Giriş

SPA Dijital Kiosk ve Yönetim Paneli sistemi, Türkiye'deki spa işletmeleri için tasarlanmıştır ve tüm kullanıcı arayüzlerinin, hata mesajlarının, geri bildirimlerin ve sistem mesajlarının %100 Türkçe olması gerekmektedir. Bu belge, sistemin tam Türkçe yerelleştirmesi için gereksinimleri tanımlar.

## Sözlük

- **i18n (Internationalization)**: Yazılımın birden fazla dili desteklemesi için yapılan mimari ve kod değişiklikleri
- **Yerelleştirme (Localization)**: Belirli bir dil ve bölge için içerik çevirisi ve kültürel uyarlama
- **Çeviri Anahtarı (Translation Key)**: Çeviri dosyalarında kullanılan benzersiz tanımlayıcı
- **Çeviri Dosyası (Translation File)**: Dil çevirilerini içeren JSON formatındaki dosya
- **Kiosk Arayüzü**: Spa misafirlerinin kullandığı dokunmatik ekran arayüzü
- **Yönetim Paneli**: Spa personelinin içerik yönetimi için kullandığı web arayüzü
- **Backend Mesajları**: API yanıtlarında dönen hata ve başarı mesajları
- **Doğrulama Mesajları**: Form girişlerinin doğrulanması sırasında gösterilen mesajlar
- **Sistem Bildirimleri**: Kullanıcıya gösterilen bilgilendirme, uyarı ve hata bildirimleri
- **Tarih/Saat Formatı**: Türkiye standartlarına uygun tarih ve saat gösterimi (DD.MM.YYYY, 24 saat formatı)
- **Para Birimi Formatı**: Türk Lirası gösterimi (₺ sembolü, nokta ve virgül kullanımı)

## Gereksinimler

### Gereksinim 1: Kiosk Arayüzü Türkçeleştirme

**Kullanıcı Hikayesi:** Spa misafiri olarak, kiosk ekranındaki tüm metinleri Türkçe görmek istiyorum, böylece sistemi rahatça kullanabilirim.

#### Kabul Kriterleri

1. WHEN Kiosk Uygulaması yüklendiğinde, THE Kiosk Uygulaması SHALL tüm arayüz metinlerini Türkçe olarak göstermelidir
2. WHEN Dijital Menü modunda masaj listesi görüntülendiğinde, THE Kiosk Uygulaması SHALL masaj adlarını, açıklamalarını ve amaç etiketlerini Türkçe göstermelidir
3. WHEN Anket modu aktif olduğunda, THE Kiosk Uygulaması SHALL anket sorularını, cevap seçeneklerini ve talimatları Türkçe göstermelidir
4. WHEN Google İnceleme QR modu görüntülendiğinde, THE Kiosk Uygulaması SHALL başlık ve açıklama metinlerini Türkçe göstermelidir
5. WHEN Slayt gösterisi modunda içerik görüntülendiğinde, THE Kiosk Uygulaması SHALL tanıtım metinlerini Türkçe göstermelidir
6. WHEN Teşekkür ekranı gösterildiğinde, THE Kiosk Uygulaması SHALL teşekkür mesajını ve yönlendirme metinlerini Türkçe göstermelidir
7. WHEN Çevrimdışı mod aktif olduğunda, THE Kiosk Uygulaması SHALL çevrimdışı göstergesini ve bilgilendirme mesajını Türkçe göstermelidir

### Gereksinim 2: Yönetim Paneli Türkçeleştirme

**Kullanıcı Hikayesi:** Spa personeli olarak, yönetim panelindeki tüm menüleri, butonları ve mesajları Türkçe görmek istiyorum, böylece sistemi etkin şekilde yönetebilirim.

#### Kabul Kriterleri

1. WHEN Yönetim Paneli yüklendiğinde, THE Yönetim Paneli SHALL tüm navigasyon menülerini, sayfa başlıklarını ve buton metinlerini Türkçe göstermelidir
2. WHEN Giriş sayfası görüntülendiğinde, THE Yönetim Paneli SHALL form etiketlerini, placeholder metinlerini ve giriş butonunu Türkçe göstermelidir
3. WHEN Dashboard sayfası görüntülendiğinde, THE Yönetim Paneli SHALL istatistik başlıklarını, durum göstergelerini ve bilgilendirme metinlerini Türkçe göstermelidir
4. WHEN Masaj yönetim sayfası görüntülendiğinde, THE Yönetim Paneli SHALL tablo başlıklarını, form alanlarını ve aksiyon butonlarını Türkçe göstermelidir
5. WHEN Anket yönetim sayfası görüntülendiğinde, THE Yönetim Paneli SHALL anket şablonu alanlarını ve düzenleme araçlarını Türkçe göstermelidir
6. WHEN Sistem ayarları sayfası görüntülendiğinde, THE Yönetim Paneli SHALL ayar başlıklarını, açıklamalarını ve birim etiketlerini Türkçe göstermelidir
7. WHEN Yedekleme sayfası görüntülendiğinde, THE Yönetim Paneli SHALL yedekleme bilgilerini ve aksiyon butonlarını Türkçe göstermelidir

### Gereksinim 3: Hata ve Doğrulama Mesajları

**Kullanıcı Hikayesi:** Sistem kullanıcısı olarak, hata ve doğrulama mesajlarını Türkçe görmek istiyorum, böylece sorunları anlayabilir ve düzeltebilirim.

#### Kabul Kriterleri

1. WHEN Form doğrulama hatası oluştuğunda, THE Sistem SHALL doğrulama mesajlarını Türkçe göstermelidir
2. WHEN API isteği başarısız olduğunda, THE Sistem SHALL hata mesajını Türkçe göstermelidir
3. WHEN Zorunlu alan boş bırakıldığında, THE Sistem SHALL "Bu alan zorunludur" mesajını göstermelidir
4. WHEN Geçersiz email formatı girildiğinde, THE Sistem SHALL "Geçerli bir email adresi giriniz" mesajını göstermelidir
5. WHEN Dosya boyutu limiti aşıldığında, THE Sistem SHALL "Dosya boyutu çok büyük (maksimum: X MB)" mesajını göstermelidir
6. WHEN Geçersiz dosya formatı yüklendiğinde, THE Sistem SHALL "Geçersiz dosya formatı. Sadece X, Y, Z formatları desteklenir" mesajını göstermelidir
7. WHEN Ağ bağlantısı kesildiğinde, THE Sistem SHALL "İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin" mesajını göstermelidir
8. WHEN Oturum süresi dolduğunda, THE Sistem SHALL "Oturumunuz sona erdi. Lütfen tekrar giriş yapın" mesajını göstermelidir

### Gereksinim 4: Başarı ve Bilgilendirme Mesajları

**Kullanıcı Hikayesi:** Sistem kullanıcısı olarak, başarı ve bilgilendirme mesajlarını Türkçe görmek istiyorum, böylece işlemlerin durumunu anlayabilirim.

#### Kabul Kriterleri

1. WHEN Veri başarıyla kaydedildiğinde, THE Sistem SHALL "Başarıyla kaydedildi" mesajını göstermelidir
2. WHEN Veri başarıyla güncellendiğinde, THE Sistem SHALL "Başarıyla güncellendi" mesajını göstermelidir
3. WHEN Veri başarıyla silindiğinde, THE Sistem SHALL "Başarıyla silindi" mesajını göstermelidir
4. WHEN Dosya başarıyla yüklendiğinde, THE Sistem SHALL "Dosya başarıyla yüklendi" mesajını göstermelidir
5. WHEN Yedekleme başarıyla oluşturulduğunda, THE Sistem SHALL "Yedekleme başarıyla oluşturuldu" mesajını göstermelidir
6. WHEN Google Sheets bağlantısı test edildiğinde, THE Sistem SHALL "Bağlantı başarılı" veya "Bağlantı başarısız" mesajını göstermelidir
7. WHEN Anket gönderildiğinde, THE Sistem SHALL "Teşekkür ederiz! Görüşleriniz bizim için değerli" mesajını göstermelidir

### Gereksinim 5: Tarih ve Saat Formatları

**Kullanıcı Hikayesi:** Sistem kullanıcısı olarak, tarih ve saat bilgilerini Türkiye standartlarına uygun formatta görmek istiyorum.

#### Kabul Kriterleri

1. WHEN Tarih bilgisi görüntülendiğinde, THE Sistem SHALL tarihi GG.AA.YYYY formatında göstermelidir
2. WHEN Saat bilgisi görüntülendiğinde, THE Sistem SHALL saati 24 saat formatında (SS:DD) göstermelidir
3. WHEN Tarih ve saat birlikte görüntülendiğinde, THE Sistem SHALL "GG.AA.YYYY SS:DD" formatını kullanmalıdır
4. WHEN Göreceli zaman gösterildiğinde, THE Sistem SHALL Türkçe ifadeler kullanmalıdır ("2 dakika önce", "1 saat önce", "dün", "geçen hafta")
5. WHEN Ay adları görüntülendiğinde, THE Sistem SHALL Türkçe ay adlarını kullanmalıdır (Ocak, Şubat, Mart, vb.)
6. WHEN Gün adları görüntülendiğinde, THE Sistem SHALL Türkçe gün adlarını kullanmalıdır (Pazartesi, Salı, Çarşamba, vb.)

### Gereksinim 6: Para Birimi Formatları

**Kullanıcı Hikayesi:** Spa misafiri olarak, fiyat bilgilerini Türk Lirası formatında görmek istiyorum.

#### Kabul Kriterleri

1. WHEN Fiyat bilgisi görüntülendiğinde, THE Sistem SHALL Türk Lirası sembolünü (₺) kullanmalıdır
2. WHEN Fiyat formatlanırken, THE Sistem SHALL binlik ayracı olarak nokta (.) kullanmalıdır
3. WHEN Ondalık değer gösterildiğinde, THE Sistem SHALL ondalık ayracı olarak virgül (,) kullanmalıdır
4. WHEN Fiyat görüntülendiğinde, THE Sistem SHALL "₺1.250,00" formatını kullanmalıdır
5. WHEN Sıfır ondalık değer varsa, THE Sistem SHALL "₺1.250" formatını kullanabilmelidir

### Gereksinim 7: Backend API Mesajları

**Kullanıcı Hikayesi:** Geliştirici olarak, API yanıtlarındaki tüm mesajların Türkçe olmasını istiyorum, böylece frontend tutarlı mesajlar gösterebilir.

#### Kabul Kriterleri

1. WHEN API başarılı yanıt döndüğünde, THE Backend SHALL başarı mesajını Türkçe döndürmelidir
2. WHEN API hata yanıtı döndüğünde, THE Backend SHALL hata mesajını Türkçe döndürmelidir
3. WHEN Doğrulama hatası oluştuğunda, THE Backend SHALL doğrulama hata mesajlarını Türkçe döndürmelidir
4. WHEN Kimlik doğrulama başarısız olduğunda, THE Backend SHALL "Geçersiz kullanıcı adı veya şifre" mesajını döndürmelidir
5. WHEN Yetkilendirme başarısız olduğunda, THE Backend SHALL "Bu işlem için yetkiniz yok" mesajını döndürmelidir
6. WHEN Kaynak bulunamadığında, THE Backend SHALL "İstenen kaynak bulunamadı" mesajını döndürmelidir
7. WHEN Sunucu hatası oluştuğunda, THE Backend SHALL "Bir hata oluştu. Lütfen daha sonra tekrar deneyin" mesajını döndürmelidir

### Gereksinim 8: Veritabanı İçerik Yerelleştirme

**Kullanıcı Hikayesi:** Spa yöneticisi olarak, veritabanında saklanan içeriklerin Türkçe olmasını istiyorum, böylece misafirler doğru dilde bilgi görebilir.

#### Kabul Kriterleri

1. WHEN Varsayılan anket şablonları oluşturulduğunda, THE Sistem SHALL anket başlıklarını, sorularını ve cevap seçeneklerini Türkçe oluşturmalıdır
2. WHEN Memnuniyet anketi görüntülendiğinde, THE Sistem SHALL "Genel memnuniyet dereceniz nedir?" sorusunu göstermelidir
3. WHEN Keşif anketi görüntülendiğinde, THE Sistem SHALL "Bizi nasıl duydunuz?" sorusunu göstermelidir
4. WHEN Masaj amaç etiketleri görüntülendiğinde, THE Sistem SHALL etiketleri Türkçe göstermelidir (Rahatlama, Ağrı Giderme, Detoks, Esneklik, Spor Sonrası İyileşme)
5. WHEN Sistem ayarları başlatıldığında, THE Sistem SHALL varsayılan Google İnceleme başlığını ve açıklamasını Türkçe oluşturmalıdır
6. WHEN Sistem logları kaydedildiğinde, THE Sistem SHALL log mesajlarını Türkçe kaydetmelidir

### Gereksinim 9: Çeviri Dosyası Yapısı ve Yönetimi

**Kullanıcı Hikayesi:** Geliştirici olarak, çeviri dosyalarının organize ve yönetilebilir olmasını istiyorum, böylece çevirileri kolayca güncelleyebilirim.

#### Kabul Kriterleri

1. WHEN Çeviri dosyaları oluşturulduğunda, THE Sistem SHALL JSON formatında yapılandırılmış çeviri dosyaları kullanmalıdır
2. WHEN Çeviri anahtarları tanımlandığında, THE Sistem SHALL anlamlı ve hiyerarşik anahtar isimleri kullanmalıdır (örn: "kiosk.menu.title", "admin.login.button")
3. WHEN Frontend çeviri yüklendiğinde, THE Sistem SHALL çeviri dosyalarını modüler yapıda organize etmelidir (kiosk.json, admin.json, common.json)
4. WHEN Backend çeviri yüklendiğinde, THE Sistem SHALL çeviri dosyalarını kategori bazında organize etmelidir (errors.json, validation.json, success.json)
5. WHEN Çeviri eksik olduğunda, THE Sistem SHALL geliştirme ortamında uyarı loglamalıdır
6. WHEN Çeviri anahtarı bulunamadığında, THE Sistem SHALL anahtar ismini göstermeli ve konsola hata loglamalıdır

### Gereksinim 10: Dinamik İçerik Çevirisi

**Kullanıcı Hikayesi:** Sistem kullanıcısı olarak, dinamik içeriklerin (sayılar, isimler, vb.) doğru şekilde Türkçe cümlelere entegre edilmesini istiyorum.

#### Kabul Kriterleri

1. WHEN Parametreli mesaj gösterildiğinde, THE Sistem SHALL parametreleri doğru pozisyonlara yerleştirmelidir
2. WHEN Çoğul ifade kullanıldığında, THE Sistem SHALL Türkçe çoğul kurallarını uygulamalıdır
3. WHEN Sayı ile birlikte metin gösterildiğinde, THE Sistem SHALL doğru Türkçe ifadeyi kullanmalıdır ("1 masaj", "5 masaj")
4. WHEN Zaman ifadesi gösterildiğinde, THE Sistem SHALL Türkçe zaman ifadelerini kullanmalıdır ("1 dakika", "5 dakika", "1 saat", "3 saat")
5. WHEN Dosya boyutu gösterildiğinde, THE Sistem SHALL Türkçe birim kısaltmalarını kullanmalıdır (KB, MB, GB)

### Gereksinim 11: Erişilebilirlik ve Ekran Okuyucu Desteği

**Kullanıcı Hikayesi:** Görme engelli kullanıcı olarak, ekran okuyucunun Türkçe içeriği doğru şekilde okumasını istiyorum.

#### Kabul Kriterleri

1. WHEN Ekran okuyucu kullanıldığında, THE Sistem SHALL tüm aria-label özelliklerini Türkçe sağlamalıdır
2. WHEN Buton ve link etiketleri okunduğunda, THE Sistem SHALL anlamlı Türkçe açıklamalar sağlamalıdır
3. WHEN Form alanları okunduğunda, THE Sistem SHALL Türkçe etiket ve talimatlar sağlamalıdır
4. WHEN Hata mesajları okunduğunda, THE Sistem SHALL Türkçe hata açıklamalarını sağlamalıdır
5. WHEN Sayfa başlığı değiştiğinde, THE Sistem SHALL Türkçe sayfa başlığını güncellemelidir

### Gereksinim 12: Tutarlılık ve Terminoloji

**Kullanıcı Hikayesi:** Sistem kullanıcısı olarak, tüm arayüzlerde tutarlı terminoloji kullanılmasını istiyorum, böylece sistemi daha kolay anlayabilirim.

#### Kabul Kriterleri

1. WHEN Aynı kavram farklı yerlerde kullanıldığında, THE Sistem SHALL aynı Türkçe terimi kullanmalıdır
2. WHEN Teknik terimler çevrildiğinde, THE Sistem SHALL yaygın kabul görmüş Türkçe karşılıklarını kullanmalıdır
3. WHEN Buton metinleri yazıldığında, THE Sistem SHALL tutarlı fiil formları kullanmalıdır (Kaydet, Güncelle, Sil, İptal)
4. WHEN Onay mesajları gösterildiğinde, THE Sistem SHALL tutarlı soru formatı kullanmalıdır ("Bu işlemi yapmak istediğinizden emin misiniz?")
5. WHEN Durum mesajları gösterildiğinde, THE Sistem SHALL tutarlı durum ifadeleri kullanmalıdır (Aktif/Pasif, Açık/Kapalı, Çevrimiçi/Çevrimdışı)

### Gereksinim 13: Test ve Doğrulama

**Kullanıcı Hikayesi:** Kalite güvence uzmanı olarak, tüm çevirilerin doğru ve eksiksiz olduğunu doğrulayabilmek istiyorum.

#### Kabul Kriterleri

1. WHEN Çeviri dosyaları oluşturulduğunda, THE Sistem SHALL tüm çeviri anahtarlarının karşılığını içermelidir
2. WHEN Uygulama test edildiğinde, THE Test Süreci SHALL tüm ekranlarda Türkçe metinlerin görüntülendiğini doğrulamalıdır
3. WHEN Hata senaryoları test edildiğinde, THE Test Süreci SHALL tüm hata mesajlarının Türkçe olduğunu doğrulamalıdır
4. WHEN Form doğrulama test edildiğinde, THE Test Süreci SHALL tüm doğrulama mesajlarının Türkçe olduğunu doğrulamalıdır
5. WHEN API yanıtları test edildiğinde, THE Test Süreci SHALL tüm API mesajlarının Türkçe olduğunu doğrulamalıdır
6. WHEN Çeviri eksikliği tespit edildiğinde, THE Sistem SHALL geliştirme ortamında uyarı vermelidir

### Gereksinim 14: Performans ve Yükleme

**Kullanıcı Hikayesi:** Sistem kullanıcısı olarak, çeviri dosyalarının yüklenmesinin uygulama performansını olumsuz etkilememesini istiyorum.

#### Kabul Kriterleri

1. WHEN Uygulama başlatıldığında, THE Sistem SHALL çeviri dosyalarını 500 milisaniye içinde yüklemelidir
2. WHEN Çeviri dosyaları yüklendiğinde, THE Sistem SHALL dosyaları önbelleğe almalıdır
3. WHEN Çeviri değiştirildiğinde, THE Sistem SHALL sadece değişen çevirileri yeniden yüklemelidir
4. WHEN Çeviri dosyası boyutu büyüdüğünde, THE Sistem SHALL dosyaları modüler olarak yüklemelidir
5. WHEN Çevrimdışı modda çalışıldığında, THE Sistem SHALL önbellekteki çevirileri kullanmalıdır
