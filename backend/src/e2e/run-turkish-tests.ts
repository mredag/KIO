/**
 * Turkish Localization E2E Test Runner
 * 
 * Runs all Turkish localization E2E tests and generates a report
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n========================================');
console.log('  Turkish Localization E2E Tests');
console.log('========================================\n');

console.log('⚠️  Prerequisites:');
console.log('   1. Backend must be running on http://localhost:3001');
console.log('   2. Frontend must be running on http://localhost:3000\n');
console.log('💡 If not running, open 2 terminals and run:');
console.log('   Terminal 1: cd backend && npm run dev');
console.log('   Terminal 2: cd frontend && npm run dev\n');

const tests = [
  {
    name: 'Kiosk Interface Turkish Tests',
    file: 'turkish-kiosk.test.ts',
    description: 'Tests kiosk homepage, digital menu, survey mode, Google QR mode, and offline indicator'
  },
  {
    name: 'Admin Panel Turkish Tests',
    file: 'turkish-admin.test.ts',
    description: 'Tests login page, dashboard, massage management, survey management, and settings'
  },
  {
    name: 'Error Messages Turkish Tests',
    file: 'turkish-errors.test.ts',
    description: 'Tests form validation errors, API errors, and network errors'
  },
  {
    name: 'Date and Currency Format Tests',
    file: 'turkish-formats.test.ts',
    description: 'Tests DD.MM.YYYY date format, 24-hour time format, and ₺ currency format'
  }
];

const results: any[] = [];

console.log('🚀 Starting Turkish localization E2E tests...\n');

for (const test of tests) {
  console.log(`\n📋 Running: ${test.name}`);
  console.log(`   ${test.description}\n`);

  try {
    const output = execSync(
      `npx vitest run src/e2e/${test.file}`,
      { 
        encoding: 'utf-8',
        cwd: join(__dirname, '../..')
      }
    );

    console.log(output);

    results.push({
      name: test.name,
      file: test.file,
      status: 'PASSED',
      description: test.description
    });

    console.log(`✅ ${test.name} - PASSED\n`);
  } catch (error: any) {
    console.error(`❌ ${test.name} - FAILED\n`);
    console.error(error.stdout || error.message);

    results.push({
      name: test.name,
      file: test.file,
      status: 'FAILED',
      description: test.description,
      error: error.stdout || error.message
    });
  }
}

// Generate report
console.log('\n========================================');
console.log('  Test Results Summary');
console.log('========================================\n');

const passed = results.filter(r => r.status === 'PASSED').length;
const failed = results.filter(r => r.status === 'FAILED').length;
const total = results.length;

console.log(`Total Tests: ${total}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ❌`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

results.forEach(result => {
  const icon = result.status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} ${result.name} - ${result.status}`);
});

// Save report to file
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    total,
    passed,
    failed,
    successRate: `${((passed / total) * 100).toFixed(1)}%`
  },
  results
};

const reportPath = join(__dirname, '../../turkish-localization-test-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n📄 Report saved to: ${reportPath}\n`);

// Generate markdown report
const markdownReport = `# Turkish Localization E2E Test Report

**Generated:** ${new Date().toLocaleString('tr-TR')}

## Summary

- **Total Tests:** ${total}
- **Passed:** ${passed} ✅
- **Failed:** ${failed} ❌
- **Success Rate:** ${((passed / total) * 100).toFixed(1)}%

## Test Results

${results.map(result => `
### ${result.status === 'PASSED' ? '✅' : '❌'} ${result.name}

**Status:** ${result.status}

**Description:** ${result.description}

**Test File:** \`${result.file}\`

${result.error ? `**Error:**\n\`\`\`\n${result.error}\n\`\`\`` : ''}
`).join('\n')}

## Screenshots

Screenshots are saved in:
- \`backend/screenshots/turkish-kiosk/\`
- \`backend/screenshots/turkish-admin/\`
- \`backend/screenshots/turkish-errors/\`
- \`backend/screenshots/turkish-formats/\`

## Next Steps

${failed > 0 ? `
⚠️ **${failed} test(s) failed!**

1. Review the error messages above
2. Check the screenshots in the screenshots folders
3. Fix the issues
4. Re-run the tests
` : `
✅ **All tests passed!**

The Turkish localization is working correctly across:
- Kiosk interface
- Admin panel
- Error messages
- Date and currency formats
`}
`;

const markdownReportPath = join(__dirname, '../../turkish-localization-test-report.md');
writeFileSync(markdownReportPath, markdownReport);

console.log(`📄 Markdown report saved to: ${markdownReportPath}\n`);

console.log('========================================');
console.log(failed === 0 ? '  🎉 All Tests Passed!' : '  ⚠️  Some Tests Failed');
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
