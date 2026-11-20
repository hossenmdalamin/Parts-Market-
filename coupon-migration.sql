-- Parts Market fixed-amount coupon system
-- Run this entire script once in Supabase SQL Editor.
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_amount integer not null check (discount_amount > 0),
  max_uses integer null check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_code_format check (code ~ '^[A-Z0-9_-]{3,30}$')
);
alter table public.coupons enable row level security;
grant select, insert, update, delete on public.coupons to authenticated;
drop policy if exists "admins manage coupons" on public.coupons;
create policy "admins manage coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.orders add column if not exists coupon_code text, add column if not exists discount_amount integer not null default 0;
create or replace function public.get_coupon_discount(p_coupon_code text)
returns integer language plpgsql security definer set search_path = public as $$
declare c public.coupons%rowtype;
begin
 select * into c from public.coupons where code=upper(trim(coalesce(p_coupon_code,''))) and active=true and (max_uses is null or used_count<max_uses);
 if not found then return null; end if;
 return c.discount_amount;
end; $$;
revoke all on function public.get_coupon_discount(text) from public;
grant execute on function public.get_coupon_discount(text) to anon, authenticated;
drop function if exists public.place_order(text,text,text,text,jsonb,text,integer,text);
drop function if exists public.place_order(text,text,text,text,jsonb,text,integer);
drop function if exists public.place_order(text,text,text,text,jsonb);
create or replace function public.place_order(
 p_customer_name text,p_phone text,p_address text,p_note text,p_items jsonb,
 p_delivery_area text,p_delivery_fee integer,p_payment_last3 text,p_coupon_code text
) returns bigint language plpgsql security definer set search_path=public as $$
declare
 new_order_id bigint; item jsonb; prod public.products%rowtype; c public.coupons%rowtype;
 qty integer; order_subtotal numeric(12,2):=0; expected_delivery_fee integer;
 actual_discount integer:=0; clean_coupon_code text:=nullif(upper(trim(coalesce(p_coupon_code,''))),'');
begin
 if length(trim(coalesce(p_customer_name,'')))<2 or length(trim(coalesce(p_phone,'')))<8 or length(trim(coalesce(p_address,'')))<8 or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Please provide valid customer and order details'; end if;
 if coalesce(p_payment_last3,'') !~ '^[0-9]{3}$' then raise exception 'Enter the last 3 digits of your payment transaction'; end if;
 expected_delivery_fee:=case p_delivery_area when 'inside_dhaka' then 80 when 'outside_dhaka' then 150 else null end;
 if expected_delivery_fee is null or p_delivery_fee is distinct from expected_delivery_fee then raise exception 'Invalid delivery area or delivery charge'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  qty:=(item->>'quantity')::integer; if qty<1 then raise exception 'Invalid quantity'; end if;
  select * into prod from public.products where id=(item->>'product_id')::uuid and active=true for update;
  if not found then raise exception 'A selected product is unavailable'; end if;
  if prod.stock<qty then raise exception 'Insufficient stock for %',prod.name; end if;
  order_subtotal:=order_subtotal+prod.price*qty;
 end loop;
 if clean_coupon_code is not null then
  select * into c from public.coupons where code=clean_coupon_code for update;
  if not found or not c.active or (c.max_uses is not null and c.used_count>=c.max_uses) then raise exception 'Coupon is invalid, inactive, or its usage limit has been reached'; end if;
  actual_discount:=least(c.discount_amount,floor(order_subtotal)::integer);
  update public.coupons set used_count=used_count+1 where id=c.id;
 end if;
 insert into public.orders(customer_name,phone,address,note,total,delivery_area,delivery_fee,payment_last3,coupon_code,discount_amount,status)
 values(trim(p_customer_name),trim(p_phone),trim(p_address),coalesce(p_note,''),order_subtotal-actual_discount+expected_delivery_fee,p_delivery_area,expected_delivery_fee,trim(p_payment_last3),clean_coupon_code,actual_discount,'pending')
 returning id into new_order_id;
 for item in select value from jsonb_array_elements(p_items) loop
  qty:=(item->>'quantity')::integer;
  select * into prod from public.products where id=(item->>'product_id')::uuid for update;
  insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,selected_color) values(new_order_id,prod.id,prod.name,prod.price,qty,nullif(item->>'selected_color',''));
  update public.products set stock=stock-qty where id=prod.id;
 end loop;
 return new_order_id;
end; $$;
revoke all on function public.place_order(text,text,text,text,jsonb,text,integer,text,text) from public;
grant execute on function public.place_order(text,text,text,text,jsonb,text,integer,text,text) to anon,authenticated;
