export type LeadStatus =
  | "new"
  | "audit_ready"
  | "outreach_sent"
  | "meeting_booked"
  | "proposal_sent"
  | "won"
  | "lost";

export interface Lead {
  id: string;
  companyName: string;
  website: string;
  market: "US" | "UAE" | "Other";
  contactName: string;
  contactEmail: string;
  niche: string;
  source: string;
  status: LeadStatus;
  notes: string;
  createdAt: string;
}

export interface AuditReport {
  id: string;
  leadId: string;
  generatedAt: string;
  performanceScore: number;
  geoScore: number;
  uxScore: number;
  criticalIssue: string;
  businessImpact: string;
  recommendations: string[];
  oneLinerPitch: string;
}

export interface OutreachDraft {
  id: string;
  leadId: string;
  channel: "email" | "linkedin" | "whatsapp";
  subject: string;
  body: string;
  cta: string;
  generatedAt: string;
}

export interface Proposal {
  id: string;
  leadId: string;
  phase: "phase_1" | "phase_2" | "phase_3";
  scope: string[];
  deliverables: string[];
  estimatedTimeline: string;
  priceRange: string;
  sowClause: string;
  generatedAt: string;
}

export interface DataStore {
  leads: Lead[];
  audits: AuditReport[];
  outreach: OutreachDraft[];
  proposals: Proposal[];
}
