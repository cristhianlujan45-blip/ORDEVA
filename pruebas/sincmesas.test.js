// 🔄 Cuentas (mesas) sincronizadas entre celulares, contra el «Supabase local» REAL.
// Lo que reportó el dueño: «le doy sumar y no suma en el otro celular; llega atrasado; se desincroniza».
//  1. Las dos cuentas abiertas en pantalla: el «+» de un celular llega al otro y el «+» del otro (con la cuenta que ya
//     estaba abierta, sin volver a entrar) SÍ suma sobre lo que llegó y llega de vuelta.
//  2. Los dos celulares tocando «+» a la vez en la misma cuenta: no se pierde ningún toque ni se cuenta dos veces.
//  3. Con un negocio grande (miles de ventas), los toques que caen mientras llegan datos del otro equipo no se pierden.
//  4. Cuánto tarda un «+» en verse en el otro celular.
//  5. Indicador ✓ / ⏳ / ⚠️ arriba; sin internet el toque queda y se envía solo al volver.
//  6. Un mesero que cambia un precio sin permiso: el servidor no lo deja y SU celular vuelve a mostrar el precio real.
//  7. Solo viaja lo que cambió (un «+» no sube ni baja el negocio entero).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){
  if(process.env.VENTO_PG_URL) return true;
  if(fs.existsSync('/usr/lib/postgresql')) return true;
  return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0;
}
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){
  const orig = console[k].bind(console);
  console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); };
}

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (este equipo no tiene PostgreSQL: se omitió esta prueba)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar();
  const b = await chromium.launch();
  try{ await pruebas(); }
  catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página en ningún equipo', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 150 }).then(() => true, () => false);
    const pausa = ms => new Promise(r => setTimeout(r, ms));
    async function equipo(nombre){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { nombre, ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    const qty = p => p.evaluate(() => ((data.tables[1] || {}).items || []).filter(i => i.productId === 'p-ag').reduce((s, i) => s + i.qty, 0));
    const enPantalla = p => p.evaluate(() => { const v = document.querySelector('#itemsContainer .li-qty-val'); return v ? v.textContent : ''; });
    const abrirMesa = p => p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openTableModal(1); });
    // El «+» de la cuenta abierta, como lo toca la persona.
    const mas = p => p.evaluate(() => { const b = document.querySelector('#itemsContainer .li-qty-plus'); if(!b) return false;
      const q = () => ((data.tables[1] || {}).items || []).filter(i => i.productId === 'p-ag').reduce((s, i) => s + i.qty, 0), a = q();
      b.click(); if(window.__nubeTraza) window.__nubeTraza.push({ ev: 'TOQUE', t: Date.now(), q: a + '→' + q() }); return true; });
    const trazar = p => p.evaluate(() => { window.__nubeTraza = []; window.__nubeTrazaQ = d => ((((d || {}).tables || {})[1] || {}).items || []).filter(i => i.productId === 'p-ag').reduce((s, i) => s + i.qty, 0); });
    const volcar = async (p, n) => { if(!process.env.VENTO_TRAZA) return; const t = await p.evaluate(() => window.__nubeTraza || []); fs.writeFileSync(process.env.VENTO_TRAZA + '.' + n + '.json', JSON.stringify(t, null, 0).replace(/},{/g, '},\n{')); };
    const igualesEn = async (n, ms) => { const t0 = Date.now(); while(Date.now() - t0 < (ms || 20000)){ const [a, c] = [await qty(CEL.p), await qty(PC.p)]; if(a === n && c === n) return true; await pausa(200); } return false; };

    const CEL = await equipo('celular 1');
    await CEL.p.fill('#authBiz', 'Bar Mesas Sync'); await CEL.p.fill('#authUser', 'dueno@mesas.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('Celular 1 crea la cuenta', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio(), null, 10000);
    await CEL.p.evaluate(() => {
      data.products.push({ id: 'p-ag', name: 'Águila Mesa', price: 3500 });
      data.tables[1] = { items: [{ productId: 'p-ag', name: 'Águila Mesa', price: 3500, qty: 3, personId: null, history: [] }], payments: [], people: [] };
      saveData();
    });
    await pausa(2500);
    const PC = await equipo('celular 2');
    await PC.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.p.fill('#authUser', 'dueno@mesas.co'); await PC.p.fill('#authPass', 'clave123'); await PC.p.click('#authBtn');
    chk('Celular 2 entra a la misma cuenta', await dentro(PC.p));
    await cerrarTodo(PC.p);
    chk('Celular 2 ve la Mesa 1 con 3 Águila', await esperar(PC.p, () => ((data.tables[1] || {}).items || []).some(i => i.productId === 'p-ag' && i.qty === 3), null, 15000));

    // ===== 1. Las dos cuentas abiertas =====
    await abrirMesa(CEL.p); await abrirMesa(PC.p); await pausa(400);
    let t0 = Date.now();
    await mas(CEL.p);
    const llego = await esperar(PC.p, () => ((data.tables[1] || {}).items || []).reduce((s, i) => s + (i.productId === 'p-ag' ? i.qty : 0), 0) === 4, null, 15000);
    const seg = (Date.now() - t0) / 1000;
    chk('1. «+» en el celular 1 → el celular 2 tiene 4 (' + seg.toFixed(1) + ' s)', llego, await qty(PC.p));
    chk('4. Llega en pocos segundos (menos de 5 s, incluso con el equipo de pruebas cargado)', llego && seg < 5, seg);
    chk('1. … y la cuenta ABIERTA en el celular 2 muestra ×4 (no la de antes)', await esperar(PC.p, () => { const v = document.querySelector('#itemsContainer .li-qty-val'); return !!v && /4/.test(v.textContent); }, null, 5000), await enPantalla(PC.p));
    await mas(PC.p);                                      // la cuenta sigue abierta desde antes
    chk('1. «+» en el celular 2 (cuenta que ya estaba abierta) → suma: 5 en el celular 2', (await qty(PC.p)) === 5, await qty(PC.p));
    chk('1. … y el celular 1 también llega a 5', await igualesEn(5), [await qty(CEL.p), await qty(PC.p)]);

    // ===== 2. Los dos tocando «+» a la vez =====
    for(let i = 0; i < 8; i++){ await Promise.all([mas(CEL.p), mas(PC.p)]); await pausa(120); }
    chk('2. 8 toques en cada celular al mismo tiempo → los dos quedan en 21 (5 + 16), sin perder ni duplicar', await igualesEn(21, 30000), [await qty(CEL.p), await qty(PC.p)]);
    chk('2. Un solo renglón de Águila en la mesa (no repetidos)', await PC.p.evaluate(() => data.tables[1].items.filter(i => i.productId === 'p-ag').length) === 1);

    // ===== 3. Negocio grande: toques mientras llegan datos del otro =====
    await CEL.p.evaluate(() => {
      const ahora = Date.now();
      for(let i = 0; i < 4000; i++) data.history.push({ id: 'h' + i, t: ahora - i * 60000, date: new Date(ahora - i * 60000).toISOString(), total: 3500, method: 'efectivo', items: [{ productId: 'p-ag', name: 'Águila Mesa', price: 3500, qty: 1 }] });
      saveData();
    });
    await esperar(PC.p, () => data.history.length >= 4000, null, 30000);
    await abrirMesa(CEL.p); await abrirMesa(PC.p); await pausa(800);
    await trazar(CEL.p); await trazar(PC.p);
    for(let i = 0; i < 10; i++){ await mas(CEL.p); await pausa(170); await mas(PC.p); await pausa(130); }
    const ok3 = await igualesEn(41, 40000);
    chk('3. Negocio con 4000 ventas: 10 toques en cada celular mientras llegan los datos del otro → 41 en los dos', ok3, [await qty(CEL.p), await qty(PC.p)]);
    if(!ok3){ await volcar(CEL.p, 'cel1'); await volcar(PC.p, 'cel2'); }
    // ===== 7. Solo viaja lo que cambió =====
    const NEGID = await CEL.p.evaluate(() => window.ventoNube.negocio().id);
    const tam = (await sb.sql("select octet_length(datos::text) d, (select count(*)::int from datos_cambios where negocio_id = $1) n, (select max(octet_length(cambios::text)) from datos_cambios where negocio_id = $1 and version > (select version - 10 from datos_negocio where negocio_id = $1)) c from datos_negocio where negocio_id = $1", [NEGID]))[0];
    chk('7. Con 4000 ventas, cada «+» viaja como un cambio pequeño (' + Math.round(tam.c / 1024) + ' KB) y no el negocio entero (' + Math.round(tam.d / 1024) + ' KB)', tam.n > 10 && tam.c < tam.d / 20, tam);
    const tr = await Promise.all([CEL.p, PC.p].map(p => p.evaluate(() => (window.__nubeTraza || []).map(x => x.ev))));
    chk('7. Los celulares suben por partes y bajan por partes', tr.some(t => t.includes('subir-partes')) && tr.some(t => t.includes('bajar-partes')), tr.map(t => [...new Set(t)]));

    chk('3. La cuenta abierta en cada celular muestra ×41', await esperar(CEL.p, () => /41/.test((document.querySelector('#itemsContainer .li-qty-val') || {}).textContent || ''), null, 8000) &&
      await esperar(PC.p, () => /41/.test((document.querySelector('#itemsContainer .li-qty-val') || {}).textContent || ''), null, 8000), [await enPantalla(CEL.p), await enPantalla(PC.p)]);
    // ===== 5. Indicador de sincronización =====
    let ind = await CEL.p.evaluate(() => { const b = document.getElementById('nubePunto'); return b ? { vis: !b.hidden, k: b.dataset.k, t: b.textContent } : null; });
    chk('5. Arriba se ve el indicador ✓ «al día»', ind && ind.vis && ind.k === 'ok' && ind.t === '✓', ind);
    await CEL.ctx.setOffline(true);
    await CEL.p.evaluate(() => { window.dispatchEvent(new Event('offline')); });
    await mas(CEL.p); await pausa(600);
    ind = await CEL.p.evaluate(() => { const b = document.getElementById('nubePunto'); return { k: b.dataset.k, t: b.textContent }; });
    chk('5. Sin internet: ⚠️ (el toque queda guardado en el celular)', ind.k === 'mal' && (await qty(CEL.p)) === 42, ind);
    await CEL.ctx.setOffline(false);
    await CEL.p.evaluate(() => { window.dispatchEvent(new Event('online')); });
    chk('5. Al volver el internet se envía solo: los dos en 42 y ✓ otra vez', await igualesEn(42, 30000) && await esperar(CEL.p, () => (document.getElementById('nubePunto') || {}).dataset.k === 'ok', null, 15000), [await qty(CEL.p), await qty(PC.p)]);

    // ===== 6. Mesero que cambia un precio sin permiso =====
    await CEL.p.evaluate(() => window.ventoNube.abrir({}));
    await CEL.p.waitForSelector('#nubeOv.show #nubeRolInv');
    await CEL.p.selectOption('#nubeRolInv', 'mesero'); await CEL.p.click('#nubeInvitar');
    await CEL.p.waitForSelector('#nubeInvRes .nube-cod');
    const cod = (await CEL.p.textContent('#nubeInvRes .nube-cod')).trim();
    await CEL.p.click('#nubeOv [data-n="cerrar"]');
    const ME = await equipo('mesero');
    await ME.p.click('#authNube'); await ME.p.waitForSelector('#nubeOv.show #nubeEmail');
    await ME.p.fill('#nubeEmail', 'mesero@mesas.co'); await ME.p.fill('#nubePass', 'clave123'); await ME.p.fill('#nubeNombre', 'Pedro');
    await ME.p.click('#nubeCrear'); await ME.p.waitForSelector('#nubeCodigo', { state: 'visible' });
    await ME.p.fill('#nubeCodigo', cod); await ME.p.click('#nubeUnirme');
    chk('6. El mesero entra a la cuenta', await esperar(ME.p, () => { const x = window.ventoNube.negocio(); return !!x && x.rol === 'mesero' && document.getElementById('authOverlay').hidden; }, null, 20000));
    await esperar(ME.p, () => (data.products || []).some(p => p.id === 'p-ag'), null, 15000);
    await ME.p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const p = data.products.find(x => x.id === 'p-ag'); p.price = 100; saveData(); });
    chk('6. El precio que el mesero cambió sin permiso vuelve solo a $3.500 en SU celular', await esperar(ME.p, () => (data.products.find(x => x.id === 'p-ag') || {}).price === 3500, null, 20000), await ME.p.evaluate(() => (data.products.find(x => x.id === 'p-ag') || {}).price));
    await pausa(1500);
    chk('6. … y en el celular del dueño sigue en $3.500', (await CEL.p.evaluate(() => data.products.find(x => x.id === 'p-ag').price)) === 3500);
    await ME.p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openTableModal(1); });
    await pausa(400); await mas(ME.p);
    chk('6. El «+» del mesero sí llega (43 en el celular del dueño)', await esperar(CEL.p, () => data.tables[1].items.filter(i => i.productId === 'p-ag').reduce((s, i) => s + i.qty, 0) === 43, null, 20000), await qty(CEL.p));

    const est = await Promise.all([CEL.p, PC.p].map(p => p.evaluate(() => window.ventoNube.estado ? window.ventoNube.estado() : null)));
    chk('3. Los dos quedan «al día» (nada por subir)', await esperar(CEL.p, () => !/por subir/.test(document.getElementById('nubeEstadoAj') ? document.getElementById('nubeEstadoAj').textContent : '') , null, 5000), est);
  }
})();
