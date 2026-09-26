import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { STATUS_LABELS } from '../../shared/orderStatus'
import './AdminDashboard.css'

const TABS = ['overview', 'orders', 'restaurants', 'drivers']

export default function AdminDashboard({ user }) {
  const [tab, setTab] = useState('overview')

  return (
    <div className="ad-page">
      <header className="ad-header">
        <div>
          <h1>Admin dashboard</h1>
          <p className="ad-hint">Signed in as {user.email}</p>
        </div>
        <div className="ad-header-actions">
          <Link to="/" className="ad-btn ad-btn-secondary">
            ← Back to app
          </Link>
          <button type="button" className="ad-btn ad-btn-secondary" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="ad-tabs">
        <span
          className="ad-tabs-indicator"
          style={{ transform: `translateX(${TABS.indexOf(tab) * 100}%)`, width: `${100 / TABS.length}%` }}
          aria-hidden="true"
        />
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'restaurants' && <RestaurantsTab />}
      {tab === 'drivers' && <DriversTab />}
    </div>
  )
}

function OverviewTab() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = async () => {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const [{ count: ordersToday }, { count: activeDrivers }, { count: restaurantCount }, { data: deliveredOrders }] =
        await Promise.all([
          supabase.from('orders').select('id', { count: 'exact', head: true }).gte('placed_at', startOfToday.toISOString()),
          supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('is_online', true),
          supabase.from('restaurants').select('id', { count: 'exact', head: true }),
          supabase.from('orders').select('total').eq('status', 'DELIVERED'),
        ])

      const gmv = (deliveredOrders ?? []).reduce((sum, o) => sum + Number(o.total), 0)
      setStats({ ordersToday: ordersToday ?? 0, activeDrivers: activeDrivers ?? 0, restaurantCount: restaurantCount ?? 0, gmv })
    }
    load()
  }, [])

  if (!stats) return <p className="ad-empty">Loading…</p>

  return (
    <div className="ad-stat-grid">
      <StatCard label="Orders today" value={stats.ordersToday} />
      <StatCard label="Active drivers" value={stats.activeDrivers} />
      <StatCard label="Restaurants" value={stats.restaurantCount} />
      <StatCard label="Delivered GMV" value={`₹${stats.gmv.toFixed(2)}`} />
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="ad-card ad-stat-card">
      <span className="ad-stat-value">{value}</span>
      <span className="ad-stat-label">{label}</span>
    </div>
  )
}

function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, restaurants(name), drivers(full_name)')
      .order('placed_at', { ascending: false })
      .limit(100)
    setOrders(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()

    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) return <p className="ad-empty">Loading orders…</p>
  if (orders.length === 0) return <p className="ad-empty">No orders yet.</p>

  return (
    <div className="ad-card ad-table-card">
      <table className="ad-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Restaurant</th>
            <th>Driver</th>
            <th>Status</th>
            <th>Total</th>
            <th>Placed</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>#{o.id.slice(0, 8)}</td>
              <td>{o.restaurants?.name ?? '—'}</td>
              <td>{o.drivers?.full_name ?? '—'}</td>
              <td>
                <span className="ad-status-pill">{STATUS_LABELS[o.status] ?? o.status}</span>
              </td>
              <td>₹{o.total}</td>
              <td>{new Date(o.placed_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RestaurantsTab() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*, restaurant_partners(full_name)')
      .order('name')
      .then(({ data }) => {
        setRestaurants(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="ad-empty">Loading restaurants…</p>

  return (
    <div className="ad-card ad-table-card">
      <table className="ad-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>City</th>
            <th>Status</th>
            <th>Avg prep</th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.restaurant_partners?.full_name ?? '—'}</td>
              <td>{r.city}</td>
              <td>
                <span className={`ad-status-pill ${r.is_open ? 'ad-status-good' : 'ad-status-bad'}`}>
                  {r.is_open ? 'Open' : 'Closed'}
                </span>
              </td>
              <td>{r.avg_prep_minutes} min</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DriversTab() {
  const [drivers, setDrivers] = useState([])
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('drivers').select('*').order('is_online', { ascending: false }),
      supabase.from('driver_ratings').select('driver_id, rating'),
    ]).then(([{ data: d }, { data: r }]) => {
      const grouped = {}
      for (const row of r ?? []) {
        grouped[row.driver_id] ??= []
        grouped[row.driver_id].push(row.rating)
      }
      setRatings(grouped)
      setDrivers(d ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="ad-empty">Loading drivers…</p>

  return (
    <div className="ad-card ad-table-card">
      <table className="ad-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Vehicle</th>
            <th>Status</th>
            <th>Avg rating</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => {
            const rs = ratings[d.id] ?? []
            const avg = rs.length ? (rs.reduce((s, x) => s + x, 0) / rs.length).toFixed(1) : '—'
            return (
              <tr key={d.id}>
                <td>{d.full_name}</td>
                <td>{d.vehicle_type ?? '—'}</td>
                <td>
                  <span className={`ad-status-pill ${d.is_online ? 'ad-status-good' : 'ad-status-bad'}`}>
                    {d.is_online ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td>{avg === '—' ? avg : `★ ${avg}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
