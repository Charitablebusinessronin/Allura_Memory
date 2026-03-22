import { spawn, ChildProcess } from "child_process";
import { promisify } from "util";

const sleep = promisify(setTimeout);

export interface RuvixConfig {
  binaryPath: string;
  port: number;
  shmPath: string;
}

export interface HealthStatus {
  ringBufferAvailable: boolean;
  messagesQueued: number;
  latencyMicros: number;
}

export interface Proof {
  tier: ProofTier;
  hash: string;
  signature?: string;
  timestamp: number;
  nonce: number;
}

export interface EventRecordRequest {
  eventId: string;
  eventType: string;
  agentId: string;
  groupId: string;
  workflowId?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  proofTier: ProofTier;
  proof?: Proof;
}

export type ProofTier = "reflex" | "standard" | "deep";

export interface ProofVerificationResult {
  valid: boolean;
  latencyMicros?: number;
  error?: string;
}

export class RuvixBridge {
  private process: ChildProcess | null = null;
  private config: RuvixConfig;
  private connected = false;

  constructor(config: Partial<RuvixConfig> = {}) {
    this.config = {
      binaryPath: config.binaryPath ?? "./crates/ruvix-sidecar/target/release/ruvix-sidecar",
      port: config.port ?? 9001,
      shmPath: config.shmPath ?? "/tmp/ruvix_shm",
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.binaryPath, [], {
        env: {
          ...process.env,
          RUST_LOG: "info",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.process.stdout?.on("data", (data) => {
        console.log("[Ruvix]", data.toString().trim());
      });

      this.process.stderr?.on("data", (data) => {
        console.error("[Ruvix]", data.toString().trim());
      });

      this.process.on("error", (err) => {
        reject(new Error(`Failed to start RuVix: ${err.message}`));
      });

      this.waitForReady().then(resolve).catch(reject);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGTERM");
      await sleep(100);
      if (!this.process.killed) {
        this.process.kill("SIGKILL");
      }
      this.process = null;
      this.connected = false;
    }
  }

  private async waitForReady(timeout = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.config.port}/health`);
        if (response.ok) {
          this.connected = true;
          return;
        }
      } catch {}
      await sleep(100);
    }
    throw new Error("RuVix failed to become ready within timeout");
  }

  async health(): Promise<{ status: string; version: string }> {
    const response = await fetch(`http://127.0.0.1:${this.config.port}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async ruvixHealth(): Promise<HealthStatus> {
    const response = await fetch(`http://127.0.0.1:${this.config.port}/health/ruvix`);
    if (!response.ok) {
      throw new Error(`RuVix health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async generateProof(
    data: Record<string, unknown>,
    tier: ProofTier
  ): Promise<Proof> {
    const response = await fetch(`http://127.0.0.1:${this.config.port}/v1/proofs/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, tier }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate proof: ${response.statusText}`);
    }

    return response.json();
  }

  async verifyProof(
    data: Record<string, unknown>,
    proof: Proof,
    expectedTier: ProofTier
  ): Promise<ProofVerificationResult> {
    const response = await fetch(`http://127.0.0.1:${this.config.port}/v1/proofs/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, proof, expected_tier: expectedTier }),
    });

    if (!response.ok) {
      return { valid: false, error: response.statusText };
    }

    return response.json();
  }

  async recordEvent(event: EventRecordRequest): Promise<{ status: string; eventId: string; proof?: Proof }> {
    if (!event.proof) {
      const eventData = {
        event_id: event.eventId,
        event_type: event.eventType,
        agent_id: event.agentId,
        group_id: event.groupId,
        workflow_id: event.workflowId,
        metadata: event.metadata,
        timestamp: event.timestamp.toISOString(),
      };
      event.proof = await this.generateProof(eventData, event.proofTier);
    }

    const response = await fetch(`http://127.0.0.1:${this.config.port}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: event.eventId,
        event_type: event.eventType,
        agent_id: event.agentId,
        group_id: event.groupId,
        workflow_id: event.workflowId,
        metadata: event.metadata,
        timestamp: event.timestamp.toISOString(),
        proof_tier: event.proofTier,
        proof: event.proof,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to record event: ${response.statusText}`);
    }

    return response.json();
  }

  isConnected(): boolean {
    return this.connected;
  }
}

let bridgeInstance: RuvixBridge | null = null;

export function getRuvixBridge(): RuvixBridge {
  if (!bridgeInstance) {
    bridgeInstance = new RuvixBridge();
  }
  return bridgeInstance;
}

export async function initializeRuvix(): Promise<RuvixBridge> {
  const bridge = getRuvixBridge();
  await bridge.start();
  return bridge;
}

export async function shutdownRuvix(): Promise<void> {
  if (bridgeInstance) {
    await bridgeInstance.stop();
    bridgeInstance = null;
  }
}
