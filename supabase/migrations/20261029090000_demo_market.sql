-- Demo Market (데모 마켓): each team publishes its hackathon result so other
-- teams can try it. Only the team's own members write their entry; every
-- participant sees published, non-hidden entries; staff see and moderate all.
-- (Peer reviews are out of scope; a future table would reference demo_entries.id.)

-- The caller's team (null for staff, unbound sessions and unassigned people)
create or replace function public.my_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.team_id from public.participants p where p.user_id = auth.uid();
$$;
revoke all on function public.my_team_id() from public, anon;
grant execute on function public.my_team_id() to authenticated;

create type public.demo_status as enum ('draft', 'published');

create table public.demo_entries (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null unique references public.teams (id) on delete cascade, -- one per team
  status            public.demo_status not null default 'draft',
  title             text not null default '' check (length(title) <= 80),
  description       text not null default '' check (length(description) <= 5000),
  test_instructions text not null default '' check (length(test_instructions) <= 5000),
  live_url          text check (live_url ~* '^https?://\S+$' and length(live_url) <= 500),
  repo_url          text check (repo_url ~* '^https?://\S+$' and length(repo_url) <= 500),
  video_url         text check (video_url ~* '^https?://\S+$' and length(video_url) <= 500),
  hidden            boolean not null default false, -- staff moderation
  hidden_reason     text check (length(hidden_reason) <= 300),
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  -- A link, a description and test instructions are required to publish
  constraint demo_publish_requires_essentials check (
    status = 'draft' or (
      live_url is not null
      and btrim(description) <> ''
      and btrim(test_instructions) <> ''
    )
  )
);

