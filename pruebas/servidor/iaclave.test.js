// Pruebas del SERVIDOR: la clave de IA del negocio sale del documento compartido (migración 20261101000000_ia_clave_servidor,
// Vento 1.53.0) y la IA del negocio pasa por vento-pagos (/ia y /ia-clave), contra PostgreSQL REAL y un Gemini de mentiras.
//  • guardar_datos quita «iaClave» del documento y de los respaldos, y la guarda en el servidor (solo la de dueño/admin).
//  • Nadie la puede leer: ni el mesero, ni otro negocio, ni con la clave pública; solo sale hacia Google.
//  • La IA del negocio funciona por el servidor para cualquier miembro; se cifra al primer uso.
//  • Ajustes: guardar (probada con Google), cambiar y quitar solo dueño o administrador.
//  • La mudanza de los documentos que ya la tenían.
// Corre solo:   node pruebas/servidor/iaclave.test.js
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

const CLAVE = 'AIzaSyPRUEBA-negocio-0123456789abcd';
const OTRA = 'AIzaSyOTRA-del-mesero-9876543210zyxw';
const NUEVA = 'AIzaSyNUEVA-desde-ajustes-55555wxyz';
const MALA = 'AIzaSyMALA-que-google-rechaza-00000';

// Gemini de mentiras: anota qué clave y qué ruta llegaron.
const vistos = [];
function gemini() {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
        const k = req.headers['x-goog-api-key'] || '';
        vistos.push({ k, url: req.url, metodo: req.method, cuerpo: b });
        if (k === MALA) { rsp.writeHead(400, { 'content-type': 'application/json' }); rsp.end('{"error":{"code":400,"message":"API key not valid"}}'); return; }
        rsp.writeHead(200, { 'content-type': req.url.includes('alt=sse') ? 'text/event-stream' : 'application/json' });
        rsp.end(req.method === 'GET' ? '{"models":[{"name":"models/gemini-3.5-flash"}]}' : '{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}');
      });
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const tabla = async (q, tok) => { const r = await fetch(sb.url + '/rest/v1/' + q, { headers: cab(tok) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const F = sb.url + '/functions/v1/vento-pagos';
  const api = async (ruta, cuerpo, tok) => { const r = await fetch(F + '/' + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
  const ia = async (neg, ruta, tok, metodo, cuerpo) => { const r = await fetch(F + '/ia/' + neg + '/v1beta' + ruta, { method: metodo || 'POST', headers: cab(tok), body: metodo === 'GET' ? undefined : JSON.stringify(cuerpo || { contents: [] }) }); return { st: r.status, t: await r.text() }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];

  const dueno = await sb.usuario('dueno@ia.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar IA', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => {
    const u = await sb.usuario(email);
    const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j;
    await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token);
    return u;
  };
  const admin = await unir('admin@ia.co', 'admin');
  const mesero = await unir('mesero@ia.co', 'mesero');
  const otro = await sb.usuario('otro@bar2.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro Bar', p_datos: {} }, otro.token)).j;

  // ---------- guardar_datos saca la clave del documento ----------
  let r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar IA', iaClave: CLAVE, products: [{ id: 'p1', name: 'Águila', price: 5000 }] }, p_version: 1 }, dueno.token);
  let ver = r.j;
  chk('El guardado de la app sigue funcionando (versión 2)', r.st === 200 && ver === 2, r);
  let doc = await uno('select datos from datos_negocio where negocio_id = $1', [NEG]);
  chk('El documento compartido ya NO tiene la clave (y lo demás queda igual)', !('iaClave' in doc.datos) && doc.datos.products[0].name === 'Águila' && doc.datos.businessName === 'Bar IA', doc.datos);
  const resp = await uno('select datos from respaldos where negocio_id = $1 order by creado_en desc limit 1', [NEG]);
  chk('El respaldo automático tampoco la tiene', resp && !('iaClave' in resp.datos), resp && Object.keys(resp.datos));
  let g = await uno("select publico, secreto from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG]);
  chk('Queda guardada en el servidor (integraciones, tipo «ia») con sus últimos 4 caracteres', g && g.secreto === 'plano:' + CLAVE && g.publico.final === 'abcd' && g.publico.huella, g);

  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar IA', iaClave: OTRA }, p_version: ver }, mesero.token); ver = r.j;
  doc = await uno('select datos from datos_negocio where negocio_id = $1', [NEG]);
  g = await uno("select secreto from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG]);
  chk('Un mesero con otra clave en su celular: se quita del documento pero NO reemplaza la del negocio', r.st === 200 && !('iaClave' in doc.datos) && g.secreto === 'plano:' + CLAVE, [r, g]);
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar IA', iaClave: 'corta' }, p_version: ver }, dueno.token); ver = r.j;
  g = await uno("select secreto from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG]);
  chk('Algo que no es una clave se quita y no se guarda', r.st === 200 && g.secreto === 'plano:' + CLAVE, g);

  // ---------- Nadie la puede leer ----------
  const est = (await api('ia-clave', { negocio: NEG, accion: 'estado' }, mesero.token)).j;
  chk('Mesero: sabe que el negocio tiene clave, pero no ve ni el final', est.tiene === true && !est.final, est);
  const estD = (await api('ia-clave', { negocio: NEG, accion: 'estado' }, dueno.token)).j;
  chk('Dueño: ve que hay clave y sus últimos 4 caracteres (nunca la clave)', estD.tiene === true && estD.final === 'abcd' && !JSON.stringify(estD).includes(CLAVE), estD);
  r = await tabla('integraciones?negocio_id=eq.' + NEG, mesero.token);
  const r2 = await tabla('integraciones?negocio_id=eq.' + NEG, dueno.token);
  chk('Ni el mesero ni el dueño leen la tabla de claves directo', (r.st >= 400 || (Array.isArray(r.j) && !r.j.length)) && (r2.st >= 400 || (Array.isArray(r2.j) && !r2.j.length)), [r, r2]);
  r = await rpc('ia_clave_recibir', { p_negocio: NEG, p_clave: OTRA }, dueno.token);
  chk('Un cliente no puede llamar la función interna que guarda la clave', r.st >= 400, r);
  r = await rpc('ia_clave_estado', { p_negocio: NEG }, otro.token);
  chk('Otro negocio no puede preguntar por la clave de este', r.st >= 400, r);

  // ---------- La IA del negocio por el servidor ----------
  vistos.length = 0;
  r = await ia(NEG, '/models/gemini-3.5-flash:generateContent', mesero.token);
  chk('El mesero usa la IA del negocio por el servidor', r.st === 200 && /OK/.test(r.t), r);
  chk('… y a Google le llegó la clave del negocio (sin pasar por el celular)', vistos.length === 1 && vistos[0].k === CLAVE && vistos[0].url === '/v1beta/models/gemini-3.5-flash:generateContent', vistos);
  g = await uno("select secreto, publico from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG]);
  chk('Al primer uso queda CIFRADA en el servidor', /^v1:/.test(g.secreto) && !g.secreto.includes(CLAVE) && g.publico.cifrada === true, g.secreto.slice(0, 12));
  vistos.length = 0;
  r = await ia(NEG, '/models/gemini-3.5-flash:streamGenerateContent?alt=sse', dueno.token);
  chk('Respuesta en vivo (alt=sse) y la clave cifrada se usa igual', r.st === 200 && vistos[0].k === CLAVE && vistos[0].url.endsWith('?alt=sse'), vistos);
  r = await ia(NEG, '/models', admin.token, 'GET');
  chk('La lista de modelos también (GET)', r.st === 200 && /gemini/.test(r.t), r);
  r = await ia(NEG, '/models/gemini-3.5-flash:generateContent', otro.token);
  chk('Otro negocio NO puede usar la IA (ni la clave) de este', r.st >= 400 && r.st !== 404 || /sin_permiso/.test(r.t), r);
  r = await ia(NEG, '/models/gemini-3.5-flash:generateContent', null);
  chk('Sin sesión: no', r.st === 401, r);
  r = await ia(NEG, '/files/subir', dueno.token);
  chk('Solo las rutas de la IA (no otras de Google)', r.st === 404, r);
  r = await ia(NEG2, '/models/gemini-3.5-flash:generateContent', otro.token);
  chk('Un negocio sin clave propia: «sin_clave» (la app usa la IA de Vento)', r.st === 404 && /sin_clave/.test(r.t), r);

  // ---------- Ajustes: guardar, cambiar, quitar ----------
  r = await api('ia-clave', { negocio: NEG, accion: 'guardar', clave: NUEVA }, mesero.token);
  chk('El mesero no puede cambiar la clave', r.st >= 400, r);
  r = await api('ia-clave', { negocio: NEG, accion: 'guardar', clave: MALA }, dueno.token);
  chk('Una clave que Google rechaza no se guarda', r.st === 400 && r.j.error === 'clave_invalida', r);
  r = await api('ia-clave', { negocio: NEG, accion: 'guardar', clave: NUEVA }, admin.token);
  chk('El administrador la cambia (probada con Google) y ve solo el final', r.st === 200 && r.j.tiene && r.j.final === 'wxyz', r);
  vistos.length = 0;
  await ia(NEG, '/models/gemini-3.5-flash:generateContent', mesero.token);
  chk('Todos los equipos pasan a usar la nueva sin hacer nada', vistos[0] && vistos[0].k === NUEVA, vistos);
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar IA', iaClave: CLAVE }, p_version: ver }, dueno.token); ver = r.j;
  g = await uno("select publico from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG]);
  doc = await uno('select datos from datos_negocio where negocio_id = $1', [NEG]);
  chk('Un celular del dueño con la versión vieja vuelve a subir la clave ANTERIOR: se quita y NO deshace el cambio', g.publico.final === 'wxyz' && !('iaClave' in doc.datos), g.publico);
  r = await api('ia-clave', { negocio: NEG, accion: 'borrar' }, mesero.token);
  chk('El mesero no la puede quitar', r.st >= 400, r);
  r = await api('ia-clave', { negocio: NEG, accion: 'borrar' }, dueno.token);
  chk('El dueño la quita → todos usan la IA de Vento (y queda marcado que se quitó)', r.st === 200 && r.j.tiene === false && r.j.quitada === true, r);
  r = await ia(NEG, '/models/gemini-3.5-flash:generateContent', mesero.token);
  chk('… y el servidor responde «sin_clave»', r.st === 404 && /sin_clave/.test(r.t), r);
  r = await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar IA', iaClave: CLAVE }, p_version: ver }, dueno.token); ver = r.j;
  r = await ia(NEG, '/models/gemini-3.5-flash:generateContent', mesero.token);
  chk('Un celular viejo que vuelve a subir la clave NO deshace el «Quitar»', /sin_clave/.test(r.t), r);
  r = await api('ia-clave', { negocio: NEG, accion: 'guardar', clave: NUEVA }, dueno.token);
  chk('Después de quitarla, el dueño la puede volver a poner desde Ajustes', r.st === 200 && r.j.tiene && r.j.final === 'wxyz', r);
  const aud = await sb.sql("select accion from auditoria where negocio_id = $1 and accion like 'integracion_%' order by id", [NEG]);
  chk('Queda en la auditoría quién la guardó y quién la quitó', aud.some((a) => a.accion === 'integracion_guardada') && aud.some((a) => a.accion === 'integracion_borrada'), aud);

  // ---------- Mudanza de los documentos que ya la tenían ----------
  const v0 = Number((await uno('select version from datos_negocio where negocio_id = $1', [NEG2])).version);
  await sb.sql("update datos_negocio set datos = datos || jsonb_build_object('iaClave', $2::text, 'products', '[]'::jsonb) where negocio_id = $1", [NEG2, CLAVE]);
  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261101000000_ia_clave_servidor.sql'), 'utf8')); } catch (e) { err = e.message; }
  const d2 = await uno('select datos, version from datos_negocio where negocio_id = $1', [NEG2]);
  const g2 = await uno("select secreto from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG2]);
  chk('La migración (otra vez, idempotente) muda la clave que ya estaba en un documento y la quita de ahí', !err && !('iaClave' in d2.datos) && Array.isArray(d2.datos.products) && g2 && g2.secreto === 'plano:' + CLAVE, [err, d2, g2]);
  chk('… y sube la versión, para que los equipos bajen el documento sin la clave', Number(d2.version) === v0 + 1, [v0, d2.version]);
  const d1 = await uno('select version from datos_negocio where negocio_id = $1', [NEG]);
  chk('Los documentos sin clave no se tocan', Number(d1.version) === ver, [d1, ver]);
}

(async () => {
  let sb = null, g = null;
  try { g = await gemini(); sb = await iniciar({ env: { VENTO_GEMINI_URL: 'http://127.0.0.1:' + g.address().port } }); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); if (g) g.close(); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
