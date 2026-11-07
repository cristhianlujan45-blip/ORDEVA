// Reenvío de la dirección vieja (puente/sitio-reenvio/404.html): …github.io/cuentas/… → …github.io/ORDEVA/… con los mismos
// datos, y quita el service worker de la app vieja (/cuentas/). Servidor local que imita a GitHub Pages (lo que no existe → 404.html).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const P404 = fs.readFileSync(path.join(process.argv[2] || path.join(__dirname, '..', 'puente', 'sitio-reenvio'), '404.html'));
let swVivo = true;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname.startsWith('/ORDEVA/')) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>ok</title><p id=ok>ORDEVA</p>'); }
  if (u.pathname === '/cuentas/sw.js' && swVivo) { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end('self.addEventListener("install",()=>self.skipWaiting());'); }
  if (u.pathname === '/cuentas/vieja.html' && swVivo) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><p>vieja</p>'); }
  r.writeHead(404, { 'content-type': 'text/html' }); r.end(P404);
}).listen(9031);
let ok = 0, mal = 0; const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + ' → ' + JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const B = 'http://localhost:9031';
  const casos = [
    ['/cuentas/pedido.html?mesa=1&c=abc#k=XYZ', '/ORDEVA/pedido.html?mesa=1&c=abc#k=XYZ'],
    ['/cuentas/', '/ORDEVA/'], ['/cuentas', '/ORDEVA/'], ['/CUENTAS/index.html?x=1', '/ORDEVA/index.html?x=1'],
    ['/cuentas/index.html#access_token=t&type=recovery', '/ORDEVA/index.html#access_token=t&type=recovery'],
    ['/', '/ORDEVA/'], ['/index.html', '/ORDEVA/'],
  ];
  for (const [de, a] of casos) {
    await p.goto(B + de); await p.waitForURL(u => new URL(u).pathname.startsWith('/ORDEVA/'), { timeout: 5000 }).catch(() => {});
    const u = new URL(p.url()); chk(de + ' → ' + a, u.pathname + u.search + u.hash === a, p.url());
  }
  await p.goto(B + '/cuentasx/a'); await new Promise(r => setTimeout(r, 1200));
  chk('/cuentasx/a no se reenvía (solo /cuentas/)', new URL(p.url()).pathname === '/cuentasx/a' && /cambió de dirección/.test(await p.innerText('body')), p.url());
  // App vieja instalada: service worker en /cuentas/ (y uno de ORDEVA que no se toca)
  await p.goto(B + '/cuentas/vieja.html');
  await p.evaluate(async () => { await navigator.serviceWorker.register('/cuentas/sw.js', { scope: '/cuentas/' }); });
  await p.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 1);
  swVivo = false;
  await p.goto(B + '/cuentas/pedido.html?mesa=2');
  await p.waitForURL(u => new URL(u).pathname.startsWith('/ORDEVA/'), { timeout: 5000 }).catch(() => {});
  const regs = await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => r.scope));
  chk('La app vieja (/cuentas/) se quita y abre ORDEVA con la mesa', new URL(p.url()).pathname + new URL(p.url()).search === '/ORDEVA/pedido.html?mesa=2' && !regs.some(s => /\/cuentas\//.test(s)), { url: p.url(), regs });
  await b.close(); srv.close(); console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal'); process.exit(mal ? 1 : 0);
})();
