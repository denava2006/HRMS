-- Phase 7C: the POS operational audit stream.
--
-- A narrow, bounded event log for POS configuration and catalogue changes --
-- NOT a second generic enterprise audit system, and NOT a duplicate of the
-- domain ledgers.
--
-- Why a dedicated table rather than public.audit_logs:
--
--   audit_logs has no branch column, no domain discriminator, and unrestricted
--   old_data/new_data JSONB written by five different subsystems. One of those
--   writers (receive_pos_stock) already puts average_unit_cost into it. Making
--   it Manager-readable would mean maintaining a safe projection over free-form
--   JSON forever, and every future writer anywhere in HRMS would become a
--   potential cost leak into the POS. It stays Administrator-only and
--   unchanged. Nothing is backfilled.
--
-- What is NOT audited here, on purpose:
--
--   Ordinary checkout, ordinary stock receiving and ordinary stock adjustment.
--   pos_sales / pos_sale_items and pos_inventory_movements are already
--   immutable, actor-attributed ledgers carrying before/after quantities and
--   provenance. A parallel event would duplicate them and grow at transaction
--   volume while adding nothing. Threshold changes ARE audited, because a
--   threshold is configuration, not movement.
--
--   Reads of any kind. Dashboards, reports, transaction lists and receipts
--   leave no audit trail in this phase.
--
-- Confidentiality model. Manager safety does not come from scanning text for
-- forbidden words -- that is a filter, not a boundary. It comes from:
--
--   1. a constrained event taxonomy (enum, not free text)
--   2. trusted writers only (owner-only writer; no client INSERT path exists)
--   3. physically separate manager-safe and administrator-only columns
--   4. a Manager RPC that projects only the safe columns
--   5. contract inspection of the Manager reader's and every writer's
--      definition for cost/COGS/profit/margin/valuation identifiers
--
-- CHECK constraints below enforce structure, length and event invariants.
-- They are not the confidentiality boundary.

-- ------------------------------------------------------------------- enums

create type public.pos_audit_event_type as enum (
  -- Manager-visible: branch operations a manager is accountable for.
  'fees_changed',
  'payment_qr_updated',
  'payment_qr_removed',
  'branch_product_added',
  'branch_product_removed',
  'branch_selling_price_changed',
  'product_offered',
  'product_stopped',
  'low_stock_threshold_changed',
  -- Administrator-only: enterprise catalogue and access administration.
  'assignment_granted',
  'assignment_revoked',
  'product_created',
  'product_updated',
  'product_archived',
  'product_restored',
  'category_created',
  'category_updated',
  'category_archived',
  'category_restored',
  'category_reordered',
  'category_deleted'
);

create type public.pos_audit_entity_type as enum (
  'branch_assignment',
  'branch_settings',
  'product',
  'category',
  'branch_product',
  'inventory_threshold'
);

