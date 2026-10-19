
const express = require("express");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const verifyAdmin = require("../middleware/auth");

const router = express.Router();

// ==========================================
// VALIDATION HELPERS
// ==========================================
function isValidStock(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return false;
  }

  const stock = Number(value);

  return Number.isSafeInteger(stock) && stock >= 0;
}

function isValidPrice(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return false;
  }

  const price = Number(value);

  return Number.isFinite(price) && price >= 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// ==========================================
// GET: ALL PRODUCTS (PUBLIC)
// ==========================================
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Fetch products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Products fetch nahi ho paaye.",
    });
  }
});

// ==========================================
// GET: ONE PRODUCT (PUBLIC)
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product nahi mila.",
      });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Fetch product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Product fetch nahi ho paaya.",
    });
  }
});

// ==========================================
// POST: ADD PRODUCT (ADMIN ONLY)
// ==========================================
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      image,
      stock,
    } = req.body;

    if (
      !isNonEmptyString(name) ||
      !isNonEmptyString(category) ||
      !isValidPrice(price) ||
      !isValidStock(stock)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid name, category, non-negative price aur whole-number stock enter karein.",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description:
        typeof description === "string" ? description : "",
      price: Number(price),
      category: category.trim(),
      image: typeof image === "string" ? image : "",
      stock: Number(stock),
    });

    return res.status(201).json({
      success: true,
      message: "Product successfully add ho gaya.",
      product,
    });
  } catch (error) {
    console.error("Add product error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Product add nahi ho paaya.",
    });
  }
});

// ==========================================
// PUT: EDIT PRODUCT (ADMIN ONLY)
// ==========================================
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const {
      name,
      description,
      price,
      category,
      image,
      stock,
    } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty.",
        });
      }
      updates.name = name.trim();
    }

    if (category !== undefined) {
      if (!isNonEmptyString(category)) {
        return res.status(400).json({
          success: false,
          message: "Product category cannot be empty.",
        });
      }
      updates.category = category.trim();
    }

    if (price !== undefined) {
      if (!isValidPrice(price)) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid non-negative number.",
        });
      }
      updates.price = Number(price);
    }

    if (stock !== undefined) {
      if (!isValidStock(stock)) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a non-negative whole number.",
        });
      }
      updates.stock = Number(stock);
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be text.",
        });
      }
      updates.description = description;
    }

    if (image !== undefined) {
      if (typeof image !== "string") {
        return res.status(400).json({
          success: false,
          message: "Image must be text.",
        });
      }
      updates.image = image;
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product nahi mila.",
      });
    }

    return res.json({
      success: true,
      message: "Product successfully update ho gaya.",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Product update nahi ho paaya.",
    });
  }
});

// ==========================================
// PATCH: UPDATE STOCK ONLY (ADMIN ONLY)
// ==========================================
router.patch("/:id/stock", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    if (!isValidStock(stock)) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a non-negative whole number.",
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { stock: Number(stock) } },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product nahi mila.",
      });
    }

    return res.json({
      success: true,
      message: "Stock successfully update ho gaya.",
      product,
    });
  } catch (error) {
    console.error("Update stock error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Stock update nahi ho paaya.",
    });
  }
});

// ==========================================
// DELETE: REMOVE PRODUCT (ADMIN ONLY)
// ==========================================
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product nahi mila.",
      });
    }

    return res.json({
      success: true,
      message: "Product successfully delete ho gaya.",
    });
  } catch (error) {
    console.error("Delete product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Product delete nahi ho paaya.",
    });
  }
});

module.exports = router;
