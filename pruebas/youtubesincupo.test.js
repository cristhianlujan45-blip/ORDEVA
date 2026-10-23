// Buscar canciones en YouTube aunque la API de YouTube esté SIN CUPO («se alcanzó el límite»).
// El Servidor ORDEVA (vento-ia/yt/buscar → supabase/functions/vento-ia/youtube.ts, el módulo de verdad) lee la página
// pública de resultados de youtube.com; aquí youtube.com se simula con una página de resultados con la misma forma.
//  1. youtube.ts entiende la página (videos con duración, canales con su foto) y no se confunde con «}» o comillas
//     dentro de los títulos.
//  2. QR de la mesa (pedido.html): con la API respondiendo «quotaExceeded», al escribir una canción salen los artistas y
//     las canciones; al tocar un artista salen sus canciones. La búsqueda de la API (100 unidades) ya no se usa.
//  3. App: la canción pedida se encuentra (video para el TV) con la API sin cupo, sin aviso de «cupo del día».
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

const v = (id, t, c, d) => ({ videoRenderer: { videoId: id, title: { runs: [{ text: t }] }, ownerText: { runs: [{ text: c }] }, lengthText: { simpleText: d }, thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/' + id + '/hq.jpg' }] } } });
const ch = (id, t) => ({ channelRenderer: { channelId: id, title: { simpleText: t }, thumbnail: { thumbnails: [{ url: '//yt3.ggpht.com/' + id + '=s88' }] } } });
function pagina(items){
  const datos = { contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: items } }] } } } } };
  return '<html><head><script>var x = "}{";</script></head><body><script nonce="a">var ytInitialData = ' + JSON.stringify(datos) + ';</script><script>var otra = {"a":1};</script></body></html>';
}
const VIDEOS = [v('tbneQDc2H3I', 'KAROL G, Nicki Minaj - Tusa (Official Video)', 'KAROL G', '3:24'), v('F1vVR51ZINs', 'Tusa "en vivo" {remix}', 'Fans', '1:03:15'), v('m7Vu7e9Deh0', 'Tusa \\ Viña', 'Festival', '4:35')];
const CANALES = [ch('UCkarolg000000000000000a', 'KAROL G'), ch('UCkarolgtopic00000000000', 'KAROL G - Topic')];

