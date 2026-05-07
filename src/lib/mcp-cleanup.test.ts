import { describe, expect, it, vi } from "vitest";

vi.mock("../mcp/canonical-tools/budget-circuit", () => ({
  resetHaltedGroup: vi.fn(),
}));

import { resetHaltedGroup } from "../mcp/canonical-tools/budget-circuit";
import { cleanupMemoryState } from "../mcp/cleanup";

describe("cleanupMemoryState", () => {
  it("resets halted sessions for a group and reports the count", () => {
    vi.mocked(resetHaltedGroup).mockReturnValue(3);

    expect(cleanupMemoryState("allura-test")).toEqual({
      group_id: "allura-test",
      cleared_sessions: 3,
    });
    expect(resetHaltedGroup).toHaveBeenCalledWith("allura-test");
  });

  it("resets all halted sessions when no group is given", () => {
    vi.mocked(resetHaltedGroup).mockReturnValue(7);

    expect(cleanupMemoryState()).toEqual({
      group_id: null,
      cleared_sessions: 7,
    });
    expect(resetHaltedGroup).toHaveBeenCalledWith(undefined);
  });
});
