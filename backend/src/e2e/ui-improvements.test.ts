// @ts-nocheck
import { describe, it, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('UI Improvement Analysis', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:5173';
  const reportPath = join(__dirname, '../../ui-improvement-report.json');

  beforeAll(async () => {
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

  it('should generate comprehensive UI improvement report', async () => {
    const report: any = {
      timestamp: new Date().toISOString(),
      improvements: [],
      metrics: {}
    };

    // Analyze kiosk page
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });

    // Color contrast analysis
    const colorAnalysis = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const issues: string[] = [];

      elements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const bg = styles.backgroundColor;
        const color = styles.color;

        // Check for low contrast (simplified)
        if (bg === 'rgb(255, 255, 255)' && color === 'rgb(200, 200, 200)') {
          issues.push('Low contrast detected');
        }
      });

      return { issues: issues.slice(0, 10) };
    });

    report.improvements.push({
      category: 'Color Contrast',
      priority: 'high',
      findings: colorAnalysis.issues,
      recommendations: [
        'Ensure text has minimum 4.5:1 contrast ratio',
        'Use darker colors for better readability',
        'Test with accessibility tools'
      ]
    });

    // Font size analysis
    const fontAnalysis = await page.evaluate(() => {
      const textElements = document.querySelectorAll('p, span, div, button, a');
      const fontSizes: number[] = [];

      textElements.forEach((el) => {
        const size = parseFloat(window.getComputedStyle(el).fontSize);
        if (size > 0) fontSizes.push(size);
      });

      const avgSize = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length;
      const minSize = Math.min(...fontSizes);

      return { avgSize, minSize, count: fontSizes.length };
    });

    report.improvements.push({
      category: 'Typography',
      priority: 'medium',
      findings: [
        `Average font size: ${fontAnalysis.avgSize.toFixed(2)}px`,
        `Minimum font size: ${fontAnalysis.minSize}px`,
        `Total text elements: ${fontAnalysis.count}`
      ],
      recommendations: [
        'Minimum font size should be 16px for body text',
        'Use larger fonts (24px+) for kiosk displays',
        'Ensure consistent font hierarchy'
      ]
    });

    // Spacing analysis
    const spacingAnalysis = await page.evaluate(() => {
      const clickableElements = document.querySelectorAll('button, a, input');
      const smallTargets: string[] = [];

      clickableElements.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          smallTargets.push(`Element ${i}: ${rect.width}x${rect.height}px`);
        }
      });

      return { smallTargets: smallTargets.slice(0, 10) };
    });

    report.improvements.push({
      category: 'Touch Targets',
      priority: 'high',
      findings: spacingAnalysis.smallTargets,
      recommendations: [
        'Minimum touch target size: 44x44px',
        'Add padding to buttons and links',
        'Increase spacing between interactive elements'
      ]
    });

    // Write report
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('UI Improvement Report generated:', reportPath);
  });
});
