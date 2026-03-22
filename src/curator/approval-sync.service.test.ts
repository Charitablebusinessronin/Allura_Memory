import { describe, it, expect, vi } from "vitest";

import { ApprovalSyncService } from "./approval-sync.service";

describe("ApprovalSyncService duplicate cleanup", () => {
  it("delegates duplicate cleanup to notion client", async () => {
    const cleanupResult = {
      groupsFound: 2,
      archivedCount: 3,
      canonicalPageIds: ["a", "b"],
      archivedPageIds: ["c", "d", "e"],
      ambiguousRecords: ["x"],
      failedPageIds: [],
    };

    const notionClient = {
      cleanupApprovedDuplicates: vi.fn().mockResolvedValue(cleanupResult),
    };

    const neo4jClient = {};
    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    const result = await service.cleanupApprovedDuplicateInsights();

    expect(notionClient.cleanupApprovedDuplicates).toHaveBeenCalledTimes(1);
    expect(result).toEqual(cleanupResult);
  });

  it("throws when notion client lacks cleanup support", async () => {
    const service = new ApprovalSyncService({} as any, {} as any);

    await expect(service.cleanupApprovedDuplicateInsights()).rejects.toThrow(
      "Notion client does not support duplicate cleanup",
    );
  });
});

describe("ApprovalSyncService supersede lineage", () => {
  it("writes Notion supersede update and Neo4j SUPERSEDES mutation", async () => {
    const notionClient = {
      getPageBySourceInsightId: vi
        .fn()
        .mockResolvedValueOnce({ pageId: 'old-page', status: 'Pending Review' })
        .mockResolvedValueOnce({ pageId: 'replacement-page' }),
      getInsightsDatabasePropertyNames: vi.fn().mockResolvedValue(new Set(['Duplicate Of', 'Rationale'])),
      updatePage: vi.fn().mockResolvedValue(undefined),
    };

    const neo4jClient = {
      markInsightSuperseded: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    await service.supersedeInsight('old-insight', 'replacement-insight', 'Merged into newer approved insight');

    expect(notionClient.updatePage).toHaveBeenCalledTimes(1);
    expect(neo4jClient.markInsightSuperseded).toHaveBeenCalledWith(
      'old-insight',
      'replacement-insight',
      'Merged into newer approved insight',
    );
  });
});

describe("ApprovalSyncService revoke lifecycle", () => {
  it("writes Notion revoke update and Neo4j revoke mutation", async () => {
    const notionClient = {
      getPageBySourceInsightId: vi.fn().mockResolvedValue({ pageId: 'revoked-page', status: 'Approved', aiAccessible: true, approvedBy: 'Sabir' }),
      getInsightsDatabasePropertyNames: vi.fn().mockResolvedValue(new Set(['Rationale', 'Revoked By', 'Revoked At'])),
      updatePage: vi.fn().mockResolvedValue(undefined),
    };

    const neo4jClient = {
      markInsightRevoked: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    await service.revokeInsight('revoked-insight', 'Incorrect policy promotion', 'Sabir');

    expect(notionClient.updatePage).toHaveBeenCalledTimes(1);
    expect(neo4jClient.markInsightRevoked).toHaveBeenCalledWith(
      'revoked-insight',
      'Incorrect policy promotion',
    );
  });

  it("refuses to revoke non-approved insights", async () => {
    const notionClient = {
      getPageBySourceInsightId: vi.fn().mockResolvedValue({ pageId: 'pending-page', status: 'Pending Review', aiAccessible: false }),
      getInsightsDatabasePropertyNames: vi.fn().mockResolvedValue(new Set(['Rationale'])),
      updatePage: vi.fn().mockResolvedValue(undefined),
    };

    const neo4jClient = {
      markInsightRevoked: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    await expect(service.revokeInsight('pending-insight', 'Not approved yet')).rejects.toThrow(
      /Cannot revoke insight.*current status is 'Pending Review'.*Only 'Approved' insights can be revoked/,
    );
    expect(neo4jClient.markInsightRevoked).not.toHaveBeenCalled();
  });

  it("refuses to revoke already-revoked insights", async () => {
    const notionClient = {
      getPageBySourceInsightId: vi.fn().mockResolvedValue({ pageId: 'already-revoked', status: 'Revoked', aiAccessible: false }),
      getInsightsDatabasePropertyNames: vi.fn().mockResolvedValue(new Set(['Rationale'])),
    };

    const neo4jClient = {
      markInsightRevoked: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    await expect(service.revokeInsight('already-revoked', 'Double revoke')).rejects.toThrow(
      /Cannot revoke insight.*current status is 'Revoked'.*none \(terminal state\)/,
    );
    expect(neo4jClient.markInsightRevoked).not.toHaveBeenCalled();
  });

  it("refuses to revoke rejected insights", async () => {
    const notionClient = {
      getPageBySourceInsightId: vi.fn().mockResolvedValue({ pageId: 'rejected-page', status: 'Rejected', aiAccessible: false }),
      getInsightsDatabasePropertyNames: vi.fn().mockResolvedValue(new Set(['Rationale'])),
    };

    const neo4jClient = {
      markInsightRevoked: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    await expect(service.revokeInsight('rejected-insight', 'Trying to revoke')).rejects.toThrow(
      /Cannot revoke insight.*current status is 'Rejected'.*none \(terminal state\)/,
    );
    expect(neo4jClient.markInsightRevoked).not.toHaveBeenCalled();
  });

  it.todo("refuses to approve already-approved insights (requires Neo4j integration)");

  it("refuses to reject already-rejected insights", async () => {
    const notionClient = {
      getPageBySourceInsightId: vi.fn().mockResolvedValue({ pageId: 'already-rejected', status: 'Rejected' }),
      getInsightsDatabasePropertyNames: vi.fn().mockResolvedValue(new Set(['Rationale'])),
    };

    const neo4jClient = {
      markInsightRejected: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    await expect(service.rejectInsight('already-rejected', 'Double reject')).rejects.toThrow(
      /Cannot reject insight.*current status is 'Rejected'.*none \(terminal state\)/,
    );
    expect(neo4jClient.markInsightRejected).not.toHaveBeenCalled();
  });

  it("refuses to supersede already-superseded insights", async () => {
    const notionClient = {
      getPageBySourceInsightId: vi.fn().mockResolvedValue({ pageId: 'already-superseded', status: 'Superseded' }),
      getInsightsDatabasePropertyNames: vi.fn().mockResolvedValue(new Set(['Rationale'])),
    };

    const neo4jClient = {
      markInsightSuperseded: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ApprovalSyncService(notionClient as any, neo4jClient as any);

    await expect(service.supersedeInsight('already-superseded', 'new-insight', 'Trying to supersede')).rejects.toThrow(
      /Cannot supersede insight.*current status is 'Superseded'.*none \(terminal state\)/,
    );
    expect(neo4jClient.markInsightSuperseded).not.toHaveBeenCalled();
  });
});
