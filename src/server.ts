import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { captureScreenshot, captureResponsiveScreenshots } from "./tools/screenshot.js";
import { runAccessibilityAudit, formatAccessibilityReport } from "./tools/accessibility.js";
import { measurePerformance, formatPerformanceReport } from "./tools/performance.js";
import { analyzeCode, formatCodeAnalysisReport } from "./tools/code-analysis.js";
import { runFullReview, formatFullReviewReport } from "./tools/full-review.js";
import { generateExpertReport, generateQuickDesignReport } from "./tools/report-generator.js";
import { closeBrowser } from "./utils/browser.js";
import {
  UI_REVIEW_PROMPT,
  RESPONSIVE_REVIEW_PROMPT,
  QUICK_DESIGN_PROMPT,
} from "./prompts/review.js";

// ── Server Creation ────────────────────────────────────────────────

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ui-audit",
    version: "0.1.0",
  });

  // ── Tools ──────────────────────────────────────────────────────

  server.tool(
    "screenshot",
    "Capture a screenshot of a webpage. Returns a PNG image that you can visually analyze for design issues, layout problems, and UI quality.",
    {
      url: z.string().url().describe("URL of the page to screenshot (e.g., http://localhost:3000)"),
      width: z.number().optional().default(1440).describe("Viewport width in pixels"),
      height: z.number().optional().default(900).describe("Viewport height in pixels"),
      fullPage: z.boolean().optional().default(true).describe("Capture the full scrollable page"),
      delay: z.number().optional().default(1000).describe("Wait time in ms after page load before capturing"),
    },
    async ({ url, width, height, fullPage, delay }) => {
      try {
        const result = await captureScreenshot({
          url,
          width: width ?? 1440,
          height: height ?? 900,
          fullPage: fullPage ?? true,
          delay: delay ?? 1000,
          deviceScaleFactor: 2,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Screenshot captured: ${result.url} (${result.width}x${result.height}) at ${result.timestamp}`,
            },
            {
              type: "image" as const,
              data: result.base64,
              mimeType: result.mimeType,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Screenshot failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "responsive_screenshots",
    "Capture screenshots at mobile (375px), tablet (768px), and desktop (1440px) viewports. Perfect for reviewing responsive design.",
    {
      url: z.string().url().describe("URL of the page to capture"),
    },
    async ({ url }) => {
      try {
        const results = await captureResponsiveScreenshots(url);
        const labels = ["Mobile (375px)", "Tablet (768px)", "Desktop (1440px)"];

        const content = results.flatMap((result, i) => [
          {
            type: "text" as const,
            text: `### ${labels[i]}`,
          },
          {
            type: "image" as const,
            data: result.base64,
            mimeType: result.mimeType,
          },
        ]);

        return { content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Responsive screenshots failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "accessibility_audit",
    "Run an automated accessibility audit using axe-core. Checks for WCAG 2.1 Level A and AA violations, reporting issues by severity with specific fix instructions.",
    {
      url: z.string().url().describe("URL of the page to audit"),
    },
    async ({ url }) => {
      try {
        const result = await runAccessibilityAudit(url);
        const report = formatAccessibilityReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Accessibility audit failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "performance_audit",
    "Measure Core Web Vitals and performance metrics: FCP, LCP, CLS, TBT, load time, resource count, DOM size, and JS heap usage.",
    {
      url: z.string().url().describe("URL of the page to measure"),
    },
    async ({ url }) => {
      try {
        const result = await measurePerformance(url);
        const report = formatPerformanceReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Performance audit failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "analyze_code",
    "Analyze frontend source code for quality issues: accessibility anti-patterns, CSS problems, component complexity, design inconsistencies, and performance concerns.",
    {
      directory: z.string().describe("Absolute path to the frontend source directory (e.g., /Users/me/project/src)"),
    },
    async ({ directory }) => {
      try {
        const result = await analyzeCode(directory);
        const report = formatCodeAnalysisReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Code analysis failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "full_review",
    "Run a COMPLETE UI audit: captures screenshot, runs accessibility audit (axe-core), measures performance (Web Vitals), and analyzes source code. Returns everything needed for a comprehensive expert review. This is the primary tool — use this for thorough UI reviews.",
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDirectory: z.string().describe("Absolute path to the frontend source directory"),
      width: z.number().optional().default(1440).describe("Viewport width"),
      height: z.number().optional().default(900).describe("Viewport height"),
    },
    async ({ url, codeDirectory, width, height }) => {
      try {
        const result = await runFullReview(url, codeDirectory, {
          width: width ?? 1440,
          height: height ?? 900,
        });
        const report = formatFullReviewReport(result);

        return {
          content: [
            {
              type: "text" as const,
              text: `Screenshot of ${url}:`,
            },
            {
              type: "image" as const,
              data: result.screenshot.base64,
              mimeType: result.screenshot.mimeType,
            },
            {
              type: "text" as const,
              text: report,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Full review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── AI-Powered Review Tools (call Claude API) ──────────────────

  server.tool(
    "review_ui",
    `THE PRIMARY TOOL — Fully automated UI review pipeline. This tool:
1. Captures a screenshot of the running app
2. Runs accessibility audit (axe-core WCAG 2.1)
3. Measures performance (Core Web Vitals)
4. Analyzes source code for anti-patterns
5. Sends EVERYTHING to a separate Claude instance acting as a world-class frontend expert
6. Returns a comprehensive expert report with specific, actionable fixes

Use this tool when the user asks to "review my UI" or "audit my frontend". The report will contain exact CSS values, code changes, and design specs that you can implement directly.

REQUIRES: ANTHROPIC_API_KEY environment variable.`,
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDirectory: z.string().describe("Absolute path to the frontend source directory (e.g., /Users/me/project/src)"),
      width: z.number().optional().default(1440).describe("Viewport width in pixels"),
      height: z.number().optional().default(900).describe("Viewport height in pixels"),
      model: z.string().optional().default("claude-sonnet-4-20250514").describe("Claude model to use for report generation"),
    },
    async ({ url, codeDirectory, width, height, model }) => {
      try {
        // Step 1-4: Collect all audit data
        const auditData = await runFullReview(url, codeDirectory, {
          width: width ?? 1440,
          height: height ?? 900,
        });

        // Step 5: Send to Claude API for expert analysis
        const reviewReport = await generateExpertReport(
          auditData,
          model ?? "claude-sonnet-4-20250514"
        );

        // Step 6: Return the report + screenshot to Claude Code
        return {
          content: [
            {
              type: "text" as const,
              text: `Screenshot of ${url} (what the expert reviewed):`,
            },
            {
              type: "image" as const,
              data: auditData.screenshot.base64,
              mimeType: auditData.screenshot.mimeType,
            },
            {
              type: "text" as const,
              text: [
                `# Expert UI Review Report`,
                ``,
                `**Generated by:** ${reviewReport.model}`,
                `**Tokens used:** ${reviewReport.tokensUsed.toLocaleString()}`,
                `**Timestamp:** ${reviewReport.timestamp}`,
                ``,
                `---`,
                ``,
                reviewReport.report,
                ``,
                `---`,
                ``,
                `## Instructions for Implementation`,
                ``,
                `The above report was generated by a separate Claude instance acting as a frontend expert.`,
                `Now implement ALL the fixes listed above, starting with CRITICAL severity and working down.`,
                `For each fix:`,
                `1. Locate the file mentioned in the finding`,
                `2. Apply the exact code change suggested`,
                `3. Verify the change doesn't break anything`,
                `4. Move to the next finding`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `UI review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "quick_review",
    "Quick design-only review. Captures a screenshot and sends it to Claude for visual/UX feedback. Faster than full_review — no code analysis, no performance audit. Good for rapid design iteration.",
    {
      url: z.string().url().describe("URL of the page to review"),
      model: z.string().optional().default("claude-sonnet-4-20250514").describe("Claude model to use"),
    },
    async ({ url, model }) => {
      try {
        // Capture screenshot
        const screenshot = await captureScreenshot({
          url,
          width: 1440,
          height: 900,
          fullPage: true,
          delay: 1000,
          deviceScaleFactor: 2,
        });

        // Send to Claude for design review
        const reviewReport = await generateQuickDesignReport(
          screenshot.base64,
          url,
          model ?? "claude-sonnet-4-20250514"
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Screenshot of ${url}:`,
            },
            {
              type: "image" as const,
              data: screenshot.base64,
              mimeType: screenshot.mimeType,
            },
            {
              type: "text" as const,
              text: [
                `# Quick Design Review`,
                ``,
                `**Model:** ${reviewReport.model}`,
                `**Tokens:** ${reviewReport.tokensUsed.toLocaleString()}`,
                ``,
                `---`,
                ``,
                reviewReport.report,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Quick review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Prompts ────────────────────────────────────────────────────

  server.prompt(
    "ui-review",
    "Comprehensive UI review methodology. Use this prompt after running the full_review tool to get expert-level analysis of the collected data.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: UI_REVIEW_PROMPT,
          },
        },
      ],
    })
  );

  server.prompt(
    "responsive-review",
    "Responsive design review methodology. Use after capturing responsive_screenshots to analyze layout across mobile, tablet, and desktop.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: RESPONSIVE_REVIEW_PROMPT,
          },
        },
      ],
    })
  );

  server.prompt(
    "quick-design-review",
    "Quick design-only review. Use after taking a screenshot when you just want visual/UX feedback without code analysis.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: QUICK_DESIGN_PROMPT,
          },
        },
      ],
    })
  );

  // ── Cleanup ────────────────────────────────────────────────────

  process.on("SIGINT", async () => {
    await closeBrowser();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await closeBrowser();
    process.exit(0);
  });

  return server;
}
