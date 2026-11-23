import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../authcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const LOCAL_CUSTOMERS_KEY = "freshmart-registered-customers";

function readLocalCustomers() {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCustomer(account) {
  const current = readLocalCustomers();
  const normalizedEmail = account.email.trim().toLowerCase();
  const filtered = current.filter(
    (item) => item.email.toLowerCase() !== normalizedEmail
  );
  filtered.push({
    name: account.name.trim(),
    email: normalizedEmail,
    password: account.password,
  });
  localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(filtered));
}

function CustomerLogin() {
  const navigate = useNavigate();
  const { loginCustomer } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const completeCustomerSession = (userObj, token) => {
    const safeUser = userObj || {
      name: name.trim() || email.trim().split("@")[0],
      email: email.trim().toLowerCase(),
      role: "customer",
    };
    const safeToken = token || `customer-session-${Date.now()}`;

    if (typeof loginCustomer === "function") {
      loginCustomer(safeUser, safeToken);
    } else {
      localStorage.setItem("freshmart-customer-token", safeToken);
      localStorage.setItem("freshmart-customer-user", JSON.stringify(safeUser));
    }

    navigate("/", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (isRegisterMode && !trimmedName) {
      setError("Please enter your full name to create an account.");
      return;
    }

    setLoading(true);

    try {
      if (isRegisterMode) {
        try {
          const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: trimmedName,
              email: trimmedEmail,
              password,
              role: "customer",
            }),
          });

          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || "Could not create account.");
            }
            saveLocalCustomer({
              name: trimmedName,
              email: trimmedEmail,
              password,
            });
            completeCustomerSession(
              data.user || { name: trimmedName, email: trimmedEmail, role: "customer" },
              data.token
            );
            return;
          }
        } catch (apiErr) {
          // If backend route is not available or network failed, check explicit server error vs fallback
          if (
            apiErr.message &&
            !apiErr.message.toLowerCase().includes("fetch") &&
            !apiErr.message.toLowerCase().includes("network") &&
            !apiErr.message.toLowerCase().includes("404") &&
            !apiErr.message.toLowerCase().includes("not found")
          ) {
            throw apiErr;
          }
        }

        const existing = readLocalCustomers().find(
          (u) => u.email.toLowerCase() === trimmedEmail
        );
        if (existing) {
          throw new Error("An account with this email already exists. Please sign in.");
        }

        saveLocalCustomer({
          name: trimmedName,
          email: trimmedEmail,
          password,
        });
        setNotice("Account created! Signing you in...");
        completeCustomerSession(
          { name: trimmedName, email: trimmedEmail, role: "customer" },
          `local-cust-${btoa(trimmedEmail)}`
        );
        return;
      }

      // Sign In mode
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
          }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (res.ok && data.success) {
            completeCustomerSession(data.user, data.token);
            return;
          }
          if (res.status !== 404) {
            throw new Error(data.message || "Invalid email or password.");
          }
        }
      } catch (apiErr) {
        if (
          apiErr.message &&
          !apiErr.message.toLowerCase().includes("fetch") &&
          !apiErr.message.toLowerCase().includes("network")
        ) {
          throw apiErr;
        }
      }

      const matchedLocal = readLocalCustomers().find(
        (u) =>
          u.email.toLowerCase() === trimmedEmail && u.password === password
      );

      if (!matchedLocal) {
        throw new Error(
          "No account found with those credentials. Click 'Create new account' first."
        );
      }

      completeCustomerSession(
        {
          name: matchedLocal.name,
          email: matchedLocal.email,
          role: "customer",
        },
        `local-cust-${btoa(matchedLocal.email)}`
      );
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsRegisterMode((prev) => !prev);
    setError("");
    setNotice("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "2rem", marginBottom: "6px" }}>🛒</div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>
            Fresh<span style={{ color: "#166534" }}>Mart</span>
          </h1>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: "0.92rem" }}>
            {isRegisterMode
              ? "Create a new customer account"
              : "Sign in to your customer account"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          {isRegisterMode && (
            <div>
              <label
                htmlFor="customer-name"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "5px",
                  fontSize: "0.9rem",
                }}
              >
                Full name
              </label>
              <input
                id="customer-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required={isRegisterMode}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="customer-email"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "5px",
                fontSize: "0.9rem",
              }}
            >
              Email address
            </label>
            <input
              id="customer-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="customer-password"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "5px",
                fontSize: "0.9rem",
              }}
            >
              Password
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                id="customer-password"
                type={showPassword ? "text" : "password"}
                placeholder={
                  isRegisterMode ? "Create a password" : "Enter your password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                required
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {notice && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: "0.85rem",
              }}
            >
              {notice}
            </div>
          )}

          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "4px",
              padding: "11px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#166534",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            {loading
              ? isRegisterMode
                ? "Creating account..."
                : "Signing in..."
              : isRegisterMode
              ? "Create Account"
              : "Sign In"}
          </button>

          <button
            type="button"
            onClick={toggleAuthMode}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: "pointer",
            }}
          >
            {isRegisterMode
              ? "Already have an account? Sign In"
              : "Create new account"}
          </button>
        </form>

        <div
          style={{
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/admin")}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #166534",
              background: "#f0fdf4",
              color: "#166534",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Go to Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerLogin;