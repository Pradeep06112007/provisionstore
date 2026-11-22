
const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getMe,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

// Customer registration
router.post("/register", registerUser);

// Customer and admin login
router.post("/login", loginUser);

// Verify logged-in user
router.get("/me", protect, getMe);

module.exports = router;
