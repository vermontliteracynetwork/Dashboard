-- Everything the live database still needs (2026-10-08).
-- Copy this whole file into the Supabase SQL Editor and press Run, once.
-- Every line is safe to run again: nothing is deleted, existing data stays.

-- 1. Activity Library: a student's own title and description save again.
alter table activity_library add column if not exists student_title text;
alter table activity_library add column if not exists student_description text;

-- 2. Marketplace: Home items you make yourself keep their 3D model.
alter table marketplace_items add column if not exists model_path text;

-- 3. Slime Chess personal leaderboard.
create table if not exists chess_games (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  played_at timestamptz not null default now(),
  level text not null check (level in ('easy', 'medium', 'hard')),
  result text not null check (result in ('win', 'loss', 'draw', 'unfinished')),
  xp int not null default 0,
  captured jsonb not null default '[]',
  moves int not null default 0
);

-- 4. Style looks (characters, Grammar Gus boards, power-ups and more save here).
create table if not exists style_looks (
  owner_id text primary key,
  look jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 5. Let the app read and write the two new tables (same rules as every other table).
do $$
declare
  t text;
begin
  foreach t in array array['chess_games', 'style_looks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('create policy %I on %I for insert to anon, authenticated with check (true)', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('create policy %I on %I for update to anon, authenticated using (true) with check (true)', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);
    execute format('create policy %I on %I for delete to authenticated using (true)', t || '_delete', t);
  end loop;
end $$;
