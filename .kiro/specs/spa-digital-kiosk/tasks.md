# Implementation Plan

- [x] 1. Set up project structure and development environment
  - Initialize monorepo with frontend and backend workspaces
  - Configure TypeScript for both frontend and backend
  - Set up Vite for frontend build with React and Tailwind CSS
  - Configure ESLint and Prettier for code quality
  - Create directory structure: backend (src/services, src/routes, src/middleware), frontend (src/components, src/pages, src/hooks)
  - Install core dependencies: Express, better-sqlite3, React, React Router, TanStack Query, Zustand, Motion One
  - Set up environment configuration with .env files
  - _Requirements: All (foundation for entire system)_

- [x] 2. Implement database layer and core data models
- [x] 2.1 Create database schema and initialization
  - Write SQL schema with all tables: massages, survey_templates, survey_responses, kiosk_state, system_settings, system_logs
  - Create indexes for performance optimization
  - Implement database initialization script with WAL mode enabled
  - Add default data seeding (default survey templates, initial admin user)
  - _Requirements: 10.1, 10.2_

- [x] 2.2 Implement DatabaseService class
  - Create DatabaseService with better-sqlite3 connection
  - Enable WAL mode with optimized pragma settings
  - Implement transaction support wrapper
  - Implement CRUD operations for massages (create, read, update, delete, list)
  - Implement CRUD operations for survey templates
  - Implement survey response storage and retrieval
  - Implement kiosk state management (get, update, heartbeat)
  - Implement system settings management
  - Implement system logging methods
  - _Requirements: 10.1, 10.2, 10.3_

- [ ]\* 2.3 Write property test for massage data round-trip
  - **Property 12: Massage data round-trip**
  - **Validates: Requirements 4.2**

- [ ]\* 2.4 Write property test for survey response persistence
  - **Property 19: Survey response persistence**
  - **Validates: Requirements 5.3, 6.3**

- [ ]\* 2.5 Write property test for data persistence before response
  - **Property 31: Data persistence before response**
  - **Validates: Requirements 10.2**

- [x] 3. Implement authentication and session management
- [x] 3.1 Create authentication service
  - Implement password hashing with bcrypt (cost factor 10)
  - Implement credential verification against database
  - Create session management with express-session
  - Implement login endpoint with rate limiting (5 attempts per 15 minutes)
  - Implement logout endpoint with session invalidation
  - Create authentication middleware for protected routes
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ]\* 3.2 Write property test for password hashing
  - **Property 39: Password hashing on change**
  - **Validates: Requirements 12.5**

- [ ]\* 3.3 Write property test for session invalidation
  - **Property 40: Session invalidation on logout**
  - **Validates: Requirements 12.6**

- [ ]\* 3.4 Write unit tests for authentication
  - Test login with valid credentials succeeds
  - Test login with invalid credentials fails
  - Test rate limiting blocks after 5 attempts
  - Test session creation and validation
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 4. Implement media upload and management service
- [x] 4.1 Create MediaService class
  - Implement file upload handling with multer
  - Add file type validation (MP4, JPEG, PNG only)
  - Add file size validation (50MB video, 5MB images)
  - Generate unique filenames to prevent overwrites
  - Implement file deletion for cleanup
  - Add disk usage monitoring
  - Configure static file serving for /uploads directory
  - _Requirements: 4.3_

- [ ]\* 4.2 Write property test for media format validation
  - **Property 13: Media format validation**
  - **Validates: Requirements 4.3**

- [ ]\* 4.3 Write unit tests for media service
  - Test valid file uploads succeed
  - Test invalid file types are rejected
  - Test oversized files are rejected
  - Test file deletion works correctly
  - _Requirements: 4.3_

- [x] 5. Implement Google Sheets integration and sync queue
- [x] 5.1 Create GoogleSheetsService class
  - Set up Google Sheets API v4 client with authentication
  - Implement connection testing method
  - Implement row append method for survey responses
  - Add error handling for API failures
  - _Requirements: 11.2, 11.7, 11.8_

- [x] 5.2 Create SyncQueueService class
  - Implement queue processing logic to fetch unsynced responses
  - Add exponential backoff retry strategy (5min, 10min, 20min, 30min max)
  - Update sync status and timestamps on success
  - Implement cron job to run every 5 minutes
  - Add logging for sync operations
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]\* 5.3 Write property test for survey queue creation
  - **Property 21: Survey queue creation**
  - **Validates: Requirements 5.7, 6.4, 11.1**

- [ ]\* 5.4 Write property test for sync status update
  - **Property 33: Sync status update**
  - **Validates: Requirements 11.3**

- [ ]\* 5.5 Write unit tests for sync queue
  - Test queue processing with successful sync
  - Test retry logic with exponential backoff
  - Test queue entry status updates
  - Mock Google Sheets API responses
  - _Requirements: 11.2, 11.3, 11.4, 11.5_

- [x] 6. Implement QR code generation service
- [x] 6.1 Create QRCodeService class
  - Implement QR code generation using qrcode library
  - Return base64 data URL for embedding
  - Add error handling for invalid URLs
  - _Requirements: 8.2, 8.4_

- [ ]\* 6.2 Write property test for QR URL encoding
  - **Property 24: QR URL encoding**
  - **Validates: Requirements 8.2**

- [ ]\* 6.3 Write unit test for QR code generation
  - Test QR generation with valid URL
  - Test QR generation with various URL formats
  - _Requirements: 8.2_

- [x] 7. Implement backup service
- [x] 7.1 Create BackupService class
  - Implement database export to JSON format
  - Include all tables: massages, survey templates, responses, settings, queue status
  - Schedule daily backups at 3 AM using node-cron
  - Implement old file cleanup (delete files older than 30 days)
  - Add manual backup trigger endpoint
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ]\* 7.2 Write property test for backup data completeness
  - **Property 46: Backup data completeness**
  - **Validates: Requirements 14.3**

- [ ]\* 7.3 Write unit tests for backup service
  - Test backup file generation includes all data
  - Test old file cleanup removes files older than 30 days
  - Test manual backup trigger
  - _Requirements: 14.1, 14.2, 14.3, 14.5_

- [x] 8. Implement kiosk API endpoints
- [x] 8.1 Create kiosk routes and controllers
  - Implement GET /api/kiosk/state endpoint (return mode, active survey, config)
  - Implement GET /api/kiosk/menu endpoint (return massage list with featured sorting)
  - Implement GET /api/kiosk/survey/:id endpoint (return survey template)
  - Implement POST /api/kiosk/survey-response endpoint (store response, add to queue)
  - Implement GET /api/kiosk/google-review endpoint (return QR config)
  - Implement GET /api/kiosk/health endpoint (simple health check for offline detection)
  - Update heartbeat timestamp on every kiosk request
  - Add response time optimization (<3s for state, <1s for others)
  - _Requirements: 1.2, 1.3, 2.1, 5.3, 6.3, 8.1, 10.3, 13.5_

- [ ]\* 8.2 Write property test for heartbeat timestamp update
  - **Property 45: Heartbeat timestamp update**
  - **Validates: Requirements 13.5**

- [ ]\* 8.3 Write property test for featured massage filtering
  - **Property 4: Featured massage filtering**
  - **Validates: Requirements 2.2**

- [ ]\* 8.4 Write unit tests for kiosk endpoints
  - Test state endpoint returns current mode
  - Test menu endpoint returns massages with featured at top
  - Test survey endpoint returns template
  - Test survey response submission stores data
  - Test health endpoint responds quickly
  - _Requirements: 1.2, 2.1, 5.3, 6.3, 8.1_

- [x] 9. Implement admin API endpoints
- [x] 9.1 Create admin routes and controllers
  - Implement POST /api/admin/login (authenticate user)
  - Implement POST /api/admin/logout (invalidate session)
  - Implement GET /api/admin/dashboard (return system status)
  - Implement GET /api/admin/massages (list all massages)
  - Implement POST /api/admin/massages (create massage)
  - Implement PUT /api/admin/massages/:id (update massage)
  - Implement DELETE /api/admin/massages/:id (delete massage and media)
  - Implement PUT /api/admin/kiosk/mode (update kiosk mode with validation)
  - Implement GET /api/admin/surveys (list survey templates)
  - Implement PUT /api/admin/surveys/:id (update survey template)
  - Implement GET /api/admin/survey-responses (list responses with filters)
  - Implement GET /api/admin/settings (fetch system settings)
  - Implement PUT /api/admin/settings (update settings with validation)
  - Implement POST /api/admin/test-sheets (test Google Sheets connection)
  - Implement GET /api/admin/backup (trigger and download backup)
  - Apply authentication middleware to all admin routes
  - _Requirements: 1.1, 4.1, 4.2, 4.4, 4.5, 9.2, 9.3, 11.7, 11.8, 12.1, 13.1, 14.2, 18.2, 18.3_

