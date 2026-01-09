# n8n Backup and Restore Guide

## Overview

This guide covers backup and restore procedures for the n8n workflow automation system, which is separate from the main kiosk backend backup system.

## Backup Strategy

### Separate Backup Schedules

The system maintains two independent backup schedules:

1. **Backend Backup**: 2:00 AM Istanbul time (existing)
   - Location: `data/backups/`
   - Includes: All kiosk database tables including coupon tables
   - Managed by: `BackupService.ts`

2. **n8n Backup**: 2:30 AM Istanbul time (new)
   - Location: `n8n-workflows/backups/`
   - Includes: n8n database and workflow JSON exports
   - Managed by: `n8n-workflows/backup.sh`

### Retention Policy

Both backup systems retain backups for **30 days**. Older backups are automatically deleted during the backup process.

## Backup Locations

### Backend Backups
```
data/backups/
├── backup-2025-11-28T02-00-00-000Z.json
├── backup-2025-11-27T02-00-00-000Z.json
└── ...
```

### n8n Backups
```
n8n-workflows/backups/
├── database-2025-11-28_02-30-00.sqlite3
├── workflows-2025-11-28_02-30-00/
│   ├── Coupon_Capture_1.json
│   ├── Claim_Redemption_2.json
│   ├── Balance_Check_3.json
│   └── Opt_Out_4.json
├── manifest-2025-11-28_02-30-00.txt
└── ...
```

## Setting Up Automated Backups

### Backend Backup (Already Configured)

The backend backup is automatically scheduled when the backend starts. No additional configuration needed.

**Verification:**
```bash
# Check backend logs for backup schedule initialization
tail -f ~/spa-kiosk/backend/logs/app.log | grep "backup schedule"
```

### n8n Backup Setup

#### 1. Make Backup Script Executable

```bash
cd ~/spa-kiosk/n8n-workflows
chmod +x backup.sh
```

#### 2. Test Manual Backup

```bash
cd ~/spa-kiosk/n8n-workflows
./backup.sh
```

Expected output:
```
[2025-11-28 02:30:00] Creating backup directories...
[2025-11-28 02:30:00] Backing up n8n database...
[2025-11-28 02:30:00] Database backup created: ./backups/database-2025-11-28_02-30-00.sqlite3
[2025-11-28 02:30:00] Database backup size: 2.5M
[2025-11-28 02:30:00] Exporting workflows from database...
[2025-11-28 02:30:00] Exported workflow: Coupon Capture (ID: 1)
[2025-11-28 02:30:00] Exported workflow: Claim Redemption (ID: 2)
[2025-11-28 02:30:00] Exported workflow: Balance Check (ID: 3)
[2025-11-28 02:30:00] Exported workflow: Opt Out (ID: 4)
[2025-11-28 02:30:00] Exported 4 workflows to ./backups/workflows-2025-11-28_02-30-00
[2025-11-28 02:30:00] Backup manifest created: ./backups/manifest-2025-11-28_02-30-00.txt
[2025-11-28 02:30:00] ==========================================
[2025-11-28 02:30:00] n8n Backup Complete!
[2025-11-28 02:30:00] ==========================================
```

#### 3. Schedule with Cron

Add to crontab to run at 2:30 AM Istanbul time daily:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path as needed)
30 2 * * * TZ=Europe/Istanbul /home/pi/spa-kiosk/n8n-workflows/backup.sh >> /home/pi/spa-kiosk/n8n-workflows/backups/backup.log 2>&1
```

**Alternative: Using systemd timer**

Create timer unit:
```bash
sudo nano /etc/systemd/system/n8n-backup.timer
```

Content:
```ini
[Unit]
Description=n8n Daily Backup Timer
Requires=n8n-backup.service

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

Create service unit:
```bash
sudo nano /etc/systemd/system/n8n-backup.service
```

Content:
```ini
[Unit]
Description=n8n Backup Service
After=n8n.service

[Service]
Type=oneshot
User=pi
Environment=TZ=Europe/Istanbul
WorkingDirectory=/home/pi/spa-kiosk/n8n-workflows
ExecStart=/home/pi/spa-kiosk/n8n-workflows/backup.sh
StandardOutput=append:/home/pi/spa-kiosk/n8n-workflows/backups/backup.log
StandardError=append:/home/pi/spa-kiosk/n8n-workflows/backups/backup.log
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable n8n-backup.timer
sudo systemctl start n8n-backup.timer

# Check status
sudo systemctl status n8n-backup.timer
sudo systemctl list-timers | grep n8n-backup
```

#### 4. Verify Backup Schedule

```bash
# Check cron jobs
crontab -l | grep backup

# Or check systemd timer
systemctl list-timers | grep n8n-backup

# Check backup log
tail -f ~/spa-kiosk/n8n-workflows/backups/backup.log
```

## Manual Backup

### Backend Manual Backup

Via admin interface:
1. Login to admin panel: `http://localhost:3001/admin`
2. Navigate to "Backup" page
3. Click "Create Backup Now"

Via API:
```bash
curl -X POST http://localhost:3001/api/admin/backup \
  -H "Cookie: connect.sid=<session-cookie>"
```

### n8n Manual Backup

```bash
cd ~/spa-kiosk/n8n-workflows
./backup.sh
```

## Restore Procedures

### Restoring Backend Database

1. **Stop the backend service:**
   ```bash
   pm2 stop kiosk-backend
   ```

2. **Backup current database:**
   ```bash
   cp ~/spa-kiosk/data/kiosk.db ~/spa-kiosk/data/kiosk.db.backup-$(date +%Y%m%d)
   ```

3. **Restore from backup:**
   
   Backend backups are in JSON format. To restore, you need to:
   - Use the admin interface "Restore" feature (recommended)
   - Or manually import the JSON data using a custom script

