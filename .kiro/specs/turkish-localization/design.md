# Türkçe Yerelleştirme Tasarım Dokümanı

## Genel Bakış

Bu tasarım, SPA Dijital Kiosk ve Yönetim Paneli sisteminin tam Türkçe yerelleştirmesini sağlamak için gerekli mimari değişiklikleri, kütüphane seçimlerini ve uygulama stratejilerini tanımlar. Sistem, frontend (React) ve backend (Node.js/Express) olmak üzere iki katmanda i18n desteği sağlayacaktır.

## Mimari

### Yerelleştirme Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  react-i18next                                       │  │
│  │  - Translation Provider                              │  │
│  │  - useTranslation Hook                               │  │
│  │  - Trans Component                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Translation Files (JSON)                            │  │
│  │  - frontend/src/locales/tr/kiosk.json               │  │
│  │  - frontend/src/locales/tr/admin.json               │  │
│  │  - frontend/src/locales/tr/common.json              │  │
│  │  - frontend/src/locales/tr/validation.json          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  i18next                                             │  │
│  │  - Backend Middleware                                │  │
│  │  - Translation Functions                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Translation Files (JSON)                            │  │
│  │  - backend/src/locales/tr/errors.json               │  │
│  │  - backend/src/locales/tr/validation.json           │  │
│  │  - backend/src/locales/tr/success.json              │  │
│  │  - backend/src/locales/tr/logs.json                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Database (SQLite)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Turkish Content                                     │  │
│  │  - Survey Templates (Turkish questions/options)     │  │
│  │  - Default Settings (Turkish text)                  │  │
│  │  - Purpose Tags (Turkish labels)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Bileşenler ve Arayüzler

### 1. Frontend i18n Yapılandırması

**Kütüphane Seçimi:** react-i18next + i18next

**Neden react-i18next:**
- React ekosisteminde en yaygın kullanılan i18n kütüphanesi
- Hook desteği (useTranslation)
- Context API entegrasyonu
- TypeScript desteği
- Performanslı ve hafif
- Namespace desteği (modüler çeviri dosyaları)
- Interpolation (parametre yerleştirme) desteği
- Pluralization (çoğul) desteği

**Yapılandırma:**

```typescript
// frontend/src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import kioskTr from '../locales/tr/kiosk.json';
import adminTr from '../locales/tr/admin.json';
import commonTr from '../locales/tr/common.json';
import validationTr from '../locales/tr/validation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: {
        kiosk: kioskTr,
        admin: adminTr,
        common: commonTr,
        validation: validationTr,
      },
    },
    lng: 'tr', // Default language
    fallbackLng: 'tr',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Disable suspense for better control
    },
  });

export default i18n;
```


### 2. Çeviri Dosyası Yapısı

**Frontend Çeviri Dosyaları:**

```json
// frontend/src/locales/tr/kiosk.json
{
  "menu": {
    "title": "Masaj Menüsü",
    "featured": "Öne Çıkan Masajlar",
    "regular": "Tüm Masajlar",
    "duration": "Süre",
    "sessions": "Seanslar",
    "selectMassage": "Detayları görmek için bir masaj seçin",
    "noMassages": "Henüz masaj eklenmemiş"
  },
  "survey": {
    "satisfaction": {
      "title": "Memnuniyet Anketi",
      "question1": "Genel memnuniyet dereceniz nedir?",
      "question2": "Neden memnun kalmadınız?",
      "options": {
        "notAsExpected": "Masaj beklediğim gibi değildi",
        "environment": "Ortam sıcaklığı veya gürültü rahatsız ediciydi",
        "staff": "Personel ile ilgili sorun",
        "price": "Fiyat",
        "other": "Diğer"
      },
      "thankYou": "Teşekkür ederiz. Google'da yorum bırakmak ister misiniz?",
      "googleButton": "Google İnceleme QR Kodunu Göster"
    },
    "discovery": {
      "title": "Keşif Anketi",
      "question1": "Bizi nasıl duydunuz?",
      "question2": "Daha önce spa deneyiminiz oldu mu?",
      "options": {
        "google": "Google arama sonuçları",
        "instagram": "Instagram",
        "friend": "Arkadaş tavsiyesi",
        "passingBy": "Geçerken gördüm",
        "other": "Diğer",
        "yes": "Evet",
        "no": "Hayır"
      },
      "thankYou": "Görüşleriniz bizim için değerli. Teşekkür ederiz!"
    },
    "submit": "Gönder",
    "timeout": "İşlem zaman aşımına uğradı. Anket sıfırlandı."
  },
  "googleReview": {
    "defaultTitle": "Bizi Google'da Değerlendirin",
    "defaultDescription": "QR kodu telefonunuzla tarayın ve görüşlerinizi paylaşın",
    "scanPrompt": "Kameranızı QR koda tutun"
  },
  "slideshow": {
    "promotional": "Özel Kampanya"
  },
  "offline": {
    "indicator": "Çevrimdışı Mod",
    "message": "Sunucuya bağlanılamıyor. Önbellekteki içerik gösteriliyor."
  },
  "purposeTags": {
    "relaxation": "Rahatlama",
    "painRelief": "Ağrı Giderme",
    "detox": "Detoks",
    "flexibility": "Esneklik",
    "postSport": "Spor Sonrası İyileşme"
  }
}
```

