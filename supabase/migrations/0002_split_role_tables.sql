-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Supersedes 0001_create_profiles.sql: replaces the single `profiles` table
-- (with a role column and mostly-null role-specific fields) with one table
-- per role, each holding only the columns that role actually needs.
-- Safe to run whether or not 0001_create_profiles.sql was already applied.

drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();
drop table if exists public.profiles;
drop type if exists public.user_role;
drop type if exists public.vehicle_type;

create type public.vehicle_type as enum ('Bicycle', 'Scooter', 'Motorbike', 'Car');

create table public.customers (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_partners (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  restaurant_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  vehicle_type public.vehicle_type,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.restaurant_partners enable row level security;
alter table public.drivers enable row level security;

create policy "Customers are viewable by owner" on public.customers
  for select using (auth.uid() = id);
create policy "Customers are updatable by owner" on public.customers
  for update using (auth.uid() = id);
create policy "Customers are insertable by owner" on public.customers
  for insert with check (auth.uid() = id);

create policy "Restaurant partners are viewable by owner" on public.restaurant_partners
  for select using (auth.uid() = id);
create policy "Restaurant partners are updatable by owner" on public.restaurant_partners
  for update using (auth.uid() = id);
create policy "Restaurant partners are insertable by owner" on public.restaurant_partners
  for insert with check (auth.uid() = id);

create policy "Drivers are viewable by owner" on public.drivers
  for select using (auth.uid() = id);
create policy "Drivers are updatable by owner" on public.drivers
  for update using (auth.uid() = id);
create policy "Drivers are insertable by owner" on public.drivers
  for insert with check (auth.uid() = id);

-- Routes each new auth user into the correct role table based on the
-- metadata passed via supabase.auth.signUp({ options: { data: {...} } }).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  selected_role text := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'customer');
  full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  contact_phone text := new.raw_user_meta_data->>'phone';
begin
  if selected_role = 'restaurant' then
    insert into public.restaurant_partners (id, full_name, email, phone, restaurant_name)
    values (new.id, full_name, new.email, contact_phone, coalesce(new.raw_user_meta_data->>'restaurant_name', ''))
    on conflict (id) do nothing;
  elsif selected_role = 'driver' then
    insert into public.drivers (id, full_name, email, phone, vehicle_type)
    values (new.id, full_name, new.email, contact_phone, nullif(new.raw_user_meta_data->>'vehicle_type', '')::public.vehicle_type)
    on conflict (id) do nothing;
  else
    insert into public.customers (id, full_name, email, phone)
    values (new.id, full_name, new.email, contact_phone)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

create trigger set_restaurant_partners_updated_at
  before update on public.restaurant_partners
  for each row execute procedure public.set_updated_at();

create trigger set_drivers_updated_at
  before update on public.drivers
  for each row execute procedure public.set_updated_at();

-- Read-only convenience view to find which role table a user belongs to,
-- e.g. for routing after login or for RLS on future tables (orders, etc.).
create view public.user_roles as
  select id, 'customer'::text as role from public.customers
  union all
  select id, 'restaurant'::text as role from public.restaurant_partners
  union all
  select id, 'driver'::text as role from public.drivers;
