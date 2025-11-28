# Implementation Plan

- [x] 1. Set up foundation and shared components





  - [x] 1.1 Create theme system with light/dark mode support


    - Create ThemeContext and ThemeProvider in `frontend/src/contexts/ThemeContext.tsx`
    - Implement localStorage persistence for theme preference
    - Add CSS variables for theme colors in `frontend/src/index.css`
    - Create useTheme hook for consuming theme context
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 1.2 Write property test for theme persistence
    - **Property 3: Theme Persistence Round-Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 1.3 Create Toast notification system

    - Create ToastContext and ToastProvider in `frontend/src/contexts/ToastContext.tsx`
    - Implement Toast component with enter/exit animations
    - Support success, error, warning, info variants
    - Implement auto-dismiss and persistent toast logic
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ]* 1.4 Write property tests for toast behavior
    - **Property 12: Toast Notification Stacking**
    - **Property 13: Critical Toast Persistence**
    - **Validates: Requirements 9.1, 9.3**

  - [x] 1.5 Create Skeleton loader components

    - Create SkeletonText, SkeletonCard, SkeletonChart, SkeletonTable components
    - Implement pulse animation
    - _Requirements: 12.1, 12.2_
  - [ ]* 1.6 Write property test for skeleton loading
    - **Property 14: Skeleton Loading Display**
    - **Validates: Requirements 12.1**

- [x] 2. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
-

- [ ] 3. Build core layout components




  - [x] 3.1 Create new Sidebar component


    - Create `frontend/src/components/admin/Sidebar.tsx`
    - Implement collapsible sidebar with icon-only mode
    - Add navigation groups (Overview, Content, Kiosk, Coupons, System)
    - Implement mobile drawer mode for viewport < 768px
    - Add collapse toggle button with animation
    - Add theme toggle in sidebar footer
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ]* 3.2 Write property test for sidebar collapse
    - **Property 1: Sidebar Collapse State Toggle**
    - **Validates: Requirements 1.2**
  - [x] 3.3 Create Header component with breadcrumbs


    - Create `frontend/src/components/admin/Header.tsx`
    - Implement Breadcrumb component with navigation
    - Add search trigger button (Ctrl+K shortcut)
    - Add user menu dropdown
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [ ]* 3.4 Write property test for breadcrumb accuracy
    - **Property 11: Breadcrumb Path Accuracy**
    - **Validates: Requirements 10.1**
  - [x] 3.5 Create new AdminLayout component


    - Refactor `frontend/src/layouts/AdminLayout.tsx`
    - Integrate Sidebar, Header, and main content area
    - Implement responsive layout (3-col, 2-col, 1-col)
    - Add ToastProvider wrapper
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 3.6 Write property test for responsive layout
    - **Property 2: Responsive Layout Columns**
    - **Validates: Requirements 7.1, 7.2, 7.3**
-

- [x] 4. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Build dashboard widgets





  - [x] 5.1 Create KPI Card component

    - Create `frontend/src/components/admin/KPICard.tsx`
    - Implement animated number counting
    - Add trend indicator (up/down/neutral)
    - Add status variants (normal, warning, critical, success)
    - Implement click navigation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 5.2 Write property tests for KPI cards
    - **Property 4: KPI Card Navigation**
    - **Property 20: Warning KPI Styling**
    - **Validates: Requirements 2.3, 2.5**

  - [x] 5.3 Create Chart components using Recharts

    - Install recharts: `npm install recharts --workspace=frontend`
    - Create `frontend/src/components/admin/LineChart.tsx`
    - Create `frontend/src/components/admin/BarChart.tsx`
    - Implement tooltips on hover
    - Add empty state handling
    - Add skeleton loading state
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.4 Create Quick Actions component

    - Create `frontend/src/components/admin/QuickActions.tsx`
    - Implement action buttons with icons
    - Add loading state during action processing
    - Integrate with toast notifications
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 5.5 Write property test for quick actions
    - **Property 5: Quick Action Completion Feedback**
    - **Validates: Requirements 4.3**

  - [x] 5.6 Create Activity Feed component

    - Create `frontend/src/components/admin/ActivityFeed.tsx`
    - Implement real-time event list
    - Add relative timestamps with auto-update
    - Implement click navigation to detail pages
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 5.7 Write property test for activity feed
    - **Property 6: Activity Feed Ordering**
    - **Validates: Requirements 5.1, 5.2**
- [x] 6. Checkpoint - Ensure all tests pass




