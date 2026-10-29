-- Limit wrong attendance codes: after 5 wrong tries within 10 minutes,
-- check_in() refuses (hint 'rate_limited') until the oldest of them is older
-- than 10 minutes. Without this the 4-digit venue code could be found by
-- calling check_in() up to 10,000 times.

create table public.check_in_attempts (
  participant_id uuid not null references public.participants (id) on delete cascade,
  at             timestamptz not null default now()
);
create index check_in_attempts_idx on public.check_in_attempts (participant_id, at);

-- Only check_in() (security definer) touches it
alter table public.check_in_attempts enable row level security;
revoke all on public.check_in_attempts from anon, authenticated;

-- Same behavior as before, plus the attempt limit. Returns the check-in time,
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

  if (select count(*) from public.check_in_attempts a
      where a.participant_id = pid and a.at > now() - interval '10 minutes') >= 5 then
    raise exception 'too many wrong attendance codes' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  select s.code into venue from public.attendance_settings s;
  if venue is null or venue <> upper(btrim(p_code)) then
    -- Closed check-in isn't the participant's mistake; only count wrong codes
    if venue is not null then
      insert into public.check_in_attempts (participant_id) values (pid);
    end if;
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
