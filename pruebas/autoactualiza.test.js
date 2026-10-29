// 🔄 1.65.6: ORDEVA se pone SOLA la versión nueva (version.txt distinto al de la app que está corriendo):
//  1. En pantalla y sin hacer nada: aviso «Se actualiza sola en 15 s» y se recarga sola, guardando todo antes.
//  2. Si está ocupado (una ventana abierta o escribiendo): espera; al terminar, se recarga.
//  3. Si al recargar sigue la versión vieja (la página nueva todavía no llega): no se queda recargando en vueltas; deja
//     el botón «Actualizar ahora».
//  4. En segundo plano (otra app, pantalla apagada): se recarga de una vez, sin aviso.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    let version = null;   // lo que devuelve version.txt (null = el de verdad)
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if(u.hostname !== 'localhost') return r.abort();
      if(version && /\/version\.txt$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'text/plain', body: version });
      return r.continue();
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    let cargas = 0; p.on('load', () => cargas++);
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Bar Nuevo'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const actual = await p.evaluate(() => MESORA_VERSION);
    const revisar = () => p.evaluate(() => { mesoraUltimaRevision = 0; mesoraRevisarVersionNueva(); });
    const aviso = () => p.evaluate(() => { const b = document.getElementById('mesoraNuevaVersion'); return b ? b.textContent : null; });

    // Misma versión: nada.
    await revisar(); await p.waitForTimeout(600);
    chk('Con la misma versión no pasa nada', await aviso() === null);

    // ===== 2. Ocupado: espera =====
    version = '2099-01-01 · v9.9.9';
    await p.evaluate(() => { data.products = [{ id: 'x', name: 'Producto que no se pierde', price: 1000 }]; saveData(); document.getElementById('overlay').classList.add('show'); });
    const c0 = cargas;
    await revisar();
    await p.waitForTimeout(2500);
    chk('2. Con una ventana abierta: avisa y espera a que termine', /cuando termines/.test(await aviso() || '') && cargas === c0, await aviso());
    await p.waitForTimeout(16000);
    chk('2. … y no recarga mientras sigue ocupado (aunque pasen los 15 s)', cargas === c0);

    // ===== 1. Se libera: cuenta y recarga sola =====
    await p.evaluate(() => document.getElementById('overlay').classList.remove('show'));
    await p.waitForTimeout(2200);
    chk('1. Sin hacer nada: «Se actualiza sola en … s»', /Se actualiza sola en \d+ s/.test(await aviso() || ''), await aviso());
    for(let i = 0; i < 40 && cargas === c0; i++) await p.waitForTimeout(500);
    chk('1. … y se recarga sola', cargas === c0 + 1, { cargas, c0 });
    await p.waitForTimeout(1500);
    chk('1. Lo guardado sigue ahí', await p.evaluate(() => (data.products || []).some(x => x.name === 'Producto que no se pierde')));

    // ===== 3. Sigue la vieja: no da vueltas =====
    await revisar(); await p.waitForTimeout(19000);
    chk('3. Si sigue la versión vieja, no se queda recargando: deja «Actualizar ahora»', cargas === c0 + 1 && /Toca «Actualizar ahora»/.test(await aviso() || ''), { cargas, aviso: await aviso() });

    // ===== 4. En segundo plano: de una =====
    version = '2099-02-02 · v9.9.10';
    await p.evaluate(() => { document.getElementById('mesoraNuevaVersion').remove();
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); });
    const c1 = cargas;
    await revisar();
    for(let i = 0; i < 20 && cargas === c1; i++) await p.waitForTimeout(250);
    chk('4. En segundo plano se recarga de una vez (sin esperar)', cargas === c1 + 1, { cargas, c1 });
    version = null;
    chk('La versión de la app es la de version.txt', actual === require('fs').readFileSync(__dirname + '/../version.txt', 'utf8').trim(), actual);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
