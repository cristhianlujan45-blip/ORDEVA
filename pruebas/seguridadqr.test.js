// Seguridad: lo que llega por el canal del QR (cualquiera que vea el QR impreso puede escribir en él) NUNCA ejecuta
// código ni en la app del negocio ni en la pantalla de preparación. El «atacante» publica directo en el canal del
// negocio (servidor de ORDEVA REAL: canal_publicar) pedidos, canciones, domicilios y «pide la cuenta» con HTML/JS
// malicioso; luego se abren todas las pantallas donde se muestran.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }
const ATAQUES = [
  '<img src=x onerror="window.__xss=(window.__xss||0)+1">',
  '"><svg onload="window.__xss=(window.__xss||0)+1">',
  "'><iframe srcdoc=\"<script>parent.__xss=(parent.__xss||0)+1</script>\">",
  '<details open ontoggle="window.__xss=(window.__xss||0)+1">x'
];
(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    async function pagina(nombre, url, ancho){
      const ctx = await b.newContext({ viewport: { width: ancho || 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message)); p.on('dialog', d => d.dismiss());
      await p.goto(url);
      return { ctx, p };
    }
    const publicar = (canal, cuerpo) => fetch(sb.url + '/rest/v1/rpc/canal_publicar', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + sb.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_canal: canal, p_cuerpo: cuerpo }) }).then(r => r.status);

    const A = await pagina('negocio', BASE + '/index.html');
    await A.p.waitForSelector('#authOverlay:not([hidden])');
    await A.p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'restaurante'; s.dispatchEvent(new Event('change')); } });
    await A.p.fill('#authBiz', 'Restaurante Seguro'); await A.p.fill('#authUser', 'ana'); await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    await A.p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await A.p.evaluate(base => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products.push({ id: 'p-aguila', name: 'Águila', price: 3500, stock: 50 }); saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c);
      const s = document.getElementById('prepOn'); if(s && !s.checked){ s.checked = true; s.dispatchEvent(new Event('change')); }
      M.reconectarPedidos();
    }, BASE);
    const info = await A.p.evaluate(() => ({ topic: window.vitoMod.qCfg().topic, prep: window.vitoMod.prepUrl() }));
    const P = info.prep ? await pagina('preparación', info.prep, 1280) : null;
    await A.p.waitForTimeout(1500);

    let n = 0;
    for(const [i, X] of ATAQUES.entries()){
      const m = 1 + i;
      const envios = [
        JSON.stringify({ t: 'pedido', id: 'xss' + i, mesa: m, items: [{ n: X, q: 1 }, { n: 'Águila', q: 2 }], nota: X, at: Date.now() }),
        JSON.stringify({ t: 'cancion', id: 'xc' + i, mesa: m, s: X }),
        'CANCION MESA ' + m + ': ' + X,
        'CUENTA MESA ' + m + ': ya pagué ' + X,
        'PEDIDO MESA ' + m + ': 2 ' + X,
        'DOMICILIO: Nombre: ' + X + '\nTeléfono: 3001234567\nDirección: ' + X + '\nPedido: 1 Águila, 1 ' + X
      ];
      for(const e of envios){ if(await publicar(info.topic, e) === 200) n++; }
    }
    chk('El «atacante» publicó ' + n + ' mensajes maliciosos en el canal del negocio (sin cuenta)', n === ATAQUES.length * 6, n);
    chk('Los pedidos maliciosos llegaron a la app del negocio (la prueba es real)', await esperar(A.p, () => (data.pedidos || []).filter(x => /onerror|onload|srcdoc|ontoggle/.test(JSON.stringify(x))).length >= 4, null, 25000),
      await A.p.evaluate(() => (data.pedidos || []).length));
    await A.p.waitForTimeout(1500);
    for(const v of ['mesas', 'cocina', 'musica', 'historial', 'carta', 'productos', 'inventario', 'contabilidad', 'estadisticas', 'ajustes', 'cocina']){
      await A.p.evaluate(v => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b = document.querySelector('nav button[data-view="' + v + '"]'); if(b) b.click(); }, v); await A.p.waitForTimeout(350);
    }
    for(let i = 1; i <= ATAQUES.length; i++){
      await A.p.evaluate(i => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); try{ openTableModal(i); }catch(e){} }, i); await A.p.waitForTimeout(300);
      await A.p.evaluate(i => { try{ openBillSummary(i); }catch(e){} }, i); await A.p.waitForTimeout(300);
    }
    await A.p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b = document.querySelector('nav button[data-view="cocina"]'); if(b) b.click(); });
    await A.p.waitForTimeout(800);
    const textoCocina = await A.p.evaluate(() => document.body.innerText);
    chk('En la pantalla de pedidos el texto malicioso se ve como TEXTO (escapado)', /<img src=x onerror/.test(textoCocina) || /<svg onload/.test(textoCocina) || /onerror|ontoggle/.test(textoCocina), textoCocina.slice(0, 300));
    const r = await A.p.evaluate(() => ({ xss: window.__xss || 0, iframes: document.querySelectorAll('iframe[srcdoc]').length, svgs: document.querySelectorAll('svg[onload]').length, imgs: document.querySelectorAll('img[onerror]').length, det: document.querySelectorAll('details[ontoggle]').length }));
    chk('App del negocio: ningún código del QR se ejecutó ni quedó como HTML', !r.xss && !r.iframes && !r.svgs && !r.imgs && !r.det, r);
    if(P){
      await P.p.waitForTimeout(4000);
      const rp = await P.p.evaluate(() => ({ xss: window.__xss || 0, html: document.querySelectorAll('img[onerror],svg[onload],iframe[srcdoc],details[ontoggle]').length, txt: /onerror|ontoggle|onload/.test(document.body.innerText) }));
      chk('Pantalla de preparación: recibe los pedidos y no ejecuta nada', !rp.xss && !rp.html, rp);
    }
  }
})();
