import { notFound } from "next/navigation";
import {
  getLeadById,
  getLatestAnalysisForLead,
  getLatestAuditForLead
} from "@/lib/db";
import { AcceptProposalButton } from "@/components/accept-proposal-button";

interface PublicProposalPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function PublicProposalPage({ params }: PublicProposalPageProps) {
  const { id } = await params;
  const [lead, audit, analysis] = await Promise.all([
    getLeadById(id),
    getLatestAuditForLead(id),
    getLatestAnalysisForLead(id)
  ]);

  if (!lead) {
    notFound();
  }
  if (!audit || !analysis) {
    return (
      <main className="page">
        <article className="card span-12">
          <h1 className="subhead">Proposal is being prepared</h1>
          <p className="muted">
            We found your lead record but no generated audit/proposal yet. Please ask our team
            to run the analysis workflow first.
          </p>
        </article>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>{lead.companyName} · Technical Audit & Proposal</h1>
          <p>Shareable client-facing report for performance, GEO visibility, and refactor roadmap.</p>
        </div>
      </section>

      <section className="grid">
        <article className="card span-4">
          <h2 className="subhead">Audit Snapshot</h2>
          <p>Performance Score: {audit.performanceScore}</p>
          <p>Lighthouse Score: {audit.lighthousePerformanceScore ?? "Not captured"}</p>
          <p>GEO Score: {audit.geoScore}</p>
          <p>UX Score: {audit.uxScore}</p>
          <p>LCP: {audit.lcpSec !== null ? `${audit.lcpSec}s` : "Not captured"}</p>
          <p>FID: {audit.fidMs !== null ? `${audit.fidMs}ms` : "Not captured"}</p>
          <p>CLS: {audit.cls !== null ? audit.cls : "Not captured"}</p>
          <p className="notice">
            {audit.tokenOptimizedAudit
              ? "Token-Optimized Audit Generated"
              : "Standard audit generated"}
          </p>
          <p className="muted">DOM Size: {audit.domSize}</p>
        </article>

        <article className="card span-8">
          <h2 className="subhead">Critical Technical Bottlenecks</h2>
          <ul>
            {analysis.bottlenecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="notice">{analysis.businessImpact}</p>
        </article>

        <article className="card span-4">
          <h2 className="subhead">{analysis.phase1Proposal.title}</h2>
          <p className="muted">{analysis.phase1Proposal.estimatedTimeline}</p>
          <p>{analysis.phase1Proposal.priceRange}</p>
          <ul>
            {analysis.phase1Proposal.scope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card span-4">
          <h2 className="subhead">{analysis.phase2Proposal.title}</h2>
          <p className="muted">{analysis.phase2Proposal.estimatedTimeline}</p>
          <p>{analysis.phase2Proposal.priceRange}</p>
          <ul>
            {analysis.phase2Proposal.scope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card span-4">
          <h2 className="subhead">{analysis.phase3Proposal.title}</h2>
          <p className="muted">{analysis.phase3Proposal.estimatedTimeline}</p>
          <p>{analysis.phase3Proposal.priceRange}</p>
          <ul>
            {analysis.phase3Proposal.scope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card span-12">
          <h2 className="subhead">Commercial Terms</h2>
          <p>{analysis.sowClause}</p>
          <AcceptProposalButton
            leadId={lead.id}
            alreadyAccepted={Boolean(analysis.proposalAcceptedAt)}
          />
        </article>
      </section>
    </main>
  );
}
