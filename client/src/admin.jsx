import { useEffect, useState } from "react";
import "./admin.css";

import ProductManagement from "./pages/productmanagement";
import InventoryManagement from "./pages/inventorymanagement";
import OrderManagement from "./pages/ordermanagement";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${API_BASE}/api/auth`;
const STATS_URL = `${API_BASE}/api/orders/stats`;

function Admin() {
  const [activePage, setActivePage] = useState("dashboard");

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
  });

  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");

  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Verify saved admin token when the page loads
  useEffect(() => {
    const verifyAdmin = async () => {
      const savedToken = localStorage.getItem("freshmart-admin-token");

      if (!savedToken) {
        setCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.success || data.user?.role !== "admin") {
          throw new Error("Admin session is invalid.");
        }

        setToken(savedToken);
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem("freshmart-admin-token");
        setToken("");
        setUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyAdmin();
  }, []);

  // Admin login
  const handleLogin = async (event) => {
    event.preventDefault();

    setLoginError("");
    setLoginLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      if (data.user?.role !== "admin") {
        throw new Error(
          "Access denied. This account is not an administrator."
        );
      }

      if (!data.token) {
        throw new Error("The server did not return an authentication token.");
      }

      localStorage.setItem("freshmart-admin-token", data.token);

      setToken(data.token);
      setUser(data.user);
      setPassword("");
      setActivePage("dashboard");
    } catch (error) {
      setLoginError(error.message || "Unable to log in. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Admin logout
  const handleLogout = () => {
    localStorage.removeItem("freshmart-admin-token");
    setToken("");
    setUser(null);
    setEmail("");
    setPassword("");
    setActivePage("dashboard");
    setLoginError("");
    setStatsError("");
  };

  // Fetch all dashboard statistics
  useEffect(() => {
    if (!token || activePage !== "dashboard") return;

    const fetchDashboardStats = async () => {
      setStatsLoading(true);
      setStatsError("");

      try {
        const response = await fetch(STATS_URL, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load dashboard statistics."
          );
        }

        setStats({
          totalProducts: data.stats?.totalProducts ?? 0,
          totalOrders: data.stats?.totalOrders ?? 0,
          totalCustomers: data.stats?.totalCustomers ?? 0,
          totalRevenue: data.stats?.totalRevenue ?? 0,
        });
      } catch (error) {
        console.error("Dashboard statistics error:", error);
        setStatsError(error.message || "Failed to load statistics.");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchDashboardStats();
  }, [token, activePage]);

  const showPage = (page) => {
    setActivePage(page);
  };

  const getPageTitle = () => {
    const titles = {
      dashboard: "Admin Dashboard",
      products: "Product Management",
      orders: "Order Management",
      inventory: "Inventory Management",
      customers: "Customer Management",
      sales: "Sales Reports",
      settings: "Settings",
    };

    return titles[activePage] || "Admin Dashboard";
  };

  // Loading screen while verifying saved token
  if (checkingAuth) {
    return (
      <div className="admin-auth-loading">
        <div className="admin-loading-spinner"></div>
        <p>Verifying administrator access...</p>
      </div>
    );
  }

  // Login screen
  if (!user || !token) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-brand">
          <div className="admin-login-logo">🛒</div>
          <h1>
            Fresh<span>Mart</span>
          </h1>
          <p>ADMINISTRATION PORTAL</p>
        </div>

        <div className="admin-login-card">
          <div className="admin-login-heading">
            <span className="admin-login-tag">SECURE ACCESS</span>
            <h2>Welcome back</h2>
            <p>Sign in to manage your FreshMart store.</p>
          </div>

          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              placeholder="Enter your admin email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />

            <label htmlFor="admin-password">Password</label>
            <div className="admin-password-wrapper">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {loginError && (
              <div className="admin-login-error" role="alert">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="admin-login-submit"
              disabled={loginLoading}
            >
              {loginLoading ? "Signing in..." : "Sign in to Dashboard"}
            </button>
          </form>

          <div className="admin-login-footer">
            <span>🔒</span>
            Protected administrator access
          </div>
        </div>

        <p className="admin-login-copyright">
          © {new Date().getFullYear()} FreshMart. All rights reserved.
        </p>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div
          className="admin-logo"
          onClick={() => showPage("dashboard")}
          style={{ cursor: "pointer" }}
        >
          🛒 Fresh<span>Mart</span>
        </div>

        <p className="admin-nav-title">MAIN MENU</p>

        <nav className="admin-nav">
          <button
            className={activePage === "dashboard" ? "active" : ""}
            onClick={() => showPage("dashboard")}
          >
            📊 Dashboard
          </button>

          <button
            className={activePage === "products" ? "active" : ""}
            onClick={() => showPage("products")}
          >
            📦 Products
          </button>

          <button
            className={activePage === "orders" ? "active" : ""}
            onClick={() => showPage("orders")}
          >
            📋 Orders
          </button>

          <button
            className={activePage === "inventory" ? "active" : ""}
            onClick={() => showPage("inventory")}
          >
            📊 Inventory
          </button>

          <button
            className={activePage === "customers" ? "active" : ""}
            onClick={() => showPage("customers")}
          >
            👥 Customers
          </button>
        </nav>

        <p className="admin-nav-title">MANAGEMENT</p>

        <nav className="admin-nav">
          <button
            className={activePage === "sales" ? "active" : ""}
            onClick={() => showPage("sales")}
          >
            💰 Sales Reports
          </button>

          <button
            className={activePage === "settings" ? "active" : ""}
            onClick={() => showPage("settings")}
          >
            ⚙️ Settings
          </button>

          <button onClick={handleLogout}>
            🚪 Logout
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <h3>{getPageTitle()}</h3>

          <div className="admin-profile">
            <div className="admin-avatar">
              {user.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <strong>{user.name || "Administrator"}</strong>
          </div>
        </header>

        <section className="admin-content">
          {activePage === "dashboard" && (
            <>
              <div className="admin-welcome">
                <h1>Dashboard Overview</h1>
                <p>
                  Welcome back! Here's what's happening at FreshMart.
                </p>
              </div>

              {statsError && (
                <div className="admin-login-error" role="alert">
                  {statsError}
                </div>
              )}

              <div className="admin-stats">
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">📦</div>
                  <p>Total Products</p>
                  <h2>
                    {statsLoading ? "..." : stats.totalProducts}
                  </h2>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-icon">📋</div>
                  <p>Total Orders</p>
                  <h2>
                    {statsLoading ? "..." : stats.totalOrders}
                  </h2>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-icon">👥</div>
                  <p>Total Customers</p>
                  <h2>
                    {statsLoading ? "..." : stats.totalCustomers}
                  </h2>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-icon">💰</div>
                  <p>Total Revenue</p>
                  <h2>
                    {statsLoading
                      ? "..."
                      : `₹${Number(stats.totalRevenue).toLocaleString("en-IN")}`}
                  </h2>
                </div>
              </div>

              <div className="admin-panel">
                <h2>Quick Actions</h2>
                <div className="admin-shortcuts">
                  <button onClick={() => showPage("products")}>
                    + Add Product
                  </button>
                  <button onClick={() => showPage("products")}>
                    View Products
                  </button>
                  <button onClick={() => showPage("orders")}>
                    Manage Orders
                  </button>
                </div>
              </div>

              <div className="admin-panel">
                <h2>Recent Activity</h2>
                <p>No recent activity available.</p>
              </div>
            </>
          )}

          {activePage === "products" && <ProductManagement />}
          {activePage === "inventory" && <InventoryManagement />}
          {activePage === "orders" && <OrderManagement />}

          {activePage !== "dashboard" &&
            activePage !== "products" &&
            activePage !== "inventory" &&
            activePage !== "orders" && (
              <div className="admin-panel">
                <h2>{getPageTitle()}</h2>
                <p>This section will be developed in a later step.</p>
              </div>
            )}
        </section>
      </main>
    </div>
  );
}

export default Admin;