// 📺 1.99.37 · Auditoría de la música por QR (22/11): «que suene en mi cuenta Premium sin comerciales, rápido, cualquier
// canción y sin límites en la búsqueda». Revisa:
//  1. Servidor (vento-ia, con un «Deno» simulado): el puente del YouTube del TV reenvía a YouTube SOLO las 3 llamadas del
//     TV (con el permiso del TV), no deja pasar otras direcciones, otros orígenes ni mensajes enormes, y tiene un tope
//     por conexión que un negocio no alcanza.
//  2. La app, desde un navegador SIN puente propio (antes había que crear uno en Cloudflare): ya hay puente (el del
//     servidor), el paso «Puente gratis» no se muestra y vincular el TV con su código funciona por el servidor.
//  3. Página del QR: si el servidor dice «muchas búsquedas seguidas», reintenta sola y el cliente ve las canciones (sin aviso).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  // ===== 1. Servidor =====
  try{
    const out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(__dirname, 'servidor', 'ventoia-lounge.mts')], { cwd: path.join(__dirname, 'servidor'), timeout: 60000 }).toString();
    const r = JSON.parse(out.trim().split('\n').pop());
    chk('1. Servidor: vincular el TV (pairing/get_screen) se reenvía tal cual a YouTube', r.parear.status === 200 && /screenId/.test(r.parear.cuerpo) && r.parear.reenvio.url === 'https://www.youtube.com/api/lounge/pairing/get_screen' && r.parear.reenvio.cuerpo === 'pairing_code=123456789012' && r.parear.cors === 'https://ordeva.co', r.parear);
    chk('1. … mandar canciones (bc/bind) lleva el permiso del TV y los datos de la llamada', r.bind.status === 200 && r.bind.reenvio.token === 'tok1' && /RID=1&VER=8$/.test(r.bind.reenvio.url), r.bind);
    chk('1. … otras direcciones de YouTube NO pasan', r.otraRuta.status !== 200 && r.otraRuta.llamadas === 2, r.otraRuta);
    chk('1. … solo POST, y desde otra página (origen) NO pasa', r.get.status !== 200 && r.origenMalo.status === 403 && r.origenMalo.llamadas === 2, { get: r.get, origen: r.origenMalo });
    chk('1. … un mensaje enorme NO pasa (413)', r.grande.status === 413, r.grande);
    chk('1. … tope por conexión de 240 por minuto (el equipo de la música manda unos pocos por minuto)', r.tope && r.tope.en === 241, r.tope);
    chk('1. … el navegador puede mandar el permiso del TV (cabecera permitida)', r.preflight.status === 204 && /x-youtube-loungeid-token/.test(r.preflight.headers), r.preflight);
  }catch(e){ mal++; console.log('❌ 1. El servidor no se pudo probar: ' + (e && (e.stderr || e.message) || e).toString().slice(0, 500)); }

  const b = await chromium.launch();
  try{
    // ===== 2. La app en un navegador, sin puente propio =====
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const alServidor = [];
    await ctx.route('**/*', r => {
      const u = r.request().url();
      if(/\/functions\/v1\/vento-ia\/lounge\//.test(u)){
        alServidor.push({ u, body: r.request().postData() });
        if(/pairing\/get_screen/.test(u)) return r.fulfill({ status: 200, contentType: 'text/plain', body: '{"screen":{"screenId":"pantalla1","loungeToken":"tokTV","expiration":0,"name":"TV de la sala"}}' });
        return r.fulfill({ status: 200, contentType: 'text/plain', body: '' });
      }
      return new URL(u).hostname === 'localhost' ? r.continue() : r.abort();
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('app: ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.waitForTimeout(400);
    const a = await p.evaluate(() => ({ app: !!window.VentoAndroid, relay: (JSON.parse(localStorage.getItem('vito_ytlounge') || '{}')).relay || '', hay: lngHayPuente(), url: lngPuenteUrl() }));
    chk('2. En un navegador, sin puente propio, ya hay puente: el del Servidor ORDEVA', !a.app && !a.relay && a.hay && /\/functions\/v1\/vento-ia\/lounge\/$/.test(a.url), a);
    await p.evaluate(() => document.querySelector('[data-view="musica"]').click()); await p.waitForTimeout(900);
    const paso = await p.evaluate(() => { const r = document.getElementById('lngRelay'); const st = r && r.closest('.lng-step'); return { pasoUno: st ? getComputedStyle(st).display : 'no hay', nota: [...document.querySelectorAll('#tvOptCodigo .settings-desc')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent).join(' ').slice(0, 200) }; });
    chk('2. … el paso «Puente gratis (5 minutos)» ya no se muestra; dice «Puente listo»', paso.pasoUno === 'none' && /Puente listo/.test(paso.nota), paso);
    const v = await p.evaluate(async () => { try{ await lngParear('123456789012'); const c = JSON.parse(localStorage.getItem('vito_ytlounge') || '{}'); return { ok: true, screenId: c.screenId, nombre: c.nombre, on: lngOn() }; }catch(e){ return { ok: false, e: String(e && e.message || e) }; } });
    chk('2. … vincular el TV con su código funciona por el servidor (queda conectado «TV de la sala»)', v.ok && v.screenId === 'pantalla1' && v.nombre === 'TV de la sala' && v.on, v);
    chk('2. … y la llamada fue al puente del servidor con el código', alServidor.some(x => /lounge\/pairing\/get_screen$/.test(x.u) && /pairing_code=123456789012/.test(x.body || '')), alServidor.slice(0, 3));
    await ctx.close();

    // ===== 3. Página del QR: «muchas búsquedas» → reintenta sola =====
    const C = 'PRUEBAqrPUENTE37';
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, locale: 'es-CO' });
    let pedidos = 0;
    await ctx2.route('**/*', r => {
      const u = r.request().url();
      if(/vento-ia\/yt\/buscar/.test(u)){
        pedidos++;
        if(/tipo=video/.test(u) && pedidos <= 3) return r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"code":429}}' });
        if(/tipo=video/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: { videoId: 'abc123def45' }, snippet: { title: 'Diomedes Díaz - La Plata', channelTitle: 'Diomedes', thumbnails: { default: { url: '' } } }, duracion: 277 }] }) });
        return r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' });
      }
      if(/rpc\/canal_leer/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if(/rpc\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"1","time":1,"event":"message"}' });
      return new URL(u).hostname === 'localhost' ? r.continue() : r.abort();
    });
    await ctx2.addInitScript(c => { try{ localStorage.setItem('cat_' + c, JSON.stringify({ y: 'bar', t: 'Carta', n: 'Bar', p: [['Cerveza', 4000, 'Bebidas', 0, 0, '']], m: 1 })); }catch(e){} }, C);
    const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('qr: ' + e.message));
    await q.goto(BASE + '/pedido.html?mesa=4&c=' + C, { waitUntil: 'load' }); await q.waitForTimeout(1500);
    const r3 = await q.evaluate(async () => { const t0 = Date.now(); await ytBuscar('diomedes la plata'); const box = document.getElementById('ytPrev'); return { ms: Date.now() - t0, texto: box ? box.textContent.slice(0, 200) : '' }; });
    chk('3. QR: con «muchas búsquedas seguidas» reintenta sola y el cliente ve la canción, sin aviso', /La Plata/.test(r3.texto) && !/muchas|espera/i.test(r3.texto) && pedidos >= 3, { r3, pedidos });
    await ctx2.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
