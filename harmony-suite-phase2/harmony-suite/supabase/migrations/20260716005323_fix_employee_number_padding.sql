CREATE OR REPLACE FUNCTION public.generate_employee_number() RETURNS text
LANGUAGE plpgsql SET search_path TO 'public' AS $$
declare next_val bigint;
begin
  next_val := nextval('employee_number_seq');
  return 'EMP-' || to_char(current_date, 'YYYY') || '-' || lpad(next_val::text, 4, '0');
end;
$$;
