# Requirements Document

## Introduction

This document specifies the requirements for a WhatsApp-based coupon loyalty system integrated with the spa kiosk application. The system enables customers to collect digital coupons after each massage session and redeem them for free services through WhatsApp messaging, automated via n8n workflows.

## Glossary

- **Coupon System**: The complete WhatsApp-based loyalty program including token issuance, collection, and redemption
- **Coupon Token**: A unique single-use code issued after each massage that customers send via WhatsApp to earn a coupon
- **Coupon Wallet**: A customer's account tracking their collected coupons, identified by phone number
- **Redemption**: The process of exchanging 4 collected coupons for a free massage session
- **n8n**: An open-source workflow automation platform that processes WhatsApp messages and integrates with the backend
- **WhatsApp Business API**: Meta's Cloud API for programmatic WhatsApp messaging
- **Kiosk**: The customer-facing digital interface at the spa reception
- **Backend**: The Express.js server managing the SQLite database and API endpoints
- **Reception Staff**: Spa employees who issue tokens and fulfill redemptions

## Requirements

### Requirement 1

**User Story:** As a reception staff member, I want to issue a unique coupon token after each massage session, so that customers can collect coupons via WhatsApp.

#### Acceptance Criteria

1. WHEN a staff member requests a new token via the admin interface THEN the Backend SHALL generate a unique alphanumeric token with status 'issued'
2. WHEN a token is generated THEN the Backend SHALL store the token with expiration timestamp, kiosk identifier, and associated massage session identifier
3. WHEN a token is generated THEN the Backend SHALL return a WhatsApp deep link containing the token in the format `https://wa.me/<NUMBER>?text=KUPON%20<TOKEN>`
4. WHEN a token is generated THEN the Backend SHALL set the expiration time to 24 hours from creation
5. WHEN displaying the token THEN the Kiosk SHALL render a QR code that opens WhatsApp with the pre-filled message

### Requirement 2

**User Story:** As a customer, I want to scan a QR code and send the coupon token via WhatsApp, so that I can collect coupons toward a free massage.

#### Acceptance Criteria

1. WHEN a customer scans the QR code THEN the WhatsApp application SHALL open with a pre-filled message containing the token
2. WHEN a customer sends a message matching the pattern `KUPON <TOKEN>` THEN n8n SHALL normalize the phone number to E.164 format
3. WHEN n8n receives a valid token message THEN n8n SHALL send the token and phone number to the Backend consume endpoint
4. WHEN the Backend receives a consume request with a valid unused token THEN the Backend SHALL mark the token as 'used' and increment the customer's coupon count
5. WHEN a token is successfully consumed THEN n8n SHALL reply to the customer with their current coupon balance in format "X/4 coupons"

### Requirement 3

**User Story:** As a customer, I want to check my coupon balance via WhatsApp, so that I know how many more coupons I need for a free massage.

#### Acceptance Criteria

1. WHEN a customer sends the message "durum" THEN n8n SHALL retrieve the customer's wallet from the Backend
2. WHEN the wallet exists THEN n8n SHALL reply with the current balance in format "X/4 coupons collected"
3. WHEN the wallet does not exist THEN n8n SHALL reply indicating zero coupons and instructions to collect
4. WHEN a customer has 4 or more coupons THEN the reply SHALL include instructions to send "kupon kullan" to redeem

### Requirement 4

**User Story:** As a customer, I want to redeem 4 collected coupons for a free massage via WhatsApp, so that I can claim my reward.

#### Acceptance Criteria

1. WHEN a customer sends the message "kupon kullan" THEN n8n SHALL send a claim request to the Backend with the customer's phone number
2. WHEN the Backend receives a claim request and the wallet has 4 or more coupons THEN the Backend SHALL subtract 4 coupons from the wallet
3. WHEN coupons are subtracted THEN the Backend SHALL create a redemption record with status 'pending' and generate a unique redemption identifier
4. WHEN a redemption is created THEN n8n SHALL reply to the customer with a confirmation message and the redemption identifier
5. WHEN a redemption is created THEN n8n SHALL send a notification to the reception staff WhatsApp group with customer details and redemption identifier

### Requirement 5

**User Story:** As a reception staff member, I want to mark redemptions as completed in the admin interface, so that I can track which free massages have been delivered.

