-- Parts Market: per-colour price, stock and image gallery
-- Run once in Supabase SQL Editor after the existing coupon-management.sql migration.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.products
  ALTER COLUMN variants SET DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.place_order(
  p_address text,
  p_coupon_code text,
  p_customer_name text,
  p_delivery_area text,
  p_delivery_fee integer,
  p_items jsonb,
  p_note text,
  p_payment_last3 text,
  p_phone text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_order_id bigint;
  item jsonb;
  prod public.products%rowtype;
  selected_variant jsonb;
  qty integer;
  selected_color text;
  item_price numeric(12,2);
  item_stock integer;
  order_subtotal numeric(12,2) := 0;
  expected_delivery_fee integer;
  coupon_discount integer := 0;
  applied_discount integer := 0;
  normalized_coupon text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
BEGIN
  IF length(trim(coalesce(p_customer_name, ''))) < 2
     OR length(trim(coalesce(p_phone, ''))) < 8
     OR length(trim(coalesce(p_address, ''))) < 8
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Please provide valid customer and order details';
  END IF;

  IF coalesce(p_payment_last3, '') !~ '^[0-9]{3}$' THEN
    RAISE EXCEPTION 'Enter the last 3 digits of your payment transaction';
  END IF;

  expected_delivery_fee := CASE p_delivery_area
    WHEN 'inside_dhaka' THEN 80
    WHEN 'outside_dhaka' THEN 150
    ELSE NULL
  END;
  IF expected_delivery_fee IS NULL OR p_delivery_fee IS DISTINCT FROM expected_delivery_fee THEN
    RAISE EXCEPTION 'Invalid delivery area or delivery charge';
  END IF;

  -- Lock every product row and validate the selected colour's authoritative price/stock.
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    qty := (item->>'quantity')::integer;
    selected_color := nullif(trim(coalesce(item->>'selected_color','')), '');
    IF qty < 1 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT * INTO prod FROM public.products
    WHERE id = (item->>'product_id')::uuid AND active = true
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A selected product is unavailable'; END IF;

    IF jsonb_typeof(prod.variants) = 'array' AND jsonb_array_length(prod.variants) > 0 THEN
      IF selected_color IS NULL THEN RAISE EXCEPTION 'Please select a colour for %', prod.name; END IF;
      SELECT value INTO selected_variant
      FROM jsonb_array_elements(prod.variants)
      WHERE lower(value->>'name') = lower(selected_color)
      LIMIT 1;
      IF selected_variant IS NULL THEN RAISE EXCEPTION 'Selected colour is unavailable for %', prod.name; END IF;
      item_price := (selected_variant->>'price')::numeric;
      item_stock := (selected_variant->>'stock')::integer;
    ELSE
      item_price := prod.price;
      item_stock := prod.stock;
    END IF;
    IF item_stock < qty THEN RAISE EXCEPTION 'Insufficient stock for % (%).', prod.name, coalesce(selected_color,'default'); END IF;
    order_subtotal := order_subtotal + item_price * qty;
  END LOOP;

  IF normalized_coupon IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE code = normalized_coupon AND active = true
      AND (max_uses IS NULL OR used_count < max_uses)
    RETURNING discount_amount INTO coupon_discount;
    IF NOT FOUND THEN RAISE EXCEPTION 'Coupon is invalid, inactive, or its usage limit has been reached'; END IF;
    applied_discount := LEAST(coupon_discount, FLOOR(order_subtotal)::integer);
  END IF;

  INSERT INTO public.orders (
    customer_name, phone, address, note, total, delivery_area, delivery_fee,
    payment_last3, status, coupon_code, discount_amount
  ) VALUES (
    trim(p_customer_name), trim(p_phone), trim(p_address), coalesce(p_note, ''),
    order_subtotal - applied_discount + expected_delivery_fee, p_delivery_area,
    expected_delivery_fee, trim(p_payment_last3), 'pending', normalized_coupon, applied_discount
  ) RETURNING id INTO new_order_id;

  -- Save the exact selected colour and price, then decrement that colour's stock.
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    qty := (item->>'quantity')::integer;
    selected_color := nullif(trim(coalesce(item->>'selected_color','')), '');
    SELECT * INTO prod FROM public.products WHERE id = (item->>'product_id')::uuid;

    IF jsonb_typeof(prod.variants) = 'array' AND jsonb_array_length(prod.variants) > 0 THEN
      SELECT value INTO selected_variant
      FROM jsonb_array_elements(prod.variants)
      WHERE lower(value->>'name') = lower(selected_color)
      LIMIT 1;
      item_price := (selected_variant->>'price')::numeric;
      UPDATE public.products
      SET variants = (
        SELECT jsonb_agg(
          CASE WHEN lower(v->>'name') = lower(selected_color)
            THEN jsonb_set(v, '{stock}', to_jsonb((v->>'stock')::integer - qty), true)
            ELSE v END
        )
        FROM jsonb_array_elements(prod.variants) AS v
      )
      WHERE id = prod.id;
    ELSE
      item_price := prod.price;
      UPDATE public.products SET stock = stock - qty WHERE id = prod.id;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, selected_color
    ) VALUES (
      new_order_id, prod.id, prod.name, item_price, qty, selected_color
    );
  END LOOP;

  RETURN new_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, integer, jsonb, text, text, text
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
