const $=(s)=>document.querySelector(s);
const $$=(s)=>Array.from(document.querySelectorAll(s));
const money=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const STORAGE_KEY='delivery_pro_cart_azul_v1';

let state={
  products:[],
  categories:[],
  cart:JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'),
  category:'Todos',
  deliveryType:'retirada'
};

function toast(msg){
  const el=$('#toast');
  if(!el){ alert(msg); return; }
  el.textContent=msg;
  el.classList.add('open');
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>el.classList.remove('open'),2800);
}

async function requestJSON(url,opt={}){
  const res=await fetch(url,{
    ...opt,
    headers:{'Content-Type':'application/json',...(opt.headers||{})}
  });
  if(!res.ok){
    const txt=await res.text().catch(()=>'');
    throw new Error(`${res.status} ${url} ${txt}`);
  }
  return res.json().catch(()=>({}));
}

function escapeHtml(v=''){
  return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function escapeAttr(v=''){ return escapeHtml(v).replaceAll('`','&#096;'); }

function normProduct(p){
  return {
    id:p.id,
    name:p.name||p.title||p.nome||'Produto',
    description:p.description||p.descricao||'Produto especial da casa.',
    price:Number(p.price||p.preco||p.valor||0),
    category:p.category_name||p.category||p.categoria||(p.category_obj&&p.category_obj.name)||'Outros',
    category_id:p.category_id||p.categoria_id||null,
    image_url:p.image_url||p.image||p.foto||p.photo_url||'',
    active:p.active
  };
}

function img(p){
  const u=p.image_url||'';
  if(!u) return '';
  if(u.startsWith('http')||u.startsWith('/')||u.startsWith('data:')) return u;
  return `/static/uploads/${u}`;
}

async function loadCategories(){
  try{
    const raw=await requestJSON('/api/categories');
    state.categories=Array.isArray(raw)?raw:(raw.categories||raw.data||[]);
  }catch(e){
    console.warn('Falha ao carregar categorias',e);
    state.categories=[];
  }
}

async function loadProducts(){
  renderProductSkeleton();
  try{
    const raw=await requestJSON('/api/products');
    const arr=Array.isArray(raw)?raw:(raw.products||raw.data||raw.results||[]);
    state.products=arr.map(normProduct).filter(p=>p.active!==false);
  }catch(e){
    console.error(e);
    state.products=[];
    toast('Não consegui carregar produtos em /api/products.');
  }
  renderCats();
  renderStore();
}

function renderProductSkeleton(){
  const grid=$('#productGrid');
  if(!grid) return;
  grid.innerHTML=Array.from({length:6}).map(()=>`
    <article class="product-card">
      <div class="p-img skeleton"></div>
      <div class="p-info">
        <div class="skeleton" style="height:24px;border-radius:10px;margin-bottom:10px"></div>
        <div class="skeleton" style="height:44px;border-radius:10px;margin-bottom:18px"></div>
        <div class="skeleton" style="height:44px;border-radius:14px"></div>
      </div>
    </article>
  `).join('');
}

function renderCats(){
  const el=$('#categoryList');
  if(!el) return;
  const fromProducts=[...new Set(state.products.map(p=>p.category).filter(Boolean))];
  const fromApi=state.categories.map(c=>c.name||c.nome).filter(Boolean);
  const cats=['Todos',...new Set([...fromApi,...fromProducts])];
  el.innerHTML=cats.map(c=>`<button class="cat ${c===state.category?'active':''}" data-c="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join('');
  $$('.cat').forEach(b=>b.onclick=()=>{
    state.category=b.dataset.c;
    renderCats();
    renderStore();
  });
}

function renderStore(){
  const grid=$('#productGrid');
  if(!grid) return;
  const q=($('#searchInput')?.value||'').trim().toLowerCase();
  const list=state.products.filter(p=>{
    const matchCat=state.category==='Todos'||p.category===state.category;
    const matchSearch=`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q);
    return matchCat&&matchSearch;
  });

  const counter=$('#productCounter');
  if(counter) counter.textContent=`${list.length} ${list.length===1?'item':'itens'}`;

  grid.innerHTML=list.map(p=>`
    <article class="product-card">
      <div class="p-img" ${img(p)?`style="background-image:url('${escapeAttr(img(p))}')"`:''}>${img(p)?'':'🍔'}</div>
      <div class="p-info">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description||'Produto especial da casa.')}</p>
        <div class="price-row">
          <b class="price">${money(p.price)}</b>
          <button class="btn primary" type="button" onclick="addCart('${String(p.id).replaceAll("'","\\'")}')">Adicionar</button>
        </div>
      </div>
    </article>
  `).join('') || `<div class="empty-card"><h3>Nenhum produto encontrado</h3><p>Teste outra busca ou categoria.</p></div>`;
}

