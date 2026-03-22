/**
 * Notion Page Templates
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 *
 * Defines page templates for mirroring AgentDesign nodes to Notion.
 */

import type { EvaluationMetrics } from "../adas/types";

/**
 * Notion block types
 * Simplified representation for creating Notion pages
 */
export interface NotionBlock {
  object: "block";
  type: string;
  [key: string]: unknown;
}

export interface RichText {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    color?: string;
  };
}

export interface HeadingBlock extends NotionBlock {
  type: "heading_1" | "heading_2" | "heading_3";
  heading_1?: { rich_text: RichText[] };
  heading_2?: { rich_text: RichText[] };
  heading_3?: { rich_text: RichText[] };
}

export interface ParagraphBlock extends NotionBlock {
  type: "paragraph";
  paragraph: { rich_text: RichText[] };
}

export interface CodeBlock extends NotionBlock {
  type: "code";
  code: {
    rich_text: RichText[];
    language: string;
  };
}

export interface CalloutBlock extends NotionBlock {
  type: "callout";
  callout: {
    rich_text: RichText[];
    icon: { type: "emoji"; emoji: string };
  };
}

export interface DividerBlock extends NotionBlock {
  type: "divider";
  divider: Record<string, unknown>;
}

export interface BookmarkBlock extends NotionBlock {
  type: "bookmark";
  bookmark: { url: string };
}

export interface BulletedListItemBlock extends NotionBlock {
  type: "bulleted_list_item";
  bulleted_list_item: { rich_text: RichText[] };
}

export interface NumberedListItemBlock extends NotionBlock {
  type: "numbered_list_item";
  numbered_list_item: { rich_text: RichText[] };
}

/**
 * Notion page properties
 * 
 * Updated schema with Review Status and AI Accessible for approval workflow.
 */
export interface NotionPageProperties {
  Title: Array<{ title: { text: { content: string } } }>;
  Design_ID?: { rich_text: Array<{ text: { content: string } }> };
  Domain?: { select: { name: string } };
  Score?: { number: number };
  Status?: { select: { name: string } };
  "Review Status"?: { select: { name: string } };
  "AI Accessible"?: { checkbox: boolean };
  Version?: { number: number };
  Group_ID?: { rich_text: Array<{ text: { content: string } }> };
  Created_At?: { date: { start: string } };
  Updated_At?: { date: { start: string } };
  Evidence_Ref?: { url: string };
  Metrics_JSON?: { rich_text: Array<{ text: { content: string } }> };
  Approved_By?: { rich_text: Array<{ text: { content: string } }> };
  Approved_At?: { date: { start: string } };
}

/**
 * AgentDesign summary for Notion page creation
 */
export interface AgentDesignSummary {
  designId: string;
  name: string;
  version: number;
  domain: string;
  description: string;
  score: number;
  metrics: EvaluationMetrics;
  status: string;
  reviewStatus?: string;
  aiAccessible?: boolean;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
  evidenceRef: string | null;
  adasRunId: string | null;
  config: Record<string, unknown>;
}

/**
 * How-to-run guide content
 */
export interface HowToRunGuide {
  setupSteps: string[];
  usageInstructions: string[];
  prerequisites: string[];
  examples: string[];
}

/**
 * Page template configuration
 */
export interface PageTemplateConfig {
  databaseId: string;
  parentPageId?: string;
}

/**
 * Create a rich text object
 */
function createRichText(
  content: string,
  options: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    link?: { url: string } | null;
  } = {}
): RichText {
  return {
    type: "text",
    text: { content, link: options.link ?? null },
    annotations: {
      bold: options.bold,
      italic: options.italic,
      code: options.code,
    },
  };
}

/**
 * Create a heading block
 */
function createHeading(
  level: 1 | 2 | 3,
  text: string
): HeadingBlock {
  const richText = [createRichText(text, { bold: true })];
  return {
    object: "block",
    type: `heading_${level}` as const,
    [`heading_${level}`]: { rich_text: richText },
  } as HeadingBlock;
}

