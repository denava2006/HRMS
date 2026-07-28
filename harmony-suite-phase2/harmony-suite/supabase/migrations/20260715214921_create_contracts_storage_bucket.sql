insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']);

create policy staff_can_upload_contract on storage.objects
  for insert
  with check (bucket_id = 'contracts' and is_active_staff());

create policy staff_can_read_contract on storage.objects
  for select
  using (bucket_id = 'contracts' and is_active_staff());
