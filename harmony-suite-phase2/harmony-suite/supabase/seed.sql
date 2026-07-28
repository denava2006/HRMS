-- Local/demo seed data. Runs automatically on `supabase db reset` (and once
-- after the very first `supabase start`) — never against the remote project.
--
-- Gives a fresh checkout a working login and enough reference data to explore
-- the app immediately, without pre-filling employees/attendance/payroll —
-- those are much better shown live during a demo than faked in advance.

-- ---- Admin login (admin@suite.com / Admin123) ----
-- handle_new_user() auto-creates a matching `profiles` row for every new
-- auth.users insert (defaulting role/status), so this seeds the auth user
-- first and then promotes that row to an active admin.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin@suite.com',
  crypt('Admin123', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Administrator"}',
  now(), now(),
  '', '', '', ''
);

-- trg_protect_admin_accounts deliberately blocks ever promoting a row to
-- role='admin' via UPDATE (privilege-escalation guard) -- there is no
-- legitimate app-level path to create the very first admin, so bootstrapping
-- one here means briefly stepping around that guard on purpose.
alter table public.profiles disable trigger trg_protect_admin_accounts;
update public.profiles
set full_name = 'Administrator', role = 'admin', status = 'active'
where id = 'a0000000-0000-0000-0000-000000000001';
alter table public.profiles enable trigger trg_protect_admin_accounts;

-- ---- Reference data: departments, positions, salary grades ----
insert into public.departments (id, name, description) values
  ('d0000000-0000-0000-0000-000000000001', 'Human Resources', 'People operations, recruitment, and employee relations'),
  ('d0000000-0000-0000-0000-000000000002', 'Sales', 'Customer-facing sales and account management'),
  ('d0000000-0000-0000-0000-000000000003', 'IT', 'Engineering and technical support'),
  ('d0000000-0000-0000-0000-000000000004', 'Maintenance', 'Facilities and equipment maintenance')
on conflict (id) do nothing;

insert into public.positions (id, title, department_id, description) values
  ('e0000000-0000-0000-0000-000000000001', 'HR Staff', 'd0000000-0000-0000-0000-000000000001', 'Handles recruitment, onboarding, and employee records'),
  ('e0000000-0000-0000-0000-000000000002', 'Sales Associate', 'd0000000-0000-0000-0000-000000000002', 'Front-line sales representative'),
  ('e0000000-0000-0000-0000-000000000003', 'Cashier', 'd0000000-0000-0000-0000-000000000002', 'Point-of-sale and transaction handling'),
  ('e0000000-0000-0000-0000-000000000004', 'IT Support', 'd0000000-0000-0000-0000-000000000003', 'Technical support and systems maintenance'),
  ('e0000000-0000-0000-0000-000000000005', 'Cleaner', 'd0000000-0000-0000-0000-000000000004', 'General facilities upkeep')
on conflict (id) do nothing;

insert into public.salary_grades (id, grade_name, min_salary, max_salary) values
  ('f0000000-0000-0000-0000-000000000001', 'Grade 1', 15000, 20000),
  ('f0000000-0000-0000-0000-000000000002', 'Grade 2', 20000, 28000),
  ('f0000000-0000-0000-0000-000000000003', 'Grade 3', 28000, 40000)
on conflict (id) do nothing;

-- ---- A couple of sample holidays this year, for the Attendance module's holiday checks ----
insert into public.holidays (name, holiday_date, holiday_type) values
  ('New Year''s Day', date_trunc('year', current_date)::date, 'regular'),
  ('Independence Day', (date_trunc('year', current_date) + interval '5 months' + interval '11 days')::date, 'regular')
on conflict do nothing;
