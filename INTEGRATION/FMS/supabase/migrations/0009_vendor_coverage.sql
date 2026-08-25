-- =============================================================================
-- Migration 0009: A supplier for every expense category
--
-- Five categories (Miscellaneous, Professional Fees, Rent & Facilities,
-- Training & Development, Utilities) had no vendor at all, so choosing them on
-- a request left the Vendor dropdown empty. Each category now has at least one
-- supplier, and several vendors serve more than one — which is what the
-- many-to-many link is there to demonstrate.
-- =============================================================================

insert into vendors (name, contact_person, email, phone, address, tin) values
  ('Kusina ni Maria Catering',    'Rosa Villanueva', 'events@kusinanimaria.ph',  '+63285550111', 'Mandaluyong City, Metro Manila', '567890123000'),
  ('Metro Utilities Corp.',       'Grace Mendoza',   'billing@metroutilities.ph','+63285550222', 'Pasay City, Metro Manila',       '678901234000'),
  ('Cruz and Asociados Law Firm', 'Miguel Cruz',     'accounts@cruzlaw.ph',      '+63285550333', 'Makati City, Metro Manila',      '789012345000'),
  ('Pillar Property Holdings',    'Paolo Aquino',    'leasing@pillarprop.ph',    '+63285550444', 'Ortigas Center, Pasig City',     '890123456000'),
  ('SkillForge Training Institute','Liza Bautista',  'enroll@skillforge.ph',     '+63285550555', 'Quezon City, Metro Manila',      '901234567000'),
  ('Everyday Essentials Trading', 'Noel Ramirez',    'sales@everydayessentials.ph','+63285550666','Caloocan City, Metro Manila',   '012345678000');

-- --- What each new vendor supplies -------------------------------------------
insert into vendor_categories (vendor_id, category_id)
select v.id, c.id
from vendors v
join categories c on c.type = 'expense'
where (v.name = 'Kusina ni Maria Catering'      and c.name in ('Meals & Representation'))
   or (v.name = 'Metro Utilities Corp.'         and c.name in ('Utilities'))
   or (v.name = 'Cruz and Asociados Law Firm'   and c.name in ('Professional Fees'))
   -- a landlord bills the space and the utilities that come with it
   or (v.name = 'Pillar Property Holdings'      and c.name in ('Rent & Facilities', 'Utilities'))
   or (v.name = 'SkillForge Training Institute' and c.name in ('Training & Development', 'Professional Fees'))
   or (v.name = 'Everyday Essentials Trading'   and c.name in ('Miscellaneous', 'Office Supplies'))
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Store contact details the way the app now saves them: digits only, with an
-- optional leading "+". The earlier rows held spaces and dashes, which the
-- vendor form would otherwise flag the moment someone opened and saved them.
-- The TIN is re-grouped for display, so nothing is lost visually.
-- -----------------------------------------------------------------------------

update vendors
set phone = case
      when phone is null then null
      when phone like '+%' then '+' || regexp_replace(phone, '\D', '', 'g')
      else regexp_replace(phone, '\D', '', 'g')
    end,
    tin = case when tin is null then null else regexp_replace(tin, '\D', '', 'g') end;
