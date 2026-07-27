import { NextRequest, NextResponse } from "next/server";
import { discoverProspects } from "@/lib/prospecting";
import { createAudit, upsertProspectLead } from "@/lib/db";
import { runWebsiteAudit } from "@/lib/website-auditor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    niches?: string[];
    query?: string;
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

  const autoAudit = body.autoAudit ?? true;
  const auditLimit = Math.max(0, Math.min(8, body.auditLimit ?? 3));

  try {
    const discovered = await discoverProspects(niches, Math.max(3, body.limitPerNiche ?? 8));
    const leads = [];
    for (const candidate of discovered) {
      const lead = await upsertProspectLead({
        companyName: candidate.companyName,
        websiteUrl: candidate.websiteUrl,
        market: candidate.market,
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
            pageTitle: websiteAudit.pageTitle,
            metaDescription: websiteAudit.metaDescription,
            h1Headings: websiteAudit.h1Headings,
            h2Headings: websiteAudit.h2Headings,
            condensedText: websiteAudit.condensedText,
            tokenOptimizedAudit: websiteAudit.tokenOptimizedAudit,
            lighthousePerformanceScore: websiteAudit.lighthousePerformanceScore,
            lcpSec: websiteAudit.lcpSec,
            fidMs: websiteAudit.fidMs,
            cls: websiteAudit.cls,
            mobileReadinessScore: websiteAudit.mobileReadinessScore,
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
      leads,
      audits
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prospecting failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
