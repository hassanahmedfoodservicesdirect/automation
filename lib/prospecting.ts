import * as cheerio from "cheerio";

export interface ProspectLeadCandidate {
  companyName: string;
  websiteUrl: string;
  contactEmail: string | null;
  country: string;
  market: "US" | "UAE" | "Other";
  techStack: string[];
  niche: string;
  source: string;
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

const stackHints: Record<string, string[]> = {
  "Next.js": ["_next/", "__NEXT_DATA__", "nextjs"],
  React: ["react", "react-dom"],
  Shopify: ["cdn.shopify.com", "shopify"],
  WordPress: ["wp-content", "wp-includes", "wordpress"],
  Webflow: ["webflow", "w-webflow"],
  HubSpot: ["hs-scripts", "hubspot"],
  Vue: ["vue", "__VUE__"],
  Angular: ["angular", "ng-app"]
};

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeWebsiteUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.hostname}`.toLowerCase();
  } catch {
    return null;
  }
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function extractEmails(content: string): string[] {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/g;
  return unique((content.match(regex) ?? []).map((email) => email.toLowerCase())).slice(0, 20);
}

function pickFounderOrCtoEmail(emails: string[]): string | null {
  if (emails.length === 0) {
    return null;
  }
  const preferred = emails.find((email) =>
    ["founder", "cto", "ceo", "hello", "team"].some((token) => email.includes(token))
  );
  return preferred ?? emails[0];
}

function detectCountry(url: string, content: string): string {
  if (url.endsWith(".ae") || content.toLowerCase().includes("united arab emirates")) {
    return "UAE";
  }
  if (
    url.endsWith(".us") ||
    content.toLowerCase().includes("united states") ||
    content.toLowerCase().includes("usa")
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

function detectTechStack(html: string): string[] {
  const lower = html.toLowerCase();
  const detected = Object.entries(stackHints)
    .filter(([, hints]) => hints.some((hint) => lower.includes(hint.toLowerCase())))
    .map(([name]) => name);
  return detected;
}

function parseCompanyName(title: string, hostname: string): string {
  const trimmed = title
    .split("|")[0]
    .split("-")[0]
    .trim();
  if (trimmed.length >= 3) {
    return trimmed;
  }
  const firstPart = hostname.split(".")[0] ?? hostname;
  return firstPart
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    const title = $(element).text().trim();
    const href = $(element).attr("href");
    const snippet =
      $(element).closest(".result").find(".result__snippet").text().trim() ?? "";
    if (!href) {
      return;
    }

    let resolved = href;
    if (href.startsWith("//")) {
      resolved = `https:${href}`;
    }
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
    // Fall back to DuckDuckGo when Google API credentials are unavailable or failing.
  }
  return searchWithDuckDuckGo(query);
}

export async function discoverProspects(
  niches: string[],
  limitPerNiche = 8
): Promise<ProspectLeadCandidate[]> {
  const candidates: ProspectLeadCandidate[] = [];

  for (const niche of niches) {
    const results = await collectSearchResults(niche);
    const dedupedResults = unique(results.map((result) => result.link))
      .slice(0, limitPerNiche)
      .map((link) => results.find((item) => item.link === link))
      .filter((value): value is SearchResult => Boolean(value));

    for (const result of dedupedResults) {
      const normalizedUrl = normalizeWebsiteUrl(result.link);
      if (!normalizedUrl) {
        continue;
      }

      try {
        const homepage = await fetchText(normalizedUrl);
        const $ = cheerio.load(homepage);
        const title = $("title").text() || result.title;
        const hostname = hostnameFromUrl(normalizedUrl);
        const companyName = parseCompanyName(title, hostname);
        const emails = extractEmails(homepage);
        const contactEmail = pickFounderOrCtoEmail(emails);
        const country = detectCountry(hostname, `${result.snippet} ${homepage.slice(0, 5000)}`);
        const techStack = detectTechStack(homepage);

        candidates.push({
          companyName,
          websiteUrl: normalizedUrl,
          contactEmail,
          country,
          market: detectMarket(country),
          techStack,
          niche,
          source: "automated-prospecting",
          notes: `Discovered from niche query "${niche}".`
        });
      } catch {
        // Skip domains that block scraping or fail to respond.
      }
    }
  }

  const dedupedByWebsite = new Map<string, ProspectLeadCandidate>();
  for (const candidate of candidates) {
    dedupedByWebsite.set(candidate.websiteUrl, candidate);
  }
  return [...dedupedByWebsite.values()];
}
