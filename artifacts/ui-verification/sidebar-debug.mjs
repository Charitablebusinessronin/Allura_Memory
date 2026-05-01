import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.context().clearCookies();
await page.goto('http://localhost:3200/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Find sidebar toggle mechanisms
const sidebarInfo = await page.evaluate(() => {
  const sidebar = document.querySelector('[data-sidebar="sidebar"]');
  const trigger = document.querySelector('[data-sidebar="trigger"]');
  const toggle = document.querySelector('[data-sidebar="toggle"]');
  const collapseBtn = document.querySelector('[data-sidebar="collapse"]');
  const expandBtn = document.querySelector('[data-sidebar="expand"]');
  
  // Also check for any button with "sidebar" or "collapse" in aria-label
  const buttons = document.querySelectorAll('button');
  const sidebarButtons = Array.from(buttons).filter(b => {
    const label = b.getAttribute('aria-label') || '';
    const text = b.textContent || '';
    return label.toLowerCase().includes('sidebar') || 
           label.toLowerCase().includes('collapse') ||
           label.toLowerCase().includes('toggle') ||
           label.toLowerCase().includes('expand') ||
           text.includes('Sidebar') ||
           text.includes('Panel');
  });
  
  return {
    sidebarFound: !!sidebar,
    sidebarWidth: sidebar?.getBoundingClientRect().width || 0,
    triggerFound: !!trigger,
    toggleFound: !!toggle,
    collapseFound: !!collapseBtn,
    expandFound: !!expandBtn,
    sidebarButtons: sidebarButtons.map(b => ({
      label: b.getAttribute('aria-label'),
      text: b.textContent?.trim().slice(0, 50),
      dataAttrs: Array.from(b.attributes).filter(a => a.name.startsWith('data-')).map(a => `${a.name}=${a.value}`),
    })),
    // Check sidebar component type
    sidebarClasses: sidebar?.className?.split(' ').slice(0, 5),
  };
});

console.log(JSON.stringify(sidebarInfo, null, 2));

await browser.close();