-- Who granted POS access is recorded by the database, not claimed by the client.
--
-- 20260813000000 gave pos_branch_assignments a `created_by` column with no
-- default and no trigger. Only an Administrator can insert at all, so this was
-- never an access-control hole -- but it did mean the actor was whatever the
-- browser sent. An Administrator could store another Administrator's id as the
-- grantor, and the audit trail would repeat it faithfully.
--
-- That is the wrong shape for a column whose entire job is to answer "who did
-- this". A value the caller supplies is a claim; a value the database stamps is
-- a record. This makes it a record.
--
-- Forward-only: 20260813000000 is left exactly as it was applied.

create or replace function public.set_pos_assignment_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- auth.uid() is null outside a request context -- the demo seed, a psql
    -- session, a service_role job. Overwriting a deliberately seeded actor with
    -- null there would destroy information rather than protect it, so the stamp
    -- only applies when there is a caller to stamp. Nothing reachable from the
    -- browser has a null auth.uid().
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
    return new;
  end if;

  -- UPDATE: the grantor of an assignment is a historical fact. Revoking sets
  -- status and nothing else should be able to rewrite who granted it.
  new.created_by := old.created_by;
  return new;
end;
$$;

comment on function public.set_pos_assignment_actor() is
  'Stamps pos_branch_assignments.created_by with auth.uid() on insert and freezes it on update, so the recorded actor cannot be supplied or altered by the client.';

-- Runs before the existing trg_set_updated_at only by name ordering, which does
-- not matter here: the two triggers touch different columns.
create trigger trg_set_pos_assignment_actor
  before insert or update on public.pos_branch_assignments
  for each row execute function public.set_pos_assignment_actor();

-- Existing rows are deliberately untouched. Their created_by values were
-- written by the Administrator who actually made the grant; rewriting history
-- to prove a point about history would be self-defeating.
