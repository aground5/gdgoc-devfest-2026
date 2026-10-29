-- Access rules for the participant app (roles as in the mockup):
--   anon           nothing; must log in first
--   authenticated  a participant: reads all teams and the public participant
--                  directory (name, school, team), reads its own full row,
--                  edits its own team's name / project / description
--   staff          no app role yet; manage data from the dashboard (service role)

-- 1. Table privileges. RLS filters rows; privileges also limit columns and
--    verbs, so nothing relies on "no policy = no access" alone.
revoke all on public.participants, public.teams from anon, authenticated;

grant select on public.participants to authenticated;      -- rows limited by "participants read own row"
grant select on public.teams to authenticated;
grant update (name, project, description) on public.teams to authenticated;

-- 2. Team members may edit their own team (not table_label, not members)
create policy "members update own team"
  on public.teams for update
  to authenticated
  using (id = (select p.team_id from public.participants p where p.user_id = (select auth.uid())))
  with check (id = (select p.team_id from public.participants p where p.user_id = (select auth.uid())));

-- 3. Public participant directory for team lists: no access codes,
--    attendance or auth links. Only for logged-in participants.
create or replace function public.participant_directory()
returns table (id uuid, name text, school text, team_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.school, p.team_id
  from public.participants p
  where auth.uid() is not null
  order by p.name;
$$;

revoke all on function public.participant_directory() from public, anon;
grant execute on function public.participant_directory() to authenticated;
