export const ROLES = [
  {
    id: 'customer',
    label: 'Customer',
    fieldLabel: 'restaurant name',
    headline: 'Cravings, delivered fast.',
    subheadline:
      'Order from 12,000+ restaurants near you and watch your food travel to your door — live, on the map.',
    features: [
      { icon: '📍', text: 'Real-time order tracking' },
      { icon: '⚡', text: 'Average delivery in 28 minutes' },
      { icon: '⭐', text: 'Rate restaurants & delivery partners' },
    ],
    stats: [
      { value: '12K+', label: 'Restaurants' },
      { value: '4.6★', label: 'Avg. rating' },
      { value: '28 min', label: 'Avg. delivery' },
    ],
    emoji: ['🍕', '🍔', '🍜', '🥗', '🧋'],
  },
  {
    id: 'restaurant',
    label: 'Restaurant Partner',
    fieldLabel: 'Restaurant name',
    headline: 'Grow your restaurant, online.',
    subheadline:
      'Accept orders, update your menu and track earnings — all from one simple dashboard built for busy kitchens.',
    features: [
      { icon: '🔔', text: 'Instant order notifications' },
      { icon: '📊', text: 'Daily payout & earnings reports' },
      { icon: '🍽️', text: 'Full control over your menu' },
    ],
    stats: [
      { value: '2×', label: 'Avg. order growth' },
      { value: '24/7', label: 'Partner support' },
      { value: '₹0', label: 'Setup cost' },
    ],
    emoji: ['🍳', '👨‍🍳', '📋', '🧾', '🔥'],
  },
  {
    id: 'driver',
    label: 'Delivery Partner',
    fieldLabel: 'Vehicle type',
    headline: 'Earn on your own schedule.',
    subheadline:
      'Flexible hours, instant payouts and smart routes matched to your location, rating and vehicle.',
    features: [
      { icon: '🗺️', text: 'Smart nearest-order matching' },
      { icon: '💸', text: 'Instant daily payouts' },
      { icon: '🕒', text: 'Work whenever you want' },
    ],
    stats: [
      { value: '₹35K+', label: 'Avg. monthly earning' },
      { value: '100%', label: 'Flexible hours' },
      { value: '4.8★', label: 'Partner rating' },
    ],
    emoji: ['🛵', '📦', '🗺️', '⏱️', '💨'],
  },
]

export const VEHICLE_TYPES = ['Bicycle', 'Scooter', 'Motorbike', 'Car']
