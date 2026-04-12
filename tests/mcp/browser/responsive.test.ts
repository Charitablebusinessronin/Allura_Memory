import { describe, it, expect } from "vitest";
import { 
  browser_navigate,
  browser_take_screenshot,
  browser_evaluate
} from "@mcp-docker/playwright";
import { getPort } from "../../../src/lib/config/ports";

/**
 * Responsive Design Tests
 * 
 * Tests the dashboard at various viewport sizes to ensure
 * proper responsive behavior across devices.
 * 
 * Run with: RUN_BROWSER_TESTS=true bun vitest run tests/mcp/browser/responsive.test.ts
 */

const shouldRunBrowser = process.env.RUN_BROWSER_TESTS === "true";

describe.skipIf(!shouldRunBrowser)("Responsive Design Tests", () => {
  const PAPERCLIP_PORT = getPort("paperclip", "PAPERCLIP_PORT");
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${PAPERCLIP_PORT}`;
  const DASHBOARD_URL = `${BASE_URL}/dashboard/paperclip`;

  interface Viewport {
    name: string;
    width: number;
    height: number;
    device: string;
  }

  const viewports: Viewport[] = [
    { name: "mobile-small", width: 320, height: 568, device: "iPhone SE" },
    { name: "mobile", width: 375, height: 667, device: "iPhone 8" },
    { name: "mobile-large", width: 414, height: 896, device: "iPhone 11 Pro Max" },
    { name: "tablet", width: 768, height: 1024, device: "iPad" },
    { name: "tablet-large", width: 1024, height: 1366, device: "iPad Pro" },
    { name: "desktop", width: 1280, height: 720, device: "Desktop" },
    { name: "desktop-large", width: 1920, height: 1080, device: "Desktop HD" },
  ];

  viewports.forEach(({ name, width, height, device }) => {
    it(`should render correctly at ${device} size (${width}x${height})`, async () => {
      // Set viewport
      await browser_evaluate({
        script: `window.resizeTo(${width}, ${height})`
      });

      // Navigate to dashboard
      await browser_navigate({ url: DASHBOARD_URL });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Take screenshot
      await browser_take_screenshot({
        filename: `responsive-${name}.png`,
        fullPage: true
      });

      // Verify no horizontal scroll (content fits viewport)
      const scrollWidth = await browser_evaluate({
        script: "document.documentElement.scrollWidth"
      });

      expect(scrollWidth).toBeLessThanOrEqual(width + 20); // Allow 20px tolerance
    });
  });

  describe("Navigation Behavior", () => {
    it("should show hamburger menu on mobile", async () => {
      await browser_evaluate({
        script: "window.resizeTo(375, 667)"
      });

      await browser_navigate({ url: DASHBOARD_URL });
      await new Promise(resolve => setTimeout(resolve, 500));

      const hasHamburgerMenu = await browser_evaluate({
        script: `
          const hamburger = document.querySelector('[data-testid="mobile-menu-button"], .hamburger, [aria-label*="menu"]');
          return !!hamburger;
        `
      });

      expect(hasHamburgerMenu).toBe(true);
    });

    it("should show full navigation on desktop", async () => {
      await browser_evaluate({
        script: "window.resizeTo(1280, 720)"
      });

      await browser_navigate({ url: DASHBOARD_URL });
      await new Promise(resolve => setTimeout(resolve, 500));

      const hasFullNav = await browser_evaluate({
        script: `
          const nav = document.querySelector('nav, [role="navigation"]');
          if (!nav) return false;
          const links = nav.querySelectorAll('a');
          return links.length >= 3; // Expect at least 3 nav links
        `
      });

      expect(hasFullNav).toBe(true);
    });
  });

  describe("Content Layout", () => {
    it("should stack cards vertically on mobile", async () => {
      await browser_evaluate({
        script: "window.resizeTo(375, 667)"
      });

      await browser_navigate({ url: DASHBOARD_URL });
      await new Promise(resolve => setTimeout(resolve, 500));

      const cardLayout = await browser_evaluate({
        script: `
          const cards = document.querySelectorAll('[data-testid="agent-card"], .card');
          if (cards.length < 2) return { hasCards: false };
          
          const first = cards[0].getBoundingClientRect();
          const second = cards[1].getBoundingClientRect();
          
          return {
            hasCards: true,
            isVertical: second.top > first.bottom,
            firstCardY: first.top,
            secondCardY: second.top
          };
        `
      });

      if (cardLayout.hasCards) {
        expect(cardLayout.isVertical).toBe(true);
      }
    });

    it("should show cards in grid on desktop", async () => {
      await browser_evaluate({
        script: "window.resizeTo(1280, 720)"
      });

      await browser_navigate({ url: DASHBOARD_URL });
      await new Promise(resolve => setTimeout(resolve, 500));

      const cardLayout = await browser_evaluate({
        script: `
          const cards = document.querySelectorAll('[data-testid="agent-card"], .card');
          if (cards.length < 2) return { hasCards: false };
          
          const first = cards[0].getBoundingClientRect();
          const second = cards[1].getBoundingClientRect();
          
          return {
            hasCards: true,
            isHorizontal: Math.abs(second.top - first.top) < 50,
            firstCardX: first.left,
            secondCardX: second.left
          };
        `
      });

      if (cardLayout.hasCards) {
        expect(cardLayout.isHorizontal).toBe(true);
      }
    });
  });
});
