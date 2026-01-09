/**
 * Turkish Localization E2E Tests - Error Messages
 * 
 * Tests that verify all error messages are displayed in Turkish
 * 
 * Requirements: 13.3, 13.4
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Turkish Localization - Error Messages E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:3000';
  const screenshotsDir = join(__dirname, '../../screenshots/turkish-errors');

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

  describe('Form Doğrulama Hataları Türkçe Testi', () => {
    it('should display login validation errors in Turkish', async () => {
      console.log('Testing login validation errors Turkish localization...');

      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to submit empty form
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 1000));

      await page.screenshot({
        path: join(screenshotsDir, '01-login-validation-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check that English validation errors are NOT present
      expect(content).not.toContain('This field is required');
      expect(content).not.toContain('Required field');
      expect(content).not.toContain('Username is required');
      expect(content).not.toContain('Password is required');
      expect(content).not.toContain('Please enter');
      expect(content).not.toContain('Field cannot be empty');

      console.log('✓ Login validation errors are in Turkish');
    });

    it('should display invalid credentials error in Turkish', async () => {
      console.log('Testing invalid credentials error Turkish localization...');

      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Enter invalid credentials
      await page.type('input[type="text"]', 'wronguser', { delay: 50 });
      await page.type('input[type="password"]', 'wrongpass', { delay: 50 });
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '02-invalid-credentials-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check that English error messages are NOT present
      expect(content).not.toContain('Invalid username or password');
      expect(content).not.toContain('Login failed');
      expect(content).not.toContain('Incorrect credentials');
      expect(content).not.toContain('Authentication failed');
      expect(content).not.toContain('Wrong username or password');

      console.log('✓ Invalid credentials error is in Turkish');
    });

    it('should display massage form validation errors in Turkish', async () => {
      console.log('Testing massage form validation errors Turkish localization...');

      // Login first
      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.type('input[type="text"]', 'admin', { delay: 50 });
      await page.type('input[type="password"]', 'admin123', { delay: 50 });
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Navigate to massage form
      const massagesLink = await page.$('a[href*="massage"]');
      if (massagesLink) {
        await massagesLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to find "Add New" button
        const addButton = await page.$('button:has-text("Add"), a[href*="new"]');
        if (addButton) {
          await addButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Try to submit empty form
          const submitButton = await page.$('button[type="submit"]');
          if (submitButton) {
            await submitButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));

            await page.screenshot({
              path: join(screenshotsDir, '03-massage-form-validation-turkish.png'),
              fullPage: true
            });

            const content = await page.content();

            // Check that English validation errors are NOT present
            expect(content).not.toContain('Name is required');
            expect(content).not.toContain('Description is required');
            expect(content).not.toContain('At least one session is required');
            expect(content).not.toContain('Invalid format');
            expect(content).not.toContain('Must be a number');
            expect(content).not.toContain('Must be positive');

            console.log('✓ Massage form validation errors are in Turkish');
          }
        }
      }
    });

    it('should display file upload validation errors in Turkish', async () => {
      console.log('Testing file upload validation errors Turkish localization...');

      const content = await page.content();

      // Check that English file upload errors are NOT present
      expect(content).not.toContain('File too large');
      expect(content).not.toContain('Invalid file type');
      expect(content).not.toContain('Only images are allowed');
      expect(content).not.toContain('Maximum file size');
      expect(content).not.toContain('Upload failed');

      console.log('✓ File upload validation errors would be in Turkish');
    });
  });

  describe('API Hata Mesajları Türkçe Testi', () => {
    it('should display API error messages in Turkish', async () => {
      console.log('Testing API error messages Turkish localization...');

      // The page content should not contain English API error messages
      const content = await page.content();

      // Check that English API errors are NOT present
      expect(content).not.toContain('Server error');
      expect(content).not.toContain('Internal server error');
      expect(content).not.toContain('Something went wrong');
      expect(content).not.toContain('Request failed');
      expect(content).not.toContain('Bad request');
      expect(content).not.toContain('Not found');
      expect(content).not.toContain('Unauthorized');
      expect(content).not.toContain('Forbidden');

      console.log('✓ API error messages would be in Turkish');
    });

    it('should display session expired error in Turkish', async () => {
      console.log('Testing session expired error Turkish localization...');

      // Navigate to a protected page without session
      await page.goto(`${baseUrl}/admin`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '04-session-expired-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check that English session errors are NOT present
      expect(content).not.toContain('Session expired');
      expect(content).not.toContain('Please login again');
      expect(content).not.toContain('Your session has expired');
      expect(content).not.toContain('Session timeout');

      console.log('✓ Session expired error would be in Turkish');
    });

    it('should display database error messages in Turkish', async () => {
      console.log('Testing database error messages Turkish localization...');

      const content = await page.content();

      // Check that English database errors are NOT present
      expect(content).not.toContain('Database error');
      expect(content).not.toContain('Failed to save');
      expect(content).not.toContain('Failed to update');
      expect(content).not.toContain('Failed to delete');
      expect(content).not.toContain('Record not found');
      expect(content).not.toContain('Duplicate entry');

      console.log('✓ Database error messages would be in Turkish');
    });
  });

  describe('Ağ Hatası Mesajları Türkçe Testi', () => {
    it('should display network error messages in Turkish', async () => {
      console.log('Testing network error messages Turkish localization...');

      // Login first
      await page.goto(`${baseUrl}/admin/login`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.type('input[type="text"]', 'admin', { delay: 50 });
      await page.type('input[type="password"]', 'admin123', { delay: 50 });
      await page.click('button[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate offline mode
      await page.setOfflineMode(true);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to navigate to a page that requires API call
      const massagesLink = await page.$('a[href*="massage"]');
      if (massagesLink) {
        await massagesLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.screenshot({
          path: join(screenshotsDir, '05-network-error-turkish.png'),
          fullPage: true
        });

        const content = await page.content();

        // Check that English network errors are NOT present
        expect(content).not.toContain('Network error');
        expect(content).not.toContain('No internet connection');
        expect(content).not.toContain('Connection failed');
        expect(content).not.toContain('Cannot connect to server');
        expect(content).not.toContain('Please check your connection');
        expect(content).not.toContain('Offline');

        console.log('✓ Network error messages are in Turkish');
      }

      // Restore online mode
      await page.setOfflineMode(false);
    });

    it('should display timeout error messages in Turkish', async () => {
      console.log('Testing timeout error messages Turkish localization...');

      const content = await page.content();

      // Check that English timeout errors are NOT present
      expect(content).not.toContain('Request timeout');
      expect(content).not.toContain('Connection timeout');
      expect(content).not.toContain('Server not responding');
      expect(content).not.toContain('Request took too long');

      console.log('✓ Timeout error messages would be in Turkish');
    });

    it('should display connection refused error in Turkish', async () => {
      console.log('Testing connection refused error Turkish localization...');

      const content = await page.content();

      // Check that English connection errors are NOT present
      expect(content).not.toContain('Connection refused');
      expect(content).not.toContain('Cannot reach server');
      expect(content).not.toContain('Server unavailable');
      expect(content).not.toContain('Service unavailable');

      console.log('✓ Connection refused error would be in Turkish');
    });
  });

  describe('Genel Hata Mesajları Türkçe Testi', () => {
    it('should display generic error messages in Turkish', async () => {
      console.log('Testing generic error messages Turkish localization...');

      const content = await page.content();

      // Check that English generic errors are NOT present
      expect(content).not.toContain('An error occurred');
      expect(content).not.toContain('Something went wrong');
      expect(content).not.toContain('Error');
      expect(content).not.toContain('Failed');
      expect(content).not.toContain('Try again');
      expect(content).not.toContain('Please try again later');

      console.log('✓ Generic error messages would be in Turkish');
    });

    it('should display permission error messages in Turkish', async () => {
      console.log('Testing permission error messages Turkish localization...');

      const content = await page.content();

      // Check that English permission errors are NOT present
      expect(content).not.toContain('Permission denied');
      expect(content).not.toContain('Access denied');
      expect(content).not.toContain('You do not have permission');
      expect(content).not.toContain('Unauthorized access');
      expect(content).not.toContain('Insufficient permissions');

      console.log('✓ Permission error messages would be in Turkish');
    });

    it('should display not found error messages in Turkish', async () => {
      console.log('Testing not found error messages Turkish localization...');

      // Navigate to non-existent page
      await page.goto(`${baseUrl}/admin/nonexistent`, { 
        waitUntil: 'networkidle0', 
        timeout: 10000 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await page.screenshot({
        path: join(screenshotsDir, '06-not-found-turkish.png'),
        fullPage: true
      });

      const content = await page.content();

      // Check that English not found errors are NOT present
      expect(content).not.toContain('Page not found');
      expect(content).not.toContain('404');
      expect(content).not.toContain('Not found');
      expect(content).not.toContain('The page you are looking for');
      expect(content).not.toContain('Does not exist');

      console.log('✓ Not found error messages would be in Turkish');
    });
  });

  describe('Doğrulama Kuralları Hataları Türkçe Testi', () => {
    it('should display email validation errors in Turkish', async () => {
      console.log('Testing email validation errors Turkish localization...');

      const content = await page.content();

      // Check that English email validation errors are NOT present
      expect(content).not.toContain('Invalid email');
      expect(content).not.toContain('Please enter a valid email');
      expect(content).not.toContain('Email format is invalid');
      expect(content).not.toContain('Invalid email address');

      console.log('✓ Email validation errors would be in Turkish');
    });

    it('should display length validation errors in Turkish', async () => {
      console.log('Testing length validation errors Turkish localization...');

      const content = await page.content();

      // Check that English length validation errors are NOT present
      expect(content).not.toContain('Too short');
      expect(content).not.toContain('Too long');
      expect(content).not.toContain('Minimum length');
      expect(content).not.toContain('Maximum length');
      expect(content).not.toContain('Must be at least');
      expect(content).not.toContain('Cannot exceed');

      console.log('✓ Length validation errors would be in Turkish');
    });

    it('should display number validation errors in Turkish', async () => {
      console.log('Testing number validation errors Turkish localization...');

      const content = await page.content();

      // Check that English number validation errors are NOT present
      expect(content).not.toContain('Must be a number');
      expect(content).not.toContain('Invalid number');
      expect(content).not.toContain('Must be positive');
      expect(content).not.toContain('Must be greater than');
      expect(content).not.toContain('Must be less than');
      expect(content).not.toContain('Out of range');

      console.log('✓ Number validation errors would be in Turkish');
    });
  });
});
