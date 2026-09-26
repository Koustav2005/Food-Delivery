import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { useCart } from './CartContext'

export default function RestaurantMenu() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, addItem, setQuantity, restaurantId } = useCart()

  const [restaurant, setRestaurant] = useState(null)
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      const [{ data: r }, { data: cats }, { data: mi }] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', id).single(),
        supabase.from('menu_categories').select('*').eq('restaurant_id', id).order('display_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', id).order('display_order'),
      ])
      if (!active) return
      setRestaurant(r)
      setCategories(cats ?? [])
      setMenuItems(mi ?? [])
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [id])

  if (loading) return <p className="cd-empty">Loading menu…</p>
  if (!restaurant) return <p className="cd-empty">Restaurant not found.</p>

  const qtyFor = (menuItemId) => (restaurantId === id ? items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0 : 0)
  const itemsFor = (categoryId) => menuItems.filter((m) => m.category_id === categoryId)
  const uncategorized = menuItems.filter((m) => !m.category_id)

  return (
    <div className="cd-menu-page">
      <button type="button" className="cd-back-link" onClick={() => navigate('/')}>
        ← All restaurants
      </button>

      <div className="cd-menu-header">
        <h1>{restaurant.name}</h1>
        {restaurant.description && <p>{restaurant.description}</p>}
        <div className="cd-menu-meta">
          <span>{[restaurant.address_line, restaurant.city].filter(Boolean).join(', ')}</span>
          <span>~{restaurant.avg_prep_minutes} min</span>
          <span className={restaurant.is_open ? 'cd-open' : 'cd-closed'}>
            {restaurant.is_open ? 'Open now' : 'Currently closed'}
          </span>
        </div>
      </div>

      {categories.map((cat) => (
        <MenuSection
          key={cat.id}
          title={cat.name}
          items={itemsFor(cat.id)}
          restaurant={restaurant}
          qtyFor={qtyFor}
          addItem={addItem}
          setQuantity={setQuantity}
        />
      ))}
      {uncategorized.length > 0 && (
        <MenuSection
          title="More items"
          items={uncategorized}
          restaurant={restaurant}
          qtyFor={qtyFor}
          addItem={addItem}
          setQuantity={setQuantity}
        />
      )}

      {items.length > 0 && restaurantId === id && (
        <Link to="/cart" className="cd-cart-fab">
          View cart · {items.reduce((n, i) => n + i.quantity, 0)} items
        </Link>
      )}
    </div>
  )
}

function MenuSection({ title, items, restaurant, qtyFor, addItem, setQuantity }) {
  if (items.length === 0) return null
  return (
    <div className="cd-menu-section">
      <h2>{title}</h2>
      <ul>
        {items.map((item) => {
          const qty = qtyFor(item.id)
          return (
            <li key={item.id} className={!item.is_available ? 'unavailable' : ''}>
              <div className="cd-menu-item-info">
                <span className="cd-item-name">
                  <i className={`cd-veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} aria-hidden="true" />
                  {item.name}
                </span>
                {item.description && <p>{item.description}</p>}
                <span className="cd-item-price">₹{item.price}</span>
                {!item.is_available && <span className="cd-unavailable-tag">Currently unavailable</span>}
              </div>

              {item.is_available && (
                <div className="cd-item-action">
                  {qty === 0 ? (
                    <button type="button" className="cd-add-btn" onClick={() => addItem(restaurant, item)}>
                      Add
                    </button>
                  ) : (
                    <div className="cd-stepper">
                      <button type="button" onClick={() => setQuantity(item.id, qty - 1)}>
                        −
                      </button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => addItem(restaurant, item)}>
                        +
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
