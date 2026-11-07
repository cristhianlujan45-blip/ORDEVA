// ⏱️ ORDEVA 1.85.0 · Motel por horas (lib/vento-motel.js).
//  1. El plan sale del nombre de la tarifa: «Rato (3 horas)» = 3 h, «4 horas» = 4 h, «Noche» = 12 h; «Hora adicional» es la extra.
//  2. Dentro del tiempo: el mapa dice a qué hora sale. Dentro de la tolerancia (10 min) no cobra.
//  3. Pasado el tiempo: «⏰ Se pasó 25 min · 1 hora adicional» en el mapa y en la cuenta, con «Sumar».
//  4. Al cobrar: «¿Sumar las horas adicionales?» (sumar y cobrar / cobrar sin sumar / cancelar). La venta guarda la entrada,
//     la salida y los minutos.
//  5. Ajustes: tolerancia y cuánto dura la noche. Solo en moteles.
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
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'motel'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Motel 185'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.businessType = 'motel'; delete data.motelCfg;
      data.products = [{ id: 'rato', name: 'Rato (3 horas)', price: 45000 }, { id: 'noche', name: 'Noche', price: 90000 }, { id: 'cuatro', name: 'Suite 4 horas', price: 70000 }, { id: 'extra', name: 'Hora adicional', price: 15000 }, { id: 'cv', name: 'Cerveza', price: 5000, stock: 20 }];
      data.history = []; Object.keys(data.tables || {}).forEach(k => { data.tables[k] = { items: [], payments: [], people: [] }; }); saveData();
      window.mk = (id, mins, extra) => { const at = Date.now() - mins * 6e4; data.tables[id] = { entrada: at, payments: [], people: [], items: [{ productId: 'rato', name: 'Rato (3 horas)', price: 45000, qty: 1, personId: null, history: [{ qty: 1, at }] }, { productId: 'cv', name: 'Cerveza', price: 5000, qty: 2, personId: null, history: [{ qty: 2, at }] }].concat(extra ? [{ productId: 'extra', name: 'Hora adicional', price: 15000, qty: extra, personId: null, history: [{ qty: extra, at }] }] : []) }; saveData(); }; });

    // ===== 1 =====
    let v = await p.evaluate(() => { const M = window.ventoMotel; return { rato: M.horasDe({ name: 'Rato (3 horas)' }), noche: M.horasDe({ name: 'Noche' }), cuatro: M.horasDe({ name: 'Suite 4 horas' }), cv: M.horasDe({ name: 'Cerveza' }), extra: M.horasDe({ name: 'Hora adicional' }), esExtra: M.esExtra({ name: 'Hora adicional' }) }; });
    chk('1. Rato (3 horas) = 3 h, Noche = 12 h, Suite 4 horas = 4 h; la cerveza y la hora adicional no son plan', v.rato === 3 && v.noche === 12 && v.cuatro === 4 && v.cv === 0 && v.extra === 0 && v.esExtra, v);

    // ===== 2 =====
    v = await p.evaluate(() => { mk(1, 150); const e = window.ventoMotel.estado(data.tables[1]), m = window.ventoMotel.mapa(data.tables[1]); return { faltan: e.faltan, hasta: e.hasta - e.entrada, m }; });
    chk('2. Lleva 2 h 30 min de un rato de 3 h: no falta nada y el mapa dice a qué hora sale', v.faltan === 0 && v.hasta === 3 * 36e5 && /Sale/.test(v.m.extra) && !v.m.alerta && /2 h 30 min/.test(v.m.txt), v);
    v = await p.evaluate(() => { mk(1, 185); return window.ventoMotel.estado(data.tables[1]).faltan; });
    chk('2. Se pasó 5 min (dentro de la tolerancia de 10): todavía no cobra hora adicional', v === 0, v);

    // ===== 3 =====
    v = await p.evaluate(() => { mk(1, 205); const e = window.ventoMotel.estado(data.tables[1]); return { faltan: e.faltan, alerta: window.ventoMotel.mapa(data.tables[1]).alerta }; });
    chk('3. Se pasó 25 min: falta 1 hora adicional y el mapa avisa «⏰ Se pasó 25 min»', v.faltan === 1 && /Se pasó 25 min/.test(v.alerta) && /1 hora adicional/.test(v.alerta), v);
    await p.evaluate(() => { try{ renderMesas(); }catch(e){} }); await pausa(300);
    v = await p.evaluate(() => { const c = document.querySelector('[data-id="1"] .mp-aviso'); return c ? c.textContent : null; });
    chk('3. … la tarjeta de la habitación en el mapa muestra el aviso', v && /Se pasó/.test(v), v);
    await p.evaluate(() => openTableModal(1)); await pausa(1300);
    v = await p.evaluate(() => { const b = document.getElementById('mtTiempo'); return b && !b.hidden ? b.innerText : null; });
    chk('3. En la cuenta: «🕒 Entró … · lleva 3 h 25 min · Rato (3 horas) hasta …» y «Se pasó 25 min» con «Sumar 1 hora»', v && /Entró/.test(v) && /3 h 25 min/.test(v) && /Rato \(3 horas\) hasta/.test(v) && /Se pasó/.test(v) && /Sumar 1 hora/.test(v), v);
    await p.click('#mtTiempo [data-mt="sumar"]'); await pausa(300);
    v = await p.evaluate(() => { const t = data.tables[1], x = t.items.find(i => i.productId === 'extra'); return { q: x && x.qty, faltan: window.ventoMotel.estado(t).faltan }; });
    chk('3. «Sumar» pone 1 «Hora adicional» en la cuenta y ya no falta nada', v.q === 1 && v.faltan === 0, v);
    await p.evaluate(() => { document.getElementById('overlay').classList.remove('show'); currentTable = null; });

    // ===== 4 =====
    await p.evaluate(() => { mk(1, 280, 1); window._c = window.ventoPOS.cobrarMesa(1, { pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' } }); }); await pausa(300);
    v = await p.evaluate(() => { const o = document.querySelector('.mt-ov'); return o ? o.innerText : null; });
    chk('4. Lleva 4 h 40 min con 1 hora adicional cobrada: al cobrar pregunta «Sumar 1 hora adicional ($15.000) y cobrar»', v && /Se pasó del tiempo/.test(v) && /Sumar 1 hora adicional/.test(v) && /15\.000/.test(v), v);
    await p.click('.mt-ov [data-r="si"]');
    v = await p.evaluate(async () => { const e = await window._c; return e && { extra: (e.items.find(i => i.name === 'Hora adicional') || {}).qty, total: e.total, min: e.minutos, entrada: !!e.entrada, salida: !!e.salida, libre: !(data.tables[1].items || []).length && !data.tables[1].entrada }; });
    chk('4. «Sumar y cobrar»: la venta lleva 2 horas adicionales ($85.000 en total)', v && v.extra === 2 && v.total === 45000 + 10000 + 30000, v);
    chk('4. … guarda la entrada, la salida y los minutos (280), y la habitación queda libre sin hora de entrada', v && v.min >= 279 && v.min <= 281 && v.entrada && v.salida && v.libre, v);
    await p.evaluate(() => { mk(2, 240); window._c = window.ventoPOS.cobrarMesa(2, { pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' } }); }); await pausa(300);
    await p.click('.mt-ov [data-r="no"]');
    v = await p.evaluate(async () => { const e = await window._c; return e && { extra: e.items.some(i => i.name === 'Hora adicional'), total: e.total }; });
    chk('4. «Cobrar sin sumar»: se cobra sin la hora adicional', v && !v.extra && v.total === 55000, v);
    await p.evaluate(() => { mk(3, 240); window._c = window.ventoPOS.cobrarMesa(3, { pago: { method: 'efectivo', metodo: 'efectivo', nota: 'Efectivo' } }); }); await pausa(300);
    await p.click('.mt-ov [data-r="x"]');
    v = await p.evaluate(async () => { const e = await window._c; return { e: e, items: (data.tables[3].items || []).length }; });
    chk('4. «Cancelar»: no se cobra y la habitación sigue igual', v.e === null && v.items === 2, v);
    v = await p.evaluate(() => { mk(4, 60); return window.ventoMotel.antesDeCobrar(4); });
    chk('4. Dentro del tiempo no pregunta nada (el cobro sigue al tiro)', v === true, v);

    // ===== 5 =====
    await p.click('nav button[data-view="ajustes"]'); await pausa(200);
    await p.click('.ajustes-cat[data-cat="negocio"]').catch(() => {}); await pausa(300);
    v = await p.evaluate(() => { const b = document.getElementById('motelBox'); if(!b) return null; const t = b.querySelector('#mtTol'); t.value = '30'; t.dispatchEvent(new Event('change')); const n = b.querySelector('#mtNoche'); n.value = '10'; n.dispatchEvent(new Event('change'));
      mk(5, 205); return { cfg: data.motelCfg, faltan: window.ventoMotel.estado(data.tables[5]).faltan, noche: window.ventoMotel.horasDe({ name: 'Noche' }) }; });
    chk('5. Ajustes: tolerancia 30 min (25 min pasado ya no cobra) y la noche de 10 horas', v && v.cfg.tol === 30 && v.faltan === 0 && v.noche === 10, v);
    v = await p.evaluate(() => { data.businessType = 'hotel'; const r = { e: window.ventoMotel.estado(data.tables[5]), q: window.ventoMotel.antesDeCobrar(5) }; data.businessType = 'motel'; return r; });
    chk('5. En un hotel no aplica (las noches las cuenta lib/vento-hotel.js)', v.e === null && v.q === true, v);
    // 1.85.0: los módulos que envuelven «cerrar cuenta» y «agregar a la cuenta» se envolvían uno al otro sin fin (4 capas
    // nuevas por segundo; a la media hora, «Maximum call stack size exceeded» al cerrar una cuenta).
    v = await p.evaluate(async () => { const a = window.closeTableToHistory, b = window.addFavoriteToTable; await new Promise(r => setTimeout(r, 3000));
      let prof = 0; const h = data.history, u = h.unshift; h.unshift = function(){ prof = new Error().stack.split('\n').length; return u.apply(this, arguments); };
      data.tables[9] = { items: [{ productId: null, name: 'X', price: 1000, qty: 1, history: [] }], payments: [], people: [] }; try{ closeTableToHistory(9); }catch(e){} h.unshift = u;
      const f = window.closeTableToHistory; return { igualC: a === f, igualA: b === window.addFavoriteToTable, marcas: ['_mp', '_caja', '_ht', '_hp', '_mt', '_ag'].filter(k => f[k]), prof }; });
    chk('5. «Cerrar cuenta» y «agregar a la cuenta» ya no se vuelven a envolver cada segundo (llevan las marcas de todos)', v.igualC && v.igualA && v.marcas.length === 6 && v.prof < 40, v);

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
