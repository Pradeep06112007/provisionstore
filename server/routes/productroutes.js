
const express = require("express");
const router = express.Router();

const product = require("../models/product");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

// GET all products - Public
router.get("/", async (req, res) => {
  try {
    const products = await product.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
});

// GET one product by ID - Public
router.get("/:id", async (req, res) => {
  try {
    const item = await product.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product: item,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid product ID",
      error: error.message,
    });
  }
});

// ADD product - Admin only
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const newproduct = await product.create(req.body);

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product: newproduct,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to add product",
      error: error.message,
    });
  }
});

// UPDATE product - Admin only
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const updatedproduct = await product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedproduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedproduct,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
});

// DELETE product - Admin only
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const deletedproduct = await product.findByIdAndDelete(
      req.params.id
    );

    if (!deletedproduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
});

module.exports = router;
