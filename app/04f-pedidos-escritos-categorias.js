/* ORDEVA · app/04f-pedidos-escritos-categorias.js — parte 6 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
/* ---------- Pedido escrito (WhatsApp, web, Instagram…) → domicilio, con IA ---------- */
const DOM_IA_PROMPT = 'Eres el asistente de un restaurante/tienda. Te paso un mensaje de un cliente pidiendo a domicilio (puede venir de WhatsApp, de una página web o de una captura de pantalla). Devuelve SOLO un JSON con esta forma exacta: {"cliente":"nombre o cadena vacía","telefono":"solo dígitos o cadena vacía","direccion":"dirección de entrega o cadena vacía","envio":0,"items":[{"nombre":"producto tal como lo pidió","cantidad":1}]}. Reglas: si no aparece un dato, deja la cadena vacía (no inventes). "envio" solo si el mensaje dice explícitamente el valor del domicilio, si no 0. En "items" pon un objeto por producto pedido, con la cantidad en número (si no dice cantidad, 1). No agregues texto fuera del JSON.';
function domIaAbrir(){
  document.getElementById('domIaTxt').value = '';
  const est = document.getElementById('domIaEstado'); est.hidden = true; est.textContent = '';
  domIaFotoUrl = null;
  document.getElementById('domIaOverlay').classList.add('show');
}
function domIaCerrar(){ document.getElementById('domIaOverlay').classList.remove('show'); }
let domIaFotoUrl = null;
function iniDomIa(){
  const ov = document.getElementById('domIaOverlay'); if(!ov) return;
  document.getElementById('domIaClose').onclick = domIaCerrar;
  document.getElementById('domIaCancel').onclick = domIaCerrar;
  ov.addEventListener('click', e => { if(e.target === ov) domIaCerrar(); });
  const foto = document.getElementById('domIaFoto'), est = document.getElementById('domIaEstado');
  document.getElementById('domIaFotoBtn').onclick = () => foto.click();
  foto.addEventListener('change', async e => {
    const f = e.target.files[0]; if(!f) return;
    est.hidden = false; est.textContent = 'Preparando la captura…';
    try{ domIaFotoUrl = await scalePhotoForAI(f, 1280, 0.7); est.textContent = '✅ Captura lista. Toca «Armar el domicilio».'; }
    catch(err){ domIaFotoUrl = null; est.textContent = '❌ No pude leer la imagen.'; }
    foto.value = '';
  });
  document.getElementById('domIaGo').onclick = async () => {
    const txt = document.getElementById('domIaTxt').value.trim();
    if(!txt && !domIaFotoUrl) return showToast('Pega el mensaje del cliente o sube la captura.');
    const b = document.getElementById('domIaGo'); b.disabled = true; b.textContent = '🤖 Leyendo…';
    est.hidden = false; est.textContent = 'La IA está leyendo el pedido…';
    try{
      const pet = { prompt: DOM_IA_PROMPT + (txt ? '\n\nMensaje del cliente:\n' + txt : ''), json: true, timeoutMs: 45000, retries: 1 };
      if(domIaFotoUrl) pet.imageDataUrl = domIaFotoUrl;
      const info = cleanAiJsonText(await aiText(pet));
      if(!info || !Array.isArray(info.items)) throw new OpenAIError('bad', 'La IA respondió pero no pude leer el pedido. Prueba pegando el texto del chat.');
      domIaCerrar();
      domRecibirDeIa(info);
    }catch(err){
      const msg = err && err.message === 'NO_API_KEY'
        ? 'Configura la IA (⚙️ en Productos) para usar esta opción.'
        : (err && err.message ? err.message : 'No se pudo leer el pedido.');
      est.textContent = '❌ ' + msg;
    }finally{ b.disabled = false; b.textContent = 'Armar el domicilio'; }
  };
}
// Lo que entendió la IA se guarda como un domicilio pendiente más y se abre la factura.
function domRecibirDeIa(info){
  const items = (info.items || []).map(x => (Math.max(1, parseInt(x.cantidad, 10) || 1)) + ' ' + String(x.nombre || '').trim()).filter(x => x.length > 2);
  const d = { id: Date.now() + '' + Math.random().toString(36).slice(2, 5), ts: Date.now(),
              nombre: String(info.cliente || '').slice(0, 40), tel: String(info.telefono || '').replace(/[^\d+ ]/g, '').slice(0, 15),
              dir: String(info.direccion || '').slice(0, 90), texto: items.join(', ') };
  const l = domisPend(); l.push(d); domisGuardar(l);
  domAbrir(d.id);
  const envio = parseFloat(info.envio);
  if(isFinite(envio) && envio > 0){ document.getElementById('qsEnvio').value = Math.round(envio); qsRenderCart(); }
}

/* Registra una venta SIN mesa (venta rápida, domicilio, caja de tienda y modo fácil): una entrada en
   data.history y el descuento de inventario, una sola vez. cart = [{productId, name, price, qty}].
   opts: method ('efectivo'|'transferencia'|'debe'), deudor, nota (ej. «Nequi»), domicilio {cliente, telefono, direccion, envio}.
   Devuelve la entrada del historial (sirve para deshacer con qsDeshacerVenta). */
function qsRegistrarVenta(cart, opts){
  opts = opts || {};
  const dom = opts.domicilio || null;
  const envio = dom && dom.envio > 0 ? dom.envio : 0;
  const method = opts.method || 'efectivo';
  const deudor = method === 'debe' ? (opts.deudor || '') : '';
  const items = cart.map(it => Object.assign({
    name: it.name,
    qty: it.qty,
    price: it.price,
    cost: (data.products.find(p=>p.id===it.productId)||{}).cost ?? null
  }, it.unidad ? { unidad: it.unidad } : {}, it.productId ? { productId: it.productId } : {}, it.precioLista != null && it.precioLista !== it.price ? { precioLista: it.precioLista } : {}));      // ⚖️ por kilo/libra · 🏷️ precio antes del descuento
  // El valor del domicilio se suma como una línea más (igual que la propina),
  // así el total del recibo y de las estadísticas ya lo incluyen sin tener
  // que tocar nada más en la app.
  if(dom && envio > 0) items.push({ name: '🛵 Domicilio', qty: 1, price: envio, cost: null });
  const total = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0));   // sin centavos (también con productos por peso)
  const entry = {
    id: Date.now().toString() + '-qs',
    table: null,
    tableName: dom ? ('🛵 Domicilio' + (dom.cliente ? ': ' + dom.cliente : '')) : 'Mostrador',
    businessName: data.businessName,
    total,
    // Pago mixto (caja POS): cada parte queda como un pago aparte (efectivo + transferencia…).
    payments: method !== 'debe' && Array.isArray(opts.pagos) && opts.pagos.length
      ? opts.pagos.map(p => ({ note: p.note || opts.nota || 'Venta de mostrador', amount: p.amount, method: p.method }))
      : [{ note: method === 'debe' ? deudor : (opts.nota || (dom ? 'Domicilio' : 'Venta de mostrador')), amount: total, method }],
    debt: method === 'debe' ? total : 0,
    person: method === 'debe' ? deudor : null,
    items,
    delivery: dom ? { cliente: dom.cliente || '', telefono: dom.telefono || '', direccion: dom.direccion || '', envio } : null,
    date: new Date().toISOString(),
    by: (typeof authUser !== 'undefined' && authUser) ? authUser : null
  };
  // Lo que se descontó del inventario queda anotado en la venta (sin guardarlo): así «deshacer» devuelve lo mismo.
  Object.defineProperty(entry, '_inv', { value: cart.filter(it => it.productId).map(it => ({ productId: it.productId, qty: it.qty })), enumerable: false });
  if(opts.cliente){ entry.dianCliente = opts.cliente; entry.dianFactura = !!opts.factura; }
  // 🏷️ 1.67.5: descuento (ya repartido en el precio de cada producto) y 📝 nota de la venta.
  if(opts.descuento && opts.descuento.valor > 0) entry.descuento = { valor: Math.round(opts.descuento.valor), bruto: Math.round(opts.descuento.bruto || 0), tipo: opts.descuento.tipo, v: opts.descuento.v, por: opts.descuento.por || '', quien: opts.descuento.quien || '' };
  if(opts.observacion) entry.observacion = String(opts.observacion).slice(0, 140);
  // 💵 1.67.0: el efectivo que entregó el cliente y las vueltas quedan en la venta (no son ingreso: el pago en efectivo
  // sigue siendo lo que se aplicó a la venta, y las vueltas no son otra venta ni un gasto).
  if(Number(opts.recibido) > 0 && method !== 'debe'){
    const ef = entry.payments.find(p => p.method === 'efectivo');
    if(ef){ ef.recibido = Math.round(Number(opts.recibido)); ef.vueltas = Math.max(0, Math.round(Number(opts.vueltas) || 0)); }
    entry.efectivoRecibido = Math.round(Number(opts.recibido)); entry.vueltas = Math.max(0, Math.round(Number(opts.vueltas) || 0));
  }
  data.history.unshift(entry);
  entry._inv.forEach(it => { try{ invOnSale({ productId: it.productId }, it.qty); }catch(e){} });
  try{ window.ventoDian && window.ventoDian.alVender(entry); }catch(e){}   // 🧾 a la DIAN (si está prendida)
  saveData();
  return entry;
}
// Deshace una venta recién registrada con qsRegistrarVenta: la saca del historial y devuelve el inventario.
function qsDeshacerVenta(entry){
  const i = entry ? data.history.findIndex(h => h === entry || h.id === entry.id) : -1;
  if(i < 0) return false;
  data.history.splice(i, 1);
  (entry._inv || []).forEach(it => { try{ invOnSale({ productId: it.productId }, -it.qty); }catch(e){} });
  try{ window.ventoDian && window.ventoDian.alDeshacer(entry); }catch(e){}   // 🧾 si ya salió a la DIAN: nota crédito
  saveData();
  return true;
}
window.qsRegistrarVenta = qsRegistrarVenta;
window.qsDeshacerVenta = qsDeshacerVenta;
document.getElementById('qsChargeBtn').addEventListener('click', async ()=>{
  if(!quickSaleCart.length) return;
  const isDom = qsMode === 'domicilio';
  const envio = qsEnvioValor();
  const total = qsTotal();
  const cliente = isDom ? document.getElementById('qsCliente').value.trim() : '';
  const telefono = isDom ? document.getElementById('qsTelefono').value.trim() : '';
  const direccion = isDom ? document.getElementById('qsDireccion').value.trim() : '';
  const ok = await showConfirm({
    title: isDom ? '¿Facturar este domicilio?' : '¿Cobrar esta venta?',
    message: (isDom ? 'Vas a registrar un domicilio' + (cliente ? ' para ' + cliente : '') + ' por ' : 'Vas a registrar una venta de mostrador por ') + fmt(total) + '. Esta acción no se puede deshacer.',
    confirmText: isDom ? 'Sí, facturar' : 'Sí, cobrar',
    icon: isDom ? '🛵' : '⚡'
  });
  if(!ok) return;
  const method = document.getElementById('qsMethod').value;
  const deudor = (document.getElementById('qsDebeName').value || '').trim() || (isDom && cliente ? cliente : '');
  if(method === 'debe' && !deudor){ showToast('⚠️ Escribe quién queda debiendo.'); return; }
  qsRegistrarVenta(quickSaleCart, { method, deudor, domicilio: isDom ? { cliente, telefono, direccion, envio } : null });
  quickSaleCart = [];
  if(isDom && domActual){ domQuitar(domActual); domActual = null; }
  document.getElementById('quickSaleOverlay').classList.remove('show');
  if(method !== 'debe') sonidoPos('success');
  if(method !== 'debe') try{ window.mesoraCelebrar && window.mesoraCelebrar(isDom ? ['🛵', '💰', '✨'] : ['💰', '✨', '🎉']); }catch(e){}
  showToast(method === 'debe' ? '⏳ ' + deudor + ' quedó debiendo ' + fmt(total) + '. Está en Historial → Deben.' : (isDom ? '✅ Domicilio facturado: ' + fmt(total) + '.' : '✅ Venta de mostrador registrada: ' + fmt(total) + '.'));
});

