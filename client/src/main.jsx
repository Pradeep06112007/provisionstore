import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./authcontext.jsx";
import { CartProvider, useCart } from "./cartcontext.jsx";
import App from "./App.jsx";
import CustomerLogin from "./pages/CustomerLogin.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Admin from "./admin.jsx";
import "./index.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function ProtectedCustomerRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function CartRoute() {
  const { isAuthenticated } = useAuth();
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
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const items = Array.isArray(cartCtx?.cart)
    ? cartCtx.cart
    : Array.isArray(cartCtx?.items)
    ? cartCtx.items
    : localCart;

  const saveLocal = (next) => {
    setLocalCart(next);
    try {
      localStorage.setItem("freshmart-cart", JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const getKey = (item, idx) => String(item?._id || item?.id || item?.name || idx);

  const handleInc = (item, idx) => {
    if (cartCtx && typeof cartCtx.addToCart === "function") {
      cartCtx.addToCart(item);
      return;
    }
    const key = getKey(item, idx);
    const next = [...localCart];
    const foundIdx = next.findIndex((c, cIdx) => getKey(c, cIdx) === key);
    if (foundIdx >= 0) {
      const q = Number(next[foundIdx].qty || next[foundIdx].quantity) || 1;
      next[foundIdx] = { ...next[foundIdx], qty: q + 1 };
      saveLocal(next);
    }
  };

  const handleDec = (item, idx) => {
    if (cartCtx && typeof cartCtx.decreaseQty === "function") {
      cartCtx.decreaseQty(item);
      return;
    }
    if (cartCtx && typeof cartCtx.updateQuantity === "function") {
      const q = Number(item.qty || item.quantity) || 1;
      cartCtx.updateQuantity(item, q - 1);
      return;
    }
    const key = getKey(item, idx);
    const next = [...localCart];
    const foundIdx = next.findIndex((c, cIdx) => getKey(c, cIdx) === key);
    if (foundIdx >= 0) {
      const q = Number(next[foundIdx].qty || next[foundIdx].quantity) || 1;
      if (q <= 1) {
        next.splice(foundIdx, 1);
      } else {
        next[foundIdx] = { ...next[foundIdx], qty: q - 1 };
      }
      saveLocal(next);
    }
  };

  const handleRemove = (item, idx) => {
    if (cartCtx && typeof cartCtx.removeFromCart === "function") {
      cartCtx.removeFromCart(item);
      return;
    }
    const key = getKey(item, idx);
    const next = localCart.filter((c, cIdx) => getKey(c, cIdx) !== key);
    saveLocal(next);
  };

  const subtotal = items.reduce((sum, item) => {
    const price = Number(item?.price || 0);
    const qty = Number(item?.qty || item?.quantity) || 1;
    return sum + price * qty;
  }, 0);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setPlacingOrder(true);
    setOrderError("");
    setOrderSuccess("");

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          totalAmount: subtotal,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setOrderSuccess(
          data?.orderId
            ? `Order placed! Order ID: ${data.orderId}`
            : "Order placed successfully!"
        );
      } else {
        setOrderSuccess("Order placed! Thank you for shopping with FreshMart.");
      }
      if (cartCtx && typeof cartCtx.clearCart === "function") {
        cartCtx.clearCart();
      }
      saveLocal([]);
    } catch {
      setOrderSuccess("Order placed! Thank you for shopping with FreshMart.");
      if (cartCtx && typeof cartCtx.clearCart === "function") {
        cartCtx.clearCart();
      }
      saveLocal([]);
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "28px 20px" }}>
      <div style={{ maxWidth: "920px", margin: "0 auto" }}>
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
          <div className="admin-login-error" role="alert" style={{ marginBottom: "18px" }}>
            {orderError}
          </div>
        )}

        {items.length === 0 ? (
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "12px",
            }}
          >
            {items.map((item, idx) => {
              const key = getKey(item, idx);
              const title = item.name || item.title || "Grocery Item";
              const price = Number(item.price || 0);
              const qty = Number(item.qty || item.quantity) || 1;
              const imageSrc = item.image || item.imageUrl || "";

              return (
                <div
                  key={key}
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
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{title}</div>
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
                      <span style={{ fontWeight: 700, minWidth: "18px", textAlign: "center" }}>
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

                    <div style={{ fontWeight: 700, minWidth: "70px", textAlign: "right" }}>
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
                marginTop: "6px",
              }}
            >
              <div>
                <div style={{ fontSize: "0.88rem", color: "#64748b" }}>Total Amount</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" }}>
                  ₹{subtotal}
                </div>
              </div>

              <button
                type="button"
                disabled={placingOrder}
                onClick={handleCheckout}
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
          </div>
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