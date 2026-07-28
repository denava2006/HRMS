create sequence public.payslip_number_seq;

create or replace function public.generate_payslip_number() returns text
language plpgsql set search_path to 'public' as $$
declare next_val bigint;
begin
  next_val := nextval('payslip_number_seq');
  return 'PS-' || to_char(current_date, 'YYYY') || '-' || lpad(next_val::text, 4, '0');
end;
$$;

alter table public.payslips
  add column payslip_number text not null unique default public.generate_payslip_number();
