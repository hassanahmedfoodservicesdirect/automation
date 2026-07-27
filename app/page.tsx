"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnalysisResult, AuditReport, DataStore, LeadStatus } from "@/lib/types";

type LeadInsightsPayload = {
  lead: DataStore["leads"][number];
  audits: AuditReport[];
  analyses: AnalysisResult[];
};

type LeadIngestionSource = "google-search" | "linkedin" | "producthunt" | "manual";

function hasError(payload: unknown): payload is { error?: string } {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  return "error" in payload;
}

const defaultDashboard: DataStore = {
  leads: [],
  audits: [],
  analyses: [],
  summary: {
    totalLeads: 0,
    totalAudits: 0,
    totalAnalyses: 0,
    winRatePct: 0,
    meetingRatePct: 0,
    proposalRatePct: 0,
    avgAuditScore: 0,
    statusCounts: []
  }
};

const statusOptions: LeadStatus[] = [
  "new",
  "audit_ready",
  "analysis_ready",
  "outreach_sent",
  "meeting_booked",
  "proposal_sent",
  "proposal_accepted",
  "won",
  "lost"
];

const leadSourceOptions: { value: LeadIngestionSource; label: string }[] = [
  { value: "google-search", label: "Google Search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "producthunt", label: "ProductHunt" },
  { value: "manual", label: "Manual" }
];

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [workingLeadId, setWorkingLeadId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [dashboard, setDashboard] = useState<DataStore>(defaultDashboard);
  const [discoverQuery, setDiscoverQuery] = useState("B2B SaaS startups");
  const [discoverSource, setDiscoverSource] = useState<LeadIngestionSource>("google-search");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<LeadInsightsPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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
    const response = await fetch("/api/dashboard");
    const payload = (await response.json()) as DataStore | { error?: string };
    if (!response.ok || hasError(payload)) {
      const error = hasError(payload) ? payload.error : "Unable to load dashboard.";
      throw new Error(error);
    }
    setDashboard(payload);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((payload: DataStore | { error?: string }) => {
        if (!active) {
          return;
        }
        if (hasError(payload)) {
          setMessage(payload.error ?? "Unable to load dashboard data.");
          setLoading(false);
          return;
        }
        setDashboard(payload);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setMessage("Unable to load dashboard data.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const latestAnalysisByLead = useMemo(() => {
    const map = new Map<string, AnalysisResult>();
    for (const analysis of dashboard.analyses) {
      if (!map.has(analysis.leadId)) {
        map.set(analysis.leadId, analysis);
      }
    }
    return map;
  }, [dashboard.analyses]);

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

  async function discoverLeads(): Promise<void> {
    if (discoverSource === "manual") {
      setMessage("Manual source selected. Use Manual Lead Capture form to ingest a lead.");
      return;
    }

    const prospectPayload =
      discoverSource === "linkedin"
        ? {
            source: discoverSource,
            jobTitles: ["Founder", "CTO", "CEO"],
            companySizes: ["11-50"],
            regions: ["USA", "UAE"]
          }
        : { source: discoverSource };

    await withRefresh(
      () =>
        fetch("/api/prospect-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: discoverQuery,
            autoAudit: true,
            auditLimit: 3,
            ...prospectPayload
          })
        }),
      "Prospecting completed. New leads discovered."
    );
  }

  async function runAudit(leadId: string): Promise<void> {
    setWorkingLeadId(leadId);
    await withRefresh(
      () =>
        fetch("/api/audit-website", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId })
        }),
      "Live website audit generated."
    );
  }

  async function runAnalysis(leadId: string): Promise<void> {
    setWorkingLeadId(leadId);
    await withRefresh(
      () =>
        fetch("/api/generate-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId })
        }),
      "Claude-style analysis and proposal generated."
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

  async function openPreview(leadId: string): Promise<void> {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/insights`);
      const payload = (await response.json()) as LeadInsightsPayload | { error?: string };
      if (!response.ok || hasError(payload)) {
        setMessage("Preview data is not available yet for this lead.");
        setPreviewOpen(false);
        return;
      }
      setPreviewData(payload);
    } catch {
      setMessage("Failed to load preview.");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>AI-Driven Prospecting & Audit Engine</h1>
          <p>
            Automated pipeline: Discover leads - Live website audit - Claude analysis -
            Shareable proposal pages.
          </p>
        </div>
        <span className="badge">Supabase + Puppeteer + Claude-ready</span>
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
          <p className="muted">AI Analyses</p>
          <p className="stat-value">{loading ? "..." : dashboard.summary.totalAnalyses}</p>
        </article>
        <article className="card span-3">
          <p className="muted">Avg Audit Score</p>
          <p className="stat-value">{loading ? "..." : `${dashboard.summary.avgAuditScore}`}</p>
        </article>

        <article className="card span-12">
          <h2 className="subhead">Automated Lead Discovery</h2>
          <div className="button-row">
            <select
              value={discoverSource}
              onChange={(event) => setDiscoverSource(event.target.value as LeadIngestionSource)}
              style={{ width: "220px" }}
            >
              {leadSourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              style={{ minWidth: "360px", flex: 1 }}
              value={discoverQuery}
              onChange={(event) => setDiscoverQuery(event.target.value)}
              placeholder="B2B SaaS startups, E-commerce brands in US/UAE..."
            />
            <button className="primary" type="button" onClick={() => void discoverLeads()}>
              Discover New Leads
            </button>
          </div>
          <p className="muted" style={{ marginTop: "0.6rem" }}>
            Triggers /api/prospect-leads by source and auto-runs deep audits for discovered
            prospects.
          </p>
        </article>

        <article className="card span-4">
          <h2 className="subhead">Manual Lead Capture</h2>
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
                type="email"
                value={leadForm.contactEmail}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, contactEmail: event.target.value }))
                }
              />
            </label>
            <label>
              Niche
              <input
                value={leadForm.niche}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, niche: event.target.value }))
                }
              />
            </label>
            <label>
              Source
              <select
                value={leadForm.source}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, source: event.target.value }))
                }
              >
                {leadSourceOptions.map((option) => (
                  <option key={`manual-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
            <button className="primary" type="submit">
              Add Lead
            </button>
          </form>
        </article>

        <article className="card span-8">
          <h2 className="subhead">Lead Pipeline + Live Audit Scores</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Perf</th>
                  <th>GEO</th>
                  <th>UX</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No leads available yet.
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
                          <span className="muted">{lead.websiteUrl}</span>
                        </td>
                        <td>
                          {lead.contactName || "Unknown"}
                          <br />
                          <span className="muted">{lead.contactEmail ?? "No public email"}</span>
                        </td>
                        <td>{lead.lastPerfScore ?? "-"}</td>
                        <td>{lead.lastGeoScore ?? "-"}</td>
                        <td>{lead.lastUxScore ?? "-"}</td>
                        <td>
                          <span className={`pill status-${lead.status.replaceAll("_", "-")}`}>
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
                              onClick={() => void runAnalysis(lead.id)}
                            >
                              Generate AI Pack
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={isWorking}
                              onClick={() => void openPreview(lead.id)}
                            >
                              Preview
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
          <h2 className="subhead">Recent Live Audits</h2>
          <div className="panel-list">
            {dashboard.audits.slice(0, 5).map((audit) => (
              <div key={audit.id} className="panel-item">
                <p>
                  <strong>{audit.websiteUrl}</strong>
                </p>
                <p>Perf {audit.performanceScore} | GEO {audit.geoScore} | UX {audit.uxScore}</p>
                <p className="muted">{audit.criticalIssues.slice(0, 2).join(" ")}</p>
              </div>
            ))}
            {dashboard.audits.length === 0 ? <p className="muted">No audits yet.</p> : null}
          </div>
        </article>

        <article className="card span-6">
          <h2 className="subhead">Recent AI Analysis Packs</h2>
          <div className="panel-list">
            {dashboard.analyses.slice(0, 5).map((analysis) => (
              <div key={analysis.id} className="panel-item">
                <p>
                  <strong>{analysis.coldEmailSubject}</strong>
                </p>
                <p className="muted">{analysis.businessImpact}</p>
                <div className="code">{analysis.linkedinDm}</div>
              </div>
            ))}
            {dashboard.analyses.length === 0 ? (
              <p className="muted">No AI analysis generated yet.</p>
            ) : null}
          </div>
        </article>

        <article className="card span-12">
          <h2 className="subhead">Shareable Client Proposal Links</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Proposal Link</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.leads.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No leads yet.
                    </td>
                  </tr>
                ) : (
                  dashboard.leads.map((lead) => (
                    <tr key={`${lead.id}-share`}>
                      <td>{lead.companyName}</td>
                      <td>{lead.status.replaceAll("_", " ")}</td>
                      <td>
                        {latestAnalysisByLead.has(lead.id) ? (
                          <a href={`/p/${lead.id}`} target="_blank" rel="noreferrer">
                            {`/p/${lead.id}`}
                          </a>
                        ) : (
                          <span className="muted">Generate analysis first</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {previewOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="button-row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>Generated Audit / Outreach / Proposal Preview</h3>
              <button className="ghost" type="button" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>
            {previewLoading ? (
              <p className="muted">Loading preview...</p>
            ) : previewData ? (
              <div className="stack">
                <p>
                  <strong>{previewData.lead.companyName}</strong> · {previewData.lead.websiteUrl}
                </p>
                <div className="code">
                  {JSON.stringify(previewData.audits[0] ?? {}, null, 2)}
                </div>
                <div className="code">
                  {JSON.stringify(previewData.analyses[0] ?? {}, null, 2)}
                </div>
              </div>
            ) : (
              <p className="muted">No preview data yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
