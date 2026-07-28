-- Nothing was in the supabase_realtime publication yet, so postgres_changes
-- subscriptions would silently receive nothing. Add applications so the
-- Recruitment dashboard can show live "new application" / "status changed"
-- notifications to HR staff who have the page open.
alter publication supabase_realtime add table public.applications;

