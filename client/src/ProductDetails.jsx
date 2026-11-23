import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "../cartcontext.jsx";
import "./ProductDetails.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function normalizeProduct(item) {
  return {
    id: item._id || item.id,
    name: item.name,
    size: item.unit || item.size || "",
    price: item.price,
    originalPrice: item.originalPrice,
    category: item.category,
    description:
      item.description ||
      "Fresh quality grocery item sourced for everyday household needs.",
    image: item.image || "",
    stock: Number(item.stock ?? 0),
    isAvailable: item.isAvailable !== false,
    isFeatured: Boolean(item.isFeatured),
  };
}

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity, cartCount } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    const fetchProductDetails = async () => {
      try {
        setLoading(true);
        setError("");

        const singleRes = await fetch(`${API_BASE}/api/products/${id}`);
        if (singleRes.ok) {
          const singleData = await singleRes.json();
          const rawItem = singleData.product || singleData.data || singleData;
          if (rawItem && (rawItem._id || rawItem.name)) {
            setProduct(normalizeProduct(rawItem));
            return;
          }
        }

        const listRes = await fetch(`${API_BASE}/api/products`);
        if (!listRes.ok) {
          throw new Error("Unable to fetch product details.");
        }

        const listData = await listRes.json();
        const items = listData.products || listData.data || [];
        const matched = items.find(
          (item) => String(item._id || item.id) === String(id)
        );

        if (!matched) {
          throw new Error("Product not found.");
        }

        setProduct(normalizeProduct(matched));
      } catch (err) {
        setError(err.message || "Failed to load product details.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProductDetails();
    }
  }, [id]);

  const cartItem = product
    ? cart.find((item) => item.id === product.id)
    : null;

  const outOfStock = !product || !product.isAvailable || product.stock <= 0;

  return (
    <div className="prod-detail-page">
      <header className="prod-detail-header">
        <button
          type="button"
          className="prod-back-btn"
          onClick={() => navigate("/")}
        >
          ← Back to Store
        </button>

        <div className="prod-brand" onClick={() => navigate("/")}>
          <span>🛒</span>
          <strong>FreshMart</strong>
        </div>

        <button
          type="button"
          className="prod-cart-btn"
          onClick={() => navigate("/cart")}
        >
          <span>🛒</span>
          <span>Cart</span>
          <span className="prod-cart-badge">{cartCount}</span>
        </button>
      </header>

      <main className="prod-detail-container">
        {loading ? (
          <div className="prod-state-box">
            <h2>Loading product details...</h2>
            <p>Fetching item information from FreshMart.</p>
          </div>
        ) : error || !product ? (
          <div className="prod-state-box">
            <h2>Product unavailable</h2>
            <p>{error || "Could not find this product."}</p>
            <button
              type="button"
              className="prod-primary-btn"
              onClick={() => navigate("/")}
            >
              Return to Products
            </button>
          </div>
        ) : (
          <div className="prod-detail-card">
            <div className="prod-detail-media">
              {product.isFeatured && (
                <span className="prod-featured-tag">Featured</span>
              )}
              {product.image ? (
                <img src={product.image} alt={product.name} />
              ) : (
                <div className="prod-img-placeholder">🛍️</div>
              )}
            </div>

            <div className="prod-detail-info">
              <span className="prod-category-pill">{product.category}</span>
              <h1 className="prod-title">{product.name}</h1>

              {product.size && (
                <p className="prod-unit">Pack / Unit: {product.size}</p>
              )}

              <div className="prod-price-row">
                <strong className="prod-price">₹{product.price}</strong>
                {product.originalPrice &&
                  Number(product.originalPrice) > Number(product.price) && (
                    <span className="prod-mrp">₹{product.originalPrice}</span>
                  )}
              </div>

              <div className="prod-meta-grid">
                <div className="prod-meta-item">
                  <small>Availability</small>
                  <strong>
                    {outOfStock ? "Out of Stock" : "In Stock"}
                  </strong>
                </div>
                <div className="prod-meta-item">
                  <small>Stock Available</small>
                  <strong>
                    {product.stock} {product.size ? `(${product.size})` : "units"}
                  </strong>
                </div>
              </div>

              <div className="prod-description-box">
                <h3>Product Details</h3>
                <p>{product.description}</p>
              </div>

              <div className="prod-actions">
                {outOfStock ? (
                  <button
                    type="button"
                    className="prod-primary-btn"
                    disabled
                  >
                    OUT OF STOCK
                  </button>
                ) : cartItem ? (
                  <div className="prod-qty-box">
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, -1)}
                    >
                      −
                    </button>
                    <span>{cartItem.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, 1)}
                      disabled={cartItem.quantity >= product.stock}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="prod-primary-btn"
                    onClick={() => addToCart(product)}
                  >
                    ADD TO CART — ₹{product.price}
                  </button>
                )}

                <button
                  type="button"
                  className="prod-secondary-btn"
                  onClick={() => navigate("/cart")}
                >
                  Go to Cart ({cartCount})
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}