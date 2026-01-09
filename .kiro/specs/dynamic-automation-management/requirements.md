# Requirements Document

## Introduction

This feature transforms the current hardcoded n8n automation workflows into a dynamic, admin-managed system. It provides a centralized admin panel for managing all customer interactions (WhatsApp + Instagram), controlling automation services, and maintaining a dynamic knowledge base that feeds AI-powered workflows. This eliminates the need to modify workflow JSON files when business information changes.

**Existing Infrastructure:**
- `instagram_interactions` table already stores Instagram DM interactions with intent/sentiment
- `instagram_customers` table tracks Instagram customer data
- `instagramIntegrationRoutes.ts` provides API for logging and analytics
- WhatsApp has `whatsapp_processed_messages` for deduplication but lacks full interaction logging

This spec extends the existing Instagram pattern to WhatsApp and creates a unified admin interface.

## Glossary

- **Knowledge Base**: A database-driven collection of business information (services, pricing, hours, policies) that AI workflows use to generate responses
- **Unified Interactions**: Combined view of all customer messages from WhatsApp and Instagram platforms using existing `instagram_interactions` table pattern
- **Service Control**: Admin ability to enable/disable automation workflows without accessing n8n directly
- **Dynamic Context**: Real-time business data fetched by n8n workflows from the backend API
- **Platform**: Communication channel (WhatsApp or Instagram)

## Requirements

### Requirement 1

**User Story:** As an admin, I want to view all customer interactions from WhatsApp and Instagram in one place, so that I can monitor customer communications and identify trends.

#### Acceptance Criteria

1. WHEN an admin navigates to the Interactions page THEN the System SHALL display a unified list of all WhatsApp and Instagram messages sorted by timestamp
2. WHEN viewing interactions THEN the System SHALL show platform icon, customer identifier, message direction, message text, intent, sentiment, and timestamp for each interaction
3. WHEN an admin filters by platform THEN the System SHALL display only interactions from the selected platform (WhatsApp, Instagram, or All)
4. WHEN an admin filters by date range THEN the System SHALL display only interactions within the specified date range
5. WHEN an admin searches by customer identifier THEN the System SHALL display only interactions matching the phone number or Instagram ID

### Requirement 2

**User Story:** As an admin, I want to control which automation services are active, so that I can temporarily disable WhatsApp or Instagram workflows when needed.

#### Acceptance Criteria

1. WHEN an admin views the Services page THEN the System SHALL display the current status (enabled/disabled) of each automation service
2. WHEN an admin toggles a service off THEN the System SHALL update the service status in the database and return the new status
3. WHEN an admin toggles a service on THEN the System SHALL update the service status in the database and return the new status
4. WHEN n8n workflow requests service status THEN the System SHALL return the current enabled/disabled state from the database
5. WHEN a service is disabled THEN the n8n workflow SHALL skip processing and return a maintenance message

### Requirement 3

**User Story:** As an admin, I want to manage a knowledge base of business information, so that AI workflows can use current data without code changes.

#### Acceptance Criteria

1. WHEN an admin views the Knowledge Base page THEN the System SHALL display all knowledge entries grouped by category
2. WHEN an admin creates a new knowledge entry THEN the System SHALL store the category, key, value, and description in the database
3. WHEN an admin updates a knowledge entry THEN the System SHALL update the value and increment the version number
4. WHEN an admin deletes a knowledge entry THEN the System SHALL remove the entry from the database
5. WHEN n8n workflow requests knowledge context THEN the System SHALL return all active knowledge entries formatted for AI consumption

### Requirement 4

**User Story:** As an admin, I want to organize knowledge entries by category, so that I can easily find and manage related information.

#### Acceptance Criteria

1. WHEN creating a knowledge entry THEN the System SHALL require selection of a category (services, pricing, hours, policies, contact, general)
2. WHEN viewing knowledge entries THEN the System SHALL group entries by category with collapsible sections
3. WHEN filtering by category THEN the System SHALL display only entries in the selected category
4. WHEN a category has no entries THEN the System SHALL display an empty state with option to add first entry

### Requirement 5

**User Story:** As an admin, I want to see interaction analytics across platforms, so that I can understand customer engagement patterns.

#### Acceptance Criteria

1. WHEN viewing the Interactions Analytics section THEN the System SHALL display total message count, unique customers, and average response time
2. WHEN viewing intent breakdown THEN the System SHALL display a chart showing distribution of detected intents
3. WHEN viewing sentiment breakdown THEN the System SHALL display a chart showing positive, neutral, and negative sentiment percentages
4. WHEN viewing daily trends THEN the System SHALL display a line chart of interactions over the past 30 days

### Requirement 6

**User Story:** As an admin, I want to export interaction data, so that I can analyze it in external tools or share with stakeholders.

#### Acceptance Criteria

1. WHEN an admin clicks export THEN the System SHALL generate a CSV file with all filtered interactions
2. WHEN exporting THEN the System SHALL include columns for platform, customer ID, direction, message, intent, sentiment, and timestamp
3. WHEN export completes THEN the System SHALL trigger a file download in the browser

### Requirement 7

**User Story:** As a developer, I want n8n workflows to fetch dynamic knowledge context, so that AI responses use current business information.

#### Acceptance Criteria

1. WHEN n8n workflow calls the knowledge context API THEN the System SHALL return all active knowledge entries as a structured JSON object
2. WHEN knowledge context is requested THEN the System SHALL format entries by category for easy AI prompt construction
3. WHEN a knowledge entry is inactive THEN the System SHALL exclude it from the context response
4. WHEN the API is called THEN the System SHALL respond within 200ms for optimal workflow performance

### Requirement 8

**User Story:** As a developer, I want to log WhatsApp interactions similar to Instagram, so that all platform interactions are tracked consistently.

#### Acceptance Criteria

1. WHEN a WhatsApp message is processed THEN the System SHALL store the interaction with phone, direction, message text, intent, and sentiment
2. WHEN logging a WhatsApp interaction THEN the System SHALL use the same schema pattern as existing `instagram_interactions` table
3. WHEN querying unified interactions THEN the System SHALL combine WhatsApp and Instagram data using a database view
4. WHEN the WhatsApp integration API is called THEN the System SHALL follow the same patterns as existing `instagramIntegrationRoutes.ts`

### Requirement 9

**User Story:** As an admin, I want to see service health status, so that I can quickly identify if automation workflows are functioning correctly.

#### Acceptance Criteria

1. WHEN viewing the Services page THEN the System SHALL display last activity timestamp for each service
2. WHEN viewing the Services page THEN the System SHALL display message count in the last 24 hours for each service
3. WHEN a service has no activity in 24 hours THEN the System SHALL display a warning indicator
4. WHEN clicking on a service THEN the System SHALL show recent interactions for that platform
