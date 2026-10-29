-- Attendance (출석). One row per participant per event day, written either by
-- the participant entering the venue code shown on site, or by staff.
-- Replaces participants.checked_in.

create table public.attendance (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  day            date not null default (now() at time zone 'Asia/Seoul')::date,
  checked_at     timestamptz not null default now(),
  method         text not null check (method in ('code', 'staff')),
  checked_by     uuid references auth.users (id) on delete set null, -- staff user for method = 'staff'
  unique (participant_id, day)
);

create index attendance_day_idx on public.attendance (day);

-- Venue attendance code staff show on site. Single row; null code = check-in closed.
create table public.attendance_settings (
  id         boolean primary key default true check (id),
  code       text check (code is null or code ~ '^[0-9A-Z]{4,8}$'),
  updated_at timestamptz not null default now()
);

insert into public.attendance_settings (code) values ('1106');

-- Carry over the mock check-ins, then drop the old flag
insert into public.attendance (participant_id, method)
select id, 'staff' from public.participants where checked_in;

alter table public.participants drop column checked_in;

-- claim_participant returned checked_in; recreate without it
drop function public.claim_participant(text, text);

create function public.claim_participant(p_name text, p_code text)
returns table (id uuid, name text, school text, team_id uuid)
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

  update public.participants set user_id = null where user_id = uid and participants.id <> pid;
  update public.participants set user_id = uid where participants.id = pid;

  return query
    select p.id, p.name, p.school, p.team_id
    from public.participants p
    where p.id = pid;
end;
$$;

revoke all on function public.claim_participant(text, text) from public, anon;
grant execute on function public.claim_participant(text, text) to authenticated;

-- Participant self check-in with the venue code. Returns the check-in time,
-- or null if the code is wrong or check-in is closed. Idempotent per day.
create or replace function public.check_in(p_code text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
  venue text;
  v_at timestamptz;
begin
  select p.id into pid from public.participants p where p.user_id = auth.uid();
  if pid is null then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select s.code into venue from public.attendance_settings s;
  if venue is null or venue <> upper(btrim(p_code)) then
    return null;
  end if;

  insert into public.attendance (participant_id, method)
  values (pid, 'code')
  on conflict (participant_id, day) do nothing;

  select a.checked_at into v_at
  from public.attendance a
  where a.participant_id = pid
    and a.day = (now() at time zone 'Asia/Seoul')::date;
  return v_at;
end;
$$;

revoke all on function public.check_in(text) from public, anon;
grant execute on function public.check_in(text) to authenticated;

-- Access
alter table public.attendance enable row level security;
alter table public.attendance_settings enable row level security;

revoke all on public.attendance, public.attendance_settings from anon, authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, update on public.attendance_settings to authenticated;

-- Participants see only their own attendance (no others', per the role split)
create policy "participants read own attendance"
  on public.attendance for select to authenticated
  using (participant_id = (select p.id from public.participants p where p.user_id = (select auth.uid())));

create policy "staff read attendance"
  on public.attendance for select to authenticated
  using ((select public.is_staff()));

create policy "staff insert attendance"
  on public.attendance for insert to authenticated
  with check ((select public.is_staff()));

create policy "staff update attendance"
  on public.attendance for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff delete attendance"
  on public.attendance for delete to authenticated
  using ((select public.is_staff()));

-- The venue code is staff-only; participants just submit a guess to check_in()
create policy "staff read attendance settings"
  on public.attendance_settings for select to authenticated
  using ((select public.is_staff()));

create policy "staff update attendance settings"
  on public.attendance_settings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
