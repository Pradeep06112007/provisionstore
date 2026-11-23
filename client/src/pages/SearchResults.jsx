import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../cartcontext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function SearchResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [queryInput, setQueryInput] = useState(initialQuery);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cartCtx = typeof useCart === "function" ? useCart() : null;

  useEffect(() => {
    setQueryInput(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

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
      })
      .catch(() => {
        if (!active) return;
        try {
          const cached = JSON.parse(localStorage.getItem("freshmart-products") || "[]");
          setProducts(Array.isArray(cached) ? cached : []);
        } catch {
          setProducts([]);
        }
        setError("Could not reach server. Showing available cached items.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeQuery = (searchParams.get("q") || "").trim().toLowerCase();

  const matches = useMemo(() => {
    if (!activeQuery) return products;
    return products.filter((item) => {
      const name = String(item?.name || item?.title || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      const desc = String(item?.description || "").toLowerCase();
      return (
        name.includes(activeQuery) ||
        category.includes(activeQuery) ||
        desc.includes(activeQuery)
      );
    });
  }, [products, activeQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = queryInput.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  const handleAddToCart = (item) => {
    if (cartCtx && typeof cartCtx.addToCart === "function") {
      cartCtx.addToCart(item);
      return;
    }
    try {
      const current = JSON.parse(localStorage.getItem("freshmart-cart") || "[]");
      const id = item._id || item.id || item.name;
      const idx = current.findIndex((x) => (x._id || x.id || x.name) === id);
      if (idx >= 0) {
        current[idx].qty = (current[idx].qty || 1) + 1;
      } else {
        current.push({ ...item, qty: 1 });
      }
      localStorage.setItem("freshmart-cart", JSON.stringify(current));
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link
              to="/"
              style={{
                textDecoration: "none",
                color: "#166534",
                fontWeight: 700,
                fontSize: "1.15rem",
              }}
            >
              🛒 FreshMart
            </Link>
            <button
              type="button"
              onClick={() => navigate("/")}
              style={{
                padding: "7px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#0f172a",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Back to Store
            </button>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            style={{ display: "flex", gap: "8px", flex: "1 1 320px", maxWidth: "520px" }}
          >
            <input
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search for rice, oil, snacks and more..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.95rem",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "10px 16px",
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
        </div>

        <div style={{ marginBottom: "16px" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", color: "#0f172a" }}>
            {activeQuery
              ? `Search results for "${searchParams.get("q")}"`
              : "All Products"}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#475569", fontSize: "0.92rem" }}>
            {loading
              ? "Searching products..."
              : `${matches.length} ${matches.length === 1 ? "product" : "products"} found`}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              marginBottom: "16px",
              fontSize: "0.88rem",
            }}
          >
            {error}
          </div>
        )}

        {!loading && matches.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "36px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 12px", color: "#334155", fontWeight: 600 }}>
              No matching products found.
            </p>
            <button
              type="button"
              onClick={() => {
                setQueryInput("");
                setSearchParams({});
              }}
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
              View All Products
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "16px",
            }}
          >
            {matches.map((item, index) => {
              const id = item._id || item.id || index;
              const title = item.name || item.title || "Product";
              const price = Number(item.price || 0);
              const imageSrc = item.image || item.imageUrl || "";

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
                    <div style={{ fontSize: "0.78rem", color: "#166534", fontWeight: 600 }}>
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
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item)}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchResults;