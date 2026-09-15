-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Builds on 0002_create_role_tables.sql (customers, restaurant_partners, drivers).
-- Adds restaurants, menus, addresses, orders, and ratings.

-- ============================================================
-- ENUMS
-- ============================================================

create type public.order_status as enum (
  'PLACED',
  'RESTAURANT_ACCEPTED',
  'RESTAURANT_REJECTED',
  'PREPARING',
  'READY',
  'DRIVER_ASSIGNED',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED'
);

-- ============================================================
-- RESTAURANTS  (a partner can run more than one outlet)
-- ============================================================

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.restaurant_partners (id) on delete cascade,
  name text not null,
  description text,
  cuisine_tags text[] not null default '{}',
  address_line text not null default '',
  city text not null default '',
  lat double precision,
  lng double precision,
  cover_image_url text,
  is_open boolean not null default true,          -- toggled by restaurant ("accepting orders")
  avg_prep_minutes int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_restaurants_owner on public.restaurants (owner_id);
create index idx_restaurants_city on public.restaurants (city);

-- ============================================================
-- MENU
-- ============================================================

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_menu_categories_restaurant on public.menu_categories (restaurant_id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  is_veg boolean not null default true,
  is_available boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_menu_items_restaurant on public.menu_items (restaurant_id);
create index idx_menu_items_category on public.menu_items (category_id);

-- ============================================================
-- CUSTOMER ADDRESSES
-- ============================================================

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null default 'Home',       -- Home / Work / Other
  address_line text not null,
  city text not null,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_customer_addresses_customer on public.customer_addresses (customer_id);

-- ============================================================
-- DRIVER LIVE STATE  (kept on the drivers table itself)
-- ============================================================

alter table public.drivers
  add column is_online boolean not null default false,
  add column current_lat double precision,
  add column current_lng double precision,
  add column last_location_at timestamptz;

-- ============================================================
-- ORDERS
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  restaurant_id uuid not null references public.restaurants (id),
  driver_id uuid references public.drivers (id),
  delivery_address_id uuid not null references public.customer_addresses (id),

  status public.order_status not null default 'PLACED',

  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null check (total >= 0),

  special_instructions text,

  placed_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_customer on public.orders (customer_id);
create index idx_orders_restaurant on public.orders (restaurant_id);
create index idx_orders_driver on public.orders (driver_id);
create index idx_orders_status on public.orders (status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id),
  item_name text not null,      -- snapshot, survives menu edits
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  notes text
);

create index idx_order_items_order on public.order_items (order_id);

-- Append-only audit trail, one row per status transition
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  changed_at timestamptz not null default now()
);

create index idx_order_status_history_order on public.order_status_history (order_id);

-- Auto-log every status change
create function public.log_order_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status)
    values (new.id, new.status);
  end if;
  return new;
end;
$$;

create trigger log_order_status_on_insert
  after insert on public.orders
  for each row execute procedure public.log_order_status_change();

create trigger log_order_status_on_update
  after update on public.orders
  for each row execute procedure public.log_order_status_change();

-- ============================================================
-- RATINGS  (one of each per order)
-- ============================================================

create table public.restaurant_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  restaurant_id uuid not null references public.restaurants (id),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index idx_restaurant_ratings_restaurant on public.restaurant_ratings (restaurant_id);

create table public.driver_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  driver_id uuid not null references public.drivers (id),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index idx_driver_ratings_driver on public.driver_ratings (driver_id);

-- ============================================================
-- updated_at TRIGGERS  (reuses set_updated_at from 0002)
-- ============================================================

create trigger set_restaurants_updated_at
  before update on public.restaurants
  for each row execute procedure public.set_updated_at();

create trigger set_menu_items_updated_at
  before update on public.menu_items
  for each row execute procedure public.set_updated_at();

create trigger set_orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.restaurant_ratings enable row level security;
alter table public.driver_ratings enable row level security;

-- Restaurants: anyone can browse, only the owner can write
create policy "Restaurants are publicly viewable" on public.restaurants
  for select using (true);
create policy "Restaurants are manageable by owner" on public.restaurants
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Menu: anyone can browse, only the owning restaurant's partner can write
create policy "Menu categories are publicly viewable" on public.menu_categories
  for select using (true);
create policy "Menu categories are manageable by owner" on public.menu_categories
  for all using (
    exists (select 1 from public.restaurants r
            where r.id = restaurant_id and r.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.restaurants r
            where r.id = restaurant_id and r.owner_id = auth.uid())
  );

create policy "Menu items are publicly viewable" on public.menu_items
  for select using (true);
create policy "Menu items are manageable by owner" on public.menu_items
  for all using (
    exists (select 1 from public.restaurants r
            where r.id = restaurant_id and r.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.restaurants r
            where r.id = restaurant_id and r.owner_id = auth.uid())
  );

-- Addresses: private to the customer
create policy "Addresses are manageable by owner" on public.customer_addresses
  for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

-- Orders: visible to the customer, the restaurant owner, and the assigned driver
create policy "Orders are viewable by participants" on public.orders
  for select using (
    auth.uid() = customer_id
    or auth.uid() = driver_id
    or exists (select 1 from public.restaurants r
               where r.id = restaurant_id and r.owner_id = auth.uid())
  );

create policy "Orders are insertable by the customer" on public.orders
  for insert with check (auth.uid() = customer_id);

-- Customer can only cancel; restaurant/driver update via their own status transitions.
-- (Enforce the exact allowed transitions in your app/API layer, not just RLS.)
create policy "Orders are updatable by participants" on public.orders
  for update using (
    auth.uid() = customer_id
    or auth.uid() = driver_id
    or exists (select 1 from public.restaurants r
               where r.id = restaurant_id and r.owner_id = auth.uid())
  );

-- Order items: same visibility as the parent order
create policy "Order items follow order visibility" on public.order_items
  for select using (
    exists (select 1 from public.orders o
            where o.id = order_id
              and (auth.uid() = o.customer_id
                   or auth.uid() = o.driver_id
                   or exists (select 1 from public.restaurants r
                              where r.id = o.restaurant_id and r.owner_id = auth.uid())))
  );

create policy "Order items are insertable by the customer" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o
            where o.id = order_id and o.customer_id = auth.uid())
  );

-- Status history: same visibility as the parent order, no direct writes
-- (rows are created only by the log_order_status_change trigger, which runs as security definer)
create policy "Order status history follows order visibility" on public.order_status_history
  for select using (
    exists (select 1 from public.orders o
            where o.id = order_id
              and (auth.uid() = o.customer_id
                   or auth.uid() = o.driver_id
                   or exists (select 1 from public.restaurants r
                              where r.id = o.restaurant_id and r.owner_id = auth.uid())))
  );

-- Ratings: publicly viewable (for restaurant/driver profile pages),
-- but only the customer on that order can create one
create policy "Restaurant ratings are publicly viewable" on public.restaurant_ratings
  for select using (true);
create policy "Restaurant ratings are insertable by the customer" on public.restaurant_ratings
  for insert with check (
    auth.uid() = customer_id
    and exists (select 1 from public.orders o
                where o.id = order_id and o.customer_id = auth.uid()
                  and o.status = 'DELIVERED')
  );

create policy "Driver ratings are publicly viewable" on public.driver_ratings
  for select using (true);
create policy "Driver ratings are insertable by the customer" on public.driver_ratings
  for insert with check (
    auth.uid() = customer_id
    and exists (select 1 from public.orders o
                where o.id = order_id and o.customer_id = auth.uid()
                  and o.status = 'DELIVERED')
  );