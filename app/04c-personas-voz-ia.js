/* ORDEVA · app/04c-personas-voz-ia.js — parte 3 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
/* ---------- Personas en la mesa (cuenta aparte) ---------- */
function personLookupName(t, personId){
  if(!personId) return null;
  const p = (t.people||[]).find(p=>p.id === personId);
  return p ? p.name : null;
}

function personItemsList(personId){
  const t = data.tables[currentTable];
  return (t.items||[]).filter(it => (it.personId||null) === personId);
}
function personPaymentsList(personId){
  const t = data.tables[currentTable];
  return (t.payments||[]).filter(p => (p.personId||null) === personId);
}
function personTotalAmt(personId){
  return personItemsList(personId).reduce((s,it)=> s + it.price*it.qty, 0);
}
function personPaidAmt(personId){
  return personPaymentsList(personId).filter(p=>p.method !== 'debe').reduce((s,p)=> s + p.amount, 0);
}
function personDebtAmt(personId){
  return personPaymentsList(personId).filter(p=>p.method === 'debe').reduce((s,p)=> s + p.amount, 0);
}
function personBalanceAmt(personId){
  // Lo que de verdad le falta: también cuenta lo que pagó por ella la cuenta general (u otra persona).
  const g = mesaEstado(currentTable).grupos.find(x => x.id === personId);
  return g ? g.saldo : Math.max(0, personTotalAmt(personId) - personPaidAmt(personId) - personDebtAmt(personId));
}

function renderPeople(){
  const t = data.tables[currentTable];
  if(!t.people) t.people = [];
  const box = document.getElementById('peopleChips');
  box.innerHTML = '';
  const pn = document.getElementById('personasN');
  if(pn) pn.textContent = t.people.length ? String(t.people.length) : '';
  t.people.forEach(p=>{
    const ge = mesaEstado(currentTable).grupos.find(x => x.id === p.id) || { total: 0, saldo: 0 };
    const bal = ge.saldo, pagado = ge.total > 0 && !ge.saldo;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.title = 'Ver cuenta aparte de ' + p.name;
    const ini = String(p.name || '?').trim().charAt(0).toUpperCase().replace(/[<>&"]/g, '');
    chip.innerHTML = `<i class="pc-av">${ini}</i>${String(p.name).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}${pagado ? ' <small class="chip-ok">✅ pagó</small>' : bal > 0 ? ' <small>debe ' + fmt(bal) + '</small>' : ''}<span class="chip-del" data-id="${invEsc(p.id)}" title="Quitar persona">✕</span>`;
    chip.addEventListener('click', (e)=>{
      if(e.target.classList.contains('chip-del')) return;
      openPersonModal(p.id);
    });
    box.appendChild(chip);
  });
  box.querySelectorAll('.chip-del').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = btn.dataset.id;
      const person = t.people.find(p=>p.id === id);
      if(person && !confirm('¿Quitar a ' + person.name + ' de la mesa? Sus productos pasarán a la cuenta general.')) return;
      (t.items||[]).forEach(it=>{ if(it.personId === id) it.personId = null; });
      (t.payments||[]).forEach(p=>{ if(p.personId === id) p.personId = null; });
      t.people = t.people.filter(p=>p.id !== id);
      saveData();
      renderPeople();
      renderModalItems();
    });
  });
}

// ---------- Accesos rápidos: favoritos con un toque en la mesa ----------
function renderFavChips(){
  const box = document.getElementById('favChips');
  if(!box) return;
  const favs = data.products.filter(p => p.favorite && !p.combo);
  if(!favs.length){ box.innerHTML = ''; return; }
  // Botones (no <span>): así también los alcanza el bloqueo de ventas con la suscripción vencida (#favChips button).
  box.innerHTML = '<span class="fav-lbl" title="Favoritos: un toque agrega 1">⭐</span>' + favs.map(p => '<button type="button" class="fav-chip" data-fav data-id="' + invEsc(p.id) + '">' + invEsc(p.name) + ' <b>' + fmt(p.price) + '</b></button>').join('');
  box.querySelectorAll('.fav-chip').forEach(chip => {
    chip.addEventListener('click', () => addFavoriteToTable(chip.dataset.id));
  });
  requestAnimationFrame(favDesliza);
}
// Favoritos que no caben: el borde derecho se desvanece mientras quede algo por deslizar.
function favDesliza(){
  const box = document.getElementById('favChips'); if(!box) return;
  box.classList.toggle('desliza', box.scrollLeft + box.clientWidth < box.scrollWidth - 4);
}
document.getElementById('favChips').addEventListener('scroll', favDesliza, { passive: true });
function addFavoriteToTable(productId){
  const product = data.products.find(p => p.id === productId);
  const t = data.tables[currentTable];
  if(!product || !t) return;
  const existing = t.items.find(it => it.productId === productId && !it.personId);
  if(existing){
    existing.qty += 1;
    recordItemHistory(existing, 1);
  } else {
    const newItem = { productId, name: product.name, price: product.price, size: product.size || '', qty: 1, personId: null, history: [] };
    recordItemHistory(newItem, 1);
    t.items.push(newItem);
  }
  noteManualChange(currentTable, product.name, 1);
  saveData();
  renderModalItems();
  renderPeople();
  showToast('✅ ' + product.name + ' agregado.');
}

document.getElementById('addPersonBtn').addEventListener('click', ()=>{
  const input = document.getElementById('personNameInput');
  const name = input.value.trim();
  if(!name){ showToast('Escribe el nombre de la persona.'); return; }
  const t = data.tables[currentTable];
  if(!t.people) t.people = [];
  t.people.push({ id: Date.now().toString(), name });
  input.value = '';
  saveData();
  renderPeople();
});
document.getElementById('personNameInput').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('addPersonBtn').click(); }
});
document.getElementById('closeModalBtn').addEventListener('click', ()=>{
  overlay.classList.remove('show');
  currentTable = null;
  renderMesas();
});
overlay.addEventListener('click', (e)=>{ if(e.target === overlay){ overlay.classList.remove('show'); currentTable=null; renderMesas(); } });
// Computador / control remoto: Esc cierra la mesa si no hay otra ventana encima.
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape' || !overlay.classList.contains('show')) return;
  const encima = [...document.querySelectorAll('.overlay.show')].some(o => o !== overlay && !overlay.contains(o));
  if(!encima) document.getElementById('closeModalBtn').click();
});
// Computador: con la mesa abierta, escribir cualquier letra va directo al buscador de productos (sin tener que
// hacer clic en él). En el celular no aplica: ahí el teclado solo sale al tocar el buscador.
document.addEventListener('keydown', e => {
  if(!overlay.classList.contains('show') || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if(!e.key || e.key.length !== 1 || !/\S/.test(e.key)) return;
  const a = document.activeElement;
  if(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
  if([...document.querySelectorAll('.overlay.show')].some(o => o !== overlay && !overlay.contains(o))) return;
  try{ if(!matchMedia('(hover:hover) and (pointer:fine)').matches) return; }catch(err){ return; }
  const s = document.getElementById('addProductSearch');
  if(!s || s.disabled || !s.offsetParent) return;
  s.focus({ preventScroll: false });   // la letra cae en el buscador (y se ven las sugerencias)
});

function refreshProductSelect(){
  const searchInput = document.getElementById('addProductSearch');
  const idInput = document.getElementById('addProductId');
  searchInput.value = '';
  idInput.value = '';
  hideProductSuggestions();
  if(data.products.length === 0){
    searchInput.placeholder = 'Agrega productos primero';
    searchInput.disabled = true;
  } else {
    searchInput.placeholder = 'Buscar producto…';
    searchInput.disabled = false;
  }
}

function hideProductSuggestions(){
  const box = document.getElementById('addProductSuggestions');
  box.classList.remove('show');
  box.innerHTML = '';
}

function productSizeLabel(productOrItem){
  if(!productOrItem) return '';
  if(productOrItem.size) return String(productOrItem.size).trim();
  if(productOrItem.productId){
    const p = data.products.find(x=>x.id === productOrItem.productId);
    if(p && p.size) return String(p.size).trim();
  }
  return '';
}

function productSizeHtml(productOrItem, className='li-size'){
  const size = productSizeLabel(productOrItem);
  return size ? `<span class="${className}">📦 ${invEsc(size)}</span>` : '';
}

function productSuggestionItemHtml(p){
  return `
    <div class="product-suggestion-item" data-id="${invEsc(p.id)}">
      <span class="psi-name">${invEsc(p.name)}${productSizeHtml(p, 'psi-size')}</span>
      <span class="psi-price">${fmt(p.price)}</span>
    </div>
  `;
}

function groupSuggestionsByOrdered(query, orderedItems){
  const q = query.trim().toLowerCase();
  const seen = new Set();
  const orderedIds = [];
  for(let i = orderedItems.length - 1; i >= 0; i--){
    const it = orderedItems[i];
    if(it.productId && !seen.has(it.productId)){
      seen.add(it.productId);
      orderedIds.push(it.productId);
    }
  }
  const orderedProducts = orderedIds.map(id => data.products.find(p=>p.id===id)).filter(Boolean);
  const restProducts = data.products.filter(p => !seen.has(p.id));
  // Sin importar tildes: «agu» encuentra «Águila».
  const sinTilde = s => { s = String(s || '').toLowerCase(); try{ return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(e){ return s; } };
  const qn = sinTilde(q);
  const filterFn = p => !q || sinTilde(p.name).includes(qn);
  return {
    orderedMatches: orderedProducts.filter(filterFn),
    restMatches: restProducts.filter(filterFn)
  };
}

function renderProductSuggestions(query){
  const box = document.getElementById('addProductSuggestions');
  const t = data.tables[currentTable];
  const orderedItems = (t && t.items) ? t.items : [];
  const { orderedMatches, restMatches } = groupSuggestionsByOrdered(query, orderedItems);
  if(orderedMatches.length === 0 && restMatches.length === 0){
    // No hay nada que coincida: si ya escribió algo, ofrece crearlo de una
    // con una foto (IA/código de barras) en vez de solo decir que no hay.
    const q = (query || '').trim();
    box.innerHTML = '<div class="product-suggestion-empty">Sin productos que coincidan</div>' +
      (q ? '<button type="button" class="product-suggestion-photo-btn" id="qpOpenBtn">📷 "' + invEsc(q) + '" no está — tómale una foto para agregarlo</button>' : '');
    box.classList.add('show');
    const qpBtn = document.getElementById('qpOpenBtn');
    if(qpBtn) qpBtn.addEventListener('click', () => openQuickProductOverlay(q));
    return;
  }
  let html = '';
  if(orderedMatches.length){
    html += '<div class="product-suggestion-header">Ya pedido en esta mesa</div>';
    html += orderedMatches.slice(0, 15).map(productSuggestionItemHtml).join('');
  }
  if(restMatches.length){
    if(orderedMatches.length) html += '<div class="product-suggestion-header">Otros productos</div>';
    html += restMatches.slice(0, 30).map(productSuggestionItemHtml).join('');
  }
  box.innerHTML = html;
  box.classList.add('show');
  box.querySelectorAll('.product-suggestion-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const product = data.products.find(p=>p.id === el.dataset.id);
      if(!product) return;
      document.getElementById('addProductSearch').value = product.name;
      document.getElementById('addProductId').value = product.id;
      // Más ágil: al elegir el producto la cantidad queda en 1, así basta con tocar «Agregar».
      const q = document.getElementById('addQty');
      if(q && (parseInt(q.value, 10) || 0) <= 0) q.value = 1;
      hideProductSuggestions();
    });
  });
}

document.getElementById('addProductSearch').addEventListener('input', (e)=>{
  document.getElementById('addProductId').value = '';
  renderProductSuggestions(e.target.value);
});
document.getElementById('addProductSearch').addEventListener('focus', (e)=>{
  e.target.value = '';
  document.getElementById('addProductId').value = '';
  renderProductSuggestions('');
});
// Enter (o «Ir» del teclado del celular): toma el primer producto de la lista y lo agrega de una.
document.getElementById('addProductSearch').addEventListener('keydown', (e)=>{
  if(e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  // Buscador vacío: «Ir» solo cierra el teclado (antes agregaba el primer producto de la lista sin querer).
  if(!document.getElementById('addProductId').value && !e.target.value.trim()){ e.target.blur(); hideProductSuggestions(); return; }
  if(!document.getElementById('addProductId').value){
    const first = document.querySelector('#addProductSuggestions .product-suggestion-item');
    if(!first) return;
    first.click();
  }
  const q = document.getElementById('addQty');
  if((parseInt(q.value, 10) || 0) <= 0) q.value = 1;
  const t = data.tables[currentTable], cuantos = () => ((t && t.items) || []).reduce((s, it) => s + it.qty, 0), antes = cuantos();
  document.getElementById('addItemBtn').click();
  // Agregado: el buscador queda limpio para escribir el siguiente producto.
  if(cuantos() !== antes){ e.target.value = ''; document.getElementById('addProductId').value = ''; hideProductSuggestions(); }
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('.product-search-wrap') || e.target.closest('.mesa-scan')) hideProductSuggestions();
});

function renderModalItems(){
  try{ if(currentTable != null && window.grupoBarPintar) setTimeout(() => window.grupoBarPintar(currentTable), 0); }catch(e){}
  const t = data.tables[currentTable];
  const container = document.getElementById('itemsContainer');
  container.innerHTML = '';
  if(!t.items || t.items.length === 0){
    container.innerHTML = '<div class="empty-note">Todavía no hay productos en esta cuenta.</div>';
  } else {
    const people = t.people || [];
    const est = mesaEstado(currentTable);
    const groups = people.length ? [{ id: null, name: tableLabel(currentTable) + ' (general)' }, ...people] : [{ id: null, name: null }];
    groups.forEach(g=>{
      const groupItems = t.items.filter(it => (it.personId||null) === g.id);
      if(groupItems.length === 0) return;
      if(g.name){
        const subtotal = groupItems.reduce((s,it)=>s+it.price*it.qty,0);
        const ge = est.grupos.find(x => x.id === (g.id || null)), et = mesaEstadoTexto(ge);
        const header = document.createElement('div');
        header.className = 'person-group-title' + (ge && !ge.saldo && ge.total ? ' pg-ok' : '');
        header.innerHTML = `<span>${invEsc(g.name)}</span><span>${fmt(subtotal)}</span>` + (et ? `<small class="pg-est">${invEsc(et)}</small>` : '');
        container.appendChild(header);
      }
      groupItems.forEach(it=>{
        const idx = t.items.indexOf(it);
        const wrap = document.createElement('div');
        wrap.className = 'line-item-wrap';
        const row = document.createElement('div');
        row.className = 'line-item';
        row.innerHTML = `
          <div><span class="li-name">${invEsc(it.name)}</span>${productSizeHtml(it)}${qtyStepperHtml(idx, it.qty)}</div>
          <div class="li-right">
            <span class="li-price">${fmt(it.price*it.qty)}</span>
            <button class="li-clock" data-idx="${idx}" title="Ver horario de pedidos">🕐</button>
            <button class="li-remove" data-idx="${idx}">✕</button>
          </div>
        `;
        const hist = document.createElement('div');
        hist.className = 'li-history';
        hist.innerHTML = itemHistoryHtml(it);
        wrap.appendChild(row);
        wrap.appendChild(hist);
        container.appendChild(wrap);
      });
    });
    container.querySelectorAll('.li-remove').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        const it = t.items[idx];
        if(!it) return;
        const ok = await showConfirm({
          title: '¿Quitar este producto?',
          message: 'Vas a quitar "' + it.name + '" ×' + it.qty + ' (' + fmt(it.price*it.qty) + ') de esta cuenta. Esta acción no se puede deshacer.',
          confirmText: 'Sí, quitar',
          cancelText: 'Cancelar',
          icon: '🗑️'
        });
        if(!ok) return;
        noteManualChange(currentTable, it.name, -it.qty);
        try{ invOnSale(it, -it.qty); }catch(e){}
        t.items.splice(idx,1);
        sonidoPos('remove');
        saveData();
        renderModalItems();
        renderMesas();
      });
    });
    container.querySelectorAll('.li-clock').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const hist = btn.closest('.line-item-wrap').querySelector('.li-history');
        btn.classList.toggle('active');
        hist.classList.toggle('show');
      });
    });
    attachQtyStepperHandlers(container, t, renderModalItems);
    decoratePaidStatus(container, t);
  }
  renderPayments();
  updateSplitAmount();

  const total = tableTotal(currentTable);
  const paid = tablePaid(currentTable);
  const debt = tableDebt(currentTable);
  const balance = tableBalance(currentTable);
  document.getElementById('modalConsumo').textContent = fmt(total);
  document.getElementById('modalPagado').textContent = fmt(paid);
  document.getElementById('modalDebeRow').style.display = debt > 0 ? 'flex' : 'none';
  document.getElementById('modalDebe').textContent = fmt(debt);
  const balanceEl = document.getElementById('modalTotal');
  balanceEl.textContent = fmt(balance);
  balanceEl.classList.toggle('balance-zero', balance === 0 && total > 0);
  balanceEl.classList.toggle('balance-pending', balance > 0);
  document.getElementById('chargeBtn').disabled = !(t.items && t.items.length);
  // Estado en el encabezado y total justo debajo de los productos.
  const unidades = (t.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const sub = document.getElementById('modalSub');
  if(sub) sub.textContent = unidades ? 'Cuenta abierta · ' + unidades + (unidades === 1 ? ' producto' : ' productos') : 'Libre · sin productos todavía';
  const tot = document.getElementById('mesaTotal');
  if(tot){
    tot.hidden = !unidades;
    document.getElementById('mesaTotalN').textContent = paid + debt > 0 ? 'Total · falta ' + fmt(balance) : 'Total';
    document.getElementById('mesaTotalV').textContent = fmt(total);
  }
}

