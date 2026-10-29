-- Access rules for login, teams, attendance, investments, ticks and the staff
-- whitelist, as they work today. Run with `supabase test db` (rolled back).
-- Uses supabase/seed.sql: 김민준 / G9CT38 (A-01), 한지민 / EG8Z5J (A-03).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Known starting state, whatever the local DB was used for
update public.participants set user_id = null, invest_budget = null;
delete from public.attendance;
delete from public.investments;
delete from public.investment_confirmations;
delete from public.invest_ticks;
update public.attendance_settings set code = '1106';
update public.invest_settings set open = true, default_budget = 1000000, step = 50000;

-- Team ids by table label, for building allocations
create temp table t as select table_label as label, id::text as id from public.teams;
grant select on t to authenticated;

insert into auth.users (id, aud, role, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'authenticated', 'authenticated', true),
  ('aaaaaaaa-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', true);
insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', 'aground5@korea.ac.kr');

/* ---------- anon ---------- */
set local role anon;
select throws_ok('select * from public.participants', '42501', null, 'anon cannot read participants');
select throws_ok('select * from public.teams', '42501', null, 'anon cannot read teams');
select throws_ok($$select * from public.claim_participant('김민준', 'G9CT38')$$, '42501', null, 'anon cannot call the login RPC');
reset role;

/* ---------- login (claim_participant) ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.claim_participant('김민준', 'XXXXXX')), 0, 'a wrong code logs in no one');
select is((select count(*)::int from public.claim_participant('홍길동', 'G9CT38')), 0, 'the right code with the wrong name logs in no one');
select is((select name from public.claim_participant(' 김민준 ', 'g9ct38')), '김민준', 'name + code log in (trimmed, case-insensitive code)');
select is(public.is_participant(), true, 'the session is now a participant');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}';
select is((select name from public.claim_participant('한지민', 'EG8Z5J')), '한지민', 'a second participant logs in');
reset role;

/* ---------- a session that never logged in ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-0000000000aa","role":"authenticated","is_anonymous":true}';
select is(public.is_participant(), false, 'a session that never logged in is not a participant');
select is((select count(*)::int from public.participants), 0, 'it reads no participant rows');
select is((select count(*)::int from public.invest_ticks), 0, 'it sees no published ticks');
select is((select count(*)::int from public.invest_settings), 0, 'it sees no investment settings');
reset role;

/* ---------- participant 김민준 (A-01) ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.participants), 1, 'a participant reads only their own row');
select ok((select count(*) from public.participant_directory()) > 1, 'other people come from the directory');
select is(public.is_staff(), false, 'a participant is not staff');

-- Writes
-- Table privileges are shared with staff, so RLS filters these to zero rows instead of raising
select is_empty($$update public.participants set name = 'x' returning 1$$, 'participants cannot write participant rows');
select is_empty($$update public.teams set name = 'x' returning 1$$, 'participants cannot update teams directly');
select is_empty($$delete from public.teams returning 1$$, 'participants cannot delete teams');
select is((select name from public.update_my_team('Vision Makers 2', 'SightLine', '길 안내')), 'Vision Makers 2',
  'members edit their own team through update_my_team');
select throws_ok($$select public.update_my_team('', 'p', 'd')$$, '22023', null, 'a team name is required');

-- Attendance
select is_empty('select * from public.attendance_settings', 'the venue code is not readable by participants');
select is(public.check_in('0000'), null, 'a wrong venue code does not check in');
select isnt(public.check_in('1106'), null, 'the right venue code checks in');
select is((select count(*)::int from public.attendance), 1, 'participants see only their own attendance');

-- Investments
select throws_like($$select public.confirm_investments(jsonb_build_object((select id from t where label = 'A-01'), 50000))$$,
  '%own team%', 'cannot invest in own team');
select throws_like($$select public.confirm_investments(jsonb_build_object((select id from t where label = 'A-02'), 30000))$$,
  '%multiple of step%', 'amounts must be multiples of the step');
select throws_like($$select public.confirm_investments(jsonb_build_object((select id from t where label = 'A-02'), 1050000))$$,
  '%over budget%', 'cannot go over the budget');
select lives_ok($$select public.confirm_investments(jsonb_build_object(
    (select id from t where label = 'A-02'), 500000, (select id from t where label = 'A-03'), 500000))$$,
  'a valid allocation is accepted');
select is((select count(*)::int from public.investments), 2, 'the allocation is stored');
select lives_ok($$select public.confirm_investments(jsonb_build_object((select id from t where label = 'B-01'), 100000))$$,
  're-confirming replaces the allocation');
select is((select count(*)::int from public.investments), 1, 'the old allocation is gone');
select is((select count(*)::int from public.investment_confirmations), 2, 'every confirmation is logged');
select throws_ok($$insert into public.investments (participant_id, team_id, amount)
    select p.id, (select id::uuid from t where label = 'A-02'), 50000 from public.participants p$$,
  '42501', null, 'no direct writes to investments');
select throws_like('select public.publish_tick()', '%staff only%', 'participants cannot publish ticks');
reset role;

-- Closing investing and lowering a budget are enforced on the next confirmation
update public.invest_settings set open = false;
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select throws_like($$select public.confirm_investments('{}'::jsonb)$$, '%closed%', 'no confirmations while investing is closed');
reset role;
update public.invest_settings set open = true;
update public.participants set invest_budget = 50000 where name = '김민준';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select throws_like($$select public.confirm_investments(jsonb_build_object((select id from t where label = 'B-01'), 100000))$$,
  '%over budget%', 'after staff lower the budget, the same allocation is refused');
reset role;
update public.participants set invest_budget = null where name = '김민준';

/* ---------- participant 한지민 (A-03) ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.investments), 0, 'participants never see others'' investments');
select is((select count(*)::int from public.investment_confirmations), 0, '... or their confirmation history');
reset role;

/* ---------- staff ---------- */
-- Whitelisted email but not signed in with Google: not staff
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ff","role":"authenticated","email":"aground5@korea.ac.kr","app_metadata":{"provider":"email"}}';
select is(public.is_staff(), false, 'a whitelisted email without Google sign-in is not staff');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ff","role":"authenticated","email":"aground5@korea.ac.kr","app_metadata":{"provider":"google"}}';
select is(public.is_staff(), true, 'Google sign-in with a whitelisted email is staff');
select is((select count(*)::int from public.participants), (select count(*)::int from public.participant_directory()),
  'staff read every participant');
