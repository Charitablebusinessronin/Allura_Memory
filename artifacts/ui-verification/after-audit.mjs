import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
const networkErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('response', resp => { if (resp.status() >= 400) networkErrors.push({ url: resp.url(), status: resp.status() }); });

// Clear cookies to get fresh state (no stale "inter" font cookie)
await page.context().clearCookies();

await page.goto('http://localhost:3200/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Screenshots
await page.screenshot({ path: '/home/ronin704/Projects/allura memory/artifacts/ui-verification/overview-after.png', fullPage: true });

// Deep audit
const audit = await page.evaluate(() => {
  const results = {};
  
  // Logo audit
  const logo = document.querySelector('[data-testid="allura-logo"]');
  if (logo) {
    const img = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    const rect = logo.getBoundingClientRect();
    const styles = getComputedStyle(logo);
    results.logo = {
      tag: logo.tagName,
      src: img?.src || 'none',
      alt: img?.alt || 'none',
      naturalWidth: img?.naturalWidth || 0,
      naturalHeight: img?.naturalHeight || 0,
      visible: rect.width > 0 && rect.height > 0,
      boundingBox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      display: styles.display,
      opacity: styles.opacity,
    };
  } else {
    results.logo = 'NOT FOUND';
  }
  
  // Font check
  const root = document.documentElement;
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const dataFont = root.getAttribute('data-font');
  const dataThemePreset = root.getAttribute('data-theme-preset');
  results.font = { bodyFont, dataFont, dataThemePreset };
  
  // CSS vars
  const cs = getComputedStyle(root);
  results.cssVars = {
    alluraBlue: cs.getPropertyValue('--allura-blue').trim(),
    alluraGreen: cs.getPropertyValue('--allura-green').trim(),
    alluraOrange: cs.getPropertyValue('--allura-orange').trim(),
    alluraCharcoal: cs.getPropertyValue('--allura-charcoal').trim(),
    alluraCream: cs.getPropertyValue('--allura-cream').trim(),
    dashboardSurface: cs.getPropertyValue('--dashboard-surface').trim(),
    dashboardSurfaceAlt: cs.getPropertyValue('--dashboard-surface-alt').trim(),
  };
  
  // Sidebar
  const sidebar = document.querySelector('[data-sidebar="sidebar"]');
  if (sidebar) {
    const sidebarStyles = getComputedStyle(sidebar);
    results.sidebar = {
      width: sidebar.getBoundingClientRect().width,
      backgroundColor: sidebarStyles.backgroundColor,
    };
  }
  
  // Check for Allura branding visible
  const h1 = document.querySelector('h1');
  results.h1 = h1?.textContent?.trim() || 'none';
  
  // Check theme switcher
  const themeBtn = document.querySelector('button[aria-label*="theme"]');
  results.themeSwitcher = themeBtn ? { ariaLabel: themeBtn.getAttribute('aria-label'), visible: themeBtn.getBoundingClientRect().width > 0 } : null;
  
  // Check nav items count
  const navItems = document.querySelectorAll('[data-sidebar="sidebar"] a');
  results.navCount = navItems.length;
  
  // Check for brand colors in visible elements
  const allElements = document.querySelectorAll('*');
  let brandColorCount = 0;
  for (const el of allElements) {
    const style = getComputedStyle(el);
    const bg = style.backgroundColor;
    const color = style.color;
    if (bg.includes('29, 78, 216') || color.includes('29, 78, 216')) brandColorCount++; // #1D4ED8 = rgb(29,78,216)
    if (bg.includes('255, 90, 46') || color.includes('255, 90, 46')) brandColorCount++; // #FF5A2E
    if (bg.includes('21, 122, 74') || color.includes('21, 122, 74')) brandColorCount++; // #157A4A
  }
  results.brandColorElements = brandColorCount;
  
  // All images check
  const images = document.querySelectorAll('img');
  results.images = Array.from(images).map(img => ({
    src: img.src.replace('http://localhost:3200', ''),
    alt: img.alt,
    naturalWidth: img.naturalWidth,
    broken: img.naturalWidth === 0,
  }));
  
  return results;
});

console.log(JSON.stringify(audit, null, 2));
console.log('\n--- Console Errors ---');
console.log(JSON.stringify(consoleErrors, null, 2));
console.log('\n--- Network Errors ---');
console.log(JSON.stringify(networkErrors.slice(0, 10), null, 2));

// Navigate to other pages for screenshots
const pages = [
  { url: '/dashboard/feed', name: 'feed-after' },
  { url: '/dashboard/graph', name: 'graph-after' },
  { url: '/dashboard/insights', name: 'insights-after' },
  { url: '/dashboard/settings', name: 'settings-after' },
];

for (const p of pages) {
  try {
    await page.goto(`http://localhost:3200${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/home/ronin704/Projects/allura memory/artifacts/ui-verification/${p.name}.png`, fullPage: false });
    console.log(`Screenshot saved: ${p.name}.png`);
  } catch (e) {
    console.log(`Error on ${p.name}: ${e.message}`);
  }
}

// Test collapsed sidebar
await page.goto('http://localhost:3200/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
// Click sidebar toggle
const toggle = await page.$('[data-sidebar="trigger"]') || await page.$('button[aria-label*="sidebar"]') || await page.$('button[aria-label*="Sidebar"]');
if (toggle) {
  await toggle.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/ronin704/Projects/allura memory/artifacts/ui-verification/sidebar-collapsed.png', fullPage: false });
  console.log('Sidebar collapsed screenshot saved');
  
  // Check logo in collapsed state
  const collapsedAudit = await page.evaluate(() => {
    const logo = document.querySelector('[data-testid="allura-logo"]');
    if (!logo) return { logo: 'NOT FOUND' };
    const img = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    const rect = logo.getBoundingClientRect();
    return {
      logo: {
        src: img?.src?.replace('http://localhost:3200', '') || 'none',
        alt: img?.alt || 'none',
        naturalWidth: img?.naturalWidth || 0,
        visible: rect.width > 0 && rect.height > 0,
        boundingBox: { width: Math.round(rect.width), height: Math.round(rect.height) },
      }
    };
  });
  console.log('\n--- Collapsed Sidebar Logo ---');
  console.log(JSON.stringify(collapsedAudit, null, 2));
} else {
  console.log('No sidebar toggle found');
}

await browser.close();