// «👥 Quién pagó»: en una mesa con varias personas, cuánto le toca a cada uno, quién ya pagó y quién pagó por quién.
function renderQuienPago(){
  const t = data.tables[currentTable], cont = document.getElementById('paymentsContainer');
  let box = document.getElementById('mesaQuienPago');
  if(!box){ box = document.createElement('div'); box.id = 'mesaQuienPago'; box.className = 'quien-pago'; cont.parentNode.insertBefore(box, cont); }
  if(!(t.people || []).length || !(t.items || []).length){ box.hidden = true; box.innerHTML = ''; return; }
  const est = mesaEstado(currentTable);
  box.hidden = false;
  box.innerHTML = '<div class="qp-t"><b>👥 Quién pagó</b><span>' + est.pagaron + ' de ' + est.partes + (est.partes === 1 ? ' cuenta pagada' : ' cuentas pagadas') + '</span></div>' +
    est.grupos.filter(g => g.estado !== 'vacio').map(g => '<div class="qp-f qp-' + g.estado + '"' + (g.id ? ' data-qp="' + invEsc(g.id) + '"' : '') + '><i class="pc-av">' + invEsc(String(g.nombre || '?').trim().charAt(0).toUpperCase()) + '</i><span class="qp-n"><b>' + invEsc(g.nombre) + '</b><small>' + invEsc(mesaEstadoTexto(g)) + '</small></span><span class="qp-v">' + fmt(g.total) + '</span></div>').join('');
  box.querySelectorAll('[data-qp]').forEach(f => f.onclick = () => openPersonModal(f.dataset.qp));
}
function renderPayments(){
  const t = data.tables[currentTable];
  if(!t.payments) t.payments = [];
  try{ renderQuienPago(); }catch(e){}
  const container = document.getElementById('paymentsContainer');
  container.innerHTML = '';
  if(t.payments.length === 0){
    container.innerHTML = '<div class="empty-note">Nadie ha abonado todavía.</div>';
    return;
  }
  const methodLabel = { efectivo: 'Efectivo', transferencia: 'Transferencia', debe: 'Debe' };
  t.payments.forEach((p, idx)=>{
    const method = p.method || 'efectivo';
    const row = document.createElement('div');
    row.className = 'line-item payment-item';
    row.innerHTML = `
      <div><span class="li-name">${invEsc(p.note || 'Abono')}</span><span class="pay-method ${method}">${methodLabel[method] || method}</span>${(t.people || []).length ? '<span class="pay-quien">👤 ' + invEsc(personLookupName(t, p.personId) || 'Cuenta general') + '</span>' : ''}${payItemsHtml(p)}</div>
      <div class="li-right">
        <span class="li-price">${fmt(p.amount)}</span>
        <button class="li-remove" data-idx="${idx}">✕</button>
      </div>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll('.li-remove').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.dataset.idx,10);
      delReceipt(t.payments[idx] && t.payments[idx].receiptId);
      t.payments.splice(idx,1);
      saveData();
      renderModalItems();
      try{ renderPeople(); }catch(e){}
    });
  });
}

function updateSplitAmount(){
  const n = Math.max(1, parseInt(document.getElementById('splitCount').value,10) || 1);
  const balance = tableBalance(currentTable);
  document.getElementById('splitAmount').textContent = fmt(balance / n) + ' c/u';
}
document.getElementById('splitCount').addEventListener('input', updateSplitAmount);

// Tarjeta de pago: método con botones (sincronizados con el <select> de siempre) y montos rápidos.
// Entre cuántas personas se divide (el mismo número de «Dividir cuenta» más abajo).
function payDivN(){ return Math.max(2, parseInt((document.getElementById('splitCount') || {}).value, 10) || 2); }
function payDivPintar(){ const n = payDivN(); document.querySelectorAll('.pay-div-n b').forEach(b => { b.textContent = n; }); }
document.addEventListener('input', ev => { if(ev.target && ev.target.id === 'splitCount') payDivPintar(); });
function paySync(){
  try{ payDivPintar(); }catch(e){}
  document.querySelectorAll('.pay-methods[data-sel]').forEach(box => {
    const sel = document.getElementById(box.dataset.sel); if(!sel) return;
    box.querySelectorAll('button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === sel.value));
  });
}
document.addEventListener('click', ev => {
  const m = ev.target.closest('.pay-methods button[data-v]');
  if(m){ const sel = document.getElementById(m.parentElement.dataset.sel); if(sel){ sel.value = m.dataset.v; sel.dispatchEvent(new Event('change', { bubbles: true })); } paySync(); return; }
  const dv = ev.target.closest('.pay-div button[data-dv]');
  if(dv){
    const card = dv.closest('.pay-card'), sc = document.getElementById('splitCount');
    const n = Math.min(50, Math.max(2, payDivN(card) + (+dv.dataset.dv || 0)));
    if(sc){ sc.value = n; sc.dispatchEvent(new Event('input', { bubbles: true })); }
    payDivPintar();
    const b = card.querySelector('[data-q="split"]'); if(b) b.click();   // muestra cuánto le toca a cada uno y lo pone como monto
    return;
  }
  const q = ev.target.closest('.pay-quick button[data-q]');
  if(q){
    const card = q.closest('.pay-card'), persona = card && card.dataset.scope === 'person';
    let saldo = 0;
    try{ saldo = persona ? personBalanceAmt(currentPersonId) : tableBalance(currentTable); }catch(e){}
    saldo = Math.max(0, Math.round(saldo || 0));
    if(!saldo){ showToast('No hay saldo pendiente.'); return; }
    let v = saldo;
    if(q.dataset.q === 'half') v = Math.ceil(saldo / 2 / 100) * 100;
    if(q.dataset.q === 'split'){
      const n = payDivN(card);
      v = Math.ceil(saldo / n / 100) * 100;
      const info = card.querySelector('.pay-div-info');
      if(info){ info.hidden = false; info.innerHTML = '÷ Entre <b>' + n + '</b> personas: <b>' + fmt(v) + '</b> cada una (saldo ' + fmt(saldo) + ').'; }
    } else { const info = card.querySelector('.pay-div-info'); if(info) info.hidden = true; }
    const inp = card.querySelector('input[type=number]'); if(inp){ inp.value = Math.min(v, saldo); inp.focus(); }
    return;
  }
  if(ev.target.closest('#addPaymentBtn, #personAddPaymentBtn')) setTimeout(paySync, 0);
}, true);
document.addEventListener('change', ev => { if(ev.target && /^(paymentMethod|personPaymentMethod)$/.test(ev.target.id)) paySync(); });
setInterval(() => { if(document.querySelector('.overlay.show .pay-card')) paySync(); }, 1500);

document.getElementById('addPaymentBtn').addEventListener('click', ()=>{
  const noteInput = document.getElementById('paymentNote');
  const amountInput = document.getElementById('paymentAmount');
  const methodSelect = document.getElementById('paymentMethod');
  let amount = parseFloat(amountInput.value);
  if((isNaN(amount) || amount <= 0) && methodSelect.value === 'debe'){
    amount = tableBalance(currentTable);
  }
  if(isNaN(amount) || amount <= 0){
    showToast('Escribe un monto válido, o déjalo vacío si toda la cuenta queda debiendo.');
    return;
  }
  const t = data.tables[currentTable];
  if(!t.payments) t.payments = [];
  // «¿Quién paga?» con el nombre de una persona de la mesa: el pago queda a nombre de ella (no de la cuenta general).
  const quien = fiAscii(noteInput.value.trim()).toLowerCase();
  const persona = quien ? (t.people || []).find(x => fiAscii(String(x.name || '')).toLowerCase().trim() === quien) : null;
  t.payments.push({ note: noteInput.value.trim(), amount, method: methodSelect.value, ...(persona ? { personId: persona.id } : {}), ...(payPick.table ? { items: payPick.table } : {}), ...receiptField('table') });
  payPick.table = null; updatePayPickInfo('table');
  noteInput.value = '';
  amountInput.value = '';
  methodSelect.value = 'efectivo';
  saveData();
  renderModalItems();
  try{ renderPeople(); }catch(e){}
});

document.getElementById('addItemBtn').addEventListener('click', ()=>{
  if(data.products.length === 0){ showToast('Primero agrega productos en la pestaña Productos.'); return; }
  const searchInput = document.getElementById('addProductSearch');
  const idInput = document.getElementById('addProductId');
  const qtyInput = document.getElementById('addQty');
  let productId = idInput.value;
  let product = data.products.find(p=>p.id === productId);
  if(!product){
    // no se eligió de la lista: intenta emparejar por nombre exacto (sin importar mayúsculas)
    const typed = searchInput.value.trim().toLowerCase();
    product = data.products.find(p=>p.name.toLowerCase() === typed);
  }
  if(!product){
    showToast('Selecciona un producto de la lista de sugerencias.');
    return;
  }
  productId = product.id;
  const qty = Math.max(0, parseInt(qtyInput.value,10) || 0);
  if(qty <= 0){ showToast('Indica una cantidad mayor que 0.'); return; }
  const t = data.tables[currentTable];
  const existing = t.items.find(it=> it.productId === productId && !it.personId);
  if(existing){
    existing.qty += qty;
    recordItemHistory(existing, qty);
  } else {
    const newItem = { productId, name: product.name, price: product.price, size: product.size || '', qty, personId: null, history: [] };
    recordItemHistory(newItem, qty);
    t.items.push(newItem);
  }
  noteManualChange(currentTable, product.name, qty);
  saveData();
  renderModalItems();
  renderPeople();
  // Reinicia el contador después de cada agregado para evitar arrastrar la cantidad anterior.
  qtyInput.value = 0;
});

document.getElementById('qtyMinusBtn').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('addQty');
  const antes = parseInt(qtyInput.value,10) || 0, val = Math.max(0, antes - 1);
  qtyInput.value = val;
  if(val < antes) sonidoPos('remove');
});
document.getElementById('qtyPlusBtn').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('addQty');
  const val = Math.max(0, (parseInt(qtyInput.value,10) || 0) + 1);
  qtyInput.value = val;
  sonidoPos('add');
});

// ---------- Propina opcional al cobrar (si está activada en Ajustes) ----------
/* Cobrar y liberar con un toque: se elige cómo pagaron TODO el saldo y la mesa queda libre. Antes, si no se
   escribía cuánto pagó cada quien, todo lo no registrado quedaba como deuda al cerrar. */
function askPagoCierre(saldo, etiqueta){
  return new Promise(resolve => {
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:14px';
    o.innerHTML = '<div style="background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:16px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:9px">' +
      '<b style="font-size:17px">💰 Cobrar ' + String(etiqueta).replace(/[&<>"]/g, '') + '</b><small style="color:var(--ink-soft)">Saldo por cobrar: <b style="font-size:15px;color:var(--ink)">' + fmt(saldo) + '</b> · ¿cómo pagaron?</small>' +
      '<button type="button" class="btn-primary" data-m="efectivo" style="padding:14px;font-size:15px">💵 Pagaron todo en efectivo</button>' +
      '<button type="button" class="btn-primary" data-m="transferencia" style="padding:14px;font-size:15px">📲 Pagaron todo por transferencia</button>' +
      '<button type="button" class="btn-ghost" data-m="debe">📝 Queda debiendo ' + fmt(saldo) + '</button>' +
      '<button type="button" class="btn-ghost" data-close="1" style="opacity:.7">Cancelar</button>' +
      '</div>';
    o.addEventListener('click', e => {
      const b = e.target.closest('button[data-m]');
      if(b){ o.remove(); resolve(b.dataset.m); return; }
      if(e.target.closest('[data-close]') || e.target === o){ o.remove(); resolve(null); }
    });
    document.body.appendChild(o);
  });
}
function askTip(baseTotal){
  return new Promise(resolve => {
    const redondeo = Math.ceil(baseTotal / 1000) * 1000 - baseTotal;
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:14px';
    o.innerHTML = '<div style="background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:16px;width:100%;max-width:340px;display:flex;flex-direction:column;gap:8px">' +
      '<b>💵 ¿El cliente deja propina?</b><small style="color:var(--ink-soft)">Total antes de propina: ' + fmt(baseTotal) + '</small>' +
      '<button type="button" class="btn-ghost" data-v="0">Sin propina</button>' +
      '<button type="button" class="btn-ghost" data-v="' + Math.round(baseTotal * 0.10) + '">10% de propina (+' + fmt(Math.round(baseTotal * 0.10)) + ')</button>' +
      (redondeo > 0 ? '<button type="button" class="btn-ghost" data-v="' + redondeo + '">Redondear a ' + fmt(baseTotal + redondeo) + ' (+' + fmt(redondeo) + ')</button>' : '') +
      '<button type="button" class="btn-ghost" data-close="1" style="opacity:.7">Cancelar</button>' +
      '</div>';
    o.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if(b){ o.remove(); resolve(+b.dataset.v); return; }
      if(e.target.closest('[data-close]') || e.target === o){ o.remove(); resolve(null); }
    });
    document.body.appendChild(o);
  });
}
document.getElementById('chargeBtn').addEventListener('click', async ()=>{
  const t = data.tables[currentTable];
  if(!t.items || !t.items.length) return;
  if(data.tipsOn){
    const tip = await askTip(tableBalance(currentTable));
    if(tip === null) return;                       // canceló el paso de la propina, no cierra la mesa
    if(tip > 0){
      t.items.push({ productId: null, name: '🙏 Propina', price: tip, size: '', qty: 1, personId: null, history: [] });
      saveData();
      renderModalItems();
    }
  }
  const saldo = tableBalance(currentTable);
  if(saldo > 0){
    // Un solo paso: cómo pagaron todo el saldo. Se registra ese pago y la mesa se libera sin deuda.
    const metodo = await askPagoCierre(saldo, tableLabel(currentTable));
    if(!metodo) return;
    if(metodo !== 'debe'){
      if(!t.payments) t.payments = [];
      t.payments.push({ note: metodo === 'transferencia' ? 'Pagó todo (transferencia)' : 'Pagó todo (efectivo)', amount: saldo, method: metodo, at: Date.now() });
    }
  } else {
    const ok = await showConfirm({
      title: '¿Cerrar esta cuenta?',
      message: 'La cuenta ya está pagada. Vas a liberar la ' + tableLabel(currentTable) + '.',
      confirmText: 'Sí, liberar mesa',
      icon: '🔒'
    });
    if(!ok) return;
  }
  const loyaltyPhone = data.loyaltyOn ? document.getElementById('loyaltyPhone').value : '';
  const loyaltyName = data.loyaltyOn ? document.getElementById('loyaltyName').value : '';
  const entry = closeTableToHistory(currentTable);
  try{ window.ventoDian && window.ventoDian.alVender(entry); }catch(x){}   // 🧾 a la DIAN (si está prendida)
  if(entry && !(entry.debt > 0)) sonidoPos('success');      // cuenta cobrada completa
  if(loyaltyPhone) registrarVisitaCliente(loyaltyPhone, loyaltyName, entry.total);
  saveData();
  renderLoyaltyClientsList();
  overlay.classList.remove('show');
  currentTable = null;
  renderMesas();
  showToast(entry.debt > 0 ? 'Cuenta cerrada. Queda debiendo ' + fmt(entry.debt) + '.' : 'Cuenta cobrada y mesa liberada.');
});

document.getElementById('settleFullBtn')?.addEventListener('click', async ()=>{
  const t = data.tables[currentTable];
  if(!t) return;
  const balance = tableBalance(currentTable);
  if(balance <= 0){
    showToast('Esta cuenta ya está saldada, no hay saldo pendiente.');
    return;
  }
  const ok = await showConfirm({
    title: '¿Marcar esta cuenta como saldada?',
    message: '⚠️ Esto va a registrar un pago completo de ' + fmt(balance) + ' sin pedirte el monto. Úsalo solo si de verdad ya te pagaron todo. Confirma solo si estás seguro, para no dejar la cuenta mal cuadrada.',
    confirmText: 'Sí, ya me pagaron todo',
    cancelText: 'Cancelar',
    icon: '🧾'
  });
  if(!ok) return;
  if(!t.payments) t.payments = [];
  t.payments.push({ note: 'Pago completo (marcado manual)', amount: balance, method: 'efectivo' });
  saveData();
  renderModalItems();
  showToast('Cuenta marcada como saldada.');
});

/* ---------- Cuenta aparte de cada persona ---------- */
let currentPersonId = null;
const personOverlay = document.getElementById('personOverlay');

function openPersonModal(personId){
  currentPersonId = personId;
  payPick.person = null; pendingReceipt.person = null; updatePayPickInfo('person');
  const t = data.tables[currentTable];
  const person = (t.people||[]).find(p=>p.id === personId);
  document.getElementById('personModalTitle').textContent = person ? person.name : 'Persona';
  document.getElementById('personModalSub').textContent = 'Cuenta aparte · ' + tableLabel(currentTable);
  refreshPersonProductSelect();
  renderPersonModalItems();
  personOverlay.classList.add('show');
}

function closePersonModal(){
  personOverlay.classList.remove('show');
  currentPersonId = null;
  renderPeople();
  renderModalItems();
}
document.getElementById('personCloseModalBtn').addEventListener('click', closePersonModal);
/* ---------- Pasar una persona a su propia mesa (aparece en el menú principal) ---------- */
document.getElementById('personToOwnTableBtn').addEventListener('click', async ()=>{
  const t = data.tables[currentTable];
  const person = t && (t.people||[]).find(p => p.id === currentPersonId);
  if(!person) return;
  const ok = await showConfirm({
    title: '¿Crear mesa individual?',
    message: person.name + ' pasará a su propia mesa en el menú principal, con todos sus productos y pagos. Saldrá de ' + tableLabel(currentTable) + '.',
    confirmText: 'Sí, crear mesa',
    cancelText: 'Cancelar',
    icon: '🪑'
  });
  if(!ok) return;
  const pid = currentPersonId;
  const items = (t.items||[]).filter(it => it.personId === pid);
  const pays = (t.payments||[]).filter(p => p.personId === pid);
  t.items = t.items.filter(it => !items.includes(it));
  t.payments = (t.payments||[]).filter(p => !pays.includes(p));
  t.people = t.people.filter(p => p.id !== pid);
  items.forEach(it => { it.personId = null; });
  pays.forEach(p => { p.personId = null; });
  const nid = Math.max(0, ...Object.keys(data.tables).map(Number)) + 1;
  data.tables[nid] = { name: person.name, items, people: [], payments: pays };
  data.tableCount = Math.max(data.tableCount || 0, nid);
  saveData();
  closePersonModal();
  renderMesas();
  showToast('🪑 ' + person.name + ' ahora tiene su propia mesa.');
});

personOverlay.addEventListener('click', (e)=>{ if(e.target === personOverlay) closePersonModal(); });

function refreshPersonProductSelect(){
  const searchInput = document.getElementById('personAddProductSearch');
  const idInput = document.getElementById('personAddProductId');
  searchInput.value = '';
  idInput.value = '';
  hidePersonProductSuggestions();
  if(data.products.length === 0){
    searchInput.placeholder = 'Agrega productos primero';
    searchInput.disabled = true;
  } else {
    searchInput.placeholder = 'Buscar producto por nombre…';
    searchInput.disabled = false;
  }
}

function hidePersonProductSuggestions(){
  const box = document.getElementById('personAddProductSuggestions');
  box.classList.remove('show');
  box.innerHTML = '';
}

function renderPersonProductSuggestions(query){
  const box = document.getElementById('personAddProductSuggestions');
  const orderedItems = personItemsList(currentPersonId);
  const { orderedMatches, restMatches } = groupSuggestionsByOrdered(query, orderedItems);
  if(orderedMatches.length === 0 && restMatches.length === 0){
    box.innerHTML = '<div class="product-suggestion-empty">Sin productos que coincidan</div>';
    box.classList.add('show');
    return;
  }
  let html = '';
  if(orderedMatches.length){
    html += '<div class="product-suggestion-header">Ya pedido por esta persona</div>';
    html += orderedMatches.slice(0, 15).map(productSuggestionItemHtml).join('');
  }
  if(restMatches.length){
    if(orderedMatches.length) html += '<div class="product-suggestion-header">Otros productos</div>';
    html += restMatches.slice(0, 30).map(productSuggestionItemHtml).join('');
  }
  box.innerHTML = html;
  box.classList.add('show');
  box.querySelectorAll('.product-suggestion-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const product = data.products.find(p=>p.id === el.dataset.id);
      if(!product) return;
      document.getElementById('personAddProductSearch').value = product.name;
      document.getElementById('personAddProductId').value = product.id;
      hidePersonProductSuggestions();
    });
  });
}

document.getElementById('personAddProductSearch').addEventListener('input', (e)=>{
  document.getElementById('personAddProductId').value = '';
  renderPersonProductSuggestions(e.target.value);
});
document.getElementById('personAddProductSearch').addEventListener('focus', (e)=>{
  e.target.value = '';
  document.getElementById('personAddProductId').value = '';
  renderPersonProductSuggestions('');
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#personOverlay .product-search-wrap')) hidePersonProductSuggestions();
});

document.getElementById('personQtyMinusBtn').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('personAddQty');
  const antes = parseInt(qtyInput.value,10) || 1, val = Math.max(1, antes - 1);
  qtyInput.value = val;
  if(val < antes) sonidoPos('remove');
});
document.getElementById('personQtyPlusBtn').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('personAddQty');
  qtyInput.value = Math.max(1, (parseInt(qtyInput.value,10) || 1) + 1);
  sonidoPos('add');
});

document.getElementById('personAddItemBtn').addEventListener('click', ()=>{
  if(data.products.length === 0){ showToast('Primero agrega productos en la pestaña Productos.'); return; }
  const searchInput = document.getElementById('personAddProductSearch');
  const idInput = document.getElementById('personAddProductId');
  const qtyInput = document.getElementById('personAddQty');
  let productId = idInput.value;
  let product = data.products.find(p=>p.id === productId);
  if(!product){
    const typed = searchInput.value.trim().toLowerCase();
    product = data.products.find(p=>p.name.toLowerCase() === typed);
  }
  if(!product){
    showToast('Selecciona un producto de la lista de sugerencias.');
    return;
  }
  productId = product.id;
  const qty = Math.max(0, parseInt(qtyInput.value,10) || 0);
  if(qty <= 0){ showToast('Indica una cantidad mayor que 0.'); return; }
  const t = data.tables[currentTable];
  const existing = t.items.find(it=> it.productId === productId && it.personId === currentPersonId);
  if(existing){
    existing.qty += qty;
    recordItemHistory(existing, qty);
  } else {
    const newItem = { productId, name: product.name, price: product.price, size: product.size || '', qty, personId: currentPersonId, history: [] };
    recordItemHistory(newItem, qty);
    t.items.push(newItem);
  }
  noteManualChange(currentTable, product.name, qty);
  saveData();
  renderPersonModalItems();
});

function renderPersonModalItems(){
  const items = personItemsList(currentPersonId);
  const container = document.getElementById('personItemsContainer');
  container.innerHTML = '';
  const t = data.tables[currentTable];
  if(items.length === 0){
    container.innerHTML = '<div class="empty-note">Todavía no hay productos en su cuenta.</div>';
  } else {
    items.forEach(it=>{
      const idx = t.items.indexOf(it);
      const wrap = document.createElement('div');
      wrap.className = 'line-item-wrap';
      const row = document.createElement('div');
      row.className = 'line-item';
      row.innerHTML = `
        <div><span class="li-name">${invEsc(it.name)}</span>${productSizeHtml(it)}${qtyStepperHtml(idx, it.qty)}</div>
        <div class="li-right">
          <span class="li-price">${fmt(it.price*it.qty)}</span>
          <button class="li-clock" data-idx="${idx}" title="Ver horario de pedidos">🕐</button>
          <button class="li-remove" data-idx="${idx}">✕</button>
        </div>
      `;
      const hist = document.createElement('div');
      hist.className = 'li-history';
      hist.innerHTML = itemHistoryHtml(it);
      wrap.appendChild(row);
      wrap.appendChild(hist);
      container.appendChild(wrap);
    });
    container.querySelectorAll('.li-remove').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        const it = t.items[idx];
        if(!it) return;
        const ok = await showConfirm({
          title: '¿Quitar este producto?',
          message: 'Vas a quitar "' + it.name + '" ×' + it.qty + ' (' + fmt(it.price*it.qty) + ') de su cuenta. Esta acción no se puede deshacer.',
          confirmText: 'Sí, quitar',
          cancelText: 'Cancelar',
          icon: '🗑️'
        });
        if(!ok) return;
        noteManualChange(currentTable, it.name, -it.qty);
        try{ invOnSale(it, -it.qty); }catch(e){}
        t.items.splice(idx,1);
        sonidoPos('remove');
        saveData();
        renderPersonModalItems();
        renderMesas();
      });
    });
    container.querySelectorAll('.li-clock').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const hist = btn.closest('.line-item-wrap').querySelector('.li-history');
        btn.classList.toggle('active');
        hist.classList.toggle('show');
      });
    });
    attachQtyStepperHandlers(container, t, renderPersonModalItems);
    decoratePaidStatus(container, t);
  }
  renderPersonModalPayments();

  const total = personTotalAmt(currentPersonId);
  const ge = mesaEstado(currentTable).grupos.find(x => x.id === currentPersonId) || { cubierto: 0, cubiertoDebe: 0, fuentes: [] };
  const paid = personPaidAmt(currentPersonId) + ge.cubierto;
  const debt = personDebtAmt(currentPersonId) + ge.cubiertoDebe;
  const balance = personBalanceAmt(currentPersonId);
  document.getElementById('personModalConsumo').textContent = fmt(total);
  document.getElementById('personModalPagado').textContent = fmt(paid);
  // Lo que pagó por esta persona la cuenta general (u otra persona), con quién.
  let cub = document.getElementById('personModalCubierto');
  if(!cub){ cub = document.createElement('div'); cub.id = 'personModalCubierto'; cub.className = 'li-paystatus after done'; const r = document.getElementById('personModalPagado').closest('.total-row'); r.parentNode.insertBefore(cub, r.nextSibling); }
  const porQ = ge.fuentes.filter(f => f.tipo === 'pago');
  cub.hidden = !porQ.length;
  cub.textContent = porQ.length ? '✅ Incluye ' + porQ.map(f => fmt(f.monto) + ' que pagó ' + f.nombre).join(' y ') : '';
  document.getElementById('personModalDebeRow').style.display = debt > 0 ? 'flex' : 'none';
  document.getElementById('personModalDebe').textContent = fmt(debt);
  const balanceEl = document.getElementById('personModalTotal');
  balanceEl.textContent = fmt(balance);
  balanceEl.classList.toggle('balance-zero', balance === 0 && total > 0);
  balanceEl.classList.toggle('balance-pending', balance > 0);
  document.getElementById('personChargeBtn').disabled = items.length === 0;
}

function renderPersonModalPayments(){
  const t = data.tables[currentTable];
  if(!t.payments) t.payments = [];
  const payments = personPaymentsList(currentPersonId);
  const container = document.getElementById('personPaymentsContainer');
  container.innerHTML = '';
  const ge = mesaEstado(currentTable).grupos.find(x => x.id === currentPersonId);
  const porOtros = ge ? ge.fuentes.filter(f => f.tipo === 'pago') : [];
  if(payments.length === 0){
    container.innerHTML = porOtros.length ? '<div class="empty-note">✅ ' + invEsc(porOtros.map(f => f.nombre + ' pagó ' + fmt(f.monto) + ' de su cuenta').join(' · ')) + '</div>' : '<div class="empty-note">Todavía no ha abonado.</div>';
    return;
  }
  const methodLabel = { efectivo: 'Efectivo', transferencia: 'Transferencia', debe: 'Debe' };
  payments.forEach(p=>{
    const idx = t.payments.indexOf(p);
    const method = p.method || 'efectivo';
    const row = document.createElement('div');
    row.className = 'line-item payment-item';
    row.innerHTML = `
      <div><span class="li-name">${invEsc(p.note || 'Abono')}</span><span class="pay-method ${method}">${methodLabel[method] || method}</span>${payItemsHtml(p)}</div>
      <div class="li-right">
        <span class="li-price">${fmt(p.amount)}</span>
        <button class="li-remove" data-idx="${idx}">✕</button>
      </div>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll('.li-remove').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.dataset.idx,10);
      delReceipt(t.payments[idx] && t.payments[idx].receiptId);
      t.payments.splice(idx,1);
      saveData();
      renderPersonModalItems();
    });
  });
}

