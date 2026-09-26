const { supabaseAdmin } = require('./supabaseAdmin')
const { startTrip } = require('./tracking')

const OFFER_TIMEOUT_MS = 20_000
const NO_CANDIDATE_RETRY_MS = 15_000

// offerId -> setTimeout handle (cleared on accept/reject)
const offerTimers = new Map()
// orderId -> setTimeout handle (cleared once a driver is assigned/order leaves READY)
const retryTimers = new Map()

function clearOfferTimer(offerId) {
  const timer = offerTimers.get(offerId)
  if (timer) {
    clearTimeout(timer)
    offerTimers.delete(offerId)
  }
}

function clearRetryTimer(orderId) {
  const timer = retryTimers.get(orderId)
  if (timer) {
    clearTimeout(timer)
    retryTimers.delete(orderId)
  }
}

// Distance dominates, but rating/workload/vehicle fit can flip a close call.
// Weights sum to 1; each sub-score is normalized to [0, 1].
const WEIGHTS = { distance: 0.45, rating: 0.2, workload: 0.15, vehicle: 0.2 }

function vehicleScore(vehicleType, distanceKm) {
  if (distanceKm <= 2) return 1
  if (distanceKm <= 5) return vehicleType === 'Bicycle' ? 0.6 : 1
  return vehicleType === 'Bicycle' ? 0.2 : 1
}

function scoreCandidate(candidate) {
  const distanceScore = 1 / (1 + candidate.distance_km)
  const ratingScore = Math.min(candidate.avg_rating, 5) / 5
  const workloadScore = 1 - candidate.active_orders / 2
  const vScore = vehicleScore(candidate.vehicle_type, candidate.distance_km)

  return (
    WEIGHTS.distance * distanceScore +
    WEIGHTS.rating * ratingScore +
    WEIGHTS.workload * workloadScore +
    WEIGHTS.vehicle * vScore
  )
}

// Who to leave out of the *next* pick for this order. REJECTED is a driver's
// explicit decline — respected permanently. EXPIRED just means they didn't
// answer in time (could be mid-delivery, distracted, whatever) — with only
// a handful of drivers online at once, permanently blacklisting them would
// strand the order forever, so only the single most-recently-tried driver
// is excluded, which rotates the offer to a different candidate each round
// instead of re-offering (or permanently skipping) the same person forever.
async function getExcludedDriverIds(orderId) {
  const { data } = await supabaseAdmin
    .from('order_assignment_offers')
    .select('driver_id, status')
    .eq('order_id', orderId)
    .order('offered_at', { ascending: false })

  const rows = data ?? []
  const excluded = new Set(rows.filter((r) => r.status === 'REJECTED').map((r) => r.driver_id))
  if (rows[0] && (rows[0].status === 'OFFERED' || rows[0].status === 'EXPIRED')) {
    excluded.add(rows[0].driver_id)
  }
  return excluded
}

async function assignDriverForOrder(orderId, io) {
  clearRetryTimer(orderId)

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, status, restaurant_id')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error(`[assignment] order ${orderId} not found`, orderError)
    return
  }
  // Guard against stale timers firing after the order moved on (assigned,
  // cancelled, etc.) — READY is the only state this engine acts on.
  if (order.status !== 'READY') return

  const { data: candidates, error: rpcError } = await supabaseAdmin.rpc(
    'find_candidate_drivers',
    { p_restaurant_id: order.restaurant_id },
  )

  if (rpcError) {
    console.error(`[assignment] find_candidate_drivers failed for order ${orderId}`, rpcError)
    return
  }

  const excluded = await getExcludedDriverIds(orderId)
  const untried = (candidates ?? []).filter((c) => !excluded.has(c.driver_id))

  if (untried.length === 0) {
    console.log(`[assignment] no available drivers for order ${orderId}, retrying in ${NO_CANDIDATE_RETRY_MS}ms`)
    const timer = setTimeout(() => assignDriverForOrder(orderId, io), NO_CANDIDATE_RETRY_MS)
    retryTimers.set(orderId, timer)
    return
  }

  const best = untried.reduce((top, candidate) => {
    const score = scoreCandidate(candidate)
    return !top || score > top.score ? { ...candidate, score } : top
  }, null)

  // A row for this (order, driver) pair may already exist from an earlier
  // EXPIRED attempt — the table's unique constraint means that has to be an
  // upsert, reopening the same row as freshly OFFERED, not a fresh insert.
  const { data: offer, error: offerError } = await supabaseAdmin
    .from('order_assignment_offers')
    .upsert(
      { order_id: orderId, driver_id: best.driver_id, status: 'OFFERED', offered_at: new Date().toISOString(), responded_at: null },
      { onConflict: 'order_id,driver_id' },
    )
    .select()
    .single()

  if (offerError) {
    console.error(`[assignment] failed to create offer for order ${orderId}`, offerError)
    return
  }

  console.log(
    `[assignment] offered order ${orderId} to driver ${best.driver_id} ` +
      `(score=${best.score.toFixed(3)}, distance=${best.distance_km.toFixed(2)}km)`,
  )

  io.to(`driver:${best.driver_id}`).emit('offer:new', {
    offerId: offer.id,
    orderId,
    distanceKm: best.distance_km,
    expiresInMs: OFFER_TIMEOUT_MS,
  })

  const timer = setTimeout(() => expireOffer(offer.id, orderId, io), OFFER_TIMEOUT_MS)
  offerTimers.set(offer.id, timer)
}

