# SariSwift Offline POS System

SariSwift is a local point-of-sale (POS) and inventory system for small retail
stores. It runs on a Windows computer and stores its data in a local Supabase
database managed by Docker Desktop.

Internet access is required during the first installation. After the required
software, npm packages, and Docker images have been downloaded, normal POS
operations can run without an internet connection. The application is designed
for local-only use on the same computer or a trusted private network.

## Main features

- Admin, Manager, and Cashier sign-in with store-specific permissions
- Admin-only staff account management
- Audit logs and authenticated-user sales attribution
- Store and product management
- Product buying price, selling price, category, image, and stock tracking
- Store-specific customizable categories with searchable product dropdowns
- Selective category reassignment — move only the products you choose
- POS cart and checkout
- Cash, GCash, Maya, and bank-transfer recording with validated references
- Automatic stock deduction after a completed sale
- Sales and transaction history
- Revenue, cost of goods sold, and profit reports
- Low-stock and out-of-stock indicators
- Product and sales data export (CSV)
- Local database backups
- Local Supabase Studio for database administration

## Technologies used

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui and Radix UI
- TanStack Query
- Supabase (PostgreSQL, Authentication, Storage, Realtime, and Edge Functions)
- Docker Desktop
- WSL 2
- Node.js 20 LTS and npm

## Windows system requirements

Use a supported 64-bit version of Windows 10 or Windows 11 with:

- Administrator access for installing prerequisites
- Hardware virtualization enabled in the BIOS/UEFI
- WSL 2
- Docker Desktop configured to use the WSL 2 backend
- **Node.js 20 LTS** (required)
- A modern browser such as Microsoft Edge, Google Chrome, or Firefox
- Enough free disk space for the project, npm packages, Docker images, and
  database backups
- Internet access for the first installation

> **Node.js requirement:** Use Node.js 20 LTS. Newer, older, or non-LTS releases
> may not behave the same as the tested setup.

## Docker Desktop and WSL 2 setup

1. Open PowerShell as Administrator.
2. Install WSL:

   ```powershell
   wsl --install
   ```

3. Restart Windows when prompted.
4. Finish the Linux distribution setup after restarting.
5. Install Docker Desktop for Windows.
6. Open Docker Desktop and go to **Settings > General**.
7. Enable **Use the WSL 2 based engine**.
8. If needed, go to **Settings > Resources > WSL Integration** and enable the
   installed Linux distribution.
9. Apply the changes and wait until Docker Desktop reports that it is running.

You can confirm that WSL and Docker are available by opening PowerShell and
running:

```powershell
wsl --status
docker version
```

## First-time installation

1. Install **Node.js 20 LTS**, WSL 2, and Docker Desktop as described above.
2. Keep the complete `SariSwift-Offline` folder together.
3. Connect the computer to the internet.
4. Start Docker Desktop and wait until it is ready.
5. Open PowerShell in the project folder and run:

   ```powershell
   npm install
   npx supabase start
   ```

6. On the first run, allow several minutes for npm packages and local Supabase
   Docker images to be installed or downloaded.
7. Create `.env.local` in the project folder. Read the values with
   `npx supabase status -o env` and write them as UTF-8 without BOM:

   ```text
   VITE_SUPABASE_URL=<API_URL>
   VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
   ```

   These values are stable for a local stack, so this is a one-time step.
   `.env.example` shows the same thing.
8. Allow Windows Firewall access if Windows asks about Node.js, Docker, or the
   local development server.
9. Start the website with `npm run dev` and open `http://localhost:8080`.
10. Sign in with the Admin account issued for this installation. Public account
    creation is disabled, and Managers and Cashiers are created by the Admin
    from the **Staff** page inside the app.

Do not manually change environment files unless you are maintaining the project
and understand the local Supabase configuration. Public account creation
remains disabled in the local configuration for safety.

## Starting SariSwift

1. Start Docker Desktop.
2. Wait until Docker Desktop is fully running.
3. Open PowerShell in the project folder and run:

   ```powershell
   npx supabase start
   npm run dev
   ```

