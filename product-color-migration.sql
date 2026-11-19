-- PARTS MARKET: product color options and order item color
alter table public.products
  add column if not exists colors text[] not null default '{}';

alter table public.order_items
  add column if not exists selected_color text;

create or replace function public.place_order(
  p_customer_name text, p_phone text, p_address text, p_note text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  new_order_id bigint;
  item jsonb;
  prod public.products%rowtype;
  qty integer;
  selected_color text;
  order_total numeric(12,2) := 0;
begin
  if length(trim(coalesce(p_customer_name,''))) < 2
     or length(trim(coalesce(p_phone,''))) < 8
     or length(trim(coalesce(p_address,''))) < 8
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Please provide valid customer and order details';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    qty := (item->>'quantity')::integer;
    selected_color := nullif(trim(coalesce(item->>'selected_color','')), '');
    if qty < 1 then raise exception 'Invalid quantity'; end if;
    select * into prod from public.products
      where id = (item->>'product_id')::uuid and active = true
      for update;
    if not found then raise exception 'A selected product is unavailable'; end if;
    if prod.stock < qty then raise exception 'Insufficient stock for %', prod.name; end if;
    if coalesce(array_length(prod.colors,1),0) > 0
       and (selected_color is null or not (selected_color = any(prod.colors))) then
      raise exception 'Please select an available color for %', prod.name;
    end if;
    if coalesce(array_length(prod.colors,1),0) = 0 and selected_color is not null then
      raise exception 'This product does not have color options';
    end if;
    order_total := order_total + prod.price * qty;
  end loop;

  insert into public.orders(customer_name,phone,address,note,total)
  values(trim(p_customer_name),trim(p_phone),trim(p_address),coalesce(p_note,''),order_total)
  returning id into new_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    qty := (item->>'quantity')::integer;
    selected_color := nullif(trim(coalesce(item->>'selected_color','')), '');
    select * into prod from public.products where id = (item->>'product_id')::uuid for update;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,selected_color)
    values(new_order_id,prod.id,prod.name,prod.price,qty,selected_color);
    update public.products set stock = stock - qty where id = prod.id;
  end loop;
  return new_order_id;
end; $$;

revoke all on function public.place_order(text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,jsonb) to anon, authenticated;
