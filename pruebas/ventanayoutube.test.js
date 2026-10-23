// ▶️ Ventana de YouTube grande, como YouTube normal (computador y celular).
// El reproductor (IFrame API), el Servidor ORDEVA (/yt/buscar, /yt/lista) y la API de la cuenta de Google se simulan.
//  1. En el computador ocupa casi toda la pantalla: secciones a la izquierda, contenido en el centro y lo que suena con
//     «A continuación» a la derecha. El buscador está arriba, como en YouTube.
//  2. Buscar → tarjetas con portada grande y duración; tocar la portada = «Que siga».
//  3. ❤️ Mis canciones: 🤍 guarda (queda en data, llega a los otros equipos), «▶ Poner todas», historial y las que más suenan.
//  4. Mis listas → «👁 Ver» muestra las canciones de la lista y se puede poner UNA sola.
//  5. 👤 Mi YouTube (con Google): mis listas, «Me gusta», mis videos y suscripciones; tocar un canal muestra sus videos.
//  6. En el celular: pantalla completa, secciones como pestañas, resultados en lista, sin desbordar; el video queda en su recuadro.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const video = (id, t, c, d) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: c, thumbnails: { default: { url: 'https://i.ytimg.com/vi/' + id + '/default.jpg' } } }, duracion: d });
const BUSCA = Array.from({ length: 8 }, (_, i) => video(('salsa' + i + 'xxxxxxx').slice(0, 11), 'Salsa clásica ' + (i + 1), 'Grupo Niche', 240 + i));
const LISTA = 'PLmilista000000000000001', CANAL = 'UCcanalDiomedes000000001';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  async function abrir(viewport){
    const ctx = await b.newContext({ viewport });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url()), J = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'i.ytimg.com') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#446"/></svg>' });
      if(/\/vento-ia\/yt\/buscar$/.test(u.pathname)) return J({ items: BUSCA });
      if(/\/vento-ia\/yt\/lista$/.test(u.pathname)){
        const id = u.searchParams.get('id');
        const n = id === 'UU' + CANAL.slice(2) ? 'Diomedes en vivo ' : 'Canción de lista ';
        return J({ titulo: id === LISTA ? 'Mi lista del bar' : '', items: Array.from({ length: 5 }, (_, i) => ({ id: { videoId: (id.slice(0, 4) + i + 'xxxxxxxxxx').slice(0, 11) }, snippet: { title: n + (i + 1), channelTitle: 'Artista' }, duracion: 180 })) });
      }
      if(u.hostname === 'www.googleapis.com'){
        const f = u.pathname.split('/').pop();
        if(f === 'playlists' && u.searchParams.get('mine') === 'true') return J({ items: [{ id: LISTA, snippet: { title: 'Mi lista del bar' }, contentDetails: { itemCount: 5 }, status: { privacyStatus: 'public' } }] });
        if(f === 'videos' && u.searchParams.get('myRating') === 'like') return J({ items: [{ id: 'like0000001', snippet: { title: 'Me gusta: La Rebelión', channelTitle: 'Joe Arroyo' }, contentDetails: { duration: 'PT4M5S' } }] });
        if(f === 'channels') return J({ items: [{ snippet: { title: 'Bar de Ana', thumbnails: {} }, contentDetails: { relatedPlaylists: { uploads: 'UUmiCanal00000000000001' } } }] });
        if(f === 'subscriptions') return J({ items: [{ snippet: { title: 'Diomedes Díaz', resourceId: { channelId: CANAL }, thumbnails: {} } }] });
        if(f === 'videos') return J({ items: (u.searchParams.get('id') || '').split(',').map(id => ({ id, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' }, contentDetails: { duration: 'PT4M' } })) });
        return J({ items: [] });
      }
      return r.abort();
    });
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://prueba.supabase.co', key: 'x'.repeat(30) })); localStorage.setItem('vito_auto_play', JSON.stringify({ on: true })); }catch(e){}
      window.__yt = { cargados: [] };
      window.YT = { Player: class {
        constructor(id, o){ this.o = o; this.st = -1; this.id = id; const el = document.getElementById(id); if(el){ const f = document.createElement('iframe'); f.id = id; f.className = 'fake-yt'; el.replaceWith(f); }
          if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 30); }
        loadVideoById(v){ this.vid = v; this.st = 1; if(this.id === 'ytPlayer') window.__yt.cargados.push(v); setTimeout(() => this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }), 30); }
        pauseVideo(){ this.st = 2; } playVideo(){ this.st = 1; } stopVideo(){ this.st = 5; } mute(){}
        getPlayerState(){ return this.st; } getCurrentTime(){ return 42; } getDuration(){ return 240; }
      } };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar YT'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; saveData(); try{ applyMusicOn && applyMusicOn(); }catch(e){} });
    return { ctx, p };
  }
  const caja = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if(!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
  try{
    // ===== Computador =====
    const { p } = await abrir({ width: 1440, height: 900 });
    await p.evaluate(() => window.vitoPanel.abrir());
    await p.waitForSelector('#ypOv.show .yp');
    const yp = await caja(p, '#ypOv .yp'), nav = await caja(p, '#ypOv .yp-nav'), cu = await caja(p, '#ypCuerpo'), lado = await caja(p, '#ypOv .yp-lado');
    chk('1. Ocupa casi toda la pantalla (como una ventana nueva)', yp.w >= 1380 && yp.h >= 850, yp);
    chk('1. Secciones a la izquierda, contenido al centro y lo que suena a la derecha', nav.x < cu.x && cu.x < lado.x && cu.w >= 600 && lado.w >= 340, { nav, cu, lado });
    chk('1. Buscador arriba, en la barra (como YouTube)', await p.evaluate(() => !!document.querySelector('#ypOv .yp-head #ypQ')));
    chk('1. Abre en «🏠 Inicio» con géneros para buscar rápido', await p.evaluate(() => document.querySelector('#ypOv [data-yp-tab="inicio"]').classList.contains('on') && /Vallenato/.test(document.getElementById('ypCuerpo').textContent)));
    chk('1. Las 6 secciones: Inicio, Buscar, En cola, Mis canciones, Mis listas, Mi YouTube', await p.$$eval('#ypOv .yp-nav button', b => b.map(x => x.textContent.trim()).join('|')).then(t => /Inicio\|.*Buscar\|.*En cola.*\|.*Mis canciones\|.*Mis listas\|.*Mi YouTube/.test(t)));

    // 2. Buscar
    await p.click('#ypOv .yp-chip >> text=Salsa');
    await p.waitForSelector('#ypRes .yp-card');
    if(process.env.DBG) console.log(await p.evaluate(() => { const c = document.querySelector('#ypRes .yp-card'); const f = e => { const r = e.getBoundingClientRect(); return [e.className || e.id, Math.round(r.width), getComputedStyle(e).display]; }; const out = []; let e = c.querySelector('.yp-th'); while(e && e !== document.body){ out.push(f(e)); e = e.parentElement; } return JSON.stringify(out); }));
    const cards = await p.evaluate(() => [...document.querySelectorAll('#ypRes .yp-card')].map(c => ({ t: c.querySelector('b').textContent, dur: (c.querySelector('.yp-dur') || {}).textContent, w: Math.round(c.querySelector('.yp-th').getBoundingClientRect().width) })));
    chk('2. Un género busca y muestra tarjetas grandes con portada y duración', cards.length === 8 && cards[0].t === 'Salsa clásica 1' && cards[0].dur === '4:00' && cards[0].w >= 200, cards.slice(0, 2));
    chk('2. Varias tarjetas por fila (bien distribuido)', await p.evaluate(() => { const c = [...document.querySelectorAll('#ypRes .yp-card')]; return c[0].getBoundingClientRect().top === c[1].getBoundingClientRect().top && c[0].getBoundingClientRect().top === c[2].getBoundingClientRect().top; }));
    await p.click('#ypRes .yp-card:nth-child(1) .yp-th');
    chk('2. Tocar la portada = «Que siga» (suena)', await p.waitForFunction(() => window.__yt.cargados.includes('salsa0xxxxx'), null, { timeout: 8000 }).then(() => true, () => false), await p.evaluate(() => window.__yt.cargados));
    await p.waitForTimeout(1300);
    const vis = await p.evaluate(() => { const b = document.getElementById('ytBox'), v = document.getElementById('ypVideo').getBoundingClientRect(), r = b.getBoundingClientRect(); return { cls: b.className, dx: Math.abs(r.left - v.left), dy: Math.abs(r.top - v.top), w: Math.round(r.width) }; });
    chk('2. El video se ve grande en la columna derecha', /yt-visible/.test(vis.cls) && vis.dx < 2 && vis.dy < 2 && vis.w >= 330, vis);
    await p.click('#ypRes .yp-card:nth-child(2) .btn-ghost'); await p.click('#ypRes .yp-card:nth-child(3) .btn-ghost');
    await p.waitForTimeout(1200);
    chk('2. «A continuación» muestra lo que sigue', /Salsa clásica 2/.test(await p.textContent('#ypSigue')) && /Salsa clásica 3/.test(await p.textContent('#ypSigue')), await p.textContent('#ypSigue'));
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/ventana-pc-buscar.png' });

    // 3. Mis canciones
    await p.click('#ypRes .yp-card:nth-child(4) .yp-cor'); await p.click('#ypRes .yp-card:nth-child(5) .yp-cor');
    chk('3. 🤍 guarda en Mis canciones (en los datos del negocio: llega a los otros equipos)', await p.evaluate(() => (data.mzFavs || []).map(x => x.title).join('|')) === 'Salsa clásica 5|Salsa clásica 4');
    chk('3. … y el corazón queda ❤️', await p.evaluate(() => document.querySelector('#ypRes .yp-card:nth-child(4) .yp-cor').textContent === '❤️'));
    await p.click('#ypCor');
    chk('3. ❤️ también en la que está sonando', await p.evaluate(() => (data.mzFavs || []).some(x => x.vid === 'salsa0xxxxx')) && (await p.textContent('#ypCor')) === '❤️');
    await p.click('#ypOv [data-yp-tab="canciones"]');
    chk('3. «❤️ Mis canciones» las muestra', await p.evaluate(() => /Mis canciones \(3\)/.test(document.getElementById('ypCuerpo').textContent) && document.querySelectorAll('#ypCuerpo .yp-card').length >= 3));
    const antes = await p.evaluate(() => window.vitoMusica.orden().length);
    await p.click('#ypCuerpo .yp-sec >> text=▶ Poner todas');
    chk('3. «▶ Poner todas» las manda a la cola (sin repetir las que ya están)', await p.evaluate(() => window.vitoMusica.orden().length) === antes + 2, [antes, await p.evaluate(() => window.vitoMusica.orden().map(x => x.title))]);
    await p.evaluate(() => { window.__yt.main.st = 0; window.__yt.main.o.events.onStateChange({ data: 0 }); }); await p.waitForTimeout(1500);
    await p.click('#ypOv [data-yp-tab="inicio"]');
    chk('3. En «Inicio» salen «Mis canciones» y «Sonaron hace poco»', await p.evaluate(() => { const t = document.getElementById('ypCuerpo').textContent; return /Mis canciones/.test(t) && /Sonaron hace poco/.test(t) && /Salsa clásica 1/.test(t); }));

    // 4. Ver una lista y poner UNA canción
    await p.evaluate(() => { data.mzListas = [{ id: 'PLmilista000000000000001', nombre: 'Mi lista del bar', n: 5 }]; saveData(); });
    await p.click('#ypOv [data-yp-tab="listas"]');
    await p.evaluate(() => { const f = [...document.querySelectorAll('#ypCuerpo .yp-fila')].find(x => /Mi lista del bar/.test(x.textContent)); [...f.querySelectorAll('button')].find(b => /Ver/.test(b.textContent)).click(); });
    await p.waitForSelector('#ypCuerpo .yp-card');
    chk('4. «👁 Ver» muestra las canciones de la lista', await p.evaluate(() => document.querySelectorAll('#ypCuerpo .yp-card').length === 5 && /Canción de lista 1/.test(document.getElementById('ypCuerpo').textContent)));
    await p.click('#ypCuerpo .yp-card:nth-child(3) .btn-ghost');
    chk('4. … y se pone UNA sola en la cola', await p.evaluate(() => window.vitoMusica.orden().some(x => x.title === 'Canción de lista 3') && !window.vitoMusica.orden().some(x => x.title === 'Canción de lista 2')));
    await p.click('#ypCuerpo .yp-sec >> text=← Volver');
    chk('4. «← Volver» regresa a Mis listas', await p.evaluate(() => /Mis listas guardadas/.test(document.getElementById('ypCuerpo').textContent)));

    // 5. Mi YouTube
    await p.click('#ypOv [data-yp-tab="mio"]');
    chk('5. Sin Google: ofrece conectar la cuenta y explica qué se ve', /Conectar mi cuenta de YouTube/.test(await p.textContent('#ypCuerpo')) && /videos que te gustan/.test(await p.textContent('#ypCuerpo')));
    await p.evaluate(() => { localStorage.setItem('vito_ytok', JSON.stringify({ t: 'token-prueba', exp: Date.now() + 3600e3 })); });
    await p.click('#ypOv [data-yp-tab="inicio"]'); await p.click('#ypOv [data-yp-tab="mio"]');
    await p.waitForFunction(() => /Diomedes Díaz/.test(document.getElementById('ypCuerpo').textContent) && /La Rebelión/.test(document.getElementById('ypCuerpo').textContent), null, { timeout: 8000 }).catch(() => {});
    const mio = await p.textContent('#ypCuerpo');
    chk('5. Con Google: mis listas, «Me gusta», mis videos y suscripciones', /Mi lista del bar/.test(mio) && /Me gusta: La Rebelión/.test(mio) && /Ver mis videos/.test(mio) && /Diomedes Díaz/.test(mio) && /Bar de Ana/.test(mio), mio.slice(0, 400));
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/ventana-pc-mio.png' });
    await p.click('#ypCuerpo .yp-sch');
    await p.waitForSelector('#ypCuerpo .yp-card');
    chk('5. Tocar un canal suscrito muestra sus videos', /Diomedes en vivo 1/.test(await p.textContent('#ypCuerpo')));
    await p.click('#ypCerrar');

    // ===== Celular =====
    const C = (await abrir({ width: 390, height: 844 })).p;
    await C.evaluate(() => window.vitoPanel.abrir());
    await C.waitForSelector('#ypOv.show .yp');
    const ycel = await caja(C, '#ypOv .yp');
    chk('6. Celular: pantalla completa', ycel.x === 0 && ycel.w === 390 && ycel.h >= 840, ycel);
    chk('6. Las secciones son pestañas en una fila', await C.evaluate(() => { const b = [...document.querySelectorAll('#ypOv .yp-nav button')]; return b[0].getBoundingClientRect().top === b[1].getBoundingClientRect().top; }));
    await C.fill('#ypQ', 'salsa'); await C.click('#ypBuscarF button');
    await C.waitForSelector('#ypRes .yp-card');
    await C.click('#ypRes .yp-card:nth-child(1) .btn-primary');
    await C.waitForFunction(() => window.__yt.cargados.length > 0, null, { timeout: 8000 }).catch(() => {});
    await C.waitForTimeout(1300);
    const cu2 = await caja(C, '#ypCuerpo');
    chk('6. Queda buen espacio para los resultados (más de 40% de la pantalla)', cu2.h >= 340, cu2);
    chk('6. Nada se sale de la pantalla (sin scroll de lado)', await C.evaluate(() => { const y = document.querySelector('#ypOv .yp'); return y.scrollWidth <= y.clientWidth + 1 && document.getElementById('ypCuerpo').scrollWidth <= document.getElementById('ypCuerpo').clientWidth + 1; }));
    chk('6. Resultados en lista (portada a la izquierda)', await C.evaluate(() => { const c = document.querySelector('#ypRes .yp-card'), t = c.querySelector('.yp-th').getBoundingClientRect(), x = c.querySelector('.yp-txt').getBoundingClientRect(); return x.left > t.right - 1; }));
    const v2 = await C.evaluate(() => { const b = document.getElementById('ytBox'), v = document.getElementById('ypVideo').getBoundingClientRect(), r = b.getBoundingClientRect(); return { cls: b.className, dy: Math.abs(r.top - v.top), w: Math.round(r.width), vw: Math.round(v.width) }; });
    chk('6. El video está en su recuadro arriba', /yt-visible/.test(v2.cls) && v2.dy < 2 && Math.abs(v2.w - v2.vw) < 2 && v2.w >= 360, v2);
    await C.evaluate(() => document.getElementById('ypCuerpo').scrollTop = 400); await C.waitForTimeout(200);
    const v3 = await C.evaluate(() => { const b = document.getElementById('ytBox'), v = document.getElementById('ypVideo').getBoundingClientRect(), r = b.getBoundingClientRect(); return Math.abs(r.top - v.top); });
    chk('6. Al bajar en los resultados el video no se mueve de su sitio', v3 < 2, v3);
    if(process.env.SHOTS) await C.screenshot({ path: process.env.SHOTS + '/ventana-cel.png' });
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
