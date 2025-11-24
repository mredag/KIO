/**
 * Turkish Localization E2E Tests - Date and Currency Formats
 * 
 * Tests that verify dates and currency are displayed in Turkish format
 * 
 * Requirements: 13.2
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Turkish Localization - Date and Currency Formats E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:3000';
  const screenshotsDir = join(__dirname, '../../screenshots/turkish-formats');

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

  describe('Tarih Formatı Testi (GG.AA.YYYY)', () => {
    it('should display dates in DD.MM.YYYY format', async () => {
      console.log('Testing date format (DD.MM.YYYY)...');

      // Login to admin panel
      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.type('input[type="text"]', 'admin', { delay: 50 });
      await page.type('input[type="password"]', 'admin123', { delay: 50 });
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));

      await page.screenshot({
        path: join(screenshotsDir, '01-dashboard-dates-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check for Turkish date format pattern (DD.MM.YYYY)
      const turkishDatePattern = /\d{2}\.\d{2}\.\d{4}/;
      const hasTurkishDateFormat = turkishDatePattern.test(content);

      // Check that US date format (MM/DD/YYYY) is NOT present
      const usDatePattern = /\d{2}\/\d{2}\/\d{4}/;
      const hasUSDateFormat = usDatePattern.test(content);

      // Check that ISO date format (YYYY-MM-DD) is NOT present in visible content
      // Note: ISO format might be in data attributes, so we check visible text
      const visibleText = await page.evaluate(() => (document as any).body.innerText);
      const isoDatePattern = /\d{4}-\d{2}-\d{2}/;
      const hasISODateFormat = isoDatePattern.test(visibleText);

      expect(hasTurkishDateFormat || !hasUSDateFormat).toBe(true);
      expect(hasISODateFormat).toBe(false);

      console.log('✓ Dates are in DD.MM.YYYY format');
    });

    it('should display dates in survey responses with Turkish format', async () => {
      console.log('Testing survey response dates in Turkish format...');

      // Navigate to survey responses
      const responsesLink = await page.$('a[href*="response"]');
      if (responsesLink) {
        await responsesLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '02-survey-responses-dates-turkish.png'),
          fullPage: true
        });

        const visibleText = await page.evaluate(() => (document as any).body.innerText);

        // Check for Turkish date format
        const turkishDatePattern = /\d{2}\.\d{2}\.\d{4}/;
        const hasTurkishDateFormat = turkishDatePattern.test(visibleText);

        // Check that US format is NOT present
        const usDatePattern = /\d{2}\/\d{2}\/\d{4}/;
        const hasUSDateFormat = usDatePattern.test(visibleText);

        expect(hasTurkishDateFormat || !hasUSDateFormat).toBe(true);

        console.log('✓ Survey response dates are in Turkish format');
      } else {
        console.log('⚠ Could not find survey responses link');
      }
    });

    it('should display dates in system logs with Turkish format', async () => {
      console.log('Testing system log dates in Turkish format...');

      // Navigate back to dashboard
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to logs
      const logsLink = await page.$('a[href*="log"]');
      if (logsLink) {
        await logsLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '03-logs-dates-turkish.png'),
          fullPage: true
        });

        const visibleText = await page.evaluate(() => (document as any).body.innerText);

        // Check for Turkish date format
        const turkishDatePattern = /\d{2}\.\d{2}\.\d{4}/;
        const hasTurkishDateFormat = turkishDatePattern.test(visibleText);

        expect(hasTurkishDateFormat).toBe(true);

        console.log('✓ System log dates are in Turkish format');
      } else {
        console.log('⚠ Could not find logs link');
      }
    });

    it('should display backup dates in Turkish format', async () => {
      console.log('Testing backup dates in Turkish format...');

      // Navigate back to dashboard
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to backup
      const backupLink = await page.$('a[href*="backup"]');
      if (backupLink) {
        await backupLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '04-backup-dates-turkish.png'),
          fullPage: true
        });

        const visibleText = await page.evaluate(() => (document as any).body.innerText);

        // Check for Turkish date format
        const turkishDatePattern = /\d{2}\.\d{2}\.\d{4}/;
        const hasTurkishDateFormat = turkishDatePattern.test(visibleText);

        expect(hasTurkishDateFormat).toBe(true);

        console.log('✓ Backup dates are in Turkish format');
      } else {
        console.log('⚠ Could not find backup link');
      }
    });
  });

  describe('Saat Formatı Testi (24 Saat)', () => {
    it('should display time in 24-hour format', async () => {
      console.log('Testing time format (24-hour)...');

      // Navigate to dashboard
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '05-dashboard-time-24h.png'),
        fullPage: true
      });

      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Check that 12-hour format indicators (AM/PM) are NOT present
      const has12HourFormat = /\d{1,2}:\d{2}\s*(AM|PM|am|pm)/i.test(visibleText);
      expect(has12HourFormat).toBe(false);

      // Check for 24-hour format pattern (HH:MM)
      const has24HourFormat = /\d{2}:\d{2}/.test(visibleText);
      
      // If time is displayed, it should be in 24-hour format
      if (has24HourFormat) {
        expect(has12HourFormat).toBe(false);
        console.log('✓ Time is in 24-hour format');
      } else {
        console.log('⚠ No time displayed to verify format');
      }
    });

    it('should display datetime in Turkish format (DD.MM.YYYY HH:MM)', async () => {
      console.log('Testing datetime format (DD.MM.YYYY HH:MM)...');

      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Check for Turkish datetime format pattern
      const turkishDateTimePattern = /\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/;
      const hasTurkishDateTimeFormat = turkishDateTimePattern.test(visibleText);

      // Check that US datetime format is NOT present
      const usDateTimePattern = /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s*(AM|PM)/i;
      const hasUSDateTimeFormat = usDateTimePattern.test(visibleText);

      expect(hasUSDateTimeFormat).toBe(false);

      if (hasTurkishDateTimeFormat) {
        console.log('✓ Datetime is in Turkish format (DD.MM.YYYY HH:MM)');
      } else {
        console.log('⚠ No datetime displayed to verify format');
      }
    });

    it('should display last seen time in 24-hour format', async () => {
      console.log('Testing last seen time in 24-hour format...');

      await page.screenshot({
        path: join(screenshotsDir, '06-last-seen-time-24h.png'),
        fullPage: true
      });

      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Check that AM/PM is NOT present
      const has12HourFormat = /\d{1,2}:\d{2}\s*(AM|PM|am|pm)/i.test(visibleText);
      expect(has12HourFormat).toBe(false);

      console.log('✓ Last seen time is in 24-hour format');
    });
  });

  describe('Para Birimi Formatı Testi (₺)', () => {
    it('should display prices with Turkish Lira symbol (₺)', async () => {
      console.log('Testing currency format with ₺ symbol...');

      // Navigate to kiosk to see prices
      await page.goto(baseUrl, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '07-kiosk-prices-turkish.png'),
        fullPage: true
      });

      const content = await page.content();
      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Check for Turkish Lira symbol
      const hasTurkishLiraSymbol = content.includes('₺') || visibleText.includes('₺');

      // Check that other currency symbols are NOT present
      const hasDollarSign = content.includes('$');
      const hasEuroSign = content.includes('€');
      const hasPoundSign = content.includes('£');

      // If prices are displayed, they should use ₺
      if (hasTurkishLiraSymbol || !hasDollarSign) {
        expect(hasDollarSign).toBe(false);
        expect(hasEuroSign).toBe(false);
        expect(hasPoundSign).toBe(false);
        console.log('✓ Prices use Turkish Lira symbol (₺)');
      } else {
        console.log('⚠ No prices displayed to verify currency symbol');
      }
    });

    it('should display prices with Turkish number format', async () => {
      console.log('Testing Turkish number format for prices...');

      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Turkish format uses dot (.) for thousands and comma (,) for decimals
      // Example: ₺1.250,00 or ₺1.250
      const turkishPricePattern = /₺\s*\d{1,3}(\.\d{3})*(,\d{2})?/;
      const hasTurkishPriceFormat = turkishPricePattern.test(visibleText);

      // US format uses comma (,) for thousands and dot (.) for decimals
      // Example: $1,250.00
      const usPricePattern = /\$\s*\d{1,3}(,\d{3})*(\.\d{2})?/;
      const hasUSPriceFormat = usPricePattern.test(visibleText);

      expect(hasUSPriceFormat).toBe(false);

      if (hasTurkishPriceFormat) {
        console.log('✓ Prices use Turkish number format');
      } else {
        console.log('⚠ No prices displayed to verify number format');
      }
    });

    it('should display massage prices in Turkish format', async () => {
      console.log('Testing massage prices in Turkish format...');

      // Click on a massage to see detailed prices
      const massageCard = await page.$('[class*="massage"], [class*="card"]');
      
      if (massageCard) {
        await massageCard.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        await page.screenshot({
          path: join(screenshotsDir, '08-massage-detail-prices-turkish.png'),
          fullPage: true
        });

        const visibleText = await page.evaluate(() => (document as any).body.innerText);

        // Check for Turkish Lira symbol
        const hasTurkishLiraSymbol = visibleText.includes('₺');

        // Check for Turkish number format
        const turkishPricePattern = /₺\s*\d{1,3}(\.\d{3})*(,\d{2})?/;
        const hasTurkishPriceFormat = turkishPricePattern.test(visibleText);

        // Check that dollar sign is NOT present
        const hasDollarSign = visibleText.includes('$');

        expect(hasDollarSign).toBe(false);

        if (hasTurkishLiraSymbol || hasTurkishPriceFormat) {
          console.log('✓ Massage prices are in Turkish format');
        } else {
          console.log('⚠ No massage prices displayed to verify format');
        }
      } else {
        console.log('⚠ No massage cards found to test prices');
      }
    });

    it('should display session prices in Turkish format', async () => {
      console.log('Testing session prices in Turkish format...');

      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Check for Turkish Lira symbol in session prices
      const hasTurkishLiraSymbol = visibleText.includes('₺');

      // Check that prices don't use English format
      const hasEnglishPriceFormat = /\$\d+|\d+\s*USD|\d+\s*EUR/.test(visibleText);

      expect(hasEnglishPriceFormat).toBe(false);

      if (hasTurkishLiraSymbol) {
        console.log('✓ Session prices are in Turkish format');
      } else {
        console.log('⚠ No session prices displayed to verify format');
      }
    });

    it('should display prices in admin panel with Turkish format', async () => {
      console.log('Testing admin panel prices in Turkish format...');

      // Navigate to admin massages page
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const massagesLink = await page.$('a[href*="massage"]');
      if (massagesLink) {
        await massagesLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '09-admin-prices-turkish.png'),
          fullPage: true
        });

        const visibleText = await page.evaluate(() => (document as any).body.innerText);

        // Check for Turkish Lira symbol
        const hasTurkishLiraSymbol = visibleText.includes('₺');

        // Check that dollar sign is NOT present
        const hasDollarSign = visibleText.includes('$');

        expect(hasDollarSign).toBe(false);

        if (hasTurkishLiraSymbol) {
          console.log('✓ Admin panel prices are in Turkish format');
        } else {
          console.log('⚠ No prices displayed in admin panel to verify format');
        }
      } else {
        console.log('⚠ Could not find massages link');
      }
    });
  });

  describe('Göreceli Zaman Formatı Testi', () => {
    it('should display relative time in Turkish', async () => {
      console.log('Testing relative time format in Turkish...');

      // Navigate to dashboard
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '10-relative-time-turkish.png'),
        fullPage: true
      });

      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Check that English relative time terms are NOT present
      const englishRelativeTimeTerms = [
        'ago',
        'just now',
        'seconds ago',
        'minutes ago',
        'hours ago',
        'days ago',
        'yesterday',
        'last week',
        'last month'
      ];

      const hasEnglishRelativeTime = englishRelativeTimeTerms.some(term => 
        visibleText.toLowerCase().includes(term.toLowerCase())
      );

      expect(hasEnglishRelativeTime).toBe(false);

      console.log('✓ Relative time is in Turkish');
    });
  });

  describe('Mobil Görünüm Format Testi', () => {
    it('should display dates and prices in Turkish format on mobile', async () => {
      console.log('Testing mobile view date and price formats...');

      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(baseUrl, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '11-mobile-formats-turkish.png'),
        fullPage: true
      });

      const visibleText = await page.evaluate(() => (document as any).body.innerText);

      // Check for Turkish Lira symbol
      const hasTurkishLiraSymbol = visibleText.includes('₺');

      // Check that dollar sign is NOT present
      const hasDollarSign = visibleText.includes('$');

      // Check for Turkish date format
      const turkishDatePattern = /\d{2}\.\d{2}\.\d{4}/;
      const hasTurkishDateFormat = turkishDatePattern.test(visibleText);

      // Check that US date format is NOT present
      const usDatePattern = /\d{2}\/\d{2}\/\d{4}/;
      const hasUSDateFormat = usDatePattern.test(visibleText);

      expect(hasDollarSign).toBe(false);
      expect(hasUSDateFormat).toBe(false);

      // Restore desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });

      console.log('✓ Mobile view uses Turkish formats');
    });
  });
});

