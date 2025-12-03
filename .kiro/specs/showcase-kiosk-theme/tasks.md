# Implementation Plan

- [ ] 1. Extend theme system for Showcase theme





  - [x] 1.1 Add 'showcase' to KioskThemeId type in kioskTheme.ts


    - Add 'showcase' to the union type
    - Create showcaseTheme configuration object with color palette
    - Add to kioskThemes map and themesList array
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1_
  - [ ]* 1.2 Write property test for theme persistence
    - **Property 13: Theme Persistence**
    - **Validates: Requirements 7.2**
  - [x] 1.3 Update kioskStore to support showcase theme


    - Ensure theme state accepts 'showcase' value
    - Verify persistence to localStorage/database
    - _Requirements: 7.2_
-

- [ ] 2. Implement massage selection algorithm





  - [x] 2.1 Create selectDisplayMassages utility function

    - Filter featured massages first
    - Fill remaining slots with non-featured if needed
    - Return exactly 4 massages (or fewer if not enough exist)
    - _Requirements: 1.2_
  - [ ]* 2.2 Write property test for massage selection priority
    - **Property 2: Massage Selection Priority**
    - **Validates: Requirements 1.2**

- [ ] 3. Create ShowcaseColumn component




  - [x] 3.1 Implement base column structure with video player

    - Create ShowcaseColumn.tsx component
    - Add looping video with muted autoplay
    - Apply 16px border-radius to video container
    - Handle video load errors with gradient placeholder
    - _Requirements: 1.4, 1.5_
  - [x] 3.2 Add column label overlay (name + benefit)

    - Position at bottom of column
    - Style with white text (18px) and teal benefit (14px)
    - Add text truncation for preview state
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.3 Implement expand/collapse width transitions

    - Main column: ~40% width
    - Preview columns: ~20% width each
    - Use CSS transitions with ease-out timing (400ms)
    - _Requirements: 1.3, 3.1, 3.2, 3.3, 6.2_
  - [ ]* 3.4 Write property test for column layout invariant
    - **Property 1: Column Layout Invariant**
    - **Validates: Requirements 1.1, 1.3**
  - [ ]* 3.5 Write property test for single main column invariant
    - **Property 3: Single Main Column Invariant**
    - **Validates: Requirements 3.1, 3.2**

- [-] 4. Create GlassDetailCard component


  - [x] 4.1 Implement glass-morphism card structure

    - Create GlassDetailCard.tsx component
    - Apply backdrop blur (16px), semi-transparent background
    - Add subtle border (1px white at 20% opacity)
    - Position on right side of screen
    - _Requirements: 4.5, 5.5_
  - [x] 4.2 Add card content (title, description, duration)

    - Display massage title (24px white text)
    - Show full description (16px, line-height 1.6)
    - Add duration with clock icon
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 4.3 Implement slide-in/slide-out animations


    - Slide in from right (300ms ease-out)
    - Slide out to right (200ms)
    - Sync visibility with column selection
    - _Requirements: 3.4, 3.5, 6.3_
  - [ ]* 4.4 Write property test for glass card visibility sync
    - **Property 4: Glass Card Visibility Sync**
    - **Validates: Requirements 3.4, 4.1, 4.2, 4.3**
-

- [x] 5. Implement pricing section



  - [x] 5.1 Add conditional "Show Prices" button


    - Only display if massage has sessions
    - Style with teal accent color
    - _Requirements: 4.4_
  - [x] 5.2 Create expandable pricing list


    - Show session name and price in Turkish Lira format
    - Make scrollable if many sessions
    - Add "Hide Prices" button when expanded
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [x] 5.3 Implement pricing state reset on card close


    - Reset showPricing to false when card closes
    - _Requirements: 11.5_
  - [ ]* 5.4 Write property test for pricing button conditional display
    - **Property 5: Pricing Button Conditional Display**
    - **Validates: Requirements 4.4**
  - [ ]* 5.5 Write property test for pricing toggle state
    - **Property 10: Pricing Toggle State**
    - **Validates: Requirements 11.1, 11.4**
  - [ ]* 5.6 Write property test for price format consistency
    - **Property 11: Price Format Consistency**
    - **Validates: Requirements 11.2**
  - [ ]* 5.7 Write property test for pricing reset on close
    - **Property 12: Pricing Reset on Close**
    - **Validates: Requirements 11.5**

