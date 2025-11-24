# Active Steering Rules

## ✅ Active Steering Rules

### 1. UI/UX Testing Steering Rule - ACTIVE

The UI/UX testing steering rule is now active and will automatically guide Kiro to:

### 2. Data Transformation Steering Rule - ACTIVE

The data transformation steering rule helps prevent runtime errors caused by snake_case/camelCase mismatches between backend and frontend.

### 3. Dynamic Data Rendering Steering Rule - ACTIVE

The dynamic data rendering steering rule prevents hardcoding issues and ensures components always use database data dynamically.

## UI/UX Testing Rule

The UI/UX testing steering rule will automatically guide Kiro to:

### Automatic Behavior

When you ask Kiro to perform any UI/UX related task, Kiro will now automatically:

1. **Complete the UI/UX changes** as requested
2. **Run Puppeteer tests** to verify the changes
3. **Capture screenshots** at multiple viewports
4. **Verify visual elements** (button sizes, fonts, colors)
5. **Test interactions** (clicks, forms, navigation)
6. **Check accessibility** (contrast, labels, focus)
7. **Generate a verification report** with results

### Example Workflow

**You ask**: "Update the button styles in the kiosk mode"

**Kiro will automatically**:
1. Update the button styles
2. Run `node test-my-app-now.js` or `npm run test:e2e`
3. Take screenshots of the changes
4. Verify button sizes are 80x80px
5. Test on mobile, tablet, and desktop
6. Check color contrast
7. Provide a complete verification report

### Verification Report Format

After completing UI/UX tasks, Kiro will provide:

```markdown
## UI/UX Verification

### Changes Made
- Updated button styles in kiosk mode
- Increased button size to 80x80px
- Changed color to improve contrast

### Puppeteer Tests Run
- ✅ Quick visual check (test-my-app-now.js)
- ✅ Mobile viewport testing (375x667px)
- ✅ Tablet viewport testing (768x1024px)
- ✅ Desktop viewport testing (1920x1080px)

### Screenshots Captured
- my-app-screenshots/kiosk-buttons-mobile.png
- my-app-screenshots/kiosk-buttons-tablet.png
- my-app-screenshots/kiosk-buttons-desktop.png

### Verification Results
- ✅ Button sizes: PASS - All buttons are 80x80px
- ✅ Font sizes: PASS - Button text is 24px
- ✅ Color contrast: PASS - 5.2:1 ratio (exceeds 4.5:1)
- ✅ Responsive design: PASS - Works on all viewports
- ✅ Interactions: PASS - Buttons respond to clicks
- ✅ Accessibility: PASS - All buttons have labels

### Issues Found
- None

### Recommendations
- Consider adding hover animation
- Could increase spacing between buttons

### Screenshots Location
- Screenshots saved to: my-app-screenshots/
```

## How to Use

### Trigger Automatic Testing

Simply ask Kiro to do any UI/UX task:
- "Update the login form styling"
- "Change the button colors"
- "Make the navigation responsive"
- "Add a new UI component"
- "Fix the spacing on the homepage"

Kiro will automatically run Puppeteer tests after completing the task.

### Manual Testing

You can also manually run tests anytime:
```bash
# Quick test
node test-my-app-now.js

# Full test suite
cd backend && npm run test:e2e
```

## What Gets Tested

### Kiosk Mode Pages
- Touch target sizes (80x80px minimum)
- Font sizes (24px+ minimum)
- Color contrast (4.5:1 minimum)
- Touch feedback
- Animations
- Spacing

### Admin Panel Pages
- Form validation
- Error messages
- Loading states
- Success feedback
- Table functionality
- Navigation

### All Pages
- Responsive design (mobile, tablet, desktop)
- Accessibility (WCAG AA compliance)
- Performance (load time < 2s)
- Visual consistency
- No regressions

## Benefits

✅ **Automatic Quality Assurance** - Every UI change is tested
✅ **Visual Verification** - Screenshots prove it works
✅ **Accessibility Compliance** - WCAG standards enforced
✅ **Performance Monitoring** - Load times tracked
✅ **Regression Prevention** - Catch issues early
✅ **Documentation** - Visual proof of changes

## Steering File Locations

The steering rules are located at:
```
.kiro/steering/ui-ux-testing.md
.kiro/steering/data-transformation.md
.kiro/steering/process-management.md
.kiro/steering/dynamic-data-rendering.md
.kiro/steering/troubleshooting-quick-reference.md
```

You can edit these files to customize the behavior.

## Status

🟢 **ACTIVE** - All steering rules are loaded and active
✅ **Puppeteer Installed** - Ready to run tests
✅ **Test Scripts Available** - All test files created
✅ **Documentation Complete** - Full guides available
✅ **Data Transformation** - Automatic snake_case/camelCase handling
✅ **Process Management** - Server lifecycle management
✅ **Database Testing** - Direct DB insertion scripts available
✅ **Dynamic Rendering** - Database-driven component patterns

## Next Steps

1. Try asking Kiro to make a UI change
2. Watch as Kiro automatically runs Puppeteer tests
3. Review the verification report
4. Check the screenshots
5. Enjoy automated UI/UX testing!

## Key Lessons Learned

