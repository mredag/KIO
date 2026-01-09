# Turkish Message Templates for n8n Workflows

This document provides all Turkish message templates to be used in n8n WhatsApp workflows for the coupon system.

## Customer Messages

### Coupon Awarded (Success)

**When customer has not reached 4 coupons:**
```
✅ Kuponunuz eklendi! Toplam: ${balance}/4 kupon. ${remainingToFree} kupon daha toplamanız gerekiyor.
```

**When customer has reached 4 coupons:**
```
✅ Kuponunuz eklendi! Toplam: ${balance}/4 kupon. 'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz.
```

**Combined template (use in Function node):**
```javascript
const balance = $json.balance;
const remainingToFree = $json.remainingToFree;

let message;
if (remainingToFree === 0) {
  message = `✅ Kuponunuz eklendi! Toplam: ${balance}/4 kupon. 'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz.`;
} else {
  message = `✅ Kuponunuz eklendi! Toplam: ${balance}/4 kupon. ${remainingToFree} kupon daha toplamanız gerekiyor.`;
}

return { phone: $json.phone, message: message };
```

### Balance Check

**When customer has not reached 4 coupons:**
```
📊 Kupon durumunuz: ${balance}/4 kupon toplandı. ${remaining} kupon daha toplamanız gerekiyor.
```

**When customer has reached 4 coupons:**
```
📊 Kupon durumunuz: ${balance}/4 kupon toplandı. 'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz.
```

**When customer has no wallet:**
```
📊 Henüz kuponunuz yok. Masaj sonrası verilen QR kodu okutarak kupon kazanabilirsiniz.
```

**Combined template (use in Function node):**
```javascript
const balance = $json.balance || 0;
const remainingToFree = 4 - balance;

let message;
if (balance === 0) {
  message = '📊 Henüz kuponunuz yok. Masaj sonrası verilen QR kodu okutarak kupon kazanabilirsiniz.';
} else if (balance >= 4) {
  message = `📊 Kupon durumunuz: ${balance}/4 kupon toplandı. 'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz.`;
} else {
  message = `📊 Kupon durumunuz: ${balance}/4 kupon toplandı. ${remainingToFree} kupon daha toplamanız gerekiyor.`;
}

return { phone: $json.phone, message: message };
```

### Redemption Success

```
🎉 Tebrikler! 4 kuponunuz kullanıldı. Redemption ID: ${redemptionId}. Resepsiyona bu kodu göstererek ücretsiz masajınızı alabilirsiniz.
```

**Template (use in Function node):**
```javascript
const redemptionId = $json.redemptionId;
const message = `🎉 Tebrikler! 4 kuponunuz kullanıldı. Redemption ID: ${redemptionId}. Resepsiyona bu kodu göstererek ücretsiz masajınızı alabilirsiniz.`;

return { phone: $json.phone, message: message };
```

### Insufficient Coupons

```
📊 Henüz yeterli kuponunuz yok. Mevcut: ${balance}/4 kupon. ${remaining} kupon daha toplamanız gerekiyor.
```

**Template (use in Function node):**
```javascript
const balance = $json.balance;
const remaining = $json.needed;
const message = `📊 Henüz yeterli kuponunuz yok. Mevcut: ${balance}/4 kupon. ${remaining} kupon daha toplamanız gerekiyor.`;

return { phone: $json.phone, message: message };
```

### Error Messages

**Invalid Token:**
```
❌ Bu kupon geçersiz veya kullanılmış. Lütfen resepsiyonla iletişime geçin.
```

**Expired Token:**
```
❌ Bu kuponun süresi dolmuş. Lütfen resepsiyonla iletişime geçin.
```

**Rate Limit Exceeded:**
```
⏳ Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.
```

**Generic Error:**
```
Şu anda işlemi tamamlayamadık. Lütfen biraz sonra tekrar deneyin veya resepsiyonla konuşun.
```

**Template for error handling (use in Function node):**
```javascript
const errorCode = $json.error?.code;

let message;
switch (errorCode) {
  case 'INVALID_TOKEN':
    message = '❌ Bu kupon geçersiz veya kullanılmış. Lütfen resepsiyonla iletişime geçin.';
    break;
  case 'EXPIRED_TOKEN':
    message = '❌ Bu kuponun süresi dolmuş. Lütfen resepsiyonla iletişime geçin.';
    break;
  case 'RATE_LIMIT_EXCEEDED':
    message = '⏳ Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.';
    break;
  case 'INSUFFICIENT_COUPONS':
    const balance = $json.error?.details?.balance || 0;
    const needed = $json.error?.details?.needed || 4;
    message = `📊 Henüz yeterli kuponunuz yok. Mevcut: ${balance}/4 kupon. ${needed} kupon daha toplamanız gerekiyor.`;
    break;
  default:
    message = 'Şu anda işlemi tamamlayamadık. Lütfen biraz sonra tekrar deneyin veya resepsiyonla konuşun.';
}

return { phone: $json.phone, message: message };
```

### Opt-Out Confirmation

```
✅ Bildirimleri kapattık. Kupon kazanımı ve kullanımı normal devam eder.
```

## Staff Notifications

### New Redemption

```
🔔 Yeni kupon kullanımı! Müşteri: ${maskedPhone} | Redemption ID: ${redemptionId} | Tarih: ${timestamp}
```

**Template (use in Function node):**
```javascript
const phone = $json.phone;
const redemptionId = $json.redemptionId;
const timestamp = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

