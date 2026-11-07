// Pruebas del SERVIDOR: 🎁 bonos y tarjetas de regalo (migración 20261201000000_bonos, ORDEVA 1.93.0), contra PostgreSQL REAL.
//  • Crear (código de 8), ver el saldo, pagar con el bono (todo o parte), la misma venta dos veces descuenta una sola.
//  • Cinco cajas AL MISMO TIEMPO con el mismo bono: nunca se gasta más de lo que tiene.
//  • Deshacer la venta devuelve el saldo (una sola vez). Vencido no paga. Otro negocio y los anónimos no tocan nada.
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const dueno = await sb.usuario('dueno@bonos.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Tienda Bonos', p_datos: {} }, dueno.token)).j;
  const otro = await sb.usuario('otro@bonos.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otra', p_datos: {} }, otro.token)).j;

  let r = await rpc('bono_crear', { p_negocio: NEG, p_valor: 50000, p_cliente: 'Para Ana', p_meses: 6 }, dueno.token);
  const COD = r.j && r.j.codigo;
  chk('Se crea un bono de $50.000 con código de 8 y vence en 6 meses', r.st === 200 && /^[A-Z0-9]{8}$/.test(COD || '') && Number(r.j.saldo) === 50000 && !!r.j.vence, r);
  r = await rpc('bono_ver', { p_negocio: NEG, p_codigo: COD.toLowerCase() }, dueno.token);
  chk('Se consulta el saldo (sin importar mayúsculas)', r.j && r.j.ok && Number(r.j.bono.saldo) === 50000, r);
  r = await rpc('bono_redimir', { p_negocio: NEG, p_codigo: COD, p_monto: 18000, p_ref: 'venta-1' }, dueno.token);
  chk('Pagar $18.000 con el bono: queda $32.000', r.j && r.j.ok && Number(r.j.usado) === 18000 && Number(r.j.bono.saldo) === 32000, r);
  r = await rpc('bono_redimir', { p_negocio: NEG, p_codigo: COD, p_monto: 18000, p_ref: 'venta-1' }, dueno.token);
  chk('La misma venta otra vez (doble toque, reintento): no descuenta otra vez', r.j && r.j.ok && r.j.repetido === true && Number(r.j.bono.saldo) === 32000, r);
  r = await rpc('bono_redimir', { p_negocio: NEG, p_codigo: COD, p_monto: 40000, p_ref: 'venta-2' }, dueno.token);
  chk('Una compra de $40.000 usa lo que queda ($32.000) y el resto va por otro medio', r.j && r.j.ok && Number(r.j.usado) === 32000 && Number(r.j.bono.saldo) === 0, r);
  r = await rpc('bono_redimir', { p_negocio: NEG, p_codigo: COD, p_monto: 1000, p_ref: 'venta-3' }, dueno.token);
  chk('Sin saldo: no paga', r.j && r.j.ok === false && r.j.error === 'sin_saldo', r);
  r = await rpc('bono_devolver', { p_negocio: NEG, p_ref: 'venta-2' }, dueno.token);
  const r2 = await rpc('bono_devolver', { p_negocio: NEG, p_ref: 'venta-2' }, dueno.token);
  const v = (await rpc('bono_ver', { p_negocio: NEG, p_codigo: COD }, dueno.token)).j;
  chk('Deshacer la venta 2 devuelve sus $32.000 (una sola vez aunque se pida dos)', r.j.devueltos === 1 && r2.j.devueltos === 0 && Number(v.bono.saldo) === 32000, { r: r.j, r2: r2.j, v });

  // Cinco cajas al mismo tiempo, $10.000 cada una, con $32.000 de saldo: 3 pagan todo, 1 paga $2.000, 1 no paga.
  const varias = await Promise.all([1, 2, 3, 4, 5].map(i => rpc('bono_redimir', { p_negocio: NEG, p_codigo: COD, p_monto: 10000, p_ref: 'caja-' + i }, dueno.token)));
  const usado = varias.filter(x => x.j && x.j.ok).reduce((s, x) => s + Number(x.j.usado), 0);
  const fin = (await rpc('bono_ver', { p_negocio: NEG, p_codigo: COD }, dueno.token)).j;
  chk('Cinco cajas AL MISMO TIEMPO: en total se gastan exactamente los $32.000 que tenía, ni un peso más', usado === 32000 && Number(fin.bono.saldo) === 0, { usado, varias: varias.map(x => x.j) });

  await sb.sql("update bonos set vence = current_date - 1 where negocio_id = $1", [NEG]);
  await rpc('bono_devolver', { p_negocio: NEG, p_ref: 'caja-1' }, dueno.token);
  r = await rpc('bono_redimir', { p_negocio: NEG, p_codigo: COD, p_monto: 1000, p_ref: 'venta-v' }, dueno.token);
  chk('Vencido: no paga aunque tenga saldo', r.j && r.j.ok === false && r.j.error === 'vencido', r);

  r = await rpc('bono_ver', { p_negocio: NEG, p_codigo: COD }, otro.token);
  chk('Otro negocio no ve ni usa los bonos de este', r.st >= 400, r);
  r = await rpc('bono_redimir', { p_negocio: NEG, p_codigo: COD, p_monto: 1000, p_ref: 'x' }, otro.token);
  chk('… ni puede pagar con ellos', r.st >= 400, r);
  r = await rpc('bono_crear', { p_negocio: NEG, p_valor: 1000, p_cliente: null, p_meses: 0 });
  chk('Sin entrar no se crean bonos', r.st >= 400, r);
  const q = await fetch(sb.url + '/rest/v1/bonos?select=*', { headers: cab(dueno.token) });
  chk('La tabla de bonos no se lee directo (solo por las funciones)', q.status >= 400 || (await q.json().catch(() => [])).length === 0, q.status);
  r = await rpc('bono_lista', { p_negocio: NEG }, dueno.token);
  chk('El panel lista los bonos del negocio', Array.isArray(r.j) && r.j.length === 1 && r.j[0].codigo === COD, r);
  void NEG2;
}

(async () => {
  let sb;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