window.addCart=(id)=>{
  const p=state.products.find(x=>String(x.id)===String(id));
  if(!p) return;
  const i=state.cart.find(x=>String(x.id)===String(id));
  if(i) i.qty++;
  else state.cart.push({...p,qty:1});
  saveCart();
  toast('Produto adicionado ao carrinho');
};

window.changeQty=(id,delta)=>{
  const i=state.cart.find(x=>String(x.id)===String(id));
  if(!i) return;
  i.qty+=delta;
  if(i.qty<=0) state.cart=state.cart.filter(x=>String(x.id)!==String(id));
  saveCart();
};

function saveCart(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state.cart));
  renderCart();
}

function renderCart(){
  const count=state.cart.reduce((s,i)=>s+Number(i.qty||0),0);
  const total=state.cart.reduce((s,i)=>s+(Number(i.price||0)*Number(i.qty||0)),0);
  const countEl=$('#cartCount');
  const totalEl=$('#cartTotal');
  if(countEl) countEl.textContent=count;
  if(totalEl) totalEl.textContent=money(total);

  const box=$('#cartItems');
  if(!box) return;
  box.innerHTML=state.cart.map(i=>`
    <div class="cart-line">
      <div>
        <b>${escapeHtml(i.name)}</b>
        <span class="muted">${money(i.price)} cada</span>
      </div>
      <div class="qty">
        <button type="button" onclick="changeQty('${String(i.id).replaceAll("'","\\'")}',-1)">−</button>
        <strong>${i.qty}</strong>
        <button type="button" onclick="changeQty('${String(i.id).replaceAll("'","\\'")}',1)">+</button>
      </div>
    </div>
  `).join('') || `<div class="empty-card"><h3>Carrinho vazio</h3><p>Adicione um produto para continuar.</p></div>`;
}

function openCart(){
  $('#cartDrawer')?.classList.add('open');
  $('#cartDrawer')?.setAttribute('aria-hidden','false');
  $('#overlay')?.classList.add('open');
}

function closeCart(){
  $('#cartDrawer')?.classList.remove('open');
  $('#cartDrawer')?.setAttribute('aria-hidden','true');
  $('#overlay')?.classList.remove('open');
}

function setupDeliveryChoice(){
  $$('.delivery-option').forEach(btn=>{
    btn.onclick=()=>{
      state.deliveryType=btn.dataset.delivery;
      $$('.delivery-option').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const address=$('#customerAddress');
      if(address) address.classList.toggle('hidden',state.deliveryType!=='entrega');
    };
  });
}

async function finishOrder(){
  if(!state.cart.length){ toast('Adicione produtos ao carrinho.'); return; }

  const name=$('#customerName')?.value.trim();
  const phone=$('#customerPhone')?.value.trim();
  const address=$('#customerAddress')?.value.trim();
  const payment=$('#paymentMethod')?.value||'Pix';
  const notes=$('#orderNotes')?.value.trim()||'';

  if(!name){ toast('Informe o nome.'); return; }
  if(!phone){ toast('Informe o telefone.'); return; }
  if(state.deliveryType==='entrega'&&!address){ toast('Informe o endereço para entrega.'); return; }

  const total=state.cart.reduce((s,i)=>s+(Number(i.price||0)*Number(i.qty||0)),0);

  const payload={
    customer_name:name,
    phone:phone,
    address:state.deliveryType==='entrega'?address:'Retirada no balcão',
    delivery_option:state.deliveryType,
    payment_method:payment,
    notes:notes,
    total:total,
    items:state.cart.map(i=>({
      product_id:i.id,
      id:i.id,
      quantity:i.qty,
      qty:i.qty,
      price:i.price,
      unit_price:i.price,
      name:i.name
    }))
  };

  const btn=$('#finishOrderBtn');
  if(btn){ btn.disabled=true; btn.textContent='Enviando pedido...'; }

  try{
    await requestJSON('/api/order',{method:'POST',body:JSON.stringify(payload)});
    state.cart=[];
    saveCart();
    closeCart();
    ['#customerName','#customerPhone','#customerAddress','#orderNotes'].forEach(s=>{
      const el=$(s);
      if(el) el.value='';
    });
    toast('Pedido enviado com sucesso!');
  }catch(e){
    console.error(e);
    toast('Erro ao enviar pedido. Vou precisar ver o log do Render.');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Finalizar pedido'; }
  }
}

