-- Branches become the POS's operational location.
--
-- The standalone POS scopes everything to a `stores` row: name, address, phone,
-- currency, the additional-fee list, and the payment QR. This system already
-- has that place -- `branches` -- and the POS itself agrees: its store editor
-- lives at /branch and is called BranchDetails. So no `stores` table is created
-- here. What arrives instead is the configuration a branch needs in order to
-- behave as a till, and nothing else.
--
-- Split deliberately in two:
--
--   branches.phone            an enterprise fact. A branch has a phone number
--                             whether or not it ever sells anything; it just
--                             happens to be printed on a receipt.
--
--   branch_pos_settings       POS-only configuration, in its own table rather
--                             than as more columns on `branches`.
--
-- The side table is not squeamishness about width. `branches` is read by every
-- active HR person (branches_staff_select), and fee schedules and payment
-- details have no business being visible to someone who never works a till. A
-- POS Manager, meanwhile, needs to *read* this configuration to run a sale but
-- must not set it. Those are three different audiences and one table cannot
-- carry three policies. `work_locations` already hangs off `branches` for the
-- same reason rather than widening it.
--
-- Not ported from `stores`, on purpose:
--   owner_id     authority here comes from profiles.role and
--                pos_branch_assignments; a branch is not owned by a user.
--   currency     already fixed to PHP by 20260731070000_fixed_currency.sql.
--   owner_name   system_settings.company_name is the enterprise answer to
--                "whose name is on the receipt".

alter table public.branches
  add column phone text,
  add constraint branches_phone_length check (phone is null or char_length(btrim(phone)) between 1 and 40);

