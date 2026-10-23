// 🎶 Un solo equipo pone la música (misma cuenta en el computador y el celular), con los canales del servidor REAL:
//  1. En el computador: «🎶 Este equipo pone la música» → se prende su reproductor.
//  2. En el celular (ya no es el de la música): su reproductor NO suena aunque lo prendan.
//  3. Desde el panel de YouTube del celular: «⏭ Que siga» → suena en el COMPUTADOR; el celular muestra lo que suena allá.
//  4. ⏭ y 🗑 desde el celular mandan la orden al computador; la cola del celular es la del computador.
//  5. Canción por QR: llega a los dos, suena solo en el computador (una vez), y el celular no pide «activar música».
//  6. «🎶 Que suene en este equipo» en el celular: el computador se calla y ahora suena en el celular.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const video = (id, t) => ({ id: { videoId: id }, snippet: { title: t, channelTitle: 'Artista' }, duracion: 200 });
    async function equipo(nombre, viewport, userAgent){
      const ctx = await b.newContext({ viewport, userAgent });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.route('**/functions/v1/vento-ia/yt/buscar**', rt => { const q = (new URL(rt.request().url()).searchParams.get('q') || '').toLowerCase(); const id = (q.replace(/\W/g, '') + 'xxxxxxxxxxx').slice(0, 11);
        return rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: [video(id, 'Video de ' + q)] }) }); });
      await ctx.addInitScript(() => {
        try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){}
        window.__yt = { cargados: [], paradas: 0 };
        window.YT = { Player: class {
          constructor(id, o){ this.o = o; this.st = -1; this.id = id; if(id === 'ytPlayer') window.__yt.main = this; setTimeout(() => o.events && o.events.onReady && o.events.onReady(), 30); }
          loadVideoById(v){ this.vid = v; this.st = 1; if(this.id === 'ytPlayer') window.__yt.cargados.push(v); setTimeout(() => this.o.events && this.o.events.onStateChange && this.o.events.onStateChange({ data: 1 }), 30); }
          pauseVideo(){ this.st = 2; } playVideo(){ this.st = 1; } stopVideo(){ this.st = 5; if(this.id === 'ytPlayer') window.__yt.paradas++; } mute(){}
          getPlayerState(){ return this.st; } getCurrentTime(){ return 10; } getDuration(){ return 200; }
          terminar(){ this.st = 0; this.o.events.onStateChange({ data: 0 }); }
        } };
      });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])');
      await p.fill('#authBiz', 'Bar Uno'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
      await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
      await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
      await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.musicOn = true; for(let i = 1; i <= 3; i++) data.tables[i] = data.tables[i] || { items: [], people: [] }; saveData();
        window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); }; });
      return p;
    }
    // Lo que en la vida real sincroniza ORDEVA Nube (los datos del negocio de la cuenta), aquí se copia a mano.
    const sincronizar = async (de, a) => { const x = await de.evaluate(() => ({ e: data.musicaEquipo || null, c: data.musicaCanal || null })); await a.evaluate(x => { data.musicaEquipo = x.e; data.musicaCanal = x.c; saveData(); }, x); };
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);

    const PC = await equipo('computador', { width: 1280, height: 800 }), CEL = await equipo('celular', { width: 390, height: 844 }, 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36');

    // ===== 1. El computador pone la música =====
    await PC.evaluate(() => { const b = document.querySelector('nav button[data-view="musica"]'); b && b.click(); });
    await PC.waitForTimeout(500);
    chk('1. En Música está «🎶 Equipo que pone la música»', await PC.evaluate(() => !!document.getElementById('mqYo') && /Elige uno/.test(document.getElementById('mqTxt').textContent)));
    await PC.evaluate(() => document.getElementById('mqYo').click());
    chk('1. Queda elegido este equipo y se prende su reproductor', await PC.evaluate(() => !!data.musicaEquipo && /^vmus/.test(data.musicaCanal || '') && JSON.parse(localStorage.getItem('vito_auto_play') || '{}').on === true && /Este equipo pone la música/.test(document.getElementById('mqTxt').textContent)));
    await sincronizar(PC, CEL);

    // ===== 2. El celular ya no suena =====
    await CEL.evaluate(() => window.vitoMod.SS('vito_auto_play', { on: true }));
    await CEL.waitForTimeout(3500);
    chk('2. En el celular el reproductor NO suena aunque esté prendido (otro equipo pone la música)', await CEL.evaluate(() => !window.vitoMod.AUTO() && /suena en «/.test(document.getElementById('mqTxt').textContent)), await CEL.evaluate(() => document.getElementById('mqTxt').textContent));

    // ===== 3. Panel del celular → suena en el computador =====
    await CEL.evaluate(() => window.vitoPanel.abrir());
    await CEL.fill('#ypQ', 'feid luna'); await CEL.click('#ypBuscarF button');
    await CEL.waitForSelector('#ypRes .yp-card');
    await CEL.click('#ypRes .yp-card .btn-primary');
    chk('3. «⏭ Que siga» en el celular → SUENA en el computador', await esperar(PC, () => window.__yt.cargados.includes('feidlunaxxx')), await PC.evaluate(() => [window.__yt.cargados, window.vitoMusica.cola().map(x => x.title + ':' + x.status)]));
    chk('3. … y en el celular no suena nada', await CEL.evaluate(() => !window.__yt.cargados.length));
    chk('3. El celular muestra lo que suena allá («En «Computador de ana · XXXX»»)', await esperar(CEL, () => /En «Computador de ana · \w{4}»/.test(document.getElementById('ypDonde').textContent) && /feid luna/i.test(document.getElementById('ypTitulo').textContent)),
      await CEL.evaluate(() => [document.getElementById('ypDonde').textContent, document.getElementById('ypTitulo').textContent]));

    // ===== 4. Cola, ⏭ y 🗑 desde el celular =====
    for(const q of ['salsa uno', 'salsa dos']){ await CEL.fill('#ypQ', q); await CEL.click('#ypBuscarF button'); await CEL.waitForFunction(q => [...document.querySelectorAll('#ypRes .yp-card b')].some(b => b.textContent.includes(q)), q); await CEL.click('#ypRes .yp-card .btn-ghost'); }
    chk('4. «➕ Cola» desde el celular: entran a la cola del computador', await esperar(PC, () => ['salsaunoxxx', 'salsadosxxx'].every(v => window.vitoMusica.cola().some(x => x.vid === v && !x.done))));
    await CEL.click('#ypOv [data-yp-tab="cola"]');
    chk('4. La cola del celular es la del computador', await esperar(CEL, () => /Salsa uno/i.test(document.getElementById('ypCuerpo').textContent) && /Salsa dos/i.test(document.getElementById('ypCuerpo').textContent)));
    await CEL.evaluate(() => { const f = [...document.querySelectorAll('#ypCuerpo .yp-fila')].find(x => /salsa dos/i.test(x.textContent)); [...f.querySelectorAll('button')].find(b => b.textContent === '🗑').click(); });
    chk('4. 🗑 en el celular la quita en el computador', await esperar(PC, () => !window.vitoMusica.cola().some(x => x.vid === 'salsadosxxx' && !x.done)));
    await CEL.click('#ypSig');
    chk('4. ⏭ en el celular → el computador pasa a la siguiente', await esperar(PC, () => window.__yt.cargados.slice(-1)[0] === 'salsaunoxxx'), await PC.evaluate(() => window.__yt.cargados));
    chk('4. … y el celular lo ve', await esperar(CEL, () => /salsa uno/i.test(document.getElementById('ypTitulo').textContent)));

    // ===== 5. Canción por QR =====
    const msg = JSON.stringify({ t: 'cancion', v: 2, id: 'c-qr-77', mesa: 2, s: 'Grupo Niche Cali Pachanguero', at: Date.now() });
    await PC.route('**/vento-ia/yt/buscar**', rt => rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: [video('nichecali01', 'Cali Pachanguero')] }) }));
    await Promise.all([PC.evaluate(m => window.vitoMod.procesar(m), msg), CEL.evaluate(m => window.vitoMod.procesar(m), msg)]);
    await PC.evaluate(() => window.__yt.main.terminar());
    chk('5. La canción del QR suena en el computador', await esperar(PC, () => window.__yt.cargados.includes('nichecali01')), await PC.evaluate(() => [window.__yt.cargados, window.vitoMusica.cola().map(x => x.song + ':' + x.status + ':' + x.vid)]));
    chk('5. … solo una vez, y el celular no suena ni pide «Activar música automática»', await PC.evaluate(() => window.__yt.cargados.filter(v => v === 'nichecali01').length === 1) && await CEL.evaluate(() => !window.__yt.cargados.length && !window.__toasts.some(t => /Activar música automática/.test(t))));

    // ===== 6. Cambiar al celular =====
    await CEL.evaluate(() => window.vitoPanel.cerrar());
    await CEL.evaluate(() => document.getElementById('mqYo').click());
    await sincronizar(CEL, PC);
    chk('6. El computador se calla', await esperar(PC, () => window.__yt.paradas >= 1 && !window.vitoMod.AUTO()), await PC.evaluate(() => [window.__yt.paradas, window.vitoMod.AUTO()]));
    await CEL.evaluate(() => { const l = window.vitoMod.cola(); l.push({ id: 'otra-1', mesa: 0, mesaNombre: 'Caja', song: 'Otra', title: 'Otra canción', vid: 'otracancion', ok: true, ts: Date.now(), status: 'approved', done: false }); window.vitoMod.SS('vito_cola', l); });
    chk('6. … y ahora la música suena en el celular', await esperar(CEL, () => window.__yt.cargados.length > 0, null, 20000), await CEL.evaluate(() => [window.__yt.cargados, window.vitoMod.AUTO(), window.vitoMusica.cola().map(x => x.title + ':' + x.status)]));
    chk('6. El computador lo dice: «La música suena en «Celular de ana»»', await esperar(PC, () => /suena en «Celular de ana · \w{4}»/.test(document.getElementById('mqTxt').textContent)));
  }
})();
