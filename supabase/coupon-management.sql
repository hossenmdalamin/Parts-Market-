-- Parts Market coupon management and checkout integration
-- Run once in Supabase SQL Editor.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

UPDATE public.coupons
SET active = COALESCE(active, is_active, true),
    used_count = COALESCE(used_count, 0);

ALTER TABLE public.coupons
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN used_count SET DEFAULT 0,
  ALTER COLUMN used_count SET NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;

-- Only an actual admin profile may manage coupons from the Admin Panel.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated users manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin users manage coupons" ON public.coupons;

CREATE POLICY "Admin users manage coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Validate a coupon for checkout. Returns NULL for invalid, inactive,
-- or exhausted coupons. The order function rechecks and reserves usage atomically.
CREATE OR REPLACE FUNCTION public.get_coupon_discount(p_coupon_code text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.discount_amount
  FROM public.coupons AS c
  WHERE c.code = upper(trim(coalesce(p_coupon_code, '')))
    AND c.active = true
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_coupon_discount(text) TO anon, authenticated;

-- Checkout RPC with coupon support. The old 8-argument function is preserved.
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
  qty integer;
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

  IF expected_delivery_fee IS NULL
     OR p_delivery_fee IS DISTINCT FROM expected_delivery_fee THEN
    RAISE EXCEPTION 'Invalid delivery area or delivery charge';
  END IF;

  -- Lock products and calculate the trusted subtotal from database prices.
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    qty := (item->>'quantity')::integer;
    IF qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    SELECT * INTO prod
    FROM public.products
    WHERE id = (item->>'product_id')::uuid
      AND active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A selected product is unavailable';
    END IF;

    IF prod.stock < qty THEN
      RAISE EXCEPTION 'Insufficient stock for %', prod.name;
    END IF;

    order_subtotal := order_subtotal + prod.price * qty;
  END LOOP;

  -- Reserve one use atomically so simultaneous checkouts cannot exceed the limit.
  IF normalized_coupon IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE code = normalized_coupon
      AND active = true
      AND (max_uses IS NULL OR used_count < max_uses)
    RETURNING discount_amount INTO coupon_discount;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coupon is invalid, inactive, or its usage limit has been reached';
    END IF;

    applied_discount := LEAST(coupon_discount, FLOOR(order_subtotal)::integer);
  END IF;

  INSERT INTO public.orders (
    customer_name, phone, address, note, total,
    delivery_area, delivery_fee, payment_last3, status,
    coupon_code, discount_amount
  )
  VALUES (
    trim(p_customer_name), trim(p_phone), trim(p_address),
    coalesce(p_note, ''),
    order_subtotal - applied_discount + expected_delivery_fee,
    p_delivery_area, expected_delivery_fee, trim(p_payment_last3), 'pending',
    normalized_coupon, applied_discount
  )
  RETURNING id INTO new_order_id;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    qty := (item->>'quantity')::integer;

    SELECT * INTO prod
    FROM public.products
    WHERE id = (item->>'product_id')::uuid;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, selected_color
    )
    VALUES (
      new_order_id, prod.id, prod.name, prod.price, qty,
      nullif(item->>'selected_color', '')
    );

    UPDATE public.products
    SET stock = stock - qty
    WHERE id = prod.id;
  END LOOP;

  RETURN new_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.place_order(
  text, text, text, text, integer, jsonb, text, text, text
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
