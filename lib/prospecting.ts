import * as cheerio from "cheerio";

export type ProspectRegion = "USA" | "UAE";
export type ProspectSource = "google-search" | "linkedin" | "apollo" | "producthunt";

export interface ProspectDiscoveryFilters {
  jobTitles: string[];
  companySizes: string[];
  regions: ProspectRegion[];
  sources: ProspectSource[];
}

export interface ProspectLeadCandidate {
  companyName: string;
  websiteUrl: string;
  contactName: string | null;
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

type UnknownRecord = Record<string, unknown>;

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
};

const defaultDiscoveryFilters: ProspectDiscoveryFilters = {
  jobTitles: ["Founder", "CTO", "CEO"],
  companySizes: ["11-50"],
  regions: ["USA", "UAE"],
  sources: ["google-search"]
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

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function inferCompanyNameFromDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const firstPart = hostname.split(".")[0] ?? hostname;
    return firstPart
      .split(/[-_]/g)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "Unknown Company";
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

function detectCountryFromRegionLabel(regionLabel: string | null): string {
  if (!regionLabel) {
    return "Unknown";
  }
  const normalized = regionLabel.toLowerCase();
  if (
    normalized.includes("uae") ||
    normalized.includes("united arab emirates") ||
    normalized.includes("dubai") ||
    normalized.includes("abu dhabi")
  ) {
    return "UAE";
  }
  if (
    normalized.includes("usa") ||
    normalized.includes("u.s.") ||
    normalized.includes("united states") ||
    normalized.includes("us")
  ) {
    return "US";
  }
  return "Unknown";
}

function normalizeRegion(value: string): ProspectRegion | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "usa" || normalized === "us" || normalized === "united states") {
    return "USA";
  }
  if (normalized === "uae" || normalized === "united arab emirates") {
    return "UAE";
  }
  return null;
}

function countryFromRegion(region: ProspectRegion): string {
  return region === "UAE" ? "UAE" : "US";
}

function regionMatchesCountry(regions: ProspectRegion[], country: string): boolean {
  if (regions.length === 0) {
    return true;
  }
  const canonical = country.toUpperCase();
  return regions.some((region) =>
    region === "UAE" ? canonical === "UAE" : canonical === "US" || canonical === "USA"
  );
}

function normalizeFilters(filters?: Partial<ProspectDiscoveryFilters>): ProspectDiscoveryFilters {
  const requestedJobTitles = (filters?.jobTitles ?? [])
    .map((title) => cleanText(title))
    .filter(Boolean);
  const requestedCompanySizes = (filters?.companySizes ?? [])
    .map((size) => cleanText(size))
    .filter(Boolean);
  const requestedRegions = unique(
    (filters?.regions ?? [])
      .map((region) => normalizeRegion(region))
      .filter((region): region is ProspectRegion => Boolean(region))
  );
  const requestedSources = unique(
    (filters?.sources ?? []).filter((source): source is ProspectSource =>
      ["google-search", "linkedin", "apollo", "producthunt"].includes(source)
    )
  );

  return {
    jobTitles: requestedJobTitles.length > 0 ? requestedJobTitles : defaultDiscoveryFilters.jobTitles,
    companySizes:
      requestedCompanySizes.length > 0
        ? requestedCompanySizes
        : defaultDiscoveryFilters.companySizes,
    regions: requestedRegions.length > 0 ? requestedRegions : defaultDiscoveryFilters.regions,
    sources: requestedSources.length > 0 ? requestedSources : defaultDiscoveryFilters.sources
  };
}

function toRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function readString(value: UnknownRecord | null, keys: string[]): string | null {
  if (!value) {
    return null;
  }
  for (const key of keys) {
    const entry = value[key];
    if (typeof entry === "string" && cleanText(entry).length > 0) {
      return cleanText(entry);
    }
  }
  return null;
}

function readStringArray(value: UnknownRecord | null, keys: string[]): string[] {
  if (!value) {
    return [];
  }
  for (const key of keys) {
    const entry = value[key];
    if (Array.isArray(entry)) {
      return entry
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanText(item))
        .filter(Boolean);
    }
  }
  return [];
}

function readArrayFromPayload(payload: unknown, keys: string[]): unknown[] {
  const root = toRecord(payload);
  if (!root) {
    return [];
  }
  for (const key of keys) {
    const entry = root[key];
    if (Array.isArray(entry)) {
      return entry;
    }
    const nested = toRecord(entry);
    if (nested) {
      for (const nestedKey of keys) {
        const nestedEntry = nested[nestedKey];
        if (Array.isArray(nestedEntry)) {
          return nestedEntry;
        }
      }
    }
  }
  return [];
}

