// Pruebas del SERVIDOR: aceptar un pedido del QR UNA sola vez (pedido_reclamar, 1.99.90), contra PostgreSQL REAL.
//  1. El primer equipo que lo acepta recibe true; el segundo (mismo pedido) false.
//  2. Un mesero del negocio también puede (cualquier miembro); otro pedido vuelve a dar true.
//  3. El dueño de OTRO negocio y alguien sin sesión no pueden reclamar pedidos de este negocio.
//  4. La tabla no se lee por la API.
// Corre solo:   node pruebas/servidor/pedidosreclamar.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }
(async () => {
  const sb = await iniciar();
  try {
    const cab = tok => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
    const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
    const dueno = await sb.usuario('dueno@tienda-r.co');
    const N = (await rpc('crear_negocio', { p_nombre: 'Tienda R', p_datos: {} }, dueno.token)).j;
    const mesero = await sb.usuario('mesero@tienda-r.co');
    await rpc('unirse_con_codigo', { p_codigo: (await rpc('crear_invitacion', { p_negocio: N, p_rol: 'mesero' }, dueno.token)).j, p_nombre: 'Mesero' }, mesero.token);
    const otro = await sb.usuario('dueno@otra.co'); await rpc('crear_negocio', { p_nombre: 'Otra', p_datos: {} }, otro.token);
    const r1 = await rpc('pedido_reclamar', { p_negocio: N, p_pedido: 'pq1' }, dueno.token);
    const r2 = await rpc('pedido_reclamar', { p_negocio: N, p_pedido: 'pq1' }, mesero.token);
    chk('1. primero true, segundo (el mismo pedido) false', r1.j === true && r2.j === false, { r1, r2 });
    const r3 = await rpc('pedido_reclamar', { p_negocio: N, p_pedido: 'pq2' }, mesero.token);
    chk('2. un mesero del negocio puede; otro pedido → true', r3.j === true, r3);
    const r4 = await rpc('pedido_reclamar', { p_negocio: N, p_pedido: 'pq3' }, otro.token);
    const r5 = await rpc('pedido_reclamar', { p_negocio: N, p_pedido: 'pq3' }, null);
    chk('3. otro negocio y sin sesión: no pueden', r4.j !== true && r5.j !== true && r4.st >= 400 && r5.st >= 400, { r4, r5 });
    const lee = await fetch(sb.url + '/rest/v1/pedidos_aceptados?select=*', { headers: cab(dueno.token) });
    const filas = await lee.json().catch(() => null);
    chk('4. la tabla no se lee por la API', lee.status >= 400 || (Array.isArray(filas) && filas.length === 0), { st: lee.status, filas });
  } catch (e) { mal++; console.log('❌ excepción: ' + (e && e.stack || e)); }
  await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
