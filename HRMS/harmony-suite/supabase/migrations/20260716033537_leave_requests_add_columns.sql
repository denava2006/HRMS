alter table public.leave_requests
  add column rejection_reason text,
  add column supporting_document_url text;

alter table public.leave_types
  add column is_paid boolean not null default true;

alter table public.leave_balances
  add constraint leave_balances_credits_check check (used_credits <= total_credits);
