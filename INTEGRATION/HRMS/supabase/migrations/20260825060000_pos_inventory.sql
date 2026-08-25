-- Branch inventory: the balance, the ledger, and the only ways to move them.
--
-- Phase 3 deliberately shipped no stock column. This migration adds one, and
-- adds it together with everything that keeps it honest -- the movement ledger,
-- the write guard, and the trusted operations -- because a quantity without a
-- ledger is a number nothing reconciles.
--
-- Shape follows the catalogue: identity is enterprise-level, operational state
-- is branch-level.
--
--   pos_products            what the thing is                (enterprise)
--   pos_branch_products     which branches carry it          (branch)
--   pos_branch_inventory    how many, worth how much         (branch)  <- new
--   pos_inventory_movements every change, and why            (branch)  <- new
--
-- WHAT THIS PHASE DOES NOT DO: sell, refund, transfer, or purchase. The ledger
-- is shaped so those arrive as new movement types and new source types rather
-- than as a second inventory model.

-- ------------------------------------------------------------------- types

-- Only the three types Phase 4 actually emits. `sale`, `refund`, `transfer_in`,
-- `transfer_out` and `count_correction` are added by the phases that implement
-- them, via ALTER TYPE ... ADD VALUE -- already proven here by
-- 20260716005116_user_role_add_employee. Note for whoever does that: a
-- migration may add a value, but may not also *use* it in the same
-- transaction.
create type public.pos_movement_type as enum ('receipt', 'adjustment_in', 'adjustment_out');

-- ----------------------------------------------------------------- balance

create table public.pos_branch_inventory (
  branch_id uuid not null,
  product_id uuid not null,

  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),

  -- Branch-specific operational configuration. Nothing to port: the standalone
  -- POS had no threshold in the database at all, only a hardcoded constant of 5
  -- in its React bundle.
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),

  -- Weighted-average cost of what this branch is actually holding.
  --
  -- Deliberately NOT pos_products.default_unit_cost: that is the enterprise
  -- master's figure, and one branch taking a delivery at a different price must
  -- not move it for every other branch. The standalone POS recomputed its
  -- single products.buying_price on every restock, which is correct when a
  -- store *is* the business and wrong when branches share a catalogue.
  --
  -- Sensitive. Administrator-visible only -- which is why POS staff read this
  -- table through RPCs rather than directly (see the RLS section).
  average_unit_cost numeric(12,2) not null default 0 check (average_unit_cost >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (branch_id, product_id),

  -- Inventory exists only for a product the branch actually carries, and cannot
  -- drift to another branch. CASCADE rather than RESTRICT on purpose: it is
  -- what makes "remove a product a branch never stocked" possible, while the
  -- movements table below refuses the same delete the moment any history
  -- exists. Between the two, cleanup is allowed and history is not destroyed.
  constraint pos_branch_inventory_branch_product_fk
    foreign key (branch_id, product_id)
    references public.pos_branch_products(branch_id, product_id)
    on update restrict
    on delete cascade
);

create index pos_branch_inventory_product_idx on public.pos_branch_inventory (product_id);
create index pos_branch_inventory_low_stock_idx
  on public.pos_branch_inventory (branch_id)
  where quantity_on_hand <= low_stock_threshold;

-- ------------------------------------------------------------------ ledger

create table public.pos_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  product_id uuid not null,

  -- What happened to the quantity.
  movement_type public.pos_movement_type not null,

  quantity_change integer not null check (quantity_change <> 0),
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),

  -- The price this delivery was received at. Null for adjustments, which move
  -- quantity without any purchase having happened. Sensitive: admin-only.
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),

  -- WHY it happened -- which workflow. Kept separate from movement_type so a
  -- later `sale` can be told apart from a `refund` that also removes stock, and
  -- so an FMS-approved receipt can be told apart from a manual one without a
  -- new movement type.
  --
  -- The CHECK is the trust boundary: only the two Phase 4 workflows exist, and
  -- the RPCs set the value themselves. A client cannot claim to be an FMS
  -- receipt, because 'purchase_order_receiving' is not yet a legal value and
  -- no RPC accepts a caller-supplied source.
  source_type text not null,
  constraint pos_inventory_movements_source_type check (
    source_type in ('manual_receiving', 'manual_adjustment')
  ),
  source_id uuid,

  notes text check (notes is null or char_length(btrim(notes)) <= 500),

  -- Stamped from auth.uid() inside the RPC, never accepted from the caller --
  -- the lesson of 20260825010000.
  actor_id uuid references public.profiles(id),

  created_at timestamptz not null default now(),

  constraint pos_inventory_movements_stock_math
    check (stock_after = stock_before + quantity_change),

  -- RESTRICT: a branch that has moved stock keeps that history. This is what
  -- refuses `delete from pos_branch_products` once anything has happened, while
  -- the CASCADE above still lets a never-stocked entry be cleaned up.
  constraint pos_inventory_movements_inventory_fk
    foreign key (branch_id, product_id)
    references public.pos_branch_inventory(branch_id, product_id)
    on update restrict
    on delete restrict
);

