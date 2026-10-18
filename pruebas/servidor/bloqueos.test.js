// Pruebas del SERVIDOR: bloquear un negocio o un usuario desde Vento Admin (migración 20261028000000_bloqueos)
// contra PostgreSQL REAL y la Edge Function vento-suscripciones.
//  • Bloquear el NEGOCIO → /estado responde «bloqueado» (sin token) para todos sus miembros; desbloquear → normal.
//  • Bloquear la CUENTA de un usuario → /estado responde «bloqueado: usuario» y avisa a sus negocios.
//  • Solo el servidor puede bloquear (las funciones no las puede llamar un cliente).
// Corre solo:   node pruebas/servidor/bloqueos.test.js
'use strict';
const { iniciar } = require('./supabase-local');
let ok = 0, mal = 0;
const chk = (n, c, x) => { if (c) { ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
if (!process.env.VENTO_LOGS) for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }

async function pruebas(sb) {
  const F = sb.url + '/functions/v1/vento-suscripciones';
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  const api = async (ruta, cuerpo, tok) => { const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
  const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  const tabla = async (q, tok) => { const r = await fetch(sb.url + '/rest/v1/' + q, { headers: cab(tok) }); return { st: r.status, j: await r.json().catch(() => null) }; };
  
  const jefe = await sb.usuario('jefe@vento.co');
  const dueno = await sb.usuario('dueno@bar.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Bloqueos', p_datos: {} }, dueno.token)).j;
  const cajero = await sb.usuario('caja@bar.co');
  const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: 'cajero' }, dueno.token)).j;
  await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: 'Caja' }, cajero.token);
  const otro = await sb.usuario('otro@bar2.co');
  const NEG2 = (await rpc('crear_negocio', { p_nombre: 'Otro Bar', p_datos: {} }, otro.token)).j;

  // ---------- Estado normal ----------
  let r = await api('/estado', { negocio: NEG }, cajero.token);
  chk('Estado normal: con token firmado y sin «bloqueado»', r.st === 200 && r.j.ok && r.j.token && !r.j.bloqueado, r.j);

  r = await rpc('srv_negocio_bloquear', { p_negocio: NEG, p_bloquear: true, p_motivo: 'x', p_admin: dueno.id }, dueno.token);
  chk('Un cliente NO puede bloquear negocios por su cuenta (solo el servidor)', r.st >= 400, r);
  r = await rpc('srv_bloqueo_de', { p_negocio: NEG, p_usuario: dueno.id }, dueno.token);
  chk('Un cliente NO puede llamar las funciones internas del bloqueo', r.st >= 400, r);

  // ---------- Bloquear el negocio ----------
  r = await api('/admin/negocio_bloquear', { negocio: NEG, bloquear: true, motivo: 'Pago pendiente' }, jefe.token);
  chk('Vento Admin bloquea el negocio (con motivo)', r.st === 200 && r.j.ok && r.j.negocio.bloqueado_en && r.j.negocio.bloqueo_motivo === 'Pago pendiente', r.j);
  r = await api('/estado', { negocio: NEG }, cajero.token);
  chk('/estado del cajero: «bloqueado» (negocio, con el motivo) y SIN token', r.st === 200 && r.j.bloqueado && r.j.bloqueado.tipo === 'negocio' && r.j.bloqueado.motivo === 'Pago pendiente' && !r.j.token, r.j);
  r = await api('/estado', { negocio: NEG }, dueno.token);
  chk('/estado del dueño: también bloqueado', r.j.bloqueado && r.j.bloqueado.tipo === 'negocio' && !r.j.token, r.j);
  r = await api('/estado', { negocio: NEG2 }, otro.token);
  chk('Otro negocio sigue normal', r.j.ok && r.j.token && !r.j.bloqueado, r.j);
  r = await api('/admin/negocios', {}, jefe.token);
  const fila = (r.j.negocios || []).find((x) => x.id === NEG);
  chk('Vento Admin ve el negocio como bloqueado en la lista', fila && fila.bloqueado_en && fila.bloqueo_motivo === 'Pago pendiente', fila);
  r = await api('/admin/negocio', { negocio: NEG }, jefe.token);
  chk('… y en el detalle', r.j.negocio && r.j.negocio.bloqueado_en, r.j.negocio);
  r = await api('/admin/negocio_bloquear', { negocio: NEG, bloquear: true }, dueno.token);
  chk('Un cliente no puede usar la acción de administrador', r.st === 403, r);
  r = await api('/admin/negocio_bloquear', { negocio: NEG, bloquear: false }, jefe.token);
  r = await api('/estado', { negocio: NEG }, cajero.token);
  chk('Desbloquear → vuelve a funcionar (con token)', r.j.ok && r.j.token && !r.j.bloqueado, r.j);
  const aud = await sb.sql("select accion from auditoria where negocio_id = $1 and accion like 'negocio_%' order by id", [NEG]).catch(() => []);
  chk('Queda en la auditoría (bloqueado y desbloqueado)', aud.map((x) => x.accion).join(',') === 'negocio_bloqueado,negocio_desbloqueado', aud);

  // ---------- Bloquear la cuenta de un usuario ----------
  r = await api('/admin/usuario_bloquear', { usuario: cajero.id, bloquear: true }, jefe.token);
  chk('Bloquear la cuenta del cajero avisa en vivo a su negocio', r.st === 200 && r.j.bloqueado === true && r.j.negocios === 1, r.j);
  r = await api('/estado', { negocio: NEG }, cajero.token);
  chk('/estado del cajero bloqueado: «bloqueado: usuario» y sin token', r.j.bloqueado && r.j.bloqueado.tipo === 'usuario' && !r.j.token, r.j);
  r = await api('/estado', { negocio: NEG }, dueno.token);
  chk('El dueño (no bloqueado) sigue normal', r.j.ok && r.j.token && !r.j.bloqueado, r.j);
  const ent = await fetch(sb.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: cab(), body: JSON.stringify({ email: 'caja@bar.co', password: 'clave123' }) });
  chk('La cuenta bloqueada no puede volver a entrar', ent.status === 400);
  r = await api('/admin/usuario_bloquear', { usuario: cajero.id, bloquear: false }, jefe.token);
  r = await api('/estado', { negocio: NEG }, cajero.token);
  chk('Desbloquear la cuenta → normal otra vez', r.j.ok && r.j.token && !r.j.bloqueado, r.j);

  // ---------- La migración se puede correr otra vez ----------
  let err = null;
  try { await sb.sql(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'supabase', 'migrations', '20261028000000_bloqueos.sql'), 'utf8')); } catch (e) { err = e.message; }
  chk('La migración se vuelve a correr sin errores (idempotente)', !err, err);
}

(async () => {
  let sb = null;
  try { sb = await iniciar({ env: { VENTO_ADMIN_EMAILS: 'jefe@vento.co' } }); await pruebas(sb); }
  catch (e) { mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e)); }
  finally { if (sb) await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
