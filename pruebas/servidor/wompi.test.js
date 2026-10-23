// Pruebas del SERVIDOR de pagos con Wompi (vento-pagos + wompi.ts), de punta a punta contra PostgreSQL REAL y un Wompi
// simulado (VENTO_WOMPI_API_SANDBOX) que responde como la API oficial (docs.wompi.co): comercio, transacciones y eventos.
// (ORDEVA etapa 5: Wompi y Nequi Conecta ya estaban en el código, pero sin pruebas de punta a punta.)
//  1. Conectar: llaves con mal formato o mezcladas (test/prod) no se guardan; llave privada rechazada por Wompi tampoco;
//     las buenas quedan «conectado», con la dirección de eventos, y cifradas (ninguna llave secreta en claro en la base).
//  2. Cobro por link: la firma de integridad es la de Wompi (SHA256 de referencia + centavos + COP + vence + secreto).
//  3. Eventos: firma mala → 401 y el pago sigue pendiente; dirección desconocida → 404 sin guardar nada; evento bueno →
//     pago aprobado con quien pagó; el mismo evento otra vez → «duplicado»; valor distinto al cobrado → error, NO aprobado;
//     evento de producción para un comercio de pruebas → ignorado.
//  4. Sin evento: el repaso consulta a Wompi y aprueba el pago (por si el evento nunca llega).
//  5. Los registros del servidor no tienen llaves ni secretos.
// Corre solo:   node pruebas/servidor/wompi.test.js
'use strict';
const http = require('http');
const crypto = require('crypto');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
const LOGS = [];
for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) { LOGS.push(a[0]); if (process.env.VENTO_LOGS) o(...a); return; } o(...a); }; }
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const CRED = { llave_publica: 'pub_test_ordevaPrueba01', llave_privada: 'prv_test_ordevaSecreta99', secreto_eventos: 'test_events_ordevaEv77', secreto_integridad: 'test_integrity_ordevaIn55' };

