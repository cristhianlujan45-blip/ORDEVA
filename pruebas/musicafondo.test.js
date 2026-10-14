// Música sola con Vento minimizada (app de Android). El reproductor de YouTube y el servidor se simulan.
//  1. En la app de Android la música automática arranca sin tocar la pantalla (Android deja sonar sola).
//  2. Prender «Música automática» deja a Vento trabajando de fondo (servicio con aviso fijo).
//  3. Minimizada: si el celular frena el video, el latido del servicio le da play otra vez.
//  4. Minimizada: al terminar una canción pone la siguiente sola (también si el aviso de «terminó» no llegó).
//  5. Minimizada: una canción que tarda en arrancar NO se descarta como mala (antes se perdían canciones buenas).
//  6. Pausa hecha por la persona (con Vento al frente): el latido NO la vuelve a prender.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const video = (id, t, c, d) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: c }, duracion: d });
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url()), J = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if(u.hostname === 'localhost') return r.continue();
      if(/\/vento-ia\/yt\/buscar$/.test(u.pathname)){ const q = (u.searchParams.get('q') || '').toLowerCase().replace(/\W+/g, '').slice(0, 9); return J({ items: [video((q + '00000000000').slice(0, 11), u.searchParams.get('q'), 'Artista', 200)] }); }
      if(u.hostname === 'www.googleapis.com' && /\/videos$/.test(u.pathname)) return J({ items: (u.searchParams.get('id') || '').split(',').map(id => ({ id, snippet: { title: id }, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' }, contentDetails: { duration: 'PT3M20S' } })) });
      return r.abort();
    });
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://prueba.supabase.co', key: 'x'.repeat(30) })); localStorage.setItem('vito_auto_play', JSON.stringify({ on: true })); }catch(e){}
      window.__fondo = false; window.__fondoLlamadas = [];
      window.VentoAndroid = { info: () => '{}', notificar(){ return true; }, avisosEstado: () => '{"prendidos":true}', fondo: () => window.__fondo, fondoActivar: v => { window.__fondo = !!v; window.__fondoLlamadas.push(!!v); }, ajustesBateria(){}, permisos: () => '{}' };
      window.__yt = { cargados: [], play: 0 };
      window.YT = { Player: class {
        constructor(id, o){ this.o = o; this.st = -1; this.id = id; const el = document.getElementById(id); if(el){ const f = document.createElement('iframe'); f.id = id; el.replaceWith(f); }
          if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 30); }
        loadVideoById(v){ this.vid = v; if(this.id === 'ytPlayer') window.__yt.cargados.push(v); if(window.__atascar && this.id === 'ytPlayer'){ this.st = 5; return; } this.st = 1; setTimeout(() => this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }), 30); }
        pauseVideo(){ this.st = 2; } playVideo(){ this.st = 1; if(this.id === 'ytPlayer') window.__yt.play++; } stopVideo(){ this.st = 5; } mute(){}
        getPlayerState(){ return this.st; } getCurrentTime(){ return 30; } getDuration(){ return 200; }
      } };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Fondo'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123');
    await p.evaluate(() => document.getElementById('authBtn').click());      // sin «toque» real de la persona en la página
    await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; for(let i = 1; i <= 3; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData(); });
    const main = f => p.evaluate(f);
    // 1.
    await p.evaluate(() => { window.vitoAddSong(1, 'Karol G Provenza'); window.vitoAddSong(2, 'Feid Luna'); window.vitoAddSong(3, 'Bad Bunny Tití'); });
    chk('1. En la app de Android la música arranca sola, sin tocar la pantalla', await p.waitForFunction(() => window.__yt.cargados.length >= 1, null, { timeout: 15000 }).then(() => true, () => false), await main(() => window.__yt.cargados));
    // 2.
    await p.evaluate(() => { const a = document.getElementById('autoPlay'); a.checked = false; a.dispatchEvent(new Event('change')); a.checked = true; a.dispatchEvent(new Event('change')); });
    chk('2. Prender «Música automática» deja a Vento trabajando de fondo', await main(() => window.__fondo === true && window.__fondoLlamadas.includes(true)));
    await p.waitForFunction(() => window.__yt.main && window.__yt.main.st === 1, null, { timeout: 10000 }).catch(() => {});
    const primera = await main(() => window.__yt.cargados.slice(-1)[0]);
    // 3.
    await p.evaluate(() => { window.__ventoAlFrente = false; const m = window.__yt.main; m.st = 2; m.o.events.onStateChange({ data: 2 }); window.__yt.play = 0; window.ventoLatido(); });
    chk('3. Minimizada: el celular frenó el video → el latido le da play', await main(() => window.__yt.main.st === 1 && window.__yt.play === 1));
    // 4.
    await p.evaluate(() => { const m = window.__yt.main; m.st = 0; m.o.events.onStateChange({ data: 0 }); });
    chk('4. Minimizada: al terminar pone la siguiente sola', await p.waitForFunction(v => window.__yt.cargados.slice(-1)[0] !== v, primera, { timeout: 8000 }).then(() => true, () => false), await main(() => window.__yt.cargados));
    const segunda = await main(() => window.__yt.cargados.slice(-1)[0]);
    await p.evaluate(() => { window.__yt.main.st = 0; window.ventoLatido(); });   // terminó pero el aviso no llegó
    chk('4. …y aunque el aviso de «terminó» no llegue, el latido pone la siguiente', await p.waitForFunction(v => window.__yt.cargados.slice(-1)[0] !== v, segunda, { timeout: 8000 }).then(() => true, () => false), await main(() => window.__yt.cargados));
    // 5.
    const malosAntes = await main(() => JSON.stringify(localStorage).length);
    await p.evaluate(() => { window.__atascar = true; window.vitoAddSong(1, 'Shakira Acróstico'); const m = window.__yt.main; m.st = 0; m.o.events.onStateChange({ data: 0 }); });
    await p.waitForTimeout(11000);
    const n5 = await main(() => ({ cargados: window.__yt.cargados, play: window.__yt.play, st: window.__yt.main.st }));
    chk('5. Minimizada: si tarda en arrancar le da play, no la descarta (sigue la misma canción)', n5.play >= 1 && n5.cargados.filter(v => /^shakira/.test(v)).length === 1 && /^shakira/.test(n5.cargados.slice(-1)[0]) && n5.st === 1, n5);
    await p.evaluate(() => { window.__atascar = false; });
    // 6.
    await p.evaluate(() => { window.__ventoAlFrente = true; const m = window.__yt.main; m.st = 1; m.o.events.onStateChange({ data: 1 }); m.st = 2; m.o.events.onStateChange({ data: 2 }); window.__yt.play = 0; window.ventoLatido(); });
    chk('6. Pausa hecha por la persona (Vento al frente): el latido no la prende', await main(() => window.__yt.main.st === 2 && window.__yt.play === 0));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
