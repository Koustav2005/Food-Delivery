import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabase'
import { IconStore, IconFileText, IconMapPin, IconCheck } from '../Auth/icons'
import './RestaurantDashboard.css'

const TABS = ['orders', 'menu', 'settings']

const STATUS_ACTIONS = {
  PLACED: [
    { label: 'Accept', next: 'RESTAURANT_ACCEPTED' },
    { label: 'Reject', next: 'RESTAURANT_REJECTED', needsReason: true },
  ],
  RESTAURANT_ACCEPTED: [{ label: 'Start preparing', next: 'PREPARING' }],
  PREPARING: [{ label: 'Mark ready', next: 'READY' }],
}

const STATUS_LABELS = {
  PLACED: 'New order',
  RESTAURANT_ACCEPTED: 'Accepted',
  RESTAURANT_REJECTED: 'Rejected',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup',
  DRIVER_ASSIGNED: 'Driver assigned',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

const DEFAULT_MENU = [
  {
    category: 'Starters',
    items: [
      { name: 'Paneer Tikka', price: 220, isVeg: true },
      { name: 'Chicken 65', price: 260, isVeg: false },
    ],
  },
  {
    category: 'Main Course',
    items: [
      { name: 'Paneer Butter Masala', price: 240, isVeg: true },
      { name: 'Butter Chicken', price: 280, isVeg: false },
      { name: 'Veg Biryani', price: 220, isVeg: true },
    ],
  },
  {
    category: 'Breads',
    items: [
      { name: 'Butter Naan', price: 45, isVeg: true },
      { name: 'Tandoori Roti', price: 30, isVeg: true },
    ],
  },
  {
    category: 'Beverages',
    items: [
      { name: 'Masala Chai', price: 40, isVeg: true },
      { name: 'Sweet Lassi', price: 60, isVeg: true },
    ],
  },
]

const DISH_EMOJI = {
  'Paneer Tikka': '🍢',
  'Chicken 65': '🍗',
  'Paneer Butter Masala': '🧈',
  'Butter Chicken': '🍛',
  'Veg Biryani': '🍚',
  'Butter Naan': '🫓',
  'Tandoori Roti': '🫓',
  'Masala Chai': '☕',
  'Sweet Lassi': '🥤',
}

const THUMB_GRADIENTS = [
  ['#ff7a59', '#ffb199'],
  ['#0ea5a0', '#38ef7d'],
  ['#f7971e', '#ffd200'],
  ['#8e2de2', '#4a00e0'],
  ['#ff5f6d', '#ffc371'],
  ['#43cea2', '#185a9d'],
]

function dishEmoji(item) {
  return DISH_EMOJI[item.name] ?? (item.is_veg ? '🥗' : '🍖')
}

function thumbGradient(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const [from, to] = THUMB_GRADIENTS[hash % THUMB_GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}

async function seedDefaultMenu(restaurantId) {
  for (const [categoryIndex, group] of DEFAULT_MENU.entries()) {
    const { data: category } = await supabase
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name: group.category, display_order: categoryIndex })
      .select()
      .single()
    if (!category) continue
    await supabase.from('menu_items').insert(
      group.items.map((item, itemIndex) => ({
        restaurant_id: restaurantId,
        category_id: category.id,
        name: item.name,
        price: item.price,
        is_veg: item.isVeg,
        display_order: itemIndex,
      })),
    )
  }
}

export default function RestaurantDashboard({ user }) {
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')

  useEffect(() => {
    let active = true
    supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setRestaurant(data)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [user.id])

  if (loading) return null

  if (!restaurant) {
    return <RestaurantSetup user={user} onCreated={setRestaurant} />
  }

  return (
    <div className="rd-page">
      <header className="rd-header">
        <div className="rd-header-left">
          <div className="rd-avatar">{restaurant.name.trim()[0]?.toUpperCase() ?? '?'}</div>
          <div className="rd-header-info">
            <h1>{restaurant.name}</h1>
            <span className={`rd-open-pill ${restaurant.is_open ? 'open' : 'closed'}`}>
              {restaurant.is_open ? 'Accepting orders' : 'Closed'}
            </span>
          </div>
        </div>
        <button type="button" className="rd-btn rd-btn-secondary" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <nav className="rd-tabs">
        <span
          className="rd-tabs-indicator"
          style={{ transform: `translateX(${TABS.indexOf(tab) * 100}%)`, width: `${100 / TABS.length}%` }}
          aria-hidden="true"
        />
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'orders' && <OrdersTab restaurant={restaurant} />}
      {tab === 'menu' && <MenuTab restaurant={restaurant} />}
      {tab === 'settings' && <SettingsTab restaurant={restaurant} onUpdated={setRestaurant} />}
    </div>
  )
}

