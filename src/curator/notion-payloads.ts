/**
 * Notion Property Mapping
 * 
 * Maps curator properties to Notion schema.
 */

import { Neo4jInsight, InsightStatus, ReviewContextDisplay } from "../curator/types";
import { DISPLAY_TAG_MAP, INSIGHTS_DATABASE_ID } from "../curator/config";

export interface InsightNotionProperties {
  Name: { title: Array<{ text: { content: string } }> };
  "Canonical Tag"?: { rich_text: Array<{ text: { content: string } }> };
  "Display Tags"?: { multi_select: Array<{ name: string }> };
  "Source Project"?: { rich_text: Array<{ text: { content: string } }> };
  "Source Insight ID"?: { rich_text: Array<{ text: { content: string } }> };
  Confidence?: { number: number };
  Status?: { select: { name: string } };
  "Review Status"?: { select: { name: string } };
  "AI Accessible"?: { checkbox: boolean };
  "Duplicate Of"?: { rich_text: Array<{ text: { content: string } }> };
  Rationale?: { rich_text: Array<{ text: { content: string } }> };
  "Promoted At"?: { date: { start: string } };
}

export function buildInsightPayload(
  insight: Neo4jInsight,
  reviewContext?: ReviewContextDisplay,
): Record<string, unknown> {
  const displayTag = DISPLAY_TAG_MAP[insight.canonicalTag] || insight.canonicalTag;

  const properties: InsightNotionProperties = {
    Name: {
      title: [{ text: { content: insight.title } }]
    },
    "Canonical Tag": {
      rich_text: [{ text: { content: insight.canonicalTag } }]
    },
    "Display Tags": {
      multi_select: [{ name: displayTag }]
    },
    "Source Project": {
      rich_text: [{ text: { content: insight.sourceProject } }]
    },
    "Source Insight ID": {
      rich_text: [{ text: { content: insight.id } }]
    },
    Confidence: {
      number: insight.confidence
    },
    Status: {
      select: { name: "Pending Review" }
    },
    "Review Status": {
      select: { name: "Pending" }
    },
    "AI Accessible": {
      checkbox: false
    },
    "Promoted At": {
      date: { start: new Date().toISOString() }
    }
  };

  if (reviewContext?.topMatch) {
    properties["Duplicate Of"] = {
      rich_text: [{ text: { content: reviewContext.topMatch.id } }]
    };
    properties.Rationale = {
      rich_text: [{
        text: {
          content: `${reviewContext.decision}|${reviewContext.recommendation}|final=${reviewContext.topMatch.finalScore.toFixed(2)}|embedding=${reviewContext.topMatch.embeddingScore.toFixed(2)}|lexical=${reviewContext.topMatch.lexicalScore.toFixed(2)}|latency_ms=${reviewContext.latencyMs.toFixed(2)}`,
        }
      }]
    };
  }
  else if (reviewContext) {
    properties.Rationale = {
      rich_text: [{
        text: {
          content: `${reviewContext.decision}|${reviewContext.recommendation}|latency_ms=${reviewContext.latencyMs.toFixed(2)}`,
        }
      }]
    };
  }

  return {
    parent: {
      database_id: INSIGHTS_DATABASE_ID
    },
    properties,
    content: formatInsightContent(insight, displayTag, reviewContext)
  };
}

