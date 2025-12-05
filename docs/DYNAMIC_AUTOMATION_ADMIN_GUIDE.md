# Dynamic Automation Management - Admin Panel Guide

## Overview

The Dynamic Automation Management feature provides three new admin pages to manage your WhatsApp and Instagram automation workflows without touching n8n directly.

## Accessing the Features

### From the Admin Panel Sidebar

Look for the **"Otomasyon" (Automation)** section in the left sidebar. You'll find three new menu items:

1. **Etkileşimler (Interactions)** - `/admin/interactions`
2. **Servisler (Services)** - `/admin/services`
3. **Bilgi Bankası (Knowledge Base)** - `/admin/knowledge-base`

---

## 1. Etkileşimler (Interactions Page)

**URL:** `http://192.168.1.5:3001/admin/interactions`

### What It Does
View all customer messages from WhatsApp and Instagram in one unified dashboard.

### Features
- **Unified View**: See all WhatsApp and Instagram messages together
- **Platform Filter**: Filter by WhatsApp, Instagram, or view all
- **Date Range Filter**: View messages from specific time periods
- **Search**: Search by customer phone number or Instagram ID
- **Analytics Cards**: 
  - Total messages
  - Unique customers
  - Average response time
  - Intent breakdown (pricing, hours, booking, etc.)
  - Sentiment analysis (positive, neutral, negative)
- **Export**: Download interactions as CSV for analysis

### How to Use
1. Navigate to **Otomasyon → Etkileşimler**
2. Use filters to narrow down the data:
   - Select platform (Tümü/WhatsApp/Instagram)
   - Choose date range
   - Search by customer ID
3. View analytics summary at the top
4. Click **Dışa Aktar** to export data

---

## 2. Servisler (Services Page)

**URL:** `http://192.168.1.5:3001/admin/services`

### What It Does
Control which automation services (WhatsApp/Instagram) are active without accessing n8n.

### Features
- **Service Cards**: Visual cards for each service
- **Toggle On/Off**: Enable or disable services with one click
- **Status Indicators**:
  - 🟢 **Aktif** (Active): Service is running
  - 🔴 **Devre Dışı** (Disabled): Service is stopped
  - ⚠️ **Uyarı** (Warning): No activity in 24 hours
- **Activity Stats**:
  - Last activity timestamp
  - Message count in last 24 hours
- **Quick Links**: Jump to filtered interactions for each service

### How to Use
1. Navigate to **Otomasyon → Servisler**
2. View current status of WhatsApp and Instagram services
3. Toggle services on/off:
   - Click the switch to disable a service
   - When disabled, n8n workflows will skip processing and return maintenance message
4. Monitor activity:
   - Check "Son Aktivite" for last message time
   - Check "Son 24 Saat" for recent message count
   - Yellow warning appears if no activity in 24 hours

### Use Cases
- **Maintenance Mode**: Disable services during system maintenance
- **Testing**: Turn off production while testing new workflows
- **Troubleshooting**: Temporarily disable problematic service
- **Monitoring**: Check if services are receiving messages

---

## 3. Bilgi Bankası (Knowledge Base Page)

**URL:** `http://192.168.1.5:3001/admin/knowledge-base`

### What It Does
Manage dynamic business information that AI workflows use to generate responses. No more hardcoded data in n8n!

### Features
- **Category Organization**: Entries grouped by category
  - **Hizmetler** (Services): Massage types, spa facilities, packages
  - **Fiyatlar** (Pricing): Service prices
  - **Çalışma Saatleri** (Hours): Opening hours, holidays
  - **Politikalar** (Policies): Cancellation, payment, age requirements
  - **İletişim** (Contact): Phone, email, address, social media
  - **Genel** (General): Welcome message, parking, WiFi, loyalty program
- **CRUD Operations**:
  - ➕ **Yeni Ekle**: Create new entries
  - ✏️ **Düzenle**: Edit existing entries
  - 🗑️ **Sil**: Delete entries
- **Version Tracking**: Each update increments version number
- **Active/Inactive**: Toggle entries on/off without deleting
- **AI Context Preview**: See how data appears to n8n workflows

