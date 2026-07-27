import { NextRequest, NextResponse } from "next/server";
import { createProposal } from "@/lib/engine";
import { Proposal } from "@/lib/types";
import { readStore, writeStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    leadId?: string;
    phase?: Proposal["phase"];
  };
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === body.leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const proposal = createProposal(lead, body.phase ?? "phase_1");
  store.proposals.unshift(proposal);
  lead.status = "proposal_sent";
  await writeStore(store);
  return NextResponse.json({ proposal }, { status: 201 });
}