- [ ]\* 9.2 Write property test for mode persistence
  - **Property 1: Mode persistence**
  - **Validates: Requirements 1.1**

- [ ]\* 9.3 Write property test for survey mode validation
  - **Property 2: Survey mode validation**
  - **Validates: Requirements 1.4**

- [ ]\* 9.4 Write property test for massage creation validation
  - **Property 11: Massage creation validation**
  - **Validates: Requirements 4.1**

- [ ]\* 9.5 Write property test for timing value validation
  - **Property 51: Timing value validation**
  - **Validates: Requirements 18.2**

- [ ]\* 9.6 Write unit tests for admin endpoints
  - Test massage CRUD operations
  - Test kiosk mode update with validation
  - Test survey template updates
  - Test settings update with validation
  - Test Google Sheets connection test
  - Test backup download
  - _Requirements: 1.1, 4.1, 4.2, 9.2, 9.3, 11.8, 14.2, 18.2_

- [x] 10. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Set up frontend project structure and routing
- [x] 11.1 Initialize React application with Vite
  - Configure React 18 with TypeScript
  - Set up Tailwind CSS with custom configuration
  - Configure React Router with routes: /kiosk, /admin, /admin/login
  - Set up TanStack Query with persistence to localStorage
  - Configure Zustand stores for state management
  - Create base layout components for kiosk and admin
  - _Requirements: All frontend requirements_

- [x] 11.2 Configure API client and React Query
  - Create axios instance with base URL configuration
  - Set up React Query client with 5-minute stale time
  - Configure query persistence to localStorage
  - Implement error handling and retry logic
  - Create custom hooks for API calls
  - _Requirements: 10.3, 19.1, 19.2_

- [x] 12. Implement kiosk mode router and state management
- [x] 12.1 Create kiosk state management
  - Create Zustand store for kiosk mode, offline status, cached data
  - Implement polling mechanism (every 3 seconds for state)
  - Implement offline detection and health check polling (every 10 seconds)
  - Add cache fallback logic when backend unreachable
  - Implement survey response queue in localStorage
  - Add queue sync on reconnection
  - _Requirements: 1.2, 1.3, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [x] 12.2 Create kiosk mode router component
  - Implement mode switching logic (digital-menu, survey, google-qr)
  - Add transition animations between modes (300ms fade)
  - Display offline indicator when using cached content
  - _Requirements: 1.3, 19.7_

- [ ]\* 12.3 Write property test for kiosk data caching
  - **Property 54: Kiosk data caching**
  - **Validates: Requirements 19.1**

- [ ]\* 12.4 Write property test for offline cache fallback
  - **Property 55: Offline cache fallback**
  - **Validates: Requirements 19.2**

- [ ]\* 12.5 Write property test for offline survey queueing
  - **Property 57: Offline survey queueing**
  - **Validates: Requirements 19.4**

- [x] 13. Implement digital menu display
- [x] 13.1 Create massage list component
  - Implement left column layout (1/4 screen width)
  - Display featured massages in separate block at top
  - Render massage cards with name, short description, purpose tag chips
  - Implement touch interaction handlers
  - Apply sort order from database
  - _Requirements: 2.1, 2.2, 2.7, 4.7_

- [x] 13.2 Create massage detail panel component
  - Implement right panel layout (3/4 screen width)
  - Display massage name, long description, duration, session pricing, purpose tags
  - Implement video player with autoplay, muted, loop for video media
  - Implement image display with aspect ratio preservation for photo media
  - Add fade transition animation (300ms) on massage selection
  - Implement media loading error handling with placeholder
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.8_

- [ ]\* 13.3 Write property test for massage detail completeness
  - **Property 5: Massage detail completeness**
  - **Validates: Requirements 2.4**

- [ ]\* 13.4 Write property test for massage card completeness
  - **Property 7: Massage card completeness**
  - **Validates: Requirements 2.7**

- [ ]\* 13.5 Write property test for video autoplay configuration
  - **Property 6: Video autoplay configuration**
  - **Validates: Requirements 2.5**

- [x] 14. Implement slideshow mode
- [x] 14.1 Create slideshow component
  - Implement inactivity detection using configured timeout
  - Filter massages to show only featured and campaign
  - Display massages in sequence with 5-second intervals
  - Add fade and scale animations using Motion One
  - Show massage visual, name, and promotional text
  - Implement touch handler to exit slideshow
  - Reset inactivity timer on any touch interaction
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]\* 14.2 Write property test for slideshow content filtering
  - **Property 9: Slideshow content filtering**
  - **Validates: Requirements 3.2**

