-- Participants of GDG Demo Day. Staff register people and hand each one a
-- personal access code; on entry the participant logs in with name + code.

-- Short codes without look-alike characters (no 0/O, 1/I/L)
create or replace function public.generate_access_code(len int default 6)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, len);
$$;

create table public.participants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (btrim(name) <> ''),
  school      text not null check (school in ('ku', 'yu', 'skku', 'kaist')),
  team_id     uuid,                                   -- assigned by staff; FK added with the teams table
  access_code text not null unique default public.generate_access_code(),
  checked_in  boolean not null default false,
  user_id     uuid unique references auth.users (id) on delete set null, -- auth user that logged in as this participant
  created_at  timestamptz not null default now()
);

comment on column public.participants.access_code is 'Personal entry code handed out by staff. Never readable by other participants.';
comment on column public.participants.user_id is 'Set by claim_participant() when someone logs in with name + access_code.';

create index participants_team_id_idx on public.participants (team_id);

-- Row level security: a logged-in participant sees only their own row.
-- Staff manage rows from the dashboard / service role for now.
alter table public.participants enable row level security;

create policy "participants read own row"
  on public.participants for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Login: match name + access code and bind the row to the current auth user
-- (an anonymous Supabase session). Logging in again from another device moves
-- the binding there. Returns the participant without the code, or nothing.
create or replace function public.claim_participant(p_name text, p_code text)
returns table (id uuid, name text, school text, team_id uuid, checked_in boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.id into pid
  from public.participants p
  where p.access_code = upper(btrim(p_code))
    and btrim(p.name) = btrim(p_name);

  if pid is null then
    return;
  end if;

  -- One participant per auth user
  update public.participants set user_id = null where user_id = uid and participants.id <> pid;
  update public.participants set user_id = uid where participants.id = pid;

  return query
    select p.id, p.name, p.school, p.team_id, p.checked_in
    from public.participants p
    where p.id = pid;
end;
$$;

revoke all on function public.claim_participant(text, text) from public, anon;
grant execute on function public.claim_participant(text, text) to authenticated;
revoke all on function public.generate_access_code(int) from public, anon, authenticated;