4. Keep Docker Desktop and that PowerShell window open while using the system.
5. Open the POS at:

   **http://localhost:8080**

The local database administration page is Supabase Studio:

**http://localhost:54323**

Supabase Studio is intended for administration and troubleshooting. Normal
cashiers and store users should work through the POS website.

## Roles and account creation

SariSwift has exactly three active roles:

- **Admin:** full access to the assigned branch, including Staff, Audit Logs,
  reports, inventory, Additional Fees, Payment QR / QRPh, Branch Details, and
  Export Data.
- **Manager:** operational access to the assigned store, including inventory,
  transactions, reports, profit, and operational audit records.
- **Cashier:** POS and their own transactions only. Cashiers do not receive
  buying prices, product costs, or profit through their database queries.

There is no public registration page. An Admin creates Manager and Cashier
accounts through **Staff Management**. Account creation and password reset run
through local Edge Functions; privileged credentials are never sent to the
browser.

The old database enum still contains the legacy `owner` value because removing
an enum value from an applied PostgreSQL schema is unnecessarily risky. It is
not shown in the UI, assigned to new users, or used for active authorization.

## Accounts

There is one Admin account, created during installation and handed over
separately. Its password is deliberately not recorded in this repository. If it
is lost, use **Forgot password?** on the sign-in page and read the reset link
from the local inbox at `http://localhost:54324`.

Managers and Cashiers are created by the Admin from the **Staff** page. There is
no sign-up page: `[auth] enable_signup = false` closes self-service
registration, and the `create-staff-user` Edge Function accepts only `manager`
and `cashier`, so a second Admin cannot be created from the browser.

> **`[auth.email] enable_signup` must stay `true`.** Despite its name it maps to
> `GOTRUE_EXTERNAL_EMAIL_ENABLED`, which controls whether email/password *login*
> exists at all. Setting it to `false` does not close signup — it locks every
> user out with `422 email_provider_disabled`. Signup is closed by the `[auth]`
> key above it.

The former demo accounts (`admin@sariswift.local`, `manager@…`, `cashier@…`)
have been deactivated. Their Auth users are kept on purpose so the audit trail
still resolves, but their store memberships are `inactive`, so they cannot read
or write any store data.

> **Do not run `npm run demo:seed` on this installation.** It looks the store up
> by the literal name `SariSwift Demo Store`, which no longer exists, so it
> would create a *second* store and reactivate all three demo accounts. It is
> only safe against a fresh, empty database.

## Category management

Admin and Manager accounts can open **Categories** from the navigation. They
can create and edit store-specific categories, change descriptions, colors,
icons, and order, and archive or restore categories. Category names are
trimmed and compared without regard to capitalization, so names such as
`Beverages` and `beverages` cannot be duplicated in one store.

Product Add and Edit forms use a searchable category dropdown. Only active
categories are available for new assignments. If a product already uses an
archived category, its saved category name remains visible until an Admin or
Manager reassigns it.

Every store has one active **General** category. General cannot be renamed,
archived, or permanently deleted. Managers can reassign products but cannot
permanently delete categories. Admins can safely delete a non-General
category; if it is in use, all assigned products must first be moved to an
active replacement in the same atomic operation.

Reprinted receipts always show the person who originally processed the sale.
An Admin or Manager who reprints a Cashier's sale never appears as the cashier;
when the original attribution is missing, the receipt shows `Legacy/Unknown`.

Cashiers can see active category names and filter the POS by category, but
cannot open Category Management or create, edit, archive, reorder, or delete
categories. The Cashier-safe product query still omits buying prices and
profit.

Every store is created with a **General** category that cannot be archived or
deleted, so there is always a valid target when products are reassigned.

### Selective category reassignment

Reassignment moves **only the products you tick**. On the **Categories** page,
press **Reassign** on a category that has products, then:

1. Choose the replacement category.
2. Search the products currently in the source category.
3. Tick individual products, or use **Select All** (which respects the current
   search) and **Clear Selection**.
