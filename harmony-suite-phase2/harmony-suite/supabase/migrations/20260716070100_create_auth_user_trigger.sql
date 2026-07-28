-- This trigger exists on the remote project but was never part of the
-- tracked migration history (created directly against auth.users early in
-- the project, outside of any apply_migration call) -- without it, no
-- public.profiles row is ever created for a new auth.users signup/invite,
-- silently breaking every login (the app treats "no profile" as "not an
-- active account").
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
