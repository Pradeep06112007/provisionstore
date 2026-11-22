require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const productroutes = require("./routes/productroutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Trust proxy when deployed behind Render / Vercel / reverse proxies
app.set("trust proxy", 1);

// CORS configuration (local dev + production FRONTEND_URL)
const allowedOrigins = [
  "http://localhost:5173",
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim())
    : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., Postman, curl, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));

// Lightweight in-memory rate limiter for auth endpoints (15 requests per 15 mins per IP)
const authAttempts = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_REQUESTS = 15;

const authRateLimiter = (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = authAttempts.get(ip);

  if (!record || now - record.startTime > AUTH_WINDOW_MS) {
    authAttempts.set(ip, { count: 1, startTime: now });
    return next();
  }

  if (record.count >= AUTH_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: "Too many authentication attempts. Please try again after 15 minutes.",
    });
  }

  record.count += 1;
  return next();
};

// basic routes
app.get("/", (req, res) => {
  res.send("FreshMart Backend is Running!");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FreshMart API is working successfully!",
  });
});

// API routes
app.use("/api/products", productroutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", authRateLimiter);
app.use("/api/auth", authRoutes);

// start server
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`FreshMart server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();