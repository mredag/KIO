# Email Alerts Setup for n8n Service

This guide explains how to configure email alerts for n8n service failures.

**Requirements:** 26.1 - Email notifications for n8n service failures

## Prerequisites

### 1. Install Mail Utilities

```bash
sudo apt-get update
sudo apt-get install mailutils postfix
```

During postfix installation, select:
- **Internet Site** (if you have a domain)
- **Local only** (for testing with local delivery)

### 2. Configure Postfix (Optional for External Email)

For sending to external email addresses (Gmail, etc.), configure postfix as a relay:

```bash
sudo nano /etc/postfix/main.cf
```

Add/modify these lines:

```
relayhost = [smtp.gmail.com]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
```

Create credentials file:

```bash
sudo nano /etc/postfix/sasl_passwd
```

Add:

```
[smtp.gmail.com]:587 your-email@gmail.com:your-app-password
```

Secure and reload:

```bash
sudo chmod 600 /etc/postfix/sasl_passwd
sudo postmap /etc/postfix/sasl_passwd
sudo systemctl restart postfix
```

### 3. Test Email Sending

```bash
echo "Test email body" | mail -s "Test Subject" your-email@example.com
```

Check if email was received. If not, check logs:

```bash
sudo tail -f /var/log/mail.log
```

## Installation

### 1. Copy Alert Script

```bash
sudo cp n8n-failure-alert.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/n8n-failure-alert.sh
```

### 2. Configure Alert Email

Edit the script or set environment variable:

```bash
sudo nano /usr/local/bin/n8n-failure-alert.sh
```

Change:

```bash
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"
```

To your actual email address.

### 3. Install Alert Service

```bash
sudo cp n8n-failure-alert.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 4. Update n8n Service

The n8n.service file already includes `OnFailure=n8n-failure-alert.service`.

Copy the updated service file:

```bash
sudo cp n8n.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 5. Enable Services

```bash
sudo systemctl enable n8n-failure-alert.service
sudo systemctl enable n8n.service
```

## Testing

### Test the Alert Script Manually

```bash
sudo /usr/local/bin/n8n-failure-alert.sh
```

Check if you received an email.

### Test with Service Failure

Simulate a failure:

```bash
# Stop n8n
sudo systemctl stop n8n.service

# Cause it to fail by making the executable non-existent temporarily
sudo mv /usr/bin/n8n /usr/bin/n8n.bak

# Try to start (will fail)
sudo systemctl start n8n.service

# Check if alert was triggered
sudo journalctl -u n8n-failure-alert.service -n 20

# Restore n8n
sudo mv /usr/bin/n8n.bak /usr/bin/n8n
sudo systemctl start n8n.service
```

## Verification

### Check Alert Service Status

```bash
sudo systemctl status n8n-failure-alert.service
```

### Check n8n Service Configuration

```bash
systemctl show n8n.service | grep OnFailure
```

Should show: `OnFailure=n8n-failure-alert.service`

### View Alert Logs

```bash
# View systemd journal
sudo journalctl -u n8n-failure-alert.service -f

# View syslog
sudo grep n8n-alert /var/log/syslog
```

## Customization

### Change Alert Email

Option 1: Edit the script directly:

```bash
sudo nano /usr/local/bin/n8n-failure-alert.sh
```

Option 2: Override with systemd:

```bash
sudo systemctl edit n8n-failure-alert.service
```

Add:

```ini
[Service]
Environment=ALERT_EMAIL=your-email@example.com
```

Then reload:

```bash
sudo systemctl daemon-reload
```

### Add Multiple Recipients

Edit the script to send to multiple addresses:

```bash
ALERT_EMAIL="admin1@example.com admin2@example.com"
```

Or use a mailing list.

### Customize Email Content

Edit `/usr/local/bin/n8n-failure-alert.sh` and modify the `BODY` variable.

## Troubleshooting

### Email Not Received

1. **Check mail logs:**
   ```bash
   sudo tail -f /var/log/mail.log
   ```

2. **Check postfix status:**
   ```bash
   sudo systemctl status postfix
   ```

3. **Check mail queue:**
   ```bash
   mailq
   ```

4. **Test mail command:**
   ```bash
   echo "Test" | mail -s "Test" your-email@example.com
   ```

### Alert Service Not Triggering

1. **Check OnFailure directive:**
   ```bash
   systemctl show n8n.service | grep OnFailure
   ```

2. **Check alert service status:**
   ```bash
   sudo systemctl status n8n-failure-alert.service
   ```

3. **Check script permissions:**
   ```bash
   ls -l /usr/local/bin/n8n-failure-alert.sh
   ```

4. **Test script manually:**
   ```bash
   sudo /usr/local/bin/n8n-failure-alert.sh
   ```

### Postfix Configuration Issues

1. **Check postfix configuration:**
   ```bash
   sudo postconf -n
   ```

2. **Test SMTP connection:**
   ```bash
   telnet smtp.gmail.com 587
   ```

3. **Check authentication:**
   ```bash
   sudo postmap -q "[smtp.gmail.com]:587" /etc/postfix/sasl_passwd
   ```

## Alternative: Webhook Alerts

If email is not available, you can modify the script to send alerts via webhook:

```bash
# In n8n-failure-alert.sh, replace mail command with:
curl -X POST https://your-webhook-url.com/alert \
  -H "Content-Type: application/json" \
  -d "{\"service\":\"$SERVICE_NAME\",\"hostname\":\"$HOSTNAME\",\"timestamp\":\"$TIMESTAMP\"}"
```

## Security Considerations

1. **Protect credentials:**
   ```bash
   sudo chmod 600 /etc/postfix/sasl_passwd
   sudo chmod 600 /etc/postfix/sasl_passwd.db
   ```

2. **Use app passwords:** For Gmail, use app-specific passwords, not your main password.

3. **Limit script access:**
   ```bash
   sudo chmod 755 /usr/local/bin/n8n-failure-alert.sh
   ```

4. **Review logs regularly:** Check `/var/log/mail.log` for suspicious activity.

## Monitoring

### Check Alert History

```bash
# View all n8n alerts
sudo grep "n8n-alert" /var/log/syslog

# Count failures in last 24 hours
sudo grep "n8n-alert" /var/log/syslog | grep "$(date +%Y-%m-%d)" | wc -l
```

### Set Up Log Rotation

Create `/etc/logrotate.d/n8n-alerts`:

```
/var/log/n8n-alerts.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
```

## Integration with Monitoring Systems

### Prometheus/Grafana

Export systemd metrics:

```bash
sudo apt-get install prometheus-node-exporter
```

Query n8n service status in Prometheus:

```
node_systemd_unit_state{name="n8n.service",state="failed"}
```

### Nagios/Icinga

Add check command:

```bash
/usr/lib/nagios/plugins/check_systemd -u n8n.service
```

## References

- [systemd OnFailure directive](https://www.freedesktop.org/software/systemd/man/systemd.unit.html#OnFailure=)
- [Postfix configuration](http://www.postfix.org/documentation.html)
- [n8n documentation](https://docs.n8n.io/)

---

**Last Updated:** 2025-11-28  
**Status:** ✅ Ready for deployment  
**Requirements:** 26.1
