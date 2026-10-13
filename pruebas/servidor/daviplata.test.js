// Pruebas del SERVIDOR de pagos con la API oficial «Pago con DaviPlata» (vento-pagos + migración 20261008000000) contra
// PostgreSQL 16 REAL. DaviPlata se simula con el punto de inyección del transporte (daviplata.ts → usarTransportePruebas),
// revisando las cabeceras y los cuerpos EXACTOS de la especificación (API 37 del Developer Portal). También prueban el modo
// «directo» (Deno.createHttpClient simulado) y el modo «puente» con el Cloudflare Worker de verdad (puente/daviplata-worker.js).
// Corre solo:   node pruebas/servidor/daviplata.test.js      (o: bash pruebas/correr.sh servidor)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { iniciar } = require('./supabase-local');
const { crearDavi, CRED, BASES, DOC, bogota } = require('./daviplata-simulado');

const RAIZ = path.resolve(__dirname, '..', '..');
let ok = 0, mal = 0;
const chk = (n, c, x) => {
  if (c) { ok++; console.log('✅ ' + n); }
  else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Los registros JSON del servidor se guardan (para revisar que no tengan secretos ni documentos) y no se imprimen.
const LOGS = [];
for (const k of ['log', 'warn', 'error']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) { LOGS.push(a[0]); if (process.env.VENTO_LOGS) orig(...a); return; } orig(...a); };
}

// ---------- Credenciales de prueba ----------
const LLAVE = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const CERT = '-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIUVentoPruebaDaviPlataLaboratorio0001AAAAAAAAAAAAAAAA\nQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=\n-----END CERTIFICATE-----';

// ---------- Web Push: un «celular» de mentiras que descifra lo que le llega (RFC 8291) ----------
function celularPush() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16), recibidos = [];
  const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const descifrar = (buf) => {
    const sal = buf.subarray(0, 16), idlen = buf[20], asPub = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
    const compartido = ecdh.computeSecret(asPub), uaPub = ecdh.getPublicKey();
    const ikm = hmac(hmac(auth, compartido), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])])).subarray(0, 32);
    const prk = hmac(sal, ikm);
    const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
    const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
    const dc = crypto.createDecipheriv('aes-128-gcm', cek, nonce); dc.setAuthTag(ct.subarray(ct.length - 16));
    const pt = Buffer.concat([dc.update(ct.subarray(0, ct.length - 16)), dc.final()]);
    return JSON.parse(pt.subarray(0, pt.lastIndexOf(2)).toString());
  };
  const server = http.createServer((req, res) => {
    const t = []; req.on('data', (c) => t.push(c)); req.on('end', () => {
      try { recibidos.push({ cab: req.headers, msg: descifrar(Buffer.concat(t)) }); } catch (e) { recibidos.push({ cab: req.headers, error: e.message }); }
      res.writeHead(201); res.end();
    });
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, recibidos,
    sus: { endpoint: 'http://127.0.0.1:' + server.address().port + '/push/' + crypto.randomBytes(4).toString('hex'), keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } })));
}

