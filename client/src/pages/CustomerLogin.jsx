import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../authcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function CustomerLogin() {
  const navigate = useNavigate();
  const { loginCustomer } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Invalid email or password.");
      }

      if (typeof loginCustomer === "function") {
        loginCustomer(data.user, data.token);
      } else if (data.token) {
        localStorage.setItem("freshmart-customer-token", data.token);
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
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
            Sign in to your customer account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Admin button down at the bottom where the QR button used to be */}
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