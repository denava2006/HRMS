-- The till: sales, sale items, and one atomic checkout.
--
-- Everything a sale needs is derived here, under lock, from data the client
-- cannot influence. The browser sends what it legitimately knows -- which
-- branch, which products, how many, how the customer is paying, and a key so a
-- retry is safe -- and nothing else. Price, cost, fees, totals, COGS and the
-- cashier's identity are all read or computed inside this function.
--
-- The standalone POS got most of this right and one thing wrong, and the wrong
-- thing is worth naming. Its client-facing wrapper computed a full result
-- including profit and then removed keys from it:
--
--     if _role = 'cashier' then
--       return _result - 'total_profit' - 'total_cogs' - 'gross_profit' ...
--
-- so a manager received profit, and a cashier's protection was a subtraction on
-- a payload that had already been built with cost in it. Here the public
-- response is assembled field by field from receipt-safe values only. There is
-- no cost-bearing object to strip.

-- ------------------------------------------------------------------- status

-- One value for now. Voids and refunds are later phases with their own
-- movement types and their own rules; naming them here would imply behaviour
-- that does not exist. The column reserves the concept so adding them later is
-- an ALTER TYPE rather than a table rewrite.
create type public.pos_sale_status as enum ('completed');

-- -------------------------------------------------------------------- sales

create table public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,

  -- The trusted relational identity, stamped from auth.uid(). Used for
  -- authorization and audit -- Phase 6's "a cashier sees their own
  -- transactions" resolves against this, not against a name.
  cashier_id uuid not null references public.profiles(id) on delete restrict,

  status public.pos_sale_status not null default 'completed',

  -- ---------------------------------------------------------- receipt facts
  subtotal numeric(14,2) not null check (subtotal >= 0),
  fees_total numeric(14,2) not null default 0 check (fees_total >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),

  -- The fee list as it was applied, not a reference to today's configuration.
  -- Editing a branch's fees must not rewrite what a customer was charged.
  fees jsonb not null default '[]'::jsonb,

  payment_method text not null check (payment_method in ('cash', 'gcash', 'maya', 'bank', 'other')),
  payment_reference text,
  amount_tendered numeric(14,2) check (amount_tendered is null or amount_tendered >= 0),

  -- Stored, not derived on read. A reprint months later must show the change
  -- that was actually handed over, even if the total would compute differently
  -- against today's prices.
  change_given numeric(14,2) check (change_given is null or change_given >= 0),

  -- ------------------------------------------------------------- accounting
  -- Cost of what was sold, at the branch's average at the moment of sale.
  -- Administrator-only: this table is not readable by POS staff, and the
  -- checkout response does not carry it.
  --
  -- Gross product profit is deliberately NOT stored. It is exactly
  -- `subtotal - total_cogs`, both of which are snapshots here, so it is stable
  -- whenever it is computed. Persisting it would freeze an accounting opinion
  -- -- specifically, whether customer-paid fees belong to product profit --
  -- that FMS has not settled yet.
  total_cogs numeric(14,2) not null default 0 check (total_cogs >= 0),

  -- --------------------------------------------------- historical snapshots
  -- A receipt reprinted next year must read as it did on the day. A branch
  -- rename, a company rename or a staff rename must not rewrite it.
  branch_name text not null,
  branch_address text,
  branch_phone text,
  company_name text,
  cashier_name text not null,

  -- ------------------------------------------------------------ idempotency
  checkout_key uuid not null,
  -- SHA-256 over the canonical client request. Two attempts under one key are
  -- the same sale only if this matches.
  request_fingerprint text not null,

  created_at timestamptz not null default now(),

  constraint pos_sales_total_is_subtotal_plus_fees
    check (total_amount = subtotal + fees_total),
  -- Cash is tendered and gives change; the electronic methods carry a
  -- reference instead. Enforced here as well as in the RPC so a future writer
  -- cannot produce a sale that could not have happened at a till.
  constraint pos_sales_cash_has_tender check (
    (payment_method = 'cash' and amount_tendered is not null and change_given is not null
      and payment_reference is null)
    or (payment_method <> 'cash' and payment_reference is not null
      and amount_tendered is null and change_given is null)
  ),
  -- The durable guarantee. The advisory lock only makes a concurrent retry
  -- wait; this is what makes a double charge impossible.
  constraint pos_sales_checkout_key_unique unique (branch_id, cashier_id, checkout_key)
);

