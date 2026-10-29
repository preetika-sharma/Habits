-- Habit Tracker: the default habit list offered to new accounts.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again.

-- Who may edit the default list. Rows are added only from this SQL editor.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "Read own admin row" on public.admins;
create policy "Read own admin row" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.admins from anon;
grant select on public.admins to authenticated;

-- The default list itself: one row holding an ordered array of habits, e.g.
-- [{"name":"Run","type":"weekly","target":3,"steps":[]}, ...]
create table if not exists public.default_template (
  id int primary key default 1 check (id = 1),
  habits jsonb not null default '[]'::jsonb check (jsonb_typeof(habits) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.default_template (id) values (1) on conflict (id) do nothing;

alter table public.default_template enable row level security;
drop policy if exists "Anyone signed in can read the default list" on public.default_template;
create policy "Anyone signed in can read the default list" on public.default_template
  for select to authenticated using (true);
drop policy if exists "Admins can update the default list" on public.default_template;
create policy "Admins can update the default list" on public.default_template
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
revoke all on public.default_template from anon;
grant select, update on public.default_template to authenticated;

-- Make the account below an admin. Change the email if you sign in with a different one.
insert into public.admins (user_id)
select id from auth.users where email = 'twin.preetika@gmail.com'
on conflict (user_id) do nothing;

-- Accounts that already exist skip the "default list or blank" choice; only new accounts see it.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"onboarded": true}'::jsonb
where coalesce(raw_user_meta_data ->> 'onboarded', 'false') <> 'true';

-- Check: this should list one admin and the default list row.
select 'admin' as what, u.email as detail from public.admins a join auth.users u on u.id = a.user_id
union all
select 'default list', jsonb_array_length(habits) || ' habits' from public.default_template;
