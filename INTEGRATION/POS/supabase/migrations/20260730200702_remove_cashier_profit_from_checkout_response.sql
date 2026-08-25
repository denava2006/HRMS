revoke execute on function public.secure_checkout(uuid, jsonb, text, text, numeric, uuid) from authenticated;

create or replace function public.checkout_sale(
  _store_id uuid,
  _items jsonb,
  _payment_method text,
  _payment_reference text default null,
  _amount_tendered numeric default null,
  _checkout_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _role public.membership_role;
  _result jsonb;
begin
  _role := private.active_store_role(_store_id);
  if _role is null then
    raise exception 'Active store membership required';
  end if;

  _result := public.secure_checkout(
    _store_id,
    _items,
    _payment_method,
    _payment_reference,
    _amount_tendered,
    _checkout_key
  );

  if _role = 'cashier' then
    return _result - 'total_profit';
  end if;
  return _result;
end;
$$;

revoke all on function public.checkout_sale(uuid, jsonb, text, text, numeric, uuid) from public;
grant execute on function public.checkout_sale(uuid, jsonb, text, text, numeric, uuid) to authenticated;
