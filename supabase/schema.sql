-- Independent Work Dashboard — Supabase schema
--
-- Run this once in your Supabase project's SQL Editor (Dashboard > SQL Editor > New query).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / ON CONFLICT / drop-then-create).
--
-- Scope & security note: this app is built for a single teacher and a small
-- handful of students (see the concept doc), not a multi-tenant or
-- district-compliance deployment. Row Level Security here reflects that:
-- reads and writes are open to both the public "anon" key (needed so
-- students can use the app without logging in — avatar-tap only) and the
-- authenticated teacher, and only DELETE is restricted to the authenticated
-- teacher. That means anyone with your Supabase URL + anon key (which is
-- always public in a client-side app — that's normal) could read student
-- names or write bogus rows, but couldn't wipe your data outright. If you
-- need stricter protection later (e.g. hiding real student names), tighten
-- these policies or swap in family-friendly display names.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists students (
  id text primary key,
  name text not null,
  avatar text not null,
  streak int not null default 0,
  last_completed_date date,
  streak_hidden boolean not null default false,
  badge_ids jsonb not null default '[]',
  feature_toggles jsonb not null default '{}',
  break_minutes int not null default 4,
  tts_settings jsonb not null default '{"rate":1,"voiceURI":null}',
  created_at timestamptz not null default now(),
  playground_threshold int not null default 4
);

create table if not exists rotations (
  student_id text not null references students(id) on delete cascade,
  subject text not null check (subject in ('math', 'literacy')),
  tasks jsonb not null default '[]',
  primary key (student_id, subject)
);

create table if not exists subject_progress (
  student_id text not null references students(id) on delete cascade,
  subject text not null check (subject in ('math', 'literacy')),
  date date not null,
  active_index int not null default 0,
  completed_task_ids jsonb not null default '[]',
  quiz_state jsonb not null default '{}',
  session_ritual_seen boolean not null default false,
  subject_complete boolean not null default false,
  primary key (student_id, subject)
);

create table if not exists break_requests (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  status text not null check (status in ('pending', 'approved', 'denied', 'granted'))
);

create table if not exists help_pings (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  resolved boolean not null default false
);

create table if not exists offscreen_reviews (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  subject text not null check (subject in ('math', 'literacy')),
  task_id text,
  task_title text not null default '',
  occurred_at timestamptz not null default now(),
  verified boolean not null default false
);

create table if not exists badges (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null default '🌟'
);

create table if not exists badge_earns (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  badge_id text not null references badges(id) on delete cascade,
  earned_at timestamptz not null default now()
);

create table if not exists break_pool_items (
  id text primary key,
  title text not null,
  kind text not null check (kind in ('text', 'link')),
  value text not null,
  student_id text references students(id) on delete cascade
);

create table if not exists question_sets (
  id text primary key,
  name text not null,
  subject text not null check (subject in ('math', 'literacy')),
  kind text not null check (kind in ('quiz', 'drill')),
  questions jsonb not null default '[]',
  cards jsonb not null default '[]',
  cover_image_url text,
  created_at timestamptz not null default now()
);

-- Reusable activities: created once, dragged into any student's daily plan
-- (which copies it into that student's `rotations.tasks`) and/or flagged
-- for the shared Playground pool. Same content shape as a Task, plus a
-- subject tag and the Playground flag.
create table if not exists activity_library (
  id text primary key,
  subject text not null check (subject in ('math', 'literacy')),
  title text not null,
  icon text not null default '📘',
  type text not null,
  quiz jsonb,
  link jsonb,
  offscreen jsonb,
  video jsonb,
  passage jsonb,
  drill jsonb,
  wordchain jsonb,
  sentence_edit jsonb,
  custom_steps jsonb,
  reference_image_url text,
  reference_link_url text,
  reference_link_label text,
  in_playground boolean not null default false,
  created_at timestamptz not null default now()
);

-- A named, reusable daily plan — a frozen snapshot of activities (not
-- references to activity_library, so editing/deleting a library item never
-- breaks a saved template). "Apply" copies these into a student's rotation.
create table if not exists plan_templates (
  id text primary key,
  name text not null,
  subject text not null check (subject in ('math', 'literacy')),
  activities jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Which template auto-loads into a student's live daily plan (the
-- `rotations` row above) for a given subject + weekday. A row here means
-- "on this weekday, refresh the plan from this template" — applied once per
-- day (see student_meta.weekly_plan_applied) the first time the student
-- logs in that day, so a teacher's same-day hand edit to that day's copy
-- never gets clobbered until the next calendar day.
create table if not exists weekly_schedule (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  subject text not null check (subject in ('math', 'literacy')),
  day text not null check (day in ('mon', 'tue', 'wed', 'thu', 'fri')),
  template_id text not null references plan_templates(id) on delete cascade
);

create table if not exists rotation_modes (
  student_id text not null references students(id) on delete cascade,
  subject text not null check (subject in ('math', 'literacy')),
  mode text not null check (mode in ('sequence', 'choiceboard')),
  primary key (student_id, subject)
);

-- Consolidated lower-traffic per-student bits: lifetime task completion
-- counts (badge tracking), tools ever used (Explorer badge), recycle
-- corrections count (Great Correction-Making badge), word-processor
-- autosave text, and whether the one-time onboarding walkthrough was seen.
create table if not exists student_meta (
  student_id text primary key references students(id) on delete cascade,
  task_completion_counts jsonb not null default '{}',
  tool_usage jsonb not null default '[]',
  corrections_count int not null default 0,
  scratch_text text not null default '',
  onboarded boolean not null default false
);

-- Columns added after the initial release — safe no-ops if already present,
-- and the only step needed to bring an existing project's database up to
-- date (re-running this whole file is also fine).
alter table students add column if not exists playground_threshold int not null default 4;
alter table question_sets add column if not exists cover_image_url text;
alter table student_meta add column if not exists weekly_plan_applied jsonb not null default '{}';

-- ---------------------------------------------------------------------------
-- Storage: an "images" bucket for teacher-uploaded pictures (reference
-- images, question/drill/step images, cover images) — replaces asking the
-- teacher to paste image URLs. Public read (images are shown in the app
-- with a plain <img src>), open upload for the same reason the table RLS
-- above is open (see the scope note at the top of this file).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

drop policy if exists images_public_read on storage.objects;
create policy images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'images');

drop policy if exists images_upload on storage.objects;
create policy images_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'images');

