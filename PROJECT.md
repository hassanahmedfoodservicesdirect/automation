# Project Guide: AI-Driven Prospecting, Scraping & Lead Audit Engine

## Overview

This project is a Next.js-based internal sales automation platform that:

1. discovers prospects from free and API-based sources,
2. audits websites for speed and GEO readiness,
3. generates technical outreach and proposal content using Claude,
4. tracks lead pipeline progression in Supabase.

## Core Modules

- **Lead Discovery** (`/api/prospect-leads`)
  - Free-first sourcing: Google Search + ProductHunt fallback
  - Optional premium extensions: Apollo and LinkedIn connectors
- **Website Audit** (`/api/audit-website`)
  - Token-optimized extraction (title, meta, headings, condensed text)
  - PageSpeed Insights metrics integration
- **Analysis Engine** (`/api/generate-analysis`)
  - Lean Claude prompt with strict JSON response
  - Outreach + proposal generation
- **Public Proposal Page** (`/p/[id]`)
  - Shareable client-facing audit/proposal view
  - Proposal acceptance action

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Supabase (PostgreSQL)
- Puppeteer + Cheerio
- Anthropic API (Claude)

## Required Environment Variables

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## Recommended Environment Variables

```bash
CLAUDE_MODEL=claude-3-5-sonnet-20241022
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
GOOGLE_PAGESPEED_API_KEY=
```

## Optional Provider Variables

```bash
APOLLO_API_KEY=
APOLLO_API_URL=https://api.apollo.io/api/v1/mixed_people/search
LINKEDIN_SEARCH_API_URL=
LINKEDIN_API_KEY=
```

## Local Setup

```bash
npm install
npm run dev
```

Then open: `http://localhost:3000`

## Database Setup

Run the SQL schema file in Supabase SQL editor:

- `supabase/schema.sql`

## Main API Endpoints

- `GET /api/dashboard`
- `POST /api/leads`
- `PATCH /api/leads/:id/status`
- `POST /api/prospect-leads`
- `POST /api/audit-website`
- `POST /api/generate-analysis`
- `GET /api/leads/:id/insights`
- `POST /api/proposals`
- `POST /api/proposals/:id/accept`

## Notes

- Apollo can return 403 on free plans; the app is built to fail gracefully and continue with free sources.
- Google provider reliability depends on valid `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID`.
- Keep all API keys server-side only and rotate immediately if exposed.
