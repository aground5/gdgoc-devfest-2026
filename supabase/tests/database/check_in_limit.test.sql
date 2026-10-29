-- Attendance code attempts are limited. Run with `supabase test db`.
-- Uses supabase/seed.sql: 김민준 and 한지민; the venue code is set below.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.participants set user_id = null;
delete from public.attendance;
update public.attendance_settings set code = '1106';
insert into auth.users (id, aud, role, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'authenticated', 'authenticated', true);
update public.participants set user_id = 'aaaaaaaa-0000-4000-8000-000000000001' where name = '김민준';
update public.participants set user_id = 'aaaaaaaa-0000-4000-8000-000000000003' where name = '한지민';

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select is(public.check_in('0000'), null, 'a wrong code returns null');
select throws_ok('select * from public.check_in_attempts', '42501', null, 'attempts are not readable by participants');
select public.check_in('0000') from generate_series(1, 4);
select throws_like($$select public.check_in('1106')$$, '%too many%', 'after 5 wrong codes even the right one is refused');
reset role;

-- Other people are not affected
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}';
select isnt(public.check_in(' 1106 '), null, 'another participant still checks in (code trimmed)');
select isnt(public.check_in('1106'), null, 'checking in again the same day still returns the time');
reset role;

-- The limit lifts after 10 minutes
update public.check_in_attempts set at = now() - interval '11 minutes';
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select isnt(public.check_in('1106'), null, 'after 10 minutes the right code works again');
reset role;

-- A closed check-in doesn't count as a wrong try
delete from public.check_in_attempts;
update public.attendance_settings set code = null;
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}';
select public.check_in('1234') from generate_series(1, 6);
reset role;
select is((select count(*)::int from public.check_in_attempts), 0, 'tries while check-in is closed are not counted');

select * from finish();
rollback;
