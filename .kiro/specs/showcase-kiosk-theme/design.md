# Design Document: Showcase Kiosk Theme

## Overview

The Showcase theme is a premium video-centric kiosk display mode designed for 15.6" horizontal screens. It presents featured massages in a four-column layout where each column displays a looping video. The design emphasizes visual impact through smooth animations, a dark navy/charcoal color palette with teal accents, and glass-morphism detail cards.

Key design goals:
- **Video-first**: Every column showcases massage videos as the primary content
- **Clean & minimal**: No tags, no clutter - just essential information
- **Calm animations**: Smooth, spa-appropriate transitions (200-500ms)
- **Touch-optimized**: Large touch targets, swipe navigation, immediate feedback
- **Performance**: GPU-accelerated animations, lazy loading for Raspberry Pi

## Architecture

The Showcase theme integrates into the existing kiosk architecture as a new theme option:

```
┌─────────────────────────────────────────────────────────────────┐
│                        KioskModeRouter                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DigitalMenuMode                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│  │  │ Classic │ │   Neo   │ │Immersive│ │  Showcase   │   │   │
│  │  │  Theme  │ │  Theme  │ │  Theme  │ │   Theme     │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
ShowcaseMode
├── ShowcaseColumn (x4)
│   ├── VideoPlayer (looping, muted)
│   ├── ColumnOverlay (gradient)
│   └── ColumnLabel (name + benefit)
└── GlassDetailCard
    ├── CardHeader (title + duration)
    ├── CardDescription
    └── PricingSection (expandable)
```

## Components and Interfaces

### ShowcaseMode Component

Main container component that orchestrates the four-column layout.

```typescript
interface ShowcaseModeProps {
  massages: Massage[];
}

interface ShowcaseState {
  selectedIndex: number;        // 0-3, which column is expanded
  displayMassages: Massage[];   // Exactly 4 massages to display
  isPaused: boolean;            // Auto-cycle paused by user interaction
  showPricing: boolean;         // Pricing section expanded
}
```

### ShowcaseColumn Component

Individual video column with expand/collapse behavior.

```typescript
interface ShowcaseColumnProps {
  massage: Massage;
  isMain: boolean;              // true = 40% width, false = 20% width
  index: number;                // 0-3 position
  onSelect: () => void;         // Called when column is tapped
  animationDelay: number;       // Staggered entrance animation
}
```

### GlassDetailCard Component

Frosted glass panel showing massage details.

```typescript
interface GlassDetailCardProps {
  massage: Massage | null;
  isVisible: boolean;
  showPricing: boolean;
  onTogglePricing: () => void;
  onClose: () => void;
}
```

### Theme Configuration Extension

Extend existing `KioskThemeId` type:

```typescript
export type KioskThemeId = 'classic' | 'neo' | 'immersive' | 'showcase';
```

### Massage Selection Algorithm

```typescript
function selectDisplayMassages(massages: Massage[]): Massage[] {
  // 1. Filter featured massages
  const featured = massages.filter(m => m.isFeatured);
  
  // 2. If 4+ featured, take first 4 by sortOrder
  if (featured.length >= 4) {
    return featured.slice(0, 4);
  }
  
  // 3. Otherwise, fill remaining slots with non-featured
  const nonFeatured = massages.filter(m => !m.isFeatured);
  const combined = [...featured, ...nonFeatured];
  
  return combined.slice(0, 4);
}
```

## Data Models

### Column Layout Model

```typescript
interface ColumnLayout {
  mainIndex: number;           // Which column is expanded (0-3)
  widths: [number, number, number, number];  // Width percentages
}

// Example: Column 1 is main
// widths: [20, 40, 20, 20]
```

### Animation Timing Constants

```typescript
const ANIMATION_CONFIG = {
  columnExpand: 400,           // ms - column width transition
  cardSlideIn: 300,            // ms - glass card entrance
  cardSlideOut: 200,           // ms - glass card exit
  entranceStagger: 100,        // ms - delay between column fade-ins
  autoCycleInterval: 10000,    // ms - time between auto-advances
  pauseDuration: 60000,        // ms - pause duration after interaction
};
```

### Color Palette

```typescript
const SHOWCASE_COLORS = {
  background: {
    start: '#0a0f1a',          // Dark navy
    end: '#1a1f2e',            // Charcoal
  },
  text: {
    primary: '#f0f4f8',        // Soft white
    secondary: '#94a3b8',      // Muted gray
  },
  accent: '#14b8a6',           // Teal
  glass: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.2)',
    blur: '16px',
  },
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Column Layout Invariant
*For any* set of massages and any selected index (0-3), the layout SHALL always display exactly 4 columns where one column has ~40% width and three columns have ~20% width each, totaling 100%.
**Validates: Requirements 1.1, 1.3**

### Property 2: Massage Selection Priority
*For any* list of massages with N featured items, the selection algorithm SHALL return exactly 4 massages where: if N >= 4, all 4 are featured; if N < 4, all N featured are included plus (4-N) non-featured items.
**Validates: Requirements 1.2**

### Property 3: Single Main Column Invariant
*For any* user interaction sequence, there SHALL be exactly one Main_Column at any time, and selecting a new column SHALL atomically transition the previous Main to Preview state.
**Validates: Requirements 3.1, 3.2**

### Property 4: Glass Card Visibility Sync
*For any* selected column index, the Glass_Card SHALL be visible if and only if a column is in Main state, displaying that column's massage data.
**Validates: Requirements 3.4, 4.1, 4.2, 4.3**

### Property 5: Pricing Button Conditional Display
*For any* massage, the "Show Prices" button SHALL be visible if and only if the massage has at least one pricing session.
**Validates: Requirements 4.4**

### Property 6: Auto-Cycle Sequence
*For any* starting index and N auto-cycle iterations without user interaction, the selected index SHALL follow the sequence: index, (index+1)%4, (index+2)%4, ... cycling through all 4 columns.
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 7: Pause/Resume Behavior
*For any* user tap event, auto-cycling SHALL pause for exactly 60 seconds, then resume from the current selected index.
**Validates: Requirements 8.4, 8.5**

### Property 8: Swipe Navigation Direction
*For any* horizontal swipe gesture, a left swipe SHALL increment the selected index (mod 4) and a right swipe SHALL decrement the selected index (mod 4).
**Validates: Requirements 10.3**

### Property 9: Click-Outside Dismissal
*For any* visible Glass_Card, tapping outside the card area SHALL close the card and deselect the column.
**Validates: Requirements 10.5**

### Property 10: Pricing Toggle State
*For any* sequence of "Show Prices" / "Hide Prices" button clicks, the pricing section visibility SHALL toggle between visible and hidden states.
**Validates: Requirements 11.1, 11.4**

### Property 11: Price Format Consistency
*For any* pricing session, the displayed price SHALL be formatted in Turkish Lira (₺) with proper thousands separators.
**Validates: Requirements 11.2**

### Property 12: Pricing Reset on Close
*For any* Glass_Card that is closed while pricing is visible, reopening the card SHALL show pricing in collapsed state.
**Validates: Requirements 11.5**

### Property 13: Theme Persistence
*For any* theme selection in the admin panel, the selected theme SHALL be persisted and restored on page reload.
**Validates: Requirements 7.2**

### Property 14: Video Lazy Loading
*For any* column not currently visible or in Preview state, video loading SHALL be deferred until the column becomes visible.
**Validates: Requirements 9.4**

## Error Handling

### Video Load Failures
- Display gradient placeholder with massage name
- Log error to console for debugging
- Continue auto-cycling without interruption

### Insufficient Massages
- If fewer than 4 massages exist, display available massages with empty placeholder columns
- Show "No massages available" message if zero massages

### Network Disconnection
- Continue displaying cached massage data
- Show offline indicator (existing behavior)
- Queue any interactions for sync when reconnected

### Animation Performance Issues
- Monitor frame rate during animations
- Reduce animation complexity if FPS drops below 30
- Fallback to instant transitions if needed

## Testing Strategy

### Dual Testing Approach

The Showcase theme will be tested using both unit tests and property-based tests:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
**Property-Based Tests**: Verify universal properties that should hold across all inputs

### Property-Based Testing Framework

Use `fast-check` library for TypeScript property-based testing.

### Test Categories

#### 1. Layout Properties (Property 1, 3)
- Test column width calculations for all selected indices
- Verify single main column invariant across state transitions

#### 2. Selection Algorithm (Property 2)
- Generate random massage lists with varying featured counts
- Verify selection priority and count constraints

#### 3. Auto-Cycle Behavior (Property 6, 7)
- Test cycling sequence with various starting indices
- Verify pause/resume timing and state preservation

#### 4. User Interaction (Property 8, 9, 10)
- Test swipe direction mapping
- Verify click-outside dismissal behavior
- Test pricing toggle state machine

#### 5. Data Formatting (Property 11)
- Test price formatting with various numeric values
- Verify Turkish Lira format consistency

#### 6. State Persistence (Property 12, 13)
- Test pricing reset on card close
- Verify theme persistence across reloads

### Test Annotations

Each property-based test MUST include a comment referencing the correctness property:
```typescript
// **Feature: showcase-kiosk-theme, Property 1: Column Layout Invariant**
```

### Minimum Iterations

Property-based tests SHALL run a minimum of 100 iterations to ensure adequate coverage.