4. Check the running **selected count** and the destination shown beneath it.
5. Press **Move N products**.

Only the ticked products move. Everything else stays in the source category.
The categories list, product counts, POS, and Inventory refresh automatically —
no page reload or F5 is needed.

The database enforces the same rules independently of the browser:

- an authenticated caller is required;
- the caller must be an **active Admin or Manager of that store** (Cashiers are
  rejected, and so are members of a different store);
- both categories must belong to the store, and the destination must be active;
- **every** selected product must still be in the store and in the source
  category, otherwise the whole move is rejected — nothing is moved silently;
- an empty selection is rejected instead of moving everything;
- the source and destination cannot be the same category;
- the move and its audit entry happen in one transaction.

The older "move every product" function is deliberately kept, because deleting
a category that still has products depends on it.

## Database migrations

Migrations are **forward-only**. An applied migration is never edited; a
correction always arrives as a new file with a later timestamp.

### Applied to the local database

All eleven migrations are applied, through and including:

```text
supabase/migrations/20260801010000_payment_reference_and_audit_clarity.sql
```

**Nothing is pending.** Confirm at any time with:

```powershell
npx supabase migration list --local
```

The two most recent migrations do this:

| Migration | What it does |
|---|---|
| `20260801000000_selective_category_reassignment.sql` | Adds `public.reassign_category_products_subset` — moves only the selected product IDs, with role, store, category and selection checks, an audit entry, `SET search_path = ''`, `REVOKE ... FROM PUBLIC`, and `GRANT EXECUTE` to `authenticated` only. |
| `20260801010000_payment_reference_and_audit_clarity.sql` | Adds server-side payment-reference validation to `public.checkout_sale`; tags stock changes so the audit log distinguishes a sale deduction, a restock and a manual adjustment; re-grants the same least-privilege permissions. |

### Applying a future migration

Migrations are forward-only. When a new one arrives:

1. Close the POS browser tabs.
2. Create a fresh backup (see **Creating backups** below).
3. Copy the `backups` folder to a USB drive.
4. Start the local stack (`npx supabase start`) and, in PowerShell in this folder:

   ```powershell
   npx supabase migration list --local
   npx supabase migration up --local
   ```

5. Regenerate the TypeScript types (see the UTF-8 note below).
6. Restart SariSwift and sign in again.

Do **not** run `npx supabase db reset`. A reset rebuilds the local database and
can erase operational data. Do not delete the `sariswift-offline` Docker
containers or volumes, and do not delete backups.

### Regenerating database types on Windows (UTF-8)

PowerShell's `>` redirection writes UTF-16LE, which corrupts the generated
types file. Always pipe through `Out-File -Encoding utf8`:

```powershell
npx supabase gen types typescript --local |
  Out-File -Encoding utf8 src/integrations/supabase/types.ts
```

## Using the system offline

After the first installation has completed successfully:

1. Start the computer normally. An internet connection is not required.
2. Open Docker Desktop and wait until it is ready.
3. Run `npx supabase start`, then `npm run dev`.
4. Use the POS at `http://localhost:8080`.
5. Keep Docker Desktop and the terminal window open.

The application, authentication service, database, and stored data run on the
same computer. A browser warning that the computer is offline does not prevent
the local URL from working.

Some external browser or operating-system features may still require internet
access. Do not clear Docker data while offline or online, because that can
remove the local database.

## Stopping SariSwift

1. Finish and save the current transaction.
2. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal running `npm run dev`.
3. Run `npx supabase stop` and wait for the local services to stop.
4. Close the PowerShell window if it remains open.
5. Docker Desktop may then be closed.

`npx supabase stop` preserves the database for the next startup. **Never add
`--no-backup`** — that flag deletes the data volumes.

## Creating backups

1. Make sure Docker Desktop and the local SariSwift database are running.
2. In PowerShell in the project folder, run:

   ```powershell
   $stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
   npx supabase db dump --local --data-only --file "backups/sariswift-data-$stamp.sql"
   ```

