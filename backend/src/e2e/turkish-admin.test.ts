/**
 * Turkish Localization E2E Tests - Admin Panel
 * 
 * Tests that verify all admin panel elements are displayed in Turkish
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

describe('Turkish Localization - Admin Panel E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:3000';
  const screenshotsDir = join(__dirname, '../../screenshots/turkish-admin');

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

  describe('Giriş Sayfası Türkçe Testi', () => {
    it('should display login page in Turkish', async () => {
      console.log('Testing login page Turkish localization...');

      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Take screenshot
      await page.screenshot({
        path: join(screenshotsDir, '01-login-page-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check that English login terms are NOT present
      expect(content).not.toContain('Admin Panel Login');
      expect(content).not.toContain('Username');
      expect(content).not.toContain('Password');
      expect(content).not.toContain('Login');
      expect(content).not.toContain('Sign in');
      expect(content).not.toContain('Invalid username or password');

      console.log('✓ Login page is in Turkish');
    });

    it('should display login form labels in Turkish', async () => {
      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const content = await page.content();

      // Check for absence of English form labels
      expect(content).not.toContain('Enter username');
      expect(content).not.toContain('Enter password');
      expect(content).not.toContain('Remember me');

      console.log('✓ Login form labels are in Turkish');
    });
  });

  describe('Dashboard Türkçe Testi', () => {
    it('should display dashboard in Turkish after login', async () => {
      console.log('Testing dashboard Turkish localization...');

      // Navigate to login
      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Login
      await page.type('input[type="text"]', 'admin', { delay: 50 });
      await page.type('input[type="password"]', 'admin123', { delay: 50 });
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take screenshot
      await page.screenshot({
        path: join(screenshotsDir, '02-dashboard-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check that English dashboard terms are NOT present
      expect(content).not.toContain('Dashboard');
      expect(content).not.toContain('Today\'s Surveys');
      expect(content).not.toContain('Total Surveys');
      expect(content).not.toContain('Kiosk Mode');
      expect(content).not.toContain('Kiosk Status');
      expect(content).not.toContain('Online');
      expect(content).not.toContain('Offline');
      expect(content).not.toContain('Last Seen');
      expect(content).not.toContain('Google Sheets Sync');
      expect(content).not.toContain('Last Sync');
      expect(content).not.toContain('Pending Sync');

      console.log('✓ Dashboard is in Turkish');
    });

    it('should display navigation menu in Turkish', async () => {
      const content = await page.content();

      // Check that English navigation terms are NOT present
      expect(content).not.toContain('Massages');
      expect(content).not.toContain('Surveys');
      expect(content).not.toContain('Survey Responses');
      expect(content).not.toContain('Kiosk Control');
      expect(content).not.toContain('Settings');
      expect(content).not.toContain('Backup');
      expect(content).not.toContain('System Logs');
      expect(content).not.toContain('Logout');

      console.log('✓ Navigation menu is in Turkish');
    });
  });

  describe('Masaj Yönetimi Türkçe Testi', () => {
    it('should display massage management page in Turkish', async () => {
      console.log('Testing massage management Turkish localization...');

      // Try to navigate to massages page
      const massagesLink = await page.$('a[href*="massage"]');
      if (massagesLink) {
        await massagesLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '03-massages-page-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English massage management terms are NOT present
        expect(content).not.toContain('Massage Management');
        expect(content).not.toContain('Add New Massage');
        expect(content).not.toContain('Edit');
        expect(content).not.toContain('Delete');
        expect(content).not.toContain('Massage Name');
        expect(content).not.toContain('Short Description');
        expect(content).not.toContain('Long Description');
        expect(content).not.toContain('Duration');
        expect(content).not.toContain('Media');
        expect(content).not.toContain('Sessions');
        expect(content).not.toContain('Featured');
        expect(content).not.toContain('Campaign');

        console.log('✓ Massage management page is in Turkish');
      } else {
        console.log('⚠ Could not find massages link');
      }
    });

    it('should display massage form in Turkish', async () => {
      // Try to find "Add New" button
      const addButton = await page.$('button:has-text("Add"), a[href*="new"]');
      if (addButton) {
        await addButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '04-massage-form-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English form terms are NOT present
        expect(content).not.toContain('Add Session');
        expect(content).not.toContain('Session Name');
        expect(content).not.toContain('Session Price');
        expect(content).not.toContain('Purpose Tags');
        expect(content).not.toContain('Upload Media');
        expect(content).not.toContain('Save');
        expect(content).not.toContain('Cancel');

        console.log('✓ Massage form is in Turkish');
      } else {
        console.log('⚠ Could not find add button');
      }
    });
  });

  describe('Anket Yönetimi Türkçe Testi', () => {
    it('should display survey management page in Turkish', async () => {
      console.log('Testing survey management Turkish localization...');

      // Navigate back to dashboard first
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to navigate to surveys page
      const surveysLink = await page.$('a[href*="survey"]');
      if (surveysLink) {
        await surveysLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '05-surveys-page-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English survey management terms are NOT present
        expect(content).not.toContain('Survey Management');
        expect(content).not.toContain('Survey Templates');
        expect(content).not.toContain('Create Survey');
        expect(content).not.toContain('Edit Survey');
        expect(content).not.toContain('Survey Type');
        expect(content).not.toContain('Satisfaction');
        expect(content).not.toContain('Discovery');
        expect(content).not.toContain('Active');
        expect(content).not.toContain('Inactive');

        console.log('✓ Survey management page is in Turkish');
      } else {
        console.log('⚠ Could not find surveys link');
      }
    });

    it('should display survey responses page in Turkish', async () => {
      // Try to navigate to survey responses
      const responsesLink = await page.$('a[href*="response"]');
      if (responsesLink) {
        await responsesLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '06-survey-responses-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English response terms are NOT present
        expect(content).not.toContain('Survey Responses');
        expect(content).not.toContain('Response Date');
        expect(content).not.toContain('Survey Type');
        expect(content).not.toContain('Answers');
        expect(content).not.toContain('Synced');
        expect(content).not.toContain('Not Synced');
        expect(content).not.toContain('Export');

        console.log('✓ Survey responses page is in Turkish');
      } else {
        console.log('⚠ Could not find responses link');
      }
    });
  });

  describe('Ayarlar Sayfası Türkçe Testi', () => {
    it('should display settings page in Turkish', async () => {
      console.log('Testing settings page Turkish localization...');

      // Navigate back to dashboard first
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to navigate to settings page
      const settingsLink = await page.$('a[href*="settings"]');
      if (settingsLink) {
        await settingsLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '07-settings-page-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English settings terms are NOT present
        expect(content).not.toContain('System Settings');
        expect(content).not.toContain('Slideshow Timeout');
        expect(content).not.toContain('Survey Timeout');
        expect(content).not.toContain('Google QR Display Duration');
        expect(content).not.toContain('Google Review URL');
        expect(content).not.toContain('Google Review Title');
        expect(content).not.toContain('Google Review Description');
        expect(content).not.toContain('Google Sheets');
        expect(content).not.toContain('Spreadsheet ID');
        expect(content).not.toContain('Test Connection');
        expect(content).not.toContain('Save Settings');

        console.log('✓ Settings page is in Turkish');
      } else {
        console.log('⚠ Could not find settings link');
      }
    });

    it('should display kiosk control page in Turkish', async () => {
      // Navigate back to dashboard first
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to navigate to kiosk control page
      const kioskLink = await page.$('a[href*="kiosk"]');
      if (kioskLink) {
        await kioskLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '08-kiosk-control-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English kiosk control terms are NOT present
        expect(content).not.toContain('Kiosk Control');
        expect(content).not.toContain('Current Mode');
        expect(content).not.toContain('Digital Menu');
        expect(content).not.toContain('Survey Mode');
        expect(content).not.toContain('Google QR Mode');
        expect(content).not.toContain('Slideshow Mode');
        expect(content).not.toContain('Select Survey');
        expect(content).not.toContain('Switch Mode');

        console.log('✓ Kiosk control page is in Turkish');
      } else {
        console.log('⚠ Could not find kiosk control link');
      }
    });

    it('should display backup page in Turkish', async () => {
      // Navigate back to dashboard first
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to navigate to backup page
      const backupLink = await page.$('a[href*="backup"]');
      if (backupLink) {
        await backupLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '09-backup-page-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English backup terms are NOT present
        expect(content).not.toContain('Database Backup');
        expect(content).not.toContain('Create Backup');
        expect(content).not.toContain('Download Backup');
        expect(content).not.toContain('Restore Backup');
        expect(content).not.toContain('Backup History');
        expect(content).not.toContain('Last Backup');
        expect(content).not.toContain('Backup Size');

        console.log('✓ Backup page is in Turkish');
      } else {
        console.log('⚠ Could not find backup link');
      }
    });

    it('should display system logs page in Turkish', async () => {
      // Navigate back to dashboard first
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to navigate to logs page
      const logsLink = await page.$('a[href*="log"]');
      if (logsLink) {
        await logsLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '10-logs-page-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English log terms are NOT present
        expect(content).not.toContain('System Logs');
        expect(content).not.toContain('Log Level');
        expect(content).not.toContain('Timestamp');
        expect(content).not.toContain('Message');
        expect(content).not.toContain('Clear Logs');
        expect(content).not.toContain('Export Logs');
        expect(content).not.toContain('Filter');

        console.log('✓ System logs page is in Turkish');
      } else {
        console.log('⚠ Could not find logs link');
      }
    });
  });

  describe('Mobil Admin Görünüm Türkçe Testi', () => {
    it('should display mobile admin view in Turkish', async () => {
      console.log('Testing mobile admin view Turkish localization...');

      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '11-mobile-admin-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check that English terms are NOT present in mobile view
      expect(content).not.toContain('Dashboard');
      expect(content).not.toContain('Menu');

      // Restore desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });

      console.log('✓ Mobile admin view is in Turkish');
    });
  });
});
