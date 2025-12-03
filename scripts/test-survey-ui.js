/**
 * Quick UI test for Survey Mode redesign
 * Tests the new full-screen layout on 15-inch kiosk screen
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:3000';

// Create screenshots directory
const screenshotsDir = path.join(__dirname, '..', 'my-app-screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function testSurveyUI() {
  console.log('🚀 Starting Survey UI Test...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Test at 15-inch kiosk resolution (1024x768 typical)
    const viewports = [
      { name: '15inch-kiosk', width: 1024, height: 768 },
      { name: '15inch-kiosk-hd', width: 1366, height: 768 },
      { name: 'fullhd', width: 1920, height: 1080 }
    ];
    
    for (const viewport of viewports) {
      console.log(`📐 Testing at ${viewport.name} (${viewport.width}x${viewport.height})...`);
      await page.setViewport({ width: viewport.width, height: viewport.height });
      
      // Navigate to kiosk page with longer timeout
      await page.goto(`${FRONTEND_URL}/kiosk`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Take screenshot of current mode
      await page.screenshot({
        path: path.join(screenshotsDir, `survey-${viewport.name}.png`),
        fullPage: false
      });
      console.log(`  ✅ Captured kiosk state`);
    }
    
    console.log('\n✅ Survey UI Test Complete!');
    console.log(`📁 Screenshots saved to: ${screenshotsDir}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

testSurveyUI().catch(console.error);
