-- Habit Tracker: sync storage.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Every local record (habit, subtask, target, check-in, settings) is stored as one row,
-- keyed by its owner, kind and id. Deletes are soft (deleted = true) so other devices
-- learn about them; updated_at is set by the server and drives incremental pulls.

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('habits', 'subtasks', 'targets', 'checkIns', 'settings')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

-- The server owns updated_at so clocks on different devices can't disagree.
create or replace function public.records_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_touch_updated_at on public.records;
create trigger records_touch_updated_at
  before insert or update on public.records
  for each row execute function public.records_touch_updated_at();

-- Row-level security: each signed-in user can only see and write their own rows.
alter table public.records enable row level security;

drop policy if exists "Read own records" on public.records;
create policy "Read own records" on public.records
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Insert own records" on public.records;
create policy "Insert own records" on public.records
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own records" on public.records;
create policy "Update own records" on public.records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- No delete policy: rows are soft-deleted, and removed with the account.
revoke all on public.records from anon;
grant select, insert, update on public.records to authenticated;
