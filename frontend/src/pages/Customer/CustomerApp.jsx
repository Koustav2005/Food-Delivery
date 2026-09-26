import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import LocationPicker from '../../shared/LocationPicker'
import { CartProvider, useCart } from './CartContext'
import RestaurantList from './RestaurantList'
import RestaurantMenu from './RestaurantMenu'
import Cart from './Cart'
import Checkout from './Checkout'
import OrderTracking from './OrderTracking'
import OrderHistory from './OrderHistory'
import Profile from './Profile'
import './CustomerDashboard.css'

export default function CustomerApp({ user, isAdmin }) {
  const [hasAddress, setHasAddress] = useState(null)

  useEffect(() => {
    supabase
      .from('customer_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', user.id)
      .then(({ count }) => setHasAddress((count ?? 0) > 0))
  }, [user.id])

  if (hasAddress === null) return null
  if (!hasAddress) return <AddressGate user={user} onDone={() => setHasAddress(true)} />

  return (
    <CartProvider>
      <div className="cd-app">
        <TopNav isAdmin={isAdmin} />
        <main className="cd-main">
          <Routes>
            <Route path="/" element={<RestaurantList />} />
            <Route path="/restaurant/:id" element={<RestaurantMenu />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout user={user} />} />
            <Route path="/orders" element={<OrderHistory user={user} />} />
            <Route path="/orders/:id/track" element={<OrderTracking />} />
            <Route path="/profile" element={<Profile user={user} />} />
          </Routes>
        </main>
      </div>
    </CartProvider>
  )
}

function TopNav({ isAdmin }) {
  const { itemCount } = useCart()
  return (
    <header className="cd-topnav">
      <Link to="/" className="cd-brand">
        Tiffin
      </Link>
      <nav>
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/orders">Orders</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        {isAdmin && <Link to="/admin">Admin</Link>}
      </nav>
      <Link to="/cart" className="cd-cart-link">
        🛒 {itemCount > 0 && <span className="cd-cart-count">{itemCount}</span>}
      </Link>
    </header>
  )
}

function AddressGate({ user, onDone }) {
  const [form, setForm] = useState({ label: 'Home', addressLine: '', city: '', lat: null, lng: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault()
    if (!form.addressLine.trim() || !form.city.trim() || form.lat == null) {
      setError('Add an address, city, and drop a pin on the map.')
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('customer_addresses').insert({
      customer_id: user.id,
      label: form.label,
      address_line: form.addressLine,
      city: form.city,
      lat: form.lat,
      lng: form.lng,
      is_default: true,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onDone()
  }

  return (
    <div className="cd-app cd-address-gate">
      <div className="cd-card cd-gate-card">
        <h1>Where should we deliver?</h1>
        <p>Add your delivery address to start ordering.</p>
        <form onSubmit={save}>
          <div className="cd-field-row">
            <input
              placeholder="Label (Home, Work…)"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <input
            placeholder="Address line"
            value={form.addressLine}
            onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
          />
          <LocationPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))} />
          {error && <p className="cd-error">{error}</p>}
          <div className="cd-gate-actions">
            <button type="button" className="cd-btn cd-btn-secondary" onClick={onDone}>
              Skip for now
            </button>
            <button type="submit" className="cd-btn cd-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
