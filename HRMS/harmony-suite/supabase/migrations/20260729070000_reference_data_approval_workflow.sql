-- Reference-data approval workflow.
--
-- Per the module access rules: HR Staff prepares reference data, HR Manager
-- reviews it, and only approved data is saved as final. Rejected submissions
-- go back to the author to correct and resubmit.
--
--   Departments     staff create/update -> manager approves; delete = manager
--   Positions       staff create/update -> manager approves; delete = manager
--   Work Schedules  staff create/update -> manager approves; delete = manager
--   Salary Grades   staff READ ONLY          manager full direct control
--   Holidays        staff READ ONLY          manager full direct control
--
-- Admin keeps direct unrestricted access throughout — it is the superuser role
-- and is not part of the staff/manager review loop.

create type public.change_request_status as enum ('pending', 'approved', 'rejected');
create type public.change_request_operation as enum ('create', 'update', 'delete');

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  -- Target table name, restricted to the modules that support this workflow.
  target_table text not null check (target_table in ('departments', 'positions', 'work_schedules')),
  operation public.change_request_operation not null,
  -- Null for 'create'; the row being changed otherwise.
  target_id uuid,
  -- The proposed column values. Applied verbatim on approval.
  payload jsonb not null default '{}'::jsonb,
  -- Human-readable summary so the reviewer doesn't have to read raw JSON.
  summary text not null,
  status public.change_request_status not null default 'pending',
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A rejection must say why, so the author knows what to correct.
  constraint change_requests_rejection_has_reason
    check (status <> 'rejected' or rejection_reason is not null),
  constraint change_requests_update_delete_need_target
    check (operation = 'create' or target_id is not null)
);

create index idx_change_requests_status on public.change_requests(status);
create index idx_change_requests_requested_by on public.change_requests(requested_by);

alter table public.change_requests enable row level security;

-- Everyone in HR can see the queue (staff need to see their own submissions and
-- why something was rejected). Only staff/manager/admin — never employees.
create policy change_requests_staff_select on public.change_requests
  for select using (is_active_staff());

-- Anyone in HR can submit a request; they can only submit it as themselves and
-- only in the 'pending' state, so a request can't be self-approved on insert.
create policy change_requests_staff_insert on public.change_requests
  for insert with check (
    is_active_staff()
    and requested_by = (select auth.uid())
    and status = 'pending'
  );

-- Only a manager/admin may move a request out of pending. Deliberately no
-- policy lets the author update their own row — correcting a rejection means
-- submitting a new request, which keeps the audit trail intact.
create policy change_requests_manager_update on public.change_requests
  for update using (is_hr_manager_or_admin()) with check (is_hr_manager_or_admin());

grant all privileges on table public.change_requests to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Direct-write lockdown for the workflow-backed tables.
--
-- The existing *_admin_manage policies (admin-only writes) stay as they are.
-- These add manager-only direct writes; HR Staff gets NO write policy at all,
-- so their only route is a change request. That is the "no user can bypass
-- approval flow" requirement, enforced in the database rather than the UI.
-- ---------------------------------------------------------------------------
create policy departments_manager_manage on public.departments
  for all using (is_hr_manager_or_admin()) with check (is_hr_manager_or_admin());

create policy positions_manager_manage on public.positions
  for all using (is_hr_manager_or_admin()) with check (is_hr_manager_or_admin());

create policy work_schedules_manager_manage on public.work_schedules
  for all using (is_hr_manager_or_admin()) with check (is_hr_manager_or_admin());

-- Salary grades and holidays are manager-controlled outright — staff read only.
create policy salary_grades_manager_manage on public.salary_grades
  for all using (is_hr_manager_or_admin()) with check (is_hr_manager_or_admin());

create policy holidays_manager_manage on public.holidays
  for all using (is_hr_manager_or_admin()) with check (is_hr_manager_or_admin());

-- ---------------------------------------------------------------------------
-- Approval applies the payload. SECURITY DEFINER because the approving manager
-- is allowed to make the change, but doing it through one function keeps the
-- status transition and the write atomic — a request can never be marked
-- approved without its change actually landing.
-- ---------------------------------------------------------------------------
create or replace function public.approve_change_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.change_requests;
  col_list text;
begin
  if not is_hr_manager_or_admin() then
    raise exception 'Only an HR Manager can approve changes.';
  end if;

  select * into r from public.change_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED';
  end if;

  -- A manager approving their own submission would defeat the review, so the
  -- author and the reviewer must be different people.
  if r.requested_by = auth.uid() then
    raise exception 'You cannot approve a change you submitted yourself.';
  end if;

  if r.operation = 'delete' then
    execute format('delete from public.%I where id = $1', r.target_table) using r.target_id;
  else
    -- Only the columns actually present in the payload are written, so
    -- everything else keeps its column default (on create) or its current
    -- value (on update). jsonb_populate_record does the type coercion, which
    -- matters for non-scalar columns like work_schedules.working_days
    -- (smallint[]) that a plain ->> text cast would mangle.
    select string_agg(quote_ident(key), ', ') into col_list
    from jsonb_object_keys(r.payload) as key;

    if col_list is null then
      raise exception 'EMPTY_PAYLOAD';
    end if;

    if r.operation = 'create' then
      execute format(
        'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
        r.target_table, col_list, col_list, r.target_table
      ) using r.payload;
    else
      execute format(
        'update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where id = $2',
        r.target_table, col_list, col_list, r.target_table
      ) using r.payload, r.target_id;
    end if;
  end if;

  update public.change_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_request_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'Change Request Approved', r.target_table, coalesce(r.target_id, p_request_id), r.payload);
end;
$$;

create or replace function public.reject_change_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.change_requests;
begin
  if not is_hr_manager_or_admin() then
    raise exception 'Only an HR Manager can reject changes.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A rejection reason is required.';
  end if;

  select * into r from public.change_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED';
  end if;

  update public.change_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      rejection_reason = trim(p_reason), updated_at = now()
  where id = p_request_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'Change Request Rejected', r.target_table, coalesce(r.target_id, p_request_id),
          jsonb_build_object('reason', trim(p_reason)));
end;
$$;

revoke execute on function public.approve_change_request(uuid) from public, anon;
revoke execute on function public.reject_change_request(uuid, text) from public, anon;
grant execute on function public.approve_change_request(uuid) to authenticated;
grant execute on function public.reject_change_request(uuid, text) to authenticated;