/**
 * Create a paragraph block
 */
function createParagraph(text: string, link?: { url: string }): ParagraphBlock {
  const richText = link
    ? [createRichText(text, { link })]
    : [createRichText(text)];
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText },
  };
}

/**
 * Create a code block
 */
function createCodeBlock(code: string, language: string = "json"): CodeBlock {
  return {
    object: "block",
    type: "code",
    code: {
      rich_text: [createRichText(code)],
      language,
    },
  };
}

/**
 * Create a callout block
 */
function createCallout(text: string, emoji: string): CalloutBlock {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: [createRichText(text)],
      icon: { type: "emoji", emoji },
    },
  };
}

/**
 * Create a divider block
 */
function createDivider(): DividerBlock {
  return {
    object: "block",
    type: "divider",
    divider: {},
  };
}

/**
 * Create a bulleted list item
 */
function createBulletedListItem(text: string): BulletedListItemBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [createRichText(text)] },
  };
}

/**
 * Create a numbered list item
 */
function createNumberedListItem(text: string): NumberedListItemBlock {
  return {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [createRichText(text)] },
  };
}

/**
 * Create a bookmark block
 */
function createBookmark(url: string): BookmarkBlock {
  return {
    object: "block",
    type: "bookmark",
    bookmark: { url },
  };
}

/**
 * Generate human-readable summary from design code
 * AC1: Creates a summary from AgentDesign
 */
