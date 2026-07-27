# AI Agency Sales Engine (2026 Blueprint)

Complete internal product to operate an AI-powered tech agency workflow:

- Lead ingestion and pipeline management
- Automated technical + GEO audit generation
- Hyper-personalized outreach draft generation
- Proposal builder with scope-creep protection clause
- Conversion metrics dashboard

## Tech stack

- Next.js (App Router)
- TypeScript
- Local JSON persistence (`data/store.json`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Product modules

1. **Lead Capture**  
   Add manual leads with company, market, niche, and contact context.
2. **Pipeline Control Center**  
   Trigger audit/outreach/proposal workflows and update lead lifecycle.
3. **Audit Engine**  
   Generates performance/GEO/UX scores with business-impact positioning.
4. **Outreach Engine**  
   Creates outbound drafts (email/LinkedIn/WhatsApp style CTA).
5. **Proposal Engine**  
   Produces phase-based proposal packets aligned with high-ticket offerings.

## API endpoints

- `GET /api/dashboard` — complete dashboard payload + metrics
- `POST /api/leads` — add lead
- `PATCH /api/leads/:id/status` — update lead status
- `POST /api/audits` — generate lead audit
- `POST /api/outreach` — generate outreach draft (requires prior audit)
- `POST /api/proposals` — generate proposal
- `POST /api/seed` — insert sample leads (one-time)
