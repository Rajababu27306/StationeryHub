
/* ==========================================
   STATIONERYHUB - COMPLETE FRONTEND SCRIPT
   Backend: Node.js + Express
   Database: MongoDB
   ========================================== */

const API_BASE_URL = "http://localhost:5000/api";
const CUSTOMER_TOKEN_KEY = "stationeryHubCustomerToken";

// Application state
let products = [];

let cart = JSON.parse(
  localStorage.getItem("stationeryhub_cart") || "[]"
);

let wishlist = JSON.parse(
  localStorage.getItem("stationeryhub_wishlist") || "[]"
);

let activeCategory = "all";
let searchText = "";
let isPlacingOrder = false;

// ==========================================
// HTML ELEMENT HELPERS
// ==========================================

function getElement(...ids) {
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) return element;
  }
  return null;
}

const productsContainer = getElement(
  "productsContainer",
  "productsGrid",
  "product-list",
  "productList",
  "products"
);

const searchInput = getElement(
  "searchInput",
  "search",
  "productSearch"
);

const categoryFilter = getElement(
  "categoryFilter",
  "category",
  "categorySelect"
);

const cartCountElement = getElement("cartCount", "cart-count");
const cartItemsContainer = getElement("cartItems", "cart-items");
const cartTotalElement = getElement("cartTotal", "cart-total");

const wishlistCountElement = getElement(
  "wishlistCount",
  "wishlist-count"
);

// ==========================================
// CUSTOMER AUTHENTICATION
// ==========================================

function getCustomerToken() {
  return sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
}

