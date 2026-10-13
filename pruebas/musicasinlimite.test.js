// Música sin límite: una mesa puede pedir todas las canciones que quiera (antes: 10 cada 15 minutos).
//  1. Página del cliente (pedido.html, QR de la mesa): 25 canciones seguidas → las 25 se envían, sin «Ya pediste…»
//     ni barra de cupos.
//  2. App: 25 canciones de la misma mesa → las 25 entran a la cola.
//  3. Lo que SÍ sigue: el mismo pedido repetido por doble toque no se duplica.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    // ===== 1. Página del cliente =====
    const ctx1 = await b.newContext({ viewport: { width: 390, height: 844 } });
    const enviados = [];
    await ctx1.route('**/*', async r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'ntfy.sh' && r.request().method() === 'POST'){ enviados.push(r.request().postData() || ''); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"x' + enviados.length + '","event":"message"}', headers: { 'access-control-allow-origin': '*' } }); }
      if(u.hostname === 'ntfy.sh') return r.fulfill({ status: 200, contentType: 'application/json', body: '', headers: { 'access-control-allow-origin': '*' } });
      return r.abort();
    });
    const c = await ctx1.newPage(); c.on('pageerror', e => errs.push('pedido: ' + e.message));
    await c.goto(BASE + '/pedido.html?mesa=3&c=mesorapruebasinlimite');
    await c.waitForTimeout(1200);
    await c.click('#tc');
    let rechazos = 0;
    for(let i = 1; i <= 25; i++){
      await c.fill('#s', 'Cancion numero ' + i);
      await c.click('#b');
      await c.waitForFunction(() => !document.getElementById('b').disabled, null, { timeout: 5000 }).catch(() => {});
      if(/Ya pediste|Podrás pedir/.test(await c.evaluate(() => document.body.innerText))) rechazos++;
    }
    const canciones = enviados.filter(x => /"t":"cancion"/.test(x)).length;
    chk('1. QR de la mesa: 25 canciones seguidas → las 25 se envían', canciones === 25, { canciones, enviados: enviados.length });
    chk('1. … sin «Ya pediste X canciones / Podrás pedir otra en…»', rechazos === 0, rechazos);
    chk('1. … y sin barra de cupos', !(await c.isVisible('#cupos')));

    // ===== 2. App =====
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx2.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx2.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx2.newPage(); p.on('pageerror', e => errs.push('app: ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar M'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      window.ytAgregar = () => {}; window.tvPublicar = () => {};
      const msgs = []; for(let i = 1; i <= 25; i++) msgs.push(window.vitoAddSong(3, 'Tema de prueba ' + i));
      const enCola = window.vitoMusica.cola().filter(x => x.mesa === 3 && !x.done).length;
      return { enCola, rechazos: msgs.filter(m => /ya pidió|podrá pedir/i.test(m)).length };
    });
    chk('2. App: 25 canciones de la mesa 3 → las 25 en la cola', r.enCola === 25 && r.rechazos === 0, r);

    // ===== 3. Lo que sigue igual =====
    const d = await p.evaluate(() => window.vitoAddSong(3, 'Tema de prueba 25'));
    chk('3. El mismo pedido repetido (doble toque) no se duplica', /ya está en la cola/.test(d), d);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
