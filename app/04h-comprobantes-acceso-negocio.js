/* ORDEVA · app/04h-comprobantes-acceso-negocio.js — parte 8 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
/* ---------- Comprobantes de pago (foto) ---------- */
const RCPT_PREFIX = 'cm-rcpt-';
const pendingReceipt = { table: null, person: null };
let rcptScope = null;
// Comprobantes de pago: en este equipo y en la nube («rcpt/<id>»), para verlos desde cualquier equipo de la cuenta.
const rcptNube = () => window.ventoNube && window.ventoNube.enNube && window.ventoNube.enNube() && window.ventoNube.archivos;
// 1.51.0: la foto se guarda en el almacén grande del celular (IndexedDB), no en localStorage (cada foto pesa ~100 KB y
// llenaba la memoria). Las que había en localStorage se pasan solas (rcptMudar).
function saveReceipt(dataUrl){
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const n = rcptNube(); if(n) n.subir('rcpt/' + id, dataUrl);
  ventoAlmacen.set('rcpt/' + id, dataUrl).catch(() => {
    try{ localStorage.setItem(RCPT_PREFIX + id, dataUrl); }
    catch(e){ if(!n) showToast('No se pudo guardar el comprobante: el almacenamiento está lleno.'); }
  });
  return id;
}
const delReceipt = id => { if(!id) return; const n = rcptNube(); if(n) n.borrar('rcpt/' + id); ventoAlmacen.del('rcpt/' + id).catch(() => {}); try{ localStorage.removeItem(RCPT_PREFIX + id); }catch(e){} };
async function rcptMudar(){
  let ks = []; try{ ks = Object.keys(localStorage).filter(k => k.indexOf(RCPT_PREFIX) === 0); }catch(e){ return; }
  for(const k of ks){
    try{ const v = localStorage.getItem(k); if(v){ await ventoAlmacen.set('rcpt/' + k.slice(RCPT_PREFIX.length), v); localStorage.removeItem(k); } }catch(e){ return; }
  }
}
setTimeout(() => { rcptMudar(); autoBackupPoints(); }, 4000);   // al abrir: lo viejo de localStorage pasa al almacén grande
// El pantallazo se abre y se pasa a JPEG fuera del hilo de la pantalla (createImageBitmap + toBlob): con toDataURL la
// cuenta se quedaba quieta un rato al adjuntar una captura grande. Si el navegador no lo tiene, queda lo de antes.
async function rcptAchicar(file, max, calidad){
  if(!window.createImageBitmap || !HTMLCanvasElement.prototype.toBlob) return resizeBackgroundImage(file, max, calidad);
  try{
    const bm = await createImageBitmap(file), k = Math.min(1, max / Math.max(bm.width, bm.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bm.width * k)); c.height = Math.max(1, Math.round(bm.height * k));
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); try{ bm.close(); }catch(e){}
    const blob = await new Promise((ok, mal) => c.toBlob(b => b ? ok(b) : mal(new Error('jpeg')), 'image/jpeg', calidad));
    return await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => mal(r.error); r.readAsDataURL(blob); });
  }catch(e){ return resizeBackgroundImage(file, max, calidad); }
}
function receiptField(scope){
  const img = pendingReceipt[scope];
  pendingReceipt[scope] = null;
  const id = img ? saveReceipt(img) : null;
  return id ? { receiptId: id } : {};
}
['table', 'person'].forEach(scope => {
  document.getElementById(scope === 'person' ? 'personRcptBtn' : 'payRcptBtn').addEventListener('click', () => {
    rcptScope = scope;
    if(window.comprobantePrecalentar) window.comprobantePrecalentar();   // el lector de comprobantes carga mientras se elige la foto
    document.getElementById('rcptInput').click();
  });
});
document.getElementById('rcptInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if(!f || !rcptScope) return;
  try{
    pendingReceipt[rcptScope] = await rcptAchicar(f, 900, 0.6);
    updatePayPickInfo(rcptScope);
    showToast('📎 Comprobante listo. Toca + para registrar el pago.');
  }catch(err){ showToast('No se pudo leer esa foto.'); }
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.rcpt-view');
  if(!b) return;
  e.stopPropagation(); e.preventDefault();
  const rid = b.dataset.rid, ver = d => { document.getElementById('rcptImg').src = d; document.getElementById('rcptOverlay').classList.add('show'); };
  const d = localStorage.getItem(RCPT_PREFIX + rid);
  if(d){ ver(d); return; }
  ventoAlmacen.get('rcpt/' + rid).catch(() => null).then(g => {
    if(g){ ver(g); return; }
    const n = rcptNube();
    if(!n){ showToast('Ese comprobante no está en este dispositivo.'); return; }
    showToast('☁️ Trayendo el comprobante…', 2000);
    n.bajar('rcpt/' + rid).then(u => { if(u) ver(u); else showToast('Ese comprobante no está en tu cuenta ni en este dispositivo.'); });
  });
}, true);
document.getElementById('rcptClose').addEventListener('click', () => document.getElementById('rcptOverlay').classList.remove('show'));

