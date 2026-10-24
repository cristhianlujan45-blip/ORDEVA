// 🧩 La app partida en archivos (app/NN-*.js): que cargue igual que cuando todo estaba dentro de index.html.
//  1. Cada <script src="app/…"> de index.html existe y lleva ?v= con la versión de la app (MESORA_VERSION) y la de
//     version.txt: así, al publicar, ningún equipo mezcla un index.html nuevo con un archivo viejo guardado.
//  2. No sobran archivos en app/ que nadie carga, y van en orden (01, 02, …).
//  3. Abre sin errores, carga todos los archivos y la app funciona (entrar y agregar a una mesa).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  let ok = 0, mal = 0;
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const raiz = path.join(__dirname, '..'), html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const vers = ((html + fs.readdirSync(path.join(raiz, 'app')).map(f => fs.readFileSync(path.join(raiz, 'app', f), 'utf8')).join('\n')).match(/const MESORA_VERSION = '[^']*v([\d.]+)'/) || [])[1];
  const txt = fs.readFileSync(path.join(raiz, 'version.txt'), 'utf8').trim();
  const tags = [...html.matchAll(/<script src="(app\/[^"?]+)\?v=([^"]+)"><\/script>/g)].map(m => ({ f: m[1], v: m[2] }));
  chk('1. index.html carga ' + tags.length + ' archivos de app/', tags.length >= 20);
  chk('1. Todos existen', tags.every(t => fs.existsSync(path.join(raiz, t.f))), tags.filter(t => !fs.existsSync(path.join(raiz, t.f))));
  chk('1. Todos con ?v=' + vers + ' (la versión de la app) y version.txt igual', !!vers && tags.every(t => t.v === vers) && txt.endsWith('v' + vers), { vers, txt, distintos: tags.filter(t => t.v !== vers) });
  const adm = (fs.readFileSync(path.join(raiz, 'admin.html'), 'utf8').match(/var ADMIN_VERSION = '([^']+)'/) || [])[1];
  chk('1. El panel ORDEVA Admin tiene la misma versión que version.txt (si no, se queda pidiendo «Actualizar»)', adm === txt, { adm, txt });
  const enDisco = fs.readdirSync(path.join(raiz, 'app')).filter(f => /\.js$/.test(f)).map(f => 'app/' + f).sort();
  chk('2. No sobra ningún archivo en app/', enDisco.every(f => tags.some(t => t.f === f)), enDisco.filter(f => !tags.some(t => t.f === f)));
  chk('2. En orden (01, 02, …)', tags.map(t => t.f).join() === tags.map(t => t.f).sort().join());
  const b = await chromium.launch(); const errs = [];
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const cargados = new Set(); p.on('response', r => { const u = new URL(r.url()); if(/^\/app\//.test(u.pathname) && r.status() === 200) cargados.add(u.pathname.slice(1)); });
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    chk('3. Cargó los ' + tags.length + ' archivos', tags.every(t => cargados.has(t.f)), tags.filter(t => !cargados.has(t.f)).map(t => t.f));
    await p.fill('#authBiz', 'Bar Módulos'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const r = await p.evaluate(async () => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'pk', name: 'Poker', price: 3800, stock: 50 }]; data.tables = data.tables || {}; data.tables[1] = { items: [], payments: [], people: [] }; saveData();
      openTableModal(1); await new Promise(z => setTimeout(z, 300));
      document.getElementById('addProductSearch').value = 'Poker'; document.getElementById('addProductId').value = 'pk'; document.getElementById('addQty').value = '2';
      document.getElementById('addItemBtn').click(); await new Promise(z => setTimeout(z, 400));
      return { qty: (data.tables[1].items[0] || {}).qty, version: MESORA_VERSION, laya: typeof window.vitoMod, ocr: !!window.VitoOfflineOCR, comp: typeof window.comprobanteVerificar };
    });
    chk('3. Entra, abre la mesa y agrega 2 Poker (la app funciona igual)', r.qty === 2, r);
    chk('3. Los módulos de adentro quedaron (pedidos/QR, lector, comprobantes)', r.laya === 'object' && r.ocr && r.comp === 'function', r);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