select is((select code from public.attendance_settings), '1106', 'staff read the venue code');
select lives_ok('select public.publish_tick()', 'staff publish a tick');
select is(
  (select sum(total)::bigint from public.invest_tick_totals where tick_id = (select max(id) from public.invest_ticks)),
  (select sum(amount)::bigint from public.investments),
  'published totals equal the current investments');
select ok((select count(*) from public.invest_tick_allocations) > 0, 'staff see per-person allocations at the tick');
select throws_like('select public.publish_tick()', '%nothing changed%', 'an unchanged tick is refused');

-- Moving someone into a team drops what they had invested in it
update public.participants set team_id = (select id::uuid from t where label = 'B-01') where name = '김민준';
select is((select count(*)::int from public.investments i join public.participants p on p.id = i.participant_id where p.name = '김민준'),
  0, 'moving into a team drops the investment in that team');

-- Whitelist: others can be added and removed, but not yourself
select lives_ok($$insert into public.staff_emails (email, note) values ('helper@example.com', '도우미')$$, 'staff add to the whitelist');
select lives_ok($$delete from public.staff_emails where email = 'helper@example.com'$$, 'staff remove others');
delete from public.staff_emails where email = 'aground5@korea.ac.kr';
select is((select count(*)::int from public.staff_emails where email = 'aground5@korea.ac.kr'), 1, 'staff cannot remove themselves');
reset role;

/* ---------- participant ticks after publishing ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.invest_ticks), 1, 'participants see published ticks');
select is((select count(*)::int from public.invest_tick_allocations), 0, 'but not per-person allocations');
select throws_ok($$select public.bulk_import('[]'::jsonb, '[]'::jsonb)$$, '42501', null, 'participants cannot bulk import');
reset role;

select * from finish();
rollback;
