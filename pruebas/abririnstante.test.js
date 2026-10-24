// ⚡ Abrir al instante (sw.js + lib/vento-sw.js, ORDEVA 1.61.0), con el navegador de verdad:
//  1. La primera vez la app se guarda en el equipo (la página y sus archivos con versión).
//  2. La siguiente vez los archivos salen del equipo, no de internet.
//  3. Con internet, la página SIEMPRE es la de internet (nadie queda con una versión vieja), y la copia se pone al día.
//  4. Sin internet abre la última copia (en vez de la página de error del navegador) y la app funciona.
//  5. Una versión nueva de un archivo reemplaza a la vieja (no se llena el equipo). version.txt nunca se guarda.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const b = await chromium.launch();
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const URLAPP = BASE + '/index.html?sw=1';
    await p.goto(URLAPP);
    await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    const llaves = () => p.evaluate(async () => (await (await caches.open('ordeva-app-1')).keys()).map(r => r.url));
    let ks = [];
    for(let i = 0; i < 60; i++){ ks = await llaves().catch(() => []); if(ks.some(u => /app\/04a-inicio-cuentas-clientes\.js\?v=/.test(u)) && ks.some(u => /\/index\.html$/.test(u)) && ks.length > 40) break; await p.waitForTimeout(500); }
    chk('1. La primera vez se guarda la página y sus archivos (' + ks.length + ')', ks.some(u => /\/index\.html$/.test(u)) && ks.some(u => /app\/04a-inicio-cuentas-clientes\.js\?v=/.test(u)) && ks.some(u => /nube\/vento-nube\.js\?v=/.test(u)), ks.slice(0, 8));
    chk('1. version.txt y el servidor (Supabase/Google) no se guardan', !ks.some(u => /version\.txt|supabase|google/.test(u)));

    const desdeEquipo = new Map(); p.on('response', r => { const u = new URL(r.url()); if(/^\/(app|lib|nube)\//.test(u.pathname)) desdeEquipo.set(u.pathname, r.fromServiceWorker()); });
    await p.reload(); await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    chk('2. Los archivos de la app los entrega el equipo (sw.js)', desdeEquipo.get('/app/04a-inicio-cuentas-clientes.js') === true && desdeEquipo.get('/nube/vento-nube.js') === true, Object.fromEntries(desdeEquipo));
    // Una página de prueba que cambia en el «servidor» (el disco): con internet siempre se ve la de internet.
    const pag = path.join(__dirname, 'tmp-sw-pagina.html'), escribir = t => fs.writeFileSync(pag, '<!doctype html><meta charset="utf-8"><title>p</title><p id="v">' + t + '</p>');
    const leer = async () => { await q.goto(BASE + '/pruebas/tmp-sw-pagina.html').catch(() => {}); return q.evaluate(() => (document.getElementById('v') || {}).textContent || '').catch(() => ''); };
    const q = await ctx.newPage();
    escribir('uno'); chk('3. Con internet la página es la de internet', await leer() === 'uno');
    await new Promise(z => setTimeout(z, 1100)); escribir('dos');
    chk('3. … también cuando cambia (versión nueva): nadie se queda con la vieja', await leer() === 'dos');
    await ctx.setOffline(true);
    chk('3. … y sin internet se ve la última que se vio («dos»)', await leer() === 'dos');
    await ctx.setOffline(false); await q.close(); try{ fs.unlinkSync(pag); }catch(e){}
    await p.waitForTimeout(500);

    // Sin internet
    await ctx.setOffline(true);
    await p.reload().catch(() => {});
    await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 }).catch(() => {});
    chk('4. Sin internet abre la app (no la página de error del navegador)', await p.evaluate(() => !!document.getElementById('authOverlay') && typeof saveData === 'function'));
    await p.fill('#authBiz', 'Bar Sin Internet'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    chk('4. … y se puede entrar y usar', await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 }).then(() => true, () => false));
    await ctx.setOffline(false);

    // Una versión nueva de un archivo reemplaza la vieja; version.txt no se guarda aunque se pida.
    await p.evaluate(async () => { await fetch('app/01-menus-saltan-arriba.js?v=9.9.9'); await fetch('version.txt?t=1', { cache: 'no-store' }); });
    await p.waitForTimeout(500);
    ks = await llaves();
    const de01 = ks.filter(u => /app\/01-menus-saltan-arriba\.js/.test(u));
    chk('5. Al guardar la versión nueva de un archivo se borra la vieja', de01.length === 1 && /v=9\.9\.9/.test(de01[0]), de01);
    chk('5. version.txt nunca se guarda', !ks.some(u => /version\.txt/.test(u)));
    chk('Sin errores de página', !errs.length, errs);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
