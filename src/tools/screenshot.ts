import type { ScreenshotResult } from "../types.js";
import { createPage, navigateAndWait, closePage } from "../utils/browser.js";

export interface ScreenshotInput {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
  readonly fullPage?: boolean;
  readonly delay?: number;
  readonly deviceScaleFactor?: number;
}

/**
 * Capture a screenshot of a webpage.
 * Returns base64-encoded PNG that Claude can view directly.
 */
export async function captureScreenshot(
  input: ScreenshotInput
): Promise<ScreenshotResult> {
  const width = input.width ?? 1440;
  const height = input.height ?? 900;
  const fullPage = input.fullPage ?? true;
  const delay = input.delay ?? 1000;
  const deviceScaleFactor = input.deviceScaleFactor ?? 2;

  const page = await createPage(width, height, deviceScaleFactor);

  try {
    await navigateAndWait(page, input.url, delay);

    const screenshotBuffer = await page.screenshot({
      type: "png",
      fullPage,
      encoding: "binary",
    });

    const base64 = Buffer.from(screenshotBuffer).toString("base64");

    return {
      base64,
      mimeType: "image/png",
      width,
      height,
      url: input.url,
      timestamp: new Date().toISOString(),
    };
  } finally {
    await closePage(page);
  }
}

/**
 * Capture multiple viewport sizes for responsive review.
 */
export async function captureResponsiveScreenshots(
  url: string
): Promise<readonly ScreenshotResult[]> {
  const viewports = [
    { width: 375, height: 812, label: "mobile" },
    { width: 768, height: 1024, label: "tablet" },
    { width: 1440, height: 900, label: "desktop" },
  ] as const;

  const results: ScreenshotResult[] = [];

  for (const viewport of viewports) {
    const result = await captureScreenshot({
      url,
      width: viewport.width,
      height: viewport.height,
      fullPage: true,
      delay: 1000,
      deviceScaleFactor: 2,
    });
    results.push(result);
  }

  return results;
}
