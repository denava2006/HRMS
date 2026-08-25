-- item_count means units sold, not lines on the sale.
--
-- Found in browser verification: a sale of two bottles of the same product is
-- one row in pos_sale_items, so count(*) reported "1 item" and the page summary
-- labelled "Items sold" undercounted every multi-quantity line. On a till that
-- adds a second unit by incrementing the line rather than appending one, that
-- is wrong nearly every time.
--
-- Sum the quantities instead. The column name, type and position are unchanged,
-- so the three signatures are identical and no client type moves.

create or replace function public.get_my_transactions(
  _from timestamptz default null,
  _to timestamptz default null,
  _limit integer default 25,
  _offset integer default 0
)
returns table (
  sale_id uuid,
  created_at timestamptz,
  status public.pos_sale_status,
  branch_id uuid,
  branch_name text,
  cashier_name text,
  item_count integer,
  subtotal numeric,
  fees_total numeric,
  total_amount numeric,
  payment_method text,
  payment_reference text,
  amount_tendered numeric,
  change_given numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.created_at, s.status, s.branch_id, s.branch_name, s.cashier_name,
    (select coalesce(sum(i.quantity), 0)::integer
       from public.pos_sale_items i where i.sale_id = s.id),
    s.subtotal, s.fees_total, s.total_amount,
    s.payment_method, s.payment_reference, s.amount_tendered, s.change_given,
    count(*) over ()
  from public.pos_sales s
  -- The whole rule, and it is not a filter the caller supplies.
  where s.cashier_id = (select auth.uid())
    and (_from is null or s.created_at >= _from)
    and (_to is null or s.created_at <= _to)
  order by s.created_at desc
  limit public.pos_page_size(_limit)
  offset greatest(0, coalesce(_offset, 0));
$$;

create or replace function public.get_branch_transactions(
  _branch_id uuid,
  _from timestamptz default null,
  _to timestamptz default null,
  _limit integer default 25,
  _offset integer default 0
)
returns table (
  sale_id uuid,
  created_at timestamptz,
  status public.pos_sale_status,
  branch_id uuid,
  branch_name text,
  cashier_name text,
  item_count integer,
  subtotal numeric,
  fees_total numeric,
  total_amount numeric,
  payment_method text,
  payment_reference text,
  amount_tendered numeric,
  change_given numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.created_at, s.status, s.branch_id, s.branch_name, s.cashier_name,
    (select coalesce(sum(i.quantity), 0)::integer
       from public.pos_sale_items i where i.sale_id = s.id),
    s.subtotal, s.fees_total, s.total_amount,
    s.payment_method, s.payment_reference, s.amount_tendered, s.change_given,
    count(*) over ()
  from public.pos_sales s
  where s.branch_id = _branch_id
    -- Manager at THIS branch. A manager assignment elsewhere grants nothing
    -- here, which is what keeps "Manager at A, Cashier at B" honest.
    and public.has_pos_role(_branch_id, array['manager']::public.pos_role[])
    and (_from is null or s.created_at >= _from)
    and (_to is null or s.created_at <= _to)
  order by s.created_at desc
  limit public.pos_page_size(_limit)
  offset greatest(0, coalesce(_offset, 0));
$$;

create or replace function public.get_admin_transactions(
  _branch_id uuid default null,
  _from timestamptz default null,
  _to timestamptz default null,
  _limit integer default 25,
  _offset integer default 0
)
returns table (
  sale_id uuid,
  created_at timestamptz,
  status public.pos_sale_status,
  branch_id uuid,
  branch_name text,
  cashier_name text,
  item_count integer,
  subtotal numeric,
  fees_total numeric,
  total_amount numeric,
  payment_method text,
  payment_reference text,
  amount_tendered numeric,
  change_given numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.created_at, s.status, s.branch_id, s.branch_name, s.cashier_name,
    (select coalesce(sum(i.quantity), 0)::integer
       from public.pos_sale_items i where i.sale_id = s.id),
    s.subtotal, s.fees_total, s.total_amount,
    s.payment_method, s.payment_reference, s.amount_tendered, s.change_given,
    count(*) over ()
  from public.pos_sales s
  where public.is_admin()
    and (_branch_id is null or s.branch_id = _branch_id)
    and (_from is null or s.created_at >= _from)
    and (_to is null or s.created_at <= _to)
  order by s.created_at desc
  limit public.pos_page_size(_limit)
  offset greatest(0, coalesce(_offset, 0));
$$;

-- CREATE OR REPLACE keeps the existing ACL, but this database has an
-- ALTER DEFAULT PRIVILEGES rule that grants every new routine in public to
-- anon and authenticated, and PostgreSQL grants PUBLIC EXECUTE besides. Re-issue
-- both revokes rather than trusting that the replace left the old grants alone.
revoke all on function public.get_my_transactions(timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_branch_transactions(uuid, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_admin_transactions(uuid, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.get_my_transactions(timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_branch_transactions(uuid, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_admin_transactions(uuid, timestamptz, timestamptz, integer, integer) to authenticated;
