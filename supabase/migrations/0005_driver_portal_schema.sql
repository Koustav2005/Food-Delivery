-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Builds on 0004_full_initial_schema.sql.
-- Adds the tables needed for the Delivery Partner Portal: multi-driver
-- dispatch/offers, earnings ledger, payout accounts, KYC documents, and
-- online-session tracking.

-- ============================================================
-- ORDER ASSIGNMENT OFFERS  (dispatch: offer -> accept/reject/expire)
-- ============================================================

create type public.offer_status as enum ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

create table public.order_assignment_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  status public.offer_status not null default 'OFFERED',
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (order_id, driver_id)
);

create index idx_order_assignment_offers_order on public.order_assignment_offers (order_id);
create index idx_order_assignment_offers_driver on public.order_assignment_offers (driver_id);

-- ============================================================
-- DRIVER PAYOUTS  (per-delivery earnings ledger)
-- ============================================================

create type public.payout_status as enum ('PENDING', 'PAID', 'FAILED');

create table public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  status public.payout_status not null default 'PENDING',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_driver_payouts_driver on public.driver_payouts (driver_id);

-- ============================================================
-- DRIVER BANK ACCOUNTS  (for instant payouts)
-- ============================================================

create table public.driver_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.drivers (id) on delete cascade,
  account_holder_name text not null,
  account_number text not null,
  ifsc_code text,
  upi_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DRIVER DOCUMENTS  (KYC: license, RC, insurance, id proof)
-- ============================================================

create type public.document_status as enum ('PENDING', 'VERIFIED', 'REJECTED');

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  doc_type text not null,        -- 'license' | 'rc' | 'insurance' | 'id_proof'
  file_url text not null,
  status public.document_status not null default 'PENDING',
  rejection_reason text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index idx_driver_documents_driver on public.driver_documents (driver_id);

-- ============================================================
-- DRIVER ONLINE SESSIONS  (online/offline history, hours worked)
-- ============================================================

create table public.driver_online_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index idx_driver_online_sessions_driver on public.driver_online_sessions (driver_id);

-- ============================================================
-- updated_at TRIGGERS  (reuses set_updated_at from 0002)
-- ============================================================

create trigger set_driver_bank_accounts_updated_at
  before update on public.driver_bank_accounts
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.order_assignment_offers enable row level security;
alter table public.driver_payouts enable row level security;
alter table public.driver_bank_accounts enable row level security;
alter table public.driver_documents enable row level security;
alter table public.driver_online_sessions enable row level security;

-- Assignment offers: a driver sees and responds to only their own offers.
-- Offer creation (deciding who to dispatch to next) happens via a
-- security-definer function or the backend service role, not client insert.
create policy "Drivers view their own offers" on public.order_assignment_offers
  for select using (auth.uid() = driver_id);
create policy "Drivers respond to their own offers" on public.order_assignment_offers
  for update using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

-- Payouts: read-only to the owning driver. Rows are created by a
-- trigger/backend job when an order reaches DELIVERED, not by the client.
create policy "Driver payouts are viewable by owner" on public.driver_payouts
  for select using (auth.uid() = driver_id);

-- Bank accounts: fully private, owner-managed.
create policy "Driver bank accounts are manageable by owner" on public.driver_bank_accounts
  for all using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

-- Documents: driver can view and upload their own; review/status changes
-- are admin/service-role only (no driver update policy).
create policy "Driver documents are viewable by owner" on public.driver_documents
  for select using (auth.uid() = driver_id);
create policy "Driver documents are insertable by owner" on public.driver_documents
  for insert with check (auth.uid() = driver_id);

-- Online sessions: owner-managed (start/end their own shift).
create policy "Driver sessions are manageable by owner" on public.driver_online_sessions
  for all using (auth.uid() = driver_id) with check (auth.uid() = driver_id);