function getCustomerHeaders() {
  const token = getCustomerToken();

  if (!token) {
    throw new Error("Please login before placing your order.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

function redirectToLogin() {
  window.location.href = "customer-auth.html";
}

// ==========================================
// SAVE CART AND WISHLIST
// ==========================================

function saveCart() {
  localStorage.setItem(
    "stationeryhub_cart",
    JSON.stringify(cart)
  );
  updateCartUI();
}

function saveWishlist() {
  localStorage.setItem(
    "stationeryhub_wishlist",
    JSON.stringify(wishlist)
  );
  updateWishlistUI();
}

// ==========================================
// LOAD PRODUCTS FROM BACKEND
// ==========================================

async function loadProductsFromBackend() {
  if (!productsContainer) {
    console.error(
      "Products container nahi mila. index.html mein ID check karo."
    );
    return;
  }

  productsContainer.textContent = "Loading stationery products...";

  try {
    const response = await fetch(`${API_BASE_URL}/products`);

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    products = Array.isArray(result)
      ? result
      : Array.isArray(result.products)
        ? result.products
        : [];

    renderProducts();
    populateCategories();
    updateCartUI();

    console.log("Products loaded:", products);
  } catch (error) {
    console.error("Products loading failed:", error);

    productsContainer.innerHTML = `
      <div class="error-message">
        <h3>Products load nahi hue</h3>
        <p>Backend server aur MongoDB connection check karo.</p>
        <button type="button" onclick="loadProductsFromBackend()">
          Try Again
        </button>
      </div>
    `;
  }
}

// ==========================================
// SAFE HTML AND IMAGE HELPERS
// ==========================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function safeImageURL(value) {
  if (!value) return "";

  try {
    const url = new URL(value, window.location.href);

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return escapeHTML(url.href);
    }
  } catch (error) {
    console.warn("Invalid product image URL");
  }

  return "";
}

// ==========================================
// RENDER PRODUCTS
// ==========================================

function renderProducts() {
  if (!productsContainer) return;

  const filteredProducts = products.filter((product) => {
    const name = String(product.name || "").toLowerCase();
    const description = String(
      product.description || ""
    ).toLowerCase();
    const category = String(
      product.category || ""
    ).toLowerCase();

    const matchesSearch =
      name.includes(searchText) ||
      description.includes(searchText);

    const matchesCategory =
      activeCategory === "all" ||
      category === String(activeCategory).toLowerCase();

    return matchesSearch && matchesCategory;
  });

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML =
      '<p class="empty-message">Koi product nahi mila.</p>';
    return;
  }

  productsContainer.innerHTML = filteredProducts
    .map((product) => {
      const id = escapeHTML(
        String(product._id || product.id || "")
      );
      const name = escapeHTML(
        product.name || "Stationery Item"
      );
      const description = escapeHTML(
        product.description || "Quality stationery product"
      );
      const category = escapeHTML(
        product.category || "Stationery"
      );

      const price = Number(product.price) || 0;
      const stock = Number(product.stock) || 0;
      const image = safeImageURL(product.image);
      const isWishlisted = wishlist.includes(id);

      return `
        <article class="product-card">
          <div class="product-image">
            ${
              image
                ? `<img src="${image}" alt="${name}" loading="lazy"
                     onerror="this.style.display='none'">`
                : '<div class="product-placeholder">✏️</div>'
            }

            <button
              type="button"
              class="wishlist-btn ${isWishlisted ? "active" : ""}"
              onclick="toggleWishlist('${id}')"
              aria-label="Toggle wishlist"
            >
              ${isWishlisted ? "♥" : "♡"}
            </button>
          </div>

          <div class="product-info">
            <span class="product-category">${category}</span>
            <h3>${name}</h3>
            <p>${description}</p>

            <div class="product-price">₹${price.toFixed(2)}</div>

            <p class="stock-status">
              ${stock > 0 ? `${stock} available` : "Out of stock"}
            </p>

            <button
              type="button"
              class="add-to-cart-btn"
              onclick="addToCart('${id}')"
              ${stock <= 0 ? "disabled" : ""}
            >
              ${stock > 0 ? "Add to Cart" : "Out of Stock"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

// ==========================================
// CATEGORY FILTER
// ==========================================

function populateCategories() {
  if (!categoryFilter) return;

  const currentValue = categoryFilter.value || "all";

  const categories = [
    ...new Set(
      products
        .map((product) => String(product.category || "").trim())
        .filter(Boolean)
    )
  ];

  categoryFilter.innerHTML =
    '<option value="all">All Categories</option>' +
    categories
      .map((category) => `
        <option value="${escapeHTML(category)}">
          ${escapeHTML(category)}
        </option>
      `)
      .join("");

  if (
    [...categoryFilter.options].some(
      (option) => option.value === currentValue
    )
  ) {
    categoryFilter.value = currentValue;
  }

  activeCategory = categoryFilter.value || "all";
  renderProducts();
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    searchText = event.target.value.trim().toLowerCase();
    renderProducts();
  });
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", (event) => {
    activeCategory = event.target.value || "all";
    renderProducts();
  });
}

// ==========================================
// ADD TO CART
// ==========================================

function addToCart(productId) {
  const product = products.find(
    (item) => String(item._id || item.id) === String(productId)
  );

  if (!product) {
    alert("Product nahi mila. Products reload karke try karo.");
    return;
  }

  const existingItem = cart.find(
    (item) => String(item.id) === String(productId)
  );

  const currentQuantity = existingItem
    ? Number(existingItem.quantity)
    : 0;

  const stock = Number(product.stock) || 0;

  if (currentQuantity >= stock) {
    alert("Available stock se zyada quantity add nahi kar sakte.");
    return;
  }

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: String(productId),
      name: product.name,
      price: Number(product.price) || 0,
      image: safeImageURL(product.image),
      quantity: 1
    });
  }

  saveCart();
  alert(`${product.name} cart mein add ho gaya!`);
}

// ==========================================
// REMOVE FROM CART
// ==========================================

function removeFromCart(productId) {
  cart = cart.filter(
    (item) => String(item.id) !== String(productId)
  );
  saveCart();
}

// ==========================================
// CHANGE QUANTITY
// ==========================================

function changeCartQuantity(productId, change) {
  const item = cart.find(
    (product) => String(product.id) === String(productId)
  );

  if (!item) return;

  const product = products.find(
    (product) => String(product._id || product.id) === String(productId)
  );

  const maxStock = product ? Number(product.stock) || 0 : 0;
  const newQuantity = Number(item.quantity) + Number(change);

  if (newQuantity <= 0) {
    removeFromCart(productId);
    return;
  }

  if (newQuantity > maxStock) {
    alert("Available stock se zyada quantity nahi hai.");
    return;
  }

  item.quantity = newQuantity;
  saveCart();
}

// ==========================================
// UPDATE CART UI
// ==========================================

function updateCartUI() {
  cart = cart.filter(
    (item) => item && item.id && Number(item.quantity) > 0
  );

  const totalQuantity = cart.reduce(
    (total, item) => total + Number(item.quantity),
    0
  );

  const totalPrice = cart.reduce(
    (total, item) =>
      total + (Number(item.price) || 0) * Number(item.quantity),
    0
  );

  if (cartCountElement) {
    cartCountElement.textContent = totalQuantity;
  }

  if (cartTotalElement) {
    cartTotalElement.textContent = `₹${totalPrice.toFixed(2)}`;
  }

  if (cartItemsContainer) {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = "<p>Your cart is empty.</p>";
    } else {
      cartItemsContainer.innerHTML = cart
        .map((item) => `
          <div class="cart-item">
            <div>
              <strong>${escapeHTML(item.name)}</strong>
              <p>₹${(Number(item.price) || 0).toFixed(2)} each</p>
            </div>

            <div class="cart-item-actions">
              <button type="button"
                onclick="changeCartQuantity('${escapeHTML(item.id)}', -1)">−</button>

              <span>${Number(item.quantity)}</span>

              <button type="button"
                onclick="changeCartQuantity('${escapeHTML(item.id)}', 1)">+</button>

              <button type="button"
                onclick="removeFromCart('${escapeHTML(item.id)}')">Remove</button>
            </div>
          </div>
        `)
        .join("");
    }
  }

  updateCheckoutSummary();
}

// ==========================================
// WISHLIST
// ==========================================

function toggleWishlist(productId) {
  const id = String(productId);

  if (wishlist.includes(id)) {
    wishlist = wishlist.filter((item) => item !== id);
  } else {
    wishlist.push(id);
  }

  saveWishlist();
  renderProducts();
}

function updateWishlistUI() {
  if (wishlistCountElement) {
    wishlistCountElement.textContent = wishlist.length;
  }
}

// ==========================================
// CHECKOUT MODAL
// ==========================================

function ensureCheckoutModal() {
  let modal = document.getElementById("stationeryhubCheckoutModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "stationeryhubCheckoutModal";
  modal.className = "checkout-modal";

  modal.innerHTML = `
    <div class="checkout-modal__panel"
      role="dialog" aria-modal="true"
      aria-labelledby="stationeryhubCheckoutTitle">

      <button type="button" class="checkout-modal__close"
        id="closeCheckout" aria-label="Close checkout">×</button>

      <h2 id="stationeryhubCheckoutTitle">Complete Your Order</h2>
      <p class="checkout-modal__hint">Apni delivery details enter karein.</p>

      <form id="stationeryhubCheckoutForm">
        <label for="checkoutCustomerName">Full name</label>
        <input id="checkoutCustomerName" name="customerName"
          type="text" autocomplete="name" maxlength="100" required>

        <label for="checkoutMobile">Mobile number</label>
        <input id="checkoutMobile" name="mobile"
          type="tel" autocomplete="tel" inputmode="tel"
          pattern="[0-9+() -]{10,16}" maxlength="16" required>

        <label for="checkoutAddress">Delivery address</label>
        <textarea id="checkoutAddress" name="address"
          rows="3" autocomplete="street-address"
          maxlength="500" required></textarea>

        <div class="checkout-modal__summary"
          id="checkoutOrderSummary"></div>

        <button type="submit" class="checkout-submit-btn"
          id="checkoutSubmitButton">Place Order</button>

        <p class="checkout-modal__message"
          id="checkoutMessage" role="status"></p>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const style = document.createElement("style");

  style.textContent = `
    .checkout-modal {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(15, 23, 42, .62);
      display: flex; align-items: center; justify-content: center;
      padding: 18px; overflow: auto;
    }
    .checkout-modal__panel {
      position: relative; background: #fff; color: #172033;
      width: min(100%, 480px); max-height: 92vh; overflow: auto;
      padding: 28px; border-radius: 18px;
      box-shadow: 0 20px 70px #0003;
    }
    .checkout-modal__panel h2 { margin: 0 35px 8px 0; }
    .checkout-modal__hint { color: #64748b; margin: 0 0 18px; }
    .checkout-modal__close {
      position: absolute; right: 16px; top: 12px;
      border: 0; background: transparent; font-size: 30px;
      cursor: pointer; color: #475569;
    }
    #stationeryhubCheckoutForm { display: grid; gap: 9px; }
    #stationeryhubCheckoutForm label { font-weight: 600; margin-top: 5px; }
    #stationeryhubCheckoutForm input,
    #stationeryhubCheckoutForm textarea {
      box-sizing: border-box; width: 100%; padding: 11px 12px;
      border: 1px solid #cbd5e1; border-radius: 9px; font: inherit;
    }
    .checkout-modal__summary {
      background: #f8fafc; border-radius: 10px;
      padding: 13px; margin-top: 8px;
    }
    .checkout-submit-btn {
      border: 0; border-radius: 10px; padding: 13px;
      background: #e85d35; color: white; font-weight: 700;
      font-size: 16px; cursor: pointer;
    }
    .checkout-submit-btn:disabled { opacity: .6; cursor: wait; }
    .checkout-modal__message { margin: 0; overflow-wrap: anywhere; }
    @media (max-width: 480px) {
      .checkout-modal__panel { padding: 22px 18px; }
    }
  `;

  document.head.appendChild(style);

  document.getElementById("closeCheckout")
    .addEventListener("click", closeCheckout);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeCheckout();
  });

  document.getElementById("stationeryhubCheckoutForm")
    .addEventListener("submit", handleCheckoutSubmit);

  return modal;
}