document.getElementById('personAddPaymentBtn').addEventListener('click', ()=>{
  const noteInput = document.getElementById('personPaymentNote');
  const amountInput = document.getElementById('personPaymentAmount');
  const methodSelect = document.getElementById('personPaymentMethod');
  let amount = parseFloat(amountInput.value);
  if((isNaN(amount) || amount <= 0) && methodSelect.value === 'debe'){
    amount = personBalanceAmt(currentPersonId);
  }
  if(isNaN(amount) || amount <= 0){
    showToast('Escribe un monto válido, o déjalo vacío si toda su cuenta queda debiendo.');
    return;
  }
  const t = data.tables[currentTable];
  if(!t.payments) t.payments = [];
  t.payments.push({ note: noteInput.value.trim(), amount, method: methodSelect.value, personId: currentPersonId, ...(payPick.person ? { items: payPick.person } : {}), ...receiptField('person') });
  payPick.person = null; updatePayPickInfo('person');
  noteInput.value = '';
  amountInput.value = '';
  methodSelect.value = 'efectivo';
  saveData();
  renderPersonModalItems();
});

document.getElementById('personChargeBtn').addEventListener('click', async ()=>{
  const t = data.tables[currentTable];
  const items = personItemsList(currentPersonId);
  if(!items.length) return;
  const person = (t.people||[]).find(p=>p.id === currentPersonId);
  const personNameConfirm = person ? person.name : 'esta persona';
  const ok = await showConfirm({
    title: '¿Cerrar esta cuenta?',
    message: '¿Seguro que quieres cobrar y cerrar la cuenta de ' + personNameConfirm + '? Esta acción no se puede deshacer.',
    confirmText: 'Sí, cerrar cuenta',
    icon: '🔒'
  });
  if(!ok) return;
  const total = personTotalAmt(currentPersonId);
  const balance = personBalanceAmt(currentPersonId);
  const geC = mesaEstado(currentTable).grupos.find(x => x.id === currentPersonId);
  const paymentsDetail = personPaymentsList(currentPersonId).map(p=>({
    note: p.note || '',
    amount: p.amount,
    method: p.method || 'efectivo',
    items: p.items || null,
    receiptId: p.receiptId || null
  }));
  // Lo que pagó por ella la cuenta general (u otra persona) se va con ella y se descuenta de quien lo pagó.
  if(geC && geC.fuentes.length) mesaLlevarCubierto(t, geC).forEach(d => paymentsDetail.push(d));
  if(balance > 0){
    paymentsDetail.push({ note: 'Saldo sin registrar al cerrar', amount: balance, method: 'debe' });
  }
  const debt = paymentsDetail.filter(p=>p.method === 'debe').reduce((s,p)=>s+p.amount, 0);
  data.history.unshift({
    id: Date.now().toString(),
    table: currentTable,
    businessName: data.businessName,
    person: person ? person.name : null,
    total,
    payments: paymentsDetail,
    debt,
    items: items.map(it=>({name:it.name, qty:it.qty, price:it.price, cost: (data.products.find(p=>p.id===it.productId)||{}).cost ?? null})),
    date: new Date().toISOString()
  });
  try{ window.ventoDian && window.ventoDian.alVender(data.history[0]); }catch(x){}   // 🧾 a la DIAN (si está prendida)
  t.items = t.items.filter(it => !(it.personId === currentPersonId));
  t.payments = (t.payments||[]).filter(p => !(p.personId === currentPersonId));
  t.people = (t.people||[]).filter(p => p.id !== currentPersonId);
  saveData();
  if(!(debt > 0)) sonidoPos('success');      // cuenta de la persona cobrada completa
  const personName = person ? person.name : 'La persona';
  closePersonModal();
  showToast(debt > 0 ? personName + ' quedó debiendo ' + fmt(debt) + '.' : 'Cuenta de ' + personName + ' cobrada y cerrada.');
});

