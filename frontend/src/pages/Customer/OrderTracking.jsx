import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { socket } from '../../realtime/socket'
import LiveMap from '../../shared/LiveMap'
import { ORDER_STEPS, STATUS_LABELS, isTerminal } from '../../shared/orderStatus'

export default function OrderTracking() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [address, setAddress] = useState(null)
  const [driverPos, setDriverPos] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single()
    if (!data) {
      setLoading(false)
      return
    }
    setOrder(data)

    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from('restaurants').select('name, address_line, city, lat, lng').eq('id', data.restaurant_id).single(),
      supabase.from('customer_addresses').select('address_line, city, lat, lng').eq('id', data.delivery_address_id).single(),
    ])
    setRestaurant(r)
    setAddress(a)

    if (data.driver_id) {
      const { data: d } = await supabase
        .from('drivers')
        .select('current_lat, current_lng')
        .eq('id', data.driver_id)
        .maybeSingle()
      if (d) setDriverPos({ lat: d.current_lat, lng: d.current_lng })
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()

    const channel = supabase
      .channel(`order-track-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
        setOrder(payload.new)
        if (payload.new.driver_id && !driverPos) {
          supabase
            .from('drivers')
            .select('current_lat, current_lng')
            .eq('id', payload.new.driver_id)
            .maybeSingle()
            .then(({ data: d }) => d && setDriverPos({ lat: d.current_lat, lng: d.current_lng }))
        }
      })
      .subscribe()

    socket.emit('join:order', id)
    const onLocation = (payload) => {
      if (payload.orderId === id) setDriverPos({ lat: payload.lat, lng: payload.lng })
    }
    socket.on('driver:location', onLocation)

    return () => {
      supabase.removeChannel(channel)
      socket.emit('leave:order', id)
      socket.off('driver:location', onLocation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="cd-empty">Loading order…</p>
  if (!order) return <p className="cd-empty">Order not found.</p>

  const markers = []
  if (restaurant) markers.push({ id: 'restaurant', lat: restaurant.lat, lng: restaurant.lng, emoji: '🏬', label: restaurant.name })
  if (address) markers.push({ id: 'address', lat: address.lat, lng: address.lng, emoji: '📍', label: 'Delivery address' })
  if (order.driver_id && driverPos) markers.push({ id: 'driver', lat: driverPos.lat, lng: driverPos.lng, emoji: '🛵', label: 'Your driver' })

  const failed = order.status === 'RESTAURANT_REJECTED' || order.status === 'CANCELLED'
  const currentStepIndex = ORDER_STEPS.indexOf(order.status)

  return (
    <div className="cd-tracking-page">
      <Link to="/orders" className="cd-back-link">
        ← Order history
      </Link>

      <h1>Order #{order.id.slice(0, 8)}</h1>

      {failed ? (
        <div className="cd-card cd-order-failed">
          <p>{STATUS_LABELS[order.status]}</p>
          {order.rejection_reason && <p className="cd-hint">Reason: {order.rejection_reason}</p>}
        </div>
      ) : (
        <div className="cd-card cd-status-stepper">
          {ORDER_STEPS.map((step, i) => (
            <div key={step} className={`cd-step ${i <= currentStepIndex ? 'done' : ''} ${i === currentStepIndex ? 'current' : ''}`}>
              <span className="cd-step-dot" />
              <span className="cd-step-label">{STATUS_LABELS[step]}</span>
            </div>
          ))}
        </div>
      )}

      {markers.length > 0 && (
        <div className="cd-card">
          <LiveMap markers={markers} />
        </div>
      )}

      <div className="cd-card cd-order-details">
        <h2>Order details</h2>
        <p>{restaurant?.name}</p>
        <p className="cd-hint">Delivering to {address?.address_line}, {address?.city}</p>
        <div className="cd-cart-summary-row cd-total-row">
          <strong>Total</strong>
          <strong>₹{order.total}</strong>
        </div>
      </div>

      {isTerminal(order.status) && order.status === 'DELIVERED' && (
        <Link to="/orders" className="cd-btn cd-btn-primary">
          Rate your order
        </Link>
      )}
    </div>
  )
}
