// 🎵 ORDEVA 1.99.17 · «Cuando alguien pone una canción del QR, se quita la canción que está sonando».
//  A. YouTube del TV (puente de la app de Android, TV simulado):
//   1. Con el TV quieto, la primera canción arranca la cola (setPlaylist).
//   2. El TV está pasando un COMERCIAL de YouTube (estado 1081) antes de la canción de ORDEVA: la canción nueva del QR se
//      AGREGA al final (addVideo); antes se tomaba el comercial como «TV quieto» y se mandaba lista nueva (la cortaba).
//   3. El TV está pasando de una canción a otra (estado -1): igual se agrega, no corta.
//  B. Reproductor de este celular (YouTube simulado):
//   4. Mientras suena una canción, la nueva del QR se comprueba SIN reproducirla (cue), no con un segundo video sonando
//      a la vez (eso hacía que Android cerrara la página por falta de memoria); y la que suena no se toca.
//   5. Si la página se cierra y vuelve a abrir a la mitad de una canción, esa canción se RETOMA desde donde iba
//      (antes se daba por saltada y se quitaba).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const mock = require('./ntfymock.js')();
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x ? ' → ' + x : '')); } };
  const google = r => { const u = new URL(r.request().url()); const q = u.searchParams.get('q') || '';
    if(/search/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: { videoId: ('v_' + q.replace(/\W+/g, '') + 'xxxxxxxxxxx').slice(0, 11) }, snippet: { title: q, channelTitle: 'Art' } }] }) });
    const ids = (u.searchParams.get('id') || '').split(','); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: ids.map(id => ({ id, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' }, contentDetails: { duration: 'PT3M20S' }, snippet: { title: id } })) }) }); };
  const PUENTE = () => ({ info: () => '{}', vozIniciar(){}, vozParar(){}, vozCancelar(){}, hablar(){}, callar(){}, guardarArchivo(){}, fondo: () => true, fondoActivar(){}, ajustesBateria(){}, notificar(){ return true; }, avisosEstado: () => '{"prendidos":true}' });
  try{ await tvPrueba(); }catch(e){ mal++; console.log('❌ La prueba del TV se cayó: ' + (e && e.stack || e)); }
  try{ await celularPrueba(); }catch(e){ mal++; console.log('❌ La prueba del celular se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); await b.close(); process.exit(mal ? 1 : 0);

  // ===================== A. YouTube del TV =====================
  async function tvPrueba(){
    const tv = { cmds: [], binds: 0, cola: [], estado: '1' };
    const resp = (ruta, query, cuerpo) => {
      const qs = new URLSearchParams(query), f = new URLSearchParams(cuerpo);
      if(/get_lounge_token_batch/.test(ruta)) return { st: 200, b: JSON.stringify({ screens: [{ screenId: 'scr-lg', loungeToken: 'tok-lg', expiration: Date.now() + 864e5 }] }) };
      if(!qs.get('SID')){ tv.binds++; const np = tv.cola.length ? { videoId: tv.cola[0], state: tv.estado, currentTime: '5', duration: '200' } : {};
        const ev = [[0, ['c', 'SID' + tv.binds, '', 8]], [1, ['S', 'gs']]]; if(!tv.sinNada) ev.push([2, ['nowPlaying', np]]);
        return { st: 200, b: JSON.stringify(ev) }; }
      const sc = f.get('req0__sc'), v = f.get('req0_videoId'); tv.cmds.push(sc + ':' + (v || ''));
      if(sc === 'setPlaylist') tv.cola = [v]; if(sc === 'addVideo') tv.cola.push(v);
      return { st: 200, b: '[]' };
    };
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; wv) Chrome/129.0 Mobile VentoAndroid/1.0.13' });
    await ctx.route('**/*', async r => { if(await mock.handler(r)) return; const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'www.googleapis.com') return google(r);
      return r.abort(); });
    await ctx.exposeFunction('__lounge', (ruta, query, cuerpo) => resp(ruta, query, cuerpo));
    await ctx.addInitScript(P => {
      try{ const c = JSON.parse(localStorage.getItem('vito_yt') || '{}'); c.key = 'AIzaClaveDelNegocio00000000000000000'; localStorage.setItem('vito_yt', JSON.stringify(c)); }catch(e){}
      window.VentoAndroid = Object.assign(eval('(' + P + ')')(), {
        lounge: (id, ruta, query, cuerpo) => { window.__lounge(ruta, query, cuerpo).then(x => window.__ventoCb(id, { status: x.st, text: x.b })); },
        escucharTV(){}, pararTV(){} });
      if(!sessionStorage.getItem('ini')){ sessionStorage.setItem('ini', 1); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vito_tvfix1', '1');
        // El TV ya está vinculado (como después de poner el código una vez).
        localStorage.setItem('vito_ytlounge', JSON.stringify({ on: true, screenId: 'scr-lg', loungeToken: 'tok-lg', exp: Date.now() + 864e5, nombre: 'TV del bar' })); }
    }, String(PUENTE));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('TV: ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(2000);
    await p.fill('#authBiz', 'Bar'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); for(let i = 1; i <= 4; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData(); document.querySelector('nav button[data-view="musica"]')?.click(); });
    const conectado = await p.waitForFunction(() => typeof lngOn === 'function' && lngOn(), null, { timeout: 15000 }).then(() => true, () => false);
    chk('A. El TV vinculado queda conectado', conectado, await p.evaluate(() => JSON.stringify({ lng: typeof lng !== 'undefined' && lng.error, cfg: localStorage.getItem('vito_ytlounge') })));
    chk('A. Lectura del estado del TV: comercial (1081) = sonando, -1 = no se sabe, 0 = quieto', await p.evaluate(() => lngEstadoTV('"state":"1081"') === true && lngEstadoTV('"state":"-1"') === null && lngEstadoTV('"state":"0"') === false && lngEstadoTV('"state":"1"') === true));
    const pedir = async (mesa, s) => { await p.evaluate(([m, x]) => window.vitoAddSong(m, x), [mesa, s]); };
    const esperarCmd = async (re, ms) => { const t0 = Date.now(); while(Date.now() - t0 < (ms || 20000)){ if(tv.cmds.some(c => re.test(c))) return true; await p.waitForTimeout(300); } return false; };

    // 1. TV quieto: la primera arranca la cola
    tv.estado = '0';
    await pedir(1, 'Vivir mi vida Marc Anthony');
    chk('1. Con el TV quieto, la primera canción arranca la cola (setPlaylist)', await esperarCmd(/^setPlaylist:v_Vivirmivi/), JSON.stringify(tv.cmds));
    // 2. Comercial de YouTube antes de la canción de ORDEVA. Se espera a que pase la ventana de «recién mandado» (20 s).
    tv.estado = '1081';
    await p.waitForTimeout(23000);
    const n1 = tv.cmds.filter(c => /^setPlaylist/.test(c)).length;
    await pedir(2, 'Depende Jarabe de Palo');
    chk('2. Con el TV en un comercial, la canción nueva se AGREGA al final (addVideo)', await esperarCmd(/^addVideo:v_DependeJa/), JSON.stringify(tv.cmds));
    chk('2. …y NO se manda lista nueva (no corta lo que suena)', tv.cmds.filter(c => /^setPlaylist/.test(c)).length === n1, JSON.stringify(tv.cmds));
    // 3. El TV pasando de una canción a otra
    tv.estado = '1';                                            // la canción suena…
    await p.waitForTimeout(23000);
    tv.estado = '-1';                                           // …y justo cuando llega la nueva, el TV está cambiando de canción
    await pedir(3, 'Sin poderte hablar Willie Colon');
    chk('3. Con el TV cambiando de canción (-1), la nueva también se agrega', await esperarCmd(/^addVideo:v_Sinpodert/), JSON.stringify(tv.cmds));
    chk('3. …y sigue sin lista nueva', tv.cmds.filter(c => /^setPlaylist/.test(c)).length === n1, JSON.stringify(tv.cmds));
    tv.estado = '1';
    const colaTres = tv.cola.join(',');
    // Regresión (revisión): el TV deja de decir qué hace (se reinició YouTube en el TV) con la cola de ORDEVA «viva» según
    // el reloj. Una canción nueva NO se puede quedar solo «agregada» a una cola que ya no existe: hay que ponerle la cola.
    const sp0 = tv.cmds.filter(c => /^setPlaylist/.test(c)).length;
    tv.cola = []; tv.sinNada = true;
    await p.waitForTimeout(21000);
    await pedir(4, 'La rebelion Joe Arroyo');
    chk('R1. Si el TV ya no dice qué hace, la canción nueva igual suena (se le pone la cola, no queda muda)', await (async () => { const t0 = Date.now(); while(Date.now() - t0 < 30000){ if(tv.cmds.filter(c => /^setPlaylist/.test(c)).length > sp0 && tv.cola.some(v => /^v_Larebelio/.test(v))) return true; await p.waitForTimeout(500); } return false; })(), JSON.stringify(tv.cmds.slice(-8)));
    // Regresión (revisión): el TV queda quieto en -1 con una canción de ORDEVA y no hace caso al «play»: pasados unos
    // segundos se trata como quieto y se le vuelve a poner la cola (no se queda callado para siempre).
    tv.sinNada = false; tv.estado = '-1';
    const sp1 = tv.cmds.filter(c => /^setPlaylist/.test(c)).length;
    chk('R2. Si el TV se queda pegado «cambiando de canción», ORDEVA le vuelve a poner la cola', await (async () => { const t0 = Date.now(); while(Date.now() - t0 < 75000){ if(tv.cmds.filter(c => /^setPlaylist/.test(c)).length > sp1) return true; await p.waitForTimeout(1000); } return false; })(), JSON.stringify(tv.cmds.slice(-8)));
    tv.estado = '1';
    chk('A. Las tres canciones quedaron en la cola del TV, en orden', colaTres === ['v_Vivirmivi', 'v_DependeJar', 'v_Sinpoderte'].map(x => x.slice(0, 11)).join(','), colaTres);
    await ctx.close();
  }

  // ===================== B. Reproductor del celular =====================
  async function celularPrueba(){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', async r => { if(await mock.handler(r)) return; const u = new URL(r.request().url());
      if(u.hostname === 'localhost') return r.continue();
      if(u.hostname === 'www.googleapis.com') return google(r);
      return r.abort(); });
    await ctx.addInitScript(P => {
      try{ const c = JSON.parse(localStorage.getItem('vito_yt') || '{}'); c.key = 'AIzaClaveDelNegocio00000000000000000'; localStorage.setItem('vito_yt', JSON.stringify(c)); }catch(e){}
      window.VentoAndroid = eval('(' + P + ')')();
      if(!sessionStorage.getItem('ini')){ sessionStorage.setItem('ini', 1); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vito_auto_play', JSON.stringify({ on: true })); }
      // YouTube simulado: cada reproductor anota lo que se le pide (cargar y sonar = load; solo cargar = cue).
      window.__yt = { calls: [] };
      window.YT = { Player: function(el, o){
        const me = this, ev = (o && o.events) || {}; me.st = -1; me.t = 0; me.d = 200;
        const cambia = s => { me.st = s; setTimeout(() => ev.onStateChange && ev.onStateChange({ data: s, target: me }), 40); };
        me.loadVideoById = a => { window.__yt.calls.push({ el, a: 'load', v: typeof a === 'object' ? a.videoId : a, desde: typeof a === 'object' ? a.startSeconds : 0 }); me.t = typeof a === 'object' ? (a.startSeconds || 0) : 0; me.t0 = Date.now(); cambia(1); };
        me.cueVideoById = v => { window.__yt.calls.push({ el, a: 'cue', v }); cambia(5); };
        me.stopVideo = () => { me.st = 5; }; me.playVideo = () => cambia(1); me.pauseVideo = () => cambia(2);
        me.mute = () => {}; me.unMute = () => {}; me.setVolume = () => {}; me.getVolume = () => 100; me.isMuted = () => false;
        me.getPlayerState = () => me.st; me.getCurrentTime = () => me.st === 1 && me.t0 ? me.t + (Date.now() - me.t0) / 100 : me.t; me.getDuration = () => me.d;   // el tiempo corre 10 veces más rápido
        me.getVideoData = () => ({}); me.destroy = () => {};
        setTimeout(() => ev.onReady && ev.onReady({ target: me }), 60);
      } };
    }, String(PUENTE));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('celular: ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(2000);
    await p.fill('#authBiz', 'Bar'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); for(let i = 1; i <= 4; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData(); document.querySelector('nav button[data-view="musica"]')?.click(); });
    const llamadas = () => p.evaluate(() => window.__yt.calls);
    const esperar = (fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 20000, polling: 300 }).then(() => true, () => false);
    await p.evaluate(() => window.vitoAddSong(1, 'Cancion uno del bar'));
    chk('B. La primera canción suena en el reproductor del celular', await esperar(() => window.__yt.calls.some(c => c.el === 'ytPlayer' && c.a === 'load')), JSON.stringify(await llamadas()));
    const v1 = (await llamadas()).find(c => c.el === 'ytPlayer' && c.a === 'load').v;
    await p.waitForTimeout(6000);                                 // el reproductor anota por dónde va
    const antes = (await llamadas()).length;
    await p.evaluate(() => window.vitoAddSong(2, 'Cancion dos del bar'));
    await esperar(n => window.__yt.calls.length > n && window.__yt.calls.slice(n).some(c => c.el === 'ytTestIn'), antes);
    await p.waitForTimeout(1500);
    const nuevas = (await llamadas()).slice(antes);
    chk('4. Mientras suena una, la nueva del QR se comprueba SIN reproducirla (cue, no un segundo video sonando)', nuevas.some(c => c.el === 'ytTestIn' && c.a === 'cue') && !nuevas.some(c => c.el === 'ytTestIn' && c.a === 'load'), JSON.stringify(nuevas));
    chk('4. …y la que suena no se toca (el reproductor no cargó otra)', !nuevas.some(c => c.el === 'ytPlayer'), JSON.stringify(nuevas));
    chk('4. La nueva quedó lista en la cola, detrás', await p.evaluate(() => { const l = window.vitoMusica.cola(); const a = window.vitoMusica.actual(); return !!a && /uno/.test(a.song) && l.some(x => /dos/.test(x.song) && x.ok && x.status !== 'playing'); }), await p.evaluate(() => JSON.stringify(window.vitoMusica.cola().map(x => [x.song, x.status, x.ok]))));
    // 5. Android cierra la página a la mitad de la canción: al volver a abrir, la canción sigue desde donde iba.
    const iba = await p.evaluate(() => (window.vitoMusica.actual() || {}).playedSeconds || 0);
    await p.reload(); await p.waitForTimeout(1500);
    if(await p.evaluate(() => !document.getElementById('authOverlay').hidden)){ await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); }
    chk('5. Al volver a abrir, la canción que se cortó se RETOMA (la misma, no la siguiente)', await esperar(v => window.__yt.calls.some(c => c.el === 'ytPlayer' && c.a === 'load' && c.v === v), v1), JSON.stringify(await llamadas()));
    const re = (await llamadas()).find(c => c.el === 'ytPlayer' && c.a === 'load');
    chk('5. …desde donde iba (unos segundos antes, no desde el principio)', iba > 3 && re.desde > 0 && re.desde <= iba, JSON.stringify({ iba, re }));
    chk('5. …y la segunda sigue esperando su turno (no se perdió ninguna)', await p.evaluate(() => { const a = window.vitoMusica.actual(); return !!a && /uno/.test(a.song) && window.vitoMusica.cola().some(x => /dos/.test(x.song) && x.status !== 'playing' && !x.done); }), await p.evaluate(() => JSON.stringify(window.vitoMusica.cola().map(x => [x.song, x.status, x.done]))));
    await ctx.close();
  }
})();