#### Acceptance Criteria

1. WHEN a staff member views the admin redemptions page THEN the Backend SHALL display all redemptions with status 'pending'
2. WHEN a staff member selects a redemption and marks it complete THEN the Backend SHALL update the redemption status to 'completed' and record the completion timestamp
3. WHEN a redemption is marked complete THEN the Backend SHALL log the event in the coupon events table
4. WHEN viewing a redemption THEN the interface SHALL display the customer's phone number, redemption identifier, creation timestamp, and current status

### Requirement 6

**User Story:** As a system administrator, I want all coupon-related events logged in the database, so that I can audit the system and resolve disputes.

#### Acceptance Criteria

1. WHEN a token is issued THEN the Backend SHALL create an event record with type 'issued' and the token identifier
2. WHEN a token is consumed THEN the Backend SHALL create an event record with type 'coupon_awarded', phone number, and token identifier
3. WHEN a redemption is attempted THEN the Backend SHALL create an event record with type 'redemption_attempt' and the phone number
4. WHEN a redemption is granted THEN the Backend SHALL create an event record with type 'redemption_granted' and the redemption identifier
5. WHEN a redemption is blocked due to insufficient coupons THEN the Backend SHALL create an event record with type 'redemption_blocked' and the reason

### Requirement 7

**User Story:** As a system administrator, I want tokens to be single-use with expiration, so that the system prevents fraud and abuse.

#### Acceptance Criteria

1. WHEN the Backend validates a token THEN the Backend SHALL verify the token status is 'issued'
2. WHEN the Backend validates a token THEN the Backend SHALL verify the expiration timestamp is in the future
3. WHEN a token has already been used THEN the Backend SHALL reject the consume request and return an error indicating the token is invalid
4. WHEN a token has expired THEN the Backend SHALL reject the consume request and return an error indicating the token has expired
5. WHEN a token is successfully consumed THEN the Backend SHALL update the token status to 'used' and record the phone number and usage timestamp

### Requirement 8

**User Story:** As a system administrator, I want phone numbers normalized to E.164 format, so that the system correctly identifies customers across different number formats.

#### Acceptance Criteria

1. WHEN n8n receives a WhatsApp message THEN n8n SHALL extract the phone number from the webhook payload
2. WHEN processing a phone number THEN n8n SHALL normalize it to E.164 format (e.g., +905551234567)
3. WHEN creating or updating a wallet THEN the Backend SHALL store the phone number in E.164 format
4. WHEN querying a wallet by phone number THEN the Backend SHALL normalize the input before lookup
5. WHEN logging events THEN the Backend SHALL store phone numbers in E.164 format

### Requirement 9

**User Story:** As a system administrator, I want rate limiting on API endpoints, so that the system prevents abuse and maintains performance.

#### Acceptance Criteria

1. WHEN the Backend receives requests to the consume endpoint THEN the Backend SHALL enforce a rate limit of 10 requests per phone number per day
2. WHEN the Backend receives requests to the claim endpoint THEN the Backend SHALL enforce a rate limit of 5 requests per phone number per day
3. WHEN a rate limit is exceeded THEN the Backend SHALL return an HTTP 429 status code with a retry-after header
4. WHEN a rate limit is exceeded THEN n8n SHALL reply to the customer with a message indicating they should try again later
5. WHEN rate limit counters reset THEN the Backend SHALL clear counters at midnight Istanbul time, honoring DST changes

### Requirement 10

**User Story:** As a customer, I want to opt out of marketing messages, so that I control my communication preferences.

#### Acceptance Criteria

1. WHEN a customer sends the message "iptal" THEN n8n SHALL update the customer's wallet to set opted_in_marketing to 0
2. WHEN a wallet is updated with opt-out THEN the Backend SHALL record the timestamp of the opt-out
3. WHEN sending marketing messages THEN n8n SHALL exclude customers where opted_in_marketing is 0
4. WHEN a customer opts out THEN n8n SHALL reply with a confirmation message
5. WHEN a customer who has opted out collects coupons THEN the system SHALL continue to process coupon transactions normally

### Requirement 11

**User Story:** As a system administrator, I want n8n running as a systemd service on Raspberry Pi, so that the automation workflows start automatically and recover from failures.

