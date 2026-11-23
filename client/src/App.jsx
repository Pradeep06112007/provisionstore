import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./authcontext.jsx";
import { useCart } from "./cartcontext.jsx";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const api_url = `${API_BASE}/api/products`;

const categories = [
  { name: "All", emoji: "🛍️" },
  { name: "Rice & Dals", emoji: "🌾" },
  { name: "Oil & Ghee", emoji: "🫒" },
  { name: "Snacks", emoji: "🍪" },
  { name: "Beverages", emoji: "🥤" },
  { name: "Dairy", emoji: "🥛" },
  { name: "Personal Care", emoji: "🧴" },
  { name: "Vegetables", emoji: "🥦" },
  { name: "Household", emoji: "🧹" },
];

function App() {
  const navigate = useNavigate();
  const { user: customerUser, logoutCustomer } = useAuth();

  const {
    cart,
    addToCart,
    updateQuantity,
    cartCount,
  } = useCart();

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // GET products from MongoDB
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(api_url);

        if (!response.ok) {
          throw new Error("Failed to retrieve products");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Unable to load products");
        }

        const formattedProducts = data.products.map((item) => ({
          id: item._id,
          name: item.name,
          size: item.unit,
          price: item.price,
          originalPrice: item.originalPrice,
          category: item.category,
          image: item.image,
          stock: item.stock,
          isAvailable: item.isAvailable,
          isFeatured: item.isFeatured,
          badge: item.isFeatured ? "Featured" : "",
        }));

        setProducts(formattedProducts);
      } catch (error) {
        console.error("Product loading error:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Search and category filtering
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Find product quantity in cart
  const getCartItem = (productId) => {
    return cart.find((item) => item.id === productId);
  };

  // Select category
  const selectCategory = (name) => {
    setSelectedCategory(name);
    setSearchTerm("");

    document.getElementById("products")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleCustomerLogout = () => {
    logoutCustomer();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">

      {/* HEADER */}

      <header className="navbar">

        <div
          className="logo"
          onClick={() => {
            setSelectedCategory("All");
            setSearchTerm("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="logo-icon">🛒</span>
          Fresh<span className="logo-dark">Mart</span>
        </div>

        <div className="delivery-info">
          <span>📍</span>
          <div>
            <small>DELIVERING TO</small>
            <strong>Thalluru, AP</strong>
          </div>
        </div>

        <div className="search">
          <span>⌕</span>

          <input
            type="search"
            placeholder="Search for rice, oil, snacks and more..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedCategory("All");
            }}
          />

          {searchTerm && (
            <button
              className="clear-search"
              onClick={() => setSearchTerm("")}
            >
              ×
            </button>
          )}
        </div>

        {customerUser ? (
          <div className="customer-nav-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              Hi, {customerUser.name?.split(" ")[0] || "Customer"}
            </span>
            <button
              type="button"
              className="cart-button"
              onClick={handleCustomerLogout}
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="cart-button"
            onClick={() => navigate("/login")}
          >
            <span>👤</span>
            <span>Sign In</span>
          </button>
        )}

        <button
          className="cart-button"
          onClick={() => navigate("/cart")}
        >
          <span>🛒</span>
          <span>Cart</span>
          <span className="cart-count">{cartCount}</span>
        </button>

      </header>

      {/* HERO */}

      <section className="hero">
        <div className="hero-content">

          <span className="hero-label">
            YOUR NEIGHBOURHOOD GROCERY STORE
          </span>

          <h1>
            Groceries made
            <br />
            simple. Life made
            <br />
            <span>better.</span>
          </h1>

          <p>
            Everything you need for your home,
            delivered right to your doorstep.
          </p>

          <button
            className="shop-button"
            onClick={() =>
              document.getElementById("products")?.scrollIntoView({
                behavior: "smooth",
              })
            }
          >
            Start Shopping →
          </button>

        </div>

        <div className="hero-art">
          <div className="hero-circle">🛍️</div>
          <span className="hero-decoration">🥬</span>
          <span className="hero-decoration second">🍎</span>
        </div>
      </section>

      {/* CATEGORY NAVIGATION */}

      <section className="category-section">
        <div className="section-heading">
          <div>
            <h2>Shop by Category</h2>
            <p>Everything you need, all in one place.</p>
          </div>
        </div>

        <div className="category-list">
          {categories.map((category) => (
            <button
              key={category.name}
              className={`category-chip ${
                selectedCategory === category.name ? "selected" : ""
              }`}
              onClick={() => selectCategory(category.name)}
            >
              <span>{category.emoji}</span>
              {category.name}
            </button>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}

      <main className="products-section" id="products">

        <div className="products-heading">
          <div>
            <h2>
              {searchTerm
                ? "Search Results"
                : selectedCategory === "All"
                  ? "Popular Products"
                  : selectedCategory}
            </h2>

            <p>
              {loading
                ? "Loading products..."
                : `${filteredProducts.length} products available`}
            </p>
          </div>

          {(searchTerm || selectedCategory !== "All") && (
            <button
              className="view-all"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("All");
              }}
            >
              View all products
            </button>
          )}
        </div>

        {loading ? (
          <div className="no-products">
            <h3>Loading products...</h3>
            <p>Please wait while we retrieve products from FreshMart.</p>
          </div>
        ) : error ? (
          <div className="no-products">
            <span>⚠️</span>
            <h3>Unable to load products</h3>
            <p>{error}</p>
            <p>Please check your connection or verify that the backend server is running.</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="product-grid">

            {filteredProducts.map((product) => {
              const cartItem = getCartItem(product.id);
              const openDetails = () => navigate(`/product/${product.id}`);

              return (
                <article className="product-card" key={product.id}>

                  <div
                    className="product-image"
                    onClick={openDetails}
                    style={{ cursor: "pointer" }}
                  >

                    {product.badge && (
                      <span className="product-badge">
                        {product.badge}
                      </span>
                    )}

                    <img
                      src={product.image || ""}
                      alt={product.name}
                      loading="lazy"
                    />

                  </div>

                  <div className="product-details">

                    <div
                      onClick={openDetails}
                      style={{ cursor: "pointer" }}
                    >
                      <span className="product-category">
                        {product.category}
                      </span>

                      <h3>{product.name}</h3>

                      <p className="product-size">
                        {product.size}
                      </p>
                    </div>

                    <div className="product-bottom">

                      <div
                        className="product-price"
                        onClick={openDetails}
                        style={{ cursor: "pointer" }}
                      >
                        <strong>₹{product.price}</strong>
                      </div>

                      {!product.isAvailable || product.stock <= 0 ? (
                        <button className="add-button" disabled>
                          OUT OF STOCK
                        </button>
                      ) : cartItem ? (
                        <div className="quantity-controls">

                          <button
                            onClick={() =>
                              updateQuantity(product.id, -1)
                            }
                          >
                            −
                          </button>

                          <span>{cartItem.quantity}</span>

                          <button
                            onClick={() =>
                              updateQuantity(product.id, 1)
                            }
                            disabled={cartItem.quantity >= product.stock}
                          >
                            +
                          </button>

                        </div>
                      ) : (
                        <button
                          className="add-button"
                          onClick={() => addToCart(product)}
                        >
                          ADD +
                        </button>
                      )}

                    </div>
                  </div>

                </article>
              );
            })}

          </div>
        ) : (
          <div className="no-products">
            <span>🔍</span>
            <h3>No products found</h3>
            <p>Try searching for another product.</p>

            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("All");
              }}
            >
              Show All Products
            </button>
          </div>
        )}

      </main>

      {/* FOOTER */}

      <footer className="footer">
        <h2>🛒 FreshMart</h2>
        <p>Your neighbourhood store, now online.</p>

        <div className="footer-contact">
          <p>
            📍 Store / Service Area:{" "}
            <a
              href="https://www.google.com/maps?q=14.801237,79.941260"
              target="_blank"
              rel="noopener noreferrer"
            >
              Thalluru, Andhra Pradesh 524142 (14.801237, 79.941260)
            </a>
          </p>
          <p>
            📞 Phone: <a href="tel:+919063998638">+91 9063998638</a>
          </p>
          <p>
            ✉️ Email:{" "}
            <a href="mailto:pradeepkumaramirisetty@gmail.com">
              pradeepkumaramirisetty@gmail.com
            </a>
          </p>
        </div>

        <p>© 2026 FreshMart. All rights reserved.</p>
      </footer>

    </div>
  );
}

export default App;
import { useCallback, useEffect, useRef, useState } from "react";

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

export function CustomerQrMenu() {
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