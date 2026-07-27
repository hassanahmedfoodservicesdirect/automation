import { PostgrestError } from "@supabase/supabase-js";
import {
  AnalysisResult,
  AuditReport,
  DashboardSummary,
  DataStore,
  GeoSignals,
  Lead,
  LeadStatus,
  ProposalPhase,
  SlowResource
} from "@/lib/types";
import { getSupabaseAdminClient } from "@/lib/supabase";

interface LeadRow {
  id: string;
  company_name: string;
  website_url: string;
  market: "US" | "UAE" | "Other";
  contact_name: string | null;
  contact_email: string | null;
  country: string;
  niche: string;
  source: string;
  tech_stack: string[] | null;
  status: LeadStatus;
  notes: string | null;
  last_perf_score: number | null;
  last_geo_score: number | null;
  last_ux_score: number | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  lead_id: string;
  website_url: string;
  page_title: string | null;
  meta_description: string | null;
  h1_headings: string[] | null;
  h2_headings: string[] | null;
  condensed_text: string | null;
  token_optimized_audit: boolean | null;
  lighthouse_performance_score: number | null;
  lcp_sec: number | null;
  fid_ms: number | null;
  cls: number | null;
  mobile_readiness_score: number | null;
  lcp_ms: number | null;
  dom_size: number;
  load_time_ms: number | null;
  mobile_responsive: boolean;
  performance_score: number;
  geo_score: number;
  ux_score: number;
  critical_issues: string[] | null;
  meta_issues: string[] | null;
  legacy_scripts: string[] | null;
  slow_api_calls: SlowResource[] | null;
  geo_signals: GeoSignals | null;
  raw_dom_excerpt: string;
  generated_at: string;
}

interface AnalysisRow {
  id: string;
  lead_id: string;
  audit_id: string;
  bottlenecks: string[] | null;
  business_impact: string;
  cold_email_subject: string;
  cold_email_body: string;
  linkedin_dm: string;
  loom_script: string;
  phase1_proposal: ProposalPhase;
  phase2_proposal: ProposalPhase;
  phase3_proposal: ProposalPhase;
  sow_clause: string;
  proposal_accepted_at: string | null;
  generated_at: string;
}

function throwIfError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    companyName: row.company_name,
    websiteUrl: row.website_url,
    market: row.market,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    country: row.country,
    niche: row.niche,
    source: row.source,
    techStack: row.tech_stack ?? [],
    status: row.status,
    notes: row.notes,
    lastPerfScore: row.last_perf_score,
    lastGeoScore: row.last_geo_score,
    lastUxScore: row.last_ux_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function defaultGeoSignals(): GeoSignals {
  return {
    hasTitle: false,
    hasMetaDescription: false,
    hasSchemaMarkup: false,
    hasFaqSignals: false,
    headingCount: 0,
    internalLinks: 0
  };
}

function toAudit(row: AuditRow): AuditReport {
  return {
    id: row.id,
    leadId: row.lead_id,
    websiteUrl: row.website_url,
    generatedAt: row.generated_at,
    pageTitle: row.page_title ?? "",
    metaDescription: row.meta_description ?? "",
    h1Headings: row.h1_headings ?? [],
    h2Headings: row.h2_headings ?? [],
    condensedText: row.condensed_text ?? "",
    tokenOptimizedAudit: row.token_optimized_audit ?? false,
    lighthousePerformanceScore: row.lighthouse_performance_score,
    lcpSec: row.lcp_sec,
    fidMs: row.fid_ms,
    cls: row.cls,
    mobileReadinessScore: row.mobile_readiness_score,
    lcpMs: row.lcp_ms,
    domSize: row.dom_size,
    loadTimeMs: row.load_time_ms,
    mobileResponsive: row.mobile_responsive,
    performanceScore: row.performance_score,
    geoScore: row.geo_score,
    uxScore: row.ux_score,
    criticalIssues: row.critical_issues ?? [],
    metaIssues: row.meta_issues ?? [],
    legacyScripts: row.legacy_scripts ?? [],
    slowApiCalls: row.slow_api_calls ?? [],
    geoSignals: row.geo_signals ?? defaultGeoSignals(),
    rawDomExcerpt: row.raw_dom_excerpt
  };
}