#### Acceptance Criteria

1. WHEN the Raspberry Pi boots THEN systemd SHALL automatically start the n8n service
2. WHEN the n8n process crashes THEN systemd SHALL restart the service after 10 seconds
3. WHEN n8n starts THEN the service SHALL bind to port 5678 with basic authentication enabled
4. WHEN n8n is running THEN the service SHALL expose webhook endpoints accessible via HTTPS through a reverse proxy
5. WHEN checking service status THEN systemctl SHALL report the n8n service as active and running

### Requirement 12

**User Story:** As a system administrator, I want WhatsApp webhooks configured with the Meta Cloud API, so that n8n receives inbound messages reliably.

#### Acceptance Criteria

1. WHEN configuring the WhatsApp Business API THEN the administrator SHALL set the webhook URL to the n8n public HTTPS endpoint
2. WHEN a customer sends a WhatsApp message THEN Meta SHALL deliver the message to the n8n webhook within 5 seconds
3. WHEN n8n receives a webhook THEN n8n SHALL verify the webhook signature using the app secret
4. WHEN n8n sends a reply THEN n8n SHALL use the WhatsApp Business API with valid access token
5. WHEN the webhook verification fails THEN n8n SHALL reject the request with HTTP 403 status

### Requirement 13

**User Story:** As a reception staff member, I want to view a customer's coupon wallet by phone number, so that I can assist with customer inquiries and resolve issues.

#### Acceptance Criteria

1. WHEN a staff member enters a phone number in the admin interface THEN the Backend SHALL retrieve the wallet for that phone number
2. WHEN a wallet exists THEN the interface SHALL display the current coupon count, total earned, total redeemed, and opt-in status
3. WHEN a wallet does not exist THEN the interface SHALL display a message indicating no coupons have been collected
4. WHEN viewing a wallet THEN the interface SHALL display the last message timestamp
5. WHEN viewing a wallet THEN the interface SHALL display a history of all events for that phone number

### Requirement 14

**User Story:** As a system administrator, I want the database schema to support the coupon system, so that all data is persisted reliably.

#### Acceptance Criteria

1. WHEN the database initializes THEN the Backend SHALL create a coupon_tokens table with columns for token, status, issued_for, kiosk_id, phone, expires_at, used_at, created_at, and updated_at
2. WHEN the database initializes THEN the Backend SHALL create a coupon_wallets table with columns for phone, coupon_count, total_earned, total_redeemed, opted_in_marketing, last_message_at, and updated_at
3. WHEN the database initializes THEN the Backend SHALL create a coupon_redemptions table with columns for id, phone, coupons_used, status, note, created_at, notified_at, and completed_at
4. WHEN the database initializes THEN the Backend SHALL create a coupon_events table with columns for id, phone, event, token, details, and created_at
5. WHEN the database initializes THEN the Backend SHALL create indexes on phone numbers and token status for query performance

### Requirement 15

**User Story:** As a developer, I want comprehensive error handling in n8n workflows, so that invalid messages and edge cases are handled gracefully.

#### Acceptance Criteria

1. WHEN n8n receives a message that does not match any keyword pattern THEN n8n SHALL ignore the message without replying
2. WHEN the Backend returns an error response THEN n8n SHALL reply to the customer with a user-friendly error message in Turkish
3. WHEN a network error occurs communicating with the Backend THEN n8n SHALL retry the request up to 3 times with exponential backoff
4. WHEN a customer sends a token that is invalid or expired THEN n8n SHALL reply instructing them to contact reception
5. WHEN a customer attempts to redeem with insufficient coupons THEN n8n SHALL reply with their current balance and the number needed

### Requirement 16

**User Story:** As a system administrator, I want the integration to be secure and observable, so that customer data is protected and operations can recover quickly.

#### Acceptance Criteria

1. WHEN the Backend receives requests to `/api/admin/*` THEN it SHALL enforce the existing authenticated admin session; WHEN it receives requests to `/api/integrations/coupons/*` THEN it SHALL validate a pre-shared integration secret header before processing
2. WHEN external webhooks or API endpoints are exposed THEN they SHALL be served over HTTPS only, with webhook signatures from WhatsApp verified before any workflow runs
3. WHEN logging events that include phone numbers THEN the Backend SHALL store full values only in the database tables and SHALL redact phone numbers (last 4 digits visible) in application logs
4. WHEN operating the system in production THEN the SQLite database and n8n workflow configuration SHALL be backed up at least daily with documented restore steps
5. WHEN monitoring the services THEN a health check endpoint SHALL report backend and database availability and SHALL emit alerts on repeated failures of consume or claim requests

