import { NextRequest, NextResponse } from "next/server";
import {
  getLeadById,
  getLatestAnalysisForLead,
  updateLeadStatus
} from "@/lib/db";

const LINKEDIN_MAX_CHARACTERS = 300;

function normalizeLinkedInMessage(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= LINKEDIN_MAX_CHARACTERS) {
    return compact;
  }
  return `${compact.slice(0, LINKEDIN_MAX_CHARACTERS - 1).trimEnd()}…`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    leadId?: string;
    channel?: "email" | "linkedin" | "loom" | "whatsapp";
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
    const linkedinMessage = normalizeLinkedInMessage(analysis.linkedinDm);
    const emailBody = `${analysis.coldEmailBody}\n\n${analysis.sowClause}`;
    const selectedDraft =
      channel === "linkedin"
        ? linkedinMessage
        : channel === "loom"
          ? analysis.loomScript
          : channel === "whatsapp"
            ? `${linkedinMessage}\n\nReply "send audit" and I will share a short teardown video.`
            : emailBody;

    await updateLeadStatus(lead.id, "outreach_sent");

    return NextResponse.json(
      {
        outreach: {
          leadId: lead.id,
          channel,
          subject: analysis.coldEmailSubject,
          body: selectedDraft,
          generatedAt: analysis.generatedAt,
          variants: {
            emailCampaign: {
              channel: "email",
              subject: analysis.coldEmailSubject,
              body: emailBody
            },
            linkedinConnection: {
              channel: "linkedin",
              body: linkedinMessage,
              characterCount: linkedinMessage.length,
              maxCharacters: LINKEDIN_MAX_CHARACTERS
            },
            loomTeardown: {
              channel: "loom",
              script: analysis.loomScript
            }
          }
        }
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate outreach.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
