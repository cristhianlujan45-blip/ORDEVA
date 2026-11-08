// 🧾 ORDEVA 1.95.4 · Arreglos de la auditoría 1.95.3 en la app (puente/egm/AUDITORIA-1.95.3.md):
//  M4. Si se cancela el cobro, la propina que se acababa de agregar sale de la cuenta (antes se volvía a sumar).
//  M5. Cancelar el conteo del cierre deja las cuentas abiertas como estaban (antes quedaban cerradas como «debe»).
//  M1. «Deshacer» un cobro devuelve también el resto de la cuenta (consumo mínimo propio, huésped, hora de entrada…).
//  M2. Si el total cambia mientras se elige cómo pagan, no se cobra con el total viejo.
//  M3. Bonos: «Cancelar» espera mientras se usa el bono, y si la venta no queda el saldo vuelve al bono.
//  M6. La diferencia del consumo mínimo no da comisión.   M7. «Agregar» con cantidad respeta los cupos de un plan.
//  S4. Topes: domicilios del link (y nada si están apagados), pedidos sin código, solicitudes de planes.
//  Y7. Hasta 32 códigos por mesa entre equipos.   P2. Un botón escondido del menú no se ve.   P4. «Más» trae Productos e
//  Inventario.   P5. El diagnóstico lleva el rol y la pantalla.   P1. No se puede quitar uno mismo el administrador.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('✗ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'bar'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Bar 1954'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'cv', name: 'Cerveza', price: 5000 }, { id: 'pk', name: 'Picada', price: 30000 }];
      data.history = []; Object.keys(data.tables || {}).forEach(k => { data.tables[k] = { items: [], payments: [], people: [] }; }); data.tableCount = Math.max(12, data.tableCount || 0); saveData();
      window.mk = (id, its) => { data.tables[id] = { payments: [], people: [], items: its.map(([pid, q]) => { const pr = data.products.find(x => x.id === pid); return { productId: pid, name: pr.name, price: pr.price, qty: q, personId: null, history: [{ qty: q, at: Date.now() }] }; }) }; saveData(); };
      window.esperaOv = sel => new Promise(res => { const t0 = Date.now(); (function v(){ const o = document.querySelector(sel); if(o) return res(o); if(Date.now() - t0 > 5000) return res(null); setTimeout(v, 50); })(); });
    });

    // ===== M4 =====
    await p.evaluate(() => { data.tipsOn = true; mk(1, [['cv', 2]]); openTableModal(1); });
    await pausa(300);
    await p.evaluate(() => document.getElementById('chargeBtn').click());
    await p.locator('button', { hasText: '10% de propina' }).click({ timeout: 5000 });
    await p.waitForSelector('.pz-pago-ov .pz-cancel', { timeout: 5000 }); await pausa(700);
    let v = await p.evaluate(() => data.tables[1].items.map(i => i.name));
    chk('M4. Al escoger la propina queda en la cuenta mientras se cobra', v.includes('🙏 Propina'), v);
    await p.click('.pz-pago-ov .pz-cancel'); await pausa(400);
    v = await p.evaluate(() => ({ its: data.tables[1].items.map(i => i.name), saldo: tableBalance(1) }));
    chk('M4. Se cancela el cobro: la propina sale de la cuenta (no se suma otra vez)', !v.its.includes('🙏 Propina') && v.saldo === 10000, v);
    await p.evaluate(() => { data.tipsOn = false; document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); currentTable = null; });

    // ===== M5 =====
    v = await p.evaluate(async () => {
      mk(2, [['pk', 1]]); mk(3, [['cv', 3]]); data.tables[3].payments = [{ note: 'abono', amount: 5000, method: 'efectivo', at: Date.now() }];
      data.history.push({ id: 'h0', date: new Date().toISOString(), items: [{ name: 'Cerveza', qty: 1, price: 5000 }], total: 5000, payments: [{ method: 'efectivo', amount: 5000 }], debt: 0 }); saveData();
      const sc = window.showConfirm; window.showConfirm = async () => true;
      const T = window.ventoTurno, aq = T && T.arqueo; if(T) T.arqueo = async () => null;
      const h0 = data.history.length, c0 = (data.closures || []).length;
      await closeCashRegister();
      window.showConfirm = sc; if(T) T.arqueo = aq;
      return { conTurno: !!T, h: data.history.length - h0, c: (data.closures || []).length - c0, t2: (data.tables[2].items || []).map(i => i.name), t3: (data.tables[3].items || []).length, pag3: (data.tables[3].payments || []).length };
    });
    chk('M5. Cancelar el conteo del cierre: no queda cierre ni ventas «debe» nuevas', v.conTurno && v.h === 0 && v.c === 0, v);
    chk('M5. … y las cuentas abiertas siguen como estaban (con su abono)', v.t2.includes('Picada') && v.t3 === 1 && v.pag3 === 1, v);

    // ===== M1 =====
    v = await p.evaluate(async () => {
      mk(4, [['cv', 2]]); Object.assign(data.tables[4], { minimo: 50000, huesped: 'Carlos', entrada: 1700000000000, nota: 'cumpleaños' }); saveData();
      const e = await window.ventoPOS.cobrarMesa(4, { pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' }, motelVisto: true, minimoVisto: true });
      const b = document.querySelector('#pzDeshacer .pz-dbtn'); if(b) b.click();
      await new Promise(r => setTimeout(r, 300));
      const t = data.tables[4] || {};
      return { cobro: !!e, items: (t.items || []).length, minimo: t.minimo, huesped: t.huesped, entrada: t.entrada, nota: t.nota };
    });
    chk('M1. «Deshacer» el cobro devuelve la cuenta con su consumo mínimo, huésped, hora de entrada y nota', v.cobro && v.items === 1 && v.minimo === 50000 && v.huesped === 'Carlos' && v.entrada === 1700000000000 && v.nota === 'cumpleaños', v);
    await p.evaluate(() => { data.tables[4] = { items: [], payments: [], people: [] }; saveData(); });

    // ===== M2 =====
    v = await p.evaluate(async () => {
      mk(5, [['cv', 2]]);
      const pr = window.ventoPOS.cobrarMesa(5, { desdeCuenta: true, motelVisto: true, minimoVisto: true });
      const ov = await esperaOv('.pz-pago-ov'); await new Promise(r => setTimeout(r, 700));
      data.tables[5].items.push({ productId: 'cv', name: 'Cerveza', price: 5000, qty: 1, personId: null, history: [] });   // otro equipo agrega mientras tanto
      const pc = ov.querySelector('.pz-pagacon'); pc.value = '10000'; pc.dispatchEvent(new Event('input'));
      ov.querySelector('.pz-met[data-m="efectivo"]').click();
      const e = await pr;
      return { cobro: !!e, abierta: (data.tables[5].items || []).length, h: data.history.filter(h => h.table === 5 || h.tableId === 5).length };
    });
    chk('M2. El total cambió mientras se elegía cómo pagan: no se cobra con el total viejo y la cuenta sigue abierta', !v.cobro && v.abierta === 2, v);
    await p.evaluate(() => { data.tables[5] = { items: [], payments: [], people: [] }; saveData(); });

    // ===== M3 =====
    v = await p.evaluate(async () => {
      const B = window.ventoBonos; const llamadas = [];
      // Bono de mentiras (sin servidor): se redime y se devuelve como lo haría el servidor.
      const nb = window.ventoNube; const orig = { neg: nb.negocio, cli: nb.cliente };
      let soltar; const redimir = new Promise(r => { soltar = r; });
      nb.negocio = () => ({ id: 'n1', nombre: 'x', rol: 'dueno' });
      nb.cliente = async () => ({ rpc: async (fn, a) => { llamadas.push([fn, a && a.p_ref]);
        if(fn === 'bono_ver') return { data: { ok: true, bono: { codigo: 'ABC123', saldo: 100000, estado: 'activo' } } };
        if(fn === 'bono_redimir'){ await redimir; return { data: { ok: true, usado: 10000, bono: { saldo: 90000 } } }; }
        if(fn === 'bono_devolver') return { data: { ok: true, n: 1 } };
        return { data: null }; } });
      mk(6, [['cv', 2]]);
      const pr = window.ventoPOS.cobrarMesa(6, { desdeCuenta: true, motelVisto: true, minimoVisto: true });
      const ov = await esperaOv('.pz-pago-ov'); await new Promise(r => setTimeout(r, 700));
      ov.querySelector('.pz-bono-btn').click(); await new Promise(r => setTimeout(r, 100));
      ov.querySelector('.pz-bono-cod').value = 'ABC123'; ov.querySelector('.pz-bono-ver').click(); await new Promise(r => setTimeout(r, 200));
      ov.querySelector('.pz-bono-ok').click(); await new Promise(r => setTimeout(r, 100));
      ov.querySelector('.pz-cancel').click(); await new Promise(r => setTimeout(r, 100));
      const sigue = document.body.contains(ov);
      data.tables[6] = { items: [], payments: [], people: [] };   // otro equipo cobró la mesa mientras tanto
      soltar(); const e = await pr; await new Promise(r => setTimeout(r, 300));
      nb.negocio = orig.neg; nb.cliente = orig.cli;
      const ref = (llamadas.find(x => x[0] === 'bono_redimir') || [])[1];
      return { sigue, cobro: !!e, devuelto: llamadas.some(x => x[0] === 'bono_devolver' && x[1] === ref), llamadas: llamadas.map(x => x[0]) };
    });
    chk('M3. «Cancelar» mientras se usa el bono: la ventana espera (no se pierde el descuento)', v.sigue, v);
    chk('M3. La venta no quedó (la mesa ya no estaba): el saldo vuelve al bono con la misma referencia', !v.cobro && v.devuelto, v);
    await p.evaluate(() => document.querySelectorAll('.pz-pago-ov').forEach(o => o.remove()));

    // ===== M6 =====
    v = await p.evaluate(() => { const C = window.ventoComisiones, M = window.ventoMinimo;
      return { nombre: M && M.NOMBRE, aplicaMin: C.aplica({ productId: null, name: M.NOMBRE, price: 20000, qty: 1 }), aplicaServ: C.aplica({ productId: null, name: 'Servicio', price: 20000, qty: 1 }) }; });
    chk('M6. La diferencia del consumo mínimo no lleva comisión (un servicio sí)', !!v.nombre && v.aplicaMin === false && v.aplicaServ === true, v);

    // ===== M7 =====
    v = await p.evaluate(async () => {
      const A = window.ventoAgencia, act = A.activo; A.activo = () => true;
      data.products.push({ id: 'pl', name: 'Plan Cartagena', price: 900000, det: { cupos: '3' } }); mk(7, []); openTableModal(7);
      await new Promise(r => setTimeout(r, 200));
      const pon = q => { document.getElementById('addProductId').value = 'pl'; document.getElementById('addProductSearch').value = 'Plan Cartagena'; document.getElementById('addQty').value = String(q); document.getElementById('addItemBtn').click(); };
      pon(5); const tras5 = (data.tables[7].items || []).reduce((s, i) => s + i.qty, 0);
      pon(3); const tras3 = (data.tables[7].items || []).reduce((s, i) => s + i.qty, 0);
      A.activo = act; document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); currentTable = null;
      data.tables[7] = { items: [], payments: [], people: [] }; data.products = data.products.filter(x => x.id !== 'pl'); saveData();
      return { tras5, tras3 };
    });
    chk('M7. «Agregar» 5 de un plan con 3 cupos: no deja; 3 sí', v.tras5 === 0 && v.tras3 === 3, v);

    // ===== S4 =====
    v = await p.evaluate(() => {
      data.domicilios = []; data.domiciliosOn = false; saveData();
      window.__canalMsgId = 'x0'; domRecibir('Ana | 300 | Calle 1 | 1 picada');
      const apagado = (data.domicilios || []).length;
      data.domiciliosOn = true;
      for(let i = 0; i < 45; i++){ window.__canalMsgId = 'dmx' + i; domRecibir('Cliente ' + i + ' | 300 | Calle ' + i + ' | 1 picada'); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); }
      const prendido = data.domicilios.length; window.__canalMsgId = null;
      data.domicilios = []; data.domiciliosOn = false;
      data.pedidos = []; for(let i = 0; i < 35; i++) window.vitoMod.procesar(JSON.stringify({ t: 'pedido', v: 2, id: 'psc' + i, mesa: 1, vm: 'falso', items: [{ n: 'Cerveza', q: 1 }], at: Date.now() }));
      const sinCod = (data.pedidos || []).filter(x => x.sinCodigo).length; data.pedidos = [];
      const A = window.ventoAgencia, act = A.activo; A.activo = () => true; data.solicitudesPlan = [];
      for(let i = 0; i < 55; i++){ window.__canalMsgId = 'spx' + i; A.recibir('Cliente ' + i + ' | 300 | Plan X | 2 | mañana'); }
      const planes = (data.solicitudesPlan || []).length; A.activo = act; window.__canalMsgId = null; data.solicitudesPlan = []; saveData();
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      return { apagado, prendido, sinCod, planes };
    });
    chk('S4. Con domicilios apagados, el link no guarda nada', v.apagado === 0, v);
    chk('S4. Como mucho 40 domicilios del link por facturar', v.prendido === 40, v);
    chk('S4. Como mucho 30 pedidos sin código esperando', v.sinCod === 30, v);
    chk('S4. Como mucho 50 solicitudes de planes sin atender', v.planes === 50, v);

    // ===== Y7 =====
    v = await p.evaluate(() => { data.qrCodigos = { 2: Array.from({ length: 20 }, (_, i) => 'codigootro' + String(i).padStart(3, '0')) };
      const M = window.vitoMod, c = M.qCfg(); c.v = Object.assign({}, c.v || {}, { 2: 'codigodeesteequipo2' }); M.SS('vito_qr', c);
      window.dispatchEvent(new Event('vento-datos-remotos'));
      return new Promise(r => setTimeout(() => r({ n: (data.qrCodigos[2] || []).length, tiene: (data.qrCodigos[2] || []).includes('codigodeesteequipo2'), primero: (data.qrCodigos[2] || []).includes('codigootro000') }), 3800)); });
    chk('Y7. Con 21 códigos para una mesa entre equipos, no se pierde ninguno', v.n === 21 && v.tiene && v.primero, v);

    // ===== P2, P4 =====
    v = await p.evaluate(() => { const bt = document.querySelector('nav button[data-view="historial"]'); bt.hidden = true; const vis = getComputedStyle(bt).display; bt.hidden = false;
      return { vis, prod: !!document.querySelector('.more-tile[data-go="productos"]'), inv: !!document.querySelector('.more-tile[data-go="inventario"]') }; });
    chk('P2. Un botón del menú con «hidden» no se ve', v.vis === 'none', v);
    chk('P4. «Más» trae Productos e Inventario', v.prod && v.inv, v);

    // ===== P5 =====
    v = await p.evaluate(() => (window.ventoDiagnostico() || {}).pantalla);
    chk('P5. El diagnóstico de «Reportar un problema» lleva el rol, los menús escondidos y el tamaño de la pantalla', !!v && 'rol' in v && Array.isArray(v.ocultos) && v.ancho === 1280 && typeof v.scroll === 'number', v);

    // ===== P1 =====
    v = await p.evaluate(() => {
      const l = authUsers(); if(!l.some(u => u.user === 'luis')) l.push({ user: 'luis', role: 'admin', cuenta: (l.find(u => u.user === authUser) || {}).cuenta });
      localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(l));
      window.__t = []; const o = window.showToast; window.showToast = function(t){ window.__t.push(String(t)); return o.apply(this, arguments); };
      accUsuariosPintar();
      const fila = [...document.querySelectorAll('#accUsersList .acc-user')].find(r => /\(tú\)/.test(r.innerText));
      const bt = fila && [...fila.querySelectorAll('button')].find(x => /Hacer mesero/.test(x.textContent)); if(bt) bt.click();
      window.showToast = o;
      return { boton: !!bt, rol: (authUsers().find(u => u.user === authUser) || {}).role, aviso: window.__t.join(' | ') };
    });
    chk('P1. «Hacer mesero» sobre uno mismo no se deja (con dos administradores en el equipo)', v.boton && v.rol === 'admin' && /propio administrador/.test(v.aviso), v);
  }catch(e){ mal++; console.log('✗ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