// Mask phone number (show last 4 digits)
const maskedPhone = phone.replace(/\d(?=\d{4})/g, '*');

const message = `🔔 Yeni kupon kullanımı! Müşteri: ${maskedPhone} | Redemption ID: ${redemptionId} | Tarih: ${timestamp}`;

return { 
  groupId: process.env.WHATSAPP_STAFF_GROUP_ID,
  message: message 
};
```

### Redemption Rejected

```
❌ Kupon kullanımı reddedildi. Redemption ID: ${redemptionId} | Sebep: ${note}
```

**Template (use in Function node):**
```javascript
const redemptionId = $json.redemptionId;
const note = $json.note;

const message = `❌ Kupon kullanımı reddedildi. Redemption ID: ${redemptionId} | Sebep: ${note}`;

return { 
  groupId: process.env.WHATSAPP_STAFF_GROUP_ID,
  message: message 
};
```

### Redemption Completed

```
✅ Kupon kullanımı tamamlandı. Redemption ID: ${redemptionId} | Tamamlayan: ${adminUsername}
```

**Template (use in Function node):**
```javascript
const redemptionId = $json.redemptionId;
const adminUsername = $json.adminUsername;

const message = `✅ Kupon kullanımı tamamlandı. Redemption ID: ${redemptionId} | Tamamlayan: ${adminUsername}`;

return { 
  groupId: process.env.WHATSAPP_STAFF_GROUP_ID,
  message: message 
};
```

### Suspicious Activity Alert

```
⚠️ Şüpheli aktivite tespit edildi. Telefon: ${maskedPhone} | Detay: ${details}
```

**Template (use in Function node):**
```javascript
const phone = $json.phone;
const details = $json.details;

// Mask phone number (show last 4 digits)
const maskedPhone = phone.replace(/\d(?=\d{4})/g, '*');

const message = `⚠️ Şüpheli aktivite tespit edildi. Telefon: ${maskedPhone} | Detay: ${details}`;

return { 
  groupId: process.env.WHATSAPP_STAFF_GROUP_ID,
  message: message 
};
```

### Daily Summary

```
📈 Günlük özet: ${issuedCount} kupon verildi, ${redeemedCount} kullanım yapıldı.
```

**Template (use in Function node):**
```javascript
const issuedCount = $json.issuedCount;
const redeemedCount = $json.redeemedCount;

const message = `📈 Günlük özet: ${issuedCount} kupon verildi, ${redeemedCount} kullanım yapıldı.`;

return { 
  groupId: process.env.WHATSAPP_STAFF_GROUP_ID,
  message: message 
};
```

## Implementation Notes

### Using Templates in n8n Workflows

1. **Function Nodes**: Copy the JavaScript templates above into Function nodes
2. **Variable Substitution**: Use `$json.fieldName` to access data from previous nodes
3. **Phone Masking**: Always mask phone numbers in staff notifications
4. **Timezone**: Use `Europe/Istanbul` for timestamps
5. **Error Handling**: Include fallback messages for unexpected errors

### Workflow-Specific Guidelines

#### Coupon Capture Workflow
- Use "Coupon Awarded" templates
- Include error handling for invalid/expired tokens
- Implement deduplication before sending messages

#### Claim Redemption Workflow
- Use "Redemption Success" or "Insufficient Coupons" templates
- Send staff notification on successful claim
- Handle idempotency (return existing redemption ID)

#### Balance Check Workflow
- Use "Balance Check" templates
- Handle case where wallet doesn't exist
- No rate limiting needed for balance checks

#### Opt-Out Workflow
- Use "Opt-Out Confirmation" template
- Simple confirmation message, no complex logic needed

### Testing Messages

Test all message templates with:
- Different balance values (0, 1, 2, 3, 4, 5+)
- Various error scenarios
- Phone number masking
- Timestamp formatting in Istanbul timezone

### Localization Best Practices

1. **Consistency**: Use the same emoji and formatting across all messages
2. **Clarity**: Keep messages concise and action-oriented
3. **Politeness**: Use formal Turkish ("siz" form) for customer messages
4. **Urgency**: Use appropriate emojis to convey message type (✅ success, ❌ error, ⏳ wait, 🔔 notification)

## Requirements Validation

This document validates the following requirements:

- **Requirement 29.1**: Coupon awarded message ✅
- **Requirement 29.2**: Balance check message ✅
- **Requirement 29.3**: Redemption success message ✅
- **Requirement 29.4**: Invalid token message ✅
- **Requirement 29.5**: Rate limit message ✅
- **Requirement 30.1**: New redemption staff notification ✅
- **Requirement 30.2**: Rejected redemption staff notification ✅
- **Requirement 30.3**: Completed redemption staff notification ✅
- **Requirement 30.4**: Suspicious activity staff notification ✅
- **Requirement 30.5**: Daily summary staff notification ✅

---

**Last Updated**: 2025-11-28  
**Status**: ✅ Complete and ready for implementation  
**Related Files**: 
- `backend/src/locales/tr/coupons.json`
- `n8n-workflows/workflows/*.json`
