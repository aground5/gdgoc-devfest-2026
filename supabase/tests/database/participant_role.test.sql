-- Judges (participants.role = 'judge'): never on a team, set only by staff,
-- carried through bulk_import(). Run with `supabase test db` (rolled back).
-- Uses supabase/seed.sql: 김민준 / G9CT38 (A-01).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.participants set user_id = null;

insert into auth.users (id, aud, role, is_anonymous) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true);
insert into auth.users (id, aud, role, email) values
  ('bbbbbbbb-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', 'aground5@korea.ac.kr');

select is((select count(*)::int from public.participants where role <> 'participant'), 0, 'everyone starts as a participant');

/* ---------- a participant can't change roles ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select is((select name from public.claim_participant('김민준', 'G9CT38')), '김민준', 'participant logs in');
select is((select role from public.participants where name = '김민준'), 'participant', 'a participant reads their own role');
-- authenticated holds the UPDATE grant (for staff); RLS leaves a participant no rows to update
update public.participants set role = 'judge', team_id = null where name = '김민준';
reset role;
select is((select role from public.participants where name = '김민준'), 'participant', 'a participant cannot make themselves a judge');

/* ---------- staff ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-4000-8000-0000000000ff","role":"authenticated","email":"aground5@korea.ac.kr","app_metadata":{"provider":"google"}}';

select throws_ok(
  $$update public.participants set role = 'judge' where name = '김민준'$$,
  'P0001', null, 'a judge cannot keep a team'
);
select lives_ok(
  $$update public.participants set role = 'judge', team_id = null where name = '김민준'$$,
  'staff make someone a judge by taking them off their team'
);
select throws_ok(
  $$update public.participants set team_id = (select id from public.teams where table_label = 'A-01') where name = '김민준'$$,
  'P0001', null, 'a judge cannot be put on a team'
);
select throws_ok(
  $$insert into public.participants (name, school, role) values ('심사', 'ku', 'mentor')$$,
  '23514', null, 'unknown roles are refused'
);
select lives_ok(
  $$insert into public.participants (name, school, role) values ('심사위원A', 'yu', 'judge')$$,
  'staff add a judge'
);

/* ---------- bulk_import ---------- */
-- Without a role, an existing judge stays a judge
select lives_ok(
  $$select public.bulk_import('[]', '[{"name":"심사위원A","school":"yu","table":""}]', false)$$,
  'bulk_import without a role'
);
select is((select role from public.participants where name = '심사위원A'), 'judge', 'an existing judge keeps the role');
select throws_ok(
  $$select public.bulk_import('[]', '[{"name":"심사위원A","school":"yu","table":"A-01"}]', false)$$,
  'P0001', null, 'bulk_import refuses a team for an existing judge'
);
select throws_ok(
  $$select public.bulk_import('[]', '[{"name":"새심사","school":"ku","table":"A-01","role":"judge"}]', false)$$,
  'P0001', null, 'bulk_import refuses a new judge with a team'
);
select throws_ok(
  $$select public.bulk_import('[]', '[{"name":"새심사","school":"ku","table":"","role":"mentor"}]', false)$$,
  'P0001', null, 'bulk_import refuses an unknown role'
);
select lives_ok(
  $$select public.bulk_import('[]', '[{"name":"새심사","school":"ku","table":"","role":"judge"},{"name":"심사위원A","school":"yu","table":"A-01","role":"participant"}]', false)$$,
  'bulk_import adds a judge and turns a judge back into a team member'
);
select is((select role from public.participants where name = '새심사'), 'judge', 'the new person is a judge');
select is(
  (select t.table_label from public.participants p join public.teams t on t.id = p.team_id where p.name = '심사위원A'),
  'A-01', 'the former judge is on the team'
);
select is((select role from public.participants where name = '심사위원A'), 'participant', 'and is a participant again');
reset role;

select * from finish();
rollback;
