import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SETTINGS_KEY = "freshmart-store-settings";

function StockTracker() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | healthy | low | out
  const [selectedProductId, setSelectedProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const lowStockThreshold = useMemo(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return Number(parsed?.lowStockThreshold ?? 10);
    } catch {
      return 10;
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("freshmart-admin-token") || "";
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const loadStockAndTracking = async () => {
      setLoading(true);
      setError("");

      try {
        const [prodRes, ordRes] = await Promise.all([
          fetch(`${API_BASE}/api/products`),
          fetch(`${API_BASE}/api/orders`, { headers }).catch(() => null),
        ]);

        if (!prodRes.ok) {
          throw new Error("Failed to fetch products for stock tracking.");
        }

        const prodData = await prodRes.json();
        const list = Array.isArray(prodData)
          ? prodData
          : prodData.products || [];

        const normalized = list.map((item) => ({
          id: item._id || item.id,
          name: item.name || "Unnamed Product",
          category: item.category || "General",
          unit: item.unit || item.size || "",
          price: Number(item.price || 0),
          stock: Number(item.stock ?? 0),
          isAvailable: item.isAvailable !== false,
          isFeatured: Boolean(item.isFeatured),
        }));

        setProducts(normalized);
        if (normalized.length > 0) {
          setSelectedProductId(String(normalized[0].id));
        }

        if (ordRes && ordRes.ok) {
          const ordData = await ordRes.json();
          const ordList = Array.isArray(ordData)
            ? ordData
            : ordData.orders || [];
          setOrders(ordList);
        }
      } catch (err) {
        setError(err.message || "Unable to load stock tracker.");
      } finally {
        setLoading(false);
      }
    };

    loadStockAndTracking();
  }, []);

  // Calculate sold quantity per product from orders if items array is present
  const unitsSoldByProduct = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      const items = order.items || order.products || order.orderItems || [];
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        const pid = String(item.productId || item.product?._id || item.product || item.id || "");
        const pname = String(item.name || item.product?.name || "").toLowerCase();
        const qty = Number(item.quantity || item.qty || 1);
        if (pid) {
          map.set(pid, (map.get(pid) || 0) + qty);
        }
        if (pname) {
          map.set(`name:${pname}`, (map.get(`name:${pname}`) || 0) + qty);
        }
      });
    });
    return map;
  }, [orders]);

  const getProductStatus = (product) => {
    if (!product.isAvailable || product.stock <= 0) return "out";
    if (product.stock <= lowStockThreshold) return "low";
    return "healthy";
  };

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalStockValue = 0;
    let healthyCount = 0;
    let lowCount = 0;
    let outCount = 0;

    products.forEach((p) => {
      totalUnits += p.stock;
      totalStockValue += p.stock * p.price;
      const st = getProductStatus(p);
      if (st === "healthy") healthyCount += 1;
      else if (st === "low") lowCount += 1;
      else outCount += 1;
    });

    return {
      totalSkus: products.length,
      totalUnits,
      totalStockValue,
      healthyCount,
      lowCount,
      outCount,
    };
  }, [products, lowStockThreshold]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const st = getProductStatus(p);
      const matchesStatus = statusFilter === "all" || st === statusFilter;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [products, search, statusFilter, lowStockThreshold]);

  const trackedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(selectedProductId)) || null,
    [products, selectedProductId]
  );

  const trackedProductOrders = useMemo(() => {
    if (!trackedProduct) return [];
    const targetName = trackedProduct.name.toLowerCase();
    return orders.filter((order) => {
      const items = order.items || order.products || order.orderItems || [];
      if (!Array.isArray(items)) return false;
      return items.some((item) => {
        const pid = String(item.productId || item.product?._id || item.product || item.id || "");
        const pname = String(item.name || item.product?.name || "").toLowerCase();
        return pid === String(trackedProduct.id) || pname === targetName;
      });
    });
  }, [orders, trackedProduct]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Stock Summary Cards */}
      <div className="admin-panel" style={{ marginBottom: 0 }}>
        <div style={{ marginBottom: "14px" }}>
          <h2 style={{ margin: 0 }}>Stock & Product Tracker</h2>
          <p style={{ margin: "4px 0 0", opacity: 0.75 }}>
            Track all available stock units, inventory value (₹), low-stock alerts (≤ {lowStockThreshold} units), and product order history.
          </p>
        </div>

        {error && (
          <div className="admin-login-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading stock & product tracking data...</p>
        ) : (
          <div className="admin-stats">
            <div className="admin-stat-card">
              <p>Total Products (SKUs)</p>
              <h2>{summary.totalSkus}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Available Stock Units</p>
              <h2>{summary.totalUnits.toLocaleString("en-IN")}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Stock Valuation</p>
              <h2>₹{summary.totalStockValue.toLocaleString("en-IN")}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Low / Out of Stock</p>
              <h2>
                {summary.lowCount} / {summary.outCount}
              </h2>
            </div>
          </div>
        )}
      </div>

      {/* All Available Stock Table */}
      <div className="admin-panel" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[
              { id: "all", label: `All (${products.length})` },
              { id: "healthy", label: `In Stock (${summary.healthyCount})` },
              { id: "low", label: `Low Stock (${summary.lowCount})` },
              { id: "out", label: `Out of Stock (${summary.outCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: "1px solid #166534",
                  background: statusFilter === tab.id ? "#166534" : "#ffffff",
                  color: statusFilter === tab.id ? "#ffffff" : "#166534",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            placeholder="Search product or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              minWidth: "230px",
            }}
          />
        </div>

        {filteredProducts.length === 0 ? (
          <p>No products match the current filter.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px" }}>Product</th>
                  <th style={{ padding: "10px" }}>Category</th>
                  <th style={{ padding: "10px" }}>Available Stock</th>
                  <th style={{ padding: "10px" }}>Tracked Sold</th>
                  <th style={{ padding: "10px" }}>Stock Value</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px" }}>Track</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const st = getProductStatus(product);
                  const soldQty =
                    unitsSoldByProduct.get(String(product.id)) ??
                    unitsSoldByProduct.get(`name:${product.name.toLowerCase()}`) ??
                    0;

                  const badgeStyle =
                    st === "out"
                      ? { bg: "#fef2f2", color: "#b91c1c", text: "Out of Stock" }
                      : st === "low"
                        ? { bg: "#fffbeb", color: "#b45309", text: "Low Stock" }
                        : { bg: "#f0fdf4", color: "#15803d", text: "Healthy" };

                  return (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background:
                          String(product.id) === String(selectedProductId)
                            ? "#f8fafc"
                            : "transparent",
                      }}
                    >
                      <td style={{ padding: "10px", fontWeight: 600 }}>
                        {product.name}
                        {product.unit ? (
                          <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: "6px" }}>
                            ({product.unit})
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: "10px" }}>{product.category}</td>
                      <td style={{ padding: "10px", fontWeight: 700 }}>{product.stock}</td>
                      <td style={{ padding: "10px" }}>{soldQty}</td>
                      <td style={{ padding: "10px" }}>
                        ₹{(product.stock * product.price).toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: "999px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            background: badgeStyle.bg,
                            color: badgeStyle.color,
                          }}
                        >
                          {badgeStyle.text}
                        </span>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedProductId(String(product.id))}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          Track Item
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual Product Tracker */}
      <div className="admin-panel" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Product Tracker</h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.88rem", opacity: 0.75 }}>
              Inspect stock levels, pricing, and orders referencing a specific product.
            </p>
          </div>

          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              minWidth: "240px",
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.stock} in stock)
              </option>
            ))}
          </select>
        </div>

        {!trackedProduct ? (
          <p>Select a product above to view tracking details.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Product ID</div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", marginTop: "3px" }}>
                  {String(trackedProduct.id)}
                </div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Unit Price</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginTop: "3px" }}>
                  ₹{trackedProduct.price.toLocaleString("en-IN")}
                </div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Current Stock</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginTop: "3px" }}>
                  {trackedProduct.stock} units
                </div>
              </div>
              <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Matching Orders</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginTop: "3px" }}>
                  {trackedProductOrders.length}
                </div>
              </div>
            </div>

            {trackedProductOrders.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "8px" }}>Order ID</th>
                      <th style={{ padding: "8px" }}>Customer</th>
                      <th style={{ padding: "8px" }}>Status</th>
                      <th style={{ padding: "8px" }}>Order Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedProductOrders.map((ord, idx) => (
                      <tr key={ord._id || ord.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px" }}>
                          #{String(ord._id || ord.id || idx + 1).slice(-6)}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {ord.customerName || ord.user?.name || "Customer"}
                        </td>
                        <td style={{ padding: "8px" }}>{ord.status || "Pending"}</td>
                        <td style={{ padding: "8px", fontWeight: 600 }}>
                          ₹{Number(ord.totalAmount ?? ord.total ?? 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.75 }}>
                No order records matched this product yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StockTracker;