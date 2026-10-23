// Pruebas del SERVIDOR de pagos con Nequi Conecta (vento-pagos + nequi.ts), de punta a punta contra PostgreSQL REAL y un
// Nequi simulado (VENTO_NEQUI_AUTH_SANDBOX / VENTO_NEQUI_API_SANDBOX) que responde como la API oficial
// (conecta.nequi.com.co): token OAuth2, cobro push, QR y estado. (ORDEVA etapa 5.)
//  1. Conectar: faltan datos, Client Secret malo o API Key mala → no queda conectado; las buenas sí, y cifradas.
//  2. Cobro push: celular malo no sale; uno bueno manda a Nequi el cuerpo EXACTO (canal, comercio, valor, referencia,
//     API Key y token) y queda pendiente con el número de la transacción. Si Nequi lo rechaza, queda en error con el porqué.
//  3. Cobro con QR: queda pendiente con el código QR.
//  4. El repaso pregunta el estado: «pendiente» sigue pendiente; «35» (pagado) con el mismo valor → aprobado con quien
//     pagó; pagado con OTRO valor → NO queda aprobado.
//  5. Los registros del servidor no tienen el Client Secret ni la API Key.
// Corre solo:   node pruebas/servidor/nequiconecta.test.js
'use strict';
const http = require('http');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
const LOGS = [];
for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) { LOGS.push(a[0]); if (process.env.VENTO_LOGS) o(...a); return; } o(...a); }; }

const CRED = { client_id: 'ordeva-client-01', client_secret: 'ordevaSecretoNequi77', api_key: 'ordevaApiKeyNequi55' };
const CODIGO = 'NIT_900123456';

// ---------- Nequi simulado ----------
function crearNequi() {
  const s = { llamadas: [], estados: {}, rechazarPush: false, n: 0 };
  const resp = (st, desc, any) => ({ ResponseMessage: { ResponseHeader: { Status: { StatusCode: st, StatusDesc: desc } }, ResponseBody: { any } } });
  const server = http.createServer((req, res) => {
    const t = []; req.on('data', (c) => t.push(c)); req.on('end', () => {
      const u = new URL(req.url, 'http://x'), cuerpo = Buffer.concat(t).toString();
      const enviar = (st, j) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
      if (u.pathname === '/oauth2/token') {
        const ok = req.headers.authorization === 'Basic ' + Buffer.from(CRED.client_id + ':' + CRED.client_secret).toString('base64') && u.searchParams.get('grant_type') === 'client_credentials';
        return ok ? enviar(200, { access_token: 'tok-nequi-1', token_type: 'Bearer', expires_in: 3600 }) : enviar(401, { error: 'invalid_client' });
      }
      if (req.headers.authorization !== 'Bearer tok-nequi-1') return enviar(401, {});
      if (req.headers['x-api-key'] !== CRED.api_key) return enviar(403, { message: 'Forbidden' });
      let j = {}; try { j = JSON.parse(cuerpo); } catch (e) {}
      const any = (j.RequestMessage && j.RequestMessage.RequestBody && j.RequestMessage.RequestBody.any) || {};
      s.llamadas.push({ ruta: u.pathname, cab: j.RequestMessage && j.RequestMessage.RequestHeader, any });
      if (u.pathname.endsWith('-unregisteredpayment')) {
        if (s.rechazarPush) return enviar(200, resp('20-07A', 'El usuario no existe en Nequi', {}));
        return enviar(200, resp('0', 'SUCCESS', { unregisteredPaymentRS: { transactionId: ' 350-' + (++s.n) + '-ABC ' } }));
      }
      if (u.pathname.endsWith('-generatecodeqr')) return enviar(200, resp('0', 'SUCCESS', { generateCodeQRRS: { codeQR: 'bancadigital-QR-' + (++s.n) } }));
      if (u.pathname.endsWith('-getstatuspayment')) {
        const e = s.estados[any.getStatusPaymentRQ && any.getStatusPaymentRQ.codeQR];
        if (!e) return enviar(200, resp('10-454', 'Transacción no encontrada', {}));
        return enviar(200, resp('0', 'SUCCESS', { getStatusPaymentRS: e }));
      }
      enviar(404, {});
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, s, url: 'http://127.0.0.1:' + server.address().port })));
}