/* ---------- Categorías ---------- */
const CATEGORY_COLOR_VARS = ['--cat-1','--cat-2','--cat-3','--cat-4','--cat-5','--cat-6'];
function categoryColorVar(categoryId){
  const idx = data.categories.findIndex(c=>c.id === categoryId);
  if(idx === -1) return null;
  return `var(${CATEGORY_COLOR_VARS[idx % CATEGORY_COLOR_VARS.length]})`;
}
function categoryName(categoryId){
  const cat = data.categories.find(c=>c.id === categoryId);
  return cat ? cat.name : 'Sin categoría';
}

function renderCategoryBar(){
  const bar = document.getElementById('categoryBar');
  bar.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'chip' + (currentCategoryFilter === null ? ' active' : '');
  allChip.textContent = 'Todas';
  allChip.addEventListener('click', ()=>{ currentCategoryFilter = null; renderProductos(); });
  bar.appendChild(allChip);

  data.categories.forEach(cat=>{
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (currentCategoryFilter === cat.id ? ' active' : '');
    chip.innerHTML = `<span class="dot" style="background:${categoryColorVar(cat.id)}"></span>${cat.name}<span class="chip-del" data-id="${cat.id}" title="Eliminar categoría">✕</span>`;
    chip.addEventListener('click', (e)=>{
      if(e.target.classList.contains('chip-del')) return;
      currentCategoryFilter = cat.id;
      renderProductos();
    });
    bar.appendChild(chip);
  });

  const hasUncategorized = data.products.some(p=>!p.categoryId);
  if(hasUncategorized){
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (currentCategoryFilter === '__none__' ? ' active' : '');
    chip.textContent = 'Sin categoría';
    chip.addEventListener('click', ()=>{ currentCategoryFilter = '__none__'; renderProductos(); });
    bar.appendChild(chip);
  }

  const addChip = document.createElement('button');
  addChip.type = 'button';
  addChip.className = 'chip chip-add';
  addChip.textContent = '+ Categoría';
  addChip.addEventListener('click', ()=> abrirNuevaCategoria());
  bar.appendChild(addChip);

  bar.querySelectorAll('.chip-del').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = btn.dataset.id;
      if(!confirm('¿Eliminar esta categoría? Los productos que la usan quedarán sin categoría.')) return;
      data.categories = data.categories.filter(c=>c.id !== id);
      data.products.forEach(p=>{ if(p.categoryId === id) p.categoryId = null; });
      if(currentCategoryFilter === id) currentCategoryFilter = null;
      saveData();
      renderProductos();
    });
  });
}

document.getElementById('confirmCategoryBtn').addEventListener('click', ()=>{
  const input = document.getElementById('newCategoryName');
  const name = input.value.trim();
  if(!name){ showToast('Escribe un nombre para la categoría.'); return; }
  data.categories.push({ id: Date.now().toString(), name });
  input.value = '';
  document.getElementById('categoryAddRow').style.display = 'none';
  saveData();
  renderProductos();
});
document.getElementById('cancelCategoryBtn').addEventListener('click', ()=>{
  document.getElementById('newCategoryName').value = '';
  document.getElementById('categoryAddRow').style.display = 'none';
});

function refreshProdCategorySelect(){
  const sel = document.getElementById('prodCategory');
  const prevValue = sel.value;
  sel.innerHTML = '<option value="">Sin categoría</option>';
  data.categories.forEach(cat=>{
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
  if([...sel.options].some(o=>o.value === prevValue)) sel.value = prevValue;
}

/* ================= Asistente IA (chat aparte) =================
   Es un agente distinto al 🎤 de pedidos: no toca mesas ni pedidos. Aquí se
   conversa por texto o hablando (🎙️ dicta y envía) y responde escrito y en voz
   alta. Con la IA configurada (Gemini gratis u OpenAI, en ⚙️ Configurar IA)
   entiende cualquier pregunta sobre productos, márgenes, inventario y ventas,
   y puede proponer crear o cambiar productos; nada se cambia hasta que la
   persona toque "Sí, hazlo" (o responda "sí"). Sin IA contesta lo básico. */
const ASIS_STORE = 'vito_asistente_chat';
const ASIS_SPEAK = 'vito_asistente_voz';
let asisMsgs = [];
try{ asisMsgs = JSON.parse(localStorage.getItem(ASIS_STORE) || '[]') || []; }catch(e){ asisMsgs = []; }
if(!Array.isArray(asisMsgs)) asisMsgs = [];
let asisBusy = false, asisRec = null, asisRecOn = false, asisRecText = '';

// ---- ORDEVA: avatar de la IA ----
const MESI_SVG = '<svg class="mesi" viewBox="0 0 64 64" aria-hidden="true">' +
  '<line class="mesi-ant-l" x1="32" y1="7" x2="32" y2="14"/><circle class="mesi-ant" cx="32" cy="6" r="4"/>' +
  '<rect class="mesi-head" x="7" y="13" width="50" height="45" rx="20"/>' +
  '<ellipse class="mesi-shine" cx="22" cy="20" rx="9" ry="3.6"/>' +
  '<rect class="mesi-face" x="13.5" y="24" width="37" height="25" rx="12.5"/>' +
  '<g class="mesi-eyes"><ellipse cx="25" cy="34.5" rx="3.6" ry="4.6"/><ellipse cx="39" cy="34.5" rx="3.6" ry="4.6"/></g>' +
  '<path class="mesi-mouth" d="M28 41.8q4 3.4 8 0"/><ellipse class="mesi-mouth-o" cx="32" cy="43" rx="2.8" ry="2.6"/>' +
  '<circle class="mesi-cheek" cx="18.5" cy="41" r="2.4"/><circle class="mesi-cheek" cx="45.5" cy="41" r="2.4"/>' +
  '</svg>';
function mesiEl(extraClass){
  const i = document.createElement('i');
  i.className = 'mesi-wrap' + (extraClass ? ' ' + extraClass : '');
  i.innerHTML = MESI_SVG;
  return i;
}
document.querySelectorAll('.mesi-wrap[data-mesi]').forEach(el => { el.innerHTML = MESI_SVG; });
let mesiTalking = false, mesiTalkTimer = null;
function mesiState(){ return asisRecOn ? 'listening' : (asisBusy ? 'thinking' : (mesiTalking ? 'talking' : '')); }
function mesiApplyState(){
  const s = mesiState();
  document.querySelectorAll('.mesi-wrap[data-mesi="live"]').forEach(el => {
    el.classList.toggle('thinking', s === 'thinking');
    el.classList.toggle('listening', s === 'listening');
    el.classList.toggle('talking', s === 'talking');
  });
}
function mesiWatchTalk(){
  clearInterval(mesiTalkTimer);
  mesiTalking = true; mesiApplyState();
  mesiTalkTimer = setInterval(() => {
    let on = false;
    try{ on = window.speechSynthesis.speaking || window.speechSynthesis.pending; }catch(e){}
    if(!on){ clearInterval(mesiTalkTimer); mesiTalking = false; mesiApplyState(); }
  }, 300);
}

function asisSave(){ try{ localStorage.setItem(ASIS_STORE, JSON.stringify(asisMsgs.filter(m => !m.greet).slice(-40))); }catch(e){} }
function asisSpeakOn(){ try{ return localStorage.getItem(ASIS_SPEAK) !== 'off'; }catch(e){ return true; } }
function asisSpeak(text, force){
  if(!asisSpeakOn() && !force) return;
  // Sin emojis (el lector los nombra en voz alta) y "$3.300" dicho como pesos.
  const t = String(text || '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\$\s?([\d.]+)/g, '$1 pesos')
    .replace(/^[•\-*]\s*/gm, '')
    .replace(/([^.!?:\n])\n+/g, '$1. ')
    .replace(/\s+/g, ' ').trim();
  if(t){ speakVoice(t); mesiWatchTalk(); }
}
function asisPendingIndex(){
  for(let i = asisMsgs.length - 1; i >= 0; i--){
    const m = asisMsgs[i];
    if(m.role === 'bot' && Array.isArray(m.actions) && m.actions.length && !m.state) return i;
    if(m.role === 'me') continue;
  }
  return -1;
}
function asisActionText(a){
  if(a.tipo === 'laya') return a.label || 'Hacerlo';
  if(a.tipo === 'crear') return '➕ Crear "' + a.nombre + '"' + (a.tam ? ' (' + a.tam + ')' : '') + ' a ' + fmt(a.precio) + (a.costo ? ', costo ' + fmt(a.costo) : '') + (a.stock != null ? ', ' + a.stock + ' unidades' : '');
  const c = [];
  if(a.precio) c.push('precio ' + fmt(a.precio));
  if(a.costo) c.push('costo ' + fmt(a.costo));
  if(a.stock != null) c.push('stock ' + a.stock);
  if(a.sumarStock) c.push('sumar ' + a.sumarStock + ' unidades');
  return '✏️ ' + a.producto + ': ' + c.join(', ');
}
const ASIS_ICON_MIC = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const ASIS_ICON_SEND = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a.9.9 0 0 0-1.3 1l2 6.4 8.4 1-8.4 1-2 6.4a.9.9 0 0 0 1.3 1z"/></svg>';
const ASIS_ICON_STOP = '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor"/></svg>';
const ASIS_ICON_SOUND_ON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ASIS_ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
const ASIS_SUGERENCIAS = ['¿Qué sabes hacer?', '¿Cuánto vendí hoy?', '¿Qué se está acabando?', '¿Quién me debe?', '¿Qué mesas están abiertas?', '¿Qué me deja más ganancia?'];

// El botón redondo hace de micrófono cuando no hay nada escrito y de "enviar"
// cuando sí (como en WhatsApp): un solo botón en vez de dos.
function asisSyncGo(){
  const b = document.getElementById('asisSendBtn'), ta = document.getElementById('asisText');
  if(!b || !ta) return;
  const hasText = !!ta.value.trim();
  b.classList.toggle('rec', asisRecOn);
  b.innerHTML = asisRecOn ? ASIS_ICON_STOP : (hasText ? ASIS_ICON_SEND : ASIS_ICON_MIC);
  b.title = asisRecOn ? 'Terminar y enviar' : (hasText ? 'Enviar' : 'Hablar');
  const st = document.getElementById('asisStatus');
  if(st) st.textContent = asisRecOn ? 'Te escucho… habla con calma' : (asisBusy ? 'Pensando…' : (hasAIKey() ? 'Tu asistente · escríbele o háblale' : 'Tu asistente · modo básico, sin IA'));
  mesiApplyState();
}
function asisRender(){
  const box = document.getElementById('asisMsgs');
  if(!box) return;
  box.innerHTML = '';
  const botRow = (el, extra) => { const r = document.createElement('div'); r.className = 'asis-row'; r.append(mesiEl('asis-row-av' + (extra ? ' ' + extra : '')), el); return r; };
  if(!asisMsgs.length){
    const hero = document.createElement('div');
    hero.className = 'asis-hero';
    hero.append(mesiEl('float'));
    const hs = document.createElement('strong'); hs.textContent = 'Hola, soy ORDEVA';
    const hm = document.createElement('small'); hm.textContent = 'Tu asistente con inteligencia artificial';
    hero.append(hs, hm);
    box.appendChild(hero);
    const hello = document.createElement('div');
    hello.className = 'asis-msg bot';
    hello.textContent = asisSaludo().text + '\nEscríbeme o toca el micrófono para hablarme.';
    box.appendChild(botRow(hello));
    const sug = document.createElement('div');
    sug.className = 'asis-suggest';
    ASIS_SUGERENCIAS.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => asisAsk(q); sug.appendChild(b); });
    box.appendChild(sug);
    if(!hasAIKey()){
      const n = document.createElement('div');
      n.className = 'asis-msg bot';
      n.textContent = 'Sin conexión a la IA ya te respondo muchas cosas. Para que te entienda cualquier pregunta, conecta la IA gratis de Google.';
      const acts = document.createElement('div'); acts.className = 'asis-acts';
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Conectar IA';
      b.onclick = e => { e.stopPropagation(); try{ openAIConfigDialog(); }catch(x){} };
      acts.appendChild(b); n.appendChild(acts); box.appendChild(botRow(n));
    }
  } else {
    const nc = document.createElement('button');
    nc.type = 'button'; nc.className = 'asis-newchat'; nc.textContent = 'Empezar conversación nueva';
    nc.onclick = () => { asisMsgs = []; asisSave(); try{ window.speechSynthesis.cancel(); }catch(e){} asisRender(); };
    box.appendChild(nc);
  }
  asisMsgs.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = 'asis-msg ' + (m.role === 'me' ? 'me' : 'bot');
    d.textContent = m.text;
    if(m.role === 'bot'){
      d.title = 'Toca para volver a escucharlo';
      d.addEventListener('click', e => { if(!e.target.closest('button')) asisSpeak(m.text, true); });
    }
    if(m.role === 'bot' && Array.isArray(m.actions) && m.actions.length){
      const list = document.createElement('div');
      list.className = 'asis-change';
      list.textContent = m.actions.map(asisActionText).join('\n');
      d.appendChild(list);
      if(!m.state){
        const acts = document.createElement('div');
        acts.className = 'asis-acts';
        const yes = document.createElement('button'); yes.className = 'yes'; yes.type = 'button'; yes.textContent = 'Sí, hazlo';
        const no = document.createElement('button'); no.type = 'button'; no.textContent = 'No';
        yes.onclick = () => asisConfirm(i, true);
        no.onclick = () => asisConfirm(i, false);
        acts.append(yes, no);
        d.appendChild(acts);
      } else {
        const n = document.createElement('span'); n.className = 'asis-note';
        n.textContent = m.state === 'done' ? '✓ Hecho' : 'Cancelado';
        d.appendChild(n);
      }
    }
    if(m.cfg){
      const acts = document.createElement('div'); acts.className = 'asis-acts';
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Conectar IA';
      b.onclick = () => { try{ openAIConfigDialog(); }catch(e){} };
      acts.appendChild(b); d.appendChild(acts);
    }
    if(Array.isArray(m.quick) && m.quick.length){
      const acts = document.createElement('div'); acts.className = 'asis-acts';
      m.quick.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = e => { e.stopPropagation(); asisAsk(q); }; acts.appendChild(b); });
      d.appendChild(acts);
    }
    box.appendChild(m.role === 'bot' ? botRow(d) : d);
  });
  if(asisBusy){
    const t = document.createElement('div');
    t.className = 'asis-typing'; t.innerHTML = '<i></i><i></i><i></i>';
    box.appendChild(botRow(t, 'thinking'));
  }
  box.scrollTop = asisMsgs.length ? box.scrollHeight : 0;
  const sp = document.getElementById('asisSpeakBtn');
  if(sp){ sp.innerHTML = asisSpeakOn() ? ASIS_ICON_SOUND_ON : ASIS_ICON_SOUND_OFF; sp.title = asisSpeakOn() ? 'Leyendo en voz alta (toca para solo texto)' : 'Solo texto (toca para que lea en voz alta)'; }
  asisSyncGo();
}
function asisBot(text, extra){
  asisMsgs.push(Object.assign({ role: 'bot', text }, extra || {}));
  asisSave(); asisRender(); asisSpeak(text);
}