```json
// frontend/src/locales/tr/admin.json
{
  "navigation": {
    "dashboard": "Ana Sayfa",
    "massages": "Masajlar",
    "surveys": "Anketler",
    "responses": "Anket Yanıtları",
    "kioskControl": "Kiosk Kontrolü",
    "settings": "Ayarlar",
    "backup": "Yedekleme",
    "logs": "Sistem Logları",
    "logout": "Çıkış"
  },
  "login": {
    "title": "Yönetim Paneli Girişi",
    "username": "Kullanıcı Adı",
    "password": "Şifre",
    "button": "Giriş Yap",
    "error": "Geçersiz kullanıcı adı veya şifre"
  },
  "dashboard": {
    "title": "Ana Sayfa",
    "todaySurveys": "Bugünkü Anketler",
    "totalSurveys": "Toplam Anketler",
    "kioskMode": "Kiosk Modu",
    "kioskStatus": "Kiosk Durumu",
    "online": "Çevrimiçi",
    "offline": "Çevrimdışı",
    "lastSeen": "Son Görülme",
    "sheetsSync": "Google Sheets Senkronizasyonu",
    "lastSync": "Son Senkronizasyon",
    "pendingSync": "Bekleyen Senkronizasyon"
  },
  "massages": {
    "title": "Masaj Yönetimi",
    "addNew": "Yeni Masaj Ekle",
    "edit": "Düzenle",
    "delete": "Sil",
    "name": "Masaj Adı",
    "shortDescription": "Kısa Açıklama",
    "longDescription": "Detaylı Açıklama",
    "duration": "Süre",
    "media": "Medya",
    "mediaType": "Medya Tipi",
    "video": "Video",
    "photo": "Fotoğraf",
    "uploadMedia": "Medya Yükle",
    "sessions": "Seanslar",
    "sessionName": "Seans Adı",
    "sessionPrice": "Fiyat",
    "addSession": "Seans Ekle",
    "purposeTags": "Amaç Etiketleri",
    "featured": "Öne Çıkan",
    "campaign": "Kampanya",
    "sortOrder": "Sıralama",
    "save": "Kaydet",
    "cancel": "İptal",
    "confirmDelete": "Bu masajı silmek istediğinizden emin misiniz?"
  }
}
```


