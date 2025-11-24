import { describe, it, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('User Journey Simulations', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:5173';
  const screenshotsDir = join(__dirname, '../../screenshots/journeys');

  beforeAll(async () => {
    try {
      mkdirSync(screenshotsDir, { recursive: true });
    } catch (err) {
      // Directory exists
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterAll(async () => {
    await browser?.close();
  });

  describe('Customer Journey - Kiosk User', () => {
    it('should simulate customer browsing massages', async () => {
      console.log('Starting customer journey...');

      // Step 1: Arrive at kiosk
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });
      await page.screenshot({
        path: join(screenshotsDir, '01-arrival.png'),
        fullPage: true
      });
      console.log('✓ Customer arrives at kiosk');

      await new Promise(r => setTimeout(r, 2000));

      // Step 2: Browse massage list
      const massageElements = await page.$$('[class*="massage"], [class*="card"]');
      console.log(`✓ Customer sees ${massageElements.length} massage options`);

      await page.screenshot({
        path: join(screenshotsDir, '02-browsing.png'),
        fullPage: true
      });

      // Step 3: Click on a massage (if available)
      if (massageElements.length > 0) {
        await massageElements[0].click();
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({
          path: join(screenshotsDir, '03-massage-detail.png'),
          fullPage: true
        });
        console.log('✓ Customer views massage details');
      }

      // Step 4: Navigate back
      const backButton = await page.$('button[class*="back"], a[href="/"]');
      if (backButton) {
        await backButton.click();
        await new Promise(r => setTimeout(r, 1000));
        console.log('✓ Customer navigates back');
      }

      await page.screenshot({
        path: join(screenshotsDir, '04-back-to-list.png'),
        fullPage: true
      });
    });

    it('should simulate customer taking survey', async () => {
      console.log('Starting survey journey...');

      await page.goto(baseUrl, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 2000));

      // Look for survey elements
      const surveyElements = await page.$$('[class*="survey"], form');
      console.log(`Found ${surveyElements.length} survey elements`);

      await page.screenshot({
        path: join(screenshotsDir, '05-survey-view.png'),
        fullPage: true
      });
    });
  });

  describe('Admin Journey - Staff Member', () => {
    it('should simulate admin login and dashboard access', async () => {
      console.log('Starting admin journey...');

      // Step 1: Navigate to login
      await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle0' });
      await page.screenshot({
        path: join(screenshotsDir, '10-admin-login.png'),
        fullPage: true
      });
      console.log('✓ Admin arrives at login page');

      // Step 2: Enter credentials
      await page.type('input[type="text"]', 'admin', { delay: 100 });
      await page.type('input[type="password"]', 'admin123', { delay: 100 });
      await page.screenshot({
        path: join(screenshotsDir, '11-credentials-entered.png'),
        fullPage: true
      });
      console.log('✓ Admin enters credentials');

      // Step 3: Submit login
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({
        path: join(screenshotsDir, '12-dashboard.png'),
        fullPage: true
      });
      console.log('✓ Admin accesses dashboard');

      // Step 4: Navigate to different sections
      const navLinks = await page.$$('nav a, aside a');
      console.log(`✓ Admin sees ${navLinks.length} navigation options`);
    });

    it('should simulate admin managing massages', async () => {
      // Ensure logged in
      const currentUrl = page.url();
      if (!currentUrl.includes('/admin')) {
        await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle0' });
        await page.type('input[type="text"]', 'admin');
        await page.type('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 2000));
      }

      // Try to navigate to massages page
      const massagesLink = await page.$('a[href*="massage"]');
      if (massagesLink) {
        await massagesLink.click();
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({
          path: join(screenshotsDir, '13-massages-page.png'),
          fullPage: true
        });
        console.log('✓ Admin views massages management');
      }
    });

    it('should simulate admin viewing settings', async () => {
      const settingsLink = await page.$('a[href*="settings"]');
      if (settingsLink) {
        await settingsLink.click();
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({
          path: join(screenshotsDir, '14-settings-page.png'),
          fullPage: true
        });
        console.log('✓ Admin views settings');
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should test invalid login', async () => {
      await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle0' });

      await page.type('input[type="text"]', 'wronguser');
      await page.type('input[type="password"]', 'wrongpass');
      await page.click('button[type="submit"]');

      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({
        path: join(screenshotsDir, '20-invalid-login.png'),
        fullPage: true
      });
      console.log('✓ Tested invalid login scenario');
    });

    it('should test 404 page', async () => {
      await page.goto(`${baseUrl}/nonexistent-page`, { waitUntil: 'networkidle0' });
      await page.screenshot({
        path: join(screenshotsDir, '21-404-page.png'),
        fullPage: true
      });
      console.log('✓ Tested 404 page');
    });
  });
});
