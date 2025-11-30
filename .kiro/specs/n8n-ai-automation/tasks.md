# Implementation Plan

- [ ] 1. Set up OpenRouter integration foundation





  - [x] 1.1 Create OpenRouter credential in n8n


    - Add Header Auth credential with "Bearer " prefix
    - Test API connectivity with simple request
    - _Requirements: 6.1_

  - [x] 1.2 Create base AI HTTP request node template

    - Configure timeout (3 seconds)
    - Set up headers (HTTP-Referer, X-Title)
    - Add model parameter (gpt-4o-mini default)
    - _Requirements: 6.1, 6.2_
  - [ ]* 1.3 Write property test for timeout behavior
    - **Property 3: Timeout Triggers Fallback**
    - **Validates: Requirements 3.4, 6.2**
- [ ] 2. Implement caching and cooldown mechanisms

  - [x] 2.1 Create cache check code node


    - Use workflow static data for storage
    - Implement 5-minute TTL
    - Generate cache key from normalized input
    - _Requirements: 6.4_

  - [x] 2.2 Create cache store code node

    - Store AI response with expiration timestamp
    - Clean expired entries on access
    - _Requirements: 6.4_
  - [x] 2.3 Create cooldown check code node


    - Check if in cooldown period
    - Return skip flag if cooldown active
    - _Requirements: 6.3_
  - [x] 2.4 Create rate limit detection code node


    - Detect 429 status code
    - Set 60-second cooldown timestamp
    - _Requirements: 6.3_
  - [ ]* 2.5 Write property test for cache consistency
    - **Property 4: Cache Hit Returns Identical Response**
    - **Validates: Requirements 6.4**
  - [ ]* 2.6 Write property test for cooldown mechanism
    - **Property 5: Rate Limit Triggers Cooldown**
    - **Validates: Requirements 6.3**
-

- [ ] 3. Implement intent classification workflow




  - [x] 3.1 Create intent classification system prompt


    - Turkish language prompt for 6 intent categories
    - Low temperature (0.1) for consistency
    - Max 20 tokens for response
    - _Requirements: 3.1_
  - [x] 3.2 Create intent parsing code node


    - Parse AI response to valid intent
    - Handle invalid/empty responses
    - _Requirements: 3.1_
  - [x] 3.3 Create keyword fallback code node


    - Implement Turkish keyword patterns
    - Match balance_check, coupon_submit, redemption, help, complaint
    - _Requirements: 3.4_
  - [x] 3.4 Create token extraction code node


    - Extract 8+ alphanumeric tokens from messages
    - Handle "KUPON <TOKEN>" pattern
    - _Requirements: 3.3, 3.5_
  - [ ]* 3.5 Write property test for valid intent output
    - **Property 1: Intent Classification Returns Valid Intent**
    - **Validates: Requirements 3.1, 3.4**
  - [ ]* 3.6 Write property test for token extraction
    - **Property 6: Token Pattern Detection**
    - **Validates: Requirements 3.3, 3.5**
  - [ ]* 3.7 Write property test for complaint keyword fallback
    - **Property 7: Complaint Keyword Fallback**
    - **Validates: Requirements 5.3**
- [x] 4. Checkpoint - Ensure all tests pass




- [ ] 4. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.
-

- [x] 5. Implement sentiment analysis workflow




  - [x] 5.1 Create sentiment analysis system prompt


    - Turkish language prompt for 3 sentiment categories
    - Low temperature (0.1) for consistency
    - Max 10 tokens for response
    - _Requirements: 1.1_
  - [x] 5.2 Create sentiment parsing code node


    - Parse AI response to valid sentiment
    - Set shouldAlert flag for negative sentiment
    - _Requirements: 1.1, 1.2_
  - [x] 5.3 Create negative sentiment alert workflow


    - Send WhatsApp notification to staff
    - Include masked phone and timestamp
    - _Requirements: 1.2, 5.1_
  - [ ]* 5.4 Write property test for valid sentiment output
    - **Property 2: Sentiment Analysis Returns Valid Category**
    - **Validates: Requirements 1.1**

- [ ] 6. Implement help response generation




  - [x] 6.1 Create help response system prompt


    - Turkish language prompt with coupon system info
    - Include earning rules, redemption threshold, commands
    - _Requirements: 4.1, 4.2_
  - [x] 6.2 Create fallback help message template


    - Pre-defined Turkish help message
    - Include all required information
    - _Requirements: 4.3_
  - [x] 6.3 Create contextual help code node


    - Inject customer balance into prompt when available
    - _Requirements: 4.4_
  - [ ]* 6.4 Write property test for help content completeness
    - **Property 8: Help Response Contains Required Information**
    - **Validates: Requirements 4.2**
  - [ ]* 6.5 Write property test for contextual balance inclusion
    - **Property 13: Contextual Help Includes Balance**
    - **Validates: Requirements 4.4**
