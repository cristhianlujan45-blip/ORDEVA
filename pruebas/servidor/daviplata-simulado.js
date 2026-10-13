// DaviPlata SIMULADO para las pruebas (servidor y navegador): responde como la API «Pago con DaviPlata» (API 37) y revisa
// que cada petición cumpla la especificación al pie de la letra (cabeceras y cuerpos exactos). Se conecta al servidor con
// el punto de inyección del transporte: daviplata.ts → usarTransportePruebas(davi.simular).
// Documentos especiales: 1304130413 → 1304 «DAVIPLATA INVÁLIDO» · 5555555555 → «Saldo insuficiente» · 2100210021 → 2100.
'use strict';
const crypto = require('crypto');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CRED = { client_id: 'cid-vento-lab-7f3a', client_secret: 'SECRETO-daviplata-NO-SE-VE-91x', id_comercio: '0010203040', id_terminal: 'ESB10934' };
const BASES = { sandbox: 'https://apislab.daviplata.com', produccion: 'https://apis.daviplata.com' };
const DOC = '1134568019';           // CC de laboratorio
const bogota = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

function crearDavi() {
  const d = { n: { token: 0, compra: 0, otp: 0, confirmar: 0 }, malos: [], urls: [], tokens: new Set(), sesiones: new Map(), usados: new Map(),
    transacciones: [], revocarUnaVez: false, retraso: 0, caido: false, ultimaOtp: new Map(), secret: CRED.client_secret };
  const resp = (status, j) => ({ status, texto: typeof j === 'string' ? j : JSON.stringify(j) });
  const malo = (m) => { d.malos.push(m); };
  d.simular = async (p) => {
    const h = {}; for (const [k, v] of Object.entries(p.headers || {})) h[k.toLowerCase()] = String(v);
    d.urls.push(p.url);
    const base = Object.values(BASES).find((b) => p.url.startsWith(b + '/'));
    if (!base) { malo('URL fuera de DaviPlata: ' + p.url); return resp(404, {}); }
    const ruta = p.url.slice(base.length);
    if (d.retraso) await esperar(d.retraso);
    if (d.caido) return resp(500, { codigoError: '2100', mensajeError: 'Aplicación no disponible' });
    if (ruta === '/oauth2Provider/type1/v1/token') {
      d.n.token++;
      if (h['content-type'] !== 'application/x-www-form-urlencoded') malo('token: Content-Type ' + h['content-type']);
      if (h.authorization) malo('token: no lleva Authorization');
      const esperado = 'grant_type=client_credentials&client_id=' + encodeURIComponent(CRED.client_id) + '&client_secret=' + encodeURIComponent(d.secret) + '&scope=daviplata';
      if (p.body !== esperado) {
        const q = new URLSearchParams(p.body);
        if (q.get('client_secret') !== d.secret && q.get('scope') === 'daviplata' && q.get('grant_type') === 'client_credentials') return resp(400, { error: 'invalid_client' });
        malo('token: cuerpo ' + p.body.replace(/client_secret=[^&]*/, 'client_secret=***'));
        return resp(400, { error: 'unknown' });
      }
      const t = 'tok-' + crypto.randomBytes(6).toString('hex');
      d.tokens.add(t);
      return resp(200, { token_type: 'Bearer', access_token: t, expires_in: 900, scope: 'daviplata' });
    }
    if (ruta === '/otpSec/v1/read') {
      d.n.otp++;
      if (base !== BASES.sandbox) malo('otpSec/read en producción');
      if (h['x-ibm-client-id'] !== CRED.client_id) malo('otp: x-ibm-client-id');
      if (h.authorization) malo('otp: no lleva Authorization');
      const b = JSON.parse(p.body);
      if (Object.keys(b).sort().join() !== 'notificationType,numberDocument,typeDocument' || b.notificationType !== 'API_DAVIPLATA') malo('otp: cuerpo ' + p.body);
      const o = d.ultimaOtp.get(b.typeDocument + ':' + b.numberDocument);
      return o ? resp(200, { otp: o }) : resp(200, { errorCode: '0', errorMessage: '' });
    }
    // compra y confirmarCompra: Bearer + x-ibm-client-id + JSON
    const tok = (h.authorization || '').replace(/^Bearer /, '');
    if (!/^Bearer tok-/.test(h.authorization || '')) malo(ruta + ': Authorization ' + h.authorization);
    if (h['x-ibm-client-id'] !== CRED.client_id) malo(ruta + ': x-ibm-client-id ' + h['x-ibm-client-id']);
    if (h['content-type'] !== 'application/json') malo(ruta + ': Content-Type ' + h['content-type']);
    if (d.revocarUnaVez) { d.revocarUnaVez = false; d.tokens.delete(tok); }
    if (!d.tokens.has(tok)) return resp(401, { httpCode: '401', httpMessage: 'Unauthorized', moreInformation: 'This server could not verify that you are authorized to access the URL' });
    let b; try { b = JSON.parse(p.body); } catch (e) { malo(ruta + ': JSON'); return resp(422, {}); }
    if (ruta === '/daviplata/v1/compra') {
      d.n.compra++;
      if (Object.keys(b).sort().join() !== 'numeroIdentificacion,tipoDocumento,valor') malo('compra: campos ' + Object.keys(b));
      if (typeof b.valor !== 'string' || !/^\d+$/.test(b.valor)) malo('compra: valor debe ser TEXTO de dígitos: ' + JSON.stringify(b.valor));
      if (typeof b.numeroIdentificacion !== 'string' || !/^\d{1,14}$/.test(b.numeroIdentificacion)) malo('compra: numeroIdentificacion ' + b.numeroIdentificacion);
      if (!['01', '02', '04'].includes(b.tipoDocumento)) malo('compra: tipoDocumento ' + b.tipoDocumento);
      if (b.numeroIdentificacion === '1304130413') return resp(400, { codigoError: '1304', mensajeError: 'DAVIPLATA INVÁLIDO' });
      if (b.numeroIdentificacion === '5555555555') return resp(500, { codigoError: '500', mensajeError: 'Saldo insuficiente' });
      if (b.numeroIdentificacion === '2100210021') return resp(500, { codigoError: '2100', mensajeError: 'Aplicación no disponible' });
      const id = String(10000000 + crypto.randomInt(89999999));
      const otp = String(100000 + crypto.randomInt(899999));
      const vence = new Date(Date.now() + 5 * 60e3 - 5 * 3600e3).toISOString().replace('Z', '-05:00');
      d.sesiones.set(id, { otp, valor: b.valor, doc: b.numeroIdentificacion, tipo: b.tipoDocumento, usada: false });
      d.ultimaOtp.set(b.tipoDocumento + ':' + b.numeroIdentificacion, otp);
      return resp(200, { idSessionToken: id, fechaExpiracionToken: vence });
    }
    if (ruta === '/daviplata/v1/confirmarCompra') {
      d.n.confirmar++;
      if (Object.keys(b).sort().join() !== 'idComercio,idSessionToken,idTerminal,idTransaccion,otp') malo('confirmar: campos ' + Object.keys(b));
      if (typeof b.idTransaccion !== 'number' || !Number.isInteger(b.idTransaccion) || b.idTransaccion < 1 || b.idTransaccion > 999999) malo('confirmar: idTransaccion debe ser ENTERO 1..999999: ' + JSON.stringify(b.idTransaccion));
      if (typeof b.otp !== 'string' || typeof b.idSessionToken !== 'string') malo('confirmar: otp/idSessionToken deben ser texto');
      if (b.idComercio !== CRED.id_comercio || b.idTerminal !== CRED.id_terminal) malo('confirmar: comercio/terminal ' + b.idComercio + '/' + b.idTerminal);
      const k = b.idTerminal + '|' + bogota();
      if (!d.usados.has(k)) d.usados.set(k, new Set());
      if (d.usados.get(k).has(b.idTransaccion)) { malo('confirmar: idTransaccion REPETIDO ' + b.idTransaccion); return resp(500, { codigoError: '3200', mensajeError: 'Transacción repetida' }); }
      d.usados.get(k).add(b.idTransaccion); d.transacciones.push(b.idTransaccion);
      const s = d.sesiones.get(b.idSessionToken);
      if (!s || s.usada) return resp(400, { codigoError: '4001', mensajeError: 'Objeto No existe en la cache.' });
      if (s.otp !== b.otp) return resp(401, { codigoError: '401', mensajeError: 'Autenticacion Denegada' });
      s.usada = true;
      return resp(200, { fechaTransaccion: new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 19), estado: 'Aprobado', numAprobacion: String(100000 + crypto.randomInt(899999)), idTransaccionAutorizador: String(b.idTransaccion).padStart(12, '0') });
    }
    malo('ruta desconocida ' + ruta);
    return resp(404, {});
  };
  return d;
}

module.exports = { crearDavi, CRED, BASES, DOC, bogota };
