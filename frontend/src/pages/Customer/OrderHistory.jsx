import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { STATUS_LABELS, isTerminal } from '../../shared/orderStatus'

export default function OrderHistory({ user }) {
  const [orders, setOrders] = useState([])
  const [ratedRestaurants, setRatedRestaurants] = useState(new Set())
  const [ratedDrivers, setRatedDrivers] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data: orderRows } = await supabase
      .from('orders')
      .select('*, restaurants(name)')
      .eq('customer_id', user.id)
      .order('placed_at', { ascending: false })

    const rows = orderRows ?? []
    setOrders(rows)

    const orderIds = rows.map((o) => o.id)
    if (orderIds.length > 0) {
      const [{ data: rr }, { data: dr }] = await Promise.all([
        supabase.from('restaurant_ratings').select('order_id').in('order_id', orderIds),
        supabase.from('driver_ratings').select('order_id').in('order_id', orderIds),
      ])
      setRatedRestaurants(new Set((rr ?? []).map((r) => r.order_id)))
      setRatedDrivers(new Set((dr ?? []).map((r) => r.order_id)))
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  if (loading) return <p className="cd-empty">Loading your orders…</p>
  if (orders.length === 0) {
    return (
      <div className="cd-empty-state">
        <p>No orders yet.</p>
        <Link to="/" className="cd-btn cd-btn-primary">
          Browse restaurants
        </Link>
      </div>
    )
  }

  return (
    <div className="cd-history-page">
      <h1>Your orders</h1>
      {orders.map((order) => (
        <div key={order.id} className="cd-card cd-history-order">
          <div className="cd-order-head">
            <span>{order.restaurants?.name ?? 'Restaurant'}</span>
            <span className={`cd-status-pill cd-status-${order.status.toLowerCase()}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p className="cd-hint">
            {new Date(order.placed_at).toLocaleString()} · ₹{order.total}
          </p>

          <div className="cd-history-actions">
            {!isTerminal(order.status) && (
              <Link to={`/orders/${order.id}/track`} className="cd-btn cd-btn-secondary">
                Track order
              </Link>
            )}
            {order.status === 'DELIVERED' && !ratedRestaurants.has(order.id) && (
              <RatingForm
                label="Rate restaurant"
                onSubmit={async (rating, comment) => {
                  await supabase.from('restaurant_ratings').insert({
                    order_id: order.id,
                    customer_id: user.id,
                    restaurant_id: order.restaurant_id,
                    rating,
                    comment: comment || null,
                  })
                  setRatedRestaurants((prev) => new Set(prev).add(order.id))
                }}
              />
            )}
            {order.status === 'DELIVERED' && order.driver_id && !ratedDrivers.has(order.id) && (
              <RatingForm
                label="Rate driver"
                onSubmit={async (rating, comment) => {
                  await supabase.from('driver_ratings').insert({
                    order_id: order.id,
                    customer_id: user.id,
                    driver_id: order.driver_id,
                    rating,
                    comment: comment || null,
                  })
                  setRatedDrivers((prev) => new Set(prev).add(order.id))
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function RatingForm({ label, onSubmit }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) {
    return (
      <button type="button" className="cd-btn cd-btn-secondary" onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }

  return (
    <form
      className="cd-rating-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        await onSubmit(rating, comment)
        setSaving(false)
        setOpen(false)
      }}
    >
      <div className="cd-star-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`cd-star ${n <= rating ? 'filled' : ''}`}
            onClick={() => setRating(n)}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
      </div>
      <input placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button type="submit" className="cd-btn cd-btn-primary" disabled={saving}>
        {saving ? 'Saving…' : `Submit ${label.toLowerCase()}`}
      </button>
    </form>
  )
}
