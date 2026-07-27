import * as cheerio from "cheerio";
import puppeteer, { KnownDevices } from "puppeteer";
import { GeoSignals, SlowResource } from "@/lib/types";

interface PageSpeedMetrics {
  performanceScore: number | null;
  lcpSec: number | null;
  fidMs: number | null;
  cls: number | null;
  mobileReadinessScore: number | null;
}

export interface AuditComputation {
  websiteUrl: string;
  pageTitle: string;
  metaDescription: string;
  h1Headings: string[];
  h2Headings: string[];
  condensedText: string;
  tokenOptimizedAudit: boolean;
  lighthousePerformanceScore: number | null;
  lcpSec: number | null;
  fidMs: number | null;
  cls: number | null;
  mobileReadinessScore: number | null;
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

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function collectHeadings($: cheerio.CheerioAPI, selector: string, max = 6): string[] {
  return dedupe(
    $(selector)
      .map((_, element) => cleanText($(element).text()))
      .get()
      .filter((value) => value.length > 0)
      .slice(0, max)
  );
}

function condensedMainText($: cheerio.CheerioAPI): string {
  const candidates = [
    cleanText($("main").text()),
    cleanText($("article").text()),
    cleanText($("body").text())
  ].filter((value) => value.length > 0);

  const best = candidates[0] ?? "";
  return best.slice(0, 800);
}

function computeGeoScore(signals: GeoSignals, hasCondensedText: boolean): number {
  let score = 40;
  if (signals.hasTitle) score += 15;
  if (signals.hasMetaDescription) score += 15;
  if (signals.hasSchemaMarkup) score += 12;
  if (signals.headingCount >= 2) score += 8;
  if (signals.hasFaqSignals) score += 5;
  if (signals.internalLinks >= 5) score += 5;
  if (hasCondensedText) score += 5;
  return clamp(score);
}

function computeUxScore(input: {
  mobileResponsive: boolean;
  mobileReadinessScore: number | null;
  h1Count: number;
  h2Count: number;
}): number {
  let score = 72;
  if (input.mobileResponsive) score += 8;
  if (input.mobileReadinessScore !== null) {
    score += Math.max(-18, Math.min(18, (input.mobileReadinessScore - 50) * 0.36));
  }
  if (input.h1Count >= 1) score += 6;
  if (input.h2Count >= 2) score += 6;
  return clamp(score);
}

function deriveCriticalIssues(input: {
  pageTitle: string;
  metaDescription: string;
  lcpSec: number | null;
  fidMs: number | null;
  cls: number | null;
  performanceScore: number;
  mobileReadinessScore: number | null;
}): string[] {
  const issues: string[] = [];
  if (!input.pageTitle) issues.push("Missing page title reduces search and GEO relevance.");
  if (!input.metaDescription) issues.push("Missing meta description weakens SERP and AI snippet context.");
  if (input.lcpSec !== null && input.lcpSec > 3) {
    issues.push(`LCP is ${input.lcpSec.toFixed(2)}s, causing delayed first-content engagement.`);
  }
  if (input.fidMs !== null && input.fidMs > 200) {
    issues.push(`FID is ${Math.round(input.fidMs)}ms, indicating slower interaction response.`);
  }
  if (input.cls !== null && input.cls > 0.15) {
    issues.push(`CLS is ${input.cls.toFixed(2)}, signaling visible layout instability.`);
  }
  if (input.performanceScore < 55) {
    issues.push(`Performance score ${input.performanceScore}/100 suggests major speed debt.`);
  }
  if (input.mobileReadinessScore !== null && input.mobileReadinessScore < 70) {
    issues.push("Mobile readiness is weak, likely reducing mobile conversion throughput.");
  }
  return dedupe(issues).slice(0, 5);
}

async function fetchPageSpeedMetrics(websiteUrl: string): Promise<PageSpeedMetrics> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", websiteUrl);
  endpoint.searchParams.set("strategy", "mobile");
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY ?? process.env.GOOGLE_SEARCH_API_KEY;
  if (apiKey) {
    endpoint.searchParams.set("key", apiKey);
  }

  try {
    const response = await fetch(endpoint.toString(), { cache: "no-store" });
    if (!response.ok) {
      return {
        performanceScore: null,
        lcpSec: null,
        fidMs: null,
        cls: null,
        mobileReadinessScore: null
      };
    }
    const payload = (await response.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: Record<string, { numericValue?: number; score?: number }>;
      };
    };

    const audits = payload.lighthouseResult?.audits ?? {};
    const lcpMs = audits["largest-contentful-paint"]?.numericValue ?? null;
    const fidMs =
      audits["max-potential-fid"]?.numericValue ??
      audits["total-blocking-time"]?.numericValue ??
      null;
    const cls = audits["cumulative-layout-shift"]?.numericValue ?? null;
    const mobileReadinessScoreRaw = audits["viewport"]?.score;
    const perfScoreRaw = payload.lighthouseResult?.categories?.performance?.score;

