import { useEffect, useState } from "react";
import "./productmanagement.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const api_url = `${API_BASE}/api/products`;

const empty_form = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  category: "",
  image: "",
  unit: "1 kg",
  stock: "",
  isAvailable: true,
  isFeatured: false,
};

function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(empty_form);
  const [editing_id, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [show_form, setShowForm] = useState(false);

  // Admin authentication headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem("freshmart-admin-token");

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    };
  };

  // Fetch all products - Public API
  const fetch_products = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(api_url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load products");
      }

      setProducts(data.products);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch_products();
  }, []);

  const handle_change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const open_add_form = () => {
    setEditingId(null);
    setForm(empty_form);
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const open_edit_form = (product) => {
    setEditingId(product._id);

    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price ?? "",
      originalPrice: product.originalPrice ?? "",
      category: product.category || "",
      image: product.image || "",
      unit: product.unit || "piece",
      stock: product.stock ?? 0,
      isAvailable: product.isAvailable,
      isFeatured: product.isFeatured,
    });

    setMessage("");
    setError("");
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Add or update product - Admin only
  const handle_submit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const product_data = {
      ...form,
      price: Number(form.price),
      originalPrice: Number(form.originalPrice || 0),
      stock: Number(form.stock),
    };

    try {
      const url = editing_id
        ? `${api_url}/${editing_id}`
        : api_url;

      const response = await fetch(url, {
        method: editing_id ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(product_data),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save product");
      }

      setMessage(
        editing_id
          ? "Product updated successfully!"
          : "Product added successfully!"
      );

      setForm(empty_form);
      setEditingId(null);
      setShowForm(false);

      await fetch_products();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete product - Admin only
  const delete_product = async (id, name) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${name}?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const response = await fetch(`${api_url}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete product");
      }

      setMessage("Product deleted successfully!");
      await fetch_products();
    } catch (error) {
      setError(error.message);
    }
  };

  const renderActions = (item) => (
    <div className="pm-actions">
      <button
        className="pm-edit-button"
        onClick={() => open_edit_form(item)}
      >
        Edit
      </button>

      <button
        className="pm-delete-button"
        onClick={() => delete_product(item._id, item.name)}
      >
        Delete
      </button>
    </div>
  );

  return (
    <div className="product-management">

      <div className="pm-heading">
        <div>
          <h1>Product Management</h1>
          <p>Add, edit and manage your grocery products.</p>
        </div>

        <button className="pm-add-button" onClick={open_add_form}>
          + Add Product
        </button>
      </div>

      {message && <div className="pm-message">{message}</div>}
      {error && <div className="pm-error">{error}</div>}

      {show_form && (
        <section className="pm-form-section">

          <div className="pm-form-heading">
            <h2>{editing_id ? "Edit Product" : "Add New Product"}</h2>

            <button
              type="button"
              className="pm-close-button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(empty_form);
              }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handle_submit}>
            <div className="pm-form-grid">

              <label>
                Product Name *
                <input
                  name="name"
                  value={form.name}
                  onChange={handle_change}
                  placeholder="Example: Premium Basmati Rice"
                  required
                />
              </label>

              <label>
                Category *
                <select
                  name="category"
                  value={form.category}
                  onChange={handle_change}
                  required
                >
                  <option value="">Select category</option>
                  <option value="Rice & Dals">Rice & Dals</option>
                  <option value="Oil & Ghee">Oil & Ghee</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Personal Care">Personal Care</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Household">Household</option>
                </select>
              </label>

              <label>
                Selling Price (₹) *
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handle_change}
                  min="0"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Original Price (₹)
                <input
                  type="number"
                  name="originalPrice"
                  value={form.originalPrice}
                  onChange={handle_change}
                  min="0"
                  step="0.01"
                />
              </label>

              <label>
                Unit *
                <input
                  name="unit"
                  value={form.unit}
                  onChange={handle_change}
                  placeholder="Example: 1 kg, 1 litre, 1 piece"
                  required
                />
              </label>

              <label>
                Stock Quantity *
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handle_change}
                  min="0"
                  step="1"
                  required
                />
              </label>

              <label className="pm-full-width">
                Image URL
                <input
                  name="image"
                  type="url"
                  value={form.image}
                  onChange={handle_change}
                  placeholder="Paste product image URL"
                />
              </label>

              <label className="pm-full-width">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handle_change}
                  placeholder="Describe your product"
                  rows="3"
                />
              </label>

            </div>

            <div className="pm-checkboxes">
              <label>
                <input
                  type="checkbox"
                  name="isAvailable"
                  checked={form.isAvailable}
                  onChange={handle_change}
                />
                Product Available
              </label>

              <label>
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={form.isFeatured}
                  onChange={handle_change}
                />
                Featured Product
              </label>
            </div>

            <div className="pm-form-actions">
              <button
                type="button"
                className="pm-cancel-button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(empty_form);
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="pm-save-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editing_id
                    ? "Update Product"
                    : "Save Product"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="pm-table-section">

        <div className="pm-table-heading">
          <h2>All Products</h2>
          <span>{products.length} products</span>
        </div>

        {loading ? (
          <p className="pm-empty">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="pm-empty">No products available.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="pm-table-wrapper pm-desktop-view">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div className="pm-product-info">
                          <img
                            src={item.image || "https://placehold.co/60x60?text=Product"}
                            alt={item.name}
                          />
                          <div>
                            <strong>{item.name}</strong>
                            <small>{item.unit}</small>
                          </div>
                        </div>
                      </td>

                      <td>{item.category}</td>
                      <td>₹{item.price}</td>
                      <td>{item.stock}</td>

                      <td>
                        <span
                          className={
                            item.isAvailable && item.stock > 0
                              ? "pm-status-active"
                              : "pm-status-inactive"
                          }
                        >
                          {item.isAvailable && item.stock > 0
                            ? "Available"
                            : "Unavailable"}
                        </span>
                      </td>

                      <td>{renderActions(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile product cards */}
            <div className="pm-mobile-view">
              {products.map((item) => (
                <article className="pm-mobile-card" key={item._id}>
                  <div className="pm-mobile-product">
                    <img
                      src={item.image || "https://placehold.co/80x80?text=Product"}
                      alt={item.name}
                    />

                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.unit}</p>
                      <span
                        className={
                          item.isAvailable && item.stock > 0
                            ? "pm-status-active"
                            : "pm-status-inactive"
                        }
                      >
                        {item.isAvailable && item.stock > 0
                          ? "Available"
                          : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  <div className="pm-mobile-details">
                    <div>
                      <span>Category</span>
                      <strong>{item.category}</strong>
                    </div>
                    <div>
                      <span>Price</span>
                      <strong>₹{item.price}</strong>
                    </div>
                    <div>
                      <span>Stock</span>
                      <strong>{item.stock}</strong>
                    </div>
                  </div>

                  {renderActions(item)}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default ProductManagement;