drop policy if exists images_delete on storage.objects;
create policy images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'images');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'students', 'rotations', 'subject_progress', 'break_requests', 'help_pings',
    'offscreen_reviews', 'badges', 'badge_earns', 'break_pool_items',
    'question_sets', 'rotation_modes', 'student_meta', 'activity_library', 'plan_templates', 'weekly_schedule'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      t || '_select', t
    );

    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format(
      'create policy %I on %I for insert to anon, authenticated with check (true)',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format(
      'create policy %I on %I for update to anon, authenticated using (true) with check (true)',
      t || '_update', t
    );

    execute format('drop policy if exists %I on %I', t || '_delete', t);
    execute format(
      'create policy %I on %I for delete to authenticated using (true)',
      t || '_delete', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: make sure every table broadcasts changes
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'students', 'rotations', 'subject_progress', 'break_requests', 'help_pings',
    'offscreen_reviews', 'badges', 'badge_earns', 'break_pool_items',
    'question_sets', 'rotation_modes', 'student_meta', 'activity_library', 'plan_templates', 'weekly_schedule'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Starting badge taxonomy (teacher-editable afterwards) — fixed ids because
-- the app's own badge-awarding logic refers to these by id.
-- ---------------------------------------------------------------------------

insert into badges (id, name, description, icon) values
  ('showed-up', 'Showed Up', 'Kept a streak going', '🌟'),
  ('practice-progress', 'Practice Makes Progress', 'Reviewed the same task 3 times', '🔁'),
  ('great-correction', 'Great Correction-Making', 'Fixed a missed question with a smile', '💪'),
  ('explorer', 'Explorer', 'Tried a new tool or launch pad item', '🧭')
on conflict (id) do nothing;
