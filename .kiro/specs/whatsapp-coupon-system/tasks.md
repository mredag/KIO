# Implementation Plan

- [ ] 1. Database Schema and Types
- [ ] 1.1 Add coupon tables to schema.sql
  - Add coupon_tokens, coupon_wallets, coupon_redemptions, coupon_events, coupon_rate_limits tables
  - Add all indexes for performance
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 1.2 Add TypeScript interfaces to database/types.ts
  - Add CouponToken, CouponWallet, CouponRedemption, CouponEvent, RateLimit interfaces
  - Add snake_case database types and camelCase application types
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 1.3 Update DatabaseService with coupon table initialization
  - Add table creation in init() method
  - Add migration logic if tables don't exist
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 2. Core Services Implementation
- [ ] 2.1 Implement PhoneNormalizer utility
  - Create utility function to normalize phone numbers to E.164 format
  - Handle various input formats (+90, 90, 0, etc.)
  - _Requirements: 2.2, 8.2, 8.3, 8.4_

- [ ]* 2.2 Write property test for phone normalization
  - **Property 4: Phone Number Normalization**
  - **Validates: Requirements 2.2, 8.2**

- [ ] 2.3 Implement TokenGenerator utility
  - Create function to generate 12-character alphanumeric tokens
  - Use crypto.randomBytes for cryptographic security
  - _Requirements: 1.1, 21.1, 21.2_

- [ ]* 2.4 Write property test for token format
  - **Property 32: Token Format Validation**
  - **Validates: Requirements 21.1**

- [ ] 2.5 Implement PII masking utilities
  - Create maskPhone() function (show last 4 digits)
  - Create maskToken() function (show first 4 and last 4 chars)
  - _Requirements: 18.1, 18.2, 18.4_

- [ ]* 2.6 Write property tests for PII masking
  - **Property 29: Phone Number Masking in Logs**
  - **Property 30: Token Masking in Logs**
  - **Validates: Requirements 18.1, 18.2**

- [ ] 2.7 Implement EventLogService
  - Create logEvent() method to insert events into coupon_events table
  - Create getEventsByPhone() method to retrieve event history
  - Apply PII masking to logged data
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 2.8 Write property tests for event logging
  - **Property 11: Event Logging for Token Issuance**
  - **Property 12: Event Logging for Token Consumption**
  - **Property 13: Event Logging for Redemption Attempts**
  - **Property 14: Event Logging for Granted Redemptions**
  - **Property 15: Event Logging for Blocked Redemptions**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

- [ ] 3. CouponService Implementation
- [ ] 3.1 Implement issueToken() method
  - Generate token with collision retry (up to 3 attempts)
  - Store token with status='issued', expires_at=now+24h
  - Log 'issued' event
  - Return token and WhatsApp deep link
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 21.3, 21.4_

- [ ]* 3.2 Write property tests for token issuance
  - **Property 1: Token Generation Uniqueness**
  - **Property 2: Token Expiration Calculation**
  - **Property 3: WhatsApp Deep Link Format**
  - **Property 33: Token Collision Retry**
  - **Validates: Requirements 1.1, 1.3, 1.4, 21.3, 21.4**

- [ ] 3.3 Implement consumeToken() method
  - Validate token (status='issued', not expired)
  - Check idempotency (if already used, return existing balance)
  - Update token status to 'used', set phone and used_at
  - Create or update wallet, increment coupon_count and total_earned
  - Log 'coupon_awarded' event
  - Return balance and remainingToFree
  - _Requirements: 2.4, 7.1, 7.2, 7.3, 7.4, 7.5, 19.1, 19.2, 19.3_

- [ ]* 3.4 Write property tests for token consumption
  - **Property 5: Token Consumption Idempotency**
  - **Property 16: Token Status Validation**
  - **Property 17: Token Expiration Validation**
  - **Property 18: Token Consumption State Update**
  - **Validates: Requirements 2.4, 7.1, 7.2, 7.3, 7.5, 19.2**

- [ ] 3.5 Implement getWallet() method
  - Query wallet by phone number (normalize phone first)
  - Return wallet or null if not found
  - _Requirements: 13.1_

- [ ]* 3.6 Write property test for wallet lookup
  - **Property 20: Phone Number Lookup Normalization**
  - **Property 26: Wallet Lookup by Phone**
  - **Validates: Requirements 8.4, 13.1**

- [ ] 3.7 Implement claimRedemption() method
  - Check wallet has 4+ coupons
  - Check for existing pending redemption (idempotency)
  - If pending exists, return existing redemption ID
  - If sufficient coupons, subtract 4, create redemption with status='pending'
  - Log 'redemption_attempt' and 'redemption_granted' or 'redemption_blocked' events
  - Return ok, redemptionId, or balance/needed
  - _Requirements: 4.2, 4.3, 20.1, 20.2, 20.3, 20.4_

