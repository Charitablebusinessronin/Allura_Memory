// tests/opencode-registry/sync.test.ts

import { describe, it, expect } from "vitest";
import { syncRegistry } from "../../scripts/opencode-registry/sync";

describe("syncRegistry", () => {
  it.skip("should complete a full sync run (requires NOTION_API_KEY)", async () => {
    // Integration test — skipped by default.
    // Requires:
    //   1. NOTION_API_KEY set in environment
    //   2. Valid database IDs in .opencode/config/registry-databases.json
    //   3. Notion API access to the configured databases
    await syncRegistry({ dryRun: false, verbose: true });
  });

  it("should complete a dry-run without errors", async () => {
    // Dry-run still reads local files and config, but does not call Notion APIs.
    // This test verifies the extraction and normalization pipeline end-to-end.
    await syncRegistry({ dryRun: true, verbose: false });
  });
});
