// Pruebas del SERVIDOR: límites de uso de Laya (IA) compartidos y persistentes (migración 20261109000000_ia_cupo,
// Vento 1.57.0, auditoría ORDEVA R7), contra PostgreSQL REAL.
//  • Tope por minuto y por día; lo rechazado no gasta cupo.
//  • 30 peticiones A LA VEZ con tope 20: exactamente 20 pasan (atómico: el conteo es el mismo en todas las instancias).
//  • Solo el servidor lo usa: ni anon ni una cuenta pueden llamarlo.
//  • El proxy de IA de cada negocio (vento-pagos /ia) usa este límite: con el tope del día lleno responde 429.
// Corre solo:   node pruebas/servidor/iacupo.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const cupo = async (k, m, d) => (await sb.sql('select public.srv_ia_cupo($1, $2, $3) r', [k, m, d]))[0].r;
  let r, buenos = 0;
  for (let i = 0; i < 40; i++) if ((await cupo('prueba:min', 40, 0)).ok) buenos++;
  r = await cupo('prueba:min', 40, 0);
  chk('Tope por minuto: 40 pasan y la 41 se rechaza («minuto»)', buenos === 40 && r.ok === false && r.tope === 'minuto', r);
  const n = (await sb.sql("select n from ia_uso where clave = 'prueba:min' and tipo = 'min'"))[0].n;
  chk('Lo rechazado no gasta cupo (quedan 40 contadas, no 41)', n === 40, n);
  for (let i = 0; i < 5; i++) await cupo('prueba:dia', 0, 5);
  r = await cupo('prueba:dia', 0, 5);
  chk('Tope del día: 5 pasan y la 6 se rechaza («dia»)', r.ok === false && r.tope === 'dia', r);
  const res = await Promise.all(Array.from({ length: 30 }, () => cupo('prueba:juntas', 20, 0)));
  chk('30 peticiones a la vez con tope 20: exactamente 20 pasan (conteo atómico)', res.filter((x) => x.ok).length === 20, res.filter((x) => x.ok).length);
  // Solo el servidor
  const intento = async (tok) => { const x = await fetch(sb.url + '/rest/v1/rpc/srv_ia_cupo', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + (tok || sb.anonKey), 'Content-Type': 'application/json' }, body: JSON.stringify({ p_clave: 'x', p_max_min: 0, p_max_dia: 0 }) }); return x.status; };
  const dueno = await sb.usuario('dueno@ia-cupo.co');
  chk('Ni anon ni una cuenta pueden usarlo (solo el servidor)', (await intento()) >= 400 && (await intento(dueno.token)) >= 400);
  // El proxy de IA del negocio usa este límite
  const rpc = async (fn, args, tok) => { const x = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); return x.json(); };
  const NEG = await rpc('crear_negocio', { p_nombre: 'Bar IA', p_datos: {} }, dueno.token);
  await sb.sql("insert into ia_uso(clave, tipo, ventana, n) values ($1, 'dia', date_trunc('day', now()), 3000)", ['ia:' + NEG]);
  const p = await fetch(sb.url + '/functions/v1/vento-pagos/ia/' + NEG + '/v1beta/models/gemini-2.5-flash:generateContent', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + dueno.token, 'Content-Type': 'application/json' }, body: '{"contents":[]}' });
  const pj = await p.json().catch(() => ({}));
  chk('El proxy de IA del negocio con el cupo del día lleno responde 429 «límite de hoy»', p.status === 429 && /límite de hoy/.test(JSON.stringify(pj)), { st: p.status, pj });
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