4. **Restart the backend:**
   ```bash
   pm2 restart kiosk-backend
   ```

5. **Verify:**
   ```bash
   curl http://localhost:3001/api/kiosk/health
   ```

### Restoring n8n Database

1. **Stop n8n service:**
   ```bash
   sudo systemctl stop n8n
   ```

2. **Backup current database:**
   ```bash
   cp /var/lib/n8n/.n8n/database.sqlite /var/lib/n8n/.n8n/database.sqlite.backup-$(date +%Y%m%d)
   ```

3. **Restore from backup:**
   ```bash
   # Find the backup you want to restore
   ls -lh ~/spa-kiosk/n8n-workflows/backups/database-*.sqlite3
   
   # Copy the backup to n8n data directory
   sudo cp ~/spa-kiosk/n8n-workflows/backups/database-2025-11-28_02-30-00.sqlite3 \
           /var/lib/n8n/.n8n/database.sqlite
   
   # Fix permissions
   sudo chown n8n:n8n /var/lib/n8n/.n8n/database.sqlite
   ```

4. **Start n8n service:**
   ```bash
   sudo systemctl start n8n
   ```

5. **Verify:**
   ```bash
   sudo systemctl status n8n
   curl http://localhost:5678/healthz
   ```

### Restoring Individual Workflows

If you only need to restore specific workflows (not the entire database):

1. **Access n8n UI:**
   ```
   http://localhost:5678
   ```

2. **Import workflow:**
   - Click "+" to create new workflow
   - Click "..." menu → "Import from File"
   - Select the workflow JSON from `n8n-workflows/backups/workflows-<timestamp>/`
   - Click "Import"

3. **Activate workflow:**
   - Review workflow settings
   - Update credentials if needed
   - Click "Active" toggle to enable

## Monitoring Backups

### Check Backup Status

**Backend backups:**
```bash
# List recent backups
ls -lh ~/spa-kiosk/data/backups/ | tail -10

# Check last backup info via API
curl http://localhost:3001/api/admin/backup/last
```

**n8n backups:**
```bash
# List recent backups
ls -lh ~/spa-kiosk/n8n-workflows/backups/ | tail -10

# View latest manifest
cat ~/spa-kiosk/n8n-workflows/backups/manifest-*.txt | tail -20
```

### Backup Size Monitoring

```bash
# Backend backup size
du -sh ~/spa-kiosk/data/backups/

# n8n backup size
du -sh ~/spa-kiosk/n8n-workflows/backups/

# Total backup size
du -sh ~/spa-kiosk/data/backups/ ~/spa-kiosk/n8n-workflows/backups/
```

### Backup Alerts

Set up alerts for backup failures:

**For cron jobs:**
```bash
# Add MAILTO to crontab
crontab -e

# Add at the top
MAILTO=admin@example.com

# Cron will email on failures
```

**For systemd timers:**

Create failure alert service (see `n8n-workflows/deployment/n8n-failure-alert.service`)

## Troubleshooting

### Backend Backup Issues

**Issue: Backup fails with "Database locked"**
- Cause: Database is in use
- Solution: Backups use read-only mode, should not lock. Check for long-running queries.

**Issue: Backup file is empty or corrupted**
- Cause: Disk space or permissions
- Solution: Check disk space with `df -h` and permissions with `ls -la data/backups/`

### n8n Backup Issues

**Issue: "n8n database not found"**
- Cause: n8n not installed or wrong path
- Solution: Check `N8N_DATA_DIR` environment variable or update script path

**Issue: "sqlite3 command not found"**
- Cause: sqlite3 CLI not installed
- Solution: Install with `sudo apt-get install sqlite3`
- Note: Database backup will still work, only workflow JSON export will be skipped

**Issue: Backup script fails with permission denied**
- Cause: Script not executable or wrong user
- Solution: `chmod +x backup.sh` and ensure running as correct user

**Issue: Old backups not being cleaned up**
- Cause: Cron job not running or script error
- Solution: Check cron logs with `grep CRON /var/log/syslog` and test script manually

## Best Practices

1. **Test Restores Regularly**
   - Perform test restores monthly to verify backup integrity
   - Document restore time and any issues

2. **Monitor Disk Space**
   - Backups can grow large over time
   - Set up alerts when disk usage exceeds 80%

3. **Off-Site Backups**
   - Consider copying backups to external storage
   - Use rsync or cloud storage for redundancy

4. **Document Changes**
   - Keep notes of any workflow changes
   - Update this document when procedures change

5. **Verify After Restore**
   - Always test functionality after restore
   - Check all workflows are active and working

## Backup Checklist

### Daily (Automated)
- [ ] Backend backup runs at 2:00 AM Istanbul time
- [ ] n8n backup runs at 2:30 AM Istanbul time
- [ ] Old backups (>30 days) are cleaned up

### Weekly (Manual)
- [ ] Verify backup files exist and are recent
- [ ] Check backup logs for errors
- [ ] Monitor disk space usage

### Monthly (Manual)
- [ ] Perform test restore on development system
- [ ] Review and update backup procedures
- [ ] Verify off-site backup copies (if configured)

## Support

For backup-related issues:
1. Check logs: `~/spa-kiosk/n8n-workflows/backups/backup.log`
2. Review manifest files for backup details
3. Test manual backup to isolate issues
4. Check system resources (disk space, memory)

## Related Documentation

- Backend Backup Service: `backend/src/services/BackupService.ts`
- n8n Deployment Guide: `n8n-workflows/deployment/DEPLOYMENT.md`
- System Requirements: `n8n-workflows/deployment/README.md`

---

**Last Updated:** 2025-11-28  
**Version:** 1.0  
**Status:** ✅ Production Ready
