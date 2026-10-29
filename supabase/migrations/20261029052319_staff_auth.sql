-- Staff (운영진): sign in with Google through Supabase Auth; access is granted
-- only to emails on the whitelist below. Anyone else who signs in with Google
-- gets an auth user but no staff rights.

create table public.staff_emails (
  email      text primary key check (email = lower(btrim(email)) and email like '%@%'),
  note       text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.staff_emails is 'Whitelist of staff Google accounts. Manage from the dashboard / SQL editor.';

-- Not readable by app users at all; only is_staff() looks at it.
alter table public.staff_emails enable row level security;
revoke all on public.staff_emails from anon, authenticated;

-- True when the current user signed in with Google and the email is whitelisted
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
     and exists (
       select 1 from public.staff_emails s
       where s.email = lower(auth.jwt() ->> 'email')
     );
$$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- Staff manage participants and teams. Row access is decided by the policies;
-- participants have no insert/update/delete policies, so they stay read-only.
grant insert, update, delete on public.participants, public.teams to authenticated;

create policy "staff read all participants"
  on public.participants for select to authenticated
  using ((select public.is_staff()));

create policy "staff insert participants"
  on public.participants for insert to authenticated
  with check ((select public.is_staff()));

create policy "staff update participants"
  on public.participants for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff delete participants"
  on public.participants for delete to authenticated
  using ((select public.is_staff()));

create policy "staff insert teams"
  on public.teams for insert to authenticated
  with check ((select public.is_staff()));

create policy "staff update teams"
  on public.teams for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff delete teams"
  on public.teams for delete to authenticated
  using ((select public.is_staff()));

-- Team members edited their team through a column-limited UPDATE grant.
-- Staff now need full UPDATE, so member edits move to an RPC that can only
-- touch name / project / description of the caller's own team.
drop policy "members update own team" on public.teams;

create or replace function public.update_my_team(p_name text, p_project text, p_description text)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid;
  result public.teams;
begin
  select p.team_id into tid from public.participants p where p.user_id = auth.uid();
  if tid is null then
    raise exception 'no team' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'team name required' using errcode = '22023';
  end if;

  update public.teams t
     set name = btrim(p_name),
         project = btrim(coalesce(p_project, '')),
         description = btrim(coalesce(p_description, ''))
   where t.id = tid
  returning * into result;
  return result;
end;
$$;

revoke all on function public.update_my_team(text, text, text) from public, anon;
grant execute on function public.update_my_team(text, text, text) to authenticated;