function initClient(){
  loadCategories().then(loadProducts);
  renderCart();
  setupDeliveryChoice();

  $('#searchInput')?.addEventListener('input',renderStore);
  $('#clearSearch')?.addEventListener('click',()=>{
    const el=$('#searchInput');
    if(el){el.value='';renderStore();}
  });
  $('#openCartBtn')?.addEventListener('click',openCart);
  $('#heroCartBtn')?.addEventListener('click',openCart);
  $('#closeCartBtn')?.addEventListener('click',closeCart);
  $('#overlay')?.addEventListener('click',closeCart);
  $('#finishOrderBtn')?.addEventListener('click',finishOrder);
}

document.addEventListener('DOMContentLoaded',()=>{
  if($('#productGrid')) initClient();
});


/* =========================
   ADMIN + HORÁRIO BRASIL
   Mantém banco em UTC e mostra America/Sao_Paulo no painel.
   ========================= */

function formatarDataBR(dataUTC){
  if(!dataUTC) return "-";
  const d = new Date(dataUTC);
  if(Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normOrder(o){
  const items = Array.isArray(o.items) ? o.items : (Array.isArray(o.order_items) ? o.order_items : []);
  return {
    id: o.id,
    customer_name: o.customer_name || o.name || o.cliente || "Cliente",
    phone: o.phone || o.telefone || "",
    address: o.address || o.endereco || "",
    delivery_option: o.delivery_option || o.delivery_type || o.tipo_entrega || "",
    payment_method: o.payment_method || o.payment || o.pagamento || "",
    observations: o.observations || o.notes || o.observacao || "",
    status: o.status || "novo",
    total: Number(o.total || o.total_amount || o.amount || 0),
    created_at: o.created_at || o.createdAt || o.date || "",
    items
  };
}

function statusLabel(status){
  const s = String(status || "novo").toLowerCase();
  const map = {
    novo: "Novo",
    pending: "Novo",
    pendente: "Novo",
    preparando: "Preparando",
    preparing: "Preparando",
    pronto: "Pronto",
    ready: "Pronto",
    finalizado: "Finalizado",
    delivered: "Finalizado",
    entregue: "Finalizado",
    cancelado: "Cancelado",
    canceled: "Cancelado"
  };
  return map[s] || status || "Novo";
}

function statusKey(status){
  const s = String(status || "novo").toLowerCase();
  if(["pending","pendente","novo"].includes(s)) return "novo";
  if(["preparing","preparando"].includes(s)) return "preparando";
  if(["ready","pronto"].includes(s)) return "pronto";
  if(["delivered","entregue","finalizado"].includes(s)) return "finalizado";
  if(["canceled","cancelado"].includes(s)) return "cancelado";
  return "novo";
}

async function loadOrdersAdmin(){
  try{
    const raw = await requestJSON("/api/orders");
    const arr = Array.isArray(raw) ? raw : (raw.orders || raw.data || raw.results || []);
    state.orders = arr.map(normOrder);
  }catch(e){
    console.error("Falha ao carregar pedidos", e);
    state.orders = [];
    toast("Não consegui carregar pedidos do admin.");
  }
}

function orderItemsText(order){
  if(!order.items || !order.items.length) return "Sem itens detalhados";
  return order.items.map(item => {
    const name = item.product_name || item.name || item.product?.name || "Produto";
    const qty = item.quantity || item.qty || 1;
    return `${qty}x ${name}`;
  }).join(", ");
}

function orderCard(order){
  return `
    <article class="order-card">
      <div class="order-card-head">
        <strong>#${escapeHtml(order.id)} ${escapeHtml(order.customer_name)}</strong>
        <span>${escapeHtml(statusLabel(order.status))}</span>
      </div>
      <p class="muted">${escapeHtml(orderItemsText(order))}</p>
      <p><b>Telefone:</b> ${escapeHtml(order.phone || "-")}</p>
      <p><b>Entrega:</b> ${escapeHtml(order.delivery_option || "-")}</p>
      <p><b>Endereço:</b> ${escapeHtml(order.address || "-")}</p>
      <p><b>Pagamento:</b> ${escapeHtml(order.payment_method || "-")}</p>
      <p><b>Horário:</b> ${formatarDataBR(order.created_at)}</p>
      <div class="order-footer">
        <strong>${money(order.total)}</strong>
      </div>
    </article>
  `;
}

function renderAdmin(){
  const board = $("#kanbanBoard");
  if(!board) return;

  const orders = state.orders || [];
  const revenue = orders.reduce((s,o)=>s + Number(o.total || 0), 0);
  const pending = orders.filter(o=>statusKey(o.status)==="novo").length;

  const kpiOrders = $("#kpiOrders");
  const kpiRevenue = $("#kpiRevenue");
  const kpiPending = $("#kpiPending");
  const kpiAvg = $("#kpiAvg");

  if(kpiOrders) kpiOrders.textContent = orders.length;
  if(kpiRevenue) kpiRevenue.textContent = money(revenue);
  if(kpiPending) kpiPending.textContent = pending;
  if(kpiAvg) kpiAvg.textContent = money(orders.length ? revenue / orders.length : 0);

  const cols = [
    ["novo", "Novos"],
    ["preparando", "Preparando"],
    ["pronto", "Prontos"],
    ["finalizado", "Finalizados"]
  ];

  board.innerHTML = cols.map(([key,title]) => {
    const list = orders.filter(o=>statusKey(o.status)===key);
    return `
      <section class="kanban-col">
        <h3>${title}</h3>
        ${list.length ? list.map(orderCard).join("") : '<p class="muted">Sem pedidos</p>'}
      </section>
    `;
  }).join("");
}

function renderReport(){
  if(!$("#reportOrders") && !$("#reportRevenue") && !$("#reportList")) return;

  const orders = state.orders || [];
  const revenue = orders.reduce((s,o)=>s + Number(o.total || 0), 0);

  const reportOrders = $("#reportOrders");
  const reportRevenue = $("#reportRevenue");
  const reportBest = $("#reportBest");
  const reportList = $("#reportList");

  if(reportOrders) reportOrders.textContent = orders.length;
  if(reportRevenue) reportRevenue.textContent = money(revenue);

  const products = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const name = item.product_name || item.name || item.product?.name || "Produto";
      const qty = Number(item.quantity || item.qty || 1);
      products[name] = (products[name] || 0) + qty;
    });
  });

  const best = Object.entries(products).sort((a,b)=>b[1]-a[1])[0];
  if(reportBest) reportBest.textContent = best ? `${best[0]} (${best[1]})` : "-";

  if(reportList){
    reportList.innerHTML = orders.map(o => `
      <div class="cart-line">
        <div>
          <b>#${escapeHtml(o.id)} ${escapeHtml(o.customer_name)}</b>
          <span class="muted">${formatarDataBR(o.created_at)}</span>
        </div>
        <strong>${money(o.total)}</strong>
      </div>
    `).join("") || '<p class="muted">Sem pedidos.</p>';
  }
}

async function initAdmin(){
  await loadOrdersAdmin();
  renderAdmin();
  renderReport();

  const refreshBtn = $("#refreshAdminBtn");
  if(refreshBtn && !refreshBtn.dataset.bound){
    refreshBtn.dataset.bound = "1";
    refreshBtn.addEventListener("click", initAdmin);
  }
}

/* Corrige datas UTC já renderizadas em elementos com data-created-at, se existirem */
function convertExistingUtcDates(){
  $$("[data-created-at]").forEach(el=>{
    const raw = el.getAttribute("data-created-at");
    el.textContent = formatarDataBR(raw);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if($("#kanbanBoard") || $("#reportOrders") || $("#reportRevenue") || $("#reportList")){
    initAdmin();
    setInterval(initAdmin, 15000);
  }
  convertExistingUtcDates();
});
