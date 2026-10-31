/* ORDEVA · app/04a-inicio-cuentas-clientes.js — parte 1 de 8 de app/04-principal.js (antes dentro de index.html). Se carga en el mismo lugar y orden. */
/* Funciones que se usan al abrir la app. Estaban más abajo; aquí hacen exactamente lo mismo («function» existe
   desde el principio del archivo) y así el archivo se puede partir en partes que cargan una tras otra. */
function modsNegocio(){
  const t = tipoNegocio(), d = typeof data !== 'undefined' && data ? data : null;
  let m = (d && d.modoCompleto) ? MOD_TODO : (t ? t.mod : MOD_TODO);   // sin tipo elegido (negocios viejos): se ve todo, como siempre
  // 1.65.7 (pedido del dueño): 🧂 Insumos y recetas es solo para los que PREPARAN comida (restaurantes, cafeterías…): no
  // se prende con «Mostrar todas las funciones» ni en un negocio sin tipo elegido. Se puede prender a mano (abajo).
  if(m.includes('r') && !(t && String(t.mod || '').includes('r'))) m = m.replace('r', '');
  // 1.64.0: un negocio que YA usa insumos o recetas los sigue viendo aunque su tipo no los traiga (nada deja de descontarse).
  if(!m.includes('r') && recetasEnUso()) m += 'r';
  // La pantalla de preparación (k) la decide cada local en Ajustes: activada o desactivada.
  if(d && d.prep && typeof d.prep.on === 'boolean'){ m = m.replace('k', ''); if(d.prep.on) m += 'k'; }
  // 1.64.0: lo que el administrador prendió o apagó en «🧩 Funciones de este negocio». Va en los datos de ESTE negocio:
  // no cambia los otros negocios de la misma cuenta. (La pantalla de preparación sigue en data.prep.)
  const o = d && d.modulos;
  if(o && typeof o === 'object') Object.keys(o).forEach(c => { if(c === 'k' || c.length !== 1 || !MOD_TODO.includes(c) || typeof o[c] !== 'boolean') return; m = m.replace(c, ''); if(o[c]) m += c; });
  return m;
}
// ¿Este negocio ya tiene insumos o productos con receta? (los datos nunca se borran al apagar el módulo)
function recetasEnUso(){
  const d = typeof data !== 'undefined' && data ? data : null; if(!d) return false;
  return (Array.isArray(d.insumos) && d.insumos.length > 0) || (Array.isArray(d.products) && d.products.some(p => p && Array.isArray(p.receta) && p.receta.length));
}
function prepNombreDefecto(){
  const t = tipoNegocio(); if(!t) return 'Pantalla';
  if(t.fam === 'bar') return 'Barra';
  if(['cafeteria', 'heladeria'].includes(t.k)) return 'Preparación';
  if(t.fam === 'comida') return t.k === 'panaderia' || t.k === 'pasteleria' ? 'Producción' : 'Cocina';
  return 'Pantalla';   // tiendas y demás negocios: un nombre neutro, no «Cocina»
}
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
  if(!data.theme) data.theme = 'ordeva2';
  // ORDEVA 2.0: todos los negocios pasan UNA vez al diseño nuevo (1.66.6; en la 1.66.0 solo pasaba quien tenía Noche
  // violeta). Lo que tenían (apariencia y decoración: 🎃, 🎄…) queda guardado en data.o2Antes y en Ajustes → Apariencia
  // está «Volver a la que tenía». La foto de fondo no se borra: con ORDEVA 2.0 solo no se muestra.
  if((data.o2Tema || 0) < 2){
    if((data.theme && data.theme !== 'ordeva2') || (data.motivo && data.motivo !== 'ninguno')){
      data.o2Antes = { theme: data.theme || null, motivo: data.motivo || null, at: Date.now() };
      data.theme = 'ordeva2'; delete data.motivo;
    }
    data.o2Tema = 2;
  }
  // El diseño original (Matrix) se deja solo como opción personal en Ajustes,
  // no como lo que ve el negocio por defecto: si alguien lo tenía puesto sin
  // haber elegido conscientemente uno de los diseños nuevos, se pasa una
  // sola vez al nuevo predeterminado.
  if(data.theme === 'matrix' && !data.themeChosen) data.theme = 'ordeva2';
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
  // 1.68.1: lo que se tocó MIENTRAS se ponían los datos del otro equipo se guardó, pero no se avisaba a la nube (y se
  // quedaba solo en este celular hasta el siguiente cambio). Ahora se sube enseguida.
  // (al instante, no después: así la nube sabe que hay algo por subir antes de dar estos datos por «al día»)
  if(window.__nubeCambioEnAplicar){ window.__nubeCambioEnAplicar = false; try{ window.ventoNube && window.ventoNube.cambio(); }catch(e){} }
  // 1.68.1: la cuenta (o la persona) abierta en pantalla se vuelve a pintar con los datos nuevos. Antes seguía
  // mostrando la cantidad de antes y su «+» sumaba sobre una copia vieja.
  try{
    if(typeof currentTable !== 'undefined' && currentTable != null && typeof overlay !== 'undefined' && overlay.classList.contains('show')){
      if(data.tables[currentTable]){ renderModalItems(); try{ renderPeople(); }catch(e){} }
      else { overlay.classList.remove('show'); currentTable = null; }
    }
    if(typeof personOverlay !== 'undefined' && personOverlay.classList.contains('show') && typeof currentPersonId !== 'undefined' && currentPersonId != null) renderPersonModalItems();
  }catch(e){}
  try{ typeof renderMesas === 'function' && renderMesas(); }catch(e){}
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
  // 1.68.1: mientras se ponen los datos de otro equipo no se escribe nada: antes se podía guardar la copia VIEJA encima de
  // lo que acababa de llegar y el toque se perdía. Lo tocado se junta al terminar (vento-nube: aplicarProtegido).
  if(window.__nubeAplicando && g.key === STORAGE_KEY){ window.__nubeCambioEnAplicar = true; g.listo(true); return Promise.resolve(true); }
  // Si los datos ya se reemplazaron (llegaron de otro equipo), se guardan los de ahora, no la copia vieja.
  const obj = (g.key === STORAGE_KEY && typeof data !== 'undefined' && data && g.obj !== data) ? data : g.obj;
  const r = guardarYa(g.key, obj); g.listo(r); return r;
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
    else { autoBackupTick(json); if(!window.__nubeAplicando){ try{ window.ventoNube && window.ventoNube.cambio(); }catch(e){} } else window.__nubeCambioEnAplicar = true; }
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

