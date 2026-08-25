-- The POS Manager's operational dashboard, and their read-only view of the
-- enterprise category taxonomy.
--
-- Everything here is operational: what was sold, what was taken, what is
-- running out. No cost, no COGS, no margin, no profit -- and not by hiding
-- them in React. None of these signatures declares such a column, so there is
-- nothing on the wire to strip. The standalone POS put "Today's Net Profit" on
-- the manager's first screen and gated the whole dashboard query on
-- canViewProfit; that decision is deliberately not carried over.
--
-- Four separate typed functions rather than one returning jsonb. A jsonb return
-- would make the cost-safety contract test impossible: it asserts against
-- pg_get_function_result, and "no cost column" is only a checkable claim while
-- the columns are declared.
--
-- Every one is gated by has_pos_role(_branch_id, ['manager']) -- per branch, so
-- an account that manages Cavite and cashiers at Main Office gets Cavite and
-- nothing else. is_admin() is deliberately NOT an alternative branch here: an
-- Administrator's POS dashboard, if one is ever wanted, belongs under
-- /dashboard/* and gets its own decision.

-- --------------------------------------------------------- the day's figures
--
-- One row for an authorised manager, zero rows for anyone else. The manager
-- test sits in the outer WHERE over pos_day_bounds' single row, because bare
-- aggregates always return a row -- without it, an unauthorised caller would
-- receive a tidy page of zeroes instead of nothing.
create or replace function public.get_pos_dashboard_summary(
  _branch_id uuid,
  _on_date date default null
)
returns table (
  business_date date,
  sales_collected numeric,
  product_sales numeric,
  fees_collected numeric,
  transaction_count integer,
  items_sold integer,
  average_sale numeric,
  low_stock_count integer,
  out_of_stock_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.business_date,
    -- Three figures, named for what they are. The standalone called subtotal
    -- "Net Sales" on the headline card and never showed what the customer
    -- actually paid, which understates the day at any branch charging a fee.
    t.sales_collected,
    t.product_sales,
    t.fees_collected,
    t.transaction_count,
    u.items_sold,
    round(t.sales_collected / nullif(t.transaction_count, 0), 2),
    k.low_stock_count,
    k.out_of_stock_count
  from public.pos_day_bounds(_on_date) b
  left join lateral (
    select
      coalesce(sum(s.total_amount), 0)::numeric as sales_collected,
      coalesce(sum(s.subtotal), 0)::numeric     as product_sales,
      coalesce(sum(s.fees_total), 0)::numeric   as fees_collected,
      count(*)::integer                         as transaction_count
    from public.pos_sales s
    where s.branch_id = _branch_id
      -- Only completed sales count. pos_sale_status holds one label today, so
      -- this is a no-op now and correct the moment a void or refund arrives.
      and s.status = 'completed'
      and s.created_at >= b.day_start
      and s.created_at <  b.day_end
  ) t on true
  left join lateral (
    -- Units, not lines. Phase 6 found this exact bug in item_count: the till
    -- increments an existing line rather than appending one, so count(*) makes
    -- a three-bottle sale look like one item.
    select coalesce(sum(i.quantity), 0)::integer as items_sold
    from public.pos_sales s
    join public.pos_sale_items i on i.sale_id = s.id
    where s.branch_id = _branch_id
      and s.status = 'completed'
      and s.created_at >= b.day_start
      and s.created_at <  b.day_end
  ) u on true
  left join lateral (
    -- Point-in-time, not day-scoped: these two answer "what is running out
    -- right now", which is why they carry no date.
    --
    -- Disjoint by construction, mirroring what the two inventory pages already
    -- render: zero is Out of stock, and Low means some but not enough. The
    -- shipped is_low_stock contract (quantity <= threshold, true at zero) is
    -- left exactly as it is -- three pages consume it.
    select
      count(*) filter (
        where coalesce(inv.quantity_on_hand, 0) > 0
          and coalesce(inv.quantity_on_hand, 0) <= coalesce(inv.low_stock_threshold, 0)
      )::integer as low_stock_count,
      count(*) filter (where coalesce(inv.quantity_on_hand, 0) = 0)::integer as out_of_stock_count
    from public.pos_branch_products bp
    join public.pos_products p on p.id = bp.product_id
    left join public.pos_branch_inventory inv
      on inv.branch_id = bp.branch_id and inv.product_id = bp.product_id
    where bp.branch_id = _branch_id
      -- An alert only makes sense for something the branch is actually
      -- selling: a paused line or an archived product is not a stock problem.
      and bp.is_available
      and p.status = 'active'
  ) k on true
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[]);
$$;

-- ------------------------------------------------------ how it was paid for
--
-- Customer payment totals. A manual GCash or Maya reference is what the cashier
-- typed, not settlement confirmed by anyone -- nothing here should be read as
-- reconciled, and no reconciliation is attempted.
create or replace function public.get_pos_dashboard_payment_totals(
  _branch_id uuid,
  _on_date date default null
)
returns table (
  payment_method text,
  transaction_count integer,
  amount_collected numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.payment_method,
    count(*)::integer,
    coalesce(sum(s.total_amount), 0)::numeric
  from public.pos_day_bounds(_on_date) b
  join public.pos_sales s
    on s.branch_id = _branch_id
   and s.status = 'completed'
   and s.created_at >= b.day_start
   and s.created_at <  b.day_end
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  group by s.payment_method
  order by coalesce(sum(s.total_amount), 0) desc, s.payment_method;
$$;

-- ------------------------------------------------------------- what moved
--
-- Ranked by quantity sold, which is what the standalone ranked by and what a
-- branch manager restocks against. Profit is not available as a ranking metric
-- because it is not in the signature.
create or replace function public.get_pos_dashboard_top_products(
  _branch_id uuid,
  _on_date date default null,
  _limit integer default 5
)
returns table (
  product_id uuid,
  product_name text,
  quantity_sold integer,
  sales_amount numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.product_id,
    -- Grouped by the enterprise product, never by the snapshot name. A product
    -- renamed mid-period leaves two different product_name snapshots behind;
    -- grouping by name would split one product into two ranked rows, each
    -- understating the other. The name shown is the most recent snapshot, so
    -- the card reads as the branch last saw it.
    (array_agg(i.product_name order by s.created_at desc, i.created_at desc))[1],
    coalesce(sum(i.quantity), 0)::integer,
    -- Historical line totals. Re-pricing a product tomorrow must not rewrite
    -- what today earned.
    coalesce(sum(i.line_total), 0)::numeric
  from public.pos_day_bounds(_on_date) b
  join public.pos_sales s
    on s.branch_id = _branch_id
   and s.status = 'completed'
   and s.created_at >= b.day_start
   and s.created_at <  b.day_end
  join public.pos_sale_items i on i.sale_id = s.id
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  group by i.product_id
  order by coalesce(sum(i.quantity), 0) desc,
           (array_agg(i.product_name order by s.created_at desc, i.created_at desc))[1]
  limit public.pos_page_size(_limit);
$$;

-- ---------------------------------------------- the branch's own catalogue
--
-- An operational summary organised by the enterprise taxonomy, NOT a taxonomy
-- editor. Phase 3 made categories global: pos_product_categories carries a
-- single is_admin() policy, delete_pos_category and reorder_pos_category check
-- is_admin() internally, and protect_general_pos_category guards General. The
-- standalone POS gave managers create/rename/archive/reorder and a bulk
-- product-move picker; none of that is ported, and nothing here widens a
-- policy. This is why the counts arrive as an aggregate rather than by letting
-- managers read the tables and tally in React.
--
-- Which categories appear: every active one -- so the taxonomy the branch is
-- filed under stays legible, zero-count rows included -- plus any inactive
-- category the branch still carries an active product in, so a retired
-- category holding live stock cannot go invisible. is_active is returned so
-- those can be labelled rather than silently mixed in.
create or replace function public.get_branch_category_summary(_branch_id uuid)
returns table (
  category_id uuid,
  name text,
  description text,
  color text,
  icon text,
  sort_order integer,
  is_active boolean,
  product_count integer,
  offered_count integer,
  low_stock_count integer,
  out_of_stock_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_active,
    n.product_count, n.offered_count, n.low_stock_count, n.out_of_stock_count
  from public.pos_product_categories c
  left join lateral (
    select
      count(*)::integer as product_count,
      count(*) filter (where bp.is_available)::integer as offered_count,
      count(*) filter (
        where bp.is_available
          and coalesce(inv.quantity_on_hand, 0) > 0
          and coalesce(inv.quantity_on_hand, 0) <= coalesce(inv.low_stock_threshold, 0)
      )::integer as low_stock_count,
      count(*) filter (
        where bp.is_available and coalesce(inv.quantity_on_hand, 0) = 0
      )::integer as out_of_stock_count
    from public.pos_branch_products bp
    join public.pos_products p on p.id = bp.product_id
    left join public.pos_branch_inventory inv
      on inv.branch_id = bp.branch_id and inv.product_id = bp.product_id
    where bp.branch_id = _branch_id
      -- Draft and archived products are not operational. Letting them count
      -- would inflate a branch's catalogue with things it cannot sell.
      and p.status = 'active'
      and p.category_id = c.id
  ) n on true
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
    and (c.is_active or n.product_count > 0)
  order by c.sort_order, c.name;
$$;

-- Both revokes on every one. The default-privilege rule grants anon and
-- authenticated on new routines in public, PostgreSQL grants PUBLIC EXECUTE,
-- and this project has been caught by that five times. The contract test
-- asserts has_function_privilege rather than trusting these lines.
revoke all on function public.get_pos_dashboard_summary(uuid, date) from public, anon;
revoke all on function public.get_pos_dashboard_payment_totals(uuid, date) from public, anon;
revoke all on function public.get_pos_dashboard_top_products(uuid, date, integer) from public, anon;
revoke all on function public.get_branch_category_summary(uuid) from public, anon;
grant execute on function public.get_pos_dashboard_summary(uuid, date) to authenticated;
grant execute on function public.get_pos_dashboard_payment_totals(uuid, date) to authenticated;
grant execute on function public.get_pos_dashboard_top_products(uuid, date, integer) to authenticated;
grant execute on function public.get_branch_category_summary(uuid) to authenticated;
