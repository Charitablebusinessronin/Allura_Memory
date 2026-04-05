import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { 
  browser_navigate, 
  browser_take_screenshot,
  browser_click,
  browser_wait_for,
  browser_console_messages,
  browser_evaluate
} from "@mcp-docker/playwright";

/**
 * Dashboard Visual Tests
 * 
 * These tests use MCP Docker's Playwright server to perform
 * browser automation and visual regression testing.
 * 
 * Prerequisites:
 * - MCP Docker Playwright server running
 * - Next.js dev server running on localhost:3000
 * - Dashboard accessible at /dashboard/paperclip
 */

describe("Dashboard Visual Tests", () => {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const DASHBOARD_URL = `${BASE_URL}/dashboard/paperclip`;

  beforeAll(async () => {
    // Verify server is running
    try {
      const response = await fetch(BASE_URL);
      if (!response.ok) {
        console.warn(`⚠️  Server not responding at ${BASE_URL}`);
        console.log("Make sure to run: bun run dev");
      }
    } catch {
      console.warn(`⚠️  Could not connect to ${BASE_URL}`);
    }
  });

  describe("Dashboard Home", () => {
    it("should render dashboard without console errors", async () => {
      // Navigate to dashboard
      await browser_navigate({ url: DASHBOARD_URL });

      // Wait for page to load
      await browser_wait_for({ text: "Paperclip" });

      // Take screenshot for visual regression
      await browser_take_screenshot({
        filename: "dashboard-home.png",
        fullPage: true
      });

      // Verify no console errors
      const errors = await browser_console_messages({ level: "error" });
      expect(errors).toHaveLength(0);
    });

    it("should display token budget section", async () => {
      await browser_navigate({ url: DASHBOARD_URL });
      
      // Look for token budget indicator
      await browser_wait_for({ text: "Token Budget" });
      
      await browser_take_screenshot({
        filename: "dashboard-token-budget.png",
        fullPage: false
      });
    });

    it("should display agent status cards", async () => {
      await browser_navigate({ url: DASHBOARD_URL });
      
      // Verify agent cards are present
      await browser_wait_for({ text: "Active Agents" });
      
      await browser_take_screenshot({
        filename: "dashboard-agents.png",
        fullPage: false
      });
    });
  });

  describe("Approval Workflow", () => {
    it("should navigate to approvals tab", async () => {
      await browser_navigate({ url: DASHBOARD_URL });
      
      // Click on Approvals tab
      await browser_click({ ref: "approvals-tab" });
      
      // Wait for approvals to load
      await browser_wait_for({ text: "Pending Approvals" });
      
      await browser_take_screenshot({
        filename: "approvals-queue.png",
        fullPage: true
      });
    });

    it("should display approval items if present", async () => {
      await browser_navigate({ url: DASHBOARD_URL });
      await browser_click({ ref: "approvals-tab" });
      
      // Check if there are approval items or empty state
      const content = await browser_evaluate({
        script: `
          const items = document.querySelectorAll('[data-testid="approval-item"]');
          const emptyState = document.querySelector('[data-testid="empty-approvals"]');
          return { itemCount: items.length, hasEmptyState: !!emptyState };
        `
      });
      
      // Either items exist or empty state is shown
      expect(content.itemCount > 0 || content.hasEmptyState).toBe(true);
    });
  });

  describe("Token Budget Visualization", () => {
    it("should render token budget chart", async () => {
      await browser_navigate({ url: DASHBOARD_URL });
      
      // Click on Token Budget tab
      await browser_click({ ref: "token-budget-tab" });
      
      // Wait for chart to render
      await browser_wait_for({ text: "Token Usage" });
      
      await browser_take_screenshot({
        filename: "token-budget-chart.png",
        fullPage: false
      });
      
      // Verify no chart rendering errors
      const errors = await browser_console_messages({ level: "error" });
      const chartErrors = errors.filter((e: string) => 
        e.toLowerCase().includes("chart") || e.toLowerCase().includes("recharts")
      );
      expect(chartErrors).toHaveLength(0);
    });
  });

  describe("Responsive Design", () => {
    it("should adapt layout for mobile viewport", async () => {
      // Set mobile viewport
      await browser_evaluate({
        script: "window.resizeTo(375, 667)"
      });
      
      await browser_navigate({ url: DASHBOARD_URL });
      
      // Wait for mobile layout
      await browser_wait_for({ text: "Paperclip" });
      
      await browser_take_screenshot({
        filename: "dashboard-mobile.png",
        fullPage: true
      });
      
      // Verify mobile menu is present
      const hasMobileMenu = await browser_evaluate({
        script: `
          const menuButton = document.querySelector('[data-testid="mobile-menu-button"]');
          return !!menuButton;
        `
      });
      
      expect(hasMobileMenu).toBe(true);
    });

    it("should adapt layout for tablet viewport", async () => {
      // Set tablet viewport
      await browser_evaluate({
        script: "window.resizeTo(768, 1024)"
      });
      
      await browser_navigate({ url: DASHBOARD_URL });
      await browser_wait_for({ text: "Paperclip" });
      
      await browser_take_screenshot({
        filename: "dashboard-tablet.png",
        fullPage: true
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 gracefully", async () => {
      await browser_navigate({ url: `${BASE_URL}/nonexistent-page` });
      
      await browser_take_screenshot({
        filename: "404-page.png",
        fullPage: true
      });
      
      // Verify 404 message is shown
      const pageContent = await browser_evaluate({
        script: "document.body.textContent"
      });
      
      expect(pageContent).toMatch(/404|not found|page not found/i);
    });
  });
});
