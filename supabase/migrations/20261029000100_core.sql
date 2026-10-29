-- Core festival schema: teams, participants, attendance, investments, published ticks.
-- Role rules live in the database (RLS + triggers + RPCs), not in the client.

-- Not exposed through the API (only "public" is), so nothing here is readable by clients.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.school as enum ('ku', 'yu', 'skku', 'kaist');

-- Singleton settings row. The attendance code must never reach participants.
create table private.settings (
  id boolean primary key default true check (id),
  attendance_code text not null check (attendance_code ~ '^\d{4}$'),
  default_budget int not null default 1000000 check (default_budget >= 0),
  invest_step int not null default 50000 check (invest_step > 0)
);

create table public.staff (
  email text primary key check (email = lower(email)),
  user_id uuid unique references auth.users on delete set null,
  name text not null default ''
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  table_no text not null default '' check (length(table_no) <= 20),
  project text not null default '' check (length(project) <= 80),
  description text not null default '' check (length(description) <= 300),
  created_at timestamptz not null default now()
);

-- Public directory: names, schools and teams are shown to every signed-in participant.
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  school public.school not null,
  team_id uuid references public.teams on delete set null,
  created_at timestamptz not null default now()
);
create index participants_team_id_idx on public.participants (team_id);

-- Participants sign in with a staff-issued code "LOGIN-SECRET-SECRET". The login id is the
-- public half: it names an auth user <login_id>@participants.devfest.invalid whose password is
-- the secret. Only GoTrue stores the (hashed) secret; it is shown to staff once when issued.
create function private.new_login_id()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- no 0/O, 1/I/L
  candidate text;
begin
  loop
    candidate := (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 4)
    );
    exit when not exists (select 1 from public.participant_private where login_id = candidate);
  end loop;
  return candidate;
end
$$;

-- Per-person data only the person and staff can read.
create table public.participant_private (
  participant_id uuid primary key references public.participants on delete cascade,
  login_id text not null unique default private.new_login_id() check (login_id ~ '^[2-9A-HJ-NP-Z]{4}$'),
  user_id uuid unique references auth.users on delete set null, -- set once a code is issued
  budget int check (budget >= 0), -- null = settings.default_budget
  checked_in_at timestamptz,
  invest_confirmed_at timestamptz -- null = never confirmed
);

-- Confirmed investments only; drafts stay in the browser.
create table public.investments (
  participant_id uuid not null references public.participants on delete cascade,
  team_id uuid not null references public.teams on delete cascade,
  amount int not null check (amount > 0),
  primary key (participant_id, team_id)
);
create index investments_team_id_idx on public.investments (team_id);

-- Published investment status. Participants see totals only through these.
create table public.ticks (
  id bigint generated always as identity primary key,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users on delete set null
);

create table public.tick_totals (
  tick_id bigint not null references public.ticks on delete cascade,
  team_id uuid not null references public.teams on delete cascade,
  total bigint not null,
  investors int not null,
  primary key (tick_id, team_id)
);
create index tick_totals_team_id_idx on public.tick_totals (team_id);

create table private.checkin_attempts (
  participant_id uuid not null,
  at timestamptz not null default now()
);
create index checkin_attempts_idx on private.checkin_attempts (participant_id, at);