-- ---------------------------------------------------------------- fee shape
--
-- Fees stay JSONB rather than being normalised now. The standalone POS's
-- checkout iterates jsonb_array_elements over exactly this shape, and the
-- applied result is snapshotted onto the sale as jsonb because it is a
-- historical record of what was charged, not a live reference. Normalising the
-- configuration while the checkout that consumes it has not been ported yet
-- would mean rewriting that arithmetic against a schema nothing has exercised.
--
-- JSONB with no validation, though, is a text column with extra steps. This
-- function is what makes the column a contract: the same rules the POS's
-- checkout applies (enabled, positive value, known type) plus the bounds its
-- UI assumed but never enforced.
--
-- plpgsql rather than a SQL expression because the checks have to run in order.
-- A single boolean expression would let Postgres evaluate `(value)::numeric`
-- before the branch that establishes `value` is a number, and a malformed
-- config would raise a cast error instead of returning false.
create or replace function public.pos_fees_are_valid(_fees jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  _fee jsonb;
  _value numeric;
begin
  if _fees is null or jsonb_typeof(_fees) <> 'array' then
    return false;
  end if;

  -- A till's fee list is a handful of lines, not a catalogue. The bound stops
  -- a malformed or hostile payload from making every checkout iterate forever.
  if jsonb_array_length(_fees) > 20 then
    return false;
  end if;

  for _fee in select * from jsonb_array_elements(_fees) loop
    if jsonb_typeof(_fee) <> 'object' then return false; end if;

    -- The UI keys its rows by this; a duplicate or missing id makes editing
    -- one fee silently edit another.
    if coalesce(btrim(_fee->>'id'), '') = '' then return false; end if;

    if coalesce(btrim(_fee->>'name'), '') = '' then return false; end if;
    if char_length(_fee->>'name') > 80 then return false; end if;

    if (_fee->>'type') is null or (_fee->>'type') not in ('fixed', 'percent') then
      return false;
    end if;

    -- jsonb_typeof first: "5" as a string, or null, must be rejected as a
    -- shape error rather than coerced into a number.
    if jsonb_typeof(_fee->'value') <> 'number' then return false; end if;
    _value := (_fee->>'value')::numeric;
    if _value < 0 then return false; end if;
    if (_fee->>'type') = 'percent' and _value > 100 then return false; end if;

    if jsonb_typeof(_fee->'enabled') <> 'boolean' then return false; end if;
  end loop;

  return true;
end;
$$;

comment on function public.pos_fees_are_valid(jsonb) is
  'Validates the shape of branch_pos_settings.fees. Mirrors the standalone POS fee model: {id, name, type: fixed|percent, value >= 0, enabled}.';

-- ------------------------------------------------------- the settings table
create table public.branch_pos_settings (
  -- One row per branch at most, and the branch is the identity: no surrogate
  -- key, because "the POS settings of branch X" is exactly what this is.
  branch_id uuid primary key references public.branches(id) on delete cascade,

  fees jsonb not null default '[]'::jsonb,

  -- The storage object path, never a URL. A signed URL expires, so storing one
  -- would leave the database holding a value that is wrong a few minutes after
  -- it is written. The path is stable; the UI exchanges it for a fresh signed
  -- URL each time it needs to show the image.
  payment_qr_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint branch_pos_settings_fees_valid check (public.pos_fees_are_valid(fees)),

  -- The object must live in this branch's own folder. Without this a row could
  -- point at another branch's QR, and the storage policies -- which authorise
  -- on the path's first segment -- would happily serve it.
  constraint branch_pos_settings_qr_path_scoped check (
    payment_qr_path is null
    or payment_qr_path like branch_id::text || '/%'
  )
);

comment on table public.branch_pos_settings is
  'POS-only configuration for a branch. Kept out of public.branches, which every active HR user can read.';

create trigger trg_set_updated_at
  before update on public.branch_pos_settings
  for each row execute function public.set_updated_at();

alter table public.branch_pos_settings enable row level security;

-- Reading: an Administrator, or someone actually working that branch's till.
-- has_pos_role() already returns true for an Administrator and re-checks that
-- the profile behind the assignment is still active, so a deactivated account
-- loses sight of the configuration at the same moment it loses the till.
create policy branch_pos_settings_pos_select on public.branch_pos_settings
  for select to authenticated
  using (public.has_pos_role(branch_id, array['manager', 'cashier']::public.pos_role[]));

-- Writing: Administrator only. This mirrors the standalone POS, where fees, the
-- payment QR and the branch's own details were all reachable by the store
-- 'admin' role alone -- a manager runs the branch's trading, not what it
-- charges. Phase 2B keeps that split rather than widening it.
create policy branch_pos_settings_admin_manage on public.branch_pos_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Matches this project's privilege model: blanket table grants with RLS doing
-- the real access control (20260716070000_grant_table_privileges_to_api_roles).
-- Every policy above is `to authenticated`, so anon matches none of them and is
-- refused by RLS rather than by a missing grant.
grant all privileges on table public.branch_pos_settings to anon, authenticated, service_role;

revoke all on function public.pos_fees_are_valid(jsonb) from anon;
grant execute on function public.pos_fees_are_valid(jsonb) to authenticated, service_role;

-- ------------------------------------------------------- payment QR storage
--
-- Private. Every other bucket in this system is private, and a payment QR is
-- branch configuration rather than public web content -- serving it from a
-- public URL would make it readable by anyone who ever saw the link, including
-- after the branch replaced it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pos-payment-qr',
  'pos-payment-qr',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Objects are stored as `<branch_id>/<uuid>.<ext>`, so the first path segment
-- is the authorization subject. Returns null for anything that is not a
-- well-formed uuid folder, which the policies treat as "not authorised" rather
-- than raising a cast error on a hand-crafted object name.
create or replace function public.pos_qr_branch_id(_object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(_object_name))[1] ~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(_object_name))[1])::uuid
  end;
$$;

revoke all on function public.pos_qr_branch_id(text) from anon;
grant execute on function public.pos_qr_branch_id(text) to authenticated, service_role;

-- Reading mirrors the table: Administrator, or assigned POS staff at that
-- branch. This is what makes a signed URL safe to hand out -- the signature is
-- only issued to a caller the policy already admitted.
create policy pos_payment_qr_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pos-payment-qr'
    and public.pos_qr_branch_id(name) is not null
    and public.has_pos_role(
      public.pos_qr_branch_id(name),
      array['manager', 'cashier']::public.pos_role[]
    )
  );

-- Uploading, replacing and deleting are Administrator-only, matching the table.
-- Three separate policies because Postgres has no single 'write' command and
-- an ALL policy would also re-grant SELECT more loosely than the read policy
-- above.
create policy pos_payment_qr_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pos-payment-qr'
    and public.pos_qr_branch_id(name) is not null
    and public.is_admin()
  );

create policy pos_payment_qr_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'pos-payment-qr' and public.is_admin())
  with check (
    bucket_id = 'pos-payment-qr'
    and public.pos_qr_branch_id(name) is not null
    and public.is_admin()
  );

create policy pos_payment_qr_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'pos-payment-qr' and public.is_admin());
