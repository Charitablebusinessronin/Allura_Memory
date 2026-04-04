// scripts/opencode-registry/sync-registry-logger.ts

import type { NotionRegistryClient } from "../../src/lib/opencode-registry/notion-client";
import type { SyncRun } from "../../src/lib/opencode-registry/types";

export async function logSyncRun(client: NotionRegistryClient, run: SyncRun): Promise<void> {
  await client.createSyncRun(run);
}