create index pos_sales_branch_created_idx on public.pos_sales (branch_id, created_at desc);
create index pos_sales_cashier_created_idx on public.pos_sales (cashier_id, created_at desc);

create table public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  -- restrict, not cascade: a completed sale is not deleted through ordinary
  -- application flows, and its lines go with it if it ever is.
  sale_id uuid not null references public.pos_sales(id) on delete restrict,
  product_id uuid not null references public.pos_products(id) on delete restrict,

  -- Snapshots. A rename or recategorisation must not rewrite old receipts.
  product_name text not null,
  category_name text not null,

  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),

  -- The branch's average unit cost at the moment of sale. Administrator-only.
  unit_cost_snapshot numeric(12,2) not null check (unit_cost_snapshot >= 0),
  line_cogs numeric(14,2) not null check (line_cogs >= 0),

  created_at timestamptz not null default now(),

  constraint pos_sale_items_line_total_math
    check (line_total = round(unit_price * quantity, 2)),
  constraint pos_sale_items_line_cogs_math
    check (line_cogs = round(unit_cost_snapshot * quantity, 2)),
  -- One line per product: the RPC normalises duplicates before it gets here, so
  -- two lines for the same product would mean the normalisation was bypassed.
  constraint pos_sale_items_one_line_per_product unique (sale_id, product_id)
);

create index pos_sale_items_sale_idx on public.pos_sale_items (sale_id);
create index pos_sale_items_product_idx on public.pos_sale_items (product_id);

-- --------------------------------------------------------------------- RLS
--
-- Administrator-only reads, and no write policy for anyone. Both tables carry
-- cost, so POS staff never read them directly -- Phase 6 adds role-safe RPCs
-- (`get_my_transactions`, `get_branch_transactions`) whose signatures omit it.
-- Writes happen only inside checkout_pos_sale, which runs as the owner.

alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;

create policy pos_sales_admin_select on public.pos_sales
  for select to authenticated using (public.is_admin());

create policy pos_sale_items_admin_select on public.pos_sale_items
  for select to authenticated using (public.is_admin());

-- REVOKE first, and explicitly. `grant select` alone restricts nothing here:
-- 20260716070000 set ALTER DEFAULT PRIVILEGES ... ON TABLES, so every new table
-- in `public` is born with full DML for anon and authenticated, and GRANT
-- cannot narrow what is already held. This project has hit that three times
-- (20260813010000, 20260825030000, 20260825070000); the contract test asserts
-- the resulting catalogue rather than trusting these lines.
revoke all privileges on table public.pos_sales from anon, authenticated;
revoke all privileges on table public.pos_sale_items from anon, authenticated;
grant select on table public.pos_sales to anon, authenticated;
grant select on table public.pos_sale_items to anon, authenticated;
grant select, insert, update, delete on table public.pos_sales to service_role;
grant select, insert, update, delete on table public.pos_sale_items to service_role;

