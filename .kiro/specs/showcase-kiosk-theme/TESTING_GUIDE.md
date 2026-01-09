# Showcase Theme Testing Guide

This document provides manual testing procedures for the Showcase kiosk theme to verify it meets all requirements on different screen resolutions and performs well on Raspberry Pi hardware.

## Prerequisites

- Development servers running (backend on port 3001, frontend on port 3000)
- At least 4 featured massages with video media in the database
- Admin access to change kiosk theme settings

## Task 13.1: Test on 15.6" Horizontal Screen Resolution

### Test 1: Verify Layout at 1920x1080 (Full HD)

**Steps:**
1. Open browser and navigate to `http://localhost:3000`
2. Open browser DevTools (F12)
3. Set viewport to 1920x1080:
   - Click device toolbar icon (Ctrl+Shift+M)
   - Select "Responsive" mode
   - Set dimensions to 1920 x 1080
4. Navigate to Admin Panel (`/admin/login`)
5. Login with admin credentials
6. Go to Settings → Kiosk Control
7. Change theme to "Showcase"
8. Navigate back to kiosk homepage

**Expected Results:**
- ✅ Four vertical columns visible spanning full screen width
- ✅ One main column at ~40% width (center focus)
- ✅ Three preview columns at ~20% width each
- ✅ Videos display with 16px rounded corners
- ✅ Massage names and benefits visible at bottom of each column
- ✅ Dark navy to charcoal gradient background
- ✅ Smooth column transitions when tapping different columns
- ✅ Glass detail card slides in from right when column selected
- ✅ All text is readable and properly sized

**Screenshot Location:** `my-app-screenshots/showcase-1920x1080.png`

---

### Test 2: Verify Layout at 1366x768 (Common Laptop)

**Steps:**
1. With Showcase theme still active
2. In DevTools, change viewport to 1366 x 768
3. Refresh page if needed

**Expected Results:**
- ✅ Four columns still visible and proportional
- ✅ Layout adapts to smaller width without breaking
- ✅ Text remains readable (no overflow or truncation issues)
- ✅ Touch targets remain accessible (minimum 44x44px)
- ✅ Glass card doesn't obscure main column content
- ✅ Spacing between elements is appropriate

**Screenshot Location:** `my-app-screenshots/showcase-1366x768.png`

---

### Test 3: Verify Column Proportions

**Steps:**
1. At 1920x1080 resolution
2. Open DevTools Console
3. Run this command to measure column widths:
```javascript
Array.from(document.querySelectorAll('[class*="w-"]')).map(el => ({
  width: window.getComputedStyle(el).width,
  percentage: (parseFloat(window.getComputedStyle(el).width) / window.innerWidth * 100).toFixed(2) + '%'
}))
```

**Expected Results:**
- ✅ Main column: approximately 38-42% of screen width
- ✅ Preview columns: approximately 18-22% each
- ✅ Total adds up to ~100% (accounting for gaps/padding)

---

### Test 4: Verify Spacing and Alignment

**Steps:**
1. Test at both 1920x1080 and 1366x768
2. Check for:
   - Consistent gaps between columns
   - Proper padding around text overlays
   - Aligned column heights
   - Centered content within columns

**Expected Results:**
- ✅ Consistent 4px or 8px gaps between columns
- ✅ Text overlays have adequate padding (minimum 16px)
- ✅ All columns are same height (full viewport height)
- ✅ Content is vertically and horizontally centered

---

## Task 13.2: Verify Raspberry Pi Performance

### Test 5: Measure Animation Frame Rate

**Steps:**
1. Open browser DevTools
2. Go to Performance tab
3. Click Record
4. Interact with the Showcase theme:
   - Tap different columns to trigger transitions
   - Let auto-cycle run for 30 seconds
   - Swipe left/right to navigate
5. Stop recording
6. Analyze the flame chart

**Expected Results:**
- ✅ Frame rate stays above 30 FPS during animations
- ✅ No significant frame drops or jank
- ✅ Smooth column width transitions (400ms)
- ✅ Smooth glass card slide animations (300ms in, 200ms out)
- ✅ Video playback is smooth and seamless

**Target:** Minimum 30 FPS (33.33ms per frame)
**Acceptable:** 25-30 FPS on Raspberry Pi hardware
**Note:** Headless browsers may report lower FPS than actual device

