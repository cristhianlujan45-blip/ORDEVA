// Comerciales de YouTube y canciones «bloqueadas»:
//  1. Mientras YouTube pasa un comercial el video no arranca: ya NO se marca la canción como «bloqueada por el sello»
//     (antes a los 7 s se cambiaba de versión y la buena quedaba en la lista negra). A los 12 s se le da play una vez.
//  2. Si de verdad queda quieta 60 s, se prueba otra versión, pero sin marcar la primera como mala para siempre.
//  3. Si YouTube dice que esa versión no se deja poner (error 150), sí va a la lista negra y se pone otra.
//  4. La lista negra vieja (con canciones buenas marcadas por error) se limpia una vez.
//  5. El título no repite el artista («Wiz Khalifa - Wiz Khalifa - Yiccen»).
//  6. «🚫 Sin comerciales con tu YouTube Premium»: en el panel cuando suena en este equipo, en Música y con el asistente.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const video = (id, t, c) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: c || 'Artista' }, duracion: 200 });

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url()), J = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if(u.hostname === 'localhost') return r.continue();
      if(/\/vento-ia\/yt\/buscar$/.test(u.pathname)){
        const q = (u.searchParams.get('q') || '').toLowerCase();
        if(/yiccen/.test(q)) return J({ items: [video('yiccen00001', 'Wiz Khalifa - Yiccen [Official Music Video]', 'Wiz Khalifa'), video('yiccen00002', 'Yiccen (Lyrics)', 'Wiz Khalifa')] });
        const id = (q.replace(/\W/g, '') + 'xxxxxxxxxxx').slice(0, 11), id2 = ('otra' + q.replace(/\W/g, '') + 'xxxxxxxxxxx').slice(0, 11);
        return J({ items: [video(id, 'Video de ' + q), video(id2, 'Otra versión de ' + q)] });
      }
      if(u.hostname === 'www.googleapis.com') return J({ items: [] });
      return r.abort();
    });
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://prueba.supabase.co', key: 'x'.repeat(30) }));
        if(!sessionStorage.getItem('ya')){ localStorage.setItem('vito_yt_bad', JSON.stringify(['buenamarcad', 'otrabuenaxx'])); sessionStorage.setItem('ya', '1'); } }catch(e){}
      // Reproductor simulado: «conanuncio» se queda en -1 (pasando un comercial) hasta que la prueba lo suelte.
      window.__yt = { cargados: [], plays: 0 };
      window.YT = { Player: class {
        constructor(id, o){ this.o = o; this.st = -1; this.id = id; if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 30); }
        loadVideoById(v){ this.vid = v; if(this.id === 'ytPlayer') window.__yt.cargados.push(v);
          if(this.id === 'ytPlayer' && /anuncio|quieta|vetada/.test(v)){ this.st = -1; return; }
          this.st = 1; setTimeout(() => { if(this.vid === v) this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }); }, 30); }   // como el de verdad: solo avisa del video actual
        pauseVideo(){ this.st = 2; } playVideo(){ if(this.id === 'ytPlayer') window.__yt.plays++; } stopVideo(){ this.st = 5; } mute(){}
        getPlayerState(){ return this.st; } getCurrentTime(){ return 0; } getDuration(){ return 200; }
        soltar(){ this.st = 1; this.o.events.onStateChange({ data: 1 }); }
        fallar(c){ this.o.events.onError({ data: c }); }
      } };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    chk('4. La lista negra vieja se limpió (tenía canciones buenas marcadas por los comerciales)', await p.evaluate(() => JSON.parse(localStorage.getItem('vito_yt_bad') || '[]').length === 0 && localStorage.getItem('vito_yt_bad_v2') === '1'));
    await p.fill('#authBiz', 'Bar Premium'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; saveData();
      window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); }; });
    const bad = () => p.evaluate(() => JSON.parse(localStorage.getItem('vito_yt_bad') || '[]'));
    const ahora = () => p.evaluate(() => (JSON.parse(localStorage.getItem('vito_now') || 'null') || {}).vid);
    // Deja el reproductor libre (sin cola ni canción sonando) y pone UNA canción.
    const poner = async vid => { await p.evaluate(() => { window.vitoMod.SS('vito_cola', []); window.__yt.main && window.__yt.main.o.events.onStateChange({ data: 0 }); });
      await p.evaluate(v => window.vitoPanel.agregar({ vid: v, title: 'Canción ' + v, artist: 'Artista', dur: 200 }, true), vid);
      return p.waitForFunction(v => window.__yt.cargados.slice(-1)[0] === v, vid, { timeout: 10000 }).then(() => true, () => false); };

    // ===== 5. Título sin repetir el artista =====
    await p.evaluate(() => window.vitoPanel.abrir());
    await p.fill('#ypQ', 'yiccen'); await p.click('#ypBuscarF button');
    await p.waitForSelector('#ypRes .yp-card');
    await p.click('#ypRes .yp-card:nth-child(1) .btn-primary');
    await p.click('#ypRes .yp-card:nth-child(2) .btn-ghost');
    const songs = await p.evaluate(() => window.vitoMusica.cola().map(x => x.song));
    chk('5. «Wiz Khalifa - Yiccen [Official…]» del canal Wiz Khalifa: el artista no se repite', songs.includes('Wiz Khalifa - Yiccen [Official Music Video]') && !songs.some(s => /Wiz Khalifa - Wiz Khalifa/.test(s)), songs);
    chk('5. «Yiccen (Lyrics)» sin el artista en el título: sí se le pone («Wiz Khalifa - Yiccen (Lyrics)»)', songs.includes('Wiz Khalifa - Yiccen (Lyrics)'), songs);
    await p.waitForFunction(() => window.__yt.cargados.includes('yiccen00001'), null, { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(500);
    chk('6. Sonando en este equipo: el panel ofrece «🚫 ¿Salen comerciales? Usa tu YouTube Premium en el TV»', await p.isVisible('#ypSc'));
    await p.evaluate(() => window.vitoMusica.saltar && window.vitoMusica.saltar());
    await p.evaluate(() => window.vitoPanel.cerrar());

    // ===== 1. Comercial: no es «bloqueada» =====
    const plays0 = await p.evaluate(() => window.__yt.plays);
    chk('1. Empezó la canción (y YouTube está pasando un comercial: el video no arranca)', await poner('conanuncio1') && await ahora() === 'conanuncio1', await p.evaluate(() => window.__yt.cargados));
    await p.evaluate(() => { window.__ytAdelantar(8000); window.__ytVigilar(); });
    chk('1. A los 8 s ya NO la cambia ni dice «bloqueada»', await ahora() === 'conanuncio1' && !(await p.evaluate(() => window.__toasts.some(t => /bloqueada|no arrancó|no se deja/.test(t)))), await p.evaluate(() => window.__toasts));
    await p.evaluate(() => { window.__ytAdelantar(5000); window.__ytVigilar(); window.__ytVigilar(); });
    chk('1. A los 12 s le da play una sola vez (por si quedó en pausa)', await p.evaluate(() => window.__yt.plays) === plays0 + 1, await p.evaluate(p0 => window.__yt.plays - p0, plays0));
    await p.evaluate(() => { window.__ytAdelantar(20000); window.__ytVigilar(); window.__yt.main.soltar(); });
    await p.waitForTimeout(300);
    chk('1. Terminó el comercial: la MISMA canción sigue sonando y no quedó en la lista negra', await ahora() === 'conanuncio1' && !(await bad()).includes('conanuncio1'), await bad());

    // ===== 2. Quieta de verdad 60 s =====
    await poner('muyquieta01');
    await p.evaluate(() => { window.__ytAdelantar(61000); window.__ytVigilar(); });
    await p.waitForFunction(() => window.__toasts.some(t => /no arrancó; pruebo otra versión/.test(t)), null, { timeout: 8000 }).catch(() => {});
    chk('2. Quieta 60 s: prueba otra versión («no arrancó»), sin decir «bloqueada por el sello»', await p.evaluate(() => window.__toasts.some(t => /no arrancó; pruebo otra versión/.test(t)) && !window.__toasts.some(t => /sello/.test(t))), await p.evaluate(() => window.__toasts.slice(-3)));
    chk('2. … y la primera NO queda en la lista negra para siempre', !(await bad()).includes('muyquieta01'), await bad());

    // ===== 3. Error real de YouTube =====
    await p.evaluate(() => { window.__toasts.length = 0; });
    await poner('vetadasello');
    await p.evaluate(() => window.__yt.main.fallar(150));
    await p.waitForFunction(() => window.__toasts.some(t => /no se deja poner fuera de YouTube; pongo otra versión/.test(t)), null, { timeout: 8000 }).catch(() => {});
    chk('3. YouTube dice «no se deja poner aquí» (150): va a la lista negra y pone otra versión', (await bad()).includes('vetadasello') && await p.evaluate(() => window.__toasts.some(t => /no se deja poner fuera de YouTube; pongo otra versión/.test(t))), [await bad(), await p.evaluate(() => window.__toasts.slice(-3))]);

    // ===== 6. Guía «sin comerciales» =====
    await p.evaluate(() => window.vitoPanel.abrir());
    await p.waitForTimeout(400);
    if(await p.isVisible('#ypSc')) await p.click('#ypSc'); else await p.evaluate(() => window.vitoSinComerciales());
    await p.waitForSelector('#mzScOv.show');
    const g = await p.textContent('#mzScOv');
    chk('6. Explica por qué salen (YouTube necesita tu cuenta Premium en el reproductor) y ofrece el TV', /cuenta Premium iniciada/.test(g) && /siempre funciona, sin límites/.test(g) && /sin comerciales y sin límite/.test(g) && /youtube\.com/.test(g), g.slice(0, 300));
    chk('6. Botones para vincular el TV y conectar la cuenta', await p.isVisible('#mzScOv [data-sc="tv"]') && await p.isVisible('#mzScOv [data-sc="codigo"]') && await p.isVisible('#mzScOv [data-sc="cuenta"]'));
    await p.click('#mzScOv [data-sc="codigo"]');
    await p.waitForTimeout(800);
    chk('6. «🔢 Con el código del TV» lleva a Música → código del TV', await p.evaluate(() => !document.getElementById('mzScOv').classList.contains('show') && !!document.getElementById('tvOptCodigo') && document.getElementById('tvOptCodigo').open));
    chk('6. En Música está «🚫 Sin comerciales con tu YouTube Premium»', await p.evaluate(() => !!document.getElementById('mzScBtn')));
    const r = await p.evaluate(() => { const x = window.Laya.responder('por qué me salen comerciales en la música si tengo youtube premium'); return x && { t: x.text, run: typeof x.run }; });
    chk('6. Asistente: «¿por qué salen comerciales si tengo Premium?» → la guía', r && /SIN comerciales/.test(r.t) && r.run === 'function', r);

    // ===== 7. App Android: entrar con la cuenta Premium dentro de la app =====
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx2.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx2.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){}
      window.__and = { entrar: 0, ses: false };
      window.VentoAndroid = { youtubeEntrar: () => { window.__and.entrar++; }, youtubeSesion: () => window.__and.ses, notificar: () => true }; });
    const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('apk: ' + e.message));
    await q.goto(BASE + '/index.html'); await q.waitForTimeout(1500);
    await q.fill('#authBiz', 'Bar App'); await q.fill('#authUser', 'ana'); await q.fill('#authPass', 'clave123'); await q.click('#authBtn'); await q.waitForTimeout(1200);
    await q.click('#onbSaltar').catch(() => {});
    await q.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); }; window.vitoSinComerciales(); });
    await q.waitForSelector('#mzScOv.show');
    chk('7. En la app: primer paso «🔑 Entrar con mi YouTube Premium» (y aviso honesto si Google no deja)', await q.isVisible('#mzScOv [data-sc="entrar"]') && /no es seguro/.test(await q.textContent('#mzScOv')));
    await q.click('#mzScOv [data-sc="entrar"]');
    chk('7. El botón abre la pantalla de Google dentro de la app', await q.evaluate(() => window.__and.entrar === 1));
    await q.evaluate(() => { window.__and.ses = true; window.ventoYouTubeSesion(true); window.vitoSinComerciales(); });
    chk('7. Al volver con la sesión: «Entraste con tu YouTube Premium… ya no pone comerciales»', await q.evaluate(() => window.__toasts.some(t => /Entraste con tu YouTube Premium/.test(t))));
    chk('7. La guía lo marca «✅ Ya entraste» y ya no pide entrar', /Ya entraste/.test(await q.textContent('#mzScOv')) && !(await q.isVisible('#mzScOv [data-sc="entrar"]')));
    await q.evaluate(() => { window.__and.ses = false; window.ventoYouTubeSesion(false); });
    chk('7. Si Google no deja entrar: lo dice claro y ofrece el TV', await q.evaluate(() => window.__toasts.some(t => /No quedó la sesión de YouTube/.test(t) && /TV/.test(t))));
    await ctx2.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
