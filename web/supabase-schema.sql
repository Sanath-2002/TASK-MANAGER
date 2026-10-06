-- Run in the Supabase SQL Editor. Safe to re-run; adds the task manager fields
-- and private projects/subtasks while preserving existing task rows.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  done boolean not null default false,
  priority text not null default 'none' check (priority in ('none', 'low', 'medium', 'high')),
  due_date date,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists description text not null default '';
alter table public.tasks add column if not exists priority text not null default 'none';
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.tasks add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then
    alter table public.tasks add constraint tasks_priority_check check (priority in ('none', 'low', 'medium', 'high'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_description_length_check') then
    alter table public.tasks add constraint tasks_description_length_check check (char_length(description) <= 2000);
  end if;
end $$;

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_project_idx on public.tasks(user_id, project_id);
create index if not exists tasks_user_due_date_idx on public.tasks(user_id, due_date) where done = false;
create index if not exists subtasks_task_idx on public.subtasks(task_id);

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;

revoke all on public.projects, public.tasks, public.subtasks from anon;
grant select, insert, update, delete on public.projects, public.tasks, public.subtasks to authenticated;

drop policy if exists "Guest users can read their own tasks" on public.tasks;
drop policy if exists "Guest users can create their own tasks" on public.tasks;
drop policy if exists "Guest users can update their own tasks" on public.tasks;
drop policy if exists "Guest users can delete their own tasks" on public.tasks;
drop policy if exists "Guests manage their own tasks" on public.tasks;
create policy "Guests manage their own tasks" on public.tasks for all to authenticated
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true)
  with check (
    user_id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
    ))
  );

drop policy if exists "Guests manage their own projects" on public.projects;
create policy "Guests manage their own projects" on public.projects for all to authenticated
  using (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true)
  with check (user_id = (select auth.uid()) and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true);

drop policy if exists "Guests manage their own subtasks" on public.subtasks;
create policy "Guests manage their own subtasks" on public.subtasks for all to authenticated
  using (
    user_id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and (select (auth.jwt() ->> 'is_anonymous')::boolean) is true
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
  );
