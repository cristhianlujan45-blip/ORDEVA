/* ORDEVA · app/04-principal.js — antes estaba dentro de index.html (línea 5515). Se carga en el mismo lugar y orden. */
/* ---------- Lluvia de código (fondo Matrix) ---------- */
(function(){
  const canvas = document.getElementById('matrixRain');
  const ctx = canvas.getContext('2d');
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789$¥ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let fontSize = 15;
  let columns, drops;

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    drops = new Array(columns).fill(0).map(()=> Math.floor(Math.random() * -40));
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(){
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontSize + 'px monospace';
    for(let i=0; i<drops.length; i++){
      const char = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      ctx.fillStyle = 'rgba(180,255,190,0.85)';
      ctx.fillText(char, x, y);
      ctx.fillStyle = 'rgba(0,255,65,0.35)';
      ctx.fillText(char, x, y + fontSize);
      if(y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }
  // 1.58.1 (tacto): no dibuja cuando no se ve (escondida, modo fácil o temática sin lluvia) y se queda quieta 0,4 s cada
  // vez que se toca la pantalla, así el dedo nunca espera a la animación.
  let quietoHasta = 0;
  ['pointerdown', 'touchstart', 'keydown'].forEach(n => window.addEventListener(n, () => { quietoHasta = performance.now() + 400; }, { passive: true, capture: true }));
  setInterval(() => { if(document.hidden || performance.now() < quietoHasta || !canvas.getClientRects().length || document.querySelector('.overlay.show')) return; draw(); }, 45);   // con una ventana abierta (la mesa, cobrar…) tampoco: queda tapada y desenfocada, y redibujarla obligaba a recalcular el desenfoque de toda la pantalla
})();

let data = null;
let currentTable = null;
let STORAGE_KEY = 'bar-data';

const fmtNumber = (n) => new Intl.NumberFormat('es-CO', {
  useGrouping: true,
  maximumFractionDigits: 0
}).format(Math.round(Number(n) || 0));
const fmt = (n) => '$' + fmtNumber(n);
const fmtSpoken = (n) => fmtNumber(n) + ' pesos';

// Desglose de IVA para la factura de venta: en Colombia el precio que se
// cobra al cliente ya trae el IVA incluido, así que la "base gravable" se
// calcula hacia atrás a partir del total (no se suma aparte, o cobraríamos
// de más). Si el negocio no es responsable de IVA, no hay nada que desglosar.
// La numeración de las facturas se presenta con ceros adelante: 0001, 0002…
function numFactura(n){ return String(Math.max(1, Number(n) || 1)).padStart(4, '0'); }
function ivaBreakdown(total, rate){
  const r = Number(rate) || 0;
  if(!r) return { base: total, iva: 0, total };
  const base = total / (1 + r / 100);
  return { base: Math.round(base), iva: Math.round(total - base), total };
}

const hasNativeStorage = (typeof window !== 'undefined') && !!window.storage && typeof window.storage.get === 'function';

// ---------- Almacén grande del equipo (IndexedDB) ----------
// 1.51.0: localStorage tiene unos 5 MB por página y ahí vivían los datos del negocio, 7 copias diarias COMPLETAS y las
// fotos de los comprobantes. Con unas semanas de ventas se llenaba y ORDEVA dejaba de guardar («la memoria está llena»).
// Ahora lo pesado vive en IndexedDB (cientos de MB). localStorage sigue con una copia de los datos mientras quepa (la
// usan las versiones viejas de ORDEVA); si ya no cabe, se queda la última que cupo y manda IndexedDB.
const ventoAlmacen = (() => {
  let dbP = null;
  const abrir = () => dbP || (dbP = new Promise((ok, mal) => {
    try{
      const r = indexedDB.open('vento-datos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); r.onblocked = () => mal(new Error('IndexedDB bloqueada'));
    }catch(e){ mal(e); }
  }).catch(e => { dbP = null; throw e; }));
  const op = (modo, fn) => abrir().then(db => new Promise((ok, mal) => {
    const tx = db.transaction('kv', modo); let res;
    const q = fn(tx.objectStore('kv')); if(q) q.onsuccess = () => { res = q.result; };
    tx.oncomplete = () => ok(res); tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error || new Error('IndexedDB: se canceló'));
  }));
  return { get: k => op('readonly', s => s.get(k)), set: (k, v) => op('readwrite', s => s.put(v, k)), del: k => op('readwrite', s => s.delete(k)), claves: () => op('readonly', s => s.getAllKeys()) };
})();
window.ventoAlmacen = ventoAlmacen;
// Que el navegador no borre este almacén cuando le falte espacio (si lo permite).
try{ navigator.storage && navigator.storage.persist && navigator.storage.persisted().then(p => { if(!p) navigator.storage.persist().catch(() => {}); }).catch(() => {}); }catch(e){}
// Hasta este tamaño también se deja la copia en localStorage (de ahí en adelante solo IndexedDB).
const LS_DATOS_MAX = 1500000;
const metaLs = key => { try{ return JSON.parse(localStorage.getItem(key + '@t') || 'null'); }catch(e){ return null; } };

async function storageGet(key){
  if(typeof guardadoPend !== 'undefined' && guardadoPend && guardadoPend.key === key) await guardadoAhora();   // lo último que se tocó
  if(hasNativeStorage){
    try{
      return await window.storage.get(key, false);
    }catch(e){
      return null; // key not present yet, or native storage unavailable for this key
    }
  }
  let idb = null; try{ idb = await ventoAlmacen.get(key); }catch(e){}
  const raw = localStorage.getItem(key);
  if(idb && typeof idb.v === 'string'){
    // Manda IndexedDB, salvo que localStorage tenga algo escrito por fuera y más nuevo: un respaldo recibido (no trae
    // marca) o una versión vieja de ORDEVA (cambió el texto sin cambiar la marca).
    const m = metaLs(key), porFuera = !!raw && raw !== idb.v && (!m || m.n !== raw.length || m.t > idb.t);
    return { key, value: porFuera ? raw : idb.v, shared: false };
  }
  return raw ? { key, value: raw, shared: false } : null;
}

async function storageSet(key, value){
  if(hasNativeStorage){
    return await window.storage.set(key, value, false);
  }
  const t = Date.now();
  // 1.59.2: primero localStorage (es instantáneo) y después IndexedDB. Al revés, lo guardado justo al cerrar o recargar
  // la app (lo último que se tocó, que se guarda en ese momento) se perdía: la página se iba mientras IndexedDB
  // terminaba y nunca llegaba a localStorage. Al leer gana el más nuevo (storageGet compara la marca de tiempo).
  let enLs = false, errLs = null;
  const ponerLs = () => { try{ localStorage.setItem(key, value); enLs = true; try{ localStorage.setItem(key + '@t', JSON.stringify({ t, n: value.length })); }catch(e){} }catch(e){ errLs = e; } };
  if(value.length <= LS_DATOS_MAX) ponerLs();
  let enIdb = false;
  try{ await ventoAlmacen.set(key, { v: value, t }); enIdb = true; }catch(e){}
  if(!enIdb && !enLs){
    if(value.length > LS_DATOS_MAX) ponerLs();   // sin IndexedDB, aunque sea grande se intenta en localStorage
    if(!enLs) throw errLs || new Error('No se pudo guardar');   // no cupo en ningún lado
  }
  return { key, value, shared: false };
}

function defaultData(){
  const tables = {};
  for(let i=1;i<=4;i++) tables[i] = { items: [], people: [] };
  const categories = [
    { id: 'cat-cervezas', name: 'Cervezas' },
    { id: 'cat-cigarrillos', name: 'Cigarrillos' },
    { id: 'cat-aguardientes', name: 'Aguardientes' }
  ];
  const products = [
    { id: 'prod-aguila-poker', name: 'Aguila/Póker', price: 3300, categoryId: 'cat-cervezas' },
    { id: 'prod-aguila-light', name: 'Aguila light', price: 3500, categoryId: 'cat-cervezas' },
    { id: 'prod-heineken', name: 'Heineken', price: 5000, categoryId: 'cat-cervezas' },
    { id: 'prod-corona-330', name: 'Corona 330ml', price: 5000, categoryId: 'cat-cervezas' },
    { id: 'prod-corona-235', name: 'Corona 235ml', price: 4000, categoryId: 'cat-cervezas' },
    { id: 'prod-stella-artois', name: 'Stella Artois', price: 5000, categoryId: 'cat-cervezas' },
    { id: 'prod-club-colombia', name: 'Club Colombia', price: 4000, categoryId: 'cat-cervezas' },
    { id: 'prod-costena-gris', name: 'Costeña gris', price: 2500, categoryId: 'cat-cervezas' },
    { id: 'prod-costena-verde-330', name: 'Costeña Verde 330ml', price: 3000, categoryId: 'cat-cervezas' },
    { id: 'prod-costenita-235', name: 'Costeñita 235ml', price: 2500, categoryId: 'cat-cervezas' },
    { id: 'prod-cigarrillo-1300', name: 'Cigarrillo 1300', price: 1300, categoryId: 'cat-cigarrillos' },
    { id: 'prod-cigarrillo-1000', name: 'Cigarrillo 1000', price: 1000, categoryId: 'cat-cigarrillos' },
    { id: 'prod-marlboro-lucky-media', name: 'Marlboro/Lucky X media', price: 8500, categoryId: 'cat-cigarrillos' },
    { id: 'prod-amarillo-375', name: 'Amarillo 375ml', price: 35000, categoryId: 'cat-aguardientes' },
    { id: 'prod-amarillo-750', name: 'Amarillo 750ml', price: 70000, categoryId: 'cat-aguardientes' },
    { id: 'prod-amarillo-1lt', name: 'Amarillo 1lt', price: 90000, categoryId: 'cat-aguardientes' }
  ];
  return {
    businessName: 'Cervecería',
    products,
    categories,
    tableCount: 4,
    tables,
    history: []
  };
}

let currentCategoryFilter = null; // null = Todas

async function loadData(){
  try{
    const res = await storageGet(STORAGE_KEY);
    data = res ? JSON.parse(res.value) : defaultData();
  }catch(e){
    data = defaultData();
  }
  if(!data.tables) data.tables = {};
  if(!data.products) data.products = [];
  if(!data.history) data.history = [];
  if(!data.categories) data.categories = [];
  if(!data.closures) data.closures = [];
  if(!data.theme) data.theme = 'noche';
  // El diseño original (Matrix) se deja solo como opción personal en Ajustes,
  // no como lo que ve el negocio por defecto: si alguien lo tenía puesto sin
  // haber elegido conscientemente uno de los diseños nuevos, se pasa una
  // sola vez al nuevo predeterminado.
  if(data.theme === 'matrix' && !data.themeChosen) data.theme = 'noche';
  data.themeChosen = true;
  if(!data.tableViewMode) data.tableViewMode = 'list';
  if(data.easyMode === undefined) data.easyMode = false;
  if(data.tipsOn === undefined) data.tipsOn = false;
  if(data.domiciliosOn === undefined) data.domiciliosOn = false;
  if(data.musicOn === undefined) data.musicOn = true;   // los locales que ya la usaban la conservan
  if(data.nequiOn === undefined) data.nequiOn = false;
  if(data.nequiNumber === undefined) data.nequiNumber = '';
  if(data.nequiName === undefined) data.nequiName = '';
  // ---- Datos para la factura de venta (Colombia) ----
  // No generamos factura electrónica DIAN (eso exige CUFE + firma digital +
  // validación en tiempo real con un proveedor tecnológico autorizado), pero
  // sí armamos un recibo/factura de venta con los datos que suelen pedir los
  // negocios pequeños: NIT, dirección, consecutivo y, si aplica, IVA.
  if(data.nit === undefined) data.nit = '';
  if(data.bizAddress === undefined) data.bizAddress = '';
  if(data.ivaResponsable === undefined) data.ivaResponsable = false;
  if(data.ivaRate === undefined) data.ivaRate = 19;
  if(data.invoicePrefix === undefined) data.invoicePrefix = 'FV';
  if(data.invoiceNextNo === undefined) data.invoiceNextNo = 1;
  if(data.dianResolucionText === undefined) data.dianResolucionText = '';
  // ---- Clientes frecuentes (fidelización) ----
  if(data.loyaltyOn === undefined) data.loyaltyOn = false;
  if(!data.clientesFrecuentes) data.clientesFrecuentes = [];
  // ---- Atención al cliente (casos/reclamos) ----
  if(!data.casos) data.casos = [];
  // ---- Personalización de la página de pedidos (pedido.html) ----
  if(data.orderMessage === undefined) data.orderMessage = '';
  if(data.orderExtraInfo === undefined) data.orderExtraInfo = '';
  if(data.orderOpenTime === undefined) data.orderOpenTime = '';
  if(data.orderCloseTime === undefined) data.orderCloseTime = '';
  if(data.orderHoursNote === undefined) data.orderHoursNote = '';
  applyPalette(data.theme);
  applyCustomBackground();
  applyEasyMode();
  data.products.forEach(p => { if(p.categoryId === undefined) p.categoryId = null; });
  // Compatibilidad: las mejoras de voz usan VOICE_PRODUCT_ALIASES sin alterar
  // productos, precios ni pedidos existentes del usuario.
  Object.values(data.tables).forEach(t=>{
    if(!t.people) t.people = [];
    if(t.name === undefined) t.name = null;
    if(t.items) t.items.forEach(it=>{ if(it.personId === undefined) it.personId = null; });
  });
  renderAll();
}

// ORDEVA Nube (nube/vento-nube.js): la nube lee los datos actuales y, cuando otro celular cambió algo,
// los reemplaza aquí sin volver a subirlos (evita el eco).
window.ventoDatosActuales = () => (typeof data !== 'undefined' ? data : null);
window.ventoAplicarDatosNube = async (obj, respaldarLocal) => {
  if(!obj || typeof obj !== 'object') return;
  // 1.59.2: lo último que se tocó (se guarda un instante después) se guarda YA, antes de poner los datos de la nube.
  // Si no, ese guardado pendiente caía después y pisaba lo que acababa de llegar (celular nuevo con los datos de muestra).
  try{ await guardadoAhora(); }catch(e){}
  window.__nubeAplicando = true;
  try{
    if(respaldarLocal && typeof data !== 'undefined' && data){
      // Antes de cambiar este celular a los datos de la nube, se deja un punto de restauración local.
      await autoBackupAgregar({ day: new Date().toISOString().slice(0, 10) + ' (antes de la nube)', at: Date.now(), data: JSON.stringify(data) }, 8, false);
    }
    await storageSet(STORAGE_KEY, JSON.stringify(obj));
    if(typeof authUser !== 'undefined' && authUser) await loadData();
  }finally{ window.__nubeAplicando = false; }
  try{ window.dispatchEvent(new Event('vento-datos-remotos')); }catch(e){}
  // Llegaron datos de otro equipo: si traen fotos nuevas de productos, se bajan también.
  setTimeout(() => { try{ window.fotosDeLaNube && window.fotosDeLaNube(); }catch(e){} }, 600);
};
// Otro equipo cambió una foto: se baja enseguida (sin esperar a que lleguen los datos).
setTimeout(() => { try{ window.ventoNube && window.ventoNube.archivos && window.ventoNube.archivos.alCambiar(k => { if(/^foto\//.test(k)) setTimeout(() => window.fotosDeLaNube && window.fotosDeLaNube(), 1200); }); }catch(e){} }, 0);
// 1.58.1 (tacto al instante): guardar ya no frena el toque. Antes cada toque (agregar una cerveza, cobrar, quitar…)
// convertía TODO el negocio a texto antes de pintar la pantalla; con meses de ventas eso se sentía en el dedo. Ahora la
// pantalla se pinta primero y se guarda enseguida (en el mismo segundo); varios toques seguidos se guardan juntos una
// vez. Se guarda de inmediato al esconder o cerrar la app, al cambiar de sede/negocio y antes de leer lo guardado.
let guardadoPend = null;
function saveData(){
  const key = STORAGE_KEY, obj = data;
  if(guardadoPend && guardadoPend.key === key && guardadoPend.obj === obj) return guardadoPend.p;
  if(guardadoPend) guardadoAhora();                       // otra sede u otros datos: lo pendiente se guarda ya, con su llave
  let listo; const p = new Promise(r => { listo = r; });
  const g = guardadoPend = { key, obj, p, listo };
  const ir = () => { if(guardadoPend === g) guardadoAhora(); };
  try{ requestAnimationFrame(() => setTimeout(ir, 0)); }catch(e){}
  g.t = setTimeout(ir, 120);                              // sin cuadros (app en el fondo): igual se guarda enseguida
  return p;
}
function guardadoAhora(){
  const g = guardadoPend; if(!g) return Promise.resolve();
  guardadoPend = null; clearTimeout(g.t);
  const r = guardarYa(g.key, g.obj); g.listo(r); return r;
}
window.ventoGuardarYa = guardadoAhora;
document.addEventListener('visibilitychange', () => { if(document.hidden) guardadoAhora(); });
window.addEventListener('pagehide', () => { guardadoAhora(); });
window.addEventListener('beforeunload', () => { guardadoAhora(); });
async function guardarYa(key, obj){
  try{
    const json = JSON.stringify(obj);
    const result = await storageSet(key, json);
    if(!result) showToast('No se pudo guardar. Intenta de nuevo.');
    else { autoBackupTick(json); if(!window.__nubeAplicando) try{ window.ventoNube && window.ventoNube.cambio(); }catch(e){} }
  }catch(e){
    const cod = window.mesoraLogError ? window.mesoraLogError('guardar', 'No se pudo guardar: ' + (e && (e.name + ' ' + e.message) || e), 'saveData') : '';
    const lleno = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
    showToast((lleno ? '⚠️ La memoria de la app está llena y no se pudo guardar.' : '⚠️ Error al guardar los datos.') + ' Abre ORDEVA y dile "arregla los errores". El detalle ya le llegó a ORDEVA.', 6000);
  }
}

// ---------- Puntos de restauración automáticos ----------
// Una copia interna por día (hasta 7), sin que el usuario tenga que acordarse
// de nada. No reemplaza el respaldo manual (Ajustes → Transferir), pero salva
// si algo se dañó por accidente y no había respaldo reciente.
const AUTOBK_KEY = 'bar-autobk-points';
// 1.51.0: los puntos viven en IndexedDB (ventoAlmacen). En localStorage, 7 copias COMPLETAS del negocio llenaban la
// memoria y ORDEVA dejaba de guardar. Los que había en localStorage se pasan solos la primera vez, sin perder ninguno.
async function autoBackupPoints(){
  let pts = null; try{ pts = await ventoAlmacen.get(AUTOBK_KEY); }catch(e){}
  pts = Array.isArray(pts) ? pts : [];
  let viejos = null; try{ viejos = JSON.parse(localStorage.getItem(AUTOBK_KEY) || 'null'); }catch(e){}
  if(Array.isArray(viejos) && viejos.length){
    const todos = pts.concat(viejos.filter(v => v && !pts.some(p => p.at === v.at))).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 8);
    try{ await ventoAlmacen.set(AUTOBK_KEY, todos); localStorage.removeItem(AUTOBK_KEY); }catch(e){}
    return todos;
  }
  return pts;
}
let autoBkDia = null, autoBkCola = Promise.resolve();
// unoPorDia: el punto automático (uno por día); si no, siempre se agrega (p. ej. «antes de la nube»).
function autoBackupAgregar(punto, max, unoPorDia){
  autoBkCola = autoBkCola.then(async () => {
    try{
      const points = await autoBackupPoints();
      if(unoPorDia && points.length && points[0].day === punto.day){ autoBkDia = punto.day; return; }
      points.unshift(punto);
      await ventoAlmacen.set(AUTOBK_KEY, points.slice(0, max));
      if(unoPorDia) autoBkDia = punto.day;
    }catch(e){ /* si falla, no interrumpe el guardado normal */ }
  });
  return autoBkCola;
}
function autoBackupTick(json){
  const today = new Date().toISOString().slice(0, 10);
  if(autoBkDia === today) return;          // ya hay punto de hoy (no se lee el almacén en cada guardado)
  autoBackupAgregar({ day: today, at: Date.now(), data: json }, 7, true);
}
async function restoreAutoBackupPoint(point){
  if(!point) return;
  const ok = await showConfirm({
    title: '¿Restaurar este punto?',
    message: 'Vas a reemplazar los datos actuales por la copia automática del ' + new Date(point.at).toLocaleString('es-CO') + '. Lo que hayas hecho después de esa fecha se perderá.',
    confirmText: 'Sí, restaurar',
    icon: '↺'
  });
  if(!ok) return;
  try{
    data = JSON.parse(point.data);
    await saveData();
    renderAll();
    if(typeof renderMesas === 'function') renderMesas();
    showToast('✅ Datos restaurados al ' + new Date(point.at).toLocaleDateString('es-CO') + '.');
  }catch(e){ showToast('No se pudo restaurar ese punto.'); }
}
// ---------- Sedes / varios negocios en la misma cuenta ----------
// Cada sede guarda sus mesas, productos, inventario e historial por separado
// (una llave de almacenamiento distinta), pero se maneja desde la misma
// cuenta, sin tener que cerrar sesión ni instalar nada aparte.
const SEDES_KEY = 'bar-sedes-list';
const CURRENT_SEDE_KEY = 'bar-current-sede';
function rawSedesList(){ try{ return JSON.parse(localStorage.getItem(SEDES_KEY)) || []; }catch(e){ return []; } }
function persistSedesList(list){ try{ localStorage.setItem(SEDES_KEY, JSON.stringify(list)); }catch(e){} }
// Cuenta de cada usuario: 'principal' (la de siempre) o una cuenta aparte creada en la entrada.
function authGrupoDe(user){ const u = authUsers().find(x => x.user === user); return (u && u.cuenta) || 'principal'; }
function grupoActual(){ return (typeof authUser !== 'undefined' && authUser) ? authGrupoDe(authUser) : ((rawSedesList().find(s => s.id === currentSedeId()) || {}).cuenta || 'principal'); }
function sedesList(){
  const list = rawSedesList(), g = grupoActual();
  const mias = list.filter(s => (s.cuenta || 'principal') === g);
  if(mias.length) return mias.map(x => x.id === 'default' && g === 'principal' && typeof data !== 'undefined' && data && data.businessName && STORAGE_KEY === 'bar-data' ? Object.assign({}, x, { name: data.businessName }) : x);
  return g === 'principal' ? [{ id: 'default', name: (data && data.businessName) || 'Principal', key: 'bar-data' }] : [];
}
function currentSedeId(){ try{ return localStorage.getItem(CURRENT_SEDE_KEY) || 'default'; }catch(e){ return 'default'; } }
async function addSede(name, cuenta){
  let list = rawSedesList();
  if(!list.some(s => s.id === 'default')) list.unshift({ id: 'default', name: (typeof data !== 'undefined' && data && data.businessName) || 'Principal', key: 'bar-data' });
  const id = 'sede-' + Date.now();
  const key = 'bar-data-' + id;
  const sede = { id, name, key };
  const g = cuenta || grupoActual(); if(g !== 'principal') sede.cuenta = g;
  list.push(sede);
  persistSedesList(list);
  return sede;
}
async function switchToSede(sede){
  if(sede.key === STORAGE_KEY) return;
  STORAGE_KEY = sede.key;
  try{ localStorage.setItem(CURRENT_SEDE_KEY, sede.id); }catch(e){}
  currentTable = null;
  document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
  await loadData();
  ['renderMesas', 'renderInventario', 'renderStats', 'renderCarta', 'renderHistorial', 'renderPromos'].forEach(fn => {
    try{ if(typeof window[fn] === 'function') window[fn](); }catch(e){}
  });
  renderSedesUI();
  showToast('🏢 Cambiaste a ' + sede.name + '.');
}
function renderSedesUI(){
  try{ if(typeof licPintar === 'function') licPintar(); }catch(e){}
  const box = document.getElementById('sedesList');
  if(!box) return;
  const list = sedesList();
  box.innerHTML = list.map(s => '<button type="button" class="btn-ghost sede-btn' + (s.key === STORAGE_KEY ? ' on' : '') + '" data-key="' + invEsc(s.key) + '">' + (s.key === STORAGE_KEY ? '✅ ' : '🏢 ') + invEsc(s.name) + '</button>').join('');
  box.querySelectorAll('.sede-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sede = list.find(s => s.key === btn.dataset.key);
      if(sede) switchToSede(sede);
    });
  });
}
function wireSedesUI(){
  renderSedesUI();
  const addBtn = document.getElementById('sedeAddBtn');
  const input = document.getElementById('sedeNameInput');
  if(addBtn && input) addBtn.addEventListener('click', async () => {
    const name = input.value.trim();
    if(!name){ showToast('Escribe el nombre de la sede o negocio.'); return; }
    // Un negocio por cuenta: con la cuenta de ORDEVA, otra sede u otro negocio necesita OTRA cuenta con su propia
    // suscripción o licencia (el servidor tampoco deja crear un segundo negocio con la misma cuenta).
    if(sedeUnaPorCuenta()){ showToast('🏢 Tu cuenta es de un solo negocio. Para otra sede u otro negocio crea otra cuenta de ORDEVA con su propia suscripción o licencia.', 9000); return; }
    // Sedes adicionales: se pagan. Sin un código de activación válido, se muestra cómo pagar.
    if(typeof licPuedeAgregarSede === 'function' && !licPuedeAgregarSede()){ licPaywall(name); return; }
    const sede = await addSede(name);
    input.value = '';
    renderSedesUI();
    const ok = await showConfirm({
      title: '¿Cambiar a "' + name + '" ahora?',
      message: 'Se creó vacía. Puedes armar sus productos y mesas desde cero, o quedarte donde estás y cambiar después.',
      confirmText: 'Sí, cambiar ahora',
      cancelText: 'Quedarme aquí',
      icon: '🏢'
    });
    if(ok) switchToSede(sede);
  });
}

async function openAutoBackupDialog(){
  const points = await autoBackupPoints();
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:14px';
  const body = points.length
    ? points.map((pt, i) => '<button type="button" class="btn-ghost" data-i="' + i + '" style="width:100%;text-align:left;margin:4px 0">🕒 ' + new Date(pt.at).toLocaleString('es-CO') + '</button>').join('')
    : '<div class="guide-empty">Todavía no hay puntos de restauración. Se van guardando solos, uno por día, a medida que usas la app.</div>';
  o.innerHTML = '<div style="background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:16px;width:100%;max-width:360px;max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:6px">' +
    '<b>🕒 Puntos de restauración</b><small style="color:var(--ink-soft)">Copias internas automáticas, una por día (hasta 7). Tocar una la restaura.</small>' + body +
    '<div style="display:flex;justify-content:flex-end;margin-top:6px"><button type="button" class="btn-ghost" data-close="1">Cerrar</button></div></div>';
  o.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if(b){ restoreAutoBackupPoint(points[+b.dataset.i]); o.remove(); return; }
    if(e.target.closest('[data-close]') || e.target === o) o.remove();
  });
  document.body.appendChild(o);
}

// Aviso emergente: el emoji del inicio del mensaje pasa a ser el ícono, y el color va
// según el tipo (✅ bien · ⚠️/❌ problema · el resto informativo). Se cierra al tocarlo.
function showToast(msg, ms){
  const t = document.getElementById('toast');
  msg = String(msg == null ? '' : msg);
  try{ msg = vocabTexto(msg); }catch(e){}   // «mesa» → la palabra del negocio (orden, silla, habitación…)
  const m = msg.match(/^\s*((?:\p{Extended_Pictographic}|[\u2600-\u27BF])(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u);
  const icon = m ? m[1] : 'ℹ️';
  const text = m ? msg.slice(m[0].length) : msg;
  const tipo = /^(⚠|❌|🔴|🟠|⛔|🚫)/.test(icon) || /^(error|no se pudo|no hay|falta|no encontr|no entend|no escuch)/i.test(text) ? 'warn' : /^(✅|🟢|🎉|✔)/.test(icon) ? 'ok' : 'info';
  const dur = ms || Math.min(7000, Math.max(2600, text.length * 45));
  t.className = 'toast toast-' + tipo;
  try{ const vv = window.visualViewport; t.style.setProperty('--kb', vv ? Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) + 'px' : '0px'); }catch(e){}
  t.textContent = '';
  const ic = document.createElement('span'); ic.className = 'toast-ic'; ic.textContent = icon;
  const tx = document.createElement('span'); tx.className = 'toast-tx'; tx.textContent = text;
  const bar = document.createElement('span'); bar.className = 'toast-bar';
  t.append(ic, tx, bar);
  t.style.setProperty('--dur', dur + 'ms');
  t.setAttribute('role', tipo === 'warn' ? 'alert' : 'status');
  void t.offsetWidth;
  t.classList.add('show');
  t.onclick = () => { clearTimeout(showToast._t); t.classList.remove('show'); };
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.classList.remove('show'), dur);
}

function tableLabel(id){
  const t = data.tables[id];
  if(id === 0 && !t) return '🎧 Caja';            // canciones que pone el negocio desde ORDEVA (no una mesa)
  return (t && t.name && t.name.trim()) ? t.name.trim() : (i18nPut(espacioN()) + ' ' + id);
}

/* ---------- Historial de horas por pedido ---------- */
function fmtTime(ts){
  return new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/* ---------- Sonidos POS (lib/vento-sonidos.js): «tún» al agregar, «tic» al quitar, éxito al cobrar ---------- */
function sonidoPos(tipo){ try{ window.ventoSonidos && window.ventoSonidos[tipo](); }catch(e){} }
function sonidoLote(fn){ return window.ventoSonidos ? window.ventoSonidos.lote(fn) : fn(); }        // UN sonido al final
function sinSonidoPos(fn){ return window.ventoSonidos ? window.ventoSonidos.callar(fn) : fn(); }   // pedidos que llegan de afuera

function recordItemHistory(item, qty){
  if(!item.history) item.history = [];
  item.history.push({ qty, at: Date.now() });
  try{ invOnSale(item, qty); }catch(e){}
  if(qty) sonidoPos(qty > 0 ? 'add' : 'remove');   // todo +/− de una cuenta pasa por aquí (toques, favoritos, escáner, voz)
  if(item.history.length > 30) item.history = item.history.slice(-30);
}

function itemHistoryHtml(it){
  if(!it.history || !it.history.length){
    return '<div class="li-history-empty">Sin horario registrado (se agregó antes de esta función).</div>';
  }
  return it.history.map(h => `<div class="li-history-row${h.qty < 0 ? ' li-history-negative' : ''}"><span>${fmtTime(h.at)}</span><span>${h.qty >= 0 ? '+' : ''}${h.qty}</span></div>`).join('');
}

/* ---------- Corrección manual de cantidad (+/-) ---------- */
function qtyStepperHtml(idx, qty){
  return `<span class="li-qty-stepper">
    <button type="button" class="li-qty-btn li-qty-minus" data-idx="${idx}" title="Restar 1">−</button>
    <span class="li-qty-val">×${qty}</span>
    <button type="button" class="li-qty-btn li-qty-plus" data-idx="${idx}" title="Sumar 1">+</button>
  </span>`;
}

function attachQtyStepperHandlers(container, t, rerender){
  container.querySelectorAll('.li-qty-plus').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      const it = t.items[idx];
      if(!it) return;
      it.qty += 1;
      recordItemHistory(it, 1);
      noteManualChange(tableIdOf(t), it.name, 1);
      saveData();
      rerender();
      renderMesas();
    });
  });
  container.querySelectorAll('.li-qty-minus').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      const it = t.items[idx];
      if(!it) return;
      if(it.qty <= 1){
        noteManualChange(tableIdOf(t), it.name, -it.qty);
        try{ invOnSale(it, -it.qty); }catch(e){}
        t.items.splice(idx, 1);
        sonidoPos('remove');
      } else {
        it.qty -= 1;
        recordItemHistory(it, -1);
        noteManualChange(tableIdOf(t), it.name, -1);
      }
      saveData();
      rerender();
      renderMesas();
    });
  });
}

/* ---------- Modal de confirmación (reemplaza confirm() nativo) ---------- */
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmTitleEl = document.getElementById('confirmTitle');
const confirmMessageEl = document.getElementById('confirmMessage');
const confirmIconEl = document.getElementById('confirmIcon');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
let confirmResolver = null;

function showConfirm({ title = '¿Estás seguro?', message = '¿Deseas continuar?', confirmText = 'Sí, confirmar', cancelText = 'Cancelar', icon = '⚠️' } = {}){
  try{ title = vocabTexto(title); message = vocabTexto(message); }catch(e){}
  confirmTitleEl.textContent = title;
  confirmMessageEl.textContent = message;
  confirmIconEl.textContent = icon;
  confirmOkBtn.textContent = confirmText;
  confirmCancelBtn.textContent = cancelText;
  // Al final del body: queda encima de las ventanas que se crean después (ej. «Fijar mis QR impresos»)
  document.body.appendChild(confirmOverlay);
  confirmOverlay.classList.add('show');
  return new Promise(resolve=>{
    confirmResolver = resolve;
  });
}

function closeConfirm(result){
  confirmOverlay.classList.remove('show');
  if(confirmResolver){
    confirmResolver(result);
    confirmResolver = null;
  }
}

confirmOkBtn.addEventListener('click', ()=> closeConfirm(true));
confirmCancelBtn.addEventListener('click', ()=> closeConfirm(false));
confirmOverlay.addEventListener('click', (e)=>{
  if(e.target === confirmOverlay) closeConfirm(false);
});

function tableTotal(tableId){
  const t = data.tables[tableId];
  if(!t || !t.items) return 0;
  return t.items.reduce((s,it)=> s + it.price*it.qty, 0);
}

function tablePaid(tableId){
  const t = data.tables[tableId];
  if(!t || !t.payments) return 0;
  return t.payments.filter(p=>p.method !== 'debe').reduce((s,p)=> s + p.amount, 0);
}

function tableDebt(tableId){
  const t = data.tables[tableId];
  if(!t || !t.payments) return 0;
  return t.payments.filter(p=>p.method === 'debe').reduce((s,p)=> s + p.amount, 0);
}

function tableBalance(tableId){
  return Math.max(0, tableTotal(tableId) - tablePaid(tableId) - tableDebt(tableId));
}

/* ---------- Quién pagó qué en una mesa con varias personas ----------
   La mesa tiene la «cuenta general» (lo que no es de nadie en particular) y la parte de cada persona.
   Antes cada persona solo contaba SUS pagos: si la cuenta principal pagaba toda la mesa, las personas seguían saliendo
   como si debieran y no se veía quién había pagado. Ahora lo que sobra de un pago (de la cuenta general o de alguien que
   pagó de más) cubre lo que les falta a los demás: primero la cuenta general y luego las personas, en orden. */
function mesaEstado(tableId){
  const t = data.tables[tableId] || {}, items = t.items || [], pays = t.payments || [], people = t.people || [];
  const nombreDe = id => { if(id == null) return people.length ? 'Cuenta general' : tableLabel(tableId); const x = people.find(y => y.id === id); return x ? x.name : 'Cuenta general'; };
  const grupos = [null].concat(people.map(x => x.id)).map(id => {
    const ps = pays.filter(p => (p.personId || null) === id);
    const total = items.filter(it => (it.personId || null) === id).reduce((a, it) => a + it.price * it.qty, 0);
    const pagado = ps.filter(p => p.method !== 'debe').reduce((a, p) => a + p.amount, 0);
    const debe = ps.filter(p => p.method === 'debe').reduce((a, p) => a + p.amount, 0);
    return { id, nombre: nombreDe(id), total, pagado, debe, cubierto: 0, cubiertoDebe: 0, cubrio: 0, fuentes: [], pagos: ps };
  });
  // Lo que sobra de cada uno (primero lo pagado, después lo que quedó debiendo).
  const bolsa = [];
  grupos.forEach(g => {
    const exP = Math.max(0, g.pagado - g.total), exD = Math.max(0, g.debe - Math.max(0, g.total - g.pagado));
    if(exP) bolsa.push({ g, monto: exP, tipo: 'pago' });
    if(exD) bolsa.push({ g, monto: exD, tipo: 'debe' });
  });
  grupos.forEach(g => {
    let falta = Math.max(0, g.total - g.pagado - g.debe);
    for(const b of bolsa){
      if(falta <= 0) break;
      if(b.monto <= 0 || b.g === g) continue;
      const x = Math.min(falta, b.monto);
      b.monto -= x; falta -= x; b.g.cubrio += x;
      if(b.tipo === 'pago') g.cubierto += x; else g.cubiertoDebe += x;
      g.fuentes.push({ de: b.g.id, nombre: b.g.nombre, monto: x, tipo: b.tipo });
    }
    g.saldo = falta;
    g.estado = !g.total && !g.pagado && !g.debe ? 'vacio' : !g.total ? 'solo-paga' : g.saldo > 0 ? (g.pagado || g.cubierto ? 'parcial' : 'pendiente') : (g.debe || g.cubiertoDebe) ? 'debe' : 'pagado';
  });
  const conPartes = grupos.filter(g => g.total > 0);
  return { grupos, personas: people.length, pagaron: conPartes.filter(g => g.estado === 'pagado' || g.estado === 'debe').length, partes: conPartes.length, saldo: tableBalance(tableId) };
}
// Texto corto del estado de una parte: «✅ Pagado por Cuenta general», «⏳ Abonó $10.000 · falta $5.000»…
function mesaEstadoTexto(g){
  if(!g || g.estado === 'vacio') return '';
  const por = g.fuentes.filter(f => f.tipo === 'pago').map(f => f.nombre);
  const bits = [];
  if(g.estado === 'pagado') bits.push(g.cubierto && !g.pagado ? '✅ Pagado por ' + Array.from(new Set(por)).join(' y ') : g.cubierto ? '✅ Pagado (' + fmt(g.pagado) + ' suyo + ' + fmt(g.cubierto) + ' de ' + Array.from(new Set(por)).join(' y ') + ')' : '✅ Pagó ' + fmt(Math.min(g.pagado, g.total)));
  else if(g.estado === 'debe') bits.push('📒 Quedó debiendo ' + fmt(Math.min(g.debe, Math.max(0, g.total - g.pagado)) + g.cubiertoDebe));
  else if(g.estado === 'parcial') bits.push('⏳ Abonó ' + fmt(g.pagado + g.cubierto) + ' · falta ' + fmt(g.saldo));
  else if(g.estado === 'pendiente') bits.push('⏳ Falta ' + fmt(g.saldo));
  if(g.cubrio > 0) bits.push((g.estado === 'solo-paga' ? '💵 Pagó ' : 'también pagó ') + fmt(g.cubrio) + ' de los demás');
  return bits.join(' · ');
}
// Al cerrar la parte de una persona que pagó otro: ese pago se va con ella (se descuenta de quien lo hizo), para que la
// mesa no quede con plata de más. Devuelve el detalle para su historial.
function mesaLlevarCubierto(t, g){
  const det = [];
  (g.fuentes || []).forEach(f => {
    let resta = f.monto;
    const ps = (t.payments || []).filter(p => (p.personId || null) === f.de && (f.tipo === 'debe' ? p.method === 'debe' : p.method !== 'debe'));
    for(let i = ps.length - 1; i >= 0 && resta > 0; i--){ const x = Math.min(resta, ps[i].amount); ps[i].amount -= x; resta -= x; }
    t.payments = (t.payments || []).filter(p => p.amount > 0);
    det.push({ note: (f.tipo === 'debe' ? 'Queda debiendo (de ' : 'Pagado por ') + f.nombre + (f.tipo === 'debe' ? ')' : ''), amount: f.monto, method: f.tipo === 'debe' ? 'debe' : (ps[ps.length - 1] && ps[ps.length - 1].method) || 'efectivo' });
  });
  return det;
}

/* ---------- Resumen de cuenta (pedido por comando de voz) ---------- */
const billSummaryOverlay = document.getElementById('billSummaryOverlay');

function openBillSummary(tableId){
  const t = data.tables[tableId];
  if(!t) return;
  document.getElementById('billSummaryTitle').textContent = tableLabel(tableId);
  document.getElementById('billSummaryLabel').textContent = '🎤 Cuenta de';
  document.getElementById('billSummaryTotalLabel').textContent = 'Total a pagar';
  billSummaryOverlay.querySelector('.bill-summary-modal').classList.remove('bill-general');
  const itemsEl = document.getElementById('billSummaryItems');
  itemsEl.innerHTML = '';
  if(t.items && t.items.length){
    t.items.forEach(it=>{
      const row = document.createElement('div');
      row.className = 'bill-summary-item-row';
      row.innerHTML = `<span>${it.name} ×${it.qty}</span><span>${fmt(it.price*it.qty)}</span>`;
      itemsEl.appendChild(row);
    });
  } else {
    itemsEl.innerHTML = '<div class="empty-note">Todavía no hay productos en esta cuenta.</div>';
  }
  const paid = tablePaid(tableId);
  const debt = tableDebt(tableId);
  const balance = tableBalance(tableId);
  document.getElementById('billSummaryPaidRow').style.display = paid > 0 ? 'flex' : 'none';
  document.getElementById('billSummaryPaid').textContent = fmt(paid);
  document.getElementById('billSummaryDebtRow').style.display = debt > 0 ? 'flex' : 'none';
  document.getElementById('billSummaryDebt').textContent = fmt(debt);
  document.getElementById('billSummaryTotal').textContent = fmt(balance);
  // Con varias personas: quién pagó y cuánto le falta a cada uno.
  if((t.people || []).length){
    const est = mesaEstado(tableId);
    const sep = document.createElement('div'); sep.className = 'bill-summary-item-row'; sep.innerHTML = '<b>👥 Quién pagó (' + est.pagaron + ' de ' + est.partes + ')</b><span></span>'; itemsEl.appendChild(sep);
    est.grupos.filter(g => g.estado !== 'vacio').forEach(g => { const r = document.createElement('div'); r.className = 'bill-summary-item-row'; r.innerHTML = '<span>' + invEsc(g.nombre) + ' <small>' + invEsc(mesaEstadoTexto(g)) + '</small></span><span>' + fmt(g.total) + '</span>'; itemsEl.appendChild(r); });
  }
  billSummaryOverlay.classList.add('show');
}

function closeBillSummary(){
  billSummaryOverlay.classList.remove('show');
}

/* ---------- Cuenta general: todas las mesas con cuenta abierta ---------- */
function billEsc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function computeGeneralBill(){
  const ids = Object.keys(data.tables || {}).map(Number).sort((a,b)=>a-b).filter(id => {
    const t = data.tables[id];
    return t && t.items && t.items.length > 0;
  });
  const rows = ids.map(id => ({
    id, label: tableLabel(id), items: data.tables[id].items,
    total: tableTotal(id), paid: tablePaid(id), debt: tableDebt(id), balance: tableBalance(id)
  }));
  return {
    rows, count: rows.length,
    total: rows.reduce((a,r)=>a+r.total, 0),
    paid: rows.reduce((a,r)=>a+r.paid, 0),
    debt: rows.reduce((a,r)=>a+r.debt, 0),
    balance: rows.reduce((a,r)=>a+r.balance, 0)
  };
}

function openGeneralBill(g){
  g = g || computeGeneralBill();
  document.getElementById('billSummaryLabel').textContent = '🧾 Cuenta general';
  document.getElementById('billSummaryTitle').textContent = g.count + (g.count === 1 ? ' mesa abierta' : ' mesas abiertas');
  document.getElementById('billSummaryTotalLabel').textContent = 'Total general a pagar';
  billSummaryOverlay.querySelector('.bill-summary-modal').classList.add('bill-general');
  const itemsEl = document.getElementById('billSummaryItems');
  if(!g.count){
    itemsEl.innerHTML = '<div class="empty-note">No hay mesas con cuenta abierta.</div>';
  } else {
    itemsEl.innerHTML = g.rows.map(r => {
      const lines = r.items.map(it => `<div class="bill-general-item"><span>${billEsc(it.name)} ×${it.qty}</span><span>${fmt(it.price*it.qty)}</span></div>`).join('');
      const extra = (r.paid > 0 || r.debt > 0)
        ? `<div class="bill-general-item"><span class="bg-paid">${r.paid > 0 ? 'Abonado ' + fmt(r.paid) : ''}${r.paid > 0 && r.debt > 0 ? ' · ' : ''}${r.debt > 0 ? 'Debe ' + fmt(r.debt) : ''}</span><span></span></div>` : '';
      return `<div class="bill-general-table"><span>${billEsc(r.label)}</span><span class="bg-amount">${fmt(r.balance)}</span></div>${lines}${extra}`;
    }).join('');
  }
  document.getElementById('billSummaryPaidRow').style.display = g.paid > 0 ? 'flex' : 'none';
  document.getElementById('billSummaryPaid').textContent = fmt(g.paid);
  document.getElementById('billSummaryDebtRow').style.display = g.debt > 0 ? 'flex' : 'none';
  document.getElementById('billSummaryDebt').textContent = fmt(g.debt);
  document.getElementById('billSummaryTotal').textContent = fmt(g.balance);
  billSummaryOverlay.classList.add('show');
}

// Abre la cuenta general y la dice en voz alta: total y luego lo que debe cada mesa.
function announceGeneralBill(){
  const g = computeGeneralBill();
  if(!g.count){
    const msg = 'No hay mesas con cuenta abierta en este momento.';
    showToast('🧾 ' + msg); speakVoice(msg);
    return;
  }
  openGeneralBill(g);
  const porMesa = g.rows.map(r => r.label + ': ' + (r.balance > 0 ? fmtSpoken(r.balance) : 'ya está pagada')).join('. ');
  const msg = 'La cuenta general de ' + g.count + (g.count === 1 ? ' mesa' : ' mesas') + ' es ' + fmtSpoken(g.balance) + '. ' + porMesa + '.';
  showToast('🧾 Cuenta general: ' + fmtSpoken(g.balance) + ' en ' + g.count + (g.count === 1 ? ' mesa.' : ' mesas.'));
  speakVoice(msg);
}

document.getElementById('billSummaryCloseBtn').addEventListener('click', closeBillSummary);
document.getElementById('generalBillBtn').addEventListener('click', () => openGeneralBill());
billSummaryOverlay.addEventListener('click', (e)=>{ if(e.target === billSummaryOverlay) closeBillSummary(); });

function closeTableToHistory(tableId){
  const t = data.tables[tableId];
  if(!t || !t.items || !t.items.length) return null;
  const total = tableTotal(tableId);
  const balance = tableBalance(tableId);
  const paymentsDetail = (t.payments||[]).map(p=>({
    note: p.note || '',
    amount: p.amount,
    method: p.method || 'efectivo',
    items: p.items || null,
    receiptId: p.receiptId || null
  }));
  if(balance > 0){
    paymentsDetail.push({ note: 'Saldo sin registrar al cerrar', amount: balance, method: 'debe' });
  }
  const debt = paymentsDetail.filter(p=>p.method === 'debe').reduce((s,p)=>s+p.amount, 0);
  // Número consecutivo de factura de venta: se asigna una sola vez, al cerrar
  // la cuenta, y queda fijo en el historial aunque luego cambien el prefijo
  // o el consecutivo en Ajustes.
  const invoiceNo = (data.invoicePrefix || 'FV') + '-' + numFactura(data.invoiceNextNo || 1);
  data.invoiceNextNo = (data.invoiceNextNo || 1) + 1;
  const entry = {
    id: Date.now().toString() + '-' + tableId,
    table: tableId,
    tableName: (t.name && t.name.trim()) ? t.name.trim() : null,
    businessName: data.businessName,
    invoiceNo,
    nit: data.nit || '',
    bizAddress: data.bizAddress || '',
    ivaResponsable: !!data.ivaResponsable,
    ivaRate: data.ivaRate || 19,
    dianResolucionText: data.dianResolucionText || '',
    total,
    payments: paymentsDetail,
    debt,
    items: t.items.map(it=>({name:it.name, qty:it.qty, price:it.price, cost: (data.products.find(p=>p.id===it.productId)||{}).cost ?? null, person: personLookupName(t, it.personId)})),
    date: new Date().toISOString(),
    by: (typeof authUser !== 'undefined' && authUser) ? authUser : null   // quién cerró/cobró esta mesa, para el turno de caja
  };
  data.history.unshift(entry);
  if(!(entry.debt > 0)) try{ window.mesoraCelebrar && window.mesoraCelebrar(['💰', '✨', '🎉']); }catch(e){}
  t.items = [];
  t.payments = [];
  t.people = [];
  return entry;
}

document.getElementById('qsMethod').addEventListener('change', e => { const dn = document.getElementById('qsDebeName'); dn.hidden = e.target.value !== 'debe'; if(!dn.hidden) dn.focus(); });

/* ---------- Clientes frecuentes (fidelización) ----------
   Guarda visitas y gasto por número de WhatsApp, para que el negocio sepa
   a quién le vale la pena premiar. Es opcional y no toca los cálculos de
   la cuenta: solo se anota al cerrarla, si el cajero escribió el teléfono. */
function clienteTier(visitas){
  if(visitas >= 30) return '🥇 Cliente VIP';
  if(visitas >= 15) return '🥈 Cliente frecuente';
  if(visitas >= 5) return '🥉 Cliente recurrente';
  return '';
}
function registrarVisitaCliente(telefono, nombre, monto){
  const tel = (telefono || '').replace(/\D/g, '');
  if(tel.length < 7) return null;
  if(!data.clientesFrecuentes) data.clientesFrecuentes = [];
  let c = data.clientesFrecuentes.find(x => x.telefono === tel);
  if(!c){ c = { telefono: tel, nombre: '', visitas: 0, totalGastado: 0, ultimaVisita: 0 }; data.clientesFrecuentes.push(c); }
  c.visitas++;
  c.totalGastado += (monto || 0);
  c.ultimaVisita = Date.now();
  if(nombre && nombre.trim()) c.nombre = nombre.trim();
  return c;
}
function renderLoyaltyClientsList(){
  const el = document.getElementById('loyaltyClientsList');
  if(!el) return;
  const clientes = (data.clientesFrecuentes || []).slice()
    .sort((a, b) => b.visitas - a.visitas || b.totalGastado - a.totalGastado)
    .slice(0, 15);
  if(!clientes.length){
    el.innerHTML = '<div class="guide-empty">Todavía no hay clientes guardados. Se van agregando cuando anotas el WhatsApp del cliente al cerrar una cuenta.</div>';
    return;
  }
  el.innerHTML = '<div class="section-divider">Tus clientes (' + clientes.length + ')</div>' +
    clientes.map(c => {
      const tier = clienteTier(c.visitas);
      return '<div class="settings-row">' +
        '<div class="settings-row-text"><strong>' + invEsc(c.nombre || c.telefono) + '</strong>' +
        '<span>' + c.visitas + (c.visitas === 1 ? ' visita' : ' visitas') + ' · ' + fmt(c.totalGastado) + ' gastado' + (tier ? ' · ' + tier : '') + '</span></div>' +
        '</div>';
    }).join('');
}

/* ---------- Atención al cliente (casos/reclamos) ----------
   Un mini "helpdesk" propio para los reclamos de tus clientes: se
   organizan por categoría y urgencia (como Freshdesk), quedan
   centralizados en un solo lugar con seguimiento hasta que se resuelven
   (como Zendesk), se pueden asignar a quien los va a atender (como
   Praxedo asigna el técnico más indicado), quedan ligados al cliente
   frecuente si ya existe y guardan qué tan satisfecho quedó (como
   Salesforce Service Cloud), todo integrado con los mismos datos del
   negocio en vez de un sistema aparte (como el enfoque modular de Odoo). */
const CASO_CATEGORIAS = {
  pedido: '📦 Pedido incorrecto o incompleto',
  calidad: '🍺 Calidad del producto',
  demora: '⏱️ Demora en la atención',
  domicilio: '🛵 Problema con un domicilio',
  otro: '📋 Otro'
};
const CASO_URGENCIA_ICONS = { urgente: '🔴', normal: '🟡', baja: '🟢' };
function sugerirCategoriaCaso(texto){
  const t = normVoiceText(texto || '');
  if(!t) return null;
  if(/domicili|entrega|direccion|no lleg/.test(t)) return 'domicilio';
  if(/demor|espera|tardo|lento/.test(t)) return 'demora';
  if(/frio|caliente|malo|dañad|vencid|sabor|calidad|mal estado/.test(t)) return 'calidad';
  if(/equivoc|falto|falta|cambiar|incompleto|mal pedido/.test(t)) return 'pedido';
  return null;
}
function crearCaso({categoria, urgencia, telefono, asignadoA, descripcion}){
  if(!data.casos) data.casos = [];
  const tel = (telefono || '').replace(/\D/g, '');
  const clienteExistente = tel ? (data.clientesFrecuentes || []).find(c => c.telefono === tel) : null;
  const caso = {
    id: Date.now().toString(),
    fecha: Date.now(),
    categoria, urgencia,
    telefono: tel,
    nombreCliente: clienteExistente ? clienteExistente.nombre : '',
    asignadoA: (asignadoA || '').trim(),
    descripcion: (descripcion || '').trim(),
    estado: 'abierto',
    resolucion: '',
    satisfaccion: null,
    fechaResuelto: null
  };
  data.casos.unshift(caso);
  return caso;
}
function resolverCaso(id, resolucion, satisfaccion){
  const c = (data.casos || []).find(x => x.id === id);
  if(!c) return;
  c.estado = 'resuelto';
  c.resolucion = (resolucion || '').trim();
  c.satisfaccion = satisfaccion || null;
  c.fechaResuelto = Date.now();
}
function renderCasosList(){
  const el = document.getElementById('casosList');
  if(!el) return;
  const urgenciaOrden = { urgente: 0, normal: 1, baja: 2 };
  const abiertos = (data.casos || []).filter(c => c.estado !== 'resuelto')
    .sort((a, b) => (urgenciaOrden[a.urgencia] ?? 1) - (urgenciaOrden[b.urgencia] ?? 1) || b.fecha - a.fecha);
  const resueltos = (data.casos || []).filter(c => c.estado === 'resuelto').sort((a, b) => b.fechaResuelto - a.fechaResuelto);
  const casoRow = c => {
    const meta = [
      (c.nombreCliente || c.telefono) ? '👤 ' + invEsc(c.nombreCliente || c.telefono) : '',
      c.asignadoA ? '🙋 ' + invEsc(c.asignadoA) : '',
      new Date(c.fecha).toLocaleString('es-CO')
    ].filter(Boolean).join(' · ');
    return '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px">' +
      '<div class="settings-row-text"><strong>' + CASO_URGENCIA_ICONS[c.urgencia] + ' ' + (CASO_CATEGORIAS[c.categoria] || c.categoria) + '</strong>' +
      '<span>' + invEsc(c.descripcion || '(sin descripción)') + '</span>' +
      '<span>' + meta + '</span></div>' +
      (c.estado === 'resuelto'
        ? '<div class="auth-hint">✅ Resuelto' + (c.resolucion ? ': ' + invEsc(c.resolucion) : '') + (c.satisfaccion ? ' · ' + (c.satisfaccion == 3 ? '😊' : c.satisfaccion == 2 ? '😐' : '😞') : '') + '</div>'
        : '<details class="caso-resolver-wrap" data-caso-id="' + c.id + '"><summary>✅ Marcar resuelto</summary>' +
          '<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">' +
          '<textarea class="mz-in caso-resolucion-input" rows="2" placeholder="¿Cómo se resolvió? (opcional)"></textarea>' +
          '<select class="mz-in caso-satisfaccion-input"><option value="">Satisfacción del cliente (opcional)</option><option value="3">😊 Quedó contento</option><option value="2">😐 Normal</option><option value="1">😞 Quedó insatisfecho</option></select>' +
          '<button type="button" class="btn-primary caso-confirmar-btn">Confirmar resuelto</button>' +
          '</div></details>')
      + '</div>';
  };
  if(!abiertos.length && !resueltos.length){
    el.innerHTML = '<div class="guide-empty">Todavía no hay casos guardados. Anota aquí cualquier reclamo para no perderle el rastro.</div>';
    return;
  }
  let html = '<div class="section-divider">Casos abiertos (' + abiertos.length + ')</div>';
  html += abiertos.length ? abiertos.map(casoRow).join('') : '<div class="guide-empty">No tienes casos abiertos. 🎉</div>';
  if(resueltos.length){
    html += '<details class="guide-results-wrap"><summary>Ver resueltos (' + resueltos.length + ')</summary>' + resueltos.map(casoRow).join('') + '</details>';
  }
  el.innerHTML = html;
}

function getOpenTableIds(){
  return Object.keys(data.tables).map(Number).filter(id => data.tables[id].items && data.tables[id].items.length > 0);
}

/* ---------- Comando por voz para agregar productos ---------- */
const NUM_WORDS_VOICE = {
  'un':1,'una':1,'uno':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,
  'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,'trece':13,'catorce':14,
  'quince':15,'dieciseis':16,'diecisiete':17,'dieciocho':18,'diecinueve':19,'veinte':20,
  'veintiuno':21,'veintiun':21,'veintidos':22,'veintitres':23,'veinticuatro':24,
  'veinticinco':25,'veintiseis':26,'veintisiete':27,'veintiocho':28,'veintinueve':29,
  'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,
  'noventa':90,'cien':100
};

// Combina "treinta y dos", "cuarenta y cinco", etc. en un número, para que
// cantidades y números de mesa mayores a 29 también se entiendan por voz.
const TENS_WORDS_VOICE = { 'veinte':20,'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,'noventa':90 };
const UNIT_WORDS_VOICE = { 'un':1,'uno':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,'nueve':9 };
function expandCompoundNumbers(text){
  // Cantidades habladas comunes que no son un solo número: "un par de",
  // "una docena", "media docena"… se convierten al número antes de parsear
  // cantidades, así "un par de aguilas" entiende 2 y no se pierde el pedido.
  text = text
    .replace(/\bmedia\s+docena\b/g, '6')
    .replace(/\b(?:un|una)\s+docena\b/g, '12')
    .replace(/\bdocena\b/g, '12')
    .replace(/\b(?:un|una)\s+(?:par|pareja)\b/g, '2')
    .replace(/\bpareja\b/g, '2');
  return text.replace(/\b(veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/g,
    (m, tens, unit) => String(TENS_WORDS_VOICE[tens] + UNIT_WORDS_VOICE[unit]));
}

/*
 * Vocabulario amplio para habla cotidiana en Colombia.
 * Los alias NO crean productos nuevos ni cambian precios: solo ayudan a encontrar
 * un producto que ya exista en el catálogo de la aplicación.
 */
const VOICE_PRODUCT_ALIASES = {
  'aguila':['aguila','águila','agüila','cerveza aguila','cerveza águila','aguila original','aguila normal','águila original','cervecita aguila'],
  'aguila/poker':['poker','póker','pocker','cerveza poker','cerveza póker','aguila poker','águila poker','aguila y poker','águila y póker'],
  'aguila light':['aguila light','águila light','aguila laig','cerveza light','aguila liviana','águila liviana'],
  'aguila 0 0':['aguila cero','águila cero','aguila 0 0','águila 0 0','aguila sin alcohol','cerveza sin alcohol','aguila cero cero'],
  'poker':['poker','póker','pocker','cerveza poker','cerveza póker'],
  'club colombia':['club colombia','club','club colombia dorada','club dorada','club col','clu colombia'],
  'club colombia negra':['club negra','club colombia negra','negra','club colombia oscura'],
  'club colombia roja':['club roja','club colombia roja','roja'],
  'club colombia trigo':['club trigo','club colombia trigo','trigo'],
  'costena':['costena','costeña','cerveza costeña','costena gris'],
  'costeña gris':['costena gris','costeña gris','costena'],
  'costeña verde 330ml':['costena verde','costeña verde','costeñita verde','costeña 330'],
  'costenita 235ml':['costenita','costeñita','costeñita 235'],
  'pilsen':['pilsen','cerveza pilsen','pilsener'],
  'stella artois':['stella','stella artois','cerveza stella','estella'],
  'corona 330ml':['corona','cerveza corona','corona extra','corona 330'],
  'corona 235ml':['corona 235','coronita','coronita extra','coronita 235'],
  'heineken':['heineken','jainequen','cerveza heineken'],
  'budweiser':['budweiser','bud','cerveza budweiser','baduaiser'],
  'michelob ultra':['michelob','michelob ultra','michelob ultra'],
  'redds apple':['redds manzana','redds apple','redd s manzana','cerveza redds manzana'],
  'redds watermelon':['redds sandia','redds watermelon','redd s sandia','cerveza redds sandia'],
  'redds':['redds','reds','cerveza redds'],
  'modelo':['modelo','cerveza modelo','modelo especial'],
  'victoria':['victoria','cerveza victoria'],
  'miller':['miller','miller lite','cerveza miller'],
  'cola y pola':['cola y pola','cola pola','cerveza cola y pola'],
  'tres cordilleras':['tres cordilleras','cordilleras','tres cordillera'],
  'bogota beer company':['bbc','bogota beer company','cerveza bbc'],
  'andina':['andina','cerveza andina'],
  'ponymalta':['pony','pony malta','malta pony'],
  'malta leona':['malta','malta leona','leona'],
  'manzana postobon':['manzana','manzana postobon','manzana postobón','gaseosa manzana'],
  'colombiana':['colombiana','gaseosa colombiana','colombiana la nuestra'],
  'uva postobon':['uva','uva postobon','uva postobón','gaseosa uva'],
  'naranja postobon':['naranja','naranja postobon','naranja postobón','gaseosa naranja'],
  'kola postobon':['kola','kola postobon','kola postobón','gaseosa kola'],
  'bretaña':['bretana','bretaña','soda','soda bretaña','agua soda'],
  'hit':['hit','jugo hit','hit de fruta','jugo'],
  'mr tea':['mr tea','mr. tea','te frio','té frío','te'],
  'agua cristal':['agua','agua cristal','botella de agua'],
  'agua oasis':['oasis','agua oasis'],
  'h2oh':['h2oh','h2o h','agua saborizada'],
  'gatorade':['gatorade','hidratante'],
  'squash':['squash','jugo squash'],
  'peak':['peak','energizante peak'],
  'speed max':['speed','speed max','energizante speed'],
  'pepsi':['pepsi','gaseosa pepsi'],
  '7 up':['seven up','7 up','sevenup'],
  'tutti frutti':['tutti frutti','tutti'],
  'papas margarita':['papas margarita','margarita','papas de paquete'],
  'detodito':['detodito','de todito'],
  'choclitos':['choclitos','choclito'],
  'platanitos':['platanitos','platanito','chips de platano','chips de plátano'],
  'chicharrones':['chicharron','chicharrones','chicharrón','chicharrón de paquete'],
  'manimoto':['manimoto','mani moto','maní moto','mani'],
  'chitos':['chitos','chitos de queso'],
  'doritos':['doritos'],
  'tostitos':['tostitos'],
  'cheetos':['cheetos','chetos'],
  'galletas festival':['festival','galleta festival','galletas festival'],
  'chocoramo':['chocoramo','choco ramo','ponque ramo'],
  'gansito':['gansito','gansito ramo'],
  'tostado':['tostado','pan tostado'],
  'empanada':['empanada','empanadas'],
  'arepa':['arepa','arepa con queso'],
  'perro caliente':['perro','perro caliente','hot dog'],
  'hamburguesa':['hamburguesa','hamburguesa con papas'],
  'sandwich':['sandwich','sándwich'],
  'cafe':['cafe','café','tinto','tintico','cafe negro','café negro'],
  'cafe con leche':['cafe con leche','café con leche','perico'],
  'agua':['agua','botella de agua','aguita'],
  'hielo':['hielo','bolsa de hielo','hielos'],
  // Sabores y jugos de fruta comunes en tiendas y cervecerías colombianas.
  'jugo de mora':['jugo de mora','jugo mora','mora'],
  'jugo de lulo':['jugo de lulo','jugo lulo','lulo'],
  'jugo de maracuya':['jugo de maracuya','maracuya','maracuyá','jugo maracuya'],
  'jugo de mango':['jugo de mango','jugo mango','mango'],
  'jugo de fresa':['jugo de fresa','jugo fresa','fresa'],
  'jugo de guanabana':['jugo de guanabana','guanabana','guanábana'],
  'jugo de tamarindo':['jugo de tamarindo','tamarindo'],
  'jugo de curuba':['jugo de curuba','curuba'],
  'jugo de feijoa':['jugo de feijoa','feijoa'],
  'jugo de papaya':['jugo de papaya','papaya'],
  'jugo de piña':['jugo de piña','jugo de pina','piña','pina'],
  'jugo de sandia':['jugo de sandia','sandia','sandía','patilla'],
  'jugo de coco':['jugo de coco','coco'],
  'jugo de guayaba':['jugo de guayaba','guayaba'],
  'jugo de nispero':['jugo de nispero','nispero','níspero'],
  'michelada':['michelada','micheladas'],
  'limon':['limon','limón','jugo de limon'],

  // --- Más cervezas colombianas (presentaciones y marcas adicionales) ---
  'aguila litro':['aguila litro','águila litro','aguila grande','águila grande','pola litro'],
  'poker litro':['poker litro','póker litro','poker grande','póker grande'],
  'club colombia litro':['club litro','club colombia litro','club grande'],
  'costeña litro':['costena litro','costeña litro','costeña 750','costena 750'],
  'cerveza leona':['cerveza leona','leona pilsen'],
  'cerveza apostol':['apostol','apóstol','cerveza apostol'],
  'cerveza inti':['inti','cerveza inti'],
  'cerveza statua rota':['statua rota','estatua rota'],
  'cerveza monasterio':['monasterio','cerveza monasterio'],
  '3 cordilleras':['3 cordilleras','tres cordilleras andina','tres cordilleras mestiza','tres cordilleras cream ale'],

  // --- Cervezas importadas / exportadas comunes en Colombia ---
  'amstel':['amstel','cerveza amstel'],
  'brahma':['brahma','cerveza brahma'],
  'quilmes':['quilmes','cerveza quilmes'],
  'sol':['cerveza sol','sol'],
  'tecate':['tecate','cerveza tecate'],
  'pacifico':['pacifico','pacífico','cerveza pacifico'],
  'guinness':['guinness','cerveza guinness'],
  'erdinger':['erdinger','cerveza erdinger'],
  'paulaner':['paulaner','cerveza paulaner'],
  'hoegaarden':['hoegaarden','jogarden','joegarden'],
  'leffe':['leffe','cerveza leffe'],
  'carlsberg':['carlsberg','cerveza carlsberg'],
  'cusqueña':['cusqueña','cusquena','cerveza cusqueña'],
  'presidente':['presidente','cerveza presidente'],
  'cristal':['cerveza cristal','cristal chilena'],
  'warsteiner':['warsteiner','cerveza warsteiner'],

  // --- Licores: aguardiente ---
  'aguardiente antioqueño':['aguardiente antioqueno','aguardiente antioqueño','antioqueño','antioqueno','guaro antioqueño'],
  'aguardiente nectar':['aguardiente nectar','aguardiente néctar','nectar verde','néctar verde'],
  'aguardiente cristal':['aguardiente cristal'],
  'aguardiente blanco del valle':['blanco del valle','aguardiente del valle'],
  'aguardiente amarillo':['aguardiente amarillo','amarillo de manzanares'],
  'aguardiente extremo':['aguardiente extremo','extremo antioqueño'],
  'aguardiente doble anis':['doble anis','doble anís','aguardiente doble anis'],
  'guaro':['guaro','aguardiente','trago de aguardiente','media de aguardiente','botella de aguardiente','cuartico de aguardiente'],

  // --- Licores: ron ---
  'ron medellin':['ron medellin','ron medellín'],
  'ron viejo de caldas':['viejo de caldas','ron caldas','ron viejo de caldas'],
  'ron santa fe':['ron santa fe','ron santafe'],
  'ron bacardi':['bacardi','bacardí','ron bacardi'],
  'ron havana club':['havana club','ron habana','ron havana'],
  'ron cacique':['cacique','ron cacique'],
  'ron':['ron','trago de ron','copa de ron'],

  // --- Licores: whisky ---
  'whisky old parr':['old parr','güisqui old parr','whisky old parr'],
  'whisky buchanans':['buchanans','buchanan','whisky buchanan'],
  'whisky chivas regal':['chivas','chivas regal','whisky chivas'],
  'whisky etiqueta roja':['etiqueta roja','johnnie walker rojo','johnny walker rojo'],
  'whisky etiqueta negra':['etiqueta negra','johnnie walker negro','johnny walker negro'],
  'whisky':['whisky','güisqui','wiski','copa de whisky'],

  // --- Licores: vodka, tequila, ginebra, brandy ---
  'vodka absolut':['absolut','vodka absolut'],
  'vodka smirnoff':['smirnoff','vodka smirnoff'],
  'vodka':['vodka','copa de vodka'],
  'tequila jose cuervo':['jose cuervo','josé cuervo','tequila jose cuervo'],
  'tequila':['tequila','shot de tequila'],
  'ginebra bombay':['bombay','ginebra bombay'],
  'ginebra beefeater':['beefeater','ginebra beefeater'],
  'ginebra':['ginebra','copa de ginebra'],
  'brandy':['brandy','coñac','cognac'],
  'vino tinto':['vino tinto','copa de vino tinto'],
  'vino blanco':['vino blanco','copa de vino blanco'],
  'champaña':['champaña','champana','espumante','copa de champaña'],

  // --- Platos de restaurante ---
  'bandeja paisa':['bandeja paisa'],
  'sancocho':['sancocho','sancocho de gallina'],
  'ajiaco':['ajiaco','ajiaco santafereño'],
  'mondongo':['mondongo'],
  'frijoles':['frijoles','frijolada'],
  'lentejas':['lentejas'],
  'arroz con pollo':['arroz con pollo'],
  'arroz con camarones':['arroz con camarones','arroz con camaron'],
  'mojarra frita':['mojarra','mojarra frita','pescado frito'],
  'filete de pescado':['filete de pescado','filete de pescado'],
  'churrasco':['churrasco'],
  'costillas bbq':['costillas','costillas bbq','costillas barbacoa'],
  'pollo asado':['pollo asado'],
  'pollo a la plancha':['pollo a la plancha','pechuga a la plancha'],
  'patacones':['patacones','patacon'],
  'tostones':['tostones'],
  'yuca frita':['yuca frita'],
  'papas a la francesa':['papas a la francesa','papitas fritas'],
  'ensalada':['ensalada'],
  'sopa del dia':['sopa del dia','sopa del día'],
  'caldo de costilla':['caldo de costilla','caldo'],
  'changua':['changua'],
  'tamal':['tamal','tamales'],
  'lechona':['lechona'],

  // --- Cafetería y snacks adicionales ---
  'ducales':['ducales','galletas ducales'],
  'saltin noel':['saltin','saltín','saltin noel'],
  'wafer':['wafer','oblea'],
  'pin pom':['pin pom','pinpom'],
  'milo':['milo'],
  'bocadillo':['bocadillo','bocadillo veleño'],
  'trululu':['trululu'],
  'chocolatina jet':['jet','chocolatina jet'],
  'chocobreak':['chocobreak'],
  'super coco':['super coco','supercoco'],
  'chocolatina jumbo':['jumbo','chocolatina jumbo'],
  'papas margarita limon':['papas limon','papas margarita limon'],
  'papas margarita natural':['papas natural','papas margarita natural'],
  'papas margarita picante':['papas picantes','papas margarita picante'],

  // --- Más presentaciones y variantes de cerveza que piden por su apodo ---
  'poker roja':['poker roja','póker roja','poker fresh','póker fresh'],
  'aguila lata':['aguila lata','águila lata','lata de aguila','lata de águila'],
  'poker lata':['poker lata','póker lata','lata de poker','lata de póker'],
  'club colombia lata':['club lata','club colombia lata','lata de club'],
  'corona lata':['corona lata','lata de corona'],
  'stella artois lata':['stella lata','lata de stella'],
  'bbc monasterio':['bbc monasterio','monasterio bbc'],
  'bbc golden ale':['bbc golden','golden ale','bbc golden ale'],
  '3 cordilleras trigo':['tres cordilleras trigo','3 cordilleras trigo','cordilleras trigo'],
  'baltica':['baltica','báltica','cerveza baltica'],
  'aguila cero lata':['aguila cero lata','águila cero lata'],

  // --- Café de marca / cafetería (además del tinto suelto que ya está arriba) ---
  'juan valdez':['juan valdez','cafe juan valdez','café juan valdez'],
  'cafe oma':['oma','cafe oma','café oma'],
  'cappuccino':['capuchino','cappuccino','capuccino'],
  'latte':['latte','café latte','cafe latte'],
  'americano':['americano','cafe americano','café americano'],
  'te chai':['chai','te chai','té chai'],
  'chocolate caliente':['chocolate caliente','chocolate santafereño','onces'],
  'aromatica':['aromatica','aromática','agua de panela','aguapanela'],

  // --- Más comida callejera y de restaurante que faltaba ---
  'salchipapa':['salchipapa','salchipapas'],
  'perro caliente especial':['perro especial','perro caliente especial','completo'],
  'buñuelo':['buñuelo','bunuelo','buñuelos','bunuelos'],
  'pandebono':['pandebono','pan de bono'],
  'almojabana':['almojabana','almojábana'],
  'arepa e huevo':['arepa e huevo','arepa de huevo','arepa con huevo'],
  'mazorca':['mazorca','mazorca asada','choclo asado'],
  'cholado':['cholado'],
  'raspao':['raspao','raspado','cono de hielo'],
  'obleas':['oblea','obleas'],
  'picada':['picada','picada para compartir','fritanga'],
  'sobrebarriga':['sobrebarriga'],
  'mute santandereano':['mute','mute santandereano'],
  'rondón':['rondon','rondón'],
  'cazuela de mariscos':['cazuela','cazuela de mariscos'],
  'ceviche':['ceviche','ceviche de camaron','ceviche de camarón']
};

function normVoiceText(s){
  const base = (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // El reconocedor a veces pega o deforma la palabra: "mesa1", "meza", "misa", "besa"...
    .replace(/\b(mesa|mesita)(\d+)\b/g, '$1 $2')
    .replace(/\b(meza|misa|messa|mesah|besa|pesa|mensa)\b/g, 'mesa')
    .replace(/\b(mezas|misas|messas|besas|pesas)\b/g, 'mesas')
    // Cervezas colombianas como las dice (o las escribe el reconocedor) la gente
    .replace(/\b(aguilas?|aguila)\s+(lait|lai|laik|lite|lig|ligh|lay|ligth|layt)\b/g, 'aguila light')
    .replace(/\b(poquer|poker|pokers|poquers|pocker|poke)\b/g, 'poker')
    .replace(/\b(costenitas?|costenita|costeñita)\b/g, 'costenita')
    .replace(/\b(club colombias?|clu colombia|clubcolombia)\b/g, 'club colombia')
    .replace(/\b(ponis?|ponny)\s+maltas?\b/g, 'pony malta');
  return expandCompoundNumbers(base);
}

function stemVoiceWord(w){
  if(w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if(w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function stemVoiceText(s){
  return s.split(' ').filter(Boolean).map(stemVoiceWord).join(' ');
}

function voiceAliasTermsForProduct(p){
  const canonical = normVoiceText(p.name);
  const aliases = [];
  // Antes se usaban coincidencias parciales en ambos sentidos, y por eso el producto
  // "Águila" heredaba los alias de "Águila/Póker" (y "poker" terminaba en Águila).
  // Ahora: si hay una clave exacta para el producto, se usan solo sus alias; si no,
  // solo la clave más larga cuyo texto esté completo dentro del nombre del producto.
  const entries = Object.keys(VOICE_PRODUCT_ALIASES).map(key => ({ keyNorm: normVoiceText(key), values: VOICE_PRODUCT_ALIASES[key] || [] }));
  let chosen = entries.filter(e => e.keyNorm && e.keyNorm === canonical);
  if(!chosen.length){
    const padded = ' ' + canonical + ' ';
    const contained = entries.filter(e => e.keyNorm && padded.includes(' ' + e.keyNorm + ' '));
    const maxLen = contained.reduce((m, e) => Math.max(m, e.keyNorm.length), 0);
    chosen = contained.filter(e => e.keyNorm.length === maxLen);
  }
  chosen.forEach(e => aliases.push(...e.values));
  aliases.push(p.name);
  return [...new Set(aliases.map(normVoiceText).filter(Boolean))];
}

// Distancia de edición simple, para tolerar palabras que el reconocedor de
// voz transcribió con 1-2 letras de diferencia y que no están en la lista
// de alias (ej. "agila" en vez de "aguila", "jainiquen" no listado para Heineken).
function levenshteinVoice(a, b){
  const m = a.length, n = b.length;
  if(!m) return n; if(!n) return m;
  let prev = new Array(n + 1); for(let j = 0; j <= n; j++) prev[j] = j;
  for(let i = 1; i <= m; i++){
    const cur = [i];
    for(let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[n];
}
const VOICE_VARIANT_WORDS = ['light', 'laig', 'liviana', 'cero', '0', 'alcohol', 'litro', 'grande', 'zero', 'mini'];
function findProductByVoiceAlias(q){
  const qNorm = normVoiceText(q);
  if(!qNorm) return null;
  const qStem = stemVoiceText(qNorm);
  const qWords = new Set(qStem.split(' '));
  let best = null, bestScore = 0;
  data.products.forEach(p=>{
    const aliases = voiceAliasTermsForProduct(p);
    aliases.forEach(alias=>{
      const aStem = stemVoiceText(alias);
      const aWords = new Set(aStem.split(' '));
      let score = 0;
      if(aStem === qStem) score = 120;
      else if(aStem.startsWith(qStem) || qStem.startsWith(aStem)) score = 92;
      else if(aStem.includes(qStem) || qStem.includes(aStem)) score = 72;
      else{
        // Compara también contra cada palabra suelta del alias (no solo la frase
        // completa), para que una sola palabra mal transcrita ("agila") pueda
        // igualar un alias de varias palabras ("aguila poker") sin que la
        // longitud total de la frase penalice la comparación.
        let sim = 0;
        [aStem, ...aStem.split(' ')].forEach(w=>{
          const maxLen = Math.max(w.length, qStem.length);
          if(maxLen < 4) return;
          const s = 1 - levenshteinVoice(w, qStem) / maxLen;
          if(s > sim) sim = s;
        });
        if(sim >= 0.72) score = 60 + sim * 20;
      }
      // "Águila" a secas es la normal: si la persona no dijo "light", "cero",
      // "litro"…, las versiones con esa palabra pierden frente a la básica.
      if(score > 0 && score < 120 && VOICE_VARIANT_WORDS.some(v => aWords.has(v) && !qWords.has(v))) score -= 5;
      score -= Math.abs(aStem.length - qStem.length) * 0.01;
      if(score > bestScore){ bestScore = score; best = p; }
    });
  });
  return bestScore >= 70 ? best : null;
}

function findGenericBeerVoice(){
  const beerCat = data.categories.find(c=>normVoiceText(c.name) === 'cervezas');
  if(beerCat){
    const p = data.products.find(x=>x.categoryId === beerCat.id);
    if(p) return p;
  }
  return data.products.find(p=>/cerveza|aguila|poker|póker|club colombia|costeña|pilsen/i.test(p.name)) || null;
}

function matchVoiceTableName(text){
  let best = null;
  Object.keys(data.tables).forEach(id=>{
    const t = data.tables[id];
    if(!t || !t.name) return;
    const norm = normVoiceText(t.name);
    if(!norm) return;
    // Si el nombre es solo un número o muy corto, exige decir "mesa" antes.
    const needsPrefix = /^\d+$/.test(norm) || norm.length < 3;
    const esc = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b(?:(?:mesa|mesita)\\s+)' + (needsPrefix ? '' : '?') + esc + '\\b');
    const m = text.match(re);
    if(m && (!best || m[0].length > best.length)){
      best = { tableId: Number(id), index: m.index, length: m[0].length };
    }
  });
  return best;
}

function matchProductVoice(text){
  const q = normVoiceText(text);
  if(!q) return null;

  // Si lo dicho es exactamente el nombre de un producto del catálogo, ese gana.
  const qStemExact = stemVoiceText(q);
  const exactName = data.products.find(p => stemVoiceText(normVoiceText(p.name)) === qStemExact);
  if(exactName) return exactName;

  // Luego intenta alias explícito (Poker, Póker, Pony, tinto, etc.).
  const aliasMatch = findProductByVoiceAlias(q);
  if(aliasMatch) return aliasMatch;

  // "cerveza" sin marca: usa la primera cerveza configurada en el catálogo.
  if(/^(la )?cerveza$/.test(q)){
    return findGenericBeerVoice();
  }

  // "cerveza águila" cuando el producto se llama solo "Águila/Póker", etc.
  const noBeer = q.replace(/^(?:la |una |un )?cerveza\s+/, '');
  if(noBeer && noBeer !== q){
    const r = matchProductVoice(noBeer);
    if(r) return r;
  }

  const qStem = stemVoiceText(q);
  let best = null, bestScore = 0;
  data.products.forEach(p=>{
    const name = normVoiceText(p.name);
    const nameStem = stemVoiceText(name);
    let score = 0;
    if(nameStem === qStem) score = 100;
    else if(nameStem.startsWith(qStem) || qStem.startsWith(nameStem)) score = 85;
    else if(nameStem.includes(qStem) || qStem.includes(nameStem)) score = 65;
    else{
      const qWords = qStem.split(' ');
      const nWords = nameStem.split(' ');
      const common = qWords.filter(w => w.length > 2 && nWords.includes(w)).length;
      if(common) score = 25 + common * 15;
    }
    score -= Math.abs(nameStem.length - qStem.length) * 0.01;
    if(score > bestScore){ bestScore = score; best = p; }
  });
  return bestScore >= 40 ? best : null;
}

// Busca un número de mesa a partir de la posición justo después de la
// palabra "mesa"/"mesita", tolerando palabras de relleno que a veces mete
// el reconocedor de voz entre medio (ej. "mesa número 1", "mesa la 2").
// Si la primera palabra "de verdad" (no relleno) no es un número, se
// detiene sin adivinar, para no comerse el producto por error.
const MESA_NUMBER_FILLERS = new Set(['numero', 'num', 'nro', 'no', 'n', 'la', 'el', 'es']);
const ORDINAL_WORDS_VOICE = {
  'primero':1,'primera':1,'primer':1,'segundo':2,'segunda':2,'tercero':3,'tercera':3,'tercer':3,
  'cuarto':4,'cuarta':4,'quinto':5,'quinta':5,'sexto':6,'sexta':6,'septimo':7,'septima':7,
  'octavo':8,'octava':8,'noveno':9,'novena':9,'decimo':10,'decima':10
};
function voiceTableNumberFromWord(w){
  if(!w) return null;
  if(/^\d+$/.test(w)) return parseInt(w, 10);
  // "1a", "2da", "3ra", "4ta" (ordinales escritos con dígito)
  const m = w.match(/^(\d+)(?:a|o|ra|ro|da|do|er|ta|to|ma|mo|va|vo|ava|avo)$/);
  if(m) return parseInt(m[1], 10);
  const has = (o) => Object.prototype.hasOwnProperty.call(o, w);
  if(has(NUM_WORDS_VOICE)) return NUM_WORDS_VOICE[w];
  if(has(ORDINAL_WORDS_VOICE)) return ORDINAL_WORDS_VOICE[w];
  return null;
}
function extractTableNumberAt(words, startIdx){
  let i = startIdx, scanned = 0;
  while(i < words.length && scanned < 3){
    const w = words[i];
    if(MESA_NUMBER_FILLERS.has(w)){ i++; scanned++; continue; }
    const v = voiceTableNumberFromWord(w);
    if(v !== null) return { value: v, end: i + 1 };
    return null;
  }
  return null;
}

// Algunos móviles repiten la frase completa ("mesa 1 5 aguilas mesa 1 5 aguilas").
function collapseRepeatedVoicePhrase(text){
  const w = text.split(' ').filter(Boolean);
  const n = w.length;
  for(let k = 2; k <= Math.floor(n / 2); k++){
    if(n % k) continue;
    let ok = true;
    for(let i = k; i < n; i++){ if(w[i] !== w[i % k]){ ok = false; break; } }
    if(ok) return w.slice(0, k).join(' ');
  }
  return text;
}

// Separa una frase en un ítem por cada producto pedido. Antes solo se
// partía por la palabra "y" (o por una coma, que se cambia por "y" antes de
// llegar aquí) — pero al hablar de corrido una lista de varios productos,
// mucha gente NO dice "y" entre cada uno, solo antes del último (ej. "tres
// águilas, dos póker y cinco cigarrillos"), y el reconocedor de voz tampoco
// siempre transcribe la coma como una pausa marcada. Eso hacía que "tres
// águilas" y "dos póker" quedaran pegados en un solo ítem ilegible y se
// perdiera el segundo producto. Ahora también se corta cada vez que aparece
// una cantidad nueva (un número) después de que el ítem que se venía
// armando YA empezó con su propia cantidad y ya tiene una palabra de
// producto — así "tres águilas dos póker" (sin "y" entre medio) se separa
// igual en dos ítems. No corta un número que viene DESPUÉS del nombre del
// producto sin cantidad inicial (ej. "corrige poker a 5"), porque ahí el
// ítem no arrancó con una cantidad.
function splitVoiceChunks(text){
  const words = text.split(' ').filter(Boolean);
  const isQtyWord = w => /^\d+$/.test(w) || NUM_WORDS_VOICE[w] !== undefined;
  const chunks = [];
  let current = [];
  words.forEach(w => {
    if(w === 'y' || w === 'tambien' || w === 'también'){
      if(current.length){ chunks.push(current.join(' ')); current = []; }
      return;
    }
    if(isQtyWord(w) && current.length){
      const startsWithQty = isQtyWord(current[0]);
      const hasProductWord = current.some(cw => !isQtyWord(cw));
      if(startsWithQty && hasProductWord){ chunks.push(current.join(' ')); current = []; }
    }
    current.push(w);
  });
  if(current.length) chunks.push(current.join(' '));
  return chunks;
}

function parseVoiceCommand(rawText){
  // Las comas de una lista hablada ("mesa 3, 5 águilas, 2 pokers") se tratan
  // igual que decir "y" entre cada producto, así no hace falta decir "y"
  // entre cada uno ni repetir la palabra "mesa" para cada ítem.
  let text = normVoiceText((rawText || '').replace(/,/g, ' y '));
  text = collapseRepeatedVoicePhrase(text);
  // "mesas 2" (plural mal oído) -> "mesa 2"
  text = text.replace(/\bmesas\s+(?=(?:(?:numero|num|nro|no)\s+)?(?:\d|(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta)\b))/g, 'mesa ');

  // Modos: corregir/fijar cantidad, quitar/restar o agregar (por defecto).
  let mode = 'add';
  // «la mesa 4 son tres águilas», «no, eran dos póker» también corrigen la cantidad (antes AGREGABA una más).
  // «son dos águilas para la mesa 3» sigue siendo un pedido nuevo.
  const corrigeSon = /\b(mesa|meza|mesita)\s+\S+\s+(son|eran)\b|\beran\b|\b(no|realidad|realmente|dicho)\s+(y\s+)?son\b/;
  if(corrigeSon.test(text) || /\b(corrige|corrigela|corrigelo|corregir|corrijo|correccion|corregime|corrigeme|deja|dejame|pon en)\b/.test(text)){
    mode = 'set';
    if(corrigeSon.test(text)) text = text.replace(/\b(no\s+)?(en realidad\s+|realmente\s+|mejor dicho\s+)?(son|eran)\b/g, ' ');
    text = text.replace(/\b(corrige|corrigela|corrigelo|corregir|corrijo|correccion|corregime|corrigeme|deja|dejame|pon en)\b/g, ' ');
  } else if(/\b(quita|quitar|quitame|resta|restar|restame|elimina|eliminar|eliminame|saca|sacar|sacame|borra|borrar|borra de)\b/.test(text)){
    mode = 'subtract';
    text = text.replace(/\b(quita|quitar|quitame|resta|restar|restame|elimina|eliminar|eliminame|saca|sacar|sacame|borra|borrar|borra de)\b/g, ' ');
  } else {
    text = text.replace(/\b(agrega|agregar|anade|anadir|agregame|agregale|anadele|pon|ponme|ponle|ponele|pide|pideme|quiero|queremos|dame|damele|danos|dale|sube|suma|sumale|sumele|carga|cargale|manda|mandale|mete|metele|añade|añadir|abre|abrir|abreme|muestra|muestrame|mostrar|regalame|regaleme|regala|regale|regalanos|regalenos|me regala|me regalas|traeme|traele|trae|traiga|traigan|traigame|sirve|sirvele|sirvame|echale|echa|lleva|llevale|llevele|despacha|despachale|marca|marcale|anota|anotale|apunta|apuntale)\b/g, ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();

  let tableId = null;
  let mesaMentioned = false;
  const named = matchVoiceTableName(text);
  if(named){
    tableId = named.tableId;
    mesaMentioned = true;
    text = (text.slice(0, named.index) + text.slice(named.index + named.length)).trim().replace(/\s+/g, ' ');
  } else {
    // Acepta: mesa 1, mesita 1, mesa número 1, mesa numero uno, y tolera
    // alguna palabra de relleno pegada por el reconocedor de voz.
    const words0 = text.split(' ').filter(Boolean);
    let mesaWordIdx = -1;
    for(let i = 0; i < words0.length; i++){
      if(words0[i] === 'mesa' || words0[i] === 'mesita'){ mesaWordIdx = i; break; }
    }
    if(mesaWordIdx !== -1){
      mesaMentioned = true;
      const found = extractTableNumberAt(words0, mesaWordIdx + 1);
      if(found){
        tableId = found.value;
        words0.splice(mesaWordIdx, found.end - mesaWordIdx);
        // Si el reconocedor repitió "mesa N" para la misma mesa, se quita también.
        for(let guard = 0; guard < 6; guard++){
          const j = words0.findIndex(x => x === 'mesa' || x === 'mesita');
          if(j === -1) break;
          const f2 = extractTableNumberAt(words0, j + 1);
          if(!f2 || f2.value !== tableId) break;
          words0.splice(j, f2.end - j);
        }
        text = words0.join(' ');
      }
      // Si no se encontró un número válido justo después de "mesa", NO se
      // adivina ninguna mesa: se deja tableId en null y mesaMentioned en
      // true, para que quien llama pregunte de nuevo en vez de aplicar el
      // pedido a la mesa equivocada (ej. la que esté abierta en pantalla).
    }
  }

  // Conectores habituales del habla: "a la mesa", "para la mesa", "en mesa", etc.
  text = text.replace(/\b(a la|para la|en la|de la|a el|para el|en el|del|al|a|para|en|de|la|el|los|las)\b/g, ' ')
             .replace(/\s+/g, ' ').trim();

  // Al sacar "mesa N" (que puede estar al inicio, en medio o al final de la
  // frase) puede quedar un "y" suelto pegado al principio o al final
  // (ej. "mesa 3, 5 águilas" -> "y 5 águilas"). Se limpia antes de partir
  // la lista de productos.
  text = text.replace(/^(?:y|tambien|también)\s+/, '').replace(/\s+(?:y|tambien|también)$/, '').trim();

  const chunks = splitVoiceChunks(text).map(c => c.trim()).filter(Boolean);
  const items = chunks.map(chunk => {
    const words = chunk.split(' ').filter(Boolean);
    let qty = null;

    // "corrige poker a 5" / "deja poker en 5".
    if(words.length > 1){
      const last = words[words.length - 1];
      if(/^\d+$/.test(last)){ qty = parseInt(last, 10); words.pop(); }
      else if(NUM_WORDS_VOICE[last] !== undefined){ qty = NUM_WORDS_VOICE[last]; words.pop(); }
    }

    // "2 poker", "dos poker".
    if(qty === null){
      if(words.length && NUM_WORDS_VOICE[words[0]] !== undefined){
        qty = NUM_WORDS_VOICE[words[0]];
        words.shift();
      } else if(words.length && /^\d+$/.test(words[0])){
        qty = parseInt(words[0], 10);
        words.shift();
      } else {
        qty = 1;
      }
    }

    return { qty, productText: words.join(' ').trim() };
  }).filter(it => it.productText);

  return { tableId, items, mode, mesaMentioned };
}

function resolveVoiceTableId(parsedTableId){
  if(parsedTableId && data.tables[parsedTableId]) return parsedTableId;
  if(currentTable && overlay.classList.contains('show')) return currentTable;
  const open = getOpenTableIds();
  if(open.length === 1) return open[0];
  return null;
}

/* ---------- Deshacer el último cambio hecho por voz ---------- */
let voiceUndoStack = [];
function pushVoiceUndoSnapshot(tableId){
  const t = data.tables[tableId];
  if(!t) return;
  voiceUndoStack.push({ tableId, items: JSON.parse(JSON.stringify(t.items || [])) });
  if(voiceUndoStack.length > 15) voiceUndoStack.shift();
}

function undoLastVoiceOrder(){
  if(!voiceUndoStack.length) return null;
  const snap = voiceUndoStack.pop();
  if(snap.abono){                         // abono por voz: se quita ese pago
    const tb = data.tables[snap.tableId]; if(tb && tb.payments && tb.payments.length) tb.payments.pop();
    saveData(); if(currentTable === snap.tableId){ try{ renderModalItems(); }catch(e){} } renderMesas();
    return snap.tableId;
  }
  if(snap.mov){                           // cambio de mesa: vuelven las dos mesas como estaban
    snap.tablas.forEach(x => { data.tables[x.id] = x.t; });
    saveData();
    if(currentTable != null && snap.tablas.some(x => x.id === currentTable)){ try{ renderModalItems(); renderPeople(); }catch(e){} }
    renderMesas();
    return snap.tablas[0].id;
  }
  const t = data.tables[snap.tableId];
  if(!t) return null;
  try{                                   // el stock vuelve a lo que había antes del pedido deshecho
    const sum = (arr) => { const m = {}; (arr || []).forEach(i => { if(i.productId) m[i.productId] = (m[i.productId] || 0) + i.qty; }); return m; };
    const now = sum(t.items), before = sum(snap.items);
    new Set([...Object.keys(now), ...Object.keys(before)]).forEach(pid => { const d = (before[pid] || 0) - (now[pid] || 0); if(d) invOnSale({ productId: pid }, d); });
  }catch(e){}
  t.items = snap.items;
  saveData();
  if(currentTable === snap.tableId){ renderModalItems(); renderPeople(); }
  renderMesas();
  return snap.tableId;
}

function isUndoVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  const VERBO = '(borra|borre|borralo|borrame|borrar|deshaz|deshace|deshaga|deshagan|deshacer|deshazlo|cancela|cancele|cancelar|cancelalo|elimina|elimine|eliminar|eliminalo|anula|anule|anular|anulalo|quita|quite|quitar|quitalo|saca|saque|sacar|retira|retire|retirar|devuelve|reversa|revierte)';
  const hasAction = new RegExp('\\b' + VERBO + '\\b').test(t);
  const hasTarget = /\b(pedido|orden|ronda)\b[\s\S]*\b(anterior|ultimo|ultima|pasado|pasada|que hice|que hicimos)\b|\b(ultimo|ultima|anterior)\b[\s\S]*\b(pedido|orden|ronda)\b|\blo\s+(que\s+)?(ultimo|anterior|que\s+(pedi|pedimos|agregue|agregamos|puse|pusimos|anote|anotamos))\b/.test(t);
  if(hasAction && hasTarget) return true;
  if(/^(deshacer|deshaz|deshace|deshaga|deshazlo|deshaz eso|deshaz lo ultimo|me equivoque|anula eso|anular|borra eso|cancela eso)$/.test(t)) return true;
  if(new RegExp('^' + VERBO + '\\s+(el\\s+|ese\\s+|mi\\s+|este\\s+)?(pedido|orden|ronda)$').test(t)) return true;
  return false;
}
// «repetir pedido anterior», «repite el último pedido», «repetir el pedido» (no «repíteme», que es recordarlo)
function isRepeatLastOrderVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  return /\b(repetir|repite|repita|repitan|repitamos|vuelve a poner|otra vez)\b[\s\S]*\b(pedido|orden)\b/.test(t) && !/\b(repiteme|repitame|dime|digame)\b/.test(t);
}

/* ---------- Recordar el último pedido hecho por voz ---------- */
let lastVoiceOrderInfo = null; // { tableId, mode, items: [{name, qty}], at }

function isRecallVoiceCommand(rawText){
  if(isUndoVoiceCommand(rawText)) return false;   // «borra el pedido anterior» es deshacer, no recordar
  const t = normVoiceText(rawText);
  // "recuérdame el pedido", "dime el pedido", "repíteme el pedido" (sin "para la mesa"), "cuál fue mi último pedido"
  if(/\b(recuerda\w*|recuerde\w*|recordar|recordame|acuerda\w*|dime|digame|repiteme|repitame|leeme|cual|como|que)\b[\s\S]*\b(pedido|pedidos|orden)\b/.test(t) && !/\b(para|a|en)\s+la\s+mesa\b/.test(t)) return true;
  if(/\b(pedido|orden)\b[\s\S]*\b(anterior|ultimo|ultima|pasado|pasada)\b|\b(ultimo|ultima)\b[\s\S]*\b(pedido|orden)\b/.test(t)) return true;
  if(/\bque\s+(pedi|agregue|pedimos|agregamos|anote|anotamos|puse|pusimos)\b/.test(t)) return true;
  if(/\bque\s+(fue\s+)?lo\s+ultimo\b/.test(t)) return true;
  // "¿qué lleva / qué tiene / qué pidió la mesa 2?"
  if(/\bque\s+(lleva|llevan|tiene|tienen|pidio|pidieron|ha pedido|han pedido)\b[\s\S]*\bmesa\b/.test(t)) return true;
  return false;
}
// Respuesta de "recuérdame el pedido": si se nombra una mesa, su última ronda y lo que lleva;
// si no, el último pedido anotado (por voz o a mano), que también se recuerda al recargar la app.
function voiceRecordarPedido(rawText){
  const t = normVoiceText(rawText);
  let mesa = null;
  if(/\bmesa\b/.test(t)){ const rm = voiceRondaMesas(rawText); mesa = rm.destino || extractVoiceTableId(rawText); }
  if(mesa && data.tables[mesa]){
    const tb = data.tables[mesa], its = tb.items || [];
    const r = tb.ultimaRonda;
    const ronda = r && r.items && r.items.length ? 'Lo último que pidió: ' + r.items.map(x => x.qty + ' ' + x.productText).join(', ') + '. ' : '';
    const lleva = its.length ? 'En total lleva ' + its.map(x => x.qty + ' ' + x.name).join(', ') + ', por ' + fmtSpoken(tableTotal(mesa)) + (tableBalance(mesa) !== tableTotal(mesa) ? ' (le falta pagar ' + fmtSpoken(tableBalance(mesa)) + ')' : '') + '.' : tableLabel(mesa) + ' no tiene nada pedido.';
    const msg = tableLabel(mesa) + ': ' + ronda + lleva;
    showToast('🗣️ ' + msg, 8000); speakVoice(msg); return;
  }
  const info = lastVoiceOrderInfo || (data && data.ultimoPedido) || null;
  if(!info){ showToast('Todavía no hay ningún pedido registrado.'); speakVoice('Todavía no hay ningún pedido registrado.'); return; }
  const msg = 'Tu último pedido fue: ' + describeVoiceOrder(info) + '.';
  showToast('🗣️ ' + msg, 7000); speakVoice(msg);
}

/* "Agrégame la misma ronda para la mesa 5" / "agrégame lo mismo para la mesa 5". */
// "misma ronda para la mesa 2", "otra ronda mesa 3", "lo mismo para la mesa 2", "repite la mesa 4",
// "la misma ronda de la mesa 3 para la mesa 5" (copia la ronda de la 3 en la 5).
function isRepeatLastRoundVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  if(/\b(mism[ao]s?\s+ronda|otra\s+ronda|otra\s+igual|otra\s+vez\s+lo\s+mismo|lo\s+mismo|la\s+misma|igual\s+que\s+antes|la\s+de\s+antes|repit\w*|repet\w*|otra\s+tanda|misma\s+tanda|lo\s+de\s+siempre|lo\s+de\s+antes)\b/.test(t)) return true;
  // «mesa 3 otra», «otra para la 5», «una más la 2», «otra más»: sin nombrar producto = otra ronda igual.
  const sinMesa = t.replace(/\b(de\s+la\s+|para\s+la\s+|a\s+la\s+|en\s+la\s+|la\s+)?mesa\s+(?:numero\s+)?\S+/g, ' ').replace(/\b(por\s+favor|porfa|porfavor|y|para|a|la)\b/g, ' ').trim().replace(/\s+/g, ' ');
  return /^(otra|otro|otra mas|otro mas|una mas|uno mas|otra por favor|otrica|otrita)$/.test(sinMesa);
}
// Mesa de donde se copia la ronda ("…de la mesa 3 para la mesa 5") y mesa destino.
function voiceRondaMesas(rawText){
  const t = normVoiceText(rawText);
  const nums = [];
  const re = /\b(de\s+la\s+|para\s+la\s+|a\s+la\s+|en\s+la\s+|la\s+)?mesa\s+(?:numero\s+)?(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince)\b/g;
  let m;
  while((m = re.exec(t))){ const n = /^\d+$/.test(m[2]) ? parseInt(m[2], 10) : NUM_WORDS_VOICE[m[2]]; if(n) nums.push({ n, de: /^de/.test(m[1] || '') }); }
  if(nums.length >= 2){ const src = nums.find(x => x.de) || nums[0]; const dst = nums.find(x => x !== src); return { origen: src.n, destino: dst.n }; }
  return { origen: null, destino: nums.length ? nums[0].n : null };
}
// Última ronda de cada mesa (lo último que se le agregó, por voz o a mano), para repetirla.
function guardarRonda(info){
  if(!info || !info.tableId || !data.tables[info.tableId]) return;
  try{ data.ultimoPedido = JSON.parse(JSON.stringify(info)); }catch(e){}
  let items = [];
  if(info.mode === 'manual') items = info.items.filter(a => Number(a.delta) > 0).map(a => ({ productText: a.name, qty: Number(a.delta) }));
  else if(info.mode === 'add' || !info.mode) items = info.items.filter(a => Number(a.qty) > 0).map(a => ({ productText: a.name, qty: Number(a.qty) }));
  if(items.length) data.tables[info.tableId].ultimaRonda = { items, at: Date.now() };
}
function getRepeatLastRoundItems(tableId){
  const r = tableId && data.tables[tableId] && data.tables[tableId].ultimaRonda;
  if(r && Array.isArray(r.items) && r.items.length) return r.items.map(x => ({ productText: x.productText, qty: x.qty }));
  if(!lastVoiceOrderInfo || !Array.isArray(lastVoiceOrderInfo.items)) return [];
  if(lastVoiceOrderInfo.mode === 'manual'){
    return lastVoiceOrderInfo.items
      .filter(a => Number(a.delta) > 0)
      .map(a => ({ productText: a.name, qty: Number(a.delta) }));
  }
  if(lastVoiceOrderInfo.mode === 'subtract') return [];
  return lastVoiceOrderInfo.items
    .filter(a => Number(a.qty) > 0)
    .map(a => ({ productText: a.name, qty: Number(a.qty) }));
}

/* ---------- Cambios hechos a mano (para "¿cuál fue el pedido anterior?") ---------- */
function tableIdOf(t){ return Number(Object.keys(data.tables).find(id => data.tables[id] === t)) || null; }
function noteManualChange(tableId, name, delta){
  if(!tableId || !delta) return;
  const now = Date.now(), L = lastVoiceOrderInfo;
  // Los cambios seguidos en la misma mesa (menos de 2 min) se juntan en un solo "pedido".
  if(L && L.mode === 'manual' && L.tableId === tableId && now - L.at < 120000){
    const m = L.items.find(x => x.name === name);
    if(m) m.delta += delta; else L.items.push({ name, delta });
    L.items = L.items.filter(x => x.delta !== 0);
    L.at = now;
    if(!L.items.length) lastVoiceOrderInfo = null;
  }else{
    lastVoiceOrderInfo = { tableId, mode: 'manual', items: [{ name, delta }], at: now };
  }
  guardarRonda(lastVoiceOrderInfo);
}

function describeVoiceOrder(info){
  if(!info) return null;
  if(info.mode === 'manual'){
    const add = info.items.filter(a => a.delta > 0).map(a => a.delta + ' ' + a.name);
    const rem = info.items.filter(a => a.delta < 0).map(a => Math.abs(a.delta) + ' ' + a.name);
    const parts = [];
    if(add.length) parts.push('agregaste ' + add.join(', '));
    if(rem.length) parts.push('quitaste ' + rem.join(', '));
    return parts.join(' y ') + ' en ' + tableLabel(info.tableId);
  }
  const resumen = info.items.map(a => {
    if(info.mode === 'set') return a.name + (a.qty === 0 ? ' (quitado)' : ' en ' + a.qty);
    if(info.mode === 'subtract') return a.name + (a.qty === 0 ? ' (quitado)' : ' quedó en ' + a.qty);
    return (a.qty > 1 ? a.qty + ' ' : '') + a.name;
  }).join(', ');
  return resumen + ' en ' + tableLabel(info.tableId);
}

/* ---------- Pedir la cuenta / el resumen por voz ---------- */
function isBillRequestVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  if(/\b(cuenta|cuentas|resumen|cobrar|cobrame|factura|totalizar|totaliza)\b/.test(t)) return true;
  if(/\bcuanto\b[\s\S]*\b(va|debe|es|suma|vale|deben|paga|pagar)\b/.test(t)) return true;
  if(/\btotal\b/.test(t) && /\b(mesa|mesita)\b/.test(t)) return true;
  // Formas cortas con una mesa nombrada: «cobra la 3», «cierra la 5», «pagó la 2», «la 4 pagó».
  // Abre el resumen para cobrar (no cierra nada sin confirmar).
  if(/\b(cobra|cobro|cobrale|cobrenle|cierra|cierrale|cerrar|cierre|pago|paga|pagan|pagaron|pagar|liquida|liquidar|liquidale)\b/.test(t) && /\b(mesa|mesita)\b/.test(t)) return true;
  return false;
}

function extractVoiceTableId(rawText){
  const text = normVoiceText(rawText);
  const named = matchVoiceTableName(text);
  if(named) return named.tableId;
  const w = text.split(' ').filter(Boolean);
  for(let i = 0; i < w.length; i++){
    if(w[i] === 'mesa' || w[i] === 'mesita' || w[i] === 'mesas'){
      const f = extractTableNumberAt(w, i + 1);
      if(f) return f.value;
    }
  }
  return null;
}

// Un comando de voz suena UNA sola vez aunque agregue 5 unidades o una lista; lo de la app de meseros no suena aquí.
function applyVoiceItems(tableId, items, mode){
  return (window.__pedidoOrigen ? sinSonidoPos : sonidoLote)(() => aplicarItemsVoz(tableId, items, mode));
}
function aplicarItemsVoz(tableId, items, mode){
  mode = mode || 'add';
  const t = data.tables[tableId];
  if(!t) return { added: [], notFound: items.map(it => it.productText) };
  if(!t.items) t.items = [];
  pushVoiceUndoSnapshot(tableId);
  const added = [];
  const notFound = [];
  items.forEach(it => {
    const product = matchProductVoice(it.productText);
    if(!product){ notFound.push(it.productText); return; }
    const existing = t.items.find(x => x.productId === product.id && !x.personId);

    if(mode === 'set'){
      const target = Math.max(0, it.qty);
      if(target === 0){
        if(existing){ try{ invOnSale(existing, -existing.qty); }catch(e){} t.items.splice(t.items.indexOf(existing), 1); sonidoPos('remove'); }
        added.push({ name: product.name, qty: 0 });
      } else if(existing){
        const diff = target - existing.qty;
        existing.qty = target;
        if(diff !== 0) recordItemHistory(existing, diff);
        added.push({ name: product.name, qty: target });
      } else {
        const newItem = { productId: product.id, name: product.name, price: product.price, size: product.size || '', qty: target, personId: null, history: [] };
        recordItemHistory(newItem, target);
        t.items.push(newItem);
        added.push({ name: product.name, qty: target });
      }
    } else if(mode === 'subtract'){
      const qn = Math.max(1, it.qty || 1);
      if(existing){
        const newQty = existing.qty - qn;
        if(newQty <= 0){
          try{ invOnSale(existing, -existing.qty); }catch(e){}
          t.items.splice(t.items.indexOf(existing), 1);
          sonidoPos('remove');
          added.push({ name: product.name, qty: 0 });
        } else {
          existing.qty = newQty;
          recordItemHistory(existing, -qn);
          added.push({ name: product.name, qty: newQty });
        }
      } else {
        notFound.push(it.productText);
      }
    } else {
      const qn = Math.max(1, it.qty || 1);
      if(existing){
        existing.qty += qn;
        recordItemHistory(existing, qn);
      } else {
        const newItem = { productId: product.id, name: product.name, price: product.price, size: product.size || '', qty: qn, personId: null, history: [] };
        recordItemHistory(newItem, qn);
        t.items.push(newItem);
      }
      added.push({ name: product.name, qty: qn });
    }
  });
  if(added.length){
    saveData();
    if(currentTable === tableId) { renderModalItems(); renderPeople(); }
    renderMesas();
    lastVoiceOrderInfo = { tableId, mode, items: added.map(a => ({ name: a.name, qty: a.qty })), at: Date.now() };
    if(!applyVoiceItems.repitiendo) guardarRonda(lastVoiceOrderInfo);
    // Pedido de un mesero (app de meseros): también va a la pantalla de preparación.
    if(window.__pedidoOrigen && mode === 'add') try{ window.vitoPedidos && window.vitoPedidos.registrarAplicado(tableId, added, window.__pedidoOrigen); }catch(e){}
  } else if(voiceUndoStack.length && voiceUndoStack[voiceUndoStack.length - 1].tableId === tableId){
    // Nada cambió: descarta el snapshot vacío que se acaba de guardar
    voiceUndoStack.pop();
  }
  return { added, notFound, mode };
}

let voiceMalePreferred = true;
/* Voz de la app (ORDEVA, pedidos, avisos): se elige la voz más NATURAL que tenga el celular — las «Google»,
   «Natural», «Neural», «Premium/Mejorada» — prefiriendo español de Latinoamérica, y sin bajarle el tono
   (antes se ponía tono 0,82 para que sonara masculina y eso la hacía sonar robótica). Se puede elegir otra
   en Ajustes → Voz. */
const VOZ_KEY = 'vento_voz';
const vozCfg = () => { try{ return JSON.parse(localStorage.getItem(VOZ_KEY)) || {}; }catch(e){ return {}; } };
function vozPuntaje(v){
  const n = (v.name || '') + ' ' + (v.voiceURI || ''), l = String(v.lang || '').replace('_', '-');
  let s = /^es/i.test(l) ? 10 : 0;
  if(/^es-CO/i.test(l)) s += 6; else if(/^es-(US|MX|419|AR|CL|PE)/i.test(l)) s += 5; else if(/^es-ES/i.test(l)) s += 3;
  if(/natural|neural|premium|enhanced|mejorad|wavenet|studio|online/i.test(n)) s += 20;
  if(/google/i.test(n)) s += 8;
  if(/compact|espeak|robot|eloquence/i.test(n)) s -= 15;
  if(v.localService === false) s += 2;
  return s;
}
function vocesEspanol(){
  if(!('speechSynthesis' in window)) return [];
  const vs = (speechSynthesis.getVoices() || []).filter(v => /^es/i.test(v.lang || '') || /español|spanish/i.test(v.name || ''));
  return vs.sort((a, b) => vozPuntaje(b) - vozPuntaje(a));
}
function vozElegida(){ const c = vozCfg(), l = vocesEspanol(); return (c.uri && l.find(v => v.voiceURI === c.uri)) || l[0] || null; }
window.ventoHablar = function(texto, o){
  o = o || {};
  if(!('speechSynthesis' in window) || !texto) return;
  if(!o.enCola) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(texto)), v = vozElegida(), c = vozCfg();
  u.lang = 'es-CO'; if(v){ try{ u.voice = v; u.lang = v.lang; }catch(e){} }
  u.rate = c.vel || 1; u.pitch = 1; u.volume = o.volumen != null ? o.volumen : 1;
  speechSynthesis.speak(u);
};

function getPreferredMaleVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
  if(!voices.length) return null;
  const es = voices.filter(v => /^es(?:-|_)/i.test(v.lang || '') || /español|spanish/i.test(v.name || ''));
  const pool = es.length ? es : voices;
  const maleHints = /male|masculin|hombre|jorge|carlos|juan|diego|miguel|alvaro|álvaro|andres|andrés|antonio|raul|raúl|sergio|daniel|luis|pablo|google español|microsoft.*jorge/i;
  return pool.find(v => maleHints.test((v.name || '') + ' ' + (v.voiceURI || ''))) || pool[0] || null;
}

function speakVoice(text, o){
  try{
    if(!('speechSynthesis' in window)) return;
    try{ text = vocabTexto(text); }catch(e){}
    window.ventoHablar(text, o);
  }catch(e){}
}

async function interpretVoiceWithAI(rawText){
  if(!hasAIKey()) return null;
  try{
    const catalog = data.products.map(p => ({name:p.name, brand:p.brand||'', size:p.size||'', category:p.category||''}));
    const tables = Object.keys(data.tables).map(id => ({id:Number(id), name:data.tables[id].name||(i18nPut(espacioN())+' '+id)}));
    const prompt = `Eres el intérprete de voz de un sistema POS de un negocio de bebidas y comidas (tienda, cafetería, restaurante o bar) en Colombia. Convierte la frase del usuario en una orden estructurada. Entiende español colombiano, errores de pronunciación, plurales y números escritos con palabras. MUY IMPORTANTE: frases cortas como "cinco águilas mesa uno", "cinco águilas mesa dos", "águilas mesa uno", "mesa uno cinco águilas", "agrega cinco águilas mesa uno" y "agregame cinco águilas a la mesa dos" son pedidos válidos. La palabra "agregar" puede estar presente o faltar. Interpreta SIEMPRE el número como cantidad y "mesa X" como destino. También reconoce "agrégame la misma ronda para la mesa 5", "agrégame lo mismo para la mesa 5" y frases equivalentes: usa intent repeat_last_round, conservando los productos y cantidades de la última ronda registrada y usando la mesa indicada como destino. "águilas" debe poder coincidir con el producto Águila del catálogo. NO inventes productos: debes elegir únicamente del catálogo proporcionado. También reconoce comandos simples de gestión y consulta: "agregar mesa", "quitar mesa", "agrega una mesa", "quita la mesa 4", "total de la mesa 2", "total de todas las mesas", "cuánto se ha vendido", "ventas de hoy". Para "agregar/quitar mesa" usa intent table_add/table_remove; para totales generales usa all_tables_total o sales_total.

Catálogo: ${JSON.stringify(catalog)}
Mesas (tableId debe ser el campo id; \"mesa 2\" es el id 2 salvo que el nombre indique otra; el reconocedor puede oír \"meza\", \"misa\" o \"mesas\" por \"mesa\"): ${JSON.stringify(tables)}
Frase: ${JSON.stringify(rawText)}

Devuelve SOLO JSON válido con estas claves: {"intent":"order|repeat_last_round|bill|all_tables_total|sales_total|table_add|table_remove|undo|recall|unknown","mode":"add|subtract|set|null","tableId":number|null,"items":[{"productText":"nombre exacto del catálogo","qty":number}],"confidence":number}. Para bill/undo/recall, items debe ser []. Si no puedes identificar una mesa o producto con suficiente seguridad, usa null/unknown en vez de inventar.`;
    const txt = await aiText({ prompt, json: true, timeoutMs: 45000, retries: 2 });
    if(!txt) return null;
    return cleanAiJsonText(txt);
  }catch(e){ console.warn('IA de voz:', e && e.message ? e.message : e); aiNotifyOnce(e); return null; }
}

function getVoiceSalesTotal(){
  const closed = (data.history || []).reduce((sum, h) => sum + (Number(h.total) || 0), 0);
  const open = Object.keys(data.tables || {}).reduce((sum, id) => sum + tableTotal(Number(id)), 0);
  return closed + open;
}

function getVoiceOpenTablesTotal(){
  return Object.keys(data.tables || {}).reduce((sum, id) => sum + tableBalance(Number(id)), 0);
}

// "cuenta general", "cuenta de todas las mesas", "total de todas las mesas", "resumen general",
// "cuánto deben todas las mesas", "todas las cuentas", "cuenta global", "cuenta completa"...
// Si se nombra una mesa concreta ("cuenta total de la mesa 1") es la cuenta de esa mesa, no la general.
function isAllTablesTotalVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  if(/\b(vendido|vendimos|vendi|ventas|venta)\b/.test(t)) return false;
  const billWord = /\b(cuenta|cuentas|total|totales|resumen|cobrar|cobro|cobra|cobrame|suma|saldo|saldos|pendiente|pendientes|debe|deben|debemos|cuanto|factura|facturas|totaliza|totalizar|balance)\b/.test(t);
  const allWord = /\b(todas|todos|general|generales|global|globales|conjunto)\b/.test(t);
  if(!billWord || !allWord) return false;
  if(extractVoiceTableId(rawText)) return false;
  return true;
}

function isSalesTotalVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  return /\b(vendido|vendimos|ventas|venta|vendido)\b/.test(t) &&
    /\b(cuanto|cuánto|total|hoy|dia|día|todas|mesas|hemos|hemos)\b/.test(t);
}

/* ---------- Confirmación de seguridad al quitar una mesa con cuenta activa ---------- */
let pendingTableRemoval = null; // { tableId, at }
const PENDING_REMOVAL_TIMEOUT_MS = 20000;

function isConfirmVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  // Un «sí» solo también confirma (solo se pregunta cuando hay una mesa esperando confirmación).
  return /\b(confirmar|confirmo|confirma|si quitar|si eliminar|si borrar|si estoy segur|si seguro|si segura|quitala igual|quitala de todas formas|hazlo|adelante|de una)\b/.test(t) || /^(si|sii|claro|dale|ok|okey|listo|correcto|exacto|quitala)( (si|senor|senora|claro|por favor|de una|quitala))*$/.test(t);
}
function isCancelVoiceCommand(rawText){
  const t = normVoiceText(rawText);
  return /\b(cancelar|cancela|cancelo|no quitar|no la quites|mejor no|olvidalo|olvidelo|deja asi|dejala asi)\b/.test(t) || /^no( (no|senor|senora|gracias|todavia))*$/.test(t);
}

function doRemoveTable(target){
  try{ closeTableToHistory(target); }catch(e){}         // si tenía cuenta, queda en el historial (lo no pagado, como deuda)
  delete data.tables[target];
  const ids = Object.keys(data.tables).map(Number);
  data.tableCount = ids.length ? Math.max(...ids) : 0;
  saveData(); renderMesas();
  const msg = 'Quité la Mesa ' + target + '.';
  showToast('➖ ' + msg); speakVoice(msg);
}

// ---- Ayuda: lista de comandos de voz ("comandos", "ayuda", "qué puedo decir") ----
function isVoiceHelpCommand(rawText){
  const t = normVoiceText(rawText);
  return /^(comandos?|ayuda|lista de comandos|que (comandos|puedo decir|te puedo decir)|cuales son (los )?comandos|que comandos hay|como te hablo)\b/.test(t);
}
const VOICE_AYUDA = [
  ['Rápido (lo más corto)', ['la 3, dos águilas', '3 dos águilas', 'regáleme una coca para la 5', 'otra la 3 (otra ronda igual)', 'cobra la 3', 'la 3 pagó', 'menos una águila la 3', 'borra lo último']],
  ['Pedidos', ['mesa 1, cinco águilas', 'dos póker y una Heineken para la mesa 3', 'agregar Heineken mesa 5', 'misma ronda para la mesa 2']],
  ['Crear mesas', ['agrégame una mesa que se llame Juan', 'agrégame mesa nueva Lucas', 'agrégame una mesa a nombre de Juan y agrégale dos cervezas y una póker', 'crea la mesa Carolina con tres Club Colombia', 'nueva mesa para don Pedro', 'ábreme una cuenta a nombre de Ana', 'quiero una mesa llamada María José', 'agrega una mesa', 'agrega hasta la mesa 10']],
  ['Nombre de la mesa', ['cámbiale el nombre a la mesa 3 por Pedro', 'la mesa 2 se llama Martín', 'ponle Carolina a la mesa 4', 'renombra la mesa 1 como Lucía', 'quítale el nombre a la mesa 2']],
  ['Cambiar de mesa', ['pasa la mesa 3 a la 5', 'junta la mesa 1 con la 4 (se juntan las cuentas)', 'cambia la mesa Juan a la 2']],
  ['Corregir', ['quita una póker de la mesa 2', 'la mesa 4 son tres águilas (corrige la cantidad)', 'deshacer', 'borra el pedido anterior', 'deshaz el último pedido', 'quitar mesa 3']],
  ['Personas y abonos', ['agrega a Juan a la mesa 4', 'pon a María en la mesa 2', 'la mesa 3 abona 20 mil', 'Juan paga 10 mil de la mesa 2 por Nequi', 'cobra la mesa 3']],
  ['Inventario y preguntas', ['cuántas Póker quedan', 'cuánto hay de Águila', 'cuánto vendí hoy', 'qué mesas están abiertas', 'siguiente canción', 'pon la canción Despacito']],
  ['Libreta (lista negra)', ['agrégame a la lista negra 30 mil para Julián', 'agrégame a la lista que Julián quedó debiendo 30 mil', 'Julián quedó de pagar 20 mil', 'cárgale a Julián 12 mil', 'fíale 10 mil a Ana', 'Julián pagó 10 mil', 'bórrale 5 mil a Julián', 'saca a Julián de la lista negra (pagó todo)', '¿quién me debe?']],
  ['Recordar', ['recuérdame el pedido (el último, por voz o a mano)', 'recuérdame el pedido de la mesa 2', 'qué lleva la mesa 3']],
  ['Cuentas', ['cuenta de la mesa 2', 'cuánto debe la 4', 'total de todas las mesas', 'cuánto llevo vendido']],
  ['Abrir', ['mesa 4 (abre esa mesa)', 'mesa Juan']]
];
function voiceAyuda(){
  let ov = document.getElementById('voiceHelpOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'voiceHelpOverlay'; ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" style="max-width:440px;max-height:88vh;overflow:auto"><h2>🎤 Comandos de voz</h2>' +
      '<div class="modal-sub">Toca el micrófono y di, por ejemplo:</div><div class="vh-list">' +
      VOICE_AYUDA.map(([g, xs]) => '<div><h3>' + g + '</h3>' + xs.map(x => '<div><q>' + x.replace(/ \(.*\)$/, '') + '</q>' + (/\(.*\)$/.test(x) ? ' <small>' + x.match(/\((.*)\)$/)[1] + '</small>' : '') + '</div>').join('') + '</div>').join('') +
      '</div><div class="modal-sub" style="margin-top:12px">El micrófono usa la voz clásica (sin internet). Para dictar con tus palabras usa el botón «IA» (actívalo en Ajustes → Voz).</div>' +
      '<div class="modal-actions"><button class="btn-primary" type="button" id="voiceHelpOk">Entendido</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#voiceHelpOk').onclick = () => ov.classList.remove('show');
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
  }
  ov.classList.add('show');
  speakVoice('Estos son los comandos de voz.');
}

/* ---------- Cambiar de mesa ----------
   Pasa toda la cuenta (o solo algunos productos) de una mesa a otra: libre, ocupada (se juntan
   las cuentas) o una mesa nueva. Se mueven también las personas, los abonos y el nombre de la
   mesa. No toca el inventario (los productos ya estaban vendidos). Se puede deshacer. */
function moverMesa(origen, destino, lineas){
  const o = data.tables[origen];
  if(!o || !(o.items || []).length) return { error: 'La ' + tableLabel(origen) + ' no tiene nada para pasar.' };
  if(origen === destino) return { error: 'Es la misma mesa.' };
  if(!data.tables[destino]){
    data.tables[destino] = { items: [], people: [] };
    data.tableCount = Math.max(data.tableCount || 0, destino);
  }
  const d = data.tables[destino];
  d.items = d.items || []; d.people = d.people || []; d.payments = d.payments || [];
  const estabaOcupada = d.items.length > 0;
  const lblO = tableLabel(origen), lblD = tableLabel(destino);   // nombres antes de mover (el nombre viaja con la cuenta)
  // Para "deshacer": copia de las dos mesas como estaban.
  voiceUndoStack.push({ mov: true, tableId: destino, tablas: [{ id: origen, t: JSON.parse(JSON.stringify(o)) }, { id: destino, t: JSON.parse(JSON.stringify(d)) }] });
  if(voiceUndoStack.length > 15) voiceUndoStack.shift();
  // Personas: se reutiliza la de igual nombre en la mesa destino; si no, se copia con id nuevo.
  const mapaPersonas = {};
  const personaDestino = pid => {
    if(pid == null) return null;
    if(mapaPersonas[pid] !== undefined) return mapaPersonas[pid];
    const p = (o.people || []).find(x => x.id === pid);
    if(!p){ mapaPersonas[pid] = null; return null; }
    const igual = d.people.find(x => String(x.name).trim().toLowerCase() === String(p.name).trim().toLowerCase());
    if(igual){ mapaPersonas[pid] = igual.id; return igual.id; }
    const nueva = Object.assign({}, p, { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) });
    d.people.push(nueva); mapaPersonas[pid] = nueva.id; return nueva.id;
  };
  const agregar = (it, qty) => {
    const pid = personaDestino(it.personId);
    const ex = d.items.find(x => x.productId && x.productId === it.productId && (x.personId || null) === pid && x.price === it.price);
    if(ex){ ex.qty += qty; ex.history = (ex.history || []).concat(it.history || []).slice(-30); }
    else d.items.push(Object.assign({}, it, { qty, personId: pid, history: (it.history || []).slice() }));
  };
  let movidas = 0;
  const todo = !lineas;
  if(todo){
    o.items.forEach(it => { agregar(it, it.qty); movidas += it.qty; });
    o.items = [];
    (o.payments || []).forEach(p => d.payments.push(Object.assign({}, p, { personId: p.personId != null ? personaDestino(p.personId) : p.personId })));
    o.payments = []; o.people = [];
    if(!estabaOcupada && o.name && !d.name){ d.name = o.name; o.name = null; }
    if(o.ultimaRonda && !d.ultimaRonda) d.ultimaRonda = o.ultimaRonda;
    delete o.ultimaRonda;
  } else {
    Object.keys(lineas).map(Number).sort((a, b) => b - a).forEach(i => {
      const it = o.items[i], n = Math.min(lineas[i], it ? it.qty : 0);
      if(!it || !(n > 0)) return;
      agregar(it, n); movidas += n;
      if(n >= it.qty) o.items.splice(i, 1); else it.qty -= n;
    });
    // Personas que se quedaron sin productos en la mesa de origen: se quitan de ahí.
    o.people = (o.people || []).filter(p => o.items.some(it => it.personId === p.id) || (o.payments || []).some(x => x.personId === p.id));
  }
  saveData();
  try{ renderMesas(); }catch(e){}
  if(todo && estabaOcupada) try{ window.registrarUnificacion && window.registrarUnificacion({ juntada: true, lblO, lblD, destino }); }catch(e){}
  return { movidas, todo, juntada: estabaOcupada, origen, destino, lblO, lblD };
}
function movMensaje(r){
  return (r.todo ? 'Pasé la cuenta de ' : 'Pasé ' + r.movidas + (r.movidas === 1 ? ' producto' : ' productos') + ' de ') + r.lblO + (r.juntada ? ' y la junté con ' : ' a ') + r.lblD + '.';
}
// Resuelve "3", "tres", "Juan" o "la mesa de Juan" a un número de mesa.
function movMesaDe(txt){
  const w = String(txt || '').trim();
  if(!w) return null;
  if(/^\d+$/.test(w)) return parseInt(w, 10);
  if(NUM_WORDS_VOICE[w]) return NUM_WORDS_VOICE[w];
  const n = w.replace(/^(la|el|de|del|mesa)\s+/g, '').trim();
  const id = Object.keys(data.tables).map(Number).find(k => { const nm = data.tables[k] && data.tables[k].name; return nm && normVoiceText(nm) === n; });
  return id || null;
}
// Voz: "pasa la mesa 3 a la 5", "cambia la mesa 2 para la mesa 6", "junta la mesa 1 con la 4",
// "mueve la mesa de Juan a la 2", "la mesa 3 se pasó a la 7".
function voiceCambiarMesa(rawText){
  const t = normVoiceText(rawText);
  if(!/\b(pasa|pasar|pasame|pasala|paso|pasaron|cambia|cambiar|cambiame|cambiala|mueve|mover|muevela|muevame|traslada|trasladar|lleva|llevar|junta|juntar|juntame|une|unir|unela)\b/.test(t)) return false;
  const m = t.match(/\bmesa\s+(?:de\s+|del\s+)?([a-z0-9]+(?:\s+[a-z]+)?)\s+(?:(?:se\s+)?(?:paso|pasaron|cambio|movio)\s+)?(?:a|para|hacia|con|en)\s+(?:la\s+)?(?:mesa\s+)?(?:de\s+)?([a-z0-9]+(?:\s+[a-z]+)?)\s*$/);
  if(!m) return false;
  // El nombre puede tener dos palabras ("ana maria"); se prueba primero con las dos y luego con una.
  const pick = s => movMesaDe(s) || movMesaDe(s.split(' ')[0]);
  const o = pick(m[1]), d = pick(m[2]);
  if(!o || !d){ return false; }
  if(!data.tables[o]){ const msg = 'No encontré la ' + (typeof o === 'number' ? 'mesa ' + o : o) + '.'; showToast('⚠️ ' + msg); speakVoice(msg); return true; }
  const r = moverMesa(o, d);
  if(r.error){ showToast('⚠️ ' + r.error); speakVoice(r.error); return true; }
  const msg = movMensaje(r);
  showToast('🔀 ' + msg + ' Di "deshacer" si te equivocaste.', 6000); speakVoice(msg);
  return true;
}
// Ventana: elegir qué se pasa y a cuál mesa.
function abrirCambioMesa(origen){
  const o = data.tables[origen];
  if(!o || !(o.items || []).length){ showToast('Esta mesa no tiene nada para pasar.'); return; }
  let ov = document.getElementById('movOverlay');
  if(!ov){ ov = document.createElement('div'); ov.id = 'movOverlay'; ov.className = 'overlay'; document.body.appendChild(ov); ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); }); }
  let modo = 'todo', destino = null;
  const sel = {};
  const pintar = () => {
    const ids = Object.keys(data.tables).map(Number).filter(k => k !== origen).sort((a, b) => a - b);
    const lineas = o.items.map((it, i) => '<div class="mov-li"><span>' + invEsc(it.name) + ' <small>×' + it.qty + '</small></span><div class="mov-q"><button type="button" data-i="' + i + '" data-d="-1">−</button><b>' + (sel[i] || 0) + '</b><button type="button" data-i="' + i + '" data-d="1">+</button></div></div>').join('');
    ov.innerHTML = '<div class="modal" style="max-width:460px;max-height:90vh;overflow:auto"><h2>🔀 Cambiar de mesa</h2><div class="modal-sub">Desde ' + invEsc(tableLabel(origen)) + ' (' + fmt(tableTotal(origen)) + ')</div>' +
      '<div class="mov-modo"><button type="button" data-m="todo" class="' + (modo === 'todo' ? 'on' : '') + '">Toda la cuenta</button><button type="button" data-m="parte" class="' + (modo === 'parte' ? 'on' : '') + '">Solo algunos productos</button></div>' +
      (modo === 'parte' ? '<div class="mov-lineas">' + lineas + '</div>' : '') +
      '<div class="mov-sub">¿A cuál mesa?</div><div class="mov-mesas">' +
      ids.map(k => { const tt = data.tables[k], oc = (tt.items || []).length; return '<button type="button" data-k="' + k + '" class="' + (destino === k ? 'on ' : '') + (oc ? 'oc' : '') + '"><b>' + invEsc(tableLabel(k)) + '</b><small>' + (oc ? fmt(tableTotal(k)) + ' · se juntan' : 'Libre') + '</small></button>'; }).join('') +
      '<button type="button" data-k="nueva" class="' + (destino === 'nueva' ? 'on' : '') + '"><b>➕ Mesa nueva</b><small>Mesa ' + (Math.max(0, ...Object.keys(data.tables).map(Number)) + 1) + '</small></button></div>' +
      '<div class="modal-actions"><button class="btn-close" type="button" data-x="1">Cancelar</button><button class="btn-primary" type="button" data-ok="1">Pasar</button></div></div>';
    ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { modo = b.dataset.m; pintar(); });
    ov.querySelectorAll('.mov-q button').forEach(b => b.onclick = () => { const i = +b.dataset.i; sel[i] = Math.max(0, Math.min(o.items[i].qty, (sel[i] || 0) + (+b.dataset.d))); pintar(); });
    ov.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { destino = b.dataset.k === 'nueva' ? 'nueva' : +b.dataset.k; pintar(); });
    ov.querySelector('[data-x]').onclick = () => ov.classList.remove('show');
    ov.querySelector('[data-ok]').onclick = () => {
      if(destino == null){ showToast('⚠️ Elige a cuál mesa.'); return; }
      const lineasSel = modo === 'parte' ? Object.fromEntries(Object.entries(sel).filter(([, v]) => v > 0)) : null;
      if(lineasSel && !Object.keys(lineasSel).length){ showToast('⚠️ Elige qué productos pasar (con +).'); return; }
      const dest = destino === 'nueva' ? Math.max(0, ...Object.keys(data.tables).map(Number)) + 1 : destino;
      const r = moverMesa(origen, dest, lineasSel);
      if(r.error){ showToast('⚠️ ' + r.error); return; }
      ov.classList.remove('show');
      try{ openTableModal(dest); }catch(e){}
      showToast('🔀 ' + movMensaje(r) + ' (toca aquí para deshacer)', 7000);
      const tt = document.getElementById('toast');
      tt.onclick = () => { tt.classList.remove('show'); const id = undoLastVoiceOrder(); if(id){ showToast('↩️ Listo, lo devolví como estaba.'); try{ openTableModal(origen); }catch(e){} } };
    };
  };
  pintar();
  ov.classList.add('show');
}

// ---- Crear una mesa con nombre (y pedido) por voz ----
// "agrégame una mesa con el nombre Juan y agrégale dos cervezas, una póker"
// "crea la mesa Carolina con tres Club Colombia" · "nueva mesa para don Pedro" · "abre una mesa a nombre de Ana"
const VOICE_MESA_VERBOS = /^(agrega|agregame|agregue|agreguen|agregueme|agregar|agregale|anade|anademe|anadime|anadir|anada|crea|creame|crear|cree|creeme|abre|abreme|abrir|abrime|abra|abrame|pon|ponme|poner|ponga|pongame|haz|hazme|hacer|haga|hagame|arma|armame|armar|monta|montame|montar|mete|meteme|registra|registrame|registrar|inicia|iniciar|empieza|arranca|habilita|activa|dame|deme|quiero|necesito|necesitamos|ocupo|nueva|nuevo|otra)$/;
const VOICE_MESA_PALABRA = /^(mesa|mesita|cuenta)$/;
const VOICE_MESA_CORTE = new Set(['y','e','con','agregale','agregar','agrega','agregue','ponle','pon','anotale','anota','sirvele','sirve','dale','traele','traigale','llevale','que','mesa','por','favor','porfa','porfavor','plis','please','ya','ahora','rapido','gracias','le','para','en','al','a']);
const VOICE_CANTIDAD = /^(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|media|medio)$/;
// Frases que anuncian el nombre de la mesa, de la más larga a la más corta.
const VOICE_MESA_MARCAS = [
  'y que se va a llamar','que se va a llamar','y que se llame','y que se llama','que se llame','que se llama','que se llamara','y se llama','y se llame','se llama','se llame',
  'y ponle de nombre','y ponle el nombre de','y ponle el nombre','y ponle','ponle de nombre','ponle el nombre de','ponle el nombre','ponle','y llamala','llamala','y le pones','le pones',
  'que tenga el nombre de','con el nombre de','con el nombre','con nombre de','con nombre','cuyo nombre es','el nombre es','de nombre','por nombre','a nombre de','a nombre del','a nombre',
  'que diga','llamada','llamado','nombre','para el','para la','para','de el','de la','del','de'
].map(x => x.split(' '));
const VOICE_MESA_NO_NOMBRE = /^(nueva|nuevo|otra|otro|numero|mas|aparte|adicional|extra|libre|vacia|grande|pequena|afuera|adentro|terraza|personas?|gente)$/;
const voiceNormPalabra = w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
function voiceCrearMesaConNombre(rawText){
  const rw = String(rawText || '').replace(/[,.;:!?¿¡"()]/g, ' ').split(/\s+/).filter(Boolean);
  const nw = rw.map(voiceNormPalabra);
  // Muletillas al inicio: "oye", "mesi", "por favor", "hola"...
  let i = 0;
  while(i < nw.length && i < 4 && !VOICE_MESA_VERBOS.test(nw[i]) && !VOICE_MESA_PALABRA.test(nw[i])) i++;
  if(i >= nw.length || i >= 4) return false;
  let m;
  if(VOICE_MESA_PALABRA.test(nw[i])){
    // "mesa nueva Juan" / "mesa para Juan": sin verbo solo vale si dice "nueva" o es lo primero.
    if(!(nw[i + 1] === 'nueva' || nw[i + 1] === 'nuevo' || i === 0)) return false;
    if(nw[i] === 'cuenta') return false;
    m = i;
  } else {
    m = i + 1;
    // Entre el verbo y "mesa" solo pueden ir palabras de relleno ("agrégame POR FAVOR una nueva
    // mesa", "crea ya otra mesa"); así "agrega dos cervezas a la mesa Juan" sigue siendo un pedido.
    const RELLENO = /^(una|un|la|el|otra|otro|nueva|nuevo|me|mi|porfa|por|favor|porfavor|ya|rapido|rapidito|ahi|aqui|tambien|de|pues|oye|mesi)$/;
    while(m < nw.length && m < i + 5 && RELLENO.test(nw[m])) m++;
    if(!VOICE_MESA_PALABRA.test(nw[m] || '')) return false;
    // "cuenta" solo cuenta como mesa con abrir/crear ("ábreme una cuenta a nombre de Ana"), no con "dame la cuenta".
    if(nw[m] === 'cuenta' && !/^(abre|abreme|abrir|abrime|abra|abrame|crea|creame|crear|cree|creeme|inicia|iniciar|arranca|nueva|otra)$/.test(nw[i]) && !/^(nueva|otra)$/.test(nw[m - 1])) return false;
  }
  let p = m + 1;
  while(/^(nueva|nuevo|mas|aparte|adicional|extra|otra)$/.test(nw[p] || '')) p++;
  // Marcador del nombre ("que se llame", "a nombre de", "para", "llamada"…); se prueba el más largo primero.
  for(const mk of VOICE_MESA_MARCAS){ if(mk.every((w, k) => nw[p + k] === w)){ p += mk.length; break; } }
  if(nw[p] === 'el' || nw[p] === 'la' || nw[p] === 'senor' || nw[p] === 'senora' || nw[p] === 'senorita') p++;
  const ini = p;
  while(p < nw.length && p - ini < 3 && nw[p] && !VOICE_MESA_CORTE.has(nw[p]) && !VOICE_CANTIDAD.test(nw[p]) && !VOICE_MESA_PALABRA.test(nw[p])) p++;
  const nombre = rw.slice(ini, p).join(' ').replace(/[^\p{L}\p{N} .'-]/gu, '').trim();
  if(!nombre || /^\d+$/.test(nombre) || VOICE_MESA_NO_NOMBRE.test(nw[ini] || '')) return false;
  // Lo que sigue es el pedido: se quitan los conectores ("y agrégale", "con", "ponle"...).
  let q = p;
  while(q < nw.length && (VOICE_MESA_CORTE.has(nw[q]) || nw[q] === 'de') && !VOICE_CANTIDAD.test(nw[q])) q++;
  const pedidoTxt = rw.slice(q).join(' ');
  const bonito = nombre.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  // ¿Ya hay una mesa con ese nombre? Se usa esa en vez de crear otra.
  const clave = bonito.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let id = Object.keys(data.tables).map(Number).find(k => { const n = data.tables[k] && data.tables[k].name; return n && n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === clave; });
  let creada = false;
  if(!id){
    id = Math.max(0, ...Object.keys(data.tables).map(Number)) + 1;
    data.tables[id] = { items: [], people: [], name: bonito };
    data.tableCount = Math.max(data.tableCount || 0, id);
    creada = true;
  }
  let resumen = '', noEncontre = [];
  if(pedidoTxt){
    const items = parseVoiceCommand(pedidoTxt).items || [];
    if(items.length){
      const r = applyVoiceItems(id, items, 'add');
      resumen = r.added.map(a => (a.qty > 1 ? a.qty + ' ' : '') + a.name).join(', ');
      noEncontre = r.notFound || [];
    } else noEncontre = [pedidoTxt];
  }
  saveData(); try{ renderMesas(); }catch(e){}
  const quien = 'la mesa ' + bonito;
  let msg = (creada ? 'Creé ' + quien : 'Ya existía ' + quien) + (resumen ? (creada ? ' y le agregué ' : '; le agregué ') + resumen : '') + '.';
  showToast((creada ? '➕ ' : '✅ ') + msg + (noEncontre.length ? ' No encontré: ' + noEncontre.join(', ') + '.' : ''), 6000);
  speakVoice(msg + (noEncontre.length ? ' No encontré ' + noEncontre.join(', ') + '.' : ''));
  if(!pedidoTxt && !creada){ try{ openTableModal(id); }catch(e){} }
  return true;
}

// ---- Cambiar el nombre de una mesa por voz o por el chat ----
// "cámbiale el nombre a la mesa 3 por Juan" · "ponle Juan a la mesa 3" · "la mesa 3 se llama Juan"
// "renombra la mesa 3 como Lucas" · "a la mesa 2 ponle de nombre Ana" · "quítale el nombre a la mesa Juan"
function voiceRenombrarMesa(rawText){
  const rw = String(rawText || '').replace(/[,.;:!?¿¡"()]/g, ' ').split(/\s+/).filter(Boolean);
  const nw = rw.map(voiceNormPalabra);
  const t = nw.join(' ');
  if(!/\bmesa\b/.test(t)) return false;
  const REF = '(\\d+|[a-z]+(?: [a-z]+)?)';
  const NOM = '(?:el nombre de |el nombre |de nombre |nombre |como |por |a |para )?(.+)';
  let ref = null, nom = null, quitar = false, mm;
  if((mm = t.match(new RegExp('\\b(?:quita|quitale|borra|borrale|elimina|eliminale|saca|sacale)(?: el)? nombre (?:a|de) (?:la )?mesa ' + REF + '$')))){ ref = mm[1]; quitar = true; }
  else if((mm = t.match(new RegExp('\\b(?:cambia|cambiale|cambiar|cambie|cambiele|pon|ponle|poner|ponga|pongale|coloca|colocale)(?: el)? nombre (?:a|de) (?:la )?mesa ' + REF + ' (?:por|a|como|para|que sea) ' + '(?:el nombre de |el nombre |de nombre )?(.+)$')))){ ref = mm[1]; nom = mm[2]; }
  else if((mm = t.match(new RegExp('\\b(?:renombra|renombrar|renombrame|renombre|bautiza|bautizar)(?: la)? mesa ' + REF + ' ' + NOM + '$')))){ ref = mm[1]; nom = mm[2]; }
  else if((mm = t.match(new RegExp('^(?:(?:oye|mesi|hola|porfa|por favor) )*(?:la )?mesa ' + REF + ' (?:ahora )?(?:se llama|se va a llamar|se llamara|es de|es para|a nombre de|ahora es) (?:el |la )?(.+)$')))){ ref = mm[1]; nom = mm[2]; }
  else if((mm = t.match(new RegExp('\\b(?:ponle|pongale|dile|llama|llamale) (?:de nombre |el nombre (?:de )?)?(.+?) a la mesa ' + REF + '$')))){ ref = mm[2]; nom = mm[1]; }
  else if((mm = t.match(new RegExp('\\ba la mesa ' + REF + ' (?:ponle|pongale|dile|llamala|cambiale el nombre (?:a|por)) (?:de nombre |el nombre (?:de )?)?(.+)$')))){ ref = mm[1]; nom = mm[2]; }
  else return false;
  // La referencia puede ser un número ("3", "tres") o el nombre que ya tiene ("la mesa Juan").
  let id = movMesaDe(ref) || movMesaDe(ref.split(' ')[0]);
  if(!id || !data.tables[id]){ const msg = 'No encontré la mesa ' + ref + '.'; showToast('⚠️ ' + msg); speakVoice(msg); return true; }
  let bonito = '';
  if(!quitar){
    // Se toma el nombre tal como se dijo (con tildes y mayúsculas) buscando esas palabras en el texto original.
    const nwNom = nom.split(' ').filter(Boolean);
    let at = -1;
    for(let k = nw.length - nwNom.length; k >= 0; k--){ if(nwNom.every((w, j) => nw[k + j] === w)){ at = k; break; } }
    const crudo = at >= 0 ? rw.slice(at, at + nwNom.length).join(' ') : nom;
    bonito = crudo.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().split(' ').slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if(!bonito) return false;
  }
  const antes = tableLabel(id);
  data.tables[id].name = quitar ? null : bonito;
  saveData(); try{ renderMesas(); }catch(e){}
  const msg = quitar ? 'Listo, ' + antes + ' volvió a llamarse Mesa ' + id + '.' : 'Listo, ' + antes + ' ahora se llama ' + bonito + '.';
  showToast('✏️ ' + msg); speakVoice(msg);
  return true;
}

function voiceTableManagement(rawText){
  const t = normVoiceText(rawText).replace(/\s+/g,' ').trim();
  const det = '(?:(?:la|una|otra|nueva|esa|hasta)\\s+)*';
  const add = new RegExp('\\b(agrega|agregar|agregame|anade|anadir|añade|añadir|crea|crear|abre|abrir|pon|poner)\\s+' + det + 'mesas?\\b').test(t);
  const remove = new RegExp('\\b(quita|quitar|quitame|elimina|eliminar|eliminame|borra|borrar|saca|sacar)\\s+' + det + 'mesas?\\b').test(t);
  if(!add && !remove) return false;

  // Si después de "mesa N" vienen más palabras (productos), es un pedido y no
  // un comando de gestión de mesas. Ej: "agrega mesa 1, 5 águilas".
  const mgmtRe = new RegExp('\\b(agrega|agregar|agregame|anade|anadir|añade|añadir|crea|crear|abre|abrir|pon|poner|quita|quitar|quitame|elimina|eliminar|eliminame|borra|borrar|saca|sacar)\\s+' + det + 'mesas?\\b');
  const mm = t.match(mgmtRe);
  if(mm){
    const after = t.slice(mm.index + mm[0].length).trim().split(' ').filter(Boolean);
    let k = 0;
    while(k < after.length && k < 3 && MESA_NUMBER_FILLERS.has(after[k])) k++;
    let numVal = null;
    if(k < after.length){ numVal = voiceTableNumberFromWord(after[k]); if(numVal !== null) k++; }
    const ignore = new Set(['y','en','la','el','de','a','por','favor','porfavor','ya','ahora']);
    const tail = after.slice(k).filter(w => !ignore.has(w));
    if(tail.length) return false;
    // "abre la mesa 2" con la mesa 2 existente: abrir esa mesa, no crear otra.
    if(/^(abre|abrir)$/.test(mm[1]) && numVal !== null && data.tables[numVal]) return false;
  }

  const m = t.match(/\b(?:mesa|mesas)\s+(?:numero|num)?\s*(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
  const requested = m ? (/^\d+$/.test(m[1]) ? parseInt(m[1],10) : NUM_WORDS_VOICE[m[1]]) : null;

  if(add){
    if(requested && requested > (data.tableCount || Object.keys(data.tables).length)){
      for(let i=(data.tableCount||Object.keys(data.tables).length)+1;i<=requested;i++) data.tables[i] = {items:[], people:[]};
      data.tableCount = requested;
      saveData(); renderMesas();
      const msg = 'Agregué hasta la Mesa ' + requested + '.';
      showToast('➕ ' + msg); speakVoice(msg); return true;
    }
    const next = Math.max(0, ...(Object.keys(data.tables).map(Number))) + 1;
    data.tables[next] = {items:[], people:[]};
    data.tableCount = Math.max(data.tableCount || 0, next);
    saveData(); renderMesas();
    const msg = 'Agregué la Mesa ' + next + '.';
    showToast('➕ ' + msg); speakVoice(msg); return true;
  }

  let target = requested;
  if(!target) target = Math.max(0, ...(Object.keys(data.tables).map(Number)));
  if(!target || !data.tables[target]){
    const msg = 'No encontré esa mesa.'; showToast(msg); speakVoice(msg); return true;
  }
  const tdata = data.tables[target];
  if(tdata.items && tdata.items.length){
    const balance = tableBalance(target);
    pendingTableRemoval = { tableId: target, at: Date.now() };
    const msg = 'Atención: la Mesa ' + target + ' tiene una cuenta activa de ' + fmtSpoken(balance) + '. Si la quitas, esa cuenta pasa al historial como deuda. Si en verdad quieres quitarla, toca el micrófono y di "sí". Si no, di "no".';
    showToast('⚠️ ' + msg);
    speakVoice(msg);
    return true;
  }
  doRemoveTable(target);
  return true;
}

function handleSimpleVoiceCommands(rawText){
  // Si hay una eliminación de mesa esperando confirmación, esa respuesta manda primero.
  if(pendingTableRemoval){
    const fresh = (Date.now() - pendingTableRemoval.at) < PENDING_REMOVAL_TIMEOUT_MS;
    if(fresh && isConfirmVoiceCommand(rawText)){
      const target = pendingTableRemoval.tableId;
      pendingTableRemoval = null;
      doRemoveTable(target);
      return true;
    }
    if(fresh && isCancelVoiceCommand(rawText)){
      pendingTableRemoval = null;
      const msg = 'Listo, no quité la mesa.';
      showToast('✅ ' + msg); speakVoice(msg);
      return true;
    }
    // Si dijo otra cosa o ya pasó el tiempo, la confirmación pendiente expira sola
    // y seguimos interpretando el comando con normalidad.
    pendingTableRemoval = null;
  }

  if(voiceCambiarMesa(rawText)) return true;
  if(voiceRenombrarMesa(rawText)) return true;
  if(voiceCrearMesaConNombre(rawText)) return true;
  if(voiceTableManagement(rawText)) return true;

  if(isAllTablesTotalVoiceCommand(rawText)){
    announceGeneralBill();
    return true;
  }

  if(isSalesTotalVoiceCommand(rawText)){
    const total = getVoiceSalesTotal();
    const msg = 'Las ventas acumuladas, incluyendo las mesas abiertas, son ' + fmtSpoken(total) + '.';
    showToast('📊 ' + msg); speakVoice(msg); return true;
  }
  return false;
}

// ¿La interpretación local entiende bien el comando (mesa válida + productos del catálogo)?
function voiceLocalCanHandle(rawText){
  if(isUndoVoiceCommand(rawText) || isRecallVoiceCommand(rawText) || isBillRequestVoiceCommand(rawText)) return true;
  const p = parseVoiceCommand(rawText);
  let tid = p.tableId;
  if(!tid && !p.mesaMentioned) tid = resolveVoiceTableId(null);
  if(!tid || !data.tables[tid]) return false;
  if(!p.items.length) return !!(p.tableId && p.mesaMentioned); // solo "mesa N": abre la mesa
  return p.items.every(it => matchProductVoice(it.productText));
}

// El micrófono de pedidos es SIEMPRE la voz clásica: instantánea, gratis y sin internet.
// La IA solo se usa desde su propio botón («IA», junto al micrófono), si se activa en Ajustes → Voz.
// Separa varios productos dichos seguidos sin número ("águila póker heineken" → 3 productos). Toma
// siempre el nombre de producto más largo que calce ("águila light" gana a "águila"), en singular.
function voiceSepararProductos(items){
  const sing = w => w.length > 3 ? w.replace(/(es|s)$/, '') : w;
  const norm = x => normVoiceText(x).split(' ').filter(Boolean).map(sing);
  const nombres = (data.products || []).map(p => ({ p, w: norm(p.name) })).filter(x => x.w.length);
  const calza = seg => {                  // producto cuyo nombre empieza exactamente con esas palabras
    let best = null;
    nombres.forEach(x => { if(seg.length <= x.w.length && seg.every((w, i) => x.w[i] === w)){ if(!best || x.w.length < best.w.length) best = x; } });
    return best;
  };
  const out = [];
  (items || []).forEach(it => {
    const w = norm(it.productText || '');
    if(w.length < 2 || calza(w)){ out.push(it); return; }
    const partes = []; let i = 0;
    while(i < w.length){
      let k = Math.min(4, w.length - i), hit = null;
      for(; k >= 1; k--){ hit = calza(w.slice(i, i + k)); if(hit) break; }
      if(!hit){ partes.length = 0; break; }
      partes.push(hit.p.name); i += k;
    }
    if(partes.length >= 2){ partes.forEach((n, j) => out.push({ productText: n, qty: j === 0 ? (it.qty || 1) : 1 })); }
    else out.push(it);
  });
  return out;
}
{ const _mpv = matchProductVoice; matchProductVoice = function(t){ const r = _mpv.apply(this, arguments); if(r || !data || !data.renombres) return r; const n = normVoiceText(t || ''); const k = Object.keys(data.renombres).find(x => normVoiceText(x) === n); return k ? _mpv(nombreVigente(k)) : r; }; }
{ const _pvc = parseVoiceCommand; parseVoiceCommand = function(raw){ const r = _pvc.apply(this, arguments); if(r && r.items) r.items = voiceSepararProductos(r.items); return r; }; }
let voiceModoIA = false;
// Corrige lo que el reconocedor de voz del celular suele escribir mal:
// • "póquer"/"poquer" → póker.
// • Números pegados: al decir "mesa 1, dos águilas" el celular escribe "mesa 12 águilas". Si esa mesa
//   no existe, se separa en "mesa 1, 2 águilas" (se prueba el corte que deja una mesa que sí existe).
function voiceNormalizarHabla(raw){
  let t = String(raw || '');
  try{ const [sg, pl] = espacio(); if(sg !== 'Mesa'){ const q = w => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); const pat = w => q(w).split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\u0300-\\u036f]?').join(''); t = t.normalize('NFD').replace(new RegExp('(^|[^\\p{L}])(' + pat(pl) + '|' + pat(sg) + ')(?![\\p{L}])', 'giu'), (m, a, w, i, str) => /^cuentas?$/.test(q(w)) && /^\s+(de|del)\b/i.test(str.slice(i + m.length)) ? m : a + (q(w) === q(pl) && q(pl) !== q(sg) ? 'mesas' : 'mesa')).normalize('NFC'); } }catch(e){}   // «la cuenta de la mesa 2» es pedir la cuenta
  t = t.replace(/\bp[oó]quer(e?s)?\b/gi, 'póker').replace(/\bpoker(e?s)\b/gi, 'póker');
  t = t.replace(/\b(mesa|mesita)\s+(\d{2,3})\b(?=\s+[^\d\s])/gi, (all, w, num) => {
    if(data.tables[parseInt(num, 10)]) return all;
    for(let k = num.length - 1; k >= 1; k--){
      const a = parseInt(num.slice(0, k), 10), q = parseInt(num.slice(k), 10);
      if(q > 0 && data.tables[a]) return w + ' ' + a + ', ' + q;
    }
    return all;
  });
  /* Formas cortas como se habla en un bar (solo si esa mesa existe, para no confundir
     cantidades con mesas):
     - «la 3», «de la 3», «a la 5», «para la 2» → «la mesa 3»…  («cobra la 3», «la cuenta de
       la 5», «quita una águila de la 3», «pasa la 3 a la 5»). Antes «la 5 tres póker» le
       metía el pedido a OTRA mesa.
     - número suelto al inicio seguido de cantidad: «3 dos águilas» → «mesa 3 dos águilas»
       (antes agregaba 3 águilas).
     - «menos» = quitar: «mesa 3 menos una águila» (antes la AGREGABA). */
  const NUM_PAL = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, 'dieciséis': 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20 };
  const esMesa = n => !!(n && data && data.tables && data.tables[n]);
  t = t.replace(/(^|[^\p{L}])(la)\s+(\d{1,3}|[a-záéíóúñ]+)(?=$|[^\p{L}\d])/giu, (all, pre, la, x) => {
    const n = /^\d+$/.test(x) ? parseInt(x, 10) : NUM_PAL[x.toLowerCase()];
    return esMesa(n) ? pre + la + ' mesa ' + n : all;
  });
  t = t.replace(/\bmesa\s+mesa\b/gi, 'mesa');
  t = t.replace(/^\s*(\d{1,3})\s+(?=(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\s+\S)/i, (all, n) => esMesa(parseInt(n, 10)) ? 'mesa ' + n + ' ' : all);
  t = t.replace(/\bmenos\s+(?=\S)/gi, 'quita ');
  // Muletillas al empezar: «que sean dos Póker…», «hay que agregar…», «que me traigan…» (se perdía la cantidad)
  t = t.replace(/^\s*no[\s,.]+(?=(?:eran|son)\b)/i, '');
  t = t.replace(/^\s*son\s+(?=(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|\d+)\s)/i, '');
  t = t.replace(/^\s*(?:que\s+(?:sean|sea|me\s+(?:traigan|traiga|traes|traen|regalen|regale|den|des))|hay\s+que\s+(?:agregar|poner|anotar|sumar|meter)|me\s+(?:traen|traes|trae|regalan|regalas|dan|das))\s+/i, '');
  // Deshacer con otras palabras
  if(/^\s*(borra|quita|cancela|elimina)\s+(lo|el)\s+(ultimo|último)\s*$|^\s*(me equivoque|me equivoqué|error|eso no|corrige eso|devuelve|atras|atrás)\s*$/i.test(t)) t = 'deshacer';
  return t;
}
// ---------- Más comandos de voz (1.27): inventario, abrir/cobrar mesa, personas, abonos y preguntas a ORDEVA ----------
function voiceDecir(txt, ms){ const limpio = String(txt || '').replace(/[•🧠📦🧾🛒🧮💰🆕🚫⚠️📈📉🏭🛎️🍳🎵✅🔎🔗⏭▶🗑👤💵📲📝↩️🔁]/gu, ' ').replace(/\s+/g, ' ').trim();
  showToast(String(txt).split('\n').slice(0, 5).join(' · '), ms || 8000); speakVoice(limpio.slice(0, 320)); }
function voiceEsPregunta(raw){
  const t = normVoiceText(raw);
  if(/\b(cancion|canciones|musica|cola de musica|playlist|youtube)\b/.test(t) && !/\b(mesa|meza)\s+\S+\s+(un|una|uno|dos|tres|\d)/.test(t)) return true;   // «siguiente canción», «pon la canción…»
  return /\?\s*$/.test(String(raw)) || /^(cuanto|cuanta|cuantos|cuantas|que|cual|cuales|como|quien|quienes|donde|hay|dime|digame|muestrame|ensename|revisa|informe|resumen|estado)\b/.test(t);
}
function voiceExtras(raw){
  const t = normVoiceText(raw);
  const mesaN = (() => { const m = t.match(/\b(?:mesa|meza|cuenta)\s+(?:numero\s+)?(\d{1,3}|[a-z]+)\b/); if(!m) return null; const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : (typeof NUM_PAL !== 'undefined' ? NUM_PAL[m[1]] : null); if(n && data.tables[n]) return n; try{ const x = extractVoiceTableId(raw); return x && data.tables[x] ? x : null; }catch(e){ return null; } })();
  // Inventario: «¿cuántas Poker quedan?», «cuánto hay de Águila», «stock de Club Colombia»
  let mInv = t.match(/^(?:cuant[oa]s?|cuanto)\s+(?:de\s+)?(.+?)\s+(?:quedan|queda|hay|tengo|tenemos|me quedan|nos quedan|van quedando)(?:\s+.*)?$/) || t.match(/^(?:cuanto|cuanta|cuantos|cuantas)\s+(?:hay|queda|quedan)\s+(?:de\s+)?(.+)$/) || t.match(/^(?:stock|inventario|existencias)\s+(?:de|del)\s+(.+)$/) || t.match(/^(?:quedan|queda|hay)\s+(.+?)\s*$/);
  if(mInv && !/\b(mesa|mesas|cuenta|cuentas|pedido|pedidos|cancion|canciones|plata|dinero|ventas?|saldo|deuda|debe)\b/.test(mInv[1])){
    const p = matchProductVoice(mInv[1]);
    if(p){ const msg = p.stock == null || p.stock === '' ? p.name + ' no lleva control de inventario.' : 'De ' + p.name + ' quedan ' + p.stock + ' unidad' + (p.stock == 1 ? '' : 'es') + '.'; voiceDecir('📦 ' + msg); return true; }
  }
  // Abrir una mesa: «abre la mesa 3», «muéstrame la mesa 2»
  if(mesaN && /^(abre|abrir|abreme|muestra|muestrame|ver|ensename|entra a|entra en)\s+(la\s+)?(cuenta\s+de\s+la\s+)?(mesa|meza|cuenta)\s+\S+$/.test(t)){
    openTableModal(mesaN); speakVoice('Listo, ' + tableLabel(mesaN) + '.'); return true;
  }
  // Cobrar una mesa (pide confirmación como siempre): «cobra la mesa 3», «cierra la cuenta de la mesa 2»
  if(mesaN && /^(cobra|cobrar|cobrale|cobrame|cierra|cerrar|cierrale|liquida|liquidar|factura|facturale)\s+(la\s+)?(cuenta\s+(de\s+)?(la\s+)?)?(mesa|meza|cuenta)\b/.test(t)){
    const tb = data.tables[mesaN];
    if(!tb.items || !tb.items.length){ voiceDecir(tableLabel(mesaN) + ' no tiene nada por cobrar.'); return true; }
    openTableModal(mesaN); voiceDecir('💰 ' + tableLabel(mesaN) + ': son ' + fmtSpoken(tableBalance(mesaN)) + '. Confirma el cobro en pantalla.');
    setTimeout(() => { const b = document.getElementById('chargeBtn'); if(b && currentTable === mesaN) b.click(); }, 450);
    return true;
  }
  // Agregar una persona a la mesa: «agrega a Juan a la mesa 4», «pon a María en la mesa 2»
  const mPer = t.match(/^(?:agrega|agregale|agregame|anade|mete|pon|suma|sumale|registra|anota)\s+(?:a\s+)?(?:una\s+persona\s+(?:llamada\s+|que\s+se\s+llama\s+)?|la\s+persona\s+)?([a-zn][a-zn ]{1,28}?)\s+(?:a|en|para)\s+la\s+(?:mesa|meza|cuenta)\s+\S+$/);
  if(mesaN && mPer && !/\d/.test(mPer[1]) && !matchProductVoice(mPer[1]) && !/^(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|otra|otro|otras|otros|lo|la|el|los|las)\b/.test(mPer[1])){
    const pal = mPer[1].trim().split(' '), orig = String(raw).split(/\s+/), on = orig.map(w => normVoiceText(w));
    let nombre = mPer[1].trim();
    for(let i = 0; i + pal.length <= on.length; i++){ if(pal.every((w, k) => on[i + k] === w)){ nombre = orig.slice(i, i + pal.length).join(' ').replace(/[^\p{L} ]/gu, ''); break; } }
    nombre = nombre.replace(/(^|\s)\p{L}/gu, c => c.toUpperCase());
    const tb = data.tables[mesaN]; tb.people = tb.people || [];
    if(tb.people.some(x => normVoiceText(x.name) === normVoiceText(nombre))){ voiceDecir('👤 ' + nombre + ' ya está en ' + tableLabel(mesaN) + '.'); return true; }
    tb.people.push({ id: Date.now().toString(), name: nombre }); saveData();
    if(currentTable === mesaN){ try{ renderPeople(); }catch(e){} }
    renderMesas(); voiceDecir('👤 Agregué a ' + nombre + ' a ' + tableLabel(mesaN) + '.'); return true;
  }
  // Abono / pago parcial: «la mesa 3 abona 20 mil», «Juan paga 10 mil de la mesa 2 por transferencia»
  if(mesaN && /\b(abona|abono|abonar|abonale|abonen|adelanta|adelanto|anticipo|paga|pago|pagan|pagaron|pague)\b/.test(t) && !/\b(todo|toda la cuenta|completo|completa)\b/.test(t)){
    const monto = window.ventoMonto ? window.ventoMonto(t.replace(/\b(mesa|meza|cuenta)\s+(numero\s+)?\S+/, ' ')) : 0;
    if(monto > 0){
      const tb = data.tables[mesaN]; tb.payments = tb.payments || [];
      const met = /\b(transferencia|transfirio|nequi|daviplata|bancolombia|qr)\b/.test(t) ? 'transferencia' : 'efectivo';
      const mQuien = t.match(/^([a-zn]+(?:\s[a-zn]+)?)\s+(?:abona|paga|pago|adelanta)\b/);
      const quien = mQuien && !/^(la|el|mesa|cuenta|me|le|se)$/.test(mQuien[1]) ? mQuien[1].replace(/\b\w/g, c => c.toUpperCase()) : '';
      tb.payments.push({ note: quien ? quien + ' (abono por voz)' : 'Abono por voz', amount: monto, method: met });
      saveData(); if(currentTable === mesaN){ try{ renderModalItems(); }catch(e){} } renderMesas();
      voiceDecir('💵 Abono de ' + fmtSpoken(monto) + (met === 'transferencia' ? ' por transferencia' : ' en efectivo') + ' a ' + tableLabel(mesaN) + '. Queda debiendo ' + fmtSpoken(Math.max(0, tableBalance(mesaN))) + '. Di «deshacer» si te equivocaste.');
      voiceUndoStack.push({ abono: true, tableId: mesaN }); if(voiceUndoStack.length > 15) voiceUndoStack.shift();
      return true;
    }
  }
  return false;
}
// Preguntas por el micrófono: las responde ORDEVA con los datos reales (sin internet) y las dice en voz alta.
function voicePreguntaLaya(raw){
  let r = null;
  try{ r = window.Laya && window.Laya.responder(raw); }catch(e){}
  try{ if(!r && typeof asisCommand === 'function') r = asisCommand(raw); }catch(e){}
  try{ if(!r && typeof asisLocalAccion === 'function'){ const a = asisLocalAccion(raw); if(a) r = { text: a.text, actions: a.actions }; } }catch(e){}
  try{ if(!r){ const x = (typeof asisLocalMas === 'function' && asisLocalMas(raw)) || (typeof asisLocal === 'function' && asisLocal(raw)); if(x) r = { text: x }; } }catch(e){}
  if(!r || !r.text) return false;
  voiceDecir(r.text, 10000);
  if(r.run) setTimeout(r.run, 700);
  if(r.actions && r.actions.length){ try{ asisOpen(); asisBot(r.text, { actions: r.actions }); }catch(e){} }
  return true;
}
async function handleVoiceTranscript(rawText){
  const conIA = voiceModoIA; voiceModoIA = false;
  if(typeof subPuedeVender === 'function' && !subPuedeVender()){ subPaywall('Para seguir usando la voz y hacer ventas, renueva tu suscripción.'); return; }
  rawText = voiceNormalizarHabla(rawText);
  try{
    // «ORDEVA, ¿qué hay en la barra?» dicho en el micrófono de pedidos: lo responde ORDEVA (y lo dice en voz alta).
    if(/^\s*((oye|hola|ok|okey|ey|hey)[\s,]+)?(laya|vento|bento|ordeva|hordeva|or deva)\b/i.test(rawText) && !window.__pedidoOrigen){
      let ly = null; try{ ly = window.Laya && window.Laya.responder(rawText); }catch(e){}
      if(ly){ showToast('🧠 ' + ly.text.split('\n').slice(0, 4).join(' · '), 9000); speakVoice(ly.text.replace(/[•🧠📦🧾🛒🧮💰🆕🚫⚠️📈📉🏭🛎️🍳🎵✅🔎🔗⏭▶🗑]/gu, ' ').slice(0, 400)); if(ly.actions && ly.actions.length || ly.run){ asisOpen(); asisAsk(rawText); } return; }
      // No es una pregunta para ORDEVA: se quita su nombre y la frase sigue como un pedido o comando de voz normal.
      rawText = rawText.replace(/^\s*((oye|hola|ok|okey|ey|hey)[\s,]+)?(laya|vento|bento|ordeva|hordeva|or deva)\b[\s,]*/i, '');
      if(!rawText.trim()) return;
    }
    if(isVoiceHelpCommand(rawText)){ voiceAyuda(); return; }
    if(/^\s*(abre|abrir|ábreme|abreme|muestra|pon)?\s*(la\s+)?calculadora\s*$/i.test(rawText)){ if(window.calculadoraAbrir) window.calculadoraAbrir(); return; }
    // Cuentas por voz con el micrófono principal: «súmame 3500 más 4000 y multiplícame 5000 por 2».
    // Solo si se pidió una cuenta (súmame, multiplícame, divídeme, réstame, cuánto es…) y no se nombró una
    // mesa ni un producto (así «súmale 2 Águilas a la mesa 3» sigue siendo un pedido).
    try{
      const tn = String(rawText).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nombraAlgo = /\b(mesa|meza|cuenta|silla|habitacion|pedido|ronda)\b/.test(tn) || data.products.some(p => { const w = String(p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(x => x.length > 3 && !/^(lata|botella|cerveza|litro|unidad)$/.test(x)); return w.some(x => new RegExp('\\b' + x.replace(/[^a-z0-9]/g, '') + 's?\\b').test(tn)); });
      const calc = !nombraAlgo && window.ventoCalcular && window.ventoCalcular(rawText, true);
      if(calc){ showToast(calc.texto, 12000); speakVoice(calc.voz); return; }
    }catch(e){}
    if(voiceExtras(rawText)) return;
    if(window.libretaVoz && window.libretaVoz(rawText)) return;   // «Juan me debe 20 mil», «agrégame a la lista negra…»
    if(/\b(libreta|cuaderno)\b/i.test(rawText) && window.libretaAbrir){ window.libretaAbrir(); return; }
    if(handleSimpleVoiceCommands(rawText)) return;
    if(voiceEsPregunta(rawText) && !isRecallVoiceCommand(rawText) && !isBillRequestVoiceCommand(rawText) && voicePreguntaLaya(rawText)) return;
    if(conIA){
      if(!hasAIKey()){ showToast('⚠️ La IA no está conectada (⚙️ Configurar IA). Usé la voz clásica.'); return handleVoiceTranscriptLocal(rawText); }
      return await handleVoiceTranscriptAI(rawText, true);
    }
    return handleVoiceTranscriptLocal(rawText);
  }catch(err){
    console.error('Voz:', err);
    showToast('Error al procesar el comando de voz: ' + (err && err.message ? err.message : err));
  }
}

async function handleVoiceTranscriptAI(rawText, forzar){
  if(isRepeatLastOrderVoiceCommand(rawText) || isUndoVoiceCommand(rawText)) return handleVoiceTranscriptLocal(rawText);   // órdenes fijas: sin gastar IA
  if((forzar || voiceAiOn()) && hasAIKey()){
    const ai = await interpretVoiceWithAI(rawText);
    if(ai && ai.confidence >= 0.72){
      if(ai.intent === 'undo'){
        const undoneTableId = undoLastVoiceOrder();
        const msg = undoneTableId ? 'Deshecho el último cambio en ' + tableLabel(undoneTableId) + '.' : 'No hay nada que deshacer.';
        showToast('↩️ ' + msg); speakVoice(msg); return;
      }
      if(ai.intent === 'recall'){
        if(!lastVoiceOrderInfo){ showToast('Todavía no hay ningún pedido registrado.'); speakVoice('Todavía no hay ningún pedido registrado.'); return; }
        const msg = 'Tu último pedido fue: ' + describeVoiceOrder(lastVoiceOrderInfo) + '.';
        showToast('🗣️ ' + msg); speakVoice(msg); return;
      }
      if(ai.intent === 'repeat_last_round'){
        const tableId = resolveVoiceTableId(ai.tableId);
        const repeatItems = getRepeatLastRoundItems(tableId);
        if(!tableId){
          showToast('¿Para cuál mesa? Di por ejemplo "misma ronda para la mesa 5".');
          speakVoice('¿Para cuál mesa es la misma ronda?');
          return;
        }
        if(!repeatItems.length){
          showToast('No hay una ronda anterior para repetir.');
          speakVoice('No hay una ronda anterior para repetir.');
          return;
        }
        const result = applyVoiceItems(tableId, repeatItems, 'add');
        if(result.added.length){
          const msg = 'Misma ronda agregada a ' + tableLabel(tableId) + '.';
          showToast('✅ ' + msg); speakVoice(msg);
        }
        if(result.notFound.length) showToast('No encontré: ' + result.notFound.join(', '));
        return;
      }
      if(ai.intent === 'all_tables_total'){ announceGeneralBill(); return; }
      if(ai.intent === 'sales_total'){
        const msg = 'Las ventas acumuladas, incluyendo las mesas abiertas, son ' + fmtSpoken(getVoiceSalesTotal()) + '.';
        showToast('📊 ' + msg); speakVoice(msg); return;
      }
      if(ai.intent === 'bill'){
        const tableId = resolveVoiceTableId(ai.tableId);
        if(tableId){ openBillSummary(tableId); speakVoice('La cuenta de ' + tableLabel(tableId) + ' es ' + fmtSpoken(tableBalance(tableId)) + '.'); }
        else { showToast('¿La cuenta de cuál mesa?'); speakVoice('¿La cuenta de cuál mesa?'); }
        return;
      }
      if(ai.intent === 'order' && Array.isArray(ai.items) && ai.items.length){
        const tableId = resolveVoiceTableId(ai.tableId);
        if(tableId){
          const result = applyVoiceItems(tableId, ai.items, ai.mode || 'add');
          if(result.added.length){
            const msg = result.added.map(a => (a.qty > 1 ? a.qty + ' ' : '') + a.name).join(', ') + ' agregado a ' + tableLabel(tableId) + '.';
            showToast('✅ ' + msg); speakVoice(msg);
          }
          if(result.notFound.length){ showToast('No encontré: ' + result.notFound.join(', ')); }
          return;
        }
      }
    }
  }
  return handleVoiceTranscriptLocal(rawText);
}

function handleVoiceTranscriptLocal(rawText){
  if(isRepeatLastOrderVoiceCommand(rawText)){
    const info = lastVoiceOrderInfo || (data && data.ultimoPedido) || null;
    if(!info || !info.tableId){ showToast('Todavía no hay ningún pedido para repetir.'); speakVoice('Todavía no hay ningún pedido para repetir.'); return; }
    const rm = voiceRondaMesas(rawText), destino = rm.destino || info.tableId;
    return handleVoiceTranscriptLocal('misma ronda de la mesa ' + info.tableId + ' para la mesa ' + destino);
  }
  if(isRecallVoiceCommand(rawText)){ voiceRecordarPedido(rawText); return; }
  if(isRepeatLastRoundVoiceCommand(rawText)){
    const rm = voiceRondaMesas(rawText);
    const tableId = resolveVoiceTableId(rm.destino || extractVoiceTableId(rawText));
    if(!tableId){
      showToast('¿Para cuál mesa? Di por ejemplo "misma ronda para la mesa 5".');
      speakVoice('¿Para cuál mesa es la misma ronda?');
      return;
    }
    const origen = rm.origen || tableId;
    const repeatItems = getRepeatLastRoundItems(origen);
    if(!repeatItems.length){
      showToast('⚠️ No hay una ronda anterior para repetir en ' + tableLabel(origen) + '.');
      speakVoice('No hay una ronda anterior para repetir.');
      return;
    }
    applyVoiceItems.repitiendo = true;
    let result;
    try{ result = applyVoiceItems(tableId, repeatItems, 'add'); }finally{ applyVoiceItems.repitiendo = false; }
    if(result.added.length){
      const resumen = result.added.map(a => a.qty + ' ' + a.name).join(', ');
      const msg = 'Misma ronda para ' + tableLabel(tableId) + (origen !== tableId ? ' (copiada de ' + tableLabel(origen) + ')' : '') + ': ' + resumen + '.';
      showToast('🔁 ' + msg);
      speakVoice(msg);
    }
    if(result.notFound.length){
      showToast('No encontré: ' + result.notFound.join(', '));
    }
    return;
  }

  if(isUndoVoiceCommand(rawText)){
    const undoneTableId = undoLastVoiceOrder();
    if(undoneTableId){
      const msg = 'Deshecho el último cambio en ' + tableLabel(undoneTableId) + '.';
      showToast('↩️ ' + msg);
      speakVoice(msg);
    } else {
      showToast('No hay ningún pedido por voz para deshacer.');
      speakVoice('No hay nada que deshacer.');
    }
    return;
  }

  if(isRecallVoiceCommand(rawText)){ voiceRecordarPedido(rawText); return; }

  if(isBillRequestVoiceCommand(rawText)){
    const parsedId = extractVoiceTableId(rawText);
    const tableId = resolveVoiceTableId(parsedId);
    if(!tableId){
      showToast('¿La cuenta de cuál mesa? Di por ejemplo "cuenta de la mesa 2".');
      speakVoice('¿La cuenta de cuál mesa?');
      return;
    }
    openBillSummary(tableId);
    const balance = tableBalance(tableId);
    showToast('🧾 ' + tableLabel(tableId) + ': ' + fmt(balance), 7000); speakVoice('La cuenta de ' + tableLabel(tableId) + ' es ' + fmtSpoken(balance) + '.');
    return;
  }

  const { tableId: parsedTableId, items, mode, mesaMentioned } = parseVoiceCommand(rawText);
  if(!items.length && parsedTableId && mesaMentioned && data.tables[parsedTableId]){
    // Solo se dijo "mesa 4": se abre esa mesa.
    openTableModal(parsedTableId);
    speakVoice('Mesa ' + parsedTableId + '.');
    return;
  }
  if(!items.length){
    showToast('No entendí ningún producto en: "' + rawText + '"');
    speakVoice('No entendí ningún producto. Intenta de nuevo.');
    return;
  }
  // Si se dijo "mesa" pero no se logró entender el número, NO se asume
  // ninguna mesa (ni la que esté abierta en pantalla, ni la única mesa con
  // cuenta activa): se pide que lo repita, para evitar que el pedido caiga
  // en la mesa equivocada.
  if(!parsedTableId && mesaMentioned){
    showToast('Escuché: "' + rawText + '". No entendí el número de mesa. Di por ejemplo "mesa 2".');
    speakVoice('No entendí el número de mesa. ¿Cuál mesa?');
    return;
  }
  // Si se entendió un número de mesa pero esa mesa no existe (posible
  // confusión de dígito, ej. "mesa 1" oído como "mesa 7"), tampoco se
  // asume otra mesa: se avisa cuál número se entendió para que el usuario
  // lo corrija.
  if(parsedTableId && !data.tables[parsedTableId]){
    showToast('Escuché: "' + rawText + '". Entendí "mesa ' + parsedTableId + '" pero esa mesa no existe (mesas: 1 a ' + Math.max(0, ...Object.keys(data.tables).map(Number)) + ').');
    speakVoice('No encontré la mesa ' + parsedTableId + '. ¿Cuál mesa es?');
    return;
  }
  // Modo tienda / mixto (lib/vento-pos.js): sin mesa, el pedido va a la venta de la caja.
  if(!parsedTableId && window.ventoPOS && ventoPOS.vozCaja && ventoPOS.vozCaja(items, mode, 'antes')) return;
  const tableId = resolveVoiceTableId(parsedTableId);
  if(!tableId && !parsedTableId && window.ventoPOS && ventoPOS.vozCaja && ventoPOS.vozCaja(items, mode, 'sin_mesa')) return;
  if(!tableId){
    showToast('¿Para cuál mesa? Di por ejemplo "mesa 2" al inicio o al final.');
    speakVoice('¿Para cuál mesa es el pedido?');
    return;
  }
  const { added, notFound } = applyVoiceItems(tableId, items, mode);
  if(added.length){
    let msg;
    if(mode === 'set'){
      const resumen = added.map(a => a.name + (a.qty === 0 ? ' (quitado)' : ' ahora en ' + a.qty)).join(', ');
      msg = 'Corregido: ' + resumen + ' en ' + tableLabel(tableId) + '.';
      showToast('✏️ ' + msg);
    } else if(mode === 'subtract'){
      const resumen = added.map(a => a.name + (a.qty === 0 ? ' (quitado)' : ' queda en ' + a.qty)).join(', ');
      msg = resumen + ' en ' + tableLabel(tableId) + '.';
      showToast('➖ ' + msg);
    } else {
      const resumen = added.map(a => (a.qty > 1 ? a.qty + ' ' : '') + a.name).join(', ');
      msg = resumen + ' agregado a ' + tableLabel(tableId) + '.';
      showToast('✅ ' + msg);
    }
    speakVoice(msg);
  }
  if(notFound.length){
    const label = mode === 'subtract' ? 'No estaba en el pedido de ' + tableLabel(tableId) + ': ' : 'No encontré: ';
    const msg2 = label + notFound.join(', ') + '.';
    showToast(msg2);
    if(!added.length) speakVoice(mode === 'subtract' ? 'Ese producto no está en el pedido.' : 'No encontré ese producto. Intenta de nuevo.');
  }
}

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let voiceRecognizer = null;
let voiceListening = false;
let voiceFinalBuffer = '';
let voiceInterim = '';        // lo último que se oyó aunque no llegara «final» (frases cortas: «una póker»)
let voiceSilenceTimer = null;
const VOICE_SILENCE_MS = 2000;      // silencio tras hablar antes de procesar el comando (pedidos largos con pausas)
const VOICE_INITIAL_TIMEOUT_MS = 6000; // tiempo máximo esperando que empiece a hablar
const VOICE_COMPLETO_MS = 1200;     // app Android: la orden ya está completa (mesa + productos): se anota más rápido
const VOICE_ABRIENDO_MS = 400;         // si el micrófono tarda más que esto en abrir, se avisa «Abriendo…»
let voiceAbriendoT = null, voiceTocado = 0, voiceAvisado = false;

function updateVoiceFabUI(){
  const fab = document.getElementById('voiceFab');
  if(!fab) return;
  fab.classList.toggle('listening', voiceListening);
  // Escuchando: cuadrado de «detener» con ondas; en reposo: el micrófono moderno (mismo dibujo del HTML).
  fab.querySelector('.voice-fab-icon').innerHTML = voiceListening
    ? '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 9v6"/><path d="M21 9v6"/></g></svg>'
    : '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="8.6" y="2.5" width="6.8" height="12" rx="3.4" fill="currentColor"/><path d="M5.4 10.8a6.6 6.6 0 0 0 13.2 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 17.6v3.2M9 20.8h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

/* Puntúa qué tan "entendible" resulta un texto reconocido, para elegir la
   mejor alternativa entre las que ofrece el reconocedor de voz sin tener
   que ejecutar ninguna acción todavía (sin efectos secundarios). */
function scoreVoiceTranscript(text){
  if(!text) return -100;
  if(pendingTableRemoval && (isConfirmVoiceCommand(text) || isCancelVoiceCommand(text))) return 60;
  if(isUndoVoiceCommand(text) || isRecallVoiceCommand(text)) return 45;
  const t = normVoiceText(text);
  if(/\b(mesa|mesas)\b/.test(t) && /\b(agrega|agregar|quita|quitar|elimina|eliminar|borra|borrar|crea|crear|abre|abrir|saca|sacar)\b/.test(t)) return 42;
  if(isAllTablesTotalVoiceCommand(text)) return 44;
  if(isSalesTotalVoiceCommand(text)) return 40;
  if(isBillRequestVoiceCommand(text)) return 35;
  const { tableId, items, mesaMentioned } = parseVoiceCommand(text);
  let score = 0;
  if(tableId && data.tables[tableId]) score += 30;
  else if(tableId) score += 5;
  else if(mesaMentioned) score -= 15;
  if(!items.length) score -= 5;
  items.forEach(it => { score += matchProductVoice(it.productText) ? 20 : -8; });
  return score;
}

function pickBestVoiceAlternative(result){
  let best = result[0].transcript;
  let bestScore = -Infinity;
  for(let j = 0; j < result.length; j++){
    const s = scoreVoiceTranscript(result[j].transcript);
    if(s > bestScore){ bestScore = s; best = result[j].transcript; }
  }
  return best;
}

/* ¿La frase ya es una orden completa? (mesa que existe + productos conocidos, o un comando como «deshacer», «cuenta de
   la mesa 2»…). Si termina en «y», «con», «para la mesa», un número suelto… todavía falta: se sigue escuchando. */
function voiceComandoCompleto(raw){
  try{
    const t0 = voiceNormalizarHabla(String(raw || '')), t = normVoiceText(t0);
    if(!t) return false;
    if(/\b(y|e|o|con|de|del|para|pa|a|al|la|el|los|las|mas|mesa|meza|mesita|otra|otro|otras|otros|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|numero|nombre|llama|llamada|son|eran|agrega|agregale|agregame|quita|quitale|pon|ponle|dame|traeme|regaleme)$/.test(t)) return false;
    if(/\d$/.test(t) && !/\b(mesa|meza)\s+\d+$/.test(t)) return false;
    if(pendingTableRemoval && (isConfirmVoiceCommand(t0) || isCancelVoiceCommand(t0))) return true;
    if(isUndoVoiceCommand(t0) || isVoiceHelpCommand(t0) || isSalesTotalVoiceCommand(t0) || isAllTablesTotalVoiceCommand(t0)) return true;
    if(isBillRequestVoiceCommand(t0) || isRecallVoiceCommand(t0)) return !!extractVoiceTableId(t0);
    const p = parseVoiceCommand(t0);
    return !!(p.tableId && data.tables[p.tableId] && p.items.length && p.items.every(it => matchProductVoice(it.productText)));
  }catch(e){ return false; }
}

function scheduleVoiceSilenceStop(ms){
  if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
  voiceSilenceTimer = setTimeout(() => {
    try{ if(voiceRecognizer && voiceListening) stopVoiceCommand(); }catch(e){}
  }, ms);
}

function ensureVoiceRecognizer(){
  if(!SpeechRecognitionCtor) return null;
  if(voiceRecognizer) return voiceRecognizer;
  voiceRecognizer = new SpeechRecognitionCtor();
  voiceRecognizer.lang = 'es-CO';
  // Modo continuo: deja pausas naturales entre "mesa", "mesa 1" y "5 águilas"
  // sin cortar el reconocimiento antes de tiempo. Solo se detiene cuando hay
  // un silencio real (o si el usuario toca el botón otra vez).
  voiceRecognizer.continuous = true;
  voiceRecognizer.interimResults = true;
  voiceRecognizer.maxAlternatives = 5;
  voiceRecognizer.mantener = true;   // en la APK: no se corta en cada pausa (ver el puente de voz de Android, arriba)
  voiceRecognizer.onresult = (e) => {
    const ultFinal = e.results.length && e.results[e.results.length - 1].isFinal;
    // Se reconstruye el texto desde todos los resultados finales (en vez de ir
    // sumando), porque algunos Chrome/Android repiten o acumulan la frase y
    // eso rompía el reconocimiento de la mesa y del producto.
    const finals = [];
    for(let i = 0; i < e.results.length; i++){
      if(!e.results[i].isFinal) continue;
      const best = pickBestVoiceAlternative(e.results[i]);
      const cur = normVoiceText(best);
      const prevRaw = finals.length ? finals[finals.length - 1] : '';
      const prev = prevRaw ? normVoiceText(prevRaw) : '';
      if(prev && prev === cur) continue;
      if(prev && prev.split(' ').length >= 2 && cur.startsWith(prev + ' ')) finals[finals.length - 1] = best;
      else finals.push(best);
    }
    voiceFinalBuffer = finals.join(' ').trim();
    // Android, con frases cortas, a veces entrega solo el resultado parcial y luego «no entendí»:
    // se guarda lo último oído para no perder el pedido (antes había que tocar el micrófono dos veces).
    const ult = e.results[e.results.length - 1];
    if(ult && !ult.isFinal){ const t = pickBestVoiceAlternative(ult); if(t && t.trim()) voiceInterim = t.trim(); }
    // App Android: Android ya esperó su silencio antes de dar la frase final; si la orden está completa se anota en
    // 1,2 s (si se sigue hablando, se suma). En el navegador se deja la espera normal.
    scheduleVoiceSilenceStop(window.VentoAndroid && ultFinal && voiceComandoCompleto(voiceFinalBuffer) ? VOICE_COMPLETO_MS : VOICE_SILENCE_MS);
  };
  voiceRecognizer.onstart = () => {
    if(!voiceListening) return;
    clearTimeout(voiceAbriendoT);
    if(!voiceAvisado){
      voiceAvisado = true;
      // Si tardó en abrir (se alcanzó a ver «Abriendo…»), una vibración avisa que ya se puede hablar.
      if(Date.now() - voiceTocado > VOICE_ABRIENDO_MS) try{ navigator.vibrate && navigator.vibrate(35); }catch(e){}
      showToast(voiceModoIA ? '🤖 Habla ahora: di tu pedido con tus palabras.' : '🎤 Habla ahora…', 2500);
    }
    // El tiempo de espera cuenta desde que de verdad escucha. Si la escucha se volvió a abrir a mitad del pedido (ya se
    // oyó algo), se mantiene la espera corta de silencio para no quedarse 6 s escuchando de más.
    if(!voiceFinalBuffer && !voiceInterim) scheduleVoiceSilenceStop(VOICE_INITIAL_TIMEOUT_MS);
  };
  voiceRecognizer.onerror = (e) => {
    clearTimeout(voiceAbriendoT);
    if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
    voiceListening = false;
    updateVoiceFabUI();
    if(e.error === 'no-speech'){
      if(!voiceFinalBuffer && !voiceInterim) showToast('No escuché nada. Intenta de nuevo.');
    } else if(e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      showToast('Necesitas dar permiso de micrófono para usar el comando por voz.');
    } else if(e.error !== 'aborted'){
      showToast('No se pudo reconocer el audio. Intenta de nuevo.');
    }
  };
  voiceRecognizer.onend = () => {
    clearTimeout(voiceAbriendoT); clearTimeout(voiceGuardiaT);
    if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
    if(!voiceListening && !voiceFinalBuffer && !voiceInterim){ updateVoiceFabUI(); return; }   // ya se cerró (vigilante)
    voiceListening = false;
    updateVoiceFabUI();
    const transcript = (voiceFinalBuffer.trim() || voiceInterim).trim();
    voiceFinalBuffer = ''; voiceInterim = '';
    if(transcript) handleVoiceTranscript(transcript);
  };
  return voiceRecognizer;
}

function startVoiceCommand(conIA){
  if(!micEnabled) return;
  voiceModoIA = !!conIA;
  if(data.products.length === 0){
    showToast('Primero agrega productos en la pestaña Productos.');
    return;
  }
  const rec = ensureVoiceRecognizer();
  if(!rec){
    showToast('Tu navegador no soporta comandos por voz. Prueba con Chrome en Android.');
    return;
  }
  // Otra escucha que quedó trabada (más de 30 s) no bloquea el botón: se suelta.
  if(voiceProductListening && Date.now() - (window.__vozProductoDesde || 0) > 30000) voiceProductListening = false;
  if(voiceListening && voiceTocado && Date.now() - voiceTocado > 35000) voiceForzarFin();
  if(voiceListening || voiceProductListening) return;
  rec.mantener = true; voiceParandoDesde = 0;
  // Si ORDEVA está hablando se calla: el micrófono abre YA, sin esperar a que termine (y no se oye a sí misma).
  try{ if(window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); }catch(e){}
  // «Hola ORDEVA» le pasa el micrófono que ya tiene abierto (en la APK no se cierra y se vuelve a abrir).
  try{ window.ventoHola && window.ventoHola.soltar(true); }catch(e){}
  try{
    voiceListening = true; voiceAvisado = false; voiceTocado = Date.now();
    voiceFinalBuffer = ''; voiceInterim = '';
    updateVoiceFabUI();                                              // el botón cambia a «escuchando» al instante
    try{ navigator.vibrate && navigator.vibrate(15); }catch(e){}    // y una vibración corta confirma el toque
    clearTimeout(voiceAbriendoT);
    if(window.VentoAndroid){
      // «Abriendo el micrófono…» solo si de verdad tarda; casi siempre ya está escuchando antes.
      voiceAbriendoT = setTimeout(() => { if(voiceListening && !voiceAvisado) showToast('⏳ Abriendo el micrófono…', 2500); }, VOICE_ABRIENDO_MS);
    } else showToast(conIA ? '🤖 Escuchando con IA… di tu pedido con tus palabras. Toca de nuevo para terminar.' : '🎤 Escuchando… ej: "mesa 1, 5 águilas", "agrega una mesa a nombre de Juan con dos póker", "deshacer". Di "comandos" para ver todos. Toca 🎤 de nuevo para terminar.');
    rec.start();
    scheduleVoiceSilenceStop(VOICE_INITIAL_TIMEOUT_MS);
    clearTimeout(voiceGuardiaT);
    voiceGuardiaT = setTimeout(() => { if(voiceListening) stopVoiceCommand(); }, 35000);   // tope de escucha
  }catch(e){
    clearTimeout(voiceAbriendoT);
    voiceListening = false;
    updateVoiceFabUI();
  }
}

/* Vigilante del micrófono: al parar, ORDEVA espera que Android avise «terminé». Si ese aviso no llega (el reconocedor del
   celular se trabó), el botón se quedaba en «escuchando» para siempre y tocarlo otra vez no hacía nada. Ahora, si en
   2,5 s no terminó (o se toca otra vez), se cierra a la fuerza y se anota lo que ya se oyó. Y nunca escucha más de 35 s. */
let voiceGuardiaT = null, voiceParandoDesde = 0;
function voiceForzarFin(){
  clearTimeout(voiceGuardiaT); voiceParandoDesde = 0;
  if(!voiceListening) return;
  try{ voiceRecognizer && voiceRecognizer.abort && voiceRecognizer.abort(); }catch(e){}
  if(!voiceListening) return;                         // abort ya avisó «terminé» y se anotó
  try{ voiceRecognizer && voiceRecognizer.onend && voiceRecognizer.onend({}); }catch(e){ voiceListening = false; updateVoiceFabUI(); }
}
function stopVoiceCommand(){
  if(!voiceListening) return;
  // Segundo toque mientras se está cerrando: se cierra ya.
  if(voiceParandoDesde && Date.now() - voiceParandoDesde > 600){ voiceForzarFin(); return; }
  voiceParandoDesde = Date.now();
  try{ if(voiceRecognizer) voiceRecognizer.stop(); }catch(e){}
  clearTimeout(voiceGuardiaT);
  voiceGuardiaT = setTimeout(voiceForzarFin, 2500);
}
window.ventoMicForzarFin = voiceForzarFin;

/* ---------- Manos libres: «Hola ORDEVA» ----------
   Con la app abierta, ORDEVA escucha sola: al oír «Hola ORDEVA» (u «Oye ORDEVA», «ORDEVA, …») hace lo que se le
   pide, igual que el botón del micrófono. Después de cada orden sigue atenta unos segundos, así se puede seguir
   hablando sin repetir «Hola ORDEVA». Se pausa mientras ORDEVA habla, mientras se usa el botón del micrófono, con la
   pantalla de entrada abierta o la app en segundo plano. Se prende y apaga en Ajustes (o diciendo «ORDEVA, deja de escuchar»). */
(function(){
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const KEY = 'vento-hola', ATENTO_MS = 9000;
  // Con saludo («hola/oye … vento») se aceptan los errores típicos del reconocedor; sin saludo solo «ORDEVA»/«Bento» al inicio.
  const WAKE = /^\s*(?:(?:hola|oye|ok|okey|ey|hey|ay)[\s,]+(?:vento|bento|viento|ventó|bentó|evento|ordeva|hordeva|or deva)|vento|bento|ordeva|hordeva)\b[\s,.:;!¡¿?-]*/i;
  let rec = null, corriendo = false, desde = 0, hechos = 0, atentoHasta = 0, fallos = 0, timer = null, gesto = !!window.VentoAndroid, ocupado = false;
  // Apagado de fábrica: escuchar todo el tiempo hacía que el micrófono se prendiera y apagara solo (y al tocar 🎤 se
  // perdía el comienzo de la frase). Quien lo quiera lo prende en ⚙️ Ajustes.
  const prendido = () => { try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; } };
  const A = window.VentoAndroid;
  function silencio(si){ try{ A && A.vozSilencio && A.vozSilencio(!!si); }catch(e){} }
  function puede(){
    if(!Ctor || !prendido() || !gesto || ocupado || document.hidden) return false;
    if(typeof micEnabled !== 'undefined' && !micEnabled) return false;
    if(typeof voiceListening !== 'undefined' && voiceListening) return false;
    // Otro micrófono de ORDEVA está escuchando («Producto por voz», el asistente o la libreta): no se le quita.
    try{ if(voiceProductListening) return false; }catch(e){}
    try{ if(asisRecOn) return false; }catch(e){}
    if(window.__lbMicOn) return false;
    try{ if(window.speechSynthesis && window.speechSynthesis.speaking) return false; }catch(e){}
    try{ if(typeof authUser !== 'undefined' && !authUser) return false; }catch(e){}
    const au = document.getElementById('authOverlay'); if(au && !au.hidden) return false;
    try{ if(!data || !data.products || !data.products.length) return false; }catch(e){ return false; }
    return true;
  }
  function pintar(){
    const w = document.getElementById('voiceFabWrap'); if(!w) return;
    w.classList.toggle('hola-on', prendido() && !!Ctor);
    w.classList.toggle('hola-atento', Date.now() < atentoHasta);
    const t = document.getElementById('holaVentoToggle'); if(t) t.checked = prendido();
  }
  function tono(){
    try{ navigator.vibrate && navigator.vibrate([30, 40, 30]); }catch(e){}
    try{ const C = window.AudioContext || window.webkitAudioContext; if(!C) return; const c = tono.c || (tono.c = new C()); const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(660, c.currentTime); o.frequency.linearRampToValueAtTime(990, c.currentTime + 0.12); g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.24); }catch(e){}
  }
  function crear(){
    const r = new Ctor(); r.lang = 'es-CO'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 5;
    r.onstart = () => { fallos = 0; };
    r.onresult = (e) => {
      for(let i = hechos; i < e.results.length; i++){
        const res = e.results[i]; if(!res || !res.isFinal) continue;
        hechos = i + 1; oir(res);
      }
    };
    r.onerror = (e) => {
      const er = e && e.error;
      if(er === 'not-allowed' || er === 'service-not-allowed'){ apagar(); showToast('🎙️ Para usar «Hola ORDEVA» permite el micrófono y vuelve a prenderlo en ⚙️ Ajustes.', 6000); return; }
      if(er !== 'no-speech' && er !== 'aborted') fallos++;
    };
    r.onend = () => { corriendo = false; silencio(false); seguir(fallos > 3 ? 5000 : 300); };
    return r;
  }
  function seguir(ms){ clearTimeout(timer); timer = setTimeout(arrancar, ms); }
  function arrancar(){
    clearTimeout(timer); pintar();
    if(!prendido()) return;
    if(corriendo && Date.now() - desde > 70000){ corriendo = false; try{ rec && rec.abort(); }catch(e){} }  // perro guardián
    if(corriendo) return;
    if(!puede()){ seguir(1500); return; }
    rec = rec || crear(); hechos = 0; corriendo = true; desde = Date.now(); silencio(true);
    try{ rec.start(); }catch(e){ corriendo = false; silencio(false); seguir(2000); }
  }
  // paraOtro: lo pide el botón 🎤. En la APK se le PASA la escucha abierta (rec.ceder) en vez de cerrarla y abrir otra.
  function soltar(paraOtro){ clearTimeout(timer); if(corriendo){ corriendo = false; try{ if(rec){ if(paraOtro && rec.ceder) rec.ceder(); else rec.abort(); } }catch(e){} } silencio(false); }
  function oir(res){
    const alts = []; for(let k = 0; k < res.length; k++) alts.push(String(res[k].transcript || ''));
    let cmd = null;
    for(const a of alts){ const m = a.match(WAKE); if(m){ cmd = a.slice(m[0].length).trim(); break; } }
    if(cmd === null){
      if(Date.now() >= atentoHasta) return;                      // conversación de fondo: no es para ORDEVA
      cmd = (typeof pickBestVoiceAlternative === 'function' ? pickBestVoiceAlternative(res) : alts[0]).trim();
      if(!cmd) return;
    }
    atentoHasta = Date.now() + ATENTO_MS; pintar(); setTimeout(pintar, ATENTO_MS + 50);
    if(!cmd){ tono(); showToast('🟣 Te escucho…', 2500); return; }
    if(/\b(deja de escuchar|apaga(te)? (el )?(manos libres|hola vento)|desactiva(te)? (el )?(manos libres|hola vento)|no escuches)\b/i.test(cmd)){ apagar(); showToast('🔕 «Hola ORDEVA» apagado. Préndelo en ⚙️ Ajustes cuando quieras.', 5000); return; }
    // Se suelta el micrófono mientras se hace la orden (y mientras ORDEVA responde en voz alta), luego vuelve a escuchar.
    ocupado = true; soltar();
    Promise.resolve().then(() => handleVoiceTranscript(cmd)).catch(() => {}).then(() => {
      setTimeout(() => { ocupado = false; atentoHasta = Date.now() + ATENTO_MS; pintar(); setTimeout(pintar, ATENTO_MS + 50); arrancar(); }, 500);
    });
  }
  function prender(){ try{ localStorage.setItem(KEY, '1'); }catch(e){} gesto = true; arrancar(); }
  function apagar(){ try{ localStorage.setItem(KEY, '0'); }catch(e){} soltar(); atentoHasta = 0; pintar(); }
  window.ventoHola = { prender, apagar, soltar, arrancar, activo: prendido, estado: () => ({ prendido: prendido(), corriendo, atento: Date.now() < atentoHasta }) };
  if(!Ctor) return;
  // En el navegador el micrófono solo se puede abrir después de tocar la pantalla una vez.
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if(!gesto){ gesto = true; seguir(400); } }, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if(document.hidden) soltar(); else seguir(500); });
  setTimeout(() => { pintar(); arrancar(); }, 2500);
})();

const voiceFabWrap = document.getElementById('voiceFabWrap');
const voiceFabTab = document.getElementById('voiceFabTab');
const micEnabledToggle = document.getElementById('micEnabledToggle');
(function(){ const t = document.getElementById('holaVentoToggle'); if(!t) return; try{ t.checked = localStorage.getItem('vento-hola') === '1'; }catch(e){} t.addEventListener('change', () => { if(!window.ventoHola) return; if(t.checked){ window.ventoHola.prender(); showToast('🟣 «Hola ORDEVA» prendido: di «Hola ORDEVA» y tu pedido.', 5000); } else window.ventoHola.apagar(); }); })();
if('speechSynthesis' in window){ window.speechSynthesis.onvoiceschanged = () => {}; }
let micEnabled = true;
let voiceFabWasHidden = false; // hidden state via the ✕ button, remembered while mic is disabled from settings

function setVoiceFabHidden(hidden, persist){
  voiceFabWasHidden = hidden;
  if(micEnabled){
    voiceFabWrap.style.display = hidden ? 'none' : '';
    voiceFabTab.classList.toggle('show', hidden);
  }
  if(persist) storageSet('voice-fab-hidden', hidden ? '1' : '0');
}

async function loadVoiceFabPref(){
  try{
    const res = await storageGet('voice-fab-hidden');
    setVoiceFabHidden(!!(res && res.value === '1'), false);
  }catch(e){}
}

function applyMicEnabled(enabled, persist){
  micEnabled = enabled;
  if(micEnabledToggle) micEnabledToggle.checked = enabled;
  if(!enabled){
    voiceFabWrap.style.display = 'none';
    voiceFabTab.classList.remove('show');
    if(voiceListening){
      if(voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
      voiceFinalBuffer = '';
      try{ voiceRecognizer && voiceRecognizer.abort(); }catch(e){}
      voiceListening = false;
      updateVoiceFabUI();
    }
  }else{
    voiceFabWrap.style.display = voiceFabWasHidden ? 'none' : '';
    voiceFabTab.classList.toggle('show', voiceFabWasHidden);
  }
  if(persist) storageSet('voice-mic-enabled', enabled ? '1' : '0');
}

async function loadMicEnabledPref(){
  try{
    const res = await storageGet('voice-mic-enabled');
    applyMicEnabled(!(res && res.value === '0'), false);
  }catch(e){}
}

if(micEnabledToggle){
  micEnabledToggle.addEventListener('change', () => {
    applyMicEnabled(micEnabledToggle.checked, true);
  });
}

document.getElementById('voiceFabCloseBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  setVoiceFabHidden(true, true);
});
voiceFabTab.addEventListener('click', () => setVoiceFabHidden(false, true));
loadVoiceFabPref();
loadMicEnabledPref();

/* ---------- Botón flotante: arrastrar por toda la pantalla ---------- */
function bottomBarHeight(){
  const tb = document.getElementById('tabbar');
  return (tb && getComputedStyle(tb).position === 'fixed') ? tb.offsetHeight + 8 : 0;
}
function clampFabPosition(left, top){
  // Si el botón todavía no se ha dibujado (offsetWidth/offsetHeight en 0), se usa su
  // tamaño real (56px) en vez de 0 — si no, el límite quedaba mal calculado y el
  // botón podía terminar colgando fuera de la pantalla o encima de otra cosa.
  const w = voiceFabWrap.offsetWidth || 56, h = voiceFabWrap.offsetHeight || 56;
  const maxLeft = Math.max(window.innerWidth - w, 0);
  const maxTop = Math.max(window.innerHeight - h - bottomBarHeight(), 0);
  return {
    left: Math.min(Math.max(left, 0), maxLeft),
    top: Math.min(Math.max(top, 0), maxTop)
  };
}

function placeFabAt(left, top){
  const pos = clampFabPosition(left, top);
  voiceFabWrap.style.left = pos.left + 'px';
  voiceFabWrap.style.top = pos.top + 'px';
  voiceFabWrap.style.right = 'auto';
  voiceFabWrap.style.bottom = 'auto';
}

var FAB_FIJO = false;   // v1.19.2: se puede mover otra vez (arrastre suave); ya nada lo mueve solo
async function loadVoiceFabPos(){
  if(FAB_FIJO){ try{ voiceFabWrap.style.left = voiceFabWrap.style.top = voiceFabWrap.style.right = voiceFabWrap.style.bottom = voiceFabWrap.style.transform = ''; voiceFabWrap.classList.remove('izq', 'snap', 'dragging'); await storageSet('voice-fab-pos', ''); }catch(e){} return; }
  try{
    const res = await storageGet('voice-fab-pos');
    if(res && res.value){
      const pos = JSON.parse(res.value);
      // Si la posición guardada no tiene ningún sentido para la pantalla de
      // ahora (por ejemplo, quedó de una pantalla mucho más grande, el
      // celular cambió de orientación, o algo la dejó con un número raro),
      // se ignora y el botón vuelve a su lugar de siempre en vez de
      // quedar "perdido" o encimado con otra cosa — así nunca se ve loco.
      const cabeEnPantalla = typeof pos.left === 'number' && typeof pos.top === 'number' &&
        isFinite(pos.left) && isFinite(pos.top) &&
        pos.left >= -10 && pos.top >= -10 &&
        pos.left <= window.innerWidth - 20 && pos.top <= window.innerHeight - 20;
      if(cabeEnPantalla){
        placeFabAt(pos.left, pos.top);
        voiceFabWrap.classList.toggle('izq', pos.left + 28 < window.innerWidth / 2);
      } else {
        try{ await storageSet('voice-fab-pos', ''); }catch(e){}
      }
    }
  }catch(e){}
}
loadVoiceFabPos();

/* Arrastre del micrófono, rehecho para que sea suave en Android:
   - Mientras se arrastra, el botón se mueve con «transform» (lo dibuja la tarjeta gráfica, sin
     recalcular la pantalla): sigue al dedo sin temblar ni ir a saltos.
   - Nunca se sale de la pantalla ni se mete debajo de la barra de abajo.
   - Al soltar se pega al borde más cercano con una animación corta, desde donde quedó (sin brincos).
   - Si la pantalla cambia de alto (la barra del navegador aparece/desaparece al hacer scroll, o el
     teclado), el botón NO se mueve: solo se acomoda si quedara por fuera. Antes se reacomodaba en
     cada cambio y parecía que se deslizaba solo. */
let fabDrag = null;
let fabJustDragged = false;
const FAB_DRAG_THRESHOLD = 8, FAB_M = 12;
function fabLim(w, h){
  return { x0: FAB_M, x1: Math.max(FAB_M, window.innerWidth - w - FAB_M), y0: FAB_M, y1: Math.max(FAB_M, window.innerHeight - h - bottomBarHeight() - FAB_M) };
}
const fabClamp = (v, a, b) => Math.min(Math.max(v, a), b);

/* v1.19: el micrófono queda FIJO en su esquina (abajo a la derecha, encima de la barra). Arrastrarlo
   causaba que se moviera y se deslizara solo en varios celulares: ahora no se mueve nunca. */
voiceFabWrap.addEventListener('pointerdown', (e) => {
  if(FAB_FIJO) return;
  if(e.button > 0) return;
  if(e.target.closest('#voiceFabCloseBtn')) return;
  if(e.target.closest('#voiceFabHelp')) return;
  const r = voiceFabWrap.getBoundingClientRect();
  fabDrag = { sx: e.clientX, sy: e.clientY, x: r.left, y: r.top, w: r.width || 56, h: r.height || 56, tx: 0, ty: 0, moved: false, pointerId: e.pointerId, raf: 0 };
  // La captura del dedo se pide SOLO cuando de verdad empieza a arrastrar: si se pedía desde el
  // primer toque, el «click» le llegaba al contenedor y no al micrófono.
});

window.addEventListener('pointermove', (e) => {
  if(!fabDrag || e.pointerId !== fabDrag.pointerId) return;
  const dx = e.clientX - fabDrag.sx, dy = e.clientY - fabDrag.sy;
  if(!fabDrag.moved && Math.hypot(dx, dy) < FAB_DRAG_THRESHOLD) return;
  e.preventDefault();
  if(!fabDrag.moved){
    fabDrag.moved = true;
    try{ voiceFabWrap.setPointerCapture(fabDrag.pointerId); }catch(err){}
    voiceFabWrap.classList.remove('snap');
    // Se fija exactamente donde está (left/top) y desde ahí se mueve con transform.
    voiceFabWrap.style.left = fabDrag.x + 'px'; voiceFabWrap.style.top = fabDrag.y + 'px';
    voiceFabWrap.style.right = 'auto'; voiceFabWrap.style.bottom = 'auto';
    voiceFabWrap.classList.add('dragging');
  }
  const L = fabLim(fabDrag.w, fabDrag.h);
  fabDrag.tx = fabClamp(fabDrag.x + dx, L.x0, L.x1) - fabDrag.x;
  fabDrag.ty = fabClamp(fabDrag.y + dy, L.y0, L.y1) - fabDrag.y;
  if(!fabDrag.raf) fabDrag.raf = requestAnimationFrame(() => {
    if(!fabDrag) return; fabDrag.raf = 0;
    voiceFabWrap.style.transform = 'translate3d(' + fabDrag.tx + 'px,' + fabDrag.ty + 'px,0)';
  });
}, { passive: false });

// Al soltar: queda donde se soltó y se desliza corto hasta el borde más cercano.
function fabPegarAlBorde(){
  const w = voiceFabWrap.offsetWidth || 56;
  const izq = voiceFabWrap.offsetLeft + w / 2 < window.innerWidth / 2;
  const L = fabLim(w, voiceFabWrap.offsetHeight || 56);
  voiceFabWrap.classList.toggle('izq', izq);
  voiceFabWrap.classList.add('snap');
  voiceFabWrap.style.left = (izq ? L.x0 : L.x1) + 'px';
  voiceFabWrap.style.top = fabClamp(voiceFabWrap.offsetTop, L.y0, L.y1) + 'px';
  setTimeout(() => voiceFabWrap.classList.remove('snap'), 280);
}

function endFabDrag(e){
  if(!fabDrag || (e && e.pointerId !== undefined && e.pointerId !== fabDrag.pointerId)) return;
  const d = fabDrag; fabDrag = null;
  if(d.raf) cancelAnimationFrame(d.raf);
  try{ voiceFabWrap.releasePointerCapture(d.pointerId); }catch(err){}
  if(!d.moved) return;
  // Evita que al soltar se active el micrófono (se apaga solo enseguida, por si no llega ningún «click»).
  fabJustDragged = true;
  setTimeout(() => { fabJustDragged = false; }, 350);
  // El transform se pasa a left/top en el mismo cuadro: no hay salto.
  voiceFabWrap.style.left = (d.x + d.tx) + 'px'; voiceFabWrap.style.top = (d.y + d.ty) + 'px';
  voiceFabWrap.style.transform = '';
  voiceFabWrap.classList.remove('dragging');
  void voiceFabWrap.offsetWidth;                        // el navegador toma la posición de partida
  requestAnimationFrame(() => {
    fabPegarAlBorde();
    const pos = { left: parseFloat(voiceFabWrap.style.left) || voiceFabWrap.offsetLeft, top: parseFloat(voiceFabWrap.style.top) || voiceFabWrap.offsetTop };
    storageSet('voice-fab-pos', JSON.stringify(pos));
  });
}
window.addEventListener('pointerup', endFabDrag);
window.addEventListener('pointercancel', endFabDrag);

// Solo se acomoda si la pantalla cambió de ancho (girar el celular) o si el botón quedaría por fuera.
let fabAncho = window.innerWidth;
window.addEventListener('resize', () => {
  if(fabDrag || !voiceFabWrap.style.left || voiceFabWrap.style.left === 'auto') return;
  const w = voiceFabWrap.offsetWidth || 56, h = voiceFabWrap.offsetHeight || 56, L = fabLim(w, h);
  const top = voiceFabWrap.offsetTop, cambioAncho = window.innerWidth !== fabAncho;
  fabAncho = window.innerWidth;
  if(!cambioAncho && top >= L.y0 && top <= L.y1) return;
  voiceFabWrap.style.left = (voiceFabWrap.classList.contains('izq') ? L.x0 : L.x1) + 'px';
  voiceFabWrap.style.top = fabClamp(top, L.y0, L.y1) + 'px';
});
// Si el botón quedó en un lugar incómodo, Ajustes → «Devolver a su lugar» lo regresa a su esquina.
function resetVoiceFabPos(){
  voiceFabWrap.style.left = voiceFabWrap.style.top = voiceFabWrap.style.right = voiceFabWrap.style.bottom = '';
  voiceFabWrap.classList.remove('izq');
  try{ storageSet('voice-fab-pos', ''); }catch(e){}
}
window.resetVoiceFabPos = resetVoiceFabPos;
/* Vigilante del micrófono: si está activado pero no se ve, se arregla solo.
   - Quedó por fuera de la pantalla o debajo de la barra de abajo (posición guardada de otra pantalla,
     teclado abierto, celular girado) → vuelve a su esquina.
   - Una ventana quedó marcada «abierta» pero ya no se ve (por ejemplo, se cerró a medias): eso
     escondía el micrófono por completo (se oculta mientras hay una ventana encima). Esa marca se limpia. */
function micVigilar(){
  try{
    if(!micEnabled || voiceFabWasHidden || fabDrag) return;
    // Solo se limpia si lleva más de 4 s invisible (así no se toca una ventana que se está abriendo con animación).
    document.querySelectorAll('.overlay.show:not(#overlay)').forEach(o => {
      const cs = getComputedStyle(o), r = o.getBoundingClientRect();
      const invisible = cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || r.width < 2 || r.height < 2;
      if(!invisible){ delete o.dataset.invDesde; return; }
      if(!o.dataset.invDesde) o.dataset.invDesde = String(Date.now());
      else if(Date.now() - Number(o.dataset.invDesde) > 4000){ o.classList.remove('show'); delete o.dataset.invDesde; }
    });
    if(document.querySelector('.overlay.show:not(#overlay)')) return;   // hay una ventana de verdad abierta: ahí sí se esconde
    if(voiceFabWrap.style.display === 'none') voiceFabWrap.style.display = '';
    // Solo si quedó DE VERDAD fuera de la pantalla (otra pantalla, celular girado) vuelve a su esquina.
    // Nada más lo mueve: antes también se reacomodaba cuando «parecía» tapado y eso lo hacía moverse solo.
    const r = voiceFabWrap.getBoundingClientRect();
    const fuera = r.width > 0 && (r.right < 24 || r.left > window.innerWidth - 24 || r.bottom < 24 || r.top > window.innerHeight - 24);
    if(fuera && !(voiceFabWrap.classList.contains('dragging'))){ voiceFabWrap.style.transform = ''; resetVoiceFabPos(); }
  }catch(e){}
}
setInterval(micVigilar, 2000);
window.addEventListener('resize', () => setTimeout(micVigilar, 300));
document.addEventListener('visibilitychange', () => { if(!document.hidden) setTimeout(micVigilar, 300); });
setTimeout(micVigilar, 1500);
{ const rb = document.getElementById('voiceFabResetBtn'); if(rb) rb.addEventListener('click', () => { resetVoiceFabPos(); showToast('✅ El botón del micrófono volvió a su lugar.'); }); }

document.getElementById('voiceFab').addEventListener('click', () => {
  if(fabJustDragged){ fabJustDragged = false; return; }
  if(voiceListening){ stopVoiceCommand(); return; }
  startVoiceCommand(false);
});
document.getElementById('voiceFabAI').addEventListener('click', () => {
  if(fabJustDragged){ fabJustDragged = false; return; }
  if(voiceListening){ stopVoiceCommand(); return; }
  if(!hasAIKey()){ showToast('⚠️ Conecta la IA primero (⚙️ Configurar IA).'); try{ openAIConfigDialog(); }catch(e){} return; }
  startVoiceCommand(true);
});
document.getElementById('voiceFabHelp').addEventListener('click', () => { if(fabJustDragged){ fabJustDragged = false; return; } voiceAyuda(); });
function voiceAIBtnSync(){ const b = document.getElementById('voiceFabAI'); if(b) b.hidden = !voiceAiOn(); }

/* ---------- Navigation ---------- */
document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('section').forEach(s=>s.classList.remove('active'));
    const vista = VISTA_UNIDA[btn.dataset.view] || btn.dataset.view;
    document.getElementById('view-' + vista).classList.add('active');
    if(vista === 'inventario') renderInventario();
    if(btn.dataset.view === 'historial') renderHistorial();
    if(btn.dataset.view === 'inventario') renderInventario();
    if(btn.dataset.view === 'carta') renderCarta();
    if(btn.dataset.view === 'estadisticas') renderStats();
    if(btn.dataset.view === 'contabilidad' && typeof renderConta === 'function') renderConta();
    if(btn.dataset.view === 'cocina') renderCocina();
  });
});

/* ---------- Menú "Más" (celular) y estado de la barra de abajo ---------- */
// Productos e inventario quedaron en una sola pantalla: cualquier atajo a «productos» abre esa.
const VISTA_UNIDA = { productos: 'inventario' };
const navMoreSheet = document.getElementById('navMoreSheet');
let navCurrentView = 'mesas';
function syncNavMore(){
  const active = document.querySelector('nav button.active');
  const view = active ? active.dataset.view : '';
  document.getElementById('navMoreBtn').classList.toggle('active', !!(active && active.classList.contains('nav-extra')));
  navMoreSheet.querySelectorAll('.more-tile[data-go]').forEach(t => t.classList.toggle('active', t.dataset.go === view));
}
document.querySelectorAll('nav button').forEach(btn => btn.addEventListener('click', () => {
  const view = btn.dataset.view;
  // Con la barra abajo se puede cambiar de sección estando a mitad de página:
  // la nueva sección arranca desde arriba, y Ajustes vuelve a su menú de categorías.
  if(view !== navCurrentView){
    window.scrollTo({ top: 0 });
    if(view === 'ajustes' && typeof volverACategoriasAjustes === 'function') volverACategoriasAjustes();
  }
  navCurrentView = view;
  navMoreSheet.classList.remove('show');
  syncNavMore();
}));
document.getElementById('navMoreBtn').addEventListener('click', () => { syncNavMore(); navMoreSheet.classList.add('show'); });
// Cerrar sesión: guarda todo, pregunta y vuelve a pedir usuario y contraseña. Los datos del negocio no se borran.
async function cerrarSesion(){
  const ok = await showConfirm({ title: '¿Cerrar sesión?', message: 'Tus datos quedan guardados. Para volver a entrar te pedirá usuario y contraseña (así puede entrar otra persona con su propio usuario).', confirmText: 'Sí, cerrar sesión', icon: '🚪' });
  if(!ok) return;
  try{ saveData(); }catch(e){}
  localStorage.removeItem(AUTH_SESSION_KEY);
  location.reload();
}
window.cerrarSesion = cerrarSesion;
// «Cerrar sesión» desde los avisos de la suscripción (cancelada, vencida, sin pagar): sin preguntar otra vez (el botón
// ya lo dice), guarda todo, cierra también la sesión de la cuenta de ORDEVA en este celular y vuelve a la entrada,
// donde se puede entrar con otra cuenta. Los datos no se borran.
window.ventoSalir = async function(){
  try{ saveData(); }catch(e){}
  try{ if(window.ventoNube && window.ventoNube.salir) await Promise.race([window.ventoNube.salir(), new Promise(r => setTimeout(r, 4000))]); }catch(e){}
  try{ localStorage.removeItem(AUTH_SESSION_KEY); }catch(e){}
  location.reload();
};
navMoreSheet.addEventListener('click', e => {
  if(e.target === navMoreSheet){ navMoreSheet.classList.remove('show'); return; }
  const tile = e.target.closest('.more-tile[data-go]');
  if(!tile) return;
  navMoreSheet.classList.remove('show');
  if(tile.dataset.go === 'ia'){ document.getElementById('asisFab').click(); return; }
  if(tile.dataset.go === 'libreta'){ if(window.libretaAbrir) window.libretaAbrir(); return; }
  if(tile.dataset.go === 'pagos'){ if(window.pagosAbrirPanel) window.pagosAbrirPanel(); return; }
  if(tile.dataset.go === 'calculadora'){ if(window.calculadoraAbrir) window.calculadoraAbrir(); return; }
  if(tile.dataset.go === 'plan'){ try{ subPaywall(''); }catch(e){} return; }   // menú de suscripción siempre a mano (no solo desde la barra)
  if(tile.dataset.go === 'salir'){ cerrarSesion(); return; }
  if(tile.dataset.go === 'reportar'){ if(window.ventoReportarProblema) window.ventoReportarProblema(); else showToast('Escríbenos en Ajustes → Guía y soporte.'); return; }
  const b = document.querySelector('nav button[data-view="' + tile.dataset.go + '"]');
  if(b) b.click();
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') navMoreSheet.classList.remove('show'); });

/* ---------- Business name ---------- */
const brandInput = document.getElementById('brandName');
brandInput.addEventListener('blur', ()=>{
  data.businessName = brandInput.value.trim() || 'Cervecería';
  brandInput.value = data.businessName;
  saveData();
});

/* ---------- Table count ---------- */
// Se configura una sola vez, así que queda escondido detrás de un botón.
document.getElementById('tableCountToggle').addEventListener('click', ()=>{
  const row = document.getElementById('tableCountRow');
  row.hidden = !row.hidden;
  if(!row.hidden) document.getElementById('tableCountInput').focus();
});
// Mesas o Cuentas (solo comida y bebida). Se recarga para que todos los textos cambien de palabra.
// Nombre de la unidad de atención (Ajustes → Cuenta y negocio). Se recarga para que todos los textos ya
// escritos cambien de palabra (igual que al elegir Mesas o Cuentas).
function iniUnidadNombre(){
  const sel = document.getElementById('unidadSel'); if(!sel || sel.dataset.ok) return; sel.dataset.ok = '1';
  const otro = document.getElementById('unidadOtro'), sg = document.getElementById('unidadSg'), pl = document.getElementById('unidadPl');
  const pintar = () => {
    const tipo = (ESPACIOS[(data && data.businessType) || ''] || ['Mesa', 'Mesas'])[1];
    sel.innerHTML = '<option value="">Según el tipo de negocio (' + tipo + ')</option>' + UNIDAD_PRESETS.map((x, i) => '<option value="' + i + '">' + x[1] + '</option>').join('') + '<option value="otro">Otro nombre…</option>';
    const u = data && data.unidad;
    if(!u || !u.sg){ sel.value = ''; otro.hidden = true; return; }
    const i = UNIDAD_PRESETS.findIndex(x => x[0] === u.sg && x[1] === u.pl);
    if(i >= 0){ sel.value = String(i); otro.hidden = true; } else { sel.value = 'otro'; otro.hidden = false; sg.value = u.sg; pl.value = u.pl || ''; }
  };
  const aplicar = u => {
    if(u) data.unidad = u; else delete data.unidad;
    if(u) delete data.atencion;
    saveData();
    showToast('✅ Ahora se llaman «' + getServiceUnitNamePlural() + '». Actualizo la pantalla…');
    setTimeout(() => location.reload(), 900);
  };
  sel.onchange = () => {
    if(sel.value === 'otro'){ otro.hidden = false; sg.focus(); return; }
    otro.hidden = true;
    if(sel.value === '') return aplicar(null);
    const x = UNIDAD_PRESETS[+sel.value]; aplicar({ sg: x[0], pl: x[1], ic: x[2], g: x[3] });
  };
  const libre = () => { const a = sg.value.replace(/[<>"]/g, '').trim().slice(0, 24), b = pl.value.replace(/[<>"]/g, '').trim().slice(0, 26);
    if(a) aplicar({ sg: a, pl: b || (/[aeiouáéó]$/i.test(a) ? a + 's' : a + 'es'), ic: '📍', g: 'm' }); };
  sg.onchange = () => { if(pl.value.trim()) libre(); }; pl.onchange = libre;
  pintar();
}
document.addEventListener('click', e => { if(e.target.closest('.ajustes-cat[data-cat="negocio"]')) setTimeout(iniUnidadNombre, 60); });
setTimeout(() => { try{ iniUnidadNombre(); }catch(e){} }, 3000);
function pintarAtencion(){
  const box = document.getElementById('atencionSel'); if(!box) return;
  box.hidden = !puedeElegirMesas();
  const actual = espacio()[0] === 'Cuenta' ? 'cuenta' : 'mesa';
  box.querySelectorAll('[data-at]').forEach(b => b.classList.toggle('on', b.dataset.at === actual));
}
document.getElementById('atencionSel').addEventListener('click', e => {
  const b = e.target.closest('[data-at]'); if(!b || !puedeElegirMesas()) return;
  const actual = espacio()[0] === 'Cuenta' ? 'cuenta' : 'mesa'; if(b.dataset.at === actual) return;
  data.atencion = b.dataset.at; saveData();
  showToast(b.dataset.at === 'cuenta' ? '🧾 Listo: ahora atiendes por Cuentas (las cuentas abiertas no cambian).' : '🍽️ Listo: ahora atiendes por Mesas (las cuentas abiertas no cambian).');
  setTimeout(() => location.reload(), 900);
});
document.getElementById('tableCountToggle').addEventListener('click', pintarAtencion);
document.getElementById('applyTableCount').addEventListener('click', ()=>{
  const n = parseInt(document.getElementById('tableCountInput').value, 10);
  if(!n || n < 1) return;
  const current = Object.keys(data.tables).map(Number);
  const toRemove = current.filter(id => id > n);
  const withOpenTabs = toRemove.filter(id => data.tables[id].items && data.tables[id].items.length);
  if(withOpenTabs.length){
    if(!confirm('Las mesas ' + withOpenTabs.join(', ') + ' tienen cuentas abiertas. ¿Reducir igual las mesas? Esas cuentas pasan al historial (lo no pagado, como deuda).')) return;
  }
  toRemove.forEach(id => { try{ closeTableToHistory(id); }catch(e){} delete data.tables[id]; });
  for(let i=1;i<=n;i++){
    if(!data.tables[i]) data.tables[i] = { items: [], people: [] };
  }
  data.tableCount = n;
  saveData();
  renderMesas();
});

/* ---------- Pantalla de cocina (KDS) ----------
   No duplica los datos de las mesas: lee data.tables directamente y usa un
   pequeño "acuse" en localStorage (por mesa, con una firma del pedido) para
   saber qué tickets ya se marcaron como listos, sin tocar la cuenta real.
   También muestra los pedidos que llegan por el QR (pedido.html) o WhatsApp
   y aún no se han despachado a la mesa, reutilizando esa misma cola. */
function kdsSig(id){
  const t = data.tables[id];
  if(!t || !t.items || !t.items.length) return '';
  return t.items.map(it => it.name + '×' + it.qty).join('|');
}
function kdsAckMap(){
  try{ return JSON.parse(localStorage.getItem('vito_kds_ack')) || {}; }catch(e){ return {}; }
}
function kdsSetAck(id, sig){
  const m = kdsAckMap();
  if(sig) m[id] = sig; else delete m[id];
  try{ localStorage.setItem('vito_kds_ack', JSON.stringify(m)); }catch(e){}
}
function kdsPend(){
  try{ return JSON.parse(localStorage.getItem('vito_pedidos_pend')) || []; }catch(e){ return []; }
}
function renderCocina(){
  const wrap = document.getElementById('kdsTickets');
  if(!wrap || typeof data === 'undefined' || !data) return;
  const P = window.vitoPedidos, ahora = Date.now();
  const lista = P ? P.lista() : [];
  const activos = lista.filter(p => ['nuevo', 'recibido', 'preparacion', 'listo'].includes(p.estado));
  const SIG = { nuevo: ['✅ Aceptar', 'recibido'], recibido: ['👩‍🍳 En preparación', 'preparacion'], preparacion: ['🔔 Listo', 'listo'], listo: ['🍽️ Entregado', 'entregado'] };
  const min = p => Math.max(0, Math.round((ahora - (p.recibidoEn || p.at)) / 6e4));
  const ticket = p => {
    const tarde = p.estado !== 'listo' && min(p) >= 15;
    return '<div class="kds-ticket e-' + p.estado + (tarde ? ' tarde' : '') + '" data-pid="' + invEsc(p.id) + '">' +
      '<div class="kds-ticket-h">' + invEsc(window.vitoGrupos ? window.vitoGrupos.etiquetaDe(p.mesa) : tableLabel(p.mesa)) + (window.vitoGrupos && window.vitoGrupos.de(p.mesa) ? ' <small>(de ' + invEsc(tableLabel(p.mesa)) + ')</small>' : '') + '</div>' +
      (p.sinCodigo && p.estado === 'nuevo' ? '<div class="kds-nota" style="border-color:#f59e0b">⚠️ Sin el código del QR de la mesa: confirma con la mesa antes de aceptarlo</div>' : '') +
      '<div class="kds-meta"><span>' + (p.origen === 'qr' ? '📱 QR' : p.origen === 'whatsapp' ? '💬 WhatsApp' : '🧑‍🍳 ' + invEsc(String(p.origen || '').replace(/^mesero:/, ''))) + '</span><b>' + (min(p) ? 'hace ' + min(p) + ' min' : 'ahora') + '</b></div>' +
      '<div class="kds-items">' + p.items.map(it => '<div class="kds-item">' + it.qty + '× ' + invEsc(it.name) + (it.ok ? '' : ' ⚠️') + '</div>').join('') + '</div>' +
      (p.nota ? '<div class="kds-nota">📝 ' + invEsc(p.nota) + '</div>' : '') +
      '<div class="kds-act"><button type="button" class="btn-warn" data-e="' + SIG[p.estado][1] + '">' + i18nPut(SIG[p.estado][0]) + '</button>' +
      '<button type="button" class="btn-ghost kds-x" data-e="cancelado" title="Cancelar pedido">✕</button></div></div>';
  };
  const col = (e, titulo) => { const l = activos.filter(p => p.estado === e).sort((x, y) => (x.recibidoEn || x.at) - (y.recibidoEn || y.at));
    return l.length ? '<div class="kds-col-h">' + titulo + ' <i>' + l.length + '</i></div>' + l.map(ticket).join('') : ''; };
  const entregados = lista.filter(p => p.estado === 'entregado' && ahora - (p.hist[p.hist.length - 1] || {}).at < 6 * 36e5).slice(-10).reverse();
  // Lo que se anota a mano en las cuentas sigue visible abajo, como antes.
  const ack = kdsAckMap();
  const tIds = Object.keys(data.tables).map(Number).filter(id => data.tables[id].items && data.tables[id].items.length).sort((a,b)=>a-b);
  const mesas = tIds.map(id => { const t = data.tables[id], sig = kdsSig(id), isAck = ack[id] === sig;
    return '<div class="kds-ticket' + (isAck ? ' kds-ack' : '') + '"><div class="kds-ticket-h">' + invEsc(tableLabel(id)) + '</div><div class="kds-items">' +
      t.items.map(it => '<div class="kds-item">' + it.qty + '× ' + invEsc(it.name) + (it.size ? ' (' + invEsc(it.size) + ')' : '') + '</div>').join('') + '</div>' +
      '<button type="button" class="btn-ghost kds-ack-btn" data-tid="' + id + '">' + (isAck ? i18nPut('↩️ Reabrir') : i18nPut('✅ Visto')) + '</button></div>'; }).join('');
  const html = col('nuevo', '🆕 Por aceptar') + col('recibido', '📥 Recibidos') + col('preparacion', '👩‍🍳 En preparación') + col('listo', '🔔 Listos para entregar');
  wrap.innerHTML = (html || '<div class="kds-empty">' + i18nPut('No hay pedidos pendientes en ' + prepNombre() + '. 🎉') + '</div>') +
    (entregados.length ? '<details class="kds-ent"><summary>🍽️ Entregados hoy (' + entregados.length + ')</summary><div class="kds-grid">' + entregados.map(p => '<div class="kds-ticket kds-ack"><div class="kds-ticket-h">' + invEsc(tableLabel(p.mesa)) + '</div><div class="kds-items">' + p.items.map(i => i.qty + '× ' + invEsc(i.name)).join('<br>') + '</div></div>').join('') + '</div></details>' : '') +
    (mesas ? '<details class="kds-ent"><summary>🧾 Cuentas abiertas (' + tIds.length + ')</summary><div class="kds-grid">' + mesas + '</div></details>' : '');
  const badge = document.getElementById('kdsBadge');
  if(badge){ const n = activos.filter(p => p.estado !== 'listo').length; badge.textContent = n ? String(n) : ''; }
}
const kdsTicketsEl = document.getElementById('kdsTickets');
if(kdsTicketsEl){
  kdsTicketsEl.addEventListener('click', async e => {
    const ackBtn = e.target.closest('.kds-ack-btn');
    if(ackBtn){
      const id = ackBtn.dataset.tid, cur = kdsAckMap();
      if(cur[id] === kdsSig(id)) kdsSetAck(id, null); else kdsSetAck(id, kdsSig(id));
      renderCocina(); return;
    }
    const b = e.target.closest('[data-e]'), tk = e.target.closest('[data-pid]');
    if(!b || !tk || !window.vitoPedidos) return;
    if(b.dataset.e === 'cancelado' && !(await showConfirm({ title: 'Cancelar pedido', message: '¿Cancelar este pedido? Si ya estaba en la cuenta, se descuenta.', confirmText: 'Sí, cancelar', cancelText: 'No', icon: '✕' }))) return;
    window.vitoPedidos.cambiar(tk.dataset.pid, b.dataset.e);
    renderCocina();
  });
}
setInterval(renderCocina, 5000);
setTimeout(renderCocina, 1200);

/* ---------- Calculadoras rápidas (Ajustes) ---------- */
(function(){
  const tabs = document.getElementById('calcTabs');
  if(!tabs) return;
  tabs.addEventListener('click', e => {
    const b = e.target.closest('.calc-tab-btn');
    if(!b) return;
    tabs.querySelectorAll('.calc-tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('calc' + b.dataset.calc.charAt(0).toUpperCase() + b.dataset.calc.slice(1));
    if(panel) panel.classList.add('active');
  });

  /* Dígito de verificación del NIT (algoritmo oficial DIAN) */
  function nitDv(nitRaw){
    const nit = String(nitRaw || '').replace(/\D/g, '');
    if(!nit) return null;
    const pesos = [3,7,13,17,19,23,29,37,41,43,47,53,59,67,71];
    let suma = 0;
    for(let i = 0; i < nit.length; i++){
      const digito = parseInt(nit[nit.length - 1 - i], 10);
      const peso = pesos[i];
      if(peso === undefined) break;
      suma += digito * peso;
    }
    const resto = suma % 11;
    return (resto === 0 || resto === 1) ? resto : 11 - resto;
  }
  const nitBtn = document.getElementById('calcNitBtn'), nitIn = document.getElementById('calcNitInput'), nitRes = document.getElementById('calcNitResult');
  function runNit(){
    const nit = (nitIn.value || '').replace(/\D/g, '');
    if(!nit){ nitRes.innerHTML = 'Escribe el NIT (sin el dígito de verificación).'; return; }
    const dv = nitDv(nit);
    nitRes.innerHTML = 'NIT: <b>' + nit + '-' + dv + '</b><br>Dígito de verificación: <b>' + dv + '</b>';
  }
  if(nitBtn){ nitBtn.onclick = runNit; nitIn.addEventListener('keydown', e => { if(e.key === 'Enter') runNit(); }); nitIn.addEventListener('input', runNit); }

  /* Descuento */
  const descPrecio = document.getElementById('calcDescPrecio'), descPct = document.getElementById('calcDescPct'), descRes = document.getElementById('calcDescResult');
  function runDesc(){
    const precio = parseFloat(descPrecio.value), pct = parseFloat(descPct.value);
    if(!isFinite(precio) || precio <= 0 || !isFinite(pct) || pct < 0){ descRes.innerHTML = 'Escribe el precio original y el % de descuento.'; return; }
    const ahorro = Math.round(precio * (pct / 100));
    const final = Math.round(precio - ahorro);
    descRes.innerHTML = 'Precio final: <b>$' + final.toLocaleString('es-CO') + '</b><br>Ahorro: $' + ahorro.toLocaleString('es-CO');
  }
  if(descPrecio){ [descPrecio, descPct].forEach(el => el.addEventListener('input', runDesc)); }

  /* Prima de servicios / bonificación proporcional */
  const primaSal = document.getElementById('calcPrimaSalario'), primaDias = document.getElementById('calcPrimaDias'), primaRes = document.getElementById('calcPrimaResult');
  function runPrima(){
    const sal = parseFloat(primaSal.value), dias = parseFloat(primaDias.value);
    if(!isFinite(sal) || sal <= 0 || !isFinite(dias) || dias <= 0){ primaRes.innerHTML = 'Escribe el salario (con auxilio de transporte si aplica) y los días trabajados en el semestre.'; return; }
    const d = Math.min(dias, 180);
    const prima = Math.round((sal * d) / 360);
    primaRes.innerHTML = 'Valor a pagar: <b>$' + prima.toLocaleString('es-CO') + '</b><br>Fórmula: (salario × días) ÷ 360.';
  }
  if(primaSal){ [primaSal, primaDias].forEach(el => el.addEventListener('input', runPrima)); }

  /* Retención en la fuente por ICA */
  const reteValor = document.getElementById('calcReteicaValor'), reteTarifa = document.getElementById('calcReteicaTarifa'), reteRes = document.getElementById('calcReteicaResult');
  function runReteica(){
    const valor = parseFloat(reteValor.value), tarifa = parseFloat(reteTarifa.value);
    if(!isFinite(valor) || valor <= 0 || !isFinite(tarifa) || tarifa < 0){ reteRes.innerHTML = 'Escribe el valor del pago y la tarifa por mil.'; return; }
    const retencion = Math.round(valor * (tarifa / 1000));
    reteRes.innerHTML = 'Retención a practicar: <b>$' + retencion.toLocaleString('es-CO') + '</b><br>Valor neto a pagar: $' + Math.round(valor - retencion).toLocaleString('es-CO');
  }
  if(reteValor){ [reteValor, reteTarifa].forEach(el => el.addEventListener('input', runReteica)); }
})();

/* ---------- Render: Mesas ---------- */
function renderMesasSummary(){
  const el = document.getElementById('mesasSummary');
  if(!el) return;
  const ids = Object.keys(data.tables).map(Number);
  const abiertas = ids.filter(id => (data.tables[id].items || []).length);
  const porCobrar = abiertas.reduce((s, id) => s + tableBalance(id), 0);
  const libres = ids.length - abiertas.length;
  const tr = s => { try{ return i18nPut(s); }catch(e){ return s; } };
  el.innerHTML =
    '<div class="ms-item ms-free"><b>' + libres + '</b><span>' + tr(libres === 1 ? 'libre' : 'libres') + '</span></div>' +
    '<div class="ms-item ms-open"><b>' + abiertas.length + '</b><span>' + tr(abiertas.length === 1 ? 'abierta' : 'abiertas') + '</span></div>' +
    '<div class="ms-item"><b>' + fmt(porCobrar) + '</b><span>' + tr('por cobrar') + '</span></div>';
}
function renderMesas(){
  document.getElementById('tableCountInput').value = data.tableCount;
  renderMesasSummary();
  if(data.tableViewMode === 'map'){
    renderFloorPlan();
  } else {
    renderMesasList();
  }
}

function renderMesasList(){
  const grid = document.getElementById('tableGrid');
  grid.innerHTML = '';
  const ids = Object.keys(data.tables).map(Number).sort((a,b)=>a-b);
  ids.forEach(id=>{
    const t = data.tables[id];
    const total = tableTotal(id);
    const paid = tablePaid(id);
    const balance = tableBalance(id);
    const isOpen = t.items && t.items.length > 0;
    const card = document.createElement('button');
    card.className = 'ticket' + (isOpen ? ' open' : '');
    let subLine = 'Sin cuenta abierta';
    if(isOpen){
      const units = t.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
      subLine = units + (units===1?' producto':' productos');
      if(paid > 0) subLine += ' · abonado ' + fmt(paid);
      if((t.people || []).length){ try{ const e = mesaEstado(id); if(e.partes > 1) subLine += ' · 👥 ' + e.pagaron + '/' + e.partes + ' pagaron'; }catch(x){} }
    }
    card.innerHTML = `
      <div class="num"><svg class="tk-ic" viewBox="0 0 24 24" aria-hidden="true">${iconoEsp()}</svg>${tableLabel(id)}</div>
      <div class="status ${isOpen ? '' : 'empty'}">${isOpen ? fmt(balance) : 'Vacía'}</div>
      <div class="items-count">${subLine}</div>
      ${window.vitoGrupos && window.vitoGrupos.de(id) ? '<div class="grp-tag">🔗 ' + invEsc(window.vitoGrupos.etiqueta(window.vitoGrupos.de(id))) + ' · ' + fmt(window.vitoGrupos.total(window.vitoGrupos.de(id))) + '</div>' : ''}
    `;
    card.addEventListener('click', ()=> openTableModal(id));
    grid.appendChild(card);
  });
}

/* ---------- Mapa del local: ubicar mesas libremente ---------- */
let layoutEditing = false;

const TABLE_SHAPES = {
  redonda:   { label: 'Mesa redonda',      icon: '☕', class: 'shape-redonda' },
  cuadrada:  { label: 'Mesa cuadrada',     icon: '🍽️', class: 'shape-cuadrada' },
  sombrilla: { label: 'Mesa con sombrilla',icon: '⛱️', class: 'shape-sombrilla' },
  barra:     { label: 'Barra / mostrador', icon: '🍹', class: 'shape-barra' },
  sofa:      { label: 'Sofá / lounge',     icon: '🛋️', class: 'shape-sofa' },
  silla:     { label: 'Silla',             icon: '🪑', class: 'shape-silla' },
  banca:     { label: 'Banca',             icon: '🪑', class: 'shape-banca' },
  banco:     { label: 'Banco',             icon: '🪵', class: 'shape-banco' },
  camara:    { label: 'Cámara',            icon: '📷', class: 'shape-camara' },
  circulo:   { label: 'Círculo',            icon: '⭕', class: 'shape-circulo' },
  caja:      { label: 'Caja / caja registradora', icon: '🧾', class: 'shape-caja' },
  bano:      { label: 'Baño',               icon: '🚻', class: 'shape-bano' },
  entrada:   { label: 'Entrada',            icon: '🚪', class: 'shape-entrada' },
  cocina:    { label: 'Cocina',             icon: '🍳', class: 'shape-cocina' },
  billar:    { label: 'Mesa de billar',     icon: '🎱', class: 'shape-billar' },
  cancha:    { label: 'Cancha',             icon: '⚽', class: 'shape-cancha' },
  consola:   { label: 'Consola / estación', icon: '🎮', class: 'shape-consola' },
  cama:      { label: 'Cama / habitación',  icon: '🛏️', class: 'shape-cama' },
  puesto:    { label: 'Puesto / parqueo',   icon: '🚗', class: 'shape-puesto' }
};
// Cada negocio ve primero las figuras que le sirven: un billar, sus mesas de billar;
// una cancha sintética, sus canchas; un hotel, sus camas.
const SHAPES_NEGOCIO = { billar:['billar','mesa'], tejo:['cancha','billar'], cancha:['cancha'], bolera:['cancha'], videojuegos:['consola'],
  cafe_internet:['consola'], hotel:['cama'], motel:['cama'], hostal:['cama'], apartamentos:['cama'], parqueadero:['puesto'],
  mecanico:['puesto'], lavadero:['puesto'], montallantas:['puesto'], barberia:['silla'], salon_belleza:['silla'], manicure:['silla'],
  estetica:['cama'], tatuajes:['cama'], consultorio:['cama'], fisioterapia:['cama'], veterinaria:['cama'] };
function shapesDelNegocio(){
  const pref = SHAPES_NEGOCIO[(typeof data !== 'undefined' && data && data.businessType) || ''] || [];
  const claves = Object.keys(TABLE_SHAPES);
  return pref.filter(k => TABLE_SHAPES[k]).concat(claves.filter(k => !pref.includes(k)));
}

function ensureFloorPositions(){
  const ids = Object.keys(data.tables).map(Number).sort((a,b)=>a-b);
  const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
  const rows = Math.max(1, Math.ceil(ids.length / cols));
  ids.forEach((id, idx)=>{
    const t = data.tables[id];
    if(typeof t.mapX !== 'number' || typeof t.mapY !== 'number'){
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      t.mapX = ((col + 0.5) / cols) * 100;
      t.mapY = ((row + 0.5) / rows) * 100;
    }
    if(!t.shape || !TABLE_SHAPES[t.shape]) t.shape = shapesDelNegocio()[0] || 'redonda';
  });
}

function renderFloorPlan(){
  ensureFloorPositions();
  const plan = document.getElementById('floorPlan');
  plan.innerHTML = '';
  const ids = Object.keys(data.tables).map(Number).sort((a,b)=>a-b);
  ids.forEach(id=>{
    const t = data.tables[id];
    const isOpen = t.items && t.items.length > 0;
    const balance = tableBalance(id);
    const shapeInfo = TABLE_SHAPES[t.shape] || TABLE_SHAPES.redonda;
    const el = document.createElement('div');
    el.className = 'floor-table ' + shapeInfo.class + (isOpen ? ' open' : '') + (layoutEditing ? ' editing' : '') + (t.photo ? ' has-photo' : '');
    el.style.left = t.mapX + '%';
    el.style.top = t.mapY + '%';
    const iconHtml = t.photo ? `<img class="ft-photo" src="${t.photo}" alt="">` : `<div class="ft-icon">${shapeInfo.icon}</div>`;
    el.innerHTML = `
      ${iconHtml}
      <div class="ft-label">
        <div class="ft-name">${tableLabel(id)}</div>
        <div class="ft-status">${isOpen ? fmt(balance) : 'Vacía'}</div>
      </div>
    `;
    attachFloorDrag(el, id);
    plan.appendChild(el);
  });
}

function attachFloorDrag(el, id){
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, startLeftPct = 0, startTopPct = 0;
  const plan = document.getElementById('floorPlan');

  const moveAt = (clientX, clientY) => {
    const rect = plan.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    const dxPct = ((clientX - startX) / rect.width) * 100;
    const dyPct = ((clientY - startY) / rect.height) * 100;
    if(Math.abs(dxPct) > 0.8 || Math.abs(dyPct) > 0.8) moved = true;
    const shape = TABLE_SHAPES[data.tables[id].shape] || TABLE_SHAPES.redonda;
    const halfW = Math.min(12, ((parseFloat(getComputedStyle(el).width)||72)/rect.width)*50);
    const halfH = Math.min(12, ((parseFloat(getComputedStyle(el).height)||72)/rect.height)*50);
    const newX = Math.min(100-halfW, Math.max(halfW, startLeftPct + dxPct));
    const newY = Math.min(100-halfH, Math.max(halfH, startTopPct + dyPct));
    el.style.left = newX + '%';
    el.style.top = newY + '%';
    data.tables[id].mapX = newX;
    data.tables[id].mapY = newY;
  };

  el.addEventListener('pointerdown', (e)=>{
    if(!layoutEditing) return;
    e.stopPropagation();
    dragging = true;
    moved = false;
    el.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    startLeftPct = Number(data.tables[id].mapX) || 50;
    startTopPct = Number(data.tables[id].mapY) || 50;
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  }, {passive:false});

  el.addEventListener('pointermove', (e)=>{
    if(!dragging || !layoutEditing) return;
    e.stopPropagation();
    moveAt(e.clientX, e.clientY);
    e.preventDefault();
  }, {passive:false});

  const endDrag = (e)=>{
    if(!dragging) return;
    e.stopPropagation();
    dragging = false;
    el.classList.remove('dragging');
    if(moved){
      saveData();
      el.dataset.justDragged = '1';
      setTimeout(()=> delete el.dataset.justDragged, 80);
    }
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  el.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(el.dataset.justDragged === '1' || moved) { moved = false; return; }
    if(layoutEditing){ openShapePicker(id); return; }
    openTableModal(id);
  });
}

/* ---------- Selector de figura de mesa ---------- */
let shapePickerTableId = null;
const shapePickerOverlay = document.getElementById('shapePickerOverlay');

function openShapePicker(id){
  shapePickerTableId = id;
  document.getElementById('shapePickerTableName').textContent = tableLabel(id);
  const grid = document.getElementById('shapePickerGrid');
  const current = data.tables[id].shape || 'redonda';
  grid.innerHTML = shapesDelNegocio().map(key=>{
    const s = TABLE_SHAPES[key];
    return `
      <button class="shape-option${key===current?' active':''}" data-shape="${key}">
        <span class="shape-option-icon">${s.icon}</span>
        <span class="shape-option-label">${s.label}</span>
      </button>
    `;
  }).join('');
  grid.querySelectorAll('.shape-option').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      data.tables[shapePickerTableId].shape = btn.dataset.shape;
      saveData();
      closeShapePicker();
      renderFloorPlan();
      showToast('Forma actualizada.');
    });
  });
  updateShapePhotoPreview();
  shapePickerOverlay.classList.add('show');
}

function closeShapePicker(){
  shapePickerOverlay.classList.remove('show');
}

document.getElementById('shapePickerCloseBtn').addEventListener('click', closeShapePicker);
shapePickerOverlay.addEventListener('click', (e)=>{ if(e.target === shapePickerOverlay) closeShapePicker(); });

/* ---------- Foto propia para el ícono de la mesa ---------- */
function resizeImageForIcon(file, maxSize=160, quality=0.75){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let { width, height } = img;
        if(width >= height){
          if(width > maxSize){ height = Math.round(height * (maxSize/width)); width = maxSize; }
        } else {
          if(height > maxSize){ width = Math.round(width * (maxSize/height)); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = ()=> reject(new Error('No se pudo leer la imagen'));
      img.src = reader.result;
    };
    reader.onerror = ()=> reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function updateShapePhotoPreview(){
  const t = data.tables[shapePickerTableId];
  const preview = document.getElementById('shapePhotoPreview');
  const removeBtn = document.getElementById('shapePhotoRemoveBtn');
  if(t && t.photo){
    document.getElementById('shapePhotoPreviewImg').src = t.photo;
    preview.style.display = 'block';
    removeBtn.style.display = '';
  } else {
    preview.style.display = 'none';
    removeBtn.style.display = 'none';
  }
}

async function handleShapePhotoFile(file){
  if(!file || !shapePickerTableId) return;
  try{
    const dataUrl = await resizeImageForIcon(file);
    data.tables[shapePickerTableId].photo = dataUrl;
    saveData();
    renderFloorPlan();
    updateShapePhotoPreview();
    showToast('Foto de la mesa actualizada.');
  }catch(err){
    showToast('No se pudo usar esa foto. Intenta con otra.');
  }
}

const shapePhotoGalleryInput = document.getElementById('shapePhotoGalleryInput');
const shapePhotoCameraInput = document.getElementById('shapePhotoCameraInput');

document.getElementById('shapePhotoGalleryBtn').addEventListener('click', ()=> shapePhotoGalleryInput.click());
document.getElementById('shapePhotoCameraBtn').addEventListener('click', ()=> shapePhotoCameraInput.click());

shapePhotoGalleryInput.addEventListener('change', (e)=>{
  handleShapePhotoFile(e.target.files[0]);
  shapePhotoGalleryInput.value = '';
});
shapePhotoCameraInput.addEventListener('change', (e)=>{
  handleShapePhotoFile(e.target.files[0]);
  shapePhotoCameraInput.value = '';
});

document.getElementById('shapePhotoRemoveBtn').addEventListener('click', async ()=>{
  if(!shapePickerTableId) return;
  const ok = await showConfirm({
    title: '¿Quitar la foto de esta mesa?',
    message: 'Va a volver a mostrarse con el ícono de la figura elegida en vez de la foto.',
    confirmText: 'Sí, quitar foto',
    cancelText: 'Cancelar',
    icon: '🗑️'
  });
  if(!ok) return;
  delete data.tables[shapePickerTableId].photo;
  saveData();
  renderFloorPlan();
  updateShapePhotoPreview();
  showToast('Foto quitada.');
});

function updateMesaViewUI(){
  const isMap = data.tableViewMode === 'map';
  document.getElementById('tableGrid').style.display = isMap ? 'none' : '';
  document.getElementById('floorPlan').style.display = isMap ? 'block' : 'none';
  document.getElementById('floorPlanControls').style.display = isMap ? 'flex' : 'none';
  document.getElementById('floorPlanHint').style.display = (isMap && layoutEditing) ? 'block' : 'none';
  document.getElementById('mesaViewListBtn').classList.toggle('active', !isMap);
  document.getElementById('mesaViewMapBtn').classList.toggle('active', isMap);
  document.getElementById('toggleLayoutEditBtn').textContent = layoutEditing ? '✅ Terminar de ubicar' : '✋ Ubicar mesas (arrastrar)';
  document.getElementById('toggleLayoutEditBtn').classList.toggle('active', layoutEditing);
  renderMesas();
}

document.getElementById('mesaViewListBtn').addEventListener('click', ()=>{
  data.tableViewMode = 'list';
  layoutEditing = false;
  saveData();
  updateMesaViewUI();
});
document.getElementById('mesaViewMapBtn').addEventListener('click', ()=>{
  data.tableViewMode = 'map';
  saveData();
  updateMesaViewUI();
});
document.getElementById('toggleLayoutEditBtn').addEventListener('click', ()=>{
  layoutEditing = !layoutEditing;
  updateMesaViewUI();
});
document.getElementById('resetLayoutBtn').addEventListener('click', async ()=>{
  const ok = await showConfirm({
    title: '¿Reordenar mesas en cuadrícula?',
    message: 'Vas a perder la posición manual que le diste a cada mesa y quedarán acomodadas otra vez parejas en cuadrícula.',
    confirmText: 'Sí, reordenar',
    icon: '↺'
  });
  if(!ok) return;
  Object.values(data.tables).forEach(t=>{ delete t.mapX; delete t.mapY; });
  saveData();
  renderMesas();
});


/* ---------- Modal ---------- */
const overlay = document.getElementById('overlay');
function openTableModal(id){
  payPick.table = null; pendingReceipt.table = null; updatePayPickInfo('table');
  currentTable = id;
  document.getElementById('modalTitle').textContent = tableLabel(id);
  refreshProductSelect();
  renderPeople();
  renderFavChips();
  renderModalItems();
  document.getElementById('loyaltyDivider').hidden = !data.loyaltyOn;
  document.getElementById('loyaltyRow').hidden = !data.loyaltyOn;
  document.getElementById('loyaltyPhone').value = '';
  document.getElementById('loyaltyName').value = '';
  // Negocios de órdenes, vehículos, mascotas o pacientes: cada cuenta va a nombre de alguien.
  const cli = document.getElementById('clienteNombre');
  if(cli){ const t = data.tables[id] || {}; cli.value = (t.name || '').trim(); cli.placeholder = '¿A nombre de quién? (ej. Ana Pérez)'; }
  // Lo secundario (personas, nombre del cliente) arranca plegado: lo primero es buscar productos.
  mesaPleg('personasToggle', 'personasCuerpo', false);
  mesaPleg('clienteToggle', 'clienteRow', false);
  pintarClienteN();
  mesaAccionesTitulos();
  try{ window.grupoBarPintar && window.grupoBarPintar(id); }catch(e){}
  overlay.classList.add('show');
  // Ya no se pone el cursor solo en «¿A nombre de quién?»: abría el teclado cada vez que se abría una
  // mesa o cuenta. El campo sigue ahí; se escribe solo si la persona lo toca.
  try{ const a = document.activeElement; if(a && a !== document.body && overlay.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) a.blur(); }catch(e){}
}

/* ---------- Renombrar mesa ---------- */
const renameOverlay = document.getElementById('renameOverlay');
const renameTableInput = document.getElementById('renameTableInput');

function openRenameModal(){
  const t = data.tables[currentTable];
  renameTableInput.value = (t && t.name) ? t.name : '';
  renameOverlay.classList.add('show');
  setTimeout(()=>{ renameTableInput.focus(); renameTableInput.select(); }, 50);
}

function closeRenameModal(){
  renameOverlay.classList.remove('show');
}

function saveTableRename(){
  const t = data.tables[currentTable];
  if(!t) return;
  const newName = renameTableInput.value.trim();
  t.name = newName ? newName : null;
  saveData();
  document.getElementById('modalTitle').textContent = tableLabel(currentTable);
  const cli = document.getElementById('clienteNombre'); if(cli) cli.value = t.name || '';
  pintarClienteN();
  renderMesas();
  closeRenameModal();
  showToast(i18nPut(espacioN()) + ' renombrada.');
}

// Nombre del cliente dentro de la cuenta (negocios de órdenes, vehículos, mascotas, pacientes).
function guardarCliente(){
  const cli = document.getElementById('clienteNombre'), t = data.tables[currentTable];
  if(!cli || !t) return;
  const n = cli.value.trim();
  if((t.name || '') === n) return;
  t.name = n || null;
  saveData();
  document.getElementById('modalTitle').textContent = tableLabel(currentTable);
  pintarClienteN();
  renderMesas();
  if(n) showToast('✅ ' + i18nPut(espacioN()) + ' a nombre de ' + n + '.');
}
// Plegables de la mesa (personas, nombre del cliente): secundarios, se abren solo al tocarlos.
function mesaPleg(btnId, cuerpoId, abrir){
  const b = document.getElementById(btnId), c = document.getElementById(cuerpoId);
  if(!b || !c) return false;
  const on = abrir == null ? c.hidden : !!abrir;
  c.hidden = !on;
  b.setAttribute('aria-expanded', on ? 'true' : 'false');
  return on;
}
function pintarClienteN(){
  const el = document.getElementById('clienteN'); if(!el) return;
  const t = currentTable != null ? data.tables[currentTable] : null;
  const n = t && t.name ? String(t.name).trim() : '';
  el.textContent = n;
  const b = document.getElementById('clienteToggle'); if(b) b.classList.toggle('con-nombre', !!n);
}
// Títulos de los iconos del encabezado con el nombre que usa el negocio (mesa, silla, orden…).
function mesaAccionesTitulos(){
  const u = i18nPut(espacioN()).toLowerCase();
  [['renameTableBtn', 'Renombrar ' + u], ['moveTableBtn', 'Cambiar de ' + u]].forEach(([id, txt]) => {
    const b = document.getElementById(id); if(b){ b.title = txt; b.setAttribute('aria-label', txt); }
  });
}
document.getElementById('personasToggle').addEventListener('click', () => {
  if(mesaPleg('personasToggle', 'personasCuerpo')) setTimeout(() => { try{ document.getElementById('personNameInput').focus(); }catch(e){} }, 30);
});
document.getElementById('clienteToggle').addEventListener('click', () => {
  if(mesaPleg('clienteToggle', 'clienteRow')) setTimeout(() => { try{ const i = document.getElementById('clienteNombre'); i.focus(); i.select(); }catch(e){} }, 30);
});
document.getElementById('clienteGuardar').addEventListener('click', guardarCliente);
document.getElementById('clienteNombre').addEventListener('change', guardarCliente);
document.getElementById('clienteNombre').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); guardarCliente(); } });
document.getElementById('renameTableBtn').addEventListener('click', openRenameModal);
document.getElementById('moveTableBtn').addEventListener('click', () => { if(currentTable != null) abrirCambioMesa(currentTable); });
document.getElementById('renameCancelBtn').addEventListener('click', closeRenameModal);
document.getElementById('renameSaveBtn').addEventListener('click', saveTableRename);
renameTableInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') saveTableRename();
});
renameOverlay.addEventListener('click', (e)=>{ if(e.target === renameOverlay) closeRenameModal(); });

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
/* ---------- Promociones y combos: un combo es un producto que descuenta varios ---------- */
const PROMO_CAT = 'cat-promos', PMS = 'style="padding:9px;font-size:14px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;min-width:0;flex:1"';
const promoNormal = c => (c || []).reduce((a, x) => { const p = data.products.find(y => y.id === x.id); return a + (p ? p.price * x.qty : 0); }, 0);
const promoText = c => (c || []).map(x => { const p = data.products.find(y => y.id === x.id); return p ? x.qty + '× ' + p.name : ''; }).filter(Boolean).join(' + ');
function renderPromos(){
  const L = data.products.filter(p => p.combo);
  document.getElementById('promoList').innerHTML = L.length ? L.map(p => { const n = promoNormal(p.combo), ah = n - p.price;
    return '<div class="inv-row"><div><b>🎁 ' + invEsc(p.name) + '</b><small>' + invEsc(promoText(p.combo)) + '</small><small>' + fmt(p.price) + (ah > 0 ? ' · normal ' + fmt(n) + ' · ahorra ' + fmt(ah) + ' (' + Math.round(ah / n * 100) + '%)' : '') + '</small></div><div class="inv-btns"><button class="btn-ghost" data-act="edit" data-id="' + p.id + '">Editar</button><button class="btn-ghost" data-act="del" data-id="' + p.id + '">Eliminar</button></div></div>'; }).join('')
    : '<div class="empty-state">Aún no tienes combos ni promociones. Crea uno: por ejemplo "6 águilas + papas" a precio especial, o un 2x1 (2 unidades al precio de 1).</div>';
}
function promoOpen(id){
  const ed = id ? data.products.find(p => p.id === id) : null, c = (ed && ed.combo) || [];
  const real = data.products.filter(p => !p.combo).sort((a, b) => a.name.localeCompare(b.name));
  const opts = sel => '<option value="">—</option>' + real.map(p => '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + invEsc(p.name + (p.size ? ' ' + p.size : '')) + ' · ' + fmt(p.price) + '</option>').join('');
  const rows = [0, 1, 2, 3].map(i => '<div style="display:flex;gap:6px"><select class="pmP" ' + PMS + '>' + opts(c[i] && c[i].id) + '</select><input class="pmQ" type="number" inputmode="numeric" min="1" value="' + (c[i] ? c[i].qty : 1) + '" ' + PMS.replace('flex:1', 'width:62px;flex:none') + '></div>').join('');
  const TXT = INV_IN.replace('type="number" inputmode="numeric" min="0"', 'type="text"');
  const rd = o => { const q = o.querySelectorAll('.pmQ'); return [...o.querySelectorAll('.pmP')].map((s, i) => ({ id: s.value, qty: Math.max(1, parseInt(q[i].value, 10) || 1) })).filter(x => x.id); };
  const o = invDlg('<b>🎁 ' + (ed ? 'Editar' : 'Nuevo') + ' combo o promoción</b><input id="pmName" ' + TXT + ' placeholder="Nombre (ej. Combo 6 águilas)" value="' + invEsc(ed ? ed.name : '') + '"><small style="color:var(--ink-soft)">Qué incluye (hasta 4 productos y cuántas unidades de cada uno):</small>' + rows +
    '<input id="pmPrice" ' + INV_IN + ' placeholder="Precio del combo $" value="' + (ed ? ed.price : '') + '"><small id="pmInfo" style="color:var(--ink-soft)"></small>', o => {
    const name = o.querySelector('#pmName').value.trim(), price = parseFloat(o.querySelector('#pmPrice').value), comp = rd(o);
    if(!name || isNaN(price) || price < 0 || !comp.length){ showToast('Pon un nombre, un precio y al menos un producto.'); return false; }
    if(data.products.some(p => p.id !== (ed && ed.id) && dupKey(p) === dupKey({ name }))){ showToast('Ya existe un producto con ese nombre.'); return false; }
    if(!data.categories.some(k => k.id === PROMO_CAT)) data.categories.push({ id: PROMO_CAT, name: 'Promociones y combos' });
    if(ed){ ed.name = name; ed.price = price; ed.combo = comp; } else data.products.push({ id: 'combo-' + Date.now(), name, price, categoryId: PROMO_CAT, combo: comp });
    saveData(); renderPromos(); renderProductos();
  });
  const upd = () => { const n = promoNormal(rd(o)), p = parseFloat(o.querySelector('#pmPrice').value); o.querySelector('#pmInfo').textContent = 'Precio normal: ' + fmt(n) + (p >= 0 && n > p ? ' · el cliente ahorra ' + fmt(n - p) + ' (' + Math.round((n - p) / n * 100) + '%)' : ''); };
  o.addEventListener('input', upd); o.addEventListener('change', upd); upd();
}
document.getElementById('promoNew').addEventListener('click', () => promoOpen());
document.getElementById('promoList').addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]'); if(!b) return;
  if(b.dataset.act === 'edit') return promoOpen(b.dataset.id);
  const p = data.products.find(x => x.id === b.dataset.id); if(!p) return;
  if(await showConfirm({ title: '¿Eliminar combo?', message: '"' + p.name + '" se elimina. Las cuentas abiertas que ya lo tengan no cambian.', confirmText: 'Sí, eliminar', icon: '🗑️' })){ data.products = data.products.filter(x => x.id !== p.id); saveData(); renderPromos(); renderProductos(); }
});

/* ---------- Idiomas (es, en, 中文, हिन्दी, fr) ---------- */
const I18N_T = [
["Mesas", "Tables", "桌台", "मेज़ें", "Tables", "Mesas"],
["Mesa", "Table", "桌", "मेज़", "Table", "Mesa"],
["🍳 Cocina", "🍳 Kitchen", "🍳 厨房", "🍳 रसोई", "🍳 Cuisine", "🍳 Cozinha"],
["Productos", "Products", "商品", "उत्पाद", "Produits", "Produtos"],
["Inventario", "Inventory", "库存", "इन्वेंटरी", "Inventaire", "Estoque"],
["Historial", "History", "历史记录", "इतिहास", "Historique", "Histórico"],
["🎵 Música", "🎵 Music", "🎵 音乐", "🎵 संगीत", "🎵 Musique", "🎵 Música"],
["⚙️ Ajustes", "⚙️ Settings", "⚙️ 设置", "⚙️ सेटिंग्स", "⚙️ Réglages", "⚙️ Configurações"],
["📊 Estadísticas", "📊 Statistics", "📊 统计", "📊 आँकड़े", "📊 Statistiques", "📊 Estatísticas"],
["📖 Carta", "📖 Menu", "📖 酒水单", "📖 मेन्यू", "📖 Carte", "📖 Cardápio"],
["Cocina", "Kitchen", "厨房", "रसोई", "Cuisine", "Cozinha"],
["libre", "free", "空闲", "खाली", "libre", "livre"],
["libres", "free", "空闲", "खाली", "libres", "livres"],
["abierta", "open", "使用中", "खुली", "ouverte", "aberta"],
["abiertas", "open", "使用中", "खुली", "ouvertes", "abertas"],
["por cobrar", "to collect", "待收款", "वसूली बाकी", "à encaisser", "a receber"],
["🪑 Número de mesas", "🪑 Number of tables", "🪑 桌台数量", "🪑 मेज़ों की संख्या", "🪑 Nombre de tables", "🪑 Número de mesas"],
["Estadísticas", "Statistics", "统计", "आँकड़े", "Statistiques", "Estatísticas"],
["Música", "Music", "音乐", "संगीत", "Musique", "Música"],
["Ajustes", "Settings", "设置", "सेटिंग्स", "Réglages", "Configurações"],
["Más", "More", "更多", "और", "Plus", "Mais"],
["Más secciones", "More sections", "更多栏目", "और अनुभाग", "Plus de sections", "Mais seções"],
["Ventas y ganancias", "Sales and profit", "销售与利润", "बिक्री और मुनाफ़ा", "Ventes et bénéfices", "Vendas e lucro"],
["Lo que ven tus clientes", "What your customers see", "顾客看到的内容", "आपके ग्राहक क्या देखते हैं", "Ce que voient vos clients", "O que seus clientes veem"],
["Cuentas cerradas y fiados", "Closed bills and tabs", "已结账单和赊账", "बंद बिल और उधार", "Additions fermées et crédits", "Contas fechadas e fiados"],
["Canciones que piden", "Song requests", "点歌", "गानों की फ़रमाइश", "Chansons demandées", "Músicas pedidas"],
["Configura tu negocio", "Set up your business", "设置你的店铺", "अपना व्यवसाय सेट करें", "Configurez votre commerce", "Configure seu negócio"],
["Pregúntale lo que sea", "Ask it anything", "随便问", "कुछ भी पूछें", "Demandez-lui tout", "Pergunte qualquer coisa"],
["🍻 Carta", "🍻 Menu", "🍻 酒水单", "🍻 मेन्यू", "🍻 Carte", "🍻 Cardápio"],
["🍽️ Menú", "🍽️ Menu", "🍽️ 菜单", "🍽️ मेन्यू", "🍽️ Menu", "🍽️ Cardápio"],
["Menú", "Menu", "菜单", "मेन्यू", "Menu", "Cardápio"],
["Carta", "Menu", "菜单", "मेन्यू", "Carte", "Cardápio"],
["Nada coincide con la búsqueda.", "Nothing matches your search.", "没有匹配的搜索结果。", "खोज से कुछ मेल नहीं खाता।", "Aucun résultat pour la recherche.", "Nada corresponde à busca."],
["Hoy", "Today", "今天", "आज", "Aujourd’hui", "Hoje"],
["7 días", "7 days", "7天", "7 दिन", "7 jours", "7 dias"],
["30 días", "30 days", "30天", "30 दिन", "30 jours", "30 dias"],
["Todo", "All", "全部", "सब", "Tout", "Tudo"],
["💵 Ventas", "💵 Sales", "💵 销售", "💵 बिक्री", "💵 Ventes", "💵 Vendas"],
["📦 Inventario", "📦 Inventory", "📦 库存", "📦 इन्वेंटरी", "📦 Inventaire", "📦 Estoque"],
["💰 Ventas", "💰 Sales", "💰 销售额", "💰 बिक्री", "💰 Ventes", "💰 Vendas"],
["🧾 Cuentas", "🧾 Bills", "🧾 账单", "🧾 बिल", "🧾 Additions", "🧾 Contas"],
["🎟️ Ticket promedio", "🎟️ Average ticket", "🎟️ 平均客单价", "🎟️ औसत बिल", "🎟️ Ticket moyen", "🎟️ Ticket médio"],
["🍺 Unidades vendidas", "🍺 Units sold", "🍺 销售数量", "🍺 बिकी इकाइयाँ", "🍺 Unités vendues", "🍺 Unidades vendidas"],
["📒 Fiado (debe)", "📒 On credit (owed)", "📒 赊账", "📒 उधार", "📒 À crédit (dû)", "📒 Fiado (a receber)"],
["📅 Promedio por día", "📅 Daily average", "📅 日均", "📅 दैनिक औसत", "📅 Moyenne par jour", "📅 Média diária"],
["📈 Ventas por día", "📈 Sales per day", "📈 每日销售", "📈 दैनिक बिक्री", "📈 Ventes par jour", "📈 Vendas por dia"],
["📈 Ventas por hora", "📈 Sales per hour", "📈 每小时销售", "📈 प्रति घंटा बिक्री", "📈 Ventes par heure", "📈 Vendas por hora"],
["📈 Ventas por mes", "📈 Sales per month", "📈 每月销售", "📈 मासिक बिक्री", "📈 Ventes par mois", "📈 Vendas por mês"],
["🏆 Lo más vendido (unidades)", "🏆 Top sellers (units)", "🏆 热销商品（数量）", "🏆 सबसे ज़्यादा बिके (इकाइयाँ)", "🏆 Les plus vendus (unités)", "🏆 Mais vendidos (unidades)"],
["💳 Cómo te pagaron", "💳 How they paid", "💳 支付方式", "💳 भुगतान का तरीका", "💳 Modes de paiement", "💳 Como pagaram"],
["🗂️ Ventas por categoría", "🗂️ Sales by category", "🗂️ 分类销售", "🗂️ श्रेणी अनुसार बिक्री", "🗂️ Ventes par catégorie", "🗂️ Vendas por categoria"],
["🕒 Horas pico (en el período)", "🕒 Peak hours", "🕒 高峰时段", "🕒 व्यस्त घंटे", "🕒 Heures de pointe", "🕒 Horários de pico (no período)"],
["🪑 Ventas por mesa", "🪑 Sales by table", "🪑 各桌销售", "🪑 मेज़ अनुसार बिक्री", "🪑 Ventes par table", "🪑 Vendas por mesa"],
["📉 Se agotan primero", "📉 Running out first", "📉 最先售罄", "📉 सबसे पहले खत्म", "📉 Bientôt épuisés", "📉 Acabando primeiro"],
["💹 Rentabilidad", "💹 Profitability", "💹 盈利能力", "💹 लाभप्रदता", "💹 Rentabilité", "💹 Rentabilidade"],
["🧮 Margen bruto", "🧮 Gross margin", "🧮 毛利润", "🧮 सकल मार्जिन", "🧮 Marge brute", "🧮 Margem bruta"],
["📊 Margen %", "📊 Margin %", "📊 利润率", "📊 मार्जिन %", "📊 Marge %", "📊 Margem %"],
["🥇 Más rentable (margen)", "🥇 Most profitable (margin)", "🥇 利润最高（毛利）", "🥇 सबसे लाभदायक (मार्जिन)", "🥇 Les plus rentables (marge)", "🥇 Mais lucrativos (margem)"],
["📊 Vs. período anterior", "📊 Vs. previous period", "📊 对比上一周期", "📊 पिछली अवधि की तुलना में", "📊 Vs période précédente", "📊 Vs. período anterior"],
["Configura el costo de tus productos (en Productos → Editar) para ver aquí el margen de ganancia.", "Set your products’ cost (in Products → Edit) to see profit margin here.", "在“商品 → 编辑”中设置商品成本，即可在这里查看利润率。", "मार्जिन देखने के लिए अपने उत्पादों की लागत सेट करें (उत्पाद → संपादित करें में)।", "Renseignez le coût de vos produits (dans Produits → Modifier) pour voir la marge ici.", "Configure o custo dos seus produtos (em Produtos → Editar) para ver a margem aqui."],
["🎁 Combos y promociones", "🎁 Combos & promotions", "🎁 套餐与促销", "🎁 कॉम्बो और प्रमोशन", "🎁 Combos et promotions", "🎁 Combos e promoções"],
["➕ Nuevo combo o promoción", "➕ New combo or promotion", "➕ 新建套餐或促销", "➕ नया कॉम्बो या प्रमोशन", "➕ Nouveau combo ou promotion", "➕ Novo combo ou promoção"],
["Editar", "Edit", "编辑", "संपादित करें", "Modifier", "Editar"],
["Eliminar", "Delete", "删除", "हटाएँ", "Supprimer", "Excluir"],
["🌐 Idioma", "🌐 Language", "🌐 语言", "🌐 भाषा", "🌐 Langue", "🌐 Idioma"],
["Agrega productos para armar tu carta.", "Add products to build your menu.", "添加商品以创建您的菜单。", "अपना मेन्यू बनाने के लिए उत्पाद जोड़ें।", "Ajoutez des produits pour créer votre carte.", "Adicione produtos para montar sua carta."],
["Agrega productos para armar tu menú.", "Add products to build your menu.", "添加商品以创建您的菜单。", "अपना मेन्यू बनाने के लिए उत्पाद जोड़ें।", "Ajoutez des produits pour créer votre menu.", "Adicione produtos para montar seu cardápio."],
["Número de mesas:", "Number of tables:", "桌数：", "मेज़ों की संख्या:", "Nombre de tables :", "Número de mesas:"],
["Aplicar", "Apply", "应用", "लागू करें", "Appliquer", "Aplicar"],
["📋 Lista", "📋 List", "📋 列表", "📋 सूची", "📋 Liste", "📋 Lista"],
["🗺️ Mapa del local", "🗺️ Floor map", "🗺️ 店铺地图", "🗺️ दुकान का नक्शा", "🗺️ Plan du local", "🗺️ Mapa do local"],
["🧾 Cuenta general", "🧾 General bill", "🧾 总账单", "🧾 सामान्य बिल", "🧾 Addition générale", "🧾 Conta geral"],
["✋ Ubicar mesas (arrastrar)", "✋ Place tables (drag)", "✋ 摆放桌子（拖动）", "✋ मेज़ें व्यवस्थित करें (खींचें)", "✋ Placer les tables (glisser)", "✋ Posicionar mesas (arrastar)"],
["↺ Reordenar en cuadrícula", "↺ Reset to grid", "↺ 重新排列为网格", "↺ ग्रिड में पुनर्व्यवस्थित करें", "↺ Réorganiser en grille", "↺ Reorganizar em grade"],
["📷 Escanear con IA + web", "📷 Scan with AI + web", "📷 用AI+网络扫描", "📷 AI + वेब से स्कैन करें", "📷 Scanner avec IA + web", "📷 Escanear com IA + web"],
["⚙️ Configurar IA", "⚙️ Configure AI", "⚙️ 配置AI", "⚙️ AI कॉन्फ़िगर करें", "⚙️ Configurer l’IA", "⚙️ Configurar IA"],
["🎤 Producto por voz + IA", "🎤 Product by voice + AI", "🎤 语音+AI录入商品", "🎤 आवाज़ + AI से उत्पाद जोड़ें", "🎤 Produit par la voix + IA", "🎤 Produto por voz + IA"],
["Crear", "Create", "创建", "बनाएं", "Créer", "Criar"],
["Cancelar", "Cancel", "取消", "रद्द करें", "Annuler", "Cancelar"],
["Agregar", "Add", "添加", "जोड़ें", "Ajouter", "Adicionar"],
["📷 Escanear para dar entrada", "📷 Scan to add stock", "📷 扫描入库", "📷 स्टॉक जोड़ने हेतु स्कैन करें", "📷 Scanner pour ajouter au stock", "📷 Escanear para dar entrada"],
["🧩 Unir repetidos", "🧩 Merge duplicates", "🧩 合并重复项", "🧩 डुप्लिकेट मिलाएँ", "🧩 Fusionner les doublons", "🧩 Unir duplicados"],
["🏷️ Escanear precio y margen", "🏷️ Scan price & margin", "🏷️ 扫描价格和利润率", "🏷️ कीमत और मार्जिन स्कैन करें", "🏷️ Scanner prix et marge", "🏷️ Escanear preço e margem"],
["📤 Publicar en QR", "📤 Publish to QR", "📤 发布到二维码", "📤 QR पर प्रकाशित करें", "📤 Publier sur le QR", "📤 Publicar no QR"],
["📋 Compartir", "📋 Share", "📋 分享", "📋 साझा करें", "📋 Partager", "📋 Compartilhar"],
["🖨️ Imprimir", "🖨️ Print", "🖨️ 打印", "🖨️ प्रिंट करें", "🖨️ Imprimer", "🖨️ Imprimir"],
["Así la ven tus clientes al escanear el QR de la mesa.", "This is what your customers see when they scan the table’s QR.", "这是顾客扫描桌台二维码时看到的内容。", "मेज़ का QR स्कैन करने पर ग्राहकों को यही दिखता है।", "C’est ce que vos clients voient en scannant le QR de la table.", "É assim que seus clientes veem ao escanear o QR da mesa."],
["🔒 Cerrar caja del día", "🔒 Close the day’s register", "🔒 结束当日收银", "🔒 दिन का कैश बंद करें", "🔒 Clôturer la caisse du jour", "🔒 Fechar caixa do dia"],
["🗑️ Borrar historial de un día", "🗑️ Delete a day’s history", "🗑️ 删除某天的历史记录", "🗑️ किसी दिन का इतिहास हटाएँ", "🗑️ Supprimer l’historique d’un jour", "🗑️ Excluir histórico de um dia"],
["Todos", "All", "全部", "सभी", "Tous", "Todos"],
["✅ Pagaron", "✅ Paid", "✅ 已付款", "✅ भुगतान हुआ", "✅ Payé", "✅ Pagaram"],
["⏳ Deben", "⏳ Owing", "⏳ 欠款", "⏳ बकाया", "⏳ Doivent", "⏳ Devendo"],
["📊 Ver gráficas de ventas", "📊 View sales charts", "📊 查看销售图表", "📊 बिक्री चार्ट देखें", "📊 Voir les graphiques de ventes", "📊 Ver gráficos de vendas"],
["Cierres de caja", "Register closures", "收银结算记录", "कैश समापन", "Clôtures de caisse", "Fechamentos de caixa"],
["Resumen general", "General summary", "总体摘要", "सामान्य सारांश", "Résumé général", "Resumo geral"],
["Cuentas cerradas", "Closed bills", "已结账单", "बंद किए गए बिल", "Additions clôturées", "Contas fechadas"],
["🎵 Cola de música", "🎵 Music queue", "🎵 音乐队列", "🎵 संगीत कतार", "🎵 File d’attente musicale", "🎵 Fila de música"],
["📥 Cargar en mi lista de YouTube Music", "📥 Load into my YouTube Music playlist", "📥 加载到我的YouTube Music播放列表", "📥 मेरी YouTube Music प्लेलिस्ट में लोड करें", "📥 Charger dans ma playlist YouTube Music", "📥 Carregar na minha playlist do YouTube Music"],
["Abrir lista", "Open playlist", "打开播放列表", "प्लेलिस्ट खोलें", "Ouvrir la playlist", "Abrir playlist"],
["▶ Siguiente canción", "▶ Next song", "▶ 下一首歌", "▶ अगला गाना", "▶ Chanson suivante", "▶ Próxima música"],
["Vaciar cola", "Clear queue", "清空队列", "कतार खाली करें", "Vider la file", "Esvaziar fila"],
["📺 Música en el TV", "📺 Music on TV", "📺 电视上播放音乐", "📺 टीवी पर संगीत", "📺 Musique à la télé", "📺 Música na TV"],
["🔊 Reproducción automática", "🔊 Auto play", "🔊 自动播放", "🔊 ऑटो प्ले", "🔊 Lecture automatique", "🔊 Reprodução automática"],
["Cómo se reparte", "How it’s shared", "分配方式", "यह कैसे बंटता है", "Comment ça se répartit", "Como é distribuído"],
["▶ YouTube Music automático", "▶ Automatic YouTube Music", "▶ 自动YouTube Music", "▶ स्वचालित YouTube Music", "▶ YouTube Music automatique", "▶ YouTube Music automático"],
["Conectar con Google", "Connect with Google", "连接Google账号", "Google से कनेक्ट करें", "Se connecter avec Google", "Conectar com o Google"],
["Restablecer", "Reset", "重置", "रीसेट करें", "Réinitialiser", "Restablecer"],
["Restablecer día", "Reset the day", "重置当日", "दिन रीसेट करें", "Réinitialiser la journée", "Restablecer o dia"],
["Restablecer todo", "Reset everything", "全部重置", "सब कुछ रीसेट करें", "Tout réinitialiser", "Restablecer tudo"],
["Borrar nombres de todas las mesas", "Clear all table names", "清除所有桌子名称", "सभी मेज़ों के नाम हटाएँ", "Effacer les noms de toutes les tables", "Apagar nomes de todas as mesas"],
["Cuenta y negocio", "Account and business", "账户与商家", "खाता और व्यवसाय", "Compte et commerce", "Conta e negócio"],
["Micrófono", "Microphone", "麦克风", "माइक्रोफ़ोन", "Microphone", "Microfone"],
["Datos y transferencia", "Data and transfer", "数据与传输", "डेटा और ट्रांसफर", "Données et transfert", "Dados e transferência"],
["💾 Guardar", "💾 Save", "💾 保存", "💾 सहेजें", "💾 Enregistrer", "💾 Salvar"],
["📤 Transferir", "📤 Transfer", "📤 传输", "📤 ट्रांसफर करें", "📤 Transférer", "📤 Transferir"],
["📥 Recibir", "📥 Receive", "📥 接收", "📥 प्राप्त करें", "📥 Recevoir", "📥 Receber"],
["Cierre automático de caja", "Automatic register closing", "自动收银结算", "स्वचालित कैश समापन", "Clôture automatique de caisse", "Fechamento automático de caixa"],
["QR de las mesas (permanentes)", "Table QR codes (permanent)", "桌台二维码（永久）", "मेज़ों के QR कोड (स्थायी)", "QR des tables (permanents)", "QR das mesas (permanentes)"],
["Ver QR", "View QR", "查看二维码", "QR देखें", "Voir le QR", "Ver QR"],
["🖨️ Imprimir todos", "🖨️ Print all", "🖨️ 全部打印", "🖨️ सभी प्रिंट करें", "🖨️ Tout imprimer", "🖨️ Imprimir todos"],
["📤 Publicar catálogo", "📤 Publish catalog", "📤 发布商品目录", "📤 कैटलॉग प्रकाशित करें", "📤 Publier le catalogue", "📤 Publicar catálogo"],
["Letra", "Typeface", "字体", "फ़ॉन्ट", "Police", "Fonte"],
["Fondo de la aplicación", "App background", "应用背景", "ऐप पृष्ठभूमि", "Fond de l’application", "Plano de fundo do app"],
["🖼️ Elegir foto", "🖼️ Choose photo", "🖼️ 选择照片", "🖼️ फ़ोटो चुनें", "🖼️ Choisir une photo", "🖼️ Escolher foto"],
["Quitar", "Remove", "移除", "हटाएँ", "Retirer", "Remover"],
["Apariencia", "Appearance", "外观", "रूप", "Apparence", "Aparência"],
["🧓 Modo fácil", "🧓 Easy mode", "🧓 简易模式", "🧓 आसान मोड", "🧓 Mode simplifié", "🧓 Modo fácil"],
["Activar modo fácil", "Turn on easy mode", "开启简易模式", "आसान मोड चालू करें", "Activer le mode simplifié", "Ativar modo fácil"],
["Salir", "Log out", "退出登录", "लॉग आउट करें", "Se déconnecter", "Sair"],
["Generar código", "Generate code", "生成代码", "कोड जनरेट करें", "Générer le code", "Gerar código"],
["🧮 Calculadoras rápidas", "🧮 Quick calculators", "🧮 快速计算器", "🧮 त्वरित कैलकुलेटर", "🧮 Calculatrices rapides", "🧮 Calculadoras rápidas"],
["Descuento", "Discount", "折扣", "छूट", "Remise", "Desconto"],
["Prima / Bonificación", "Bonus / Prima", "奖金/Prima", "बोनस / प्राइमा", "Prime / Bonus", "Prêmio / Bonificação"],
["Calcular DV", "Calculate check digit", "计算校验码", "जाँच अंक गणना करें", "Calculer le chiffre de contrôle", "Calcular DV"],
["🏷️ Imprimir etiquetas", "🏷️ Print labels", "🏷️ 打印标签", "🏷️ लेबल प्रिंट करें", "🏷️ Imprimer les étiquettes", "🏷️ Imprimir etiquetas"],
["📊 Código de barras", "📊 Barcode", "📊 条形码", "📊 बारकोड", "📊 Code-barres", "📊 Código de barras"],
["▦ Código QR", "▦ QR code", "▦ 二维码", "▦ QR कोड", "▦ Code QR", "▦ Código QR"],
["💜 Pasarela de pago (Nequi)", "💜 Payment gateway (Nequi)", "💜 支付网关（Nequi）", "💜 भुगतान गेटवे (Nequi)", "💜 Passerelle de paiement (Nequi)", "💜 Gateway de pagamento (Nequi)"],
["Aceptar pagos por Nequi", "Accept payments via Nequi", "接受 Nequi 支付", "Nequi से भुगतान स्वीकार करें", "Accepter les paiements via Nequi", "Aceitar pagamentos pelo Nequi"],
["Tu número de Nequi", "Your Nequi number", "你的 Nequi 号码", "आपका Nequi नंबर", "Votre numéro Nequi", "Seu número do Nequi"],
["Nombre en la cuenta (opcional)", "Account name (optional)", "账户姓名（可选）", "खाता नाम (वैकल्पिक)", "Nom du compte (facultatif)", "Nome na conta (opcional)"],
["🛵 Domicilios", "🛵 Delivery", "🛵 外卖配送", "🛵 डिलीवरी", "🛵 Livraison", "🛵 Entregas"],
["Activar domicilios", "Turn on delivery", "开启外卖配送", "डिलीवरी चालू करें", "Activer la livraison", "Ativar entregas"],
["✅ Listo", "✅ Ready", "✅ 完成", "✅ तैयार", "✅ Prêt", "✅ Pronto"],
["↩️ Reabrir", "↩️ Reopen", "↩️ 重新打开", "↩️ फिर से खोलें", "↩️ Rouvrir", "↩️ Reabrir"],
["✅ Aceptar", "✅ Accept", "✅ 接受", "✅ स्वीकार करें", "✅ Accepter", "✅ Aceitar"],
["❌ Rechazar", "❌ Reject", "❌ 拒绝", "❌ अस्वीकार करें", "❌ Rejeter", "❌ Rejeitar"],
["📥 Pedidos nuevos por confirmar", "📥 New orders to confirm", "📥 待确认的新订单", "📥 पुष्टि हेतु नए ऑर्डर", "📥 Nouvelles commandes à confirmer", "📥 Novos pedidos para confirmar"],
["No hay pedidos abiertos en este momento. 🎉", "No open orders right now. 🎉", "目前没有待处理的订单。🎉", "अभी कोई खुला ऑर्डर नहीं है। 🎉", "Aucune commande ouverte pour le moment. 🎉", "Nenhum pedido em aberto no momento. 🎉"],
["🔳 Escanear código", "🔳 Scan code", "🔳 扫描代码", "🔳 कोड स्कैन करें", "🔳 Scanner le code", "🔳 Escanear código"],
["🔳 Vender escaneando código", "🔳 Sell by scanning code", "🔳 扫码销售", "🔳 स्कैन करके बेचें", "🔳 Vendre en scannant le code", "🔳 Vender escaneando código"],
["Apunta la cámara al código del producto.", "Point the camera at the product's code.", "将相机对准产品代码。", "उत्पाद के कोड पर कैमरा फोकस करें।", "Pointez la caméra vers le code du produit.", "Aponte a câmera para o código do produto."],
["Escanea el código del producto para agregarlo a la cuenta — puedes escanear varios seguidos.", "Scan the product's code to add it to the bill — you can scan several in a row.", "扫描产品代码将其添加到账单中——可以连续扫描多个。", "उत्पाद का कोड स्कैन करके बिल में जोड़ें — लगातार कई स्कैन कर सकते हैं।", "Scannez le code du produit pour l'ajouter à l'addition — vous pouvez en scanner plusieurs à la suite.", "Escaneie o código do produto para adicioná-lo à conta — você pode escanear vários seguidos."],
["Escanea el código de barras o QR de un producto para agregarlo o encontrarlo.", "Scan a product's barcode or QR code to add or find it.", "扫描产品的条形码或二维码以添加或查找它。", "किसी उत्पाद का बारकोड या QR कोड स्कैन करके उसे जोड़ें या खोजें।", "Scannez le code-barres ou le QR code d'un produit pour l'ajouter ou le trouver.", "Escaneie o código de barras ou QR de um produto para adicioná-lo ou encontrá-lo."]
];
const I18N = { en: {}, zh: {}, hi: {}, fr: {}, pt: {} };
I18N_T.forEach(r => ['en', 'zh', 'hi', 'fr', 'pt'].forEach((l, i) => { I18N[l][r[0]] = r[i + 1]; }));
const LANG_KEY = 'cm-lang';
let LANG = (() => { try{ return localStorage.getItem(LANG_KEY) || 'es'; }catch(e){ return 'es'; } })();
const I18N_ATTR = ['placeholder', 'aria-label', 'title'];
const i18nPut = k => LANG === 'es' ? k : ((I18N[LANG] || {})[k] || k);
function i18nNode(n){
  if(n.nodeType === 3){
    const raw = n.nodeValue, k = n._k || raw.trim();
    if(!k || !(k in I18N.en)) return;
    n._k = k; const t = i18nPut(k), m = raw.match(/^(\s*)[\s\S]*?(\s*)$/);
    if(raw.trim() !== t) n.nodeValue = m[1] + t + m[2];
  }else if(n.nodeType === 1){
    I18N_ATTR.forEach(a => { const v = n.getAttribute(a); if(v == null) return; n._ka = n._ka || {}; const k = (v in I18N.en) ? v : (n._ka[a] || v); if(!(k in I18N.en)) return; n._ka[a] = k; const t = i18nPut(k); if(v !== t) n.setAttribute(a, t); });
  }
}
function i18nAll(root){
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while((n = w.nextNode())){ const tg = n.parentNode.tagName; if(tg !== 'SCRIPT' && tg !== 'STYLE') i18nNode(n); }
  if(root.nodeType === 1){ i18nNode(root); root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(i18nNode); }
}
/* Reaplica el idioma a todas las vistas dinámicas: algunas etiquetas se arman
   pegando texto con datos (nombre del negocio, período elegido…) y por eso no
   basta con barrer el DOM — hay que volver a generarlas para que también queden
   en el idioma elegido, estén o no visibles en este momento. */
try{ const dets = document.querySelectorAll('.tv-opt'); let g = null; try{ g = JSON.parse(localStorage.getItem('vito_tvopt') || 'null'); }catch(e){}
  dets.forEach((d, k) => { if(Array.isArray(g)) d.open = g.includes(k); d.addEventListener('toggle', () => { try{ localStorage.setItem('vito_tvopt', JSON.stringify([...dets].map((x, i) => x.open ? i : -1).filter(i => i >= 0))); }catch(e){} }); }); }catch(e){}
function i18nRefreshDynamic(){
  try{ if(typeof data === 'undefined' || !data) return; }catch(e){ return; }
  try{ if(typeof cartaLabel === 'function') cartaLabel(); }catch(e){}
  try{ if(typeof renderCarta === 'function') renderCarta(); }catch(e){}
  try{ if(typeof renderStats === 'function') renderStats(); }catch(e){}
}
function setLang(l){ LANG = l; try{ localStorage.setItem(LANG_KEY, l); }catch(e){} document.documentElement.lang = l; i18nAll(document.body); i18nRefreshDynamic(); }
new MutationObserver(ms => { if(LANG === 'es') return; ms.forEach(m => { if(m.type === 'attributes') i18nNode(m.target); else m.addedNodes.forEach(nd => nd.nodeType === 3 ? i18nNode(nd) : nd.nodeType === 1 && i18nAll(nd)); }); })
  .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: I18N_ATTR });
if(LANG !== 'es'){ document.documentElement.lang = LANG; i18nAll(document.body); }

/* ---------- Efectos de temporada (nieve, murciélagos, corazones, velitas…) ---------- */
const FX_SETS = {
  navidad: ['❄️', '❄', '✨', '🎄'],
  halloween: ['🦇', '🎃', '👻', '🕸️'],
  sanvalentin: ['💘', '❤️', '💕', '✨'],
  velitas: ['🕯️', '✨', '💛', '🌟'],
  fiesta: ['🎉', '🎊', '✨', '🥳'],
  futbol: ['⚽', '🏆', '⭐', '🇨🇴'],
  cerveza: ['🍺', '🍻', '✨', '🥂'],
  cafe: ['☕', '🥐', '✨', '🤎'],
  flores: ['🌸', '🌼', '🌺', '🌷'],
  playa: ['🌴', '☀️', '🍹', '🌊'],
  estrellas: ['⭐', '✨', '🌟', '💫'],
  musica: ['🎵', '🎶', '🎸', '✨'],
  otono: ['🍂', '🍁', '🍃', '🌰'],
  burbujas: ['🫧', '🫧', '✨', '💧']
};
window.FX_SETS_ALL = FX_SETS;
function fxSet(kind){
  let L = document.getElementById('fxLayer');
  const E = FX_SETS[kind];
  if(!E){ if(L) L.remove(); return; }
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!L){ L = document.createElement('div'); L.id = 'fxLayer'; L.setAttribute('aria-hidden', 'true'); document.body.appendChild(L); }
  L.innerHTML = '';
  for(let i = 0; i < 18; i++){ const s = document.createElement('span'); s.textContent = E[i % 4];
    s.style.cssText = 'left:' + (Math.random() * 100) + 'vw;font-size:' + (12 + Math.random() * 14) + 'px;animation-duration:' + (9 + Math.random() * 10) + 's,' + (3 + Math.random() * 3) + 's;animation-delay:' + (-Math.random() * 14) + 's,0s'; L.appendChild(s); }
}

document.getElementById('langSel').value = LANG;
document.getElementById('langSel').addEventListener('change', e => setLang(e.target.value));

/* ---------- Estadísticas: ventas e inventario con gráficas ---------- */
let stPer = '7';
const stMoney = n => fmt(Math.round(n || 0));
function stBars(items){                          // columnas verticales [{l,v,t}]
  const mx = Math.max(1, ...items.map(i => i.v)), every = Math.ceil(items.length / 8);
  return '<div class="st-bars">' + items.map((i, k) => '<div class="st-col" title="' + invEsc(i.t) + '"><div class="st-bar" style="height:' + (i.v ? Math.max(3, Math.round(i.v / mx * 100)) : 0) + '%"></div><span>' + (k % every === 0 ? invEsc(i.l) : '') + '</span></div>').join('') + '</div>';
}
function stRows(items){                          // barras horizontales [{l,v,t,c}]
  const mx = Math.max(1, ...items.map(i => i.v));
  return items.map(i => '<div class="st-row"><div class="st-rl" title="' + invEsc(i.l) + '">' + invEsc(i.l) + '</div><div class="st-rt"><i style="width:' + Math.max(2, Math.round(i.v / mx * 100)) + '%' + (i.c ? ';background:' + i.c : '') + '"></i></div><b>' + invEsc(i.t) + '</b></div>').join('');
}
function stDonut(parts){                         // [{l,v,c}]
  const tot = parts.reduce((a, p) => a + p.v, 0); if(!tot) return '';
  let off = 0;
  const segs = parts.filter(p => p.v > 0).map(p => { const pc = p.v / tot * 100, sg = '<circle r="15.9155" cx="21" cy="21" fill="none" stroke="' + p.c + '" stroke-width="7" stroke-dasharray="' + pc + ' ' + (100 - pc) + '" stroke-dashoffset="' + (25 - off) + '"/>'; off += pc; return sg; }).join('');
  return '<div class="st-donut"><svg viewBox="0 0 42 42" width="130" height="130">' + segs + '</svg><div>' + parts.map(p => '<div class="st-leg"><i style="background:' + p.c + '"></i>' + invEsc(p.l) + ' <b>' + stMoney(p.v) + '</b> <small>' + Math.round(p.v / tot * 100) + '%</small></div>').join('') + '</div></div>';
}
const stCard = (t, b) => '<div class="st-card"><h3>' + t + '</h3>' + b + '</div>';
const stKpi = (l, v) => '<div class="st-kpi"><small>' + l + '</small><b>' + v + '</b></div>';

// ---------- Comparativo por semana y mes calendario (independiente del filtro de período) ----------
function stStartOfWeek(d){ const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function stSumBetween(from, to){ return (data.history || []).reduce((s, h) => { const t = new Date(h.date).getTime(); return (t >= from && t < to) ? s + (h.total || 0) : s; }, 0); }
function stPctChange(cur, prev){
  if(prev === 0 && cur === 0) return '—';
  if(prev === 0) return '▲ 100%';
  const pc = Math.round((cur - prev) / prev * 100);
  return (pc >= 0 ? '▲ ' : '▼ ') + Math.abs(pc) + '%';
}
function calendarComparisonCard(){
  const now = new Date(), nowMs = Date.now() + 1;
  const wStart = stStartOfWeek(now), wStartMs = +wStart, prevWStart = wStartMs - 7 * 864e5;
  const thisWeek = stSumBetween(wStartMs, nowMs), lastWeek = stSumBetween(prevWStart, wStartMs);
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1), prevMStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = stSumBetween(+mStart, nowMs), lastMonth = stSumBetween(+prevMStart, +mStart);
  return stCard('📅 Comparativo (semana y mes calendario)', '<div class="st-kpis">' +
    stKpi('Esta semana', stMoney(thisWeek)) + stKpi('Semana pasada', stMoney(lastWeek)) + stKpi('Cambio semanal', stPctChange(thisWeek, lastWeek)) +
    stKpi('Este mes', stMoney(thisMonth)) + stKpi('Mes pasado', stMoney(lastMonth)) + stKpi('Cambio mensual', stPctChange(thisMonth, lastMonth)) +
    '</div>');
}
/* ---------- Exportar ventas a Excel (hoy, ayer, mes, rango o por cierre) ----------
   Genera un .csv (con BOM y separador ";" para que Excel en español lo abra
   directo, con tildes bien) con el detalle de cada producto vendido en el
   período elegido — mesas, mostrador y domicilios — más el total al final.
   No hace falta ninguna librería extra: Excel abre un .csv sin problema. */
function csvEscape(v){
  v = v == null ? '' : String(v);
  if(/[;"\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function exportSalesRange(from, to, label){
  const rows = (data.history || []).filter(h => { const d = new Date(h.date); return d >= from && d <= to; });
  if(!rows.length){ showToast('No hay ventas registradas en ese período.'); return; }
  const lines = [['Fecha', 'Hora', 'Tipo', 'Mesa / Cliente', 'Producto', 'Cantidad', 'Precio unidad', 'Subtotal', 'Forma de pago', 'Vendedor']];
  let totalPeriodo = 0;
  rows.slice().reverse().forEach(h => {
    const dh = new Date(h.date);
    const fecha = dh.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = dh.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const tipo = h.table == null ? (h.delivery ? 'Domicilio' : 'Mostrador') : 'Mesa';
    const quien = (h.delivery && h.delivery.cliente) ? h.delivery.cliente : (h.tableName || (h.table != null ? (i18nPut(espacioN()) + ' ' + h.table) : ''));
    const metodo = (h.payments || []).map(p => p.method).join(' + ') || '';
    (h.items || []).forEach(it => {
      lines.push([fecha, hora, tipo, quien, it.name, it.qty, it.price, it.qty * it.price, metodo, h.by || '']);
    });
    totalPeriodo += h.total || 0;
  });
  lines.push([]);
  lines.push(['', '', '', '', '', '', '', 'TOTAL DEL PERÍODO', totalPeriodo, '']);
  const csv = lines.map(r => r.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ventas-' + label + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('📥 Ventas descargadas — ábrelo con Excel.');
}
// ---------- Modal "Exportar ventas": elegir el período ----------
function exportOverlayShow(){
  document.getElementById('exportRangeFields').hidden = true;
  document.getElementById('exportClosureFields').hidden = true;
  const sel = document.getElementById('exportClosureSel');
  const closures = data.closures || [];
  sel.innerHTML = closures.length
    ? closures.map(c => '<option value="' + c.id + '">' + new Date(c.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' · ' + fmt(c.totalSold || 0) + '</option>').join('')
    : '<option value="">No hay cierres guardados todavía</option>';
  document.getElementById('exportOverlay').classList.add('show');
}
function exportOverlayClose(){ document.getElementById('exportOverlay').classList.remove('show'); }
document.getElementById('exportSalesExcelBtn').addEventListener('click', exportOverlayShow);
document.getElementById('exportCancelBtn').addEventListener('click', exportOverlayClose);
document.getElementById('exportOverlay').addEventListener('click', e => { if(e.target.id === 'exportOverlay') exportOverlayClose(); });
document.getElementById('exportPeriodBtns').addEventListener('click', e => {
  const b = e.target.closest('button[data-per]'); if(!b) return;
  const per = b.dataset.per;
  document.getElementById('exportRangeFields').hidden = per !== 'rango';
  document.getElementById('exportClosureFields').hidden = per !== 'cierre';
  const now = new Date();
  if(per === 'hoy'){
    const from = new Date(now); from.setHours(0,0,0,0);
    const to = new Date(now); to.setHours(23,59,59,999);
    exportSalesRange(from, to, 'hoy-' + now.toISOString().slice(0,10));
  } else if(per === 'ayer'){
    const from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0,0,0,0);
    const to = new Date(from); to.setHours(23,59,59,999);
    exportSalesRange(from, to, 'ayer-' + from.toISOString().slice(0,10));
  } else if(per === 'mes'){
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now); to.setHours(23,59,59,999);
    exportSalesRange(from, to, 'mes-' + now.toISOString().slice(0,7));
  } else if(per === 'rango'){
    const today = now.toISOString().slice(0,10);
    document.getElementById('exportFrom').value = today;
    document.getElementById('exportTo').value = today;
  }
  // 'cierre' solo muestra el selector — se descarga con el botón de abajo.
});
document.getElementById('exportRangeBtn').addEventListener('click', () => {
  const fromVal = document.getElementById('exportFrom').value, toVal = document.getElementById('exportTo').value;
  if(!fromVal || !toVal){ showToast('Elige la fecha de inicio y de fin.'); return; }
  const from = new Date(fromVal + 'T00:00:00'), to = new Date(toVal + 'T23:59:59');
  if(from > to){ showToast('La fecha "Desde" no puede ser después de "Hasta".'); return; }
  exportSalesRange(from, to, fromVal + '_a_' + toVal);
});
document.getElementById('exportClosureBtn').addEventListener('click', () => {
  const id = document.getElementById('exportClosureSel').value;
  const c = (data.closures || []).find(x => x.id === id);
  if(!c){ showToast('Elige un cierre de la lista.'); return; }
  const to = new Date(c.date);
  const from = c.from ? new Date(c.from) : new Date(0);
  exportSalesRange(from, to, 'cierre-' + to.toISOString().slice(0,10));
});

function renderStats(){
  const box = document.getElementById('statsBody'); if(!box) return;
  document.querySelectorAll('#stPer button').forEach(b => b.classList.toggle('on', b.dataset.p === stPer));
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const from = stPer === 'hoy' ? +d0 : stPer === '7' ? +d0 - 6 * 864e5 : stPer === '30' ? +d0 - 29 * 864e5 : 0;
  const H = (data.history || []).filter(h => new Date(h.date).getTime() >= from);
  const cn = {}, catOf = {}; data.categories.forEach(k => cn[k.id] = k.name); data.products.forEach(p => catOf[cartaNrm(p.name)] = cn[p.categoryId] || 'Otros');
  const total = H.reduce((a, h) => a + (h.total || 0), 0), debt = H.reduce((a, h) => a + (h.debt || 0), 0);
  let units = 0; const prod = {}, cats = {}, mesas = {}, emps = {}, meth = {}, hours = Array(24).fill(0), tl = {};
  let knownRevenue = 0, margin = 0, hasCostData = false; const profit = {};
  H.forEach(h => {
    const dt = new Date(h.date); hours[dt.getHours()] += h.total || 0;
    const tk = stPer === 'hoy' ? dt.getHours() : stPer === 'todo' ? dt.getFullYear() + '-' + dt.getMonth() : dt.toDateString();
    tl[tk] = (tl[tk] || 0) + (h.total || 0);
    const mk = h.tableName || (h.table != null ? i18nPut(espacioN()) + ' ' + h.table : '—'); mesas[mk] = (mesas[mk] || 0) + (h.total || 0);
    if(h.by){ const ek = h.by; emps[ek] = emps[ek] || { v: 0, n: 0 }; emps[ek].v += h.total || 0; emps[ek].n++; }
    (h.payments || []).forEach(p => { meth[p.method] = (meth[p.method] || 0) + (p.amount || 0); });
    (h.items || []).forEach(it => { const v = it.qty * it.price; units += it.qty; const nv = nombreVigente(it.name); const P = prod[nv] = prod[nv] || { q: 0, v: 0 }; P.q += it.qty; P.v += v; const c = catOf[cartaNrm(nv)] || 'Otros'; cats[c] = (cats[c] || 0) + v;
      if(it.cost != null){ hasCostData = true; const g = v - it.qty * it.cost; knownRevenue += v; margin += g; const G = profit[nombreVigente(it.name)] = profit[nombreVigente(it.name)] || { q: 0, g: 0 }; G.q += it.qty; G.g += g; }
    });
  });
  let prevTotal = null;                          // ventas del período anterior de igual duración (para comparar)
  if(stPer !== 'todo'){
    const span = stPer === 'hoy' ? 864e5 : stPer === '7' ? 7 * 864e5 : 30 * 864e5, pf = from - span;
    prevTotal = data.history.reduce((a, h) => { const t = new Date(h.date).getTime(); return t >= pf && t < from ? a + (h.total || 0) : a; }, 0);
  }
  let tItems = [];                               // ventas en el tiempo
  if(stPer === 'hoy') tItems = hours.map((v, i) => ({ l: i + 'h', v, t: i + ':00 · ' + stMoney(v) }));
  else if(stPer === 'todo'){
    if(H.length){ const a = new Date(Math.min(...H.map(h => +new Date(h.date)))), n = new Date(); let y = a.getFullYear(), m = a.getMonth(), c = 0;
      while((y < n.getFullYear() || (y === n.getFullYear() && m <= n.getMonth())) && c++ < 36){ const v = tl[y + '-' + m] || 0; tItems.push({ l: (m + 1) + '/' + String(y).slice(2), v, t: (m + 1) + '/' + y + ' · ' + stMoney(v) }); if(++m > 11){ m = 0; y++; } }
      tItems = tItems.slice(-24); }
  } else for(let i = 0; i < +stPer; i++){ const d = new Date(from); d.setDate(d.getDate() + i); const v = tl[d.toDateString()] || 0; tItems.push({ l: d.getDate() + '/' + (d.getMonth() + 1), v, t: d.getDate() + '/' + (d.getMonth() + 1) + ' · ' + stMoney(v) }); }
  const top = (o, n, f) => Object.entries(o).sort((a, b) => f(b[1]) - f(a[1])).slice(0, n);
  const MC = { efectivo: ['Efectivo', '#4cd97b'], transferencia: ['Transferencia', '#4aa3ff'], debe: ['Fiado (debe)', '#ff5a5a'] };
  let cmpValue = null;                           // ▲/▼ % vs. el período anterior de igual duración
  if(prevTotal != null){
    if(prevTotal === 0 && total === 0) cmpValue = '—';
    else if(prevTotal === 0) cmpValue = '▲ 100%';
    else{ const pc = Math.round((total - prevTotal) / prevTotal * 100); cmpValue = (pc >= 0 ? '▲ ' : '▼ ') + Math.abs(pc) + '%'; }
  }
  const marginPct = knownRevenue > 0 ? Math.round(margin / knownRevenue * 100) : 0;
  const profitCard = !hasCostData
    ? stCard('💹 Rentabilidad', '<div class="empty-state">Configura el costo de tus productos (en Productos → Editar) para ver aquí el margen de ganancia.</div>')
    : stCard('💹 Rentabilidad', '<div class="st-kpis">' + stKpi('🧮 Margen bruto', stMoney(margin)) + stKpi('📊 Margen %', marginPct + '%') + '</div>' +
        '<div class="st-sub">🥇 Más rentable (margen)</div>' +
        stRows(top(profit, 8, x => x.g).map(([n, x]) => ({ l: n, v: Math.max(0, x.g), t: stMoney(x.g) + ' · ' + x.q + ' u' }))));
  const sales = !H.length ? '<div class="empty-state">No hay ventas cobradas en este período. Las estadísticas se llenan cuando cierras cuentas.</div>' : [
    '<div class="st-kpis">' + stKpi('💰 Ventas', stMoney(total)) + stKpi('🧾 Cuentas', H.length) + stKpi('🎟️ Ticket promedio', stMoney(total / H.length)) + stKpi('🍺 Unidades vendidas', units) + stKpi('📒 Fiado (debe)', stMoney(debt)) + stKpi('📅 Promedio por día', stMoney(total / Math.max(1, stPer === 'todo' ? new Set(H.map(h => new Date(h.date).toDateString())).size : stPer === 'hoy' ? 1 : +stPer))) + (cmpValue != null ? stKpi('📊 Vs. período anterior', cmpValue) : '') + '</div>',
    stCard(i18nPut('📈 Ventas ' + (stPer === 'hoy' ? 'por hora' : stPer === 'todo' ? 'por mes' : 'por día')), stBars(tItems)),
    stCard('🏆 Lo más vendido (unidades)', stRows(top(prod, 8, x => x.q).map(([n, x]) => ({ l: n, v: x.q, t: x.q + ' u · ' + stMoney(x.v) })))),
    profitCard,
    stCard('💳 Cómo te pagaron', stDonut(Object.keys(meth).map(k => ({ l: (MC[k] || [k])[0], v: meth[k], c: (MC[k] || [0, '#b58cff'])[1] })))),
    stCard('🗂️ Ventas por categoría', stRows(top(cats, 8, x => x).map(([n, v], i) => ({ l: n, v, t: stMoney(v), c: 'var(--cat-' + (i % 6 + 1) + ')' })))),
    stPer === 'hoy' ? '' : stCard('🕒 Horas pico (en el período)', stBars(hours.map((v, i) => ({ l: i + 'h', v, t: i + ':00 · ' + stMoney(v) })))),
    stCard('🪑 Ventas por mesa', stRows(top(mesas, 8, x => x).map(([n, v]) => ({ l: n, v, t: stMoney(v) })))),
    Object.keys(emps).length < 2 ? '' : stCard('👤 Ventas por empleado (turno)', stRows(top(emps, 8, x => x.v).map(([n, x]) => ({ l: n, v: x.v, t: stMoney(x.v) + ' · ' + x.n + ' cuenta' + (x.n === 1 ? '' : 's') }))))
  ].join('');
  const tr = data.products.filter(p => p.stock != null), cnt = s2 => data.products.filter(p => invStatus(p) === s2).length;
  const key = p => invDays(p) == null ? 1e6 + p.stock : invDays(p), COL = { out: '#ff5a5a', low: '#f5b83d', ok: '#4cd97b' };
  const inv = '<div class="st-kpis">' + stKpi('📦 Valor del stock (a precio de venta)', stMoney(tr.reduce((a, p) => a + p.stock * p.price, 0))) + stKpi('🧮 Productos con control', tr.length + ' de ' + data.products.length) + stKpi('🚫 Agotados', cnt('out')) + stKpi('⚠️ Por agotarse', cnt('low')) + '</div>' +
    (tr.length ? stCard('📉 Se agotan primero', stRows(tr.slice().sort((a, b) => key(a) - key(b)).slice(0, 10).map(p => { const d = invDays(p); return { l: p.name, v: p.stock, c: COL[invStatus(p)], t: p.stock + ' u' + (d != null ? ' · ≈' + (d < 1 ? 'hoy' : Math.round(d) + ' d') : '') }; })))
      : '<div class="empty-state">Aún no controlas stock. Configúralo en Inventario para ver estas gráficas.</div>');
  box.innerHTML = '<h3 class="st-h">💵 Ventas</h3>' + sales + calendarComparisonCard() + '<h3 class="st-h">📦 Inventario</h3>' + inv;
  try{ window.ventoTablero && window.ventoTablero.pintar(stPer); }catch(e){ console.error('vento-tablero', e); }
}
document.getElementById('stPer').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if(b){ stPer = b.dataset.p; renderStats(); } });

/* ---------- Carta: menú / carta / catálogo según el tipo de local ---------- */
// Cómo se llama la lista de precios según el negocio: Menú, Carta, Servicios, Tarifas, Catálogo…
const cartaTerm = () => { const t = data.businessType && window.VENTO_NEGOCIOS.get(data.businessType); return t ? t.carta : 'Carta'; };
const cartaIcon = () => { const t = data.businessType && window.VENTO_NEGOCIOS.get(data.businessType); return t ? t.icCarta : '📖'; };
// La pestaña de la carta es «lo que ven tus clientes»: si se llamara igual que la de
// productos (ej. Servicios y Servicios), se le pone «Lista de precios» para no repetir.
function cartaTab(){
  try{ const pr = (typeof producto1 === 'function') ? producto1()[1] : 'Productos';
    if(cartaTerm().toLowerCase() === String(pr).toLowerCase()) return 'Lista de precios'; }catch(e){}
  return cartaTerm();
}
function cartaLabel(){
  try{ aplicarVocabulario(); }catch(e){}
  const b = document.getElementById('cartaTab'), l = b && b.querySelector('.nav-lbl');
  if(l) l.textContent = i18nPut(cartaTab()); else if(b) b.textContent = i18nPut(cartaIcon() + ' ' + cartaTab());
  const ml = document.getElementById('moreCartaLbl'), mi = document.getElementById('moreCartaIc');
  if(ml) ml.textContent = i18nPut(cartaTab());
  if(mi) mi.textContent = cartaIcon();
}
const cartaNrm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function cartaData(q){                          // [[categoría, [productos]]] en el orden de tus categorías
  const g = {}, names = {}; data.categories.forEach(k => names[k.id] = k.name);
  data.products.forEach(p => { if(q && !cartaNrm(p.name + ' ' + (p.size || '')).includes(q)) return; const k = names[p.categoryId] || 'Otros'; (g[k] = g[k] || []).push(p); });
  return Object.keys(g).sort((a, b) => (a === 'Otros') - (b === 'Otros')).map(k => [k, g[k]]);
}
const cartaNom = p => p.name + (p.size ? ' ' + p.size : '');
function renderCarta(){
  cartaLabel();
  document.getElementById('cartaT').textContent = i18nPut(cartaIcon() + ' ' + cartaTerm()) + (data.businessName ? ' · ' + data.businessName : '');
  const q = cartaNrm(document.getElementById('cartaQ').value.trim()), gs = cartaData(q);
  document.getElementById('cartaList').innerHTML = gs.length ? gs.map(([k, ps], i) => '<details' + (i === 0 || q ? ' open' : '') + ' style="margin:8px 0"><summary style="cursor:pointer;font-weight:600;padding:6px 0">' + invEsc(k) + ' <small style="opacity:.7">(' + ps.length + ')</small></summary>' +
    ps.map(p => { const s = invStatus(p); return '<div class="inv-row"' + (s === 'out' ? ' style="opacity:.55"' : '') + '><div><b>' + invEsc(cartaNom(p)) + '</b>' + (s === 'out' ? '<small>🚫 Agotado</small>' : s === 'low' ? '<small>⚠️ Últimas unidades</small>' : '') + '</div><b>' + fmt(p.price) + '</b></div>'; }).join('') + '</details>').join('')
    : '<div class="empty-state">' + i18nPut(q ? 'Nada coincide con la búsqueda.' : 'Agrega productos para armar tu lista (' + cartaTerm().toLowerCase() + ').') + '</div>';
  if(typeof renderPromos === 'function') renderPromos();
}
function cartaText(){
  let t = i18nPut(cartaTerm()) + (data.businessName ? ' · ' + data.businessName : '') + '\n';
  cartaData('').forEach(([k, ps]) => { t += '\n*' + k + '*\n'; ps.forEach(p => { t += '• ' + cartaNom(p) + ' — ' + fmt(p.price) + (invStatus(p) === 'out' ? ' (agotado)' : '') + '\n'; }); });
  return t;
}
document.getElementById('cartaQ').addEventListener('input', renderCarta);
document.getElementById('cartaPub').addEventListener('click', async () => {
  const e = document.getElementById('cartaEstado'); e.textContent = 'Publicando…';
  if(window.vitoPublicarCatalogo){ await window.vitoPublicarCatalogo(true); e.textContent = document.getElementById('catPubEstado').textContent; }
});
document.getElementById('cartaCopy').addEventListener('click', () => {
  const t = cartaText();
  if(navigator.share) navigator.share({ text: t }).catch(() => {});
  else if(navigator.clipboard) navigator.clipboard.writeText(t).then(() => showToast('📋 Copiado. Pégalo donde quieras.'));
});
document.getElementById('cartaPrint').addEventListener('click', () => {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f);
  const d = f.contentDocument; d.open();
  d.write('<title>' + invEsc(i18nPut(cartaTerm())) + '</title><body style="font-family:Georgia,serif;max-width:520px;margin:20px auto"><h1>' + invEsc(i18nPut(cartaTerm()) + (data.businessName ? ' · ' + data.businessName : '')) + '</h1>' +
    cartaData('').map(([k, ps]) => '<h2 style="border-bottom:1px solid #999">' + invEsc(k) + '</h2>' + ps.map(p => '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>' + invEsc(cartaNom(p)) + (invStatus(p) === 'out' ? ' <i>(agotado)</i>' : '') + '</span><b>' + fmt(p.price) + '</b></div>').join('')).join('') + '</body>');
  d.close(); setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300);
});

/* ---------- Productos repetidos ---------- */
const dupKey = p => [p.name, p.size].map(t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(\d)\s*(ml|cc|cl)\b/g, '$1').replace(/[^a-z0-9]/g, '')).join('|');
function dupGroups(){
  const m = {}; data.products.forEach(p => (m[dupKey(p)] = m[dupKey(p)] || []).push(p));
  return Object.values(m).filter(g => g.length > 1);
}
function dupMerge(keep, gone){                 // pasa stock, cuentas de mesa y ventas de "gone" a "keep"
  if(!keep || !gone || keep.id === gone.id) return;
  if(gone.stock != null) keep.stock = (keep.stock || 0) + gone.stock;
  if(keep.minStock == null && gone.minStock != null) keep.minStock = gone.minStock;
  if(!keep.categoryId && gone.categoryId) keep.categoryId = gone.categoryId;
  Object.values(data.tables).forEach(t => {
    let moved = false;
    (t.items || []).forEach(it => { if(it.productId === gone.id){ it.productId = keep.id; moved = true; } });
    if(!moved) return;
    const seen = {};                            // si quedaron dos líneas iguales en la misma mesa/persona, se suman
    t.items = t.items.filter(it => { const k = it.productId + '|' + (it.personId || ''), f = seen[k]; if(!f){ seen[k] = it; return true; } f.qty += it.qty; f.history = (f.history || []).concat(it.history || []); return false; });
  });
  (data.stockLog || []).forEach(l => { if(l.p === gone.id) l.p = keep.id; });
  data.products = data.products.filter(p => p.id !== gone.id);
}
function dupOpen(){
  const gs = dupGroups(), SEL = 'style="padding:9px;font-size:14px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;width:100%"';
  const lbl = p => invEsc(p.name + (p.size ? ' ' + p.size : '')) + ' · $' + p.price + (p.stock != null ? ' · stock ' + p.stock : ' · sin stock');
  const opts = '<option value="">—</option>' + data.products.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => '<option value="' + p.id + '">' + lbl(p) + '</option>').join('');
  invDlg('<b>🧩 Unir productos repetidos</b>' + (gs.length
    ? '<small style="color:var(--ink-soft)">Marca cuál conservar en cada grupo. Se suma el stock y las cuentas de mesa pasan al que conserves.</small>' + gs.map((g, i) => {
        const best = Math.max(0, g.findIndex(p => p.stock != null));
        return '<div style="border:1px solid var(--line);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px">' + g.map((p, j) => '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="radio" name="dg' + i + '" value="' + p.id + '"' + (j === best ? ' checked' : '') + '><span>' + lbl(p) + '</span></label>').join('') + '</div>';
      }).join('')
    : '<div style="font-size:14px">No hay repetidos exactos.</div>') +
    '<small style="color:var(--ink-soft)">Unir a mano (nombres distintos que son el mismo producto):</small><select id="dmKeep" ' + SEL + '>' + opts + '</select><small style="color:var(--ink-soft)">Se une con este y este desaparece:</small><select id="dmGone" ' + SEL + '>' + opts + '</select>',
    o => {
      let n = 0;
      gs.forEach((g, i) => { const c = o.querySelector('input[name="dg' + i + '"]:checked'), keep = g.find(p => c && p.id === c.value); g.forEach(p => { if(p !== keep){ dupMerge(keep, p); n++; } }); });
      const k = data.products.find(p => p.id === o.querySelector('#dmKeep').value), x = data.products.find(p => p.id === o.querySelector('#dmGone').value);
      if(k && x && k !== x){ dupMerge(k, x); n++; }
      if(n){ saveData(); renderInventario(); renderProductos(); renderMesas(); showToast('✅ ' + n + ' producto' + (n > 1 ? 's' : '') + ' unido' + (n > 1 ? 's' : '') + '. Revisa el stock y ajústalo con "Contar" si hace falta.'); }
    });
}
function invAsk(id, act){
  const p = data.products.find(x => x.id === id); if(!p) return;
  const q = { in: '¿Cuántas unidades entraron de "' + p.name + '"?', count: 'Conteo real: ¿cuántas unidades hay ahora de "' + p.name + '"?', min: 'Avisar cuando queden esta cantidad o menos de "' + p.name + '":' }[act];
  const def = act === 'count' ? (p.stock != null ? p.stock : '') : act === 'min' ? (p.minStock != null ? p.minStock : INV_DEF_MIN) : '';
  invDlg('<div>' + invEsc(q) + '</div><input ' + INV_IN + ' value="' + def + '">', o => {
    const v = invNum(o.querySelector('input').value); if(v == null) return;
    const antes = p.stock;
    if(act === 'in') p.stock = (p.stock || 0) + v; else if(act === 'count') p.stock = v; else p.minStock = v;
    if(act !== 'min'){ data.inventarioMov = data.inventarioMov || [];
      data.inventarioMov.push({ id: Date.now() + '-' + p.id, tipo: act === 'in' ? 'entrada manual' : 'conteo', productId: p.id, name: p.name,
        qty: act === 'in' ? v : v - (antes || 0), usuario: authUser || '', at: Date.now() }); }
    saveData(); renderInventario(); renderProductos();
    if(act === 'in') showToast('✅ ' + p.name + ': ahora hay ' + p.stock);
  });
}
// Un producto puede estar en 4 estados según su margen: perdiendo plata (precio
// por debajo del costo), margen muy bajo, margen justo, o ganando bien — se usa
// tanto para la clase de color de cada fila como para el texto claro que pide
// Cristhian ("que me diga cuánto le estoy ganando o perdiendo").
function invMarginStatus(pct){
  if(pct < 0) return { cls: 'mt-loss', label: '❌ Perdiendo' };
  if(pct <= 15) return { cls: 'mt-bad', label: '⚠️ Margen muy bajo' };
  if(pct < 25) return { cls: 'mt-warn', label: '🟡 Margen justo' };
  return { cls: 'mt-ok', label: '✅ Ganando bien' };
}
function invMarginRowClass(pct){ return invMarginStatus(pct).cls; }
// Gráfica de barras horizontales que sí distingue ganancia de pérdida (barra
// verde hacia un lado, roja hacia el otro), a diferencia de hbarras() que solo
// sirve para valores positivos (ventas, unidades vendidas, etc.).
function hbarrasGanPerd(t, rows, f){
  if(!rows.length) return '';
  const mx = Math.max(...rows.map(r => Math.abs(r[1])), 1);
  return '<div class="chart-box"><h3>' + invEsc(t) + '</h3>' + rows.map(r => {
    const v = r[1], pct = Math.min(100, Math.round(Math.abs(v) / mx * 100));
    const color = v < 0 ? '#ff5a5a' : '#4cd97b';
    const sign = v > 0 ? '+' : (v < 0 ? '−' : '');
    return '<div style="display:flex;gap:6px;align-items:center;font-size:12px;margin:4px 0">' +
      '<span style="width:36%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + invEsc(r[0]) + '</span>' +
      '<span style="flex:1;background:var(--line);border-radius:4px"><i style="display:block;height:12px;width:' + pct + '%;background:' + color + ';border-radius:4px"></i></span>' +
      '<b style="color:' + color + '">' + sign + f(Math.abs(v)) + '</b></div>';
  }).join('') + '</div>';
}
function renderMarginTable(){
  const wrap = document.getElementById('marginTableWrap'), block = document.getElementById('marginBlock'), chartWrap = document.getElementById('marginChartWrap');
  if(!wrap || !block) return;
  // Las cuentas salen de cuentasProducto(): descuentan el IVA y multiplican por la
  // cantidad que hay en inventario, para ver la plata metida y la ganancia real.
  const rows = data.products.filter(p => !p.combo && p.cost != null && p.cost > 0 && p.price > 0)
    .map(p => ({ p, c: cuentasProducto(p) }))
    .sort((a, b) => (a.c.margen || 0) - (b.c.margen || 0) || a.p.name.localeCompare(b.p.name));
  block.style.display = rows.length ? 'block' : 'none';
  if(!rows.length){ wrap.innerHTML = ''; if(chartWrap) chartWrap.innerHTML = ''; return; }
  const hayIva = rows.some(r => r.c.conIva), hayCant = rows.some(r => r.c.cant != null);
  wrap.innerHTML = '<table class="margin-table"><thead><tr><th>Producto</th>' +
    '<th>Costo' + (hayIva ? ' sin IVA' : '') + '</th><th>Precio' + (hayIva ? ' sin IVA' : '') + '</th>' +
    '<th>Margen</th><th>Ganas por unidad</th>' + (hayCant ? '<th>Cantidad</th><th>Plata metida</th><th>Ganancia total</th>' : '') +
    '</tr></thead><tbody>' +
    rows.map(r => {
      const st = invMarginStatus(Math.round(r.c.margen || 0));
      return '<tr class="' + st.cls + '"><td>' + invEsc(r.p.name + (r.p.size ? ' ' + r.p.size : '')) + '</td>' +
        '<td class="mt-num">' + fmt(Math.round(r.c.costoNeto)) + '</td>' +
        '<td class="mt-num">' + fmt(Math.round(r.c.precioNeto)) + '</td>' +
        '<td class="mt-num">' + fmtPct(r.c.margen) + '</td>' +
        '<td class="mt-num">' + fmt(Math.round(r.c.utilidad)) + '</td>' +
        (hayCant ? '<td class="mt-num">' + (r.c.cant == null ? '—' : r.c.cant) + '</td>' +
          '<td class="mt-num">' + (r.c.inversion == null ? '—' : fmt(Math.round(r.c.inversion))) + '</td>' +
          '<td class="mt-num">' + (r.c.utilidadTotal == null ? '—' : fmt(Math.round(r.c.utilidadTotal))) + '</td>' : '') +
        '</tr>';
    }).join('') +
    '</tbody></table>' +
    (hayIva ? '<div class="mt-nota">Los números van sin IVA: el IVA que cobras es de la DIAN, y el que le pagas al proveedor se descuenta.</div>' : '');
  // Gráfica: la ganancia (o pérdida) real por unidad, de la peor a la mejor.
  const chartRows = rows.slice().sort((a, b) => (a.c.utilidad || 0) - (b.c.utilidad || 0)).map(r => [r.p.name + (r.p.size ? ' ' + r.p.size : ''), Math.round(r.c.utilidad || 0)]);
  if(chartWrap) chartWrap.innerHTML = hbarrasGanPerd('📊 Ganancia o pérdida por unidad (sin IVA)', chartRows, fmt);
}
function renderInventario(){
  // Productos e inventario son una sola pantalla: aquí solo se arma el resumen de
  // arriba, los avisos y la tabla de márgenes; la lista la pinta renderProductos().
  renderMarginTable();
  const ord = { out: 0, low: 1, ok: 2, none: 3 };
  const ps = data.products.filter(p => !p.combo).sort((a, b) => ord[invStatus(a)] - ord[invStatus(b)] || a.name.localeCompare(b.name));
  const n = s => ps.filter(p => invStatus(p) === s).length;
  const sum = document.getElementById('invSummary');
  if(sum) sum.innerHTML = `<span class="inv-chip inv-out">🚫 ${n('out')} agotados</span><span class="inv-chip inv-low">⚠️ ${n('low')} por agotarse</span><span class="inv-chip inv-ok">✅ ${n('ok')} con stock</span>`;
  const sinCtl = ps.filter(p => p.stock == null).length;
  const nDup = dupGroups().length;
  const avisoDup = nDup ? '<div class="inv-aviso">⚠️ Hay ' + nDup + ' producto(s) repetido(s).<button class="btn-ghost" data-act="dups">Unir repetidos</button></div>' : '';
  const aviso = sinCtl ? '<div class="inv-aviso">📦 ' + sinCtl + ' producto(s) sin control de stock.<button class="btn-ghost" data-act="setup">Ponerles stock</button></div>' : '';
  const av = document.getElementById('invAvisos'); if(av) av.innerHTML = avisoDup + aviso;
  const vieja = document.getElementById('invList'); if(vieja) vieja.innerHTML = '';
  try{ renderProductos(); }catch(e){}
  invBadge();
}
document.getElementById('invAvisos').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if(!b) return; if(b.dataset.act === 'setup') invSetup(); else if(b.dataset.act === 'dups') dupOpen(); else invAsk(b.dataset.id, b.dataset.act); });
document.getElementById('invDup').addEventListener('click', dupOpen);
setTimeout(invBadge, 1500);

/* ---------- Escaneo de factura de proveedor ----------
   Lee la foto de una factura/remisión con la misma IA que reconoce productos,
   detecta cada renglón (producto, cantidad, costo por unidad), lo empareja
   contra el catálogo existente (sin crear duplicados) y avisa cuando el
   proveedor subió el precio, sugiriendo un precio de venta que mantenga el
   margen que ya tenías (o un margen sano por defecto para productos nuevos). */
const INVOICE_TARGET_MARGIN = 0.35;
// Margen a usar por defecto para un producto: el que ya tenía (si era
// razonable) o el margen sano de la app — igual criterio que ya se usaba
// en "Escanear precio y margen" (pcAutoTarget), para que las dos pantallas
// se comporten igual.
function invoiceInferMargin(product){
  if(product && product.cost != null && product.cost > 0 && product.price > 0){
    const m = (product.price - product.cost) / product.price;
    if(m >= 0.05 && m < 0.95) return m;
  }
  return INVOICE_TARGET_MARGIN;
}
function invoicePriceFromMargin(cost, marginPct){
  if(!cost || cost <= 0) return 0;
  const m = Math.max(0, Math.min(0.9, marginPct));
  return Math.round(cost / (1 - m) / 100) * 100;
}
function invoiceSuggestPrice(cost, product){
  if(!cost || cost <= 0) return product ? product.price : 0;
  return invoicePriceFromMargin(cost, invoiceInferMargin(product));
}
// Reglas de detección compartidas entre el prompt de foto y el de texto (PDF con
// texto embebido), para que ambos caminos se comporten igual — ya afinadas con
// facturas reales del usuario (tablas anchas tipo Distribuidora Colombina, nombres
// en clave, y filtrado de renglones de encabezado/dirección que no son productos).
function invoicePromptRules(){
  return 'REGLA PARA SABER QUÉ ES UN PRODUCTO: un renglón es un producto SI Y SOLO SI tiene un precio o valor en pesos al lado (precio unitario, o un total de renglón del que se pueda sacar el precio unitario dividiendo por la cantidad). ' +
    'Si un renglón tiene precio, es un producto y va en items — SIN IMPORTAR que el nombre esté abreviado, en clave, en código de proveedor, en mayúsculas cortadas o mal escrito por el OCR (ej: "CLUB COL BOT X30", "AG LIGH LAT", "COD 4521"). En «original» cópialo tal como aparece impreso (en «nombre» va interpretado). ' +
    'No te saltes NINGÚN renglón que tenga precio, así el nombre te parezca raro o difícil de leer. ' +
    'No inventes renglones ni productos que no tengan un precio visible al lado, y no agregues nada que no esté impreso en la factura. ' +
    'NO incluyas en items los renglones que NO tienen precio propio (encabezados de columna, subtotal, IVA, descuento, total general, "pague así", notas, NIT, fecha, dirección, nombre del vendedor o del cliente, etc.) — esos no son productos. ' +
    'Si la factura es una TABLA con columnas (ítem, código, descripción, cantidad, unidad de medida, precio, descuento, precio neto, IVA, precio final…), usa la columna de CANTIDAD (Cant./Cantidad) como qty, y usa el PRECIO FINAL de ese renglón (el que ya incluye descuentos e impuestos, la última columna de valor) dividido entre qty como unit_cost — es lo que el negocio realmente paga por cada unidad. Si no hay columna de precio final, súmale el IVA al precio neto. No confundas la columna de código/referencia del producto con la cantidad o el precio. ' +
    'ADEMÁS, fíjate si el renglón trae información de EMPAQUE (que casi siempre está en el mismo nombre/descripción del producto, ej: "X24", "X12", "CJ X 30", "PAQ X6", "DISPLAY X20", "FARDO X10"), o si la unidad de medida de la columna (CJ, PQ, DISPLAY, FARDO, DOC…) indica que lo que se compró son cajas/paquetes y no unidades sueltas. En ese caso: cajas = cuántas cajas o paquetes se compraron (el número de la columna de cantidad), y unidades_por_caja = cuántas unidades individuales trae cada caja/paquete (el número que va después de la "X" en el empaque, ej: en "X24" son 24). Si la compra es por unidades sueltas, o no encuentras ningún indicio de empaque, NO inventes nada: pon cajas=1 y unidades_por_caja igual a qty. ' +
    'CUIDADO con contar doble: en tickets de caja (POS) el mismo texto "X30" o "X24" en el nombre a veces es solo la presentación de referencia del producto en el catálogo del proveedor (cuántas unidades trae la caja completa de ESE producto), y la cantidad de la columna YA viene en unidades sueltas vendidas, no en cajas. Pista útil en Colombia: si el nombre dice "LT" o "LATA" seguido de "X" un número (ej: "CLUB COLOMBIA LT X24"), casi siempre se vendió por LATA individual — deja cajas=1 y unidades_por_caja=qty, no multipliques. Si dice "BOT" o "BT" (botella) seguido de "X" un número (ej: "AGUILA BT X30", "POKER BOT X30"), ahí sí suele venderse la caja completa de esa cantidad de botellas — ahí la cantidad de la columna sí son cajas. Cuando no sea claro por el nombre, decide por el precio: calcula el precio por unidad ANTES de aplicar el desglose (precio del renglón entre la cantidad de la columna); si ese precio ya se ve razonable para UNA unidad individual de ese tipo de producto (ej: unos pocos miles de pesos para una cerveza o gaseosa, unos cientos de pesos para un dulce o sobre), la cantidad de la columna YA son unidades sueltas, no multipliques de nuevo — solo trata la cantidad como número de cajas cuando, de no hacerlo, el precio por unidad daría claramente disparatado para una sola unidad (muchos miles o decenas de miles de pesos por un dulce, o cientos de miles por una bebida). ' +
    // Respuesta COMPACTA (listas en vez de nombres de campo largos y sin campos vacíos): la IA escribe
    // 3-4 veces menos texto y la factura sale en pocos segundos. fiExpandirCompacto() la vuelve al formato de siempre.
    'Devuelve SOLO JSON válido y COMPACTO (sin texto extra, sin ```, sin espacios ni saltos de línea de más), con esta forma: ' +
    '{"p":"proveedor","f":"AAAA-MM-DD","h":{"n":"número de factura","nit":"NIT del proveedor","st":subtotal,"iva":iva,"d":descuentos,"t":total},"i":[[original,nombre,qty,und,precio_unit,total_renglon,iva_pct,subtotal_renglon,iva_valor,descuento,codigo,cajas,und_por_caja]]}. ' +
    'En "h" pon solo lo que esté impreso. Cada renglón de "i" es una LISTA con ese orden exacto: ' +
    'original = la descripción del renglón EXACTAMENTE como está impresa (con sus abreviaturas); ' +
    'nombre = el producto INTERPRETADO en limpio para un inventario, entendiendo las abreviaturas (ej. "AG LIGH LAT 330" → "Cerveza Águila Light lata 330 ml", "CLUB COL BOT X30" → "Cerveza Club Colombia botella", "MAGGI CALDO GALLINA 24X594G" → "Caldo de gallina Maggi"); si es un producto ya registrado (lista de abajo), usa EXACTAMENTE ese nombre registrado; ' +
    'qty = cantidad TOTAL de unidades individuales compradas (2 cajas de 24 → 48); und = unidad de medida impresa (UND, CJ, PQ, DISPLAY…) o null; ' +
    'precio_unit = lo que se paga por UNA unidad individual YA con IVA (si solo está el total del renglón, total ÷ qty); total_renglon = valor final impreso del renglón; ' +
    'iva_pct = 0, 5 o 19 si aparece, si no null; subtotal_renglon = valor antes de IVA impreso o null; iva_valor = IVA impreso del renglón o null; descuento = en pesos o null; codigo = código del proveedor o null; ' +
    'cajas y und_por_caja = el desglose de empaque explicado arriba (1 y qty si es suelto; cajas × und_por_caja = qty). ' +
    'NO confundas la cantidad comprada (columna Cant.) con la presentación de la descripción ("24X594G" es presentación, no cantidad). ' +
    'Todo lo que no esté impreso va en null: NUNCA inventes valores. Números en pesos sin puntos ni símbolos. Fechas AAAA-MM-DD. ' + invCatalogHint();
}
function invoicePrompt(){
  return 'Esta es una foto de una factura, remisión o recibo de un PROVEEDOR (lo que el negocio compra, no lo que vende). ' +
    'Lee TODA la tabla de renglones, de arriba a abajo, sin saltarte ninguno. ' + invoicePromptRules();
}
// Para un PDF digital cuyo texto ya se pudo extraer sin necesidad de leerlo como
// imagen (más rápido y más confiable que mandarlo como foto).
function invoicePromptForText(text){
  return 'Este es el TEXTO ya extraído digitalmente (no es una foto) de un PDF de una factura, remisión o recibo de un PROVEEDOR (lo que el negocio compra, no lo que vende). El texto puede tener columnas desalineadas por la forma en que se extrajo, pero los números y nombres impresos son correctos. ' +
    'Lee TODO el texto, de arriba a abajo, sin saltarte ningún renglón. ' + invoicePromptRules() +
    ' Este es el texto de la factura:\n\n' + text;
}
// Convierte la respuesta compacta de la IA al formato de siempre (si ya viene en el formato largo, la deja igual).
function fiExpandirCompacto(info){
  if(!info || Array.isArray(info.items) || !Array.isArray(info.i)) return info;
  const h = info.h || {}, num = v => (v == null || v === '' ? null : v);
  const items = info.i.filter(r => Array.isArray(r) && (r[0] || r[1])).map(r => ({
    original: String(r[0] || r[1] || ''), name: String(r[1] || r[0] || ''), nombreIA: !!r[1],
    qty: num(r[2]), unit: num(r[3]), unit_cost: num(r[4]), line_total: num(r[5]), iva_pct: num(r[6]),
    line_subtotal: num(r[7]), iva_value: num(r[8]), discount: num(r[9]), sku: num(r[10]),
    cajas: num(r[11]), unidades_por_caja: num(r[12])
  }));
  return { supplier: info.p || '', date: info.f || '', items,
    header: { invoiceNumber: num(h.n), supplierNit: num(h.nit), subtotal: num(h.st), iva: num(h.iva), descuentos: num(h.d), total: num(h.t), issueDate: num(info.f) } };
}
// Modo rápido: primera pasada corta (un solo modelo, foto en resolución media, sin darle
// vueltas) — normalmente responde en pocos segundos. Solo si esa pasada falla o no trae
// nada usable se hace un segundo intento más a fondo (probando otro modelo si hace falta),
// igual que ya se hace al reconocer un producto por foto.
// La respuesta sirve si trae la lista de renglones.
const fiLecturaIA = txt => { const i = fiExpandirCompacto(cleanAiJsonText(txt)); return i && Array.isArray(i.items) ? i : null; };
async function recognizeInvoiceWithAI(dataUrl){
  const prompt = invoicePrompt();
  try{
    // Carrera de modelos: el principal y, si en 3 s no respondió, otro en paralelo (ver aiCarrera).
    return await aiCarrera({ prompt, imageDataUrl: dataUrl, json: true, timeoutMs: 16000, fast: true, doc: true, maxOutputTokens: 8000, maxMs: 26000 }, fiLecturaIA, 3000);
  }catch(err){
    if(err && err.kind === 'bad') throw new OpenAIError('bad', 'La IA respondió pero no pude leer la factura. Prueba con una foto más clara, derecha y con buena luz.');
    throw err;
  }
}
// Misma idea que recognizeInvoiceWithAI pero para el texto ya extraído de un PDF
// digital (sin imagen) — más rápido y no depende de que la foto quede bien tomada.
async function recognizeInvoiceWithAIFromText(text){
  const prompt = invoicePromptForText(text);
  try{
    return await aiCarrera({ prompt, json: true, timeoutMs: 20000, fast: true, maxOutputTokens: 8000, maxMs: 32000 }, fiLecturaIA, 3500);
  }catch(err){
    if(err && err.kind === 'bad') throw new OpenAIError('bad', 'La IA respondió pero no pude leer el texto del PDF de la factura.');
    throw err;
  }
}

/* ================= FacturaIQ: entender la factura, no solo copiar el texto =================
   Una sola implementación que usan los dos caminos de lectura (con IA y sin internet):
   1. fiPresentacion(): separa la PRESENTACIÓN (24 x 594 g) de la CANTIDAD comprada.
   2. fiNormalizar(): corrige errores típicos del OCR (33O → 330, AGUlLA → AGUILA, POKFR → POKER),
      expande abreviaturas (DOYP, D/P → DOYPACK; LAT → LATA…) y reconoce marcas colombianas.
      La descripción ORIGINAL nunca se toca: se guarda aparte.
   3. fiCoincidir(): busca el producto en el inventario con un puntaje de confianza 0-100,
      en este orden: código del proveedor, código de barras, equivalencia aprendida,
      nombre exacto, marca + presentación + nombre, y deja la lista de posibles productos.
   4. fiAprender(): cuando confirmas «POKER 330» = «Cerveza Poker lata 330 ml», lo recuerda
      (proveedor + descripción → producto) para la próxima factura.
   5. fiEncabezado(): número, fechas, NIT, CUFE, subtotal, IVA, total… desde el texto leído.
      Lo que no aparece queda en null («Revisar dato»): nunca se inventa.
   6. fiValidar(): suma de renglones + impuestos − descuentos = total, y avisos por renglón.
   7. LayaIA: solo se consulta cuando hay duda entre varios productos (ver más abajo). */
const FI_ABREV = [
  [/\bD\/P\b|\bDOYP\b|\bDOY\s?PACK\b|\bDPK\b/g, 'DOYPACK'], [/\bLAT\b|\bLTA\b/g, 'LATA'], [/\bBOT\b|\bBTL\b|\bBOTLL?\b/g, 'BOTELLA'],
  [/\bCJ\b|\bCJA\b/g, 'CAJA'], [/\bPQ\b|\bPAQ\b|\bPQT\b/g, 'PAQUETE'], [/\bDISP\b|\bDSP\b/g, 'DISPLAY'], [/\bSIX\s?PACK\b|\bSIXP\b/g, 'SIXPACK'],
  [/\bCERV\b|\bCRVZ\b|\bCERVZ\b/g, 'CERVEZA'], [/\bGALL\b|\bGLL\b/g, 'GALLINA'], [/\bGASEO\b|\bGSA\b/g, 'GASEOSA'], [/\bCOND\b/g, 'CONDENSADA'],
  [/\bLCH\b|\bLEC\b/g, 'LECHE'], [/\bAGUARD\b|\bAGTE\b/g, 'AGUARDIENTE'], [/\bRETORN\b|\bRET\b/g, 'RETORNABLE'], [/\bDESC\b/g, 'DESCARTABLE'],
  [/\bPET\b/g, 'PET'], [/\bUND\b|\bUNID\b|\bUN\b/g, 'UND'], [/\bGRS?\b|\bGMS?\b/g, 'G'], [/\bLTS?\b|\bLTR\b/g, 'L'], [/\bMLS?\b|\bCC\b/g, 'ML'],
  [/\bKLS?\b|\bKGS\b|\bKILO\b/g, 'KG'], [/\bCLUB COL\b/g, 'CLUB COLOMBIA'], [/\bAG\b(?=\s+(LIGHT|LIGH|LAT|LATA|BOT|330|350|250))/g, 'AGUILA'],
  [/\bLIGH\b|\bLGT\b|\bLIG\b/g, 'LIGHT'], [/\bORIG\b/g, 'ORIGINAL']
];
// Marcas y productos que más se repiten en tiendas y cantinas de Colombia (para reconocer
// la marca aunque el OCR la escriba mal, y para separar marca de nombre).
const FI_MARCAS = ['AGUILA', 'AGUILA LIGHT', 'POKER', 'CLUB COLOMBIA', 'COSTENA', 'COSTENITA', 'PILSEN', 'CORONA', 'BUDWEISER', 'STELLA ARTOIS',
  'HEINEKEN', 'BBC', 'MILLER', 'TECATE', 'REDDS', 'PONY MALTA', 'POSTOBON', 'COCA COLA', 'PEPSI', 'COLOMBIANA', 'MANZANA POSTOBON', 'QUATRO', 'SPRITE',
  'HIT', 'TAMPICO', 'BRETANA', 'GATORADE', 'POWERADE', 'VIVE 100', 'SPEED MAX', 'RED BULL', 'CRISTAL', 'BRISA', 'MAGGI', 'LA LECHERA', 'NESTLE',
  'NESCAFE', 'COLCAFE', 'SELLO ROJO', 'AGUILA ROJA', 'ALPINA', 'COLANTA', 'ALQUERIA', 'ZENU', 'RICA', 'RAMO', 'NOEL', 'DIANA', 'ROA', 'FLORHUILA',
  'BIMBO', 'MARGARITA', 'DORITOS', 'DE TODITO', 'CHOCORAMO', 'JET', 'JUMBO', 'COLGATE', 'FAMILIA', 'ARIEL', 'FAB', 'DERSA', 'JABON REY', 'PROTEX',
  'ANTIOQUENO', 'NECTAR', 'TRES ESQUINAS', 'RON MEDELLIN', 'RON VIEJO DE CALDAS', 'OLD PARR', 'BUCHANANS', 'SMIRNOFF', 'FRUTINO', 'KNORR', 'FRESCAVENA',
  'QUAKER', 'KELLOGGS', 'CORONA CHOCOLATE', 'LUKER', 'GOL', 'BON BON BUM', 'TRIDENT', 'HALLS', 'PREMIER', 'OLEOCALI', 'GOURMET', 'DORIA', 'COMARRICO'];
const FI_STOP = new Set(['DE', 'LA', 'EL', 'X', 'CO', 'Y', 'EN', 'CON', 'SIN', 'POR', 'PARA', 'DEL', 'LOS', 'LAS', 'UND', 'UNIDAD']);
const fiAscii = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ñ/g, 'N').replace(/ñ/g, 'n');
function fiLev(a, b){
  if(a === b) return 0; if(!a.length) return b.length; if(!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for(let i = 1; i <= a.length; i++){
    const cur = [i];
    for(let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Errores del OCR: letra O dentro de números (33O → 330), l/I minúscula dentro de palabras en
// mayúscula (AGUlLA → AGUILA), S/B/Z confundidas con 5/8/2 dentro de números.
function fiCorregirOCR(s){
  let t = String(s || '');
  t = t.replace(/(\d)[Oo](?=\d|\b|[a-zA-Z]{1,3}\b)/g, '$10').replace(/\b[Oo](\d)/g, '0$1');
  t = t.replace(/(\d)[lI|](?=\d)/g, '$11').replace(/(\d)[Ss](?=\d)/g, '$15').replace(/(\d)[Bb](?=\d)/g, '$18');
  t = t.replace(/([A-ZÁÉÍÓÚÑ])l([A-ZÁÉÍÓÚÑ])/g, '$1I$2').replace(/([A-ZÁÉÍÓÚÑ])0([A-ZÁÉÍÓÚÑ])/g, '$1O$2').replace(/([A-ZÁÉÍÓÚÑ])1([A-ZÁÉÍÓÚÑ])/g, '$1I$2');
  return t;
}
// Separa la presentación: «MAGGI CALDO GALLINA 24X594G CO» → 24 unidades por paquete de 594 g.
// Esto es lo que trae CADA paquete; la cantidad comprada sale de la columna de cantidad.
function fiPresentacion(desc){
  const t = fiAscii(fiCorregirOCR(desc)).toUpperCase().replace(/,/g, '.');
  const U = '(KG|G|GR|GRS|GMS|ML|L|LT|LTS|CC|OZ|UND|UN)';
  // Colombina y similares: (18BS/40/10g) = caja de 18 bolsas, cada bolsa con 40 unidades de 10 g
  const col = t.match(/\(\s*(\d{1,3})\s*(BS|PL|LAT|PP|CJ|DI|DS|PQ)\s*[\/-]\s*(\d{1,3})\s*(?:UN|UND)?\s*[\/-]\s*(\d+(?:\.\d+)?)\s*(G|GR|ML|KG|L)?/);
  // DPX8UNDSX15GR = display de 8 unidades de 15 g
  const dpx = !col && t.match(/X\s*(\d{1,3})\s*UNDS?\s*X\s*(\d+(?:\.\d+)?)\s*(G|GR|ML)\b/);
  let m = col ? null : t.match(new RegExp('(?<![\\d.])(\\d{1,3})\\s*[X\\*]\\s*(\\d+(?:\\.\\d+)?)\\s*' + U + '\\b'));
  const unidadStd = u => ({ GR: 'g', GRS: 'g', GMS: 'g', G: 'g', KG: 'kg', ML: 'ml', CC: 'ml', L: 'l', LT: 'l', LTS: 'l', OZ: 'oz', UND: 'und', UN: 'und' }[u] || u.toLowerCase());
  const out = { presentacion: null, unidadesPorPaquete: null, contenido: null, unidadContenido: null, pesoG: null, volumenMl: null };
  if(col){
    out.unidadesPorPaquete = Number(col[3]) > 1 ? Number(col[3]) : null;
    if(col[5]){ out.contenido = Number(col[4]); out.unidadContenido = unidadStd(col[5]); }
  } else if(dpx){
    out.unidadesPorPaquete = Number(dpx[1]); out.contenido = Number(dpx[2]); out.unidadContenido = unidadStd(dpx[3]);
  } else if(m){
    out.unidadesPorPaquete = Number(m[1]); out.contenido = Number(m[2]); out.unidadContenido = unidadStd(m[3]);
    out.orden = 'nx';   // «24X594G»: primero cuántas trae, luego el peso (que puede ser el total del paquete)
  } else {
    m = t.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + U + '\\s*[X\\*]\\s*(\\d{1,3})\\b'));
    if(m){ out.contenido = Number(m[1]); out.unidadContenido = unidadStd(m[2]); out.unidadesPorPaquete = Number(m[3]); }
    else {
      const s = t.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + U + '\\b'));
      if(s && !/^(UND|UN)$/.test(s[2])){ out.contenido = Number(s[1]); out.unidadContenido = unidadStd(s[2]); }
      const nx = t.match(/\b(\d{1,3})\s*X\s*(\d{2,4})\b/);
      // «LATA 330 X24» = 24 latas de 330 ml (el primero es un tamaño típico y el segundo un número de unidades)
      if(nx && [180, 200, 237, 250, 269, 300, 330, 350, 355, 375, 400, 473, 500, 600, 750, 1000, 1500, 1750, 2000].includes(Number(nx[1])) && Number(nx[2]) <= 60){ out.unidadesPorPaquete = Number(nx[2]); out.contenido = Number(nx[1]); out.unidadContenido = 'ml'; }
      else if(nx){ out.unidadesPorPaquete = Number(nx[1]); out.contenido = Number(nx[2]); out.unidadContenido = null; }
      const pk = !nx && t.match(/\b(?:X|CJ|CAJA|PQ|PAQ|PAQUETE|DISPLAY|FARDO|SIXPACK)\s*X?\s*(\d{1,3})\b(?!\s*(?:G|GR|GRS|GMS|ML|KG|L|LT|CC)\b)/);
      if(pk && Number(pk[1]) > 1 && Number(pk[1]) <= 200) out.unidadesPorPaquete = Number(pk[1]);
    }
  }
  // Sin unidad escrita pero con un número típico de lata/botella (POKER 330, AGUILA 350)
  if(out.contenido == null && !out.unidadesPorPaquete){ const n = t.match(/\b(180|200|237|250|269|300|330|350|355|375|400|473|500|600|750|1000|1500|1750|2000|2500|3000)\b/); if(n){ out.contenido = Number(n[1]); out.unidadContenido = 'ml'; } }
  if(out.contenido != null){
    if(out.unidadContenido === 'g') out.pesoG = out.contenido; else if(out.unidadContenido === 'kg') out.pesoG = out.contenido * 1000;
    else if(out.unidadContenido === 'ml') out.volumenMl = out.contenido; else if(out.unidadContenido === 'l') out.volumenMl = out.contenido * 1000;
  }
  if(out.unidadesPorPaquete || out.contenido != null)
    out.presentacion = (out.unidadesPorPaquete ? out.unidadesPorPaquete + ' x ' : '') + (out.contenido != null ? (String(out.contenido).replace('.', ',') + (out.unidadContenido ? ' ' + out.unidadContenido : '')) : 'und');
  return out;
}
// Texto comparable: sin tildes, mayúsculas, OCR corregido, abreviaturas expandidas y marcas
// arregladas por parecido (POKFR → POKER). Devuelve también la marca detectada.
function fiNormalizar(desc){
  let t = fiAscii(fiCorregirOCR(desc)).toUpperCase().replace(/[^A-Z0-9\/\.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  FI_ABREV.forEach(([re, v]) => { t = t.replace(re, v); });
  const marcasTok = new Set(FI_MARCAS.flatMap(m => m.split(' ')).filter(w => w.length >= 4));
  t = t.split(' ').map(w => {
    if(w.length < 5 || /\d/.test(w) || marcasTok.has(w)) return w;
    for(const m of marcasTok) if(Math.abs(m.length - w.length) <= 1 && fiLev(w, m) === 1) return m;
    return w;
  }).join(' ');
  t = t.replace(/(^|\s)LECHERA\b/g, (m, a) => /\bLA$/.test(t.slice(0, t.indexOf(m) + a.length).trim()) ? m : a + 'LA LECHERA');
  let marca = null;
  for(const m of FI_MARCAS.slice().sort((a, b) => b.length - a.length)) if(new RegExp('\\b' + m + '\\b').test(t)){ marca = m; break; }
  const pres = fiPresentacion(t);
  const palabras = t.replace(/\b\d+\s*X\s*\d+(?:\.\d+)?\s*(KG|G|ML|L|OZ|UND)?\b/g, ' ').replace(/\d+(?:\.\d+)?\s*(KG|G|ML|L|OZ|UND)\b/g, ' ').split(' ')
    .filter(w => w && !/^\d+$/.test(w) && !FI_STOP.has(w) && w.length > 1);
  return { texto: t, marca, palabras, pres };
}
// Nombre sugerido y legible: «MAGGI CALDO GALLINA 24X594G CO» → «Maggi Caldo Gallina 594 g»
function fiNombreSugerido(desc){
  const n = fiNormalizar(desc);
  // fuera los códigos de presentación pegados (18BS/40/, DPX8UNDSX15GR, X29GR, X20X) y números sueltos del OCR
  const esCodigo = w => /\//.test(w) || /^\(?\d/.test(w) && /[A-Z]/.test(w) || /^(DPX|X)\d/.test(w) || /^\d+([.,]\d+)?$/.test(w) || /\dX$/.test(w) || /^\(|\)$/.test(w);
  const base = n.palabras.filter(w => !['LA', 'CAJA', 'PAQUETE', 'DISPLAY', 'SIXPACK', 'X'].includes(w) && !esCodigo(w)).join(' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const tam = n.pres.contenido != null ? ' ' + String(n.pres.contenido).replace('.', ',') + (n.pres.unidadContenido ? ' ' + n.pres.unidadContenido : '') : '';
  return (base + tam).trim() || String(desc || '').trim();
}
const fiKeyEq = (prov, desc) => (fiAscii(prov || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30)) + '|' + fiNormalizar(desc).texto;
// Equivalencias aprendidas: proveedor + descripción original → producto (y la misma
// descripción con cualquier proveedor, por si cambia de distribuidor).
function fiAprender(prov, desc, productId){
  if(!productId || !desc) return;
  data.equivalencias = data.equivalencias || {};
  const ahora = Date.now();
  [fiKeyEq(prov, desc), fiKeyEq('', desc)].forEach(k => {
    const e = data.equivalencias[k];
    data.equivalencias[k] = { productId, n: e && e.productId === productId ? (e.n || 1) + 1 : 1, at: ahora };
  });
  const ks = Object.keys(data.equivalencias);
  if(ks.length > 3000) ks.sort((a, b) => data.equivalencias[a].at - data.equivalencias[b].at).slice(0, ks.length - 2500).forEach(k => delete data.equivalencias[k]);
}
const fiTamanoDe = p => { const r = fiPresentacion((p.name || '') + ' ' + (p.size || '')); return r.pesoG != null ? 'g' + r.pesoG : r.volumenMl != null ? 'ml' + r.volumenMl : null; };
/* Puntaje 0-100 de qué tan seguro es que el renglón de la factura sea ese producto.
   95-100 muy alta · 85-94 alta · 70-84 posible (revisar) · <70 no se asocia solo. */
function fiCoincidir(item, proveedor){
  const desc = item.originalDescription || item.name || '';
  const prods = (data.products || []).filter(p => !p.combo);
  const res = [];
  const add = (p, conf, motivo) => { const e = res.find(r => r.p.id === p.id); if(e){ if(conf > e.conf){ e.conf = conf; e.motivo = motivo; } } else res.push({ p, conf, motivo }); };
  const sku = String(item.sku || '').trim().toUpperCase(), bar = String(item.barcode || '').replace(/\D/g, '');
  if(sku) prods.forEach(p => { if((p.skus || []).map(x => String(x).toUpperCase()).includes(sku)) add(p, 100, 'código del proveedor'); });
  if(bar.length >= 8) prods.forEach(p => { if((p.barcodes || []).includes(bar)) add(p, 100, 'código de barras'); });
  const eq = data.equivalencias || {};
  const e1 = eq[fiKeyEq(proveedor, desc)], e2 = eq[fiKeyEq('', desc)];
  [[e1, 99, 'ya lo confirmaste con este proveedor'], [e2, 96, 'ya lo confirmaste antes']].forEach(([e, c, m]) => {
    const p = e && prods.find(x => x.id === e.productId); if(p) add(p, c, m);
  });
  const n = fiNormalizar(desc), tam = n.pres.pesoG != null ? 'g' + n.pres.pesoG : n.pres.volumenMl != null ? 'ml' + n.pres.volumenMl : null;
  prods.forEach(p => {
    if(dupKey(p) === dupKey({ name: item.name || desc })){ add(p, 97, 'mismo nombre'); return; }
    const pn = fiNormalizar((p.name || '') + ' ' + (p.size || ''));
    const A = new Set(n.palabras), B = new Set(pn.palabras);
    if(!A.size || !B.size) return;
    let inter = 0;
    A.forEach(w => { if(B.has(w)) inter++; else for(const v of B) if(w.length >= 4 && v.length >= 4 && (v.startsWith(w) || w.startsWith(v) || fiLev(w, v) <= 1)){ inter += 0.8; break; } });
    const jac = inter / (A.size + B.size - inter);
    const cubre = inter / Math.min(A.size, B.size);
    let s = 20 * jac + 40 * cubre;
    if(n.marca && pn.marca) s += n.marca === pn.marca ? 28 : -35;
    else if(n.marca && pn.texto.includes(n.marca)) s += 18;
    const tp = fiTamanoDe(p);
    if(tam && tp) s += tam === tp ? 18 : -30;
    else if(!tam && n.pres.contenido != null && !n.pres.unidadContenido){            // «48X900» sin unidad: se compara solo el número
      const np = fiPresentacion((p.name || '') + ' ' + (p.size || '')).contenido;
      if(np != null) s += np === n.pres.contenido ? 14 : -15;
    }
    if(n.pres.unidadesPorPaquete && p.det && Number(p.det.unidadesPorPaquete) === n.pres.unidadesPorPaquete) s += 4;
    s = Math.round(Math.max(0, Math.min(94, s)));     // por nombre nunca pasa de 94: lo seguro viene de códigos o de lo que confirmaste
    if(s >= 45) add(p, s, 'nombre, marca y presentación parecidos');
  });
  res.sort((a, b) => b.conf - a.conf);
  const top = res[0], seg = res[1];
  const empate = top && seg && top.conf < 95 && (top.conf - seg.conf) < 6;
  const nivel = !top ? 'nuevo' : top.conf >= 95 ? 'muy alta' : top.conf >= 85 ? 'alta' : top.conf >= 70 ? 'revisar' : 'nuevo';
  const auto = top && !empate && top.conf >= 85;
  return {
    productId: auto ? top.p.id : (top && top.conf >= 70 && !empate ? top.p.id : ''),
    confianza: top ? top.conf : 0, nivel: empate ? 'varias' : nivel, revisar: !auto,
    candidatos: res.filter(r => r.conf >= 45).slice(0, 5).map(r => ({ id: r.p.id, name: r.p.name + (r.p.size ? ' ' + r.p.size : ''), conf: r.conf, motivo: r.motivo }))
  };
}

/* Renglones de producto desde el texto leído por el OCR. Entiende las dos formas más comunes:
   «CANT DESCRIPCIÓN V.UNIT TOTAL» y «DESCRIPCIÓN CANT V.UNIT TOTAL». Comprueba que
   cantidad × precio = total del renglón; si no cuadra, igual lo deja pero marcado para revisar.
   También separa palabras que el OCR pegó («MAGGICALDOGALLINA» → «MAGGI CALDO GALLINA»). */
const FI_PALABRAS = ['CERVEZA', 'LATA', 'BOTELLA', 'CALDO', 'GALLINA', 'COSTILLA', 'RES', 'POLLO', 'LECHE', 'CONDENSADA', 'DOYP', 'DOYPACK', 'POLVO', 'ENTERA', 'DESLACTOSADA',
  'ARROZ', 'AZUCAR', 'ACEITE', 'SAL', 'CAFE', 'CHOCOLATE', 'GASEOSA', 'AGUA', 'JUGO', 'NECTAR', 'GALLETA', 'GALLETAS', 'PAPAS', 'LIGHT', 'ORIGINAL', 'CERO', 'ZERO',
  'BOLSA', 'CAJA', 'PAQUETE', 'DISPLAY', 'SIXPACK', 'PET', 'VIDRIO', 'RETORNABLE', 'JABON', 'DETERGENTE', 'PAPEL', 'HIGIENICO', 'CREMA', 'DENTAL', 'SHAMPOO', 'MALTA',
  'AGUARDIENTE', 'RON', 'TRADICIONAL', 'SIN', 'CON', 'DE', 'LA', 'EL', 'MEDIA', 'LITRO', 'FRESA', 'MORA', 'MANGO', 'NARANJA', 'LIMON', 'UVA', 'VAINILLA', 'CUBOS', 'TABLETA'];
function fiSepararPegadas(tok){
  if(tok.length < 9 || /\d/.test(tok)) return tok;
  const dic = new Set(FI_PALABRAS.concat(FI_MARCAS.flatMap(m => m.split(' '))).concat((data.products || []).flatMap(p => fiAscii(p.name || '').toUpperCase().split(/[^A-Z]+/))).filter(w => w.length >= 2));
  const T = fiAscii(tok).toUpperCase(), mejor = new Array(T.length + 1).fill(null); mejor[0] = [];
  for(let i = 0; i < T.length; i++){ if(!mejor[i]) continue;
    for(let j = Math.min(T.length, i + 16); j > i + 1; j--){ const w = T.slice(i, j); if(dic.has(w) && (!mejor[j] || mejor[j].length > mejor[i].length + 1)) mejor[j] = mejor[i].concat(w); } }
  return mejor[T.length] ? mejor[T.length].join(' ') : tok;
}
/* Renglones de producto desde el texto leído (sin internet). Pensado para facturas reales de
   distribuidores colombianos: código al inicio, descripción con la presentación (24X594G,
   (18BS/40/10g), X12 UNID), columna de unidad (UN, UND, BS, PP, PL, LAT, DI), cantidades con
   decimales (1.00), precios como 18,196.00 o 8.018, % de IVA, descuentos, y tirillas POS donde la
   descripción sigue en el renglón de abajo. Cantidad y costo se comprueban con el total del
   renglón; si no cuadran, el renglón queda marcado para revisar (nunca se inventa un valor). */
const FI_UNID_COL = /^(UN|UND|UNID|UNDS|DI|BS|PP|PL|LAT|CJ|PQ|PAQ|KL|BL|FD|DP|DS|EA|NIU)$/;
const FI_IVAS = [0, 5, 8, 19];
function fiDineroTok(t0){
  // {v, dec, sep, corto, pct} o null. «18,196.00»→18196 · «2.742.00»→2742 · «8,018»→8018 · «1.00»→1 · «19%»→19 %
  let t = String(t0).replace(/[:;]/g, ',').replace(/^[-–(\/]+|[-–),.\/]+$/g, '');
  const pct = /%$/.test(t); t = t.replace(/%$/, '');
  if(/\d/.test(t)) t = t.replace(/[Oo]/g, '0').replace(/[lI]/g, '1');
  if(!/^\d[\d.,]*$/.test(t)) return /^[\d.,\/:%()-]+$/.test(t) && /\d/.test(t) ? { v: NaN, raro: true } : null;
  let m;
  if((m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)[.,](\d{2})$/))) return { v: Number(m[1].replace(/[.,]/g, '') + '.' + m[2]), dec: true, sep: true, pct };
  if(/^\d{1,3}(?:[.,]\d{3})+$/.test(t)) return { v: Number(t.replace(/[.,]/g, '')), dec: false, sep: true, pct };
  if((m = t.match(/^(\d+)[.,](\d{1,2})$/))) return { v: Number(m[1] + '.' + m[2]), dec: true, sep: false, corto: true, pct };
  if(/^\d+$/.test(t)) return { v: Number(t), dec: false, sep: false, pct };
  return { v: NaN, raro: true };                                   // número dañado por el OCR (7.5680)
}
function fiParsearRenglones(texto){
  const out = [], CLAVE = /\b(SUB\s?-?TOTAL|TOTAL(ES)?|NIT|FECHA|TEL(EFONO)?|FACTURA|DESCRIPCION|RETE\w*|CUFE|CUDE|PAGAR|CAMBIO|EFECTIVO|VENCE|CLIENTE|DIRECCION|VENDEDOR|PEDIDO|CORREO|DOCUMENTO|ASESOR|OBSERVACIONES|RESOLUCION|BASE|CONTACTO|PLANILLA|IDENTIFICACION|FORMA|ITEMS)\b/;
  const PRES = /^\(?\d*[.,]?\d+\s*(X|\*)\s*\d|^X\d|\d(G|GR|GRS|GMS|ML|L|LT|KG|CC|OZ|UND|UN)$|\//i;
  const esUnidad = t => FI_UNID_COL.test(fiAscii(t).toUpperCase().replace(/[^A-Z]/g, '')) && /^[^\d]*$/.test(t);
  const esBasura = t => /^[^\dA-Za-z]*$/.test(t) || (/^[A-Za-z]{1,2}\.?$/.test(t) && !/^(X|G|ML|KG|L)$/i.test(t)) ||
    (/\d/.test(t) && /[A-Za-z]/.test(t) && (t.match(/[A-Za-z]/g) || []).length <= 2 && !PRES.test(t));
  const esCola = t => !!fiDineroTok(t) || esUnidad(t) || esBasura(t);
  let previo = null;
  String(texto || '').split(/\n/).forEach(l0 => {
    let l = fiCorregirOCR(l0).replace(/[|—–_=\[\]{}“”"¡!¿£»«©®°~^`<>]+/g, ' ').replace(/\$\s*/g, '')
      .replace(/(\d{3,})-(?=\d{1,2}\b)/g, '$1 ').replace(/(\d)[.,]\s+(\d{3})\b/g, '$1,$2').replace(/\s+/g, ' ').trim();
    const A = fiAscii(l).toUpperCase();
    if(l.length < 4) return;
    if(CLAVE.test(A)){ previo = null; return; }
    let toks = l.split(' ').filter(Boolean);
    // Continuación de una tirilla POS: sin ningún precio, justo debajo de un producto
    if(previo && previo.pos && !toks.some(t => /\d{6,}/.test(t)) && !toks.some(t => { const n = fiDineroTok(t); return n && !n.raro && !n.pct && !n.corto && n.v >= 50 && /[.,]/.test(t); }) && toks.length <= 7 && toks.some(w => /[A-Za-z]{3,}/.test(w))){
      const sig = toks.join(' ').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, '').replace(/\s+[A-Za-z]$/, '').trim(), ult = previo.original.split(' ').pop();
      const pegada = fiAscii(ult + (sig.split(' ')[0] || '')).toUpperCase();
      if(sig) previo.original = previo.name = (FI_PALABRAS.includes(pegada) ? previo.original + sig : previo.original + ' ' + sig).trim();
      previo = null; return;
    }
    // 1) código del producto (y número de ítem antes de él)
    let sku = null;
    for(let i = 0; i < Math.min(3, toks.length - 2); i++){
      const t = toks[i].replace(/[^\dA-Za-z]/g, '');
      if(/^\d{3,14}$/.test(t)){
        const sig = toks[i + 1].replace(/[^\dA-Za-z]/g, '');
        if(/^\d{3,14}$/.test(sig) && toks.length > i + 3){ sku = sig; toks = toks.slice(i + 2); } else { sku = t; toks = toks.slice(i + 1); }
        break;
      }
      if(/[A-Za-z]{4,}/.test(t) && !/^[A-Z][a-z]{0,3}$/.test(toks[i])) break;     // ya empezó la descripción
    }
    // 2) cola numérica del final (precios, %, cantidad, unidad); se salta la basura del OCR
    const cola = [];
    let j = toks.length - 1;
    for(; j >= 0; j--){
      const t = toks[j], n = fiDineroTok(t);
      if(n && !n.raro){ cola.unshift({ n, t }); continue; }
      if(esUnidad(t)){ cola.unshift({ unidad: true, t }); continue; }
      if(n || esBasura(t)){ cola.unshift({ basura: true, t }); continue; }
      const precioAntes = j >= 1 && (n => n && !n.raro && n.sep && n.v >= 50)(fiDineroTok(toks[j - 1]));
      if((cola.some(c => c.n && c.n.v >= 50) || precioAntes) && j >= 2 && esCola(toks[j - 1]) && esCola(toks[j - 2]) && !esUnidad(toks[j - 1])){ cola.unshift({ basura: true, t }); continue; }
      break;
    }
    let desc = toks.slice(0, j + 1);
    const nums = cola.filter(c => c.n), exactos = nums.filter(c => !c.n.pct && !c.n.corto && c.n.v >= 50);
    const tieneLetras = desc.some(w => /[A-Za-z]{3,}/.test(w));
    // Renglón de continuación (tirillas POS): sin código ni precios, se pega al producto anterior
    if(!sku && exactos.length < 2){ previo = null; return; }
    if(!exactos.length || !tieneLetras || nums.length < 2){ previo = null; return; }
    // 3) cantidad: la que está justo antes de la columna de unidad; si no hay unidad, la que va antes del 1.er precio
    const esCant = c => c && c.n && !c.n.pct && c.n.v > 0 && c.n.v < 10000 && (!c.n.dec || /^\d+[.,]0+$/.test(c.t.replace(/[^\d.,]/g, '')));
    const antesDeUnidad = k => { for(let m = k + 1; m < cola.length; m++){ if(cola[m].basura) continue; return !!cola[m].unidad; } return false; };
    const esPrecio = c => c.n && !c.n.pct && !c.n.corto && c.n.v >= 50;
    let iU = -1; cola.forEach((c, k) => { if(c.unidad && cola.slice(k + 1).some(esPrecio)) iU = k; });
    const iP0 = cola.findIndex((c, k) => k > iU && esPrecio(c) && !antesDeUnidad(k));
    let qty = null, iQ = -1;
    if(iU > 0){ for(let k = iU - 1; k >= 0; k--){ if(cola[k].basura) continue; if(esCant(cola[k])){ qty = cola[k].n.v; iQ = k; } break; } }
    const iPct = cola.findIndex(c => c.n && c.n.pct);
    if(iU < 0 && iPct > 0 && esCant(cola[iPct - 1])){ qty = cola[iPct - 1].n.v; iQ = iPct - 1; }     // tirilla: «cant  19%  v.unit  total»
    if(qty == null && iU < 0){
      const lim = iP0 >= 0 ? iP0 : cola.length;
      for(let k = lim - 1; k >= 0; k--){ const c = cola[k]; if(c.n && c.n.pct) continue; if(esCant(c) && !(FI_IVAS.includes(c.n.v) && cola[k + 1] && cola[k + 1].n && cola[k + 1].n.pct)){ qty = c.n.v; iQ = k; } break; }
      if(qty == null){ const c = cola.slice(0, lim).reverse().find(esCant); if(c){ qty = c.n.v; iQ = cola.indexOf(c); } }
    }
    const desde = Math.max(iQ, iU);
    // lo que quedó antes de la cantidad/unidad es parte de la descripción (ej. «X 12 UNID»)
    if(desde > 0) desc = desc.concat(cola.slice(0, iQ >= 0 && iU >= 0 ? Math.min(iQ, iU) : desde).filter(c => !c.basura).map(c => c.t));
    let qtyLeida = qty;
    if(qty != null && qty >= 100 && qty % 100 === 0) qty = qty / 100;      // «200» por «2.00»
    const despues = cola.slice(desde + 1).filter(c => c.n);
    const precios = despues.filter(c => !c.n.pct && !c.n.corto && c.n.v >= 50);
    if(!precios.length){ previo = null; return; }
    let iva = null;
    const pc = despues.find(c => c.n.pct) || despues.find(c => FI_IVAS.includes(c.n.v) && !c.n.sep && !c.n.dec && despues.indexOf(c) > despues.indexOf(precios[0]));
    if(pc && FI_IVAS.includes(Math.round(pc.n.v))) iva = Math.round(pc.n.v);
    // 4) cuadrar con el total del renglón (el último precio)
    const total = precios.length > 1 ? precios[precios.length - 1].n.v : null;
    const unidades = precios.slice(0, -1).map(c => c.n.v).concat(despues.filter(c => c.n.corto && c.n.v >= 1 && c.n.v < 1000).map(c => Math.round(c.n.v * 1000)));
    if(total == null) unidades.push(precios[0].n.v);
    const cerca = (a, b) => b > 0 && Math.abs(a - b) <= Math.max(30, b * 0.031);
    const fs = [...new Set((iva != null ? [1 + iva / 100] : []).concat([1.19, 1]))];
    let sol = null;
    if(total != null){
      const prueba = (conQ, tol) => { for(const u of unidades) for(const f of fs){
        const cs = conQ ? (qty ? [qty, qtyLeida] : []) : [Math.round(total / (u * f)), Math.round(total / u)];
        const dentro = (a, b) => b > 0 && Math.abs(a - b) <= Math.max(30, b * tol);
        for(const c of cs){ if(!(c >= 1) || c > 5000 || (!conQ && (c > 60 || u < total / 60))) continue;
          if(dentro(total, c * u * f)) return { q: c, u, linea: total, iva: f > 1 ? Math.round((f - 1) * 100) : (iva != null ? iva : null) };
          // total = cantidad × precio: si ese precio es el 1.º de la fila, el total va sin IVA (tirillas POS);
          // si es una columna posterior (valor unitario con IVA), el total ya lo incluye.
          if(dentro(total, c * u)) return { q: c, u, linea: iva && u === unidades[0] ? total * (1 + iva / 100) : total, iva };
        } } return null; };
      // la cantidad leída manda; solo si es imposible (o no se leyó) se deduce del total
      const imposible = !qty || unidades.every(u => qty * u > total * 1.3 || qty * u * 1.19 < total * 0.6);
      sol = prueba(true, 0.012) || prueba(true, 0.031) || (imposible ? (prueba(false, 0.012) || prueba(false, 0.031)) : null);
      if(!sol && imposible){                                              // el OCR dañó un dígito: la opción que más se acerque
        let mejor = null;
        for(const u of unidades.slice(0, 1)) for(const f of fs) for(const c of [Math.round(total / (u * f)), Math.round(total / u)]){
          if(!(c >= 1) || c > 60) continue;
          const err = Math.abs(total - c * u * f) / total;
          if(err <= 0.08 && (!mejor || err < mejor.err)) mejor = { err, q: c, u, linea: f > 1 ? total : (iva ? total * (1 + iva / 100) : total), iva: f > 1 ? 19 : iva, dudoso: true };
        }
        sol = mejor;
      }   // el OCR dañó un dígito
    }
    let q = sol ? sol.q : (qty || 1), u = sol ? sol.u : precios[0].n.v;
    if(sol) iva = sol.iva;
    const original = desc.join(' ').replace(/^[^A-Za-z0-9(]+/, '').replace(/[\s\-.,;:]+$/, '').replace(/\s+/g, ' ').trim()
      .split(' ').map(fiSepararPegadas).join(' ');
    if(!/[A-Za-z]{3,}/.test(original)){ previo = null; return; }
    const it = { name: original, original, sku, qty: q, precioUnidad: u, line_total: sol ? Math.round(sol.linea) : null, iva_pct: iva, cuadra: !!sol && !sol.dudoso, pos: iU < 0,
      unit_cost: Math.round((sol ? sol.linea / q : u * (1 + (iva || 0) / 100)) * 100) / 100 };
    out.push(it); previo = it;
  });
  // Renglones sin IVA leído y sin total que cuadre: se usa el IVA que traen los demás renglones de la factura
  const ivas = out.filter(x => x.cuadra && x.iva_pct != null).map(x => x.iva_pct);
  const dom = ivas.length >= 2 ? ivas.sort((a, b) => ivas.filter(v => v === b).length - ivas.filter(v => v === a).length)[0] : null;
  out.forEach(x => { if(!x.cuadra && x.iva_pct == null && dom){ x.iva_pct = dom; x.unit_cost = Math.round(x.precioUnidad * (1 + dom / 100) * 100) / 100; } });
  return out;
}
// Distribuidores que más llegan a tiendas en Colombia (se reconocen aunque el OCR los escriba mal).
const FI_PROVEEDORES = [[/DISTRIMARCAS|DISTRIMAR\b/, 'Distrimarcas TAT S.A.S.'], [/C?CESTAN FORCE|CUESTAN FORCE|CEESTAN FORCE/, 'CCESTAN FORCE S.A.S.'],
  [/COLOMBINA|COLOMBINE|COLOMB1NA/, 'Distribuidora Colombina'], [/DULMARCAS|DULMARCA/, 'Dulmarcas M&M S.A.S.'], [/SUPER\s?RICAS/, 'Super Ricas'],
  [/NUTRESA|COMERCIAL NUTRESA/, 'Comercial Nutresa'], [/BAVARIA/, 'Bavaria'], [/POSTOBON/, 'Postobón'], [/COCA[- ]?COLA FEMSA|FEMSA/, 'Coca-Cola FEMSA'],
  [/ALPINA/, 'Alpina'], [/COLANTA/, 'Colanta'], [/QUALA/, 'Quala'], [/FRITO LAY|PEPSICO/, 'PepsiCo / Frito Lay'], [/YUPI/, 'Yupi'], [/RAMO\b/, 'Productos Ramo'],
  [/MONDELEZ/, 'Mondelez'], [/NESTLE/, 'Nestlé'], [/UNILEVER/, 'Unilever'], [/FAMILIA\b.*S\.?A/, 'Productos Familia'], [/ZENU|CARNICOS/, 'Zenú'], [/MERCADERISTAS|MAKRO/, 'Makro']];
/* Cuadre de cada renglón de factura (venga de la IA o del lector sin internet), ANTES de mostrarlo.
   La IA a veces devuelve el TOTAL del renglón como si fuera el precio de UNA unidad, o la cantidad
   en cajas en vez de unidades, o le suma el IVA a un total que ya lo traía. Aquí se recalcula todo
   con aritmética, sin inventar datos:
     unidades = cajas × unidades por caja (si se compró por caja/paquete)
     total con IVA = subtotal + IVA − descuento (o el total impreso)
     costo por unidad con IVA = total con IVA ÷ unidades
     costo por unidad sin IVA = costo con IVA ÷ (1 + %IVA) · IVA por unidad = la diferencia
   Si algo no cuadra se marca el renglón (y la factura) para revisar: nunca se guarda en silencio. */
const FI_EMPAQUE = /^(CJ|CJA|CAJA|CAJAS|PQ|PQT|PAQ|PAQUETE|PAQUETES|DISPLAY|DSP|DISP|FARDO|FD|BULTO|BTO|SIXPACK|SIX|DOC|DOCENA|DOCENAS|BANDEJA|BJ|PACA|PACK|BS|BOLSA|TIRA)$/;
function fiCuadrar(items, header){
  const n = v => { if(v == null || v === '') return null; const x = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(x) ? x : null; };
  const cerca = (a, b, t) => a != null && b != null && b !== 0 && Math.abs(a - b) <= Math.max(2, Math.abs(b) * (t || 0.015));
  const out = (items || []).map(x0 => {
    const x = Object.assign({}, x0), notas = [];
    let q = n(x.qty), u = n(x.unit_cost), T = n(x.line_total), S = n(x.line_subtotal), V = n(x.iva_value), D = n(x.discount);
    let r = n(x.iva_pct); if(r != null && r > 1) r = r / 100; if(r != null && (r < 0 || r > 0.3)) r = null;
    let c = n(x.cajas), k = n(x.unidades_por_caja);
    const upp = n(x.units_per_package) || (typeof fiPresentacion === 'function' ? fiPresentacion(String(x.original || x.name || '') + ' ' + (x.presentation || '')).unidadesPorPaquete : null);
    const und = String(x.unit || '').toUpperCase().replace(/[^A-Z]/g, '');
    // 1) unidades reales compradas
    if(!(c > 0 && k > 1) && FI_EMPAQUE.test(und) && upp > 1 && q > 0){ c = q; k = upp; }
    // La presentación dice cuántas trae el paquete (24X594G, X12 UND, 330 X24…): la cantidad son paquetes.
    // Si la cantidad ya viene en unidades (múltiplo exacto del paquete), se respeta.
    // Sensatez: si al repartir el valor quedaría cada unidad en menos de $200, el precio ya era por unidad
    // (ej. «LA LECHERA 48X80G», 4 × $2.742: son 4 sobres sueltos de una caja de 48, no 192).
    const valRenglon = T != null ? T : (u != null ? u * q : null);
    const repartible = !(valRenglon > 0) || valRenglon / ((q >= upp && q % upp === 0 ? q : q * upp) || 1) >= 200;
    if(!(c > 0 && k > 1) && upp > 1 && q > 0 && repartible && !/^(KG|KL|KILO|GR|G|LB|LT|LTS|L|ML|MT|M)$/.test(und)){
      if(q >= upp && q % upp === 0){ c = q / upp; k = upp; }
      else { c = q; k = upp; }
    }
    if(und === 'DOC' || und === 'DOCENA' || und === 'DOCENAS'){ if(!(k > 1)){ c = q; k = 12; } }
    let N = q;
    if(c > 0 && k > 1){
      if(!q || cerca(q, c, 0.001)){ N = c * k; notas.push(c + ' ' + (c === 1 ? 'caja/paquete' : 'cajas/paquetes') + ' × ' + k + ' = ' + (c * k) + ' unidades'); }
      else if(cerca(q, c * k, 0.001)) N = q;
      else N = q;
    }
    const qtyFalta = !(N > 0);
    if(!(N > 0)) N = 1;
    if(qtyFalta) notas.push('no se leyó la cantidad: escríbela y ORDEVA divide el total');
    // 2) total del renglón con IVA
    let Tc = null;
    if(S != null && V != null) Tc = S + V - (D || 0);
    if(T != null){
      if(Tc != null){ if(!cerca(T, Tc) && r > 0 && cerca(T, S - (D || 0))) notas.push('el total impreso no traía el IVA'); else Tc = T; }
      else if(r > 0 && S != null && cerca(T, S - (D || 0))){ Tc = T * (1 + r); notas.push('al total impreso se le sumó el IVA (' + Math.round(r * 100) + '%)'); }
      else Tc = T;
    }
    if(Tc == null && S != null && r != null) Tc = (S - (D || 0)) * (1 + r);
    if(r == null && V != null && Tc > V) r = V / (Tc - V);              // tasa sacada del IVA impreso
    // 3) costo por unidad con IVA
    let cuadra = true;
    if(Tc != null && Tc > 0){
      if(u != null && cerca(u * N, Tc)){ /* ya cuadra */ }
      else if(u != null && N > 1 && cerca(u, Tc)){ notas.push('el precio que venía era el total del renglón: se dividió entre ' + N); }
      else if(u != null && r > 0 && cerca(u * N * (1 + r), Tc)){ notas.push('el precio unitario venía sin IVA'); }
      else if(u != null && c > 0 && k > 1 && cerca(u * c, Tc)){ notas.push('el precio era por caja: se dividió entre ' + k); }
      else if(u != null && c > 0 && k > 1 && r > 0 && cerca(u * c * (1 + r), Tc)){ notas.push('el precio era por caja y sin IVA: se le sumó el IVA y se dividió entre ' + k); }
      else if(u != null && u > 0){ cuadra = false; notas.push('cantidad × precio no da el total del renglón: se usó total ÷ cantidad'); }
      u = Tc / N;
    } else if(u != null && c > 0 && k > 1 && x.precio_por_caja){ u = u / k; }
    if(!(u > 0)) u = 0;
    // 4) IVA por unidad
    const rr = r || 0, sinIva = u / (1 + rr);
    const lineaTotal = Tc != null ? Tc : u * N;
    Object.assign(x, {
      qty: Math.round(N * 1000) / 1000, unit_cost: Math.round(u * 100) / 100, line_total: Math.round(lineaTotal),
      line_subtotal: Math.round(lineaTotal / (1 + rr)), line_iva: Math.round(lineaTotal - lineaTotal / (1 + rr)),
      iva_pct: r != null ? Math.round(rr * 1000) / 10 : null, costo_unit_sin_iva: Math.round(sinIva * 100) / 100, iva_unit: Math.round((u - sinIva) * 100) / 100,
      cajas: c > 0 && k > 1 ? c : 1, unidades_por_caja: c > 0 && k > 1 ? k : N, costo_sin_iva: Math.round(sinIva * (c > 0 && k > 1 ? k : N) * 100) / 100,
      cuadra: x.cuadra === false ? false : cuadra, ajustes: notas, qty_falta: qtyFalta
    });
    return x;
  });
  // 5) La factura completa: ¿el IVA quedó sumado dos veces? Se compara con el total impreso.
  const tot = header && n(header.total);
  if(tot > 0 && out.length){
    const sA = out.reduce((s, x) => s + x.line_total, 0);
    const sB = out.reduce((s, x) => s + (x.iva_pct ? x.line_total / (1 + x.iva_pct / 100) : x.line_total), 0);
    const ok = v => cerca(v, tot, 0.02);
    if(!ok(sA) && ok(sB) && out.some(x => x.iva_pct > 0)){
      out.forEach(x => { if(!(x.iva_pct > 0)) return; const f = 1 + x.iva_pct / 100;
        x.line_total = Math.round(x.line_total / f); x.unit_cost = Math.round(x.unit_cost / f * 100) / 100;
        x.costo_unit_sin_iva = Math.round(x.unit_cost / f * 100) / 100; x.iva_unit = Math.round((x.unit_cost - x.costo_unit_sin_iva) * 100) / 100;
        x.line_subtotal = Math.round(x.line_total / f); x.line_iva = x.line_total - x.line_subtotal; x.costo_sin_iva = Math.round(x.costo_unit_sin_iva * x.unidades_por_caja * 100) / 100;
        x.ajustes.push('el IVA estaba sumado dos veces: se dejó una sola vez'); });
    }
  }
  return out;
}
/* Encabezado de la factura desde el texto leído. Solo se llena lo que aparece claramente
   escrito; lo demás queda en null y en la revisión dice «Revisar dato». */
function fiEncabezado(texto){
  const T = String(texto || ''), U = fiAscii(T).toUpperCase();
  const num = s => { if(s == null) return null; let v = String(s).replace(/[^\d.,-]/g, ''); if(!v) return null;
    if(/[.,]\d{3}$/.test(v) && !/[.,]\d{1,2}$/.test(v.replace(/[.,]\d{3}$/, ''))) v = v.replace(/[.,]/g, '');
    else v = v.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(v); return isFinite(n) ? Math.round(n) : null; };
  const fecha = s => { if(!s) return null; let m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/); if(m){ const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); } return null; };
  const tras = (re) => { const m = U.match(re); return m ? m[1].trim() : null; };
  const valor = (re) => { const m = U.match(re); return m ? num(m[1]) : null; };
  const h = {
    invoiceNumber: tras(/\bVENTA\s*N[O0°º]\.?\s*:?\s*([A-Z]{0,4}-?\d{3,12})\b/) || tras(/\bFACTURA ELECTRONICA[^\n]{0,80}?\b(\d{2}-\d{6,10})\b/) ||
      tras(/\bNOTA\b[\s\S]{0,60}?\bPEDIDO\b[\s\S]{0,90}?\b(\d{6,8})\b/) || tras(/\b(\d{2}-\d{8})\b/) ||
      tras(/(?:FACTURA(?: ELECTRONICA)?(?: DE VENTA)?|FV|FACT\.?|REMISION)\s*(?:NO\.?|N°|Nº|NRO\.?|NUMERO|#)?\s*[:.]?\s*([A-Z]{0,5}-?\s?\d{2,12})/),
    issueDate: fecha(tras(/(?:FECHA(?: DE)? (?:EMISION|EXPEDICION|FACTURA|GENERACION)|FECHA)\s*[:.]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4})/)),
    dueDate: fecha(tras(/(?:VENCIMIENTO|FECHA DE VENCIMIENTO|VENCE)\s*[:.]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4})/)),
    supplierNit: tras(/\bNIT\.?\s*[:.]?\s*([89]\d{2}\.?\d{3}\.?\d{3}\s?-\s?\d)(?!\d)/) || tras(/\bNIT\.?\s*[:.]?\s*([89]\d{2}\.?\d{3}\.?\d{3})(?!\d)/) || tras(/\b([89]\d{8}\s?-\s?\d)(?!\d)/),
    phone: tras(/(?:TEL(?:EFONO)?|CEL(?:ULAR)?|PBX)\.?\s*[:.]?\s*(\+?\d[\d\s-]{6,15}\d)/),
    email: (T.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [null])[0],
    address: tras(/(?:DIRECCION|DIR\.)\s*[:.]?\s*([^\n]{6,60})/),
    orderNumber: tras(/(?:ORDEN DE COMPRA|PEDIDO|O\.C\.?)\s*(?:NO\.?|N°|#)?\s*[:.]?\s*([A-Z0-9-]{3,15})/),
    paymentMethod: tras(/(?:MEDIO DE PAGO|FORMA DE PAGO|METODO DE PAGO)\s*[:.]?\s*([A-Z ]{4,30})/),
    paymentTerms: tras(/(?:CONDICION(?:ES)? DE PAGO|PLAZO)\s*[:.]?\s*([A-Z0-9 ]{3,30})/),
    cufe: (U.match(/\b(?:CUFE|CUDE)\s*[:.]?\s*([0-9A-F]{60,100})/) || [null, null])[1],
    validationDate: fecha(tras(/(?:FECHA DE VALIDACION|VALIDACION DIAN)\s*[:.]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4})/)),
    subtotal: valor(/\bSUB\s?-?TOTAL\b[^\d\n]{0,12}([\d.,]{3,})/) || valor(/^\W{0,4}BASE\b[^\d\n]{0,12}([\d.,]{3,})/m),
    iva: valor(/\bTOTAL\s+IMPUESTOS?\b[^\d\n]{0,12}([\d.,]{3,})/) || valor(/\bIVA\s*\d{1,2}\s*%[^\d\n]{0,12}([\d.,]{3,})/) || valor(/\b(?:TOTAL\s+)?IVA\b(?:\s*\d{1,2}\s*%)?[^\d\n]{0,12}([\d.,]{4,})/),
    retenciones: valor(/\b(?:RETE\s?FUENTE|RETENCION(?:ES)?|RETEIVA|RETEICA)\b[^\d\n]{0,12}([\d.,]{3,})/),
    otrosImpuestos: valor(/\b(?:IMPOCONSUMO|ICO|IMPUESTO AL CONSUMO|IBUA|ICUI)\b[^\d\n]{0,12}([\d.,]{3,})/),
    descuentos: valor(/\bDESCUENTOS?\b[^\d\n]{0,12}([\d.,]{3,})/),
    total: valor(/\b(?:TOTAL A PAGAR|VALOR TOTAL|TOTAL FACTURA|NETO A PAGAR|TOTAL(?!\s*(?:IMPUESTOS?|DESCUENTOS?|RETENCION(?:ES)?|ITEMS|UNIDADES|CARTONES|DE ARTICULOS|IVA)))\b[^\d\n]{0,12}([\d.,]{3,})(?![\s\S]*\b(?:TOTAL A PAGAR|VALOR TOTAL|NETO A PAGAR)\b)/)
  };
  // «Creación/venc. 2026/09/28 - 2026/09/28» (notas de pedido)
  const cv = U.match(/CREACION\s*\/?\s*VENC\.?\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})(?:\s*-\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}))?/);
  if(cv){ if(!h.issueDate) h.issueDate = fecha(cv[1]); if(!h.dueDate && cv[2]) h.dueDate = fecha(cv[2]); }
  if(!h.issueDate){                                    // sin rótulo: la primera fecha válida del documento
    const fs = (U.match(/\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b|\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}\b/g) || []).map(fecha)
      .filter(f => f && +f.slice(5, 7) >= 1 && +f.slice(5, 7) <= 12 && +f.slice(8) >= 1 && +f.slice(8) <= 31 && Math.abs(+f.slice(0, 4) - new Date().getFullYear()) <= 1);
    if(fs.length) h.issueDate = fs[0];
  }
  // Total sin rótulo legible (tirillas): el mayor valor con $ después del subtotal
  if(h.total == null && /\$/.test(T)){
    const desde = U.search(/SUB\s?-?TOTAL|SUBO?\s?T?O?TAL|DESCUENTO/);
    const vals = (desde >= 0 ? T.slice(desde) : T).match(/\$\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g) || [];
    const ns = vals.map(num).filter(v => v > 0); if(ns.length >= 2) h.total = Math.max(...ns);
  }
  if(h.orderNumber && h.orderNumber === h.invoiceNumber && !/NOTA\s*(?:DE\s*)?PEDIDO/.test(U)) h.invoiceNumber = null;
  if(h.supplierNit) h.supplierNit = h.supplierNit.replace(/\s/g, '');
  const lineas = T.split(/\n/).map(x => x.trim()).filter(Boolean);
  const conocido = FI_PROVEEDORES.find(([re]) => re.test(U));
  const rs = lineas.find(x => /\b(S\.?A\.?S|LTDA|S\.?A\.?|E\.?U|DISTRIBUIDORA|COMERCIALIZADORA|DISTRIBUCIONES|ALMACEN|SUPERMERCADO|MAYORISTA)\b/i.test(fiAscii(x)) && !/NIT|FACTURA|FECHA|CLIENTE|TIENDA DE/i.test(x));
  let prov = rs ? fiAscii(rs).toUpperCase().replace(/\s*NIT.*$/, '') : '';
  const corte = prov.match(/([A-Z][A-Z&.' ]{2,45}?\b(?:S\.?\s?A\.?\s?S|LTDA|S\.?\s?A)\b\.?)/);
  if(corte) prov = corte[1]; prov = prov.replace(/^(?:[A-Z]{1,2}\s+)+(?=[A-Z]{3})/, '').replace(/[^A-Z0-9.&' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  h.supplier = conocido ? conocido[1] : (prov ? prov.slice(0, 60) : null);
  return h;
}
// Mezcla lo que trajo la IA con lo leído localmente sin pisar lo que ya venía.
function fiUnirEncabezado(a, b){ const o = Object.assign({}, b || {}); Object.keys(a || {}).forEach(k => { if(a[k] != null && a[k] !== '') o[k] = a[k]; }); return o; }
const FI_CAMPOS = [['invoiceNumber', 'Número de factura'], ['supplier', 'Proveedor'], ['supplierNit', 'NIT'], ['issueDate', 'Fecha de emisión'],
  ['dueDate', 'Fecha de vencimiento'], ['subtotal', 'Subtotal'], ['iva', 'IVA'], ['retenciones', 'Retenciones'], ['otrosImpuestos', 'Otros impuestos'],
  ['descuentos', 'Descuentos'], ['total', 'Total'], ['address', 'Dirección'], ['phone', 'Teléfono'], ['email', 'Correo'], ['orderNumber', 'Número de pedido'],
  ['paymentMethod', 'Método de pago'], ['paymentTerms', 'Condiciones de pago'], ['cufe', 'CUFE / CUDE'], ['validationDate', 'Fecha de validación']];
/* Validación matemática y avisos. Nunca cambia los valores: solo avisa. */
function fiValidar(draft){
  const av = [], h = draft.header || {};
  const items = (draft.items || []).filter(it => it.include);
  const sumaLineas = items.reduce((s, it) => s + (Number(it.lineTotal) > 0 ? Number(it.lineTotal) : (Number(it.qty) || 0) * (Number(it.cost) || 0)), 0);
  const tol = v => Math.max(200, Math.abs(v) * 0.015);
  if(h.total != null && items.length){
    const sub = h.subtotal, imp = (h.iva || 0) + (h.otrosImpuestos || 0), desc = h.descuentos || 0, ret = h.retenciones || 0;
    let ok = Math.abs(sumaLineas - h.total) <= tol(h.total);                       // renglones con IVA incluido = total
    if(!ok && sub != null) ok = Math.abs(sub + imp - desc - h.total) <= tol(h.total) || Math.abs(sub + imp - desc - ret - h.total) <= tol(h.total);
    if(!ok) av.push({ tipo: 'total', txt: 'Hay una diferencia entre los valores detectados. Revise la factura. (Suma de productos ' + fmt(Math.round(sumaLineas)) + ' · total impreso ' + fmt(h.total) + ')' });
  }
  if(!h.invoiceNumber) av.push({ tipo: 'dato', txt: 'Falta el número de factura: revisar dato.' });
  // ¿Ya se aplicó esta misma factura? (mismo proveedor y número, o mismo proveedor, fecha y total)
  const provN = String(h.supplier || draft.supplier || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ya = (data.purchases || []).find(f => String(f.supplier || '').toLowerCase().replace(/[^a-z0-9]/g, '') === provN && ((h.invoiceNumber && f.invoiceNumber === h.invoiceNumber) || (h.total > 0 && Math.round(f.total || 0) === Math.round(h.total) && (f.date || '') === (h.issueDate || draft.date || ''))));
  if(ya && provN) av.push({ tipo: 'dup', txt: 'Esta factura parece ya aplicada (' + (ya.invoiceNumber ? 'n.º ' + ya.invoiceNumber : 'mismo total y fecha') + ', ' + new Date(ya.procesadaEn || ya.at).toLocaleDateString('es-CO') + '). Aplicarla otra vez duplicaría el inventario.' });
  if(!h.issueDate && !draft.date) av.push({ tipo: 'dato', txt: 'Falta la fecha de la factura: revisar dato.' });
  if(!(h.supplier || draft.supplier)) av.push({ tipo: 'dato', txt: 'Falta el proveedor: revisar dato.' });
  items.forEach(it => {
    const n = '«' + (it.name || '').slice(0, 30) + '»';
    if(it.match && it.match.nivel === 'varias') av.push({ tipo: 'coinc', txt: n + ': hay varios productos parecidos. Elija el correcto.' });
    else if(it.match && it.match.nivel === 'revisar') av.push({ tipo: 'coinc', txt: n + ': coincidencia dudosa (' + it.match.confianza + '%). Confírmela.' });
    if(it.unidadesPorPaquete > 1 && it.qty === it.unidadesPorPaquete && it.qtyDeColumna === false)
      av.push({ tipo: 'cant', txt: n + ': la cantidad es igual a las unidades del paquete (' + it.qty + '). ¿Compró ' + it.qty + ' unidades o 1 paquete?' });
    if(it.noCuadra) av.push({ tipo: 'cant', txt: n + ': cantidad × precio no da el total del renglón (el texto salió dañado). Revise cantidad y costo.' });
    if(it.qty >= 500 && !/kg|g|ml|l|metro|m\b/i.test(it.unit || '')) av.push({ tipo: 'cant', txt: n + ': la cantidad (' + it.qty + ') parece incorrecta. Revísela.' });
    if(h.total > 0 && it.qty * it.cost > h.total * 1.2) av.push({ tipo: 'precio', txt: n + ': cantidad × costo (' + fmt(Math.round(it.qty * it.cost)) + ') es más que el total de la factura. Revise cantidad y precio.' });
    const p = it.productId && data.products.find(x => x.id === it.productId);
    if(p && p.cost > 0 && it.cost > 0){ const r = it.cost / p.cost; if(r > 1.6 || r < 0.55) av.push({ tipo: 'precio', txt: n + ': el costo (' + fmt(it.cost) + ') es muy distinto al anterior (' + fmt(p.cost) + '). ¿Es por unidad o por paquete?' }); }
    if(it.ivaPctLeido != null && ![0, 5, 8, 19].includes(Math.round(it.ivaPctLeido))) av.push({ tipo: 'iva', txt: n + ': el IVA leído (' + it.ivaPctLeido + '%) no es una tarifa normal en Colombia (0, 5 o 19 %).' });
  });
  return av;
}

/* ================= ORDEVA IA =================
   Motor de decisiones de ORDEVA (github.com/NandhaKishorM/laya): recibe un texto corto y una
   pregunta de tipo «choice» con las opciones, y responde la opción elegida con su
   probabilidad calibrada (answer_confidence). Se usa SOLO para desempatar cuando un renglón
   de la factura se parece a varios productos del inventario: lo seguro (códigos,
   equivalencias aprendidas, nombre exacto) se resuelve aquí mismo sin llamar a nadie.
   Seguridad: la clave de ORDEVA NUNCA está en la app. La app llama al puente
   (puente/laya-worker.js, un Cloudflare Worker gratis) que guarda la clave como secreto del
   servidor y reenvía a POST /v1/systemone. En Ajustes solo se escribe la dirección del puente.
   La IA propone; la app valida (puntaje) y tú confirmas en la revisión. */
const LayaIA = (() => {
  const cfg = () => (typeof data !== 'undefined' && data && data.laya) || {};
  let caido = 0;                 // si falló hace poco, no se vuelve a intentar durante 2 min
  const cache = new Map();       // misma pregunta, misma respuesta (no se paga dos veces)
  const disponible = () => !!(cfg().url && /^https:\/\//.test(cfg().url) && navigator.onLine !== false && Date.now() - caido > 120000);
  async function pedir(ruta, cuerpo, ms){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 7000);
    try{
      const r = await fetch(cfg().url.replace(/\/+$/, '') + ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo), signal: ctl.signal });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    }catch(e){ caido = Date.now(); throw e; }
    finally{ clearTimeout(t); }
  }
  // texto: el renglón de la factura · opciones: [{id, name}] → { id, confianza 0-1 } o null
  async function elegir(texto, opciones, instrucciones){
    if(!disponible() || !opciones || opciones.length < 2) return null;
    const ops = opciones.slice(0, 12);
    const criteria = {}; ops.forEach((o, i) => { criteria['p' + i] = String(o.name).slice(0, 80); });
    criteria.ninguno = 'ninguno de estos productos';
    const clave = texto + '§' + JSON.stringify(criteria);
    if(cache.has(clave)) return cache.get(clave);
    const r = await pedir('/v1/systemone', {
      state: { body: String(texto).slice(0, 300) },
      questions: { producto: { type: 'choice', instructions: instrucciones || 'Which inventory product is this supplier invoice line? Same brand, product and size.', criteria } },
      model: cfg().modelo || 'multilingual'
    });
    const a = r && r.answers && r.answers.producto;
    if(!a || !a.choice) return null;
    const conf = Number(a.answer_confidence != null ? a.answer_confidence : (a.probabilities && a.probabilities[a.choice])) || 0;
    const out = a.choice === 'ninguno' ? { id: null, confianza: conf } : { id: (ops[Number(String(a.choice).slice(1))] || {}).id || null, confianza: conf };
    cache.set(clave, out);
    return out;
  }
  async function probar(){
    const r = await pedir('/v1/systemone', { state: { body: 'POKER LATA 330' },
      questions: { p: { type: 'choice', instructions: 'Which product?', criteria: { a: 'Cerveza Poker lata 330 ml', b: 'Leche condensada 900 g' } } } }, 9000);
    return !!(r && r.answers && r.answers.p);
  }
  return { disponible, elegir, probar, reset: () => { caido = 0; } };
})();
// Desempate con ORDEVA IA solo en los renglones dudosos (varios candidatos o 70-84 %).
// Si ORDEVA no está o falla, no pasa nada: queda la revisión manual con el aviso.
async function fiDesempatarConIA(items){
  const dudosos = items.filter(it => it.match && it.match.candidatos.length >= 2 && (it.match.nivel === 'varias' || it.match.nivel === 'revisar' || it.match.nivel === 'nuevo')).slice(0, 8);
  if(!dudosos.length) return { usada: false };
  if(!LayaIA.disponible()) return { usada: false, sinIA: !!(data.laya && data.laya.url) };
  let falla = false;
  await Promise.all(dudosos.map(async it => {
    try{
      const r = await LayaIA.elegir(it.originalDescription || it.name, it.match.candidatos.map(c => ({ id: c.id, name: c.name })));
      if(!r) return;
      it.match.ia = r;
      if(r.id && r.confianza >= 0.7){
        const c = it.match.candidatos.find(x => x.id === r.id);
        if(c){ c.conf = Math.min(94, Math.max(c.conf, Math.round(70 + 24 * r.confianza))); c.motivo = 'ORDEVA IA lo sugiere (' + Math.round(r.confianza * 100) + '%)'; }
        it.match.candidatos.sort((a, b) => b.conf - a.conf);
        it.productId = r.id; it.match.confianza = it.match.candidatos[0].conf; it.match.nivel = it.match.confianza >= 85 ? 'alta' : 'revisar';
      }
    }catch(e){ falla = true; }
  }));
  return { usada: true, falla };
}

/* ---------- Foto de la factura lista para leer ----------
   Antes de leer (con IA o sin internet) se arregla la foto en el mismo celular, sin subirla:
   1. Recorte y perspectiva: busca el papel (la zona clara más grande), toma sus 4 esquinas y
      la «endereza» como si fuera escaneada (sirve para fotos tomadas de lado o con la hoja
      un poco doblada). Si no encuentra un papel claro, deja la foto como está.
   2. Luz pareja: divide cada punto por la luz de su alrededor, lo que borra sombras,
      reflejos suaves y poca iluminación.
   3. Contraste y nitidez para la letra pequeña.
   El enderezado fino (inclinación del texto) y el blanco/negro los sigue haciendo el lector. */
const FI_MAX_LADO = 2000, FI_MAX_BYTES = 15 * 1024 * 1024;
function fiCargarImagen(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo abrir la imagen.')); };
    im.src = url;
  });
}
function fiOtsu(g){
  const h = new Uint32Array(256); for(let p = 0; p < g.length; p++) h[g[p] | 0]++;
  const tot = g.length; let sum = 0; for(let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0, wB = 0, max = 0, th = 128;
  for(let i = 0; i < 256; i++){ wB += h[i]; if(!wB) continue; const wF = tot - wB; if(!wF) break; sB += i * h[i];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if(v > max){ max = v; th = i; } }
  return th;
}
// Las 4 esquinas del papel en una versión chica de la foto, o null si no hay un papel claro.
function fiEsquinasPapel(img){
  const S = 360, k = Math.min(1, S / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
  for(let i = 0, p = 0; p < g.length; i += 4, p++) g[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
  const th = fiOtsu(g), vis = new Uint8Array(w * h);
  let mejor = null;
  for(let s = 0; s < g.length; s++){
    if(vis[s] || g[s] < th) continue;
    const pila = [s]; vis[s] = 1; const pts = [];
    while(pila.length){ const q = pila.pop(); pts.push(q); const x = q % w, y = (q / w) | 0;
      [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([a, b]) => { if(a >= 0 && b >= 0 && a < w && b < h){ const t = b * w + a; if(!vis[t] && g[t] >= th){ vis[t] = 1; pila.push(t); } } }); }
    if(!mejor || pts.length > mejor.length) mejor = pts;
  }
  if(!mejor) return null;
  const frac = mejor.length / (w * h);
  if(frac < 0.22 || frac > 0.94) return null;          // casi toda la foto ya es papel, o no se ve el papel
  let tl, tr, br, bl, a1 = Infinity, a2 = -Infinity, a3 = -Infinity, a4 = Infinity;
  mejor.forEach(q => { const x = q % w, y = (q / w) | 0, s1 = x + y, s2 = x - y;
    if(s1 < a1){ a1 = s1; tl = [x, y]; } if(s1 > a2){ a2 = s1; br = [x, y]; } if(s2 > a3){ a3 = s2; tr = [x, y]; } if(s2 < a4){ a4 = s2; bl = [x, y]; } });
  const q = [tl, tr, br, bl].map(([x, y]) => [x / k, y / k]);
  // el cuadrilátero tiene que ser razonable (convexo y no muy chueco)
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sg = [0, 1, 2, 3].map(i => Math.sign(cruz(q[i], q[(i + 1) % 4], q[(i + 2) % 4])));
  if(!sg.every(v => v === sg[0] && v !== 0)) return null;
  return q;
}
// Homografía de un rectángulo w×h hacia el cuadrilátero q (para leer cada punto de origen).
function fiHomografia(w, h, q){
  const src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], B = [];
  for(let i = 0; i < 4; i++){ const [x, y] = src[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v); }
  for(let c = 0; c < 8; c++){                           // eliminación de Gauss
    let piv = c; for(let r = c + 1; r < 8; r++) if(Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [B[c], B[piv]] = [B[piv], B[c]];
    for(let r = 0; r < 8; r++){ if(r === c) continue; const f = A[r][c] / A[c][c]; for(let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
  }
  return B.map((b, i) => b / A[i][i]);
}
/* Ángulo (en grados) de los renglones de texto, como un escáner: se prueban giros entre −8° y 8° y gana el que deja
   la tinta más concentrada en filas (renglones derechos). 0 si no hay una inclinación clara (o no hay texto). */
function fiAnguloTexto(g, w, h){
  const k = Math.min(1, 700 / Math.max(w, h)), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const xs = [], ys = [];
  for(let y = 0; y < sh; y++){ const fy = Math.min(h - 1, (y / k) | 0) * w; for(let x = 0; x < sw; x++){ if(g[fy + Math.min(w - 1, (x / k) | 0)] < 110){ xs.push(x - sw / 2); ys.push(y - sh / 2); } } }
  const n = xs.length; if(n < 300 || n > sw * sh * 0.5) return 0;
  const paso = Math.max(1, Math.floor(n / 40000)), alto = Math.ceil(Math.hypot(sw, sh)) + 4, bins = new Float64Array(alto);
  const puntaje = gr => {
    const a = gr * Math.PI / 180, si = Math.sin(a), co = Math.cos(a); bins.fill(0);
    for(let i = 0; i < n; i += paso){ const r = (-xs[i] * si + ys[i] * co + alto / 2) | 0; if(r >= 0 && r < alto) bins[r]++; }
    let t = 0; for(let i = 0; i < alto; i++) t += bins[i] * bins[i]; return t;
  };
  let mejor = 0, pm = puntaje(0); const p0 = pm;
  for(let a = -8; a <= 8; a += 0.5){ if(!a) continue; const v = puntaje(a); if(v > pm){ pm = v; mejor = a; } }
  for(let a = mejor - 0.4; a <= mejor + 0.41; a += 0.1){ const v = puntaje(a); if(v > pm){ pm = v; mejor = a; } }
  return (pm > p0 * 1.04 && Math.abs(mejor) >= 0.3) ? Math.round(mejor * 10) / 10 : 0;
}
/* Hacia dónde quedó la hoja (como CamScanner): 0, 90, 180 o 270 = cuánto hay que girarla (a la derecha) para que el texto
   quede derecho. Primero se ve si los renglones van acostados o parados (y qué tan torcidos); después si está al revés:
   las letras se apoyan alineadas abajo, y en texto en MAYÚSCULAS los puntos y comas («2.500», «S.A.S.») quedan abajo del
   renglón. seguro=false si no hay pistas claras (entonces no se gira: queda «↻ Girar» a mano). */
function fiOrientacion(g, w, h){
  const k = Math.min(1, 1200 / Math.max(w, h)), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const b = new Uint8Array(sw * sh), xs = [], ys = [];
  for(let y = 0; y < sh; y++){ const fy = Math.min(h - 1, (y / k) | 0) * w; for(let x = 0; x < sw; x++){ if(g[fy + Math.min(w - 1, (x / k) | 0)] < 140){ b[y * sw + x] = 1; xs.push(x - sw / 2); ys.push(y - sh / 2); } } }
  const n = xs.length;
  if(n < 400 || n > sw * sh * 0.45) return { giro: 0, seguro: false, razon: 'sin texto' };
  // 1. ¿Renglones acostados o parados, y qué tan torcidos? Se prueban giros (0° o 90°, ±8°) y gana el que deja más
  //    filas en blanco entre renglones (como cuando los renglones quedan derechos).
  const paso = Math.max(1, Math.floor(n / 60000)), L = Math.ceil(Math.hypot(sw, sh)) + 4, bins = new Int32Array(L);
  const huecos = th => {
    const a = th * Math.PI / 180, si = Math.sin(a), co = Math.cos(a); bins.fill(0);
    for(let i = 0; i < n; i += paso){ const r = (xs[i] * si + ys[i] * co + L / 2) | 0; if(r >= 0 && r < L) bins[r]++; }
    let i0 = 0; while(i0 < L && !bins[i0]) i0++; let i1 = L - 1; while(i1 > i0 && !bins[i1]) i1--;
    let bl = 0; for(let i = i0; i <= i1; i++) if(bins[i] === 0) bl++;
    return bl / Math.max(1, i1 - i0 + 1);
  };
  const junto = th => { huecos(th); let t = 0; for(let i = 0; i < L; i++) t += bins[i] * bins[i]; return t; };   // tinta concentrada en filas
  const mejorDe = base => { let m = { th: base, v: -1 }; for(let a = -8; a <= 8; a += 1){ const v = huecos(base + a); if(v > m.v) m = { th: base + a, v }; }
    let c = m.th, cj = junto(c); for(let a = m.th - 1; a <= m.th + 1.01; a += 0.1){ const v = junto(a); if(v > cj){ cj = v; c = a; } } m.th = c; return m; };
  const mh = mejorDe(0), mv = mejorDe(90);
  if(Math.abs(mh.v - mv.v) < 0.08 || Math.max(mh.v, mv.v) < 0.12) return { giro: 0, seguro: false, razon: 'sin renglones claros', mh, mv };
  const m = mh.v > mv.v ? mh : mv, base = m === mh ? 0 : 90;
  // 2. La hoja «enderezada» (girada base + torcido) para revisar cada renglón.
  const th = m.th * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
  const W = base ? sh : sw, H = base ? sw : sh, t = new Uint8Array(W * H);
  for(let Y = 0; Y < H; Y++) for(let X = 0; X < W; X++){
    const dx = X - W / 2, dy = Y - H / 2, x = Math.round(dx * co + dy * si + sw / 2), y = Math.round(-dx * si + dy * co + sh / 2);
    if(x >= 0 && y >= 0 && x < sw && y < sh && b[y * sw + x]) t[Y * W + X] = 1;
  }
  const P = new Float64Array(H); for(let Y = 0; Y < H; Y++){ let c = 0; for(let X = 0; X < W; X++) c += t[Y * W + X]; P[Y] = c; }
  const umbral = Math.max(1, W * 0.004), lineas = [];
  for(let i = 0; i < H;){
    if(P[i] <= umbral){ i++; continue; }
    let j = i; while(j < H && P[j] > umbral) j++;
    if(j - i >= 5 && j - i < H / 6){
      let pico = 0; for(let q = i; q < j; q++) pico = Math.max(pico, P[q]);
      if(pico < W * 0.85){ const tt = pico * 0.5; let ct = i, cb = j - 1; while(P[ct] < tt) ct++; while(P[cb] < tt) cb--; lineas.push({ y0: i, y1: j, ct, cb }); }
    }
    i = j;
  }
  if(lineas.length < 2) return { giro: 0, seguro: false, razon: 'pocos renglones' };
  // Pista 2 (texto en MAYÚSCULAS): puntos y comas («2.500», «S.A.S.») quedan abajo del renglón; las tildes, arriba.
  const lin = new Int32Array(H).fill(-1); lineas.forEach((l, q) => { for(let y = l.y0; y < l.y1; y++) lin[y] = q; });
  const vis = new Uint8Array(W * H), pila = []; let pAbajo = 0, pArriba = 0; const letras = lineas.map(() => []);
  for(let s = 0; s < W * H; s++){
    if(!t[s] || vis[s]) continue;
    vis[s] = 1; pila.push(s); let x0 = W, x1 = 0, y0 = H, y1 = 0, c = 0;
    while(pila.length){ const q = pila.pop(), x = q % W, y = (q / W) | 0; c++; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      if(x > 0 && t[q - 1] && !vis[q - 1]){ vis[q - 1] = 1; pila.push(q - 1); } if(x < W - 1 && t[q + 1] && !vis[q + 1]){ vis[q + 1] = 1; pila.push(q + 1); }
      if(y > 0 && t[q - W] && !vis[q - W]){ vis[q - W] = 1; pila.push(q - W); } if(y < H - 1 && t[q + W] && !vis[q + W]){ vis[q + W] = 1; pila.push(q + W); } }
    const cy = (y0 + y1) >> 1, li = lin[cy]; if(li < 0) continue;
    const l = lineas[li], alto = l.cb - l.ct + 1; if(alto < 4) continue;
    if(y1 - y0 + 1 >= alto * 0.6){ letras[li].push([y0, y1]); continue; }   // letras y números (para la pista 1)
    if(y1 - y0 + 1 > alto * 0.38 || x1 - x0 + 1 > alto * 0.45) continue;   // solo puntos, comas, tildes
    const pos = (cy - l.ct) / alto;
    if(pos > 0.62) pAbajo++; else if(pos < 0.3) pArriba++;
  }
  const s2 = (pAbajo - pArriba) / (pAbajo + pArriba + 1);
  // Pista 1: casi todas las letras se apoyan en la misma línea (abajo), pero arriba no: unas suben (b, d, h, l, mayúsculas,
  // números) y otras no (a, c, e, o…). Las que bajan (g, p, q, y) son pocas. Al revés, las letras quedan alineadas arriba.
  // En texto en MAYÚSCULAS las letras quedan alineadas arriba y abajo: ahí decide la pista 2.
  let votos = 0, total = 0;
  letras.forEach((ls, li) => {
    if(ls.length < 4) return;
    const l = lineas[li], tol = Math.max(1.5, (l.y1 - l.y0) * 0.1);
    const alineadas = k => { const v = ls.map(c => c[k]).sort((a, b) => a - b); let mejor = 0; for(let i = 0, j = 0; i < v.length; i++){ while(v[i] - v[j] > tol * 2) j++; mejor = Math.max(mejor, i - j + 1); } return mejor / v.length; };
    const fb = alineadas(1), ft = alineadas(0);
    votos += (fb - ft) * ls.length; total += ls.length;
  });
  const s1 = total ? votos / total : 0, peso1 = total;
  let s = 0, seguro = false;
  if(Math.abs(s1) > 0.15 && peso1 >= 12){ s = s1; seguro = true; }
  else if(pAbajo + pArriba >= 4 && Math.abs(s2) > 0.3){ s = s2; seguro = true; }
  return { giro: seguro ? (s >= 0 ? base : base + 180) % 360 : 0, seguro, torcido: m.th - base, s1, s2, peso1, pAbajo, pArriba, lineas: lineas.length, mh, mv };
}
// o: { lado: lado máximo en px, minLado: agrandar hasta este lado (Full HD = 1920), calidad: JPG 0–1, alinear: enderezar el texto }
async function fiMejorarFoto(file, o){
  o = o || {};
  const LADO = o.lado || FI_MAX_LADO, MIN = o.minLado || 0;
  const img = await fiCargarImagen(file);
  let fuente = img, W = img.width, H = img.height, enderezada = false, odListo = null;
  // Esquinas puestas a mano (✂️ Ajustar esquinas) o, si no, las que detecta ORDEVA.
  const q = (o.esquinas && o.esquinas.length === 4) ? o.esquinas.map(([x, y]) => [Math.max(0, Math.min(img.width, x)), Math.max(0, Math.min(img.height, y))]) : fiEsquinasPapel(img);
  if(o.esquinas && o.alinear === undefined) o = Object.assign({}, o, { alinear: false });   // ya la alineó la persona
  if(q){
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let ow = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), oh = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    let k = Math.min(2, LADO / Math.max(ow, oh)); if(MIN && Math.max(ow, oh) * k < MIN) k = Math.min(3, MIN / Math.max(ow, oh));
    ow = Math.round(ow * k); oh = Math.round(oh * k);   // si la hoja salió chica se agranda (letra pequeña)
    if(ow > 200 && oh > 200){
      /* Más rápido sin perder calidad: la hoja se recorta a máx. 2000 px, así que no hace falta leer
         la foto de 12 MP completa. Se reduce primero (lo hace la tarjeta gráfica) a lo justo que
         necesita el recorte (con 15 % de margen) y se copian los píxeles de a 32 bits. En un celular
         de gama media esto bajó de ~4,5 s a ~1,5 s. */
      const kk = Math.min(1, (k * 1.15) || 1), sw = Math.max(1, Math.round(img.width * kk)), sh = Math.max(1, Math.round(img.height * kk));
      const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
      const scx = sc.getContext('2d', { willReadFrequently: true }); scx.imageSmoothingQuality = 'high'; scx.drawImage(img, 0, 0, sw, sh);
      const s32 = new Uint32Array(scx.getImageData(0, 0, sw, sh).data.buffer);
      const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh;
      const ocx = oc.getContext('2d'); const od = ocx.createImageData(ow, oh), o32 = new Uint32Array(od.data.buffer);
      // Un pelo hacia adentro del borde de la hoja, para que no quede la raya de la mesa en la orilla.
      const cxq = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cyq = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
      const [a, b, c, d, e, f, g, h] = fiHomografia(ow, oh, q.map(([x, y]) => [(x + (cxq - x) * 0.014) * kk, (y + (cyq - y) * 0.014) * kk]));
      const BLANCO = 0xFFFFFFFF, s8 = new Uint8Array(s32.buffer), od8 = od.data;
      for(let y = 0, o = 0; y < oh; y++){
        let nu = b * y + c, nv = e * y + f, nz = h * y + 1;   // se suman a, d, g en cada paso de x
        for(let x = 0; x < ow; x++, o++, nu += a, nv += d, nz += g){
          // Interpolación bilineal (antes el píxel más cercano: al agrandar la letra quedaba con escalones y vetas)
          const fu = nu / nz, fv = nv / nz, u = Math.floor(fu), v = Math.floor(fv);
          if(u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1){ o32[o] = (u >= 0 && v >= 0 && u < sw && v < sh) ? (s32[v * sw + u] | 0xFF000000) : BLANCO; continue; }
          const du = fu - u, dv = fv - v, i0 = (v * sw + u) * 4, i1 = i0 + sw * 4, q = o * 4;
          for(let ch = 0; ch < 3; ch++){
            const top = s8[i0 + ch] + (s8[i0 + 4 + ch] - s8[i0 + ch]) * du, bot = s8[i1 + ch] + (s8[i1 + 4 + ch] - s8[i1 + ch]) * du;
            od8[q + ch] = top + (bot - top) * dv;
          }
          od8[q + 3] = 255;
        }
      }
      odListo = od; fuente = oc; W = ow; H = oh; enderezada = true;   // los píxeles ya enderezados se usan directo abajo (sin dibujar y leer otra vez)
    }
  }
  let kf = Math.min(1, LADO / Math.max(W, H)); if(MIN && Math.max(W, H) * kf < MIN) kf = Math.min(3, MIN / Math.max(W, H));
  const k = kf, w = Math.round(W * k), h = Math.round(H * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  let id;
  if(odListo && w === W && h === H) id = odListo;
  else { if(odListo) fuente.getContext('2d').putImageData(odListo, 0, 0); cx.drawImage(fuente, 0, 0, w, h); id = cx.getImageData(0, 0, w, h); }
  const px = id.data;
  const gr = new Float32Array(w * h);
  for(let i = 0, p = 0; p < gr.length; i += 4, p++) gr[p] = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  /* Luz del papel: en cada bloque, el tono del papel (el 90 % más claro, no el punto MÁS claro: el borde de cada letra
     sale más claro que el papel por la compresión de la foto y eso dejaba una sombra gris alrededor del texto). Un bloque
     casi todo de letra toma el papel de sus vecinos. Luego se suaviza entre bloques. */
  const B = Math.max(12, Math.round(Math.max(w, h) / 48)), bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  const bc = document.createElement('canvas'); bc.width = bw; bc.height = bh;
  const bcx = bc.getContext('2d'), bd = bcx.createImageData(bw, bh), pb = new Float32Array(bw * bh), hb = new Uint32Array(64);
  for(let by = 0; by < bh; by++) for(let bx = 0; bx < bw; bx++){
    hb.fill(0); let nn = 0; const y1 = Math.min(h, (by + 1) * B), x1 = Math.min(w, (bx + 1) * B);
    for(let y = by * B; y < y1; y += 2) for(let x = bx * B; x < x1; x += 2){ hb[Math.min(63, gr[y * w + x] / 4) | 0]++; nn++; }
    let acc = 0, i = 63; const lim = nn * 0.10; for(; i > 0; i--){ acc += hb[i]; if(acc >= lim) break; }
    pb[by * bw + bx] = i * 4 + 2;
  }
  for(let by = 0; by < bh; by++) for(let bx = 0; bx < bw; bx++){
    let mx = pb[by * bw + bx];
    for(let yy = Math.max(0, by - 1); yy <= Math.min(bh - 1, by + 1); yy++) for(let xx = Math.max(0, bx - 1); xx <= Math.min(bw - 1, bx + 1); xx++) mx = Math.max(mx, pb[yy * bw + xx] - 6);
    const o = (by * bw + bx) * 4; bd.data[o] = bd.data[o + 1] = bd.data[o + 2] = mx; bd.data[o + 3] = 255;
  }
  bcx.putImageData(bd, 0, 0);
  const fc = document.createElement('canvas'); fc.width = w; fc.height = h;
  const fcx = fc.getContext('2d', { willReadFrequently: true }); fcx.imageSmoothingEnabled = true; fcx.imageSmoothingQuality = 'high'; fcx.drawImage(bc, 0, 0, w, h);
  const fondo = fcx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for(let i = 0, p = 0; p < g.length; i += 4, p++) g[p] = Math.min(255, gr[p] / Math.max(40, fondo[i]) * 245);
  const hist = new Uint32Array(256); for(let p = 0; p < g.length; p++) hist[g[p] | 0]++;   // recorrido directo (forEach era 10 veces más lento)
  let lo = 0, hi = 255, acc = 0; const n = g.length;
  for(let i = 0; i < 256; i++){ acc += hist[i]; if(acc > n * 0.01){ lo = i; break; } }
  acc = 0; for(let i = 255; i >= 0; i--){ acc += hist[i]; if(acc > n * 0.02){ hi = i; break; } }
  const rango = Math.max(40, hi - lo);
  const out = new Uint8ClampedArray(g.length);
  // Como un escáner: el papel queda blanco parejo (sin vetas ni manchas) y la letra bien negra.
  const blanco = 0.88 * 255;
  for(let p = 0; p < g.length; p++){ const v = (g[p] - lo) * 255 / rango; out[p] = v >= blanco ? 255 : v * 255 / blanco; }
  // nitidez: realce de bordes 3×3 (letra pequeña más marcada)
  for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++){
    const p = y * w + x, s = out[p] * 5 - out[p - 1] - out[p + 1] - out[p - w] - out[p + w];
    const v = out[p] * 0.6 + s * 0.4, o = p * 4; px[o] = px[o + 1] = px[o + 2] = v < 0 ? 0 : v > 222 ? 255 : v; px[o + 3] = 255;   // >222: puntitos del ruido de la cámara → papel blanco
  }
  // Orillas (el filtro de nitidez no las recorre): quedaban con la foto sin procesar y salía una raya en el borde.
  for(let x = 0; x < w; x++){ for(const y of [0, h - 1]){ const o = (y * w + x) * 4, v = out[y * w + x] > 222 ? 255 : out[y * w + x]; px[o] = px[o + 1] = px[o + 2] = v; px[o + 3] = 255; } }
  for(let y = 0; y < h; y++){ for(const x of [0, w - 1]){ const o = (y * w + x) * 4, v = out[y * w + x] > 222 ? 255 : out[y * w + x]; px[o] = px[o + 1] = px[o + 2] = v; px[o + 3] = 255; } }
  cx.putImageData(id, 0, 0);
  // Foto de lado o al revés: se gira sola (o como la dejó la persona con «↻ Girar»).
  let giro = 0, giroAuto = false;
  const giroPedido = o.giro != null ? o.giro : file.__giro;
  if(giroPedido != null) giro = ((Number(giroPedido) || 0) % 360 + 360) % 360;
  else if(o.autoGiro !== false){ try{ const r = fiOrientacion(out, w, h); if(r.seguro && r.giro){ giro = r.giro; giroAuto = true; } }catch(e){} }
  // Con el giro, los píxeles del texto se giran también para medir la inclinación ya derecha.
  let og = out, gw = w, gh = h;
  if(giro){
    gw = giro % 180 ? h : w; gh = giro % 180 ? w : h; og = new Uint8ClampedArray(w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const v = out[y * w + x];
      if(giro === 90) og[x * gw + (h - 1 - y)] = v; else if(giro === 180) og[(h - 1 - y) * gw + (w - 1 - x)] = v; else og[(w - 1 - x) * gw + y] = v;
    }
  }
  // Texto torcido (la hoja ocupaba toda la foto o quedó un poco girada): se alinea como un escáner.
  let angulo = 0, final = c;
  if(o.alinear !== false){ try{ angulo = fiAnguloTexto(og, gw, gh); }catch(e){ angulo = 0; } }
  if(angulo || giro){
    const r = document.createElement('canvas'); r.width = gw; r.height = gh;
    const rx = r.getContext('2d'); rx.fillStyle = '#fff'; rx.fillRect(0, 0, gw, gh); rx.imageSmoothingQuality = 'high';
    rx.translate(gw / 2, gh / 2); rx.rotate((giro - angulo) * Math.PI / 180); rx.drawImage(c, -w / 2, -h / 2);
    final = r; if(angulo) enderezada = true;
  }
  const blob = await new Promise(r => final.toBlob(r, 'image/jpeg', o.calidad || 0.85));
  const nombre = (file.name || 'factura').replace(/\.[^.]+$/, '') + '-mejorada.jpg';
  const file2 = new File([blob], nombre, { type: 'image/jpeg' });
  return { file: file2, dataUrl: URL.createObjectURL(file2), enderezada, angulo, giro, giroAuto, w: final.width, h: final.height };   // vista previa sin volver a codificar la foto
}
const fiEsPdf = f => (window.VitoOfflineOCR && window.VitoOfflineOCR.isPdfFile && window.VitoOfflineOCR.isPdfFile(f)) || /\.pdf$/i.test(f.name || '') || f.type === 'application/pdf';
// Archivos válidos: fotos o PDF, de hasta 15 MB cada uno, máximo 10 a la vez.
function fiValidarArchivos(files){
  const ok = [], malos = [];
  (files || []).slice(0, 10).forEach(f => { if(!(f.type && /^image\//.test(f.type)) && !fiEsPdf(f)) malos.push(f.name + ' (no es foto ni PDF)'); else if(f.size > FI_MAX_BYTES) malos.push(f.name + ' (pesa más de 15 MB)'); else ok.push(f); });
  if(malos.length) showToast('⚠️ No se usaron: ' + malos.join(', '));
  return ok;
}
// Estados claros mientras se lee la factura
function fiEstado(txt){ const s = document.getElementById('invoiceSub'); if(s) s.textContent = txt; }
/* ================= ✂️ Ajustar esquinas (como CamScanner) =================
   La foto original con las 4 esquinas de la hoja (las que detectó ORDEVA; si no encontró la hoja, un recuadro). Se
   arrastran las esquinas o los bordes con el dedo; mientras se arrastra, una lupa muestra de cerca dónde queda el punto.
   «🔍 Detectar otra vez», «⬜ Toda la foto», «↻ Girar». «✅ Listo» devuelve { esquinas, archivo } (archivo = la foto,
   girada si se giró). Las esquinas van en píxeles de la foto, en orden: arriba-izq, arriba-der, abajo-der, abajo-izq. */
function fiOrdenarEsquinas(q){
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
  const s = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));   // en orden de las agujas del reloj (y hacia abajo)
  let i0 = 0; s.forEach((p, i) => { if(p[0] + p[1] < s[i0][0] + s[i0][1]) i0 = i; });
  return [0, 1, 2, 3].map(k => s[(i0 + k) % 4]);
}
async function fiGirarArchivo(file){
  const img = await fiCargarImagen(file), c = document.createElement('canvas'); c.width = img.height; c.height = img.width;
  const x = c.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0);
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  return new File([b], (file.name || 'factura').replace(/\.[^.]+$/, '') + '-girada.jpg', { type: 'image/jpeg' });
}
function fiEditarEsquinas(file, inicial){
  return new Promise(async resolve => {
    let ov = document.getElementById('fiEsqOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'fiEsqOv'; ov.className = 'overlay fi-esq';
      ov.innerHTML = '<div class="fi-esq-top"><b>✂️ Ajusta las esquinas</b><small>Arrastra cada punto a una esquina de la hoja</small></div>' +
        '<div class="fi-esq-zona"><canvas class="fi-esq-c"></canvas><canvas class="fi-esq-lupa" width="132" height="132" hidden></canvas></div>' +
        '<div class="fi-esq-bts"><button type="button" class="btn-ghost" data-e="auto">🔍 Detectar otra vez</button><button type="button" class="btn-ghost" data-e="todo">⬜ Toda la foto</button><button type="button" class="btn-ghost" data-e="girar">↻ Girar</button></div>' +
        '<div class="fi-esq-pie"><button type="button" class="btn-close" data-e="no">Cancelar</button><button type="button" class="btn-primary" data-e="ok">✅ Listo</button></div>';
      document.body.appendChild(ov);
    }
    const cv = ov.querySelector('.fi-esq-c'), lupa = ov.querySelector('.fi-esq-lupa'), zona = ov.querySelector('.fi-esq-zona');
    let img = null, q = null, k = 1, ox = 0, oy = 0, arr = null;
    const cargar = async f => {
      file = f; img = await fiCargarImagen(f);
      const det = fiEsquinasPapel(img);
      q = (inicial && !cargar.usado) ? inicial.map(p => p.slice()) : det;
      cargar.usado = true;
      if(!q){ const m = 0.04; q = [[img.width * m, img.height * m], [img.width * (1 - m), img.height * m], [img.width * (1 - m), img.height * (1 - m)], [img.width * m, img.height * (1 - m)]]; }
      medir(); pintar();
    };
    function medir(){
      const r = zona.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      const pad = 22;
      k = Math.min((r.width - 2 * pad) / img.width, (r.height - 2 * pad) / img.height);
      ox = (r.width - img.width * k) / 2; oy = (r.height - img.height * k) / 2;
    }
    const aPant = p => [ox + p[0] * k, oy + p[1] * k];
    const aFoto = (x, y) => [Math.max(0, Math.min(img.width, (x - ox) / k)), Math.max(0, Math.min(img.height, (y - oy) / k))];
    const medios = () => [0, 1, 2, 3].map(i => { const a = q[i], b = q[(i + 1) % 4]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
    function pintar(){
      if(!img) return;
      const x = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
      x.drawImage(img, ox, oy, img.width * k, img.height * k);
      const P = q.map(aPant);
      x.save(); x.beginPath(); x.rect(0, 0, cv.width, cv.height); x.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => x.lineTo(p[0], p[1])); x.closePath();
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fill('evenodd'); x.restore();
      x.beginPath(); x.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => x.lineTo(p[0], p[1])); x.closePath();
      x.lineWidth = 3; x.strokeStyle = '#22c55e'; x.stroke();
      medios().map(aPant).forEach(p => { x.beginPath(); x.arc(p[0], p[1], 9, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#22c55e'; x.stroke(); });
      P.forEach((p, i) => { x.beginPath(); x.arc(p[0], p[1], 15, 0, 7); x.fillStyle = arr && arr.i === i ? '#22c55e' : 'rgba(34,197,94,.35)'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); });
    }
    function pintarLupa(pf, pantalla){
      const L = lupa.getContext('2d'), Z = 2.6, R = 66;
      L.clearRect(0, 0, 132, 132); L.save(); L.beginPath(); L.arc(R, R, R - 2, 0, 7); L.clip();
      L.fillStyle = '#000'; L.fillRect(0, 0, 132, 132);
      const ancho = 132 / (k * Z);
      L.drawImage(img, pf[0] - ancho / 2, pf[1] - ancho / 2, ancho, ancho, 0, 0, 132, 132);
      L.restore(); L.strokeStyle = '#22c55e'; L.lineWidth = 3; L.beginPath(); L.arc(R, R, R - 2, 0, 7); L.stroke();
      L.beginPath(); L.moveTo(R - 12, R); L.lineTo(R + 12, R); L.moveTo(R, R - 12); L.lineTo(R, R + 12); L.lineWidth = 2; L.stroke();
      const izq = pantalla[0] < zona.clientWidth / 2;
      Object.assign(lupa.style, { left: izq ? '' : '10px', right: izq ? '10px' : '', top: '10px' }); lupa.hidden = false;
    }
    const punto = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = e => {
      const pt = punto(e), P = q.map(aPant), M = medios().map(aPant), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      let i = -1, best = 40; P.forEach((p, j) => { if(d(p, pt) < best){ best = d(p, pt); i = j; } });
      if(i >= 0) arr = { i };
      else { let m = -1, bm = 34; M.forEach((p, j) => { if(d(p, pt) < bm){ bm = d(p, pt); m = j; } }); if(m < 0) return; arr = { lado: m, desde: aFoto(pt[0], pt[1]), q0: q.map(p => p.slice()) }; }
      try{ cv.setPointerCapture(e.pointerId); }catch(x){} e.preventDefault(); mover(e);
    };
    function mover(e){
      if(!arr) return;
      const pt = punto(e), f = aFoto(pt[0], pt[1]);
      if(arr.i != null){ q[arr.i] = f; pintarLupa(f, pt); }
      else { const dx = f[0] - arr.desde[0], dy = f[1] - arr.desde[1], a = arr.lado, b = (arr.lado + 1) % 4;
        [a, b].forEach(j => { q[j] = [Math.max(0, Math.min(img.width, arr.q0[j][0] + dx)), Math.max(0, Math.min(img.height, arr.q0[j][1] + dy))]; }); pintarLupa(f, pt); }
      pintar();
    }
    cv.onpointermove = e => { if(arr){ e.preventDefault(); mover(e); } };
    cv.onpointerup = cv.onpointercancel = () => { arr = null; lupa.hidden = true; q = fiOrdenarEsquinas(q); pintar(); };
    const alCambiarTam = () => { if(img && ov.classList.contains('show')){ medir(); pintar(); } };
    window.addEventListener('resize', alCambiarTam);
    const fin = v => { ov.classList.remove('show'); window.removeEventListener('resize', alCambiarTam); ov._fin = null; resolve(v); };
    ov._fin = () => fin(null);
    ov._prueba = { esquinas: () => q.map(x => x.slice()), pantalla: x => aPant(x), foto: () => img && { w: img.width, h: img.height } };   // para las pruebas automáticas
    ov.querySelector('.fi-esq-bts').onclick = async e => {
      const b = e.target.closest('[data-e]'); if(!b || !img) return;
      if(b.dataset.e === 'auto'){ const d = fiEsquinasPapel(img); if(d){ q = d; pintar(); } else showToast('No encontré bien la hoja: ajústala con los puntos.'); }
      else if(b.dataset.e === 'todo'){ q = [[0, 0], [img.width, 0], [img.width, img.height], [0, img.height]]; pintar(); }
      else if(b.dataset.e === 'girar'){ b.disabled = true; try{ inicial = null; await cargar(await fiGirarArchivo(file)); }finally{ b.disabled = false; } }
    };
    ov.querySelector('.fi-esq-pie').onclick = e => {
      const b = e.target.closest('[data-e]'); if(!b) return;
      if(b.dataset.e === 'no') return fin(null);
      const o = fiOrdenarEsquinas(q), area = Math.abs(o.reduce((a, p, i) => { const n = o[(i + 1) % 4]; return a + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
      if(area < img.width * img.height * 0.04){ showToast('El recuadro quedó muy pequeño: abre las esquinas hasta los bordes de la hoja.'); return; }
      fin({ esquinas: o, archivo: file });
    };
    ov.classList.add('show');
    try{ await cargar(file); }catch(e){ showToast('No pude abrir la foto.'); fin(null); }
  });
}
window.fiEditarEsquinas = fiEditarEsquinas;
/* Revisar la foto antes de leerla: se muestra ya arreglada (recortada, enderezada y con la luz
   pareja). «Usar esta foto», «Tomar otra», «Elegir otra» o «Usar la original». */
function fiRevisarFoto(file, onLista){
  return new Promise(async resolve => {
    let ov = document.getElementById('fiFotoOv');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'fiFotoOv'; ov.className = 'overlay';
      ov.innerHTML = '<div class="modal fi-foto"><h2>📷 Revisa la foto</h2><div class="modal-sub" id="fiFotoSub">Procesando imagen…</div>' +
        '<div class="fi-foto-img"><img id="fiFotoImg" alt="Factura"></div>' +
        '<div class="fi-foto-btns"><button type="button" class="btn-primary" id="fiFotoOk">✅ Usar esta foto</button>' +
        '<button type="button" class="btn-ghost" id="fiFotoOtra">📷 Tomar otra</button><button type="button" class="btn-ghost" id="fiFotoGal">🖼️ Elegir otra</button>' +
        '<button type="button" class="btn-ghost" id="fiFotoEsq">✂️ Ajustar esquinas</button><button type="button" class="btn-ghost" id="fiFotoGirar">↻ Girar</button>' +
        '<button type="button" class="btn-ghost" id="fiFotoOrig">Usar la original</button><button type="button" class="btn-close" id="fiFotoNo">Cancelar</button></div></div>';
      document.body.appendChild(ov);
    }
    const sub = document.getElementById('fiFotoSub'), im = document.getElementById('fiFotoImg');
    im.removeAttribute('src'); sub.textContent = 'Procesando imagen…'; ov.classList.add('show');
    const fin = v => { ov.classList.remove('show'); resolve(v); };
    let mejor = null;
    const giroTxt = m => m && m.giroAuto ? (m.giro === 180 ? 'Estaba al revés: la giré. ' : 'Estaba de lado: la giré. ') : '';
    try{ mejor = await fiMejorarFoto(file); im.src = mejor.dataUrl;
      sub.textContent = giroTxt(mejor) + (mejor.enderezada ? 'La recorté y la enderecé. ' : '') + 'Mejoré la luz y el contraste. ¿Se lee bien? Si quedó girada, toca «↻ Girar»; si el recorte no quedó bien, «✂️ Ajustar esquinas».'; }
    catch(e){ im.src = URL.createObjectURL(file); sub.textContent = 'No pude mejorarla, pero puedes usarla así o tomar otra.'; }
    // Mientras la persona mira la foto, ya se empieza a leer (así al tocar «Usar esta foto» la respuesta ya viene en camino).
    if(typeof onLista === 'function') try{ onLista(mejor ? mejor.file : file); }catch(e){}
    document.getElementById('fiFotoOk').onclick = () => fin({ usar: mejor ? mejor.file : file, original: file });
    document.getElementById('fiFotoOrig').onclick = () => fin({ usar: file, original: file });
    // ✂️ Ajustar esquinas (como CamScanner): la persona corrige el recorte y la foto se vuelve a escanear con sus esquinas.
    document.getElementById('fiFotoEsq').onclick = async () => {
      const r = await fiEditarEsquinas(file);
      if(!r) return;
      file = r.archivo; file.__esquinas = r.esquinas; delete file.__giro;   // la hoja ya quedó como la puso la persona
      sub.textContent = 'Recortando con tus esquinas…';
      try{ mejor = await fiMejorarFoto(file, { esquinas: r.esquinas }); im.src = mejor.dataUrl; sub.textContent = '✂️ Recortada con tus esquinas, enderezada y con la luz pareja. ¿Se lee bien?'; }
      catch(e){ sub.textContent = 'No pude recortarla así. Prueba otra vez.'; }
      if(typeof onLista === 'function') try{ onLista(mejor ? mejor.file : file); }catch(e){}
      document.getElementById('fiFotoOk').onclick = () => fin({ usar: mejor ? mejor.file : file, original: file });
      document.getElementById('fiFotoOrig').onclick = () => fin({ usar: file, original: file });
    };
    // ↻ Girar a mano (un cuarto de vuelta a la derecha cada vez). El giro queda en la foto, así el escaneo HD que se guarda
    // también sale derecho.
    const gb = document.getElementById('fiFotoGirar');
    gb.onclick = async () => {
      if(gb.disabled) return; gb.disabled = true;
      const g = (((mejor && mejor.giro) || 0) + 90) % 360; file.__giro = g;
      sub.textContent = 'Girando…';
      try{ mejor = await fiMejorarFoto(file, Object.assign({ giro: g }, file.__esquinas ? { esquinas: file.__esquinas } : {})); im.src = mejor.dataUrl; sub.textContent = '↻ Girada. ¿Quedó derecha? Si no, toca «↻ Girar» otra vez.'; }
      catch(e){ sub.textContent = 'No pude girarla. Prueba otra vez.'; }
      finally{ gb.disabled = false; }
      if(typeof onLista === 'function') try{ onLista(mejor ? mejor.file : file); }catch(e){}
      document.getElementById('fiFotoOk').onclick = () => fin({ usar: mejor ? mejor.file : file, original: file });
      document.getElementById('fiFotoOrig').onclick = () => fin({ usar: file, original: file });
    };
    document.getElementById('fiFotoOtra').onclick = () => fin({ otra: 'cam' });
    document.getElementById('fiFotoGal').onclick = () => fin({ otra: 'gal' });
    document.getElementById('fiFotoNo').onclick = () => fin(null);
  });
}
// Guarda el archivo original de la factura (foto o primera página del PDF) en el celular.
async function fiGuardarOriginal(file){
  try{
    if(!file || typeof window.ctReciboGuardar !== 'function') return null;
    let img = file;
    if(fiEsPdf(file)){ const pags = window.VitoOfflineOCR && window.VitoOfflineOCR.expandFilesWithPdfPages ? await window.VitoOfflineOCR.expandFilesWithPdfPages([file]) : []; img = pags[0]; if(!img) return null; }
    const url = await scalePhotoForAI(img, 1600, 0.7);
    const id = 'fact-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await window.ctReciboGuardar(id, url);
    return id;
  }catch(e){ return null; }
}

/* ================= Facturas escaneadas en HD (como CamScanner) =================
   Al aplicar una factura, cada página (todas las fotos o todas las hojas del PDF) se guarda en el celular ya
   escaneada: recortada, enderezada, con el texto alineado, la luz pareja y en Full HD o más (lado largo ≥ 1920 px).
   Después, sin estorbar, se detecta todo el texto de cada página (con la posición de cada palabra).
   Desde «📚 Facturas anteriores» se descarga en PDF (las páginas escaneadas con el texto encima, que se puede buscar y
   copiar, más una hoja con los datos leídos) o en imagen JPG HD. Las facturas que ya estaban guardadas (solo con la foto
   original) también se descargan mejoradas: se escanean en ese momento. */
const FI_HD = { lado: 2560, minLado: 1920, calidad: 0.9 };
const fiBlobADataUrl = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
async function fiDataUrlAFile(url, nombre){ const b = await (await fetch(url)).blob(); return new File([b], nombre || 'factura.jpg', { type: b.type || 'image/jpeg' }); }
// Fotos y PDF → una imagen por página (máx. 12 páginas).
async function fiPaginasDe(files){
  const out = [];
  for(const f of (files || [])){
    if(out.length >= 12) break;
    if(fiEsPdf(f)){ try{ const pags = window.VitoOfflineOCR && window.VitoOfflineOCR.expandFilesWithPdfPages ? await window.VitoOfflineOCR.expandFilesWithPdfPages([f]) : []; pags.forEach(x => out.push(x)); }catch(e){} }
    else out.push(f);
  }
  return out.slice(0, 12);
}
// Escanea cada página en HD y la guarda en el celular. Devuelve [{ id, w, h, esq }]. Si la persona ajustó las esquinas
// (✂️), se usan esas. También queda en este equipo la foto original de cada página («-o»), para poder corregir el
// recorte después desde «Facturas anteriores» (las esquinas van en fracciones de la foto: 0 a 1).
async function fiGuardarEscaneos(files, base){
  const pags = await fiPaginasDe(files), out = [];
  for(let i = 0; i < pags.length; i++){
    try{
      const esq = pags[i].__esquinas || null;
      const r = await fiMejorarFoto(pags[i], Object.assign({}, FI_HD, esq ? { esquinas: esq } : {})), id = base + '-p' + (i + 1);
      await window.ctReciboGuardar(id, await fiBlobADataUrl(r.file));
      let fr = null;
      try{
        const im = await fiCargarImagen(pags[i]);
        if(esq) fr = esq.map(([x, y]) => [x / im.width, y / im.height]);
        await window.ctReciboGuardar(id + '-o', await scalePhotoForAI(pags[i], 2000, 0.85));
      }catch(e){}
      out.push(Object.assign({ id, w: r.w, h: r.h }, fr ? { esq: fr } : {}, r.giro ? { giro: r.giro } : {}));
    }catch(e){}
  }
  return out;
}
// ✂️ Corregir el recorte de una factura ya guardada: se abre la foto original de esa página con sus esquinas, se
// ajustan y se vuelve a escanear en HD (reemplaza la página guardada; el texto se vuelve a detectar al descargarla).
async function fiCorregirEscaneo(p, n, avisar){
  avisar = avisar || (t => showToast(t, 3500));
  await fiEscaneosDe(p);
  const e = (p.escaneos || [])[n]; if(!e){ showToast('No encontré esa página.'); return false; }
  const leer = window.ctReciboLeer;
  let url = await leer(e.id + '-o'), desdeOriginal = !!url;
  if(!url && n === 0 && p.archivoId){ url = await leer(p.archivoId); desdeOriginal = !!url; }
  if(!url) url = await leer(e.id);
  if(!url){ showToast('La foto de esta página no está en este equipo.'); return false; }
  const f = await fiDataUrlAFile(url, 'factura-p' + (n + 1) + '.jpg');
  let inicial = null;
  if(desdeOriginal && e.esq){ const im = await fiCargarImagen(f); inicial = e.esq.map(([x, y]) => [x * im.width, y * im.height]); }
  const r = await fiEditarEsquinas(f, inicial);
  if(!r) return false;
  avisar('✂️ Recortando y escaneando en HD…');
  const m = await fiMejorarFoto(r.archivo, Object.assign({}, FI_HD, { esquinas: r.esquinas }, desdeOriginal && r.archivo === f && e.giro ? { giro: e.giro } : {}));
  await window.ctReciboGuardar(e.id, await fiBlobADataUrl(m.file));
  try{ await window.ctReciboBorrar(e.id + '-ocr'); }catch(x){}
  const im2 = await fiCargarImagen(r.archivo);
  if(r.archivo !== f || !desdeOriginal) try{ await window.ctReciboGuardar(e.id + '-o', await scalePhotoForAI(r.archivo, 2000, 0.85)); }catch(x){}
  Object.assign(e, { w: m.w, h: m.h, esq: r.esquinas.map(([x, y]) => [x / im2.width, y / im2.height]), corregida: Date.now() });
  saveData();
  showToast('✅ Página ' + (n + 1) + ' recortada con tus esquinas y guardada en HD.', 4500);
  return true;
}
// ↻ Girar una página guardada: un cuarto de vuelta a la derecha de la imagen HD (sin volver a escanear, así no pierde
// calidad). El texto se vuelve a detectar al descargarla.
async function fiGirarEscaneo(p, n, avisar){
  avisar = avisar || (t => showToast(t, 3500));
  await fiEscaneosDe(p);
  const e = (p.escaneos || [])[n]; if(!e){ showToast('No encontré esa página.'); return false; }
  const url = await window.ctReciboLeer(e.id);
  if(!url){ showToast('La foto de esta página no está en este equipo.'); return false; }
  avisar('↻ Girando la página ' + (n + 1) + '…');
  const f = await fiGirarArchivo(await fiDataUrlAFile(url, 'factura-p' + (n + 1) + '.jpg'));
  await window.ctReciboGuardar(e.id, await fiBlobADataUrl(f));
  try{ await window.ctReciboBorrar(e.id + '-ocr'); }catch(x){}
  e.giro = ((e.giro || 0) + 90) % 360; const w = e.w; e.w = e.h; e.h = w;
  saveData();
  showToast('↻ Página ' + (n + 1) + ' girada y guardada.', 3500);
  return true;
}
// Lo que se hace después de aplicar (sin hacer esperar): escanear en HD todas las páginas y detectar su texto.
async function fiEscanearCompra(compraId, files){
  try{
    if(!window.ctReciboGuardar || !(files || []).length) return;
    const esc = await fiGuardarEscaneos(files, 'fesc-' + compraId);
    const p = (data.purchases || []).find(x => x.id === compraId);
    if(p && esc.length){ p.escaneos = esc; saveData(); }
    setTimeout(async () => { for(const e of esc){ try{ await fiOcrEscaneo(e.id); }catch(err){} } }, 1500);
  }catch(e){}
}
// Texto con posiciones de una página escaneada (se detecta una vez y queda guardado en el celular).
async function fiOcrEscaneo(id, url){
  const leer = window.ctReciboLeer; if(!leer) return null;
  try{ const ya = await leer(id + '-ocr'); if(ya) return JSON.parse(ya); }catch(e){}
  const V = window.VitoOfflineOCR; if(!V || !V.palabrasDeImagen) return null;
  url = url || await leer(id); if(!url) return null;
  const r = await V.palabrasDeImagen(await fiDataUrlAFile(url, id + '.jpg'));
  if(r && (r.words || []).length){ try{ await window.ctReciboGuardar(id + '-ocr', JSON.stringify(r)); }catch(e){} }
  return r;
}
// Las páginas escaneadas de una factura guardada: [{ id, url }]. Si solo estaba la foto original (facturas de
// antes), se escanea en HD en este momento y queda guardada.
async function fiEscaneosDe(p, avance){
  const leer = window.ctReciboLeer; if(!leer) return [];
  const out = [];
  for(const e of (p.escaneos || [])){ try{ const url = await leer(e.id); if(url) out.push({ id: e.id, url }); }catch(err){} }
  if(out.length || !p.archivoId) return out;
  const orig = await leer(p.archivoId); if(!orig) return [];
  if(avance) avance('🖨️ Escaneando la factura en HD…');
  const r = await fiMejorarFoto(await fiDataUrlAFile(orig, 'factura.jpg'), FI_HD), id = 'fesc-' + p.id + '-p1', url = await fiBlobADataUrl(r.file);
  await window.ctReciboGuardar(id, url);
  p.escaneos = [{ id, w: r.w, h: r.h }]; saveData();
  return [{ id, url }];
}
const fiNombreArchivo = (p, ext) => ('Factura ' + [p.supplier || 'proveedor', p.invoiceNumber || '', (p.date || String(p.at || '').slice(0, 10) || '')].filter(Boolean).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ._-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) + '.' + ext;
function fiDescargar(blob, nombre){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const fiDataUrlABytes = url => { const b = atob(String(url).split(',')[1] || ''), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const fiTamImagen = url => new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; });

/* PDF hecho a mano (sin librerías): cada página escaneada como imagen JPG con el texto detectado encima, invisible
   (se puede buscar y copiar, como un PDF de escáner), y al final la hoja «Datos de la factura». */
// Ancho aproximado de un texto en Helvetica (en «em»), para que cada palabra invisible tape justo la palabra de la foto.
function fiAnchoHelvetica(t){
  let a = 0;
  for(const ch of String(t)){
    if(/[ilIjtf.,;:!'|]/.test(ch)) a += 0.28; else if(/[mwMW]/.test(ch)) a += 0.86; else if(/[A-ZÁÉÍÓÚÑ]/.test(ch)) a += 0.69;
    else if(/[0-9$]/.test(ch)) a += 0.556; else if(/[rJ]/.test(ch)) a += 0.36; else a += 0.53;
  }
  return a;
}
function fiPdf(paginas, resumen){
  const WIN = { 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2026: 0x85, 0x20AC: 0x80 };
  const bytes = str => { const u = new Uint8Array(str.length); for(let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 255; return u; };
  const txt = t => '(' + Array.from(String(t == null ? '' : t)).map(ch => { let c = ch.codePointAt(0); if(WIN[c]) c = WIN[c]; else if(c > 255 || c < 32) c = c < 32 ? 32 : 63; const x = String.fromCharCode(c); return x === '(' || x === ')' || x === '\\' ? '\\' + x : x; }).join('') + ')';
  const n2 = v => (Math.round(v * 100) / 100).toString();
  const objs = [];                        // cada objeto: [partes…] (texto o bytes)
  const nuevo = () => { objs.push(null); return objs.length; };
  const CAT = nuevo(), PAGS = nuevo(), F1 = nuevo(), F2 = nuevo(), kids = [];
  objs[F1 - 1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  objs[F2 - 1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const pagina = (W, H, contenido, img) => {
    const cont = nuevo(), pg = nuevo(); let res = '/Font << /F1 ' + F1 + ' 0 R /F2 ' + F2 + ' 0 R >>';
    if(img){ const im = nuevo(); objs[im - 1] = ['<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.jpg.length + ' >>\nstream\n', img.jpg, '\nendstream']; res += ' /XObject << /Im1 ' + im + ' 0 R >>'; }
    const c = bytes(contenido);
    objs[cont - 1] = ['<< /Length ' + c.length + ' >>\nstream\n', c, '\nendstream'];
    objs[pg - 1] = ['<< /Type /Page /Parent ' + PAGS + ' 0 R /MediaBox [0 0 ' + n2(W) + ' ' + n2(H) + '] /Resources << ' + res + ' >> /Contents ' + cont + ' 0 R >>'];
    kids.push(pg);
  };
  // Páginas escaneadas
  (paginas || []).forEach(pg => {
    const W = 595.28, H = W * pg.h / pg.w;
    let c = 'q ' + n2(W) + ' 0 0 ' + n2(H) + ' 0 0 cm /Im1 Do Q\n';
    const o = pg.ocr;
    if(o && (o.words || []).length && o.w && o.h){
      c += 'BT 3 Tr\n';                  // 3 = texto invisible (encima de la imagen, para buscar y copiar)
      o.words.forEach(wd => {
        const fs = Math.max(2, (wd.y1 - wd.y0) / o.h * H), ancho = (wd.x1 - wd.x0) / o.w * W, nat = fs * Math.max(0.3, fiAnchoHelvetica(wd.t));
        c += '/F1 ' + n2(fs) + ' Tf ' + n2(Math.max(20, Math.min(400, ancho / nat * 100))) + ' Tz 1 0 0 1 ' + n2(wd.x0 / o.w * W) + ' ' + n2(H - wd.y1 / o.h * H + fs * 0.15) + ' Tm ' + txt(wd.t) + ' Tj\n';
      });
      c += 'ET\n';
    } else if(o && o.text){
      c += 'BT 3 Tr /F1 6 Tf\n'; let y = H - 10;
      String(o.text).split(/\n+/).slice(0, 200).forEach(l => { if(y < 4) return; c += '1 0 0 1 10 ' + n2(y) + ' Tm ' + txt(l) + ' Tj\n'; y -= 7; });
      c += 'ET\n';
    }
    pagina(W, H, c, { w: pg.w, h: pg.h, jpg: pg.jpg });
  });
  // Hoja «Datos de la factura» (texto normal, visible)
  if(resumen && resumen.length){
    const W = 595.28, H = 841.89, M = 40; let c = '', y = H - M;
    const linea = (partes, tam, neg) => { if(y < M + tam){ pagina(W, H, c); c = ''; y = H - M; } partes.forEach(([x, t]) => { c += 'BT /' + (neg ? 'F2' : 'F1') + ' ' + tam + ' Tf 1 0 0 1 ' + n2(M + x) + ' ' + n2(y) + ' Tm ' + txt(t) + ' Tj ET\n'; }); y -= tam * 1.45; };
    resumen.forEach(r => { if(r.raya){ c += '0.6 w ' + M + ' ' + n2(y + 6) + ' m ' + n2(W - M) + ' ' + n2(y + 6) + ' l S\n'; y -= 6; return; } linea(r.partes, r.tam || 9, r.neg); });
    pagina(W, H, c);
  }
  objs[PAGS - 1] = ['<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>'];
  objs[CAT - 1] = ['<< /Type /Catalog /Pages ' + PAGS + ' 0 R >>'];
  const partes = [bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offs = []; let len = partes[0].length;
  objs.forEach((ob, i) => {
    offs.push(len);
    [('' + (i + 1) + ' 0 obj\n')].concat(ob, ['\nendobj\n']).forEach(x => { const u = typeof x === 'string' ? bytes(x) : x; partes.push(u); len += u.length; });
  });
  const xref = len;
  let tr = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  tr += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + CAT + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  partes.push(bytes(tr));
  return new Blob(partes, { type: 'application/pdf' });
}
// Renglones de la hoja «Datos de la factura».
function fiResumenPdf(p){
  const h = p.header || {}, r = [], corta = (t, n) => { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const pesos = v => '$' + Math.round(v || 0).toLocaleString('es-CO');
  const catN = id => { const c = id ? (data.categories || []).find(k => String(k.id) === String(id)) : null; return c ? c.name : ''; };
  r.push({ partes: [[0, 'Datos de la factura']], tam: 16, neg: true });
  r.push({ partes: [[0, (p.supplier || 'Proveedor sin nombre') + (p.invoiceNumber ? ' · Factura ' + p.invoiceNumber : '')]], tam: 11, neg: true });
  const datos = [['Fecha', p.date || ''], ['NIT', h.supplierNit || h.nit || ''], ['Procesada', p.procesadaEn ? new Date(p.procesadaEn).toLocaleString('es-CO') : ''], ['Confirmó', p.usuario || '']].filter(x => x[1]);
  datos.forEach(([k, v]) => r.push({ partes: [[0, k + ':'], [80, v]], tam: 9 }));
  r.push({ raya: true });
  r.push({ partes: [[0, 'Producto'], [205, 'Código'], [290, 'Categoría'], [380, 'Cant.'], [420, 'Costo/u'], [470, 'Total']], tam: 8.5, neg: true });
  (p.items || []).forEach(i => r.push({ partes: [[0, corta(i.name, 42)], [205, corta(i.codigo || i.barcode || '', 16)], [290, corta(catN(i.categoryId), 17)], [380, String(i.qty || 0)], [420, pesos(i.cost)], [470, pesos(i.total != null ? i.total : (i.qty || 0) * (i.cost || 0))]], tam: 8.5 }));
  r.push({ raya: true });
  if(p.subtotal) r.push({ partes: [[330, 'Subtotal'], [470, pesos(p.subtotal)]], tam: 9 });
  if(p.ivaTotal) r.push({ partes: [[330, 'IVA'], [470, pesos(p.ivaTotal)]], tam: 9 });
  r.push({ partes: [[330, 'TOTAL'], [470, pesos(p.total)]], tam: 10.5, neg: true });
  r.push({ partes: [[0, 'Generado por ORDEVA.']], tam: 7.5 });
  return r;
}
// Descargar una factura guardada: 'pdf' (escaneada + texto + datos) o 'jpg' (cada página en HD).
async function fiDescargarFactura(p, tipo, avisar){
  avisar = avisar || (t => showToast(t, 4000));
  const pags = await fiEscaneosDe(p, avisar);
  if(tipo === 'jpg'){
    if(!pags.length){ showToast('La foto de esta factura no quedó guardada en este equipo.'); return false; }
    for(let i = 0; i < pags.length; i++){ const b = await (await fetch(pags[i].url)).blob(); fiDescargar(b, fiNombreArchivo(p, '').replace(/\.$/, '') + (pags.length > 1 ? ' pag ' + (i + 1) : '') + '.jpg'); }
    showToast('⬇️ ' + (pags.length > 1 ? pags.length + ' imágenes HD descargadas' : 'Imagen HD descargada') + ' (Descargas).');
    return true;
  }
  const paginas = [];
  for(let i = 0; i < pags.length; i++){
    avisar('🔎 Detectando el texto' + (pags.length > 1 ? ' (página ' + (i + 1) + ' de ' + pags.length + ')' : '') + '…');
    let ocr = null; try{ ocr = await fiOcrEscaneo(pags[i].id, pags[i].url); }catch(e){}
    const t = await fiTamImagen(pags[i].url); if(!t) continue;
    paginas.push({ jpg: fiDataUrlABytes(pags[i].url), w: t.w, h: t.h, ocr });
  }
  fiDescargar(fiPdf(paginas, fiResumenPdf(p)), fiNombreArchivo(p, 'pdf'));
  showToast('⬇️ PDF descargado' + (paginas.length ? ' (' + paginas.length + ' página' + (paginas.length > 1 ? 's' : '') + ' escaneada' + (paginas.length > 1 ? 's' : '') + ' en HD' + (paginas.some(x => x.ocr) ? ', con el texto' : '') + ')' : ' (los datos de la factura)') + '.', 5000);
  return true;
}

let invoiceDraft = null; // { supplier, date, header, archivo, items:[{name,originalDescription,qty,cost,productId,match,newPrice,include}] }

// Desglose por unidad que se ve en cada renglón: sin IVA + IVA = con IVA, y el total de la compra.
function fiDesgloseHtml(it){
  const c = it.cost || 0, r = it.ivaPct || 0, sin = c / (1 + r);
  const po = it.pesoOpc;
  const peso = it.contentPerUnit ? '<br>⚖️ Cada unidad: <b>' + invEsc(String(it.contentPerUnit)) + '</b>' + (it.pesoNota ? ' <small>(' + invEsc(it.pesoNota) + ')</small>' : '') +
    (po ? ' <button type="button" class="iv-peso-flip">' + (it.pesoModo === 'div' ? '↩️ No dividir: ' + invEsc(po.tot) + ' c/u' : '➗ Dividir: ' + invEsc(po.div) + ' c/u') + '</button>' : '') : '';
  return it.qty + ' unid. × (' + fmt(Math.round(sin)) + ' sin IVA + ' + fmt(Math.round(c - sin)) + ' IVA ' + Math.round(r * 100) + '%) = <b>' + fmt(Math.round(c)) + ' c/u</b> · total ' + fmt(Math.round(c * it.qty)) + peso;
}
/* ---------- Categoría y código de cada producto de la factura ----------
   Cada renglón lleva su propia categoría (la del producto si ya existe; si es nuevo, la que se parezca: cervezas,
   gaseosas, licores…) y su código (de barras o interno: el que trae la factura, el del producto o uno escrito/escaneado). */
const fiSinT = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const FI_CAT_PISTAS = [
  [/\b(cerveza|pilsen|lager|aguila|poker|club colombia|costena|corona|heineken|budweiser|stella|redds|andina|tres cordilleras|bbc)\b/, /cervez|pola/],
  [/\b(gaseosa|coca|pepsi|postobon|sprite|colombiana|manzana postobon|quatro|uva|7up|seven up|big cola|ginger)\b/, /gaseos|bebida|refresc/],
  [/\b(agua|cristal|brisa|manantial|h2o)\b/, /agua|bebida/],
  [/\b(jugo|hit|tutti|del valle|frutto|natumalta|malta|pony)\b/, /jug|malta|bebida/],
  [/\b(energizante|red bull|vive 100|speed|monster|volt)\b/, /energ|bebida/],
  [/\b(aguardiente|antioqueno|nectar|ron|medellin|viejo de caldas|whisky|whiskey|old parr|buchanan|vodka|tequila|vino|ginebra|brandy|licor)\b/, /licor|trago|aguardient|ron|vino/],
  [/\b(papas|margarita|chitos|de todito|doritos|tostacos|platanitos|mani|snack|natuchips|yupi|choclitos|cheetos)\b/, /snack|mecato|paquet|pasaboc/],
  [/\b(cigarrillo|cigarro|marlboro|lucky|boston|belmont|pielroja)\b/, /cigarr|tabaco/],
  [/\b(chocolatina|jet|jumbo|chicle|bombon|dulce|galleta|festival|ducales|wafer)\b/, /dulce|golosin|confit|galleta/],
  [/\b(hielo)\b/, /hielo/]
];
function fiCategoriaSugerida(it){
  const m = it.productId ? data.products.find(p => p.id === it.productId) : null;
  if(m) return m.categoryId || '';
  const cats = data.categories || []; if(!cats.length) return '';
  const nom = fiSinT((it.name || '') + ' ' + (it.originalDescription || ''));
  // 1) La categoría de otro producto que empiece igual («Cerveza Águila…» → la de «Cerveza Póker»)
  const pal = nom.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !/^(caja|paca|und|unid|unidad|botella|lata|litro|pet|vidrio|x\d+)$/.test(w));
  for(const w of pal.slice(0, 2)){
    const cnt = {}; data.products.forEach(p => { if(p.categoryId && !p.combo && fiSinT(p.name).split(/[^a-z0-9]+/).includes(w)) cnt[p.categoryId] = (cnt[p.categoryId] || 0) + 1; });
    const mejor = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if(mejor && cats.some(c => c.id === mejor)) return mejor;
  }
  // 2) Por el tipo de producto, si ya existe una categoría así
  for(const [re, cre] of FI_CAT_PISTAS){ if(re.test(nom)){ const c = cats.find(k => cre.test(fiSinT(k.name))); if(c) return c.id; } }
  return '';
}
function fiCodigoSugerido(it){
  const m = it.productId ? data.products.find(p => p.id === it.productId) : null;
  return String(it.barcode || (m && (m.codigo || (m.barcodes || [])[0])) || it.sku || '').trim();
}
function fiCatOpciones(sel){
  return '<option value="">Sin categoría</option>' + (data.categories || []).filter(c => c.id !== (typeof PROMO_CAT !== 'undefined' ? PROMO_CAT : '')).map(c => '<option value="' + invEsc(c.id) + '"' + (String(c.id) === String(sel) ? ' selected' : '') + '>' + invEsc(c.name) + '</option>').join('') + '<option value="__nueva">➕ Nueva categoría…</option>';
}
function fiCatCodigoHtml(it){
  if(it.categoryId === undefined) it.categoryId = fiCategoriaSugerida(it);
  if(it.codigo === undefined) it.codigo = fiCodigoSugerido(it);
  return '<div class="iv-grid iv-catgrid">' +
      '<div><label>🏷️ Categoría</label><select class="iv-cat">' + fiCatOpciones(it.categoryId) + '</select></div>' +
      '<div><label>🔢 Código (barras o interno)</label><div class="iv-codewrap"><input type="text" class="iv-code" maxlength="40" autocomplete="off" autocapitalize="characters" placeholder="Opcional" value="' + invEsc(it.codigo || '') + '"><button type="button" class="iv-code-scan" title="Escanear el código con la cámara">📷</button></div></div>' +
    '</div>' +
    '<div class="iv-catnew" hidden><input type="text" class="iv-catnew-in" maxlength="40" placeholder="Nombre de la nueva categoría"><button type="button" class="btn-primary iv-catnew-ok">Crear</button></div>';
}
// Crea la categoría (o usa la que ya se llame igual) y devuelve su id.
const fiCatValida = id => { const c = id ? (data.categories || []).find(k => String(k.id) === String(id)) : null; return c ? c.id : null; };
function fiCrearCategoria(nombre){
  nombre = String(nombre || '').trim().slice(0, 40); if(!nombre) return null;
  data.categories = data.categories || [];
  const ya = data.categories.find(c => fiSinT(c.name) === fiSinT(nombre)); if(ya) return ya.id;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  data.categories.push({ id, name: nombre }); saveData();
  try{ renderProductos(); }catch(e){}
  return id;
}
// Barra «Poner a todos la misma categoría» (arriba de los productos).
function fiCatTodosHtml(){
  if(!invoiceDraft || invoiceDraft.items.length < 2) return '';
  return '<div class="iv-cattodos"><label>🏷️ Poner a todos la categoría</label><div class="iv-codewrap"><select id="ivCatTodosSel">' + fiCatOpciones('') + '</select><button type="button" class="btn-ghost" id="ivCatTodosBtn">Aplicar a todos</button></div>' +
    '<div class="iv-catnew" id="ivCatTodosNueva" hidden><input type="text" id="ivCatTodosNuevaIn" maxlength="40" placeholder="Nombre de la nueva categoría"><button type="button" class="btn-primary" id="ivCatTodosNuevaOk">Crear</button></div>' +
    '<div class="iv-note">Luego puedes cambiar la de cada producto.</div></div>';
}
function invoiceRowHtml(it, i){
  const matched = it.productId ? data.products.find(p => p.id === it.productId) : null;
  const inc = matched && matched.cost != null && it.cost > matched.cost;
  const incPct = inc ? Math.round((it.cost - matched.cost) / matched.cost * 100) : 0;
  const real = data.products.filter(p => !p.combo).slice().sort((a, b) => a.name.localeCompare(b.name));
  const cands = (it.match && it.match.candidatos) || [];
  const optsCand = cands.length ? '<optgroup label="Posibles productos encontrados">' + cands.map(c => '<option value="' + c.id + '"' + (c.id === it.productId ? ' selected' : '') + '>' + invEsc(c.name) + ' · ' + c.conf + '%</option>').join('') + '</optgroup>' : '';
  const opts = '<option value="">➕ Crear producto nuevo</option>' + optsCand + '<optgroup label="Todos los productos">' + real.filter(p => !cands.some(c => c.id === p.id)).map(p => '<option value="' + p.id + '"' + (p.id === it.productId ? ' selected' : '') + '>' + invEsc(p.name + (p.size ? ' · ' + p.size : '')) + '</option>').join('') + '</optgroup>';
  const marginPct = typeof it.marginPct === 'number' ? it.marginPct : invoiceInferMargin(matched);
  const utilidad = it.newPrice > 0 ? it.newPrice - it.cost : 0;
  const cajas = it.cajas || 1, unidadesPorCaja = it.unidadesPorCaja || 1, ivaPct = it.ivaPct || 0, costoSinIva = it.costoSinIva || 0;
  const costoConIvaPorCaja = costoSinIva * (1 + ivaPct);
  const totalCompraConIva = cajas * costoConIvaPorCaja;
  const precioActual = typeof it.precioActual === 'number' ? it.precioActual : null;
  const margenActual = (precioActual != null && precioActual > 0) ? (precioActual - it.cost) / precioActual : null;
  const utilidadActual = precioActual != null ? precioActual - it.cost : null;
  return '<div class="iv-item' + (it.include ? '' : ' iv-skip') + '" data-i="' + i + '">' +
    '<div class="iv-top"><input type="text" class="iv-name-in" value="' + invEsc(it.name) + '" maxlength="60" placeholder="Nombre del producto" title="Toca para cambiarle el nombre">' +
    '<span class="iv-name-flags">' +
      (matched ? '' : '<span class="iv-flag new">nuevo</span>') +
      (inc ? '<span class="iv-flag up">⬆ ' + incPct + '%</span>' : '') +
    '</span><label><input type="checkbox" class="iv-inc" ' + (it.include ? 'checked' : '') + '> incluir</label></div>' +
    (it.originalDescription ? '<div class="iv-orig" title="Así viene escrito en la factura">🧾 ' + invEsc(it.originalDescription) + '</div>' : '') +
    (it.ajustes && it.ajustes.length ? '<div class="iv-ajuste">🧮 ORDEVA calculó: ' + invEsc(it.ajustes.join(' · ')) + '</div>' : '') +
    '<div class="iv-desglose">' + fiDesgloseHtml(it) + '</div>' +
    fiChipConfianza(it) +
    '<div class="iv-full" style="margin-bottom:8px"><label>Coincide con</label><select class="iv-match">' + opts + '</select></div>' +
    fiCatCodigoHtml(it) +
    '<div class="iv-grid iv-presgrid"><div><label>Presentación</label><input type="text" class="iv-pres" maxlength="40" placeholder="Ej. 24 x 594 g" value="' + invEsc(it.presentation || '') + '"></div>' +
    '<div><label>Unidad</label><input type="text" class="iv-unidad" maxlength="12" placeholder="und, caja, kg…" value="' + invEsc(it.unit || '') + '"></div></div>' +

    // ---------- 1) LA COMPRA: lo que te costó esta factura ----------
    '<div class="iv-section">' +
      '<div class="iv-section-title">🧾 Lo que te costó (esta compra)</div>' +
      '<div class="iv-grid">' +
        '<div><label>Cantidad (unidades)</label><input type="number" inputmode="numeric" class="iv-qty' + (it.qtyFalta ? ' iv-falta' : '') + '" min="1" step="1" value="' + it.qty + '"></div>' +
        '<div><label>Costo por unidad (con IVA)</label><input type="number" class="iv-cost" min="0" step="50" value="' + it.cost + '"></div>' +
      '</div>' +
      (it.qtyFalta ? '<div class="iv-falta-msg">⚠️ No se leyó cuántas unidades son. Escribe la cantidad (o abre «📦 ¿Viene en cajas?») y ORDEVA divide el total entre las unidades.</div>' : '') +
      '<div class="iv-note iv-division">' + fiDivisionTxt(it) + '</div>' +
      (matched && matched.cost != null ? '<div class="iv-note">Costo anterior de este producto: ' + fmt(matched.cost) + '</div>' : '') +
      '<div class="iv-full" style="margin-top:6px"><label>Total de la compra (' + cajas + ' × ' + unidadesPorCaja + ' = ' + (cajas * unidadesPorCaja) + ' unid., con IVA)</label><input type="number" class="iv-totalcompra" min="0" step="1" value="' + Math.round(totalCompraConIva) + '"></div>' +
      '<details class="iv-boxdetails"' + ((it.qtyFalta || (it.cajas || 1) > 1) ? ' open' : '') + '><summary>📦 ¿Viene en cajas o paquetes? (ej. 1 caja × 24 unidades)</summary>' +
        '<div class="iv-grid" style="margin-top:8px">' +
          '<div><label>Cant. cajas / paquetes</label><input type="number" class="iv-cajas" min="1" step="1" value="' + cajas + '"></div>' +
          '<div><label>Unid. por caja / paquete</label><input type="number" class="iv-unidxcaja" min="1" step="1" value="' + unidadesPorCaja + '"></div>' +
          '<div><label>Precio compra sin IVA (por caja)</label><input type="number" class="iv-costosiniva" min="0" step="50" value="' + Math.round(costoSinIva) + '"></div>' +
          '<div><label>IVA %</label><input type="number" class="iv-ivapct" min="0" max="30" step="1" value="' + Math.round(ivaPct * 100) + '"></div>' +
          '<div class="iv-full"><label>Precio compra CON IVA (por caja)</label><input type="number" class="iv-costoconiva" min="0" step="50" value="' + Math.round(costoConIvaPorCaja) + '"></div>' +
        '</div>' +
      '</details>' +
    '</div>' +

    // ---------- 2) LA VENTA: a cómo lo tienes, a cómo se sugiere, y si ganas o pierdes ----------
    '<div class="iv-section iv-section-venta">' +
      '<div class="iv-section-title">💰 A cómo lo vendes</div>' +
      '<div class="iv-grid">' +
        '<div><label>Precio actual (al que lo tienes hoy)</label><input type="number" class="iv-precioactual" min="0" step="50" placeholder="Ingresar valor" value="' + (precioActual != null ? Math.round(precioActual) : '') + '"></div>' +
        '<div><label>Margen al precio actual</label><span class="iv-actual-margen ' + (margenActual == null ? '' : (margenActual < 0 ? 'bad' : 'good')) + '">' + (margenActual == null ? '—' : Math.round(margenActual * 100) + '%') + '</span></div>' +
      '</div>' +
      (utilidadActual == null ? '' :
        '<div class="iv-actual-verdict ' + (utilidadActual < 0 ? 'bad' : (utilidadActual === 0 ? '' : 'good')) + '">' +
          (utilidadActual < 0
            ? '⚠️ Estás PERDIENDO ' + fmt(Math.abs(utilidadActual)) + ' por unidad al precio actual (costo ' + fmt(it.cost) + ' vs. venta ' + fmt(precioActual) + ').'
            : utilidadActual === 0
              ? '➖ Ni ganas ni pierdes: vendes exactamente al costo (' + fmt(it.cost) + ').'
              : '✅ Estás GANANDO ' + fmt(utilidadActual) + ' por unidad al precio actual (' + Math.round(margenActual * 100) + '% de margen).') +
        '</div>') +
      '<div class="iv-subsection-title">Precio sugerido (según el margen que quieras dejar)</div>' +
      '<div class="iv-grid">' +
        '<div><label>Margen de venta %</label><input type="number" class="iv-margin" min="0" max="90" step="1" value="' + Math.round(marginPct * 100) + '"></div>' +
        '<div><label>Utilidad por unidad (al sugerido)</label><span class="iv-profit">' + fmt(utilidad) + '</span></div>' +
        '<div class="iv-full"><label>Precio sugerido (el que se va a aplicar al inventario)</label><input type="number" class="iv-price" min="0" step="100" value="' + it.newPrice + '"></div>' +
        '<div class="iv-full"><button type="button" class="btn-ghost iv-webprice">🌐 Ver a cómo lo tienen en el mercado</button><div class="iv-note iv-webprice-note">' + invEsc(it.webPriceNote || '') + '</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}
function fiChipConfianza(it){
  const m = it.match; if(!m) return '';
  const elegido = it.productId && (m.candidatos || []).find(c => c.id === it.productId);
  if(!it.productId) return '<div class="iv-conf nuevo">➕ Producto nuevo' + ((m.candidatos || []).length ? ' · hay ' + m.candidatos.length + ' parecido(s) en la lista' : '') + '</div>';
  if(!elegido) return '<div class="iv-conf manual">✋ Elegido por ti</div>';
  const cls = elegido.conf >= 95 ? 'muy' : elegido.conf >= 85 ? 'alta' : 'revisar';
  const txt = elegido.conf >= 95 ? 'Coincidencia muy alta' : elegido.conf >= 85 ? 'Coincidencia alta' : 'Posible coincidencia: revísela';
  return '<div class="iv-conf ' + cls + '">' + (cls === 'revisar' ? '⚠️ ' : '✅ ') + txt + ' · ' + elegido.conf + '% <small>(' + invEsc(elegido.motivo || '') + ')</small></div>';
}
function fiHeaderHtml(){
  const h = invoiceDraft.header || {};
  const val = k => k === 'supplier' ? (invoiceDraft.supplier || h.supplier || '') : (h[k] == null ? '' : h[k]);
  const esNum = k => ['subtotal', 'iva', 'retenciones', 'otrosImpuestos', 'descuentos', 'total'].includes(k);
  const esFecha = k => /Date$/.test(k);
  const clave = new Set(['invoiceNumber', 'supplier', 'supplierNit', 'issueDate', 'subtotal', 'total']);
  const campo = ([k, lab]) => { const v = val(k), falta = v === '' || v == null, fuerte = falta && clave.has(k);
    return '<div class="ivh-f' + (fuerte ? ' falta' : falta ? ' vacio' : '') + '"><label>' + lab + (falta ? ' <em>Revisar dato</em>' : '') + '</label>' +
      '<input data-h="' + k + '" type="' + (esNum(k) ? 'number' : esFecha(k) ? 'date' : 'text') + '"' + (esNum(k) ? ' min="0" step="1"' : ' maxlength="' + (k === 'cufe' ? 120 : 80) + '"') + ' value="' + invEsc(String(v)) + '"></div>'; };
  const principales = FI_CAMPOS.slice(0, 11), otros = FI_CAMPOS.slice(11);
  return '<div class="ivh-grid">' + principales.map(campo).join('') + '</div>' +
    '<details class="ivh-mas"><summary>Más datos (dirección, teléfono, pago, CUFE…)</summary><div class="ivh-grid">' + otros.map(campo).join('') + '</div></details>';
}
function fiPintarAvisos(){
  const box = document.getElementById('ivAvisos'); if(!box || !invoiceDraft) return;
  const av = fiValidar(invoiceDraft);
  box.innerHTML = av.length ? '<div class="iv-avisos"><b>⚠️ Para revisar (' + av.length + ')</b><ul>' + av.map(a => '<li class="iva-' + a.tipo + '">' + invEsc(a.txt) + '</li>').join('') + '</ul></div>' : '<div class="iv-avisos ok">✅ Los valores cuadran y no hay datos dudosos.</div>';
  const ia = document.getElementById('ivIaMsg'); if(ia){ ia.hidden = !invoiceDraft.iaMsg; ia.textContent = invoiceDraft.iaMsg || ''; }
}
function renderInvoiceReview(){
  const hb = document.getElementById('ivHeader'); if(hb) hb.innerHTML = fiHeaderHtml();
  document.getElementById('invoiceBody').innerHTML = invoiceDraft.items.map(invoiceRowHtml).join('');
  const ct = document.getElementById('ivCatTodos'); if(ct) ct.innerHTML = fiCatTodosHtml();
  fiPintarAvisos();
}
document.getElementById('ivHeader').addEventListener('input', e => {
  const el = e.target.closest('[data-h]'); if(!el || !invoiceDraft) return;
  const k = el.dataset.h, v = el.value.trim();
  invoiceDraft.header = invoiceDraft.header || {};
  if(k === 'supplier') invoiceDraft.supplier = v;
  invoiceDraft.header[k] = v === '' ? null : (el.type === 'number' ? Number(v) : v);
  if(k === 'issueDate') invoiceDraft.date = v;
  clearTimeout(fiPintarAvisos.t); fiPintarAvisos.t = setTimeout(fiPintarAvisos, 300);
});
document.getElementById('invoiceBody').addEventListener('change', e => {
  if(!invoiceDraft || !e.target.closest('.iv-item')) return;
  invoiceReadRow(e.target.closest('.iv-item'));
  if(e.target.classList.contains('iv-match')){
    const row = e.target.closest('.iv-item'), it = invoiceDraft.items[+row.dataset.i];
    const chip = row.querySelector('.iv-conf'); if(chip) chip.outerHTML = fiChipConfianza(it);
  }
  clearTimeout(fiPintarAvisos.t); fiPintarAvisos.t = setTimeout(fiPintarAvisos, 300);
});
function invFindDuplicate(name){                 // como invMatch, pero también prueba una coincidencia exacta (dupKey)
  const exact = data.products.find(p => dupKey(p) === dupKey({ name }));
  return exact || invMatch(name);
}
function invoiceMatchItems(rawItems, proveedor){    // arma las filas de revisión a partir de lo que leyó la IA o el OCR
  const n01 = v => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);
  return (rawItems || [])
    // Regla clave: un renglón solo es un producto si tiene precio. Sin
    // precio (0 o vacío) no se muestra como "detectado" — así el nombre
    // esté en clave o abreviado, lo que lo hace producto es el precio.
    .filter(x => x && (x.name || x.original) && (Number(x.qty) > 0) && (Number(x.unit_cost) > 0))
    .slice(0, 60)
    .map(x => {
      const original = String(x.original || x.name || '').trim().slice(0, 120);   // nunca se borra
      const pres = fiPresentacion(original + ' ' + (x.presentation || ''));
      const upp = n01(x.units_per_package) || pres.unidadesPorPaquete || null;
      const match = fiCoincidir({ name: x.name || original, originalDescription: original, sku: x.sku, barcode: x.barcode }, proveedor);
      const matched = match.productId ? data.products.find(p => p.id === match.productId) : null;
      const cost = Math.round((Number(x.unit_cost) || 0) * 100) / 100;   // con centavos: así cantidad × costo da el total exacto
      const marginPct = invoiceInferMargin(matched);
      const qty = Math.max(1, Math.round(Number(x.qty) || 1));
      const lineTotal = n01(x.line_total);
      // Desglose por cajas/paquetes (si el escaneo sin internet lo trajo) o,
      // si no, un desglose "de 1 sola caja" equivalente para poder editarlo
      // igual (cuántas cajas llegaron, unidades por caja, precio sin IVA…).
      const cajas = x.cajas != null ? Math.max(1, Math.round(Number(x.cajas) || 1)) : 1;
      const unidadesPorCaja = x.unidades_por_caja != null ? Math.max(1, Math.round(Number(x.unidades_por_caja) || 1)) : qty;
      let ivaLeido = n01(x.iva_pct); if(ivaLeido != null && ivaLeido > 0 && ivaLeido < 1) ivaLeido = Math.round(ivaLeido * 100);
      const ivaPct = ivaLeido != null ? ivaLeido / 100 : 0;
      // Precio sin IVA POR CAJA (el campo de la revisión es por caja): antes se llenaba con el costo de UNA
      // unidad y el «Total de la compra» mostraba el precio de una sola unidad.
      const costoSinIva = x.costo_sin_iva != null ? Math.max(0, Number(x.costo_sin_iva) || 0) : (ivaPct > 0 ? cost / (1 + ivaPct) : cost) * unidadesPorCaja;
      // Si la cantidad coincide con las unidades del paquete pero el total del renglón es el
      // de un solo paquete, seguramente se tomó la presentación como cantidad: se avisa.
      const qtyDeColumna = !(upp > 1 && qty === upp && lineTotal != null && Math.abs(lineTotal - cost) <= Math.max(50, cost * 0.02));
      // Peso o volumen de CADA unidad. «MAGGI 24X594G» comprado por paquete: los 594 g son del paquete completo,
      // así que cada unidad pesa 594 ÷ 24 = 24,75 g. Si se compraron sueltas («LECHERA 48X80G», 4 a $2.742) o
      // el resultado no tiene sentido (menos de 5 g o ml), el peso escrito ya es el de cada unidad.
      // Solo se divide sola cuando el peso NO es un tamaño típico de una unidad (594 g sí se divide; 300 g, 80 g o
      // 1000 ml no: «JABON REY 3X300G» son 3 barras de 300 g). En la revisión hay un botón para cambiarlo a mano.
      let pesoU = null, volU = null, pesoNota = '', pesoOpc = null;
      const repartido = upp > 1 && Number(x.unidades_por_caja) === upp;
      if(pres.orden === 'nx' && upp > 1 && (pres.pesoG > 0 || pres.volumenMl > 0)){
        const tot = pres.pesoG > 0 ? pres.pesoG : pres.volumenMl, cada = tot / upp, u = pres.pesoG > 0 ? 'g' : 'ml';
        if(cada >= 5){
          const r = Math.round(cada * 100) / 100, f = v => String(v).replace('.', ',') + ' ' + u;
          pesoOpc = { div: f(r), tot: f(tot), nota: f(tot) + ' ÷ ' + upp + ' = ' + f(r) + ' cada una', u, r, total: tot, upp };
          if(repartido && Math.round(tot) % 5 !== 0){ if(u === 'g') pesoU = r; else volU = r; pesoNota = pesoOpc.nota; }
        }
      }
      return {
        name: (matched ? (x.name || original) : (x.nombreIA && x.name && !pesoNota) ? String(x.name) : (pesoNota ? fiNombreSugerido(original).replace(new RegExp('\\b' + String(pres.contenido).replace('.', '[.,]') + '\\s*' + (pesoU ? 'g' : 'ml') + '\\b', 'i'), String(pesoU || volU).replace('.', ',') + ' ' + (pesoU ? 'g' : 'ml')) : fiNombreSugerido(original))).slice(0, 60),
        originalDescription: original,
        sku: x.sku ? String(x.sku).slice(0, 30) : null, barcode: x.barcode ? String(x.barcode).replace(/\D/g, '').slice(0, 14) || null : null,
        brand: x.brand || fiNormalizar(original).marca || null, unit: x.unit || null,
        presentation: pesoNota ? upp + ' x ' + String(pesoU || volU).replace('.', ',') + ' ' + (pesoU ? 'g' : 'ml') + ' (' + (pres.presentacion || '').replace(/^\d+ x /, '') + ' en total)' : (x.presentation || pres.presentacion || ''), unitsPerPackage: upp,
        contentPerUnit: pesoNota ? String(pesoU || volU).replace('.', ',') + ' ' + (pesoU ? 'g' : 'ml') : (x.content_per_unit || (pres.contenido != null ? String(pres.contenido).replace('.', ',') + (pres.unidadContenido ? ' ' + pres.unidadContenido : '') : null)),
        pesoNota, pesoOpc, pesoModo: pesoNota ? 'div' : 'tot', weightG: pesoNota ? pesoU : pres.pesoG, volumeMl: pesoNota ? volU : pres.volumenMl, discount: n01(x.discount), ivaPctLeido: ivaLeido, ivaValue: n01(x.iva_value), lineTotal,
        qtyDeColumna, qtyFalta: !!x.qty_falta, match, noCuadra: x.cuadra === false, ajustes: Array.isArray(x.ajustes) ? x.ajustes.slice(0, 4) : [],
        lineSubtotal: n01(x.line_subtotal), lineIva: n01(x.line_iva),
        qty, cost, cajas, unidadesPorCaja, costoSinIva, ivaPct,
        productId: match.productId || '',
        marginPct,
        newPrice: invoicePriceFromMargin(cost, marginPct) || (matched ? matched.price : 0),
        precioActual: matched ? matched.price : null,
        include: true,
        orig: { productId: match.productId || '', qty, cost }
      };
    });
}
/* ---------- Barra de progreso mientras carga/analiza la foto de la factura ----------
   Mientras está cargando solo se ve la barra con el porcentaje: el botón
   "Aplicar al inventario" se esconde (no tiene nada que aplicar todavía) y
   vuelve a aparecer cuando termina el análisis y hay algo que revisar. */
let invoiceProgressTimer = null;
let invoiceProgressHigh = 0;   // nunca deja que la barra retroceda (ej. si el OCR reintenta una segunda pasada)
let invoiceProgressReal = false; // true en cuanto llega progreso real (OCR sin internet): apaga la simulación
function invoiceProgressStart(){
  const applyBtn = document.getElementById('invoiceApplyBtn');
  if(applyBtn) applyBtn.hidden = true;
  const wrap = document.getElementById('invoiceProgress'), fill = document.getElementById('invoiceProgressFill'), pctEl = document.getElementById('invoiceProgressPct');
  if(!wrap || !fill || !pctEl) return;
  clearInterval(invoiceProgressTimer);
  wrap.hidden = false;
  invoiceProgressHigh = 0; invoiceProgressReal = false;
  let p = 0;
  fill.style.width = '0%'; pctEl.textContent = '0%';
  // No hay un progreso real disponible con la IA (es una sola llamada), así
  // que se simula un avance que se acerca a 92% y se queda ahí esperando —
  // invoiceProgressSet() lo reemplaza con el progreso real cuando sí existe
  // (lectura sin internet) y apaga esta simulación, e invoiceProgressDone()
  // lo cierra a 100% al final.
  invoiceProgressTimer = setInterval(() => {
    if(invoiceProgressReal) return;
    p += (92 - p) * 0.07 + 0.4;
    if(p > 92) p = 92;
    invoiceProgressHigh = Math.max(invoiceProgressHigh, p);
    fill.style.width = invoiceProgressHigh.toFixed(0) + '%';
    pctEl.textContent = invoiceProgressHigh.toFixed(0) + '%';
  }, 220);
}
function invoiceProgressSet(pct0a100){
  const fill = document.getElementById('invoiceProgressFill'), pctEl = document.getElementById('invoiceProgressPct');
  if(!fill || !pctEl) return;
  invoiceProgressReal = true;
  const v = Math.max(0, Math.min(99, Math.round(pct0a100)));
  invoiceProgressHigh = Math.max(invoiceProgressHigh, v);
  fill.style.width = invoiceProgressHigh + '%'; pctEl.textContent = invoiceProgressHigh + '%';
}
function invoiceProgressDone(){
  clearInterval(invoiceProgressTimer); invoiceProgressTimer = null;
  const wrap = document.getElementById('invoiceProgress'), fill = document.getElementById('invoiceProgressFill'), pctEl = document.getElementById('invoiceProgressPct');
  if(fill) fill.style.width = '100%';
  if(pctEl) pctEl.textContent = '100%';
  setTimeout(() => {
    if(wrap) wrap.hidden = true;
    const applyBtn = document.getElementById('invoiceApplyBtn');
    if(applyBtn) applyBtn.hidden = false;
  }, 200);
}
function invoiceOpen(info){
  invoiceProgressDone();
  fiEstado('Analizando factura…');
  const header = fiUnirEncabezado(info.header || {}, fiEncabezado(info.rawText || info.textoPdf || ''));
  header.supplier = info.supplier || header.supplier || '';
  if(info.rawText){
    const mios = fiParsearRenglones(info.rawText), viejos = (info.items || []);
    if(mios.length && (mios.length > viejos.length || mios.filter(x => x.cuadra).length >= viejos.length)) info.items = mios;
  }
  if(!header.issueDate && info.date) header.issueDate = info.date;
  fiEstado('Calculando cantidades, IVA y costo por unidad…');
  info.items = fiCuadrar(info.items, header);
  fiEstado('Buscando producto…');
  const items = invoiceMatchItems(info.items, header.supplier);
  invoiceDraft = { supplier: header.supplier, date: header.issueDate || info.date || '', header, items, rawText: info.rawText || '',
    archivo: window.__fiArchivo || null, archivos: window.__fiArchivos || null, fuente: info.fuente || (info.rawText ? 'ocr' : 'ia'), iaMsg: '' };
  window.__fiArchivo = null; window.__fiArchivos = null;
  invoiceResumen(info);
  renderInvoiceReview();
  const rawWrap = document.getElementById('invoiceRawWrap'), rawBox = document.getElementById('invoiceRawText');
  if(info.rawText){ rawBox.value = info.rawText; rawWrap.hidden = false; }
  else { rawBox.value = ''; rawWrap.hidden = true; rawWrap.open = false; }
  document.getElementById('invoiceOverlay').classList.add('show');
  // ORDEVA IA solo para los renglones que quedaron en duda (nunca para lo seguro).
  const draft = invoiceDraft;
  fiDesempatarConIA(items).then(r => {
    if(invoiceDraft !== draft) return;
    if(r.sinIA || r.falla) draft.iaMsg = 'IA temporalmente no disponible. Revise los datos.';
    else if(r.usada) draft.iaMsg = '🧠 ORDEVA IA ayudó a elegir en los productos dudosos (confírmelos).';
    // (lo que el usuario cambie mientras tanto ya quedó en el borrador: cada cambio se lee al instante)
    renderInvoiceReview(); invoiceResumen(info);
  }).catch(() => {});
}
// Línea de resumen + estado «Listo para revisar».
function invoiceResumen(info){
  const items = invoiceDraft.items, ya = items.filter(it => it.productId).length, dudas = items.filter(it => it.match && it.match.revisar && it.productId).length;
  fiEstado(items.length
    ? 'Listo para revisar: ' + items.length + ' producto' + (items.length > 1 ? 's' : '') + (invoiceDraft.supplier ? ' de ' + invoiceDraft.supplier.replace(/\.+$/, '') : '') + '. ' +
      (ya ? ya + ' ya estaba' + (ya > 1 ? 'n' : '') + ' en tu inventario' + (dudas ? ' (' + dudas + ' por confirmar)' : '') + '. ' : '') + 'Revisa y corrige antes de aplicar.'
    : 'No se pudo detectar correctamente el texto. Puede intentar nuevamente o editar manualmente.');
}
document.getElementById('invoiceRawReparseBtn').addEventListener('click', () => {
  if(!invoiceDraft) return;
  if(!window.VitoOfflineOCR || !window.VitoOfflineOCR.parseTextToInvoiceItems){ showToast('Esta función solo funciona con la lectura sin internet.'); return; }
  const text = document.getElementById('invoiceRawText').value;
  let rawItems;
  try{ rawItems = window.VitoOfflineOCR.parseTextToInvoiceItems(text); const mios = fiParsearRenglones(text); if(mios.length >= (rawItems || []).length) rawItems = mios; }
  catch(e){ showToast('No pude releer el texto: ' + (e && e.message ? e.message : 'error desconocido.')); return; }
  invoiceDraft.header = fiUnirEncabezado(invoiceDraft.header || {}, fiEncabezado(text));
  const items = invoiceMatchItems(fiCuadrar(rawItems, invoiceDraft.header), invoiceDraft.supplier);
  invoiceDraft.items = items;
  invoiceDraft.rawText = text;
  document.getElementById('invoiceSub').textContent = items.length
    ? 'Releído: ' + items.length + ' producto' + (items.length > 1 ? 's' : '') + '. Revisa y corrige lo que haga falta antes de aplicar.'
    : 'No logré separar productos en el texto corregido. Ajusta el texto e inténtalo de nuevo.';
  renderInvoiceReview();
  showToast('🔄 Texto releído.');
});
function invoiceReadRow(el){
  const i = +el.dataset.i, it = invoiceDraft.items[i]; if(!it) return it;
  const nameEl = el.querySelector('.iv-name-in');
  if(nameEl){ const v = nameEl.value.trim(); if(v) it.name = v.slice(0, 60); }
  it.include = el.querySelector('.iv-inc').checked;
  const pidAntes = it.productId;
  it.productId = el.querySelector('.iv-match').value;
  // Otro producto elegido: su categoría y su código se vuelven a sugerir (salvo que ya los hayas puesto tú).
  if((pidAntes || '') !== (it.productId || '')){ if(!it.catTocada) it.categoryId = undefined; if(!it.codTocado) it.codigo = undefined; }
  else {
    const catEl = el.querySelector('.iv-cat'), codEl = el.querySelector('.iv-code');
    if(catEl && catEl.value !== '__nueva' && catEl.value !== String(it.categoryId || '')){ it.categoryId = catEl.value; it.catTocada = true; }
    if(codEl){ const v = codEl.value.trim().slice(0, 40); if(v !== (it.codigo || '')){ it.codigo = v; it.codTocado = true; } }
  }
  const qAntes = it.qty, cAntes = it.cost;
  it.qty = Math.max(0, Math.round(invNum(el.querySelector('.iv-qty').value) || 0));
  const cLeido = Math.max(0, invNum(el.querySelector('.iv-cost').value) || 0);
  if(Math.abs(cLeido - (cAntes || 0)) >= 1) it.cost = cLeido;          // si no lo cambiaron, se conservan los centavos calculados
  if(it.noCuadra && (it.qty !== qAntes || Math.round(it.cost) !== Math.round(cAntes))) it.noCuadra = false;   // ya lo corrigió el usuario
  const marginEl = el.querySelector('.iv-margin');
  if(marginEl) it.marginPct = Math.max(0, Math.min(0.9, invNum(marginEl.value, 0) / 100));
  it.newPrice = Math.max(0, invNum(el.querySelector('.iv-price').value) || 0);
  const cajasEl = el.querySelector('.iv-cajas'), unidxEl = el.querySelector('.iv-unidxcaja'),
    siEl = el.querySelector('.iv-costosiniva'), ivaEl = el.querySelector('.iv-ivapct');
  if(cajasEl) it.cajas = Math.max(1, Math.round(invNum(cajasEl.value, 1) || 1));
  if(unidxEl) it.unidadesPorCaja = Math.max(1, Math.round(invNum(unidxEl.value, 1) || 1));
  if(siEl) it.costoSinIva = Math.max(0, invNum(siEl.value, 0) || 0);
  if(ivaEl) it.ivaPct = Math.max(0, Math.min(0.3, invNum(ivaEl.value, 0) / 100));
  const paEl = el.querySelector('.iv-precioactual');
  if(paEl){ const v = paEl.value.trim(); it.precioActual = v === '' ? null : Math.max(0, invNum(v, 0) || 0); }
  const presEl = el.querySelector('.iv-pres'), uniEl = el.querySelector('.iv-unidad');
  if(presEl) it.presentation = presEl.value.trim().slice(0, 40);
  if(uniEl) it.unit = uniEl.value.trim().slice(0, 12) || null;
  return it;
}
// «$60.000 ÷ 24 unid. = $2.500 c/u»: la división a la vista, para saber de dónde sale el costo por unidad.
function fiDivisionTxt(it){
  const total = (it.cajas || 1) * (it.costoSinIva || 0) * (1 + (it.ivaPct || 0)), q = Math.max(1, it.qty || 1);
  if(!(total > 0)) return '';
  return '🧮 Total del renglón ' + fmt(Math.round(total)) + ' ÷ ' + q + (q === 1 ? ' unidad' : ' unidades') + ' = <b>' + fmt(Math.round(total / q)) + '</b> cada una' + ((it.cajas || 1) > 1 ? ' (' + it.cajas + ' × ' + it.unidadesPorCaja + ')' : '');
}
function invoiceRecalcFromBox(it){                // recalcula cantidad y costo/unidad a partir de cajas × unid./caja × precio (con IVA)
  it.qtyFalta = false;
  const totalUnidades = Math.max(1, (it.cajas || 1) * (it.unidadesPorCaja || 1));
  const costoTotalConIva = (it.cajas || 1) * (it.costoSinIva || 0) * (1 + (it.ivaPct || 0));
  it.qty = totalUnidades;
  it.cost = Math.round(costoTotalConIva / totalUnidades);
  it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct) || it.newPrice;
}
function invoiceApplyFieldChange(it, cls, target){  // recalcula el item según qué campo cambió (sin tocar el DOM)
  if(cls.contains('iv-match') || cls.contains('iv-cost')){
    if(cls.contains('iv-cost')){
      // Cambió el costo por unidad a mano: por dentro convertimos ese valor
      // de vuelta al precio por caja sin IVA, para que "Cajas/paquetes" y
      // "Total de la compra" sigan cuadrando con lo que se ve arriba.
      const unidadesPorCaja = it.unidadesPorCaja || 1, ivaPct = it.ivaPct || 0;
      it.costoSinIva = ivaPct > -1 ? (it.cost * unidadesPorCaja) / (1 + ivaPct) : it.cost * unidadesPorCaja;
    }
    // Cambió el producto emparejado o el costo: recalculamos el margen (el
    // que ya tenía ese producto, o el sano por defecto) y el precio sugerido.
    const matched = it.productId ? data.products.find(p => p.id === it.productId) : null;
    it.marginPct = invoiceInferMargin(matched);
    it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct) || (matched ? matched.price : 0);
  } else if(cls.contains('iv-margin')){
    // Cambió el margen de venta a mano: el precio de venta se recalcula solo.
    it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct);
  } else if(cls.contains('iv-price')){
    // Cambió el precio de venta a mano: el margen mostrado se ajusta solo,
    // para que siempre cuadren entre sí.
    it.marginPct = it.newPrice > 0 ? Math.max(0, (it.newPrice - it.cost) / it.newPrice) : it.marginPct;
  } else if(cls.contains('iv-qty')){
    // Cambió la cantidad de unidades a mano: lo que dice la factura es cuánto se PAGÓ por el renglón, así que ese
    // total se mantiene y se DIVIDE entre las unidades (antes se dejaba el costo por unidad y el total se multiplicaba).
    const q = Math.max(1, it.qty || 1), iva = it.ivaPct || 0;
    const total = (it.cajas || 1) * (it.costoSinIva || 0) * (1 + iva);
    if(q % (it.cajas || 1) === 0) it.unidadesPorCaja = q / (it.cajas || 1); else { it.cajas = 1; it.unidadesPorCaja = q; }
    it.qty = q;
    if(total > 0){
      it.costoSinIva = total / (it.cajas * (1 + iva));
      it.cost = Math.round(total / q * 100) / 100;
      it.newPrice = invoicePriceFromMargin(it.cost, it.marginPct) || it.newPrice;
    }
    it.qtyFalta = false;
  } else if(cls.contains('iv-cajas') || cls.contains('iv-unidxcaja') || cls.contains('iv-costosiniva') || cls.contains('iv-ivapct')){
    // Cambió algo del desglose por cajas/paquetes: recalculamos la cantidad
    // total y el costo por unidad, y de ahí el precio de venta sugerido.
    invoiceRecalcFromBox(it);
  } else if(cls.contains('iv-costoconiva')){
    // Precio de la caja YA con IVA, escrito directo: despejamos el precio
    // sin IVA para que el resto de los cálculos sigan cuadrando.
    const ivaPct = it.ivaPct || 0;
    const nuevo = Math.max(0, invNum(target.value, 0) || 0);
    it.costoSinIva = ivaPct > -1 ? nuevo / (1 + ivaPct) : nuevo;
    invoiceRecalcFromBox(it);
  } else if(cls.contains('iv-totalcompra')){
    // Total de la compra (con IVA) escrito directo, ej. lo que dice la
    // factura: despejamos el precio por caja sin IVA a partir de ese total.
    const cajas = it.cajas || 1, ivaPct = it.ivaPct || 0;
    const totalConIva = Math.max(0, invNum(target.value, 0) || 0);
    it.costoSinIva = ivaPct > -1 ? totalConIva / (cajas * (1 + ivaPct)) : totalConIva / cajas;
    invoiceRecalcFromBox(it);
  }
  // iv-precioactual e iv-inc no necesitan recalcular nada más del item: el
  // primero solo se compara contra el costo, y el segundo es un check simple.
}
function invoiceRowComputed(it){                    // los mismos valores derivados que arma invoiceRowHtml, para refrescar la fila en vivo
  const matched = it.productId ? data.products.find(p => p.id === it.productId) : null;
  const marginPct = typeof it.marginPct === 'number' ? it.marginPct : invoiceInferMargin(matched);
  const utilidad = it.newPrice > 0 ? it.newPrice - it.cost : 0;
  const cajas = it.cajas || 1, unidadesPorCaja = it.unidadesPorCaja || 1, ivaPct = it.ivaPct || 0, costoSinIva = it.costoSinIva || 0;
  const costoConIvaPorCaja = costoSinIva * (1 + ivaPct);
  const totalCompraConIva = cajas * costoConIvaPorCaja;
  const precioActual = typeof it.precioActual === 'number' ? it.precioActual : null;
  const margenActual = (precioActual != null && precioActual > 0) ? (precioActual - it.cost) / precioActual : null;
  const utilidadActual = precioActual != null ? precioActual - it.cost : null;
  return { matched, marginPct, utilidad, cajas, unidadesPorCaja, ivaPct, costoSinIva, costoConIvaPorCaja, totalCompraConIva, precioActual, margenActual, utilidadActual };
}
// Actualiza en vivo, mientras se escribe, todos los valores calculados de una
// fila SIN reconstruir su HTML — así no se pierde el foco ni el cursor de lo
// que se está escribiendo (a diferencia de renderInvoiceReview(), que sí
// reconstruye todo y solo se usa para cambios "estructurales", como elegir
// otro producto en "Coincide con").
function invoiceUpdateRowLive(row, it){
  const c = invoiceRowComputed(it);
  const setVal = (sel, val) => { const el = row.querySelector(sel); if(el && el !== document.activeElement) el.value = val; };
  setVal('.iv-qty', it.qty);
  setVal('.iv-cost', it.cost);
  setVal('.iv-margin', Math.round(c.marginPct * 100));
  setVal('.iv-price', it.newPrice);
  setVal('.iv-precioactual', c.precioActual != null ? Math.round(c.precioActual) : '');
  setVal('.iv-cajas', c.cajas);
  setVal('.iv-unidxcaja', c.unidadesPorCaja);
  setVal('.iv-costosiniva', Math.round(c.costoSinIva));
  setVal('.iv-ivapct', Math.round(c.ivaPct * 100));
  setVal('.iv-costoconiva', Math.round(c.costoConIvaPorCaja));
  setVal('.iv-totalcompra', Math.round(c.totalCompraConIva));

  const profitEl = row.querySelector('.iv-profit'); if(profitEl) profitEl.textContent = fmt(c.utilidad);
  const dsg = row.querySelector('.iv-desglose'); if(dsg) dsg.innerHTML = fiDesgloseHtml(it);
  const margenActualEl = row.querySelector('.iv-actual-margen');
  if(margenActualEl){
    margenActualEl.textContent = c.margenActual == null ? '—' : Math.round(c.margenActual * 100) + '%';
    margenActualEl.className = 'iv-actual-margen ' + (c.margenActual == null ? '' : (c.margenActual < 0 ? 'bad' : 'good'));
  }
  const dv = row.querySelector('.iv-division'); if(dv) dv.innerHTML = fiDivisionTxt(it);
  if(!it.qtyFalta){ const fm = row.querySelector('.iv-falta-msg'); if(fm) fm.remove(); const qi = row.querySelector('.iv-qty'); if(qi) qi.classList.remove('iv-falta'); }
  const totalLabel = row.querySelector('.iv-totalcompra') && row.querySelector('.iv-totalcompra').previousElementSibling;
  if(totalLabel) totalLabel.textContent = 'Total de la compra (' + c.cajas + ' × ' + c.unidadesPorCaja + ' = ' + (c.cajas * c.unidadesPorCaja) + ' unid., con IVA)';

  let verdictEl = row.querySelector('.iv-actual-verdict');
  if(c.utilidadActual == null){
    if(verdictEl) verdictEl.remove();
  } else {
    if(!verdictEl){
      verdictEl = document.createElement('div');
      const marginRow = row.querySelector('.iv-precioactual') && row.querySelector('.iv-precioactual').closest('.iv-grid');
      if(marginRow) marginRow.insertAdjacentElement('afterend', verdictEl);
    }
    if(verdictEl){
      verdictEl.className = 'iv-actual-verdict ' + (c.utilidadActual < 0 ? 'bad' : (c.utilidadActual === 0 ? '' : 'good'));
      verdictEl.textContent = c.utilidadActual < 0
        ? '⚠️ Estás PERDIENDO ' + fmt(Math.abs(c.utilidadActual)) + ' por unidad al precio actual (costo ' + fmt(it.cost) + ' vs. venta ' + fmt(c.precioActual) + ').'
        : c.utilidadActual === 0
          ? '➖ Ni ganas ni pierdes: vendes exactamente al costo (' + fmt(it.cost) + ').'
          : '✅ Estás GANANDO ' + fmt(c.utilidadActual) + ' por unidad al precio actual (' + Math.round(c.margenActual * 100) + '% de margen).';
    }
  }
}
// ⚖️ Cambiar a mano si el peso escrito es del paquete completo (se divide) o de cada unidad.
document.getElementById('invoiceBody').addEventListener('click', e => {
  const b = e.target.closest('.iv-peso-flip'); if(!b || !invoiceDraft) return;
  const row = b.closest('.iv-item'); const it = row && invoiceDraft.items[+row.dataset.i]; if(!it || !it.pesoOpc) return;
  const po = it.pesoOpc, div = it.pesoModo !== 'div';
  it.pesoModo = div ? 'div' : 'tot'; it.contentPerUnit = div ? po.div : po.tot; it.pesoNota = div ? po.nota : '';
  if(po.u === 'g'){ it.weightG = div ? po.r : po.total; } else { it.volumeMl = div ? po.r : po.total; }
  it.presentation = po.upp + ' x ' + (div ? po.div + ' (' + po.tot + ' en total)' : po.tot);
  const pr = row.querySelector('.iv-pres'); if(pr) pr.value = it.presentation;
  const dsg = row.querySelector('.iv-desglose'); if(dsg) dsg.innerHTML = fiDesgloseHtml(it);
});
document.getElementById('invoiceBody').addEventListener('input', e => {
  // Escribir en cualquier campo numérico recalcula todo en vivo, en el
  // momento, sin esperar a que el campo pierda el foco.
  if(e.target.tagName === 'SELECT' || e.target.type === 'checkbox') return;
  const row = e.target.closest('.iv-item'); if(!row || !invoiceDraft) return;
  const it = invoiceReadRow(row);
  invoiceApplyFieldChange(it, e.target.classList, e.target);
  invoiceUpdateRowLive(row, it);
});
document.getElementById('invoiceBody').addEventListener('change', e => {
  // "Coincide con" (select) e "incluir" (checkbox) sí reconstruyen la fila
  // completa: cambian cosas estructurales (nombre emparejado, insignias).
  const row = e.target.closest('.iv-item'); if(!row || !invoiceDraft) return;
  if(e.target.classList.contains('iv-match')){
    const it = invoiceReadRow(row);
    invoiceApplyFieldChange(it, e.target.classList, e.target);
    renderInvoiceReview();
  } else if(e.target.classList.contains('iv-inc')){
    const it = invoiceReadRow(row);
    row.classList.toggle('iv-skip', !it.include);
  }
});
document.getElementById('invoiceBody').addEventListener('click', async e => {
  const b = e.target.closest('.iv-webprice'); if(!b || !invoiceDraft) return;
  const row = b.closest('.iv-item'); if(!row) return;
  const i = +row.dataset.i, it = invoiceDraft.items[i]; if(!it) return;
  const nm = it.name.trim(); if(!nm){ showToast('Escribe el nombre del producto primero.'); return; }
  const lbl = b.textContent, note = row.querySelector('.iv-webprice-note');
  b.disabled = true; b.textContent = '🌐 Buscando…'; if(note) note.textContent = '';
  try{
    const r = await pcWebPrice(nm);
    if(!invoiceDraft || invoiceDraft.items[i] !== it) return;   // se canceló o se cambió la factura mientras buscaba
    it.webPriceNote = (r && Number(r.price) > 0)
      ? '🌐 En el mercado lo tienen alrededor de ' + fmt(Math.round(Number(r.price))) + (r.source ? ' (' + r.source + ')' : '') + '. Es un estimado de internet: verifícalo antes de usarlo.'
      : 'No encontré un precio confiable en internet para comparar.';
  }catch(err){
    if(!invoiceDraft || invoiceDraft.items[i] !== it) return;
    it.webPriceNote = err && err.message === 'NO_API_KEY' ? 'Configura la IA (⚙️ en Productos) para buscar precios en internet.' : '❌ ' + (err && err.message ? err.message : 'No se pudo buscar el precio.');
  }finally{
    b.disabled = false; b.textContent = lbl;
    const freshNote = row.querySelector('.iv-webprice-note'); if(freshNote) freshNote.textContent = it.webPriceNote || '';
  }
});
// Categoría «➕ Nueva…», crear, escanear el código y «Poner a todos la categoría».
document.getElementById('invoiceBody').addEventListener('change', e => {
  const sel = e.target.closest('.iv-cat'); if(!sel || !invoiceDraft) return;
  const row = sel.closest('.iv-item'), it = invoiceDraft.items[+row.dataset.i];
  if(sel.value === '__nueva'){
    sel.value = (it && it.categoryId) || '';
    const box = row.querySelector('.iv-catnew'); box.hidden = false; const inp = box.querySelector('.iv-catnew-in'); inp.value = ''; inp.focus();
  }
});
function fiCatNuevaEnFila(row){
  const it = invoiceDraft && invoiceDraft.items[+row.dataset.i]; if(!it) return;
  const inp = row.querySelector('.iv-catnew-in'), id = fiCrearCategoria(inp.value);
  if(!id){ showToast('Escribe el nombre de la categoría.'); inp.focus(); return; }
  document.querySelectorAll('#invoiceBody .iv-item').forEach(invoiceReadRow);
  it.categoryId = id; it.catTocada = true;
  renderInvoiceReview(); showToast('🏷️ Categoría «' + inp.value.trim() + '» creada.');
}
document.getElementById('invoiceBody').addEventListener('keydown', e => {
  if(e.key === 'Enter' && e.target.classList.contains('iv-catnew-in')){ e.preventDefault(); fiCatNuevaEnFila(e.target.closest('.iv-item')); }
});
document.getElementById('invoiceBody').addEventListener('click', e => {
  if(!invoiceDraft) return;
  const ok = e.target.closest('.iv-catnew-ok'); if(ok){ fiCatNuevaEnFila(ok.closest('.iv-item')); return; }
  const sc = e.target.closest('.iv-code-scan'); if(!sc) return;
  const row = sc.closest('.iv-item'), it = invoiceDraft.items[+row.dataset.i]; if(!it) return;
  openScanOverlay(raw => {
    const v = String(raw || '').trim().slice(0, 40); if(!v) return;
    it.codigo = v; it.codTocado = true;
    const inp = row.querySelector('.iv-code'); if(inp) inp.value = v;
    closeScanOverlay(); showToast('🔢 Código ' + v + ' para ' + (it.name || 'el producto') + '.');
  }, { hint: 'Apunta al código de barras de «' + (it.name || 'el producto') + '».' });
});
document.getElementById('ivCatTodos').addEventListener('change', e => {
  if(e.target.id !== 'ivCatTodosSel') return;
  const nv = document.getElementById('ivCatTodosNueva');
  if(e.target.value === '__nueva'){ e.target.value = ''; nv.hidden = false; const i = document.getElementById('ivCatTodosNuevaIn'); i.value = ''; i.focus(); }
});
function fiCatTodos(id){
  if(!invoiceDraft) return;
  document.querySelectorAll('#invoiceBody .iv-item').forEach(invoiceReadRow);
  invoiceDraft.items.forEach(it => { it.categoryId = id || ''; it.catTocada = true; });
  renderInvoiceReview();
  const c = (data.categories || []).find(k => String(k.id) === String(id));
  showToast('🏷️ ' + (c ? 'Todos quedaron en «' + c.name + '»' : 'Todos quedaron sin categoría') + '. Puedes cambiar la de cada uno.');
}
document.getElementById('ivCatTodos').addEventListener('click', e => {
  if(e.target.id === 'ivCatTodosBtn'){ fiCatTodos(document.getElementById('ivCatTodosSel').value); return; }
  if(e.target.id === 'ivCatTodosNuevaOk'){ const i = document.getElementById('ivCatTodosNuevaIn'), id = fiCrearCategoria(i.value); if(!id){ showToast('Escribe el nombre de la categoría.'); i.focus(); return; } fiCatTodos(id); }
});
document.getElementById('ivCatTodos').addEventListener('keydown', e => { if(e.key === 'Enter' && e.target.id === 'ivCatTodosNuevaIn'){ e.preventDefault(); document.getElementById('ivCatTodosNuevaOk').click(); } });
function invoiceClose(){
  document.getElementById('invoiceOverlay').classList.remove('show'); invoiceDraft = null;
  clearInterval(invoiceProgressTimer); invoiceProgressTimer = null;
  const wrap = document.getElementById('invoiceProgress'); if(wrap) wrap.hidden = true;
  const applyBtn = document.getElementById('invoiceApplyBtn'); if(applyBtn) applyBtn.hidden = false;
}
document.getElementById('invoiceCancelBtn').addEventListener('click', invoiceClose);
document.getElementById('invoiceOverlay').addEventListener('click', e => { if(e.target.id === 'invoiceOverlay') invoiceClose(); });
document.getElementById('invoiceApplyBtn').addEventListener('click', async () => {
  if(!invoiceDraft) return;
  document.querySelectorAll('#invoiceBody .iv-item').forEach(invoiceReadRow);
  const toApply = invoiceDraft.items.filter(it => it.include && it.name && it.qty > 0);
  if(!toApply.length){ showToast('No hay productos marcados para aplicar.'); invoiceClose(); return; }
  // Nada incorrecto se guarda en silencio: si algo no cuadra (totales, cantidad × precio, IVA, precios
  // muy distintos) se muestra la lista y tú decides si corriges o aplicas igual.
  const probs = fiValidar(invoiceDraft).filter(a => ['dup', 'total', 'cant', 'precio', 'iva'].includes(a.tipo));
  if(probs.length && !(await showConfirm({ title: 'ORDEVA encontró ' + probs.length + (probs.length === 1 ? ' cosa por revisar' : ' cosas por revisar'),
    message: probs.slice(0, 6).map(a => '• ' + a.txt).join('\n') + (probs.length > 6 ? '\n• …y ' + (probs.length - 6) + ' más' : '') + '\n\n¿Aplicar de todas formas?', confirmText: 'Sí, aplicar', cancelText: 'Revisar', icon: '🧮' }))) return;
  const draft = invoiceDraft, compraId = Date.now().toString(), fechaFact = (draft.header && draft.header.issueDate) || draft.date || '';
  const archivoId = draft.archivo ? await fiGuardarOriginal(draft.archivo) : null;
  data.inventarioMov = data.inventarioMov || [];
  let updated = 0, created = 0, raised = 0, rectified = 0;
  const purchaseItems = [], raisedDetail = [];
  toApply.forEach(it => {
    let p = it.productId ? data.products.find(x => x.id === it.productId) : null;
    if(!p){
      // Última verificación antes de crear: por si ya existe un producto con
      // ese nombre (evita duplicados aunque no se haya emparejado a mano).
      // solo el MISMO nombre exacto: un parecido nunca se une solo (eso lo decides tú en la revisión)
      p = data.products.find(x => !x.combo && dupKey(x) === dupKey({ name: it.name })) || null;
      if(p) rectified++;
    }
    if(p){
      if(p.cost != null && it.cost > p.cost){
        raised++;
        const pct = p.cost > 0 ? Math.round((it.cost - p.cost) / p.cost * 100) : null;
        raisedDetail.push({ name: p.name, from: p.cost, to: it.cost, pct });
      }
      p.cost = it.cost;
      p.stock = (p.stock || 0) + it.qty;
      if(it.ivaPct > 0 && (p.iva == null || p.iva === '')) p.iva = Math.round(it.ivaPct * 100);
      p.costSinIva = Math.round(it.cost / (1 + (it.ivaPct || 0)) * 100) / 100;
      if(it.newPrice > 0){ p.price = it.newPrice; sincronizarProductoEnMesas(p); }
      // La categoría que elegiste en la revisión (si no la tocaste, solo se pone si el producto no tenía).
      if(it.categoryId !== undefined && (it.catTocada || !p.categoryId)){ const c = fiCatValida(it.categoryId); if(c || it.catTocada) p.categoryId = c; }
      updated++;
    } else {
      p = { id: 'inv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name: it.name, price: it.newPrice || it.cost, categoryId: fiCatValida(it.categoryId),
        size: it.contentPerUnit || '', specifications: '', stock: it.qty, cost: it.cost,
        iva: it.ivaPct > 0 ? Math.round(it.ivaPct * 100) : undefined, costSinIva: Math.round(it.cost / (1 + (it.ivaPct || 0)) * 100) / 100 };
      if(it.presentation || it.unitsPerPackage) p.det = Object.assign({}, p.det, { presentacion: it.presentation || null, unidadesPorPaquete: it.unitsPerPackage || null });
      data.products.push(p);
      created++;
    }
    // Lo que se aprende de esta factura para la próxima: la equivalencia proveedor + descripción
    // → producto, el código del proveedor y el código de barras.
    fiAprender(draft.supplier, it.originalDescription || it.name, p.id);
    if(it.sku){ p.skus = p.skus || []; if(!p.skus.includes(it.sku)) p.skus.push(it.sku); }
    if(it.barcode && it.barcode.length >= 8){ p.barcodes = p.barcodes || []; if(!p.barcodes.includes(it.barcode)) p.barcodes.push(it.barcode); }
    // El código de la revisión queda como código del producto (y se reconoce al escanearlo para vender).
    const cod = String(it.codigo || '').trim();
    if(cod){ p.codigo = cod; p.barcodes = p.barcodes || []; if(!p.barcodes.includes(cod)) p.barcodes.push(cod); }
    if(!p.brand && it.brand) p.brand = it.brand;
    const modificado = it.orig && (it.orig.productId !== it.productId || it.orig.qty !== it.qty || it.orig.cost !== it.cost);
    // Desglose guardado: costo por unidad sin IVA, IVA por unidad, costo con IVA, subtotal, IVA y total.
    const tasa = it.ivaPct || 0, cU = it.cost, sU = cU / (1 + tasa);
    const totL = it.lineTotal != null && Math.abs(it.lineTotal - cU * it.qty) <= Math.max(2, it.lineTotal * 0.01) ? Math.round(it.lineTotal) : Math.round(cU * it.qty);
    const desg = { costoUnitSinIva: Math.round(sU * 100) / 100, ivaUnit: Math.round((cU - sU) * 100) / 100, costoUnitConIva: cU,
      subtotal: Math.round(totL / (1 + tasa)), ivaTotal: Math.round(totL - totL / (1 + tasa)), total: totL, cajas: it.cajas || 1, unidadesPorCaja: it.unidadesPorCaja || it.qty };
    purchaseItems.push({ productId: p.id, name: p.name, qty: it.qty, cost: it.cost, originalDescription: it.originalDescription || '', presentation: it.presentation || '',
      unitsPerPackage: it.unitsPerPackage || null, contentPerUnit: it.contentPerUnit || null, unit: it.unit || null, sku: it.sku || null, barcode: it.barcode || null,
      categoryId: p.categoryId || null, codigo: cod || null,
      taxRate: it.ivaPctLeido != null ? it.ivaPctLeido : Math.round((it.ivaPct || 0) * 100), lineTotal: it.lineTotal != null ? it.lineTotal : totL, matchConfidence: it.match ? it.match.confianza : null, modificado: !!modificado,
      ajustes: it.ajustes || [], ...desg });
    data.inventarioMov.push({ id: compraId + '-' + p.id, tipo: 'entrada', productId: p.id, name: p.name, qty: it.qty, costo: it.cost, unidad: it.unit || 'und', presentacion: it.presentation || '',
      costoSinIva: desg.costoUnitSinIva, ivaUnit: desg.ivaUnit, costoTotal: desg.total, ivaTotal: desg.ivaTotal, proveedor: draft.supplier || '',
      fecha: fechaFact, factura: (draft.header && draft.header.invoiceNumber) || '', compraId, usuario: authUser || '', at: Date.now() });
  });
  if(data.inventarioMov.length > 5000) data.inventarioMov = data.inventarioMov.slice(-4000);
  data.purchases = data.purchases || [];
  data.purchases.unshift({ id: compraId, supplier: draft.supplier || '', date: fechaFact, items: purchaseItems, total: purchaseItems.reduce((a, x) => a + (x.total != null ? x.total : x.qty * x.cost), 0),
    subtotal: purchaseItems.reduce((a, x) => a + (x.subtotal || 0), 0), ivaTotal: purchaseItems.reduce((a, x) => a + (x.ivaTotal || 0), 0),
    header: draft.header || {}, invoiceNumber: (draft.header && draft.header.invoiceNumber) || '', archivoId, fuente: draft.fuente, usuario: authUser || '',
    procesadaEn: new Date().toISOString(), modificaciones: purchaseItems.filter(x => x.modificado).length, avisos: fiValidar(draft).map(a => a.txt), at: new Date().toISOString() });
  if(data.purchases.length > 300) data.purchases = data.purchases.slice(0, 300);
  saveData();
  renderInventario(); renderProductos();
  invoiceClose();
  // Todas las páginas quedan guardadas escaneadas en HD (sin hacer esperar): se descargan en «📚 Facturas anteriores».
  const archivosFact = (draft.archivos && draft.archivos.length) ? draft.archivos : (draft.archivo ? [draft.archivo] : []);
  if(archivosFact.length) fiEscanearCompra(compraId, archivosFact);
  let msg = '✅ ' + updated + ' actualizado' + (updated === 1 ? '' : 's');
  if(created) msg += ', ' + created + ' nuevo' + (created === 1 ? '' : 's');
  if(raised) msg += ', ' + raised + ' con aumento de precio';
  if(rectified) msg += ' (' + rectified + ' unido' + (rectified === 1 ? '' : 's') + ' a un producto que ya existía, sin duplicar)';
  showToast(msg + '.');
  if(raisedDetail.length){
    const lines = raisedDetail.map(r => '• ' + r.name + ': ' + fmt(r.from) + ' → ' + fmt(r.to) + (r.pct != null ? ' (+' + r.pct + '%)' : ''));
    setTimeout(() => {
      alert('📈 El proveedor subió el precio de:\n\n' + lines.join('\n') + '\n\nRevisa si también te toca subir el precio de venta.');
    }, 300);
  }
});
// ---------- Factura CON internet (IA) ----------
// Igual que el modo sin internet: un botón de cámara (una foto directa) y uno
// de galería (elegir una o varias fotos ya guardadas, o un PDF) — antes solo
// se podía tomar una foto nueva con la cámara, no se podía adjuntar nada.
const invoiceCamInput = document.getElementById('invoiceCamInput');
const invoiceGalInput = document.getElementById('invoiceGalInput');
// Mientras la persona toma o elige la foto, se deja listo lo que va a leerla (así la espera después es corta).
function fiPrecalentar(){
  try{ if(window.VitoOfflineOCR && window.VitoOfflineOCR.precalentar) window.VitoOfflineOCR.precalentar(); }catch(e){}   // también con IA: ORDEVA lee en paralelo
}
document.getElementById('invInvoiceCamBtn').addEventListener('click', () => { fiPrecalentar(); invoiceCamInput.click(); });
document.getElementById('invInvoiceGalBtn').addEventListener('click', () => { fiPrecalentar(); invoiceGalInput.click(); });

// Carrera Gemini ⚡ ORDEVA: las dos leen la factura a la vez y se muestra la primera que traiga productos.
// Si gana ORDEVA (lector del celular, sin internet) y Gemini termina después, se ofrece su lectura con un toque.
function fiCarrera(aiProm, files){
  aiProm.catch(() => {});
  const V = window.VitoOfflineOCR;
  if(!V || !V.scanInvoiceFiles || window.__fiSinCarrera) return aiProm;
  const conItems = i => !!(i && i.items && i.items.length);
  const ocrProm = V.scanInvoiceFiles(files).then(i => Object.assign({}, i, { fuente: 'ocr', __laya: true }));
  ocrProm.catch(() => {});
  return new Promise((res, rej) => {
    let listo = false, n = 0, iaInfo = null, iaErr = null, ocrErr = null;
    const cerrar = () => {
      if(listo || ++n < 2) return; listo = true;
      if(iaInfo) return res(iaInfo);                                   // la IA respondió (aunque sin productos)
      if(ocrErr && ocrErr.rawText) return res({ supplier: '', date: '', items: [], rawText: ocrErr.rawText, fuente: 'ocr', __laya: true });
      rej(iaErr || ocrErr || new Error('No se pudo leer la factura.'));
    };
    aiProm.then(i => {
      if(!listo && conItems(i)){ listo = true; window.__fiCarreraGano = 'ia'; return res(i); }
      iaInfo = i; cerrar();
    }, e => { iaErr = e; cerrar(); });
    ocrProm.then(i => {
      if(!listo && conItems(i)){
        listo = true; window.__fiCarreraGano = 'laya'; res(i);
        aiProm.then(ia => { if(conItems(ia)) fiOfrecerLecturaIA(ia); }).catch(() => {});
        return;
      }
      cerrar();
    }, e => { ocrErr = e; cerrar(); });
  });
}
function fiOfrecerLecturaIA(ia){
  const ov = document.getElementById('invoiceOverlay');
  if(!ov || !ov.classList.contains('show') || !invoiceDraft || invoiceDraft.fuente !== 'ocr') return;
  const box = document.getElementById('ivAvisos'); if(!box || document.getElementById('fiUsarIA')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'fiUsarIA'; b.className = 'btn-camera'; b.style.cssText = 'width:100%;margin:6px 0';
  b.textContent = '🤖 La lectura avanzada de ORDEVA ya terminó (' + ia.items.length + ' productos): úsala, suele ser más precisa';
  b.addEventListener('click', () => { invoiceOpen(ia); showToast('🤖 Lectura avanzada de ORDEVA cargada.'); });
  box.prepend(b);
}
async function handleOnlineInvoiceFiles(files, triggerBtn, inputEl){
  if(!files || !files.length) return false;
  const lbl = triggerBtn.innerHTML;
  let ok = true;
  triggerBtn.disabled = true; triggerBtn.textContent = '🧾 Leyendo…';
  document.getElementById('invoiceOverlay').classList.add('show');
  fiEstado('Detectando texto…');
  document.getElementById('invoiceBody').innerHTML = '';
  const hb0 = document.getElementById('ivHeader'); if(hb0) hb0.innerHTML = ''; const av0 = document.getElementById('ivAvisos'); if(av0) av0.innerHTML = '';
  invoiceProgressStart();
  try{
    const isPdfHelper = window.VitoOfflineOCR && window.VitoOfflineOCR.isPdfFile;
    const pdfFiles = isPdfHelper ? files.filter(f => window.VitoOfflineOCR.isPdfFile(f)) : [];
    let info;
    if(pdfFiles.length){
      let text = '';
      try{ text = await window.VitoOfflineOCR.extractEmbeddedPdfText(pdfFiles); }catch(e){ text = ''; }
      if(text && text.trim().length > 40){
        // PDF digital: ya tiene texto, se lo mandamos a la IA como texto — más
        // rápido y confiable que convertirlo a foto.
        document.getElementById('invoiceSub').textContent = 'Leyendo el texto del PDF…';
        info = await recognizeInvoiceWithAIFromText(text);
        info.textoPdf = text;
      } else {
        // PDF escaneado (sin texto embebido): se convierte su primera página a
        // foto y se sigue el mismo camino que una foto normal.
        document.getElementById('invoiceSub').textContent = 'El PDF no trae texto digital, convirtiéndolo a foto…';
        const expanded = await window.VitoOfflineOCR.expandFilesWithPdfPages(pdfFiles);
        const firstImg = expanded && expanded[0];
        if(!firstImg) throw new OpenAIError('bad', 'No pude leer el PDF de la factura.');
        const dataUrl = await scaleInvoicePhotoForAI(firstImg, 1150, 0.68);
        info = await recognizeInvoiceWithAI(dataUrl);
      }
    } else {
      const file = files[0], pre = window.__fiPre; window.__fiPre = null;
      fiEstado('Analizando factura…');
      const aiProm = (pre && pre.file === file) ? pre.prom : scaleInvoicePhotoForAI(file, 1150, 0.68).then(recognizeInvoiceWithAI);   // ya se venía leyendo desde la vista previa
      info = await fiCarrera(aiProm, [file]);
    }
    invoiceOpen(info);
    if(info && info.__laya){
      if(!(info.items || []).length){ const rw = document.getElementById('invoiceRawWrap'); if(rw) rw.open = true; showToast('⚠️ ORDEVA leyó el texto pero no separó productos: corrígelo y toca «Releer texto».', 7000); }
      else showToast('⚡ ORDEVA leyó la factura al instante, sin internet. Revisa los datos.', 5000);
    }
  }catch(err){
    ok = false;
    invoiceClose();
    if(err && err.message === 'NO_API_KEY') showToast('Configura la IA (⚙️ en Productos) para escanear facturas.');
    else showToast('❌ ' + (err && err.message ? err.message : 'No se pudo leer la factura.'));
  }finally{
    triggerBtn.disabled = false; triggerBtn.innerHTML = lbl;
    inputEl.value = '';
  }
  return ok;
}
// Un solo par de botones: con IA si hay internet y está configurada; si no (o si la IA falla), sin internet.
async function leerFactura(files, btn, input){
  files = fiValidarArchivos(files);
  if(!files.length){ input.value = ''; return; }
  const original = files[0], originales = files.slice();   // todas las fotos / el PDF tal como llegaron (para guardarlas escaneadas en HD)
  if(files.length === 1 && !fiEsPdf(files[0])){
    // Una sola foto: se muestra ya arreglada para revisarla antes de leerla.
    const iaYa = hasAIKey() && navigator.onLine !== false;
    let pre = null;
    const r = await fiRevisarFoto(files[0], f => {
      if(iaYa){ const prom = scaleInvoicePhotoForAI(f, 1150, 0.68).then(recognizeInvoiceWithAI); prom.catch(() => {}); pre = { file: f, prom }; }
      else fiPrecalentar();
    });
    input.value = '';
    window.__fiPre = (r && pre && r.usar === pre.file) ? pre : null;
    if(!r) return;
    if(r.otra){ (r.otra === 'cam' ? invoiceCamInput : invoiceGalInput).click(); return; }
    files = [r.usar];
    if(r.original && r.original !== original) originales[0] = r.original;     // girada o con esquinas puestas a mano
    if(r.usar !== original) try{ r.usar.__original = originales[0]; }catch(e){}
  } else {
    // Varias fotos (o un PDF): las fotos se arreglan solas, sin preguntar.
    files = await Promise.all(files.map(async f => { if(fiEsPdf(f)) return f; try{ const m = (await fiMejorarFoto(f)).file; try{ m.__original = f; }catch(e){} return m; }catch(e){ return f; } }));
  }
  window.__fiArchivo = originales[0]; window.__fiArchivos = originales;
  // Sin IA configurada (ni la clave de ORDEVA en el servidor ni una propia): se ofrece configurarla UNA vez (queda
  // en los datos del negocio y llega sola a los demás celulares). Una vez al día como máximo; si no, se lee sin internet.
  if(!hasAIKey() && navigator.onLine !== false && authIsAdmin()){
    let hoy = ''; try{ hoy = new Date().toDateString(); }catch(e){}
    if(lsGet('vento-ia-ofrecida') !== hoy){
      lsSet('vento-ia-ofrecida', hoy);
      const si = await showConfirm({ title: '⚡ Leer facturas con IA', icon: '🧾',
        message: 'Con la IA (Gemini de Google, gratis) la factura se lee en segundos y con los datos completos (productos, cantidades, costos, IVA).\n\nSe configura UNA sola vez: pegas tu clave y queda para todos los celulares del negocio.\n\n¿Configurarla ahora? (Si no, esta factura se lee sin internet, más despacio.)',
        confirmText: 'Configurar IA', cancelText: 'Leer sin IA' });
      if(si){ input.value = ''; try{ openAIConfigDialog(); }catch(e){} return; }
    }
  }
  const conIA = hasAIKey() && navigator.onLine !== false;
  if(conIA && await handleOnlineInvoiceFiles(files, btn, input)) return;
  if(!window.VitoOfflineOCR){ if(!conIA) showToast('Configura la IA (⚙️ en Productos) para leer facturas.'); return; }
  if(conIA) showToast('IA temporalmente no disponible. Se lee sin internet: revise los datos.');
  else if(navigator.onLine === false) showToast('Sin conexión. Se lee la factura sin internet.');
  return handleOfflineInvoiceFiles(files, btn, input);
}
invoiceCamInput.addEventListener('change', e => leerFactura(Array.from(e.target.files || []), document.getElementById('invInvoiceCamBtn'), invoiceCamInput));
invoiceGalInput.addEventListener('change', e => leerFactura(Array.from(e.target.files || []), document.getElementById('invInvoiceGalBtn'), invoiceGalInput));
// ---------- Factura SIN internet (motor offline Precios Vito, ver <script> al final) ----------
// Dos botones, igual que en Precios Vito: cámara (una foto directa) y
// galería (elegir una o varias fotos ya guardadas, o un PDF).
const invoiceOfflineCamInput = document.getElementById('invoiceOfflineCamInput');
const invoiceOfflineGalInput = document.getElementById('invoiceOfflineGalInput');

async function handleOfflineInvoiceFiles(files, triggerBtn, inputEl){
  if(!files || !files.length) return;
  const lbl = triggerBtn.innerHTML;
  if(!window.VitoOfflineOCR){ showToast('El lector sin internet no cargó — vuelve a abrir el archivo completo.'); inputEl.value = ''; return; }
  triggerBtn.disabled = true; triggerBtn.textContent = '📴 Leyendo…';
  document.getElementById('invoiceOverlay').classList.add('show');
  fiEstado('Detectando texto sin internet (puede tardar un poco más que con IA)…');
  document.getElementById('invoiceBody').innerHTML = '';
  const hb1 = document.getElementById('ivHeader'); if(hb1) hb1.innerHTML = ''; const av1 = document.getElementById('ivAvisos'); if(av1) av1.innerHTML = '';
  invoiceProgressStart();
  window.__vitoOcrProgress = p => invoiceProgressSet(p * 100);
  try{
    const info = await window.VitoOfflineOCR.scanInvoiceFiles(files);
    invoiceOpen(info);
  }catch(err){
    if(err && err.rawText){
      // No se separaron productos, pero sí hay texto leído: se muestra igual
      // para que el usuario lo corrija a mano y presione "Releer texto".
      invoiceOpen({ supplier: '', date: '', items: [], rawText: err.rawText });
      const rawWrap = document.getElementById('invoiceRawWrap'); if(rawWrap) rawWrap.open = true;
      showToast('⚠️ ' + (err.message || 'No logré separar productos, pero puedes corregir el texto leído.'));
    } else {
      invoiceClose();
      showToast('❌ No se pudo detectar correctamente el texto. Puede intentar nuevamente o editar manualmente.' + (err && err.message ? ' (' + err.message + ')' : ''));
    }
  }finally{
    triggerBtn.disabled = false; triggerBtn.innerHTML = lbl;
    inputEl.value = '';
    window.__vitoOcrProgress = null;
  }
}

/* ---------- Escaneo de precio y margen ----------
   Foto del producto (o de su etiqueta de precio) -> la IA detecta el producto y lee el precio
   visible -> se compara contra el costo anterior guardado (subió / bajó / igual), se calcula el
   margen que te queda vendiéndolo al precio actual y se sugiere un precio de venta que te
   deje la ganancia que quieres (por defecto, el margen que ya tenías). Si la foto no trae
   precio, se puede buscar el precio actual en la web (estimado: hay que verificarlo). */
const pcColor = pct => pct <= 15 ? '#ff5a5a' : pct < 25 ? '#f5b83d' : '#4cd97b';
const pcMoney = n => (n < 0 ? '−' : '') + fmt(Math.abs(n));
let pcDraft = null;   // { name, size, productId, seen, pack, target, newPrice, note }
let pcToken = 0;

function pcPrompt(){
  return 'Esta es una foto de un producto, de su etiqueta de precio en un estante o vitrina, o de un renglón de factura o lista de precios de un PROVEEDOR o tienda (lo que el negocio paga al comprar). ' +
    'Identifica el producto y lee el precio visible. Devuelve SOLO JSON válido (sin texto extra, sin ```), con esta forma exacta: ' +
    '{"name":"","brand":"","size":"","price":0,"price_for":"unit","pack_qty":1,"confidence":0}. ' +
    'name = nombre comercial corto. size = presentación (ej. "330 ml", "500 g"). ' +
    'price = precio visible en pesos colombianos como NÚMERO ENTERO, sin símbolo ni separadores (los puntos de "3.500" son miles: 3500); si no hay ningún precio visible pon 0. ' +
    'price_for = "unit" si ese precio es de UNA unidad, "pack" si es de un paquete, caja, six-pack o canasta. pack_qty = cuántas unidades trae ese paquete (1 si es una unidad o no se ve). confidence = 0 a 1. ' +
    'No inventes ni adivines cifras que no veas. ' + invCatalogHint();
}
async function recognizePriceWithAI(dataUrl){
  const prompt = pcPrompt();
  const ok = i => !!(i && (i.name || i.brand));
  let info = null;
  try{
    info = cleanAiJsonText(await aiText({ prompt, imageDataUrl: dataUrl, json: true, timeoutMs: 7000, retries: 0, oneModel: true, fast: true, maxOutputTokens: 600 }));
  }catch(err){
    if(!(err && AI_LADDER_KINDS.includes(err.kind))) throw err;
  }
  if(!ok(info)) info = cleanAiJsonText(await aiText({ prompt, imageDataUrl: dataUrl, json: true, timeoutMs: 10000, retries: 0, fast: true, maxOutputTokens: 600 }));
  if(!ok(info)) throw new OpenAIError('bad', 'La IA respondió pero no pude identificar el producto. Prueba con una foto más cerca de la etiqueta y con buena luz.');
  return info;
}
async function pcWebPrice(name){
  const q = 'Busca en la web el precio actual en Colombia (pesos COP) de "' + name + '". Devuelve SOLO JSON válido (sin texto extra, sin ```): {"price":0,"source":""}. ' +
    'price = precio típico de UNA unidad como número entero sin separadores (si solo hay precios de paquete, divide entre las unidades). source = tienda o sitio de donde salió. ' +
    'Si no encuentras un precio confiable pon price 0. No inventes cifras.';
  return cleanAiJsonText(await aiText({ prompt: q, json: true, web: true, strictWeb: true, timeoutMs: 45000, retries: 1 }));
}

const pcProduct = () => (pcDraft && pcDraft.productId) ? (data.products.find(p => p.id === pcDraft.productId) || null) : null;
const pcUnitCost = () => pcDraft.seen > 0 ? Math.round(pcDraft.seen / Math.max(1, pcDraft.pack || 1)) : 0;
function pcAutoTarget(p){                      // por defecto: el margen que ya tenías (si era razonable) o el margen sano de la app
  if(p && p.cost > 0 && p.price > 0){ const m = (p.price - p.cost) / p.price; if(m >= 0.05) return Math.round(m * 100); }
  return Math.round(INVOICE_TARGET_MARGIN * 100);
}
function pcSuggest(cost, targetPct){           // precio = costo / (1 - margen), redondeado hacia arriba a $100 para no quedarte corto
  const m = Math.min(0.9, Math.max(0, (targetPct || 0) / 100));
  return cost > 0 ? Math.ceil(cost / (1 - m) / 100) * 100 : 0;
}
function pcResultHtml(){
  const d = pcDraft, p = pcProduct(), cost = pcUnitCost();
  if(!(cost > 0)) return '<div class="iv-note">Escribe el precio que ves en la foto (o búscalo en la web) para calcular el margen.</div>';
  const old = p && p.cost > 0 ? p.cost : null;
  const sale = p && p.price > 0 ? p.price : 0;
  const rows = [];
  let flag;
  if(old != null){
    const diff = cost - old, pct = Math.round(Math.abs(diff) / old * 1000) / 10;
    flag = diff > 0 ? '<span class="iv-flag up">⬆ Subió ' + pct + '%</span>' : diff < 0 ? '<span class="iv-flag dn">⬇ Bajó ' + pct + '%</span>' : '<span class="iv-flag eq">➡ Sigue igual</span>';
    rows.push(['Costo anterior', fmt(old)]);
    rows.push(['Costo actual (por unidad)', fmt(cost) + (diff ? ' <small>(' + (diff > 0 ? '+' : '−') + fmt(Math.abs(diff)) + ')</small>' : '')]);
  } else {
    flag = '<span class="iv-flag new">sin costo anterior</span>';
    rows.push(['Costo actual (por unidad)', fmt(cost)]);
  }
  let warn = '';
  if(sale){
    rows.push(['Precio de venta actual', fmt(sale)]);
    if(old != null){ const m0 = Math.round((sale - old) / sale * 100); rows.push(['Margen antes', '<span style="color:' + pcColor(m0) + '">' + m0 + '%</span>']); }
    const m1 = Math.round((sale - cost) / sale * 100);
    rows.push(['Margen ahora, al mismo precio', '<span style="color:' + pcColor(m1) + '">' + m1 + '%</span> · ' + pcMoney(sale - cost) + '/u']);
    if(sale <= cost) warn = '⚠️ Al precio actual vendes por debajo del costo: pierdes ' + fmt(cost - sale) + ' por unidad.';
    else if(m1 <= 15) warn = '⚠️ Con el costo nuevo te queda un margen muy bajo (' + m1 + '%). Conviene subir el precio.';
  }
  let sug = '';
  if(d.newPrice > 0){
    const m2 = Math.round((d.newPrice - cost) / d.newPrice * 100);
    const delta = sale ? d.newPrice - sale : 0;
    sug = '<div class="pc-sug"><small>Precio sugerido para ganar ' + d.target + '%</small><br><b>' + fmt(d.newPrice) + '</b> ' +
      (sale ? (delta > 0 ? '<span class="iv-flag up">sube ' + fmt(delta) + '</span>' : delta < 0 ? '<span class="iv-flag dn">baja ' + fmt(-delta) + '</span>' : '<span class="iv-flag eq">igual que hoy</span>') : '') +
      '<br><small>Margen <span style="color:' + pcColor(m2) + ';font-weight:700">' + m2 + '%</span> · ganas ' + pcMoney(d.newPrice - cost) + ' por unidad</small></div>';
  }
  return '<div style="margin-top:10px">' + flag + '</div><table class="pc-table">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>' +
    (warn ? '<div class="pc-warn">' + warn + '</div>' : '') + sug;
}
function pcFormHtml(){
  const d = pcDraft, p = pcProduct();
  const real = data.products.filter(x => !x.combo).slice().sort((a, b) => a.name.localeCompare(b.name));
  const opts = '<option value="">➕ Crear producto nuevo</option>' + real.map(x => '<option value="' + x.id + '"' + (x.id === d.productId ? ' selected' : '') + '>' + invEsc(x.name + (x.size ? ' · ' + x.size : '')) + '</option>').join('');
  return '<div class="iv-item"><div class="iv-grid">' +
    '<div class="iv-full"><label>Producto detectado' + (p ? '' : ' (nuevo en tu lista)') + '</label><input type="text" id="pcName" value="' + invEsc(d.name) + '"></div>' +
    '<div class="iv-full"><label>Coincide con</label><select id="pcMatch">' + opts + '</select></div>' +
    '<div><label>Precio que ves en la foto</label><input type="number" id="pcSeen" inputmode="numeric" min="0" step="50" value="' + (d.seen || '') + '"></div>' +
    '<div><label>Unidades del paquete (1 = unidad)</label><input type="number" id="pcPack" inputmode="numeric" min="1" step="1" value="' + d.pack + '"></div>' +
    '<div class="iv-full"><button type="button" class="btn-ghost" id="pcWebBtn">🌐 Buscar precio actual en la web</button><div class="iv-note" id="pcNote">' + invEsc(d.note || '') + '</div></div>' +
    '<div><label>Margen que quieres ganar (%)</label><input type="number" id="pcTarget" inputmode="numeric" min="0" max="90" step="1" value="' + d.target + '"></div>' +
    '<div><label>Precio de venta (editable)</label><input type="number" id="pcPrice" inputmode="numeric" min="0" step="100" value="' + (d.newPrice || '') + '"></div>' +
  '</div></div><div id="pcResult"></div>';
}
function pcRenderForm(){
  document.getElementById('priceBody').innerHTML = pcFormHtml();
  document.getElementById('pcResult').innerHTML = pcResultHtml();
}
function pcOpen(info){
  const full = [info.brand, info.name].filter(Boolean).join(' ').trim() || String(info.name || '');
  const m = invMatch(full) || invMatch(info.name);
  const seen = Math.max(0, Math.round(Number(info.price) || 0));
  const pack = info.price_for === 'pack' ? Math.max(1, Math.round(Number(info.pack_qty) || 1)) : 1;
  const target = pcAutoTarget(m);
  pcDraft = { name: m ? m.name : full.slice(0, 60), size: m ? (m.size || '') : String(info.size || ''), productId: m ? m.id : '', seen, pack, target, newPrice: 0,
    note: seen > 0 ? 'Precio leído de la foto' + (pack > 1 ? ' (paquete de ' + pack + ')' : '') + '. Corrígelo si no coincide.' : 'No vi un precio en la foto. Escríbelo o búscalo en la web.' };
  pcDraft.newPrice = pcSuggest(pcUnitCost(), target);
  document.getElementById('priceSub').textContent = 'Detecté: ' + pcDraft.name + (pcDraft.size ? ' ' + pcDraft.size : '') + (m ? ' (ya está en tu lista).' : '.') + ' Revisa los datos.';
  pcRenderForm();
  document.getElementById('priceOverlay').classList.add('show');
}
function pcClose(){ pcToken++; document.getElementById('priceOverlay').classList.remove('show'); pcDraft = null; }

document.getElementById('priceBody').addEventListener('input', e => {
  if(!pcDraft) return;
  const id = e.target.id;
  if(id === 'pcName'){ pcDraft.name = e.target.value; return; }
  if(id === 'pcPrice'){ pcDraft.newPrice = Math.max(0, Math.round(+e.target.value || 0)); }
  else if(id === 'pcSeen' || id === 'pcPack' || id === 'pcTarget'){
    pcDraft.seen = Math.max(0, +document.getElementById('pcSeen').value || 0);
    pcDraft.pack = Math.max(1, Math.floor(+document.getElementById('pcPack').value || 1));
    pcDraft.target = Math.min(90, Math.max(0, +document.getElementById('pcTarget').value || 0));
    pcDraft.newPrice = pcSuggest(pcUnitCost(), pcDraft.target);
    document.getElementById('pcPrice').value = pcDraft.newPrice || '';
  } else return;
  document.getElementById('pcResult').innerHTML = pcResultHtml();
});
document.getElementById('priceBody').addEventListener('change', e => {
  if(!pcDraft || e.target.id !== 'pcMatch') return;
  pcDraft.productId = e.target.value;
  const p = pcProduct();
  if(p){ pcDraft.name = p.name; pcDraft.size = p.size || ''; }
  pcDraft.target = pcAutoTarget(p);
  pcDraft.newPrice = pcSuggest(pcUnitCost(), pcDraft.target);
  pcRenderForm();
});
document.getElementById('priceBody').addEventListener('click', async e => {
  const b = e.target.closest('#pcWebBtn'); if(!b || !pcDraft) return;
  const nm = [pcDraft.name, pcDraft.size].filter(Boolean).join(' ').trim();
  if(!nm){ showToast('Escribe el nombre del producto primero.'); return; }
  const my = pcToken, lbl = b.textContent;
  b.disabled = true; b.textContent = '🌐 Buscando…';
  try{
    const r = await pcWebPrice(nm);
    if(my !== pcToken || !pcDraft) return;
    if(r && Number(r.price) > 0){
      pcDraft.seen = Math.round(Number(r.price)); pcDraft.pack = 1;
      pcDraft.newPrice = pcSuggest(pcUnitCost(), pcDraft.target);
      pcDraft.note = '🌐 Precio estimado en la web' + (r.source ? ' (' + r.source + ')' : '') + '. Verifícalo antes de guardar.';
    } else pcDraft.note = 'No encontré un precio confiable en la web. Escríbelo tú.';
    pcRenderForm();
  }catch(err){
    if(my !== pcToken || !pcDraft) return;
    b.disabled = false; b.textContent = lbl;
    if(err && err.message === 'NO_API_KEY') showToast('Configura la IA (⚙️ en Productos) para buscar en la web.');
    else showToast('❌ ' + (err && err.message ? err.message : 'No se pudo buscar el precio.'));
  }
});
document.getElementById('priceCancelBtn').addEventListener('click', pcClose);
document.getElementById('priceOverlay').addEventListener('click', e => { if(e.target.id === 'priceOverlay') pcClose(); });
document.getElementById('priceApplyBtn').addEventListener('click', () => {
  if(!pcDraft) return;
  const cost = pcUnitCost();
  if(!(cost > 0)){ showToast('Escribe el precio que ves para poder guardar.'); return; }
  let p = pcProduct();
  let msgName;
  if(p){
    p.cost = cost;
    if(pcDraft.newPrice > 0){ p.price = pcDraft.newPrice; sincronizarProductoEnMesas(p); }
    msgName = p.name;
  } else {
    const name = (pcDraft.name || '').trim();
    if(!name){ showToast('Ponle un nombre al producto.'); return; }
    const other = data.products.find(x => dupKey(x) === dupKey({ name, size: pcDraft.size }));
    if(other){ showToast('Ya existe "' + other.name + '". Elígelo en "Coincide con".'); return; }
    p = { id: 'inv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name, price: pcDraft.newPrice > 0 ? pcDraft.newPrice : cost, categoryId: null, size: pcDraft.size || '', specifications: '', stock: null, cost };
    data.products.push(p);
    msgName = name;
  }
  p.costAt = new Date().toISOString();
  p.costLog = (p.costLog || []).concat({ c: cost, at: p.costAt }).slice(-12);
  saveData();
  renderInventario(); renderProductos();
  pcClose();
  showToast('✅ ' + msgName + ': costo ' + fmt(cost) + ', precio ' + fmt(p.price) + '.');
});
const pricePhotoInput = document.getElementById('pricePhotoInput');
document.getElementById('invPriceBtn').addEventListener('click', () => pricePhotoInput.click());
pricePhotoInput.addEventListener('change', async e => {
  const file = e.target.files[0]; if(!file) return;
  const btn = document.getElementById('invPriceBtn'), lbl = btn.innerHTML;
  const my = ++pcToken;
  pcDraft = null;
  btn.disabled = true; btn.textContent = '🏷️ Leyendo foto…';
  document.getElementById('priceOverlay').classList.add('show');
  document.getElementById('priceSub').textContent = 'Detectando el producto y el precio…';
  document.getElementById('priceBody').innerHTML = '';
  try{
    const dataUrl = await scalePhotoForAI(file, 800, 0.7);   // más liviana = respuesta más rápida (la etiqueta se sigue leyendo bien)
    const info = await recognizePriceWithAI(dataUrl);
    if(my !== pcToken) return;   // canceló mientras la IA respondía
    pcOpen(info);
  }catch(err){
    if(my === pcToken) pcClose();
    if(err && err.message === 'NO_API_KEY') showToast('Configura la IA (⚙️ en Productos) para escanear precios.');
    else showToast('❌ ' + (err && err.message ? err.message : 'No se pudo leer la foto.'));
  }finally{
    btn.disabled = false; btn.innerHTML = lbl;
    pricePhotoInput.value = '';
  }
});

/* ---------- Venta rápida de mostrador / Domicilio ----------
   Para vender sin abrir una mesa: no toca data.tables en ningún momento,
   arma un carrito propio y al cobrar escribe directo en data.history
   (con table:null, tableName:'Mostrador' o '🛵 Domicilio: <cliente>') igual
   que al cerrar una mesa. El mismo modal sirve para las dos cosas — solo
   cambia qsMode ('mostrador' o 'domicilio'), que muestra/oculta los campos
   de cliente/dirección/envío y suma el valor del domicilio al total. */
let quickSaleCart = []; // [{productId, name, price, size, qty}]
let qsMode = 'mostrador';

function qsHideSuggestions(){
  const box = document.getElementById('qsSuggestions');
  box.classList.remove('show');
  box.innerHTML = '';
}
function qsRenderSuggestions(query){
  const box = document.getElementById('qsSuggestions');
  const q = (query || '').trim().toLowerCase();
  const inCart = new Set(quickSaleCart.map(it => it.productId));
  const matches = data.products.filter(p => !q || p.name.toLowerCase().includes(q));
  if(!matches.length){
    box.innerHTML = '<div class="product-suggestion-empty">Sin productos que coincidan</div>';
    box.classList.add('show');
    return;
  }
  const cartMatches = matches.filter(p => inCart.has(p.id));
  const restMatches = matches.filter(p => !inCart.has(p.id));
  let html = '';
  if(cartMatches.length){
    html += '<div class="product-suggestion-header">Ya en el carrito</div>';
    html += cartMatches.slice(0, 15).map(productSuggestionItemHtml).join('');
  }
  if(restMatches.length){
    if(cartMatches.length) html += '<div class="product-suggestion-header">Otros productos</div>';
    html += restMatches.slice(0, 30).map(productSuggestionItemHtml).join('');
  }
  box.innerHTML = html;
  box.classList.add('show');
  box.querySelectorAll('.product-suggestion-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const product = data.products.find(p=>p.id === el.dataset.id);
      if(!product) return;
      document.getElementById('qsSearch').value = product.name;
      document.getElementById('qsProductId').value = product.id;
      qsHideSuggestions();
    });
  });
}
document.getElementById('qsSearch').addEventListener('input', (e)=>{
  document.getElementById('qsProductId').value = '';
  qsRenderSuggestions(e.target.value);
});
document.getElementById('qsSearch').addEventListener('focus', (e)=>{
  document.getElementById('qsProductId').value = '';
  qsRenderSuggestions(e.target.value);
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#quickSaleOverlay .product-search-wrap')) qsHideSuggestions();
});
document.getElementById('qsQtyMinus').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('qsQty');
  const antes = parseInt(qtyInput.value,10) || 0, val = Math.max(0, antes - 1);
  qtyInput.value = val;
  if(val < antes) sonidoPos('remove');
});
document.getElementById('qsQtyPlus').addEventListener('click', ()=>{
  const qtyInput = document.getElementById('qsQty');
  qtyInput.value = Math.max(0, (parseInt(qtyInput.value,10) || 0) + 1);
  sonidoPos('add');
});

function qsEnvioValor(){
  if(qsMode !== 'domicilio') return 0;
  const v = parseFloat(document.getElementById('qsEnvio').value);
  return isFinite(v) && v > 0 ? v : 0;
}
function qsTotal(){ return quickSaleCart.reduce((s,it)=>s+it.price*it.qty,0) + qsEnvioValor(); }

function qsRenderCart(){
  const container = document.getElementById('qsItemsContainer');
  container.innerHTML = '';
  if(!quickSaleCart.length){
    container.innerHTML = '<div class="empty-note">Todavía no has agregado productos.</div>';
  } else {
    quickSaleCart.forEach((it, idx)=>{
      const row = document.createElement('div');
      row.className = 'line-item';
      row.innerHTML = `
        <div><span class="li-name">${invEsc(it.name)}</span>${it.size ? '<span class="li-size">📦 ' + invEsc(it.size) + '</span>' : ''}${qtyStepperHtml(idx, it.qty)}</div>
        <div class="li-right">
          <span class="li-price">${fmt(it.price*it.qty)}</span>
          <button class="li-remove" data-idx="${idx}" type="button">✕</button>
        </div>
      `;
      container.appendChild(row);
    });
    container.querySelectorAll('.li-qty-minus').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        const it = quickSaleCart[idx]; if(!it) return;
        it.qty -= 1;
        if(it.qty <= 0) quickSaleCart.splice(idx,1);
        sonidoPos('remove');
        qsRenderCart();
      });
    });
    container.querySelectorAll('.li-qty-plus').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        const it = quickSaleCart[idx]; if(!it) return;
        it.qty += 1;
        sonidoPos('add');
        qsRenderCart();
      });
    });
    container.querySelectorAll('.li-remove').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.idx,10);
        if(quickSaleCart.splice(idx,1).length) sonidoPos('remove');
        qsRenderCart();
      });
    });
  }
  document.getElementById('qsTotal').textContent = fmt(qsTotal());
  document.getElementById('qsChargeBtn').disabled = !quickSaleCart.length;
}

function qsAddToCart(product, qty, noRender){
  const existing = quickSaleCart.find(it => it.productId === product.id);
  if(existing) existing.qty += qty;
  else quickSaleCart.push({ productId: product.id, name: product.name, price: product.price, size: product.size || '', qty });
  if(qty > 0) sonidoPos('add');
  if(!noRender) qsRenderCart();
}
document.getElementById('qsAddBtn').addEventListener('click', ()=>{
  if(data.products.length === 0){ showToast('Primero agrega productos en la pestaña Productos.'); return; }
  const searchInput = document.getElementById('qsSearch');
  const idInput = document.getElementById('qsProductId');
  const qtyInput = document.getElementById('qsQty');
  let product = data.products.find(p=>p.id === idInput.value);
  if(!product){
    const typed = searchInput.value.trim().toLowerCase();
    product = data.products.find(p=>p.name.toLowerCase() === typed);
  }
  if(!product){ showToast('Selecciona un producto de la lista de sugerencias.'); return; }
  const qty = Math.max(0, parseInt(qtyInput.value,10) || 0);
  if(qty <= 0){ showToast('Indica una cantidad mayor que 0.'); return; }
  qsAddToCart(product, qty, true);
  searchInput.value = '';
  idInput.value = '';
  qtyInput.value = 1;
  qsHideSuggestions();
  qsRenderCart();
});

function qsOpen(mode){
  qsMode = mode === 'domicilio' ? 'domicilio' : 'mostrador';
  quickSaleCart = [];
  document.getElementById('qsSearch').value = '';
  document.getElementById('qsProductId').value = '';
  document.getElementById('qsQty').value = 1;
  document.getElementById('qsMethod').value = 'efectivo';
  { const dn = document.getElementById('qsDebeName'); dn.value = ''; dn.hidden = true; }
  document.getElementById('qsCliente').value = '';
  document.getElementById('qsTelefono').value = '';
  document.getElementById('qsDireccion').value = '';
  document.getElementById('qsEnvio').value = '0';
  document.getElementById('qsDomicilioFields').hidden = qsMode !== 'domicilio';
  document.getElementById('qsTitle').textContent = qsMode === 'domicilio' ? '🛵 Domicilio' : '⚡ Venta rápida';
  document.getElementById('qsSub').textContent = qsMode === 'domicilio'
    ? 'Factura un pedido a domicilio: agrega los productos y, si quieres, los datos del cliente y el valor del envío.'
    : 'Para vender de una vez en mostrador, sin abrir ni asignar una mesa.';
  document.getElementById('qsChargeBtn').textContent = qsMode === 'domicilio' ? '✅ Facturar domicilio' : '✅ Cobrar';
  qsHideSuggestions();
  qsRenderCart();
  document.getElementById('quickSaleOverlay').classList.add('show');
}
async function qsClose(){
  if(quickSaleCart.length){
    const ok = await showConfirm({
      title: '¿Cancelar esta venta?',
      message: 'Vas a perder los productos que ya agregaste al carrito.',
      confirmText: 'Sí, cancelar',
      cancelText: 'Seguir vendiendo',
      icon: '⚡'
    });
    if(!ok) return;
  }
  quickSaleCart = [];
  document.getElementById('quickSaleOverlay').classList.remove('show');
}
document.getElementById('quickSaleBtn').addEventListener('click', () => qsOpen('mostrador'));
document.getElementById('fiadosBtn').addEventListener('click', () => { if(window.libretaAbrir) window.libretaAbrir(); });
document.getElementById('domicilioBtn').addEventListener('click', () => { domActual = null; if(domisPend().length) domAbrir(null); else qsOpen('domicilio'); });
document.getElementById('qsCancelBtn').addEventListener('click', qsClose);
document.getElementById('quickSaleOverlay').addEventListener('click', e => { if(e.target.id === 'quickSaleOverlay') qsClose(); });
document.getElementById('qsEnvio').addEventListener('input', qsRenderCart);

/* ---------- Domicilios que entran solos (página web, Instagram o WhatsApp) ----------
   Es el mismo link de pedidos de las mesas pero con dom=1 y sin mesa: el negocio lo pone
   en su página web, en su Instagram o lo manda por WhatsApp. El cliente pide ahí y el
   pedido llega por el mismo canal de ORDEVA que las mesas, con esta forma:
       DOMICILIO: nombre | teléfono | dirección | productos
   Queda guardado como pendiente (no se pierde aunque se cierre la app) y abre la
   factura de domicilio ya llena, con los productos emparejados con el inventario. */
const DOM_KEY = 'vito_domis';
const domisPend = () => LS(DOM_KEY, []);
let domActual = null;
function domisGuardar(l){ SS(DOM_KEY, l); domisBadge(); }
function domisBadge(){
  const b = document.getElementById('domicilioBtn'); if(!b) return;
  const n = domisPend().length;
  b.textContent = n ? '🛵 Domicilio (' + n + ')' : '🛵 Domicilio';
  b.classList.toggle('btn-warn', n > 0);
}
/* Aviso del celular (app de Android): suena y se ve aunque ORDEVA esté cerrada o la pantalla apagada.
   Si ORDEVA se está viendo no hace falta (ya sale en pantalla). En el navegador no hace nada. */
function ventoAvisoCel(titulo, texto, canal){
  try{ window.ventoParlanteAviso && window.ventoParlanteAviso(titulo, texto); }catch(e){}
  // Los pagos salen SIEMPRE (también con ORDEVA abierta), en su canal: se ven con el celular bloqueado.
  try{ if(window.VentoAndroid && typeof window.VentoAndroid.notificar === 'function') return window.VentoAndroid.notificar(String(titulo || 'ORDEVA').slice(0, 80), String(texto || '').slice(0, 400), canal || 'pedidos', canal === 'pagos'); }catch(e){}
  return false;
}
window.ventoAvisoCel = ventoAvisoCel;
function domRecibir(cuerpo){
  const p = String(cuerpo).split('|').map(x => x.trim());
  const d = { id: Date.now() + '' + Math.random().toString(36).slice(2, 5), ts: Date.now(),
              nombre: p[0] || '', tel: p[1] || '', dir: p[2] || '', texto: p.slice(3).join(', ').trim() };
  const l = domisPend(); l.push(d); domisGuardar(l);
  if(!window.ventoAvisoOn || window.ventoAvisoOn('domicilios')){
    showToast('🛵 Domicilio nuevo' + (d.nombre ? ' de ' + d.nombre : '') + (d.texto ? ': ' + d.texto : '') + (d.dir ? ' · ' + d.dir : ''), 10000);
    ventoAvisoCel('🛵 Domicilio nuevo' + (d.nombre ? ' de ' + d.nombre : ''), (d.texto || '') + (d.dir ? ' · ' + d.dir : ''), 'pedidos');
    try{ if(window.vitoDecir) window.vitoDecir('Nuevo domicilio' + (d.nombre ? ' de ' + d.nombre : '')); }catch(e){}
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
  // Solo se abre solo si no hay otra cosa abierta, para no interrumpir lo que esté haciendo.
  if(!document.querySelector('.overlay.show')) domAbrir(d.id);
}
function domAbrir(id){
  const l = domisPend(), d = l.find(x => x.id === id) || l[0];
  qsOpen('domicilio');
  if(!d){ domActual = null; return; }
  domActual = d.id;
  document.getElementById('qsCliente').value = d.nombre || '';
  document.getElementById('qsTelefono').value = d.tel || '';
  document.getElementById('qsDireccion').value = d.dir || '';
  const noReconocidos = [];
  if(d.texto){
    let items = [];
    try{ items = (parseVoiceCommand('mesa 1, ' + d.texto).items) || []; }catch(e){}
    sinSonidoPos(() => items.forEach(it => {        // pedido que llegó por el link de domicilios: no suena
      const prod = matchProductVoice(it.productText);
      if(prod) qsAddToCart(prod, Math.max(1, it.qty || 1), true);
      else noReconocidos.push(it.productText);
    }));
  }
  qsRenderCart();
  document.getElementById('qsSub').textContent = '🛵 Pedido que entró por tu link de domicilios' +
    (d.nombre ? ' (' + d.nombre + ')' : '') + '. Revisa los productos, ponle el valor del envío y factúralo.';
  if(noReconocidos.length) showToast('⚠️ Esto no lo reconocí, agrégalo a mano: ' + noReconocidos.join(', '), 9000);
}
function domQuitar(id){ domisGuardar(domisPend().filter(x => x.id !== id)); }
// La sección de domicilios por web/WhatsApp solo tiene sentido si el negocio hace domicilios.
function aplicarDomicilios(){
  const g = document.getElementById('domGrupoWeb');
  if(g) g.dataset.off = data.domiciliosOn ? '' : '1';
  const b = document.getElementById('domicilioBtn');
  if(b) b.hidden = !data.domiciliosOn;
}

/* El link de domicilios es el mismo pedido.html de las mesas, con dom=1 y sin mesa. */
function domLinkUrl(){
  const c = window.vitoQCfg ? window.vitoQCfg() : {};
  if(!c.url) return '';
  // Se manda también el WhatsApp: si el canal de ORDEVA llegara a fallar, el cliente puede enviarte el
  // pedido por WhatsApp con un toque en vez de perderse.
  return c.url.split('?')[0].trim() + '?dom=1&c=' + c.topic + (c.wa ? '&w=' + c.wa : '');
}
function domWaUrl(){
  const c = window.vitoQCfg ? window.vitoQCfg() : {}, l = domLinkUrl();
  if(!c.wa) return '';
  const msg = 'Hola! Quiero pedir a domicilio de ' + (data.businessName || 'tu negocio') + (l ? '. Aquí está la carta: ' + l : '');
  return 'https://wa.me/' + c.wa + '?text=' + encodeURIComponent(msg);
}
function domQrPintar(boxId, texto){
  const box = document.getElementById(boxId); if(!box) return;
  if(!box.hidden){ box.hidden = true; return; }
  box.textContent = '';
  if(!texto){ box.hidden = false; box.textContent = 'Primero completa el link arriba (Ajustes → QR de las mesas).'; return; }
  const d = document.createElement('div');
  box.appendChild(d); box.hidden = false;
  try{ new QRCode(d, { text: texto, width: 170, height: 170 }); }
  catch(e){ box.textContent = 'No se pudo dibujar el QR.'; }
}
async function domCopiar(txt, okMsg){
  if(!txt) return showToast('⚠️ Primero pon la dirección de tu página de pedidos en Ajustes → QR de las mesas.');
  try{ await navigator.clipboard.writeText(txt); showToast(okMsg); }
  catch(e){ showToast('⚠️ No se pudo copiar. Tócalo y cópialo a mano.'); }
}
function iniDomicilios(){
  const link = document.getElementById('domLink'); if(!link) return;
  const emb = document.getElementById('domEmbed'), wl = document.getElementById('domWaLink');
  const pintar = () => {
    const l = domLinkUrl(), w = domWaUrl();
    link.value = l || '(falta la dirección de tu página de pedidos: Ajustes → QR de las mesas)';
    wl.value = w || '(falta tu número de WhatsApp: Ajustes → QR de las mesas)';
    emb.value = l ? '<a href="' + l + '" target="_blank" rel="noopener" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#c8a24a;color:#1a1410;font:700 16px system-ui;text-decoration:none">🛵 Pedir a domicilio</a>' : '';
  };
  pintar();
  document.getElementById('domLinkCopy').onclick = () => domCopiar(domLinkUrl(), '📋 Link copiado. Pégalo en tu página web, tu Instagram o mándalo por WhatsApp.');
  document.getElementById('domLinkOpen').onclick = () => { const l = domLinkUrl(); if(l) window.open(l, '_blank'); else showToast('⚠️ Primero pon la dirección de tu página de pedidos en Ajustes → QR de las mesas.'); };
  document.getElementById('domLinkQr').onclick = () => domQrPintar('domQrBox', domLinkUrl());
  document.getElementById('domEmbedCopy').onclick = () => domCopiar(emb.value, '📋 Código copiado. Pégalo en tu página web donde quieras el botón.');
  document.getElementById('domWaCopy').onclick = () => domCopiar(domWaUrl(), '📋 Link de WhatsApp copiado.');
  document.getElementById('domWaQr').onclick = () => domQrPintar('domWaQrBox', domWaUrl());
  document.getElementById('domIaBtn').onclick = () => { pintar(); domIaAbrir(); };
  const nav = document.querySelector('nav button[data-view="ajustes"]');
  if(nav) nav.addEventListener('click', pintar);
}

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
  }, it.unidad ? { unidad: it.unidad } : {}));      // ⚖️ vendido por kilo o por libra
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
  return { pct: Math.round((pr - c) / pr * 100), gan: pr - c };
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

/* ---------- Productos ---------- */
document.getElementById('prodAddBtn').addEventListener('click', async ()=>{  const nameInput = document.getElementById('prodName');
  const priceInput = document.getElementById('prodPrice');
  const categorySelect = document.getElementById('prodCategory');
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  if(!name || isNaN(price) || price < 0){
    showToast('Escribe un nombre y un precio válido.');
    return;
  }
  const sizeInput = document.getElementById('prodSize');
  const specsInput = document.getElementById('prodSpecs');
  const ex = data.products.find(p => dupKey(p) === dupKey({ name, size: sizeInput ? sizeInput.value.trim() : '' }));
  if(ex){                                       // ya existe: no se crea otro
    const st = invNum(document.getElementById('prodStock').value);
    if(st != null && await showConfirm({ title: 'Producto repetido', message: '"' + ex.name + '" ya existe. ¿Sumarle ' + st + ' unidades al stock en vez de crear otro?', confirmText: 'Sí, sumar', icon: '📦' })){
      ex.stock = (ex.stock || 0) + st; nameInput.value = priceInput.value = document.getElementById('prodStock').value = document.getElementById('prodCost').value = '';
      saveData(); renderProductos(); renderInventario(); showToast('✅ ' + ex.name + ': ahora hay ' + ex.stock);
    } else showToast('"' + ex.name + '" ya existe. Edítalo en vez de crear otro.');
    return;
  }
  data.products.push({
    id: Date.now().toString(),
    name,
    price,
    categoryId: categorySelect.value || null,
    size: sizeInput ? sizeInput.value.trim() : '',
    specifications: specsInput ? specsInput.value.trim() : '',
    stock: invNum(document.getElementById('prodStock').value),
    cost: invNum(document.getElementById('prodCost').value)
  });
  document.getElementById('prodStock').value = '';
  document.getElementById('prodCost').value = '';
  nameInput.value = '';
  if(sizeInput) sizeInput.value = '';
  if(specsInput) specsInput.value = '';
  priceInput.value = '';
  nameInput.focus();
  saveData();
  renderProductos();
});

/* ---------- Etiquetas de producto (código de barras o QR) ----------
   Usa el mismo truco que ya usa la app para imprimir los QR de las mesas
   (pintarQR/imprimirQR): dibuja las etiquetas en un contenedor oculto del
   documento principal (nunca en un iframe aparte, para que QRCode.js y
   JsBarcode siempre tengan un documento real donde dibujar) y al imprimir
   se muestra solo ese contenedor. El tipo (código de barras o QR) se
   recuerda para la próxima vez. */
function productLabelCode(p){
  return 'P' + String(p.id).replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase();
}
// Lo que "dice" el QR al escanearlo con la cámara de cualquier celular:
// nombre, tamaño y precio en texto legible — no un código interno que solo
// esta app entiende — para que sirva también de consulta rápida en el local.
function productQrText(p, code){
  return (p.name + (p.size ? ' ' + p.size : '') + ' — ' + fmt(p.price) + ' · ' + code);
}
function labelTypeSelected(){
  const sel = document.getElementById('labelTypeSelect');
  return sel && sel.value === 'qr' ? 'qr' : 'barcode';
}
let labelPreviewList = [];
// Dibuja el código de una etiqueta. Si algo falla con un producto (p. ej. el
// generador de QR se queja de un nombre raro), no se cae toda la hoja: se
// reintenta con un QR más sencillo y, como último recurso, se deja el código
// escrito para no perder la etiqueta.
function drawLabelCode(holder, p, code, type){
  if(type === 'qr'){
    try{ new QRCode(holder, { text: productQrText(p, code), width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M }); return true; }catch(e){}
    holder.innerHTML = '';
    try{ new QRCode(holder, { text: code, width: 120, height: 120, correctLevel: QRCode.CorrectLevel.L }); return true; }catch(e){}
  } else {
    try{
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      holder.appendChild(svg);
      JsBarcode(svg, code, { format: 'CODE128', displayValue: true, fontSize: 13, width: 1.6, height: 50, margin: 6 });
      return true;
    }catch(e){ holder.innerHTML = ''; }
  }
  holder.innerHTML = '<div class="label-code" style="font-size:16px;font-weight:700">' + invEsc(code) + '</div>';
  return false;
}
function printProductLabels(products, forcedType){
  if(!products || !products.length) return;
  labelPreviewList = products;
  const type = forcedType || labelTypeSelected();
  if(type === 'barcode' && typeof JsBarcode === 'undefined'){ showToast('No se pudo cargar el generador de código de barras. Recarga la página.'); return; }
  if(type === 'qr' && typeof QRCode === 'undefined'){ showToast('No se pudo cargar el generador de QR. Recarga la página.'); return; }
  let copies = 1;
  const prevCopies = document.getElementById('lpCopies');
  if(prevCopies) copies = Math.max(1, Math.min(50, parseInt(prevCopies.value, 10) || 1));
  let box = document.getElementById('labelPrint');
  if(!box){ box = document.createElement('div'); box.id = 'labelPrint'; document.body.appendChild(box); }
  box.innerHTML = '';
  const total = products.length * copies;
  const bar = document.createElement('div');
  bar.className = 'lp-bar';
  bar.innerHTML =
    '<span class="lp-title">🏷️ ' + total + (total === 1 ? ' etiqueta' : ' etiquetas') + '</span>' +
    '<button type="button" data-lp="barcode" class="' + (type === 'barcode' ? 'on' : '') + '">Código de barras</button>' +
    '<button type="button" data-lp="qr" class="' + (type === 'qr' ? 'on' : '') + '">Código QR</button>' +
    '<label>Copias de cada una <input type="number" id="lpCopies" min="1" max="50" value="' + copies + '"></label>' +
    '<button type="button" data-lp="print" class="lp-print">🖨️ Imprimir</button>' +
    '<button type="button" data-lp="close">✕ Cerrar</button>';
  box.appendChild(bar);
  const hint = document.createElement('p');
  hint.className = 'lp-hint';
  hint.textContent = 'Así van a salir. Toca "Imprimir": en el celular puedes elegir tu impresora o "Guardar como PDF". Estas etiquetas se escanean con el botón "Escanear" de la mesa o de Venta rápida.';
  box.appendChild(hint);
  const grid = document.createElement('div');
  grid.className = 'lp-grid';
  let fallos = 0;
  products.forEach(p => {
    const code = productLabelCode(p);
    for(let k = 0; k < copies; k++){
      const card = document.createElement('div');
      card.className = 'label-card';
      const nameEl = document.createElement('div');
      nameEl.className = 'label-name';
      nameEl.textContent = p.name + (p.size ? ' · ' + p.size : '');
      card.appendChild(nameEl);
      const codeHolder = document.createElement('div');
      codeHolder.style.cssText = 'display:flex;justify-content:center';
      card.appendChild(codeHolder);
      if(!drawLabelCode(codeHolder, p, code, type)) fallos++;
      if(type === 'qr'){
        const codeEl = document.createElement('div');
        codeEl.className = 'label-code';
        codeEl.textContent = code;
        card.appendChild(codeEl);
      }
      const priceEl = document.createElement('div');
      priceEl.className = 'label-price';
      priceEl.textContent = fmt(p.price);
      card.appendChild(priceEl);
      grid.appendChild(card);
    }
  });
  box.appendChild(grid);
  bar.querySelectorAll('button[data-lp]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.lp;
    if(a === 'close') return closeLabelPreview();
    if(a === 'print'){ try{ window.print(); }catch(e){ showToast('Este navegador no deja imprimir desde aquí.'); } return; }
    const sel = document.getElementById('labelTypeSelect');
    if(sel) sel.value = a;
    try{ localStorage.setItem('vito_label_type', a); }catch(e){}
    printProductLabels(labelPreviewList, a);
  }));
  const copiesEl = document.getElementById('lpCopies');
  copiesEl.addEventListener('change', () => printProductLabels(labelPreviewList, type));
  document.body.classList.add('print-labels');
  if(fallos) showToast('⚠️ ' + fallos + ' etiqueta(s) no se pudieron dibujar; quedó el código escrito.', 4000);
}
function closeLabelPreview(){
  document.body.classList.remove('print-labels');
  const box = document.getElementById('labelPrint');
  if(box) box.innerHTML = '';
}
document.addEventListener('keydown', e => { if(e.key === 'Escape' && document.body.classList.contains('print-labels')) closeLabelPreview(); });
const labelTypeSelectEl = document.getElementById('labelTypeSelect');
if(labelTypeSelectEl){
  try{ labelTypeSelectEl.value = localStorage.getItem('vito_label_type') || 'barcode'; }catch(e){}
  labelTypeSelectEl.addEventListener('change', () => {
    try{ localStorage.setItem('vito_label_type', labelTypeSelectEl.value); }catch(e){}
  });
}
document.getElementById('productLabelsBtn').addEventListener('click', () => {
  const list = window.__labelProductList && window.__labelProductList.length ? window.__labelProductList : data.products;
  if(!list.length){ showToast('No hay productos para imprimir.'); return; }
  printProductLabels(list);
});

/* ---------- Escanear código de barras / QR (cámara en vivo) ----------
   Sirve para dos cosas: (1) vender más rápido escaneando el código de un
   producto para agregarlo de una a la cuenta abierta ("punto de venta"), y
   (2) reconocer o encontrar un producto al agregarlo/editarlo. Usa la misma
   API nativa del navegador (BarcodeDetector) que ya usaba el reconocimiento
   de facturas — sin librerías nuevas — y ahora también lee QR, no solo
   códigos de barras. Queda abierta para escanear varios seguidos: fácil de
   usar, sin tener que volver a tocar el botón cada vez. */
let scanStream = null, scanDetector = null, scanTimer = null, scanLastCode = null, scanLastAt = 0, scanOnResult = null, scanVivo = false;
// Formatos que se piden: los que el celular sí sabe leer (pedir uno que no soporta rompe el lector en algunos equipos).
const SCAN_FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code', 'code_39', 'itf', 'codabar'];

function scanBeep(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close().catch(()=>{}), 300);
  }catch(e){}
}

// Código leído: si con él se agregó un producto, su «tún» (Sonidos POS) ya confirma la lectura y no se pita encima.
function scanLeido(raw){
  const t0 = Date.now();
  if(navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
  try{ if(scanOnResult) scanOnResult(raw); }
  finally{ if(!(window.ventoSonidos && window.ventoSonidos.ultimo() >= t0)) scanBeep(); }
}

function closeScanOverlay(){
  const ov = document.getElementById('scanOverlay');
  if(ov) ov.classList.remove('show');
  if(scanTimer){ clearInterval(scanTimer); scanTimer = null; }
  scanVivo = false;
  const tb = document.getElementById('scanTorchBtn'); if(tb){ tb.hidden = true; tb.classList.remove('on'); }
  if(scanStream){ scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  scanDetector = null; scanOnResult = null; scanLastCode = null;
}

async function openScanOverlay(onResult, opts){
  opts = opts || {};
  const ov = document.getElementById('scanOverlay');
  const video = document.getElementById('scanVideo');
  const status = document.getElementById('scanStatus');
  if(!ov || !video) return;
  closeScanOverlay();
  ov.classList.add('show');
  status.textContent = opts.hint || i18nPut('Apunta la cámara al código del producto.');
  scanOnResult = onResult;
  if(!('BarcodeDetector' in window)){
    status.textContent = 'Tu navegador no soporta lectura de códigos por cámara (usa Chrome en Android). Busca el producto a mano.';
    return;
  }
  /* Cámara en buena resolución y con enfoque continuo: con la cámara por defecto (baja
     resolución, sin autoenfoque) los códigos pequeños o de cerca no se leían. Si el celular
     no acepta estas opciones, se abre la cámara normal. */
  try{
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] } });
  }catch(e){
    try{ scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
    catch(e2){ status.textContent = 'No se pudo abrir la cámara. Revisa los permisos del navegador para esta página.'; return; }
  }
  video.srcObject = scanStream;
  try{ await video.play(); }catch(e){}
  try{
    let formatos = SCAN_FORMATOS;
    try{ const sop = await BarcodeDetector.getSupportedFormats(); if(sop && sop.length) formatos = SCAN_FORMATOS.filter(f => sop.includes(f)); }catch(e){}
    scanDetector = new BarcodeDetector({ formats: formatos.length ? formatos : ['ean_13', 'qr_code'] });
  }catch(e){
    status.textContent = 'Tu navegador no soporta lectura de códigos por cámara. Busca el producto a mano.';
    closeScanOverlay();
    return;
  }
  // Linterna (en un bar suele estar oscuro): solo si la cámara la tiene.
  try{
    const track = scanStream.getVideoTracks()[0], cap = track && track.getCapabilities ? track.getCapabilities() : {};
    const tb = document.getElementById('scanTorchBtn');
    if(tb && cap && cap.torch){
      tb.hidden = false; tb.classList.remove('on');
      tb.onclick = async () => {
        const on = !tb.classList.contains('on');
        try{ await track.applyConstraints({ advanced: [{ torch: on }] }); tb.classList.toggle('on', on); tb.textContent = on ? '🔦 Apagar linterna' : '🔦 Linterna'; }catch(e){}
      };
    }
  }catch(e){}
  /* Se lee en cada cuadro del video (antes cada 350 ms): el código sale apenas entra en
     cámara. Nunca se lanzan dos lecturas a la vez, para no trabar celulares lentos. */
  scanVivo = true;
  let ocupado = false;
  const leer = async () => {
    if(!scanVivo) return;
    if(!ocupado && scanDetector && video.videoWidth){
      ocupado = true;
      try{
        const codes = await scanDetector.detect(video);
        const c0 = codes && codes.find(c => c && c.rawValue);
        if(c0){
          const raw = c0.rawValue, now = Date.now();
          // Mientras el código siga en cámara no se repite (antes se volvía a sumar cada 1,5 s si
          // se dejaba quieto). Para sumar otra unidad del mismo, se retira un momento y se vuelve a mostrar.
          if(!(raw === scanLastCode && (now - scanLastAt) < 800)){
            scanLastCode = raw; scanLastAt = now;
            scanLeido(raw);
          } else scanLastAt = now;
        }
      }catch(e){}
      ocupado = false;
    }
    if(scanVivo) (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(leer) : requestAnimationFrame(leer));
  };
  leer();
}

document.getElementById('scanCloseBtn').addEventListener('click', closeScanOverlay);
document.getElementById('scanCloseBtn2').addEventListener('click', closeScanOverlay);
document.getElementById('scanOverlay').addEventListener('click', (e) => { if(e.target.id === 'scanOverlay') closeScanOverlay(); });

// Encuentra el producto dueño de un código leído: coincide con el código de
// barras exacto, o con el código que va al final del texto del QR (ver
// productQrText/productLabelCode más arriba).
function findProductByScannedCode(raw){
  if(!raw) return null;
  const clean = String(raw).trim();
  // Códigos propios del producto (el de fábrica, p. ej. el EAN de la lata),
  // que se enlazan la primera vez que se escanean.
  let p = data.products.find(x => Array.isArray(x.barcodes) && x.barcodes.includes(clean));
  if(p) return p;
  p = data.products.find(x => (x.specifications || '').includes('Código: ' + clean));
  if(p) return p;
  p = data.products.find(x => productLabelCode(x) === clean);
  if(p) return p;
  const tail = clean.split('·').pop().trim();
  p = data.products.find(x => productLabelCode(x) === tail);
  if(p) return p;
  p = data.products.find(x => clean.includes(productLabelCode(x)));
  return p || null;
}

// --- Vender escaneando: agrega el producto reconocido a la cuenta abierta ---
const scanSellBtnEl = document.getElementById('scanSellBtn');
if(scanSellBtnEl){
  scanSellBtnEl.addEventListener('click', () => {
    if(!currentTable && currentTable !== 0){ return; }
    openScanOverlay(async (raw) => {
      const p = findProductByScannedCode(raw);
      if(p){ addFavoriteToTable(p.id); return; }
      handleUnknownScannedCode(raw, prod => addFavoriteToTable(prod.id), { canCreate: true });
    }, { hint: i18nPut('Escanea el código del producto para agregarlo a la cuenta — puedes escanear varios seguidos.') });
  });
}

// --- Agregar/encontrar producto escaneando (en Productos) ---
const scanCodeAddBtnEl = document.getElementById('scanCodeAddBtn');
if(scanCodeAddBtnEl){
  scanCodeAddBtnEl.addEventListener('click', () => {
    openScanOverlay(async (raw) => {
      const existing = findProductByScannedCode(raw);
      if(existing){
        closeScanOverlay();
        showToast('✅ "' + existing.name + '" ya está en tu lista — puedes editarlo.');
        openEditProductModal(existing.id);
        return;
      }
      showToast('🔎 Código no reconocido en tu lista, buscando información…');
      const off = await lookupOpenFoodFacts(raw).catch(() => null);
      if(off && off.name){
        closeScanOverlay();
        document.getElementById('prodName').value = [off.brand, off.name].filter(Boolean).join(' ').trim();
        if(off.size) document.getElementById('prodSize').value = off.size;
        document.getElementById('prodSpecs').value = 'Código: ' + raw;
        document.getElementById('prodPrice').focus();
        showToast('Detectado: ' + off.name + '. Revisa y agrega el precio.');
      } else {
        showToast('❌ No encontré información de ese código. Escribe el producto a mano.');
      }
    }, { hint: i18nPut('Escanea el código de barras o QR de un producto para agregarlo o encontrarlo.') });
  });
}

/* ---------- Código desconocido: enlazarlo a un producto (una sola vez) ----------
   Antes, si escaneabas el código de fábrica de un producto (el de la lata o
   el paquete) y no era una etiqueta impresa por la app, solo salía "código no
   reconocido". Ahora se pregunta qué producto es, se guarda ese código en el
   producto y desde ahí se reconoce solo. */
let lcCode = null, lcOnPick = null, lcCanCreate = false, lcSuggestName = '';
async function handleUnknownScannedCode(raw, onPick, opts){
  opts = opts || {};
  closeScanOverlay();
  lcCode = String(raw).trim(); lcOnPick = onPick; lcCanCreate = !!opts.canCreate; lcSuggestName = '';
  const ov = document.getElementById('linkCodeOverlay');
  const search = document.getElementById('lcSearch');
  document.getElementById('lcSub').textContent = 'El código ' + lcCode + ' todavía no está en tu lista. ¿Qué producto es? Elígelo una sola vez y desde ahí se reconoce solo cada vez que lo escanees.';
  search.value = '';
  document.getElementById('lcCreateBtn').style.display = lcCanCreate ? '' : 'none';
  ov.classList.add('show');
  lcRenderList('');
  // Si hay internet, se intenta averiguar el nombre (Open Food Facts) para
  // sugerir el producto correcto sin que tengas que escribir.
  if(/^\d{8,14}$/.test(lcCode) && typeof lookupOpenFoodFacts === 'function'){
    const off = await lookupOpenFoodFacts(lcCode).catch(() => null);
    if(off && off.name && ov.classList.contains('show') && !search.value){
      lcSuggestName = [off.brand, off.name].filter(Boolean).join(' ').trim();
      document.getElementById('lcSub').textContent = 'Parece que es: "' + lcSuggestName + '". ¿Cuál de tus productos es? Elígelo una sola vez y desde ahí se reconoce solo.';
      lcRenderList(lcSuggestName);
    }
  }
}
function lcRenderList(query){
  const list = document.getElementById('lcList');
  const q = normVoiceText ? normVoiceText(query || '') : (query || '').toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 1);
  let items = data.products.map(p => {
    const n = normVoiceText ? normVoiceText(p.name + ' ' + (p.size || '')) : (p.name + ' ' + (p.size || '')).toLowerCase();
    const score = words.length ? words.filter(w => n.includes(w)).length : 1;
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, 12);
  if(!items.length && words.length){
    list.innerHTML = '<div class="lc-empty">Ningún producto coincide' + (lcCanCreate ? ' — usa "Es un producto nuevo".' : '. Créalo primero en Productos.') + '</div>';
    return;
  }
  list.innerHTML = items.map(x => '<button type="button" data-id="' + invEsc(x.p.id) + '"><span>' + invEsc(x.p.name) + (x.p.size ? ' · ' + invEsc(x.p.size) : '') + '</span><strong>' + fmt(x.p.price) + '</strong></button>').join('');
  list.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', () => {
    const prod = data.products.find(p => p.id === b.dataset.id);
    if(!prod) return;
    if(!Array.isArray(prod.barcodes)) prod.barcodes = [];
    if(!prod.barcodes.includes(lcCode)) prod.barcodes.push(lcCode);
    saveData();
    const cb = lcOnPick;
    closeLinkCodeOverlay();
    showToast('🔗 Listo: ese código ahora es "' + prod.name + '".');
    if(cb) cb(prod);
  }));
}
function closeLinkCodeOverlay(){
  document.getElementById('linkCodeOverlay').classList.remove('show');
  lcOnPick = null;
}
document.getElementById('lcSearch').addEventListener('input', e => lcRenderList(e.target.value));
document.getElementById('lcCloseBtn').addEventListener('click', closeLinkCodeOverlay);
document.getElementById('lcCancelBtn').addEventListener('click', closeLinkCodeOverlay);
document.getElementById('linkCodeOverlay').addEventListener('click', e => { if(e.target.id === 'linkCodeOverlay') closeLinkCodeOverlay(); });
document.getElementById('lcCreateBtn').addEventListener('click', () => {
  const code = lcCode, name = document.getElementById('lcSearch').value.trim() || lcSuggestName;
  closeLinkCodeOverlay();
  openQuickProductOverlay(name, { barcode: code });
});

// --- Venta rápida: vender escaneando (igual que en la mesa) ---
document.getElementById('qsScanBtn').addEventListener('click', () => {
  openScanOverlay((raw) => {
    const p = findProductByScannedCode(raw);
    if(p){ qsAddToCart(p, 1); showToast('✅ ' + p.name + ' agregado'); return; }
    handleUnknownScannedCode(raw, prod => { qsAddToCart(prod, 1); showToast('✅ ' + prod.name + ' agregado'); });
  }, { hint: i18nPut('Escanea el código del producto para agregarlo a la venta — puedes escanear varios seguidos.') });
});

/* ---------- Producto nuevo por foto, directo desde la mesa ---------- */
// Cuando buscas un producto en una mesa y no existe, en vez de tener que
// salirte a Productos, tomarle o subirle una foto, la IA (o el código de
// barras + Open Food Facts si no hay IA configurada) intenta identificarlo
// — igual que en Productos — y de una vez lo crea en el inventario y lo
// agrega a la cuenta abierta.
let qpBarcode = null;
let qpFotoBlanca = null;   // la misma foto que se tomó para identificarlo, ya con fondo blanco, lista para guardarse como foto del producto
function openQuickProductOverlay(prefillName, ctx){
  const ov = document.getElementById('quickProductOverlay');
  if(!ov) return;
  qpBarcode = ctx && ctx.barcode ? ctx.barcode : null;
  qpFotoBlanca = null;
  document.getElementById('qpName').value = prefillName || '';
  document.getElementById('qpPrice').value = '';
  document.getElementById('qpCost').value = '';
  document.getElementById('qpSize').value = '';
  const preview = document.getElementById('qpPhotoPreview');
  if(preview) preview.classList.remove('show');
  ov.classList.add('show');
  hideProductSuggestions();
}
function closeQuickProductOverlay(){
  const ov = document.getElementById('quickProductOverlay');
  if(ov) ov.classList.remove('show');
  const input = document.getElementById('qpCameraInput');
  if(input) input.value = '';
  qpFotoBlanca = null;
}
document.getElementById('qpCloseBtn').addEventListener('click', closeQuickProductOverlay);
document.getElementById('qpCancelBtn').addEventListener('click', closeQuickProductOverlay);
document.getElementById('quickProductOverlay').addEventListener('click', (e) => { if(e.target.id === 'quickProductOverlay') closeQuickProductOverlay(); });

document.getElementById('qpCameraBtn').addEventListener('click', () => document.getElementById('qpCameraInput').click());
document.getElementById('qpCameraInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const btn = document.getElementById('qpCameraBtn');
  const preview = document.getElementById('qpPhotoPreview');
  const previewImg = document.getElementById('qpPhotoPreviewImg');
  const status = document.getElementById('qpPhotoStatus');
  btn.disabled = true; btn.textContent = '📷 Analizando…';
  preview.classList.add('show');
  status.textContent = 'Preparando la foto…';
  qpFotoBlanca = null;
  try{
    const dataUrl = await scalePhotoForAI(file, 640, 0.7);
    previewImg.src = dataUrl;
    // La misma foto que se tomó para identificar el producto queda lista para
    // usarse como su foto en la carta, con fondo blanco automático (igual que
    // al subir una foto desde Productos) — así no hay que repetir el paso.
    try{ qpFotoBlanca = fotoFondoBlanco(await fotoLeerImagen(file)).blanco; }catch(e){ qpFotoBlanca = null; }
    status.textContent = 'Analizando imagen y completando la información del producto…';
    let info;
    try{
      info = await recognizeProductWithAI(dataUrl, (m) => { status.textContent = m; });
    }catch(err){
      if(err.message === 'NO_API_KEY') info = await recognizeProductFallback(file);
      else throw err;
    }
    if(info && info.raw && !info.name){
      status.textContent = 'Código de barras detectado: ' + info.raw + '. Configura la IA (Ajustes) para identificar el producto automáticamente, o escríbelo a mano.';
    } else {
      const displayName = [info.brand, info.name].filter(Boolean).join(' ').trim() || info.name || '';
      if(!displayName){
        status.textContent = 'No logré identificar el producto en la foto. Acércate a la etiqueta, con buena luz, o escríbelo a mano.';
      } else {
        document.getElementById('qpName').value = displayName;
        if(info.size && info.unit) document.getElementById('qpSize').value = info.size + ' ' + info.unit;
        else if(info.size) document.getElementById('qpSize').value = String(info.size);
        status.textContent = 'Detectado: ' + displayName + '. Revisa y ponle el precio.';
        document.getElementById('qpPrice').focus();
      }
    }
  }catch(err){
    if(err.message === 'NO_API_KEY') status.textContent = 'Configura la IA en Ajustes para reconocimiento por foto, o escríbelo a mano.';
    else status.textContent = '❌ ' + (err && err.message ? err.message : 'No se pudo reconocer el producto.') + ' Puedes escribirlo a mano.';
  }finally{
    btn.disabled = false; btn.textContent = '📷 Tomar foto / subir imagen';
    document.getElementById('qpCameraInput').value = '';
  }
});

document.getElementById('qpAddBtn').addEventListener('click', async () => {
  const nameInput = document.getElementById('qpName');
  const priceInput = document.getElementById('qpPrice');
  const costInput = document.getElementById('qpCost');
  const sizeInput = document.getElementById('qpSize');
  const name = nameInput.value.trim();
  const price = +priceInput.value;
  if(!name || !price || price <= 0 || isNaN(price)){
    showToast('Escribe un nombre y un precio válido.');
    return;
  }
  if(!currentTable && currentTable !== 0){
    showToast('Abre una mesa primero.');
    return;
  }
  const size = sizeInput.value.trim();
  const fotoLista = qpFotoBlanca;   // se pierde al cerrar el overlay, así que se guarda antes
  const guardarFoto = async (p) => {
    if(!fotoLista || p.foto) return;   // no pisa una foto que el producto ya tuviera
    try{
      fotosCache[p.id] = fotoLista; p.foto = Date.now();
      await fotoSet(p.id, fotoLista);
      renderProductos(); renderInventario();
      setTimeout(() => { try{ publicarFotosCarta(); }catch(e){} }, 1500);
    }catch(e){ if(window.mesoraLogError) mesoraLogError('fotos', 'No se pudo guardar la foto tomada al crear el producto: ' + (e && e.message || e), 'qpAddBtn'); }
  };
  const existing = data.products.find(p => dupKey(p) === dupKey({ name, size }));
  if(existing){
    if(qpBarcode){ if(!Array.isArray(existing.barcodes)) existing.barcodes = []; if(!existing.barcodes.includes(qpBarcode)) existing.barcodes.push(qpBarcode); saveData(); }
    closeQuickProductOverlay();
    guardarFoto(existing);
    addFavoriteToTable(existing.id);
    return;
  }
  const newProduct = {
    id: Date.now().toString(),
    name,
    price,
    categoryId: null,
    size,
    specifications: '',
    stock: null,
    cost: invNum(costInput.value)
  };
  if(qpBarcode) newProduct.barcodes = [qpBarcode];
  data.products.push(newProduct);
  await saveData();
  renderProductos();
  renderInventario();
  closeQuickProductOverlay();
  await guardarFoto(newProduct);
  addFavoriteToTable(newProduct.id);
});

/* ---------- Cuentas de un producto: costo, precio, IVA, cantidad ----------
   Lo que de verdad te queda NO es «precio − costo» cuando eres responsable de IVA:
   el precio que cobras lleva el IVA por dentro (ese IVA es de la DIAN, no tuyo) y el
   IVA que le pagaste al proveedor se descuenta. Por eso todo se calcula sobre los
   valores SIN IVA, y además se multiplica por la cantidad que tienes para ver la
   plata metida y la ganancia que hay en la bodega.
   - Responsable de IVA:    utilidad = precio/(1+iva) − costo/(1+iva)
   - No responsable:        el IVA de la compra es parte del costo → utilidad = precio − costo */
function ivaDeProducto(p){
  if(p && p.iva != null && p.iva !== '') return Math.max(0, Math.min(50, Number(p.iva) || 0));
  return (typeof data !== 'undefined' && data && data.ivaResponsable) ? (Number(data.ivaRate) || 19) : 0;
}
function cuentasProducto(p){
  const iva = ivaDeProducto(p), f = 1 + iva / 100, conIva = iva > 0;
  const precio = Number(p.price) || 0;
  const costo = (p.cost == null || p.cost === '') ? null : (Number(p.cost) || 0);
  const precioNeto = conIva ? precio / f : precio;
  const costoNeto = costo == null ? null : (conIva ? costo / f : costo);
  const utilidad = costoNeto == null ? null : precioNeto - costoNeto;
  const margen = (utilidad == null || precioNeto <= 0) ? null : (utilidad / precioNeto * 100);
  const sobreCosto = (utilidad == null || !costoNeto) ? null : (utilidad / costoNeto * 100);
  const cant = (p.stock == null || p.stock === '') ? null : Math.max(0, Number(p.stock) || 0);
  return {
    iva, conIva, precio, precioNeto, ivaVenta: precio - precioNeto,
    costo, costoNeto, ivaCompra: costo == null ? null : costo - costoNeto,
    utilidad, margen, sobreCosto, cant,
    // Por la cantidad que tienes guardada
    inversion: (cant != null && costo != null) ? costo * cant : null,
    ventaTotal: cant != null ? precio * cant : null,
    utilidadTotal: (cant != null && utilidad != null) ? utilidad * cant : null,
    // Lo que le quedarías debiendo a la DIAN por esas ventas (IVA cobrado − IVA pagado)
    ivaPorPagar: (costo == null || !conIva) ? null : (precio - precioNeto) - (costo - costoNeto)
  };
}
const fmtPct = v => (v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ',') + '%');
// Tabla de números de un producto, para el desplegable y para el editor.
function cuentasHtml(p){
  const c = cuentasProducto(p);
  if(c.costo == null && !c.precio) return '<div class="pr-nums-vacio">Ponle precio y costo para ver cuánto ganas.</div>';
  const cls = c.margen == null ? '' : c.margen < 0 ? 'pr-mal' : c.margen < 15 ? 'pr-bajo' : 'pr-bien';
  const fila = (etq, val, extra) => '<div class="pr-num' + (extra || '') + '"><span>' + etq + '</span><b>' + val + '</b></div>';
  let h = '<div class="pr-nums">';
  if(c.conIva){
    h += fila('Precio de venta (con IVA ' + c.iva + '%)', fmt(Math.round(c.precio)));
    h += fila('Te queda de la venta (sin IVA)', fmt(Math.round(c.precioNeto)));
    if(c.costo != null){
      h += fila('Costo con IVA (lo que pagas)', fmt(Math.round(c.costo)));
      h += fila('Costo sin IVA (lo que cuesta de verdad)', fmt(Math.round(c.costoNeto)));
    }
  }else{
    h += fila('Precio de venta', fmt(Math.round(c.precio)));
    if(c.costo != null) h += fila('Costo (lo que pagas)', fmt(Math.round(c.costo)));
  }
  if(c.utilidad != null){
    h += fila('Ganas por unidad', fmt(Math.round(c.utilidad)), ' ' + cls);
    h += fila('Margen', fmtPct(c.margen), ' ' + cls);
    if(c.sobreCosto != null) h += fila('Le ganas sobre el costo', fmtPct(c.sobreCosto));
  }
  if(c.cant != null){
    h += '<div class="pr-num-sep">Por las ' + c.cant + ' unidades que tienes</div>';
    if(c.inversion != null) h += fila('Plata metida (costo × ' + c.cant + ')', fmt(Math.round(c.inversion)));
    if(c.ventaTotal != null) h += fila('Si las vendes todas', fmt(Math.round(c.ventaTotal)));
    if(c.utilidadTotal != null) h += fila('Ganancia si las vendes todas', fmt(Math.round(c.utilidadTotal)), ' ' + cls);
  }
  if(c.ivaPorPagar != null && c.ivaPorPagar !== 0) h += fila('IVA que le entregas a la DIAN (por unidad)', fmt(Math.round(c.ivaPorPagar)));
  return h + '</div>';
}
function renderProductos(){
  refreshProdCategorySelect();
  renderCategoryBar();
  try{ renderMarginTable(); }catch(e){}

  const list = document.getElementById('productList');
  list.innerHTML = '';

  let products = data.products;
  if(currentCategoryFilter === '__none__'){
    products = products.filter(p=>!p.categoryId);
  } else if(currentCategoryFilter !== null){
    products = products.filter(p=>p.categoryId === currentCategoryFilter);
  }

  // Buscador: todas las palabras escritas deben aparecer en el nombre, tamaño, categoría o
  // especificaciones (sin importar tildes ni mayúsculas).
  const qEl = document.getElementById('prodBuscar'), qRaw = qEl ? qEl.value.trim() : '';
  const sinTilde = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const qWords = sinTilde(qRaw).split(/\s+/).filter(Boolean);
  if(qWords.length){
    products = data.products.filter(p => { const h = sinTilde([p.name, p.size, p.categoryId ? categoryName(p.categoryId) : '', Array.isArray(p.specifications) ? p.specifications.join(' ') : p.specifications, p.codigo || '', (p.barcodes || []).join(' ')].join(' ')); return qWords.every(w => h.includes(w)); });
  }
  const nEl = document.getElementById('prodBuscarN');
  if(nEl) nEl.textContent = qWords.length ? products.length + ' de ' + data.products.length : data.products.length + ' productos';
  if(data.products.length === 0){
    list.innerHTML = '<div class="empty-state">Todavía no tienes productos. Agrega tu primera referencia arriba — por ejemplo, una cerveza o una bebida del menú.</div>';
    return;
  }
  if(qWords.length && products.length === 0){
    list.innerHTML = '<div class="empty-state">No encontré «' + invEsc(qRaw) + '». <button type="button" class="btn-ghost" id="prodBuscarCrear">➕ Crear «' + invEsc(qRaw) + '»</button></div>';
    document.getElementById('prodBuscarCrear').onclick = () => { const n = document.getElementById('prodName'); n.value = qRaw; qEl.value = ''; renderProductos(); n.scrollIntoView({ block: 'center' }); n.focus(); };
    return;
  }
  if(products.length === 0){
    list.innerHTML = '<div class="empty-state">No hay productos en esta categoría todavía.</div>';
    return;
  }

  products.forEach(p=>{
    const row = document.createElement('details');
    row.className = 'product-row pr-det';
    row.dataset.id = p.id;
    const tag = p.categoryId
      ? `<span class="p-tag"><span class="dot" style="background:${categoryColorVar(p.categoryId)}"></span>${categoryName(p.categoryId)}</span>`
      : '';
    const c = cuentasProducto(p);
    const margenChip = c.margen == null ? '' :
      `<span class="p-margen ${c.margen < 0 ? 'pr-mal' : c.margen < 15 ? 'pr-bajo' : 'pr-bien'}">${fmtPct(c.margen)}</span>`;
    const hist = productCostHistoryHtml(p.id, 5);
    row.innerHTML = `
      <summary class="pr-sum">
        <div class="p-name-wrap">
          ${typeof prodFotoThumbHtml === 'function' ? prodFotoThumbHtml(p) : ''}
      <span class="p-name">${qWords.length ? invEsc(p.name).replace(new RegExp('(' + qWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), '<mark class="pb">$1</mark>') : invEsc(p.name)}</span>
          ${p.size ? `<span class="p-size">📦 ${invEsc(p.size)}</span>` : ''}
          ${p.codigo ? `<span class="p-size">🔢 ${invEsc(p.codigo)}</span>` : ''}
          ${detResumen(p, 70) ? `<span class="p-det">${invEsc(detResumen(p, 70))}</span>` : ''}
          ${tag}
          ${invChip(p)}
        </div>
        <div class="p-right">
          <span class="p-price">${fmt(p.price)}</span>
          ${margenChip}
          <span class="pr-caret" aria-hidden="true">▾</span>
        </div>
      </summary>
      <div class="pr-body">
        ${cuentasHtml(p)}
        <div class="pr-inv">
          <span class="pr-inv-t">${invEsc(invPalabra()[0])}: ${p.stock == null ? 'sin control' : p.stock + ' ' + invPalabra()[1]}${p.stock != null ? ' · aviso ≤ ' + (p.minStock != null ? p.minStock : INV_DEF_MIN) : ''}</span>
          <div class="pr-inv-btns">
            <button type="button" class="btn-ghost" data-act="in" data-id="${p.id}">+ Entrada</button>
            <button type="button" class="btn-ghost" data-act="count" data-id="${p.id}">Contar</button>
            <button type="button" class="btn-ghost" data-act="min" data-id="${p.id}">Aviso</button>
          </div>
        </div>
        ${hist ? `<details class="iv-boxdetails"><summary>📈 Ver historial de precios</summary>${hist}</details>` : ''}
        <div class="pr-acciones">
          <button type="button" class="p-fav${p.favorite ? ' on' : ''}" data-id="${p.id}" title="Acceso rápido en la mesa">${p.favorite ? '⭐ Rápido' : '☆ Rápido'}</button>
          <button type="button" class="p-label" data-id="${p.id}" title="Imprimir la etiqueta con código de barras">🏷️ Etiqueta</button>
          <button type="button" class="p-edit" data-id="${p.id}">✏️ Editar</button>
          <button type="button" class="p-del" data-id="${p.id}">🗑️ Eliminar</button>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
  window.__labelProductList = products;
  list.querySelectorAll('.p-label').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const prod = data.products.find(p=>p.id === btn.dataset.id);
      if(prod) printProductLabels([prod]);
    });
  });
  list.querySelectorAll('.p-fav').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const prod = data.products.find(p=>p.id === btn.dataset.id);
      if(!prod) return;
      prod.favorite = !prod.favorite;
      saveData();
      renderProductos();
    });
  });
  list.querySelectorAll('.p-edit').forEach(btn=>{
    btn.addEventListener('click', ()=> openEditProductModal(btn.dataset.id));
  });
  // Tocar el producto lo despliega con sus cuentas (costo, precio, IVA, margen y
  // cuánto hay metido en la cantidad que tienes) y los botones de inventario.
  list.querySelectorAll('[data-act]').forEach(btn=>{
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); invAsk(btn.dataset.id, btn.dataset.act); });
  });
  list.querySelectorAll('.p-del').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const prod = data.products.find(p=>p.id === btn.dataset.id);
      const ok = await showConfirm({
        title: '¿Eliminar producto?',
        message: '¿Estás seguro que quieres eliminar "' + (prod ? prod.name : 'este producto') + '"? No podrás deshacer esta acción.',
        confirmText: 'Sí, eliminar',
        icon: '🗑️'
      });
      if(!ok) return;
      data.products = data.products.filter(p=>p.id !== btn.dataset.id);
      saveData();
      renderProductos();
    });
  });
}

/* ---------- Editar producto ---------- */
const editProductOverlay = document.getElementById('editProductOverlay');
let editingProductId = null;

function refreshEditProdCategorySelect(selectedId){
  const sel = document.getElementById('editProdCategory');
  sel.innerHTML = '<option value="">Sin categoría</option>';
  data.categories.forEach(cat=>{
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
  sel.value = selectedId || '';
}

// Crear una categoría desde donde sea (la barra de categorías o el formulario de
// agregar producto): abre el panel que la contiene y pone el cursor en el nombre.
function abrirNuevaCategoria(){
  const row = document.getElementById('categoryAddRow'); if(!row) return;
  const panel = row.closest('details'); if(panel) panel.open = true;
  const abierto = row.style.display === 'flex';
  row.style.display = abierto ? 'none' : 'flex';
  if(!abierto){ const inp = document.getElementById('newCategoryName'); if(inp){ try{ inp.focus(); }catch(e){} try{ row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }catch(e){} } }
}
/* ---------- Detalles propios de cada negocio ----------
   Un paquete de viaje no se describe igual que un tornillo: la agencia guarda destino,
   días, qué incluye y cupos; el hotel, cuántas personas y qué camas; la ferretería, la
   medida y si se vende por metro o por unidad. Los campos salen del catálogo (campos)
   y se guardan en p.det. Se ven en Productos y en la carta que abren los clientes. */
function camposNegocio(){ const t = tipoNegocio(); return (t && t.campos) || []; }
function pintarCamposProducto(p){
  const box = document.getElementById('editProdDet'), wrap = document.getElementById('editProdDetWrap');
  if(!box || !wrap) return;
  const campos = camposNegocio(), det = (p && p.det) || {};
  wrap.hidden = !campos.length;
  document.getElementById('editProdDetSum').textContent = '📋 Detalles ' + (producto1()[0].toLowerCase() === 'producto' ? 'del producto' : 'de ' + (generoDe(producto1()[0]) === 'm' ? 'este ' : 'esta ') + producto1()[0].toLowerCase());
  document.getElementById('editProdDetSub').textContent = 'Lo que el cliente quiere saber antes de comprar. Todo es opcional y sale en la lista que ven tus clientes.';
  box.innerHTML = campos.map(([k, lab, tipo, ph]) => {
    const v = det[k] == null ? '' : det[k];
    if(tipo === 'si') return '<label class="det-si"><input type="checkbox" data-det="' + k + '"' + (v ? ' checked' : '') + '> ' + invEsc(lab) + '</label>';
    return '<label for="det-' + k + '">' + invEsc(lab) + '</label><input id="det-' + k + '" data-det="' + k + '" type="' + (tipo === 'num' ? 'number' : 'text') + '"' + (tipo === 'num' ? ' min="0" step="1" inputmode="numeric"' : '') + ' placeholder="' + invEsc(ph || '') + '" value="' + invEsc(String(v)) + '">';
  }).join('');
  wrap.open = Object.keys(det).some(k => det[k] !== '' && det[k] != null);
}
function leerCamposProducto(){
  const box = document.getElementById('editProdDet'); if(!box) return null;
  const det = {};
  box.querySelectorAll('[data-det]').forEach(el => {
    const v = el.type === 'checkbox' ? el.checked : el.value.trim();
    if(v !== '' && v !== false) det[el.dataset.det] = el.type === 'number' ? Number(v) : v;
  });
  return Object.keys(det).length ? det : null;
}
// Renglón corto para la lista y para la carta: «San Andrés · 4 días, 3 noches · Incluye: vuelo, hotel»
function detResumen(p, max){
  const det = p && p.det; if(!det) return '';
  const campos = camposNegocio(), partes = [];
  campos.forEach(([k, lab, tipo]) => {
    const v = det[k]; if(v === '' || v == null || v === false) return;
    if(tipo === 'si'){ partes.push(lab); return; }
    partes.push(/incluye|detalle|prepara|garant|horario|camas|qué/i.test(lab) ? lab + ': ' + v : (tipo === 'num' ? v + ' ' + lab.replace(/^(cuántas?|para cuántas?|hasta cuántos?|precio por cuántas)\s*/i, '').toLowerCase() : v));
  });
  const r = partes.join(' · ');
  return max && r.length > max ? r.slice(0, max - 1) + '…' : r;
}
function openEditProductModal(productId){
  const p = data.products.find(x=>x.id === productId);
  if(!p) return;
  editingProductId = productId;
  document.getElementById('editProdName').value = p.name;
  document.getElementById('editProdPrice').value = p.price;
  document.getElementById('editProdCost').value = p.cost != null ? p.cost : '';
  document.getElementById('editProdCostWrap').open = p.cost != null;
  const ivaEl = document.getElementById('editProdIva');
  if(ivaEl){ ivaEl.value = (p.iva == null || p.iva === '') ? '' : p.iva; ivaEl.placeholder = String(ivaDeProducto({})); }
  document.getElementById('editProdSize').value = p.size || '';
  document.getElementById('editProdSpecs').value = Array.isArray(p.specifications) ? p.specifications.join(', ') : (p.specifications || '');
  pintarCamposProducto(p);
  document.getElementById('editProdStock').value = p.stock != null ? p.stock : '';
  document.getElementById('editProdMin').value = p.minStock != null ? p.minStock : '';
  refreshEditProdCategorySelect(p.categoryId);
  const codEl = document.getElementById('editProdCodigo'); if(codEl) codEl.value = p.codigo || (p.barcodes || [])[0] || '';
  if(typeof prodFotoModalAbrir === 'function') prodFotoModalAbrir(p);
  renderProductCostHistory(productId);
  renderEditProdMargin();
  editProductOverlay.classList.add('show');
}

// Margen de ganancia calculado al vuelo con lo que hay escrito en el
// formulario (no lo guardado todavía), para que se vea de una vez cuánto
// se está ganando o perdiendo mientras se edita el precio o el costo —
// lo mismo que ya se ve en Inventario, pero directo aquí en Productos.
function renderEditProdMargin(){
  // Desglose detallado de margen: costo actual, precio actual, cuánto se
  // gana o se pierde por unidad (con la palabra correcta según el signo) y
  // el margen, cada dato en su propia fila -- no todo amontonado en una
  // sola línea. Los valores de arriba (precio/costo) se pueden seguir
  // editando ahí mismo; este bloque solo reacciona a esos cambios.
  const line = document.getElementById('editProdMarginLine');
  if(!line) return;
  const price = parseFloat(document.getElementById('editProdPrice').value);
  const cost = parseFloat(document.getElementById('editProdCost').value);
  if(!isFinite(price) || price <= 0 || !isFinite(cost) || cost <= 0){
    line.innerHTML = '<div class="mb-empty">Escribe el costo (lo que te cuesta comprarlo) para ver aquí el desglose completo: cuánto ganas o pierdes por unidad, y tu margen.</div>';
    return;
  }
  const ivaTxt = (document.getElementById('editProdIva') || {}).value;
  const falso = { price, cost, iva: (ivaTxt == null || ivaTxt === '') ? null : Number(ivaTxt),
    stock: invNum(document.getElementById('editProdStock').value) };
  line.innerHTML = cuentasHtml(falso);
}
document.getElementById('editProdPrice').addEventListener('input', renderEditProdMargin);
document.getElementById('editProdCost').addEventListener('input', renderEditProdMargin);
document.getElementById('editProdIva').addEventListener('input', renderEditProdMargin);
document.getElementById('prodNewCatBtn').addEventListener('click', abrirNuevaCategoria);
document.getElementById('editProdStock').addEventListener('input', renderEditProdMargin);

// ---------- Histórico de precio de compra (de las facturas ya escaneadas) ----------
// Función compartida: arma el HTML del histórico de un producto (fecha, proveedor,
// costo y flecha si subió/bajó frente a la compra anterior). La usan tanto el
// modal de "Editar producto" como cada fila de Inventario (para no tener que
// entrar a Productos a verlo — queda todo ahí mismo, en Inventario).
function productCostHistoryHtml(productId, limit){
  const rows = [];
  (data.purchases || []).forEach(pur => {
    (pur.items || []).forEach(it => {
      if(it.productId === productId) rows.push({ date: pur.date || (pur.at ? pur.at.slice(0, 10) : ''), supplier: pur.supplier || '', cost: it.cost, at: pur.at || pur.date || '' });
    });
  });
  if(!rows.length) return '';
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const lastN = rows.slice(0, limit || 5);
  const lines = lastN.map((r, i) => {
    const prev = lastN[i + 1];
    let arrow = '';
    if(prev && prev.cost != null && r.cost != null && prev.cost !== r.cost){
      arrow = r.cost > prev.cost ? ' <b class="up">▲</b>' : ' <b class="down">▼</b>';
    }
    return '<div class="cost-hist-row"><span>' + invEsc(r.date || '—') + (r.supplier ? ' · ' + invEsc(r.supplier) : '') + '</span><span>' + fmt(r.cost) + arrow + '</span></div>';
  }).join('');
  return '<div class="cost-hist"><div class="cost-hist-title">📈 Histórico de compra (últimas ' + lastN.length + ')</div>' + lines + '</div>';
}
function renderProductCostHistory(productId){
  const box = document.getElementById('editProdHistory');
  if(!box) return;
  box.innerHTML = productCostHistoryHtml(productId, 5);
}

function closeEditProductModal(){
  editProductOverlay.classList.remove('show');
  editingProductId = null;
}

// Cuando se cambia el nombre, el precio o el tamaño de un producto, también se actualiza en las
// mesas abiertas (cada mesa guarda una copia del producto al agregarlo). Las cuentas ya cerradas
// (historial y facturas) NO cambian. Los productos viejos sin enlace se reconocen por su nombre anterior.
// Cambios de nombre: data.renombres guarda { nombre viejo (normalizado) → nombre actual }. Las
// estadísticas, "lo más vendido", ORDEVA y el orden de la carta agrupan con el nombre vigente, así
// las ventas de antes y de después del cambio se suman juntas. Las facturas ya hechas no cambian.
function nombreVigente(n){
  const r = data && data.renombres; if(!r || !n) return n;
  let x = n, k = 0;
  while(k++ < 10){ const nx = r[String(x).trim().toLowerCase()]; if(!nx || nx === x) break; x = nx; }
  return x;
}
function registrarRenombre(viejo, nuevo){
  if(!viejo || !nuevo || viejo === nuevo) return;
  data.renombres = data.renombres || {};
  data.renombres[String(viejo).trim().toLowerCase()] = nuevo;
  delete data.renombres[String(nuevo).trim().toLowerCase()];     // el nombre nuevo es el vigente (sin ciclos)
}
// Después de editar un producto: todo lo que se ve en pantalla (y la carta de los clientes) al día.
function refrescarTodoEnVivo(){
  try{ renderAll(); }catch(e){}
  const act = document.querySelector('nav button.active'), v = act && act.dataset.view;
  try{ if(v === 'estadisticas') renderStats(); if(v === 'cocina') renderCocina(); if(v === 'carta') renderCarta(); if(v === 'historial') renderHistorial(); if(v === 'contabilidad' && typeof renderConta === 'function') renderConta(); }catch(e){}
  try{ if(typeof window.vitoPublicarCatalogo === 'function') window.vitoPublicarCatalogo(true); }catch(e){}
}
function sincronizarProductoEnMesas(p, nombreAnterior){
  if(!p || !data || !data.tables) return 0;
  const viejo = String(nombreAnterior || '').trim().toLowerCase();
  let mesas = 0;
  Object.keys(data.tables).forEach(k => {
    const t = data.tables[k]; let cambio = false;
    (t.items || []).forEach(it => {
      const es = it.productId ? it.productId === p.id : (viejo && String(it.name || '').trim().toLowerCase() === viejo);
      if(!es) return;
      if(it.name !== p.name || it.price !== p.price || (it.size || '') !== (p.size || '')){
        it.name = p.name; it.price = p.price; it.size = p.size || ''; if(!it.productId) it.productId = p.id; cambio = true;
      }
    });
    if(cambio) mesas++;
  });
  if(mesas){
    try{ renderMesas(); }catch(e){}
    try{ if(currentTable != null){ renderModalItems(); renderPeople(); } }catch(e){}
  }
  return mesas;
}
function avisoMesasActualizadas(n){ return n ? ' Actualizado también en ' + (n === 1 ? '1 mesa abierta' : n + ' mesas abiertas') + '.' : ''; }

function saveEditedProduct(){
  const p = data.products.find(x=>x.id === editingProductId);
  if(!p) return;
  const nombreAntes = p.name;
  const name = document.getElementById('editProdName').value.trim();
  const price = parseFloat(document.getElementById('editProdPrice').value);
  const size = document.getElementById('editProdSize').value.trim();
  const categoryId = document.getElementById('editProdCategory').value || null;
  if(!name || isNaN(price) || price < 0){
    showToast('Escribe un nombre y un precio válido.');
    return;
  }
  const other = data.products.find(x => x.id !== p.id && dupKey(x) === dupKey({ name, size }));
  if(other){ showToast('Ya existe "' + other.name + '". Usa "Unir repetidos" en Inventario.'); return; }
  p.name = name;
  p.price = price;
  p.size = size;
  p.specifications = document.getElementById('editProdSpecs').value.trim();
  const det = leerCamposProducto(); if(det) p.det = det; else delete p.det;
  p.categoryId = categoryId;
  // Código: queda como código del producto y entre sus códigos de barras (así se reconoce al escanearlo).
  const codEl = document.getElementById('editProdCodigo');
  if(codEl){
    const v = codEl.value.trim().slice(0, 40), viejo = p.codigo || '';
    if(viejo && viejo !== v && Array.isArray(p.barcodes)) p.barcodes = p.barcodes.filter(b => b !== viejo);
    if(v){ p.codigo = v; p.barcodes = p.barcodes || []; if(!p.barcodes.includes(v)) p.barcodes.push(v); } else delete p.codigo;
  }
  p.stock = invNum(document.getElementById('editProdStock').value);
  p.minStock = invNum(document.getElementById('editProdMin').value);
  p.cost = invNum(document.getElementById('editProdCost').value);
  const ivaTxt = (document.getElementById('editProdIva').value || '').trim();
  if(ivaTxt === '') delete p.iva; else p.iva = Math.max(0, Math.min(50, Number(ivaTxt) || 0));
  if(typeof prodFotoModalGuardar === 'function') prodFotoModalGuardar(p);
  const nMesas = sincronizarProductoEnMesas(p, nombreAntes);
  registrarRenombre(nombreAntes, p.name);
  saveData();
  closeEditProductModal();
  renderProductos();
  refrescarTodoEnVivo();
  showToast('✅ Producto actualizado.' + avisoMesasActualizadas(nMesas), nMesas ? 4500 : undefined);
}

document.getElementById('prodBuscar').addEventListener('input', () => renderProductos());
document.getElementById('editProdCancelBtn').addEventListener('click', closeEditProductModal);
document.getElementById('editProdSaveBtn').addEventListener('click', saveEditedProduct);
document.getElementById('editProdCodigoScan').addEventListener('click', () => {
  openScanOverlay(raw => { const v = String(raw || '').trim().slice(0, 40); if(!v) return; document.getElementById('editProdCodigo').value = v; closeScanOverlay(); showToast('🔢 Código leído: ' + v + '. Toca «Guardar cambios».'); },
    { hint: 'Apunta al código de barras del producto.' });
});
editProductOverlay.addEventListener('click', (e)=>{ if(e.target === editProductOverlay) closeEditProductModal(); });

/* ---------- Compartir por WhatsApp ---------- */
function methodLabelShort(m){ return methodLabelHist[m] || m; }

function buildReceiptText({businessName, tableLabel, dateStr, items, payments, total, debt, invoiceNo, nit, bizAddress, ivaResponsable, ivaRate, dianResolucionText, pendiente, dian}){
  const lines = [];
  lines.push(`*${businessName}*`);
  if(nit) lines.push(`NIT/CC: ${nit}`);
  if(bizAddress) lines.push(bizAddress);
  lines.push(tableLabel);
  lines.push(dateStr);
  if(invoiceNo) lines.push(`Factura de venta N.º ${invoiceNo}`);
  if(dianResolucionText) lines.push(dianResolucionText);
  lines.push('');
  lines.push('*Productos:*');
  (items||[]).forEach(it=> lines.push(`${it.qty} x ${it.name}${it.size ? ' (' + it.size + ')' : ''}${it.person ? ' — ' + it.person : ''} - ${fmt(it.price*it.qty)}`));
  lines.push('');
  if(ivaResponsable){
    const b = ivaBreakdown(total, ivaRate);
    lines.push(`Subtotal: ${fmt(b.base)}`);
    lines.push(`IVA (${ivaRate}%): ${fmt(b.iva)}`);
  } else {
    lines.push('No responsable de IVA');
  }
  lines.push(`Total: ${fmt(total)}`);
  if(payments && payments.length){
    lines.push('');
    lines.push('*Pagos:*');
    payments.forEach(p=> lines.push(`${p.note ? p.note + ': ' : ''}${fmt(p.amount)} (${methodLabelShort(p.method)})`));
  }
  if(debt > 0){
    lines.push('');
    lines.push(`⚠️ Queda debiendo: ${fmt(debt)}`);
  }
  { const qp = receiptQrPago(pendiente); if(qp) lines.push('', '💳 ' + qp.titulo.replace(' con este QR', '') + (qp.llave ? ' a la llave ' + qp.llave : ' con el QR del negocio')); }
  if(dian && window.ventoDian){ lines.push('', window.ventoDian.reciboTexto(dian)); if(dian.qr) lines.push('Consulta en la DIAN: ' + dian.qr); }
  return lines.join('\n');
}

function whatsappShareText(text){
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// QR de pago del negocio (un solo QR, ej. Bre-B) en la factura cuando todavía falta plata.
function receiptQrPago(pendiente){
  const q = data.qrPago; if(!q || !(pendiente > 0)) return null;
  return { src: q.orig || q.img, titulo: 'Paga ' + fmt(pendiente) + ' con este QR' + (q.tipo ? ' (' + q.tipo + ')' : ''), llave: q.llave || '' };
}
function buildReceiptHTML({businessName, tableLabel, dateStr, items, payments, total, debt, invoiceNo, nit, bizAddress, ivaResponsable, ivaRate, dianResolucionText, pendiente, dian}){
  const qp = receiptQrPago(pendiente);
  const itemsHtml = (items||[]).map(it=>`<div class="r-line"><span>${it.qty} x ${it.name}${it.size ? ' (' + it.size + ')' : ''}${it.person ? ' — ' + it.person : ''}</span><span>${fmt(it.price*it.qty)}</span></div>`).join('') || '<div class="r-line"><span>Sin productos</span><span></span></div>';
  const paymentsHtml = (payments||[]).map(p=>`<div class="r-line"><span>${p.note || 'Pago'} (${methodLabelShort(p.method)})</span><span>${fmt(p.amount)}</span></div>`).join('') || '<div class="r-line"><span>Sin pagos registrados</span><span></span></div>';
  const debtHtml = debt > 0 ? `<div class="r-line r-debt"><span>Queda debiendo</span><span>${fmt(debt)}</span></div>` : '';
  const bizLineHtml = [nit ? 'NIT/CC: ' + invEsc(nit) : '', bizAddress ? invEsc(bizAddress) : ''].filter(Boolean).join(' · ');
  const invoiceLineHtml = [invoiceNo ? 'Factura de venta N.º ' + invEsc(invoiceNo) : '', dianResolucionText ? invEsc(dianResolucionText) : ''].filter(Boolean).join(' · ');
  const ivaHtml = ivaResponsable
    ? (() => { const b = ivaBreakdown(total, ivaRate); return `<div class="r-line"><span>Subtotal</span><span>${fmt(b.base)}</span></div><div class="r-line"><span>IVA (${ivaRate}%)</span><span>${fmt(b.iva)}</span></div>`; })()
    : '<div class="r-line"><span>No responsable de IVA</span><span></span></div>';
  return `
    <h3>${businessName}</h3>
    ${bizLineHtml ? `<div class="r-sub">${bizLineHtml}</div>` : ''}
    <div class="r-sub">${tableLabel} · ${dateStr}</div>
    ${invoiceLineHtml ? `<div class="r-sub">${invoiceLineHtml}</div>` : ''}
    <div class="r-section">Productos</div>
    ${itemsHtml}
    ${ivaHtml}
    <div class="r-section">Pagos</div>
    ${paymentsHtml}
    ${debtHtml}
    <div class="r-total"><span>Total</span><span>${fmt(total)}</span></div>
    ${qp ? `<div style="text-align:center;margin-top:14px"><div style="font-weight:700;margin-bottom:6px">${invEsc(qp.titulo)}</div><img src="${qp.src}" alt="QR de pago" style="width:170px;height:auto;image-rendering:pixelated">${qp.llave ? `<div style="font-size:12px;margin-top:4px">Llave: ${invEsc(qp.llave)}</div>` : ''}</div>` : ''}
    ${dian && window.ventoDian ? window.ventoDian.reciboHTML(dian) : ''}
  `;
}

async function shareReceiptImage(receiptData){
  const el = document.getElementById('receiptTemplate');
  el.innerHTML = buildReceiptHTML(receiptData);
  try{
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    canvas.toBlob(async (blob)=>{
      if(!blob){ showToast('No se pudo generar la imagen.'); return; }
      const file = new File([blob], 'factura.png', { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], title: 'Factura', text: receiptData.tableLabel });
          return;
        }catch(e){ /* cancelado, sigue al respaldo de descarga */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'factura-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Se descargó la imagen. Ábrela y envíala por WhatsApp.');
    }, 'image/png');
  }catch(e){
    showToast('No se pudo generar la captura.');
  }
}

function currentTableReceiptData(){
  const t = data.tables[currentTable];
  return {
    businessName: data.businessName,
    tableLabel: tableLabel(currentTable),
    dateStr: new Date().toLocaleString('es-CO'),
    items: (t.items||[]).map(it=>({name:it.name, qty:it.qty, price:it.price, person: personLookupName(t, it.personId)})),
    payments: (t.payments||[]).map(p=>({note:p.note, amount:p.amount, method:p.method||'efectivo'})),
    total: tableTotal(currentTable),
    debt: tableDebt(currentTable),
    pendiente: tableBalance(currentTable),
    // Vista previa: éste es el número que se le asignaría si se cierra ahora
    // (no se consume hasta que la cuenta se cierra de verdad).
    invoiceNo: (data.invoicePrefix || 'FV') + '-' + numFactura(data.invoiceNextNo || 1),
    nit: data.nit || '',
    bizAddress: data.bizAddress || '',
    ivaResponsable: !!data.ivaResponsable,
    ivaRate: data.ivaRate || 19,
    dianResolucionText: data.dianResolucionText || ''
  };
}

document.getElementById('shareTextBtn').addEventListener('click', ()=>{
  whatsappShareText(buildReceiptText(currentTableReceiptData()));
});

document.getElementById('shareImageBtn').addEventListener('click', ()=>{
  shareReceiptImage(currentTableReceiptData());
});

function printReceipt(receiptData){
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument; d.open();
  const bizLine = [receiptData.nit ? 'NIT/CC: ' + invEsc(receiptData.nit) : '', receiptData.bizAddress ? invEsc(receiptData.bizAddress) : ''].filter(Boolean).join(' · ');
  const invoiceLine = [receiptData.invoiceNo ? 'Factura de venta N.º ' + invEsc(receiptData.invoiceNo) : '', receiptData.dianResolucionText ? invEsc(receiptData.dianResolucionText) : ''].filter(Boolean).join('<br>');
  const ivaLine = receiptData.ivaResponsable
    ? (() => { const b = ivaBreakdown(receiptData.total, receiptData.ivaRate); return '<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>' + fmt(b.base) + '</span></div><div style="display:flex;justify-content:space-between"><span>IVA (' + receiptData.ivaRate + '%)</span><span>' + fmt(b.iva) + '</span></div>'; })()
    : '<div style="display:flex;justify-content:space-between"><span>No responsable de IVA</span><span></span></div>';
  d.write('<title>Recibo</title><body style="font-family:monospace;max-width:320px;margin:16px auto;font-size:13px">' +
    '<h2 style="text-align:center;margin:0 0 4px">' + invEsc(receiptData.businessName) + '</h2>' +
    (bizLine ? '<div style="text-align:center;font-size:11px">' + bizLine + '</div>' : '') +
    '<div style="text-align:center;margin-bottom:10px">' + invEsc(receiptData.tableLabel) + '<br>' + invEsc(receiptData.dateStr) + (invoiceLine ? '<br>' + invoiceLine : '') + '</div>' +
    '<hr>' +
    (receiptData.items||[]).map(it=>'<div style="display:flex;justify-content:space-between"><span>' + it.qty + ' x ' + invEsc(it.name) + (it.person ? ' (' + invEsc(it.person) + ')' : '') + '</span><span>' + fmt(it.price*it.qty) + '</span></div>').join('') +
    '<hr>' +
    ivaLine +
    '<div style="display:flex;justify-content:space-between;font-weight:bold"><span>Total</span><span>' + fmt(receiptData.total) + '</span></div>' +
    (receiptData.payments && receiptData.payments.length ? '<div style="margin-top:8px"><b>Pagos:</b>' + receiptData.payments.map(p=>'<div style="display:flex;justify-content:space-between"><span>' + invEsc(p.note || 'Pago') + '</span><span>' + fmt(p.amount) + '</span></div>').join('') + '</div>' : '') +
    (receiptData.debt > 0 ? '<div style="margin-top:8px;font-weight:bold">⚠️ Queda debiendo: ' + fmt(receiptData.debt) + '</div>' : '') +
    ((qp => qp ? '<div style="text-align:center;margin-top:14px"><b>' + invEsc(qp.titulo) + '</b><br><img src="' + qp.src + '" style="width:170px;margin-top:6px">' + (qp.llave ? '<div style="font-size:12px">Llave: ' + invEsc(qp.llave) + '</div>' : '') + '</div>' : '')(receiptQrPago(receiptData.pendiente))) +
    (receiptData.dian && window.ventoDian ? window.ventoDian.reciboHTML(receiptData.dian, 140) : '') +
    '</body>');
  d.close();
  setTimeout(()=>{ f.contentWindow.focus(); f.contentWindow.print(); setTimeout(()=> f.remove(), 2000); }, 300);
}
document.getElementById('printReceiptBtn').addEventListener('click', ()=>{
  printReceipt(currentTableReceiptData());
});

/* ---------- Historial ---------- */
const methodLabelHist = { efectivo: 'Efectivo', transferencia: 'Transferencia', debe: 'Debe' };

/* Historial por páginas. Antes se dibujaban TODAS las cuentas de una vez (con 3.000 cuentas,
   unos meses de un bar, la app se congelaba casi 2 segundos al abrir el historial, al hacer el
   cierre de caja o al marcar una deuda pagada). Ahora se dibujan de a HIST_PAGINA y se pueden
   ver más. El filtro (Deben / Pagaron) se aplica ANTES de paginar, para que una deuda vieja
   nunca quede escondida al filtrar por «Deben». */
const HIST_PAGINA = 60;
let histMostrar = HIST_PAGINA;
const histFmtFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const histFmtHora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });
function histFiltroActual(){ const b = document.querySelector('#histFilter button.on'); return (b && b.dataset.f) || 'todos'; }
function histFila(h, idx){
  const d = new Date(h.date);
  const dateStr = histFmtFecha.format(d) + ' · ' + histFmtHora.format(d);
  const items = h.items || [];
  const payments = h.payments || [];
  const debt = h.debt || 0;
  const itemsHtml = items.map(it=>`
      <div class="hist-detail-line"><span>${it.name}${it.person ? ' — ' + it.person : ''} ×${it.qty}</span><span>${fmt(it.price*it.qty)}</span></div>
    `).join('') || '<div class="hist-detail-line"><span>Sin productos registrados</span><span></span></div>';
  const paymentsHtml = payments.map(p=>`
      <div class="hist-detail-line"><span>${p.note || 'Pago'} <span class="pay-method ${p.method}">${methodLabelHist[p.method] || p.method}</span>${payItemsHtml(p)}</span><span>${fmt(p.amount)}</span></div>
    `).join('') || '<div class="hist-detail-line"><span>Sin pagos registrados</span><span></span></div>';
  const debtHtml = debt > 0 ? `<div class="hist-detail-line"><span class="hist-debt-flag">Queda debiendo</span><span class="hist-debt-flag">${fmt(debt)}</span></div>` : '';
  const row = document.createElement('div');
  row.className = 'hist-row';
  row.dataset.idx = idx;
  row.innerHTML = `
      <div class="hist-row-top">
        <div class="hist-left">
          <div class="hist-table">${h.tableName || (i18nPut(espacioN()) + ' ' + h.table)}${h.person ? ' — ' + h.person : ''}${debt > 0 ? ' · <span class="hist-debt-flag">DEBE</span>' : ''}${h.corregida ? ' · ✏️ corregida' : ''}</div>
          <div class="hist-date">${dateStr}</div>
        </div>
        <div class="hist-total">${fmt(h.total)}</div>
      </div>
      <div class="hist-detail">
        <div class="hist-detail-title">Productos vendidos</div>
        ${itemsHtml}
        <div class="hist-detail-title">Pagos</div>
        ${paymentsHtml}
        ${debtHtml}
        ${window.ventoDian ? window.ventoDian.bloqueHistorial(h) : ''}
        <div class="hist-share-row">
          <button class="hist-share-image" data-idx="${idx}">🖼️ Enviar captura por WhatsApp</button>
        </div>
        <div class="hist-fix-row">
          <button type="button" class="hist-fix" data-fix="corregir" data-id="${String(h.id).replace(/"/g, '')}">✏️ Corregir</button>
          ${window.ventoInventario ? `<button type="button" class="hist-fix" data-fix="devolver" data-id="${String(h.id).replace(/"/g, '')}">↩️ Devolución</button>` : ''}
          ${h.table != null && data.tables && data.tables[h.table] ? `<button type="button" class="hist-fix" data-fix="liberar" data-id="${String(h.id).replace(/"/g, '')}">🔓 Liberar</button>` : ''}
          <button type="button" class="hist-fix peligro" data-fix="borrar" data-id="${String(h.id).replace(/"/g, '')}">🗑️ Borrar</button>
        </div>
      </div>
    `;
  return row;
}
function histReceiptData(h){
  return {
    businessName: h.businessName || data.businessName,
    tableLabel: (h.tableName || (i18nPut(espacioN()) + ' ' + h.table)) + (h.person ? ' — ' + h.person : ''),
    dateStr: new Date(h.date).toLocaleString('es-CO'),
    items: h.items || [],
    payments: h.payments || [],
    total: h.total,
    debt: h.debt || 0,
    // Cuentas cerradas antes de esta versión no tienen estos campos
    // guardados — en ese caso, simplemente no aparecen en la factura.
    invoiceNo: h.dian ? '' : (h.invoiceNo || ''),   // con documento DIAN, el número que vale es el de la DIAN
    nit: h.nit || '',
    bizAddress: h.bizAddress || '',
    ivaResponsable: !!h.ivaResponsable,
    ivaRate: h.ivaRate || 19,
    dianResolucionText: h.dianResolucionText || '',
    dian: h.dian || null
  };
}
function renderHistorial(masPagina){
  const list = document.getElementById('histList');
  const summary = document.getElementById('histSummary');
  let totalSum = 0, debtSum = 0;
  for(const h of data.history){ totalSum += h.total; debtSum += (h.debt || 0); }
  summary.innerHTML = `
    <div class="hist-stat"><div class="n">${data.history.length}</div><div class="l">Cuentas cerradas</div></div>
    <div class="hist-stat"><div class="n">${fmt(totalSum)}</div><div class="l">Total vendido</div></div>
    <div class="hist-stat"><div class="n hist-debt-flag">${fmt(debtSum)}</div><div class="l">Total en deudas</div></div>
  `;
  // Un solo manejador para los botones de todas las filas (también las de «ver más»).
  if(!list.dataset.delegado){
    list.dataset.delegado = '1';
    list.addEventListener('click', (e)=>{
      const btn = e.target.closest('.hist-share-text, .hist-share-image');
      if(btn){
        e.stopPropagation();
        const h = data.history[parseInt(btn.dataset.idx,10)];
        if(!h) return;
        if(btn.classList.contains('hist-share-text')) whatsappShareText(buildReceiptText(histReceiptData(h)));
        else shareReceiptImage(histReceiptData(h));
        return;
      }
      const fx = e.target.closest('.hist-fix');
      if(fx){ e.stopPropagation(); try{ window.ventoVentaFix && window.ventoVentaFix(fx.dataset.fix, fx.dataset.id); }catch(x){} return; }
      const mas = e.target.closest('.hist-mas');
      if(mas){ e.stopPropagation(); histMostrar += HIST_PAGINA; renderHistorial(true); return; }
      const row = e.target.closest('.hist-row');
      if(row && e.target.closest('.hist-row-top, .hist-detail') && !e.target.closest('button')) row.classList.toggle('expanded');
    });
  }
  if(!masPagina) histMostrar = HIST_PAGINA;
  list.innerHTML = '';
  if(data.history.length === 0){
    list.innerHTML = '<div class="empty-state">Todavía no has cerrado ninguna cuenta.</div>';
    renderClosures();
    return;
  }
  const f = histFiltroActual();
  const idxs = [];
  // Equipo sin permiso de historial completo: solo las ventas de hoy (para revisar o corregir), sin totales.
  let soloHoy = false; try{ soloHoy = !!(window.ventoRoles && window.ventoRoles.soloHoy()); }catch(e){}
  const hoy = new Date().toDateString();
  data.history.forEach((h, idx) => { const debe = (h.debt || 0) > 0; if(soloHoy && new Date(h.date).toDateString() !== hoy) return; if(f === 'todos' || (f === 'deben' && debe) || (f === 'pagaron' && !debe)) idxs.push(idx); });
  const frag = document.createDocumentFragment();
  idxs.slice(0, histMostrar).forEach(idx => frag.appendChild(histFila(data.history[idx], idx)));
  if(!idxs.length){
    const v = document.createElement('div'); v.className = 'empty-state';
    v.textContent = soloHoy && f === 'todos' ? 'Hoy todavía no hay ventas.' : f === 'deben' ? 'Nadie te debe. 🎉' : 'No hay cuentas con ese filtro.';
    frag.appendChild(v);
  } else if(idxs.length > histMostrar){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-ghost hist-mas'; b.style.cssText = 'width:100%;margin-top:10px';
    const quedan = idxs.length - histMostrar;
    b.textContent = 'Ver ' + Math.min(HIST_PAGINA, quedan) + ' más (' + quedan + ' ' + (quedan === 1 ? 'cuenta anterior' : 'cuentas anteriores') + ')';
    frag.appendChild(b);
  }
  list.appendChild(frag);
  renderClosures();
}

/* ---------- Cierre de caja del día ---------- */
function computeClosureStats(fromISO, toISO){
  const from = fromISO ? new Date(fromISO) : null;
  const to = new Date(toISO);
  const tickets = data.history.filter(h=>{
    const d = new Date(h.date);
    return (!from || d > from) && d <= to;
  });
  const totalSold = tickets.reduce((s,h)=> s + h.total, 0);
  let totalEfectivo = 0, totalTransferencia = 0, totalDebe = 0;
  tickets.forEach(h=>{
    (h.payments||[]).forEach(p=>{
      if(p.method === 'efectivo') totalEfectivo += p.amount;
      else if(p.method === 'transferencia') totalTransferencia += p.amount;
      else if(p.method === 'debe') totalDebe += p.amount;
    });
  });
  const hourlyMap = {};
  tickets.forEach(h=>{
    const d = new Date(h.date);
    const hourKey = String(d.getHours()).padStart(2,'0') + ':00';
    hourlyMap[hourKey] = (hourlyMap[hourKey]||0) + h.total;
  });
  const hourly = Object.keys(hourlyMap).sort().map(h=>({ hour: h, total: hourlyMap[h] }));
  return { tickets, totalSold, totalEfectivo, totalTransferencia, totalDebe, hourly };
}

// 1.55.0: lo que se le muestra antes de cerrar la caja (ventas desde el último cierre, mesas abiertas y qué pasa).
function cierreResumenTexto(s, openIds, last){
  const L = [];
  const desde = last ? 'desde el último cierre (' + new Date(last.date).toLocaleString('es-CO', { weekday:'short', hour:'numeric', minute:'2-digit' }) + ')' : 'desde el comienzo';
  L.push(s.tickets.length ? 'Ventas ' + desde + ': ' + s.tickets.length + (s.tickets.length === 1 ? ' cuenta' : ' cuentas') + ' por ' + fmt(s.totalSold) + ' (efectivo ' + fmt(s.totalEfectivo) + ').' : 'No hay ventas nuevas ' + desde + '.');
  if(openIds.length){
    const tot = openIds.reduce((a, id) => a + tableTotal(id), 0);
    L.push('Hay ' + openIds.length + (openIds.length === 1 ? ' mesa abierta' : ' mesas abiertas') + ' (Mesa ' + openIds.join(', Mesa ') + ') por ' + fmt(tot) + (openIds.length === 1 ? ': se cierra' : ': se cierran') + ' y lo que no esté pagado queda como «Debe».');
  }
  if(window.ventoTurno && (s.tickets.length || openIds.length || window.ventoTurno.turno())) L.push('Después cuenta el efectivo de la caja (o «Cerrar sin contar»).');
  L.push('Se guarda el resumen del día y la caja empieza de cero.');
  return L.join('\n\n');
}

async function closeCashRegister(opts){
  const auto = !!(opts && opts.auto === true);   // el cierre automático programado no espera a que alguien cuente
  const openIds = getOpenTableIds();
  const lastClosure = (data.closures && data.closures.length) ? data.closures[0] : null;
  const fromISO = lastClosure ? lastClosure.date : null;
  if(!auto){
    // Siempre pregunta antes de cerrar, con lo que se va a cerrar (antes solo preguntaba si había mesas abiertas).
    const pre = computeClosureStats(fromISO, new Date().toISOString());
    if(!pre.tickets.length && !openIds.length && !(window.ventoTurno && window.ventoTurno.turno())){
      showToast('No hay cuentas nuevas para cerrar. La caja ya está al día.');
      return;
    }
    const ok = await showConfirm({ icon: '🔒', title: '¿Cerrar la caja del día?', message: cierreResumenTexto(pre, openIds, lastClosure), confirmText: '🔒 Sí, cerrar caja', cancelText: 'No, todavía no' });
    if(!ok) return;
    if(window.ventoCierreClave && !(await window.ventoCierreClave.pedir())) return;   // 🔑 si el dueño puso clave para cerrar
    openIds.forEach(id => closeTableToHistory(id));
  } else if(openIds.length){
    const ok = confirm('Hay ' + openIds.length + ' mesa(s) con cuentas abiertas (Mesa ' + openIds.join(', Mesa ') + '). Para cerrar el día hay que cerrarlas: lo que no esté abonado quedará registrado como "Debe". ¿Cerrarlas y continuar?');
    if(!ok) return;
    openIds.forEach(id => closeTableToHistory(id));
  }
  const toISO = new Date().toISOString();
  const stats = computeClosureStats(fromISO, toISO);
  // 🧮 Arqueo: contar el efectivo de la caja (base + ventas en efectivo + entradas − salidas). Cancelar = no se cierra.
  let caja = null;
  if(window.ventoTurno && (stats.tickets.length || window.ventoTurno.turno())){
    caja = auto ? window.ventoTurno.sinContar(stats.totalEfectivo) : await window.ventoTurno.arqueo(stats.totalEfectivo);
    if(!caja){ saveData(); renderMesas(); return; }
  }
  if(stats.tickets.length === 0 && !caja){
    saveData();
    renderMesas();
    showToast('No hay cuentas nuevas para cerrar. La caja ya está al día.');
    return;
  }
  const closure = {
    id: Date.now().toString(),
    date: toISO,
    from: fromISO,
    businessName: data.businessName,
    ticketCount: stats.tickets.length,
    totalSold: stats.totalSold,
    totalEfectivo: stats.totalEfectivo,
    totalTransferencia: stats.totalTransferencia,
    totalDebe: stats.totalDebe,
    hourly: stats.hourly,
    caja
  };
  try{ window.ventoTurno && window.ventoTurno.cerrar(caja); }catch(e){}
  if(!data.closures) data.closures = [];
  data.closures.unshift(closure);
  saveData();
  renderMesas();
  renderHistorial();
  openClosureReport(closure);
}
document.getElementById('closeDayBtn').addEventListener('click', () => closeCashRegister());
document.getElementById('closeDayTopBtn').addEventListener('click', () => closeCashRegister());

function closureDateRangeStr(closure){
  const to = new Date(closure.date);
  const toStr = to.toLocaleDateString('es-CO', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
  if(closure.from){
    const from = new Date(closure.from);
    const sameDay = from.toDateString() === to.toDateString();
    const fromTime = from.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    const toTime = to.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    return sameDay ? (toStr + ' · ' + fromTime + ' a ' + toTime) : (from.toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) + ' ' + fromTime + ' — ' + toStr + ' ' + toTime);
  }
  const toTime = to.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
  return toStr + ' · hasta las ' + toTime;
}

function buildClosureText(closure){
  const lines = [];
  lines.push(`*🔒 Cierre de caja — ${closure.businessName || data.businessName}*`);
  lines.push(closureDateRangeStr(closure));
  lines.push('');
  lines.push(`Cuentas cerradas: ${closure.ticketCount}`);
  lines.push(`*Total vendido: ${fmt(closure.totalSold)}*`);
  lines.push('');
  lines.push('*Por método de pago:*');
  lines.push(`Efectivo: ${fmt(closure.totalEfectivo)}`);
  lines.push(`Transferencia: ${fmt(closure.totalTransferencia)}`);
  if(closure.totalDebe > 0) lines.push(`⚠️ Quedó debiendo: ${fmt(closure.totalDebe)}`);
  if(closure.hourly && closure.hourly.length){
    lines.push('');
    lines.push('*Ventas por hora:*');
    closure.hourly.forEach(h=> lines.push(`${h.hour} — ${fmt(h.total)}`));
  }
  if(closure.caja && window.ventoTurno) lines.push(window.ventoTurno.texto(closure.caja));
  lines.push('');
  lines.push('¡Buen cierre! 🍻');
  return lines.join('\n');
}

function buildClosureHTML(closure){
  const hourlyHtml = (closure.hourly||[]).map(h=>`<div class="r-line"><span>${h.hour}</span><span>${fmt(h.total)}</span></div>`).join('') || '<div class="r-line"><span>Sin ventas registradas</span><span></span></div>';
  const debtHtml = closure.totalDebe > 0 ? `<div class="r-line r-debt"><span>Quedó debiendo</span><span>${fmt(closure.totalDebe)}</span></div>` : '';
  return `
    <h3>🔒 Cierre de caja</h3>
    <div class="r-sub">${closure.businessName || data.businessName} · ${closureDateRangeStr(closure)}</div>
    <div class="r-line"><span>Cuentas cerradas</span><span>${closure.ticketCount}</span></div>
    <div class="r-section">Por método de pago</div>
    <div class="r-line"><span>Efectivo</span><span>${fmt(closure.totalEfectivo)}</span></div>
    <div class="r-line"><span>Transferencia</span><span>${fmt(closure.totalTransferencia)}</span></div>
    ${debtHtml}
    <div class="r-section">Ventas por hora</div>
    ${hourlyHtml}
    ${closure.caja && window.ventoTurno ? window.ventoTurno.html(closure.caja, 'r') : ''}
    <div class="r-total"><span>Total vendido</span><span>${fmt(closure.totalSold)}</span></div>
  `;
}

async function shareClosureImage(closure){
  const el = document.getElementById('closureReceiptTemplate');
  el.innerHTML = buildClosureHTML(closure);
  try{
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    canvas.toBlob(async (blob)=>{
      if(!blob){ showToast('No se pudo generar la imagen.'); return; }
      const file = new File([blob], 'cierre-caja.png', { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], title: 'Cierre de caja', text: closure.businessName || data.businessName });
          return;
        }catch(e){ /* cancelado, sigue al respaldo de descarga */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cierre-caja-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Se descargó la imagen. Ábrela y envíala por WhatsApp.');
    }, 'image/png');
  }catch(e){
    showToast('No se pudo generar la captura.');
  }
}

const closureOverlay = document.getElementById('closureOverlay');
let openClosure = null;
function openClosureReport(closure){
  openClosure = closure;
  document.getElementById('closureModalSub').textContent = closureDateRangeStr(closure);
  const body = document.getElementById('closureReportBody');
  const hourlyHtml = (closure.hourly||[]).map(h=>`
    <div class="hist-detail-line"><span>${h.hour}</span><span>${fmt(h.total)}</span></div>
  `).join('') || '<div class="hist-detail-line"><span>Sin ventas registradas</span><span></span></div>';
  body.innerHTML = `
    <div class="total-row sub">
      <span class="label">Cuentas cerradas</span>
      <span class="amount">${closure.ticketCount}</span>
    </div>
    <div class="total-row sub">
      <span class="label">Efectivo</span>
      <span class="amount paid">${fmt(closure.totalEfectivo)}</span>
    </div>
    <div class="total-row sub">
      <span class="label">Transferencia</span>
      <span class="amount paid">${fmt(closure.totalTransferencia)}</span>
    </div>
    ${closure.totalDebe > 0 ? `<div class="total-row sub"><span class="label">Quedó debiendo</span><span class="amount hist-debt-flag">${fmt(closure.totalDebe)}</span></div>` : ''}
    <div class="hist-detail-title">Ventas por hora</div>
    ${hourlyHtml}
    ${closure.caja && window.ventoTurno ? window.ventoTurno.html(closure.caja) : ''}
    <div class="total-row">
      <span class="label">Total vendido</span>
      <span class="amount">${fmt(closure.totalSold)}</span>
    </div>
  `;
  closureOverlay.classList.add('show');
}
document.getElementById('closureModalOkBtn').addEventListener('click', ()=>{ closureOverlay.classList.remove('show'); openClosure = null; });
closureOverlay.addEventListener('click', (e)=>{ if(e.target === closureOverlay){ closureOverlay.classList.remove('show'); openClosure = null; } });
document.getElementById('closureShareTextBtn').addEventListener('click', ()=>{ if(openClosure) whatsappShareText(buildClosureText(openClosure)); });
document.getElementById('closureShareImageBtn').addEventListener('click', ()=>{ if(openClosure) shareClosureImage(openClosure); });

function renderClosures(){
  const title = document.getElementById('closuresTitle');
  const list = document.getElementById('closuresList');
  list.innerHTML = '';
  if(!data.closures || data.closures.length === 0){
    title.style.display = 'none';
    return;
  }
  title.style.display = 'block';
  data.closures.forEach((c, idx)=>{
    const hourlyHtml = (c.hourly||[]).map(h=>`
      <div class="hist-detail-line"><span>${h.hour}</span><span>${fmt(h.total)}</span></div>
    `).join('') || '<div class="hist-detail-line"><span>Sin ventas registradas</span><span></span></div>';
    const debtHtml = c.totalDebe > 0 ? `<div class="hist-detail-line"><span class="hist-debt-flag">Quedó debiendo</span><span class="hist-debt-flag">${fmt(c.totalDebe)}</span></div>` : '';
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `
      <div class="hist-row-top">
        <div class="hist-left">
          <div class="hist-table"><span class="closure-emoji">🔒</span>Cierre de caja${c.ticketCount ? ' · ' + c.ticketCount + (c.ticketCount===1?' cuenta':' cuentas') : ''}</div>
          <div class="hist-date">${closureDateRangeStr(c)}</div>
        </div>
        <div class="hist-total">${fmt(c.totalSold)}</div>
      </div>
      <div class="hist-detail">
        <div class="hist-detail-line"><span>Efectivo</span><span>${fmt(c.totalEfectivo)}</span></div>
        <div class="hist-detail-line"><span>Transferencia</span><span>${fmt(c.totalTransferencia)}</span></div>
        ${debtHtml}
        <div class="hist-detail-title">Ventas por hora</div>
        ${hourlyHtml}
        <div class="hist-share-row">
          <button class="closure-share-text" data-idx="${idx}">📤 Resumen</button>
          <button class="closure-share-image" data-idx="${idx}">🖼️ Captura</button>
        </div>
      </div>
    `;
    row.addEventListener('click', ()=> row.classList.toggle('expanded'));
    list.appendChild(row);
  });
  list.querySelectorAll('.closure-share-text').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      whatsappShareText(buildClosureText(data.closures[parseInt(btn.dataset.idx,10)]));
    });
  });
  list.querySelectorAll('.closure-share-image').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      shareClosureImage(data.closures[parseInt(btn.dataset.idx,10)]);
    });
  });
}

/* ---------- Borrar historial por día ---------- */
const deleteHistoryOverlay = document.getElementById('deleteHistoryOverlay');

function dayKey(dateStr){
  const d = new Date(dateStr);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function groupHistoryByDay(){
  const map = {};
  (data.history||[]).forEach(h=>{
    const key = dayKey(h.date);
    if(!map[key]) map[key] = { key, date: h.date, count:0, total:0, debt:0 };
    map[key].count++;
    map[key].total += h.total;
    map[key].debt += (h.debt||0);
  });
  return Object.values(map).sort((a,b)=> b.key.localeCompare(a.key));
}

function renderDeleteHistoryDays(){
  const list = document.getElementById('deleteHistoryDaysList');
  const days = groupHistoryByDay();
  if(days.length === 0){
    list.innerHTML = '<div class="empty-state">Todavía no hay historial guardado para borrar.</div>';
    return;
  }
  list.innerHTML = days.map(d=>{
    const dateStr = new Date(d.date).toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric'});
    return `
      <div class="settings-row">
        <div class="settings-row-text">
          <strong>${dateStr}</strong>
          <span>${d.count} cuenta${d.count===1?'':'s'} cerrada${d.count===1?'':'s'} · ${fmt(d.total)}${d.debt>0 ? ' · Debía ' + fmt(d.debt) : ''}</span>
        </div>
        <button class="btn-danger-outline" data-key="${d.key}">🗑️ Borrar</button>
      </div>
    `;
  }).join('');
  list.querySelectorAll('button[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteHistoryDay(btn.dataset.key));
  });
}

async function deleteHistoryDay(key){
  const days = groupHistoryByDay();
  const day = days.find(d=>d.key === key);
  if(!day) return;
  const dateStr = new Date(day.date).toLocaleDateString('es-CO', {day:'2-digit', month:'long', year:'numeric'});
  const ok = await showConfirm({
    title: '¿Borrar el historial del ' + dateStr + '?',
    message: '⚠️ Vas a borrar ' + day.count + ' cuenta' + (day.count===1?'':'s') + ' cerrada' + (day.count===1?'':'s') + ' (' + fmt(day.total) + ') y los cierres de caja de ese día. Esta acción no se puede deshacer. Verifica bien la fecha antes de confirmar.',
    confirmText: 'Sí, borrar ese día',
    cancelText: 'Cancelar',
    icon: '🗑️'
  });
  if(!ok) return;
  data.history = (data.history||[]).filter(h=> dayKey(h.date) !== key);
  if(data.closures) data.closures = data.closures.filter(c=> dayKey(c.date) !== key);
  await saveData();
  renderHistorial();
  renderDeleteHistoryDays();
  showToast('Historial del ' + dateStr + ' borrado.');
}

function openDeleteHistory(){
  renderDeleteHistoryDays();
  deleteHistoryOverlay.classList.add('show');
}
function closeDeleteHistory(){
  deleteHistoryOverlay.classList.remove('show');
}
document.getElementById('deleteHistoryDayBtn').addEventListener('click', openDeleteHistory);
document.getElementById('deleteHistoryCloseBtn').addEventListener('click', closeDeleteHistory);
deleteHistoryOverlay.addEventListener('click', (e)=>{ if(e.target === deleteHistoryOverlay) closeDeleteHistory(); });

/* ---------- Init ---------- */
/* ---------- Ajustes: Restablecer ---------- */
async function resetDay(){
  const ok = await showConfirm({
    title: '¿Restablecer el día?',
    message: 'Se vaciarán todas las mesas. Las cuentas abiertas se guardan en el historial: lo que no se ha pagado queda como deuda (fiado), para que no se pierda.',
    confirmText: 'Sí, restablecer día',
    icon: '🔄'
  });
  if(!ok) return;
  let guardadas = 0;
  Object.keys(data.tables).forEach(id=>{
    if(closeTableToHistory(Number(id))) guardadas++;   // cuenta abierta → historial (lo no pagado queda como deuda)
    data.tables[id].items = [];
    data.tables[id].people = [];
    data.tables[id].payments = [];
  });
  await saveData();
  renderAll();
  renderHistorial();
  showToast('Día restablecido. ' + (guardadas ? guardadas + (guardadas === 1 ? ' cuenta abierta quedó' : ' cuentas abiertas quedaron') + ' en el historial (lo no pagado, como deuda).' : 'Todas las mesas quedaron vacías.'), 6000);
}

async function resetAll(){
  if(!authIsAdmin()){ showToast('🔒 Solo el usuario administrador puede restablecer todo el negocio.'); return; }
  const ok = await showConfirm({
    title: '¿Restablecer TODO?',
    message: 'Esto borra mesas, historial, cierres de caja y productos. La app queda como recién instalada. Esta acción no se puede deshacer.',
    confirmText: 'Sí, borrar todo',
    icon: '⚠️'
  });
  if(!ok) return;
  const keepTheme = data.theme;
  data = defaultData();
  Object.keys(localStorage).filter(k => k.startsWith('cm-rcpt-')).forEach(k => localStorage.removeItem(k));
  ventoAlmacen.claves().then(ks => ks.filter(k => /^rcpt\//.test(k)).forEach(k => ventoAlmacen.del(k).catch(() => {}))).catch(() => {});
  if(keepTheme) data.theme = keepTheme;
  await saveData();
  renderAll();
  renderHistorial();
  applyPalette(data.theme || 'noche');
  showToast('La aplicación fue restablecida por completo.');
}

async function clearAllTableNames(){
  const named = Object.keys(data.tables).filter(id => data.tables[id] && data.tables[id].name && data.tables[id].name.trim());
  if(!named.length){
    showToast('Ninguna mesa tiene un nombre puesto todavía.');
    return;
  }
  const ok = await showConfirm({
    title: '¿Borrar el nombre de todas las mesas?',
    message: 'Las ' + named.length + ' mesa(s) con nombre propio (ej. "Terraza", "VIP") volverán a mostrar solo su número. Las cuentas, personas e historial no se tocan. Esta acción no se puede deshacer.',
    confirmText: 'Sí, borrar nombres',
    icon: '✏️'
  });
  if(!ok) return;
  named.forEach(id => { data.tables[id].name = ''; });
  await saveData();
  renderAll();
  showToast('Se borraron los nombres de ' + named.length + ' mesa(s).');
}

document.getElementById('resetDayBtn').addEventListener('click', resetDay);
document.getElementById('resetAllBtn').addEventListener('click', resetAll);
document.getElementById('clearAllTableNamesBtn').addEventListener('click', clearAllTableNames);

// ---------- Ayuda y soporte: WhatsApp directo ----------
// Antes era un solo botón genérico. Ahora, como Freshdesk o Zendesk, el
// mensaje se organiza solo por tipo y urgencia antes de llegar por WhatsApp
// (que sigue siendo el único canal real que tenemos, pero ya no llega en
// blanco: llega clasificado, para responder más rápido lo urgente).
const SUPPORT_WA_NUMBER = '573138950277';
const SUPPORT_TYPE_LABELS = { falla: '🐛 Algo no funciona', pregunta: '❓ Pregunta', pago: '💳 Problema con un pago o factura', sugerencia: '💡 Idea o sugerencia' };
const SUPPORT_URGENCY_LABELS = { urgente: '🔴 Urgente', normal: '🟡 Normal', baja: '🟢 No urgente' };
document.getElementById('supportWaBtn').addEventListener('click', () => {
  const type = SUPPORT_TYPE_LABELS[document.getElementById('supportType').value];
  const urgency = SUPPORT_URGENCY_LABELS[document.getElementById('supportUrgency').value];
  const detail = document.getElementById('supportMsg').value.trim();
  const lines = [
    'Hola, les escribo desde la app ORDEVA (' + (typeof MESORA_VERSION !== 'undefined' ? MESORA_VERSION : '') + ').',
    'Tipo: ' + type,
    'Urgencia: ' + urgency,
    authUser ? 'Usuario: ' + authUser + (data && data.businessName ? ' · ' + data.businessName : '') : ''
  ];
  if(detail) lines.push('Detalle: ' + detail);
  const msg = lines.filter(Boolean).join('\n');
  window.open('https://wa.me/' + SUPPORT_WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
});

// ---------- Guía de uso con buscador ----------
// Cada negocio ve solo los temas que usa: una floristería no necesita la pantalla de cocina.
function guiaDelNegocio(){
  try{ return GUIDE_ENTRIES.filter(e => !e.mod || usaMod(e.mod)); }catch(err){ return GUIDE_ENTRIES; }
}
const GUIDE_ENTRIES = [
  { title: '🍽️ Abrir y cobrar una mesa', keywords: 'abrir mesa cobrar cuenta cerrar pagar cliente pedido', body: 'Toca una mesa libre para abrirla y empieza a agregar lo que van pidiendo. Cuando el cliente se va, toca "Cobrar", revisa el total y confirma el pago. La mesa vuelve a quedar libre automáticamente.' },
  { mod: 'k', title: '🍳 Pantalla de cocina (KDS)', keywords: 'cocina kds pantalla pedidos barra despachar preparar listo', body: 'La pestaña "Cocina" muestra en tiempo real lo que hay pendiente en cada mesa y los pedidos nuevos que llegan por el QR o WhatsApp, para que cocina o barra los vea sin ir hasta la caja. Toca "Listo" en un ticket para marcarlo atendido, o "Aceptar"/"Rechazar" en un pedido nuevo.' },
  { title: '🧮 Calculadoras rápidas (NIT, descuento, prima, Rete-ICA)', keywords: 'calculadora nit digito verificacion descuento prima bonificacion reteica retencion ica', body: 'En Ajustes → Calculadoras rápidas tienes cuatro herramientas: el dígito de verificación del NIT, un cálculo de descuento, la prima o bonificación proporcional a los días trabajados, y la retención de ICA sobre un pago. No guardan nada, solo calculan al momento.' },
  { title: '📒 La Libreta: fiados, pagos y calculadora por voz', keywords: 'libreta fiados deudas pagar empleados calculadora suma resta multiplicacion voz cuenta corrida corregir', body: 'La Libreta entiende lo que le digas o escribas, al instante, sin necesitar internet. Fiados y pagos: "Juan me debe 20 mil", "Juan me pagó 10 mil", "le fié a Carlos 15 lucas", "¿cuánto me debe Juan?", "¿quién me debe?", "le pagué a Pedro 50 mil" (para empleados), "borra lo último" (deshace el último movimiento). Cuentas de la casa: las mesas que quedan "debiendo" al cobrar aparecen solas en la Libreta con el nombre de quien debe, con su historial de cuándo debió y cuándo pagó. Calculadora suelta (no se guarda): "cuánto es 20 mil más 15 mil", "cuánto vale 45 por 3", "800 entre 4", "calcula 100 más 200 más 300". Calculadora de cuenta corrida (con memoria, para ir sumando varias cosas seguidas): "súmame 13.400", y luego, sin decir "más", otro comando aparte "súmame 15.200" — se van sumando una tras otra. También "réstame 2.000", "cuánto llevo" (dice el total), y para corregir si algo quedó mal, "corrige" o "réstame" sin decir ningún número (quita lo último que se metió y dice cuánto era). "nueva cuenta" la deja en cero para empezar otra. También hay una calculadora con botones grandes tocando "🧮 Calculadora" dentro de la Libreta, para quien prefiera usar el dedo en vez de la voz.' },
  { title: '💬 WhatsApp con IA: recibir y responder pedidos solo', keywords: 'whatsapp business api ia auto responder pedidos puente cloudflare worker webhook meta', body: 'En Ajustes → Negocio y facturación → "WhatsApp con IA" puedes conectar el WhatsApp Business de tu negocio para que ORDEVA reciba los pedidos y la IA los entienda y responda. Necesitas una app de WhatsApp Business en developers.facebook.com (la tramitas tú, con tu número; Meta te da un token de acceso y un número de prueba gratis para empezar) y publicar un "puente" gratis en Cloudflare (los pasos exactos están dentro de esa sección, con un botón para copiar el código). Cuando un cliente escribe, la IA lee el mensaje, saca el nombre, la dirección y los productos, y redacta una respuesta corta y personalizada. Si activas "Responder automáticamente" se envía sola por WhatsApp; si la dejas apagada, revisas cada respuesta y la envías con un toque. El botón "🛵 Armar domicilio" en cada mensaje lo deja listo para facturar, con el nombre y el teléfono ya puestos.' },
  { title: '🏷️ Código de barras / etiquetas de producto', keywords: 'codigo de barras etiqueta imprimir producto qr generar', body: 'En Productos, el botón "🏷️ Imprimir etiquetas" genera una hoja para imprimir con el código o QR y el precio de todos los productos visibles. Arriba puedes elegir si quieres código de barras o QR. El botón 🏷️ junto a cada producto imprime solo la etiqueta de ese producto.' },
  { mod: 'q', title: '💜 Cobrar con Nequi desde el QR de la mesa', keywords: 'nequi pago pasarela cobrar transferencia cuenta', body: 'En Ajustes → Pasarela de pago (Nequi), activa "Aceptar pagos por Nequi" y escribe tu número. Cuando un cliente pida la cuenta desde el QR de su mesa, si queda saldo por pagar, le aparece tu número y el valor exacto para transferir, y un botón "Ya pagué por Nequi" que te avisa. Tú confirmas el pago cuando lo veas llegar — no es un cobro automático. Reimprime los QR de tus mesas después de activarlo para que lleven el número.' },
  { mod: 'd', title: '➗ Dividir la cuenta', keywords: 'dividir cuenta partes personas mitad separar pago', body: 'Al cobrar una mesa puedes dividir el total entre varias personas, en partes iguales o eligiendo qué le corresponde a cada quien, y cobrar cada parte por separado.' },
  { title: '🎖️ Clientes frecuentes', keywords: 'clientes frecuentes fidelizacion fidelidad puntos premio vip whatsapp visitas', body: 'En Ajustes → Clientes frecuentes, actívalo para que al cerrar una cuenta aparezca un campo para anotar el WhatsApp (y el nombre, si quieres) del cliente. La app lleva la cuenta de sus visitas y de cuánto ha gastado, y le va poniendo una insignia (🥉 recurrente, 🥈 frecuente, 🥇 VIP) según cuántas veces vuelve, para que sepas a quién darle una atención especial.' },
  { title: '🎧 Atención al cliente (casos y reclamos)', keywords: 'atencion cliente casos reclamos quejas problemas pedido incorrecto calidad demora domicilio helpdesk soporte interno', body: 'En Ajustes → Pedidos, QR y caja → Atención al cliente puedes anotar cualquier reclamo (pedido incorrecto, calidad, demora, un domicilio que no llegó) con su urgencia. Al escribir qué pasó, la app te sugiere sola la categoría. Se puede asignar a quién lo va a atender, y si el cliente ya está en Clientes frecuentes queda relacionado con él. Cuando lo resuelvas, anota cómo quedó y qué tan satisfecho salió el cliente, para no perder el rastro de ningún caso.' },
  { title: '💸 Marcar una cuenta como deuda (fiado)', keywords: 'deuda fiado fiar debe pagar despues credito cliente', body: 'Si un cliente no paga de una vez, marca la cuenta como deuda en vez de cobrarla. Queda guardada como pendiente hasta que la salde, y puedes verla y cobrarla después.' },
  { title: '➕ Agregar o editar productos', keywords: 'agregar producto editar crear nuevo precio nombre categoria', body: 'En Productos puedes crear un producto nuevo con nombre, precio y categoría, o tocar uno existente para editarlo. Los cambios se reflejan al instante en las mesas.' },
  { title: '🍔 Combos', keywords: 'combo combos paquete varios productos juntos', body: 'Puedes armar combos que agrupan varios productos en una sola opción con su propio precio, para agregarlos más rápido a una mesa.' },
  { title: '📷 Escanear un producto con la cámara', keywords: 'escanear producto camara foto ia inteligencia artificial crear', body: 'Al crear un producto puedes tomarle una foto con la cámara y la app usa inteligencia artificial para sugerirte el nombre, la categoría y el precio, para que no tengas que escribirlo todo a mano.' },
  { title: '📦 Control de stock (existencias)', keywords: 'stock existencias inventario cantidad disponible agotado alerta aviso bajo', body: 'Cada producto puede llevar un control de cuántas unidades tienes disponibles. La cantidad baja sola cuando se vende y puedes ajustarla manualmente cuando repongas mercancía. Si algo se agota o queda bajo, te avisa solo al abrir la app.' },
  { title: '⭐ Accesos rápidos (favoritos)', keywords: 'favoritos rapido rapidos estrella agregar pedidos frecuentes acceso', body: 'En Productos toca la estrella de tus productos más vendidos para marcarlos como favoritos. Aparecen como botones arriba, dentro de cada mesa, para agregarlos con un solo toque sin tener que buscarlos.' },
  { title: '🧾 Escanear factura de proveedor con IA (con internet)', keywords: 'escanear factura proveedor ia internet camara galeria pdf inteligencia artificial', body: 'En Inventario, en "Factura de proveedor · Con IA" puedes tomar una foto, elegir una foto de la galería, o subir un PDF de la factura. La app lee los productos, cantidades y precios de costo automáticamente y te deja revisarlos antes de guardarlos.' },
  { title: '📴 Escanear factura sin internet', keywords: 'escanear factura sin internet offline sin wifi', body: 'Si no tienes internet, puedes escanear la factura igual desde la opción "Sin internet". La app lee el texto de la foto o el PDF directamente en tu equipo, sin necesidad de conexión.' },
  { title: '📊 Ver costos, márgenes y ganancia o pérdida', keywords: 'costo margen ganancia perdida precio compra venta gana pierde historico subio precio proveedor', body: 'En Inventario, cada producto muestra en cuánto te llega (costo) y en cuánto lo vendes, junto con el margen y si estás ganando bien, justo, o perdiendo con ese producto. Más abajo hay una gráfica que compara la ganancia o pérdida de todos tus productos de un vistazo. Al editar un producto también ves el histórico de lo que te ha costado en cada compra, y si escaneas una factura donde un proveedor te subió el precio, te avisa cuáles.' },
  { title: '📈 Estadísticas', keywords: 'estadisticas ventas reportes negocio resumen numeros comparar semana mes anterior', body: 'En Estadísticas puedes ver cómo va tu negocio: ventas, productos más vendidos y otros resúmenes útiles para tomar decisiones. También hay un comparativo de esta semana contra la semana pasada, y de este mes contra el mes pasado.' },
  { title: '🎨 Cambiar la apariencia o el diseño', keywords: 'apariencia diseño tema color cambiar personalizar', body: 'En Ajustes → Apariencia puedes elegir entre varios diseños para que la app se vea como tú quieras. Hay diseños pensados para el negocio y, en "Tu diseño personal", el diseño original Matrix, solo para ti.' },
  { title: '🧩 Modo fácil', keywords: 'modo facil simple sencillo basico', body: 'El modo fácil simplifica la pantalla para que sea más sencillo de usar, ideal si alguien nuevo va a manejar la app.' },
  { title: '💾 Respaldo y transferir datos', keywords: 'respaldo backup transferir datos copia seguridad exportar importar puntos restauracion automatico', body: 'En Ajustes puedes descargar una copia de respaldo de toda tu información (productos, mesas, inventario, ventas) en un archivo, y luego restaurarla en este u otro dispositivo si algo pasa o si cambias de celular. Además, la app va guardando sola un punto de restauración interno cada día (Ajustes → Puntos de restauración), por si algo se daña por accidente y no alcanzaste a respaldar a tiempo.' },
  { title: '🏢 Varias sedes o negocios', keywords: 'sede sedes negocio negocios varios locales separar tienda cerveceria', body: 'Si manejas más de un negocio o local, en Ajustes → Sedes o negocios puedes agregar uno nuevo y cambiar entre ellos. Cada sede tiene sus propias mesas, productos, inventario y ventas, totalmente separados, pero todo desde la misma cuenta.' },
  { title: '🖨️ Imprimir el recibo de una mesa', keywords: 'imprimir recibo factura mesa cobrar papel', body: 'Al cobrar una mesa, junto a "Enviar captura por WhatsApp" hay un botón de "Imprimir recibo" para sacarlo en papel si tienes impresora conectada al celular o computador.' },
  { title: '👤 Agregar un usuario', keywords: 'agregar usuario cuenta nueva empleado crear cuenta', body: 'Puedes crear cuentas adicionales para que otras personas del negocio (empleados) usen la app con su propio usuario y contraseña.' },
  { title: '🔑 Recuperar contraseña', keywords: 'recuperar contraseña olvide clave acceso perdido restaurar', body: 'Si olvidaste tu contraseña, en la pantalla de inicio toca "¿Olvidaste tu contraseña?" para recuperarla por WhatsApp. Si perdiste el acceso por completo (celular nuevo, app reinstalada), usa "Restaura tu copia de respaldo" con el archivo que descargaste antes.' },
  { title: '📋 Carta o menú para clientes (QR)', keywords: 'carta menu qr clientes ver productos mas vendido destacado agotado orden', body: 'Puedes compartir un menú o carta para que tus clientes vean los productos disponibles, por ejemplo con un código QR. Se ve en tarjetas por categoría, con las promociones destacadas arriba de todo, lo más vendido primero, y lo agotado al final para no interrumpir la lectura.' },
  { title: '🌙 Cierre de caja', keywords: 'cierre caja dia cerrar jornada automatico manual resumen', body: 'Al final del día toca «🔒 Cerrar caja del día», arriba en Mesas (también está en Historial y, en el modo fácil, en «Hoy»). Antes de cerrar te pregunta y te muestra las ventas, el efectivo y las mesas abiertas. El cierre también puede ser automático; te resume las ventas del día y deja todo listo para el día siguiente.' },
  { title: '💵 Caja: base, entradas, salidas y arqueo', keywords: 'base caja sencillo abrir caja entrada salida efectivo pagar proveedor arqueo contar billetes monedas sobra falta descuadre', body: 'Historial → «💵 Caja: base, entradas y salidas»: abre la caja con su base, anota lo que entra o sale en efectivo (pago a proveedor, sencillo) y al «Cerrar caja del día» cuenta los billetes y monedas: ORDEVA te dice si sobra o falta.' },
  { title: '🔢 Inventario por código', keywords: 'codigo barras plu sku inventario conteo toma de inventario entrada mercancia llego pedido kardex movimientos escanear lector existencias', body: 'Inventario → «🔢 Inventario por código»: dale código a cada producto, escanea lo que llegó (entrada de mercancía), haz la toma de inventario contando con el lector y mira el kárdex de cada producto.' },
  { title: '💲 Precio por cantidad (mayorista)', keywords: 'precio mayorista al por mayor por cantidad descuento por volumen docena', body: 'Inventario → «🔢 Inventario por código» → consulta el producto → «Precio por cantidad»: por ejemplo, desde 6 unidades a $3.500 cada una. La caja lo cobra sola.' },
  { title: '↩️ Devoluciones', keywords: 'devolucion devolver cliente reembolso producto malo cambio', body: 'En el historial, abre la venta y toca «↩️ Devolución»: eliges qué devuelve, vuelve al inventario, la venta baja y el efectivo sale de la caja. Con facturación electrónica sale la nota crédito.' },
  { title: '🧾 Facturación electrónica DIAN', keywords: 'factura electronica dian cufe cude pos electronico documento equivalente resolucion nota credito', body: 'Ajustes → Negocio → «🧾 Facturación electrónica DIAN»: con tu resolución de numeración, cada venta sale validada por la DIAN con CUDE y código QR. Anular o devolver hace la nota crédito, y el cliente puede pedir factura a su nombre.' },
  { title: '💵 Propina al cobrar', keywords: 'propina redondeo cobrar cliente porcentaje', body: 'Actívala en Ajustes → Propina al cobrar. Cada vez que cobres una mesa, te pregunta si el cliente deja propina (10% o redondear el total) antes de cerrar la cuenta.' },
  { title: '👤 Ventas por empleado (turno)', keywords: 'empleado turno caja quien vendio cuanto', body: 'Si más de una persona maneja la caja con su propio usuario, en Estadísticas aparece cuánto vendió cada empleado en el período que estés viendo, sin que tengas que hacer nada extra.' },
  { title: '🤖 ORDEVA, tu asistente de IA', keywords: 'laya mesi asistente ia inteligencia artificial preguntar chat comandos hablar ayuda', body: 'Toca la carita con "IA" arriba a la derecha (o "Más" → ORDEVA). Puedes escribirle o hablarle. Te responde cuánto vendiste hoy, ayer o en el mes, quién te debe, qué mesas están abiertas, qué se está acabando, el precio o stock de un producto y tus mejores clientes; te lleva a cualquier sección ("abre inventario", "abre la mesa 3") y te explica cómo usar la app. También puede cambiar precios o sumar stock, siempre preguntándote antes. Escríbele "¿Qué sabes hacer?" para ver todo.' },
  { title: '💬 Soporte por WhatsApp', keywords: 'soporte ayuda whatsapp contacto problema falla ticket urgencia', body: 'Si algo no funciona o tienes una duda, en Ajustes → Guía y soporte elige qué tipo de solicitud es y qué tan urgente es, y te escribimos por WhatsApp con el mensaje ya armado y clasificado, para responderte más rápido si es algo urgente.' },
  { title: '🛵 Facturar un domicilio', keywords: 'domicilio domicilios entrega envio direccion cliente restaurante bar', body: 'Actívalo en Ajustes → Domicilios. Aparece un botón "🛵 Domicilio" junto a "Venta rápida" en Mesas: agrega los productos, y si quieres el nombre, teléfono, dirección del cliente y el valor del envío, sin necesidad de abrir una mesa.' },
  { title: '📥 Descargar las ventas en Excel', keywords: 'excel exportar ventas dia mes rango cierre descargar csv contabilidad personalizar', body: 'En Estadísticas, el botón "📥 Exportar ventas (Excel)" te deja elegir el período: hoy, ayer, este mes, un rango de fechas personalizado, o un cierre de caja específico. Descarga un archivo con el detalle de cada producto vendido (mesas, mostrador y domicilios), listo para abrir con Excel.' }
];

function guideMatchScore(entry, q){
  if(!q) return 1;
  const hay = (entry.title + ' ' + entry.keywords + ' ' + entry.body).toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for(const w of words){ if(hay.indexOf(w) !== -1) score++; }
  return score;
}

function renderGuideResults(){
  const inputEl = document.getElementById('guideSearchInput');
  const wrap = document.getElementById('guideResults');
  const detailsEl = document.getElementById('guideResultsWrap');
  const summaryEl = detailsEl ? detailsEl.querySelector('summary') : null;
  if(!inputEl || !wrap) return;
  const q = inputEl.value.trim();
  let list = guiaDelNegocio();
  if(q){
    list = guiaDelNegocio()
      .map(e => ({ e, score: guideMatchScore(e, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.e);
  }
  // Con una búsqueda escrita, la guía se abre sola para mostrar el resultado;
  // sin nada escrito vuelve a quedar recogida (así no se ve tan larga por
  // defecto), y el texto del desplegable dice cuántos temas hay adentro.
  if(detailsEl) detailsEl.open = !!q;
  if(summaryEl) summaryEl.textContent = q ? 'Resultados de la guía' : ('Ver toda la guía (' + guiaDelNegocio().length + ' temas)');
  if(!list.length){
    wrap.innerHTML = '<div class="guide-empty">No encontramos nada para "' + invEsc(q) + '". Escríbenos por WhatsApp con el botón de abajo y te ayudamos.</div>';
    return;
  }
  wrap.innerHTML = list.map(e => '<div class="guide-item"><strong>' + invEsc(e.title) + '</strong><span>' + invEsc(e.body) + '</span></div>').join('');
}

document.getElementById('guideSearchInput').addEventListener('input', renderGuideResults);
renderGuideResults();

/* ---------- Ajustes: Apariencia ---------- */
const mkPal = (name, fx, o) => ({ name, fx, vars: { '--bg': o.bg, '--surface': o.s, '--surface-2': o.s2, '--paper': o.s, '--paper-2': o.s2, '--ink': o.ink, '--ink-soft': o.soft, '--cream': o.ink, '--cream-soft': o.soft, '--amber': o.a, '--amber-deep': o.a2, '--brick': o.r, '--brick-soft': o.r2, '--line': o.line, '--paid': o.g, '--cat-1': o.a, '--cat-2': o.c2, '--cat-3': o.c3, '--cat-4': o.r, '--cat-5': o.c5, '--cat-6': o.g } });
const PALETTES = {
  // Diseño por defecto de la app: fondo claro, tipografía tipo sistema
  // (no la monoespaciada del resto de temas) y un solo color de acento
  // (azul), como el lenguaje visual de un iPhone/Mac — limpio, con mucho
  // blanco de por medio y fácil de leer de un vistazo. Es lo primero que
  // ve cualquiera que instale la app desde cero.
  // Rediseño 2026: paleta nueva de acento violeta con tipografía Manrope
  // (moderna, geométrica, muy legible), pensada para que la app se vea
  // como un producto nuevo — no un ajuste de colores sobre el diseño
  // viejo. Queda como predeterminada; ver migración en loadData().
  noche: {
    name: '🌙 Noche violeta',
    rain: false,
    recommended: true,
    vars: {
      '--font-main': "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      '--bg':'#0f0f16', '--surface':'#17171f', '--surface-2':'#1e1e29',
      '--paper':'#15151c', '--paper-2':'#1c1c26',
      '--ink':'#f2f1f7', '--ink-soft':'#9a97ad',
      '--cream':'#c4b5fd', '--cream-soft':'#a78bfa',
      '--amber':'#7c3aed', '--amber-deep':'#5b21b6',
      '--brick':'#fb7185', '--brick-soft':'#fda4af',
      '--line':'#2a2a38', '--paid':'#34d399',
      '--cat-1':'#7c3aed', '--cat-2':'#22d3ee', '--cat-3':'#fbbf24',
      '--cat-4':'#fb7185', '--cat-5':'#60a5fa', '--cat-6':'#34d399'
    }
  },
  apple: {
    name: '🤍 Blanco moderno',
    rain: false,
    vars: {
      '--font-main': "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Poppins', 'Segoe UI', Roboto, sans-serif",
      '--bg':'#f2f2f7', '--surface':'#ffffff', '--surface-2':'#e9e9ef',
      '--paper':'#ffffff', '--paper-2':'#f2f2f7',
      '--ink':'#1c1c1e', '--ink-soft':'#8e8e93',
      '--cream':'#0a84ff', '--cream-soft':'#5ac8fa',
      '--amber':'#0a84ff', '--amber-deep':'#0060df',
      '--brick':'#ff3b30', '--brick-soft':'#ff6961',
      '--line':'#e5e5ea', '--paid':'#34c759',
      '--cat-1':'#0a84ff', '--cat-2':'#af52de', '--cat-3':'#30b0c7',
      '--cat-4':'#ff3b30', '--cat-5':'#5e5ce6', '--cat-6':'#34c759'
    }
  },
  navidad: mkPal('🎄 Navidad', 'navidad', { bg:'#0b1a12', s:'#10281b', s2:'#16351f', ink:'#f6efe0', soft:'#b7c9b0', a:'#f4c542', a2:'#c99a1b', r:'#ff6b6b', r2:'#ff9a9a', line:'#2c5a3a', g:'#46c26a', c2:'#e63946', c3:'#ffffff', c5:'#8ecae6' }),
  halloween: mkPal('🎃 Halloween', 'halloween', { bg:'#0d0713', s:'#170c24', s2:'#221233', ink:'#f5e9ff', soft:'#b79bd1', a:'#ff8a1f', a2:'#c96208', r:'#ff4d6d', r2:'#ff8fa3', line:'#3d2560', g:'#7bd88f', c2:'#b388ff', c3:'#ffd166', c5:'#4dd0e1' }),
  // Fecha especial: San Valentín / Día del Amor (14 de febrero) — corazones
  // cayendo suavemente con fxSet('sanvalentin').
  sanvalentin: mkPal('💘 San Valentín', 'sanvalentin', { bg:'#1a0a12', s:'#241019', s2:'#2e1420', ink:'#ffeaf0', soft:'#d6a0b3', a:'#ff4d6d', a2:'#c9203f', r:'#e0264f', r2:'#ff8fa8', line:'#3d1a26', g:'#4cd97b', c2:'#f4c542', c3:'#b388ff', c5:'#ffd1dc' }),
  // Fecha especial y muy local: Día de las Velitas (7 de diciembre, Bogotá) —
  // toda la ciudad enciende velas para empezar la Navidad. Fondo cálido como
  // un cuarto iluminado con velas, con destellos dorados con fxSet('velitas').
  velitas: mkPal('🕯️ Día de las Velitas', 'velitas', { bg:'#140d08', s:'#1e140c', s2:'#281a0e', ink:'#fff3d6', soft:'#c9a877', a:'#ffa726', a2:'#e08a1a', r:'#d84315', r2:'#ff8a5c', line:'#3d2a17', g:'#8bc34a', c2:'#ffca28', c3:'#c1440e', c5:'#795548' }),
  matrix: {
    name: '🟢 Original (Matrix)',
    rain: true,
    vars: {
      '--bg':'#000000', '--surface':'#050a05', '--surface-2':'#0a140a',
      '--paper':'#061006', '--paper-2':'#0a1a0a',
      '--ink':'#00ff41', '--ink-soft':'#0d9e2f',
      '--cream':'#00ff41', '--cream-soft':'#3ecb5e',
      '--amber':'#00ff41', '--amber-deep':'#00b32d',
      '--brick':'#ff3b3b', '--brick-soft':'#ff7a7a',
      '--line':'#0d3d16', '--paid':'#39d98a',
      '--cat-1':'#00ff41', '--cat-2':'#00d4ff', '--cat-3':'#ffd400',
      '--cat-4':'#ff3b3b', '--cat-5':'#b388ff', '--cat-6':'#ff9f1c'
    }
  },
  cafe: {
    name: '☕ Café con leche',
    rain: false,
    vars: {
      '--bg':'#f5eee2', '--surface':'#ffffff', '--surface-2':'#ece0cd',
      '--paper':'#ffffff', '--paper-2':'#efe3d0',
      '--ink':'#3d2f22', '--ink-soft':'#8a7561',
      '--cream':'#6b4226', '--cream-soft':'#8f5f3a',
      '--amber':'#b3702f', '--amber-deep':'#8f5824',
      '--brick':'#b3453a', '--brick-soft':'#c97a70',
      '--line':'#ddccb0', '--paid':'#4c8a52',
      '--cat-1':'#b3702f', '--cat-2':'#4c8a8a', '--cat-3':'#a68a2e',
      '--cat-4':'#b3453a', '--cat-5':'#6f5a9e', '--cat-6':'#8a6a3a'
    }
  },
  nocturno: {
    name: '🔷 Azul profundo',
    rain: false,
    vars: {
      '--bg':'#10151c', '--surface':'#171f29', '--surface-2':'#1d2733',
      '--paper':'#141b24', '--paper-2':'#1b2530',
      '--ink':'#dde3ea', '--ink-soft':'#8b97a6',
      '--cream':'#7fc4d6', '--cream-soft':'#5fa3b8',
      '--amber':'#4fa3c9', '--amber-deep':'#3a7fa0',
      '--brick':'#d1655c', '--brick-soft':'#e08d85',
      '--line':'#2a3542', '--paid':'#5fb894',
      '--cat-1':'#4fa3c9', '--cat-2':'#6fc9a8', '--cat-3':'#c9a24f',
      '--cat-4':'#d1655c', '--cat-5':'#9a8bd6', '--cat-6':'#4f8fc9'
    }
  },
  // Tres diseños pensados para que lo vea el negocio (empleados, clientes en
  // el mostrador) — fondo claro y mucho contraste para leerse fácil de un
  // vistazo, colores cálidos que dan buena imagen, nada del estilo "hacker"
  // del diseño original (ese se deja aparte, solo para Cristhian).
  claro: {
    name: '☀️ Punto de venta claro',
    rain: false,
    vars: {
      '--bg':'#f7f7f5', '--surface':'#ffffff', '--surface-2':'#eef0f2',
      '--paper':'#ffffff', '--paper-2':'#f1f2f4',
      '--ink':'#16181d', '--ink-soft':'#5b6270',
      '--cream':'#c2560f', '--cream-soft':'#e07a2e',
      '--amber':'#ff7a1a', '--amber-deep':'#d95f00',
      '--brick':'#e11d48', '--brick-soft':'#f4728f',
      '--line':'#e2e4e8', '--paid':'#16a34a',
      '--cat-1':'#ff7a1a', '--cat-2':'#2563eb', '--cat-3':'#ca9a06',
      '--cat-4':'#e11d48', '--cat-5':'#7c3aed', '--cat-6':'#0d9488'
    }
  },
  vito: {
    name: '🍺 Cervecería Vito',
    rain: false,
    vars: {
      '--bg':'#1b1208', '--surface':'#241a0f', '--surface-2':'#2d2213',
      '--paper':'#211709', '--paper-2':'#2a1f11',
      '--ink':'#fff3e0', '--ink-soft':'#d8b98a',
      '--cream':'#ffcf6b', '--cream-soft':'#f2a71b',
      '--amber':'#f2a71b', '--amber-deep':'#c9860f',
      '--brick':'#e2542d', '--brick-soft':'#f08a68',
      '--line':'#3c2a17', '--paid':'#8bc34a',
      '--cat-1':'#f2a71b', '--cat-2':'#4fb3bf', '--cat-3':'#ffd166',
      '--cat-4':'#e2542d', '--cat-5':'#c9a2ff', '--cat-6':'#8bc34a'
    }
  },
  moderno: {
    name: '🌊 Turquesa fresco',
    rain: false,
    vars: {
      '--bg':'#0d1512', '--surface':'#122019', '--surface-2':'#16281f',
      '--paper':'#0f1a15', '--paper-2':'#152a20',
      '--ink':'#eafff3', '--ink-soft':'#8fb7a6',
      '--cream':'#7ee7c9', '--cream-soft':'#5cc9ac',
      '--amber':'#2dd4bf', '--amber-deep':'#199e8f',
      '--brick':'#f87171', '--brick-soft':'#fca5a5',
      '--line':'#1f3a2e', '--paid':'#34d399',
      '--cat-1':'#2dd4bf', '--cat-2':'#60a5fa', '--cat-3':'#fbbf24',
      '--cat-4':'#f87171', '--cat-5':'#c084fc', '--cat-6':'#34d399'
    }
  }
};

function applyPalette(key){
  const palette = PALETTES[key] || PALETTES.noche;
  const root = document.documentElement;
  // La tipografía es la única variable que no todos los temas traen (solo el
  // estilo Apple la cambia): si el tema elegido no la trae, hay que
  // devolverla a la de por defecto (removeProperty), si no se queda pegada
  // la tipografía del tema anterior al cambiar a otro que no la especifica.
  if(!('--font-main' in palette.vars)) root.style.removeProperty('--font-main');
  Object.entries(palette.vars).forEach(([k,v])=> root.style.setProperty(k, v));
  const rainCanvas = document.getElementById('matrixRain');
  if(rainCanvas) rainCanvas.style.display = (palette.rain && !(data && data.rainOff)) ? '' : 'none';
  document.querySelectorAll('.palette-card').forEach(card=>{
    card.classList.toggle('selected', card.dataset.key === key);
  });
  applyCustomColors();
  fxSet(motivoActual(palette.fx));
}
// El motivo elegido en Ajustes manda; «Según la temática» usa el de la paleta.
function motivoActual(deLaPaleta){ const m = data && data.motivo; return m === 'ninguno' ? null : (m || deLaPaleta || null); }
window.fxSet = fxSet;

// Modo fácil: agranda letras/botones y quita animaciones (gente mayor, táctil).
// Es aditivo: no cambia la paleta ni el resto del diseño, solo el tamaño/quietud.
function applyEasyMode(){
  const on = !!(data && data.easyMode);
  document.body.classList.toggle('easy-mode', on);
  try{ window.ventoFacil && window.ventoFacil.aplicar(); }catch(x){}   // la cáscara Vender / Hoy / Más (lib/vento-pos.js)
  const cb = document.getElementById('easyModeToggle');
  if(!cb) return;
  cb.checked = on;
  cb.onchange = async e => {
    data.easyMode = e.target.checked;
    document.body.classList.toggle('easy-mode', data.easyMode);
    try{ window.libretaFab && window.libretaFab(); }catch(x){}
    try{ window.ventoFacil && window.ventoFacil.aplicar(); }catch(x){}
    if(data.easyMode) showToast('🧓 Modo fácil prendido. Para volver a la app completa: «⋯ Más» → «Salir del modo fácil».', 6000);
    await saveData();
  };
}

// El diseño "Original (Matrix)" se deja aparte, en su propia sección: es el
// que Cristhian pidió tener solo para él, no para mostrarle al negocio. Los
// demás (incluidos los 3 nuevos pensados para verse bien y fáciles de leer
// para clientes/empleados) van juntos en la galería principal.
const PALETTE_PERSONAL_KEYS = ['matrix'];
function paletteCardHtml(key, p, current){
  const swatchKeys = ['--bg','--paper','--amber','--cream'];
  const swatches = swatchKeys.map(v=>`<div class="palette-swatch" style="background:${p.vars[v]}"></div>`).join('');
  const badge = p.recommended ? '<span class="palette-badge">Predeterminado</span>' : '';
  return `<button type="button" class="palette-card${key===current?' selected':''}" data-key="${key}">
    ${badge}<div class="palette-swatches">${swatches}</div>
    <div class="palette-name">${p.name}<span class="palette-check">✓</span></div>
  </button>`;
}
function renderPaletteOptions(){
  const grid = document.getElementById('paletteGrid');
  const personalGrid = document.getElementById('palettePersonalGrid');
  const current = data.theme || 'noche';
  grid.innerHTML = Object.entries(PALETTES).filter(([key])=>!PALETTE_PERSONAL_KEYS.includes(key)).map(([key, p])=>paletteCardHtml(key, p, current)).join('');
  if(personalGrid){
    personalGrid.innerHTML = Object.entries(PALETTES).filter(([key])=>PALETTE_PERSONAL_KEYS.includes(key)).map(([key, p])=>paletteCardHtml(key, p, current)).join('');
  }
  document.querySelectorAll('#paletteGrid .palette-card, #palettePersonalGrid .palette-card').forEach(card=>{
    card.addEventListener('click', async ()=>{
      const key = card.dataset.key;
      data.theme = key;
      applyPalette(key);
      await saveData();
      // Avisa de una vez a la página de pedidos (pedido.html) del cambio de
      // diseño, para que el cliente lo vea a juego sin esperar horas.
      // OJO: publicarCatalogo() vive en el cierre (IIFE) de otro bloque
      // <script>, así que desde aquí no es visible por su nombre normal;
      // por eso ese otro módulo la expone como window.vitoPublicarCatalogo.
      if(typeof window.vitoPublicarCatalogo === 'function') window.vitoPublicarCatalogo(true);
    });
  });
}

/* ---------- Fondo personalizado desde fotos locales ---------- */
function applyCustomBackground(){
  const el = document.getElementById('customBackground');
  if(!el) return;
  if(data && data.backgroundImage){
    el.style.backgroundImage = `url(${data.backgroundImage})`;
    el.style.display = 'block';
  }else{
    el.style.backgroundImage = '';
    el.style.display = 'none';
  }
  const status = document.getElementById('backgroundPhotoStatus');
  const remove = document.getElementById('backgroundRemoveBtn');
  if(status) status.textContent = data && data.backgroundImage ? 'Hay una foto personalizada guardada en este dispositivo.' : 'No hay una foto personalizada.';
  if(remove) remove.style.display = data && data.backgroundImage ? '' : 'none';
}

function resizeBackgroundImage(file, maxSize0, quality){
  return new Promise((resolve,reject)=>{
    if(!file || !file.type.startsWith('image/')) return reject(new Error('No es una imagen'));
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const maxSize = maxSize0 || 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if(width > maxSize || height > maxSize){
          const scale = Math.min(maxSize/width, maxSize/height);
          width = Math.max(1, Math.round(width*scale));
          height = Math.max(1, Math.round(height*scale));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.78));
      };
      img.onerror = ()=>reject(new Error('No se pudo leer la imagen'));
      img.src = reader.result;
    };
    reader.onerror = ()=>reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function setupBackgroundPicker(){
  const btn = document.getElementById('backgroundGalleryBtn');
  const input = document.getElementById('backgroundGalleryInput');
  const remove = document.getElementById('backgroundRemoveBtn');
  if(btn && input) btn.onclick = ()=>input.click();
  if(input) input.onchange = async e=>{
    const file = e.target.files[0];
    input.value = '';
    if(!file) return;
    try{
      data.backgroundImage = await resizeBackgroundImage(file);
      await saveData();
      applyCustomBackground();
      showToast('Foto de fondo guardada.');
    }catch(err){
      showToast('No se pudo usar esa foto.');
    }
  };
  if(remove) remove.onclick = async ()=>{
    delete data.backgroundImage;
    await saveData();
    applyCustomBackground();
    showToast('Foto de fondo quitada.');
  };
}

function renderAll(){
  document.getElementById('brandName').value = data.businessName;
  updateMesaViewUI();
  renderProductos();
  renderPaletteOptions();
  setupBackgroundPicker();
  applyCustomBackground();
  setupColorPickers();
  cartaLabel();
}

/* ---------- Pago parcial: elegir qué productos se pagan ---------- */
const payPick = { table: null, person: null };   // selección pendiente antes de tocar "+"
let paySel = null;
const sameLine = (x, it) => x.productId === it.productId && (x.personId || null) === (it.personId || null);
function coveredQty(t, it, kind){   // kind: 'paid' | 'debe' | undefined (ambos)
  return (t.payments || []).reduce((s, p) => {
    if(!p.items) return s;
    if(kind === 'debe' && p.method !== 'debe') return s;
    if(kind === 'paid' && p.method === 'debe') return s;
    return s + p.items.filter(x => sameLine(x, it)).reduce((a, x) => a + x.qty, 0);
  }, 0);
}
function payItemsHtml(p){
  let h = (p.items && p.items.length) ? '<div class="li-paystatus">' + p.items.map(x => x.qty + ' ' + invEsc(x.name)).join(', ') + '</div>' : '';
  if(p.receiptId) h += '<button type="button" class="rcpt-view" data-rid="' + p.receiptId + '">📎 Ver comprobante</button>';
  return h;
}
function decoratePaidStatus(container, t){
  container.querySelectorAll('.li-remove[data-idx]').forEach(btn => {
    const it = t.items[parseInt(btn.dataset.idx, 10)];
    const row = btn.closest('.line-item');
    if(!it || !row) return;
    const paid = coveredQty(t, it, 'paid'), debe = coveredQty(t, it, 'debe');
    if(!paid && !debe) return;
    const falta = Math.max(0, it.qty - paid - debe);
    const bits = [];
    if(paid) bits.push('✔ Pagado ' + paid);
    if(debe) bits.push('📒 Debe ' + debe);
    bits.push(falta ? '⏳ Falta ' + falta : '✅ Completo');
    row.insertAdjacentHTML('afterend', '<div class="li-paystatus after' + (falta ? '' : ' done') + '">' + bits.join(' · ') + '</div>');
  });
}
function updatePayPickInfo(scope){
  const el = document.getElementById(scope === 'person' ? 'personPayPickInfo' : 'payPickInfo');
  const sel = payPick[scope], rc = pendingReceipt[scope];
  if(!el) return;
  if(!sel && !rc){ el.style.display = 'none'; el.textContent = ''; return; }
  const bits = [];
  if(sel) bits.push('Paga: ' + sel.map(x => x.qty + ' ' + x.name).join(', ') + ' · ' + fmt(sel.reduce((a, x) => a + x.price * x.qty, 0)));
  if(rc) bits.push('📎 Comprobante adjunto');
  el.style.display = 'block';
  el.textContent = bits.join(' · ');
}
function openPaySelect(scope){
  const t = data.tables[currentTable];
  const pend = payPick[scope] || [];
  const lines = (t.items || [])
    .filter(it => scope === 'person' ? it.personId === currentPersonId : !it.personId)
    .map(it => ({ it, rem: it.qty - coveredQty(t, it), sel: (pend.find(x => sameLine(x, it)) || {}).qty || 0 }))
    .filter(l => l.rem > 0);
  if(!lines.length){ showToast('No hay productos pendientes de pago en esta cuenta.'); return; }
  paySel = { scope, lines };
  renderPaySel();
  document.getElementById('paySelOverlay').classList.add('show');
}
function renderPaySel(){
  const box = document.getElementById('paySelList');
  box.innerHTML = '';
  let total = 0;
  paySel.lines.forEach((l, i) => {
    total += l.sel * l.it.price;
    const row = document.createElement('div');
    row.className = 'line-item';
    row.innerHTML = `<div><span class="li-name">${l.it.name}</span><div class="li-paystatus">${fmt(l.it.price)} · pendientes ${l.rem}</div></div>` +
      `<div class="qty-stepper"><button type="button" data-i="${i}" data-d="-1">−</button><input type="number" value="${l.sel}" readonly><button type="button" data-i="${i}" data-d="1">+</button></div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    const l = paySel.lines[b.dataset.i];
    l.sel = Math.min(l.rem, Math.max(0, l.sel + Number(b.dataset.d)));
    renderPaySel();
  });
  document.getElementById('paySelTotal').textContent = fmt(total);
}
const closePaySel = () => { document.getElementById('paySelOverlay').classList.remove('show'); paySel = null; };
document.getElementById('payPickBtn').addEventListener('click', () => openPaySelect('table'));
document.getElementById('personPayPickBtn').addEventListener('click', () => openPaySelect('person'));
document.getElementById('paySelAll').addEventListener('click', () => { paySel.lines.forEach(l => l.sel = l.rem); renderPaySel(); });
document.getElementById('paySelCancel').addEventListener('click', closePaySel);
document.getElementById('paySelOk').addEventListener('click', () => {
  const scope = paySel.scope;
  const ch = paySel.lines.filter(l => l.sel > 0).map(l => ({ productId: l.it.productId, name: l.it.name, price: l.it.price, qty: l.sel, personId: l.it.personId || null }));
  payPick[scope] = ch.length ? ch : null;
  if(ch.length) document.getElementById(scope === 'person' ? 'personPaymentAmount' : 'paymentAmount').value = ch.reduce((a, x) => a + x.price * x.qty, 0);
  updatePayPickInfo(scope);
  closePaySel();
});

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
     b = código de barras (mucho producto)
   Una floristería no ve Cocina ni el mapa de mesas; un restaurante sí. En Ajustes → Negocio se puede
   volver a ver todo con «Mostrar todas las funciones». */
const MOD_TODO = 'kpwdqvnb';
function modsNegocio(){
  const t = tipoNegocio();
  let m = (typeof data !== 'undefined' && data && data.modoCompleto) ? MOD_TODO : (t ? t.mod : MOD_TODO);   // sin tipo elegido (negocios viejos): se ve todo, como siempre
  // La pantalla de preparación (k) la decide cada local en Ajustes: activada o desactivada.
  if(typeof data !== 'undefined' && data && data.prep && typeof data.prep.on === 'boolean'){ m = m.replace('k', ''); if(data.prep.on) m += 'k'; }
  return m;
}
/* ---------- Pantalla de preparación: nombre configurable por local ----------
   No todos los negocios tienen «cocina»: un bar prepara en la Barra, una cafetería en Preparación,
   una tienda en Despacho. El nombre elegido se usa en el menú, títulos, avisos y en ORDEVA. */
const PREP_NOMBRES = ['Pantalla', 'Cocina', 'Barra', 'Bar', 'Preparación', 'Despacho', 'Producción', 'Cafetería', 'Comandas', 'Pedidos', 'Servicio', 'Área de preparación'];
function prepNombreDefecto(){
  const t = tipoNegocio(); if(!t) return 'Pantalla';
  if(t.fam === 'bar') return 'Barra';
  if(['cafeteria', 'heladeria'].includes(t.k)) return 'Preparación';
  if(t.fam === 'comida') return t.k === 'panaderia' || t.k === 'pasteleria' ? 'Producción' : 'Cocina';
  return 'Pantalla';   // tiendas y demás negocios: un nombre neutro, no «Cocina»
}
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
function vocabCambiar(t, base, basePl, sg, pl, srcMasc, destMasc){
  if(destMasc == null) destMasc = generoDe(sg) === 'm';
  const cap = (nuevo, ref) => /^[A-ZÁÉÍÓÚÑ]/.test(ref) ? nuevo.charAt(0).toUpperCase() + nuevo.slice(1) : nuevo.toLowerCase();
  let r = t;
  if(srcMasc && !destMasc){           // «del producto» → «de la tarifa»
    r = r.replace(new RegExp('\\b(del|al)\\s+' + base + '\\b', 'gi'), (m, p) => cap(p.toLowerCase() === 'del' ? 'de la' : 'a la', p) + ' ' + sg.toLowerCase());
    r = r.replace(new RegExp('\\b(de|a)\\s+los\\s+' + basePl + '\\b', 'gi'), (m, p) => cap(p.toLowerCase() === 'de' ? 'de las' : 'a las', p) + ' ' + pl.toLowerCase());
  }
  if(!srcMasc && destMasc){           // «de la mesa» → «del consultorio»
    r = r.replace(new RegExp('\\b(de|a)\\s+la\\s+' + base + '\\b', 'gi'), (m, p) => cap(p.toLowerCase() === 'de' ? 'del' : 'al', p) + ' ' + sg.toLowerCase());
    r = r.replace(new RegExp('\\b(de|a)\\s+las\\s+' + basePl + '\\b', 'gi'), (m, p) => cap(p.toLowerCase() === 'de' ? 'de los' : 'a los', p) + ' ' + pl.toLowerCase());
  }
  r = r.replace(new RegExp('\\b([a-záéíóúñ]+)(\\s+)(' + basePl + '|' + base + ')\\b', 'gi'), (m, art, sp, n) => {
    const par = VOCAB_ART[art.toLowerCase().normalize('NFC')];
    if(!par) return m;
    return cap(destMasc ? par[0] : par[1], art) + sp + cap(n.toLowerCase() === basePl ? pl : sg, n);
  });
  return r.replace(new RegExp('\\b' + basePl + '\\b', 'gi'), m => cap(pl, m)).replace(new RegExp('\\b' + base + '\\b', 'gi'), m => cap(sg, m));
}
function vocabTexto(t){
  if(!t) return t;
  let r = t;
  if(/\bmesas?\b/i.test(r)){ const e = espacio(); if(e[0] !== 'Mesa') r = vocabCambiar(r, 'mesa', 'mesas', e[0], e[1], false, e[3] !== 'f'); }
  if(/\bproductos?\b/i.test(r)){ const pr = producto1(); if(pr[0] !== 'Producto') r = vocabCambiar(r, 'producto', 'productos', pr[0], pr[1], true); }
  return r;
}
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
  q: 'pedidos por QR en cada puesto', n: 'cada cuenta a nombre del cliente', v: 'venta rápida de mostrador', b: 'código de barras' };
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
    b.onclick = () => { g('authUser').value = u.user; chips.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); g('authPass').focus(); };
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
        if(u && await authClaveOk(u, pass)){
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