(async () => {
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  const YT = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', 'vento-ia', 'youtube.ts')).href);
  const b = await chromium.launch();
  try{
    // ===== 1. El lector de la página =====
    const lv = YT.leerResultados(pagina(VIDEOS.concat(CANALES)), 'video', 10);
    chk('1. Lee los 3 videos en orden, con canal y duración (3:24 → 204 s, 1:03:15 → 3795 s)', lv.length === 3 && lv[0].id.videoId === 'tbneQDc2H3I' && lv[0].snippet.channelTitle === 'KAROL G' && lv[0].duracion === 204 && lv[1].duracion === 3795, lv);
    chk('1. Títulos con «}», comillas y barras no lo confunden', lv[1].snippet.title === 'Tusa "en vivo" {remix}' && lv[2].snippet.title === 'Tusa \\ Viña', lv.map(x => x.snippet.title));
    const lc = YT.leerResultados(pagina(VIDEOS.concat(CANALES)), 'canal', 10);
    chk('1. Lee los canales con su foto (https)', lc.length === 2 && lc[0].id.channelId === 'UCkarolg000000000000000a' && /^https:\/\/yt3/.test(lc[0].snippet.thumbnails.default.url), lc);
    chk('1. Página sin resultados → lista vacía (sin error)', YT.leerResultados('<html>nada</html>', 'video').length === 0);
    // 1b. Si la página de resultados falla, se busca por el servicio interno de YouTube (también sin cupo de Google);
    //     si los dos fallan, sale lo último que se encontró para esa búsqueda.
    const datosJson = items => ({ contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: items } }] } } } } });
    const pedidos1b = [];
    let caido = false;
    const traer1b = async (url, op) => { pedidos1b.push(url); if(caido) return { ok: false, status: 503, text: async () => '', json: async () => null };
      if(/\/results\?/.test(url)) return { ok: false, status: 429, text: async () => '' };
      return { ok: true, status: 200, json: async () => datosJson(VIDEOS), text: async () => '' }; };
    let r1b = await YT.buscar('respaldo uno', 'video', traer1b);
    chk('1b. YouTube bloquea la página de resultados (429) → igual encuentra por el otro camino (sin cupo de Google)', r1b.items.length === 3 && pedidos1b.some(u => /youtubei\/v1\/search/.test(u)), pedidos1b);
    caido = true;
    let r1c = null; try{ r1c = await YT.buscar('respaldo uno', 'video', traer1b); }catch(e){ r1c = { error: e.message }; }
    chk('1b. Con YouTube caído del todo sale lo último encontrado para esa búsqueda (no queda vacío)', r1c && r1c.items && r1c.items.length === 3, r1c);

    // Simulación: youtube.com (página de resultados) y la API de YouTube SIN CUPO.
    const usos = { api: [], yt: [] };
    const traer = async (url) => { usos.yt.push(url); const u = new URL(url); const canal = u.searchParams.get('sp') === 'EgIQAg=='; return { ok: true, status: 200, text: async () => pagina(canal ? CANALES : VIDEOS) }; };
    const enrutar = async ctx => ctx.route('**/*', async r => {
      const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(/supabase\.co$/.test(u.hostname) && /\/functions\/v1\/vento-ia\/yt\/buscar$/.test(u.pathname)){
        const res = await YT.buscar(u.searchParams.get('q'), u.searchParams.get('tipo') === 'canal' ? 'canal' : 'video', traer);
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) });
      }
      if(u.hostname === 'www.googleapis.com' && /youtube\/v3/.test(u.pathname)){
        usos.api.push(u.pathname.split('/').pop());
        return r.fulfill({ status: 403, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: { code: 403, message: 'The request cannot be completed because you have exceeded your quota.', errors: [{ reason: 'quotaExceeded' }] } }) });
      }
      if(u.hostname === 'ntfy.sh') return r.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } });
      if(/ytimg|ggpht/.test(u.hostname)) return r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') });
      return r.abort();
    });

    // ===== 2. QR de la mesa =====
    const c1 = await b.newContext({ viewport: { width: 390, height: 844 } }); await enrutar(c1);
    const c = await c1.newPage(); c.on('pageerror', e => errs.push('pedido: ' + e.message));
    await c.goto(BASE + '/pedido.html?mesa=3&c=mesorapruebaytcupo'); await c.waitForTimeout(1000);
    await c.click('#tc'); await c.fill('#s', 'karol g tusa');
    const vio = await c.waitForFunction(() => { const x = document.getElementById('ytPrev'); return x && !x.hidden && x.querySelectorAll('.ytrow').length >= 3 && x.querySelectorAll('.ytartist').length >= 2; }, null, { timeout: 8000 }).then(() => true, () => false);
    const txt = await c.textContent('#ytPrev');
    chk('2. QR: con la API sin cupo igual salen artistas y canciones', vio && /KAROL G/.test(txt) && /Tusa/.test(txt), txt);
    chk('2. QR: ya no se gasta la búsqueda de la API (100 unidades cada una)', !usos.api.includes('search'), usos.api);
    await c.click('#ytPrev .ytartist >> nth=0');
    const canc = await c.waitForFunction(() => /Lo más pedido de KAROL G/.test(document.getElementById('ytPrev').textContent) && document.querySelectorAll('#ytPrev .ytrow').length >= 3, null, { timeout: 8000 }).then(() => true, () => false);
    chk('2. QR: al tocar el artista salen sus canciones (aunque la API no responda)', canc, await c.textContent('#ytPrev'));
    await c.click('#ytPrev .ytrow >> nth=0');
    chk('2. QR: al tocar una canción queda escrita para pedirla', /Tusa/.test(await c.inputValue('#s')));

    // ===== 3. App =====
    usos.api.length = 0;
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 } }); await enrutar(c2);
    await c2.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); localStorage.setItem('vito_yt', JSON.stringify({ key: 'AIzaClaveSinCupo000000000000000000000' })); }catch(e){} });
    const p = await c2.newPage(); p.on('pageerror', e => errs.push('app: ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Y'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    // Una mesa pide la canción por el camino de siempre (cola → buscar el video → listo para el TV).
    await p.evaluate(() => window.vitoAddSong(3, 'Karol G Tusa'));
    await p.waitForFunction(() => window.vitoMusica.cola().some(x => x.vid || x.novid), null, { timeout: 10000 }).catch(() => {});
    const r = await p.evaluate(() => { const it = window.vitoMusica.cola().find(x => /Tusa/.test(x.song)) || {}; return { vid: it.vid, fallo: window.ytFallo, dur: it.dur }; });
    chk('3. App: con la API sin cupo la canción se encuentra (video para el TV) y sin aviso de «cupo del día»', r.vid === 'tbneQDc2H3I' && !r.fallo, r);
    chk('3. App: guarda la duración real (204 s) para saber cuándo termina', r.dur === 204, r);
    chk('3. App: la búsqueda de la API ya no se usa', !usos.api.includes('search'), usos.api);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