// ---------- Wompi simulado ----------
function crearWompi() {
  const txs = [];   // transacciones que «existen» en Wompi
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), auth = req.headers.authorization || '';
    const enviar = (st, j) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (u.pathname === '/merchants/' + CRED.llave_publica) return enviar(200, { data: { id: 4242, name: 'Bar Wompi SAS', accepted_payment_methods: ['NEQUI', 'CARD', 'PSE'] } });
    if (u.pathname.startsWith('/merchants/')) return enviar(404, { error: { type: 'NOT_FOUND_ERROR' } });
    if (u.pathname === '/transactions') {
      if (auth !== 'Bearer ' + CRED.llave_privada) return enviar(401, { error: { type: 'INVALID_ACCESS_TOKEN' } });
      return enviar(200, { data: txs.filter((t) => t.reference === u.searchParams.get('reference')) });
    }
    enviar(404, {});
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, txs, url: 'http://127.0.0.1:' + server.address().port })));
}
function evento(tx, { secreto = CRED.secreto_eventos, ambiente = 'test', timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const checksum = sha(String(tx.id) + tx.status + String(tx.amount_in_cents) + String(timestamp) + secreto);
  return { event: 'transaction.updated', data: { transaction: tx }, environment: ambiente, signature: { properties: props, checksum }, timestamp, sent_at: new Date().toISOString() };
}

async function pruebas(sb, wompi) {
  const F = sb.url + '/functions/v1/vento-pagos';
  const cab = (tok, extra) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extra || {}) });
  const api = async (ruta, cuerpo, tok, extra) => { const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok, extra), body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok || sb.anonKey), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const pago = (id) => uno('select estado, monto, pagador, ultimo_error, confianza from pagos where id = $1', [id]);

  const dueno = await sb.usuario('dueno@wompi.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Wompi', p_datos: {} }, dueno.token)).j;
  const mesero = await sb.usuario('mesero@wompi.co');
  await rpc('unirse_con_codigo', { p_codigo: (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'mesero' }, dueno.token)).j, p_nombre: 'Mesero' }, mesero.token);

  // ---------- 1. Conectar ----------
  let r = await api('/config', { negocio: NEG, accion: 'guardar_wompi', ...CRED, llave_privada: 'cualquier-cosa' }, dueno.token);
  chk('1. Llave con mal formato: no se guarda («formato de Wompi»)', r.st === 400 && /formato de Wompi/.test(JSON.stringify(r.j)), r);
  r = await api('/config', { negocio: NEG, accion: 'guardar_wompi', ...CRED, llave_privada: 'prv_prod_ordevaSecreta99' }, dueno.token);
  chk('1. Llaves de pruebas y de producción mezcladas: no se guardan', r.st === 400 && /Mezclaste/.test(JSON.stringify(r.j)), r);
  r = await api('/config', { negocio: NEG, accion: 'guardar_wompi', ...CRED, llave_privada: 'prv_test_otraQueNoEs' }, dueno.token);
  chk('1. Llave privada que Wompi rechaza: no se guarda', r.st === 400 && /llave privada/.test(JSON.stringify(r.j)), r);
  r = await api('/config', { negocio: NEG, accion: 'guardar_wompi', ...CRED }, mesero.token);
  chk('1. Un mesero no conecta Wompi', r.st >= 400, r);
  r = await api('/config', { negocio: NEG, accion: 'guardar_wompi', ...CRED }, dueno.token);
  const w = r.j && (r.j.proveedores || []).find((p) => p.proveedor === 'wompi');
  chk('1. Llaves buenas: «conectado», verificado con el comercio y con la dirección de eventos', r.st === 200 && w && w.estado === 'conectado' && /Bar Wompi SAS/.test(w.detalle || '') && /\/webhook\/wompi\/[\w-]{16,}$/.test(r.j.webhook_wompi || ''), r);
  const WEBHOOK = r.j.webhook_wompi.replace(/^.*\/functions\/v1\/vento-pagos/, '');
  const base = JSON.stringify(await sb.sql('select * from pago_proveedores where negocio_id = $1', [NEG]));
  chk('1. En la base las llaves secretas están cifradas (ninguna en claro)', !base.includes(CRED.llave_privada) && !base.includes(CRED.secreto_eventos) && !base.includes(CRED.secreto_integridad), base.slice(0, 300));

  // ---------- 2. Cobro por link ----------
  r = await api('/cobro', { negocio: NEG, canal: 'link', monto: 20000, mesa: '5' }, mesero.token);
  const p1 = r.j && r.j.pago;
  const link = p1 && p1.url ? new URL(p1.url) : null;
  const q = link ? link.searchParams : new URLSearchParams();
  const firma = sha(q.get('reference') + q.get('amount-in-cents') + 'COP' + (q.get('expiration-time') || '') + CRED.secreto_integridad);
  chk('2. El mesero crea el cobro por link: pendiente, a Wompi, con la llave pública y 2.000.000 centavos', r.st === 200 && p1.estado === 'pendiente' && link.origin + link.pathname === 'https://checkout.wompi.co/p/' && q.get('public-key') === CRED.llave_publica && q.get('amount-in-cents') === '2000000' && q.get('reference') === p1.referencia, r);
  chk('2. La firma de integridad es la de Wompi', q.get('signature:integrity') === firma, { link: p1 && p1.url });
  chk('2. El link no lleva ninguna llave secreta', !String(p1 && p1.url).includes('prv_') && !String(p1 && p1.url).includes('integrity_'));

  // ---------- 3. Eventos ----------
  const tx1 = { id: '15113-1700000000-11111', reference: p1.referencia, status: 'APPROVED', amount_in_cents: 2000000, payment_method_type: 'NEQUI', customer_data: { full_name: 'ANA GOMEZ' }, status_message: null, created_at: new Date().toISOString() };
  r = await api(WEBHOOK, evento(tx1, { secreto: 'test_events_inventado' }));
  chk('3. Evento con firma mala: 401 y el pago sigue pendiente', r.st === 401 && (await pago(p1.id)).estado === 'pendiente', r);
  const antes = Number((await uno('select count(*) n from pago_eventos')).n);
  r = await api('/webhook/wompi/tokenQueNoExiste1234567890', evento(tx1));
  chk('3. Evento a una dirección desconocida: 404 y no se guarda nada', r.st === 404 && Number((await uno('select count(*) n from pago_eventos')).n) === antes, r);
  const ev1 = evento(tx1);
  r = await api(WEBHOOK, ev1, null, { 'X-Event-Checksum': ev1.signature.checksum });
  let x = await pago(p1.id);
  chk('3. Evento bueno: el pago queda aprobado, con quien pagó', r.st === 200 && x.estado === 'aprobado' && /ana gomez/i.test(x.pagador || ''), { r, x });
  r = await api(WEBHOOK, ev1);
  chk('3. El mismo evento otra vez: «duplicado» (no se aplica dos veces)', r.st === 200 && r.j.duplicado === true, r);

  const p2 = (await api('/cobro', { negocio: NEG, canal: 'link', monto: 15000, mesa: '2' }, mesero.token)).j.pago;
  r = await api(WEBHOOK, evento({ id: '15113-2', reference: p2.referencia, status: 'APPROVED', amount_in_cents: 1000000, payment_method_type: 'NEQUI' }));
  x = await pago(p2.id);
  chk('3. Pagaron un valor distinto al cobrado ($10.000 de $15.000): NO queda aprobado', x.estado !== 'aprobado' && /no coincide/.test(x.ultimo_error || ''), { r, x });

  const p3 = (await api('/cobro', { negocio: NEG, canal: 'link', monto: 8000 }, mesero.token)).j.pago;
  r = await api(WEBHOOK, evento({ id: '15113-3', reference: p3.referencia, status: 'APPROVED', amount_in_cents: 800000, payment_method_type: 'NEQUI' }, { ambiente: 'prod' }));
  chk('3. Evento de producción para un comercio de pruebas: ignorado', r.st === 200 && r.j.ignorado === 'ambiente_distinto' && (await pago(p3.id)).estado === 'pendiente', r);
  r = await api(WEBHOOK, evento({ id: '15113-4', reference: p3.referencia, status: 'DECLINED', amount_in_cents: 800000, payment_method_type: 'NEQUI' }));
  chk('3. Pago rechazado en Wompi: queda rechazado', r.st === 200 && (await pago(p3.id)).estado === 'rechazado', r);

  // ---------- 4. El evento nunca llega: el repaso le pregunta a Wompi ----------
  const p4 = (await api('/cobro', { negocio: NEG, canal: 'link', monto: 12000, mesa: '7' }, mesero.token)).j.pago;
  wompi.txs.push({ id: '15113-5', reference: p4.referencia, status: 'APPROVED', amount_in_cents: 1200000, payment_method_type: 'NEQUI', customer_data: { full_name: 'LUIS PEREZ' }, created_at: new Date().toISOString() });
  await sb.sql("update pagos set proximo_intento = now() - interval '1 second' where id = $1", [p4.id]);   // ya le toca el repaso
  r = await api('/sync', {}, null, { 'x-vento-cron': sb.cron });
  x = await pago(p4.id);
  chk('4. Sin evento, el repaso consulta a Wompi y aprueba el pago', r.st === 200 && x.estado === 'aprobado' && /luis perez/i.test(x.pagador || ''), { r, x });

  // ---------- 5. Registros ----------
  const todo = LOGS.join('\n');
  chk('5. Los registros del servidor no tienen llaves ni secretos de Wompi', !todo.includes(CRED.llave_privada) && !todo.includes(CRED.secreto_eventos) && !todo.includes(CRED.secreto_integridad), LOGS.filter((l) => /prv_|events_|integrity_/.test(l)).slice(0, 3));
}

(async () => {
  let sb = null, wompi = null;
  try { wompi = await crearWompi(); sb = await iniciar({ env: { VENTO_WOMPI_API_SANDBOX: wompi.url } }); await pruebas(sb, wompi); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); if (wompi) wompi.server.close(); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
