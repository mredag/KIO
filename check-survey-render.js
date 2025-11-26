// Run this in browser console to debug survey rendering
console.log('=== Survey Mode Debug ===');

// Check if survey container exists
const container = document.querySelector('[class*="survey"]') || 
                  document.querySelector('[class*="Survey"]') ||
                  document.getElementById('survey-content');
console.log('Survey container:', container);

// Check all text elements
const allText = Array.from(document.querySelectorAll('p, h1, h2, h3, button, span'))
  .filter(el => el.textContent.trim().length > 0);
console.log('Text elements found:', allText.length);

allText.forEach((el, i) => {
  const styles = window.getComputedStyle(el);
  console.log(`Element ${i}:`, {
    text: el.textContent.substring(0, 50),
    color: styles.color,
    backgroundColor: styles.backgroundColor,
    opacity: styles.opacity,
    display: styles.display,
    visibility: styles.visibility,
    position: styles.position,
    zIndex: styles.zIndex
  });
});

// Check for overlay issues
const allDivs = document.querySelectorAll('div');
console.log('Total divs:', allDivs.length);
allDivs.forEach((div, i) => {
  const styles = window.getComputedStyle(div);
  if (styles.position === 'fixed' || styles.position === 'absolute') {
    console.log(`Positioned div ${i}:`, {
      position: styles.position,
      zIndex: styles.zIndex,
      top: styles.top,
      left: styles.left,
      width: styles.width,
      height: styles.height,
      backgroundColor: styles.backgroundColor,
      opacity: styles.opacity
    });
  }
});
