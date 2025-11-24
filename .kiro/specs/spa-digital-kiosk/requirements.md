# Requirements Document

## Introduction

The SPA Digital Kiosk and Admin Panel system provides a touchscreen kiosk interface running on Raspberry Pi for spa reception areas, along with a web-based admin panel accessible from the local network. The kiosk displays three modes: digital spa menu, customer surveys, and Google review QR screen. All content is managed through the admin panel, and survey responses are stored locally with background synchronization to Google Sheets.

## Glossary

- **Kiosk Application**: The touchscreen interface running on Raspberry Pi that displays content to spa guests
- **Admin Panel**: The web-based management interface accessible from local network devices
- **Backend**: The server application managing data and business logic for both kiosk and admin panel
- **Kiosk Mode**: The current display state of the kiosk (Digital Menu, Survey, or Google Review QR)
- **Digital Menu**: The kiosk mode displaying massage services with videos, photos, and pricing
- **Survey Mode**: The kiosk mode displaying customer questionnaires
- **Google Review QR Mode**: The kiosk mode displaying a QR code linking to Google review page
- **Local Database**: SQLite database storing all system data locally on Raspberry Pi
- **Google Sheets Integration**: Background process synchronizing survey responses to Google Sheets
- **Massage Purpose Tags**: Categorization labels for massages (e.g., Relaxation, Pain Relief, Detox)
- **Featured Massage**: A massage marked to appear in the highlighted section of the digital menu
- **Campaign Massage**: A massage marked for promotional display in slideshow mode
- **Survey Template**: A predefined questionnaire structure with questions and answer options
- **Slideshow Mode**: Automatic display of featured/campaign massages during user inactivity
- **Timeout Period**: Duration of inactivity before triggering automatic actions

## Requirements

### Requirement 1: Kiosk Mode Management

**User Story:** As a spa receptionist, I want to control which screen the kiosk displays from the admin panel, so that I can switch between menu, survey, and review modes based on operational needs.

#### Acceptance Criteria

1. WHEN a receptionist selects a kiosk mode in the admin panel and clicks update, THE Backend SHALL store the new mode state in the Local Database
2. WHEN the Kiosk Application polls for mode updates, THE Backend SHALL return the current mode state within 3 seconds
3. WHEN the Backend updates the kiosk mode state, THE Kiosk Application SHALL transition to the new mode within 5 seconds
4. WHERE Survey Mode is selected, THE Admin Panel SHALL require selection of an active Survey Template before allowing mode update
5. WHEN the kiosk mode is updated, THE Backend SHALL log the mode change with timestamp and user identifier

### Requirement 2: Digital Menu Display

**User Story:** As a spa guest, I want to browse massage services on the kiosk touchscreen, so that I can learn about available treatments before making a decision.

#### Acceptance Criteria

1. WHEN the Kiosk Application is in Digital Menu mode, THE Kiosk Application SHALL display a massage list in the left column occupying one-quarter of screen width
2. WHEN the Kiosk Application displays the massage list, THE Kiosk Application SHALL show Featured Massages in a separate block at the top of the list
3. WHEN a guest touches a massage card in the list, THE Kiosk Application SHALL display the selected massage details in the right panel with a fade transition animation lasting 300 milliseconds
4. WHEN the Kiosk Application displays massage details, THE Kiosk Application SHALL show massage name, long description, duration, session pricing, and Massage Purpose Tags
5. WHERE a massage has video media, THE Kiosk Application SHALL autoplay the video in muted mode with infinite loop
6. WHERE a massage has photo media, THE Kiosk Application SHALL display the photo filling the media area while maintaining aspect ratio
7. WHEN displaying massage cards, THE Kiosk Application SHALL show massage name, short description, and Massage Purpose Tags as small chips
8. IF a media file fails to load or is corrupted, THEN THE Kiosk Application SHALL display a default placeholder image from system assets

### Requirement 3: Slideshow Activation

