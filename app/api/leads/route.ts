import { NextRequest, NextResponse } from "next/server";
import { Lead } from "@/lib/types";
import { generateId, readStore, writeStore } from "@/lib/store";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ leads: store.leads });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<Lead>;
  if (!body.companyName || !body.website || !body.contactEmail) {
    return NextResponse.json(
      { error: "companyName, website, and contactEmail are required." },
      { status: 400 }
    );
  }

  const store = await readStore();
  const lead: Lead = {
    id: generateId("lead"),
    companyName: body.companyName,
    website: body.website,
    market: body.market ?? "US",
    contactName: body.contactName ?? "",
    contactEmail: body.contactEmail,
    niche: body.niche ?? "saas",
    source: body.source ?? "manual",
    status: "new",
    notes: body.notes ?? "",
    createdAt: new Date().toISOString()
  };

  store.leads.unshift(lead);
  await writeStore(store);
  return NextResponse.json({ lead }, { status: 201 });
}
