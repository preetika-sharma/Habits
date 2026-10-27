# Habit Tracker

A local-only, mobile-first PWA for daily habits and weekly targets. See the PRD for scope and rules.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # scoring and streak rules
npm run build    # production build in dist/
```

## Layout

- `src/lib/scoring.ts` — every scoring, streak, and editing-window rule from the PRD, as pure functions (tested in `scoring.test.ts`).
- `src/db.ts` — IndexedDB (Dexie) storage, plus JSON export/import. Only check-ins are stored; scores and streaks are computed.
- `src/components/` — Today, Week grid, Week summary, add/edit habit sheet, settings.

Data never leaves the browser. Use Settings → Export JSON to back it up.
