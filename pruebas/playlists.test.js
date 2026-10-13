// Música → «📃 Mis playlists de YouTube»: poner tu propia playlist como música de fondo, fácil.
// YouTube se simula con páginas del formato NUEVO (lockupViewModel, datos en <script id="yt-initial-data">) y pasan por el
// módulo de verdad del Servidor Vento (supabase/functions/vento-ia/youtube.ts).
//  1. youtube.ts: busca playlists por nombre y lee una playlist completa (primera página + «continuación»).
//  2. App: escribir «salsa baul» → 🔎 Buscar → resultados con «▶ Poner» → suena de fondo; queda guardada en el negocio.
//  3. La canción que pide una mesa va PRIMERO; la playlist sigue después. Entran de a 2 (no las 30 de una).
//  4. Pegar el link de YouTube Music (music.youtube.com/playlist?list=…) la pone directo.
//  5. Si el servidor no responde, se lee con la API de YouTube (1 unidad por cada 50 canciones).
//  6. «⏹ Quitar» saca las de fondo que no han sonado; lo de las mesas queda.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

const vid = n => ('vid' + String(n).padStart(8, '0')).slice(0, 11);
const lockVideo = n => ({ lockupViewModel: { contentId: vid(n), contentType: 'LOCKUP_CONTENT_TYPE_VIDEO', contentImage: { thumbnailViewModel: { image: { sources: [{ url: 'https://i.ytimg.com/vi/' + vid(n) + '/hq.jpg' }] }, overlays: [{ thumbnailBottomOverlayViewModel: { badges: [{ thumbnailBadgeViewModel: { text: '3:' + String(10 + (n % 50)).padStart(2, '0') } }] } }] } },
  metadata: { lockupMetadataViewModel: { title: { content: 'Salsa ' + n }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: 'Orquesta ' + n } }] }] } } } } } });
const lockLista = (id, t, n) => ({ lockupViewModel: { contentId: id, contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST', contentImage: { collectionThumbnailViewModel: { primaryThumbnail: { thumbnailViewModel: { image: { sources: [{ url: 'https://i.ytimg.com/vi/x/hq.jpg' }] }, overlays: [{ thumbnailOverlayBadgeViewModel: { thumbnailBadges: [{ thumbnailBadgeViewModel: { text: n + ' videos' } }] } }] } } } },
  metadata: { lockupMetadataViewModel: { title: { content: t }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: 'DJ Prueba' } }] }] } } } } } });
const cont = tok => ({ continuationItemViewModel: { continuationCommand: { innertubeCommand: { continuationCommand: { token: tok } } } } });
const html = datos => '<html><script id="yt-initial-data" type="application/json">' + JSON.stringify(datos) + '</script><script>var ytcfg={"INNERTUBE_CLIENT_VERSION":"2.20261012.01.00"};</script></html>';
const LISTA = 'PLsalsabaul0000000000000001';

