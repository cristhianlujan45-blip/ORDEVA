// 💾 Que no se pierdan ventas por memoria llena (1.51.0). Los datos del negocio, los puntos de restauración y las fotos
// de los comprobantes pasan al almacén grande del celular (IndexedDB); localStorage (~5 MB) queda con una copia de los
// datos mientras quepa. Revisa:
//  1. Un celular que viene de la versión anterior (todo en localStorage): abre con sus datos, y los puntos de
//     restauración y los comprobantes se pasan solos al almacén grande (sin perder ninguno) y liberan localStorage.
//  2. Memoria llena: localStorage ya no acepta los datos → igual se guarda (sin «la memoria está llena») y al volver a
//     abrir ORDEVA está la última venta.
//  3. Datos grandes (más de 1,5 millones de letras): van solo al almacén grande y abren bien.
//  4. Puntos de restauración: se ven y uno se restaura.
//  5. Respaldo manual (Transferir): lleva los datos más nuevos y los comprobantes; al recibirlo en otro celular, manda
//     lo recibido aunque ese celular tuviera otra cosa en el almacén grande.
//  6. Una versión vieja de ORDEVA que escribió en localStorage (sin el almacén): ese cambio no se pierde.
//  7. «Restablecer todo» no deja los datos viejos escondidos en el almacén grande.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const entrar = async p => { await p.evaluate(async () => { await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
    document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; }); await p.waitForTimeout(300); };
  const idb = (p, k) => p.evaluate(k => window.ventoAlmacen.get(k), k);
  const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    // ---------- 1. Viene de la versión anterior: todo en localStorage ----------
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(IMG => {
      const d = { businessName: 'Tienda Vieja', products: [{ id: 'p1', name: 'Arroz', price: 3000, categoryId: null }], tables: { 1: { items: [], people: [] } }, categories: [],
        history: [{ id: 'h1', table: null, tableName: 'Mostrador', total: 3000, items: [{ name: 'Arroz', qty: 1, price: 3000 }], payments: [{ amount: 3000, method: 'efectivo' }], date: new Date().toISOString() }], closures: [] };
      localStorage.setItem('bar-data', JSON.stringify(d));
      localStorage.setItem('bar-autobk-points', JSON.stringify([{ day: '2026-10-20', at: Date.parse('2026-10-20T12:00:00Z'), data: JSON.stringify(d) }, { day: '2026-10-19', at: Date.parse('2026-10-19T12:00:00Z'), data: JSON.stringify(d) }]));
      localStorage.setItem('cm-rcpt-viejo1', IMG); localStorage.setItem('cm-rcpt-viejo2', IMG);
    }, IMG);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200); await entrar(p);
    chk('1. Abre con los datos que tenía (versión anterior, en localStorage): «Tienda Vieja» con su venta', await p.evaluate(() => data.businessName === 'Tienda Vieja' && data.history.length === 1));
    await p.waitForTimeout(4500);   // la mudanza corre a los 4 s de abrir
    const r1 = await p.evaluate(async () => ({ ls: localStorage.getItem('bar-autobk-points'), rc: Object.keys(localStorage).filter(k => /^cm-rcpt-/.test(k)).length,
      pts: (await window.ventoAlmacen.get('bar-autobk-points') || []).map(x => x.day), r1: !!(await window.ventoAlmacen.get('rcpt/viejo1')), r2: !!(await window.ventoAlmacen.get('rcpt/viejo2')) }));
    chk('1. Los 2 puntos de restauración pasaron al almacén grande y salieron de localStorage', !r1.ls && r1.pts.includes('2026-10-20') && r1.pts.includes('2026-10-19'), r1);
    chk('1. Las 2 fotos de comprobantes pasaron al almacén grande y salieron de localStorage', r1.rc === 0 && r1.r1 && r1.r2, r1);
    // ---------- 2. Memoria llena ----------
    await p.evaluate(() => {
      window.__orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v){ if(k === 'bar-data'){ const e = new Error('Setting the value exceeded the quota.'); e.name = 'QuotaExceededError'; throw e; } return window.__orig.call(this, k, v); };
      window.__toasts = []; const st = window.showToast; window.showToast = (t, ms) => { window.__toasts.push(t); return st && st(t, ms); };
    });
    await p.evaluate(async () => { data.history.unshift({ id: 'h2', table: null, tableName: 'Mostrador', total: 9000, items: [{ name: 'Arroz', qty: 3, price: 3000 }], payments: [{ amount: 9000, method: 'efectivo' }], date: new Date().toISOString() }); await saveData(); });
    const r2 = await p.evaluate(async () => ({ toasts: window.__toasts.join(' | '), enIdb: JSON.parse((await window.ventoAlmacen.get('bar-data')).v).history.length, enLs: JSON.parse(localStorage.getItem('bar-data')).history.length }));
    chk('2. Memoria llena en localStorage: se guarda igual, sin «la memoria está llena»', !/llena|No se pudo guardar|Error al guardar/i.test(r2.toasts) && r2.enIdb === 2, r2);
    chk('2. … (localStorage se queda con la copia anterior, la que sí cupo)', r2.enLs === 1, r2);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200); await entrar(p);
    chk('2. Al volver a abrir ORDEVA está la última venta ($9.000): no se perdió nada', await p.evaluate(() => data.history.length === 2 && data.history[0].total === 9000));
    // ---------- 3. Datos grandes ----------
    await p.evaluate(async () => { data.notaGrande = 'x'.repeat(1600000); await saveData(); });
    const r3 = await p.evaluate(() => ({ ls: (localStorage.getItem('bar-data') || '').length }));
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200); await entrar(p);
    chk('3. Datos de más de 1,5 millones de letras: van al almacén grande (no a localStorage) y abren completos', r3.ls < 1500000 && await p.evaluate(() => (data.notaGrande || '').length === 1600000 && data.history.length === 2), r3);
    await p.evaluate(async () => { delete data.notaGrande; await saveData(); });
    // ---------- 4. Puntos de restauración ----------
    await p.evaluate(() => openAutoBackupDialog()); await p.waitForTimeout(300);
    const r4 = await p.evaluate(() => [...document.querySelectorAll('button[data-i]')].map(b => b.textContent));
    chk('4. «Puntos de restauración» muestra los del almacén grande (hoy + los 2 que se pasaron)', r4.length >= 3, r4);
    await p.evaluate(() => { window.showConfirm = () => Promise.resolve(true); const bs = [...document.querySelectorAll('button[data-i]')]; bs[bs.length - 1].click(); });
    await p.waitForTimeout(500);
    chk('4. Restaurar el punto más viejo vuelve a los datos de ese día (1 venta)', await p.evaluate(() => data.businessName === 'Tienda Vieja' && data.history.length === 1));
    await p.evaluate(async () => { data.history.unshift({ id: 'h3', table: null, tableName: 'Mostrador', total: 12000, items: [{ name: 'Arroz', qty: 4, price: 3000 }], payments: [{ amount: 12000, method: 'efectivo' }], date: new Date().toISOString() }); data.businessName = 'Tienda Nueva'; await saveData(); });
    // ---------- 5. Respaldo manual ----------
    const [desc] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.getElementById('btSave').click())]);
    const fs = require('fs'), ruta = await desc.path(), bk = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const dBk = JSON.parse(bk.localStorage['bar-data']);
    chk('5. El respaldo lleva los datos MÁS NUEVOS (del almacén grande, no la copia vieja de localStorage)', dBk.businessName === 'Tienda Nueva' && dBk.history.length === 2, { n: dBk.businessName, h: dBk.history.length });
    chk('5. … y las fotos de los comprobantes, sin las marcas internas «@t»', !!bk.localStorage['cm-rcpt-viejo1'] && !Object.keys(bk.localStorage).some(k => /@t$/.test(k)), Object.keys(bk.localStorage).filter(k => /rcpt|@t/.test(k)));
    await p.evaluate(() => { Storage.prototype.setItem = window.__orig; });
    // Otro celular que tenía OTRA cosa en su almacén grande recibe el respaldo
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
    await p.close();
    await p2.goto(BASE, { waitUntil: 'load' }); await p2.waitForTimeout(1000); await entrar(p2);
    await p2.evaluate(async () => { data.businessName = 'Otro Negocio'; data.history = []; await saveData(); });
    await Promise.all([p2.waitForNavigation({ waitUntil: 'load' }), p2.evaluate(bk => {
      window.confirm = () => true; window.alert = () => {};
      window.importBackup(new File([JSON.stringify(bk)], 'respaldo.json', { type: 'application/json' }));   // recibe y recarga ORDEVA
    }, bk)]);
    await p2.waitForTimeout(1200); await entrar(p2);
    chk('5. Al recibir el respaldo manda lo recibido («Tienda Nueva», 2 ventas), aunque el almacén grande tuviera otra cosa', await p2.evaluate(() => data.businessName === 'Tienda Nueva' && data.history.length === 2), await p2.evaluate(() => [data.businessName, data.history.length]));
    // ---------- 6. Una versión vieja de ORDEVA escribió en localStorage ----------
    await p2.evaluate(() => { const d = JSON.parse(localStorage.getItem('bar-data')); d.businessName = 'Cambio de la versión vieja'; localStorage.setItem('bar-data', JSON.stringify(d)); });
    await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(1200); await entrar(p2);
    chk('6. Lo que escribió una versión vieja (solo en localStorage) no se pierde', await p2.evaluate(() => data.businessName === 'Cambio de la versión vieja'));
    // ---------- 7. Restablecer todo ----------
    await p2.evaluate(async () => { window.showConfirm = () => Promise.resolve(true); window.authIsAdmin = () => true; await resetAll(); });
    await p2.waitForTimeout(400);
    await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(1200); await entrar(p2);
    const r7 = await p2.evaluate(async () => ({ h: data.history.length, n: data.businessName, rc: (await window.ventoAlmacen.claves()).filter(k => /^rcpt\//.test(k)).length }));
    chk('7. «Restablecer todo» deja la app vacía y sin comprobantes escondidos en el almacén grande', r7.h === 0 && r7.n !== 'Cambio de la versión vieja' && r7.rc === 0, r7);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
