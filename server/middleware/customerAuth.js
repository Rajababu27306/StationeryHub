
const jwt = require("jsonwebtoken");

module.exports = function customerAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue.",
    });
  }

  const token = authHeader.slice(7);
  const secret = process.env.CUSTOMER_JWT_SECRET;

  if (!secret) {
    console.error("CUSTOMER_JWT_SECRET is missing.");

    return res.status(500).json({
      success: false,
      message: "Authentication is not configured.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (decoded.role !== "customer" || !decoded.id) {
      return res.status(403).json({
        success: false,
        message: "Customer access only.",
      });
    }

    req.customerId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or expired. Please log in again.",
    });
  }
};
