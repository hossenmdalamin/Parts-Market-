-- PARTS MARKET: editable storefront news ticker
alter table public.store_settings
  add column if not exists ticker_message text not null default '',
  add column if not exists ticker_enabled boolean not null default false;

-- Existing public SELECT policy on store_settings lets storefront pages read these fields.
-- Existing admins-manage-store-settings policy controls writes.
