-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Builds on 0004_full_initial_schema.sql (orders, restaurants).
-- Adds what's needed for the restaurant portal's order actions: Accept,
-- Reject, Prepare, Mark ready.
--
-- 0004's RLS comment flagged that the orders update policy lets any
-- participant (customer, driver, or restaurant owner) write any status,
-- with transition rules left to the app layer. This migration closes that
-- gap for the restaurant-owned leg of the flow: it enforces the legal
-- PLACED -> RESTAURANT_ACCEPTED/RESTAURANT_REJECTED -> PREPARING -> READY
-- transitions and requires the caller to be the order's restaurant owner.
-- Transitions from READY onward (driver pickup/delivery) and
-- customer-initiated cancellation are outside this scope and pass through
-- unchanged.

alter table public.orders
  add column rejection_reason text,
  add column preparing_at timestamptz;

create function public.enforce_restaurant_order_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_owner boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  -- Only PLACED / RESTAURANT_ACCEPTED / PREPARING are the restaurant's to
  -- validate here; everything else is another part of the system.
  if old.status not in ('PLACED', 'RESTAURANT_ACCEPTED', 'PREPARING') then
    return new;
  end if;

  -- Cancellation (e.g. by the customer, or the restaurant backing out) is
  -- allowed through from any of these states without restriction here.
  if new.status = 'CANCELLED' then
    return new;
  end if;

  select exists (
    select 1 from public.restaurants r
    where r.id = new.restaurant_id and r.owner_id = auth.uid()
  ) into is_owner;

  if old.status = 'PLACED' then
    if new.status = 'RESTAURANT_ACCEPTED' then
      if not is_owner then
        raise exception 'Only the restaurant owner can accept an order';
      end if;
      new.accepted_at := coalesce(new.accepted_at, now());
    elsif new.status = 'RESTAURANT_REJECTED' then
      if not is_owner then
        raise exception 'Only the restaurant owner can reject an order';
      end if;
      if new.rejection_reason is null or btrim(new.rejection_reason) = '' then
        raise exception 'rejection_reason is required when rejecting an order';
      end if;
      new.cancelled_at := coalesce(new.cancelled_at, now());
    else
      raise exception 'Invalid status transition from PLACED to %', new.status;
    end if;
    return new;
  end if;

  if old.status = 'RESTAURANT_ACCEPTED' then
    if new.status = 'PREPARING' then
      if not is_owner then
        raise exception 'Only the restaurant owner can mark an order as preparing';
      end if;
      new.preparing_at := coalesce(new.preparing_at, now());
    else
      raise exception 'Invalid status transition from RESTAURANT_ACCEPTED to %', new.status;
    end if;
    return new;
  end if;

  if old.status = 'PREPARING' then
    if new.status = 'READY' then
      if not is_owner then
        raise exception 'Only the restaurant owner can mark an order ready';
      end if;
      new.ready_at := coalesce(new.ready_at, now());
    else
      raise exception 'Invalid status transition from PREPARING to %', new.status;
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger enforce_restaurant_order_transition
  before update on public.orders
  for each row execute procedure public.enforce_restaurant_order_transition();
