import { AuditReport, Lead, ProposalPhase } from "@/lib/types";

export interface GeneratedAnalysis {
  bottlenecks: string[];
  businessImpact: string;
  coldEmailSubject: string;
  coldEmailBody: string;
  linkedinDm: string;
  loomScript: string;
  phase1Proposal: ProposalPhase;
  phase2Proposal: ProposalPhase;
  phase3Proposal: ProposalPhase;
  sowClause: string;
}

interface ClaudeResponse {
  content?: { type: string; text?: string }[];
}

const defaultSowClause =
  "Any functionality outside the agreed SRS/Figma design will be billed at an architectural hourly rate of $85/hr.";

function defaultProposal(phase: ProposalPhase["phase"]): ProposalPhase {
  if (phase === "phase_1") {
    return {
      phase,
      title: "Phase 1: Speed & GEO Fixes",
      scope: ["Core Web Vitals remediation", "GEO content structure upgrades", "Conversion CTA cleanup"],
      deliverables: [
        "Performance baseline and optimized deployment",
        "Schema and AI visibility enhancement package",
        "2-week implementation sprint report"
      ],
      estimatedTimeline: "2-3 weeks",
      priceRange: "$1,500 - $3,500"
    };
  }
  if (phase === "phase_2") {
    return {
      phase,
      title: "Phase 2: Code Refactoring",
      scope: ["Legacy script cleanup", "Component architecture refactor", "API performance hardening"],
      deliverables: [
        "Refactor roadmap and execution plan",
        "Stabilized codebase with measurable quality improvements",
        "Engineering handover notes"
      ],
      estimatedTimeline: "4-8 weeks",
      priceRange: "$5,000 - $12,000"
    };
  }
  return {
    phase,
    title: "Phase 3: Technical Retainer",
    scope: ["Fractional CTO governance", "Weekly architecture oversight", "Team enablement and roadmap"],
    deliverables: ["Monthly KPI report", "Roadmap ownership", "Technical hiring support"],
    estimatedTimeline: "Monthly retainer",
    priceRange: "$3,000 - $6,000 / month"
  };
}

function fallbackAnalysis(lead: Lead, audit: AuditReport): GeneratedAnalysis {
  const lcpText = audit.lcpMs ? `${Math.round(audit.lcpMs)}ms` : "an elevated value";
  return {
    bottlenecks: [
      `Mobile LCP is ${lcpText}, reducing first-impression responsiveness.`,
      `GEO readiness score (${audit.geoScore}) indicates weak schema/AI discoverability.`,
      `UI/UX quality score (${audit.uxScore}) suggests friction in the conversion journey.`
    ],
    businessImpact:
      "Estimated 20-35% mobile lead loss due to slow rendering and low AI-search visibility at key acquisition touchpoints.",
    coldEmailSubject: `${lead.companyName}: quick technical finding from ${lead.websiteUrl}`,
    coldEmailBody: [
      `Hi ${lead.contactName ?? "team"},`,
      "",
      `I reviewed ${lead.websiteUrl} and found three fixable issues:`,
      `1) LCP delay (${lcpText}),`,
      `2) GEO visibility gaps for AI overviews,`,
      `3) conversion friction in UI flow.`,
      "",
      "These typically reduce qualified inbound conversions by 20-35%.",
      "If useful, I can share a concise 3-minute teardown with specific fixes your team can apply immediately."
    ].join("\n"),
    linkedinDm: `Hi ${lead.contactName ?? "there"} — I ran a quick technical audit on ${
      lead.companyName
    }. Your site has meaningful speed + GEO upside that likely impacts lead conversion. Happy to share a short, actionable teardown video if helpful.`,
    loomScript: [
      "Open homepage and show current mobile load behavior.",
      "Highlight Core Web Vitals pain point and mention estimated conversion impact.",
      "Show missing schema/FAQ structures affecting AI recommendation engines.",
      "Walk through a simple 3-step remediation plan and invite a technical call."
    ].join("\n"),
    phase1Proposal: defaultProposal("phase_1"),
    phase2Proposal: defaultProposal("phase_2"),
    phase3Proposal: defaultProposal("phase_3"),
    sowClause: defaultSowClause
  };
}