- [ ] 6. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Build enhanced data table



  - [x] 7.1 Create DataTable component


    - Create `frontend/src/components/admin/DataTable.tsx`
    - Implement sortable column headers with indicators
    - Add pagination controls (show when > 10 rows)
    - Implement debounced search filter (300ms)
    - Add empty state component
    - Support row click handler
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ]* 7.2 Write property tests for data table
    - **Property 7: Table Sorting Correctness**
    - **Property 8: Table Pagination Threshold**
    - **Validates: Requirements 8.2, 8.3**

- [ ] 8. Build global search

  - [ ] 8.1 Create SearchModal component



    - Create `frontend/src/components/admin/SearchModal.tsx`
    - Implement Ctrl+K keyboard shortcut
    - Add search input with debounced query
    - Display grouped results (massages, surveys, settings, pages)
    - Implement keyboard navigation (arrow keys, enter)
    - Add empty state with suggestions
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [ ]* 8.2 Write property tests for search
    - **Property 9: Search Results Relevance**
    - **Property 10: Search Result Navigation**
    - **Validates: Requirements 11.2, 11.4**
-

- [x] 9. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Redesign Dashboard page





  - [x] 10.1 Refactor DashboardPage with new layout


    - Update `frontend/src/pages/admin/DashboardPage.tsx`
    - Implement KPI cards grid (surveys, coupons, kiosk status)
    - Add survey trend line chart
    - Add coupon redemption bar chart
    - Add quick actions panel
    - Add activity feed widget
    - Add alerts section
    - _Requirements: 2.1, 3.1, 3.2, 4.1, 5.1_
  - [x] 10.2 Create dashboard API hooks


    - Add chart data endpoints to backend if needed
    - Create useChartData hook for fetching trend data
    - _Requirements: 3.1, 3.2_

-

- [ ] 11. Redesign Massages pages


  - [x] 11.1 Refactor MassagesPage with new design


    - Update `frontend/src/pages/admin/MassagesPage.tsx`
    - Add card/table view toggle
    - Implement filters (search, layout, status)
    - Use new DataTable component
    - Add drag-and-drop reordering
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 11.2 Refactor MassageFormPage with two-column layout


    - Update `frontend/src/pages/admin/MassageFormPage.tsx`
    - Implement left column (basic info, description, sessions, tags)
    - Implement right column (media upload, preview, layout selector)
    - Add live preview card component
    - Add unsaved changes warning
    - _Requirements: 4.3, 12.1_

- [ ] 12. Redesign Surveys pages



- [ ] 12. Redesign Surveys pages
  - [x] 12.1 Refactor SurveysPage with card layout


    - Update `frontend/src/pages/admin/SurveysPage.tsx`
    - Implement survey cards with response counts
    - Add tabs for filtering by type
    - Add quick analytics preview
    - _Requirements: 8.1_
  - [x] 12.2 Refactor SurveyEditorPage with builder UI


    - Update `frontend/src/pages/admin/SurveyEditorPage.tsx`
    - Implement three-panel layout (palette, canvas, settings)
    - Add drag-and-drop question builder
    - Add question type palette
    - Add live preview mode
    - Add question settings panel
    - _Requirements: 4.3, 12.1_
  - [x] 12.3 Refactor SurveyResponsesPage


    - Update `frontend/src/pages/admin/SurveyResponsesPage.tsx`
    - Add survey selector dropdown
    - Add date range filter
    - Use new DataTable component
    - Add response detail modal
    - Add export functionality
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 12.4 Refactor SurveyAnalyticsPage


    - Update `frontend/src/pages/admin/SurveyAnalyticsPage.tsx`
    - Add KPI cards (total, average, completion rate)
    - Add response trend chart
    - Add rating distribution chart
    - Add question breakdown chart
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 13. Checkpoint - Ensure all tests pass






  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Redesign Kiosk Control page




  - [x] 14.1 Refactor KioskControlPage


    - Update `frontend/src/pages/admin/KioskControlPage.tsx`
    - Add visual mode selector cards with icons
    - Add kiosk status card with uptime
    - Add live preview iframe
    - Add refresh kiosk button
    - _Requirements: 4.2, 4.3_
-

