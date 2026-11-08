// 🧾 ORDEVA 1.95.5 · Lo que pidió el dueño el 08/11 con capturas del celular:
//  1. Panel «🛍️ Pedidos» (tiendas): los textos se leen (antes: tarjeta blanca con letra casi blanca en el tema oscuro).
//  2. Pagar por transferencia (pedido.html): un solo recuadro con la llave Bre-B (desde cualquier banco) y Nequi, y un solo
//     «✅ Ya pagué por transferencia» (antes «Ya pagué por Nequi» y otro «Ya pagué» en el QR).
//  3. Canción escrita a mano (con el nombre mal escrito): primero salen los resultados de YouTube para tocar la correcta;
//     un segundo toque la manda como se escribió.
//  4. La música sigue lo que piden las mesas: mientras una pedida se busca, la playlist de fondo no se le adelanta.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  // Contraste WCAG entre dos colores «rgb(...)».
  const contraste = (a, c) => { const L = s => { const m = String(s).match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    const x = L(a), y = L(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  try{
    // ===== 1 y 4: la app del negocio =====
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'tienda'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Tienda 1955'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'ag', name: 'Aguila', price: 3500 }]; data.pedidosAuto = false; saveData();
      window.vitoMod.procesar(JSON.stringify({ t: 'pedido', v: 2, id: 'p1955a', mesa: 1, vm: 'x', items: [{ n: 'Aguila', q: 3 }], at: Date.now() }));
      window.ventoPedidosTienda.panel(); });
    await pausa(400);
    const colores = () => p.evaluate(() => { const c = document.querySelector('#ptOv .pt-card'); if(!c) return null; const cs = getComputedStyle(c), it = c.querySelector('.pt-it') || c, h = c.querySelector('.pt-h b') || c;
      return { fondo: cs.backgroundColor, letra: getComputedStyle(it).color, titulo: getComputedStyle(h).color }; });
    const legible = v => !!v && contraste(v.fondo, v.letra) >= 4.5 && contraste(v.fondo, v.titulo) >= 4.5;
    let v = await colores();
    chk('1. Panel «Pedidos» con el tema claro: el texto se lee (contraste de al menos 4,5)', legible(v), v);
    // El tema oscuro del celular del dueño (la paleta «Noche violeta»).
    await p.evaluate(() => { const r = document.documentElement.style; r.setProperty('--surface', '#17171f'); r.setProperty('--ink', '#f2f1f7'); r.setProperty('--ink-soft', '#9a97ad'); r.setProperty('--line', '#2a2a36'); });
    v = await colores();
    chk('1. … y con el tema oscuro: tarjeta oscura y letra clara (antes: tarjeta blanca con letra casi blanca)', legible(v) && !/255, 255, 255/.test(v.fondo), v && Object.assign({ c: contraste(v.fondo, v.letra).toFixed(1) }, v));

    v = await p.evaluate(() => { const M = window.vitoMod, ahora = Date.now();
      const l = [{ id: 'f1', fondo: true, mesa: 0, song: 'Fondo uno', ts: ahora - 600000, done: false, status: 'pending', vid: 'fondo111111', ok: true },
                 { id: 'm1', mesa: 3, song: 'Pedida que se busca', ts: ahora - 5000, done: false, status: 'pending' }];
      M.SS('vito_cola', l); const a = M.mzOrdenParaSonar().map(x => x.id);
      l[1].ts = ahora - 90000; M.SS('vito_cola', l); const b2 = M.mzOrdenParaSonar().map(x => x.id);
      l[1].ts = ahora - 5000; l[1].vid = 'pedida11111'; l[1].ok = true; M.SS('vito_cola', l); const c = M.mzOrdenParaSonar().map(x => x.id);
      M.SS('vito_cola', []); return { a, b2, c }; });
    chk('4. Mientras la canción pedida se busca, la playlist de fondo no se le adelanta', v.a.length === 0, v);
    chk('4. … pasado 1 minuto sin encontrarla, sigue el fondo (no queda en silencio)', v.b2.join() === 'f1', v);
    chk('4. … y lista la pedida, suena primero lo que pidió la mesa', v.c[0] === 'm1', v);

    // ===== 2 y 3: la página del cliente =====
    const cx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CO' });
    const posts = [];
    await cx.route('**/*', r => { const u = new URL(r.request().url());
      if(/rpc\/canal_publicar/.test(u.pathname)){ try{ posts.push(JSON.parse(r.request().postData() || '{}').p_cuerpo || ''); }catch(e){} return r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"1","time":1,"event":"message","topic":"x","message":""}' }); }
      if(/rpc\/canal_leer/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if(/\/yt\/buscar/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [
        { id: { videoId: 'paranoid111' }, snippet: { title: 'BLACK SABBATH - Paranoid (Official Video)', channelTitle: 'Black Sabbath' } },
        { id: { videoId: 'ironman1111' }, snippet: { title: 'Black Sabbath - Iron Man', channelTitle: 'Black Sabbath' } }] }) });
      return u.hostname === 'localhost' ? r.continue() : r.abort(); });
    await cx.addInitScript(() => { window.VENTO_NUBE_DEFAULT = { url: 'http://localhost:1', key: 'x' }; });
    const c = await cx.newPage(); c.on('pageerror', e => errs.push('cliente: ' + e.message));
    await c.goto(BASE + '/pedido.html?mesa=4&c=tiendaprueba1955&v=PRUEBAv1955&nq=3105746088&nqn=' + encodeURIComponent('Modesta Carrillo')); await pausa(1200);
    v = await c.evaluate(() => { qrPago = { i: '', q: 'Bancolombia', l: '@bar1955' }; snap = { s: 21000, c: 21000 }; pintarNequi(snap);
      const vis = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
      return { box: vis('nequiBox'), h: document.getElementById('nequiH').textContent, breb: vis('trBreb') && document.getElementById('trBrebVal').textContent, nequi: vis('trNequi') && document.getElementById('nequiNum').textContent,
        orden: [...document.querySelectorAll('#nequiBox .tr-op')].filter(x => !x.hidden).map(x => x.id), btns: [...document.querySelectorAll('#nequiBox button')].map(x => x.textContent.trim()) }; });
    chk('2. Un solo recuadro «💸 Paga por transferencia» con la llave Bre-B primero y Nequi después', v.box && /transferencia/.test(v.h) && v.breb === '@bar1955' && v.nequi === '3105746088' && v.orden.join() === 'trBreb,trNequi', v);
    chk('2. … y un solo botón «✅ Ya pagué por transferencia» (más copiar la llave y el número)', v.btns.filter(x => /Ya pagué/.test(x)).length === 1 && v.btns.some(x => /Ya pagué por transferencia/.test(x)), v.btns);
    posts.length = 0; await c.evaluate(() => document.getElementById('nequiPaidBtn').click()); await pausa(600);
    v = { posts: posts.slice(), ok: await c.evaluate(() => document.getElementById('nequiOkMsg').textContent) };
    chk('2. Al tocarlo el local recibe «YA PAGÓ $21.000 por transferencia (Bre-B o Nequi)» para revisarlo', v.posts.some(x => /CUENTA MESA 4: .*YA PAGÓ \$\s?21\.000 por transferencia \(Bre-B o Nequi/.test(x)) && /revisar/.test(v.ok), v);

    await c.click('#tc'); await c.fill('#s', 'Black sa'); posts.length = 0; await c.click('#b'); await pausa(900);
    v = Object.assign({ posts: posts.filter(x => /"cancion"/.test(x)) }, await c.evaluate(() => ({ m: document.getElementById('m').textContent, rows: document.querySelectorAll('#ytPrev .ytpedir').length, vis: !document.getElementById('ytPrev').hidden })));
    chk('3. Escrita a mano («Black sa»): no se manda todavía, salen los resultados para tocar la correcta', v.posts.length === 0 && v.rows === 2 && v.vis && /canción correcta/.test(v.m), v);
    await c.evaluate(() => document.querySelector('#ytPrev .ytpedir').click()); await pausa(900);
    v = posts.filter(x => /"cancion"/.test(x)).map(x => JSON.parse(x));
    chk('3. Toca «▶ Pedir» en la correcta: va la canción con su video (Paranoid)', v.length === 1 && /Paranoid/.test(v[0].s) && v[0].vid === 'paranoid111', v);
    await c.fill('#s', 'Cancion rara que no esta'); posts.length = 0; await c.click('#b'); await pausa(900); await c.click('#b'); await pausa(900);
    v = posts.filter(x => /"cancion"/.test(x)).map(x => JSON.parse(x).s);
    chk('3. Si no está en los resultados, un segundo toque la manda como se escribió', v.length === 1 && v[0] === 'Cancion rara que no esta', v);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
