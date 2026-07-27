import { NextResponse } from "next/server";
import { getAnalysesForLead, getAuditsForLead, getLeadById } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const [lead, audits, analyses] = await Promise.all([
      getLeadById(id),
      getAuditsForLead(id, 10),
      getAnalysesForLead(id, 10)
    ]);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    return NextResponse.json({ lead, audits, analyses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load lead insights.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
