-- Bug found via inspecting pg_get_expr(polwithcheck, ...) on interviews_insert_owner:
-- the bare `application_id` in the EXISTS subquery's WHERE clause resolved to the
-- subquery's own `existing.application_id` (innermost-FROM-wins name resolution),
-- producing the tautology `existing.application_id = existing.application_id`.
-- That silently defeated the "final interview can only be scheduled by whoever
-- owns the corresponding initial interview" check entirely — anyone who owned
-- ANY initial interview anywhere could insert a final interview for ANY
-- application. Fix: qualify the outer reference with the real table name
-- (interviews), which Postgres resolves unambiguously to the row being
-- inserted, confirmed via empirical testing.
drop policy interviews_insert_owner on public.interviews;

create policy interviews_insert_owner on public.interviews
  for insert
  with check (
    is_active_staff()
    and interviewer_id = (select auth.uid())
    and (
      interview_type = 'initial'::interview_type
      or exists (
        select 1
        from public.interviews existing
        where existing.application_id = interviews.application_id
          and existing.interview_type = 'initial'::interview_type
          and existing.interviewer_id = (select auth.uid())
      )
    )
  );

-- Same auth.uid() scalar-subquery wrapping for the update policy, per Supabase's
-- RLS performance guidance (caches it once per statement instead of per row).
drop policy interviews_update_owner on public.interviews;

create policy interviews_update_owner on public.interviews
  for update
  using (is_active_staff() and interviewer_id = (select auth.uid()))
  with check (is_active_staff() and interviewer_id = (select auth.uid()));

