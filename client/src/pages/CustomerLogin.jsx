import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../authcontext.jsx";
import "./CustomerLogin.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const AUTH_URL = `${API_BASE}/api/auth`;

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { loginCustomer } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccessMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Please enter your full name.");
        return;
      }
      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }
    }

    try {
      setLoading(true);

      const endpoint =
        mode === "login" ? `${AUTH_URL}/login` : `${AUTH_URL}/register`;
      const payload =
        mode === "login"
          ? { email: cleanEmail, password }
          : {
              name: name.trim(),
              email: cleanEmail,
              password,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            (mode === "login"
              ? "Invalid email or password."
              : "Could not create your account.")
        );
      }

      loginCustomer(data.token, data.user);

      setSuccessMsg(
        mode === "login"
          ? "Welcome back! Opening FreshMart..."
          : "Account created successfully! Opening FreshMart..."
      );

      setTimeout(() => {
        navigate("/", { replace: true });
      }, 400);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cust-auth-page">
      <section className="cust-auth-brand">
        <div className="cust-brand-top">
          <div className="cust-brand-logo">
            <span>🛒</span>
            <div>
              Fresh<span className="accent">Mart</span>
            </div>
          </div>
        </div>

        <div className="cust-brand-hero">
          <span className="cust-brand-pill">CUSTOMER LOGIN</span>
          <h1>Daily essentials, delivered fresh to your door.</h1>
          <p>
            Sign in to shop faster, keep track of your groceries, and enjoy a
            smooth Cash on Delivery checkout experience.
          </p>

          <ul className="cust-perks">
            <li>✓ Fresh rice, dals, oil, dairy &amp; produce</li>
            <li>✓ Simple cart &amp; Cash on Delivery checkout</li>
            <li>✓ Instant access to everyday household staples</li>
          </ul>
        </div>

        <div className="cust-brand-footer">
          © {new Date().getFullYear()} FreshMart Grocery Store
        </div>
      </section>

      <section className="cust-auth-form-panel">
        <div className="cust-auth-card">
          <div className="cust-mode-tabs" role="tablist" aria-label="Account mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`cust-mode-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={`cust-mode-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Create Account
            </button>
          </div>

          <div className="cust-auth-header">
            <h2>
              {mode === "login" ? "CUSTOMER LOGIN" : "CREATE CUSTOMER ACCOUNT"}
            </h2>
            <p>
              {mode === "login"
                ? "Enter your credentials to access your FreshMart account."
                : "Sign up in seconds to start shopping with FreshMart."}
            </p>
          </div>

          <form className="cust-auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="cust-field">
                <label htmlFor="cust-name">Full Name</label>
                <input
                  id="cust-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="cust-field">
              <label htmlFor="cust-email">Email Address</label>
              <input
                id="cust-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="cust-field">
              <label htmlFor="cust-password">Password</label>
              <div className="cust-password-box">
                <input
                  id="cust-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "login"
                      ? "Enter your password"
                      : "At least 8 characters"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
                <button
                  type="button"
                  className="cust-toggle-pass"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="cust-auth-error" role="alert">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="cust-auth-success" role="status">
                {successMsg}
              </div>
            )}

            <button type="submit" className="cust-submit-btn" disabled={loading}>
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <div className="cust-auth-divider">
            <span>Store staff or manager?</span>
            <button
              type="button"
              className="cust-admin-link"
              onClick={() => navigate("/admin")}
            >
              Admin Portal →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}