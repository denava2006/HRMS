-- Employment status is an ongoing employee-lifecycle concern that belongs to
-- the future Employee Management module, not Deployment. Deployment only
-- confirms the applicant has joined — it shouldn't own their employment status.
alter table public.deployment_records drop column employment_status;