async function pruebas(sb, nequi) {
  const F = sb.url + '/functions/v1/vento-pagos';
  const cab = (tok, extra) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extra || {}) });
  const api = async (ruta, cuerpo, tok, extra) => { const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok, extra), body: JSON.stringify(cuerpo) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok || sb.anonKey), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const pago = (id) => uno('select estado, monto, pagador, ultimo_error, id_externo, qr, detalle from pagos where id = $1', [id]);
  const repaso = async (ids) => { await sb.sql("update pagos set proximo_intento = now() - interval '1 second' where id = any($1::uuid[])", [ids]); return api('/sync', {}, null, { 'x-vento-cron': sb.cron }); };

  const dueno = await sb.usuario('dueno@nequi.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Nequi', p_datos: {} }, dueno.token)).j;
  const cajero = await sb.usuario('caja@nequi.co');
  await rpc('unirse_con_codigo', { p_codigo: (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'cajero' }, dueno.token)).j, p_nombre: 'Caja' }, cajero.token);
  const conectar = (extra) => api('/config', { negocio: NEG, accion: 'guardar_nequi', ambiente: 'sandbox', codigo: CODIGO, ...CRED, ...(extra || {}) }, dueno.token);

  // ---------- 1. Conectar ----------
  let r = await conectar({ api_key: '' });
  chk('1. Faltan datos: no se guarda', r.st === 400 && /Faltan/.test(JSON.stringify(r.j)), r);
  r = await conectar({ codigo: '' });
  chk('1. Sin el código de comercio: no se guarda', r.st === 400 && /código de comercio/.test(JSON.stringify(r.j)), r);
  r = await conectar({ client_secret: 'otroSecreto' });
  chk('1. Client Secret malo: Nequi lo rechaza y no queda conectado', r.st === 400 && /Client ID o el Client Secret/.test(JSON.stringify(r.j)), r);
  r = await conectar({ api_key: 'otraApiKey' });
  chk('1. API Key mala: Nequi la rechaza y no queda conectado', r.st === 400 && /API Key/.test(JSON.stringify(r.j)), r);
  r = await conectar();
  const nq = r.j && (r.j.proveedores || []).find((p) => p.proveedor === 'nequi');
  chk('1. Datos buenos: «conectado» (verificado con Nequi Conecta)', r.st === 200 && nq && nq.estado === 'conectado', r);
  const base = JSON.stringify(await sb.sql('select * from pago_proveedores where negocio_id = $1', [NEG]));
  chk('1. En la base el Client Secret y la API Key están cifrados', !base.includes(CRED.client_secret) && !base.includes(CRED.api_key), base.slice(0, 300));

  // ---------- 2. Cobro push ----------
  r = await api('/cobro', { negocio: NEG, canal: 'push', monto: 25000, mesa: '4', telefono: '12345' }, cajero.token);
  chk('2. Celular Nequi mal escrito: no sale el cobro', r.st === 400 && /10 dígitos/.test(JSON.stringify(r.j)), r);
  nequi.s.llamadas.length = 0;
  r = await api('/cobro', { negocio: NEG, canal: 'push', monto: 25000, mesa: '4', telefono: '300 123 4567' }, cajero.token);
  const p1 = r.j && r.j.pago, ll = nequi.s.llamadas.find((x) => /unregisteredpayment$/.test(x.ruta));
  const rq = ll && ll.any.unregisteredPaymentRQ;
  chk('2. Cobro push: a Nequi le llega el cuerpo exacto (canal PNP04-C001, celular, comercio, valor, referencia, mesa)',
    !!rq && ll.cab.Channel === 'PNP04-C001' && ll.cab.ClientID === CRED.client_id && rq.phoneNumber === '3001234567' && rq.code === CODIGO && rq.value === '25000' && rq.reference1 === p1.referencia && rq.reference2 === 'Mesa 4', { ll, p1 });
  chk('2. … y queda pendiente con el número de la transacción', r.st === 200 && p1.estado === 'pendiente' && (await pago(p1.id)).id_externo === '350-1-ABC', { r, x: await pago(p1.id) });
  nequi.s.rechazarPush = true;
  r = await api('/cobro', { negocio: NEG, canal: 'push', monto: 9000, telefono: '3109998877' }, cajero.token);
  const err = await uno("select estado, detalle, ultimo_error from pagos where negocio_id = $1 and monto = 9000", [NEG]);
  chk('2. Si Nequi rechaza el cobro: se dice por qué y el pago queda en error', r.st === 400 && /no existe en Nequi/.test(JSON.stringify(r.j)) && err && err.estado === 'error', { r, err });
  nequi.s.rechazarPush = false;

  // ---------- 3. QR ----------
  r = await api('/cobro', { negocio: NEG, canal: 'qr', monto: 18000, mesa: '9' }, cajero.token);
  const p2 = r.j && r.j.pago;
  chk('3. Cobro con QR: pendiente con el código QR de Nequi', r.st === 200 && p2.estado === 'pendiente' && /^bancadigital-QR-/.test(p2.qr || (await pago(p2.id)).qr || ''), r);
  r = await api('/cobro', { negocio: NEG, canal: 'push', monto: 30000, telefono: '3204445566' }, cajero.token);
  const p3 = r.j.pago, idp3 = (await pago(p3.id)).id_externo;

  // ---------- 4. Estado ----------
  r = await repaso([p1.id, p2.id, p3.id]);
  chk('4. Sin pago todavía: siguen pendientes', r.st === 200 && (await pago(p1.id)).estado === 'pendiente' && (await pago(p2.id)).estado === 'pendiente', r);
  nequi.s.estados['350-1-ABC'] = { status: '35', value: '25000', name: 'ANA GOMEZ', trnId: 'T-1' };
  nequi.s.estados[(await pago(p2.id)).qr] = { status: '33', value: '18000' };
  nequi.s.estados[idp3] = { status: '35', value: '3000', name: 'PEDRO' };
  r = await repaso([p1.id, p2.id, p3.id]);
  let x = await pago(p1.id);
  chk('4. Nequi dice «35» (pagado) con el mismo valor: aprobado, con quien pagó', x.estado === 'aprobado' && /ana gomez/i.test(x.pagador || ''), { r, x });
  chk('4. Nequi dice que el QR sigue pendiente: sigue pendiente', (await pago(p2.id)).estado === 'pendiente');
  x = await pago(p3.id);
  chk('4. Pagado con OTRO valor ($3.000 de $30.000): NO queda aprobado', x.estado !== 'aprobado' && /no coincide/.test(x.ultimo_error || ''), x);

  // ---------- 5. Registros ----------
  const todo = LOGS.join('\n');
  chk('5. Los registros del servidor no tienen el Client Secret ni la API Key', !todo.includes(CRED.client_secret) && !todo.includes(CRED.api_key));
}

(async () => {
  let sb = null, nequi = null;
  try {
    nequi = await crearNequi();
    sb = await iniciar({ env: { VENTO_NEQUI_AUTH_SANDBOX: nequi.url + '/oauth2/token', VENTO_NEQUI_API_SANDBOX: nequi.url } });
    await pruebas(sb, nequi);
  } catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); if (nequi) nequi.server.close(); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
