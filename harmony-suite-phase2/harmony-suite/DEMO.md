# Harmony Suite — Demo Guide

## Setup (do this before presenting)

```bash
supabase start        # if it isn't already running
npm run demo:reset    # wipes the DB, replays every migration, loads demo data
npm run dev
```

Everything runs against the **local** Supabase in Docker — nothing touches a
hosted project, so a paused cloud project has no effect. Confirm with:

```bash
supabase status                     # API URL should be http://127.0.0.1:55321
grep VITE_SUPABASE_URL .env         # must match that URL
```

> **`supabase db reset` erases everything**, including anything you typed in by
> hand. Use `npm run demo:seed` (safe to re-run, won't duplicate) if you only
> want to top the demo data back up without wiping your own work.

`demo-seed.sql` stages an applicant at **every** stage of the pipeline, four
employees with a month of attendance (one of them part-time), a pending leave request, a draft payroll
period, and two pending change requests — so every module has something to show
without clicking through the whole flow first.

To reset mid-demo, re-run the last three commands.

## Accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@suite.com` | `Admin123` |
| HR Manager | `manager@suite.com` | `HrManager123` |
| HR Staff | `staff@suite.com` | `HrStaff123` |
| Employee | `liza.fernandez@example.com` | `Employee123` → set your own |
| Employee (part-time) | `pia.reyes@example.com` | no account — HR creates one |
| Employee | `jerome.castillo@example.com` | `Employee123` → set your own |

Employees sign in with the password HR hands them and are then required to
choose their own before they can go anywhere — see §5 below. Pick something you
will remember, or reset it from the employee's Account tab.

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

Also worth showing: whoever is at the **deployed** stage (find them with
`select reference_code, ap.email from applications a join applicants ap on ap.id = a.applicant_id where a.status = 'deployed';`)
went all the way through. Their page carries every copy HR
produced downstream of the offer — the **signed contract** (with a real
download, served through a 2-minute signed URL), **where they're reporting**
(branch, work location, shift, working days), their **employee record**
(number, hire date, salary, employment status), and confirmation that their
**login account** exists and which email it uses.

**Talking point:** the applicant never has to email HR asking "what's my
schedule / did my contract go through / what's my employee number". The files
themselves stay in private buckets — the page holds only paths, and a request
for one is re-checked against the reference code + email before anything is
signed.

### 3. HR Staff — the day-to-day work (3 min)
Sign in as **staff@suite.com**.

- **Notice what's missing from the sidebar:** there is no *Recruitment* entry.
  Screening an applicant is an approval, so it belongs to the HR Manager — and
  the module a role can't act in is hidden rather than shown greyed out. Typing
  `/dashboard/recruitment` in the address bar bounces straight back to the
  dashboard.
- **Job Posting** — this *is* HR Staff's own module. Create and publish a
  posting. (Sign in as the manager later and the entry is gone for them.)
- **Interview Management** — *Bea Manalo* has an initial interview scheduled.
  Open *Paolo Del Rosario* to show a completed initial evaluation.
  **Talking point:** when HR Staff passes someone, they must nominate an
  **HR Manager** for the final interview — staff cannot run the final round.
- **Deployment** — *Paolo* is hired and waiting for a job offer. Prepare one:
  working hours/days come from the Admin-configured **work schedule**, not free
  text, and the **start date can't be today** — the earliest selectable day is
  tomorrow, because an offer still has to be accepted and a contract signed.
  *Nina* is at "waiting for applicant response" — HR has **no** Accept/Decline
  buttons any more.
- **If an applicant declines:** have Nina decline from her tracking page, then
  refresh Deployment. She stays in the queue as **Offer Declined** with a
  **Close Application** button. The application only leaves the pipeline when
  HR closes it — it doesn't silently vanish into Recruitment as "Closed".
- **Payroll** — click **New Payroll Period**, **Generate Payroll**, then
  **Submit for Approval**. Point out there is no approve button here at all:
  submitting is HR Staff saying they've finished checking, not a decision. Sign
  in as the manager and the mirror image is true — no *New Payroll Period*, no
  *Generate Payroll*, no *Adjust Payroll*, because someone who could produce the
  figures would be approving their own work.
- **Notice what's also missing:** Attendance has no *Record Attendance* button
  and Leave has no *Submit Leave Request* button. Employees do both themselves;
  HR reviews and corrects. Salary Grades isn't in the sidebar either — it was a
  read-only page with every button replaced by a "view only" badge.

### 4. The role split — your professor's requirement (3 min)
Still as **HR Staff**, open the **Reference Data** section:

- **Departments** → editable, but the button says **Submit for approval** and a
  badge reads *"Changes need HR Manager approval"*.
- Create a department → it does **not** appear in the list. Open **Approvals** to
  see it sitting as *Pending*.

Now sign in as **manager@suite.com**:

- **The sidebar has swapped:** *Recruitment* is there, *Job Posting* is gone.
  Each role sees only the modules it can actually act in.
- **Recruitment** → two new applications waiting. Open one → **Mark as
  Qualified** or **Reject**. The moment one is qualified it shows up in HR
  Staff's *Interview Management* queue — that's the hand-off.
- **Approvals** → two pending requests with a payload preview. **Approve** one →
  it's applied immediately. **Reject** the other → a reason is mandatory, and
  HR Staff can see why.
- **Payroll** → the period is *Pending Approval*. Open the row menu on **one
  employee** → **Approve**. Do the next one → **Reject**, which demands a
  reason from a list. That row comes back as *Rejected* with the reason printed
  on it, and the whole period is held at Rejected until HR Staff fixes it —
  because that's the state someone has to act on. There is deliberately no
  "approve all": the review step exists so a manager looks at each figure.
  Once every employee is approved, **Release Payslips**.
- **Leave** → approve Liza's pending request. Watch her employment status flip
  to *On Leave* on the Employees page — that isn't typed in, it's derived from
  the approved dates and clears itself when the leave ends.

### 5. Rules worth pointing at (2 min)

- **Attendance windows** — sign in as an employee. Time In only opens two hours
  before their shift, and Time Out runs from the shift end to two hours past it.
  Outside the window the button is disabled and says why, rather than failing
  after the click. HR's *Correct Attendance* is deliberately not bound by
  either — it's how the cases these rules refuse get recorded.
- **Addresses** — the application form asks Province → City → Barangay from a
  list, with only the house/street line typed. City stays locked until a
  province is chosen. That choice carries into the employee record instead of
  being retyped.
- **Salary grades** — try to create a band that overlaps an existing one. The
  form names the grade you clashed with; the database refuses it independently
  with an exclusion constraint.
- **Deleting reference data** — try to delete a department that has employees.
  It says how many are in the way instead of raising a foreign-key error.
- **Employee account** — the Account tab states Employee ID, email, and
  temporary password in one place, with a **Reset Password** button next to them.
- **First login** — sign in as `liza.fernandez@example.com` / `Employee123`.
  You land on *Create Password*, not the dashboard, and typing `/dashboard` in
  the address bar bounces straight back. Set a password and sign in again to go
  through. The Account tab then reads **Activated** and shows "Set by the
  employee" instead of a password HR can read out.

  **Talking point:** the activation stamp is written by a database trigger on
  the actual password change, so it can't be faked. Try it live — an employee
  PATCHing their own `activated_at` gets *"Activation is recorded when you
  change your password, not set directly."*

### 6. Part-time employment (2 min)

Employment Type is a real distinction now, not a label — it decides which
shifts and which pay bands someone can be given.

- **Work Schedules** — the list has a **Schedule Type** column. *Part-Time
  Morning* runs 8:00 AM–12:00 PM with no break: four paid hours, against the
  full-time shifts' eight.
- **Salary Grades** — an **Employment Type** column, with *Grade PT-1* at
  ₱6,000–₱10,000. Try creating a part-time band that overlaps a regular one:
  it's allowed, because the two are never offered to the same person. Overlap
  a band of the *same* type and it's refused.
- **Careers** — every posting shows Regular or Part-Time, in the list, on the
  job details, and on the application form.
- **Deployment** — open a job offer. Employment Type is fixed to whatever the
  posting said, and the Salary Grade and Work Schedule dropdowns only offer
  matching options. There is no way to put a part-time hire on a nine-hour
  shift.
- **Payroll** — the table has a **Type** column. Compare *Pia Reyes*
  (part-time) with the others: her rates come off a four-hour day, so ₱8,000
  monthly gives ₱363.64 a day and ₱90.91 an hour, against Liza's ₱136.36 on an
  eight-hour shift. Thirty minutes late costs Pia ₱45.45 and Liza ₱68.18.

**Talking point:** the pairing rules are enforced in the database, not just in
the dropdowns. A direct API call assigning a part-time schedule to a regular
employee comes back with *"Selected work schedule is not compatible with the
employee's employment type."*

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

The recruitment split holds at the same level — HR Staff can't qualify an
applicant even by calling the API directly:

```bash
curl -s -X PATCH \
  "http://127.0.0.1:55321/rest/v1/applications?reference_code=eq.APP-2026-0001" \
  -H "apikey: $ANON" -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"qualified"}'
# -> {"message":"Only an HR Manager can qualify or reject an application."}
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

- **"Can't reach the server"** on login — Supabase isn't running, or `.env`
  points at the wrong URL. `supabase start`, then check `supabase status`.
- **"That email and password combination doesn't match"** — genuinely wrong
  credentials. Re-check the table above; the demo passwords are case-sensitive.
- **Login fails with everything correct** — the Kong gateway can go stale after
  a `db reset`. `docker restart supabase_kong_harmony-suite`, wait ~10s.
- **Data you entered has vanished** — something ran `supabase db reset`, which
  wipes the database. Use `npm run demo:seed` instead to top up demo data
  without wiping.
- **Blank page / stale data** — hard refresh (Ctrl+Shift+R).
- **Want a clean slate** — `npm run demo:reset`.
