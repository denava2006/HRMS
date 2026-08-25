create or replace function public.handle_new_employee_leave_balances() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.leave_balances (employee_id, leave_type_id, year, total_credits, used_credits)
  select new.id, lt.id, extract(year from now())::int, lt.default_credits, 0
  from public.leave_types lt
  on conflict (employee_id, leave_type_id, year) do nothing;
  return new;
end;
$$;

create trigger trg_new_employee_leave_balances
  after insert on public.employees
  for each row execute function public.handle_new_employee_leave_balances();
