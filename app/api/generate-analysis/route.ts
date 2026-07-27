import { NextRequest, NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/analysis";
import {
  getAuditById,
  getLatestAuditForLead,
  getLeadById,
  saveAnalysis
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { leadId?: string; auditId?: string };
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  try {
    const lead = await getLeadById(body.leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const audit = body.auditId
      ? await getAuditById(body.auditId)
      : await getLatestAuditForLead(lead.id);
    if (!audit) {
      return NextResponse.json(
        { error: "No audit found. Run /api/audit-website first." },
        { status: 400 }
      );
    }

    const generated = await generateAnalysis(lead, audit);
    const analysis = await saveAnalysis({
      leadId: lead.id,
      auditId: audit.id,
      bottlenecks: generated.bottlenecks,
      businessImpact: generated.businessImpact,
      coldEmailSubject: generated.coldEmailSubject,
      coldEmailBody: generated.coldEmailBody,
      linkedinDm: generated.linkedinDm,
      loomScript: generated.loomScript,
      phase1Proposal: generated.phase1Proposal,
      phase2Proposal: generated.phase2Proposal,
      phase3Proposal: generated.phase3Proposal,
      sowClause: generated.sowClause
    });

    return NextResponse.json({
      analysis,
      shareableProposalUrl: `/p/${lead.id}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate analysis.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