// 1.68.1: cuando llegan los datos de otro celular, `data` se reemplaza por uno nuevo. La cuenta que estaba abierta en
// pantalla seguía apuntando a la mesa VIEJA: el «+» sumaba en una copia que ya no existía y el toque se perdía («le doy
// sumar y no suma en el otro celular»). Ahora cada toque busca la mesa y el renglón ACTUALES.
function stepperActual(t, idx){
  const cur = (typeof currentTable !== 'undefined' && currentTable != null && data.tables[currentTable]) || t;
  let it = t && t.items ? t.items[idx] : null;
  if(cur !== t && it){
    const viejo = it;
    it = (cur.items || []).find(x => x.productId === viejo.productId && (x.personId || null) === (viejo.personId || null) && x.price === viejo.price) || null;
  }
  return { t: cur, it };
}
function attachQtyStepperHandlers(container, t0, rerender){
  container.querySelectorAll('.li-qty-plus').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      const { t, it } = stepperActual(t0, idx);
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
      const { t, it } = stepperActual(t0, idx);
      if(!it) return;
      if(it.qty <= 1){
        noteManualChange(tableIdOf(t), it.name, -it.qty);
        try{ invOnSale(it, -it.qty); }catch(e){}
        t.items.splice(t.items.indexOf(it), 1);
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
    receiptId: p.receiptId || null,
    ...(p.recibido ? { recibido: p.recibido, vueltas: p.vueltas || 0 } : {})   // 💵 1.67.0: efectivo entregado y cambio (no son ingreso)
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
