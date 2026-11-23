import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const NAV_GROUPS = [
  {
    section: "MAIN MENU",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "📊", path: "/admin" },
      { key: "products", label: "Products", icon: "📦", path: "/admin/products" },
      { key: "orders", label: "Orders", icon: "📋", path: "/admin/orders" },
      { key: "inventory", label: "Inventory", icon: "📈", path: "/admin/inventory" },
      {
        key: "stock-tracker",
        label: "Stock Tracker",
        icon: "🎯",
        path: "/admin/stock-tracker",
      },
      { key: "customers", label: "Customers", icon: "👥", path: "/admin/customers" },
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      { key: "sales", label: "Sales Reports", icon: "💰", path: "/admin/sales" },
      { key: "settings", label: "Settings", icon: "⚙️", path: "/admin/settings" },
    ],
  },
];

function resolveActiveTab(pathname) {
  const clean = String(pathname || "/admin").replace(/\/+$/, "") || "/admin";
  if (clean === "/admin") return "dashboard";
  if (clean.startsWith("/admin/products")) return "products";
  if (clean.startsWith("/admin/orders")) return "orders";
  if (clean.startsWith("/admin/inventory")) return "inventory";
  if (clean.startsWith("/admin/stock-tracker")) return "stock-tracker";
  if (clean.startsWith("/admin/customers")) return "customers";
  if (clean.startsWith("/admin/sales")) return "sales";
  if (clean.startsWith("/admin/settings")) return "settings";
  return "dashboard";
}

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [adminSession, setAdminSession] = useState(() => {
    const token =
      sessionStorage.getItem("freshmart-admin-token") ||
      localStorage.getItem("freshmart-admin-token");
    const lastActive = Number(
      sessionStorage.getItem("freshmart-admin-last-active") ||
        localStorage.getItem("freshmart-admin-last-active") ||
        0
    );
    if (token && lastActive && Date.now() - lastActive > IDLE_TIMEOUT_MS) {
      sessionStorage.removeItem("freshmart-admin-token");
      localStorage.removeItem("freshmart-admin-token");
      return null;
    }
    return token ? { token } : null;
  });

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [products, setProducts] = useState(() =>
    readStoredJson("freshmart-products", [])
  );
  const [orders, setOrders] = useState(() =>
    readStoredJson("freshmart-orders", [])
  );
  const [customers, setCustomers] = useState(() =>
    readStoredJson("freshmart-customers", [])
  );

  // Add Product form state
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Rice & Dals");
  const [newPrice, setNewPrice] = useState("");
  const [newMrp, setNewMrp] = useState("");
  const [newUnit, setNewUnit] = useState("1 kg");
  const [newStock, setNewStock] = useState("25");
  const [newImage, setNewImage] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [productStatusMsg, setProductStatusMsg] = useState("");

  const activeTab = resolveActiveTab(location.pathname);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("freshmart-admin-token");
    sessionStorage.removeItem("freshmart-admin-last-active");
    localStorage.removeItem("freshmart-admin-token");
    localStorage.removeItem("freshmart-admin-last-active");
    setAdminSession(null);
    setMobileMenuOpen(false);
  }, []);

  // 30-minute idle auto-logout
  useEffect(() => {
    if (!adminSession) return;

    const touchActivity = () => {
      const now = String(Date.now());
      sessionStorage.setItem("freshmart-admin-last-active", now);
      localStorage.setItem("freshmart-admin-last-active", now);
    };

    touchActivity();

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) => window.addEventListener(evt, touchActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const lastActive = Number(
        sessionStorage.getItem("freshmart-admin-last-active") ||
          localStorage.getItem("freshmart-admin-last-active") ||
          Date.now()
      );
      if (Date.now() - lastActive >= IDLE_TIMEOUT_MS) {
        handleLogout();
      }
    }, 15000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, touchActivity));
      window.clearInterval(timer);
    };
  }, [adminSession, handleLogout]);

  // Load products & orders from backend with localStorage fallback
  useEffect(() => {
    if (!adminSession) return;

    fetch(`${API_BASE}/api/products`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
          ? data.products
          : null;
        if (list) {
          setProducts(list);
          try {
            localStorage.setItem("freshmart-products", JSON.stringify(list));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/orders`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const backendOrders = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
          ? data.orders
          : [];
        const localOrders = readStoredJson("freshmart-orders", []);
        const combined = [...backendOrders, ...localOrders];
        const seen = new Set();
        const deduped = combined.filter((ord, i) => {
          const id = String(ord?._id || ord?.orderId || ord?.id || i);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        if (deduped.length > 0) {
          setOrders(deduped);
        }
      })
      .catch(() => {
        setOrders(readStoredJson("freshmart-orders", []));
      });

    fetch(`${API_BASE}/api/customers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.customers)
          ? data.customers
          : [];
        if (list.length > 0) {
          setCustomers(list);
        }
      })
      .catch(() => {});
  }, [adminSession]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data?.token || data?.success || data?.admin)) {
        const token = data.token || "freshmart-admin-session";
        const now = String(Date.now());
        sessionStorage.setItem("freshmart-admin-token", token);
        sessionStorage.setItem("freshmart-admin-last-active", now);
        localStorage.setItem("freshmart-admin-token", token);
        localStorage.setItem("freshmart-admin-last-active", now);
        setAdminSession({ token, email: data?.admin?.email || loginEmail.trim() });
      } else {
        setLoginError(data?.message || "Invalid admin credentials.");
      }
    } catch {
      setLoginError("Unable to reach admin server.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice) return;
    setProductStatusMsg("");

    const payload = {
      name: newName.trim(),
      category: newCategory,
      price: Number(newPrice) || 0,
      mrp: Number(newMrp) || Number(newPrice) || 0,
      unit: newUnit.trim() || "1 kg",
      stock: Number(newStock) || 0,
      image: newImage.trim(),
      description: newDescription.trim() || "Fresh grocery item at FreshMart.",
    };

    try {
      const res = await fetch(`${API_BASE}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = res.ok ? await res.json().catch(() => null) : null;
      const savedItem = created?.product || created || { ...payload, _id: `prod-${Date.now()}` };
      const nextProducts = [savedItem, ...products];
      setProducts(nextProducts);
      try {
        localStorage.setItem("freshmart-products", JSON.stringify(nextProducts));
      } catch {
        // ignore
      }
      setNewName("");
      setNewPrice("");
      setNewMrp("");
      setNewImage("");
      setNewDescription("");
      setProductStatusMsg(`Added "${savedItem.name}" to store catalog.`);
    } catch {
      const localItem = { ...payload, _id: `prod-${Date.now()}` };
      const nextProducts = [localItem, ...products];
      setProducts(nextProducts);
      try {
        localStorage.setItem("freshmart-products", JSON.stringify(nextProducts));
      } catch {
        // ignore
      }
      setProductStatusMsg(`Saved "${localItem.name}" locally.`);
    }
  };

  const totalRevenue = useMemo(
    () =>
      orders.reduce((sum, ord) => {
        const amt = Number(ord?.totalAmount ?? ord?.total ?? 0);
        return sum + (Number.isFinite(amt) ? amt : 0);
      }, 0),
    [orders]
  );

  const uniqueCustomerCount = useMemo(() => {
    if (customers.length > 0) return customers.length;
    const phonesOrNames = new Set(
      orders
        .map((o) => String(o?.customerPhone || o?.customerName || "").trim())
        .filter(Boolean)
    );
    return phonesOrNames.size;
  }, [customers, orders]);

  if (!adminSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <form
          onSubmit={handleAdminLogin}
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "28px",
            maxWidth: "380px",
            width: "100%",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <h2 style={{ margin: "0 0 6px", color: "#14532d" }}>FreshMart Admin</h2>
          <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: "0.9rem" }}>
            Sign in to manage products, orders, and stock.
          </p>

          {loginError && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                padding: "10px 12px",
                borderRadius: "8px",
                fontSize: "0.86rem",
                marginBottom: "14px",
              }}
            >
              {loginError}
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label
              htmlFor="admin-email"
              style={{ display: "block", fontWeight: 600, fontSize: "0.86rem", marginBottom: "4px" }}
            >
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="admin-password"
              style={{ display: "block", fontWeight: 600, fontSize: "0.86rem", marginBottom: "4px" }}
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#166534",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loggingIn ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      {/* Left Sidebar on Desktop / Top Green Bar with Three-Line Toggle on Mobile */}
      <aside
        style={{
          width: isMobile ? "100%" : "245px",
          flexShrink: 0,
          background: "#14532d",
          color: "#ffffff",
          padding: isMobile ? "12px 16px" : "22px 14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top Row: Three Horizontal Lines on Mobile + Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isMobile && (
              <button
                type="button"
                aria-label="Toggle admin menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: "1.2rem",
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            )}

            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                textDecoration: "none",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "1.35rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🛒</span>
              <span>
                Fresh<span style={{ color: "#facc15" }}>Mart</span>
              </span>
            </Link>
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "6px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(255,255,255,0.25)",
                background: "transparent",
                color: "#dcfce7",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          )}
        </div>

        {/* Navigation Options: Always visible on desktop; hidden on mobile until ☰ is clicked */}
        {(!isMobile || mobileMenuOpen) && (
          <div style={{ marginTop: isMobile ? "14px" : "24px" }}>
            {NAV_GROUPS.map((group) => (
              <div key={group.section} style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#86efac",
                    padding: "0 10px",
                    marginBottom: "8px",
                  }}
                >
                  {group.section}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {group.items.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          setMobileMenuOpen(false);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "none",
                          background: isActive
                            ? "rgba(255, 255, 255, 0.16)"
                            : "transparent",
                          color: "#ffffff",
                          fontWeight: isActive ? 700 : 500,
                          fontSize: "0.94rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                        }}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!isMobile && (
              <div
                style={{
                  marginTop: "24px",
                  paddingTop: "14px",
                  borderTop: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <Link
                  to="/"
                  style={{
                    color: "#bbf7d0",
                    textDecoration: "none",
                    fontSize: "0.86rem",
                    padding: "4px 10px",
                  }}
                >
                  ← View Customer Store
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.15)",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "0.86rem",
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top White Subheader */}
        <header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f172a" }}>
            Admin Dashboard
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#166534",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              F
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              FreshMart Admin
            </span>
          </div>
        </header>

        <main style={{ padding: "24px", maxWidth: "1140px" }}>
          {activeTab === "dashboard" && (
            <>
              <h1 style={{ margin: "0 0 6px", fontSize: "1.75rem" }}>
                Dashboard Overview
              </h1>
              <p style={{ margin: "0 0 22px", color: "#64748b" }}>
                Welcome back! Here&apos;s what&apos;s happening at FreshMart.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "20px",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", marginBottom: "8px" }}>📦</div>
                  <div style={{ color: "#64748b", fontSize: "0.88rem" }}>
                    Total Products
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "4px" }}>
                    {products.length}
                  </div>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "20px",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", marginBottom: "8px" }}>📋</div>
                  <div style={{ color: "#64748b", fontSize: "0.88rem" }}>
                    Total Orders
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "4px" }}>
                    {orders.length}
                  </div>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "20px",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", marginBottom: "8px" }}>👥</div>
                  <div style={{ color: "#64748b", fontSize: "0.88rem" }}>
                    Total Customers
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "4px" }}>
                    {uniqueCustomerCount}
                  </div>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "20px",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", marginBottom: "8px" }}>💰</div>
                  <div style={{ color: "#64748b", fontSize: "0.88rem" }}>
                    Total Revenue
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "4px" }}>
                    ₹{totalRevenue}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "20px",
                }}
              >
                <h2 style={{ margin: "0 0 14px", fontSize: "1.15rem" }}>
                  Quick Actions
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate("/admin/products")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#14532d",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Add Product
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/products")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#14532d",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    View Products
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/orders")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#14532d",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Manage Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/stock-tracker")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#14532d",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Stock Tracker
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "orders" && (
            <div>
              <h1 style={{ margin: "0 0 16px", fontSize: "1.6rem" }}>
                Orders &amp; Delivery Details
              </h1>
              {orders.length === 0 ? (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "24px",
                    color: "#64748b",
                  }}
                >
                  No orders placed yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {orders.map((ord, idx) => (
                    <div
                      key={ord?._id || ord?.orderId || idx}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          gap: "8px",
                          marginBottom: "8px",
                        }}
                      >
                        <strong>
                          Order #{ord?.orderId || ord?._id || idx + 1}
                        </strong>
                        <span style={{ fontWeight: 700, color: "#166534" }}>
                          ₹{Number(ord?.totalAmount ?? ord?.total ?? 0)} •{" "}
                          {ord?.paymentMethod || "Cash on Delivery"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#334155" }}>
                        Customer: <strong>{ord?.customerName || "Customer"}</strong> |
                        Phone: <strong>{ord?.customerPhone || "—"}</strong>
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "#64748b", marginTop: "4px" }}>
                        Address: {ord?.deliveryAddress || "Thalluru, AP"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "products" && (
            <div>
              <h1 style={{ margin: "0 0 16px", fontSize: "1.6rem" }}>
                Product Management
              </h1>

              {productStatusMsg && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    marginBottom: "14px",
                  }}
                >
                  {productStatusMsg}
                </div>
              )}

              <form
                onSubmit={handleAddProduct}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "18px",
                  marginBottom: "20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <input
                  type="text"
                  placeholder="Product Name *"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="number"
                  placeholder="Price (₹) *"
                  required
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="number"
                  placeholder="MRP (₹)"
                  value={newMrp}
                  onChange={(e) => setNewMrp(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="text"
                  placeholder="Unit (e.g., 1 kg)"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="number"
                  placeholder="Stock Qty"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "9px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#166534",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Add Product
                </button>
              </form>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                {products.map((p, i) => (
                  <div
                    key={p?._id || p?.id || i}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "14px",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{p?.name || p?.title}</div>
                    <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                      {p?.category || "Grocery"} • Stock: {p?.stock ?? "—"}
                    </div>
                    <div style={{ fontWeight: 700, color: "#166534", marginTop: "6px" }}>
                      ₹{Number(p?.price || 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === "inventory" ||
            activeTab === "stock-tracker" ||
            activeTab === "customers" ||
            activeTab === "sales" ||
            activeTab === "settings") && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <h1 style={{ margin: "0 0 8px", fontSize: "1.45rem", textTransform: "capitalize" }}>
                {activeTab.replace("-", " ")}
              </h1>
              <p style={{ margin: 0, color: "#64748b" }}>
                Store: FreshMart Provision Store, Thalluru, Andhra Pradesh 524142 •
                Products: {products.length} • Orders: {orders.length} • Revenue: ₹{totalRevenue}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}