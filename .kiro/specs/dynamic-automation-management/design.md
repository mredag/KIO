# Design Document

## Overview

This feature extends the existing Instagram interaction logging infrastructure to WhatsApp and creates a unified admin interface for managing all automation services. It introduces a dynamic knowledge base that replaces hardcoded business information in n8n workflows.

**Key Components:**
1. **WhatsApp Interactions Table** - Mirror of existing `instagram_interactions` schema
2. **Unified Interactions View** - SQL view combining both platforms
3. **Knowledge Base Tables** - Store dynamic business information
4. **Service Settings Table** - Control automation service states
5. **Admin Pages** - React components for management
6. **Integration APIs** - Endpoints for n8n workflows

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Panel                               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Interactions   │    Services     │      Knowledge Base         │
│    Dashboard    │    Control      │       Management            │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API                                 │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ /admin/         │ /admin/         │ /admin/knowledge-base       │
│ interactions    │ services        │ /integrations/knowledge     │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SQLite Database                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ unified_        │ service_        │ knowledge_base              │
│ interactions    │ settings        │                             │
│ (VIEW)          │                 │                             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ whatsapp_       │                 │                             │
│ interactions    │                 │                             │
├─────────────────┤                 │                             │
│ instagram_      │                 │                             │
│ interactions    │                 │                             │
│ (existing)      │                 │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
         ▲                 ▲                        ▲
         │                 │                        │
┌────────┴────────┬────────┴────────┬──────────────┴──────────────┐
│                      n8n Workflows                               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ WhatsApp        │ Instagram       │ AI Context                  │
│ Workflow        │ Workflow        │ Fetching                    │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Components and Interfaces

### Backend Services

#### KnowledgeBaseService
```typescript
interface KnowledgeEntry {
  id: string;
  category: 'services' | 'pricing' | 'hours' | 'policies' | 'contact' | 'general';
  key: string;
  value: string;
  description?: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseService {
  getAll(): KnowledgeEntry[];
  getByCategory(category: string): KnowledgeEntry[];
  getById(id: string): KnowledgeEntry | null;
  create(entry: Omit<KnowledgeEntry, 'id' | 'version' | 'createdAt' | 'updatedAt'>): KnowledgeEntry;
  update(id: string, updates: Partial<KnowledgeEntry>): KnowledgeEntry;
  delete(id: string): boolean;
  getContext(): Record<string, Record<string, string>>; // For n8n
}
```

#### ServiceControlService
```typescript
interface ServiceStatus {
  serviceName: 'whatsapp' | 'instagram';
  enabled: boolean;
  lastActivity?: string;
  messageCount24h: number;
  config?: Record<string, any>;
  updatedAt: string;
}

interface ServiceControlService {
  getAll(): ServiceStatus[];
  getStatus(serviceName: string): ServiceStatus;
  setEnabled(serviceName: string, enabled: boolean): ServiceStatus;
  updateConfig(serviceName: string, config: Record<string, any>): ServiceStatus;
}
```

#### UnifiedInteractionsService
```typescript
interface UnifiedInteraction {
  id: string;
  platform: 'whatsapp' | 'instagram';
  customerId: string; // phone or instagram_id
  direction: 'inbound' | 'outbound';
  messageText: string;
  intent?: string;
  sentiment?: string;
  aiResponse?: string;
  responseTimeMs?: number;
  createdAt: string;
}

interface InteractionFilters {
  platform?: 'whatsapp' | 'instagram' | 'all';
  startDate?: string;
  endDate?: string;
  customerId?: string;
  intent?: string;
  sentiment?: string;
  limit?: number;
  offset?: number;
}

interface UnifiedInteractionsService {
  getInteractions(filters: InteractionFilters): UnifiedInteraction[];
  getAnalytics(filters: InteractionFilters): InteractionAnalytics;
  exportCsv(filters: InteractionFilters): string;
}
```

### API Routes

#### Admin Knowledge Base Routes
```
GET    /api/admin/knowledge-base              - List all entries
GET    /api/admin/knowledge-base/:id          - Get single entry
POST   /api/admin/knowledge-base              - Create entry
PUT    /api/admin/knowledge-base/:id          - Update entry
DELETE /api/admin/knowledge-base/:id          - Delete entry
```

#### Admin Service Control Routes
```
GET    /api/admin/services                    - List all services with status
GET    /api/admin/services/:name              - Get single service status
POST   /api/admin/services/:name/toggle       - Toggle service on/off
PUT    /api/admin/services/:name/config       - Update service config
```

#### Admin Interactions Routes
```
GET    /api/admin/interactions                - List unified interactions
GET    /api/admin/interactions/analytics      - Get analytics data
GET    /api/admin/interactions/export         - Export as CSV
```

