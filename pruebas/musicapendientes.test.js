// 🎵 ORDEVA 1.99.19 · Los pendientes de la auditoría de la música (puente/AUDITORIA-MUSICA-1.99.18.md).
//  1. La MISMA canción pedida por dos mesas suena UNA vez: la segunda se une a la primera (no gasta cupo) y a las dos mesas
//     se les avisa (en cola · «Ya la pidió otra mesa», y sonando).
//  2. Tope de duración: una versión de más de 12 min no se pone; si no hay otra, al cliente le dice «Es muy larga».
//  3. Palabras que no se dejan pedir: el pedido no entra y al cliente le dice «Esa canción no se puede pedir aquí».
//  4. «Revisar las canciones del QR»: quedan «🛡️ Por aprobar», no suenan; con ✅ entran y suenan; con 🚫 se quitan.
//  5. Con Google conectado y sin TV ni reproductor: en vez de la lista de YouTube Music (no confiable) se enciende el
//     reproductor de ORDEVA.
//  6. El parlante de avisos dice solo «Canción pedida, Mesa N» (no el texto que escribió el cliente).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const mock = require('./ntfymock.js')();
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  // YouTube simulado: el id sale del texto buscado; lo que dice «mix» dura 1 hora.
  const google = r => { const u = new URL(r.request().url()); const q = u.searchParams.get('q') || '';
    if(/search/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: { videoId: ('v_' + q.replace(/\W+/g, '') + 'xxxxxxxxxxx').slice(0, 11) }, snippet: { title: q, channelTitle: 'Art' } }] }) });
    const ids = (u.searchParams.get('id') || '').split(','); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: ids.map(id => ({ id, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' }, contentDetails: { duration: /mix/i.test(id) ? 'PT1H2M' : 'PT3M20S' }, snippet: { title: id } })) }) }); };
  const PUENTE = () => ({ info: () => '{}', vozIniciar(){}, vozParar(){}, vozCancelar(){}, hablar(){}, callar(){}, guardarArchivo(){}, fondo: () => true, fondoActivar(){}, ajustesBateria(){}, notificar(){ return true; }, avisosEstado: () => '{"prendidos":true}' });
  try{ await prueba(); }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); await b.close(); process.exit(mal ? 1 : 0);

  async function prueba(){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', async r => { if(await mock.handler(r)) return; const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'www.googleapis.com') return google(r);
      return r.abort(); });
    await ctx.addInitScript(P => {
      try{ const c = JSON.parse(localStorage.getItem('vito_yt') || '{}'); c.key = 'AIzaClaveDelNegocio00000000000000000'; localStorage.setItem('vito_yt', JSON.stringify(c)); }catch(e){}
      window.__dichos = [];
      window.VentoAndroid = Object.assign(eval('(' + P + ')')(), { parlantes: () => '[]', parlanteDecir: f => { window.__dichos.push(f); return true; }, parlanteEstado: () => JSON.stringify({ nombre: 'JBL', conectado: true, tipos: 'musica' }) });
      if(!sessionStorage.getItem('ini')){ sessionStorage.setItem('ini', 1); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vito_auto_play', JSON.stringify({ on: true })); }
      window.__yt = { calls: [] };
      window.YT = { Player: function(el, o){
        const me = this, ev = (o && o.events) || {}; me.st = -1; me.t = 0;
        const cambia = s => { me.st = s; setTimeout(() => ev.onStateChange && ev.onStateChange({ data: s, target: me }), 40); };
        me.loadVideoById = a => { window.__yt.calls.push({ el, a: 'load', v: typeof a === 'object' ? a.videoId : a }); cambia(1); };
        me.cueVideoById = v => { window.__yt.calls.push({ el, a: 'cue', v }); cambia(5); };
        me.stopVideo = () => { me.st = 5; }; me.playVideo = () => cambia(1); me.pauseVideo = () => cambia(2);
        me.mute = () => {}; me.unMute = () => {}; me.setVolume = () => {}; me.getVolume = () => 100; me.isMuted = () => false;
        me.getPlayerState = () => me.st; me.getCurrentTime = () => 10; me.getDuration = () => 200; me.getVideoData = () => ({}); me.destroy = () => {};
        setTimeout(() => ev.onReady && ev.onReady({ target: me }), 60);
      } };
    }, String(PUENTE));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(2000);
    await p.fill('#authBiz', 'Bar'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); for(let i = 1; i <= 6; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData();
      document.querySelector('nav button[data-view="musica"]')?.click();
      // Lo que se le contesta a cada cliente (por el canal de estados)
      window.__resp = []; const f = window.fetch;
      window.fetch = (u, o) => { try{ if(/canal\.vento\.local\/.*e$/.test(String(u))){ const j = JSON.parse(o.body); if(j && j.t === 'estado') window.__resp.push(j); } }catch(e){} return f(u, o); };
    });
    const esperar = (fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 300 }).then(() => true, () => false);
    const pedir = (mesa, s, rid) => p.evaluate(([m, x, r]) => window.vitoMod.agregarCancion ? window.vitoMod.agregarCancion(m, x, r) : null, [mesa, s, rid]);
    const resp = rid => p.evaluate(r => window.__resp.filter(x => x.id === r).map(x => x.e + ':' + (x.n || '')), rid);
    const tieneAgregar = await p.evaluate(() => !!(window.vitoMod && window.vitoMod.agregarCancion));
    chk('(la página expone agregarCancion para la prueba)', tieneAgregar);

    // ===== 1. La misma canción, dos mesas =====
    await pedir(1, 'Despacito Luis Fonsi', 'c-r1-mesa1');
    await esperar(() => window.__yt.calls.some(c => c.el === 'ytPlayer' && c.a === 'load'));
    await pedir(2, 'despacito luis fonsi', 'c-r2-mesa2');
    await p.waitForTimeout(800);
    const n1 = await p.evaluate(() => window.vitoMusica.cola().filter(x => /despacito/i.test(x.song) && x.status !== 'cancelled').length);
    chk('1. La misma canción de dos mesas queda UNA sola vez en la cola', n1 === 1, n1);
    chk('1. A la segunda mesa le dice que ya la pidió otra mesa (o que ya suena)', (await resp('c-r2-mesa2')).some(x => /otra mesa/.test(x)), await resp('c-r2-mesa2'));
    await p.evaluate(() => { const a = window.vitoMusica.actual(); if(a) window.vitoMod.mzEmpezo(a.id, 'app'); });
    await p.waitForTimeout(500);
    chk('1. Cuando suena, a las DOS mesas se les dice «sonando»', (await resp('c-r1-mesa1')).some(x => /^sonando/.test(x)) && (await resp('c-r2-mesa2')).some(x => /^sonando/.test(x)), [await resp('c-r1-mesa1'), await resp('c-r2-mesa2')]);

    // ===== 2. Tope de duración =====
    await pedir(3, 'Mix salsa 1 hora', 'c-r3-mesa3');
    chk('2. Una canción de más de 12 min no se pone y al cliente le dice «Es muy larga»', await esperar(() => window.__resp.some(x => x.id === 'c-r3-mesa3' && x.e === 'novid' && /muy larga/.test(x.n || ''))), await resp('c-r3-mesa3'));
    chk('2. …y no quedó en la cola', await p.evaluate(() => !window.vitoMusica.cola().some(x => /Mix salsa/.test(x.song) && !x.done)));

    // ===== 3. Palabras que no se dejan pedir =====
    await p.evaluate(() => { data.musicaPalabras = 'grosería, palabrota'; saveData(); });
    const r3 = await pedir(4, 'Cancion con PALABROTA adentro', 'c-r4-mesa4');
    chk('3. Con una palabra bloqueada no entra a la cola', !!(r3 && r3.prohibida) && await p.evaluate(() => !window.vitoMusica.cola().some(x => /PALABROTA/i.test(x.song))), r3);
    chk('3. …y al cliente le dice «Esa canción no se puede pedir aquí»', (await resp('c-r4-mesa4')).some(x => /no se puede pedir/.test(x)), await resp('c-r4-mesa4'));

    // ===== 4. Revisar antes de que suenen =====
    await p.evaluate(() => { data.musicaRevisar = true; saveData(); });
    await pedir(5, 'Vivir mi vida Marc Anthony', 'c-r5-mesa5');
    await p.waitForTimeout(1500);
    chk('4. Queda «Por aprobar» (sin buscarla ni ponerla) y al cliente le dice «Esperando que la aprueben»', await p.evaluate(() => { const x = window.vitoMusica.cola().find(y => /Vivir mi vida/.test(y.song)); return !!x && x.revisar && !x.vid; }) && (await resp('c-r5-mesa5')).some(x => /aprueben/.test(x)), await resp('c-r5-mesa5'));
    await p.evaluate(() => { window.vitoMod.renderMusica(); });
    const pa = await p.evaluate(() => /Por aprobar/.test(document.getElementById('mzList') ? document.getElementById('mzList').innerText : ''));
    chk('4. En Música se ve «🛡️ Por aprobar» con ✅ y 🚫', pa);
    await p.evaluate(() => { const fila = [...document.querySelectorAll('#mzList .mz-song')].find(d => /Vivir mi vida/.test(d.innerText)); const b = fila && [...fila.querySelectorAll('button')].find(x => x.textContent.includes('✅')); b && b.click(); });
    chk('4. Con ✅ se busca su video y entra a la cola', await esperar(() => { const x = window.vitoMusica.cola().find(y => /Vivir mi vida/.test(y.song)); return !!x && !x.revisar && !!x.vid; }), await p.evaluate(() => window.vitoMusica.cola().map(y => [y.song, y.status, y.revisar, y.vid])));
    await pedir(6, 'Otra cancion cualquiera', 'c-r6-mesa6');
    await p.waitForTimeout(500);
    await p.evaluate(() => { window.vitoMod.renderMusica(); const fila = [...document.querySelectorAll('#mzList .mz-song')].find(d => /Otra cancion/.test(d.innerText)); const b = fila && [...fila.querySelectorAll('button')].find(x => x.textContent.includes('🚫')); b && b.click(); });
    chk('4. Con 🚫 se quita y al cliente le dice «La quitaron»', await esperar(() => window.__resp.some(x => x.id === 'c-r6-mesa6' && x.e === 'quitada')), await resp('c-r6-mesa6'));
    await p.evaluate(() => { data.musicaRevisar = false; saveData(); });

    // ===== 6. El parlante dice solo el aviso =====
    const dichos = await p.evaluate(() => { window.__dichos = []; window.ventoParlanteAviso && window.ventoParlanteAviso('🎵 Canción pedida · Mesa 3', 'texto que escribió el cliente con groserías'); return window.__dichos; });
    chk('6. El parlante dice «Canción pedida, Mesa 3» sin el texto del cliente', dichos.length === 1 && /Canción pedida, Mesa 3/.test(dichos[0]) && !/cliente/.test(dichos[0]), dichos);
    await ctx.close();

    // ===== 5. Google conectado, sin TV ni reproductor: se usa el reproductor de ORDEVA =====
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx2.route('**/*', async r => { if(await mock.handler(r)) return; const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'www.googleapis.com'){ if(/playlist/.test(u.pathname)){ window.__noOcurre = 1; } return google(r); }
      return r.abort(); });
    await ctx2.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vito_yt', JSON.stringify({ key: 'AIzaClaveDelNegocio00000000000000000' })); localStorage.setItem('vito_ytok', JSON.stringify({ t: 'ya29.token-de-prueba', exp: Date.now() + 36e5 })); localStorage.setItem('vito_auto_play', JSON.stringify({ on: false })); }catch(e){} });
    const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('2: ' + e.message));
    await q.goto(BASE + '/index.html'); await q.waitForTimeout(2000);
    await q.fill('#authBiz', 'Bar'); await q.fill('#authUser', 'ana'); await q.fill('#authPass', 'clave123'); await q.click('#authBtn'); await q.waitForTimeout(1500);
    await q.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.tables[1] = data.tables[1] || { items: [], people: [] }; saveData(); });
    const conGoogle = await q.evaluate(() => { try{ return !!(window.vitoMod && window.vitoMod.yTok && window.vitoMod.yTok()); }catch(e){ return 'err ' + e.message; } });
    await q.evaluate(() => window.vitoAddSong(1, 'La gota fria Carlos Vives'));
    chk('5. Con Google conectado y sin TV ni reproductor, se enciende el reproductor de ORDEVA (no la lista de YouTube Music)', await q.waitForFunction(() => JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on === true, null, { timeout: 15000 }).then(() => true, () => false), { conGoogle });
    await ctx2.close();
  }
})();
