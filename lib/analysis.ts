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

interface LeanClaudeOutput {
  flaws: string[];
  impact: string;
  email: string;
  loomScript: string[];
}

const defaultSowClause =
  "Any functionality outside the agreed SRS/Figma design will be billed at an architectural hourly rate of $85/hr.";

const SYSTEM_PROMPT =
  'You are a Senior Software Architect. Analyze the provided condensed metrics and output JSON only.\nReturn EXACTLY this JSON structure:\n{\n  "flaws": ["Technical issue 1 with impact", "Technical issue 2"],\n  "impact": "1-sentence estimated loss on conversions/leads",\n  "email": "3-sentence hyper-personalized cold email referencing specific site flaws",\n  "loomScript": ["Bullet 1 for 3-min video", "Bullet 2", "Bullet 3"]\n}\nKeep answers ultra-concise, technical, direct, and non-fluffy. Output strict JSON only without markdown wrappers.';

function defaultProposal(phase: ProposalPhase["phase"]): ProposalPhase {
  if (phase === "phase_1") {
    return {
      phase,
      title: "Phase 1: Speed & GEO Fixes",
      scope: ["Core web vitals fixes", "Meta + heading structure cleanup", "AI-search content readiness"],
      deliverables: [
        "Speed remediation rollout",
        "GEO optimization implementation",
        "Before/after performance report"
      ],
      estimatedTimeline: "2-3 weeks",
      priceRange: "$1,500 - $3,500"
    };
  }
  if (phase === "phase_2") {
    return {
      phase,
      title: "Phase 2: Code Refactoring",
      scope: ["Legacy script cleanup", "Component architecture refactor", "API performance stabilization"],
      deliverables: [
        "Refactor implementation PR set",
        "Code quality and performance uplift",
        "Technical handover documentation"
      ],
      estimatedTimeline: "4-8 weeks",
      priceRange: "$5,000 - $12,000"
    };
  }
  return {
    phase,
    title: "Phase 3: Technical Retainer",
    scope: ["Fractional CTO guidance", "Weekly architecture review", "Growth roadmap ownership"],
    deliverables: ["Monthly roadmap", "Tech oversight calls", "Hiring and architecture advisories"],
    estimatedTimeline: "Monthly retainer",
    priceRange: "$3,000 - $6,000 / month"
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

function fallbackOutput(lead: Lead, audit: AuditReport): LeanClaudeOutput {
  const lcp = audit.lcpSec !== null ? `${audit.lcpSec.toFixed(2)}s` : "elevated";
  return {
    flaws: [
      `LCP at ${lcp} is suppressing mobile first-interaction speed and conversion velocity.`,
      `Performance score ${audit.performanceScore}/100 indicates meaningful technical debt in rendering path.`,
      `GEO readiness is constrained by metadata and heading-structure quality gaps.`
    ],
    impact:
      "Likely causing ~20-35% loss in qualified mobile leads due to slower load and weaker AI-search discoverability.",
    email: `Hi ${lead.contactName ?? "team"}, I reviewed ${lead.websiteUrl} and found specific speed + GEO blockers, including LCP at ${lcp}. These issues typically suppress qualified inbound conversions by 20-35%; I can share a focused 3-minute teardown with practical fixes if useful.`,
    loomScript: [
      "Show current mobile loading behavior and LCP bottleneck.",
      "Highlight metadata/heading structure gaps reducing GEO visibility.",
      "Explain the 3-step fix plan with expected conversion lift."
    ]
  };
}

function parseLeanOutput(raw: unknown, fallback: LeanClaudeOutput): LeanClaudeOutput {
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const value = raw as Record<string, unknown>;
  return {
    flaws: Array.isArray(value.flaws)
      ? value.flaws.filter((item): item is string => typeof item === "string").slice(0, 5)
      : fallback.flaws,
    impact: typeof value.impact === "string" ? value.impact : fallback.impact,
    email: typeof value.email === "string" ? value.email : fallback.email,
    loomScript: Array.isArray(value.loomScript)
      ? value.loomScript
          .filter((item): item is string => typeof item === "string")
          .slice(0, 6)
      : fallback.loomScript
  };
}

function buildUserPrompt(lead: Lead, audit: AuditReport): string {
  const speedScore = audit.lighthousePerformanceScore ?? audit.performanceScore;
  const lcp = audit.lcpSec ?? (audit.lcpMs ? Number((audit.lcpMs / 1000).toFixed(2)) : null);
  return [
    `Company: ${lead.companyName}`,
    `URL: ${lead.websiteUrl}`,
    `Speed Score: ${speedScore}/100 (LCP: ${lcp !== null ? `${lcp}s` : "n/a"})`,
    `Clean Text Extract: ${audit.condensedText.slice(0, 800)}`
  ].join("\n");
}

async function requestClaudeLeanAnalysis(
  lead: Lead,
  audit: AuditReport
): Promise<LeanClaudeOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }
  const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-20241022";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.1,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildUserPrompt(lead, audit)
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as ClaudeResponse;
  const text = payload.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return null;
  }
  try {
    return safeJsonParse(text) as LeanClaudeOutput;
  } catch {
    return null;
  }
}

export async function generateAnalysis(lead: Lead, audit: AuditReport): Promise<GeneratedAnalysis> {
  const fallback = fallbackOutput(lead, audit);
  const claudeOutput = await requestClaudeLeanAnalysis(lead, audit);
  const parsed = parseLeanOutput(claudeOutput, fallback);

  const loomScript = parsed.loomScript.map((item) => `- ${item}`).join("\n");
  const subjectLcp = audit.lcpSec !== null ? `${audit.lcpSec.toFixed(2)}s LCP` : "speed findings";
  const coldEmailSubject = `${lead.companyName}: ${subjectLcp} + GEO audit findings`;

  return {
    bottlenecks: parsed.flaws,
    businessImpact: parsed.impact,
    coldEmailSubject,
    coldEmailBody: parsed.email,
    linkedinDm: parsed.email.slice(0, 600),
    loomScript,
    phase1Proposal: defaultProposal("phase_1"),
    phase2Proposal: defaultProposal("phase_2"),
    phase3Proposal: defaultProposal("phase_3"),
    sowClause: defaultSowClause
  };
}