### Requirement 17

**User Story:** As a system administrator, I want token and redemption handling to be idempotent, so that retries or duplicate messages do not create inconsistent state.

#### Acceptance Criteria

1. WHEN generating a token THEN the Backend SHALL create a 10-character uppercase alphanumeric value and SHALL reject issuance on collision, retrying until unique
2. WHEN validating a consume request THEN the Backend SHALL perform an atomic check-and-update so that concurrent or repeated consume calls cannot mark the same token as used twice
3. WHEN a customer repeats "kupon kullan" while a redemption is pending THEN the Backend SHALL return the existing pending redemption identifier instead of creating a new one
4. WHEN a token reaches its expiration THEN the Backend SHALL auto-transition its status to 'expired' via a scheduled cleanup without manual intervention
5. WHEN n8n retries a failed HTTP call to consume or claim THEN the Backend responses SHALL remain idempotent, returning the same success payload for already-applied actions and clear error codes otherwise

### Requirement 16

**User Story:** As a system administrator, I want secure authentication for admin and integration endpoints, so that only authorized parties can access sensitive operations.

#### Acceptance Criteria

1. WHEN a request is made to any admin coupon endpoint THEN the Backend SHALL verify the session contains a valid authenticated admin user
2. WHEN a request is made to the n8n integration endpoints THEN the Backend SHALL verify the request contains a valid API key in the Authorization header
3. WHEN the API key is invalid or missing THEN the Backend SHALL return HTTP 401 status with error message
4. WHEN n8n is configured THEN the administrator SHALL generate a secure random API key and store it in both n8n credentials and Backend environment variables
5. WHEN the n8n webhook endpoint is accessed THEN n8n SHALL verify the Meta webhook signature before processing

### Requirement 17

**User Story:** As a system administrator, I want all communication to use HTTPS, so that customer data and tokens are transmitted securely.

#### Acceptance Criteria

1. WHEN n8n is deployed THEN the administrator SHALL configure a reverse proxy with valid TLS certificate
2. WHEN the WhatsApp webhook is registered THEN the webhook URL SHALL use HTTPS protocol
3. WHEN n8n communicates with the Backend THEN n8n SHALL use HTTPS if the Backend is on a different host
4. WHEN a customer scans the QR code THEN the WhatsApp deep link SHALL use the wa.me HTTPS scheme
5. WHEN TLS certificate expires THEN the system SHALL alert administrators 30 days before expiration

### Requirement 18

**User Story:** As a system administrator, I want sensitive data masked in logs, so that customer privacy is protected.

#### Acceptance Criteria

1. WHEN logging coupon events THEN the Backend SHALL mask phone numbers to show only the last 4 digits
2. WHEN logging tokens THEN the Backend SHALL mask tokens to show only the first 4 and last 4 characters
3. WHEN n8n logs workflow executions THEN n8n SHALL not log full phone numbers or tokens in execution data
4. WHEN an error occurs THEN error logs SHALL not contain full phone numbers or tokens
5. WHEN viewing logs in the admin interface THEN the interface SHALL display masked phone numbers unless the administrator explicitly reveals them

### Requirement 19

**User Story:** As a system administrator, I want idempotent token consumption, so that duplicate message submissions do not award multiple coupons.

#### Acceptance Criteria

1. WHEN the Backend receives a consume request for a token THEN the Backend SHALL check if the token status is 'issued' before processing
2. WHEN a token has already been consumed THEN the Backend SHALL return a success response with the existing wallet balance without incrementing
3. WHEN n8n retries a failed consume request THEN the Backend SHALL return the same result as the original request
4. WHEN a customer sends the same token message multiple times within 60 seconds THEN n8n SHALL deduplicate based on phone number and token combination
5. WHEN n8n deduplicates a message THEN n8n SHALL reply with the current balance without calling the Backend

### Requirement 20

**User Story:** As a system administrator, I want idempotent redemption claims, so that duplicate "kupon kullan" messages do not create multiple redemptions.

