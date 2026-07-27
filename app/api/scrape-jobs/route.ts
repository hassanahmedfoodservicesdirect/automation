import { NextRequest, NextResponse } from "next/server";
import { createAudit, upsertProspectLead } from "@/lib/db";
import { scrapeHiringIntentCompanies } from "@/lib/hiring-intent";
import { runWebsiteAudit } from "@/lib/website-auditor";

export const runtime = "nodejs";

const defaultRoles = [
  "Frontend Engineer",
  "React Developer",
  "Performance Optimization Specialist"
];

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    roles?: string[];
    limitPerRole?: number;
    autoAudit?: boolean;
    auditLimit?: number;
  };

  const roles = body.roles && body.roles.length > 0 ? body.roles : defaultRoles;
  const limitPerRole = Math.max(1, Math.min(10, body.limitPerRole ?? 5));
  const autoAudit = body.autoAudit ?? false;
  const auditLimit = Math.max(0, Math.min(6, body.auditLimit ?? 2));

  try {
    const hiringSignals = await scrapeHiringIntentCompanies(roles, limitPerRole);
    const leads = [];
    for (const signal of hiringSignals) {
      const lead = await upsertProspectLead({
        companyName: signal.companyName,
        websiteUrl: signal.websiteUrl,
        market: signal.market,
        country: signal.country,
        niche: "hiring-intent",
        source: "job-scraper",
        notes: signal.notes,
        techStack: []
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
          // Continue processing remaining hiring-intent leads.
        }
      }
    }

    return NextResponse.json({
      searchedRoles: roles,
      discoveredCount: hiringSignals.length,
      insertedCount: leads.length,
      autoAuditedCount: audits.length,
      leads,
      audits
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scrape hiring-intent job postings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