function RestaurantSetup({ user, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', addressLine: '', city: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.city.trim()) {
      setError('Restaurant name and city are required')
      return
    }
    setSaving(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('restaurants')
      .insert({
        owner_id: user.id,
        name: form.name,
        description: form.description,
        address_line: form.addressLine,
        city: form.city,
      })
      .select()
      .single()
    if (insertError) {
      setSaving(false)
      setError(insertError.message)
      return
    }
    await seedDefaultMenu(data.id)
    setSaving(false)
    onCreated(data)
  }

  return (
    <div className="rd-page rd-setup">
      <div className="rd-setup-card">
        <div className="rd-setup-icon">
          <IconStore />
        </div>
        <h1>Set up your restaurant</h1>
        <p>Tell customers who you are before you start taking orders.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="rd-field">
            <label htmlFor="rs-name">Restaurant name</label>
            <div className="rd-input-wrap">
              <IconStore className="rd-input-icon" />
              <input
                id="rs-name"
                placeholder="Spice Route Kitchen"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>
          </div>

          <div className="rd-field">
            <label htmlFor="rs-description">Description</label>
            <div className="rd-input-wrap rd-input-wrap-textarea">
              <IconFileText className="rd-input-icon" />
              <textarea
                id="rs-description"
                rows={3}
                placeholder="What makes your food special?"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>
          </div>

          <div className="rd-field-row">
            <div className="rd-field">
              <label htmlFor="rs-address">Address</label>
              <div className="rd-input-wrap">
                <IconMapPin className="rd-input-icon" />
                <input
                  id="rs-address"
                  placeholder="Street, area"
                  value={form.addressLine}
                  onChange={(e) => setField('addressLine', e.target.value)}
                />
              </div>
            </div>
            <div className="rd-field">
              <label htmlFor="rs-city">City</label>
              <div className="rd-input-wrap">
                <IconMapPin className="rd-input-icon" />
                <input
                  id="rs-city"
                  placeholder="Bengaluru"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <p className="rd-error">{error}</p>}

          <button type="submit" className="rd-setup-submit" disabled={saving}>
            {saving ? 'Saving…' : (
              <>
                <IconCheck /> Create restaurant
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function OrdersTab({ restaurant }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', restaurant.id)
      .order('placed_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders()

    const channel = supabase
      .channel(`orders-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        fetchOrders,
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id])

  const act = async (order, next, needsReason) => {
    let rejection_reason
    if (needsReason) {
      rejection_reason = window.prompt('Reason for rejecting this order:')
      if (!rejection_reason) return
    }
    const { error } = await supabase
      .from('orders')
      .update({ status: next, ...(rejection_reason && { rejection_reason }) })
      .eq('id', order.id)
    if (error) window.alert(error.message)
  }

  if (loading) return <p className="rd-empty">Loading orders…</p>
  if (orders.length === 0) return <p className="rd-empty">No orders yet.</p>

  return (
    <div className="rd-orders">
      {orders.map((order) => (
        <div key={order.id} className="rd-card rd-order">
          <div className="rd-order-head">
            <span>Order #{order.id.slice(0, 8)}</span>
            <span className={`rd-status rd-status-${order.status.toLowerCase()}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>

          <ul className="rd-order-items">
            {order.order_items.map((item) => (
              <li key={item.id}>
                {item.quantity} × {item.item_name}
                <span>₹{(item.unit_price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="rd-order-foot">
            <strong>Total ₹{order.total}</strong>
            <div className="rd-order-actions">
              {(STATUS_ACTIONS[order.status] ?? []).map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={`rd-btn ${action.needsReason ? 'rd-btn-danger' : 'rd-btn-primary'}`}
                  onClick={() => act(order, action.next, action.needsReason)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MenuTab({ restaurant }) {
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [form, setForm] = useState({ name: '', price: '', categoryId: '', isVeg: true })

  const load = async () => {
    const [{ data: cats }, { data: menuItems }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('display_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('display_order'),
    ])
    setCategories(cats ?? [])
    setItems(menuItems ?? [])
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id])

  const addCategory = async (e) => {
    e.preventDefault()
    if (!newCategory.trim()) return
    await supabase.from('menu_categories').insert({ restaurant_id: restaurant.id, name: newCategory })
    setNewCategory('')
    load()
  }

  const deleteCategory = async (id) => {
    await supabase.from('menu_categories').delete().eq('id', id)
    load()
  }

  const addItem = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.price) return
    await supabase.from('menu_items').insert({
      restaurant_id: restaurant.id,
      category_id: form.categoryId || null,
      name: form.name,
      price: Number(form.price),
      is_veg: form.isVeg,
    })
    setForm({ name: '', price: '', categoryId: '', isVeg: true })
    load()
  }

  const toggleAvailable = async (item) => {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    load()
  }

  const deleteItem = async (id) => {
    await supabase.from('menu_items').delete().eq('id', id)
    load()
  }

  const itemsFor = (categoryId) => items.filter((i) => i.category_id === categoryId)
  const uncategorized = items.filter((i) => !i.category_id)

  return (
    <div className="rd-menu">
      <div className="rd-card">
        <h2>Categories</h2>
        <form className="rd-inline-form" onSubmit={addCategory}>
          <input
            placeholder="e.g. Starters"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button type="submit" className="rd-btn rd-btn-primary">
            Add
          </button>
        </form>
        <div className="rd-chip-row">
          {categories.map((c) => (
            <span key={c.id} className="rd-chip">
              {c.name}
              <button type="button" onClick={() => deleteCategory(c.id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="rd-card">
        <h2>Add menu item</h2>
        <form className="rd-item-form" onSubmit={addItem}>
          <input
            placeholder="Item name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
          <select
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="rd-checkbox">
            <input
              type="checkbox"
              checked={form.isVeg}
              onChange={(e) => setForm((f) => ({ ...f, isVeg: e.target.checked }))}
            />
            Veg
          </label>
          <button type="submit" className="rd-btn rd-btn-primary">
            Add item
          </button>
        </form>
      </div>

      {categories.map((c) => (
        <MenuList key={c.id} title={c.name} items={itemsFor(c.id)} onToggle={toggleAvailable} onDelete={deleteItem} />
      ))}
      {uncategorized.length > 0 && (
        <MenuList title="Uncategorized" items={uncategorized} onToggle={toggleAvailable} onDelete={deleteItem} />
      )}
    </div>
  )
}

function MenuList({ title, items, onToggle, onDelete }) {
  if (items.length === 0) return null
  return (
    <div className="rd-card">
      <h2>{title}</h2>
      <ul className="rd-menu-list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="rd-item-thumb" style={{ background: thumbGradient(item.name) }}>
              <span>{dishEmoji(item)}</span>
            </div>
            <span className="rd-item-name">
              <i className={`rd-veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} aria-hidden="true" />
              {item.name}
            </span>
            <span className="rd-item-price">₹{item.price}</span>
            <label className="rd-switch">
              <input
                type="checkbox"
                checked={item.is_available}
                onChange={() => onToggle(item)}
              />
              {item.is_available ? 'Available' : 'Unavailable'}
            </label>
            <button type="button" className="rd-btn rd-btn-danger rd-btn-sm" onClick={() => onDelete(item.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SettingsTab({ restaurant, onUpdated }) {
  const [form, setForm] = useState({
    name: restaurant.name,
    description: restaurant.description ?? '',
    addressLine: restaurant.address_line,
    city: restaurant.city,
    avgPrepMinutes: restaurant.avg_prep_minutes,
  })
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase
      .from('restaurants')
      .update({
        name: form.name,
        description: form.description,
        address_line: form.addressLine,
        city: form.city,
        avg_prep_minutes: Number(form.avgPrepMinutes),
      })
      .eq('id', restaurant.id)
      .select()
      .single()
    setSaving(false)
    if (data) onUpdated(data)
  }

  const toggleOpen = async () => {
    const { data } = await supabase
      .from('restaurants')
      .update({ is_open: !restaurant.is_open })
      .eq('id', restaurant.id)
      .select()
      .single()
    if (data) onUpdated(data)
  }

  return (
    <div className="rd-card rd-settings">
      <div className="rd-order-head">
        <h2>Restaurant settings</h2>
        <button type="button" className="rd-btn rd-btn-secondary" onClick={toggleOpen}>
          {restaurant.is_open ? 'Close for orders' : 'Open for orders'}
        </button>
      </div>

      <form onSubmit={save}>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <label>
          Address
          <input
            value={form.addressLine}
            onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
          />
        </label>
        <label>
          City
          <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </label>
        <label>
          Avg. prep time (minutes)
          <input
            type="number"
            min="1"
            value={form.avgPrepMinutes}
            onChange={(e) => setForm((f) => ({ ...f, avgPrepMinutes: e.target.value }))}
          />
        </label>
        <button type="submit" className="rd-btn rd-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
