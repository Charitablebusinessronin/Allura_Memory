/**
 * Notion Client
 * 
 * Integration layer for Notion via MCP tools.
 * Uses the existing notion-* tools from memory-server.ts via Smithery.
 */

import { NotionInsightRecord } from "../curator/types";
import { INSIGHTS_DATABASE_ID } from "../curator/config";
import { McpToolCaller } from "./mcp.client";

export interface NotionClient {
  createPage(payload: Record<string, unknown>): Promise<{ pageId: string }>;
  updatePage(payload: Record<string, unknown>): Promise<void>;
  findExistingInsights(canonicalTag?: string): Promise<NotionInsightRecord[]>;
  getPageBySourceInsightId(sourceInsightId: string): Promise<NotionInsightRecord | null>;
  listApprovedInsights(): Promise<NotionInsightRecord[]>;
  findApprovedDuplicateGroups(): Promise<ApprovedDuplicateGroup[]>;
  cleanupApprovedDuplicates(): Promise<ApprovedDuplicateCleanupResult>;
  getInsightsDatabasePropertyNames(): Promise<Set<string>>;
}

export type ApprovedDuplicateIdentityType = "source_insight_id" | "canonical_tag";

export interface ApprovedDuplicateGroup {
  identityType: ApprovedDuplicateIdentityType;
  identityValue: string;
  records: NotionInsightRecord[];
  canonical: NotionInsightRecord;
}

export interface ApprovedDuplicateCleanupResult {
  groupsFound: number;
  archivedCount: number;
  canonicalPageIds: string[];
  archivedPageIds: string[];
  ambiguousRecords: string[];
  failedPageIds: string[];
}

type NotionCreatePageResponse = {
  pages?: Array<{ id: string; url: string; properties?: Record<string, any> }>;
  id?: string;
  pageId?: string;
};

type NotionFetchResponse = {
  content?: Array<{ type: string; text: string }>;
  results?: Array<Record<string, unknown>>;
  properties?: Record<string, any>;
};

/**
 * Notion Client Implementation
 * 
 * Calls Notion tools via MCP (Smithery)
 */
export class NotionClientImpl implements NotionClient {
  private propertyNameCache: Set<string> | null = null;
  constructor(
    private readonly mcp: McpToolCaller,
    private readonly insightsDatabaseId: string = INSIGHTS_DATABASE_ID
  ) {}

  async createPage(payload: Record<string, unknown>): Promise<{ pageId: string }> {
    // Use notion-create-pages (plural) as per Smithery tool
    const result = await this.mcp.callTool<NotionCreatePageResponse>(
      "notion-create-pages",
      payload
    );

    // Handle response format - result is the parsed JSON from Smithery
    console.log("[NotionClient] createPage result:", JSON.stringify(result, null, 2));
    
    // Check for pages array
    if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
      return { pageId: result.pages[0].id };
    }

    // Check for direct id
    const pageId = (result as any).pageId ?? (result as any).id;
    if (pageId) {
      return { pageId };
    }

    // Check for nested content
    if ((result as any).content?.[0]?.text) {
      try {
        const nested = JSON.parse((result as any).content[0].text);
        if (nested.pages?.[0]?.id) {
          return { pageId: nested.pages[0].id };
        }
        if (nested.id) {
          return { pageId: nested.id };
        }
      } catch {
        // Not JSON
      }
    }

