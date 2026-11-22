const express = require("express");
const router = express.Router();

const {
  createOrder,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getDashboardStats,
} = require("../controllers/orderController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

// Customers can place orders without logging in
router.post("/", createOrder);

// Admin-only dashboard statistics
router.get("/stats", protect, adminOnly, getDashboardStats);

// Only authenticated admins can view all orders
router.get("/", protect, adminOnly, getAllOrders);

// Only authenticated admins can update payment status
router.patch("/:id/payment", protect, adminOnly, updatePaymentStatus);

// Only authenticated admins can update order status
router.patch("/:id", protect, adminOnly, updateOrderStatus);

module.exports = router;