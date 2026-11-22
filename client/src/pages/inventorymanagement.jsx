import { useEffect, useState } from "react";
import "./inventorymanagement.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${API_BASE}/api/products`;
const LOW_STOCK_LIMIT = 10;

const getAuthHeaders = () => {
  const token = localStorage.getItem("freshmart-admin-token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || ""}`,
  };
};

function InventoryManagement() {
  const [products, setProducts] = useState([]);
  const [stockValues, setStockValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  // Fetch inventory
  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load inventory.");
      }

      setProducts(data.products);

      const values = {};

      data.products.forEach((product) => {
        values[product._id] = product.stock;
      });

      setStockValues(values);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Handle stock input
  const handleStockChange = (id, value) => {
    setStockValues((previous) => ({
      ...previous,
      [id]: value,
    }));
  };

  // Update product stock
  const updateStock = async (product) => {
    const newStock = Number(stockValues[product._id]);

    if (!Number.isInteger(newStock) || newStock < 0) {
      setError(
        "Stock must be a whole number greater than or equal to 0."
      );
      return;
    }

    try {
      setUpdatingId(product._id);
      setError("");
      setMessage("");

      const response = await fetch(`${API_URL}/${product._id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          stock: newStock,
          isAvailable: newStock > 0,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update stock.");
      }

      setMessage(`${product.name} stock updated successfully.`);

      await fetchInventory();
    } catch (error) {
      setError(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Low-stock products
  const lowStockProducts = products.filter(
    (product) =>
      product.stock > 0 && product.stock < LOW_STOCK_LIMIT
  );

  // Out-of-stock products
  const outOfStockProducts = products.filter(
    (product) => product.stock === 0
  );

  // Stock status
  const getStockStatus = (stock) => {
    if (stock === 0) {
      return {
        label: "Out of Stock",
        className: "out-of-stock",
      };
    }

    if (stock < LOW_STOCK_LIMIT) {
      return {
        label: "Low Stock",
        className: "low-stock",
      };
    }

    return {
      label: "In Stock",
      className: "in-stock",
    };
  };

  return (
    <div className="inventory-management">
      <div className="inventory-heading">
        <div>
          <h1>Inventory Management</h1>
          <p>
            Monitor product quantities and manage shop stock.
          </p>
        </div>

        <button
          className="inventory-refresh"
          onClick={fetchInventory}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {message && (
        <div className="inventory-message">
          {message}
        </div>
      )}

      {error && (
        <div className="inventory-error">
          {error}
        </div>
      )}

      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <span>📦</span>
          <p>Total Products</p>
          <h2>{products.length}</h2>
        </div>

        <div className="inventory-stat-card">
          <span>⚠️</span>
          <p>Low Stock</p>
          <h2>{lowStockProducts.length}</h2>
        </div>

        <div className="inventory-stat-card">
          <span>🚫</span>
          <p>Out of Stock</p>
          <h2>{outOfStockProducts.length}</h2>
        </div>
      </div>

      <section className="inventory-alert-section">
        <h2>Stock Alerts</h2>

        <p>
          Low-stock threshold: fewer than {LOW_STOCK_LIMIT} units.
        </p>

        {lowStockProducts.length === 0 &&
        outOfStockProducts.length === 0 ? (
          <div className="inventory-good">
            <strong>
              ✓ All products have sufficient stock.
            </strong>
          </div>
        ) : (
          <div className="inventory-alert-list">
            {lowStockProducts.map((product) => (
              <div
                className="inventory-alert low"
                key={product._id}
              >
                <strong>{product.name}</strong>

                <span>
                  Only {product.stock} {product.unit} remaining
                </span>

                <span>Low Stock</span>
              </div>
            ))}

            {outOfStockProducts.map((product) => (
              <div
                className="inventory-alert out"
                key={product._id}
              >
                <strong>{product.name}</strong>
                <span>Stock quantity: 0</span>
                <span>Out of Stock</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="inventory-table-section">
        <div className="inventory-table-heading">
          <h2>Product Stock</h2>
          <span>{products.length} products</span>
        </div>

        {loading ? (
          <p className="inventory-empty">
            Loading inventory...
          </p>
        ) : products.length === 0 ? (
          <p className="inventory-empty">
            No products found.
          </p>
        ) : (
          <>
            {/* Desktop inventory table */}
            <div className="inventory-table-wrapper inventory-desktop-view">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Stock Status</th>
                    <th>Update Quantity</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const status = getStockStatus(product.stock);

                    return (
                      <tr key={product._id}>
                        <td>
                          <div className="inventory-product">
                            <img
                              src={
                                product.image ||
                                "https://placehold.co/50x50?text=Product"
                              }
                              alt={product.name}
                            />

                            <strong>{product.name}</strong>
                          </div>
                        </td>

                        <td>
                          {product.stock} {product.unit}
                        </td>

                        <td>
                          <span
                            className={`inventory-status ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td>
                          <input
                            className="inventory-stock-input"
                            type="number"
                            min="0"
                            step="1"
                            value={stockValues[product._id] ?? ""}
                            onChange={(event) =>
                              handleStockChange(
                                product._id,
                                event.target.value
                              )
                            }
                          />
                        </td>

                        <td>
                          <button
                            className="inventory-update-button"
                            onClick={() => updateStock(product)}
                            disabled={
                              updatingId === product._id ||
                              Number(stockValues[product._id]) ===
                                product.stock
                            }
                          >
                            {updatingId === product._id
                              ? "Saving..."
                              : "Update"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile inventory cards */}
            <div className="inventory-mobile-view">
              {products.map((product) => {
                const status = getStockStatus(product.stock);

                return (
                  <article
                    className="inventory-mobile-card"
                    key={product._id}
                  >
                    <div className="inventory-mobile-product">
                      <img
                        src={
                          product.image ||
                          "https://placehold.co/60x60?text=Product"
                        }
                        alt={product.name}
                      />

                      <div>
                        <h3>{product.name}</h3>
                        <p>{product.unit}</p>

                        <span
                          className={`inventory-status ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="inventory-mobile-current">
                      <span>Current Stock</span>

                      <strong>
                        {product.stock} {product.unit}
                      </strong>
                    </div>

                    <div className="inventory-mobile-update">
                      <label htmlFor={`stock-${product._id}`}>
                        Update Quantity
                      </label>

                      <div className="inventory-mobile-input">
                        <input
                          id={`stock-${product._id}`}
                          className="inventory-stock-input"
                          type="number"
                          min="0"
                          step="1"
                          value={stockValues[product._id] ?? ""}
                          onChange={(event) =>
                            handleStockChange(
                              product._id,
                              event.target.value
                            )
                          }
                        />

                        <button
                          className="inventory-update-button"
                          onClick={() => updateStock(product)}
                          disabled={
                            updatingId === product._id ||
                            Number(stockValues[product._id]) ===
                              product.stock
                          }
                        >
                          {updatingId === product._id
                            ? "Saving..."
                            : "Update"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default InventoryManagement;