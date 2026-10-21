
const mongoose = require("mongoose");
const Product = require("./models/Product");

const MONGODB_URI =
  process.env.MONGODB_URI;

const products = [
  {
    name: "Classic Notebook",
    description: "Ruled notebook for school and college",
    price: 80,
    category: "Notebooks",
    image: "https://placehold.co/300x300?text=Notebook",
    stock: 50
  },
  {
    name: "Blue Ball Pen",
    description: "Smooth writing blue ball pen",
    price: 15,
    category: "Pens",
    image: "https://placehold.co/300x300?text=Pen",
    stock: 100
  },
  {
    name: "Pencil Set",
    description: "Pack of 10 graphite pencils",
    price: 40,
    category: "Pencils",
    image: "https://placehold.co/300x300?text=Pencils",
    stock: 30
  },
  {
    name: "Geometry Box",
    description: "Geometry tools for students",
    price: 120,
    category: "Geometry",
    image: "https://placehold.co/300x300?text=Geometry",
    stock: 20
  },
  {
    name: "Highlighter Set",
    description: "Set of 4 colourful highlighters",
    price: 100,
    category: "Art Supplies",
    image: "https://placehold.co/300x300?text=Highlighters",
    stock: 25
  }
];

async function seedProducts() {
  try {
    await mongoose.connect(MONGODB_URI);

    await Product.deleteMany({});
    await Product.insertMany(products);

    console.log("5 sample products added successfully!");
  } catch (error) {
    console.error("Seed failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedProducts();
