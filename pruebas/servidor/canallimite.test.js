// Pruebas del SERVIDOR: tope por conexión al publicar en los canales (migración 20261108000000_canal_limite_ip,
// Vento 1.56.0, auditoría ORDEVA R2), contra PostgreSQL REAL.
//  • Desde una misma conexión (IP): 300 mensajes por minuto; el 301 se rechaza («demasiados»).
//  • Otra conexión sigue publicando normal (una sola persona ya no frena a todos los negocios).
//  • De la IP solo queda una huella: la IP no se guarda.
//  • Sin IP (llamada interna) se publica como antes.
// Corre solo:   node pruebas/servidor/canallimite.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const pub = async (canal, ip) => {
    const h = { apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + sb.anonKey };
    if (ip) h['X-Forwarded-For'] = ip + ', 10.0.0.1';
    const r = await fetch(sb.url + '/rest/v1/rpc/canal_publicar', { method: 'POST', headers: h, body: JSON.stringify({ p_canal: canal, p_cuerpo: '{"t":"pedido"}' }) });
    return { st: r.status, j: await r.json().catch(() => null) };
  };
  let r, rechazados = 0, buenos = 0;
  for (let i = 0; i < 300; i++) { r = await pub('vitoatac' + (i % 5) + 'xx', '203.0.113.9'); if (r.st === 200) buenos++; else rechazados++; }
  chk('300 mensajes desde una misma conexión (en 5 canales distintos) pasan', buenos === 300 && rechazados === 0, { buenos, rechazados, r });
  r = await pub('vitoatacotroxx', '203.0.113.9');
  chk('El 301 desde esa conexión se rechaza («demasiados»), aunque sea otro canal', r.st >= 400 && /demasiados/.test(JSON.stringify(r.j)), r);
  r = await pub('vitonegociobueno1', '198.51.100.7');
  chk('Otra conexión (otro negocio) sigue publicando normal', r.st === 200, r);
  const filas = await sb.sql("select origen_h from canal_mensajes where canal = 'vitonegociobueno1'");
  chk('De la IP solo queda una huella (no la IP)', filas.length === 1 && /^[0-9a-f]{24}$/.test(filas[0].origen_h) && !JSON.stringify(filas).includes('198.51'), filas);
  r = await pub('vitosinip001');
  chk('Sin IP (llamada interna) se publica como antes', r.st === 200, r);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
