-- Identity helpers used by policies, plus triggers that keep invariants the client can't bypass.
-- Policies call these as (select fn()) so they run once per statement.

create function public.current_participant_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select participant_id from public.participant_private where user_id = auth.uid()
$$;

create function public.my_team_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.team_id
  from public.participants p
  join public.participant_private pp on pp.participant_id = p.id
  where pp.user_id = auth.uid()
$$;

create function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

create function public.is_team_member(t uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select t is not null and t = public.my_team_id()
$$;

revoke execute on function
  public.current_participant_id(), public.my_team_id(), public.is_staff(), public.is_team_member(uuid)
  from public, anon;
grant execute on function
  public.current_participant_id(), public.my_team_id(), public.is_staff(), public.is_team_member(uuid)
  to authenticated;

-- No investing in your own team, and amounts must be on the step. (confirm_investments checks this
-- too; the trigger is the backstop.)
create function private.investments_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  step int;
begin
  if new.team_id = (select team_id from public.participants where id = new.participant_id) then
    raise exception 'cannot invest in own team' using errcode = 'P0001', hint = 'own_team';
  end if;
  select invest_step into step from private.settings;
  if new.amount % coalesce(step, 1) <> 0 then
    raise exception 'amount must be a multiple of %', step using errcode = 'P0001', hint = 'step';
  end if;
  return new;
end
$$;

create trigger investments_guard
  before insert or update on public.investments
  for each row execute function private.investments_guard();

-- Moving someone into a team drops what they had invested in that team.
create function private.participants_team_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.team_id is not null then
    delete from public.investments where participant_id = new.id and team_id = new.team_id;
  end if;
  return new;
end
$$;

create trigger participants_team_change
  after update of team_id on public.participants
  for each row when (new.team_id is distinct from old.team_id)
  execute function private.participants_team_change();

-- Members may edit their team's name/project/description, but only staff set the table.
-- (A trigger rather than column grants: staff are also the "authenticated" role.)
create function private.teams_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- auth.uid() is null for direct SQL (dashboard, seed), which is trusted.
  if auth.uid() is not null and not public.is_staff() and new.table_no is distinct from old.table_no then
    raise exception 'only staff can change the table' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger teams_guard
  before update on public.teams
  for each row execute function private.teams_guard();