-- The allowlist that decides manager_visible. A single source of truth, so the
-- table constraint and the writer cannot disagree.
create or replace function public.pos_audit_is_manager_visible(
  _event_type public.pos_audit_event_type
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select _event_type in (
    'fees_changed',
    'payment_qr_updated',
    'payment_qr_removed',
    'branch_product_added',
    'branch_product_removed',
    'branch_selling_price_changed',
    'product_offered',
    'product_stopped',
    'low_stock_threshold_changed'
  );
$$;

-- ------------------------------------------------------------------- table

create table public.pos_audit_events (
  id uuid primary key default gen_random_uuid(),

  -- Null for enterprise-wide catalogue and access events. Those are
  -- Administrator-only and are NOT fanned out to the branches that happen to
  -- carry the product today -- that would invent a branch scope the action did
  -- not have.
  branch_id uuid references public.branches(id) on delete restrict,

  event_type public.pos_audit_event_type not null,
  entity_type public.pos_audit_entity_type not null,
  -- Plain uuid, not a foreign key: history must survive the row it describes.
  entity_id uuid,

  actor_id uuid not null,
  actor_name_snapshot text not null,
  -- TWO role columns, because POS role is branch-scoped and enterprise role is
  -- not. One text column would blur "the Administrator did this" and "the
  -- branch manager did this", and could not express a Manager@A / Cashier@B
  -- account acting at B at all.
  actor_enterprise_role public.user_role not null,
  actor_pos_role public.pos_role,

  branch_name_snapshot text,
  entity_name_snapshot text,

  manager_visible boolean not null,

  -- Manager-safe fields. Never populated for an Administrator-only event.
  safe_old_value text,
  safe_new_value text,

  -- Administrator fields. Always present.
  admin_description text not null,
  admin_old_value text,
  admin_new_value text,

  created_at timestamptz not null default now(),

  -- Structure and invariants.
  constraint pos_audit_visibility_matches_taxonomy
    check (manager_visible = public.pos_audit_is_manager_visible(event_type)),
  -- A manager-visible event without a branch could not be scoped to anyone.
  constraint pos_audit_manager_events_are_branch_scoped
    check (not manager_visible or branch_id is not null),
  -- The safe columns exist for manager-visible events only. An
  -- Administrator-only event physically cannot carry a manager-readable value.
  constraint pos_audit_safe_values_require_visibility
    check (manager_visible or (safe_old_value is null and safe_new_value is null)),
  constraint pos_audit_lengths
    check (
      length(actor_name_snapshot) between 1 and 200
      and (branch_name_snapshot is null or length(branch_name_snapshot) <= 200)
      and (entity_name_snapshot is null or length(entity_name_snapshot) <= 200)
      and length(admin_description) between 1 and 500
      and (safe_old_value is null or length(safe_old_value) <= 200)
      and (safe_new_value is null or length(safe_new_value) <= 200)
      and (admin_old_value is null or length(admin_old_value) <= 500)
      and (admin_new_value is null or length(admin_new_value) <= 500)
    )
);

comment on table public.pos_audit_events is
  'Append-only POS operational audit. No client may read or write it directly; '
  'reads go through get_pos_manager_audit_events / get_admin_pos_audit_events.';

-- Deterministic ordering is (created_at desc, id desc) everywhere, so every
-- index carries the tiebreaker.
create index pos_audit_events_recent_idx
  on public.pos_audit_events (created_at desc, id desc);
create index pos_audit_events_branch_idx
  on public.pos_audit_events (branch_id, created_at desc, id desc);
create index pos_audit_events_manager_idx
  on public.pos_audit_events (branch_id, created_at desc, id desc)
  where manager_visible;
create index pos_audit_events_type_idx
  on public.pos_audit_events (event_type, created_at desc, id desc);
create index pos_audit_events_actor_idx
  on public.pos_audit_events (actor_id, created_at desc, id desc);
create index pos_audit_events_entity_idx
  on public.pos_audit_events (entity_type, entity_id, created_at desc, id desc);

-- ------------------------------------------------------------- append-only
--
-- Two guards, because they stop different things. The row trigger stops
-- UPDATE and DELETE. It does NOT stop TRUNCATE -- TRUNCATE fires only
-- statement-level triggers and bypasses RLS entirely, which is exactly the
-- defect 20260826030000 was written to close. Belt and braces.

create or replace function public.pos_audit_events_are_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'pos_audit_events is append-only';
end;
$$;

create trigger trg_pos_audit_events_no_update
  before update on public.pos_audit_events
  for each row execute function public.pos_audit_events_are_append_only();

create trigger trg_pos_audit_events_no_delete
  before delete on public.pos_audit_events
  for each row execute function public.pos_audit_events_are_append_only();

-- The documented maintenance path: fixture cleanup and any future retention
-- migration run as the table owner with this set. Nothing reachable from an
-- API role can set it, because nothing reachable from an API role can delete.
create or replace function public.pos_audit_events_no_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('harmony.pos_audit_maintenance', true), '') <> 'allowed' then
    raise exception 'pos_audit_events is append-only: TRUNCATE is not permitted';
  end if;
  return null;
end;
$$;

