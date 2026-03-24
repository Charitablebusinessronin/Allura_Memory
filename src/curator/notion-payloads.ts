/**
 * Notion Property Mapping
 * 
 * Maps curator properties to Notion API schema (Docker MCP compatible).
 */

import { Neo4jInsight, ReviewContextDisplay } from "../curator/types";
import { DISPLAY_TAG_MAP, INSIGHTS_DATABASE_ID } from "../curator/config";

export function buildInsightPayload(
  insight: Neo4jInsight,
  reviewContext?: ReviewContextDisplay,
): Record<string, unknown> {
  const displayTag = DISPLAY_TAG_MAP[insight.canonicalTag] || insight.canonicalTag;

  const properties: Record<string, unknown> = {
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
    properties
  };
}
