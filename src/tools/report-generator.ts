import Anthropic from "@anthropic-ai/sdk";
import type { FullReviewResult } from "../types.js";
import { formatAccessibilityReport } from "./accessibility.js";
import { formatPerformanceReport } from "./performance.js";
import { formatCodeAnalysisReport } from "./code-analysis.js";
import { UI_REVIEW_PROMPT } from "../prompts/review.js";

// ── Types ──────────────────────────────────────────────────────────

export interface ReviewReport {
  readonly report: string;
  readonly model: string;
  readonly tokensUsed: number;
  readonly timestamp: string;
}

// ── Claude API Client ──────────────────────────────────────────────

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for report generation.\n" +
        "Set it when adding the MCP server:\n" +
        '  claude mcp add ui-audit -e ANTHROPIC_API_KEY="your-key" -- npx -y ui-audit-mcp\n' +
        "Or export it in your shell:\n" +
        "  export ANTHROPIC_API_KEY=your-key"
    );
  }

  return new Anthropic({ apiKey });
}

// ── Report Generation ──────────────────────────────────────────────

/**
 * Send all audit data + screenshot to Claude API and generate
 * a comprehensive expert UI review report.
 *
 * This is the "Claude co" step — a separate Claude instance
 * acts as a frontend expert, analyzes everything, and produces
 * a detailed actionable report with specific fixes.
 */
export async function generateExpertReport(
  auditData: FullReviewResult,
  model: string = "claude-sonnet-4-20250514"
): Promise<ReviewReport> {
  const client = createClient();

  // Build the structured audit summary for Claude to analyze
  const accessibilityReport = formatAccessibilityReport(auditData.accessibility);
  const performanceReport = formatPerformanceReport(auditData.performance);
  const codeReport = formatCodeAnalysisReport(auditData.codeAnalysis);

  const auditSummary = [
    "# Collected Audit Data",
    "",
    "Below is the raw audit data collected from automated tools.",
    "Use this alongside the screenshot to produce your expert review.",
    "",
    "---",
    "",
    accessibilityReport,
    "",
    "---",
    "",
    performanceReport,
    "",
    "---",
    "",
    codeReport,
    "",
    "---",
    "",
    "## Raw Metrics",
    "",
    `- **URL:** ${auditData.url}`,
    `- **Accessibility violations:** ${auditData.accessibility.violations.length}`,
    `- **Accessibility passes:** ${auditData.accessibility.passes}`,
    `- **Load time:** ${auditData.performance.loadTime.toFixed(0)}ms`,
    `- **DOM nodes:** ${auditData.performance.domNodes}`,
    `- **Code files analyzed:** ${auditData.codeAnalysis.totalFiles}`,
    `- **Code findings:** ${auditData.codeAnalysis.findings.length}`,
    `- **Framework:** ${auditData.codeAnalysis.framework}`,
  ].join("\n");

  const response = await client.messages.create({
    model,
    max_tokens: 12000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: UI_REVIEW_PROMPT,
          },
          {
            type: "text",
            text: "\n\nHere is a screenshot of the current UI. Analyze it carefully for visual design, layout, spacing, typography, color, and UX issues:\n",
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: auditData.screenshot.base64,
            },
          },
          {
            type: "text",
            text: `\n\n${auditSummary}`,
          },
          {
            type: "text",
            text: "\n\nNow generate your comprehensive expert UI review report. Be extremely specific — reference exact elements from the screenshot, exact CSS values to change, exact code files and line numbers. Every finding must have a concrete implementation fix that a developer can copy-paste. Start with an executive summary, then provide prioritized findings.",
          },
        ],
      },
    ],
  });

  // Extract the text response
  const reportText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const tokensUsed =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return {
    report: reportText,
    model,
    tokensUsed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate a quick design-only report from a screenshot.
 * Lighter weight — no code analysis, just visual review.
 */
export async function generateQuickDesignReport(
  screenshotBase64: string,
  url: string,
  model: string = "claude-sonnet-4-20250514"
): Promise<ReviewReport> {
  const client = createClient();

  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a senior UI designer at a top-tier design studio. Review this screenshot of ${url} and provide 10 high-impact, specific observations.

For each observation:
1. **What's wrong** — be specific (reference exact elements, areas, colors)
2. **Why it matters** — impact on users
3. **Exact fix** — specific CSS values, spacing, colors, or layout changes

Focus on: visual hierarchy, spacing consistency, typography, color usage, call-to-action visibility, and overall polish.

Be brutally honest but constructive. Prioritize by impact.`,
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: screenshotBase64,
            },
          },
        ],
      },
    ],
  });

  const reportText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const tokensUsed =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return {
    report: reportText,
    model,
    tokensUsed,
    timestamp: new Date().toISOString(),
  };
}