async function expireOffer(offerId, orderId, io) {
  offerTimers.delete(offerId)

  const { data } = await supabaseAdmin
    .from('order_assignment_offers')
    .update({ status: 'EXPIRED', responded_at: new Date().toISOString() })
    .eq('id', offerId)
    .eq('status', 'OFFERED')
    .select()
    .maybeSingle()

  // Only re-assign if this call actually transitioned the offer (guards
  // against a race where the driver responded a moment before expiry).
  if (data) {
    io.to(`driver:${data.driver_id}`).emit('offer:expired', { offerId, orderId })
    assignDriverForOrder(orderId, io)
  }
}

async function respondToOffer(offerId, driverId, action, io) {
  const nextStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED'

  const { data: offer, error } = await supabaseAdmin
    .from('order_assignment_offers')
    .update({ status: nextStatus, responded_at: new Date().toISOString() })
    .eq('id', offerId)
    .eq('driver_id', driverId)
    .eq('status', 'OFFERED')
    .select()
    .maybeSingle()

  if (error || !offer) {
    return { ok: false, reason: 'Offer is no longer available (expired or already answered).' }
  }

  clearOfferTimer(offerId)

  if (action === 'reject') {
    assignDriverForOrder(offer.order_id, io)
    return { ok: true }
  }

  const { data: updatedOrder, error: orderError } = await supabaseAdmin
    .from('orders')
    .update({ driver_id: driverId, status: 'DRIVER_ASSIGNED' })
    .eq('id', offer.order_id)
    .eq('status', 'READY')
    .select()
    .maybeSingle()

  if (orderError || !updatedOrder) {
    // Someone else got there first (shouldn't happen given the offer
    // model, but don't leave the offer stuck as ACCEPTED if it does).
    await supabaseAdmin.from('order_assignment_offers').update({ status: 'EXPIRED' }).eq('id', offerId)
    return { ok: false, reason: 'Order is no longer awaiting a driver.' }
  }

  io.to(`order:${offer.order_id}`).emit('order:update', updatedOrder)
  startTrip(offer.order_id, io)

  return { ok: true, order: updatedOrder }
}

// Called once on server boot. In-memory retry timers don't survive a
// restart, so any order left sitting at READY (e.g. because the process
// was restarted mid-dispatch, or every online driver had missed their
// window right when it went down) needs a fresh assignment attempt kicked
// off explicitly, instead of waiting forever for a timer that no longer exists.
async function recoverPendingAssignments(io) {
  const { data: stuckOrders, error } = await supabaseAdmin.from('orders').select('id').eq('status', 'READY')
  if (error) {
    console.error('[assignment] failed to load READY orders on startup', error)
    return
  }
  for (const order of stuckOrders ?? []) {
    console.log(`[assignment] recovering pending assignment for order ${order.id}`)
    assignDriverForOrder(order.id, io)
  }
}

module.exports = { assignDriverForOrder, respondToOffer, recoverPendingAssignments }