**User Story:** As a spa manager, I want the kiosk to automatically display promotional content during inactivity, so that featured massages are showcased to passing guests.

#### Acceptance Criteria

1. WHILE the Kiosk Application is in Digital Menu mode, WHEN no touch input is detected for the configured Timeout Period, THE Kiosk Application SHALL activate Slideshow Mode
2. WHEN Slideshow Mode activates, THE Kiosk Application SHALL display Campaign Massages and Featured Massages in sequence
3. WHEN displaying each massage in Slideshow Mode, THE Kiosk Application SHALL show the massage visual with fade and scale animations, massage name, and promotional text for 5 seconds
4. WHEN a guest touches the screen during Slideshow Mode, THE Kiosk Application SHALL immediately exit Slideshow Mode and return to standard Digital Menu display
5. WHEN the Admin Panel configures the slideshow Timeout Period, THE Backend SHALL store the value in the Local Database with a default of 60 seconds

### Requirement 4: Massage Content Management

**User Story:** As a spa receptionist, I want to add and edit massage information in the admin panel, so that the digital menu displays current and accurate service details.

#### Acceptance Criteria

1. WHEN a receptionist creates a new massage entry, THE Admin Panel SHALL require massage name and short description as mandatory fields
2. WHEN a receptionist saves massage information, THE Backend SHALL store massage name, short description, long description, duration, media type, media URL, session pricing list, Massage Purpose Tags, featured flag, and campaign flag in the Local Database
3. WHEN a receptionist uploads massage media, THE Admin Panel SHALL accept video files in MP4 format and image files in JPEG or PNG format
4. WHEN a receptionist marks a massage as featured, THE Backend SHALL include the massage in the Featured Massages list returned to the Kiosk Application
5. WHEN a receptionist marks a massage as campaign, THE Backend SHALL include the massage in the Campaign Massages list for Slideshow Mode
6. WHEN a receptionist assigns Massage Purpose Tags, THE Admin Panel SHALL allow selection of multiple tags from predefined options including Relaxation, Pain Relief, Detox, Flexibility, and Post-Sport Recovery
7. WHEN a receptionist reorders massages, THE Backend SHALL store the sort order and THE Kiosk Application SHALL display massages according to the stored order

### Requirement 5: Customer Satisfaction Survey

**User Story:** As a spa manager, I want to collect customer satisfaction feedback through the kiosk, so that I can measure service quality and identify improvement areas.

#### Acceptance Criteria

1. WHEN the Kiosk Application is in Survey Mode with Satisfaction Survey Template active, THE Kiosk Application SHALL display the question "What is your overall satisfaction rating" with rating options from 1 to 5
2. WHEN a guest selects rating 1, 2, or 3, THE Kiosk Application SHALL display a follow-up question "Why were you not satisfied" with single-choice options including "Massage was not as expected", "Environment temperature or noise was uncomfortable", "Staff-related issue", "Price", and "Other"
3. WHEN a guest selects a dissatisfaction reason and clicks submit, THE Backend SHALL store the rating and reason in the Local Database with timestamp
4. WHEN a guest selects rating 4 or 5, THE Kiosk Application SHALL display a thank you message with text "Thank you. Would you like to leave a review on Google" and a button labeled "Show Google review QR code"
5. WHEN a guest clicks the Google review button, THE Kiosk Application SHALL temporarily switch to Google Review QR Mode for the configured display duration
6. WHEN the Google Review QR display duration expires, THE Kiosk Application SHALL return to the Survey Mode initial screen
7. WHEN survey responses are stored, THE Backend SHALL add them to the Google Sheets Integration synchronization queue

### Requirement 6: Discovery Survey

**User Story:** As a spa marketing manager, I want to understand how customers discover our spa, so that I can optimize marketing channel investments.

#### Acceptance Criteria