export function generateDesignSummary(design: AgentDesignSummary): string {
  const lines: string[] = [];

  lines.push(`## ${design.name}`);
  lines.push("");
  lines.push(`**Domain:** ${design.domain}`);
  lines.push(`**Version:** ${design.version}`);
  lines.push(`**Score:** ${(design.score * 100).toFixed(2)}%`);
  lines.push("");
  lines.push("### Description");
  lines.push(design.description || "No description available.");
  lines.push("");

  if (design.config) {
    lines.push("### Configuration");
    if (design.config.systemPrompt) {
      lines.push("");
      lines.push("**System Prompt:**");
      lines.push(`\`\`\`\n${design.config.systemPrompt}\n\`\`\``);
    }
    if (design.config.model) {
      const model = design.config.model as { provider?: string; modelId?: string };
      lines.push("");
      lines.push(`**Model:** ${model.provider || "unknown"}/${model.modelId || "unknown"}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate how-to-run guide from evaluation metadata
 * AC1: Creates usage guide from design configuration
 */
export function generateHowToRunGuide(design: AgentDesignSummary): HowToRunGuide {
  const config = design.config;
  const modelConfig = config?.model as { provider?: string; modelId?: string; temperature?: number } | undefined;

  const prerequisites: string[] = [
    "Access to the agent platform",
    "Appropriate API keys configured",
    "Group permissions for the domain",
  ];

  const setupSteps: string[] = [];

  if (modelConfig?.provider && modelConfig?.modelId) {
    setupSteps.push(`Configure model: ${modelConfig.provider}/${modelConfig.modelId}`);
    if (modelConfig.temperature !== undefined) {
      setupSteps.push(`Set temperature to ${modelConfig.temperature}`);
    }
  }

  if (config?.parameters) {
    setupSteps.push("Apply custom parameters from configuration");
  }

  setupSteps.push("Verify environment variables are set");
  setupSteps.push("Run health check to validate setup");

  const usageInstructions: string[] = [
    "Load the design configuration",
    "Initialize the agent with the configuration",
    "Execute the forward function with input data",
    "Collect and evaluate results",
  ];

  if (config?.tools && Array.isArray(config.tools) && config.tools.length > 0) {
    usageInstructions.push(`Use available tools: ${config.tools.map((t: { name: string }) => t.name).join(", ")}`);
  }

  const examples: string[] = [];

  examples.push(`// Initialize the agent`);
  examples.push(`const agent = await initializeAgent('${design.designId}');`);
  examples.push("");
  examples.push(`// Execute with input`);
  examples.push(`const result = await agent.forward(inputData);`);

  return {
    prerequisites,
    setupSteps,
    usageInstructions,
    examples,
  };
}

/**
 * Build Notion page blocks for a design
 * Creates the full page structure with summary and guide
 */
export function buildDesignPageBlocks(
  design: AgentDesignSummary,
  evidenceUrl: string | null
): NotionBlock[] {
  const blocks: NotionBlock[] = [];

  blocks.push(createCallout(
    `Design ID: ${design.designId} | Version ${design.version} | Domain: ${design.domain}`,
    "📋"
  ));

  blocks.push(createDivider());

  blocks.push(createHeading(1, "Overview"));

  const statusEmoji = design.status === "approved" ? "✅" : design.status === "pending_approval" ? "⏳" : "❌";
  blocks.push(createParagraph(`**Status:** ${statusEmoji} ${design.status}`));
  blocks.push(createParagraph(`**ADAS Run ID:** ${design.adasRunId || "N/A"}`));
  blocks.push(createParagraph(`**Group ID:** ${design.groupId}`));

  blocks.push(createDivider());

  blocks.push(createHeading(1, "Description"));
  blocks.push(createParagraph(design.description || "No description available."));

  blocks.push(createHeading(2, "Configuration"));
  blocks.push(createCodeBlock(JSON.stringify(design.config, null, 2), "json"));

  blocks.push(createDivider());

  blocks.push(createHeading(1, "Evaluation Metrics"));

  blocks.push(createHeading(2, "Overall Score"));
  blocks.push(createParagraph(`${(design.score * 100).toFixed(2)}%`));

  blocks.push(createHeading(2, "Breakdown"));
  blocks.push(createBulletedListItem(`**Accuracy:** ${(design.metrics.accuracy * 100).toFixed(2)}%`));
  blocks.push(createBulletedListItem(`**Cost:** $${design.metrics.cost.toFixed(6)}`));
  blocks.push(createBulletedListItem(`**Latency:** ${design.metrics.latency.toFixed(2)}ms`));
  blocks.push(createBulletedListItem(`**Composite Score:** ${(design.metrics.composite * 100).toFixed(2)}%`));

  if (design.metrics.tokens) {
    blocks.push(createHeading(3, "Token Usage"));
    blocks.push(createBulletedListItem(`**Prompt Tokens:** ${design.metrics.tokens.promptTokens.toLocaleString()}`));
    blocks.push(createBulletedListItem(`**Completion Tokens:** ${design.metrics.tokens.completionTokens.toLocaleString()}`));
    blocks.push(createBulletedListItem(`**Total Tokens:** ${design.metrics.tokens.totalTokens.toLocaleString()}`));
  }

  if (design.metrics.details) {
    if (design.metrics.details.testCasesExecuted !== undefined) {
      blocks.push(createBulletedListItem(
        `**Test Cases:** ${design.metrics.details.testCasesPassed || 0}/${design.metrics.details.testCasesExecuted} passed`
      ));
    }
    if (design.metrics.details.errors && design.metrics.details.errors.length > 0) {
      blocks.push(createHeading(3, "Errors"));
      design.metrics.details.errors.forEach(err => {
        blocks.push(createBulletedListItem(`⚠️ ${err}`));
      });
    }
  }

  blocks.push(createDivider());

  blocks.push(createHeading(1, "How to Run"));

  const guide = generateHowToRunGuide(design);

  blocks.push(createHeading(2, "Prerequisites"));
  guide.prerequisites.forEach((step, index) => {
    blocks.push(createNumberedListItem(step));
  });

  blocks.push(createHeading(2, "Setup Steps"));
  if (guide.setupSteps.length > 0) {
    guide.setupSteps.forEach((step, index) => {
      blocks.push(createNumberedListItem(step));
    });
  } else {
    blocks.push(createParagraph("No special setup required."));
  }

  blocks.push(createHeading(2, "Usage"));
  guide.usageInstructions.forEach((instruction, index) => {
    blocks.push(createNumberedListItem(instruction));
  });

  blocks.push(createHeading(2, "Example"));
  blocks.push(createCodeBlock(guide.examples.join("\n"), "javascript"));

  blocks.push(createDivider());

  blocks.push(createHeading(1, "Evidence Reference"));

  if (evidenceUrl) {
    blocks.push(createParagraph("View the source evidence in PostgreSQL:"));
    blocks.push(createBookmark(evidenceUrl));
  } else if (design.evidenceRef) {
    blocks.push(createParagraph(`**Trace Reference:** ${design.evidenceRef}`));
  } else {
    blocks.push(createParagraph("No evidence reference available."));
  }

  blocks.push(createDivider());

  blocks.push(createCallout(
    `Synced at ${new Date().toISOString()} | Design Version: ${design.version}`,
    "🔄"
  ));

  return blocks;
}

/**
 * Build Notion page properties for a design
 * Creates the database entry properties
 * 
 * IMPORTANT: Property Schema
 * - Status: Lifecycle state (Planning, Testing, Active, Deprecated)
 * - Review Status: Approval workflow (Pending, In Progress, Completed, Updated)
 * - AI Accessible: Checkbox - runtime approval flag
 */
export function buildDesignPageProperties(
  design: AgentDesignSummary
): NotionPageProperties {
  const properties: NotionPageProperties = {
    Title: [
      {
        title: {
          text: {
            content: `${design.name} (v${design.version})`,
          },
        },
      },
    ],
  };

  properties.Design_ID = {
    rich_text: [{ text: { content: design.designId } }],
  };

  properties.Domain = {
    select: { name: design.domain },
  };

  properties.Score = {
    number: design.score,
  };

  properties.Status = {
    select: { name: design.status },
  };

  // Review Status: Approval workflow state
  // Use "Pending" for new designs, "Completed" after human approval
  properties["Review Status"] = {
    select: { name: design.reviewStatus || "Pending" },
  };

  // AI Accessible: Runtime approval flag
  // Only true after human approval
  properties["AI Accessible"] = {
    checkbox: design.aiAccessible ?? false,
  };

  properties.Version = {
    number: design.version,
  };

  properties.Group_ID = {
    rich_text: [{ text: { content: design.groupId } }],
  };

  properties.Created_At = {
    date: { start: design.createdAt.toISOString() },
  };

  properties.Updated_At = {
    date: { start: design.updatedAt.toISOString() },
  };

  if (design.evidenceRef) {
    properties.Evidence_Ref = {
      url: design.evidenceRef,
    };
  }

  properties.Metrics_JSON = {
    rich_text: [{ text: { content: JSON.stringify(design.metrics) } }],
  };

  return properties;
}

/**
 * Create full page template for syncing to Notion
 */
export interface DesignPageTemplate {
  properties: NotionPageProperties;
  blocks: NotionBlock[];
  metadata: {
    designId: string;
    version: number;
    syncedAt: Date;
    neo4jId: string;
  };
}

/**
 * Build complete page template for Notion sync
 */
export function buildDesignPageTemplate(
  design: AgentDesignSummary,
  neo4jId: string,
  evidenceUrl: string | null = null
): DesignPageTemplate {
  return {
    properties: buildDesignPageProperties(design),
    blocks: buildDesignPageBlocks(design, evidenceUrl),
    metadata: {
      designId: design.designId,
      version: design.version,
      syncedAt: new Date(),
      neo4jId,
    },
  };
}

/**
 * Create minimal page template for database entry only
 */
export function buildMinimalPageTemplate(
  design: AgentDesignSummary,
  neo4jId: string
): DesignPageTemplate {
  return {
    properties: buildDesignPageProperties(design),
    blocks: [],
    metadata: {
      designId: design.designId,
      version: design.version,
      syncedAt: new Date(),
      neo4jId,
    },
  };
}