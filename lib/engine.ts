import { Lead, AuditReport, OutreachDraft, Proposal } from "@/lib/types";
import { generateId } from "@/lib/store";

const issuesByNiche: Record<string, string> = {
  ecommerce:
    "Product pages are slow on mobile and not optimized for AI answer snippets.",
  saas: "Landing pages lack semantic structure, reducing visibility in AI overviews.",
  healthcare:
    "Trust signals and local schema are weak, lowering conversion from discovery traffic.",
  default:
    "Site architecture has weak technical SEO and limited GEO-ready structured content."
};

function scoreFromWebsite(website: string): number {
  const seed = website
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 45 + (seed % 45);
}

export function createAuditReport(lead: Lead): AuditReport {
  const base = scoreFromWebsite(lead.website);
  const performanceScore = Math.min(95, base);
  const geoScore = Math.max(35, Math.min(92, base - 12));
  const uxScore = Math.max(40, Math.min(94, base + 4));
  const nicheKey = lead.niche.toLowerCase();
  const criticalIssue = issuesByNiche[nicheKey] ?? issuesByNiche.default;

  return {
    id: generateId("audit"),
    leadId: lead.id,
    generatedAt: new Date().toISOString(),
    performanceScore,
    geoScore,
    uxScore,
    criticalIssue,
    businessImpact: `Estimated 18-32% conversion loss due to performance + AI visibility gaps.`,
    recommendations: [
      "Improve LCP under 2.5s on mobile pages.",
      "Add FAQ/schema blocks for GEO visibility in AI overviews.",
      "Refactor conversion journey (hero -> proof -> CTA) with clearer intent mapping."
    ],
    oneLinerPitch: `${lead.companyName} can unlock faster growth with a 3-step speed + GEO overhaul in 14 days.`
  };
}

export function createOutreachDraft(
  lead: Lead,
  audit: AuditReport,
  channel: OutreachDraft["channel"]
): OutreachDraft {
  const greeting = lead.contactName ? `Hi ${lead.contactName},` : "Hi team,";
  const channelLabel =
    channel === "linkedin"
      ? "LinkedIn"
      : channel === "whatsapp"
        ? "WhatsApp"
        : "email";
  return {
    id: generateId("outreach"),
    leadId: lead.id,
    channel,
    subject: `${lead.companyName}: quick technical observation`,
    body: [
      greeting,
      "",
      `I reviewed ${lead.website} and found one critical issue: ${audit.criticalIssue}`,
      `This likely causes ${audit.businessImpact}`,
      "",
      "I recorded a short 3-minute teardown with practical fixes (speed, GEO, and conversion architecture).",
      "Would you like me to send it over?"
    ].join("\n"),
    cta: `Reply on ${channelLabel} with “send audit” and I will share the breakdown.`,
    generatedAt: new Date().toISOString()
  };
}

export function createProposal(
  lead: Lead,
  phase: Proposal["phase"] = "phase_1"
): Proposal {
  const config = {
    phase_1: {
      scope: [
        "Website performance overhaul",
        "GEO readiness fixes",
        "UI/UX conversion cleanup"
      ],
      deliverables: [
        "Lighthouse baseline + post-fix report",
        "Technical implementation PRs",
        "Deployment + monitoring handover"
      ],
      estimatedTimeline: "2-3 weeks",
      priceRange: "$1,500 - $3,500"
    },
    phase_2: {
      scope: [
        "MVP architecture hardening",
        "Next.js migration/refactor",
        "Developer workflow modernization"
      ],
      deliverables: [
        "Target architecture blueprint",
        "Core refactor execution",
        "Scalable CI/CD setup"
      ],
      estimatedTimeline: "4-8 weeks",
      priceRange: "$5,000 - $12,000"
    },
    phase_3: {
      scope: [
        "Fractional CTO advisory",
        "Roadmap ownership",
        "Transformation across product + engineering"
      ],
      deliverables: [
        "Monthly engineering roadmap",
        "Weekly architecture review",
        "Leadership + hiring support"
      ],
      estimatedTimeline: "Monthly retainer",
      priceRange: "$3,000 - $6,000 / month"
    }
  }[phase];

  return {
    id: generateId("proposal"),
    leadId: lead.id,
    phase,
    scope: config.scope,
    deliverables: config.deliverables,
    estimatedTimeline: config.estimatedTimeline,
    priceRange: config.priceRange,
    sowClause:
      "Any functionality outside the agreed SRS/Figma design will be billed at an architectural hourly rate of $85/hr.",
    generatedAt: new Date().toISOString()
  };
}
