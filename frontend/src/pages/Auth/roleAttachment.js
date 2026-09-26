import { supabase } from '../../utils/supabase'

function oauthName(user) {
  return user.user_metadata?.full_name || user.user_metadata?.name || ''
}

export function writeCustomerRow(user) {
  return supabase.from('customers').upsert({
    id: user.id,
    full_name: oauthName(user),
    email: user.email,
    phone: user.phone || null,
  })
}

// One login (one email) can hold more than one role — a customer who also
// drives, or a restaurant owner who orders for themselves. So adding a
// restaurant/driver row never removes an existing customer row (or vice
// versa); a person just accumulates access and picks which portal to enter
// each session (see the role picker in App.jsx).
export function writeRestaurantRow(user, restaurantName) {
  return supabase.from('restaurant_partners').upsert({
    id: user.id,
    full_name: oauthName(user),
    email: user.email,
    phone: user.phone || null,
    restaurant_name: restaurantName,
  })
}

export function writeDriverRow(user, vehicleType) {
  return supabase.from('drivers').upsert({
    id: user.id,
    full_name: oauthName(user),
    email: user.email,
    phone: user.phone || null,
    vehicle_type: vehicleType,
  })
}

// Attaches a role to an *existing* auth user (used when someone "signs up"
// with an email/password that already matches an account of theirs — see
// AuthPage's handleSubmit — or when an already-logged-in user adds a role
// from the role picker in App.jsx) rather than creating a brand new auth
// identity.
export function attachRoleRow(user, roleId, form) {
  if (roleId === 'restaurant') return writeRestaurantRow(user, form.roleField)
  if (roleId === 'driver') return writeDriverRow(user, form.roleField)
  return supabase.from('customers').upsert({
    id: user.id,
    full_name: form.fullName || oauthName(user),
    email: user.email,
    phone: form.phone || user.phone || null,
  })
}