-- ------------------------------------------------------ payment references
--
-- Ported from the standalone with its formats intact. A reference is what the
-- customer read off their phone: it is captured, never treated as proof that
-- money moved.
create or replace function public.validate_pos_payment_reference(
  _payment_method text,
  _payment_reference text
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  _normalized text := nullif(btrim(coalesce(_payment_reference, '')), '');
begin
  if _payment_method = 'cash' then
    return null;
  end if;

  if _normalized is null then
    raise exception 'A payment reference is required for % payments', _payment_method;
  end if;

  if _payment_method in ('gcash', 'maya') then
    if _normalized !~ '^[0-9]{6,32}$' then
      raise exception 'A % reference must be 6-32 digits (numbers only)', _payment_method;
    end if;
  elsif _payment_method = 'bank' then
    if _normalized !~ '^[A-Za-z0-9 -]{6,64}$' then
      raise exception 'A bank reference must be 6-64 characters using letters, numbers, spaces or hyphens';
    end if;
  elsif _payment_method = 'other' then
    if char_length(_normalized) > 64 or _normalized ~ '[[:cntrl:]]' then
      raise exception 'A payment reference must be 1-64 printable characters';
    end if;
  else
    raise exception 'Invalid payment method';
  end if;

  return _normalized;
end;
$$;

-- ------------------------------------------------------------------ limits
--
-- Sized for a shop till, not for an import job. A cart beyond these is either a
-- mistake or an attempt to make one checkout hold locks on the whole catalogue,
-- and either way it is rejected before any locking happens.
create or replace function public.pos_max_cart_lines() returns integer
  language sql immutable set search_path = '' as $$ select 50 $$;
create or replace function public.pos_max_line_quantity() returns integer
  language sql immutable set search_path = '' as $$ select 999 $$;

-- ------------------------------------------------------------------ checkout

create or replace function public.checkout_pos_sale(
  _branch_id uuid,
  _items jsonb,
  _payment_method text,
  _checkout_key uuid,
  _payment_reference text default null,
  _amount_tendered numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _cashier uuid := (select auth.uid());
  _cashier_name text;
  _company text;
  _branch public.branches%rowtype;
  _settings public.branch_pos_settings%rowtype;
  _normalized jsonb;
  _fingerprint text;
  _existing public.pos_sales%rowtype;
  _sale public.pos_sales%rowtype;
  _line jsonb;
  _fee jsonb;
  _product_id uuid;
  _quantity integer;
  _inv public.pos_branch_inventory%rowtype;
  _name text;
  _category text;
  _price numeric(12,2);
  _subtotal numeric(14,2) := 0;
  _cogs numeric(14,2) := 0;
  _fees_total numeric(14,2) := 0;
  _fee_amount numeric(14,2);
  _applied_fees jsonb := '[]'::jsonb;
  _total numeric(14,2);
  _reference text;
  _change numeric(14,2);
  _items_out jsonb := '[]'::jsonb;
begin
  ---------------------------------------------------------------- 1. caller
  if _cashier is null then
    raise exception 'Sign in to use the till';
  end if;
  if _checkout_key is null then
    raise exception 'A checkout key is required';
  end if;
  -- Anyone who may work this branch's till: an Administrator, or an active
  -- assignment. has_pos_role() re-checks the profile is still active, so a
  -- deactivated account cannot ring up a sale on a stale session.
  if not public.has_pos_role(_branch_id, array['manager', 'cashier']::public.pos_role[]) then
    raise exception 'You do not have POS access at this branch';
  end if;

  ------------------------------------------------- 2. shape, before any work
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'The cart is empty';
  end if;
  if jsonb_array_length(_items) > public.pos_max_cart_lines() * 4 then
    -- A generous pre-normalisation bound purely to stop a pathological payload
    -- reaching the normalisation query at all.
    raise exception 'That cart has too many lines';
  end if;

  ---------------------------------------------- 3. normalise, then fingerprint
  --
  -- Duplicate lines are merged rather than refused: a cashier tapping the same
  -- product twice is describing one line of five, not an error. Merging also
  -- makes the fingerprint canonical, so the same cart entered in a different
  -- order hashes identically -- and it gives the deterministic lock order that
  -- keeps two concurrent carts from deadlocking on each other.
  begin
    select jsonb_agg(jsonb_build_object('product_id', pid, 'quantity', qty) order by pid)
    into _normalized
    from (
      select (value->>'product_id')::uuid as pid, sum((value->>'quantity')::integer) as qty
      from jsonb_array_elements(_items)
      group by 1
    ) merged;
  exception when others then
    raise exception 'Every cart line needs a product and a whole-number quantity';
  end;

  if _normalized is null then
    raise exception 'The cart is empty';
  end if;
  if jsonb_array_length(_normalized) > public.pos_max_cart_lines() then
    raise exception 'A single sale can hold at most % different products', public.pos_max_cart_lines();
  end if;

  for _line in select value from jsonb_array_elements(_normalized) loop
    _quantity := (_line->>'quantity')::integer;
    if _quantity is null or _quantity <= 0 then
      raise exception 'Every quantity must be a positive whole number';
    end if;
    if _quantity > public.pos_max_line_quantity() then
      raise exception 'A single line cannot exceed % units', public.pos_max_line_quantity();
    end if;
  end loop;

  -- SHA-256 via pgcrypto, which this database already has (extensions schema).
  -- Only the client-controlled inputs go in: what was asked for, and how it was
  -- being paid. Server-derived prices and fees are deliberately excluded --
  -- otherwise a price change between a failed attempt and its retry would make
  -- an identical retry look like a different request.
  _fingerprint := encode(
    extensions.digest(
      _normalized::text || '|' || _payment_method
        || '|' || coalesce(btrim(_payment_reference), '')
        || '|' || coalesce(_amount_tendered::text, ''),
      'sha256'
    ),
    'hex'
  );

  ------------------------------------------------------------ 4. idempotency
  --
  -- Serialise retries of this exact key first, so a concurrent second attempt
  -- waits for the first to commit and then finds it, rather than racing into a
  -- unique violation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _branch_id::text || ':' || _cashier::text || ':' || _checkout_key::text, 0
    )
  );

  select * into _existing from public.pos_sales s
  where s.branch_id = _branch_id and s.cashier_id = _cashier and s.checkout_key = _checkout_key;

  if found then
    if _existing.request_fingerprint <> _fingerprint then
      raise exception 'That checkout key was already used for a different sale';
    end if;
    -- Same key, same request: hand back the sale that already exists. No second
    -- sale, no second deduction, no second movement.
    return public.pos_sale_receipt(_existing.id);
  end if;

  ------------------------------------------------------- 5. branch and fees
  select * into _branch from public.branches b where b.id = _branch_id and b.is_active;
  if not found then
    raise exception 'That branch is not active';
  end if;
  select * into _settings from public.branch_pos_settings s where s.branch_id = _branch_id;
  select (value #>> '{}') into _company from public.system_settings where key = 'company_name';
  select p.full_name into _cashier_name from public.profiles p where p.id = _cashier;

  --------------------------------------- 6. lock, validate, price, cost
  --
  -- Locked in the normalised product order, which is sorted, so two carts
  -- holding the same products in different orders queue behind each other
  -- instead of deadlocking.
  for _line in select value from jsonb_array_elements(_normalized) loop
    _product_id := (_line->>'product_id')::uuid;
    _quantity := (_line->>'quantity')::integer;

    select * into _inv
    from public.pos_branch_inventory i
    where i.branch_id = _branch_id and i.product_id = _product_id
    for update;
    if not found then
      raise exception 'One of those products is not carried at this branch';
    end if;

    -- Everything the till must not decide for itself: is the product still
    -- sellable, is the branch still offering it, and what does it cost today.
    select p.name, c.name, coalesce(bp.selling_price_override, p.default_selling_price)
    into _name, _category, _price
    from public.pos_branch_products bp
    join public.pos_products p on p.id = bp.product_id
    join public.pos_product_categories c on c.id = p.category_id
    where bp.branch_id = _branch_id
      and bp.product_id = _product_id
      and bp.is_available
      and p.status = 'active';
    if not found then
      raise exception 'One of those products is no longer available at this branch';
    end if;

    if _inv.quantity_on_hand < _quantity then
      raise exception 'Only % of % left', _inv.quantity_on_hand, _name;
    end if;

    _subtotal := _subtotal + round(_price * _quantity, 2);
    _cogs := _cogs + round(_inv.average_unit_cost * _quantity, 2);
  end loop;

  ------------------------------------------------------------------ 7. fees
  for _fee in select value from jsonb_array_elements(coalesce(_settings.fees, '[]'::jsonb)) loop
    if coalesce((_fee->>'enabled')::boolean, false)
      and coalesce((_fee->>'value')::numeric, 0) > 0
      and (_fee->>'type') in ('percent', 'fixed')
    then
      -- Each fee rounds before anything is added up, matching lib/posFees.ts.
      -- Rounding the sum instead drifts by a centavo on some baskets, and the
      -- till would then refuse an exact cash tender.
      _fee_amount := case
        when (_fee->>'type') = 'percent' then round(_subtotal * ((_fee->>'value')::numeric / 100), 2)
        else round((_fee->>'value')::numeric, 2)
      end;
      _fees_total := _fees_total + _fee_amount;
      _applied_fees := _applied_fees || jsonb_build_array(jsonb_build_object(
        'name', coalesce(nullif(btrim(_fee->>'name'), ''), 'Fee'),
        'type', _fee->>'type',
        'value', (_fee->>'value')::numeric,
        'amount', _fee_amount
      ));
    end if;
  end loop;

  _total := round(_subtotal + _fees_total, 2);

  --------------------------------------------------------------- 8. payment
  _reference := public.validate_pos_payment_reference(_payment_method, _payment_reference);

  if _payment_method = 'cash' then
    if _amount_tendered is null or _amount_tendered < 0 then
      raise exception 'Enter the cash received';
    end if;
    if _amount_tendered < _total then
      raise exception 'Cash received is less than the total';
    end if;
    _change := round(_amount_tendered - _total, 2);
  else
    _change := null;
  end if;

  ------------------------------------------------------------------ 9. sale
  insert into public.pos_sales (
    branch_id, cashier_id, subtotal, fees_total, total_amount, fees,
    payment_method, payment_reference, amount_tendered, change_given,
    total_cogs, branch_name, branch_address, branch_phone, company_name,
    cashier_name, checkout_key, request_fingerprint
  ) values (
    _branch_id, _cashier, _subtotal, _fees_total, _total, _applied_fees,
    _payment_method, _reference,
    case when _payment_method = 'cash' then _amount_tendered else null end,
    _change,
    _cogs, _branch.name, _branch.address, _branch.phone, _company,
    coalesce(_cashier_name, 'Unknown'), _checkout_key, _fingerprint
  )
  returning * into _sale;

  ------------------------------------------- 10. lines, stock, and movements
  perform set_config('harmony.pos_inventory_write', 'allowed', true);

  for _line in select value from jsonb_array_elements(_normalized) loop
    _product_id := (_line->>'product_id')::uuid;
    _quantity := (_line->>'quantity')::integer;

    select * into _inv from public.pos_branch_inventory i
    where i.branch_id = _branch_id and i.product_id = _product_id;

    select p.name, c.name, coalesce(bp.selling_price_override, p.default_selling_price)
    into _name, _category, _price
    from public.pos_branch_products bp
    join public.pos_products p on p.id = bp.product_id
    join public.pos_product_categories c on c.id = p.category_id
    where bp.branch_id = _branch_id and bp.product_id = _product_id;

    insert into public.pos_sale_items (
      sale_id, product_id, product_name, category_name, quantity,
      unit_price, line_total, unit_cost_snapshot, line_cogs
    ) values (
      _sale.id, _product_id, _name, _category, _quantity,
      _price, round(_price * _quantity, 2),
      _inv.average_unit_cost, round(_inv.average_unit_cost * _quantity, 2)
    );

    -- Quantity only. Selling at the average does not move the average -- the
    -- valuation Phase 4 established is what this sale's COGS was snapshotted
    -- from, and it must still describe what is left on the shelf.
    update public.pos_branch_inventory
    set quantity_on_hand = quantity_on_hand - _quantity
    where branch_id = _branch_id and product_id = _product_id
      and quantity_on_hand >= _quantity;
    if not found then
      raise exception 'Stock for % changed during checkout', _name;
    end if;

    insert into public.pos_inventory_movements (
      branch_id, product_id, movement_type, quantity_change,
      stock_before, stock_after, unit_cost, source_type, source_id, notes, actor_id
    ) values (
      _branch_id, _product_id, 'sale', -_quantity,
      _inv.quantity_on_hand, _inv.quantity_on_hand - _quantity,
      -- The same cost the sale line snapshotted, so the ledger and the sale
      -- agree about what this movement was worth.
      _inv.average_unit_cost,
      'sale', _sale.id, null, _cashier
    );
  end loop;

  perform set_config('harmony.pos_inventory_write', '', true);

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    _cashier, 'POS Sale Completed', 'pos_sales', _sale.id,
    jsonb_build_object('branch_id', _branch_id, 'total_amount', _total,
                       'payment_method', _payment_method, 'lines', jsonb_array_length(_normalized))
  );

  return public.pos_sale_receipt(_sale.id);