- [ ]* 3.8 Write property tests for redemption claim
  - **Property 6: Coupon Claim Subtraction**
  - **Property 7: Redemption Creation Uniqueness**
  - **Property 8: Claim Idempotency**
  - **Validates: Requirements 4.2, 4.3, 20.2, 20.3**

- [ ] 3.9 Implement completeRedemption() method
  - Update redemption status to 'completed', set completed_at
  - Log event
  - _Requirements: 5.2, 5.3_

- [ ]* 3.10 Write property test for redemption completion
  - **Property 10: Redemption Completion**
  - **Validates: Requirements 5.2**

- [ ] 3.11 Implement rejectRedemption() method
  - Validate note is provided
  - Update redemption status to 'rejected', set rejected_at, store note
  - Refund 4 coupons to wallet
  - Log event
  - _Requirements: 23.2, 23.3_

- [ ]* 3.12 Write property tests for redemption rejection
  - **Property 37: Redemption Rejection Refund**
  - **Property 38: Rejection Note Requirement**
  - **Validates: Requirements 23.2, 23.3**

- [ ] 3.13 Implement optOut() method
  - Update wallet opted_in_marketing to 0, set updated_at
  - _Requirements: 10.2_

- [ ]* 3.14 Write property test for opt-out
  - **Property 24: Opt-Out Operation**
  - **Property 25: Opt-Out Does Not Affect Coupons**
  - **Validates: Requirements 10.2, 10.5**

- [ ] 4. Rate Limiting Implementation
- [ ] 4.1 Implement RateLimitService
  - Create checkLimit() method to query rate_limits table
  - Create incrementCounter() method to insert/update counter
  - Create resetExpiredCounters() method to delete expired records
  - Calculate midnight Istanbul time for reset_at
  - _Requirements: 9.1, 9.2, 9.3, 9.5, 24.1, 24.2, 24.3, 24.5, 28.1_

- [ ]* 4.2 Write property tests for rate limiting
  - **Property 21: Consume Endpoint Rate Limiting**
  - **Property 22: Claim Endpoint Rate Limiting**
  - **Property 23: Rate Limit Counter Reset**
  - **Property 40: Rate Limit Counter Persistence**
  - **Property 41: Rate Limit Query Accuracy**
  - **Property 42: Midnight Calculation in Istanbul Time**
  - **Validates: Requirements 9.1, 9.2, 9.5, 24.1, 24.2, 24.5, 28.1**

- [ ] 4.3 Implement couponRateLimit middleware
  - Extract phone from request body
  - Determine endpoint from req.path
  - Call RateLimitService.checkLimit()
  - If exceeded, return 429 with Retry-After header
  - If allowed, call RateLimitService.incrementCounter()
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 5. Authentication Middleware
- [ ] 5.1 Implement apiKeyAuth middleware
  - Extract Authorization header
  - Verify Bearer token matches process.env.N8N_API_KEY
  - Return 401 if invalid or missing
  - Attach req.apiClient = 'n8n' for logging
  - _Requirements: 16.2, 16.3_

- [ ]* 5.2 Write property test for API key authentication
  - **Property 28: API Key Authentication**
  - **Validates: Requirements 16.2, 16.3**

- [ ] 5.3 Verify admin session authentication middleware exists
  - Reuse existing authMiddleware for admin routes
  - _Requirements: 16.1_

- [ ]* 5.4 Write property test for admin authentication
  - **Property 27: Admin Session Authentication**
  - **Validates: Requirements 16.1**

- [ ] 6. Admin API Routes
- [ ] 6.1 Implement POST /api/admin/coupons/issue
  - Call CouponService.issueToken()
  - Return token, waUrl, waText
  - Apply session auth middleware
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 6.2 Implement GET /api/admin/coupons/wallet/:phone
  - Call CouponService.getWallet()
  - Return wallet details or 404
  - Apply session auth middleware
  - _Requirements: 13.1_

- [ ] 6.3 Implement GET /api/admin/coupons/redemptions
  - Query redemptions with optional status filter
  - Support pagination (limit, offset)
  - Apply session auth middleware
  - _Requirements: 5.1_

- [ ]* 6.4 Write property test for redemptions filter
  - **Property 9: Pending Redemptions Filter**
  - **Validates: Requirements 5.1**

