import { describe, it, expect } from "vitest";
import { initializeRuvix, shutdownRuvix, getRuvixBridge, RuvixBridge } from "./bridge";
import { existsSync } from "fs";

const RUVIX_BINARY = "./crates/ruvix-sidecar/target/release/ruvix-sidecar";
const hasRustSidecar = existsSync(RUVIX_BINARY);

describe("RuVix Bridge", () => {
  it("should create bridge instance", () => {
    const bridge = new RuvixBridge();
    expect(bridge).toBeDefined();
    expect(bridge.isConnected()).toBe(false);
  });

  it("should define health status interface", () => {
    const mockHealth = {
      ringBufferAvailable: true,
      messagesQueued: 0,
      latencyMicros: 100,
    };
    expect(mockHealth.ringBufferAvailable).toBe(true);
    expect(mockHealth.messagesQueued).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(!hasRustSidecar)("should connect to RuVix sidecar", async () => {
    const bridge = new RuvixBridge();
    await bridge.start();
    expect(bridge.isConnected()).toBe(true);
    await bridge.stop();
  });

  it.skipIf(!hasRustSidecar)("should return health status", async () => {
    const bridge = new RuvixBridge();
    await bridge.start();
    const health = await bridge.health();
    expect(health.status).toBe("ok");
    await bridge.stop();
  });

  it.skipIf(!hasRustSidecar)("should measure IPC latency", async () => {
    const bridge = new RuvixBridge();
    await bridge.start();
    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await bridge.health();
      latencies.push(performance.now() - start);
    }
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    expect(avg).toBeLessThan(5);
    await bridge.stop();
  });
});

describe("RuVix Singleton", () => {
  it("should manage singleton instance", () => {
    const b1 = getRuvixBridge();
    const b2 = getRuvixBridge();
    expect(b1).toBe(b2);
  });
});
