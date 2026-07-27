import { NextRequest, NextResponse } from "next/server";
import { createOutreachDraft } from "@/lib/engine";
import { readStore, writeStore } from "@/lib/store";
import { OutreachDraft } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    leadId?: string;
    channel?: OutreachDraft["channel"];
  };
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === body.leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  const latestAudit = store.audits.find((item) => item.leadId === lead.id);
  if (!latestAudit) {
    return NextResponse.json(
      { error: "Generate an audit before outreach draft." },
      { status: 400 }
    );
  }

  const outreach = createOutreachDraft(lead, latestAudit, body.channel ?? "email");
  store.outreach.unshift(outreach);
  lead.status = "outreach_sent";
  await writeStore(store);
  return NextResponse.json({ outreach }, { status: 201 });
}