    return {
      performanceScore: perfScoreRaw !== undefined ? clamp(perfScoreRaw * 100) : null,
      lcpSec: lcpMs !== null ? Number((lcpMs / 1000).toFixed(2)) : null,
      fidMs: fidMs !== null ? Number(fidMs.toFixed(0)) : null,
      cls: cls !== null ? Number(cls.toFixed(2)) : null,
      mobileReadinessScore:
        mobileReadinessScoreRaw !== undefined ? clamp(mobileReadinessScoreRaw * 100) : null
    };
  } catch {
    return {
      performanceScore: null,
      lcpSec: null,
      fidMs: null,
      cls: null,
      mobileReadinessScore: null
    };
  }
}

export async function runWebsiteAudit(websiteUrl: string): Promise<AuditComputation> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.emulate(KnownDevices["iPhone 13"]);
    await page.goto(websiteUrl, { waitUntil: "networkidle2", timeout: 50000 });
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const runtime = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];
      const slowApiCalls = resources
        .filter(
          (entry) =>
            ["fetch", "xmlhttprequest"].includes(entry.initiatorType) && entry.duration > 900
        )
        .slice(0, 8)
        .map((entry) => ({ url: entry.name, durationMs: Math.round(entry.duration) }));
      const scriptSources = Array.from(document.querySelectorAll("script[src]"))
        .map((script) => script.getAttribute("src") ?? "")
        .filter(Boolean);
      const hasViewport = Boolean(
        document.querySelector('meta[name="viewport"]')?.getAttribute("content")?.trim()
      );
      const docWidth = document.documentElement.scrollWidth;
      const viewportWidth = window.innerWidth;
      return {
        domSize: document.querySelectorAll("*").length,
        loadTimeMs: Number.isFinite(nav?.loadEventEnd) ? Math.round(nav.loadEventEnd) : null,
        scriptSources,
        slowApiCalls,
        mobileResponsive: hasViewport && docWidth <= viewportWidth * 1.3
      };
    });

    const html = await page.content();
    const $ = cheerio.load(html);

    const pageTitle = cleanText($("title").first().text());
    const metaDescription = cleanText(
      $('meta[name="description"]').first().attr("content") ?? ""
    );
    const h1Headings = collectHeadings($, "h1", 4);
    const h2Headings = collectHeadings($, "h2", 8);
    const condensedText = condensedMainText($);
    const hasSchemaMarkup =
      $('script[type="application/ld+json"]')
        .toArray()
        .some((node) => cleanText($(node).text()).length > 0) ?? false;
    const hasFaqSignals =
      $('[itemtype*="FAQPage"]').length > 0 ||
      $('[aria-label*="faq" i], [class*="faq" i]').length > 0;
    const internalLinks = $("a[href]")
      .toArray()
      .filter((node) => ($(node).attr("href") ?? "").startsWith("/")).length;

    const geoSignals: GeoSignals = {
      hasTitle: Boolean(pageTitle),
      hasMetaDescription: Boolean(metaDescription),
      hasSchemaMarkup,
      hasFaqSignals,
      headingCount: h1Headings.length + h2Headings.length,
      internalLinks
    };

    const pageSpeed = await fetchPageSpeedMetrics(websiteUrl);
    const performanceScore = pageSpeed.performanceScore ?? 50;
    const lcpMs = pageSpeed.lcpSec !== null ? Math.round(pageSpeed.lcpSec * 1000) : null;
    const geoScore = computeGeoScore(geoSignals, condensedText.length > 0);
    const uxScore = computeUxScore({
      mobileResponsive: runtime.mobileResponsive,
      mobileReadinessScore: pageSpeed.mobileReadinessScore,
      h1Count: h1Headings.length,
      h2Count: h2Headings.length
    });
    const legacyScripts = dedupe(
      runtime.scriptSources.filter((src) => /jquery-1|jquery-2|angularjs|prototype/i.test(src))
    );
    const metaIssues = [
      !pageTitle ? "Missing <title> tag." : "",
      !metaDescription ? "Missing meta description." : ""
    ].filter(Boolean);
    const criticalIssues = deriveCriticalIssues({
      pageTitle,
      metaDescription,
      lcpSec: pageSpeed.lcpSec,
      fidMs: pageSpeed.fidMs,
      cls: pageSpeed.cls,
      performanceScore,
      mobileReadinessScore: pageSpeed.mobileReadinessScore
    });

    return {
      websiteUrl,
      pageTitle,
      metaDescription,
      h1Headings,
      h2Headings,
      condensedText,
      tokenOptimizedAudit: true,
      lighthousePerformanceScore: pageSpeed.performanceScore,
      lcpSec: pageSpeed.lcpSec,
      fidMs: pageSpeed.fidMs,
      cls: pageSpeed.cls,
      mobileReadinessScore: pageSpeed.mobileReadinessScore,
      lcpMs,
      domSize: runtime.domSize,
      loadTimeMs: runtime.loadTimeMs,
      mobileResponsive: runtime.mobileResponsive,
      performanceScore,
      geoScore,
      uxScore,
      criticalIssues,
      metaIssues,
      legacyScripts,
      slowApiCalls: runtime.slowApiCalls,
      geoSignals,
      rawDomExcerpt: condensedText
    };
  } finally {
    await browser.close();
  }
}
