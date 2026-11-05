// 📱 ORDEVA 1.81.4 · Cada equipo con sus propios ajustes. Contra el «Supabase local» REAL, con dos equipos en la misma cuenta.
// Pedido del dueño: «si tengo la misma cuenta abierta en otro dispositivo, déjame controlar el volumen independientemente…
// una configuración que yo haga en un celular, si lo pongo en modo fácil, no afecte al otro dispositivo».
//  1. Celular y computador con el mismo correo, en el mismo negocio.
//  2. Modo fácil en el celular: el computador NO se pone en modo fácil (antes sí: viajaba con los datos).
//  3. Vista de las mesas (plano) y animación de fondo en el computador: el celular sigue como estaba.
//  4. Los datos del negocio sí siguen viajando (un producto) y los ajustes del negocio también (propina).
//  5. Volumen de la voz de los pagos y de la campana: cada equipo el suyo.
//  6. Al volver a abrir, cada equipo conserva lo suyo; la nube no se queda con el modo fácil del celular.
//  7. Sin ida y vuelta: con ajustes distintos, los equipos no se quedan subiendo datos sin parar (antes: el celular
//     volvía a subir su modo fácil y se lo pasaba al computador).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const o = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }
(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 12000, polling: 200 }).then(() => true, () => false);
  const uno = async (q, prm) => (await sb.sql(q, prm))[0];
  async function equipo(nombre, ancho){
    const ctx = await b.newContext({ viewport: { width: ancho || 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    const eq = { nombre, ctx, p, subidas: 0 };
    p.on('request', r => { if(/\/rpc\/guardar_(datos|cambios)/.test(r.url())) eq.subidas++; });
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    return eq;
  }
  const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
  const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000);
  const ajustes = p => p.evaluate(() => ({ facil: !!data.easyMode, cuerpo: document.body.classList.contains('easy-mode'), vista: data.tableViewMode, lluvia: !data.rainOff, propina: !!data.tipsOn,
    volPagos: window.ventoPagosVolumen ? window.ventoPagosVolumen() : null }));
  try{
    // ===== 1 =====
    const CEL = await equipo('celular');
    await CEL.p.fill('#authBiz', 'Bar Equipos'); await CEL.p.fill('#authUser', 'dueno@equipos.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('1. El celular crea la cuenta', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    await esperar(CEL.p, () => !!window.ventoNube.negocio());
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    await CEL.p.evaluate(() => { data.products.push({ id: 'p-uno', name: 'Producto Uno', price: 3000 }); saveData(); });
    await pausa(2500);
    const PC = await equipo('computador', 1280);
    await PC.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await PC.p.fill('#authUser', 'dueno@equipos.co'); await PC.p.fill('#authPass', 'clave123'); await PC.p.click('#authBtn');
    chk('1. El computador entra con el mismo correo y ve los mismos datos', await dentro(PC.p) && await esperar(PC.p, () => data.products.some(p => p.id === 'p-uno')));
    await cerrarTodo(PC.p);
    chk('1. Los dos en el mismo negocio', (await PC.p.evaluate(() => (window.ventoNube.negocio() || {}).id)) === NEG);

    // ===== 2 =====
    await CEL.p.evaluate(() => { const cb = document.getElementById('easyModeToggle'); cb.checked = true; cb.dispatchEvent(new Event('change')); });
    await CEL.p.evaluate(() => { data.products.push({ id: 'p-dos', name: 'Producto Dos', price: 4000 }); saveData(); });
    const llego2 = await esperar(PC.p, () => data.products.some(p => p.id === 'p-dos'));
    await pausa(1500);
    let c = await ajustes(CEL.p), pc = await ajustes(PC.p);
    chk('2. El celular queda en modo fácil', c.facil && c.cuerpo, c);
    chk('2. El computador recibe lo nuevo del celular pero NO se pone en modo fácil', llego2 && !pc.facil && !pc.cuerpo, pc);

    // ===== 3 =====
    await PC.p.evaluate(() => { data.tableViewMode = 'map'; data.rainOff = true; data.products.push({ id: 'p-tres', name: 'Producto Tres', price: 5000 }); saveData(); });
    const llego3 = await esperar(CEL.p, () => data.products.some(p => p.id === 'p-tres'));
    await pausa(1500);
    c = await ajustes(CEL.p); pc = await ajustes(PC.p);
    chk('3. El computador con el plano de mesas y sin animación de fondo', pc.vista === 'map' && !pc.lluvia, pc);
    chk('3. El celular recibe lo nuevo pero sigue con la lista de mesas, su animación y su modo fácil', llego3 && c.vista === 'list' && c.lluvia && c.facil, c);

    // ===== 4 =====
    await CEL.p.evaluate(() => { data.tipsOn = true; saveData(); });
    chk('4. Los ajustes del NEGOCIO sí llegan al otro equipo (propina prendida en el celular → el computador)', await esperar(PC.p, () => data.tipsOn === true));

    // ===== 5 =====
    await CEL.p.evaluate(() => { localStorage.setItem('vento_pagos_vol', '40'); localStorage.setItem('vito_notif_cfg', JSON.stringify({ voz: true, volumen: 0.3 })); data.products.push({ id: 'p-cuatro', name: 'Producto Cuatro', price: 6000 }); saveData(); });
    await esperar(PC.p, () => data.products.some(p => p.id === 'p-cuatro'));
    c = await ajustes(CEL.p); pc = await ajustes(PC.p);
    const campanaPC = await PC.p.evaluate(() => { try{ return (JSON.parse(localStorage.getItem('vito_notif_cfg')) || {}).volumen; }catch(e){ return null; } });
    chk('5. Volumen de la voz de los pagos: 40 % en el celular, 100 % en el computador', c.volPagos === 40 && pc.volPagos === 100, { c: c.volPagos, pc: pc.volPagos });
    chk('5. Volumen de la campana de pedidos: el del celular no cambia el del computador', campanaPC == null || campanaPC === 1, campanaPC);

    // ===== 6 =====
    await pausa(2000);
    const nube = (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos;
    chk('6. La nube no se quedó con el modo fácil del celular ni con el plano del computador', !nube.easyMode && nube.tableViewMode !== 'map', { easyMode: nube.easyMode, vista: nube.tableViewMode });
    chk('6. … pero sí con los datos y los ajustes del negocio', (nube.products || []).some(p => p.id === 'p-cuatro') && nube.tipsOn === true);
    await CEL.p.reload(); await PC.p.reload();
    await esperar(CEL.p, () => typeof data !== 'undefined' && data.products && data.products.some(p => p.id === 'p-cuatro'), null, 20000);
    await esperar(PC.p, () => typeof data !== 'undefined' && data.products && data.products.some(p => p.id === 'p-cuatro'), null, 20000);
    await pausa(3000);
    c = await ajustes(CEL.p); pc = await ajustes(PC.p);
    chk('6. Al volver a abrir, el celular sigue en modo fácil con la lista de mesas', c.facil && c.cuerpo && c.vista === 'list', c);
    chk('6. Al volver a abrir, el computador sigue sin modo fácil, con el plano y sin animación', !pc.facil && !pc.cuerpo && pc.vista === 'map' && !pc.lluvia, pc);

    // ===== 7 =====
    await pausa(3000);
    const a1 = CEL.subidas, a2 = PC.subidas;
    await pausa(15000);
    const n1 = CEL.subidas - a1, n2 = PC.subidas - a2;
    // Una ida y vuelta sería sin parar (cada equipo devolviendo su ajuste). Puede haber, rara vez, una subida suelta de algo
    // que el equipo arregla solo al abrir; nunca una tras otra.
    chk('7. Sin ida y vuelta: quietos 15 s, ninguno se queda subiendo (' + n1 + ' y ' + n2 + ')', n1 <= 1 && n2 <= 1, { n1, n2 });
    c = await ajustes(CEL.p); pc = await ajustes(PC.p);
    chk('7. … y cada uno sigue con lo suyo', c.facil && !pc.facil && c.vista === 'list' && pc.vista === 'map', { c, pc });
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close(); await sb.cerrar().catch(() => {});
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
