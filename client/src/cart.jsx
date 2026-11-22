import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "./cartcontext.jsx";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const ORDER_API = `${API_BASE}/api/orders`;

export default function Cart() {
  const navigate = useNavigate();

  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartCount,
    cartTotal,
  } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  const placeOrder = async (event) => {
    event.preventDefault();
    setError("");

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (customerName.trim().length < 2) {
      setError("Please enter a valid full name.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (deliveryAddress.trim().length < 10) {
      setError("Please enter a complete delivery address (at least 10 characters).");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(ORDER_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: customerName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          deliveryAddress: deliveryAddress.trim(),
          paymentMethod: "Cash on Delivery",
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to place your order.");
      }

      setOrder(data.order);
      clearCart();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (order) {
    return (
      <div className="cart-page">
        <header className="navbar">
          <div className="logo" onClick={() => navigate("/")}>
            <span className="logo-icon">🛒</span>
            Fresh<span className="logo-dark">Mart</span>
          </div>
        </header>

        <main className="cart-page-container">
          <section className="checkout-success">
            <span>✅</span>
            <h2>Order placed successfully!</h2>
            <p>Thank you for shopping with FreshMart.</p>

            <p>
              Order ID: <strong>{order._id}</strong>
            </p>

            <p>
              Customer: <strong>{order.customerName}</strong>
            </p>

            <p>
              Payment: <strong>Cash on Delivery</strong>
            </p>

            <p>
              Total: <strong>₹{order.totalAmount}</strong>
            </p>

            <button onClick={() => navigate("/")}>
              Continue Shopping
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <header className="navbar">
        <div className="logo" onClick={() => navigate("/")}>
          <span className="logo-icon">🛒</span>
          Fresh<span className="logo-dark">Mart</span>
        </div>

        <button className="cart-button" onClick={() => navigate("/")}>
          ← Continue Shopping
        </button>
      </header>

      <main className="cart-page-container">
        <div className="cart-page-heading">
          <h1>Your Shopping Cart</h1>
          <p>{cartCount} items in your cart</p>
        </div>

        {error && <div className="checkout-error">{error}</div>}

        {cart.length === 0 ? (
          <section className="empty-cart cart-empty-page">
            <span>🛒</span>
            <h3>Your cart is empty</h3>
            <p>Add some groceries before checking out.</p>
            <button onClick={() => navigate("/")}>
              Start Shopping
            </button>
          </section>
        ) : (
          <div className="cart-page-layout">
            <section className="cart-page-items">
              <h2>Cart Items</h2>

              {cart.map((item) => (
                <article className="cart-page-item" key={item.id}>
                  <img src={item.image} alt={item.name} />

                  <div className="cart-page-item-info">
                    <h3>{item.name}</h3>
                    <p>{item.size}</p>
                    <strong>₹{item.price}</strong>

                    <div className="quantity-controls">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="cart-page-item-total">
                    <strong>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </strong>

                    <button
                      className="remove-cart-item"
                      onClick={() => removeFromCart(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </section>

            <aside className="cart-checkout-panel">
              <h2>Customer Details</h2>

              <form className="checkout-form" onSubmit={placeOrder}>
                <label>
                  Full Name *
                  <input
                    type="text"
                    minLength="2"
                    maxLength="80"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </label>

                <label>
                  Mobile Number *
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength="10"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="10-digit mobile number"
                    required
                  />
                </label>

                <label>
                  Email Address (Optional)
                  <input
                    type="email"
                    maxLength="120"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </label>

                <label>
                  Complete Delivery Address *
                  <textarea
                    rows="4"
                    minLength="10"
                    maxLength="300"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="House number, street, area, city, PIN code"
                    required
                  />
                </label>

                <div className="checkout-payment">
                  <span>Payment Method</span>
                  <strong>Cash on Delivery</strong>
                  <small>Pay when your order arrives.</small>
                </div>

                <div className="checkout-order-summary">
                  <span>Subtotal ({cartCount} items)</span>
                  <strong>₹{cartTotal.toFixed(2)}</strong>
                </div>

                <p className="cart-delivery-note">
                  Delivery charges, if any, will be confirmed by the store.
                </p>

                <button
                  className="checkout-button"
                  type="submit"
                  disabled={loading || cart.length === 0}
                >
                  {loading ? "Placing Order..." : "Place Order"}
                </button>
              </form>
            </aside>
          </div>
        )}
      </main>

      <footer className="footer">
        <h2>🛒 FreshMart</h2>
        <p>Your neighbourhood store, now online.</p>
      </footer>
    </div>
  );
}