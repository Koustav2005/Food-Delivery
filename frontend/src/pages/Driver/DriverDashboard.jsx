import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../utils/supabase'
import { socket } from '../../realtime/socket'
import LiveMap from '../../shared/LiveMap'
import './DriverDashboard.css'

const TABS = ['dashboard', 'earnings', 'history']
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

async function post(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default function DriverDashboard({ user }) {
  const [driver, setDriver] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [offer, setOffer] = useState(null)

  useEffect(() => {
    let active = true
    supabase
      .from('drivers')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => active && setDriver(data))

    socket.emit('join:driver', user.id)

    const onOfferNew = async (payload) => {
      const { data: order } = await supabase
        .from('orders')
        .select('*, restaurants(name, address_line, city)')
        .eq('id', payload.orderId)
        .single()
      if (!active) return
      setOffer({ ...payload, order, expiresAt: Date.now() + payload.expiresInMs })
    }
    const onOfferExpired = ({ offerId }) => {
      setOffer((prev) => (prev?.offerId === offerId ? null : prev))
    }

    socket.on('offer:new', onOfferNew)
    socket.on('offer:expired', onOfferExpired)

    return () => {
      active = false
      socket.off('offer:new', onOfferNew)
      socket.off('offer:expired', onOfferExpired)
    }
  }, [user.id])

  const toggleOnline = async () => {
    if (!driver) return
    const goingOnline = !driver.is_online

    if (goingOnline) {
      const lat = (driver.current_lat ?? 12.9716) + (Math.random() - 0.5) * 0.02
      const lng = (driver.current_lng ?? 77.5946) + (Math.random() - 0.5) * 0.02
      const { data } = await supabase
        .from('drivers')
        .update({ is_online: true, current_lat: lat, current_lng: lng, last_location_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()
      if (data) setDriver(data)
      await supabase.from('driver_online_sessions').insert({ driver_id: user.id })
    } else {
      const { data } = await supabase
        .from('drivers')
        .update({ is_online: false })
        .eq('id', user.id)
        .select()
        .single()
      if (data) setDriver(data)
      const { data: openSession } = await supabase
        .from('driver_online_sessions')
        .select('id')
        .eq('driver_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (openSession) {
        await supabase
          .from('driver_online_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', openSession.id)
      }
    }
  }

  if (!driver) return null

  return (
    <div className="dd-page">
      <header className="dd-header">
        <div className="dd-header-left">
          <div className="dd-avatar">{driver.full_name.trim()[0]?.toUpperCase() ?? '?'}</div>
          <div className="dd-header-info">
            <h1>{driver.full_name}</h1>
            <span className={`dd-online-pill ${driver.is_online ? 'online' : 'offline'}`}>
              {driver.is_online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="dd-header-actions">
          <button type="button" className="dd-btn dd-btn-primary" onClick={toggleOnline}>
            {driver.is_online ? 'Go offline' : 'Go online'}
          </button>
          <button type="button" className="dd-btn dd-btn-secondary" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="dd-tabs">
        <span
          className="dd-tabs-indicator"
          style={{ transform: `translateX(${TABS.indexOf(tab) * 100}%)`, width: `${100 / TABS.length}%` }}
          aria-hidden="true"
        />
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && <DashboardTab driver={driver} />}
      {tab === 'earnings' && <EarningsTab driverId={user.id} />}
      {tab === 'history' && <HistoryTab driverId={user.id} />}

      {offer && (
        <OfferModal
          offer={offer}
          driverId={user.id}
          onDone={() => setOffer(null)}
        />
      )}
    </div>
  )
}

function OfferModal({ offer, driverId, onDone }) {
  const [remainingPct, setRemainingPct] = useState(100)
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    const total = offer.expiresInMs
    const tick = () => {
      const left = Math.max(0, offer.expiresAt - Date.now())
      setRemainingPct((left / total) * 100)
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [offer])

  const respond = async (action) => {
    setResponding(true)
    await post(`/offers/${offer.offerId}/respond`, { driverId, action })
    setResponding(false)
    onDone()
  }

  const restaurant = offer.order?.restaurants

  return (
    <div className="dd-modal-backdrop">
      <div className="dd-modal">
        <h2>New delivery offer</h2>
        <p className="dd-modal-restaurant">{restaurant?.name ?? 'Restaurant'}</p>
        <p className="dd-hint">{[restaurant?.address_line, restaurant?.city].filter(Boolean).join(', ')}</p>
        <p className="dd-modal-distance">{offer.distanceKm?.toFixed(1)} km away</p>

        <div className="dd-countdown-track">
          <div className="dd-countdown-fill" style={{ width: `${remainingPct}%` }} />
        </div>

        <div className="dd-modal-actions">
          <button type="button" className="dd-btn dd-btn-danger" disabled={responding} onClick={() => respond('reject')}>
            Reject
          </button>
          <button type="button" className="dd-btn dd-btn-primary" disabled={responding} onClick={() => respond('accept')}>
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

function DashboardTab({ driver }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const joinedRooms = useRef(new Set())

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, restaurants(name, address_line, city, lat, lng), customer_addresses(address_line, city, lat, lng)')
      .eq('driver_id', driver.id)
      .in('status', ['DRIVER_ASSIGNED', 'PICKED_UP'])
      .order('placed_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders()

    const channel = supabase
      .channel(`driver-orders-${driver.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${driver.id}` },
        fetchOrders,
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver.id])

  useEffect(() => {
    const currentIds = new Set(orders.map((o) => o.id))
    for (const id of currentIds) {
      if (!joinedRooms.current.has(id)) {
        socket.emit('join:order', id)
        joinedRooms.current.add(id)
      }
    }
    for (const id of joinedRooms.current) {
      if (!currentIds.has(id)) {
        socket.emit('leave:order', id)
        joinedRooms.current.delete(id)
      }
    }
  }, [orders])

  useEffect(() => {
    const rooms = joinedRooms.current
    return () => {
      for (const id of rooms) socket.emit('leave:order', id)
      rooms.clear()
    }
  }, [])

  if (loading) return <p className="dd-empty">Loading…</p>

  if (orders.length === 0) {
    return (
      <p className="dd-empty">
        {driver.is_online
          ? "You're online and ready for offers."
          : 'Go online to start receiving delivery offers.'}
      </p>
    )
  }

  return (
    <div className="dd-orders">
      {orders.map((order) => (
        <ActiveDeliveryCard key={order.id} order={order} driverId={driver.id} />
      ))}
    </div>
  )
}

function ActiveDeliveryCard({ order, driverId }) {
  const [driverPos, setDriverPos] = useState({
    lat: order.restaurants?.lat,
    lng: order.restaurants?.lng,
  })
  const [acting, setActing] = useState(false)

  useEffect(() => {
    const onLocation = (payload) => {
      if (payload.orderId === order.id) setDriverPos({ lat: payload.lat, lng: payload.lng })
    }
    socket.on('driver:location', onLocation)
    return () => socket.off('driver:location', onLocation)
  }, [order.id])

  const act = async () => {
    setActing(true)
    const path = order.status === 'DRIVER_ASSIGNED' ? 'pickup' : 'deliver'
    const result = await post(`/orders/${order.id}/${path}`, { driverId })
    setActing(false)
    if (!result.ok) window.alert(result.reason ?? 'Something went wrong.')
  }

  const restaurant = order.restaurants
  const address = order.customer_addresses

  const markers = []
  if (restaurant?.lat != null) markers.push({ id: 'restaurant', lat: restaurant.lat, lng: restaurant.lng, emoji: '🏬', label: restaurant.name })
  if (address?.lat != null) markers.push({ id: 'address', lat: address.lat, lng: address.lng, emoji: '📍', label: 'Customer' })
  if (driverPos.lat != null) markers.push({ id: 'driver', lat: driverPos.lat, lng: driverPos.lng, emoji: '🛵', label: 'You' })

  return (
    <div className="dd-card dd-delivery-card">
      <div className="dd-order-head">
        <span>Order #{order.id.slice(0, 8)}</span>
        <span className="dd-status-pill">{order.status === 'DRIVER_ASSIGNED' ? 'Heading to restaurant' : 'Out for delivery'}</span>
      </div>

      <p className="dd-delivery-line">
        <strong>Pickup:</strong> {restaurant?.name} — {[restaurant?.address_line, restaurant?.city].filter(Boolean).join(', ')}
      </p>
      <p className="dd-delivery-line">
        <strong>Drop-off:</strong> {[address?.address_line, address?.city].filter(Boolean).join(', ')}
      </p>
      <p className="dd-delivery-total">Order total ₹{order.total}</p>

      {markers.length > 0 && <LiveMap markers={markers} height={260} />}

      <button type="button" className="dd-btn dd-btn-primary dd-delivery-action" disabled={acting} onClick={act}>
        {acting ? 'Updating…' : order.status === 'DRIVER_ASSIGNED' ? 'Picked up' : 'Delivered'}
      </button>
    </div>
  )
}

function EarningsTab({ driverId }) {
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('driver_payouts')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPayouts(data ?? [])
        setLoading(false)
      })
  }, [driverId])

  if (loading) return <p className="dd-empty">Loading earnings…</p>

  const total = payouts.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="dd-earnings">
      <div className="dd-card dd-earnings-total">
        <span className="dd-earnings-value">₹{total.toFixed(2)}</span>
        <span className="dd-hint">Total earned</span>
      </div>

      {payouts.length === 0 ? (
        <p className="dd-empty">No payouts yet.</p>
      ) : (
        <div className="dd-card">
          <ul className="dd-list">
            {payouts.map((p) => (
              <li key={p.id}>
                <span>Order #{p.order_id.slice(0, 8)}</span>
                <span className={`dd-status-pill ${p.status === 'PAID' ? 'good' : ''}`}>{p.status}</span>
                <span>₹{p.amount}</span>
                <span className="dd-hint">{new Date(p.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function HistoryTab({ driverId }) {
  const [orders, setOrders] = useState([])
  const [avgRating, setAvgRating] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('orders')
        .select('*, restaurants(name)')
        .eq('driver_id', driverId)
        .eq('status', 'DELIVERED')
        .order('delivered_at', { ascending: false }),
      supabase.from('driver_ratings').select('rating').eq('driver_id', driverId),
    ]).then(([{ data: orderRows }, { data: ratingRows }]) => {
      setOrders(orderRows ?? [])
      const ratings = ratingRows ?? []
      setAvgRating(ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null)
      setLoading(false)
    })
  }, [driverId])

  if (loading) return <p className="dd-empty">Loading history…</p>

  return (
    <div className="dd-history">
      {avgRating != null && (
        <div className="dd-card dd-rating-summary">
          <span className="dd-earnings-value">★ {avgRating.toFixed(1)}</span>
          <span className="dd-hint">Average rating</span>
        </div>
      )}

      {orders.length === 0 ? (
        <p className="dd-empty">No completed deliveries yet.</p>
      ) : (
        <div className="dd-card">
          <ul className="dd-list">
            {orders.map((o) => (
              <li key={o.id}>
                <span>{o.restaurants?.name}</span>
                <span>₹{o.total}</span>
                <span className="dd-hint">{new Date(o.delivered_at ?? o.placed_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
