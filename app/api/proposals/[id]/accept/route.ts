import { NextResponse } from "next/server";
import { acceptProposal, getLeadById } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const lead = await getLeadById(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    const analysis = await acceptProposal(id);
    if (!analysis) {
      return NextResponse.json(
        { error: "No generated proposal found for this lead." },
        { status: 400 }
      );
    }
    return NextResponse.json({ accepted: true, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to accept proposal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
