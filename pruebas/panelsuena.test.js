// El panel de YouTube SÍ pone las canciones (como viene el celular: el reproductor de Vento apagado, sin Google ni TV).
// Antes, «⏭ Que siga» / «▶ Poner» solo dejaban la canción en la cola y no sonaba nada.
//  1. Llega una canción por QR sin ningún reproductor: queda en la cola y el aviso dice cómo hacer que suene.
//  2. En el panel: buscar → «⏭ Que siga» → se prende solo el reproductor de Vento y SUENA; avisa que lo prendió.
//  3. Al terminar, suena sola la canción que pidió la mesa por QR (y las siguientes del QR también).
//  4. Otro equipo nuevo: «📃 Mis listas» → pegar el link → la lista SUENA de fondo.
//  5. Con el modo TV prendido, el panel NO prende el reproductor del celular (la música va al TV).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const video = (id, t, c, d) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: c }, duracion: d });

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  async function equipo(nombre, extra){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const u = new URL(r.request().url()), J = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if(u.hostname === 'localhost') return r.continue();
      if(/\/vento-ia\/yt\/buscar$/.test(u.pathname)){ const q = (u.searchParams.get('q') || '').toLowerCase(); const id = (q.replace(/\W/g, '') + 'xxxxxxxxxxx').slice(0, 11); return J({ items: [video(id, 'Video de ' + q, 'Artista', 200)] }); }
      if(/\/vento-ia\/yt\/lista$/.test(u.pathname)) return J({ titulo: 'Lista del bar', items: Array.from({ length: 4 }, (_, i) => video(('lista' + i + 'xxxxxxx').slice(0, 11), 'Canción de lista ' + (i + 1), 'Artista', 180)) });
      if(u.hostname === 'www.googleapis.com') return J({ items: [] });
      return r.abort();
    });
    await ctx.addInitScript(extra => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://prueba.supabase.co', key: 'x'.repeat(30) })); Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, v)); }catch(e){}
      window.__yt = { cargados: [] };
      window.YT = { Player: class {
        constructor(id, o){ this.o = o; this.st = -1; this.id = id; if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 30); }
        loadVideoById(v){ this.vid = v; this.st = 1; if(this.id === 'ytPlayer') window.__yt.cargados.push(v); setTimeout(() => this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }), 30); }
        pauseVideo(){ this.st = 2; } playVideo(){ this.st = 1; } stopVideo(){ this.st = 5; } mute(){}
        getPlayerState(){ return this.st; } getCurrentTime(){ return 10; } getDuration(){ return 200; }
        terminar(){ this.st = 0; this.o.events.onStateChange({ data: 0 }); }
      } };
    }, extra);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar ' + nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; for(let i = 1; i <= 3; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData();
      window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); }; });
    return p;
  }
  const suena = (p, vid, ms) => p.waitForFunction(v => window.__yt.cargados.slice(-1)[0] === v, vid, { timeout: ms || 12000, polling: 200 }).then(() => true, () => false);
  try{
    const p = await equipo('Uno');
    chk('Así viene: el reproductor de Vento apagado', await p.evaluate(() => !JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on));

    // 1. Canción por QR sin reproductor
    await p.evaluate(() => window.vitoMod.procesar(JSON.stringify({ t: 'cancion', v: 2, id: 'c-qr-1', mesa: 2, s: 'Joe Arroyo La Rebelion', at: Date.now() })));
    await p.waitForTimeout(800);
    chk('1. La canción del QR entra a la cola de la mesa 2', await p.evaluate(() => window.vitoMusica.cola().some(x => x.mesa === 2 && /Rebelion/i.test(x.song))));
    chk('1. El aviso dice cómo hacer que suene («Activar música automática»)', await p.evaluate(() => window.__toasts.some(t => /(Mesa|Cuenta) 2/.test(t) && /Activar música automática/.test(t))), await p.evaluate(() => window.__toasts));

    // 2. Panel: buscar y «Que siga»
    await p.evaluate(() => window.vitoPanel.abrir());
    await p.fill('#ypQ', 'feid luna'); await p.click('#ypBuscarF button');
    await p.waitForSelector('#ypRes .yp-card');
    await p.click('#ypRes .yp-card .btn-primary');
    chk('2. «⏭ Que siga» prende solo el reproductor de Vento', await p.evaluate(() => !!JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on));
    chk('2. … y avisa que lo prendió', await p.evaluate(() => window.__toasts.some(t => /Encendí el reproductor de Vento/.test(t))));
    chk('2. La canción elegida SUENA', await suena(p, 'feidlunaxxx'), await p.evaluate(() => [window.__yt.cargados, window.vitoMusica.cola().map(x => [x.song, x.status, x.vid, x.ok])]));
    await p.waitForTimeout(1300);
    chk('2. Se ve en el panel («En este equipo»)', /En este equipo/.test(await p.textContent('#ypDonde')) && /feid luna/i.test(await p.textContent('#ypTitulo')));

    // 3. Después suena la del QR, y las nuevas del QR siguen sonando
    await p.evaluate(() => window.__yt.main.terminar());
    chk('3. Al terminar suena sola la canción que pidió la mesa por QR', await suena(p, 'joearroyola'), await p.evaluate(() => window.__yt.cargados));
    await p.evaluate(() => window.vitoMod.procesar(JSON.stringify({ t: 'cancion', v: 2, id: 'c-qr-2', mesa: 3, s: 'Grupo Niche Cali Pachanguero', at: Date.now() })));
    await p.waitForTimeout(800);
    chk('3. La nueva del QR ya no pide activar nada (el reproductor está prendido)', await p.evaluate(() => !window.__toasts.slice(-2).some(t => /Activar música automática/.test(t))));
    await p.evaluate(() => window.__yt.main.terminar());
    chk('3. … y suena después, sola', await suena(p, 'gruponichec'), await p.evaluate(() => window.__yt.cargados));

    // 4. Equipo nuevo: poner una lista desde el panel
    const q = await equipo('Dos');
    await q.evaluate(() => window.vitoPanel.abrir('listas'));
    await q.fill('#ypLq', 'https://www.youtube.com/playlist?list=PLlistadelbar0000000001');
    await q.click('#ypCuerpo .yp-buscar button');
    chk('4. «▶ Poner» una lista en un equipo nuevo: se prende el reproductor', await q.waitForFunction(() => !!JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on, null, { timeout: 8000 }).then(() => true, () => false));
    chk('4. … y la lista SUENA de fondo', await q.waitForFunction(() => window.__yt.cargados.some(v => /^lista/.test(v)), null, { timeout: 12000 }).then(() => true, () => false), await q.evaluate(() => [window.__yt.cargados, window.vitoMusica.cola().map(x => [x.song, x.status])]));
    chk('4. El aviso dice que se encendió y que suena aquí', await q.evaluate(() => window.__toasts.some(t => /Sonando de fondo/.test(t) && /Encendí el reproductor/.test(t))));

    // 5. Modo TV: no se prende el reproductor del celular
    const r = await equipo('Tres', { vito_tvpant: JSON.stringify({ on: true }) });
    await r.evaluate(() => window.vitoPanel.abrir());
    await r.fill('#ypQ', 'salsa'); await r.click('#ypBuscarF button');
    await r.waitForSelector('#ypRes .yp-card');
    await r.click('#ypRes .yp-card .btn-primary');
    await r.waitForTimeout(1500);
    chk('5. Con el modo TV, el panel manda la canción al TV y no prende el reproductor del celular', await r.evaluate(() => !JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on && window.vitoMusica.cola().some(x => /salsa/i.test(x.song)) && !window.__yt.cargados.length));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
