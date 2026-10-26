// 🔊 El administrador elige en qué equipos SUENAN los avisos de pago (ORDEVA 1.62.0), de punta a punta (PostgreSQL REAL +
// Servidor ORDEVA + la app de verdad), con un celular (app Android, lee los avisos), una tablet (app Android) y un computador:
//  1. Ajustes → 💜 Pagos → «🔊 Celulares y dónde suenan los pagos»: los tres, con su botón «🔊 SUENA», su modelo y «ESTE CELULAR» y ✏️ para el nombre.
//  2. El administrador le pone nombre a la tablet y elige que NO suene: la tablet se entera (también la app Android).
//  3. Llega un pago: el computador suena (ventana con el valor); la tablet NO (ni voz, ni notificación, ni ventana),
//     pero el pago igual queda en su lista.
//  4. Vuelve a prenderla: el siguiente pago sí suena en la tablet.
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
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página en ningún equipo', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 250 }).then(() => true, () => false);
    async function equipo(nombre, ancho, android){
      const ctx = await b.newContext({ viewport: { width: ancho, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(android => {
        try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){}
        const A = window.__and = { cola: [], notifs: [], pagos: [], decir: [] };
        if(android) window.VentoAndroid = {
          pagosAvisos: () => {}, pagosAvisosEstado: () => JSON.stringify({ on: true, permiso: true, vivo: true }),
          pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
          notificar: (t, x, c, s) => { A.notifs.push({ t, x, c, s }); return true; },
          pagoNotificar: (t, f, o, v, bco, tipo) => { A.pagos.push({ t, f, o, v, bco, tipo }); },
          pagosDecir: t => { A.decir.push(String(t)); },
          pagosNotif: () => {}, pagosVolumen: () => {}, ventanaPagoOn: () => {}, alFrente: () => false,
          pagosCruce: j => { A.cruce = j; }, pagosCruceEstado: () => '{}',
          pagoReclamar: id => { A.reclamados = A.reclamados || []; if(A.androidYaLoDijo || A.reclamados.includes(id)) return false; A.reclamados.push(id); return true; },
          pagosVozOn: v => { A.vozOn = !!v; }, pagosSuena: v => { A.suena = !!v; }, pagosVozEstado: () => A.vozOn !== false,
          permisos: () => JSON.stringify({ avisos: true, bateria: A.bateria === true, fondo: true }), fabricante: () => 'Xiaomi|Redmi',
          ajustesBateria: () => { A.abrioBateria = (A.abrioBateria || 0) + 1; }, abrirInicioAutomatico: () => { A.abrioAuto = (A.abrioAuto || 0) + 1; return true; },
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
      await E.p.fill('#authUser', 'dueno@equipos.co'); await E.p.fill('#authPass', 'clave123'); await E.p.click('#authBtn');
      const d = await dentro(E.p); await E.p.click('#onbSaltar', { timeout: 3000 }).catch(() => {}); await cerrarTodo(E.p);
      return d;
    }
    const and = E => E.p.evaluate(() => JSON.parse(JSON.stringify(window.__and)));

    // ===== Tres equipos del mismo negocio =====
    const CEL = await equipo('celular', 390, true);
    await CEL.p.fill('#authBiz', 'Bar Suenan'); await CEL.p.fill('#authUser', 'dueno@equipos.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('El celular crea la cuenta y entra', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio() && !!localStorage.getItem('vento_pagos_dev'), null, 15000);
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    const TAB = await equipo('tablet', 800, true), PC = await equipo('computador', 1280, false);
    chk('La tablet y el computador entran con la misma cuenta', await entrar(TAB) && await entrar(PC));
    for(const E of [CEL, TAB, PC]) await esperar(E.p, () => !!localStorage.getItem('vento_pagos_dev') && window.ventoPagos && window.ventoPagos.estado().ultimoSync > 0, null, 15000);
    const devTab = await TAB.p.evaluate(() => JSON.parse(localStorage.getItem('vento_pagos_dev')).id);

    // ===== 1. La lista de equipos en Ajustes → Pagos (computador del administrador) =====
    PC.p.on('dialog', d => d.type() === 'prompt' ? d.accept('Tablet de la barra') : d.accept());
    await cerrarTodo(PC.p);
    await PC.p.click('#navMoreBtn').catch(() => {}); await PC.p.click('.more-tile[data-go="ajustes"]').catch(() => {});
    await PC.p.evaluate(() => { try{ window.ventoPagos.abrirAjustes(); }catch(e){} const c = document.querySelector('.ajustes-cat[data-cat="pagos"]'); if(c) c.click(); });
    chk('1. «🔊 Celulares y dónde suenan los pagos»: los 3 equipos, todos con «🔊 SUENA»', await esperar(PC.p, () => document.querySelectorAll('#vpDevs [data-suena]').length === 3 && [...document.querySelectorAll('#vpDevs [data-suena]')].every(b => /🔊 SUENA/.test(b.textContent)), null, 20000),
      await PC.p.evaluate(() => (document.getElementById('vpDevs') || {}).textContent));

    chk('1. «ESTE CELULAR» marca solo al equipo donde se mira, y cada uno dice si está conectado', await PC.p.evaluate(() => (document.getElementById('vpDevs').textContent.match(/ESTE CELULAR/g) || []).length === 1 && /Conectado ahora/.test(document.getElementById('vpDevs').textContent)));
    // ===== 2. Nombre y «no suena» para la tablet =====
    await PC.p.evaluate(id => document.querySelector('#vpDevs [data-nom="' + id + '"]').click(), devTab);
    chk('2. ✏️ Le pone nombre a la tablet', await esperar(PC.p, () => /Tablet de la barra/.test(document.getElementById('vpDevs').textContent), null, 10000));
    await PC.p.evaluate(id => document.querySelector('#vpDevs [data-suena="' + id + '"]').click(), devTab);
    chk('2. La elige para que NO suene', await esperar(PC.p, id => { const b = document.querySelector('#vpDevs [data-suena="' + id + '"]'); return !!b && /NO SUENA/.test(b.textContent); }, devTab, 10000) &&
      (await sb.sql('select suena from dispositivos where id = $1', [devTab]))[0].suena === false);
    await TAB.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));   // aquí no hay tiempo real: el aviso se simula
    chk('2. La tablet se entera (y se lo dice a la app Android)', await esperar(TAB.p, () => localStorage.getItem('vento_pagos_suena') === 'false' && window.__and.suena === false, null, 10000));

    // ===== 3. Llega un pago =====
    const llega = async (monto, id) => {
      await CEL.p.evaluate(([t, i]) => { window.__and.cola.push({ id: i, txt: t, t: Date.now(), voz: true }); window.ventoAvisosNativos(); }, ['Nequi Colombia | Te enviaron plata por Bre-B | Te enviaron $' + monto + '. Entra a tu app y revisa tu saldo.', id]);
      for(let i = 0; i < 40; i++){ if((await sb.sql("select 1 from pagos where negocio_id = $1 and monto = $2", [NEG, monto])).length) break; await new Promise(r => setTimeout(r, 250)); }
    };
    const latir = E => E.p.evaluate(() => window.ventoLatido && window.ventoLatido());
    await llega(300, 'kb:300:1');
    chk('3. El computador suena: la 🪟 ventana con «$300»', await esperar(PC.p, () => { const v = document.getElementById('pgVentana'); return !!v && /\$300/.test(v.textContent); }, null, 35000));
    let enLista = false; for(let i = 0; i < 60 && !enLista; i++){ await latir(TAB); enLista = await TAB.p.evaluate(() => (data.pagos.lista || []).some(x => x.monto === 300)); if(!enLista) await new Promise(r => setTimeout(r, 500)); }
    const tab3 = await TAB.p.evaluate(() => JSON.parse(JSON.stringify(window.__and)));
    chk('3. La tablet NO suena: ni voz, ni notificación, ni ventana', enLista && !tab3.pagos.length && !tab3.decir.some(t => /300 pesos/.test(t)) && !tab3.notifs.some(n => /300/.test(n.t + n.x)), tab3);
    chk('3. … pero el pago igual queda en su lista, y se ve en silencio (🔕)', enLista && /🔕/.test(await TAB.p.textContent('#toast')), await TAB.p.textContent('#toast'));

    // ===== 4. Volver a prenderla =====
    await PC.p.evaluate(id => document.querySelector('#vpDevs [data-suena="' + id + '"]').click(), devTab);
    await esperar(PC.p, id => { const b = document.querySelector('#vpDevs [data-suena="' + id + '"]'); return !!b && /🔊 SUENA/.test(b.textContent); }, devTab, 10000);
    await TAB.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));
    chk('4. La tablet vuelve a sonar', await esperar(TAB.p, () => localStorage.getItem('vento_pagos_suena') === 'true' && window.__and.suena === true, null, 10000));
    await llega(500, 'kb:500:1');
    let tab4 = null; for(let i = 0; i < 60; i++){ await latir(TAB); tab4 = await TAB.p.evaluate(() => JSON.parse(JSON.stringify(window.__and))); if(tab4.pagos.length) break; await new Promise(r => setTimeout(r, 500)); }
    chk('4. El siguiente pago sí suena en la tablet (voz y notificación con «$500»)', tab4.pagos.some(x => x.v === '$500') && tab4.decir.some(t => /500 pesos/.test(t)), tab4);
  }
})();