```json
// frontend/src/locales/tr/common.json
{
  "actions": {
    "save": "Kaydet",
    "cancel": "İptal",
    "delete": "Sil",
    "edit": "Düzenle",
    "add": "Ekle",
    "update": "Güncelle",
    "submit": "Gönder",
    "close": "Kapat",
    "confirm": "Onayla",
    "back": "Geri",
    "next": "İleri",
    "download": "İndir",
    "upload": "Yükle",
    "search": "Ara",
    "filter": "Filtrele",
    "reset": "Sıfırla",
    "refresh": "Yenile"
  },
  "status": {
    "active": "Aktif",
    "inactive": "Pasif",
    "enabled": "Etkin",
    "disabled": "Devre Dışı",
    "online": "Çevrimiçi",
    "offline": "Çevrimdışı",
    "synced": "Senkronize",
    "pending": "Bekliyor",
    "failed": "Başarısız",
    "success": "Başarılı"
  },
  "time": {
    "seconds": "saniye",
    "minutes": "dakika",
    "hours": "saat",
    "days": "gün",
    "weeks": "hafta",
    "months": "ay",
    "years": "yıl",
    "ago": "önce",
    "justNow": "Az önce",
    "today": "Bugün",
    "yesterday": "Dün",
    "tomorrow": "Yarın"
  },
  "units": {
    "kb": "KB",
    "mb": "MB",
    "gb": "GB",
    "currency": "₺"
  },
  "messages": {
    "loading": "Yükleniyor...",
    "noData": "Veri bulunamadı",
    "error": "Bir hata oluştu",
    "tryAgain": "Tekrar deneyin",
    "confirmAction": "Bu işlemi yapmak istediğinizden emin misiniz?"
  }
}
```

```json
// frontend/src/locales/tr/validation.json
{
  "required": "Bu alan zorunludur",
  "email": "Geçerli bir email adresi giriniz",
  "minLength": "En az {{min}} karakter olmalıdır",
  "maxLength": "En fazla {{max}} karakter olmalıdır",
  "min": "En az {{min}} olmalıdır",
  "max": "En fazla {{max}} olmalıdır",
  "pattern": "Geçersiz format",
  "url": "Geçerli bir URL giriniz",
  "number": "Geçerli bir sayı giriniz",
  "integer": "Tam sayı giriniz",
  "positive": "Pozitif bir sayı giriniz",
  "fileSize": "Dosya boyutu çok büyük (maksimum: {{max}} MB)",
  "fileType": "Geçersiz dosya formatı. Sadece {{types}} formatları desteklenir",
  "passwordMismatch": "Şifreler eşleşmiyor",
  "invalidCredentials": "Geçersiz kullanıcı adı veya şifre",
  "sessionExpired": "Oturumunuz sona erdi. Lütfen tekrar giriş yapın",
  "networkError": "İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin",
  "serverError": "Sunucu hatası. Lütfen daha sonra tekrar deneyin"
}
```

### 3. Backend i18n Yapılandırması

**Kütüphane Seçimi:** i18next + i18next-fs-backend

```typescript
// backend/src/i18n/config.ts
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';

i18next
  .use(Backend)
  .init({
    lng: 'tr',
    fallbackLng: 'tr',
    ns: ['errors', 'validation', 'success', 'logs'],
    defaultNS: 'errors',
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
```

**Backend Çeviri Dosyaları:**

```json
// backend/src/locales/tr/errors.json
{
  "notFound": "İstenen kaynak bulunamadı",
  "unauthorized": "Bu işlem için yetkiniz yok",
  "forbidden": "Erişim reddedildi",
  "badRequest": "Geçersiz istek",
  "internalError": "Bir hata oluştu. Lütfen daha sonra tekrar deneyin",
  "invalidCredentials": "Geçersiz kullanıcı adı veya şifre",
  "sessionExpired": "Oturumunuz sona erdi",
  "rateLimitExceeded": "Çok fazla istek. Lütfen daha sonra tekrar deneyin",
  "fileUploadError": "Dosya yüklenirken hata oluştu",
  "fileTooLarge": "Dosya boyutu çok büyük",
  "invalidFileType": "Geçersiz dosya formatı",
  "databaseError": "Veritabanı hatası",
  "syncError": "Senkronizasyon hatası",
  "connectionError": "Bağlantı hatası"
}
```