create index pos_inventory_movements_branch_created_idx
  on public.pos_inventory_movements (branch_id, created_at desc);
create index pos_inventory_movements_product_created_idx
  on public.pos_inventory_movements (branch_id, product_id, created_at desc);
create index pos_inventory_movements_source_idx
  on public.pos_inventory_movements (source_type, source_id)
  where source_id is not null;

create trigger trg_set_updated_at before update on public.pos_branch_inventory
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- triggers

-- A branch that starts carrying a product gets a zero balance immediately.
--
-- Lazy creation would read more frugally, but two concurrent first receipts
-- would both find no row and race on the insert. With the row guaranteed to
-- exist, every mutation below is a plain SELECT ... FOR UPDATE with no upsert
-- path and no race. It also makes "carried, never received" an unambiguous 0
-- rather than a missing row the UI has to interpret, and lets a threshold be
-- set before the first delivery.
--
-- SECURITY DEFINER because the Administrator inserting the branch-product row
-- has no INSERT policy on pos_branch_inventory -- nobody does.
create or replace function public.create_branch_inventory_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pos_branch_inventory (branch_id, product_id)
  values (new.branch_id, new.product_id)
  on conflict (branch_id, product_id) do nothing;
  return new;
end;
$$;

create trigger trg_create_branch_inventory
  after insert on public.pos_branch_products
  for each row execute function public.create_branch_inventory_row();

-- Defence in depth.
--
-- RLS already grants nobody an UPDATE path to this table. But a SECURITY
-- DEFINER function bypasses RLS, so without this a future function could move
-- stock or valuation without writing a movement. The guard makes the intended
-- operations the only ones that can: they set the GUC immediately before their
-- UPDATE and clear it immediately after.
create or replace function public.guard_pos_inventory_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.quantity_on_hand is distinct from old.quantity_on_hand
      or new.average_unit_cost is distinct from old.average_unit_cost)
     and coalesce(current_setting('harmony.pos_inventory_write', true), '') <> 'allowed'
  then
    raise exception 'Stock and valuation change only through the inventory operations';
  end if;
  return new;
end;
$$;

create trigger trg_guard_pos_inventory_write
  before update on public.pos_branch_inventory
  for each row execute function public.guard_pos_inventory_write();

-- -------------------------------------------------------------------- RLS
--
-- Both tables are Administrator-only for direct reads, and writable by nobody.
--
-- The brief asked for "SELECT -> authorized branch users" on the balance. That
-- cannot be done on this table without also handing them average_unit_cost,
-- which the same brief makes Administrator-only: RLS filters rows, not columns,
-- and a column-level grant would break `select *` for every caller. So branch
-- users read their inventory through get_branch_inventory(), which is
-- authorised identically and returns no cost. Same resolution, and the same
-- reasoning, as Phase 3's pos_products.

alter table public.pos_branch_inventory enable row level security;
alter table public.pos_inventory_movements enable row level security;

create policy pos_branch_inventory_admin_select on public.pos_branch_inventory
  for select to authenticated using (public.is_admin());

create policy pos_inventory_movements_admin_select on public.pos_inventory_movements
  for select to authenticated using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy is defined for either table, for any role,
-- including Administrators. Every write goes through a SECURITY DEFINER
-- function below, which is what guarantees a balance change and its movement
-- are written together.

grant select on table public.pos_branch_inventory to anon, authenticated, service_role;
grant select on table public.pos_inventory_movements to anon, authenticated, service_role;
grant insert, update, delete on table public.pos_branch_inventory to service_role;
grant insert, update, delete on table public.pos_inventory_movements to service_role;

-- ------------------------------------------------------------------- reads

