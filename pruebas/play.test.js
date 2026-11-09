// 🎮 ORDEVA PLAY Fase 1, de punta a punta (PostgreSQL REAL + Servidor ORDEVA de pruebas, la app y pedido.html de verdad, varios
// celulares a la vez).
//  1. Apagado: el QR de la mesa no muestra «Play». El dueño lo activa (Más → 🎮 ORDEVA Play) y la pestaña aparece.
//  2. Tres celulares de la mesa 1 entran con su apodo (sin registrarse), uno crea EL SHOW DE LA MESA y los otros se unen
//     con el código. Juegan: el que acierta suma, la respuesta correcta no viaja antes de tiempo, termina con ganador.
//  3. EL IMPOSTOR: cada celular ve su papel (la palabra o «eres el impostor»), nunca la de los demás.
//  3b. Las pistas se ven a medida que llegan; si un civil escribe la palabra, sale el aviso; votan y se ve el resultado.
//  5. LA BOMBA: quien la tiene ve la cuenta; si falla queda 3 s bloqueado; si acierta, la bomba pasa al otro celular.
//  6. RULETA DEL CAOS: gira, el elegido ve «¡Lo hice!», «Cambiar» y «Paso»; el otro aplaude (+25) y eso es lo que suma.
//  7. ÚLTIMO SOBREVIVIENTE: quien falla sale y el otro gana.
//  8. Sin internet sale «Sin conexión» y se quita al volver; con la pestaña «Pedido» abierta, Play no pregunta nada.
//  9. PLAY no escribe en los canales de los pedidos (canal_mensajes).
//  4. El menú y los pedidos siguen funcionando igual; en 320 px no hay scroll de lado.
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
    await A.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await A.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'bar'; s.dispatchEvent(new Event('change')); } });
    await A.fill('#authBiz', 'Bar Juegos'); await A.fill('#authUser', 'dueno@juegos.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    chk('0. El bar crea su cuenta en la nube', await esperar(A, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    const topic = await A.evaluate(base => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'cv', name: 'Cerveza', price: 4000 }]; saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c); M.reconectarPedidos();
      return c.topic;
    }, BASE);
    const link = await A.evaluate(() => window.vitoMod.linkMesa(window.vitoMod.qCfg(), 1));
    // Los códigos de mesa y el canal quedan en la nube (los usa el servidor para dejar entrar a jugar).
    const listo = await (async () => { for(let i = 0; i < 40; i++){ await A.evaluate(async () => { try{ window.dispatchEvent(new Event('vento-datos-remotos')); await saveData(); }catch(e){} });
      const r = await sb.sql("select (select count(*) from canal_privado where canal = $1)::int c, (select datos->'qrCodigos'->'1' from datos_negocio limit 1) q", [topic]); if(r[0].c && r[0].q) return true; await new Promise(z => setTimeout(z, 600)); } return false; })();
    chk('0. El canal y los códigos de las mesas quedan en la nube', listo);

    // ===== 1 =====
    const C1 = await pagina('cliente1', link);
    await C1.p.waitForTimeout(2500);
    chk('1. Apagado: el QR de la mesa no muestra la pestaña «Play»', await C1.p.evaluate(() => document.getElementById('tg').hidden));
    await A.evaluate(() => window.ventoPlay.panel());
    await A.waitForSelector('.pla-ov .pla-on', { timeout: 15000 });
    await A.evaluate(() => { document.querySelector('.pla-ov .pla-on').checked = true; document.querySelector('.pla-ov .pla-guardar').click(); });
    chk('1. El dueño activa ORDEVA Play (Más → 🎮 ORDEVA Play)', await esperar(A, () => data.playOn === true, null, 15000));
    await C1.p.reload();
    chk('1. … y el QR de la mesa muestra la pestaña «Play»', await esperar(C1.p, () => !document.getElementById('tg').hidden, null, 25000));

    // ===== 2 =====
    const C2 = await pagina('cliente2', link), C3 = await pagina('cliente3', link);
    const entrar = async (C, alias) => {
      await esperar(C.p, () => !document.getElementById('tg').hidden, null, 25000);
      await C.p.click('#tg'); await C.p.waitForSelector('#plAlias', { timeout: 15000 });
      await C.p.fill('#plAlias', alias); await C.p.click('#plEntrar');
      return esperar(C.p, () => !!document.querySelector('.pl-card'), null, 15000);
    };
    chk('2. Ana entra con su apodo y ve los juegos', await entrar(C1, 'Ana'));
    await entrar(C2, 'Beto'); await entrar(C3, 'Caro');
    await C1.p.click('.pl-card[data-j="show"]'); await C1.p.click('[data-modo="mesa"]');
    await C1.p.waitForSelector('.pl-codigo', { timeout: 15000 });
    const cod = (await C1.p.textContent('.pl-codigo')).trim();
    chk('2. Ana crea EL SHOW DE LA MESA: sale el código de la sala', /^[A-Z0-9]{4}$/.test(cod), cod);
    for(const C of [C2, C3]){ await C.p.fill('#plCod', cod); await C.p.click('#plUnirse'); }
    chk('2. Beto y Caro se unen con el código: Ana ve 3 jugadores', await esperar(C1.p, () => document.querySelectorAll('.pl-jug .pl-j').length === 3, null, 20000));
    await C1.p.click('#plEmpezar');
    const todos = [C1, C2, C3];
    for(const C of todos) await esperar(C.p, () => document.querySelectorAll('.pl-op').length === 4, null, 20000);
    chk('2. Empieza en los tres celulares: la pregunta con 4 opciones y el reloj', (await Promise.all(todos.map(C => C.p.evaluate(() => document.querySelectorAll('.pl-op').length === 4 && !!document.querySelector('.pl-q'))))).every(Boolean));
    const sala = (await sb.sql("select id, secreto->>'correcta' c from play_salas where codigo = $1", [cod]))[0];
    chk('2. La respuesta correcta no está en la página de nadie', !(await C2.p.evaluate(() => JSON.stringify(window.ordevaPlay && document.body.innerHTML).includes('"correcta"'))));
    await C1.p.click('.pl-op[data-i="' + sala.c + '"]');
    await C2.p.click('.pl-op[data-i="' + ((+sala.c + 1) % 4) + '"]');
    await C3.p.click('.pl-op[data-i="' + sala.c + '"]');
    chk('2. Cuando los tres respondieron: se marca la correcta en todos', (await Promise.all(todos.map(C => esperar(C.p, () => !!document.querySelector('.pl-op.ok'), null, 15000)))).every(Boolean));
    chk('2. Ana (acertó) dice «¡Acertaste!» y Beto no', await C1.p.evaluate(() => /Acertaste/.test(document.querySelector('.pl-res').textContent)) && await C2.p.evaluate(() => /Esta vez no/.test(document.querySelector('.pl-res').textContent)));
    // Se adelanta el reloj del servidor hasta el final (8 preguntas).
    for(let i = 0; i < 30; i++){ await sb.sql("update play_salas set fase_hasta = now() - interval '1 second' where id = $1 and estado = 'jugando'", [sala.id]); await sb.sql('select public.play_tick($1)', [sala.id]); const e = (await sb.sql('select estado from play_salas where id = $1', [sala.id]))[0].estado; if(e === 'fin') break; }
    chk('2. Termina: los tres ven la tabla final con el ganador 👑', (await Promise.all(todos.map(C => esperar(C.p, () => /gana|Empate/.test((document.querySelector('.pl-hero h2') || {}).textContent || '') && document.querySelectorAll('.pl-rank li').length === 3, null, 20000)))).every(Boolean));
    await C1.p.click('#plOtra'); await C1.p.click('#plRanking');
    chk('2. La clasificación de hoy muestra a los jugadores y a la mesa 1', await esperar(C1.p, () => /Mesa 1/.test(document.body.innerText) && document.querySelectorAll('.pl-rank li').length >= 3, null, 15000));

    // ===== 3 =====
    await C1.p.click('#plVolver'); await C1.p.click('.pl-card[data-j="impostor"]'); await C1.p.click('[data-modo="mesa"]');
    await C1.p.waitForSelector('.pl-codigo', { timeout: 15000 });
    const cod2 = (await C1.p.textContent('.pl-codigo')).trim();
    for(const C of [C2, C3]){ await C.p.click('#plOtra').catch(() => {}); await C.p.waitForSelector('#plCod', { timeout: 15000 }); await C.p.fill('#plCod', cod2); await C.p.click('#plUnirse'); }
    await esperar(C1.p, () => document.querySelectorAll('.pl-jug .pl-j').length === 3, null, 20000);
    await C1.p.click('#plEmpezar');
    for(const C of todos) await esperar(C.p, () => !!document.querySelector('.pl-rol'), null, 20000);
    const roles = await Promise.all(todos.map(C => C.p.evaluate(() => document.querySelector('.pl-rol').innerText)));
    const sec = (await sb.sql("select secreto->>'palabra' p from play_salas where codigo = $1", [cod2]))[0].p;
    const imps = roles.filter(r => /impostor/i.test(r)), civ = roles.filter(r => r.includes(sec));
    chk('3. EL IMPOSTOR: uno solo ve «Eres el impostor» (sin la palabra) y los otros dos ven la palabra', imps.length === 1 && !imps[0].includes(sec) && civ.length === 2, roles);
    const civC = todos.filter((C, i) => !/impostor/i.test(roles[i]));
    await civC[0].p.fill('#plPistaTxt', 'es ' + sec.toLowerCase()); await civC[0].p.click('#plPista button');
    chk('3b. Si un civil escribe la palabra: sale el aviso y la pista no se manda', await esperar(civC[0].p, () => /No digas la palabra/.test((document.querySelector('.pl-aviso') || {}).textContent || '') && !!document.querySelector('#plPistaTxt'), null, 10000));
    await C1.p.fill('#plPistaTxt', 'redondo'); await C1.p.click('#plPista button');
    chk('3b. La pista de Ana la ven los demás de una vez (sin esperar a todos)', await esperar(C2.p, () => /redondo/.test((document.querySelector('.pl-pistas') || {}).textContent || ''), null, 12000));
    await C2.p.fill('#plPistaTxt', 'grande'); await C2.p.click('#plPista button');
    await C3.p.fill('#plPistaTxt', 'bonito'); await C3.p.click('#plPista button');
    chk('3b. Con las tres pistas, todos pasan a votar', (await Promise.all(todos.map(C => esperar(C.p, () => document.querySelectorAll('.pl-op[data-act="votar"]').length === 2, null, 15000)))).every(Boolean));
    for(const C of todos) await C.p.click('.pl-op[data-act="votar"]');
    chk('3b. Votan y todos ven el resultado (quién era y la palabra)', (await Promise.all(todos.map(C => esperar(C.p, w => /Era .*la palabra/.test((document.querySelector('.pl-rol') || {}).innerText || '') && document.querySelector('.pl-rol').innerText.includes(w), sec, 15000)))).every(Boolean));
    const alInicio = async C => { if(await C.p.$('#plSalir')) await C.p.click('#plSalir'); else if(await C.p.$('#plOtra')) await C.p.click('#plOtra'); return esperar(C.p, () => !!document.querySelector('.pl-card'), null, 10000); };
    const crear = async (juego) => { await C1.p.click('.pl-card[data-j="' + juego + '"]'); await C1.p.click('[data-modo="mesa"]'); await C1.p.waitForSelector('.pl-codigo', { timeout: 15000 }); const c = (await C1.p.textContent('.pl-codigo')).trim(); await C2.p.fill('#plCod', c); await C2.p.click('#plUnirse'); await esperar(C1.p, () => document.querySelectorAll('.pl-jug .pl-j').length === 2, null, 15000); await esperar(C1.p, () => !document.getElementById('plEmpezar').disabled, null, 5000); await C1.p.click('#plEmpezar'); return c; };
    for(const C of todos) await alInicio(C);

    // ===== 5 · LA BOMBA =====
    const cb = await crear('bomba');
    let sb5 = null; for(let i = 0; i < 40 && !sb5; i++){ sb5 = (await sb.sql("select id from play_salas where codigo = $1 and estado = 'jugando'", [cb]))[0]; if(!sb5) await new Promise(z => setTimeout(z, 300)); }
    await sb.sql("update play_salas set fase_hasta = now() + interval '90 seconds' where id = $1", [sb5.id]);
    const duo = [C1, C2];
    await Promise.all(duo.map(C => esperar(C.p, () => !!document.querySelector('.pl-bomba'), null, 15000)));
    const quien = async () => { for(let i = 0; i < 30; i++){ for(const C of duo) if(await C.p.$('.pl-bomba.mia')) return C; await new Promise(z => setTimeout(z, 300)); } return null; };
    const H = await quien(), O = duo.find(C => C !== H);
    chk('5. LA BOMBA: quien la tiene ve «¡Tienes la bomba!» y la cuenta; el otro ve quién la tiene', !!H && await H.p.evaluate(() => document.querySelectorAll('.pl-op[data-i]').length === 4) && await esperar(O.p, () => /La tiene/.test(document.querySelector('.pl-bomba').textContent), null, 8000));
    let cc = +(await sb.sql("select secreto->>'correcta' c from play_salas where id = $1", [sb5.id]))[0].c;
    await H.p.click('.pl-op[data-i="' + ((cc + 1) % 4) + '"]');
    chk('5. Si falla: «¡Fallaste! Espera…», las opciones bloqueadas y sigue con la bomba', await esperar(H.p, () => { const b = document.querySelector('.pl-bloq'); return b && !b.hidden && /Fallaste/.test(b.textContent) && [...document.querySelectorAll('.pl-op[data-i]')].every(x => x.disabled) && !!document.querySelector('.pl-bomba.mia'); }, null, 8000));
    chk('5. A los 3 s se puede responder otra vez', await esperar(H.p, () => [...document.querySelectorAll('.pl-op[data-i]')].some(x => !x.disabled), null, 6000));
    cc = +(await sb.sql("select secreto->>'correcta' c from play_salas where id = $1", [sb5.id]))[0].c;
    await H.p.click('.pl-op[data-i="' + cc + '"]');
    chk('5. Si acierta, la bomba pasa al otro celular', await esperar(O.p, () => !!document.querySelector('.pl-bomba.mia'), null, 12000) && await esperar(H.p, () => !document.querySelector('.pl-bomba.mia'), null, 8000));
    for(const C of duo) await alInicio(C);

    // ===== 6 · RULETA DEL CAOS =====
    await crear('ruleta');
    await esperar(C2.p, () => !!document.querySelector('[data-act="girar"]'), null, 15000); await C2.p.click('[data-act="girar"]');
    await Promise.all(duo.map(C => esperar(C.p, () => !!document.querySelector('.pl-reto'), null, 15000)));
    const E = (await C1.p.$('[data-act="cumplir"]')) ? C1 : C2, Ot = E === C1 ? C2 : C1;
    chk('6. RULETA: el elegido ve «¡Lo hice!», «Cambiar reto» y «Paso»; el otro ve «Aplaudir»', await E.p.evaluate(() => !!document.querySelector('[data-act="cumplir"]') && !!document.querySelector('[data-act="cambiar"]') && !!document.querySelector('[data-act="pasar"]')) && await esperar(Ot.p, () => !!document.querySelector('[data-act="aplaudir"]'), null, 8000));
    chk('6. El reto no habla de beber', !/beb|trago|shot|alcohol|cerveza|brind/i.test(await E.p.textContent('.pl-reto')));
    await E.p.click('[data-act="cumplir"]');
    await esperar(Ot.p, () => /Lo cumplió/.test(document.body.innerText) && !!document.querySelector('[data-act="aplaudir"]'), null, 10000);
    await Ot.p.click('[data-act="aplaudir"]');
    chk('6. Después de «¡Lo hice!» el otro aplaude y eso le da +25 (decir que lo hizo no suma solo)', await esperar(Ot.p, () => /Aplaudiste/.test(document.body.innerText) && /\b25\b/.test(document.querySelector('.pl-jug').innerText), null, 10000));
    for(const C of duo) await alInicio(C);

    // ===== 7 · ÚLTIMO SOBREVIVIENTE =====
    const cs = await crear('sobreviviente');
    await Promise.all(duo.map(C => esperar(C.p, () => document.querySelectorAll('.pl-op[data-i]').length === 4, null, 15000)));
    let s7 = null; for(let i = 0; i < 40 && !s7; i++){ s7 = (await sb.sql("select id, secreto->>'correcta' c from play_salas where codigo = $1 and estado = 'jugando'", [cs]))[0]; if(!s7) await new Promise(z => setTimeout(z, 300)); }
    await C1.p.click('.pl-op[data-i="' + s7.c + '"]'); await C2.p.click('.pl-op[data-i="' + ((+s7.c + 1) % 4) + '"]');
    chk('7. SOBREVIVIENTE: quien falla sale («Salen: Beto»)', await esperar(C1.p, () => /Salen: .*Beto/.test(document.body.innerText), null, 12000));
    await sb.sql("update play_salas set fase_hasta = now() - interval '1 second' where id = $1", [s7.id]);
    chk('7. Queda uno solo: Ana gana', await esperar(C2.p, () => /Ana.*gana/.test((document.querySelector('.pl-hero h2') || {}).textContent || ''), null, 15000));
    for(const C of duo) await alInicio(C);

    // ===== 8 · Sin internet y pestaña escondida =====
    await crear('show').catch(() => {});
    await C1.ctx.setOffline(true);
    chk('8. Sin internet: sale «Sin conexión… reintentando»', await esperar(C1.p, () => { const b = document.querySelector('.pl-off'); return b && !b.hidden; }, null, 20000));
    await C1.ctx.setOffline(false);
    chk('8. … y se quita cuando vuelve el internet', await esperar(C1.p, () => { const b = document.querySelector('.pl-off'); return b && b.hidden; }, null, 20000));
    let pedidas = 0; const cuenta = rq => { if(/rpc\/play_estado/.test(rq.url())) pedidas++; }; C2.p.on('request', cuenta);
    await C2.p.click('#tp'); await C2.p.waitForTimeout(500); pedidas = 0; await C2.p.waitForTimeout(8000);
    chk('8. Con la pestaña «Pedido» abierta, Play no pregunta nada al servidor', pedidas === 0, pedidas);
    await C2.p.click('#tg'); await C2.p.waitForTimeout(6000);
    chk('8. Al volver a «Play», sigue al día', pedidas > 0, pedidas);
    C2.p.off('request', cuenta);
    chk('9. PLAY no escribió en los canales de los pedidos', (await sb.sql("select count(*)::int n from canal_mensajes where canal like 'ply%'"))[0].n === 0);

    // ===== 4 =====
    await C2.p.click('#tp');
    chk('4. La pestaña «Pedido» sigue igual (vuelve el menú)', await esperar(C2.p, () => !document.getElementById('vp').hidden && document.getElementById('vg').hidden, null, 5000));
    await C2.p.evaluate(c => fetch('https://canal.vento.local/' + c, { method: 'POST', body: JSON.stringify({ t: 'pedido', v: 2, id: 'pplay' + Date.now().toString(36), mesa: 1, vm: new URL(location.href).searchParams.get('v'), items: [{ n: 'Cerveza', q: 2, p: 4000 }], total: 8000, at: Date.now() }) }), topic);
    chk('4. Un pedido durante el juego entra a la cuenta de la mesa 1', await esperar(A, () => (data.tables[1] && data.tables[1].items || []).some(i => i.name === 'Cerveza'), null, 20000));
    const { p: P } = await pagina('cel320', link, { width: 320, height: 640 });
    await esperar(P, () => !document.getElementById('tg').hidden, null, 25000); await P.click('#tg'); await P.waitForSelector('#plAlias', { timeout: 15000 });
    chk('4. En un celular de 320 px la pantalla de Play no se sale de lado', await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await P.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]));
  }
})();
