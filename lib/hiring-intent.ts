import * as cheerio from "cheerio";

export interface HiringIntentCandidate {
  companyName: string;
  websiteUrl: string;
  listingUrl: string;
  roleMatched: string;
  country: string;
  market: "US" | "UAE" | "Other";
  notes: string;
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
};

const defaultRoles = [
  "Frontend Engineer",
  "React Developer",
  "Performance Optimization Specialist"
];

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeWebsiteUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.hostname}`.toLowerCase();
  } catch {
    return null;
  }
}

function detectCountry(content: string): string {
  const lower = content.toLowerCase();
  if (
    lower.includes("united arab emirates") ||
    lower.includes("uae") ||
    lower.includes("dubai") ||
    lower.includes("abu dhabi")
  ) {
    return "UAE";
  }
  if (
    lower.includes("united states") ||
    lower.includes(" usa ") ||
    lower.includes("u.s.")
  ) {
    return "US";
  }
  return "Unknown";
}

function detectMarket(country: string): "US" | "UAE" | "Other" {
  if (country === "US") {
    return "US";
  }
  if (country === "UAE") {
    return "UAE";
  }
  return "Other";
}

function companyNameFromTitle(title: string): string {
  const candidate = cleanText(title)
    .replace(/\s+\|\s+.*$/g, "")
    .replace(/\s+-\s+(jobs|careers|job openings).*$/i, "")
    .split(" at ")
    .pop();
  if (candidate && candidate.length >= 3) {
    return candidate;
  }
  return "Hiring Company";
}

function companySlugFromJobUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (host.includes("lever.co") && pathParts.length > 0) {
      return pathParts[0] ?? null;
    }
    if (host.includes("greenhouse.io") && pathParts.length > 0) {
      return pathParts[0] ?? null;
    }
    if (host.includes("workable.com") && pathParts.length > 0) {
      return pathParts[0] ?? null;
    }
    if (host.includes("ashbyhq.com") && pathParts.length > 0) {
      return pathParts[0] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: defaultHeaders, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function searchWithGoogle(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !searchEngineId) {
    return [];
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", searchEngineId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Google Search API request failed (${response.status}).`);
  }
  const payload = (await response.json()) as {
    items?: { title: string; link: string; snippet: string }[];
  };
  return (payload.items ?? []).map((item) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet
  }));
}

async function searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);

  const results: SearchResult[] = [];
  $("a.result__a").each((_, element) => {
    const title = cleanText($(element).text());
    const href = $(element).attr("href");
    const snippet = cleanText(
      $(element).closest(".result").find(".result__snippet").text() ?? ""
    );
    if (!href) {
      return;
    }
    const resolved = href.startsWith("//") ? `https:${href}` : href;
    results.push({ title, link: resolved, snippet });
  });

  return results.slice(0, 12);
}

async function collectSearchResults(query: string): Promise<SearchResult[]> {
  try {
    const google = await searchWithGoogle(query);
    if (google.length > 0) {
      return google;
    }
  } catch {
    // Fall back to DuckDuckGo if Google credentials are unavailable.
  }
  return searchWithDuckDuckGo(query);
}

function companyWebsiteFromPage(html: string, listingUrl: string): string | null {
  const $ = cheerio.load(html);
  const listingHost = new URL(listingUrl).hostname.toLowerCase();
  const externalLinks = $("a[href^='http']")
    .map((_, anchor) => cleanText($(anchor).attr("href") ?? ""))
    .get()
    .filter(Boolean)
    .filter((href) => {
      try {
        const host = new URL(href).hostname.toLowerCase();
        return (
          host !== listingHost &&
          !host.includes("linkedin.com") &&
          !host.includes("twitter.com") &&
          !host.includes("x.com") &&
          !host.includes("facebook.com")
        );
      } catch {
        return false;
      }
    });
  if (externalLinks.length > 0) {
    return normalizeWebsiteUrl(externalLinks[0] ?? "");
  }

  const slug = companySlugFromJobUrl(listingUrl);
  if (!slug) {
    return null;
  }
  return normalizeWebsiteUrl(`https://${slug}.com`);
}

async function toHiringIntentCandidate(
  result: SearchResult,
  role: string
): Promise<HiringIntentCandidate | null> {
  const listingUrl = normalizeUrl(result.link);
  if (!listingUrl) {
    return null;
  }

  try {
    const html = await fetchText(listingUrl);
    const websiteUrl = companyWebsiteFromPage(html, listingUrl);
    if (!websiteUrl) {
      return null;
    }

    const companyNameFromMeta = cleanText(
      cheerio.load(html)("meta[property='og:site_name']").attr("content") ?? ""
    );
    const companyName =
      companyNameFromMeta && companyNameFromMeta.length >= 2
        ? companyNameFromMeta
        : companyNameFromTitle(result.title);
    const locationSignal = `${result.snippet} ${html.slice(0, 2500)}`;
    const country = detectCountry(locationSignal);

    return {
      companyName,
      websiteUrl,
      listingUrl,
      roleMatched: role,
      country,
      market: detectMarket(country),
      notes: `High-intent hiring signal: actively hiring "${role}" role. Job listing: ${listingUrl}`
    };
  } catch {
    return null;
  }
}

export async function scrapeHiringIntentCompanies(
  roles = defaultRoles,
  limitPerRole = 5
): Promise<HiringIntentCandidate[]> {
  const candidates: HiringIntentCandidate[] = [];

  for (const role of roles) {
    const searchQuery = `${role} hiring SaaS careers`;
    const results = await collectSearchResults(searchQuery);
    const deduped = unique(results.map((result) => result.link))
      .slice(0, limitPerRole * 2)
      .map((link) => results.find((item) => item.link === link))
      .filter((item): item is SearchResult => Boolean(item));

    for (const result of deduped) {
      const candidate = await toHiringIntentCandidate(result, role);
      if (candidate) {
        candidates.push(candidate);
      }
      if (candidates.filter((item) => item.roleMatched === role).length >= limitPerRole) {
        break;
      }
    }
  }

  const dedupedByWebsite = new Map<string, HiringIntentCandidate>();
  for (const candidate of candidates) {
    if (!dedupedByWebsite.has(candidate.websiteUrl)) {
      dedupedByWebsite.set(candidate.websiteUrl, candidate);
    }
  }

  return [...dedupedByWebsite.values()];
}
