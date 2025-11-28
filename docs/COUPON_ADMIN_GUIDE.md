# WhatsApp Coupon System - Admin User Guide

This guide explains how to use the admin interface to manage the WhatsApp coupon loyalty system.

## Table of Contents

1. [Overview](#overview)
2. [Accessing the Admin Panel](#accessing-the-admin-panel)
3. [Issuing Coupon Tokens](#issuing-coupon-tokens)
4. [Managing Redemptions](#managing-redemptions)
5. [Looking Up Customer Wallets](#looking-up-customer-wallets)
6. [Understanding the System](#understanding-the-system)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The WhatsApp Coupon System is a loyalty program that allows customers to:
- Collect digital coupons after each massage session
- Check their balance via WhatsApp
- Redeem 4 coupons for a free massage

As an admin, you can:
- Issue coupon tokens to customers
- Track and manage redemption requests
- Look up customer wallet information
- View event history for audit purposes

---

## Accessing the Admin Panel

### Login

1. Open your browser and navigate to the admin panel:
   - **Development**: http://localhost:3000/admin/login
   - **Production**: http://your-kiosk-ip:3001/admin/login

2. Enter your credentials:
   - **Username**: admin (or your custom username)
   - **Password**: Your secure password

3. Click "Login"

### Navigation

Once logged in, you'll see the admin dashboard with a sidebar menu. The coupon system features are located under the "Coupons" section:

- **Issue Token** - Generate new coupon tokens
- **Redemptions** - Manage redemption requests
- **Wallet Lookup** - Search customer information

---

## Issuing Coupon Tokens

### When to Issue Tokens

Issue a coupon token after each completed massage session. The customer will scan the QR code to collect their coupon via WhatsApp.

### Step-by-Step Process

1. **Navigate to Issue Token Page**
   - Click "Coupons" → "Issue Token" in the sidebar

2. **Generate a New Token**
   - Click the "Generate New Token" button
   - The system will create a unique 12-character token
   - This takes less than 1 second

3. **Display the QR Code**
   - A QR code will appear on screen
   - The QR code contains a WhatsApp deep link with the token
   - Show this QR code to the customer

4. **Customer Scans QR Code**
   - Customer scans with their phone camera
   - WhatsApp opens automatically with a pre-filled message
   - Message format: "KUPON ABC123DEF456"
   - Customer taps "Send"

5. **Confirmation**
   - Customer receives an automated WhatsApp reply in Turkish
   - Reply shows their current balance (e.g., "2/4 coupons")
   - Token is marked as "used" in the system

### Understanding the Token Display

The Issue Token page shows:

- **Current Token**: Large display of the active token
- **QR Code**: Scannable code for customer
- **Copy Button**: Copy token text to clipboard
- **WhatsApp Link**: Direct link (for manual sharing if needed)
- **Recent Tokens**: List of last 10 issued tokens with status

### Token Details

Each token in the recent list shows:
- **Token**: The 12-character code
- **Status**: issued, used, or expired
- **Created**: When the token was generated
- **Expires**: 24 hours after creation
- **Used By**: Phone number (if used)
- **Used At**: Timestamp (if used)

### Best Practices

✅ **DO:**
- Generate a new token for each massage session
- Show the QR code to the customer immediately
- Verify the customer receives the WhatsApp confirmation
- Keep the page open until customer confirms receipt

❌ **DON'T:**
- Reuse old tokens (they expire after 24 hours)
- Share tokens via other channels (use QR code)
- Issue multiple tokens for the same session
- Close the page before customer scans

---

## Managing Redemptions

### Understanding Redemptions

When a customer has 4 coupons, they can send "kupon kullan" via WhatsApp to request a free massage. This creates a redemption request that you must process.

### Viewing Redemptions

1. **Navigate to Redemptions Page**
   - Click "Coupons" → "Redemptions" in the sidebar

2. **Filter Redemptions**
   - **All**: Shows all redemptions (pending, completed, rejected)
   - **Pending**: Shows only requests awaiting action (default view)
   - **Completed**: Shows fulfilled redemptions
   - **Rejected**: Shows denied requests

3. **Redemption Table Columns**
   - **Redemption ID**: Unique identifier (e.g., "abc123...")
   - **Phone**: Customer's phone number (masked: ****1234)
   - **Coupons Used**: Number of coupons (usually 4)
   - **Status**: pending, completed, or rejected
   - **Created**: When customer requested redemption
   - **Actions**: Complete or Reject buttons

### Completing a Redemption

When a customer arrives for their free massage:

1. **Verify Customer Identity**
   - Ask for their phone number or redemption ID
   - Find the redemption in the "Pending" list

2. **Confirm Redemption Details**
   - Check the phone number matches
   - Verify status is "pending"
   - Note the creation date

3. **Provide the Service**
   - Deliver the free massage session
   - Ensure customer is satisfied

4. **Mark as Complete**
   - Click the "Complete" button next to the redemption
   - Confirm the action in the modal dialog
   - The redemption status changes to "completed"
   - Timestamp is recorded

5. **Confirmation**
   - Customer receives WhatsApp confirmation (optional)
   - Staff group receives notification (if configured)
   - Event is logged in the system

### Rejecting a Redemption

In rare cases, you may need to reject a redemption:

**Valid Reasons:**
- Customer no-show after 30 days
- Fraudulent activity detected
- System error or duplicate request
- Policy violation

**Process:**

1. **Click "Reject" Button**
   - Find the redemption in the list
   - Click the "Reject" button

2. **Provide a Reason**
   - A modal dialog appears
   - Enter a clear explanation in the "Note" field
   - Example: "Customer did not show up within 30 days"
   - This note is stored for audit purposes

3. **Confirm Rejection**
   - Click "Confirm Rejection"
   - The system will:
     - Update status to "rejected"
     - Refund 4 coupons to customer's wallet
     - Log the event with your note
     - Send notification to customer (optional)

4. **Customer Impact**
   - Customer's 4 coupons are returned
   - They can request redemption again later
   - They receive a WhatsApp message explaining the rejection

### Redemption Lifecycle

```
Customer sends "kupon kullan"
         ↓
Status: PENDING (awaits staff action)
         ↓
    ┌────┴────┐
    ↓         ↓
COMPLETE   REJECT
(service   (refund 4
delivered)  coupons)
```

### Auto-Expiration

- Redemptions pending for **30+ days** are automatically rejected
- Coupons are refunded to the customer
- Note: "Auto-expired after 30 days"
- This runs daily at 3:00 AM Istanbul time

---

## Looking Up Customer Wallets

### When to Use Wallet Lookup

Use this feature to:
- Answer customer inquiries about their balance
- Investigate issues or disputes
- Verify coupon history
- Check opt-in status for marketing

### Step-by-Step Lookup

1. **Navigate to Wallet Lookup Page**
   - Click "Coupons" → "Wallet Lookup" in the sidebar

2. **Enter Phone Number**
   - Type the customer's phone number
   - Accepted formats:
     - `+905551234567` (E.164 format)
     - `905551234567` (without +)
     - `05551234567` (with leading 0)
     - `5551234567` (local format)
   - System automatically normalizes to E.164

3. **Click "Search"**
   - Results appear below the search box

### Understanding Wallet Information

#### Wallet Summary

- **Phone Number**: Customer's normalized phone (E.164 format)
- **Current Balance**: Number of coupons available (e.g., "3/4")
- **Total Earned**: Lifetime coupons collected
- **Total Redeemed**: Lifetime free massages received
- **Marketing Opt-In**: Yes/No (whether customer receives promotions)
- **Last Message**: Timestamp of last WhatsApp interaction

#### Event History

Below the wallet summary, you'll see a chronological list of all events:

**Event Types:**
- **issued**: Token was generated by admin
- **coupon_awarded**: Customer successfully collected a coupon
- **redemption_attempt**: Customer sent "kupon kullan"
- **redemption_granted**: Redemption request was created
- **redemption_blocked**: Redemption denied (insufficient coupons)
- **redemption_completed**: Free massage was delivered
- **redemption_rejected**: Request was denied by admin
- **opt_out**: Customer opted out of marketing

**Event Details:**
- **Timestamp**: When the event occurred
- **Event Type**: Category of event
- **Token**: Associated token (if applicable, masked)
- **Details**: Additional context (JSON format)

### Example Scenarios

#### Scenario 1: Customer Claims Missing Coupon

**Customer**: "I sent a coupon code yesterday but didn't receive credit"

**Steps:**
1. Look up customer's phone number
2. Check event history for "coupon_awarded" events
3. Verify the token they claim to have sent
4. Check if token exists in database (may be expired or invalid)
5. If legitimate issue, manually issue a new token

#### Scenario 2: Customer Asks About Balance

**Customer**: "How many coupons do I have?"

**Steps:**
1. Look up customer's phone number
2. Read "Current Balance" from wallet summary
3. Inform customer: "You have X out of 4 coupons"
4. If they have 4+, remind them to send "kupon kullan"

#### Scenario 3: Investigating Suspicious Activity

**Observation**: Multiple redemptions from same phone in short time

**Steps:**
1. Look up the phone number
2. Review event history for patterns
3. Check "Total Redeemed" vs. "Total Earned" ratio
4. Look for rapid succession of events
5. If fraud suspected, contact management

---

## Understanding the System

### How It Works

```
1. ISSUE TOKEN
   Admin generates token → QR code displayed
   
2. COLLECT COUPON
   Customer scans QR → WhatsApp opens → Sends message
   → n8n processes → Backend validates → Wallet updated
   → Customer receives confirmation
   
3. CHECK BALANCE
   Customer sends "durum" → n8n queries backend
   → Customer receives balance
   
4. REDEEM
   Customer sends "kupon kullan" → n8n checks balance
   → If 4+ coupons: creates redemption, notifies staff
   → If <4 coupons: tells customer how many more needed
   
5. COMPLETE
   Admin marks redemption complete → Service delivered
   → Event logged
```

### Key Concepts

**Token**
- 12-character unique code (e.g., ABC123DEF456)
- Valid for 24 hours after issuance
- Single-use only
- Automatically expires if not used

**Wallet**
- Customer's coupon account
- Identified by phone number (E.164 format)
- Tracks current balance and lifetime stats
- Created automatically on first coupon

**Redemption**
- Request to exchange 4 coupons for free massage
- Status: pending → completed or rejected
- Auto-expires after 30 days if not processed
- Coupons refunded if rejected

**Event Log**
- Complete audit trail of all actions
- Immutable record for compliance
- Used for dispute resolution
- Includes timestamps and details

### Rate Limiting

To prevent abuse, the system enforces limits:

- **Token Consumption**: 10 per phone per day
- **Redemption Claims**: 5 per phone per day
- **Reset Time**: Midnight Istanbul time (DST-aware)

If a customer exceeds limits, they receive a message to try again later.

### Phone Number Normalization

All phone numbers are stored in E.164 format:
- Format: `+[country code][subscriber number]`
- Example: `+905551234567`
- Turkey country code: 90

The system automatically converts:
- `5551234567` → `+905551234567`
- `05551234567` → `+905551234567`
- `905551234567` → `+905551234567`

This ensures customers are recognized regardless of how they format their number.

---

## Common Tasks

### Daily Operations

**Morning Routine:**
1. Check pending redemptions
2. Review any overnight issues
3. Verify system health

**After Each Massage:**
1. Issue new token
2. Show QR code to customer
3. Verify customer receives confirmation

**When Customer Arrives for Redemption:**
1. Ask for phone number or redemption ID
2. Find in pending redemptions
3. Verify identity
4. Provide service
5. Mark as complete

**End of Day:**
1. Review completed redemptions
2. Check for any pending issues
3. Verify all tokens were used or expired

### Weekly Tasks

1. **Review Redemption Trends**
   - Check average redemption time
   - Identify popular days/times
   - Plan staffing accordingly

2. **Audit Event Logs**
   - Look for unusual patterns
   - Verify all redemptions were legitimate
   - Check for system errors

3. **Customer Engagement**
   - Review opt-out rates
   - Check average coupons per customer
   - Identify highly engaged customers

### Monthly Tasks

1. **Generate Reports**
   - Total tokens issued
   - Total redemptions completed
   - Average time to redemption
   - Customer retention rate

2. **System Maintenance**
   - Verify backups are running
   - Check database size
   - Review error logs

3. **Policy Review**
   - Assess redemption rejection reasons
   - Update procedures if needed
   - Train staff on any changes

---

## Troubleshooting

### Customer Didn't Receive Coupon

**Symptoms**: Customer scanned QR, sent message, but no confirmation

**Diagnosis:**
1. Check if token is marked as "used" in recent tokens list
2. Look up customer's wallet - is balance incremented?
3. Check event history for "coupon_awarded" event

**Solutions:**
- If token is used and wallet updated: Customer did receive it, check their WhatsApp
- If token is still "issued": System didn't process message, issue new token
- If token is "expired": Issue new token

### Customer Can't Redeem

**Symptoms**: Customer sends "kupon kullan" but gets error

**Diagnosis:**
1. Look up customer's wallet
2. Check current balance
3. Review event history for "redemption_blocked" events

**Solutions:**
- If balance < 4: Customer needs more coupons, inform them
- If balance ≥ 4 but blocked: Check rate limits, may need to wait
- If pending redemption exists: Customer already has active request

### Token Won't Generate

**Symptoms**: "Generate New Token" button doesn't work

**Solutions:**
1. Refresh the page
2. Check browser console for errors (F12)
3. Verify backend is running: http://localhost:3001/api/kiosk/health
4. Contact technical support if issue persists

### Wallet Lookup Returns No Results

**Symptoms**: Search returns "No wallet found"

**Possible Causes:**
- Customer has never collected a coupon
- Phone number format is incorrect
- Customer used different phone number

**Solutions:**
1. Verify phone number with customer
2. Try different formats (with/without +, 0, etc.)
3. Check if customer has actually sent a coupon message
4. If new customer, explain they need to collect first coupon

### Redemption Stuck in Pending

**Symptoms**: Redemption has been pending for days

**Solutions:**
1. Contact customer to schedule appointment
2. If customer doesn't respond after 30 days, system auto-rejects
3. If customer no longer wants it, manually reject with note
4. If completed but not marked, mark as complete

---

## Best Practices

### Security

✅ **DO:**
- Log out when leaving the admin panel
- Use strong, unique passwords
- Change default credentials immediately
- Verify customer identity before completing redemptions
- Keep redemption IDs confidential

❌ **DON'T:**
- Share admin credentials
- Leave admin panel open unattended
- Complete redemptions without verification
- Share customer phone numbers publicly

### Customer Service

✅ **DO:**
- Be patient and helpful
- Explain the system clearly to new customers
- Verify information before taking action
- Document issues in rejection notes
- Follow up on customer complaints

❌ **DON'T:**
- Reject redemptions without valid reason
- Ignore customer inquiries
- Make promises the system can't fulfill
- Blame customers for system issues

### Data Management

✅ **DO:**
- Review event logs regularly
- Keep notes on unusual situations
- Report system issues promptly
- Verify data before making decisions
- Use wallet lookup for customer support

❌ **DON'T:**
- Delete or modify database records manually
- Share customer data unnecessarily
- Ignore suspicious patterns
- Make assumptions without checking data

---

## Getting Help

### Technical Support

If you encounter technical issues:

1. **Check System Health**
   - Backend: http://localhost:3001/api/kiosk/health
   - n8n: http://localhost:5678 (if configured)

2. **Collect Information**
   - Error message (exact text)
   - Steps to reproduce
   - Screenshots
   - Customer phone number (if applicable)
   - Timestamp of issue

3. **Contact Support**
   - Email: [your-support-email]
   - Include all collected information
   - Describe impact on operations

### Common Questions

**Q: How long are tokens valid?**
A: 24 hours from issuance. After that, they expire automatically.

**Q: Can I issue multiple tokens to the same customer?**
A: Yes, one token per massage session. Customers can collect multiple coupons.

**Q: What if a customer loses their phone?**
A: Their coupons are tied to their phone number. If they get a new number, they start fresh.

**Q: Can I manually add coupons to a wallet?**
A: No, coupons can only be added by consuming valid tokens. This prevents fraud.

**Q: How do I handle a customer dispute?**
A: Use wallet lookup to review event history, verify facts, then make a decision. Document everything.

**Q: Can customers transfer coupons to another person?**
A: No, coupons are non-transferable and tied to the phone number.

**Q: What happens if I accidentally reject a redemption?**
A: The coupons are refunded to the customer's wallet. They can request redemption again.

**Q: How do I know if a customer opted out of marketing?**
A: Check the "Marketing Opt-In" field in wallet lookup. "No" means they opted out.

---

## Appendix

### Keyboard Shortcuts

- **Ctrl+F**: Search on current page
- **F5**: Refresh page
- **Ctrl+C**: Copy selected text
- **Esc**: Close modal dialogs

### Phone Number Formats

| Input Format | Normalized Format | Valid? |
|--------------|-------------------|--------|
| +905551234567 | +905551234567 | ✅ Yes |
| 905551234567 | +905551234567 | ✅ Yes |
| 05551234567 | +905551234567 | ✅ Yes |
| 5551234567 | +905551234567 | ✅ Yes |
| 555-123-4567 | Invalid | ❌ No |

### Token Status Meanings

| Status | Meaning | Can Be Used? |
|--------|---------|--------------|
| issued | Generated, not yet used | ✅ Yes |
| used | Customer collected coupon | ❌ No |
| expired | 24 hours passed | ❌ No |

### Redemption Status Meanings

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| pending | Awaiting staff action | ✅ Yes - Complete or Reject |
| completed | Service delivered | ❌ No - Done |
| rejected | Denied, coupons refunded | ❌ No - Done |

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-28  
**For**: Admin Staff  
**System**: WhatsApp Coupon Loyalty Program