1. WHEN the Kiosk Application is in Survey Mode with Discovery Survey Template active, THE Kiosk Application SHALL display the question "How did you hear about us" with single-choice options including "Google search results", "Instagram", "Friend recommendation", "Saw while passing by", and "Other"
2. WHEN a guest selects a discovery channel, THE Kiosk Application SHALL display an optional second question "Have you had spa experience before" with options "Yes" and "No"
3. WHEN a guest completes selections and clicks submit, THE Backend SHALL store the responses in the Local Database with timestamp
4. WHEN survey responses are stored, THE Backend SHALL add them to the Google Sheets Integration synchronization queue
5. WHEN survey submission completes, THE Kiosk Application SHALL display a thank you screen with fade animation for 3 seconds, then return to survey initial screen

### Requirement 7: Survey Timeout Handling

**User Story:** As a spa receptionist, I want incomplete surveys to reset automatically, so that the kiosk is ready for the next guest without manual intervention.

#### Acceptance Criteria

1. WHILE the Kiosk Application is in Survey Mode, WHEN no touch input is detected for the configured survey Timeout Period, THE Kiosk Application SHALL clear all selected answers
2. WHEN the survey timeout triggers, THE Kiosk Application SHALL return to the first question of the active Survey Template
3. WHEN the Admin Panel configures the survey Timeout Period, THE Backend SHALL store the value in the Local Database with a default of 60 seconds
4. WHEN a guest interacts with the survey, THE Kiosk Application SHALL reset the timeout counter to zero

### Requirement 8: Google Review QR Display

**User Story:** As a spa manager, I want guests to easily access our Google review page via QR code, so that satisfied customers can share positive feedback online.

#### Acceptance Criteria

1. WHEN the Kiosk Application is in Google Review QR Mode, THE Kiosk Application SHALL display a title, a QR code in the center, and descriptive text below
2. WHEN generating the QR code, THE Backend SHALL use the Google review URL configured in the Admin Panel
3. WHEN displaying the descriptive text, THE Kiosk Application SHALL apply a subtle vertical movement animation with 2-second duration
4. WHEN a guest scans the QR code with a mobile device, THE mobile device SHALL open the configured Google review page URL
5. WHEN the Admin Panel saves Google review settings, THE Backend SHALL store the review URL, title text, and description text in the Local Database

### Requirement 9: Survey Template Management

**User Story:** As a spa receptionist, I want to customize survey questions and options in the admin panel, so that surveys remain relevant to current business needs.

#### Acceptance Criteria

1. WHEN the Admin Panel displays survey templates, THE Admin Panel SHALL show Satisfaction Survey Template and Discovery Survey Template as non-deletable entries
2. WHEN a receptionist edits a Survey Template, THE Admin Panel SHALL allow modification of title text, description text, question text, and answer options
3. WHEN a receptionist saves Survey Template changes, THE Backend SHALL store the updated template in the Local Database
4. WHEN the Kiosk Application loads a Survey Template, THE Backend SHALL return all questions with answer options in the defined order
5. WHERE a survey question is configured as mandatory, THE Kiosk Application SHALL prevent form submission until the question is answered

### Requirement 10: Local Data Storage

**User Story:** As a system administrator, I want all data stored locally on the Raspberry Pi, so that the system operates reliably without depending on internet connectivity.

#### Acceptance Criteria

1. WHEN the Backend starts, THE Backend SHALL initialize a SQLite Local Database file on the Raspberry Pi storage
2. WHEN any data modification occurs, THE Backend SHALL write changes to the Local Database before returning success response
3. WHEN the Kiosk Application requests data, THE Backend SHALL read from the Local Database and return results within 1 second
4. WHEN survey responses are submitted, THE Backend SHALL store responses in the Local Database immediately, regardless of internet connectivity status
5. WHEN the system experiences power loss, THE Local Database SHALL preserve all data committed before the interruption

### Requirement 11: Google Sheets Synchronization

**User Story:** As a spa manager, I want survey responses automatically synchronized to Google Sheets, so that I can analyze data using familiar spreadsheet tools.

#### Acceptance Criteria

