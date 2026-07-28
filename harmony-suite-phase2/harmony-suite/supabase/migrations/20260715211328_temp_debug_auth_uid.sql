-- Temporary diagnostic function, will be dropped immediately after use.
create or replace function public.debug_whoami()
returns table(uid uuid, role_claim text)
language sql
security invoker
stable
as $$
  select auth.uid(), auth.role();
$$;
grant execute on function public.debug_whoami() to authenticated;