-- A branch's inventory, for the people who manage it. No cost of any kind.
create or replace function public.get_branch_inventory(_branch_id uuid)
returns table (
  product_id uuid,
  product_name text,
  category_name text,
  quantity_on_hand integer,
  low_stock_threshold integer,
  is_low_stock boolean,
  is_available boolean,
  product_status public.pos_product_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.product_id,
    p.name,
    c.name,
    i.quantity_on_hand,
    i.low_stock_threshold,
    i.quantity_on_hand <= i.low_stock_threshold,
    bp.is_available,
    p.status
  from public.pos_branch_inventory i
  join public.pos_branch_products bp
    on bp.branch_id = i.branch_id and bp.product_id = i.product_id
  join public.pos_products p on p.id = i.product_id
  join public.pos_product_categories c on c.id = p.category_id
  where i.branch_id = _branch_id
    and public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  order by c.sort_order, c.name, p.name;
$$;

-- Movement history for a POS Manager. The cost columns are absent from the
-- signature rather than returned as null: a column that is not declared cannot
-- be selected by a careless future edit.
create or replace function public.get_branch_movements(_branch_id uuid, _limit integer default 100)
returns table (
  id uuid,
  product_id uuid,
  product_name text,
  movement_type public.pos_movement_type,
  quantity_change integer,
  stock_before integer,
  stock_after integer,
  source_type text,
  notes text,
  actor_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id, m.product_id, p.name, m.movement_type, m.quantity_change,
    m.stock_before, m.stock_after, m.source_type, m.notes,
    a.full_name, m.created_at
  from public.pos_inventory_movements m
  join public.pos_products p on p.id = m.product_id
  left join public.profiles a on a.id = m.actor_id
  where m.branch_id = _branch_id
    and public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  order by m.created_at desc
  limit greatest(1, least(coalesce(_limit, 100), 500));
$$;

-- The same history with valuation, for an Administrator. A separate function
-- rather than a flag, so the cost-free one has no code path that could ever
-- return cost.
create or replace function public.get_branch_movements_with_cost(_branch_id uuid, _limit integer default 100)
returns table (
  id uuid,
  product_id uuid,
  product_name text,
  movement_type public.pos_movement_type,
  quantity_change integer,
  stock_before integer,
  stock_after integer,
  unit_cost numeric,
  source_type text,
  source_id uuid,
  notes text,
  actor_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id, m.product_id, p.name, m.movement_type, m.quantity_change,
    m.stock_before, m.stock_after, m.unit_cost, m.source_type, m.source_id,
    m.notes, a.full_name, m.created_at
  from public.pos_inventory_movements m
  join public.pos_products p on p.id = m.product_id
  left join public.profiles a on a.id = m.actor_id
  where m.branch_id = _branch_id
    and public.is_admin()
  order by m.created_at desc
  limit greatest(1, least(coalesce(_limit, 100), 500));
$$;

-- --------------------------------------------------------------- mutations

-- Receiving stock.
--
-- Administrator-only in Phase 4. A POS Manager deliberately does NOT get this:
-- the intended flow is manager requests -> Administrator/FMS approves ->
-- purchasing -> receiving, and letting a manager add stock directly now would
-- build a bypass around a workflow that does not exist yet. The standalone POS
-- gated this on `admin OR manager`, which is exactly the rule not to copy.
--
-- Concurrency: SELECT ... FOR UPDATE takes a row lock, so a second caller for
-- the same branch/product waits rather than reading a stale quantity. The
-- balance update and the movement insert are in the same transaction (the
-- function body), so a failure leaves neither.
create or replace function public.receive_pos_stock(
  _branch_id uuid,
  _product_id uuid,
  _quantity integer,
  _unit_cost numeric,
  _notes text default null
)
returns public.pos_branch_inventory
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := (select auth.uid());
  _row public.pos_branch_inventory%rowtype;
  _updated public.pos_branch_inventory%rowtype;
  _new_average numeric(12,2);
begin
  if _actor is null or not public.is_admin() then
    raise exception 'Only an Administrator can receive stock';
  end if;
  if _quantity is null or _quantity <= 0 then
    raise exception 'Received quantity must be positive';
  end if;
  if _unit_cost is null or _unit_cost < 0 then
    raise exception 'Unit cost must be zero or greater';
  end if;
  if _notes is not null and char_length(btrim(_notes)) > 500 then
    raise exception 'Notes must be 500 characters or fewer';
  end if;

  select * into _row
  from public.pos_branch_inventory i
  where i.branch_id = _branch_id and i.product_id = _product_id
  for update;
  if not found then
    raise exception 'That product is not carried at this branch';
  end if;

  -- Weighted average over what this branch holds. First receipt (or a branch
  -- back at zero) takes the received price outright, which also avoids a
  -- division by zero.
  _new_average := case
    when _row.quantity_on_hand = 0 then round(_unit_cost, 2)
    else round(
      ((_row.quantity_on_hand * _row.average_unit_cost) + (_quantity * _unit_cost))
      / (_row.quantity_on_hand + _quantity),
      2
    )
  end;

  perform set_config('harmony.pos_inventory_write', 'allowed', true);
  update public.pos_branch_inventory
  set quantity_on_hand = _row.quantity_on_hand + _quantity,
      average_unit_cost = _new_average
  where branch_id = _branch_id and product_id = _product_id
  returning * into _updated;
  perform set_config('harmony.pos_inventory_write', '', true);

  insert into public.pos_inventory_movements (
    branch_id, product_id, movement_type, quantity_change,
    stock_before, stock_after, unit_cost, source_type, source_id, notes, actor_id
  ) values (
    _branch_id, _product_id, 'receipt', _quantity,
    _row.quantity_on_hand, _updated.quantity_on_hand, round(_unit_cost, 2),
    -- Set here, not accepted from the caller. A browser cannot claim to be an
    -- FMS receipt.
    'manual_receiving', null, nullif(btrim(_notes), ''), _actor
  );

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    _actor, 'POS Stock Received', 'pos_branch_inventory', _product_id,
    jsonb_build_object('quantity_on_hand', _row.quantity_on_hand,
                       'average_unit_cost', _row.average_unit_cost),
    jsonb_build_object('branch_id', _branch_id,
                       'quantity_received', _quantity,
                       'unit_cost', round(_unit_cost, 2),
                       'quantity_on_hand', _updated.quantity_on_hand,
                       'average_unit_cost', _updated.average_unit_cost)
  );

  return _updated;
end;
$$;

-- Correcting stock.
--
-- An adjustment moves quantity without any purchase having happened, so it
-- deliberately does NOT touch average_unit_cost: inventing a cost for stock
-- nobody bought would corrupt the valuation that Phase 5 will snapshot as
-- COGS. Found stock enters at the branch's current average; lost stock leaves
-- at it. The total value moves, the per-unit value does not.
create or replace function public.adjust_pos_stock(
  _branch_id uuid,
  _product_id uuid,
  _quantity_change integer,
  _reason text,
  _notes text default null
)
returns public.pos_branch_inventory
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := (select auth.uid());
  _row public.pos_branch_inventory%rowtype;
  _updated public.pos_branch_inventory%rowtype;
  _type public.pos_movement_type;
begin
  if _actor is null or not public.is_admin() then
    raise exception 'Only an Administrator can adjust stock';
  end if;
  if _quantity_change is null or _quantity_change = 0 then
    raise exception 'An adjustment cannot be zero';
  end if;
  if _reason is null or _reason not in ('recount', 'damaged', 'expired', 'lost', 'found') then
    raise exception 'Invalid adjustment reason';
  end if;
  if _notes is not null and char_length(btrim(_notes)) > 500 then
    raise exception 'Notes must be 500 characters or fewer';
  end if;

  select * into _row
  from public.pos_branch_inventory i
  where i.branch_id = _branch_id and i.product_id = _product_id
  for update;
  if not found then
    raise exception 'That product is not carried at this branch';
  end if;

  if _row.quantity_on_hand + _quantity_change < 0 then
    raise exception 'That adjustment would leave % units, which is below zero',
      _row.quantity_on_hand + _quantity_change;
  end if;

  _type := case when _quantity_change > 0 then 'adjustment_in' else 'adjustment_out' end;

  perform set_config('harmony.pos_inventory_write', 'allowed', true);
  update public.pos_branch_inventory
  set quantity_on_hand = _row.quantity_on_hand + _quantity_change
  where branch_id = _branch_id and product_id = _product_id
  returning * into _updated;
  perform set_config('harmony.pos_inventory_write', '', true);

  insert into public.pos_inventory_movements (
    branch_id, product_id, movement_type, quantity_change,
    stock_before, stock_after, unit_cost, source_type, source_id, notes, actor_id
  ) values (
    _branch_id, _product_id, _type, _quantity_change,
    _row.quantity_on_hand, _updated.quantity_on_hand,
    -- No unit cost: nothing was bought.
    null, 'manual_adjustment', null,
    nullif(btrim(coalesce(_reason || case when _notes is null then '' else ' -- ' || btrim(_notes) end, '')), ''),
    _actor
  );

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    _actor, 'POS Stock Adjusted', 'pos_branch_inventory', _product_id,
    jsonb_build_object('quantity_on_hand', _row.quantity_on_hand),
    jsonb_build_object('branch_id', _branch_id, 'quantity_change', _quantity_change,
                       'reason', _reason, 'quantity_on_hand', _updated.quantity_on_hand)
  );

  return _updated;
end;
$$;

-- The one inventory write a POS Manager holds. It moves no quantity and no
-- valuation -- the guard trigger would refuse it if it tried.
create or replace function public.set_low_stock_threshold(
  _branch_id uuid,
  _product_id uuid,
  _threshold integer
)
returns public.pos_branch_inventory
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := (select auth.uid());
  _updated public.pos_branch_inventory%rowtype;
begin
  if _actor is null
     or not public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  then
    raise exception 'Only an Administrator or the branch POS Manager can set a low-stock level';
  end if;
  if _threshold is null or _threshold < 0 then
    raise exception 'A low-stock level cannot be negative';
  end if;

  update public.pos_branch_inventory
  set low_stock_threshold = _threshold
  where branch_id = _branch_id and product_id = _product_id
  returning * into _updated;
  if not found then
    raise exception 'That product is not carried at this branch';
  end if;

  return _updated;
end;
$$;

-- ------------------------------------------------------- catalogue, extended
--
-- Replaces the Phase 3 version. Gains quantity, still declares no cost column.
--
-- `available_quantity` rather than `quantity_on_hand`: the name is the caller's
-- contract, so Phase 5 can subtract reservations without every consumer
-- changing. `is_low_stock` is computed here so the numeric threshold never
-- reaches a till.
--
-- Dropped first: CREATE OR REPLACE cannot change a function's return type, and
-- this adds two columns to the TABLE signature. The grants are re-issued at the
-- end of this migration, since dropping takes them with it.
drop function if exists public.get_pos_catalogue(uuid);

create function public.get_pos_catalogue(_branch_id uuid)
returns table (
  product_id uuid,
  name text,
  category_id uuid,
  category_name text,
  selling_price numeric,
  image_path text,
  available_quantity integer,
  is_low_stock boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.category_id,
    c.name,
    coalesce(bp.selling_price_override, p.default_selling_price),
    p.image_path,
    coalesce(i.quantity_on_hand, 0),
    coalesce(i.quantity_on_hand, 0) <= coalesce(i.low_stock_threshold, 0)
  from public.pos_branch_products bp
  join public.pos_products p on p.id = bp.product_id
  join public.pos_product_categories c on c.id = p.category_id
  left join public.pos_branch_inventory i
    on i.branch_id = bp.branch_id and i.product_id = bp.product_id
  where bp.branch_id = _branch_id
    and bp.is_available
    and p.status = 'active'
    and public.has_pos_role(_branch_id, array['manager', 'cashier']::public.pos_role[])
  order by c.sort_order, c.name, p.name;
$$;

-- ------------------------------------------------------------------- grants
--
-- BOTH revokes, every time. PUBLIC holds EXECUTE on a new function by default
-- (20260825030000) and this database has also granted anon explicitly through
-- ALTER DEFAULT PRIVILEGES (20260813010000). Neither revoke alone is enough,
-- and the contract test asserts the result with has_function_privilege()
-- rather than trusting these lines.

revoke all on function public.get_branch_inventory(uuid) from public, anon;
revoke all on function public.get_branch_movements(uuid, integer) from public, anon;
revoke all on function public.get_branch_movements_with_cost(uuid, integer) from public, anon;
revoke all on function public.receive_pos_stock(uuid, uuid, integer, numeric, text) from public, anon;
revoke all on function public.adjust_pos_stock(uuid, uuid, integer, text, text) from public, anon;
revoke all on function public.set_low_stock_threshold(uuid, uuid, integer) from public, anon;
revoke all on function public.get_pos_catalogue(uuid) from public, anon;
revoke all on function public.create_branch_inventory_row() from public, anon;
revoke all on function public.guard_pos_inventory_write() from public, anon;

grant execute on function public.get_branch_inventory(uuid) to authenticated, service_role;
grant execute on function public.get_branch_movements(uuid, integer) to authenticated, service_role;
grant execute on function public.get_branch_movements_with_cost(uuid, integer) to authenticated, service_role;
grant execute on function public.receive_pos_stock(uuid, uuid, integer, numeric, text) to authenticated, service_role;
grant execute on function public.adjust_pos_stock(uuid, uuid, integer, text, text) to authenticated, service_role;
grant execute on function public.set_low_stock_threshold(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.get_pos_catalogue(uuid) to authenticated, service_role;

-- Existing branch-product rows predate the auto-create trigger, so give them
-- their zero balance now. Quantity 0 and cost 0: this back-fill creates no
-- stock and no valuation, and writes no movement, because nothing moved.
insert into public.pos_branch_inventory (branch_id, product_id)
select bp.branch_id, bp.product_id from public.pos_branch_products bp
on conflict (branch_id, product_id) do nothing;
