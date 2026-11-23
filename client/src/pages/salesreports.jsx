import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SETTINGS_KEY = "freshmart-store-settings";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getOrderAmount(order) {
  return Number(
    order.totalAmount ??
      order.total ??
      order.amount ??
      0
  );
}

function getOrderDate(order) {
  const raw = order.createdAt || order.date || order.updatedAt;
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function SalesReports() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [chartMetric, setChartMetric] = useState("revenue"); // "revenue" | "orders"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const taxRate = useMemo(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return Number(parsed?.gstPercentage ?? 0);
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("freshmart-admin-token") || "";
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const loadReportData = async () => {
      setLoading(true);
      setError("");

      try {
        const [statsRes, ordersRes] = await Promise.all([
          fetch(`${API_BASE}/api/orders/stats`, { headers }).catch(() => null),
          fetch(`${API_BASE}/api/orders`, { headers }).catch(() => null),
        ]);

        if (statsRes && statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.stats) setStats(statsData.stats);
        }

        if (ordersRes && ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const list = Array.isArray(ordersData)
            ? ordersData
            : ordersData.orders || [];
          setOrders(list);
        }
      } catch (err) {
        setError(err.message || "Unable to load sales report data.");
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, []);

  // Mathematical & statistical calculations
  const analytics = useMemo(() => {
    const amounts = orders
      .map(getOrderAmount)
      .filter((val) => Number.isFinite(val));

    const orderSum = amounts.reduce((acc, val) => acc + val, 0);
    const totalRevenue = stats?.totalRevenue ?? orderSum;
    const totalOrders = stats?.totalOrders ?? orders.length;

    const avgOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const sorted = [...amounts].sort((a, b) => a - b);
    const medianOrderValue =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[Math.floor(sorted.length / 2)]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

    const minOrderValue = sorted.length > 0 ? sorted[0] : 0;
    const maxOrderValue = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

    const deliveredCount = orders.filter((o) =>
      ["delivered", "completed"].includes(String(o.status || "").toLowerCase())
    ).length;
    const pendingCount = orders.filter((o) =>
      ["pending", "processing", "confirmed"].includes(
        String(o.status || "").toLowerCase()
      )
    ).length;
    const fulfilmentRate =
      orders.length > 0 ? ((deliveredCount / orders.length) * 100).toFixed(1) : "0.0";

    const estimatedTax = (totalRevenue * taxRate) / 100;
    const netAfterTax = totalRevenue - estimatedTax;

    // 12-month buckets (current year)
    const currentYear = new Date().getFullYear();
    const monthly = MONTH_LABELS.map((label, monthIndex) => ({
      monthIndex,
      label,
      revenue: 0,
      orderCount: 0,
    }));

    orders.forEach((order) => {
      const dt = getOrderDate(order);
      if (dt.getFullYear() === currentYear) {
        const m = dt.getMonth();
        monthly[m].revenue += getOrderAmount(order);
        monthly[m].orderCount += 1;
      }
    });

    // If orders exist but none match currentYear, place them by their month index anyway
    if (orders.length > 0 && monthly.every((m) => m.orderCount === 0)) {
      orders.forEach((order) => {
        const m = getOrderDate(order).getMonth();
        monthly[m].revenue += getOrderAmount(order);
        monthly[m].orderCount += 1;
      });
    }

    const currentMonthIdx = new Date().getMonth();
    const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
    const currMonthRev = monthly[currentMonthIdx]?.revenue || 0;
    const prevMonthRev = monthly[prevMonthIdx]?.revenue || 0;
    const momGrowthPct =
      prevMonthRev > 0
        ? (((currMonthRev - prevMonthRev) / prevMonthRev) * 100).toFixed(1)
        : currMonthRev > 0
          ? "100.0"
          : "0.0";

    const peakMonth = monthly.reduce(
      (best, item) => (item.revenue > best.revenue ? item : best),
      monthly[0]
    );

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      medianOrderValue,
      minOrderValue,
      maxOrderValue,
      deliveredCount,
      pendingCount,
      fulfilmentRate,
      estimatedTax,
      netAfterTax,
      monthly,
      momGrowthPct,
      peakMonth,
      year: currentYear,
    };
  }, [orders, stats, taxRate]);

  const exportCsv = () => {
    const headers = ["Order ID", "Customer", "Status", "Total Amount", "Date"];
    const rows = orders.map((o) => [
      o._id || o.id || "",
      o.customerName || o.user?.name || "Customer",
      o.status || "Pending",
      getOrderAmount(o),
      getOrderDate(o).toLocaleDateString("en-IN"),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `freshmart-sales-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maxChartVal = useMemo(() => {
    const vals = analytics.monthly.map((m) =>
      chartMetric === "revenue" ? m.revenue : m.orderCount
    );
    return Math.max(...vals, 1);
  }, [analytics.monthly, chartMetric]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Top KPI Cards */}
      <div className="admin-panel" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Sales Reports & Analytics</h2>
            <p style={{ margin: "4px 0 0", opacity: 0.75 }}>
              Monthly revenue & order trends, statistical calculations, and CSV export.
            </p>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: "#166534",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>
        </div>

        {error && (
          <div className="admin-login-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading sales report...</p>
        ) : (
          <div className="admin-stats">
            <div className="admin-stat-card">
              <p>Total Revenue</p>
              <h2>₹{Number(analytics.totalRevenue).toLocaleString("en-IN")}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Total Orders</p>
              <h2>{analytics.totalOrders}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Mean (Avg.) Order Value</p>
              <h2>₹{Math.round(analytics.avgOrderValue).toLocaleString("en-IN")}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Median Order Value</p>
              <h2>₹{Math.round(analytics.medianOrderValue).toLocaleString("en-IN")}</h2>
            </div>
          </div>
        )}
      </div>

      {/* Monthly Bar Chart */}
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
          <div>
            <h3 style={{ margin: 0 }}>
              Monthly {chartMetric === "revenue" ? "Revenue (₹)" : "Orders Count"} ({analytics.year})
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.88rem", opacity: 0.75 }}>
              Peak month: <strong>{analytics.peakMonth?.label}</strong> (₹
              {Number(analytics.peakMonth?.revenue || 0).toLocaleString("en-IN")}) • MoM change:{" "}
              <strong>{analytics.momGrowthPct}%</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setChartMetric("revenue")}
              style={{
                padding: "6px 12px",
                borderRadius: "7px",
                border: "1px solid #166534",
                background: chartMetric === "revenue" ? "#166534" : "#ffffff",
                color: chartMetric === "revenue" ? "#ffffff" : "#166534",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Revenue (₹)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("orders")}
              style={{
                padding: "6px 12px",
                borderRadius: "7px",
                border: "1px solid #166534",
                background: chartMetric === "orders" ? "#166534" : "#ffffff",
                color: chartMetric === "orders" ? "#ffffff" : "#166534",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Orders
            </button>
          </div>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg
            viewBox="0 0 760 250"
            role="img"
            aria-label="Monthly sales bar chart"
            style={{ width: "100%", minWidth: "520px", height: "250px", display: "block" }}
          >
            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = 200 - ratio * 165;
              const labelVal = Math.round(maxChartVal * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1="56"
                    y1={y}
                    x2="740"
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={ratio === 0 ? undefined : "4 4"}
                  />
                  <text
                    x="48"
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#64748b"
                  >
                    {chartMetric === "revenue" ? `₹${labelVal}` : labelVal}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {analytics.monthly.map((m, idx) => {
              const val = chartMetric === "revenue" ? m.revenue : m.orderCount;
              const barHeight = Math.max((val / maxChartVal) * 165, val > 0 ? 6 : 0);
              const slotWidth = (740 - 64) / 12;
              const barWidth = Math.min(slotWidth * 0.58, 36);
              const x = 64 + idx * slotWidth + (slotWidth - barWidth) / 2;
              const y = 200 - barHeight;

              return (
                <g key={m.label}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="5"
                    fill="#166534"
                  >
                    <title>
                      {m.label}: ₹{m.revenue.toLocaleString("en-IN")} ({m.orderCount} orders)
                    </title>
                  </rect>
                  <text
                    x={x + barWidth / 2}
                    y="222"
                    textAnchor="middle"
                    fontSize="11.5"
                    fontWeight="600"
                    fill="#334155"
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Mathematical Calculations Breakdown */}
      <div className="admin-panel" style={{ marginBottom: 0 }}>
        <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
          Mathematical & Statistical Summary
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "12px",
          }}
        >
          <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Max Order Value</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "4px" }}>
              ₹{Number(analytics.maxOrderValue).toLocaleString("en-IN")}
            </div>
          </div>

          <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Min Order Value</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "4px" }}>
              ₹{Number(analytics.minOrderValue).toLocaleString("en-IN")}
            </div>
          </div>

          <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Estimated Tax ({taxRate}%)
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "4px" }}>
              ₹{Math.round(analytics.estimatedTax).toLocaleString("en-IN")}
            </div>
          </div>

          <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Net After Tax</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "4px" }}>
              ₹{Math.round(analytics.netAfterTax).toLocaleString("en-IN")}
            </div>
          </div>

          <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Fulfilment Rate</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "4px" }}>
              {analytics.fulfilmentRate}% ({analytics.deliveredCount}/{orders.length})
            </div>
          </div>

          <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Active / Pending Orders</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "4px" }}>
              {analytics.pendingCount}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="admin-panel" style={{ marginBottom: 0 }}>
        <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Order Ledger</h3>
        {orders.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px" }}>Order ID</th>
                  <th style={{ padding: "10px" }}>Customer</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map((order, idx) => (
                  <tr
                    key={order._id || order.id || idx}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "10px" }}>
                      #{String(order._id || order.id || idx + 1).slice(-6)}
                    </td>
                    <td style={{ padding: "10px" }}>
                      {order.customerName || order.user?.name || "Customer"}
                    </td>
                    <td style={{ padding: "10px" }}>
                      {order.status || "Pending"}
                    </td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>
                      ₹{getOrderAmount(order).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No orders recorded yet for detailed breakdown.</p>
        )}
      </div>
    </div>
  );
}

export default SalesReports;