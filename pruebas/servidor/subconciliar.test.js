// Pruebas del SERVIDOR: conciliación de suscripciones (migración 20261123000001_sub_conciliar, ORDEVA 1.69.0), contra
// PostgreSQL REAL. Un pago aprobado nunca pierde su tiempo:
//  • Plan activo pero con menos días que el pago aprobado (un «Dar plan» más corto encima) → se alarga hasta el pago.
//  • Plan vencido con un pago aprobado que todavía cubre → vuelve a activo con el plan de ese pago.
//  • Plan cancelado o rechazado por una persona → no se toca.
//  • Pago aprobado ya vencido, o plan que ya cubre el pago → no se toca.
//  • Queda constancia en payment_events («payment_reconciled»). Correrla dos veces no cambia nada más.
//  • Solo el servidor la puede correr (no un usuario con sesión).
// Corre solo:   node pruebas/servidor/subconciliar.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const dia = 864e5, en = d => new Date(Date.now() + d * dia).toISOString();

  // Una cuenta = un negocio: cada negocio con su dueño.
  let dueno = null;
  const negocio = async (nombre) => { const u = await sb.usuario('dueno-' + nombre.toLowerCase().replace(/\W+/g, '') + '@conciliar.co'); dueno = dueno || u; return (await rpc('crear_negocio', { p_nombre: nombre, p_datos: {} }, u.token)).j; };
  const A = await negocio('Corto'), B = await negocio('Vencido'), C = await negocio('Cancelado'), D = await negocio('Al día'), E = await negocio('Pago viejo');
  const pago = (neg, desde, hasta, plan, ref) => sb.sql("insert into payment_records(business_id, plan_id, method, amount, status, period_start, period_end, approved_at, reference) values ($1, $2, 'NEQUI', 59900, 'approved', $3, $4, now(), $5) returning id", [neg, plan || 'pro', desde, hasta, ref]);
  const sus = (neg, status, hasta, plan, source) => sb.sql("insert into subscriptions(business_id, plan_id, status, source, start_date, expiry_date) values ($1, $2, $3, $4, now() - interval '20 days', $5) on conflict (business_id) do update set plan_id = excluded.plan_id, status = excluded.status, source = excluded.source, expiry_date = excluded.expiry_date", [neg, plan || 'pro', status, source || 'manual', hasta]);

  await pago(A, en(-10), en(20), 'pro', 'ref-a'); await sus(A, 'active', en(5), 'pro', 'admin');        // «Dar plan» de 5 días encima de un pago de 30
  await pago(B, en(-5), en(25), 'pro', 'ref-b'); await sus(B, 'expired', en(-1), 'free', 'trial');        // venció la prueba, pero el pago cubre
  await pago(C, en(-5), en(25), 'pro', 'ref-c'); await sus(C, 'canceled', en(-1), 'pro');                 // cancelado a propósito
  await pago(D, en(-5), en(25), 'pro', 'ref-d'); await sus(D, 'active', en(40), 'pro');                  // ya cubre de sobra
  await pago(E, en(-40), en(-10), 'pro', 'ref-e'); await sus(E, 'expired', en(-10), 'pro');               // el pago ya se venció

  const r = (await uno('select public.srv_sub_conciliar(null) r')).r;
  const s = async (n) => uno('select status, plan_id, expiry_date from subscriptions where business_id = $1', [n]);
  const cerca = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60e3;
  chk('Concilia 2 negocios (el del plan recortado y el vencido)', r && r.arreglados === 2, r);
  let x = await s(A);
  chk('Plan activo recortado: se alarga hasta el final del pago aprobado (20 días), conserva el plan', x.status === 'active' && cerca(x.expiry_date, en(20)) && x.plan_id === 'pro', x);
  x = await s(B);
  chk('Plan vencido con pago que cubre: vuelve a activo con el plan del pago (PRO) hasta el final del pago', x.status === 'active' && x.plan_id === 'pro' && cerca(x.expiry_date, en(25)), x);
  x = await s(C);
  chk('Plan cancelado por una persona: no se toca', x.status === 'canceled', x);
  x = await s(D);
  chk('Plan que ya cubre el pago: no se toca', x.status === 'active' && cerca(x.expiry_date, en(40)), x);
  x = await s(E);
  chk('Pago aprobado que ya se venció: no revive el plan', x.status === 'expired', x);
  const ev = await uno("select count(*)::int n from payment_events where type = 'payment_reconciled' and business_id in ($1, $2)", [A, B]);
  chk('Queda la constancia «payment_reconciled» en los eventos', ev.n === 2, ev);
  const r2 = (await uno('select public.srv_sub_conciliar(null) r')).r;
  chk('Correrla otra vez no cambia nada más', r2.arreglados === 0, r2);
  const rU = await rpc('srv_sub_conciliar', { p_negocio: null }, dueno.token);
  chk('Un usuario con sesión NO la puede correr (solo el servidor)', rU.st >= 400, rU);
  const solo = (await uno('select public.srv_sub_conciliar($1) r', [C])).r;
  chk('Por un solo negocio también funciona (y respeta el cancelado)', solo.arreglados === 0, solo);

  let err = null;
  try { await sb.sql(fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261123000001_sub_conciliar.sql'), 'utf8')); } catch (e) { err = e.message; }
  chk('La migración se vuelve a correr sin errores', !err, err);
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
