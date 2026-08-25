-- =============================================================================
-- Migration 0006: Returned workflow, attachments, and permission rules
--
--   * Returned requests are editable and resubmittable — never dead records.
--   * Employees may cancel a request only before anyone has reviewed it.
--   * Attachments live in a private Storage bucket keyed by request id.
--   * The Administrator handles budget allocation alongside the Finance Manager.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Two more workflow verbs so an edit and a resubmission appear on the request
-- timeline next to the approvals. (Safe inside a transaction on PG12+ as long
-- as the new values are not used until a later statement batch.)
-- -----------------------------------------------------------------------------

alter type approval_action add value if not exists 'edited';
alter type approval_action add value if not exists 'resubmitted';

-- -----------------------------------------------------------------------------
-- Requests: an employee may revise their own request only while it is a draft
-- or has been returned to them. Once it is under review the content is frozen —
-- the single exception is withdrawing it before Finance Staff picks it up.
-- Reviewers keep full update rights, which is how the workflow advances.
-- -----------------------------------------------------------------------------

drop policy if exists requests_update on requests;

create policy requests_update on requests
  for update to authenticated
  using (
    is_reviewer()
    or (requester_id = auth.uid()
        and status in ('draft', 'returned', 'pending_finance_staff'))
  )
  with check (
    is_reviewer()
    or (requester_id = auth.uid()
        and status in ('draft', 'returned', 'pending_finance_staff', 'cancelled'))
  );

-- -----------------------------------------------------------------------------
-- Budget allocation is an Administrator duty as well as a Finance Manager one.
-- -----------------------------------------------------------------------------

drop policy if exists budgets_write on budgets;

create policy budgets_write on budgets
  for all to authenticated
  using (has_role('finance_manager', 'administrator'))
  with check (has_role('finance_manager', 'administrator'));

drop policy if exists allocations_insert on budget_allocations;
drop policy if exists allocations_update on budget_allocations;
drop policy if exists allocations_delete on budget_allocations;

create policy allocations_insert on budget_allocations
  for insert to authenticated
  with check (
    has_role('finance_manager', 'finance_staff', 'administrator')
    and created_by = auth.uid()
  );

create policy allocations_update on budget_allocations
  for update to authenticated
  using (has_role('finance_manager', 'administrator'))
  with check (has_role('finance_manager', 'administrator'));

create policy allocations_delete on budget_allocations
  for delete to authenticated
  using (has_role('finance_manager', 'administrator'));

-- -----------------------------------------------------------------------------
-- Attachments: a private bucket laid out as <request_id>/<filename>, so access
-- can be decided by looking at the parent request.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-attachments',
  'request-attachments',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "request attachments read" on storage.objects;
drop policy if exists "request attachments write" on storage.objects;
drop policy if exists "request attachments delete" on storage.objects;

-- Whoever may see the request may see its files.
create policy "request attachments read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-attachments'
    and exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1]
        and (r.requester_id = auth.uid() or public.is_reviewer())
    )
  );

-- The requester uploads while the request is theirs to edit; reviewers may
-- attach supporting documents at any stage.
create policy "request attachments write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-attachments'
    and exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1]
        and (
          public.is_reviewer()
          or (r.requester_id = auth.uid() and r.status in ('draft', 'returned'))
        )
    )
  );

create policy "request attachments delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'request-attachments'
    and exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1]
        and (
          public.is_admin()
          or (r.requester_id = auth.uid() and r.status in ('draft', 'returned'))
        )
    )
  );
