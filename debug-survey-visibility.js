const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Starting survey visibility debug...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to kiosk
    console.log('📍 Navigating to kiosk...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take initial screenshot
    await page.screenshot({ path: 'debug-initial.png', fullPage: true });
    console.log('✅ Initial screenshot saved: debug-initial.png\n');
    
    // Get page info
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyClasses: document.body.className,
        bodyStyles: {
          backgroundColor: window.getComputedStyle(document.body).backgroundColor,
          color: window.getComputedStyle(document.body).color,
        }
      };
    });
    console.log('📄 Page Info:', JSON.stringify(pageInfo, null, 2));
    
    // Check for survey elements
    console.log('\n🔎 Checking for survey elements...');
    const surveyDebug = await page.evaluate(() => {
      const results = {
        surveyContainer: null,
        allText: [],
        hiddenElements: [],
        positionedElements: []
      };
      
      // Find survey container
      const container = document.getElementById('survey-content') ||
                       document.querySelector('[class*="survey"]') ||
                       document.querySelector('[class*="Survey"]');
      
      if (container) {
        const styles = window.getComputedStyle(container);
        results.surveyContainer = {
          found: true,
          tagName: container.tagName,
          className: container.className,
          id: container.id,
          styles: {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            position: styles.position,
            zIndex: styles.zIndex,
            width: styles.width,
            height: styles.height,
            color: styles.color,
            backgroundColor: styles.backgroundColor
          },
          innerHTML: container.innerHTML.substring(0, 200)
        };
      } else {
        results.surveyContainer = { found: false };
      }
      
      // Find all text elements
      const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, button, span, div'))
        .filter(el => el.textContent.trim().length > 0);
      
      textElements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        const info = {
          tag: el.tagName,
          text: el.textContent.substring(0, 50),
          className: el.className,
          styles: {
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            opacity: styles.opacity,
            display: styles.display,
            visibility: styles.visibility,
            fontSize: styles.fontSize,
            position: styles.position,
            zIndex: styles.zIndex
          },
          position: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            inViewport: rect.top >= 0 && rect.left >= 0 && 
                       rect.bottom <= window.innerHeight && 
                       rect.right <= window.innerWidth
          }
        };
        
        results.allText.push(info);
        
        // Check if element is hidden
        if (styles.display === 'none' || 
            styles.visibility === 'hidden' || 
            parseFloat(styles.opacity) === 0) {
          results.hiddenElements.push(info);
        }
        
        // Check if element is positioned off-screen
        if (rect.top < -100 || rect.left < -100 || 
            rect.top > window.innerHeight + 100 || 
            rect.left > window.innerWidth + 100) {
          results.positionedElements.push(info);
        }
      });
      
      return results;
    });
    
    console.log('\n📊 Survey Debug Results:');
    console.log('='.repeat(60));
    
    if (surveyDebug.surveyContainer.found) {
      console.log('\n✅ Survey Container Found:');
      console.log(JSON.stringify(surveyDebug.surveyContainer, null, 2));
    } else {
      console.log('\n❌ Survey Container NOT Found');
    }
    
    console.log(`\n📝 Total Text Elements: ${surveyDebug.allText.length}`);
    console.log(`🙈 Hidden Elements: ${surveyDebug.hiddenElements.length}`);
    console.log(`📍 Off-screen Elements: ${surveyDebug.positionedElements.length}`);
    
    if (surveyDebug.allText.length > 0) {
      console.log('\n📋 First 5 Text Elements:');
      surveyDebug.allText.slice(0, 5).forEach((el, i) => {
        console.log(`\n${i + 1}. ${el.tag} - "${el.text}"`);
        console.log(`   Color: ${el.styles.color}`);
        console.log(`   Background: ${el.styles.backgroundColor}`);
        console.log(`   Opacity: ${el.styles.opacity}`);
        console.log(`   Display: ${el.styles.display}`);
        console.log(`   Visibility: ${el.styles.visibility}`);
        console.log(`   In Viewport: ${el.position.inViewport}`);
        console.log(`   Position: top=${el.position.top}, left=${el.position.left}`);
      });
    }
    
    if (surveyDebug.hiddenElements.length > 0) {
      console.log('\n🙈 Hidden Elements:');
      surveyDebug.hiddenElements.forEach((el, i) => {
        console.log(`\n${i + 1}. ${el.tag} - "${el.text}"`);
        console.log(`   Display: ${el.styles.display}`);
        console.log(`   Visibility: ${el.styles.visibility}`);
        console.log(`   Opacity: ${el.styles.opacity}`);
      });
    }
    
    if (surveyDebug.positionedElements.length > 0) {
      console.log('\n📍 Off-screen Elements:');
      surveyDebug.positionedElements.slice(0, 5).forEach((el, i) => {
        console.log(`\n${i + 1}. ${el.tag} - "${el.text}"`);
        console.log(`   Position: top=${el.position.top}, left=${el.position.left}`);
      });
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'debug-final.png', fullPage: true });
    console.log('\n✅ Final screenshot saved: debug-final.png');
    
    // Save debug report
    const fs = require('fs');
    fs.writeFileSync('debug-report.json', JSON.stringify({
      pageInfo,
      surveyDebug,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log('✅ Debug report saved: debug-report.json');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n🏁 Debug complete!');
    await browser.close();
  }
})();