#### Acceptance Criteria

1. WHEN the Backend receives a claim request THEN the Backend SHALL check if a redemption with status 'pending' already exists for the phone number
2. WHEN a pending redemption exists THEN the Backend SHALL return the existing redemption identifier without creating a new redemption
3. WHEN a pending redemption exists THEN the Backend SHALL not subtract coupons again
4. WHEN n8n retries a failed claim request THEN the Backend SHALL return the same redemption identifier
5. WHEN a customer sends "kupon kullan" multiple times within 5 minutes THEN n8n SHALL deduplicate and reply with the existing redemption identifier

### Requirement 21

**User Story:** As a system administrator, I want tokens to have a defined format and sufficient entropy, so that tokens are secure and collision-free.

#### Acceptance Criteria

1. WHEN generating a token THEN the Backend SHALL create a token of exactly 12 uppercase alphanumeric characters
2. WHEN generating a token THEN the Backend SHALL use a cryptographically secure random number generator
3. WHEN a token collision is detected THEN the Backend SHALL regenerate a new token and retry up to 3 times
4. WHEN 3 collision retries fail THEN the Backend SHALL return an error to the admin interface
5. WHEN storing a token THEN the Backend SHALL enforce a unique constraint on the token column

### Requirement 22

**User Story:** As a system administrator, I want expired and old tokens automatically cleaned up, so that the database does not grow unbounded.

#### Acceptance Criteria

1. WHEN a scheduled cleanup job runs THEN the Backend SHALL delete tokens with status 'issued' that expired more than 7 days ago
2. WHEN a scheduled cleanup job runs THEN the Backend SHALL delete tokens with status 'used' that were used more than 90 days ago
3. WHEN the cleanup job runs THEN the Backend SHALL execute daily at 3:00 AM Istanbul time
4. WHEN tokens are deleted THEN the Backend SHALL log the count of deleted tokens
5. WHEN viewing the admin interface THEN expired unused tokens SHALL be visually distinguished from active tokens

### Requirement 23

**User Story:** As a reception staff member, I want to cancel or deny pending redemptions, so that I can handle edge cases and policy violations.

#### Acceptance Criteria

1. WHEN viewing a pending redemption THEN the admin interface SHALL display "Complete" and "Reject" action buttons
2. WHEN a staff member rejects a redemption THEN the Backend SHALL update the status to 'rejected' and refund 4 coupons to the wallet
3. WHEN a redemption is rejected THEN the Backend SHALL require a note explaining the reason
4. WHEN a redemption is rejected THEN n8n SHALL send a WhatsApp message to the customer explaining the rejection
5. WHEN a redemption has been pending for more than 30 days THEN the system SHALL automatically expire it and refund the coupons

### Requirement 24

**User Story:** As a system administrator, I want rate limit counters to persist across service restarts, so that rate limiting remains effective.

#### Acceptance Criteria

1. WHEN the Backend enforces rate limits THEN the Backend SHALL store rate limit counters in the SQLite database
2. WHEN the Backend restarts THEN the Backend SHALL load existing rate limit counters from the database
3. WHEN a rate limit counter resets at midnight THEN the Backend SHALL delete expired counter records
4. WHEN storing rate limit data THEN the Backend SHALL use a dedicated table with phone number, endpoint, count, and reset timestamp
5. WHEN a rate limit is checked THEN the Backend SHALL query the database for the current count within the time window

### Requirement 25

**User Story:** As a system administrator, I want defined uptime and latency targets, so that the system meets operational requirements.

#### Acceptance Criteria

1. WHEN measuring system availability THEN the Backend SHALL maintain 99.5 percent uptime during business hours (9 AM to 10 PM Istanbul time)
2. WHEN a customer sends a WhatsApp message THEN n8n SHALL reply within 5 seconds under normal load
3. WHEN the Backend processes a consume or claim request THEN the Backend SHALL respond within 500 milliseconds
4. WHEN the system is under high load THEN the Backend SHALL handle at least 100 requests per minute
5. WHEN uptime falls below target THEN the system SHALL send an alert to administrators

### Requirement 26

**User Story:** As a system administrator, I want monitoring and alerting configured, so that I am notified of system issues promptly.

#### Acceptance Criteria

1. WHEN the n8n service stops THEN systemd SHALL send an alert to the administrator email
2. WHEN the Backend API returns errors for 5 consecutive requests THEN the system SHALL send an alert
3. WHEN the SQLite database file size exceeds 1 GB THEN the system SHALL send an alert
4. WHEN the TLS certificate will expire within 30 days THEN the system SHALL send a daily alert
5. WHEN rate limit rejections exceed 50 per hour THEN the system SHALL send an alert indicating possible abuse

### Requirement 27

**User Story:** As a system administrator, I want automated backup and restore for SQLite and n8n configuration, so that data can be recovered after failures.

#### Acceptance Criteria

1. WHEN the daily backup job runs THEN the system SHALL create a backup of the SQLite database file
2. WHEN the daily backup job runs THEN the system SHALL export n8n workflows and credentials to JSON files
3. WHEN backups are created THEN the system SHALL store them in a dedicated backup directory with timestamp in filename
4. WHEN backups are older than 30 days THEN the system SHALL delete them automatically
5. WHEN restoring from backup THEN the administrator SHALL be able to restore both database and n8n configuration from a specific backup date

### Requirement 28

**User Story:** As a system administrator, I want timezone handling for Istanbul time, so that midnight resets and scheduled jobs run at the correct local time.

#### Acceptance Criteria

1. WHEN the Backend calculates midnight for rate limit resets THEN the Backend SHALL use Europe/Istanbul timezone
2. WHEN the cleanup job is scheduled THEN the job SHALL run at 3:00 AM Europe/Istanbul time
3. WHEN daylight saving time transitions occur THEN the system SHALL automatically adjust scheduled job times
4. WHEN storing timestamps in the database THEN the Backend SHALL store them in UTC format
5. WHEN displaying timestamps in the admin interface THEN the interface SHALL convert UTC to Europe/Istanbul timezone

### Requirement 29

**User Story:** As a customer, I want to receive WhatsApp messages in Turkish with consistent formatting, so that I understand the system responses clearly.

#### Acceptance Criteria

1. WHEN a coupon is successfully awarded THEN n8n SHALL reply with "✅ Kuponunuz eklendi! Toplam: X/4 kupon. 4 kupona ulaştığınızda 'kupon kullan' yazarak ücretsiz masajınızı alabilirsiniz."
2. WHEN a customer checks balance THEN n8n SHALL reply with "📊 Kupon durumunuz: X/4 kupon toplandı. Y kupon daha toplamanız gerekiyor."
3. WHEN a redemption is successful THEN n8n SHALL reply with "🎉 Tebrikler! 4 kuponunuz kullanıldı. Redemption ID: <ID>. Resepsiyona bu kodu göstererek ücretsiz masajınızı alabilirsiniz."
4. WHEN a token is invalid THEN n8n SHALL reply with "❌ Bu kupon geçersiz veya kullanılmış. Lütfen resepsiyonla iletişime geçin."
5. WHEN rate limit is exceeded THEN n8n SHALL reply with "⏳ Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin."

### Requirement 30

**User Story:** As a reception staff member, I want to receive WhatsApp notifications in Turkish with customer details, so that I can fulfill redemptions efficiently.

#### Acceptance Criteria

1. WHEN a redemption is created THEN n8n SHALL send to the staff group "🔔 Yeni kupon kullanımı! Müşteri: <PHONE_MASKED> | Redemption ID: <ID> | Tarih: <TIMESTAMP>"
2. WHEN a redemption is rejected THEN n8n SHALL send to the staff group "❌ Kupon kullanımı reddedildi. Redemption ID: <ID> | Sebep: <NOTE>"
3. WHEN a redemption is completed THEN n8n SHALL send to the staff group "✅ Kupon kullanımı tamamlandı. Redemption ID: <ID> | Tamamlayan: <ADMIN_USERNAME>"
4. WHEN the system detects potential abuse THEN n8n SHALL send to the staff group "⚠️ Şüpheli aktivite tespit edildi. Telefon: <PHONE_MASKED> | Detay: <DETAILS>"
5. WHEN the daily summary is generated THEN n8n SHALL send to the staff group "📈 Günlük özet: <COUNT> kupon verildi, <COUNT> kullanım yapıldı."
