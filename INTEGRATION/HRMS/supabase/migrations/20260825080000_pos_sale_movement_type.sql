-- Selling becomes a kind of stock movement.
--
-- This migration exists on its own for one reason: PostgreSQL will not let a
-- transaction add an enum value and then use it. 20260825060000 left a note
-- saying so, and the checkout that emits 'sale' arrives in the very next
-- migration, so the value has to land first.
--
-- The source_type CHECK is widened here too. It is the trust boundary that
-- stops a client claiming provenance it has not earned -- a browser cannot say
-- 'purchase_order_receiving' because that is still not a legal value -- so it
-- is widened deliberately, one workflow at a time, by the migration that
-- implements the workflow.

alter type public.pos_movement_type add value 'sale';

alter table public.pos_inventory_movements
  drop constraint pos_inventory_movements_source_type;

alter table public.pos_inventory_movements
  add constraint pos_inventory_movements_source_type check (
    source_type in ('manual_receiving', 'manual_adjustment', 'sale')
  );

comment on constraint pos_inventory_movements_source_type on public.pos_inventory_movements is
  'The workflows allowed to move stock. Widened one phase at a time; the RPCs set this themselves, so a client cannot claim a provenance that is not implemented yet.';