#### Integration Routes (for n8n)
```
GET    /api/integrations/knowledge/context    - Get formatted knowledge for AI
GET    /api/integrations/services/:name/status - Check if service is enabled
POST   /api/integrations/whatsapp/interaction - Log WhatsApp interaction
```

### Frontend Components

#### InteractionsPage
- Unified table with platform icons
- Filters: platform, date range, search
- Pagination
- Analytics summary cards
- Export button

#### ServicesPage
- Service cards with toggle switches
- Status indicators (active/inactive/warning)
- Last activity timestamp
- 24h message count
- Quick link to filtered interactions

#### KnowledgeBasePage
- Category tabs/accordion
- CRUD operations with inline editing
- Version history indicator
- Preview of AI context format

## Data Models

### New Database Tables

```sql
-- WhatsApp interactions (mirrors instagram_interactions)
CREATE TABLE IF NOT EXISTS whatsapp_interactions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  direction TEXT CHECK(direction IN ('inbound', 'outbound')) NOT NULL,
  message_text TEXT NOT NULL,
  intent TEXT,
  sentiment TEXT,
  ai_response TEXT,
  response_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service settings
CREATE TABLE IF NOT EXISTS service_settings (
  service_name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  config TEXT, -- JSON
  last_activity DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge base
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('services', 'pricing', 'hours', 'policies', 'contact', 'general')),
  key_name TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, key_name)
);

-- Unified interactions view
CREATE VIEW IF NOT EXISTS unified_interactions AS
SELECT 
  id,
  'whatsapp' as platform,
  phone as customer_id,
  direction,
  message_text,
  intent,
  sentiment,
  ai_response,
  response_time_ms,
  created_at
FROM whatsapp_interactions
UNION ALL
SELECT 
  id,
  'instagram' as platform,
  instagram_id as customer_id,
  direction,
  message_text,
  intent,
  sentiment,
  ai_response,
  response_time_ms,
  created_at
FROM instagram_interactions;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_phone ON whatsapp_interactions(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_created ON whatsapp_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_intent ON whatsapp_interactions(intent);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON knowledge_base(is_active);
```

### Initial Service Settings Data

```sql
INSERT OR IGNORE INTO service_settings (service_name, enabled, updated_at)
VALUES 
  ('whatsapp', 1, CURRENT_TIMESTAMP),
  ('instagram', 1, CURRENT_TIMESTAMP);
```

### Sample Knowledge Base Data

```sql
INSERT OR IGNORE INTO knowledge_base (id, category, key_name, value, description)
VALUES 
  ('kb-1', 'hours', 'weekdays', 'Pazartesi-Cumartesi 10:00-22:00', 'Hafta içi çalışma saatleri'),
  ('kb-2', 'hours', 'sunday', 'Pazar günleri kapalıyız', 'Pazar günü durumu'),
  ('kb-3', 'contact', 'phone', '+90 XXX XXX XXXX', 'Ana iletişim telefonu'),
  ('kb-4', 'contact', 'address', 'SPA Merkezi Adresi', 'Fiziksel adres'),
  ('kb-5', 'policies', 'cancellation', '24 saat önceden iptal ücretsizdir', 'İptal politikası'),
  ('kb-6', 'general', 'welcome', 'Hoş geldiniz! Size nasıl yardımcı olabilirim?', 'Karşılama mesajı');
```

## Turkish Language Support

### Frontend Localization
All admin panel text uses existing i18n infrastructure:
- Add translations to `frontend/src/locales/tr/admin.json`
- Use `useTranslation` hook in all components
- Date/time formatting uses Turkish locale (Europe/Istanbul timezone)

### Turkish Admin Labels
```json
{
  "interactions": {
    "title": "Etkileşimler",
    "platform": "Platform",
    "customer": "Müşteri",
    "direction": "Yön",
    "inbound": "Gelen",
    "outbound": "Giden",
    "message": "Mesaj",
    "intent": "Niyet",
    "sentiment": "Duygu",
    "timestamp": "Tarih/Saat",
    "filter": {
      "all": "Tümü",
      "whatsapp": "WhatsApp",
      "instagram": "Instagram",
      "dateRange": "Tarih Aralığı",
      "search": "Ara..."
    },
    "export": "Dışa Aktar",
    "analytics": {
      "total": "Toplam Mesaj",
      "uniqueCustomers": "Tekil Müşteri",
      "avgResponseTime": "Ort. Yanıt Süresi",
      "intentBreakdown": "Niyet Dağılımı",
      "sentimentBreakdown": "Duygu Dağılımı"
    }
  },
  "services": {
    "title": "Servisler",
    "whatsapp": "WhatsApp Otomasyonu",
    "instagram": "Instagram Otomasyonu",
    "enabled": "Aktif",
    "disabled": "Devre Dışı",
    "lastActivity": "Son Aktivite",
    "messages24h": "Son 24 Saat",
    "noActivity": "Aktivite yok",
    "warning": "24 saattir aktivite yok"
  },
  "knowledgeBase": {
    "title": "Bilgi Bankası",
    "categories": {
      "services": "Hizmetler",
      "pricing": "Fiyatlar",
      "hours": "Çalışma Saatleri",
      "policies": "Politikalar",
      "contact": "İletişim",
      "general": "Genel"
    },
    "key": "Anahtar",
    "value": "Değer",
    "description": "Açıklama",
    "version": "Versiyon",
    "actions": {
      "add": "Yeni Ekle",
      "edit": "Düzenle",
      "delete": "Sil",
      "save": "Kaydet",
      "cancel": "İptal"
    },
    "empty": "Bu kategoride henüz kayıt yok",
    "confirmDelete": "Bu kaydı silmek istediğinizden emin misiniz?"
  }
}
```

