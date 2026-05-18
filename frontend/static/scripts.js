let cart = [];
let productsCache = [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  loadMenu();
  bindFormEvents();
});

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function imgSrc(path) {

  if (!path) return '';

  if (path.startsWith('http')) {
    return path;
  }

  if (path.startsWith('uploads/')) {
    return '/' + path;
  }

  if (path.startsWith('/uploads/')) {
    return path;
  }

  if (path.startsWith('images/')) {
    return '/' + path;
  }

  if (path.startsWith('/images/')) {
    return path;
  }

  return '/images/' + path;
}

async function loadMenu() {

  try {

    const [catRes, prodRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/products')
    ]);

    const categories = await catRes.json();

    productsCache = await prodRes.json();

    renderTabs(categories);

    renderProducts(categories);

  } catch (err) {

    document.getElementById('menu-container').innerHTML =
      '<div class="empty-state">Erro ao carregar cardápio.</div>';
  }
}

function renderTabs(categories) {

  const tabs = document.getElementById('category-tabs');

  tabs.innerHTML =
    `<button class="tab active" data-cat="all">Todos</button>` +
    categories.map(c =>
      `<button class="tab" data-cat="${c.id}">${c.name}</button>`
    ).join('');

  tabs.querySelectorAll('.tab').forEach(btn => {

    btn.addEventListener('click', () => {

      currentCategory = btn.dataset.cat;

      tabs.querySelectorAll('.tab')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');

      renderProducts(categories);
    });
  });
}

function renderProducts(categories) {

  const box = document.getElementById('menu-container');

  const list =
    currentCategory === 'all'
      ? productsCache
      : productsCache.filter(
          p => String(p.category_id) === String(currentCategory)
        );

  if (!list.length) {

    box.innerHTML =
      '<div class="empty-state">Nenhum produto disponível.</div>';

    return;
  }

  box.innerHTML = list.map(p => `

    <article class="product-card">

      <div class="product-image">

        ${
          p.image
            ? `<img
                src="${imgSrc(p.image)}"
                alt="${p.name}"
                style="
                  width:100%;
                  height:100%;
                  object-fit:cover;
                "
              >`
            : emojiForProduct(p.name)
        }

      </div>

      <div class="product-body">

        <h3>${p.name}</h3>

        <p>${p.description || 'Produto da casa'}</p>

        <strong>${money(p.price)}</strong>

        <input
          id="note-${p.id}"
          class="item-note"
          placeholder="Observação: sem cebola, ponto da carne..."
        />

        <button onclick="addToCart(${p.id})">
          Adicionar
        </button>

      </div>

    </article>

  `).join('');
}

function emojiForProduct(name) {

  const n = name.toLowerCase();

  if (n.includes('batata')) return '🍟';

  if (n.includes('suco')) return '🍊';

  if (n.includes('refri') || n.includes('bebida')) return '🥤';

  if (n.includes('combo')) return '🍔🍟';

  return '🍔';
}

function addToCart(productId) {

  const product = productsCache.find(
    p => p.id === productId
  );

  if (!product) return;

  const note =
    document.getElementById(`note-${productId}`)
      ?.value.trim() || '';

  const existing = cart.find(
    i => i.product_id === productId && i.note === note
  );

  if (existing) {

    existing.quantity += 1;

  } else {

    cart.push({
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: 1,
      note
    });
  }

  const noteInput =
    document.getElementById(`note-${productId}`);

  if (noteInput) noteInput.value = '';

  updateCart();
}

function updateCart() {

  const box = document.getElementById('cart-items');

  const count = cart.reduce(
    (acc, i) => acc + i.quantity,
    0
  );

  const total = cart.reduce(
    (acc, i) => acc + i.price * i.quantity,
    0
  );

  document.getElementById('cart-count').textContent =
    `${count} ${count === 1 ? 'item' : 'itens'}`;

  document.getElementById('cart-total').textContent =
    `Total: ${money(total)}`;

  if (!cart.length) {

    box.className = 'cart-items empty';

    box.textContent = 'Nenhum item adicionado.';

    return;
  }

  box.className = 'cart-items';

  box.innerHTML = cart.map((item, index) => `

    <div class="cart-item">

      <div>

        <strong>${item.product_name}</strong>

        ${
          item.note
            ? `<span>Obs: ${item.note}</span>`
            : ''
        }

      </div>

      <div class="qty-control">

        <button onclick="changeQty(${index}, -1)">
          -
        </button>

        <b>${item.quantity}</b>

        <button onclick="changeQty(${index}, 1)">
          +
        </button>

      </div>

      <em>${money(item.price * item.quantity)}</em>

    </div>

  `).join('');
}

function changeQty(index, delta) {

  cart[index].quantity += delta;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  updateCart();
}

function bindFormEvents() {

  const delivery =
    document.getElementById('delivery_option');

  const address =
    document.getElementById('address');

  delivery.addEventListener('change', () => {

    address.style.display =
      delivery.value === 'entrega'
        ? 'block'
        : 'none';
  });

  const payment =
    document.getElementById('payment_method');

  const change =
    document.getElementById('change_amount');

  payment.addEventListener('change', () => {

    change.style.display =
      payment.value === 'dinheiro'
        ? 'block'
        : 'none';
  });

  document
    .getElementById('place-order-btn')
    .addEventListener('click', placeOrder);
}

async function placeOrder() {

  const feedback =
    document.getElementById('order-feedback');

  if (!cart.length) {
    return alert('Adicione pelo menos um item.');
  }

  const data = {

    customer_name:
      document.getElementById('customer_name')
        .value.trim(),

    phone:
      document.getElementById('phone')
        .value.trim(),

    delivery_option:
      document.getElementById('delivery_option')
        .value,

    address:
      document.getElementById('address')
        .value.trim(),

    payment_method:
      document.getElementById('payment_method')
        .value,

    change_amount:
      document.getElementById('change_amount')
        .value || 0,

    observations:
      document.getElementById('observations')
        .value.trim(),

    items: cart.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      note: i.note
    }))
  };

  if (!data.customer_name || !data.phone) {
    return alert('Informe nome e telefone.');
  }

  if (
    data.delivery_option === 'entrega' &&
    !data.address
  ) {
    return alert('Informe o endereço.');
  }

  const resp = await fetch('/api/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  const result = await resp.json();

  if (resp.ok) {

    feedback.innerHTML = `
      <div class="success-msg">
        Pedido enviado com sucesso! Nº ${result.order_id}
      </div>
    `;

    cart = [];

    updateCart();

  } else {

    feedback.innerHTML = `
      <div class="error-msg">
        ${result.error || 'Erro ao enviar pedido.'}
      </div>
    `;
  }
}