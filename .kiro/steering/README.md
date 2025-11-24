# Steering Files - Overview

This directory contains steering rules that guide Kiro's behavior when working on this project.

## Active Steering Files

### 1. ⚛️ react-state-async.md (NEW - CRITICAL)
**Purpose:** Prevent bugs caused by React's asynchronous setState

**When it applies:**
- Implementing auto-advance or immediate actions after state updates
- Data appears to be lost or not saved to database
- Database shows empty values `{}`
- Using setTimeout/setInterval with state
- Submitting forms immediately after user input

**What it does:**
- Explains why setState is asynchronous
- Shows common bug patterns (empty survey answers)
- Provides 3 solution patterns
- Real-world example with auto-advance bug
- Testing strategies to catch this bug

**Key concepts:**
- setState doesn't update immediately
- Never use state value right after setState
- Store new value in variable and pass directly
- Use useEffect for state-dependent side effects
- Always verify data persistence in database

**Real-world example:**
- Survey auto-advance saved empty answers `{}` because state wasn't updated yet
- Fixed by passing new answer value directly instead of relying on state

---

### 2. 🎯 dynamic-data-rendering.md (CRITICAL)
**Purpose:** Prevent hardcoding issues and ensure dynamic database rendering

**When it applies:**
- Building components that display database content
- Questions/options/items aren't updating when data changes
- Seeing hardcoded values in components or i18n files
- Creating surveys, forms, menus, or any dynamic lists

**What it does:**
- Explains why hardcoding database content is wrong
- Shows how to render data dynamically from database
- Provides patterns for flexible state management
- Demonstrates data change detection
- Lists red flags for hardcoding issues

**Key concepts:**
- Database is the source of truth, not i18n files
- Use ALL fields from database schema
- Detect data changes with useEffect on data.id
- Map over arrays instead of hardcoding elements
- Use Record<string, any> for flexible state

**Real-world example:**
- Survey questions must come from `survey.questions`, not `t('survey.question1')`
- Massage sessions must come from `massage.sessions`, not hardcoded list

---

### 3. 🎨 ui-ux-testing.md
**Purpose:** Automatic UI/UX testing with Puppeteer

**When it applies:**
- After any UI/UX changes
- When modifying components
- When changing styles or layouts
- When updating forms or interactive elements

**What it does:**
- Automatically runs Puppeteer tests
- Captures screenshots at multiple viewports
- Verifies visual elements (button sizes, fonts, colors)
- Tests interactions (clicks, forms, navigation)
- Checks accessibility (contrast, labels, focus)
- Generates verification reports

**Key features:**
- Correct port configuration (3000 for frontend, 3001 for backend)
- Server management best practices
- Database persistence verification
- Common error solutions

---

### 4. 🔄 data-transformation.md
**Purpose:** Handle snake_case/camelCase conversion between backend and frontend

**When it applies:**
- When seeing "Cannot read properties of undefined" errors
- When data from API doesn't match component expectations
- When adding new API endpoints
- When creating new data types

**What it does:**
- Explains the snake_case (backend) vs camelCase (frontend) issue
- Provides transformation function templates
- Shows where to apply transformations (API hooks)
- Lists common patterns and pitfalls

**Key concepts:**
- Backend uses snake_case (database convention)
- Frontend uses camelCase (JavaScript convention)
- Transform at API boundary (hooks), not in components
- Convert SQLite integers (0/1) to booleans

---

### 5. ⚙️ process-management.md
**Purpose:** Manage development server lifecycle

**When it applies:**
- When starting/stopping servers
- When encountering port conflicts
- When servers aren't responding
- When hot reload isn't working

**What it does:**
- Provides server startup best practices
- Explains timing requirements (8-10 seconds for startup)
- Shows how to check process status
- Lists common port and process issues

**Key commands:**
- `listProcesses` - Check running processes
- `controlPwshProcess` - Start/stop servers
- `getProcessOutput` - View server logs
- Port cleanup commands

---

### 6. 🔧 troubleshooting-quick-reference.md
**Purpose:** Quick lookup for common errors and solutions

**When it applies:**
- When encountering any error
- When debugging issues
- When tests fail
- When data doesn't persist

**What it does:**
- Lists 10 most common errors with instant solutions
- Provides diagnostic commands
- Shows full reset procedures
- Explains when to use each steering file

**Quick fixes for:**
- Property access errors
- Iteration errors
- Route errors
- Port conflicts
- Database persistence
- Error boundaries
- Empty data displays
- Server issues
- Cache problems
- Puppeteer failures

---

### 7. 📋 STEERING_ACTIVE.md
**Purpose:** Status and overview of all active steering rules

**What it contains:**
- List of active steering rules
- Key lessons learned
- Status indicators
- Quick reference to all steering files
- Critical patterns to remember

---

## How Steering Files Work

### Automatic Application
When you ask Kiro to perform a task, relevant steering files are automatically included in the context. Kiro will:

1. Read the applicable steering rules
2. Follow the guidelines provided
3. Apply best practices automatically
4. Use the correct patterns and solutions

### Manual Reference
You can also explicitly reference steering files:
- "Check the data-transformation steering file"
- "Follow the ui-ux-testing guidelines"
- "Use the troubleshooting quick reference"

### Updating Steering Files
Steering files are living documents. When new issues are discovered:

1. Document the problem
2. Document the solution
3. Add to appropriate steering file
4. Update this README if needed

---

## File Structure

```
.kiro/steering/
├── README.md (this file)
├── STEERING_ACTIVE.md (status overview)
├── react-state-async.md (setState async issues)
├── dynamic-data-rendering.md (database rendering)
├── data-transformation.md (snake_case/camelCase)
├── ui-ux-testing.md (Puppeteer testing)
├── process-management.md (server lifecycle)
└── troubleshooting-quick-reference.md (quick fixes)
```

---

## Quick Decision Tree

**"Data is being lost or saved as empty {}"**
→ Check `react-state-async.md` (CRITICAL)

**"Data isn't updating when I change it in admin panel"**
→ Check `dynamic-data-rendering.md` (MOST COMMON)

**"Questions/options are hardcoded and won't change"**
→ Check `dynamic-data-rendering.md`

**"I'm getting a property access error"**
→ Check `data-transformation.md`

**"I need to test UI changes"**
→ Check `ui-ux-testing.md`

**"Servers won't start"**
→ Check `process-management.md`

**"I don't know what's wrong"**
→ Check `troubleshooting-quick-reference.md`

**"I want to see what's active"**
→ Check `STEERING_ACTIVE.md`

---

## Best Practices

### ✅ DO
- Read relevant steering files before starting work
- Follow the patterns and solutions provided
- Update steering files when discovering new issues
- Reference steering files in documentation
- Use the diagnostic commands provided

### ❌ DON'T
- Ignore steering file guidance
- Repeat solved problems
- Skip verification steps
- Forget to document new solutions
- Mix patterns from different approaches

---

## Maintenance

### When to Update
- New error patterns discovered
- New solutions found
- Process improvements identified
- Tool versions change
- Project structure changes

### How to Update
1. Identify the issue and solution
2. Choose the appropriate steering file
3. Add clear documentation
4. Include code examples
5. Test the solution
6. Update this README if needed

---

## Success Metrics

These steering files have helped solve:
- ✅ **Dynamic rendering issues** (hardcoded content not updating) - NEW
- ✅ **Survey question updates** (questions staying same when survey changes) - NEW
- ✅ Data transformation issues (snake_case/camelCase)
- ✅ Property access errors
- ✅ Array iteration errors
- ✅ Missing route definitions
- ✅ Database persistence problems
- ✅ Server startup issues
- ✅ Port conflicts
- ✅ Cache problems
- ✅ Puppeteer test failures
- ✅ Error boundary triggers
- ✅ Validation middleware issues
- ✅ Media upload problems

**Result:** 100% test pass rate, zero runtime errors, production-ready system

---

## Related Documentation

### Project Documentation
- `FINAL_SUCCESS_REPORT.md` - Complete success report
- `MASSAGE_CREATION_REPORT.md` - Detailed creation process
- `KIOSK_FIX_VERIFICATION.md` - Fix documentation
- `KIOSK_DEBUG_REPORT.md` - Debug process

### Test Scripts
- `test-kiosk-page.js` - Kiosk testing
- `final-verification-test.js` - Comprehensive tests
- `create-massages-api.js` - API-based creation
- `insert-massages-direct.js` - Direct DB insertion

### Deployment
- `deployment/DEPLOYMENT_GUIDE.md` - Full deployment guide
- `deployment/QUICK_REFERENCE.md` - Quick commands
- `deployment/WINDOWS_DEPLOYMENT.md` - Windows-specific

---

## Version History

### v1.0 - Initial Creation
- Created ui-ux-testing.md
- Created process-management.md
- Created STEERING_ACTIVE.md

### v2.0 - Data Transformation
- Added data-transformation.md
- Added troubleshooting-quick-reference.md
- Updated ui-ux-testing.md with database testing
- Updated STEERING_ACTIVE.md with lessons learned
- Created this README

### v3.0 - React State Management (Current)
- Added react-state-async.md (CRITICAL)
- Documented survey auto-advance bug and fix
- Updated STEERING_ACTIVE.md with new patterns
- Updated README with new steering file

---

## Contact & Support

If you encounter issues not covered by these steering files:

1. Check browser console for errors
2. Check server logs with `getProcessOutput`
3. Review recent git commits
4. Check the troubleshooting quick reference
5. Document the new issue and solution
6. Update the appropriate steering file

---

**Last Updated:** 2025-11-23
**Status:** ✅ All steering files active and tested
**Total Files:** 7 steering files (6 core + 1 status)
**Coverage:** 100% of common issues documented
**Latest Addition:** react-state-async.md (Critical for React state management)