end;
$$;

-- The receipt.
--
-- Every field here is something a customer could read off a printed slip. There
-- is no cost, no COGS and no margin anywhere in the construction -- not removed
-- afterwards, never assembled. That is the difference from the standalone,
-- whose wrapper built a profit-bearing object and subtracted keys from it for
-- cashiers only.
create or replace function public.pos_sale_receipt(_sale_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'sale_id', s.id,
    'created_at', s.created_at,
    'status', s.status,
    'company_name', s.company_name,
    'branch_name', s.branch_name,
    'branch_address', s.branch_address,
    'branch_phone', s.branch_phone,
    'cashier_name', s.cashier_name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'category_name', i.category_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'line_total', i.line_total
      ) order by i.product_name)
      from public.pos_sale_items i where i.sale_id = s.id
    ), '[]'::jsonb),
    'subtotal', s.subtotal,
    'fees', s.fees,
    'fees_total', s.fees_total,
    'total_amount', s.total_amount,
    'payment_method', s.payment_method,
    'payment_reference', s.payment_reference,
    'amount_tendered', s.amount_tendered,
    'change_given', s.change_given
  )
  from public.pos_sales s
  where s.id = _sale_id;
$$;

-- ------------------------------------------------------------------ grants
--
-- Both revokes, as always here.
revoke all on function public.checkout_pos_sale(uuid, jsonb, text, uuid, text, numeric) from public, anon;
revoke all on function public.pos_sale_receipt(uuid) from public, anon;
revoke all on function public.validate_pos_payment_reference(text, text) from public, anon;
revoke all on function public.pos_max_cart_lines() from public, anon;
revoke all on function public.pos_max_line_quantity() from public, anon;

grant execute on function public.checkout_pos_sale(uuid, jsonb, text, uuid, text, numeric) to authenticated, service_role;
grant execute on function public.validate_pos_payment_reference(text, text) to authenticated, service_role;
grant execute on function public.pos_max_cart_lines() to authenticated, service_role;
grant execute on function public.pos_max_line_quantity() to authenticated, service_role;

-- pos_sale_receipt is NOT granted to authenticated. It takes a sale id and
-- returns that sale unconditionally, so it is safe only as an internal helper
-- called by checkout_pos_sale, which has already established that the caller
-- just made this sale. Phase 6's transaction-history RPCs will do their own
-- authorisation before returning anything.
grant execute on function public.pos_sale_receipt(uuid) to service_role;
