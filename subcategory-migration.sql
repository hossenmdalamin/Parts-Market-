-- Parts Market: add one-level sub-catalogues under main categories.
-- Run this script once in Supabase SQL Editor AFTER dynamic-categories.sql.
alter table public.categories
  add column if not exists parent_name text null;

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
      on delete restrict;
  end if;
end $$;

create index if not exists categories_parent_name_idx
  on public.categories(parent_name);

-- Prevent a category from being its own parent.
alter table public.categories
  drop constraint if exists categories_not_own_parent;
alter table public.categories
  add constraint categories_not_own_parent
  check (parent_name is null or parent_name <> name);