function toAnalysis(row: AnalysisRow): AnalysisResult {
  return {
    id: row.id,
    leadId: row.lead_id,
    auditId: row.audit_id,
    bottlenecks: row.bottlenecks ?? [],
    businessImpact: row.business_impact,
    coldEmailSubject: row.cold_email_subject,
    coldEmailBody: row.cold_email_body,
    linkedinDm: row.linkedin_dm,
    loomScript: row.loom_script,
    phase1Proposal: row.phase1_proposal,
    phase2Proposal: row.phase2_proposal,
    phase3Proposal: row.phase3_proposal,
    sowClause: row.sow_clause,
    generatedAt: row.generated_at,
    proposalAcceptedAt: row.proposal_accepted_at
  };
}

const statusOrder: LeadStatus[] = [
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

function statusLabel(status: LeadStatus): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSummary(leads: Lead[], audits: AuditReport[], analyses: AnalysisResult[]): DashboardSummary {
  const statusCounts = statusOrder.map((status) => ({
    status,
    label: statusLabel(status),
    count: leads.filter((lead) => lead.status === status).length
  }));
  const conversionBase = leads.length || 1;
  const wonCount = leads.filter((lead) => lead.status === "won").length;
  const meetingCount = leads.filter((lead) => lead.status === "meeting_booked").length;
  const proposalCount = leads.filter(
    (lead) => lead.status === "proposal_sent" || lead.status === "proposal_accepted"
  ).length;
  const avgAuditScore =
    audits.length === 0
      ? 0
      : Math.round(
          audits.reduce(
            (total, audit) => total + (audit.performanceScore + audit.geoScore + audit.uxScore) / 3,
            0
          ) / audits.length
        );
  return {
    totalLeads: leads.length,
    totalAudits: audits.length,
    totalAnalyses: analyses.length,
    winRatePct: Math.round((wonCount / conversionBase) * 100),
    meetingRatePct: Math.round((meetingCount / conversionBase) * 100),
    proposalRatePct: Math.round((proposalCount / conversionBase) * 100),
    avgAuditScore,
    statusCounts
  };
}

export async function getLeads(): Promise<Lead[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(error);
  return ((data ?? []) as LeadRow[]).map(toLead);
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  throwIfError(error);
  if (!data) {
    return null;
  }
  return toLead(data as LeadRow);
}

export interface NewLeadInput {
  companyName: string;
  websiteUrl: string;
  market: "US" | "UAE" | "Other";
  contactName?: string | null;
  contactEmail?: string | null;
  country?: string;
  niche?: string;
  source?: string;
  notes?: string | null;
  techStack?: string[];
}

export async function createLead(input: NewLeadInput): Promise<Lead> {
  const supabase = getSupabaseAdminClient();
  const payload = {
    company_name: input.companyName,
    website_url: input.websiteUrl,
    market: input.market,
    contact_name: input.contactName ?? null,
    contact_email: input.contactEmail ?? null,
    country: input.country ?? "Unknown",
    niche: input.niche ?? "general",
    source: input.source ?? "manual",
    notes: input.notes ?? null,
    tech_stack: input.techStack ?? [],
    status: "new" as LeadStatus
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select("*")
    .single();
  throwIfError(error);
  return toLead(data as LeadRow);
}

export async function upsertProspectLead(input: NewLeadInput): Promise<Lead> {
  const supabase = getSupabaseAdminClient();
  const payload = {
    company_name: input.companyName,
    website_url: input.websiteUrl,
    market: input.market,
    contact_name: input.contactName ?? null,
    contact_email: input.contactEmail ?? null,
    country: input.country ?? "Unknown",
    niche: input.niche ?? "general",
    source: input.source ?? "prospector",
    notes: input.notes ?? null,
    tech_stack: input.techStack ?? [],
    status: "new" as LeadStatus
  };

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "website_url" })
    .select("*")
    .single();
  throwIfError(error);
  return toLead(data as LeadRow);
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<Lead> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .select("*")
    .single();
  throwIfError(error);
  return toLead(data as LeadRow);
}

export interface CreateAuditInput {
  leadId: string;
  websiteUrl: string;
  pageTitle: string;
  metaDescription: string;
  h1Headings: string[];
  h2Headings: string[];
  condensedText: string;
  tokenOptimizedAudit: boolean;
  lighthousePerformanceScore: number | null;
  lcpSec: number | null;
  fidMs: number | null;
  cls: number | null;
  mobileReadinessScore: number | null;
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

export async function createAudit(input: CreateAuditInput): Promise<AuditReport> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .insert({
      lead_id: input.leadId,
      website_url: input.websiteUrl,
      page_title: input.pageTitle,
      meta_description: input.metaDescription,
      h1_headings: input.h1Headings,
      h2_headings: input.h2Headings,
      condensed_text: input.condensedText,
      token_optimized_audit: input.tokenOptimizedAudit,
      lighthouse_performance_score: input.lighthousePerformanceScore,
      lcp_sec: input.lcpSec,
      fid_ms: input.fidMs,
      cls: input.cls,
      mobile_readiness_score: input.mobileReadinessScore,
      lcp_ms: input.lcpMs,
      dom_size: input.domSize,
      load_time_ms: input.loadTimeMs,
      mobile_responsive: input.mobileResponsive,
      performance_score: input.performanceScore,
      geo_score: input.geoScore,
      ux_score: input.uxScore,
      critical_issues: input.criticalIssues,
      meta_issues: input.metaIssues,
      legacy_scripts: input.legacyScripts,
      slow_api_calls: input.slowApiCalls,
      geo_signals: input.geoSignals,
      raw_dom_excerpt: input.rawDomExcerpt
    })
    .select("*")
    .single();
  throwIfError(error);

