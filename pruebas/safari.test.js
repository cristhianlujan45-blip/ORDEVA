// 🧭 ORDEVA con el motor de Safari (WebKit, el mismo de iPhone, iPad y Mac): abrir, entrar, vender y cobrar, y las
// páginas de meseros, pedidos por QR y preparación, en tamaño iPhone. Corre en GitHub (allí se instala WebKit); en un
// equipo sin WebKit se omite.
'use strict';
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  let ok = 0, mal = 0; const errs0 = [];
  // La prueba bloquea todo lo que no es de este equipo (el servidor de ORDEVA, Google…): WebKit avisa ese bloqueo como
  // «… due to access control checks». En un iPhone de verdad esas llamadas sí llegan: no son errores de la app.
  const errs = { push: m => { if(!/due to access control checks/.test(String(m)) || /localhost/.test(String(m))) errs0.push(m); }, get length(){ return errs0.length; }, join: s => errs0.join(s) };
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  let b = null;
  try{ b = await pw.webkit.launch(); }catch(e){ console.log('ℹ️ Sin WebKit en este equipo: se omite (en GitHub sí corre).'); console.log('RESULTADO 0 bien 0 mal'); process.exit(0); }
  try{
    const ctx = await b.newContext(Object.assign({}, pw.devices['iPhone 13']));
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('app: ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(2000);
    chk('Abre en Safari (WebKit) y muestra la entrada', await p.isVisible('#authBiz'));
    await p.fill('#authBiz', 'Bar Safari'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    const entro = await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 }).then(() => true, () => false);
    chk('Entra', entro);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const r = await p.evaluate(async () => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'pk', name: 'Poker', price: 3800, stock: 50 }]; data.tables = data.tables || {}; data.tables[1] = { items: [], payments: [], people: [] }; saveData();
      openTableModal(1); await new Promise(z => setTimeout(z, 300));
      document.getElementById('addProductSearch').value = 'Poker'; document.getElementById('addProductId').value = 'pk'; document.getElementById('addQty').value = '3';
      document.getElementById('addItemBtn').click(); await new Promise(z => setTimeout(z, 400));
      return { qty: (data.tables[1].items[0] || {}).qty, ancho: document.documentElement.scrollWidth, vw: innerWidth };
    });
    chk('Abre la mesa y agrega 3 Poker', r.qty === 3, r);
    chk('Nada se sale de la pantalla del iPhone', r.ancho <= r.vw + 2, r);
    await p.fill('#paymentAmount', '11400').catch(() => {});
    await p.click('#addPaymentBtn').catch(() => {});
    await p.waitForTimeout(500);
    chk('Cobra la mesa ($11.400)', await p.evaluate(() => (data.tables[1].payments || []).reduce((a, q) => a + (Number(q.amount) || 0), 0) === 11400 || !data.tables[1].items.length));
    chk('Guarda (sigue al volver a abrir)', await p.reload().then(() => p.waitForTimeout(2500)).then(() => p.evaluate(() => typeof data !== 'undefined' && !!data.products && data.products.some(x => x.name === 'Poker'))).catch(() => false));
    for(const pg of ['mesero.html', 'pedido.html', 'preparacion.html', 'admin.html']){
      const q = await ctx.newPage(); q.on('pageerror', e => errs.push(pg + ': ' + e.message));
      await q.goto(BASE + '/' + pg); await q.waitForTimeout(1500);
      chk(pg + ' abre en Safari', await q.evaluate(() => document.body && document.body.innerText.length > 20));
      await q.close();
    }
    chk('Sin errores de página en Safari', !errs0.length, errs0);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