- [ ] 6.5 Implement POST /api/admin/coupons/redemptions/:id/complete
  - Call CouponService.completeRedemption()
  - Return success response
  - Apply session auth middleware
  - _Requirements: 5.2, 5.3_

- [ ] 6.6 Implement POST /api/admin/coupons/redemptions/:id/reject
  - Validate note in request body
  - Call CouponService.rejectRedemption()
  - Return success response
  - Apply session auth middleware
  - _Requirements: 23.2, 23.3_

- [ ] 6.7 Implement GET /api/admin/coupons/events/:phone
  - Call EventLogService.getEventsByPhone()
  - Return event history
  - Apply session auth middleware
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. Integration API Routes
- [ ] 7.1 Implement POST /api/integrations/coupons/consume
  - Validate request body (phone, token)
  - Apply apiKeyAuth and couponRateLimit middleware
  - Call CouponService.consumeToken()
  - Return balance and remainingToFree
  - Handle errors (invalid token, expired, rate limit)
  - _Requirements: 2.4, 7.1, 7.2, 7.3, 7.4, 7.5, 9.1_

- [ ] 7.2 Implement POST /api/integrations/coupons/claim
  - Validate request body (phone)
  - Apply apiKeyAuth and couponRateLimit middleware
  - Call CouponService.claimRedemption()
  - Return ok, redemptionId, or balance/needed
  - Handle errors (insufficient coupons, rate limit)
  - _Requirements: 4.2, 4.3, 9.2_

- [ ] 7.3 Implement GET /api/integrations/coupons/wallet/:phone
  - Apply apiKeyAuth middleware
  - Call CouponService.getWallet()
  - Return wallet or 404
  - _Requirements: 13.1_

- [ ] 7.4 Implement POST /api/integrations/coupons/opt-out
  - Validate request body (phone)
  - Apply apiKeyAuth middleware
  - Call CouponService.optOut()
  - Return success response
  - _Requirements: 10.2_

- [ ] 8. Scheduled Jobs
- [ ] 8.1 Implement token cleanup job
  - Create cleanupExpiredTokens() in CouponService
  - Delete tokens with status='issued' and expires_at > 7 days ago
  - Delete tokens with status='used' and used_at > 90 days ago
  - Log count of deleted tokens
  - _Requirements: 22.1, 22.2, 22.4_

- [ ]* 8.2 Write property tests for token cleanup
  - **Property 34: Expired Token Cleanup**
  - **Property 35: Used Token Cleanup**
  - **Property 36: Cleanup Logging**
  - **Validates: Requirements 22.1, 22.2, 22.4**

- [ ] 8.3 Implement redemption expiration job
  - Create expirePendingRedemptions() in CouponService
  - Find redemptions with status='pending' and created_at > 30 days ago
  - Update status to 'rejected', set rejected_at, note='Auto-expired after 30 days'
  - Refund 4 coupons to wallet
  - Log events
  - _Requirements: 23.5_

- [ ]* 8.4 Write property test for redemption auto-expiration
  - **Property 39: Redemption Auto-Expiration**
  - **Validates: Requirements 23.5**

- [ ] 8.5 Schedule jobs with node-cron
  - Schedule token cleanup daily at 3:00 AM Istanbul time
  - Schedule redemption expiration daily at 3:00 AM Istanbul time
  - Schedule rate limit counter cleanup daily at 12:01 AM Istanbul time
  - _Requirements: 22.3, 23.5, 24.3_

- [ ]* 8.6 Write property tests for timezone handling
  - **Property 42: Midnight Calculation in Istanbul Time**
  - **Property 43: DST Handling**
  - **Property 44: UTC Timestamp Storage**
  - **Validates: Requirements 28.1, 28.3, 28.4**

- [ ] 9. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Admin Frontend Components
- [ ] 10.1 Create CouponIssuePage component
  - Add button to generate new token
  - Display token in large font with copy button
  - Generate and display QR code using qrcode library
  - Show list of recent tokens (last 10)
  - _Requirements: 1.1, 1.3_

- [ ] 10.2 Create CouponRedemptionsPage component
  - Display table of redemptions with status filter
  - Add Complete and Reject buttons with modals
  - Implement pagination
  - Show masked phone numbers
  - _Requirements: 5.1, 5.2, 23.2, 23.3_

- [ ] 10.3 Create CouponWalletLookupPage component
  - Add phone number input with E.164 format validation
  - Display wallet details (balance, total earned, total redeemed, opt-in status)
  - Show event history table
  - _Requirements: 13.1_

- [ ] 10.4 Add coupon routes to admin navigation
  - Add menu items for Issue Token, Redemptions, Wallet Lookup
  - Update AdminLayout with new routes
  - _Requirements: N/A_

