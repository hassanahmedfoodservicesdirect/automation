import { NextResponse } from "next/server";
import { createLead, getLeads, NewLeadInput } from "@/lib/db";

const sampleLeads: NewLeadInput[] = [
  {
    companyName: "Acme Commerce",
    websiteUrl: "https://acme-commerce.example",
    market: "US",
    contactName: "Sarah Blake" as string | null,
    contactEmail: "sarah@acme-commerce.example" as string | null,
    country: "US",
    niche: "ecommerce",
    source: "apollo",
    notes: "High paid traffic and low checkout conversion."
  },
  {
    companyName: "HealthBridge Clinic",
    websiteUrl: "https://healthbridge.example",
    market: "UAE",
    contactName: "Dr. Nabil" as string | null,
    contactEmail: "nabil@healthbridge.example" as string | null,
    country: "UAE",
    niche: "healthcare",
    source: "linkedin",
    notes: "Needs speed and local search overhaul."
  },
  {
    companyName: "SyncStack SaaS",
    websiteUrl: "https://syncstack.example",
    market: "US",
    contactName: "Maya Chen" as string | null,
    contactEmail: "maya@syncstack.example" as string | null,
    country: "US",
    niche: "saas",
    source: "manual",
    notes: "Preparing for next funding round."
  }
];

export async function POST() {
  try {
    const leads = await getLeads();
    if (leads.length > 0) {
      return NextResponse.json(
        { message: "Database already contains leads. No seed action performed." },
        { status: 200 }
      );
    }

    for (const lead of sampleLeads) {
      await createLead(lead);
    }

    return NextResponse.json({ inserted: sampleLeads.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to seed leads.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
