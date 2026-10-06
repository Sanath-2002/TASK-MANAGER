-- Run this once in Supabase SQL Editor to create a private per-browser task table.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "Guest users can read their own tasks"
  on public.tasks for select to authenticated
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true);

create policy "Guest users can create their own tasks"
  on public.tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true);

create policy "Guest users can update their own tasks"
  on public.tasks for update to authenticated
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true)
  with check (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true);

create policy "Guest users can delete their own tasks"
  on public.tasks for delete to authenticated
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true);
