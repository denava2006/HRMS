-- Transaction history: three read paths, one receipt, no cost anywhere.
--
-- The sales written in Phase 5 are Administrator-only at the table level and
-- carry total_cogs and unit_cost_snapshot. So every screen that lists
-- transactions reads through one of these functions instead, and each returns
-- an explicit, receipt-safe column list. There is no cost-bearing row here to
-- strip keys from -- the cost columns are simply never selected.
--
-- Who sees what:
--
--   get_my_transactions        the caller's OWN sales. It takes no cashier
--                              parameter at all, so "show me someone else's"
--                              is not a request that can be expressed.
--   get_branch_transactions    every cashier's sales at a branch the caller
--                              manages. Manager authority is per branch: being
--                              a Manager at Cavite grants nothing at Main
--                              Office, even for the same person.
--   get_admin_transactions     everything, for the parent system's
--                              administrator. Still receipt-safe: the
--                              Transactions module is operational, and cost
--                              belongs to Reports and FMS later.
--   get_sale_detail            one receipt, authorised by who is asking rather
--                              than by whether they know the id.

-- ------------------------------------------------------------------ paging

-- A list endpoint with an unbounded limit is a denial-of-service waiting to be
-- typed into a URL bar.
create or replace function public.pos_page_size(_requested integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select greatest(1, least(coalesce(_requested, 25), 100)) $$;

-- --------------------------------------------------------------- own sales

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
    (select count(*)::integer from public.pos_sale_items i where i.sale_id = s.id),
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

-- ------------------------------------------------------------ branch sales

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
    (select count(*)::integer from public.pos_sale_items i where i.sale_id = s.id),
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

-- ------------------------------------------------------------- every sale

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
    (select count(*)::integer from public.pos_sale_items i where i.sale_id = s.id),
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

-- ------------------------------------------------------------- one receipt
--
-- Authorised by who is asking, never by whether they hold the id. Phase 5's
-- pos_sale_receipt takes a sale id and returns it unconditionally, which is why
-- it is granted to service_role only; this is the wrapper that decides.
create or replace function public.get_sale_detail(_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _sale public.pos_sales%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to view a receipt';
  end if;

  select * into _sale from public.pos_sales s where s.id = _sale_id;
  if not found then
    -- Same answer as "you may not see it": a probe must not be able to tell an
    -- id that exists from one that does not.
    raise exception 'That receipt is not available';
  end if;

  if not (
    public.is_admin()
    or _sale.cashier_id = (select auth.uid())
    or public.has_pos_role(_sale.branch_id, array['manager']::public.pos_role[])
  ) then
    raise exception 'That receipt is not available';
  end if;

  return public.pos_sale_receipt(_sale_id);
end;
$$;

-- ------------------------------------------------------------------ grants

revoke all on function public.pos_page_size(integer) from public, anon;
revoke all on function public.get_my_transactions(timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_branch_transactions(uuid, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_admin_transactions(uuid, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.get_sale_detail(uuid) from public, anon;

grant execute on function public.pos_page_size(integer) to authenticated, service_role;
grant execute on function public.get_my_transactions(timestamptz, timestamptz, integer, integer) to authenticated, service_role;
grant execute on function public.get_branch_transactions(uuid, timestamptz, timestamptz, integer, integer) to authenticated, service_role;
grant execute on function public.get_admin_transactions(uuid, timestamptz, timestamptz, integer, integer) to authenticated, service_role;
grant execute on function public.get_sale_detail(uuid) to authenticated, service_role;

-- pos_sale_receipt stays internal. 20260825100000 revoked it from
-- `authenticated` after the catalogue showed the ALTER DEFAULT PRIVILEGES grant
-- had survived an earlier revoke; get_sale_detail is now the only user-facing
-- way in, and it authorises first. Re-asserted here so a future reader does not
-- "fix" the missing grant.
revoke all on function public.pos_sale_receipt(uuid) from public, anon, authenticated;