/* ---------- Colores personalizados ---------- */
const CC_EXTRA = ['--cream', '--cream-soft', '--amber', '--amber-deep', '--line'];
function hexMix(a, b, t){
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function applyCustomColors(){
  const root = document.documentElement, c = data && data.customColors;
  const pb = document.getElementById('colorBg'), pa = document.getElementById('colorAccent');
  if(!c){
    // OJO: antes esto borraba --cream/--amber/--line con removeProperty, lo
    // que deshacía el tema recién aplicado por applyPalette() (que llama a
    // esta función al final) y los dejaba pegados en el verde de Matrix sin
    // importar el tema elegido. No hay que tocarlos aquí: si no hay colores
    // personalizados, se dejan tal cual los puso el tema actual.
    if(pb) pb.value = '#000000';
    if(pa) pa.value = '#00ff41';
    return;
  }
  const bg = c.bg, ac = c.accent, set = (k, v) => root.style.setProperty(k, v);
  set('--bg', bg);
  set('--surface', hexMix(bg, ac, 0.06)); set('--surface-2', hexMix(bg, ac, 0.12));
  set('--paper', hexMix(bg, ac, 0.09));   set('--paper-2', hexMix(bg, ac, 0.16));
  set('--line', hexMix(bg, ac, 0.3));
  set('--ink', ac); set('--ink-soft', hexMix(ac, bg, 0.4));
  set('--cream', ac); set('--cream-soft', hexMix(ac, bg, 0.2));
  set('--amber', ac); set('--amber-deep', hexMix(ac, '#000000', 0.35));
  if(pb) pb.value = bg;
  if(pa) pa.value = ac;
}
function setupColorPickers(){
  const pb = document.getElementById('colorBg'), pa = document.getElementById('colorAccent');
  const rain = document.getElementById('rainToggle'), reset = document.getElementById('colorResetBtn');
  const onInput = () => { data.customColors = { bg: pb.value, accent: pa.value }; applyCustomColors(); };
  pb.oninput = pa.oninput = onInput;
  pb.onchange = pa.onchange = () => saveData();
  rain.checked = !data.rainOff;
  rain.onchange = () => { data.rainOff = !rain.checked; applyPalette(data.theme || 'noche'); saveData(); };
  reset.onclick = () => { delete data.customColors; applyPalette(data.theme || 'noche'); saveData(); showToast('Colores originales restablecidos.'); };
  applyCustomColors();
}

/* ---------- Acceso: usuario y contraseña (local en este equipo) ---------- */
const AUTH_USERS_KEY = 'cm-users', AUTH_SESSION_KEY = 'cm-session', VOICE_AI_KEY = 'cm-voice-ai';
// Tipos de negocio: salen del catálogo A–Z (window.VENTO_NEGOCIOS, al inicio del archivo).
// Las claves viejas (cerveceria, farmacia, licorera, medico) siguen funcionando como alias ocultos.
const VN = window.VENTO_NEGOCIOS;
const BUSINESS_TYPES = {}, ESPACIOS = {};
VN.CAT.forEach(t => { BUSINESS_TYPES[t.k] = t.nombre; ESPACIOS[t.k] = t.esp; });
Object.keys(VN.ALIAS).forEach(k => { const t = VN.get(k); Object.defineProperty(BUSINESS_TYPES, k, { value: t.nombre, enumerable: false }); Object.defineProperty(ESPACIOS, k, { value: t.esp, enumerable: false }); });
const tipoNegocio = () => VN.get((typeof data !== 'undefined' && data && data.businessType) || '');
// Nombre que se muestra del tipo: si es «Otro», el que escribió el dueño (ej. «Venta de jugos»).
const tipoNombre = k => (k === 'otro' && typeof data !== 'undefined' && data && data.businessTypeName) ? data.businessTypeName : (BUSINESS_TYPES[k] || 'Negocio');
// Negocios de comida y bebida con atención al público (restaurantes, bares, cafeterías, panaderías,
// tiendas de barrio, licoreras…) pueden elegir si atienden por «Mesas» o por «Cuentas». Los demás no.
const ATENCION_TIENDAS = ['tienda', 'estanco', 'minimercado', 'queseria'];
const puedeElegirMesas = () => { const t = tipoNegocio(); return !!t && (['comida', 'bar'].includes(t.fam) || ATENCION_TIENDAS.includes(t.k)); };
/* ---------- Terminología central de la unidad de atención ----------
   Toda la app (textos, menú, avisos, QR, preparación, ORDEVA y voz) toma el nombre de aquí:
     1) el nombre que el administrador escribió (Ajustes → Cuenta y negocio → «¿Cómo se llaman…?»),
     2) Mesas/Cuentas en negocios de comida y bebida,
     3) el del tipo de negocio (Restaurante → Mesas, Barbería → Sillas, Spa → Cabinas, Hotel → Habitaciones…).
   getServiceUnitName() / getServiceUnitNamePlural() / serviceUnitLabel(id) son la forma de pedirlo. */
const UNIDAD_PRESETS = [['Mesa', 'Mesas', '🍽️', 'f'], ['Cuenta', 'Cuentas', '🧾', 'f'], ['Silla', 'Sillas', '💈', 'f'], ['Puesto', 'Puestos', '📍', 'm'], ['Cabina', 'Cabinas', '💆', 'f'],
  ['Habitación', 'Habitaciones', '🛏️', 'f'], ['Sala', 'Salas', '🎤', 'f'], ['Pista', 'Pistas', '🎳', 'f'], ['Consultorio', 'Consultorios', '🩺', 'm'], ['Estación', 'Estaciones', '🎮', 'f'],
  ['Caja', 'Cajas', '🧾', 'f'], ['Orden', 'Órdenes', '📋', 'f'], ['Pedido', 'Pedidos', '📦', 'm'], ['Espacio', 'Espacios', '📍', 'm'], ['Reserva', 'Reservas', '📅', 'f'], ['Cancha', 'Canchas', '⚽', 'f']];
const espacio = () => {
  const u = typeof data !== 'undefined' && data && data.unidad;
  if(u && String(u.sg || '').trim()) return [String(u.sg).trim(), String(u.pl || u.sg + 's').trim(), u.ic || '📍', u.g === 'm' ? 'm' : 'f'];
  const a = typeof data !== 'undefined' && data && data.atencion;
  if(a && puedeElegirMesas()) return a === 'cuenta' ? ['Cuenta', 'Cuentas', '🧾', 'f'] : ['Mesa', 'Mesas', tipoNegocio().fam === 'bar' ? '🍻' : '🍽️', 'f'];
  return ESPACIOS[(typeof data !== 'undefined' && data && data.businessType) || ''] || ['Mesa','Mesas','🍽️'];
};
const espacioN = () => espacio()[0];
const getServiceUnitName = () => espacio()[0];
const getServiceUnitNamePlural = () => espacio()[1];
const serviceUnitLabel = id => tableLabel(id);
Object.assign(window, { getServiceUnitName, getServiceUnitNamePlural, serviceUnitLabel });
/* ---------- La app se acomoda al negocio ----------
   Cada tipo trae en el catálogo las letras de lo que SÍ usa:
     k = pantalla de cocina   p = mapa del local   w = app de meseros   d = dividir cuenta entre personas
     q = QR en las mesas      n = cada cuenta va a nombre de un cliente   v = venta de mostrador de primero
     b = código de barras (mucho producto)   r = 🧂 insumos y recetas (1.64.0: solo los que preparan comida)
   Una floristería no ve Cocina ni el mapa de mesas; un restaurante sí. En Ajustes → Negocio se puede
   volver a ver todo con «Mostrar todas las funciones». */
const MOD_TODO = 'kpwdqvnbr';
// modsNegocio(): está al principio del archivo (se usa al abrir la app).
/* ---------- Pantalla de preparación: nombre configurable por local ----------
   No todos los negocios tienen «cocina»: un bar prepara en la Barra, una cafetería en Preparación,
   una tienda en Despacho. El nombre elegido se usa en el menú, títulos, avisos y en ORDEVA. */
const PREP_NOMBRES = ['Pantalla', 'Cocina', 'Barra', 'Bar', 'Preparación', 'Despacho', 'Producción', 'Cafetería', 'Comandas', 'Pedidos', 'Servicio', 'Área de preparación'];
// prepNombreDefecto(): está al principio del archivo (se usa al abrir la app).
const prepNombre = () => { const n = typeof data !== 'undefined' && data && data.prep && String(data.prep.nombre || '').trim(); return n || prepNombreDefecto(); };
const prepOn = () => usaMod('k');
const prepIcono = n => /cocina|producci/i.test(n) ? '🍳' : /barra|bar\b|caf/i.test(n) ? '🍹' : '🖥️';
const usaMod = c => modsNegocio().includes(c);
function aplicarModulos(){
  const m = modsNegocio(), b = document.body;
  MOD_TODO.split('').forEach(c => b.classList.toggle('mod-' + c, m.includes(c)));
  // Herramientas según el negocio: «🧾 Caja (POS)» en tiendas, comidas, bares y restaurantes (no en barberías,
  // hoteles, consultorios, lavaderos y demás servicios). En las tiendas no va «⚡ Venta rápida» (la caja ya lo hace):
  // en su lugar va «📒 Fiados». Sin tipo elegido o con «Mostrar todas las funciones» se ve todo, como siempre.
  { const t = tipoNegocio(), completo = typeof data !== 'undefined' && data && data.modoCompleto;
    // Negocio sin tipo elegido (de antes de los tipos, ve todo): si se llama «Tienda…», «Minimercado…», «Droguería…»
    // se toma como tienda para estas herramientas.
    const porNombre = !t && /\b(tienda|minimercado|supermercado|mini ?market|autoservicio|abarrotes|droguer[ií]a|farmacia|ferreter[ií]a|papeler[ií]a|miscel[aá]nea|cacharrer[ií]a)\b/i.test((typeof data !== 'undefined' && data && data.businessName) || '');
    b.classList.toggle('neg-tienda', (!!t && t.fam === 'tienda') || porNombre);
    b.classList.toggle('neg-sin-pos', !completo && !!t && !['tienda', 'comida', 'bar', 'otro'].includes(t.fam)); }
  const qt = document.getElementById('qrGrupoT');
  if(qt) qt.textContent = m.includes('q') ? ('QR de ' + (espacio()[0] === 'Mesa' ? 'las mesas' : ('l' + (espacio()[3] === 'm' ? 'os ' : 'as ') + espacio()[1].toLowerCase())) + ' (permanentes)') : '🌐 Catálogo y pedidos por link';
  // Si estaba parado en una sección que este negocio no usa, se devuelve a las cuentas.
  const act = document.querySelector('nav button.active');
  if(act && act.dataset.view === 'cocina' && !m.includes('k')){ const x = document.querySelector('nav button[data-view="mesas"]'); if(x) x.click(); }
  if(!m.includes('p')) try{ if(typeof mesaVista !== 'undefined' && mesaVista === 'mapa') document.getElementById('mesaViewListBtn').click(); }catch(e){}
}
/* ---------- Las palabras del negocio ----------
   En una lavandería no hay «mesas»: hay órdenes. Se cambia el texto que ya está escrito en la
   pantalla (y el que va apareciendo) por la palabra del negocio, con su artículo: «la mesa» →
   «el consultorio», «de la mesa» → «del consultorio», «todas las mesas» → «todos los consultorios». */
const VOCAB_ART = { el:['el','la'], la:['el','la'], los:['los','las'], las:['los','las'], un:['un','una'], una:['un','una'],
  unos:['unos','unas'], unas:['unos','unas'], este:['este','esta'], esta:['este','esta'], estos:['estos','estas'], estas:['estos','estas'],
  otro:['otro','otra'], otra:['otro','otra'], otros:['otros','otras'], otras:['otros','otras'], todo:['todo','toda'], toda:['todo','toda'],
  todos:['todos','todas'], todas:['todos','todas'], mismo:['mismo','misma'], misma:['mismo','misma'], nuevo:['nuevo','nueva'], nueva:['nuevo','nueva'],
  cuantos:['cuántos','cuántas'], 'cuántos':['cuántos','cuántas'], 'cuántas':['cuántos','cuántas'], cuantas:['cuántos','cuántas'],
  varios:['varios','varias'], varias:['varios','varias'], algunos:['algunos','algunas'], algunas:['algunos','algunas'] };
const generoDe = sg => /(a|ción|sión|dad|tad|umbre)$/i.test(sg) ? 'f' : 'm';
const producto1 = () => { const t = tipoNegocio(); return t && t.prod ? t.prod : ['Producto', 'Productos']; };
// Cambia una palabra (mesa/mesas, producto/productos) por la del negocio, con su artículo.
// vocabCambiar(): está al principio del archivo (se usa al abrir la app).
// vocabTexto(): está al principio del archivo (se usa al abrir la app).
const vocabHayQue = () => espacio()[0] !== 'Mesa' || producto1()[0] !== 'Producto';
const VOCAB_SALTAR = { SCRIPT:1, STYLE:1, TEXTAREA:1, NOSCRIPT:1 };
function vocabNodo(raiz){
  if(!vocabHayQue()) return;
  if(raiz.nodeType === 3){
    // Nunca dentro de <script>/<style>: el navegador agrega el texto de los scripts del final de la página como un
    // nodo aparte, y antes se le cambiaba «mesas» por «cuentas» al CÓDIGO antes de ejecutarse.
    const pa = raiz.parentNode; if(!pa || VOCAB_SALTAR[pa.nodeName] || (pa.closest && pa.closest('[data-novocab]'))) return;
    const v = vocabTexto(raiz.nodeValue); if(v !== raiz.nodeValue) raiz.nodeValue = v; return; }
  if(raiz.nodeType !== 1 || raiz.closest('[data-novocab]')) return;
  const it = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (VOCAB_SALTAR[n.parentNode && n.parentNode.nodeName] || (n.parentElement && n.parentElement.closest('[data-novocab]'))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const cambios = [];
  for(let n = it.nextNode(); n; n = it.nextNode()){ const v = vocabTexto(n.nodeValue); if(v !== n.nodeValue) cambios.push([n, v]); }
  cambios.forEach(([n, v]) => { n.nodeValue = v; });
  const els = raiz.matches && raiz.matches('[placeholder],[title]') ? [raiz] : [];
  raiz.querySelectorAll && raiz.querySelectorAll('[placeholder],[title]').forEach(x => els.push(x));
  els.forEach(x => {
    if(x.closest('[data-novocab]')) return;
    ['placeholder', 'title'].forEach(a => { const v0 = x.getAttribute(a); if(v0){ const v = vocabTexto(v0); if(v !== v0) x.setAttribute(a, v); } });
  });
}
let vocabObs = null;
function aplicarVocabulario(){
  const [, plural] = espacio();
  const nb = document.querySelector('nav button[data-view="mesas"] .nav-lbl'); if(nb) nb.textContent = i18nPut(plural);
  try{ const pn = prepNombre(), pl = document.getElementById('prepNavLbl'), pt = document.getElementById('prepTitulo');
    if(pl) pl.textContent = pn.length > 11 ? pn.slice(0, 10) + '…' : pn; if(pt) pt.textContent = prepIcono(pn) + ' ' + pn; }catch(e){}
  const tc = document.getElementById('tableCountToggle'); if(tc) tc.textContent = espacio()[2] + ' Número de ' + plural.toLowerCase();
  try{ if(window.vitoReinicioBoton) window.vitoReinicioBoton(); }catch(e){}
  try{ aplicarIconos(); }catch(e){}
  try{ aplicarInventario(); }catch(e){}
  // El renglón bajo el nombre del negocio, con sus palabras (y sin repetir «cuentas por cuenta»).
  const sub = document.querySelector('.brand-sub');
  if(sub){ const e2 = espacio(), t = tipoNegocio();
    sub.textContent = i18nPut(e2[0] === 'Cuenta' ? ((t && t.mod.includes('v')) ? 'Ventas, cuentas e inventario' : 'Control de cuentas de tus clientes')
      : 'Control de cuentas por ' + e2[0].toLowerCase()); }
  document.querySelectorAll('[data-go="mesas"] strong').forEach(e => { e.textContent = i18nPut(plural); });
  try{ aplicarModulos(); }catch(e){}
  const pnav = document.querySelector('nav button[data-view="inventario"] .nav-lbl'); if(pnav) pnav.textContent = i18nPut(producto1()[1]);
  const pbtn = document.querySelector('nav button[data-view="productos"]'); if(pbtn){ pbtn.hidden = true; pbtn.style.display = 'none'; }
  if(!vocabHayQue()){ if(vocabObs){ vocabObs.disconnect(); vocabObs = null; } return; }
  try{ vocabNodo(document.body); }catch(e){}
  if(!vocabObs && window.MutationObserver){
    vocabObs = new MutationObserver(muts => {
      for(const mu of muts) for(const n of mu.addedNodes) { try{ vocabNodo(n); }catch(e){} }
    });
    vocabObs.observe(document.body, { childList: true, subtree: true });
  }
}
const BUSINESS_PRESETS = {
  cafeteria: [
    ['Cafés', [['Tinto',2000],['Americano',3500],['Capuchino',5500],['Latte',6000],['Chocolate caliente',5000]]],
    ['Panadería', [['Pan de bono',2500],['Croissant',4500],['Empanada',3000],['Sándwich',9000]]],
    ['Bebidas', [['Jugo natural',6000],['Agua',2500],['Gaseosa',3500]]]
  ],
  restaurante: [
    ['Platos', [['Almuerzo ejecutivo',18000],['Bandeja paisa',28000],['Pechuga a la plancha',24000],['Sopa del día',9000]]],
    ['Bebidas', [['Jugo natural',6000],['Limonada',5000],['Gaseosa',3500],['Agua',2500],['Cerveza',5000]]],
    ['Postres', [['Postre del día',7000],['Helado',6000]]]
  ]
};
// Los demás negocios del catálogo traen su lista de ejemplo («Producto:precio|…»).
VN.CAT.forEach(t => { if(!BUSINESS_PRESETS[t.k] && t.prods) BUSINESS_PRESETS[t.k] = [[t.cat, t.prods.split('|').map(x => { const i = x.lastIndexOf(':'); return [x.slice(0, i), Number(x.slice(i + 1)) || 0]; })]]; });
Object.keys(VN.ALIAS).forEach(k => { if(!BUSINESS_PRESETS[k] && BUSINESS_PRESETS[VN.ALIAS[k]]) Object.defineProperty(BUSINESS_PRESETS, k, { value: BUSINESS_PRESETS[VN.ALIAS[k]], enumerable: false }); });
let authUser = null, authTipoPropio = '';
// El primer usuario creado en cada negocio queda como 'admin'; los que se
// agreguen después (Ajustes → Agregar usuario) quedan como 'staff'. Solo el
// admin puede borrar TODO o crear otros usuarios — así una cuenta de mesero
// no puede, sin querer o a propósito, borrar el negocio completo.
// Lista de usuarios en Ajustes → Cuenta: rol, cambiar rol, nueva contraseña y quitar (solo el admin).
function accUsuariosPintar(){
  const box = document.getElementById('accUsersList'); if(!box) return;
  const gr = grupoActual(), us = authUsers().filter(u => (u.cuenta || 'principal') === gr), admin = authIsAdmin(), nAdmins = us.filter(u => u.role === 'admin').length;
  box.innerHTML = '';
  us.forEach(u => {
    const row = document.createElement('div'); row.className = 'acc-user';
    const esAdmin = u.role === 'admin';
    row.innerHTML = '<span>' + (esAdmin ? '👑' : '🧑‍🍳') + '</span><b></b><span class="rol' + (esAdmin ? '' : ' mesero') + '">' + (esAdmin ? 'Administrador' : 'Mesero') + '</span>';
    row.querySelector('b').textContent = u.user + (u.user === authUser ? ' (tú)' : '');
    if(admin){
      const bRol = document.createElement('button'); bRol.type = 'button'; bRol.className = 'btn-ghost'; bRol.textContent = esAdmin ? 'Hacer mesero' : 'Hacer admin';
      bRol.onclick = () => {
        if(esAdmin && nAdmins <= 1){ showToast('⚠️ Debe quedar al menos un administrador.'); return; }
        const l = authUsers(), x = l.find(y => y.user === u.user); if(!x) return;
        x.role = esAdmin ? 'staff' : 'admin'; localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(l));
        showToast('✅ ' + u.user + ' ahora es ' + (x.role === 'admin' ? 'Administrador' : 'Mesero') + '.');
        if(u.user === authUser) location.reload(); else accUsuariosPintar();
      };
      const bPw = document.createElement('button'); bPw.type = 'button'; bPw.className = 'btn-ghost'; bPw.textContent = '🔑';
      bPw.title = 'Poner contraseña nueva';
      bPw.onclick = async () => {
        const np = prompt('Contraseña nueva para ' + u.user + ' (mínimo 6):'); if(np == null) return;
        if(np.length < 6){ showToast('⚠️ La contraseña debe tener al menos 6 caracteres.'); return; }
        const l = authUsers(), x = l.find(y => y.user === u.user); if(!x) return;
        x.salt = Math.random().toString(36).slice(2) + Date.now().toString(36); x.hash = await authHashClave(np, x.salt);
        localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(l)); showToast('✅ Contraseña de ' + u.user + ' cambiada.');
        // Cuenta con correo: la contraseña es la misma en todos los celulares (se cambia también en la nube).
        const nb = authEsCorreo(u.user) && u.user === authUser ? authNubeCuentas() : null;
        if(nb && nb.conectado(u.user)) nb.nuevaClave(np).catch(e => showToast('⚠️ En este celular quedó cambiada, pero en tu cuenta no (' + nb.msgError(e) + '). En otros celulares sigue la anterior.', 8000));
      };
      row.append(bRol, bPw);
      // 1.62.0: PIN de 4 a 6 números para que el empleado entre rápido (no para administradores)
      if(!esAdmin && !authEsCorreo(u.user)){
        const bPin = document.createElement('button'); bPin.type = 'button'; bPin.className = 'btn-ghost'; bPin.textContent = u.pin && u.pin.h ? '🔢✓' : '🔢';
        bPin.title = u.pin && u.pin.h ? 'Cambiar o quitar su PIN' : 'Ponerle un PIN para entrar rápido';
        bPin.onclick = async () => {
          const np = prompt('PIN de 4 a 6 números para ' + u.user + (u.pin && u.pin.h ? ' (déjalo vacío para quitarlo)' : '') + ':'); if(np == null) return;
          const pin = np.replace(/\s+/g, '');
          if(pin && !/^\d{4,6}$/.test(pin)){ showToast('⚠️ El PIN son de 4 a 6 números.'); return; }
          if(!pin && !(u.pin && u.pin.h)) return;
          const m = await authPonerPin(u.user, pin);
          if(m){ showToast('⚠️ ' + m); return; }
          showToast(pin ? '✅ ' + u.user + ' ya entra con su PIN (en la entrada: toca su nombre y escribe el PIN).' : 'PIN de ' + u.user + ' quitado.', 6000);
          accUsuariosPintar();
        };
        row.appendChild(bPin);
      }
      if(u.user !== authUser){
        const bDel = document.createElement('button'); bDel.type = 'button'; bDel.className = 'btn-ghost'; bDel.textContent = 'Quitar';
        bDel.onclick = async () => {
          if(esAdmin && nAdmins <= 1){ showToast('⚠️ Debe quedar al menos un administrador.'); return; }
          const ok = await showConfirm({ title: '¿Quitar a ' + u.user + '?', message: 'Ya no podrá entrar a ORDEVA en este equipo.', confirmText: 'Sí, quitar', icon: '👤' });
          if(!ok) return;
          localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(authUsers().filter(y => y.user !== u.user)));
          showToast('Usuario quitado: ' + u.user); accUsuariosPintar();
        };
        row.appendChild(bDel);
      }
    }
    box.appendChild(row);
  });
}
// Modo mesero: con un usuario de rol Mesero se ve solo lo del servicio.
function aplicarModoMesero(){
  try{ window.ventoRoles && window.ventoRoles.aplicar(); }catch(e){}
  const mesero = !!authUser && !authIsAdmin();      // todo el equipo (cajero, empleado, mesero): «modo servicio»
  document.body.classList.toggle('modo-mesero', mesero);
  let chip = document.getElementById('meseroChip');
  if(mesero){
    if(!chip){
      chip = document.createElement('div'); chip.id = 'meseroChip'; chip.className = 'mesero-chip';
      chip.innerHTML = '<span></span>';
      // 1.62.0: tocar el nombre = cambiar de usuario (el siguiente entra con su PIN o su contraseña)
      chip.style.cursor = 'pointer'; chip.title = 'Cambiar de usuario';
      chip.onclick = async () => {
        const ok = await showConfirm({ title: '¿Cambiar de usuario?', message: 'Se guarda todo y vuelve a la entrada para que entre otra persona (con su PIN o su contraseña).', confirmText: 'Sí, cambiar', icon: '🔁' });
        if(!ok) return;
        try{ saveData(); await guardadoAhora(); }catch(e){}
        localStorage.removeItem(AUTH_SESSION_KEY); location.reload();
      };
      const row = document.getElementById('topActionsRow') || document.getElementById('topActions');
      if(row) row.appendChild(chip);
    }
    let rn = ''; try{ rn = window.ventoRoles ? window.ventoRoles.rolNombre(window.ventoRoles.rol()) : ''; }catch(e){}
    chip.querySelector('span').textContent = '🧑‍🍳 ' + authUser + (rn ? ' · ' + rn : '');
  } else if(chip) chip.remove();
}
function authIsAdmin(){
  // Usuario de ORDEVA Nube: el rol lo da la nube (el mesero entra en «modo mesero»; dueño, admin y cajero usan toda la app).
  // Con la cuenta de ORDEVA, solo el dueño y el administrador manejan el negocio; cajero, empleado y mesero no
  // (ven lo de su trabajo y lo que el dueño les permita: ver «Permisos del equipo»).
  try{ if(window.ventoNube && authUser && window.ventoNube.correo() === authUser){ const r = window.ventoNube.rolActivo(); return r === 'dueno' || r === 'admin'; } }catch(e){}
  const u = authUsers().find(x => x.user === authUser);
  return !u || u.role === 'admin';   // sin usuarios (dato viejo antes de roles) se trata como admin
}
const voiceAiOn = () => localStorage.getItem(VOICE_AI_KEY) === '1';

function authUsers(){ try{ return JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || []; }catch(e){ return []; } }
async function authHash(pass, salt){
  const str = salt + ':' + pass;
  try{
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');
  }catch(e){ let h = 5381; for(const c of str) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return 'x' + h.toString(16); }
}
// 1.57.0 (auditoría ORDEVA R8): la contraseña de cada usuario en este celular se guarda con PBKDF2 (100.000 vueltas),
// no con un solo SHA-256: si alguien copia la memoria del celular, adivinarla por fuerza bruta es miles de veces más lento.
// Las guardadas antes siguen sirviendo y se pasan solas a PBKDF2 la próxima vez que se entra bien con ellas.
async function authHashClave(pass, salt){
  try{
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pass)), 'PBKDF2', false, ['deriveBits']);
    const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('vento-clave:' + salt), iterations: 100000, hash: 'SHA-256' }, k, 256);
    return 'p2:' + [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');
  }catch(e){ return authHash(pass, salt); }      // sin crypto.subtle (página sin https): como antes
}
// ¿La contraseña es la del usuario u? Si estaba guardada a la antigua y es correcta, se pasa a PBKDF2 (y se guarda).
async function authClaveOk(u, pass){
  if(!u || !u.hash) return false;
  if(String(u.hash).startsWith('p2:')) return (await authHashClave(pass, u.salt)) === u.hash;
  if((await authHash(pass, u.salt)) !== u.hash) return false;
  try{
    const nuevo = await authHashClave(pass, u.salt);
    if(String(nuevo).startsWith('p2:')){
      const us = authUsers(), x = us.find(y => y.user === u.user && y.hash === u.hash);
      if(x){ x.hash = nuevo; localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(us)); }
      u.hash = nuevo;
    }
  }catch(e){}
  return true;
}
// 1.62.0 · PIN de los empleados (4 a 6 números) para cambiar rápido de usuario en el mismo equipo.
// Solo para cajero, empleado o mesero (nunca el administrador ni las cuentas con correo). Se guarda su huella (PBKDF2,
// como la contraseña), nunca el PIN. 5 intentos malos seguidos: el PIN queda bloqueado hasta que entre con su
// contraseña o el administrador le ponga uno nuevo.
const PIN_FALLOS_KEY = 'cm-pin-fallos', PIN_MAX_FALLOS = 5;
const authPinPuede = u => !!(u && u.pin && u.pin.h && u.role !== 'admin' && !authEsCorreo(u.user));
function authPinFallos(user){ try{ return (JSON.parse(localStorage.getItem(PIN_FALLOS_KEY)) || {})[user] || 0; }catch(e){ return 0; } }
function authPinFallo(user, n){
  let all; try{ all = JSON.parse(localStorage.getItem(PIN_FALLOS_KEY)) || {}; }catch(e){ all = {}; }
  if(n) all[user] = n; else delete all[user];
  try{ localStorage.setItem(PIN_FALLOS_KEY, JSON.stringify(all)); }catch(e){}
}
async function authPinOk(u, pin){ return authPinPuede(u) && /^\d{4,6}$/.test(pin) && (await authHashClave(pin, u.pin.s + ':pin')) === u.pin.h; }
async function authPonerPin(user, pin){
  const us = authUsers(), u = us.find(x => x.user === user); if(!u) return 'Usuario no encontrado.';
  if(pin && !/^\d{4,6}$/.test(pin)) return 'El PIN son de 4 a 6 números.';
  if(pin){ const s = Math.random().toString(36).slice(2) + Date.now().toString(36); u.pin = { s, h: await authHashClave(pin, s + ':pin') }; }
  else delete u.pin;
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(us));
  authPinFallo(user, 0);
  return null;
}
async function authAddUser(user, pass, role, cuenta){
  user = (user || '').trim().toLowerCase();
  if(user.length < 3) return 'El usuario debe tener al menos 3 caracteres.';
  if((pass || '').length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  const users = authUsers();
  if(users.some(u => u.user === user)) return 'Ese usuario ya existe.';
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const g = cuenta || ((typeof authUser !== 'undefined' && authUser) ? authGrupoDe(authUser) : 'principal');
  users.push(Object.assign({ user, salt, hash: await authHashClave(pass, salt), role: role || 'staff' }, g !== 'principal' ? { cuenta: g } : {}));
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  return null;
}
const authNorm = n => String(n || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');   // 3001234567
const authNormCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function authNewCode(){
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12));
  const c = [...r].map(x => A[x % 32]).join('');
  return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8);
}
// ---------- Freno a intentos repetidos de inicio de sesión ----------
// Igual idea que el bloqueo de recuperación por WhatsApp (cm-rec-lock), pero
// por USUARIO: así alguien no puede probar contraseñas al puro intento con el
// formulario de entrada. No es infalible (quien abra la consola del navegador
// puede saltárselo), pero frena el caso normal de alguien adivinando a mano.
function authLoginLocked(user){
  let all; try{ all = JSON.parse(localStorage.getItem('cm-login-lock')) || {}; }catch(e){ all = {}; }
  const l = all[user];
  if(l && Date.now() - l.t < 5 * 60e3 && l.n >= 6){
    return Math.ceil((5 * 60e3 - (Date.now() - l.t)) / 60e3);
  }
  return 0;
}
function authLoginFail(user){
  let all; try{ all = JSON.parse(localStorage.getItem('cm-login-lock')) || {}; }catch(e){ all = {}; }
  const l = all[user], fresh = l && Date.now() - l.t < 5 * 60e3;
  all[user] = { n: (fresh ? l.n : 0) + 1, t: Date.now() };
  try{ localStorage.setItem('cm-login-lock', JSON.stringify(all)); }catch(e){}
}
function authLoginClear(user){
  let all; try{ all = JSON.parse(localStorage.getItem('cm-login-lock')) || {}; }catch(e){ all = {}; }
  delete all[user];
  try{ localStorage.setItem('cm-login-lock', JSON.stringify(all)); }catch(e){}
}
/* ---------- Códigos de recuperación (de un solo uso) ----------
   8 códigos al azar (60 bits cada uno). Solo se guarda su huella (hash con la sal del usuario),
   nunca el código: aunque alguien copie los datos del celular, no los puede leer. Cada uno sirve
   una vez; crear códigos nuevos anula los anteriores (y el viejo código de WhatsApp). Para crearlos
   se pide la contraseña actual, y los intentos fallidos bloquean cada vez por más tiempo. */
