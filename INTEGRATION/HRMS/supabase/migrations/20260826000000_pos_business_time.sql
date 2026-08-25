-- Business time: one definition of "today", owned by the database.
--
-- The database runs in UTC and the browser runs wherever the device says it
-- does. The standalone POS computed its dashboard window with
-- startOfDay(new Date()), so a till configured to UTC and a manager's laptop in
-- Manila disagreed about the day's takings for the first eight hours of it.
--
-- So the client never sends a computed timestamp range for "today". It sends
-- either nothing, or a plain calendar date, and these three functions decide
-- what that means. Phase 7B's reports will use the same three, which is why
-- they live in their own migration rather than inside the dashboard's.

-- A function, not a literal, so there is one place to change and so a later
-- phase can read it from system_settings without touching every call site.
create or replace function public.pos_business_timezone()
returns text
language sql
immutable
set search_path = ''
as $$ select 'Asia/Manila'::text $$;

-- Today, on the business's calendar rather than the server's or the caller's.
create or replace function public.pos_business_date()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone public.pos_business_timezone())::date $$;

-- The half-open window [day_start, day_end) for one business day.
--
-- Half-open, not an inclusive 23:59:59.999 end: a sale landing exactly on
-- midnight belongs to one day, and picking a "last representable instant"
-- invites the fencepost it is meant to avoid. (Phase 6's transaction filters
-- use an inclusive end because they are a user-chosen date range over whole
-- days; nothing joins the two conventions.)
create or replace function public.pos_day_bounds(_on_date date default null)
returns table (business_date date, day_start timestamptz, day_end timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    d,
    (d::timestamp at time zone public.pos_business_timezone()),
    ((d + 1)::timestamp at time zone public.pos_business_timezone())
  from (select coalesce(_on_date, public.pos_business_date())) as g(d);
$$;

-- This database carries an ALTER DEFAULT PRIVILEGES rule (20260716070000) that
-- grants every new routine in public to anon, authenticated and service_role,
-- and PostgreSQL grants PUBLIC EXECUTE besides. Neither revoke is redundant.
revoke all on function public.pos_business_timezone() from public, anon;
revoke all on function public.pos_business_date() from public, anon;
revoke all on function public.pos_day_bounds(date) from public, anon;
grant execute on function public.pos_business_timezone() to authenticated;
grant execute on function public.pos_business_date() to authenticated;
grant execute on function public.pos_day_bounds(date) to authenticated;
