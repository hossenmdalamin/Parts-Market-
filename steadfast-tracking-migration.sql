-- Parts Market: Steadfast tracking fields and privacy-safe public lookup
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists consignment_id text;
alter table public.orders add column if not exists tracking_code text;
alter table public.orders add column if not exists courier_status text;

create or replace function public.track_public_order(p_order_id text, p_phone text)
returns table(order_id text, order_status text, courier_name text, consignment_id text, tracking_code text, courier_status text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select o.id::text, o.status::text, o.courier_name, o.consignment_id, o.tracking_code, o.courier_status, o.created_at
  from public.orders o
  where o.id::text = trim(p_order_id)
    and regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
  limit 1;
$$;
revoke all on function public.track_public_order(text,text) from public;
grant execute on function public.track_public_order(text,text) to anon, authenticated;
