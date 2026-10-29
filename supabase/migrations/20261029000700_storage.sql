-- Demo Market uploads. Both buckets are private; files are served through signed URLs.
-- Object paths: {team_id}/{entry_id}/{uuid}-{name}. Writes only under your own team's prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('demo-images', 'demo-images', false, 5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('demo-files', 'demo-files', false, 52428800,
    array['application/pdf', 'application/zip', 'application/vnd.android.package-archive',
          'application/octet-stream'])
on conflict (id) do nothing;

create policy "demo read visible" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('demo-images', 'demo-files')
    and public.can_view_entry_path((storage.foldername(name))[1], (storage.foldername(name))[2])
  );

create policy "demo members insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('demo-images', 'demo-files')
    and (storage.foldername(name))[1] = (select public.my_team_id())::text
  );

create policy "demo members update own" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('demo-images', 'demo-files')
    and (storage.foldername(name))[1] = (select public.my_team_id())::text
  );

create policy "demo members or staff delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('demo-images', 'demo-files')
    and ((storage.foldername(name))[1] = (select public.my_team_id())::text
         or (select public.is_staff()))
  );
