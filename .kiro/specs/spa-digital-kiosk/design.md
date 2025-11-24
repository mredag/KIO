# Design Document

## Overview

The SPA Digital Kiosk and Admin Panel system is a full-stack web application designed to run on Raspberry Pi hardware. The system consists of three main components:

1. **Kiosk Frontend**: A touchscreen-optimized React application that displays content to spa guests
2. **Admin Panel Frontend**: A responsive web interface for content management and system control
3. **Backend API**: A Node.js/Express server managing data, business logic, and external integrations

The architecture prioritizes offline resilience, with the kiosk capable of operating independently when the backend is temporarily unavailable. All data is stored locally in SQLite, with asynchronous synchronization to Google Sheets for analytics.

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Raspberry Pi Device                      │
│                                                              │
│  ┌────────────────┐         ┌──────────────────────┐       │
│  │ Kiosk Frontend │◄────────┤  Backend API Server  │       │
│  │   (React SPA)  │  HTTP   │   (Node.js/Express)  │       │
│  │  Port: 3000    │         │    Port: 3001        │       │
│  │  /kiosk route  │         │                      │       │
│  └────────────────┘         └──────────────────────┘       │
│         │                            │                      │
│         │ Browser                    │                      │
│         │ LocalStorage               │                      │
│         │ (Cache)                    ▼                      │
│         │                    ┌──────────────┐              │
│         └───────────────────►│   SQLite DB  │              │
│                               │  (Local)     │              │
│                               └──────────────┘              │
│                                       │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                                        │ HTTPS
                                        │ (Async Queue)
                                        ▼
                              ┌──────────────────┐
                              │  Google Sheets   │
                              │   (Cloud)        │
                              └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Local Network Devices                           │
│  ┌────────────────┐                                         │
│  │ Admin Panel    │                                         │
│  │  (React SPA)   │◄────────────────────────────────────────┤
│  │  Port: 3000    │  HTTP to Pi IP                          │
│  │  /admin route  │  (e.g., 192.168.1.100:3000/admin)      │
│  └────────────────┘                                         │
│  Mobile/Tablet/PC                                           │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend (Both Kiosk and Admin)**

- React 18+ with TypeScript
- React Router for navigation
- TanStack Query (React Query) for data fetching and caching
- Zustand for lightweight state management
- Motion One for performant animations (optimized for Raspberry Pi)
- Tailwind CSS for styling with responsive breakpoints
- Vite as build tool
- Kiosk optimized for 1920x1080 landscape touchscreen
- Admin panel responsive for mobile devices (768px breakpoint)

**Backend**

- Node.js 18+ with TypeScript
- Express.js for REST API
- SQLite3 with better-sqlite3 driver for database
  - WAL (Write-Ahead Logging) mode enabled for concurrent access
  - Allows multiple simultaneous readers while one writer is active
  - Critical for kiosk polling + admin operations + background sync
- Google Sheets API v4 for synchronization
- node-cron for scheduled tasks
- QRCode library for QR generation
- bcrypt for password hashing
- express-session for authentication

**Infrastructure**

- Raspberry Pi OS (Debian-based)
- Chromium browser in kiosk mode
- PM2 for process management
- Nginx as reverse proxy (optional)

### Deployment Model

The entire application runs on a single Raspberry Pi:

