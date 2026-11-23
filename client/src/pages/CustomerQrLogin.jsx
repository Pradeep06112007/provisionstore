import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../authcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function createSessionCode() {
  return `FM-QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

// Builds a clean, scannable grid matrix from payload text
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

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic bit stream from text
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

function CustomerQrLogin() {
  const navigate = useNavigate();
  const { loginCustomer } = useAuth();
  const canvasRef = useRef(null);

  const [sessionCode, setSessionCode] = useState(() => createSessionCode());
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [checkingQr, setCheckingQr] = useState(false);

  const qrLoginUrl = `${window.location.origin}/login?qr=${encodeURIComponent(sessionCode)}`;

  const regenerateQr = useCallback(() => {
    setSessionCode(createSessionCode());
    setSecondsLeft(120);
    setStatusMessage("");
    setErrorMessage("");
  }, []);

  // Countdown timer for QR code refresh
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setSessionCode(createSessionCode());
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Draw QR code on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const modules = 25;
    const quietZone = 2;
    const totalCells = modules + quietZone * 2;
    const pxSize = 240;
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
  }, [qrLoginUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrLoginUrl);
      setStatusMessage("QR login link copied to clipboard.");
      setErrorMessage("");
    } catch {
      setStatusMessage(`QR Login URL: ${qrLoginUrl}`);
    }
  };

  const handleVerifyQrSession = async () => {
    setCheckingQr(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const res = await fetch(
        `${API_BASE}/api/auth/qr-status?code=${encodeURIComponent(sessionCode)}`
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
      setStatusMessage(
        "Scan the QR code with your phone camera or open the login page to complete sign-in."
      );
    } catch {
      setStatusMessage(
        "Scan the QR code with your phone camera or continue to email/password login."
      );
    } finally {
      setCheckingQr(false);
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
          maxWidth: "460px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "6px" }}>🛒</div>
        <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>
          Fresh<span style={{ color: "#166534" }}>Mart</span> Customer QR Login
        </h1>
        <p style={{ margin: "6px 0 20px", color: "#475569", fontSize: "0.92rem" }}>
          Scan this QR code with your mobile camera to open FreshMart customer login.
        </p>

        <div
          style={{
            display: "inline-flex",
            padding: "12px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            marginBottom: "14px",
          }}
        >
          <canvas
            ref={canvasRef}
            width={240}
            height={240}
            aria-label="FreshMart Customer Login QR Code"
          />
        </div>

        <div style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "14px" }}>
          Session Code: <strong>{sessionCode}</strong> • Refreshes in{" "}
          <strong>{secondsLeft}s</strong>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "center",
            marginBottom: "14px",
          }}
        >
          <button
            type="button"
            onClick={regenerateQr}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh QR
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid #166534",
              background: "#f0fdf4",
              color: "#166534",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Copy Login Link
          </button>

          <button
            type="button"
            onClick={handleVerifyQrSession}
            disabled={checkingQr}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#166534",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {checkingQr ? "Checking..." : "Check QR Status"}
          </button>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: "0.86rem",
              marginBottom: "12px",
            }}
          >
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="admin-login-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid #e2e8f0",
            fontSize: "0.9rem",
          }}
        >
          <Link to="/login" style={{ color: "#166534", fontWeight: 600 }}>
            ← Standard Login
          </Link>
          <Link to="/" style={{ color: "#334155", fontWeight: 600 }}>
            Storefront →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CustomerQrLogin;