// 🏨 ORDEVA 1.87.0 · Hoteles: tarifas por temporada y comisión de Booking / Airbnb (lib/vento-hotel-tarifas.js).
//  1. La tarifa de la app da lo mismo que el servidor: fin de semana +20 %, temporada que cruza el año, temporada baja.
//  2. El editor de «Reservas en línea»: «del 15-12 al 15-01, +30 %» se guarda como 12-15 → 01-15.
//  3. La plataforma sale sola de la reserva del calendario (ical:Booking:…, 🔗 Airbnb).
//  4. En la cuenta de la habitación: «🌐 Viene de»; al cobrar, la venta guarda la comisión y queda el gasto en Contabilidad.
//  5. Si la venta se deshace, el gasto se quita. El % se cambia en Ajustes. En un restaurante no aplica.
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
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'hotel'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Hotel 187'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.businessType = 'hotel'; data.products = [{ id: 'hab', name: 'Habitación doble', price: 120000 }, { id: 'des', name: 'Desayuno', price: 18000 }]; data.history = []; data.contab = []; delete data.plataformasPct; saveData(); });

    // ===== 1 =====
    let v = await p.evaluate(() => { const T = window.ventoTarifas, sem = new Date(); sem.setDate(sem.getDate() + 10); sem.setHours(15, 0, 0, 0); const fin = new Date(sem); fin.setDate(sem.getDate() + 7);
      const rg = { temporadas: [{ n: 'Fin de año', desde: '12-20', hasta: '01-10', pct: 50 }, { n: 'Baja', desde: '03-01', hasta: '03-31', pct: -20 }] };
      return { semana: T.total({ finde: { pct: 20 } }, 100000, sem, fin), sin: T.total({}, 100000, sem, new Date(sem.getTime() + 3 * 864e5)),
        dic31: T.noche(rg, 100000, new Date(2026, 11, 31)), ene5: T.noche(rg, 100000, new Date(2027, 0, 5)), ene20: T.noche(rg, 100000, new Date(2027, 0, 20)), mar10: T.noche(rg, 100000, new Date(2027, 2, 10)) }; });
    chk('1. Igual que el servidor: una semana con fin de semana +20 % = $740.000; sin reglas, 3 noches = $300.000', v.semana === 740000 && v.sin === 300000, v);
    chk('1. Temporada que cruza el año +50 % (31 dic y 5 ene a $150.000, 20 ene normal) y temporada baja −20 % ($80.000)', v.dic31 === 150000 && v.ene5 === 150000 && v.ene20 === 100000 && v.mar10 === 80000, v);

    // ===== 2 =====
    v = await p.evaluate(() => { const ov = document.createElement('div'); ov.id = 'rsOv'; ov.innerHTML = window.ventoTarifas.htmlCfg({ temporadas: [{ n: 'Alta', desde: '12-15', hasta: '01-15', pct: 30 }], finde: { pct: 10 } }); document.body.appendChild(ov);
      ov.querySelector('[data-tf="mas"]').click(); const f = ov.querySelectorAll('.tf-t')[1]; f.querySelector('[data-tf="n"]').value = 'Puente'; f.querySelector('[data-tf="desde"]').value = '6/1'; f.querySelector('[data-tf="hasta"]').value = '8-1'; f.querySelector('[data-tf="pct"]').value = '25';
      const r = window.ventoTarifas.leer(); ov.remove(); return r; });
    chk('2. El editor guarda «del 15-12 al 15-01 +30 %», «Puente del 6/1 al 8-1 +25 %» y el fin de semana +10 %', v.temporadas.length === 2 && v.temporadas[0].desde === '12-15' && v.temporadas[0].hasta === '01-15' && v.temporadas[0].pct === 30 && v.temporadas[1].desde === '01-06' && v.temporadas[1].hasta === '01-08' && v.finde.pct === 10, v);

    // ===== 3 =====
    v = await p.evaluate(() => [window.ventoTarifas.plataformaDe({ nota: 'ical:Booking:abc123', cliente: '🔗 Booking' }), window.ventoTarifas.plataformaDe({ nota: null, cliente: '🔗 Airbnb' }), window.ventoTarifas.plataformaDe({ nota: 'Llego tarde', cliente: 'Ana' })]);
    chk('3. La plataforma sale de la reserva del calendario: Booking, Airbnb; una reserva directa no tiene', v[0] === 'Booking' && v[1] === 'Airbnb' && v[2] === '', v);

    // ===== 4 =====
    await p.evaluate(() => { data.tables[1] = { items: [{ productId: 'hab', name: 'Habitación doble', price: 120000, qty: 2, personId: null, history: [{ qty: 2, at: Date.now() - 864e5 }] }], payments: [], people: [] }; saveData(); openTableModal(1); }); await pausa(1200);
    v = await p.evaluate(() => { const b = document.getElementById('pfBox'); return b && !b.hidden ? b.innerText : null; });
    chk('4. En la cuenta de la habitación: «🌐 Viene de» (Directo, Booking 15 %, Airbnb 3 %…)', v && /Viene de/.test(v) && /Booking \(15 %\)/.test(v) && /Airbnb \(3 %\)/.test(v), v);
    await p.selectOption('#pfBox select', 'Booking'); await pausa(300);
    v = await p.evaluate(() => data.tables[1].plataforma);
    chk('4. Elegir «Booking» queda en la cuenta', v === 'Booking', v);
    await p.evaluate(() => { document.getElementById('overlay').classList.remove('show'); currentTable = null; });
    v = await p.evaluate(async () => { const e = await window.ventoPOS.cobrarMesa(1, { pago: { method: 'transferencia', metodo: 'transferencia', nota: 'Transferencia' } }); const g = (data.contab || []).find(x => x.origen === 'plataforma');
      return { pf: e && e.plataforma, pct: e && e.plataformaPct, com: e && e.comisionPlataforma, g: g && { cat: g.cat, monto: g.monto, ref: g.ref === e.id, tipo: g.tipo }, quedo: 'plataforma' in data.tables[1] }; });
    chk('4. Al cobrar ($240.000): la venta guarda Booking 15 % = $36.000', v.pf === 'Booking' && v.pct === 15 && v.com === 36000, v);
    chk('4. … y queda el gasto «Comisión de plataformas» de $36.000 en Contabilidad; la habitación queda sin plataforma', v.g && v.g.cat === 'plataformas' && v.g.monto === 36000 && v.g.ref && v.g.tipo === 'gasto' && !v.quedo, v);

    // ===== 5 =====
    v = await p.evaluate(() => { const e = data.history[0]; data.history.splice(0, 1); window.ventoTarifas.limpiar(); return (data.contab || []).filter(x => x.origen === 'plataforma').length; });
    chk('5. Si la venta se deshace, el gasto de la comisión se quita', v === 0, v);
    await p.click('nav button[data-view="ajustes"]'); await pausa(200);
    await p.click('.ajustes-cat[data-cat="negocio"]').catch(() => {}); await pausa(300);
    v = await p.evaluate(() => { const i = document.querySelector('#plataformasBox [data-pfp="Booking"]'); if(!i) return null; i.value = '18'; i.dispatchEvent(new Event('change')); return window.ventoTarifas.pctDe('Booking'); });
    chk('5. Ajustes → Negocio: Booking al 18 %', v === 18, v);
    v = await p.evaluate(async () => { data.businessType = 'restaurante'; data.tables[2] = { items: [{ productId: 'des', name: 'Desayuno', price: 18000, qty: 1, personId: null, history: [] }], payments: [], people: [] , plataforma: 'Booking' };
      const e = await window.ventoPOS.cobrarMesa(2, { pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' } }); data.businessType = 'hotel'; return { pf: e && e.plataforma, g: (data.contab || []).filter(x => x.origen === 'plataforma').length }; });
    chk('5. En un restaurante no aplica (sin comisión ni gasto)', v.pf === undefined && v.g === 0, v);
    v = await p.evaluate(async () => { const a = window.closeTableToHistory; await new Promise(r => setTimeout(r, 2500)); const f = window.closeTableToHistory; return { igual: a === f, marcas: ['_mp', '_caja', '_ht', '_hp', '_mt', '_ag', '_pf'].filter(k => f[k]).length }; });
    chk('5. «Cerrar cuenta» no se vuelve a envolver (lleva las 7 marcas)', v.igual && v.marcas === 7, v);

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
