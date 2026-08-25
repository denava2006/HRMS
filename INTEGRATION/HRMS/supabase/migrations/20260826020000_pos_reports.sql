-- Phase 7B: POS reports.
--
-- Two audiences, two contracts:
--   * POS Managers receive operational figures for one branch they manage.
--   * Administrators receive financial figures across all branches or one.
--
-- The split is structural. Manager routines do not declare or reference cost,
-- COGS, margin or profit fields. Administrator routines expose COGS and Gross
-- Product Profit deliberately, and customer-paid fees remain a separate fact.
--
-- Report filters are calendar dates. PostgreSQL resolves every date through
-- the existing Asia/Manila business-time helpers and applies half-open
-- [period_start, period_end) timestamp bounds. The browser never manufactures
-- a timestamp window.

-- All-branch Administrator reports filter primarily by time. The existing
-- (branch_id, created_at) index serves Manager and single-branch reads; this
-- partial index serves completed-sale reads across the enterprise.
create index pos_sales_completed_created_idx
  on public.pos_sales (created_at)
  where status = 'completed';

-- ---------------------------------------------------------------- periods

-- Internal normalizer shared by every report routine. A report may cover at
-- most 366 inclusive calendar days (difference <= 365).
create or replace function public.pos_report_bounds(
  _from_date date default null,
  _to_date date default null
)
returns table (
  date_from date,
  date_to date,
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := public.pos_business_date();
  v_from date := coalesce(_from_date, _to_date, v_today);
  v_to date := coalesce(_to_date, _from_date, v_today);
begin
  if v_from > v_to then
    raise exception 'Report start date must be on or before the end date.'
      using errcode = '22023';
  end if;

  if v_to - v_from > 365 then
    raise exception 'Report ranges may cover at most 366 days.'
      using errcode = '22023';
  end if;

  return query
  select v_from, v_to, first_day.day_start, last_day.day_end
  from public.pos_day_bounds(v_from) first_day
  cross join public.pos_day_bounds(v_to) last_day;
end;
$$;

-- The preset calendar dates themselves come from PostgreSQL. The frontend
-- displays these rows and sends their date values back to the report RPCs; it
-- never anchors a preset from the device clock.
create or replace function public.get_pos_report_presets()
returns table (
  preset text,
  date_from date,
  date_to date,
  sort_order integer
)
language sql
stable
set search_path = ''
as $$
  with business_day as (
    select public.pos_business_date() as today
  )
  select v.preset, v.date_from, v.date_to, v.sort_order
  from business_day b
  cross join lateral (
    values
      ('today'::text,        b.today,                         b.today, 1),
      ('yesterday'::text,    b.today - 1,                     b.today - 1, 2),
      ('last_7_days'::text,  b.today - 6,                     b.today, 3),
      ('month_to_date'::text,date_trunc('month', b.today)::date, b.today, 4),
      ('year_to_date'::text, date_trunc('year', b.today)::date,  b.today, 5)
  ) as v(preset, date_from, date_to, sort_order)
  order by v.sort_order;
$$;

-- ---------------------------------------------------- Manager operational

create or replace function public.get_pos_manager_report_summary(
  _branch_id uuid,
  _from_date date default null,
  _to_date date default null
)
returns table (
  date_from date,
  date_to date,
  sales_collected numeric,
  product_sales numeric,
  fees_collected numeric,
  transaction_count integer,
  items_sold integer,
  average_sale numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.date_from,
    b.date_to,
    s.sales_collected,
    s.product_sales,
    s.fees_collected,
    s.transaction_count,
    i.items_sold,
    round(s.sales_collected / nullif(s.transaction_count, 0), 2)
  from public.pos_report_bounds(_from_date, _to_date) b
  left join lateral (
    select
      coalesce(sum(x.total_amount), 0)::numeric as sales_collected,
      coalesce(sum(x.subtotal), 0)::numeric as product_sales,
      coalesce(sum(x.fees_total), 0)::numeric as fees_collected,
      count(*)::integer as transaction_count
    from public.pos_sales x
    where x.branch_id = _branch_id
      and x.status = 'completed'
      and x.created_at >= b.period_start
      and x.created_at < b.period_end
  ) s on true
  left join lateral (
    select coalesce(sum(x.quantity), 0)::integer as items_sold
    from public.pos_sales sale
    join public.pos_sale_items x on x.sale_id = sale.id
    where sale.branch_id = _branch_id
      and sale.status = 'completed'
      and sale.created_at >= b.period_start
      and sale.created_at < b.period_end
  ) i on true
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[]);
$$;

create or replace function public.get_pos_manager_report_trend(
  _branch_id uuid,
  _from_date date default null,
  _to_date date default null
)
returns table (
  business_date date,
  sales_collected numeric,
  product_sales numeric,
  fees_collected numeric,
  transaction_count integer,
  items_sold integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select * from public.pos_report_bounds(_from_date, _to_date)
  ),
  days as (
    select generate_series(b.date_from, b.date_to, interval '1 day')::date as business_date
    from bounds b
  ),
  sales_by_day as (
    select
      (x.created_at at time zone public.pos_business_timezone())::date as business_date,
      coalesce(sum(x.total_amount), 0)::numeric as sales_collected,
      coalesce(sum(x.subtotal), 0)::numeric as product_sales,
      coalesce(sum(x.fees_total), 0)::numeric as fees_collected,
      count(*)::integer as transaction_count
    from public.pos_sales x
    cross join bounds b
    where x.branch_id = _branch_id
      and x.status = 'completed'
      and x.created_at >= b.period_start
      and x.created_at < b.period_end
    group by (x.created_at at time zone public.pos_business_timezone())::date
  ),
  items_by_day as (
    select
      (sale.created_at at time zone public.pos_business_timezone())::date as business_date,
      coalesce(sum(x.quantity), 0)::integer as items_sold
    from public.pos_sales sale
    join public.pos_sale_items x on x.sale_id = sale.id
    cross join bounds b
    where sale.branch_id = _branch_id
      and sale.status = 'completed'
      and sale.created_at >= b.period_start
      and sale.created_at < b.period_end
    group by (sale.created_at at time zone public.pos_business_timezone())::date
  )
  select
    d.business_date,
    coalesce(s.sales_collected, 0)::numeric,
    coalesce(s.product_sales, 0)::numeric,
    coalesce(s.fees_collected, 0)::numeric,
    coalesce(s.transaction_count, 0)::integer,
    coalesce(i.items_sold, 0)::integer
  from days d
  left join sales_by_day s using (business_date)
  left join items_by_day i using (business_date)
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  order by d.business_date;
$$;

create or replace function public.get_pos_manager_report_payment_totals(
  _branch_id uuid,
  _from_date date default null,
  _to_date date default null
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
    x.payment_method,
    count(*)::integer,
    coalesce(sum(x.total_amount), 0)::numeric
  from public.pos_report_bounds(_from_date, _to_date) b
  join public.pos_sales x
    on x.branch_id = _branch_id
   and x.status = 'completed'
   and x.created_at >= b.period_start
   and x.created_at < b.period_end
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  group by x.payment_method
  order by coalesce(sum(x.total_amount), 0) desc, x.payment_method;
$$;

create or replace function public.get_pos_manager_report_top_products(
  _branch_id uuid,
  _from_date date default null,
  _to_date date default null,
  _limit integer default 10
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
    x.product_id,
    (array_agg(x.product_name order by sale.created_at desc, x.created_at desc, x.id desc))[1],
    coalesce(sum(x.quantity), 0)::integer,
    coalesce(sum(x.line_total), 0)::numeric
  from public.pos_report_bounds(_from_date, _to_date) b
  join public.pos_sales sale
    on sale.branch_id = _branch_id
   and sale.status = 'completed'
   and sale.created_at >= b.period_start
   and sale.created_at < b.period_end
  join public.pos_sale_items x on x.sale_id = sale.id
  where public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
  group by x.product_id
  order by coalesce(sum(x.quantity), 0) desc,
           coalesce(sum(x.line_total), 0) desc,
           x.product_id
  limit public.pos_page_size(_limit);
$$;

-- ------------------------------------------------ Administrator financial

create or replace function public.get_admin_pos_report_summary(
  _branch_id uuid default null,
  _from_date date default null,
  _to_date date default null
)
returns table (
  date_from date,
  date_to date,
  sales_collected numeric,
  product_sales numeric,
  fees_collected numeric,
  total_cogs numeric,
  gross_product_profit numeric,
  gross_product_margin numeric,
  transaction_count integer,
  items_sold integer,
  average_sale numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.date_from,
    b.date_to,
    s.sales_collected,
    s.product_sales,
    s.fees_collected,
    s.total_cogs,
    s.product_sales - s.total_cogs,
    round(((s.product_sales - s.total_cogs) / nullif(s.product_sales, 0)) * 100, 2),
    s.transaction_count,
    i.items_sold,
    round(s.sales_collected / nullif(s.transaction_count, 0), 2)
  from public.pos_report_bounds(_from_date, _to_date) b
  left join lateral (
    select
      coalesce(sum(x.total_amount), 0)::numeric as sales_collected,
      coalesce(sum(x.subtotal), 0)::numeric as product_sales,
      coalesce(sum(x.fees_total), 0)::numeric as fees_collected,
      coalesce(sum(x.total_cogs), 0)::numeric as total_cogs,
      count(*)::integer as transaction_count
    from public.pos_sales x
    where public.is_admin()
      and (_branch_id is null or x.branch_id = _branch_id)
      and x.status = 'completed'
      and x.created_at >= b.period_start
      and x.created_at < b.period_end
  ) s on true
  left join lateral (
    select coalesce(sum(x.quantity), 0)::integer as items_sold
    from public.pos_sales sale
    join public.pos_sale_items x on x.sale_id = sale.id
    where public.is_admin()
      and (_branch_id is null or sale.branch_id = _branch_id)
      and sale.status = 'completed'
      and sale.created_at >= b.period_start
      and sale.created_at < b.period_end
  ) i on true
  where public.is_admin();
$$;

create or replace function public.get_admin_pos_report_trend(
  _branch_id uuid default null,
  _from_date date default null,
  _to_date date default null
)
returns table (
  business_date date,
  sales_collected numeric,
  product_sales numeric,
  fees_collected numeric,
  total_cogs numeric,
  gross_product_profit numeric,
  gross_product_margin numeric,
  transaction_count integer,
  items_sold integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select * from public.pos_report_bounds(_from_date, _to_date)
  ),
  days as (
    select generate_series(b.date_from, b.date_to, interval '1 day')::date as business_date
    from bounds b
  ),
  sales_by_day as (
    select
      (x.created_at at time zone public.pos_business_timezone())::date as business_date,
      coalesce(sum(x.total_amount), 0)::numeric as sales_collected,
      coalesce(sum(x.subtotal), 0)::numeric as product_sales,
      coalesce(sum(x.fees_total), 0)::numeric as fees_collected,
      coalesce(sum(x.total_cogs), 0)::numeric as total_cogs,
      count(*)::integer as transaction_count
    from public.pos_sales x
    cross join bounds b
    where public.is_admin()
      and (_branch_id is null or x.branch_id = _branch_id)
      and x.status = 'completed'
      and x.created_at >= b.period_start
      and x.created_at < b.period_end
    group by (x.created_at at time zone public.pos_business_timezone())::date
  ),
  items_by_day as (
    select
      (sale.created_at at time zone public.pos_business_timezone())::date as business_date,
      coalesce(sum(x.quantity), 0)::integer as items_sold
    from public.pos_sales sale
    join public.pos_sale_items x on x.sale_id = sale.id
    cross join bounds b
    where public.is_admin()
      and (_branch_id is null or sale.branch_id = _branch_id)
      and sale.status = 'completed'
      and sale.created_at >= b.period_start
      and sale.created_at < b.period_end
    group by (sale.created_at at time zone public.pos_business_timezone())::date
  )
  select
    d.business_date,
    coalesce(s.sales_collected, 0)::numeric,
    coalesce(s.product_sales, 0)::numeric,
    coalesce(s.fees_collected, 0)::numeric,
    coalesce(s.total_cogs, 0)::numeric,
    coalesce(s.product_sales, 0)::numeric - coalesce(s.total_cogs, 0)::numeric,
    round(
      ((coalesce(s.product_sales, 0)::numeric - coalesce(s.total_cogs, 0)::numeric)
        / nullif(coalesce(s.product_sales, 0)::numeric, 0)) * 100,
      2
    ),
    coalesce(s.transaction_count, 0)::integer,
    coalesce(i.items_sold, 0)::integer
  from days d
  left join sales_by_day s using (business_date)
  left join items_by_day i using (business_date)
  where public.is_admin()
  order by d.business_date;
$$;

create or replace function public.get_admin_pos_report_branch_comparison(
  _from_date date default null,
  _to_date date default null
)
returns table (
  branch_id uuid,
  branch_name text,
  branch_is_active boolean,
  sales_collected numeric,
  product_sales numeric,
  fees_collected numeric,
  total_cogs numeric,
  gross_product_profit numeric,
  gross_product_margin numeric,
  transaction_count integer,
  items_sold integer,
  average_sale numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select * from public.pos_report_bounds(_from_date, _to_date)
  ),
  sales_by_branch as (
    select
      x.branch_id,
      coalesce(sum(x.total_amount), 0)::numeric as sales_collected,
      coalesce(sum(x.subtotal), 0)::numeric as product_sales,
      coalesce(sum(x.fees_total), 0)::numeric as fees_collected,
      coalesce(sum(x.total_cogs), 0)::numeric as total_cogs,
      count(*)::integer as transaction_count
    from public.pos_sales x
    cross join bounds b
    where public.is_admin()
      and x.status = 'completed'
      and x.created_at >= b.period_start
      and x.created_at < b.period_end
    group by x.branch_id
  ),
  items_by_branch as (
    select sale.branch_id, coalesce(sum(x.quantity), 0)::integer as items_sold
    from public.pos_sales sale
    join public.pos_sale_items x on x.sale_id = sale.id
    cross join bounds b
    where public.is_admin()
      and sale.status = 'completed'
      and sale.created_at >= b.period_start
      and sale.created_at < b.period_end
    group by sale.branch_id
  )
  select
    branch.id,
    branch.name,
    branch.is_active,
    coalesce(s.sales_collected, 0)::numeric,
    coalesce(s.product_sales, 0)::numeric,
    coalesce(s.fees_collected, 0)::numeric,
    coalesce(s.total_cogs, 0)::numeric,
    coalesce(s.product_sales, 0)::numeric - coalesce(s.total_cogs, 0)::numeric,
    round(
      ((coalesce(s.product_sales, 0)::numeric - coalesce(s.total_cogs, 0)::numeric)
        / nullif(coalesce(s.product_sales, 0)::numeric, 0)) * 100,
      2
    ),
    coalesce(s.transaction_count, 0)::integer,
    coalesce(i.items_sold, 0)::integer,
    round(coalesce(s.sales_collected, 0)::numeric / nullif(s.transaction_count, 0), 2)
  from public.branches branch
  left join sales_by_branch s on s.branch_id = branch.id
  left join items_by_branch i on i.branch_id = branch.id
  where public.is_admin()
    and (branch.is_active or s.branch_id is not null)
  order by coalesce(s.product_sales, 0) desc, branch.name, branch.id;
$$;

-- --------------------------------------------------------------- ACLs
--
-- 20260716070000 explicitly grants every new public routine to anon and
-- authenticated, while PostgreSQL separately grants PUBLIC EXECUTE. Revoke
-- both sources and grant only the intended API role. Contract tests inspect
-- the final pg_catalog state.

revoke all on function public.pos_report_bounds(date, date) from public, anon, authenticated;
grant execute on function public.pos_report_bounds(date, date) to service_role;

revoke all on function public.get_pos_report_presets() from public, anon;
revoke all on function public.get_pos_manager_report_summary(uuid, date, date) from public, anon;
revoke all on function public.get_pos_manager_report_trend(uuid, date, date) from public, anon;
revoke all on function public.get_pos_manager_report_payment_totals(uuid, date, date) from public, anon;
revoke all on function public.get_pos_manager_report_top_products(uuid, date, date, integer) from public, anon;
revoke all on function public.get_admin_pos_report_summary(uuid, date, date) from public, anon;
revoke all on function public.get_admin_pos_report_trend(uuid, date, date) from public, anon;
revoke all on function public.get_admin_pos_report_branch_comparison(date, date) from public, anon;

grant execute on function public.get_pos_report_presets() to authenticated;
grant execute on function public.get_pos_manager_report_summary(uuid, date, date) to authenticated;
grant execute on function public.get_pos_manager_report_trend(uuid, date, date) to authenticated;
grant execute on function public.get_pos_manager_report_payment_totals(uuid, date, date) to authenticated;
grant execute on function public.get_pos_manager_report_top_products(uuid, date, date, integer) to authenticated;
grant execute on function public.get_admin_pos_report_summary(uuid, date, date) to authenticated;
grant execute on function public.get_admin_pos_report_trend(uuid, date, date) to authenticated;
grant execute on function public.get_admin_pos_report_branch_comparison(date, date) to authenticated;