/* ---------- Agregar productos por comando de voz ---------- */
let voiceProductListening = false;

function parseSpokenPrice(text){
  // OJO: antes esto hacía .replace(/\b(mil|miles)\b/g, '000'), que convertía
  // la PALABRA "mil" directo en el texto "000" sin arrastrar el número que
  // la acompañaba ("cinco mil" -> "cinco 000"), y luego el primer match de
  // dígitos encontraba solo "000" y devolvía 0 — es decir, CUALQUIER precio
  // dicho con "mil" (casi todos, en pesos colombianos) daba $0. Se quitó ese
  // reemplazo: "mil" se procesa como palabra numérica más abajo, igual que
  // "cien", "veinte", etc.
  let t = normVoiceText(text)
    .replace(/\b(pesos?|cop|copianos?|\$)\b/g, ' ')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Más vocabulario: además de "cinco mil", entiende compuestos como "treinta
  // y cinco mil" (los convierte a "35 mil" antes de sumarlos).
  t = expandCompoundNumbers(t);

  const words = t.split(' ').filter(Boolean);
  const units = {
    cero:0, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
    diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
    veinte:20, treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90,
    cien:100, ciento:100,
    doscientos:200, doscientas:200, trescientos:300, trescientas:300, cuatrocientos:400, cuatrocientas:400,
    quinientos:500, quinientas:500, seiscientos:600, seiscientas:600, setecientos:700, setecientas:700,
    ochocientos:800, ochocientas:800, novecientos:900, novecientas:900,
    mil:1000
  };
  let total = 0, current = 0, found = false;
  words.forEach(w=>{
    let n;
    if(units[w] !== undefined) n = units[w];
    else if(/^\d+$/.test(w)) n = parseInt(w, 10);  // dígitos ya escritos, ej. "35" tras expandCompoundNumbers
    else return;
    found = true;
    if(n === 1000){ total += (current || 1) * 1000; current = 0; }
    else current += n;
  });
  if(found){
    total += current;
    if(total > 0) return total;
  }
  // Nada de lo anterior encontró palabras numéricas: último intento, por si
  // quedó un número escrito en dígitos que el bucle de palabras no cubrió.
  const digitMatch = t.match(/\b\d{2,9}\b/);
  if(digitMatch) return parseInt(digitMatch[0], 10);
  return null;
}

function parseVoiceProductCreation(rawText){
  let text = normVoiceText(rawText)
    .replace(/\b(crea|crear|creame|creeme|agrega|agregar|agregame|añade|anade|anadir|añadir|nuevo|nueva|producto|productos|registrar|registra|registrame|mete|pon|ponme)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Precio: acepta "precio 5000", "a 5000", "por 5000", "vale 5000" y números hablados.
  // Con \b: antes «Club Colombia precio cinco mil» tomaba la «a» final del nombre como «a …» y quedaba «club colombi».
  // «precio/vale/cuesta» manda; si no está, se usa el ÚLTIMO «a/por» («pizza a la carta a 5000»).
  let m = text.match(/\b(?:precio|vale|cuesta|cuestan)\s+(.+)$/), corte = m ? m.index : -1;
  if(!m){
    const re = /\b(?:por|a)\s+/g; let x, ult = null;
    while((x = re.exec(text))) ult = x;
    if(ult){ m = [ult[0], text.slice(ult.index + ult[0].length)]; corte = ult.index; }
  }
  let price = null;
  let name = text;
  if(m){
    price = parseSpokenPrice(m[1]);
    name = text.slice(0, corte).trim();
  } else {
    // También acepta "poker cinco mil" al final.
    const tail = text.match(/\b(\d{2,9}|cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|quinientos|quinientas|mil)(?:\s+(?:mil|cientos?|quinientos?|quinientas?))?$/);
    if(tail){
      const candidate = tail[0];
      price = parseSpokenPrice(candidate);
      if(price !== null) name = text.slice(0, tail.index).trim();
    }
  }
  name = name.replace(/\b(del|de|la|el|un|una)\s*$/,'').trim();
  return { name, price };
}

function startVoiceProductCreation(){
  if(!micEnabled) return;
  const rec = ensureVoiceRecognizer();
  if(!rec){
    showToast('Tu navegador no soporta comandos por voz. Prueba con Chrome en Android.');
    return;
  }
  if(voiceListening || voiceProductListening) return;
  // Igual que el botón 🎤: ORDEVA se calla y «Hola ORDEVA» le pasa el micrófono (antes quedaban los dos peleándolo).
  try{ if(window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); }catch(e){}
  try{ window.ventoHola && window.ventoHola.soltar(true); }catch(e){}
  voiceProductListening = true; window.__vozProductoDesde = Date.now();
  // Producto por voz es una sola frase («Póker, precio cinco mil»): termina al primer silencio (sin la escucha
  // «mantenida» del botón 🎤, que se reabre en cada pausa para los pedidos largos).
  rec.mantener = false;
  const btn = document.getElementById('voiceProductBtn');
  const hint = document.getElementById('voiceProductHint');
  if(btn){ btn.dataset.html = btn.dataset.html || btn.innerHTML; btn.classList.add('active'); btn.textContent = '⏺ Escuchando…'; }
  if(hint){ hint.classList.add('show'); hint.textContent = '🎤 Di el nombre y el precio. Ejemplo: “agregar producto Póker, precio cinco mil”.'; }
  showToast('🎤 Dime el nombre del producto y su precio.');

  const oldResult = rec.onresult;
  const oldError = rec.onerror;
  const oldEnd = rec.onend;
  // Solo con la frase FINAL y una sola vez. Antes también actuaba con lo que se iba oyendo: con «Póker, precio cinco…»
  // (todavía sin el «mil») guardaba el producto a $5 y luego otra vez a $5.000.
  let hecho = false, oido = '';
  rec.onresult = (e)=>{
    if(hecho) return;
    const finales = []; for(let i = 0; i < e.results.length; i++) if(e.results[i].isFinal) finales.push(e.results[i][0].transcript);
    if(!finales.length) return;
    const transcript = finales.join(' ').trim(); oido = transcript;
    const parsed = parseVoiceProductCreation(transcript);
    if(!parsed.name || parsed.price === null || isNaN(parsed.price) || parsed.price < 0) return;   // falta algo: se avisa al terminar
    hecho = true;
    try{ rec.stop(); }catch(err){}
    document.getElementById('prodName').value = parsed.name;
    document.getElementById('prodPrice').value = parsed.price;
    document.getElementById('prodName').focus();
    // Agrega automáticamente, como pidió el usuario: nombre + precio y listo.
    document.getElementById('prodAddBtn').click();
    speakVoice(parsed.name + ' agregado por ' + fmtSpoken(parsed.price) + '.');
  };
  rec.onerror = (e)=>{
    voiceProductListening = false;
    if(btn){ btn.classList.remove('active'); btn.innerHTML = btn.dataset.html || '🎤 Producto por voz'; }
    if(hint) hint.classList.remove('show');
    if(e.error === 'no-speech') showToast('No escuché nada. Intenta de nuevo.');
    else if(e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast('Necesitas dar permiso de micrófono para usar el comando por voz.');
    else showToast('No se pudo reconocer el audio. Intenta de nuevo.');
    rec.onresult = oldResult; rec.onerror = oldError; rec.onend = oldEnd; rec.mantener = true;
  };
  rec.onend = ()=>{
    voiceProductListening = false;
    if(btn){ btn.classList.remove('active'); btn.innerHTML = btn.dataset.html || '🎤 Producto por voz'; }
    if(hint) hint.classList.remove('show');
    rec.onresult = oldResult; rec.onerror = oldError; rec.onend = oldEnd; rec.mantener = true;
    if(!hecho && oido){
      showToast('Escuché «' + oido + '», pero no entendí el nombre y el precio. Ejemplo: “agregar producto Póker, precio cinco mil”.');
      speakVoice('Necesito el nombre del producto y el precio.');
    }
  };
  try{ rec.start(); }catch(e){
    voiceProductListening = false;
    if(btn){ btn.classList.remove('active'); btn.innerHTML = btn.dataset.html || '🎤 Producto por voz'; }
    if(hint) hint.classList.remove('show');
    rec.onresult = oldResult; rec.onerror = oldError; rec.onend = oldEnd; rec.mantener = true;
  }
}

document.getElementById('voiceProductBtn').addEventListener('click', startVoiceProductCreation);

/* ---------- Reconocimiento de producto por foto con IA ---------- */
const cameraBtn = document.getElementById('cameraBtn');
const cameraInput = document.getElementById('cameraInput');
const photoPreview = document.getElementById('photoPreview');
const photoPreviewImg = document.getElementById('photoPreviewImg');
const photoStatus = document.getElementById('photoStatus');
const aiConfigBtn = document.getElementById('aiConfigBtn');
const cameraBtnLabel = cameraBtn.innerHTML;
const OPENAI_KEY_STORAGE = 'bar-openai-api-key';
const OPENAI_MODEL_STORAGE = 'bar-openai-model';
// 🔑 OPCIONAL: pega aquí tu API key de OpenAI (sk-...) entre las comillas si quieres que la IA
// funcione sola en todos los dispositivos donde abras este archivo, sin configurar nada.
// Ojo: quien tenga este archivo podrá ver la clave. Si la dejas vacía, se usa la que
// guardes en ⚙️ Configurar IA (queda solo en el dispositivo).
const BUILTIN_OPENAI_KEY = '';
const OPENAI_MODEL_DEFAULT = 'gpt-4.1-mini';
// Si el modelo principal no está disponible para tu cuenta, se prueban estos en orden.
const OPENAI_MODEL_FALLBACKS = ['gpt-4o-mini', 'gpt-4.1', 'gpt-4o', 'gpt-5-mini', 'gpt-5.6-luna'];

function getOpenAIKey(){
  let k = '';
  try{ k = localStorage.getItem(OPENAI_KEY_STORAGE) || ''; }catch(e){}
  return k || (BUILTIN_OPENAI_KEY || '').replace(/\s+/g, '');
}
function setOpenAIKey(key){
  key = (key || '').replace(/\s+/g, '');
  try{
    if(key) localStorage.setItem(OPENAI_KEY_STORAGE, key);
    else localStorage.removeItem(OPENAI_KEY_STORAGE);
  }catch(e){}
}
function getOpenAIModel(){
  try{ return (localStorage.getItem(OPENAI_MODEL_STORAGE) || '').trim() || OPENAI_MODEL_DEFAULT; }
  catch(e){ return OPENAI_MODEL_DEFAULT; }
}
function setOpenAIModel(m){
  m = (m || '').trim();
  try{
    if(m && m !== OPENAI_MODEL_DEFAULT) localStorage.setItem(OPENAI_MODEL_STORAGE, m);
    else localStorage.removeItem(OPENAI_MODEL_STORAGE);
  }catch(e){}
}

/* ---- Llamada a la API de OpenAI con errores claros ---- */
class OpenAIError extends Error{
  constructor(kind, message, status){ super(message); this.name = 'OpenAIError'; this.kind = kind; this.status = status || 0; }
}

function openAIErrorFromResponse(status, raw){
  let msg = raw, code = '';
  try{ const j = JSON.parse(raw); code = String((j.error && (j.error.code || j.error.type)) || ''); msg = (j.error && (j.error.message || j.error.code)) || raw; }catch(e){}
  msg = String(msg || '').replace(/\s+/g, ' ').slice(0, 400);
  if(status === 429 && !/insufficient_quota|billing|exceeded your current quota/i.test(code + ' ' + msg)){
    return new OpenAIError('rate', 'OpenAI pidió esperar un momento (demasiadas peticiones seguidas). (' + msg + ')', status);
  }
  if(status === 401) return new OpenAIError('auth', 'La API key no es válida o fue revocada. Vuelve a pegarla en ⚙️ Configurar IA. (' + msg + ')', status);
  if(status === 403) return new OpenAIError('auth', 'Tu API key no tiene permiso para usar este modelo o esta región. (' + msg + ')', status);
  if(status === 429) return new OpenAIError('quota', 'Tu cuenta de OpenAI no tiene saldo o llegó a su tope de gasto. Recarga o sube el límite en platform.openai.com (Billing). (' + msg + ')', status);
  if(status === 413) return new OpenAIError('bad', 'La foto es demasiado grande para enviarla. (' + msg + ')', status);
  if(status === 404 || (status === 400 && /model/i.test(msg) && /(not found|does not exist|invalid|unsupported|not supported|access|deprecated)/i.test(msg))){
    return new OpenAIError('model', 'El modelo no está disponible para tu cuenta. (' + msg + ')', status);
  }
  if(status >= 500) return new OpenAIError('server', 'OpenAI tuvo un problema temporal (' + status + '). Intenta de nuevo en un momento.', status);
  return new OpenAIError('bad', 'Error de la API (' + status + '): ' + msg, status);
}

// buildBody(model) devuelve el cuerpo JSON de la petición. La app NO impone límites de uso:
// reintenta sola (con espera creciente) cuando OpenAI responde "muchas peticiones", un error
// temporal del servidor o se cae la red; si el modelo no está disponible para tu cuenta prueba
// los de respaldo y recuerda el que funcione.
const OPENAI_DEFAULT_TIMEOUT_MS = 120000;
function aiSleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// deadline (opcional): hora límite (Date.now() + ms) para TODA la llamada, contando reintentos y modelos
// de respaldo. El chat la usa para responder siempre en menos de 15 segundos.
function aiTimeLeft(deadline){ return deadline ? deadline - Date.now() : Infinity; }
function aiDeadlineError(lastErr){ return lastErr && lastErr.kind !== 'model' ? lastErr : new OpenAIError('timeout', 'La IA tardó demasiado en responder. Revisa tu conexión e intenta de nuevo.'); }

async function openaiResponses(buildBody, timeoutMs, maxRetries, oneModel, deadline){
  const key = getOpenAIKey();
  if(!key) throw new Error('NO_API_KEY');
  if(/[^\x20-\x7E]/.test(key)) throw new OpenAIError('auth', 'La API key tiene caracteres raros (¿se pegó con espacios o saltos de línea?). Pégala de nuevo.');
  const retries = (typeof maxRetries === 'number') ? maxRetries : 5;
  const main = getOpenAIModel();
  const models = oneModel ? [main] : [main, ...OPENAI_MODEL_FALLBACKS.filter(m => m !== main)];
  let lastErr = null;
  for(const model of models){
    let attempt = 0;
    while(true){
      attempt++;
      const left = aiTimeLeft(deadline);
      if(left < 1500) throw aiDeadlineError(lastErr);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.min(timeoutMs || OPENAI_DEFAULT_TIMEOUT_MS, left));
      let retryDelay = 0;
      try{
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify(buildBody(model)),
          signal: ctrl.signal
        });
        const raw = await res.text();
        if(!res.ok){
          if(res.status === 400 && /reasoning/i.test(raw) && !aiSinPensarNo.has(model)){ aiSinPensarNo.add(model); attempt--; continue; }
          const err = openAIErrorFromResponse(res.status, raw);
          if(err.kind === 'model'){ lastErr = err; break; }            // prueba el siguiente modelo
          if((err.kind === 'rate' || err.kind === 'server') && attempt <= retries && aiTimeLeft(deadline) > 4000){
            const ra = parseFloat(res.headers.get('retry-after'));
            retryDelay = Math.min(20000, (isFinite(ra) && ra > 0) ? ra * 1000 : 1200 * Math.pow(2, attempt - 1));
          } else {
            throw err;
          }
        } else {
          let json;
          try{ json = JSON.parse(raw); }catch(e){ throw new OpenAIError('bad', 'La API devolvió una respuesta que no se puede leer.'); }
          json._model = model;
          if(model !== main) setOpenAIModel(model); // recuerda el modelo que sí funciona
          return json;
        }
      }catch(e){
        if(e instanceof OpenAIError) throw e;
        const timedOut = e && e.name === 'AbortError';
        if(attempt <= Math.min(retries, 2) && aiTimeLeft(deadline) > 4000){
          retryDelay = 1200 * attempt;                                  // fallo de red o tiempo agotado: reintenta
        } else if(timedOut){
          throw new OpenAIError('timeout', 'La IA tardó demasiado en responder. Revisa tu conexión e intenta de nuevo.');
        } else {
          throw new OpenAIError('network', 'No hay conexión con OpenAI (sin internet, bloqueo de red o la app se abrió en un entorno que no permite conexiones externas). Detalle: ' + (e && e.message ? e.message : e));
        }
      }finally{
        clearTimeout(timer);
      }
      if(retryDelay){
        if(aiTimeLeft(deadline) - retryDelay < 2500) throw aiDeadlineError(lastErr);
        await aiSleep(retryDelay);
      }
    }
  }
  throw lastErr || new OpenAIError('model', 'Ningún modelo de IA está disponible para tu cuenta.');
}

