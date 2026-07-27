import { NextRequest, NextResponse } from "next/server";
import { createAudit, createLead, getLeadById } from "@/lib/db";
import { runWebsiteAudit } from "@/lib/website-auditor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    leadId?: string;
    websiteUrl?: string;
    companyName?: string;
    market?: "US" | "UAE" | "Other";
    niche?: string;
  };
  if (!body.leadId && !body.websiteUrl) {
    return NextResponse.json(
      { error: "Provide either leadId or websiteUrl." },
      { status: 400 }
    );
  }

  try {
    const lead =
      body.leadId
        ? await getLeadById(body.leadId)
        : await createLead({
            companyName: body.companyName ?? "New Prospect",
            websiteUrl: body.websiteUrl ?? "",
            market: body.market ?? "Other",
            niche: body.niche ?? "general",
            source: "manual-audit"
          });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const websiteAudit = await runWebsiteAudit(body.websiteUrl ?? lead.websiteUrl);
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

    return NextResponse.json({ lead, audit }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Website audit failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
