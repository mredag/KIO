# Design Document: n8n AI Automation

## Overview

This design document describes the AI-enhanced automation system for the SPA Digital Kiosk, leveraging n8n workflows with OpenRouter to provide intelligent survey analysis, smart WhatsApp message routing, and automated administrative insights. The system is designed with graceful degradation to ensure core functionality remains available when AI services are unavailable.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           n8n AI Automation System                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  WhatsApp   │    │   Survey    │    │  Scheduled  │    │   Backend   │  │
│  │  Webhook    │    │  Webhook    │    │   Trigger   │    │    API      │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        AI Processing Layer                          │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │  Cache    │  │ Cooldown  │  │ OpenRouter│  │  Keyword  │        │   │
│  │  │  Check    │──│  Check    │──│  AI Call  │──│  Fallback │        │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Intent    │    │  Sentiment  │    │   Summary   │    │   Alert     │  │
│  │  Routing    │    │  Analysis   │    │ Generation  │    │  Dispatch   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │         External Services        │
                    │  ┌─────────┐  ┌─────────────┐   │
                    │  │OpenRouter│  │  WhatsApp   │   │
                    │  │   API   │  │  Graph API  │   │
                    │  └─────────┘  └─────────────┘   │
                    └─────────────────────────────────┘
```

## Components and Interfaces

### 1. AI Processing Layer

The central component that handles all AI-related operations with built-in resilience.

```typescript
interface AIProcessingConfig {
  openRouterApiKey: string;
  defaultModel: 'openai/gpt-4o-mini';
  complexModel: 'openai/gpt-4o';
  fallbackModel: 'meta-llama/llama-3.2-3b-instruct:free';
  timeoutMs: 3000;
  cacheTtlMs: 300000; // 5 minutes
  cooldownMs: 60000;  // 60 seconds after rate limit
}

interface AIRequest {
  type: 'intent' | 'sentiment' | 'summary' | 'help';
  input: string;
  context?: Record<string, unknown>;
}

interface AIResponse {
  result: string;
  confidence: 'high' | 'medium' | 'low';
  method: 'ai' | 'cache' | 'fallback';
  responseTimeMs: number;
}
```

### 2. Intent Classification Module

Classifies WhatsApp messages into actionable intents.

```typescript
type Intent = 
  | 'balance_check'
  | 'coupon_submit'
  | 'redemption'
  | 'help'
  | 'complaint'
  | 'other';

interface IntentClassificationResult {
  intent: Intent;
  confidence: number;
  extractedToken?: string; // For coupon_submit
  method: 'ai' | 'keyword';
}

// Keyword patterns for fallback
const KEYWORD_PATTERNS: Record<Intent, RegExp> = {
  balance_check: /durum|bakiye|kaç kupon|kuponum/i,
  coupon_submit: /kupon\s+([a-z0-9]{8,})/i,
  redemption: /kupon kullan|kullanmak|hediye masaj/i,
  help: /yardım|nasıl|bilgi|help|\?/i,
  complaint: /şikayet|memnun değil|kötü|berbat|rezalet/i,
  other: /.*/
};
```

### 3. Sentiment Analysis Module

Analyzes survey responses for customer satisfaction.

```typescript
type Sentiment = 'positive' | 'neutral' | 'negative';

interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;
  shouldAlert: boolean; // true for negative
}
```

### 4. Summary Generation Module

Creates daily summaries of customer feedback.

```typescript
interface DailySummary {
  date: string;
  totalResponses: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  commonTopics: string[];
  concerns: string[];
  generatedText: string;
}
```

### 5. Cache Service

In-memory caching using n8n workflow static data.

```typescript
interface CacheEntry {
  response: string;
  expires: number; // Unix timestamp
}

interface CacheService {
  get(key: string): CacheEntry | null;
  set(key: string, response: string, ttlMs: number): void;
  clear(): void;
}
```

### 6. Logging Service

Audit logging with PII protection.

```typescript
interface AILogEntry {
  timestamp: string;
  requestType: 'intent' | 'sentiment' | 'summary' | 'help';
  responseTimeMs: number;
  success: boolean;
  method: 'ai' | 'cache' | 'fallback';
  fallbackReason?: 'timeout' | 'error' | 'cooldown' | 'rate_limit';
  // For sentiment - log category, not text
  sentiment?: Sentiment;
  // For intent - log intent, not message
  intent?: Intent;
  confidence?: number;
  // Phone always masked
  phoneMasked?: string;
}
```

## Data Models

### OpenRouter Request

```typescript
interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
}
```

### OpenRouter Response

```typescript
interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### Workflow State

