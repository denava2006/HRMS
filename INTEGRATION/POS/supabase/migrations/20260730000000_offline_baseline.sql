-- SariSwift offline baseline
-- Replaces the overlapping migrations from the original project.

create type public.app_role as enum ('admin', 'owner');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'PHP',
  owner_name text,
  phone text,
  address text,
  fees jsonb not null default '[]'::jsonb,
  payment_qr_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  stock integer not null default 0 check (stock >= 0),
  buying_price numeric(10,2) not null default 0 check (buying_price >= 0),
  selling_price numeric(10,2) not null default 0 check (selling_price >= 0),
  image_url text,
  is_archived boolean not null default false,
  is_deleted boolean not null default false,
  is_demo boolean not null default false,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  total_amount numeric(10,2) not null default 0,
  total_profit numeric(10,2) not null default 0,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'gcash', 'maya', 'bank', 'other')),
  payment_reference text,
  amount_tendered numeric,
  fees jsonb default '[]'::jsonb,
  subtotal numeric,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  unit_profit numeric(10,2) not null,
  line_total numeric(10,2) not null,
  line_profit numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index idx_stores_owner on public.stores(owner_id);
create index idx_products_store on public.products(store_id);
create index idx_products_store_active on public.products(store_id) where is_deleted = false;
create index idx_sales_store on public.sales(store_id);
create index idx_sales_created_at on public.sales(created_at desc);
create index idx_sale_items_sale_id on public.sale_items(sale_id);

alter table public.user_roles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger stores_updated
  before update on public.stores
  for each row execute function public.update_updated_at();

create trigger products_updated_at
  before update on public.products
  for each row execute function public.update_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "Users view own roles"
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));

create policy "Admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

create policy "Owners and admins view stores"
  on public.stores for select to authenticated
  using ((select auth.uid()) = owner_id or public.has_role((select auth.uid()), 'admin'));

create policy "Owners create stores"
  on public.stores for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners and admins update stores"
  on public.stores for update to authenticated
  using ((select auth.uid()) = owner_id or public.has_role((select auth.uid()), 'admin'))
  with check ((select auth.uid()) = owner_id or public.has_role((select auth.uid()), 'admin'));

create policy "Owners and admins delete stores"
  on public.stores for delete to authenticated
  using ((select auth.uid()) = owner_id or public.has_role((select auth.uid()), 'admin'));

create policy "Store owners and admins read products"
  on public.products for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (
      select 1 from public.stores
      where stores.id = products.store_id and stores.owner_id = (select auth.uid())
    )
  );

create policy "Store owners insert products"
  on public.products for insert to authenticated
  with check (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id and stores.owner_id = (select auth.uid())
    )
  );

create policy "Store owners update products"
  on public.products for update to authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id and stores.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id and stores.owner_id = (select auth.uid())
    )
  );

create policy "Store owners delete products"
  on public.products for delete to authenticated
  using (
    exists (
      select 1 from public.stores
      where stores.id = products.store_id and stores.owner_id = (select auth.uid())
    )
  );

create policy "Store owners and admins read sales"
  on public.sales for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (
      select 1 from public.stores
      where stores.id = sales.store_id and stores.owner_id = (select auth.uid())
    )
  );

create policy "Store owners insert sales"
  on public.sales for insert to authenticated
  with check (
    exists (
      select 1 from public.stores
      where stores.id = sales.store_id and stores.owner_id = (select auth.uid())
    )
  );

create policy "Store owners and admins read sale items"
  on public.sale_items for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (
      select 1
      from public.sales
      join public.stores on stores.id = sales.store_id
      where sales.id = sale_items.sale_id
        and stores.owner_id = (select auth.uid())
    )
  );

create policy "Store owners insert sale items"
  on public.sale_items for insert to authenticated
  with check (
    exists (
      select 1
      from public.sales
      join public.stores on stores.id = sales.store_id
      where sales.id = sale_items.sale_id
        and stores.owner_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;

create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Authenticated upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and owner_id = (select auth.uid()::text));

create policy "Owners update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and owner_id = (select auth.uid()::text))
  with check (bucket_id = 'product-images' and owner_id = (select auth.uid()::text));

create policy "Owners delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and owner_id = (select auth.uid()::text));

alter table public.products replica identity full;
alter table public.sales replica identity full;
alter table public.sale_items replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.products;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sales;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sale_items;
  exception when duplicate_object then null;
  end;
end;
$$;
