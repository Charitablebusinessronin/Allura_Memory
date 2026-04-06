#!/usr/bin/env bun
/**
 * WhatsApp Channel Setup for OpenClaw
 * 
 * Configures WhatsApp Business API integration with Allura Agent-OS
 */

import { config } from "dotenv";
import { getPool } from "../src/lib/postgres/connection";

config();

const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_PORT || "3200", 10);

interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  verifyToken: string;
  webhookUrl?: string;
}

async function saveChannelConfig(groupId: string, channel: string, config: WhatsAppConfig): Promise<void> {
  const pool = getPool();
  
  // Create channels table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS openclaw_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id TEXT NOT NULL,
      channel_type TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      config JSONB NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT valid_group_id CHECK (group_id ~ '^allura-'),
      UNIQUE(group_id, channel_type, channel_name)
    )
  `);

  // Insert or update channel config
  await pool.query(`
    INSERT INTO openclaw_channels (group_id, channel_type, channel_name, config, status)
    VALUES ($1, 'whatsapp', 'default', $2, 'configured')
    ON CONFLICT (group_id, channel_type, channel_name) 
    DO UPDATE SET config = $2, status = 'configured', updated_at = NOW()
  `, [groupId, JSON.stringify(config)]);

  console.log(`   ✓ WhatsApp channel saved to database`);
  await pool.end();
}

async function testWhatsAppConnection(config: WhatsAppConfig): Promise<boolean> {
  try {
    // Test WhatsApp Business API connection
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      }
    );

    if (response.ok) {
      console.log(`   ✓ WhatsApp Business API connected`);
      return true;
    } else {
      console.warn(`   ⚠ WhatsApp API response: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.warn(`   ⚠ WhatsApp API test failed: ${(error as Error).message}`);
    return false;
  }
}

async function getWebhookUrl(): Promise<string> {
  // Use OPENCLAW_PORT or default
  const port = OPENCLAW_PORT;
  const host = process.env.OPENCLAW_HOST || 'localhost';
  
  // For local development, use ngrok or similar tunnel
  const useTunnel = process.env.WHATSAPP_USE_TUNNEL === 'true';
  
  if (useTunnel) {
    console.log('\n📡 WhatsApp requires a public webhook URL for local development.');
    console.log('   Use ngrok or similar tunnel:\n');
    console.log('   1. Install: npm install -g ngrok');
    console.log('   2. Run: ngrok http 3200');
    console.log('   3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
    console.log('   4. Set WHATSAPP_WEBHOOK_URL in .env.local\n');
    return process.env.WHATSAPP_WEBHOOK_URL || '';
  }
  
  return `http://${host}:${port}/webhook/whatsapp`;
}

function printSetupInstructions(): void {
  console.log('\n📡 WhatsApp Business API Setup Instructions\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('STEP 1: Create Meta Business Account\n');
  console.log('   1. Go to: https://business.facebook.com/');
  console.log('   2. Create Business Account');
  console.log('   3. Verify your business\n');
  
  console.log('STEP 2: Set up WhatsApp Business API\n');
  console.log('   1. Go to: https://developers.facebook.com/');
  console.log('   2. Create App → Business → WhatsApp');
  console.log('   3. Add WhatsApp Business API product');
  console.log('   4. Generate permanent access token\n');
  
  console.log('STEP 3: Get Required Credentials\n');
  console.log('   From app dashboard, copy:');
  console.log('   • WhatsApp Business Account ID');
  console.log('   • Phone Number ID');
  console.log('   • Permanent Access Token');
  console.log('   • Verify Token (create your own)\n');
  
  console.log('STEP 4: Add to .env.local\n');
  console.log('   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id');
  console.log('   WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id');
  console.log('   WHATSAPP_ACCESS_TOKEN=your_permanent_access_token');
  console.log('   WHATSAPP_VERIFY_TOKEN=your_custom_verify_token\n');
  
  console.log('STEP 5: Configure Webhook (Production)\n');
  console.log('   For production, set:');
  console.log('   WHATSAPP_WEBHOOK_URL=https://your-domain.com/webhook/whatsapp\n');
  
  console.log('STEP 6: Test Webhook (Local Development)\n');
  console.log('   For local testing, use ngrok:');
  console.log('   npm install -g ngrok');
  console.log('   ngrok http 3200');
  console.log('   # Copy HTTPS URL to WHATSAPP_WEBHOOK_URL\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main(): Promise<void> {
  const groupId = process.env.DEFAULT_GROUP_ID || "allura-production";
  
  console.log("\n📱 WhatsApp Channel Setup for OpenClaw\n");
  console.log(`   Group: ${groupId}`);
  console.log(`   Gateway: http://localhost:${OPENCLAW_PORT}\n`);

  // Check for environment variables
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!phoneNumberId || !businessAccountId || !accessToken || !verifyToken) {
    console.log("⚠️  WhatsApp credentials not found in environment.\n");
    printSetupInstructions();
    
    console.log("Skipping WhatsApp setup for now.");
    console.log("Run this command again after adding credentials to .env.local\n");
    process.exit(0);
  }

  console.log("✅ WhatsApp credentials found\n");

  // Test connection
  console.log("🔌 Testing WhatsApp Business API connection...");
  const config: WhatsAppConfig = {
    phoneNumberId,
    businessAccountId,
    accessToken,
    verifyToken,
    webhookUrl: await getWebhookUrl(),
  };

  const connected = await testWhatsAppConnection(config);

  // Save to database
  console.log("\n💾 Saving WhatsApp channel configuration...");
  await saveChannelConfig(groupId, 'whatsapp', config);

  // Add webhook endpoint to OpenClaw
  console.log("\n📡 Webhook Configuration:");
  console.log(`   URL: ${config.webhookUrl || 'Set WHATSAPP_WEBHOOK_URL'}`);
  console.log(`   Verify Token: ${verifyToken.slice(0, 8)}...\n`);

  // Log channel activation event
  console.log("📝 Logging channel activation...");
  const pool = getPool();
  await pool.query(`
    INSERT INTO events (event_type, group_id, agent_id, status, metadata)
    VALUES ('CHANNEL_ACTIVATED', $1, 'openclaw-gateway', 'completed', $2)
  `, [
    groupId,
    JSON.stringify({
      channel: 'whatsapp',
      phone_number_id: phoneNumberId.slice(0, 8) + '...',
      status: connected ? 'active' : 'pending',
      timestamp: new Date().toISOString(),
    }),
  ]);
  await pool.end();

  console.log("\n✅ WhatsApp channel setup complete!\n");
  
  console.log("🚀 Next Steps:\n");
  if (!connected) {
    console.log("   1. Verify your WhatsApp Business API credentials");
    console.log("   2. Set up webhook URL in Meta Business Suite");
  }
  console.log("   3. Start OpenClaw gateway: bun run mcp:http");
  console.log("   4. Test webhook: curl http://localhost:3200/webhook/whatsapp\n");
}

main().catch((error) => {
  console.error("\n❌ Setup failed:", error.message);
  process.exit(1);
});