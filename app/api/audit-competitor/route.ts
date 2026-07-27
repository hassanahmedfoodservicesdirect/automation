import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@/lib/db";
import { AuditComputation, runWebsiteAudit } from "@/lib/website-auditor";

export const runtime = "nodejs";

interface ComparisonRow {
  metric: string;
  leadValue: string;
  competitorValue: string;
  winner: "lead" | "competitor" | "tie";
}

function formatMs(value: number | null): string {
  if (!value || Number.isNaN(value)) {
    return "N/A";
  }
  return `${Math.round(value)} ms`;
}

function compareHigherIsBetter(leadValue: number, competitorValue: number): ComparisonRow["winner"] {
  if (leadValue === competitorValue) {
    return "tie";
  }
  return leadValue > competitorValue ? "lead" : "competitor";
}

function compareLowerIsBetter(
  leadValue: number | null,
  competitorValue: number | null
): ComparisonRow["winner"] {
  if (leadValue === null || competitorValue === null) {
    return "tie";
  }
  if (leadValue === competitorValue) {
    return "tie";
  }
  return leadValue < competitorValue ? "lead" : "competitor";
}

function buildComparisonMatrix(
  leadAudit: AuditComputation,
  competitorAudit: AuditComputation
): ComparisonRow[] {
  return [
    {
      metric: "Speed Score",
      leadValue: `${leadAudit.performanceScore}/100`,
      competitorValue: `${competitorAudit.performanceScore}/100`,
      winner: compareHigherIsBetter(leadAudit.performanceScore, competitorAudit.performanceScore)
    },
    {
      metric: "Largest Contentful Paint (LCP)",
      leadValue: formatMs(leadAudit.lcpMs),
      competitorValue: formatMs(competitorAudit.lcpMs),
      winner: compareLowerIsBetter(leadAudit.lcpMs, competitorAudit.lcpMs)
    },
    {
      metric: "AI Search Readiness",
      leadValue: `${leadAudit.geoScore}/100`,
      competitorValue: `${competitorAudit.geoScore}/100`,
      winner: compareHigherIsBetter(leadAudit.geoScore, competitorAudit.geoScore)
    }
  ];
}

function summarizeOutcome(rows: ComparisonRow[]): {
  leadWins: number;
  competitorWins: number;
  tied: number;
  headline: string;
} {
  const leadWins = rows.filter((row) => row.winner === "lead").length;
  const competitorWins = rows.filter((row) => row.winner === "competitor").length;
  const tied = rows.filter((row) => row.winner === "tie").length;
  const headline =
    leadWins === competitorWins
      ? "Lead and competitor are currently neck-and-neck across benchmarked metrics."
      : leadWins > competitorWins
        ? "Lead currently outperforms the competitor on key benchmark metrics."
        : "Competitor currently has stronger benchmark metrics than the lead.";
  return { leadWins, competitorWins, tied, headline };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    leadId?: string;
    leadUrl?: string;
    competitorUrl?: string;
  };

  if (!body.competitorUrl) {
    return NextResponse.json({ error: "competitorUrl is required." }, { status: 400 });
  }

  try {
    const lead = body.leadId ? await getLeadById(body.leadId) : null;
    const leadUrl = body.leadUrl ?? lead?.websiteUrl;
    if (!leadUrl) {
      return NextResponse.json(
        { error: "Provide leadId or leadUrl alongside competitorUrl." },
        { status: 400 }
      );
    }

    const leadAudit = await runWebsiteAudit(leadUrl);
    const competitorAudit = await runWebsiteAudit(body.competitorUrl);
    const matrix = buildComparisonMatrix(leadAudit, competitorAudit);
    const summary = summarizeOutcome(matrix);

    return NextResponse.json({
      lead: {
        id: lead?.id ?? null,
        websiteUrl: leadUrl,
        audit: leadAudit
      },
      competitor: {
        websiteUrl: body.competitorUrl,
        audit: competitorAudit
      },
      comparisonMatrix: matrix,
      summary
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run competitor benchmark audit.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