async function authCrearCodigos(user, passActual){
  const users = authUsers(), u = users.find(x => x.user === user);
  if(!u) return { err: 'Usuario no encontrado.' };
  if(!(await authClaveOk(u, passActual || ''))) return { err: 'La contraseña actual no es correcta.' };
  const codigos = Array.from({ length: 8 }, authNewCode);
  u.rc = await Promise.all(codigos.map(async c => ({ h: await authHash(authNormCode(c), u.salt + 'rc'), usado: false })));
  u.rcT = Date.now(); delete u.wa;
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  return { codigos };
}
const authCodigosQuedan = u => u && Array.isArray(u.rc) ? u.rc.filter(x => !x.usado).length : 0;
async function authRecover(user, code, newPass, newPass2){
  if((newPass || '').length < 6) return 'La contraseña nueva debe tener al menos 6 caracteres.';
  if(newPass2 !== undefined && newPass !== newPass2) return 'Las dos contraseñas nuevas no son iguales.';
  let lock; try{ lock = JSON.parse(localStorage.getItem('cm-rec-lock')) || { n: 0, t: 0, nivel: 0 }; }catch(e){ lock = { n: 0, t: 0, nivel: 0 }; }
  const espera = [10, 60, 24 * 60][Math.min(lock.nivel || 0, 2)] * 60e3;   // 10 min, luego 1 hora, luego 1 día
  if(lock.n >= 5 && Date.now() - lock.t < espera) return 'Demasiados intentos. Espera ' + (espera >= 864e5 ? 'un día' : espera >= 36e5 ? 'una hora' : '10 minutos') + ' para volver a intentar.';
  if(lock.n >= 5) lock = { n: 0, t: 0, nivel: (lock.nivel || 0) + 1 };
  const users = authUsers(), u = users.find(x => x.user === String(user || '').trim().toLowerCase());
  const huella = u ? await authHash(authNormCode(code), u.salt + 'rc') : '';
  const cod = u && Array.isArray(u.rc) ? u.rc.find(x => !x.usado && x.h === huella) : null;
  const viejoWa = !cod && !!(u && u.wa && !u.rc) && await authHash(authNormCode(code), u.salt + 'wa') === u.wa.h;   // código anterior, mientras no cree los nuevos
  if(!cod && !viejoWa){
    localStorage.setItem('cm-rec-lock', JSON.stringify({ n: (lock.n || 0) + 1, t: Date.now(), nivel: lock.nivel || 0 }));
    return 'El código no sirve: está mal escrito, ya se usó, o no es de ese usuario.';
  }
  if(cod){ cod.usado = true; cod.cuando = Date.now(); } else delete u.wa;
  u.hash = await authHashClave(newPass, u.salt);
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users)); localStorage.removeItem('cm-rec-lock');
  const q = authCodigosQuedan(u);
  return { ok: true, quedan: q };
}
/* Enlace del correo (recuperar contraseña): llega con un permiso en la dirección (#access_token=…). Se guarda y se
   borra de la dirección de inmediato (no queda a la vista ni en el historial) y luego se le pide al servidor de quién es. */
const authEnlace = (() => {
  try{
    const h = new URLSearchParams(location.hash.replace(/^#/, '')), q = new URLSearchParams(location.search);
    const tok = h.get('access_token'), tipo = h.get('type') || '', err = h.get('error_description') || h.get('error') || ((q.get('recuperar') != null || q.get('nubeclave') === '1') ? (q.get('error_description') || q.get('error')) : null);
    if(!tok && !err) return null;
    // Vuelta de «Conectar mi cuenta de YouTube» (#access_token=…&state=vento-yt.…): es de Google para YouTube, NO un enlace
    // del correo. Antes se tomaba aquí, se borraba de la dirección y salía «El enlace no sirvió»: la cuenta nunca se conectaba.
    if(/^vento-yt\./.test(h.get('state') || '')) return null;
    // Tocó el enlace del correo de «Entrar con un código»: se entra con esa sesión (no es para cambiar la contraseña).
    if(q.get('nubecodigo') === '1'){
      try{ if(tok) sessionStorage.setItem('vento-codigo', JSON.stringify({ a: tok, r: h.get('refresh_token') || '' })); }catch(e){}
      history.replaceState(null, '', location.pathname);
      return null;
    }
    // Volvió de «Continuar con Google»: el permiso es para ORDEVA Nube (no es un enlace de recuperar contraseña).
    if(q.get('nubegoogle') === '1'){
      try{ if(tok) sessionStorage.setItem('vento-google', JSON.stringify({ a: tok, r: h.get('refresh_token') || '' })); else sessionStorage.setItem('vento-google-err', err || 'Google no dejó entrar.'); }catch(e){}
      history.replaceState(null, '', location.pathname);
      return null;
    }
    const r = { tok, tipo, err, user: q.get('recuperar') || '', nube: q.get('nubeclave') === '1', hash: location.hash.replace(/^#/, ''), query: location.search.replace(/^\?/, '') };
    history.replaceState(null, '', location.pathname);
    return r;
  }catch(e){ return null; }
})();
// 👁 Ver u ocultar la contraseña que se escribe (entrar, crear cuenta, recuperar, clave de autorización).
window.ventoOjoClave = function(inp){
  if(!inp || inp.dataset.ojo) return; inp.dataset.ojo = '1';
  const w = document.createElement('span'); w.style.cssText = 'position:relative;display:block;width:100%';
  inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
  inp.style.paddingRight = '46px'; inp.style.width = '100%'; inp.style.boxSizing = 'border-box';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ojo-clave'; b.textContent = '👁'; b.setAttribute('aria-label', 'Ver la contraseña'); b.tabIndex = -1;
  b.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);border:0;background:transparent;font-size:19px;cursor:pointer;padding:6px 8px;line-height:1;color:inherit';
  b.onclick = ev => { ev.preventDefault(); const ver = inp.type === 'password'; inp.type = ver ? 'text' : 'password'; b.textContent = ver ? '🙈' : '👁'; b.setAttribute('aria-label', ver ? 'Ocultar la contraseña' : 'Ver la contraseña'); inp.focus(); };
  w.appendChild(b);
};
document.addEventListener('DOMContentLoaded', () => { ['authPass', 'recNew', 'recNew2'].forEach(id => window.ventoOjoClave(document.getElementById(id))); });
try{ ['authPass', 'recNew', 'recNew2'].forEach(id => { const x = document.getElementById(id); if(x) window.ventoOjoClave(x); }); }catch(e){}
function authEnlaceDialogo(titulo, texto, conClave){
  return new Promise(res => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<form style="width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:18px">' +
      '<b style="font-size:18px"></b><div class="auth-hint" style="white-space:pre-line"></div>' +
      (conClave ? '<label>Contraseña nueva<input type="password" name="a" autocomplete="new-password"></label><label>Repite la contraseña nueva<input type="password" name="b" autocomplete="new-password"></label><div class="auth-hint" style="margin-top:-4px">Toca 👁 para ver lo que escribes.</div><div class="auth-err"></div><button class="btn-primary" type="submit">Guardar contraseña</button>' : '') +
      '<div class="ex" style="display:flex;flex-direction:column;gap:8px"></div><button class="btn-ghost" type="button" data-x>Cerrar</button></form>';
    ov.querySelector('b').textContent = titulo; ov.querySelector('.auth-hint').textContent = texto;
    document.body.appendChild(ov);
    const f = ov.querySelector('form');
    ov.querySelectorAll('input[type="password"]').forEach(i => window.ventoOjoClave && window.ventoOjoClave(i));
    if(conClave) setTimeout(() => { try{ f.a.focus(); }catch(e){} }, 50);
    ov.querySelector('[data-x]').onclick = () => { ov.remove(); res(null); };
    if(conClave) f.onsubmit = e => { e.preventDefault(); const a = f.a.value, b = f.b.value, er = f.querySelector('.auth-err');
      if(a.length < 6) return er.textContent = 'Debe tener al menos 6 caracteres.'; if(a !== b) return er.textContent = 'Las dos no son iguales.'; ov.remove(); res(a); };
    res.ov = ov; ov.__res = res;
    authEnlaceDialogo.ultimo = ov;
  });
}
async function authEnlaceProcesar(){
  const L = authEnlace; if(!L) return;
  const nb = window.ventoNube;
  if(L.err) return authEnlaceDialogo('📧 El enlace no sirvió', 'El enlace del correo ya se usó o venció. Vuelve a pedir otro en «¿Olvidaste tu contraseña?».');
  let correo;
  try{ correo = await nb.correoDeEnlace(L.tok); }
  catch(e){ return authEnlaceDialogo('📧 El enlace no sirvió', 'El enlace del correo ya se usó o venció. Vuelve a pedir otro en «¿Olvidaste tu contraseña?».'); }
  if(L.nube){                                                  // cuenta de ORDEVA Nube
    const p = await authEnlaceDialogo('🔑 Contraseña nueva', 'Correo comprobado: ' + correo + '.\nEscribe tu contraseña nueva de ORDEVA.', true);
    if(!p) return nb.soltarEnlace(L.tok);
    try{ await nb.claveConEnlace(L.tok, p); showToast('✅ Contraseña de ORDEVA cambiada. Entra con tu correo y la contraseña nueva.', 8000); }
    catch(e){ showToast('⚠️ ' + (nb.msgError ? nb.msgError(e) : e.message), 8000); }
    return nb.soltarEnlace(L.tok);
  }
  const users = authUsers(), u = users.find(x => x.user === String(L.user || '').toLowerCase());
  // Cuenta con correo que no está en este celular (o el enlace se abrió en el navegador): el correo ya quedó comprobado
  // con el enlace, así que solo se pide la contraseña nueva (dos veces) y se cambia en la cuenta. Luego se entra con ella.
  if(!u && (!L.user || authEsCorreo(L.user)) && (!L.user || String(L.user).toLowerCase() === correo)){
    const p = await authEnlaceDialogo('🔑 Contraseña nueva', 'Correo comprobado: ' + correo + '.\nEscribe tu contraseña nueva dos veces.', true);
    if(!p) return nb.soltarEnlace(L.tok);
    try{ await nb.claveConEnlace(L.tok, p); showToast('✅ Contraseña cambiada. Entra con ' + correo + ' y la contraseña nueva.', 9000);
      try{ document.getElementById('authUser').value = correo; const er = document.getElementById('authErr'); if(er) er.textContent = '✅ Contraseña cambiada. Escribe la nueva para entrar.'; document.getElementById('authPass').focus(); }catch(e){} }
    catch(e){ showToast('⚠️ ' + (nb.msgError ? nb.msgError(e) : e.message), 8000); }
    return nb.soltarEnlace(L.tok);
  }
  if(!u){
    // El enlace se abrió en el navegador, pero la cuenta está en la app ORDEVA (o en otro navegador).
    const enApp = !window.VentoAndroid;
    const d = authEnlaceDialogo('📧 Correo comprobado', 'Este enlace es para cambiar la contraseña de «' + (L.user || '?') + '», pero esa cuenta no está en ' + (enApp ? 'este navegador.\nSi usas la app ORDEVA, toca «Abrir en la app ORDEVA».' : 'este celular.'));
    if(enApp){ const ov = authEnlaceDialogo.ultimo, a = document.createElement('a'); a.className = 'btn-primary'; a.style.cssText = 'text-align:center;padding:13px;border-radius:12px;text-decoration:none';
      a.textContent = '📲 Abrir en la app ORDEVA'; a.href = 'vento://abrir?' + L.query + '#' + L.hash; ov.querySelector('.ex').appendChild(a); }
    return d;
  }
  if(!u.email || u.email !== correo){ nb.soltarEnlace(L.tok); return authEnlaceDialogo('📧 No coincide', 'Ese correo (' + correo + ') no es el de recuperación de «' + u.user + '».'); }
  const p = await authEnlaceDialogo('🔑 Contraseña nueva', 'Correo comprobado: ' + authMascara(correo) + '.\nUsuario: ' + u.user + '. Escribe tu contraseña nueva.', true);
  if(p && authEsCorreo(u.user) && u.user === correo) try{ await nb.claveConEnlace(L.tok, p); }catch(e){}   // la misma en todos los celulares
  nb.soltarEnlace(L.tok);
  if(!p) return;
  u.hash = await authHashClave(p, u.salt); u.claveCambiada = Date.now();
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users)); localStorage.removeItem('cm-rec-lock');
  try{ document.getElementById('authUser').value = u.user; const er = document.getElementById('authErr'); if(er) er.textContent = '✅ Contraseña cambiada con el enlace del correo. Ya puedes entrar.'; }catch(e){}
  showToast('✅ Contraseña cambiada. Ya puedes entrar con la nueva.', 8000);
}
if(authEnlace) setTimeout(() => { authEnlaceProcesar().catch(() => {}); }, 900);
/* Recuperar la contraseña con un código que llega al CORREO del usuario (el que guardó en Ajustes → Negocio).
   El código lo manda el Servidor ORDEVA (Supabase); solo prueba que la persona es dueña de ese correo. */
