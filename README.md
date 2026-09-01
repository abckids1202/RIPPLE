# RIPPLE

RIPPLE is a daily learning game about reconstructing strange but real chains of cause and effect.

> Two events. One hidden chain. Discover how the world connects.

The current build is an editorial evidence atlas: each case combines a source-first puzzle, archival/public-domain media, annotated image pins, causal labels, rejection copy for decoys, and a short learning takeaway.

## Run locally

From PowerShell:

```powershell
cd C:\Users\charl\OneDrive\Desktop\RIPPLE
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

The app works without environment variables by using the five seed puzzles and browser-local attempts/history. To enable the Supabase API, copy `.env.example` to `.env.local`, add the public Vite values, and restart Vite:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in `.env.local`. Search and cron secrets must stay in Supabase Edge Function secrets.

## Build and preview

```powershell
npm run build
npm run preview
```

## What is included

- Daily, archive, gameplay, result-map, and method screens
- Evidence-board gameplay with media annotations, source ribbons, timeline markers, hints, lives, resume state, and reduced-motion support
- Public-domain/licensed media metadata with source URL, license, credit, alt text, focal point, and annotation coordinates
- Local editor desk preview with candidate inbox, evidence trail, media queue, review checklist, and approval gate
- Supabase schema and Row Level Security policies for content, research candidates, reviews, publication slots, attempts, and revisions
- Supabase Edge Functions for spoiler-safe public API routes, reviewed research ingestion, and idempotent UTC publication/fallback selection

## Content

Seed puzzle content lives in [`src/data/puzzles.ts`](C:/Users/charl/OneDrive/Desktop/RIPPLE/src/data/puzzles.ts). Evidence media and annotations live in [`src/data/atlas.ts`](C:/Users/charl/OneDrive/Desktop/RIPPLE/src/data/atlas.ts). The editor preview data is in [`src/data/editor.ts`](C:/Users/charl/OneDrive/Desktop/RIPPLE/src/data/editor.ts).

## Supabase

See [`supabase/README.md`](C:/Users/charl/OneDrive/Desktop/RIPPLE/supabase/README.md) for migration, function deployment, secrets, and scheduler setup. Research jobs only create candidates; a human must review and approve a chain before the publication job can use it.