function mapApiRecordToCandidate(
  row: unknown,
  source: ProspectSource,
  filters: ProspectDiscoveryFilters
): ProspectLeadCandidate | null {
  const record = toRecord(row);
  if (!record) {
    return null;
  }

  const organization =
    toRecord(record.organization) ?? toRecord(record.company) ?? toRecord(record.account);
  const person = toRecord(record.person) ?? toRecord(record.contact) ?? toRecord(record.lead);
  const location = toRecord(record.location) ?? toRecord(record.address);

  const websiteCandidate =
    readString(record, ["websiteUrl", "website", "companyWebsite", "website_url", "domain"]) ??
    readString(organization, ["websiteUrl", "website", "website_url", "primary_domain", "domain"]);
  if (!websiteCandidate) {
    return null;
  }

  const normalizedWebsite = normalizeWebsiteUrl(websiteCandidate);
  if (!normalizedWebsite) {
    return null;
  }

  const companyName =
    readString(record, ["companyName", "company_name", "organizationName", "accountName"]) ??
    readString(organization, ["name", "company_name", "organization_name"]) ??
    inferCompanyNameFromDomain(normalizedWebsite);
  const jobTitle =
    readString(record, ["jobTitle", "title", "headline"]) ??
    readString(person, ["title", "job_title", "headline"]);
  const companySize =
    readString(record, ["companySize", "employeeRange", "employees"]) ??
    readString(organization, ["employee_count", "size", "employeeRange"]);
  const contactName =
    readString(record, ["contactName", "name", "fullName"]) ??
    readString(person, ["name", "full_name", "first_name"]);
  const contactEmail =
    readString(record, ["contactEmail", "email", "workEmail"]) ??
    readString(person, ["email", "work_email"]);
  const locationLabel =
    readString(record, ["country", "region", "location"]) ??
    readString(location, ["country", "region", "city"]) ??
    readString(organization, ["country", "region"]);
  const detectedCountry = detectCountryFromRegionLabel(locationLabel);
  const fallbackCountry = countryFromRegion(filters.regions[0] ?? "USA");
  const country = detectedCountry === "Unknown" ? fallbackCountry : detectedCountry;
  if (!regionMatchesCountry(filters.regions, country)) {
    return null;
  }

  const niche =
    readString(record, ["niche", "industry", "vertical"]) ??
    readString(organization, ["industry", "vertical"]) ??
    "saas";
  const techStack = unique(
    readStringArray(record, ["techStack", "technologies"]).concat(
      readStringArray(organization, ["techStack", "technologies"])
    )
  );

  const filterSummary = [
    filters.jobTitles.length > 0 ? `Titles: ${filters.jobTitles.join(", ")}` : null,
    filters.companySizes.length > 0 ? `Company size: ${filters.companySizes.join(", ")}` : null,
    filters.regions.length > 0 ? `Regions: ${filters.regions.join(", ")}` : null
  ]
    .filter(Boolean)
    .join(" | ");

  const notes = [
    `Discovered via ${source} endpoint.`,
    jobTitle ? `Matched role: ${jobTitle}.` : null,
    companySize ? `Team size signal: ${companySize}.` : null,
    filterSummary ? `Filters -> ${filterSummary}.` : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    companyName,
    websiteUrl: normalizedWebsite,
    contactName: contactName ?? null,
    contactEmail: contactEmail ?? null,
    country,
    market: detectMarket(country),
    techStack,
    niche,
    source,
    notes
  };
}