-- Test account info, kept in its own table so no broader read path can leak it
create table public.demo_entry_credentials (
  entry_id    uuid primary key references public.demo_entries (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  credentials text not null check (length(credentials) <= 1000)
);

-- Uploaded screenshots and files. Objects live in Storage at {team_id}/{entry_id}/...
create table public.demo_assets (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.demo_entries (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  kind       text not null check (kind in ('image', 'file')),
  bucket     text not null check (bucket in ('demo-images', 'demo-files')),
  path       text not null unique,
  file_name  text not null check (length(file_name) between 1 and 200),
  mime       text not null,
  size_bytes integer not null check (size_bytes > 0),
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  check ((kind = 'image') = (bucket = 'demo-images')),
  check (split_part(path, '/', 1) = team_id::text and split_part(path, '/', 2) = entry_id::text)
);
create index demo_assets_entry_idx on public.demo_assets (entry_id, sort);

/* ---------- Visibility ---------- */

-- Who may see an entry (and its credentials and assets)
create or replace function public.can_view_demo(p_entry uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.demo_entries e
    where e.id = p_entry
      and (public.is_staff()
           or e.team_id = public.my_team_id()
           or (public.is_participant() and e.status = 'published' and not e.hidden))
  );
$$;

-- Same rule for a storage path "{team_id}/{entry_id}/...", compared as text so bad paths just fail
create or replace function public.can_view_demo_path(p_team text, p_entry text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.demo_entries e
    where e.team_id::text = p_team and e.id::text = p_entry
      and (public.is_staff()
           or e.team_id = public.my_team_id()
           or (public.is_participant() and e.status = 'published' and not e.hidden))
  );
$$;

revoke all on function public.can_view_demo(uuid), public.can_view_demo_path(text, text) from public, anon;
grant execute on function public.can_view_demo(uuid), public.can_view_demo_path(text, text) to authenticated;

/* ---------- Triggers ---------- */

-- Only staff hide entries or move them between teams; stamps updated_* and published_at
create or replace function public.demo_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    if tg_op = 'INSERT' and (new.hidden or new.hidden_reason is not null) then
      raise exception 'only staff can hide entries' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.hidden is distinct from old.hidden
        or new.hidden_reason is distinct from old.hidden_reason
        or new.team_id is distinct from old.team_id) then
      raise exception 'only staff can change this' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger demo_entries_guard
  before insert or update on public.demo_entries
  for each row execute function public.demo_entries_guard();

-- Child rows must belong to the same team as their entry
create or replace function public.demo_child_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.team_id is distinct from (select e.team_id from public.demo_entries e where e.id = new.entry_id) then
    raise exception 'team does not match the entry' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- At most 10 screenshots and 5 files per entry
create or replace function public.demo_assets_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap integer := 5;
begin
  if new.kind = 'image' then
    cap := 10;
  end if;
  if (select count(*) from public.demo_assets a where a.entry_id = new.entry_id and a.kind = new.kind) >= cap then
    raise exception 'too many % uploads', new.kind using errcode = 'P0001', hint = 'too_many_assets';
  end if;
  return new;
end;
$$;

create trigger demo_assets_guard
  before insert or update on public.demo_assets
  for each row execute function public.demo_child_guard();

create trigger demo_assets_limit
  before insert on public.demo_assets
  for each row execute function public.demo_assets_limit();

create trigger demo_entry_credentials_guard
  before insert or update on public.demo_entry_credentials
  for each row execute function public.demo_child_guard();

revoke all on function public.demo_entries_guard(), public.demo_child_guard(), public.demo_assets_limit()
  from public, anon, authenticated;

/* ---------- Access ---------- */

alter table public.demo_entries enable row level security;
alter table public.demo_entry_credentials enable row level security;
alter table public.demo_assets enable row level security;

revoke all on public.demo_entries, public.demo_entry_credentials, public.demo_assets from anon, authenticated;
grant select, insert, update, delete on public.demo_entries, public.demo_entry_credentials, public.demo_assets
  to authenticated;

create policy "read visible demo entries"
  on public.demo_entries for select to authenticated
  using (
    (select public.is_staff())
    or team_id = (select public.my_team_id())
    or ((select public.is_participant()) and status = 'published' and not hidden)
  );
create policy "members insert own demo entry"
  on public.demo_entries for insert to authenticated
  with check (team_id = (select public.my_team_id()));
create policy "members or staff update demo entry"
  on public.demo_entries for update to authenticated
  using ((select public.is_staff()) or team_id = (select public.my_team_id()))
  with check ((select public.is_staff()) or team_id = (select public.my_team_id()));
create policy "members or staff delete demo entry"
  on public.demo_entries for delete to authenticated
  using ((select public.is_staff()) or team_id = (select public.my_team_id()));

create policy "read credentials of visible demo entries"
  on public.demo_entry_credentials for select to authenticated
  using (public.can_view_demo(entry_id));
create policy "members write own demo credentials"
  on public.demo_entry_credentials for all to authenticated
  using (team_id = (select public.my_team_id()))
  with check (team_id = (select public.my_team_id()));

create policy "read assets of visible demo entries"
  on public.demo_assets for select to authenticated
  using (public.can_view_demo(entry_id));
create policy "members write own demo assets"
  on public.demo_assets for all to authenticated
  using (team_id = (select public.my_team_id()))
  with check (team_id = (select public.my_team_id()));
create policy "staff delete demo assets"
  on public.demo_assets for delete to authenticated
  using ((select public.is_staff()));

/* ---------- Storage ---------- */

-- Private buckets; files are served through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('demo-images', 'demo-images', false, 5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('demo-files', 'demo-files', false, 52428800,
    array['application/pdf', 'application/zip', 'application/vnd.android.package-archive',
          'application/octet-stream'])
on conflict (id) do nothing;

create policy "demo read visible"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('demo-images', 'demo-files')
    and public.can_view_demo_path((storage.foldername(name))[1], (storage.foldername(name))[2])
  );
create policy "demo members upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('demo-images', 'demo-files')
    and (storage.foldername(name))[1] = (select public.my_team_id())::text
  );
create policy "demo members update own"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('demo-images', 'demo-files')
    and (storage.foldername(name))[1] = (select public.my_team_id())::text
  );
create policy "demo members or staff delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('demo-images', 'demo-files')
    and ((storage.foldername(name))[1] = (select public.my_team_id())::text or (select public.is_staff()))
  );

alter publication supabase_realtime add table public.demo_entries, public.demo_assets;