-

- [ ] 7. Implement daily summary workflow




  - [x] 7.1 Create scheduled trigger node


    - Set to 8 PM Istanbul time (Europe/Istanbul)
    - _Requirements: 2.1_
  - [x] 7.2 Create survey response fetch node


    - Query backend API for day's responses
    - Handle empty response case
    - _Requirements: 2.1, 2.4_
  - [x] 7.3 Create summary generation system prompt


    - Turkish language prompt for summary
    - Include response count, sentiment breakdown, topics, concerns
    - Use gpt-4o for complex analysis
    - _Requirements: 2.2_
  - [x] 7.4 Create retry mechanism for summary


    - Retry up to 3 times on failure
    - 10-minute intervals between retries
    - _Requirements: 2.3_

  - [x] 7.5 Create summary delivery node

    - Send to admin WhatsApp
    - Format with emojis and sections
    - _Requirements: 2.1_
  - [ ]* 7.6 Write property test for summary content
    - **Property 9: Summary Contains Required Sections**
    - **Validates: Requirements 2.2**


- [x] 8. Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
-

- [x] 9. Implement logging and audit system



  - [x] 9.1 Create PII masking code node


    - Mask phone numbers (show first 2 and last 2 digits)
    - Never log full survey text
    - _Requirements: 5.4, 7.3_
  - [x] 9.2 Create AI request logging code node


    - Log request type, response time, success/failure
    - Log method (ai/cache/fallback)
    - _Requirements: 7.1_
  - [x] 9.3 Create fallback logging code node


    - Log fallback reason (timeout, error, cooldown, rate_limit)
    - _Requirements: 7.2_
  - [x] 9.4 Create intent/sentiment logging code node


    - Log classified intent and confidence
    - Log sentiment category (not full text)
    - _Requirements: 7.3, 7.4_
  - [ ]* 9.5 Write property test for logging fields
    - **Property 10: Logging Contains Required Fields**
    - **Validates: Requirements 7.1**
  - [ ]* 9.6 Write property test for PII masking
    - **Property 11: Phone Numbers Are Masked in Logs**
    - **Validates: Requirements 5.4, 7.3**

- [ ] 10. Integrate with existing WhatsApp workflow





  - [x] 10.1 Update WhatsApp webhook to use AI intent classification


    - Add cache check before AI call
    - Add cooldown check
    - Route to AI or fallback based on availability
    - _Requirements: 3.1, 3.4_

  - [x] 10.2 Update balance check routing

    - Route balance_check intent to balance API
    - Return formatted Turkish response
    - _Requirements: 3.2_

  - [x] 10.3 Update coupon submission routing

    - Extract token from AI classification
    - Route to consume API
    - _Requirements: 3.3_

  - [x] 10.4 Add complaint handling path

    - Send staff alert on complaint intent
    - Generate empathetic response
    - _Requirements: 5.1, 5.2_
  - [ ]* 10.5 Write property test for balance routing
    - **Property 12: Balance Check Routes to Balance API**
    - **Validates: Requirements 3.2**
-

- [x] 11. Create survey webhook integration




  - [x] 11.1 Create survey response webhook trigger


    - Receive survey submissions from backend
    - _Requirements: 1.1_
  - [x] 11.2 Connect sentiment analysis workflow


    - Analyze each response for sentiment
    - Store result for daily summary
    - _Requirements: 1.1_
  - [x] 11.3 Add graceful degradation for survey analysis


    - Store response even if AI unavailable
    - Mark for later analysis
    - _Requirements: 1.3_

- [x] 12. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
-

- [ ] 13. Deploy and test end-to-end




  - [x] 13.1 Deploy workflows to Raspberry Pi n8n


    - Export workflow JSON files
    - Import to production n8n
    - Activate workflows
    - _Requirements: All_
  - [x] 13.2 Test intent classification with real messages


    - Test various Turkish message formats
    - Verify fallback works when AI slow
    - _Requirements: 3.1, 3.4_
  - [x] 13.3 Test sentiment analysis with survey responses


    - Submit test surveys
    - Verify sentiment detection
    - Verify staff alerts for negative
    - _Requirements: 1.1, 1.2_

  - [x] 13.4 Test daily summary generation

    - Trigger manual summary
    - Verify content and delivery
    - _Requirements: 2.1, 2.2_

  - [x] 13.5 Verify logging and audit trail

    - Check logs for required fields
    - Verify PII is masked
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
