// Equipo y actividad, contra el «Supabase local» REAL:
//  • el dueño invita a un EMPLEADO (en una tienda de ropa se llama «Asesor de ventas») o a un segundo administrador
//    desde «👥 Mi cuenta y mi equipo» (sin «nube» a la vista: los datos ya se guardan solos en la cuenta);
//  • el empleado entra con el código y solo ve lo de su trabajo: sin estadísticas, contabilidad, historial,
//    productos, inventario ni ajustes, hasta que el dueño se lo permita («👥 Permisos del equipo»);
//  • cada venta, venta borrada y cambio de precio de cada persona llega al servidor y SOLO el dueño lo ve
//    («📜 Actividad del equipo»), filtrado por persona; el segundo administrador no la puede ver.
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
  try{ await pruebas(); }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    const uno = async (q, a) => (await sb.sql(q, a))[0];
    async function celular(){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
      p.on('dialog', d => d.accept().catch(() => {}));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const visible = (p, sel) => p.evaluate(s => { const x = document.querySelector(s); return !!x && getComputedStyle(x).display !== 'none'; }, sel);

    // ===== Dueño: tienda de ropa =====
    const A = await celular(), pA = A.p;
    chk('La entrada no ofrece «ORDEVA Nube» aparte (la cuenta de ORDEVA ya guarda todo)', await pA.evaluate(() => !/nube/i.test(document.getElementById('authOverlay').innerText) && /Me invitaron a un negocio/.test(document.getElementById('authNube').textContent)));
    await pA.evaluate(() => { document.getElementById('authType').value = 'ropa'; });
    await pA.fill('#authBiz', 'Boutique Ana'); await pA.fill('#authUser', 'ana@boutique.co'); await pA.fill('#authPass', 'clave123'); await pA.click('#authBtn');
    chk('El dueño crea su cuenta (y su negocio queda en la cuenta, sin pasos de «nube»)', await esperar(pA, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio() && window.ventoNube.negocio().rol === 'dueno', null, 20000));
    await pA.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await cerrarTodo(pA);
    const NEG = await pA.evaluate(() => window.ventoNube.negocio().id);
    chk('El empleado de una tienda de ropa se llama «Asesor de ventas»', await pA.evaluate(() => window.ventoRolNombre('empleado') === 'Asesor de ventas'));

    await pA.evaluate(() => window.ventoNube.abrir({}));
    await pA.waitForSelector('#nubeOv.show #nubeRolInv');
    const panel = await pA.evaluate(() => ({ t: document.getElementById('nubeOv').innerText, ops: [...document.querySelectorAll('#nubeRolInv option')].map(o => o.textContent) }));
    chk('«👥 Mi cuenta y mi equipo»: sin «nube», sin sincronizar ni respaldos (eso es del administrador de ORDEVA)', /Mi cuenta y mi equipo/.test(panel.t) && !/nube|Sincronizar|Respaldos/i.test(panel.t), panel.t);
    chk('Invitar: Asesor de ventas, Mesero, Cajero o Segundo administrador', panel.ops.join('|') === 'Asesor de ventas|Mesero|Cajero|Administrador (segundo administrador)', panel.ops);
    await pA.selectOption('#nubeRolInv', 'empleado'); await pA.click('#nubeInvitar');
    await pA.waitForSelector('#nubeInvRes .nube-cod');
    const codEmp = (await pA.textContent('#nubeInvRes .nube-cod')).trim();
    chk('Código para el asesor de ventas', /^[A-Z0-9]{6,}$/.test(codEmp) && /asesor de ventas/i.test(await pA.textContent('#nubeInvRes')), codEmp);
    await pA.selectOption('#nubeRolInv', 'admin'); await pA.click('#nubeInvitar');
    await esperar(pA, c => { const x = document.querySelector('#nubeInvRes .nube-cod'); return x && x.textContent.trim() !== c; }, codEmp);
    const codAdm = (await pA.textContent('#nubeInvRes .nube-cod')).trim();
    chk('Código para el segundo administrador (avisa que todo lo suyo queda en la actividad)', codAdm !== codEmp && /Actividad del equipo/.test(await pA.textContent('#nubeInvRes')));
    await pA.click('#nubeOv [data-n="cerrar"]');

    // ===== Empleado =====
    const B = await celular(), pB = B.p;
    await pB.click('#authNube'); await pB.waitForSelector('#nubeOv.show #nubeEmail');
    await pB.fill('#nubeEmail', 'laura@boutique.co'); await pB.fill('#nubePass', 'clave123'); await pB.fill('#nubeNombre', 'Laura');
    await pB.click('#nubeCrear'); await pB.waitForSelector('#nubeCodigo', { state: 'visible' });
    await pB.fill('#nubeCodigo', codEmp); await pB.click('#nubeUnirme');
    chk('El empleado se une con el código y entra', await esperar(pB, n => { const x = window.ventoNube.negocio(); return x && x.id === n && x.rol === 'empleado' && document.getElementById('authOverlay').hidden; }, NEG, 20000));
    await cerrarTodo(pB); await pB.waitForTimeout(2300);
    const vista = await pB.evaluate(() => { const v = s => { const x = document.querySelector(s); return !!x && getComputedStyle(x).display !== 'none'; };
      return { equipo: document.body.classList.contains('rol-equipo'), est: v('.more-tile[data-go="estadisticas"]') || v('nav button[data-view="estadisticas"]'), cont: v('.more-tile[data-go="contabilidad"]') || v('nav button[data-view="contabilidad"]'),
        hist: v('.more-tile[data-go="historial"]') || v('nav button[data-view="historial"]'), aj: v('.more-tile[data-go="ajustes"]') || v('nav button[data-view="ajustes"]'),
        prod: v('nav button[data-view="productos"]') || v('.more-tile[data-go="productos"]'), mesas: v('nav button[data-view="mesas"]'), chip: (document.getElementById('meseroChip') || {}).innerText || '' }; });
    chk('Empleado: NO ve estadísticas, contabilidad, productos ni ajustes', vista.equipo && !vista.est && !vista.cont && !vista.aj && !vista.prod, vista);
    chk('…sí ve el historial, pero solo las ventas de HOY', vista.hist && await pB.evaluate(() => document.body.classList.contains('hist-hoy')), vista);
    chk('…pero sí vende (mesas / caja) y se ve su rol «Asesor de ventas»', vista.mesas && /Asesor de ventas/.test(vista.chip), vista);

    // ===== Ventas del día y correcciones con la clave del dueño =====
    await pB.evaluate(() => {
      const p = data.products[0]; p.stock = 10;
      const ayer = new Date(Date.now() - 7 * 864e5).toISOString(), hoy = new Date().toISOString();
      data.history.unshift({ id: 'v-vieja', table: null, tableName: 'Mostrador', total: 99000, payments: [{ method: 'efectivo', amount: 99000 }], items: [{ name: 'Chaqueta vieja', qty: 1, price: 99000 }], date: ayer });
      data.history.unshift({ id: 'v-hoy-1', table: null, tableName: 'Mostrador', total: p.price * 2, payments: [{ method: 'efectivo', amount: p.price * 2 }], items: [{ name: p.name, qty: 2, price: p.price }], date: hoy });
      data.history.unshift({ id: 'v-hoy-2', table: 1, total: p.price, payments: [{ method: 'efectivo', amount: p.price }], items: [{ name: p.name, qty: 1, price: p.price }], date: hoy });
      saveData();
    });
    await pB.evaluate(() => { const n = document.querySelector('nav button[data-view="historial"]'); if(n && getComputedStyle(n).display !== 'none') n.click(); else document.querySelector('.more-tile[data-go="historial"]').click(); });
    await pB.waitForTimeout(400); await pB.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); renderHistorial(); });
    const hv = await pB.evaluate(() => ({ filas: [...document.querySelectorAll('#histList .hist-row')].map(r => r.innerText), resumen: getComputedStyle(document.getElementById('histSummary')).display, cierre: document.getElementById('closeDayBtn').offsetParent === null ? 'none' : 'visible', graf: getComputedStyle(document.getElementById('chartsToggle')).display }));
    chk('Empleado: en el historial ve las ventas de hoy y NO la de la semana pasada', hv.filas.length === 2 && !hv.filas.some(t => /99\.000|Chaqueta vieja/.test(t)), hv);
    chk('…sin totales, gráficas ni cierre de caja', hv.resumen === 'none' && hv.cierre === 'none' && hv.graf === 'none', hv);
    await pB.evaluate(() => window.ventoVentaFix('borrar', 'v-hoy-1'));
    chk('Sin clave del dueño puesta, el empleado no puede borrar una venta', await pB.evaluate(() => !!data.history.find(h => h.id === 'v-hoy-1') && !document.querySelector('#vfOv.show')));
    // El dueño pone la clave de autorización
    await pA.click('#navMoreBtn'); await pA.click('.more-tile[data-go="ajustes"]');
    if(await pA.isVisible('#ajustesBackBtn')) await pA.click('#ajustesBackBtn');
    await pA.click('.ajustes-cat[data-cat="negocio"]');
    await pA.waitForSelector('#claveAutIn', { timeout: 6000 });
    await pA.fill('#claveAutIn', '4321'); await pA.click('#claveAutGo');
    chk('El dueño pone su clave de autorización (guardada cifrada, no en claro)', await esperar(pA, () => { const c = data.permisosEquipo.clave; return c && /^[0-9a-f]{64}$/.test(c.h) && !JSON.stringify(data).includes('"4321"'); }, null, 8000));
    await pA.evaluate(() => window.ventoNube.subir && window.ventoNube.subir());
    chk('La clave llega al celular del empleado', await esperar(pB, () => !!(data.permisosEquipo && data.permisosEquipo.clave && data.permisosEquipo.clave.h), null, 25000));
    // Clave equivocada
    pB.evaluate(() => window.ventoVentaFix('borrar', 'v-hoy-1')).catch(() => {});
    await pB.waitForSelector('#vfOv.show #vfClave');
    await pB.fill('#vfClave', '1111'); await pB.click('#vfSi');
    chk('Clave equivocada: no borra y avisa', await esperar(pB, () => /Clave equivocada/.test(document.getElementById('vfErr').textContent), null, 5000) && await pB.evaluate(() => !!data.history.find(h => h.id === 'v-hoy-1')));
    await pB.fill('#vfClave', '4321'); await pB.click('#vfSi');
    await esperar(pB, () => [...document.querySelectorAll('.overlay.show button')].some(x => /Sí, borrar/.test(x.textContent)), null, 6000);
    await pB.evaluate(() => { const b = [...document.querySelectorAll('.overlay.show button')].find(x => /Sí, borrar/.test(x.textContent)); if(b) b.click(); });
    chk('Con la clave del dueño: borra la venta y lo vendido vuelve al inventario', await esperar(pB, () => !data.history.find(h => h.id === 'v-hoy-1') && data.products[0].stock === 12, null, 6000), await pB.evaluate(() => [data.history.map(h => h.id), data.products[0].stock]));
    // Corregir: de 1 a 3 unidades
    pB.evaluate(() => window.ventoVentaFix('corregir', 'v-hoy-2')).catch(() => {});
    await pB.waitForSelector('#vfOv.show #vfClave'); await pB.fill('#vfClave', '4321'); await pB.click('#vfSi');
    await pB.waitForSelector('#vfOv.show [data-q="0"]');
    await pB.fill('#vfOv [data-q="0"]', '3'); await pB.click('#vfOv #vfSi');
    chk('Corregir con la clave: cantidad 1 → 3, total, pago e inventario ajustados y marcada «corregida»', await esperar(pB, () => { const h = data.history.find(x => x.id === 'v-hoy-2'), p = data.products[0];
      return h && h.items[0].qty === 3 && h.total === p.price * 3 && h.payments[0].amount === h.total && h.corregida && p.stock === 10; }, null, 6000), await pB.evaluate(() => [data.history.find(x => x.id === 'v-hoy-2'), data.products[0].stock]));
    await pB.evaluate(() => window.ventoActividad.enviar()); await pB.waitForTimeout(1200); await pB.evaluate(() => window.ventoActividad.enviar());
    chk('Borrar y corregir quedan en la actividad, «autorizado con la clave del dueño»', await (async () => { for(let i = 0; i < 30; i++){ const r = await uno("select count(*)::int n from auditoria a join auth.users u on u.id = a.usuario_id where a.negocio_id = $1 and u.email = 'laura@boutique.co' and a.accion in ('app:venta borrada a mano','app:venta corregida') and a.detalle->>'d' like '%autorizado con la clave%'", [NEG]); if(r.n >= 2) return true; await pB.waitForTimeout(500); } return false; })());

    // El dueño le permite ver el historial completo
    await pA.waitForSelector('#permisosEquipo [data-perm="empleado.historial"]', { timeout: 6000 });
    chk('Dueño: «👥 Permisos del equipo» y «📜 Actividad del equipo» en Ajustes → Negocio', await visible(pA, '#permisosEquipo') && await esperar(pA, () => !!document.getElementById('actividadEquipo'), null, 5000));
    await pA.check('#permisosEquipo [data-perm="empleado.historial"]');
    await pA.waitForTimeout(400);
    await pA.evaluate(() => window.ventoNube.subir && window.ventoNube.subir());
    chk('El permiso llega al celular del empleado y ya ve el historial completo (lo demás sigue oculto)', await esperar(pB, () => !document.body.classList.contains('hist-hoy') && document.body.classList.contains('no-estadisticas'), null, 25000));

    // ===== Actividad: venta, venta borrada, precio cambiado =====
    await pB.evaluate(() => { window.__nubeAplicando = false; data.history.unshift({ id: 'v-prueba-1', table: 1, total: 85000, payments: [{ method: 'efectivo', amount: 85000 }], items: [{ name: 'Blusa', qty: 1, price: 85000 }], date: new Date().toISOString(), by: authUser }); saveData(); });
    await pB.waitForTimeout(600);
    await pB.evaluate(() => { data.history = data.history.filter(h => h.id !== 'v-prueba-1'); saveData(); });
    await pB.waitForTimeout(600);
    chk('Cola de actividad del empleado: venta y venta borrada', await pB.evaluate(() => { const c = window.ventoActividad.cola().map(x => x.a); return c.includes('venta') && c.includes('venta borrada'); }) ||
      await uno("select count(*)::int n from auditoria where negocio_id = $1 and accion in ('app:venta','app:venta borrada')", [NEG]).then(r => r.n >= 2), await pB.evaluate(() => window.ventoActividad.cola()));
    await pB.evaluate(() => window.ventoActividad.enviar());
    chk('…llega al servidor con la cuenta y el rol de quien lo hizo', await (async () => { for(let i = 0; i < 40; i++){ const r = await uno("select count(*)::int n from auditoria a join auth.users u on u.id = a.usuario_id where a.negocio_id = $1 and u.email = 'laura@boutique.co' and a.accion in ('app:venta','app:venta borrada') and a.detalle->>'rol' = 'empleado'", [NEG]); if(r.n >= 2) return true; await pB.waitForTimeout(500); } return false; })());
    await pA.evaluate(() => { const p = data.products[0]; p.price = (+p.price || 0) + 1000; saveData(); });
    await pA.waitForTimeout(600); await pA.evaluate(() => window.ventoActividad.enviar());
    await pA.waitForTimeout(800);

    // ===== El dueño ve la actividad, por persona =====
    await pA.evaluate(() => window.ventoActividad.abrir());
    chk('Dueño: «📜 Actividad del equipo» muestra la venta borrada por el asesor y el precio que cambió él', await esperar(pA, () => { const t = (document.getElementById('actLista') || {}).innerText || ''; return /Venta borrada/.test(t) && /Blusa/.test(t) && /Laura/.test(t) && /Asesor de ventas/.test(t) && /Precio cambiado/.test(t); }, null, 15000), await pA.evaluate(() => (document.getElementById('actLista') || {}).innerText));
    const personas = await pA.evaluate(() => [...document.querySelectorAll('#actPersona option')].map(o => o.textContent));
    chk('…con filtro por persona', personas.some(x => /Laura/.test(x)) && personas.some(x => /ana@boutique|Ana/i.test(x)), personas);
    await pA.selectOption('#actPersona', { label: personas.find(x => /Laura/.test(x)) });
    chk('Filtrado por Laura: solo lo de ella', await esperar(pA, () => { const t = (document.getElementById('actLista') || {}).innerText || ''; return /Venta borrada/.test(t) && !/Precio cambiado/.test(t); }, null, 10000));
    await cerrarTodo(pA);

    // ===== Segundo administrador: maneja, pero no ve la actividad =====
    const C = await celular(), pC = C.p;
    await pC.click('#authNube'); await pC.waitForSelector('#nubeOv.show #nubeEmail');
    await pC.fill('#nubeEmail', 'pedro@boutique.co'); await pC.fill('#nubePass', 'clave123'); await pC.fill('#nubeNombre', 'Pedro');
    await pC.click('#nubeCrear'); await pC.waitForSelector('#nubeCodigo', { state: 'visible' });
    await pC.fill('#nubeCodigo', codAdm); await pC.click('#nubeUnirme');
    chk('El segundo administrador entra', await esperar(pC, n => { const x = window.ventoNube.negocio(); return x && x.id === n && x.rol === 'admin' && document.getElementById('authOverlay').hidden; }, NEG, 20000));
    await cerrarTodo(pC); await pC.waitForTimeout(2300);
    chk('…ve todo el negocio (estadísticas, ajustes) pero NO «📜 Actividad del equipo»', await pC.evaluate(() => !document.body.classList.contains('rol-equipo') && !document.getElementById('actividadEquipo')));
    const intento = await pC.evaluate(async n => { const c = await ventoNube.cliente(); const r = await c.rpc('actividad_ver', { p_negocio: n }); return !!r.error; }, NEG);
    chk('…y el servidor tampoco se la deja ver', intento);
    await pC.evaluate(() => { const p = data.products[1]; p.price = (+p.price || 0) + 500; saveData(); });
    await pC.waitForTimeout(600); await pC.evaluate(() => window.ventoActividad.enviar());
    chk('Lo que hace el segundo administrador queda en la actividad del dueño', await (async () => { for(let i = 0; i < 30; i++){ const r = await uno("select count(*)::int n from auditoria a join auth.users u on u.id = a.usuario_id where a.negocio_id = $1 and u.email = 'pedro@boutique.co' and a.accion = 'app:precio cambiado' and a.detalle->>'rol' = 'admin'", [NEG]); if(r.n >= 1) return true; await pC.waitForTimeout(500); } return false; })());
    await A.ctx.close(); await B.ctx.close(); await C.ctx.close();
  }
})();
