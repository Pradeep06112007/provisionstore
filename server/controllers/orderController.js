const mongoose = require("mongoose");
const Order = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user");

// POST /api/orders - Create a new order
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      customerName,
      phone,
      email,
      deliveryAddress,
      items,
      paymentMethod,
    } = req.body;

    const cleanName = typeof customerName === "string" ? customerName.trim() : "";
    const cleanPhone = typeof phone === "string" ? phone.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanAddress = typeof deliveryAddress === "string" ? deliveryAddress.trim() : "";

    if (!cleanName || !cleanPhone || !cleanAddress) {
      return res.status(400).json({
        success: false,
        message: "Customer name, phone and delivery address are required.",
      });
    }

    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Customer name must be between 2 and 80 characters.",
      });
    }

    // Validate 10-digit Indian mobile number (optional +91 or 0 prefix)
    const normalizedPhone = cleanPhone.replace(/[\s\-()]/g, "");
    const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number.",
      });
    }

    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (cleanEmail.length > 120 || !emailRegex.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
      }
    }

    if (cleanAddress.length < 10 || cleanAddress.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Delivery address must be between 10 and 300 characters.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one product to the order.",
      });
    }

    if (paymentMethod && paymentMethod !== "Cash on Delivery") {
      return res.status(400).json({
        success: false,
        message: "Only Cash on Delivery is currently available.",
      });
    }

    const combinedItems = new Map();

    for (const item of items) {
      const productId = item.product || item.productId;
      const quantity = Number(item.quantity);

      if (
        !productId ||
        !mongoose.Types.ObjectId.isValid(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID or quantity.",
        });
      }

      const id = productId.toString();

      combinedItems.set(
        id,
        (combinedItems.get(id) || 0) + quantity
      );
    }

    let savedOrderId;

    await session.withTransaction(async () => {
      const orderItems = [];
      let totalAmount = 0;

      for (const [productId, quantity] of combinedItems) {
        const product = await Product.findById(productId).session(
          session
        );

        if (
          !product ||
          !product.isAvailable ||
          product.stock < quantity
        ) {
          throw new Error(
            "A product is unavailable or has insufficient stock."
          );
        }

        const updateResult = await Product.updateOne(
          {
            _id: productId,
            stock: { $gte: quantity },
            isAvailable: true,
          },
          {
            $inc: { stock: -quantity },
          },
          { session }
        );

        if (updateResult.modifiedCount !== 1) {
          throw new Error(
            "Stock changed while placing your order. Please try again."
          );
        }

        const remainingStock = product.stock - quantity;

        if (remainingStock === 0) {
          await Product.updateOne(
            { _id: productId },
            { $set: { isAvailable: false } },
            { session }
          );
        }

        orderItems.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity,
          unit: product.unit,
          image: product.image,
        });

        totalAmount += product.price * quantity;
      }

      const newOrder = new Order({
        customerName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        deliveryAddress: cleanAddress,
        items: orderItems,
        totalAmount,
        paymentMethod: "Cash on Delivery",
        paymentStatus: "Pending",
        orderStatus: "Pending",
      });

      await newOrder.save({ session });
      savedOrderId = newOrder._id;
    });

    const savedOrder = await Order.findById(savedOrderId)
      .populate("items.product");

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create order.",
    });
  } finally {
    await session.endSession();
  }
};

// GET /api/orders - Get all orders
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.product")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve orders.",
    });
  }
};

// PATCH /api/orders/:id - Update order status
const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "Preparing",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    if (!allowedStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status.",
      });
    }

    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);

      if (!order) {
        throw new Error("Order not found.");
      }

      if (
        order.orderStatus === "Cancelled" ||
        order.orderStatus === "Delivered"
      ) {
        throw new Error(
          "A cancelled or delivered order cannot be changed."
        );
      }

      if (orderStatus === "Cancelled") {
        for (const item of order.items) {
          const product = await Product.findById(
            item.product
          ).session(session);

          if (product) {
            product.stock += item.quantity;
            product.isAvailable = product.stock > 0;
            await product.save({ session });
          }
        }
      }

      order.orderStatus = orderStatus;
      await order.save({ session });

      updatedOrder = order;
    });

    updatedOrder = await Order.findById(id).populate(
      "items.product"
    );

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update order error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update order.",
    });
  } finally {
    await session.endSession();
  }
};

// PATCH /api/orders/:id/payment - Update payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const allowedPaymentStatuses = [
      "Pending",
      "Paid",
      "Failed",
      "Refunded",
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    if (!allowedPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status.",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.orderStatus === "Cancelled" && paymentStatus === "Paid") {
      return res.status(400).json({
        success: false,
        message: "A cancelled order cannot be marked as Paid.",
      });
    }

    order.paymentStatus = paymentStatus;
    await order.save();

    const updatedOrder = await Order.findById(id).populate(
      "items.product"
    );

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update payment status error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update payment status.",
    });
  }
};

// GET /api/orders/stats - Admin dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalProducts,
      totalOrders,
      totalCustomers,
      revenueResult,
    ] = await Promise.all([
      Product.countDocuments(),

      Order.countDocuments(),

      User.countDocuments({
        role: "customer",
      }),

      Order.aggregate([
        {
          $match: {
            paymentStatus: "Paid",
            orderStatus: { $ne: "Cancelled" },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$totalAmount",
            },
          },
        },
      ]),
    ]);

    const totalRevenue =
      revenueResult.length > 0
        ? revenueResult[0].totalRevenue
        : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        totalOrders,
        totalCustomers,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard statistics.",
    });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getDashboardStats,
};