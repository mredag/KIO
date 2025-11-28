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
5. WHEN rate limit counters reset THEN the Backend SHALL clear counters at midnight Istanbul time

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
