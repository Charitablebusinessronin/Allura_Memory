import { describe, expect, it, vi } from "vitest";

vi.mock("../mcp/canonical-tools/budget-circuit", () => ({
  resetHaltedGroup: vi.fn(),
}));

import { resetHaltedGroup } from "../mcp/canonical-tools/budget-circuit";
import { cleanupMemoryState } from "../mcp/cleanup";

const mockResetHaltedGroup = resetHaltedGroup as unknown as ReturnType<typeof vi.fn>;

describe("cleanupMemoryState", () => {
  it("resets halted sessions for a group and reports the count", () => {
    mockResetHaltedGroup.mockReturnValue(3);

    expect(cleanupMemoryState("allura-test")).toEqual({
      group_id: "allura-test",
      cleared_sessions: 3,
    });
    expect(resetHaltedGroup).toHaveBeenCalledWith("allura-test");
  });

  it("resets all halted sessions when no group is given", () => {
    mockResetHaltedGroup.mockReturnValue(7);

    expect(cleanupMemoryState()).toEqual({
      group_id: null,
      cleared_sessions: 7,
    });
    expect(resetHaltedGroup).toHaveBeenCalledWith(undefined);
  });
});