```json
// backend/src/locales/tr/validation.json
{
  "required": "{{field}} alanı zorunludur",
  "invalid": "{{field}} geçersiz",
  "tooShort": "{{field}} en az {{min}} karakter olmalıdır",
  "tooLong": "{{field}} en fazla {{max}} karakter olmalıdır",
  "outOfRange": "{{field}} {{min}} ile {{max}} arasında olmalıdır",
  "invalidEmail": "Geçerli bir email adresi giriniz",
  "invalidUrl": "Geçerli bir URL giriniz",
  "invalidFormat": "{{field}} formatı geçersiz",
  "mustBePositive": "{{field}} pozitif bir sayı olmalıdır",
  "mustBeInteger": "{{field}} tam sayı olmalıdır",
  "surveyRequired": "Anket modu için bir anket seçilmelidir",
  "invalidMode": "Geçersiz kiosk modu",
  "invalidTimeout": "Zaman aşımı değeri 5-300 saniye arasında olmalıdır"
}
```

```json
// backend/src/locales/tr/success.json
{
  "created": "Başarıyla oluşturuldu",
  "updated": "Başarıyla güncellendi",
  "deleted": "Başarıyla silindi",
  "saved": "Başarıyla kaydedildi",
  "uploaded": "Dosya başarıyla yüklendi",
  "synced": "Başarıyla senkronize edildi",
  "backupCreated": "Yedekleme başarıyla oluşturuldu",
  "connectionSuccessful": "Bağlantı başarılı",
  "testSuccessful": "Test başarılı",
  "loginSuccessful": "Giriş başarılı",
  "logoutSuccessful": "Çıkış başarılı"
}
```


### 4. Kullanım Örnekleri

**Frontend - Hook Kullanımı:**

```typescript
// Kiosk component example
import { useTranslation } from 'react-i18next';

function MassageList() {
  const { t } = useTranslation('kiosk');
  
  return (
    <div>
      <h2>{t('menu.title')}</h2>
      <h3>{t('menu.featured')}</h3>
      {massages.length === 0 && <p>{t('menu.noMassages')}</p>}
    </div>
  );
}

// Admin component example
import { useTranslation } from 'react-i18next';

function MassageForm() {
  const { t } = useTranslation(['admin', 'common', 'validation']);
  
  return (
    <form>
      <label>{t('admin:massages.name')}</label>
      <input placeholder={t('admin:massages.name')} />
      {error && <span>{t('validation:required')}</span>}
      <button>{t('common:actions.save')}</button>
    </form>
  );
}
```

**Frontend - Parametreli Çeviri:**

```typescript
// With interpolation
const { t } = useTranslation('validation');
<span>{t('fileSize', { max: 50 })}</span>
// Output: "Dosya boyutu çok büyük (maksimum: 50 MB)"

// With pluralization
const { t } = useTranslation('common');
<span>{t('time.minutes', { count: 5 })}</span>
// Output: "5 dakika"
```

**Backend - API Response:**

```typescript
// backend/src/routes/adminRoutes.ts
import i18n from '../i18n/config';

router.post('/massages', async (req, res) => {
  try {
    const massage = await db.createMassage(req.body);
    res.json({
      success: true,
      message: i18n.t('success:created'),
      data: massage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: i18n.t('errors:internalError')
    });
  }
});

// Validation error example
router.put('/kiosk/mode', async (req, res) => {
  const { mode, activeSurveyId } = req.body;
  
  if (mode === 'survey' && !activeSurveyId) {
    return res.status(400).json({
      success: false,
      message: i18n.t('validation:surveyRequired')
    });
  }
  
  // ... rest of the logic
});
```

### 5. Tarih ve Saat Formatları

**date-fns Kullanımı:**

```typescript
// frontend/src/utils/dateFormatter.ts
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export const formatDate = (date: Date | string): string => {
  return format(new Date(date), 'dd.MM.yyyy', { locale: tr });
};

export const formatDateTime = (date: Date | string): string => {
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: tr });
};

export const formatTime = (date: Date | string): string => {
  return format(new Date(date), 'HH:mm', { locale: tr });
};

export const formatRelativeTime = (date: Date | string): string => {
  return formatDistanceToNow(new Date(date), { 
    addSuffix: true, 
    locale: tr 
  });
};

// Usage examples:
// formatDate('2024-11-23') => "23.11.2024"
// formatDateTime('2024-11-23T14:30:00') => "23.11.2024 14:30"
// formatRelativeTime('2024-11-23T14:00:00') => "2 saat önce"
```

### 6. Para Birimi Formatları

