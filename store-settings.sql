-- PARTS MARKET: website branding and social links
create table if not exists public.store_settings (
  id integer primary key check (id = 1),
  store_name text not null default 'PARTS MARKET',
  logo_url text,
  facebook_url text not null default '',
  youtube_url text not null default '',
  tiktok_url text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.store_settings enable row level security;
drop policy if exists "public can read store settings" on public.store_settings;
create policy "public can read store settings" on public.store_settings for select using (true);
drop policy if exists "admins manage store settings" on public.store_settings;
create policy "admins manage store settings" on public.store_settings for all using (public.is_admin()) with check (public.is_admin());
insert into public.store_settings (id, store_name) values (1, 'PARTS MARKET') on conflict (id) do nothing;
