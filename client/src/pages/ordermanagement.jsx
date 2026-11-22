import { useEffect, useState } from "react";
import "./ordermanagement.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${API_BASE}/api/orders`;

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const PAYMENT_STATUSES = [
  "Pending",
  "Paid",
  "Failed",
  "Refunded",
];

function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState(null);

  // Get the admin login token
  const getAuthHeaders = () => {
    const token = localStorage.getItem("freshmart-admin-token");

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
    };
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load orders.");
      }

      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    if (newStatus === "Cancelled") {
      const confirmed = window.confirm(
        "Are you sure you want to cancel this order? Product stock will be restored."
      );

      if (!confirmed) return;
    }

    try {
      setUpdatingId(orderId);
      setError("");

      const response = await fetch(`${API_URL}/${orderId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          orderStatus: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update order.");
      }

      await fetchOrders();
      alert("Order status updated successfully.");
    } catch (err) {
      setError(err.message || "Could not update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const updatePaymentStatus = async (orderId, newPaymentStatus) => {
    if (newPaymentStatus === "Paid") {
      const confirmed = window.confirm(
        "Confirm that payment has been collected for this order? This will add the order amount to dashboard revenue."
      );

      if (!confirmed) return;
    }

    try {
      setUpdatingPaymentId(orderId);
      setError("");

      const response = await fetch(`${API_URL}/${orderId}/payment`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          paymentStatus: newPaymentStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to update payment status."
        );
      }

      await fetchOrders();
      alert("Payment status updated successfully.");
    } catch (err) {
      setError(err.message || "Could not update payment status.");
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    return status.toLowerCase().replace(/\s+/g, "-");
  };

  return (
    <div className="order-management">
      <div className="order-page-heading">
        <div>
          <h1>Order Management</h1>
          <p>View customer orders and manage their delivery status.</p>
        </div>

        <button
          className="order-refresh-btn"
          onClick={fetchOrders}
          disabled={loading}
        >
          ↻ Refresh Orders
        </button>
      </div>

      <div className="order-summary-cards">
        <div className="order-summary-card">
          <span>Total Orders</span>
          <h2>{orders.length}</h2>
        </div>

        <div className="order-summary-card">
          <span>Pending Orders</span>
          <h2>
            {orders.filter((order) => order.orderStatus === "Pending").length}
          </h2>
        </div>

        <div className="order-summary-card">
          <span>Completed Orders</span>
          <h2>
            {orders.filter((order) => order.orderStatus === "Delivered").length}
          </h2>
        </div>

        <div className="order-summary-card">
          <span>Cancelled Orders</span>
          <h2>
            {orders.filter((order) => order.orderStatus === "Cancelled").length}
          </h2>
        </div>
      </div>

      {error && <div className="order-error">{error}</div>}

      {loading ? (
        <div className="order-message">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="order-empty">
          <div>📦</div>
          <h2>No orders yet</h2>
          <p>Customer orders will appear here when they are placed.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div className="order-card" key={order._id}>
              <div className="order-card-header">
                <div>
                  <h3>Order #{order._id.slice(-8).toUpperCase()}</h3>
                  <p>{formatDate(order.createdAt)}</p>
                </div>

                <span
                  className={`order-status ${getStatusClass(order.orderStatus)}`}
                >
                  {order.orderStatus}
                </span>
              </div>

              <div className="order-customer-details">
                <div>
                  <strong>Customer</strong>
                  <p>{order.customerName}</p>
                </div>

                <div>
                  <strong>Phone</strong>
                  <p>{order.phone}</p>
                </div>

                <div>
                  <strong>Email</strong>
                  <p>{order.email || "Not provided"}</p>
                </div>

                <div>
                  <strong>Delivery Address</strong>
                  <p>{order.deliveryAddress}</p>
                </div>
              </div>

              <div className="order-items">
                <h4>Ordered Products</h4>

                {order.items?.map((item, index) => (
                  <div
                    className="order-item"
                    key={item._id || `${order._id}-${index}`}
                  >
                    <div className="order-item-info">
                      {item.image && (
                        <img src={item.image} alt={item.name} />
                      )}

                      <div>
                        <strong>{item.name}</strong>
                        <p>
                          {item.quantity} × {item.unit}
                        </p>
                      </div>
                    </div>

                    <strong>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="order-card-footer">
                <div className="order-payment-details">
                  <p>
                    Payment: <strong>{order.paymentMethod}</strong>
                  </p>
                  <p>
                    Payment Status: <strong>{order.paymentStatus}</strong>
                  </p>
                  <h3>Total: ₹{Number(order.totalAmount).toFixed(2)}</h3>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div className="order-status-control">
                    <label htmlFor={`payment-${order._id}`}>
                      Update Payment Status
                    </label>

                    <select
                      id={`payment-${order._id}`}
                      value={order.paymentStatus}
                      disabled={
                        updatingPaymentId === order._id ||
                        order.orderStatus === "Cancelled"
                      }
                      onChange={(event) =>
                        updatePaymentStatus(
                          order._id,
                          event.target.value
                        )
                      }
                    >
                      {PAYMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    {updatingPaymentId === order._id && (
                      <small>Updating payment...</small>
                    )}
                  </div>

                  <div className="order-status-control">
                    <label htmlFor={`status-${order._id}`}>
                      Update Order Status
                    </label>

                    <select
                      id={`status-${order._id}`}
                      value={order.orderStatus}
                      disabled={
                        updatingId === order._id ||
                        order.orderStatus === "Cancelled" ||
                        order.orderStatus === "Delivered"
                      }
                      onChange={(event) =>
                        updateStatus(order._id, event.target.value)
                      }
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    {updatingId === order._id && (
                      <small>Updating...</small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrderManagement;