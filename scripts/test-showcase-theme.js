/**
 * Quick test script for Showcase theme changes
 * Tests that the detail panel behavior is correct
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'my-app-screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testShowcaseTheme() {
  console.log('🎬 Starting Showcase Theme Test...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-maximized'],
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    // Navigate to kiosk page
    console.log('📍 Navigating to kiosk...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(3000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'showcase-01-initial.png'),
      fullPage: true 
    });
    console.log('✅ Screenshot: showcase-01-initial.png');
    
    // Check if showcase mode is active (look for columns)
    const columns = await page.$$('[class*="cursor-pointer"][class*="overflow-hidden"]');
    console.log(`📊 Found ${columns.length} columns`);
    
    if (columns.length > 0) {
      // Click on a non-selected column to select it
      console.log('👆 Clicking on second column...');
      await columns[1]?.click();
      await sleep(1500);
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'showcase-02-column-selected.png'),
        fullPage: true 
      });
      console.log('✅ Screenshot: showcase-02-column-selected.png');
      
      // Look for the "Detaylar" button
      const detailsButton = await page.$('button:has-text("Detaylar")');
      if (detailsButton) {
        console.log('👆 Clicking "Detaylar" button...');
        await detailsButton.click();
        await sleep(1000);
        
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, 'showcase-03-details-panel.png'),
          fullPage: true 
        });
        console.log('✅ Screenshot: showcase-03-details-panel.png');
      } else {
        // Try finding button by text content
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await btn.evaluate(el => el.textContent);
          if (text && text.includes('Detaylar')) {
            console.log('👆 Found and clicking "Detaylar" button...');
            await btn.click();
            await sleep(1000);
            
            await page.screenshot({ 
              path: path.join(SCREENSHOT_DIR, 'showcase-03-details-panel.png'),
              fullPage: true 
            });
            console.log('✅ Screenshot: showcase-03-details-panel.png');
            break;
          }
        }
      }
      
      // Close the detail panel if visible
      const closeButton = await page.$('button[aria-label*="close"], button[aria-label*="Close"]');
      if (closeButton) {
        console.log('👆 Closing detail panel...');
        await closeButton.click();
        await sleep(500);
      }
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'showcase-04-final.png'),
        fullPage: true 
      });
      console.log('✅ Screenshot: showcase-04-final.png');
    }
    
    console.log('\n🎉 Showcase Theme Test Complete!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'showcase-error.png'),
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

testShowcaseTheme().catch(console.error);
