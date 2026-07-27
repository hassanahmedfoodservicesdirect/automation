import { DataStore, LeadStatus } from "@/lib/types";

const order: LeadStatus[] = [
  "new",
  "audit_ready",
  "analysis_ready",
  "outreach_sent",
  "meeting_booked",
  "proposal_sent",
  "reviewing_proposal",
  "proposal_accepted",
  "won",
  "lost"
];

export function statusLabel(status: LeadStatus): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildDashboardSummary(store: DataStore) {
  const statusCounts = order.map((status) => ({
    status,
    label: statusLabel(status),
    count: store.leads.filter((lead) => lead.status === status).length
  }));

  const conversionBase = store.leads.length || 1;
  const wonCount = store.leads.filter((lead) => lead.status === "won").length;
  const meetingCount = store.leads.filter(
    (lead) => lead.status === "meeting_booked"
  ).length;
  const proposalCount = store.leads.filter(
    (lead) =>
      lead.status === "proposal_sent" ||
      lead.status === "reviewing_proposal" ||
      lead.status === "proposal_accepted"
  ).length;

  const avgAuditScore =
    store.audits.length > 0
      ? Math.round(
          store.audits.reduce(
            (sum, audit) => sum + (audit.performanceScore + audit.geoScore + audit.uxScore) / 3,
            0
          ) / store.audits.length
        )
      : 0;

  return {
    totalLeads: store.leads.length,
    totalAudits: store.audits.length,
    totalAnalyses: store.analyses.length,
    winRatePct: Math.round((wonCount / conversionBase) * 100),
    meetingRatePct: Math.round((meetingCount / conversionBase) * 100),
    proposalRatePct: Math.round((proposalCount / conversionBase) * 100),
    avgAuditScore,
    statusCounts
  };
}
