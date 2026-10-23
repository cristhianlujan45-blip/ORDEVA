// =====================================================================
//  Servidor ORDEVA · suscripciones (BETA: pago manual por Nequi / DaviPlata)
//
//  Rutas (todas bajo /functions/v1/vento-suscripciones):
//    GET  /salud                     estado del servidor
//    GET  /planes                    catálogo público (planes, precios, funciones, números de pago) + medios disponibles
//    GET  /clave                     llave pública (JWK) para verificar el token de estado sin internet
//    POST /estado   {negocio}        estado de la suscripción + token firmado        (sesión; cualquier miembro)
//    POST /pago     {negocio, plan, metodo, monto, referencia, fecha, nombre, telefono, idem, comprobante:{base64, tipo}}
//                                    envía un pago con su comprobante                (sesión; dueño o administrador)
//    POST /licencia {negocio, codigo}  activa una licencia con su código              (sesión; dueño o administrador)
//    POST /admin/*                   panel del proveedor de ORDEVA                    (sesión de un administrador de ORDEVA)
//    POST /vencer                    vence las suscripciones con fecha pasada        (cabecera x-vento-cron)
//    POST /google-play/rtdn          notificaciones de Google Play                   (501 mientras sea beta)
//  El plan lo decide SIEMPRE la base de datos; la app solo consulta.
// =====================================================================
import { crearDb, type Db } from "../vento-pagos/db.ts";
import { type Env, ErrorVento, igualesSeguro, log } from "../vento-pagos/util.ts";
import * as N from "./nucleo.ts";
import { borrar, BUCKET_SOPORTE, firmar, subir } from "./almacen.ts";
import { leerComprobante } from "./proveedores/manual.ts";
import { enviarPush, vapid } from "../vento-pagos/push.ts";
import { disponibles, elegir, googlePlay } from "./proveedores/index.ts";
import type { EntradaPago } from "./proveedores/tipos.ts";
import { accionAdmin } from "./cuentas.ts";
import * as DIAN from "../vento-pagos/dian.ts";

export const VERSION = N.VERSION;
const MAX_CUERPO = 6 * 1024 * 1024;   // la foto (3 MB) en base64 + los datos
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function origenes(env: Env): string[] {
  return (env.VENTO_ORIGENES || "https://cristhianlujan45-blip.github.io,http://localhost:8765,http://127.0.0.1:8765").split(",").map((x) => x.trim()).filter(Boolean);
}

function cabecerasCors(req: Request, env: Env): Record<string, string> {
  const o = req.headers.get("origin") || "";
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-vento-cron",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (o && origenes(env).includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}

function json(status: number, cuerpo: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
  });
}

function servidor(env: Env): Db {
  const k = env.SUPABASE_SERVICE_ROLE_KEY || env.VENTO_SERVICE_KEY || "";
  if (!env.SUPABASE_URL || !k) throw new ErrorVento("sin_config", "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor", 500);
  return N.conErrores(crearDb(env.SUPABASE_URL, k, k));
}

// La base de datos con la sesión de quien llama: las funciones revisan su rol con auth.uid().
function usuario(req: Request, env: Env): Db {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const anon = req.headers.get("apikey") || env.SUPABASE_ANON_KEY || "";
  if (!jwt || jwt === anon) throw new ErrorVento("sin_sesion", "Entra con tu cuenta de ORDEVA Nube.", 401);
  return N.conErrores(crearDb(env.SUPABASE_URL || "", anon, jwt));
}

const cacheId = (env: Env) => env.SUPABASE_URL || "";

function idDe(v: unknown, codigo: string, mensaje: string): string {
  const s = String(v || "").trim();
  if (!UUID.test(s)) throw new ErrorVento(codigo, mensaje, 400);
  return s.toLowerCase();
}
const negocioDe = (b: Record<string, unknown>) => idDe(b.negocio, "falta_negocio", "Falta el negocio");
const pagoDe = (b: Record<string, unknown>) => idDe(b.payment || b.pago, "falta_pago", "Falta el pago");

