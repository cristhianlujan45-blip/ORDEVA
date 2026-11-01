// 🛏️ ORDEVA 1.72.3 · Auditoría del hotel: llegada y noches de cada habitación, y las palabras del hotel. Sin internet.
//  1. El menú no repite «Tarifas» (Tarifas y consumos + Lista de precios); «Primeros pasos» sin «tarifas y consumos y precios».
//  2. Habitación que llegó hace 2 días con 1 noche en la cuenta: «Llegó el … · 2 noches» y el aviso «Lleva 2 noches y la
//     cuenta tiene 1». La tarjeta de la habitación dice el día y las noches.
//  3. «Poner 2 noches» deja 2 en la tarifa (y el total sube); el aviso desaparece.
//  4. «Cambiar llegada» a hoy → 1 noche.
//  5. Cobrar (1.72.5: «💰 Cobrar $…», la ventana de la Caja POS): la venta guarda la llegada y las noches; la
//     habitación queda libre y sin llegada para el siguiente huésped.
//  6. En un bar no aparece nada de esto.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!window.ventoHotel, null, { timeout: 10000 });
    await p.waitForTimeout(600);
    return { ctx, p };
  }
  try{
    const { p } = await abrir('hotel', 'Hotel Las Palmas');
    // ===== 1 =====
    let v = await p.evaluate(() => ({ nav: [...document.querySelectorAll('nav button[data-view]')].filter(x => x.offsetParent).map(x => x.textContent.trim()), pasos: (document.getElementById('view-mesas') || document.body).innerText }));
    chk('1. El menú no repite «Tarifas»: «Tarifas y consumos» y «Lista de precios»', v.nav.includes('Tarifas y consumos') && v.nav.includes('Lista de precios') && !v.nav.includes('Tarifas'), v.nav);
    chk('1. «Primeros pasos» sin «tarifas y consumos y precios»', !/consumos y precios/i.test(v.pasos) && /Revisa tus tarifas y consumos/i.test(v.pasos), v.pasos.slice(0, 400));
    // ===== 2 =====
    await p.evaluate(() => {
      const hace2 = Date.now() - 2 * 864e5; const pr = data.products;
      const hab = pr.find(x => /doble/i.test(x.name)), des = pr.find(x => /desayuno/i.test(x.name));
      data.tables[1] = { items: [
        { productId: hab.id, name: hab.name, price: hab.price, size: '', qty: 1, personId: null, history: [{ qty: 1, at: hace2, k: 'a' }] },
        { productId: des.id, name: des.name, price: des.price, size: '', qty: 2, personId: null, history: [{ qty: 2, at: hace2 + 36e5, k: 'b' }] }
      ], payments: [], people: [] };
      saveData(); renderMesas();
    });
    await p.waitForTimeout(300);
    v = await p.evaluate(() => { const c = [...document.querySelectorAll('#tableGrid .ticket.open')][0]; return c ? c.innerText : ''; });
    chk('2. La tarjeta dice el día de llegada y «2 noches» (no solo «Desde las …»)', /Desde el .*· 2 noches/.test(v) && /tarifas y consumos/.test(v), v);
    await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(700);
    v = await p.evaluate(() => { const h = document.getElementById('htNoches'); return { vis: !!h && !h.hidden && h.offsetParent !== null, t: h ? h.innerText : '' }; });
    chk('2. En la cuenta: «🛏️ Llegó el … · 2 noches»', v.vis && /Llegó el .* · 2 noches/.test(v.t), v);
    chk('2. Aviso: «Lleva 2 noches y la cuenta tiene 1» con el botón «Poner 2 noches»', /Lleva 2 noches y la cuenta tiene 1\./.test(v.t.replace(/\s+/g, " ")) && /Poner 2 noches/.test(v.t), v.t);
    // ===== 3 =====
    const antes = await p.evaluate(() => tableTotal(1));
    await p.click('#htNoches [data-ht="poner"]'); await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ q: data.tables[1].items.find(i => /doble/i.test(i.name)).qty, total: tableTotal(1), t: document.getElementById('htNoches').innerText, des: data.tables[1].items.find(i => /desayuno/i.test(i.name)).qty }));
    chk('3. «Poner 2 noches»: la habitación queda ×2, el total sube $180.000 y el desayuno no se toca', v.q === 2 && v.total === antes + 180000 && v.des === 2, { v, antes });
    chk('3. El aviso desaparece', !/Lleva/.test(v.t), v.t);
    // ===== 4 =====
    await p.click('#htNoches [data-ht="editar"]'); await p.waitForTimeout(200);
    await p.evaluate(() => { const i = document.querySelector('#htNoches .ht-in'); const d = new Date(Date.now() - 3600e3); i.value = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); });
    await p.click('#htNoches [data-ht="guardar"]'); await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ t: document.getElementById('htNoches').innerText, e: data.tables[1].entrada }));
    chk('4. «Cambiar llegada» a hoy → 1 noche (y queda guardada)', /· 1 noche\b/.test(v.t) && v.e > 0, v);
    chk('4. Con más noches en la cuenta que las que lleva: solo una nota, sin aviso', /más de las que lleva/.test(v.t) && !/Lleva/.test(v.t), v.t);
    // ===== 5 =====
    v = await p.evaluate(() => document.getElementById('chargeBtn').textContent);
    chk('5. El botón dice cuánto se cobra («💰 Cobrar $396.000»)', /Cobrar \$\s?396\.000/.test(v), v);
    await p.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }); await p.waitForTimeout(500);
    v = await p.evaluate(() => [...document.querySelectorAll('button[data-m]')].filter(b => b.offsetParent).map(b => b.textContent));
    await p.evaluate(() => { const b = [...document.querySelectorAll('button[data-m="efectivo"]')].find(x => x.offsetParent); b && b.click(); }); await p.waitForTimeout(700);
    v = await p.evaluate(() => { const h = data.history[0] || {}; return { total: h.total, noches: h.noches, entrada: h.entrada, libre: !(data.tables[1].items || []).length, sinEntrada: !('entrada' in data.tables[1]), toast: [...document.querySelectorAll('.pz-dmsg')].map(x => x.innerText).join(' ') || (document.getElementById('toast') || {}).innerText || '' }; });
    chk('5. Cobrado: la venta guarda la llegada y las noches; la habitación queda libre y sin llegada', v.total === 396000 && v.noches === 1 && !!v.entrada && v.libre && v.sinEntrada, v);
    chk('5. El aviso dice «Cobrado … · Habitación 1» (no «mesa»), con «Deshacer»', /Cobrado/.test(v.toast) && /Habitación 1/.test(v.toast) && !/mesa/i.test(v.toast), v.toast);
    // Confirmar con la cuenta ya pagada: el botón de la ventana también usa la palabra del negocio
    await p.evaluate(() => { const pr = data.products[0]; data.tables[2] = { items: [{ productId: pr.id, name: pr.name, price: pr.price, size: '', qty: 1, personId: null, history: [{ qty: 1, at: Date.now(), k: 'c' }] }], payments: [{ note: 'abono', amount: pr.price, method: 'efectivo', at: Date.now() }], people: [] }; saveData(); openTableModal(2); });
    await p.waitForTimeout(500); await p.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }); await p.waitForTimeout(400);
    v = await p.evaluate(() => document.getElementById('confirmOkBtn').textContent);
    chk('5. «¿Cerrar esta cuenta?» → «Sí, liberar habitación»', /liberar habitación/.test(v), v);
    await p.click('#confirmOkBtn'); await p.waitForTimeout(400);
    // ===== 6 =====
    const bar = await abrir('bar', 'Bar El Faro');
    v = await bar.p.evaluate(async () => {
      const pr = data.products[0]; data.tables[1] = { items: [{ productId: pr.id, name: 'Habitación de prueba', price: 1000, size: '', qty: 1, personId: null, history: [{ qty: 1, at: Date.now() - 2 * 864e5, k: 'd' }] }], payments: [], people: [] };
      saveData(); renderMesas(); openTableModal(1); await new Promise(r => setTimeout(r, 700));
      const h = document.getElementById('htNoches'); return { activo: window.ventoHotel.activo(), vis: !!h && !h.hidden, card: [...document.querySelectorAll('#tableGrid .ticket.open')].map(c => c.innerText).join(' ') };
    });
    chk('6. En un bar no aparecen las noches', !v.activo && !v.vis && !/noche/.test(v.card), v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
