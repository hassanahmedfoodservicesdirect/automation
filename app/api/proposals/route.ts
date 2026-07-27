import { NextRequest, NextResponse } from "next/server";
import {
  getLatestAuditForLead,
  getLeadById,
  getLatestAnalysisForLead,
  updateLeadStatus
} from "@/lib/db";
import { ProposalPhase } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    leadId?: string;
    phase?: ProposalPhase["phase"];
  };
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  try {
    const lead = await getLeadById(body.leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    const analysis = await getLatestAnalysisForLead(lead.id);
    if (!analysis) {
      return NextResponse.json(
        { error: "Generate analysis before proposal." },
        { status: 400 }
      );
    }
    const phase = body.phase ?? "phase_1";
    const latestAudit = await getLatestAuditForLead(lead.id);
    const proposal =
      phase === "phase_1"
        ? analysis.phase1Proposal
        : phase === "phase_2"
          ? analysis.phase2Proposal
          : analysis.phase3Proposal;

    await updateLeadStatus(lead.id, "proposal_sent");
    return NextResponse.json(
      {
        proposal: {
          leadId: lead.id,
          ...proposal,
          sowClause: analysis.sowClause,
          generatedAt: analysis.generatedAt
        },
        auditSnapshot: latestAudit
          ? {
              performanceScore: latestAudit.performanceScore,
              lighthousePerformanceScore: latestAudit.lighthousePerformanceScore,
              lcpSec: latestAudit.lcpSec,
              fidMs: latestAudit.fidMs,
              cls: latestAudit.cls,
              tokenOptimizedAudit: latestAudit.tokenOptimizedAudit
            }
          : null,
        shareableProposalUrl: `/p/${lead.id}`
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build proposal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
