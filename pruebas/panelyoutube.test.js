// ▶️ Panel de YouTube dentro de la app: ver lo que suena, poner canciones y las listas propias.
// El reproductor de YouTube (IFrame API), el Servidor Vento (/yt/buscar, /yt/lista) y la API de la cuenta de Google se simulan.
//  1. Música → «▶️ Abrir el panel de YouTube»: se abre la ventana; sin música dice «No está sonando nada».
//  2. Buscar «feid» → resultados con portada → «⏭ Que siga» → suena en la app y el VIDEO se ve dentro del panel.
//  3. «➕ Cola» la deja en su turno; otra con «⏭ Que siga» se pone primero. ⏯ pausa / sigue; ⏭ pasa a la siguiente.
//  4. «📃 Mis listas»: pegar el link de una lista la pone de fondo; aparece «De fondo: …» y queda guardada.
//  5. Sin cuenta conectada ofrece «Conectar mi cuenta de YouTube»; con la cuenta conectada muestra SUS listas
//     (también privadas) y «▶ Poner» las pone.
//  6. «🎵 En cola» con portadas: ⏭ adelanta y 🗑 quita.
//  7. Al cerrar el panel queda la barrita «🎵 sonando» en toda la app; tocarla abre el panel; ✕ la oculta.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

const video = (id, t, c, d) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: c, thumbnails: { default: { url: 'https://i.ytimg.com/vi/' + id + '/default.jpg' } } }, duracion: d });
const BUSCA = [video('feid0000001', 'Feid - Luna', 'Feid', 210), video('feid0000002', 'Feid - Normal', 'Feid', 190), video('feid0000003', 'Feid - Classy 101', 'Feid', 200)];
const LISTA = 'PLmilista000000000000001', PRIV = 'PLprivada0000000000000002';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const pedidosApi = [];
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url()), J = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if(u.hostname === 'localhost') return r.continue();
      if(/\/vento-ia\/yt\/buscar$/.test(u.pathname)){
        if(u.searchParams.get('tipo') === 'lista') return J({ items: [{ id: { playlistId: LISTA }, snippet: { title: 'Mi lista del bar', channelTitle: 'Yo' }, canciones: 6 }] });
        if(/tusa/i.test(u.searchParams.get('q') || '')) return J({ items: [video('tusa0000001', 'KAROL G, Nicki Minaj - Tusa', 'KAROL G', 201)] });
        return J({ items: BUSCA });
      }
      if(/\/vento-ia\/yt\/lista$/.test(u.pathname)){
        const id = u.searchParams.get('id');
        if(id === PRIV) return r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":{"message":"privada"}}' });
        return J({ titulo: 'Mi lista del bar', items: Array.from({ length: 6 }, (_, i) => ({ id: { videoId: ('lista' + i + 'xxxxxxxx').slice(0, 11) }, snippet: { title: 'Canción de lista ' + (i + 1), channelTitle: 'Artista' }, duracion: 180 })) });
      }
      if(u.hostname === 'www.googleapis.com'){
        pedidosApi.push(u.pathname.split('/').pop() + '?' + u.searchParams.toString());
        if(/\/playlists$/.test(u.pathname) && u.searchParams.get('mine') === 'true')
          return J({ items: [{ id: PRIV, snippet: { title: 'Mis vallenatos (privada)', thumbnails: { default: { url: 'https://i.ytimg.com/vi/x/default.jpg' } } }, contentDetails: { itemCount: 4 }, status: { privacyStatus: 'private' } }, { id: LISTA, snippet: { title: 'Mi lista del bar' }, contentDetails: { itemCount: 6 }, status: { privacyStatus: 'public' } }] });
        if(/\/playlistItems$/.test(u.pathname)) return J({ items: Array.from({ length: 4 }, (_, i) => ({ snippet: { title: 'Vallenato ' + (i + 1), videoOwnerChannelTitle: 'Diomedes', resourceId: { videoId: ('valle' + i + 'xxxxxxx').slice(0, 11) } } })) });
        if(/\/playlists$/.test(u.pathname)) return J({ items: [{ snippet: { title: 'Mis vallenatos (privada)' } }] });
        if(/\/channels$/.test(u.pathname)) return J({ items: [{ snippet: { title: 'Bar de Ana' } }] });
        if(/\/videos$/.test(u.pathname)) return J({ items: (u.searchParams.get('id') || '').split(',').map(id => ({ id, snippet: { title: 'Tusa', channelTitle: 'KAROL G' }, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' }, contentDetails: { duration: 'PT3M21S' } })) });
        return J({ items: [] });
      }
      return r.abort();
    });
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://prueba.supabase.co', key: 'x'.repeat(30) })); localStorage.setItem('vito_auto_play', JSON.stringify({ on: true })); }catch(e){}
      // Reproductor de YouTube simulado (IFrame API)
      window.__yt = { cargados: [] };
      window.YT = { Player: class {
        constructor(id, o){ this.o = o; this.st = -1; this.id = id; const el = document.getElementById(id); if(el){ const f = document.createElement('iframe'); f.id = id; f.className = 'fake-yt'; el.replaceWith(f); }
          if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 30); }
        loadVideoById(v){ this.vid = v; this.st = 1; if(this.id === 'ytPlayer') window.__yt.cargados.push(v); setTimeout(() => this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }), 30); }
        pauseVideo(){ this.st = 2; } playVideo(){ this.st = 1; } stopVideo(){ this.st = 5; } mute(){}
        getPlayerState(){ return this.st; } getCurrentTime(){ return 42; } getDuration(){ return 210; }
      } };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar YT'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; for(let i = 1; i <= 3; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData(); try{ applyMusicOn && applyMusicOn(); }catch(e){} });

    // ===== 1. Abrir el panel =====
    await p.evaluate(() => { const b = document.querySelector('.more-tile[data-go="musica"]') || document.querySelector('nav button[data-view="musica"]'); b && b.click(); });
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.click('#view-musica [data-yp-abrir]');
    chk('1. «▶️ Abrir el panel de YouTube» abre la ventana de YouTube', await p.isVisible('#ypOv.show .yp'));
    chk('1. Sin música: «No está sonando nada»', /No está sonando nada/.test(await p.textContent('#ypVideo')) && await p.isVisible('#ypNada'));

    // ===== 2. Buscar y poner =====
    await p.fill('#ypQ', 'feid'); await p.click('#ypCuerpo .yp-buscar button');
    await p.waitForSelector('#ypRes .yp-fila');
    const res = await p.evaluate(() => [...document.querySelectorAll('#ypRes .yp-fila')].map(f => ({ t: f.querySelector('b').textContent, img: (f.querySelector('img') || {}).src || '' })));
    chk('2. Resultados de «feid» con portada, título y duración', res.length === 3 && res[0].t === 'Feid - Luna' && /i\.ytimg\.com\/vi\/feid0000001/.test(res[0].img) && /3:30/.test(await p.textContent('#ypRes .yp-fila')), res);
    await p.click('#ypRes .yp-fila:nth-child(1) .btn-primary');
    chk('2. «⏭ Que siga» → suena en el reproductor de la app', await p.waitForFunction(() => window.__yt.cargados.includes('feid0000001'), null, { timeout: 8000 }).then(() => true, () => false), await p.evaluate(() => window.__yt.cargados));
    await p.waitForTimeout(1300);
    const vis = await p.evaluate(() => { const b = document.getElementById('ytBox'), v = document.getElementById('ypVideo').getBoundingClientRect(), r = b.getBoundingClientRect(); return { cls: b.className, dx: Math.abs(r.left - v.left), dy: Math.abs(r.top - v.top), w: Math.round(r.width), vw: Math.round(v.width), hidden: b.hidden }; });
    chk('2. El VIDEO se ve dentro del panel (el reproductor queda encima del recuadro del video)', /yt-visible/.test(vis.cls) && vis.dx < 2 && vis.dy < 2 && Math.abs(vis.w - vis.vw) < 2 && !vis.hidden, vis);
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/yp-1.png' });
    chk('2. Muestra el título, «En este equipo» y el tiempo', /Feid - Luna/.test(await p.textContent('#ypTitulo')) && /En este equipo/.test(await p.textContent('#ypDonde')) && /0:42 \/ 3:30/.test(await p.textContent('#ypTiempo')), [await p.textContent('#ypTitulo'), await p.textContent('#ypDonde'), await p.textContent('#ypTiempo')]);

    // ===== 3. Cola, «que siga», pausa y siguiente =====
    await p.click('#ypRes .yp-fila:nth-child(2) .btn-ghost');                 // ➕ Cola: Normal
    await p.click('#ypRes .yp-fila:nth-child(3) .btn-primary');               // ⏭ Que siga: Classy 101
    let orden = await p.evaluate(() => window.vitoMusica.orden().map(x => x.title));
    chk('3. «⏭ Que siga» va primero y «➕ Cola» queda en su turno', orden[0] === 'Feid - Classy 101' && orden[1] === 'Feid - Normal', orden);
    await p.evaluate(() => window.vitoAddSong(2, 'Karol G Tusa'));
    orden = await p.evaluate(() => window.vitoMusica.orden().map(x => x.title || x.song));
    chk('3. Lo que pide una mesa no se salta lo que pusiste con «Que siga»', orden[0] === 'Feid - Classy 101', orden);
    await p.click('#ypPausa');
    chk('3. ⏯ pausa el video', await p.evaluate(() => window.__yt.main.st === 2));
    await p.click('#ypPausa');
    chk('3. ⏯ otra vez: sigue sonando', await p.evaluate(() => window.__yt.main.st === 1));
    await p.click('#ypSig');
    chk('3. ⏭ Siguiente → suena «Classy 101»', await p.waitForFunction(() => window.__yt.cargados.slice(-1)[0] === 'feid0000003', null, { timeout: 8000 }).then(() => true, () => false), await p.evaluate(() => window.__yt.cargados));

    // ===== 4. Mis listas: pegar el link =====
    await p.click('#ypOv [data-yp-tab="listas"]');
    await p.fill('#ypLq', 'https://music.youtube.com/playlist?list=' + LISTA + '&si=abc');
    await p.click('#ypCuerpo .yp-buscar button');
    chk('4. Pegar el link de una lista la pone de fondo («De fondo: Mi lista del bar»)', await p.waitForFunction(() => /De fondo: Mi lista del bar/.test(document.getElementById('ypCuerpo').textContent), null, { timeout: 8000 }).then(() => true, () => false), await p.textContent('#ypCuerpo'));
    chk('4. … y queda guardada en «Mis listas guardadas» (llega a los demás equipos)', await p.evaluate(l => (data.mzListas || []).some(x => x.id === l), LISTA));

    // ===== 5. Listas de la cuenta de YouTube =====
    chk('5. Sin cuenta conectada: ofrece «🔗 Conectar mi cuenta de YouTube»', /Conectar mi cuenta de YouTube/.test(await p.textContent('#ypCuerpo')));
    await p.evaluate(() => { localStorage.setItem('vito_ytok', JSON.stringify({ t: 'token-prueba', exp: Date.now() + 3600e3 })); });
    await p.click('#ypOv [data-yp-tab="cola"]'); await p.click('#ypOv [data-yp-tab="listas"]');
    await p.waitForFunction(() => /Mis vallenatos \(privada\)/.test(document.getElementById('ypCuerpo').textContent), null, { timeout: 8000 }).catch(() => {});
    const mias = await p.textContent('#ypCuerpo');
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/yp-2.png' });
    chk('5. Con la cuenta conectada muestra SUS listas de YouTube (también las privadas 🔒)', /Mis vallenatos \(privada\)/.test(mias) && /🔒 privada/.test(mias) && pedidosApi.some(x => /^playlists\?.*mine=true/.test(x)), pedidosApi);
    await p.evaluate(() => { const f = [...document.querySelectorAll('#ypCuerpo .yp-fila')].find(x => /Mis vallenatos/.test(x.textContent)); f.querySelector('.btn-primary').click(); });
    chk('5. «▶ Poner» en una lista privada de la cuenta la pone de fondo (la lee con la cuenta)', await p.waitForFunction(() => { const f = JSON.parse(localStorage.getItem(window.ventoClave ? window.ventoClave('vito_fondo') : 'vito_fondo') || localStorage.getItem('vito_fondo') || '{}'); return /vallenatos/i.test(f.nombre || '') && (f.vids || []).length === 4; }, null, { timeout: 10000 }).then(() => true, () => false));

    // ===== 6. En cola =====
    await p.click('#ypOv [data-yp-tab="cola"]');
    const cola = await p.evaluate(() => [...document.querySelectorAll('#ypCuerpo .yp-fila')].map(f => ({ t: f.querySelector('b').textContent, img: !!f.querySelector('img') })));
    chk('6. «🎵 En cola» muestra lo que suena y lo que sigue, con portadas', cola.length >= 3 && /Classy 101/.test(cola[0].t) && cola.some(x => /Normal/.test(x.t) && x.img), cola);
    const antes = await p.evaluate(() => window.vitoMusica.orden().length);
    await p.evaluate(() => { const f = [...document.querySelectorAll('#ypCuerpo .yp-fila')].find(x => /Normal/.test(x.textContent)); [...f.querySelectorAll('button')].find(b => b.textContent === '🗑').click(); });
    chk('6. 🗑 quita una canción de la cola', (await p.evaluate(() => window.vitoMusica.orden().length)) === antes - 1 && !(await p.evaluate(() => window.vitoMusica.orden().some(x => x.title === 'Feid - Normal'))));
    await p.evaluate(() => { const f = [...document.querySelectorAll('#ypCuerpo .yp-fila')].find(x => /Tusa/.test(x.textContent)); [...f.querySelectorAll('button')].find(b => b.textContent === '⏭').click(); });
    chk('6. ⏭ adelanta una canción de la cola', (await p.evaluate(() => (window.vitoMusica.orden()[0] || {}).song || '')).includes('Tusa'));

    // ===== 7. Barrita en toda la app =====
    await p.click('#ypCerrar');
    chk('7. Al cerrar el panel el video sale de la vista pero sigue sonando', await p.evaluate(() => !document.getElementById('ytBox').classList.contains('yt-visible') && window.__yt.main.st === 1));
    await p.evaluate(() => document.querySelector('nav button[data-view="mesas"]').click());
    await p.waitForTimeout(1300);
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/yp-3.png' });
    chk('7. En otra pantalla aparece la barrita «🎵» con la canción que suena', await p.isVisible('#ypMini') && /Classy 101/.test(await p.textContent('#ypMini')), await p.evaluate(() => (document.getElementById('ypMini') || {}).outerHTML || null));
    await p.click('#ypMini .yp-mt');
    chk('7. Tocar la barrita abre el panel', await p.isVisible('#ypOv.show .yp'));
    await p.click('#ypCerrar'); await p.waitForTimeout(1200);
    await p.click('#ypMini [data-yp-x]');
    chk('7. ✕ oculta la barrita', !(await p.isVisible('#ypMini')));
    chk('7. Sin desbordar la pantalla del celular', await p.evaluate(() => document.documentElement.scrollWidth <= 392));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
