// 🏆 ORDEVA PLAY Fase 2: torneo entre mesas, de punta a punta (PostgreSQL REAL + Servidor ORDEVA de pruebas, la app y
// pedido.html de verdad, cuatro celulares en dos mesas).
//  1. El dueño activa PLAY y empieza un torneo en Más → 🎮 ORDEVA Play → 🏆 Torneo entre mesas.
//  2. Los clientes ven la tarjeta «Torneo de mesas · faltan N min» y que su mesa todavía no suma.
//  3. La mesa 1 juega una partida: al terminar dice «sumó al torneo» y la tarjeta dice «tu mesa va 1.ª».
//  4. La mesa 2 juega otra y empata: va 2.ª (la mesa 1 llegó primero). La pantalla del torneo muestra la tabla y la regla.
//  5. El panel del negocio muestra la tabla y se refresca solo. El dueño lo termina (pregunta antes) y ve la mesa ganadora.
//  6. Los clientes ven «Ganó la Mesa 1». PLAY no escribe en los canales de los pedidos.
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
  let ok = 0, mal = 0; const errs = [], dialogos = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 20000, polling: 300 }).then(() => true, () => false);
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
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
    A.on('dialog', d => { dialogos.push(d.message()); d.accept().catch(() => {}); });
    await A.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await A.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'bar'; s.dispatchEvent(new Event('change')); } });
    await A.fill('#authBiz', 'Bar Torneo'); await A.fill('#authUser', 'dueno@torneo.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    chk('0. El bar crea su cuenta en la nube', await esperar(A, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    const topic = await A.evaluate(base => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'cv', name: 'Cerveza', price: 4000 }]; saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c); M.reconectarPedidos();
      return c.topic;
    }, BASE);
    const [link1, link2] = await A.evaluate(() => [1, 2].map(m => window.vitoMod.linkMesa(window.vitoMod.qCfg(), m)));
    const listo = await (async () => { for(let i = 0; i < 40; i++){ await A.evaluate(async () => { try{ window.dispatchEvent(new Event('vento-datos-remotos')); await saveData(); }catch(e){} });
      const r = await sb.sql("select (select count(*) from canal_privado where canal = $1)::int c, (select datos->'qrCodigos'->'2' from datos_negocio limit 1) q", [topic]); if(r[0].c && r[0].q) return true; await new Promise(z => setTimeout(z, 600)); } return false; })();
    chk('0. El canal y los códigos de las mesas quedan en la nube', listo);

    // ===== 1 · El dueño activa PLAY y empieza el torneo =====
    await A.evaluate(() => window.ventoPlay.panel());
    await A.waitForSelector('.pla-ov .pla-on', { timeout: 15000 });
    chk('1. Con PLAY apagado el panel dice que primero hay que activarlo (no deja empezar un torneo)', await esperar(A, () => /Activa ORDEVA Play/.test((document.querySelector('.pla-torneo') || {}).textContent || '') && !document.querySelector('.pla-t-ini'), null, 10000));
    await A.evaluate(() => { document.querySelector('.pla-ov .pla-on').checked = true; document.querySelector('.pla-ov .pla-guardar').click(); });
    await esperar(A, () => data.playOn === true && !document.querySelector('.pla-ov'), null, 15000);
    await A.evaluate(() => window.ventoPlay.panel());
    await A.waitForSelector('.pla-t-ini', { timeout: 15000 });
    await A.selectOption('.pla-t-min', '30'); await A.click('.pla-t-ini');
    chk('1. El dueño empieza un torneo de 30 minutos: el panel dice «Torneo en curso · faltan 30 min» y «Terminar ahora»', await esperar(A, () => /Torneo en curso · faltan (30|29) min/.test((document.querySelector('.pla-t-estado') || {}).textContent || '') && !!document.querySelector('.pla-t-fin'), null, 15000));
    chk('1. … y explica la regla en una línea', await A.evaluate(() => /hasta 100 puntos.*5 mejores partidas.*Ruleta no suma/.test(document.querySelector('.pla-torneo').textContent)));

    // ===== 2 · Los clientes ven la tarjeta =====
    const C1 = await pagina('m1-ana', link1), C2 = await pagina('m1-beto', link1), C3 = await pagina('m2-caro', link2), C4 = await pagina('m2-dani', link2);
    const entrar = async (C, alias) => {
      await esperar(C.p, () => !document.getElementById('tg').hidden, null, 25000);
      await C.p.click('#tg'); await C.p.waitForSelector('#plAlias', { timeout: 15000 });
      await C.p.fill('#plAlias', alias); await C.p.click('#plEntrar');
      return esperar(C.p, () => !!document.querySelector('.pl-card'), null, 15000);
    };
    await entrar(C1, 'Ana'); await entrar(C2, 'Beto'); await entrar(C3, 'Caro'); await entrar(C4, 'Dani');
    chk('2. Ana ve la tarjeta «🏆 Torneo de mesas · faltan N min» y que su mesa todavía no suma', await esperar(C1.p, () => { const t = (document.querySelector('#plTorneo') || {}).textContent || ''; return /Torneo de mesas · faltan \d+ min/.test(t) && /todavía no suma/.test(t); }, null, 15000));

    // Una partida de ÚLTIMO SOBREVIVIENTE entre dos celulares de la misma mesa: el primero acierta y el segundo falla.
    const jugar = async (G, P) => {
      await G.p.click('.pl-card[data-j="sobreviviente"]'); await G.p.click('[data-modo="mesa"]'); await G.p.waitForSelector('.pl-codigo', { timeout: 15000 });
      const cod = (await G.p.textContent('.pl-codigo')).trim();
      await P.p.fill('#plCod', cod); await P.p.click('#plUnirse');
      await esperar(G.p, () => document.querySelectorAll('.pl-jug .pl-j').length === 2 && !document.getElementById('plEmpezar').disabled, null, 15000);
      await G.p.click('#plEmpezar');
      await Promise.all([G, P].map(C => esperar(C.p, () => document.querySelectorAll('.pl-op[data-i]').length === 4, null, 15000)));
      let s = null; for(let i = 0; i < 40 && !s; i++){ s = (await sb.sql("select id, secreto->>'correcta' c from play_salas where codigo = $1 and estado = 'jugando'", [cod]))[0]; if(!s) await new Promise(z => setTimeout(z, 300)); }
      await G.p.click('.pl-op[data-i="' + s.c + '"]'); await P.p.click('.pl-op[data-i="' + ((+s.c + 1) % 4) + '"]');
      await esperar(G.p, () => /Salen:/.test(document.body.innerText), null, 12000);
      await sb.sql("update play_salas set fase_hasta = now() - interval '1 second' where id = $1 and estado = 'jugando'", [s.id]);
      return esperar(G.p, () => /gana/.test((document.querySelector('.pl-hero h2') || {}).textContent || ''), null, 15000);
    };

    // ===== 3 · La mesa 1 juega =====
    chk('3. Ana y Beto (mesa 1) juegan una partida y Ana gana', await jugar(C1, C2));
    chk('3. Al terminar, el servidor dice que la partida sumó al torneo (en los dos celulares)', (await Promise.all([C1, C2].map(C => esperar(C.p, () => { const e = document.querySelector('#plTorneoFin'); return e && !e.hidden && /sumó al torneo de mesas/.test(e.textContent); }, null, 15000)))).every(Boolean));
    await C1.p.click('#plOtra');
    chk('3. En el inicio la tarjeta dice «Tu mesa va 1.ª de 1» con sus puntos', await esperar(C1.p, () => /Tu mesa va 1\.ª de 1 · \d+ puntos/.test((document.querySelector('#plTorneo') || {}).textContent || ''), null, 20000), await C1.p.evaluate(() => (document.querySelector('#plTorneo') || {}).textContent));
    await C2.p.click('#plOtra');

    // ===== 4 · La mesa 2 juega y empata =====
    chk('4. Caro y Dani (mesa 2) juegan su partida', await jugar(C3, C4));
    await C3.p.click('#plOtra');
    chk('4. Empate de puntos: la mesa 2 va 2.ª de 2 (la mesa 1 llegó primero)', await esperar(C3.p, () => /Tu mesa va 2\.ª de 2/.test((document.querySelector('#plTorneo') || {}).textContent || ''), null, 20000), await C3.p.evaluate(() => (document.querySelector('#plTorneo') || {}).textContent));
    await C3.p.click('#plTorneo');
    chk('4. La pantalla del torneo: la tabla con la Mesa 1 de primera (👑, con el apodo) y la Mesa 2 «(tu mesa)»', await esperar(C3.p, () => { const f = [...document.querySelectorAll('#plTorneoTabla li')].map(x => x.textContent); return f.length === 2 && /👑 Mesa 1/.test(f[0]) && /Ana/.test(f[0]) && /Mesa 2 \(tu mesa\)/.test(f[1]); }, null, 15000), await C3.p.evaluate(() => (document.querySelector('#plTorneoTabla') || {}).textContent));
    chk('4. … con el tiempo que falta y la regla en una línea', await C3.p.evaluate(() => /Faltan \d+ minutos/.test(document.querySelector('.pl-hero').textContent) && /hasta 100 puntos.*5 mejores partidas.*Ruleta/.test(document.body.innerText)));
    chk('4. En 320 px la pantalla del torneo no se sale de lado', await (async () => { await C3.p.setViewportSize({ width: 320, height: 640 }); const r = await C3.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); await C3.p.setViewportSize({ width: 390, height: 844 }); return r; })());

    // ===== 5 · El panel del negocio =====
    chk('5. El panel del negocio muestra la tabla (se refresca solo): Mesa 1 y Mesa 2', await esperar(A, () => { const t = (document.querySelector('.pla-t-tabla') || {}).textContent || ''; return /👑 Mesa 1/.test(t) && /2\. Mesa 2/.test(t); }, null, 25000), await A.evaluate(() => (document.querySelector('.pla-t-tabla') || {}).textContent));
    await A.click('.pla-t-fin');
    chk('5. «Terminar ahora» pregunta antes y avisa que las partidas sin terminar no suman', dialogos.some(d => /Terminar el torneo ahora/.test(d) && /no suman/.test(d)), dialogos);
    chk('5. El panel muestra el resultado: «Último torneo: ganó la Mesa 1 · Ana» y deja empezar otro', await esperar(A, () => /Último torneo: ganó la Mesa 1 · Ana/.test((document.querySelector('.pla-t-res') || {}).textContent || '') && !!document.querySelector('.pla-t-ini'), null, 15000), await A.evaluate(() => (document.querySelector('.pla-torneo') || {}).textContent));

    // El dueño elige 2 horas para el siguiente. Pasa el tiempo (aquí se adelanta 3 minutos el torneo ya terminado) y el panel
    // se repasa solo: la duración elegida NO vuelve a «1 hora».
    await A.selectOption('.pla-t-min', '120');
    await sb.sql("update play_torneos set inicio = inicio - interval '3 minutes', fin = fin - interval '3 minutes' where cerrado is not null");
    await A.waitForTimeout(12500);
    chk('5. Con un torneo recién terminado en pantalla, la duración elegida para el siguiente (2 horas) no se cambia sola', await A.evaluate(() => document.querySelector('.pla-t-min').value === '120'));

    // ===== 6 · Los clientes ven quién ganó =====
    chk('6. Caro (en la pantalla del torneo) ve «Ganó la Mesa 1 · Ana» sin recargar', await esperar(C3.p, () => /Ganó la Mesa 1 · Ana/.test((document.querySelector('.pl-hero') || {}).textContent || ''), null, 30000));
    await C1.p.click('#plRanking'); await C1.p.waitForSelector('#plVolver', { timeout: 10000 }); await C1.p.click('#plVolver');
    chk('6. Ana ve en el inicio «🏆 Torneo de mesas terminado · Ganó la Mesa 1»', await esperar(C1.p, () => { const t = (document.querySelector('#plTorneo') || {}).textContent || ''; return /Torneo de mesas terminado/.test(t) && /Ganó la Mesa 1/.test(t); }, null, 20000));
    chk('6. El menú y los pedidos siguen igual: la pestaña «Pedido» vuelve', await (async () => { await C2.p.click('#tp'); return esperar(C2.p, () => !document.getElementById('vp').hidden && document.getElementById('vg').hidden, null, 5000); })());
    chk('6. PLAY no escribió en los canales de los pedidos', (await sb.sql("select count(*)::int n from canal_mensajes where canal like 'ply%'"))[0].n === 0);
  }
})();