- [ ]\* 14.3 Write property test for featured massage inclusion
  - **Property 14: Featured massage inclusion**
  - **Validates: Requirements 4.4**

- [ ]\* 14.4 Write property test for campaign massage inclusion
  - **Property 15: Campaign massage inclusion**
  - **Validates: Requirements 4.5**

- [x] 15. Implement satisfaction survey
- [x] 15.1 Create satisfaction survey component
  - Display rating question (1-5) as first question
  - Implement conditional logic: show dissatisfaction question for ratings 1-3
  - Display dissatisfaction reason options (single-choice)
  - Show thank you message with Google review button for ratings 4-5
  - Implement survey submission to backend
  - Add to localStorage queue if offline
  - Implement timeout reset on interaction
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7_

- [x] 15.2 Handle Google review flow from survey
  - Implement Google review button click handler
  - Temporarily switch to Google QR mode
  - Return to survey initial screen after configured duration
  - _Requirements: 5.5, 5.6_

- [ ]\* 15.3 Write property test for conditional question display
  - **Property 18: Conditional question display**
  - **Validates: Requirements 5.2**

- [ ]\* 15.4 Write property test for high rating Google prompt
  - **Property 20: High rating Google prompt**
  - **Validates: Requirements 5.4**

- [x] 16. Implement discovery survey
- [x] 16.1 Create discovery survey component
  - Display discovery channel question as first question
  - Display optional spa experience question as second question
  - Implement survey submission to backend
  - Add to localStorage queue if offline
  - Show thank you screen with 3-second fade animation
  - Return to survey initial screen after thank you
  - Implement timeout reset on interaction
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]\* 16.2 Write property test for discovery survey flow
  - **Property 22: Discovery survey flow**
  - **Validates: Requirements 6.2**

- [x] 17. Implement survey timeout handling
- [x] 17.1 Create survey timeout logic
  - Implement inactivity detection using configured timeout
  - Clear all selected answers on timeout
  - Return to first question of active survey
  - Reset timeout counter on any interaction
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ]\* 17.2 Write property test for configuration round-trip
  - **Property 10: Configuration round-trip**
  - **Validates: Requirements 3.5, 7.3**

- [x] 18. Implement Google Review QR display
- [x] 18.1 Create Google QR component
  - Display title text from configuration
  - Render QR code image in center
  - Display description text with vertical movement animation (2-second duration)
  - Fetch QR code and config from backend
  - _Requirements: 8.1, 8.2, 8.3_

- [ ]\* 18.2 Write property test for QR display completeness
  - **Property 23: QR display completeness**
  - **Validates: Requirements 8.1**

- [ ]\* 18.3 Write property test for Google review settings round-trip
  - **Property 26: Google review settings round-trip**
  - **Validates: Requirements 8.5**

- [x] 19. Implement admin panel authentication
- [x] 19.1 Create login page
  - Create login form with username and password fields
  - Implement form validation
  - Handle login submission with error display
  - Redirect to dashboard on success
  - Store authentication state
  - _Requirements: 12.1, 12.3_

- [x] 19.2 Create authentication context and protected routes
  - Implement auth context with login/logout methods
  - Create protected route wrapper component
  - Redirect to login if not authenticated
  - Implement logout functionality
  - _Requirements: 12.4, 12.6_

- [ ]\* 19.3 Write property test for credential verification
  - **Property 36: Credential verification**
  - **Validates: Requirements 12.2**

- [ ]\* 19.4 Write property test for invalid credential rejection
  - **Property 37: Invalid credential rejection**
  - **Validates: Requirements 12.3**

- [x] 20. Implement admin dashboard
- [x] 20.1 Create dashboard page
  - Display today's survey count and total survey count
  - Show current kiosk mode and active content name
  - Display kiosk last seen timestamp and online/offline status
  - Show Google Sheets last sync timestamp
  - Display pending sync queue count
  - Implement auto-refresh every 10 seconds
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]\* 20.2 Write property test for dashboard metrics completeness
  - **Property 41: Dashboard metrics completeness**
  - **Validates: Requirements 13.1**

- [ ]\* 20.3 Write property test for system health completeness
  - **Property 44: System health completeness**
  - **Validates: Requirements 13.4**

