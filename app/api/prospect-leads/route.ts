import { NextRequest, NextResponse } from "next/server";
import {
  ProspectRegion,
  ProspectSource,
  discoverProspects
} from "@/lib/prospecting";
import { createAudit, upsertProspectLead } from "@/lib/db";
import { runWebsiteAudit } from "@/lib/website-auditor";

export const runtime = "nodejs";

type IngestionSource = "google-search" | "linkedin" | "producthunt" | "manual";

const sourceSelectionMap: Record<IngestionSource, ProspectSource[]> = {
  "google-search": ["google-search"],
  linkedin: ["linkedin", "apollo"],
  producthunt: ["producthunt"],
  manual: []
};

function isProspectRegion(value: string): value is ProspectRegion {
  return value === "USA" || value === "UAE";
}

function isProspectSource(value: string): value is ProspectSource {
  return ["google-search", "linkedin", "apollo", "producthunt"].includes(value);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    niches?: string[];
    query?: string;
    source?: IngestionSource;
    sources?: string[];
    jobTitles?: string[];
    companySizes?: string[];
    regions?: string[];
    limitPerNiche?: number;
    autoAudit?: boolean;
    auditLimit?: number;
  };

  const niches = body.niches && body.niches.length > 0 ? body.niches : [];
  if (body.query && body.query.trim()) {
    niches.push(body.query.trim());
  }
  if (niches.length === 0) {
    niches.push(
      "B2B SaaS startups",
      "E-commerce brands in US",
      "E-commerce brands in UAE",
      "Y Combinator companies"
    );
  }

  const requestedSources =
    body.sources && body.sources.length > 0
      ? body.sources.filter(isProspectSource)
      : sourceSelectionMap[body.source ?? "google-search"];
  const normalizedRegions = (body.regions ?? []).filter(isProspectRegion);
  const discoveryFilters: {
    sources: ProspectSource[];
    jobTitles: string[];
    companySizes: string[];
    regions: ProspectRegion[];
  } = {
    sources: requestedSources,
    jobTitles: body.jobTitles && body.jobTitles.length > 0 ? body.jobTitles : ["Founder", "CTO", "CEO"],
    companySizes:
      body.companySizes && body.companySizes.length > 0 ? body.companySizes : ["11-50"],
    regions: normalizedRegions.length > 0 ? normalizedRegions : ["USA", "UAE"]
  };

  if (requestedSources.length === 0) {
    return NextResponse.json({
      searchedNiches: niches,
      discoveredCount: 0,
      insertedCount: 0,
      autoAuditedCount: 0,
      leads: [],
      audits: [],
      filters: discoveryFilters,
      message:
        "Manual source selected. Use manual lead capture form to ingest records instead of automated discovery."
    });
  }

  const autoAudit = body.autoAudit ?? true;
  const auditLimit = Math.max(0, Math.min(8, body.auditLimit ?? 3));

  try {
    const discovered = await discoverProspects(
      niches,
      Math.max(3, body.limitPerNiche ?? 8),
      discoveryFilters
    );
    const leads = [];
    for (const candidate of discovered) {
      const lead = await upsertProspectLead({
        companyName: candidate.companyName,
        websiteUrl: candidate.websiteUrl,
        market: candidate.market,
        contactName: candidate.contactName,
        contactEmail: candidate.contactEmail,
        country: candidate.country,
        niche: candidate.niche,
        source: candidate.source,
        notes: candidate.notes,
        techStack: candidate.techStack
      });
      leads.push(lead);
    }

    const audits = [];
    if (autoAudit) {
      for (const lead of leads.slice(0, auditLimit)) {
        try {
          const websiteAudit = await runWebsiteAudit(lead.websiteUrl);
          const audit = await createAudit({
            leadId: lead.id,
            websiteUrl: websiteAudit.websiteUrl,
            lcpMs: websiteAudit.lcpMs,
            domSize: websiteAudit.domSize,
            loadTimeMs: websiteAudit.loadTimeMs,
            mobileResponsive: websiteAudit.mobileResponsive,
            performanceScore: websiteAudit.performanceScore,
            geoScore: websiteAudit.geoScore,
            uxScore: websiteAudit.uxScore,
            criticalIssues: websiteAudit.criticalIssues,
            metaIssues: websiteAudit.metaIssues,
            legacyScripts: websiteAudit.legacyScripts,
            slowApiCalls: websiteAudit.slowApiCalls,
            geoSignals: websiteAudit.geoSignals,
            rawDomExcerpt: websiteAudit.rawDomExcerpt
          });
          audits.push(audit);
        } catch {
          // Continue even if one domain blocks automation.
        }
      }
    }

    return NextResponse.json({
      searchedNiches: niches,
      discoveredCount: discovered.length,
      insertedCount: leads.length,
      autoAuditedCount: audits.length,
      filters: discoveryFilters,
      leads,
      audits
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prospecting failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
