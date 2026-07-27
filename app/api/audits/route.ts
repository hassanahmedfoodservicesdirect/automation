import { NextRequest, NextResponse } from "next/server";
import { createAudit, getLeadById } from "@/lib/db";
import { runWebsiteAudit } from "@/lib/website-auditor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { leadId?: string };
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  try {
    const lead = await getLeadById(body.leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

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

    return NextResponse.json({ audit }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
