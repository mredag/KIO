// @ts-nocheck
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('UI Analysis and Testing', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:5173';
  const screenshotsDir = join(__dirname, '../../screenshots');

  beforeAll(async () => {
    // Create screenshots directory
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

  describe('Kiosk Mode UI Tests', () => {
    it('should load kiosk homepage', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });
      await page.screenshot({
        path: join(screenshotsDir, 'kiosk-home.png'),
        fullPage: true
      });

      const title = await page.title();
      expect(title).toBeTruthy();
    });

    it('should test digital menu mode', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      // Wait for content to load
      await new Promise(r => setTimeout(r, 5000));

      // Take screenshot
      await page.screenshot({
        path: join(screenshotsDir, 'digital-menu.png'),
        fullPage: true
      });

      // Check for massage items
      const massageItems = await page.$$('[class*="massage"]');
      console.log(`Found ${massageItems.length} massage items`);
    });

    it('should test slideshow mode navigation', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      // Wait for page load
      await new Promise(r => setTimeout(r, 2000));

      await page.screenshot({
        path: join(screenshotsDir, 'slideshow-mode.png'),
        fullPage: true
      });
    });

    it('should test survey mode', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      await new Promise(r => setTimeout(r, 2000));

      await page.screenshot({
        path: join(screenshotsDir, 'survey-mode.png'),
        fullPage: true
      });
    });

    it('should test Google QR mode', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      await new Promise(r => setTimeout(r, 2000));

      await page.screenshot({
        path: join(screenshotsDir, 'qr-mode.png'),
        fullPage: true
      });
    });
  });

  describe('Admin Panel UI Tests', () => {
    it('should load admin login page', async () => {
      await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle0' });

      await page.screenshot({
        path: join(screenshotsDir, 'admin-login.png'),
        fullPage: true
      });

      // Check for login form
      const usernameInput = await page.$('input[type="text"]');
      const passwordInput = await page.$('input[type="password"]');

      expect(usernameInput).toBeTruthy();
      expect(passwordInput).toBeTruthy();
    });

    it('should test admin login flow', async () => {
      await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle0' });

      // Fill login form
      await page.type('input[type="text"]', 'admin');
      await page.type('input[type="password"]', 'admin123');

      await page.screenshot({
        path: join(screenshotsDir, 'admin-login-filled.png'),
        fullPage: true
      });

      // Click login button
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 2000));

      await page.screenshot({
        path: join(screenshotsDir, 'admin-dashboard.png'),
        fullPage: true
      });
    });

    it('should test admin dashboard navigation', async () => {
      // Assuming logged in from previous test
      const currentUrl = page.url();

      if (!currentUrl.includes('/admin/dashboard')) {
        // Login first
        await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle0' });
        await page.type('input[type="text"]', 'admin');
        await page.type('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 2000));
      }

      // Test navigation items
      const navItems = await page.$$('nav a, aside a');
      console.log(`Found ${navItems.length} navigation items`);

      await page.screenshot({
        path: join(screenshotsDir, 'admin-nav.png'),
        fullPage: true
      });
    });
  });

  describe('Responsive Design Tests', () => {
    it('should test mobile viewport (375x667)', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      await page.screenshot({
        path: join(screenshotsDir, 'mobile-375.png'),
        fullPage: true
      });
    });

    it('should test tablet viewport (768x1024)', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      await page.screenshot({
        path: join(screenshotsDir, 'tablet-768.png'),
        fullPage: true
      });
    });

    it('should test desktop viewport (1920x1080)', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      await page.screenshot({
        path: join(screenshotsDir, 'desktop-1920.png'),
        fullPage: true
      });
    });
  });

  describe('UI Performance Analysis', () => {
    it('should measure page load performance', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      const metrics = await page.metrics();
      const performance = await page.evaluate(() => {
        const perfData = window.performance.timing;
        return {
          loadTime: perfData.loadEventEnd - perfData.navigationStart,
          domReady: perfData.domContentLoadedEventEnd - perfData.navigationStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
        };
      });

      console.log('Performance Metrics:', {
        ...metrics,
        ...performance
      });

      expect(performance.loadTime).toBeLessThan(5000); // Should load in under 5s
    });

    it('should analyze CSS and layout', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      const cssStats = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        const totalRules = sheets.reduce((acc, sheet) => {
          try {
            return acc + (sheet.cssRules?.length || 0);
          } catch {
            return acc;
          }
        }, 0);

        return {
          stylesheets: sheets.length,
          totalRules
        };
      });

      console.log('CSS Stats:', cssStats);
    });

    it('should check for accessibility issues', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      const a11yIssues = await page.evaluate(() => {
        const issues: string[] = [];

        // Check for images without alt text
        const images = document.querySelectorAll('img');
        images.forEach((img, i) => {
          if (!img.alt) {
            issues.push(`Image ${i} missing alt text`);
          }
        });

        // Check for buttons without labels
        const buttons = document.querySelectorAll('button');
        buttons.forEach((btn, i) => {
          if (!btn.textContent?.trim() && !btn.getAttribute('aria-label')) {
            issues.push(`Button ${i} missing label`);
          }
        });

        // Check for proper heading hierarchy
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const levels = headings.map(h => parseInt(h.tagName[1]));

        return {
          issues,
          headingCount: headings.length,
          headingLevels: levels
        };
      });

      console.log('Accessibility Analysis:', a11yIssues);
    });
  });

  describe('Interactive Element Tests', () => {
    it('should test button interactions', async () => {
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      const buttons = await page.$$('button');
      console.log(`Found ${buttons.length} buttons`);

      // Test hover states
      if (buttons.length > 0) {
        await buttons[0].hover();
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({
          path: join(screenshotsDir, 'button-hover.png')
        });
      }
    });

    it('should test form inputs', async () => {
      await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle0' });

      const inputs = await page.$$('input');
      console.log(`Found ${inputs.length} input fields`);

      // Test focus states
      if (inputs.length > 0) {
        await inputs[0].focus();
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({
          path: join(screenshotsDir, 'input-focus.png')
        });
      }
    });
  });
});
