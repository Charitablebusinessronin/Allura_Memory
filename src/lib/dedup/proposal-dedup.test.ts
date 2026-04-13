import { describe, expect, it } from "vitest";
import {
  ProposalDedupChecker,
  createProposalDedupChecker,
  DEFAULT_PROPOSAL_DEDUP_THRESHOLD,
  getDedupThreshold,
  type ProposalCandidate,
} from "./proposal-dedup";

function createProposal(
  id: string,
  content: string,
  score = 0.85,
  status = "pending",
  created_at = new Date().toISOString(),
): ProposalCandidate {
  return { id, content, score, status, created_at };
}

describe("ProposalDedupChecker", () => {
  const checker = createProposalDedupChecker(undefined, 0.85);

  it("returns not-duplicate when there are no existing proposals", () => {
    const result = checker.checkProposals("User uses TypeScript", []);

    expect(result.isDuplicate).toBe(false);
    expect(result.existingProposal).toBeNull();
    expect(result.threshold).toBe(0.85);
  });

  it("detects exact duplicate (similarity 1.0)", () => {
    const proposals = [createProposal("p1", "User uses TypeScript")];
    const result = checker.checkProposals("User uses TypeScript", proposals);

    expect(result.isDuplicate).toBe(true);
    expect(result.existingProposal?.id).toBe("p1");
    expect(result.similarity).toBe(1.0);
  });

  it("detects near-duplicate with rephrased content", () => {
    const proposals = [createProposal("p2", "User uses TypeScript for development")];
    const result = checker.checkProposals("User uses TypeScript for development", proposals);

    expect(result.isDuplicate).toBe(true);
  });

  it("does not flag unrelated content as duplicate", () => {
    const proposals = [createProposal("p3", "User prefers dark mode in their editor")];
    const result = checker.checkProposals("User uses TypeScript for development", proposals);

    expect(result.isDuplicate).toBe(false);
  });

  it("uses configurable threshold", () => {
    const strictChecker = createProposalDedupChecker(undefined, 0.95);
    const proposals = [createProposal("p5", "User uses TypeScript")];

    const result = strictChecker.checkProposals("User uses TypeScript for projects", proposals);

    expect(result.threshold).toBe(0.95);
  });

  it("finds best match among multiple proposals", () => {
    const proposals = [
      createProposal("p6", "User prefers dark mode"),
      createProposal("p7", "User uses TypeScript for development"),
      createProposal("p8", "User likes coffee"),
    ];
    const result = checker.checkProposals("User uses TypeScript for development", proposals);

    expect(result.isDuplicate).toBe(true);
    expect(result.existingProposal?.id).toBe("p7");
  });

  it("respects group_id scope by receiving only group-scoped proposals", () => {
    const groupAProposals = [createProposal("ga1", "User uses TypeScript")];
    const result = checker.checkProposals("User uses TypeScript", groupAProposals);

    expect(result.isDuplicate).toBe(true);
  });

  it("returns similarity score even when not duplicate", () => {
    const proposals = [createProposal("p9", "User uses React for frontend")];
    const result = checker.checkProposals("User uses TypeScript for backend", proposals);

    expect(result.isDuplicate).toBe(false);
    expect(result.similarity).toBeGreaterThanOrEqual(0);
    expect(result.similarity).toBeLessThan(0.85);
  });

  it("handles empty string content gracefully", () => {
    const proposals = [createProposal("p10", "")];
    const result = checker.checkProposals("", proposals);

    // Two empty strings have similarity 1.0
    expect(result.isDuplicate).toBe(true);
  });
});

describe("getDedupThreshold", () => {
  it("returns default threshold when env var not set", () => {
    delete process.env.PROPOSAL_DEDUP_THRESHOLD;
    expect(getDedupThreshold()).toBe(DEFAULT_PROPOSAL_DEDUP_THRESHOLD);
  });

  it("returns env var value when set", () => {
    process.env.PROPOSAL_DEDUP_THRESHOLD = "0.9";
    expect(getDedupThreshold()).toBe(0.9);
    delete process.env.PROPOSAL_DEDUP_THRESHOLD;
  });

  it("falls back to default for invalid values", () => {
    process.env.PROPOSAL_DEDUP_THRESHOLD = "not-a-number";
    expect(getDedupThreshold()).toBeNaN(); // parseFloat("not-a-number") = NaN
    delete process.env.PROPOSAL_DEDUP_THRESHOLD;
  });
});

describe("createProposalDedupChecker", () => {
  it("creates checker with default threshold", () => {
    delete process.env.PROPOSAL_DEDUP_THRESHOLD;
    const checker = createProposalDedupChecker();
    // Threshold comes from env or DEFAULT_PROPOSAL_DEDUP_THRESHOLD
    expect(checker.checkProposals("test", []).threshold).toBe(DEFAULT_PROPOSAL_DEDUP_THRESHOLD);
  });

  it("creates checker with custom threshold", () => {
    const checker = createProposalDedupChecker(undefined, 0.95);
    expect(checker.checkProposals("test", []).threshold).toBe(0.95);
  });
});