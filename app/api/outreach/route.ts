import { NextRequest, NextResponse } from "next/server";
import {
  getLeadById,
  getLatestAnalysisForLead,
  updateLeadStatus
} from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    leadId?: string;
    channel?: "email" | "linkedin" | "whatsapp";
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
        { error: "Generate analysis before outreach draft." },
        { status: 400 }
      );
    }

    const channel = body.channel ?? "email";
    const draft =
      channel === "linkedin"
        ? analysis.linkedinDm
        : channel === "whatsapp"
          ? `${analysis.linkedinDm}\n\nReply 'send audit' and I'll share a short teardown video.`
          : `${analysis.coldEmailBody}\n\n${analysis.sowClause}`;

    await updateLeadStatus(lead.id, "outreach_sent");

    return NextResponse.json(
      {
        outreach: {
          leadId: lead.id,
          channel,
          subject: analysis.coldEmailSubject,
          body: draft,
          generatedAt: analysis.generatedAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate outreach.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
