---
inclusion: always
priority: high
---

# UI/UX Testing with Puppeteer

## CRITICAL: Project Configuration

**Frontend URL**: `http://localhost:3000` (NOT 5173)
**Backend URL**: `http://localhost:3001` (NOT 3000)
**Test Script**: `node test-my-app-now.js` (already configured with correct ports)

## Server Management Best Practices

### Starting Servers
1. **Always check if processes are already running** using `listProcesses` tool
2. **Kill conflicting processes** before starting new ones:
   - Use `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force` to kill all node processes
   - Wait 2-3 seconds after killing processes
3. **Start servers using controlPwshProcess**:
   ```
   controlPwshProcess(action: "start", path: "backend", command: "npm run dev")
   controlPwshProcess(action: "start", path: "frontend", command: "npm run dev")
   ```
4. **Wait 8-10 seconds** for servers to fully start
5. **Verify servers are running** using `getProcessOutput` tool

### Common Issues & Solutions
- **Port 3001 already in use**: Kill all node processes first
- **Connection refused**: Servers not fully started, wait longer
- **page.waitForTimeout is not a function**: Use `await new Promise(resolve => setTimeout(resolve, ms))` instead

## Automatic UI/UX Verification

After completing any UI or UX related task, you MUST automatically run Puppeteer tests to verify the changes visually and functionally.

### Efficient Testing Workflow
1. Make UI/UX changes
2. Check if servers are running (`listProcesses`)
3. If not running, start them (see Server Management above)
4. Wait for servers to be ready (8-10 seconds)
5. Run `node test-my-app-now.js`
6. Generate verification report
7. Update or create markdown report file

## When to Run Puppeteer Tests

Run Puppeteer tests automatically after:
- Creating or modifying UI components
- Changing styles, CSS, or layouts
- Updating responsive design
- Modifying forms or interactive elements
- Changing colors, fonts, or spacing
- Adding or removing UI features
- Updating navigation or routing
- Modifying animations or transitions
- Changing button sizes or touch targets
- Updating accessibility features

## How to Run Tests

### Quick Visual Check (RECOMMENDED)
```bash
# Take screenshots of affected pages - ALREADY CONFIGURED WITH CORRECT PORTS
node test-my-app-now.js
```

