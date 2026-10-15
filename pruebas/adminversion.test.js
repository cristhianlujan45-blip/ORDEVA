// Vento Admin se actualiza solo (admin.html): con una versión nueva en version.txt,
//  • recién abierto (o con el panel bloqueado) se recarga solo, sin caché (?v=…);
//  • si el servidor todavía entrega la página vieja, no se queda recargando: deja el aviso «Actualizar ahora»;
//  • trabajando (escribiendo en un campo) no se recarga: muestra el aviso.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + x : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    let version = null, cargas = 0;
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if(u.hostname !== 'localhost') return r.abort();
      if(u.pathname.endsWith('/version.txt') && version) return r.fulfill({ status: 200, body: version + '\n', contentType: 'text/plain' });
      if(u.pathname.endsWith('/admin.html')) cargas++;
      return r.continue();
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/admin.html'); await p.waitForTimeout(2500);
    const actual = await p.evaluate(() => window.ventoAdminVersion);
    const archivo = require('fs').readFileSync(require('path').join(__dirname, '..', 'version.txt'), 'utf8').trim();
    chk('La versión de admin.html es la misma de version.txt (si no, se recargaría siempre)', actual === archivo, actual + ' vs ' + archivo);
    chk('Con la misma versión no se recarga', cargas === 1 && !/[?&]v=/.test(p.url()), p.url());

    // Versión nueva publicada → recién abierto: se recarga sola sin caché
    version = '2099-01-01 · v9.9.9';
    await p.goto(BASE + '/admin.html'); await p.waitForTimeout(4000);
    chk('Versión nueva recién abierto: se recarga sola (admin.html?v=9.9.9)', /[?&]v=v?9\.9\.9/.test(p.url()), p.url());
    chk('…y como el servidor sigue con la vieja, NO se queda recargando: deja el aviso', await p.evaluate(() => !!document.getElementById('adminNuevaVersion') && /Actualizar ahora/.test(document.getElementById('adminNuevaVersion').innerText)));

    // Trabajando en el panel (escribiendo): aviso, sin recargar
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
    version = null; await p2.goto(BASE + '/admin.html'); await p2.waitForTimeout(2000);
    await p2.evaluate(() => { const l = document.getElementById('lock'); if(l) l.hidden = true; const i = document.createElement('input'); i.id = 'escribiendo'; document.body.appendChild(i); i.focus(); });
    await p2.evaluate(() => sessionStorage.clear());
    version = '2099-02-02 · v9.9.8';
    await p2.waitForTimeout(16000);   // pasa el arranque (15 s)
    await p2.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await p2.waitForTimeout(1500);
    chk('Escribiendo en el panel: no se recarga, muestra «Actualizar ahora»', !/[?&]v=/.test(p2.url()) && await p2.evaluate(() => !!document.getElementById('adminNuevaVersion')), p2.url());
    await p2.click('#adminNuevaVersion button'); await p2.waitForTimeout(1500);
    chk('«Actualizar ahora» recarga sin caché', /[?&]v=v?9\.9\.8/.test(p2.url()), p2.url());
    chk('Sin errores de página', !errs.length, errs.join(' | '));
  }catch(e){ mal++; console.log('❌ ' + e.stack); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal'); process.exit(mal ? 1 : 0);
})();
