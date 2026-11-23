-- Parts Market: optional per-product social video URLs
alter table public.products
  add column if not exists youtube_video_url text,
  add column if not exists facebook_video_url text,
  add column if not exists tiktok_video_url text;
