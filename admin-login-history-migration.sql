-- Parts Market: Main Admin and protected admin login history
-- Run once in Supabase SQL Editor after the Main Admin account exists in Authentication > Users.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer','admin','main_admin'));

-- Ensure there is exactly one Main Admin: the specified Auth account.
update public.profiles set role = 'admin' where role = 'main_admin';
insert into public.profiles (id, role)
select id, 'main_admin'
from auth.users
where lower(email) = lower('hossenmdalamin608@gmail.com')
on conflict (id) do update set role = 'main_admin';

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','main_admin')
  );
$$;

create or replace function public.is_main_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'main_admin'
  );
$$;

create table if not exists public.admin_login_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  logged_in_at timestamptz not null default now()
);

alter table public.admin_login_history enable row level security;
revoke all on public.admin_login_history from anon, authenticated;
grant select on public.admin_login_history to authenticated;

drop policy if exists "main admin can read login history" on public.admin_login_history;
create policy "main admin can read login history"
  on public.admin_login_history
  for select to authenticated
  using (public.is_main_admin());

create or replace function public.record_admin_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select email into current_email from auth.users where id = auth.uid();
  if current_email is null then
    raise exception 'Authenticated email not found';
  end if;

  insert into public.admin_login_history(user_id, email)
  values (auth.uid(), current_email);
end;
$$;

revoke all on function public.record_admin_login() from public, anon;
grant execute on function public.record_admin_login() to authenticated;
