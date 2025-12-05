const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'my-app-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-maximized'],
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    console.log('Navigating to kiosk...');
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(3000);
    
    // Set theme to showcase via localStorage (zustand persist)
    console.log('Setting theme to showcase...');
    await page.evaluate(() => {
      const stored = localStorage.getItem('kiosk-storage');
      if (stored) {
        const data = JSON.parse(stored);
        data.state.theme = 'showcase';
        localStorage.setItem('kiosk-storage', JSON.stringify(data));
      } else {
        localStorage.setItem('kiosk-storage', JSON.stringify({
          state: { theme: 'showcase', mode: 'digital-menu' },
          version: 0
        }));
      }
    });
    
    // Reload to apply theme
    console.log('Reloading page...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(4000);
    
    // Take screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'showcase-theme-test.png'),
      fullPage: true 
    });
    console.log('Screenshot saved: showcase-theme-test.png');
    
    // Check if detail panel is visible (should be hidden initially)
    const detailPanelVisible = await page.evaluate(() => {
      const panel = document.querySelector('[class*="fixed"][class*="right-0"][class*="z-50"]');
      if (!panel) return { exists: false };
      const style = window.getComputedStyle(panel);
      const transform = style.transform;
      return { 
        exists: true, 
        transform,
        isHidden: transform.includes('matrix') && !transform.includes('matrix(1, 0, 0, 1, 0, 0)')
      };
    });
    console.log('Detail panel state:', detailPanelVisible);
    
    // Find and click the "Detaylar" button
    console.log('Looking for Detaylar button...');
    const detaylarBtn = await page.$('button');
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} buttons`);
    
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text && text.includes('Detaylar')) {
        console.log('Found Detaylar button, clicking...');
        await btn.click();
        await sleep(1000);
        
        // Take screenshot after clicking
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, 'showcase-after-details-click.png'),
          fullPage: true 
        });
        console.log('Screenshot saved: showcase-after-details-click.png');
        break;
      }
    }
    
    // Wait for user to see
    console.log('Waiting 10 seconds for visual inspection...');
    await sleep(10000);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
