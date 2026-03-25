import type { FullReviewResult } from "../types.js";
import { captureScreenshot } from "./screenshot.js";
import { runAccessibilityAudit, formatAccessibilityReport } from "./accessibility.js";
import { measurePerformance, formatPerformanceReport } from "./performance.js";
import { analyzeCode, formatCodeAnalysisReport } from "./code-analysis.js";

/**
 * Run a comprehensive UI review combining:
 * - Screenshot capture (for visual review by Claude)
 * - Accessibility audit (axe-core WCAG check)
 * - Performance metrics (Core Web Vitals)
 * - Code analysis (anti-patterns, quality, design)
 *
 * This is the main orchestration tool that runs all audits
 * and returns everything Claude needs for an expert review.
 */
export async function runFullReview(
  url: string,
  codeDirectory: string,
  viewport?: { width: number; height: number }
): Promise<FullReviewResult> {
  const width = viewport?.width ?? 1440;
  const height = viewport?.height ?? 900;

  // Run screenshot first (needed for visual review)
  const screenshot = await captureScreenshot({
    url,
    width,
    height,
    fullPage: true,
    delay: 1500,
    deviceScaleFactor: 2,
  });

  // Run remaining audits concurrently
  const [accessibility, performance, codeAnalysis] = await Promise.all([
    runAccessibilityAudit(url),
    measurePerformance(url),
    analyzeCode(codeDirectory),
  ]);

  return {
    url,
    codeDirectory,
    timestamp: new Date().toISOString(),
    screenshot,
    accessibility,
    performance,
    codeAnalysis,
  };
}

/**
 * Format the full review into a comprehensive text report.
 * The screenshot is returned separately as an image.
 */
export function formatFullReviewReport(result: FullReviewResult): string {
  const sections = [
    `# UI Audit Report`,
    ``,
    `**URL:** ${result.url}`,
    `**Code Directory:** ${result.codeDirectory}`,
    `**Generated:** ${result.timestamp}`,
    ``,
    `---`,
    ``,
    formatAccessibilityReport(result.accessibility),
    ``,
    `---`,
    ``,
    formatPerformanceReport(result.performance),
    ``,
    `---`,
    ``,
    formatCodeAnalysisReport(result.codeAnalysis),
  ];

  return sections.join("\n");
}
