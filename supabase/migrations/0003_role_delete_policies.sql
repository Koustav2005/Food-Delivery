-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Needed for the OAuth "finish setup" flow: when a Google/Facebook user
-- picks restaurant/driver, the frontend deletes their default `customers`
-- row before inserting into the correct table. Without a delete policy,
-- RLS silently blocks that delete for the row's own owner.

create policy "Customers are deletable by owner" on public.customers
  for delete using (auth.uid() = id);

create policy "Restaurant partners are deletable by owner" on public.restaurant_partners
  for delete using (auth.uid() = id);

create policy "Drivers are deletable by owner" on public.drivers
  for delete using (auth.uid() = id);