3. Wait for the success message.
4. Find the SQL backup in the project's `backups` folder. Its filename contains
   the date and time, for example:

   ```text
   sariswift-data-2026-07-31_14-30-00.sql
   ```

5. Regularly copy the entire `backups` folder to a USB drive or another safe
   storage location.

The backup script creates a data-only SQL database backup. Uploaded product
images are stored separately in Docker, so preserving the SariSwift Docker
volumes is also essential.

### Backup reminders

- Back up **before** applying any migration, and before any change you are
  unsure about.
- Back up at the end of each trading day.
- Keep at least one copy off the computer (USB drive or another machine).
- Never delete the `backups` folder or old backup files to save space; move
  them instead.
- `backups` is excluded from Git so a backup is never committed, but it is
  **not** deleted by anything in this project.

## Safe packaging and sharing

When you copy or zip this project to hand it to someone else, exclude:

- `node_modules` and `dist` — reinstalled by `npm install` and rebuilt by `npm run build`;
- `.env.local` — rebuilt from `npx supabase status -o env` on the target computer;
- `supabase/.temp` and `supabase/.branches` — Supabase CLI working state;
- `backups` and any `*.sql` dump — these contain real business data;
- log and temporary files.

`.gitignore` already covers all of these. `supabase/migrations/*.sql` is source
code and must always be included.

Nothing in this project deploys anywhere. There is no hosted Supabase project,
no cloud sync, and no external analytics: `@vercel/analytics`,
`@vercel/speed-insights` and `@lovable.dev/cloud-auth-js` were unused and have
been removed. Local Supabase runs entirely inside Docker on this computer.

## System boundary: POS vs FMS

Supplier management and the restocking *purchase* process belong to the FMS, not
to this POS. This is a deliberate architecture decision, and it constrains what
may be added here.

### POS owns

- Selling products
- Deducting stock on a sale
- Showing current inventory quantity
- Recording every inventory movement
- Controlled manual restock and stock adjustment
- Computing COGS **only at the moment of sale**

### FMS owns

Suppliers · purchase orders · supplier bills and invoices · supplier payments ·
inventory purchase cost · restocking expenses · accounts payable · financial
journal entries.

### Do not build in POS

No supplier records, no purchase orders, no supplier invoices, no accounts
payable, no journal entries. None of these concepts exist in this codebase
today, and that is intentional — a search for `supplier`, `vendor`,
`purchase_order`, `payable` or `journal_entry` returns nothing.

`public.restock_product` is deliberately the *narrowest possible* stand-in: a
quantity, a unit cost, and an optional note. It is not a purchase workflow. When
FMS arrives it becomes the mechanism FMS drives, not a feature to grow.

### Integration points already in place

| Seam | Why it is ready |
|---|---|
| `inventory_movements.reference_type` / `reference_id` | Free-form polymorphic pointer. An FMS-originated receipt writes `reference_type = 'purchase_order'` or `'supplier_bill'` with `reference_id` set to the FMS document, so every unit of stock traces back to the document that bought it. |
| Table grants | `authenticated` holds **SELECT only**; `service_role` holds full write. A server-side FMS integration can post movements directly, and no browser can forge one. |
| `inventory_movements_stock_math` | `stock_after = stock_before + quantity_change` is enforced by the database, so an FMS-written movement cannot be internally inconsistent. |
| `private.guard_product_inventory_write` | `products.stock` cannot be written directly by anyone. Every stock change must go through a sanctioned operation, which keeps the ledger complete no matter who initiates the movement. |
| Costs snapshot at sale | `sale_items.unit_cost_snapshot`, `line_cogs` and `line_gross_profit` are frozen per line at checkout, so later cost corrections in FMS never rewrite historical margin. |

### Rules for the future integration

1. **POS records movements; FMS records money.** A row in
   `inventory_movements` is a quantity-and-cost record, *not* a journal entry.
   POS writes no journal entries and must not start.