- Backend serves both the API and static frontend files
- Kiosk accesses via localhost (http://localhost:3000/kiosk)
- Admin panel accessed from network devices (http://[pi-ip]:3000/admin)
- Single build process produces both frontend applications
- Backend managed by PM2 for automatic restart and monitoring
- Chromium browser autostart in kiosk mode via systemd/autostart
- Watchdog script monitors browser health and restarts if crashed
- Daily Chromium restart at 4 AM to prevent memory leaks

**Kiosk Autostart Flow:**

1. Raspberry Pi boots
2. PM2 starts backend server (configured via pm2 startup)
3. Desktop environment loads
4. Autostart script launches Chromium in kiosk mode
5. Chromium navigates to http://localhost:3000/kiosk
6. Kiosk application loads and displays current mode
7. Watchdog script monitors Chromium process every 30 seconds
8. If Chromium crashes, watchdog automatically restarts it

## Components and Interfaces

### 1. Kiosk Frontend Component

**Responsibilities:**

- Display content based on current kiosk mode
- Handle touch interactions
- Cache content for offline operation
- Queue survey responses when offline
- Implement smooth animations and transitions

**Key Modules:**

```typescript
// Mode Router
interface KioskState {
  mode: 'digital-menu' | 'survey' | 'google-qr'
  activeSurveyId?: string
  lastSync: Date
  isOffline: boolean
}

// Kiosk polls for state updates every 3-5 seconds
// When mode changes in backend, kiosk detects within 5 seconds (Requirement 1.3)
// Polling interval: 3 seconds (ensures <5 second detection)

// Digital Menu
interface Massage {
  id: string
  name: string
  shortDescription: string
  longDescription: string
  duration: string
  mediaType: 'video' | 'photo'
  mediaUrl: string
  purposeTags: string[]
  sessions: Session[]
  isFeatured: boolean
  isCampaign: boolean
  sortOrder: number
}

interface Session {
  name: string
  price: number
}

// Survey
interface SurveyTemplate {
  id: string
  name: string
  type: 'satisfaction' | 'discovery'
  title: string
  description: string
  questions: Question[]
}

interface Question {
  id: string
  text: string
  type: 'rating' | 'single-choice'
  options: string[]
  isRequired: boolean
  conditionalOn?: { questionId: string; values: any[] }
}

// Survey Flow Examples:

// Satisfaction Survey Flow:
// 1. Q1: "What is your overall satisfaction rating?" (1-5)
//    - If 1, 2, or 3 → Show Q2 (dissatisfaction reason)
//    - If 4 or 5 → Show thank you with Google review button
// 2. Q2: "Why were you not satisfied?" (conditional)
//    - Options: "Massage not as expected", "Environment", "Staff", "Price", "Other"
//    - After submit → Show thank you screen
// 3. Google Review Button (only for ratings 4-5)
//    - Temporarily switches to Google QR mode
//    - Returns to survey after configured duration

// Discovery Survey Flow:
// 1. Q1: "How did you hear about us?"
//    - Options: "Google", "Instagram", "Friend", "Passing by", "Other"
// 2. Q2: "Have you had spa experience before?" (optional)
//    - Options: "Yes", "No"
// 3. After submit → Show thank you screen for 3 seconds → Reset

interface SurveyResponse {
  id: string
  surveyId: string
  timestamp: Date
  answers: Record<string, any>
  synced: boolean
}

// Google Review
interface GoogleReviewConfig {
  url: string
  title: string
  description: string
  displayDuration: number
}
```

**API Endpoints Used:**

- `GET /api/kiosk/state` - Fetch current mode and configuration (must respond <3s per Requirement 1.2)
- `GET /api/kiosk/menu` - Fetch massage list (must respond <1s per Requirement 10.3)
- `GET /api/kiosk/survey/:id` - Fetch survey template (must respond <1s per Requirement 10.3)
- `POST /api/kiosk/survey-response` - Submit survey response (queued if offline)
- `GET /api/kiosk/google-review` - Fetch Google review config
- `GET /api/kiosk/health` - Backend availability check (used during offline polling)

**Polling Strategy:**

- Kiosk polls `/api/kiosk/state` every 3 seconds
- Updates mode within 5 seconds of backend change (Requirement 1.3)
- Heartbeat updated on every kiosk request (Requirement 13.5)
- When offline, polls `/api/kiosk/health` every 10 seconds (Requirement 19.5)

**Caching Strategy (Offline Resilience):**

The kiosk is designed to operate independently when the backend is temporarily unavailable:

- Use React Query with staleTime of 5 minutes for normal operation
- Persist cache to localStorage using persistQueryClient plugin
- Cache includes: digital menu data, active survey template, kiosk mode state
- On network error, serve from cache indefinitely (no expiration)
- Poll for backend availability every 10 seconds when offline
- Display subtle offline indicator when using cached content
- Continue accepting user interactions with cached content
- Queue survey responses in localStorage when backend unreachable
- Automatically sync queued responses when connection restored (within 10 seconds)
- Fetch updated content immediately upon reconnection

**Offline Behavior by Mode:**

- **Digital Menu**: Display cached massage list, allow browsing, slideshow works
- **Survey Mode**: Display cached survey template, accept responses, queue submissions
- **Google QR Mode**: Display cached QR code and text

**Rationale**: Spa guests should have uninterrupted experience even during temporary backend issues (restart, maintenance, network glitch). Local caching ensures the kiosk remains functional.

### 2. Admin Panel Frontend Component

**Responsibilities:**

- Authenticate users
- Manage massage content
- Configure kiosk mode
- Edit survey templates
- View system status and analytics
- Configure system settings

**Key Modules:**

```typescript
// Authentication
interface AuthState {
  isAuthenticated: boolean
  user: { username: string } | null
}

// Dashboard
interface SystemStatus {
  todaySurveyCount: number
  totalSurveyCount: number
  currentKioskMode: string
  currentContent: string
  kioskLastSeen: Date
  kioskOnline: boolean
  sheetsLastSync: Date
  pendingSyncCount: number
}

// Massage Management
interface MassageFormData extends Massage {
  // Same as Massage interface
}

// System Settings
interface SystemSettings {
  slideshowTimeout: number // 5-300 seconds, default 60
  surveyTimeout: number // 5-300 seconds, default 60
  googleQrDisplayDuration: number // 5-300 seconds, default 10
  sheetsConfig: {
    sheetId: string
    sheetName: string
    credentials: string
  }
}
```

**Timing Configuration Details:**

All timeout values are configurable through the admin panel:

- **Slideshow Timeout**: Duration of inactivity before slideshow activates in Digital Menu mode
  - Range: 5-300 seconds
  - Default: 60 seconds
  - Applied to: Digital Menu mode only
- **Survey Timeout**: Duration of inactivity before survey resets to first question
  - Range: 5-300 seconds
  - Default: 60 seconds
  - Applied to: Survey mode only
  - Resets on any touch interaction
- **Google QR Display Duration**: How long QR screen shows after high satisfaction rating
  - Range: 5-300 seconds
  - Default: 10 seconds
  - Applied to: Temporary QR display from survey flow
  - Returns to survey initial screen after duration expires

Values are validated on save and applied to kiosk within 10 seconds via polling mechanism.

**Responsive Design Strategy:**

The admin panel adapts to different screen sizes:

- **Desktop (≥768px)**: Full layout with sidebar navigation, multi-column forms
- **Mobile (<768px)**:
  - Stacked vertical layout
  - Hamburger menu navigation
  - Full-width form fields
  - Touch-optimized buttons (minimum 44x44px)
  - Horizontal scrolling tables or card-based layouts
  - Optimized for one-handed operation

**Animation Performance Optimization:**

To ensure smooth performance on Raspberry Pi hardware:

- Use CSS `transform` and `opacity` only (GPU-accelerated)
- Limit concurrent animations to 3 elements maximum
- Fade transitions: 300ms duration
- Slideshow transitions: 5 seconds per slide with fade/scale
- Lottie animations: Maximum 50KB file size
- Target 30+ FPS on Raspberry Pi 4
- Use `will-change` CSS property sparingly
- Avoid animating `width`, `height`, `top`, `left` (causes reflow)

````

**API Endpoints Used:**
- `POST /api/admin/login` - Authenticate
- `POST /api/admin/logout` - End session
- `GET /api/admin/dashboard` - Fetch dashboard data
- `GET /api/admin/massages` - List massages
- `POST /api/admin/massages` - Create massage
- `PUT /api/admin/massages/:id` - Update massage
- `DELETE /api/admin/massages/:id` - Delete massage
- `PUT /api/admin/kiosk/mode` - Update kiosk mode
- `GET /api/admin/surveys` - List survey templates
- `PUT /api/admin/surveys/:id` - Update survey template
- `GET /api/admin/survey-responses` - List responses
- `GET /api/admin/settings` - Fetch settings
- `PUT /api/admin/settings` - Update settings
- `POST /api/admin/test-sheets` - Test Google Sheets connection
- `GET /api/admin/backup` - Download backup file

### 3. Backend API Component

**Responsibilities:**
- Serve REST API endpoints
- Manage SQLite database operations
- Handle authentication and sessions
- Process survey response queue
- Synchronize data to Google Sheets
- Generate QR codes
- Perform automated backups
- Serve static frontend files

**Core Services:**

```typescript
// Database Service
class DatabaseService {
  private db: Database;

  constructor(dbPath: string) {
    // better-sqlite3 is synchronous and faster than async sqlite3
    this.db = new Database(dbPath);

    // Enable WAL mode for concurrent access
    // WAL allows multiple readers + one writer simultaneously
    // Without WAL: writes block all reads (problematic for kiosk polling)
    // With WAL: kiosk can read while admin writes, sync can write while kiosk reads
    this.db.pragma('journal_mode = WAL');

    // Additional optimizations
    this.db.pragma('synchronous = NORMAL'); // Faster writes, still safe with WAL
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY'); // Temp tables in RAM
  }

  // Massage operations
  getMassages(): Massage[];
  getMassageById(id: string): Massage | null;
  createMassage(data: MassageFormData): Massage;
  updateMassage(id: string, data: Partial<MassageFormData>): Massage;
  deleteMassage(id: string): void;

  // Survey operations
  getSurveyTemplates(): SurveyTemplate[];
  getSurveyById(id: string): SurveyTemplate | null;
  updateSurvey(id: string, data: Partial<SurveyTemplate>): SurveyTemplate;
  createSurveyResponse(response: SurveyResponse): void;
  getSurveyResponses(filters?: any): SurveyResponse[];

  // Kiosk state
  getKioskState(): KioskState;
  updateKioskState(state: Partial<KioskState>): void;
  updateKioskHeartbeat(): void; // Called on every kiosk API request

  // Settings
  getSettings(): SystemSettings;
  updateSettings(settings: Partial<SystemSettings>): void;

  // Auth
  verifyCredentials(username: string, password: string): boolean;
  updatePassword(hashedPassword: string): void;

  // Transaction support for atomic operations
  transaction<T>(fn: () => T): T {
    // better-sqlite3 provides automatic transaction support
    // Ensures atomicity for multi-step operations
    return this.db.transaction(fn)();
  }
}

// Google Sheets Service
class GoogleSheetsService {
  private auth: GoogleAuth;
  private sheets: sheets_v4.Sheets;

  async initialize(credentials: string): Promise<void>;
  async testConnection(sheetId: string, sheetName: string): Promise<boolean>;
  async appendRow(sheetId: string, sheetName: string, values: any[]): Promise<void>;
  async syncQueuedResponses(): Promise<number>; // Returns count synced
}

// Sync Queue Service
class SyncQueueService {
  constructor(
    private db: DatabaseService,
    private sheets: GoogleSheetsService
  ) {}

  async processQueue(): Promise<void> {
    // Get unsynced responses
    // Attempt to send to Google Sheets
    // Mark as synced on success
    // Implement exponential backoff on failure
  }

  scheduleSync(): void {
    // Run every 5 minutes using node-cron
  }
}
````

**Google Sheets Synchronization Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Survey Response Flow                          │
└─────────────────────────────────────────────────────────────────┘

1. Guest Submits Survey
   │
   ▼
┌──────────────────┐
│ Kiosk Frontend   │
│ POST /api/survey │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ Backend API                                                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Transaction (Atomic)                                     │   │
│  │                                                          │   │
│  │  1. INSERT INTO survey_responses                        │   │
│  │     (id, survey_id, answers, synced=0, created_at)      │   │
│  │                                                          │   │
│  │  2. Response stored in SQLite (WAL mode)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ✓ Return 200 OK to kiosk (response saved locally)              │
└───────────────────────────────────────────────────────────────────┘
         │
         │ (Async - happens in background)
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ Sync Queue Service (Cron: Every 5 minutes)                       │
│                                                                   │
│  1. SELECT * FROM survey_responses WHERE synced = 0             │
│                                                                   │
│  2. For each unsynced response:                                  │
│     ┌──────────────────────────────────────────────────┐       │
│     │ Try to send to Google Sheets                     │       │
│     │                                                   │       │
│     │ ┌─────────────────────────────────────┐         │       │
│     │ │ Internet Available?                 │         │       │
│     │ └──────────┬──────────────────────────┘         │       │
│     │            │                                     │       │
│     │     ┌──────┴──────┐                             │       │
│     │     │             │                             │       │
│     │    YES           NO                             │       │
│     │     │             │                             │       │
│     │     ▼             ▼                             │       │
│     │  ┌─────┐      ┌──────┐                         │       │
│     │  │Send │      │ Wait │                         │       │
│     │  │ API │      │Retry │                         │       │
│     │  └──┬──┘      └──────┘                         │       │
│     │     │                                           │       │
│     │  ┌──┴───────┐                                  │       │
│     │  │ Success? │                                  │       │
│     │  └──┬───┬───┘                                  │       │
│     │     │   │                                      │       │
│     │    YES  NO                                     │       │
│     │     │   │                                      │       │
│     │     │   └─► Increment sync_attempts           │       │
│     │     │       Update last_sync_attempt          │       │
│     │     │       Exponential backoff:              │       │
│     │     │       - Attempt 1: Retry in 5 min       │       │
│     │     │       - Attempt 2: Retry in 10 min      │       │
│     │     │       - Attempt 3: Retry in 20 min      │       │
│     │     │       - Attempt 4+: Retry in 30 min     │       │
│     │     │                                          │       │
│     │     ▼                                          │       │
│     │  UPDATE survey_responses                      │       │
│     │  SET synced = 1,                              │       │
│     │      synced_at = NOW()                        │       │
│     │  WHERE id = ?                                 │       │
│     └──────────────────────────────────────────────────┘       │
│                                                                   │
│  3. Log sync results to system_logs                             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Google Sheets   │
│  New row added   │
│  with survey data│
└──────────────────┘

Key Points:
- Guest never waits for Google Sheets (immediate response)
- Local database is source of truth
- Sync happens asynchronously in background
- Failed syncs retry automatically with backoff
- Admin dashboard shows pending sync count
- System works offline, syncs when connection restored
```

// Backup Service
class BackupService {
constructor(private db: DatabaseService) {}

async createBackup(): Promise<string> {
// Export all tables to JSON
// With WAL mode, we can read during backup without blocking writes
// Alternative: Use VACUUM INTO for binary backup
// Return file path
}

async scheduleDaily(): void {
// Run at 3 AM daily
}

async cleanOldBackups(): void {
// Delete files older than 30 days
}
}

// QR Code Service
class QRCodeService {
async generateQR(url: string): Promise<string> {
// Return base64 data URL
}
}

````

**Media Management:**

```typescript
// Media Service
class MediaService {
  private uploadDir = './public/uploads';
  private maxVideoSize = 50 * 1024 * 1024; // 50MB
  private maxImageSize = 5 * 1024 * 1024; // 5MB

  async uploadMedia(file: Express.Multer.File): Promise<string> {
    // Validate file type and size
    // Generate unique filename
    // Save to uploads directory
    // Return public URL path
  }

  async deleteMedia(url: string): Promise<void> {
    // Remove file from uploads directory
    // Called when massage is deleted
  }

  async optimizeVideo(filePath: string): Promise<void> {
    // Optional: Use ffmpeg to compress video
    // Reduce bitrate for Raspberry Pi playback
    // Target: 720p, H.264, ~2-3 Mbps
  }

  getDiskUsage(): { used: number; available: number } {
    // Monitor SD card space
    // Alert when < 1GB available
  }
}
````

**Static File Serving:**

- `/uploads/*` - Media files (videos, images)
- `/assets/*` - Application assets (logos, placeholders)
- Frontend build served from `/public/dist`

**Middleware:**

- `authMiddleware`: Verify session for admin routes
- `rateLimitMiddleware`: Limit requests (with kiosk whitelist)
- `errorHandler`: Centralized error handling
- `requestLogger`: Log all requests
- `multerUpload`: Handle file uploads with size limits

**Scheduled Jobs:**

- Sync queue processing: Every 5 minutes
- Daily backup: 3:00 AM
- Old file cleanup: Daily at 4:00 AM
- Kiosk heartbeat check: Every minute

## Data Models

### Concurrency and Transaction Strategy

**Read Operations (No Locking Needed):**

- Kiosk polling for mode/content updates
- Admin dashboard queries
- Survey template retrieval
- Settings retrieval

These operations benefit from WAL mode's concurrent read capability.

**Write Operations (Automatic WAL Handling):**

- Massage creation/update/delete
- Survey response submission
- Kiosk mode changes
- Settings updates

better-sqlite3 handles write serialization automatically. Multiple write requests are queued and executed sequentially.

**Transaction Usage:**

Use transactions for operations that must be atomic:

```typescript
// Example: Creating massage with audit log (atomic)
db.transaction(() => {
  const massage = db.createMassage(data)
  db.createLog({
    level: 'info',
    message: 'Massage created',
    details: { massageId: massage.id },
  })
})()

// Example: Survey response + queue entry (atomic)
db.transaction(() => {
  db.createSurveyResponse(response)
  db.addToSyncQueue(response.id)
})()
```

**Concurrency Patterns:**

1. **Optimistic Reads**: Kiosk reads without locking, accepts eventual consistency
2. **Serialized Writes**: better-sqlite3 queues writes automatically
3. **No Distributed Locks**: Single-process architecture eliminates need for complex locking
4. **Retry Logic**: Frontend retries failed requests (network issues, not concurrency)

**Why better-sqlite3 vs node-sqlite3:**

- Synchronous API (simpler code, no callback/promise complexity)
- 2-3x faster for most operations
- Better memory efficiency
- Easier transaction handling
- Still supports concurrent access via WAL mode
- Easily meets <1 second query requirement for all operations

**Performance Characteristics:**

- Simple queries (get by ID): <10ms
- List queries with filters: <50ms
- Complex joins: <100ms
- All well within the 1-second requirement from Requirement 10.3

### Database Schema

```sql
-- Massages table
CREATE TABLE massages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  long_description TEXT,
  duration TEXT,
  media_type TEXT CHECK(media_type IN ('video', 'photo')),
  media_url TEXT,
  purpose_tags TEXT, -- JSON array
  sessions TEXT, -- JSON array of {name, price}
  is_featured INTEGER DEFAULT 0,
  is_campaign INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Survey templates table
CREATE TABLE survey_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('satisfaction', 'discovery')),
  title TEXT NOT NULL,
  description TEXT,
  questions TEXT NOT NULL, -- JSON array
  is_active INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Survey responses table
CREATE TABLE survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  answers TEXT NOT NULL, -- JSON object
  synced INTEGER DEFAULT 0,
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (survey_id) REFERENCES survey_templates(id)
);

-- Kiosk state table (single row)
CREATE TABLE kiosk_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT CHECK(mode IN ('digital-menu', 'survey', 'google-qr')),
  active_survey_id TEXT,
  last_heartbeat DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (active_survey_id) REFERENCES survey_templates(id)
);

-- System settings table (single row)
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  slideshow_timeout INTEGER DEFAULT 60,
  survey_timeout INTEGER DEFAULT 60,
  google_qr_display_duration INTEGER DEFAULT 10,
  google_review_url TEXT,
  google_review_title TEXT,
  google_review_description TEXT,
  sheets_sheet_id TEXT,
  sheets_sheet_name TEXT,
  sheets_credentials TEXT,
  admin_password_hash TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System logs table
CREATE TABLE system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT CHECK(level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  details TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_massages_featured ON massages(is_featured);
CREATE INDEX idx_massages_campaign ON massages(is_campaign);
CREATE INDEX idx_massages_sort ON massages(sort_order);
CREATE INDEX idx_survey_responses_synced ON survey_responses(synced);
CREATE INDEX idx_survey_responses_created ON survey_responses(created_at);
CREATE INDEX idx_system_logs_created ON system_logs(created_at);
```

### Data Validation Rules

**Massage:**

- name: Required, 1-100 characters
- shortDescription: Required, 1-200 characters
- longDescription: Optional, max 2000 characters
- mediaUrl: Optional, valid URL format
- sessions: Array with at least one item, each with name and positive price
- purposeTags: Array of strings from predefined list

**Survey Template:**

- name: Required, 1-100 characters
- questions: Array with at least one question
- Each question must have text and options (for choice questions)

**Survey Response:**

- Must reference existing survey template
- Answers must match question IDs in template
- Required questions must have answers

**System Settings:**

- Timeout values: 5-300 seconds
- URLs: Valid URL format
- Credentials: Valid JSON format

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Mode persistence

_For any_ kiosk mode selection saved through the admin panel, querying the database should return the same mode value.
**Validates: Requirements 1.1**

### Property 2: Survey mode validation

_For any_ attempt to set kiosk mode to Survey without specifying an active survey template, the system should reject the request.
**Validates: Requirements 1.4**

### Property 3: Mode change audit logging

_For any_ kiosk mode update operation, there should exist a corresponding log entry with timestamp and user identifier in the system logs table.
**Validates: Requirements 1.5**

### Property 4: Featured massage filtering

_For any_ set of massages where some are marked as featured, querying the massage list should return featured massages in a separate group at the top.
**Validates: Requirements 2.2**

### Property 5: Massage detail completeness

_For any_ massage displayed in detail view, the rendered output should contain massage name, long description, duration, session pricing, and purpose tags.
**Validates: Requirements 2.4**

### Property 6: Video autoplay configuration

_For any_ massage with media type set to video, the video player should be configured with muted audio and infinite loop enabled.
**Validates: Requirements 2.5**

### Property 7: Massage card completeness

_For any_ massage card rendered in the list, the output should contain massage name, short description, and purpose tags.
**Validates: Requirements 2.7**

### Property 8: Media fallback handling

_For any_ media file that fails to load, the display should show a default placeholder image from system assets.
**Validates: Requirements 2.8**

### Property 9: Slideshow content filtering

_For any_ slideshow activation, the displayed massages should only include those marked as campaign or featured.
**Validates: Requirements 3.2**

### Property 10: Configuration round-trip

_For any_ timeout configuration value saved in the admin panel, querying the settings should return the same value.
**Validates: Requirements 3.5, 7.3**

### Property 11: Massage creation validation

_For any_ massage creation attempt without name or short description fields, the system should reject the request.
**Validates: Requirements 4.1**

### Property 12: Massage data round-trip

_For any_ massage saved with all fields (name, descriptions, duration, media, sessions, tags, flags), retrieving the massage should return all fields with identical values.
**Validates: Requirements 4.2**

### Property 13: Media format validation

_For any_ file upload, the system should accept only MP4 video files and JPEG/PNG image files, rejecting all other formats.
**Validates: Requirements 4.3**

### Property 14: Featured massage inclusion

_For any_ massage marked with featured flag set to true, the massage should appear in the featured massages query results.
**Validates: Requirements 4.4**

### Property 15: Campaign massage inclusion

_For any_ massage marked with campaign flag set to true, the massage should appear in the campaign massages query results for slideshow.
**Validates: Requirements 4.5**

### Property 16: Purpose tag validity

_For any_ massage with assigned purpose tags, all tags should be from the predefined set: Relaxation, Pain Relief, Detox, Flexibility, Post-Sport Recovery.
**Validates: Requirements 4.6**

### Property 17: Massage ordering preservation

_For any_ massage list with defined sort order, retrieving the list should return massages in the same order as stored.
**Validates: Requirements 4.7**

### Property 18: Conditional question display

_For any_ satisfaction survey response with rating 1, 2, or 3, the follow-up dissatisfaction question should be displayed.
**Validates: Requirements 5.2**

### Property 19: Survey response persistence

_For any_ survey submission with answers, the database should contain a record with all answers and timestamp.
**Validates: Requirements 5.3, 6.3**

### Property 20: High rating Google prompt

_For any_ satisfaction survey response with rating 4 or 5, the thank you message should include the Google review QR button.
**Validates: Requirements 5.4**

### Property 21: Survey queue creation

_For any_ survey response stored in the database, there should exist a corresponding entry in the synchronization queue table.
**Validates: Requirements 5.7, 6.4, 11.1**

### Property 22: Discovery survey flow

_For any_ discovery survey where the first question is answered, the optional second question should be displayed.
**Validates: Requirements 6.2**

### Property 23: QR display completeness

_For any_ Google Review QR mode display, the screen should contain title text, QR code image, and description text.
**Validates: Requirements 8.1**

### Property 24: QR URL encoding

_For any_ Google review URL configured in settings, the generated QR code should encode that exact URL.
**Validates: Requirements 8.2**

### Property 25: QR code scanning correctness

_For any_ generated QR code, scanning it should yield the original configured Google review URL.
**Validates: Requirements 8.4**

### Property 26: Google review settings round-trip

_For any_ Google review configuration saved (URL, title, description), retrieving the settings should return identical values.
**Validates: Requirements 8.5**

### Property 27: Default survey templates presence

_For any_ query of survey templates, the results should always include Satisfaction Survey Template and Discovery Survey Template marked as non-deletable.
**Validates: Requirements 9.1**

### Property 28: Survey template update persistence

_For any_ survey template with modified title, description, questions, or options, retrieving the template should return the updated values.
**Validates: Requirements 9.2, 9.3**

### Property 29: Survey question ordering preservation

_For any_ survey template with defined question order, loading the template should return questions in the same sequence.
**Validates: Requirements 9.4**

### Property 30: Required question validation

_For any_ survey with mandatory questions, submission attempts without answers to required questions should be rejected.
**Validates: Requirements 9.5**

### Property 31: Data persistence before response

_For any_ successful API response to a data modification request, the changes should already be committed to the database.
**Validates: Requirements 10.2**

### Property 32: Offline survey storage

_For any_ survey submission when internet connectivity is unavailable, the response should be successfully stored in the local database.
**Validates: Requirements 10.4**

### Property 33: Sync status update

_For any_ survey response successfully sent to Google Sheets, the queue entry should be marked as synchronized with a timestamp.
**Validates: Requirements 11.3**

### Property 34: Sync queue count consistency

_For any_ system status query, the displayed pending sync count should equal the number of unsynced entries in the queue table.
**Validates: Requirements 11.6**

### Property 35: Sheets configuration validation

_For any_ Google Sheets configuration attempt without Sheet ID, sheet name, or credentials, the system should reject the request.
**Validates: Requirements 11.7**

### Property 36: Credential verification

_For any_ login attempt, the system should verify the submitted password against the hashed password stored in the database.
**Validates: Requirements 12.2**

### Property 37: Invalid credential rejection

_For any_ login attempt with invalid credentials, access to admin features should be denied and an error message displayed.
**Validates: Requirements 12.3**

### Property 38: Session creation on valid login

_For any_ login attempt with valid credentials, an authenticated session should be created in the backend.
**Validates: Requirements 12.4**

### Property 39: Password hashing on change

_For any_ password change operation, the value stored in the database should be a bcrypt hash, not plaintext.
**Validates: Requirements 12.5**

### Property 40: Session invalidation on logout

_For any_ logout operation, subsequent requests using the same session should be rejected as unauthorized.
**Validates: Requirements 12.6**

### Property 41: Dashboard metrics completeness

_For any_ dashboard query, the response should include today's survey count, total survey count, current kiosk mode, and system health indicators.
**Validates: Requirements 13.1**

### Property 42: Digital menu mode display

_For any_ dashboard query when kiosk mode is Digital Menu, the response should include the currently selected massage name.
**Validates: Requirements 13.2**

### Property 43: Survey mode display

_For any_ dashboard query when kiosk mode is Survey, the response should include the active survey template name.
**Validates: Requirements 13.3**

### Property 44: System health completeness

_For any_ system health display, the data should include kiosk last communication timestamp, online/offline status, Sheets last sync timestamp, and pending sync count.
**Validates: Requirements 13.4**

### Property 45: Heartbeat timestamp update

_For any_ API request from the kiosk application, the backend should update the last communication timestamp in the database.
**Validates: Requirements 13.5**

### Property 46: Backup data completeness

_For any_ generated backup file, the contents should include all massages, survey templates, survey responses, system settings, and synchronization queue entries.
**Validates: Requirements 14.3**

### Property 47: Backup timestamp consistency

_For any_ backup information display, the shown timestamp should match the actual last backup file creation time.
**Validates: Requirements 14.4**

### Property 48: Old file cleanup

_For any_ backup files or system logs older than 30 days, they should be automatically deleted during the cleanup process.
**Validates: Requirements 14.5**

### Property 49: Lottie file size constraint

_For any_ Lottie animation file used in the application, the file size should not exceed 50 kilobytes.
**Validates: Requirements 17.4**

### Property 50: Settings display completeness

_For any_ system settings display, the interface should show input fields for slideshow timeout, survey timeout, and Google QR display duration.
**Validates: Requirements 18.1**

### Property 51: Timing value validation

_For any_ timing setting save attempt with values outside the range 5-300 seconds, the system should reject the request.
**Validates: Requirements 18.2**

### Property 52: Settings update round-trip

_For any_ timing settings saved, retrieving the settings should return the same values.
**Validates: Requirements 18.3**

### Property 53: Settings unit display

_For any_ timing settings display, each value should be labeled with "seconds" as the unit.
**Validates: Requirements 18.4**

### Property 54: Kiosk data caching

_For any_ successful data fetch from the backend, the kiosk should store the menu data, survey template, and mode state in browser local storage.
**Validates: Requirements 19.1**

### Property 55: Offline cache fallback

_For any_ backend connection failure, the kiosk should display content from cached data in local storage.
**Validates: Requirements 19.2**

### Property 56: Offline interaction support

_For any_ user interaction while the backend is unreachable, the kiosk should process the interaction using cached content.
**Validates: Requirements 19.3**

### Property 57: Offline survey queueing

_For any_ survey submission while the backend is unreachable, the response should be stored in the browser local storage queue.
**Validates: Requirements 19.4**

### Property 58: Reconnection queue processing

_For any_ backend reconnection event, all queued survey responses in browser local storage should be sent to the backend.
**Validates: Requirements 19.6**

### Property 59: Offline mode indicator

_For any_ kiosk display using cached content, a visual indicator should be shown to communicate offline status.
**Validates: Requirements 19.7**

## Error Handling

### Frontend Error Handling

**Network Errors:**

- Kiosk: Fall back to cached content, show offline indicator
- Admin Panel: Display user-friendly error messages, suggest checking connection
- Both: Implement automatic retry with exponential backoff

**Validation Errors:**

- Display inline error messages next to form fields
- Prevent form submission until errors are resolved
- Highlight required fields that are empty

**Media Loading Errors:**

- Display placeholder images for failed media
- Log errors for debugging
- Continue displaying other content normally

**Authentication Errors:**

- Redirect to login page on session expiration
- Display clear error messages for invalid credentials
- Implement rate limiting to prevent brute force attacks

### Backend Error Handling

**Database Errors:**

- Log detailed error information
- Return generic error messages to clients (avoid exposing internals)
- Implement transaction rollback for data consistency
- Retry transient errors (e.g., database locked)

**Google Sheets API Errors:**

- Catch and log API errors
- Keep responses in queue for retry
- Implement exponential backoff (5min, 10min, 20min, 30min max)
- Display sync status in admin dashboard

**File System Errors:**

- Handle missing media files gracefully
- Log errors when backup creation fails
- Ensure sufficient disk space before operations

**Validation Errors:**

- Return 400 Bad Request with detailed error messages
- Validate all inputs before database operations
- Use TypeScript types for compile-time validation

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string // e.g., 'VALIDATION_ERROR', 'NOT_FOUND'
    message: string // User-friendly message
    details?: any // Additional context (dev mode only)
  }
}
```

### Logging Strategy

- Use structured logging with levels: info, warn, error
- Log all errors with stack traces
- Log authentication attempts
- Log sync operations and results
- Rotate logs daily, keep for 30 days
- Store logs in `system_logs` table

## Testing Strategy

### Unit Testing

**Backend Services:**

- DatabaseService: Test CRUD operations for all entities
- GoogleSheetsService: Test API integration with mocked responses
- SyncQueueService: Test queue processing logic
- BackupService: Test backup generation and cleanup
- QRCodeService: Test QR generation with various URLs
- Authentication: Test password hashing and verification

**Frontend Components:**

- Test component rendering with various props
- Test user interaction handlers
- Test form validation logic
- Test error state displays

**Test Examples:**

- Test massage creation with valid data succeeds
- Test massage creation without required fields fails
- Test survey submission stores data correctly
- Test login with invalid credentials fails
- Test backup includes all required data

### Property-Based Testing

The system uses property-based testing to verify universal correctness properties across all inputs. We'll use **fast-check** for JavaScript/TypeScript property-based testing.

**Configuration:**

- Each property test should run a minimum of 100 iterations
- Use appropriate generators for each data type
- Tag each test with the property number from this design document

**Test Tagging Format:**

```typescript
// Feature: spa-digital-kiosk, Property 12: Massage data round-trip
```

**Property Test Examples:**

```typescript
import fc from 'fast-check'

// Property 12: Massage data round-trip
test('Feature: spa-digital-kiosk, Property 12: Massage data round-trip', () => {
  fc.assert(
    fc.property(
      massageGenerator(), // Generates random valid massage data
      massage => {
        const saved = db.createMassage(massage)
        const retrieved = db.getMassageById(saved.id)

        expect(retrieved).toEqual(saved)
      }
    ),
    { numRuns: 100 }
  )
})

// Property 16: Purpose tag validity
test('Feature: spa-digital-kiosk, Property 16: Purpose tag validity', () => {
  const validTags = ['Relaxation', 'Pain Relief', 'Detox', 'Flexibility', 'Post-Sport Recovery']

  fc.assert(
    fc.property(massageWithTagsGenerator(), massage => {
      const allTagsValid = massage.purposeTags.every(tag => validTags.includes(tag))
      expect(allTagsValid).toBe(true)
    }),
    { numRuns: 100 }
  )
})

// Property 21: Survey queue creation
test('Feature: spa-digital-kiosk, Property 21: Survey queue creation', () => {
  fc.assert(
    fc.property(surveyResponseGenerator(), response => {
      db.createSurveyResponse(response)
      const queueEntry = db.getSyncQueueEntry(response.id)

      expect(queueEntry).toBeDefined()
      expect(queueEntry.synced).toBe(false)
    }),
    { numRuns: 100 }
  )
})

// Property 51: Timing value validation
test('Feature: spa-digital-kiosk, Property 51: Timing value validation', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1000, max: 1000 }).filter(n => n < 5 || n > 300),
      invalidValue => {
        expect(() => {
          db.updateSettings({ slideshowTimeout: invalidValue })
        }).toThrow()
      }
    ),
    { numRuns: 100 }
  )
})
```

**Generators:**

```typescript
// Generate random massage data
const massageGenerator = () =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    shortDescription: fc.string({ minLength: 1, maxLength: 200 }),
    longDescription: fc.option(fc.string({ maxLength: 2000 })),
    duration: fc.string(),
    mediaType: fc.constantFrom('video', 'photo'),
    mediaUrl: fc.webUrl(),
    purposeTags: fc.array(
      fc.constantFrom('Relaxation', 'Pain Relief', 'Detox', 'Flexibility', 'Post-Sport Recovery'),
      { minLength: 1, maxLength: 5 }
    ),
    sessions: fc.array(
      fc.record({
        name: fc.string(),
        price: fc.integer({ min: 1, max: 10000 }),
      }),
      { minLength: 1, maxLength: 5 }
    ),
    isFeatured: fc.boolean(),
    isCampaign: fc.boolean(),
    sortOrder: fc.integer({ min: 0, max: 1000 }),
  })

// Generate random survey response
const surveyResponseGenerator = () =>
  fc.record({
    surveyId: fc.uuid(),
    answers: fc.dictionary(fc.string(), fc.anything()),
    timestamp: fc.date(),
  })
```

### Integration Testing

**API Endpoint Testing:**

- Test complete request/response cycles
- Test authentication middleware
- Test error handling for invalid inputs
- Test database transactions

**End-to-End Scenarios:**

- Test complete massage creation and display flow
- Test survey submission and sync flow
- Test kiosk mode switching
- Test offline/online transitions

### Performance Testing

**Load Testing:**

- Test concurrent admin panel users
- Test kiosk polling frequency impact
- Test database query performance with large datasets

**Animation Performance:**

- Verify frame rates on Raspberry Pi hardware
- Test slideshow transitions
- Measure memory usage during extended operation

### Manual Testing Checklist

- [ ] Verify kiosk displays correctly on 1920x1080 touchscreen
- [ ] Test touch interactions on physical device
- [ ] Verify admin panel on mobile devices
- [ ] Test Google Sheets synchronization with real account
- [ ] Verify QR codes scan correctly
- [ ] Test system behavior during network interruptions
- [ ] Verify autostart after Raspberry Pi reboot
- [ ] Test backup and restore procedures

## Deployment

### Raspberry Pi Setup

**Hardware Requirements:**

- Raspberry Pi 4 (4GB RAM minimum)
- 32GB+ microSD card (Class 10 or better)
- 15.6" touchscreen display (1920x1080)
- Stable power supply
- Ethernet or WiFi connection

**Software Installation:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Chromium browser
sudo apt install -y chromium-browser unclutter

# Clone and setup application
cd /home/pi
git clone <repository-url> spa-kiosk
cd spa-kiosk
npm install
npm run build

# Setup environment variables
cp .env.example .env
nano .env  # Configure settings

# Initialize database
npm run db:init

# Start backend with PM2
pm2 start npm --name "spa-backend" -- start
pm2 save
pm2 startup
```

**Kiosk Autostart Configuration:**

Create `/home/pi/.config/autostart/kiosk.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=SPA Kiosk
Exec=/home/pi/spa-kiosk/scripts/start-kiosk.sh
X-GNOME-Autostart-enabled=true
```

Create `/home/pi/spa-kiosk/scripts/start-kiosk.sh`:

```bash
#!/bin/bash

# Wait for network and backend
sleep 10

# Hide cursor
unclutter -idle 0 &

# Start Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --fast \
  --fast-start \
  --disable-features=TranslateUI \
  --disk-cache-dir=/dev/null \
  --password-store=basic \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  http://localhost:3000/kiosk
```

Make executable:

```bash
chmod +x /home/pi/spa-kiosk/scripts/start-kiosk.sh
```

**Watchdog Script for Browser Crash Recovery:**

Create `/home/pi/spa-kiosk/scripts/watchdog-kiosk.sh`:

```bash
#!/bin/bash

# Watchdog script to restart Chromium if it crashes
# Checks every 30 seconds if Chromium is running

while true; do
  sleep 30

  # Check if Chromium is running
  if ! pgrep -f "chromium-browser.*kiosk" > /dev/null; then
    echo "$(date): Chromium not running, restarting..." >> /home/pi/spa-kiosk/logs/watchdog.log

    # Kill any remaining Chromium processes
    pkill -9 chromium-browser

    # Wait a moment
    sleep 2

    # Restart kiosk
    /home/pi/spa-kiosk/scripts/start-kiosk.sh &
  fi
done
```

Make executable and add to autostart:

```bash
chmod +x /home/pi/spa-kiosk/scripts/watchdog-kiosk.sh
```

Create `/home/pi/.config/autostart/watchdog.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Kiosk Watchdog
Exec=/home/pi/spa-kiosk/scripts/watchdog-kiosk.sh
X-GNOME-Autostart-enabled=true
```

**Memory Management:**

To prevent memory leaks, add a daily Chromium restart via cron:

```bash
# Edit crontab
crontab -e

# Add line to restart Chromium at 4 AM daily
0 4 * * * pkill -9 chromium-browser && sleep 5 && /home/pi/spa-kiosk/scripts/start-kiosk.sh
```

### Environment Configuration

`.env` file:

```env
# Server
NODE_ENV=production
PORT=3000
API_PORT=3001

# Database
DATABASE_PATH=./data/spa-kiosk.db

# Session
SESSION_SECRET=<generate-random-secret>

# Admin Credentials (initial setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<set-secure-password>

# Google Sheets (configured via admin panel)
# GOOGLE_SHEETS_CREDENTIALS=<json-credentials>

# Backup
BACKUP_DIR=./backups
LOG_DIR=./logs

# Media uploads
UPLOAD_DIR=./public/uploads
MAX_VIDEO_SIZE=52428800  # 50MB in bytes
MAX_IMAGE_SIZE=5242880   # 5MB in bytes

# Timeouts (defaults, can be changed in admin panel)
SLIDESHOW_TIMEOUT=60
SURVEY_TIMEOUT=60
GOOGLE_QR_DURATION=10
```

**Directory Structure:**

```
spa-kiosk/
├── public/
│   ├── uploads/          # User-uploaded media (videos, images)
│   │   ├── videos/
│   │   └── images/
│   ├── assets/           # Static assets (logos, placeholders)
│   └── dist/             # Frontend build output
├── data/
│   └── spa-kiosk.db      # SQLite database
│       spa-kiosk.db-wal  # WAL file (auto-created)
│       spa-kiosk.db-shm  # Shared memory (auto-created)
├── backups/              # Database backups
├── logs/                 # Application logs
└── scripts/              # Deployment scripts
```

**Static File Serving Configuration:**

```typescript
// Express static file serving
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')))
app.use('/assets', express.static(path.join(__dirname, 'public/assets')))
app.use(express.static(path.join(__dirname, 'public/dist')))

// Media URLs in database stored as: /uploads/videos/abc123.mp4
// Frontend accesses as: http://localhost:3000/uploads/videos/abc123.mp4
```

### Database Initialization

```bash
npm run db:init
```

This script:

1. Creates SQLite database file
2. Enables WAL (Write-Ahead Logging) mode for concurrent access
3. Runs all schema migrations
4. Seeds default data (survey templates, admin user)
5. Creates necessary directories

**WAL Mode - Critical for Concurrency:**

SQLite's default journal mode (DELETE) locks the entire database during writes, blocking all reads. This is problematic for our use case where:

- Kiosk polls for updates every few seconds (reads)
- Admin panel modifies content (writes)
- Background sync writes survey responses (writes)
- Multiple admin users may access simultaneously (reads)

**WAL Mode Benefits:**

- **Multiple concurrent readers**: Unlimited simultaneous read operations
- **Readers don't block writers**: Kiosk can read while admin saves changes
- **Writers don't block readers**: Admin can write while kiosk polls for updates
- **Better performance**: Writes are faster, no need to wait for readers
- **Automatic checkpoint management**: SQLite handles WAL file maintenance

**How WAL Works:**

1. Writes go to a separate WAL file (not main database)
2. Readers see consistent snapshot of data
3. Periodically, WAL changes are checkpointed back to main database
4. better-sqlite3 handles all this automatically

**Concurrency Scenario Example:**

```
Time  | Kiosk (Read)      | Admin (Write)     | Sync (Write)
------|-------------------|-------------------|------------------
0ms   | GET /api/menu     |                   |
5ms   | Reading massages  | POST /api/massage |
10ms  | Returns data      | Writing to WAL    |
15ms  |                   | Returns success   | POST survey response
20ms  | GET /api/menu     |                   | Writing to WAL
25ms  | Reading (sees new)|                   | Returns success

Without WAL: Admin write at 5ms would block kiosk read until 10ms
With WAL: All operations proceed without blocking
```

**Important Notes:**

- better-sqlite3 is synchronous (simpler, no async/await needed)
- WAL mode creates additional files: `database.db-wal` and `database.db-shm`
- These files are automatically managed by SQLite
- Backup should be done when no writes are occurring (or use VACUUM INTO)

### Backup and Recovery

**Automated Backups:**

- Daily backups at 3:00 AM
- Stored in `/backups` directory
- Automatic cleanup of files older than 30 days

**Manual Backup:**

```bash
npm run backup
```

**Restore from Backup:**

```bash
npm run restore -- --file=./backups/backup-2024-01-15.json
```

### Monitoring

**PM2 Monitoring:**

```bash
pm2 status
pm2 logs spa-backend
pm2 monit
```

**System Health:**

- Access admin dashboard at `http://[pi-ip]:3000/admin`
- Check kiosk online status
- Monitor sync queue
- Review system logs

### Network Configuration

**Static IP (Recommended):**

Edit `/etc/dhcpcd.conf`:

```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

**Firewall:**

```bash
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Troubleshooting

**Kiosk not starting:**

- Check PM2 status: `pm2 status`
- Check logs: `pm2 logs spa-backend`
- Verify browser autostart: Check `/home/pi/.config/autostart/`

**Database errors:**

- Check file permissions: `ls -la data/`
- Verify disk space: `df -h`
- Check database integrity: `npm run db:check`

**Sync not working:**

- Verify internet connection
- Check Google Sheets credentials in admin panel
- Review sync queue in dashboard
- Check logs for API errors

**Performance issues:**

- Monitor CPU/RAM: `htop`
- Check SD card health
- Reduce animation complexity
- Clear browser cache

## Security Considerations

### Authentication

- Passwords hashed with bcrypt (cost factor 10)
- Session-based authentication with secure cookies
- Session timeout after 24 hours of inactivity
- Rate limiting on login endpoint (5 attempts per 15 minutes)

### Data Protection

- All data stored locally, no external transmission except Google Sheets
- Google Sheets credentials encrypted at rest
- No PII collected in surveys (anonymous responses)
- Regular automated backups

### Network Security

- Admin panel accessible only from local network
- No external API endpoints exposed
- Firewall configured to allow only necessary ports
- HTTPS recommended for production (via reverse proxy)

### Input Validation

- All user inputs validated on both client and server
- SQL injection prevented by parameterized queries
- XSS prevention through React's built-in escaping
- File upload restrictions (type and size)

### Access Control

- Kiosk has no access to admin functions
- Admin panel requires authentication
- No direct database access from frontend
- API endpoints protected by authentication middleware

## Security Considerations

### Authentication

- Passwords hashed with bcrypt (cost factor 10)
- Session-based authentication with secure cookies
- Session timeout after 24 hours of inactivity
- Rate limiting on login endpoint (5 attempts per 15 minutes)

### Rate Limiting Strategy

**Admin Endpoints:**

- Login: 5 attempts per 15 minutes per IP
- Other admin operations: 100 requests per minute per IP

**Kiosk Endpoints:**

- **No rate limiting for localhost (127.0.0.1)**
- Kiosk polls frequently and must not be blocked
- External access to kiosk endpoints blocked by firewall

**Implementation:**

```typescript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skip: req => {
    // Whitelist localhost for kiosk
    const ip = req.ip || req.connection.remoteAddress
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  },
})

app.use('/api/admin/login', rateLimiter)
```

### Data Protection

- All data stored locally, no external transmission except Google Sheets
- Google Sheets credentials encrypted at rest
- No PII collected in surveys (anonymous responses)
- Regular automated backups

### Network Security

- Admin panel accessible only from local network
- No external API endpoints exposed
- Firewall configured to allow only necessary ports
- HTTPS recommended for production (via reverse proxy)

### Input Validation

- All user inputs validated on both client and server
- SQL injection prevented by parameterized queries (better-sqlite3)
- XSS prevention through React's built-in escaping
- File upload restrictions (type and size)

### Access Control

- Kiosk has no access to admin functions
- Admin panel requires authentication
- No direct database access from frontend
- API endpoints protected by authentication middleware

### Media File Security

- File type validation (only MP4, JPEG, PNG)
- File size limits (50MB video, 5MB images)
- Unique filenames to prevent overwrites
- Stored outside web root, served via controlled endpoint

## Maintenance

### Regular Tasks

**Daily:**

- Automated backup (3:00 AM)
- Log rotation
- Old file cleanup

**Weekly:**

- Review system logs for errors
- Check disk space usage (SD card capacity)
- Verify Google Sheets sync status
- Review uploaded media file sizes

**Monthly:**

- Update system packages
- Review and update massage content
- Analyze survey response data
- Test backup restore procedure
- Clean up unused media files

**Disk Space Management:**

Raspberry Pi SD cards have limited capacity. Monitor and manage:

```bash
# Check disk usage
df -h

# Check uploads directory size
du -sh /home/pi/spa-kiosk/public/uploads

# Find large video files
find /home/pi/spa-kiosk/public/uploads -type f -size +20M -exec ls -lh {} \;

# Optional: Compress videos with ffmpeg
ffmpeg -i input.mp4 -vcodec h264 -acodec aac -b:v 2M output.mp4
```

**Recommended Limits:**

- Keep uploads directory under 10GB
- Limit individual videos to 50MB
- Use 720p resolution for videos (sufficient for kiosk display)
- Delete old/unused media when removing massages

### Updates

**Application Updates:**

```bash
cd /home/pi/spa-kiosk
git pull
npm install
npm run build
pm2 restart spa-backend
```

**System Updates:**

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

### Content Management

**Adding Massages:**

1. Login to admin panel
2. Navigate to Digital Menu section
3. Click "Add New Massage"
4. Fill in all required fields
5. Upload media (video or photo)
6. Select purpose tags
7. Mark as featured/campaign if desired
8. Save

**Updating Surveys:**

1. Login to admin panel
2. Navigate to Surveys section
3. Select template to edit
4. Modify questions and options
5. Save changes
6. Changes apply immediately to kiosk

**Changing Kiosk Mode:**

1. Login to admin panel
2. Navigate to Kiosk Control
3. Select desired mode
4. If Survey mode, select active template
5. Click "Update Kiosk"
6. Kiosk updates within 5 seconds

## Future Enhancements

### Potential Features (Out of MVP Scope)

- Multi-language support (Turkish/English toggle)
- Analytics dashboard with charts and trends
- Email notifications for low satisfaction scores
- Custom survey template creation (beyond two defaults)
- Video testimonials from satisfied customers
- Integration with booking system
- Staff performance tracking
- Promotional banner rotation
- Customer loyalty program integration
- SMS notifications for survey responses
- Advanced reporting and data export
- Remote management from cloud dashboard
- Multiple kiosk support from single admin panel
- A/B testing for massage descriptions
- Seasonal theme customization