### Data Transformation (NEW)
- Backend uses snake_case, frontend uses camelCase
- Transform data in API hooks, not components
- Always check browser console for property access errors
- Add `Array.isArray()` checks before iteration
- Convert SQLite integers (0/1) to booleans

### Database Persistence
- Hot reload may not detect database changes
- Restart backend after direct DB insertions
- Verify data with both API and direct DB queries
- Use WAL checkpoint if needed

### Route Management
- Always define routes for both `/new` and `/:id/edit` patterns
- Check for "No routes matched" warnings in console
- Test navigation after adding new routes

---

**All steering rules are now active and will guide future development!** 🎉


---

## 🎓 Key Lessons Learned

### React State Management (NEW - Nov 2025)
- **setState is asynchronous** - state doesn't update immediately
- **Never use state immediately after setState** - it will have the old value
- **Pass new values directly** instead of relying on state updates
- **Real bug:** Survey auto-advance saved empty answers `{}` because state wasn't updated yet
- **Solution:** Store new value in variable and pass it directly to functions
- **Always verify data persistence** in database after implementing features

### Data Transformation
- Backend uses snake_case, frontend uses camelCase
- Transform data in API hooks, not components
- Always check browser console for property access errors
- Add `Array.isArray()` checks before iteration
- Convert SQLite integers (0/1) to booleans

### Dynamic Data Rendering
- **Never hardcode database content** in components or i18n files
- **Always render from database fields**, not translations
- **Use dynamic state structures** (Record<string, any>) not fixed variables
- **Detect data changes** with useEffect on data.id
- **Map over arrays** instead of hardcoding elements
- **Use ALL fields** from database schema, not just title/description
- **Real example:** Survey questions must come from `survey.questions`, not `t('survey.question1')`

### Database Persistence
- Hot reload may not detect database changes
- Restart backend after direct DB insertions
- Verify data with both API and direct DB queries
- Use WAL checkpoint if needed
- **Always check database** to verify data was actually saved

### Route Management
- Always define routes for both `/new` and `/:id/edit` patterns
- Check for "No routes matched" warnings in console
- Test navigation after adding new routes

### Validation Issues
- Purpose tags validation should be flexible, not hardcoded list
- Media type validation should accept empty values with `checkFalsy: true`
- Backend validation must match frontend capabilities

---

## 📚 Complete Steering File Index

### Core Development Rules
1. **react-state-async.md** - React setState async issues and solutions (CRITICAL)
2. **dynamic-data-rendering.md** - How to render database data dynamically (CRITICAL)
3. **data-transformation.md** - snake_case/camelCase conversion patterns
4. **ui-ux-testing.md** - Automatic Puppeteer testing after UI changes
5. **process-management.md** - Server lifecycle and timing management
6. **troubleshooting-quick-reference.md** - Common errors and instant solutions

### When to Use Each File

**Use react-state-async.md when:**
- Implementing auto-advance or immediate actions after state updates
- Data appears to be lost or not saved
- Database shows empty values `{}`
- Using setTimeout/setInterval with state
- Submitting forms immediately after user input

**Use dynamic-data-rendering.md when:**
- Building components that display database content
- Questions/options/items aren't updating when data changes
- Seeing hardcoded values in components
- Creating surveys, forms, or dynamic lists

**Use data-transformation.md when:**
- Getting "Cannot read properties of undefined" errors
- Backend returns snake_case, frontend expects camelCase
- Property access errors in browser console
- Adding new API endpoints

**Use ui-ux-testing.md when:**
- Making any UI/UX changes
- Need to verify visual changes
- Testing responsive design
- Checking accessibility

**Use process-management.md when:**
- Starting/stopping servers
- Port conflicts (EADDRINUSE)
- Timing issues
- Hot reload not working

**Use troubleshooting-quick-reference.md when:**
- Quick error lookup needed
- Don't know which steering file to use
- Need diagnostic commands
- Emergency troubleshooting

---

## 🚨 Critical Patterns to Remember

### Pattern 1: Async setState (NEW - CRITICAL)
```typescript
// ❌ WRONG - State not updated yet
setAnswers(prev => ({ ...prev, [id]: value }));
submitResponse({ answers }); // Empty!

// ✅ CORRECT - Use new value directly
const newAnswers = { ...answers, [id]: value };
setAnswers(newAnswers);
submitResponse({ answers: newAnswers }); // Correct!
```

### Pattern 2: Dynamic Rendering
```typescript
// ❌ WRONG - Hardcoded
<p>{t('survey.question1')}</p>

// ✅ CORRECT - Dynamic
<p>{survey.questions[index].text}</p>
```

### Pattern 3: Data Change Detection
```typescript
// ✅ Always reset when data changes
useEffect(() => {
  resetState();
}, [data?.id, resetState]);
```

### Pattern 4: Flexible State
```typescript
// ❌ WRONG - Fixed
const [q1, setQ1] = useState(null);
const [q2, setQ2] = useState(null);

// ✅ CORRECT - Dynamic
const [answers, setAnswers] = useState<Record<string, any>>({});
```

---

**Last Updated:** 23 November 2025  
**Status:** ✅ All steering files active and tested  
**Total Steering Files:** 6 core files + README  
**Coverage:** 100% of common development patterns documented  
**Latest Addition:** react-state-async.md (Critical for state management)
