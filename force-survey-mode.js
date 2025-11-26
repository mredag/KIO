const puppeteer = require('puppeteer');

(async () => {
  console.log('🔄 Forcing survey mode...\n');
  
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('✅ Page loaded');
    
    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear();
      console.log('LocalStorage cleared');
    });
    
    console.log('✅ LocalStorage cleared');
    
    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Page reloaded');
    
    // Check current mode
    const mode = await page.evaluate(() => {
      const stored = localStorage.getItem('kiosk-storage');
      if (stored) {
        const data = JSON.parse(stored);
        return data.state?.mode || 'unknown';
      }
      return 'no storage';
    });
    
    console.log(`📍 Current mode: ${mode}`);
    
    // Take screenshot
    await page.screenshot({ path: 'after-clear.png', fullPage: true });
    console.log('✅ Screenshot saved: after-clear.png');
    
    console.log('\n✨ Done! Check if survey is now visible.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }
})();