- [ ]\* 20.4 Write property test for sync queue count consistency
  - **Property 34: Sync queue count consistency**
  - **Validates: Requirements 11.6**

- [x] 21. Implement massage management interface
- [x] 21.1 Create massage list page
  - Display table/list of all massages
  - Show massage name, type, featured/campaign flags, sort order
  - Implement edit and delete actions
  - Add "Create New Massage" button
  - Implement responsive layout for mobile devices
  - _Requirements: 4.1, 16.1, 16.2, 16.3_

- [x] 21.2 Create massage form component
  - Create form with all massage fields (name, descriptions, duration, media, sessions, tags, flags)
  - Implement field validation (required fields, length limits)
  - Add media upload with file type and size validation
  - Implement purpose tag multi-select
  - Add featured and campaign checkboxes
  - Handle form submission (create/update)
  - Display validation errors inline
  - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 21.3 Implement massage reordering
  - Add drag-and-drop or up/down buttons for reordering
  - Update sort order in backend on change
  - _Requirements: 4.7_

- [ ]\* 21.4 Write property test for purpose tag validity
  - **Property 16: Purpose tag validity**
  - **Validates: Requirements 4.6**

- [ ]\* 21.5 Write property test for massage ordering preservation
  - **Property 17: Massage ordering preservation**
  - **Validates: Requirements 4.7**

- [ ] 22. Implement kiosk mode control interface
- [x] 22.1 Create kiosk control page
  - Display current kiosk mode
  - Add mode selection dropdown (Digital Menu, Survey, Google QR)
  - Add survey template selector (shown when Survey mode selected)
  - Implement mode update with validation
  - Show success/error messages
  - _Requirements: 1.1, 1.4_

- [ ]\* 22.2 Write property test for mode change audit logging
  - **Property 3: Mode change audit logging**
  - **Validates: Requirements 1.5**

- [ ] 23. Implement survey template management interface
- [x] 23.1 Create survey template list page
  - Display Satisfaction and Discovery survey templates
  - Show template name, type, active status
  - Add edit action (no delete for default templates)
  - _Requirements: 9.1_

- [x] 23.2 Create survey template editor
  - Display template title and description fields
  - Show questions list with text and options
  - Allow editing question text and answer options
  - Implement question ordering
  - Add required field toggle
  - Handle template update submission
  - _Requirements: 9.2, 9.3, 9.4_

- [ ]\* 23.3 Write property test for default survey templates presence
  - **Property 27: Default survey templates presence**
  - **Validates: Requirements 9.1**

- [ ]\* 23.4 Write property test for survey template update persistence
  - **Property 28: Survey template update persistence**
  - **Validates: Requirements 9.2, 9.3**

- [ ]\* 23.5 Write property test for required question validation
  - **Property 30: Required question validation**
  - **Validates: Requirements 9.5**

- [ ] 24. Implement survey responses view
- [x] 24.1 Create survey responses page
  - Display table of survey responses with filters
  - Show survey type, timestamp, answers, sync status
  - Implement date range filtering
  - Add export to CSV functionality
  - Implement responsive layout for mobile
  - _Requirements: 11.6, 16.1, 16.2, 16.3_

- [ ] 25. Implement system settings interface
- [x] 25.1 Create settings page
  - Display slideshow timeout input (5-300 seconds)
  - Display survey timeout input (5-300 seconds)
  - Display Google QR display duration input (5-300 seconds)
  - Show unit labels ("seconds") for all timing fields
  - Add Google Sheets configuration section (Sheet ID, sheet name, credentials)
  - Implement "Test Connection" button for Google Sheets
  - Add password change section
  - Implement settings save with validation
  - Display validation errors
  - _Requirements: 8.5, 11.7, 12.5, 18.1, 18.2, 18.3, 18.4_

- [ ]\* 25.2 Write property test for settings display completeness
  - **Property 50: Settings display completeness**
  - **Validates: Requirements 18.1**

- [ ]\* 25.3 Write property test for settings unit display
  - **Property 53: Settings unit display**
  - **Validates: Requirements 18.4**

- [ ]\* 25.4 Write property test for settings update round-trip
  - **Property 52: Settings update round-trip**
  - **Validates: Requirements 18.3**

- [ ]\* 25.5 Write property test for Sheets configuration validation
  - **Property 35: Sheets configuration validation**
  - **Validates: Requirements 11.7**