(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  const YT = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', 'vento-ia', 'youtube.ts')).href);
  // youtube.com simulado: búsqueda de playlists, la playlist (20 canciones + continuación con 10 más) y la continuación.
  const traer = async (url, o) => {
    const u = new URL(url);
    if(u.pathname === '/results') return { ok: true, status: 200, text: async () => html({ contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [lockLista(LISTA, 'Salsa baúl lo mejor', 30), lockLista('PLotra000000000000000002', 'Salsa romántica', 50)] } }] } } } } }) };
    if(u.pathname === '/playlist') return { ok: true, status: 200, text: async () => html({ metadata: { playlistMetadataRenderer: { title: 'Salsa baúl lo mejor' } }, contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [{ playlistVideoListRenderer: { contents: Array.from({ length: 20 }, (_, i) => lockVideo(i + 1)).concat([cont('TOKEN-PAG-2')]) } }] } }] } } } }] } } }) };
    if(u.pathname === '/youtubei/v1/browse'){ const b = JSON.parse(o.body); return { ok: b.continuation === 'TOKEN-PAG-2', status: 200, json: async () => ({ onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: Array.from({ length: 10 }, (_, i) => lockVideo(i + 21)) } }] }) }; }
    return { ok: false, status: 404, text: async () => '' };
  };
  const b = await chromium.launch();
  try{
    // ===== 1. youtube.ts =====
    const bl = await YT.buscar('salsa baul', 'lista', traer);
    chk('1. Busca playlists por nombre (formato nuevo de YouTube): nombre, canciones y canal', bl.items.length === 2 && bl.items[0].id.playlistId === LISTA && bl.items[0].snippet.title === 'Salsa baúl lo mejor' && bl.items[0].canciones === 30 && bl.items[0].snippet.channelTitle === 'DJ Prueba', bl.items[0]);
    const L = await YT.lista(LISTA, traer);
    chk('1. Lee la playlist completa: 20 de la página + 10 de la continuación, con título y duración', L.items.length === 30 && L.titulo === 'Salsa baúl lo mejor' && L.items[0].duracion === 191 && L.items[29].snippet.title === 'Salsa 30', { n: L.items.length, t: L.titulo, d: L.items[0].duracion });

    // ===== App =====
    let srvCaido = false; const api = [];
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(/supabase\.co$/.test(u.hostname) && /\/vento-ia\/yt\//.test(u.pathname)){
        if(srvCaido) return r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":{"message":"caído"}}', headers: { 'access-control-allow-origin': '*' } });
        const res = /\/yt\/lista$/.test(u.pathname) ? await YT.lista(u.searchParams.get('id'), traer) : await YT.buscar(u.searchParams.get('q'), u.searchParams.get('tipo'), traer);
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) });
      }
      if(u.hostname === 'www.googleapis.com' && /youtube\/v3\/(playlistItems|playlists)/.test(u.pathname)){
        api.push(u.pathname.split('/').pop());
        const body = /playlistItems/.test(u.pathname) ? { items: Array.from({ length: 5 }, (_, i) => ({ snippet: { title: 'Por API ' + (i + 1), videoOwnerChannelTitle: 'Canal API', resourceId: { videoId: ('api' + i + 'xxxxxxxxx').slice(0, 11) } } })) } : { items: [{ snippet: { title: 'Lista por API' } }] };
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      }
      return r.abort();
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar P'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.ytAgregar = () => {}; asisGoView('musica'); });
    await p.waitForSelector('#mzPlIn', { state: 'visible', timeout: 5000 });

    // ===== 2. Buscar y poner =====
    await p.fill('#mzPlIn', 'salsa baul'); await p.click('#mzPlBuscar');
    await p.waitForSelector('#mzPlRes .mz-song', { timeout: 8000 });
    const res = await p.textContent('#mzPlRes');
    chk('2. «🔎 Buscar» muestra las playlists con sus canciones y «▶ Poner»', /Salsa baúl lo mejor/.test(res) && /30 canciones/.test(res) && /▶ Poner/.test(res), res);
    await p.click('#mzPlRes .mz-song >> nth=0 >> text=▶ Poner');
    const puesta = await p.waitForFunction(() => { const f = JSON.parse(localStorage.getItem(window.ventoClave('vito_fondo')) || '{}'); return f.on && f.vids && f.vids.length === 30; }, null, { timeout: 8000 }).then(() => true, () => false);
    const q1 = await p.evaluate(() => window.vitoMusica.cola().filter(x => !x.done));
    chk('2. «▶ Poner» → suena de fondo con sus 30 canciones (entran a la cola de a 2, con su video)', puesta && q1.length === 2 && q1.every(x => x.fondo && x.vid && x.mesaNombre === 'Salsa baúl lo mejor'), q1.map(x => [x.song, x.vid, x.fondo]));
    chk('2. Arriba dice «De fondo: «Salsa baúl lo mejor»» con «⏹ Quitar»', /De fondo: «Salsa baúl lo mejor»/.test(await p.textContent('#mzPlAhora')) && await p.isVisible('#mzPlAhora'));
    chk('2. Queda guardada en tus playlists (datos del negocio: llega a los demás celulares)', await p.evaluate(id => (data.mzListas || []).some(x => x.id === id && x.n === 30), LISTA) && /Salsa baúl lo mejor/.test(await p.textContent('#mzPlLista')));
    chk('2. En la cola sale como «🎶 Salsa baúl lo mejor» (no como una mesa)', /🎶 Salsa baúl lo mejor/.test(await p.textContent('#mzList')));

    // ===== 3. Una mesa pide =====
    await p.evaluate(() => window.vitoAddSong(3, 'Cancion de la mesa tres'));
    const orden = await p.evaluate(() => window.vitoMusica.orden().map(x => x.fondo ? 'fondo' : 'mesa' + x.mesa));
    chk('3. Lo que pide una mesa va PRIMERO, después sigue la playlist', orden[0] === 'mesa3' && orden.slice(1).every(x => x === 'fondo'), orden);
    await p.evaluate(() => { const l = window.vitoMusica.cola(); l.filter(x => x.fondo && !x.done).forEach(x => window.vitoMusica.terminar(x.id, 'played')); window.vitoMusica.fondo.rellenar(); });
    const q2 = await p.evaluate(() => { const f = JSON.parse(localStorage.getItem(window.ventoClave('vito_fondo'))); return { pend: window.vitoMusica.cola().filter(x => x.fondo && !x.done).map(x => x.song), pos: f.pos }; });
    chk('3. Cuando suenan, entran las siguientes 2 de la playlist (en orden)', q2.pend.length === 2 && q2.pend[0] === 'Salsa 3' && q2.pend[1] === 'Salsa 4' && q2.pos === 4, q2);

    // ===== 4. Pegar el link =====
    await p.fill('#mzPlIn', 'https://music.youtube.com/playlist?list=' + LISTA + '&si=abc123'); await p.click('#mzPlBuscar');
    const directo = await p.waitForFunction(() => /De fondo/.test(document.getElementById('mzPlAhora').textContent) && document.getElementById('mzPlIn').value === '', null, { timeout: 8000 }).then(() => true, () => false);
    chk('4. Pegar el link de YouTube Music la pone directo (y limpia el campo)', directo);
    chk('4. No se duplica en tus playlists', await p.evaluate(id => (data.mzListas || []).filter(x => x.id === id).length, LISTA) === 1);

    // ===== 5. Servidor caído → API =====
    srvCaido = true;
    await p.evaluate(() => window.vitoMusica.fondo.poner('PLporapi00000000000000003', 'X', null));
    const porApi = await p.evaluate(() => { const f = JSON.parse(localStorage.getItem(window.ventoClave('vito_fondo'))); return { on: f.on, n: f.vids.length, nombre: f.nombre }; });
    chk('5. Sin servidor, la playlist se lee con la API de YouTube (barata: 1 unidad por cada 50)', porApi.on && porApi.n === 5 && porApi.nombre === 'Lista por API' && api.includes('playlistItems'), { porApi, api });
    chk('5. Al poner otra playlist, las de la anterior que no habían sonado salen de la cola', await p.evaluate(() => window.vitoMusica.cola().filter(x => x.fondo && !x.done).every(x => x.mesaNombre === 'Lista por API')));

    // ===== 6. Quitar =====
    await p.click('#mzPlAhora button');
    const fin = await p.evaluate(() => ({ fondo: window.vitoMusica.cola().filter(x => x.fondo && !x.done).length, mesa: window.vitoMusica.cola().filter(x => !x.fondo && !x.done).length, on: JSON.parse(localStorage.getItem(window.ventoClave('vito_fondo'))).on }));
    chk('6. «⏹ Quitar» saca las de fondo pendientes y deja lo de las mesas', fin.fondo === 0 && fin.mesa === 1 && fin.on === false, fin);
    await p.waitForTimeout(8500);
    chk('6. … y no vuelven a entrar solas', await p.evaluate(() => window.vitoMusica.cola().filter(x => x.fondo && !x.done).length) === 0);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