const authMascara = e => { const m = /^(.)(.*)(@.*)$/.exec(String(e || '')); return m ? m[1] + '***' + m[3] : ''; };
const authNube = () => window.ventoNube && window.ventoNube.configurada && window.ventoNube.configurada() && window.ventoNube.codigoCorreo ? window.ventoNube : null;
async function authCorreoEnviar(user){
  const u = authUsers().find(x => x.user === String(user || '').trim().toLowerCase());
  // Cuenta de ORDEVA (se entra con el correo): código temporal de 6 números al correo. Con él se pone la contraseña
  // nueva y se entra de una, en este celular o en uno nuevo.
  const nc = authNubeCuentas();
  if(authEsCorreo(user) && nc && nc.codigoEntrar && (!u || !u.email || String(u.email).toLowerCase() === u.user)){
    const email = String(user).trim().toLowerCase();
    try{ await nc.codigoEntrar(email, false, location.origin + location.pathname.replace(/[^/]*$/, '') + '?nubeclave=1'); }
    catch(e){
      // Cuenta que solo está en este celular (nunca se subió a la nube) y con su correo de recuperación: como antes.
      if(!(u && u.email && /signups? not allowed|user not found/i.test(String((e && e.message) || e)))) return { error: nc.msgError(e) };
      u.email = u.email || email;
      return authCorreoEnviarLocal(u);
    }
    try{ sessionStorage.setItem('cm-rec-mail', JSON.stringify({ user: email, at: Date.now(), nube: true })); }catch(e){}
    return { ok: true, mascara: authMascara(email), codigo: true };
  }
  if(u && u.email) return authCorreoEnviarLocal(u);
  // Cuenta de ORDEVA con correo que no está en este celular (celular nuevo, datos borrados): enlace para poner
  // contraseña nueva a la cuenta. Después se entra con el correo y la contraseña nueva, y vuelven los datos.
  if(!u && authEsCorreo(user)){
    const nb = authNube(); if(!nb || !nb.enlaceClave) return { error: 'Para mandar el correo hace falta internet.' };
    const email = String(user).trim().toLowerCase();
    try{ await nb.enlaceClave(email, location.origin + location.pathname.replace(/[^/]*$/, '') + '?nubeclave=1'); }catch(e){ return { error: (nb.msgError ? nb.msgError(e) : (e.message || String(e))) }; }
    return { ok: true, mascara: authMascara(email) };
  }
  if(!u) return { error: 'Escribe tu usuario o tu correo (como entras a ORDEVA).' };
  if(!u.email) return { error: 'Ese usuario no tiene correo de recuperación guardado. Usa un código de recuperación, o pídele a otro administrador que te cambie la contraseña.' };
  return authCorreoEnviarLocal(u);
}
// Usuario de este celular con su correo de recuperación (Ajustes → Negocio): código al correo para cambiar la clave.
async function authCorreoEnviarLocal(u){
  const nb = authNube(); if(!nb) return { error: 'Para mandar el código hace falta internet y el Servidor ORDEVA conectado.' };
  const volver = location.origin + location.pathname.replace(/[^/]*$/, '') + '?recuperar=' + encodeURIComponent(u.user);
  try{ await nb.codigoCorreo(u.email, volver); }catch(e){ return { error: (window.ventoNube.msgError ? window.ventoNube.msgError(e) : (e.message || String(e))) }; }
  try{ sessionStorage.setItem('cm-rec-mail', JSON.stringify({ user: u.user, at: Date.now() })); }catch(e){}
  return { ok: true, mascara: authMascara(u.email) };
}
async function authRecoverCorreo(user, code, newPass, newPass2){
  if((newPass || '').length < 6) return 'La contraseña nueva debe tener al menos 6 caracteres.';
  if(newPass2 !== undefined && newPass !== newPass2) return 'Las dos contraseñas nuevas no son iguales.';
  let lock; try{ lock = JSON.parse(localStorage.getItem('cm-rec-lock')) || { n: 0, t: 0, nivel: 0 }; }catch(e){ lock = { n: 0, t: 0, nivel: 0 }; }
  const espera = [10, 60, 24 * 60][Math.min(lock.nivel || 0, 2)] * 60e3;
  if(lock.n >= 5 && Date.now() - lock.t < espera) return 'Demasiados intentos. Espera ' + (espera >= 864e5 ? 'un día' : espera >= 36e5 ? 'una hora' : '10 minutos') + ' para volver a intentar.';
  const users = authUsers(), u = users.find(x => x.user === String(user || '').trim().toLowerCase());
  if(!u || !u.email) return 'Ese usuario no tiene correo de recuperación.';
  const nb = authNube(); if(!nb) return 'Sin conexión con el Servidor ORDEVA.';
  try{ await nb.verificarCorreo(u.email, code); }
  catch(e){ localStorage.setItem('cm-rec-lock', JSON.stringify({ n: (lock.n || 0) + 1, t: Date.now(), nivel: lock.nivel || 0 })); return 'El código del correo no sirve o ya venció. Pide uno nuevo.'; }
  if(authEsCorreo(u.user) && u.user === String(u.email).toLowerCase()) try{ await nb.nuevaClave(newPass); }catch(e){}   // la misma en todos los celulares
  try{ await nb.soltarSesion(); }catch(e){}
  u.hash = await authHashClave(newPass, u.salt); u.claveCambiada = Date.now();
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users)); localStorage.removeItem('cm-rec-lock');
  try{ sessionStorage.removeItem('cm-rec-mail'); }catch(e){}
  return { ok: true, correo: true };
}
// Ajustes → Negocio: guardar el correo de recuperación (se comprueba con un código antes de guardarlo).
async function authCorreoGuardar(){
  const users = authUsers(), u = users.find(x => x.user === authUser); if(!u) return;
  const actual = prompt('Para proteger tu cuenta, escribe tu contraseña actual:'); if(actual == null) return;
  if(!(await authClaveOk(u, actual))) return showToast('⚠️ Contraseña incorrecta: no se cambió el correo.');
  const e = (prompt('Tu correo para recuperar la contraseña:', u.email || '') || '').trim().toLowerCase(); if(!e) return;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return showToast('⚠️ Ese correo no está bien escrito.');
  u.email = e; u.emailAt = Date.now(); localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  showToast('✅ Correo guardado: si olvidas la contraseña, te llega un enlace a ' + authMascara(e) + '.', 7000);
  try{ authCorreoEstado(); }catch(x){}
}
function authCorreoEstado(){
  const el = document.getElementById('accMailState'), b = document.getElementById('accMailBtn'); if(!el) return;
  const u = authUsers().find(x => x.user === authUser);
  el.textContent = u && u.email ? '✅ ' + authMascara(u.email) : '⚠️ Sin correo: agrégalo para poder recuperar la contraseña por correo.';
  if(b) b.textContent = u && u.email ? '📧 Cambiar correo' : '📧 Agregar mi correo';
}
function authCodigosDialogo(alTerminar){
  let ov = document.getElementById('rcOverlay');
  if(!ov){ ov = document.createElement('div'); ov.id = 'rcOverlay'; ov.className = 'overlay'; document.body.appendChild(ov); }
  const u = authUsers().find(x => x.user === authUser);
  ov.innerHTML = '<div class="modal" style="max-width:420px"><h2>🔐 Códigos de recuperación</h2><div class="modal-sub">' + (u && u.rc ? '⚠️ Al crear códigos nuevos, <b>los anteriores dejan de servir</b>. ' : '') + 'Para protegerte, escribe tu contraseña actual.</div>' +
    '<input id="rcPass" type="password" class="mz-in" style="width:100%" autocomplete="current-password" placeholder="Tu contraseña actual"><div class="auth-err" id="rcErr"></div>' +
    '<div class="modal-actions"><button class="btn-close" type="button" id="rcNo">Cancelar</button><button class="btn-primary" type="button" id="rcSi">Crear códigos</button></div></div>';
  ov.classList.add('show'); setTimeout(() => document.getElementById('rcPass').focus(), 100);
  document.getElementById('rcNo').onclick = () => ov.classList.remove('show');
  document.getElementById('rcSi').onclick = async () => {
    const r = await authCrearCodigos(authUser, document.getElementById('rcPass').value);
    if(r.err){ document.getElementById('rcErr').textContent = r.err; return; }
    const neg = (typeof data !== 'undefined' && data && data.businessName) || 'ORDEVA';
    const texto = 'Códigos de recuperación de ORDEVA\nNegocio: ' + neg + ' · Usuario: ' + authUser + '\nCreados: ' + new Date().toLocaleString('es-CO') + '\n\n' + r.codigos.map((c, i) => (i + 1) + '. ' + c).join('\n') + '\n\nCada código sirve UNA sola vez. Guárdalos en papel, en un lugar seguro. No los mandes por WhatsApp ni los compartas.';
    ov.innerHTML = '<div class="modal" style="max-width:420px"><h2>🔐 Tus 8 códigos</h2><div class="modal-sub"><b>Solo se muestran esta vez.</b> Imprímelos o escríbelos en un papel y guárdalo lejos del celular. Cada uno sirve una sola vez para cambiar tu contraseña.</div>' +
      '<div class="rc-lista">' + r.codigos.map((c, i) => '<div><small>' + (i + 1) + '</small><b>' + c + '</b></div>').join('') + '</div>' +
      '<div class="mz-actions" style="margin-top:10px"><button class="btn-ghost" type="button" id="rcPrint">🖨️ Imprimir</button><button class="btn-ghost" type="button" id="rcDl">⬇️ Descargar</button></div>' +
      '<label class="rc-ok"><input type="checkbox" id="rcGuarde"> Ya los guardé en un lugar seguro</label>' +
      '<div class="modal-actions"><button class="btn-primary" type="button" id="rcListo" disabled>Listo</button></div></div>';
    document.getElementById('rcGuarde').onchange = e => { document.getElementById('rcListo').disabled = !e.target.checked; };
    document.getElementById('rcListo').onclick = () => { ov.innerHTML = ''; ov.classList.remove('show'); if(alTerminar) alTerminar(); showToast('✅ Códigos guardados. Si olvidas la contraseña: «¿Olvidaste tu contraseña?» en la entrada.'); };
    document.getElementById('rcDl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' })); a.download = 'codigos-recuperacion-vento-' + authUser + '.txt'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
    document.getElementById('rcPrint').onclick = () => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f); const d = f.contentDocument; d.open(); d.write('<title>Códigos de recuperación</title><pre style="font:16px monospace;white-space:pre-wrap;margin:24px">' + texto.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</pre>'); d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300); };
    if(alTerminar) alTerminar();
  };
}
// «ORDEVA para tu negocio»: qué necesita ese tipo de negocio, cómo le sirve ORDEVA y qué viene en camino.
function guiaTipoHtml(k){
  const t = VN.get(k); if(!t) return '';
  const e = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return '<p><b>' + t.icono + ' ' + e(tipoNombre(t.k)) + '</b></p>' +
    '<p>🎯 <b>Lo que más necesita:</b> ' + e(t.necesita) + '</p>' +
    '<p>✅ <b>Cómo te ayuda ORDEVA:</b> ' + e(t.vento) + '</p>' +
    '<p>🗂️ <b>Así queda:</b> ' + e(t.esp[1]) + ' ' + t.esp[2] + ' · lista de precios «' + e(t.carta) + '»' + (t.gastos.length ? ' · gastos: ' + t.gastos.map(g => e((VN.G[g] || g).replace(/^\S+\s/, ''))).join(', ') : '') + '</p>' +
    '<p>🧩 <b>Lo que ORDEVA te prende:</b> ' + modsTexto(t.mod) + '</p>' +
    (t.falta ? '<p>🛠️ <b>Próximamente:</b> ' + e(t.falta) + '</p>' : '');
}
// Los dibujos del menú y de las tarjetas cambian con el negocio: el avión de la agencia,
// la cama del hotel, la llave inglesa de la ferretería, la flor de la floristería.
const iconoSvg = n => (VN.IC && VN.IC[n]) || VN.IC.orden;
function iconoEsp(){ const t = tipoNegocio(); return iconoSvg(t ? t.icE : 'mesa'); }
function iconoProd(){ const t = tipoNegocio(); return iconoSvg(t ? t.icP : 'carrito'); }
// Cómo se llama el inventario en este negocio: unidades en una tienda, cupos en una
// agencia o una academia, habitaciones en un hotel, horas en una cancha.
function invPalabra(){ const t = tipoNegocio(); return (t && t.inv) || ['Inventario', 'unidades']; }
const iconoProdEmoji = () => { const t = tipoNegocio(); return t ? t.icCarta : '📦'; };
function aplicarInventario(){
  const [tab, unidad] = invPalabra();
  const h = document.querySelector('#view-inventario .inv-head h2');
  if(h) h.textContent = iconoProdEmoji() + ' ' + i18nPut(producto1()[1]) + ' e ' + i18nPut(tab).toLowerCase();
  const at = document.getElementById('prodAddTitulo');
  if(at) at.textContent = 'Agregar ' + producto1()[0].toLowerCase();
  const ap = document.getElementById('prodAddPanel'), as = ap && ap.querySelector('summary small');
  if(as) as.textContent = 'Nombre, precio, costo, ' + unidad + ' y categoría';
  const ls = document.querySelector('label[for="editProdStock"]');
  if(ls) ls.textContent = unidad === 'unidades' ? 'Stock actual (vacío = sin control)'
    : (unidad.charAt(0).toUpperCase() + unidad.slice(1) + ' disponibles (vacío = sin límite)');
  const lm = document.querySelector('label[for="editProdMin"]'); if(lm) lm.textContent = 'Avisar cuando queden (' + unidad + ')';
}
function aplicarIconos(){
  const poner = (sel, svg) => { const e = document.querySelector(sel); if(e && e.innerHTML !== svg) e.innerHTML = svg; };
  poner('nav button[data-view="mesas"] .nav-ic', iconoEsp());
  poner('nav button[data-view="inventario"] .nav-ic', iconoProd());
  document.querySelectorAll('.tk-ic').forEach(e => { e.innerHTML = iconoEsp(); });
}
const MOD_NOMBRES = { k: 'pantalla de preparación', p: 'mapa del local', w: 'app de meseros', d: 'dividir la cuenta entre personas',
  q: 'pedidos por QR en cada puesto', n: 'cada cuenta a nombre del cliente', v: 'venta rápida de mostrador', b: 'código de barras', r: 'insumos y recetas' };
function modsTexto(mod){
  const on = mod.split('').map(c => MOD_NOMBRES[c]).filter(Boolean);
  const off = Object.keys(MOD_NOMBRES).filter(c => !mod.includes(c)).map(c => MOD_NOMBRES[c]);
  return (on.length ? on.join(', ') : 'lo básico: cuentas, productos, inventario y contabilidad') + (off.length ? '. <b>Se esconde:</b> ' + off.join(', ') : '') + '.';
}
function pintarGuiaTipo(){ const g = document.getElementById('accTipoGuia'); if(g) g.innerHTML = guiaTipoHtml(data.businessType || 'tienda'); }
function fillTypeSelect(sel, value){
  sel.innerHTML = Object.keys(BUSINESS_TYPES).map(k => `<option value="${k}">${BUSINESS_TYPES[k]}</option>`).join('');
  if(value) sel.value = VN.ALIAS[value] || value;
}
/* Buscador de tipo de negocio: el cliente escribe una palabra («lavandería», «uñas», «pollo»…)
   y salen los negocios que coinciden. Si no está, puede escribir el suyo («Mi negocio es…»).
   onPick(clave, nombrePropio) — nombrePropio solo viene cuando eligió «Otro» escribiendo el suyo. */
/* En pantallas pequeñas la lista completa no cabe en la tarjeta de entrada: se muestra solo
   el negocio elegido y, al tocarlo, el buscador se abre en una ventana aparte. */