1. WHEN survey responses are stored in the Local Database, THE Backend SHALL add entries to the synchronization queue table
2. WHILE the Google Sheets Integration process runs, WHEN internet connectivity is available, THE Backend SHALL send queued survey responses to the configured Google Sheet
3. WHEN a survey response is successfully sent to Google Sheets, THE Backend SHALL mark the queue entry as synchronized and record the timestamp
4. IF internet connectivity is unavailable, THEN THE Backend SHALL retain responses in the synchronization queue and retry when connectivity is restored
5. IF synchronization fails, THEN THE Backend SHALL retry every 5 minutes using an exponential backoff strategy with maximum interval of 30 minutes
6. WHEN the Admin Panel displays system status, THE Admin Panel SHALL show the count of survey responses awaiting synchronization
7. WHEN the Admin Panel configures Google Sheets connection, THE Admin Panel SHALL require Sheet ID, sheet name, and authentication credentials
8. WHEN the Admin Panel tests Google Sheets connection, THE Backend SHALL attempt to write a test row and return success or error message within 10 seconds

### Requirement 12: Admin Panel Authentication

**User Story:** As a spa manager, I want the admin panel protected by password authentication, so that only authorized staff can modify system settings.

#### Acceptance Criteria

1. WHEN a user accesses the Admin Panel URL, THE Admin Panel SHALL display a login screen requiring username and password
2. WHEN a user submits login credentials, THE Backend SHALL verify credentials against stored values in the Local Database
3. IF credentials are invalid, THEN THE Admin Panel SHALL display an error message and prevent access to management features
4. WHEN credentials are valid, THE Backend SHALL create an authenticated session and THE Admin Panel SHALL display the dashboard
5. WHEN a user changes the admin password, THE Backend SHALL hash the new password before storing in the Local Database
6. WHEN a user logs out, THE Backend SHALL invalidate the session and THE Admin Panel SHALL return to the login screen

### Requirement 13: System Dashboard

**User Story:** As a spa receptionist, I want to see system status at a glance, so that I can quickly verify the kiosk is operating correctly.

#### Acceptance Criteria

1. WHEN the Admin Panel displays the dashboard, THE Admin Panel SHALL show today's survey count, total survey count, current kiosk mode, and system health indicators
2. WHERE the current kiosk mode is Digital Menu, THE Admin Panel SHALL display the name of the currently selected massage
3. WHERE the current kiosk mode is Survey Mode, THE Admin Panel SHALL display the name of the active Survey Template
4. WHEN displaying system health, THE Admin Panel SHALL show kiosk last communication timestamp, kiosk online/offline status, Google Sheets last sync timestamp, and count of pending synchronization queue entries
5. WHEN the Kiosk Application communicates with the Backend, THE Backend SHALL update the last communication timestamp in the Local Database

### Requirement 14: Data Backup

**User Story:** As a system administrator, I want to download backup files of system data, so that I can restore information if hardware failure occurs.

#### Acceptance Criteria

1. WHEN the Backend performs daily backup, THE Backend SHALL export Local Database contents to JSON or CSV format file
2. WHEN a user clicks the download backup button in the Admin Panel, THE Backend SHALL generate a backup file and initiate download to the user's device
3. WHEN generating backup files, THE Backend SHALL include all massage data, survey templates, survey responses, system settings, and synchronization queue status
4. WHEN the Admin Panel displays backup information, THE Admin Panel SHALL show the timestamp of the last automatic backup
5. WHEN backup files and system logs exceed 30 days of age, THE Backend SHALL automatically delete them to prevent storage overflow on the Raspberry Pi SD card

### Requirement 15: Kiosk Autostart and Display Configuration

**User Story:** As a spa receptionist, I want the kiosk to start automatically when the Raspberry Pi powers on, so that I don't need to manually launch the application each day.

#### Acceptance Criteria

