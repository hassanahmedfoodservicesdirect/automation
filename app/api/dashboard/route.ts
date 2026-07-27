import { NextResponse } from "next/server";
import { buildDashboardSummary } from "@/lib/dashboard";
import { readStore } from "@/lib/store";

export async function GET() {
  const store = await readStore();
  const summary = buildDashboardSummary(store);
  return NextResponse.json({ summary, ...store });
}
