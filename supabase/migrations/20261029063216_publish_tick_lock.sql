-- publish_tick(), safe against double publishing:
--  * a transaction-scoped advisory lock serializes concurrent calls (two staff,
--    two tabs, a double click that slipped through), so they run one by one
--  * inside the lock, a tick whose totals equal the latest tick's is refused
--    (hint 'unchanged'), so the second of two concurrent calls fails instead
--    of adding a duplicate
create or replace function public.publish_tick()
returns public.invest_ticks
language plpgsql
security definer
set search_path = ''
as $$
declare
  tick    public.invest_ticks;
  last_id bigint;
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.publish_tick'));

  select max(t.id) into last_id from public.invest_ticks t;

  if last_id is not null and not exists (
    select 1
    from (
      select t.id as team_id, coalesce(sum(i.amount), 0)::bigint as total
      from public.teams t
      left join public.investments i on i.team_id = t.id
      group by t.id
    ) now_
    full join (
      select x.team_id, x.total from public.invest_tick_totals x where x.tick_id = last_id
    ) prev using (team_id)
    where now_.total is distinct from prev.total
  ) then
    raise exception 'nothing changed since the last tick' using errcode = 'P0001', hint = 'unchanged';
  end if;

  insert into public.invest_ticks (published_by) values (auth.uid()) returning * into tick;

  insert into public.invest_tick_totals (tick_id, team_id, total, investors)
  select tick.id, t.id, coalesce(sum(i.amount), 0), count(i.participant_id)
  from public.teams t
  left join public.investments i on i.team_id = t.id
  group by t.id;

  insert into public.invest_tick_allocations (tick_id, participant_id, team_id, amount)
  select tick.id, i.participant_id, i.team_id, i.amount from public.investments i;

  return tick;
end;
$$;