- [ ] 6. Create ShowcaseMode main component




  - [x] 6.1 Implement four-column layout container

    - Create ShowcaseMode.tsx component
    - Render 4 ShowcaseColumn components
    - Apply dark navy/charcoal gradient background
    - _Requirements: 1.1, 5.1_
  - [x] 6.2 Add column selection state management

    - Track selectedIndex (0-3)
    - Handle column tap to change selection
    - Manage GlassDetailCard visibility
    - _Requirements: 3.1, 3.2_
  - [x] 6.3 Implement staggered entrance animations

    - Fade in columns with 100ms stagger delay
    - _Requirements: 6.5_
-

- [ ] 7. Implement auto-cycling behavior



  - [x] 7.1 Add auto-advance timer (10 second interval)

    - Increment selectedIndex every 10 seconds
    - Wrap from index 3 back to 0
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 7.2 Implement pause on user interaction

    - Pause auto-cycling for 60 seconds on any tap
    - Resume from current index after pause
    - _Requirements: 8.4, 8.5_
  - [ ]* 7.3 Write property test for auto-cycle sequence
    - **Property 6: Auto-Cycle Sequence**
    - **Validates: Requirements 8.1, 8.2, 8.3**
  - [ ]* 7.4 Write property test for pause/resume behavior
    - **Property 7: Pause/Resume Behavior**
    - **Validates: Requirements 8.4, 8.5**
-

- [ ] 8. Implement touch interactions



  - [x] 8.1 Add touch feedback on column tap


    - Subtle scale or brightness change on touch
    - Ensure 44x44px minimum touch targets
    - _Requirements: 10.1, 10.2_
  - [x] 8.2 Implement horizontal swipe navigation


    - Left swipe: next column (increment index)
    - Right swipe: previous column (decrement index)
    - _Requirements: 10.3_
  - [x] 8.3 Add click-outside to dismiss glass card


    - Tapping outside card area closes it
    - Deselect column when card dismissed
    - _Requirements: 10.5_
  - [ ]* 8.4 Write property test for swipe navigation direction
    - **Property 8: Swipe Navigation Direction**
    - **Validates: Requirements 10.3**
  - [ ]* 8.5 Write property test for click-outside dismissal
    - **Property 9: Click-Outside Dismissal**
    - **Validates: Requirements 10.5**

- [ ] 9. Integrate with DigitalMenuMode




  - [x] 9.1 Add showcase theme conditional rendering


    - Check theme === 'showcase' in DigitalMenuMode
    - Render ShowcaseMode component when active
    - _Requirements: 7.3_
  - [x] 9.2 Update KioskModeRouter if needed


    - Ensure smooth transitions to/from showcase theme
    - _Requirements: 7.3_



- [x] 10. Performance optimizations



  - [x] 10.1 Implement video lazy loading

    - Only load video sources for visible columns
    - Defer loading for off-screen columns
    - _Requirements: 9.4_
  - [ ] 10.2 Add GPU-accelerated animations
    - Use CSS transforms and opacity for animations
    - Add will-change hints for animated properties
    - _Requirements: 9.1, 9.2, 9.3_




  - [ ]* 10.3 Write property test for video lazy loading
    - **Property 14: Video Lazy Loading**



    - **Validates: Requirements 9.4**





- [ ] 11. Update admin settings UI
  - [ ] 11.1 Add Showcase theme option to settings page
    - Add to theme selector dropdown/cards

    - Include preview thumbnail
    - _Requirements: 7.1, 7.4_





- [ ] 12. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Final integration and polish

  - [ ] 13.1 Test on 15.6" horizontal screen resolution
    - Verify layout at 1920x1080 and 1366x768
    - Adjust spacing if needed
    - _Requirements: 1.1, 1.3_
  - [ ] 13.2 Verify Raspberry Pi performance
    - Test animation smoothness (target 30fps)
    - Monitor memory usage with 4 videos
    - _Requirements: 9.1, 9.2, 9.3_


- [ ] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
