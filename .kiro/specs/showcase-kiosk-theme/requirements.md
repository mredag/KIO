# Requirements Document

## Introduction

This document specifies the requirements for a new kiosk theme called "Showcase" - a video-centric, four-column layout designed for 15.6" horizontal kiosk screens. The theme focuses exclusively on featured massages, displaying looping videos in a visually stunning dark navy/charcoal color palette with teal accents. The design emphasizes smooth, calm animations and a glass-morphism aesthetic for detail cards.

The Showcase theme represents the "holy grail" of kiosk presentation - maximizing visual impact while maintaining an elegant, spa-appropriate atmosphere.

## Glossary

- **Showcase_Theme**: A new kiosk display theme featuring a four-column video layout with smooth expand/collapse animations
- **Column**: A vertical video strip displaying a looping massage video with name and benefit label
- **Main_Column**: The currently selected/expanded column that dominates the center of the screen
- **Preview_Column**: The three non-selected columns that remain visible as narrow video strips
- **Glass_Card**: A frosted glass-style detail panel that slides in when a column is selected
- **Featured_Massage**: A massage item marked as featured in the database, prioritized for display
- **Kiosk_System**: The existing spa kiosk application running on Raspberry Pi hardware

## Requirements

### Requirement 1

**User Story:** As a spa customer, I want to see featured massage videos in an elegant four-column layout, so that I can quickly browse and compare different massage options visually.

#### Acceptance Criteria

1. WHEN the Showcase theme loads THEN the Kiosk_System SHALL display exactly four vertical columns spanning the full screen width
2. WHEN the theme initializes THEN the Kiosk_System SHALL populate columns with featured massages from the database, falling back to regular massages if fewer than four featured exist
3. WHEN displaying columns THEN the Kiosk_System SHALL render one Main_Column at approximately 40% width and three Preview_Columns at approximately 20% width each
4. WHEN rendering each column THEN the Kiosk_System SHALL display a looping video with rounded corners (16px radius) filling the column height
5. WHEN a video fails to load THEN the Kiosk_System SHALL display a gradient placeholder with the massage name centered

### Requirement 2

**User Story:** As a spa customer, I want to see massage names and benefits at the bottom of each video column, so that I can understand what each massage offers at a glance.

#### Acceptance Criteria

1. WHEN rendering a column THEN the Kiosk_System SHALL display the massage name at the bottom in white text with minimum 18px font size
2. WHEN rendering a column THEN the Kiosk_System SHALL display a short benefit label below the name in teal accent color with minimum 14px font size
3. WHEN the column is in Preview state THEN the Kiosk_System SHALL truncate text that exceeds the column width with ellipsis
4. WHEN the column is in Main state THEN the Kiosk_System SHALL display full text without truncation

### Requirement 3

**User Story:** As a spa customer, I want to tap a column to expand it and see more details, so that I can learn more about a specific massage.

#### Acceptance Criteria

1. WHEN a user taps a Preview_Column THEN the Kiosk_System SHALL animate that column to become the Main_Column within 400ms
2. WHEN a column expands to Main THEN the Kiosk_System SHALL smoothly shrink the previous Main_Column to Preview size
3. WHEN animating column transitions THEN the Kiosk_System SHALL use ease-out timing function for smooth, calm movement
4. WHEN a column becomes Main THEN the Kiosk_System SHALL slide in a Glass_Card from the right side within 300ms
5. WHEN a column becomes Preview THEN the Kiosk_System SHALL slide out any visible Glass_Card within 200ms

### Requirement 4

**User Story:** As a spa customer, I want to see detailed information in a glass-style card when I select a massage, so that I can make an informed decision.

#### Acceptance Criteria

1. WHEN the Glass_Card appears THEN the Kiosk_System SHALL display the massage title in white text with minimum 24px font size
2. WHEN the Glass_Card appears THEN the Kiosk_System SHALL display the full description with minimum 16px font size and adequate line height (1.6)
3. WHEN the Glass_Card appears THEN the Kiosk_System SHALL display the massage duration with a clock icon
4. WHEN the massage has pricing sessions THEN the Kiosk_System SHALL display a "Show Prices" button in teal accent color
5. WHEN the Glass_Card renders THEN the Kiosk_System SHALL apply backdrop blur (16px), semi-transparent background (rgba(255,255,255,0.1)), and subtle border (1px white at 20% opacity)

### Requirement 5

**User Story:** As a spa customer, I want the theme to have a calming dark color palette, so that the visual experience matches the spa atmosphere.

#### Acceptance Criteria

