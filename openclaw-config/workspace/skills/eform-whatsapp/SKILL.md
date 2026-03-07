# WhatsApp Agent for Eform Spor Merkezi

## Overview
JARVIS WhatsApp agent handles customer inquiries for Eform Spor Merkezi via WhatsApp Business API. Uses existing KIO knowledge base and follows Instagram DM patterns.

## Architecture
- **Webhook**: /webhook/whatsapp (exists in backend)
- **Knowledge**: /api/integrations/knowledge/context (shared with Instagram)
- **Language**: Turkish responses
- **Format**: Single skill file with handler + utilities

## Integration Points
1. WhatsApp webhook receives messages
2. KIO API provides knowledge context
3. Agent library returns structured response
4. Backend sends reply via WhatsApp Business API

## Response Patterns
Mirror Instagram DM format:
- Max 4 paragraphs
- Turkish language
- Professional, warm tone
- Safety filtering
- "Lutfen bizi arayin" fallback for missing info

## Safety Rules
- Block inappropriate/sexual content
- Never share staff personal info
- Only discuss listed legitimate services
- Flag suspicious users

## Dependencies
- KIO API access (shared auth)
- WhatsApp Business API token
- Knowledge base availability
