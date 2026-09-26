import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import LocationPicker from '../../shared/LocationPicker'
import { useCart } from './CartContext'

const DELIVERY_FEE = 30
const TAX_RATE = 0.05

export default function Checkout({ user }) {
  const { items, restaurantId, subtotal, clear } = useCart()
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [addingAddress, setAddingAddress] = useState(false)
  const [newAddress, setNewAddress] = useState({ label: 'Home', addressLine: '', city: '', lat: null, lng: null })
  const [savingAddress, setSavingAddress] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [instructions, setInstructions] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => {
        setAddresses(data ?? [])
        const preferred = data?.find((a) => a.is_default) ?? data?.[0]
        if (preferred) setSelectedAddressId(preferred.id)
        else setAddingAddress(true)
      })
  }, [user.id])

  const tax = subtotal * TAX_RATE
  const total = subtotal + DELIVERY_FEE + tax

  const saveNewAddress = async (e) => {
    e.preventDefault()
    if (!newAddress.addressLine.trim() || !newAddress.city.trim() || newAddress.lat == null) {
      setError('Add a label, address, city, and drop a pin on the map.')
      return
    }
    setSavingAddress(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: user.id,
        label: newAddress.label,
        address_line: newAddress.addressLine,
        city: newAddress.city,
        lat: newAddress.lat,
        lng: newAddress.lng,
        is_default: addresses.length === 0,
      })
      .select()
      .single()
    setSavingAddress(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setAddresses((prev) => [...prev, data])
    setSelectedAddressId(data.id)
    setAddingAddress(false)
  }

  const placeOrder = async () => {
    if (!selectedAddressId) {
      setError('Choose a delivery address first.')
      return
    }
    setError('')
    setProcessing(true)

    if (paymentMethod === 'online') {
      await new Promise((resolve) => setTimeout(resolve, 800))
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        restaurant_id: restaurantId,
        delivery_address_id: selectedAddressId,
        subtotal: Number(subtotal.toFixed(2)),
        delivery_fee: DELIVERY_FEE,
        tax: Number(tax.toFixed(2)),
        total: Number(total.toFixed(2)),
        special_instructions: instructions || null,
      })
      .select()
      .single()

    if (orderError) {
      setProcessing(false)
      setError(orderError.message)
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        item_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
      })),
    )

    setProcessing(false)
    if (itemsError) {
      setError(itemsError.message)
      return
    }

    clear()
    navigate(`/orders/${order.id}/track`)
  }

  if (items.length === 0) {
    return <p className="cd-empty">Your cart is empty — add something tasty first.</p>
  }

  return (
    <div className="cd-checkout-page">
      <h1>Checkout</h1>

      <div className="cd-card">
        <h2>Delivery address</h2>
        {addresses.map((a) => (
          <label key={a.id} className="cd-address-option">
            <input
              type="radio"
              name="address"
              checked={selectedAddressId === a.id}
              onChange={() => setSelectedAddressId(a.id)}
            />
            <span>
              <strong>{a.label}</strong> — {a.address_line}, {a.city}
            </span>
          </label>
        ))}

        {!addingAddress ? (
          <button type="button" className="cd-btn cd-btn-secondary" onClick={() => setAddingAddress(true)}>
            + Add new address
          </button>
        ) : (
          <form className="cd-address-form" onSubmit={saveNewAddress}>
            <div className="cd-field-row">
              <input
                placeholder="Label (Home, Work…)"
                value={newAddress.label}
                onChange={(e) => setNewAddress((f) => ({ ...f, label: e.target.value }))}
              />
              <input
                placeholder="City"
                value={newAddress.city}
                onChange={(e) => setNewAddress((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <input
              placeholder="Address line"
              value={newAddress.addressLine}
              onChange={(e) => setNewAddress((f) => ({ ...f, addressLine: e.target.value }))}
            />
            <p className="cd-hint">Tap the map to drop a pin at your delivery location.</p>
            <LocationPicker
              lat={newAddress.lat}
              lng={newAddress.lng}
              onChange={(lat, lng) => setNewAddress((f) => ({ ...f, lat, lng }))}
            />
            <button type="submit" className="cd-btn cd-btn-primary" disabled={savingAddress}>
              {savingAddress ? 'Saving…' : 'Save address'}
            </button>
          </form>
        )}
      </div>

      <div className="cd-card">
        <h2>Payment</h2>
        <label className="cd-address-option">
          <input type="radio" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
          <span>Cash on Delivery</span>
        </label>
        <label className="cd-address-option">
          <input type="radio" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} />
          <span>Pay Online (simulated)</span>
        </label>
      </div>

      <div className="cd-card">
        <h2>Special instructions</h2>
        <textarea
          rows={2}
          placeholder="E.g. leave at the door, less spicy…"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <div className="cd-card cd-order-summary">
        <div className="cd-cart-summary-row">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="cd-cart-summary-row">
          <span>Delivery fee</span>
          <span>₹{DELIVERY_FEE.toFixed(2)}</span>
        </div>
        <div className="cd-cart-summary-row">
          <span>Taxes</span>
          <span>₹{tax.toFixed(2)}</span>
        </div>
        <div className="cd-cart-summary-row cd-total-row">
          <strong>Total</strong>
          <strong>₹{total.toFixed(2)}</strong>
        </div>

        {error && <p className="cd-error">{error}</p>}

        <button type="button" className="cd-btn cd-btn-primary cd-place-order" onClick={placeOrder} disabled={processing}>
          {processing ? (paymentMethod === 'online' ? 'Processing payment…' : 'Placing order…') : `Place order · ₹${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
