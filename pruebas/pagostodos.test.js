// ⚡ 1.65.4: el pago llega AL MISMO TIEMPO a TODOS los equipos del negocio, de punta a punta (PostgreSQL REAL + Servidor
// ORDEVA + la app de verdad) con un celular (app Android), un computador y una tableta (navegador). El Supabase Realtime
// se simula aquí igual que el de verdad: lo que el servidor manda con realtime.send llega a quien se unió a ese canal.
//  1. Cada equipo se une al canal en vivo secreto del negocio («vp-…»), el mismo para todos.
//  2. Llega un pago: aparece en los tres equipos casi al mismo tiempo (menos de 1,5 s), sin esperar la pregunta de
//     respaldo (6 a 20 s). Y otra vez con un segundo pago.
//  3. Se cae la conexión en vivo de la tableta: vuelve sola en segundos y el siguiente pago le llega al instante.
//  4. Computador o tableta en el navegador: ofrece las notificaciones push (para cuando ORDEVA esté cerrada); en la app
//     Android no.
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
  let reenvio = null;
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  clearInterval(reenvio);
  chk('Sin errores de página en ningún equipo', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    // ---------- Supabase Realtime de mentira: realtime.send → a quien se unió a ese canal ----------
    await sb.sql(`create schema if not exists realtime;
      create table if not exists realtime.enviados(id bigserial primary key, payload jsonb, evento text, topic text);
      create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ insert into realtime.enviados(payload, evento, topic) values (payload, event, topic) $$;`);
    const conexiones = [];   // { nombre, ws, temas:Set, v2 }
    let ultimoEnviado = 0;
    const msg = (cx, topic, event, payload, ref, joinRef) => cx.v2 ? JSON.stringify([joinRef || null, ref || null, topic, event, payload]) : JSON.stringify({ topic, event, payload, ref: ref || null });
    reenvio = setInterval(async () => {
      let l; try{ l = await sb.sql('select id, payload, evento, topic from realtime.enviados where id > $1 order by id', [ultimoEnviado]); }catch(e){ return; }
      for(const r of l){
        ultimoEnviado = Math.max(ultimoEnviado, Number(r.id));
        for(const cx of conexiones) if(cx.abierta && cx.temas.has('realtime:' + r.topic)) cx.ws.send(msg(cx, 'realtime:' + r.topic, 'broadcast', { event: r.evento, payload: r.payload, type: 'broadcast' }));
      }
    }, 40);
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 50 }).then(() => true, () => false);
    async function equipo(nombre, ancho, android){
      const ctx = await b.newContext({ viewport: { width: ancho, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.routeWebSocket(/supabase\.co\/realtime/, ws => {
        const cx = { nombre, ws, temas: new Set(), v2: /vsn=2/.test(ws.url()), abierta: true }; conexiones.push(cx);
        ws.onClose(() => { cx.abierta = false; });
        ws.onMessage(m => {
          let j; try{ j = JSON.parse(String(m)); }catch(e){ return; }
          const [joinRef, ref, topic, event, payload] = Array.isArray(j) ? j : [j.join_ref, j.ref, j.topic, j.event, j.payload];
          if(event === 'phx_join'){
            cx.temas.add(topic);
            const pc = payload && payload.config && payload.config.postgres_changes;
            const resp = pc && pc.length ? { postgres_changes: pc.map((x, i) => Object.assign({ id: i + 1 }, x)) } : {};
            ws.send(msg(cx, topic, 'phx_reply', { status: 'ok', response: resp }, ref, joinRef));
          } else if(event === 'heartbeat' || event === 'access_token'){
            ws.send(msg(cx, topic, 'phx_reply', { status: 'ok', response: {} }, ref, joinRef));
          } else if(event === 'phx_leave'){ cx.temas.delete(topic); ws.send(msg(cx, topic, 'phx_reply', { status: 'ok', response: {} }, ref, joinRef)); }
        });
      });
      await ctx.addInitScript(android => {
        try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-push-prueba', '1'); }catch(e){}
        const A = window.__and = { cola: [], notifs: [], pagos: [], decir: [] };
        // El Chrome sin pantalla de las pruebas siempre dice «denied»: aquí, como la primera vez en un equipo (no ha elegido).
        if(!android && window.Notification) try{ Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'default' }); }catch(e){}
        if(android) window.VentoAndroid = {
          pagosAvisos: () => {}, pagosAvisosEstado: () => JSON.stringify({ on: true, permiso: true, vivo: true }),
          pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
          notificar: (t, x, c, s) => { A.notifs.push({ t, x, c, s }); return true; },
          pagoNotificar: (t, f, o, v, bco, tipo) => { A.pagos.push({ t, f, o, v, bco, tipo }); },
          pagosDecir: t => { A.decir.push(String(t)); },
          pagosNotif: () => {}, pagosVolumen: () => {}, ventanaPagoOn: () => {}, alFrente: () => false,
          pagosCruce: j => { A.cruce = j; }, pagosCruceEstado: () => '{}',
          pagoReclamar: id => { A.reclamados = A.reclamados || []; if(A.reclamados.includes(id)) return false; A.reclamados.push(id); return true; },
          pagosVozOn: () => {}, pagosSuena: () => {}, pagosVozEstado: () => true,
          permisos: () => JSON.stringify({ avisos: true, bateria: true, fondo: true }), fabricante: () => 'Samsung|SM-A346M',
        };
      }, !!android);
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { nombre, ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    async function entrar(E){
      await E.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
      await E.p.fill('#authUser', 'dueno@todos.co'); await E.p.fill('#authPass', 'clave123'); await E.p.click('#authBtn');
      const d = await dentro(E.p); await E.p.click('#onbSaltar', { timeout: 3000 }).catch(() => {}); await cerrarTodo(E.p);
      return d;
    }

    // ===== Tres equipos del mismo negocio =====
    const CEL = await equipo('celular', 390, true);
    await CEL.p.fill('#authBiz', 'Bar Todos'); await CEL.p.fill('#authUser', 'dueno@todos.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('El celular crea la cuenta y entra', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio(), null, 15000);
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    const PC = await equipo('computador', 1280, false), TAB = await equipo('tableta', 800, false);
    chk('El computador y la tableta entran con la misma cuenta', await entrar(PC) && await entrar(TAB));
    const EQ = [CEL, PC, TAB];

    // ===== 1. Todos unidos al canal en vivo del negocio =====
    for(const E of EQ) await esperar(E.p, () => window.ventoPagos && window.ventoPagos.estado().avisoVivoOk === true, null, 20000);
    const canal = (await sb.sql("select 'vp-' || canal as c from pagos_canal_vivo where negocio_id = $1", [NEG]))[0];
    const unidos = EQ.map(E => conexiones.some(c => c.nombre === E.nombre && c.abierta && canal && c.temas.has('realtime:' + canal.c)));
    chk('1. Celular, computador y tableta están unidos al canal en vivo secreto del negocio (el mismo para todos)', !!canal && unidos.every(Boolean) && !canal.c.includes(NEG), { canal: canal && canal.c, unidos });
    for(const E of EQ) await E.p.evaluate(() => { window.ventoPagos.estado().ultimoSync = Date.now(); });   // la pregunta de respaldo no se adelanta

    // ===== 2. Llega un pago: a todos al mismo tiempo =====
    async function pago(monto){
      const t0 = Date.now();
      const r = (await sb.sql(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, confianza, verificado, aprobado_en)
        values ($1, $2, 'dispositivo', 'NEQUI', 'notificacion', $3, 'aprobado', 'app', false, now()) returning id`, [NEG, 'AV-todos-' + monto, monto]))[0];
      const tiempos = await Promise.all(EQ.map(async E => (await esperar(E.p, id => !!window.ventoPagos._cache[id], r.id, 8000)) ? Date.now() - t0 : -1));
      return tiempos;
    }
    let t = await pago(12000);
    chk('2. Un pago de $12.000 aparece en los TRES equipos en menos de 1,5 s (celular ' + t[0] + ' ms, computador ' + t[1] + ' ms, tableta ' + t[2] + ' ms)', t.every(x => x >= 0 && x < 1500), t);
    chk('2. … casi al mismo tiempo en todos (diferencia ' + (Math.max(...t) - Math.min(...t)) + ' ms)', Math.max(...t) - Math.min(...t) < 1000, t);
    for(const E of EQ) await E.p.evaluate(() => { window.ventoPagos.estado().ultimoSync = Date.now(); });
    t = await pago(13000);
    chk('2. Un segundo pago también (' + t.join(' / ') + ' ms)', t.every(x => x >= 0 && x < 1500), t);

    // ===== 3. Se cae la conexión en vivo de la tableta =====
    for(const c of conexiones.filter(c => c.nombre === 'tableta' && c.abierta)) await c.ws.close();
    chk('3. Se cae la conexión en vivo de la tableta: vuelve sola en segundos', await esperar(TAB.p, nc => window.ventoPagos.estado().avisoVivoOk === true, null, 20000) &&
      conexiones.some(c => c.nombre === 'tableta' && c.abierta && c.temas.has('realtime:' + canal.c)));
    for(const E of EQ) await E.p.evaluate(() => { window.ventoPagos.estado().ultimoSync = Date.now(); });
    t = await pago(14000);
    chk('3. … y el siguiente pago le llega al instante (' + t[2] + ' ms)', t.every(x => x >= 0 && x < 1500), t);

    // ===== 3b. Equipos en segundo plano (pantalla bloqueada o ventana escondida): notificación del sistema al instante =====
    for(const E of [PC, TAB]) await E.p.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      window.__notifs = [];
      const N = function(t, o){ window.__notifs.push({ t, o, ms: Date.now() }); }; N.permission = 'granted'; N.requestPermission = () => Promise.resolve('granted');
      window.Notification = N;
      window.ventoPagos.estado().ultimoSync = Date.now();
    });
    await CEL.p.evaluate(() => { window.ventoPagos.estado().ultimoSync = Date.now(); });
    const t3b = Date.now();
    const pb = (await sb.sql(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, confianza, verificado, aprobado_en)
      values ($1, 'AV-todos-15000', 'dispositivo', 'NEQUI', 'notificacion', 15000, 'aprobado', 'app', false, now()) returning id`, [NEG]))[0];
    const notif = await Promise.all([PC, TAB].map(async E => (await esperar(E.p, () => window.__notifs.some(n => /Recibiste \$15\.000/.test(n.t)), null, 6000)) ? Date.now() - t3b : -1));
    const tagOk = await PC.p.evaluate(id => window.__notifs.some(n => n.o && n.o.tag === 'pago-' + id), pb.id);
    chk('3. Con el computador y la tableta en segundo plano (bloqueados o escondidos): notificación del sistema «💜 Recibiste $15.000» en los dos al instante (' + notif.join(' / ') + ' ms)', notif.every(x => x >= 0 && x < 1500), notif);
    chk('3. … con la misma marca que la push del servidor («pago-<id>»): no suena dos veces', tagOk);

    // ===== 3c. 1.65.7: app Android con ORDEVA ABIERTA (desbloqueado): suena Android, no la página =====
    // (Con el celular bloqueado ya sonaba Android; abierto, la página lo reclamaba y si algo suyo fallaba, no sonaba.)
    await CEL.p.evaluate(() => { const A = window.VentoAndroid, a = window.__and; a.cruceYa = 0; a.pagos = []; a.decir = []; a.reclamados = [];
      A.pagosCruceYa = () => { a.cruceYa++; return true; }; A.pagosCruceEstado = () => JSON.stringify({ t: Date.now(), ok: true });
      window.ventoPagos.estado().ultimoSync = Date.now(); });
    await sb.sql(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, confianza, verificado, aprobado_en)
      values ($1, 'AV-todos-16000', 'dispositivo', 'NEQUI', 'notificacion', 16000, 'aprobado', 'app', false, now())`, [NEG]);
    const and3c = await esperar(CEL.p, () => window.__and.cruceYa > 0, null, 6000) && await CEL.p.evaluate(() => JSON.parse(JSON.stringify(window.__and)));
    chk('3c. App Android abierta: la página le pide a Android que lo haga sonar ya (con su voz, notificación y ventana)', !!and3c && and3c.cruceYa === 1, and3c);
    chk('3c. … y la página no lo suena ni lo reclama (no suena dos veces); se ve en pantalla', !!and3c && !and3c.pagos.length && !and3c.decir.some(t => /16000/.test(t)) && !(and3c.reclamados || []).length &&
      /16\.000/.test(await CEL.p.textContent('#toast')), and3c);
    // Si Android no responde (su revisión lleva rato sin contestar), la página suena como antes: nunca queda en silencio.
    await CEL.p.evaluate(() => { window.VentoAndroid.pagosCruceEstado = () => JSON.stringify({ t: Date.now() - 120000, ok: true }); window.__and.pagos = []; window.ventoPagos.estado().ultimoSync = Date.now(); });
    await sb.sql(`insert into pagos(negocio_id, referencia, proveedor, metodo, canal, monto, estado, confianza, verificado, aprobado_en)
      values ($1, 'AV-todos-17000', 'dispositivo', 'NEQUI', 'notificacion', 17000, 'aprobado', 'app', false, now())`, [NEG]);
    chk('3c. Si Android no responde, suena la página (notificación y voz con «$17.000»)', await esperar(CEL.p, () => window.__and.pagos.some(x => x.v === '$17.000'), null, 6000), await CEL.p.evaluate(() => JSON.parse(JSON.stringify(window.__and))));

    // ===== 4. Notificaciones push para cuando ORDEVA esté cerrada =====
    await PC.p.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      window.Notification.permission = 'default';                 // la primera vez en este equipo
      localStorage.removeItem('vento-push-luego'); window.ventoPagosSugerirPush();
    });
    const pcPush = await esperar(PC.p, () => /aunque cierres ORDEVA/.test((document.getElementById('confirmOverlay') || document.body).innerText), null, 4000);
    chk('4. Computador (navegador): ofrece «Que los pagos te lleguen aunque cierres ORDEVA»', pcPush);
    await cerrarTodo(PC.p);
    const celTxt = await CEL.p.evaluate(() => { localStorage.removeItem('vento-push-luego'); window.ventoPagosSugerirPush(); return document.body.innerText; });
    chk('4. En la app Android no la ofrece (avisa la app misma)', !/aunque cierres ORDEVA/.test(celTxt));
    await cerrarTodo(TAB.p);
    const ipad = await TAB.p.evaluate(() => {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      localStorage.removeItem('vento-push-luego'); window.ventoPagosSugerirPush();
      return document.getElementById('confirmOverlay').classList.contains('show') ? document.getElementById('confirmOverlay').textContent : '';
    });
    chk('4. iPhone/iPad en Safari: explica «Agregar a pantalla de inicio» (sin eso el iPhone no avisa bloqueado)', /pantalla de inicio/.test(ipad) && /bloqueada/.test(ipad), ipad.slice(0, 200));
  }
})();