    throw new Error(`notion-create-pages did not return a page id: ${JSON.stringify(result)}`);
  }

  async updatePage(payload: Record<string, unknown>): Promise<void> {
    await this.mcp.callTool<void>(
      "notion-update-page",
      payload
    );
  }

  async findExistingInsights(canonicalTag?: string): Promise<NotionInsightRecord[]> {
    // Build filter for Approved or Pending Review status
    const filter: any = {
      or: [
        { property: "Status", select: { equals: "Approved" } },
        { property: "Status", select: { equals: "Pending Review" } }
      ]
    };

    if (canonicalTag) {
      filter.and = [
        { property: "Canonical Tag", rich_text: { equals: canonicalTag } }
      ];
    }

    const result = await this.mcp.callTool<NotionFetchResponse>(
      "notion-fetch",
      {
        id: this.insightsDatabaseId,
        filter
      }
    );

    // Parse response
    const content = result.content?.[0]?.text;
    if (!content) {
      return [];
    }

    try {
      const data = JSON.parse(content);
      const rows = data.results || [];
      return rows.map((row: any) => this.mapInsightRow(row)).filter(Boolean) as NotionInsightRecord[];
    } catch {
      return [];
    }
  }

  async getPageBySourceInsightId(sourceInsightId: string): Promise<NotionInsightRecord | null> {
    // First try to find by searching all insights
    const result = await this.mcp.callTool<NotionFetchResponse>(
      "notion-fetch",
      {
        id: this.insightsDatabaseId
      }
    );

    const content = result.content?.[0]?.text;
    if (!content) {
      return null;
    }

    try {
      const data = JSON.parse(content);
      const pages = data.results || [];
      
      // Search for matching source insight ID in content
      for (const page of pages) {
        const record = this.mapInsightRow(page);
        if (!record) continue;
        // Check if Source Insight ID is in the content
        if (record.sourceInsightId === sourceInsightId) {
          return record;
        }
        // Also check in raw page content
        const pageContent = page.content || "";
        if (pageContent.includes(`| Source Insight ID | ${sourceInsightId} |`)) {
          return record;
        }
        // Check in URL (page ID is in the URL)
        if (page.url && page.url.includes(sourceInsightId)) {
          return record;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  async listApprovedInsights(): Promise<NotionInsightRecord[]> {
    const records = await this.findExistingInsights();
    return records.filter((record) =>
      record.reviewStatus === "Completed" && record.aiAccessible === true,
    );
  }

  async findApprovedDuplicateGroups(approvedRecordsInput?: NotionInsightRecord[]): Promise<ApprovedDuplicateGroup[]> {
    const approvedRecords = approvedRecordsInput ?? (await this.listApprovedInsights());
    const groupsByIdentity = new Map<string, { type: ApprovedDuplicateIdentityType; value: string; records: NotionInsightRecord[] }>();

    const addToGroup = (
      type: ApprovedDuplicateIdentityType,
      value: string,
      record: NotionInsightRecord,
    ): void => {
      const key = `${type}:${value}`;
      const existing = groupsByIdentity.get(key);
      if (existing) {
        existing.records.push(record);
      } else {
        groupsByIdentity.set(key, {
          type,
          value,
          records: [record],
        });
      }
    };

    for (const record of approvedRecords) {
      const sourceInsightId = record.sourceInsightId.trim();
      const canonicalTag = record.canonicalTag.trim();

      if (sourceInsightId.length > 0) {
        addToGroup("source_insight_id", sourceInsightId, record);
      }

      if (canonicalTag.length > 0) {
        addToGroup("canonical_tag", canonicalTag, record);
      }
    }

    const duplicateGroups: ApprovedDuplicateGroup[] = [];

    for (const group of groupsByIdentity.values()) {
      if (group.records.length < 2) {
        continue;
      }

      const canonical = this.selectCanonicalRecord(group.records);
      duplicateGroups.push({
        identityType: group.type,
        identityValue: group.value,
        records: group.records,
        canonical,
      });
    }

    return duplicateGroups;
  }


  async getInsightsDatabasePropertyNames(): Promise<Set<string>> {
    if (this.propertyNameCache) {
      return new Set(this.propertyNameCache)
    }

    const result = await this.mcp.callTool<NotionFetchResponse>(
      "notion-fetch",
      { id: this.insightsDatabaseId }
    )

    const names = new Set<string>()

    const directProperties = result.properties
    if (directProperties && typeof directProperties === 'object') {
      for (const key of Object.keys(directProperties)) {
        names.add(key)
      }
    }

    const content = result.content?.[0]?.text
    if (content) {
      try {
        const data = JSON.parse(content)
        const nestedProperties = data.properties
        if (nestedProperties && typeof nestedProperties === 'object') {
          for (const key of Object.keys(nestedProperties)) {
            names.add(key)
          }
        }
      } catch {
        // ignore schema parse issues and fall back to known names only
      }
    }

    this.propertyNameCache = names
    return new Set(names)
  }

  async cleanupApprovedDuplicates(): Promise<ApprovedDuplicateCleanupResult> {
    const allApprovedRecords = await this.listApprovedInsights();
    const duplicateGroups = await this.findApprovedDuplicateGroups(allApprovedRecords);
    const duplicatePageIds = new Set<string>();
    const processedPageIds = new Set<string>();

    for (const group of duplicateGroups) {
      for (const record of group.records) {
        duplicatePageIds.add(record.pageId);
      }
    }

    const ambiguousRecords = allApprovedRecords
      .filter((record) => {
        const hasStrongIdentity =
          record.sourceInsightId.trim().length > 0 ||
          record.canonicalTag.trim().length > 0;
        return !hasStrongIdentity && !duplicatePageIds.has(record.pageId);
      })
      .map((record) => record.pageId);

    const canonicalPageIds: string[] = [];
    const archivedPageIds: string[] = [];
    const failedPageIds: string[] = [];

    for (const group of duplicateGroups) {
      const candidates = group.records.filter(
        (record) => !processedPageIds.has(record.pageId),
      );

      if (candidates.length < 2) {
        continue;
      }

      const canonical = this.selectCanonicalRecord(candidates);
      canonicalPageIds.push(canonical.pageId);

      for (const record of candidates) {
        if (record.pageId === canonical.pageId) {
          processedPageIds.add(record.pageId);
          continue;
        }

        try {
          await this.updatePage({
            page_id: record.pageId,
            properties: {
              Status: {
                select: { name: "Superseded" },
              },
              "Review Status": {
                select: { name: "Completed" },
              },
              "AI Accessible": {
                checkbox: false,
              },
              "Duplicate Of": {
                rich_text: [{ text: { content: canonical.pageId } }],
              },
              Rationale: {
                rich_text: [
                  {
                    text: {
                      content:
                        "Archived by duplicate cleanup: canonical approved record preserved.",
                    },
                  },
                ],
              },
            },
          });
          archivedPageIds.push(record.pageId);
          processedPageIds.add(record.pageId);
        } catch {
          failedPageIds.push(record.pageId);
        }
      }

      processedPageIds.add(canonical.pageId);
    }

    return {
      groupsFound: duplicateGroups.length,
      archivedCount: archivedPageIds.length,
      canonicalPageIds,
      archivedPageIds,
      ambiguousRecords,
      failedPageIds,
    };
  }

  private selectCanonicalRecord(records: NotionInsightRecord[]): NotionInsightRecord {
    const sorted = [...records].sort((a, b) => {
      const aApproved = this.toTimestamp(a.approvedAt);
      const bApproved = this.toTimestamp(b.approvedAt);
      if (bApproved !== aApproved) {
        return bApproved - aApproved;
      }

      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      return a.pageId.localeCompare(b.pageId);
    });

    return sorted[0];
  }

  private toTimestamp(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Map Notion page to InsightRecord
   * 
   * IMPORTANT: Property Schema
   * - Status: Lifecycle state (Proposed, Pending Review, Approved, Rejected, Superseded)
   * - Review Status: Approval workflow (Pending, In Progress, Completed, Updated)
   * - AI Accessible: Checkbox - runtime approval flag
   */
  private mapInsightRow(row: Record<string, unknown>): NotionInsightRecord | null {
    const id = typeof row.id === "string" ? row.id : null;
    const properties = (row.properties ?? row) as Record<string, any>;
    
    if (!id) return null;

    // Extract title
    const title = this.extractTitle(properties.Name || properties.Title);

    // Extract rich text fields
    const summary = this.extractRichText(properties.Summary || properties["Summary"]);
    const canonicalTag = this.extractRichText(properties["Canonical Tag"] || properties.canonical_tag);
    const sourceInsightId = this.extractRichText(properties["Source Insight ID"] || properties.source_insight_id);
    const sourceProject = this.extractRichText(properties["Source Project"] || properties.source_project);

    // Extract multi-select
    const displayTags = this.extractMultiSelect(properties["Display Tags"] || properties.display_tags);

    // Extract select fields
    // Status: Lifecycle state
    const status = properties.Status?.select?.name || properties.status || "Proposed";
    // Review Status: Approval workflow (use this for approval checks!)
    const reviewStatus = properties["Review Status"]?.select?.name || properties.review_status || "Pending";

    // Extract checkbox
    const aiAccessible = Boolean(properties["AI Accessible"]?.checkbox ?? properties.ai_accessible);

    // Extract number
    const confidence = properties.Confidence?.number ?? properties.confidence ?? 0;

    // Extract date
    const promotedAt = properties["Promoted At"]?.date?.start;
    const approvedAt = properties["Approved At"]?.date?.start;

    // Extract rich text for approved by
    const approvedBy = this.extractRichText(properties["Approved By"]);

    return {
      pageId: id,
      title,
      summary,
      confidence,
      canonicalTag,
      displayTags,
      status,
      reviewStatus,
      aiAccessible,
      sourceInsightId,
      sourceProject,
      promotedAt,
      approvedAt,
      approvedBy
    };
  }

  private extractTitle(prop: any): string {
    if (!prop) return "";
    if (prop.title) {
      return prop.title.map((t: any) => t.plain_text || t.text?.content || "").join("");
    }
    return "";
  }

  private extractRichText(prop: any): string {
    if (!prop) return "";
    if (prop.rich_text) {
      return prop.rich_text.map((t: any) => t.plain_text || t.text?.content || "").join("");
    }
    if (typeof prop === "string") return prop;
    return "";
  }

  private extractMultiSelect(prop: any): string[] {
    if (!prop) return [];
    if (prop.multi_select) {
      return prop.multi_select.map((t: any) => t.name).filter(Boolean);
    }
    return [];
  }
}