**This script automatically tests**:
- Kiosk homepage (http://localhost:3000)
- Admin login page (http://localhost:3000/admin/login)
- Login form interaction
- Mobile viewport (375x667px)
- Desktop viewport (1920x1080px)

### Full UI Test Suite
```bash
# Run comprehensive UI tests
cd backend
npm run test:e2e
```

### Puppeteer Code Best Practices

**CORRECT** - Use setTimeout wrapper:
```javascript
await new Promise(resolve => setTimeout(resolve, 2000));
```

**INCORRECT** - Don't use (deprecated):
```javascript
await page.waitForTimeout(2000); // This will fail!
```

**CORRECT** - Use project URLs:
```javascript
await page.goto('http://localhost:3000/admin/login');
```

**INCORRECT** - Don't use:
```javascript
await page.goto('http://localhost:5173/admin/login'); // Wrong port!
```

## Required Verification Steps

After any UI/UX task, you must:

1. **Take Screenshots**
   - Capture before/after if possible
   - Test at multiple viewports (mobile, tablet, desktop)
   - Save to appropriate folder

2. **Verify Visual Elements**
   - Check button sizes (minimum 44x44px, preferably 80x80px for kiosk)
   - Verify font sizes (minimum 16px, preferably 24px+ for kiosk)
   - Confirm color contrast (minimum 4.5:1 ratio)
   - Check spacing and alignment

3. **Test Interactions**
   - Click buttons and links
   - Fill and submit forms
   - Test navigation
   - Verify animations and transitions

4. **Check Responsive Design**
   - Mobile (375x667px)
   - Tablet (768x1024px)
   - Desktop (1920x1080px)

5. **Generate Report**
   - Document what was tested
   - Note any issues found
   - Provide screenshots as evidence
   - Suggest improvements if needed

## Test Execution Template

When completing a UI/UX task, follow this template:

```markdown
## UI/UX Verification

### Changes Made
- [List specific UI/UX changes]

### Puppeteer Tests Run
- [ ] Quick visual check (test-my-app-now.js)
- [ ] Full test suite (npm run test:e2e)
- [ ] Mobile viewport testing
- [ ] Tablet viewport testing
- [ ] Desktop viewport testing

### Screenshots Captured
- [List screenshot files with descriptions]

### Verification Results
- ✅ Button sizes: [Pass/Fail - details]
- ✅ Font sizes: [Pass/Fail - details]
- ✅ Color contrast: [Pass/Fail - details]
- ✅ Responsive design: [Pass/Fail - details]
- ✅ Interactions: [Pass/Fail - details]
- ✅ Accessibility: [Pass/Fail - details]

### Issues Found
- [List any issues discovered]

### Recommendations
- [List any improvement suggestions]

### Screenshots Location
- Screenshots saved to: [folder path]
```

## Kiosk-Specific Requirements

For kiosk mode pages, ensure:
- Touch targets are minimum 80x80px
- Fonts are 24px or larger
- High contrast colors (4.5:1 minimum)
- Clear visual feedback on touch
- Smooth animations (200-300ms)
- No small clickable elements
- Adequate spacing between elements

## Admin Panel Requirements

For admin pages, ensure:
- Forms are properly validated
- Error messages are clear
- Loading states are visible
- Success feedback is provided
- Tables are sortable/filterable
- Navigation is intuitive

## Accessibility Checks

Always verify:
- All images have alt text
- Buttons have labels or aria-labels
- Proper heading hierarchy (h1, h2, h3)
- Focus indicators are visible
- Color contrast meets WCAG AA
- Keyboard navigation works

## Performance Checks

Measure and verify:
- Page load time < 2 seconds
- First paint < 1 second
- No layout shifts
- Smooth animations (60fps)
- Optimized images

## Example: Complete UI Task Workflow

```markdown
Task: Update button styles in kiosk mode

1. Make changes to CSS/components
2. Start dev servers
3. Run Puppeteer tests:
   ```bash
   node test-my-app-now.js
   ```
4. Review screenshots
5. Verify button sizes (should be 80x80px)
6. Test on mobile/tablet/desktop
7. Check accessibility
8. Document results
9. Commit changes with verification report
```

## Automated Testing Script Template

Use this template for custom tests (remember to use correct ports and setTimeout):

```javascript
// verify-ui-changes.js
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 }
  ];
  
  // CORRECT URLS - Use localhost:3000 for frontend
  const pages = [
    'http://localhost:3000',
    'http://localhost:3000/admin/login'
  ];
  
  for (const viewport of viewports) {
    await page.setViewport(viewport);
    
    for (const url of pages) {
      await page.goto(url, { waitUntil: 'networkidle0' });
      // CORRECT - Use setTimeout wrapper instead of page.waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      const filename = `${viewport.name}-${url.split('/').pop() || 'home'}.png`;
      await page.screenshot({ path: `verification/${filename}` });
      console.log(`✅ Captured: ${filename}`);
    }
  }
  
  await browser.close();
  console.log('🎉 Verification complete!');
})();
```

## Integration with Development Workflow

### Before Committing UI Changes
1. Run Puppeteer tests
2. Review screenshots
3. Fix any issues found
4. Re-test
5. Include verification report in commit message

### During Code Review
- Attach screenshots to PR
- Document UI changes visually
- Show before/after comparisons
- Highlight accessibility improvements

### Before Deployment
- Run full test suite
- Verify all pages
- Check all viewports
- Confirm no regressions

## Failure Handling

### Common Errors & Quick Fixes

**Error: "net::ERR_CONNECTION_REFUSED"**
- Cause: Servers not running
- Fix: Start servers using controlPwshProcess, wait 8-10 seconds

**Error: "page.waitForTimeout is not a function"**
- Cause: Using deprecated Puppeteer API
- Fix: Replace with `await new Promise(resolve => setTimeout(resolve, ms))`

**Error: "listen EADDRINUSE: address already in use :::3001"**
- Cause: Backend port already occupied
- Fix: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force`

**Error: "Process already running"**
- Cause: Previous process not cleaned up
- Fix: Use `listProcesses` to check, then stop with `controlPwshProcess(action: "stop")`

**Error: "Cannot read properties of undefined (reading 'length')"**
- Cause: Data type mismatch between backend (snake_case) and frontend (camelCase)
- Fix: Add transformation function in API hooks (see data-transformation.md steering file)

**Error: "massages is not iterable"**
- Cause: Variable is object instead of array, or undefined
- Fix: Add `Array.isArray()` check before spreading/iterating

**Error: "No routes matched location"**
- Cause: Missing route definition in App.tsx
- Fix: Add the route to the Routes component

### Standard Troubleshooting Steps
1. Check error message carefully
2. Check browser console for JavaScript errors
3. Verify servers are running (`listProcesses`)
4. Check API responses in Network tab
5. Verify data transformation is applied (snake_case → camelCase)
6. Kill all node processes if needed
7. Restart servers cleanly
8. Wait adequate time (8-10 seconds)
9. Clear browser cache if needed
10. Re-run tests
11. Document resolution in report

## Success Criteria

UI/UX task is complete only when:
- ✅ All Puppeteer tests pass
- ✅ Screenshots show correct rendering
- ✅ All viewports tested
- ✅ Accessibility verified
- ✅ Performance acceptable
- ✅ No visual regressions
- ✅ Documentation updated

## Quick Reference Commands

```bash
# Quick test
node test-my-app-now.js

# Full test suite
cd backend && npm run test:e2e

# View screenshots
explorer my-app-screenshots  # Windows
open my-app-screenshots      # Mac
xdg-open my-app-screenshots  # Linux

# Check test results
cat backend/ui-improvement-report.json
```

## Database Testing with Puppeteer

### When API Creation Fails

If Puppeteer form submission or API calls don't persist data:

**Option 1: Direct Database Insertion**
```javascript
const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');

const stmt = db.prepare(`INSERT INTO massages (...) VALUES (...)`);
stmt.run(...values);

// Verify
const count = db.prepare('SELECT COUNT(*) FROM massages').get();
console.log('Total records:', count);

db.close();
```

**Option 2: Restart Backend**
- Database changes may not be picked up by hot reload
- Stop backend: `controlPwshProcess(action: "stop", processId: X)`
- Wait 2-3 seconds
- Start backend: `controlPwshProcess(action: "start", path: "backend", command: "npm run dev")`
- Wait 8-10 seconds for full initialization

**Option 3: Check WAL Checkpoint**
```javascript
const db = new Database('./data/kiosk.db');
db.pragma('wal_checkpoint(FULL)');
db.close();
```

### Verifying Data Persistence

Always verify data was actually saved:

```javascript
// After creating via API
const response = await fetch('http://localhost:3001/api/kiosk/menu');
const data = await response.json();
console.log('Massages in API:', data.featured.length + data.regular.length);

// Check database directly
const db = new Database('./data/kiosk.db');
const count = db.prepare('SELECT COUNT(*) FROM massages').get();
console.log('Massages in DB:', count);
db.close();
```

## Remember

**ALWAYS run Puppeteer tests after UI/UX changes!**

This ensures:
- Visual quality is maintained
- No regressions are introduced
- Accessibility standards are met
- Performance is acceptable
- User experience is optimal
- Data transformations are working correctly
- Database persistence is verified

---

**This is a mandatory step for all UI/UX related tasks.**
