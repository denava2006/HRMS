drop policy if exists "Admins read all store audit logs" on public.audit_logs;
drop policy if exists "Managers read operational store audit logs" on public.audit_logs;

create policy "Assigned roles read permitted store audit logs"
  on public.audit_logs for select to authenticated
  using (
    (select private.has_active_store_role(
      audit_logs.store_id,
      array['admin']::public.membership_role[]
    ))
    or (
      (select private.has_active_store_role(
        audit_logs.store_id,
        array['manager']::public.membership_role[]
      ))
      and action in (
        'product_created',
        'product_edited',
        'stock_adjusted',
        'product_archived',
        'product_soft_deleted',
        'sale_completed'
      )
    )
  );