window.ventoTipoBoton = function(host, value, onPick, opt){
  opt = opt || {};
  let sel = (VN.ALIAS[value] || value || 'tienda'), propio = opt.nombrePropio || '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  host.classList.add('tp-host'); host.setAttribute('data-novocab', '');
  const pinta = () => {
    const t = VN.get(sel) || VN.get('otro');
    host.innerHTML = '<button type="button" class="tp-btn"><span class="tp-btn-ic">' + t.icono + '</span>' +
      '<span class="tp-btn-tx"><b>' + esc(sel === 'otro' && propio ? propio : t.nombre) + '</b><small>' + esc(t.esp[1]) + ' · ' + esc(t.carta) + '</small></span>' +
      '<span class="tp-btn-go">Cambiar</span></button>';
    host.querySelector('.tp-btn').onclick = abrir;
  };
  function abrir(){
    let ov = document.getElementById('tipoSheet');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'tipoSheet'; ov.className = 'overlay'; ov.setAttribute('data-novocab', '');
      ov.innerHTML = '<div class="modal tp-sheet"><h2>¿Qué tipo de negocio tienes?</h2><div class="modal-sub">Escribe una palabra: lavandería, uñas, pollo, taller, vuelos…</div><div id="tipoSheetPick"></div><div class="modal-actions"><button type="button" class="btn-close" id="tipoSheetX">Cerrar</button></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
      document.getElementById('tipoSheetX').onclick = () => ov.classList.remove('show');
    }
    window.ventoTipoPicker(document.getElementById('tipoSheetPick'), sel, (k, nom) => {
      sel = k; propio = nom || ''; pinta(); onPick(sel, propio);
      ov.classList.remove('show');
    }, { nombrePropio: propio, max: 60 });
    ov.classList.add('show');
    setTimeout(() => { const q = ov.querySelector('.tp-q'); if(q) try{ q.focus(); }catch(e){} }, 120);
  }
  pinta();
  return { get valor(){ return sel; }, get nombrePropio(){ return propio; }, abrir };
};
window.ventoTipoPicker = function(host, value, onPick, opt){
  opt = opt || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let sel = VN.ALIAS[value] || value || '';
  host.classList.add('tp-box'); host.setAttribute('data-novocab', '');
  host.innerHTML = '<div class="tp-actual"></div><input type="search" class="tp-q" autocomplete="off" enterkeyhint="search" placeholder="🔎 Escribe: lavandería, uñas, pollo…">' +
    '<div class="tp-lista" role="listbox"></div>';
  const q = host.querySelector('.tp-q'), lista = host.querySelector('.tp-lista'), actual = host.querySelector('.tp-actual');
  const pintaActual = () => {
    const t = VN.get(sel);
    actual.innerHTML = t ? '<span>' + t.icono + '</span><b>' + esc(sel === 'otro' && opt.nombrePropio ? opt.nombrePropio : t.nombre) + '</b><small>' + esc(t.esp[1]) + ' · ' + esc(t.carta) + '</small>' : '<small>Aún no eliges el tipo de negocio</small>';
  };
  const pinta = () => {
    const txt = q.value.trim(), res = VN.buscar(txt), max = opt.max || (txt ? 30 : 400);
    lista.innerHTML = res.slice(0, max).map(t => '<button type="button" class="tp-it' + (t.k === sel ? ' on' : '') + '" data-k="' + t.k + '"><span>' + t.icono + '</span><b>' + esc(t.nombre) + '</b></button>').join('') +
      (txt.length > 2 ? '<button type="button" class="tp-it tp-otro" data-otro="1"><span>➕</span><b>Mi negocio es «' + esc(txt.slice(0, 40)) + '»</b></button>' : '') +
      (!res.length ? '<div class="tp-nada">No lo encontramos con esa palabra. Prueba con otra (ej. «ropa», «comida», «taller») o créalo con el botón de arriba.</div>' : '');
  };
  lista.onclick = e => {
    const b = e.target.closest('.tp-it'); if(!b) return;
    if(b.dataset.otro){ sel = 'otro'; opt.nombrePropio = q.value.trim().slice(0, 40).replace(/^\w/, c => c.toUpperCase()); }
    else { sel = b.dataset.k; opt.nombrePropio = ''; }
    pintaActual(); pinta();
    onPick(sel, opt.nombrePropio || '');
  };
  q.oninput = pinta;
  q.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); const b = lista.querySelector('.tp-it'); if(b) b.click(); } };
  pintaActual(); pinta();
  return { get valor(){ return sel; }, get nombrePropio(){ return opt.nombrePropio || ''; }, input: q };
};
function seedBusinessMenu(type){
  const preset = BUSINESS_PRESETS[type];
  // Solo si la app está intacta (sin ventas ni pedidos): nunca pisa datos reales.
  const pristine = !data.history.length && !data.closures.length &&
    !Object.values(data.tables).some(t => (t.items || []).length) &&
    JSON.stringify(data.products) === JSON.stringify(defaultData().products);
  if(!preset || !pristine) return;
  data.categories = []; data.products = [];
  preset.forEach(([cat, prods], i) => {
    const cid = 'cat-p' + i;
    data.categories.push({ id: cid, name: cat });
    prods.forEach(([name, price], j) => data.products.push({ id: 'prod-p' + i + '-' + j, name, price, categoryId: cid }));
  });
}
async function enterApp(user, setup){
  authUser = user;
  localStorage.setItem(AUTH_SESSION_KEY, user);
  document.getElementById('authOverlay').hidden = true;
  try{
    // Cada usuario entra a SU cuenta: si el equipo quedó en el negocio de otra cuenta, se cambia al suyo.
    const sid = currentSedeId(), lista = sedesList();
    const sede = lista.find(s => s.id === sid) || lista[0];
    if(sede){ STORAGE_KEY = sede.key; localStorage.setItem(CURRENT_SEDE_KEY, sede.id); }
  }catch(e){}
  await loadData();
  if(setup){
    if(setup.biz) data.businessName = setup.biz;
    data.businessType = setup.type; data.tipoFijo = true;   // elegido: después solo cambia con permiso del administrador
    if(setup.typeName) data.businessTypeName = setup.typeName; else delete data.businessTypeName;
    seedBusinessMenu(setup.type);
    await saveData(); renderAll();
    document.getElementById('brandName').value = data.businessName;
  }
  wireAccountUI();
  wireSedesUI();
  aplicarModoMesero();
  // Primera vez: el asistente. Después, la tarjeta «Primeros pasos» guía (el carrusel queda en «¿Cómo funciona?»).
  if(setup && window.ventoBienvenida) window.ventoBienvenida(true); else if(!(window.ventoPasos && window.ventoPasos.activa())) maybeShowTutorial();
  maybeShowLowStockAlert();
  // Recordatorio (una vez al día) para que el administrador cree sus códigos de recuperación.
  try{
    const u = authUsers().find(x => x.user === user), hoy = new Date().toDateString();
    if(authIsAdmin() && u && !authCodigosQuedan(u) && localStorage.getItem('vento-rc-aviso') !== hoy && !setup){
      localStorage.setItem('vento-rc-aviso', hoy);
      setTimeout(() => showToast('🔐 Crea tus códigos de recuperación (Ajustes → Negocio): si olvidas la contraseña, son tu forma segura de volver a entrar.', 9000), 7000);
    }
  }catch(e){}
}

// ---------- Aviso de stock bajo al entrar ----------
function maybeShowLowStockAlert(){
  try{
    const out = data.products.filter(p => !p.combo && invStatus(p) === 'out').length;
    const low = data.products.filter(p => !p.combo && invStatus(p) === 'low').length;
    if(!out && !low) return;
    const parts = [];
    if(out) parts.push(out + ' agotado' + (out === 1 ? '' : 's'));
    if(low) parts.push(low + ' por agotarse');
    setTimeout(() => {
      if(typeof showToast === 'function') showToast('📦 Tienes ' + parts.join(' y ') + '. Revisa Inventario.', 3200);
    }, 2200);
  }catch(e){}
}

/* ---------- Tutorial de bienvenida (primera vez que se abre la app) ----------
   Se guarda en ESTE celular/navegador (no en el respaldo de datos), porque es
   algo de "ya vi cómo funciona" de este aparato, no información del negocio.
   Por eso sobrevive a "Restablecer todo" pero no se copia a otro celular. */
const TUTORIAL_SEEN_KEY = 'cm-tutorial-seen';
const TUTORIAL_SLIDES = [
  { icon: '👋', title: 'Bienvenido a ORDEVA', get text(){ return 'Controla ' + (usaMod('v') ? 'las ventas' : 'las ' + espacio()[1].toLowerCase()) + ', los productos y el inventario de tu negocio, todo en un solo lugar.'; } },
  { icon: '🕒', title: 'Los íconos de arriba', text: 'Arriba a la derecha ves la hora. Debajo: la 🔔 campana avisa pedidos y canciones nuevas, y la carita con "IA" es ORDEVA, tu asistente de inteligencia artificial: pregúntale lo que necesites de tu negocio.' },
  { icon: '🧭', title: 'El menú de abajo', get text(){ return 'Abajo tienes ' + espacio()[1] + (usaMod('k') ? ', ' + prepNombre() : '') + ', Productos e Inventario. Toca "Más" para ver Estadísticas, ' + cartaTerm() + ', Historial' + (musicaOn() ? ', Música' : '') + ' y Ajustes.'; } },
  { get icon(){ return espacio()[2]; }, get title(){ return espacio()[1]; },
    get text(){ const sg = espacio()[0].toLowerCase(), t = tipoNegocio();
      return usaMod('n') ? ('Abre una ' + sg + ' a nombre del cliente, agrégale lo que lleva y cóbrala cuando la entregues. Los abonos y el saldo quedan guardados.')
        : usaMod('v') ? ('Para vender en el mostrador usa «⚡ Venta rápida»: cobras de una, sin abrir nada. Si un cliente va sumando, ábrele una ' + sg + '.')
        : ('Abre una ' + sg + ', agrega lo que van pidiendo, y cóbrala cuando se vayan.' + (usaMod('d') ? ' Puedes dividir la cuenta entre varias personas.' : '')); } },
  { icon: '📦', title: 'Inventario y facturas', text: 'Escanea la factura de tu proveedor (con o sin internet) y ORDEVA calcula solo cuánto ganas o pierdes en cada producto.' },
  { icon: '📊', title: 'Estadísticas, diseño y ayuda', text: 'Mira cómo va tu negocio en Estadísticas, cambia el diseño en Ajustes → Apariencia, y si algo no funciona, escríbenos por WhatsApp desde Ajustes → Ayuda y soporte.' }
];
let tutorialStep = 0;
function tutorialRender(){
  const s = TUTORIAL_SLIDES[tutorialStep];
  const last = tutorialStep === TUTORIAL_SLIDES.length - 1;
  document.getElementById('tutorialSlideBody').innerHTML =
    '<div class="tutorial-icon">' + s.icon + '</div><h3>' + invEsc(s.title) + '</h3><p>' + invEsc(s.text) + '</p>';
  document.getElementById('tutorialDots').innerHTML = TUTORIAL_SLIDES.map((_, i) =>
    '<span class="tutorial-dot' + (i === tutorialStep ? ' on' : '') + '"></span>').join('');
  document.getElementById('tutorialBack').hidden = tutorialStep === 0;
  document.getElementById('tutorialNext').textContent = last ? '🚀 Empezar a usar ORDEVA' : 'Siguiente';
}
function tutorialClose(){
  if(document.getElementById('tutorialDontShow').checked){
    try{ localStorage.setItem(TUTORIAL_SEEN_KEY, '1'); }catch(e){}
  }
  document.getElementById('tutorialOverlay').classList.remove('show');
}
function maybeShowTutorial(forzar){
  // Quien ya completó el asistente de inicio tiene la tarjeta «Primeros pasos»: el recorrido solo sale si lo pide.
  try{ if(!forzar && data && data.onboarding) return; }catch(e){}
  let seen = false;
  try{ seen = localStorage.getItem(TUTORIAL_SEEN_KEY) === '1'; }catch(e){}
  if(seen) return;
  tutorialStep = 0;
  tutorialRender();
  document.getElementById('tutorialOverlay').classList.add('show');
}
document.getElementById('tutorialSkip').addEventListener('click', tutorialClose);
document.getElementById('tutorialBack').addEventListener('click', () => { if(tutorialStep > 0){ tutorialStep--; tutorialRender(); } });
document.getElementById('tutorialNext').addEventListener('click', () => {
  if(tutorialStep < TUTORIAL_SLIDES.length - 1){ tutorialStep++; tutorialRender(); }
  else tutorialClose();
});
/* Pantalla de bloqueo: tapa la app y pide la contraseña del usuario. La app sigue trabajando debajo
   (pedidos, música, TV); no se recarga nada. */
