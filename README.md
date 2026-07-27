# AI-Driven Prospecting, Scraping & Lead Audit Engine

Production-focused Next.js platform for automated lead discovery, live website audits,
Claude-powered analysis generation, and public proposal acceptance workflows.

## Core capabilities

- Automated lead prospecting and niche discovery (`/api/prospect-leads`)
- Multi-channel lead sourcing (Google Search, LinkedIn/Apollo, ProductHunt launches)
- Live deep website audits with Puppeteer (`/api/audit-website`)
- Claude 3.5 Sonnet analysis generation (`/api/generate-analysis`)
- Hyper-personalized outbound assets with 3 outreach variants per lead
- Scope-creep protected phase proposals with shareable public link (`/p/:id`)
- Proposal acceptance tracking (`/api/proposals/:id/accept`)
- Supabase/PostgreSQL persistence (no local JSON state)

## Stack

- Next.js 16 (App Router)
- TypeScript 6
- Supabase (PostgreSQL)
- Puppeteer + Cheerio
- Anthropic Claude API (optional but supported)
- Google PageSpeed Insights API (free tier)

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=... # optional, falls back to deterministic generation
CLAUDE_MODEL=claude-3-5-sonnet-20241022 # optional
GOOGLE_SEARCH_API_KEY=... # optional for prospecting
GOOGLE_SEARCH_ENGINE_ID=... # optional for prospecting
GOOGLE_PAGESPEED_API_KEY=... # optional (fallback uses GOOGLE_SEARCH_API_KEY)
LINKEDIN_SEARCH_API_URL=... # optional custom LinkedIn lead endpoint
LINKEDIN_API_KEY=... # optional LinkedIn endpoint auth
APOLLO_API_KEY=... # optional Apollo people/company sourcing
APOLLO_API_URL=https://api.apollo.io/api/v1/mixed_people/search # optional override
```

3. Create database tables in Supabase SQL editor:

- Run: `supabase/schema.sql`

4. Start app

```bash
npm run dev
```

Open `http://localhost:3000`

## API endpoints

### Pipeline & dashboard
- `GET /api/dashboard` — complete dashboard payload
- `POST /api/leads` — manual lead creation
- `PATCH /api/leads/:id/status` — update lead lifecycle status
- `GET /api/leads/:id/insights` — lead-specific audits and analyses

### Automation routes
- `POST /api/prospect-leads` — multi-channel prospect discovery + optional auto-audit
- `POST /api/audit-website` — run deep live website audit
- `POST /api/generate-analysis` — generate Claude analysis package from audit

### Token-efficiency optimization
- audit context keeps only title/meta, H1/H2, and max 800-char clean text
- PageSpeed Insights metrics are fetched directly (LCP/FID/CLS/performance/mobile readiness)
- Claude call uses strict JSON schema + `max_tokens: 800`
- static system prompt is cache-friendly for Anthropic prompt caching

### Compatibility + downstream flows
- `POST /api/audits` — compatibility route for auditing by lead id
- `POST /api/outreach` — generate outreach pack variants (email, LinkedIn, Loom) from latest analysis
- `POST /api/proposals` — fetch proposal phase payload from latest analysis
- `POST /api/proposals/:id/accept` — mark proposal accepted
- `POST /api/seed` — seed demo leads

## Public proposal page

- Route: `app/p/[id]/page.tsx`
- Client gets latest audit + generated proposal pack
- Includes **Accept Proposal** action with persistence
