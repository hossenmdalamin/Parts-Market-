-- PARTS MARKET: Parent/child category support
-- Review this migration and run it in Supabase SQL Editor before merging/deploying
-- the category accordion UI. Existing category names and product.category values remain unchanged.

alter table public.categories
  add column if not exists parent_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'categories_parent_name_fkey'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_parent_name_fkey
      foreign key (parent_name)
      references public.categories(name)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists categories_parent_name_idx
  on public.categories(parent_name);

-- Existing categories stay as top-level categories (parent_name = NULL).
-- To create a subcategory, set its parent_name to an existing category name.
