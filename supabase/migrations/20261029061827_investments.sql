-- Mock investment (모의 투자). Each participant splits a virtual budget across
-- other teams and may re-confirm any number of times; the latest confirmation
-- is their current allocation. Staff publish "ticks" (snapshots of team totals);
-- participants only ever see published ticks, never live totals.

-- A logged-in user bound to a participant row (anonymous sessions that never
-- claimed a participant are not participants)
create or replace function public.is_participant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.participants p where p.user_id = auth.uid());
$$;

revoke all on function public.is_participant() from public, anon;
grant execute on function public.is_participant() to authenticated;

/* ---------- Settings ---------- */

create table public.invest_settings (
  id             boolean primary key default true check (id),
  default_budget integer not null default 1000000 check (default_budget >= 0),
  step           integer not null default 50000 check (step > 0),
  open           boolean not null default true,   -- staff close it when investing ends
  updated_at     timestamptz not null default now()
);

insert into public.invest_settings default values;

-- Per-person budget set by staff; null = invest_settings.default_budget
alter table public.participants
  add column invest_budget integer check (invest_budget is null or invest_budget >= 0);

/* ---------- Current allocations ---------- */

create table public.investments (
  participant_id uuid not null references public.participants (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  amount         integer not null check (amount > 0),
  updated_at     timestamptz not null default now(),
  primary key (participant_id, team_id)
);

create index investments_team_id_idx on public.investments (team_id);

-- Every confirmation, newest last: who, when, the whole allocation, and the
-- budget at the time
create table public.investment_confirmations (
  id             bigint generated always as identity primary key,
  participant_id uuid not null references public.participants (id) on delete cascade,
  confirmed_at   timestamptz not null default now(),
  allocation     jsonb not null,   -- { team_id: amount }
  total          integer not null,
  budget         integer not null
);

create index investment_confirmations_participant_idx on public.investment_confirmations (participant_id, confirmed_at);

/* ---------- Published ticks ---------- */

create table public.invest_ticks (
  id           bigint generated always as identity primary key,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null
);

-- What participants see: team totals at the tick
create table public.invest_tick_totals (
  tick_id   bigint not null references public.invest_ticks (id) on delete cascade,
  team_id   uuid not null references public.teams (id) on delete cascade,
  total     bigint not null,
  investors integer not null,
  primary key (tick_id, team_id)
);

-- Staff detail: every participant's allocation at the tick
create table public.invest_tick_allocations (
  tick_id        bigint not null references public.invest_ticks (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  amount         integer not null,
  primary key (tick_id, participant_id, team_id)
);

/* ---------- Functions ---------- */

-- Replace the caller's allocation. p_alloc = { "<team uuid>": amount, ... };
-- zero amounts are dropped. Returns the confirmation row.
create or replace function public.confirm_investments(p_alloc jsonb)
returns public.investment_confirmations
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     public.participants;
  cfg    public.invest_settings;
  v_budget integer;
  v_sum    integer := 0;
  clean  jsonb := '{}'::jsonb;
  k      text;
  v      jsonb;
  tid    uuid;
  amt    integer;
  result public.investment_confirmations;
begin
  select * into me from public.participants p where p.user_id = auth.uid();
  if me.id is null then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select * into cfg from public.invest_settings;
  if not cfg.open then
    raise exception 'investing closed' using errcode = 'P0001', hint = 'closed';
  end if;
  v_budget := coalesce(me.invest_budget, cfg.default_budget);

  if jsonb_typeof(coalesce(p_alloc, '{}'::jsonb)) <> 'object' then
    raise exception 'allocation must be an object' using errcode = '22023';
  end if;

  for k, v in select * from jsonb_each(coalesce(p_alloc, '{}'::jsonb)) loop
    begin
      tid := k::uuid;
      amt := (v #>> '{}')::integer;
    exception when others then
      raise exception 'bad allocation entry' using errcode = '22023';
    end;
    if amt = 0 then
      continue;
    end if;
    if amt < 0 or amt % cfg.step <> 0 then
      raise exception 'amount must be a positive multiple of step' using errcode = '22023', hint = 'step';
    end if;
    if tid = me.team_id then
      raise exception 'cannot invest in own team' using errcode = 'P0001', hint = 'own_team';
    end if;
    if not exists (select 1 from public.teams t where t.id = tid) then
      raise exception 'unknown team' using errcode = '22023';
    end if;
    v_sum := v_sum + amt;
    clean := clean || jsonb_build_object(tid::text, amt);
  end loop;

  if v_sum > v_budget then
    raise exception 'over budget' using errcode = 'P0001', hint = 'over_budget';
  end if;

  delete from public.investments i where i.participant_id = me.id;
  insert into public.investments (participant_id, team_id, amount)
  select me.id, e.key::uuid, (e.value #>> '{}')::integer from jsonb_each(clean) e;

  insert into public.investment_confirmations (participant_id, allocation, total, budget)
  values (me.id, clean, v_sum, v_budget)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.confirm_investments(jsonb) from public, anon;
grant execute on function public.confirm_investments(jsonb) to authenticated;

-- Staff: snapshot the current allocations as a new tick (totals for everyone,
-- per-person detail for staff), all in one transaction
create or replace function public.publish_tick()
returns public.invest_ticks
language plpgsql
security definer
set search_path = ''
as $$
declare
  tick public.invest_ticks;
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
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

revoke all on function public.publish_tick() from public, anon;
grant execute on function public.publish_tick() to authenticated;

-- Moving a participant into a team drops what they had invested in that team
create or replace function public.drop_investment_in_new_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.team_id is not null and new.team_id is distinct from old.team_id then
    delete from public.investments i where i.participant_id = new.id and i.team_id = new.team_id;
  end if;
  return new;
end;
$$;

create trigger participants_team_change_drops_investment
  after update of team_id on public.participants
  for each row execute function public.drop_investment_in_new_team();

/* ---------- Access ---------- */

alter table public.invest_settings enable row level security;
alter table public.investments enable row level security;
alter table public.investment_confirmations enable row level security;
alter table public.invest_ticks enable row level security;
alter table public.invest_tick_totals enable row level security;
alter table public.invest_tick_allocations enable row level security;

revoke all on public.invest_settings, public.investments, public.investment_confirmations,
  public.invest_ticks, public.invest_tick_totals, public.invest_tick_allocations
  from anon, authenticated;

grant select, update on public.invest_settings to authenticated;
grant select on public.investments, public.investment_confirmations, public.invest_tick_totals,
  public.invest_tick_allocations to authenticated;
grant select, delete on public.invest_ticks to authenticated;

-- Settings: participants and staff read, staff change
create policy "participants and staff read invest settings"
  on public.invest_settings for select to authenticated
  using ((select public.is_participant()) or (select public.is_staff()));

create policy "staff update invest settings"
  on public.invest_settings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Allocations and history: your own, or everything for staff (live totals)
create policy "read own or staff investments"
  on public.investments for select to authenticated
  using (
    (select public.is_staff())
    or participant_id = (select p.id from public.participants p where p.user_id = (select auth.uid()))
  );

create policy "read own or staff confirmations"
  on public.investment_confirmations for select to authenticated
  using (
    (select public.is_staff())
    or participant_id = (select p.id from public.participants p where p.user_id = (select auth.uid()))
  );

-- Published ticks are public to participants; deleting one is staff only
create policy "participants and staff read ticks"
  on public.invest_ticks for select to authenticated
  using ((select public.is_participant()) or (select public.is_staff()));

create policy "staff delete ticks"
  on public.invest_ticks for delete to authenticated
  using ((select public.is_staff()));

create policy "participants and staff read tick totals"
  on public.invest_tick_totals for select to authenticated
  using ((select public.is_participant()) or (select public.is_staff()));

-- Per-person detail stays with staff
create policy "staff read tick allocations"
  on public.invest_tick_allocations for select to authenticated
  using ((select public.is_staff()));

alter publication supabase_realtime add table
  public.invest_settings, public.investments, public.invest_ticks, public.invest_tick_totals;
