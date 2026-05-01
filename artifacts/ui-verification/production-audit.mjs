import { chromium } from 'playwright';

const PRODUCTION_URL = 'http://localhost:3100/dashboard';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
const networkErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('response', resp => { if (resp.status() >= 400) networkErrors.push({ url: resp.url().substring(0, 120), status: resp.status() }); });

// Clear cookies for fresh state
await page.context().clearCookies();

console.log('Navigating to production dashboard...');
await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Screenshot
await page.screenshot({ path: '/home/ronin704/Projects/allura memory/artifacts/ui-verification/production-overview-after.png', fullPage: false });

// Comprehensive audit
const audit = await page.evaluate(() => {
  const results = {};
  
  // 1. Logo
  const logo = document.querySelector('[data-testid="allura-logo"]');
  if (logo) {
    const img = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    const rect = logo.getBoundingClientRect();
    results.logo = {
      found: true,
      tag: logo.tagName,
      imgSrc: img?.src?.replace('http://localhost:3100', '') || 'none',
      imgAlt: img?.alt || 'none',
      naturalWidth: img?.naturalWidth || 0,
      naturalHeight: img?.naturalHeight || 0,
      visible: rect.width > 0 && rect.height > 0,
      boundingBox: { width: Math.round(rect.width), height: Math.round(rect.height) },
      notBroken: img ? img.naturalWidth > 0 && img.complete : false,
    };
  } else {
    results.logo = { found: false };
  }
  
  // 2. Font & Theme
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const dataFont = document.documentElement.getAttribute('data-font');
  const dataTheme = document.documentElement.getAttribute('data-theme-preset');
  results.font = {
    bodyFont,
    isIbmPlexSans: bodyFont.includes('IBM Plex Sans'),
    dataFont,
    isAlluraTheme: dataTheme === 'allura',
  };
  
  // 3. Brand CSS vars
  const cs = getComputedStyle(document.documentElement);
  results.brandColors = {
    alluraBlue: cs.getPropertyValue('--allura-blue').trim(),
    alluraGreen: cs.getPropertyValue('--allura-green').trim(),
    alluraOrange: cs.getPropertyValue('--allura-orange').trim(),
    alluraCharcoal: cs.getPropertyValue('--allura-charcoal').trim(),
    alluraCream: cs.getPropertyValue('--allura-cream').trim(),
    dashboardSurface: cs.getPropertyValue('--dashboard-surface').trim(),
    dashboardTextPrimary: cs.getPropertyValue('--dashboard-text-primary').trim(),
  };
  
  // 4. Brand color usage count
  let blueCount = 0, greenCount = 0, orangeCount = 0;
  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    const bg = style.backgroundColor;
    const color = style.color;
    if (bg.includes('29, 78, 216') || color.includes('29, 78, 216')) blueCount++;
    if (bg.includes('21, 122, 74') || color.includes('21, 122, 74')) greenCount++;
    if (bg.includes('255, 90, 46') || color.includes('255, 90, 46')) orangeCount++;
  }
  results.brandColorUsage = { blue: blueCount, green: greenCount, orange: orangeCount };
  
  // 5. Sidebar
  const sidebar = document.querySelector('[data-sidebar="sidebar"]');
  results.sidebar = sidebar ? {
    width: sidebar.getBoundingClientRect().width,
    hasNavLinks: sidebar.querySelectorAll('a').length,
  } : null;
  
  // 6. Page title
  results.pageTitle = document.querySelector('h1')?.textContent?.trim() || 'none';
  
  // 7. Theme switcher
  const themeBtn = document.querySelector('button[aria-label*="theme"]');
  results.themeSwitcher = themeBtn ? {
    ariaLabel: themeBtn.getAttribute('aria-label'),
    visible: themeBtn.getBoundingClientRect().width > 0,
  } : null;
  
  // 8. Images (check for broken)
  results.images = Array.from(document.querySelectorAll('img')).slice(0, 5).map(img => ({
    src: img.src.replace('http://localhost:3100', ''),
    alt: img.alt,
    broken: img.naturalWidth === 0,
  }));
  
  // 9. Logo 404 check - checked in outer scope
  
  return results;
});

// Inject network errors into result (they're in outer scope)
audit.networkErrors = networkErrors.slice(0, 10);
audit.consoleErrors = consoleErrors.slice(0, 5);

console.log(JSON.stringify(audit, null, 2));

// Verdict
const v = audit;
console.log('\n=== PRODUCTION VERDICT ===');
console.log(`Logo found: ${v.logo.found ? '✅' : '❌'}`);
console.log(`Logo visible: ${v.logo.visible ? '✅' : '❌'}`);
console.log(`Logo not broken: ${v.logo.notBroken ? '✅' : '❌'}`);
console.log(`Font IBM Plex Sans: ${v.font.isIbmPlexSans ? '✅' : '❌'}`);
console.log(`Theme Allura: ${v.font.isAlluraTheme ? '✅' : '❌'}`);
console.log(`Brand colors present: ${v.brandColors.alluraBlue ? '✅' : '❌'} (blue=${v.brandColors.alluraBlue}, green=${v.brandColors.alluraGreen}, orange=${v.brandColors.alluraOrange})`);
console.log(`Brand color usage: blue=${v.brandColorUsage.blue}, green=${v.brandColorUsage.green}, orange=${v.brandColorUsage.orange}`);
console.log(`Sidebar visible: ${v.sidebar ? '✅' : '❌'} (${v.sidebar?.width}px, ${v.sidebar?.hasNavLinks} links)`);
console.log(`Theme switcher: ${v.themeSwitcher?.visible ? '✅' : '❌'}`);
console.log(`No broken images: ${v.images.every(i => !i.broken) ? '✅' : '❌'}`);
console.log(`Console errors: ${v.consoleErrors.length}`);
console.log(`Network errors: ${v.networkErrors.length}`);

// Navigate sub-pages
const pages = [
  { url: 'http://localhost:3100/dashboard/feed', name: 'production-feed-after' },
  { url: 'http://localhost:3100/dashboard/graph', name: 'production-graph-after' },
  { url: 'http://localhost:3100/dashboard/settings', name: 'production-settings-after' },
];

for (const p of pages) {
  try {
    await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/home/ronin704/Projects/allura memory/artifacts/ui-verification/${p.name}.png`, fullPage: false });
    console.log(`✅ ${p.name}`);
  } catch (e) {
    console.log(`❌ ${p.name}: ${e.message}`);
  }
}

await browser.close();