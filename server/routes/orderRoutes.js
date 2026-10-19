const express = require("express");
const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const verifyAdmin = require("../middleware/auth");
const customerAuth = require("../middleware/customerAuth");

const router = express.Router();

const allowedStatuses = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled",
];

// ==========================================
// CUSTOMER: PLACE ORDER + DEDUCT STOCK
// POST /api/orders
// Requires customer login.
// ==========================================
router.post("/", customerAuth, async (req, res) => {
  let session;

  try {
    const { customerName, mobile, address, items } = req.body;

    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      customerName.trim().length > 80 ||
      typeof mobile !== "string" ||
      !mobile.trim() ||
      mobile.trim().length > 20 ||
      typeof address !== "string" ||
      !address.trim() ||
      address.trim().length > 500 ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid customer details and order items.",
      });
    }

    // Confirm the authenticated customer still exists.
    const customerExists = await Customer.exists({
      _id: req.customerId,
    });

    if (!customerExists) {
      return res.status(401).json({
        success: false,
        message: "Customer account not found. Please log in again.",
      });
    }

    // Validate items and combine duplicate product IDs.
    const quantities = new Map();

    for (const item of items) {
      const productId = String(item?.productId || "");
      const quantity = Number(item?.quantity);

      if (
        !mongoose.isValidObjectId(productId) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID or quantity.",
        });
      }

      const combinedQuantity =
        (quantities.get(productId) || 0) + quantity;

      if (!Number.isSafeInteger(combinedQuantity)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order quantity.",
        });
      }

      quantities.set(productId, combinedQuantity);
    }

    session = await mongoose.startSession();

    let savedOrder;

    await session.withTransaction(async () => {
      const orderItems = [];
      let totalAmount = 0;

      for (const [productId, quantity] of quantities) {
        const product = await Product.findOneAndUpdate(
          {
            _id: productId,
            stock: { $gte: quantity },
          },
          {
            $inc: { stock: -quantity },
          },
          {
            new: true,
            session,
            runValidators: true,
          }
        );

        if (!product) {
          const exists = await Product.exists({
            _id: productId,
          }).session(session);

          if (!exists) {
            const error = new Error(
              `Product not found: ${productId}`
            );
            error.statusCode = 404;
            throw error;
          }

          const error = new Error(
            `Insufficient stock for product ID: ${productId}`
          );
          error.statusCode = 400;
          throw error;
        }

        const price = Number(product.price);

        if (!Number.isFinite(price) || price < 0) {
          const error = new Error(
            `Invalid price for ${product.name}.`
          );
          error.statusCode = 400;
          throw error;
        }

        orderItems.push({
          productId: product._id,
          name: product.name,
          price,
          quantity,
        });

        totalAmount += price * quantity;
      }

      if (!Number.isFinite(totalAmount)) {
        const error = new Error("Invalid order total.");
        error.statusCode = 400;
        throw error;
      }

      const createdOrders = await Order.create(
        [
          {
            // Comes from the verified token, not request body.
            customerId: req.customerId,
            customerName: customerName.trim(),
            mobile: mobile.trim(),
            address: address.trim(),
            items: orderItems,
            totalAmount,
            status: "Pending",
          },
        ],
        { session }
      );

      savedOrder = createdOrders[0];
    });

    console.log(
      "Customer order saved and stock deducted:",
      savedOrder._id
    );

    return res.status(201).json({
      success: true,
      message: "Order placed successfully. Stock updated.",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Place order error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to place order. Check server logs and MongoDB transaction support.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

// ==========================================
// CUSTOMER: MY ORDERS
// GET /api/orders/my-orders
// Only returns the logged-in customer's orders.
// ==========================================
router.get("/my-orders", customerAuth, async (req, res) => {
  try {
    const orders = await Order.find({
      customerId: req.customerId,
    })
      .select(
        "_id customerName items totalAmount status createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      count: orders.length,
      orders: orders.map((order) => ({
        orderId: order._id,
        items: order.items,
        totalAmount: order.totalAmount,
        status: order.status,
        orderDate: order.createdAt,
        lastUpdated: order.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Fetch customer orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch your orders.",
    });
  }
});

// ==========================================
// CUSTOMER: TRACK ORDER
// GET /api/orders/track/:id
// Returns tracking information only.
// ==========================================
router.get("/track/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID.",
      });
    }

    const order = await Order.findById(id)
      .select("_id status createdAt updatedAt")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found. Please check your Order ID.",
      });
    }

    return res.json({
      success: true,
      order: {
        orderId: order._id,
        status: order.status,
        orderDate: order.createdAt,
        lastUpdated: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("Track order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to track order right now.",
    });
  }
});

// ==========================================
// ADMIN: GET ALL ORDERS
// ==========================================
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Fetch orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch orders.",
    });
  }
});

// ==========================================
// ADMIN: UPDATE STATUS + RESTORE STOCK
// ==========================================
router.patch("/:id/status", verifyAdmin, async (req, res) => {
  let session;

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status.",
      });
    }

    session = await mongoose.startSession();

    let updatedOrder;
    let stockRestored = false;

    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);

      if (!order) {
        const error = new Error("Order not found.");
        error.statusCode = 404;
        throw error;
      }

      // Do not restore stock a second time.
      if (order.status === "Cancelled" && status === "Cancelled") {
        updatedOrder = order;
        return;
      }

      // A cancelled order cannot be reopened.
      if (order.status === "Cancelled" && status !== "Cancelled") {
        const error = new Error(
          "A cancelled order cannot be reopened."
        );
        error.statusCode = 400;
        throw error;
      }

      if (status === "Cancelled") {
        for (const item of order.items) {
          const quantity = Number(item.quantity);

          if (!Number.isSafeInteger(quantity) || quantity < 1) {
            const error = new Error(
              `Invalid quantity in order item: ${item.name}`
            );
            error.statusCode = 400;
            throw error;
          }

          const product = await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: quantity } },
            {
              new: true,
              session,
              runValidators: true,
            }
          );

          if (!product) {
            const error = new Error(
              `Cannot restore stock. Product not found: ${item.name}`
            );
            error.statusCode = 400;
            throw error;
          }
        }

        stockRestored = true;
      }

      order.status = status;
      await order.save({ session });

      updatedOrder = order;
    });

    return res.json({
      success: true,
      message: stockRestored
        ? "Order cancelled and stock restored successfully."
        : "Order status updated successfully.",
      stockRestored,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update order status error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to update order status. Check server logs and MongoDB transaction support.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

module.exports = router;