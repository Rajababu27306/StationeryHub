
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required."],
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    price: {
      type: Number,
      required: [true, "Product price is required."],
      min: [0, "Price cannot be negative."],
      validate: {
        validator: Number.isFinite,
        message: "Price must be a valid number.",
      },
    },

    category: {
      type: String,
      required: [true, "Product category is required."],
      trim: true,
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative."],
      validate: [
        {
          validator: Number.isSafeInteger,
          message: "Stock must be a whole number.",
        },
        {
          validator: Number.isFinite,
          message: "Stock must be a valid number.",
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
