
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Customer = require("../models/Customer");
const customerAuth = require("../middleware/customerAuth");

const router = express.Router();

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==========================================
// CUSTOMER SIGNUP
// POST /api/customers/signup
// ==========================================
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter your name, email and password.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2 to 80 characters.",
      });
    }

    if (
      cleanEmail.length > 254 ||
      !validEmail(cleanEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8 to 72 characters long.",
      });
    }

    const existingCustomer = await Customer.findOne({
      email: cleanEmail,
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const customer = await Customer.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      role: "customer",
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please log in.",
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
      },
    });
  } catch (error) {
    // Also handles duplicate-email race conditions.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Customer signup error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create your account right now.",
    });
  }
});

// ==========================================
// CUSTOMER LOGIN
// POST /api/customers/login
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter your email and password.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!validEmail(cleanEmail) || cleanEmail.length > 254) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const customer = await Customer.findOne({
      email: cleanEmail,
    }).select("+password");

    if (
      !customer ||
      !(await bcrypt.compare(password, customer.password))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const secret = process.env.CUSTOMER_JWT_SECRET;

    if (!secret) {
      console.error("CUSTOMER_JWT_SECRET is missing.");

      return res.status(500).json({
        success: false,
        message: "Authentication is not configured.",
      });
    }

    const token = jwt.sign(
      {
        id: customer._id.toString(),
        role: "customer",
      },
      secret,
      {
        expiresIn: "1d",
        issuer: "stationeryhub",
        audience: "stationeryhub-customer",
      }
    );

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error("Customer login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in right now.",
    });
  }
});

// ==========================================
// GET LOGGED-IN CUSTOMER
// GET /api/customers/me
// ==========================================
router.get("/me", customerAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.customerId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid customer session.",
      });
    }

    const customer = await Customer.findById(req.customerId)
      .select("_id name email createdAt");

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Customer account not found.",
      });
    }

    return res.json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        joinedAt: customer.createdAt,
      },
    });
  } catch (error) {
    console.error("Get customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load customer account.",
    });
  }
});

module.exports = router;
