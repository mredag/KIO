# n8n Workflows for WhatsApp Coupon System

This directory contains n8n workflow definitions and documentation for the WhatsApp-based coupon loyalty system.

## Directory Structure

```
n8n-workflows/
├── workflows/          # Exported workflow JSON files
├── docs/              # Workflow documentation
├── credentials/       # Credential templates (no actual secrets)
├── deployment/        # Deployment scripts
├── .gitignore        # Excludes sensitive data
└── README.md         # This file
```

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- n8n installed globally: `npm install -g n8n`
- Backend API running on `http://localhost:3001`
- WhatsApp Business API credentials

### Local Development

1. **Start n8n**:
   ```bash
   n8n
   ```
   Access UI at: http://localhost:5678

2. **Import Workflows**:
   - Open n8n UI
   - Click "Import from File"
   - Select workflow JSON from `workflows/` directory

3. **Configure Credentials**:
   - Follow instructions in `docs/credentials-setup.md`
   - Add credentials in n8n UI (Settings → Credentials)

4. **Test Workflows**:
   - Use "Execute Workflow" button in n8n UI
   - Test with sample WhatsApp webhook payloads
   - Verify backend API integration

### Production Deployment

See `deployment/` directory for:
- systemd service configuration
- nginx reverse proxy setup
- Deployment scripts
- Backup procedures

## Workflows

> **📝 Turkish Message Templates**: All workflows use Turkish messages for customer communication. See `docs/turkish-message-templates.md` for complete message templates and implementation examples.

### 1. Coupon Capture (`workflows/coupon-capture.json`)
Processes WhatsApp messages with coupon tokens (format: "KUPON <TOKEN>").

**Trigger**: WhatsApp webhook  
**Endpoints**: POST `/api/integrations/coupons/consume`  
**Documentation**: `docs/coupon-capture.md`

### 2. Claim Redemption (`workflows/claim-redemption.json`)
Handles redemption requests when customers have 4+ coupons.

**Trigger**: WhatsApp webhook (message: "kupon kullan")  
**Endpoints**: POST `/api/integrations/coupons/claim`  
**Documentation**: `docs/claim-redemption.md`

### 3. Balance Check (`workflows/balance-check.json`)
Allows customers to check their coupon balance.

**Trigger**: WhatsApp webhook (message: "durum")  
**Endpoints**: GET `/api/integrations/coupons/wallet/:phone`  
**Documentation**: `docs/balance-check.md`

### 4. Opt-Out (`workflows/opt-out.json`)
Handles marketing opt-out requests.

**Trigger**: WhatsApp webhook (message: "iptal")  
**Endpoints**: POST `/api/integrations/coupons/opt-out`  
**Documentation**: `docs/opt-out.md`

## Configuration

### Environment Variables

n8n requires these environment variables (set in systemd service or `.env`):

```bash
# n8n Configuration
N8N_PORT=5678
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<secure-password>
WEBHOOK_URL=https://<your-domain>
TZ=Europe/Istanbul
GENERIC_TIMEZONE=Europe/Istanbul
N8N_LOG_LEVEL=info
```

### Credentials Required

1. **Backend API Key**: For authenticating with backend API
2. **WhatsApp Business API**: Access token, phone number ID, app secret

See `docs/credentials-setup.md` for detailed setup instructions.

## Testing

### Local Testing

```bash
# Test webhook with curl
curl -X POST http://localhost:5678/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<signature>" \
  -d @test-payload.json

# Run test script
./deployment/test-webhooks.sh
```

### Monitoring

- **n8n UI**: View execution history at http://localhost:5678
- **Backend Logs**: Check coupon-related events
- **Database**: Query `coupon_events` table for audit trail

## Security

- ✅ Webhook signature verification (Meta Cloud API)
- ✅ API key authentication for backend calls
- ✅ HTTPS required for all external endpoints
- ✅ PII masking in logs
- ✅ No credentials in git repository

## Backup and Restore

```bash
# Backup workflows
./deployment/backup.sh

# Restore workflows
# Import JSON files from backup directory in n8n UI
```

## Troubleshooting

For comprehensive troubleshooting, see **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** which covers:

- Quick diagnostics checklist
- Common issues by category (webhooks, API, deduplication, phone numbers, messages, notifications, performance)
- Debugging techniques
- Emergency procedures
- Monitoring and alerts
- Prevention best practices

### Quick Fixes

**Webhook not receiving messages**: Check n8n service status, verify webhook URL in Meta dashboard, test with ngrok

**Backend API returns 401**: Verify API key matches between n8n credentials and backend .env

**Turkish characters broken**: Ensure Content-Type includes `charset=utf-8`

**Rate limiting issues**: Check `coupon_rate_limits` table, verify Istanbul timezone configuration

See individual workflow documentation in `docs/` for workflow-specific troubleshooting.

## Development Guidelines

- Test workflows locally before deploying
- Export workflows after changes
- Document all modifications
- Follow patterns in `../.kiro/steering/n8n-development.md`
- Keep credentials in n8n credential system only

## Support

For detailed development patterns and best practices, see:
- `docs/turkish-message-templates.md` - Turkish message templates ⭐
- `../.kiro/steering/n8n-development.md` - Development guide
- `../.kiro/specs/whatsapp-coupon-system/` - Full specification
- `../docs/n8n-coupon-plan.md` - Implementation plan

## Status

- ✅ Directory structure created
- ⏳ Workflows in development
- ⏳ Documentation in progress
- ⏳ Deployment scripts pending

Last Updated: 2025-11-28
