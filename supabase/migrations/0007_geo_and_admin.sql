-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Builds on 0004_full_initial_schema.sql.
-- 1) Guarantees every restaurant/address/driver has a lat/lng so the
--    tracking simulator always has real coordinates to interpolate along.
-- 2) Adds a lightweight `admins` table + read-only cross-table RLS
--    policies for the internal admin dashboard (no separate signup flow —
--    an operator's existing auth user is inserted into this table by hand).

-- ============================================================
-- BACKFILL + DEFAULT COORDINATES  (Bengaluru city center + small jitter)
-- ============================================================

update public.restaurants
  set lat = 12.9716 + (random() - 0.5) * 0.08,
      lng = 77.5946 + (random() - 0.5) * 0.08
  where lat is null or lng is null;

alter table public.restaurants
  alter column lat set default 12.9716,
  alter column lng set default 77.5946,
  alter column lat set not null,
  alter column lng set not null;

update public.customer_addresses
  set lat = 12.9716 + (random() - 0.5) * 0.08,
      lng = 77.5946 + (random() - 0.5) * 0.08
  where lat is null or lng is null;

alter table public.customer_addresses
  alter column lat set default 12.9716,
  alter column lng set default 77.5946,
  alter column lat set not null,
  alter column lng set not null;

update public.drivers
  set current_lat = 12.9716 + (random() - 0.5) * 0.08,
      current_lng = 77.5946 + (random() - 0.5) * 0.08
  where is_online = true and (current_lat is null or current_lng is null);

alter table public.drivers
  alter column current_lat set default 12.9716,
  alter column current_lng set default 77.5946;

create index idx_drivers_online on public.drivers (is_online) where is_online;

-- ============================================================
-- ADMINS
-- ============================================================

create table public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "Admins are viewable by self" on public.admins
  for select using (auth.uid() = id);

-- Cross-table read access for the admin dashboard. Existing per-owner
-- select policies stay in place; these are additional "or" policies on
-- the same command, not replacements.
create policy "Admins can view all customers" on public.customers
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "Admins can view all restaurant partners" on public.restaurant_partners
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "Admins can view all drivers" on public.drivers
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "Admins can view all addresses" on public.customer_addresses
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "Admins can view all orders" on public.orders
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "Admins can view all order items" on public.order_items
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "Admins can view all order status history" on public.order_status_history
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "Admins can view all driver payouts" on public.driver_payouts
  for select using (exists (select 1 from public.admins a where a.id = auth.uid()));

-- To grant yourself admin access, run (after signing up as any role):
--   insert into public.admins (id, email)
--   values ('<your-auth-user-uuid>', '<your-email>');