async function cuerpo(req: Request): Promise<Record<string, unknown>> {
  const txt = await req.text();
  if (txt.length > MAX_CUERPO) throw new ErrorVento("muy_grande", "Lo que se envió es demasiado grande (la foto debe pesar máximo 3 MB).", 413);
  if (!txt) return {};
  try {
    const j = JSON.parse(txt);
    return j && typeof j === "object" && !Array.isArray(j) ? j : {};
  } catch {
    throw new ErrorVento("json_invalido", "Datos inválidos", 400);
  }
}

// ---------- /estado ----------
async function estado(req: Request, env: Env, b: Record<string, unknown>) {
  const negocio = negocioDe(b);
  const yo = usuario(req, env);
  const rol = await yo.rpc<string>("sub_puedo", { p_negocio: negocio, p_accion: "ver" });
  const db = servidor(env);
  // Licencias que el proveedor compartió con el correo de quien entra: se activan solas (dueño o administrador).
  let licencias: unknown = [];
  if (rol === "dueno" || rol === "admin") {
    try { const me = await yo.rpc<{ id: string }>("sub_yo"); licencias = await db.rpc("srv_lic_auto", { p_negocio: negocio, p_usuario: me.id }); }
    catch (x) { log("warn", "lic_auto", { negocio, error: x instanceof Error ? x.message : String(x) }); }
  }
  const e = await N.estado(db, negocio);
  // Bloqueado por el administrador de ORDEVA (el negocio o la cuenta de quien entra): sin token, el equipo se bloquea.
  let bloqueo: Record<string, unknown> | null = null;
  try { const me = await yo.rpc<{ id: string }>("sub_yo"); bloqueo = await db.rpc<Record<string, unknown> | null>("srv_bloqueo_de", { p_negocio: negocio, p_usuario: me.id }); }
  catch (x) { log("warn", "bloqueo_de", { negocio, error: x instanceof Error ? x.message : String(x) }); }
  if (bloqueo) return { ok: true, ...N.paraRol(e, rol), rol, bloqueado: bloqueo };
  const token = await N.firmarToken(db, negocio, e, cacheId(env));
  return { ok: true, ...N.paraRol(e, rol), rol, token, ...(Array.isArray(licencias) && licencias.length ? { licencias_activadas: licencias } : {}) };
}

// ---------- /licencia ----------
async function licencia(req: Request, env: Env, b: Record<string, unknown>) {
  const negocio = negocioDe(b);
  const me = await usuario(req, env).rpc<{ id: string }>("sub_yo");
  const db = servidor(env);
  const r = await db.rpc<Record<string, unknown>>("srv_lic_canjear", { p_codigo: String(b.codigo || ""), p_negocio: negocio, p_usuario: me.id });
  log("info", "licencia_canjeada", { negocio, codigo: String(r.codigo || "") });
  return { ...r, ok: true, estado: await N.estado(db, negocio) };
}

// ---------- Soporte: fotos / pantallazos y avisos al administrador ----------
const SITIO = "https://cristhianlujan45-blip.github.io/ORDEVA/";

// Quién llama, si viene con su sesión (el soporte también se puede usar sin cuenta, con la clave del caso).
async function quienOpcional(req: Request, env: Env): Promise<string | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const anon = req.headers.get("apikey") || env.SUPABASE_ANON_KEY || "";
  if (!jwt || jwt === anon) return null;
  const me = await usuario(req, env).rpc<{ id: string }>("sub_yo");
  return me && me.id ? me.id : null;
}
const claveDe = (b: Record<string, unknown>) => { const c = String(b.clave || "").trim(); return /^[0-9a-f]{20,80}$/.test(c) ? c : null; };
const casoDe = (b: Record<string, unknown>) => idDe(b.caso, "falta_caso", "Falta el caso de soporte");

// Notificación push a los equipos del administrador (navegador / PWA). Nunca lanza.
export async function avisarAdmins(env: Env, db: Db, mensaje: Record<string, unknown>): Promise<number> {
  try {
    const lista = await db.rpc<Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>>("srv_admin_push_lista");
    if (!lista || !lista.length) return 0;
    const v = await vapid(db, env.VENTO_SITIO || SITIO);
    let ok = 0;
    await Promise.all(lista.map(async (sus) => {
      try {
        const st = await enviarPush(v, sus, mensaje);
        if (st === 404 || st === 410) await db.rpc("srv_admin_push_borrar", { p_endpoint: sus.endpoint });
        else if (st < 300) ok++;
      } catch (e) { log("warn", "push_admin", { error: e instanceof Error ? e.message : String(e) }); }
    }));
    return ok;
  } catch (e) {
    log("warn", "push_admin_lista", { error: e instanceof Error ? e.message : String(e) });
    return 0;
  }
}
const urlAdmin = (env: Env, ancla: string) => (env.VENTO_SITIO || SITIO).replace(/\/?$/, "/") + "admin.html#" + ancla;

