import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./authcontext.jsx";
import { CartProvider, useCart } from "./cartcontext.jsx";
import App from "./App.jsx";
import CustomerLogin from "./pages/CustomerLogin.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Admin from "./admin.jsx";
import "./index.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getCartItemId(item, idx = 0) {
  return String(
    item?._id ||
      item?.id ||
      item?.productId ||
      item?.name ||
      item?.title ||
      idx
  );
}

function ProtectedCustomerRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function CartRoute() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const cartCtx = typeof useCart === "function" ? useCart() : null;

  const [localCart, setLocalCart] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("freshmart-cart") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [customerName, setCustomerName] = useState(
    () => user?.name || ""
  );
  const [customerPhone, setCustomerPhone] = useState(
    () => user?.phone || ""
  );
  const [customerEmail, setCustomerEmail] = useState(
    () => user?.email || ""
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    () => user?.address || ""
  );
  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [notes, setNotes] = useState("");

  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (user?.name && !customerName) setCustomerName(user.name);
    if (user?.email && !customerEmail) setCustomerEmail(user.email);
    if (user?.phone && !customerPhone) setCustomerPhone(user.phone);
    if (user?.address && !deliveryAddress) setDeliveryAddress(user.address);
  }, [user, customerName, customerEmail, customerPhone, deliveryAddress]);

  if (!isAuthenticated) {
    return null;
  }

  const rawItems = Array.isArray(cartCtx?.cart)
    ? cartCtx.cart
    : Array.isArray(cartCtx?.items)
    ? cartCtx.items
    : Array.isArray(cartCtx?.cartItems)
    ? cartCtx.cartItems
    : localCart;

  const saveLocal = (next) => {
    setLocalCart(next);
    try {
      localStorage.setItem("freshmart-cart", JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleInc = (item, idx) => {
    if (cartCtx && typeof cartCtx.addToCart === "function") {
      cartCtx.addToCart(item);
      return;
    }
    if (cartCtx && typeof cartCtx.incrementQty === "function") {
      cartCtx.incrementQty(getCartItemId(item, idx));
      return;
    }
    const id = getCartItemId(item, idx);
    const next = [...localCart];
    const foundIdx = next.findIndex((c, cIdx) => getCartItemId(c, cIdx) === id);
    if (foundIdx >= 0) {
      const q = Number(next[foundIdx].qty || next[foundIdx].quantity) || 1;
      next[foundIdx] = { ...next[foundIdx], qty: q + 1 };
      saveLocal(next);
    }
  };

  const handleDec = (item, idx) => {
    const id = getCartItemId(item, idx);
    const q = Number(item.qty || item.quantity) || 1;

    if (cartCtx && typeof cartCtx.decreaseQty === "function") {
      cartCtx.decreaseQty(id);
      return;
    }
    if (cartCtx && typeof cartCtx.decrementQty === "function") {
      cartCtx.decrementQty(id);
      return;
    }
    if (cartCtx && typeof cartCtx.updateQuantity === "function") {
      cartCtx.updateQuantity(id, q - 1);
      return;
    }
    if (cartCtx && typeof cartCtx.updateQty === "function") {
      cartCtx.updateQty(id, q - 1);
      return;
    }
    const next = [...localCart];
    const foundIdx = next.findIndex((c, cIdx) => getCartItemId(c, cIdx) === id);
    if (foundIdx >= 0) {
      if (q <= 1) {
        next.splice(foundIdx, 1);
      } else {
        next[foundIdx] = { ...next[foundIdx], qty: q - 1 };
      }
      saveLocal(next);
    }
  };

  const handleRemove = (item, idx) => {
    const id = getCartItemId(item, idx);
    if (cartCtx && typeof cartCtx.removeFromCart === "function") {
      cartCtx.removeFromCart(id);
      return;
    }
    if (cartCtx && typeof cartCtx.removeItem === "function") {
      cartCtx.removeItem(id);
      return;
    }
    const next = localCart.filter((c, cIdx) => getCartItemId(c, cIdx) !== id);
    saveLocal(next);
  };

  const clearAllCartItems = () => {
    if (cartCtx && typeof cartCtx.clearCart === "function") {
      cartCtx.clearCart();
    }
    saveLocal([]);
  };

  const subtotal = rawItems.reduce((sum, item) => {
    const price = Number(item?.price || 0);
    const qty = Number(item?.qty || item?.quantity) || 1;
    return sum + price * qty;
  }, 0);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (rawItems.length === 0) return;

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    const cleanAddress = deliveryAddress.trim();

    if (!cleanName || !cleanPhone || !cleanAddress) {
      setOrderError(
        "Please enter your full name, phone number, and delivery address before placing the order."
      );
      return;
    }

    setPlacingOrder(true);
    setOrderError("");
    setOrderSuccess("");

    const orderPayload = {
      customerName: cleanName,
      customerPhone: cleanPhone,
      customerEmail: customerEmail.trim() || user?.email || "",
      deliveryAddress: cleanAddress,
      paymentMethod,
      notes: notes.trim(),
      items: rawItems.map((item, idx) => ({
        productId: getCartItemId(item, idx),
        name: item.name || item.title || "Grocery Item",
        category: item.category || "Grocery",
        price: Number(item.price || 0),
        qty: Number(item.qty || item.quantity) || 1,
      })),
      totalAmount: subtotal,
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json().catch(() => ({}));
      const orderId =
        data?.order?._id ||
        data?.orderId ||
        data?._id ||
        `FM-${Date.now().toString().slice(-6)}`;

      // Save a local copy for admin/history views if needed
      try {
        const existingOrders = JSON.parse(
          localStorage.getItem("freshmart-orders") || "[]"
        );
        const list = Array.isArray(existingOrders) ? existingOrders : [];
        list.unshift({ ...orderPayload, orderId });
        localStorage.setItem("freshmart-orders", JSON.stringify(list));
      } catch {
        // ignore storage errors
      }

      clearAllCartItems();
      setNotes("");
      setOrderSuccess(
        `Order #${orderId} placed for ${cleanName} (₹${subtotal})! Your order details are now sent to FreshMart Admin.`
      );
    } catch {
      const fallbackId = `FM-${Date.now().toString().slice(-6)}`;
      try {
        const existingOrders = JSON.parse(
          localStorage.getItem("freshmart-orders") || "[]"
        );
        const list = Array.isArray(existingOrders) ? existingOrders : [];
        list.unshift({ ...orderPayload, orderId: fallbackId });
        localStorage.setItem("freshmart-orders", JSON.stringify(list));
      } catch {
        // ignore storage errors
      }
      clearAllCartItems();
      setNotes("");
      setOrderSuccess(
        `Order #${fallbackId} recorded for ${cleanName} (₹${subtotal}).`
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "28px 20px" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.6rem", color: "#0f172a" }}>
            Your FreshMart Cart
          </h2>
          <Link
            to="/"
            style={{
              textDecoration: "none",
              color: "#166534",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            ← Back to Store
          </Link>
        </div>

        {orderSuccess && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontWeight: 600,
              marginBottom: "18px",
            }}
          >
            {orderSuccess}
          </div>
        )}

        {orderError && (
          <div
            className="admin-login-error"
            role="alert"
            style={{ marginBottom: "18px" }}
          >
            {orderError}
          </div>
        )}

        {rawItems.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "36px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 14px", color: "#475569", fontSize: "1rem" }}>
              Your cart is currently empty.
            </p>
            <Link
              to="/"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: "8px",
                background: "#166534",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Browse Groceries
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleCheckoutSubmit}
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}
          >
            {rawItems.map((item, idx) => {
              const id = getCartItemId(item, idx);
              const title = item.name || item.title || "Grocery Item";
              const price = Number(item.price || 0);
              const qty = Number(item.qty || item.quantity) || 1;
              const imageSrc = item.image || item.imageUrl || "";

              return (
                <div
                  key={`${id}-${idx}`}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 18px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={title}
                        style={{
                          width: "60px",
                          height: "60px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    ) : null}
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {title}
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "#64748b" }}>
                        ₹{price} each
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "4px 10px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleDec(item, idx)}
                        style={{
                          border: "none",
                          background: "transparent",
                          fontWeight: 700,
                          fontSize: "1rem",
                          cursor: "pointer",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontWeight: 700,
                          minWidth: "18px",
                          textAlign: "center",
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInc(item, idx)}
                        style={{
                          border: "none",
                          background: "transparent",
                          fontWeight: 700,
                          fontSize: "1rem",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>

                    <div
                      style={{
                        fontWeight: 700,
                        minWidth: "70px",
                        textAlign: "right",
                      }}
                    >
                      ₹{price * qty}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(item, idx)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "7px",
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Customer & Delivery Details for Admin Order Management */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                marginTop: "6px",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "#0f172a" }}>
                Customer & Delivery Details
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <label
                    htmlFor="order-customer-name"
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "0.86rem",
                      marginBottom: "4px",
                    }}
                  >
                    Full Name *
                  </label>
                  <input
                    id="order-customer-name"
                    type="text"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="order-customer-phone"
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "0.86rem",
                      marginBottom: "4px",
                    }}
                  >
                    Phone Number *
                  </label>
                  <input
                    id="order-customer-phone"
                    type="tel"
                    placeholder="Enter 10-digit phone number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="order-customer-email"
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "0.86rem",
                      marginBottom: "4px",
                    }}
                  >
                    Email (Optional)
                  </label>
                  <input
                    id="order-customer-email"
                    type="email"
                    placeholder="Enter email address"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="order-payment-method"
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "0.86rem",
                      marginBottom: "4px",
                    }}
                  >
                    Payment Method
                  </label>
                  <select
                    id="order-payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  htmlFor="order-delivery-address"
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "0.86rem",
                    marginBottom: "4px",
                  }}
                >
                  Delivery Address *
                </label>
                <textarea
                  id="order-delivery-address"
                  rows={2}
                  placeholder="House/Street, Village/Town (e.g., Thalluru, AP 524142)"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="order-notes"
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "0.86rem",
                    marginBottom: "4px",
                  }}
                >
                  Delivery Notes (Optional)
                </label>
                <input
                  id="order-notes"
                  type="text"
                  placeholder="Any landmark or delivery instructions"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Total & Place Order Bar */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "0.88rem", color: "#64748b" }}>
                  Total Amount
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  ₹{subtotal}
                </div>
              </div>

              <button
                type="submit"
                disabled={placingOrder}
                style={{
                  padding: "11px 22px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#166534",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                {placingOrder ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedCustomerRoute>
                  <App />
                </ProtectedCustomerRoute>
              }
            />
            <Route path="/login" element={<CustomerLogin />} />
            <Route
              path="/search"
              element={
                <ProtectedCustomerRoute>
                  <SearchResults />
                </ProtectedCustomerRoute>
              }
            />
            <Route path="/cart" element={<CartRoute />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  </StrictMode>
);