function safeJsonParse(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function proposalFromUnknown(value: unknown, fallback: ProposalPhase): ProposalPhase {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const candidate = value as Partial<ProposalPhase>;
  return {
    phase: fallback.phase,
    title: typeof candidate.title === "string" ? candidate.title : fallback.title,
    scope: Array.isArray(candidate.scope) ? candidate.scope.filter((item) => typeof item === "string") : fallback.scope,
    deliverables: Array.isArray(candidate.deliverables)
      ? candidate.deliverables.filter((item) => typeof item === "string")
      : fallback.deliverables,
    estimatedTimeline:
      typeof candidate.estimatedTimeline === "string"
        ? candidate.estimatedTimeline
        : fallback.estimatedTimeline,
    priceRange: typeof candidate.priceRange === "string" ? candidate.priceRange : fallback.priceRange
  };
}

function parseClaudePayload(raw: unknown, lead: Lead, audit: AuditReport): GeneratedAnalysis {
  const fallback = fallbackAnalysis(lead, audit);
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const value = raw as Record<string, unknown>;
  return {
    bottlenecks: Array.isArray(value.bottlenecks)
      ? value.bottlenecks.filter((item): item is string => typeof item === "string").slice(0, 5)
      : fallback.bottlenecks,
    businessImpact:
      typeof value.businessImpact === "string" ? value.businessImpact : fallback.businessImpact,
    coldEmailSubject:
      typeof value.coldEmailSubject === "string"
        ? value.coldEmailSubject
        : fallback.coldEmailSubject,
    coldEmailBody: typeof value.coldEmailBody === "string" ? value.coldEmailBody : fallback.coldEmailBody,
    linkedinDm: typeof value.linkedinDm === "string" ? value.linkedinDm : fallback.linkedinDm,
    loomScript: typeof value.loomScript === "string" ? value.loomScript : fallback.loomScript,
    phase1Proposal: proposalFromUnknown(value.phase1Proposal, fallback.phase1Proposal),
    phase2Proposal: proposalFromUnknown(value.phase2Proposal, fallback.phase2Proposal),
    phase3Proposal: proposalFromUnknown(value.phase3Proposal, fallback.phase3Proposal),
    sowClause: typeof value.sowClause === "string" ? value.sowClause : defaultSowClause
  };
}

async function requestClaudeAnalysis(lead: Lead, audit: AuditReport): Promise<GeneratedAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-20241022";
  const prompt = [
    "You are a principal software architect producing a technical lead audit package.",
    "Return JSON only using this exact schema:",
    JSON.stringify(
      {
        bottlenecks: ["string"],
        businessImpact: "string",
        coldEmailSubject: "string",
        coldEmailBody: "string",
        linkedinDm: "string",
        loomScript: "string",
        phase1Proposal: {
          title: "string",
          scope: ["string"],
          deliverables: ["string"],
          estimatedTimeline: "string",
          priceRange: "string"
        },
        phase2Proposal: {
          title: "string",
          scope: ["string"],
          deliverables: ["string"],
          estimatedTimeline: "string",
          priceRange: "string"
        },
        phase3Proposal: {
          title: "string",
          scope: ["string"],
          deliverables: ["string"],
          estimatedTimeline: "string",
          priceRange: "string"
        },
        sowClause:
          "Any functionality outside the agreed SRS/Figma design will be billed at an architectural hourly rate of $85/hr."
      },
      null,
      2
    ),
    "",
    `Lead Context: ${JSON.stringify(
      {
        company: lead.companyName,
        website: lead.websiteUrl,
        contactName: lead.contactName,
        niche: lead.niche,
        market: lead.market
      },
      null,
      2
    )}`,
    "",
    `Audit Metrics: ${JSON.stringify(audit, null, 2)}`
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as ClaudeResponse;
  const textChunk = payload.content?.find((item) => item.type === "text")?.text;
  if (!textChunk) {
    return null;
  }

  try {
    const parsed = safeJsonParse(textChunk);
    return parseClaudePayload(parsed, lead, audit);
  } catch {
    return null;
  }
}

export async function generateAnalysis(lead: Lead, audit: AuditReport): Promise<GeneratedAnalysis> {
  const claudeResult = await requestClaudeAnalysis(lead, audit);
  if (claudeResult) {
    return claudeResult;
  }
  return fallbackAnalysis(lead, audit);
}
