// Barra y menú de la suscripción.
//  1. La barra «🎁 Prueba gratis…» se cierra con ✕ DE VERDAD (antes quedaba la franja: el «hidden» no ocultaba nada).
//  2. Sigue cerrada al volver a abrir la app; vuelve a salir si cambia lo que avisa.
//  3. El menú de la suscripción siempre está en ⋯ Más → «💳 Mi plan» (no solo desde la barra).
//  4. Con Vento Nube: si no hay nada que avisar, NO queda una franja vacía; «Mi plan» solo para dueño/administrador y
//     abre los planes de la nube.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Plan'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const barra = () => p.evaluate(() => { const x = document.getElementById('subBar'); if(!x) return null; const r = x.getBoundingClientRect(); return { h: Math.round(r.height), vis: getComputedStyle(x).display !== 'none', t: x.textContent }; });
    let r = await barra();
    chk('1. Sale la barra «🎁 Prueba gratis: te quedan 15 días»', r && r.vis && r.h > 30 && /Prueba gratis/.test(r.t), r);
    await p.click('#subBar [data-x]'); await p.waitForTimeout(200);
    r = await barra();
    chk('1. ✕ la oculta DE VERDAD (no queda ninguna franja)', r && !r.vis && r.h === 0, r);
    chk('1. … y dice dónde quedó el plan', /Más → 💳 Mi plan/.test(await p.evaluate(() => document.getElementById('toast').textContent)));
    chk('1. Ocultarla NO abrió los planes', !(await p.evaluate(() => !!document.querySelector('#subOverlay.show'))));
    await p.reload(); await p.waitForTimeout(2000);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    r = await barra();
    chk('2. Sigue oculta al volver a abrir la app', r && !r.vis, r);
    await p.evaluate(() => { localStorage.setItem('vento-subbar-x', JSON.stringify({ k: 'prueba', t: Date.now() - 4 * 864e5 })); subAplicar(); });
    r = await barra();
    chk('2. Pasados 3 días vuelve a salir', r && r.vis, r);
    await p.evaluate(() => { localStorage.setItem('vento-subbar-x', JSON.stringify({ k: 'activa', t: Date.now() })); subAplicar(); });
    chk('2. Si cambió lo que avisa (otro estado), vuelve a salir', (await barra()).vis);

    // 3. ⋯ Más → Mi plan
    await p.click('#navMoreBtn'); await p.waitForTimeout(250);
    const t = await p.evaluate(() => { const x = document.getElementById('morePlanTile'); const r = x.getBoundingClientRect(); return { vis: !x.hidden && r.height > 0, txt: x.textContent }; });
    chk('3. ⋯ Más tiene «💳 Mi plan» (con los días de prueba)', t.vis && /Mi plan/.test(t.txt) && /Prueba gratis: 15 días/.test(t.txt), t);
    await p.click('#morePlanTile'); await p.waitForTimeout(300);
    chk('3. Tocarlo abre el menú de la suscripción (planes y pagos)', await p.evaluate(() => !!document.querySelector('#subOverlay.show')));
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // 4. Vento Nube (suscripción verificada por el servidor, simulada)
    await p.evaluate(() => {
      window.__planes = 0;
      window.__vs = { manda: true, mostrar: false };
      window.ventoSuscripcion = { enCuenta: () => true, verificado: () => true, estado: () => ({ plan: 'pro', status: 'active', manda: window.__vs.manda, verificado: true, dias: 20 }),
        barra: () => window.__vs.mostrar ? { mostrar: true, k: 'revision', html: '<span>⏳ <b>Pago en revisión</b></span><b>Ver ›</b><i data-x title="Ocultar">✕</i>' } : { mostrar: false },
        estadoApp: () => ({ nube: true, status: 'active', plan: 'PRO', v: Date.now() + 20 * 864e5, dias: 20, k: 'activa' }),
        abrirPlanes: () => { window.__planes++; }, abrirRenovar(){}, pintarPanel(el){ el.innerHTML = 'plan pro'; }, tiene: () => true, entitlements: () => [] };
      subAplicar();
    });
    r = await barra();
    chk('4. Con la nube y nada que avisar: NO queda una franja vacía (antes se veía «una barra»)', r && !r.vis && r.h === 0, r);
    await p.evaluate(() => { window.__vs.mostrar = true; subAplicar(); });
    r = await barra();
    chk('4. Cuando hay algo que avisar (pago en revisión) sí sale', r && r.vis && /Pago en revisión/.test(r.t), r);
    await p.click('#subBar [data-x]'); await p.waitForTimeout(150);
    chk('4. … y su ✕ también la oculta de verdad', !(await barra()).vis);
    await p.evaluate(() => subAplicar());
    chk('4. «Mi plan» dice el plan de la nube y abre sus planes', /Plan PRO/.test(await p.textContent('#morePlanTile')) && await p.evaluate(() => { document.getElementById('morePlanTile').click(); return window.__planes === 1; }));
    await p.evaluate(() => { window.__vs.manda = false; subAplicar(); });
    chk('4. Un cajero o mesero no ve «Mi plan»', await p.evaluate(() => document.getElementById('morePlanTile').hidden && getComputedStyle(document.getElementById('morePlanTile')).display === 'none'));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
