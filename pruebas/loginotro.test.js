// 🔐 ORDEVA 1.70.1 · Entrar en otro dispositivo NO reinicia ni borra las cuentas abiertas. Contra el «Supabase local»
// REAL (PostgreSQL + canal en vivo). Lo que reportó el dueño: «cuando inicio sesión en otro dispositivo se me reiniciaron
// todas las cuentas». Causa: al volver a entrar, la copia vieja del equipo se juntaba con la nube SIN copia de
// referencia (las cantidades se sumaban: 3 + 4 = 7; las cuentas ya cobradas revivían) y esa mezcla se subía a todos.
//  1. Celular nuevo entra → ve las cuentas; nadie pierde nada.
//  2. Un equipo que ya tenía la cuenta sale, el otro cambia algo, vuelve a entrar → ve lo de ahora, sin sumar de más.
//  3. Equipo con otro negocio guardado entra con el correo → ve el negocio de la cuenta, sin mezclar.
//  4. Recargar la app no cambia nada.
//  5. Copia vieja (una cuenta ya cobrada y otra nueva) → la cobrada no revive y la nueva aparece.
//  6. Lo hecho SIN internet antes de cerrar sesión (una venta, un producto más) llega a la nube al volver a entrar.
//  7. Igual, sin copia de referencia en el equipo: manda la nube, la venta no se pierde y queda un punto de restauración.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const o = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }
(async () => {
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 }).then(() => true, () => false);
  async function equipo(nombre, ctx0){
    const ctx = ctx0 || await b.newContext({ viewport: { width: 390, height: 844 } });
    if(!ctx0){ await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb, { enVivo: true });
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} }); }
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    return { ctx, p };
  }
  const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000);
  const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
  const mesas = p => p.evaluate(() => { const t = (typeof data !== 'undefined' && data && data.tables) || {}; return Object.keys(t).filter(k => (t[k].items || []).length).map(k => k + ':' + t[k].items.map(i => i.name + '×' + i.qty).join('+')).sort().join(' | '); });
  const nube = async () => { const r = (await sb.sql('select datos from datos_negocio limit 1'))[0]; const t = (r && r.datos.tables) || {}; return Object.keys(t).filter(k => (t[k].items || []).length).map(k => k + ':' + t[k].items.map(i => i.name + '×' + i.qty).join('+')).sort().join(' | '); };
  const entrar = async (p, email) => { await p.click('#authTabs [data-tab="entrar"]').catch(() => {}); await p.fill('#authUser', email); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); };
  const ESPERADO = '1:Águila×3 | 2:Póker×2+Empanada×1 | 5:Hamburguesa×1';
  try{
    // A crea la cuenta y abre 3 cuentas
    const A = await equipo('A');
    await A.p.fill('#authBiz', 'Bar Prueba'); await A.p.fill('#authUser', 'dueno@reinicio.co'); await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    await dentro(A.p); await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(A.p);
    await esperar(A.p, () => !!window.ventoNube.negocio(), null, 10000);
    await A.p.evaluate(() => {
      data.products.push({ id: 'p-a', name: 'Águila', price: 3500 }, { id: 'p-k', name: 'Póker', price: 3300 }, { id: 'p-e', name: 'Empanada', price: 2000 }, { id: 'p-h', name: 'Hamburguesa', price: 15000 });
      const it = (id, n, q) => ({ productId: id, name: n, price: 1000, qty: q, personId: null, history: [] });
      data.tables[1] = { items: [it('p-a', 'Águila', 3)], payments: [], people: [] };
      data.tables[2] = { items: [it('p-k', 'Póker', 2), it('p-e', 'Empanada', 1)], payments: [], people: [] };
      data.tables[5] = { items: [it('p-h', 'Hamburguesa', 1)], payments: [], people: [] };
      saveData();
    });
    await pausa(2500);
    chk('A: 3 cuentas abiertas en la nube', (await nube()) === ESPERADO, await nube());

    // ===== Caso 1: celular NUEVO entra con el mismo correo =====
    const B = await equipo('B');
    await entrar(B.p, 'dueno@reinicio.co'); await dentro(B.p); await cerrarTodo(B.p); await pausa(4000);
    chk('1. B (nuevo) ve las 3 cuentas', (await mesas(B.p)) === ESPERADO, await mesas(B.p));
    chk('1. A sigue con las 3 cuentas', (await mesas(A.p)) === ESPERADO, await mesas(A.p));
    chk('1. La nube sigue con las 3 cuentas', (await nube()) === ESPERADO, await nube());

    // ===== Caso 2: B cierra sesión, A cambia algo, B vuelve a entrar =====
    await B.p.evaluate(() => window.ventoSalir()); await pausa(2500);
    await A.p.evaluate(() => { data.tables[1].items[0].qty = 4; saveData(); }); await pausa(2500);
    const ESP2 = ESPERADO.replace('Águila×3', 'Águila×4');
    await B.p.waitForSelector('#authUser', { timeout: 15000 }).catch(() => {});
    await entrar(B.p, 'dueno@reinicio.co'); await dentro(B.p); await cerrarTodo(B.p); await pausa(5000);
    chk('2. B (que ya había entrado) vuelve a entrar y ve las cuentas al día', (await mesas(B.p)) === ESP2, await mesas(B.p));
    chk('2. A sigue con sus cuentas', (await mesas(A.p)) === ESP2, await mesas(A.p));
    chk('2. La nube sigue con sus cuentas', (await nube()) === ESP2, await nube());

    // ===== Caso 3: equipo C que ya tenía SU negocio local (sin nube, con ventas) entra con el correo =====
    const C = await equipo('C');
    await C.p.fill('#authBiz', 'Local C'); await C.p.fill('#authUser', 'cajeroc'); await C.p.fill('#authPass', 'clave123'); await C.p.click('#authBtn');
    await dentro(C.p); await C.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(C.p);
    await C.p.evaluate(() => { data.history.push({ id: 'hc', date: new Date().toISOString(), total: 1000, items: [], payments: [] }); saveData(); });
    await C.p.evaluate(() => window.ventoSalir()); await pausa(2000);
    await C.p.waitForSelector('#authUser', { timeout: 15000 }).catch(() => {});
    await entrar(C.p, 'dueno@reinicio.co'); await dentro(C.p); await cerrarTodo(C.p); await pausa(5000);
    chk('3. C (con otro negocio guardado) entra y ve las cuentas del negocio', (await mesas(C.p)) === ESP2, await mesas(C.p));
    chk('3. A sigue con sus cuentas', (await mesas(A.p)) === ESP2, await mesas(A.p));
    chk('3. La nube sigue con sus cuentas', (await nube()) === ESP2, await nube());

    // ===== Caso 4: B recarga la página (vuelve a abrir la app) =====
    await B.p.reload(); await pausa(5000);
    chk('4. B recargado sigue con las cuentas', (await mesas(B.p)) === ESP2, await mesas(B.p));
    chk('4. La nube sigue con sus cuentas', (await nube()) === ESP2, await nube());

    // ===== Caso 5: un 4.º equipo que la cuenta tenía guardada de antes (yaEstaba) con datos VIEJOS =====
    // B sale, A cierra la cuenta 5 y abre la 7; B (con su copia vieja: 1, 2, 5) vuelve a entrar.
    await B.p.evaluate(() => window.ventoSalir()); await pausa(2500);
    await A.p.evaluate(() => { delete data.tables[5]; data.tables[7] = { items: [{ productId: 'p-a', name: 'Águila', price: 1000, qty: 2, personId: null, history: [] }], payments: [], people: [] }; saveData(); }); await pausa(3000);
    const ESP5 = '1:Águila×4 | 2:Póker×2+Empanada×1 | 7:Águila×2';
    await B.p.waitForSelector('#authUser', { timeout: 15000 }).catch(() => {});
    await entrar(B.p, 'dueno@reinicio.co'); await dentro(B.p); await cerrarTodo(B.p); await pausa(5000);
    chk('5. B con copia vieja vuelve a entrar → ve lo de ahora (sin la 5 que se cerró, con la 7)', (await mesas(B.p)) === ESP5, await mesas(B.p));
    chk('5. A sigue igual', (await mesas(A.p)) === ESP5, await mesas(A.p));
    chk('5. La nube sigue igual', (await nube()) === ESP5, await nube());

    // ===== Caso 6: B vende SIN internet y cierra sesión sin poder subirlo; vuelve a entrar con internet =====
    const historia = p => p.evaluate(() => (data.history || []).map(h => h.id));
    const nubeHist = async () => { const r = (await sb.sql('select datos from datos_negocio limit 1'))[0]; return ((r && r.datos.history) || []).map(h => h.id); };
    const cortar = rt => rt.abort('internetdisconnected');
    await B.p.context().route('**/rest/v1/**', cortar);
    await B.p.evaluate(() => {
      data.history.unshift({ id: 'venta-sin-red', date: new Date().toISOString(), total: 3300, items: [{ productId: 'p-k', name: 'Póker', price: 3300, qty: 1 }], payments: [{ method: 'efectivo', amount: 3300 }] });
      data.tables[2].items[0].qty = 3; saveData();
    });
    await pausa(1500);
    await B.p.evaluate(() => window.ventoSalir()); await pausa(6000);
    await B.p.context().unroute('**/rest/v1/**', cortar);
    const ESP6 = '1:Águila×4 | 2:Póker×3+Empanada×1 | 7:Águila×2';
    await B.p.waitForSelector('#authUser', { timeout: 15000 }).catch(() => {});
    await entrar(B.p, 'dueno@reinicio.co'); await dentro(B.p); await cerrarTodo(B.p); await pausa(6000);
    chk('6. Lo que B hizo sin internet (Póker 2 → 3) llega a la nube y a A, sin sumar de más', (await nube()) === ESP6 && (await mesas(A.p)) === ESP6 && (await mesas(B.p)) === ESP6, { nube: await nube(), A: await mesas(A.p), B: await mesas(B.p) });
    chk('6. La venta hecha sin internet NO se pierde: queda en la nube y en A', (await nubeHist()).includes('venta-sin-red') && (await historia(A.p)).includes('venta-sin-red'), await nubeHist());

    // ===== Caso 7: igual, pero el equipo perdió su copia de referencia (por ejemplo, se borró el almacenamiento) =====
    await B.p.context().route('**/rest/v1/**', cortar);
    await B.p.evaluate(() => {
      data.history.unshift({ id: 'venta-sin-red-2', date: new Date().toISOString(), total: 2000, items: [{ productId: 'p-e', name: 'Empanada', price: 2000, qty: 1 }], payments: [{ method: 'efectivo', amount: 2000 }] });
      saveData();
    });
    await pausa(1500);
    await B.p.evaluate(() => window.ventoSalir()); await pausa(6000);
    await B.p.context().unroute('**/rest/v1/**', cortar);
    await B.p.evaluate(() => new Promise(ok => { const r = indexedDB.open('vento-nube', 1); r.onsuccess = () => { const db = r.result, tx = db.transaction('kv', 'readwrite'), s = tx.objectStore('kv'), c = s.openCursor();
      c.onsuccess = () => { const x = c.result; if(x){ if(String(x.key).startsWith('base_')) x.delete(); x.continue(); } }; tx.oncomplete = () => ok(); }; r.onerror = () => ok(); }));
    await B.p.waitForSelector('#authUser', { timeout: 15000 }).catch(() => {});
    await entrar(B.p, 'dueno@reinicio.co'); await dentro(B.p); await cerrarTodo(B.p); await pausa(6000);
    chk('7. Sin copia de referencia: manda la nube (las cuentas no se suman ni reviven)', (await nube()) === ESP6 && (await mesas(A.p)) === ESP6 && (await mesas(B.p)) === ESP6, { nube: await nube(), A: await mesas(A.p), B: await mesas(B.p) });
    chk('7. … y la venta hecha sin internet tampoco se pierde', (await nubeHist()).includes('venta-sin-red-2') && (await historia(A.p)).includes('venta-sin-red-2'), await nubeHist());
    chk('7. B guardó un punto de restauración local antes de poner los datos de la nube', await B.p.evaluate(() => new Promise(ok => { try{ autoBackupPoints().then(l => ok((l || []).some(x => /antes de la nube/.test(x.day || '')))).catch(() => ok(false)); }catch(e){ ok(false); } })) === true);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal'); process.exit(mal ? 1 : 0);
})();
