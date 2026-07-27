import * as cheerio from "cheerio";
import puppeteer, { KnownDevices } from "puppeteer";
import { GeoSignals, SlowResource } from "@/lib/types";

export interface AuditComputation {
  websiteUrl: string;
  lcpMs: number | null;
  domSize: number;
  loadTimeMs: number | null;
  mobileResponsive: boolean;
  performanceScore: number;
  geoScore: number;
  uxScore: number;
  criticalIssues: string[];
  metaIssues: string[];
  legacyScripts: string[];
  slowApiCalls: SlowResource[];
  geoSignals: GeoSignals;
  rawDomExcerpt: string;
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computePerformanceScore(metrics: {
  lcpMs: number | null;
  loadTimeMs: number | null;
  domSize: number;
  slowApiCount: number;
}): number {
  let score = 100;
  if (metrics.lcpMs) {
    score -= Math.max(0, (metrics.lcpMs - 2500) / 110);
  }
  if (metrics.loadTimeMs) {
    score -= Math.max(0, (metrics.loadTimeMs - 3200) / 150);
  }
  score -= Math.max(0, (metrics.domSize - 1800) / 70);
  score -= metrics.slowApiCount * 3.5;
  return boundedScore(score);
}

function computeGeoScore(signals: GeoSignals): number {
  let score = 45;
  if (signals.hasTitle) score += 10;
  if (signals.hasMetaDescription) score += 10;
  if (signals.hasSchemaMarkup) score += 17;
  if (signals.hasFaqSignals) score += 8;
  score += Math.min(10, signals.headingCount * 1.2);
  score += Math.min(10, signals.internalLinks * 0.4);
  return boundedScore(score);
}

function computeUxScore(input: {
  mobileResponsive: boolean;
  missingMetaCount: number;
  legacyScriptCount: number;
  domSize: number;
}): number {
  let score = 88;
  if (!input.mobileResponsive) score -= 18;
  score -= input.missingMetaCount * 7;
  score -= input.legacyScriptCount * 4;
  score -= Math.max(0, (input.domSize - 2200) / 90);
  return boundedScore(score);
}

function detectCriticalIssues(metrics: {
  lcpMs: number | null;
  domSize: number;
  mobileResponsive: boolean;
  hasSchemaMarkup: boolean;
  slowApiCalls: SlowResource[];
}): string[] {
  const issues: string[] = [];
  if (metrics.lcpMs && metrics.lcpMs > 4000) {
    issues.push(`LCP is ${Math.round(metrics.lcpMs)}ms, far above mobile threshold.`);
  }
  if (metrics.domSize > 2500) {
    issues.push(`DOM size (${metrics.domSize}) is excessive and likely hurting runtime performance.`);
  }
  if (!metrics.mobileResponsive) {
    issues.push("Viewport/mobile responsiveness signal is missing or weak.");
  }
  if (!metrics.hasSchemaMarkup) {
    issues.push("Structured data is missing, reducing AI Overview / GEO visibility.");
  }
  if (metrics.slowApiCalls.length > 0) {
    issues.push(`${metrics.slowApiCalls.length} slow API/resource calls detected over 800ms.`);
  }
  return issues.slice(0, 5);
}

function buildMetaIssues(hasTitle: boolean, hasMetaDescription: boolean, hasViewport: boolean): string[] {
  const issues: string[] = [];
  if (!hasTitle) issues.push("Missing <title> tag.");
  if (!hasMetaDescription) issues.push("Missing meta description.");
  if (!hasViewport) issues.push("Missing viewport meta tag for mobile rendering.");
  return issues;
}

function extractRawDomExcerpt(html: string): string {
  const $ = cheerio.load(html);
  const plainText = $("body").text().replace(/\s+/g, " ").trim();
  return plainText.slice(0, 7000);
}

export async function runWebsiteAudit(websiteUrl: string): Promise<AuditComputation> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.emulate(KnownDevices["iPhone 13"]);