// La API REST no trae "output_text" (eso es solo del SDK): se arma desde output[].content[].
function extractResponseText(result){
  if(!result) return '';
  if(typeof result.output_text === 'string' && result.output_text) return result.output_text;
  const parts = [];
  (result.output || []).forEach(item => {
    if(item && Array.isArray(item.content)){
      item.content.forEach(c => { if(c && typeof c.text === 'string' && (c.type === 'output_text' || c.type === 'text')) parts.push(c.text); });
    }
  });
  return parts.join('\n').trim();
}

function cleanAiJsonText(text){
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try{ return JSON.parse(t); }catch(e){}
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if(first >= 0 && last > first){
    try{ return JSON.parse(t.slice(first, last + 1)); }catch(e){}
  }
  return first >= 0 ? jsonRescatar(t.slice(first)) : null;
}
// La IA a veces repite un pedazo después del JSON («…]]}\n2]]}») o se corta en una factura larga.
// 1) Se toma el primer objeto completo (contando llaves fuera de las comillas).
// 2) Si quedó cortado, se conservan los renglones completos y se cierran las llaves que falten.
function jsonRescatar(t){
  const cerrar = pre => { const pila = []; let str = false, esc = false;
    for(const c of pre){ if(str){ if(esc) esc = false; else if(c === '\\') esc = true; else if(c === '"') str = false; continue; }
      if(c === '"') str = true; else if(c === '{') pila.push('}'); else if(c === '[') pila.push(']'); else if(c === '}' || c === ']') pila.pop(); }
    return str ? null : pila; };
  let d = 0, str = false, esc = false;
  for(let k = 0; k < t.length; k++){
    const c = t[k];
    if(str){ if(esc) esc = false; else if(c === '\\') esc = true; else if(c === '"') str = false; continue; }
    if(c === '"') str = true; else if(c === '{' || c === '[') d++;
    else if((c === '}' || c === ']') && --d === 0){ try{ return JSON.parse(t.slice(0, k + 1)); }catch(e){ break; } }
  }
  for(let corte = t.length, n = 0; n < 8; n++){
    corte = t.lastIndexOf(']', corte - 1); if(corte < 0) break;
    const pre = t.slice(0, corte + 1), pila = cerrar(pre);
    if(!pila) continue;
    try{ return JSON.parse(pre + pila.reverse().join('')); }catch(e){}
  }
  return null;
}

/* ================= Proveedor de IA: Gemini (gratis) u OpenAI ================= */
const AI_PROVIDER_STORAGE = 'bar-ai-provider';
const GEMINI_KEY_STORAGE = 'bar-gemini-api-key';
const GEMINI_MODEL_STORAGE = 'bar-gemini-model';
// 🔑 OPCIONAL: pega aquí tu API key de Gemini (AIza... o AQ....) entre las comillas si quieres que la IA
// funcione sola en todos los dispositivos donde abras este archivo. Quien tenga el archivo podrá
// ver la clave. Si la dejas vacía se usa la que guardes en ⚙️ Configurar IA (solo en el dispositivo).
const BUILTIN_GEMINI_KEY = '';
// Las claves nuevas de Google (las que empiezan por «AQ.») ya no tienen los modelos 2.5: se usa uno de la serie 3.5,
// rápido (menos de 1 s) y que respeta el modo JSON. Los 2.5 quedan al final para claves viejas que aún los tengan.
const GEMINI_MODEL_DEFAULT = 'gemini-3.5-flash-lite';
// Si el modelo principal no está disponible o se acabó su cuota diaria, se prueban estos en orden
// (y, si ninguno sirve, la app le pregunta a Google qué modelos "flash" tiene tu clave).
// Si el principal está saturado se pasa primero a uno de OTRA familia (cuando Google satura los «lite»
// suelen caer todos a la vez; los «flash» normales siguen respondiendo en 2-3 s).
const GEMINI_MODEL_FALLBACKS = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
// Modelos que Google respondió «saturado» (503) hace poco: van de últimos por unos minutos, así la próxima
// lectura no pierde segundos esperándolos (antes se reintentaba el mismo modelo y una factura tardaba 20-30 s).
const AI_SATURADOS_KEY = 'vento-ia-saturados', AI_SATURADO_MS = 4 * 60e3;
function aiSaturados(){ try{ const o = JSON.parse(localStorage.getItem(AI_SATURADOS_KEY) || '{}'), now = Date.now(); Object.keys(o).forEach(k => { if(!(o[k] > now)) delete o[k]; }); return o; }catch(e){ return {}; } }
function aiMarcarSaturado(m, si){ try{ const o = aiSaturados(); if(si) o[m] = Date.now() + AI_SATURADO_MS; else delete o[m]; localStorage.setItem(AI_SATURADOS_KEY, JSON.stringify(o)); }catch(e){} }
function aiOrdenModelos(lista){ const sat = aiSaturados(); return lista.filter(m => !sat[m]).concat(lista.filter(m => sat[m])); }
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
/* IA de ORDEVA ya configurada: si el negocio no puso su propia clave, ORDEVA usa la IA del PROVEEDOR a través del
   Servidor ORDEVA (Supabase → función vento-ia). La clave de Gemini vive allá como secreto del servidor: nunca está
   en la app ni en GitHub. Nadie tiene que configurar nada. */
