const { supabaseAdmin } = require('./supabaseAdmin')

// Simulated GPS: interpolates a driver's lat/lng along a straight line for
// the current leg of the trip (driver -> restaurant, then restaurant ->
// customer) and broadcasts it over Socket.IO. There's no real GPS device
// involved, so this is what "live tracking" means in this app.
const LEG_DURATION_MS = 24_000
const TICK_MS = 1500

// orderId -> setInterval handle
const activeTrips = new Map()

function stopTrip(orderId) {
  const interval = activeTrips.get(orderId)
  if (interval) {
    clearInterval(interval)
    activeTrips.delete(orderId)
  }
}

async function startTrip(orderId, io) {
  stopTrip(orderId)

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, driver_id, restaurant_id, delivery_address_id')
    .eq('id', orderId)
    .single()

  if (!order || !order.driver_id) return
  if (order.status !== 'DRIVER_ASSIGNED' && order.status !== 'PICKED_UP') return

  const [{ data: driver }, { data: restaurant }, { data: address }] = await Promise.all([
    supabaseAdmin.from('drivers').select('current_lat, current_lng').eq('id', order.driver_id).single(),
    supabaseAdmin.from('restaurants').select('lat, lng').eq('id', order.restaurant_id).single(),
    supabaseAdmin.from('customer_addresses').select('lat, lng').eq('id', order.delivery_address_id).single(),
  ])

  if (!restaurant || !address) return

  const start =
    order.status === 'DRIVER_ASSIGNED'
      ? { lat: driver?.current_lat ?? restaurant.lat, lng: driver?.current_lng ?? restaurant.lng }
      : { lat: restaurant.lat, lng: restaurant.lng }
  const end = order.status === 'DRIVER_ASSIGNED' ? { lat: restaurant.lat, lng: restaurant.lng } : { lat: address.lat, lng: address.lng }

  const steps = Math.round(LEG_DURATION_MS / TICK_MS)
  let step = 0

  const interval = setInterval(async () => {
    step += 1
    const t = Math.min(step / steps, 1)
    const lat = start.lat + (end.lat - start.lat) * t
    const lng = start.lng + (end.lng - start.lng) * t

    await supabaseAdmin
      .from('drivers')
      .update({ current_lat: lat, current_lng: lng, last_location_at: new Date().toISOString() })
      .eq('id', order.driver_id)

    io.to(`order:${orderId}`).emit('driver:location', { orderId, lat, lng, leg: order.status })

    if (t >= 1) stopTrip(orderId)
  }, TICK_MS)

  activeTrips.set(orderId, interval)
}

module.exports = { startTrip, stopTrip }
