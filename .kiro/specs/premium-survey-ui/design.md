# Design Document: Premium Survey UI

## Overview

This design transforms the kiosk survey screen into a premium, elegant experience with animated elements, emoji-based interactions, and sophisticated visual effects. The implementation uses React with CSS animations and maintains full compatibility with the existing survey system.

## Architecture

The premium survey UI follows a component-based architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PremiumSurveyMode                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 AnimatedBackground                       │   │
│  │  (Floating particles, ambient glow orbs)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 SurveyHeader                             │   │
│  │  (Sparkle badge, title with glow, description)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 ProgressIndicator                        │   │
│  │  (Step dots, progress bar, question counter)            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 QuestionCard                             │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │         AnimatedQuestionEmoji                    │    │   │
│  │  │  (Thematic emoji with float/pulse animation)    │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │         QuestionText                             │    │   │
│  │  │  (Question from database with glow effect)      │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │         AnswerOptions                            │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐               │    │   │
│  │  │  │ EmojiRating │  │ OptionCard  │               │    │   │
│  │  │  │ (for rating)│  │(for choice) │               │    │   │
│  │  │  └─────────────┘  └─────────────┘               │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 ThankYouScreen                           │   │
│  │  (Animated checkmark, confetti, floating emojis)        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. PremiumSurveyMode (Main Component)
The root component that orchestrates the survey flow and manages state.

```typescript
interface PremiumSurveyModeProps {
  // Inherits from existing SurveyMode - no props needed
}

interface SurveyState {
  currentQuestionIndex: number;
  answers: Record<string, any>;
  showThankYou: boolean;
  isTransitioning: boolean;
  timeLeft: number;
}
```

### 2. AnimatedBackground
Renders the ambient visual effects.

```typescript
interface AnimatedBackgroundProps {
  particleCount?: number; // Default: 20, max: 50 for performance
  glowIntensity?: 'low' | 'medium' | 'high';
}
```

### 3. EmojiRating
Renders emoji-based rating options.

```typescript
interface EmojiRatingProps {
  options: string[]; // Rating values from database
  selectedValue: number | null;
  onSelect: (value: number) => void;
  labels?: { min: string; max: string }; // From i18n or database
}

// Emoji mapping for ratings (1-5 scale)
const RATING_EMOJIS: Record<number, string> = {
  1: '😢', // Very dissatisfied
  2: '😕', // Dissatisfied
  3: '😐', // Neutral
  4: '😊', // Satisfied
  5: '🤩', // Very satisfied
};

// Glow colors by sentiment
const RATING_COLORS: Record<number, string> = {
  1: '#ef4444', // Red
  2: '#f97316', // Orange
  3: '#eab308', // Yellow
  4: '#22c55e', // Green
  5: '#10b981', // Emerald
};
```

### 4. OptionCard
Renders single-choice options with icons.

```typescript
interface OptionCardProps {
  option: string;
  icon: string; // Emoji icon
  isSelected: boolean;
  onSelect: () => void;
  animationDelay: number; // For staggered entrance
}
```

### 5. Icon Mapping Utility
Intelligent icon selection based on option text.

```typescript
// Comprehensive keyword-to-emoji mapping
const OPTION_ICON_MAP: Record<string, string> = {
  // Social Media
  'sosyal medya': '📱',
  'social media': '📱',
  'instagram': '📸',
  'facebook': '👤',
  'twitter': '🐦',
  
  // Referrals
  'arkadaş': '👥',
  'friend': '👥',
  'aile': '👨‍👩‍👧',
  'family': '👨‍👩‍👧',
  'tavsiye': '💬',
  
  // Search
  'google': '🔍',
  'arama': '🔍',
  'search': '🔍',
  'online': '🌐',
  
  // Physical
  'geçerken': '🚶',
  'walking': '🚶',
  'yürürken': '🚶',
  'passing': '🚶',
  
  // Advertising
  'reklam': '📺',
  'advertisement': '📺',
  'ilan': '📰',
  
  // Other/Default
  'diğer': '✨',
  'other': '✨',
  'başka': '✨',
};

function getOptionIcon(optionText: string): string {
  const lowerText = optionText.toLowerCase();
  for (const [keyword, icon] of Object.entries(OPTION_ICON_MAP)) {
    if (lowerText.includes(keyword)) {
      return icon;
    }
  }
  return '✨'; // Default icon
}
```

### 6. Question Emoji Selector
Selects thematic emoji based on question context.

