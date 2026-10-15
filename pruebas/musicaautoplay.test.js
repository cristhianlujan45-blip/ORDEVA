// La música del panel de YouTube SÍ suena aunque el navegador bloquee la reproducción automática (Brave, Chrome…).
// El reproductor simulado hace como el de verdad: solo arranca con audio si se le pide DENTRO de un toque de la persona
// (navigator.userActivation.isActive); si se le pide después (sin toque), se queda quieto (-1).
//  1. Reproductor ya listo: «⏭ Que siga» con nada sonando → suena YA (dentro del toque). Antes esperaba la revisión de
//     fondo y arrancaba sin toque: el navegador lo dejaba en silencio.
//  2. Primera vez (reproductor apagado): si el navegador no lo deja arrancar solo, sale «▶ Toca aquí para que suene» y
//     al tocarlo suena.
//  3. «Este equipo pone la música» en otro equipo que no responde: el panel lo dice y este equipo toma la música al
//     poner una canción (antes quedaba todo en silencio). «🎶 Que suene aquí» también la toma.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const video = (id, t) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: 'Artista' }, duracion: 200 });
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  async function equipo(extra){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url()), J = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if(u.hostname === 'localhost') return r.continue();
      if(/\/vento-ia\/yt\/buscar$/.test(u.pathname)){ const q = (u.searchParams.get('q') || '').toLowerCase(); const id = (q.replace(/\W/g, '') + 'xxxxxxxxxxx').slice(0, 11); return J({ items: [video(id, 'Video de ' + q)] }); }
      if(u.hostname === 'www.googleapis.com') return J({ items: [] });
      return r.abort();
    });
    await ctx.addInitScript(extra => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://prueba.supabase.co', key: 'x'.repeat(30) })); Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, v)); }catch(e){}
      window.__yt = { cargados: [], bloqueados: 0 };
      // Navegador estricto: solo deja sonar lo que se pide MIENTRAS se atiende el toque (como Brave en el peor caso).
      const enToque = () => !!(window.event && /^(click|pointerup|pointerdown|mouseup|mousedown|touchend|touchstart|keydown)$/.test(window.event.type));
      window.YT = { Player: class {
        constructor(id, o){ this.o = o; this.st = -1; this.id = id; if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 50); }
        loadVideoById(v){ this.vid = v;
          if(this.id === 'ytPlayer'){ window.__yt.cargados.push(v);
            if(!enToque()){ this.st = -1; window.__yt.bloqueados++; return; } }   // sin toque: el navegador no deja sonar
          this.st = 1; setTimeout(() => this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }), 30); }
        playVideo(){ if(this.id === 'ytPlayer' && !enToque()) return; this.st = 1; this.o.events.onStateChange({ data: 1 }); }
        pauseVideo(){ this.st = 2; } stopVideo(){ this.st = 5; } mute(){}
        getPlayerState(){ return this.st; } getCurrentTime(){ return 5; } getDuration(){ return 200; }
      } };
    }, extra);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Brave'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; saveData();
      window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); }; });
    return p;
  }
  const suena = p => p.evaluate(() => window.__yt.main && window.__yt.main.st === 1);
  const buscarYPoner = async (p, q) => { await p.fill('#ypQ', q); await p.click('#ypBuscarF button'); await p.waitForFunction(q => [...document.querySelectorAll('#ypRes .yp-card b')].some(b => b.textContent.includes(q)), q); await p.click('#ypRes .yp-card .btn-primary'); };
  try{
    // ===== 1. Reproductor ya listo =====
    let p = await equipo({ vito_auto_play: JSON.stringify({ on: true }) });
    await p.evaluate(() => window.vitoPanel.abrir());
    await p.waitForFunction(() => window.__yt.main, null, { timeout: 8000 });
    await p.mouse.click(5, 5);                                   // primer toque en la página
    await buscarYPoner(p, 'karol g provenza');
    await p.waitForTimeout(600);
    chk('1. «⏭ Que siga» con nada sonando: SUENA YA, dentro del toque (aunque el navegador bloquee lo automático)', await suena(p) && await p.evaluate(() => window.__yt.bloqueados === 0), await p.evaluate(() => ({ st: window.__yt.main.st, bloq: window.__yt.bloqueados, diag: (window.vitoMusicaDiag?window.vitoMusicaDiag():{}) })));
    chk('1. … y no sale el botón de «Toca aquí»', !(await p.isVisible('#ypTocar')));
    chk('1. Diagnóstico de la música disponible para el soporte', await p.evaluate(() => { const d = (window.vitoMusicaDiag?window.vitoMusicaDiag():{}); return d.auto === true && d.yListo === true && d.estado === 1 && /provenza/i.test(d.actual || ''); }));

    // ===== 2. Primera vez: reproductor apagado =====
    p = await equipo();
    await p.evaluate(() => window.vitoPanel.abrir());
    await buscarYPoner(p, 'feid luna');
    await p.waitForFunction(() => window.__yt.cargados.length > 0, null, { timeout: 15000 }).catch(() => {});
    chk('2. Primera vez: el reproductor se prende pero el navegador no lo deja sonar solo (quieto)', await p.evaluate(() => window.__yt.cargados.includes('feidlunaxxx') && window.__yt.main.st === -1), await p.evaluate(() => [window.__yt.cargados, window.__yt.main && window.__yt.main.st]));
    chk('2. Sale «▶ Toca aquí para que suene»', await p.waitForSelector('#ypTocar:not([hidden])', { timeout: 8000 }).then(() => true, () => false));
    await p.click('#ypTocar');
    await p.waitForTimeout(400);
    chk('2. Al tocarlo SUENA y el botón se va', await suena(p) && await p.waitForSelector('#ypTocar', { state: 'hidden', timeout: 4000 }).then(() => true, () => false), await p.evaluate(() => window.__yt.main.st));

    // ===== 3. Otro equipo «pone la música» y no responde =====
    p = await equipo({ vito_auto_play: JSON.stringify({ on: true }) });
    await p.evaluate(() => { data.musicaEquipo = { id: 'OTRO-EQUIPO', nombre: 'App Android de ana · K7QX', at: Date.now() }; data.musicaCanal = 'vmus' + 'a'.repeat(24); saveData(); window.vitoPanel.abrir(); });
    await p.waitForTimeout(800);
    chk('3. El panel dice dónde suena la música y ofrece «🎶 Que suene aquí»', await p.isVisible('#ypMq') && /suena en «App Android de ana · K7QX»/.test(await p.textContent('#ypMq')), await p.textContent('#ypMq'));
    await p.waitForTimeout(15500);                               // el otro equipo no ha dado señales
    await p.mouse.click(5, 5);
    await buscarYPoner(p, 'salsa');
    await p.waitForTimeout(800);
    chk('3. Al poner una canción: este equipo toma la música («no respondía») y suena aquí', await p.evaluate(() => window.__toasts.some(t => /no respondía: ahora la música suena en este equipo/.test(t))) && await suena(p), await p.evaluate(() => [window.__toasts.slice(-3), window.__yt.main && window.__yt.main.st]));
    chk('3. … y ya no sale el aviso de otro equipo', !(await p.isVisible('#ypMq')));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
