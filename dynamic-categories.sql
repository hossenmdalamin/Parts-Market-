-- PARTS MARKET: Dynamic category system migration
-- Run once in Supabase SQL Editor. Existing products and their category names are preserved.

create table if not exists public.categories (
  name text primary key,
  created_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(trim(name)) between 1 and 50)
);

alter table public.categories enable row level security;

drop policy if exists "public read categories" on public.categories;
create policy "public read categories"
on public.categories for select
to anon, authenticated
using (true);

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories"
on public.categories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

-- Seed current categories and any category names already used by products.
insert into public.categories(name)
values ('Brake'), ('Clutch'), ('Accessories'), ('Lighting'), ('Other')
on conflict (name) do nothing;

insert into public.categories(name)
select distinct trim(category)
from public.products
where category is not null and length(trim(category)) between 1 and 50
on conflict (name) do nothing;
