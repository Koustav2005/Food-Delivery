-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Extends auth.users with the app-specific profile data collected on sign up.

create type public.user_role as enum ('customer', 'restaurant', 'driver');
create type public.vehicle_type as enum ('Bicycle', 'Scooter', 'Motorbike', 'Car');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role public.user_role not null default 'customer',
  restaurant_name text,
  vehicle_type public.vehicle_type,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created (email/password or OAuth).
-- Reads metadata passed via supabase.auth.signUp({ options: { data: {...} } }).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, restaurant_name, vehicle_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'customer')::public.user_role,
    new.raw_user_meta_data->>'restaurant_name',
    nullif(new.raw_user_meta_data->>'vehicle_type', '')::public.vehicle_type
  )
  on conflict (id) do nothing;
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

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
