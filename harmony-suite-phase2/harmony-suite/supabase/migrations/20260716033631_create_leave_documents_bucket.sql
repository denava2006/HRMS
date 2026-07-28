insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leave-documents',
  'leave-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
);

create policy staff_can_upload_leave_document on storage.objects
  for insert
  with check (bucket_id = 'leave-documents' and public.is_active_staff());

create policy staff_can_read_leave_document on storage.objects
  for select
  using (bucket_id = 'leave-documents' and public.is_active_staff());

create policy staff_can_delete_leave_document on storage.objects
  for delete
  using (bucket_id = 'leave-documents' and public.is_active_staff());