**Intl.NumberFormat Kullanımı:**

```typescript
// frontend/src/utils/currencyFormatter.ts
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Usage examples:
// formatCurrency(1250) => "₺1.250"
// formatCurrency(1250.50) => "₺1.250,50"
// formatCurrency(1250.00) => "₺1.250"
```

### 7. Veritabanı Seed Güncellemeleri

**Türkçe Varsayılan Veriler:**

```typescript
// backend/src/database/seed.ts
export function seedDefaultData(db: Database) {
  // Satisfaction Survey Template (Turkish)
  db.prepare(`
    INSERT OR REPLACE INTO survey_templates (id, name, type, title, description, questions, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'satisfaction-survey',
    'Memnuniyet Anketi',
    'satisfaction',
    'Memnuniyet Anketi',
    'Hizmetimiz hakkındaki görüşlerinizi öğrenmek isteriz',
    JSON.stringify([
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
        conditionalOn: { questionId: 'q1', values: ['1', '2', '3'] }
      }
    ]),
    1
  );

  // Discovery Survey Template (Turkish)
  db.prepare(`
    INSERT OR REPLACE INTO survey_templates (id, name, type, title, description, questions, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'discovery-survey',
    'Keşif Anketi',
    'discovery',
    'Keşif Anketi',
    'Bizi nasıl keşfettiğinizi öğrenmek isteriz',
    JSON.stringify([
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
    0
  );

  // Default Google Review Settings (Turkish)
  db.prepare(`
    UPDATE system_settings 
    SET google_review_title = ?,
        google_review_description = ?
    WHERE id = 1
  `).run(
    'Bizi Google\'da Değerlendirin',
    'QR kodu telefonunuzla tarayın ve görüşlerinizi paylaşın'
  );
}
```


## Veri Modelleri

### Çeviri Dosyası Yapısı

**Namespace Organizasyonu:**

```
frontend/src/locales/
└── tr/
    ├── kiosk.json          # Kiosk-specific translations
    ├── admin.json          # Admin panel translations
    ├── common.json         # Shared translations
    └── validation.json     # Validation messages

backend/src/locales/
└── tr/
    ├── errors.json         # Error messages
    ├── validation.json     # Validation messages
    ├── success.json        # Success messages
    └── logs.json           # Log messages
```

### TypeScript Tip Tanımları

```typescript
// frontend/src/types/i18n.ts
import 'react-i18next';
import kiosk from '../locales/tr/kiosk.json';
import admin from '../locales/tr/admin.json';
import common from '../locales/tr/common.json';
import validation from '../locales/tr/validation.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      kiosk: typeof kiosk;
      admin: typeof admin;
      common: typeof common;
      validation: typeof validation;
    };
  }
}
```

## Doğruluk Özellikleri

_Bir özellik, sistemin tüm geçerli yürütmelerinde doğru olması gereken bir karakteristik veya davranıştır—esasen, sistemin ne yapması gerektiğine dair resmi bir ifadedir._

### Özellik 1: Kiosk Arayüzü Tam Türkçe

_Herhangi bir_ kiosk ekranı yüklendiğinde, tüm görünür metinler Türkçe olmalıdır.
**Doğrular: Gereksinim 1.1**

### Özellik 2: Yönetim Paneli Tam Türkçe

_Herhangi bir_ yönetim paneli sayfası yüklendiğinde, tüm arayüz öğeleri Türkçe olmalıdır.
**Doğrular: Gereksinim 2.1**

### Özellik 3: Hata Mesajları Türkçe

_Herhangi bir_ hata durumunda, kullanıcıya gösterilen mesaj Türkçe olmalıdır.
**Doğrular: Gereksinim 3.2**

### Özellik 4: Doğrulama Mesajları Türkçe

_Herhangi bir_ form doğrulama hatası oluştuğunda, gösterilen mesaj Türkçe olmalıdır.
**Doğrular: Gereksinim 3.1**

### Özellik 5: Başarı Mesajları Türkçe

_Herhangi bir_ başarılı işlem sonrasında, kullanıcıya gösterilen mesaj Türkçe olmalıdır.
**Doğrular: Gereksinim 4.1, 4.2, 4.3**

### Özellik 6: Tarih Formatı Türkiye Standardı

_Herhangi bir_ tarih gösteriminde, format GG.AA.YYYY olmalıdır.
**Doğrular: Gereksinim 5.1**

### Özellik 7: Saat Formatı 24 Saat

_Herhangi bir_ saat gösteriminde, 24 saat formatı (SS:DD) kullanılmalıdır.
**Doğrular: Gereksinim 5.2**

### Özellik 8: Para Birimi TL Formatı

_Herhangi bir_ fiyat gösteriminde, Türk Lirası sembolü (₺) ve Türkiye formatı kullanılmalıdır.
**Doğrular: Gereksinim 6.1, 6.2, 6.3, 6.4**

### Özellik 9: API Yanıtları Türkçe

_Herhangi bir_ API yanıtında, mesaj alanı Türkçe olmalıdır.
**Doğrular: Gereksinim 7.1, 7.2**

### Özellik 10: Veritabanı İçeriği Türkçe

_Herhangi bir_ varsayılan veritabanı kaydı oluşturulduğunda, metin alanları Türkçe olmalıdır.
**Doğrular: Gereksinim 8.1, 8.2, 8.3**

### Özellik 11: Çeviri Anahtarı Tutarlılığı

_Herhangi bir_ çeviri anahtarı kullanıldığında, aynı anahtar her yerde aynı çeviriyi döndürmelidir.
**Doğrular: Gereksinim 12.1**

### Özellik 12: Eksik Çeviri Tespiti

_Herhangi bir_ çeviri anahtarı bulunamadığında, sistem geliştirme ortamında uyarı loglamalıdır.
**Doğrular: Gereksinim 9.5, 9.6**

### Özellik 13: Aria-label Türkçe

_Herhangi bir_ aria-label özelliği kullanıldığında, değer Türkçe olmalıdır.
**Doğrular: Gereksinim 11.1, 11.2**

### Özellik 14: Çeviri Dosyası Yükleme Performansı

_Herhangi bir_ uygulama başlatıldığında, çeviri dosyaları 500 milisaniye içinde yüklenmelidir.
**Doğrular: Gereksinim 14.1**

## Hata Yönetimi

### Frontend Hata Yönetimi

```typescript
// frontend/src/components/ErrorBoundary.tsx
import { useTranslation } from 'react-i18next';

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="error-container">
        <h2>{t('messages.error')}</h2>
        <button onClick={() => setHasError(false)}>
          {t('messages.tryAgain')}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

### Backend Hata Yönetimi

```typescript
// backend/src/middleware/errorHandler.ts
import i18n from '../i18n/config';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err);

  const statusCode = err.statusCode || 500;
  const message = err.message || i18n.t('errors:internalError');

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