create trigger trg_pos_audit_events_no_truncate
  before truncate on public.pos_audit_events
  for each statement execute function public.pos_audit_events_no_truncate();

-- ------------------------------------------------------------------ writer
--
-- The only way a row is created. It derives the actor from auth.uid() and the
-- visibility from the taxonomy; a caller cannot supply either, nor the
-- timestamp, nor the branch name. Not reachable from any API role.
create or replace function public.pos_audit_write(
  _event_type public.pos_audit_event_type,
  _entity_type public.pos_audit_entity_type,
  _entity_id uuid,
  _branch_id uuid,
  _entity_name text,
  _admin_description text,
  _admin_old text default null,
  _admin_new text default null,
  _safe_old text default null,
  _safe_new text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor    uuid := (select auth.uid());
  _profile  public.profiles%rowtype;
  _pos_role public.pos_role;
  _visible  boolean := public.pos_audit_is_manager_visible(_event_type);
begin
  -- Database-owner fixture and migration work has no authenticated actor.
  -- Rather than inventing a 'system' actor -- which would be a lie about who
  -- acted, and a name a future FMS integration would then have to disambiguate
  -- -- no event is written at all. Phase 7C audits people.
  if _actor is null then
    return;
  end if;

  select * into _profile from public.profiles where id = _actor;
  if _profile.id is null then
    return;
  end if;

  -- The POS role held AT THIS BRANCH at the time of the event. Null for an
  -- Administrator (who holds no assignment) and for enterprise-wide events.
  if _branch_id is not null then
    select a.pos_role into _pos_role
    from public.pos_branch_assignments a
    where a.profile_id = _actor and a.branch_id = _branch_id and a.status = 'active'
    limit 1;
  end if;

  insert into public.pos_audit_events (
    branch_id, event_type, entity_type, entity_id,
    actor_id, actor_name_snapshot, actor_enterprise_role, actor_pos_role,
    branch_name_snapshot, entity_name_snapshot, manager_visible,
    safe_old_value, safe_new_value,
    admin_description, admin_old_value, admin_new_value
  )
  values (
    _branch_id, _event_type, _entity_type, _entity_id,
    _actor,
    -- Snapshots, so renaming a person, branch, product or category later does
    -- not rewrite what the history says happened.
    coalesce(nullif(btrim(_profile.full_name), ''), 'Unknown'),
    _profile.role,
    _pos_role,
    (select b.name from public.branches b where b.id = _branch_id),
    nullif(btrim(_entity_name), ''),
    _visible,
    case when _visible then _safe_old end,
    case when _visible then _safe_new end,
    _admin_description, _admin_old, _admin_new
  );
end;
$$;

-- ------------------------------------------------- formatting helpers

-- Fee summary: names and amounts, drawn from the known fee shape rather than
-- serialising whatever the column happens to hold.
create or replace function public.pos_audit_fee_summary(_fees jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      (select string_agg(
                coalesce(f->>'label', f->>'name', 'Fee') || ' ' ||
                coalesce(f->>'amount', f->>'value', '?'),
                ', ' order by ordinal)
       from jsonb_array_elements(coalesce(_fees, '[]'::jsonb)) with ordinality as t(f, ordinal)),
      ''),
    'None');
$$;

