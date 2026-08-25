-- Supabase's default privileges grant anon/authenticated EXECUTE directly
-- (not merely via inherited PUBLIC), so the PUBLIC-only revoke in the
-- previous migration didn't actually remove anon/authenticated access.
-- Revoking from each role explicitly this time.
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.is_active_staff() from public, anon, authenticated;
revoke execute on function public.prevent_self_role_escalation() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
-- prevent_self_role_escalation: trigger-only, no direct caller needs it.
-- handle_new_user: trigger-only (fires as the table owner via the trigger
-- mechanism itself), no direct caller needs it either.
