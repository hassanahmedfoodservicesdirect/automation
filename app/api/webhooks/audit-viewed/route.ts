import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLeadStatus } from "@/lib/db";

export const runtime = "nodejs";

const terminalStatuses = new Set(["proposal_accepted", "won", "lost"]);

function isAuthorized(request: NextRequest): boolean {
  const originHeader = request.headers.get("origin");
  if (originHeader && originHeader === request.nextUrl.origin) {
    return true;
  }
  const configuredSecret = process.env.AUDIT_VIEW_WEBHOOK_SECRET;
  if (!configuredSecret) {
    return true;
  }
  const providedSecret = request.headers.get("x-webhook-secret");
  return providedSecret === configuredSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized webhook call." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    leadId?: string;
    event?: string;
    openedAt?: string;
  };

  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  try {
    const lead = await getLeadById(body.leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    if (terminalStatuses.has(lead.status)) {
      return NextResponse.json({
        lead,
        updated: false,
        reason: `Lead status "${lead.status}" is terminal and was not modified.`
      });
    }

    const updatedLead =
      lead.status === "reviewing_proposal"
        ? lead
        : await updateLeadStatus(lead.id, "reviewing_proposal");

    return NextResponse.json({
      updated: updatedLead.status === "reviewing_proposal" && lead.status !== "reviewing_proposal",
      lead: updatedLead,
      event: body.event ?? "audit_viewed",
      openedAt: body.openedAt ?? new Date().toISOString()
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process audit viewed webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
