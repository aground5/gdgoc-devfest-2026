-- Festival RPCs. Errors carry a short machine-readable code in HINT so the UI can map them to copy.

create function private.assert_staff()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501', hint = 'staff_only';
  end if;
end
$$;

create function private.assert_participant()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := public.current_participant_id();
begin
  if me is null then
    raise exception 'not a registered participant' using errcode = '42501', hint = 'not_participant';
  end if;
  return me;
end
$$;

-- Budget rules everyone may read (the attendance code stays private).
create function public.get_settings()
returns table (default_budget int, invest_step int)
language sql stable security definer set search_path = ''
as $$
  select default_budget, invest_step from private.settings
$$;

-- {teamId: amount} -> rows, dropping zero/negative amounts.
create function private.parse_alloc(p_alloc jsonb)
returns table (team_id uuid, amount int)
language sql immutable set search_path = ''
as $$
  select key::uuid, value::int
  from jsonb_each_text(coalesce(p_alloc, '{}'::jsonb))
  where value::int > 0
$$;

-- Replace the caller's whole allocation ({teamId: amount}) in one transaction.
create function public.confirm_investments(p_alloc jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.assert_participant();
  my_team uuid := public.my_team_id();
  v_budget int;
  v_step int;
  v_total bigint;
  v_own boolean;
  v_off_step boolean;
  v_unknown boolean;
begin
  if jsonb_typeof(coalesce(p_alloc, '{}'::jsonb)) <> 'object' then
    raise exception 'allocation must be an object' using hint = 'invalid';
  end if;

  -- Lock the participant's row so concurrent confirms run one after another.
  select coalesce(pp.budget, s.default_budget), s.invest_step
    into v_budget, v_step
    from public.participant_private pp, private.settings s
    where pp.participant_id = me
    for update of pp;

  select coalesce(sum(a.amount), 0),
         coalesce(bool_or(a.team_id = my_team), false),
         coalesce(bool_or(a.amount % v_step <> 0), false),
         coalesce(bool_or(t.id is null), false)
    into v_total, v_own, v_off_step, v_unknown
    from private.parse_alloc(p_alloc) a left join public.teams t on t.id = a.team_id;

  if v_unknown then
    raise exception 'unknown team' using hint = 'unknown_team';
  elsif v_own then
    raise exception 'cannot invest in own team' using hint = 'own_team';
  elsif v_off_step then
    raise exception 'amount must be a multiple of %', v_step using hint = 'step';
  elsif v_total > v_budget then
    raise exception 'over budget (% > %)', v_total, v_budget using hint = 'over_budget';
  end if;

  delete from public.investments where participant_id = me;
  insert into public.investments (participant_id, team_id, amount)
    select me, team_id, amount from private.parse_alloc(p_alloc);
  update public.participant_private set invest_confirmed_at = now() where participant_id = me;
end
$$;

-- Self check-in with the code shown at the venue. 5 wrong tries per 10 minutes.
create function public.check_in(p_code text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.assert_participant();
begin
  if (select count(*) from private.checkin_attempts
      where participant_id = me and at > now() - interval '10 minutes') >= 5 then
    raise exception 'too many attempts' using hint = 'rate_limited';
  end if;

  if p_code is distinct from (select attendance_code from private.settings) then
    insert into private.checkin_attempts (participant_id) values (me);
    return false;
  end if;

  update public.participant_private
    set checked_in_at = coalesce(checked_in_at, now())
    where participant_id = me;
  return true;
end
$$;

/* ---------- Staff only ---------- */

create function public.get_attendance_code()
returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.assert_staff();
  return (select attendance_code from private.settings);
end
$$;

create function public.set_attendance_code(p_code text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_staff();
  if p_code !~ '^\d{4}$' then
    raise exception 'code must be 4 digits' using hint = 'invalid_code';
  end if;
  update private.settings set attendance_code = p_code;
  return p_code;
end
$$;

create function public.random_attendance_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  code text;
begin
  perform private.assert_staff();
  loop
    code := lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when code is distinct from (select attendance_code from private.settings);
  end loop;
  update private.settings set attendance_code = code;
  return code;
end
$$;

create function public.set_default_budget(p_amount int)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_staff();
  if p_amount < 0 then
    raise exception 'budget must be >= 0' using hint = 'invalid';
  end if;
  update private.settings set default_budget = p_amount;
end
$$;

-- Set budgets for many people. Rounded to the step; the default is stored as null (no override).
create function public.set_budgets(p_ids uuid[], p_amount int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_step int;
  v_default int;
  v_amount int;
begin
  perform private.assert_staff();
  select invest_step, default_budget into v_step, v_default from private.settings;
  v_amount := greatest(0, round(p_amount::numeric / v_step)::int * v_step);
  update public.participant_private
    set budget = nullif(v_amount, v_default)
    where participant_id = any (p_ids);
end
$$;

create function public.set_checked_in(p_ids uuid[], p_on boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_staff();
  update public.participant_private
    set checked_in_at = case when p_on then coalesce(checked_in_at, now()) end
    where participant_id = any (p_ids);
end
$$;

-- Add a participant together with their private row (login id) in one step.
-- The login code itself is issued separately (needs the auth admin API).
create function public.add_participant(p_name text, p_school public.school, p_team uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform private.assert_staff();
  insert into public.participants (name, school, team_id)
    values (trim(p_name), p_school, p_team) returning id into new_id;
  insert into public.participant_private (participant_id) values (new_id);
  return new_id;
end
$$;

-- Live totals per team (every team, zeros included). Participants never see these.
create function public.live_totals()
returns table (team_id uuid, total bigint, investors int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.assert_staff();
  return query
    select t.id, coalesce(sum(i.amount), 0)::bigint, count(i.participant_id)::int
    from public.teams t
    left join public.investments i on i.team_id = t.id
    group by t.id;
end
$$;

-- Snapshot live totals as a new published tick. Refuses when nothing changed since the last one.
create function public.publish_tick()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  last_id bigint;
  new_id bigint;
begin
  perform private.assert_staff();
  select id into last_id from public.ticks order by id desc limit 1;
  if last_id is not null and not exists (
    (select * from public.live_totals()
     except select team_id, total, investors from public.tick_totals where tick_id = last_id)
    union all
    (select team_id, total, investors from public.tick_totals where tick_id = last_id
     except select * from public.live_totals())
  ) then
    raise exception 'nothing changed since the last tick' using hint = 'unchanged';
  end if;

  insert into public.ticks (published_by) values (auth.uid()) returning id into new_id;
  insert into public.tick_totals (tick_id, team_id, total, investors)
    select new_id, l.team_id, l.total, l.investors from public.live_totals() l;
  return new_id;
end
$$;

create function public.delete_latest_tick()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_staff();
  delete from public.ticks
    where id = (select id from public.ticks order by id desc limit 1);
end
$$;

-- Only signed-in users call RPCs; staff-only ones check is_staff() inside.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.get_settings(), public.confirm_investments(jsonb), public.check_in(text),
  public.get_attendance_code(), public.set_attendance_code(text), public.random_attendance_code(),
  public.set_default_budget(int), public.set_budgets(uuid[], int), public.set_checked_in(uuid[], boolean),
  public.add_participant(text, public.school, uuid),
  public.live_totals(), public.publish_tick(), public.delete_latest_tick()
  to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
