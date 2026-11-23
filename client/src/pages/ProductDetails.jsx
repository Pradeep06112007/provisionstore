import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../cartcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const CART_STORAGE_KEY = "freshmart-cart";

function matchProductId(item, fallbackId = "") {
  const raw =
    item?._id ??
    item?.id ??
    item?.productId ??
    fallbackId ??
    item?.name ??
    item?.title ??
    "";
  return String(raw).trim();
}

function readStoredCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredCart(items) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cartCtx = typeof useCart === "function" ? useCart() : null;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storedCart, setStoredCart] = useState(() => readStoredCart());

  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || e.key === CART_STORAGE_KEY) {
        setStoredCart(readStoredCart());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const findMatch = (list) => {
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
        const listRes = await fetch(`${API_BASE}/api/products`);
        const listData = await listRes.json();
        const list = Array.isArray(listData)
          ? listData
          : Array.isArray(listData?.products)
          ? listData.products
          : [];
        return findMatch(list);
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
            const fallback = findMatch(cached);
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
          const fallback = findMatch(cached);
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

  const activeCart = useMemo(() => {
    if (Array.isArray(cartCtx?.cart) && cartCtx.cart.length > 0) {
      return cartCtx.cart;
    }
    if (Array.isArray(cartCtx?.items) && cartCtx.items.length > 0) {
      return cartCtx.items;
    }
    return storedCart;
  }, [cartCtx, storedCart]);

  const productKey = matchProductId(product, id);

  const qtyInCart = useMemo(() => {
    if (!productKey) return 0;
    const found = activeCart.find(
      (entry) => matchProductId(entry) === productKey
    );
    return found ? Math.max(0, Number(found.qty ?? found.quantity ?? 0) || 0) : 0;
  }, [activeCart, productKey]);

  const cartTotalBadge = useMemo(() => {
    if (typeof cartCtx?.cartCount === "number") return cartCtx.cartCount;
    return activeCart.reduce(
      (sum, entry) => sum + (Number(entry?.qty ?? entry?.quantity) || 1),
      0
    );
  }, [cartCtx, activeCart]);

  const setExactQty = useCallback(
    (nextQty) => {
      if (!product || !productKey) return;
      const clamped = Math.max(0, Number(nextQty) || 0);

      // Update localStorage cart immediately so UI & /cart stay in sync
      const currentList = readStoredCart();
      const idx = currentList.findIndex(
        (entry) => matchProductId(entry) === productKey
      );
      let updatedList;

      if (clamped <= 0) {
        updatedList = currentList.filter(
          (entry) => matchProductId(entry) !== productKey
        );
      } else if (idx >= 0) {
        updatedList = [...currentList];
        updatedList[idx] = {
          ...updatedList[idx],
          qty: clamped,
          quantity: clamped,
        };
      } else {
        updatedList = [
          ...currentList,
          {
            ...product,
            _id: product._id ?? productKey,
            id: product.id ?? productKey,
            qty: clamped,
            quantity: clamped,
          },
        ];
      }

      writeStoredCart(updatedList);
      setStoredCart(updatedList);

      // Also notify CartContext if available
      if (clamped === 0) {
        if (typeof cartCtx?.removeFromCart === "function") {
          cartCtx.removeFromCart(productKey);
        } else if (typeof cartCtx?.updateQuantity === "function") {
          cartCtx.updateQuantity(productKey, 0);
        }
      } else if (clamped > qtyInCart) {
        const diff = clamped - qtyInCart;
        if (typeof cartCtx?.addToCart === "function") {
          for (let i = 0; i < diff; i += 1) {
            cartCtx.addToCart({
              ...product,
              _id: product._id ?? productKey,
              id: product.id ?? productKey,
            });
          }
        }
      } else if (clamped < qtyInCart) {
        if (typeof cartCtx?.updateQuantity === "function") {
          cartCtx.updateQuantity(productKey, clamped);
        } else if (typeof cartCtx?.decreaseQty === "function") {
          const diff = qtyInCart - clamped;
          for (let i = 0; i < diff; i += 1) {
            cartCtx.decreaseQty(productKey);
          }
        }
      }
    },
    [product, productKey, qtyInCart, cartCtx]
  );

  const handlePlus = () => {
    setExactQty((qtyInCart || 0) + 1);
  };

  const handleMinus = () => {
    if (qtyInCart <= 1) {
      setExactQty(0);
    } else {
      setExactQty(qtyInCart - 1);
    }
  };

  const title = product?.name || product?.title || "Product";
  const price = Number(product?.price || 0);
  const mrp = Number(product?.mrp || product?.originalPrice || 0);
  const category = product?.category || "GROCERY";
  const unit = product?.unit || product?.packSize || "1 unit";
  const description =
    product?.description || "Freshly stocked grocery item available at FreshMart.";
  const imageSrc = product?.image || product?.imageUrl || "";
  const stockCount =
    product?.stock ?? product?.quantityAvailable ?? product?.qtyAvailable;
  const isOutOfStock = typeof stockCount === "number" && stockCount <= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
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
              {cartTotalBadge}
            </span>
          </button>
        </div>
      </header>

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
            <div>
              <span
                style={{
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
                  display: "inline-block",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: "#166534",
                  background: "#dcfce7",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
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

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                {qtyInCart > 0 ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      border: "1px solid #16a34a",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: "#ffffff",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={handleMinus}
                      style={{
                        border: "none",
                        background: "#f0fdf4",
                        color: "#15803d",
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        padding: "9px 14px",
                        cursor: "pointer",
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "1rem",
                        minWidth: "36px",
                        textAlign: "center",
                        color: "#0f172a",
                        padding: "0 6px",
                      }}
                    >
                      {qtyInCart}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={isOutOfStock}
                      onClick={handlePlus}
                      style={{
                        border: "none",
                        background: "#f0fdf4",
                        color: "#15803d",
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        padding: "9px 14px",
                        cursor: isOutOfStock ? "not-allowed" : "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={handlePlus}
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
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  Go to Cart ({cartTotalBadge})
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