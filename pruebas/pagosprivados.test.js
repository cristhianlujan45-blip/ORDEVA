// «Solamente el administrador puede ver lo del Nequi» (ORDEVA 1.55.0, D5), en la app contra el «Supabase local» REAL:
//  1. El celular del dueño lee el aviso «ANA RUIZ te envió $45.000»: lo ve completo (con el nombre).
//  2. Los datos del negocio en el servidor (los que se copian a todos los celulares) NO llevan el nombre ni el texto.
//  3. Otro equipo del dueño (computador): ve el nombre (se lo da el servidor, solo a dueño y administrador).
//  4. El celular del mesero: recibe el pago (valor) pero el nombre no está en ninguna parte de su celular.
//  5. Registrado en la cuenta de la mesa: la nota no lleva el nombre (el historial lo ve todo el equipo).
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
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const uno = async (q, p) => (await sb.sql(q, p))[0];
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
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
          pagosDecir: t => { A.decir.push(String(t)); }, pagosNotif: () => {}, pagosVolumen: () => {}, ventanaPagoOn: () => {}, alFrente: () => false,
          pagosCruce: () => {}, pagosCruceEstado: () => '{}', pagoReclamar: () => true, pagosVozOn: () => {}, pagosVozEstado: () => true,
          permisos: () => JSON.stringify({ avisos: true, bateria: true, fondo: true }), fabricante: () => 'Xiaomi|Redmi', ajustesBateria: () => {}, abrirInicioAutomatico: () => true,
        };
      }, !!android);
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return p;
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000);

    // ===== El dueño (celular de la caja con la app Android) =====
    const CEL = await equipo('celular del dueño', 390, true);
    await CEL.fill('#authBiz', 'Bar Privado'); await CEL.fill('#authUser', 'dueno@nequi.co'); await CEL.fill('#authPass', 'clave123'); await CEL.click('#authBtn');
    chk('El dueño crea la cuenta y queda en la nube', await dentro(CEL) && await esperar(CEL, () => !!window.ventoNube.negocio() && !!localStorage.getItem('vento_pagos_dev'), null, 15000));
    await CEL.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL);
    const NEG = (await CEL.evaluate(() => window.ventoNube.negocio())).id;
    await CEL.evaluate(() => { data.tables[4] = { items: [{ name: 'Picada', qty: 1, price: 45000 }], payments: [], people: [] }; saveData(); });

    // ===== El mesero (otro celular con la app Android) =====
    await sb.sql("insert into invitaciones(codigo, negocio_id, rol) values ('MESNEQUI', $1, 'mesero')", [NEG]);
    const MES = await equipo('celular del mesero', 390, true);
    await MES.click('#authNube'); await MES.waitForSelector('#nubeOv.show #nubeEmail');
    await MES.fill('#nubeEmail', 'mesero@nequi.co'); await MES.fill('#nubePass', 'clave123'); await MES.fill('#nubeNombre', 'Pedro');
    await MES.click('#nubeCrear'); await MES.waitForSelector('#nubeCodigo', { state: 'visible' });
    await MES.fill('#nubeCodigo', 'MESNEQUI'); await MES.click('#nubeUnirme');
    chk('El mesero se une', await esperar(MES, n => { const x = window.ventoNube.negocio(); return x && x.id === n && x.rol === 'mesero'; }, NEG, 20000));
    await cerrarTodo(MES);
    // El computador del dueño
    const PC = await equipo('computador del dueño', 1280, false);
    await PC.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.fill('#authUser', 'dueno@nequi.co'); await PC.fill('#authPass', 'clave123'); await PC.click('#authBtn');
    chk('El computador del dueño entra', await dentro(PC)); await PC.click('#onbSaltar', { timeout: 3000 }).catch(() => {}); await cerrarTodo(PC);
    for(const P of [MES, PC]) await esperar(P, () => window.ventoPagos && window.ventoPagos.estado().ultimoSync > 0, null, 15000);

    // ===== 1. El celular del dueño lee el aviso =====
    const AVISO = 'Nequi | Nequi | ANA RUIZ te envió $45.000';
    await CEL.evaluate(t => { window.__and.cola.push({ id: 'kpriv:1:1', txt: t, t: Date.now(), voz: true }); window.ventoAvisosNativos(); }, AVISO);
    chk('1. El celular del dueño lo tiene con el nombre (lo leyó él)', await esperar(CEL, () => (data.pagos.lista || []).some(x => x.monto === 45000 && /ana ruiz/i.test(pagoDet(x).de)), null, 15000));

    // ===== 2. Los datos del negocio en el servidor =====
    let limpio = false, doc = null;
    for(let i = 0; i < 40 && !limpio; i++){ doc = (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos; limpio = !!doc.pagos && (doc.pagos.lista || []).some(x => x.monto === 45000); if(!limpio) await new Promise(r => setTimeout(r, 300)); }
    chk('2. El aviso llegó a los datos del negocio SIN el nombre ni el texto del banco', limpio && !/ana ruiz/i.test(JSON.stringify(doc)), doc && doc.pagos);
    const det = await uno("select de from pago_avisos_detalle where negocio_id = $1 and de ilike 'ana ruiz'", [NEG]);
    chk('2. … el nombre quedó guardado aparte en el servidor', !!det);

    // ===== 3. El computador del dueño =====
    chk('3. El computador del dueño recibe el pago', await esperar(PC, () => (data.pagos.lista || []).some(x => x.monto === 45000), null, 30000));
    chk('3. … y ve el nombre (el servidor se lo da al dueño)', await esperar(PC, () => (data.pagos.lista || []).some(x => x.monto === 45000 && /ana ruiz/i.test(pagoDet(x).de)), null, 30000),
      await PC.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 45000).map(x => [x.id, x.srv, pagoDet(x)])));

    // ===== 4. El mesero =====
    chk('4. El celular del mesero recibe el pago (el valor)', await esperar(MES, () => (data.pagos.lista || []).some(x => x.monto === 45000), null, 30000));
    await MES.waitForTimeout(3000);
    const enMes = await MES.evaluate(() => { let s = JSON.stringify(data); for(let i = 0; i < localStorage.length; i++) s += localStorage.getItem(localStorage.key(i)); return { nombre: /ana ruiz/i.test(s), det: (data.pagos.lista || []).filter(x => x.monto === 45000).map(x => pagoDet(x).de) }; });
    chk('4. … pero el nombre no está en ninguna parte de su celular (datos ni memoria)', !enMes.nombre && enMes.det.every(d => !d), enMes);

    // ===== 5. Registrado en la mesa =====
    await CEL.evaluate(() => { const x = (data.pagos.lista || []).find(y => y.monto === 45000); window.pagoRegistrar && window.pagoRegistrar(x, 4); });
    const nota = await CEL.evaluate(() => ((data.tables[4] || {}).payments || []).map(p => p.note).join(' | '));
    chk('5. La cuenta de la mesa registra el pago, sin el nombre (el historial lo ve todo el equipo)', /Nequi/.test(nota) && !/ana ruiz/i.test(nota), nota);
  }
})();