// ==========================================
// OPEN CHECKOUT
// ==========================================

function checkout() {
  if (cart.length === 0) {
    alert("Checkout se pehle cart mein products add karo.");
    return;
  }

  const modal = ensureCheckoutModal();

  updateCheckoutSummary();
  modal.style.display = "flex";

  const message = document.getElementById("checkoutMessage");
  if (message) message.textContent = "";

  document.getElementById("checkoutCustomerName").focus();
}

function closeCheckout() {
  const modal = document.getElementById("stationeryhubCheckoutModal");

  if (modal && !isPlacingOrder) {
    modal.style.display = "none";
  }
}

function updateCheckoutSummary() {
  const summary = document.getElementById("checkoutOrderSummary");
  if (!summary) return;

  const total = cart.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * Number(item.quantity),
    0
  );

  const quantity = cart.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  summary.innerHTML = `
    <strong>Order summary</strong>
    <p>${quantity} item(s)</p>
    <strong>Total: ₹${total.toFixed(2)}</strong>
  `;
}

// ==========================================
// PLACE ORDER
// ==========================================

async function handleCheckoutSubmit(event) {
  event.preventDefault();

  if (isPlacingOrder) return;

  if (cart.length === 0) {
    showCheckoutMessage("Cart empty hai. Pehle products add karo.");
    return;
  }

  const token = getCustomerToken();

  if (!token) {
    showCheckoutMessage("Please login before placing your order.");

    setTimeout(redirectToLogin, 800);
    return;
  }

  const form = event.currentTarget;

  const customerName = form.elements.customerName.value.trim();
  const mobile = form.elements.mobile.value.trim();
  const address = form.elements.address.value.trim();

  if (!customerName || !mobile || !address) {
    showCheckoutMessage("Saari details fill karna zaroori hai.");
    return;
  }

  const submitButton = document.getElementById("checkoutSubmitButton");

  isPlacingOrder = true;
  submitButton.disabled = true;
  submitButton.textContent = "Placing order...";

  try {
    const items = cart.map((item) => ({
      productId: item.id,
      quantity: Number(item.quantity)
    }));

    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers: getCustomerHeaders(),
      body: JSON.stringify({
        customerName,
        mobile,
        address,
        items
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);

      showCheckoutMessage("Login session expired. Please login again.");
      setTimeout(redirectToLogin, 1000);
      return;
    }

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || `Order failed (${response.status})`
      );
    }

    const savedOrder = data.order || data;
    const orderId = savedOrder._id || savedOrder.orderId || "created";

    cart = [];
    saveCart();
    form.reset();

    showCheckoutMessage(
      `Order placed successfully! Order ID: ${orderId}`,
      true
    );

    alert(`Order placed successfully!\nOrder ID: ${orderId}`);

    await loadProductsFromBackend();

    setTimeout(() => {
      const modal = document.getElementById("stationeryhubCheckoutModal");
      if (modal) modal.style.display = "none";

      window.location.href = "my-orders.html";
    }, 1200);

  } catch (error) {
    console.error("Order error:", error);

    showCheckoutMessage(
      `${error.message}. Backend aur /api/orders route check karein.`
    );
  } finally {
    isPlacingOrder = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Place Order";
    }
  }
}

function showCheckoutMessage(message, success = false) {
  const element = document.getElementById("checkoutMessage");
  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#15803d" : "#b91c1c";
}

// ==========================================
// OPTIONAL PLACE ORDER HELPER
// ==========================================

async function placeOrder(
  customerName,
  mobile,
  address,
  cartItems = cart
) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error("Cart empty hai. Pehle products add karo.");
  }

  const items = cartItems.map((item) => ({
    productId: item.id || item._id || item.productId,
    quantity: Number(item.quantity)
  }));

  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: getCustomerHeaders(),
    body: JSON.stringify({
      customerName,
      mobile,
      address,
      items
    })
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
    throw new Error("Login session expired. Please login again.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Order place nahi ho paya.");
  }

  return data.order || data;
}

// ==========================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ==========================================

window.loadProductsFromBackend = loadProductsFromBackend;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeCartQuantity = changeCartQuantity;
window.toggleWishlist = toggleWishlist;
window.checkout = checkout;
window.placeOrder = placeOrder;

// ==========================================
// INITIALISE WEBSITE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  updateCartUI();
  updateWishlistUI();
  loadProductsFromBackend();
});