---

### Test 6: Monitor Memory Usage

**Steps:**
1. Open DevTools → Performance Monitor
2. Enable these metrics:
   - JS heap size
   - DOM Nodes
   - JS event listeners
   - Documents
   - Frames
3. Let the Showcase theme run for 5 minutes
4. Observe memory trends

**Expected Results:**
- ✅ JS Heap Size: < 200 MB
- ✅ DOM Nodes: < 5000
- ✅ No memory leaks (heap size stabilizes, doesn't continuously grow)
- ✅ Memory usage remains stable during auto-cycling
- ✅ No significant spikes when switching columns

**Console Command:**
```javascript
performance.memory
// Check: usedJSHeapSize should be < 200MB (200000000 bytes)
```

---

### Test 7: Verify GPU Acceleration

**Steps:**
1. Open DevTools → Rendering tab
2. Enable "Paint flashing"
3. Enable "Layer borders"
4. Interact with columns and observe

**Expected Results:**
- ✅ Columns use CSS transforms (visible as separate layers)
- ✅ Minimal paint flashing during animations
- ✅ `will-change` property applied to animated elements
- ✅ `transform: translateZ(0)` forces GPU layers
- ✅ Smooth hardware-accelerated transitions

**Console Check:**
```javascript
// Check for GPU-accelerated properties
document.querySelectorAll('[style*="transform"]').length > 0
document.querySelectorAll('[style*="will-change"]').length > 0
```

---

### Test 8: Verify Smooth Animations (No Jank)

**Steps:**
1. Open DevTools → Performance tab
2. Record while:
   - Auto-cycling through all 4 columns
   - Manually tapping each column
   - Swiping left and right
3. Check for long tasks (> 50ms)

**Expected Results:**
- ✅ No tasks longer than 50ms during animations
- ✅ Average frame time: < 33.33ms (30 FPS)
- ✅ Max frame time: < 100ms
- ✅ Consistent frame timing (no spikes)
- ✅ Animations complete within specified durations:
  - Column expand: 400ms
  - Card slide in: 300ms
  - Card slide out: 200ms

---

### Test 9: Verify Video Lazy Loading

**Steps:**
1. Open DevTools → Network tab
2. Filter by "media"
3. Reload the Showcase theme page
4. Observe video loading pattern

**Expected Results:**
- ✅ Videos load progressively, not all at once
- ✅ Main column video loads first (highest priority)
- ✅ Preview column videos load after main
- ✅ Off-screen videos defer loading until needed
- ✅ Total initial load time < 3 seconds

**Console Check:**
```javascript
// Count loaded videos
document.querySelectorAll('video').length
// Should be 4 (one per column)
```

---

## Integration Testing

### Test 10: Complete Showcase Theme Functionality

**Steps:**
1. Start with fresh page load at 1920x1080
2. Verify initial state:
   - 4 columns visible
   - First column (index 0) is main
   - Glass card visible for first massage
3. Test auto-cycling:
   - Wait 10 seconds
   - Verify column 2 becomes main
   - Wait another 10 seconds
   - Verify column 3 becomes main
4. Test manual interaction:
   - Tap column 1
   - Verify auto-cycle pauses for 60 seconds
   - Verify column 1 is now main
5. Test swipe navigation:
   - Swipe left → next column
   - Swipe right → previous column
6. Test glass card:
   - Verify title, description, duration display
   - If massage has sessions, verify "Show Prices" button
   - Click "Show Prices" → verify pricing list expands
   - Click "Hide Prices" → verify pricing collapses
   - Click outside card → verify card closes
7. Test pricing reset:
   - Open pricing for a massage
   - Close glass card
   - Reopen same massage
   - Verify pricing is collapsed (reset)

**Expected Results:**
- ✅ All interactions work smoothly
- ✅ Auto-cycle timing is accurate (10s intervals)
- ✅ Pause duration is accurate (60s)
- ✅ Swipe gestures are responsive
- ✅ Glass card animations are smooth
- ✅ Pricing toggle works correctly
- ✅ State resets properly

---

## Raspberry Pi Specific Testing

### Test 11: On-Device Performance

**Prerequisites:**
- Raspberry Pi 4 or 5
- Chromium browser in kiosk mode
- 15.6" horizontal display (1920x1080 or 1366x768)

**Steps:**
1. Deploy Showcase theme to Raspberry Pi
2. Start kiosk in full-screen mode
3. Let it run for 30 minutes
4. Observe:
   - Animation smoothness
   - Video playback quality
   - Memory stability
   - CPU temperature
   - Any visual glitches

**Expected Results:**
- ✅ Animations remain smooth after extended runtime
- ✅ No memory leaks or performance degradation
- ✅ Videos play without stuttering
- ✅ CPU temperature stays below 70°C
- ✅ No browser crashes or freezes
- ✅ Auto-cycle continues reliably

**Monitoring Commands (SSH to Pi):**
```bash
# Check CPU temperature
vcgencmd measure_temp

# Check memory usage
free -h

# Check Chromium process
ps aux | grep chromium

# Monitor system resources
htop
```

---

## Acceptance Criteria Checklist

### Requirements 1.1, 1.3 (Layout)
- [ ] Four columns span full screen width
- [ ] Main column ~40%, preview columns ~20% each
- [ ] Layout works at 1920x1080
- [ ] Layout works at 1366x768
- [ ] Spacing is consistent and appropriate

### Requirements 9.1, 9.2, 9.3 (Performance)
- [ ] Animations maintain 30+ FPS
- [ ] GPU acceleration is enabled
- [ ] Memory usage < 200MB
- [ ] No performance degradation over time
- [ ] Smooth on Raspberry Pi hardware

### Additional Verification
- [ ] Videos load and play correctly
- [ ] Auto-cycling works (10s intervals)
- [ ] Manual interactions pause auto-cycle (60s)
- [ ] Swipe navigation works
- [ ] Glass card displays correctly
- [ ] Pricing toggle works
- [ ] Touch targets are adequate (44x44px minimum)
- [ ] Text is readable at all resolutions
- [ ] Color contrast meets accessibility standards

---

## Troubleshooting

### Issue: Columns not displaying correctly
- Check that at least 4 massages exist in database
- Verify massages have video media URLs
- Check browser console for errors
- Verify theme is set to "showcase" in settings

### Issue: Poor performance
- Check CPU/memory usage
- Verify GPU acceleration is enabled
- Reduce video quality/resolution if needed
- Check for memory leaks in DevTools

### Issue: Videos not loading
- Verify video URLs are accessible
- Check network tab for 404 errors
- Verify video format is supported (MP4, WebM)
- Check CORS headers if videos are external

### Issue: Animations are janky
- Enable GPU acceleration in browser flags
- Check for long-running JavaScript tasks
- Verify CSS transforms are being used
- Reduce animation complexity if needed

---

## Test Results Template

```markdown
## Test Results - [Date]

**Tester:** [Name]
**Environment:** [Development/Raspberry Pi]
**Browser:** [Chrome/Chromium version]
**Screen Resolution:** [1920x1080 / 1366x768]

### Task 13.1: Screen Resolution Tests
- [ ] Test 1: 1920x1080 layout - PASS/FAIL
- [ ] Test 2: 1366x768 layout - PASS/FAIL
- [ ] Test 3: Column proportions - PASS/FAIL
- [ ] Test 4: Spacing/alignment - PASS/FAIL

### Task 13.2: Performance Tests
- [ ] Test 5: Frame rate (___FPS) - PASS/FAIL
- [ ] Test 6: Memory usage (___MB) - PASS/FAIL
- [ ] Test 7: GPU acceleration - PASS/FAIL
- [ ] Test 8: Animation smoothness - PASS/FAIL
- [ ] Test 9: Video lazy loading - PASS/FAIL

### Integration Tests
- [ ] Test 10: Complete functionality - PASS/FAIL
- [ ] Test 11: Raspberry Pi performance - PASS/FAIL

### Issues Found
1. [Description of any issues]
2. [Description of any issues]

### Screenshots
- [List of screenshots taken]

### Notes
- [Any additional observations]
```

---

## Conclusion

This testing guide provides comprehensive manual verification procedures for the Showcase theme. All tests should be performed before deploying to production, especially the Raspberry Pi performance tests to ensure smooth operation on target hardware.

For automated testing, refer to `backend/src/e2e/showcase-theme-integration.test.ts` which provides Puppeteer-based tests for basic functionality verification.
