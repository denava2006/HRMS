-- "Other" carried 0 default credits, so it showed up on every employee's
-- balance list as a permanently empty "0 remaining" card — noise on a screen
-- whose whole job is showing what you can actually take. Every real category
-- is already covered by the named types.
--
-- Balances are deleted first (they're derived), but any leave request that
-- happens to reference it is left alone and the type is only removed when
-- nothing points at it — history should not disappear.
delete from public.leave_balances
where leave_type_id in (select id from public.leave_types where name = 'Other');

delete from public.leave_types
where name = 'Other'
  and not exists (
    select 1 from public.leave_requests
    where leave_type_id = public.leave_types.id
  );
