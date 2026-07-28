insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
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

create policy staff_can_upload_employee_document on storage.objects
  for insert
  with check (bucket_id = 'employee-documents' and public.is_active_staff());

create policy staff_can_read_employee_document on storage.objects
  for select
  using (bucket_id = 'employee-documents' and public.is_active_staff());

create policy staff_can_update_employee_document on storage.objects
  for update
  using (bucket_id = 'employee-documents' and public.is_active_staff())
  with check (bucket_id = 'employee-documents' and public.is_active_staff());

create policy staff_can_delete_employee_document on storage.objects
  for delete
  using (bucket_id = 'employee-documents' and public.is_active_staff());
