# Requirements Document

## Introduction

This specification defines the AI-enhanced automation system for the SPA Digital Kiosk, leveraging n8n's AI nodes with OpenRouter (free tier) to provide intelligent survey analysis, smart WhatsApp message routing, and automated administrative insights. The system is designed with graceful degradation to ensure core functionality remains available when AI services are unavailable.

## Glossary

- **AI_System**: The n8n-based AI automation component that processes text using LLM models via OpenRouter
- **OpenRouter**: A unified API gateway providing access to multiple LLM providers; used to access OpenAI models (gpt-4o-mini, gpt-4o) with fallback to free tier models if costs become prohibitive
- **Graceful_Degradation**: The system's ability to fall back to keyword-based matching when AI services are unavailable
- **Sentiment_Analysis**: The process of determining emotional tone (positive/neutral/negative) from text
- **Intent_Classification**: The process of categorizing user messages by their purpose (balance check, coupon submission, etc.)
- **Survey_Response**: Customer feedback collected through the kiosk survey system
- **WhatsApp_Message**: Incoming customer message via WhatsApp Business API
- **Coupon_Wallet**: The customer's accumulated coupon balance tracked by phone number

## Requirements

### Requirement 1

**User Story:** As a spa manager, I want survey responses automatically analyzed for sentiment, so that I can quickly identify dissatisfied customers and respond promptly.

#### Acceptance Criteria

1. WHEN a survey response is submitted THEN the AI_System SHALL analyze the response text and assign a sentiment category (Positive, Neutral, or Negative) within 5 seconds
2. WHEN the AI_System detects a Negative sentiment THEN the AI_System SHALL send an alert notification to staff via WhatsApp within 1 minute
3. WHEN the AI_System is unavailable THEN the Survey_Response SHALL be stored for later analysis and the system SHALL continue accepting new responses
4. WHEN analyzing Turkish text THEN the AI_System SHALL correctly interpret Turkish language sentiment with accuracy comparable to English analysis

### Requirement 2

**User Story:** As a spa manager, I want daily summaries of customer feedback, so that I can understand overall satisfaction trends without reading every response.

#### Acceptance Criteria

1. WHEN the scheduled time (8 PM Istanbul time) is reached THEN the AI_System SHALL generate a summary of all Survey_Responses from that day
2. WHEN generating a summary THEN the AI_System SHALL include total response count, satisfaction percentage, common topics, and notable concerns in Turkish language
3. WHEN the AI_System is unavailable at scheduled time THEN the system SHALL retry summary generation up to 3 times with 10-minute intervals
4. IF no Survey_Responses exist for the day THEN the AI_System SHALL send a brief "no responses" notification instead of an empty summary

### Requirement 3

**User Story:** As a customer, I want to communicate naturally via WhatsApp, so that I can check my coupon balance or submit coupons without memorizing exact commands.

#### Acceptance Criteria

1. WHEN a WhatsApp_Message is received THEN the AI_System SHALL classify the intent into one of: balance_check, coupon_submit, redemption, help, complaint, or other within 3 seconds
2. WHEN the AI_System classifies intent as balance_check THEN the system SHALL respond with the customer's Coupon_Wallet balance
3. WHEN the AI_System classifies intent as coupon_submit THEN the system SHALL extract the coupon token from the message and process it
4. WHEN the AI_System is unavailable THEN the system SHALL fall back to exact keyword matching (KUPON, DURUM, KULLAN, IPTAL)
5. WHEN a message contains a coupon token pattern (8+ alphanumeric characters) THEN the system SHALL attempt coupon submission regardless of surrounding text

### Requirement 4

**User Story:** As a customer, I want helpful responses to my questions about the coupon system, so that I can understand how to earn and use my rewards.

#### Acceptance Criteria

1. WHEN the AI_System classifies intent as help THEN the AI_System SHALL generate a contextual Turkish response explaining the coupon system
2. WHEN generating help responses THEN the AI_System SHALL include information about earning coupons, redemption threshold (4 coupons), and available commands
3. WHEN the AI_System is unavailable THEN the system SHALL respond with a pre-defined Turkish help message
4. WHEN a customer asks about their specific balance in a help query THEN the AI_System SHALL include their current Coupon_Wallet balance in the response

### Requirement 5

**User Story:** As a spa manager, I want to be alerted about customer complaints immediately, so that I can address issues before they escalate.

#### Acceptance Criteria

1. WHEN the AI_System classifies intent as complaint THEN the AI_System SHALL send an immediate alert to staff WhatsApp with the customer's message
2. WHEN responding to a complaint THEN the AI_System SHALL generate an empathetic Turkish acknowledgment message to the customer
3. WHEN the AI_System is unavailable THEN complaint detection SHALL fall back to keyword matching for Turkish complaint words (şikayet, memnun değil, kötü, berbat)
4. WHEN a complaint is detected THEN the system SHALL log the event with timestamp and customer phone (masked) for audit purposes

### Requirement 6

**User Story:** As a system administrator, I want the AI system to use quality models with cost monitoring, so that I can balance response quality with operational costs.

#### Acceptance Criteria

1. WHEN making AI requests THEN the AI_System SHALL use OpenAI models via OpenRouter (gpt-4o-mini as default, gpt-4o for complex analysis)
2. WHEN the AI request takes longer than 3 seconds THEN the system SHALL timeout and use the fallback mechanism
3. WHEN OpenRouter returns a rate limit or billing error THEN the system SHALL use fallback for the next 60 seconds before retrying AI
4. WHEN processing messages THEN the AI_System SHALL cache identical requests for 5 minutes to reduce API calls
5. WHEN monthly costs exceed a configurable threshold THEN the system SHALL log a warning and optionally switch to free tier models (meta-llama/llama-3.2-3b-instruct:free)

### Requirement 7

**User Story:** As a developer, I want the AI system to have comprehensive logging, so that I can debug issues and monitor performance.

#### Acceptance Criteria

1. WHEN an AI request is made THEN the system SHALL log the request type, response time, and success/failure status
2. WHEN the AI_System falls back to keyword matching THEN the system SHALL log the fallback reason (timeout, error, unavailable)
3. WHEN sentiment analysis completes THEN the system SHALL log the detected sentiment without logging the full response text (privacy)
4. WHEN intent classification completes THEN the system SHALL log the classified intent and confidence level

