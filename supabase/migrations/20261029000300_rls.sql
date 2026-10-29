-- Grants + row level security for the core tables.
-- Supabase grants everything on public tables to anon/authenticated by default; start from nothing.

revoke all on public.staff, public.teams, public.participants, public.participant_private,
  public.investments, public.ticks, public.tick_totals
  from anon, authenticated;

alter table public.staff enable row level security;
alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.participant_private enable row level security;
alter table public.investments enable row level security;
alter table public.ticks enable row level security;
alter table public.tick_totals enable row level security;

-- staff: only staff can see the staff list; managed via SQL / dashboard.
grant select on public.staff to authenticated;
create policy "staff read staff" on public.staff
  for select to authenticated using ((select public.is_staff()));

-- teams: everyone signed in reads; staff manage; members edit their own team
-- (teams_guard keeps table_no staff-only).
grant select, insert, update, delete on public.teams to authenticated;
create policy "read teams" on public.teams
  for select to authenticated using (true);
create policy "staff insert teams" on public.teams
  for insert to authenticated with check ((select public.is_staff()));
create policy "staff or member update teams" on public.teams
  for update to authenticated
  using ((select public.is_staff()) or id = (select public.my_team_id()))
  with check ((select public.is_staff()) or id = (select public.my_team_id()));
create policy "staff delete teams" on public.teams
  for delete to authenticated using ((select public.is_staff()));

-- participants: public directory; only staff write (members can't change membership).
grant select, insert, update, delete on public.participants to authenticated;
create policy "read participants" on public.participants
  for select to authenticated using (true);
create policy "staff insert participants" on public.participants
  for insert to authenticated with check ((select public.is_staff()));
create policy "staff update participants" on public.participants
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete participants" on public.participants
  for delete to authenticated using ((select public.is_staff()));

-- participant_private: self + staff read; staff write. Check-in goes through check_in().
grant select, insert, update, delete on public.participant_private to authenticated;
create policy "self or staff read private" on public.participant_private
  for select to authenticated
  using (participant_id = (select public.current_participant_id()) or (select public.is_staff()));
create policy "staff insert private" on public.participant_private
  for insert to authenticated with check ((select public.is_staff()));
create policy "staff update private" on public.participant_private
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete private" on public.participant_private
  for delete to authenticated using ((select public.is_staff()));

-- investments: read own (staff read all); writes only through confirm_investments().
grant select on public.investments to authenticated;
create policy "self or staff read investments" on public.investments
  for select to authenticated
  using (participant_id = (select public.current_participant_id()) or (select public.is_staff()));

-- ticks: published status is public to signed-in users; written by staff RPCs.
grant select on public.ticks, public.tick_totals to authenticated;
create policy "read ticks" on public.ticks for select to authenticated using (true);
create policy "read tick totals" on public.tick_totals for select to authenticated using (true);
