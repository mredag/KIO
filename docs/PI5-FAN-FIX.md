# Raspberry Pi 5 Fan Fix Guide

## Problem

Pi 5 running at **78°C idle** with active cooler attached but not spinning. The fan gets a brief 0.5-second power pulse on boot (firmware initialization) then stops completely. This causes:

- Thermal throttling under load
- Boot instability (white screen with cursor, requires multiple restarts)
- Potential long-term hardware damage

## Root Cause

The Pi 5's fan driver (`cooling_fan` device tree overlay) is **not enabled by default** in Raspberry Pi OS. Without it, the kernel never takes PWM control of the fan — only the firmware gives it a brief pulse during POST.

## Diagnosis

SSH into the Pi and run these checks:

```bash
# Check CPU temperature (anything above 70°C idle = no cooling)
vcgencmd measure_temp

# Check if any cooling devices exist (empty = fan driver not loaded)
ls /sys/class/thermal/cooling_device*/type 2>/dev/null

# Check for fan RPM sensor (no output = fan not controlled)
cat /sys/class/hwmon/*/fan1_input 2>/dev/null

# Check if fan overlay is in config
grep -i fan /boot/firmware/config.txt
```

If `cooling_device*` returns nothing and temperature is 70°C+, the fan driver is missing.

## Fix

### 1. Backup config.txt

```bash
sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.bak
```

### 2. Add fan configuration

Edit the config file:

```bash
sudo nano /boot/firmware/config.txt
```

Add these lines **before** any `[cm4]` or `[cm5]` section (or at the end if no such sections exist):

```ini
# Active cooling - Pi 5 fan control
dtparam=cooling_fan=on
dtparam=fan_temp0=45000,fan_temp0_hyst=3000,fan_temp0_speed=75
dtparam=fan_temp1=55000,fan_temp1_hyst=3000,fan_temp1_speed=130
dtparam=fan_temp2=65000,fan_temp2_hyst=3000,fan_temp2_speed=200
dtparam=fan_temp3=72000,fan_temp3_hyst=3000,fan_temp3_speed=255
```

### Temperature Thresholds Explained

| Threshold | Temp | Hysteresis | Fan Speed | Duty |
|-----------|------|------------|-----------|------|
| temp0 | 45°C | ±3°C | 75/255 | ~29% (quiet) |
| temp1 | 55°C | ±3°C | 130/255 | ~51% (medium) |
| temp2 | 65°C | ±3°C | 200/255 | ~78% (high) |
| temp3 | 72°C | ±3°C | 255/255 | 100% (full) |

The hysteresis value prevents rapid on/off cycling. For example, if the fan kicks in at 45°C, it won't turn off until temperature drops below 42°C (45 - 3).

Fan speed values are 0–255 (PWM duty cycle). Adjust to taste — lower values = quieter but warmer.

### 3. Reboot

```bash
sudo reboot
```

### 4. Verify

After reboot, confirm the fix:

```bash
# Temperature should drop to ~50-63°C within a few minutes
vcgencmd measure_temp

# Should show cooling_device0
ls /sys/class/thermal/cooling_device*/type
cat /sys/class/thermal/cooling_device0/type
# Expected output: "cooling_fan"

# Fan RPM (should show a number like 3000-5000)
cat /sys/class/hwmon/*/fan1_input

# Current fan state (0=off, 1-4 = threshold level)
cat /sys/class/thermal/cooling_device0/cur_state
```

## Results

After applying this fix on our Pi 5:

| Metric | Before | After |
|--------|--------|-------|
| Idle temp | 78°C | 63°C (and dropping) |
| Fan RPM | 0 | 3100–4850 |
| Fan state | N/A | 4 (full speed, came down as temp dropped) |
| Boot stability | Failed 2/3 attempts | Clean boot every time |

## Hardware Troubleshooting

If the fan still doesn't spin after the software fix:

### Check the 4-pin connector
The Pi 5 fan header is a JST-SH 4-pin connector. Pin order: GND, 5V, PWM, TACH. A common issue is the **tacho (TACH) pin getting bent** during installation, which can prevent the fan controller from detecting the fan.

- Disconnect the fan and inspect all 4 pins
- Look for bent or misaligned pins, especially pin 4 (TACH)
- Reconnect firmly — you should hear/feel a click

### Check fan voltage
Some third-party fans need 5V–12V. The Pi 5 header provides 5V. If your fan is rated for higher voltage, it may spin weakly or not at all.

### Test with a different fan
The official Raspberry Pi Active Cooler is guaranteed compatible. Third-party fans with 4-pin PWM connectors should also work if they're 5V rated.

## Additional Optimizations Applied

While fixing the fan, we also improved boot reliability:

### Disabled unnecessary services
```bash
sudo systemctl disable cups cups-browsed cups.path
sudo systemctl disable bluetooth
sudo systemctl disable ModemManager
sudo systemctl disable avahi-daemon
sudo systemctl disable cloud-init cloud-init-local cloud-config cloud-final
sudo systemctl disable nfs-blkmap
sudo systemctl disable rpcbind
```

### Improved kiosk startup script
- Increased initial delay from 10s to 20s (gives PM2 services time to start)
- Added 60s timeout for backend health check
- Added Chromium flags: `--disable-gpu-compositing --disable-smooth-scrolling --memory-pressure-off`

---

**Applied:** 2026-03-01 on Pi 5 (8GB, Debian 13 Bookworm aarch64)
**Pi IP:** 192.168.1.9 (wired)
