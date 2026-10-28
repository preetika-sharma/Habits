# Habit Tracker

A mobile-first PWA for daily habits and weekly targets, with email sign-in and sync across devices. See the PRD for scope and rules.

Live: https://preetika-sharma.github.io/Habits/

## Run

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and key
npm run dev                  # http://localhost:5173
npm test                     # scoring, streak and sync rules
npm run build                # production build in dist/
```

## Supabase setup (once)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. **Authentication → URL Configuration**: set *Site URL* to `https://preetika-sharma.github.io/Habits/` and add `http://localhost:5173/` under *Redirect URLs*.
4. **Authentication → Emails → Magic Link** template: make sure the body includes `{{ .Token }}` so the email carries a 6-digit code as well as the link (the code is what you type in the installed phone app).
5. Put the project URL and anon/publishable key in `.env.local` for local dev, and in the GitHub repo variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the deployed site.

Supabase's built-in email sender is rate-limited (a few emails per hour). That's fine for personal use; add a custom SMTP provider under **Authentication → Emails** before sharing widely.

## How sync works

- The app reads and writes IndexedDB only, so it's instant and works offline.
- Every local write is also queued in an outbox. The sync engine (`src/sync.ts`) pushes the outbox to `public.records` and pulls rows changed since its last pull: on start, after changes, when the app regains focus or comes back online, and every minute while open.
- Deletes are soft (`deleted = true`) so other devices learn about them. A record with unsent local changes ignores incoming server versions until it's pushed (last write wins).
- On first sign-in, data already on the device is uploaded. Signing out removes the device's copy.

## Layout

- `src/lib/scoring.ts`: scoring, streak and editing-window rules (tested in `scoring.test.ts`).
- `src/lib/sync.ts`: pure sync helpers (tested in `sync.test.ts`); `src/sync.ts`: the sync engine.
- `src/db.ts`: IndexedDB (Dexie) storage, outbox, and JSON export/import.
- `src/AuthGate.tsx`, `src/components/LoginScreen.tsx`: sign-in.
- `src/components/`: Today, Week grid, Week summary, add/edit habit sheet, settings.
