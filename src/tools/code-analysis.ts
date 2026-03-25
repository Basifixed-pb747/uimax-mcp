import type { CodeFinding, CodeAnalysisResult, Severity, FindingCategory } from "../types.js";
import {
  collectFrontendFiles,
  detectFramework,
  type FileInfo,
} from "../utils/file-utils.js";

// ── Analysis Rules ─────────────────────────────────────────────────

interface Rule {
  readonly id: string;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly message: string;
  readonly suggestion: string;
  readonly pattern: RegExp;
  readonly fileTypes: readonly string[];
}

const RULES: readonly Rule[] = [
  // ── Accessibility Rules ──
  {
    id: "img-no-alt",
    severity: "high",
    category: "accessibility",
    message: "Image element missing alt attribute",
    suggestion: "Add an alt attribute describing the image content, or alt=\"\" for decorative images",
    pattern: /<img(?![^>]*\balt\b)[^>]*>/gi,
    fileTypes: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
  },
  {
    id: "click-no-keyboard",
    severity: "high",
    category: "accessibility",
    message: "onClick handler without keyboard event handler (onKeyDown/onKeyUp)",
    suggestion: "Add onKeyDown or onKeyUp handler alongside onClick, or use a <button> element instead",
    pattern: /onClick\s*=\s*\{[^}]*\}(?![^<]*(?:onKeyDown|onKeyUp|onKeyPress))/gi,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "no-form-label",
    severity: "high",
    category: "accessibility",
    message: "Input element may be missing an associated label",
    suggestion: "Wrap input in a <label>, use htmlFor/for attribute, or add aria-label/aria-labelledby",
    pattern: /<input(?![^>]*(?:aria-label|aria-labelledby|id\s*=))[^>]*>/gi,
    fileTypes: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
  },
  {
    id: "no-lang-attr",
    severity: "medium",
    category: "accessibility",
    message: "HTML element missing lang attribute",
    suggestion: "Add lang attribute to <html> element (e.g., <html lang=\"en\">)",
    pattern: /<html(?![^>]*\blang\b)[^>]*>/gi,
    fileTypes: [".html"],
  },

  // ── Code Quality Rules ──
  {
    id: "console-log",
    severity: "low",
    category: "code-quality",
    message: "console.log statement found (likely debug code)",
    suggestion: "Remove console.log or replace with a proper logging utility",
    pattern: /console\.(log|debug|info)\s*\(/g,
    fileTypes: [".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte"],
  },
  {
    id: "todo-fixme",
    severity: "low",
    category: "code-quality",
    message: "TODO/FIXME comment found",
    suggestion: "Address the TODO/FIXME or create a tracking issue",
    pattern: /(?:\/\/|\/\*|<!--)\s*(?:TODO|FIXME|HACK|XXX)\b/gi,
    fileTypes: [".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".css", ".html"],
  },
  {
    id: "inline-style",
    severity: "medium",
    category: "code-quality",
    message: "Inline style attribute found",
    suggestion: "Move styles to a CSS file, CSS module, or styled component for better maintainability",
    pattern: /style\s*=\s*\{\s*\{/g,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "any-type",
    severity: "medium",
    category: "code-quality",
    message: "TypeScript 'any' type usage found",
    suggestion: "Replace 'any' with a specific type or 'unknown' for type safety",
    pattern: /:\s*any\b/g,
    fileTypes: [".tsx", ".ts"],
  },
  {
    id: "magic-number",
    severity: "low",
    category: "code-quality",
    message: "Magic number in JSX/style (not 0 or 1)",
    suggestion: "Extract magic numbers into named constants or design tokens",
    pattern: /(?:width|height|margin|padding|top|left|right|bottom|gap|fontSize|size)\s*[:=]\s*['"]?\d{2,}/g,
    fileTypes: [".tsx", ".jsx", ".css", ".scss"],
  },

  // ── Design Rules ──
  {
    id: "important-css",
    severity: "medium",
    category: "design",
    message: "!important flag in CSS (specificity issue)",
    suggestion: "Refactor CSS specificity instead of using !important",
    pattern: /!important/g,
    fileTypes: [".css", ".scss", ".sass", ".less"],
  },
  {
    id: "hardcoded-color",
    severity: "low",
    category: "design",
    message: "Hardcoded hex color (not using design token/variable)",
    suggestion: "Use CSS custom properties or design tokens for consistent theming",
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    fileTypes: [".tsx", ".jsx", ".css", ".scss"],
  },
  {
    id: "z-index-high",
    severity: "medium",
    category: "design",
    message: "High z-index value (potential stacking context issue)",
    suggestion: "Use a z-index scale system with named layers instead of arbitrary values",
    pattern: /z-index\s*:\s*(?:[5-9]\d{2,}|\d{4,})/g,
    fileTypes: [".css", ".scss", ".tsx", ".jsx"],
  },

  // ── Performance Rules ──
  {
    id: "no-lazy-image",
    severity: "medium",
    category: "performance",
    message: "Image without loading=\"lazy\" (may impact initial load)",
    suggestion: "Add loading=\"lazy\" for below-the-fold images",
    pattern: /<img(?![^>]*loading\s*=)[^>]*src\s*=/gi,
    fileTypes: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
  },
  {
    id: "large-bundle-import",
    severity: "medium",
    category: "performance",
    message: "Full library import detected (could increase bundle size)",
    suggestion: "Use named/tree-shakeable imports (e.g., import { specific } from 'lib')",
    pattern: /import\s+\w+\s+from\s+['"](?:lodash|moment|date-fns|rxjs)['"](?!\s*\/)/g,
    fileTypes: [".tsx", ".jsx", ".ts", ".js"],
  },

  // ── UX Rules ──
  {
    id: "missing-error-boundary",
    severity: "medium",
    category: "ux",
    message: "React component without error boundary in ancestry",
    suggestion: "Wrap major UI sections with an ErrorBoundary component",
    pattern: /(?:export\s+(?:default\s+)?function|const\s+\w+\s*=\s*(?:\(\)|React\.memo|forwardRef))\s*(?:\w+)?\s*\(/g,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "no-loading-state",
    severity: "medium",
    category: "ux",
    message: "Async operation without visible loading state",
    suggestion: "Add loading indicators for async operations (spinner, skeleton, or progress bar)",
    pattern: /(?:await\s+fetch|useQuery|useSWR|axios\.)(?![^]*(?:loading|isLoading|pending|skeleton|spinner))/g,
    fileTypes: [".tsx", ".jsx"],
  },
];

// ── File-Level Checks ──────────────────────────────────────────────

function checkFileSize(file: FileInfo): CodeFinding | null {
  if (file.lineCount > 500) {
    return {
      file: file.relativePath,
      line: null,
      severity: file.lineCount > 800 ? "high" : "medium",
      category: "code-quality",
      rule: "large-file",
      message: `File has ${file.lineCount} lines (recommended max: 400)`,
      suggestion:
        "Split into smaller, focused modules with single responsibilities",
    };
  }
  return null;
}

function checkDeepNesting(file: FileInfo): CodeFinding | null {
  const lines = file.content.split("\n");
  let maxIndent = 0;
  let maxLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;

    const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    const indent = leadingSpaces / 2; // Assuming 2-space indent

    if (indent > maxIndent) {
      maxIndent = indent;
      maxLine = i + 1;
    }
  }

  if (maxIndent > 6) {
    return {
      file: file.relativePath,
      line: maxLine,
      severity: maxIndent > 8 ? "high" : "medium",
      category: "code-quality",
      rule: "deep-nesting",
      message: `Deep nesting detected (${maxIndent} levels)`,
      suggestion:
        "Extract nested logic into helper functions or use early returns",
    };
  }
  return null;
}

// ── Main Analysis ──────────────────────────────────────────────────

/**
 * Analyze frontend code for common issues, anti-patterns, and improvements.
 *
 * Scans TypeScript/JavaScript, CSS, and HTML files for accessibility issues,
 * code quality problems, design inconsistencies, and performance concerns.
 */
export async function analyzeCode(
  directory: string
): Promise<CodeAnalysisResult> {
  const framework = await detectFramework(directory);
  const files = await collectFrontendFiles(directory);

  const findings: CodeFinding[] = [];
  let totalLines = 0;
  let componentCount = 0;
  let stylesheetCount = 0;

  for (const file of files) {
    totalLines += file.lineCount;

    // Count components and stylesheets
    if ([".tsx", ".jsx", ".vue", ".svelte"].includes(file.extension)) {
      componentCount++;
    }
    if ([".css", ".scss", ".sass", ".less"].includes(file.extension)) {
      stylesheetCount++;
    }

    // Run pattern-based rules
    for (const rule of RULES) {
      if (!rule.fileTypes.includes(file.extension)) continue;

      const matches = file.content.matchAll(rule.pattern);
      let matchCount = 0;

      for (const match of matches) {
        matchCount++;
        if (matchCount > 5) break; // Limit findings per rule per file

        // Find line number
        const beforeMatch = file.content.slice(0, match.index);
        const lineNumber = beforeMatch.split("\n").length;

        findings.push({
          file: file.relativePath,
          line: lineNumber,
          severity: rule.severity,
          category: rule.category,
          rule: rule.id,
          message: rule.message,
          suggestion: rule.suggestion,
        });
      }
    }

    // Run file-level checks
    const sizeCheck = checkFileSize(file);
    if (sizeCheck) findings.push(sizeCheck);

    const nestingCheck = checkDeepNesting(file);
    if (nestingCheck) findings.push(nestingCheck);
  }

  // Sort findings by severity
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortedFindings = [...findings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  // Find largest files
  const sortedFiles = [...files].sort((a, b) => b.lineCount - a.lineCount);
  const largestFiles = sortedFiles.slice(0, 5).map((f) => ({
    file: f.relativePath,
    lines: f.lineCount,
  }));

  const avgFileSize =
    files.length > 0
      ? Math.round(totalLines / files.length)
      : 0;

  return {
    directory,
    timestamp: new Date().toISOString(),
    framework,
    totalFiles: files.length,
    totalLines,
    findings: sortedFindings,
    summary: {
      components: componentCount,
      stylesheets: stylesheetCount,
      avgFileSize,
      largestFiles,
    },
  };
}

/**
 * Format code analysis results into a readable summary.
 */
export function formatCodeAnalysisReport(result: CodeAnalysisResult): string {
  const lines: string[] = [
    `## Code Analysis Results`,
    ``,
    `**Directory:** ${result.directory}`,
    `**Framework:** ${result.framework}`,
    `**Files Analyzed:** ${result.totalFiles}`,
    `**Total Lines:** ${result.totalLines.toLocaleString()}`,
    `**Avg File Size:** ${result.summary.avgFileSize} lines`,
    `**Components:** ${result.summary.components}`,
    `**Stylesheets:** ${result.summary.stylesheets}`,
    ``,
  ];

  if (result.summary.largestFiles.length > 0) {
    lines.push(`### Largest Files`);
    for (const f of result.summary.largestFiles) {
      lines.push(`- ${f.file} (${f.lines} lines)`);
    }
    lines.push(``);
  }

  // Group findings by category
  const byCategory = new Map<string, CodeFinding[]>();
  for (const finding of result.findings) {
    const existing = byCategory.get(finding.category) ?? [];
    byCategory.set(finding.category, [...existing, finding]);
  }

  const categoryLabels: Record<string, string> = {
    accessibility: "Accessibility",
    "code-quality": "Code Quality",
    design: "Design Consistency",
    performance: "Performance",
    ux: "User Experience",
    bug: "Bugs",
  };

  lines.push(`### Findings (${result.findings.length} total)`);
  lines.push(``);

  for (const [category, categoryFindings] of byCategory) {
    const label = categoryLabels[category] ?? category;
    lines.push(`#### ${label} (${categoryFindings.length})`);
    lines.push(``);

    for (const f of categoryFindings.slice(0, 20)) {
      const loc = f.line ? `:${f.line}` : "";
      lines.push(`- **[${f.severity.toUpperCase()}]** ${f.file}${loc}`);
      lines.push(`  ${f.message}`);
      lines.push(`  → ${f.suggestion}`);
      lines.push(``);
    }
  }

  return lines.join("\n");
}
