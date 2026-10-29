-- Demo Market: each team publishes its hackathon result so other teams can try it.
-- Only the team's own members write; everyone signed in sees published, non-hidden entries.
-- (Peer reviews are out of scope; a future demo_reviews table would reference demo_entries.id.)

create type public.demo_status as enum ('draft', 'published');

create table public.demo_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams on delete cascade, -- one entry per team
  status public.demo_status not null default 'draft',
  title text not null default '' check (length(title) <= 80),
  description text not null default '' check (length(description) <= 5000),
  test_instructions text not null default '' check (length(test_instructions) <= 5000),
  live_url text check (live_url ~* '^https?://\S+$' and length(live_url) <= 500),
  repo_url text check (repo_url ~* '^https?://\S+$' and length(repo_url) <= 500),
  video_url text check (video_url ~* '^https?://\S+$' and length(video_url) <= 500),
  hidden boolean not null default false, -- staff moderation
  hidden_reason text check (length(hidden_reason) <= 300),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null,
  -- Link + description + test instructions are required to publish.
  constraint publish_requires_essentials check (
    status = 'draft' or (
      live_url is not null
      and length(trim(description)) > 0
      and length(trim(test_instructions)) > 0
    )
  )
);
create index demo_entries_visible_idx on public.demo_entries (status) where not hidden;

-- Test account info, kept apart so it can never leak through a broader read path.
create table public.demo_entry_credentials (
  entry_id uuid primary key references public.demo_entries on delete cascade,
  team_id uuid not null references public.teams on delete cascade,
  credentials text not null check (length(credentials) <= 1000)
);

-- Uploaded images and files. Objects live in Storage at {team_id}/{entry_id}/{name}.
create table public.demo_assets (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.demo_entries on delete cascade,
  team_id uuid not null references public.teams on delete cascade,
  kind text not null check (kind in ('image', 'file')),
  bucket text not null check (bucket in ('demo-images', 'demo-files')),
  path text not null unique,
  file_name text not null check (length(file_name) between 1 and 200),
  mime text not null,
  size_bytes int not null check (size_bytes > 0),
  sort int not null default 0,
  caption text not null default '' check (length(caption) <= 200),
  created_at timestamptz not null default now(),
  check ((kind = 'image') = (bucket = 'demo-images')),
  check (split_part(path, '/', 1) = team_id::text and split_part(path, '/', 2) = entry_id::text)
);
create index demo_assets_entry_idx on public.demo_assets (entry_id, sort);

/* ---------- Helpers ---------- */

-- Who may see an entry (and its credentials/assets).
create function public.can_view_entry(p_entry uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.demo_entries e
    where e.id = p_entry
      and (public.is_staff()
           or e.team_id = public.my_team_id()
           or (e.status = 'published' and not e.hidden))
  )
$$;

-- Same rule for a storage path "{team_id}/{entry_id}/...", compared as text so bad paths just fail.
create function public.can_view_entry_path(p_team text, p_entry text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.demo_entries e
    where e.team_id::text = p_team and e.id::text = p_entry
      and (public.is_staff()
           or e.team_id = public.my_team_id()
           or (e.status = 'published' and not e.hidden))
  )
$$;

/* ---------- Triggers ---------- */

create function private.demo_entries_guard()
returns trigger
language plpgsql security definer set search_path = ''
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
end
$$;

create trigger demo_entries_guard
  before insert or update on public.demo_entries
  for each row execute function private.demo_entries_guard();

-- Child rows must point at the same team as their entry.
create function private.demo_child_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.team_id is distinct from (select team_id from public.demo_entries where id = new.entry_id) then
    raise exception 'team does not match the entry' using errcode = '42501';
  end if;
  return new;
end
$$;

-- At most 10 images and 5 files per entry.
create function private.demo_assets_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cap int := 5;
begin
  if new.kind = 'image' then
    cap := 10;
  end if;
  if (select count(*) from public.demo_assets where entry_id = new.entry_id and kind = new.kind) >= cap then
    raise exception 'too many % uploads', new.kind using hint = 'too_many_assets';
  end if;
  return new;
end
$$;

create trigger demo_assets_guard
  before insert or update on public.demo_assets
  for each row execute function private.demo_child_guard();

create trigger demo_assets_limit
  before insert on public.demo_assets
  for each row execute function private.demo_assets_limit();

create trigger demo_entry_credentials_guard
  before insert or update on public.demo_entry_credentials
  for each row execute function private.demo_child_guard();

/* ---------- Grants + RLS ---------- */

revoke all on public.demo_entries, public.demo_entry_credentials, public.demo_assets from anon, authenticated;
grant select, insert, update, delete on public.demo_entries, public.demo_entry_credentials, public.demo_assets
  to authenticated;

alter table public.demo_entries enable row level security;
alter table public.demo_entry_credentials enable row level security;
alter table public.demo_assets enable row level security;

create policy "read visible entries" on public.demo_entries
  for select to authenticated
  using ((select public.is_staff()) or team_id = (select public.my_team_id())
         or (status = 'published' and not hidden));
create policy "members insert own entry" on public.demo_entries
  for insert to authenticated with check (team_id = (select public.my_team_id()));
create policy "members or staff update entry" on public.demo_entries
  for update to authenticated
  using ((select public.is_staff()) or team_id = (select public.my_team_id()))
  with check ((select public.is_staff()) or team_id = (select public.my_team_id()));
create policy "members or staff delete entry" on public.demo_entries
  for delete to authenticated
  using ((select public.is_staff()) or team_id = (select public.my_team_id()));

create policy "read credentials of visible entries" on public.demo_entry_credentials
  for select to authenticated using (public.can_view_entry(entry_id));
create policy "members write own credentials" on public.demo_entry_credentials
  for all to authenticated
  using (team_id = (select public.my_team_id()))
  with check (team_id = (select public.my_team_id()));

create policy "read assets of visible entries" on public.demo_assets
  for select to authenticated using (public.can_view_entry(entry_id));
create policy "members write own assets" on public.demo_assets
  for all to authenticated
  using (team_id = (select public.my_team_id()))
  with check (team_id = (select public.my_team_id()));
create policy "staff delete assets" on public.demo_assets
  for delete to authenticated using ((select public.is_staff()));

revoke execute on function public.can_view_entry(uuid), public.can_view_entry_path(text, text) from public, anon;
grant execute on function public.can_view_entry(uuid), public.can_view_entry_path(text, text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