async function avisarSoporte(env: Env, db: Db, caso: string, uid: string | null, clave: string | null) {
  const d = await db.rpc<Record<string, unknown> | null>("srv_soporte_para_avisar", { p_caso: caso, p_uid: uid, p_clave: clave });
  if (!d) return 0;
  const quien = [d.nombre, d.negocio].filter(Boolean).join(" · ");
  return await avisarAdmins(env, db, {
    titulo: "🎧 Soporte" + (quien ? ": " + String(quien).slice(0, 60) : ""),
    cuerpo: (d.imagen ? "📷 " : "") + String(d.texto || d.asunto || "").slice(0, 160),
    tag: "soporte-" + caso, url: urlAdmin(env, "soporte"),
  });
}

// POST /soporte-adjunto {caso, clave?, imagen:{base64}, texto?}: el SERVIDOR sube la imagen (bucket privado) y la guarda.
async function soporteAdjunto(req: Request, env: Env, b: Record<string, unknown>) {
  const caso = casoDe(b), clave = claveDe(b), uid = await quienOpcional(req, env);
  const db = servidor(env);
  if (!(await db.rpc<boolean>("srv_soporte_acceso", { p_caso: caso, p_uid: uid, p_clave: clave }))) throw new ErrorVento("sin_permiso", "No tienes permiso para ese caso de soporte.", 403);
  let img;
  try { img = leerComprobante(b.imagen); } catch { throw new ErrorVento("imagen_invalida", "La imagen debe ser una foto o pantallazo JPG, PNG o WebP de máximo 3 MB.", 400); }
  const ruta = "soporte/" + caso + "/" + crypto.randomUUID() + "." + img.ext;
  await subir(env, ruta, img.bytes, img.mime, BUCKET_SOPORTE);
  let r: Record<string, unknown>;
  try {
    r = await db.rpc<Record<string, unknown>>("srv_soporte_adjuntar", { p_caso: caso, p_uid: uid, p_clave: clave, p_path: ruta, p_tipo: img.mime, p_texto: b.texto != null ? String(b.texto) : null });
  } catch (e) { await borrar(env, ruta, BUCKET_SOPORTE); throw e; }
  await avisarSoporte(env, db, caso, uid, clave);
  log("info", "soporte_imagen", { caso, bytes: img.bytes.length });
  return { ok: true, caso: r };
}

// POST /soporte-avisar {caso, clave?}: después de escribir un mensaje, avisa al administrador (con límite por caso).
async function soporteAvisar(req: Request, env: Env, b: Record<string, unknown>) {
  const n = await avisarSoporte(env, servidor(env), casoDe(b), await quienOpcional(req, env), claveDe(b));
  return { ok: true, avisados: n };
}

// ---------- /tipo-pedir: cambiar el tipo de negocio necesita permiso del administrador de ORDEVA ----------
async function tipoPedir(req: Request, env: Env, b: Record<string, unknown>) {
  const negocio = negocioDe(b);
  const me = await usuario(req, env).rpc<{ id: string }>("sub_yo");
  const db = servidor(env);
  const p = { a: b.a, de: b.de, a_nombre: b.a_nombre, de_nombre: b.de_nombre, propio: b.propio, motivo: b.motivo };
  const r = await db.rpc<Record<string, unknown>>("srv_tipo_pedir", { p_negocio: negocio, p_usuario: me.id, p });
  await avisarAdmins(env, db, { titulo: "🏷️ Cambio de tipo de negocio", cuerpo: String(r.negocio || "Un negocio") + ": " + String(r.de_nombre || r.de || "—") + " → " + String(r.a_nombre || r.a),
    tag: "tipo-" + negocio, url: urlAdmin(env, "soporte") });
  log("info", "tipo_pedido", { negocio, a: String(r.a || "") });
  return { ok: true, solicitud: r };
}

