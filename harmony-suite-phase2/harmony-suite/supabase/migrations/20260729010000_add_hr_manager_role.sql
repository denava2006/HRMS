-- HR Manager sits between HR Staff and Administrator: it can do everything HR
-- Staff can, plus approve the decisions HR Staff is no longer trusted to make
-- alone (payroll review/release, leave approval -- see the next migration).
--
-- Alone in its own migration on purpose: Postgres cannot use a newly-added enum
-- value in the same transaction that adds it, so the policies/triggers that
-- reference 'hr_manager' have to live in a separate, later migration.
alter type public.user_role add value if not exists 'hr_manager';
