-- Reference data that something still points at cannot be deleted.
--
-- The foreign keys already refused these deletes, but only by raising
-- "update or delete on table \"departments\" violates foreign key constraint
-- \"employees_department_id_fkey\" on table \"employees\"" — which tells an HR
-- Manager nothing about what to do next, and which arrives *after* the change
-- request has been approved, leaving the request marked approved and the
-- deletion silently not done.
--
-- These triggers fire first and say what is in the way and how many of them
-- there are, so the manager can reassign before trying again.

create or replace function public.block_delete_of_referenced_row()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count bigint;
begin
  if tg_table_name = 'departments' then
    select count(*) into v_count from public.employees where department_id = old.id;
    if v_count > 0 then
      raise exception 'This department still has % employee(s) assigned. Move them to another department first.', v_count;
    end if;
    select count(*) into v_count from public.positions where department_id = old.id;
    if v_count > 0 then
      raise exception 'This department still has % position(s) under it. Remove or move those positions first.', v_count;
    end if;
    select count(*) into v_count from public.job_postings where department_id = old.id;
    if v_count > 0 then
      raise exception 'This department is used by % job posting(s). Close or reassign them first.', v_count;
    end if;

  elsif tg_table_name = 'positions' then
    select count(*) into v_count from public.employees where position_id = old.id;
    if v_count > 0 then
      raise exception 'This position is held by % employee(s). Move them to another position first.', v_count;
    end if;
    select count(*) into v_count from public.job_postings where position_id = old.id;
    if v_count > 0 then
      raise exception 'This position is used by % job posting(s). Close or reassign them first.', v_count;
    end if;

  elsif tg_table_name = 'salary_grades' then
    select count(*) into v_count from public.employees where salary_grade_id = old.id;
    if v_count > 0 then
      raise exception 'This salary grade is assigned to % employee(s). Move them to another grade first.', v_count;
    end if;
    select count(*) into v_count from public.job_offers where salary_grade_id = old.id;
    if v_count > 0 then
      raise exception 'This salary grade is referenced by % job offer(s) and cannot be removed.', v_count;
    end if;

  elsif tg_table_name = 'work_schedules' then
    select count(*) into v_count from public.employees where work_schedule_id = old.id;
    if v_count > 0 then
      raise exception 'This work schedule is assigned to % employee(s). Move them to another shift first.', v_count;
    end if;
    select count(*) into v_count from public.job_offers where work_schedule_id = old.id;
    if v_count > 0 then
      raise exception 'This work schedule is referenced by % job offer(s) and cannot be removed.', v_count;
    end if;
    select count(*) into v_count from public.deployment_records where work_schedule_id = old.id;
    if v_count > 0 then
      raise exception 'This work schedule is recorded on % deployment(s) and cannot be removed.', v_count;
    end if;

    -- Every calculation falls back to the default schedule when an employee has
    -- none, so deleting it leaves attendance and payroll with nothing to measure
    -- against.
    if old.is_default then
      raise exception 'This is the default work schedule. Make another schedule the default before removing it.';
    end if;
  end if;

  return old;
end;
$function$;

drop trigger if exists trg_block_delete_departments on public.departments;
create trigger trg_block_delete_departments
  before delete on public.departments
  for each row execute function public.block_delete_of_referenced_row();

drop trigger if exists trg_block_delete_positions on public.positions;
create trigger trg_block_delete_positions
  before delete on public.positions
  for each row execute function public.block_delete_of_referenced_row();

drop trigger if exists trg_block_delete_salary_grades on public.salary_grades;
create trigger trg_block_delete_salary_grades
  before delete on public.salary_grades
  for each row execute function public.block_delete_of_referenced_row();

drop trigger if exists trg_block_delete_work_schedules on public.work_schedules;
create trigger trg_block_delete_work_schedules
  before delete on public.work_schedules
  for each row execute function public.block_delete_of_referenced_row();
