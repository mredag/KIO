# MEMORY — Instagram Asistani

## Pipeline
- DM flow: Meta webhook -> KIO enriches -> DirectResponseService (light+standard) or OpenClaw (advanced) -> policy validation -> send via Meta API
- Model tiers: light (gpt-4.1-mini, greetings), standard (gpt-4o-mini, general), advanced (gpt-4o-mini, complaints)
- Intent detection: Turkish keyword matching with normalizeTurkish() -> category filtering
- Intent categories: services, pricing, hours, policies, contact, faq, general
- Context-aware follow-ups: detectIntentWithContext() merges topic from last 3 inbound messages (10min window)
- All interactions logged in instagram_interactions table by backend
- Policy validation: 8 Turkish rules (no randevu, no hallucination, etc.)
- Fallback: "Detayli bilgi ve randevu icin lutfen bizi arayin: 0326 502 58 58."

## System
- Production: Raspberry Pi 5 (192.168.1.8)
- Meta Graph API: graph.instagram.com (IGAA tokens), v25.0
- Test mode: INSTAGRAM_TEST_MODE + INSTAGRAM_TEST_SENDER_IDS in .env

## Known Issues
- Meta OAuth token needs periodic refresh
- OpenClaw security wrapper blocks tool calls — that's fine, just output text
- Turkish char normalization critical: u/o/s/c/g/i diacritics must match ASCII keywords
