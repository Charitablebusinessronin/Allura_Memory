import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Collect all console and network errors
const consoleErrors = [];
const networkErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('response', resp => { if (resp.status() >= 400) networkErrors.push({ url: resp.url(), status: resp.status() }); });

await page.goto('http://localhost:3100/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Screenshot overview
await page.screenshot({ path: '/home/ronin704/Projects/allura memory/artifacts/ui-verification/overview-before.png', fullPage: true });

// Sidebar-only screenshot
const sidebar = await page.$('[data-sidebar="sidebar"]');
if (sidebar) {
  await sidebar.screenshot({ path: '/home/ronin704/Projects/allura memory/artifacts/ui-verification/sidebar-before.png' });
} else {
  console.log('NO SIDEBAR ELEMENT FOUND');
}

// Deep audit of visual state
const audit = await page.evaluate(() => {
  const results = {};
  
  // Logo audit
  const logo = document.querySelector('[data-testid="allura-logo"]');
  if (logo) {
    const rect = logo.getBoundingClientRect();
    const styles = getComputedStyle(logo);
    const img = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    results.logo = {
      tag: logo.tagName,
      text: logo.textContent?.trim() || '',
      src: img?.src || logo.src || '',
      naturalWidth: img?.naturalWidth || 0,
      naturalHeight: img?.naturalHeight || 0,
      visible: rect.width > 0 && rect.height > 0,
      boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      alt: img?.alt || '',
      parentHidden: styles.display === 'none' || styles.visibility === 'hidden',
    };
  } else {
    results.logo = null;
  }
  
  // Color audit - check actual rendered colors
  const sidebar2 = document.querySelector('[data-sidebar="sidebar"]');
  if (sidebar2) {
    const sidebarStyles = getComputedStyle(sidebar2);
    results.sidebar = {
      backgroundColor: sidebarStyles.backgroundColor,
      borderColor: sidebarStyles.borderRightColor,
      width: sidebar2.getBoundingClientRect().width,
    };
  }
  
  // Check CSS custom properties
  const root = document.documentElement;
  results.cssVars = {
    alluraBlue: getComputedStyle(root).getPropertyValue('--allura-blue').trim(),
    alluraGreen: getComputedStyle(root).getPropertyValue('--allura-green').trim(),
    alluraOrange: getComputedStyle(root).getPropertyValue('--allura-orange').trim(),
    alluraCharcoal: getComputedStyle(root).getPropertyValue('--allura-charcoal').trim(),
    alluraCream: getComputedStyle(root).getPropertyValue('--allura-cream').trim(),
    alluraGold: getComputedStyle(root).getPropertyValue('--allura-gold').trim(),
    dashboardSurface: getComputedStyle(root).getPropertyValue('--dashboard-surface').trim(),
    dashboardSurfaceAlt: getComputedStyle(root).getPropertyValue('--dashboard-surface-alt').trim(),
  };
  
  // Theme state
  results.theme = {
    mode: root.getAttribute('data-theme-mode'),
    preset: root.getAttribute('data-theme-preset'),
  };
  
  // Font check
  const body = document.body;
  const bodyFont = getComputedStyle(body).fontFamily;
  results.fonts = { body: bodyFont };
  
  // Nav items audit
  const navItems = document.querySelectorAll('[data-sidebar="sidebar"] a, .sidebar a');
  results.navItemCount = navItems.length;
  results.navItems = Array.from(navItems).slice(0, 10).map(a => ({
    text: a.textContent?.trim().substring(0, 50),
    href: a.getAttribute('href')?.substring(0, 50),
  }));
  
  // Metric cards audit
  const metricCards = document.querySelectorAll('.metric-card');
  results.metricCardCount = metricCards.length;
  results.metricCards = Array.from(metricCards).map(card => ({
    value: card.querySelector('.metric-value')?.textContent?.trim(),
    label: card.querySelector('.metric-label')?.textContent?.trim(),
    iconClass: card.querySelector('.metric-icon')?.className?.trim(),
  }));
  
  // Buttons audit
  const buttons = document.querySelectorAll('button, a[role="button"], .agency-btn');
  results.buttonCount = buttons.length;
  
  // ThemeSwitcher audit
  const themeSwitcher = document.querySelector('button[aria-label*="theme"], button[aria-label*="Theme"]');
  results.themeSwitcher = themeSwitcher ? {
    ariaLabel: themeSwitcher.getAttribute('aria-label'),
    visible: themeSwitcher.getBoundingClientRect().width > 0,
  } : null;
  
  // Main content area
  const main = document.querySelector('main, [role="main"], .flex-1');
  results.mainContent = main ? {
    backgroundColor: getComputedStyle(main).backgroundColor,
    width: main.getBoundingClientRect().width,
  } : null;
  
  // Overall page title and heading
  results.pageTitle = document.title;
  results.h1Text = document.querySelector('h1')?.textContent?.trim() || '';
  
  // All images on page
  const images = document.querySelectorAll('img');
  results.images = Array.from(images).map(img => ({
    src: img.src,
    alt: img.alt,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    displayWidth: img.getBoundingClientRect().width,
    displayHeight: img.getBoundingClientRect().height,
    broken: img.naturalWidth === 0,
  }));
  
  return results;
});

console.log(JSON.stringify(audit, null, 2));
console.log('\n--- Console Errors ---');
console.log(JSON.stringify(consoleErrors, null, 2));
console.log('\n--- Network Errors ---');
console.log(JSON.stringify(networkErrors, null, 2));

// Navigate to a few more pages for completeness
const pages = [
  { url: '/dashboard/feed', name: 'feed' },
  { url: '/dashboard/graph', name: 'graph' },
  { url: '/dashboard/insights', name: 'insights' },
  { url: '/dashboard/evidence', name: 'evidence' },
  { url: '/dashboard/settings', name: 'settings' },
];

for (const p of pages) {
  try {
    await page.goto(`http://localhost:3100${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/home/ronin704/Projects/allura memory/artifacts/ui-verification/${p.name}-before.png`, fullPage: false });
    console.log(`Screenshot saved: ${p.name}-before.png`);
  } catch (e) {
    console.log(`Error on ${p.name}: ${e.message}`);
  }
}

await browser.close();