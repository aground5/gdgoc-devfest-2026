-- Demo Market: who sees and who may change what. Run with `supabase test db`.
-- Uses supabase/seed.sql: 김민준 is in team A-01, 한지민 in A-03.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Start from a known state even if the local DB was used by hand (all rolled back at the end)
delete from public.demo_entries;
update public.participants set user_id = null;

-- Sessions: two bound participants, one anonymous session that never claimed anyone, and staff
insert into auth.users (id, aud, role, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'authenticated', 'authenticated', true),
  ('aaaaaaaa-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', true);
insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', 'aground5@korea.ac.kr');
update public.participants set user_id = 'aaaaaaaa-0000-4000-8000-000000000001' where name = '김민준';
update public.participants set user_id = 'aaaaaaaa-0000-4000-8000-000000000003' where name = '한지민';

-- A-01 has a published entry with test credentials, A-03 a draft
insert into public.demo_entries (team_id, status, title, description, test_instructions, live_url)
  select id, 'published', 'SightLine', '길 안내', '링크를 여세요', 'https://example.com' from public.teams where table_label = 'A-01';
insert into public.demo_entries (team_id, description) select id, '초안' from public.teams where table_label = 'A-03';
insert into public.demo_entry_credentials (entry_id, team_id, credentials)
  select e.id, e.team_id, 'demo / demo' from public.demo_entries e join public.teams t on t.id = e.team_id where t.table_label = 'A-01';

/* ---------- anon and unbound sessions ---------- */
set local role anon;
select throws_ok('select * from public.demo_entries', '42501', null, 'anon cannot read entries');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-0000000000aa","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.demo_entries), 0, 'an anonymous session not bound to a participant sees nothing');
select is((select count(*)::int from public.demo_entry_credentials), 0, '... and no credentials');
reset role;

/* ---------- 김민준 (A-01) ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.demo_entries), 1, 'other teams'' drafts are hidden');
select throws_ok(
  $$insert into public.demo_entries (team_id) select id from public.teams where table_label = 'A-02'$$,
  '42501', null, 'cannot create an entry for another team');
reset role;

/* ---------- 한지민 (A-03, owns the draft) ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.demo_entries), 2, 'members see their own draft plus published entries');
select is((select count(*)::int from public.demo_entry_credentials), 1, 'credentials of a published entry are visible');
select throws_ok(
  $$update public.demo_entries set status = 'published' where team_id = public.my_team_id()$$,
  '23514', null, 'cannot publish without a link, description and test instructions');
select lives_ok(
  $$update public.demo_entries set status = 'published', live_url = 'https://eco.example.com', test_instructions = '경로를 검색하세요'
    where team_id = public.my_team_id()$$,
  'publishes once the essentials are filled in');
select isnt((select published_at from public.demo_entries where team_id = public.my_team_id()), null,
  'published_at is set on publish');
select throws_ok(
  $$update public.demo_entries set hidden = true where team_id = public.my_team_id()$$,
  '42501', null, 'members cannot hide entries');
update public.demo_entries set title = 'hacked'
  where team_id = (select id from public.teams where table_label = 'A-01');
select throws_ok(
  $$insert into public.demo_assets (entry_id, team_id, kind, bucket, path, file_name, mime, size_bytes)
    select e.id, e.team_id, 'image', 'demo-images', e.team_id || '/' || e.id || '/x.png', 'x.png', 'image/png', 10
    from public.demo_entries e join public.teams t on t.id = e.team_id where t.table_label = 'A-01'$$,
  '42501', null, 'cannot attach files to another team''s entry');
select lives_ok(
  $$insert into public.demo_assets (entry_id, team_id, kind, bucket, path, file_name, mime, size_bytes)
    select e.id, e.team_id, 'image', 'demo-images', e.team_id || '/' || e.id || '/x.png', 'x.png', 'image/png', 10
    from public.demo_entries e where e.team_id = public.my_team_id()$$,
  'can attach files to own entry');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    select 'demo-images', id || '/x/evil.png' from public.teams where table_label = 'A-01'$$,
  '42501', null, 'cannot upload under another team''s folder');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('demo-images', public.my_team_id() || '/x/ok.png')$$,
  'can upload under own team''s folder');
reset role;

select is((select title from public.demo_entries e join public.teams t on t.id = e.team_id where t.table_label = 'A-01'),
  'SightLine', 'a participant could not edit another team''s entry');

/* ---------- staff moderation ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ff","role":"authenticated","email":"aground5@korea.ac.kr","app_metadata":{"provider":"google"}}';
select is((select count(*)::int from public.demo_entries), 2, 'staff see every entry');
select lives_ok(
  $$update public.demo_entries set hidden = true, hidden_reason = '부적절한 링크'
    where team_id = (select id from public.teams where table_label = 'A-01')$$,
  'staff can hide an entry');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.demo_entries e join public.teams t on t.id = e.team_id where t.table_label = 'A-01'), 0,
  'hidden entries disappear for other teams');
select is((select count(*)::int from public.demo_entry_credentials), 0, '... and so do their credentials');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.demo_entries where hidden), 1, 'the team still sees its own hidden entry');
reset role;

select * from finish();
rollback;