## Test Stratejisi

### Unit Testler

**Frontend Çeviri Testleri:**

```typescript
// frontend/src/__tests__/i18n.test.ts
import i18n from '../i18n/config';

describe('i18n Configuration', () => {
  it('should load Turkish translations', () => {
    expect(i18n.language).toBe('tr');
  });

  it('should have all required namespaces', () => {
    const namespaces = ['kiosk', 'admin', 'common', 'validation'];
    namespaces.forEach(ns => {
      expect(i18n.hasResourceBundle('tr', ns)).toBe(true);
    });
  });

  it('should translate kiosk menu title', () => {
    expect(i18n.t('kiosk:menu.title')).toBe('Masaj Menüsü');
  });

  it('should handle interpolation', () => {
    expect(i18n.t('validation:fileSize', { max: 50 }))
      .toBe('Dosya boyutu çok büyük (maksimum: 50 MB)');
  });
});
```

**Backend Çeviri Testleri:**

```typescript
// backend/src/__tests__/i18n.test.ts
import i18n from '../i18n/config';

describe('Backend i18n', () => {
  it('should translate error messages', () => {
    expect(i18n.t('errors:notFound')).toBe('İstenen kaynak bulunamadı');
  });

  it('should translate validation messages with parameters', () => {
    expect(i18n.t('validation:required', { field: 'Email' }))
      .toBe('Email alanı zorunludur');
  });

  it('should translate success messages', () => {
    expect(i18n.t('success:created')).toBe('Başarıyla oluşturuldu');
  });
});
```

