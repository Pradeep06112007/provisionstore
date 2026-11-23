import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../authcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function createQrSessionCode() {
  return `FM-QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()
    .toString(36)
    .toUpperCase()}`;
}

function buildQrGrid(text, size = 25) {
  const grid = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (top, left) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const isQuiet = r === -1 || r === 7 || c === -1 || c === 7;
        grid[rr][cc] = !isQuiet && (isBorder || isCenter);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  const bytes = new TextEncoder().encode(text);
  let bitIdx = 0;

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const onTiming = r === 6 || c === 6;
      if (inTopLeft || inTopRight || inBottomLeft || onTiming) continue;

      const byte = bytes[bitIdx % bytes.length] || 0;
      const bit = ((byte >> (7 - (bitIdx % 8))) & 1) === 1;
      const checker = (r + c) % 2 === 0;
      grid[r][c] = bit ? checker : !checker;
      bitIdx += 1;
    }
  }

  return grid;
}

function CustomerLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginCustomer } = useAuth();
  const canvasRef = useRef(null);

  const qrSessionFromUrl = searchParams.get("qr") || "";

  const [menuOpen, setMenuOpen] = useState(false);
  const [showQrPanel, setShowQrPanel] = useState(Boolean(qrSessionFromUrl));
  const [qrCode, setQrCode] = useState(
    () => qrSessionFromUrl || createQrSessionCode()
  );
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [qrNotice, setQrNotice] = useState("");
  const [checkingQr, setCheckingQr] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const qrLoginUrl = `${window.location.origin}/login?qr=${encodeURIComponent(
    qrCode
  )}`;

  const refreshQrCode = useCallback(() => {
    setQrCode(createQrSessionCode());
    setSecondsLeft(120);
    setQrNotice("");
  }, []);

  // Close three-dots menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleDocClick = (event) => {
      if (!event.target.closest(".customer-login-menu-wrap")) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Countdown timer when QR panel is visible
  useEffect(() => {
    if (!showQrPanel) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setQrCode(createQrSessionCode());
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showQrPanel]);

  // Draw QR code on canvas when QR panel is visible
  useEffect(() => {
    if (!showQrPanel) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const modules = 25;
    const quietZone = 2;
    const totalCells = modules + quietZone * 2;
    const pxSize = 220;
    const cellSize = pxSize / totalCells;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pxSize, pxSize);

    const grid = buildQrGrid(qrLoginUrl, modules);
    ctx.fillStyle = "#0f172a";

    for (let r = 0; r < modules; r += 1) {
      for (let c = 0; c < modules; c += 1) {
        if (grid[r][c]) {
          ctx.fillRect(
            Math.floor((c + quietZone) * cellSize),
            Math.floor((r + quietZone) * cellSize),
            Math.ceil(cellSize),
            Math.ceil(cellSize)
          );
        }
      }
    }
  }, [showQrPanel, qrLoginUrl]);

  const handleOpenQrLogin = () => {
    setMenuOpen(false);
    setError("");
    setQrNotice("");
    if (!qrCode) {
      setQrCode(createQrSessionCode());
    }
    setSecondsLeft(120);
    setShowQrPanel(true);
  };

  const handleGoToAdmin = () => {
    setMenuOpen(false);
    navigate("/admin");
  };

  const handleCheckQrSession = async () => {
    setCheckingQr(true);
    setQrNotice("");

    try {
      const res = await fetch(
        `${API_BASE}/api/auth/qr-status?code=${encodeURIComponent(qrCode)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.token && data.user) {
          if (typeof loginCustomer === "function") {
            loginCustomer(data.user, data.token);
          } else {
            localStorage.setItem("freshmart-customer-token", data.token);
          }
          navigate("/", { replace: true });
          return;
        }
      }
      setQrNotice(
        "Scan the QR code with your phone camera or sign in with your email and password."
      );
    } catch {
      setQrNotice(
        "Scan the QR code with your phone camera or sign in with your email and password."
      );
    } finally {
      setCheckingQr(false);
    }
  };

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
          ...(qrSessionFromUrl ? { qrSession: qrSessionFromUrl } : {}),
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
          position: "relative",
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        {/* Top-right three dots menu */}
        <div
          className="customer-login-menu-wrap"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
          }}
        >
          <button
            type="button"
            aria-label="More login options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: "1.2rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⋮
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "42px",
                right: 0,
                minWidth: "205px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.14)",
                padding: "6px",
                zIndex: 40,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenQrLogin}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  borderRadius: "7px",
                  border: "none",
                  background: "transparent",
                  color: "#0f172a",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Login through QR
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleGoToAdmin}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  borderRadius: "7px",
                  border: "none",
                  background: "transparent",
                  color: "#166534",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Go to Admin Dashboard
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "2rem", marginBottom: "6px" }}>🛒</div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>
            Fresh<span style={{ color: "#166534" }}>Mart</span>
          </h1>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: "0.92rem" }}>
            {showQrPanel
              ? "Scan QR code to sign in"
              : "Sign in to your customer account"}
          </p>
        </div>

        {showQrPanel ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                padding: "10px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                marginBottom: "10px",
              }}
            >
              <canvas
                ref={canvasRef}
                width={220}
                height={220}
                aria-label="Customer Login QR Code"
              />
            </div>

            <div
              style={{
                fontSize: "0.82rem",
                color: "#475569",
                marginBottom: "12px",
              }}
            >
              Code: <strong>{qrCode}</strong> • Expires in{" "}
              <strong>{secondsLeft}s</strong>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={refreshQrCode}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                New QR
              </button>

              <button
                type="button"
                onClick={handleCheckQrSession}
                disabled={checkingQr}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#166534",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {checkingQr ? "Checking..." : "Verify Scan"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQrPanel(false);
                  setQrNotice("");
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Email Login
              </button>
            </div>

            {qrNotice && (
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  fontSize: "0.84rem",
                }}
              >
                {qrNotice}
              </div>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default CustomerLogin;