2. **Do not double-count.** FMS books the purchase (inventory asset, and the
   payable). POS books COGS when the item sells. If FMS also treated a POS
   restock movement's `total_cost` as an expense, the same money would be
   counted twice.
3. **FMS becomes the source of restocking purchases.** When it does,
   `restock_product` should gain optional `_reference_type` / `_reference_id`
   arguments so an FMS-driven receipt is distinguishable from a manual
   correction. That change is intentionally deferred — it is backward
   compatible and pointless to add before FMS exists. Today every restock
   records `reference_type = 'product'`, so manual restocks are already
   identifiable once a second source appears.
4. **`products.buying_price` is a POS-side weighted average** kept for COGS. If
   FMS becomes the authority on purchase cost, it feeds cost *into* this field
   through a sanctioned operation rather than POS recomputing it independently.
5. **Stock stays authoritative in POS.** FMS should read quantities from here
   rather than keeping a parallel count.

### Known grey area

The Inventory page shows "Capital" and "Potential Profit" per product, and
Reports shows "Stock cost value" — inventory valuation derived from
`buying_price`. That is reporting on cost POS already holds for COGS, not a
purchasing feature, so it stays. If FMS takes over inventory valuation
reporting, these move with it.

## How products, inventory, sales, and profit work

### Products

Each product has a name, category, current stock quantity, buying price, and
selling price. The buying price is the store's cost per unit. The selling price
is the amount charged to the customer per unit.

### Inventory, restocking, and unit cost

The **buying price** is the current cost of one unit of inventory. The
**selling price** is the price charged to the customer.

Adding a product records its initial stock as an opening inventory movement.
Use **Restock** for purchased inventory. Restocking increases stock and uses a
weighted-average unit cost:

```text
New average unit cost =
  ((old stock x old unit cost) + (added stock x purchase unit cost))
  / (old stock + added stock)
```

Use **Adjust Stock** for count corrections, damaged goods, or expired goods.
Every restock, adjustment, and sale records its authenticated user and stock
before/after values in the inventory movement history.

Completing a sale reduces stock by the quantity sold:

```text
Remaining stock = Current stock - Quantity sold
```

The system prevents checkout when the requested quantity is greater than the
available stock. Products with five or fewer units are treated as low stock.

### Sales

For every item in a sale:

```text
Line total = Selling price x Quantity sold
```

The sale revenue is the sum of its line totals, plus any fees recorded by the
checkout flow.

### Inventory capital, COGS, and profit

**Inventory capital** is the current value invested in unsold stock:

```text
Inventory capital = Sum of (current stock x current unit cost)
```

Checkout reads the trusted buying and selling prices from PostgreSQL. Each sale
item permanently stores its unit-cost snapshot, selling-price snapshot, line
revenue, COGS, and gross profit. Changing a product's buying price later does
not rewrite historical sales.

```text
Line COGS = Quantity sold x Unit cost snapshot
Gross sales = Sum of selling price x quantity
Net sales = Gross sales - supported discounts and refunds
Gross profit = Net sales - COGS
Net profit = Gross profit - store-paid deductions
Profit margin = Net profit / Net sales x 100
```

The currently configured transaction fees are added to the customer's bill.
They are customer-paid fees, not store-paid expenses, so they are not
subtracted from profit a second time. Customer change is never revenue.

Capital is not a wallet. When a ₱10 item is sold, its ₱10 cost becomes COGS and
inventory capital falls by ₱10; no cash-wallet balance is manually deducted.

Sales created before the product-cost migration use the best available implied
historical cost (`unit price - previously stored unit profit`) and are marked
`legacy_implied`. New checkouts use `trusted_checkout` snapshots.

Admin and Manager accounts can view buying prices, inventory capital,
movements, COGS, and profit. Cashiers receive only product names, active
categories, selling prices, images, and available stock; their receipt and
transaction RPCs omit cost and profit.

Refunds and voids are not currently implemented. They remain a future feature
and must not be simulated by deleting sales or manually changing stock.

> The product-cost migration `20260730233305_product_cost_capital_profit.sql`
> is applied, along with every other migration. See
> [Database migrations](#database-migrations).

## Payment references

Cash sales never carry a reference and are unaffected by these rules. Every
other method requires one, and the same rules are enforced twice — in the
browser for immediate feedback, and in PostgreSQL so a modified client cannot
bypass them.

| Method | Allowed characters | Length |
|---|---|---|
| GCash | digits only | 6–32 |
| Maya | digits only | 6–32 |
| Bank transfer | letters, numbers, spaces, hyphens | 6–64 |

While typing, the field silently drops characters the method does not allow and
stops at the maximum length. A live counter shows `used/maximum`, and a clear
message explains exactly what is wrong. The reference is trimmed once before
checkout, so leading and trailing spaces never reach the database.

Retrying a failed checkout is safe. The POS reuses the same `checkout_key` while
the cart, method, reference and tendered amount are unchanged, and the database
returns the sale that was already committed instead of charging twice. Changing
anything about the sale starts a new key.

Payment references stored before this validation existed are never re-validated
or rewritten. Only new checkout calls are checked.

## Admin modules

There is no Settings page. Each piece of branch configuration is its own
Admin-only sidebar module, so nothing is buried two levels deep:

| Module | Path | Purpose |
|---|---|---|
| Staff | `/staff` | Create and manage Managers and Cashiers |
| Additional Fees | `/fees` | Fees applied at checkout |
| Payment QR / QRPh | `/payment-qr` | Payment QR, and the future home of PayMongo QRPh |
| Branch Details | `/branch` | Branch name, owner, phone, address |
| Export Data | `/export` | CSV export of products, sales and line items |
| Audit Logs | `/audit-logs` | Who changed what (Managers see an operational subset) |

The old `/settings*` paths all redirect to their new homes, so existing
bookmarks keep working.

Two things were removed with the Settings page:

- **Theme switching.** The app is light-only. Nothing adds the `dark` class and
  Tailwind is configured with `darkMode: ["class"]`, so the operating system's
  dark preference cannot take effect.
- **Demo data loading.** The in-app Load/Clear demo buttons are gone, along with
  the dead code behind them. Loading demo products into a live branch was a
  hazard; products are managed from Inventory.

**Currency is fixed per branch** and is shown read-only on Branch Details. Every
recorded amount is stored in that currency, so switching it would relabel past
sales without converting them.

On a phone the sidebar is hidden, so **sign out lives in the mobile header**
(top right).

## Additional Fees

**Additional Fees** is an Admin-only sidebar module at `/fees`. It used to live
under Settings; the old `/settings/fees` path now redirects there, so existing
bookmarks keep working.

Fees are stored on `stores.fees` and applied automatically at checkout. Each fee
has a name, a type (`percent` or `fixed`), a value, and an enabled switch, and
three presets are offered: VAT 12%, Service Charge 10%, Delivery Fee 50.

The database is the authority. `public.secure_checkout` re-reads the store's fee
list and recomputes every amount server-side, so a modified client cannot invent
a fee or change one, and editing this page never alters what a past sale was
charged — each sale stores the fees applied at the time. `src/lib/fees.ts`
mirrors that arithmetic exactly, including rounding each amount to 2 decimals
before summing; if the two ever drift, the till rejects an exact cash tender as
short. A live preview on the page shows what the configured fees add to a ₱100
sale, computed with the same helper checkout uses.

Disabling a fee is safer than deleting it if it may be needed again.

## Payment QR / QRPh

**Payment QR / QRPh** is an Admin-only sidebar module at `/payment-qr`. It used
to live under Settings; the old `/settings/payment-qr` path now redirects there,
so existing bookmarks keep working.

### Manual payment QR (what works today)

The Admin uploads a static QR image — GCash, Maya, or a bank QR — and it is
shown at checkout when the cashier picks an e-payment method. The cashier then
types the reference the customer reads back.

That reference is **not verified**. Nothing checks it against GCash, Maya or the
bank; it is an operator's note recorded alongside the sale, and these payments
must be reconciled against provider statements. The module says so on screen so
the distinction is not lost.

Uploads are written to `qr/<store_id>/<uuid>.<ext>`. That shape is required, not
cosmetic: the storage policy reads `foldername(name)[2]` and requires it to
parse as the store's UUID, so a flat `qr/<store_id>-<timestamp>.png` name has no
second segment and is refused by RLS. The file extension is sanitised because it
becomes part of the object path. Only an active Admin of the store can upload,
replace or remove the QR — Managers and Cashiers are refused by storage RLS, not
by hiding the button.

### PayMongo QRPh (reserved, not implemented)

The module is the intended home for PayMongo QRPh, which would issue one QRPh
code that GCash, Maya and QRPh-capable bank apps can all scan, with the payment
confirmed by the provider rather than typed by a cashier. The page shows this as
**Not configured**, and no PayMongo API call exists anywhere in the codebase yet.

When it is implemented, these boundaries are not optional:

- The PayMongo **secret key never reaches the browser**. Vite inlines every
  `VITE_*` variable into the shipped bundle, so a secret placed in `.env.local`
  would be public. It belongs in Edge Function secrets
  (`npx supabase secrets set PAYMONGO_SECRET_KEY=...`), read server-side through
  `Deno.env`, exactly as `SUPABASE_SERVICE_ROLE_KEY` already is in
  `supabase/functions/_shared/staff-auth.ts`.
- QRPh payment intents are created by an **Edge Function**, which authenticates
  the caller's active store membership the way `manage-staff-user` already does.
- The browser receives **display-safe data only**: QR image URL, checkout URL,
  payment status, provider reference.
- A sale is marked paid **only after PayMongo confirms it**, by webhook or by a
  server-side status check. A cashier typing a reference must never be enough to
  mark a verified payment as received.
- Verified QRPh payments remain a **distinct payment path** from the manual QR
  above, so reporting can separate confirmed money from asserted money. Reusing
  the existing `gcash` / `maya` / `bank` methods for verified payments would
  erase that distinction.

## Staff password visibility

The **Create Staff** and **Reset Temporary Password** dialogs both use the
shared `PasswordInput` control with an Eye / Eye-Off toggle. Passwords are:

- hidden by default and only revealed while the eye button is held on;
- cleared from the form as soon as the dialog closes or the action succeeds;
- never written to logs, browser storage, URLs, or audit records.

The audit entry records only *that* an Admin reset a password, never the
password itself. The Edge Function performs the Auth password update **first**
and records the audit entry only after that update succeeds, so an audit entry
can never describe a reset that did not happen. GoTrue and PostgreSQL are
separate services and cannot share one transaction; if the audit insert fails
after a successful reset, the Admin is told the password changed but the audit
entry could not be written, rather than being told the reset failed.

## Reading the audit log

Stock movements now read honestly:

| Entry | Meaning |
|---|---|
| **Sale completed** | A checkout finished and the sale was recorded. |
| **Stock deducted by sale** | Stock went down automatically because of that sale. |
| **Stock added by restock** | Purchased inventory was received. |
| **Stock adjusted manually** | A person changed stock by hand (count, damage, expiry). |
| **Restock recorded** / **Manual stock adjustment recorded** | The matching inventory-movement entry with quantities and costs. |

A normal checkout is no longer shown as a manual "Stock adjusted" action.
Entries recorded before the audit-clarity migration keep their original wording;
historical records and inventory movements are never rewritten.

## Troubleshooting

### Startup reports that Node.js is missing

- Install Node.js 20 LTS.
- Restart Windows, or close and reopen terminals after installation.
- In PowerShell, check:

  ```powershell
  node --version
  npm --version
  ```

- The Node.js version should begin with `v20`.

### Docker is not installed, unavailable, or not running

- Open Docker Desktop and wait until it says it is running.
- Confirm that the WSL 2 engine is enabled in Docker Desktop.
- Restart Docker Desktop if it remains stuck.
- Check these commands in PowerShell:

  ```powershell
  wsl --status
  docker info
  ```

### The first startup cannot download packages or images

- Confirm that the computer is connected to the internet.
- Temporarily disable a VPN or proxy if it blocks npm or Docker.
- Run `npx supabase start` again after the connection is stable.

### The POS does not open

- Keep the PowerShell window open and read any displayed error.
- Manually open `http://localhost:8080`.
- Check whether another program is already using port `8080`.
- Run `npx supabase stop`, restart Docker Desktop, and start again.

### Staff Management shows "Staff service is unavailable" (503)

The Edge Functions container is not running. The Supabase CLI is the only part
of the stack that creates its container with **no restart policy**, so a Docker
Desktop restart, a Windows update, or resuming from sleep leaves
`supabase_edge_runtime_*` stopped while all eleven other containers come back on
their own. Kong stays healthy and proxies `/functions/v1/*` to a container that
is no longer there, which is the `503`. No data is affected.

```powershell
docker ps --filter name=edge_runtime   # confirm it is missing or exited
npx supabase start                     # brings it back
```

To stop it recurring on this computer, give the container a restart policy once:

```powershell
docker update --restart unless-stopped supabase_edge_runtime_sariswift-offline
```

`unless-stopped` still respects a deliberate `npx supabase stop`; it only
restores the container after Docker itself restarts.

### Supabase Studio does not open

- Confirm that Docker Desktop is running.
- Confirm that `npx supabase start` completed without errors.
- Open `http://localhost:54323` manually.

### Sign-in works, but data cannot be viewed or saved

Do not apply broad manual grants. The role migration contains explicit
least-privilege grants and Row Level Security. In PowerShell, check:

```powershell
npx supabase migration list --local
```

Confirm that the roles/authentication migrations appear on both sides of the
list. Then sign out, restart SariSwift normally, and sign back in. An inactive
or unassigned user must contact the store Admin.

### A page shows an error box instead of records

That is intentional. A network, permission, or database failure is never shown
as "no sales", "₱0.00", or an empty list, because that would look like a normal
quiet day. Press **Try again**; if it keeps failing, confirm Docker Desktop and
the local Supabase services are running. Technical details are printed to the
browser console in development builds only.

### "A GCash reference must be 6-32 digits" at checkout

The reference does not match the rule for the chosen payment method. See
[Payment references](#payment-references). Switch to the correct method or
re-enter the reference — the field itself blocks characters the method does not
allow.

### "Only N of the M selected products are still in this category"

Someone else moved, archived, or deleted one of the ticked products while the
dialog was open. Nothing was moved. Close the dialog, let the list refresh, and
select again.

### Stock changed while a product edit dialog was open

The dialog warns you and shows the live stock. This is normal — it usually
means a sale went through. Saving the dialog updates the name, category, image,
and prices only; it never writes stock. Use **Restock** or **Adjust Stock** for
stock, which is enforced by a database trigger, not just by the screen.

### Regenerated types look like garbled characters

The types file was written as UTF-16. Regenerate it with
`| Out-File -Encoding utf8` as shown in
[Regenerating database types on Windows](#regenerating-database-types-on-windows-utf-8).

### Data appears to be missing

- Make sure the same project folder and the original SariSwift Docker volumes
  are being used.
- Do not create a second local Supabase project with the same ports.
- Do not reset the database.
- Check Supabase Studio before making any recovery changes.
- Use the newest known-good backup if recovery is necessary.

## Critical data-safety warnings

> **Never run `npx supabase db reset`.** This command rebuilds the local
> database and can erase users, products, inventory, sales, and settings.

> **Do not delete the SariSwift Offline Docker containers or volumes.** Do not
> use Docker Desktop's **Delete**, **Remove volumes**, **Clean / Purge data**, or
> **Factory reset** actions on this project. The local database and uploaded
> images depend on that Docker data.

Use `npx supabase stop` for normal shutdown. Create backups frequently, keep
copies outside the computer, and preserve the Docker volumes.
