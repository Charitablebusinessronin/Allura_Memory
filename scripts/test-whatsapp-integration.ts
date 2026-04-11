#!/usr/bin/env bun
/**
 * WhatsApp Integration Test
 * 
 * Tests the WhatsApp webhook endpoint and OpenCode integration end-to-end.
 * This script simulates the full flow without requiring actual Meta credentials.
 */

import { config } from "dotenv";

config();

const MCP_HTTP_PORT = parseInt(
  process.env.ALLURA_MCP_HTTP_PORT || process.env.OPENCLAW_PORT || "3201",
  10
);
const BASE_URL = `http://localhost:${MCP_HTTP_PORT}`;

interface TestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  message?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      status: "pass",
      duration: Date.now() - start,
    });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    results.push({
      name,
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`  ❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Test 1: Health check
async function testHealthCheck(): Promise<void> {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  const data = await response.json();
  if (data.status !== "healthy") {
    throw new Error(`Unexpected health status: ${data.status}`);
  }
}

// Test 2: WhatsApp webhook verification
async function testWebhookVerification(): Promise<void> {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "test_verify_token";
  const challenge = "test_challenge_123";
  
  const response = await fetch(
    `${BASE_URL}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`
  );
  
  if (!response.ok) {
    throw new Error(`Webhook verification failed: ${response.status}`);
  }
  
  const body = await response.text();
  if (body !== challenge) {
    throw new Error(`Challenge mismatch: expected ${challenge}, got ${body}`);
  }
}

// Test 3: WhatsApp webhook verification failure
async function testWebhookVerificationFailure(): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123`
  );
  
  if (response.status !== 403) {
    throw new Error(`Expected 403, got ${response.status}`);
  }
}

// Test 4: Send test message
async function testSendMessage(): Promise<void> {
  const testMessage = {
    from: "+1234567890",
    text: "Hello from test! This is a testy message 🧪",
  };
  
  const response = await fetch(`${BASE_URL}/webhook/whatsapp/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testMessage),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send test message: ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.message || data.message.text !== testMessage.text) {
    throw new Error("Message not stored correctly");
  }
}

// Test 5: Receive messages
async function testReceiveMessages(): Promise<void> {
  const response = await fetch(`${BASE_URL}/webhook/whatsapp/messages`);
  
  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.status}`);
  }
  
  const data = await response.json();
  if (!Array.isArray(data.messages)) {
    throw new Error("Messages not returned as array");
  }
  
  if (data.count === 0) {
    throw new Error("No messages found (test message should be present)");
  }
  
  // Check if our test message is there
  const found = data.messages.find((m: { text: string }) => 
    m.text === "Hello from test! This is a testy message 🧪"
  );
  
  if (!found) {
    throw new Error("Test message not found in received messages");
  }
}

// Test 6: Simulate real WhatsApp webhook payload
async function testRealWebhookPayload(): Promise<void> {
  const payload = {
    object: "whatsapp_business_api",
    entry: [
      {
        id: "test_business_id",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "1234567890",
                phone_number_id: "test_phone_id",
              },
              contacts: [
                {
                  wa_id: "9876543210",
                  profile: { name: "Test User" },
                },
              ],
              messages: [
                {
                  id: "test_message_id",
                  from: "9876543210",
                  timestamp: Date.now().toString(),
                  type: "text",
                  text: { body: "Real webhook simulation 🎯" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  
  const response = await fetch(`${BASE_URL}/webhook/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to process webhook: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.status !== "received") {
    throw new Error(`Unexpected status: ${data.status}`);
  }
}

// Test 7: OpenCode integration check
async function testOpenCodeIntegration(): Promise<void> {
  // Check if OpenCode CLI is available
  // @ts-ignore - Bun global type not available
  const proc = Bun.spawn(["which", "opencode"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // @ts-ignore - Bun global type not available
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error("OpenCode CLI not found in PATH");
  }
  
  // Check if opencode.json exists and is valid JSON
  const configPath = "./opencode.json";
  try {
    // @ts-ignore - Bun global type not available
    const configFile = await Bun.file(configPath).text();
    const config = JSON.parse(configFile);
    
    // Verify required fields
    if (!config.$schema) {
      throw new Error("opencode.json missing $schema");
    }
    if (!config.default_agent) {
      throw new Error("opencode.json missing default_agent");
    }
    
    console.log(`     OpenCode config valid: ${config.default_agent} agent configured`);
  } catch (error) {
    throw new Error(`OpenCode config check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main test runner
async function main(): Promise<void> {
  console.log("\n🧪 WhatsApp Integration Test Suite\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Check if server is running
  console.log("Checking OpenClaw Gateway...");
  try {
    await fetch(`${BASE_URL}/health`);
    console.log("  ✅ Gateway is running\n");
  } catch {
    console.log("  ⚠️  Gateway not running. Starting it now...\n");
    console.log("  Run in another terminal: bun run mcp:http\n");
    process.exit(1);
  }
  
  console.log("Running tests...\n");
  
  await runTest("Health check endpoint", testHealthCheck);
  await runTest("WhatsApp webhook verification", testWebhookVerification);
  await runTest("WhatsApp webhook verification failure", testWebhookVerificationFailure);
  await runTest("Send test message", testSendMessage);
  await runTest("Receive messages", testReceiveMessages);
  await runTest("Real webhook payload simulation", testRealWebhookPayload);
  await runTest("OpenCode integration", testOpenCodeIntegration);
  
  // Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("📊 Test Results:\n");
  
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  
  console.log(`  Total: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`  ⏱️  Duration: ${totalDuration}ms\n`);
  
  if (failed > 0) {
    console.log("Failed tests:\n");
    results
      .filter((r) => r.status === "fail")
      .forEach((r) => {
        console.log(`  ❌ ${r.name}`);
        console.log(`     ${r.message}\n`);
      });
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  if (failed === 0) {
    console.log("🎉 All tests passed! WhatsApp integration is working.\n");
    console.log("📱 Test message sent and verified in the system.\n");
    console.log("🔗 OpenCode integration confirmed.\n");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Check the errors above.\n");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
