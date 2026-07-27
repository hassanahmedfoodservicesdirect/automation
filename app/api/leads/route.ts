import { NextRequest, NextResponse } from "next/server";
import { createLead, getLeads } from "@/lib/db";

export async function GET() {
  try {
    const leads = await getLeads();
    return NextResponse.json({ leads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    companyName?: string;
    website?: string;
    market?: "US" | "UAE" | "Other";
    contactName?: string;
    contactEmail?: string;
    niche?: string;
    source?: string;
    notes?: string;
  };
  if (!body.companyName || !body.website) {
    return NextResponse.json(
      { error: "companyName and website are required." },
      { status: 400 }
    );
  }

  try {
    const lead = await createLead({
      companyName: body.companyName,
      websiteUrl: body.website,
      market: body.market ?? "US",
      contactName: body.contactName ?? null,
      contactEmail: body.contactEmail ?? null,
      niche: body.niche ?? "saas",
      source: body.source ?? "manual",
      notes: body.notes ?? null
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create lead.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
