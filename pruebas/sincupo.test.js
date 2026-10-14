// Música por QR SIN el límite de YouTube.
// Con Google conectado, cada canción se metía en la lista de YouTube Music gastando el cupo diario de Google (compartido
// por todos los negocios de Vento). Al acabarse salía «YouTube no deja agregar más canciones…» y la música se detenía.
//  1. Google responde «quotaExceeded» → la música NO se detiene: la canción sigue en la cola y suena con el reproductor de
//     Vento (se prende solo), con un aviso claro.
//  2. Ya no se vuelve a gastar el cupo ese día (las siguientes canciones no llaman a Google) y siguen sonando una tras otra.
//  3. Al día siguiente (pasado el reinicio del cupo) vuelve a usar la lista de YouTube Music.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const video = (id, t) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: 'Artista', thumbnails: {} }, duracion: 200 });

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const inserts = []; let cupo = false;
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url()), J = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if(u.hostname === 'localhost') return r.continue();
      if(/\/vento-ia\/yt\/buscar$/.test(u.pathname)){ const q = u.searchParams.get('q') || ''; const id = (q.replace(/\W/g, '') + 'xxxxxxxxxxx').slice(0, 11); return J({ items: [video(id, q)] }); }
      if(u.hostname === 'www.googleapis.com'){
        if(/playlistItems$/.test(u.pathname) && r.request().method() === 'POST'){ inserts.push(Date.now()); return cupo ? J({ error: { code: 403, message: 'The request cannot be completed because you have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>.', errors: [{ reason: 'quotaExceeded' }] } }, 403) : J({ id: 'item' + inserts.length }); }
        if(/\/videos$/.test(u.pathname)) return J({ items: (u.searchParams.get('id') || '').split(',').map(id => ({ id, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' }, contentDetails: { duration: 'PT3M20S' } })) });
        if(/\/playlists$/.test(u.pathname)) return J({ id: 'PLbar' });
        return J({ items: [] });
      }
      return r.abort();
    });
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://prueba.supabase.co', key: 'x'.repeat(30) }));
        localStorage.setItem('vito_ytok', JSON.stringify({ t: 'token', exp: Date.now() + 3600e3 })); localStorage.setItem('vito_yt', JSON.stringify({ pl: 'PLbar', on: true })); }catch(e){}
      window.__yt = { cargados: [] };
      window.YT = { Player: class { constructor(id, o){ this.o = o; this.id = id; this.st = -1; if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 20); }
        loadVideoById(v){ this.st = 1; if(this.id === 'ytPlayer') window.__yt.cargados.push(v); setTimeout(() => this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }), 20); }
        pauseVideo(){} playVideo(){} stopVideo(){ this.st = 5; } mute(){} getPlayerState(){ return this.st; } getCurrentTime(){ return 10; } getDuration(){ return 200; }
        terminar(){ this.st = 0; this.o.events.onStateChange({ data: 0 }); } } };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar QR'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; for(let i = 1; i <= 3; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData();
      window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); }; });
    await p.mouse.click(5, 300);   // primer toque (el navegador no deja sonar hasta tocar la pantalla)

    // Con cupo: la canción entra a la lista de YouTube Music (como antes)
    await p.evaluate(() => window.vitoAddSong(1, 'Primera cancion'));
    await p.waitForFunction(() => window.vitoMusica.cola().some(x => x.status === 'lista'), null, { timeout: 8000 }).catch(() => {});
    chk('0. Con cupo: la canción entra a la lista de YouTube Music (como siempre)', inserts.length === 1 && await p.evaluate(() => window.vitoMusica.cola().some(x => x.status === 'lista')), inserts.length);

    // 1. Se acaba el cupo
    cupo = true;
    await p.evaluate(() => window.vitoAddSong(2, 'Segunda cancion'));
    await p.waitForFunction(() => window.vitoSinLimite.activo(), null, { timeout: 8000 }).catch(() => {});
    chk('1. Google dice «quotaExceeded» → Vento deja de usar ese cupo hasta mañana', await p.evaluate(() => window.vitoSinLimite.activo()));
    chk('1. Aviso claro: «la música NO se detiene»', await p.evaluate(() => window.__toasts.some(t => /NO se detiene/.test(t))) && !(await p.evaluate(() => window.__toasts.some(t => /no deja agregar más canciones/.test(t)))));
    chk('1. Se prendió solo el reproductor de Vento', await p.evaluate(() => !!JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on));
    chk('1. La canción del QR suena (no se perdió)', await p.waitForFunction(() => window.__yt.cargados.length >= 1, null, { timeout: 10000 }).then(() => true, () => false), await p.evaluate(() => [window.__yt.cargados, window.vitoMusica.cola().map(x => [x.song, x.status])]));

    // 2. Más canciones: sin llamar a Google y una tras otra
    const antes = inserts.length;
    await p.evaluate(() => { window.vitoAddSong(3, 'Tercera cancion'); window.vitoAddSong(1, 'Cuarta cancion'); });
    await p.waitForTimeout(2500);
    chk('2. Las siguientes canciones ya no gastan el cupo de Google', inserts.length === antes, inserts.length - antes);
    await p.evaluate(() => window.__yt.main.terminar()); await p.waitForTimeout(1500);
    await p.evaluate(() => window.__yt.main.terminar()); await p.waitForTimeout(1500);
    const sonaron = await p.evaluate(() => window.__yt.cargados.length);
    chk('2. Siguen sonando solas, una tras otra', sonaron >= 3, await p.evaluate(() => window.__yt.cargados));
    const n = await p.evaluate(() => window.__toasts.filter(t => /NO se detiene/.test(t)).length);
    chk('2. El aviso sale una sola vez', n === 1, n);

    // 3. Al día siguiente vuelve a la lista
    cupo = false;
    await p.evaluate(() => { localStorage.setItem('vito_yt_sincupo', JSON.stringify(Date.now() - 1000)); window.__yt.main.stopVideo(); });
    await p.evaluate(() => window.__yt.main.terminar()); await p.waitForTimeout(800);
    await p.evaluate(() => window.vitoAddSong(2, 'Quinta cancion'));
    await p.waitForTimeout(2500);
    chk('3. Pasado el reinicio del cupo vuelve a usar la lista de YouTube Music', inserts.length === antes + 1, inserts.length - antes);
    chk('3. … y el reproductor que había prendido Vento por el cupo se apaga solo', await p.evaluate(() => !JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
