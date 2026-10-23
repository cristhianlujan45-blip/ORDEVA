// Pruebas del SERVIDOR: los repasos automáticos dentro de Supabase (migración 20261102000000_repasos_supabase, 1.53.1),
// contra PostgreSQL REAL. Este PostgreSQL no trae pg_cron ni pg_net: se imitan con su misma firma (cron.schedule y
// net.http_post) y las llamadas que «haría» pg_net se hacen de verdad contra las Edge Functions de prueba.
//  • Sin pg_cron la migración no falla (así corre también en la revisión del despliegue).
//  • Un repaso autorizado deja la dirección y el secreto; uno con clave inventada no.
//  • Con pg_cron se programan los dos trabajos cada 5 minutos y vento_repaso() dispara /sync y /vencer con el secreto.
//  • Ningún cliente puede leer el secreto ni llamar las funciones.
// Corre solo:   node pruebas/servidor/repasos.test.js
'use strict';
const fs = require('fs'), path = require('path');
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }
const MIG = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261102000000_repasos_supabase.sql'), 'utf8');

async function pruebas(sb) {
  const cab = (tok, extra) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extra || {}) });
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const repaso = (clave) => fetch(sb.url + '/functions/v1/vento-pagos/sync', { method: 'POST', headers: cab(null, { 'x-vento-cron': clave }), body: '{}' });

  const n = await uno("select count(*) n from pg_extension where extname in ('pg_cron','pg_net')");
  const s0 = await (await fetch(sb.url + '/functions/v1/vento-pagos/salud')).json();
  chk('/salud sin pg_cron: lo dice', s0.ok && s0.repasos && s0.repasos.pg_cron === false, s0.repasos);
  chk('Sin pg_cron ni pg_net la migración se aplicó igual (no rompe la revisión del despliegue)', Number(n.n) === 0);
  let r = await uno('select public.vento_repaso() r');
  chk('Sin configuración, vento_repaso() no hace nada y lo dice', r.r.ok === false && r.r.motivo === 'sin_config', r.r);

  await repaso('adivinando');
  chk('Un repaso con clave inventada NO deja configuración', !(await uno("select 1 x from servidor_config where clave = 'repaso'")));
  const rr = await repaso(sb.cron);
  chk('El repaso autorizado responde', rr.status === 200, rr.status);
  const c = await uno("select valor from servidor_config where clave = 'repaso'");
  chk('… y deja la dirección del servidor y el secreto del repaso', c && c.valor.url === sb.url.replace(/\/$/, '') && c.valor.secreto === sb.cron, c);

  // ---------- Imitación de pg_cron y pg_net (misma firma que en Supabase) ----------
  await sb.sql(`create schema if not exists cron;
    create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean not null default true);
    create table if not exists cron.job_run_details (runid bigserial primary key, jobid bigint, status text, end_time timestamptz);
    create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
      insert into cron.job(jobname, schedule, command) values (job_name, schedule, command) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
    create schema if not exists net;
    create table if not exists net.pedidos (id bigserial primary key, url text, body jsonb, params jsonb, headers jsonb, tiempo int);
    create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{"Content-Type":"application/json"}', timeout_milliseconds integer default 5000)
      returns bigint language sql as $$ insert into net.pedidos(url, body, params, headers, tiempo) values (url, body, params, headers, timeout_milliseconds) returning id $$;`);
  let err = null;
  try { await sb.sql(MIG); } catch (e) { err = e.message; }
  chk('Con pg_cron la migración se vuelve a correr sin errores', !err, err);
  const jobs = await sb.sql('select jobname, schedule, command from cron.job order by jobname');
  chk('Programa la proyección cada 5 minutos (sin salir de la base)', jobs.some((j) => j.jobname === 'vento-proyeccion' && j.schedule === '*/5 * * * *' && /proyectar_pendientes/.test(j.command)), jobs);
  chk('Programa el repaso de cobros, DIAN y suscripciones cada 5 minutos', jobs.some((j) => j.jobname === 'vento-repaso' && j.schedule === '*/5 * * * *' && j.command === 'select public.vento_repaso()'), jobs);
  try { await sb.sql(MIG); } catch (e) { err = e.message; }
  chk('Limpia cada día la bitácora de pg_cron (guarda una semana)', jobs.some((j) => j.jobname === 'vento-limpiar-cron' && /job_run_details/.test(j.command) && /7 days/.test(j.command)), jobs);
  chk('Correrla otra vez no duplica los trabajos', !err && Number((await uno('select count(*) n from cron.job')).n) === 3, err);

  await sb.sql("insert into cron.job_run_details(jobid, status, end_time) select jobid, 'succeeded', now() from cron.job where jobname = 'vento-repaso'");
  const sal = await (await fetch(sb.url + '/functions/v1/vento-pagos/salud')).json();
  chk('/salud dice si los repasos están programados (sin comandos ni secretos)', sal.repasos && sal.repasos.pg_cron === true && sal.repasos.config === true && sal.repasos.trabajos['vento-repaso'] && sal.repasos.trabajos['vento-repaso'].cada === '*/5 * * * *' && sal.repasos.trabajos['vento-repaso'].ultimo.estado === 'succeeded' && !JSON.stringify(sal).includes(sb.cron), sal.repasos);
  r = await uno('select public.vento_repaso() r');
  const ped = await sb.sql('select url, headers, tiempo from net.pedidos order by id');
  chk('vento_repaso() pide /vento-pagos/sync y /vento-suscripciones/vencer', r.r.ok && ped.length === 2 && ped[0].url === sb.url + '/functions/v1/vento-pagos/sync' && ped[1].url === sb.url + '/functions/v1/vento-suscripciones/vencer', [r.r, ped]);
  chk('… con el secreto del repaso en la cabecera y tiempo de sobra', ped.every((p) => p.headers['x-vento-cron'] === sb.cron && p.tiempo >= 30000), ped);
  // Lo que haría pg_net, de verdad:
  const res = [];
  for (const p of ped) { const x = await fetch(p.url, { method: 'POST', headers: p.headers, body: '{}' }); res.push({ st: x.status, j: await x.json().catch(() => ({})) }); }
  chk('Esos pedidos funcionan de verdad: el repaso de cobros responde (con la proyección)', res[0].st === 200 && res[0].j.ok && res[0].j.proyeccion, res[0]);
  chk('… y el de suscripciones también', res[1].st === 200 && res[1].j.ok === true, res[1]);
  const pj = await uno('select public.proyectar_pendientes(50, 20) r');
  chk('El trabajo de la proyección corre tal cual está programado', pj.r && typeof pj.r.proyectados === 'number', pj.r);

  // ---------- Nadie de afuera ----------
  const u = await sb.usuario('dueno@repaso.co');
  r = await rpc('vento_repaso', {}, u.token);
  const r2 = await rpc('srv_repaso_config', { p_url: 'https://malo.example', p_secreto: 'x'.repeat(20) }, u.token);
  chk('Un cliente no puede disparar el repaso ni cambiar a dónde va', r.st >= 400 && r2.st >= 400, [r, r2]);
  const t = await fetch(sb.url + '/rest/v1/servidor_config?clave=eq.repaso', { headers: cab(u.token) });
  const tj = await t.json().catch(() => null);
  chk('Ni con sesión se puede leer el secreto del repaso', t.status >= 400 || (Array.isArray(tj) && !tj.length), [t.status, tj]);
  r = await uno("select public.srv_repaso_config('ftp://raro', 'corto') r");
  chk('Una dirección o un secreto raros no se guardan', r.r === false && (await uno("select valor from servidor_config where clave = 'repaso'")).valor.url === sb.url.replace(/\/$/, ''));
}

(async () => {
  let sb = null;
  try { sb = await iniciar(); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
