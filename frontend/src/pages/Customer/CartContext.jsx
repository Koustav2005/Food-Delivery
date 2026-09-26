import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'tiffin-cart'

function readStoredCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { restaurantId: null, restaurantName: '', items: [] }
    return JSON.parse(raw)
  } catch {
    return { restaurantId: null, restaurantName: '', items: [] }
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readStoredCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // ignore write failures (private browsing, quota, etc.)
    }
  }, [cart])

  const addItem = (restaurant, menuItem) => {
    setCart((prev) => {
      const switchingRestaurant = prev.restaurantId && prev.restaurantId !== restaurant.id && prev.items.length > 0
      if (switchingRestaurant) {
        const confirmed = window.confirm(
          `Your cart has items from ${prev.restaurantName}. Start a new cart for ${restaurant.name}?`,
        )
        if (!confirmed) return prev
      }

      const base = switchingRestaurant || !prev.restaurantId
        ? { restaurantId: restaurant.id, restaurantName: restaurant.name, items: [] }
        : prev

      const existing = base.items.find((i) => i.menuItemId === menuItem.id)
      const items = existing
        ? base.items.map((i) => (i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [
            ...base.items,
            {
              menuItemId: menuItem.id,
              name: menuItem.name,
              price: Number(menuItem.price),
              isVeg: menuItem.is_veg,
              quantity: 1,
            },
          ]

      return { ...base, items }
    })
  }

  const removeItem = (menuItemId) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.menuItemId !== menuItemId) }))
  }

  const setQuantity = (menuItemId, quantity) => {
    setCart((prev) => {
      if (quantity <= 0) return { ...prev, items: prev.items.filter((i) => i.menuItemId !== menuItemId) }
      return { ...prev, items: prev.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i)) }
    })
  }

  const clear = () => setCart({ restaurantId: null, restaurantName: '', items: [] })

  const subtotal = useMemo(
    () => cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart.items],
  )
  const itemCount = useMemo(() => cart.items.reduce((sum, i) => sum + i.quantity, 0), [cart.items])

  const value = {
    ...cart,
    addItem,
    removeItem,
    setQuantity,
    clear,
    subtotal,
    itemCount,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider and its hook belong together, same pattern would apply to any React Context.
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
