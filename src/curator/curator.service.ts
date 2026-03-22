/**
 * Curator Service
 * 
 * The heart of the insight promotion pipeline.
 */

import {
  type CuratorDecision,
  DEFAULT_CURATOR_CONFIG,
  type CuratorConfig,
  type Neo4jInsight,
  type NotionInsightRecord,
  type PromotionCandidate,
} from "./types";
import { canPromoteInsight, checkDuplicate } from "./dedupe";
import { getDisplayTag, validateCanonicalTag } from "./tag-utils";
import {
  createDefaultReproducibilityInfo,
  createFiveLayerADRBuilder,
  createPostgreSQLStorage,
  initializeADRTables,
} from "@/lib/adr";
import type { SessionId } from "@/lib/budget/types";
import { createPromotionOrchestrator } from "./promotion-orchestrator";

export interface Neo4jClient {
  getPromotableInsights(limit?: number): Promise<Neo4jInsight[]>;
  markInsightPromoted(insightId: string, notionPageId: string): Promise<void>;
  markInsightApproved(insightId: string, approvedBy: string): Promise<void>;
  markInsightRejected(insightId: string, reason: string): Promise<void>;
  markInsightSuperseded(insightId: string, replacementInsightId: string, reason: string): Promise<void>;
  markInsightRevoked(insightId: string, reason: string): Promise<void>;
}

export interface NotionClient {
  createPage(payload: Record<string, unknown>): Promise<{ pageId: string }>;
  updatePage(payload: Record<string, unknown>): Promise<void>;
  findExistingInsights(canonicalTag?: string): Promise<NotionInsightRecord[]>;
  getPageBySourceInsightId(sourceInsightId: string): Promise<NotionInsightRecord | null>;
  listApprovedInsights?(): Promise<NotionInsightRecord[]>;
  findApprovedDuplicateGroups?(): Promise<
    Array<{
      identityType: "source_insight_id" | "canonical_tag";
      identityValue: string;
      records: NotionInsightRecord[];
      canonical: NotionInsightRecord;
    }>
  >;
  cleanupApprovedDuplicates?(): Promise<{
    groupsFound: number;
    archivedCount: number;
    canonicalPageIds: string[];
    archivedPageIds: string[];
    ambiguousRecords: string[];
    failedPageIds: string[];
  }>;
  getInsightsDatabasePropertyNames(): Promise<Set<string>>;
}

export interface PostgresClient {
  logCuratorDecision(decision: CuratorDecision): Promise<void>;
}

export class CuratorService {
  private config: CuratorConfig;
  private runSessionId: SessionId | null = null;
  private adrInitialized = false;

  constructor(
    private readonly neo4jClient: Neo4jClient,
    private readonly notionClient: NotionClient,
    private readonly postgresClient: PostgresClient,
    config?: Partial<CuratorConfig>
  ) {
    this.config = { ...DEFAULT_CURATOR_CONFIG, ...config };
  }

  async run(): Promise<CuratorDecision[]> {
    console.log("[Curator] Starting promotion run...");

    this.runSessionId = {
      groupId: "memory",
      agentId: "curator-service",
      sessionId: `curator-${Date.now()}`,
    };

    const insights = await this.neo4jClient.getPromotableInsights(this.config.batchSize);
    console.log(`[Curator] Found ${insights.length} candidate insights`);

    const existingNotionInsights = await this.notionClient.findExistingInsights();
    const supportedProperties = await this.notionClient.getInsightsDatabasePropertyNames();
    console.log(`[Curator] Found ${existingNotionInsights.length} existing insights in Notion`);

    const decisions: CuratorDecision[] = [];

    for (const insight of insights) {
      const decision = await this.processInsight(insight, existingNotionInsights, supportedProperties);
      decisions.push(decision);

      await this.postgresClient.logCuratorDecision(decision);
      await this.recordDecisionADR(insight, decision);

      console.log(`[Curator] ${insight.id}: ${decision.action} - ${decision.reason}`);
    }

    console.log(`[Curator] Promotion run complete. Processed ${decisions.length} insights.`);
    this.logSummary(decisions);

    return decisions;
  }

  private async processInsight(
    insight: Neo4jInsight,
    existingNotionInsights: NotionInsightRecord[],
    supportedProperties: Set<string>,
  ): Promise<CuratorDecision> {
    try {
      const validationError = this.validateInsight(insight);
      if (validationError) {
        return {
          insightId: insight.id,
          action: "blocked",
          reason: validationError,
          groupId: insight.canonicalTag,
          timestamp: new Date().toISOString()
        };
      }

      const dedupeResult = await checkDuplicate(insight, existingNotionInsights, this.config.dedupeThreshold);
      if (dedupeResult.shouldBlock) {
        return {
          insightId: insight.id,
          action: "duplicate",
          reason: dedupeResult.reason ?? "Duplicate insight",
          notionPageId: dedupeResult.existingPageId,
          duplicateReview: dedupeResult.reviewContext,
          groupId: insight.canonicalTag,
          timestamp: new Date().toISOString()
        };
      }

      const candidate = this.toPromotionCandidate(insight);
      const orchestrator = createPromotionOrchestrator();
      const payload = orchestrator.buildPromotionPayload(
        candidate.insight,
        candidate.displayTag,
        dedupeResult.reviewContext,
        supportedProperties,
      );
      const result = await this.notionClient.createPage(payload);

      await this.neo4jClient.markInsightPromoted(insight.id, result.pageId);

      return {
        insightId: insight.id,
        action: "promoted",
        reason: dedupeResult.reviewContext?.recommendation ?? "Insight promoted to Notion for human review",
        notionPageId: result.pageId,
        duplicateReview: dedupeResult.reviewContext,
        groupId: insight.canonicalTag,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        insightId: insight.id,
        action: "error",
        reason: error instanceof Error ? error.message : "Unknown error",
        groupId: insight.canonicalTag,
        timestamp: new Date().toISOString()
      };
    }
  }