```typescript
interface WorkflowState {
  aiCache: Record<string, CacheEntry>;
  aiCooldown: number; // Unix timestamp when cooldown ends
  dailyTokenUsage: number;
  lastResetDate: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Intent Classification Returns Valid Intent
*For any* WhatsApp message input, the intent classification SHALL return one of the valid intent categories (balance_check, coupon_submit, redemption, help, complaint, or other) regardless of whether AI or fallback is used.
**Validates: Requirements 3.1, 3.4**

### Property 2: Sentiment Analysis Returns Valid Category
*For any* survey response text, the sentiment analysis SHALL return one of the valid sentiment categories (positive, neutral, or negative) within the configured timeout.
**Validates: Requirements 1.1**

### Property 3: Timeout Triggers Fallback
*For any* AI request that exceeds the 3-second timeout, the system SHALL use the keyword-based fallback mechanism and return a valid result.
**Validates: Requirements 3.4, 6.2**

### Property 4: Cache Hit Returns Identical Response
*For any* identical request made within the cache TTL (5 minutes), the system SHALL return the cached response without making a new AI call.
**Validates: Requirements 6.4**

### Property 5: Rate Limit Triggers Cooldown
*For any* rate limit error from OpenRouter, the system SHALL enter cooldown mode and use fallback for all requests during the cooldown period (60 seconds).
**Validates: Requirements 6.3**

### Property 6: Token Pattern Detection
*For any* message containing an 8+ character alphanumeric pattern after "KUPON", the system SHALL extract and return that token for coupon submission.
**Validates: Requirements 3.3, 3.5**

### Property 7: Complaint Keyword Fallback
*For any* message containing Turkish complaint keywords (şikayet, memnun değil, kötü, berbat) when AI is unavailable, the system SHALL classify the intent as complaint.
**Validates: Requirements 5.3**

### Property 8: Help Response Contains Required Information
*For any* help response generated (AI or fallback), the response SHALL contain information about earning coupons, the 4-coupon redemption threshold, and available commands.
**Validates: Requirements 4.2**

### Property 9: Summary Contains Required Sections
*For any* daily summary generated, the output SHALL include total response count, sentiment percentages, and common topics.
**Validates: Requirements 2.2**

### Property 10: Logging Contains Required Fields
*For any* AI request (successful or failed), the system SHALL log request type, response time, and success/failure status.
**Validates: Requirements 7.1**

### Property 11: Phone Numbers Are Masked in Logs
*For any* log entry containing a phone number, the phone SHALL be masked (showing only first 2 and last 2 digits).
**Validates: Requirements 5.4, 7.3**

### Property 12: Balance Check Routes to Balance API
*For any* message classified as balance_check intent, the system SHALL route to the balance lookup API and return the customer's coupon balance.
**Validates: Requirements 3.2**

### Property 13: Contextual Help Includes Balance
*For any* help request where the customer's balance is available, the AI response SHALL include their current coupon balance.
**Validates: Requirements 4.4**

## Error Handling

### AI Service Errors

| Error Type | Detection | Response |
|------------|-----------|----------|
| Timeout (>3s) | Request duration | Use keyword fallback, log reason |
| Rate Limit (429) | HTTP status code | Enter 60s cooldown, use fallback |
| Auth Error (401) | HTTP status code | Log critical error, use fallback |
| Server Error (5xx) | HTTP status code | Retry once, then fallback |
| Invalid Response | Missing choices | Use fallback, log warning |

### Fallback Behavior

```
AI Request → [Timeout?] → Yes → Keyword Fallback
                ↓
               No
                ↓
         [Rate Limit?] → Yes → Set Cooldown → Keyword Fallback
                ↓
               No
                ↓
         [Valid Response?] → No → Keyword Fallback
                ↓
               Yes
                ↓
         Parse & Return AI Result
```

### Retry Strategy

- **Summary Generation**: Retry up to 3 times with 10-minute intervals
- **Real-time Requests**: No retry, immediate fallback
- **After Cooldown**: Resume AI calls after 60 seconds

## Testing Strategy

### Dual Testing Approach

This system requires both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property-based tests**: Verify universal properties hold across all inputs

### Property-Based Testing Framework

**Framework**: fast-check (JavaScript/TypeScript)

**Configuration**: Minimum 100 iterations per property test

### Test Categories

#### 1. Intent Classification Tests
- Property tests for valid intent output
- Property tests for token extraction
- Property tests for keyword fallback
- Unit tests for specific message examples

#### 2. Sentiment Analysis Tests
- Property tests for valid sentiment output
- Unit tests for Turkish text examples
- Edge case tests for empty/null input

#### 3. Timeout & Fallback Tests
- Property tests for timeout behavior
- Property tests for cooldown mechanism
- Unit tests for rate limit handling

#### 4. Caching Tests
- Property tests for cache consistency
- Unit tests for cache expiration
- Property tests for cache key generation

#### 5. Logging Tests
- Property tests for required fields
- Property tests for PII masking
- Unit tests for log format

### Test Annotations

Each property-based test MUST be tagged with:
```javascript
/**
 * Feature: n8n-ai-automation, Property 1: Intent Classification Returns Valid Intent
 * Validates: Requirements 3.1, 3.4
 */
```

## Security Considerations

### API Key Protection
- OpenRouter API key stored in n8n credentials (encrypted)
- Never logged or exposed in responses

### PII Protection
- Phone numbers masked before logging: `90******67`
- Full survey text not logged, only sentiment category
- Customer messages not stored in AI logs

### Rate Limiting
- Respect OpenRouter rate limits
- Implement local cooldown to prevent abuse
- Cache to reduce API calls

## Performance Considerations

### Response Time Targets
| Operation | Target | Timeout |
|-----------|--------|---------|
| Intent Classification | <1s | 3s |
| Sentiment Analysis | <1s | 3s |
| Help Response | <2s | 3s |
| Daily Summary | <10s | 30s |

### Caching Strategy
- Cache key: normalized lowercase message
- TTL: 5 minutes for real-time requests
- No caching for summaries (unique each time)

### Token Usage Optimization
- Use gpt-4o-mini for routine tasks (~$0.15/1M tokens)
- Reserve gpt-4o for complex summaries (~$2.50/1M tokens)
- Monitor daily token usage
- Alert when approaching cost threshold
