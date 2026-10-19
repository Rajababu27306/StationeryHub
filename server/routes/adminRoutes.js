
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const storedPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminUsername || !storedPassword || !jwtSecret) {
      return res.status(500).json({
        success: false,
        message: "Admin login configuration is missing.",
      });
    }

    const usernameMatches = username === adminUsername;
    let passwordMatches = false;

    // Prefer storing a bcrypt hash in ADMIN_PASSWORD.
    // Plain-text comparison is retained only for local setup.
    if (/^\$2[aby]\$/.test(storedPassword)) {
      passwordMatches = await bcrypt.compare(
        password,
        storedPassword
      );
    } else {
      passwordMatches = password === storedPassword;
    }

    if (!usernameMatches || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const token = jwt.sign(
      {
        role: "admin",
        username: adminUsername,
      },
      jwtSecret,
      { expiresIn: "1h" }
    );

    return res.json({
      success: true,
      message: "Admin login successful.",
      token,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Admin login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process login.",
    });
  }
});

module.exports = router;
