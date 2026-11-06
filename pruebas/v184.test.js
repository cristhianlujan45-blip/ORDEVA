// ✂️🙈 ORDEVA 1.84.0 · Comisiones del personal y arqueo ciego (puente/egm/POS-COMPLETO.md, sección 3).
//  Comisiones:
//   1. En Ajustes → Negocio el dueño agrega a las personas con su % (servicios y productos).
//   2. Al cobrar en la caja se pregunta «¿Quién atendió?»; la venta guarda en cada renglón la persona y su comisión.
//   3. Cambiar el % después no cambia lo que ya se ganó.
//   4. «✂️ ¿Quién?» en el renglón del carrito; con la persona puesta ya no se pregunta.
//   5. Con una sola persona no se pregunta. 6. En la cuenta de la silla / mesa también.
//   7. Deshacer quita la comisión; una devolución la descuenta.
//   8. El informe por persona y «Pagar»: queda en la lista de pagos, en Contabilidad («Comisiones») y, si es de la caja,
//      como salida de la caja.
//  Arqueo ciego:
//   9. El dueño lo prende en Ajustes; él sigue viendo lo que debe haber.
//  10. El cajero no ve lo esperado en: la caja, el arqueo (ni si cuadra), «Caja de hoy», el corte X y la pregunta de cerrar.
//  11. El cierre calcula lo esperado y la diferencia al mostrarlo (no usa el número guardado).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'barberia'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Barbería 184'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'corte', name: 'Corte', price: 20000 }, { id: 'barba', name: 'Barba', price: 10000 }, { id: 'cera', name: 'Cera', price: 15000, stock: 10 }];
      data.history = []; data.closures = []; data.contab = []; data.comisionistas = []; data.comisionPagos = []; data.comisionesOn = false; saveData(); });

    // ===== 1. Ajustes =====
    await p.click('nav button[data-view="ajustes"]'); await pausa(300);
    await p.click('.ajustes-cat[data-cat="negocio"]').catch(() => {}); await pausa(400);
    let v = await p.evaluate(() => !!document.getElementById('comisionesBox') && !!document.getElementById('arqueoCiegoBox'));
    chk('1. Ajustes → Negocio tiene «✂️ Comisiones del personal» y «🙈 Arqueo ciego» (para el dueño)', v);
    await p.fill('#comNombre', 'Juan'); await p.fill('#comPct', '40'); await p.click('#comAdd'); await pausa(150);
    await p.fill('#comNombre', 'Pedro'); await p.fill('#comPct', '50'); await p.click('#comAdd'); await pausa(150);
    v = await p.evaluate(() => { const pe = data.comisionistas.find(x => x.nombre === 'Pedro'); const inp = document.querySelector('#comisionesBox .com-p[data-id="' + pe.id + '"] .com-pct[data-k="pctProd"]'); inp.value = '10'; inp.dispatchEvent(new Event('change')); return { on: data.comisionesOn, l: data.comisionistas.map(x => x.nombre + ':' + x.pct + '/' + x.pctProd), activas: window.ventoComisiones.on() }; });
    chk('1. Agregar a Juan (40 %) y a Pedro (50 %, y 10 % de productos) prende las comisiones', v.on && v.activas && v.l.join() === 'Juan:40/0,Pedro:50/10', v);

    // ===== 2. Cobro en la caja con «¿Quién atendió?» =====
    await p.evaluate(() => { window.ventoPOS.abrirCaja(); }); await pausa(500);
    await p.evaluate(() => { window.ventoPOS.agregar('corte', 1); window.ventoPOS.agregar('cera', 1); }); await pausa(200);
    await p.evaluate(() => { window._c1 = window.ventoPOS.cobrar({ pago: { method: 'efectivo', metodo: 'efectivo' } }); }); await pausa(300);
    v = await p.evaluate(() => { const o = document.querySelector('.com-ov'); return o ? [...o.querySelectorAll('[data-todos]')].map(x => x.textContent.trim()) : null; });
    chk('2. Al cobrar sale «¿Quién atendió?» con Juan y Pedro', v && v.length === 2 && v.some(x => /Juan/.test(x)) && v.some(x => /Pedro/.test(x)), v);
    await p.evaluate(() => { const jid = data.comisionistas.find(x => x.nombre === 'Juan').id; document.querySelector('.com-ov [data-todos="' + jid + '"]').click(); });
    v = await p.evaluate(async () => { const e = await window._c1; return e && e.items.map(x => x.name + ':' + x.quien + ':' + x.comPct + ':' + x.com); });
    chk('2. La venta guarda en cada renglón a Juan y su comisión: Corte 40 % = $8.000; Cera (producto, Juan 0 %) = $0', v && v.join() === 'Corte:Juan:40:8000,Cera:Juan:0:0', v);

    // ===== 3. Cambiar el % no cambia el pasado =====
    v = await p.evaluate(() => { const j = data.comisionistas.find(x => x.nombre === 'Juan'); const inp = document.querySelector('#comisionesBox .com-p[data-id="' + j.id + '"] .com-pct[data-k="pct"]'); if(inp){ inp.value = '50'; inp.dispatchEvent(new Event('change')); } else j.pct = 50;
      const r = window.ventoComisiones.resumen('hoy').filas.find(f => f.nombre === 'Juan'); return { pct: j.pct, com: r && r.com, h: data.history[0].items[0].com }; });
    chk('3. Juan pasa a 50 %: la venta de antes sigue con $8.000', v.pct === 50 && v.com === 8000 && v.h === 8000, v);

    // ===== 4. «✂️ ¿Quién?» en el renglón del carrito =====
    await p.evaluate(() => { window.ventoPOS.agregar('corte', 1); }); await pausa(300);
    v = await p.evaluate(() => { const b = document.querySelector('.pz-quien'); return b ? b.textContent.trim() : null; });
    chk('4. El renglón del carrito muestra «✂️ ¿Quién?»', v && /¿Quién\?/.test(v), v);
    await p.click('.pz-quien'); await pausa(200);
    await p.evaluate(() => { const pid = data.comisionistas.find(x => x.nombre === 'Pedro').id; document.querySelector('.com-ov [data-p="' + pid + '"]').click(); }); await pausa(250);
    v = await p.evaluate(() => { const b = document.querySelector('.pz-quien'); return b ? b.textContent.trim() : null; });
    chk('4. Al elegir a Pedro, el renglón dice «✂️ Pedro»', v && /Pedro/.test(v), v);
    v = await p.evaluate(async () => { const pr = window.ventoPOS.cobrar({ pago: { method: 'nequi', metodo: 'nequi', nota: 'Nequi' } }); await new Promise(r => setTimeout(r, 300)); const preg = !!document.querySelector('.com-ov'); const e = await pr; return { preg, it: e && e.items.map(x => x.quien + ':' + x.com) }; });
    chk('4. Con la persona ya puesta no se pregunta, y Pedro gana el 50 % ($10.000)', !v.preg && v.it && v.it.join() === 'Pedro:10000', v);

    // ===== 5. Una sola persona: no se pregunta =====
    v = await p.evaluate(async () => { const pe = data.comisionistas.find(x => x.nombre === 'Pedro'); pe.baja = true; window.ventoPOS.agregar('barba', 1);
      const pr = window.ventoPOS.cobrar({ pago: { method: 'efectivo', metodo: 'efectivo' } }); await new Promise(r => setTimeout(r, 300)); const preg = !!document.querySelector('.com-ov'); const e = await pr; pe.baja = false; return { preg, it: e && e.items.map(x => x.quien + ':' + x.com) }; });
    chk('5. Con una sola persona (Pedro quitado) no se pregunta: queda Juan, 50 % de $10.000 = $5.000', !v.preg && v.it && v.it.join() === 'Juan:5000', v);

    // ===== 6. Cuenta de la silla / mesa =====
    await p.evaluate(() => { try{ window.ventoPOS.cerrarCaja(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    v = await p.evaluate(async () => {
      if(!data.tables[1]) data.tables[1] = { items: [], payments: [], people: [] };
      data.tables[1].items = [{ productId: 'corte', name: 'Corte', price: 20000, qty: 1, personId: null, history: [] }, { productId: 'barba', name: 'Barba', price: 10000, qty: 1, personId: null, history: [] }];
      const pr = window.ventoPOS.cobrarMesa(1, { pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' } }); await new Promise(r => setTimeout(r, 300));
      const o = document.querySelector('.com-ov'); if(!o) return { preg: false };
      o.querySelector('details.com-uno').open = true;
      const sel = o.querySelectorAll('.com-sel'), jid = data.comisionistas.find(x => x.nombre === 'Juan').id, pid = data.comisionistas.find(x => x.nombre === 'Pedro').id;
      sel[0].value = jid; sel[1].value = pid; o.querySelector('.com-listo').click();
      const e = await pr; return { preg: true, it: e && e.items.map(x => x.name + ':' + x.quien + ':' + x.com) }; });
    chk('6. En la cuenta de la silla: uno por servicio (Corte con Juan $10.000, Barba con Pedro $5.000)', v.preg && v.it && v.it.join() === 'Corte:Juan:10000,Barba:Pedro:5000', v);

    // ===== 7. Deshacer y devolución =====
    v = await p.evaluate(() => {
      const juan = () => (window.ventoComisiones.resumen('hoy').filas.find(f => f.nombre === 'Juan') || {}).com;
      const antes = juan();
      const e = data.history.find(h => h.items.some(x => x.name === 'Barba' && x.quien === 'Juan'));
      qsDeshacerVenta(e); const sinBarba = juan();
      const c = data.history.find(h => h.items.some(x => x.name === 'Corte' && x.quien === 'Juan' && x.com === 8000));
      c.devoluciones = [{ t: Date.now(), items: [{ name: 'Corte', qty: 1, price: 20000 }], total: 20000 }];
      return { antes, sinBarba, conDev: juan() }; });
    chk('7. Deshacer la venta de la barba quita sus $5.000 de Juan (23.000 → 18.000)', v.antes === 23000 && v.sinBarba === 18000, v);
    chk('7. Devolver el primer corte descuenta sus $8.000 (queda $10.000)', v.conDev === 10000, v);

    // ===== 8. Informe y pago =====
    await p.evaluate(() => { window.ventoTurno.abrir(100000); window.ventoComisiones.informe('hoy'); }); await pausa(300);
    v = await p.evaluate(() => { const o = document.querySelector('.com-ov'); return o ? o.innerText : ''; });
    chk('8. El informe muestra a Juan ($10.000) y a Pedro ($15.000) con lo que falta por pagar', /Juan/.test(v) && /Pedro/.test(v) && /10\.000/.test(v) && /15\.000/.test(v) && /por pagar/.test(v), v);
    await p.evaluate(() => { const jid = data.comisionistas.find(x => x.nombre === 'Juan').id; document.querySelector('.com-ov [data-pagar="' + jid + '"]').click(); }); await pausa(250);
    await p.evaluate(() => { const ovs = [...document.querySelectorAll('.com-ov')], o = ovs[ovs.length - 1]; o.querySelector('.com-valor').value = '10000'; o.querySelector('.com-metodo').value = 'caja'; o.querySelector('[data-si]').click(); }); await pausa(300);
    v = await p.evaluate(() => { const jid = data.comisionistas.find(x => x.nombre === 'Juan').id, f = window.ventoComisiones.resumen('hoy').filas.find(x => x.id === jid);
      const ct = (data.contab || []).filter(g => g.cat === 'comisiones'), mv = window.ventoTurno.turno().movs.filter(m => m.tipo === 'salida');
      return { pagos: data.comisionPagos.length, debe: f.debe, ct: ct.map(g => g.tipo + ':' + g.monto), mv: mv.map(m => m.monto), esperado: window.ventoTurno.resumen().esperado, txt: document.querySelector('.com-ov') ? document.querySelector('.com-ov').innerText : '' }; });
    chk('8. Pagarle $10.000 a Juan de la caja: queda en los pagos, Juan al día', v.pagos === 1 && v.debe === 0, v);
    chk('8. … y queda como gasto «Comisiones» en Contabilidad y como salida de la caja (lo esperado baja)', v.ct.join() === 'gasto:10000' && v.mv.join() === '10000' && v.esperado === 100000 - 10000, v);
    await p.evaluate(() => document.querySelectorAll('.com-ov').forEach(o => o.remove()));

    // ===== 9–11. Arqueo ciego =====
    await p.click('nav button[data-view="ajustes"]'); await pausa(200);
    await p.click('.ajustes-cat[data-cat="negocio"]').catch(() => {}); await pausa(300);
    await p.evaluate(() => { const t = document.getElementById('arqueoCiegoOn'); t.checked = true; t.dispatchEvent(new Event('change')); });
    v = await p.evaluate(() => ({ on: !!data.permisosEquipo.arqueoCiego, ciego: window.ventoTurno.ciego(), hoy: window.ventoTurno.bloqueHoy() }));
    chk('9. El dueño prende el arqueo ciego; él sigue viendo «Efectivo que debe haber»', v.on && !v.ciego && /debe haber/.test(v.hoy), v);
    v = await p.evaluate(() => {
      window.ventoRoles.esJefe = () => false;   // ahora es un cajero
      const r = { ciego: window.ventoTurno.ciego(), hoy: window.ventoTurno.bloqueHoy() };
      window.ventoTurno.panel(); const pan = document.querySelector('.vt-ov:last-of-type').innerText; document.querySelectorAll('.vt-ov').forEach(o => o.remove());
      const c = window.ventoCajaMas.corte(window.ventoTurno.turno().abierto_en);
      return Object.assign(r, { pan, corteT: window.ventoCajaMas.textoCorte(c), resumen: cierreResumenTexto(computeClosureStats(null, new Date().toISOString()), [], null) }); });
    chk('10. Cajero: «Caja de hoy» no dice cuánto debe haber', v.ciego && !/debe haber/i.test(v.hoy), v.hoy);
    chk('10. Cajero: la ventana de la caja no muestra las ventas en efectivo ni lo que debe haber', !/debe haber|Ventas en efectivo/i.test(v.pan) && /Arqueo ciego/.test(v.pan), v.pan);
    chk('10. Cajero: el corte X no muestra el efectivo', !/Efectivo/i.test(v.corteT), v.corteT);
    chk('10. Cajero: la pregunta de cerrar la caja no dice el efectivo', !/efectivo \$/.test(v.resumen) && /Ventas/.test(v.resumen), v.resumen);
    await p.evaluate(() => { window._aq = window.ventoTurno.arqueo(30000); }); await pausa(250);
    v = await p.evaluate(() => { const o = document.querySelector('.vt-ov:last-of-type'); o.querySelector('#vtTotal').value = '50000'; o.querySelector('#vtTotal').dispatchEvent(new Event('input', { bubbles: true })); return { dif: o.querySelector('#vtDif').textContent, txt: o.innerText }; });
    chk('10. Cajero: el arqueo solo dice lo contado (ni lo que debía haber, ni si faltan o sobran)', /Contado: \$\s?50\.000/.test(v.dif) && !/Faltan|Sobran|Cuadra exacto|debe haber/i.test(v.txt), v);
    v = await p.evaluate(async () => { document.querySelector('.vt-ov:last-of-type [data-si]').click(); const c = await window._aq; const h = window.ventoTurno.html(c); return { dif: c.diferencia, h }; });
    chk('10. … el cierre guarda la diferencia, pero al cajero le dice «el dueño ve si cuadra»', typeof v.dif === 'number' && /dueño ve si cuadra/.test(v.h) && !/Faltan|Sobran/.test(v.h), v);
    v = await p.evaluate(() => { window.ventoRoles.esJefe = () => true;
      const c = { base: 100000, ventas: 50000, entradas: 0, salidas: 0, esperado: 999999, contado: 120000, diferencia: 5 };
      return { h: window.ventoTurno.html(c), t: window.ventoTurno.texto(c) }; });
    chk('11. El dueño ve el cierre con lo esperado calculado al mostrarlo ($150.000) y «Faltan $30.000», no el número guardado', /150\.000/.test(v.h) && /Faltan/.test(v.h) && /30\.000/.test(v.h) && !/999\.999/.test(v.h) && /faltan \$\s?30\.000/.test(v.t), v);

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
