// Pruebas del SERVIDOR: el QR del cliente ya no deja leer los pedidos del negocio (migración
// 20261104000000_canal_pedidos_privado, Vento 1.54.0, hallazgo D8), contra PostgreSQL REAL.
//  • El servidor anota los canales de pedidos de cada negocio (qrCanales y qrFijo) al guardar; el primero se queda.
//  • Durante los 7 días de gracia se lee como antes (celulares del local con la versión anterior).
//  • Cerrado: con la clave pública (lo que tiene cualquiera con el QR) no se leen; un miembro del negocio sí.
//  • El cliente sigue escribiendo pedidos y leyendo lo suyo: estado del pedido, carta, fotos, ambiente y su cuenta.
//  • Otro negocio no se puede «apropiar» del canal poniéndolo en sus datos.
// Corre solo:   node pruebas/servidor/canalprivado.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

const C = 'vitopedidosabc123', FIJO = 'vitofijoxyz98765', OTRO = 'vitootronegocio77';

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const leer = async (canales, tok) => { const r = await rpc('canal_leer', { p_canales: canales, p_desde: Math.floor(Date.now() / 1000) - 3600 }, tok); return r.st === 200 ? r.j.map((m) => m.topic + ':' + m.message) : r; };
  const pub = (canal, txt) => rpc('canal_publicar', { p_canal: canal, p_cuerpo: txt });
  const uno = async (q, p) => (await sb.sql(q, p))[0];

  const dueno = await sb.usuario('dueno@qr.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar QR', p_datos: {} }, dueno.token)).j;
  const mesero = await sb.usuario('mesero@qr.co');
  const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, dueno.token)).j;
  await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: 'Pedro' }, mesero.token);
  const otro = await sb.usuario('otro@bar2.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro Bar', p_datos: {} }, otro.token)).j;

  // ---------- Al guardar se anotan los canales de pedidos ----------
  let r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar QR', qrCanales: [C, 'malo!', 'x'], qrFijo: { topic: FIJO, url: 'https://x' }, iaClave: 'AIzaSyQUITAR-del-documento-12345' }, p_version: 1 }, dueno.token);
  let ver = r.j;
  const anot = await sb.sql('select canal, negocio_id from canal_privado order by canal');
  chk('Al guardar, el servidor anota los canales de pedidos del negocio (los raros no)', anot.length === 2 && anot.every((a) => a.negocio_id === NEG) && anot.map((a) => a.canal).join() === [C, FIJO].sort().join(), anot);
  chk('El guardado sigue quitando la clave de IA (1.53.0)', !('iaClave' in (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos));

  // ---------- El cliente del QR: escribe y lee lo suyo ----------
  await pub(C, '{"t":"pedido","id":"p1","mesa":4,"items":[["Águila",2]]}');
  await pub(C, 'DOMICILIO: Luis Pérez · 3001234567 · Calle 1 # 2-3');
  await pub(C + 'e', '{"t":"estado","id":"p1","e":"recibido","m":4,"n":"Recibido"}');
  await pub(C + 'k', '{"carta":1}');
  await pub(FIJO, '{"t":"cancion","mesa":2,"s":"Despacito"}');
  let l = await leer([C, C + 'e'], null);
  chk('Durante los 7 días de gracia se lee como antes (los celulares del local con la versión anterior no se quedan sin pedidos)', Array.isArray(l) && l.some((m) => m.startsWith(C + ':')) && l.length === 3, l);

  // ---------- Cerrado ----------
  await sb.sql("update canal_privado set cerrar_desde = now() - interval '1 minute'");
  l = await leer([C], null);
  chk('Cerrado: con la clave pública (la del QR) NO se leen los pedidos', Array.isArray(l) && l.length === 0, l);
  l = await leer([C, FIJO, C + 'e', C + 'k'], null);
  chk('… ni mezclando canales: el cliente solo recibe el estado de su pedido y la carta', Array.isArray(l) && l.length === 2 && l.every((m) => m.startsWith(C + 'e:') || m.startsWith(C + 'k:')), l);
  chk('… y nada del domicilio (nombre, teléfono, dirección)', !JSON.stringify(l).includes('3001234567'), l);
  r = await pub(C, '{"t":"pedido","id":"p2","mesa":5}');
  chk('El cliente sigue mandando pedidos al canal (escribir no cambia)', r.st === 200 && r.j && r.j.id, r);
  l = await leer([C, FIJO], dueno.token);
  chk('El dueño (con su sesión) lee los pedidos, los domicilios y las canciones', Array.isArray(l) && l.length === 4 && l.some((m) => m.includes('3001234567')) && l.some((m) => m.includes('Despacito')), l);
  l = await leer([C], mesero.token);
  chk('Un mesero del negocio también', Array.isArray(l) && l.length === 3, l);
  l = await leer([C, C + 'e'], otro.token);
  chk('El dueño de OTRO negocio no (solo ve el estado, como cualquier cliente)', Array.isArray(l) && l.length === 1 && l[0].startsWith(C + 'e:'), l);

  // ---------- Nadie se apropia del canal de otro ----------
  r = await rpc('guardar_datos', { p_negocio: NEG2, p_datos: { qrCanales: [C, OTRO] }, p_version: 1 }, otro.token);
  const due = await uno('select negocio_id from canal_privado where canal = $1', [C]);
  l = await leer([C], otro.token);
  chk('Otro negocio pone ese canal en sus datos: sigue siendo del primero y no lo puede leer', due.negocio_id === NEG && Array.isArray(l) && l.length === 0, [due, l]);
  const nuevo = await uno('select negocio_id, cerrar_desde from canal_privado where canal = $1', [OTRO]);
  chk('Su propio canal nuevo sí queda anotado a su nombre', nuevo && nuevo.negocio_id === NEG2, nuevo);

  // ---------- Canales nuevos después de la gracia: cerrados de una ----------
  await sb.sql("update servidor_config set valor = jsonb_build_object('t', now() - interval '1 day') where clave = 'canal_privado_desde'");
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar QR', qrCanales: [C, 'vitonuevodespues1'], qrFijo: { topic: FIJO } }, p_version: ver }, dueno.token); ver = r.j;
  const n2 = await uno("select cerrar_desde <= now() + interval '5 seconds' cerrado from canal_privado where canal = 'vitonuevodespues1'");
  chk('Un canal que se crea después de la gracia queda cerrado de una vez', n2 && n2.cerrado === true, n2);

  // ---------- Lo demás no cambia ----------
  const libre = 'vitosinduenoaaaa1';
  await pub(libre, 'hola');
  l = await leer([libre], null);
  chk('Un canal que no es de pedidos de ningún negocio se lee como siempre', Array.isArray(l) && l.length === 1, l);
  r = await fetch(sb.url + '/rest/v1/canal_privado', { headers: cab(dueno.token) });
  const rj = await r.json().catch(() => null);
  chk('Nadie lee la lista de canales privados directo', r.status >= 400 || (Array.isArray(rj) && !rj.length), [r.status, rj]);
  r = await rpc('canal_privado_anotar', { p_negocio: NEG2, p_datos: { qrCanales: ['vitorobarcanal999'] } }, otro.token);
  chk('Un cliente no puede anotar canales a mano', r.st >= 400, r);

  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261104000000_canal_pedidos_privado.sql'), 'utf8')); } catch (e) { err = e.message; }
  const tras = await uno('select count(*) n from canal_privado');
  chk('La migración se vuelve a correr sin errores y sin cambiar dueños ni fechas', !err && Number(tras.n) === 4 && (await uno('select negocio_id from canal_privado where canal = $1', [C])).negocio_id === NEG, [err, tras]);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
