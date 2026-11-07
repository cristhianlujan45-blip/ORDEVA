// Pruebas del SERVIDOR: 🏨 tarifas por temporada y fin de semana (migración 20261129000000_tarifas_temporada, ORDEVA 1.87.0),
// contra PostgreSQL REAL.
//  • Sin reglas: igual que antes (precio × noches).
//  • Fin de semana (+20 % las noches de viernes y sábado), temporada (+30 %), temporada que cruza el año, temporada baja (−20 %).
//  • Lo que muestra el agente (reservas_disponibles → total) es lo mismo que queda en la reserva (reserva_publica_crear → valor).
//  • Las funciones de la tarifa no se llaman desde afuera.
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const dueno = await sb.usuario('dueno@tarifas.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Hotel Tarifas', p_datos: {} }, dueno.token)).j;
  // Fechas en UTC (como las convierte el servidor a «date»).
  const dia = (d, h) => { const x = new Date(); x.setUTCHours(0, 0, 0, 0); x.setUTCDate(x.getUTCDate() + d); x.setUTCHours(h); return x; };
  const iso = x => x.toISOString();
  const md = x => String(x.getUTCMonth() + 1).padStart(2, '0') + '-' + String(x.getUTCDate()).padStart(2, '0');
  // Lo mismo que el servidor, para saber cuánto debe dar.
  const noche = (precio, x, pt, finde) => { const pf = finde && [5, 6].includes(x.getUTCDay()) ? finde : 0; return Math.max(0, Math.round(precio * (1 + Math.max(-90, Math.min(300, pt + pf)) / 100) / 100) * 100); };
  const esperado = (precio, d0, n, ptDe, finde) => { let s = 0; for (let i = 0; i < n; i++) { const x = new Date(d0.getTime() + i * 864e5); s += noche(precio, x, ptDe(x), finde); } return s; };
  const recursos = [{ id: '1', nombre: 'Habitación 101', capacidad: 2, precio: 100000 }, { id: '2', nombre: 'Habitación 102', capacidad: 4, precio: 150000 }];
  const config = async reglas => (await rpc('reservas_config_guardar', { p_negocio: NEG, p_activo: true, p_tipo: 'habitacion', p_nombre: 'Hotel Tarifas', p_recursos: recursos, p_reglas: Object.assign({ entrada: '15:00', salida: '12:00' }, reglas) }, dueno.token)).j;
  const PUB = (await config({})).publico;
  const total = async (d, n, per) => { const r = await rpc('reservas_disponibles', { p_publico: PUB, p_desde: iso(dia(d, 15)), p_hasta: iso(dia(d + n, 12)), p_personas: per || 2 }); return r.j && r.j[0]; };

  // ---------- Sin reglas ----------
  let x = await total(10, 3);
  chk('Sin reglas: 3 noches de la 101 = 3 × $100.000 (igual que antes)', x && Number(x.total) === 300000 && Number(x.precio) === 100000, x);

  // ---------- Fin de semana ----------
  await config({ finde: { pct: 20 } });
  x = await total(10, 7);
  const e7 = esperado(100000, dia(10, 0), 7, () => 0, 20);
  chk('Fin de semana +20 %: una semana (2 noches de viernes y sábado a $120.000) = ' + e7, x && Number(x.total) === e7 && e7 === 5 * 100000 + 2 * 120000, x);

  // ---------- Temporada + fin de semana ----------
  const t0 = dia(12, 0), t1 = dia(13, 0);
  await config({ finde: { pct: 20 }, temporadas: [{ n: 'Puente', desde: md(t0), hasta: md(t1), pct: 30 }] });
  x = await total(10, 7);
  const e7b = esperado(100000, dia(10, 0), 7, d => (d.getTime() >= t0.getTime() && d.getTime() <= t1.getTime()) ? 30 : 0, 20);
  chk('Temporada «Puente» +30 % dos noches, y el fin de semana encima: ' + e7b, x && Number(x.total) === e7b && e7b > e7, x);

  // ---------- Temporada que cruza el año y temporada baja (directo en la base de datos) ----------
  const s = await sb.sql("select public.srv_tarifa_noche($1::jsonb, 100000, '2026-12-31') a, public.srv_tarifa_noche($1::jsonb, 100000, '2027-01-05') b, public.srv_tarifa_noche($1::jsonb, 100000, '2027-01-20') c, public.srv_tarifa_noche($1::jsonb, 100000, '2027-03-10') d",
    [JSON.stringify({ temporadas: [{ n: 'Fin de año', desde: '12-20', hasta: '01-10', pct: 50 }, { n: 'Baja', desde: '03-01', hasta: '03-31', pct: -20 }] })]);
  chk('Temporada que cruza el año (20 dic – 10 ene, +50 %): 31 dic y 5 ene a $150.000; 20 ene a $100.000', Number(s[0].a) === 150000 && Number(s[0].b) === 150000 && Number(s[0].c) === 100000, s[0]);
  chk('Temporada baja −20 %: el 10 de marzo a $80.000', Number(s[0].d) === 80000, s[0]);
  const s2 = await sb.sql("select public.srv_tarifa_noche($1::jsonb, 100000, '2026-12-25') a", [JSON.stringify({ temporadas: [{ desde: 'x', hasta: '01-10', pct: 50 }, { desde: '12-01', hasta: '12-31', pct: 'mucho' }], finde: { pct: 'z' } })]);
  chk('Reglas mal escritas no rompen nada: se ignoran (queda el precio normal)', Number(s2[0].a) === 100000, s2[0]);

  // ---------- Lo que se muestra = lo que queda en la reserva ----------
  x = await total(10, 7);
  const r = await rpc('reserva_publica_crear', { p_publico: PUB, p_recurso: '1', p_desde: iso(dia(10, 15)), p_hasta: iso(dia(17, 12)), p_cliente: 'Laura Ríos', p_telefono: '3005551234', p_personas: 2, p_nota: null });
  chk('Al reservar en línea, la reserva queda con el mismo total que mostró el agente', r.j && r.j.ok && Number(r.j.reserva.valor) === Number(x.total), { r: r.j, x });
  const y = await total(10, 7);
  chk('… y la 101 ya no se ofrece en esas fechas (queda la 102, con su total)', y && y.id === '2' && Number(y.total) === esperado(150000, dia(10, 0), 7, d => (d.getTime() >= t0.getTime() && d.getTime() <= t1.getTime()) ? 30 : 0, 20), y);

  // ---------- Desde afuera ----------
  const z = await rpc('srv_tarifa_total', { p_reglas: {}, p_precio: 1, p_desde: '2027-01-01', p_hasta: '2027-01-02' });
  chk('La función de la tarifa no se puede llamar desde afuera', z.st >= 400, z);
}

(async () => {
  let sb;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
