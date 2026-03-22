import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  validateTransition,
  getValidTransitions,
  isTerminalStatus,
  canBeRevoked,
  canBeSuperseded,
  canBeApproved,
  canBeRejected,
  getLifecycleDescription,
} from "./lifecycle-validator";

describe("Lifecycle Validator", () => {
  describe("isValidTransition", () => {
    it("allows Proposed → Pending Review", () => {
      expect(isValidTransition("Proposed", "Pending Review")).toBe(true);
    });

    it("allows Pending Review → Approved", () => {
      expect(isValidTransition("Pending Review", "Approved")).toBe(true);
    });

    it("allows Pending Review → Rejected", () => {
      expect(isValidTransition("Pending Review", "Rejected")).toBe(true);
    });

    it("allows Pending Review → Superseded", () => {
      expect(isValidTransition("Pending Review", "Superseded")).toBe(true);
    });

    it("allows Approved → Superseded", () => {
      expect(isValidTransition("Approved", "Superseded")).toBe(true);
    });

    it("allows Approved → Revoked", () => {
      expect(isValidTransition("Approved", "Revoked")).toBe(true);
    });

    it("blocks Proposed → Approved (must go through Pending Review)", () => {
      expect(isValidTransition("Proposed", "Approved")).toBe(false);
    });

    it("blocks Proposed → Rejected", () => {
      expect(isValidTransition("Proposed", "Rejected")).toBe(false);
    });

    it("blocks Proposed → Revoked", () => {
      expect(isValidTransition("Proposed", "Revoked")).toBe(false);
    });

    it("blocks Proposed → Superseded", () => {
      expect(isValidTransition("Proposed", "Superseded")).toBe(false);
    });

    it("blocks Approved → Rejected", () => {
      expect(isValidTransition("Approved", "Rejected")).toBe(false);
    });

    it("blocks Approved → Pending Review", () => {
      expect(isValidTransition("Approved", "Pending Review")).toBe(false);
    });

    it("blocks Rejected → any state (terminal)", () => {
      expect(isValidTransition("Rejected", "Approved")).toBe(false);
      expect(isValidTransition("Rejected", "Pending Review")).toBe(false);
      expect(isValidTransition("Rejected", "Revoked")).toBe(false);
    });

    it("blocks Superseded → any state (terminal)", () => {
      expect(isValidTransition("Superseded", "Approved")).toBe(false);
      expect(isValidTransition("Superseded", "Pending Review")).toBe(false);
      expect(isValidTransition("Superseded", "Revoked")).toBe(false);
    });

    it("blocks Revoked → any state (terminal)", () => {
      expect(isValidTransition("Revoked", "Approved")).toBe(false);
      expect(isValidTransition("Revoked", "Pending Review")).toBe(false);
      expect(isValidTransition("Revoked", "Proposed")).toBe(false);
    });
  });

  describe("validateTransition", () => {
    it("passes for valid transitions", () => {
      expect(() => validateTransition("Proposed", "Pending Review")).not.toThrow();
      expect(() => validateTransition("Pending Review", "Approved")).not.toThrow();
      expect(() => validateTransition("Approved", "Revoked")).not.toThrow();
    });

    it("throws for invalid transitions with helpful message", () => {
      expect(() => validateTransition("Proposed", "Revoked")).toThrow(
        /Invalid transition.*Proposed.*Revoked/
      );
    });

    it("throws for terminal state transitions", () => {
      expect(() => validateTransition("Rejected", "Approved")).toThrow(
        /terminal state/
      );
    });

    it("includes valid transitions in error message", () => {
      expect(() => validateTransition("Proposed", "Revoked")).toThrow(
        /Pending Review/
      );
    });
  });

  describe("getValidTransitions", () => {
    it("returns Pending Review for Proposed", () => {
      expect(getValidTransitions("Proposed")).toEqual(["Pending Review"]);
    });

    it("returns Approved, Rejected, Superseded for Pending Review", () => {
      expect(getValidTransitions("Pending Review")).toEqual([
        "Approved",
        "Rejected",
        "Superseded",
      ]);
    });

    it("returns Superseded, Revoked for Approved", () => {
      expect(getValidTransitions("Approved")).toEqual(["Superseded", "Revoked"]);
    });

    it("returns empty array for terminal states", () => {
      expect(getValidTransitions("Rejected")).toEqual([]);
      expect(getValidTransitions("Superseded")).toEqual([]);
      expect(getValidTransitions("Revoked")).toEqual([]);
    });
  });

  describe("isTerminalStatus", () => {
    it("identifies Rejected as terminal", () => {
      expect(isTerminalStatus("Rejected")).toBe(true);
    });

    it("identifies Superseded as terminal", () => {
      expect(isTerminalStatus("Superseded")).toBe(true);
    });

    it("identifies Revoked as terminal", () => {
      expect(isTerminalStatus("Revoked")).toBe(true);
    });

    it("identifies Proposed as non-terminal", () => {
      expect(isTerminalStatus("Proposed")).toBe(false);
    });

    it("identifies Pending Review as non-terminal", () => {
      expect(isTerminalStatus("Pending Review")).toBe(false);
    });

    it("identifies Approved as non-terminal", () => {
      expect(isTerminalStatus("Approved")).toBe(false);
    });
  });

  describe("canBeRevoked", () => {
    it("returns true for Approved", () => {
      expect(canBeRevoked("Approved")).toBe(true);
    });

    it("returns false for Proposed", () => {
      expect(canBeRevoked("Proposed")).toBe(false);
    });

    it("returns false for Pending Review", () => {
      expect(canBeRevoked("Pending Review")).toBe(false);
    });

    it("returns false for Rejected", () => {
      expect(canBeRevoked("Rejected")).toBe(false);
    });

    it("returns false for Superseded", () => {
      expect(canBeRevoked("Superseded")).toBe(false);
    });

    it("returns false for Revoked", () => {
      expect(canBeRevoked("Revoked")).toBe(false);
    });
  });

  describe("canBeSuperseded", () => {
    it("returns true for Pending Review", () => {
      expect(canBeSuperseded("Pending Review")).toBe(true);
    });

    it("returns true for Approved", () => {
      expect(canBeSuperseded("Approved")).toBe(true);
    });

    it("returns false for Proposed", () => {
      expect(canBeSuperseded("Proposed")).toBe(false);
    });

    it("returns false for Rejected", () => {
      expect(canBeSuperseded("Rejected")).toBe(false);
    });

    it("returns false for Superseded", () => {
      expect(canBeSuperseded("Superseded")).toBe(false);
    });

    it("returns false for Revoked", () => {
      expect(canBeSuperseded("Revoked")).toBe(false);
    });
  });

  describe("canBeApproved", () => {
    it("returns true for Pending Review", () => {
      expect(canBeApproved("Pending Review")).toBe(true);
    });

    it("returns false for Proposed", () => {
      expect(canBeApproved("Proposed")).toBe(false);
    });

    it("returns false for Approved", () => {
      expect(canBeApproved("Approved")).toBe(false);
    });

    it("returns false for Rejected", () => {
      expect(canBeApproved("Rejected")).toBe(false);
    });
  });

  describe("canBeRejected", () => {
    it("returns true for Pending Review", () => {
      expect(canBeRejected("Pending Review")).toBe(true);
    });

    it("returns false for Proposed", () => {
      expect(canBeRejected("Proposed")).toBe(false);
    });

    it("returns false for Approved", () => {
      expect(canBeRejected("Approved")).toBe(false);
    });

    it("returns false for Rejected", () => {
      expect(canBeRejected("Rejected")).toBe(false);
    });
  });

  describe("getLifecycleDescription", () => {
    it("returns a non-empty string", () => {
      const description = getLifecycleDescription();
      expect(typeof description).toBe("string");
      expect(description.length).toBeGreaterThan(0);
    });

    it("includes all lifecycle states", () => {
      const description = getLifecycleDescription();
      expect(description).toContain("Proposed");
      expect(description).toContain("Pending Review");
      expect(description).toContain("Approved");
      expect(description).toContain("Rejected");
      expect(description).toContain("Superseded");
      expect(description).toContain("Revoked");
    });
  });
});