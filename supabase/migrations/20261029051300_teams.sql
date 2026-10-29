-- Teams. Staff create teams and assign members (participants.team_id);
-- members may edit their own team's name, project and description later.

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (btrim(name) <> ''),
  table_label text not null default '',   -- venue table, e.g. "A-01"
  project     text not null default '',
  description text not null default '',
  created_at  timestamptz not null default now()
);

-- Deleting a team leaves its members unassigned
alter table public.participants
  add constraint participants_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete set null;

-- Team info is public to every logged-in participant; no client writes yet.
alter table public.teams enable row level security;

create policy "teams readable by participants"
  on public.teams for select
  to authenticated
  using (true);
