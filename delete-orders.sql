-- Parts Market: allow admins to delete orders.
-- Run this once in Supabase SQL Editor.
grant delete on table public.orders to authenticated;

drop policy if exists "admins delete orders" on public.orders;
create policy "admins delete orders"
on public.orders
for delete
to authenticated
using (public.is_admin());

-- order_items.order_id already references orders(id) ON DELETE CASCADE,
-- so deleting an order also deletes its related order_items automatically.