create or replace function public.pos_audit_price_text(_price numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select case when _price is null then 'Default' else to_char(_price, 'FM999999990.00') end $$;

-- --------------------------------------------------- branch POS settings

create or replace function public.pos_audit_branch_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _old_fees jsonb := coalesce(case when tg_op = 'UPDATE' then old.fees end, '[]'::jsonb);
  _new_fees jsonb := coalesce(new.fees, '[]'::jsonb);
  _had_qr boolean := case when tg_op = 'UPDATE' then old.payment_qr_path is not null else false end;
  _has_qr boolean := new.payment_qr_path is not null;
begin
  if _old_fees is distinct from _new_fees then
    perform public.pos_audit_write(
      'fees_changed', 'branch_settings', new.branch_id, new.branch_id, null,
      'Branch POS fees changed',
      -- Fee NAMES and amounts only. Never the raw settings row.
      public.pos_audit_fee_summary(_old_fees), public.pos_audit_fee_summary(_new_fees),
      public.pos_audit_fee_summary(_old_fees), public.pos_audit_fee_summary(_new_fees)
    );
  end if;

  -- The event describes the committed configuration transition, never the
  -- storage path. A path is an object location, not information a reader needs.
  if _has_qr and not _had_qr then
    perform public.pos_audit_write(
      'payment_qr_updated', 'branch_settings', new.branch_id, new.branch_id, null,
      'Payment QR configured', 'Not configured', 'Configured',
      'Not configured', 'Configured');
  elsif _has_qr and _had_qr and old.payment_qr_path is distinct from new.payment_qr_path then
    perform public.pos_audit_write(
      'payment_qr_updated', 'branch_settings', new.branch_id, new.branch_id, null,
      'Payment QR replaced', 'Configured', 'Configured',
      'Configured', 'Configured');
  elsif _had_qr and not _has_qr then
    perform public.pos_audit_write(
      'payment_qr_removed', 'branch_settings', new.branch_id, new.branch_id, null,
      'Payment QR removed', 'Configured', 'Not configured',
      'Configured', 'Not configured');
  end if;

  return null;
end;
$$;

create trigger trg_pos_audit_branch_settings
  after insert or update on public.branch_pos_settings
  for each row execute function public.pos_audit_branch_settings();

-- ------------------------------------------------------- POS assignments

create or replace function public.pos_audit_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _target text;
begin
  select coalesce(nullif(btrim(p.full_name), ''), 'Unknown') into _target
  from public.profiles p where p.id = new.profile_id;

  if tg_op = 'INSERT' and new.status = 'active' then
    perform public.pos_audit_write(
      'assignment_granted', 'branch_assignment', new.id, new.branch_id, _target,
      'POS access granted', null, new.pos_role::text);
  elsif tg_op = 'UPDATE' and old.status = 'active' and new.status <> 'active' then
    -- The transition, not every update. Re-saving an already-inactive
    -- assignment is not a revocation.
    perform public.pos_audit_write(
      'assignment_revoked', 'branch_assignment', new.id, new.branch_id, _target,
      'POS access revoked', old.pos_role::text, null);
  end if;
  return null;
end;
$$;

create trigger trg_pos_audit_assignment
  after insert or update on public.pos_branch_assignments
  for each row execute function public.pos_audit_assignment();

-- --------------------------------------------------------- branch catalogue

create or replace function public.pos_audit_branch_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _name text;
  _row  public.pos_branch_products%rowtype := coalesce(new, old);
begin
  select p.name into _name from public.pos_products p where p.id = _row.product_id;

  if tg_op = 'INSERT' then
    perform public.pos_audit_write(
      'branch_product_added', 'branch_product', _row.product_id, _row.branch_id, _name,
      'Branch started carrying a product', null, 'Carried', null, 'Carried');
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.pos_audit_write(
      'branch_product_removed', 'branch_product', _row.product_id, _row.branch_id, _name,
      'Branch stopped carrying a product', 'Carried', null, 'Carried', null);
    return null;
  end if;

  -- UPDATE: one event per thing that actually changed, and nothing when
  -- nothing did.
  if old.is_available is distinct from new.is_available then
    if new.is_available then
      perform public.pos_audit_write(
        'product_offered', 'branch_product', new.product_id, new.branch_id, _name,
        'Product offered at this branch', 'Stopped', 'Offered', 'Stopped', 'Offered');
    else
      perform public.pos_audit_write(
        'product_stopped', 'branch_product', new.product_id, new.branch_id, _name,
        'Product stopped at this branch', 'Offered', 'Stopped', 'Offered', 'Stopped');
    end if;
  end if;

  if old.selling_price_override is distinct from new.selling_price_override then
    -- The one intentionally money-bearing manager-safe value in the whole
    -- stream. A SELLING price -- what the customer pays -- never a cost, a
    -- margin or a valuation.
    perform public.pos_audit_write(
      'branch_selling_price_changed', 'branch_product', new.product_id, new.branch_id, _name,
      'Branch selling price changed',
      public.pos_audit_price_text(old.selling_price_override),
      public.pos_audit_price_text(new.selling_price_override),
      public.pos_audit_price_text(old.selling_price_override),
      public.pos_audit_price_text(new.selling_price_override));
  end if;

  return null;
end;
$$;

create trigger trg_pos_audit_branch_product
  after insert or update or delete on public.pos_branch_products
  for each row execute function public.pos_audit_branch_product();

-- ------------------------------------------------------ low-stock threshold
--
-- Configuration, not movement. Quantity changes belong to
-- pos_inventory_movements and are deliberately not duplicated here.
create or replace function public.pos_audit_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _name text;
begin
  if old.low_stock_threshold is not distinct from new.low_stock_threshold then
    return null;
  end if;
  select p.name into _name from public.pos_products p where p.id = new.product_id;
  perform public.pos_audit_write(
    'low_stock_threshold_changed', 'inventory_threshold', new.product_id, new.branch_id, _name,
    'Low-stock level changed',
    old.low_stock_threshold::text, new.low_stock_threshold::text,
    old.low_stock_threshold::text, new.low_stock_threshold::text);
  return null;
end;
$$;

create trigger trg_pos_audit_threshold
  after update on public.pos_branch_inventory
  for each row execute function public.pos_audit_threshold();

-- -------------------------------------------------------- product master
--
-- Administrator-only, enterprise-wide, branch_id null.
create or replace function public.pos_audit_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform public.pos_audit_write(
      'product_created', 'product', new.id, null, new.name,
      'Product created', null, new.name);
    return null;
  end if;

  -- Status transitions are their own events, and are not repeated as a
  -- generic "updated".
  if old.status is distinct from new.status then
    if new.status = 'archived' then
      perform public.pos_audit_write('product_archived', 'product', new.id, null, new.name,
        'Product archived', old.status::text, new.status::text);
    elsif old.status = 'archived' then
      perform public.pos_audit_write('product_restored', 'product', new.id, null, new.name,
        'Product restored', old.status::text, new.status::text);
    else
      perform public.pos_audit_write('product_updated', 'product', new.id, null, new.name,
        'Product status changed', old.status::text, new.status::text);
    end if;
  end if;

  -- An allowlist, so a future column cannot start being audited by accident.
  -- category_id is deliberately absent: a product moves category during a
  -- category deletion, and auditing it there would produce one event per
  -- product for a single administrator action. The category_deleted event
  -- records the move instead.
  if old.name is distinct from new.name then
    _changes := _changes || ('name ' || old.name || ' -> ' || new.name);
  end if;
  if old.default_selling_price is distinct from new.default_selling_price then
    _changes := _changes || ('selling price ' ||
      public.pos_audit_price_text(old.default_selling_price) || ' -> ' ||
      public.pos_audit_price_text(new.default_selling_price));
  end if;
  -- default_unit_cost is intentionally NOT recorded, not even in the
  -- Administrator fields. What a product costs is financial history and
  -- belongs to Reports and eventually FMS, not to an operational event
  -- stream that a Manager RPC reads from the same table.
  if old.default_unit_cost is distinct from new.default_unit_cost then
    _changes := _changes || 'buying cost changed';
  end if;

  if array_length(_changes, 1) is not null then
    perform public.pos_audit_write(
      'product_updated', 'product', new.id, null, new.name,
      'Product updated', null, array_to_string(_changes, '; '));
  end if;

  return null;
end;
$$;

create trigger trg_pos_audit_product
  after insert or update on public.pos_products
  for each row execute function public.pos_audit_product();

-- ------------------------------------------------------------- categories
--
-- The storm problem, solved structurally rather than with a suppression flag.
--
--   reorder_pos_category() rewrites EVERY category's sort_order in a loop, so
--   a row trigger would fire N times for one administrator action.
--   delete_pos_category() bulk-updates every product in the category.
--
-- The row trigger therefore ignores sort_order-only changes outright -- there
-- is no ordinary path that changes sort_order alone except a reorder -- and
-- the two RPCs emit exactly one aggregate event each. No caller-controlled
-- suppression exists: nothing a client can set changes whether an event is
-- written.
create or replace function public.pos_audit_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform public.pos_audit_write('category_created', 'category', new.id, null, new.name,
      'Category created', null, new.name);
    return null;
  end if;

  -- Structural suppression: a sort_order-only change is a reorder, and
  -- reorder_pos_category emits its own single aggregate event.
  if old.name is not distinct from new.name
     and old.description is not distinct from new.description
     and old.color is not distinct from new.color
     and old.icon is not distinct from new.icon
     and old.is_active is not distinct from new.is_active then
    return null;
  end if;

  if old.is_active is distinct from new.is_active then
    perform public.pos_audit_write(
      case when new.is_active then 'category_restored' else 'category_archived' end,
      'category', new.id, null, new.name,
      case when new.is_active then 'Category restored' else 'Category archived' end,
      case when old.is_active then 'Active' else 'Retired' end,
      case when new.is_active then 'Active' else 'Retired' end);
  end if;

  if old.name is distinct from new.name then
    _changes := _changes || ('name ' || old.name || ' -> ' || new.name);
  end if;
  if old.description is distinct from new.description then
    _changes := _changes || 'description changed';
  end if;
  if old.color is distinct from new.color or old.icon is distinct from new.icon then
    _changes := _changes || 'appearance changed';
  end if;

  if array_length(_changes, 1) is not null then
    perform public.pos_audit_write('category_updated', 'category', new.id, null, new.name,
      'Category updated', null, array_to_string(_changes, '; '));
  end if;

  return null;
end;
$$;

create trigger trg_pos_audit_category
  after insert or update on public.pos_product_categories
  for each row execute function public.pos_audit_category();

-- ------------------------------- category RPCs: one event, not a storm
--
-- Both are small (33 and 37 lines) and are replaced with their signatures
-- unchanged. Their existing behaviour is reproduced exactly; the only addition
-- is a single aggregate audit call at the end of a successful operation.

create or replace function public.reorder_pos_category(_category_id uuid, _direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  _ids uuid[];
  _index integer;
  _target integer;
  _swap uuid;
  _name text;
begin
  if not public.is_admin() then
    raise exception 'Only an Administrator can reorder categories';
  end if;
  if _direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1';
  end if;

  select array_agg(id order by sort_order, name) into _ids
  from public.pos_product_categories;

  _index := array_position(_ids, _category_id);
  if _index is null then
    raise exception 'Category not found';
  end if;

  _target := _index + _direction;
  if _target < 1 or _target > array_length(_ids, 1) then
    return; -- already at the end; a no-op rather than an error
  end if;

  _swap := _ids[_target];
  _ids[_target] := _ids[_index];
  _ids[_index] := _swap;

  for _index in 1 .. array_length(_ids, 1) loop
    update public.pos_product_categories
      set sort_order = _index
      where id = _ids[_index];
  end loop;

  -- One event for one administrator action. The row trigger ignores
  -- sort_order-only changes, so the N updates above stay silent.
  select name into _name from public.pos_product_categories where id = _category_id;
  perform public.pos_audit_write(
    'category_reordered', 'category', _category_id, null, _name,
    'Category order changed',
    null,
    'moved ' || case when _direction < 0 then 'up' else 'down' end ||
    '; order is now ' ||
    (select string_agg(c.name, ' > ' order by c.sort_order, c.name)
       from public.pos_product_categories c));
end;
$fn$;

create or replace function public.delete_pos_category(
  _category_id uuid,
  _replacement_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  _category public.pos_product_categories%rowtype;
  _replacement public.pos_product_categories%rowtype;
  _count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an Administrator can delete a category';
  end if;

  select * into _category from public.pos_product_categories where id = _category_id;
  if _category.id is null then
    raise exception 'Category not found';
  end if;
  if _category.normalized_name = 'general' then
    raise exception 'The General category is permanent and cannot be deleted';
  end if;

  select count(*) into _count from public.pos_products where category_id = _category_id;

  if _count > 0 then
    if _replacement_id is null or _replacement_id = _category_id then
      raise exception 'Choose where the % product(s) in this category should go', _count;
    end if;
    select * into _replacement from public.pos_product_categories where id = _replacement_id;
    if _replacement.id is null or not _replacement.is_active then
      raise exception 'The replacement category must exist and be active';
    end if;
    update public.pos_products set category_id = _replacement_id where category_id = _category_id;
  end if;

  delete from public.pos_product_categories where id = _category_id;

  -- One aggregate event recording what the bulk move did, rather than leaving
  -- it silent. The product trigger's allowlist excludes category_id precisely
  -- so that this is the only record of it.
  perform public.pos_audit_write(
    'category_deleted', 'category', _category_id, null, _category.name,
    'Category deleted',
    _category.name,
    case when _count > 0
      then _count || ' product(s) moved to ' || _replacement.name
      else 'no products were filed under it' end);
end;
$fn$;

-- ------------------------------------------------------- the manager reader
--
-- Projects the safe columns only. It never references admin_old_value /
-- admin_new_value, pos_products.default_unit_cost,
-- pos_branch_inventory.average_unit_cost, pos_sales.total_cogs or
-- public.audit_logs -- and a contract test asserts that against
-- pg_get_functiondef, not against this comment.
create or replace function public.get_pos_manager_audit_events(
  _branch_id uuid,
  _from_date date default null,
  _to_date date default null,
  _event_type public.pos_audit_event_type default null,
  _actor_id uuid default null,
  _entity_type public.pos_audit_entity_type default null,
  _limit integer default 25,
  _offset integer default 0
)
returns table (
  event_id uuid,
  occurred_at timestamptz,
  business_date date,
  event_type public.pos_audit_event_type,
  entity_type public.pos_audit_entity_type,
  entity_id uuid,
  actor_id uuid,
  actor_name text,
  branch_id uuid,
  branch_name text,
  entity_name text,
  old_value text,
  new_value text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    e.id,
    e.created_at,
    (e.created_at at time zone public.pos_business_timezone())::date,
    e.event_type,
    e.entity_type,
    e.entity_id,
    e.actor_id,
    e.actor_name_snapshot,
    e.branch_id,
    e.branch_name_snapshot,
    e.entity_name_snapshot,
    e.safe_old_value,
    e.safe_new_value,
    count(*) over ()
  from public.pos_report_bounds(_from_date, _to_date) b
  join public.pos_audit_events e
    on e.branch_id = _branch_id
   -- The whole confidentiality rule, in a predicate the caller cannot widen:
   -- no parameter exists that turns manager_visible off.
   and e.manager_visible
   and e.created_at >= b.period_start
   and e.created_at <  b.period_end
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
    and (_event_type is null or e.event_type = _event_type)
    and (_actor_id is null or e.actor_id = _actor_id)
    and (_entity_type is null or e.entity_type = _entity_type)
  order by e.created_at desc, e.id desc
  limit public.pos_page_size(_limit)
  offset greatest(0, coalesce(_offset, 0));
$fn$;

-- ------------------------------------------------- the administrator reader
--
-- Every POS event, branch-scoped or global. Still no raw JSON, no credentials
-- and no HR payload -- and no cost, because the writers never recorded any.
create or replace function public.get_admin_pos_audit_events(
  _branch_id uuid default null,
  _global_only boolean default false,
  _from_date date default null,
  _to_date date default null,
  _event_type public.pos_audit_event_type default null,
  _actor_id uuid default null,
  _entity_type public.pos_audit_entity_type default null,
  _limit integer default 25,
  _offset integer default 0
)
returns table (
  event_id uuid,
  occurred_at timestamptz,
  business_date date,
  event_type public.pos_audit_event_type,
  entity_type public.pos_audit_entity_type,
  entity_id uuid,
  actor_id uuid,
  actor_name text,
  actor_enterprise_role public.user_role,
  actor_pos_role public.pos_role,
  branch_id uuid,
  branch_name text,
  entity_name text,
  manager_visible boolean,
  description text,
  old_value text,
  new_value text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    e.id,
    e.created_at,
    (e.created_at at time zone public.pos_business_timezone())::date,
    e.event_type,
    e.entity_type,
    e.entity_id,
    e.actor_id,
    e.actor_name_snapshot,
    e.actor_enterprise_role,
    e.actor_pos_role,
    e.branch_id,
    e.branch_name_snapshot,
    e.entity_name_snapshot,
    e.manager_visible,
    e.admin_description,
    e.admin_old_value,
    e.admin_new_value,
    count(*) over ()
  from public.pos_report_bounds(_from_date, _to_date) b
  join public.pos_audit_events e
    on e.created_at >= b.period_start
   and e.created_at <  b.period_end
   -- Choosing a branch returns that branch only. Global catalogue and access
   -- events surface under "All POS" or the explicit global scope, never filed
   -- under a branch they did not happen at.
   and (
     case
       when _global_only then e.branch_id is null
       when _branch_id is not null then e.branch_id = _branch_id
       else true
     end
   )
  where public.is_admin()
    and (_event_type is null or e.event_type = _event_type)
    and (_actor_id is null or e.actor_id = _actor_id)
    and (_entity_type is null or e.entity_type = _entity_type)
  order by e.created_at desc, e.id desc
  limit public.pos_page_size(_limit)
  offset greatest(0, coalesce(_offset, 0));
$fn$;

-- ------------------------------------------------------------- RLS and ACL
--
-- The table is unreachable from every API role: no policies are defined, so
-- RLS denies by default, and the grants are removed outright so PostgREST
-- refuses before RLS is even consulted. Reads are RPC-only.
--
-- TRUNCATE is revoked at the table as well, even though 20260826030000 revoked
-- it from anon and authenticated generally -- here it also covers service_role,
-- and stating it locally makes the intent greppable from this file.
alter table public.pos_audit_events enable row level security;

revoke all on table public.pos_audit_events from public, anon, authenticated, service_role;

-- Writer and formatting helpers are internal. Nothing but the database calls them.
revoke all on function public.pos_audit_write(
  public.pos_audit_event_type, public.pos_audit_entity_type, uuid, uuid, text,
  text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.pos_audit_is_manager_visible(public.pos_audit_event_type)
  from public, anon, authenticated, service_role;
revoke all on function public.pos_audit_fee_summary(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.pos_audit_price_text(numeric)
  from public, anon, authenticated, service_role;

do $acl$
declare _fn text;
begin
  for _fn in select unnest(array[
    'public.pos_audit_events_are_append_only()',
    'public.pos_audit_events_no_truncate()',
    'public.pos_audit_branch_settings()',
    'public.pos_audit_assignment()',
    'public.pos_audit_branch_product()',
    'public.pos_audit_threshold()',
    'public.pos_audit_product()',
    'public.pos_audit_category()'
  ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', _fn);
  end loop;
end
$acl$;

-- The two readers, and nothing else.
revoke all on function public.get_pos_manager_audit_events(
  uuid, date, date, public.pos_audit_event_type, uuid,
  public.pos_audit_entity_type, integer, integer) from public, anon;
revoke all on function public.get_admin_pos_audit_events(
  uuid, boolean, date, date, public.pos_audit_event_type, uuid,
  public.pos_audit_entity_type, integer, integer) from public, anon;
grant execute on function public.get_pos_manager_audit_events(
  uuid, date, date, public.pos_audit_event_type, uuid,
  public.pos_audit_entity_type, integer, integer) to authenticated;
grant execute on function public.get_admin_pos_audit_events(
  uuid, boolean, date, date, public.pos_audit_event_type, uuid,
  public.pos_audit_entity_type, integer, integer) to authenticated;
