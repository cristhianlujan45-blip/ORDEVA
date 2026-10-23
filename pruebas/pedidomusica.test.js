// 🎵 Pedir música por el QR (pedido.html), con el diseño juvenil de 1.51.0:
//  1. La pestaña «Canción» trae los géneros de un toque (Reguetón, Salsa, Vallenato…).
//  2. Un género busca canciones por el Servidor ORDEVA (sin cupo de la API de YouTube): no se llama a googleapis.
//  3. «▶ Pedir» en cada canción la pide con un toque: llega al canal del local con el nombre de la canción y la mesa,
//     y el botón dice «✅ Pedida».
//  4. El límite de 10 canciones sigue igual: con 10 pedidas, «▶ Pedir» no la manda y avisa.
//  5. En un celular de 320 px nada se sale por los lados y los botones son de dedo (≥ 40 px).
//  6. «▶ Pedir» y el título de los géneros salen en los 6 idiomas.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/pedido.html?mesa=4&c=PRUEBAqrMUSICA1&v=PRUEBAcuentaV1';
const items = n => Array.from({ length: n }, (_, i) => ({ id: { videoId: 'vid' + i }, snippet: { title: ['KAROL G - Provenza', 'Bad Bunny - Tití Me Preguntó', 'Feid - Classy 101'][i % 3], channelTitle: 'Canal ' + i, thumbnails: { default: { url: '' } } } }));
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  const abrir = async (w, lang) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, locale: lang || 'es-CO' });
    const reg = { google: [], buscar: [], publicado: [] };
    await ctx.route('**/*', r => {
      const u = r.request().url();
      if(/www\.googleapis\.com\/youtube/.test(u)){ reg.google.push(u); return r.fulfill({ status: 403, body: '{}' }); }
      if(/vento-ia\/yt\/buscar/.test(u)){ reg.buscar.push(decodeURIComponent(u)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fuente: 'youtube.com', items: /tipo=canal/.test(u) ? [] : items(6) }) }); }
      if(/rpc\/canal_leer/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if(/rpc\/canal_publicar/.test(u)){ try{ reg.publicado.push(JSON.parse(r.request().postData() || '{}')); }catch(e){} return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: String(reg.publicado.length), time: 1, event: 'message', topic: 'x', message: '{}' }) }); }
      return new URL(u).hostname === 'localhost' ? r.continue() : r.abort();
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(700);
    await p.click('#tc'); await p.waitForTimeout(200);
    return { ctx, p, reg };
  };
  try{
    let { ctx, p, reg } = await abrir(390);
    const gens = await p.evaluate(() => [...document.querySelectorAll('#generos .gen')].map(x => x.textContent));
    chk('1. Pestaña «Canción»: 8 géneros de un toque (Reguetón, Salsa, Vallenato, Despecho…)', gens.length === 8 && gens.some(g => /Reguetón/.test(g)) && gens.some(g => /Vallenato/.test(g)), gens);
    await p.evaluate(() => [...document.querySelectorAll('#generos .gen')].find(x => /Salsa/.test(x.textContent)).click());
    await p.waitForTimeout(900);
    const r2 = await p.evaluate(() => ({ vis: !document.getElementById('ytPrev').hidden, pedir: document.querySelectorAll('#ytPrev .ytpedir').length }));
    chk('2. Tocar «Salsa» busca por el Servidor ORDEVA (sin buscar artistas) y salen 6 canciones con «▶ Pedir»', r2.vis && r2.pedir === 6 && !reg.buscar.some(u => /tipo=canal/.test(u)) && reg.buscar.some(u => /salsa exitos/.test(u)), { r2, buscar: reg.buscar });
    chk('2. … sin llamar a la API de YouTube (no gasta cupo)', reg.google.length === 0, reg.google);
    // Escribir un nombre que el servidor no encuentra como artista: ya NO se busca en la API (gastaba 100 del cupo)
    await p.fill('#s', 'cancion rara'); await p.waitForTimeout(1200);
    chk('2. Buscar escribiendo: si el servidor dice «no hay artistas», no se gasta cupo de la API de respaldo', reg.google.length === 0 && reg.buscar.some(u => /tipo=canal&q=cancion rara/.test(u)), reg.google);
    await p.evaluate(() => document.querySelectorAll('#ytPrev .ytpedir')[1].click());
    await p.waitForTimeout(700);
    const pub = reg.publicado.map(x => x.p_cuerpo || '').join(' || ');
    chk('3. «▶ Pedir» manda la canción al local de una («Bad Bunny - Tití Me Preguntó», mesa 4)', /Tit/.test(pub) && /4/.test(pub), pub.slice(0, 300));
    chk('3. … y el botón dice «✅ Pedida» y avisa «Llevas 1 de 10»', await p.evaluate(() => /Pedida/.test((document.querySelector('.ytpedir.ok') || {}).textContent || '') && /1 de 10/.test(document.getElementById('m').textContent)));
    // 4. Límite de 10
    await p.evaluate(() => { const k = Object.keys(localStorage).find(x => /^canc_/.test(x)); localStorage.setItem(k, JSON.stringify(Array.from({ length: 10 }, () => Date.now()))); });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(700); await p.click('#tc'); await p.waitForTimeout(200);
    const antes = reg.publicado.length;
    await p.evaluate(() => [...document.querySelectorAll('#generos .gen')][0].click()); await p.waitForTimeout(900);
    await p.evaluate(() => document.querySelector('#ytPrev .ytpedir').click()); await p.waitForTimeout(600);
    const r4 = await p.evaluate(() => ({ m: document.getElementById('m').textContent, ok: !!document.querySelector('.ytpedir.ok'), dis: document.querySelector('#ytPrev .ytpedir') && document.querySelector('#ytPrev .ytpedir').disabled }));
    chk('4. Con 10 canciones pedidas, «▶ Pedir» no la manda y avisa el límite (sigue igual)', reg.publicado.length === antes && !r4.ok && /10 canciones/.test(r4.m) && r4.dis === false, r4);
    await ctx.close();
    // 5. Celular pequeño
    ({ ctx, p, reg } = await abrir(320));
    await p.evaluate(() => [...document.querySelectorAll('#generos .gen')][2].click()); await p.waitForTimeout(900);
    const r5 = await p.evaluate(() => {
      const W = innerWidth, vis = e => e.checkVisibility && e.checkVisibility();
      const fuera = [...document.querySelectorAll('#vc *')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && (r.right > W + 1 || r.left < -1); }).map(e => e.className || e.tagName).slice(0, 5);
      const chicos = [...document.querySelectorAll('#vc .gen, #vc .ytpedir')].filter(vis).filter(e => e.getBoundingClientRect().height < 40).length;
      return { scroll: document.documentElement.scrollWidth > W + 1, fuera, chicos };
    });
    chk('5. 320 px: nada se sale por los lados y géneros y «▶ Pedir» son de dedo (≥ 40 px)', !r5.scroll && !r5.fuera.length && !r5.chicos, r5);
    await ctx.close();
    // 6. Idiomas
    const ESP = { en: /Request/, pt: /Pedir/, fr: /Demander/, zh: /点歌/, hi: /माँगें/ };
    for(const [lg, re] of Object.entries(ESP)){
      ({ ctx, p, reg } = await abrir(390, lg));
      await p.evaluate(lg => { const s = document.querySelector('select'); if(s){ const o = [...s.options].find(x => x.value === lg); if(o){ s.value = lg; s.dispatchEvent(new Event('change')); } } }, lg);
      await p.waitForTimeout(200);
      await p.evaluate(() => [...document.querySelectorAll('#generos .gen')][0].click()); await p.waitForTimeout(800);
      const r6 = await p.evaluate(() => ({ b: (document.querySelector('#ytPrev .ytpedir') || {}).textContent || '', t: (document.querySelector('#generos .gtit') || {}).textContent || '' }));
      chk('6. En «' + lg + '» el botón es «' + r6.b + '» (traducido) y el título de los géneros también', re.test(r6.b) && !/^¿No sabes/.test(r6.t), r6);
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
