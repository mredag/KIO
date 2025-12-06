# AI System Prompts Feature - Implementation Summary

## Status: ✅ COMPLETE

The dynamic AI system prompts feature has been successfully implemented and tested.

---

## What Was Implemented

### 1. Database Schema
- **Table**: `ai_system_prompts`
- **Fields**: id, name, description, system_message, workflow_type, is_active, version, created_at, updated_at
- **Indexes**: workflow_type, is_active, name
- **Location**: `backend/src/database/schema.sql`

### 2. Backend API Routes

#### Admin Routes (`/api/admin/ai-prompts`)
- `GET /` - List all prompts
- `GET /:id` - Get single prompt by ID
- `GET /active/:workflowType` - Get active prompts by workflow type
- `GET /by-name/:name` - Get prompt by name
- `POST /` - Create new prompt
- `PUT /:id` - Update prompt
- `DELETE /:id` - Delete prompt

#### Integration Routes (`/api/integrations/ai`)
- `GET /prompt/:name` - Get system message by name (for n8n workflows)
- `GET /prompts/:workflowType` - List prompts by workflow type

**Files Created**:
- `backend/src/routes/aiPromptsRoutes.ts`
- `backend/src/routes/integrationAIPromptsRoutes.ts`

### 3. Frontend Admin Panel

**Page**: `/admin/ai-prompts`

**Features**:
- List all AI prompts with workflow type badges
- Create/Edit/Delete prompts
- Copy prompt names for use in n8n
- Active/Inactive toggle
- Version tracking
- Large textarea for system messages
- Workflow type selector (WhatsApp, Instagram, General)

**Files Created**:
- `frontend/src/pages/admin/AIPromptsPage.tsx`
- `frontend/src/hooks/useAIPromptsApi.ts`

### 4. Database Seeding

**Default Prompts** (3 total):
1. `whatsapp-coupon-assistant` - WhatsApp kupon sistemi için AI asistan
2. `instagram-spa-assistant` - Instagram DM için SPA asistan
3. `general-customer-service` - Genel müşteri hizmetleri

**Location**: `backend/src/database/seed.ts`

### 5. Database Migration

Added migration logic to create `ai_system_prompts` table for existing installations.

**Location**: `backend/src/database/init.ts`

---

## How to Use

### In Admin Panel

1. Navigate to **Admin Panel** → **AI Promptları**
2. Click **"Yeni Prompt"** to create a new prompt
3. Fill in:
   - **İsim**: Unique name (e.g., `my-custom-prompt`)
   - **Açıklama**: Description for reference
   - **Workflow Tipi**: Select WhatsApp/Instagram/General
   - **System Message**: Your AI prompt text
   - **Aktif**: Check to enable
4. Click **"Oluştur"**
5. **Copy the name** using the copy button next to the prompt name

### In n8n Workflows

#### Method 1: HTTP Request Node (Recommended)

Add an HTTP Request node before your AI Agent:

```json
{
  "name": "Fetch AI Prompt",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "http://localhost:3001/api/integrations/ai/prompt/my-custom-prompt"
  }
}
```

Then in your AI Agent node:
```
System Message: {{ $json.systemMessage }}
```

#### Method 2: Direct Expression

In the AI Agent node's system message field:
```
={{ $httpRequest('http://localhost:3001/api/integrations/ai/prompt/my-custom-prompt').systemMessage }}
```

---

## API Response Format

### GET `/api/integrations/ai/prompt/:name`

**Success**:
```json
{
  "systemMessage": "Sen bir SPA kupon sistemi asistanısın...",
  "workflowType": "whatsapp",
  "version": 3,
  "updatedAt": "2025-12-06T10:30:00.000Z"
}
```

**Error (Not Found)**:
```json
{
  "error": "Prompt not found or inactive",
  "fallback": "You are a helpful AI assistant."
}
```

---

## Testing

### Backend API Test
```bash
curl http://localhost:3001/api/integrations/ai/prompt/whatsapp-coupon-assistant
```

### Database Verification
```bash
node check-db.js
```

### Frontend Test
1. Start servers: `npm run dev`
2. Navigate to: `http://localhost:3000/admin/ai-prompts`
3. Verify prompts are listed
4. Create a test prompt
5. Edit and verify version increments
6. Delete test prompt

---

## Files Modified/Created

### Backend
- ✅ `backend/src/database/schema.sql` - Added table
- ✅ `backend/src/database/seed.ts` - Added seeding
- ✅ `backend/src/database/init.ts` - Added migration
- ✅ `backend/src/routes/aiPromptsRoutes.ts` - New file
- ✅ `backend/src/routes/integrationAIPromptsRoutes.ts` - New file
- ✅ `backend/src/index.ts` - Registered routes

### Frontend
- ✅ `frontend/src/hooks/useAIPromptsApi.ts` - New file
- ✅ `frontend/src/pages/admin/AIPromptsPage.tsx` - New file
- ✅ `frontend/src/routes/lazyRoutes.tsx` - Added route
- ✅ `frontend/src/App.tsx` - Added route
- ✅ `frontend/src/components/admin/Sidebar.tsx` - Added menu item
- ✅ `frontend/src/locales/tr/admin.json` - Translation exists

### Documentation
- ✅ `n8n-workflows/AI_PROMPTS_SYSTEM.md` - Full documentation

---

## Benefits

### Before (Hardcoded Prompts)
❌ Edit workflow JSON files manually  
❌ Redeploy workflows after changes  
❌ No version history  
❌ Difficult to test different prompts  
❌ No central management  

### After (Dynamic Prompts)
✅ Edit prompts in admin panel  
✅ Changes apply immediately (no redeploy)  
✅ Version tracking built-in  
✅ Easy A/B testing  
✅ Central management for all workflows  

---

## Next Steps

### To Deploy to Raspberry Pi

1. **Build backend**:
   ```bash
   cd backend
   npm run build
   ```

2. **Copy to Pi**:
   ```bash
   scp -r dist eform-kio@192.168.1.5:~/spa-kiosk/backend/
   ```

3. **Restart backend**:
   ```bash
   ssh eform-kio@192.168.1.5 "pm2 restart kiosk-backend"
   ```

4. **Update n8n workflows** to use dynamic prompts:
   - Add HTTP Request node to fetch prompt
   - Update AI Agent to use `{{ $json.systemMessage }}`
   - Import updated workflow
   - Restart n8n: `sudo systemctl restart n8n`

---

## Troubleshooting

### Prompt Not Found
**Error**: `Prompt not found or inactive`  
**Solution**: Check prompt name spelling and ensure `is_active = 1`

### Empty System Message
**Error**: AI Agent receives empty prompt  
**Solution**: Verify HTTP Request node is connected before AI Agent

### Changes Not Applied
**Issue**: Edited prompt but workflow uses old version  
**Solution**: n8n caches responses - restart n8n or wait 5 minutes

---

## Testing Results

✅ Backend API endpoints working  
✅ Database table created and seeded  
✅ Frontend admin panel accessible  
✅ CRUD operations functional  
✅ Integration endpoint returns correct data  
✅ Version tracking working  
✅ Active/Inactive toggle working  

---

**Implementation Date**: 2025-12-06  
**Status**: Production Ready  
**Tested**: ✅ Local Development Environment  
**Next**: Deploy to Raspberry Pi and update n8n workflows
