---
inclusion: always
---

# Minimal Documentation Policy

## Critical Rule: Stop Over-Documenting

**DO NOT create extensive documentation files for every small change or feature.**

## What NOT to Create

❌ **Don't create these files:**
- Implementation reports (e.g., `FEATURE_IMPLEMENTATION.md`)
- Summary documents (e.g., `FEATURE_SUMMARY.md`)
- User guides for every feature (e.g., `FEATURE_KULLANIM_KILAVUZU.md`)
- Verification reports (e.g., `FEATURE_VERIFICATION.md`)
- Test reports (e.g., `FEATURE_TEST_REPORT.md`)

❌ **Don't create documentation unless:**
- User explicitly asks for it
- It's a major architectural change
- It's critical for deployment/production

## What TO Update

✅ **Only update these when necessary:**

### 1. README.md
- Update only if:
  - New major feature added
  - Installation steps changed
  - Project structure changed significantly

### 2. Development Files
- Update only if:
  - API endpoints changed (update API docs if they exist)
  - Database schema changed (update schema.sql)
  - Environment variables added (update .env.example)

### 3. Steering Files
- Update only if:
  - New common pattern discovered
  - New bug pattern needs documentation
  - Critical workflow change

## When User Asks for a Feature

### Standard Response Pattern

1. **Implement the feature** ✅
2. **Test it works** ✅
3. **Brief summary** (2-3 sentences) ✅
4. **That's it!** ✅

### Example Response

```
✅ Survey analytics implemented with:
- Analytics endpoint at /api/admin/survey-analytics/:id
- New page at /admin/surveys/:id/analytics
- Visual charts for ratings and choices
- Date filtering and survey switcher

All tests passing. Ready to use.
```

**No need for:**
- 500-line implementation document
- User guide in Turkish
- Test verification report
- Screenshots documentation

## Exception: When to Document

### Create documentation ONLY if:

1. **User explicitly requests it**
   - "Can you document this?"
   - "Write a guide for this"
   - "Create documentation"

2. **Major system change**
   - Complete architecture rewrite
   - Database migration
   - Deployment process change

3. **Critical production info**
   - Security vulnerabilities fixed
   - Breaking changes
   - Migration steps required

## Test Scripts

### Keep test scripts minimal

✅ **Good test script:**
```javascript
// test-feature.js
// Quick test for feature X
const puppeteer = require('puppeteer');
// ... minimal test code
```

❌ **Bad test script:**
```javascript
// test-feature-comprehensive-with-full-documentation.js
// This script tests feature X
// It was created on DATE
// Author: NAME
// Purpose: LONG EXPLANATION
// ... excessive comments
```

## Summary

**Golden Rule:** Code speaks for itself. Only document what's absolutely necessary.

**Remember:**
- Less documentation = easier maintenance
- Code is the source of truth
- User can ask if they need clarification
- Focus on working code, not documentation

---

**Status:** ✅ Active
**Priority:** High
**Applies to:** All future work
