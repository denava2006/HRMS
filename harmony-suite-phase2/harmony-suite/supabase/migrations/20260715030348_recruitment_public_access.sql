-- Public careers page needs to read open postings + their department/position
-- names, with no login. Everything else on these tables stays staff-only.
create policy anon_view_open_postings on job_postings
  for select to anon
  using (status = 'open');

create policy anon_view_departments on departments
  for select to anon
  using (true);

create policy anon_view_positions on positions
  for select to anon
  using (true);

-- Public apply form needs to create an applicant + application record with
-- no login. Insert-only -- anon can never read back, update, or delete any
-- applicant/application, theirs or anyone else's; only staff can (existing
-- Group 2 policy already covers staff).
create policy anon_submit_applicant on applicants
  for insert to anon
  with check (true);

create policy anon_submit_application on applications
  for insert to anon
  with check (true);

-- Resume storage: anyone can upload (the applicant hasn't logged in), but
-- only active staff can ever read one back. 5MB cap, resume-shaped files only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes', 'resumes', false, 5242880,
  array['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy anyone_can_upload_resume on storage.objects
  for insert
  with check (bucket_id = 'resumes');

create policy staff_can_read_resume on storage.objects
  for select
  using (bucket_id = 'resumes' and is_active_staff());