  private validateInsight(insight: Neo4jInsight): string | null {
    const promotionCheck = canPromoteInsight(insight);
    if (!promotionCheck.canPromote) {
      return promotionCheck.reason ?? "Unknown promotion block";
    }

    try {
      validateCanonicalTag(insight.canonicalTag);
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid canonical tag";
    }

    return null;
  }

  private toPromotionCandidate(insight: Neo4jInsight): PromotionCandidate {
    const canonicalTag = validateCanonicalTag(insight.canonicalTag);
    const displayTag = getDisplayTag(canonicalTag);

    if (!displayTag) {
      throw new Error(`Missing display tag mapping for canonical tag: ${canonicalTag}`);
    }

    return {
      insight: {
        ...insight,
        canonicalTag
      },
      displayTag
    };
  }

  private async recordDecisionADR(
    insight: Neo4jInsight,
    decision: CuratorDecision,
  ): Promise<void> {
    if (!this.runSessionId) {
      return;
    }

    if (!decision.duplicateReview) {
      return;
    }

    if (!this.adrInitialized) {
      await initializeADRTables();
      this.adrInitialized = true;
    }

    const builder = createFiveLayerADRBuilder(createPostgreSQLStorage());
    const reproducibility = createDefaultReproducibilityInfo();
    reproducibility.model.provider = "curator";
    reproducibility.model.modelId = decision.duplicateReview.evaluatorVersion;
    reproducibility.model.modelVersion = decision.duplicateReview.evaluatorVersion;
    reproducibility.prompt.promptId = "duplicate-review";
    reproducibility.prompt.promptVersion = "v1";

    await builder.start({
      groupId: insight.canonicalTag,
      sessionId: this.runSessionId,
      actionType: "decision_made",
      reproducibility,
    });

    builder.setAction(
      {
        insightId: insight.id,
        summary: insight.summary,
        duplicateDecision: decision.duplicateReview.decision,
      },
      {
        action: decision.action,
        recommendation: decision.duplicateReview.recommendation,
        topMatchId: decision.duplicateReview.topMatch?.id ?? null,
      },
      "success",
      0,
    );

    builder.setContext(
      {
        sessionId: this.runSessionId,
        currentStep: 1,
        totalSteps: 1,
        budgetRemaining: {
          tokensRemaining: 0,
          toolCallsRemaining: 0,
          timeRemainingMs: 0,
          costRemainingUsd: 0,
        },
        activePolicies: ["duplicate-review", "brooks-story-first"],
      },
      [{
        goalId: "governed-promotion",
        description: "Promote only trustworthy insights with duplicate-aware review context",
        priority: 1,
        status: "active",
      }],
      [{
        constraintId: "story-first",
        type: "hard",
        description: "BMAD stories gate Ralph loop execution",
        value: true,
        source: "Brooks principle",
      }],
      [{
        optionId: "promote",
        description: "Promote insight with review context",
        estimatedCost: 1,
        estimatedDuration: 1,
        riskLevel: "medium",
      }],
      decision.action,
      { customFactors: { canonicalTag: insight.canonicalTag } },
    );

    builder.addThought(
      `Duplicate evaluator returned ${decision.duplicateReview.decision} for insight ${insight.id}.`,
      decision.reason,
    );

    builder.addEvidence(
      "data",
      "duplicate-review",
      {
        evaluatorVersion: decision.duplicateReview.evaluatorVersion,
        thresholds: decision.duplicateReview.thresholds,
        topMatch: decision.duplicateReview.topMatch,
        latencyMs: decision.duplicateReview.latencyMs,
        candidateCount: decision.duplicateReview.candidateCount,
      },
      0.95,
    );

    if (decision.duplicateReview.topMatch) {
      builder.rejectOption(
        "Promote without duplicate context",
        `Top match ${decision.duplicateReview.topMatch.id} scored ${decision.duplicateReview.topMatch.finalScore.toFixed(2)}`,
        ["duplicate-review"],
        true,
      );
    }

    builder.setConfidence(insight.confidence);
    builder.addHumanInteraction(
      "curator-service",
      "system",
      "review",
      `Recorded duplicate-review branch ${decision.duplicateReview.decision}`,
    );

    await builder.finalize();
  }

  private logSummary(decisions: CuratorDecision[]): void {
    const promoted = decisions.filter(d => d.action === "promoted").length;
    const duplicates = decisions.filter(d => d.action === "duplicate").length;
    const blocked = decisions.filter(d => d.action === "blocked").length;
    const errors = decisions.filter(d => d.action === "error").length;

    console.log(`[Curator] Summary: ${promoted} promoted, ${duplicates} duplicates, ${blocked} blocked, ${errors} errors`);
  }
}
