import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./authcontext.jsx";
import { useCart } from "./cartcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const CATEGORIES = [
  "All",
  "Rice & Dals",
  "Oil & Ghee",
  "Snacks",
  "Beverages",
  "Dairy",
  "Personal Care",
  "Vegetables",
  "Household",
];

function getProductId(item, fallbackIdx = 0) {
  return String(
    item?._id ||
      item?.id ||
      item?.productId ||
      item?.name ||
      item?.title ||
      fallbackIdx
  );
}

function createCustomerQrCode() {
  return `FM-CUST-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now()
    .toString(36)
    .toUpperCase()}`;
}

function buildCustomerQrGrid(text, size = 25) {
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

function CustomerQrMenu() {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const canvasRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 56, right: 16 });
  const [qrVisible, setQrVisible] = useState(false);
  const [qrCode, setQrCode] = useState(() => createCustomerQrCode());

  const qrPayloadUrl = `${window.location.origin}/login?qr=${encodeURIComponent(
    qrCode
  )}`;

  const refreshCode = useCallback(() => {
    setQrCode(createCustomerQrCode());
  }, []);

  const handleToggleMenu = () => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setMenuPos({
          top: Math.round(rect.bottom + 6),
          right: Math.max(12, Math.round(window.innerWidth - rect.right)),
        });
      }
      return next;
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      const inBtn = btnRef.current && btnRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inBtn && !inMenu) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!qrVisible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const modules = 25;
    const quietZone = 2;
    const totalCells = modules + quietZone * 2;
    const pxSize = 200;
    const cellSize = pxSize / totalCells;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pxSize, pxSize);

    const grid = buildCustomerQrGrid(qrPayloadUrl, modules);
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
  }, [qrVisible, qrPayloadUrl]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Customer QR options"
        aria-expanded={menuOpen}
        onClick={handleToggleMenu}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          color: "#0f172a",
          fontSize: "1.2rem",
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ⋮
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top: `${menuPos.top}px`,
            right: `${menuPos.right}px`,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
            padding: "6px",
            zIndex: 9999,
            minWidth: "180px",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setQrVisible(true);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "9px 12px",
              borderRadius: "7px",
              border: "none",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Login through QR
          </button>
        </div>
      )}

      {qrVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "22px",
              maxWidth: "320px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>
              Login through QR
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: "0.84rem", color: "#475569" }}>
              Code: <strong>{qrCode}</strong>
            </p>
            <canvas
              ref={canvasRef}
              width={200}
              height={200}
              aria-label="Customer QR Code"
              style={{ border: "1px solid #e2e8f0", borderRadius: "8px" }}
            />
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "center",
                marginTop: "14px",
              }}
            >
              <button
                type="button"
                onClick={refreshCode}
                style={{
                  padding: "7px 12px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                New QR
              </button>
              <button
                type="button"
                onClick={() => setQrVisible(false)}
                style={{
                  padding: "7px 14px",
                  borderRadius: "7px",
                  border: "none",
                  background: "#166534",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  const navigate = useNavigate();
  const authCtx = typeof useAuth === "function" ? useAuth() : null;
  const cartCtx = typeof useCart === "function" ? useCart() : null;

  const productsSectionRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [localCartItems, setLocalCartItems] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("freshmart-cart") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const customerName =
    authCtx?.user?.name ||
    (() => {
      try {
        const raw = localStorage.getItem("freshmart-customer-user");
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.name || "Customer";
      } catch {
        return "Customer";
      }
    })();

  const syncLocalCartFromStorage = useCallback(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("freshmart-cart") || "[]");
      setLocalCartItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLocalCartItems([]);
    }
  }, []);

  useEffect(() => {
    syncLocalCartFromStorage();
    const onStorage = (e) => {
      if (!e.key || e.key === "freshmart-cart") {
        syncLocalCartFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [syncLocalCartFromStorage]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`${API_BASE}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
          ? data.products
          : [];
        setProducts(list);
        try {
          localStorage.setItem("freshmart-products", JSON.stringify(list));
        } catch {
          // ignore storage errors
        }
      })
      .catch(() => {
        if (!active) return;
        try {
          const cached = JSON.parse(
            localStorage.getItem("freshmart-products") || "[]"
          );
          setProducts(Array.isArray(cached) ? cached : []);
        } catch {
          setProducts([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredByCategory = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter(
      (item) =>
        String(item?.category || "").toLowerCase() ===
        selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  const activeCartList = useMemo(() => {
    if (Array.isArray(cartCtx?.cart)) return cartCtx.cart;
    if (Array.isArray(cartCtx?.items)) return cartCtx.items;
    if (Array.isArray(cartCtx?.cartItems)) return cartCtx.cartItems;
    return localCartItems;
  }, [cartCtx, localCartItems]);

  const cartBadgeCount = useMemo(() => {
    if (typeof cartCtx?.cartCount === "number") return cartCtx.cartCount;
    if (typeof cartCtx?.totalItems === "number") return cartCtx.totalItems;
    return activeCartList.reduce(
      (sum, item) => sum + (Number(item.qty || item.quantity) || 1),
      0
    );
  }, [cartCtx, activeCartList]);

  const getProductQty = useCallback(
    (item, idx = 0) => {
      const targetId = getProductId(item, idx);
      const found = activeCartList.find(
        (c, cIdx) => getProductId(c, cIdx) === targetId
      );
      return found ? Number(found.qty || found.quantity) || 1 : 0;
    },
    [activeCartList]
  );

  const updateLocalItemQty = useCallback(
    (item, idx, delta) => {
      const targetId = getProductId(item, idx);
      const next = [...localCartItems];
      const foundIdx = next.findIndex((c, cIdx) => getProductId(c, cIdx) === targetId);
      if (foundIdx >= 0) {
        const currentQty = Number(next[foundIdx].qty || next[foundIdx].quantity) || 1;
        const updatedQty = currentQty + delta;
        if (updatedQty <= 0) {
          next.splice(foundIdx, 1);
        } else {
          next[foundIdx] = { ...next[foundIdx], qty: updatedQty };
        }
      } else if (delta > 0) {
        next.push({ ...item, _id: item._id || item.id || targetId, qty: delta });
      }
      setLocalCartItems(next);
      try {
        localStorage.setItem("freshmart-cart", JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
    },
    [localCartItems]
  );

  const handleAddToCart = (item, idx = 0) => {
    if (cartCtx && typeof cartCtx.addToCart === "function") {
      cartCtx.addToCart(item);
      return;
    }
    if (cartCtx && typeof cartCtx.incrementQty === "function") {
      cartCtx.incrementQty(getProductId(item, idx));
      return;
    }
    updateLocalItemQty(item, idx, 1);
  };

  const handleDecreaseQty = (item, idx = 0) => {
    const id = getProductId(item, idx);
    const currentQty = getProductQty(item, idx);

    if (cartCtx && typeof cartCtx.decreaseQty === "function") {
      cartCtx.decreaseQty(id);
      return;
    }
    if (cartCtx && typeof cartCtx.decrementQty === "function") {
      cartCtx.decrementQty(id);
      return;
    }
    if (cartCtx && typeof cartCtx.updateQuantity === "function") {
      cartCtx.updateQuantity(id, currentQty - 1);
      return;
    }
    if (cartCtx && typeof cartCtx.updateQty === "function") {
      cartCtx.updateQty(id, currentQty - 1);
      return;
    }
    updateLocalItemQty(item, idx, -1);
  };

  const handleHeaderSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchText.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  };

  const handleLogout = () => {
    if (typeof authCtx?.logout === "function") {
      authCtx.logout();
    } else if (typeof authCtx?.logoutCustomer === "function") {
      authCtx.logoutCustomer();
    } else {
      localStorage.removeItem("freshmart-customer-token");
      localStorage.removeItem("freshmart-customer-user");
    }
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      {/* Top Navbar */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "12px 20px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              to="/"
              style={{
                textDecoration: "none",
                fontWeight: 800,
                fontSize: "1.35rem",
                color: "#166534",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🛒</span>
              <span>Fresh Mart</span>
            </Link>

            <div style={{ fontSize: "0.78rem", lineHeight: 1.25 }}>
              <div style={{ color: "#64748b", fontWeight: 600 }}>
                DELIVERING TO
              </div>
              <div style={{ color: "#0f172a", fontWeight: 700 }}>
                📍 Thalluru, AP
              </div>
            </div>
          </div>

          {/* Search Form -> Navigates to dedicated /search page */}
          <form
            onSubmit={handleHeaderSearchSubmit}
            style={{
              flex: "1 1 280px",
              maxWidth: "460px",
              display: "flex",
              gap: "6px",
            }}
          >
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search for rice, oil, snacks and more..."
              aria-label="Search products"
              style={{
                flex: 1,
                padding: "9px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f1f5f9",
                fontSize: "0.92rem",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "9px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#166534",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </form>

          {/* Right User, Logout, Cart & Three-Dots QR Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              Hi, {customerName}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#15803d",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Logout
            </button>

            <button
              type="button"
              onClick={() => navigate("/cart")}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#166534",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🛒 Cart</span>
              <span
                style={{
                  background: "#ffffff",
                  color: "#166534",
                  borderRadius: "999px",
                  padding: "1px 7px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                {cartBadgeCount}
              </span>
            </button>

            <CustomerQrMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 20px" }}>
        {/* Hero Banner */}
        <section
          style={{
            background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
            color: "#ffffff",
            borderRadius: "18px",
            padding: "40px 36px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#bbf7d0",
              marginBottom: "10px",
            }}
          >
            YOUR NEIGHBOURHOOD GROCERY STORE
          </div>
          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "2.35rem",
              lineHeight: 1.15,
              maxWidth: "520px",
            }}
          >
            Groceries made simple. Life made better.
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              color: "#dcfce7",
              maxWidth: "460px",
              fontSize: "0.98rem",
            }}
          >
            Everything you need for your home, delivered right to your doorstep.
          </p>
          <button
            type="button"
            onClick={() =>
              productsSectionRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            style={{
              padding: "11px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#facc15",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Start Shopping →
          </button>
        </section>

        {/* Shop by Category */}
        <section ref={productsSectionRef} style={{ marginBottom: "28px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.35rem" }}>
            Shop by Category
          </h2>
          <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: "0.9rem" }}>
            Everything you need, all in one place
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "22px",
            }}
          >
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: active ? "1.5px solid #166534" : "1px solid #e2e8f0",
                    background: active ? "#f0fdf4" : "#ffffff",
                    color: active ? "#166534" : "#334155",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {/* Product Grid */}
          {loading ? (
            <p style={{ color: "#475569" }}>Loading fresh groceries...</p>
          ) : filteredByCategory.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "28px",
                textAlign: "center",
                color: "#475569",
              }}
            >
              No products available in this category yet.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(225px, 1fr))",
                gap: "16px",
              }}
            >
              {filteredByCategory.map((item, idx) => {
                const id = getProductId(item, idx);
                const title = item.name || item.title || "Grocery Item";
                const price = Number(item.price || 0);
                const imageSrc = item.image || item.imageUrl || "";
                const qty = getProductQty(item, idx);

                return (
                  <div
                    key={id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div>
                      {imageSrc ? (
                        <Link to={`/product/${id}`}>
                          <img
                            src={imageSrc}
                            alt={title}
                            style={{
                              width: "100%",
                              height: "150px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              marginBottom: "10px",
                            }}
                          />
                        </Link>
                      ) : null}
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "#166534",
                          fontWeight: 600,
                        }}
                      >
                        {item.category || "Grocery"}
                      </div>
                      <Link
                        to={`/product/${id}`}
                        style={{
                          textDecoration: "none",
                          color: "#0f172a",
                          fontWeight: 700,
                          fontSize: "1rem",
                          display: "block",
                          marginTop: "2px",
                        }}
                      >
                        {title}
                      </Link>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "8px",
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>
                        ₹{price}
                      </span>

                      {qty > 0 ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            background: "#f0fdf4",
                            border: "1px solid #166534",
                            borderRadius: "7px",
                            padding: "3px 8px",
                          }}
                        >
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${title}`}
                            onClick={() => handleDecreaseQty(item, idx)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#166534",
                              fontWeight: 700,
                              fontSize: "1rem",
                              cursor: "pointer",
                              padding: "0 4px",
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              color: "#0f172a",
                              minWidth: "16px",
                              textAlign: "center",
                            }}
                          >
                            {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${title}`}
                            onClick={() => handleAddToCart(item, idx)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#166534",
                              fontWeight: 700,
                              fontSize: "1rem",
                              cursor: "pointer",
                              padding: "0 4px",
                            }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item, idx)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: "7px",
                            border: "none",
                            background: "#166534",
                            color: "#ffffff",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Store Footer */}
      <footer
        style={{
          background: "#0f172a",
          color: "#cbd5e1",
          padding: "28px 20px",
          marginTop: "40px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "16px",
            fontSize: "0.9rem",
          }}
        >
          <div>
            <strong style={{ color: "#ffffff", fontSize: "1.05rem" }}>
              🛒 FreshMart Provision Store
            </strong>
            <p style={{ margin: "6px 0 0" }}>
              Thalluru, Andhra Pradesh 524142 •{" "}
              <a
                href="https://www.google.com/maps?q=14.801237,79.941260"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#86efac" }}
              >
                View on Google Maps
              </a>
            </p>
          </div>

          <div>
            <div>Phone: +91 9063998638</div>
            <div>Email: pradeepkumaramirisetty@gmail.com</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;