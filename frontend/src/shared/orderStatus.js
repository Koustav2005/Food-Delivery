// Shared across Customer/Driver/Admin views. Restaurant dashboard keeps its
// own copy (frontend/src/pages/Restaurant/RestaurantDashboard.jsx) since it
// predates this file and only needs a subset.

export const ORDER_STEPS = [
  'PLACED',
  'RESTAURANT_ACCEPTED',
  'PREPARING',
  'READY',
  'DRIVER_ASSIGNED',
  'PICKED_UP',
  'DELIVERED',
]

export const STATUS_LABELS = {
  PLACED: 'Order placed',
  RESTAURANT_ACCEPTED: 'Restaurant accepted',
  RESTAURANT_REJECTED: 'Rejected by restaurant',
  PREPARING: 'Preparing your food',
  READY: 'Ready for pickup',
  DRIVER_ASSIGNED: 'Driver on the way to restaurant',
  PICKED_UP: 'Order picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function isTerminal(status) {
  return status === 'DELIVERED' || status === 'CANCELLED' || status === 'RESTAURANT_REJECTED'
}
