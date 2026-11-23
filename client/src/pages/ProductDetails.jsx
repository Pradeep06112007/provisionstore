import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../cartcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const CART_STORAGE_KEY = "freshmart-cart";

function getProductKey(item, fallbackId = "") {
  return String(
    item?._id ??
      item?.id ??
      item?.productId ??
      fallbackId ??
      item?.name ??
      item?.title ??
      ""
  ).trim();
}

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cartCtx = typeof useCart === "function" ? useCart() : null;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localCart, setLocalCart] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const syncLocalCart = useCallback((nextItems) => {
    setLocalCart(nextItems);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems));
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const findFromList = (list) => {
      if (!Array.isArray(list)) return null;
      return (
        list.find(
          (p) =>
            String(p?._id || "") === String(id) ||
            String(p?.id || "") === String(id)
        ) || null
      );
    };

    fetch(`${API_BASE}/api/products/${encodeURIComponent(id || "")}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const item = data?.product || data;
          if (item && (item.name || item.title || item._id || item.id)) {
            return item;
          }
        }
        const allRes = await fetch(`${API_BASE}/api/products`);
        const allData = await allRes.json();
        const list = Array.isArray(allData)
          ? allData
          : Array.isArray(allData?.products)
          ? allData.products
          : [];
        return findFromList(list);
      })
      .then((found) => {
        if (!active) return;
        if (found) {
          setProduct(found);
        } else {
          try {
            const cached = JSON.parse(
              localStorage.getItem("freshmart-products") || "[]"
            );
            const fallback = findFromList(cached);
            if (fallback) {
              setProduct(fallback);
            } else {
              setError("Product not found.");
            }
          } catch {
            setError("Product not found.");
          }
        }
      })
      .catch(() => {
        if (!active) return;
        try {
          const cached = JSON.parse(
            localStorage.getItem("freshmart-products") || "[]"
          );
          const fallback = findFromList(cached);
          if (fallback) {
            setProduct(fallback);
          } else {
            setError("Unable to load product details right now.");
          }
        } catch {
          setError("Unable to load product details right now.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const activeCartList = useMemo(() => {
    if (Array.isArray(cartCtx?.cart)) return cartCtx.cart;
    if (Array.isArray(cartCtx?.items)) return cartCtx.items;
    if (Array.isArray(cartCtx?.cartItems)) return cartCtx.cartItems;
    return Array.isArray(localCart) ? localCart : [];
  }, [cartCtx, localCart]);

  const cartBadgeCount = useMemo(() => {
    if (typeof cartCtx?.cartCount === "number") return cartCtx.cartCount;
    if (typeof cartCtx?.totalItems === "number") return cartCtx.totalItems;
    return activeCartList.reduce(
      (sum, item) => sum + (Number(item?.qty ?? item?.quantity) || 1),
      0
    );
  }, [cartCtx, activeCartList]);

  const targetKey = getProductKey(product, id);

  const currentQty = useMemo(() => {
    if (!targetKey) return 0;
    const match = activeCartList.find(
      (item, idx) => getProductKey(item, idx) === targetKey
    );
    return match ? Number(match.qty ?? match.quantity) || 1 : 0;
  }, [activeCartList, targetKey]);

  const handleAddOne = () => {
    if (!product || !targetKey) return;
    const normalizedProduct = {
      ...product,
      _id: product._id ?? targetKey,
      id: product.id ?? targetKey,
    };

    if (cartCtx && typeof cartCtx.addToCart === "function") {
      cartCtx.addToCart(normalizedProduct);
      return;
    }

    const next = [...localCart];
    const idx = next.findIndex(
      (item, i) => getProductKey(item, i) === targetKey
    );
    if (idx >= 0) {
      const nextQty = (Number(next[idx].qty ?? next[idx].quantity) || 1) + 1;
      next[idx] = { ...next[idx], qty: nextQty, quantity: nextQty };
    } else {
      next.push({ ...normalizedProduct, qty: 1, quantity: 1 });
    }
    syncLocalCart(next);
  };

  const handleDecrement = () => {
    if (!targetKey || currentQty <= 0) return;

    if (currentQty <= 1) {
      if (cartCtx && typeof cartCtx.removeFromCart === "function") {
        cartCtx.removeFromCart(targetKey);
      } else if (cartCtx && typeof cartCtx.updateQuantity === "function") {
        cartCtx.updateQuantity(targetKey, 0);
      } else if (cartCtx && typeof cartCtx.decreaseQty === "function") {
        cartCtx.decreaseQty(targetKey);
      } else {
        const next = localCart.filter(
          (item, i) => getProductKey(item, i) !== targetKey
        );
        syncLocalCart(next);
      }
      return;
    }

    const nextQty = currentQty - 1;
    if (cartCtx && typeof cartCtx.updateQuantity === "function") {
      cartCtx.updateQuantity(targetKey, nextQty);
      return;
    }
    if (cartCtx && typeof cartCtx.decreaseQty === "function") {
      cartCtx.decreaseQty(targetKey);
      return;
    }

    const next = localCart.map((item, i) =>
      getProductKey(item, i) === targetKey
        ? { ...item, qty: nextQty, quantity: nextQty }
        : item
    );
    syncLocalCart(next);
  };

  const title = product?.name || product?.title || "Product";
  const price = Number(product?.price || 0);
  const mrp = Number(product?.mrp || product?.originalPrice || 0);
  const category = product?.category || "GROCERY";
  const unit = product?.unit || product?.packSize || "1 kg";
  const description =
    product?.description || "Freshly stocked grocery item available at FreshMart.";
  const imageSrc = product?.image || product?.imageUrl || "";
  const stockCount =
    product?.stock ?? product?.quantityAvailable ?? product?.qtyAvailable;
  const isOutOfStock = typeof stockCount === "number" && stockCount <= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      {/* Top Bar */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back to Store
          </button>

          <Link
            to="/"
            style={{
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "1.25rem",
              color: "#166534",
            }}
          >
            🛒 FreshMart
          </Link>

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
              gap: "8px",
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
        </div>
      </header>

      {/* Main Details Card */}
      <main style={{ maxWidth: "960px", margin: "28px auto", padding: "0 20px" }}>
        {loading ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "36px",
              textAlign: "center",
              color: "#475569",
            }}
          >
            Loading product details...
          </div>
        ) : error || !product ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "36px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 14px", color: "#b91c1c", fontWeight: 600 }}>
              {error || "Product not found."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
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
              Return to Store
            </button>
          </div>
        ) : (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "18px",
              padding: "28px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "28px",
              alignItems: "center",
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "inline-block",
                  display: "inline-block",
                  background: "#dcfce7",
                  color: "#166534",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  marginBottom: "10px",
                }}
              >
                Featured
              </span>
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={title}
                  style={{
                    width: "100%",
                    maxHeight: "300px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                />
              ) : null}
            </div>

            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "#166534",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                {category}
              </div>

              <h1 style={{ margin: "0 0 6px", fontSize: "1.85rem", color: "#0f172a" }}>
                {title}
              </h1>

              <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "14px" }}>
                Pack / Unit: {unit}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  marginBottom: "18px",
                }}
              >
                <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "#0f172a" }}>
                  ₹{price}
                </span>
                {mrp > price && (
                  <span
                    style={{
                      fontSize: "1rem",
                      color: "#94a3b8",
                      textDecoration: "line-through",
                    }}
                  >
                    ₹{mrp}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Availability
                  </div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                    {isOutOfStock ? "Out of Stock" : "In Stock"}
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Stock Available
                  </div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                    {typeof stockCount === "number"
                      ? `${stockCount} (${unit})`
                      : `Available (${unit})`}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", marginBottom: "4px" }}>
                  Product Details
                </div>
                <p style={{ margin: 0, color: "#475569", fontSize: "0.94rem" }}>
                  {description}
                </p>
              </div>

              {/* Quantity Box & Add / Go to Cart Controls */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                {currentQty > 0 ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "12px",
                      border: "1.5px solid #166534",
                      background: "#f0fdf4",
                      borderRadius: "10px",
                      padding: "8px 14px",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={handleDecrement}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#166534",
                        fontWeight: 800,
                        fontSize: "1.15rem",
                        cursor: "pointer",
                        padding: "0 4px",
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "1rem",
                        minWidth: "20px",
                        textAlign: "center",
                        color: "#0f172a",
                      }}
                    >
                      {currentQty}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={isOutOfStock}
                      onClick={handleAddOne}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#166534",
                        fontWeight: 800,
                        fontSize: "1.15rem",
                        cursor: isOutOfStock ? "not-allowed" : "pointer",
                        padding: "0 4px",
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={handleAddOne}
                    style={{
                      padding: "11px 20px",
                      borderRadius: "10px",
                      border: "none",
                      background: isOutOfStock ? "#94a3b8" : "#166534",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      cursor: isOutOfStock ? "not-allowed" : "pointer",
                    }}
                  >
                    {isOutOfStock ? "OUT OF STOCK" : `ADD TO CART — ₹${price}`}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigate("/cart")}
                  style={{
                    padding: "11px 18px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  Go to Cart ({cartBadgeCount})
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProductDetails;