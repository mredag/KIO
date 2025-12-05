# Implementation Plan

- [x] 1. Database Schema Extensions






  - [x] 1.1 Create WhatsApp interactions table

    - Add `whatsapp_interactions` table mirroring `instagram_interactions` schema
    - Add indexes for phone, created_at, intent
    - _Requirements: 8.1, 8.2_

  - [x] 1.2 Create service settings table

    - Add `service_settings` table with service_name, enabled, config, last_activity
    - Insert default rows for 'whatsapp' and 'instagram'

    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 Create knowledge base table
    - Add `knowledge_base` table with category, key_name, value, description, is_active, version
    - Add unique constraint on (category, key_name)
    - Add indexes for category and is_active
    - _Requirements: 3.1, 3.2, 4.1_
  - [x] 1.4 Create unified interactions view
    - Create SQL view combining whatsapp_interactions and instagram_interactions
    - Include platform identifier column
    - _Requirements: 1.1, 8.3_
  - [ ]* 1.5 Write property test for unified view
    - **Property 1: Unified interactions contain all platform data**
    - **Validates: Requirements 1.1, 8.3**

- [x] 2. Backend Services





  - [x] 2.1 Create KnowledgeBaseService

    - Implement getAll, getByCategory, getById, create, update, delete methods
    - Implement getContext method for n8n integration
    - Handle version increment on updates
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3_
  - [ ]* 2.2 Write property tests for KnowledgeBaseService
    - **Property 5: Knowledge base CRUD operations persist correctly**
    - **Property 6: Knowledge context excludes inactive entries**
    - **Property 7: Knowledge context groups by category**
    - **Validates: Requirements 3.2, 3.3, 3.4, 7.1, 7.2, 7.3**
  - [x] 2.3 Create ServiceControlService

    - Implement getAll, getStatus, setEnabled, updateConfig methods
    - Calculate messageCount24h from interactions tables
    - Track lastActivity from most recent interaction
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1, 9.2_
  - [ ]* 2.4 Write property test for ServiceControlService
    - **Property 4: Service toggle updates database state**
    - **Validates: Requirements 2.2, 2.3, 2.4**
  - [x] 2.5 Create UnifiedInteractionsService

    - Implement getInteractions with filters (platform, dateRange, customerId)
    - Implement getAnalytics for summary statistics
    - Implement exportCsv for data export
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 5.1, 6.1, 6.2_
  - [ ]* 2.6 Write property tests for UnifiedInteractionsService
    - **Property 2: Platform filter returns only matching platform**
    - **Property 3: Date range filter returns only matching dates**
    - **Property 9: Analytics calculations are accurate**
    - **Property 10: CSV export contains all required columns**
    - **Validates: Requirements 1.3, 1.4, 5.1, 6.2**


- [x] 3. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.


- [x] 4. Backend API Routes




  - [x] 4.1 Create admin knowledge base routes


    - GET /api/admin/knowledge-base - list all entries
    - GET /api/admin/knowledge-base/:id - get single entry
    - POST /api/admin/knowledge-base - create entry
    - PUT /api/admin/knowledge-base/:id - update entry
    - DELETE /api/admin/knowledge-base/:id - delete entry
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Create admin service control routes


    - GET /api/admin/services - list all services with status
    - GET /api/admin/services/:name - get single service status
    - POST /api/admin/services/:name/toggle - toggle service on/off
    - _Requirements: 2.1, 2.2, 2.3, 9.1, 9.2_
  - [x] 4.3 Create admin interactions routes


    - GET /api/admin/interactions - list unified interactions with filters
    - GET /api/admin/interactions/analytics - get analytics data
    - GET /api/admin/interactions/export - export as CSV
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_
  - [x] 4.4 Create integration routes for n8n


    - GET /api/integrations/knowledge/context - get formatted knowledge for AI
    - GET /api/integrations/services/:name/status - check if service is enabled
    - POST /api/integrations/whatsapp/interaction - log WhatsApp interaction
    - _Requirements: 7.1, 7.2, 7.3, 2.4, 2.5, 8.1_
  - [ ]* 4.5 Write property test for WhatsApp interaction logging
    - **Property 8: WhatsApp interaction logging stores all fields**
    - **Validates: Requirements 8.1, 8.2**


- [x] 5. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.


- [x] 6. Frontend Turkish Translations




  - [x] 6.1 Add Turkish translations for interactions page


    - Add translations to frontend/src/locales/tr/admin.json
    - Include all labels, filters, and analytics terms
    - _Requirements: Turkish language support_
  - [x] 6.2 Add Turkish translations for services page


    - Add service names, status labels, and warning messages
    - _Requirements: Turkish language support_
  - [x] 6.3 Add Turkish translations for knowledge base page


    - Add category names, action buttons, and form labels
    - _Requirements: Turkish language support_


- [ ] 7. Frontend Admin Pages




  - [x] 7.1 Create InteractionsPage component


    - Display unified interactions table with platform icons
    - Implement platform, date range, and search filters
    - Add pagination
    - Display analytics summary cards
    - Add export button
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 6.1_
  - [x] 7.2 Create ServicesPage component


    - Display service cards with toggle switches
    - Show status indicators (active/inactive/warning)
    - Display last activity timestamp and 24h message count
    - Add quick link to filtered interactions
    - _Requirements: 2.1, 9.1, 9.2, 9.3, 9.4_
  - [x] 7.3 Create KnowledgeBasePage component


    - Display entries grouped by category with collapsible sections
    - Implement create, edit, delete operations
    - Show version number for each entry
    - Add preview of AI context format
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4_
  - [x] 7.4 Add routes and navigation


    - Add routes to App.tsx for new pages
    - Add navigation items to admin sidebar
    - _Requirements: All frontend requirements_


- [ ] 8. Frontend API Hooks



  - [x] 8.1 Create useKnowledgeBase hook

    - Implement CRUD operations with React Query
    - Handle loading and error states
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 8.2 Create useServiceControl hook

    - Implement service status fetching and toggle
    - Handle optimistic updates
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 8.3 Create useUnifiedInteractions hook

    - Implement interactions fetching with filters
    - Implement analytics fetching
    - Handle export functionality
    - _Requirements: 1.1, 1.3, 1.4, 5.1, 6.1_


- [x] 9. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.


- [x] 10. n8n Workflow Updates




  - [x] 10.1 Update WhatsApp workflow to check service status


    - Add HTTP node to check /api/integrations/services/whatsapp/status
    - Add conditional to skip processing if disabled
    - Return maintenance message when disabled
    - _Requirements: 2.4, 2.5_
  - [x] 10.2 Update WhatsApp workflow to log interactions

    - Add HTTP node to POST /api/integrations/whatsapp/interaction
    - Log inbound and outbound messages with intent/sentiment
    - _Requirements: 8.1_
  - [x] 10.3 Update WhatsApp workflow to use dynamic knowledge

    - Add HTTP node to GET /api/integrations/knowledge/context
    - Replace hardcoded system prompt with dynamic context
    - _Requirements: 7.1, 7.2_
  - [x] 10.4 Update Instagram workflow to check service status


    - Add HTTP node to check /api/integrations/services/instagram/status
    - Add conditional to skip processing if disabled
    - _Requirements: 2.4, 2.5_
  - [x] 10.5 Update Instagram workflow to use dynamic knowledge

    - Add HTTP node to GET /api/integrations/knowledge/context
    - Replace hardcoded system prompt with dynamic context
    - _Requirements: 7.1, 7.2_



- [ ] 11. Seed Initial Knowledge Base Data


  - [x] 11.1 Create seed script for knowledge base

    - Add sample entries for all categories
    - Include Turkish content for services, pricing, hours, policies, contact
    - _Requirements: 3.1, Turkish language support_

- [ ] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
