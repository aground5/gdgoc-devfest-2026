-- Role rules for the core festival tables and RPCs. Uses supabase/seed.sql data.
-- p09 (login PZ2B) = participant in team t03 (no investments yet), p01 (PZ23) = team t01, staff@devfest.test = staff.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000009', 'pz2b@participants.devfest.invalid', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'pz23@participants.devfest.invalid', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-0000000000ff', 'staff@devfest.test', 'authenticated', 'authenticated');

select is((select user_id from public.participant_private where login_id = 'PZ2B'),
  'aaaaaaaa-0000-4000-8000-000000000009'::uuid, 'participant auth user is linked by login id');
select is((select user_id from public.staff where email = 'staff@devfest.test'),
  'aaaaaaaa-0000-4000-8000-0000000000ff'::uuid, 'staff auth user is linked by email');

-- Sign-up hook: whitelisted staff emails and registered participant ids only
select is(public.hook_before_user_created('{"user":{"email":"Staff@devfest.test"}}'), '{}'::jsonb,
  'hook allows a whitelisted staff email (case-insensitive)');
select ok(public.hook_before_user_created('{"user":{"email":"pz32@participants.devfest.invalid"}}') ? 'error',
  'hook rejects self sign-up as a participant (only staff issue those accounts)');
select ok(public.hook_before_user_created('{"user":{"email":"zzzz@participants.devfest.invalid"}}') ? 'error',
  'hook rejects an unknown participant login id');
select ok(public.hook_before_user_created('{"user":{"email":"stranger@example.com"}}') ? 'error',
  'hook rejects an email that is not on the staff list');

/* ---------- anon ---------- */
set local role anon;
select throws_ok('select * from public.teams', '42501', null, 'anon cannot read teams');
select throws_ok('select public.check_in(''1106'')', '42501', null, 'anon cannot call RPCs');
reset role;

/* ---------- participant p09 ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000009","role":"authenticated"}';

select is((select count(*)::int from public.participant_private), 1, 'participant sees only their own private row');
select is((select count(*)::int from public.investments), 0, 'participant sees only their own investments');
select is((select count(*)::int from public.teams), 8, 'participant reads every team');

update public.participants set name = 'hacked' where id = '00000000-0000-4000-8000-000000000201';
update public.teams set name = 'hacked' where id = '00000000-0000-4000-8000-000000000101';
update public.teams set name = 'Green Light 2' where id = '00000000-0000-4000-8000-000000000103';
select is((select name from public.teams where id = '00000000-0000-4000-8000-000000000103'), 'Green Light 2',
  'member can rename their own team');
select throws_ok(
  $$update public.teams set table_no = 'Z-99' where id = '00000000-0000-4000-8000-000000000103'$$,
  '42501', null, 'member cannot change their table');

select throws_like($$select public.confirm_investments('{"00000000-0000-4000-8000-000000000103": 100000}')$$,
  '%own team%', 'cannot invest in own team');
select throws_like($$select public.confirm_investments('{"00000000-0000-4000-8000-000000000101": 1050000}')$$,
  '%over budget%', 'cannot exceed budget');
select throws_like($$select public.confirm_investments('{"00000000-0000-4000-8000-000000000101": 30000}')$$,
  '%multiple%', 'amount must be on the step');
select lives_ok($$select public.confirm_investments(
  '{"00000000-0000-4000-8000-000000000101": 500000, "00000000-0000-4000-8000-000000000102": 500000}')$$,
  'valid allocation is accepted');
select is((select count(*)::int from public.investments), 2, 'allocation stored');
select lives_ok($$select public.confirm_investments('{"00000000-0000-4000-8000-000000000104": 100000}')$$,
  're-confirm replaces the allocation');
select is((select count(*)::int from public.investments), 1, 'old allocation replaced');
select throws_ok($$insert into public.investments values
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000105', 50000)$$,
  '42501', null, 'no direct writes to investments');

select is(public.check_in('0000'), false, 'wrong attendance code is rejected');
select is(public.check_in('1106'), true, 'right attendance code checks in');
select isnt((select checked_in_at from public.participant_private), null, 'checked_in_at is set');
select throws_ok('select public.get_attendance_code()', '42501', null, 'participant cannot read the code');
select throws_ok('select * from private.settings', '42501', null, 'private schema is not readable');
select throws_ok('select * from public.live_totals()', '42501', null, 'participant cannot see live totals');
select throws_ok('select public.publish_tick()', '42501', null, 'participant cannot publish ticks');
reset role;

select is((select name from public.participants where id = '00000000-0000-4000-8000-000000000201'), '김민준',
  'participant could not edit another participant');
select is((select name from public.teams where id = '00000000-0000-4000-8000-000000000101'), 'Vision Makers',
  'participant could not edit another team');

/* ---------- check-in rate limit ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select public.check_in('0000') from generate_series(1, 5);
select throws_like('select public.check_in(''1106'')', '%too many attempts%', '6th try after 5 failures is blocked');
reset role;

/* ---------- staff ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ff","role":"authenticated"}';
select is((select count(*)::int from public.participant_private), 28, 'staff reads every private row');
select is(public.get_attendance_code(), '1106', 'staff reads the attendance code');
select lives_ok($$update public.teams set table_no = 'Z-01' where id = '00000000-0000-4000-8000-000000000103'$$,
  'staff can change tables');
select lives_ok('select public.publish_tick()', 'staff publishes a tick');
select is(
  (select sum(total)::bigint from public.tick_totals where tick_id = (select max(id) from public.ticks)),
  (select sum(amount)::bigint from public.investments),
  'published totals equal the sum of investments');
select throws_like('select public.publish_tick()', '%nothing changed%', 'unchanged totals are not republished');
select lives_ok('select public.delete_latest_tick()', 'staff deletes the latest tick');
select is((select count(*)::int from public.ticks), 4, 'only the newest tick was removed');
reset role;

select * from finish();
rollback;
