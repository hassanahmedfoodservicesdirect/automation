"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuditReport, Lead, LeadStatus, OutreachDraft, Proposal } from "@/lib/types";

type Summary = {
  totalLeads: number;
  totalAudits: number;
  totalOutreach: number;
  totalProposals: number;
  winRatePct: number;
  meetingRatePct: number;
  proposalRatePct: number;
  avgAuditScore: number;
  statusCounts: { status: LeadStatus; label: string; count: number }[];
};

type DashboardPayload = {
  summary: Summary;
  leads: Lead[];
  audits: AuditReport[];
  outreach: OutreachDraft[];
  proposals: Proposal[];
};

const defaultSummary: Summary = {
  totalLeads: 0,
  totalAudits: 0,
  totalOutreach: 0,
  totalProposals: 0,
  winRatePct: 0,
  meetingRatePct: 0,
  proposalRatePct: 0,
  avgAuditScore: 0,
  statusCounts: []
};

const statusOptions: LeadStatus[] = [
  "new",
  "audit_ready",
  "outreach_sent",
  "meeting_booked",
  "proposal_sent",
  "won",
  "lost"
];

const phaseLabels: Record<Proposal["phase"], string> = {
  phase_1: "Phase 1 (Web/GEO Overhaul)",
  phase_2: "Phase 2 (MVP/Refactor)",
  phase_3: "Phase 3 (Fractional CTO)"
};

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [workingLeadId, setWorkingLeadId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [dashboard, setDashboard] = useState<DashboardPayload>({
    summary: defaultSummary,
    leads: [],
    audits: [],
    outreach: [],
    proposals: []
  });
  const [leadForm, setLeadForm] = useState({
    companyName: "",
    website: "",
    market: "US",
    contactName: "",
    contactEmail: "",
    niche: "saas",
    source: "manual",
    notes: ""
  });

  async function fetchDashboard(): Promise<void> {
    setLoading(true);
    const response = await fetch("/api/dashboard");
    const payload = (await response.json()) as DashboardPayload;
    setDashboard(payload);
    setLoading(false);
  }

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const leadsById = useMemo(
    () => new Map(dashboard.leads.map((lead) => [lead.id, lead])),
    [dashboard.leads]
  );

  async function withRefresh(
    action: () => Promise<Response>,
    successMessage: string
  ): Promise<void> {
    try {
      const response = await action();
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Operation failed.");
        return;
      }
      setMessage(successMessage);
      await fetchDashboard();
    } catch {
      setMessage("Something went wrong while processing request.");
    } finally {
      setWorkingLeadId(null);
    }
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withRefresh(
      () =>
        fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadForm)
        }),
      "New lead added."
    );
    setLeadForm({
      companyName: "",
      website: "",
      market: "US",
      contactName: "",
      contactEmail: "",
      niche: "saas",
      source: "manual",
      notes: ""
    });
  }

  async function seedLeads(): Promise<void> {
    await withRefresh(
      () => fetch("/api/seed", { method: "POST" }),
      "Sample leads inserted."
    );
  }

  async function runAudit(leadId: string): Promise<void> {
    setWorkingLeadId(leadId);
    await withRefresh(
      () =>
        fetch("/api/audits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId })
        }),
      "Audit generated."
    );
  }

  async function runOutreach(leadId: string, channel: OutreachDraft["channel"]) {
    setWorkingLeadId(leadId);
    await withRefresh(
      () =>
        fetch("/api/outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, channel })
        }),
      `Outreach draft generated for ${channel}.`
    );
  }

  async function runProposal(leadId: string, phase: Proposal["phase"]) {
    setWorkingLeadId(leadId);
    await withRefresh(
      () =>
        fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, phase })
        }),
      `Proposal created for ${phaseLabels[phase]}.`
    );
  }

  async function updateStatus(leadId: string, status: LeadStatus) {
    setWorkingLeadId(leadId);
    await withRefresh(
      () =>
        fetch(`/api/leads/${leadId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        }),
      "Lead status updated."
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>AI Agency Sales Engine</h1>
          <p>
            Complete internal product for lead pipeline, technical audits, outbound drafts,
            and high-ticket proposal management.
          </p>
        </div>
        <span className="badge">Next.js + Claude-style workflow</span>
      </section>

      {message ? <p className="notice">{message}</p> : null}

      <section className="grid">
        <article className="card span-3">
          <p className="muted">Total Leads</p>
          <p className="stat-value">{loading ? "..." : dashboard.summary.totalLeads}</p>
        </article>
        <article className="card span-3">
          <p className="muted">Audits Generated</p>
          <p className="stat-value">{loading ? "..." : dashboard.summary.totalAudits}</p>
        </article>
        <article className="card span-3">
          <p className="muted">Outreach Drafts</p>
          <p className="stat-value">{loading ? "..." : dashboard.summary.totalOutreach}</p>
        </article>
        <article className="card span-3">
          <p className="muted">Win Rate</p>
          <p className="stat-value">{loading ? "..." : `${dashboard.summary.winRatePct}%`}</p>
        </article>

        <article className="card span-4">
          <h2 className="subhead">Lead Capture</h2>
          <form className="stack" onSubmit={submitLead}>
            <label>
              Company Name
              <input
                required
                value={leadForm.companyName}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, companyName: event.target.value }))
                }
              />
            </label>
            <label>
              Website
              <input
                required
                type="url"
                placeholder="https://example.com"
                value={leadForm.website}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, website: event.target.value }))
                }
              />
            </label>
            <label>
              Market
              <select
                value={leadForm.market}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, market: event.target.value }))
                }
              >
                <option value="US">US</option>
                <option value="UAE">UAE</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>
              Contact Name
              <input
                value={leadForm.contactName}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, contactName: event.target.value }))
                }
              />
            </label>
            <label>
              Contact Email
              <input
                required
                type="email"
                value={leadForm.contactEmail}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, contactEmail: event.target.value }))
                }
              />
            </label>
            <label>
              Niche
              <select
                value={leadForm.niche}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, niche: event.target.value }))
                }
              >
                <option value="saas">SaaS</option>
                <option value="ecommerce">E-commerce</option>
                <option value="healthcare">Healthcare</option>
                <option value="consulting">Consulting</option>
              </select>
            </label>
            <label>
              Source
              <input
                value={leadForm.source}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, source: event.target.value }))
                }
              />
            </label>
            <label>
              Notes
              <textarea
                value={leadForm.notes}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>
            <div className="button-row">
              <button className="primary" type="submit">
                Add Lead
              </button>
              <button className="ghost" type="button" onClick={() => void seedLeads()}>
                Insert Sample Leads
              </button>
            </div>
          </form>
        </article>

        <article className="card span-8">
          <h2 className="subhead">Pipeline Control Center</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No leads yet. Add a lead or seed sample data.
                    </td>
                  </tr>
                ) : (
                  dashboard.leads.map((lead) => {
                    const isWorking = workingLeadId === lead.id;
                    return (
                      <tr key={lead.id}>
                        <td>
                          <strong>{lead.companyName}</strong>
                          <br />
                          <span className="muted">{lead.website}</span>
                        </td>
                        <td>
                          {lead.contactName || "Unknown"}
                          <br />
                          <span className="muted">{lead.contactEmail}</span>
                        </td>
                        <td>
                          <span
                            className={`pill status-${lead.status.replaceAll("_", "-")}`}
                          >
                            {lead.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td>
                          <div className="button-row">
                            <button
                              type="button"
                              className="ghost"
                              disabled={isWorking}
                              onClick={() => void runAudit(lead.id)}
                            >
                              Audit
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={isWorking}
                              onClick={() => void runOutreach(lead.id, "email")}
                            >
                              Outreach
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={isWorking}
                              onClick={() => void runProposal(lead.id, "phase_1")}
                            >
                              Proposal
                            </button>
                            <select
                              disabled={isWorking}
                              value={lead.status}
                              onChange={(event) =>
                                void updateStatus(lead.id, event.target.value as LeadStatus)
                              }
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card span-6">
          <h2 className="subhead">Recent Audits</h2>
          <div className="panel-list">
            {dashboard.audits.slice(0, 5).map((audit) => {
              const lead = leadsById.get(audit.leadId);
              return (
                <div key={audit.id} className="panel-item">
                  <p>
                    <strong>{lead?.companyName ?? "Unknown lead"}</strong>
                  </p>
                  <p className="muted">{audit.criticalIssue}</p>
                  <p>
                    Perf {audit.performanceScore} | GEO {audit.geoScore} | UX {audit.uxScore}
                  </p>
                  <div className="code">{audit.oneLinerPitch}</div>
                </div>
              );
            })}
            {dashboard.audits.length === 0 ? (
              <p className="muted">No audits yet.</p>
            ) : null}
          </div>
        </article>

        <article className="card span-6">
          <h2 className="subhead">Recent Outreach Drafts</h2>
          <div className="panel-list">
            {dashboard.outreach.slice(0, 5).map((draft) => {
              const lead = leadsById.get(draft.leadId);
              return (
                <div key={draft.id} className="panel-item">
                  <p>
                    <strong>{lead?.companyName ?? "Unknown lead"}</strong> · {draft.channel}
                  </p>
                  <p className="muted">{draft.subject}</p>
                  <div className="code">{`${draft.body}\n\n${draft.cta}`}</div>
                </div>
              );
            })}
            {dashboard.outreach.length === 0 ? (
              <p className="muted">No outreach drafts yet.</p>
            ) : null}
          </div>
        </article>

        <article className="card span-12">
          <h2 className="subhead">Recent Proposals (with Scope-Creep Protection)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Phase</th>
                  <th>Timeline</th>
                  <th>Price</th>
                  <th>Clause</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.proposals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No proposals generated yet.
                    </td>
                  </tr>
                ) : (
                  dashboard.proposals.slice(0, 8).map((proposal) => (
                    <tr key={proposal.id}>
                      <td>{leadsById.get(proposal.leadId)?.companyName ?? "Unknown lead"}</td>
                      <td>{phaseLabels[proposal.phase]}</td>
                      <td>{proposal.estimatedTimeline}</td>
                      <td>{proposal.priceRange}</td>
                      <td>{proposal.sowClause}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
