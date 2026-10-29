-- Event information shown on the public guide page (/), edited by staff on
-- /organize. One row per section; `value` has the same shape as the matching
-- export in src/data/guide.ts, which stays as the fallback for missing rows.

create table public.site_content (
  key        text primary key check (key in (
               'event', 'notices', 'steps', 'days', 'schedule', 'keywords',
               'investRules', 'criteria', 'awards', 'faqs', 'venueInfo'
             )),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text default lower(auth.jwt() ->> 'email')
);

alter table public.site_content enable row level security;

revoke all on public.site_content from anon, authenticated;
grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;

-- The guide page is public, so anyone (logged in or not) can read it
create policy "anyone reads site content"
  on public.site_content for select to anon, authenticated
  using (true);

create policy "staff add site content"
  on public.site_content for insert to authenticated
  with check ((select public.is_staff()));

create policy "staff update site content"
  on public.site_content for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter publication supabase_realtime add table public.site_content;
