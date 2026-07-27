import { notFound } from "next/navigation";
import {
  getLeadById,
  getLatestAnalysisForLead,
  getLatestAuditForLead
} from "@/lib/db";
import { ClientAuditPortal } from "@/components/client-audit-portal";

interface AuditPortalPageProps {
  params: Promise<{ leadId: string }>;
}

export const dynamic = "force-dynamic";

export default async function AuditPortalPage({ params }: AuditPortalPageProps) {
  const { leadId } = await params;
  const [lead, audit, analysis] = await Promise.all([
    getLeadById(leadId),
    getLatestAuditForLead(leadId),
    getLatestAnalysisForLead(leadId)
  ]);

  if (!lead) {
    notFound();
  }

  if (!audit) {
    return (
      <main className="page">
        <article className="card span-12">
          <h1 className="subhead">Audit is being prepared</h1>
          <p className="muted">
            We found the lead profile but no generated audit yet. Please ask our team to run the
            audit workflow first.
          </p>
        </article>
      </main>
    );
  }

  const calendlyUrl =
    process.env.NEXT_PUBLIC_CALENDLY_URL ??
    process.env.CALENDLY_URL ??
    "https://calendly.com";

  return (
    <main className="page">
      <ClientAuditPortal
        lead={lead}
        audit={audit}
        analysis={analysis}
        calendlyUrl={calendlyUrl}
      />
    </main>
  );
}