1. WHEN the Raspberry Pi completes boot sequence, THE operating system SHALL automatically launch a web browser in fullscreen mode
2. WHEN the browser launches, THE browser SHALL navigate to the Kiosk Application URL at http://localhost:3000/kiosk
3. WHEN the Kiosk Application loads, THE Kiosk Application SHALL display the current mode screen within 3 seconds
4. WHERE the Backend is not yet ready, THE Kiosk Application SHALL display a loading indicator and retry connection every 2 seconds
5. WHEN the Kiosk Application renders, THE Kiosk Application SHALL be optimized for 1920x1080 landscape resolution on a 15.6 inch touchscreen display

### Requirement 16: Responsive Admin Interface

**User Story:** As a spa receptionist, I want to access the admin panel from my mobile phone, so that I can make quick updates without using a computer.

#### Acceptance Criteria

1. WHEN the Admin Panel is accessed from a mobile device, THE Admin Panel SHALL adapt layout to fit screen width below 768 pixels
2. WHEN displaying forms on mobile devices, THE Admin Panel SHALL stack form fields vertically and expand input fields to full width
3. WHEN displaying tables on mobile devices, THE Admin Panel SHALL enable horizontal scrolling or convert to card-based layout
4. WHEN touch interactions occur on mobile devices, THE Admin Panel SHALL provide touch targets with minimum size of 44x44 pixels

### Requirement 17: Animation Performance

**User Story:** As a spa guest, I want smooth visual transitions on the kiosk, so that the interface feels responsive and professional.

#### Acceptance Criteria

1. WHEN the Kiosk Application displays animations, THE Kiosk Application SHALL use CSS transform and opacity properties to minimize rendering cost
2. WHEN transitioning between massage details, THE Kiosk Application SHALL complete fade animations within 300 milliseconds
3. WHEN displaying slideshow transitions, THE Kiosk Application SHALL maintain frame rate above 30 frames per second on Raspberry Pi hardware
4. WHERE Lottie animations are used, THE Kiosk Application SHALL limit file size to maximum 50 kilobytes per animation
5. WHEN multiple elements animate simultaneously, THE Kiosk Application SHALL limit concurrent animations to maximum 3 elements

### Requirement 18: System Configuration

**User Story:** As a system administrator, I want to adjust timing and behavior settings, so that the kiosk operates optimally for our specific environment.

#### Acceptance Criteria

1. WHEN the Admin Panel displays system settings, THE Admin Panel SHALL provide input fields for slideshow timeout duration, survey timeout duration, and Google Review QR display duration
2. WHEN a user saves timing settings, THE Backend SHALL validate that duration values are positive integers between 5 and 300 seconds
3. WHEN timing settings are updated, THE Backend SHALL store new values in the Local Database and THE Kiosk Application SHALL apply new values within 10 seconds
4. WHEN the Admin Panel displays timing settings, THE Admin Panel SHALL show current values with units clearly labeled as seconds

### Requirement 19: Offline Kiosk Content Cache

**User Story:** As a spa receptionist, I want the kiosk to continue displaying content when the backend is temporarily unavailable, so that guests can still browse the menu during technical issues.

#### Acceptance Criteria

1. WHEN the Kiosk Application successfully retrieves data from the Backend, THE Kiosk Application SHALL cache the digital menu data, active Survey Template, and kiosk mode state in browser local storage
2. WHEN the Kiosk Application cannot reach the Backend, THE Kiosk Application SHALL use cached data to display the digital menu and active survey screens
3. WHILE the Backend is unreachable, THE Kiosk Application SHALL continue to accept user interactions with cached content
4. WHILE the Backend is unreachable, IF a guest submits a survey response, THEN THE Kiosk Application SHALL store the response in browser local storage queue
5. WHEN the Backend becomes reachable again, THE Kiosk Application SHALL fetch updated content within 10 seconds
6. WHEN the Backend becomes reachable again, THE Kiosk Application SHALL send queued survey responses from browser local storage to the Backend
7. WHEN the Kiosk Application displays cached content, THE Kiosk Application SHALL show a subtle indicator that offline mode is active
