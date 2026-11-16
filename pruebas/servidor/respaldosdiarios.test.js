// Pruebas del SERVIDOR: ORDEVA 1.99.13 · los respaldos en la nube no se pierden y el administrador de ORDEVA los ve y
// restaura (migración 20261206000000_respaldos_diarios), contra PostgreSQL REAL.
//  • Al guardar, se siguen borrando los respaldos de más (quedan los 48 más nuevos), PERO el primero de cada día de los
//    últimos 60 días se queda. Los de hace más de 60 días sí se borran.
//  • Si se borra el negocio entero, sus respaldos se van con él (no se traba el borrado).
//  • srv_admin_respaldos: el estado de hoy y cada respaldo con cuántas ventas / productos tenía. Nadie con la sesión de la
//    app puede llamarla (ni el dueño): solo el servidor de ORDEVA (service_role) después de comprobar que es administrador.
//  • srv_admin_respaldo_restaurar: trae el respaldo, sube la versión, deja lo de antes como respaldo (se puede deshacer),
//    no acepta un respaldo de otro negocio y queda en la auditoría.
// Corre solo:   node pruebas/servidor/respaldosdiarios.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const n = async (q, p) => Number((await uno(q, p)).n);

  const dueno = await sb.usuario('dueno@diarios.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Diarios', p_datos: {} }, dueno.token)).j;
  const otro = await sb.usuario('otro@diarios.co');
  const OTRO = (await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, otro.token)).j;

  // ===== 1. Rotación: 3 respaldos por día durante 70 días (a la 1, 5 y 9 de la mañana, hora de Colombia) =====
  await sb.sql('delete from respaldos where negocio_id = $1', [NEG]);
  await sb.sql(`insert into respaldos(negocio_id, datos, version, creado_en)
                select $1, jsonb_build_object('d', d, 'h', h), 1,
                       ((date_trunc('day', now() at time zone 'America/Bogota') - (d || ' days')::interval + (h || ' hours')::interval) at time zone 'America/Bogota')
                from generate_series(1, 70) d, unnest(array[1, 5, 9]) h`, [NEG]);
  chk('1. Hay 210 respaldos de prueba (70 días × 3)', await n('select count(*) n from respaldos where negocio_id = $1', [NEG]) === 210);
  const ver = Number((await uno('select version from datos_negocio where negocio_id = $1', [NEG])).version);
  const g = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Diarios', history: [{ id: 'v1', total: 1000 }] }, p_version: ver }, dueno.token);
  chk('1. Guardar sigue funcionando (la regla no traba el guardado)', g.st === 200, g);
  const quedan = await n('select count(*) n from respaldos where negocio_id = $1', [NEG]);
  const sinDia = await n(`select count(*) n from generate_series(1, 59) d
                           where not exists (select 1 from respaldos r where r.negocio_id = $1
                             and (r.creado_en at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date - d)`, [NEG]);
  chk('1. Cada uno de los últimos 59 días conserva al menos un respaldo', sinDia === 0, { sinDia });
  const primeros = await n(`select count(*) n from respaldos r where r.negocio_id = $1 and (r.datos->>'h') = '1' and r.creado_en > now() - interval '60 days'`, [NEG]);
  chk('1. …y es el primero del día (el de la 1 de la mañana)', primeros >= 59, { primeros });
  const viejos = await n(`select count(*) n from respaldos where negocio_id = $1 and creado_en < now() - interval '61 days'`, [NEG]);
  chk('1. Los de hace más de 60 días sí se borran', viejos === 0, { viejos });
  chk('1. No crece sin límite: 48 más nuevos + uno por día (máximo ~110)', quedan >= 48 && quedan <= 110, { quedan });

  // ===== 2. Borrar el negocio entero se lleva sus respaldos =====
  const tmpU = await sb.usuario('tmp@diarios.co');
  const TMP = (await rpc('crear_negocio', { p_nombre: 'Temporal', p_datos: {} }, tmpU.token)).j;
  await sb.sql("insert into respaldos(negocio_id, datos, version, creado_en) values ($1, '{}'::jsonb, 1, now() - interval '3 days'), ($1, '{}'::jsonb, 1, now() - interval '2 days')", [TMP]);
  let borro = true; try { await sb.sql('delete from negocios where id = $1', [TMP]); } catch (e) { borro = e.message; }
  chk('2. Borrar el negocio entero funciona y se lleva sus respaldos', borro === true && await n('select count(*) n from respaldos where negocio_id = $1', [TMP]) === 0, borro);

  // ===== 3. srv_admin_respaldos =====
  const lista = (await uno('select public.srv_admin_respaldos($1) j', [NEG])).j;
  chk('3. srv_admin_respaldos: el estado de hoy (1 venta) y la lista con resumen por respaldo', lista && lista.actual && lista.actual.ventas === 1 && Array.isArray(lista.respaldos) && lista.respaldos.length === quedan && 'ventas' in lista.respaldos[0] && 'productos' in lista.respaldos[0], lista && { actual: lista.actual, n: (lista.respaldos || []).length, r0: (lista.respaldos || [])[0] });
  for (const [quien, tok] of [['el dueño', dueno.token], ['otro usuario', otro.token], ['sin sesión', null]]) {
    const r = await rpc('srv_admin_respaldos', { p_negocio: NEG }, tok);
    chk('3. ' + quien + ' no puede ver los respaldos por la app (solo el servidor de ORDEVA)', r.st !== 200, r);
  }

  // ===== 4. srv_admin_respaldo_restaurar =====
  const bueno = { businessName: 'Bar Diarios', products: [{ id: 'p1', name: 'Águila', price: 5000, stock: 12 }, { id: 'p2', name: 'Poker', price: 4500 }],
                  history: [{ id: 'h1', total: 5000 }, { id: 'h2', total: 4500 }, { id: 'h3', total: 9000 }] };
  const R = Number((await uno("insert into respaldos(negocio_id, datos, version, creado_en) values ($1, $2::jsonb, 7, now() - interval '20 hours') returning id", [NEG, JSON.stringify(bueno)])).id);
  const v0 = Number((await uno('select version from datos_negocio where negocio_id = $1', [NEG])).version);
  const antes = (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos;
  const nR0 = await n('select count(*) n from respaldos where negocio_id = $1', [NEG]);
  for (const [quien, tok] of [['el dueño', dueno.token], ['sin sesión', null]]) {
    const r = await rpc('srv_admin_respaldo_restaurar', { p_negocio: NEG, p_respaldo: R, p_admin: dueno.id }, tok);
    chk('4. ' + quien + ' no puede llamar la restauración del administrador por la app', r.st !== 200 && Number((await uno('select version from datos_negocio where negocio_id = $1', [NEG])).version) === v0, r);
  }
  let e1 = null; try { await sb.sql('select public.srv_admin_respaldo_restaurar($1, $2, $3)', [OTRO, R, dueno.id]); } catch (e) { e1 = e.message; }
  chk('4. Un respaldo de otro negocio no se restaura ahí (no_existe)', /no_existe/.test(e1 || ''), e1);
  const res = (await uno('select public.srv_admin_respaldo_restaurar($1, $2, $3) j', [NEG, R, dueno.id])).j;
  const ahora = await uno('select datos, version from datos_negocio where negocio_id = $1', [NEG]);
  chk('4. Restaura: 3 ventas y 2 productos, y la versión sube (los celulares lo bajan)', res.restaurado.ventas === 3 && res.restaurado.productos === 2 && Number(ahora.version) === v0 + 1 && ahora.datos.history.length === 3 && ahora.datos.products.length === 2, { res, v: ahora.version });
  const copia = await uno('select datos from respaldos where negocio_id = $1 order by id desc limit 1', [NEG]);
  chk('4. Lo que había antes quedó como respaldo (se puede deshacer)', JSON.stringify(copia.datos) === JSON.stringify(antes) && await n('select count(*) n from respaldos where negocio_id = $1', [NEG]) === nR0 + 1);
  const aud = await n("select count(*) n from auditoria where negocio_id = $1 and accion = 'respaldo_restaurado_admin'", [NEG]).catch(() => -1);
  chk('4. Queda en la auditoría del negocio', aud === 1, { aud });
  // Deshacer: restaurar la copia de antes
  const RA = Number((await uno('select id from respaldos where negocio_id = $1 order by id desc limit 1', [NEG])).id);
  await sb.sql('select public.srv_admin_respaldo_restaurar($1, $2, $3)', [NEG, RA, dueno.id]);
  chk('4. Deshacer (restaurar la copia de antes) deja todo como estaba', JSON.stringify((await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos) === JSON.stringify(antes));
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
