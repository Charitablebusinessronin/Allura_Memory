import { describe, it, expect } from "vitest";
import { nextjs_runtime } from "@mcp-docker/next-devtools";

/**
 * Next.js Integration Tests
 * 
 * These tests verify Next.js runtime behavior and build configuration
 * using the Next DevTools MCP server.
 */

describe("Next.js Integration", () => {
  describe("Runtime Information", () => {
    it("should return valid runtime info", async () => {
      const runtime = await nextjs_runtime({});
      
      expect(runtime).toBeDefined();
      expect(typeof runtime).toBe("object");
    });

    it("should report Next.js version", async () => {
      const runtime = await nextjs_runtime({});
      
      // Runtime should contain version info
      expect(runtime).toHaveProperty("version");
    });
  });

  describe("Build Configuration", () => {
    it("should have valid build configuration", async () => {
      const runtime = await nextjs_runtime({});
      
      // Check for expected configuration properties
      expect(runtime).toHaveProperty("config");
    });
  });
});

/**
 * Health Check Tests
 * 
 * Verify the application health endpoints are responding correctly.
 */
describe("Health Check Integration", () => {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  it("should respond to health check endpoint", async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toBe("healthy");
  });

  it("should include system metrics in health check", async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("version");
  });
});