    await page.evaluateOnNewDocument(() => {
      (window as Window & { __auditLcp?: number | null }).__auditLcp = null;
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const latest = entries[entries.length - 1];
        if (latest) {
          (window as Window & { __auditLcp?: number | null }).__auditLcp = latest.startTime;
        }
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          observer.disconnect();
        }
      });
    });

    await page.goto(websiteUrl, { waitUntil: "networkidle2", timeout: 50000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];
      const slowApiCalls = resources
        .filter(
          (entry) =>
            ["fetch", "xmlhttprequest"].includes(entry.initiatorType) && entry.duration > 800
        )
        .slice(0, 15)
        .map((entry) => ({ url: entry.name, durationMs: Math.round(entry.duration) }));
      const scriptSources = Array.from(document.querySelectorAll("script[src]"))
        .map((script) => script.getAttribute("src") ?? "")
        .filter(Boolean);
      const hasTitle = Boolean(document.querySelector("title")?.textContent?.trim());
      const hasMetaDescription = Boolean(
        document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim()
      );
      const hasViewport = Boolean(
        document.querySelector('meta[name="viewport"]')?.getAttribute("content")?.trim()
      );
      const schemaScripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      ).filter((script) => (script.textContent ?? "").trim().length > 0);
      const headingCount = document.querySelectorAll("h1, h2, h3").length;
      const internalLinks = Array.from(document.querySelectorAll("a[href]")).filter((anchor) =>
        (anchor.getAttribute("href") ?? "").startsWith("/")
      ).length;
      const hasFaqSignals =
        document.querySelectorAll('[itemtype*="FAQPage"]').length > 0 ||
        document.querySelectorAll('[aria-label*="faq" i], [class*="faq" i]').length > 0;
      const docWidth = document.documentElement.scrollWidth;
      const viewportWidth = window.innerWidth;
      const mobileResponsive = hasViewport && docWidth <= viewportWidth * 1.3;

      return {
        lcpMs: (window as Window & { __auditLcp?: number | null }).__auditLcp ?? null,
        domSize: document.querySelectorAll("*").length,
        loadTimeMs: Number.isFinite(nav?.loadEventEnd) ? Math.round(nav.loadEventEnd) : null,
        hasTitle,
        hasMetaDescription,
        hasViewport,
        schemaCount: schemaScripts.length,
        hasFaqSignals,
        headingCount,
        internalLinks,
        scriptSources,
        mobileResponsive,
        slowApiCalls
      };
    });

    const html = await page.content();
    const lowerHtml = html.toLowerCase();
    const legacyScripts = metrics.scriptSources
      .filter((src) => /jquery-1|jquery-2|angularjs|requirejs|prototype/i.test(src))
      .slice(0, 10);

    const geoSignals: GeoSignals = {
      hasTitle: metrics.hasTitle,
      hasMetaDescription: metrics.hasMetaDescription,
      hasSchemaMarkup: metrics.schemaCount > 0,
      hasFaqSignals: metrics.hasFaqSignals,
      headingCount: metrics.headingCount,
      internalLinks: metrics.internalLinks
    };

    const performanceScore = computePerformanceScore({
      lcpMs: metrics.lcpMs,
      loadTimeMs: metrics.loadTimeMs,
      domSize: metrics.domSize,
      slowApiCount: metrics.slowApiCalls.length
    });
    const geoScore = computeGeoScore(geoSignals);
    const uxScore = computeUxScore({
      mobileResponsive: metrics.mobileResponsive,
      missingMetaCount: buildMetaIssues(
        metrics.hasTitle,
        metrics.hasMetaDescription,
        metrics.hasViewport
      ).length,
      legacyScriptCount: legacyScripts.length,
      domSize: metrics.domSize
    });

    const criticalIssues = detectCriticalIssues({
      lcpMs: metrics.lcpMs,
      domSize: metrics.domSize,
      mobileResponsive: metrics.mobileResponsive,
      hasSchemaMarkup: geoSignals.hasSchemaMarkup,
      slowApiCalls: metrics.slowApiCalls
    });

    if (lowerHtml.includes("lighthouse")) {
      criticalIssues.push("Pre-existing test artifacts found in page output; audit hygiene may be weak.");
    }

    return {
      websiteUrl,
      lcpMs: metrics.lcpMs,
      domSize: metrics.domSize,
      loadTimeMs: metrics.loadTimeMs,
      mobileResponsive: metrics.mobileResponsive,
      performanceScore,
      geoScore,
      uxScore,
      criticalIssues: uniqueList(criticalIssues),
      metaIssues: buildMetaIssues(metrics.hasTitle, metrics.hasMetaDescription, metrics.hasViewport),
      legacyScripts: uniqueList(legacyScripts),
      slowApiCalls: metrics.slowApiCalls,
      geoSignals,
      rawDomExcerpt: extractRawDomExcerpt(html)
    };
  } finally {
    await browser.close();
  }
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values)];
}
