# Touch Screen Fix for Raspberry Pi (192.168.1.9)

## Problem
USB touch monitor (VID: 0318, PID: 2808) is detected as keyboard/mouse only, not as touchscreen.

## Root Cause ⚠️ HARDWARE WIRING ISSUE
**The monitor requires a SEPARATE USB data cable for touch functionality!**

HDMI only carries video - touch data needs its own USB connection from Pi to monitor.

## Current Status (Verified)
```
lsusb output:
Bus 001 Device 002: ID 0318:2808  2.4G Composite Devic

libinput list-devices:
- 2.4G Composite Devic (keyboard) ✅
- 2.4G Composite Devic Mouse (pointer) ✅
- NO TOUCHSCREEN DEVICE ❌
```

The device is only showing keyboard/mouse - **touch controller is NOT detected**.

## Solution: Correct Hardware Wiring

### Required Cables (3 separate connections)
Your ZEUSLAP monitor needs:

1. **Video:** Pi 5 micro-HDMI → Monitor mini-HDMI
2. **Touch Data:** Pi 5 USB-A (blue port) → Monitor middle Type-C port ⚠️ **MISSING**
3. **Power:** Charger → Monitor Type-C PD port

### Step-by-Step Fix

#### 1. Connect the USB Data Cable
```
Pi 5 USB-A port (blue) ──USB-A to USB-C cable──> Monitor middle Type-C port
```

**Important:**
- Use a **data-capable** USB cable (not charge-only)
- Connect to Pi's **USB-A port** (NOT the USB-C power port)
- Connect to monitor's **middle Type-C** port (data port, not PD power port)
- Prefer direct connection (no USB hub)

#### 2. Verify Touch Controller is Detected
After connecting the USB cable:

```bash
# Check if new USB device appears
lsusb

# Check for touchscreen in input devices
libinput list-devices | grep -i touch

# Watch for touch events
sudo libinput debug-events
# Then tap the screen - you should see events
```

#### 3. If Detected: Configure Touch Mapping (Wayland)
On Raspberry Pi OS Bookworm (Wayland):

1. Open **Preferences → Screen Configuration**
2. Go to **Layout → Screens → HDMI-A-1**
3. Select **Touchscreen** and bind to that screen
4. Set **Orientation** if needed
5. **Reboot**

## Verification

After reconnecting/rebooting, check if touch is detected:

```bash
# Check input devices
cat /proc/bus/input/devices | grep -i touch

# List X input devices (from desktop session)
DISPLAY=:0 xinput list

# Test touch events
sudo evtest
# Select the touchscreen device and touch the screen
```

## Expected Result
You should see a new input device with "touch" or "touchscreen" in its name, and touching the screen should generate input events.

## Troubleshooting

### If touch still doesn't work after connecting USB cable:

1. **Verify USB cable is data-capable:**
   - Try a different USB-A to USB-C cable
   - Avoid "charge-only" cables
   - Test with a known working data cable

2. **Try different USB ports:**
   ```bash
   # Move to another Pi USB-A port
   # Prefer direct connection (no hub)
   ```

3. **Check if touch controller appears:**
   ```bash
   lsusb  # Should show a NEW device (not just 0318:2808)
   dmesg | grep -i "touch\|hid"  # Look for touch controller
   ```

4. **Ensure monitor has power:**
   - Connect monitor's PD port to its own charger
   - Stable power helps USB enumeration

5. **Update system:**
   ```bash
   sudo apt update && sudo apt full-upgrade -y
   sudo reboot
   ```

6. **Install debugging tools:**
   ```bash
   sudo apt install -y libinput-tools evtest xinput-calibrator
   ```

### If you need to calibrate the touchscreen:

```bash
sudo apt install xinput-calibrator
DISPLAY=:0 xinput_calibrator
```

## Device Information
- **Vendor ID:** 0318
- **Product ID:** 2808
- **Device Name:** 2.4G Composite Devic
- **Connection:** USB
- **Driver:** usbtouchscreen (kernel module)

## What NOT to Do
❌ Don't rely on HDMI alone for touch - it only carries video
❌ Don't use the Pi's USB-C port for data - it's power input only
❌ Don't use charge-only USB cables
❌ Don't connect to monitor's PD port for data - it's power only

## Expected Result After Correct Wiring
```bash
lsusb
# Should show ADDITIONAL device (touch controller)

libinput list-devices
# Should show device with "Capabilities: touch" or similar

sudo libinput debug-events
# Tapping screen should generate touch events
```

## Status
❌ Touch NOT working - USB data cable not connected
✅ Module `usbtouchscreen` loaded and ready
⏳ **ACTION REQUIRED: Connect USB-A (Pi) to Type-C (monitor middle port)**

---
**Date:** 2026-02-11  
**Pi IP:** 192.168.1.9  
**Monitor:** ZEUSLAP with separate USB touch data requirement
