import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./admin.css";
import { useAuth } from "./authcontext.jsx";

import ProductManagement from "./pages/productmanagement";
import InventoryManagement from "./pages/inventorymanagement";
import OrderManagement from "./pages/ordermanagement";
import CustomerManagement from "./pages/customermanagement";
import SalesReports from "./pages/salesreports";
import Settings from "./pages/settings";
import StockTracker from "./pages/stocktracker";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${API_BASE}/api/auth`;
const STATS_URL = `${API_BASE}/api/orders/stats`;
const ADMIN_TOKEN_KEY = "freshmart-admin-token";
const ADMIN_LAST_ACTIVE_KEY = "freshmart-admin-last-active";
const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const VALID_PAGES = [
  "dashboard",
  "products",
  "orders",
  "inventory",
  "stock-tracker",
  "customers",
  "sales",
  "settings",
];

function pageFromPathname(pathname) {
  const clean = pathname.replace(/\/+$/, "");
  if (clean === "/admin" || clean === "/admin/dashboard") {
    return "dashboard";
  }
  const match = clean.match(/^\/admin\/([^/]+)/);
  if (match && VALID_PAGES.includes(match[1])) {
    return match[1];
  }
  return "dashboard";
}

function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logoutAdmin } = useAuth();

  const [activePage, setActivePage] = useState(() =>
    pageFromPathname(location.pathname)
  );

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

  // Keep activePage synchronized with URL sub-paths like /admin/orders or /admin/stock-tracker
  useEffect(() => {
    const nextPage = pageFromPathname(location.pathname);
    setActivePage(nextPage);
    if (location.pathname === "/admin/dashboard") {
      navigate("/admin", { replace: true });
    }
  }, [location.pathname, navigate]);

  const clearAdminSessionState = useCallback(
    (message = "") => {
      logoutAdmin();
      setToken("");
      setUser(null);
      setEmail("");
      setPassword("");
      setActivePage("dashboard");
      setStatsError("");
      if (message) {
        setLoginError(message);
      }
      if (location.pathname !== "/admin") {
        navigate("/admin", { replace: true });
      }
    },
    [logoutAdmin, location.pathname, navigate]
  );

  // Verify saved admin token and idle timeout when the page loads
  useEffect(() => {
    const verifyAdmin = async () => {
      const savedToken = localStorage.getItem(ADMIN_TOKEN_KEY);

      if (!savedToken) {
        setCheckingAuth(false);
        return;
      }

      const lastActive = Number(localStorage.getItem(ADMIN_LAST_ACTIVE_KEY) || 0);
      if (lastActive && Date.now() - lastActive > ADMIN_IDLE_TIMEOUT_MS) {
        logoutAdmin();
        setLoginError("Session expired due to inactivity. Please sign in again.");
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

        localStorage.setItem(ADMIN_LAST_ACTIVE_KEY, String(Date.now()));
        setToken(savedToken);
        setUser(data.user);
      } catch (error) {
        logoutAdmin();
        setToken("");
        setUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyAdmin();
  }, [logoutAdmin]);

  // Keep admin session alive on activity and expire after 30 minutes of inactivity
  useEffect(() => {
    if (!token || !user) return;

    const handleActivity = () => {
      const now = Date.now();
      const lastActive = Number(localStorage.getItem(ADMIN_LAST_ACTIVE_KEY) || now);

      if (now - lastActive > ADMIN_IDLE_TIMEOUT_MS) {
        clearAdminSessionState(
          "Session expired due to 30 minutes of inactivity. Please sign in again."
        );
        return;
      }

      localStorage.setItem(ADMIN_LAST_ACTIVE_KEY, String(now));
    };

    localStorage.setItem(ADMIN_LAST_ACTIVE_KEY, String(Date.now()));

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true })
    );

    const intervalId = window.setInterval(handleActivity, 60 * 1000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity)
      );
      window.clearInterval(intervalId);
    };
  }, [token, user, clearAdminSessionState]);

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

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_LAST_ACTIVE_KEY, String(Date.now()));

      const targetPage = pageFromPathname(location.pathname);
      setToken(data.token);
      setUser(data.user);
      setPassword("");
      setActivePage(targetPage);
      navigate(targetPage === "dashboard" ? "/admin" : `/admin/${targetPage}`, {
        replace: true,
      });
    } catch (error) {
      setLoginError(error.message || "Unable to log in. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Admin logout
  const handleLogout = () => {
    clearAdminSessionState("");
    setLoginError("");
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
    const resolved = VALID_PAGES.includes(page) ? page : "dashboard";
    setActivePage(resolved);
    navigate(resolved === "dashboard" ? "/admin" : `/admin/${resolved}`);
  };

  const getPageTitle = () => {
    const titles = {
      dashboard: "Admin Dashboard",
      products: "Product Management",
      orders: "Order Management",
      inventory: "Inventory Management",
      "stock-tracker": "Stock & Product Tracker",
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
            type="button"
            className={activePage === "dashboard" ? "active" : ""}
            onClick={() => showPage("dashboard")}
          >
            📊 Dashboard
          </button>

          <button
            type="button"
            className={activePage === "products" ? "active" : ""}
            onClick={() => showPage("products")}
          >
            📦 Products
          </button>

          <button
            type="button"
            className={activePage === "orders" ? "active" : ""}
            onClick={() => showPage("orders")}
          >
            📋 Orders
          </button>

          <button
            type="button"
            className={activePage === "inventory" ? "active" : ""}
            onClick={() => showPage("inventory")}
          >
            📊 Inventory
          </button>

          <button
            type="button"
            className={activePage === "stock-tracker" ? "active" : ""}
            onClick={() => showPage("stock-tracker")}
          >
            🎯 Stock Tracker
          </button>

          <button
            type="button"
            className={activePage === "customers" ? "active" : ""}
            onClick={() => showPage("customers")}
          >
            👥 Customers
          </button>
        </nav>

        <p className="admin-nav-title">MANAGEMENT</p>

        <nav className="admin-nav">
          <button
            type="button"
            className={activePage === "sales" ? "active" : ""}
            onClick={() => showPage("sales")}
          >
            💰 Sales Reports
          </button>

          <button
            type="button"
            className={activePage === "settings" ? "active" : ""}
            onClick={() => showPage("settings")}
          >
            ⚙️ Settings
          </button>

          <button type="button" onClick={handleLogout}>
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
                  <button type="button" onClick={() => showPage("products")}>
                    + Add Product
                  </button>
                  <button type="button" onClick={() => showPage("products")}>
                    View Products
                  </button>
                  <button type="button" onClick={() => showPage("orders")}>
                    Manage Orders
                  </button>
                  <button type="button" onClick={() => showPage("stock-tracker")}>
                    Stock Tracker
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
          {activePage === "orders" && <OrderManagement />}
          {activePage === "inventory" && <InventoryManagement />}
          {activePage === "stock-tracker" && <StockTracker />}
          {activePage === "customers" && <CustomerManagement />}
          {activePage === "sales" && <SalesReports />}
          {activePage === "settings" && <Settings />}
        </section>
      </main>
    </div>
  );
}

export default Admin;