### How to Use

#### View Entries
1. Navigate to **Otomasyon → Bilgi Bankası**
2. Browse entries by category (collapsible sections)
3. Each entry shows:
   - Key name
   - Value (Turkish content)
   - Description
   - Version number

#### Add New Entry
1. Click **Yeni Ekle** button
2. Fill in the form:
   - **Kategori**: Select category
   - **Anahtar**: Unique key name (e.g., `massage_120min`)
   - **Değer**: The actual content (e.g., `900 TL - 120 dakikalık masaj`)
   - **Açıklama**: Optional description
3. Click **Kaydet**

#### Edit Entry
1. Click **Düzenle** button on any entry
2. Modify the value or other fields
3. Click **Kaydet**
4. Version number automatically increments

#### Delete Entry
1. Click **Sil** button on any entry
2. Confirm deletion
3. Entry is permanently removed

#### Preview AI Context
1. Scroll to bottom of page
2. View **AI Context Format** section
3. See exactly how n8n workflows receive the data

### Current Seeded Data (26 Entries)

#### Services (3)
- `massage_types`: İsveç masajı, derin doku masajı, aromaterapi masajı, sıcak taş masajı, refleksoloji
- `spa_facilities`: Sauna, buhar odası, jakuzi, dinlenme alanı, soyunma odaları
- `special_packages`: Çift masajı paketi, gün spa paketi, romantik paket, detoks paketi

#### Pricing (4)
- `massage_60min`: 500 TL - 60 dakikalık masaj seansı
- `massage_90min`: 700 TL - 90 dakikalık masaj seansı
- `couple_package`: 1.800 TL - Çift masajı paketi (2 kişi, 90 dakika)
- `day_spa`: 1.200 TL - Gün spa paketi (masaj + sauna + jakuzi)

#### Hours (4)
- `weekdays`: Pazartesi-Cumartesi: 10:00-22:00
- `sunday`: Pazar: 11:00-20:00
- `holidays`: Resmi tatil günlerinde kapalıyız
- `last_appointment`: Son randevu kapanıştan 1 saat önce

#### Policies (5)
- `cancellation`: 24 saat önceden iptal ücretsizdir. Daha geç iptallerde %50 ücret alınır.
- `late_arrival`: 15 dakikadan fazla geç kalınırsa seans süresi kısalır
- `payment_methods`: Nakit, kredi kartı, banka kartı kabul edilir
- `age_requirement`: 18 yaş altı müşteriler veli eşliğinde kabul edilir
- `health_conditions`: Hamilelik, kalp rahatsızlığı veya cilt hastalığı varsa lütfen önceden bildiriniz

#### Contact (5)
- `phone`: +90 XXX XXX XXXX
- `whatsapp`: +90 XXX XXX XXXX
- `email`: info@spa-merkezi.com
- `address`: Örnek Mahallesi, Spa Sokak No:1, İstanbul
- `instagram`: @spa_merkezi

#### General (5)
- `welcome_message`: Hoş geldiniz! Size nasıl yardımcı olabilirim?
- `parking`: Ücretsiz otopark mevcuttur
- `wifi`: Ücretsiz WiFi: SPA_Guest / Şifre: welcome2024
- `loyalty_program`: Her 4 masajda 1 masaj ücretsiz! Kupon sistemi hakkında bilgi için resepsiyona sorunuz.
- `gift_certificates`: Hediye çekleri mevcuttur. Sevdiklerinize özel bir hediye!

---

## Integration with n8n Workflows

### How It Works
1. **Admin updates knowledge base** → Changes saved to database
2. **n8n workflow runs** → Calls `/api/integrations/knowledge/context`
3. **AI receives fresh data** → Generates responses with current information
4. **Customer gets accurate info** → No outdated prices or hours!

### API Endpoint for n8n
```
GET /api/integrations/knowledge/context
Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=
```

