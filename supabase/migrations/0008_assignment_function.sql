-- Run this in the Supabase Dashboard: SQL Editor > New query
-- Builds on 0004_full_initial_schema.sql / 0005_driver_portal_schema.sql.
-- Backend-only helper for the auto driver-assignment engine: given a
-- restaurant, returns every online, not-currently-busy driver together
-- with the signals the scoring function needs (distance, workload,
-- rating, vehicle type). The Node backend calls this via RPC using the
-- service role key; `security definer` also lets it run correctly even
-- if called with a lesser key, since it only ever returns aggregates,
-- never raw rows a driver shouldn't see.

create or replace function public.find_candidate_drivers(p_restaurant_id uuid)
returns table (
  driver_id uuid,
  full_name text,
  vehicle_type public.vehicle_type,
  distance_km double precision,
  active_orders int,
  avg_rating numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.id as driver_id,
    d.full_name,
    d.vehicle_type,
    -- Haversine distance in km between the driver's last known position
    -- and the restaurant.
    (
      6371 * acos(
        greatest(-1, least(1,
          cos(radians(r.lat)) * cos(radians(d.current_lat)) *
            cos(radians(d.current_lng) - radians(r.lng)) +
          sin(radians(r.lat)) * sin(radians(d.current_lat))
        ))
      )
    ) as distance_km,
    (
      select count(*)::int from public.orders o
      where o.driver_id = d.id
        and o.status in ('DRIVER_ASSIGNED', 'PICKED_UP')
    ) as active_orders,
    coalesce(
      (select avg(dr.rating)::numeric from public.driver_ratings dr where dr.driver_id = d.id),
      4.5
    ) as avg_rating
  from public.drivers d
  cross join public.restaurants r
  where r.id = p_restaurant_id
    and d.is_online = true
    and d.current_lat is not null
    and d.current_lng is not null
    -- Cap concurrent deliveries per driver at 2 so workload stays bounded.
    and (
      select count(*) from public.orders o
      where o.driver_id = d.id
        and o.status in ('DRIVER_ASSIGNED', 'PICKED_UP')
    ) < 2
  order by distance_km asc;
$$;

grant execute on function public.find_candidate_drivers(uuid) to service_role, authenticated, anon;
