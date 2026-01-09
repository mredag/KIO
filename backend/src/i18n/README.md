# Backend i18n Usage Guide

## Overview

The backend uses `i18next` for internationalization. All messages are in Turkish and organized into namespaces.

## Namespaces

- **errors**: Error messages
- **validation**: Validation error messages
- **success**: Success messages
- **logs**: System log messages

## Usage Examples

### Basic Translation

```typescript
import i18n from '../i18n/config.js';

// Simple translation
const message = i18n.t('errors:notFound');
// Output: "İstenen kaynak bulunamadı"

// With namespace
const successMsg = i18n.t('success:created');
// Output: "Başarıyla oluşturuldu"
```

### Translation with Parameters

```typescript
// Validation message with field name
const message = i18n.t('validation:required', { field: 'Email' });
// Output: "Email alanı zorunludur"

// Message with multiple parameters
const rangeMsg = i18n.t('validation:outOfRange', { 
  field: 'Yaş', 
  min: 18, 
  max: 65 
});
// Output: "Yaş 18 ile 65 arasında olmalıdır"
```

### In API Routes

```typescript
import i18n from '../i18n/config.js';

// Success response
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

// Validation error
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

### In Middleware

```typescript
import i18n from '../i18n/config.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err);

  const statusCode = err.statusCode || 500;
  const message = err.message || i18n.t('errors:internalError');

  res.status(statusCode).json({
    success: false,
    message: message,
  });
}
```

### In Services

```typescript
import i18n from '../i18n/config.js';

export class BackupService {
  async createBackup() {
    try {
      // ... backup logic
      logger.info(i18n.t('logs:backupCreated'));
      return {
        success: true,
        message: i18n.t('success:backupCreated')
      };
    } catch (error) {
      logger.error(i18n.t('logs:errorOccurred'), { error });
      throw new Error(i18n.t('errors:internalError'));
    }
  }
}
```

## Available Translations

### Errors (errors.json)
- `notFound`: "İstenen kaynak bulunamadı"
- `unauthorized`: "Bu işlem için yetkiniz yok"
- `forbidden`: "Erişim reddedildi"
- `badRequest`: "Geçersiz istek"
- `internalError`: "Bir hata oluştu. Lütfen daha sonra tekrar deneyin"
- `invalidCredentials`: "Geçersiz kullanıcı adı veya şifre"
- `sessionExpired`: "Oturumunuz sona erdi"
- `rateLimitExceeded`: "Çok fazla istek. Lütfen daha sonra tekrar deneyin"
- `fileUploadError`: "Dosya yüklenirken hata oluştu"
- `fileTooLarge`: "Dosya boyutu çok büyük"
- `invalidFileType`: "Geçersiz dosya formatı"
- `databaseError`: "Veritabanı hatası"
- `syncError`: "Senkronizasyon hatası"
- `connectionError`: "Bağlantı hatası"

### Validation (validation.json)
- `required`: "{{field}} alanı zorunludur"
- `invalid`: "{{field}} geçersiz"
- `tooShort`: "{{field}} en az {{min}} karakter olmalıdır"
- `tooLong`: "{{field}} en fazla {{max}} karakter olmalıdır"
- `outOfRange`: "{{field}} {{min}} ile {{max}} arasında olmalıdır"
- `invalidEmail`: "Geçerli bir email adresi giriniz"
- `invalidUrl`: "Geçerli bir URL giriniz"
- `invalidFormat`: "{{field}} formatı geçersiz"
- `mustBePositive`: "{{field}} pozitif bir sayı olmalıdır"
- `mustBeInteger`: "{{field}} tam sayı olmalıdır"
- `surveyRequired`: "Anket modu için bir anket seçilmelidir"
- `invalidMode`: "Geçersiz kiosk modu"
- `invalidTimeout`: "Zaman aşımı değeri 5-300 saniye arasında olmalıdır"

### Success (success.json)
- `created`: "Başarıyla oluşturuldu"
- `updated`: "Başarıyla güncellendi"
- `deleted`: "Başarıyla silindi"
- `saved`: "Başarıyla kaydedildi"
- `uploaded`: "Dosya başarıyla yüklendi"
- `synced`: "Başarıyla senkronize edildi"
- `backupCreated`: "Yedekleme başarıyla oluşturuldu"
- `connectionSuccessful`: "Bağlantı başarılı"
- `testSuccessful`: "Test başarılı"
- `loginSuccessful`: "Giriş başarılı"
- `logoutSuccessful`: "Çıkış başarılı"

### Logs (logs.json)
- `serverStarted`: "Sunucu başlatıldı"
- `serverStopped`: "Sunucu durduruldu"
- `databaseConnected`: "Veritabanı bağlantısı kuruldu"
- `databaseDisconnected`: "Veritabanı bağlantısı kesildi"
- `backupCreated`: "Yedekleme oluşturuldu"
- `backupRestored`: "Yedekleme geri yüklendi"
- `syncStarted`: "Senkronizasyon başlatıldı"
- `syncCompleted`: "Senkronizasyon tamamlandı"
- `syncFailed`: "Senkronizasyon başarısız"
- `fileUploaded`: "Dosya yüklendi"
- `fileDeleted`: "Dosya silindi"
- `userLoggedIn`: "Kullanıcı giriş yaptı"
- `userLoggedOut`: "Kullanıcı çıkış yaptı"
- `unauthorizedAccess`: "Yetkisiz erişim denemesi"
- `errorOccurred`: "Hata oluştu"

## Adding New Translations

1. Open the appropriate JSON file in `backend/src/locales/tr/`
2. Add your new key-value pair
3. Use the translation in your code with `i18n.t('namespace:key')`

Example:
```json
// backend/src/locales/tr/errors.json
{
  "myNewError": "Yeni hata mesajı"
}
```

```typescript
// In your code
const message = i18n.t('errors:myNewError');
```

## Testing

Run the i18n tests:
```bash
npm test -- src/i18n/config.test.ts
```

## Requirements

This implementation satisfies:
- Requirement 7.1: Backend API messages in Turkish
- Requirement 7.2: Error messages in Turkish
- Requirement 9.4: Backend translation file structure
