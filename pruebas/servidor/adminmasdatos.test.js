// Pruebas del SERVIDOR (1.72.4): ORDEVA Admin ve más datos de cada cuenta y de los errores, contra PostgreSQL REAL.
//  • Perfil: cuándo se puso la contraseña y si tiene que cambiarla. Nunca la contraseña (ni su huella).
//  • Resumen del negocio: productos, ventas de 30 días y de hoy, última venta, cuentas abiertas.
//  • Los errores de sus equipos. En la lista de errores, cada equipo trae primera vez, usuario_id y negocio_id.
//  • Datos raros en el documento (fechas o totales que no son números) no rompen nada.
// Corre solo:   node pruebas/servidor/adminmasdatos.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const dueno = await sb.usuario('dueno@masdatos.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Tienda Más Datos', p_datos: {} }, dueno.token)).j;
  const hoy = new Date().toISOString(), hace5 = new Date(Date.now() - 5 * 864e5).toISOString(), hace60 = new Date(Date.now() - 60 * 864e5).toISOString();
  await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Tienda Más Datos', businessType: 'tienda',
    products: [{ id: 'a', name: 'Arroz', price: 4500 }, { id: 'b', name: 'Leche', price: 3900 }, { id: 'c', name: 'Café', price: 9800 }],
    tables: { 1: { items: [{ name: 'Arroz', qty: 1, price: 4500 }] }, 2: { items: [] }, 3: { items: [{ name: 'Café', qty: 2, price: 9800 }] } },
    history: [{ id: 'v1', total: 10000, date: hoy }, { id: 'v2', total: 5000, date: hace5 }, { id: 'v3', total: 99000, date: hace60 }, { id: 'v4', total: 'mil', date: 'ayer' }] }, p_version: 1 }, dueno.token);
  await rpc('perfil_guardar', { p: { nombre: 'Doña Rosa', clave_nueva: true } }, dueno.token);
  await sb.sql("insert into app_errores(huella, tipo, mensaje, equipo, negocio, negocio_id, usuario, usuario_id, version, plataforma, modelo, veces, primero, ultimo) values ('h-prueba', 'js', 'x is not defined', 'eq-1', 'Tienda Más Datos', $1, 'dueno@masdatos.co', $2, '1.72.4', 'apk', 'Samsung A15', 3, now() - interval '2 days', now())", [NEG, dueno.id]);

  const u = (await sb.sql('select public.srv_admin_usuario($1) u', [dueno.id]))[0].u;
  chk('Lo de antes sigue (correo, negocios, equipos, licencias)', u && u.email === 'dueno@masdatos.co' && Array.isArray(u.negocios) && Array.isArray(u.equipos_lista) && Array.isArray(u.licencias), u);
  chk('Perfil: nombre, cuándo se puso la contraseña y si tiene que cambiarla', u.perfil && u.perfil.nombre === 'Doña Rosa' && !!u.perfil.clave_puesta_en && u.perfil.cambiar_clave === false, u.perfil);
  chk('Nunca la contraseña ni su huella', !/encrypted_password|password|\$2[aby]\$/.test(JSON.stringify(u)), Object.keys(u));
  const r = (u.negocios_resumen || [])[0] || {};
  chk('Negocio: tipo y 3 productos', r.nombre === 'Tienda Más Datos' && r.tipo === 'tienda' && r.productos === 3, r);
  chk('Negocio: 2 cuentas abiertas (la vacía no cuenta)', r.cuentas_abiertas === 2, r);
  chk('Ventas de 30 días: 2 por $15.000 (la de hace 60 días y la dañada no cuentan)', r.ventas_30 === 2 && Number(r.total_30) === 15000, r);
  chk('Ventas de hoy: 1 por $10.000 y la última venta es la de hoy', r.ventas_hoy === 1 && Number(r.total_hoy) === 10000 && !!r.ultima_venta, r);
  chk('Errores de sus equipos (mensaje, modelo, veces)', (u.errores || []).length === 1 && u.errores[0].mensaje === 'x is not defined' && u.errores[0].modelo === 'Samsung A15' && u.errores[0].veces === 3, u.errores);
  const er = (await sb.sql("select public.srv_admin_errores('abiertos', 50) e"))[0].e;
  const c = ((er || []).find(x => x.huella === 'h-prueba') || {}).casos || [];
  chk('Lista de errores: cada equipo con primera vez, usuario_id y negocio_id', c.length === 1 && !!c[0].primero && c[0].usuario_id === dueno.id && c[0].negocio_id === NEG, c);
  const sinNeg = await sb.usuario('nuevo@masdatos.co');
  const u2 = (await sb.sql('select public.srv_admin_usuario($1) u', [sinNeg.id]))[0].u;
  chk('Cuenta sin negocio ni errores: listas vacías, sin fallar', u2 && Array.isArray(u2.negocios_resumen) && !u2.negocios_resumen.length && Array.isArray(u2.errores) && !u2.errores.length, u2);
  const priv = await sb.sql("select has_function_privilege('anon', 'public.srv_admin_usuario(uuid)', 'execute') a, has_function_privilege('authenticated', 'public.srv_admin_usuario(uuid)', 'execute') b, has_function_privilege('authenticated', 'public.srv_admin_errores(text, int)', 'execute') c");
  chk('Siguen siendo solo del servidor (ni anon ni usuarios las pueden llamar)', !priv[0].a && !priv[0].b && !priv[0].c, priv[0]);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
