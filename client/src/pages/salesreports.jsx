import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function SalesReports() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const summary = useMemo(() => {
    const computedTotalOrders = stats?.totalOrders ?? orders.length;
    const computedRevenue =
      stats?.totalRevenue ??
      orders.reduce(
        (sum, o) => sum + Number(o.totalAmount ?? o.total ?? 0),
        0
      );
    const avgOrderValue =
      computedTotalOrders > 0
        ? Math.round(computedRevenue / computedTotalOrders)
        : 0;

    return {
      totalOrders: computedTotalOrders,
      totalRevenue: computedRevenue,
      avgOrderValue,
    };
  }, [orders, stats]);

  const exportCsv = () => {
    const headers = ["Order ID", "Customer", "Status", "Total Amount", "Date"];
    const rows = orders.map((o) => [
      o._id || o.id || "",
      o.customerName || o.user?.name || "Customer",
      o.status || "Pending",
      o.totalAmount ?? o.total ?? 0,
      o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "",
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

  return (
    <div className="admin-panel">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Sales Reports</h2>
          <p style={{ margin: "4px 0 0", opacity: 0.75 }}>
            Revenue summary, order counts, and downloadable CSV report.
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
        <>
          <div className="admin-stats" style={{ marginBottom: "20px" }}>
            <div className="admin-stat-card">
              <p>Total Revenue</p>
              <h2>₹{Number(summary.totalRevenue).toLocaleString("en-IN")}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Total Orders</p>
              <h2>{summary.totalOrders}</h2>
            </div>
            <div className="admin-stat-card">
              <p>Average Order Value</p>
              <h2>₹{Number(summary.avgOrderValue).toLocaleString("en-IN")}</h2>
            </div>
          </div>

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
                        ₹{Number(order.totalAmount ?? order.total ?? 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No orders recorded yet for detailed breakdown.</p>
          )}
        </>
      )}
    </div>
  );
}

export default SalesReports;