const IA_VENTO = 'vento-servidor';
function iaVentoBase(){ try{ const n = window.VENTO_NUBE_DEFAULT; return n && n.url ? String(n.url).replace(/\/+$/, '') + '/functions/v1/vento-ia' : ''; }catch(e){ return ''; } }
let iaVentoOk = (() => { try{ return localStorage.getItem('vento-ia-servidor') === '1'; }catch(e){ return false; } })();
async function iaVentoRevisar(){
  const b = iaVentoBase(); if(!b) return false;
  try{
    const r = await fetch(b + '/salud', { cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    iaVentoOk = !!(r.ok && j && j.gemini);
    try{ localStorage.setItem('vento-ia-servidor', iaVentoOk ? '1' : '0'); }catch(e){}
  }catch(e){}
  return iaVentoOk;
}
setTimeout(iaVentoRevisar, 1500); setInterval(iaVentoRevisar, 30 * 60000);
/* 🔐 Clave propia del NEGOCIO en el servidor (1.53.0): con ORDEVA Nube, la clave de Gemini del negocio vive cifrada en
   el Servidor ORDEVA y la IA pasa por allá; ningún celular la guarda ni viaja en los datos del negocio (antes llegaba a
   todos los equipos, también a los meseros, y quedaba en los respaldos). Sin clave del negocio: la IA de ORDEVA. */
const IA_NEGOCIO = 'vento-negocio';
const IA_NEG_KEY = 'vento-ia-negocio';
function iaNegApi(){ try{ const ia = window.ventoPagos && window.ventoPagos.ia; return ia && ia.disponible() ? ia : null; }catch(e){ return null; } }
function iaNegNegocio(){ try{ const n = window.ventoNube && window.ventoNube.negocio && window.ventoNube.negocio(); return n || null; }catch(e){ return null; } }
function iaNegEstado(){ try{ const o = JSON.parse(localStorage.getItem(IA_NEG_KEY) || 'null'), n = iaNegNegocio(); return o && n && o.id === n.id ? o : null; }catch(e){ return null; } }
function iaNegPoner(j){ const n = iaNegNegocio(); try{ if(n) localStorage.setItem(IA_NEG_KEY, JSON.stringify({ id: n.id, tiene: !!(j && j.tiene), final: (j && j.final) || '', t: Date.now() })); }catch(e){} }
const iaNegAdmin = () => { const n = iaNegNegocio(); return !!n && (n.rol === 'dueno' || n.rol === 'admin'); };
// Si el negocio tiene clave en el servidor, la copia de este celular sobra: se borra. Si no la tiene y este celular
// sí (versiones anteriores la copiaban a todos), el dueño o el administrador la sube una vez.
async function iaNegRevisar(){
  const ia = iaNegApi(); if(!ia) return null;
  try{
    let j = await ia.estado();
    const local = (lsGet(GEMINI_KEY_STORAGE) || '').replace(/\s+/g, '');
    if(!j.tiene && !j.quitada && local && iaNegAdmin()) j = await ia.guardar(local).catch(() => j);
    iaNegPoner(j);
    if(j.tiene && local) lsSet(GEMINI_KEY_STORAGE, '');
    if(j.tiene && typeof data !== 'undefined' && data && data.iaClave){ delete data.iaClave; saveData(); }
    return j;
  }catch(e){ return null; }
}
setTimeout(iaNegRevisar, 5000); setInterval(iaNegRevisar, 60 * 60000);
// Llama a Gemini: directo con la clave propia de este equipo, por el Servidor ORDEVA con la del negocio, o la IA de ORDEVA.
function gFetch(ruta, init, key){
  init = Object.assign({}, init || {}); const h = Object.assign({}, init.headers || {});
  if(key === IA_NEGOCIO){
    const ia = iaNegApi();
    if(ia) return ia.pedir(ruta, init).then(r => {
      if(r.status !== 404 && r.status !== 401) return r;
      iaNegPoner({ tiene: false });                            // la quitaron o se cerró la sesión: la IA de ORDEVA
      return gFetch(ruta, init, iaVentoOk && iaVentoBase() ? IA_VENTO : '');
    });
    key = iaVentoOk && iaVentoBase() ? IA_VENTO : '';
  }
  if(key === IA_VENTO){ delete h['x-goog-api-key']; init.headers = h; return fetch(iaVentoBase() + '/v1beta' + ruta, init); }
  h['x-goog-api-key'] = key; init.headers = h; return fetch(GEMINI_BASE + ruta, init);
}
let aiLastModel = '';
let aiLastNotice = 0;

function lsGet(k){ try{ return localStorage.getItem(k) || ''; }catch(e){ return ''; } }
function lsSet(k, v){ try{ if(v) localStorage.setItem(k, v); else localStorage.removeItem(k); }catch(e){} }

// Con ORDEVA Nube la clave del negocio está en el servidor (IA_NEGOCIO) y llega sola a todos los equipos sin copiarse.
// Sin la nube, la clave queda solo en este equipo (y en los datos de un respaldo viejo, si venía ahí).
function getGeminiKey(){
  const neg = iaNegEstado();
  if(neg && neg.tiene && iaNegApi()) return IA_NEGOCIO;
  let k = (lsGet(GEMINI_KEY_STORAGE) || '').replace(/\s+/g, '');
  if(!k && !iaNegApi()){ try{ const d = typeof data !== 'undefined' && data && data.iaClave; if(d && /^[\x21-\x7e]{20,}$/.test(d)){ k = d; lsSet(GEMINI_KEY_STORAGE, d); } }catch(e){} }
  return k || BUILTIN_GEMINI_KEY || (iaVentoOk && iaVentoBase() ? IA_VENTO : '');
}
// Guardar la clave: con la nube y siendo dueño o administrador, va al servidor (cifrada) y no queda en el celular.
// Devuelve una promesa con el resultado del servidor (o null si quedó solo en este equipo).
function setGeminiKey(k){
  k = (k || '').replace(/\s+/g, '');
  const ia = iaNegApi();
  try{ if(typeof data !== 'undefined' && data && data.iaClave){ delete data.iaClave; saveData(); } }catch(e){}
  if(ia && iaNegAdmin() && k){
    lsSet(GEMINI_KEY_STORAGE, k);                             // mientras responde el servidor, sirve en este equipo
    return ia.guardar(k).then(j => { iaNegPoner(j); if(j && j.tiene) lsSet(GEMINI_KEY_STORAGE, ''); return j; });
  }
  lsSet(GEMINI_KEY_STORAGE, k);
  return Promise.resolve(null);
}
function quitarClaveNegocio(){ const ia = iaNegApi(); if(!ia || !iaNegAdmin()) return Promise.resolve(null); return ia.borrar().then(j => { iaNegPoner(j); return j; }); }
// «📲 Pasar la IA a la app ORDEVA»: enlace vento://abrir#iaclave=… que la app abre y guarda la clave (sin escribirla).
function iaClaveDeEnlace(){
  try{
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const k = h.get('iaclave');
    if(k){ history.replaceState(null, '', location.pathname + location.search); setTimeout(() => { setGeminiKey(k); try{ showToast('✅ IA conectada en este celular: ya puedes escanear facturas y productos.', 7000); }catch(e){} }, 1500); }
  }catch(e){}
}
iaClaveDeEnlace();
window.addEventListener('hashchange', iaClaveDeEnlace);      // si Vento ya estaba abierta, el enlace solo cambia el final de la dirección
function getGeminiModel(){ return lsGet(GEMINI_MODEL_STORAGE).trim().replace(/^models\//, '') || GEMINI_MODEL_DEFAULT; }
function setGeminiModel(m){
  m = (m || '').trim().replace(/^models\//, '');
  lsSet(GEMINI_MODEL_STORAGE, (m && m !== GEMINI_MODEL_DEFAULT) ? m : '');
}

function getAIProvider(){
  const p = lsGet(AI_PROVIDER_STORAGE);
  if(p === 'gemini' || p === 'openai') return p;
  // Sin elección previa: si solo existe una clave de OpenAI (versiones anteriores), se sigue usando OpenAI.
  if(!getGeminiKey() && getOpenAIKey()) return 'openai';
  return 'gemini';
}
function setAIProvider(p){ lsSet(AI_PROVIDER_STORAGE, p === 'openai' ? 'openai' : 'gemini'); }
function getAIKey(){ return getAIProvider() === 'openai' ? getOpenAIKey() : getGeminiKey(); }
function hasAIKey(){ return !!getAIKey(); }

// Avisa (como máximo una vez por minuto) cuando la IA no está disponible por clave o cuota,
// para que no parezca que "no hace nada". La voz clásica sigue funcionando igual.
function aiNotifyOnce(e){
  if(!e || !['auth', 'daily', 'quota', 'model'].includes(e.kind)) return;
  const now = Date.now();
  if(now - aiLastNotice < 60000) return;
  aiLastNotice = now;
  showToast('⚠️ IA no disponible: ' + String(e.message || '').slice(0, 140));
}

function geminiErrorFromResponse(status, raw){
  let msg = raw, statusText = '', details = [];
  try{
    const j = JSON.parse(raw); const e = j.error || {};
    msg = e.message || raw; statusText = String(e.status || ''); details = Array.isArray(e.details) ? e.details : [];
  }catch(x){}
  msg = String(msg || '').replace(/\s+/g, ' ').slice(0, 400);
  let retryMs = 0, perDay = false;
  details.forEach(d => {
    const t = String((d && d['@type']) || '');
    if(/RetryInfo/.test(t) && d.retryDelay){ const n = parseFloat(String(d.retryDelay)); if(isFinite(n)) retryMs = n * 1000; }
    if(/QuotaFailure/.test(t)) (d.violations || []).forEach(v => {
      if(/PerDay/i.test(String(v.quotaId || '') + ' ' + String(v.quotaMetric || ''))) perDay = true;
    });
  });
  let err;
  if(status === 429 || statusText === 'RESOURCE_EXHAUSTED'){
    if(perDay || /per day|daily|per_day/i.test(msg)){
      err = new OpenAIError('daily', 'Se acabó la cuota diaria de la IA para este modelo (se renueva cada día). Prueba otro modelo en ⚙️ Configurar IA o activa la facturación en Google AI Studio. (' + msg + ')', status);
    } else {
      err = new OpenAIError('rate', 'La IA pidió esperar un momento (límite por minuto del plan gratis). (' + msg + ')', status);
    }
  } else if((status === 400 || status === 401 || status === 403) && /API key not valid|API_KEY_INVALID|API key expired|API key was reported|invalid api key/i.test(msg + ' ' + JSON.stringify(details))){
    err = new OpenAIError('auth', 'La API key de Gemini no es válida o fue desactivada. Créala de nuevo en aistudio.google.com/apikey y pégala en ⚙️ Configurar IA.', status);
  } else if(status === 401 || status === 403){
    err = new OpenAIError('auth', 'Tu API key de Gemini no tiene permiso para esto (o el servicio no está disponible en tu región). (' + msg + ')', status);
  } else if(status === 404 || (status === 400 && /model/i.test(msg) && /(not found|does not exist|not supported|deprecated|no longer available)/i.test(msg))){
    err = new OpenAIError('model', 'El modelo no está disponible para tu clave. (' + msg + ')', status);
  } else if(status === 413){
    err = new OpenAIError('bad', 'La foto es demasiado grande para enviarla. (' + msg + ')', status);
  } else if(status >= 500){
    err = new OpenAIError('server', 'La IA está saturada o tuvo un problema temporal (' + status + '). Intenta de nuevo en un momento.', status);
  } else {
    err = new OpenAIError('bad', 'Error de la IA (' + status + '): ' + msg, status);
  }
  err.retryMs = retryMs;
  return err;
}

function geminiBody(o, model){
  const parts = [];
  if(o.imageDataUrl){
    const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(o.imageDataUrl);
    if(m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  parts.push({ text: o.prompt });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: o.json ? 0.1 : 0.3 } };
  if(o.json && !o.web) body.generationConfig.responseMimeType = 'application/json';  // JSON estricto (no se combina con búsqueda web)
  if(o.fast){
    body.generationConfig.maxOutputTokens = o.maxOutputTokens || 220;
    // Foto ligera = más rápido. Pero NO en documentos (facturas): con la letra pequeña a media
    // resolución la IA leía mal, la pasada rápida fallaba y había que esperar la lenta completa.
    if(!o.doc) body.generationConfig.mediaResolution = 'MEDIA_RESOLUTION_MEDIUM';
  }
  if(o.maxOutputTokens && !o.fast) body.generationConfig.maxOutputTokens = o.maxOutputTokens;   // respuestas cortas = más rápidas
  if(o.web) body.tools = [{ google_search: {} }];
  /* Sin razonamiento largo = respuesta mucho más rápida (3 a 10 veces). Los modelos nuevos
     (serie 3) piensan por defecto antes de contestar; antes solo se les quitaba a los 2.5, y
     cuando un modelo viejo se retiraba la app pasaba a uno nuevo y quedaba lenta para siempre. */
  if(!aiSinPensarNo.has(model)){
    if(/^gemini-2\.5-flash(-lite)?$/.test(model || '')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    else if(/^gemini-(3|[4-9])/.test(model || '')) body.generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  }
  return body;
}
// Modelos que rechazaron la opción de no razonar: se les manda sin ella (no se rompe nada).
const aiSinPensarNo = new Set();

function geminiExtractText(json){
  if(!json) return '';
  const c = (json.candidates || [])[0];
  if(!c){
    const br = json.promptFeedback && json.promptFeedback.blockReason;
    if(br) throw new OpenAIError('bad', 'La IA bloqueó la solicitud (' + br + ').');
    return '';
  }
  const parts = (c.content && c.content.parts) || [];
  return parts.filter(x => x && typeof x.text === 'string' && !x.thought).map(x => x.text).join('\n').trim();
}

// Pregunta a Google qué modelos "flash" puede usar esta clave (por si cambian los nombres).
async function geminiDiscoverModels(key){
  const res = await gFetch('/models?pageSize=200', {}, key);
  if(!res.ok) return [];
  const j = await res.json();
  return (j.models || [])
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => String(m.name || '').replace(/^models\//, ''))
    .filter(n => /^gemini-/.test(n) && /flash/.test(n) && !/(image|tts|live|audio|native|embedding|robotics|computer)/.test(n))
    .sort().reverse().slice(0, 6);
}

// Llamada a Gemini SIN límites propios de la app: reintenta con espera creciente ante
// "muchas peticiones" o saturación, y si un modelo no existe o agotó su cuota diaria prueba otro.
async function geminiGenerate(o){
  const key = getGeminiKey();
  if(!key) throw new Error('NO_API_KEY');
  if(/[^\x20-\x7E]/.test(key)) throw new OpenAIError('auth', 'La API key tiene caracteres raros (¿se pegó con espacios o saltos de línea?). Pégala de nuevo.');
  const retries = (typeof o.retries === 'number') ? o.retries : 5;
  const main = getGeminiModel();
  const todos = aiOrdenModelos([main, ...GEMINI_MODEL_FALLBACKS.filter(m => m !== main)]);
  // Un solo intento rápido: con el principal, salvo que esté saturado (entonces con el primero que no lo esté).
  const models = o.model ? [o.model] : o.oneModel ? [todos[0]] : todos;
  let lastErr = null, discovered = false, skippedForModel = false;
  for(let mi = 0; mi < models.length; mi++){
    const model = models[mi];
    let attempt = 0;
    while(true){
      attempt++;
      const left = aiTimeLeft(o.deadline);
      if(left < 1500) throw aiDeadlineError(lastErr);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.min(o.timeoutMs || OPENAI_DEFAULT_TIMEOUT_MS, left));
      let retryDelay = 0;
      try{
        const res = await gFetch('/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody(o, model)),
          signal: ctrl.signal
        }, key);
        const raw = await res.text();
        if(!res.ok){
          if(res.status === 400 && /thinking/i.test(raw) && !aiSinPensarNo.has(model)){ aiSinPensarNo.add(model); attempt--; continue; }
          const err = geminiErrorFromResponse(res.status, raw);
          if(key === IA_VENTO && (err.kind === 'auth' || res.status === 503 || res.status === 403)) err.message = 'La IA de ORDEVA no está disponible en este momento (el proveedor debe revisar la clave del servidor). Si quieres, pon tu propia clave en ⚙️ Configurar IA.';
          if(key === IA_NEGOCIO && err.kind === 'auth') err.message = 'Google no aceptó la clave de IA del negocio. El dueño o el administrador la cambia en ⚙️ Configurar IA.';
          if(err.kind === 'model'){ skippedForModel = true; lastErr = err; break; }
          if(err.kind === 'daily'){ lastErr = err; break; }              // otro modelo tiene su propia cuota
          // Saturado: se pasa YA a otro modelo (cada uno tiene su propia capacidad) en vez de esperar a este.
          if(res.status === 503 || (err.kind === 'rate' && !o.oneModel)){ aiMarcarSaturado(model, true); if(mi < models.length - 1 || o.oneModel){ lastErr = err; break; } }
          if(err.kind === 'rate' || err.kind === 'server'){
            if(attempt <= retries && !(o.deadline && err.retryMs > 3000)){  // con hora límite, no espera minutos: pasa a otro modelo
              retryDelay = Math.min(30000, err.retryMs > 0 ? err.retryMs + 300 : 1500 * Math.pow(2, attempt - 1));
            } else { lastErr = err; break; }                              // agotó reintentos: prueba otro modelo
          } else {
            throw err;
          }
        } else {
          let json;
          try{ json = JSON.parse(raw); }catch(x){ throw new OpenAIError('bad', 'La IA devolvió una respuesta que no se puede leer.'); }
          geminiExtractText(json); // lanza error claro si Google bloqueó la solicitud
          json._model = model; aiLastModel = model;
          if(mi > 0 || model !== main) aiMarcarSaturado(model, false);
          if(model !== main && skippedForModel) setGeminiModel(model); // recuerda el que sí existe
          return json;
        }
      }catch(e){
        if(e instanceof OpenAIError) throw e;
        const timedOut = e && e.name === 'AbortError';
        if(attempt <= Math.min(retries, 2) && aiTimeLeft(o.deadline) > 4000){
          retryDelay = 1200 * attempt;
        } else if(timedOut){
          throw new OpenAIError('timeout', 'La IA tardó demasiado en responder. Revisa tu conexión e intenta de nuevo.');
        } else {
          throw new OpenAIError('network', 'No hay conexión con la IA (sin internet, bloqueo de red o la app se abrió en un entorno que no permite conexiones externas). Detalle: ' + (e && e.message ? e.message : e));
        }
      }finally{
        clearTimeout(timer);
      }
      if(retryDelay){
        if(aiTimeLeft(o.deadline) - retryDelay < 2500){ lastErr = lastErr || new OpenAIError('rate', 'La IA está ocupada.'); break; }
        await aiSleep(retryDelay);
      }
    }
    if(!o.oneModel && mi === models.length - 1 && !discovered && lastErr && lastErr.kind === 'model' && aiTimeLeft(o.deadline) > 5000){
      discovered = true;
      try{ (await geminiDiscoverModels(key)).forEach(m => { if(!models.includes(m)) models.push(m); }); }catch(x){}
    }
  }
  throw lastErr || new OpenAIError('model', 'Ningún modelo de IA está disponible para tu clave.');
}

const AI_LADDER_KINDS = ['bad', 'server', 'timeout', 'network', 'rate', 'daily'];

async function geminiText(o){
  const modes = o.web ? (o.strictWeb ? [true] : [true, false]) : [false];
  let lastErr = null;
  for(const web of modes){
    try{
      return geminiExtractText(await geminiGenerate(Object.assign({}, o, { web })));
    }catch(err){
      lastErr = err;
      if(!web || !(err && AI_LADDER_KINDS.includes(err.kind))) throw err;   // si falló solo la parte web, reintenta sin web
    }
  }
  throw lastErr;
}

// Respuesta en vivo (streaming): Gemini manda el texto por pedacitos y onDelta(textoHastaAhora)
// se llama con cada uno, así la primera frase aparece en ~1 segundo en vez de esperar la respuesta
// completa. Un solo intento con el modelo principal; si falla antes de escribir nada, lanza el error
// para que quien llama use aiText (que prueba los modelos de respaldo).
async function geminiStreamText(o, onDelta){
  const key = getGeminiKey();
  if(!key) throw new Error('NO_API_KEY');
  const model = aiOrdenModelos([getGeminiModel(), ...GEMINI_MODEL_FALLBACKS.filter(m => m !== getGeminiModel())])[0];   // el principal, salvo que esté saturado
  const left = aiTimeLeft(o.deadline);
  if(left < 1500) throw new OpenAIError('timeout', 'La IA tardó demasiado en responder.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(o.timeoutMs || OPENAI_DEFAULT_TIMEOUT_MS, left));
  let full = '';
  try{
    const res = await gFetch('/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody(o, model)),
      signal: ctrl.signal
    }, key);
    if(!res.ok) throw geminiErrorFromResponse(res.status, await res.text());
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while((nl = buf.indexOf('\n')) >= 0){
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if(!line.startsWith('data:')) continue;
        let j; try{ j = JSON.parse(line.slice(5)); }catch(e){ continue; }
        geminiExtractText(j);                              // lanza error claro si Google bloqueó la respuesta
        const c0 = (j.candidates || [])[0], parts = (c0 && c0.content && c0.content.parts) || [];
        const piece = parts.filter(x => x && typeof x.text === 'string' && !x.thought).map(x => x.text).join('');   // sin recortar: los espacios entre pedazos cuentan
        if(piece){ full += piece; try{ onDelta(full); }catch(e){} }
      }
    }
    aiLastModel = model;
    return full.trim();
  }catch(e){
    if(full) return full.trim();                         // se cortó a la mitad: se usa lo que alcanzó a llegar
    if(e instanceof OpenAIError) throw e;
    if(e && e.name === 'AbortError') throw new OpenAIError('timeout', 'La IA tardó demasiado en responder.');
    throw new OpenAIError('network', 'No hay conexión con la IA. Detalle: ' + (e && e.message ? e.message : e));
  }finally{
    clearTimeout(timer);
  }
}

// Abre la conexión con el servidor de la IA antes de preguntar (al abrir el chat), para que
// la primera pregunta no pierda tiempo negociando la conexión segura. No gasta cuota.
let aiWarmAt = 0;
function aiWarmUp(){
  if(!hasAIKey() || Date.now() - aiWarmAt < 60000) return;
  aiWarmAt = Date.now();
  try{
    if(getAIProvider() === 'openai') fetch('https://api.openai.com/v1/models/' + encodeURIComponent(getOpenAIModel()), { headers: { 'Authorization': 'Bearer ' + getOpenAIKey() } }).catch(() => {});
    else gFetch('/models/' + encodeURIComponent(getGeminiModel()), {}, getGeminiKey()).catch(() => {});
  }catch(e){}
}

async function openaiText(o){
  const tools = o.web ? (o.strictWeb ? ['web_search'] : ['web_search', 'web_search_preview', null]) : [null];
  let lastErr = null;
  for(const tool of tools){
    try{
      const result = await openaiResponses(model => {
        const body = { model, input: o.imageDataUrl
          ? [{ role: 'user', content: [{ type: 'input_text', text: o.prompt }, { type: 'input_image', image_url: o.imageDataUrl, detail: o.doc ? 'high' : (o.fast ? 'low' : 'auto') }] }]
          : o.prompt };
        if(o.json && !o.imageDataUrl) body.text = { format: { type: 'json_object' } };
        if(tool) body.tools = [{ type: tool }];
        if(o.maxOutputTokens && !/^(gpt-5|o\d)/.test(model)) body.max_output_tokens = o.maxOutputTokens;   // respuestas cortas = más rápidas
        // Los modelos que razonan (gpt-5, o3…) piensan a medias por defecto: se les pide lo mínimo.
        // «minimal» solo lo aceptan gpt-5/-mini/-nano y sin búsqueda web; «low» lo aceptan todos.
        if(/^(gpt-5|o\d)/.test(model) && !/chat/.test(model) && !aiSinPensarNo.has(model))
          body.reasoning = { effort: (!tool && /^gpt-5(-mini|-nano)?$/.test(model)) ? 'minimal' : 'low' };
        return body;
      }, o.timeoutMs, o.retries, o.oneModel, o.deadline);
      aiLastModel = result._model || '';
      return extractResponseText(result);
    }catch(err){
      lastErr = err;
      if(tool === null || !(err && ['bad', 'server', 'timeout', 'network', 'rate'].includes(err.kind))) throw err;
    }
  }
  throw lastErr;
}

// Punto único de entrada para la IA. o = { prompt, imageDataUrl?, json?, web?, strictWeb?, timeoutMs?, retries?, maxMs? }
// maxMs: tiempo máximo TOTAL (reintentos incluidos); pasado ese tiempo falla con kind 'timeout'.
// Carrera de modelos (cada modelo tiene su propia capacidad en Google): arranca el principal y, si a los
// `ventaja` ms no ha respondido (o falló / dijo «saturado»), arranca también el siguiente, y así hasta 3.
// Gana la primera respuesta que `sirve(texto)` acepte (devuelve el resultado o null). Así una factura no
// queda esperando a un modelo lento o saturado.
function aiCarrera(o, sirve, ventaja){
  if(getAIProvider() === 'openai') return aiText(o).then(t => { const v = sirve(t); if(!v) throw new OpenAIError('bad', 'La IA respondió pero no pude leer la respuesta.'); return v; });
  if(!hasAIKey()) return Promise.reject(new Error('NO_API_KEY'));
  const main = getGeminiModel();
  const corredores = aiOrdenModelos([main, ...GEMINI_MODEL_FALLBACKS.filter(m => m !== main)]).slice(0, 3);
  const deadline = o.deadline || (o.maxMs ? Date.now() + o.maxMs : 0);
  return new Promise((res, rej) => {
    let fin = false, vivos = 0, n = 0, ultimo = null, t = null;
    const terminar = (f, v) => { if(fin) return; fin = true; clearTimeout(t); f(v); };
    const revisar = () => { if(!fin && !vivos && n >= corredores.length) terminar(rej, ultimo || new OpenAIError('bad', 'La IA respondió pero no pude leer la respuesta.')); };
    const lanzar = () => {
      if(fin || n >= corredores.length) return;
      const m = corredores[n++]; vivos++;
      clearTimeout(t); t = setTimeout(lanzar, ventaja);
      aiText(Object.assign({}, o, { model: m, oneModel: true, retries: 0, deadline })).then(txt => {
        vivos--; if(fin) return;
        let v = null; try{ v = sirve(txt); }catch(e){}
        if(v) return terminar(res, v);
        ultimo = new OpenAIError('bad', 'La IA respondió pero no pude leer la respuesta.'); lanzar(); revisar();
      }, e => {
        vivos--; ultimo = e; if(fin) return;
        if(!(e && (AI_LADDER_KINDS.includes(e.kind) || e.kind === 'model'))) return terminar(rej, e);   // clave mala, etc.: se avisa ya
        lanzar(); revisar();
      });
    };
    lanzar();
  });
}
async function aiText(o){
  if(!hasAIKey()) throw new Error('NO_API_KEY');
  if(o.maxMs && !o.deadline) o = Object.assign({}, o, { deadline: Date.now() + o.maxMs });
  return getAIProvider() === 'openai' ? openaiText(o) : geminiText(o);
}

/* ---- Diagnóstico: probar la conexión y la clave ---- */
async function testAIConnection(){
  const lines = [];
  const prov = getAIProvider() === 'openai' ? 'OpenAI' : 'Gemini';
  const t0 = Date.now();
  await aiText({ prompt: 'Responde solo con la palabra OK.', timeoutMs: 60000, retries: 2 });
  lines.push('✅ Conexión y clave de ' + prov + ' correctas. Modelo: ' + aiLastModel + ' (' + (Math.round((Date.now() - t0) / 100) / 10) + ' s).');
  try{
    const t = await aiText({ prompt: 'Devuelve SOLO este JSON: {"ok":true}', json: true, timeoutMs: 45000, retries: 1 });
    lines.push(cleanAiJsonText(t) ? '✅ Modo voz con IA (JSON) funcionando.' : '⚠️ La IA respondió, pero no en JSON; la voz usará la interpretación clásica.');
  }catch(e){
    lines.push('⚠️ Modo voz con IA no disponible (' + e.message + ').');
  }
  try{
    await aiText({ prompt: 'Responde solo con la palabra OK.', web: true, strictWeb: true, timeoutMs: 90000, retries: 1 });
    lines.push('✅ Búsqueda web disponible.');
  }catch(e){
    lines.push('⚠️ La búsqueda web no está disponible (' + e.message + '). El escaneo funcionará igual, sin contrastar en la web.');
  }
  return lines.join('\n');
}

/* ---- Ventana de configuración (reemplaza el window.prompt, que algunos navegadores bloquean) ---- */
function openAIConfigDialog(){
  const old = document.getElementById('aiCfgOverlay');
  if(old) old.remove();
  const box = document.createElement('div');
  box.id = 'aiCfgOverlay';
  box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  const fieldCss = 'width:100%;box-sizing:border-box;padding:11px;margin:0 0 8px;border-radius:8px;border:1px solid var(--ink-soft,#0d9e2f);background:var(--bg,#000);color:var(--ink,#00ff41);font-size:15px;';
  box.innerHTML =
    '<div style="background:var(--surface,#050a05);color:var(--ink,#00ff41);border:1px solid var(--ink-soft,#0d9e2f);border-radius:14px;padding:18px;max-width:440px;width:100%;max-height:90vh;overflow:auto;">' +
      '<h3 style="margin:0 0 6px;font-size:18px;">⚙️ Configurar IA</h3>' +
      '<select id="aiCfgProvider" style="' + fieldCss + '">' +
        '<option value="gemini">Gemini (Google) — plan gratis</option>' +
        '<option value="openai">OpenAI — de pago</option>' +
      '</select>' +
      '<p id="aiCfgHelp" style="margin:0 0 10px;font-size:13px;opacity:.85;line-height:1.4;"></p>' +
      '<input id="aiCfgKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" style="' + fieldCss + '">' +
      '<input id="aiCfgModel" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="' + fieldCss + '">' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:0 0 8px;line-height:1.3;"><input type="checkbox" id="aiCfgWeb"> Verificar siempre en la web al escanear (más lento, más exacto)</label>' +
      '<pre id="aiCfgStatus" style="white-space:pre-wrap;word-break:break-word;font:13px/1.4 inherit;margin:4px 0 10px;min-height:18px;"></pre>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" id="aiCfgSave">Guardar</button>' +
        '<button type="button" class="btn-ghost" id="aiCfgTest">🔧 Probar conexión</button>' +
        '<button type="button" class="btn-ghost" id="aiCfgClose">Cerrar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(box);
  const provEl = box.querySelector('#aiCfgProvider');
  const helpEl = box.querySelector('#aiCfgHelp');
  const keyEl = box.querySelector('#aiCfgKey');
  const modelEl = box.querySelector('#aiCfgModel');
  const statusEl = box.querySelector('#aiCfgStatus');
  const webEl = box.querySelector('#aiCfgWeb');
  webEl.checked = aiWebAlways();

  const vals = {
    gemini: { key: lsGet(GEMINI_KEY_STORAGE), model: getGeminiModel() === GEMINI_MODEL_DEFAULT ? '' : getGeminiModel() },
    openai: { key: lsGet(OPENAI_KEY_STORAGE), model: getOpenAIModel() === OPENAI_MODEL_DEFAULT ? '' : getOpenAIModel() }
  };
  let current = getAIProvider();
  provEl.value = current;
  // 🗑️ Solo dueño o administrador, con la clave del negocio en el servidor (el campo vacío ya no la borra).
  const quitarBtn = document.createElement('button'); quitarBtn.type = 'button'; quitarBtn.className = 'btn-secondary'; quitarBtn.hidden = true;
  quitarBtn.style.cssText = 'margin-top:8px;width:100%'; quitarBtn.textContent = '🗑️ Quitar la clave del negocio (usar la IA de ORDEVA)';
  statusEl.after(quitarBtn);
  quitarBtn.onclick = async () => {
    if(!(await showConfirm({ title: 'Quitar la clave del negocio', message: 'Todos los equipos pasan a usar la IA de ORDEVA. ¿Seguro?', confirmText: 'Sí, quitar', icon: '🗑️' }))) return;
    try{ await quitarClaveNegocio(); showToast('Clave del negocio quitada: se usa la IA de ORDEVA.'); }catch(err){ showToast('No se pudo quitar: ' + (err && err.message ? err.message : err)); }
    paint();
  };

  const HELP = {
    gemini: 'La mejor y más fácil para leer facturas. <b>1.</b> Toca <b>🔑 Sacar mi clave gratis</b> (entra con tu cuenta de Google → «Create API key»). <b>2.</b> Cópiala, pégala aquí y toca <b>Guardar</b>. Empieza por <b>AIza</b> o <b>AQ.</b>. Se configura <b>una sola vez</b>: con ORDEVA Nube queda guardada en el servidor y sirve en todos los celulares del negocio sin copiarse en ninguno.<br><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:9px 12px;border-radius:10px;border:1px solid currentColor;color:inherit;text-decoration:none;font-weight:700">🔑 Sacar mi clave gratis</a>',
    openai: 'Pega tu API key de OpenAI (empieza por <b>sk-</b>). Se guarda solo en este dispositivo. No la compartas. La app no pone límites; los únicos son los de tu cuenta en platform.openai.com.'
  };
  const paint = () => {
    helpEl.innerHTML = HELP[current];
    keyEl.placeholder = current === 'gemini' ? 'AIza… o AQ.…' : 'sk-...';
    modelEl.placeholder = 'Modelo (por defecto ' + (current === 'gemini' ? GEMINI_MODEL_DEFAULT : OPENAI_MODEL_DEFAULT) + ')';
    keyEl.value = vals[current].key;
    modelEl.value = vals[current].model;
    const has = current === 'gemini' ? getGeminiKey() : getOpenAIKey();
    const neg = iaNegEstado();
    if(current === 'gemini' && has === IA_NEGOCIO) keyEl.placeholder = iaNegAdmin() ? 'Guardada en el servidor' + (neg && neg.final ? ' (…' + neg.final + ')' : '') + ': pega otra solo para cambiarla' : 'La pone el dueño o el administrador';
    quitarBtn.hidden = !(current === 'gemini' && has === IA_NEGOCIO && iaNegAdmin());
    statusEl.textContent = has === IA_NEGOCIO && current === 'gemini' ? '🔐 La IA usa la clave del negocio, guardada en el Servidor ORDEVA' + (neg && neg.final && iaNegAdmin() ? ' (termina en ' + neg.final + ')' : '') + '. Ningún celular la guarda.'
      : vals[current].key ? 'Hay una clave guardada en este dispositivo.' : (has === IA_VENTO ? '✅ IA de ORDEVA ya configurada: no tienes que poner nada. (Si quieres usar tu propia clave, pégala arriba.)' : has ? 'Usando la clave incluida dentro del archivo de la app.' : 'Aún no hay clave guardada.');
  };
  paint();
  provEl.onchange = () => {
    vals[current].key = keyEl.value; vals[current].model = modelEl.value;
    current = provEl.value;
    paint();
  };
  const persist = () => {
    vals[current].key = keyEl.value; vals[current].model = modelEl.value;
    // Con la clave del negocio en el servidor, dejar el campo vacío NO la borra (para eso está «🗑️ Quitar»).
    const g = (vals.gemini.key || '').replace(/\s+/g, '');
    const p = (g || getGeminiKey() !== IA_NEGOCIO) ? setGeminiKey(g) : Promise.resolve(null);
    setGeminiModel(vals.gemini.model);
    setOpenAIKey(vals.openai.key); setOpenAIModel(vals.openai.model);
    setAIProvider(current);
    lsSet(AI_WEB_ALWAYS_KEY, webEl.checked ? '1' : '');
    return p;
  };
  // Guardar = guardar Y comprobar de una vez (antes había que tocar «Probar conexión» aparte).
  box.querySelector('#aiCfgSave').onclick = async () => {
    try{ const j = await persist(); if(j && j.tiene){ vals.gemini.key = ''; keyEl.value = ''; } }
    catch(err){ statusEl.textContent = '❌ ' + (err && err.message ? err.message : err); return; }
    if(!hasAIKey()){ statusEl.textContent = 'Clave eliminada.'; showToast('Clave de IA eliminada.'); return; }
    statusEl.textContent = 'Guardado. Comprobando que funciona…';
    try{
      await aiText({ prompt: 'Responde solo con la palabra OK.', timeoutMs: 30000, retries: 1 });
      statusEl.textContent = '✅ Listo: la IA quedó configurada para el negocio (modelo ' + aiLastModel + '). Ya puedes escanear facturas.';
      showToast('✅ IA configurada: ya puedes escanear facturas.', 6000);
    }catch(err){ statusEl.textContent = '⚠️ Se guardó, pero no funcionó: ' + (err && err.message ? err.message : err); }
  };
  box.querySelector('#aiCfgTest').onclick = async () => {
    try{ await persist(); }catch(err){ statusEl.textContent = '❌ ' + (err && err.message ? err.message : err); return; }
    if(!hasAIKey()){ statusEl.textContent = 'Primero pega tu API key.'; return; }
    statusEl.textContent = 'Probando…';
    try{ statusEl.textContent = await testAIConnection(); }
    catch(err){ statusEl.textContent = '❌ ' + (err && err.message ? err.message : err); }
  };
  // Navegador con la IA ya conectada: un toque la pasa a la app de Android (que tiene su propia memoria).
  try{
    const k = getGeminiKey();
    if(k && k !== IA_VENTO && k !== IA_NEGOCIO && !window.VentoAndroid && window.esAndroid && window.esAndroid()){
      const ln = document.createElement('a'); ln.className = 'btn-primary'; ln.style.cssText = 'display:block;text-align:center;padding:12px;border-radius:12px;text-decoration:none;margin-top:10px';
      ln.textContent = '📲 Pasar la IA a la app ORDEVA'; ln.href = 'vento://abrir#iaclave=' + encodeURIComponent(k);
      const n = document.createElement('div'); n.className = 'settings-desc'; n.textContent = 'Abre la app ORDEVA de este celular y le deja la IA conectada (no hay que volver a pegar la clave).';
      statusEl.after(ln, n);
    }
  }catch(e){}
  box.querySelector('#aiCfgClose').onclick = () => box.remove();
  box.addEventListener('click', (e) => { if(e.target === box) box.remove(); });
}

aiConfigBtn.addEventListener('click', openAIConfigDialog);

cameraBtn.addEventListener('click', ()=> cameraInput.click());

/* ---- Foto: se reduce antes de enviarla (las fotos del celular pesan varios MB) ---- */
function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

/* Abre la foto lo más rápido posible: createImageBitmap la decodifica directo del archivo (fuera del
   hilo principal en muchos celulares), sin convertir primero los varios MB de la foto a texto base64.
   Si el navegador no puede, se usa el camino de siempre. */
async function fotoBitmap(file){
  if(typeof createImageBitmap !== 'function' || !(file instanceof Blob)) return null;
  try{ return await createImageBitmap(file, { imageOrientation: 'from-image' }); }catch(e){ try{ return await createImageBitmap(file); }catch(e2){ return null; } }
}
async function fotoEscalada(file, maxSide, quality, filtro){
  const bm = await fotoBitmap(file); if(!bm) return null;
  try{
    const scale = Math.min(1, maxSide / Math.max(bm.width, bm.height));
    const w = Math.max(1, Math.round(bm.width * scale)), h = Math.max(1, Math.round(bm.height * scale));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    if(filtro && 'filter' in ctx) ctx.filter = filtro;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bm, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }catch(e){ return null; }
  finally{ try{ bm.close(); }catch(e){} }
}
async function scalePhotoForAI(file, maxSide, quality){
  const rapida = await fotoEscalada(file, maxSide, quality, '');
  if(rapida) return rapida;
  const original = await readFileAsDataUrl(file);
  try{
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('img'));
      im.src = original;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }catch(e){
    return original; // si el navegador no puede reducirla, se envía tal cual
  }
}
// Igual que scalePhotoForAI, pero pensada específicamente para fotos de
// FACTURA (con cámara o de galería): a diferencia de una foto de producto,
// aquí no importa ningún color — lo único que importa es poder LEER el texto
// impreso, muchas veces con luz de tienda pareja, algo de sombra o poco
// contraste (típico de una foto de celular tomada rápido al mostrador).
// Pasar la imagen a blanco y negro + subirle el contraste resalta las letras
// y números frente al papel, ayuda a que la IA lea mejor los renglones — y de
// paso el archivo pesa bastante menos en blanco y negro, así que se puede
// mandar en una resolución más alta (mejor para letra pequeña) sin que la
// lectura se vuelva más lenta.
async function scaleInvoicePhotoForAI(file, maxSide, quality){
  const rapida = await fotoEscalada(file, maxSide, quality, 'grayscale(1) contrast(1.35) brightness(1.08)');
  if(rapida) return rapida;
  const original = await readFileAsDataUrl(file);
  try{
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('img'));
      im.src = original;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    if('filter' in ctx) ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.08)';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }catch(e){
    return original;
  }
}

const PRODUCT_PROMPT = 'Identifica el producto de esta foto. Si tienes búsqueda web disponible, úsala para contrastar la marca y la presentación. Devuelve SOLO JSON válido (sin texto extra, sin ```), con estas claves: name, brand, size, unit, presentation, specifications, confidence, search_query. No inventes datos; si algo no es visible o verificable usa cadena vacía. name debe ser el nombre comercial corto, size el tamaño numérico si se puede verificar, unit ml/l/g/kg/unidad cuando aplique, presentation lata/botella/paquete/bolsa/caja/vaso/etc., specifications una lista breve de características visibles o verificadas, confidence un número de 0 a 1, search_query la consulta usada.';

const FAST_PROMPT = 'Identifica el producto de la foto. Responde SOLO JSON: {"name","brand","size","unit","presentation","specifications","confidence"}. name=nombre comercial corto, size=número, unit=ml/l/g/kg/unidad, specifications=lista breve, confidence 0-1. Si algo no se ve usa "". ';
const AI_WEB_ALWAYS_KEY = 'bar-ai-web-always';
const aiWebAlways = () => lsGet(AI_WEB_ALWAYS_KEY) === '1';
const PRODUCT_PROMPT_WEB_SENTENCE = 'Si tienes búsqueda web disponible, úsala para contrastar la marca y la presentación. ';

// Modo rápido: primero se lee la foto SIN búsqueda web (2-4 s). Solo si la IA no queda segura
// (o si activaste "Verificar siempre en la web") se hace la segunda pasada con búsqueda web.
async function recognizeProductWithAI(dataUrl, onStatus){
  const fastPrompt = FAST_PROMPT + invCatalogHint();
  // Rápido: si la lectura directa ya trae el nombre, se usa de una vez (la verificación web de 25-90 s
  // solo cuando no se reconoció nada o si activaste «Verificar siempre en la web»).
  const isGood = (i) => !!(i && (i.name || i.brand));
  let info = null;
  if(!aiWebAlways()){
    try{
      info = cleanAiJsonText(await aiText({ prompt: fastPrompt, imageDataUrl: dataUrl, json: true, timeoutMs: 7000, retries: 0, oneModel: true, fast: true, maxOutputTokens: 600 }));
      if(isGood(info)) return info;
    }catch(err){
      if(!(err && AI_LADDER_KINDS.includes(err.kind))) throw err;   // clave, cuota, etc.: se avisa tal cual
    }
  }
  if(onStatus) onStatus('Verificando en la web para más precisión…');
  try{
    // Si ya hay una lectura rápida usable, la verificación es un extra: corta, sin reintentos ni cambio de modelo.
    const web = cleanAiJsonText(await aiText(info
      ? { prompt: PRODUCT_PROMPT, imageDataUrl: dataUrl, json: true, web: true, strictWeb: true, timeoutMs: 25000, retries: 0, oneModel: true }
      : { prompt: PRODUCT_PROMPT, imageDataUrl: dataUrl, json: true, web: true, timeoutMs: 90000, retries: 2 }));
    if(web) return web;
  }catch(err){
    if(!info) throw err;          // si la verificación falla pero la lectura rápida sirvió algo, se usa esa
  }
  if(info) return info;
  throw new OpenAIError('bad', 'La IA respondió pero no pude leer el resultado. Prueba con otra foto, más cerca de la etiqueta y con buena luz.');
}

// Open Food Facts: base de productos libre y gratis, consultada por código
// de barras (EAN/UPC) — no necesita API key ni cuenta, y no tiene tope de
// consultas para uso normal (1 código escaneado = 1 consulta). Su cobertura
// es fuerte en productos empacados internacionales/de supermercado, pero
// floja en marcas 100% locales de tienda de barrio (licores nacionales,
// dulces colombianos, cigarrillos), así que se usa como complemento GRATIS
// cuando no hay IA configurada — nunca reemplaza escribirlo a mano si el
// código no aparece en su base.
async function lookupOpenFoodFacts(barcode){
  if(!barcode) return null;
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let res;
    try{
      res = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(barcode) + '.json?fields=product_name,product_name_es,brands,quantity,status', { signal: ctrl.signal });
    }finally{ clearTimeout(timer); }
    if(!res.ok) return null;
    const data = await res.json();
    if(!data || data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = String(p.product_name_es || p.product_name || '').trim();
    if(!name) return null;
    return {
      name,
      brand: String(p.brands || '').split(',')[0].trim(),
      size: String(p.quantity || '').trim()
    };
  }catch(e){ return null; }   // sin internet, timeout, o no encontrado: se sigue con el flujo normal
}
async function recognizeProductFallback(file){
  // Sin API key configurada: primero intenta leer el código de barras y, si
  // lo logra, busca el producto GRATIS en Open Food Facts (sin IA ni clave)
  // antes de rendirse; si el código no aparece ahí, al menos deja el código
  // detectado para que el usuario lo complete a mano.
  if('BarcodeDetector' in window){
    try{
      const detector = new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      const codes = await detector.detect(img);
      if(codes && codes[0] && codes[0].rawValue){
        const code = codes[0].rawValue;
        const off = await lookupOpenFoodFacts(code);
        if(off && off.name){
          return {name: off.name, brand: off.brand, size: off.size, unit:'', presentation:'', specifications:['Código de barras: '+code, 'Fuente: Open Food Facts'], confidence:0.7, raw:code};
        }
        return {name:'', brand:'', size:'', unit:'', presentation:'', specifications:['Código de barras: '+code], confidence:0.5, raw:code};
      }
    }catch(e){}
  }
  throw new Error('NO_API_KEY');
}

cameraInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  cameraBtn.disabled = true;
  cameraBtn.textContent = '📷 Analizando…';
  photoPreview.classList.add('show');
  photoStatus.textContent = 'Preparando la foto…';
  try{
    const dataUrl = await scalePhotoForAI(file, 640, 0.7);
    photoPreviewImg.src = dataUrl;
    photoStatus.textContent = 'Analizando imagen y completando la información del producto…';
    let info;
    try{
      info = await recognizeProductWithAI(dataUrl, (m) => { photoStatus.textContent = m; });
    }catch(err){
      if(err.message === 'NO_API_KEY'){
        info = await recognizeProductFallback(file);
      } else throw err;
    }
    if(info && info.raw && !info.name){
      photoStatus.textContent = 'Código de barras detectado: '+info.raw+'. Configura la IA para identificar automáticamente el producto.';
    } else {
      const displayName = [info.brand, info.name].filter(Boolean).join(' ').trim() || info.name || '';
      const details = [info.size && info.unit ? info.size+' '+info.unit : info.size, info.presentation].filter(Boolean).join(' · ');
      if(!displayName){
        photoStatus.textContent = 'La IA no logró identificar el producto en la foto. Acércate a la etiqueta, con buena luz, o escríbelo manualmente.';
      } else {
        document.getElementById('prodName').value = displayName;
        document.getElementById('prodSpecs').value = Array.isArray(info.specifications) ? info.specifications.join(', ') : (info.specifications || '');
        if(info.size && info.unit) document.getElementById('prodSize').value = info.size + ' ' + info.unit;
        else if(info.size) document.getElementById('prodSize').value = String(info.size);
        photoStatus.textContent = 'Detectado: '+displayName+(details ? ' — '+details : '')+'. Revisa y agrega el precio.';
        document.getElementById('prodPrice').focus();
        const exist = invMatch(displayName);
        if(exist){ photoStatus.textContent = 'Detectado: '+exist.name+' — ya está en tu lista.'; setTimeout(()=>invAsk(exist.id,'in'), 250); }
      }
    }
  }catch(err){
    if(err.message === 'NO_API_KEY'){
      photoStatus.textContent = 'Configura la IA para reconocimiento por foto. También puedes usar el código de barras si tu navegador lo soporta.';
      showToast('Pulsa “⚙️ Configurar IA” y agrega tu API key (o usa la IA de ORDEVA, que ya viene incluida).');
    } else {
      photoStatus.textContent = '❌ ' + (err && err.message ? err.message : 'No se pudo reconocer el producto.') + ' Puedes escribirlo manualmente.';
      console.error(err);
    }
  }finally{
    cameraBtn.disabled = false;
    cameraBtn.innerHTML = cameraBtnLabel;
    cameraInput.value = '';
  }
});

