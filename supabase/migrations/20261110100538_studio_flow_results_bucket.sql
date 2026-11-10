-- Private per-user storage for files downloaded from the visible Google Flow UI.
-- The server API verifies the authenticated owner before writing/reading objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-flow-results',
  'studio-flow-results',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "studio_flow_results_owner_select" on storage.objects;
create policy "studio_flow_results_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'studio-flow-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "studio_flow_results_owner_insert" on storage.objects;
create policy "studio_flow_results_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'studio-flow-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "studio_flow_results_owner_update" on storage.objects;
create policy "studio_flow_results_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'studio-flow-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'studio-flow-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "studio_flow_results_owner_delete" on storage.objects;
create policy "studio_flow_results_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'studio-flow-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
