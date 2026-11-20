-- Parts Market advance delivery payment migration
-- Run this entire script once in Supabase SQL Editor.

alter table public.orders
  add column if not exists delivery_area text,
  add column if not exists delivery_fee integer not null default 0,
  add column if not exists payment_last3 text;

drop function if exists public.place_order(text, text, text, text, jsonb);
drop function if exists public.place_order(text, text, text, text, jsonb, text, integer);

create or replace function public.place_order(
  p_customer_name text, p_phone text, p_address text, p_note text,
  p_items jsonb, p_delivery_area text, p_delivery_fee integer, p_payment_last3 text
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  new_order_id bigint; item jsonb; prod public.products%rowtype;
  qty integer; order_subtotal numeric(12,2) := 0; expected_delivery_fee integer;
begin
  if length(trim(coalesce(p_customer_name,''))) < 2
     or length(trim(coalesce(p_phone,''))) < 8
     or length(trim(coalesce(p_address,''))) < 8
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Please provide valid customer and order details';
  end if;
  if coalesce(p_payment_last3,'') !~ '^[0-9]{3}$' then
    raise exception 'Enter the last 3 digits of your payment transaction';
  end if;
  expected_delivery_fee := case p_delivery_area
    when 'inside_dhaka' then 80 when 'outside_dhaka' then 150 else null end;
  if expected_delivery_fee is null or p_delivery_fee is distinct from expected_delivery_fee then
    raise exception 'Invalid delivery area or delivery charge';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;
    if qty < 1 then raise exception 'Invalid quantity'; end if;
    select * into prod from public.products
      where id = (item->>'product_id')::uuid and active = true for update;
    if not found then raise exception 'A selected product is unavailable'; end if;
    if prod.stock < qty then raise exception 'Insufficient stock for %', prod.name; end if;
    order_subtotal := order_subtotal + prod.price * qty;
  end loop;
  insert into public.orders(customer_name, phone, address, note, total, delivery_area, delivery_fee, payment_last3, status)
  values(trim(p_customer_name), trim(p_phone), trim(p_address), coalesce(p_note,''),
    order_subtotal + expected_delivery_fee, p_delivery_area, expected_delivery_fee,
    trim(p_payment_last3), 'pending')
  returning id into new_order_id;
  for item in select value from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;
    select * into prod from public.products where id = (item->>'product_id')::uuid for update;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, selected_color)
    values(new_order_id, prod.id, prod.name, prod.price, qty, nullif(item->>'selected_color',''));
    update public.products set stock = stock - qty where id = prod.id;
  end loop;
  return new_order_id;
end; $$;

revoke all on function public.place_order(text, text, text, text, jsonb, text, integer, text) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, text, integer, text) to anon, authenticated;
