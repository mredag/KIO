# WhatsApp Message Filtering

## Overview

The WhatsApp workflows now only respond to specific keywords, ignoring all other messages. This prevents the bot from responding to every message and only activates for coupon-related commands.

## Supported Commands

### 1. Coupon Capture
**Trigger:** Message starts with `KUPON` (case-insensitive)  
**Format:** `KUPON ABC123DEF456` (12-character code)  
**Examples:**
- ✅ `KUPON ABC123DEF456`
- ✅ `kupon abc123def456`
- ✅ `Kupon XYZ789GHI012`
- ❌ `ABC123DEF456` (missing KUPON keyword)
- ❌ `KUPON ABC` (code too short)

**Response:**
- Success: "✅ Kuponunuz eklendi! Toplam: X/4 kupon..."
- Invalid: "❌ Bu kupon geçersiz veya kullanılmış..."
- Expired: "❌ Bu kuponun süresi dolmuş..."

### 2. Balance Check
**Trigger:** Exact match `bakiye` or `balance` (case-insensitive)  
**Examples:**
- ✅ `bakiye`
- ✅ `BAKIYE`
- ✅ `balance`
- ❌ `bakiyem` (not exact match)
- ❌ `my balance` (not exact match)

**Response:**
- "📊 Kupon Bakiyeniz: X/4"
- "🎉 Tebrikler! Ücretsiz masaj hakkınız var!"

### 3. Claim Redemption
**Trigger:** Exact match `kupon kullan` or `claim` (case-insensitive)  
**Examples:**
- ✅ `kupon kullan`
- ✅ `KUPON KULLAN`
- ✅ `claim`
- ❌ `kupon` (incomplete)
- ❌ `kullan` (incomplete)

**Response:**
- Success: "🎉 Tebrikler! 4 kuponunuz kullanıldı. Redemption ID: XXX..."
- Insufficient: "📊 Henüz yeterli kuponunuz yok. Mevcut: X/4..."

### 4. Opt-Out
**Trigger:** Exact match `dur`, `stop`, or `durdur` (case-insensitive)  
**Examples:**
- ✅ `dur`
- ✅ `STOP`
- ✅ `durdur`

**Response:**
- "✅ Bildirimler durduruldu. Tekrar başlatmak için 'başlat' yazın."

### 5. Unknown Messages
**Trigger:** Any message that doesn't match above patterns  
**Examples:**
- "Merhaba"
- "Nasılsın?"
- "123456"

**Response:**
- Help message with list of available commands

## Implementation

### Option 1: Unified Workflow (Recommended)

Use the **WhatsApp Unified Handler** workflow which:
- Receives all WhatsApp messages via webhook
- Parses and routes based on keywords
- Handles all command types in one workflow
- Sends help message for unknown commands

**File:** `n8n-workflows/workflows-v2/whatsapp-unified-handler.json`

**Advantages:**
- Single workflow to manage
- Easier to debug
- Consistent error handling
- Lower resource usage

### Option 2: Separate Workflows with Router

Use the **WhatsApp Message Router** which:
- Receives messages and determines type
- Executes appropriate sub-workflow
- Each command has its own workflow

**Files:**
- `n8n-workflows/workflows-v2/whatsapp-message-router.json` (main)
- `n8n-workflows/workflows-v2/whatsapp-coupon-capture-v2.json`
- `n8n-workflows/workflows-v2/whatsapp-balance-check-v2.json`
- `n8n-workflows/workflows-v2/whatsapp-claim-redemption-v2.json`
- `n8n-workflows/workflows-v2/whatsapp-opt-out-v2.json`

**Advantages:**
- Modular design
- Easier to test individual commands
- Can enable/disable specific commands

## Deployment

### Step 1: Choose Approach

**For simplicity:** Use Unified Handler  
**For modularity:** Use Router + Sub-workflows

### Step 2: Import Workflow(s)

```bash
# SSH to Raspberry Pi
ssh eform-kio@192.168.1.5

# Copy workflow files
scp n8n-workflows/workflows-v2/*.json eform-kio@192.168.1.5:~/n8n-workflows/

# Import
n8n import:workflow --separate --input=/home/eform-kio/n8n-workflows/
```

### Step 3: Configure Credentials

In n8n UI (http://192.168.1.5:5678):

1. **Backend API Key** (Header Auth)
   - Name: `Backend API Key`
   - Header Name: `Authorization`
   - Header Value: `Bearer <YOUR_N8N_API_KEY>`

2. **WhatsApp Access Token** (Header Auth)
   - Name: `WhatsApp Access Token`
   - Header Name: `Authorization`
   - Header Value: `Bearer <YOUR_WHATSAPP_ACCESS_TOKEN>`
   - Custom field: `phoneNumberId` = `<YOUR_PHONE_NUMBER_ID>`

### Step 4: Activate Workflow

```bash
# Activate unified handler
ssh eform-kio@192.168.1.5 "n8n update:workflow --id=<WORKFLOW_ID> --active=true"

# Or activate all
ssh eform-kio@192.168.1.5 "n8n update:workflow --all --active=true"
```

### Step 5: Configure WhatsApp Webhook

In Meta Developer Console:
1. Go to WhatsApp → Configuration
2. Set Webhook URL: `https://your-domain.com/webhook/whatsapp-webhook`
3. Set Verify Token: `spa_kiosk_webhook_verify_2024`
4. Subscribe to: `messages`

## Testing

### Test Each Command

```bash
# Test coupon capture
# Send WhatsApp message: "KUPON ABC123DEF456"

# Test balance check
# Send WhatsApp message: "bakiye"

# Test claim
# Send WhatsApp message: "kupon kullan"

# Test opt-out
# Send WhatsApp message: "dur"

# Test unknown message
# Send WhatsApp message: "hello"
# Should receive help message
```

### Check Execution Logs

In n8n UI:
1. Click "Executions" tab
2. View latest execution
3. Check each node's output
4. Verify correct routing

## Troubleshooting

### Issue: Bot responds to every message

**Cause:** Using old workflow without filtering  
**Fix:** Import and activate new filtered workflow

### Issue: Bot doesn't respond to valid commands

**Cause:** Keyword matching too strict  
**Fix:** Check exact keyword format (case-insensitive, but exact match)

### Issue: "Invalid format" for valid coupon

**Cause:** Coupon code not exactly 12 characters  
**Fix:** Ensure code is 12 alphanumeric characters

### Issue: Help message not sending

**Cause:** Fallback route not configured  
**Fix:** Check Switch node has fallback output enabled

## Customization

### Add New Command

1. Update `Parse & Route` node to detect new keyword
2. Add new output in `Switch` node
3. Add API call and response formatting
4. Update help message with new command

### Change Keywords

Edit the `Parse & Route` Code node:

```javascript
// Example: Add Turkish alternative for balance
else if (textLower === 'bakiye' || textLower === 'balance' || textLower === 'bakiyem') {
  route = 'balance_check';
}
```

### Customize Messages

Edit the `Format Response` nodes to change Turkish messages.

## Best Practices

1. **Keep keywords simple** - Easy to remember and type
2. **Case-insensitive matching** - Users may type in any case
3. **Exact match for commands** - Prevents false positives
4. **Pattern match for coupons** - Flexible but validated
5. **Always send help** - Guide users when confused
6. **Log all interactions** - For debugging and analytics

---

**Last Updated:** 2024-11-30  
**Status:** ✅ Ready for deployment  
**Recommended:** Use Unified Handler for simplicity