1. WHEN rendering the background THEN the Kiosk_System SHALL use a gradient from dark navy (#0a0f1a) to charcoal (#1a1f2e)
2. WHEN rendering primary text THEN the Kiosk_System SHALL use soft white (#f0f4f8) for optimal readability
3. WHEN rendering accent elements THEN the Kiosk_System SHALL use teal (#14b8a6) for interactive elements and highlights
4. WHEN rendering secondary text THEN the Kiosk_System SHALL use muted gray (#94a3b8) for supporting information
5. WHEN rendering the Glass_Card THEN the Kiosk_System SHALL use semi-transparent white with blur for the glass-morphism effect

### Requirement 6

**User Story:** As a spa customer, I want smooth animations throughout the interface, so that the experience feels premium and relaxing.

#### Acceptance Criteria

1. WHEN any animation plays THEN the Kiosk_System SHALL complete within 200-500ms to feel responsive yet calm
2. WHEN columns resize THEN the Kiosk_System SHALL animate width, opacity, and transform properties simultaneously
3. WHEN the Glass_Card slides THEN the Kiosk_System SHALL use translateX animation with ease-out timing
4. WHEN videos loop THEN the Kiosk_System SHALL ensure seamless looping without visible restart flicker
5. WHEN the theme loads THEN the Kiosk_System SHALL stagger column fade-in animations by 100ms each for elegant entrance

### Requirement 7

**User Story:** As a spa administrator, I want to select the Showcase theme from the admin panel, so that I can enable this new display mode for the kiosk.

#### Acceptance Criteria

1. WHEN viewing theme settings THEN the Admin_Panel SHALL display "Showcase" as a selectable theme option
2. WHEN the Showcase theme is selected THEN the Kiosk_System SHALL persist the selection to the database
3. WHEN the kiosk receives a theme change event THEN the Kiosk_System SHALL transition to the Showcase theme within 500ms
4. WHEN the Showcase theme is active THEN the Admin_Panel SHALL display a preview thumbnail showing the four-column layout

### Requirement 8

**User Story:** As a spa administrator, I want the Showcase theme to auto-cycle through featured massages, so that customers see variety without interaction.

#### Acceptance Criteria

1. WHEN no user interaction occurs for 10 seconds THEN the Kiosk_System SHALL automatically advance to the next column
2. WHEN auto-cycling THEN the Kiosk_System SHALL move through columns in left-to-right order
3. WHEN reaching the last column THEN the Kiosk_System SHALL cycle back to the first column
4. WHEN a user taps any column THEN the Kiosk_System SHALL pause auto-cycling for 60 seconds
5. WHEN auto-cycling resumes THEN the Kiosk_System SHALL continue from the currently selected column

### Requirement 9

**User Story:** As a system operator, I want the Showcase theme to perform well on Raspberry Pi hardware, so that the kiosk runs smoothly without lag.

#### Acceptance Criteria

1. WHEN rendering videos THEN the Kiosk_System SHALL use hardware-accelerated video decoding
2. WHEN animating THEN the Kiosk_System SHALL use CSS transforms and opacity for GPU acceleration
3. WHEN the theme is active THEN the Kiosk_System SHALL maintain minimum 30fps during animations
4. WHEN loading videos THEN the Kiosk_System SHALL lazy-load non-visible video sources
5. WHEN memory usage exceeds threshold THEN the Kiosk_System SHALL pause off-screen videos to conserve resources

### Requirement 10

**User Story:** As a spa customer, I want the Showcase theme to be touch-friendly, so that I can easily interact with the kiosk.

#### Acceptance Criteria

1. WHEN rendering touch targets THEN the Kiosk_System SHALL ensure minimum 44x44px touch areas for all interactive elements
2. WHEN a user touches a column THEN the Kiosk_System SHALL provide immediate visual feedback (subtle scale or brightness change)
3. WHEN a user swipes horizontally THEN the Kiosk_System SHALL navigate between columns in the swipe direction
4. WHEN displaying the Glass_Card THEN the Kiosk_System SHALL position it to not obscure the selected video column
5. WHEN the Glass_Card is visible THEN the Kiosk_System SHALL allow tapping outside to dismiss it

### Requirement 11

**User Story:** As a spa customer, I want to see pricing information when I tap the price button, so that I can understand the cost of different session options.

#### Acceptance Criteria

1. WHEN a user taps "Show Prices" THEN the Kiosk_System SHALL expand the Glass_Card to reveal pricing sessions
2. WHEN displaying prices THEN the Kiosk_System SHALL show session name and price in Turkish Lira format
3. WHEN multiple sessions exist THEN the Kiosk_System SHALL display them in a scrollable list if needed
4. WHEN prices are visible THEN the Kiosk_System SHALL display a "Hide Prices" button to collapse the section
5. WHEN the Glass_Card closes THEN the Kiosk_System SHALL reset the pricing section to collapsed state


