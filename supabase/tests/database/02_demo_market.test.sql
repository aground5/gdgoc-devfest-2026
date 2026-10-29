-- Demo Market visibility and ownership. Seed: t01 has a published entry, t03 a draft.
-- p09 is in t03, p01 is in t01.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000009', 'pz2b@participants.devfest.invalid', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'pz23@participants.devfest.invalid', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-0000000000ff', 'staff@devfest.test', 'authenticated', 'authenticated');

insert into public.demo_entry_credentials (entry_id, team_id, credentials)
  select id, team_id, 'id: demo / pw: demo' from public.demo_entries
  where team_id = '00000000-0000-4000-8000-000000000101';

/* ---------- anon ---------- */
set local role anon;
select throws_ok('select * from public.demo_entries', '42501', null, 'anon cannot read entries');
select throws_ok('select * from public.demo_entry_credentials', '42501', null, 'anon cannot read credentials');
reset role;

/* ---------- p01 (team t01) ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.demo_entries), 1, 'other teams'' drafts are hidden');
select throws_ok($$insert into public.demo_entries (team_id) values ('00000000-0000-4000-8000-000000000102')$$,
  '42501', null, 'cannot create an entry for another team');
reset role;

/* ---------- p09 (team t03, owns the draft) ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.demo_entries), 2, 'members see their own draft and published entries');
select is((select count(*)::int from public.demo_entry_credentials), 1, 'credentials of a published entry are visible');
select throws_ok(
  $$update public.demo_entries set status = 'published' where team_id = '00000000-0000-4000-8000-000000000103'$$,
  '23514', null, 'cannot publish without link, description and test instructions');
select lives_ok(
  $$update public.demo_entries set status = 'published', live_url = 'https://eco.example.com',
      test_instructions = '앱을 열고 경로를 검색하세요.'
    where team_id = '00000000-0000-4000-8000-000000000103'$$,
  'publishes once the essentials are filled in');
select isnt((select published_at from public.demo_entries where team_id = '00000000-0000-4000-8000-000000000103'),
  null, 'published_at is set on publish');
select throws_ok(
  $$update public.demo_entries set hidden = true where team_id = '00000000-0000-4000-8000-000000000103'$$,
  '42501', null, 'members cannot hide entries');
update public.demo_entries set title = 'hacked' where team_id = '00000000-0000-4000-8000-000000000101';
select is((select title from public.demo_entries where team_id = '00000000-0000-4000-8000-000000000101'), 'SightLine',
  'cannot edit another team''s entry');
select throws_ok(
  $$insert into public.demo_assets (entry_id, team_id, kind, bucket, path, file_name, mime, size_bytes)
    select id, team_id, 'image', 'demo-images', team_id || '/' || id || '/x.png', 'x.png', 'image/png', 10
    from public.demo_entries where team_id = '00000000-0000-4000-8000-000000000101'$$,
  '42501', null, 'cannot attach assets to another team''s entry');
select lives_ok(
  $$insert into public.demo_assets (entry_id, team_id, kind, bucket, path, file_name, mime, size_bytes)
    select id, team_id, 'image', 'demo-images', team_id || '/' || id || '/x.png', 'x.png', 'image/png', 10
    from public.demo_entries where team_id = '00000000-0000-4000-8000-000000000103'$$,
  'can attach assets to own entry');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('demo-images', '00000000-0000-4000-8000-000000000101/x/evil.png')$$,
  '42501', null, 'cannot upload under another team''s folder');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('demo-images', '00000000-0000-4000-8000-000000000103/x/ok.png')$$,
  'can upload under own team''s folder');
reset role;

/* ---------- staff moderation ---------- */
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ff","role":"authenticated"}';
select lives_ok(
  $$update public.demo_entries set hidden = true, hidden_reason = '부적절한 링크'
    where team_id = '00000000-0000-4000-8000-000000000101'$$,
  'staff can hide an entry');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000009","role":"authenticated"}';
select is((select count(*)::int from public.demo_entries where team_id = '00000000-0000-4000-8000-000000000101'), 0,
  'hidden entries disappear for other teams');
select is((select count(*)::int from public.demo_entry_credentials), 0, 'and so do their credentials');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.demo_entries where team_id = '00000000-0000-4000-8000-000000000101'), 1,
  'the team still sees its hidden entry');
reset role;

select * from finish();
rollback;