function asisMargin(p){
  const c = Number(p.cost), pr = Number(p.price);
  if(!(c > 0) || !(pr > 0)) return null;
  const F = window.ventoFinanzas;   // 🧮 motor financiero
  return { pct: Math.round(F ? F.margen(pr, c) : (pr - c) / pr * 100), gan: pr - c };
}
function asisSales(){
  const now = Date.now(), start = new Date(); start.setHours(0, 0, 0, 0);
  const d7 = now - 7 * 864e5, d30 = now - 30 * 864e5;
  let hoy = 0, nHoy = 0, sem = 0, ganHoy = 0, hoySinCosto = false;
  const stats = {};
  (data.history || []).forEach(h => {
    const t = new Date(h.date).getTime(), tot = Number(h.total) || 0;
    const esHoy = t >= start.getTime();
    if(esHoy){ hoy += tot; nHoy++; }
    if(t >= d7) sem += tot;
    (h.items || []).forEach(it => {
      const q = Number(it.qty) || 0, pr = Number(it.price) || 0, c = Number(it.cost);
      if(esHoy){ if(c > 0) ganHoy += q * (pr - c); else hoySinCosto = true; }
      if(t < d30) return;
      const s = stats[nombreVigente(it.name)] || (stats[nombreVigente(it.name)] = { u: 0, v: 0, g: 0, sc: false });
      s.u += q; s.v += q * pr;
      if(c > 0) s.g += q * (pr - c); else s.sc = true;
    });
  });
  const top = Object.entries(stats).sort((a, b) => b[1].u - a[1].u).slice(0, 15)
    .map(([n, s]) => ({ producto: n, unidades: s.u, vendido: s.v, ganancia: s.sc ? 'falta el costo' : s.g }));
  return { hoy, nHoy, sem, ganHoy, hoySinCosto, top };
}
// Productos que se le mandan a la IA. Con muchos productos, mandarlos todos hace
// la pregunta pesada y la respuesta lenta: se mandan los que nombra la pregunta,
// los que se están acabando o no tienen costo y los más vendidos (máximo 40).
const ASIS_MAX_PRODUCTOS = 40;
function asisProductosRelevantes(q, top){
  const all = data.products || [];
  if(all.length <= ASIS_MAX_PRODUCTOS) return all;
  const words = normVoiceText(q || '').split(' ').filter(w => w.length > 2 && !ASIS_STOP.has(w));
  const roots = words.map(w => w.length > 5 ? w.slice(0, -2) : w);
  const topNames = new Set((top || []).map(x => x.producto));
  const score = p => {
    const n = normVoiceText(p.name + ' ' + (p.size || '') + ' ' + (p.categoryId ? categoryName(p.categoryId) : ''));
    let sc = roots.filter(r => n.includes(r)).length * 10;
    if(topNames.has(p.name)) sc += 3;
    const st = invStatus(p);
    if(st === 'out' || st === 'low') sc += 2;
    if(!(p.cost > 0)) sc += 1;
    return sc;
  };
  return all.map((p, i) => ({ p, sc: score(p), i })).sort((a, b) => b.sc - a.sc || a.i - b.i).slice(0, ASIS_MAX_PRODUCTOS).map(x => x.p);
}
function asisContext(q){
  const s = asisSales();
  const abiertas = Object.keys(data.tables || {}).filter(id => (data.tables[id].items || []).length)
    .map(id => ({ mesa: tableLabel(Number(id)), debe: tableBalance(Number(id)) }));
  return {
    negocio: data.businessName || '',
    fechaHora: new Date().toLocaleString('es-CO'),
    ventasHoy: s.hoy, cuentasCobradasHoy: s.nHoy,
    gananciaHoy: s.hoySinCosto ? s.ganHoy + ' (incompleta: algunos productos vendidos no tienen costo)' : s.ganHoy,
    ventasUltimos7dias: s.sem,
    ventasAyer: (() => { const d0 = new Date(); d0.setHours(0, 0, 0, 0); return asisVentasEntre(d0.getTime() - 864e5, d0.getTime()).total; })(),
    ventasEsteMes: (() => { const m0 = new Date(); m0.setHours(0, 0, 0, 0); m0.setDate(1); return asisVentasEntre(m0.getTime(), Date.now() + 1).total; })(),
    masVendidos30dias: s.top,
    mesasAbiertas: abiertas,
    // Cuentas cerradas que quedaron debiendo (fiados).
    deudas: asisDeudas().slice(0, 30).map(d => ({ quien: d.quien, debe: d.debe, fecha: new Date(d.fecha).toLocaleDateString('es-CO') })),
    clientesFrecuentes: (data.clientesFrecuentes || []).slice().sort((a, b) => b.visitas - a.visitas).slice(0, 10).map(c => ({ cliente: c.nombre || c.telefono, visitas: c.visitas, gastado: c.totalGastado })),
    contabilidadEsteMes: (() => { try{ const m0 = new Date(); m0.setHours(0, 0, 0, 0); m0.setDate(1); const x = ctMovimientos({ ini: m0.getTime(), fin: Date.now() + 1 }); const ent = x.mov.filter(m => m.tipo !== 'gasto').reduce((a, m) => a + m.monto, 0), gas = x.mov.filter(m => m.tipo === 'gasto').reduce((a, m) => a + m.monto, 0); return { entradas: ent, gastos: gas, resultado: ent - gas, gastosPorCategoria: x.mov.filter(m => m.tipo === 'gasto').reduce((o, m) => { const k = ctCatNombre('gasto', m.cat); o[k] = (o[k] || 0) + m.monto; return o; }, {}) }; }catch(e){ return null; } })(),
    reclamosAbiertos: (data.casos || []).filter(c => c.estado !== 'resuelto').slice(0, 10).map(c => ({ tipo: CASO_CATEGORIAS[c.categoria] || c.categoria, urgencia: c.urgencia, detalle: c.descripcion, asignadoA: c.asignadoA || '' })),
    // Lo que ORDEVA sabe de compras, pedidos, preparación y música (resumido, datos reales).
    comprasEsteMes: (() => { try{ const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(1); const x = window.Laya.resumenCompras({ desde: d0.getTime(), hasta: Date.now() + 1 }); return { facturas: x.n, total: Math.round(x.total), sinIva: Math.round(x.sub), iva: Math.round(x.iva) }; }catch(e){ return null; } })(),
    proveedores: (() => { try{ return window.Laya.proveedores().slice(0, 8).map(x => ({ proveedor: x.nombre, comprado: Math.round(x.total), facturas: x.n })); }catch(e){ return []; } })(),
    cambiosDePrecioCompra: (() => { try{ return window.Laya.cambiosPrecio().slice(0, 8).map(x => ({ producto: x.p.name, antes: Math.round(x.de), ahora: Math.round(x.a), pct: x.pct })); }catch(e){ return []; } })(),
    pedidosPendientes: (() => { try{ return window.vitoPedidos.lista().filter(p => ['nuevo', 'recibido', 'preparacion', 'listo'].includes(p.estado)).slice(-15).map(p => ({ mesa: tableLabel(p.mesa), estado: window.vitoPedidos.EST[p.estado], productos: p.items.map(i => i.qty + ' ' + i.name).join(', ') })); }catch(e){ return []; } })(),
    pantallaPreparacion: prepOn() ? prepNombre() : 'desactivada',
    musica: (() => { try{ const m = window.vitoMusica, a = m.actual(); return { sonando: a ? (a.title || a.song) : null, enCola: m.cola().filter(x => !x.done).length }; }catch(e){ return null; } })(),
    // Compacto para que la IA responda más rápido: una fila por producto.
    productosColumnas: 'nombre | tamaño | categoría | precio | costo (0 = sin costo) | margen % | stock (- = sin control) | estado',
    totalProductos: data.products.length,
    productos: asisProductosRelevantes(q, s.top).map(p => {
      const m = asisMargin(p), st = invStatus(p);
      return [p.name, p.size || '', p.categoryId ? categoryName(p.categoryId) : '', p.price, p.cost > 0 ? p.cost : 0, m ? m.pct : '', p.stock == null ? '-' : p.stock, st === 'out' ? 'agotado' : st === 'low' ? 'por acabarse' : ''].join(' | ');
    })
  };
}