- [ ] 26. Implement backup and system logs interface
- [x] 26.1 Create backup page
  - Display last backup timestamp
  - Add "Download Backup" button
  - Show backup file size and contents summary
  - Implement backup download functionality
  - _Requirements: 14.2, 14.4_

- [x] 26.2 Create system logs viewer
  - Display recent system logs with filtering by level
  - Show timestamp, level, message, details
  - Implement pagination
  - Add search functionality
  - _Requirements: 1.5_

- [ ]\* 26.3 Write property test for backup timestamp consistency
  - **Property 47: Backup timestamp consistency**
  - **Validates: Requirements 14.4**

- [ ] 27. Implement responsive design for admin panel
- [x] 27.1 Add mobile responsive styles
  - Implement hamburger menu navigation for mobile (<768px)
  - Stack form fields vertically on mobile
  - Make input fields full-width on mobile
  - Ensure touch targets are minimum 44x44px
  - Convert tables to card layout or horizontal scroll on mobile
  - Test on various mobile devices
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [-] 28. Optimize animations for Raspberry Pi performance
- [ ] 28.1 Implement performance-optimized animations
  - Use only CSS transform and opacity for animations
  - Limit concurrent animations to maximum 3 elements
  - Set fade transitions to 300ms duration
  - Implement slideshow transitions with 5-second intervals
  - Add will-change CSS property strategically
  - Ensure Lottie animations are under 50KB
  - Test frame rate on Raspberry Pi hardware (target 30+ FPS)
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ]\* 28.2 Write property test for Lottie file size constraint
  - **Property 49: Lottie file size constraint**
  - **Validates: Requirements 17.4**

- [x] 29. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 30. Build and optimize frontend for production
- [x] 30.1 Configure production build
  - Optimize Vite build configuration
  - Enable code splitting for better loading
  - Minimize bundle size
  - Configure asset optimization
  - Set up environment variables for production
  - Build both kiosk and admin applications
  - _Requirements: All frontend requirements_

- [x] 30.2 Test production build locally
  - Serve production build locally
  - Test kiosk functionality
  - Test admin panel functionality
  - Verify offline caching works
  - Test on various screen sizes
  - _Requirements: All frontend requirements_

- [x] 31. Create deployment scripts and documentation
- [x] 31.1 Create Raspberry Pi setup scripts
  - Write database initialization script
  - Create start-kiosk.sh script for Chromium autostart
  - Create watchdog-kiosk.sh script for browser monitoring
  - Write PM2 ecosystem configuration
  - Create autostart desktop files
  - Add cron job for daily Chromium restart
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 31.2 Write deployment documentation
  - Document hardware requirements
  - Write step-by-step installation guide
  - Document environment configuration
  - Add troubleshooting section
  - Document backup and restore procedures
  - Add maintenance checklist
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 32. Implement error handling and logging
- [x] 32.1 Add comprehensive error handling
  - Implement frontend error boundaries
  - Add backend error handling middleware
  - Implement structured logging with levels
  - Add error logging to system_logs table
  - Implement log rotation
  - Add user-friendly error messages
  - _Requirements: All requirements (cross-cutting concern)_

- [-] 33. Implement security measures
- [ ] 33.1 Add security middleware and configurations
  - Configure rate limiting with localhost whitelist
  - Set up secure session configuration
  - Add input validation middleware
  - Implement CORS configuration
  - Add security headers
  - Configure file upload restrictions
  - _Requirements: 12.1, 12.2, 12.3, 4.3_

- [ ]\* 33.2 Write unit tests for security measures
  - Test rate limiting blocks excessive requests
  - Test rate limiting whitelists localhost
  - Test file upload restrictions
  - Test input validation
  - _Requirements: 12.1, 4.3_

- [ ] 34. Final integration testing and optimization
- [x] 34.1 Perform end-to-end testing
  - Test complete massage creation and display flow
  - Test survey submission and sync flow
  - Test kiosk mode switching
  - Test offline/online transitions
  - Test admin panel on mobile devices
  - Test Google Sheets synchronization with real account
  - Verify QR codes scan correctly
  - Test system behavior during network interruptions
  - _Requirements: All requirements_

- [x] 34.2 Performance testing and optimization
  - Test kiosk performance on Raspberry Pi hardware
  - Verify animation frame rates
  - Test database query performance with large datasets
  - Optimize slow queries if needed
  - Test concurrent admin panel users
  - Verify memory usage during extended operation
  - _Requirements: 10.3, 17.1, 17.2, 17.3_

- [x] 35. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
