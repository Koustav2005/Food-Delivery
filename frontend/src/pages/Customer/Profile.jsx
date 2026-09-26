import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabase'
import LocationPicker from '../../shared/LocationPicker'

export default function Profile({ user }) {
  const [customer, setCustomer] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ label: 'Home', addressLine: '', city: '', lat: null, lng: null })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', user.id).single(),
      supabase.from('customer_addresses').select('*').eq('customer_id', user.id).order('is_default', { ascending: false }),
    ])
    setCustomer(c)
    setAddresses(a ?? [])
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const addAddress = async (e) => {
    e.preventDefault()
    if (!form.addressLine.trim() || !form.city.trim() || form.lat == null) return
    setSaving(true)
    await supabase.from('customer_addresses').insert({
      customer_id: user.id,
      label: form.label,
      address_line: form.addressLine,
      city: form.city,
      lat: form.lat,
      lng: form.lng,
      is_default: addresses.length === 0,
    })
    setSaving(false)
    setForm({ label: 'Home', addressLine: '', city: '', lat: null, lng: null })
    setAdding(false)
    load()
  }

  const makeDefault = async (id) => {
    await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', user.id)
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id)
    load()
  }

  const removeAddress = async (id) => {
    await supabase.from('customer_addresses').delete().eq('id', id)
    load()
  }

  return (
    <div className="cd-profile-page">
      <h1>Profile</h1>

      <div className="cd-card">
        <h2>Account</h2>
        <p>{customer?.full_name}</p>
        <p className="cd-hint">{customer?.email}</p>
        <p className="cd-hint">{customer?.phone}</p>
        <button type="button" className="cd-btn cd-btn-secondary" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>

      <div className="cd-card">
        <h2>Delivery addresses</h2>
        {addresses.map((a) => (
          <div key={a.id} className="cd-address-row">
            <span>
              <strong>{a.label}</strong> {a.is_default && <em>(default)</em>} — {a.address_line}, {a.city}
            </span>
            <div className="cd-address-row-actions">
              {!a.is_default && (
                <button type="button" className="cd-btn cd-btn-secondary cd-btn-sm" onClick={() => makeDefault(a.id)}>
                  Set default
                </button>
              )}
              <button type="button" className="cd-btn cd-btn-danger cd-btn-sm" onClick={() => removeAddress(a.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}

        {!adding ? (
          <button type="button" className="cd-btn cd-btn-secondary" onClick={() => setAdding(true)}>
            + Add address
          </button>
        ) : (
          <form className="cd-address-form" onSubmit={addAddress}>
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
            <button type="submit" className="cd-btn cd-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save address'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
