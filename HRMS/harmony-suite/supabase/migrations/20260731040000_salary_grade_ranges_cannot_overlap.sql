-- Salary grades are supposed to be a ladder, not a pile.
--
-- Nothing stopped two grades covering the same money — "Grade 2: 20,000–30,000"
-- next to "Grade 3: 25,000–40,000". A salary of 27,000 then belongs to both,
-- and the range check the job offer form runs against the selected grade
-- silently accepts a figure that another grade also claims.
--
-- Enforced with an exclusion constraint rather than a trigger: overlap is
-- exactly what GiST indexes answer, and a constraint holds under concurrent
-- inserts, which a "select then check then insert" trigger does not.

-- numeric(12,2) tops out at 9,999,999,999.99. The spec's ceiling is
-- 999,999,999,999, which needs two more integer digits.
alter table public.salary_grades
  alter column min_salary type numeric(14,2),
  alter column max_salary type numeric(14,2);

alter table public.salary_grades
  drop constraint if exists salary_grades_range_valid,
  add constraint salary_grades_range_valid check (
    min_salary >= 0
    and max_salary >= min_salary
    and max_salary <= 999999999999
  );

-- Existing ladders were authored with bands meeting at a boundary (…–20000,
-- 20000–…), which claims the same peso twice. Pull each ceiling down by a
-- centavo so the bands are contiguous without overlapping.
update public.salary_grades g
set max_salary = next_min - 0.01
from (
  select id, lead(min_salary) over (order by min_salary) as next_min
  from public.salary_grades
) n
where n.id = g.id and n.next_min is not null and g.max_salary >= n.next_min;

-- '[]' — the bounds are inclusive, so a grade ending at 30,000 and one starting
-- at 30,000 do overlap. That is the intent: a salary of exactly 30,000 must
-- belong to one grade.
alter table public.salary_grades
  drop constraint if exists salary_grades_no_overlap,
  add constraint salary_grades_no_overlap exclude using gist (
    numrange(min_salary, max_salary, '[]') with &&
  );
