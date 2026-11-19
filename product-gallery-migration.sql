-- Run this once in Supabase SQL Editor to enable multiple product photos.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
