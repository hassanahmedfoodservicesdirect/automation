import { NextRequest, NextResponse } from "next/server";
import { LeadStatus } from "@/lib/types";
import { updateLeadStatus } from "@/lib/db";

const validStatuses: LeadStatus[] = [
  "new",
  "audit_ready",
  "analysis_ready",
  "outreach_sent",
  "meeting_booked",
  "proposal_sent",
  "proposal_accepted",
  "won",
  "lost"
];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as { status?: LeadStatus };

  if (!body.status || !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status provided." }, { status: 400 });
  }

  try {
    const lead = await updateLeadStatus(id, body.status);
    return NextResponse.json({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update lead status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