/* ---------- Inventario: stock, alertas y "cuándo se agota" ---------- */
const INV_DEF_MIN = 5, INV_DAY = 864e5;
const invNum = v => (v === '' || v == null || isNaN(v)) ? null : Math.max(0, Math.floor(+v));
const invEsc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function invRate(pid){                       // unidades por día, promedio de los últimos 14 días
  const L = data.stockLog || [], since = Date.now() - 14 * INV_DAY;
  if(!L.length) return 0;
  const net = L.reduce((s, x) => (x.p === pid && x.at >= since) ? s + x.q : s, 0);
  const span = Math.max(1, Math.min(14, (Date.now() - Math.max(since, L[0].at)) / INV_DAY));
  return net > 0 ? net / span : 0;
}
function invDays(p){ const r = invRate(p.id); return (p.stock == null || !(r > 0)) ? null : p.stock / r; }
function invStatus(p){
  if(p.stock == null) return 'none';
  if(p.stock <= 0) return 'out';
  const d = invDays(p);
  return (p.stock <= (p.minStock != null ? p.minStock : INV_DEF_MIN) || (d != null && d <= 2)) ? 'low' : 'ok';
}
function invChip(p){
  const s = invStatus(p);
  if(s === 'none') return '';
  return `<span class="inv-chip inv-${s}">${s === 'out' ? '🚫 Agotado' : s === 'low' ? '⚠️ Quedan ' + p.stock : '📦 ' + p.stock}</span>`;
}
function invBadge(){
  if(typeof data === 'undefined' || !data) return;
  const n = data.products.filter(p => ['out','low'].includes(invStatus(p))).length;
  const b = document.getElementById('invBadge'); if(b) b.textContent = n || '';
}
function invOnSale(item, q){                 // se llama solo, cada vez que cambia la cantidad de un ítem en una cuenta
  const p = data.products.find(x => x.id === item.productId);
  if(!p || !q) return;
  if(p.combo){ p.combo.forEach(c => invOnSale({ productId: c.id }, q * c.qty)); return; }   // un combo descuenta sus productos
  const before = invStatus(p);
  data.stockLog = data.stockLog || [];
  data.stockLog.push({ p: p.id, q, at: Date.now() });
  if(data.stockLog.length > 3000) data.stockLog = data.stockLog.slice(-2500);
  if(p.stock == null) return;
  p.stock = Math.max(0, p.stock - q);
  invBadge();
}
function invMatch(name){                     // busca un producto ya registrado por nombre
  const n = normVoiceText(name || ''); if(n.length < 3) return null;
  const exact = data.products.find(p => { const k = normVoiceText(p.name); return k === n || (k.length >= 4 && (n.includes(k) || k.includes(n))); });
  if(exact) return exact;
  // Si no hay coincidencia directa por nombre, prueba con los sinónimos y
  // nombres de marca conocidos (ej. una factura o etiqueta que dice "POKER"
  // o "AGUILA" cuando el producto en el catálogo se llama "Aguila/Póker") —
  // el mismo sistema de alias y tolerancia a errores de tipeo que ya usan
  // los comandos de voz, para no crear productos duplicados por una marca.
  return findProductByVoiceAlias(name) || null;
}
function invCatalogHint(){                   // la foto se compara con tus productos: mismo nombre, sin duplicados
  const names = data.products.slice(0, 60).map(p => p.name).join('; ');
  if(!names) return '';
  return 'Productos ya registrados (si coincide, usa exactamente ese nombre): ' + names + '. ' +
    'Muchas marcas colombianas de cervecería/cafetería aparecen con nombres distintos en facturas o etiquetas ' +
    '(ej: "Águila" y "Póker" pueden ser el mismo producto de catálogo "Aguila/Póker"; "Costeña" y "Costeñita" según la presentación; ' +
    '"Club" es "Club Colombia"; "Coca" es "Coca-Cola"; "Pony" es "Pony Malta"): si el nombre leído es una variante o sinónimo de marca ' +
    'de un producto ya registrado, úsalo como ese mismo producto en vez de crear uno nuevo.';
}
function invDlg(html, onOk){
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:14px';
  o.innerHTML = '<div style="background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:16px;width:100%;max-width:360px;max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:10px">' + html +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn-ghost" data-r="0">Cancelar</button><button type="button" class="btn-primary" data-r="1">Guardar</button></div></div>';
  o.addEventListener('click', e => { const b = e.target.closest('button[data-r]'); if(!b) return; if(b.dataset.r === '1' && onOk(o) === false) return; o.remove(); });
  document.body.appendChild(o); const f = o.querySelector('input'); if(f) setTimeout(() => { f.focus(); f.select(); }, 50);
  return o;
}
const INV_IN = 'type="number" inputmode="numeric" min="0" style="padding:10px;font-size:17px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;width:100%;box-sizing:border-box"';
function invSetup(){
  const ps = data.products.filter(p => p.stock == null && !p.combo); if(!ps.length) return;
  invDlg('<b>¿Cuántas unidades hay hoy de cada uno?</b><small style="color:var(--ink-soft)">Deja vacío los que no quieras controlar.</small>' +
    ps.map(p => '<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14px"><span>' + invEsc(p.name) + '</span><input ' + INV_IN.replace('width:100%', 'width:90px') + ' data-id="' + p.id + '"></label>').join(''),
    o => {
      let n = 0;
      o.querySelectorAll('input[data-id]').forEach(i => { const v = invNum(i.value), p = data.products.find(x => x.id === i.dataset.id); if(v != null && p){ p.stock = v; n++; } });
      if(n){ saveData(); renderInventario(); renderProductos(); showToast('✅ Stock guardado en ' + n + ' producto' + (n > 1 ? 's' : '') + '. Ya se descuenta al vender.'); }
    });
}
