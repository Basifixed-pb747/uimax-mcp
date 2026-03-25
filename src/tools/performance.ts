import type { PerformanceMetrics } from "../types.js";
import { createPage, closePage } from "../utils/browser.js";

/**
 * Measure performance metrics for a webpage.
 *
 * Captures Core Web Vitals and other performance indicators
 * using the browser's built-in Performance APIs.
 */
export async function measurePerformance(
  url: string
): Promise<PerformanceMetrics> {
  const page = await createPage(1440, 900);

  try {
    // Set up performance observers before navigation
    await page.evaluateOnNewDocument(() => {
      window.__perfMetrics = {
        lcp: null,
        cls: 0,
        tbt: 0,
        fid: null,
      };

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          window.__perfMetrics.lcp = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-expect-error LayoutShift API
          if (!entry.hadRecentInput) {
            // @ts-expect-error LayoutShift API
            window.__perfMetrics.cls += entry.value;
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });

      // Long Tasks (for TBT approximation)
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const blockingTime = entry.duration - 50;
          if (blockingTime > 0) {
            window.__perfMetrics.tbt += blockingTime;
          }
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    });

    // Navigate
    const startTime = Date.now();
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait a bit for metrics to settle
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Collect all metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;

      const paintEntries = performance.getEntriesByType("paint");
      const fpEntry = paintEntries.find((e) => e.name === "first-paint");
      const fcpEntry = paintEntries.find(
        (e) => e.name === "first-contentful-paint"
      );

      // Resource metrics
      const resources = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];
      const totalResourceSize = resources.reduce(
        (sum, r) => sum + (r.transferSize || 0),
        0
      );

      // DOM metrics
      const domNodes = document.querySelectorAll("*").length;

      // Memory (Chrome only)
      // @ts-expect-error Chrome-specific API
      const memInfo = performance.memory;

      return {
        loadTime: navigation
          ? navigation.loadEventEnd - navigation.startTime
          : 0,
        domContentLoaded: navigation
          ? navigation.domContentLoadedEventEnd - navigation.startTime
          : 0,
        firstPaint: fpEntry?.startTime ?? null,
        firstContentfulPaint: fcpEntry?.startTime ?? null,
        largestContentfulPaint: window.__perfMetrics?.lcp ?? null,
        cumulativeLayoutShift: window.__perfMetrics?.cls ?? null,
        totalBlockingTime: window.__perfMetrics?.tbt ?? null,
        domNodes,
        resourceCount: resources.length,
        totalResourceSize,
        jsHeapSize: memInfo?.usedJSHeapSize ?? null,
      };
    });

    return {
      url,
      timestamp: new Date().toISOString(),
      ...metrics,
    };
  } finally {
    await closePage(page);
  }
}

/**
 * Format performance metrics into a readable summary.
 */
export function formatPerformanceReport(metrics: PerformanceMetrics): string {
  const rating = (
    value: number | null,
    good: number,
    poor: number
  ): string => {
    if (value === null) return "N/A";
    if (value <= good) return `${value.toFixed(0)}ms (Good)`;
    if (value <= poor) return `${value.toFixed(0)}ms (Needs Improvement)`;
    return `${value.toFixed(0)}ms (Poor)`;
  };

  const clsRating = (value: number | null): string => {
    if (value === null) return "N/A";
    if (value <= 0.1) return `${value.toFixed(3)} (Good)`;
    if (value <= 0.25) return `${value.toFixed(3)} (Needs Improvement)`;
    return `${value.toFixed(3)} (Poor)`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return [
    `## Performance Metrics`,
    ``,
    `**URL:** ${metrics.url}`,
    `**Measured:** ${metrics.timestamp}`,
    ``,
    `### Core Web Vitals`,
    `| Metric | Value | Rating |`,
    `|--------|-------|--------|`,
    `| First Contentful Paint (FCP) | ${rating(metrics.firstContentfulPaint, 1800, 3000)} |`,
    `| Largest Contentful Paint (LCP) | ${rating(metrics.largestContentfulPaint, 2500, 4000)} |`,
    `| Cumulative Layout Shift (CLS) | ${clsRating(metrics.cumulativeLayoutShift)} |`,
    `| Total Blocking Time (TBT) | ${rating(metrics.totalBlockingTime, 200, 600)} |`,
    ``,
    `### Page Metrics`,
    `- **Load Time:** ${metrics.loadTime.toFixed(0)}ms`,
    `- **DOM Content Loaded:** ${metrics.domContentLoaded.toFixed(0)}ms`,
    `- **DOM Nodes:** ${metrics.domNodes}`,
    `- **Resources:** ${metrics.resourceCount}`,
    `- **Total Transfer Size:** ${formatBytes(metrics.totalResourceSize)}`,
    metrics.jsHeapSize
      ? `- **JS Heap Size:** ${formatBytes(metrics.jsHeapSize)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Type augmentation for the performance metrics we inject
declare global {
  interface Window {
    __perfMetrics: {
      lcp: number | null;
      cls: number;
      tbt: number;
      fid: number | null;
    };
  }
}