async function pruebas(sb) {
  const D = await import(pathToFileURL(path.join(RAIZ, 'supabase', 'functions', 'vento-pagos', 'daviplata.ts')).href);
  const F = sb.url + '/functions/v1/vento-pagos';
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  async function api(ruta, cuerpo, tok) {
    const r = await fetch(F + ruta, { method: cuerpo === undefined ? 'GET' : 'POST', headers: cab(tok), body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    return { st: r.status, j: await r.json().catch(() => ({})) };
  }
  const rpc = async (fn, args, tok) => {
    const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok || sb.anonKey), body: JSON.stringify(args || {}) });
    return { st: r.status, j: await r.json().catch(() => null) };
  };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const davi = crearDavi();
  const RUTAS_TOKEN = D.RUTAS.token;
  D.usarTransportePruebas(davi.simular);

  // =========================== Usuarios, negocios y roles ===========================
  const dueno = await sb.usuario('dueno@bar.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar La 14', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => {
    const u = await sb.usuario(email);
    const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j;
    await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token);
    return u;
  };
  const cajero = await unir('caja@bar.co', 'cajero');
  const mesero = await unir('mesero@bar.co', 'mesero');
  const ajeno = await sb.usuario('ajeno@otro.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro Bar', p_datos: {} }, ajeno.token)).j;
  chk('Negocio con dueño, cajero, mesero y otro negocio aparte', /^[0-9a-f-]{36}$/.test(NEG) && /^[0-9a-f-]{36}$/.test(NEG2) &&
    (await uno('select count(*)::int n from miembros where negocio_id = $1', [NEG])).n === 3);

  // =========================== Migración ===========================
  const cons = await sb.sql("select conname, pg_get_constraintdef(oid) d from pg_constraint where conname in ('pagos_proveedor_check','pagos_canal_check','pago_proveedores_proveedor_check')");
  chk('Migración: proveedor «daviplata» y canal «otp» permitidos (CHECK reales)', cons.length === 3 && cons.every((c) => /daviplata|otp/.test(c.d)) && cons.some((c) => /'otp'/.test(c.d)), cons);
  let r = await api('/salud');
  chk('GET /salud anuncia «daviplata_api» (v1.18)', r.st === 200 && r.j.integraciones.includes('daviplata_api') && r.j.version === '1.18.0', r.j);

  // Celular del dueño con avisos push activos
  const cel = await celularPush();
  const dev = (await rpc('registrar_dispositivo', { p_negocio: NEG, p_nombre: 'Caja' }, dueno.token)).j;
  await rpc('latido_dispositivo', { p_dispositivo: dev.id, p_push: cel.sus }, dueno.token);

  // =========================== Conectar (Ajustes → 💜 Pagos → Conectar DaviPlata) ===========================
  const guardar = (extra, tok) => api('/config', { negocio: NEG, accion: 'guardar_daviplata', ambiente: 'sandbox', transporte: 'directo', ...CRED, cert: CERT, key: LLAVE, ...(extra || {}) }, tok || dueno.token);
  r = await guardar({ cert: 'no soy un certificado' });
  chk('Certificado que no es PEM → 400 claro (no se llama a DaviPlata)', r.st === 400 && r.j.error === 'daviplata_datos' && /certificado/i.test(r.j.mensaje) && davi.n.token === 0, r.j);
  r = await guardar({ id_terminal: '' });
  chk('Sin idTerminal de Redeban → 400 claro', r.st === 400 && /idTerminal/.test(r.j.mensaje), r.j);
  r = await guardar({}, mesero.token);
  chk('El mesero NO puede configurar DaviPlata (403)', r.st === 403 && r.j.error === 'sin_permiso', r.j);
  r = await guardar({}, cajero.token);
  chk('El cajero tampoco (403)', r.st === 403, r.j);
  r = await guardar({ client_secret: 'secreto-equivocado' });
  let fila = await uno("select * from pago_proveedores where negocio_id = $1 and proveedor = 'daviplata'", [NEG]);
  chk('Client Secret equivocado → «DaviPlata rechazó el Client ID o el Client Secret» y queda en estado error', r.st === 400 && r.j.error === 'daviplata_credenciales' &&
    fila && fila.estado === 'error' && /Client Secret/.test(fila.detalle), { j: r.j, fila: fila && fila.estado });
  r = await api('/config', { negocio: NEG, accion: 'estado' }, dueno.token);
  chk('…y el resumen lo muestra pendiente con el detalle del error', r.j.resumen.daviplata.estado === 'pendiente' && /API DaviPlata con error/.test(r.j.resumen.daviplata.detalle), r.j.resumen);
  const t0 = davi.n.token;
  r = await guardar({});
  chk('Credenciales correctas → verificado pidiendo un token (form-urlencoded exacto) y «conectado»', r.st === 200 && davi.n.token === t0 + 1 &&
    r.j.resumen.daviplata.estado === 'conectado' && r.j.resumen.daviplata.via.includes('API DaviPlata') && /API DaviPlata \(laboratorio\)/.test(r.j.resumen.daviplata.detalle), r.j.resumen);
  chk('…contra el LABORATORIO (apislab.daviplata.com)', davi.urls.slice(-1)[0] === BASES.sandbox + '/oauth2Provider/type1/v1/token', davi.urls.slice(-1));
  const txt = JSON.stringify(r.j);
  chk('La respuesta NUNCA devuelve el secreto, el certificado ni la llave', !txt.includes(CRED.client_secret) && !txt.includes('BEGIN') && !txt.includes(CRED.client_id), txt.slice(0, 300));
  fila = await uno("select * from pago_proveedores where negocio_id = $1 and proveedor = 'daviplata'", [NEG]);
  chk('En la base: credenciales cifradas (AES-GCM «v1:…»), sin texto plano', fila.secreto.startsWith('v1:') && !fila.secreto.includes(CRED.client_secret) && !fila.secreto.includes('BEGIN') &&
    !JSON.stringify(fila.publico).includes(CRED.client_secret) && fila.publico.transporte === 'directo' && fila.publico.terminal === 'ESB10934', fila.publico);
  r = await rpc('pagos_estado', { p_negocio: NEG }, dueno.token);
  chk('pagos_estado (lo que lee la app) no trae el secreto', r.st === 200 && !JSON.stringify(r.j).includes('v1:') && r.j.proveedores.some((p) => p.proveedor === 'daviplata' && p.tiene_secreto === true), r.j);
  r = await fetch(sb.url + '/rest/v1/pago_proveedores?select=*', { headers: cab(dueno.token) }).then((x) => x.json());
  chk('La tabla pago_proveedores no se puede leer con sesión', !Array.isArray(r) || r.length === 0, r);
  r = await api('/config', { negocio: NEG, accion: 'probar', proveedor: 'daviplata' }, dueno.token);
  chk('«Comprobar» vuelve a verificar con las credenciales guardadas', r.st === 200 && r.j.resumen.daviplata.estado === 'conectado' && davi.n.token === t0 + 2, r.j);
  r = await guardar({ client_secret: '', cert: '', key: '' });
  chk('Guardar otra vez dejando vacíos secreto, certificado y llave conserva los guardados', r.st === 200 && r.j.resumen.daviplata.estado === 'conectado', r.j);

  // =========================== Cobrar con código ===========================
  const tokAntes = davi.n.token;
  const cobrar = (extra, tok) => api('/cobro', { negocio: NEG, proveedor: 'daviplata', canal: 'otp', monto: 12000, mesa: '3', tipo_documento: 'CC', numero_documento: '1.134.568.019', idem: 'k-' + crypto.randomBytes(5).toString('hex'), ...(extra || {}) }, tok || dueno.token);
  r = await cobrar();
  let P = r.j.pago || {};
  const sesion = [...davi.sesiones.entries()].slice(-1)[0] || [];
  chk('/cobro DaviPlata → pago «pendiente» (proveedor daviplata, canal otp, id_externo = idSessionToken)', r.st === 200 && P.estado === 'pendiente' && P.proveedor === 'daviplata' &&
    P.canal === 'otp' && P.metodo === 'DAVIPLATA' && P.id_externo === sesion[0] && P.mesa === '3' && P.monto === 12000, r.j);
  chk('…compra con valor como TEXTO "12000", documento sin puntos y tipo "01"', davi.sesiones.get(P.id_externo) && davi.sesiones.get(P.id_externo).valor === '12000' && davi.sesiones.get(P.id_externo).doc === DOC && davi.sesiones.get(P.id_externo).tipo === '01');
  chk('…el documento queda SOLO con los últimos 4 dígitos («CC •••8019»)', P.documento === 'CC •••8019', P.documento);
  const enBase = JSON.stringify(await uno('select row_to_json(p) j from pagos p where id = $1', [P.id]));
  chk('…y el número completo no está en ninguna columna del pago', !enBase.includes(DOC), enBase.slice(0, 200));
  chk('…expira_en = fechaExpiracionToken de DaviPlata (~5 min)', Math.abs(Date.parse(P.expira_en) - Date.now() - 5 * 60e3) < 20000, P.expira_en);
  chk('Laboratorio: devuelve el código de prueba (otpSec/read) para poder probar', r.j.otp_prueba === sesion[1].otp && davi.n.otp === 1 && r.j.ambiente === 'sandbox', r.j.otp_prueba);
  chk('Token en caché: la compra NO pidió otro token', davi.n.token === tokAntes, davi.n.token - tokAntes);

  // ----- Código equivocado -----
  const confirmar = (pago, otp, tok) => api('/confirmar', { negocio: NEG, pago, otp }, tok || dueno.token);
  r = await confirmar(P.id, '000000');
  chk('Código equivocado → sigue «pendiente», «Te quedan 2 intentos»', r.st === 200 && r.j.ok === false && r.j.error === 'daviplata_otp' && r.j.pago.estado === 'pendiente' &&
    r.j.intentos_restantes === 2 && /quedan 2/.test(r.j.mensaje) && r.j.pago.otp_intentos === 1, r.j);
  r = await confirmar(P.id, '12');
  chk('Código con formato inválido → 400 sin gastar intento ni llamar a DaviPlata', r.st === 400 && r.j.error === 'otp_invalido' && (await uno('select otp_intentos from pagos where id = $1', [P.id])).otp_intentos === 1, r.j);
  // ----- Código correcto -----
  const pushAntes = cel.recibidos.length, confAntes = davi.n.confirmar;
  r = await confirmar(P.id, sesion[1].otp);
  P = r.j.pago || {};
  chk('Código correcto → «Aprobado» = pago aprobado (verificado, confianza entidad)', r.st === 200 && r.j.ok === true && P.estado === 'aprobado' && P.verificado === true &&
    P.confianza === 'entidad' && /^\d{6}$/.test(r.j.aprobacion) && P.aprobacion === r.j.aprobacion, r.j);
  chk('…con N.º de aprobación y autorizador en el detalle', /N\.º de aprobación \d{6}/.test(P.detalle) && /autorizador 0{6}\d+/.test(P.detalle), P.detalle);
  chk('…confirmarCompra con idTransaccion ENTERO, idComercio e idTerminal de Redeban', davi.n.confirmar === confAntes + 1 && davi.transacciones.every(Number.isInteger));
  chk('Aviso push «💜 Llegó un pago» al celular (cifrado RFC 8291, una sola vez)', cel.recibidos.length === pushAntes + 1 && cel.recibidos.slice(-1)[0].msg &&
    /DaviPlata/.test(cel.recibidos.slice(-1)[0].msg.cuerpo) && /\$12\.000/.test(cel.recibidos.slice(-1)[0].msg.cuerpo) && /Mesa 3/.test(cel.recibidos.slice(-1)[0].msg.cuerpo) &&
    cel.recibidos.slice(-1)[0].cab['content-encoding'] === 'aes128gcm', cel.recibidos.slice(-1)[0]);
  r = await confirmar(P.id, sesion[1].otp);
  chk('Confirmar otra vez → devuelve el aprobado SIN volver a llamar a DaviPlata (idempotente) y sin otro push', r.st === 200 && r.j.ok === true && r.j.repetido === true &&
    r.j.pago.estado === 'aprobado' && davi.n.confirmar === confAntes + 1 && cel.recibidos.length === pushAntes + 1, r.j);
  const ap1 = await rpc('aplicar_pago', { p_pago: P.id, p_mesa: '3', p_dispositivo: dev.id }, cajero.token);
  const ap2 = await rpc('aplicar_pago', { p_pago: P.id, p_mesa: '3', p_dispositivo: null }, dueno.token);
  chk('Se registra en la cuenta UNA sola vez (aplicar_pago: el primero true, el segundo false)', ap1.j === true && ap2.j === false, [ap1, ap2]);
  r = await rpc('pagos_desde', { p_negocio: NEG, p_desde: null }, mesero.token);
  const visto = (r.j || []).find((x) => x.id === P.id) || {};
  chk('Los celulares lo ven por pagos_desde con aprobación y documento enmascarado', visto.estado === 'aprobado' && visto.aprobacion === P.aprobacion && visto.documento === 'CC •••8019', visto);

  // ----- Tres códigos equivocados → rechazado -----
  r = await cobrar({ monto: 5000, mesa: '4' });
  let P2 = r.j.pago;
  for (let i = 0; i < 3; i++) r = await confirmar(P2.id, '111111');
  chk('Tercer código equivocado → «rechazado» (máx. 3 intentos)', r.j.ok === false && r.j.pago.estado === 'rechazado' && /3 veces/.test(r.j.mensaje) && r.j.pago.otp_intentos === 3, r.j);
  const c4 = davi.n.confirmar;
  r = await confirmar(P2.id, davi.sesiones.get(P2.id_externo).otp);
  chk('…y después ni el código bueno lo aprueba (no se llama a DaviPlata)', r.j.ok === false && r.j.pago.estado === 'rechazado' && davi.n.confirmar === c4, r.j);
  chk('…queda en la auditoría', (await uno("select count(*)::int n from auditoria where negocio_id = $1 and accion = 'daviplata_rechazado'", [NEG])).n === 1);

  // ----- Dos celulares confirman a la vez -----
  r = await cobrar({ monto: 7000, mesa: '5' });
  const P3 = r.j.pago, otp3 = r.j.otp_prueba;
  davi.retraso = 300;
  const c5 = davi.n.confirmar, push5 = cel.recibidos.length;
  const [a, b] = await Promise.all([confirmar(P3.id, otp3, dueno.token), confirmar(P3.id, otp3, cajero.token)]);
  davi.retraso = 0;
  chk('Dos celulares confirman a la vez → DaviPlata se llama UNA vez y un solo aviso push', davi.n.confirmar === c5 + 1 && cel.recibidos.length === push5 + 1 &&
    [a, b].filter((x) => x.j.ok === true && !x.j.repetido).length === 1 && [a, b].some((x) => x.j.ocupado === true || x.j.repetido === true), [a.j, b.j]);
  chk('…y el pago queda aprobado', (await uno('select estado from pagos where id = $1', [P3.id])).estado === 'aprobado');

  // ----- Vencido -----
  r = await cobrar({ monto: 3000 });
  const P4 = r.j.pago;
  await sb.sql("update pagos set expira_en = now() - interval '5 minutes' where id = $1", [P4.id]);
  const c6 = davi.n.confirmar;
  r = await confirmar(P4.id, r.j.otp_prueba);
  chk('Código vencido → «vencido» sin llamar a DaviPlata', r.j.ok === false && r.j.pago.estado === 'vencido' && /venci/.test(r.j.mensaje) && davi.n.confirmar === c6, r.j);
  r = await cobrar({ monto: 3100 });
  const P5 = r.j.pago;
  davi.sesiones.delete(P5.id_externo);            // DaviPlata ya la olvidó: «Objeto No existe en la cache» (4001)
  r = await confirmar(P5.id, r.j.otp_prueba);
  chk('DaviPlata responde 4001 (sesión vencida) → «vencido» con mensaje en español', r.j.ok === false && r.j.error === 'daviplata_vencido' && r.j.pago.estado === 'vencido' && /venció/.test(r.j.mensaje), r.j);

  // ----- Token rechazado por el portal → se pide otro y se repite una vez -----
  davi.revocarUnaVez = true;
  const tk = davi.n.token;
  r = await cobrar({ monto: 2500 });
  chk('Token vencido/revocado (401 del portal) → pide otro token y repite UNA vez', r.st === 200 && r.j.pago.estado === 'pendiente' && davi.n.token === tk + 1, r.j);
  const P6 = r.j.pago, otp6 = r.j.otp_prueba;

  // =========================== Consecutivo idTransaccion ===========================
  const usados = davi.usados.get('ESB10934|' + bogota());
  chk('idTransaccion: 1, 2, 3… sin repetirse en la terminal hoy', usados && [...usados].sort((x, y) => x - y).every((v, i) => v === i + 1), usados && [...usados]);
  const sigue = async (t) => (await uno('select public.srv_daviplata_consecutivo($1, null, $2) n', [NEG, t || 'ESB10934'])).n;
  const ultimoDe = async () => (await uno("select ultimo from daviplata_consecutivos where terminal = 'ESB10934'")).ultimo;
  const antes = await ultimoDe();
  const lote = await Promise.all(Array.from({ length: 25 }, () => sigue()));
  chk('25 a la vez → 25 números distintos y seguidos (atómico)', new Set(lote).size === 25 && Math.min(...lote) === antes + 1 && Math.max(...lote) === antes + 25, lote);
  chk('Otra terminal lleva su propia cuenta (empieza en 1)', await sigue('TERM2') === 1 && await sigue('TERM2') === 2);
  const otroNeg = (await uno("select public.srv_daviplata_consecutivo($1, null, 'ESB10934') n", [NEG2])).n;
  chk('La MISMA terminal usada por otro negocio de Vento sigue la misma cuenta (no repite el número del día)', otroNeg === antes + 26, [otroNeg, antes + 26]);
  await sb.sql("update daviplata_consecutivos set dia = dia - 1 where terminal = 'ESB10934'");
  chk('Al cambiar el día (Bogotá) vuelve a empezar en 1', await sigue() === 1 && (await uno("select dia::text d from daviplata_consecutivos where terminal = 'ESB10934'")).d === bogota());
  await sb.sql("update daviplata_consecutivos set ultimo = 999999 where terminal = 'ESB10934'");
  let errAg = null; try { await sigue(); } catch (e) { errAg = e.message; }
  chk('Al pasar de 999999 → error claro y el contador no se mueve', /daviplata_consecutivo_agotado/.test(errAg || '') && (await ultimoDe()) === 999999, errAg);
  const c7 = davi.n.confirmar;
  r = await confirmar(P6.id, otp6);
  chk('…y /confirmar responde 409 «999.999 números… se renuevan a medianoche» sin llamar a DaviPlata; el pago sigue pendiente', r.st === 409 && r.j.error === 'daviplata_consecutivo_agotado' &&
    davi.n.confirmar === c7 && (await uno('select estado, confirmando_hasta from pagos where id = $1', [P6.id])).confirmando_hasta === null, r.j);
  // Para no chocar con los números que el simulador ya vio hoy, se sigue después del mayor usado.
  await sb.sql("update daviplata_consecutivos set ultimo = $1 where terminal = 'ESB10934'", [Math.max(...usados) + 100]);
  r = await confirmar(P6.id, otp6);
  chk('…al haber números otra vez, el mismo cobro se confirma', r.j.ok === true && r.j.pago.estado === 'aprobado', r.j);
  r = await rpc('srv_daviplata_consecutivo', { p_negocio: NEG, p_pago: null, p_terminal: 'X' }, dueno.token);
  const tabla = await fetch(sb.url + '/rest/v1/daviplata_consecutivos?select=*', { headers: cab(dueno.token) }).then((x) => x.json());
  chk('Con sesión de usuario no se puede pedir números ni leer la tabla (solo el servidor)', r.st === 403 && (!Array.isArray(tabla) || tabla.length === 0), [r.st, tabla]);

  // =========================== Dinero: confirmarCompra sin respuesta (incierto) ===========================
  // Transporte que corta la conexión de confirmarCompra: «antes» (nunca llegó a DaviPlata) o «despues» (DaviPlata aprobó
  // y la respuesta se perdió). Nunca se debe decir «venció»/«rechazado» si pudo haberse cobrado.
  let cortar = null;
  D.usarTransportePruebas(async (p) => {
    if (cortar && p.ruta === '/daviplata/v1/confirmarCompra') { const m = cortar; cortar = null; if (m === 'despues') await davi.simular(p); throw new Error('socket hang up'); }
    return davi.simular(p);
  });
  const estadoDe = async (id) => uno('select estado, incierto, confirmando_tx, confirmando_hasta, detalle, ultimo_error from pagos where id = $1', [id]);
  // (a) DaviPlata aprobó pero la respuesta no llegó
  r = await cobrar({ monto: 6100, mesa: '6' });
  const PI = r.j.pago, otpI = r.j.otp_prueba;
  let cI = davi.n.confirmar;
  cortar = 'despues';
  r = await confirmar(PI.id, otpI);
  let eI = await estadoDe(PI.id);
  chk('Se corta la red DESPUÉS de que DaviPlata aprobó → «sin respuesta»: NO dice vencido/rechazado, sigue pendiente e «incierto»', r.st === 200 && r.j.ok === false &&
    r.j.incierto === true && r.j.error === 'daviplata_sin_respuesta' && r.j.pago.estado === 'pendiente' && r.j.pago.incierto === true && /no se sabe si aprobó/.test(r.j.mensaje) &&
    davi.n.confirmar === cI + 1 && eI.incierto === true && eI.confirmando_tx === null && eI.confirmando_hasta === null && /transacción N\.º \d+/.test(eI.ultimo_error), { j: r.j, eI });
  r = await confirmar(PI.id, otpI);
  eI = await estadoDe(PI.id);
  chk('…al reintentar, DaviPlata dice 4001 (sesión ya usada) → queda «error · sin confirmar» (revisar con el cliente), NUNCA «vencido»', r.j.ok === false &&
    r.j.pago.estado === 'error' && r.j.pago.incierto === true && eI.estado === 'error' && /Sin confirmar/.test(eI.detalle) && /no le cobres|cobrarle otra vez/.test(r.j.mensaje) && davi.n.confirmar === cI + 2, { j: r.j, eI });
  chk('…queda en la auditoría como «daviplata_sin_respuesta» y «daviplata_sin_confirmar»',
    (await uno("select count(*)::int n from auditoria where negocio_id = $1 and accion in ('daviplata_sin_respuesta','daviplata_sin_confirmar') and detalle->>'pago' = $2", [NEG, PI.id])).n === 2);
  r = await confirmar(PI.id, otpI);
  chk('…y confirmarlo otra vez ya no llama a DaviPlata (muestra el aviso de revisar)', r.j.ok === false && davi.n.confirmar === cI + 2 && /Sin confirmar/.test(r.j.mensaje), r.j);
  // (b) La red se cortó ANTES de llegar a DaviPlata: reintentar con el mismo código lo aprueba
  r = await cobrar({ monto: 6200 });
  const PJ = r.j.pago, otpJ = r.j.otp_prueba;
  cortar = 'antes';
  r = await confirmar(PJ.id, otpJ);
  chk('Corte ANTES de llegar a DaviPlata → también «sin respuesta» (no se puede saber) y se puede reintentar', r.j.incierto === true && r.j.pago.estado === 'pendiente', r.j);
  r = await confirmar(PJ.id, otpJ);
  eI = await estadoDe(PJ.id);
  chk('…reintento con el MISMO código → aprobado (y se limpia «incierto»)', r.j.ok === true && r.j.pago.estado === 'aprobado' && eI.incierto === false && eI.confirmando_tx === null, { j: r.j, eI });
  // (c) Error interno de DaviPlata en confirmarCompra (2103 timeout del bus): incierto
  r = await cobrar({ monto: 6300 });
  const PK = r.j.pago, otpK = r.j.otp_prueba;
  davi.caido = true;
  r = await confirmar(PK.id, otpK);
  davi.caido = false;
  chk('confirmarCompra responde 500/2100 → «sin respuesta» (pudo haber aprobado), sigue pendiente', r.j.incierto === true && r.j.pago.estado === 'pendiente' && (await estadoDe(PK.id)).incierto === true, r.j);
  // …y si después el código vence, srv_pendientes NO lo marca «vencido» sino «error · sin confirmar»
  await sb.sql("update pagos set expira_en = now() - interval '30 minutes' where id = $1", [PK.id]);
  await sb.sql('select count(*) from public.srv_pendientes($1, 40)', [NEG]);
  eI = await estadoDe(PK.id);
  chk('…al vencerse queda «error · sin confirmar» (srv_pendientes), no «vencido»', eI.estado === 'error' && /Sin confirmar/.test(eI.detalle), eI);
  // (d) El servidor se cayó a mitad de confirmarCompra (quedó confirmando_tx sin resultado)
  r = await cobrar({ monto: 6400 });
  const PL = r.j.pago, otpL = r.j.otp_prueba;
  await sb.sql("update pagos set confirmando_tx = 4242, confirmando_hasta = now() + interval '1 minute' where id = $1", [PL.id]);
  r = await confirmar(PL.id, otpL);
  chk('Mientras otro celular está confirmando (turno vigente) → «ocupado», sin llamar a DaviPlata', r.j.ocupado === true, r.j);
  await sb.sql("update pagos set expira_en = now() - interval '30 minutes' where id = $1", [PL.id]);
  await sb.sql('select count(*) from public.srv_pendientes($1, 40)', [NEG]);
  chk('…y srv_pendientes no vence un cobro con la confirmación en curso', (await estadoDe(PL.id)).estado === 'pendiente');
  await sb.sql("update pagos set confirmando_hasta = now() - interval '1 second', expira_en = now() + interval '5 minutes' where id = $1", [PL.id]);
  davi.sesiones.get(PL.id_externo).usada = true;   // DaviPlata sí la aprobó en ese intento perdido
  r = await confirmar(PL.id, otpL);
  chk('Intento anterior sin resultado (el servidor se cayó) → el siguiente lo marca incierto y el 4001 deja «error · sin confirmar»', r.j.pago.estado === 'error' && r.j.pago.incierto === true, r.j);
  // (e) Falla el token (antes de mandar confirmarCompra): eso SÍ es seguro → error normal, no incierto
  r = await cobrar({ monto: 6500 });
  const PM0 = r.j.pago, otpM0 = r.j.otp_prueba;
  D.usarTransportePruebas(async (p) => p.ruta === RUTAS_TOKEN ? { status: 500, texto: JSON.stringify({ codigoError: '2100', mensajeError: 'Aplicación no disponible' }) } : davi.simular(p));
  cI = davi.n.confirmar;
  r = await confirmar(PM0.id, otpM0);
  eI = await estadoDe(PM0.id);
  chk('Si falla el token (confirmarCompra no salió) → error normal 502, sin «incierto», sigue pendiente y sin llamar a confirmarCompra', r.st === 502 && r.j.error === 'daviplata_no_disponible' &&
    eI.estado === 'pendiente' && eI.incierto === false && eI.confirmando_tx === null && davi.n.confirmar === cI, { j: r.j, eI });
  D.usarTransportePruebas(davi.simular);
  r = await confirmar(PM0.id, otpM0);
  chk('…y luego se confirma normal', r.j.ok === true, r.j);

  // =========================== Errores de DaviPlata en español ===========================
  r = await cobrar({ numero_documento: '1304130413' });
  let pe = await uno("select estado, ultimo_error from pagos where negocio_id = $1 and proveedor = 'daviplata' order by creado_en desc limit 1", [NEG]);
  chk('1304 «DAVIPLATA INVÁLIDO» → «Ese documento no tiene DaviPlata» y el cobro queda en error', r.st === 400 && r.j.error === 'daviplata_documento' && /no tiene DaviPlata/.test(r.j.mensaje) &&
    pe.estado === 'error' && /no tiene DaviPlata/.test(pe.ultimo_error), { j: r.j, pe });
  r = await cobrar({ numero_documento: '5555555555' });
  chk('«Saldo insuficiente» → «no tiene saldo suficiente»', r.st === 400 && r.j.error === 'daviplata_saldo' && /saldo suficiente/.test(r.j.mensaje), r.j);
  r = await cobrar({ numero_documento: '2100210021' });
  chk('2100 «Aplicación no disponible» → servicio no disponible (o el horario del laboratorio)', r.st === 502 && r.j.error === 'daviplata_no_disponible' &&
    /no está disponible|lunes a viernes de 8:00 a 17:00/.test(r.j.mensaje), r.j);
  r = await cobrar({ tipo_documento: 'PA' });
  chk('Tipo de documento que no existe → 400 sin llamar a DaviPlata', r.st === 400 && r.j.error === 'documento_tipo', r.j);
  r = await cobrar({ numero_documento: '123456789012345' });
  chk('Documento de más de 14 dígitos → 400', r.st === 400 && r.j.error === 'documento_invalido', r.j);
  const sab = new Date(Date.UTC(2026, 9, 10, 15, 0)), lun10 = new Date(Date.UTC(2026, 9, 12, 15, 0)), lun759 = new Date(Date.UTC(2026, 9, 12, 12, 59)), vie17 = new Date(Date.UTC(2026, 9, 9, 22, 0));
  chk('Horario del laboratorio (Bogotá): sábado, antes de 8:00 y desde las 17:00 → aviso de horario; lunes 10:00 → servicio caído',
    /lunes a viernes/.test(D.mensajeNoDisponible('sandbox', sab)) && /lunes a viernes/.test(D.mensajeNoDisponible('sandbox', lun759)) && /lunes a viernes/.test(D.mensajeNoDisponible('sandbox', vie17)) &&
    /no está disponible/.test(D.mensajeNoDisponible('sandbox', lun10)) && /no está disponible/.test(D.mensajeNoDisponible('produccion', sab)));
  const tr = (paso, status, cuerpo) => D.traducir(paso, { status, texto: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) }, 'sandbox', lun10);
  const casos = [
    [tr('token', 401, { httpCode: '401', httpMessage: 'Unauthorized', moreInformation: 'Application is not registered with mutual tls' }), 'daviplata_mtls', /certificado cargado/],
    [tr('compra', 401, { httpCode: '401', moreInformation: 'Invalid client certificate is provided' }), 'daviplata_certificado', /rechazó el certificado/],
    [tr('token', 400, { error: 'invalid_scope' }), 'daviplata_scope', /Pago con DaviPlata/],
    [tr('compra', 400, { codigoError: '321', mensajeError: 'PRODUCTO NO EXISTE' }), 'daviplata_documento', /no tiene DaviPlata/],
    [tr('confirmar', 401, { codigoError: '401', mensajeError: 'Autenticacion Denegada' }), 'daviplata_otp', /no es correcto/],
    [tr('confirmar', 500, { codigoError: '91', mensajeError: 'Entidad no responde/disponible' }), 'daviplata_no_disponible', /no está disponible/],
    [tr('compra', 422, { httpCode: '422', httpMessage: 'Invalid', moreInformation: "Validate REST: [JSV0002] Invalid object: the property 'tipoDocumento' is missing." }), 'daviplata_datos', /rechazó los datos/],
  ];
  chk('Traducción de errores: mTLS, certificado, scope, 321, OTP (401), 91, 422', casos.every(([e, c, re]) => e.codigo === c && re.test(e.message)), casos.map(([e]) => e.codigo + ': ' + e.message));

  // =========================== Roles ===========================
  r = await cobrar({ monto: 4000, mesa: '7' }, mesero.token);
  const PM = r.j.pago || {};
  chk('El mesero puede cobrar (pagos_puedo «cobrar» lo permite)', r.st === 200 && PM.estado === 'pendiente', r.j);
  r = await confirmar(PM.id, r.j.otp_prueba, mesero.token);
  chk('…y confirmar con el código', r.st === 200 && r.j.ok === true && r.j.pago.estado === 'aprobado', r.j);
  r = await api('/cobro', { negocio: NEG, proveedor: 'daviplata', canal: 'otp', monto: 4000, tipo_documento: '01', numero_documento: DOC }, ajeno.token);
  chk('Usuario de OTRO negocio no puede cobrar en este (403)', r.st === 403 && r.j.error === 'sin_permiso', r.j);
  r = await api('/confirmar', { negocio: NEG, pago: P6.id, otp: '123456' }, ajeno.token);
  const r2 = await api('/confirmar', { negocio: NEG2, pago: P6.id, otp: '123456' }, ajeno.token);
  chk('…ni confirmar cobros ajenos (403 en el negocio ajeno; 404 si lo intenta desde el suyo)', r.st === 403 && r2.st === 404 && r2.j.error === 'no_existe', [r.j, r2.j]);
  r = await api('/confirmar', { negocio: NEG, pago: P6.id, otp: '123456' });
  chk('Sin sesión → 401', r.st === 401 && r.j.error === 'sin_sesion', r.j);
  r = await api('/cobro', { negocio: NEG, proveedor: 'daviplata', canal: 'link', monto: 4000 }, dueno.token);
  chk('DaviPlata API solo cobra con código (canal «link» → 400)', r.st === 400 && r.j.error === 'canal_invalido', r.j);
  r = await rpc('crear_cobro', { p_negocio: NEG, p_proveedor: 'nequi', p_metodo: 'NEQUI', p_canal: 'otp', p_monto: 1000 }, dueno.token);
  chk('…y el canal «otp» solo existe con DaviPlata (también en la base)', r.st === 400 && /canal_invalido/.test(JSON.stringify(r.j)), r.j);

  // =========================== Producción: sin código de prueba ===========================
  r = await guardar({ ambiente: 'produccion', id_comercio: '9988776655', id_terminal: 'ESB10934' });
  chk('Producción: se verifica contra apis.daviplata.com', r.st === 200 && davi.urls.slice(-1)[0] === BASES.produccion + '/oauth2Provider/type1/v1/token' && !/laboratorio/.test(r.j.resumen.daviplata.detalle), davi.urls.slice(-1));
  CRED.id_comercio = '9988776655';
  const otpAntes = davi.n.otp;
  r = await cobrar({ monto: 8000 });
  chk('Producción: el cobro NO trae código de prueba ni llama a otpSec/read', r.st === 200 && r.j.otp_prueba === null && davi.n.otp === otpAntes && davi.urls.slice(-1)[0] === BASES.produccion + '/daviplata/v1/compra', r.j);
  const P7 = r.j.pago;
  r = await confirmar(P7.id, davi.sesiones.get(P7.id_externo).otp);
  chk('Producción: confirmar con el código que le llegó al cliente → aprobado', r.j.ok === true && r.j.pago.estado === 'aprobado', r.j);
  CRED.id_comercio = '0010203040';

  // =========================== Transporte real: directo sin mTLS, directo con Deno, puente ===========================
  D.usarTransportePruebas(null);
  r = await guardar({});
  chk('Modo directo sin Deno.createHttpClient → «mtls_no_disponible» que dice usar el puente', r.st === 400 && r.j.error === 'mtls_no_disponible' && /puente/.test(r.j.mensaje), r.j);
  fila = await uno("select estado, ambiente from pago_proveedores where negocio_id = $1 and proveedor = 'daviplata'", [NEG]);
  chk('…y ese cambio fallido NO reemplaza la conexión que funcionaba (sigue conectado en producción)', fila.estado === 'conectado' && fila.ambiente === 'produccion', fila);
  // DaviPlata simulado por HTTP (para el modo directo con un Deno.createHttpClient de mentiras)
  const srvDavi = http.createServer((req, res) => {
    const t = []; req.on('data', (c) => t.push(c)); req.on('end', async () => {
      const x = await davi.simular({ url: BASES.sandbox + req.url, headers: req.headers, body: Buffer.concat(t).toString() });
      res.writeHead(x.status, { 'content-type': 'application/json' }); res.end(x.texto);
    });
  });
  await new Promise((ok) => srvDavi.listen(0, '127.0.0.1', ok));
  sb.env.VENTO_DAVIPLATA_URL_SANDBOX = 'http://127.0.0.1:' + srvDavi.address().port;
  const llamadas = [];
  globalThis.Deno = { createHttpClient: (o) => { llamadas.push(Object.keys(o).sort().join()); if (!('certChain' in o)) throw new TypeError('Unknown option cert'); return { cerrar() {} }; } };
  r = await guardar({});
  chk('Modo directo: Deno.createHttpClient con certificado y llave (prueba los nombres nuevos y los viejos) → conectado', r.st === 200 && r.j.resumen.daviplata.estado === 'conectado' &&
    llamadas.join('|') === 'cert,key|certChain,privateKey', { j: r.j.mensaje || r.j.resumen, llamadas });
  globalThis.Deno = { createHttpClient: () => { throw new Error('invalid PEM'); } };
  D.usarTransportePruebas(null);   // vacía la caché de clientes TLS
  r = await guardar({});
  chk('…si crear el cliente TLS falla → «mtls_no_disponible» con el detalle', r.st === 400 && r.j.error === 'mtls_no_disponible' && /invalid PEM/.test(r.j.mensaje), r.j);
  delete globalThis.Deno;

  // Puente: el Worker de verdad (puente/daviplata-worker.js) con el enlace mTLS de Cloudflare simulado.
  const W = (await import(pathToFileURL(path.join(RAIZ, 'puente', 'daviplata-worker.js')).href)).default;
  const SECRETO_P = 'puente-secreto-de-prueba-123456';
  const vistoW = [];
  const envW = { VENTO_PUENTE_SECRETO: SECRETO_P, DAVIPLATA: { fetch: async (url, init) => {
    vistoW.push({ url, headers: init.headers });
    const x = await davi.simular({ url, headers: init.headers, body: init.body });
    return new Response(x.texto, { status: x.status, headers: { 'content-type': 'application/json' } });
  } } };
  const llegadas = [];
  const srvW = http.createServer((req, res) => {
    const t = []; req.on('data', (c) => t.push(c)); req.on('end', async () => {
      llegadas.push({ secreto: req.headers['x-vento-puente'] });
      const h = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && !/^(host|connection|content-length)$/i.test(k)) h.set(k, v);
      const out = await W.fetch(new Request('https://vento-daviplata.workers.dev/', { method: req.method, headers: h, body: req.method === 'POST' ? Buffer.concat(t) : undefined }), envW);
      const hh = {}; out.headers.forEach((v, k) => { hh[k] = v; });
      res.writeHead(out.status, hh); res.end(Buffer.from(await out.arrayBuffer()));
    });
  });
  await new Promise((ok) => srvW.listen(0, '127.0.0.1', ok));
  const URLW = 'http://127.0.0.1:' + srvW.address().port + '/';
  r = await guardar({ transporte: 'puente', puente_url: URLW, puente_secreto: SECRETO_P, cert: '', key: '' });
  chk('Puente en http://127.0.0.1 (red interna del servidor) → rechazado en producción (no se puede usar para SSRF)', r.st === 400 && r.j.error === 'daviplata_datos' && /sin IPs/.test(r.j.mensaje) && vistoW.length === 0, r.j);
  const malas = ['https://10.0.0.5/', 'https://169.254.169.254/latest', 'https://localhost:8443/', 'https://db.internal/', 'https://0x7f.1/', 'https://user:pw@vento.workers.dev/', 'https://[::1]/'];
  chk('Tampoco IPs, localhost, nombres internos ni usuario:clave en la URL del puente', malas.every((u) => !D.puenteValido(u)) && D.puenteValido('https://vento-daviplata.mi-cuenta.workers.dev/') &&
    !D.puenteValido('http://127.0.0.1:9/', {}) && D.puenteValido('http://127.0.0.1:9/', { VENTO_DAVIPLATA_PUENTE_LOCAL: '1' }), malas.filter((u) => D.puenteValido(u)));
  sb.env.VENTO_DAVIPLATA_PUENTE_LOCAL = '1';
  r = await guardar({ transporte: 'puente', puente_url: URLW, puente_secreto: 'otro-secreto-que-no-es-0000', cert: '', key: '' });
  chk('Puente con secreto equivocado → «El puente de DaviPlata rechazó el secreto»', r.st === 400 && r.j.error === 'daviplata_puente' && /secreto/.test(r.j.mensaje) && vistoW.length === 0, r.j);
  r = await guardar({ transporte: 'puente', puente_url: URLW, puente_secreto: SECRETO_P, cert: '', key: '' });
  chk('Modo puente: Vento manda al Worker con el secreto y el Worker reenvía a apislab por el enlace mTLS → conectado', r.st === 200 && r.j.resumen.daviplata.estado === 'conectado' &&
    llegadas.slice(-1)[0].secreto === SECRETO_P && vistoW.slice(-1)[0].url === BASES.sandbox + '/oauth2Provider/type1/v1/token', { j: r.j.mensaje || r.j.resumen, w: vistoW.slice(-1) });
  chk('…el Worker solo reenvía las cabeceras de la API (sin el secreto del puente)', Object.keys(vistoW.slice(-1)[0].headers).every((k) => ['authorization', 'x-ibm-client-id', 'content-type', 'accept'].includes(k)), vistoW.slice(-1)[0].headers);
  fila = await uno("select publico, secreto from pago_proveedores where negocio_id = $1 and proveedor = 'daviplata'", [NEG]);
  chk('…la URL del puente queda en lo público y el secreto del puente cifrado', fila.publico.transporte === 'puente' && fila.publico.puente_url === URLW && !fila.secreto.includes(SECRETO_P));
  // Cambiar la URL del puente dejando el Client Secret vacío NO manda el secreto guardado a la URL nueva.
  const espia = []; const srvEspia = http.createServer((req, res) => { const t = []; req.on('data', (c) => t.push(c)); req.on('end', () => { espia.push(Buffer.concat(t).toString()); res.writeHead(500); res.end('{}'); }); });
  await new Promise((ok) => srvEspia.listen(0, '127.0.0.1', ok));
  r = await guardar({ transporte: 'puente', puente_url: 'http://127.0.0.1:' + srvEspia.address().port + '/', client_secret: '', puente_secreto: '', cert: '', key: '' });
  chk('Cambiar la dirección del puente sin volver a escribir los secretos → 400 y el Client Secret guardado NO sale hacia la URL nueva', r.st === 400 && /vuelve a escribir/.test(r.j.mensaje) &&
    espia.length === 0 && !espia.join().includes(CRED.client_secret), { j: r.j, espia });
  srvEspia.close();
  fila = await uno("select estado, publico from pago_proveedores where negocio_id = $1 and proveedor = 'daviplata'", [NEG]);
  chk('…y la conexión por el puente bueno sigue igual', fila.estado === 'conectado' && fila.publico.puente_url === URLW, fila);
  r = await cobrar({ monto: 9000, mesa: '9' });
  const P8 = r.j.pago || {};
  chk('Cobro por el puente (compra + código de prueba)', r.st === 200 && P8.estado === 'pendiente' && /^\d{6}$/.test(r.j.otp_prueba || '') && vistoW.some((v) => v.url.endsWith('/daviplata/v1/compra')), r.j);
  r = await confirmar(P8.id, r.j.otp_prueba);
  chk('Confirmar por el puente → aprobado', r.j.ok === true && r.j.pago.estado === 'aprobado' && vistoW.slice(-1)[0].url === BASES.sandbox + '/daviplata/v1/confirmarCompra', r.j);
  const pw = (cuerpo, sec) => fetch(URLW, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vento-puente': sec || SECRETO_P }, body: JSON.stringify(cuerpo) }).then(async (x) => ({ st: x.status, e: x.headers.get('x-puente-error') }));
  const w1 = await pw({ ambiente: 'sandbox', ruta: '/admin/otra', headers: {}, cuerpo: '' });
  const w2 = await pw({ ambiente: 'produccion', ruta: '/otpSec/v1/read', headers: {}, cuerpo: '{}' });
  const w3 = await pw({ ambiente: 'sandbox', ruta: '/daviplata/v1/compra', headers: {}, cuerpo: '{}' }, 'x');
  chk('El Worker rechaza otras rutas, otpSec/read en producción y peticiones sin el secreto', w1.st === 404 && w1.e === 'ruta' && w2.st === 404 && w3.st === 401 && w3.e === 'secreto', [w1, w2, w3]);
  const w4 = await pw({ ambiente: 'sandbox', ruta: '/daviplata/v1/compra', headers: {}, cuerpo: 'x'.repeat(20000) });
  chk('…y pedidos de más de 16 KB (413)', w4.st === 413 && w4.e === 'pedido', w4);
  srvW.close(); srvDavi.close();
  D.usarTransportePruebas(davi.simular);

  // =========================== Desconectar ===========================
  r = await api('/config', { negocio: NEG, accion: 'desconectar', proveedor: 'daviplata' }, dueno.token);
  chk('Desconectar DaviPlata borra las credenciales', r.st === 200 && r.j.resumen.daviplata.estado === 'pendiente' &&
    !(await uno("select count(*)::int n from pago_proveedores where negocio_id = $1 and proveedor = 'daviplata'", [NEG])).n, r.j);
  r = await cobrar({});
  chk('…y ya no se puede cobrar por la API (proveedor_no_conectado)', r.st === 400 && r.j.error === 'proveedor_no_conectado', r.j);

  // =========================== Especificación, logs y migración ===========================
  chk('DaviPlata simulado: TODAS las peticiones cumplieron la especificación (cabeceras y cuerpos exactos)', davi.malos.length === 0, davi.malos);
  const todo = LOGS.join('\n');
  chk('Los registros del servidor no tienen secretos, certificados, tokens ni el documento completo', LOGS.length > 5 && !todo.includes(DOC) && !todo.includes(CRED.client_secret) &&
    !todo.includes('BEGIN') && !/tok-[0-9a-f]{12}/.test(todo) && !todo.includes(SECRETO_P), LOGS.filter((l) => l.includes(DOC) || l.includes('tok-')).slice(0, 3));
  let errMig = null;
  try { await sb.sql(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261008000000_daviplata_api.sql'), 'utf8')); } catch (e) { errMig = e.message; }
  chk('La migración se vuelve a correr sin errores (idempotente) y conserva los pagos', !errMig && (await uno("select count(*)::int n from pagos where proveedor = 'daviplata' and estado = 'aprobado'")).n >= 6, errMig);
  cel.server.close();
}

(async () => {
  let sb = null;
  try {
    sb = await iniciar({ env: {} });
    console.log('ℹ️ Base de prueba ' + sb.base + ' (' + sb.migraciones.length + ' archivos SQL aplicados)');
    await pruebas(sb);
  } catch (e) {
    mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e));
  } finally {
    if (sb) await sb.cerrar().catch(() => {});
  }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
