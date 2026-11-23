import { useState } from "react";

const SETTINGS_KEY = "freshmart-store-settings";

const defaultSettings = {
  storeName: "FreshMart",
  serviceArea: "Thalluru, Andhra Pradesh 524142 (14.801237, 79.941260)",
  phone: "+91 9063998638",
  email: "pradeepkumaramirisetty@gmail.com",
  freeDeliveryAbove: 499,
  deliveryFee: 30,
  idleTimeoutMinutes: 30,
};

function Settings() {
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [savedMessage, setSavedMessage] = useState("");

  const handleChange = (field, value) => {
    setSavedMessage("");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(form));
    setSavedMessage("Store and session settings saved.");
  };

  return (
    <div className="admin-panel">
      <h2 style={{ marginTop: 0 }}>Store & Session Settings</h2>
      <p style={{ opacity: 0.75, marginBottom: "18px" }}>
        Manage FreshMart store details, delivery rules, and admin session timeout.
      </p>

      <form
        onSubmit={handleSave}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Store Name
          </label>
          <input
            type="text"
            value={form.storeName}
            onChange={(e) => handleChange("storeName", e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            required
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Contact Phone
          </label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Support Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Service Area / Address
          </label>
          <input
            type="text"
            value={form.serviceArea}
            onChange={(e) => handleChange("serviceArea", e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Free Delivery Threshold (₹)
          </label>
          <input
            type="number"
            min="0"
            value={form.freeDeliveryAbove}
            onChange={(e) => handleChange("freeDeliveryAbove", Number(e.target.value))}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Standard Delivery Fee (₹)
          </label>
          <input
            type="number"
            min="0"
            value={form.deliveryFee}
            onChange={(e) => handleChange("deliveryFee", Number(e.target.value))}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
            Admin Idle Timeout (Minutes)
          </label>
          <input
            type="number"
            min="5"
            max="240"
            value={form.idleTimeoutMinutes}
            onChange={(e) => handleChange("idleTimeoutMinutes", Number(e.target.value))}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", marginTop: "6px" }}>
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#166534",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save Settings
          </button>

          {savedMessage && (
            <span style={{ color: "#166534", fontWeight: 600 }}>
              {savedMessage}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default Settings;