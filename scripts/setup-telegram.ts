#!/usr/bin/env bun
/**
 * Telegram Channel Setup for OpenClaw
 */

import { config } from "dotenv";
import { getPool } from "../src/lib/postgres/connection";

config();

const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_PORT || "3200", 10);

interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
}

async function saveChannelConfig(groupId: string, config: TelegramConfig): Promise<void> {
  const pool = getPool();
  
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

  await pool.query(`
    INSERT INTO openclaw_channels (group_id, channel_type, channel_name, config, status)
    VALUES ($1, 'telegram', 'default', $2, 'configured')
    ON CONFLICT (group_id, channel_type, channel_name) 
    DO UPDATE SET config = $2, status = 'configured', updated_at = NOW()
  `, [groupId, JSON.stringify(config)]);

  console.log(`   ✓ Telegram channel saved to database`);
  await pool.end();
}

async function testTelegramConnection(botToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json() as { ok: boolean; result?: { username: string } };
    
    if (data.ok && data.result) {
      console.log(`   ✓ Telegram Bot connected: @${data.result.username}`);
      return true;
    } else {
      console.warn(`   ⚠ Telegram API error`);
      return false;
    }
  } catch (error) {
    console.warn(`   ⚠ Telegram API test failed: ${(error as Error).message}`);
    return false;
  }
}

function printSetupInstructions(): void {
  console.log('\n🤖 Telegram Bot Setup Instructions\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('STEP 1: Create Telegram Bot\n');
  console.log('   1. Open Telegram and search for @BotFather');
  console.log('   2. Send /newbot');
  console.log('   3. Follow prompts to create bot');
  console.log('   4. Copy the bot token\n');
  
  console.log('STEP 2: Add to .env.local\n');
  console.log('   TELEGRAM_BOT_TOKEN=your_bot_token_here\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main(): Promise<void> {
  const groupId = process.env.DEFAULT_GROUP_ID || "allura-production";
  
  console.log("\n🤖 Telegram Channel Setup for OpenClaw\n");
  console.log(`   Group: ${groupId}`);
  console.log(`   Gateway: http://localhost:${OPENCLAW_PORT}\n`);

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.log("⚠️  Telegram bot token not found in environment.\n");
    printSetupInstructions();
    console.log("Skipping Telegram setup for now.\n");
    process.exit(0);
  }

  console.log("✅ Telegram bot token found\n");

  console.log("🔌 Testing Telegram Bot API connection...");
  const connected = await testTelegramConnection(botToken);

  const config: TelegramConfig = {
    botToken,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || `http://localhost:${OPENCLAW_PORT}/webhook/telegram`,
  };

  console.log("\n💾 Saving Telegram channel configuration...");
  await saveChannelConfig(groupId, config);

  console.log("\n📡 Webhook Configuration:");
  console.log(`   URL: ${config.webhookUrl}\n`);

  const pool = getPool();
  await pool.query(`
    INSERT INTO events (event_type, group_id, agent_id, status, metadata)
    VALUES ('CHANNEL_ACTIVATED', $1, 'openclaw-gateway', 'completed', $2)
  `, [
    groupId,
    JSON.stringify({
      channel: 'telegram',
      status: connected ? 'active' : 'pending',
      timestamp: new Date().toISOString(),
    }),
  ]);
  await pool.end();

  console.log("✅ Telegram channel setup complete!\n");
}

main().catch((error) => {
  console.error("\n❌ Setup failed:", error.message);
  process.exit(1);
});