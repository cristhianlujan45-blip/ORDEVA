/* =====================================================================
   ORDEVA · Modos de trabajo (restaurante / tienda / mixto) y Modo fácil

   1) MODO DE TRABAJO: data.modoOperacion ∈ 'restaurante' | 'tienda' | 'mixto' (viaja con los datos y la nube).
      • 'restaurante' o sin valor: la app de siempre (mesas / cuentas). Aquí no se toca nada.
      • 'tienda': la vista principal es una CAJA (POS): buscador (también lector de código de barras), productos
        con favoritos y más vendidos primero, carrito (+ / − / quitar), TOTAL grande y COBRAR. No se ven las mesas;
        si quedó alguna cuenta abierta sale el botón «Cuentas abiertas» para verlas y cobrarlas.
      • 'mixto': la caja compacta arriba y las mesas debajo.
      El cobro es el MISMO de «⚡ Venta rápida» (qsRegistrarVenta de index.html): una entrada en data.history y el
      descuento de inventario UNA sola vez. El carrito vive en memoria y en localStorage (por equipo y negocio).
   2) MODO FÁCIL (data.easyMode): una cáscara encima de la app con 3 botones grandes: 🛒 Vender, 📊 Hoy y ⋯ Más.
      No borra ni cambia nada: solo tapa la app completa. El mesero (modo mesero) sigue con su pantalla de siempre.
      Vender en mesa usa las mismas funciones de la cuenta (recordItemHistory → inventario y sonido) y el mismo
      cierre (closeTableToHistory). Después de cobrar, «↩ Deshacer» grande por 5 s en vez de preguntar antes.
   Sonidos: window.ventoSonidos (add / remove / success), siempre con guarda.
   Suscripción: si no se puede vender (subPuedeVender() o ventoAcceso.tiene('pos_basic')) sale subPaywall(…).
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoPOS) return;

  // ---------- Utilidades ----------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const D = () => { try{ return typeof data !== 'undefined' ? data : null; }catch(e){ return null; } };
  const plata = n => { try{ return fmt(Number(n) || 0); }catch(e){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); } };
  const aviso = (m, ms) => { try{ showToast(m, ms); }catch(e){} };
  const guardar = () => { try{ return saveData(); }catch(e){} };
  const son = t => { try{ window.ventoSonidos && window.ventoSonidos[t] && window.ventoSonidos[t](); }catch(e){} };
  const lsGet = (k, d) => { try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } };
  const lsSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const sinTilde = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const llamar = (fn, ...a) => { try{ return typeof fn === 'function' ? fn(...a) : undefined; }catch(e){ return undefined; } };
  const etiqueta = id => { try{ return tableLabel(id); }catch(e){ return 'Mesa ' + id; } };
  const unidad = () => { try{ return [getServiceUnitName(), getServiceUnitNamePlural()]; }catch(e){ return ['Mesa', 'Mesas']; } };
  const usuario = () => { try{ return typeof authUser !== 'undefined' ? authUser : null; }catch(e){ return null; } };

  // ---------- Modo de trabajo ----------
  const MODOS = ['restaurante', 'tienda', 'mixto'];
  const modo = () => { const d = D(); return d && MODOS.includes(d.modoOperacion) ? d.modoOperacion : 'restaurante'; };
  // Negocio nuevo: las tiendas venden por caja; las que fían por cliente (distribuidora, muebles…) usan las dos.
  function modoPorTipo(tipo){
    try{
      const VN = window.VENTO_NEGOCIOS, t = VN && (VN.get(tipo) || VN.get('otro'));
      if(!t || t.fam !== 'tienda') return 'restaurante';
      return t.esp && t.esp[0] !== 'Cuenta' ? 'mixto' : 'tienda';
    }catch(e){ return 'restaurante'; }
  }
  async function ponerModo(m){
    const d = D(); if(!d || !MODOS.includes(m)) return;
    d.modoOperacion = m;
    pintarPos(); llamar(window.aplicarVocabulario); pintarFacil();
    await guardar();
  }

  // ---------- Suscripción: ¿se puede vender? ----------
  function puedeVender(){
    try{ if(typeof subPuedeVender === 'function' && !subPuedeVender()) return false; }catch(e){}
    try{ const a = window.ventoAcceso; if(a && typeof a.tiene === 'function' && !a.tiene('pos_basic')) return false; }catch(e){}
    return true;
  }
  function bloqueado(){
    if(puedeVender()) return false;
    try{ if(typeof subPaywall === 'function') subPaywall('Para hacer ventas nuevas, renueva tu suscripción.'); else aviso('🔒 Para vender, renueva tu suscripción.'); }catch(e){}
    return true;
  }

  // ---------- Productos: favoritos y más vendidos primero ----------
  let topCache = { clave: '', cuenta: {} };
  function vendidos(){
    const d = D(), h = (d && d.history) || [];
    const clave = h.length + '|' + (h[0] && (h[0].id || h[0].date || h[0].t));
    if(topCache.clave === clave) return topCache.cuenta;
    const cuenta = {};
    h.slice(0, 500).forEach(e => (e.items || []).forEach(it => { const k = sinTilde(it.name); cuenta[k] = (cuenta[k] || 0) + (Number(it.qty) || 0); }));
    topCache = { clave, cuenta };
    return cuenta;
  }
  function productos(q, cat){
    const d = D(); if(!d) return [];
    const c = vendidos(), qq = sinTilde(q).trim();
    let L = (d.products || []).filter(p => p && p.name);
    if(cat === 'fav') L = L.filter(p => p.favorite);
    else if(cat === 'rec'){ const r = recientes(); L = L.filter(p => r.has(p.id)); if(!qq) return L.sort((a, b) => r.get(a.id) - r.get(b.id)); }
    else if(cat) L = L.filter(p => p.categoryId === cat);
    if(qq){ const ws = qq.split(/\s+/); L = L.filter(p => { const h = sinTilde(p.name + ' ' + (p.size || '')); return ws.every(w => h.includes(w)); }); }
    return L.map(p => [p, (p.favorite ? 1e9 : 0) + (c[sinTilde(p.name)] || 0)])
      .sort((a, b) => b[1] - a[1] || String(a[0].name).localeCompare(String(b[0].name), 'es'))
      .map(x => x[0]);
  }
  const producto = id => { const d = D(); return d && (d.products || []).find(p => p.id === id); };
  // 🕘 Lo vendido en las últimas ventas (Caja Inteligente 2.0): id → orden (0 = lo más reciente).
  function recientes(){
    const d = D(), m = new Map(), h = (d && d.history) || [];
    for(const e of h.slice(0, 40)) for(const it of (e.items || [])){
      const p = (it.productId && producto(it.productId)) || ((d && d.products) || []).find(x => sinTilde(x.name) === sinTilde(it.name));
      if(p && !m.has(p.id)) m.set(p.id, m.size);
      if(m.size >= 24) return m;
    }
    return m;
  }

  // Cara del producto: su foto si tiene, un emoji según el nombre o su inicial.
  const EMOJIS = [
    [/\b(cerveza|aguila|poker|club|costena|costenita|corona|pilsen|redds|budweiser|heineken|stella|cola y pola)\b/, '🍺'],
    [/\b(aguardiente|ron|whisky|vodka|tequila|licor|guaro|antioqueno|nectar|brandy)\b/, '🍾'], [/\b(vino|sangria)\b/, '🍷'],
    [/\b(coctel|mojito|michelada|margarita coctel)\b/, '🍹'], [/\b(agua|cristal|brisa)\b/, '💧'],
    [/\b(gaseosa|coca|cocacola|pepsi|colombiana|postobon|sprite|quatro|bretana|pony|malta|soda|speed|vive100|gatorade|powerade)\b/, '🥤'],
    [/\b(jugo|limonada|batido|avena|kumis|yogur|yogurt|te helado|hit)\b/, '🧃'],
    [/\b(cafe|tinto|capuchino|latte|americano|aromatica|te|chocolate caliente|perico|carajillo)\b/, '☕'],
    [/\b(hamburguesa|burger)\b/, '🍔'], [/\b(perro|hot dog|salchipapa|salchicha)\b/, '🌭'], [/\b(pizza)\b/, '🍕'],
    [/\b(empanada|arepa|pandebono|bunuelo|pan|croissant|almojabana|pandeyuca|sandwich|sanduche)\b/, '🥐'],
    [/\b(papa|papas|fritas|chips|margarita|detodito|platanito|choclitos)\b/, '🍟'], [/\b(pollo|alitas|pechuga)\b/, '🍗'],
    [/\b(carne|res|cerdo|chicharron|costilla|bandeja|chorizo|morcilla|picada|lomo)\b/, '🥩'],
    [/\b(sopa|caldo|sancocho|ajiaco|almuerzo|corrientazo|menu|plato|ejecutivo)\b/, '🍲'], [/\b(arroz)\b/, '🍚'],
    [/\b(pescado|mojarra|sushi|rollo|camaron|trucha)\b/, '🐟'],
    [/\b(ensalada|fruta|frutas|banano|manzana|mango|fresa|tomate|papaya|pina|naranja|limon)\b/, '🍎'],
    [/\b(helado|cono|paleta|malteada|copa)\b/, '🍦'], [/\b(torta|postre|ponque|pastel|brownie|cupcake|tres leches)\b/, '🍰'],
    [/\b(galleta|galletas|chocorramo|dulce|dulces|chocolate|chocolatina|chicle|bonbonbum|confite|mecato)\b/, '🍫'],
    [/\b(huevo|huevos)\b/, '🥚'], [/\b(leche|queso|cuajada|mantequilla)\b/, '🧀'], [/\b(cigarrillo|cigarrillos|marlboro|lucky|boston)\b/, '🚬'],
    [/\b(corte|cabello|barba|peluqueria|cepillado|keratina|tinte|cejas)\b/, '💇'], [/\b(unas|manicure|pedicure|esmalte|acrilicas)\b/, '💅'],
    [/\b(lavado|lavada|polichada|brillada)\b/, '🚿'], [/\b(servicio|reparacion|arreglo|mano de obra|revision|mantenimiento)\b/, '🛠️'],
    [/\b(hora|horas|tiempo|rato|noche|habitacion|cama)\b/, '⏱️'], [/\b(recarga|minutos|datos)\b/, '📱'], [/\b(copia|copias|impresion)\b/, '📄']
  ];
  function emoji(p){ const n = sinTilde(p.name); for(const [re, e] of EMOJIS) if(re.test(n)) return e; return ''; }
  function caraHtml(p){
    let f = ''; try{ f = p.foto && typeof fotosCache !== 'undefined' && fotosCache[p.id] || ''; }catch(e){}
    if(f && /^data:image\//.test(f)) return '<span class="pz-cara"><img src="' + esc(f) + '" alt="" loading="lazy"></span>';
    const e = emoji(p);
    return '<span class="pz-cara">' + (e ? e : '<span class="pz-letra">' + esc((String(p.name).trim()[0] || '?').toUpperCase()) + '</span>') + '</span>';
  }

  // ⚖️ Venta por peso (lib/vento-equipos.js). El peso se ajusta al peso entero más cercano en plata: así el total de la
  // línea es un valor exacto (sin centavos) y la caja cuadra.
  const EQ = () => window.ventoEquipos || null;
  const redondoPeso = (q, precio) => { precio = Number(precio) || 0; return precio > 0 ? Math.round(precio * q) / precio : q; };
  const cantTxt = x => x.unidad && EQ() ? EQ().pesoTxt(x.qty, x.unidad) : String(x.qty);

  // ---------- Carrito de la caja (POS) ----------
  let carrito = null, carritoClave = '';
  const kCarrito = () => { let k = 'x'; try{ k = typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'x'; }catch(e){} return 'vento_pos_carrito:' + k; };
  function cart(){
    const k = kCarrito();
    if(!carrito || carritoClave !== k){ carritoClave = k; carrito = (lsGet(k, []) || []).filter(it => it && it.id && it.qty > 0); }
    return carrito;
  }
  const guardarCarrito = () => lsSet(kCarrito(), carrito || []);
  /* 🏷️📝⏸️ 1.67.5: descuento autorizado, nota y ventas suspendidas de la caja (en este equipo, por negocio).
     • El descuento se reparte en el precio de cada producto (precioLista queda guardado): el total, la rentabilidad y la
       factura electrónica cuadran sin líneas negativas. Al equipo le pide la clave de autorización del dueño.
     • Suspender guarda el carrito (con su descuento y nota) para cobrarlo después; «Pendientes» lo recupera. */
  const kMeta = () => kCarrito() + ':meta', kPend = () => kCarrito() + ':pendientes';
  const meta = () => lsGet(kMeta(), {}) || {};
  const ponerMeta = m => lsSet(kMeta(), m || {});
  const pendientes = () => (lsGet(kPend(), []) || []).filter(x => x && Array.isArray(x.lineas) && x.lineas.length);
  const ponerPendientes = l => lsSet(kPend(), (l || []).slice(-30));
  function descuentoDe(bruto, d){
    if(!d || !(Number(d.v) > 0) || !(bruto > 0)) return 0;
    const v = d.tipo === '%' ? Math.round(bruto * Math.min(100, Number(d.v)) / 100) : Math.round(Number(d.v));
    return Math.max(0, Math.min(bruto, v));
  }
  // Reparte el descuento en los precios (a la unidad de peso); lo que no cuadra por redondeo va a la línea de 1 unidad.
  function repartir(L, desc){
    const bruto = L.reduce((s, x) => s + x.price * x.qty, 0); if(!(desc > 0) || !(bruto > 0)) return L;
    const f = (bruto - desc) / bruto;
    const out = L.map(x => Object.assign({}, x, { precioLista: x.price, price: Math.round(x.price * f) }));
    const dif = Math.round(bruto - desc) - Math.round(out.reduce((s, x) => s + x.price * x.qty, 0));
    if(dif){ const u = out.find(x => x.qty === 1 && !x.unidad) || out[0]; if(u.qty === 1) u.price += dif; }
    return out;
  }
  const caja = {
    tipo: 'caja',
    lineas(){
      return cart().map(it => {
        const p = producto(it.id);
        if(p){ it.name = p.name; it.price = (window.ventoPrecioCantidad ? window.ventoPrecioCantidad(p, it.qty) : Number(p.price)) || 0; }   // el precio de hoy (💲 por cantidad / mayorista)
        const u = EQ() ? EQ().unidadDe(p) : '';                       // ⚖️ por kilo / por libra (lib/vento-equipos.js)
        return { k: it.id, id: it.id, name: it.name, price: Number(it.price) || 0, qty: u ? redondoPeso(it.qty, it.price) : it.qty, unidad: u };
      });
    },
    cuanto(id){ const it = cart().find(x => x.id === id); return it ? it.qty : 0; },
    add(p, n, pesado){
      if(bloqueado()) return false;
      // ⚖️ Por kilo o por libra: primero se pesa (balanza o a mano). La cantidad es el peso en su unidad.
      if(EQ() && EQ().unidadDe(p)){
        if(!pesado){ EQ().pesar(p).then(q => { if(q > 0 && caja.add(p, q, true)){ pintarTodo(); aviso('✅ ' + EQ().pesoTxt(q, EQ().unidadDe(p)) + ' de ' + p.name); } }); return false; }
        const q0 = Math.round((Number(n) || 0) * 1e6) / 1e6; if(!(q0 > 0)) return false;
        const c0 = cart(), it0 = c0.find(x => x.id === p.id);
        if(it0) it0.qty = Math.round((it0.qty + q0) * 1e6) / 1e6; else c0.push({ id: p.id, name: p.name, price: Number(p.price) || 0, qty: q0 });
        guardarCarrito(); son('add');
        return true;
      }
      n = Math.max(1, Math.min(999, Math.round(Number(n) || 1)));
      const c = cart(), it = c.find(x => x.id === p.id);
      if(it) it.qty += n; else c.push({ id: p.id, name: p.name, price: Number(p.price) || 0, qty: n });
      guardarCarrito(); son('add');
      return true;
    },
    mas(k){ const it = cart().find(x => x.id === k); if(!it || bloqueado()) return; const p = producto(k); if(p && EQ() && EQ().unidadDe(p)){ caja.add(p); return; } it.qty += 1; guardarCarrito(); son('add'); },
    menos(k){
      const c = cart(), i = c.findIndex(x => x.id === k); if(i < 0) return;
      const pp = producto(k), pesado = pp && EQ() && EQ().unidadDe(pp);
      if(c[i].qty > 1 && !pesado) c[i].qty -= 1; else c.splice(i, 1);
      guardarCarrito(); son('remove');
    },
    quitar(k){ const c = cart(), i = c.findIndex(x => x.id === k); if(i < 0) return; c.splice(i, 1); guardarCarrito(); son('remove'); },
    cobrar(o){ return cobrarCaja(o); }
  };
  function vaciarCarrito(){
    const antes = cart().map(x => Object.assign({}, x)); if(!antes.length) return;
    carrito = []; guardarCarrito(); son('remove'); pintarTodo();
    deshacer('🗑️ Carrito vacío', () => { carrito = antes; guardarCarrito(); pintarTodo(); });
  }
  // Cobra el carrito con el registro de «Venta rápida» (historial + inventario una sola vez).
  async function cobrarCaja(o){
    o = o || {};
    const L = caja.lineas(); if(!L.length) return null;
    if(bloqueado()) return null;
    if(typeof qsRegistrarVenta !== 'function'){ aviso('⚠️ No se pudo registrar la venta. Recarga ORDEVA.'); return null; }
    const bruto = Math.round(L.reduce((s, x) => s + x.price * x.qty, 0)), m = meta(), desc = descuentoDe(bruto, m.desc);
    const LV = repartir(L, desc), total = Math.round(LV.reduce((s, x) => s + x.price * x.qty, 0));
    const pago = o.pago || await elegirPago(total, { fiado: !o.grande, grande: !!o.grande });
    if(!pago) return null;
    if(m.cli && m.cli.dian && !pago.cliente){ pago.cliente = m.cli.dian; pago.factura = !!m.cli.fe; }   // 👤 F3 (Caja Inteligente)
    const copia = cart().map(x => Object.assign({}, x)), metaAntes = Object.assign({}, m);
    const entry = qsRegistrarVenta(LV.map(x => Object.assign({ productId: x.id, name: x.name, price: x.price, qty: x.qty }, x.unidad ? { unidad: x.unidad } : {}, x.precioLista != null ? { precioLista: x.precioLista } : {})),
      { method: pago.method, deudor: pago.deudor, nota: pago.nota, pagos: pago.pagos, cliente: pago.cliente, factura: pago.factura, recibido: pago.recibido, vueltas: pago.vueltas,
        descuento: desc > 0 ? Object.assign({ valor: bruto - total, bruto }, m.desc) : null, observacion: [m.cli && m.cli.nombre ? 'Cliente: ' + m.cli.nombre : '', m.nota || ''].filter(Boolean).join(' · ') });
    ponerMeta({});
    try{ EQ() && EQ().alCobrar(entry, pago); }catch(e){}                // 💵 cajón en efectivo y 🧾 factura sola (si está prendido)
    carrito = []; guardarCarrito();
    if(pago.method !== 'debe'){ son('success'); try{ window.mesoraCelebrar && window.mesoraCelebrar(['💰', '✨', '🎉']); }catch(e){} }
    pintarTodo(); llamar(window.renderMesas);
    deshacer((pago.method === 'debe' ? '⏳ ' + pago.deudor + ' quedó debiendo ' : '✅ Vendido ') + plata(entry.total) + (pago.vueltas > 0 ? ' · Vueltas ' + plata(pago.vueltas) : ''), () => {
      if(typeof qsDeshacerVenta === 'function' && qsDeshacerVenta(entry)){
        const c = cart(); copia.forEach(x => { const y = c.find(z => z.id === x.id); if(y) y.qty += x.qty; else c.push(x); });
        guardarCarrito(); ponerMeta(metaAntes); pintarTodo(); llamar(window.renderMesas);
        aviso('↩ Venta deshecha. Los productos volvieron al carrito.');
      }
    }, [['🧾 Recibo', () => recibo(entry)]]);
    return entry;
  }

  // ---------- Cuenta de una mesa (modo fácil): las mismas funciones de la cuenta de siempre ----------
  function mesaSrc(id){
    const T = () => { const d = D(); return d && d.tables && d.tables[id]; };
    const tocar = (it, n) => { if(typeof recordItemHistory === 'function') recordItemHistory(it, n); else son(n > 0 ? 'add' : 'remove'); };
    const nota = (name, n) => { try{ noteManualChange(id, name, n); }catch(e){} };
    return {
      tipo: 'mesa', id,
      lineas(){ const t = T(); return t ? (t.items || []).map((it, i) => ({ k: i, id: it.productId, name: it.name, price: Number(it.price) || 0, qty: it.qty })) : []; },
      cuanto(pid){ const t = T(); return t ? (t.items || []).filter(it => it.productId === pid).reduce((s, it) => s + (Number(it.qty) || 0), 0) : 0; },
      add(p){
        if(bloqueado()) return false;
        const t = T(); if(!t) return false;
        if(!t.items) t.items = [];
        const ex = t.items.find(it => it.productId === p.id && !it.personId);
        if(ex){ ex.qty += 1; tocar(ex, 1); }                    // inventario y sonido «tún» (como en la cuenta)
        else { const it = { productId: p.id, name: p.name, price: p.price, size: p.size || '', qty: 1, personId: null, history: [] }; tocar(it, 1); t.items.push(it); }
        nota(p.name, 1); guardar(); llamar(window.renderMesas);
        return true;
      },
      mas(k){ const t = T(), it = t && t.items[k]; if(!it || bloqueado()) return; it.qty += 1; tocar(it, 1); nota(it.name, 1); guardar(); llamar(window.renderMesas); },
      menos(k){
        const t = T(), it = t && t.items[k]; if(!it) return;
        if(it.qty <= 1){ nota(it.name, -it.qty); try{ invOnSale(it, -it.qty); }catch(e){} t.items.splice(k, 1); son('remove'); }
        else { it.qty -= 1; tocar(it, -1); nota(it.name, -1); }
        guardar(); llamar(window.renderMesas);
      },
      quitar(k){
        const t = T(), it = t && t.items[k]; if(!it) return;
        nota(it.name, -it.qty); try{ invOnSale(it, -it.qty); }catch(e){} t.items.splice(k, 1); son('remove');
        guardar(); llamar(window.renderMesas);
      },
      cobrar(o){ return cobrarMesa(id, o); }
    };
  }
  // Cierra la cuenta como «Cobrar todo y liberar mesa»: un pago por el saldo y closeTableToHistory (el inventario ya
  // se descontó al agregar, así que no se toca otra vez). Deshacer devuelve la mesa como estaba.
  async function cobrarMesa(id, o){
    o = o || {};
    const d = D(), t = d && d.tables && d.tables[id];
    if(!t || !(t.items || []).length || typeof closeTableToHistory !== 'function') return null;
    let saldo = 0; try{ saldo = tableBalance(id); }catch(e){ saldo = t.items.reduce((s, it) => s + it.price * it.qty, 0); }
    const pago = o.pago || await elegirPago(saldo || t.items.reduce((s, it) => s + it.price * it.qty, 0), { fiado: false, grande: true });
    if(!pago) return null;
    const t2 = D().tables[id]; if(!t2 || !(t2.items || []).length) return null;
    const antes = JSON.parse(JSON.stringify({ items: t2.items || [], payments: t2.payments || [], people: t2.people || [] }));
    const factura = D().invoiceNextNo;
    try{ saldo = tableBalance(id); }catch(e){}
    if(saldo > 0){ if(!t2.payments) t2.payments = []; t2.payments.push({ note: 'Pagó todo (' + pago.nota + ')', amount: saldo, method: pago.method, at: Date.now() }); }
    const entry = closeTableToHistory(id);
    if(!entry) return null;
    if(pago.cliente){ entry.dianCliente = pago.cliente; entry.dianFactura = !!pago.factura; }
    try{ window.ventoDian && window.ventoDian.alVender(entry); }catch(e){}   // 🧾 a la DIAN (si está prendida)
    try{ EQ() && EQ().alCobrar(entry, pago); }catch(e){}
    if(!(entry.debt > 0)) son('success');
    await guardar();
    if(fz.mesa === id) fz.mesa = null;
    llamar(window.renderMesas); pintarTodo();
    deshacer('✅ Cobrado ' + plata(entry.total) + ' · ' + etiqueta(id) + (pago.vueltas > 0 ? ' · Vueltas ' + plata(pago.vueltas) : ''), () => {
      const dd = D(), i = dd.history.findIndex(h => h.id === entry.id); if(i < 0) return;
      dd.history.splice(i, 1);
      try{ window.ventoDian && window.ventoDian.alDeshacer(entry); }catch(e){}   // 🧾 si ya salió a la DIAN: nota crédito
      const t3 = dd.tables[id] || (dd.tables[id] = { items: [], payments: [], people: [] });
      t3.items = antes.items.concat(t3.items || []); t3.payments = antes.payments.concat(t3.payments || []); t3.people = antes.people.concat(t3.people || []);
      if(dd.invoiceNextNo === factura + 1) dd.invoiceNextNo = factura;
      guardar(); fz.mesa = id; llamar(window.renderMesas); pintarTodo();
      aviso('↩ Cobro deshecho. ' + etiqueta(id) + ' quedó abierta otra vez.');
    });
    return entry;
  }

  // ---------- 💵 Efectivo recibido y vueltas (1.67.0) ----------
  // Cambio = efectivo recibido − total que se paga en efectivo. Las vueltas nunca salen de transferencias ni de tarjeta.
  function cambio(totalEfectivo, recibido){
    const t = Math.max(0, Math.round(Number(totalEfectivo) || 0)), r = Math.max(0, Math.round(Number(recibido) || 0));
    if(!r) return { estado: 'vacio', recibido: 0, aplicado: 0, vueltas: 0, falta: t };
    if(r === t) return { estado: 'exacto', recibido: r, aplicado: t, vueltas: 0, falta: 0 };
    if(r > t) return { estado: 'vueltas', recibido: r, aplicado: t, vueltas: r - t, falta: 0 };
    return { estado: 'falta', recibido: r, aplicado: r, vueltas: 0, falta: t - r };
  }
  // Billetes de los botones rápidos (pesos colombianos). Ajustes → Negocio los puede cambiar (data.cajaBilletes).
  const BILLETES = [2000, 5000, 10000, 20000, 50000, 100000];
  function billetesCaja(){
    const d = D(), l = d && Array.isArray(d.cajaBilletes) ? d.cajaBilletes.map(Number).filter(n => n > 0 && n <= 1e7) : [];
    return (l.length ? l : BILLETES).slice(0, 8);
  }

  // ---------- ¿Cómo pagó? Efectivo, Nequi, DaviPlata, Tarjeta (y fiado en la caja) ----------
  const METODOS = [['efectivo', '💵', 'Efectivo'], ['nequi', '💜', 'Nequi'], ['daviplata', '🔴', 'DaviPlata'], ['tarjeta', '💳', 'Tarjeta']];
  let quietoHasta = 0;   // un doble toque en «Efectivo» no debe caer en un producto de la venta siguiente
  function elegirPago(total, o){
    o = o || {};
    const previo = document.querySelector('.pz-pago-ov');
    if(previo && previo.classList.contains('show')) return Promise.resolve(null);   // ya hay uno abierto (doble toque en COBRAR)
    // Uno que quedó escondido (el botón Atrás de la APK le quita «show» desde afuera): se cierra como «Cancelar».
    if(previo){ if(typeof previo._fin === 'function') previo._fin(null); else previo.remove(); }
    const abierto = Date.now();
    return new Promise(res => {
      const ov = document.createElement('div');
      ov.className = 'overlay show pz-pago-ov' + (o.grande ? ' pz-pago-grande' : ''); ov.setAttribute('data-novocab', '');
      ov.dataset.abierto = String(abierto);   // ⌨️ Enter seguro (lib/vento-caja-voz.js): un Enter recién abierta no cobra
      const billetes = billetesCaja();
      ov.innerHTML = '<div class="modal pz-pago" role="dialog" aria-modal="true" aria-label="Cobrar">' +
        '<div class="pz-pago-tot"><span>Total a cobrar</span><b>' + plata(total) + '</b></div>' +
        // 💵 1.67.0: SIEMPRE a la vista (antes estaba plegado en «¿Con cuánto paga? (vueltas)»).
        '<div class="pz-vu-box"><label class="pz-vu-l" for="pzPagaCon">¿CON CUÁNTO PAGA EL CLIENTE?</label>' +
          '<div class="pz-vu-in"><span>$</span><input id="pzPagaCon" type="number" inputmode="numeric" min="0" step="100" class="pz-pagacon" placeholder="0" autocomplete="off" aria-describedby="pzVu"></div>' +
          '<div class="pz-billetes"><button type="button" data-b="exacto">Pago exacto</button>' + billetes.map(b => '<button type="button" data-b="' + b + '">+' + plata(b) + '</button>').join('') +
          '<button type="button" data-b="0" class="pz-b-borrar" aria-label="Borrar lo recibido">↺</button></div>' +
          '<div class="pz-vu" id="pzVu" aria-live="polite"></div></div>' +
        '<div class="pz-pago-q">¿Cómo pagó?</div>' +
        '<div class="pz-metodos">' + METODOS.map(m => '<button type="button" class="pz-met" data-m="' + m[0] + '"><i>' + m[1] + '</i><span>' + m[2] + '</span></button>').join('') + '</div>' +
        (qrPago() ? '<button type="button" class="pz-qr-btn"><i>📲</i><span>Pagar con QR<small>El cliente lo escanea con su app del banco</small></span></button>' : '') +
        '<button type="button" class="btn-ghost pz-mixto-btn">➗ Pago mixto (efectivo + Nequi, tarjeta…)</button>' +
        '<div class="pz-mixto-box" hidden>' + METODOS.map(m => '<label class="pz-mx"><span>' + m[1] + ' ' + (m[0] === 'efectivo' ? 'Efectivo recibido' : m[2]) + '</span><input type="number" inputmode="numeric" min="0" class="mz-in" data-mx="' + m[0] + '" placeholder="0"></label>').join('') +
          '<div class="pz-mx-falta"></div><button type="button" class="btn-primary pz-mixto-ok" disabled>✅ Cobrar pago mixto</button></div>' +
        (window.ventoDian && window.ventoDian.activo() ? '<button type="button" class="btn-ghost pz-dian-cli">' + ((window.ventoDian.cfg() || {}).fe_resolucion ? '🧾 Factura electrónica (datos del cliente)' : '🧾 A nombre del cliente (cédula / NIT)') + '</button>' : '') +
        (o.fiado ? '<button type="button" class="btn-ghost pz-fiado">📝 Queda debiendo (fiado)</button><div class="pz-fiado-box" hidden><input class="mz-in pz-deudor" maxlength="40" placeholder="¿Quién queda debiendo?" autocomplete="off"><button type="button" class="btn-primary pz-fiado-ok">Guardar fiado</button></div>' : '') +
        '<button type="button" class="btn-close pz-cancel">Cancelar</button></div>';
      document.body.appendChild(ov);
      let recibido = 0;
      const vu = ov.querySelector('.pz-vu');
      const pcIn = ov.querySelector('.pz-pagacon');
      const ponerRecibido = (v, escribir) => {
        recibido = Math.max(0, Math.round(Number(v) || 0));
        if(escribir !== false && pcIn) pcIn.value = recibido ? String(recibido) : '';
        const c = cambio(total, recibido);
        vu.innerHTML = !recibido ? '<small>Escribe o toca los billetes que entrega (se suman). Para Nequi, tarjeta… no hace falta.</small>'
          : c.estado === 'exacto' ? '<b>✅ PAGO EXACTO</b>' : c.estado === 'vueltas' ? 'Cambio que debe devolver: <b>' + plata(c.vueltas) + '</b>' : 'Faltan <b>' + plata(c.falta) + '</b>';
        vu.className = 'pz-vu' + (c.estado === 'falta' ? ' falta' : c.estado === 'vueltas' ? ' vueltas' : c.estado === 'exacto' ? ' exacto' : '');
      };
      let cliDian = null;   // 🧾 datos del cliente para la DIAN (opcional)
      const fin = r => { document.removeEventListener('keydown', tecla, true); ov.remove(); if(r) quietoHasta = Date.now() + 450; if(r && cliDian){ r.cliente = cliDian.c; r.factura = cliDian.f; } res(r); };
      ov._fin = fin;   // window.ventoAtras (botón Atrás de Android) lo cierra como «Cancelar»
      const tecla = e => { if(e.key === 'Escape'){ e.stopPropagation(); e.preventDefault(); fin(null); } };
      document.addEventListener('keydown', tecla, true);
      ov.addEventListener('click', e => {
        if(e.target === ov && Date.now() - abierto < 400) return;   // el segundo toque del doble toque en COBRAR
        if(e.target === ov || e.target.closest('.pz-cancel')) return fin(null);
        const b = e.target.closest('[data-b]');
        if(b){ const k = b.dataset.b; ponerRecibido(k === 'exacto' ? total : k === '0' ? 0 : recibido + (+k || 0)); return; }
        const m = e.target.closest('.pz-met');
        if(m){
          const k = m.dataset.m, info = METODOS.find(x => x[0] === k);
          if(k === 'efectivo' && recibido > 0 && recibido < total){
            // Un pago incompleto NO queda como venta pagada: falta efectivo o el resto va por otro medio (pago mixto).
            aviso('⚠️ Faltan ' + plata(total - recibido) + '. Completa el efectivo o usa «Pago mixto» para el resto.', 4500);
            const bx = ov.querySelector('.pz-mixto-box'); bx.hidden = false;
            const ie = bx.querySelector('[data-mx="efectivo"]'); if(ie){ ie.value = String(recibido); mixto(); }
            return;
          }
          if(k === 'efectivo'){ const c = cambio(total, recibido || total); return fin({ method: 'efectivo', nota: info[2], metodo: k, recibido: c.recibido, vueltas: c.vueltas }); }
          return fin({ method: 'transferencia', nota: info[2], metodo: k, vueltas: 0 });   // sin vueltas sobre transferencias ni tarjeta
        }
        if(e.target.closest('.pz-qr-btn')){ mostrarQr(total, fin); return; }
        if(e.target.closest('.pz-mixto-btn')){ const bx = ov.querySelector('.pz-mixto-box'); bx.hidden = false; const i = bx.querySelector('input'); if(i) i.focus(); return; }
        if(e.target.closest('.pz-mixto-ok')){
          const r = mixto(); if(!r || r.suma < total) return;
          // Lo que pasa del total en efectivo son las vueltas; el efectivo que queda es lo que falta después de lo digital.
          const digital = r.partes.filter(x => x[0] !== 'efectivo').reduce((s2, x) => s2 + x[1], 0);
          const ef = Math.max(0, total - digital), vueltas = Math.max(0, r.suma - total);
          const pagos = r.partes.map(x => { const info = METODOS.find(m => m[0] === x[0]); return { method: x[0] === 'efectivo' ? 'efectivo' : 'transferencia', amount: x[0] === 'efectivo' ? ef : x[1], note: info[2] }; }).filter(x => x.amount > 0);
          const recEf = (r.partes.find(x => x[0] === 'efectivo') || [0, 0])[1];
          return fin({ method: pagos[0] ? pagos[0].method : 'efectivo', nota: 'Pago mixto', metodo: 'mixto', pagos, vueltas, recibido: recEf });
        }
        const dc = e.target.closest('.pz-dian-cli');
        if(dc){
          const fe = !!(window.ventoDian.cfg() || {}).fe_resolucion;
          window.ventoDian.pedirCliente(fe ? 'Factura electrónica a nombre de…' : 'Documento a nombre de…', fe).then(c => {
            if(!c) return; cliDian = { c, f: fe };
            dc.textContent = '🧾 ' + (fe ? 'Factura' : 'Documento') + ' a nombre de ' + c.nombre + ' ✓'; dc.classList.add('on');
          });
          return;
        }
        if(e.target.closest('.pz-fiado')){ const bx = ov.querySelector('.pz-fiado-box'); bx.hidden = false; bx.querySelector('input').focus(); return; }
        if(e.target.closest('.pz-fiado-ok')){
          const n = ov.querySelector('.pz-deudor').value.trim();
          if(!n){ aviso('⚠️ Escribe quién queda debiendo.'); ov.querySelector('.pz-deudor').focus(); return; }
          return fin({ method: 'debe', deudor: n, nota: n, metodo: 'debe', vueltas: 0 });
        }
      });
      if(pcIn){
        pcIn.addEventListener('input', () => ponerRecibido(pcIn.value, false));
        pcIn.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); const ef = ov.querySelector('.pz-met[data-m="efectivo"]'); if(ef) ef.click(); } });
      }
      ponerRecibido(0);
      // Pago mixto: lo digital no puede pasar del total (las vueltas solo salen del efectivo).
      const mixto = () => {
        const partes = [...ov.querySelectorAll('[data-mx]')].map(i => [i.dataset.mx, Math.max(0, Math.round(Number(i.value) || 0))]).filter(x => x[1] > 0);
        const suma = partes.reduce((s2, x) => s2 + x[1], 0), digital = partes.filter(x => x[0] !== 'efectivo').reduce((s2, x) => s2 + x[1], 0);
        const fx = ov.querySelector('.pz-mx-falta'), ok = ov.querySelector('.pz-mixto-ok');
        const malo = digital > total;
        fx.textContent = malo ? 'Lo digital pasa del total.' : suma < total ? 'Faltan ' + plata(total - suma) : suma > total ? 'Vueltas: ' + plata(suma - total) : '✅ Completo';
        fx.classList.toggle('falta', malo || suma < total);
        ok.disabled = malo || suma < total || partes.length < 1;
        return malo ? null : { partes, suma };
      };
      ov.querySelectorAll('[data-mx]').forEach(i => i.addEventListener('input', mixto));
      const dn = ov.querySelector('.pz-deudor'); if(dn) dn.addEventListener('keydown', e => { if(e.key === 'Enter') ov.querySelector('.pz-fiado-ok').click(); });
      setTimeout(() => { const f = ov.querySelector('.pz-met'); if(f) try{ f.focus({ preventScroll: true }); }catch(e){} }, 30);
    });
  }

  // ---------- 🏷️ Descuento · 📝 Nota · ⏸️ Suspender / 📂 Pendientes · 🔁 Repetir (1.67.5) ----------
  function ventanita(html, alAbrir){
    const ov = document.createElement('div');
    ov.className = 'overlay show pz-mini-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal pz-mini" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    const fin = () => ov.remove(); ov._fin = fin;
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-cerrar]')) fin(); });
    alAbrir(ov, fin);
    return ov;
  }
  const jefeAhora = () => { try{ return !window.ventoRoles || window.ventoRoles.esJefe(); }catch(e){ return true; } };
  const auditar = (a, d) => { try{ window.ventoAuditar && window.ventoAuditar(a, d); }catch(e){} };
  function pedirDescuento(root){
    const L = caja.lineas(), bruto = Math.round(L.reduce((s, x) => s + x.price * x.qty, 0)); if(!bruto) return;
    const m = meta(), d = m.desc || { tipo: '%', v: '' };
    ventanita('<h2>🏷️ Descuento</h2><div class="modal-sub">Venta de ' + plata(bruto) + '. Al equipo se le pide la clave del dueño.</div>' +
      '<div class="pz-dtipo"><button type="button" data-t="%" class="' + (d.tipo === '%' ? 'on' : '') + '">%</button><button type="button" data-t="$" class="' + (d.tipo === '$' ? 'on' : '') + '">$ pesos</button></div>' +
      '<input type="number" inputmode="numeric" min="0" class="pz-dv" value="' + esc(d.v || '') + '" placeholder="Ej. 10">' +
      '<div class="pz-drap">' + [5, 10, 15, 20].map(x => '<button type="button" data-r="' + x + '">' + x + ' %</button>').join('') + '</div>' +
      '<div class="pz-dres"></div>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary" data-ok>Aplicar</button></div>', (ov, fin) => {
      let tipo = d.tipo || '%';
      const inp = ov.querySelector('.pz-dv'), res = ov.querySelector('.pz-dres');
      const calc = () => { const v = Number(inp.value) || 0, x = descuentoDe(bruto, { tipo, v }); res.textContent = !v ? '' : (tipo === '%' && v > 100) || (tipo === '$' && v > bruto) ? '⚠️ No puede pasar del total.' : 'Descuento ' + plata(x) + ' → queda en ' + plata(bruto - x); return { v, x }; };
      ov.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tipo = b.dataset.t; ov.querySelectorAll('[data-t]').forEach(z => z.classList.toggle('on', z === b)); calc(); });
      ov.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { tipo = '%'; ov.querySelectorAll('[data-t]').forEach(z => z.classList.toggle('on', z.dataset.t === '%')); inp.value = b.dataset.r; calc(); });
      inp.oninput = calc; setTimeout(() => { try{ inp.focus(); }catch(e){} }, 40); calc();
      ov.querySelector('[data-ok]').onclick = async () => {
        const c = calc(); if(!(c.v > 0) || (tipo === '%' && c.v > 100) || (tipo === '$' && c.v > bruto)){ aviso('⚠️ Escribe un descuento válido.'); return; }
        const que = 'hacer un descuento de ' + (tipo === '%' ? c.v + ' %' : plata(c.v));
        let por = '';
        if(!jefeAhora()){
          const A = window.ventoVentaFix; const r = A && A.autorizar ? await A.autorizar(que) : null;
          if(!r){ aviso('🔒 El descuento necesita la autorización del dueño.'); return; }
          por = 'autorizado con clave';
        }
        const mm = meta(); mm.desc = { tipo, v: c.v, por: por || '', quien: (typeof authUser !== 'undefined' && authUser) || '' }; ponerMeta(mm);
        auditar('descuento en la caja', que + (por ? ' (' + por + ')' : ''));
        fin(); pintarCaja(root); aviso('🏷️ Descuento de ' + plata(c.x) + ' aplicado.');
      };
    });
  }
  function pedirNota(root){
    const m = meta();
    ventanita('<h2>📝 Nota de la venta</h2><div class="modal-sub">Queda guardada en la venta (ej. «sin cebolla», «para llevar», «cliente frecuente»).</div>' +
      '<textarea class="pz-nv" maxlength="140" rows="3" placeholder="Escribe la nota">' + esc(m.nota || '') + '</textarea>' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary" data-ok>Guardar</button></div>', (ov, fin) => {
      const t = ov.querySelector('.pz-nv'); setTimeout(() => { try{ t.focus(); }catch(e){} }, 40);
      ov.querySelector('[data-ok]').onclick = () => { const mm = meta(); const v = t.value.trim().slice(0, 140); if(v) mm.nota = v; else delete mm.nota; ponerMeta(mm); fin(); pintarCaja(root); };
    });
  }
  // 👤 Cliente de la venta (F3 de la Caja Inteligente). Con la DIAN prendida se usa su ventana (cédula / NIT).
  function pedirCliente(root){
    const m = meta();
    ventanita('<h2>👤 Cliente de la venta</h2><div class="modal-sub">Queda en la observación de la venta y en el recibo.</div>' +
      '<input class="pz-cli" maxlength="40" placeholder="Nombre del cliente" autocomplete="off" value="' + esc((m.cli && m.cli.nombre) || '') + '">' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary" data-ok>Guardar</button></div>', (ov, fin) => {
      const n = ov.querySelector('.pz-cli'); setTimeout(() => { try{ n.focus(); }catch(e){} }, 40);
      const ok = () => { const v = n.value.trim().slice(0, 40), mm = meta(); if(v) mm.cli = { nombre: v }; else delete mm.cli; ponerMeta(mm); fin(); if(root) pintarCaja(root); };
      ov.querySelector('[data-ok]').onclick = ok; n.onkeydown = e => { if(e.key === 'Enter') ok(); };
    });
  }
  // ⏸️ Sin ventana (por voz): queda con el nombre «Venta de las 3:45 p. m.».
  function suspenderYa(nombre){
    const L = cart(); if(!L.length) return '';
    const hora = new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    const n = String(nombre || '').trim().slice(0, 40) || 'Venta de las ' + hora;
    const l = pendientes(); l.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), nombre: n, lineas: L.map(x => Object.assign({}, x)), meta: meta() });
    ponerPendientes(l); carrito = []; guardarCarrito(); ponerMeta({});
    auditar('venta suspendida', n); pintarTodo();
    return n;
  }
  function suspender(root){
    const L = cart(); if(!L.length) return;
    ventanita('<h2>⏸️ Suspender la venta</h2><div class="modal-sub">Queda guardada en este equipo para cobrarla después («📂 Pendientes»). La caja queda libre.</div>' +
      '<input class="pz-sn" maxlength="40" placeholder="¿A nombre de quién? (opcional)" autocomplete="off">' +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cancelar</button><button type="button" class="btn-primary" data-ok>Suspender</button></div>', (ov, fin) => {
      const n = ov.querySelector('.pz-sn'); setTimeout(() => { try{ n.focus(); }catch(e){} }, 40);
      const ok = () => {
        const hora = new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
        const l = pendientes(); l.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: Date.now(), nombre: n.value.trim().slice(0, 40) || 'Venta de las ' + hora, lineas: L.map(x => Object.assign({}, x)), meta: meta() });
        ponerPendientes(l); carrito = []; guardarCarrito(); ponerMeta({});
        auditar('venta suspendida', l[l.length - 1].nombre);
        fin(); pintarTodo(); aviso('⏸️ Venta suspendida. Recupérala en «📂 Pendientes».');
      };
      ov.querySelector('[data-ok]').onclick = ok; n.onkeydown = e => { if(e.key === 'Enter') ok(); };
    });
  }
  function verPendientes(root){
    const l = pendientes();
    const tot = x => { const p = Math.round(x.lineas.reduce((s, y) => s + (Number(y.price) || 0) * (Number(y.qty) || 0), 0)); return p - descuentoDe(p, (x.meta || {}).desc); };
    ventanita('<h2>📂 Ventas pendientes</h2>' + (l.length ? '<div class="pz-pl">' + l.slice().reverse().map(x => '<div class="pz-pf" data-id="' + esc(x.id) + '"><div><b>' + esc(x.nombre) + '</b><small>' + x.lineas.length + ' producto' + (x.lineas.length === 1 ? '' : 's') + ' · ' + new Date(x.t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + '</small></div><b>' + plata(tot(x)) + '</b><button type="button" class="btn-primary" data-rec="1">Recuperar</button><button type="button" class="btn-ghost" data-del="1" aria-label="Borrar">🗑</button></div>').join('') + '</div>' : '<div class="pz-vacio">No hay ventas pendientes.</div>') +
      '<div class="modal-actions"><button type="button" class="btn-close" data-cerrar>Cerrar</button></div>', (ov, fin) => {
      ov.addEventListener('click', async e => {
        const f = e.target.closest('[data-id]'); if(!f) return;
        const id = f.dataset.id, x = pendientes().find(y => y.id === id); if(!x) return;
        if(e.target.closest('[data-rec]')){
          if(cart().length){ aviso('⚠️ Cobra o suspende primero la venta que tienes en la caja.', 4500); return; }
          carrito = x.lineas.map(y => Object.assign({}, y)); guardarCarrito(); ponerMeta(x.meta || {});
          ponerPendientes(pendientes().filter(y => y.id !== id));
          fin(); pintarTodo(); aviso('📂 Recuperada: ' + x.nombre);
        } else if(e.target.closest('[data-del]')){
          fin();   // la confirmación sale encima (antes quedaba detrás de esta lista y no se podía tocar)
          let ok = true; try{ ok = await showConfirm({ title: '¿Borrar la venta pendiente?', message: x.nombre + ' · ' + plata(tot(x)) + '. No se cobró: no afecta la caja ni el inventario.', confirmText: 'Sí, borrar', icon: '🗑️' }); }catch(er){}
          if(ok){ ponerPendientes(pendientes().filter(y => y.id !== id)); auditar('venta pendiente borrada', x.nombre); }
          pintarTodo(); if(pendientes().length) verPendientes(root);
        }
      });
    });
  }
  // 🔁 Repetir una venta: sus productos (con el precio de HOY) pasan a la caja.
  function repetir(h){
    if(!h || bloqueado()) return;
    if(cart().length){ aviso('⚠️ Cobra o suspende primero la venta que tienes en la caja.', 4500); return; }
    const d = D(); let n = 0, faltan = 0;
    (h.items || []).forEach(it => {
      if(/domicilio|propina/i.test(it.name || '')) return;
      const p = (it.productId && producto(it.productId)) || ((d && d.products) || []).find(x => sinTilde(x.name) === sinTilde(it.name));
      if(!p){ faltan++; return; }
      if(EQ() && EQ().unidadDe(p)){ if(caja.add(p, Number(it.qty) || 0, true)) n++; }
      else if(caja.add(p, Math.max(1, Math.round(Number(it.qty) || 1)))) n++;
    });
    pintarTodo();
    aviso(n ? '🔁 ' + n + ' producto' + (n === 1 ? '' : 's') + ' en la caja (con el precio de hoy)' + (faltan ? '; ' + faltan + ' ya no existe' + (faltan === 1 ? '' : 'n') : '') + '.' : 'Esos productos ya no existen.', 4500);
  }

  // ---------- 📲 Pagar con QR: el QR de pago del negocio (Ajustes → QR de pago) en grande, con el total ----------
  // Si mientras está en pantalla llega un pago confirmado por ese valor exacto (Nequi, DaviPlata, Bre-B), se cobra solo;
  // si no, «✅ Ya pagó» (lo confirma quien cobra, como siempre). El pago queda como transferencia en la venta.
  function qrPago(){ const d = D(), q = d && d.qrPago; return q && (q.orig || q.img) ? q : null; }
  function mostrarQr(total, fin){
    const q = qrPago(); if(!q) return;
    const viejo = $('pzQrOv'); if(viejo && viejo._fin) viejo._fin();
    const ov = document.createElement('div');
    ov.id = 'pzQrOv'; ov.className = 'overlay show pz-qr-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal pz-qr" role="dialog" aria-modal="true" aria-label="Pagar con QR"><div class="pz-qr-tot"><span>Que el cliente pague</span><b>' + plata(total) + '</b></div>' +
      '<img class="pz-qr-img" alt="QR de pago" src="' + esc(q.orig || q.img) + '">' +
      '<div class="pz-qr-txt">' + esc('Abra su app' + (q.tipo ? ' (' + q.tipo + ')' : ' del banco') + ' → Pagar con QR → apunte aquí') + (q.llave ? '<small>Llave: ' + esc(q.llave) + '</small>' : '') + '</div>' +
      '<div class="pz-qr-est" aria-live="polite">⏳ Esperando el pago…</div>' +
      '<button type="button" class="pz-qr-ok">✅ Ya pagó</button><button type="button" class="btn-close pz-qr-no">← Volver</button></div>';
    document.body.appendChild(ov);
    const orig = window.pagoLlego;
    let listo = false;
    const soltar = () => { if(window.pagoLlego === espera) window.pagoLlego = orig; };
    const cerrar = () => { soltar(); ov.remove(); };
    const pagar = (nota, metodo) => { if(listo) return; listo = true; cerrar(); fin({ method: 'transferencia', nota, metodo, vueltas: 0 }); };
    const espera = function(x, aMano){
      const ok = x && !aMano && !x.aplicado && Number(x.monto) === Math.round(total) && (!x.estado || x.estado === 'app' || x.estado === 'ok');
      if(!ok) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      x.aplicado = true; x.estado = 'ok'; x.caja = true; guardar();
      const banco = x.metodo ? String(x.metodo).charAt(0) + String(x.metodo).slice(1).toLowerCase() : (q.tipo || 'QR');
      const e = ov.querySelector('.pz-qr-est'); if(e){ e.textContent = '✅ ¡Llegó! ' + plata(x.monto) + ' por ' + banco; e.classList.add('ok'); }
      son('success');
      setTimeout(() => pagar(banco + ' (QR)', 'qr'), 1200);
    };
    window.pagoLlego = espera;
    ov._fin = () => { cerrar(); };          // botón Atrás del celular
    ov.addEventListener('click', e => {
      if(e.target.closest('.pz-qr-ok')) return pagar((q.tipo || 'QR') + ' (QR)', 'qr');
      if(e.target.closest('.pz-qr-no') || e.target === ov) cerrar();
    });
  }

  // ---------- «↩ Deshacer» grande por 5 segundos (en vez de preguntar antes) ----------
  let deshacerT = null;
  // extra: [[texto, fn], …] botones al lado de «Deshacer» (p. ej. «🧾 Recibo»); con ellos dura 8 s.
  function deshacer(msg, fn, extra){
    let b = $('pzDeshacer');
    if(!b){ b = document.createElement('div'); b.id = 'pzDeshacer'; b.setAttribute('role', 'status'); b.setAttribute('data-novocab', ''); document.body.appendChild(b); }
    const ms = extra && extra.length ? 8000 : 5000;
    // «↩ Deshacer» va primero (donde siempre ha estado); los botones extra van después.
    b.innerHTML = '<span class="pz-dmsg"></span><button type="button" class="pz-dbtn">↩ Deshacer</button>' +
      (extra || []).map((x, i) => '<button type="button" class="pz-dbtn pz-dextra" data-ex="' + i + '">' + esc(x[0]) + '</button>').join('') +
      '<i class="pz-dbar" style="animation-duration:' + (ms / 1000) + 's"></i>';
    b.querySelector('.pz-dmsg').textContent = msg;
    b.hidden = false;
    clearTimeout(deshacerT);
    b.querySelector('.pz-dbtn:not(.pz-dextra)').onclick = () => { clearTimeout(deshacerT); b.hidden = true; try{ fn(); }catch(e){} };
    b.querySelectorAll('.pz-dextra').forEach(x => { x.onclick = () => { clearTimeout(deshacerT); b.hidden = true; try{ extra[+x.dataset.ex][1](); }catch(e){} }; });
    deshacerT = setTimeout(() => { b.hidden = true; }, ms);
  }

  // ---------- 🧾 Recibo de una venta: imprimir, WhatsApp o imagen (las mismas funciones del recibo de la cuenta) ----------
  function recibo(entry){
    if(!entry) return;
    let rd = null; try{ rd = typeof histReceiptData === 'function' ? histReceiptData(entry) : null; }catch(e){}
    if(!rd){ aviso('No se pudo armar el recibo.'); return; }
    const ov = document.createElement('div');
    ov.className = 'overlay show pz-recibo-ov'; ov.setAttribute('data-novocab', '');
    ov.innerHTML = '<div class="modal pz-recibo" role="dialog" aria-modal="true" aria-label="Recibo"><h2>🧾 Recibo · ' + plata(entry.total) + '</h2>' +
      '<div class="pz-recibo-btns"><button type="button" class="btn-primary" data-r="print">🖨️ Imprimir</button><button type="button" class="btn-ghost" data-r="wa">💬 WhatsApp</button><button type="button" class="btn-ghost" data-r="img">🖼️ Imagen</button></div>' +
      '<button type="button" class="btn-close" data-r="x">Cerrar</button></div>';
    const fin = () => ov.remove(); ov._fin = fin;
    ov.addEventListener('click', e => {
      if(e.target === ov) return fin();
      const b = e.target.closest('[data-r]'); if(!b) return;
      const k = b.dataset.r;
      try{
        if(k === 'print') printReceipt(rd);
        else if(k === 'wa') whatsappShareText(buildReceiptText(rd));
        else if(k === 'img') shareReceiptImage(rd);
      }catch(x){ aviso('No se pudo: ' + (x && x.message || x)); }
      fin();
    });
    document.body.appendChild(ov);
  }

  // ---------- 📊 Caja de hoy: cuánto se vendió y cómo pagaron (y los recibos de cada venta) ----------
  function cajaDeHoy(){
    const r = ventasDeHoy(), por = {};
    r.ventas.forEach(h => (h.payments || []).forEach(p => {
      const a = Number(p.amount) || 0, n = p.method === 'efectivo' ? '💵 Efectivo' : p.method === 'debe' ? '📝 Fiado' : /nequi/i.test(p.note) ? '💜 Nequi' : /davi/i.test(p.note) ? '🔴 DaviPlata' : /tarjeta/i.test(p.note) ? '💳 Tarjeta' : '📲 Transferencia';
      por[n] = (por[n] || 0) + a;
    }));
    const hora = h => { const t = h.date ? new Date(h.date) : new Date(Number(h.t) || Date.now()); return t.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); };
    const ov = document.createElement('div');
    ov.className = 'overlay show pz-hoy-ov'; ov.setAttribute('data-novocab', '');
    const ult = r.ventas.slice(0, 30);
    ov.innerHTML = '<div class="modal pz-hoy" role="dialog" aria-modal="true" aria-label="Caja de hoy"><h2>📊 Caja de hoy</h2>' +
      '<div class="pz-hoy-tot"><span>' + r.ventas.length + (r.ventas.length === 1 ? ' venta' : ' ventas') + '</span><b>' + plata(r.total) + '</b></div>' +
      '<div class="pz-hoy-met">' + (Object.keys(por).length ? Object.keys(por).map(k => '<div><span>' + esc(k) + '</span><b>' + plata(por[k]) + '</b></div>').join('') : '<div class="pz-vacio">Todavía no hay ventas hoy.</div>') + '</div>' +
      (ult.length ? '<div class="pz-hoy-lista">' + ult.map((h, i) => '<div class="pz-hoy-v"><span>' + esc(hora(h)) + ' · ' + esc(h.tableName || (h.table != null ? etiqueta(h.table) : 'Venta')) + '</span><b>' + plata(h.total) + '</b><button type="button" class="btn-ghost" data-rep="' + i + '" aria-label="Repetir esta venta" title="Repetir">🔁</button><button type="button" class="btn-ghost" data-rec="' + i + '" aria-label="Recibo">🧾</button></div>').join('') + '</div>' : '') +
      (window.ventoCuadreHtml ? window.ventoCuadreHtml() : '') +   // 💜 cuadre de Nequi / DaviPlata / Bre-B (lib/vento-confirma.js)
      (window.ventoTurno ? window.ventoTurno.bloqueHoy() : '') +   // 💵 base, entradas / salidas y lo que debe haber (lib/vento-turno.js)
      '<button type="button" class="btn-close" data-x="1">Cerrar</button></div>';
    const fin = () => ov.remove(); ov._fin = fin;
    ov.addEventListener('click', e => {
      if(e.target === ov || e.target.closest('[data-x]')) return fin();
      const b = e.target.closest('[data-rec]'); if(b){ const h = ult[+b.dataset.rec]; fin(); recibo(h); return; }
      const rp = e.target.closest('[data-rep]'); if(rp){ const h = ult[+rp.dataset.rep]; fin(); repetir(h); }
    });
    document.body.appendChild(ov);
  }

  // ---------- Lector de código de barras (USB o Bluetooth): escribe como un teclado muy rápido y termina en Enter ----------
  // Con la caja a la vista, lee el código AUNQUE el cursor no esté en el buscador. «3*» antes del código = 3 unidades.
  // Código nuevo: se ofrece crear el producto con ese código (queda guardado para la próxima).
  function porCodigo(root, raw, n){
    raw = String(raw || '').trim(); if(!raw) return false;
    const src = (root && root._pz && root._pz.src) || caja;
    // 🏷️ Etiqueta de la balanza (código que empieza por 2): el producto con su peso o su precio.
    const et = EQ() && src === caja ? EQ().etiqueta(raw) : null;
    if(et && et.qty > 0){ if(caja.add(et.p, et.qty, true)){ if(root) pintarCaja(root); pintarTodo(); aviso('✅ ' + EQ().pesoTxt(et.qty, EQ().unidadDe(et.p) || 'kg') + ' de ' + et.p.name); } return true; }
    let p = null; try{ p = typeof findProductByScannedCode === 'function' ? findProductByScannedCode(raw) : null; }catch(e){}
    const meter = prod => { if(src.add(prod, n)){ if(root) pintarCaja(root); pintarTodo(); aviso('✅ ' + (n > 1 ? n + ' × ' : '') + prod.name); } };
    if(p){ meter(p); return true; }
    try{ son('remove'); }catch(e){}
    try{ if(typeof handleUnknownScannedCode === 'function'){ handleUnknownScannedCode(raw, meter, { canCreate: true }); return true; } }catch(e){}
    aviso('No encontré el código ' + raw + '.');
    return false;
  }
  // «3*7702004003508», «3x7702…» o «3 * 7702…»: cantidad y código.
  function conCantidad(v){ const m = String(v || '').trim().match(/^(\d{1,3})\s*[x×*]\s*(\S.*)$/i); return m ? { n: +m[1], cod: m[2].trim() } : { n: 1, cod: String(v || '').trim() }; }
  // 📱 1.65.6: el celular lector (lib/vento-lector-cel.js) manda aquí lo que lee, igual que una pistola lectora:
  // a la caja a la vista (flotante o de la pantalla principal) o a la del modo fácil (vender, venta rápida, una mesa).
  function cajaFacil(){
    const app = $('facilApp'), el = $('fzMain') && $('fzMain').firstElementChild;
    if(!app || app.hidden || !el || !el._pz || !/^(caja|caja-rapida|mesa:)/.test(el.dataset.pant || '') || document.querySelector('.overlay.show')) return null;
    return el;
  }
  (window.ventoLectorDestinos = window.ventoLectorDestinos || []).push(
    { nombre: 'caja', prioridad: 30, activo: () => !!cajaVisible(), hint: '🧾 Caja: cada código se suma a la venta', leer: c => { const r = cajaVisible(), x = conCantidad(c); if(r) porCodigo(r, x.cod, x.n); } },
    { nombre: 'caja-facil', prioridad: 30, activo: () => !!cajaFacil(), hint: () => { const el = cajaFacil(); return /^mesa:/.test(el && el.dataset.pant || '') ? '🧾 ' + ((el._pz && el._pz.titulo) || 'La cuenta') + ': cada código se suma' : '🧾 Caja: cada código se suma a la venta'; },
      leer: c => { const r = cajaFacil(), x = conCantidad(c); if(r) porCodigo(r, x.cod, x.n); } });
  // ¿Qué caja está a la vista? (la flotante, o la de la pantalla principal si no hay otra ventana encima)
  function cajaVisible(){
    const ov = $('pzCajaOv');
    if(ov && ov.classList.contains('show')){
      const encima = [...document.querySelectorAll('.overlay.show')].filter(x => x !== ov && !x.contains(ov));
      return encima.length ? null : ov.querySelector('.pz-caja-root');
    }
    const el = $('posPanel');
    if(!el || el.hidden || !el.offsetParent || document.querySelector('.overlay.show') || facilActivo()) return null;
    return el;
  }
  let lecBuf = '', lecUlt = 0;
  document.addEventListener('keydown', e => {
    if(e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target, campo = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if(campo) { lecBuf = ''; return; }          // escribiendo en un campo (el buscador lo maneja con su Enter)
    const root = cajaVisible(); if(!root){ lecBuf = ''; return; }
    const ahora = Date.now();
    if(e.key === 'Enter'){
      if(lecBuf.length >= 4 && ahora - lecUlt < 150){
        e.preventDefault(); e.stopPropagation();
        const q = root.querySelector('.pz-q'), pre = q && /^\s*\d{1,3}\s*[x×*]\s*$/i.test(q.value) ? conCantidad(q.value + '0').n : 1;
        if(pre > 1 && q){ q.value = ''; if(root._pz) root._pz.q = ''; }
        porCodigo(root, lecBuf, pre);
      }
      lecBuf = ''; return;
    }
    if(e.key && e.key.length === 1){ if(ahora - lecUlt > 100) lecBuf = ''; lecBuf += e.key; lecUlt = ahora; }
  }, true);

  // ---------- 🧾 Caja (POS) en CUALQUIER modo: también en restaurante, en pantalla completa ----------
  function abrirCaja(){
    if(bloqueado()) return;
    let ov = $('pzCajaOv');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'pzCajaOv'; ov.className = 'overlay pz-caja-ov'; ov.setAttribute('data-novocab', ''); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Caja');
      ov.innerHTML = '<div class="pz-caja-wrap"><div class="pz-caja-top"><b>🧾 Caja</b><span class="pz-lector" title="Conecta un lector de código de barras (USB o Bluetooth): lee aunque el cursor no esté en el buscador">▦<span class="pz-lt"> Lector listo</span></span><button type="button" class="btn-ghost" data-hoy="1">📊 Caja de hoy</button><button type="button" class="btn-ghost pz-cajon-btn" hidden>💵 Cajón</button><button type="button" class="btn-close" data-pzx="1">✕ Cerrar</button></div><div class="pz-caja-root"></div></div>';
      ov.addEventListener('click', e => {
        if(e.target.closest('[data-pzx]')) return cerrarCaja();
        if(e.target.closest('[data-hoy]')) return cajaDeHoy();
      });
      ov._fin = () => cerrarCaja();
      document.body.appendChild(ov);
    }
    ov.classList.add('show');
    montarCaja(ov.querySelector('.pz-caja-root'), caja, { variante: 'tienda', flotante: true });
    setTimeout(() => { const q = ov.querySelector('.pz-q'); if(q && !('ontouchstart' in window)) try{ q.focus({ preventScroll: true }); }catch(e){} }, 60);
  }
  function cerrarCaja(){ const ov = $('pzCajaOv'); if(ov) ov.classList.remove('show'); }

  // ---------- La caja: buscador + productos + carrito (sirve para tienda, mixto y el modo fácil) ----------
  // opt.variante: 'tienda' (completa) | 'mixto' (compacta) | 'grande' (modo fácil). opt.titulo / opt.atras / opt.mic.
  function montarCaja(root, src, opt){
    let st = root._pz;
    if(!st || st.variante !== opt.variante || st.titulo !== (opt.titulo || '')){
      st = root._pz = { variante: opt.variante, titulo: opt.titulo || '', q: '', cat: '' };
      const g = opt.variante === 'grande', mixto = opt.variante === 'mixto';
      root.innerHTML =
        (g && (opt.titulo || opt.atras) ? '<div class="fz-barra">' + (opt.atras ? '<button type="button" class="fz-atras" data-atras="1">← ' + esc(unidad()[1]) + '</button>' : '') +
          '<b class="fz-titulo">' + esc(opt.titulo || '') + '</b>' + (opt.mic && hayVoz() ? '<button type="button" class="pz-mic" data-mic="1">🎤 Decir pedido</button>' : '') +
          (typeof openScanOverlay === 'function' ? '<button type="button" class="pz-mic fz-scan" data-scan="1" aria-label="Leer el código de barras o QR del producto con la cámara">📷 Leer código</button>' : '') +
          '</div>' : '') +
        '<div class="pz pz-' + opt.variante + '">' +
          '<div class="pz-prod">' +
            '<div class="pz-buscar"' + (g && ((D() || {}).products || []).length <= 12 ? ' hidden' : '') + '><input type="search" class="pz-q" placeholder="🔍 ' + (g ? 'Buscar' : 'Buscar producto o código') + '" autocomplete="off" enterkeyhint="done" aria-label="Buscar producto">' +
              (g ? '' : '<button type="button" class="pz-scan" data-scan="1" title="Escanear con la cámara (código de barras o QR)" aria-label="Escanear con la cámara">📷</button>') + '</div>' +
            (mixto || g ? '' : '<div class="pz-cats"></div>') +
            '<div class="pz-grid"></div>' +
            (opt.variante === 'tienda' && !opt.flotante ? '<div class="pz-cuentas"></div>' : '') +
            (opt.variante === 'tienda' && !opt.flotante ? '<div class="pz-herr"><span class="pz-lector" title="Conecta un lector de código de barras (USB o Bluetooth): lee aunque el cursor no esté en el buscador">▦ Lector de código de barras listo</span><button type="button" class="btn-ghost" data-hoy="1">📊 Caja de hoy</button><button type="button" class="btn-ghost" data-fiados="1">📒 Fiados</button></div>' : '') +
          '</div>' +
          '<aside class="pz-cart" aria-label="Lo que se está vendiendo">' +
            '<div class="pz-cart-h"><b>' + (g && src.tipo === 'mesa' ? '🧾 Lo pedido' : '🛒 Venta') + '</b><span class="pz-n"></span>' + (g ? '' : '<button type="button" class="pz-vaciar" data-vaciar="1">Vaciar</button>') + '</div>' +
            '<div class="pz-lineas"></div>' +
            (g ? '' : '<div class="pz-extra"></div><div class="pz-herr2"></div>') +
            '<div class="pz-pie"><div class="pz-total"><span>TOTAL</span><b>' + plata(0) + '</b></div><button type="button" class="pz-cobrar" disabled>💵 COBRAR</button></div>' +
          '</aside>' +
        '</div>';
      const q = root.querySelector('.pz-q');
      q.addEventListener('input', () => { st.q = q.value; pintarProductos(root); });
      q.addEventListener('keydown', e => {
        if(e.key !== 'Enter') return;
        e.preventDefault();
        const v0 = q.value.trim(); if(!v0) return;
        // «3*código» o «3x código»: esa cantidad (con el lector o escrito a mano).
        const cc = conCantidad(v0), v = cc.cod, n = cc.n;
        // Lector de código de barras (teclado) o una sola coincidencia: se agrega de una.
        let p = null; try{ p = typeof findProductByScannedCode === 'function' ? findProductByScannedCode(v) : null; }catch(x){}
        if(!p){ const L = productos(v, ''); if(L.length === 1) p = L[0]; }
        if(p && root._pz.src.add(p, n)){ q.value = ''; st.q = ''; pintarCaja(root); return; }
        // Parece un código (solo números, 6 o más) que no está: se ofrece crear el producto con ese código.
        if(!p && /^\d{6,14}$/.test(v) && root._pz.src === caja){ q.value = ''; st.q = ''; pintarProductos(root); porCodigo(root, v, n); }
      });
      if(!root._pzClic){ root._pzClic = true; root.addEventListener('click', e => clicCaja(root, e)); }   // una sola vez por contenedor
    }
    st.src = src; st.opt = opt;
    pintarCaja(root);
    try{ window.ventoCajaVoz && window.ventoCajaVoz.montar(root, opt); }catch(e){}   // 🎙️ Caja Inteligente 2.0
  }
  function clicCaja(root, e){
    const st = root._pz, src = st && st.src; if(!src) return;
    const t = e.target.closest('button'); if(!t || !root.contains(t)) return;
    if(Date.now() < quietoHasta && (t.dataset.add || t.classList.contains('pz-cobrar'))) return;
    if(t.dataset.add){ const p = producto(t.dataset.add); if(p && src.add(p)) pintarCaja(root); return; }
    if(t.dataset.menos != null){ src.menos(clave(src, t.dataset.menos)); pintarCaja(root); return; }
    if(t.dataset.mas != null){ src.mas(clave(src, t.dataset.mas)); pintarCaja(root); return; }
    if(t.dataset.quitar != null){ src.quitar(clave(src, t.dataset.quitar)); pintarCaja(root); return; }
    if(t.dataset.cat != null){ st.cat = t.dataset.cat; pintarProductos(root); return; }
    if(t.classList.contains('pz-cobrar')){ src.cobrar({ grande: st.variante === 'grande' }); return; }
    if(t.dataset.vaciar){ vaciarCarrito(); return; }
    if(t.dataset.scan){ escanear(src, root); return; }
    if(t.dataset.cuentas){ document.body.classList.toggle('pz-ver-cuentas'); pintarCuentas(root); return; }
    if(t.dataset.domicilio){ const b = $('domicilioBtn'); if(b) b.click(); return; }
    if(t.dataset.atras){ fz.mesa = null; fz.caja = false; pintarFacil(); return; }
    if(t.dataset.mic){ decirPedido(); return; }
    if(t.dataset.hoy){ cajaDeHoy(); return; }
    if(t.dataset.fiados){ if(window.libretaAbrir) window.libretaAbrir(); return; }
    if(t.dataset.desc){ pedirDescuento(root); return; }
    if(t.dataset.sindesc){ const m = meta(); delete m.desc; ponerMeta(m); pintarCaja(root); aviso('🏷️ Descuento quitado.'); return; }
    if(t.dataset.nota){ pedirNota(root); return; }
    if(t.dataset.sincli){ const m = meta(); delete m.cli; ponerMeta(m); pintarCaja(root); return; }
    if(t.dataset.susp){ suspender(root); return; }
    if(t.dataset.pend){ verPendientes(root); return; }
  }
  const clave = (src, k) => src.tipo === 'mesa' ? Number(k) : k;
  function pintarCaja(root){ pintarProductos(root); pintarCarrito(root); pintarCuentas(root); }
  function pintarProductos(root){
    const st = root._pz, src = st.src, d = D(); if(!d) return;
    const grid = root.querySelector('.pz-grid'), cats = root.querySelector('.pz-cats');
    if(cats){
      const C = (d.categories || []).filter(c => (d.products || []).some(p => p.categoryId === c.id));
      const hayFav = (d.products || []).some(p => p.favorite);
      if(st.cat && st.cat !== 'fav' && st.cat !== 'rec' && !C.some(c => c.id === st.cat)) st.cat = '';
      cats.hidden = !C.length && !hayFav;
      const hayRec = ((d.history || []).length > 0);
      if(hayRec) cats.hidden = false;
      cats.innerHTML = cats.hidden ? '' : [['', 'Todos']].concat(hayFav ? [['fav', '⭐ Favoritos']] : [], hayRec ? [['rec', '🕘 Recientes']] : [], C.map(c => [c.id, c.name]))
        .map(c => '<button type="button" data-cat="' + esc(c[0]) + '"' + (st.cat === c[0] ? ' class="on"' : '') + '>' + esc(c[1]) + '</button>').join('');
    }
    const max = st.variante === 'mixto' ? 24 : 80;
    const L = productos(st.q, st.cat), ver = L.slice(0, max);
    if(!(d.products || []).length){ grid.innerHTML = '<div class="pz-vacio">Todavía no tienes productos. Agrégalos en ' + (fz.tab && facilActivo() ? '«⋯ Más» → Productos' : 'la pestaña Productos') + '.</div>'; return; }
    if(!L.length){ grid.innerHTML = '<div class="pz-vacio">No encontré «' + esc(st.q) + '».</div>'; return; }
    grid.innerHTML = ver.map(p => {
      const n = src.cuanto(p.id), sinStock = p.stock != null && p.stock <= 0, poco = p.stock != null && !sinStock && p.stock <= (p.minStock != null ? p.minStock : 3);
      return '<button type="button" class="pz-tile' + (n ? ' en' : '') + '" data-add="' + esc(p.id) + '" aria-label="' + esc(p.name + ', ' + plata(p.price)) + '">' +
        caraHtml(p) + '<span class="pz-nom">' + esc(p.name) + (p.size ? ' <small>' + esc(p.size) + '</small>' : '') + '</span><span class="pz-pre">' + plata(p.price) + '</span>' +
        (n ? '<span class="pz-cant">' + n + '</span>' : '') + (sinStock ? '<span class="pz-stock">Agotado</span>' : poco ? '<span class="pz-stock">Quedan ' + p.stock + '</span>' : '') + '</button>';
    }).join('') + (L.length > ver.length ? '<div class="pz-mas">… y ' + (L.length - ver.length) + ' más: búscalos arriba.</div>' : '');
  }
  function pintarCarrito(root){
    const st = root._pz, src = st.src, g = st.variante === 'grande';
    const L = src.lineas(), total = Math.round(L.reduce((s, x) => s + x.price * x.qty, 0)), unid = L.reduce((s, x) => s + (x.unidad ? 1 : Number(x.qty) || 0), 0);
    const cartEl = root.querySelector('.pz-cart'); cartEl.classList.toggle('vacio', !L.length);
    root.querySelector('.pz-n').textContent = unid ? unid + (unid === 1 ? ' producto' : ' productos') : '';
    const vac = root.querySelector('.pz-vaciar'); if(vac) vac.hidden = !L.length;
    root.querySelector('.pz-lineas').innerHTML = L.length ? L.map(x =>
      '<div class="pz-linea">' + (g ? '' : '<span class="pz-lmini" aria-hidden="true">' + caraHtml(producto(x.id) || { name: x.name }) + '</span>') + '<div class="pz-ln"><b>' + (g ? cantTxt(x) + ' × ' : '') + esc(x.name) + '</b><small>' + (g ? plata(x.price * x.qty) : plata(x.price) + (x.unidad ? (x.unidad === 'lb' ? ' la libra · ' : ' el kilo · ') + cantTxt(x) : ' c/u')) + '</small></div>' +
      (g ? '<div class="pz-step"><button type="button" data-menos="' + esc(x.k) + '" aria-label="Quitar uno de ' + esc(x.name) + '">−</button></div>'
         : '<div class="pz-step"><button type="button" data-menos="' + esc(x.k) + '" aria-label="Quitar uno">−</button><span>' + (x.unidad ? '⚖️' : x.qty) + '</span><button type="button" data-mas="' + esc(x.k) + '" aria-label="' + (x.unidad ? 'Pesar más' : 'Sumar uno') + '">+</button></div>' +
           '<b class="pz-sub">' + plata(x.price * x.qty) + '</b><button type="button" class="pz-x" data-quitar="' + esc(x.k) + '" aria-label="Quitar ' + esc(x.name) + '">✕</button>') +
      '</div>').join('') : '<div class="pz-vacio">' + (g ? 'Toca un producto para agregarlo.' : 'Toca un producto para venderlo.') + '</div>';
    // 🏷️ descuento y 📝 nota (solo la caja; las cuentas de mesa tienen su propio cobro)
    let neto = total;
    const ex = root.querySelector('.pz-extra'), hr = root.querySelector('.pz-herr2');
    if(ex && hr){
      const esCaja = src === caja, m = esCaja ? meta() : {}, desc = esCaja ? descuentoDe(total, m.desc) : 0;
      neto = total - desc;
      ex.innerHTML = (desc ? '<div class="pz-desc"><span>🏷️ Descuento' + (m.desc.tipo === '%' ? ' ' + m.desc.v + ' %' : '') + (m.desc.por ? ' · ' + esc(m.desc.por) : '') + '</span><b>−' + plata(desc) + '</b><button type="button" class="pz-x" data-sindesc="1" aria-label="Quitar el descuento">✕</button></div>' : '') +
        (m.nota ? '<div class="pz-notav">📝 ' + esc(m.nota) + '</div>' : '') +
        (m.cli && m.cli.nombre ? '<div class="pz-notav">👤 ' + esc(m.cli.nombre) + (m.cli.dian ? ' · 🧾' : '') + ' <button type="button" class="pz-x" data-sincli="1" aria-label="Quitar el cliente">✕</button></div>' : '');
      const np = esCaja ? pendientes().length : 0;
      hr.hidden = !esCaja || (!L.length && !np);
      hr.innerHTML = !esCaja ? '' : (L.length ? '<button type="button" data-desc="1">🏷️ Descuento</button><button type="button" data-nota="1">📝 Nota</button><button type="button" data-susp="1">⏸️ Suspender</button>' : '') +
        (np ? '<button type="button" data-pend="1">📂 Pendientes (' + np + ')</button>' : '');
    }
    root.querySelector('.pz-total b').textContent = plata(neto);
    const cb = root.querySelector('.pz-cobrar'); cb.disabled = !L.length;
    // Tienda en el celular: el micrófono flotante sube encima del carrito para no tapar COBRAR.
    if(st.variante === 'tienda' && cartEl.offsetHeight) try{ document.body.style.setProperty('--pz-cart-h', cartEl.offsetHeight + 'px'); }catch(e){}
  }
  // Tienda: si quedó alguna cuenta abierta de antes, un botón para verla y cobrarla (no se pierde nada).
  function pintarCuentas(root){
    const box = root.querySelector('.pz-cuentas'); if(!box) return;
    const d = D(), n = d ? Object.keys(d.tables || {}).filter(id => (d.tables[id].items || []).length).length : 0;
    const dom = $('domicilioBtn'), conDom = !!(dom && !dom.hidden && d && d.domiciliosOn);
    let html = conDom ? '<button type="button" class="btn-ghost pz-cuentas-btn' + (dom.classList.contains('btn-warn') ? ' btn-warn' : '') + '" data-domicilio="1">' + esc(dom.textContent) + '</button>' : '';
    if(!n) document.body.classList.remove('pz-ver-cuentas');
    else {
      const ver = document.body.classList.contains('pz-ver-cuentas'), pl = unidad()[1].toLowerCase();
      html += '<button type="button" class="btn-ghost pz-cuentas-btn" data-cuentas="1">' + (ver ? '▲ Ocultar ' + esc(pl) : '🧾 ' + esc(unidad()[1]) + ' abiertas (' + n + ') · ver y cobrar') + '</button>';
    }
    if(box._html !== html){ box._html = html; box.innerHTML = html; }
  }
  function escanear(src, root){
    if(typeof openScanOverlay !== 'function'){ aviso('Tu navegador no puede leer códigos con la cámara. Busca el producto a mano.'); return; }
    src = src || caja;
    openScanOverlay(raw => {
      let p = null; try{ p = findProductByScannedCode(raw); }catch(e){}
      const meter = prod => { if(src.add(prod)){ pintarTodo(); if(root && root._pz && src !== caja) pintarCaja(root); aviso('✅ ' + prod.name + ' agregado'); } };
      if(p) return meter(p);
      try{ handleUnknownScannedCode(raw, meter, { canCreate: src === caja }); }catch(e){ aviso('No encontré ese código.'); }   // 1.65.9: en la caja también «Es un producto nuevo»
    }, { hint: 'Escanea el código del producto para agregarlo a la venta — puedes escanear varios seguidos.' });
  }

  // ---------- Panel de la caja en la vista principal (tienda / mixto) ----------
  function pintarPos(){
    const el = $('posPanel'), d = D(), m = d ? modo() : 'restaurante';
    document.body.classList.toggle('modo-tienda', m === 'tienda');
    document.body.classList.toggle('modo-mixto', m === 'mixto');
    pintarModoBox();
    if(!el) return;
    if(m === 'restaurante'){ if(!el.hidden || el.innerHTML){ el.hidden = true; el.innerHTML = ''; el._pz = null; } document.body.classList.remove('pz-ver-cuentas'); return; }
    el.hidden = false;
    montarCaja(el, caja, { variante: m });
  }
  // Ajustes → Negocio → «Modo de trabajo».
  function pintarModoBox(){
    const box = $('modoTrabajoBox'); if(!box || !D()) return;
    const m = modo(), pl = unidad()[1];
    const ops = [['restaurante', '🍽️', 'Con ' + pl.toLowerCase(), 'Cada ' + unidad()[0].toLowerCase() + ' tiene su cuenta'], ['tienda', '🏪', 'Tienda (caja)', 'Buscas, cobras y listo. Sin ' + pl.toLowerCase()], ['mixto', '🔀', 'Mixto', 'Caja arriba y ' + pl.toLowerCase() + ' abajo']];
    const html = '<div class="settings-row pz-modo-row"><div class="settings-row-text"><strong>Modo de trabajo</strong><span>Cómo vendes en la pantalla principal. Puedes cambiarlo cuando quieras: no se borra nada.</span></div>' +
      '<div class="pz-modos" role="radiogroup" aria-label="Modo de trabajo">' + ops.map(o => '<button type="button" role="radio" aria-checked="' + (m === o[0]) + '" class="pz-modo' + (m === o[0] ? ' on' : '') + '" data-modo="' + o[0] + '"><i>' + o[1] + '</i><b>' + esc(o[2]) + '</b><small>' + esc(o[3]) + '</small></button>').join('') + '</div></div>';
    if(box._html === html) return;
    box._html = html; box.innerHTML = html;
    box.onclick = async e => {
      const b = e.target.closest('[data-modo]'); if(!b || b.dataset.modo === modo()) return;
      await ponerModo(b.dataset.modo);
      aviso('✅ Modo de trabajo: ' + b.querySelector('b').textContent + '.');
    };
  }

  // ---------- Modo fácil: cáscara con Vender / Hoy / Más ----------
  const fz = { tab: 'vender', mesa: null, caja: false, sub: '', edit: null, q: '' };
  function esMesero(){
    if(document.body.classList.contains('modo-mesero')) return true;
    try{ return !!usuario() && typeof authIsAdmin === 'function' && !authIsAdmin(); }catch(e){ return false; }
  }
  const facilActivo = () => { const d = D(); return !!(d && d.easyMode) && !!usuario() && !esMesero(); };
  function aplicarFacil(){
    const on = facilActivo();
    document.body.classList.toggle('facil-on', on);
    let app = $('facilApp');
    if(!on){ if(app) app.hidden = true; return; }
    if(!app) app = crearFacil();
    app.hidden = false;
    pintarFacil();
    // La primera vez (también para quien ya tenía el modo fácil de antes, que solo agrandaba la letra): cómo funciona y cómo salir.
    const d = D();
    if(d && !d.facilVisto){
      d.facilVisto = 1; try{ saveData(); }catch(e){}
      if(!window.ventoGuia) setTimeout(() => aviso('🧓 Modo fácil: vende en 🛒 Vender y mira el día en 📊 Hoy. Para volver a la app completa: ⋯ Más → Salir del modo fácil.', 9000), 600);   // con la guía, el recorrido lo explica
    }
    // La primera vez en este equipo: ORDEVA le enseña la pantalla, con voz, paso a paso (lib/vento-guia.js).
    setTimeout(() => { try{ if(facilActivo() && window.ventoGuia && !window.ventoGuia.tourVisto() && !window.ventoGuia.activa()) window.ventoGuia.tour(); }catch(e){} }, 900);
  }
  function crearFacil(){
    const app = document.createElement('div');
    app.id = 'facilApp'; app.setAttribute('data-novocab', ''); app.hidden = true;
    app.innerHTML = '<div class="fz-top"><span class="fz-tit"><b class="fz-biz"></b><span class="fz-dia"></span></span><button type="button" class="fz-ayuda" data-ayudame="1" aria-label="Ayúdame">🙋 Ayúdame</button></div><div class="fz-main" id="fzMain"></div>' +
      '<div class="fz-nav" role="tablist" aria-label="Modo fácil">' + [['vender', '🛒', 'Vender'], ['hoy', '📊', 'Hoy'], ['mas', '⋯', 'Más']]
        .map(b => '<button type="button" role="tab" data-fz="' + b[0] + '"><i>' + b[1] + '</i><span>' + b[2] + '</span></button>').join('') + '</div>';
    document.body.appendChild(app);
    app.querySelector('.fz-ayuda').addEventListener('click', () => { if(window.ventoGuia) window.ventoGuia.ayudame(); });
    app.querySelector('.fz-nav').addEventListener('click', e => {
      const b = e.target.closest('[data-fz]'); if(!b) return;
      if(b.dataset.fz === fz.tab && fz.tab === 'vender'){ fz.mesa = null; fz.caja = false; }   // tocar «Vender» otra vez vuelve a las mesas
      fz.tab = b.dataset.fz; fz.sub = ''; fz.edit = null;
      pintarFacil();
    });
    return app;
  }
  function pantalla(main, clave, fn){
    let el = main.firstElementChild;
    if(!el || el.dataset.pant !== clave){ main.innerHTML = ''; el = document.createElement('div'); el.dataset.pant = clave; main.appendChild(el); main.scrollTop = 0; }
    fn(el);
  }
  function pintarFacil(){
    const app = $('facilApp'), d = D(); if(!app || app.hidden || !d) return;
    app.querySelector('.fz-biz').textContent = d.businessName || 'Mi negocio';
    const dia = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    app.querySelector('.fz-dia').textContent = dia.charAt(0).toUpperCase() + dia.slice(1);
    app.querySelectorAll('[data-fz]').forEach(b => { const on = b.dataset.fz === fz.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const main = $('fzMain');
    if(fz.tab === 'hoy') return pantalla(main, 'hoy', pintarHoy);
    if(fz.tab === 'mas'){
      if(fz.sub === 'productos') return pantalla(main, 'prod:' + (fz.edit || ''), pintarProductosFacil);
      return pantalla(main, 'mas', pintarMas);
    }
    const m = modo();
    if(fz.mesa != null && !(d.tables && d.tables[fz.mesa])) fz.mesa = null;
    if(m === 'tienda') return pantalla(main, 'caja', el => montarCaja(el, caja, { variante: 'grande', titulo: '🛒 Vender' }));
    if(fz.caja) return pantalla(main, 'caja-rapida', el => montarCaja(el, caja, { variante: 'grande', titulo: '🛍️ Venta rápida', atras: true }));
    if(fz.mesa != null) return pantalla(main, 'mesa:' + fz.mesa, el => montarCaja(el, mesaSrc(fz.mesa), { variante: 'grande', titulo: etiqueta(fz.mesa), atras: true, mic: true }));
    pantalla(main, 'mesas', pintarMesasFacil);
  }
  function pintarMesasFacil(el){
    const d = D(), ids = Object.keys(d.tables || {}).map(Number).sort((a, b) => a - b), [sg, pl] = unidad();
    const saldo = id => { try{ return tableBalance(id) || tableTotal(id); }catch(e){ return 0; } };
    el.innerHTML = '<h2 class="fz-h">¿' + (unidad()[0] === 'Mesa' ? 'Qué mesa' : 'Cuál') + '?</h2>' +
      '<button type="button" class="fz-rapida" data-caja="1"><i>🛍️</i><b>Venta rápida (caja)</b><small>Sin ' + esc(sg.toLowerCase()) + ' · con código o QR</small></button>' +
      (ids.length ? '<div class="fz-mesas">' + ids.map(id => {
        const ab = (d.tables[id].items || []).length > 0;
        return '<button type="button" class="fz-mesa' + (ab ? ' ocupada' : '') + '" data-mesa="' + id + '"><b>' + esc(etiqueta(id)) + '</b><span>' + (ab ? plata(saldo(id)) : 'Libre') + '</span></button>';
      }).join('') + '</div>' : '<p class="fz-vacio">No tienes ' + esc(pl.toLowerCase()) + '. Créalas en la app completa (⋯ Más → Salir del modo fácil).</p>');
    el.onclick = e => {
      const b = e.target.closest('[data-mesa]'); if(b){ fz.mesa = Number(b.dataset.mesa); pintarFacil(); return; }
      if(e.target.closest('[data-caja]')){ fz.caja = true; pintarFacil(); }
    };
  }
  // HOY: números grandes y claros, nada de gráficas.
  function ventasDeHoy(){
    const d = D(), h0 = new Date(); h0.setHours(0, 0, 0, 0);
    const H = ((d && d.history) || []).filter(h => { const t = h.date ? Date.parse(h.date) : Number(h.t) || 0; return t >= h0.getTime(); });
    let total = 0, efectivo = 0, digital = 0, fiado = 0;
    H.forEach(h => {
      total += Number(h.total) || 0;
      (h.payments || []).forEach(p => { const a = Number(p.amount) || 0; if(p.method === 'efectivo') efectivo += a; else if(p.method === 'debe') fiado += a; else digital += a; });
    });
    return { ventas: H, total, efectivo, digital, fiado };
  }
  function pintarHoy(el){
    const r = ventasDeHoy();
    const hora = h => { const t = h.date ? new Date(h.date) : new Date(Number(h.t) || Date.now()); return t.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); };
    const donde = h => h.tableName || (h.table != null ? etiqueta(h.table) : 'Venta');
    const como = h => { const p = (h.payments || [])[0]; return !p ? '' : p.method === 'efectivo' ? '💵' : p.method === 'debe' ? '📝' : '📲'; };
    el.innerHTML = '<div class="fz-hoy"><div class="fz-big"><span>Vendiste hoy</span><b class="fz-hoy-total">' + plata(r.total) + '</b><small>' + r.ventas.length + (r.ventas.length === 1 ? ' venta' : ' ventas') + '</small></div>' +
      '<div class="fz-par"><div><span>💵 Efectivo</span><b>' + plata(r.efectivo) + '</b></div><div><span>📲 Digital</span><b>' + plata(r.digital) + '</b><small>Nequi, DaviPlata, tarjeta</small></div></div>' +
      (r.fiado ? '<div class="fz-par fz-uno"><div class="fz-fiado"><span>📝 Quedaron debiendo</span><b>' + plata(r.fiado) + '</b></div></div>' : '') +
      '<h3 class="fz-h3">Últimas ventas</h3>' +
      (r.ventas.length ? '<ul class="fz-ult">' + r.ventas.slice(0, 5).map(h => '<li><span>' + esc(hora(h)) + ' · ' + esc(donde(h)) + '</span><b>' + como(h) + ' ' + plata(h.total) + '</b></li>').join('') + '</ul>'
        : '<p class="fz-vacio">Todavía no hay ventas hoy.</p>') +
      // 🔒 Cerrar caja (antes pregunta, con el resumen). No para quien no tiene permiso de ver el historial.
      (typeof window.closeCashRegister === 'function' && !document.body.classList.contains('hist-hoy')
        ? '<button type="button" class="fz-btn fz-cerrar" data-fz-cerrar><i>🔒</i><span>Cerrar caja del día<small>Antes le pregunta y le muestra el resumen</small></span></button>' : '') + '</div>';
    el.onclick = e => { if(e.target.closest('[data-fz-cerrar]')) Promise.resolve(window.closeCashRegister()).then(() => pintarFacil(), () => {}); };
  }
  /* MÁS: tarjetas grandes, una por tarea, con dibujo y palabras sencillas (como los celulares para mayores: BIG
     Launcher, GrandPad). Las tareas con varios pasos abren la guía de ORDEVA, que pregunta una cosa a la vez y la dice
     en voz alta (lib/vento-guia.js). */
  const TAREAS = [
    ['g-producto', '🍺', 'Agregar un producto', 'Cerveza, gaseosa, comida…'],
    ['g-llego', '📦', 'Llegó mercancía', 'Sumar lo que le trajeron'],
    ['g-foto', '📷', 'Foto a un producto', 'Para reconocerlo fácil'],
    ['g-precio', '💲', 'Cambiar un precio', 'Subir o bajar un precio'],
    ['g-factura', '🧾', 'Escanear una factura', 'Con la cámara del celular'],
    ['g-facturas', '📚', 'Mis facturas', 'Ver y descargar las guardadas'],
    ['g-practica', '🎓', 'Practicar una venta', 'Un ensayo: no se guarda nada'],
    ['musica', '🎵', 'Música', 'Poner canciones y listas'],
    ['libreta', '📒', 'Libreta', 'Quién debe y cuánto'],
    ['productos', '📋', 'Mis productos', 'Ver la lista y los precios']
  ];
  function pintarMas(el){
    const ok = !!window.ventoGuia;
    el.innerHTML = '<h2 class="fz-h">¿Qué quiere hacer?</h2><div class="fz-tareas">' +
      TAREAS.filter(t => ok || !/^g-|^musica$/.test(t[0])).filter(t => t[0] !== 'musica' || (window.vitoPanel && D().musicOn)).map(t =>
        '<button type="button" class="fz-btn fz-tarea" data-ir="' + t[0] + '"><i>' + t[1] + '</i><span>' + t[2] + '<small>' + t[3] + '</small></span></button>').join('') + '</div>' +
      '<div class="fz-lista fz-otras">' +
      (ok ? '<button type="button" class="fz-btn fz-pedir" data-ir="ayudame"><i>🙋</i><span>Ayúdame, no sé cómo<small>Dígale a ORDEVA qué necesita y le explica paso a paso</small></span></button>' : '') +
      (planVisible() ? '<button type="button" class="fz-btn" data-ir="plan"><i>💳</i><span>Mi plan<small>' + esc(planTexto()) + '</small></span></button>' : '') +
      '<button type="button" class="fz-btn" data-ir="ayuda"><i>💬</i><span>Ayuda por WhatsApp<small>Una persona le ayuda</small></span></button>' +
      '<button type="button" class="fz-btn fz-salir" data-ir="salir"><i>🚪</i><span>Salir del modo fácil<small>Volver a la app completa</small></span></button></div>';
    el.onclick = e => {
      const b = e.target.closest('[data-ir]'); if(!b) return;
      const k = b.dataset.ir;
      if(/^g-/.test(k)){ if(window.ventoGuia) window.ventoGuia.iniciar(k.slice(2)); return; }
      if(k === 'ayudame'){ if(window.ventoGuia) window.ventoGuia.ayudame(); return; }
      if(k === 'musica'){ try{ window.vitoPanel.abrir(); }catch(x){} return; }
      if(k === 'productos'){ fz.sub = 'productos'; fz.edit = null; fz.q = ''; pintarFacil(); }
      else if(k === 'libreta'){ if(typeof window.libretaAbrir === 'function') window.libretaAbrir(); else aviso('La libreta no está disponible.'); }
      else if(k === 'ayuda'){
        let n = '573000000000'; try{ if(typeof ventoWa === 'function') n = ventoWa(); }catch(x){}
        const d = D(), msg = 'Hola, necesito ayuda con ORDEVA (modo fácil).' + (d && d.businessName ? ' Negocio: ' + d.businessName : '');
        window.open('https://wa.me/' + encodeURIComponent(n) + '?text=' + encodeURIComponent(msg), '_blank');
      }
      else if(k === 'plan'){ try{ const vs = window.ventoSuscripcion, st = vs.estado(); if(st.renovar && !st.pago) vs.abrirRenovar(); else vs.abrirPlanes(''); }catch(x){} }
      else if(k === 'salir') salirFacil();
    };
  }
  // «Mi plan» en Más (la barra de la suscripción queda tapada por la pantalla fácil): solo el dueño o el administrador en la nube.
  function planVisible(){ try{ const vs = window.ventoSuscripcion; return !!(vs && vs.enCuenta() && vs.verificado() && vs.estado().manda); }catch(e){ return false; } }
  function planTexto(){
    try{
      const s = window.ventoSuscripcion.estado();
      if(s.revision) return '⏳ Pago en revisión';
      if(s.rechazo) return '❌ Pago no aprobado: toca para ver';
      if(s.renovar) return '⏰ Vence pronto: toca para renovar';
      if(s.status === 'expired') return 'Venció: toca para renovar';
      return 'Plan ' + String(s.plan || 'free').toUpperCase() + (s.status === 'active' && s.dias != null ? ' · ' + s.dias + ' día' + (s.dias === 1 ? '' : 's') : '');
    }catch(e){ return 'Ver mi plan'; }
  }
  async function salirFacil(){
    const d = D(); if(!d) return;
    d.easyMode = false; fz.tab = 'vender'; fz.mesa = null; fz.caja = false; fz.sub = ''; fz.edit = null;
    llamar(window.applyEasyMode); aplicarFacil();
    try{ window.libretaFab && window.libretaFab(); }catch(e){}
    try{ const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); }catch(e){}
    aviso('Volviste a la app completa. El modo fácil se prende en Ajustes → 🧓 Modo fácil.', 5000);
    await guardar();
  }
  // Productos en un formulario simple: nombre y precio. Un paso por pantalla.
  function pintarProductosFacil(el){
    if(el._hecho) return;   // ya está en pantalla: no se borra lo que están escribiendo
    el._hecho = true;
    const d = D();
    if(fz.edit){
      const p = fz.edit === 'nuevo' ? null : producto(fz.edit);
      if(fz.edit !== 'nuevo' && !p){ fz.edit = null; return pintarFacil(); }
      el.innerHTML = '<div class="fz-barra"><button type="button" class="fz-atras" data-volver="1">← Productos</button><b class="fz-titulo">' + (p ? 'Cambiar precio' : 'Producto nuevo') + '</b></div>' +
        '<form class="fz-form" autocomplete="off"><label>Nombre<input class="fz-in fz-nombre" maxlength="60" required value="' + esc(p ? p.name : '') + '" placeholder="Ej. Gaseosa"></label>' +
        '<label>Precio<input class="fz-in fz-precio" type="number" inputmode="numeric" min="0" step="50" required value="' + esc(p ? p.price : '') + '" placeholder="Ej. 3000"></label>' +
        '<button type="submit" class="fz-ok">💾 Guardar</button><button type="button" class="fz-cancel" data-volver="1">Cancelar</button></form>';
      const f = el.querySelector('form');
      setTimeout(() => { const i = el.querySelector(p ? '.fz-precio' : '.fz-nombre'); if(i) try{ i.focus(); i.select && i.select(); }catch(x){} }, 30);
      el.onclick = e => { if(e.target.closest('[data-volver]')){ fz.edit = null; pintarFacil(); } };
      f.onsubmit = e => {
        e.preventDefault();
        const nombre = f.querySelector('.fz-nombre').value.trim(), precio = Math.round(parseFloat(f.querySelector('.fz-precio').value));
        if(!nombre){ aviso('⚠️ Escribe el nombre.'); return; }
        if(!isFinite(precio) || precio < 0){ aviso('⚠️ Escribe el precio.'); return; }
        let q = p;
        if(!q){
          const dup = (d.products || []).find(x => { try{ return dupKey(x) === dupKey({ name: nombre, size: '' }); }catch(er){ return sinTilde(x.name) === sinTilde(nombre); } });
          if(dup){ fz.edit = dup.id; pintarFacil(); aviso('«' + dup.name + '» ya existe: aquí le cambias el precio.'); return; }
          q = { id: Date.now().toString(), name: nombre, price: precio, categoryId: null, size: '', specifications: '', stock: null, cost: null };
          d.products.push(q);
        } else {
          const antes = q.name; q.name = nombre; q.price = precio;
          try{ sincronizarProductoEnMesas(q, antes); }catch(er){}
        }
        guardar(); llamar(window.renderProductos); llamar(window.renderInventario);
        aviso('✅ ' + q.name + ': ' + plata(q.price));
        fz.edit = null; pintarFacil();
      };
      return;
    }
    el.innerHTML = '<div class="fz-barra"><button type="button" class="fz-atras" data-volver="1">← Más</button><b class="fz-titulo">📦 Productos</b></div>' +
      '<button type="button" class="fz-btn fz-nuevo" data-nuevo="1"><i>➕</i><span>Agregar producto</span></button>' +
      '<input type="search" class="fz-in fz-buscar" placeholder="🔍 Buscar" value="' + esc(fz.q) + '" aria-label="Buscar producto">' +
      '<div class="fz-prods"></div>';
    const lista = el.querySelector('.fz-prods');
    const pintarLista = () => {
      const R = productos(fz.q, '').slice(0, 200);
      lista.innerHTML = R.length ? R.map(p => '<button type="button" class="fz-prow" data-edit="' + esc(p.id) + '"><span>' + esc(p.name) + (p.size ? ' <small>' + esc(p.size) + '</small>' : '') + '</span><b>' + plata(p.price) + '</b></button>').join('')
        : '<p class="fz-vacio">' + ((d.products || []).length ? 'No encontré ese producto.' : 'Todavía no tienes productos.') + '</p>';
    };
    pintarLista();
    const bus = el.querySelector('.fz-buscar'); bus.oninput = () => { fz.q = bus.value; pintarLista(); };
    el.onclick = e => {
      if(e.target.closest('[data-volver]')){ fz.sub = ''; pintarFacil(); return; }
      if(e.target.closest('[data-nuevo]')){ fz.edit = 'nuevo'; pintarFacil(); return; }
      const r = e.target.closest('[data-edit]'); if(r){ fz.edit = r.dataset.edit; pintarFacil(); }
    };
  }
  // Voz: el mismo micrófono de la app. En la cuenta de una mesa basta decir «dos gaseosas».
  const hayVoz = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition || window.VentoAndroid) && !!$('voiceFab');
  function decirPedido(){ const b = $('voiceFab'); if(b) b.click(); }
  function sincMic(){
    let on = false; try{ on = typeof voiceListening !== 'undefined' && !!voiceListening; }catch(e){}
    document.querySelectorAll('.pz-mic').forEach(b => { b.classList.toggle('on', on); b.textContent = on ? '⏹ Escuchando… toca para terminar' : '🎤 Decir pedido'; });
  }

  // ---------- Repintar ----------
  let pend = false;
  function pintarTodo(){
    try{ pintarPos(); }catch(e){ console.error('vento-pos', e); }
    try{ const ov = $('pzCajaOv'); if(ov && ov.classList.contains('show')) montarCaja(ov.querySelector('.pz-caja-root'), caja, { variante: 'tienda', flotante: true }); }catch(e){ console.error('vento-pos caja', e); }
    try{ pintarFacil(); }catch(e){ console.error('vento-facil', e); }
  }
  function programar(){ if(pend) return; pend = true; setTimeout(() => { pend = false; pintarTodo(); }, 0); }
  // Se engancha a funciones de index.html sin cambiarlas (como hace «Primeros pasos»).
  function envolver(nombre, despues, antes){
    const o = window[nombre]; if(typeof o !== 'function' || o.__ventoPos) return;
    const w = function(){ if(antes){ const r = antes.apply(this, arguments); if(r !== undefined) return r; } const r = o.apply(this, arguments); try{ despues && despues.apply(this, arguments); }catch(e){} return r; };
    w.__ventoPos = true;
    window[nombre] = w;
  }
  envolver('renderMesas', programar);
  envolver('renderProductos', programar);
  envolver('domisBadge', programar);          // pedidos a domicilio pendientes → el botón de la caja
  envolver('aplicarDomicilios', programar);
  envolver('aplicarModoMesero', aplicarFacil);
  envolver('updateVoiceFabUI', sincMic);
  // En tienda la pestaña principal se llama «Vender».
  envolver('aplicarVocabulario', () => { if(modo() !== 'tienda') return; const nb = document.querySelector('nav button[data-view="mesas"] .nav-lbl'); if(nb) nb.textContent = 'Vender'; });
  // Voz en la cuenta abierta del modo fácil: si no dicen la mesa, es esa.
  envolver('resolveVoiceTableId', null, function(parsed){
    const d = D();
    if(parsed && d && d.tables && d.tables[parsed]) return undefined;
    if(fz.mesa != null && facilActivo() && fz.tab === 'vender' && d && d.tables && d.tables[fz.mesa]) return fz.mesa;
    return undefined;
  });
  document.addEventListener('visibilitychange', () => { if(!document.hidden && facilActivo()) programar(); });
  // Al volver a la pestaña principal se repinta la caja (el carrito pudo cambiar en otra parte).
  document.addEventListener('click', e => { if(e.target && e.target.closest && e.target.closest('nav button[data-view="mesas"]')) programar(); }, true);

  // ---------- Estilos ----------
  const css = document.createElement('style');
  css.id = 'ventoPosCss';
  css.textContent =
    /* Tienda: sin mesas en la vista principal (salvo «Cuentas abiertas»). Mixto: caja arriba y mesas abajo. */
    'body.modo-tienda:not(.pz-ver-cuentas) #view-mesas > :not(#primerosPasos):not(#posPanel){display:none!important}' +
    '#posPanel{margin:0 0 16px}#posPanel[hidden]{display:none}' +
    '.pz-buscar{display:flex;gap:8px;margin-bottom:10px}.pz-buscar[hidden]{display:none}' +
    '.pz-q{flex:1;min-width:0;font:inherit;font-size:16px;padding:12px 14px;min-height:48px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}' +
    '.pz-q:focus{outline:2px solid var(--amber);outline-offset:1px}' +
    '.pz .pz-scan{flex:none;width:52px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:22px;cursor:pointer}' +
    '.pz-cats{display:flex;gap:6px;overflow-x:auto;padding:0 0 8px;margin-bottom:4px;scrollbar-width:none}.pz-cats::-webkit-scrollbar{display:none}' +
    '.pz .pz-cats button{flex:none;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}' +
    '.pz-cats button.on{background:var(--amber);border-color:var(--amber);color:var(--on-amber,#fff)}' +
    '.pz-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}' +
    '.pz .pz-tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:116px;min-width:0;padding:10px 6px 8px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none}' +
    '.pz-tile:active{transform:scale(.95)}.pz-tile:hover{border-color:var(--amber-deep)}' +
    '.pz-tile.en{border-color:var(--amber);background:color-mix(in srgb,var(--amber) 12%,var(--surface))}' +
    '.pz-cara{width:46px;height:46px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:12px;background:color-mix(in srgb,var(--amber) 10%,var(--surface-2,var(--surface)));overflow:hidden;font-size:28px;line-height:1}' +
    '.pz-cara img{width:100%;height:100%;object-fit:cover}.pz-letra{font-weight:900;font-size:22px;color:var(--cream)}' +
    '.pz-nom{font-size:13px;font-weight:700;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.pz-nom small{font-weight:500;color:var(--ink-soft)}' +
    '.pz-pre{font-size:14px;font-weight:900;color:var(--cream);margin-top:auto}' +
    '.pz-cant{position:absolute;top:5px;right:5px;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:var(--amber);color:var(--on-amber,#fff);font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center}' +
    '.pz-stock{position:absolute;top:5px;left:5px;font-size:10px;font-weight:800;padding:2px 6px;border-radius:999px;background:color-mix(in srgb,var(--brick) 22%,transparent);color:var(--brick)}' +
    '.pz-vacio{color:var(--ink-soft);font-size:14px;text-align:center;padding:12px 4px;grid-column:1/-1}.pz-mas{grid-column:1/-1;color:var(--ink-soft);font-size:12.5px;text-align:center;padding:4px}' +
    '.pz-cart{margin-top:12px;border:1px solid var(--line);border-radius:18px;background:var(--paper,var(--surface));padding:12px}' +
    '.pz-tienda .pz-cart{position:sticky;bottom:calc(84px + env(safe-area-inset-bottom));z-index:6;box-shadow:0 -10px 30px rgba(0,0,0,.28)}' +
    '@media (min-width:761px){.pz-tienda .pz-cart{bottom:12px}}' +
    '@media (max-width:760px){body.modo-tienda:has(#view-mesas.active):not(.pz-ver-cuentas) .voice-fab-wrap{bottom:calc(96px + var(--pz-cart-h,0px) + env(safe-area-inset-bottom))}}' +
    '.pz-cart-h{display:flex;align-items:center;gap:8px;margin-bottom:4px}.pz-cart-h b{font-size:15px}.pz-n{flex:1;color:var(--ink-soft);font-size:13px}' +
    '.pz-vaciar{border:0;background:transparent;color:var(--ink-soft);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:6px}' +
    '.pz-lineas{max-height:26vh;overflow:auto;overscroll-behavior:contain}' +
    '.pz-linea{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)}.pz-linea:last-child{border-bottom:0}' +
    '.pz-lmini{display:none}.pz-ln{flex:1;min-width:0}.pz-ln b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pz-ln small{color:var(--ink-soft);font-size:12px}' +
    '.pz-step{display:flex;align-items:center;gap:4px;flex:none}' +
    '.pz .pz-step button{width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:22px;font-weight:900;line-height:1;cursor:pointer;touch-action:manipulation}' +
    '.pz-step span{min-width:24px;text-align:center;font-weight:900;font-size:15px}' +
    '.pz-sub{flex:none;font-weight:900;font-size:14px;min-width:70px;text-align:right}' +
    '.pz-x{flex:none;border:0;background:transparent;color:var(--ink-soft);font-size:16px;cursor:pointer;padding:8px 4px}' +
    '.pz-pie{display:flex;align-items:center;gap:10px;margin-top:8px}' +
    '.pz-total{flex:1;min-width:0}.pz-total span{display:block;font-size:11.5px;letter-spacing:.08em;color:var(--ink-soft);font-weight:800}' +
    '.pz-total b{display:block;font-size:clamp(22px,7vw,30px);font-weight:900;line-height:1.05;white-space:nowrap}' +
    '.pz .pz-cobrar{flex:none;min-width:148px;min-height:58px;padding:0 18px;border:0;border-radius:16px;background:#15803d;color:#fff;font:inherit;font-size:19px;font-weight:900;letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 18px rgba(21,128,61,.35)}' +
    '.pz-cobrar:hover{background:#166534}.pz-cobrar:disabled{opacity:.35;box-shadow:none;cursor:not-allowed}' +
    '.pz-extra:empty{display:none}.pz-desc{display:flex;align-items:center;gap:8px;padding:6px 0;color:#15803d;font-weight:700}.pz-desc span{flex:1}.pz-notav{font-size:13px;color:var(--ink-soft);padding:2px 0 6px;overflow-wrap:anywhere}' +
    '.pz-herr2{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 2px}.pz-herr2[hidden]{display:none}.pz .pz-herr2 button{flex:1 1 auto;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.pz-mini-ov{z-index:9050}.pz-mini{max-width:420px;width:100%}.pz-mini input,.pz-mini textarea{width:100%;box-sizing:border-box;margin:8px 0}.pz-dtipo,.pz-drap{display:flex;gap:6px;margin:6px 0}.pz-mini .pz-dtipo button,.pz-mini .pz-drap button{flex:1;padding:9px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-weight:800;cursor:pointer}.pz-mini .pz-dtipo button.on{background:var(--amber);color:var(--on-amber,#fff);border-color:var(--amber)}.pz-dres{min-height:20px;font-weight:700;margin:6px 0}' +
    '.pz-pl{display:flex;flex-direction:column;gap:8px;margin:10px 0;max-height:55vh;overflow:auto}.pz-pf{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--line);border-radius:12px}.pz-pf>div{flex:1;min-width:0}.pz-pf small{display:block;color:var(--ink-soft)}.pz-pf .btn-primary,.pz-pf .btn-ghost{width:auto;margin:0;padding:8px 10px}' +
    '.pz-cuentas{margin-top:10px;display:grid;gap:8px}.pz-cuentas:empty{display:none}.pz-cuentas-btn{width:100%;padding:12px;font-size:14px}' +
    '@media (min-width:900px){.pz-tienda{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}' +
      '.pz-tienda .pz-cart{position:sticky;top:12px;bottom:auto;margin-top:0;box-shadow:none}.pz-tienda .pz-lineas{max-height:52vh}.pz-tienda .pz-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}}' +
    /* Mixto: una fila de productos que se desliza y el carrito debajo */
    '.pz-mixto .pz-grid{display:flex;overflow-x:auto;gap:8px;padding-bottom:6px;scroll-snap-type:x proximity}' +
    '.pz-mixto.pz .pz-tile{flex:0 0 100px;min-height:100px;scroll-snap-align:start}.pz-mixto .pz-cara{width:36px;height:36px;font-size:22px}' +
    '.pz-mixto .pz-cart{margin-top:8px}.pz-mixto .pz-cart.vacio .pz-lineas{display:none}.pz-mixto .pz-cart.vacio .pz-total b{font-size:22px}' +
    '@media (min-width:900px){.pz-mixto{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}.pz-mixto .pz-cart{margin-top:0}}' +
    /* Ajustes → Modo de trabajo */
    '.pz-modo-row{flex-direction:column;align-items:stretch!important;gap:8px}' +
    '.pz-modos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
    '.pz-modos .pz-modo{display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 6px;border-radius:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;text-align:center;min-width:0}' +
    '.pz-modo i{font-style:normal;font-size:26px}.pz-modo b{font-size:13.5px;overflow-wrap:anywhere}.pz-modo small{font-size:11.5px;color:var(--ink-soft);line-height:1.25}' +
    '.pz-modo.on{border-color:var(--amber);background:color-mix(in srgb,var(--amber) 16%,var(--surface));box-shadow:0 0 0 2px color-mix(in srgb,var(--amber) 45%,transparent)}' +
    /* Cobrar: cómo pagó */
    '.pz-pago-ov{z-index:9000}.pz-pago{max-width:440px;text-align:center}' +
    /* 1.67.0: el total siempre arriba a la vista (también al bajar dentro del cobro en el celular) */
    '.pz-pago .pz-pago-tot{position:sticky;top:-22px;z-index:3;background:var(--paper,var(--surface));margin:-22px -22px 6px;padding:16px 22px 8px;border-bottom:1px solid var(--line)}' +
    '.pz-pago .pz-billetes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.pz-pago .pz-billetes [data-b="exacto"]{grid-column:span 2}.pz-pago .pz-billetes button{min-height:42px;padding:0 4px;font-size:14px}' +
    '@media (max-width:420px){.pz-pago .pz-billetes{grid-template-columns:repeat(3,minmax(0,1fr))}.pz-pago .pz-billetes [data-b="exacto"]{grid-column:span 2}.pz-pago .pz-billetes button{font-size:12.5px;padding:0 2px;letter-spacing:-.01em}}' +
    /* 📲 Pagar con QR */
    '.pz-qr-btn{display:flex;align-items:center;gap:12px;width:100%;margin:10px 0 2px;min-height:64px;padding:8px 14px;border-radius:16px;border:2px solid #22d3ee;background:color-mix(in srgb,#22d3ee 12%,var(--surface));color:var(--ink);font:inherit;font-size:18px;font-weight:900;cursor:pointer;text-align:left}' +
    '.pz-qr-btn i{font-style:normal;font-size:30px}.pz-qr-btn span{display:flex;flex-direction:column}.pz-qr-btn small{font-size:13px;font-weight:600;color:var(--ink-soft)}' +
    '.pz-pago-grande .pz-qr-btn{min-height:84px;font-size:21px}' +
    '.pz-qr-ov{z-index:9100}.pz-qr{max-width:460px;width:min(460px,calc(100vw - 24px));text-align:center;display:flex;flex-direction:column;gap:10px;max-height:calc(100dvh - 24px);overflow:auto}' +
    '.pz-qr-tot span{display:block;font-size:15px;color:var(--ink-soft);font-weight:700}.pz-qr-tot b{font-size:clamp(34px,10vw,52px);font-weight:900}' +
    '.pz-qr-img{display:block;width:min(320px,70vw,48dvh);aspect-ratio:1;object-fit:contain;margin:0 auto;background:#fff;border-radius:18px;padding:10px}' +
    '.pz-qr-txt{font-size:16px;font-weight:700}.pz-qr-txt small{display:block;font-size:14px;color:var(--ink-soft);margin-top:4px}' +
    '.pz-qr-est{font-size:17px;font-weight:800;color:var(--ink-soft)}.pz-qr-est.ok{color:#16a34a;font-size:21px}' +
    '.pz-qr-ok{min-height:64px;border:0;border-radius:18px;background:#15803d;color:#fff;font:inherit;font-size:21px;font-weight:900;cursor:pointer}.pz-qr-no{min-height:52px;font-size:17px}' +
    '#facilApp .fz-scan{border-color:#22d3ee}' +
    '.pz-pago-tot span{display:block;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);font-weight:800}.pz-pago-tot b{display:block;font-size:42px;font-weight:900;line-height:1.1}' +
    '.pz-pago-q{font-size:16px;font-weight:800;margin:10px 0 2px}' +
    '.pz-metodos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}' +
    '.pz-pago .pz-met{min-height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:18px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:17px;font-weight:900;cursor:pointer}' +
    '.pz-met i{font-style:normal;font-size:28px;line-height:1}.pz-met:hover,.pz-met:focus-visible{border-color:var(--amber)}' +
    '.pz-met[data-m="efectivo"]{border-color:#15803d;background:color-mix(in srgb,#15803d 16%,var(--surface))}' +
    '.pz-vu-box{margin:8px 0 12px;text-align:left;padding:12px;border:2px solid var(--line);border-radius:16px;background:var(--surface)}' +
    '.pz-vu-l{display:block;font-size:13px;font-weight:900;letter-spacing:.04em;margin-bottom:6px}' +
    '.pz-vu-in{display:flex;align-items:center;gap:6px;border:2px solid var(--ink);border-radius:14px;padding:0 12px;background:var(--surface)}.pz-vu-in span{font-size:24px;font-weight:900;color:var(--ink-soft)}' +
    '.pz-pago .pz-vu-in input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:30px;font-weight:900;padding:8px 0;min-height:52px;box-shadow:none}' +
    '.pz-b-borrar{flex:0 0 auto!important;min-width:48px}' +
    '.pz-billetes{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.pz-pago .pz-billetes button{flex:1 1 auto;min-height:44px;padding:0 10px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-weight:800;cursor:pointer}' +
    '.pz-pago .pz-billetes button.on{border-color:#15803d;background:color-mix(in srgb,#15803d 14%,var(--surface))}.pz-vu{text-align:center;font-size:18px;font-weight:700;min-height:28px;margin-top:8px}.pz-vu small{font-size:13px;font-weight:500;color:var(--ink-soft)}.pz-vu b{font-size:26px;font-weight:900}' +
    '.pz-vu.vueltas,.pz-vu.exacto{color:#16a34a}.pz-vu.falta{color:var(--brick)}' +
    '.pz-fiado{width:100%;padding:12px;font-size:14px}.pz-fiado-box{display:flex;flex-direction:column;gap:8px;margin-top:8px}.pz-fiado-box[hidden]{display:none}.pz-fiado-box input{width:100%;box-sizing:border-box}' +
    '.pz-pago .pz-cancel{width:100%;margin-top:10px}' +
    '.pz-mixto-btn{width:100%;padding:12px;font-size:14px;margin-bottom:8px}.pz-mixto-box{display:flex;flex-direction:column;gap:8px;margin:0 0 10px;text-align:left}.pz-mixto-box[hidden]{display:none}' +
    '.pz-mx{display:flex;align-items:center;gap:10px}.pz-mx span{flex:0 0 120px;font-weight:800}.pz-mx input{flex:1;min-width:0;box-sizing:border-box}' +
    '.pz-mx-falta{text-align:center;font-weight:900;font-size:18px;color:#16a34a}.pz-mx-falta.falta{color:var(--brick)}' +
    /* Caja (POS) flotante: en cualquier modo, pantalla completa */
    '.pz-caja-ov{z-index:8500;align-items:stretch;justify-content:stretch;padding:0}.pz-caja-wrap{position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}' +
    '.pz-caja-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:calc(10px + env(safe-area-inset-top)) 12px 10px;border-bottom:1px solid var(--line);background:var(--surface)}.pz-caja-top b{font-size:20px;font-weight:900;flex:1 1 auto;white-space:nowrap}@media (max-width:420px){.pz-caja-top .pz-lt{display:none}}' +
    '.pz-caja-top .btn-ghost,.pz-caja-top .btn-close{width:auto;padding:8px 12px;margin:0}.pz-caja-root{flex:1;min-height:0;overflow:auto;padding:12px}' +
    '.pz-caja-root .pz-tienda .pz-cart{bottom:0}' +
    '.pz-cel{font-size:12.5px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap}' +
    '.pz-lector{font-size:12px;font-weight:800;color:#16a34a;border:1px solid color-mix(in srgb,#16a34a 45%,transparent);border-radius:999px;padding:4px 10px;white-space:nowrap}' +
    '.pz-herr{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}.pz-herr .btn-ghost{width:auto;padding:8px 12px;margin:0}' +
    /* Recibo y caja de hoy */
    '.pz-recibo-ov,.pz-hoy-ov{z-index:9100}.pz-recibo,.pz-hoy{max-width:440px}.pz-recibo-btns{display:grid;gap:8px;margin:10px 0}.pz-recibo-btns button{width:100%;min-height:52px;font-size:16px}' +
    '.pz-hoy-tot{text-align:center;margin:6px 0 10px}.pz-hoy-tot span{display:block;color:var(--ink-soft);font-weight:800}.pz-hoy-tot b{display:block;font-size:38px;font-weight:900}' +
    '.pz-hoy-met{display:grid;gap:6px;margin-bottom:10px}.pz-hoy-met div{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:12px}' +
    '.pz-hoy-lista{max-height:38vh;overflow:auto;border-top:1px solid var(--line)}.pz-hoy-v{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)}.pz-hoy-v span{flex:1;min-width:0;font-size:13.5px}.pz-hoy-v .btn-ghost{width:auto;padding:4px 10px;margin:0}' +
    '#pzDeshacer .pz-dextra{background:#e5e7eb}' +
    '.pz-pago-grande .pz-pago .pz-met{min-height:100px;font-size:21px}.pz-pago-grande .pz-met i{font-size:36px}.pz-pago-grande .pz-pago-tot b{font-size:52px}.pz-pago-grande .pz-cancel{min-height:56px;font-size:18px}' +
    /* Deshacer */
    '#pzDeshacer{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom));z-index:10040;width:min(560px,calc(100vw - 24px));display:flex;align-items:center;gap:10px;padding:10px 10px 10px 16px;border-radius:18px;background:#111827;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.45);overflow:hidden;font-weight:800;font-size:16px}' +
    '#pzDeshacer[hidden]{display:none}.pz-dmsg{flex:1;min-width:0}' +
    '#pzDeshacer .pz-dbtn{flex:none;min-height:52px;padding:0 18px;border-radius:14px;border:0;background:#fbbf24;color:#111827;font:inherit;font-size:17px;font-weight:900;cursor:pointer}' +
    '.pz-dbar{position:absolute;left:0;bottom:0;height:4px;width:100%;background:#fbbf24;transform-origin:left;animation:pzBarra 5s linear forwards}@keyframes pzBarra{to{transform:scaleX(0)}}' +
    /* En el celular y en el modo fácil va arriba: así no tapa el TOTAL ni COBRAR de la siguiente venta. */
    '@media (max-width:760px){#pzDeshacer{top:calc(10px + env(safe-area-inset-top));bottom:auto}}' +
    'body.facil-on #pzDeshacer{top:calc(8px + env(safe-area-inset-top));bottom:auto;font-size:18px}body.facil-on #pzDeshacer .pz-dbtn{min-height:60px;font-size:20px}' +
    /* ---------- Modo fácil ---------- */
    'body.facil-on{overflow:hidden}' +
    'body.facil-on .tabbar,body.facil-on .voice-fab-wrap,body.facil-on .voice-fab-tab,body.facil-on #libretaFab,body.facil-on .vito-campana,body.facil-on #mesoraFixPill{display:none!important}' +
    '#facilApp{position:fixed;inset:0;z-index:44;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font-family:var(--font-main)}#facilApp[hidden]{display:none}' +
    '.fz-top{display:flex;align-items:baseline;gap:10px;padding:calc(12px + env(safe-area-inset-top)) 16px 10px;border-bottom:1px solid var(--line);background:var(--surface)}' +
    '.fz-top{align-items:center}.fz-tit{flex:1;min-width:0;display:flex;flex-direction:column}.fz-top b{min-width:0;font-size:21px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fz-dia{font-size:14px;color:var(--ink-soft);white-space:nowrap}' +
    '#facilApp .fz-ayuda{flex:0 0 auto;min-height:56px;padding:0 16px;border-radius:999px;border:3px solid #fbbf24;background:#fbbf24;color:#1a1200;font:inherit;font-size:19px;font-weight:900;cursor:pointer;box-shadow:0 4px 14px rgba(251,191,36,.35)}' +
    '.fz-tareas{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(160px,46%),1fr));gap:12px}' +
    '#facilApp .fz-tarea{min-height:150px;flex-direction:column;justify-content:center;text-align:center;gap:8px;padding:14px 10px}' +
    '#facilApp .fz-tarea i{font-size:46px}#facilApp .fz-tarea span{font-size:19px;line-height:1.2}#facilApp .fz-tarea small{font-size:14px;margin-top:4px}' +
    '#facilApp .fz-cerrar{margin-top:18px;width:100%;border-color:var(--amber)}.fz-otras{margin-top:16px}#facilApp .fz-pedir{border-color:#fbbf24;background:color-mix(in srgb,#fbbf24 16%,var(--surface))}' +
    '.fz-main{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px 16px 18px}.fz-main > div{max-width:1180px;margin:0 auto}' +
    '.fz-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px 12px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--surface)}' +
    '#facilApp .fz-nav button{min-height:66px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:2px solid transparent;border-radius:18px;background:transparent;color:var(--ink-soft);font:inherit;font-size:18px;font-weight:900;cursor:pointer}' +
    '#facilApp .fz-nav button i{font-style:normal;font-size:26px;line-height:1}#facilApp .fz-nav button.on{background:color-mix(in srgb,var(--amber) 22%,transparent);border-color:var(--amber);color:var(--ink)}' +
    '.fz-h{font-size:26px;font-weight:900;margin:2px 0 14px}.fz-h3{font-size:20px;font-weight:900;margin:22px 0 6px}' +
    '.fz-vacio{font-size:18px;color:var(--ink-soft);text-align:center;padding:18px 6px}' +
    '.fz-mesas{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}' +
    '#facilApp .fz-mesa{min-height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:22px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;min-width:0}' +
    '.fz-mesa b{font-size:23px;font-weight:900;overflow-wrap:anywhere}.fz-mesa span{font-size:17px;font-weight:800;color:var(--ink-soft)}' +
    '.fz-mesa.ocupada{border-color:var(--amber);background:color-mix(in srgb,var(--amber) 18%,var(--surface))}.fz-mesa.ocupada span{color:var(--ink);font-size:21px;font-weight:900}' +
    '#facilApp .fz-rapida{width:100%;min-height:76px;display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:10px 18px;border-radius:22px;border:2px dashed var(--amber);background:transparent;color:var(--ink);font:inherit;cursor:pointer;text-align:left}' +
    '.fz-rapida i{font-style:normal;font-size:30px}.fz-rapida b{font-size:21px;font-weight:900}.fz-rapida small{margin-left:auto;font-size:15px;color:var(--ink-soft)}' +
    '.fz-barra{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}' +
    '#facilApp .fz-atras{min-height:56px;padding:0 18px;border-radius:16px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:18px;font-weight:900;cursor:pointer}' +
    '.fz-titulo{flex:1 1 40%;min-width:110px;font-size:25px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '@media (max-width:620px){.fz-barra .pz-mic{flex:1 1 100%}}' +
    '#facilApp .pz-mic{min-height:56px;padding:0 16px;border-radius:16px;border:2px solid var(--amber);background:transparent;color:var(--ink);font:inherit;font-size:17px;font-weight:900;cursor:pointer}.pz-mic.on{background:#dc2626;border-color:#dc2626;color:#fff}' +
    /* La caja grande del modo fácil */
    '.pz-grande .pz-q{font-size:19px;min-height:56px;padding:12px 16px}' +
    '.pz-grande .pz-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}' +
    '.pz-grande.pz .pz-tile{min-height:146px;border-width:2px;border-radius:22px;padding:12px 8px 10px;gap:6px}' +
    '.pz-grande .pz-cara{width:66px;height:66px;font-size:42px;border-radius:18px}.pz-grande .pz-letra{font-size:32px}' +
    '.pz-grande .pz-nom{font-size:18px;font-weight:800}.pz-grande .pz-pre{font-size:19px}' +
    '.pz-grande .pz-cant{min-width:36px;height:36px;font-size:19px;top:7px;right:7px}.pz-grande .pz-stock{font-size:12px}' +
    '.pz-grande .pz-cart{position:sticky;bottom:0;margin-top:14px;border-width:2px;border-radius:22px;box-shadow:0 -12px 30px rgba(0,0,0,.3);z-index:3}' +
    '.pz-grande .pz-cart-h b{font-size:18px}.pz-grande .pz-n{font-size:15px}' +
    // Celulares bajitos: lo pedido no puede tapar los productos (se desplaza solo y vacío no ocupa espacio).
    '.pz-grande .pz-lineas{max-height:30vh;overflow:auto;overscroll-behavior:contain}' +
    '@media (max-height:760px){.pz-grande .pz-lineas{max-height:20vh}.pz-grande .pz-cart.vacio .pz-lineas{display:none}.pz-grande .pz-cart{padding:10px 12px}}' +
    '.pz-grande .pz-lineas{max-height:20vh}.pz-grande .pz-linea{padding:8px 0}' +
    '.pz-grande .pz-ln b{font-size:19px;white-space:normal}.pz-grande .pz-ln small{font-size:16px;font-weight:700}' +
    '.pz-grande.pz .pz-step button{width:58px;height:58px;font-size:34px;border-radius:16px;border-width:2px}' +
    '.pz-grande .pz-total{flex:0 1 auto}.pz-grande .pz-total span{font-size:14px}.pz-grande .pz-total b{font-size:clamp(28px,9vw,40px)}' +
    '.pz-grande.pz .pz-cobrar{flex:1 1 auto;min-width:0;min-height:72px;padding:0 12px;font-size:clamp(19px,5.6vw,24px);border-radius:20px;white-space:nowrap}' +
    '@media (min-width:900px){.pz-grande{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start}.pz-grande .pz-cart{position:sticky;top:0;bottom:auto;margin:0;box-shadow:none}.pz-grande .pz-lineas{max-height:48vh}}' +
    // Celular pequeño (320–380 px): el nombre del negocio y la fecha ya no quedan tapados por «Ayúdame».
    '.fz-dia{overflow:hidden;text-overflow:ellipsis}' +
    '@media (max-width:380px){.fz-top{gap:8px;padding-left:12px;padding-right:12px}.fz-top b{font-size:18px}.fz-dia{font-size:12px}.fz-ayuda{min-height:48px;padding:0 12px;font-size:16px}}' +
    // Celular acostado (poca altura): arriba y abajo más bajitos, y al vender los productos quedan al lado de la cuenta
    // (antes la cuenta tapaba los productos y había que bajar para verlos).
    '@media (max-height:500px) and (min-width:560px){.fz-top{padding-top:calc(6px + env(safe-area-inset-top));padding-bottom:6px}.fz-dia{display:none}.fz-ayuda{min-height:44px;font-size:16px}' +
      '#facilApp .fz-nav{padding-top:4px;padding-bottom:calc(4px + env(safe-area-inset-bottom))}#facilApp .fz-nav button{min-height:46px;flex-direction:row;gap:8px}#facilApp .fz-nav button i{font-size:22px}' +
      '.pz-grande{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,38%);gap:12px;align-items:start}.pz-grande .pz-cart{position:sticky;top:0;bottom:auto;margin:0;box-shadow:none}.pz-grande .pz-lineas{max-height:30vh}' +
      '.fz-par{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    /* Hoy */
    '.fz-big{text-align:center;padding:24px 12px;border-radius:26px;border:2px solid color-mix(in srgb,var(--amber) 50%,var(--line));background:color-mix(in srgb,var(--amber) 12%,var(--surface))}' +
    '.fz-big span{display:block;font-size:19px;font-weight:800;color:var(--ink-soft)}.fz-big b{display:block;font-size:clamp(40px,12vw,64px);font-weight:900;line-height:1.1;margin:6px 0;overflow-wrap:anywhere}.fz-big small{font-size:21px;font-weight:900}' +
    '.fz-par{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.fz-par.fz-uno{grid-template-columns:1fr}' +
    '.fz-par > div{padding:16px 10px;border-radius:22px;border:2px solid var(--line);background:var(--surface);text-align:center;min-width:0}' +
    '.fz-par small{display:block;font-size:13px;color:var(--ink-soft);margin-top:2px}.fz-par span{display:block;font-size:16px;font-weight:800;color:var(--ink-soft)}.fz-par b{display:block;font-size:clamp(22px,7vw,32px);font-weight:900;margin-top:4px;overflow-wrap:anywhere}.fz-fiado{border-color:var(--brick)!important}' +
    '.fz-ult{list-style:none;margin:0;padding:0}.fz-ult li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 4px;border-bottom:1px solid var(--line);font-size:18px}.fz-ult li span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fz-ult li b{flex:none;font-size:19px}' +
    /* Más */
    '.fz-lista{display:grid;gap:12px;max-width:640px;margin:0 auto}' +
    '#facilApp .fz-btn{display:flex;align-items:center;gap:16px;width:100%;min-height:78px;padding:12px 18px;border-radius:22px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:21px;font-weight:900;text-align:left;cursor:pointer}' +
    '.fz-btn i{font-style:normal;font-size:32px;line-height:1}.fz-btn small{display:block;font-size:15px;font-weight:600;color:var(--ink-soft);margin-top:2px}' +
    '.fz-salir{border-color:var(--brick);color:var(--brick)}.fz-nuevo{border-color:var(--amber);margin-bottom:12px}' +
    '.fz-in{width:100%;box-sizing:border-box;min-height:58px;padding:12px 16px;border-radius:16px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:20px}' +
    '.fz-buscar{margin-bottom:10px}.fz-prods{display:grid;gap:8px}' +
    '#facilApp .fz-prow{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:62px;padding:10px 16px;border-radius:16px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:19px;font-weight:800;text-align:left;cursor:pointer}' +
    '.fz-prow span{min-width:0;overflow-wrap:anywhere}.fz-prow small{font-weight:500;color:var(--ink-soft)}.fz-prow b{flex:none;font-size:20px}' +
    '.fz-form{display:grid;gap:14px;max-width:560px}.fz-form label{display:grid;gap:6px;font-size:18px;font-weight:800}' +
    '#facilApp .fz-ok{min-height:68px;border:0;border-radius:20px;background:#15803d;color:#fff;font:inherit;font-size:22px;font-weight:900;cursor:pointer}' +
    '#facilApp .fz-cancel{min-height:58px;border-radius:18px;border:2px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-size:18px;font-weight:800;cursor:pointer}' +
    '@media (min-width:900px){.fz-par{grid-template-columns:repeat(2,minmax(0,1fr))}.fz-hoy{max-width:820px;margin:0 auto}}';
  document.head.appendChild(css);

  // ---------- API ----------
  // ---------- Voz en la caja: «dos águilas» sin decir mesa va a la venta de la caja ----------
  // cuando = 'antes' (tienda: siempre a la caja) | 'sin_mesa' (mixto: solo si la voz no encontró una mesa).
  function vozCaja(items, mode, cuando){
    const m = modo();
    if(cuando === 'antes' ? m !== 'tienda' : m !== 'mixto') return false;
    if(facilActivo() && fz.mesa != null) return false;   // en una mesa del modo fácil la voz va a esa mesa
    if(bloqueado()) return true;
    const added = [], notFound = [], c = cart();
    (items || []).forEach(it => {
      let p = null; try{ p = typeof matchProductVoice === 'function' ? matchProductVoice(it.productText) : null; }catch(e){}
      if(!p){ notFound.push(it.productText); return; }
      const q = Math.max(0, Math.round(Number(it.qty) || 1)), line = c.find(x => x.id === p.id);
      if(mode === 'subtract'){
        if(!line){ notFound.push(it.productText); return; }
        line.qty -= q; if(line.qty <= 0) c.splice(c.indexOf(line), 1);
        added.push({ name: p.name, qty: Math.max(0, line.qty) });
      } else if(mode === 'set'){
        if(!q){ if(line) c.splice(c.indexOf(line), 1); } else if(line) line.qty = q; else c.push({ id: p.id, name: p.name, price: Number(p.price) || 0, qty: q });
        added.push({ name: p.name, qty: q });
      } else {
        if(!q) return;
        if(line) line.qty += q; else c.push({ id: p.id, name: p.name, price: Number(p.price) || 0, qty: q });
        added.push({ name: p.name, qty: q });
      }
    });
    if(added.length){ guardarCarrito(); son(mode === 'add' || !mode ? 'add' : 'remove'); pintarTodo(); }   // UN solo sonido por comando
    const decir = t => { try{ typeof speakVoice === 'function' && speakVoice(t); }catch(e){} };
    if(added.length){
      const r = added.map(a => (mode === 'subtract' ? a.name + (a.qty ? ' queda en ' + a.qty : ' (quitado)') : (a.qty > 1 ? a.qty + ' ' : '') + a.name)).join(', ');
      const t = mode === 'subtract' || mode === 'set' ? r + ' en la venta.' : r + ' agregado a la venta.';
      aviso((mode === 'subtract' ? '➖ ' : '✅ ') + t); decir(t);
    }
    if(notFound.length){ aviso('No encontré: ' + notFound.join(', ') + '.'); if(!added.length) decir('No encontré ese producto. Intenta de nuevo.'); }
    return true;
  }

  window.ventoPOS = {
    modo, modoPorTipo, ponerModo, pintar: pintarPos, puedeVender,
    vozCaja,
    carrito: () => caja.lineas(),
    // 🎙️⌨️ Caja Inteligente 2.0 (lib/vento-caja-voz.js): las mismas funciones del carrito, sin otro motor de ventas.
    cajaActiva: () => cajaVisible(),
    resumen(){ const L = caja.lineas(), bruto = Math.round(L.reduce((s, x) => s + x.price * x.qty, 0)), descuento = descuentoDe(bruto, meta().desc); return { lineas: L, bruto, descuento, total: bruto - descuento }; },
    cuanto: id => caja.cuanto(id),
    sumar(id, n){ const p = producto(id); if(!p) return false; const ok = caja.add(p, n); pintarTodo(); return ok; },
    fijar(id, n){
      n = Math.max(0, Math.round(Number(n) || 0));
      const c = cart(), i = c.findIndex(x => x.id === id), p = producto(id);
      if(!n){ if(i >= 0){ c.splice(i, 1); guardarCarrito(); son('remove'); pintarTodo(); } return true; }
      if(!p || bloqueado()) return false;
      if(EQ() && EQ().unidadDe(p)) return false;                 // ⚖️ por peso: se pesa en la balanza, no se fija por voz
      const antes = i >= 0 ? c[i].qty : 0;
      if(i >= 0) c[i].qty = n; else c.push({ id: p.id, name: p.name, price: Number(p.price) || 0, qty: n });
      guardarCarrito(); son(n >= antes ? 'add' : 'remove'); pintarTodo(); return true;
    },
    vaciarYa: () => vaciarCarrito(),
    suspenderYa,
    ponerNota(t){ const m = meta(); const v = String(t || '').trim().slice(0, 140); if(v) m.nota = v; else delete m.nota; ponerMeta(m); pintarTodo(); },
    ponerCliente(c){ const m = meta(); if(c && c.nombre) m.cli = c; else delete m.cli; ponerMeta(m); pintarTodo(); },
    herramienta(k){
      const root = cajaVisible() || $('posPanel');
      if(k === 'desc') pedirDescuento(root); else if(k === 'nota') pedirNota(root); else if(k === 'susp') suspender(root);
      else if(k === 'pend') verPendientes(root); else if(k === 'cliente') pedirCliente(root);
    },
    cobrarMesa: (id, o) => cobrarMesa(id, o),
    agregar(id, n){ const p = producto(id); if(!p) return false; let ok = true; const f = () => { for(let i = 0; i < (n || 1) && ok; i++) ok = caja.add(p); }; if(window.ventoSonidos && n > 1) window.ventoSonidos.lote(f); else f(); pintarTodo(); return ok; },
    vaciar(){ carrito = []; guardarCarrito(); pintarTodo(); },
    cobrar: o => cobrarCaja(o), cambio, billetes: billetesCaja, repetir, pendientes, descuentoDe,
    abrirCaja, cerrarCaja, cajaDeHoy, recibo, leerCodigo: (raw, n) => porCodigo(cajaVisible(), raw, n || 1),
    enfocar(){ const q = document.querySelector('#posPanel .pz-q'); if(q){ q.scrollIntoView({ block: 'center', behavior: 'smooth' }); try{ q.focus({ preventScroll: true }); }catch(e){} } }
  };
  // Botón «🧾 Caja (POS)» de la pantalla de mesas: la caja en pantalla completa en cualquier modo.
  { const b = $('posCajaBtn'); if(b) b.addEventListener('click', () => abrirCaja()); }
  // ir('vender' | 'hoy' | 'mas'): para la guía de ORDEVA (cambia de pestaña como si se tocara).
  function irFacil(t){ fz.tab = t; fz.sub = ''; fz.edit = null; if(t === 'vender'){ fz.mesa = null; fz.caja = false; } pintarFacil(); }
  window.ventoFacil = { aplicar: aplicarFacil, pintar: pintarFacil, activo: facilActivo, salir: salirFacil, estado: () => Object.assign({}, fz), hoy: ventasDeHoy, ir: irFacil };

  // Si los datos ya estaban cargados cuando llegó este archivo, se aplica de una vez.
  try{ if(D()){ pintarPos(); aplicarFacil(); llamar(window.aplicarVocabulario); } }catch(e){}
})();
