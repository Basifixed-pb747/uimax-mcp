// ── Severity & Category ────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low";
export type FindingCategory = "bug" | "accessibility" | "performance" | "design" | "code-quality" | "ux";

// ── Screenshot ─────────────────────────────────────────────────────

export interface ScreenshotOptions {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly fullPage: boolean;
  readonly delay: number;
  readonly deviceScaleFactor: number;
}

export interface ScreenshotResult {
  readonly base64: string;
  readonly mimeType: "image/png";
  readonly width: number;
  readonly height: number;
  readonly url: string;
  readonly timestamp: string;
}

// ── Accessibility ──────────────────────────────────────────────────

export interface AccessibilityViolation {
  readonly id: string;
  readonly impact: "critical" | "serious" | "moderate" | "minor";
  readonly description: string;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly AccessibilityNode[];
}

export interface AccessibilityNode {
  readonly target: readonly string[];
  readonly html: string;
  readonly failureSummary: string;
}

export interface AccessibilityResult {
  readonly url: string;
  readonly timestamp: string;
  readonly violations: readonly AccessibilityViolation[];
  readonly passes: number;
  readonly incomplete: number;
  readonly inapplicable: number;
}

// ── Performance ────────────────────────────────────────────────────

export interface PerformanceMetrics {
  readonly url: string;
  readonly timestamp: string;
  readonly loadTime: number;
  readonly domContentLoaded: number;
  readonly firstPaint: number | null;
  readonly firstContentfulPaint: number | null;
  readonly largestContentfulPaint: number | null;
  readonly cumulativeLayoutShift: number | null;
  readonly totalBlockingTime: number | null;
  readonly domNodes: number;
  readonly resourceCount: number;
  readonly totalResourceSize: number;
  readonly jsHeapSize: number | null;
}

// ── Code Analysis ──────────────────────────────────────────────────

export interface CodeFinding {
  readonly file: string;
  readonly line: number | null;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly rule: string;
  readonly message: string;
  readonly suggestion: string;
}

export interface CodeAnalysisResult {
  readonly directory: string;
  readonly timestamp: string;
  readonly framework: string;
  readonly totalFiles: number;
  readonly totalLines: number;
  readonly findings: readonly CodeFinding[];
  readonly summary: {
    readonly components: number;
    readonly stylesheets: number;
    readonly avgFileSize: number;
    readonly largestFiles: readonly { file: string; lines: number }[];
  };
}

// ── Full Review ────────────────────────────────────────────────────

export interface FullReviewResult {
  readonly url: string;
  readonly codeDirectory: string;
  readonly timestamp: string;
  readonly screenshot: ScreenshotResult;
  readonly accessibility: AccessibilityResult;
  readonly performance: PerformanceMetrics;
  readonly codeAnalysis: CodeAnalysisResult;
}
