import { useState } from "react";

const SETTINGS_KEY = "freshmart-store-settings";

const DEFAULT_SETTINGS = {
  // Store & Contact
  storeName: "FreshMart",
  tagline: "Your neighbourhood store, now online.",
  phone: "+91 9063998638",
  whatsappNumber: "+91 9063998638",
  email: "pradeepkumaramirisetty@gmail.com",
  serviceArea: "Thalluru, Andhra Pradesh 524142 (14.801237, 79.941260)",
  deliveryRadiusKm: 10,

  // Store Operations & Delivery
  storeStatus: "Open",
  openingTime: "07:00",
  closingTime: "22:00",
  estimatedDeliveryMins: 30,
  minOrderAmount: 100,
  freeDeliveryAbove: 499,
  deliveryFee: 30,
  codEnabled: true,
  upiEnabled: true,

  // Inventory & Tax Rules
  lowStockThreshold: 10,
  gstPercentage: 0,
  currencySymbol: "₹",

  // Session & Security
  idleTimeoutMinutes: 30,
  customerSessionDays: 30,
  requireLoginForCart: true,
};

const SETTING_GROUPS = [
  {
    title: "Store Profile & Contact",
    subtitle: "Public storefront identity and neighbourhood support channels.",
    fields: [
      { key: "storeName", label: "Store Name", type: "text" },
      { key: "tagline", label: "Store Tagline", type: "text" },
      { key: "phone", label: "Contact Phone", type: "text" },
      { key: "whatsappNumber", label: "WhatsApp Support", type: "text" },
      { key: "email", label: "Support Email", type: "email" },
      { key: "serviceArea", label: "Service Area / Coordinates", type: "text" },
      { key: "deliveryRadiusKm", label: "Delivery Radius (km)", type: "number" },
    ],
  },
  {
    title: "Delivery, Orders & Payments",
    subtitle: "Configure checkout thresholds, delivery charges, and payment methods.",
    fields: [
      {
        key: "storeStatus",
        label: "Store Status",
        type: "select",
        options: ["Open", "Busy (Delayed)", "Closed"],
      },
      { key: "openingTime", label: "Opening Time", type: "time" },
      { key: "closingTime", label: "Closing Time", type: "time" },
      { key: "estimatedDeliveryMins", label: "Avg. Delivery Time (mins)", type: "number" },
      { key: "minOrderAmount", label: "Minimum Order Amount (₹)", type: "number" },
      { key: "freeDeliveryAbove", label: "Free Delivery Above (₹)", type: "number" },
      { key: "deliveryFee", label: "Standard Delivery Fee (₹)", type: "number" },
      { key: "codEnabled", label: "Cash on Delivery (COD)", type: "boolean" },
      { key: "upiEnabled", label: "Online / UPI Payments", type: "boolean" },
    ],
  },
  {
    title: "Inventory & Tax Calculations",
    subtitle: "Thresholds used for stock alerts and financial summaries.",
    fields: [
      { key: "lowStockThreshold", label: "Low Stock Alert Threshold (units)", type: "number" },
      { key: "gstPercentage", label: "Default Tax / GST (%)", type: "number" },
      { key: "currencySymbol", label: "Currency Symbol", type: "text" },
    ],
  },
  {
    title: "Session & Access Security",
    subtitle: "Control customer persistence and admin idle auto-logout.",
    fields: [
      { key: "idleTimeoutMinutes", label: "Admin Idle Timeout (minutes)", type: "number" },
      { key: "customerSessionDays", label: "Customer Session Length (days)", type: "number" },
      { key: "requireLoginForCart", label: "Require Customer Sign-In", type: "boolean" },
    ],
  },
];

function formatDisplayValue(field, value, currencySymbol = "₹") {
  if (field.type === "boolean") {
    return value ? "Enabled" : "Disabled";
  }
  if (value === "" || value === null || value === undefined) {
    return "Not set";
  }
  if (field.label.includes("(₹)")) {
    return `${currencySymbol}${Number(value).toLocaleString("en-IN")}`;
  }
  if (field.label.includes("(km)")) {
    return `${value} km`;
  }
  if (field.label.includes("(mins)") || field.label.includes("(minutes)")) {
    return `${value} mins`;
  }
  if (field.label.includes("(days)")) {
    return `${value} days`;
  }
  if (field.label.includes("(%)")) {
    return `${value}%`;
  }
  return String(value);
}

function Settings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Tracks which individual field keys are currently being edited
  const [editingKeys, setEditingKeys] = useState({});
  // Draft values while editing
  const [drafts, setDrafts] = useState({});
  const [statusBanner, setStatusBanner] = useState("");

  const startEditingField = (key) => {
    setStatusBanner("");
    setDrafts((prev) => ({ ...prev, [key]: settings[key] }));
    setEditingKeys((prev) => ({ ...prev, [key]: true }));
  };

  const cancelEditingField = (key) => {
    setEditingKeys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateDraftValue = (field, rawValue) => {
    let parsed = rawValue;
    if (field.type === "number") {
      parsed = rawValue === "" ? "" : Number(rawValue);
    } else if (field.type === "boolean") {
      parsed = rawValue === "true" || rawValue === true;
    }
    setDrafts((prev) => ({ ...prev, [field.key]: parsed }));
  };

  const saveField = (field) => {
    const nextValue = field.type === "number" && drafts[field.key] === "" ? 0 : drafts[field.key];
    const updated = { ...settings, [field.key]: nextValue };
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    cancelEditingField(field.key);
    setStatusBanner(`Updated "${field.label}".`);
  };

  const editAllInGroup = (group) => {
    setStatusBanner("");
    const nextDrafts = { ...drafts };
    const nextEditing = { ...editingKeys };
    group.fields.forEach((f) => {
      nextDrafts[f.key] = settings[f.key];
      nextEditing[f.key] = true;
    });
    setDrafts(nextDrafts);
    setEditingKeys(nextEditing);
  };

  const saveAllInGroup = (group) => {
    const updated = { ...settings };
    const nextEditing = { ...editingKeys };
    const nextDrafts = { ...drafts };

    group.fields.forEach((f) => {
      if (nextEditing[f.key]) {
        const val = f.type === "number" && nextDrafts[f.key] === "" ? 0 : nextDrafts[f.key];
        updated[f.key] = val;
        delete nextEditing[f.key];
        delete nextDrafts[f.key];
      }
    });

    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    setEditingKeys(nextEditing);
    setDrafts(nextDrafts);
    setStatusBanner(`${group.title} saved.`);
  };

  const cancelAllInGroup = (group) => {
    const nextEditing = { ...editingKeys };
    const nextDrafts = { ...drafts };
    group.fields.forEach((f) => {
      delete nextEditing[f.key];
      delete nextDrafts[f.key];
    });
    setEditingKeys(nextEditing);
    setDrafts(nextDrafts);
  };

  const resetAllDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    setEditingKeys({});
    setDrafts({});
    setStatusBanner("Restored default FreshMart settings.");
  };

  const activeEditCount = Object.keys(editingKeys).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="admin-panel" style={{ marginBottom: 0 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Store & System Settings</h2>
            <p style={{ margin: "4px 0 0", opacity: 0.75 }}>
              Click any setting value or its <strong>Edit</strong> button to modify it directly.
            </p>
          </div>

          <button
            type="button"
            onClick={resetAllDefaults}
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
            Reset Defaults
          </button>
        </div>

        {statusBanner && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            {statusBanner}
          </div>
        )}
      </div>

      {SETTING_GROUPS.map((group) => {
        const groupHasEditing = group.fields.some((f) => Boolean(editingKeys[f.key]));

        return (
          <div key={group.title} className="admin-panel" style={{ marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                marginBottom: "14px",
                paddingBottom: "10px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{group.title}</h3>
                <p style={{ margin: "3px 0 0", fontSize: "0.88rem", opacity: 0.75 }}>
                  {group.subtitle}
                </p>
              </div>

              {!groupHasEditing ? (
                <button
                  type="button"
                  onClick={() => editAllInGroup(group)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "7px",
                    border: "1px solid #166534",
                    background: "#ffffff",
                    color: "#166534",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Edit Section
                </button>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => saveAllInGroup(group)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "7px",
                      border: "none",
                      background: "#166534",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Save Section
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelAllInGroup(group)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "7px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#334155",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "12px",
              }}
            >
              {group.fields.map((field) => {
                const isEditing = Boolean(editingKeys[field.key]);
                const currentVal = drafts[field.key];

                return (
                  <div
                    key={field.key}
                    style={{
                      border: isEditing ? "1.5px solid #166534" : "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      background: isEditing ? "#f8fafc" : "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "#475569",
                        }}
                      >
                        {field.label}
                      </span>

                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => startEditingField(field.key)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#166534",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            padding: "2px 6px",
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>

                    {!isEditing ? (
                      <div
                        onClick={() => startEditingField(field.key)}
                        title="Click to edit"
                        style={{
                          fontSize: "0.98rem",
                          fontWeight: 600,
                          color: "#0f172a",
                          cursor: "pointer",
                          padding: "4px 2px",
                          wordBreak: "break-word",
                        }}
                      >
                        {formatDisplayValue(
                          field,
                          settings[field.key],
                          settings.currencySymbol || "₹"
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {field.type === "select" ? (
                          <select
                            autoFocus
                            value={currentVal}
                            onChange={(e) => updateDraftValue(field, e.target.value)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: "7px",
                              border: "1px solid #94a3b8",
                              background: "#ffffff",
                            }}
                          >
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "boolean" ? (
                          <select
                            autoFocus
                            value={String(currentVal)}
                            onChange={(e) => updateDraftValue(field, e.target.value)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: "7px",
                              border: "1px solid #94a3b8",
                              background: "#ffffff",
                            }}
                          >
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={field.type}
                            value={currentVal ?? ""}
                            onChange={(e) => updateDraftValue(field, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveField(field);
                              } else if (e.key === "Escape") {
                                cancelEditingField(field.key);
                              }
                            }}
                            style={{
                              padding: "7px 10px",
                              borderRadius: "7px",
                              border: "1px solid #94a3b8",
                              background: "#ffffff",
                            }}
                          />
                        )}

                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => cancelEditingField(field.key)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#334155",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveField(field)}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#166534",
                              color: "#ffffff",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {activeEditCount > 0 && (
        <div
          style={{
            fontSize: "0.85rem",
            color: "#475569",
            textAlign: "right",
          }}
        >
          {activeEditCount} field{activeEditCount > 1 ? "s" : ""} currently in edit mode.
        </div>
      )}
    </div>
  );
}

export default Settings;