import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Test sidebar collapse/expand
await page.context().clearCookies();
await page.goto('http://localhost:3200/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Take expanded sidebar screenshot
await page.screenshot({ path: '/home/ronin704/.openclaw/workspace/sidebar-expanded.png', fullPage: false });

// Click sidebar toggle to collapse
const toggle = await page.$('[data-sidebar="trigger"]');
if (toggle) {
  await toggle.click();
  await page.waitForTimeout(1000);
  
  // Audit collapsed logo
  const collapsedLogo = await page.evaluate(() => {
    const logo = document.querySelector('[data-testid="allura-logo"]');
    if (!logo) return { found: false };
    const img = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    const rect = logo.getBoundingClientRect();
    return {
      found: true,
      imgSrc: img?.src?.replace('http://localhost:3200', '') || 'none',
      imgAlt: img?.alt || 'none',
      naturalWidth: img?.naturalWidth || 0,
      visible: rect.width > 0 && rect.height > 0,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
  console.log('=== COLLAPSED LOGO ===');
  console.log(JSON.stringify(collapsedLogo, null, 2));
  
  await page.screenshot({ path: '/home/ronin704/.openclaw/workspace/sidebar-collapsed.png', fullPage: false });
  
  // Re-expand
  await toggle.click();
  await page.waitForTimeout(500);
}

// Test theme cycling
console.log('\n=== THEME CYCLING ===');
const themeBtn = await page.$('button[aria-label*="theme"]');
if (themeBtn) {
  const themes = [];
  for (let i = 0; i < 5; i++) {
    const label = await themeBtn.getAttribute('aria-label');
    const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme-preset'));
    themes.push({ step: i, label, dataTheme });
    await themeBtn.click();
    await page.waitForTimeout(500);
  }
  console.log(JSON.stringify(themes, null, 2));
}

// Test all navigation links
console.log('\n=== NAVIGATION LINKS ===');
const navLinks = await page.evaluate(() => {
  const links = document.querySelectorAll('[data-sidebar="sidebar"] a');
  return Array.from(links).map(link => ({
    href: link.getAttribute('href'),
    text: link.textContent?.trim(),
  }));
});
console.log(JSON.stringify(navLinks, null, 2));

// Navigate to each page and check for errors
const pages = [
  '/dashboard/feed',
  '/dashboard/graph',
  '/dashboard/insights',
  '/dashboard/settings',
  '/dashboard/curator',
  '/dashboard/agents',
];

console.log('\n=== PAGE NAVIGATION ===');
for (const url of pages) {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  try {
    const response = await page.goto(`http://localhost:3200${url}`, { waitUntil: 'networkidle', timeout: 15000 });
    console.log(`${url}: ${response?.status() || 'no response'}${errors.length ? ` (${errors.length} console errors)` : ''}`);
  } catch (e) {
    console.log(`${url}: ERROR - ${e.message}`);
  }
  page.removeAllListeners('console');
}

await browser.close();
console.log('\n=== ALL TESTS COMPLETE ===');