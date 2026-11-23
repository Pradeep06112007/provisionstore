import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("freshmart-admin-token") || "";

    const loadCustomers = async () => {
      setLoading(true);
      setNotice("");

      const endpoints = [`${API_BASE}/api/users`, `${API_BASE}/api/customers`];
      let loaded = false;

      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) continue;

          const data = await res.json();
          const list = Array.isArray(data)
            ? data
            : data.customers || data.users || [];

          const customerOnly = list.filter(
            (item) => (item.role || "customer").toLowerCase() !== "admin"
          );

          setCustomers(customerOnly);
          loaded = true;
          break;
        } catch {
          // Try next endpoint
        }
      }

      if (!loaded) {
        setCustomers([]);
        setNotice(
          "No customer list endpoint responded yet (/api/users or /api/customers). Showing 0 records until your backend route is connected."
        );
      }

      setLoading(false);
    };

    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = String(c.phone || c.mobile || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [customers, search]);

  return (
    <div className="admin-panel">
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
          <h2 style={{ margin: 0 }}>Customer Management</h2>
          <p style={{ margin: "4px 0 0", opacity: 0.75 }}>
            View registered FreshMart customers and contact details.
          </p>
        </div>

        <input
          type="search"
          placeholder="Search name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            minWidth: "240px",
          }}
        />
      </div>

      {notice && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            marginBottom: "16px",
            fontSize: "0.9rem",
          }}
        >
          {notice}
        </div>
      )}

      {loading ? (
        <p>Loading customers...</p>
      ) : filteredCustomers.length === 0 ? (
        <p>No customer records found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "10px" }}>Customer</th>
                <th style={{ padding: "10px" }}>Email</th>
                <th style={{ padding: "10px" }}>Phone</th>
                <th style={{ padding: "10px" }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((cust, idx) => (
                <tr
                  key={cust._id || cust.id || idx}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <td style={{ padding: "10px", fontWeight: 600 }}>
                    {cust.name || "Customer"}
                  </td>
                  <td style={{ padding: "10px" }}>{cust.email || "—"}</td>
                  <td style={{ padding: "10px" }}>
                    {cust.phone || cust.mobile || "—"}
                  </td>
                  <td style={{ padding: "10px" }}>
                    {cust.createdAt
                      ? new Date(cust.createdAt).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CustomerManagement;