```typescript
interface QuestionEmojiConfig {
  emoji: string;
  animation: 'float' | 'pulse' | 'bounce' | 'rotate';
}

function getQuestionEmoji(questionText: string, questionType: string): QuestionEmojiConfig {
  const lowerText = questionText.toLowerCase();
  
  // Satisfaction/Rating questions
  if (questionType === 'rating' || 
      lowerText.includes('memnun') || 
      lowerText.includes('satisfaction')) {
    return { emoji: '😊', animation: 'float' };
  }
  
  // Discovery/Source questions
  if (lowerText.includes('nasıl') && (lowerText.includes('buldunuz') || lowerText.includes('duydunuz'))) {
    return { emoji: '🔍', animation: 'rotate' };
  }
  
  // Experience questions
  if (lowerText.includes('deneyim') || lowerText.includes('experience')) {
    return { emoji: '💆', animation: 'pulse' };
  }
  
  // Recommendation questions
  if (lowerText.includes('tavsiye') || lowerText.includes('recommend')) {
    return { emoji: '⭐', animation: 'bounce' };
  }
  
  // Default
  return { emoji: '💭', animation: 'float' };
}
```

## Data Models

### Survey Template (Existing - No Changes)
```typescript
interface SurveyTemplate {
  id: string;
  name: string;
  type: 'satisfaction' | 'discovery';
  title: string;
  description: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: 'rating' | 'single-choice';
  options: string[];
  isRequired: boolean;
  // ... existing fields
}
```

### Animation Configuration
```typescript
interface AnimationConfig {
  questionTransition: {
    duration: number; // 300ms
    easing: string; // 'ease-out'
  };
  autoAdvanceDelay: number; // 400ms
  thankYouDuration: number; // 3000ms
  particleConfig: {
    count: number; // 20
    speed: number; // 0.5
    size: { min: number; max: number }; // 4-12px
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified:

### Property 1: Content Rendering from Database
*For any* survey template loaded from the database, the rendered survey title, description, question texts, and option texts SHALL exactly match the values stored in the database without any hardcoded modifications.
**Validates: Requirements 9.1, 9.2, 9.3**

### Property 2: Icon Mapping Consistency
*For any* option text string, the `getOptionIcon` function SHALL return a valid emoji string, using keyword matching when available or the default icon (✨) when no keywords match.
**Validates: Requirements 3.2, 3.5, 9.4, 9.5**

### Property 3: Question Emoji Selection
*For any* question with text and type, the `getQuestionEmoji` function SHALL return a valid emoji configuration with an emoji string and animation type based on question context keywords.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 4: Rating Emoji Mapping
*For any* rating value from 1 to 5, the rating display SHALL show the corresponding emoji face and apply the sentiment-appropriate glow color.
**Validates: Requirements 2.1, 2.3**

### Property 5: Touch Target Size Compliance
*For any* interactive element (rating emoji, option card, button), the rendered element SHALL have minimum dimensions of 80x80 pixels.
**Validates: Requirements 8.1**

### Property 6: Option Card Spacing
*For any* set of option cards displayed, the gap between adjacent cards SHALL be at least 16 pixels.
**Validates: Requirements 8.3**

### Property 7: Progress Display Accuracy
*For any* question index N in a survey with M total questions, the progress indicator SHALL display "Soru N / M" with the correct values.
**Validates: Requirements 4.3**

### Property 8: Localization Support
*For any* UI label or fallback text, the content SHALL be retrieved from the i18n system with Turkish as the primary language, supporting all Turkish characters correctly.
**Validates: Requirements 2.4, 7.3, 10.1, 10.2**

### Property 9: ARIA Label Presence
*For any* interactive element (button, selectable option), the element SHALL have an appropriate aria-label attribute for screen reader accessibility.
**Validates: Requirements 10.3**

### Property 10: GPU-Accelerated Animations
*For any* CSS animation used in the component, the animation SHALL use only transform and opacity properties to ensure GPU acceleration.
**Validates: Requirements 11.1**

### Property 11: Transition Input Blocking
*For any* question transition, user input on answer options SHALL be disabled during the transition period to prevent double-submissions.
**Validates: Requirements 6.4**

## Error Handling

### Loading States
- Display animated loading spinner with glow effect while survey data loads
- Show error message if survey fails to load after 5 seconds

### Missing Data
- If survey title is empty, display localized fallback from i18n
- If question has no options, skip to next question
- If icon mapping fails, use default emoji (✨)

### Animation Failures
- Use CSS fallbacks for browsers without animation support
- Disable particle effects if performance drops below 30fps

## Testing Strategy

### Dual Testing Approach

#### Unit Tests
- Test icon mapping function with various Turkish and English keywords
- Test question emoji selection with different question types
- Test rating emoji and color mapping
- Test progress calculation

#### Property-Based Tests
Using fast-check library for property-based testing:

1. **Content Rendering Property Test**
   - Generate random survey templates
   - Verify rendered content matches database values

2. **Icon Mapping Property Test**
   - Generate random option text strings
   - Verify function always returns valid emoji

3. **Question Emoji Property Test**
   - Generate random question text and types
   - Verify function returns valid emoji config

4. **Touch Target Property Test**
   - Render components with various content
   - Verify all interactive elements meet size requirements

5. **Progress Display Property Test**
   - Generate random question indices and totals
   - Verify progress text format is correct

### Test Configuration
- Property tests: minimum 100 iterations
- Use fast-check for TypeScript property-based testing
- Tag each test with corresponding property reference
