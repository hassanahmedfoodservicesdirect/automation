create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website_url text not null unique,
  market text not null default 'Other' check (market in ('US', 'UAE', 'Other')),
  contact_name text,
  contact_email text,
  country text not null default 'Unknown',
  niche text not null default 'general',
  source text not null default 'manual',
  tech_stack text[] not null default '{}',
  status text not null default 'new' check (
    status in (
      'new',
      'audit_ready',
      'analysis_ready',
      'outreach_sent',
      'meeting_booked',
      'proposal_sent',
      'proposal_accepted',
      'won',
      'lost'
    )
  ),
  notes text,
  last_perf_score int,
  last_geo_score int,
  last_ux_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  website_url text not null,
  page_title text not null default '',
  meta_description text not null default '',
  h1_headings text[] not null default '{}',
  h2_headings text[] not null default '{}',
  condensed_text text not null default '',
  token_optimized_audit boolean not null default true,
  lighthouse_performance_score int,
  lcp_sec numeric,
  fid_ms numeric,
  cls numeric,
  mobile_readiness_score int,
  lcp_ms numeric,
  dom_size int not null,
  load_time_ms numeric,
  mobile_responsive boolean not null default false,
  performance_score int not null,
  geo_score int not null,
  ux_score int not null,
  critical_issues text[] not null default '{}',
  meta_issues text[] not null default '{}',
  legacy_scripts text[] not null default '{}',
  slow_api_calls jsonb not null default '[]'::jsonb,
  geo_signals jsonb not null default '{}'::jsonb,
  raw_dom_excerpt text not null default '',
  generated_at timestamptz not null default now()
);

alter table public.audits add column if not exists page_title text not null default '';
alter table public.audits add column if not exists meta_description text not null default '';
alter table public.audits add column if not exists h1_headings text[] not null default '{}';
alter table public.audits add column if not exists h2_headings text[] not null default '{}';
alter table public.audits add column if not exists condensed_text text not null default '';
alter table public.audits add column if not exists token_optimized_audit boolean not null default true;
alter table public.audits add column if not exists lighthouse_performance_score int;
alter table public.audits add column if not exists lcp_sec numeric;
alter table public.audits add column if not exists fid_ms numeric;
alter table public.audits add column if not exists cls numeric;
alter table public.audits add column if not exists mobile_readiness_score int;

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  bottlenecks text[] not null default '{}',
  business_impact text not null,
  cold_email_subject text not null,
  cold_email_body text not null,
  linkedin_dm text not null,
  loom_script text not null,
  phase1_proposal jsonb not null,
  phase2_proposal jsonb not null,
  phase3_proposal jsonb not null,
  sow_clause text not null,
  proposal_accepted_at timestamptz,
  generated_at timestamptz not null default now()
);

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_audits_lead_id on public.audits(lead_id);
create index if not exists idx_analyses_lead_id on public.analyses(lead_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();