### Knowledge Base Content
- All knowledge base values stored in Turkish
- AI workflows receive Turkish context for Turkish responses
- Category names displayed in Turkish in admin panel

### Date/Time Formatting
- Use `Europe/Istanbul` timezone for all timestamps
- Display format: `DD.MM.YYYY HH:mm` (Turkish standard)
- Relative time: "5 dakika önce", "2 saat önce"

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unified interactions contain all platform data
*For any* set of WhatsApp and Instagram interactions in the database, the unified view SHALL return all interactions from both platforms with correct platform identifiers.
**Validates: Requirements 1.1, 8.3**

### Property 2: Platform filter returns only matching platform
*For any* platform filter value ('whatsapp' or 'instagram'), the filtered results SHALL contain only interactions from that specific platform.
**Validates: Requirements 1.3**

### Property 3: Date range filter returns only matching dates
*For any* date range filter, all returned interactions SHALL have timestamps within the specified range (inclusive).
**Validates: Requirements 1.4**

### Property 4: Service toggle updates database state
*For any* service toggle operation, the database state SHALL reflect the new enabled/disabled value, and subsequent status queries SHALL return the updated state.
**Validates: Requirements 2.2, 2.3, 2.4**

### Property 5: Knowledge base CRUD operations persist correctly
*For any* knowledge entry created, the entry SHALL be retrievable with all original fields. *For any* update, the version SHALL increment by 1. *For any* delete, the entry SHALL no longer be retrievable.
**Validates: Requirements 3.2, 3.3, 3.4**

### Property 6: Knowledge context excludes inactive entries
*For any* knowledge context request, the response SHALL contain only entries where is_active = true.
**Validates: Requirements 7.3**

### Property 7: Knowledge context groups by category
*For any* knowledge context request, the response SHALL be a nested object with category keys containing their respective entries.
**Validates: Requirements 7.1, 7.2**

### Property 8: WhatsApp interaction logging stores all fields
*For any* WhatsApp interaction logged, all provided fields (phone, direction, message_text, intent, sentiment) SHALL be stored and retrievable.
**Validates: Requirements 8.1, 8.2**

### Property 9: Analytics calculations are accurate
*For any* set of interactions, the analytics SHALL correctly calculate total count, unique customers, and average response time.
**Validates: Requirements 5.1**

### Property 10: CSV export contains all required columns
*For any* export operation, the CSV SHALL contain columns for platform, customer_id, direction, message_text, intent, sentiment, and created_at.
**Validates: Requirements 6.2**

## Error Handling

### API Errors
- **400 Bad Request**: Invalid filter parameters, missing required fields
- **404 Not Found**: Knowledge entry or service not found
- **500 Internal Server Error**: Database errors, unexpected failures

### Service Control Errors
- Log all toggle operations to system_logs
- Return previous state on toggle failure
- Graceful degradation if n8n cannot be reached

### Knowledge Base Errors
- Validate category against allowed values
- Enforce unique constraint on (category, key_name)
- Return validation errors with field-specific messages

## Testing Strategy

### Dual Testing Approach

**Unit Tests:**
- Service method tests with mocked database
- API route tests with supertest
- Validation logic tests

**Property-Based Tests:**
- Use fast-check library for TypeScript
- Minimum 100 iterations per property
- Test data generators for interactions, knowledge entries, and filters

### Property-Based Testing Framework
- **Library**: fast-check
- **Location**: `backend/src/services/*.property.test.ts`
- **Annotation Format**: `// **Feature: dynamic-automation-management, Property N: description**`

### Test Categories

1. **Database Layer Tests**
   - Unified view returns correct data
   - CRUD operations work correctly
   - Indexes improve query performance

2. **Service Layer Tests**
   - Filter logic works correctly
   - Analytics calculations are accurate
   - Context formatting is correct

3. **API Layer Tests**
   - Routes return correct status codes
   - Authentication is enforced
   - Response formats match specifications

4. **Integration Tests**
   - n8n can fetch knowledge context
   - Service status affects workflow behavior
   - Interactions are logged from both platforms
