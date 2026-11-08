// 🎵 ORDEVA 1.95.4 · La música por el QR «que funcione perfectamente» (revisión goldfish de la música), de punta a punta
// contra el «Supabase local» REAL, con la app y pedido.html de verdad:
//  1. El cliente pide una canción: en «Tus pedidos» ve «🎵 En la cola», luego «🔊 Sonando ahora» y «✅ Ya sonó».
//  2. Una canción que quitan le sale «🚫 La quitaron de la cola», y ya no gasta cupo de la mesa.
//  3. El video que el cliente tocó en la búsqueda viaja con la canción y es el que se pone (no se busca otra versión).
//  4. Sin el código de su mesa (alguien que conoce el canal): no entra a mesas que no existen, el formato de texto viejo ya
//     no crea mesas, y todas esas canciones comparten un solo cupo.
//  5. Con la música apagada no entra y el cliente lo sabe; una que llega 30 min tarde tampoco entra.
//  6. La misma canción otra vez: «ya está en la cola» (no gasta cupo). Muchas búsquedas (429): no dice «no encontramos nada».
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
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('✗ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
  try{ await pruebas(); } catch(e){ mal++; console.log('✗ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pagina(nombre, url, vw){
    const ctx = await b.newContext({ viewport: vw || { width: 390, height: 844 }, locale: 'es-CO' });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(url); return { ctx, p };
  }
  async function pruebas(){
    const { p: A } = await pagina('negocio', BASE + '/index.html', { width: 1280, height: 800 });
    await A.waitForSelector('#authOverlay:not([hidden])');
    await A.fill('#authBiz', 'Bar Musica QR'); await A.fill('#authUser', 'ana'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    await A.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await A.evaluate(base => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      for(let i = 1; i <= 3; i++) data.tables[i] = data.tables[i] || { items: [], people: [] };
      Object.keys(data.tables).forEach(k => { if(+k > 3) delete data.tables[k]; }); data.tableCount = 3;
      data.cancionesMesa = 10; data.musicOn = true; saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c);
      M.reconectarPedidos();
    }, BASE);
    const topic = await A.evaluate(() => window.vitoMod.qCfg().topic);
    const link = m => A.evaluate(m => window.vitoMod.linkMesa(window.vitoMod.qCfg(), m), m);
    const colaDe = s => A.evaluate(s => window.vitoMod.cola().find(x => x.song === s || x.pedido === s) || null, s);
    const C = await pagina('cliente', await link(1));
    async function pedir(nombre){
      await C.p.click('#tc'); await C.p.fill('#s', nombre); await C.p.click('#b');
      await esperar(C.p, () => !document.getElementById('b').disabled, null, 15000);
    }
    const estPed = () => C.p.evaluate(() => document.getElementById('estPed').innerText);

    // ===== 1 =====
    await pedir('Cancion de prueba uno');
    chk('1. La canción llega a la cola del negocio con el id del cliente', await esperar(A, () => window.vitoMod.cola().some(x => x.song === 'Cancion de prueba uno' && /^c/.test(x.reqId || '')), null, 20000));
    chk('1. El cliente la ve en «Tus pedidos» como «🎵 En la cola»', await esperar(C.p, () => /Cancion de prueba uno/.test(document.getElementById('estPed').innerText) && /En la cola/.test(document.getElementById('estPed').innerText), null, 20000), await estPed());
    const id1 = (await colaDe('Cancion de prueba uno')).id;
    await A.evaluate(id => window.vitoMod.mzEmpezo(id, 'app'), id1);
    chk('1. Empieza a sonar: el cliente ve «🔊 Sonando ahora»', await esperar(C.p, () => /Sonando ahora/.test(document.getElementById('estPed').innerText), null, 20000), await estPed());
    await A.evaluate(id => window.vitoMod.mzTermino(id, 'played'), id1);
    chk('1. Termina: el cliente ve «✅ Ya sonó»', await esperar(C.p, () => /Ya sonó/.test(document.getElementById('estPed').innerText), null, 20000), await estPed());

    // ===== 2 =====
    await A.evaluate(() => { data.cancionesMesa = 2; saveData(); });
    await A.evaluate(() => { window.vitoMod.cola().filter(x => x.mesa === 1).forEach(x => window.vitoMusica.cancelar(x.id)); });
    await pedir('Cancion dos A'); await pedir('Cancion dos B');
    chk('2. Con 2 por mesa, entran 2 canciones', await esperar(A, () => window.vitoMod.cola().filter(x => x.mesa === 1 && /^Cancion dos/.test(x.song) && x.status !== 'cancelled').length === 2, null, 20000));
    const idB = (await colaDe('Cancion dos B')).id;
    await A.evaluate(id => window.vitoMusica.cancelar(id), idB);
    chk('2. La quitan: el cliente ve «🚫 La quitaron de la cola»', await esperar(C.p, () => /La quitaron de la cola/.test(document.getElementById('estPed').innerText), null, 20000), await estPed());
    await C.p.evaluate(() => { localStorage.clear(); });   // el cupo lo manda el negocio (la mesa), no el celular
    await C.p.reload(); await C.p.waitForTimeout(1500);
    await pedir('Cancion dos C');
    chk('2. … y la quitada ya no gasta cupo: entra otra', await esperar(A, () => window.vitoMod.cola().some(x => x.song === 'Cancion dos C' && x.status !== 'cancelled'), null, 20000),
      await A.evaluate(() => window.vitoMod.cola().filter(x => x.mesa === 1).map(x => [x.song, x.status])));
    await A.evaluate(() => { data.cancionesMesa = 10; saveData(); });

    // ===== 3 =====
    await C.p.evaluate(() => { const w = document.createElement('div'); w.id = 'pruebaYt'; document.body.appendChild(w);
      ytPintarCanciones(w, 'mi cancion', [{ title: 'Mi Cancion Oficial', channelTitle: 'Artista', thumb: '', vid: 'abcDEF12345' }]); });
    await C.p.click('#tc');
    await C.p.click('#pruebaYt .ytpedir');
    chk('3. El video que tocó el cliente llega con la canción (vid0)', await esperar(A, () => window.vitoMod.cola().some(x => x.song === 'Mi Cancion Oficial' && x.vid0 === 'abcDEF12345'), null, 20000),
      await colaDe('Mi Cancion Oficial'));
    chk('3. … y es el que se pone (no se busca otra versión)', await esperar(A, () => { const x = window.vitoMod.cola().find(y => y.song === 'Mi Cancion Oficial'); return !!x && x.vid === 'abcDEF12345'; }, null, 20000), await colaDe('Mi Cancion Oficial'));

    // ===== 4 =====
    const post = (cuerpo, canal) => C.p.evaluate(([c, body]) => fetch('https://canal.vento.local/' + c, { method: 'POST', body }).then(r => r.ok), [canal || topic, typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)]);
    await post({ t: 'cancion', v: 2, id: 'cfalsa1' + Date.now().toString(36), mesa: 99, vm: 'nadielosabe', s: 'Cancion mesa inventada', at: Date.now() });
    await post('CANCION MESA 77: Cancion texto viejo');
    await A.waitForTimeout(3500);
    v = await A.evaluate(() => ({ en: window.vitoMod.cola().filter(x => /inventada|texto viejo/.test(x.song)).length, t99: !!data.tables[99], t77: !!data.tables[77], n: data.tableCount }));
    chk('4. Sin código, a una mesa que no existe (99): no entra y no se crea la mesa', v.en === 0 && !v.t99, v);
    chk('4. El formato de texto viejo («CANCION MESA 77») ya no crea la mesa 77', !v.t77 && v.n === 3, v);
    await A.evaluate(() => { data.cancionesMesa = 2; saveData(); });
    for(let i = 1; i <= 3; i++) await post({ t: 'cancion', v: 2, id: 'csc' + i + Date.now().toString(36), mesa: i, vm: 'falso' + i, s: 'Sin codigo ' + i, at: Date.now() });
    chk('4. Las canciones sin código (de mesas que sí existen) comparten UN cupo: con 2, entran 2 de 3', await esperar(A, () => window.vitoMod.cola().filter(x => /^Sin codigo/.test(x.song)).length === 2, null, 15000) && await A.evaluate(() => { const l = window.vitoMod.cola().filter(x => /^Sin codigo/.test(x.song)); return l.every(x => x.sc); }),
      await A.evaluate(() => window.vitoMod.cola().filter(x => /^Sin codigo/.test(x.song)).map(x => [x.mesa, x.sc])));
    await A.waitForTimeout(1500);
    chk('4. … y no le quitan el cupo a la mesa de verdad (la mesa 3 con su QR sí puede pedir)', await (async () => {
      const C3 = await pagina('cliente3', await link(3)); await C3.p.click('#tc'); await C3.p.fill('#s', 'Cancion mesa tres'); await C3.p.click('#b');
      return esperar(A, () => window.vitoMod.cola().some(x => x.song === 'Cancion mesa tres' && x.mesa === 3 && !x.sc), null, 20000); })());
    await A.evaluate(() => { data.cancionesMesa = 10; saveData(); });

    // ===== 5 =====
    await A.evaluate(() => { data.musicOn = false; saveData(); });
    await pedir('Cancion con musica apagada');
    chk('5. Con la música apagada no entra', !(await A.evaluate(() => window.vitoMod.cola().some(x => x.song === 'Cancion con musica apagada'))));
    chk('5. … y el cliente lo sabe: «El local tiene la música apagada»', await esperar(C.p, () => /música apagada/i.test(document.getElementById('m').textContent), null, 20000), await C.p.evaluate(() => document.getElementById('m').textContent));
    await A.evaluate(() => { data.musicOn = true; saveData(); });
    const vm1 = new URL(await link(1)).searchParams.get('v');
    await post({ t: 'cancion', v: 2, id: 'cvieja' + Date.now().toString(36), mesa: 1, vm: vm1, s: 'Cancion de hace media hora', at: Date.now() - 30 * 60000 });
    await A.waitForTimeout(3000);
    chk('5. Una canción que llega 30 min tarde (estuvo sin conexión) no entra', !(await A.evaluate(() => window.vitoMod.cola().some(x => x.song === 'Cancion de hace media hora'))));

    // ===== 6 =====
    await pedir('Cancion repetida');
    await esperar(A, () => window.vitoMod.cola().some(x => x.song === 'Cancion repetida'), null, 15000);
    await pedir('Cancion repetida');
    chk('6. La misma canción otra vez: «Esa canción ya está en la cola»', await esperar(C.p, () => /ya está en la cola/i.test(document.getElementById('m').textContent), null, 20000), await C.p.evaluate(() => document.getElementById('m').textContent));
    chk('6. … y queda una sola en la cola', (await A.evaluate(() => window.vitoMod.cola().filter(x => x.song === 'Cancion repetida').length)) === 1);
    await C.ctx.route(/\/yt\/buscar/, r => r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"muchas"}' }));
    await C.p.evaluate(() => ytBuscar('una cancion cualquiera'));
    chk('6. Si el servidor dice «muchas búsquedas» (429), el cliente lo ve así y no «No encontramos nada»', await esperar(C.p, () => /muchas búsquedas/i.test(document.getElementById('ytPrev').innerText), null, 15000), await C.p.evaluate(() => document.getElementById('ytPrev').innerText));
  }
  var v;
})();
