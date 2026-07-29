# Harmony Suite — Demo Guide

## Setup (do this before presenting)

```bash
supabase start                 # if it isn't already running
supabase db reset              # clean schema + base seed
docker exec -i supabase_db_harmony-suite psql -U postgres -d postgres < supabase/demo-seed.sql
npm run dev
```

`demo-seed.sql` stages an applicant at **every** stage of the pipeline, three
employees with a month of attendance, a pending leave request, a draft payroll
period, and two pending change requests — so every module has something to show
without clicking through the whole flow first.

To reset mid-demo, re-run the last three commands.

## Accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@suite.com` | `Admin123` |
| HR Manager | `manager@suite.com` | `HrManager123` |
| HR Staff | `staff@suite.com` | `HrStaff123` |
| Employee | `liza.fernandez@example.com` | `Employee123` |
| Employee | `jerome.castillo@example.com` | `Employee123` |

Applicant portal needs no account — reference code + the email applied with.

---

## Suggested walkthrough (~10 minutes)

### 1. Public site → apply (2 min)
- Go to **Careers**, open *Sales Associate*, click **Apply**.
- Fill the form. Point out that name fields **reject digits and symbols as you
  type**, and the phone field only accepts 11 digits starting `09`.
- Submit → the confirmation screen shows a **reference number** (`APP-2026-…`)
  with a copy button.

### 2. Applicant self-service portal (1 min)
- Click **Track My Application** (or nav → *Track Application*).
- Enter the reference number + the email used. Show the live status.
- **Talking point:** the applicant needs *both* the code and their email. Codes
  are sequential, so the email is what stops someone reading a stranger's
  details or accepting their offer.

Pre-staged: **Nina Aquino** already has an offer waiting.
Reference: run `select reference_code from applications where id = 'c3000000-0000-0000-0000-000000000005';`
Email: `nina.aquino@example.com` → she can **Accept** or **Decline** the offer herself.

### 3. HR Staff — the day-to-day work (3 min)
Sign in as **staff@suite.com**.

- **Recruitment** — two new applications waiting. Open one → *Mark as Qualified*
  or *Reject*. Note the actions disappear once an applicant moves on.
- **Interview Management** — *Bea Manalo* has an initial interview scheduled.
  Open *Paolo Del Rosario* to show a completed initial evaluation.
  **Talking point:** when HR Staff passes someone, they must nominate an
  **HR Manager** for the final interview — staff cannot run the final round.
- **Deployment** — *Paolo* is hired and waiting for a job offer. Prepare one:
  working hours/days come from the Admin-configured **work schedule**, not free
  text. *Nina* is at "waiting for applicant response" — HR has **no**
  Accept/Decline buttons any more.
- **Payroll** — click **Generate Payroll**. Then show that HR Staff sees
  *"Waiting for HR Manager approval"* instead of a Review button.

### 4. The role split — your professor's requirement (3 min)
Still as **HR Staff**, open the **Reference Data** section:

- **Salary Grades** → *"View only — managed by HR Managers"*, no buttons.
- **Holidays** → same.
- **Departments** → editable, but the button says **Submit for approval** and a
  badge reads *"Changes need HR Manager approval"*.
- Create a department → it does **not** appear in the list. Open **Approvals** to
  see it sitting as *Pending*.

Now sign in as **manager@suite.com**:

- **Approvals** → two pending requests with a payload preview. **Approve** one →
  it's applied immediately. **Reject** the other → a reason is mandatory, and
  HR Staff can see why.
- **Payroll** → **Review & Approve**, then **Release Payroll**.
- **Leave** → approve Liza's pending request.

**Key talking point:** none of this is UI-only. HR Staff has *no write
permission at all* on those five tables in the database, so even a direct API
call is rejected. You can prove it live:

```bash
# signs in as HR Staff and tries to insert a salary grade directly
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST \
  "http://127.0.0.1:55321/rest/v1/salary_grades" \
  -H "apikey: $ANON" -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade_name":"Bypass","min_salary":1,"max_salary":2}'
# -> HTTP 403
```

### 5. Response times (good answer to "why did this sit for a month?")
Both sides of the conversation have a stated **7-day window**:

- The **apply form** and confirmation screen tell the applicant HR reviews
  every application within 7 days.
- The **tracking portal** counts down while an application is being screened,
  and a pending job offer says *"Please respond within 7 days."*
- In **Deployment**, HR sees how long an applicant has had their offer
  (*"Waiting for the applicant to respond (2 of 7 days)"*). Once it lapses that
  becomes a warning plus a **Close — No Response** action, which closes the
  application and records *why* in the history.

To show the overdue state during the demo, backdate the pending offer:

```sql
update job_offers set created_at = now() - interval '9 days' where status = 'pending';
```

### 6. Employee portal (1 min)
Sign in as **liza.fernandez@example.com**.
- **Attendance** — a month of records, Time In / Time Out.
- **Leave** — her pending request and remaining balance.
- **Payroll** — her released payslip.
- Try `/dashboard/payroll` (the HR one) → redirected away.

---

## Numbers worth pointing at

After generating payroll, the three employees demonstrate the deduction logic:

| Employee | Attendance | Late mins | Late deduction | Result |
|---|---|---|---|---|
| Liza Fernandez | perfect | 0 | ₱0.00 | full salary |
| Jerome Castillo | 3 late days | 90 | ₱272.73 | deduction only for lateness |
| Grace Peralta | late + half day + 1 absence | 125 | ₱213.07 | late + undertime + absence |

Late deduction = `(late minutes ÷ 60) × hourly rate`, where hourly rate =
`(basic salary ÷ 22 working days) ÷ 8 hours`. Nobody on time is ever deducted.

---

## If something goes wrong

- **Blank page / stale data** — hard refresh (Ctrl+Shift+R).
- **Login fails** — check `supabase status`; if containers are down,
  `supabase stop && supabase start`.
- **Want a clean slate** — re-run the reset + demo-seed commands at the top.
