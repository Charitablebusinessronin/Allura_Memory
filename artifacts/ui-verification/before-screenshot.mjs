import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:3100/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

await page.screenshot({ path: '/home/ronin704/Projects/allura memory/artifacts/ui-verification/overview-before.png', fullPage: true });

// Check logo specifically
const logoEl = await page.$('[data-testid="allura-logo"]');
if (logoEl) {
  const box = await logoEl.boundingBox();
  console.log('Logo bounding box:', box);
  const naturalWidth = await logoEl.evaluate(el => {
    if (el.tagName === 'IMG') return el.naturalWidth;
    const img = el.querySelector('img');
    return img ? img.naturalWidth : -1;
  });
  console.log('Logo naturalWidth:', naturalWidth);
} else {
  console.log('NO LOGO ELEMENT FOUND with data-testid="allura-logo"');
}

// Check for network errors
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

// Check network 404s
const failedRequests = [];
page.on('requestfailed', req => { failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }); });

// Reload to capture errors
await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

await page.screenshot({ path: '/home/ronin704/Projects/allura memory/artifacts/ui-verification/overview-before-reloaded.png', fullPage: true });

console.log('Console errors:', consoleErrors.length ? consoleErrors : 'NONE');
console.log('Failed requests:', failedRequests.length ? failedRequests : 'NONE');

// Capture the computed styles to see what colors are actually applied
const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const rootBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
console.log('Body bg:', bodyBg);
console.log('Root bg:', rootBg);

// Check theme
const themeMode = await page.evaluate(() => document.documentElement.getAttribute('data-theme-mode'));
const themePreset = await page.evaluate(() => document.documentElement.getAttribute('data-theme-preset'));
console.log('Theme mode:', themeMode);
console.log('Theme preset:', themePreset);

await browser.close();