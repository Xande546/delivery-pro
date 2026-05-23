/*
 * Delivery Lanchonete Pro - Fase 1 (Cliente)
 * Este script implementa a lógica de carregamento de categorias, produtos,
 * busca instantânea, carrinho lateral, checkout visual com seleção entre
 * retirada e entrega, e envio de pedidos através do endpoint existente.
 *
 * Importante: Não altera endpoints backend; usa apenas
 *   - GET  /api/categories
 *   - GET  /api/products
 *   - POST /api/order
 */

(() => {
  // Helpers for currency and DOM
  const formatPrice = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  // DOM references
  const categoriesContainer = document.getElementById('categories-container');
  const productsContainer = document.getElementById('products-container');
  const searchInput = document.getElementById('search-input');
  const cartToggleBtn = document.getElementById('cart-toggle');
  const cartPanel = document.getElementById('cart-panel');
  const cartItemsDiv = document.getElementById('cart-items');
  const cartCountSpan = document.getElementById('cart-count');
  const cartTotalSpan = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('checkout-btn');
  const overlay = document.getElementById('overlay');
  const closeCartBtn = document.getElementById('close-cart');
  const checkoutModal = document.getElementById('checkout-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const checkoutForm = document.getElementById('checkout-form');
  const addressGroup = document.getElementById('address-group');

  // State variables
  let categories = [];
  let allProducts = [];
  let filteredCategoryId = null;
  let cart = [];

  // Initialize the app
  function init() {
    attachEventListeners();
    loadData();
  }

  function attachEventListeners() {
    // Search filtering
    searchInput.addEventListener('input', () => {
      renderProducts();
    });

    // Open cart
    cartToggleBtn.addEventListener('click', () => {
      openCartPanel();
    });

    // Close cart
    closeCartBtn.addEventListener('click', () => {
      closeCartPanel();
    });

    // Overlay click closes cart and modal
    overlay.addEventListener('click', () => {
      closeCartPanel();
      closeCheckoutModal();
    });

    // Checkout button
    checkoutBtn.addEventListener('click', () => {
      openCheckoutModal();
    });

    // Close modal
    closeModalBtn.addEventListener('click', () => {
      closeCheckoutModal();
    });

    // Delivery option toggle show/hide address
    checkoutForm.addEventListener('change', (e) => {
      if (e.target.name === 'delivery-option') {
        const value = e.target.value;
        if (value === 'entrega') {
          addressGroup.classList.remove('hidden');
          addressGroup.querySelector('textarea').setAttribute('required', 'required');
        } else {
          addressGroup.classList.add('hidden');
          addressGroup.querySelector('textarea').removeAttribute('required');
        }
      }
    });

    // Submit checkout form
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitOrder();
    });
  }

  /**
   * Load categories and products from API with skeleton placeholders
   */
  async function loadData() {
    showSkeletons();
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/products'),
      ]);
      if (!catRes.ok || !prodRes.ok) {
        throw new Error('Erro ao carregar dados');
      }
      categories = await catRes.json();
      allProducts = await prodRes.json();
    } catch (err) {
      console.error(err);
      categories = [];
      allProducts = [];
    } finally {
      hideSkeletons();
      renderCategories();
      renderProducts();
    }
  }

  /**
   * Display simple skeleton loading placeholders for products and categories
   */
  function showSkeletons() {
    categoriesContainer.innerHTML = '';
    productsContainer.innerHTML = '';
    // categories skeleton
    for (let i = 0; i < 4; i++) {
      const skelCat = document.createElement('div');
      skelCat.className = 'category-card skeleton';
      skelCat.style.height = '60px';
      categoriesContainer.appendChild(skelCat);
    }
    // products skeleton
    for (let i = 0; i < 8; i++) {
      const skelProd = document.createElement('div');
      skelProd.className = 'product-card skeleton';
      skelProd.style.height = '220px';
      productsContainer.appendChild(skelProd);
    }
  }

  function hideSkeletons() {
    categoriesContainer.innerHTML = '';
    productsContainer.innerHTML = '';
  }

  /**
   * Render categories horizontally
   */
  function renderCategories() {
    categoriesContainer.innerHTML = '';
    // Default "All" category
    const allCat = document.createElement('div');
    allCat.className = 'category-card';
    allCat.textContent = 'Todos';
    allCat.addEventListener('click', () => {
      filteredCategoryId = null;
      renderProducts();
      highlightActiveCategory(allCat);
    });
    categoriesContainer.appendChild(allCat);
    categories.forEach((cat) => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.id = cat.id;
      // optional icon or image if property exists
      if (cat.image_url) {
        const img = document.createElement('img');
        img.src = cat.image_url;
        img.alt = cat.name;
        card.appendChild(img);
      }
      const span = document.createElement('span');
      span.textContent = cat.name;
      card.appendChild(span);
      card.addEventListener('click', () => {
        filteredCategoryId = cat.id;
        renderProducts();
        highlightActiveCategory(card);
      });
      categoriesContainer.appendChild(card);
    });
  }

  function highlightActiveCategory(selectedCard) {
    const cards = categoriesContainer.querySelectorAll('.category-card');
    cards.forEach((card) => {
      if (card === selectedCard) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  /**
   * Render products grid based on selected category and search term
   */
  function renderProducts() {
    productsContainer.innerHTML = '';
    let filtered = allProducts;
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (filteredCategoryId) {
      filtered = filtered.filter((prod) => prod.category_id === filteredCategoryId);
    }
    if (searchTerm) {
      filtered = filtered.filter((prod) => prod.name.toLowerCase().includes(searchTerm));
    }
    if (filtered.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'Nenhum produto encontrado.';
      emptyMsg.style.margin = '1rem';
      productsContainer.appendChild(emptyMsg);
      return;
    }
    filtered.forEach((prod) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      // image
      const img = document.createElement('img');
      img.className = 'product-image';
      img.src = prod.image_url || 'https://via.placeholder.com/300x200.png?text=Imagem';
      img.alt = prod.name;
      card.appendChild(img);
      // content
      const content = document.createElement('div');
      content.className = 'product-content';
      const title = document.createElement('div');
      title.className = 'product-title';
      title.textContent = prod.name;
      const desc = document.createElement('div');
      desc.className = 'product-desc';
      desc.textContent = prod.description || '';
      const price = document.createElement('div');
      price.className = 'product-price';
      price.textContent = formatPrice(prod.price);
      const btn = document.createElement('button');
      btn.className = 'add-btn';
      btn.textContent = 'Adicionar';
      btn.addEventListener('click', () => {
        addToCart(prod);
      });
      content.appendChild(title);
      content.appendChild(desc);
      content.appendChild(price);
      content.appendChild(btn);
      card.appendChild(content);
      productsContainer.appendChild(card);
    });
  }

  /**
   * Add product to cart
   */
  function addToCart(product) {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
    }
    updateCartUI();
  }

  function updateCartUI() {
    cartItemsDiv.innerHTML = '';
    let total = 0;
    cart.forEach((item) => {
      total += item.price * item.qty;
      const itemDiv = document.createElement('div');
      itemDiv.className = 'cart-item';
      // info
      const infoDiv = document.createElement('div');
      infoDiv.className = 'cart-item-info';
      const title = document.createElement('div');
      title.className = 'cart-item-title';
      title.textContent = item.name;
      infoDiv.appendChild(title);
      const qtyDiv = document.createElement('div');
      qtyDiv.className = 'cart-item-qty';
      const minusBtn = document.createElement('button');
      minusBtn.className = 'qty-btn';
      minusBtn.textContent = '-';
      minusBtn.addEventListener('click', () => {
        changeQty(item.id, -1);
      });
      const qtySpan = document.createElement('span');
      qtySpan.textContent = item.qty;
      const plusBtn = document.createElement('button');
      plusBtn.className = 'qty-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        changeQty(item.id, 1);
      });
      qtyDiv.appendChild(minusBtn);
      qtyDiv.appendChild(qtySpan);
      qtyDiv.appendChild(plusBtn);
      infoDiv.appendChild(qtyDiv);
      itemDiv.appendChild(infoDiv);
      // price line item
      const priceDiv = document.createElement('div');
      priceDiv.textContent = formatPrice(item.price * item.qty);
      itemDiv.appendChild(priceDiv);
      cartItemsDiv.appendChild(itemDiv);
    });
    cartCountSpan.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
    cartTotalSpan.textContent = formatPrice(total);
    // if cart empty, hide checkout button
    checkoutBtn.style.display = cart.length > 0 ? 'block' : 'none';
  }

  function changeQty(productId, delta) {
    const idx = cart.findIndex((item) => item.id === productId);
    if (idx >= 0) {
      cart[idx].qty += delta;
      if (cart[idx].qty <= 0) {
        cart.splice(idx, 1);
      }
      updateCartUI();
    }
  }

  function openCartPanel() {
    cartPanel.classList.add('visible');
    overlay.classList.add('visible');
    overlay.classList.remove('hidden');
    cartPanel.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeCartPanel() {
    cartPanel.classList.remove('visible');
    overlay.classList.remove('visible');
    setTimeout(() => {
      if (!checkoutModal.classList.contains('visible')) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
      }
    }, 300);
    cartPanel.setAttribute('aria-hidden', 'true');
  }

  function openCheckoutModal() {
    if (cart.length === 0) {
      alert('Adicione produtos ao carrinho para continuar.');
      return;
    }
    checkoutModal.classList.add('visible');
    overlay.classList.add('visible');
    overlay.classList.remove('hidden');
    checkoutModal.setAttribute('aria-hidden', 'false');
  }

  function closeCheckoutModal() {
    checkoutModal.classList.remove('visible');
    setTimeout(() => {
      if (!cartPanel.classList.contains('visible')) {
        overlay.classList.remove('visible');
        overlay.classList.add('hidden');
      }
    }, 300);
    checkoutModal.setAttribute('aria-hidden', 'true');
  }

  async function submitOrder() {
    const formData = new FormData(checkoutForm);
    const name = formData.get('customer-name').trim();
    const phone = formData.get('customer-phone').trim();
    const deliveryOption = formData.get('delivery-option');
    const address = formData.get('customer-address').trim();
    const paymentMethod = formData.get('payment-method');
    if (!name || !phone || cart.length === 0) {
      alert('Preencha todos os campos obrigatórios e adicione produtos.');
      return;
    }
    if (deliveryOption === 'entrega' && !address) {
      alert('Informe o endereço para entrega.');
      return;
    }
    // Build order payload
    const payload = {
      customer_name: name,
      phone: phone,
      address: deliveryOption === 'entrega' ? address : '',
      delivery_option: deliveryOption,
      payment_method: paymentMethod,
      items: cart.map((item) => ({ product_id: item.id, quantity: item.qty })),
    };
    // Disable button to avoid double submit
    const submitBtn = checkoutForm.querySelector('.submit-order-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Erro ao enviar pedido');
      }
      // Success
      alert('Pedido enviado com sucesso!');
      cart = [];
      updateCartUI();
      checkoutForm.reset();
      addressGroup.classList.add('hidden');
      closeCheckoutModal();
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao enviar o pedido.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Pedido';
    }
  }

  // Start application
  document.addEventListener('DOMContentLoaded', init);
})();