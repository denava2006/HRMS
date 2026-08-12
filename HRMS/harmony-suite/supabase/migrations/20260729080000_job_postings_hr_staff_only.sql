-- Job creation and posting is HR Staff's job. HR Manager still needs to *see*
-- postings (they run final interviews and review offers against them) but must
-- not create, edit, or close one — that is operational work, not review work.
--
-- Mirrors the split already in place elsewhere: the doer role and the approver
-- role each own their own processes rather than sharing them.

create or replace function public.is_hr_staff_or_admin()
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('admin','hr_staff')
  );
$function$;

revoke execute on function public.is_hr_staff_or_admin() from public, anon, authenticated;
grant execute on function public.is_hr_staff_or_admin() to authenticated;

-- Replace the shared all-staff write policy with read-for-all-HR +
-- write-for-HR-Staff-only.
drop policy job_postings_staff_all on public.job_postings;

create policy job_postings_select_staff on public.job_postings
  for select using (is_active_staff());

create policy job_postings_write_staff on public.job_postings
  for insert with check (is_hr_staff_or_admin());

create policy job_postings_update_staff on public.job_postings
  for update using (is_hr_staff_or_admin()) with check (is_hr_staff_or_admin());

create policy job_postings_delete_staff on public.job_postings
  for delete using (is_hr_staff_or_admin());
