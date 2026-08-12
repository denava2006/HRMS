-- This is a trigger function only, never meant to be called directly via
-- PostgREST's exposed /rpc surface (it would just error since it returns
-- `trigger`, but there's no reason to leave it publicly grantable).
revoke execute on function public.protect_admin_accounts() from public, anon, authenticated;