function bloquearApp(){
  if(typeof authUser === 'undefined' || !authUser || document.getElementById('lockOv')) return;
  const ov = document.createElement('div'); ov.id = 'lockOv';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:var(--bg,#0b0b0b);display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = '<form style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px">' +
    '<div style="font-size:40px;text-align:center">🔒</div><b style="text-align:center;font-size:18px">ORDEVA bloqueado</b><div class="auth-hint" style="text-align:center">Usuario: <b></b></div>' +
    '<label>Contraseña<input id="lockPass" type="password" autocomplete="current-password"></label><div class="auth-err" id="lockErr"></div>' +
    '<button class="btn-primary" type="submit">Desbloquear</button><button class="auth-link" type="button" id="lockOtro">Entrar con otro usuario</button></form>';
  ov.querySelector('.auth-hint b').textContent = authUser;
  document.body.appendChild(ov);
  const f = ov.querySelector('form'), inp = ov.querySelector('#lockPass'), err = ov.querySelector('#lockErr');
  f.onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    const espera = authLoginLocked(authUser); if(espera){ err.textContent = '🔒 Demasiados intentos. Espera ' + espera + ' min.'; return; }
    const u = authUsers().find(x => x.user === authUser);
    if(!u || !(await authClaveOk(u, inp.value))){ authLoginFail(authUser); err.textContent = 'Contraseña incorrecta.'; inp.value = ''; return; }
    authLoginClear(authUser); ov.remove();
  };
  ov.querySelector('#lockOtro').onclick = () => { try{ saveData(); }catch(e){} localStorage.removeItem(AUTH_SESSION_KEY); location.reload(); };
  setTimeout(() => inp.focus(), 100);
}
window.bloquearApp = bloquearApp;
/* 🔒 Bloqueo automático por inactividad (opcional, por celular). */
(function(){
  let ult = Date.now();
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => document.addEventListener(ev, () => { ult = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => {
    try{
      const min = +localStorage.getItem('cm-autolock') || 0;
      if(!min || typeof authUser === 'undefined' || !authUser) return;
      const ov = document.getElementById('authOverlay'); if(ov && !ov.hidden) return;
      if(Date.now() - ult > min * 6e4){ ult = Date.now(); bloquearApp(); }
    }catch(e){}
  }, 20000);
})();
/* 👁 Ver la contraseña mientras se escribe: un ojo en TODOS los campos de contraseña (entrada, recuperar,
   usuarios, ORDEVA Nube…), también en los que se crean después. */
(function(){
  const st = document.createElement('style');
  st.textContent = '.pw-wrap{position:relative;display:block}.pw-wrap>input{width:100%;box-sizing:border-box;padding-right:46px!important}.pw-ojo{position:absolute;right:4px;top:50%;transform:translateY(-50%);border:0;background:none;color:var(--ink-soft,#999);font-size:19px;line-height:1;padding:8px;cursor:pointer;border-radius:8px}.pw-ojo:focus-visible{outline:2px solid var(--amber,#f59e0b)}';
  document.head.appendChild(st);
  const poner = inp => {
    if(!inp || inp.dataset.ojo || inp.type !== 'password') return;
    inp.dataset.ojo = '1';
    const w = document.createElement('span'); w.className = 'pw-wrap';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-ojo'; b.textContent = '👁'; b.setAttribute('aria-label', 'Ver contraseña');
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const ver = inp.type === 'password'; inp.type = ver ? 'text' : 'password'; b.textContent = ver ? '🙈' : '👁'; b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Ver contraseña'); inp.focus(); });
    w.appendChild(b);
  };
  const todos = root => { try{ (root.querySelectorAll ? root : document).querySelectorAll('input[type="password"]').forEach(poner); }catch(e){} };
  const ini = () => { todos(document); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if(n.nodeType === 1){ if(n.matches && n.matches('input[type="password"]')) poner(n); else todos(n); } }))).observe(document.body, { childList: true, subtree: true }); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ini); else ini();
  // Al salir de la entrada, la contraseña vuelve a quedar oculta.
  document.addEventListener('submit', e => { try{ e.target.querySelectorAll('input[data-ojo]').forEach(i => { i.type = 'password'; const b = i.parentNode.querySelector('.pw-ojo'); if(b) b.textContent = '👁'; }); }catch(x){} }, true);
})();
// ---------- Cuentas con correo = cuentas de ORDEVA Nube ----------
// Un correo es UNA sola cuenta en todos los celulares: se crea y se comprueba en la nube (no solo en este
// celular), así no se puede crear otra cuenta con el mismo correo y en otro celular se ven los mismos datos.
// Los usuarios sin correo (ej. «mesero1») siguen siendo de este celular, como siempre.
const authEsCorreo = t => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(t || '').trim());
const authNubeCuentas = () => { const n = window.ventoNube; return n && n.configurada && n.configurada() && n.crearCuenta ? n : null; };
const authYaExiste = e => /already registered|already exists/i.test(String((e && e.message) || e));
const authClaveMala = e => /invalid login credentials/i.test(String((e && e.message) || e));
const authSinRed = e => /failed to fetch|networkerror|load failed|sin conexión|no se pudo cargar|timeout/i.test(String((e && e.message) || e));
// ¿Este negocio todavía no tiene nada propio (ni ventas, ni mesas abiertas, ni productos creados a mano)?
function authDatosPristinos(d){
  if(!d) return true;
  if((d.history || []).length || (d.closures || []).length) return false;
  if(Object.values(d.tables || {}).some(t => t && (t.items || []).length)) return false;
  return (d.products || []).every(p => /^prod-/.test(String(p && p.id)));
}
async function authPonerClaveLocal(user, pass){
  const us = authUsers(), u = us.find(x => x.user === user); if(!u) return;
  u.salt = Math.random().toString(36).slice(2) + Date.now().toString(36); u.hash = await authHashClave(pass, u.salt);
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(us));
}
// Deja este celular conectado al negocio de la cuenta (después de entrar). Si la cuenta todavía no tiene
// negocio en la nube, sube el de este celular. Sin internet no pasa nada: se intenta en la próxima entrada.
async function authConectarNube(email, pass, crearSiFalta){
  const nb = authNubeCuentas(); if(!nb || nb.conectado(email)) return;
  try{
    let lista;
    try{ lista = await nb.entrarCuenta(email, pass); }
    catch(e){
      if(!authClaveMala(e) || !crearSiFalta) throw e;
      // Cuenta vieja que solo existía en este celular: se crea en la nube con el mismo correo y contraseña.
      try{ const r = await nb.crearCuenta(email, pass, ''); if(!r.sesion){ showToast('📧 Te mandamos un correo a ' + email + ' para confirmar la cuenta. Al confirmarla, tus datos quedan guardados en tu cuenta.', 9000); return; } lista = []; }
      catch(e2){
        if(authYaExiste(e2)){ showToast('⚠️ ' + email + ' ya tiene cuenta de ORDEVA con OTRA contraseña. Para ver los mismos datos en todos tus celulares: cierra sesión y entra con la contraseña de esa cuenta.', 10000); return; }
        throw e2;
      }
    }
    if(lista.length) await nb.vincular(lista[0], authDatosPristinos(data));
    else await nb.crearNegocio((data && data.businessName) || 'Mi negocio');
    showToast('✅ Cuenta conectada: con ' + email + ' ves los mismos datos en cualquier celular.', 5000);
  }catch(e){
    if(/not confirmed/i.test(String(e && e.message))) showToast('📧 Falta confirmar el correo ' + email + ': abre el mensaje que te llegó. Mientras tanto los datos quedan solo en este celular.', 8000);
    else if(!authSinRed(e)) showToast('⚠️ Tu cuenta de ORDEVA: ' + nb.msgError(e), 6000);
  }
}
// Entrar con una cuenta de la nube que no está en este celular (celular nuevo) o cuya contraseña se cambió
// en otro celular. Lanza el error de la nube (ej. contraseña incorrecta) para mostrarlo.
// pass = null y lista: ya se entró con un código (correo o celular), sin contraseña.
// 1.59.2: la contraseña guardada en este celular sirve sin internet. Con internet se confirma con la cuenta: si se
// cambió en otro equipo o se la cambió el soporte de ORDEVA, la vieja deja de servir aquí también (antes seguía
// entrando con ella para siempre en el celular donde ya había entrado). Se cierra la sesión y pide la nueva.
async function authRevisarClave(email, pass){
  const nb = authNubeCuentas(); if(!nb || !nb.verificarClave || navigator.onLine === false) return;
  let ok; try{ ok = await nb.verificarClave(email, pass); }catch(e){ return; }
  if(ok !== false) return;
  await authSalirPorClave(email);
}
// La contraseña de la cuenta cambió (en otro equipo o desde ORDEVA Admin): se guarda todo, la vieja deja de servir
// en este celular (también sin internet) y vuelve a la entrada con el aviso «La contraseña de X cambió».
// 1.60.0: también lo llama lib/vento-cuenta.js cuando el servidor avisa que se la cambiaron estando adentro.
// 1.61.0: motivo 'sesiones' = cerraron la sesión en todos los equipos (la contraseña es la misma, pero hay que entrar
// otra vez con internet).
async function authSalirPorClave(email, motivo){
  if(authUser !== email) return;
  try{ await authPonerClaveLocal(email, authClaveAzar()); }catch(e){}
  try{ saveData(); await guardadoAhora(); }catch(e){}
  try{
    localStorage.removeItem(AUTH_SESSION_KEY);
    if(motivo === 'sesiones') sessionStorage.setItem('vento-aviso-entrada', JSON.stringify({ u: email, m: '🚪 Se cerró la sesión de ' + email + ' en todos los equipos. Tu contraseña es la misma: entra otra vez (con internet).' }));
    else sessionStorage.setItem('vento-clave-cambio', email);
  }catch(e){}
  location.reload();
}
window.ventoSalirPorClave = authSalirPorClave;
// 1.60.0: el dueño cambió en OTRO equipo a quien está usando este (nube/vento-usuarios.js): le quitó el usuario o le
// cambió la contraseña → se guarda todo y vuelve a la entrada con el aviso. Si solo le cambió el rol, sigue adentro con el nuevo.
window.ventoSacarUsuario = async function(user, motivo){
  if(authUser !== user) return;
  try{ saveData(); await guardadoAhora(); }catch(e){}
  try{
    if(motivo !== 'rol'){ localStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.setItem('vento-aviso-entrada', JSON.stringify({ u: motivo === 'clave' ? user : '',
      m: motivo === 'clave' ? '🔑 El administrador le cambió la contraseña a ' + user + '. Entra con la nueva.' : '👤 El administrador quitó el usuario ' + user + ' de este negocio.' })); }
  }catch(e){}
  location.reload();
};
window.addEventListener('vento-usuarios', () => { try{ accUsuariosPintar(); }catch(e){} });
async function authEntrarDesdeNube(email, pass, listaCodigo){
  const nb = authNubeCuentas();
  const lista = listaCodigo || await nb.entrarCuenta(email, pass);
  const n = lista[0] || null;
  const yaEstaba = authUsers().some(x => x.user === email);
  if(yaEstaba){
    if(pass) await authPonerClaveLocal(email, pass);
    await enterApp(email, null);
    if(n){ if(!nb.conectado(email)) await nb.vincular(n, authDatosPristinos(data)); }
    else await nb.crearNegocio((data && data.businessName) || 'Mi negocio');
    return;
  }
  // Usuario de este celular para la cuenta (así también entra sin internet). Si en este celular ya hay otro
  // negocio, la cuenta va en su propio espacio y no se mezcla con ese.
  let cuenta = null;
  if(authUsers().length){
    cuenta = 'c' + Date.now().toString(36);
    const sede = await addSede((n && n.nombre) || 'Mi negocio', cuenta);
    localStorage.setItem(CURRENT_SEDE_KEY, sede.id); STORAGE_KEY = sede.key;
  }else{
    const sede = rawSedesList().find(x => x.id === 'default'); localStorage.setItem(CURRENT_SEDE_KEY, 'default'); STORAGE_KEY = sede ? sede.key : 'bar-data';
  }
  // Con código no hay contraseña en este celular: se guarda una al azar (sin internet se entra con la de la cuenta
  // después de entrar una vez con ella, o con otro código).
  const msg = await authAddUser(email, pass || authClaveAzar(), n && n.rol === 'mesero' ? 'staff' : 'admin', cuenta);
  if(msg) throw new Error(msg);
  if(n) await nb.vincular(n, true);          // se bajan los datos del negocio a este celular
  await enterApp(email, null);
  if(!n) await nb.crearNegocio((data && data.businessName) || 'Mi negocio');
  showToast(n ? '✅ Listo: estos son los datos de «' + n.nombre + '», los mismos de tus otros celulares.' : '✅ Cuenta lista en este celular.', 5000);
}
const authClaveAzar = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return 'cod-' + Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); };
// «¿Olvidaste tu contraseña?» con cuenta de ORDEVA: el código temporal del correo abre la cuenta, se pone la
// contraseña nueva (en la cuenta, para todos los celulares) y se entra de una.
async function authRecoverNube(email, code, newPass, newPass2){
  if((newPass || '').length < 6) return 'La contraseña nueva debe tener al menos 6 caracteres.';
  if(newPass2 !== undefined && newPass !== newPass2) return 'Las dos contraseñas nuevas no son iguales.';
  let lock; try{ lock = JSON.parse(localStorage.getItem('cm-rec-lock')) || { n: 0, t: 0, nivel: 0 }; }catch(e){ lock = { n: 0, t: 0, nivel: 0 }; }
  const espera = [10, 60, 24 * 60][Math.min(lock.nivel || 0, 2)] * 60e3;
  if(lock.n >= 5 && Date.now() - lock.t < espera) return 'Demasiados intentos. Espera ' + (espera >= 864e5 ? 'un día' : espera >= 36e5 ? 'una hora' : '10 minutos') + ' para volver a intentar.';
  const nb = authNubeCuentas(); if(!nb || !nb.entrarConCodigo) return 'Para cambiar la contraseña hace falta internet.';
  let r;
  try{ r = await nb.entrarConCodigo(email, code, false); }
  catch(e){ localStorage.setItem('cm-rec-lock', JSON.stringify({ n: (lock.n || 0) + 1, t: Date.now(), nivel: lock.nivel || 0 })); return nb.msgError(e); }
  localStorage.removeItem('cm-rec-lock');
  try{ await nb.nuevaClave(newPass); }catch(e){ return '⚠️ ' + nb.msgError(e); }
  try{ sessionStorage.removeItem('cm-rec-mail'); }catch(e){}
  await authEntrarDesdeNube(r.email, newPass, r.negocios);
  return { ok: true, correo: true, entro: true };
}
function showAuth(firstRun){
  const ov = document.getElementById('authOverlay');
  document.getElementById('authTitle').textContent = firstRun ? 'Crear cuenta' : 'Iniciar sesión';
  document.getElementById('authBtn').textContent = firstRun ? 'Crear cuenta y entrar' : 'Entrar';
  document.getElementById('authSetup').hidden = !firstRun;
  document.getElementById('authSetup').style.display = firstRun ? 'flex' : 'none';
  document.getElementById('authPass').autocomplete = firstRun ? 'new-password' : 'current-password';
  fillTypeSelect(document.getElementById('authType'), 'tienda');
  authTipoPropio = '';
  window.ventoTipoBoton(document.getElementById('authTypePick'), 'tienda', (k, propio) => { document.getElementById('authType').value = k; authTipoPropio = propio; });
  { const hp = document.getElementById('authTypePick'); if(hp && !document.getElementById('authTipoAviso')){ const d = document.createElement('div'); d.id = 'authTipoAviso'; d.style.cssText = 'font-size:12px;color:var(--ink-soft);margin-top:4px;line-height:1.4'; d.textContent = TIPO_AVISO; hp.parentNode.insertBefore(d, hp.nextSibling); } }
  ov.hidden = false;
  const af = document.getElementById('authForm'), rf = document.getElementById('recForm'), g = i => document.getElementById(i);
  const otpF = g('otpForm');
  af.hidden = false; rf.hidden = true; if(otpF) otpF.hidden = true;     // siempre se vuelve a «Iniciar sesión / Crear cuenta»
  let claveCambio = ''; try{ claveCambio = sessionStorage.getItem('vento-clave-cambio') || ''; sessionStorage.removeItem('vento-clave-cambio'); }catch(e){}
  g('authForgot').hidden = firstRun;
  // «Crear cuenta nueva» en la entrada: otro negocio en este equipo, con sus propios datos y usuarios.
  // Sin ningún usuario en el celular arranca en «crear cuenta», pero se puede pasar a «iniciar sesión»
  // (celular nuevo de alguien que ya tiene cuenta con su correo).
  let modoNueva = firstRun;
  const hintSetup = document.querySelector('#authSetup .auth-hint');
  const conNube = () => !!authNubeCuentas();
  const ponerModo = nueva => {
    modoNueva = nueva;
    const vacio = !authUsers().length;
    g('authTitle').textContent = nueva ? (vacio ? 'Crear cuenta' : 'Crear cuenta nueva') : 'Iniciar sesión';
    g('authBtn').textContent = nueva ? (vacio ? 'Crear cuenta y entrar' : 'Crear cuenta y empezar') : 'Entrar';
    g('authSetup').hidden = !nueva; g('authSetup').style.display = nueva ? 'flex' : 'none';
    if(hintSetup) hintSetup.innerHTML = nueva
      ? (vacio ? 'Primera vez: crea el usuario administrador de este equipo.' : 'Para <b>otro negocio</b>: tendrá sus propios datos y usuarios, separados de los que ya están aquí. Luego te hacemos unas preguntas para que ORDEVA se adapte a tu negocio.<br>¿Eres empleado de un negocio que ya está aquí? Pídele al administrador que te cree el usuario.')
        + (conNube() ? '<br>📧 Usa tu <b>correo</b>: es tu cuenta en todos tus celulares, con los mismos datos.' : '')
      : '';
    g('authPass').autocomplete = nueva ? 'new-password' : 'current-password';
    g('authForgot').hidden = nueva; g('authRestoreBtn').hidden = nueva && !vacio;
    const ch = document.getElementById('authUsers'); if(ch){ ch.hidden = nueva || !authUsers().length; ch.style.display = ch.hidden ? 'none' : ''; }
    g('authNueva').textContent = nueva ? (vacio ? '¿Ya tienes cuenta? Entra con tu correo' : '← Ya tengo cuenta: iniciar sesión') : '➕ Crear cuenta nueva';
    g('authTabs').querySelectorAll('[data-tab]').forEach(b => { const on = (b.dataset.tab === 'crear') === nueva; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    g('authCodigo').hidden = nueva || !conNube();
    g('authErr').textContent = '';
    if(nueva){ g('authUser').value = ''; g('authPass').value = ''; g('authBiz').focus(); } else if(vacio) g('authUser').focus();
  };
  // Las pestañas «🔑 Iniciar sesión | ➕ Crear cuenta» están siempre a la vista (el botón de abajo ya no hace falta).
  g('authNueva').hidden = true;
  g('authNueva').onclick = () => ponerModo(!modoNueva);
  g('authTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if(b && (b.dataset.tab === 'crear') !== modoNueva) ponerModo(b.dataset.tab === 'crear'); };
  ponerModo(!!firstRun);
  try{ const av = JSON.parse(sessionStorage.getItem('vento-aviso-entrada') || 'null'); sessionStorage.removeItem('vento-aviso-entrada');
    if(av && av.m){ setTimeout(() => { ponerModo(false); if(av.u) g('authUser').value = av.u; g('authErr').textContent = av.m; }, 0); } }catch(e){}
  if(claveCambio){ ponerModo(false); g('authUser').value = claveCambio; g('authErr').textContent = '🔑 La contraseña de ' + claveCambio + ' cambió (en otro equipo o la cambió el soporte de ORDEVA). Entra con la nueva.'; setTimeout(() => { try{ g('authPass').focus(); }catch(e){} }, 50); }
  // Usuarios de este equipo: se tocan para no tener que escribir el nombre.
  let chips = document.getElementById('authUsers');
  if(!chips){ chips = document.createElement('div'); chips.id = 'authUsers'; chips.className = 'auth-users'; g('authUser').closest('label').before(chips); }
  const us = firstRun ? [] : authUsers();
  chips.innerHTML = '';
  chips.hidden = !us.length;
  us.forEach(u => {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = (u.role === 'admin' ? '👑 ' : '🧑‍🍳 ') + '<span></span> <small>' + (u.role === 'admin' ? 'Admin' : 'Mesero') + '</small>';
    b.querySelector('span').textContent = u.user;
    b.onclick = () => {
      g('authUser').value = u.user; chips.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      // Con PIN: teclado de números y «PIN o contraseña»
      const conPin = authPinPuede(u); g('authPass').inputMode = conPin ? 'numeric' : ''; g('authPass').placeholder = conPin ? '🔢 PIN o contraseña' : '';
      g('authPass').focus();
    };
    if(authPinPuede(u)) b.title = 'Entra con su PIN';
    chips.appendChild(b);
  });
  g('authForgot').onclick = () => { af.hidden = true; rf.hidden = false; g('recUser').value = g('authUser').value; };
  g('recBack').onclick = () => { rf.hidden = true; af.hidden = false; };
  // Se ve desde el inicio (crear cuenta o iniciar sesión): si el celular quedó
  // sin ningún usuario guardado (datos borrados, celular nuevo, etc.), el
  // código de WhatsApp no sirve porque no hay ninguna cuenta local con la que
  // compararlo — la única forma real de recuperar el acceso ahí es restaurar
  // el archivo .json que se guardó como respaldo (Ajustes → Transferir).
  g('authRestoreBtn').onclick = () => g('authRestoreFile').click();
  g('authRestoreFile').onchange = e => {
    const file = e.target.files[0];
    if(file && typeof window.importBackup === 'function') window.importBackup(file);
    else if(file) showToast('No se pudo abrir el restaurador de respaldo.');
    e.target.value = '';
  };
  g('recMailBtn').onclick = async () => {
    const b = g('recMailBtn'), t = g('recMailTxt'); b.disabled = true; b.textContent = '⏳ Enviando…'; t.textContent = '';
    try{ const r = await authCorreoEnviar(g('recUser').value);
      t.textContent = r.ok ? (r.codigo ? '✅ Te mandamos un código temporal a ' + r.mascara + ' (revisa también «Spam»). Escríbelo abajo con tu contraseña nueva. Vence en 15 minutos.'
        : '✅ Te mandé un correo a ' + r.mascara + ' (revisa también «Spam»). Toca el enlace desde ESTE celular: ORDEVA se abre y te pide la contraseña nueva. Si en el correo viene un código de números, escríbelo abajo.') : '⚠️ ' + r.error;
      if(r.ok) g('recCode').focus(); }
    finally{ b.disabled = false; b.textContent = '📧 Enviarme otro código'; }
  };
  // ---------- 📲 Entrar fácil con un código (sin contraseña): al correo o por mensaje de texto ----------
  if(otpF){
    let por = 'correo', espera = 0, tEspera = null;
    const nbc = () => authNubeCuentas();
    const ponerPor = async p => {
      por = p;
      g('otpTabs').querySelectorAll('[data-por]').forEach(b => { const on = b.dataset.por === p; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      const cel = p === 'celular', d = g('otpDest');
      g('otpDestTxt').textContent = cel ? 'Tu número de celular' : 'Tu correo';
      d.type = cel ? 'tel' : 'email'; d.inputMode = cel ? 'tel' : 'email'; d.autocomplete = cel ? 'tel' : 'email';
      d.placeholder = cel ? '300 123 4567' : 'tucorreo@gmail.com';
      d.value = cel ? '' : (authEsCorreo(g('authUser').value.trim()) ? g('authUser').value.trim().toLowerCase() : '');
      g('otpPaso2').hidden = true; g('otpErr').textContent = ''; g('otpCode').value = '';
      g('otpHint').textContent = cel ? 'Te llega un mensaje de texto con un código de 6 números. Sirve si ya uniste tu celular a la cuenta (Ajustes → Negocio → 📱 Celular de la cuenta).'
        : 'Sin contraseña: te mandamos un código de 6 números al correo de tu cuenta y entras con él.';
      g('otpEnviar').disabled = false;
      if(cel){
        const nb = nbc(), ok = nb && nb.celularDisponible ? await nb.celularDisponible() : false;
        if(por !== 'celular') return;
        if(!ok){ g('otpHint').textContent = '📱 Entrar con un mensaje de texto todavía no está activado en ORDEVA. Mientras tanto, toca «📧 Al correo».'; g('otpEnviar').disabled = true; }
      }
    };
    const abrirOtp = () => { af.hidden = true; rf.hidden = true; otpF.hidden = false; ponerPor('correo'); setTimeout(() => { try{ g('otpDest').focus(); }catch(e){} }, 30); };
    g('authCodigo').onclick = abrirOtp;
    // Llegó tocando el enlace del correo del código: entra con esa sesión.
    let enl = null; try{ enl = JSON.parse(sessionStorage.getItem('vento-codigo') || 'null'); sessionStorage.removeItem('vento-codigo'); }catch(e){}
    if(enl && enl.a && nbc()){
      const nb = nbc();
      nb.entrarConEnlace(enl.a, enl.r).then(r => authEntrarDesdeNube(r.email, null, r.negocios))
        .catch(x => { abrirOtp(); g('otpErr').textContent = 'El enlace del correo no sirvió (' + nb.msgError(x) + '). Pide un código nuevo.'; });
    }
    g('otpTabs').onclick = e => { const b = e.target.closest('[data-por]'); if(b && b.dataset.por !== por) ponerPor(b.dataset.por); };
    g('otpBack').onclick = () => { otpF.hidden = true; af.hidden = false; };
    const mandar = async () => {
      const nb = nbc(), err = g('otpErr'), dest = g('otpDest').value.trim(), cel = por === 'celular';
      err.textContent = '';
      if(!nb){ err.textContent = 'Para entrar con un código hace falta internet.'; return; }
      if(cel ? dest.replace(/\D/g, '').length < 10 : !authEsCorreo(dest)){ err.textContent = cel ? 'Escribe tu número de celular (ej. 3001234567).' : 'Escribe el correo de tu cuenta.'; return; }
      if(Date.now() < espera){ err.textContent = 'Espera ' + Math.ceil((espera - Date.now()) / 1000) + ' s para pedir otro código.'; return; }
      const b = g('otpEnviar'), t = b.textContent; b.disabled = true; b.textContent = '⏳ Enviando…';
      try{ await nb.codigoEntrar(dest, cel); }
      catch(x){ err.textContent = nb.msgError(x); return; }
      finally{ b.disabled = false; b.textContent = t; }
      g('otpEnviado').textContent = '✅ Te mandamos el código a ' + (cel ? '•••' + dest.replace(/\D/g, '').slice(-4) : authMascara(dest.toLowerCase()) + ' (revisa también «Spam»)') + '. Vence en 15 minutos.';
      g('otpPaso2').hidden = false; g('otpCode').value = '';
      espera = Date.now() + 30000; clearInterval(tEspera);
      const o = g('otpOtro'); const pinta = () => { const q = Math.ceil((espera - Date.now()) / 1000); o.disabled = q > 0; o.textContent = q > 0 ? 'Mandarme otro código (en ' + q + ' s)' : 'Mandarme otro código'; if(q <= 0) clearInterval(tEspera); };
      pinta(); tEspera = setInterval(pinta, 1000);
      setTimeout(() => { try{ g('otpCode').focus(); }catch(e){} }, 30);
    };
    g('otpEnviar').onclick = mandar;
    g('otpOtro').onclick = mandar;
    g('otpDest').onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); if(g('otpPaso2').hidden) mandar(); else g('otpCode').focus(); } };
    g('otpCode').oninput = () => { if(g('otpCode').value.replace(/\D/g, '').length === 6) otpF.requestSubmit(); };
    let entrando = false;
    otpF.onsubmit = async e => {
      e.preventDefault(); if(entrando) return;
      const nb = nbc(), err = g('otpErr'), code = g('otpCode').value.replace(/\D/g, ''), dest = g('otpDest').value.trim();
      err.textContent = '';
      if(code.length < 6){ err.textContent = 'Escribe los 6 números del código.'; return; }
      const b = g('otpEntrar'), t = b.textContent; entrando = true; b.disabled = true; b.textContent = '⏳ Entrando…';
      try{
        const r = await nb.entrarConCodigo(dest, code, por === 'celular');
        await authEntrarDesdeNube(r.email, null, r.negocios);
        authLoginClear(r.email);
        otpF.hidden = true; af.hidden = false; g('otpCode').value = '';
      }catch(x){ err.textContent = nb.msgError(x); }
      finally{ entrando = false; b.disabled = false; b.textContent = t; }
    };
  }
  rf.onsubmit = async (e) => {
    e.preventDefault(); g('recErr').textContent = '';
    let pend = null; try{ pend = JSON.parse(sessionStorage.getItem('cm-rec-mail') || 'null'); }catch(x){}
    const esMail = /^\s*\d[\d\s]{5,9}\s*$/.test(g('recCode').value) && pend && pend.user === g('recUser').value.trim().toLowerCase() && Date.now() - pend.at < 60 * 6e4;
    const bOk = g('recOk'), tOk = bOk.textContent; bOk.disabled = true; bOk.textContent = '⏳ Comprobando…';
    let m;
    try{
      m = esMail && pend.nube ? await authRecoverNube(pend.user, g('recCode').value, g('recNew').value, g('recNew2').value)
        : esMail ? await authRecoverCorreo(g('recUser').value, g('recCode').value, g('recNew').value, g('recNew2').value)
        : await authRecover(g('recUser').value, g('recCode').value, g('recNew').value, g('recNew2').value);
    }catch(x){ m = '⚠️ ' + ((x && x.message) || x); }
    finally{ bOk.disabled = false; bOk.textContent = tOk; }
    if(typeof m === 'string'){ g('recErr').textContent = m; return; }
    if(m.entro){ ['recCode','recNew','recNew2'].forEach(i => g(i).value = ''); rf.hidden = true; af.hidden = false; showToast('✅ Contraseña cambiada. Ya entraste con tu cuenta.', 5000); return; }
    g('authUser').value = g('recUser').value.trim().toLowerCase();
    ['recCode','recNew','recNew2'].forEach(i => g(i).value = '');
    rf.hidden = true; af.hidden = false;
    g('authErr').textContent = m.correo ? '✅ Contraseña cambiada con el código del correo. Ya puedes entrar.' : '✅ Contraseña cambiada. Ya puedes entrar. Ese código ya no sirve más' + (m.quedan ? ' (te quedan ' + m.quedan + ').' : ': crea códigos nuevos en Ajustes → Negocio.');
  };
  let enviando = false;
  document.getElementById('authForm').onsubmit = async (e) => {
    e.preventDefault();
    if(enviando) return;
    const err = document.getElementById('authErr'); err.textContent = '';
    const user = document.getElementById('authUser').value.trim().toLowerCase();
    const pass = document.getElementById('authPass').value;
    const nb = authEsCorreo(user) ? authNubeCuentas() : null;
    const btn = g('authBtn'), txt = btn.textContent;
    const ocupado = t => { enviando = !!t; btn.disabled = !!t; btn.textContent = t || txt; };
    try{
      // El correo del administrador de ORDEVA no es cuenta de cliente (lib/vento-cuenta.js).
      if(authEsCorreo(user) && window.ventoCuenta && await window.ventoCuenta.guardia(user, pass, modoNueva)) return;
      if(modoNueva){
        const vacio = !authUsers().length;
        const biz = document.getElementById('authBiz').value.trim();
        if(!vacio && !biz){ err.textContent = 'Escribe el nombre del negocio.'; return; }
        if(user.length < 3){ err.textContent = 'El usuario debe tener al menos 3 caracteres.'; return; }
        if(pass.length < 6){ err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
        if(authUsers().some(u => u.user === user)){ err.textContent = authEsCorreo(user) ? 'Ese correo ya tiene cuenta en este celular: toca «Ya tengo cuenta» e inicia sesión.' : 'Ese usuario ya existe.'; return; }
        let enNube = false;
        if(nb){
          ocupado('⏳ Creando tu cuenta…');
          try{ enNube = (await nb.crearCuenta(user, pass, '')).sesion ? 'ok' : 'confirmar'; }
          catch(x){
            if(authYaExiste(x)){
              // Ese correo YA es una cuenta: no se crea otra. Si la contraseña es la de esa cuenta, se entra a ella.
              ocupado('⏳ Ese correo ya tiene cuenta: entrando…');
              try{ await authEntrarDesdeNube(user, pass); }
              catch(x2){ err.textContent = authClaveMala(x2) ? 'Ese correo ya tiene una cuenta. Escribe la contraseña de esa cuenta para entrar (o toca «¿Ya tienes cuenta?» → «¿Olvidaste tu contraseña?»).' : nb.msgError(x2); }
              return;
            }
            // Sin internet se crea en este celular y se sube a la nube en la próxima entrada con internet.
            if(!authSinRed(x)){ err.textContent = nb.msgError(x); return; }
          }
        }
        const setup = { biz, type: document.getElementById('authType').value, typeName: authTipoPropio };
        if(vacio){
          const msg = await authAddUser(user, pass, 'admin');
          if(msg){ err.textContent = msg; return; }
        }else{
          const cuenta = 'c' + Date.now().toString(36);
          const msg = await authAddUser(user, pass, 'admin', cuenta);
          if(msg){ err.textContent = msg; return; }
          const sede = await addSede(biz, cuenta);
          localStorage.setItem(CURRENT_SEDE_KEY, sede.id);
        }
        await enterApp(user, setup);
        if(enNube === 'ok') nb.crearNegocio(biz || (data && data.businessName) || 'Mi negocio').catch(x => { if(!authSinRed(x)) showToast('⚠️ Tu cuenta de ORDEVA: ' + nb.msgError(x), 6000); });
        else if(enNube === 'confirmar') showToast('📧 Te mandamos un correo a ' + user + ' para confirmar la cuenta. Al confirmarla, tus datos quedan guardados en tu cuenta.', 9000);
      }else{
        const waitMin = authLoginLocked(user);
        if(waitMin){ err.textContent = '🔒 Demasiados intentos con "' + user + '". Espera ' + waitMin + ' min. e intenta de nuevo.'; return; }
        const u = authUsers().find(x => x.user === user);
        let entro = !!u && await authClaveOk(u, pass);
        if(entro) authPinFallo(user, 0);                       // con la contraseña, el PIN se desbloquea
        else if(u && authPinPuede(u) && /^\d{4,6}$/.test(pass)){
          // Entrar con el PIN (empleados): 5 intentos malos seguidos y queda bloqueado.
          if(authPinFallos(user) >= PIN_MAX_FALLOS){ err.textContent = '🔒 El PIN de "' + user + '" quedó bloqueado por intentos. Entra con la contraseña o pídele al administrador un PIN nuevo.'; return; }
          if(await authPinOk(u, pass)){ entro = true; authPinFallo(user, 0); }
          else{
            const n = authPinFallos(user) + 1; authPinFallo(user, n);
            err.textContent = n >= PIN_MAX_FALLOS ? '🔒 El PIN de "' + user + '" quedó bloqueado por intentos. Entra con la contraseña o pídele al administrador un PIN nuevo.'
              : '❌ PIN incorrecto. Te queda' + (PIN_MAX_FALLOS - n === 1 ? '' : 'n') + ' ' + (PIN_MAX_FALLOS - n) + ' intento' + (PIN_MAX_FALLOS - n === 1 ? '' : 's') + '.';
            document.getElementById('authPass').value = ''; return;
          }
        }
        if(entro){
          authLoginClear(user);
          document.getElementById('authPass').value = '';
          await enterApp(user, null);
          if(nb){ if(nb.conectado(user)) authRevisarClave(user, pass); else authConectarNube(user, pass, true); }
          return;
        }
        // Correo que no está en este celular (celular nuevo) o con la contraseña cambiada en otro celular:
        // se busca la cuenta en la nube.
        if(nb){
          ocupado('⏳ Buscando tu cuenta…');
          try{ await authEntrarDesdeNube(user, pass); authLoginClear(user); document.getElementById('authPass').value = ''; return; }
          catch(x){ if(!authClaveMala(x)){ err.textContent = nb.msgError(x); return; } }
        }
        authLoginFail(user);
        err.textContent = authEsCorreo(user) ? 'Correo o contraseña incorrectos.' : 'Usuario o contraseña incorrectos.';
      }
    }finally{ ocupado(''); }
  };
}
// Locales sin música: se esconden todas las entradas a la sección (barra de abajo, «Más
// secciones» y el menú de la campana). A los clientes se les avisa por el catálogo (campo mz).
const musicaOn = () => data.musicOn !== false;
function aplicarMusica(){
  const on = musicaOn();
  document.querySelectorAll('[data-mus="1"]').forEach(el => { el.hidden = !on; });
  if(!on){
    const act = document.querySelector('nav button.active');
    if(act && act.dataset.view === 'musica'){ const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); }
  }
}
/* ---------- Tipo de negocio FIJO ----------
   Una vez elegido (registro o asistente), cambiar el tipo de negocio necesita permiso del administrador de ORDEVA:
   se le manda una solicitud (servidor: /tipo-pedir) y, cuando la aprueba, la app aplica el cambio sola en todos los
   equipos del negocio (aviso al instante por el canal de la suscripción). Solo aplica con la cuenta de ORDEVA; el
   equipo del proveedor puede cambiarlo siempre. */
const TIPO_AVISO = '⚠️ Elige bien: después, el tipo de negocio solo se puede cambiar con permiso del administrador de ORDEVA.';
const tipoNube = () => { try{ return (window.ventoNube && window.ventoNube.negocio && window.ventoNube.negocio()) || null; }catch(e){ return null; } };
function tipoFijo(){
  try{ if(typeof subEsProv === 'function' && subEsProv()) return false; }catch(e){}
  return !!(typeof data !== 'undefined' && data && data.businessType && data.tipoFijo && tipoNube());
}
const tipoNombreDe = (k, propio) => (k === 'otro' && propio) ? propio : (BUSINESS_TYPES[k] || (VN.get(k) || {}).nombre || k);
let tipoSolicitud = null;
function pintarPickerTipo(){
  const host = document.getElementById('accTypePick'); if(!host) return;
  window.ventoTipoPicker(host, data.businessType || 'tienda', (k, propio) => {
    if(tipoFijo()){ if(k !== data.businessType || (k === 'otro' && propio !== data.businessTypeName)) tipoPedirCambio(k, propio); pintarPickerTipo(); return; }
    if(propio) data.businessTypeName = propio; else delete data.businessTypeName;
    const sel = document.getElementById('accType'); sel.value = k; sel.dispatchEvent(new Event('change'));
  }, { nombrePropio: data.businessType === 'otro' ? (data.businessTypeName || '') : '', max: 12 });
  pintarTipoEstado();
}
function pintarTipoEstado(){
  const host = document.getElementById('accTypePick'); if(!host) return;
  let box = document.getElementById('accTipoEstado');
  if(!box){ box = document.createElement('div'); box.id = 'accTipoEstado'; box.className = 'settings-desc'; box.style.marginTop = '6px'; host.parentNode.insertBefore(box, host.nextSibling); }
  const e = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const s = tipoSolicitud;
  box.innerHTML = (tipoFijo() ? '🔒 El tipo de negocio está fijo: para cambiarlo, elige el nuevo y se le pide permiso al administrador de ORDEVA.' : '') +
    (s && s.estado === 'pendiente' ? '<br>⏳ Pediste cambiar a <b>' + e(s.a_nombre || s.a) + '</b>: esperando la aprobación del administrador.' : '') +
    (s && s.estado === 'rechazado' ? '<br>❌ El administrador no aprobó el cambio a <b>' + e(s.a_nombre || s.a) + '</b>' + (s.respuesta ? ': ' + e(s.respuesta) : '') + '.' : '');
  box.hidden = !box.innerHTML;
}
async function tipoSesion(){ const c = await window.ventoNube.cliente(); const r = await c.auth.getSession(); return { c, tok: r && r.data && r.data.session ? r.data.session.access_token : null }; }
async function tipoPedirCambio(k, propio){
  const n = tipoNube();
  if(!n){ showToast('🔒 Para cambiar el tipo de negocio entra con tu cuenta de ORDEVA y pide permiso al administrador.', 8000); return false; }
  if(!['dueno', 'admin'].includes(n.rol)){ showToast('🔒 Solo el dueño o el administrador del negocio puede pedir el cambio de tipo.', 7000); return false; }
  const nom = tipoNombreDe(k, propio);
  const ok = await showConfirm({ title: '🏷️ ¿Cambiar a «' + nom + '»?', message: 'Cambiar el tipo de negocio necesita permiso del administrador de ORDEVA. Le mandamos la solicitud y, apenas la apruebe, tu app cambia sola en todos tus equipos.', confirmText: 'Pedir permiso', cancelText: 'Cancelar', icon: '🔒' });
  if(!ok) return false;
  try{
    const { tok } = await tipoSesion(); const cfg = window.ventoNube.config();
    const r = await fetch(cfg.url.replace(/\/+$/, '') + '/functions/v1/vento-suscripciones/tipo-pedir', { method: 'POST', headers: { apikey: cfg.key, Authorization: 'Bearer ' + (tok || cfg.key), 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio: n.id, a: k, a_nombre: nom, de: data.businessType || null, de_nombre: tipoNombre(data.businessType), propio: k === 'otro' ? (propio || '') : '' }) });
    const j = await r.json().catch(() => ({}));
    if(!r.ok || j.ok === false) throw new Error(j.mensaje || 'No se pudo enviar la solicitud.');
    tipoSolicitud = j.solicitud; pintarTipoEstado();
    showToast('📨 Solicitud enviada: el administrador de ORDEVA te avisa cuando apruebe el cambio a «' + nom + '».', 8000);
    return true;
  }catch(e){ showToast('⚠️ ' + (e.message || 'Sin conexión: inténtalo otra vez.'), 7000); return false; }
}
// Revisa la solicitud: si el administrador la aprobó, el cambio se aplica solo (una vez) y se avisa; si la rechazó, se avisa.
let tipoRevisando = false, tipoUltRev = 0, tipoOtra = false;
async function tipoRevisar(forzar){
  const n = tipoNube(); if(!n) return;
  if(tipoRevisando){ if(forzar) tipoOtra = true; return; }
  if(!forzar && Date.now() - tipoUltRev < 3000) return;
  tipoRevisando = true; tipoUltRev = Date.now();
  try{
    const { c } = await tipoSesion();
    const r = await c.rpc('tipo_mi_cambio', { p_negocio: n.id });
    const s = r && !r.error ? r.data : null; tipoSolicitud = s;
    if(s && s.estado === 'aprobado'){
      data.businessType = s.a; data.tipoFijo = true;
      if(s.a === 'otro' && s.propio) data.businessTypeName = s.propio; else delete data.businessTypeName;
      try{ cartaLabel(); aplicarVocabulario(); pintarGuiaTipo(); }catch(e){}
      await saveData();
      try{ const sel = document.getElementById('accType'); if(sel) sel.value = s.a; pintarPickerTipo(); }catch(e){}
      try{ await c.rpc('tipo_cambio_aplicado', { p_id: s.id }); }catch(e){}
      showToast('✅ El administrador de ORDEVA aprobó el cambio: tu negocio ahora es «' + tipoNombre(s.a) + '».', 9000);
    }else if(s && s.estado === 'rechazado'){
      let vistos = {}; try{ vistos = JSON.parse(localStorage.getItem('vento-tipo-avisados') || '{}') || {}; }catch(e){}
      if(!vistos[s.id]){ vistos[s.id] = 1; try{ localStorage.setItem('vento-tipo-avisados', JSON.stringify(vistos)); }catch(e){}
        showToast('❌ El administrador de ORDEVA no aprobó el cambio de tipo de negocio' + (s.respuesta ? ': ' + s.respuesta : '.'), 9000); }
    }
    pintarTipoEstado();
  }catch(e){}
  finally{ tipoRevisando = false; if(tipoOtra){ tipoOtra = false; setTimeout(() => tipoRevisar(true), 50); } }
}
window.addEventListener('vento-suscripcion', () => setTimeout(tipoRevisar, 200));
setTimeout(tipoRevisar, 5000);
window.ventoTipo = { fijo: tipoFijo, pedir: tipoPedirCambio, revisar: () => tipoRevisar(true), solicitud: () => tipoSolicitud };
function wireAccountUI(){
  document.getElementById('accUserLabel').textContent = authUser;
  const sel = document.getElementById('accType');
  if(data.businessType && VN.ALIAS[data.businessType]){ data.businessType = VN.ALIAS[data.businessType]; saveData(); }   // claves viejas → nuevas
  fillTypeSelect(sel, data.businessType || 'tienda');
  sel.onchange = () => { if(tipoFijo()){ sel.value = data.businessType; return; } data.businessType = sel.value; cartaLabel(); aplicarVocabulario(); saveData(); pintarGuiaTipo(); showToast('Tipo de negocio: ' + tipoNombre(sel.value)); };
  if(data.businessType && !data.tipoFijo){ data.tipoFijo = true; saveData(); }   // los negocios que ya lo habían elegido también quedan fijos
  pintarPickerTipo();
  const mc = document.getElementById('modoCompletoToggle');
  if(mc){
    mc.checked = !!data.modoCompleto;
    mc.onchange = () => { data.modoCompleto = mc.checked; saveData(); aplicarVocabulario(); pintarGuiaTipo(); showToast(mc.checked ? '👁️ Ahora ves todas las funciones.' : '✨ ORDEVA vuelve a mostrar solo lo de tu negocio.'); };
  }
  pintarGuiaTipo();
  // Agregar usuarios es solo para el admin: un mesero o cajero (staff) no
  // debería poder crear más cuentas por su cuenta.
  const addUserRow = document.getElementById('accAddBtn').closest('.settings-row');
  if(addUserRow) addUserRow.hidden = !authIsAdmin();
  document.getElementById('accAddBtn').onclick = async () => {
    if(!authIsAdmin()){ showToast('🔒 Solo el usuario administrador puede agregar cuentas nuevas.'); return; }
    const u = document.getElementById('accNewUser'), p = document.getElementById('accNewPass'), r = document.getElementById('accNewRole');
    const rol = r && r.value === 'admin' ? 'admin' : 'staff';
    const msg = await authAddUser(u.value, p.value, rol);
    if(msg){ showToast(msg); return; }
    showToast('✅ Usuario agregado: ' + u.value.trim().toLowerCase() + ' (' + (rol === 'admin' ? 'Administrador' : 'Mesero') + ')'); u.value = ''; p.value = '';
    accUsuariosPintar();
  };
  const rcState = () => {
    const u = authUsers().find(x => x.user === authUser), q = authCodigosQuedan(u), el = document.getElementById('accRcState');
    if(!el) return;
    el.textContent = !u || !u.rc ? '⚠️ Todavía no tienes códigos: si olvidas la contraseña no podrás entrar.' : q ? '✅ Te quedan ' + q + ' de 8 códigos (creados el ' + new Date(u.rcT).toLocaleDateString('es-CO') + ').' : '⚠️ Ya usaste todos tus códigos: crea unos nuevos.';
    el.style.color = u && q ? '' : '#f5a524';
    document.getElementById('accRcBtn').textContent = u && u.rc ? '🔄 Crear códigos nuevos' : '🔐 Crear mis códigos';
  };
  rcState();
  document.getElementById('accRcBtn').onclick = () => authCodigosDialogo(rcState);
  try{ authCorreoEstado(); document.getElementById('accMailBtn').onclick = () => authCorreoGuardar(); }catch(e){}
  try{ const al = document.getElementById('accAutoLock'); al.value = String(+localStorage.getItem('cm-autolock') || 0); al.onchange = () => { localStorage.setItem('cm-autolock', al.value); showToast(+al.value ? '🔒 La app se bloquea sola tras ' + al.options[al.selectedIndex].text + ' sin uso.' : 'Bloqueo automático apagado.'); }; }catch(e){}
  document.getElementById('accLogoutBtn').onclick = () => cerrarSesion();
  accUsuariosPintar();
  const ai = document.getElementById('voiceAiToggle');
  ai.checked = voiceAiOn();
  ai.onchange = () => { localStorage.setItem(VOICE_AI_KEY, ai.checked ? '1' : '0'); voiceAIBtnSync(); };
  voiceAIBtnSync();
  const musToggle = document.getElementById('musicOnToggle');
  if(musToggle){
    musToggle.checked = musicaOn();
    musToggle.onchange = () => {
      data.musicOn = musToggle.checked;
      saveData();
      aplicarMusica();
      try{ if(window.vitoPublicarCatalogo) window.vitoPublicarCatalogo(true); }catch(e){}   // que las mesas lo vean de una vez
      showToast(data.musicOn ? '🎵 Música activada: tus clientes ya pueden pedir canciones.' : '🔇 Música apagada: tus clientes ya no verán «Pedir canción».');
    };
  }
  const cmSel = document.getElementById('cancionesMesaSel');
  if(cmSel){
    const v = data.cancionesMesa == null ? 10 : (Number(data.cancionesMesa) || 0); cmSel.value = String([0, 3, 5, 10, 15, 20].includes(v) ? v : 10);
    cmSel.onchange = () => {
      data.cancionesMesa = Number(cmSel.value) || 0; saveData();
      try{ if(window.vitoPublicarCatalogo) window.vitoPublicarCatalogo(true); }catch(e){}            // el QR de las mesas lo sabe de una vez
      try{ window.vitoMod && window.vitoMod.republicarMesas && window.vitoMod.republicarMesas(); }catch(e){}
      showToast(data.cancionesMesa ? '🎵 Cada mesa puede pedir ' + data.cancionesMesa + ' canciones cada 15 minutos.' : '🎵 Sin límite: las mesas piden las canciones que quieran (suenan por turnos justos).');
    };
  }
  const domToggle = document.getElementById('domiciliosOnToggle');
  if(domToggle){
    domToggle.checked = !!data.domiciliosOn;
    const domBtn = document.getElementById('domicilioBtn');
    if(domBtn) domBtn.hidden = !data.domiciliosOn;
    domToggle.onchange = () => {
      data.domiciliosOn = domToggle.checked;
      saveData();
      if(domBtn) domBtn.hidden = !data.domiciliosOn;
      aplicarDomicilios();
    };
  }
  const nequiToggle = document.getElementById('nequiOnToggle');
  const nequiNumberInput = document.getElementById('nequiNumberInput');
  const nequiNameInput = document.getElementById('nequiNameInput');
  if(nequiToggle && nequiNumberInput && nequiNameInput){
    nequiToggle.checked = !!data.nequiOn;
    nequiNumberInput.value = data.nequiNumber || '';
    nequiNameInput.value = data.nequiName || '';
    nequiToggle.onchange = () => {
      if(nequiToggle.checked && !(data.nequiNumber || nequiNumberInput.value.trim())){
        showToast('Primero escribe tu número de Nequi.');
        nequiToggle.checked = false;
        return;
      }
      data.nequiOn = nequiToggle.checked;
      saveData();
    };
    nequiNumberInput.addEventListener('blur', () => {
      data.nequiNumber = nequiNumberInput.value.replace(/\D/g, '').slice(0, 10);
      nequiNumberInput.value = data.nequiNumber;
      saveData();
    });
    nequiNameInput.addEventListener('blur', () => {
      data.nequiName = nequiNameInput.value.trim().slice(0, 60);
      saveData();
    });
  }
  const tipsToggle = document.getElementById('tipsOnToggle');
  if(tipsToggle){
    tipsToggle.checked = !!data.tipsOn;
    tipsToggle.onchange = () => { data.tipsOn = tipsToggle.checked; saveData(); };
  }
  const loyaltyToggle = document.getElementById('loyaltyOnToggle');
  if(loyaltyToggle){
    loyaltyToggle.checked = !!data.loyaltyOn;
    loyaltyToggle.onchange = () => { data.loyaltyOn = loyaltyToggle.checked; saveData(); };
    renderLoyaltyClientsList();
  }
  const casoDescInput = document.getElementById('casoDesc');
  const casoCategoriaSelect = document.getElementById('casoCategoria');
  if(casoDescInput && casoCategoriaSelect){
    casoDescInput.oninput = () => {
      const sugerida = sugerirCategoriaCaso(casoDescInput.value);
      if(sugerida) casoCategoriaSelect.value = sugerida;
    };
  }
  const casoGuardarBtn = document.getElementById('casoGuardarBtn');
  if(casoGuardarBtn){
    casoGuardarBtn.onclick = () => {
      const descripcion = casoDescInput.value.trim();
      if(!descripcion){ showToast('Escribe qué pasó antes de guardar el caso.'); return; }
      crearCaso({
        categoria: casoCategoriaSelect.value,
        urgencia: document.getElementById('casoUrgencia').value,
        telefono: document.getElementById('casoTelefono').value,
        asignadoA: document.getElementById('casoAsignado').value,
        descripcion
      });
      saveData();
      casoDescInput.value = '';
      document.getElementById('casoTelefono').value = '';
      document.getElementById('casoAsignado').value = '';
      casoCategoriaSelect.value = 'pedido';
      document.getElementById('casoUrgencia').value = 'normal';
      renderCasosList();
      showToast('Caso guardado.');
    };
  }
  const casosListEl = document.getElementById('casosList');
  if(casosListEl){
    casosListEl.onclick = (e) => {
      const btn = e.target.closest('.caso-confirmar-btn');
      if(!btn) return;
      const wrap = btn.closest('.caso-resolver-wrap');
      const id = wrap.dataset.casoId;
      const resolucion = wrap.querySelector('.caso-resolucion-input').value;
      const satisfaccionVal = wrap.querySelector('.caso-satisfaccion-input').value;
      resolverCaso(id, resolucion, satisfaccionVal ? +satisfaccionVal : null);
      saveData();
      renderCasosList();
      showToast('Caso marcado como resuelto.');
    };
    renderCasosList();
  }
  const bizNitInput = document.getElementById('bizNitInput');
  const bizAddressInput = document.getElementById('bizAddressInput');
  const ivaOnToggle = document.getElementById('ivaOnToggle');
  const ivaRateInput = document.getElementById('ivaRateInput');
  const invoicePrefixInput = document.getElementById('invoicePrefixInput');
  const invoiceNextNoInput = document.getElementById('invoiceNextNoInput');
  const dianResolucionInput = document.getElementById('dianResolucionInput');
  if(bizNitInput && bizAddressInput && ivaOnToggle && ivaRateInput && invoicePrefixInput && invoiceNextNoInput && dianResolucionInput){
    bizNitInput.value = data.nit || '';
    bizAddressInput.value = data.bizAddress || '';
    ivaOnToggle.checked = !!data.ivaResponsable;
    ivaRateInput.value = data.ivaRate || 19;
    invoicePrefixInput.value = data.invoicePrefix || 'FV';
    invoiceNextNoInput.value = data.invoiceNextNo || 1;
    dianResolucionInput.value = data.dianResolucionText || '';
    bizNitInput.addEventListener('blur', () => { data.nit = bizNitInput.value.trim().slice(0, 40); bizNitInput.value = data.nit; saveData(); });
    bizAddressInput.addEventListener('blur', () => { data.bizAddress = bizAddressInput.value.trim().slice(0, 120); bizAddressInput.value = data.bizAddress; saveData(); });
    ivaOnToggle.onchange = () => { data.ivaResponsable = ivaOnToggle.checked; saveData(); };
    ivaRateInput.addEventListener('blur', () => {
      const v = parseFloat(ivaRateInput.value);
      data.ivaRate = (isFinite(v) && v >= 0) ? v : 19;
      ivaRateInput.value = data.ivaRate;
      saveData();
    });
    invoicePrefixInput.addEventListener('blur', () => {
      data.invoicePrefix = (invoicePrefixInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'FV').slice(0, 8);
      invoicePrefixInput.value = data.invoicePrefix;
      saveData();
    });
    invoiceNextNoInput.addEventListener('blur', () => {
      const v = parseInt(invoiceNextNoInput.value, 10);
      data.invoiceNextNo = (isFinite(v) && v >= 1) ? v : 1;
      invoiceNextNoInput.value = data.invoiceNextNo;
      saveData();
    });
    dianResolucionInput.addEventListener('blur', () => {
      data.dianResolucionText = dianResolucionInput.value.trim().slice(0, 300);
      dianResolucionInput.value = data.dianResolucionText;
      saveData();
    });
  }
  const orderMessageInput = document.getElementById('orderMessageInput');
  const orderExtraInfoInput = document.getElementById('orderExtraInfoInput');
  const orderOpenTimeInput = document.getElementById('orderOpenTimeInput');
  const orderCloseTimeInput = document.getElementById('orderCloseTimeInput');
  const orderHoursNoteInput = document.getElementById('orderHoursNoteInput');
  if(orderMessageInput && orderExtraInfoInput && orderOpenTimeInput && orderCloseTimeInput && orderHoursNoteInput){
    orderMessageInput.value = data.orderMessage || '';
    orderExtraInfoInput.value = data.orderExtraInfo || '';
    orderOpenTimeInput.value = data.orderOpenTime || '';
    orderCloseTimeInput.value = data.orderCloseTime || '';
    orderHoursNoteInput.value = data.orderHoursNote || '';
    const rePublish = () => { saveData(); if(typeof window.vitoPublicarCatalogo === 'function') window.vitoPublicarCatalogo(true); };
    orderMessageInput.addEventListener('blur', () => { data.orderMessage = orderMessageInput.value.trim().slice(0, 200); orderMessageInput.value = data.orderMessage; rePublish(); });
    orderExtraInfoInput.addEventListener('blur', () => { data.orderExtraInfo = orderExtraInfoInput.value.trim().slice(0, 200); orderExtraInfoInput.value = data.orderExtraInfo; rePublish(); });
    orderOpenTimeInput.addEventListener('change', () => { data.orderOpenTime = orderOpenTimeInput.value || ''; rePublish(); });
    orderCloseTimeInput.addEventListener('change', () => { data.orderCloseTime = orderCloseTimeInput.value || ''; rePublish(); });
    orderHoursNoteInput.addEventListener('blur', () => { data.orderHoursNote = orderHoursNoteInput.value.trim().slice(0, 100); orderHoursNoteInput.value = data.orderHoursNote; rePublish(); });
  }
}
async function bootApp(){
  { const us = authUsers(); if(us.some(u => u.rec)){ us.forEach(u => delete u.rec); localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(us)); } }
  const users = authUsers(), ses = localStorage.getItem(AUTH_SESSION_KEY);
  if(ses && (users.some(u => u.user === ses) || (window.ventoNube && window.ventoNube.correo() === ses))) return enterApp(ses, null);
  showAuth(users.length === 0);
}
bootApp();
