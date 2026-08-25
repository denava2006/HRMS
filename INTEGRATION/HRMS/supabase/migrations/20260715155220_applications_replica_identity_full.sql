-- Supabase Realtime only includes the primary key in the "old" row of an
-- UPDATE payload by default. HR notifications need to tell "status changed
-- to qualified" apart from "status changed to rejected" apart from "notes
-- were edited", which requires the full previous row for comparison.
alter table public.applications replica identity full;

