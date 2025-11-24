# Raspberry Pi Installation Checklist

## Pre-Installation

- [ ] Raspberry Pi 5 (or Pi 4 with 4GB+ RAM)
- [ ] 32GB+ SD card (64GB recommended)
- [ ] Official power supply (27W for Pi 5)
- [ ] HDMI display connected
- [ ] Keyboard and mouse (for initial setup)
- [ ] Ethernet cable (recommended) or WiFi configured
- [ ] Fresh Raspberry Pi OS (64-bit) installed

## Installation Steps

### 1. Initial Raspberry Pi Setup
- [ ] Boot Raspberry Pi
- [ ] Complete initial setup wizard
- [ ] Set country, language, timezone
- [ ] Set pi user password
- [ ] Connect to network
- [ ] Update system: `sudo apt-get update && sudo apt-get upgrade`

### 2. Clone Repository
```bash
cd ~
git clone <your-repo-url> spa-kiosk
cd spa-kiosk
```
- [ ] Repository cloned successfully
- [ ] Navigate to spa-kiosk directory

### 3. Run Setup Script
```bash
chmod +x deployment/setup-raspberry-pi.sh
./deployment/setup-raspberry-pi.sh
```
- [ ] Script started successfully
- [ ] Confirmed installation (press Y)
- [ ] Wait 15-30 minutes for completion
- [ ] No errors during installation

### 4. Configure Backend (Optional)
```bash
nano ~/spa-kiosk/backend/.env
```
- [ ] Review backend/.env settings
- [ ] Change ADMIN_PASSWORD if needed
- [ ] Save and exit

### 5. Reboot
```bash
sudo reboot
```
- [ ] System rebooted
- [ ] Wait 2-3 minutes for full startup

## Post-Installation Verification

### 6. Check Backend
- [ ] Backend started automatically
- [ ] Check status: `pm2 status`
- [ ] Should show "kiosk-backend" online
- [ ] Check logs: `pm2 logs kiosk-backend --lines 20`
- [ ] No errors in logs

### 7. Check Kiosk Display
- [ ] Chromium opened automatically in fullscreen
- [ ] Kiosk homepage visible
- [ ] No error messages
- [ ] Touch/mouse interaction works

### 8. Check Network
- [ ] Static IP configured: `ip addr show`
- [ ] Should show 192.168.1.16
- [ ] Can ping router: `ping 192.168.1.1`
- [ ] Internet working: `ping 8.8.8.8`

### 9. Test Admin Panel
From another device on the network:
- [ ] Open browser
- [ ] Navigate to: http://192.168.1.16:3001/admin
- [ ] Login page loads
- [ ] Can login with credentials
- [ ] Dashboard accessible

### 10. Test Kiosk Features
- [ ] Digital menu displays massages
- [ ] Can navigate between massages
- [ ] Media (photos/videos) loads
- [ ] Slideshow mode works
- [ ] Survey mode works (if configured)
- [ ] Google review QR code displays (if configured)

## System Services Verification

### 11. Check Watchdog
```bash
sudo systemctl status kiosk-watchdog
```
- [ ] Service active and running
- [ ] No errors in status

### 12. Check Automatic Backups
```bash
crontab -l
```
- [ ] Backup cron job listed
- [ ] Scheduled for 2 AM daily

### 13. Check Auto-Start
```bash
ls ~/.config/autostart/
```
- [ ] kiosk.desktop file exists
- [ ] File is executable

## Performance Check

### 14. System Resources
```bash
htop
```
- [ ] CPU usage reasonable (<50% idle)
- [ ] Memory usage acceptable (<80%)
- [ ] No processes consuming excessive resources

### 15. Temperature
```bash
vcgencmd measure_temp
```
- [ ] Temperature below 70°C
- [ ] If higher, consider adding cooling

### 16. Disk Space
```bash
df -h
```
- [ ] Root partition has >5GB free
- [ ] No partitions at 100%

## Final Tests

### 17. Reboot Test
```bash
sudo reboot
```
- [ ] System reboots cleanly
- [ ] Backend starts automatically
- [ ] Kiosk opens automatically
- [ ] Everything works after reboot

### 18. Recovery Test
```bash
pkill chromium
```
- [ ] Chromium restarts automatically (within 60 seconds)
- [ ] Kiosk displays correctly after restart

### 19. Backend Restart Test
```bash
pm2 restart kiosk-backend
```
- [ ] Backend restarts successfully
- [ ] Kiosk reconnects automatically
- [ ] No data loss

## Documentation

### 20. Save Important Information
- [ ] Note static IP: 192.168.1.16
- [ ] Note admin credentials
- [ ] Note WiFi password (if used)
- [ ] Print quick reference card from PI_SETUP_GUIDE.md

## Optional Enhancements

### 21. Security Hardening
- [ ] Change pi user password: `passwd`
- [ ] Change admin panel password
- [ ] Enable firewall: `sudo ufw enable`
- [ ] Disable SSH if not needed

### 22. Display Settings
- [ ] Adjust screen brightness
- [ ] Configure display rotation if needed
- [ ] Test touch calibration (if touch screen)

### 23. Backup Configuration
- [ ] Test manual backup: `~/spa-kiosk/deployment/raspberry-pi/backup-database.sh`
- [ ] Verify backup created in data/backups/
- [ ] Copy backup to external storage

## Troubleshooting (If Issues)

### Backend Not Starting
```bash
pm2 logs kiosk-backend
sudo netstat -tulpn | grep 3001
pm2 restart kiosk-backend
```

### Kiosk Not Displaying
```bash
ps aux | grep chromium
curl http://localhost:3001/api/kiosk/health
~/start-kiosk.sh
```

### Network Issues
```bash
ip addr show
sudo systemctl restart dhcpcd
ping 192.168.1.1
```

## Sign-Off

Installation completed by: ________________

Date: ________________

Verified by: ________________

Notes:
_____________________________________________
_____________________________________________
_____________________________________________

---

## Quick Reference

**IP Address:** 192.168.1.16
**Admin Panel:** http://192.168.1.16:3001/admin
**Kiosk URL:** http://localhost:3000

**Commands:**
- Check status: `pm2 status`
- View logs: `pm2 logs kiosk-backend`
- Restart backend: `pm2 restart kiosk-backend`
- Restart kiosk: `pkill chromium`
- Reboot: `sudo reboot`
- Update app: `~/spa-kiosk/deployment/update-pi.sh`

**Support:** See PI_SETUP_GUIDE.md for detailed troubleshooting
