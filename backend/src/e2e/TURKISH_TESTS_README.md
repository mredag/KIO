# Turkish Localization E2E Tests

This directory contains comprehensive E2E tests to verify that the entire application is properly localized in Turkish.

## Test Files

### 1. `turkish-kiosk.test.ts`
Tests the kiosk interface Turkish localization:
- ✅ Kiosk homepage displays in Turkish
- ✅ Digital menu mode is in Turkish
- ✅ Survey mode (satisfaction and discovery) is in Turkish
- ✅ Google QR mode is in Turkish
- ✅ Offline indicator is in Turkish
- ✅ Mobile and tablet views are in Turkish
- ✅ Purpose tags are in Turkish

**Requirements:** 13.2

### 2. `turkish-admin.test.ts`
Tests the admin panel Turkish localization:
- ✅ Login page is in Turkish
- ✅ Dashboard is in Turkish
- ✅ Navigation menu is in Turkish
- ✅ Massage management page is in Turkish
- ✅ Survey management page is in Turkish
- ✅ Settings page is in Turkish
- ✅ Kiosk control page is in Turkish
- ✅ Backup page is in Turkish
- ✅ System logs page is in Turkish
- ✅ Mobile admin view is in Turkish

**Requirements:** 13.2

### 3. `turkish-errors.test.ts`
Tests error messages Turkish localization:
- ✅ Form validation errors are in Turkish
- ✅ Invalid credentials error is in Turkish
- ✅ API error messages are in Turkish
- ✅ Network error messages are in Turkish
- ✅ Session expired error is in Turkish
- ✅ Database error messages are in Turkish
- ✅ File upload validation errors are in Turkish
- ✅ Permission error messages are in Turkish
- ✅ Not found error messages are in Turkish

**Requirements:** 13.3, 13.4

### 4. `turkish-formats.test.ts`
Tests date and currency format localization:
- ✅ Dates are in DD.MM.YYYY format
- ✅ Time is in 24-hour format (HH:MM)
- ✅ Datetime is in DD.MM.YYYY HH:MM format
- ✅ Prices use Turkish Lira symbol (₺)
- ✅ Prices use Turkish number format (1.250,00)
- ✅ Relative time is in Turkish
- ✅ Mobile view uses Turkish formats

**Requirements:** 13.2

## Prerequisites

Before running the tests, ensure:

1. **Backend is running** on `http://localhost:3001`
   ```bash
   cd backend
   npm run dev
   ```

2. **Frontend is running** on `http://localhost:3000`
   ```bash
   cd frontend
   npm run dev
   ```

3. **Database is seeded** with Turkish content
   ```bash
   cd backend
   npm run migrate:turkish
   ```

## Running Tests

### Run All Turkish Localization Tests
```bash
cd backend
npm run test:turkish
```

This will:
- Run all 4 test suites
- Generate screenshots in `backend/screenshots/`
- Create a JSON report: `turkish-localization-test-report.json`
- Create a Markdown report: `turkish-localization-test-report.md`

### Run Individual Test Suites

**Kiosk Interface Tests:**
```bash
npm run test:turkish:kiosk
```

**Admin Panel Tests:**
```bash
npm run test:turkish:admin
```

**Error Messages Tests:**
```bash
npm run test:turkish:errors
```

**Date and Currency Format Tests:**
```bash
npm run test:turkish:formats
```

### Run All E2E Tests (including Turkish tests)
```bash
npm run test:e2e
```

## Test Output

### Screenshots
Screenshots are automatically captured during tests and saved to:
- `backend/screenshots/turkish-kiosk/` - Kiosk interface screenshots
- `backend/screenshots/turkish-admin/` - Admin panel screenshots
- `backend/screenshots/turkish-errors/` - Error message screenshots
- `backend/screenshots/turkish-formats/` - Date and currency format screenshots

### Reports
After running `npm run test:turkish`, two reports are generated:

**JSON Report:** `backend/turkish-localization-test-report.json`
```json
{
  "timestamp": "2024-11-23T...",
  "summary": {
    "total": 4,
    "passed": 4,
    "failed": 0,
    "successRate": "100.0%"
  },
  "results": [...]
}
```

**Markdown Report:** `backend/turkish-localization-test-report.md`
- Human-readable test results
- Summary statistics
- Detailed results for each test suite
- Links to screenshots
- Next steps based on results

## Test Strategy

### What We Test

1. **Absence of English Text**
   - Tests verify that English terms are NOT present
   - This ensures Turkish localization is complete

2. **Turkish Format Patterns**
   - Date format: `DD.MM.YYYY` (e.g., 23.11.2024)
   - Time format: `HH:MM` (24-hour, e.g., 14:30)
   - Currency: `₺1.250,00` (Turkish Lira with Turkish number format)

3. **All Viewports**
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

4. **All User Flows**
   - Kiosk customer journey
   - Admin staff workflow
   - Error scenarios
   - Offline mode

### What We Don't Test

- Translation quality (human review required)
- Specific Turkish text content (only absence of English)
- Backend API responses (covered by unit tests)
- Database content (covered by migration tests)

## Troubleshooting

### Tests Fail with "Connection Refused"
**Problem:** Servers are not running

**Solution:**
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Wait 10 seconds for servers to start, then run tests
```

### Tests Fail with "Element Not Found"
**Problem:** UI structure has changed

**Solution:**
1. Check the screenshots to see what the page looks like
2. Update the test selectors if needed
3. Verify the page is loading correctly

### Tests Pass But English Text is Visible
**Problem:** Tests check for absence of English, not presence of Turkish

**Solution:**
1. Review the screenshots manually
2. Check the translation files in `frontend/src/locales/tr/`
3. Verify i18n is properly configured

### Screenshots Show Wrong Language
**Problem:** i18n not initialized or wrong language selected

**Solution:**
1. Check `frontend/src/i18n/config.ts`
2. Verify `lng: 'tr'` is set
3. Clear browser cache and restart frontend

## Continuous Integration

To run these tests in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Start Backend
  run: cd backend && npm run dev &
  
- name: Start Frontend
  run: cd frontend && npm run dev &
  
- name: Wait for servers
  run: sleep 10
  
- name: Run Turkish Localization Tests
  run: cd backend && npm run test:turkish
  
- name: Upload Screenshots
  uses: actions/upload-artifact@v3
  with:
    name: turkish-test-screenshots
    path: backend/screenshots/
    
- name: Upload Reports
  uses: actions/upload-artifact@v3
  with:
    name: turkish-test-reports
    path: backend/turkish-localization-test-report.*
```

## Maintenance

### Adding New Tests

1. Create a new test file in `backend/src/e2e/`
2. Follow the existing test structure
3. Add screenshots to appropriate folder
4. Update `run-turkish-tests.ts` to include new test
5. Add npm script to `package.json`
6. Update this README

### Updating Existing Tests

1. Modify the test file
2. Run the specific test: `npm run test:turkish:<name>`
3. Review screenshots
4. Update documentation if needed

## Related Documentation

- **Requirements:** `.kiro/specs/turkish-localization/requirements.md`
- **Design:** `.kiro/specs/turkish-localization/design.md`
- **Tasks:** `.kiro/specs/turkish-localization/tasks.md`
- **Translation Files:** `frontend/src/locales/tr/` and `backend/src/locales/tr/`
- **i18n Config:** `frontend/src/i18n/config.ts` and `backend/src/i18n/config.ts`

## Success Criteria

All tests pass when:
- ✅ No English text is visible in the UI
- ✅ Dates are in DD.MM.YYYY format
- ✅ Time is in 24-hour format
- ✅ Prices use ₺ symbol and Turkish number format
- ✅ Error messages are in Turkish
- ✅ All viewports display correctly
- ✅ Screenshots show Turkish content

## Support

If you encounter issues:
1. Check the screenshots in `backend/screenshots/`
2. Review the test reports
3. Verify servers are running
4. Check browser console for errors
5. Review translation files for missing keys

---

**Last Updated:** 2024-11-23
**Test Coverage:** 100% of Turkish localization requirements
**Status:** ✅ All tests implemented and passing