// ---------- /pago ----------
async function pago(req: Request, env: Env, b: Record<string, unknown>) {
  const negocio = negocioDe(b);
  const yo = usuario(req, env), db = servidor(env);
  const rol = await yo.rpc<string>("sub_puedo", { p_negocio: negocio, p_accion: "pagar" });
  const me = await yo.rpc<{ id: string; email: string | null }>("sub_yo");
  const cat = await N.catalogo(db);
  const prov = elegir(cat.config, env, b.proveedor ? String(b.proveedor) : "manual");
  const entrada: EntradaPago = {
    plan: String(b.plan || ""), metodo: b.metodo ? String(b.metodo) : "", monto: Number(b.monto),
    referencia: b.referencia != null ? String(b.referencia) : null, fecha: b.fecha ? String(b.fecha) : null,
    nombre: b.nombre != null ? String(b.nombre) : null, telefono: b.telefono != null ? String(b.telefono) : null,
    idem: b.idem ? String(b.idem) : null, comprobante: (b.comprobante || null) as EntradaPago["comprobante"],
    purchaseToken: b.purchaseToken ? String(b.purchaseToken) : null,
  };
  const r = await prov.registrarPago({ env, db, negocio, usuario: me, rol, cfg: cat.config }, entrada);
  log("info", "sub_pago", { negocio, pago: r.payment.id, repetido: r.repetido, proveedor: prov.id, metodo: r.payment.method });
  if (!r.repetido) await avisarAdmins(env, db, { titulo: "💳 Pago nuevo para revisar", cuerpo: String(r.payment.method || "") + " · $" + Number(r.payment.amount || 0).toLocaleString("es-CO"),
    tag: "pago-sub-" + r.payment.id, url: urlAdmin(env, "subs") });
  return { ok: true, payment: r.payment, repetido: r.repetido, estado: await N.estado(db, negocio) };
}

