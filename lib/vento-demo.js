/* ORDEVA · lib/vento-demo.js — 1.88.0: 🎬 MODO DEMO para mostrarle ORDEVA a un cliente.
   El link sale de ORDEVA Admin (🎬 Links de demo): index.html?demo=restaurante (o bar, tienda, hotel, motel, barberia,
   agencia_viajes). Quien lo abre ve ORDEVA funcionando con un negocio de ejemplo: productos, cuentas abiertas y las ventas
   de la semana, y puede vender, cobrar y mirar todo.
     • NADA se guarda en el equipo ni en la nube: con «?demo=» los datos viven solo en la memoria de esa pestaña (no se
       toca el localStorage, el IndexedDB ni la cuenta de ORDEVA de ese equipo). Al cerrar la pestaña, desaparece.
     • Arriba dice «🎬 Modo demo» con «Crear mi negocio» (abre ORDEVA normal).
   Va en el <head>, antes de la app, para que la app use la memoria desde el primer momento. */
(function(){
  'use strict';
  var m = /[?&]demo=([a-z_]{2,30})/.exec(location.search || '');
  if(!m) return;
  var TIPOS = {
    restaurante: { n: 'Restaurante La Sazón (demo)', t: 'restaurante' }, bar: { n: 'Bar La Esquina (demo)', t: 'bar' },
    tienda: { n: 'Tienda Don José (demo)', t: 'tienda' }, hotel: { n: 'Hotel Mirador (demo)', t: 'hotel' },
    motel: { n: 'Motel Luna (demo)', t: 'motel' }, barberia: { n: 'Barbería Estilo (demo)', t: 'barberia' },
    agencia_viajes: { n: 'Viajes del Sol (demo)', t: 'agencia_viajes' }
  };
  var tipo = TIPOS[m[1]] ? m[1] : 'restaurante', cfg = TIPOS[tipo];
  window.VENTO_DEMO = tipo;

  // ---------- Memoria en vez del almacenamiento del equipo ----------
  function memoria(){
    var d = {};
    return { getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; }, setItem: function(k, v){ d[String(k)] = String(v); },
      removeItem: function(k){ delete d[String(k)]; }, clear: function(){ d = {}; }, key: function(i){ return Object.keys(d)[i] || null; }, get length(){ return Object.keys(d).length; } };
  }
  var ls = memoria(), ss = memoria();
  try{ Object.defineProperty(window, 'localStorage', { value: ls, configurable: true }); }catch(e){}
  try{ Object.defineProperty(window, 'sessionStorage', { value: ss, configurable: true }); }catch(e){}
  // IndexedDB: cualquier intento de abrirla falla con calma (la app sigue con la memoria).
  var idb = { open: function(){ var r = { result: null, error: new Error('Modo demo: no se guarda en el equipo') }; setTimeout(function(){ try{ r.onerror && r.onerror({ target: r }); }catch(e){} }, 0); return r; }, deleteDatabase: function(){ return {}; } };
  try{ Object.defineProperty(window, 'indexedDB', { value: idb, configurable: true }); }catch(e){}
  ls.setItem('vento-hola', '0'); ls.setItem('cm-tutorial-seen', '1'); ls.setItem('vento-pp-oculta', '1');   // sin «Primeros pasos»
  // Lo que no se puede guardar en el demo (fotos en IndexedDB) no es un error para mostrar: sin «Algo falló».
  window.addEventListener('mesora-error', function(e){ if(e && e.detail && /Modo demo/.test(String(e.detail.msg || ''))) e.stopImmediatePropagation(); }, true);
  ls.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' }));   // sin nube: no se conecta a ninguna cuenta

  // ---------- Datos de ejemplo ----------
  var DIA = 864e5;
  // «data» de la app es una variable global (let), no una propiedad de window.
  function D(){ try{ return typeof data !== 'undefined' ? data : null; }catch(e){ return null; } }
  var P = {
    restaurante: [['Bandeja paisa', 28000, 11000, 'Platos'], ['Ajiaco', 22000, 8000, 'Platos'], ['Menú del día', 15000, 6000, 'Platos'], ['Mojarra frita', 32000, 14000, 'Platos'], ['Limonada', 6000, 1500, 'Bebidas'], ['Gaseosa', 4000, 1800, 'Bebidas', 48], ['Cerveza', 5000, 2500, 'Bebidas', 60], ['Postre del día', 7000, 2500, 'Postres']],
    bar: [['Cerveza Águila', 5000, 2500, 'Cervezas', 120], ['Club Colombia', 6000, 3000, 'Cervezas', 80], ['Aguardiente media', 45000, 22000, 'Licores', 12], ['Ron media', 55000, 28000, 'Licores', 10], ['Michelada', 9000, 3500, 'Cócteles'], ['Gaseosa', 4000, 1800, 'Bebidas', 40], ['Picada para 2', 32000, 14000, 'Comida']],
    tienda: [['Arroz 1 kg', 4200, 3300, 'Granos', 40], ['Aceite 1 L', 11500, 9200, 'Abarrotes', 18], ['Leche 1 L', 3900, 3100, 'Lácteos', 24], ['Huevos x 30', 16000, 13000, 'Abarrotes', 8], ['Pan tajado', 6500, 4800, 'Panadería', 10], ['Gaseosa 1.5 L', 5500, 4000, 'Bebidas', 30], ['Jabón de loza', 3500, 2400, 'Aseo', 15], ['Café 250 g', 9800, 7600, 'Abarrotes', 3]],
    hotel: [['Habitación sencilla', 120000, 30000, 'Habitaciones'], ['Habitación doble', 180000, 40000, 'Habitaciones'], ['Desayuno', 18000, 7000, 'Restaurante'], ['Lavandería', 15000, 4000, 'Servicios'], ['Agua', 3000, 1000, 'Minibar', 40], ['Cerveza', 6000, 2500, 'Minibar', 40]],
    motel: [['Rato (3 horas)', 45000, 8000, 'Tarifas'], ['Noche', 90000, 15000, 'Tarifas'], ['Hora adicional', 15000, 2000, 'Tarifas'], ['Cerveza', 6000, 2500, 'Bar', 60], ['Gaseosa', 4000, 1800, 'Bar', 40], ['Preservativos', 6000, 2500, 'Tienda', 30]],
    barberia: [['Corte', 20000, 0, 'Servicios'], ['Corte + barba', 30000, 0, 'Servicios'], ['Barba', 12000, 0, 'Servicios'], ['Cejas', 6000, 0, 'Servicios'], ['Cera para el cabello', 15000, 8000, 'Productos', 12]],
    agencia_viajes: [['Plan San Andrés 4 días', 1890000, 1500000, 'Planes'], ['Plan Cartagena 3 días', 990000, 780000, 'Planes'], ['Tour Guatapé', 180000, 120000, 'Tours'], ['Seguro de viaje', 60000, 35000, 'Servicios']]
  };
  function sembrar(){
    var d = D(); if(!d) return;
    var lista = P[tipo] || P.restaurante, cats = {};
    d.categories = []; d.products = lista.map(function(x, i){
      var c = x[3]; if(!cats[c]){ cats[c] = 'dc' + (d.categories.length + 1); d.categories.push({ id: cats[c], name: c }); }
      var p = { id: 'dp' + (i + 1), name: x[0], price: x[1], cost: x[2] || null, categoryId: cats[c] };
      if(x[4] != null) p.stock = x[4];
      return p;
    });
    // Ventas de la semana (para el inicio, las estadísticas y la contabilidad).
    var ahora = Date.now(), h = [], n = 0;
    for(var dia = 6; dia >= 0; dia--){
      var ventas = 4 + ((dia * 7) % 5);
      for(var v = 0; v < ventas; v++){
        var a = d.products[(v + dia) % d.products.length], b2 = d.products[(v * 3 + dia + 1) % d.products.length];
        var its = [{ name: a.name, qty: 1 + (v % 2), price: a.price, cost: a.cost }, { name: b2.name, qty: 1, price: b2.price, cost: b2.cost }];
        var tot = its.reduce(function(s, x){ return s + x.price * x.qty; }, 0), met = ['efectivo', 'transferencia', 'efectivo', 'nequi'][v % 4];
        var t = new Date(ahora - dia * DIA); t.setHours(11 + (v % 9), (v * 13) % 60, 0, 0); if(t.getTime() > ahora) t = new Date(ahora - (v + 1) * 6e5);
        h.push({ id: 'demo' + (++n), total: tot, debt: 0, items: its, date: t.toISOString(), tableName: 'Mostrador', inc: 0,
          payments: [{ method: met === 'nequi' ? 'transferencia' : met, amount: tot, note: met === 'nequi' ? 'Nequi' : '' }] });
      }
    }
    h.sort(function(x, y){ return Date.parse(y.date) - Date.parse(x.date); });
    d.history = h;
    // Dos cuentas abiertas (mesas, habitaciones, sillas…).
    d.tables = d.tables || {};
    [1, 2].forEach(function(id, i){
      var p = d.products[i], at = ahora - (i ? 25 : 70) * 6e4;
      d.tables[id] = Object.assign(d.tables[id] || {}, { items: [{ productId: p.id, name: p.name, price: p.price, qty: 1 + i, personId: null, history: [{ qty: 1 + i, at: at }] }], payments: [], people: [] });
      if(tipo === 'motel' || tipo === 'hotel') d.tables[id].entrada = at;
    });
    try{ saveData(); }catch(e){}
    try{ renderMesas(); }catch(e){}
    try{ window.dispatchEvent(new Event('vento-datos-remotos')); }catch(e){}
  }

  // ---------- Entrar solo con el negocio de ejemplo ----------
  function banda(){
    if(document.getElementById('demoBanda')) return;
    var b = document.createElement('div'); b.id = 'demoBanda'; b.setAttribute('data-novocab', '');
    b.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:99999;background:#7c3aed;color:#fff;border-radius:999px;padding:4px 6px 4px 12px;font:600 12px/1.3 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;gap:8px;align-items:center;white-space:nowrap;width:max-content;max-width:calc(100vw - 16px)';
    var url = location.pathname + location.hash;
    b.innerHTML = '<span>🎬 Demo · nada se guarda</span><a href="' + url.replace(/"/g, '') + '" style="color:#fff;background:rgba(255,255,255,.2);border-radius:999px;padding:2px 10px;text-decoration:none;white-space:nowrap">Crear mi negocio</a>';
    document.body.appendChild(b);
  }
  var intentos = 0;
  function entrar(){
    intentos++;
    var sel = document.getElementById('authType'), biz = document.getElementById('authBiz'), btn = document.getElementById('authBtn'), ov = document.getElementById('authOverlay');
    if(D() && ov && ov.hidden){ return listo(); }
    if(!sel || !biz || !btn){ if(intentos < 80) setTimeout(entrar, 150); return; }
    try{ sel.value = cfg.t; sel.dispatchEvent(new Event('change')); }catch(e){}
    biz.value = cfg.n;
    var u = document.getElementById('authUser'), c = document.getElementById('authPass');
    if(u) u.value = 'demo'; if(c) c.value = 'demo' + Math.random().toString(36).slice(2, 8);
    btn.click();
    var t0 = Date.now();
    (function esperar(){
      var o = document.getElementById('authOverlay');
      if(o && o.hidden && D()){ var s = document.getElementById('onbSaltar'); if(s) try{ s.click(); }catch(e){} setTimeout(listo, 400); return; }
      if(Date.now() - t0 < 15000) setTimeout(esperar, 150);
    })();
  }
  var hecho = false;
  function listo(){
    if(hecho) return; hecho = true;
    try{ document.querySelectorAll('.overlay.show').forEach(function(o){ o.classList.remove('show'); }); }catch(e){}
    sembrar(); banda();
    try{ showToast('🎬 Bienvenido al demo de ORDEVA: vende, cobra y mira todo. Nada de esto se guarda.', 7000); }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(entrar, 300); });
  else setTimeout(entrar, 300);
  window.ventoDemo = { tipo: tipo, tipos: Object.keys(TIPOS), sembrar: sembrar };
})();
