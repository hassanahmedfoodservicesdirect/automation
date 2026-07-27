import { NextResponse } from "next/server";
import { Lead } from "@/lib/types";
import { generateId, readStore, writeStore } from "@/lib/store";

const sampleLeads: Omit<Lead, "id" | "createdAt" | "status">[] = [
  {
    companyName: "Acme Commerce",
    website: "https://acme-commerce.example",
    market: "US",
    contactName: "Sarah Blake",
    contactEmail: "sarah@acme-commerce.example",
    niche: "ecommerce",
    source: "apollo",
    notes: "High paid traffic and low checkout conversion."
  },
  {
    companyName: "HealthBridge Clinic",
    website: "https://healthbridge.example",
    market: "UAE",
    contactName: "Dr. Nabil",
    contactEmail: "nabil@healthbridge.example",
    niche: "healthcare",
    source: "linkedin",
    notes: "Needs speed and local search overhaul."
  },
  {
    companyName: "SyncStack SaaS",
    website: "https://syncstack.example",
    market: "US",
    contactName: "Maya Chen",
    contactEmail: "maya@syncstack.example",
    niche: "saas",
    source: "manual",
    notes: "Preparing for next funding round."
  }
];

export async function POST() {
  const store = await readStore();
  if (store.leads.length > 0) {
    return NextResponse.json(
      { message: "Store already contains leads. No seed action performed." },
      { status: 200 }
    );
  }

  store.leads = sampleLeads.map((lead) => ({
    ...lead,
    id: generateId("lead"),
    status: "new",
    createdAt: new Date().toISOString()
  }));

  await writeStore(store);
  return NextResponse.json({ inserted: store.leads.length });
}