### Response Format
```json
{
  "services": {
    "massage_types": "İsveç masajı, derin doku masajı...",
    "spa_facilities": "Sauna, buhar odası..."
  },
  "pricing": {
    "massage_60min": "500 TL - 60 dakikalık masaj seansı"
  },
  "hours": {
    "weekdays": "Pazartesi-Cumartesi: 10:00-22:00"
  },
  ...
}
```

---

## Common Use Cases

### Scenario 1: Update Prices
1. Go to **Bilgi Bankası**
2. Find pricing entries
3. Click **Düzenle** on `massage_60min`
4. Change value to new price
5. Click **Kaydet**
6. ✅ Next customer inquiry gets new price automatically!

### Scenario 2: Change Hours for Holiday
1. Go to **Bilgi Bankası**
2. Find `hours` category
3. Edit `holidays` entry
4. Update with specific holiday hours
5. ✅ AI tells customers correct holiday hours

### Scenario 3: Disable Service for Maintenance
1. Go to **Servisler**
2. Toggle WhatsApp service **OFF**
3. ✅ Customers get maintenance message
4. After maintenance, toggle back **ON**

### Scenario 4: Monitor Customer Interactions
1. Go to **Etkileşimler**
2. Filter by last 7 days
3. Check intent breakdown
4. See what customers are asking about most
5. ✅ Adjust knowledge base based on common questions

### Scenario 5: Export for Marketing Analysis
1. Go to **Etkileşimler**
2. Set date range for campaign period
3. Click **Dışa Aktar**
4. Open CSV in Excel/Sheets
5. ✅ Analyze customer engagement and sentiment

---

## Tips & Best Practices

### Knowledge Base
- ✅ **Keep values concise** - AI works better with clear, short answers
- ✅ **Use Turkish** - All content should be in Turkish for Turkish customers
- ✅ **Update regularly** - Keep prices and hours current
- ✅ **Test changes** - Send test message to WhatsApp after updates
- ❌ **Don't delete core entries** - Edit instead of deleting
- ❌ **Don't use special characters** - Stick to Turkish letters and basic punctuation

### Services
- ✅ **Monitor activity** - Check daily for warnings
- ✅ **Disable during testing** - Prevent customers from getting test responses
- ✅ **Re-enable after fixes** - Don't forget to turn back on!
- ❌ **Don't leave disabled** - Customers won't get responses

### Interactions
- ✅ **Review weekly** - Check for common questions
- ✅ **Export monthly** - Keep records for analysis
- ✅ **Watch sentiment** - Address negative feedback quickly
- ✅ **Track intents** - See what customers care about

---

## Troubleshooting

### "Knowledge base not loading"
- Check if backend is running: `pm2 status`
- Verify database has entries: `sqlite3 ~/spa-kiosk/backend/data/kiosk.db "SELECT COUNT(*) FROM knowledge_base"`
- Should show: `26`

### "Services page shows no data"
- Check database: `sqlite3 ~/spa-kiosk/backend/data/kiosk.db "SELECT * FROM service_settings"`
- Should show WhatsApp and Instagram entries

### "Interactions page is empty"
- This is normal if no messages yet
- Send test WhatsApp message to populate
- Check n8n workflows are active

### "Changes not reflected in AI responses"
- Wait 1-2 minutes for n8n to fetch new context
- Check service is enabled in Services page
- Verify n8n workflow is active

---

## Quick Reference

| Page | URL | Purpose |
|------|-----|---------|
| Interactions | `/admin/interactions` | View all customer messages |
| Services | `/admin/services` | Enable/disable automation |
| Knowledge Base | `/admin/knowledge-base` | Manage AI response data |

| Action | Location | Result |
|--------|----------|--------|
| Update price | Knowledge Base → Pricing | AI uses new price |
| Change hours | Knowledge Base → Hours | AI tells new hours |
| Disable service | Services → Toggle OFF | Customers get maintenance msg |
| Export data | Interactions → Export | Download CSV file |

---

## Support

For issues or questions:
1. Check this guide first
2. Review n8n workflow logs
3. Check PM2 backend logs: `pm2 logs kiosk-backend`
4. Verify database integrity

---

**Last Updated:** 2025-12-05  
**Version:** 1.0  
**Status:** ✅ Production Ready
