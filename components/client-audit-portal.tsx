"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisResult, AuditReport, Lead } from "@/lib/types";
import { AcceptProposalButton } from "@/components/accept-proposal-button";

interface ClientAuditPortalProps {
  lead: Lead;
  audit: AuditReport;
  analysis: AnalysisResult | null;
  calendlyUrl: string;
}

type ScoreKey = "performanceScore" | "geoScore" | "uxScore";

const scoreConfig: { key: ScoreKey; label: string; helper: string }[] = [
  {
    key: "performanceScore",
    label: "Performance",
    helper: "Page speed, response time, and runtime weight."
  },
  {
    key: "geoScore",
    label: "AI Search Readiness",
    helper: "Schema, crawl depth, and AI/SEO discoverability."
  },
  {
    key: "uxScore",
    label: "UX Health",
    helper: "Mobile compatibility and conversion-flow friction."
  }
];

function formatMilliseconds(value: number | null): string {
  if (!value || Number.isNaN(value)) {
    return "N/A";
  }
  return `${Math.round(value)} ms`;
}

function projectedMetric(value: number | null, reductionPct: number): number | null {
  if (!value || Number.isNaN(value)) {
    return null;
  }
  return Math.max(100, Math.round(value * (1 - reductionPct / 100)));
}

function projectedScore(value: number, improvementPct: number): number {
  return Math.min(99, Math.round(value + improvementPct * 0.7));
}

export function ClientAuditPortal({
  lead,
  audit,
  analysis,
  calendlyUrl
}: ClientAuditPortalProps) {
  const [activeScore, setActiveScore] = useState<ScoreKey>("performanceScore");
  const [improvementPct, setImprovementPct] = useState(28);

  useEffect(() => {
    void fetch("/api/webhooks/audit-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        event: "public_audit_opened",
        openedAt: new Date().toISOString()
      })
    });
  }, [lead.id]);

  const activeMeta = scoreConfig.find((item) => item.key === activeScore) ?? scoreConfig[0];
  const activeValue = audit[activeMeta.key];
  const projectedLcpMs = useMemo(
    () => projectedMetric(audit.lcpMs, improvementPct),
    [audit.lcpMs, improvementPct]
  );
  const projectedLoadMs = useMemo(
    () => projectedMetric(audit.loadTimeMs, improvementPct),
    [audit.loadTimeMs, improvementPct]
  );
  const projectedPerfScore = useMemo(
    () => projectedScore(audit.performanceScore, improvementPct),
    [audit.performanceScore, improvementPct]
  );

  return (
    <section className="grid">
      <article className="card span-12">
        <h1 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
          {lead.companyName} · Technical Audit Portal
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Public report with speed diagnostics, AI search readiness signals, and projected
          optimization outcomes.
        </p>
      </article>

      <article className="card span-8">
        <h2 className="subhead">Interactive Performance Scores</h2>
        <div className="button-row" style={{ marginBottom: "0.8rem" }}>
          {scoreConfig.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeScore === item.key ? "primary" : "ghost"}
              onClick={() => setActiveScore(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: "0.65rem" }}>
          <strong style={{ fontSize: "2rem", lineHeight: 1 }}>
            {activeValue}
            <span style={{ fontSize: "0.95rem", marginLeft: "0.25rem" }}>/100</span>
          </strong>
        </div>
        <div
          style={{
            width: "100%",
            height: "10px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
            marginBottom: "0.65rem"
          }}
        >
          <div
            style={{
              width: `${Math.max(4, Math.min(100, activeValue))}%`,
              height: "100%",
              background: "linear-gradient(90deg, #5b8cff 0%, #3ddc97 100%)"
            }}
          />
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {activeMeta.helper}
        </p>
        <ul style={{ marginBottom: 0 }}>
          {audit.criticalIssues.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="card span-4">
        <h2 className="subhead">Current Snapshot</h2>
        <p>
          <strong>Website:</strong> {lead.websiteUrl}
        </p>
        <p>
          <strong>LCP:</strong> {formatMilliseconds(audit.lcpMs)}
        </p>
        <p>
          <strong>Load Time:</strong> {formatMilliseconds(audit.loadTimeMs)}
        </p>
        <p>
          <strong>AI Search Readiness:</strong> {audit.geoScore}/100
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Mobile Responsive:</strong> {audit.mobileResponsive ? "Yes" : "Needs improvement"}
        </p>
      </article>

      <article className="card span-8">
        <h2 className="subhead">Before vs After Speed Projection</h2>
        <label style={{ marginBottom: "0.55rem" }}>
          Expected optimization impact: <strong>{improvementPct}%</strong>
          <input
            type="range"
            min={10}
            max={60}
            value={improvementPct}
            onChange={(event) => setImprovementPct(Number(event.target.value))}
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Before</th>
                <th>Projected After</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>LCP</td>
                <td>{formatMilliseconds(audit.lcpMs)}</td>
                <td>{formatMilliseconds(projectedLcpMs)}</td>
              </tr>
              <tr>
                <td>Total Load Time</td>
                <td>{formatMilliseconds(audit.loadTimeMs)}</td>
                <td>{formatMilliseconds(projectedLoadMs)}</td>
              </tr>
              <tr>
                <td>Performance Score</td>
                <td>{audit.performanceScore}/100</td>
                <td>{projectedPerfScore}/100</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="card span-4">
        <h2 className="subhead">Next Steps</h2>
        <p className="muted">
          Book a technical walkthrough and confirm implementation scope for your optimization
          sprint.
        </p>
        <div className="button-row" style={{ marginBottom: "0.7rem" }}>
          <a className="primary-link" href={calendlyUrl} target="_blank" rel="noreferrer">
            Book on Calendly
          </a>
        </div>
        {analysis ? (
          <AcceptProposalButton
            leadId={lead.id}
            alreadyAccepted={Boolean(analysis.proposalAcceptedAt)}
          />
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            Proposal CTA will unlock once analysis is generated for this lead.
          </p>
        )}
      </article>

      <article className="card span-12">
        <h2 className="subhead">Audit Notes</h2>
        <p className="muted">
          {analysis?.businessImpact ??
            "Estimated impact and scope details will be added once analysis generation is completed."}
        </p>
        {analysis ? (
          <div className="code">
            <strong>Email hook:</strong> {analysis.coldEmailSubject}
            {"\n\n"}
            <strong>Loom script:</strong>
            {"\n"}
            {analysis.loomScript}
          </div>
        ) : null}
      </article>
    </section>
  );
}
