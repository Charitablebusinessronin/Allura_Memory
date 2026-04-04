#!/usr/bin/env bun
/**
 * Setup Mission Control - Automate board and agent creation
 */

const MISSION_CONTROL_API = "http://localhost:8000";
const AUTH_TOKEN = process.env.MISSION_CONTROL_TOKEN || "5KsX6-7qREpWKrxUFpKP9NEFW2RP2ByjVP-xxG0EcsQDzIiqFgFAcfMfMoSfnNUal4E";

const headers = {
  "Authorization": `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
};

async function getOrganization(): Promise<{ id: string; name: string } | null> {
  const res = await fetch(`${MISSION_CONTROL_API}/organizations`, { headers });
  if (!res.ok) {
    console.error("Failed to get organizations:", await res.text());
    return null;
  }
  const data = await res.json();
  return data.items?.[0] || null;
}

async function getBoardGroups(orgId: string): Promise<any[]> {
  const res = await fetch(`${MISSION_CONTROL_API}/board-groups?organization_id=${orgId}`, { headers });
  if (!res.ok) {
    console.error("Failed to get board groups:", await res.text());
    return [];
  }
  const data = await res.json();
  return data.items || [];
}

async function createBoard(orgId: string, boardGroupId: string, name: string, description: string): Promise<any> {
  const res = await fetch(`${MISSION_CONTROL_API}/boards`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      description,
      board_type: "goal",
      board_group_id: boardGroupId,
      require_approval_for_done: true,
      max_agents: 5,
    }),
  });
  if (!res.ok) {
    console.error(`Failed to create board ${name}:`, await res.text());
    return null;
  }
  return await res.json();
}

async function createGateway(name: string, url: string): Promise<any> {
  const res = await fetch(`${MISSION_CONTROL_API}/gateways`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      endpoint_url: url,
      gateway_type: "mcp",
      status: "active",
    }),
  });
  if (!res.ok) {
    console.error("Failed to create gateway:", await res.text());
    return null;
  }
  return await res.json();
}

async function main() {
  console.log("🚀 Setting up Mission Control...\n");

  const org = await getOrganization();
  if (!org) {
    console.error("❌ No organization found");
    process.exit(1);
  }
  console.log(`✅ Organization: ${org.name} (${org.id})`);

  const boardGroups = await getBoardGroups(org.id);
  const researchGroup = boardGroups.find((bg: any) => bg.name.includes("Research"));
  
  if (!researchGroup) {
    console.error("❌ Research Queue & ADAS Discoveries group not found");
    process.exit(1);
  }
  console.log(`✅ Board Group: ${researchGroup.name} (${researchGroup.id})`);

  console.log("\n📋 Creating boards...");
  const researchQueue = await createBoard(
    org.id,
    researchGroup.id,
    "Research Queue",
    "Pending research tasks and discoveries awaiting processing"
  );
  if (researchQueue) console.log(`  ✅ Research Queue: ${researchQueue.id}`);

  const adasDiscoveries = await createBoard(
    org.id,
    researchGroup.id,
    "ADAS Discoveries",
    "Automated Design of Agentic Systems - discovered agent designs"
  );
  if (adasDiscoveries) console.log(`  ✅ ADAS Discoveries: ${adasDiscoveries.id}`);

  console.log("\n🔌 Connecting gateway...");
  const gateway = await createGateway(
    "Ronin Memory Gateway",
    "http://openclaw-gateway:3002"
  );
  if (gateway) console.log(`  ✅ Gateway: ${gateway.id}`);

  console.log("\n🎉 Mission Control setup complete!");
  console.log("\nNext steps:");
  console.log("  1. Go to http://localhost:3000");
  console.log("  2. Navigate to Agents");
  console.log("  3. Create agent from YAML: agents/ronin-researcher.yaml");
}

main().catch(console.error);
