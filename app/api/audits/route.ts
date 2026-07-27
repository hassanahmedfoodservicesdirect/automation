import { NextRequest, NextResponse } from "next/server";
import { createAuditReport } from "@/lib/engine";
import { readStore, writeStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { leadId?: string };
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === body.leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const audit = createAuditReport(lead);
  store.audits.unshift(audit);
  lead.status = "audit_ready";
  await writeStore(store);
  return NextResponse.json({ audit }, { status: 201 });
}