// Respuestas sin IA (gratis, sin internet) para lo más común.
function asisLocal(q){
  const t = normVoiceText(q);
  const bullets = arr => arr.map(x => '• ' + x).join('\n');
  if(/\b(acab|agot|poco|bajo|quedan?|reponer|surtir|pedir al proveedor)/.test(t) && !/\bmargen\b/.test(t)){
    const low = data.products.filter(p => ['out', 'low'].includes(invStatus(p)));
    if(!low.length) return 'Todo bien: no hay productos agotados ni por acabarse (de los que tienen control de stock).';
    return 'Estos se están acabando:\n' + bullets(low.slice(0, 15).map(p => p.name + (p.stock <= 0 ? ' — agotado' : ' — quedan ' + p.stock)));
  }
  if(/\b(perd|pierdo|perdiendo|perdida)/.test(t)){
    const bad = data.products.filter(p => { const m = asisMargin(p); return m && m.pct < 0; });
    if(!bad.length) return 'No encontré productos donde estés perdiendo (de los que tienen costo). ' + asisSinCostoNote();
    return 'En estos estás perdiendo plata (cuestan más de lo que cobras):\n' + bullets(bad.map(p => p.name + ': cuesta ' + fmt(p.cost) + ', lo vendes a ' + fmt(p.price)));
  }
  if(/\b(mas ganancia|mejor margen|mejores|mas me deja|mas rentable|deja mas)\b/.test(t)){
    const arr = data.products.map(p => ({ p, m: asisMargin(p) })).filter(x => x.m && x.m.gan > 0).sort((a, b) => b.m.gan - a.m.gan).slice(0, 5);
    if(!arr.length) return 'Todavía ningún producto tiene costo, así que no puedo calcular la ganancia. ' + asisSinCostoNote();
    return 'Los que más te dejan por unidad:\n' + bullets(arr.map(x => x.p.name + ': ganas ' + fmt(x.m.gan) + ' (' + x.m.pct + '%)'));
  }
  if(/\b(vend|ventas?|vendi|hice|facture|caja|hoy)\b/.test(t) && !/\b(margen|costo)\b/.test(t)){
    const s = asisSales();
    let r = 'Hoy llevas ' + fmt(s.hoy) + ' en ' + s.nHoy + (s.nHoy === 1 ? ' cuenta cobrada' : ' cuentas cobradas') + '.';
    if(s.ganHoy) r += ' Ganancia aproximada: ' + fmt(s.ganHoy) + (s.hoySinCosto ? ' (faltan costos de algunos productos)' : '') + '.';
    r += ' En los últimos 7 días: ' + fmt(s.sem) + '.';
    return r;
  }
  if(/\b(sin costo|falta el costo|faltan costos)\b/.test(t)){
    const sc = data.products.filter(p => !(p.cost > 0));
    return sc.length ? 'Estos no tienen costo todavía:\n' + bullets(sc.slice(0, 20).map(p => p.name)) + '\n\nPonlo en Productos → tocar el producto → Costo.' : 'Todos tus productos tienen costo. ¡Muy bien!';
  }
  if(/\b(margen|gano|ganancia|gana|utilidad|cuesta|costo|deja)\b/.test(t)){
    const qn = t.replace(/\b(cual|cuanto|cuanta|es|el|la|los|las|de|del|mi|me|con|que|margen|gano|ganancia|gana|utilidad|cuesta|costo|deja|por|unidad|producto|dime|y)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const p = qn ? findProductByVoiceAlias(qn) : null;
    if(p){
      const m = asisMargin(p);
      if(!m) return p.name + ' se vende a ' + fmt(p.price) + ', pero no tiene costo registrado. Ponlo en Productos → tocar "' + p.name + '" → Costo, y te digo cuánto ganas.';
      return p.name + ':\n• Te cuesta ' + fmt(p.cost) + '\n• Lo vendes a ' + fmt(p.price) + '\n• ' + (m.gan >= 0 ? 'Ganas ' + fmt(m.gan) : 'Pierdes ' + fmt(-m.gan)) + ' por unidad\n• Margen: ' + m.pct + '%';
    }
  }
  return null;
}
function asisSinCostoNote(){
  const n = data.products.filter(p => !(p.cost > 0)).length;
  return n ? '(Hay ' + n + ' productos sin costo; ponlo en Productos para ver todo.)' : '';
}

/* ---------- Comandos directos de ORDEVA ----------
   Se resuelven aquí mismo, al instante y sin internet: moverse por la app,
   abrir una mesa, la hora, la guía de uso y consultas del negocio (deudas,
   mesas abiertas, ventas de ayer o del mes, lo más vendido, precio o stock
   de un producto, clientes frecuentes, reclamos abiertos). Sin IA también
   propone cambiar precios o sumar stock, siempre con "¿Lo hago?". */
const ASIS_AYUDA_CHIPS = ['¿Quién me debe?', '¿Cuánto vendí ayer?', '¿Qué es lo más vendido?', 'Abre inventario', '¿Hay reclamos abiertos?', '¿Cómo escaneo una factura?'];
const ASIS_NAV = [
  { view: 'mesas', re: /\b(mesas|salon|mapa del local)\b/, name: 'Mesas' },
  { view: 'cocina', re: /\b(cocina|comandas|preparacion|barra|despacho|produccion)\b/, get name(){ return prepNombre(); } },
  { view: 'inventario', re: /\b(productos?|inventario|bodega|existencias|stock)\b/, name: 'Productos e inventario' },
  { view: 'contabilidad', re: /\b(contabilidad|gastos?|egresos?|entradas y salidas|flujo de caja|balance)\b/, name: 'Contabilidad' },
  { view: 'estadisticas', re: /\b(estadisticas?|graficas?|reportes?|informes?)\b/, name: 'Estadísticas' },
  { view: 'carta', re: /\b(carta|menu)\b/, name: 'la carta' },
  { view: 'historial', re: /\b(historial|cuentas cerradas)\b/, name: 'Historial' },
  { view: 'musica', re: /\b(musica|canciones|playlist)\b/, name: 'Música' },
  { view: 'ajustes', re: /\b(ajustes|configuracion)\b/, name: 'Ajustes' }
];
const ASIS_AJ = [
  { cat: 'avisos', re: /\b(notificaciones?|alertas|avisos del celular|avisos)\b/, name: 'Notificaciones del celular' },
  { cat: 'pagos', re: /\b(nequi|daviplata|pasarela|pagos? (recibidos|al instante)|macrodroid)\b/, name: 'Pagos: Nequi y DaviPlata' },
  { cat: 'negocio', re: /\b(clientes frecuentes|fidelizacion|propinas?|facturacion|sedes?|plan|suscripcion|usuarios)\b/, name: 'Negocio y facturación' },
  { cat: 'pedidos', re: /\b(atencion al cliente|casos|reclamos|quejas|codigos? qr|qr|cierre automatico|domicilios?|whatsapp|meseros?|pantalla de preparacion|cocina)\b/, name: 'Pedidos, QR y caja' },
  { cat: 'sonidos', re: /\b(sonidos?|volumen de los sonidos)\b/, name: 'Sonidos' },
  { cat: 'nube', re: /\b(nube|vento nube|sincronizar|varios celulares)\b/, name: 'Nube y usuarios' },
  { cat: 'facil', re: /\b(modo facil|modo sencillo)\b/, name: 'Modo fácil' },
  { cat: 'apariencia', re: /\b(apariencia|diseno|tema|colores|tipo de letra|letra|fondo)\b/, name: 'Apariencia' },
  { cat: 'voz', re: /\b(microfono|ajustes de voz)\b/, name: 'Voz' },
  { cat: 'datos', re: /\b(respaldo|copia de seguridad|transferir datos|calculadoras?)\b/, name: 'Datos y herramientas' },
  { cat: 'ayuda', re: /\b(soporte|guia de uso|guia)\b/, name: 'Guía y soporte' }
];
const ASIS_GO_RE = /\b(abre|abreme|abrir|abra|ir a|ir al|ve a|ve al|vaya a|vamos a|llevame|muestrame|mostrame|mostrar|entra a|entrar a|pasa a|pasame a|quiero ver|ensename)\b/;
const ASIS_STOP = new Set('el la los las un una unos unas de del al a en y o que por para con mi mis me se lo le les es esta este esto como cuanto cuanta cuantos cuantas cual cuales hay tengo tiene quedan queda dime decime sabes favor porfa por favor precio precios vale cuesta costo stock existencias unidades unidad producto productos cambia cambiar cambiale sube subir subele baja bajar bajale pon ponle poner actualiza actualizar nuevo nueva llegaron llego compre entraron suma sumale sumar agrega agregale agregar inventario pesos peso mil ahora quiero'.split(' '));

// Número desde el texto crudo: "3.500", "3,500", "$3500", "3500" → 3500.
function asisRawNumbers(raw){
  return (String(raw).match(/\d{1,3}(?:[.,]\d{3})+|\d+/g) || []).map(s => Number(s.replace(/[.,]/g, '')));
}
// "mesa 3" o "mesa tres" → 3
function asisMesaNum(t){
  const m = t.match(/\bmesa (\d+|[a-z]+)\b/);
  if(m){
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_WORDS_VOICE[m[1]];
    if(n) return n;
  }
  // También por el nombre que tiene la mesa: "¿cuánto debe la mesa Juan?", "¿qué lleva la de Ana María?"
  if(typeof data !== 'undefined' && data && data.tables){
    const ids = Object.keys(data.tables).map(Number).filter(k => data.tables[k] && data.tables[k].name)
      .sort((a, b) => String(data.tables[b].name).length - String(data.tables[a].name).length);   // "Juan Carlos" antes que "Juan"
    for(const k of ids){
      const nm = normVoiceText(data.tables[k].name);
      if(nm && new RegExp('\\b(?:mesa|la de|el de|de|la|del)\\s+(?:de\\s+|del\\s+)?' + nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t)) return k;
    }
  }
  return null;
}
function asisFindProduct(t){
  const words = t.split(' ').filter(w => w && !ASIS_STOP.has(w) && !/^\d+$/.test(w) && NUM_WORDS_VOICE[w] === undefined);
  if(!words.length) return null;
  return findProductByVoiceAlias(words.join(' '));
}
function asisDeudas(){
  return (data.history || []).filter(h => (Number(h.debt) || 0) > 0).map(h => {
    const quien = [...new Set((h.payments || []).filter(p => p.method === 'debe' && p.note && p.note !== 'Saldo sin registrar al cerrar').map(p => p.note))];
    return { quien: quien.join(', ') || (h.tableName || tableLabel(h.table)), debe: Number(h.debt), fecha: h.date };
  });
}
function asisVentasEntre(desde, hasta){
  let total = 0, n = 0;
  (data.history || []).forEach(h => { const t = new Date(h.date).getTime(); if(t >= desde && t < hasta){ total += Number(h.total) || 0; n++; } });
  return { total, n };
}
function asisAyudaTexto(){
  return 'Esto es lo que puedo hacer por ti:\n' +
    '• Moverme por la app: "abre inventario", "llévame a música", "abre la mesa 3", "abre clientes frecuentes"\n' +
    '• Ventas: "¿cuánto vendí hoy?", "¿y ayer?", "ventas de la semana", "ventas del mes", "¿qué es lo más vendido?"\n' +
    '• Mesas y deudas: "¿qué mesas están abiertas?", "¿cuánto debe la mesa 2?", "¿quién me debe?"\n' +
    '• Crear y nombrar mesas: "agrégame una mesa que se llame Juan", "mesa nueva Lucas", "crea la mesa Ana con dos Águilas", "la mesa 3 se llama Pedro", "cámbiale el nombre a la mesa 2 por Sofía"\n' +
    '• Productos: "¿a cómo está la Póker?", "¿cuántas Águilas quedan?", "¿qué se está acabando?", "¿cuánto gano con la Club Colombia?"\n' +
    '• Cambios: "sube la Póker a 3.500", "llegaron 24 Águilas" (te pregunto antes de hacerlo)\n' +
    '• Clientes: "¿quiénes son mis mejores clientes?", "¿hay reclamos abiertos?"\n' +
    '• Música: "transmite al TV" (abre YouTube con la lista para mandarla al televisor)\n' +
    '• Problemas: "arregla los errores", "la app no guarda", "me sale el código E-1A2B" (reviso, arreglo lo que pueda y te explico)\n' +
    '• Ayuda: "¿cómo escaneo una factura?", "¿cómo divido una cuenta?", "¿qué hora es?"' +
    (hasAIKey() ? '\n\nY como tengo la IA conectada, puedes preguntarme lo que quieras con tus palabras.' : '\n\nSi conectas la IA gratis de Google, te entiendo cualquier pregunta con tus propias palabras.');
}
function asisGuia(t){
  if(typeof GUIDE_ENTRIES === 'undefined') return null;
  const stop = new Set('como hago hacer se puedo puede donde para el la los las un una de del en que mi me lo y o a por con esta es quiero'.split(' '));
  const words = t.split(' ').filter(w => w.length > 2 && !stop.has(w));
  if(!words.length) return null;
  let best = null, bestScore = 0;
  // Raíz de cada palabra ("escaneo" → "escan", "divido" → "divi") para que
  // coincida con "escanear", "dividir", etc. del texto de la guía.
  const roots = words.map(w => w.length > 5 ? w.slice(0, w.length - 2) : w);
  GUIDE_ENTRIES.forEach(e => {
    // El título y las palabras clave son lo que de verdad identifica el tema;
    // que el cuerpo lo mencione de pasada (ej. "Cocina" habla de WhatsApp
    // porque ahí también llegan los pedidos) pesa mucho menos — si no, un
    // tema ajeno con una sola mención le podía ganar al tema correcto.
    const fuerte = normVoiceText(e.title + ' ' + e.keywords);
    const debil = normVoiceText(e.body);
    const score = roots.reduce((s, r) => s + (fuerte.includes(r) ? 2 : debil.includes(r) ? 0.5 : 0), 0);
    if(score > bestScore){ bestScore = score; best = e; }
  });
  if(!best || bestScore < Math.min(2, words.length)) return null;
  return best.title + '\n' + best.body;
}

function asisPideReparar(t){
  return /\b(arregl|repar|solucion|corrig|corrij|diagnostic)\w*\b.*\b(error|errores|app|aplicacion|problema|problemas|falla|fallas|codigo)\b/.test(t)
    || /\b(me sale|me salio|aparece|aparecio|salio|tengo|hay)\b.*\b(error|errores|codigo de error)\b/.test(t)
    || /\b(no funciona|no sirve|se trabo|se dano|se congelo|se bloqueo|se cuelga|no carga|no guarda|no abre|se cerro sola)\b/.test(t)
    || /\bcodigo e ?[a-z0-9]{3,5}\b/.test(t) || /^(errores|diagnostico|arregla|reparar)$/.test(t);
}
// Comandos que siempre se resuelven aquí (con o sin IA). Devuelve {text, extra, run} o null.
function asisCommand(raw){
  const t = normVoiceText(raw);
  if(!t) return null;
  if(/\b(cierra|cierre|cerrar|cerra|cierrame|termina|terminar) (la |mi )?sesion\b|^(salir|salirme|me voy|cerrar)$|\bcambia(r)? de usuario\b|\bsalir de (la app|mi cuenta|la cuenta)\b/.test(t)){
    return { text: 'Listo, te pregunto para cerrar la sesión. 🚪', run: () => { try{ asisClose(); }catch(e){} cerrarSesion(); } };
  }
  const nWords = t.split(' ').length;
  if(/\b(que sabes hacer|que puedes hacer|que mas puedes hacer|que haces|comandos|como te uso|que te puedo (pedir|preguntar|decir)|en que me ayudas)\b/.test(t) || t === 'ayuda'){
    return { text: asisAyudaTexto(), extra: { quick: ASIS_AYUDA_CHIPS } };
  }
  // Problemas de la app: ORDEVA revisa, repara lo que puede y explica el resto.
  if(asisPideReparar(t)) return { text: '🛠️ Dame un segundo, reviso la app…', run: () => { if(typeof mesoraDiagnosticoChat === 'function') mesoraDiagnosticoChat(raw); } };
  if(/^(recarga|recargar|reinicia|reiniciar) (la )?(app|aplicacion|pagina)\b/.test(t)) return { text: 'Listo, recargo la app. Tus datos quedan guardados.', run: () => location.reload() };
  if(/\b(vincul\w*|enlaz\w*|codigo)\b/.test(t) && /\b(tv|tele|televisor|television)\b/.test(t)){
    return { text: 'Te abro los pasos para vincular tu TV con el código de YouTube.', run: () => { asisClose(); asisGoView('musica'); setTimeout(() => { if(typeof castVincular === 'function') castVincular(); }, 300); } };
  }
  if(/\b(transmit\w*|castea\w*|chromecast)\b/.test(t) || (/\b(musica|youtube|cancion|canciones|lista)\b/.test(t) && /\b(tv|tele|televisor|television)\b/.test(t))){
    return { text: 'Te llevo a Música. Toca «📡 Buscar Chromecast / Google TV» para ver tus dispositivos, o «▶ YouTube Music» / «▶ YouTube» para abrir la app con la lista.', run: () => { asisClose(); asisGoView('musica'); setTimeout(() => { const b = document.getElementById('castPres'); if(b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); } };
  }
  if(nWords <= 4 && /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|quiubo|q hubo)\b/.test(t)){
    const h = new Date().getHours();
    return { text: (h < 12 ? '¡Buenos días!' : h < 19 ? '¡Buenas tardes!' : '¡Buenas noches!') + ' Soy ORDEVA. ¿Qué necesitas?', extra: { quick: ['¿Cuánto vendí hoy?', '¿Qué sabes hacer?'] } };
  }
  if(nWords <= 5 && /^(gracias|muchas gracias|mil gracias|listo gracias|ok gracias)\b/.test(t)) return { text: '¡Con mucho gusto! Aquí estoy cuando me necesites.' };
  if(/\b(que hora es|la hora|que dia es|que fecha es|fecha de hoy)\b/.test(t)){
    const d = new Date();
    return { text: 'Son las ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + ' del ' + d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) + '.' };
  }
  // (Va ANTES de «llévame a…»: si no, «abre una mesa para Juan» solo abría la pantalla de Mesas.)
  // Crear una mesa nueva (con nombre o no) SÍ se puede pedir por el chat — a diferencia de
  // agregar productos a una mesa YA abierta (eso sigue siendo del micrófono, más abajo), crear
  // la mesa es una acción de una sola vez. Reutiliza el mismo entendedor del micrófono de
  // pedidos, así entiende exactamente las mismas frases: "agregar mesa Julián", "crea la mesa
  // Carolina con tres Club Colombia", "nueva mesa para don Pedro", "abre una mesa a nombre de
  // Ana", "agrega una mesa"…
  if(/\b(mesa|mesita|cuenta)\b/.test(t) && typeof voiceCrearMesaConNombre === 'function'){
    if(typeof voiceRenombrarMesa === 'function' && voiceRenombrarMesa(raw)) return { text: 'Listo. ✏️' };
    // voiceCrearMesaConNombre ya avisa con su propio toast y voz si de verdad
    // era una mesa nueva; aquí solo se cierra la conversación con un "Listo."
    // breve para no repetir dos veces todo el mensaje.
    if(voiceCrearMesaConNombre(raw)) return { text: 'Listo. 🪑' };
  }
  const go = ASIS_GO_RE.test(t);
  // Abrir una mesa: "abre la mesa 3"
  const mesaN = asisMesaNum(t);
  if(go && mesaN){
    const id = mesaN;
    if(!data.tables[id]) return { text: 'No tengo la mesa ' + id + '. Tienes ' + Object.keys(data.tables).length + ' mesas; puedes agregar más en Mesas → Número de mesas.' };
    return { text: 'Listo, te abro la ' + tableLabel(id) + '.', run: () => { asisClose(); asisGoView('mesas'); openTableModal(id); } };
  }
  if(go){
    const aj = ASIS_AJ.find(x => x.re.test(t));
    if(aj) return { text: 'Te llevo a Ajustes → ' + aj.name + '.', run: () => { asisClose(); asisGoView('ajustes'); if(typeof mostrarCategoriaAjustes === 'function') mostrarCategoriaAjustes(aj.cat); } };
    const nv = ASIS_NAV.filter(x => x.view !== 'cocina' || usaMod('k')).find(x => x.re.test(t));
    if(nv) return { text: 'Listo, te llevo a ' + nv.name + '.', run: () => { asisClose(); asisGoView(nv.view); } };
  }
  // Pedidos de mesa: eso lo hace el micrófono de pedidos, no el chat.
  if(/\b(agrega|agregale|agregame|anota|pon|ponle|sirve)\b/.test(t) && asisMesaNum(t)){
    return { text: 'Los pedidos de las mesas se anotan con el micrófono 🎤 de abajo a la derecha (por ejemplo: "tres Águilas para la mesa 1"). Yo te ayudo con consultas y cambios de productos.' };
  }
  // Guía de uso: antes solo se probaba si la pregunta empezaba con "cómo" o
  // "dónde" ("¿cómo escaneo una factura?"), así que cosas como "cuéntame de
  // la calculadora" o "ayuda con la libreta" no encontraban la guía (aunque
  // sí exista) y terminaban esperando a la IA sin necesidad. Ahora reconoce
  // más formas de preguntar, y también un tema suelto y corto ("calculadora",
  // "libreta", "whatsapp con ia") — pero solo cuando NO suena a una pregunta
  // de datos del negocio (ventas, mesas, deudas, precios…), para que esas
  // sigan yendo por su camino normal (asisLocalMas / la IA) y no las tape la
  // guía por error.
  const pideGuia = /^(como|donde|en donde|para que sirve|que es|que son|cuentame|explica|explicame|ayuda con|ayuda de|informacion de|info de)\b/.test(t) && !/\b(voy|va|vamos|van|estoy)\b/.test(t);
  const pareceTemaSuelto = nWords <= 4 && !/\b(venta|ventas|vendi|hoy|ayer|semana|mes|mesa|mesas|deuda|deben?|debe|precio|margen|costo|cuesta|stock|cliente|clientes|reclamo|reclamos|agotad\w*)\b/.test(t);
  if(pideGuia || pareceTemaSuelto){
    const g = asisGuia(t);
    if(g) return { text: g };
  }
  return null;
}
function asisGoView(view){
  const b = document.querySelector('nav button[data-view="' + view + '"]');
  if(b) b.click();
}

// Consultas del negocio sin IA (se suman a las de asisLocal).
// "mesa de Juan" si la mesa tiene nombre, "Mesa 3" si no (para que la frase suene bien).
function asisMesaTxt(id){ const n = data.tables[id] && data.tables[id].name && String(data.tables[id].name).trim(); return n ? 'mesa de ' + n : tableLabel(id); }
function asisLocalMas(raw){
  const t = normVoiceText(raw);
  const bullets = arr => arr.map(x => '• ' + x).join('\n');
  const mesaN = asisMesaNum(t);
  if(mesaN && /\b(que (lleva|tiene|pidio|pidieron|ha pedido|han pedido|consumio|consumieron|hay en)|pedido de|detalle|lista de)\b/.test(t)){
    const id = mesaN;
    if(!data.tables[id]) return 'No tengo la mesa ' + id + '.';
    const items = (data.tables[id].items || []);
    if(!items.length) return 'La ' + asisMesaTxt(id) + ' está libre, sin nada anotado.';
    return 'La ' + asisMesaTxt(id) + ' lleva:\n' + bullets(items.map(it => (it.qty || 1) + ' × ' + it.name)) + '\nTotal ' + fmt(tableTotal(id)) + ', falta pagar ' + fmt(tableBalance(id)) + '.';
  }
  if(mesaN && /\b(cuanto|total|debe|deben|va|van|lleva|llevan|cuenta|saldo|falta|consumo)\b/.test(t)){
    const id = mesaN;
    if(!data.tables[id]) return 'No tengo la mesa ' + id + '.';
    const items = (data.tables[id].items || []);
    if(!items.length) return 'La ' + asisMesaTxt(id) + ' está libre, sin cuenta abierta.';
    return 'La ' + asisMesaTxt(id) + ' lleva ' + fmt(tableTotal(id)) + ' en consumo y le falta pagar ' + fmt(tableBalance(id)) + ' (' + items.reduce((s, it) => s + (Number(it.qty) || 0), 0) + ' productos).';
  }
  if(/\b(mesas (libres|desocupadas|vacias|disponibles)|que mesas (estan|hay) (libres|desocupadas|disponibles)|hay mesas? (libres?|disponibles?))\b/.test(t)){
    const lib = Object.keys(data.tables).map(Number).filter(id => !(data.tables[id].items || []).length).sort((a, b) => a - b);
    if(!lib.length) return 'Todas las mesas están ocupadas. Si llega alguien, dime "agrégame una mesa que se llame…" y la creo.';
    return 'Tienes ' + lib.length + (lib.length === 1 ? ' mesa libre: ' : ' mesas libres: ') + lib.map(id => tableLabel(id)).join(', ') + '.';
  }
  if(/\b(mesas (abiertas|ocupadas|activas|llenas|con gente)|que mesas|cuantas mesas (hay|tengo|estan)|como van las mesas|estado de las mesas|resumen de (las )?mesas)\b/.test(t)){
    const ab = Object.keys(data.tables).map(Number).filter(id => (data.tables[id].items || []).length);
    if(!ab.length) return 'Ahora no hay mesas abiertas. Todo libre.';
    const tot = ab.reduce((s, id) => s + tableBalance(id), 0);
    return 'Tienes ' + ab.length + (ab.length === 1 ? ' mesa abierta' : ' mesas abiertas') + ':\n' + bullets(ab.map(id => tableLabel(id) + ': debe ' + fmt(tableBalance(id)))) + '\nEn total falta cobrar ' + fmt(tot) + '.';
  }
  if(/\b(me deben|quien(es)? (me )?deben?|deudas?|fiados?|fiado|deudores|por cobrar)\b/.test(t)){
    const d = asisDeudas();
    if(!d.length) return 'Nadie te debe. ¡Todas las cuentas cerradas están pagadas!';
    const tot = d.reduce((s, x) => s + x.debe, 0);
    return 'Te deben ' + fmt(tot) + ' en ' + d.length + (d.length === 1 ? ' cuenta' : ' cuentas') + ':\n' + bullets(d.slice(0, 12).map(x => x.quien + ': ' + fmt(x.debe) + ' (' + new Date(x.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ')')) + '\nCuando te paguen, márcalo en Historial → "Ya pagó".';
  }
  if(/\b(mas vendid[oa]s?|que se vende mas|lo que mas (se )?vend|mas se vende|top)\b/.test(t)){
    const top = asisSales().top.slice(0, 5);
    if(!top.length) return 'Todavía no hay ventas en los últimos 30 días para saber qué es lo más vendido.';
    return 'Lo más vendido en los últimos 30 días:\n' + bullets(top.map((x, i) => (i + 1) + '. ' + x.producto + ': ' + x.unidades + ' unidades (' + fmt(x.vendido) + ')'));
  }
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  if(/\bayer\b/.test(t) && /\b(vend|venta|hice|facture|caja|cuanto)/.test(t)){
    const r = asisVentasEntre(d0.getTime() - 864e5, d0.getTime());
    return 'Ayer vendiste ' + fmt(r.total) + ' en ' + r.n + (r.n === 1 ? ' cuenta.' : ' cuentas.');
  }
  if(/\b(este mes|del mes|el mes|mensual|en el mes)\b/.test(t) && /\b(vend|venta|hice|facture|cuanto|llevo)/.test(t)){
    const m0 = new Date(d0); m0.setDate(1);
    const r = asisVentasEntre(m0.getTime(), Date.now() + 1);
    return 'En lo que va del mes llevas ' + fmt(r.total) + ' en ' + r.n + (r.n === 1 ? ' cuenta.' : ' cuentas.');
  }
  if(/\bsemana\b/.test(t) && /\b(vend|venta|hice|facture|cuanto|llevo)/.test(t)){
    const r = asisVentasEntre(Date.now() - 7 * 864e5, Date.now() + 1);
    return 'En los últimos 7 días vendiste ' + fmt(r.total) + ' en ' + r.n + (r.n === 1 ? ' cuenta' : ' cuentas') + (r.n ? ', unos ' + fmt(Math.round(r.total / 7 / 100) * 100) + ' diarios en promedio.' : '.');
  }
  if(/\b(mejores clientes|clientes frecuentes|clientes vip|quien(es)? (viene|vienen|compra|compran) mas)\b/.test(t)){
    const cs = (data.clientesFrecuentes || []).slice().sort((a, b) => b.visitas - a.visitas || b.totalGastado - a.totalGastado).slice(0, 5);
    if(!cs.length) return 'Todavía no tienes clientes guardados. Actívalo en Ajustes → Negocio → Clientes frecuentes y anota su WhatsApp al cobrar.';
    return 'Tus mejores clientes:\n' + bullets(cs.map(c => (c.nombre || c.telefono) + ': ' + c.visitas + (c.visitas === 1 ? ' visita' : ' visitas') + ', ' + fmt(c.totalGastado) + (clienteTier(c.visitas) ? ' · ' + clienteTier(c.visitas) : '')));
  }
  if(/\b(casos|reclamos?|quejas?)\b/.test(t)){
    const ab = (data.casos || []).filter(c => c.estado !== 'resuelto');
    if(!ab.length) return 'No tienes reclamos abiertos. 🎉';
    return 'Tienes ' + ab.length + (ab.length === 1 ? ' reclamo abierto' : ' reclamos abiertos') + ':\n' + bullets(ab.slice(0, 8).map(c => CASO_URGENCIA_ICONS[c.urgencia] + ' ' + (c.descripcion || CASO_CATEGORIAS[c.categoria]) + (c.asignadoA ? ' (lo atiende ' + c.asignadoA + ')' : ''))) + '\nLos ves en Ajustes → Pedidos, QR y caja → Atención al cliente.';
  }
  if(/\bcuantos productos\b/.test(t)) return 'Tienes ' + data.products.length + ' productos en total.';
  // Precio o stock de un producto concreto
  const quierePrecio = /\b(precio|a como|cuanto vale|cuanto esta|en cuanto (lo|la) vendo|a cuanto)\b/.test(t);
  const quiereStock = /\b(cuant[oa]s?\b.*\b(hay|quedan?|tengo)|stock|existencias|unidades)\b/.test(t);
  if(quierePrecio || quiereStock){
    const p = asisFindProduct(t);
    if(p){
      if(quiereStock && !quierePrecio){
        if(p.stock == null) return p.name + ' no tiene control de stock. Actívalo en Inventario para saber cuántas te quedan.';
        return p.stock <= 0 ? p.name + ' está agotado. ⚠️' : 'Te quedan ' + p.stock + ' de ' + p.name + (invStatus(p) === 'low' ? ' (ya se está acabando).' : '.');
      }
      return p.name + (p.size ? ' (' + p.size + ')' : '') + ' está a ' + fmt(p.price) + (p.stock != null ? ' y te quedan ' + p.stock + '.' : '.');
    }
  }
  return null;
}

// Sin IA: entiende "sube la Póker a 3500" o "llegaron 24 Águilas" y lo propone.
function asisLocalAccion(raw){
  const t = normVoiceText(raw);
  const nums = asisRawNumbers(raw);
  /* Comandos que ORDEVA hace AL INSTANTE, sin esperar a la IA (siempre pide confirmar antes).
     Van primero los más específicos: «cambia el costo…» también dice «cambia». */
  // Costo: "el costo de la águila es 2500", "costo póker 2800", "la club me cuesta 3000"
  if(/\b(costo|cuesta|me cuesta|me sale|la compro|lo compro|compro a)\b/.test(t) && !/\b(cuanto|que|cual)\b/.test(t) && nums.length){
    const costo = nums[nums.length - 1];
    const p = asisFindProduct(t.replace(/\b(costo|cuesta|me cuesta|me sale|la compro|lo compro|compro a|el|la|de|es|en|a|por)\b/g, ' '));
    if(p && costo >= 50) return { text: 'Voy a poner el costo de ' + p.name + ' en ' + fmt(costo) + (p.price ? ' (ganarías ' + fmt(p.price - costo) + ' por unidad)' : '') + '. ¿Lo hago?', actions: [{ tipo: 'editar', producto: p.name, costo }] };
  }
  // Inventario exacto: "quedan 12 águilas", "hay 30 póker", "stock de club en 24", "inventario club 24"
  const mHay = t.match(/\b(quedan|queda|hay|tengo|stock|inventario|existencias)\b/);
  if(mHay && nums.length && !/\b(mesa|cuanto|cuantos|cuantas|que|cual)\b/.test(t)){
    const n = nums[nums.length - 1];
    const p = asisFindProduct(t.replace(/\b(quedan|queda|hay|tengo|stock|inventario|existencias|de|en|el|la|los|las|unidades|und)\b/g, ' '));
    if(p && n >= 0 && n < 100000) return { text: 'Voy a dejar ' + p.name + ' con ' + n + ' en inventario' + (p.stock != null ? ' (ahora tiene ' + p.stock + ')' : '') + '. ¿Lo hago?', actions: [{ tipo: 'editar', producto: p.name, stock: n }] };
  }
  // Producto nuevo: "crea cerveza club a 4500", "nuevo producto empanada 2500", "agrega producto gaseosa 3000"
  const mCrea = t.match(/^(?:por favor )?(?:crea|crear|creame|nuevo producto|nuevo|agrega el producto|agrega producto|anade el producto|anade producto|registra)\s+(.+?)\s+(?:a|en|por|de|vale|precio|a precio de)?\s*\$?\s*(\d[\d.,]*)\s*(?:pesos|mil)?$/);
  if(mCrea){
    const nombre = mCrea[1].replace(/\b(el|la|un|una|producto)\b/g, ' ').replace(/\s+/g, ' ').trim();
    let precio = nums[nums.length - 1];
    if(/\bmil\b/.test(t) && precio < 1000) precio *= 1000;
    // El nombre se toma de lo que escribió la persona (con tildes y ñ), no del texto normalizado.
    const crudas = String(raw).trim().split(/\s+/), usadas = new Set();
    const nombreBonito = nombre.split(' ').map(w => {
      const i = crudas.findIndex((c, k) => !usadas.has(k) && normVoiceText(c) === w);
      const x = i >= 0 ? (usadas.add(i), crudas[i]) : w;
      return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
    }).join(' ');
    if(nombre.length >= 2 && precio >= 50){
      const ya = data.products.find(p => normVoiceText(p.name) === nombre);
      if(ya) return { text: ya.name + ' ya existe a ' + fmt(ya.price) + '. ¿Le cambio el precio a ' + fmt(precio) + '?', actions: [{ tipo: 'editar', producto: ya.name, precio }] };
      return { text: 'Voy a crear «' + nombreBonito + '» a ' + fmt(precio) + '. ¿Lo hago?', actions: [{ tipo: 'crear', nombre: nombreBonito, precio }] };
    }
  }
  if(/\b(precio|sube|subir|subele|baja|bajar|bajale|cambia|cambiar|ponle|actualiza|vale|valga)\b/.test(t) && nums.length){
    const precio = nums[nums.length - 1];
    const p = asisFindProduct(t);
    if(p && precio >= 50) return { text: 'Voy a cambiar el precio de ' + p.name + ' de ' + fmt(p.price) + ' a ' + fmt(precio) + '. ¿Lo hago?', actions: [{ tipo: 'editar', producto: p.name, precio }] };
  }
  const mLlego = t.match(/\b(llegaron|llego|compre|entraron|suma|sumale|sumar|agrega|agregale|agregar)\b\s+(\d+)\b/);
  if(mLlego && !/\bmesa\b/.test(t)){
    const n = Number(mLlego[2]);
    const p = asisFindProduct(t.replace(mLlego[0], ' '));
    if(p && n > 0) return { text: 'Voy a sumar ' + n + ' unidades a ' + p.name + (p.stock != null ? ' (quedarían ' + ((p.stock || 0) + n) + ')' : '') + '. ¿Lo hago?', actions: [{ tipo: 'editar', producto: p.name, sumarStock: n }] };
  }
  return null;
}

function asisApply(actions){
  const done = [];
  (actions || []).forEach(a => {
    if(a.tipo === 'laya'){ try{ done.push(window.Laya.ejecutar(a)); }catch(e){ done.push('No pude hacerlo: ' + (e.message || e)); } return; }
    if(a.tipo === 'crear'){
      const nombre = String(a.nombre || '').trim(), precio = Number(a.precio);
      if(!nombre || !(precio > 0)){ done.push('No pude crear un producto sin nombre o precio.'); return; }
      const ex = data.products.find(p => dupKey(p) === dupKey({ name: nombre, size: a.tam || '' }));
      if(ex){ done.push('"' + ex.name + '" ya existía; no lo repetí.'); return; }
      data.products.push({ id: Date.now().toString() + Math.random().toString(36).slice(2, 5), name: nombre, price: Math.round(precio), categoryId: null,
        size: String(a.tam || '').trim(), specifications: '', stock: invNum(a.stock), cost: invNum(a.costo) });
      done.push('Creé "' + nombre + '" a ' + fmt(Math.round(precio)) + '.');
    } else if(a.tipo === 'editar'){
      const p = data.products.find(x => x.name === a.producto) || data.products.find(x => normVoiceText(x.name) === normVoiceText(a.producto || '')) || findProductByVoiceAlias(a.producto || '');
      if(!p){ done.push('No encontré "' + a.producto + '".'); return; }
      const c = [];
      if(Number(a.precio) > 0){ p.price = Math.round(a.precio); c.push('precio ' + fmt(p.price)); const nm = sincronizarProductoEnMesas(p); if(nm) c.push('actualizado en ' + nm + (nm === 1 ? ' mesa abierta' : ' mesas abiertas')); }
      if(Number(a.costo) > 0){ p.cost = Math.round(a.costo); c.push('costo ' + fmt(p.cost)); }
      if(a.stock != null && a.stock !== '' && !isNaN(a.stock)){ p.stock = Math.max(0, Math.floor(a.stock)); c.push('stock ' + p.stock); }
      if(Number(a.sumarStock) > 0){ p.stock = (p.stock || 0) + Math.floor(a.sumarStock); c.push('ahora hay ' + p.stock); }
      done.push(p.name + ': ' + (c.length ? c.join(', ') : 'sin cambios') + '.');
    }
  });
  saveData();
  try{ renderProductos(); }catch(e){}
  try{ renderInventario(); }catch(e){}
  try{ if(typeof window.vitoPublicarCatalogo === 'function') window.vitoPublicarCatalogo(true); }catch(e){}
  try{ refrescarTodoEnVivo(); }catch(e){}
  return done;
}
function asisConfirm(i, yes){
  const m = asisMsgs[i];
  if(!m || m.state) return;
  m.state = yes ? 'done' : 'no';
  asisSave();
  if(yes) asisBot('Listo ✅\n' + asisApply(m.actions).join('\n'));
  else asisBot('Bueno, no cambié nada. ¿Te ayudo con otra cosa?');
}

const ASIS_MAX_MS = 8000;       // tope TOTAL de espera de la IA en el chat (reintentos incluidos)
// Preguntas que piden razonar, opinar o comparar: esas sí van a la IA aunque haya respuesta local.
const ASIS_NEEDS_AI = /\b(por que|porque|recomiend|recomienda|sugier|sugiere|sugerencia|deberia|conviene|compar|analiz|estrategia|como puedo|que hago|que me recomiendas|idea|ideas|mejorar|explica|explicame|opinas|opinion|predic|proyecc|promocion|combo)\b/;
async function asisAsk(text){
  text = String(text || '').trim();
  if(!text || asisBusy) return;
  asisMsgs.push({ role: 'me', text });
  asisSave(); asisRender();
  // ¿Responde "sí"/"no" a una propuesta pendiente?
  const pi = asisPendingIndex();
  if(pi >= 0){
    const t = normVoiceText(text);
    if(/^(si|sii|dale|hagale|hazlo|ok|okay|listo|claro|de una|confirmo|correcto|perfecto|por favor|hagalo)\b/.test(t)){ asisConfirm(pi, true); return; }
    if(/^(no|nada|cancela|cancelar|deja|dejalo|mejor no)\b/.test(t)){ asisConfirm(pi, false); return; }
    asisMsgs[pi].state = 'no';
  }
  // «ORDEVA, …»: se le habla por su nombre; el resto de la frase es la pregunta.
  text = text.replace(/^\s*((oye|hola|ok|okey|ey|hey)[\s,]+)?(laya|vento|bento|ordeva|hordeva|or deva)\b[\s,:;.!¡¿?-]*/i, '').trim() || text;
  // ORDEVA: facturas, IVA, costos, proveedores, inventario, duplicados, pedidos, preparación, música e informes,
  // con los datos reales y al instante (también sin internet).
  if(!ASIS_NEEDS_AI.test(normVoiceText(text))){
    let ly = null; try{ ly = window.Laya && window.Laya.responder(text); }catch(e){ console.error(e); }
    if(ly){ try{ window.Laya.registrar(ly.actions && ly.actions.length ? 'sugerencia' : 'consulta', text + ' → ' + String(ly.text).split('\n')[0]); }catch(e){}
      asisBot(ly.text, ly.actions && ly.actions.length ? { actions: ly.actions } : (ly.extra || null)); if(ly.run) setTimeout(ly.run, 700); return; }
  }
  const cmd = asisCommand(text);
  if(cmd){
    asisBot(cmd.text, cmd.extra || null);
    if(cmd.run) setTimeout(cmd.run, 800);
    return;
  }

  // Respuesta al instante sin IA cuando la pregunta es simple y ya se sabe la respuesta
  // exacta con los datos del negocio (ventas, mesas, deudas, precios, stock…).
  if(hasAIKey()){
    const tq = normVoiceText(text);
    if(tq.split(' ').length <= 10 && !ASIS_NEEDS_AI.test(tq)){
      const acc = asisLocalAccion(text);
      if(acc){ asisBot(acc.text, { actions: acc.actions }); return; }
      const r = asisLocalMas(text) || asisLocal(text);
      if(r){ asisBot(r); return; }
    }
  }
  if(!hasAIKey()){
    const acc = asisLocalAccion(text);
    if(acc){ asisBot(acc.text, { actions: acc.actions }); return; }
    const r = asisLocalMas(text) || asisLocal(text);
    if(r) asisBot(r);
    else asisBot('Eso todavía no lo sé responder sin la IA. Toca "¿Qué sabes hacer?" para ver todo lo que te respondo sin ella.\n\nCon la IA de ORDEVA conectada a internet te entiendo cualquier pregunta con tus palabras y puedo crear o cambiar productos.', { cfg: true, quick: ['¿Qué sabes hacer?'] });
    return;
  }
  asisBusy = true;
  asisRender();
  const hist = asisMsgs.filter(m => !m.greet).slice(-6).map(m => (m.role === 'me' ? 'Persona: ' : 'Asistente: ') + m.text).join('\n');
  const prompt = 'Te llamas ORDEVA y eres la inteligencia artificial de "' + (data.businessName || 'la tienda') + '", un negocio (tienda, cafetería, bar) en Colombia, dentro de la app ORDEVA. Hablas con el dueño o sus empleados; muchos son personas mayores o no saben de tecnología. ' +
    'Responde en español sencillo, cálido y CORTO (máximo 4 frases o una lista de hasta 6 líneas con "• "), sin palabras técnicas ni markdown (nada de **, #, tablas). Plata en pesos colombianos con formato $3.300. ' +
    'Usa SOLO los DATOS de abajo; nunca inventes cifras. Si falta un dato (por ejemplo el costo de un producto) dilo claro y explica dónde se pone: Productos → tocar el producto → Costo. Si la pregunta no es clara, pregunta con cariño qué necesita. ' +
    'Margen = (precio − costo) ÷ precio. Si el costo es mayor que el precio, está perdiendo plata. Un precio sugerido se redondea a los 100 pesos. ' +
    'Puedes CONSULTAR las compras/facturas, el IVA pagado, los proveedores, los pedidos, la pantalla de preparación (en este local se llama «' + prepNombre() + '») y la música con los DATOS; los pedidos nuevos de una mesa se anotan con el micrófono 🎤 de pedidos. ' +
    'Puedes PROPONER cambios de productos; no se aplican hasta que la persona confirme, así que di qué vas a hacer y termina preguntando "¿Lo hago?". ' +
    'FORMATO: primero escribe la respuesta como texto normal. Solo si propones cambios, al final agrega UNA línea que empiece con ' + ASIS_ACC_TAG + ' seguida de un arreglo JSON con objetos así: ' +
    '{"tipo":"crear","nombre":"...","precio":número,"costo":número|null,"tam":"texto"|null,"stock":número|null} o ' +
    '{"tipo":"editar","producto":"nombre EXACTO de la lista","precio":número|null,"costo":número|null,"stock":número|null,"sumarStock":número|null}. ' +
    'Si "productos" no trae todos (ver totalProductos) y te preguntan por uno que no está, pide que lo nombren tal como aparece en Productos.\n\nDATOS: ' + JSON.stringify(asisContext(text)) +
    '\n\nCONVERSACIÓN (lo último es lo que acaba de decir la persona):\n' + hist;
  const deadline = Date.now() + ASIS_MAX_MS;
  const o = { prompt, maxOutputTokens: 380, timeoutMs: 7500, retries: 1, deadline };
  // Burbuja que se va llenando mientras la IA escribe (streaming).
  let live = null;
  const onDelta = full => {
    const vis = asisSplitAcciones(full).texto;
    if(!vis) return;
    if(!live){
      asisBusy = false;
      live = { role: 'bot', text: vis, streaming: true };
      asisMsgs.push(live); asisRender();
    } else {
      live.text = vis;
      const els = document.querySelectorAll('#asisMsgs .asis-msg.bot');
      const el = els[els.length - 1];
      if(el){ el.textContent = vis; const box = document.getElementById('asisMsgs'); box.scrollTop = box.scrollHeight; }
    }
  };
  let reply = '', actions = [];
  try{
    let raw;
    if(getAIProvider() === 'gemini'){
      try{ raw = await geminiStreamText(o, onDelta); }
      catch(e){ if(live || !(e && ['rate', 'server', 'model', 'daily', 'network', 'bad'].includes(e.kind))) throw e; raw = await aiText(o); }   // otro modelo, con el tiempo que quede
    } else {
      raw = await aiText(o);
    }
    const sp = asisSplitAcciones(raw);
    reply = sp.texto; actions = sp.acciones;
  }catch(err){
    const local = asisLocalMas(text) || asisLocal(text);
    const lento = err && err.kind === 'timeout';
    reply = local ? local + (lento ? '\n\n(La IA estaba lenta, así que te contesté con lo básico para no hacerte esperar.)' : '\n\n(La IA no respondió, así que te contesté con lo básico.)')
      : lento ? '⏱️ La IA está tardando más de lo normal y no te quise hacer esperar. Pregúntame de nuevo en un momento, o con otras palabras.'
      : '⚠️ No pude hablar con la IA: ' + (err && err.message ? String(err.message).slice(0, 160) : err) + '\nRevisa el internet o la clave en ⚙️ Configurar IA.';
  }finally{
    asisBusy = false;
  }
  if(live){ const k = asisMsgs.indexOf(live); if(k >= 0) asisMsgs.splice(k, 1); }
  asisBot(reply.replace(/\*\*/g, '') || 'No te entendí bien. ¿Me lo dices de otra forma?', actions.length ? { actions } : null);
}

// Separa el texto de la respuesta de la línea de acciones propuestas (ver FORMATO del prompt).
const ASIS_ACC_TAG = '@@ACCIONES';
function asisSplitAcciones(raw){
  let t = String(raw || '');
  const j = cleanAiJsonText(t);                            // por si la IA respondió en el formato JSON viejo
  if(j && typeof j.respuesta === 'string') return { texto: j.respuesta.trim(), acciones: Array.isArray(j.acciones) ? j.acciones.filter(a => a && (a.tipo === 'crear' || a.tipo === 'editar')) : [] };
  const i = t.indexOf('@@');
  let acciones = [];
  if(i >= 0){
    const rest = t.slice(i);
    t = t.slice(0, i);
    const a = rest.indexOf('['), b = rest.lastIndexOf(']');
    if(a >= 0 && b > a){ try{ const arr = JSON.parse(rest.slice(a, b + 1)); if(Array.isArray(arr)) acciones = arr.filter(x => x && (x.tipo === 'crear' || x.tipo === 'editar')); }catch(e){} }
  }
  return { texto: t.replace(/```\w*/g, '').trim(), acciones };
}

// ---- Dictado: tocar 🎙️, hablar, tocar otra vez (o hacer una pausa) y se envía ----
function asisMicStop(send){
  if(asisRec){ try{ asisRec.onend = null; asisRec.stop(); }catch(e){} }
  asisRec = null; asisRecOn = false;
  const ta = document.getElementById('asisText');
  if(send && ta && ta.value.trim()){ const v = ta.value; ta.value = ''; asisAsk(v); }
  asisSyncGo();
}
function asisMicStart(){
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Ctor){ showToast('Este navegador no deja dictar por voz. Usa Chrome o escribe tu pregunta.'); return; }
  try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){}
  const ta = document.getElementById('asisText');
  const base = ta.value.trim();
  asisRecText = '';
  const rec = new Ctor();
  rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = false;
  rec.onresult = e => {
    let fin = '', tmp = '';
    for(let i = 0; i < e.results.length; i++){ if(e.results[i].isFinal) fin += e.results[i][0].transcript; else tmp += e.results[i][0].transcript; }
    asisRecText = (fin || tmp).trim();
    ta.value = (base ? base + ' ' : '') + asisRecText;
  };
  rec.onerror = e => { if(e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast('Permite el micrófono para esta página y vuelve a intentarlo.'); };
  rec.onend = () => asisMicStop(true);
  asisRec = rec; asisRecOn = true;
  asisSyncGo();
  // «Hola ORDEVA» le pasa el micrófono (antes seguía abierto y los dos se lo peleaban).
  try{ window.ventoHola && window.ventoHola.soltar(true); }catch(e){}
  try{ rec.start(); }catch(e){ asisMicStop(false); }
}

// Saludo de bienvenida: aparece solo cada vez que se abre el chat, según la hora
// y con un vistazo rápido del negocio. No se guarda en el historial. Se pidió que
// fuera más corto y rápido: antes juntaba hasta 3 datos del negocio en una frase
// larga ("hoy llevas... hay... están agotados..."); ahora muestra solo el más
// urgente (nunca más de uno), para que se lea de un vistazo y no haya que
// esperar a que termine de hablar.
function asisSaludo(){
  const h = new Date().getHours();
  const hola = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  const quien = (typeof authUser === 'string' && authUser) ? ', ' + authUser.charAt(0).toUpperCase() + authUser.slice(1) : '';
  const lineas = [hola + quien + '! Soy ORDEVA.'];
  try{
    const abiertas = Object.keys(data.tables || {}).filter(id => (data.tables[id].items || []).length).length;
    const s = asisSales();
    const agotados = (data.products || []).filter(p => invStatus(p) === 'out').length;
    // Un solo dato, el más útil ahora mismo (no los tres seguidos).
    if(agotados) lineas.push(agotados === 1 ? '1 producto agotado.' : agotados + ' productos agotados.');
    else if(abiertas) lineas.push(abiertas === 1 ? '1 mesa abierta.' : abiertas + ' mesas abiertas.');
    else if(s.nHoy) lineas.push('Hoy: ' + fmt(s.hoy) + ' en ventas.');
  }catch(e){}
  const errs = (typeof mesoraErrores === 'function') ? mesoraErrores().filter(x => !x.visto && x.tipo !== 'recurso') : [];
  if(errs.length) lineas.push('⚠️ Vi ' + (errs.length === 1 ? 'un error' : errs.length + ' errores') + ' en la app. Toca "Arregla los errores" y lo soluciono.');
  else lineas.push('¿En qué te ayudo hoy?');
  return { text: lineas.join('\n'), quick: errs.length ? ['Arregla los errores', '¿Qué sabes hacer?'] : ['¿Cuánto vendí hoy?', '¿Qué se está acabando?', '¿Qué sabes hacer?'] };
}
function asisOpen(){
  document.getElementById('asisOverlay').classList.add('show');
  aiWarmUp();
  asisMsgs = asisMsgs.filter(m => !m.greet && !m.streaming);
  if(asisMsgs.length){
    const g = asisSaludo();
    asisMsgs.push({ role: 'bot', text: g.text, quick: g.quick, greet: true });
  }
  asisRender();
  { const g = asisSaludo(); asisSpeak(g.text.split('\n')[0]); }
  setTimeout(() => { const ta = document.getElementById('asisText'); if(ta && window.innerWidth > 700) ta.focus(); }, 60);
}
function asisClose(){
  asisMicStop(false);
  try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){}
  document.getElementById('asisOverlay').classList.remove('show');
}
document.getElementById('asisFab').addEventListener('click', asisOpen);
document.getElementById('asisCloseBtn').addEventListener('click', asisClose);
document.getElementById('asisOverlay').addEventListener('click', e => { if(e.target.id === 'asisOverlay') asisClose(); });
document.getElementById('asisSendBtn').addEventListener('click', () => {
  const ta = document.getElementById('asisText');
  if(asisRecOn){ asisMicStop(true); return; }
  if(!ta.value.trim()){ asisMicStart(); return; }
  const v = ta.value; ta.value = ''; ta.style.height = ''; asisAsk(v);
});
document.getElementById('asisText').addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if(e.target.value.trim()) document.getElementById('asisSendBtn').click(); } });
document.getElementById('asisText').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(130, e.target.scrollHeight) + 'px'; asisSyncGo(); });
document.getElementById('asisSpeakBtn').addEventListener('click', () => {
  const on = !asisSpeakOn();
  try{ localStorage.setItem(ASIS_SPEAK, on ? 'on' : 'off'); }catch(e){}
  if(!on){ try{ window.speechSynthesis.cancel(); }catch(e){} }
  asisRender();
  showToast(on ? 'Leeré las respuestas en voz alta.' : 'Solo te responderé por escrito.');
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && document.getElementById('asisOverlay').classList.contains('show')) asisClose(); });
