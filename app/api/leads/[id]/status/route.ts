import { NextRequest, NextResponse } from "next/server";
import { LeadStatus } from "@/lib/types";
import { readStore, writeStore } from "@/lib/store";

const validStatuses: LeadStatus[] = [
  "new",
  "audit_ready",
  "outreach_sent",
  "meeting_booked",
  "proposal_sent",
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

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  lead.status = body.status;
  await writeStore(store);
  return NextResponse.json({ lead });
}