- [ ] 11. API Hooks for Frontend
- [ ] 11.1 Add coupon methods to useAdminApi hook
  - Add issueToken() mutation
  - Add getWallet() query
  - Add getRedemptions() query
  - Add completeRedemption() mutation
  - Add rejectRedemption() mutation
  - Add getEvents() query
  - Transform snake_case to camelCase
  - _Requirements: 1.1, 5.1, 5.2, 13.1, 23.2_

- [ ] 11.2 Add error handling and loading states
  - Handle 401, 404, 429, 500 errors
  - Display user-friendly error messages
  - Show loading spinners during API calls
  - _Requirements: N/A_

- [ ] 12. Environment Configuration
- [ ] 12.1 Add N8N_API_KEY to backend .env
  - Generate secure random API key
  - Document in .env.example
  - _Requirements: 16.2, 16.4_

- [ ] 12.2 Add WhatsApp number to backend .env
  - Add WHATSAPP_NUMBER variable
  - Use in WhatsApp deep link generation
  - _Requirements: 1.3_

- [ ] 12.3 Update backend to use Europe/Istanbul timezone
  - Set TZ environment variable
  - Configure date-fns or moment-timezone
  - _Requirements: 28.1, 28.2_

- [ ] 13. n8n Workflow Implementation (Separate from Core Kiosk)
- [ ] 13.1 Create n8n workflows directory structure
  - Create `n8n-workflows/` directory in project root
  - Create subdirectories: `n8n-workflows/workflows/`, `n8n-workflows/docs/`, `n8n-workflows/credentials/`
  - Add `.gitignore` to exclude credentials and sensitive data
  - Create README.md with setup instructions
  - _Requirements: N/A_

- [ ] 13.2 Create Coupon Capture workflow in n8n
  - Build workflow in n8n UI at http://localhost:5678
  - Add WhatsApp webhook trigger with signature verification
  - Add filter node for "KUPON" messages
  - Add function node for phone normalization and token parsing
  - Add function node for deduplication cache (60s TTL)
  - Add HTTP request node for POST /api/integrations/coupons/consume
  - Add switch node for response handling (200, 400, 429, 500)
  - Add WhatsApp send nodes for each response type with Turkish messages
  - Export to `n8n-workflows/workflows/coupon-capture.json`
  - Document in `n8n-workflows/docs/coupon-capture.md`
  - _Requirements: 2.2, 2.4, 19.4_

- [ ] 13.3 Create Claim Redemption workflow in n8n
  - Build workflow in n8n UI
  - Add WhatsApp webhook trigger with signature verification
  - Add filter node for "kupon kullan" messages
  - Add function node for phone normalization
  - Add function node for deduplication cache (5min TTL)
  - Add HTTP request node for POST /api/integrations/coupons/claim
  - Add switch node for response handling
  - Add WhatsApp send node for customer reply
  - Add WhatsApp send node for staff group notification
  - Export to `n8n-workflows/workflows/claim-redemption.json`
  - Document in `n8n-workflows/docs/claim-redemption.md`
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 20.5_

- [ ] 13.4 Create Balance Check workflow in n8n
  - Build workflow in n8n UI
  - Add WhatsApp webhook trigger
  - Add filter node for "durum" messages
  - Add function node for phone normalization
  - Add HTTP request node for GET /api/integrations/coupons/wallet/:phone
  - Add switch node for response handling (200, 404)
  - Add WhatsApp send nodes with Turkish messages
  - Export to `n8n-workflows/workflows/balance-check.json`
  - Document in `n8n-workflows/docs/balance-check.md`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 13.5 Create Opt-Out workflow in n8n
  - Build workflow in n8n UI
  - Add WhatsApp webhook trigger
  - Add filter node for "iptal" messages
  - Add function node for phone normalization
  - Add HTTP request node for POST /api/integrations/coupons/opt-out
  - Add WhatsApp send node with confirmation message
  - Export to `n8n-workflows/workflows/opt-out.json`
  - Document in `n8n-workflows/docs/opt-out.md`
  - _Requirements: 10.1, 10.4_

- [ ] 13.6 Configure n8n credentials (template only, no actual secrets)
  - Create `n8n-workflows/credentials/credentials-template.json` with placeholder structure
  - Document credential setup in `n8n-workflows/docs/credentials-setup.md`
  - Add instructions for WhatsApp Business API credentials (access token, phone number ID, app secret)
  - Add instructions for backend API key credential
  - Add webhook signature verification testing steps
  - _Requirements: 12.1, 12.5, 16.2_

