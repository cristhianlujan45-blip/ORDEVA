// 🔔 1.65.6: «Celulares y dónde suenan los pagos» con el NOMBRE de cada equipo, solo los de la cuenta, y «🔔 Probar» en
// cada uno, de punta a punta (PostgreSQL REAL + Servidor ORDEVA + la app de verdad) con un celular (app Android), un
// computador y una tableta (navegador). El Supabase Realtime se simula igual que el de verdad (pruebas/pagostodos.test.js).
//  1. Cada equipo se pone su nombre de verdad: «📱 Samsung Galaxy A34 (SM-A346M) · app ORDEVA», «💻 Computador Windows ·
//     Chrome», «📱 Samsung SM-X210 · Chrome» (la tableta esconde el modelo: se le pregunta al navegador). Ninguno «Dueño · Android».
//  2. «Tus equipos»: los tres. Los viejos (más de 14 días), los repetidos y los de cuentas que ya no están, aparte y
//     cerrados, con «🧹 Retirar los viejos» (los retira de verdad).
//  3. «🔔 Probar» en la tableta: suena SOLO en la tableta (ventana, sonido y voz), sin crear ningún pago. En el celular
//     la prueba se la deja a Android (suena aunque esté bloqueado).
//  4. Tableta en «🔕 NO SUENA» → Probar → NO suena (solo dice que está en NO SUENA).
//  5. Otra vez «🔊 SUENA» → Probar → suena otra vez.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }

const UA = {
  celular: 'Mozilla/5.0 (Linux; Android 14; SM-A346M Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 VentoAndroid/1.65.6',
  computador: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  tableta: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

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
    const conexiones = [];
    let ultimoEnviado = 0;
    const msg = (cx, topic, event, payload, ref, joinRef) => cx.v2 ? JSON.stringify([joinRef || null, ref || null, topic, event, payload]) : JSON.stringify({ topic, event, payload, ref: ref || null });
    reenvio = setInterval(async () => {
      let l; try{ l = await sb.sql('select id, payload, evento, topic from realtime.enviados where id > $1 order by id', [ultimoEnviado]); }catch(e){ return; }
      for(const r of l){
        ultimoEnviado = Math.max(ultimoEnviado, Number(r.id));
        for(const cx of conexiones) if(cx.abierta && cx.temas.has('realtime:' + r.topic)) cx.ws.send(msg(cx, 'realtime:' + r.topic, 'broadcast', { event: r.evento, payload: r.payload, type: 'broadcast' }));
      }
    }, 40);
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 100 }).then(() => true, () => false);
    async function equipo(nombre, ancho, android){
      const ctx = await b.newContext({ viewport: { width: ancho, height: 844 }, userAgent: UA[nombre] });
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
      await ctx.addInitScript(([android, nombre]) => {
        try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){}
        const A = window.__and = { cola: [], notifs: [], pagos: [], decir: [] };
        window.__voz = []; window.__son = 0;
        // La tableta: Chrome esconde el modelo en su texto («K»); el navegador lo da si se le pregunta.
        if(nombre === 'tableta') try{ Object.defineProperty(navigator, 'userAgentData', { configurable: true, get: () => ({ mobile: false, platform: 'Android', getHighEntropyValues: () => Promise.resolve({ model: 'SM-X210' }) }) }); }catch(e){}
        if(android) window.VentoAndroid = {
          pagosAvisos: () => {}, pagosAvisosEstado: () => JSON.stringify({ on: true, permiso: true, vivo: true }),
          pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
          notificar: (t, x, c, s) => { A.notifs.push({ t, x, c, s }); return true; },
          pagoNotificar: (t, f, o, v, bco, tipo) => { A.pagos.push({ t, f, o, v, bco, tipo }); },
          pagosDecir: t => { A.decir.push(String(t)); },
          pagosNotif: () => {}, pagosVolumen: () => {}, ventanaPagoOn: () => {}, alFrente: () => false,
          pagosCruce: j => { A.cruce = j; }, pagosCruceEstado: () => '{}',
          pagoReclamar: id => { A.reclamados = A.reclamados || []; if(A.reclamados.includes(id)) return false; A.reclamados.push(id); return true; },
          pagosVozOn: () => {}, pagosSuena: v => { A.suena = !!v; }, pagosVozEstado: () => true,
          permisos: () => JSON.stringify({ avisos: true, bateria: true, fondo: true }), fabricante: () => 'Samsung|SM-A346M',
        };
      }, [!!android, nombre]);
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      p.on('dialog', d => d.accept());
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { nombre, ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    async function entrar(E){
      await E.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
      await E.p.fill('#authUser', 'dueno@probar.co'); await E.p.fill('#authPass', 'clave123'); await E.p.click('#authBtn');
      const d = await dentro(E.p); await E.p.click('#onbSaltar', { timeout: 3000 }).catch(() => {}); await cerrarTodo(E.p);
      return d;
    }
    // Lo que «suena» en cada equipo: la voz de los pagos y el sonido de éxito (la ventana se ve en el DOM).
    const espiar = E => E.p.evaluate(() => {
      window.ventoDecirPago = t => { window.__voz.push(String(t)); };
      if(window.ventoSonidos){ const o = window.ventoSonidos.success; window.ventoSonidos.success = function(){ window.__son++; try{ return o && o.apply(this, arguments); }catch(e){} }; }
    });
    const sono = E => E.p.evaluate(() => ({ voz: window.__voz.slice(), son: window.__son, ventana: !!(document.getElementById('pgVentana') && /1\.000/.test(document.getElementById('pgVentana').textContent)), toast: (document.getElementById('toast') || {}).textContent || '', and: JSON.parse(JSON.stringify(window.__and)) }));
    const limpiar = E => E.p.evaluate(() => { window.__voz = []; window.__son = 0; const v = document.getElementById('pgVentana'); if(v) v.remove(); window.__and.pagos = []; window.__and.decir = []; });

    // ===== Tres equipos del mismo negocio =====
    const CEL = await equipo('celular', 390, true);
    await CEL.p.fill('#authBiz', 'Bar Probar'); await CEL.p.fill('#authUser', 'dueno@probar.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('El celular crea la cuenta y entra', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio() && !!localStorage.getItem('vento_pagos_dev'), null, 15000);
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    const PC = await equipo('computador', 1280, false), TAB = await equipo('tableta', 800, false);
    chk('El computador y la tableta entran con la misma cuenta', await entrar(PC) && await entrar(TAB));
    const EQ = [CEL, PC, TAB];
    for(const E of EQ) await esperar(E.p, () => !!localStorage.getItem('vento_pagos_dev') && window.ventoPagos && window.ventoPagos.estado().avisoVivoOk === true, null, 20000);
    for(const E of EQ) await espiar(E);
    const id = {};
    for(const E of EQ) id[E.nombre] = await E.p.evaluate(() => JSON.parse(localStorage.getItem('vento_pagos_dev')).id);

    // Equipos de antes: el mismo celular registrado otra vez hace una semana, uno de hace 2 meses y uno de una cuenta
    // que ya no está en el negocio.
    const dueno = (await sb.sql('select usuario_id from dispositivos where id = $1', [id.celular]))[0].usuario_id;
    const ex = (await sb.sql(`insert into auth.users(email, encrypted_password, email_confirmed_at) values ('ex@probar.co', 'x', now()) returning id`))[0].id;
    const viejos = await sb.sql(`insert into dispositivos(negocio_id, usuario_id, nombre, plataforma, token_hash, ultimo_visto) values
      ($1, $2, 'Dueño · Android', $3, 'tk-rep', now() - interval '7 days'),
      ($1, $2, 'Dueño · Android', 'Mozilla/5.0 (Linux; Android 12; moto g22) AppleWebKit/537.36', 'tk-viejo', now() - interval '60 days'),
      ($1, $4, 'Caja · Android', 'Mozilla/5.0 (Linux; Android 11; K) AppleWebKit/537.36', 'tk-ex', now() - interval '1 hour') returning id`,
      [NEG, dueno, UA.celular.slice(0, 120), ex]);

    // ===== 1. Cada equipo con su nombre de verdad =====
    let nombres = {};
    for(let i = 0; i < 40; i++){
      nombres = Object.fromEntries((await sb.sql('select id, nombre from dispositivos where id = any($1)', [Object.values(id)])).map(r => [r.id, r.nombre]));
      if(Object.values(nombres).every(n => /^(📱|💻)/.test(n))) break;
      await new Promise(r => setTimeout(r, 250));
    }
    chk('1. El celular se llama «📱 Samsung Galaxy A34 (SM-A346M) · app ORDEVA»', nombres[id.celular] === '📱 Samsung Galaxy A34 (SM-A346M) · app ORDEVA', nombres);
    chk('1. El computador «💻 Computador Windows · Chrome»', nombres[id.computador] === '💻 Computador Windows · Chrome', nombres);
    chk('1. La tableta (Chrome esconde el modelo): «📱 Samsung SM-X210 · Chrome»', nombres[id.tableta] === '📱 Samsung SM-X210 · Chrome', nombres);

    // ===== 2. La lista en Ajustes → Pagos (computador) =====
    await cerrarTodo(PC.p);
    await PC.p.evaluate(() => { try{ window.ventoPagos.abrirAjustes(); }catch(e){} const c = document.querySelector('.ajustes-cat[data-cat="pagos"]'); if(c) c.click(); });
    const lista = () => PC.p.evaluate(() => {
      const el = document.getElementById('vpDevs'); if(!el) return null;
      const det = el.querySelector('.vp-eq-viejos');
      const fuera = [...el.querySelectorAll('.vp-eq')].filter(x => !x.closest('.vp-eq-viejos'));
      return { arriba: fuera.map(x => x.querySelector('b').textContent), viejos: det ? [...det.querySelectorAll('.vp-eq b')].map(x => x.textContent) : [], abierto: det ? det.open : null, txt: el.textContent };
    });
    await esperar(PC.p, () => document.querySelectorAll('#vpDevs .vp-eq').length >= 6, null, 20000);
    let L = await lista();
    chk('2. «Tus equipos»: solo los tres que se usan, cada uno con su nombre', L && L.arriba.length === 3 && L.arriba.includes(nombres[id.celular]) && L.arriba.includes(nombres[id.computador]) && L.arriba.includes(nombres[id.tableta]), L);
    chk('2. Ninguno sale «Dueño · Android», y «ESTE EQUIPO» marca solo al computador', L && !/Dueño · Android/.test(L.txt) && (L.txt.match(/ESTE (EQUIPO|CELULAR)/g) || []).length === 1 && /ESTE EQUIPO/.test(L.txt), L && L.txt);
    chk('2. Los 3 viejos (repetido, 60 días, cuenta que ya no está) van aparte y cerrados', L && L.viejos.length === 3 && L.abierto === false && /Repetido/.test(L.txt) && /ya no está en el negocio/.test(L.txt), L);
    await PC.p.evaluate(() => document.querySelector('#vpDevs [data-rev-viejos]').click());
    const revocados = async () => (await sb.sql('select count(*)::int n from dispositivos where id = any($1) and revocado_en is not null', [viejos.map(v => v.id)]))[0].n;
    let rv = 0; for(let i = 0; i < 40 && rv < 3; i++){ rv = await revocados(); if(rv < 3) await new Promise(r => setTimeout(r, 250)); }
    chk('2. «🧹 Retirar los viejos» los retira de verdad', rv === 3, rv);
    chk('2. … y la lista queda limpia (sin la parte de viejos)', await esperar(PC.p, () => !document.querySelector('#vpDevs .vp-eq-viejos') && document.querySelectorAll('#vpDevs .vp-eq').length === 3, null, 10000), await lista());

    // ===== 3. 🔔 Probar en la tableta =====
    const probar = async dev => {
      for(const E of EQ) await limpiar(E);
      const antes = (await sb.sql('select count(*)::int n from pagos where negocio_id = $1', [NEG]))[0].n;
      await PC.p.evaluate(d => document.querySelector('#vpDevs [data-probar="' + d + '"]').click(), dev);
      return antes;
    };
    const pagosAntes = await probar(id.tableta);
    chk('3. «🔔 Probar» en la tableta: suena (ventana con $1.000, sonido y voz)', await esperar(TAB.p, () => window.__son > 0 && window.__voz.some(t => /Prueba de ORDEVA/.test(t)) && !!document.getElementById('pgVentana'), null, 8000), await sono(TAB));
    await new Promise(r => setTimeout(r, 800));
    const pc3 = await sono(PC), cel3 = await sono(CEL);
    chk('3. … y SOLO en la tableta: el computador y el celular no suenan', !pc3.son && !pc3.voz.length && !pc3.ventana && !cel3.and.pagos.length && !cel3.and.decir.length && !cel3.voz.length, { pc3, cel3 });
    chk('3. No se creó ningún pago', (await sb.sql('select count(*)::int n from pagos where negocio_id = $1', [NEG]))[0].n === pagosAntes);
    await probar(id.celular);
    let env = [];
    for(let i = 0; i < 40; i++){ env = await sb.sql("select payload from realtime.enviados where evento = 'prueba' order by id desc limit 1"); if(env.length && env[0].payload.d === id.celular) break; await new Promise(r => setTimeout(r, 100)); }
    await new Promise(r => setTimeout(r, 800));
    const cel3b = await sono(CEL);
    chk('3. Probar en el celular (app Android): la prueba sale para ese equipo y la página se la deja a Android (sin sonar doble)', env.length && env[0].payload.d === id.celular && !cel3b.voz.length && !cel3b.son, { env, cel3b });

    // ===== 4. NO SUENA → la prueba no suena =====
    await PC.p.evaluate(d => document.querySelector('#vpDevs [data-suena="' + d + '"]').click(), id.tableta);
    chk('4. La tableta queda en «🔕 NO SUENA»', await esperar(PC.p, d => /NO SUENA/.test((document.querySelector('#vpDevs [data-suena="' + d + '"]') || {}).textContent || ''), id.tableta, 10000) &&
      (await sb.sql('select suena from dispositivos where id = $1', [id.tableta]))[0].suena === false);
    await probar(id.tableta);
    chk('4. Probar → la tableta NO suena (solo avisa que está en NO SUENA)', await esperar(TAB.p, () => /NO SUENA/.test((document.getElementById('toast') || {}).textContent || ''), null, 8000) &&
      await TAB.p.evaluate(() => !window.__son && !window.__voz.length && !document.getElementById('pgVentana')), await sono(TAB));

    // ===== 5. Otra vez SUENA → la prueba suena =====
    await PC.p.evaluate(d => document.querySelector('#vpDevs [data-suena="' + d + '"]').click(), id.tableta);
    chk('5. La tableta vuelve a «🔊 SUENA»', await esperar(PC.p, d => /🔊 SUENA/.test((document.querySelector('#vpDevs [data-suena="' + d + '"]') || {}).textContent || ''), id.tableta, 10000));
    await probar(id.tableta);
    chk('5. Probar → la tableta suena otra vez', await esperar(TAB.p, () => window.__son > 0 && window.__voz.some(t => /Prueba de ORDEVA/.test(t)), null, 8000), await sono(TAB));
  }
})();
