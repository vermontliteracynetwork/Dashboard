# Setup: connecting the backend and going live

The app is a static site (Vite/React) that talks to a [Supabase](https://supabase.com)
project for its database, real-time sync, and the teacher's sign-in. None of
this can be created on your behalf from here — Supabase and Vercel accounts
are yours to own — but every step below is quick and free at this scale
(one teacher, a couple of students).

Total time: ~15 minutes.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign up (free), and click **New project**.
2. Pick any name/region, set a database password (you won't need it day-to-day — Supabase stores it), and wait ~2 minutes for it to provision.

## 2. Run the database setup script

1. In your new project, open **SQL Editor** (left sidebar) → **New query**.
2. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repo, copy its entire contents, and paste into the SQL editor.
3. Click **Run**. You should see "Success. No rows returned." This creates every table, sets up permissions, turns on real-time sync, and seeds the four starter badges.
4. It's safe to re-run this later (e.g. after pulling an update to `schema.sql`) — every statement is written to not fail on a second run.

## 3. Create the one teacher account

The teacher signs in with just a password — no email to remember — but under
the hood that's powered by one real Supabase Auth account so the session
handling is solid.

1. In Supabase, open **Authentication** → **Users** → **Add user** → **Create new user**.
2. Email: `teacher@independent-work-dashboard.local` (or anything you like — just remember it for step 4 if you change it).
3. Password: whatever the teacher will type on the sign-in screen.
4. Leave "Auto Confirm User" checked, then create it.

## 4. Get your API keys

1. In Supabase, go to **Project Settings** → **API**.
2. You'll need two values: the **Project URL** and the **anon / public** key.

## 5. Configure the app

**For local development:**

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_TEACHER_EMAIL=teacher@independent-work-dashboard.local   # only if you used a different email in step 3
```

Then `npm install && npm run dev`.

**For a live deployment (e.g. Vercel):**

Add the same three variables under your project's Environment Variables
settings, then redeploy. On Vercel: **Project → Settings → Environment
Variables**, add each one, and trigger a new deployment (or just push a
commit).

## Keeping the database up to date

`supabase/schema.sql` changes as the app grows (new columns, new tables). Whenever
you pull an update, re-run the whole file in the SQL Editor — it's written to be
safe to re-run any number of times (existing data is untouched; it only adds
what's missing).

## 6. Try it

- Open the app → **I'm the Teacher** → sign in with the password from step 3.
- Add a student, build a rotation, etc. — everything now writes straight to
  Supabase and updates live on any other tab/device pointed at the same app.

## Notes on security & scope

- This is built for one teacher and a handful of students, matching the
  concept doc's own scope note (no district compliance, no multi-tenant
  requirements). The database's Row Level Security policies reflect that:
  reads/writes are open (needed so students can use the app without an
  account — avatar-tap only), and only *deletes* require the teacher's
  signed-in session. See the comment at the top of `supabase/schema.sql`
  for the full reasoning and how to tighten it if you ever need to.
- The Supabase **anon key** is meant to be public — it's embedded in the
  app's JS bundle by design, same as any client-side Supabase app. Don't
  use the **service role** key here; it's not needed and would bypass RLS
  entirely if leaked.
- If you ever need to reset the teacher password, do it from Supabase
  under **Authentication → Users**.