// ---------- /admin/* ----------
function correosAdmin(env: Env): string[] {
  return String(env.VENTO_ADMIN_EMAILS || "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
}

async function admin(req: Request, env: Env, accion: string, b: Record<string, unknown>) {
  const db = servidor(env);
  const me = await usuario(req, env).rpc<{ id: string; email: string | null }>("sub_yo");
  let es = await db.rpc<boolean>("srv_admin_es", { p_usuario: me.id });
  if (!es && me.email && correosAdmin(env).includes(me.email.toLowerCase())) {
    await db.rpc("srv_admin_agregar", { p_usuario: me.id, p_email: me.email });
    log("info", "admin_agregado", { usuario: me.id });
    es = true;
  }
  if (!es) throw new ErrorVento("no_admin", "Esta cuenta no es administradora de ORDEVA.", 403);
  // La primera vez que entra por su correo, su cuenta queda amarrada como administradora (platform_admins): desde ahí,
  // otra cuenta con el mismo correo (borrada y creada otra vez) ya no entra.
  if (me.email) { try { await db.rpc("srv_admin_agregar", { p_usuario: me.id, p_email: me.email }); } catch (_) { /* ya estaba o sin confirmar */ } }
  const a = me.id;
  const extra = await accionAdmin(env, db, a, accion, b);
  if (extra) return extra;
  switch (accion) {
    case "yo":
      return { ok: true, admin: true, id: me.id, email: me.email };
    case "pagos":
      return { ok: true, pagos: await db.rpc("srv_admin_pagos", { p_status: b.status ? String(b.status) : "review" }) };
    case "comprobante": {
      const c = await db.rpc<{ storage_path: string; mime: string } | null>("srv_sub_comprobante_de", { p_payment: pagoDe(b) });
      if (!c || !c.storage_path) throw new ErrorVento("sin_comprobante", "Ese pago no tiene comprobante.", 404);
      return { ok: true, url: await firmar(env, c.storage_path, 600), mime: c.mime, vence_en: 600 };
    }
    case "aprobar": {
      const r = await db.rpc<Record<string, unknown>>("srv_sub_aprobar", { p_payment: pagoDe(b), p_admin: a });
      log("info", "sub_aprobado", { pago: String(b.payment || b.pago), admin: a, repetido: r.repetido });
      return { ok: true, ...r };
    }
    case "rechazar":
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_sub_rechazar", { p_payment: pagoDe(b), p_admin: a, p_motivo: String(b.motivo || "") })) };
    case "suscripciones":
      return { ok: true, suscripciones: await db.rpc("srv_admin_suscripciones") };
    case "negocios":
      return { ok: true, negocios: await db.rpc("srv_admin_negocios") };
    case "negocio":
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_admin_negocio", { p_negocio: negocioDe(b) })) };
    // 🧾 Facturación electrónica DIAN: cada negocio con su empresa (NIT) en MATIAS
    case "dian_lista":
      return { ok: true, servidor: DIAN.configurado(env), ambiente: DIAN.esPruebas(env) ? "pruebas" : "produccion", negocios: await db.rpc("srv_dian_admin_lista") };
    case "dian_negocio":
      return { ok: true, servidor: DIAN.configurado(env), ambiente: DIAN.esPruebas(env) ? "pruebas" : "produccion", ...(await db.rpc<Record<string, unknown>>("srv_dian_admin", { p_negocio: negocioDe(b) })) };
    case "dian_clientes":
      return { ok: true, clientes: await DIAN.clientesMatias(env, db) };
    case "dian_conectar": {
      const cu = b.client_uuid == null || b.client_uuid === "" ? null : String(b.client_uuid).trim();
      if (cu && !/^[0-9a-f-]{36}$/i.test(cu)) throw new ErrorVento("dian_cliente_invalido", "El código de la empresa en MATIAS (client_uuid) no es válido.", 400);
      const r = await db.rpc<Record<string, unknown>>("srv_dian_admin_cliente", { p_negocio: negocioDe(b), p_client_uuid: cu, p_admin: a });
      log("info", "dian_conectado", { negocio: negocioDe(b), conectado: !!cu, admin: a });
      return { ok: true, ...r };
    }
    case "cancelar":
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_sub_cancelar", { p_negocio: negocioDe(b), p_admin: a, p_motivo: b.motivo ? String(b.motivo) : null })) };
    case "cambiar_plan":
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_sub_cambiar_plan", { p_negocio: negocioDe(b), p_plan: String(b.plan || ""), p_admin: a })) };
    case "dar":
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_sub_dar", { p_negocio: negocioDe(b), p_plan: String(b.plan || ""), p_meses: Math.round(Number(b.meses) || 0), p_admin: a })) };
    // Activar desde el panel: por N meses (desde hoy, o sumados al final si ya tiene ese plan vigente) por el mismo
    // punto único que la cortesía, o «reactivar» una cancelada con el período que todavía le quedaba.
    case "activar":
      log("info", "sub_activada_admin", { negocio: negocioDe(b), plan: String(b.plan || ""), meses: Number(b.meses) || 0, admin: a });
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_sub_dar", { p_negocio: negocioDe(b), p_plan: String(b.plan || ""), p_meses: Math.round(Number(b.meses) || 0), p_admin: a })) };
    case "reactivar":
      log("info", "sub_reactivada", { negocio: negocioDe(b), admin: a });
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_sub_reactivar", { p_negocio: negocioDe(b), p_admin: a })) };
    case "planes":
      return { ok: true, ...(await db.rpc<Record<string, unknown>>("srv_admin_planes")) };
    // Notificaciones push de ESTE equipo del administrador (soporte nuevo, pagos por revisar).
    case "push_guardar": {
      const sus = (b.sub && typeof b.sub === "object" ? b.sub : {}) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await db.rpc("srv_admin_push_guardar", { p_admin: a, p_endpoint: String(sus.endpoint || ""), p_p256dh: String(sus.keys && sus.keys.p256dh || ""), p_auth: String(sus.keys && sus.keys.auth || "") });
      return { ok: true };
    }
    case "push_clave":
      return { ok: true, publica: (await vapid(db, env.VENTO_SITIO || SITIO)).publica };
    case "tipos":
      return { ok: true, solicitudes: await db.rpc("srv_tipo_lista", { p_estado: b.estado ? String(b.estado) : "pendiente" }) };
    case "tipo_resolver":
      return { ok: true, solicitud: await db.rpc("srv_tipo_resolver", { p_id: idDe(b.solicitud, "falta_solicitud", "Falta la solicitud"), p_aprobar: b.aprobar === true, p_respuesta: b.respuesta ? String(b.respuesta) : null, p_admin: a }) };
    case "soporte_imagen": {
      const id = Number(b.mensaje);
      if (!Number.isInteger(id) || id <= 0) throw new ErrorVento("falta_mensaje", "Falta el mensaje", 400);
      const x = await db.rpc<{ path: string; tipo: string } | null>("srv_soporte_adjunto_de", { p_mensaje: id });
      if (!x || !x.path) throw new ErrorVento("no_existe", "Ese mensaje no tiene imagen.", 404);
      return { ok: true, url: await firmar(env, x.path, 600, BUCKET_SOPORTE), tipo: x.tipo, vence_en: 600 };
    }
    case "plan_guardar":
      if (!b.plan || typeof b.plan !== "object") throw N.errorSub("plan_invalido");
      return { ok: true, plan: await db.rpc("srv_admin_plan_guardar", { p_plan: b.plan, p_admin: a }) };
    case "config_guardar":
      if (!b.config || typeof b.config !== "object") throw N.errorSub("config_invalida");
      return { ok: true, config: await db.rpc("srv_admin_config_guardar", { p_cfg: b.config, p_admin: a }) };
  }
  throw new ErrorVento("ruta", "Acción de administración desconocida", 404);
}

// ---------- Entrada ----------
export async function manejar(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("vento-suscripciones");
  const ruta = i >= 0 ? partes.slice(i + 1) : partes;
  const cors = cabecerasCors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const r0 = ruta[0] || "salud";
    if (r0 === "salud") return json(200, { ok: true, servicio: "vento-suscripciones", version: VERSION, pago_manual: true }, cors);
    if (r0 === "planes" && req.method === "GET") {
      const db = servidor(env), cat = await N.catalogo(db);
      return json(200, { ok: true, ...cat, proveedores: disponibles(cat.config, env).map((p) => p.id) }, cors);
    }
    if (r0 === "clave" && req.method === "GET") return json(200, { ok: true, ...(await N.clavePublica(servidor(env), cacheId(env))) }, cors);
    if (r0 === "google-play" && ruta[1] === "rtdn" && req.method === "POST") return await googlePlay.procesarNotificacion(req, env);
    if (req.method !== "POST") return json(405, { ok: false, error: "metodo" }, cors);
    if (r0 === "vencer") {
      const secreto = env.VENTO_CRON_SECRETO || "";
      if (!secreto || !igualesSeguro(req.headers.get("x-vento-cron") || "", secreto)) return json(401, { ok: false, error: "sin_permiso" }, cors);
      const n = await servidor(env).rpc<number>("srv_sub_vencer", { p_negocio: null });
      log("info", "sub_vencer", { vencidas: n });
      return json(200, { ok: true, vencidas: n }, cors);
    }
    const b = await cuerpo(req);
    if (r0 === "estado") return json(200, await estado(req, env, b), cors);
    if (r0 === "pago") return json(200, await pago(req, env, b), cors);
    if (r0 === "licencia") return json(200, await licencia(req, env, b), cors);
    if (r0 === "soporte-adjunto") return json(200, await soporteAdjunto(req, env, b), cors);
    if (r0 === "soporte-avisar") return json(200, await soporteAvisar(req, env, b), cors);
    if (r0 === "tipo-pedir") return json(200, await tipoPedir(req, env, b), cors);
    if (r0 === "admin") return json(200, await admin(req, env, ruta[1] || "yo", b), cors);
    return json(404, { ok: false, error: "ruta" }, cors);
  } catch (e) {
    const ev = e instanceof ErrorVento ? e : new ErrorVento("interno", "Error interno", 500);
    if (!(e instanceof ErrorVento)) log("error", "excepcion", { ruta: ruta.join("/"), error: e instanceof Error ? e.stack || e.message : String(e) });
    return json(ev.status, { ok: false, error: ev.codigo, mensaje: ev.message }, cors);
  }
}
