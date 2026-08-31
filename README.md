# RIPPLE

RIPPLE is a mobile-first browser game about reconstructing strange but real chains of cause and effect.

> Two events. One hidden chain. Discover how the world connects.

## MVP included

- Daily Ripple #143: Mount Tambora → the Year Without a Summer → the bicycle
- Four additional archive cases across science, medicine, music, and internet culture
- Three plausible choices at every step
- Wrong branches that explain why the connection does not hold
- Local resume state, completion history, hints, scoring, and spoiler-free share text
- Animated chain reveal with relationship labels and source links
- Responsive mobile/desktop layouts, keyboard-friendly controls, and reduced-motion support

## Run locally

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```

## Content model

Puzzle content lives in [`src/data/puzzles.ts`](./src/data/puzzles.ts). Each step includes a relationship label, bridge explanation, hint, plausible decoys, rejection copy, and a source link so the content can later move into an editorial backend without changing the game UI.

## Next product step

The current build is the local vertical slice described in the product plan. The natural next phase is a Supabase-backed public daily endpoint and a protected editor workflow for expanding the reviewed puzzle library to 30 cases.