- [ ] 15. Redesign Coupon pages



  - [x] 15.1 Refactor CouponIssuePage


    - Update `frontend/src/pages/admin/CouponIssuePage.tsx`
    - Add phone input with validation
    - Add large QR code display
    - Add copy/print buttons
    - Add recent tokens list
    - _Requirements: 4.3_
  - [x] 15.2 Refactor CouponRedemptionsPage


    - Update `frontend/src/pages/admin/CouponRedemptionsPage.tsx`
    - Add status filter and date range
    - Add stats cards (total, pending, completed)
    - Use new DataTable component
    - Add redemption detail modal
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 15.3 Refactor CouponWalletLookupPage


    - Update `frontend/src/pages/admin/CouponWalletLookupPage.tsx`
    - Add phone search form
    - Add customer info card
    - Add balance display
    - Add transaction timeline
    - _Requirements: 11.2_
-

- [ ] 16. Redesign Settings page



  - [x] 16.1 Refactor SettingsPage with tabs


    - Update `frontend/src/pages/admin/SettingsPage.tsx`
    - Implement tabbed navigation (Timing, Theme, Google Review, Sheets, Security)
    - Add inline validation
    - Add test connection button
    - Add reset to defaults option
    - _Requirements: 4.3, 9.2_
-

- [ ] 17. Redesign System pages




  - [x] 17.1 Refactor BackupPage


    - Update `frontend/src/pages/admin/BackupPage.tsx`
    - Add backup status card
    - Use new DataTable for backup list
    - Add restore confirmation modal
    - _Requirements: 4.3, 8.1_
  - [x] 17.2 Refactor SystemLogsPage


    - Update `frontend/src/pages/admin/SystemLogsPage.tsx`
    - Add log level filter
    - Add date range filter
    - Add full-text search
    - Implement virtualized log list
    - Add export functionality
    - _Requirements: 8.4, 11.2_
-

- [ ] 18. Redesign Login page



  - [x] 18.1 Refactor LoginPage


    - Update `frontend/src/pages/admin/LoginPage.tsx`
    - Add centered card layout
    - Add gradient background
    - Add password visibility toggle
    - Add remember me checkbox
    - Add loading state
    - _Requirements: 12.1_
- [x] 19. Checkpoint - Ensure all tests pass




- [ ] 19. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.
-

- [ ] 20. Implement accessibility features




  - [x] 20.1 Add keyboard navigation support


    - Ensure all interactive elements are tabbable
    - Add visible focus indicators
    - Implement focus trapping in modals
    - Add skip-to-content link
    - _Requirements: 13.1, 13.2, 13.5_
  - [ ]* 20.2 Write property tests for accessibility
    - **Property 15: Keyboard Focus Traversal**
    - **Property 16: Focus Indicator Visibility**
    - **Property 17: Modal Focus Trapping**
    - **Validates: Requirements 13.1, 13.2, 13.5**
  - [x] 20.3 Add ARIA labels and screen reader support


    - Add aria-labels to all icons and buttons
    - Add alt text to images
    - Ensure color-coded status has text alternatives
    - _Requirements: 13.3, 13.4_
  - [ ]* 20.4 Write property test for touch targets
    - **Property 18: Mobile Touch Target Size**
    - **Validates: Requirements 7.5**
  - [ ]* 20.5 Write property test for dark mode contrast
    - **Property 19: Dark Mode Contrast Compliance**
    - **Validates: Requirements 6.5**
-

- [ ] 21. Performance optimization




  - [x] 21.1 Implement lazy loading for charts


    - Use React.lazy for chart components
    - Add Suspense boundaries with skeleton fallbacks
    - _Requirements: 14.3_
  - [x] 21.2 Add route prefetching


    - Implement prefetch on link hover
    - Add prefetch for likely next pages
    - _Requirements: 14.4_
  - [x] 21.3 Optimize bundle size


    - Analyze bundle with webpack-bundle-analyzer
    - Code-split large components
    - Tree-shake unused code
    - _Requirements: 14.1, 14.2_

- [ ] 22. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.


- [ ] 23. Update Tailwind configuration



  - [x] 23.1 Extend Tailwind theme

    - Add dark mode colors to tailwind.config.js
    - Add custom animations (fade, slide, pulse)
    - Add custom spacing if needed
    - Update color palette with design specs
    - _Requirements: 6.5_
-

- [ ] 24. Final integration and polish





  - [x] 24.1 Integration testing

    - Test all page navigations
    - Test theme switching across all pages
    - Test responsive layouts on all pages
    - Test toast notifications from all actions
    - _Requirements: 7.1, 7.2, 7.3, 6.1_
  - [x] 24.2 Visual polish


    - Ensure consistent spacing across all pages
    - Verify all animations are smooth
    - Check all loading states
    - Verify empty states on all pages
    - _Requirements: 12.1, 12.3_
