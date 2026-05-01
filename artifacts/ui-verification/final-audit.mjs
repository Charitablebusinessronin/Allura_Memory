import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.context().clearCookies();
await page.goto('http://localhost:3200/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Comprehensive visual audit
const visualAudit = await page.evaluate(() => {
  const results = {};
  
  // 1. Logo check
  const logo = document.querySelector('[data-testid="allura-logo"]');
  if (logo) {
    const img = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    const rect = logo.getBoundingClientRect();
    results.logo = {
      found: true,
      tag: logo.tagName,
      imgSrc: img?.src?.replace('http://localhost:3200', '') || 'none',
      imgAlt: img?.alt || 'none',
      naturalWidth: img?.naturalWidth || 0,
      naturalHeight: img?.naturalHeight || 0,
      visible: rect.width > 0 && rect.height > 0,
      boundingBox: { width: Math.round(rect.width), height: Math.round(rect.height) },
      opacity: getComputedStyle(logo).opacity,
      display: getComputedStyle(logo).display,
    };
    
    // Check if logo image is broken
    results.logo.notBroken = img ? img.naturalWidth > 0 && img.complete : false;
  } else {
    results.logo = { found: false };
  }
  
  // 2. Font check
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const dataFont = document.documentElement.getAttribute('data-font');
  const dataTheme = document.documentElement.getAttribute('data-theme-preset');
  results.font = {
    bodyFont,
    dataFont,
    dataTheme,
    isIbmPlexSans: bodyFont.includes('IBM Plex Sans'),
    isAlluraTheme: dataTheme === 'allura',
  };
  
  // 3. Brand colors
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  results.brandColors = {
    alluraBlue: cs.getPropertyValue('--allura-blue').trim(),
    alluraGreen: cs.getPropertyValue('--allura-green').trim(),
    alluraOrange: cs.getPropertyValue('--allura-orange').trim(),
    alluraCharcoal: cs.getPropertyValue('--allura-charcoal').trim(),
    alluraCream: cs.getPropertyValue('--allura-cream').trim(),
    dashboardSurface: cs.getPropertyValue('--dashboard-surface').trim(),
    dashboardSurfaceAlt: cs.getPropertyValue('--dashboard-surface-alt').trim(),
    dashboardTextPrimary: cs.getPropertyValue('--dashboard-text-primary').trim(),
    dashboardTextSecondary: cs.getPropertyValue('--dashboard-text-secondary').trim(),
  };
  
  // 4. Brand color usage in visible elements
  const brandRGBs = {
    blue: '29, 78, 216',    // #1D4ED8
    green: '21, 122, 74',   // #157A4A
    orange: '255, 90, 46',  // #FF5A2E
    charcoal: '15, 17, 21', // #0F1115
    cream: '246, 244, 239',  // #F6F4EF
  };
  
  let brandElements = { blue: 0, green: 0, orange: 0, charcoal: 0, cream: 0 };
  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    const bg = style.backgroundColor;
    const color = style.color;
    for (const [name, rgb] of Object.entries(brandRGBs)) {
      if (bg.includes(rgb) || color.includes(rgb)) brandElements[name]++;
    }
  }
  results.brandColorUsage = brandElements;
  
  // 5. Sidebar check
  const sidebar = document.querySelector('[data-sidebar="sidebar"]');
  results.sidebar = sidebar ? {
    width: sidebar.getBoundingClientRect().width,
    backgroundColor: getComputedStyle(sidebar).backgroundColor,
    hasNavLinks: sidebar.querySelectorAll('a').length,
  } : null;
  
  // 6. Page title
  const h1 = document.querySelector('h1');
  results.pageTitle = h1?.textContent?.trim() || 'none';
  
  // 7. Theme switcher
  const themeBtn = document.querySelector('button[aria-label*="theme"]') || document.querySelector('[data-testid*="theme"]');
  results.themeSwitcher = themeBtn ? {
    ariaLabel: themeBtn.getAttribute('aria-label'),
    visible: themeBtn.getBoundingClientRect().width > 0,
  } : null;
  
  // 8. Images check (no 404s)
  const imgs = document.querySelectorAll('img');
  results.images = Array.from(imgs).map(img => ({
    src: img.src.replace('http://localhost:3200', ''),
    alt: img.alt,
    width: img.naturalWidth,
    broken: img.naturalWidth === 0 && img.complete,
  }));
  
  // 9. Promote/Approve buttons check
  const promoteButtons = document.querySelectorAll('button, a');
  let promoteCount = 0;
  let approveCount = 0;
  for (const btn of promoteButtons) {
    const text = btn.textContent?.trim().toLowerCase() || '';
    if (text.includes('promote')) promoteCount++;
    if (text.includes('approve')) approveCount++;
  }
  results.buttons = { promoteCount, approveCount };
  
  // 10. Background color of body
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  results.bodyBackground = bodyBg;
  
  return results;
});

console.log(JSON.stringify(visualAudit, null, 2));

// Verdict summary
const v = visualAudit;
console.log('\n=== VERDICT ===');
console.log(`Logo present: ${v.logo.found && v.logo.visible ? '✅' : '❌'}`);
console.log(`Logo not broken: ${v.logo.notBroken ? '✅' : '❌'}`);
console.log(`Font is IBM Plex Sans: ${v.font.isIbmPlexSans ? '✅' : '❌'}`);
console.log(`Theme is Allura: ${v.font.isAlluraTheme ? '✅' : '❌'}`);
console.log(`Brand colors in CSS vars: ${v.brandColors.alluraBlue ? '✅' : '❌'}`);
console.log(`Brand color usage (blue/green/orange): ${v.brandColorUsage.blue}/${v.brandColorUsage.green}/${v.brandColorUsage.orange}`);
console.log(`Sidebar visible: ${v.sidebar ? '✅' : '❌'}`);
console.log(`Theme switcher: ${v.themeSwitcher?.visible ? '✅' : '❌'}`);
console.log(`No broken images: ${v.images.every(i => !i.broken) ? '✅' : '❌'}`);
console.log(`No console/network errors: Will check separately`);

await browser.close();