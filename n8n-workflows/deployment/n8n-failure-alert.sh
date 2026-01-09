#!/bin/bash
#
# n8n Service Failure Alert Script
# 
# This script sends an email alert when the n8n service fails.
# It's triggered by systemd OnFailure directive.
#
# Requirements: 26.1 - Email notifications for n8n service failures
#
# Prerequisites:
# - Install mailutils: sudo apt-get install mailutils
# - Configure postfix or another MTA
# - Set ALERT_EMAIL environment variable or edit this script
#
# Usage:
# - Called automatically by systemd when n8n.service fails
# - Can be tested manually: sudo ./n8n-failure-alert.sh

# Configuration
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"
SERVICE_NAME="n8n.service"
HOSTNAME=$(hostname)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')

# Get service status
SERVICE_STATUS=$(systemctl status "$SERVICE_NAME" --no-pager --lines=20 2>&1)
SERVICE_FAILED_COUNT=$(systemctl show "$SERVICE_NAME" -p NRestarts --value)

# Email subject
SUBJECT="[ALERT] n8n Service Failed on $HOSTNAME"

# Email body
BODY="n8n Service Failure Alert

Service: $SERVICE_NAME
Hostname: $HOSTNAME
Timestamp: $TIMESTAMP
Failed Restart Count: $SERVICE_FAILED_COUNT

Service Status:
$SERVICE_STATUS

Action Required:
1. Check n8n logs: journalctl -u n8n.service -n 100
2. Check n8n application logs: tail -f /var/lib/n8n/logs/*.log
3. Verify n8n is accessible: curl http://localhost:5678
4. Check database: ls -lh /var/lib/n8n/.n8n/database.sqlite3
5. Restart service if needed: sudo systemctl restart n8n.service

This is an automated alert from the WhatsApp Coupon System monitoring.
"

# Send email
if command -v mail &> /dev/null; then
    echo "$BODY" | mail -s "$SUBJECT" "$ALERT_EMAIL"
    logger -t n8n-alert "Email alert sent to $ALERT_EMAIL for n8n service failure"
else
    logger -t n8n-alert "ERROR: mail command not found. Install mailutils: sudo apt-get install mailutils"
    logger -t n8n-alert "n8n service failed but email could not be sent"
fi

# Also log to syslog
logger -t n8n-alert "n8n service failed at $TIMESTAMP (restart count: $SERVICE_FAILED_COUNT)"

exit 0
