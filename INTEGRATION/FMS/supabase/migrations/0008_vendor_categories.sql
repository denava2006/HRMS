-- =============================================================================
-- Migration 0008: What each vendor actually supplies
--
-- Nothing stopped a requester from charging "Meals & Representation" to a
-- hardware supplier. Tying vendors to the expense categories they serve lets
-- the request form offer only the vendors that make sense for the category.
--
-- Many-to-many on purpose: a stationery supplier can also sell equipment.
-- A vendor with no categories is treated as a general supplier and stays
-- available everywhere, so existing data keeps working.
-- =============================================================================

create table if not exists vendor_categories (
  vendor_id   uuid not null references vendors(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (vendor_id, category_id)
);

create index if not exists idx_vendor_categories_category
  on vendor_categories(category_id);

alter table vendor_categories enable row level security;

-- Everyone needs to read these to filter the dropdown when raising a request.
create policy vendor_categories_select on vendor_categories
  for select to authenticated using (true);

-- Same people who curate the vendor list.
create policy vendor_categories_write on vendor_categories
  for all to authenticated
  using (has_role('administrator', 'finance_manager', 'finance_staff'))
  with check (has_role('administrator', 'finance_manager', 'finance_staff'));

grant select, insert, update, delete on vendor_categories to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Classify the demo vendors so the filter is meaningful straight away.
-- -----------------------------------------------------------------------------

insert into vendor_categories (vendor_id, category_id)
select v.id, c.id
from vendors v
join categories c on c.type = 'expense'
where (v.name = 'OfficeWarehouse Corp.'  and c.name in ('Office Supplies', 'Equipment & Hardware'))
   or (v.name = 'TechHub Solutions Inc.' and c.name in ('Equipment & Hardware', 'Software & Subscriptions'))
   or (v.name = 'CloudServe Digital'     and c.name in ('Software & Subscriptions'))
   or (v.name = 'Prime Travel Agency'    and c.name in ('Travel & Transportation', 'Meals & Representation'))
on conflict do nothing;