function formatInsightContent(
  insight: Neo4jInsight,
  displayTag: string,
  reviewContext?: ReviewContextDisplay,
): string {
  const sections = [
    `## Summary`,
    insight.summary,
    ``,
    `## Metadata`,
    `| Property | Value |`,
    `|----------|-------|`,
    `| Canonical Tag | ${insight.canonicalTag} |`,
    `| Display Tag | ${displayTag} |`,
    `| Source Project | ${insight.sourceProject} |`,
    `| Source Insight ID | ${insight.id} |`,
    `| Confidence | ${insight.confidence} |`,
    `| Status | Pending Review |`,
    `| Review Status | Pending |`,
    `| AI Accessible | false |`,
  ];

  if (reviewContext?.topMatch) {
    sections.push(
      ``,
      `## Duplicate Review Context`,
      `| Property | Value |`,
      `|----------|-------|`,
      `| Decision | ${reviewContext.decision} |`,
      `| Recommendation | ${reviewContext.recommendation} |`,
      `| Evaluator Version | ${reviewContext.evaluatorVersion} |`,
      `| Duplicate Review Latency Ms | ${reviewContext.latencyMs.toFixed(2)} |`,
      `| Prior Insight ID | ${reviewContext.topMatch.id} |`,
      `| Prior Insight Status | ${reviewContext.topMatch.status} |`,
      `| Prior Insight Confidence | ${reviewContext.topMatch.confidence} |`,
      `| Lexical Score | ${reviewContext.topMatch.lexicalScore.toFixed(2)} |`,
      `| Embedding Score | ${reviewContext.topMatch.embeddingScore.toFixed(2)} |`,
      `| Final Score | ${reviewContext.topMatch.finalScore.toFixed(2)} |`,
      ``,
      `### Top Match Summary`,
      reviewContext.topMatch.summary,
    );
  }

  sections.push(
    ``,
    `## Rationale`,
    reviewContext
      ? `This insight was promoted with duplicate review decision ${reviewContext.decision}. ${reviewContext.recommendation}`
      : `This insight was automatically promoted from Neo4j with confidence ${insight.confidence}.`,
    ``,
    `---`,
    `*Promoted by Curator Pipeline on ${new Date().toISOString()}*`
  );

  return sections.join("\n");
}

export function buildApprovalPayload(pageId: string, approvedBy: string): Record<string, unknown> {
  return {
    page_id: pageId,
    properties: {
      Status: { select: { name: "Approved" } },
      "Review Status": { select: { name: "Completed" } },
      "AI Accessible": { checkbox: true },
      "Approved By": { rich_text: [{ text: { content: approvedBy } }] },
      "Approved At": { date: { start: new Date().toISOString() } }
    },
    content: `\n\n## Approval\n**Approved by:** ${approvedBy}\n**Date:** ${new Date().toISOString()}`
  };
}

export function buildRejectionPayload(pageId: string, reason: string): Record<string, unknown> {
  return {
    page_id: pageId,
    properties: {
      Status: { select: { name: "Rejected" } },
      "Review Status": { select: { name: "Completed" } },
      "AI Accessible": { checkbox: false },
      Rationale: { rich_text: [{ text: { content: `Rejected: ${reason}` } }] }
    },
    content: `\n\n## Rejection\n**Reason:** ${reason}\n\nRejected on ${new Date().toISOString()}`
  };
}

export function parseInsightFromContent(page: {
  id: string;
  properties: Record<string, any>;
  content?: string;
}): Partial<Neo4jInsight> & { pageId: string; reviewStatus?: string; aiAccessible?: boolean } {
  const props = page.properties || {};
  const content = page.content || "";

  const title = props.Name?.title?.[0]?.plain_text || 
                props.Name?.title?.[0]?.text?.content || "";
  const confidence = props.Confidence?.number || 0;

  const canonicalTag = props["Canonical Tag"]?.rich_text?.[0]?.text?.content || 
                       extractField(content, "Canonical Tag");
  const sourceProject = props["Source Project"]?.rich_text?.[0]?.text?.content ||
                        extractField(content, "Source Project");
  const sourceInsightId = props["Source Insight ID"]?.rich_text?.[0]?.text?.content ||
                          extractField(content, "Source Insight ID");

  const status = (props.Status?.select?.name as InsightStatus) || 
                 extractField(content, "Status") || "Proposed";
  const reviewStatus = props["Review Status"]?.select?.name ||
                       extractField(content, "Review Status") || "Pending";
  const aiAccessible = props["AI Accessible"]?.checkbox ?? 
                       (extractField(content, "AI Accessible") === "true");

  const summaryMatch = content.match(/## Summary\n([\s\S]*?)\n## Metadata/);
  const summary = summaryMatch ? summaryMatch[1].trim() : "";

  return {
    pageId: page.id,
    title,
    summary,
    confidence,
    canonicalTag,
    sourceProject,
    id: sourceInsightId,
    status,
    reviewStatus,
    aiAccessible
  };
}

function extractField(content: string, fieldName: string): string {
  const regex = new RegExp(`\\| ${fieldName} \\| ([^|]+) \\|`);
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}