- [ ] 13.7 Create n8n deployment scripts
  - Create `n8n-workflows/deploy.sh` for importing workflows to production n8n
  - Create `n8n-workflows/backup.sh` for exporting workflows from n8n
  - Create `n8n-workflows/test-webhooks.sh` for testing webhook endpoints
  - Add scripts to `.gitignore` if they contain sensitive data
  - _Requirements: N/A_

- [ ] 14. Deployment Configuration (n8n Separate from Kiosk)
- [ ] 14.1 Create n8n systemd service file
  - Create `n8n-workflows/deployment/n8n.service` systemd file
  - Configure service user, working directory, environment variables
  - Set TZ=Europe/Istanbul
  - Enable auto-restart
  - Document in `n8n-workflows/deployment/README.md`
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 14.2 Create nginx/Caddy reverse proxy config
  - Create `n8n-workflows/deployment/nginx-n8n.conf` for n8n reverse proxy
  - Configure HTTPS termination
  - Proxy /webhook to n8n (port 5678)
  - Add rate limiting at proxy level
  - Keep separate from main kiosk nginx config
  - _Requirements: 17.1, 17.2_

- [ ] 14.3 Create deployment script for Raspberry Pi
  - Create `n8n-workflows/deployment/deploy-n8n.sh` script
  - Install n8n globally
  - Copy systemd service file to /etc/systemd/system/
  - Enable and start service
  - Configure reverse proxy
  - Test webhook endpoint
  - Document deployment steps in `n8n-workflows/deployment/DEPLOYMENT.md`
  - _Requirements: 11.1, 11.2, 11.5_

- [ ] 15. Turkish Localization
- [ ] 15.1 Add Turkish message templates to backend i18n
  - Add coupon_awarded, balance_check, redemption_success messages
  - Add error messages (invalid_token, expired_token, insufficient_coupons, rate_limit)
  - Add opt_out_confirmation message
  - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5_

- [ ] 15.2 Add Turkish message templates to n8n workflows
  - Use i18n templates in WhatsApp send nodes
  - Add staff notification templates
  - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_

- [ ] 16. Monitoring and Alerting
- [ ] 16.1 Add health check endpoint for coupon system
  - Check database connectivity
  - Check n8n webhook reachability
  - Return status and component health
  - _Requirements: 26.1, 26.2_

- [ ] 16.2 Configure systemd email alerts
  - Set up email notifications for n8n service failures
  - _Requirements: 26.1_

- [ ] 16.3 Add logging for rate limit abuse detection
  - Log when rate limit rejections exceed 50/hour
  - _Requirements: 26.5_

- [ ] 17. Backup and Restore (Separate n8n and Backend)
- [ ] 17.1 Extend existing backend backup script to include coupon tables
  - Update `backend/src/services/BackupService.ts` to include coupon tables
  - Add coupon_tokens, coupon_wallets, coupon_redemptions, coupon_events, coupon_rate_limits to backup
  - Keep backend backups in existing location: `data/backups/`
  - _Requirements: 27.1, 27.2_

- [ ] 17.2 Create n8n workflow backup script
  - Create `n8n-workflows/backup.sh` to export n8n database
  - Export workflows to JSON files in `n8n-workflows/backups/workflows-<timestamp>/`
  - Store n8n database backup in `n8n-workflows/backups/database-<timestamp>.sqlite3`
  - Add backup script to cron (separate from backend backup)
  - _Requirements: 27.2_

- [ ] 17.3 Schedule daily backups (separate schedules)
  - Backend backup: 2:00 AM Istanbul time (existing schedule)
  - n8n backup: 2:30 AM Istanbul time (new schedule)
  - Retain both for 30 days
  - Document backup locations in `n8n-workflows/deployment/BACKUP.md`
  - _Requirements: 27.3, 27.4_

- [ ] 18. Documentation
- [ ] 18.1 Update README with coupon system overview
  - Add architecture diagram
  - Document environment variables
  - Add setup instructions
  - _Requirements: N/A_

- [ ] 18.2 Create n8n workflow documentation
  - Document each workflow's purpose and nodes
  - Add troubleshooting guide
  - _Requirements: N/A_

- [ ] 18.3 Create admin user guide
  - Document how to issue tokens
  - Document how to manage redemptions
  - Document how to look up customer wallets
  - _Requirements: N/A_

- [ ] 19. Final Checkpoint - Integration Testing
  - Test end-to-end token issuance → consumption → redemption flow
  - Test rate limiting with multiple requests
  - Test authentication for all endpoints
  - Test n8n workflows with sandbox WhatsApp number
  - Verify all scheduled jobs run correctly
  - Ensure all tests pass, ask the user if questions arise.
