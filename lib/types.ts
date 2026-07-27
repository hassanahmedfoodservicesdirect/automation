export type LeadStatus =
  | "new"
  | "audit_ready"
  | "analysis_ready"
  | "outreach_sent"
  | "meeting_booked"
  | "proposal_sent"
  | "proposal_accepted"
  | "won"
  | "lost";

export interface Lead {
  id: string;
  companyName: string;
  websiteUrl: string;
  market: "US" | "UAE" | "Other";
  contactName: string | null;
  contactEmail: string | null;
  country: string;
  niche: string;
  source: string;
  techStack: string[];
  status: LeadStatus;
  notes: string | null;
  lastPerfScore: number | null;
  lastGeoScore: number | null;
  lastUxScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlowResource {
  url: string;
  durationMs: number;
}

export interface GeoSignals {
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasSchemaMarkup: boolean;
  hasFaqSignals: boolean;
  headingCount: number;
  internalLinks: number;
}

export interface AuditReport {
  id: string;
  leadId: string;
  websiteUrl: string;
  generatedAt: string;
  lcpMs: number | null;
  domSize: number;
  loadTimeMs: number | null;
  mobileResponsive: boolean;
  performanceScore: number;
  geoScore: number;
  uxScore: number;
  criticalIssues: string[];
  metaIssues: string[];
  legacyScripts: string[];
  slowApiCalls: SlowResource[];
  geoSignals: GeoSignals;
  rawDomExcerpt: string;
}

export interface ProposalPhase {
  phase: "phase_1" | "phase_2" | "phase_3";
  title: string;
  scope: string[];
  deliverables: string[];
  estimatedTimeline: string;
  priceRange: string;
}

export interface AnalysisResult {
  id: string;
  leadId: string;
  auditId: string;
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
  generatedAt: string;
  proposalAcceptedAt: string | null;
}

export interface DashboardSummary {
  totalLeads: number;
  totalAudits: number;
  totalAnalyses: number;
  winRatePct: number;
  meetingRatePct: number;
  proposalRatePct: number;
  avgAuditScore: number;
  statusCounts: { status: LeadStatus; label: string; count: number }[];
}

export interface DataStore {
  leads: Lead[];
  audits: AuditReport[];
  analyses: AnalysisResult[];
  summary: DashboardSummary;
}
