import { Link, useNavigate } from 'react-router-dom'
import { useCart } from './CartContext'

export default function Cart() {
  const { items, restaurantName, setQuantity, subtotal, clear } = useCart()
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="cd-empty-state">
        <p>Your cart is empty.</p>
        <Link to="/" className="cd-btn cd-btn-primary">
          Browse restaurants
        </Link>
      </div>
    )
  }

  return (
    <div className="cd-cart-page">
      <h1>Your cart</h1>
      <p className="cd-cart-restaurant">From {restaurantName}</p>

      <div className="cd-card">
        <ul className="cd-cart-list">
          {items.map((item) => (
            <li key={item.menuItemId}>
              <span className="cd-item-name">
                <i className={`cd-veg-dot ${item.isVeg ? 'veg' : 'nonveg'}`} aria-hidden="true" />
                {item.name}
              </span>
              <div className="cd-stepper">
                <button type="button" onClick={() => setQuantity(item.menuItemId, item.quantity - 1)}>
                  −
                </button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => setQuantity(item.menuItemId, item.quantity + 1)}>
                  +
                </button>
              </div>
              <span className="cd-item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <div className="cd-cart-summary-row">
          <span>Subtotal</span>
          <strong>₹{subtotal.toFixed(2)}</strong>
        </div>

        <div className="cd-cart-actions">
          <button type="button" className="cd-btn cd-btn-secondary" onClick={clear}>
            Clear cart
          </button>
          <button type="button" className="cd-btn cd-btn-primary" onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>
        </div>
      </div>
    </div>
  )
}
