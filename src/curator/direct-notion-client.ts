import { getNotionClient } from "@/lib/notion/client";
import { NotionClient, ApprovedDuplicateGroup, ApprovedDuplicateCleanupResult } from "../integrations/notion.client";
import { NotionInsightRecord } from "./types";
import { INSIGHTS_DATABASE_ID } from "./config";

export class DirectNotionClient implements NotionClient {
  private propertyNameCache: Set<string> | null = null;

  async createPage(payload: Record<string, unknown>): Promise<{ pageId: string }> {
    const client = getNotionClient();
    
    const { content, ...pagePayload } = payload as { content?: string; [key: string]: unknown };
    
    // Map properties from curator schema to actual database schema
    const mappedPayload = this.mapPropertiesToDatabase(pagePayload);
    
    const result = await client.createPage({
      parent: { database_id: INSIGHTS_DATABASE_ID },
      ...mappedPayload,
    } as any);
    return { pageId: result.id };
  }

  async updatePage(payload: Record<string, unknown>): Promise<void> {
    const client = getNotionClient();
    const { page_id, ...updateData } = payload as { page_id: string; [key: string]: unknown };
    await client.updatePage({
      pageId: page_id,
      ...updateData,
    });
  }

  async findExistingInsights(canonicalTag?: string): Promise<NotionInsightRecord[]> {
    const client = getNotionClient();
    
    // Query all pages and filter in code since databases have different schemas
    const result = await client.queryDatabase(INSIGHTS_DATABASE_ID, {});
    
    let records = result.results
      .map((row) => this.mapInsightRow(row))
      .filter((r): r is NotionInsightRecord => r !== null)
      .filter((r) => r.status !== "Rejected" && r.status !== "Superseded");
    
    if (canonicalTag) {
      records = records.filter(r => r.canonicalTag === canonicalTag);
    }
    
    return records;
  }

  async getPageBySourceInsightId(sourceInsightId: string): Promise<NotionInsightRecord | null> {
    const client = getNotionClient();
    
    const allResults = await client.queryDatabase(INSIGHTS_DATABASE_ID, {});
    for (const page of allResults.results) {
      const record = this.mapInsightRow(page);
      if (!record) continue;
      if (record.sourceInsightId === sourceInsightId) {
        return record;
      }
    }

    return null;
  }

  async listApprovedInsights(): Promise<NotionInsightRecord[]> {
    const records = await this.findExistingInsights();
    return records.filter((record) =>
      record.reviewStatus === "Completed" && record.aiAccessible === true,
    );
  }

  async findApprovedDuplicateGroups(approvedRecordsInput?: NotionInsightRecord[]): Promise<ApprovedDuplicateGroup[]> {
    const approvedRecords = approvedRecordsInput ?? (await this.listApprovedInsights());
    const groupsByIdentity = new Map<string, { type: "source_insight_id" | "canonical_tag"; value: string; records: NotionInsightRecord[] }>();

    const addToGroup = (
      type: "source_insight_id" | "canonical_tag",
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

  async getInsightsDatabasePropertyNames(): Promise<Set<string>> {
    if (this.propertyNameCache) {
      return new Set(this.propertyNameCache);
    }

    const client = getNotionClient();
    const result = await client.queryDatabase(INSIGHTS_DATABASE_ID, { page_size: 1 });
    
    const names = new Set<string>();
    
    for (const page of result.results) {
      const properties = page.properties;
      if (properties && typeof properties === "object") {
        for (const key of Object.keys(properties)) {
          names.add(key);
        }
      }
    }

    this.propertyNameCache = names;
    return new Set(names);
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

  private mapInsightRow(row: { id: string; properties: Record<string, unknown> }): NotionInsightRecord | null {
    const id = row.id;
    const properties = row.properties as Record<string, any>;
    
    if (!id) return null;

    const title = this.extractTitle(properties.Name || properties.Title);
    const summary = this.extractRichText(properties.Summary || properties.Source);
    const canonicalTag = this.extractRichText(properties["Canonical Tag"] || properties.Category);
    const sourceInsightId = this.extractRichText(properties["Source Insight ID"]) || "";
    const sourceProject = this.extractRichText(properties["Source Project"] || properties.Source);
    const displayTags = this.extractMultiSelect(properties["Display Tags"] || properties.Tags);
    const status = properties["Content Type"]?.select?.name || properties.Status?.select?.name || "Proposed";
    const reviewStatus = properties["Review Status"]?.select?.name || "Pending";
    const aiAccessible = Boolean(properties["AI Accessible"]?.checkbox);
    const confidence = properties.Confidence?.number ?? 0;
    const promotedAt = properties["Created Date"]?.date?.start || properties["Promoted At"]?.date?.start;
    const approvedAt = properties["Approved At"]?.date?.start;
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

  private mapPropertiesToDatabase(payload: Record<string, unknown>): Record<string, unknown> {
    const properties = payload.properties as Record<string, unknown>;
    if (!properties) return payload;

    const mappedProperties: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(properties)) {
      switch (key) {
        case "Name":
          mappedProperties["Name"] = value;
          break;
        case "Canonical Tag": {
          const tagValue = this.extractValueFromRichText(value);
          if (tagValue) {
            mappedProperties["Category"] = { select: { name: tagValue } };
          }
          break;
        }
        case "Display Tags":
          mappedProperties["Tags"] = value;
          break;
        case "Source Project": {
          const sourceValue = this.extractValueFromRichText(value);
          if (sourceValue) {
            mappedProperties["Source"] = { rich_text: [{ text: { content: sourceValue } }] };
          }
          break;
        }
        case "Status": {
          const statusValue = this.extractValueFromSelect(value);
          if (statusValue) {
            mappedProperties["Content Type"] = { select: { name: "Document" } };
          }
          break;
        }
        case "AI Accessible":
          mappedProperties["AI Accessible"] = value;
          break;
        default:
          break;
      }
    }

    return {
      ...payload,
      properties: mappedProperties,
    };
  }

  private extractValueFromRichText(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    const richText = (value as any).rich_text;
    if (Array.isArray(richText) && richText.length > 0) {
      return richText[0]?.text?.content || richText[0]?.plain_text || "";
    }
    return null;
  }

  private extractValueFromSelect(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    return (value as any).select?.name || null;
  }
}