  const updateResult = await supabase
    .from("leads")
    .update({
      status: "audit_ready",
      last_perf_score: input.performanceScore,
      last_geo_score: input.geoScore,
      last_ux_score: input.uxScore
    })
    .eq("id", input.leadId);
  throwIfError(updateResult.error);

  return toAudit(data as AuditRow);
}

export async function getLatestAuditForLead(leadId: string): Promise<AuditReport | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("lead_id", leadId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    return null;
  }
  return toAudit(data as AuditRow);
}

export async function getAuditById(auditId: string): Promise<AuditReport | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    return null;
  }
  return toAudit(data as AuditRow);
}

export async function getLatestAnalysisForLead(leadId: string): Promise<AnalysisResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("lead_id", leadId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    return null;
  }
  return toAnalysis(data as AnalysisRow);
}

export async function getAuditsForLead(leadId: string, limit = 10): Promise<AuditReport[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("lead_id", leadId)
    .order("generated_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return ((data ?? []) as AuditRow[]).map(toAudit);
}

export async function getAnalysesForLead(leadId: string, limit = 5): Promise<AnalysisResult[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("lead_id", leadId)
    .order("generated_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return ((data ?? []) as AnalysisRow[]).map(toAnalysis);
}

export interface SaveAnalysisInput {
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
}

export async function saveAnalysis(input: SaveAnalysisInput): Promise<AnalysisResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analyses")
    .insert({
      lead_id: input.leadId,
      audit_id: input.auditId,
      bottlenecks: input.bottlenecks,
      business_impact: input.businessImpact,
      cold_email_subject: input.coldEmailSubject,
      cold_email_body: input.coldEmailBody,
      linkedin_dm: input.linkedinDm,
      loom_script: input.loomScript,
      phase1_proposal: input.phase1Proposal,
      phase2_proposal: input.phase2Proposal,
      phase3_proposal: input.phase3Proposal,
      sow_clause: input.sowClause
    })
    .select("*")
    .single();
  throwIfError(error);

  const updateResult = await supabase
    .from("leads")
    .update({ status: "proposal_sent" })
    .eq("id", input.leadId);
  throwIfError(updateResult.error);

  return toAnalysis(data as AnalysisRow);
}

export async function acceptProposal(leadId: string): Promise<AnalysisResult | null> {
  const supabase = getSupabaseAdminClient();
  const latestAnalysis = await getLatestAnalysisForLead(leadId);
  if (!latestAnalysis) {
    return null;
  }

  const { data, error } = await supabase
    .from("analyses")
    .update({ proposal_accepted_at: new Date().toISOString() })
    .eq("id", latestAnalysis.id)
    .select("*")
    .single();
  throwIfError(error);

  const leadUpdate = await supabase
    .from("leads")
    .update({ status: "proposal_accepted" })
    .eq("id", leadId);
  throwIfError(leadUpdate.error);

  return toAnalysis(data as AnalysisRow);
}

export async function getDashboardData(): Promise<DataStore> {
  const supabase = getSupabaseAdminClient();
  const [leadsResult, auditsResult, analysesResult] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase.from("audits").select("*").order("generated_at", { ascending: false }).limit(25),
    supabase.from("analyses").select("*").order("generated_at", { ascending: false }).limit(25)
  ]);
  throwIfError(leadsResult.error);
  throwIfError(auditsResult.error);
  throwIfError(analysesResult.error);

  const leads = ((leadsResult.data ?? []) as LeadRow[]).map(toLead);
  const audits = ((auditsResult.data ?? []) as AuditRow[]).map(toAudit);
  const analyses = ((analysesResult.data ?? []) as AnalysisRow[]).map(toAnalysis);
  return {
    leads,
    audits,
    analyses,
    summary: buildSummary(leads, audits, analyses)
  };
}