### E2E Testler

```typescript
// backend/src/e2e/turkish-localization.test.ts
import puppeteer from 'puppeteer';

describe('Turkish Localization E2E', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should display kiosk in Turkish', async () => {
    await page.goto('http://localhost:3000/kiosk');
    const title = await page.$eval('h2', el => el.textContent);
    expect(title).toBe('Masaj Menüsü');
  });

  it('should display admin login in Turkish', async () => {
    await page.goto('http://localhost:3000/admin/login');
    const button = await page.$eval('button[type="submit"]', el => el.textContent);
    expect(button).toBe('Giriş Yap');
  });

  it('should show Turkish error messages', async () => {
    await page.goto('http://localhost:3000/admin/login');
    await page.click('button[type="submit"]');
    const error = await page.$eval('.error-message', el => el.textContent);
    expect(error).toContain('zorunludur');
  });

  it('should format dates in Turkish format', async () => {
    await page.goto('http://localhost:3000/admin/dashboard');
    const dateText = await page.$eval('.last-seen', el => el.textContent);
    expect(dateText).toMatch(/\d{2}\.\d{2}\.\d{4}/); // DD.MM.YYYY
  });

  it('should format currency in Turkish format', async () => {
    await page.goto('http://localhost:3000/kiosk');
    await page.click('.massage-card:first-child');
    const price = await page.$eval('.session-price', el => el.textContent);
    expect(price).toContain('₺');
  });
});
```

### Çeviri Bütünlüğü Testi

```typescript
// scripts/check-translations.ts
import fs from 'fs';
import path from 'path';

function checkTranslationCompleteness() {
  const localesDir = path.join(__dirname, '../frontend/src/locales/tr');
  const files = fs.readdirSync(localesDir);
  
  const allKeys = new Set<string>();
  const missingKeys: string[] = [];

  files.forEach(file => {
    const content = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf-8'));
    extractKeys(content, file.replace('.json', ''), allKeys);
  });

  // Check for missing translations
  // Check for unused keys
  // Report results

  if (missingKeys.length > 0) {
    console.error('Missing translations:', missingKeys);
    process.exit(1);
  }

  console.log('✓ All translations are complete');
}

function extractKeys(obj: any, prefix: string, keys: Set<string>) {
  Object.keys(obj).forEach(key => {
    const fullKey = `${prefix}:${key}`;
    if (typeof obj[key] === 'object') {
      extractKeys(obj[key], fullKey, keys);
    } else {
      keys.add(fullKey);
    }
  });
}

checkTranslationCompleteness();
```

## Performans Optimizasyonu

### Lazy Loading

```typescript
// frontend/src/i18n/config.ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

i18next
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: 'tr',
    fallbackLng: 'tr',
    ns: ['common'], // Load common namespace immediately
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    react: {
      useSuspense: true, // Enable suspense for lazy loading
    },
  });
```

### Caching

```typescript
// Service worker for offline caching
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('translations-v1').then((cache) => {
      return cache.addAll([
        '/locales/tr/kiosk.json',
        '/locales/tr/admin.json',
        '/locales/tr/common.json',
        '/locales/tr/validation.json',
      ]);
    })
  );
});
```

## Bakım ve Güncelleme

### Çeviri Ekleme Süreci

1. Çeviri anahtarını ilgili JSON dosyasına ekle
2. TypeScript tip tanımlarını güncelle (otomatik)
3. Kodda yeni anahtarı kullan
4. Testleri çalıştır
5. E2E testlerle doğrula

### Çeviri Güncelleme Süreci

1. İlgili JSON dosyasındaki çeviriyi güncelle
2. Değişikliği test et
3. Tüm kullanım yerlerini kontrol et
4. Commit ve deploy

### Çeviri Silme Süreci

1. Kullanılmayan anahtarları tespit et (check-translations script)
2. Koddan referansları kaldır
3. JSON dosyasından anahtarı sil
4. Testleri çalıştır
