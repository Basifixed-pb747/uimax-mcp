import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AccessibilityResult, AccessibilityViolation } from "../types.js";
import { createPage, navigateAndWait, closePage } from "../utils/browser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the path to the axe-core source file.
 */
async function getAxeSource(): Promise<string> {
  // Try multiple resolution paths
  const possiblePaths = [
    resolve(__dirname, "../../node_modules/axe-core/axe.min.js"),
    resolve(__dirname, "../../../node_modules/axe-core/axe.min.js"),
  ];

  for (const axePath of possiblePaths) {
    try {
      return await readFile(axePath, "utf-8");
    } catch {
      continue;
    }
  }

  // Fallback: try to require.resolve
  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const axePath = require.resolve("axe-core/axe.min.js");
    return await readFile(axePath, "utf-8");
  } catch {
    throw new Error(
      "Could not find axe-core. Make sure it is installed: npm install axe-core"
    );
  }
}

/**
 * Run an accessibility audit on a webpage using axe-core.
 *
 * Injects axe-core into the page and runs a full audit,
 * returning WCAG 2.1 violations with impact levels and fix suggestions.
 */
export async function runAccessibilityAudit(
  url: string
): Promise<AccessibilityResult> {
  const page = await createPage(1440, 900);

  try {
    await navigateAndWait(page, url, 500);

    // Inject axe-core into the page
    const axeSource = await getAxeSource();
    await page.evaluate(axeSource);

    // Run the audit
    const rawResults = await page.evaluate(async () => {
      // @ts-expect-error axe is injected at runtime
      const results = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
      });

      return {
        violations: results.violations.map(
          (v: {
            id: string;
            impact: string;
            description: string;
            help: string;
            helpUrl: string;
            nodes: Array<{
              target: string[];
              html: string;
              failureSummary: string;
            }>;
          }) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.slice(0, 5).map(
              (n: {
                target: string[];
                html: string;
                failureSummary: string;
              }) => ({
                target: n.target,
                html: n.html.slice(0, 200),
                failureSummary: n.failureSummary,
              })
            ),
          })
        ),
        passCount: results.passes.length,
        incompleteCount: results.incomplete.length,
        inapplicableCount: results.inapplicable.length,
      };
    });

    return {
      url,
      timestamp: new Date().toISOString(),
      violations: rawResults.violations as readonly AccessibilityViolation[],
      passes: rawResults.passCount,
      incomplete: rawResults.incompleteCount,
      inapplicable: rawResults.inapplicableCount,
    };
  } finally {
    await closePage(page);
  }
}

/**
 * Format accessibility results into a readable summary.
 */
export function formatAccessibilityReport(
  result: AccessibilityResult
): string {
  const lines: string[] = [
    `## Accessibility Audit Results`,
    ``,
    `**URL:** ${result.url}`,
    `**Scanned:** ${result.timestamp}`,
    `**Violations:** ${result.violations.length}`,
    `**Passes:** ${result.passes}`,
    `**Incomplete:** ${result.incomplete}`,
    ``,
  ];

  if (result.violations.length === 0) {
    lines.push("No accessibility violations found.");
    return lines.join("\n");
  }

  // Group by impact
  const byImpact = {
    critical: [] as AccessibilityViolation[],
    serious: [] as AccessibilityViolation[],
    moderate: [] as AccessibilityViolation[],
    minor: [] as AccessibilityViolation[],
  };

  for (const violation of result.violations) {
    const bucket = byImpact[violation.impact];
    if (bucket) {
      bucket.push(violation);
    }
  }

  for (const [impact, violations] of Object.entries(byImpact)) {
    if (violations.length === 0) continue;

    lines.push(`### ${impact.toUpperCase()} (${violations.length})`);
    lines.push(``);

    for (const v of violations) {
      lines.push(`- **${v.id}**: ${v.help}`);
      lines.push(`  ${v.description}`);
      lines.push(`  [Learn more](${v.helpUrl})`);

      for (const node of v.nodes.slice(0, 3)) {
        lines.push(`  - Element: \`${node.target.join(" > ")}\``);
        lines.push(`    Fix: ${node.failureSummary}`);
      }

      lines.push(``);
    }
  }

  return lines.join("\n");
}