async function fetchLinkedInProspects(
  filters: ProspectDiscoveryFilters,
  limit: number
): Promise<ProspectLeadCandidate[]> {
  const endpoint = process.env.LINKEDIN_SEARCH_API_URL;
  const apiKey = process.env.LINKEDIN_API_KEY;
  if (!endpoint || !apiKey) {
    return [];
  }

  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      filters: {
        jobTitles: filters.jobTitles,
        companySizes: filters.companySizes,
        regions: filters.regions
      },
      limit
    })
  });
  if (!response.ok) {
    throw new Error(`LinkedIn source request failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  return readArrayFromPayload(payload, ["results", "items", "leads", "data"])
    .slice(0, limit)
    .map((row) => mapApiRecordToCandidate(row, "linkedin", filters))
    .filter((candidate): candidate is ProspectLeadCandidate => Boolean(candidate));
}

async function fetchApolloProspects(
  filters: ProspectDiscoveryFilters,
  limit: number
): Promise<ProspectLeadCandidate[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return [];
  }
  const endpoint = process.env.APOLLO_API_URL ?? "https://api.apollo.io/api/v1/mixed_people/search";

  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      person_titles: filters.jobTitles,
      person_locations: filters.regions.map((region) =>
        region === "UAE" ? "United Arab Emirates" : "United States"
      ),
      organization_num_employees_ranges: filters.companySizes,
      page: 1,
      per_page: limit
    })
  });

  if (!response.ok) {
    throw new Error(`Apollo source request failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  return readArrayFromPayload(payload, ["people", "contacts", "results", "data"])
    .slice(0, limit)
    .map((row) => mapApiRecordToCandidate(row, "apollo", filters))
    .filter((candidate): candidate is ProspectLeadCandidate => Boolean(candidate));
}

function normalizeProductName(input: string, fallbackUrl: string): string {
  const cleaned = cleanText(input).replace(/\|\s*Product Hunt.*$/i, "");
  if (cleaned.length >= 2) {
    return cleaned;
  }
  return inferCompanyNameFromDomain(fallbackUrl);
}

function chooseProductHuntWebsite($: cheerio.CheerioAPI): string | null {
  const metaWebsite = cleanText(
    $("meta[property='producthunt:redirect_url']").attr("content") ?? ""
  );
  if (metaWebsite) {
    return metaWebsite;
  }
  const externalCandidates = $("a[href^='http']")
    .map((_, anchor) => cleanText($(anchor).attr("href") ?? ""))
    .get()
    .filter(Boolean)
    .filter((href) => {
      const lower = href.toLowerCase();
      return (
        !lower.includes("producthunt.com") &&
        !lower.includes("twitter.com") &&
        !lower.includes("x.com") &&
        !lower.includes("linkedin.com")
      );
    });
  return externalCandidates[0] ?? null;
}

function extractProductHuntMakers($: cheerio.CheerioAPI): string[] {
  return unique(
    $("a[href^='/@']")
      .map((_, anchor) => cleanText($(anchor).text().replace(/^@/, "")))
      .get()
      .filter((name) => name.length >= 2 && !name.toLowerCase().includes("follow"))
  ).slice(0, 4);
}

async function scrapeProductHuntPost(postUrl: string): Promise<ProspectLeadCandidate | null> {
  try {
    const html = await fetchText(postUrl);
    const $ = cheerio.load(html);
    const companyName = normalizeProductName(
      $("meta[property='og:title']").attr("content") ?? "",
      postUrl
    );
    const websiteRaw = chooseProductHuntWebsite($);
    if (!websiteRaw) {
      return null;
    }
    const websiteUrl = normalizeWebsiteUrl(websiteRaw);
    if (!websiteUrl) {
      return null;
    }

    const makers = extractProductHuntMakers($);
    const tagline = cleanText($("meta[property='og:description']").attr("content") ?? "");
    return {
      companyName,
      websiteUrl,
      contactName: makers[0] ?? null,
      contactEmail: null,
      country: "Unknown",
      market: "Other",
      techStack: [],
      niche: "saas",
      source: "producthunt",
      notes: [
        "Discovered from ProductHunt daily launches.",
        makers.length > 0 ? `Makers: ${makers.join(", ")}.` : null,
        tagline ? `Tagline: ${tagline}` : null,
        `Post: ${postUrl}`
      ]
        .filter(Boolean)
        .join(" ")
    };
  } catch {
    return null;
  }
}

async function discoverFromProductHunt(limit: number): Promise<ProspectLeadCandidate[]> {
  const dailyLaunchHtml = await fetchText("https://www.producthunt.com/leaderboard/daily");
  const $ = cheerio.load(dailyLaunchHtml);
  const postUrls = unique(
    $("a[href^='/posts/']")
      .map((_, anchor) => cleanText($(anchor).attr("href") ?? ""))
      .get()
      .filter(Boolean)
      .map((relativeUrl) => `https://www.producthunt.com${relativeUrl.split("?")[0]}`)
  ).slice(0, Math.max(1, limit * 2));

  const collected: ProspectLeadCandidate[] = [];
  for (const postUrl of postUrls) {
    const candidate = await scrapeProductHuntPost(postUrl);
    if (candidate) {
      collected.push(candidate);
    }
    if (collected.length >= limit) {
      break;
    }
  }
  return collected;
}

async function discoverFromGoogleSearch(
  niches: string[],
  limitPerNiche: number
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
          contactName: null,
          contactEmail,
          country,
          market: detectMarket(country),
          techStack,
          niche,
          source: "google-search",
          notes: `Discovered from Google query "${niche}".`
        });
      } catch {
        // Skip domains that block scraping or fail to respond.
      }
    }
  }
  return candidates;
}

export async function discoverProspects(
  niches: string[],
  limitPerNiche = 8,
  filters?: Partial<ProspectDiscoveryFilters>
): Promise<ProspectLeadCandidate[]> {
  const normalizedFilters = normalizeFilters(filters);
  const sources = new Set(normalizedFilters.sources);
  const tasks: Promise<ProspectLeadCandidate[]>[] = [];

  if (sources.has("google-search")) {
    tasks.push(discoverFromGoogleSearch(niches, limitPerNiche));
  }
  if (sources.has("linkedin")) {
    tasks.push(fetchLinkedInProspects(normalizedFilters, limitPerNiche));
  }
  if (sources.has("apollo")) {
    tasks.push(fetchApolloProspects(normalizedFilters, limitPerNiche));
  }
  if (sources.has("producthunt")) {
    tasks.push(discoverFromProductHunt(limitPerNiche));
  }

  const results = await Promise.allSettled(tasks);
  const candidates = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  const dedupedByWebsite = new Map<string, ProspectLeadCandidate>();
  for (const candidate of candidates) {
    const existing = dedupedByWebsite.get(candidate.websiteUrl);
    if (!existing) {
      dedupedByWebsite.set(candidate.websiteUrl, candidate);
      continue;
    }
    if (!existing.contactEmail && candidate.contactEmail) {
      dedupedByWebsite.set(candidate.websiteUrl, candidate);
    }
  }
  return [...dedupedByWebsite.values()];
}
