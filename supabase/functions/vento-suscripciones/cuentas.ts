// =====================================================================
//  Vento Admin · cuentas, soporte y licencias (rutas /admin/* extra y /licencia)
//   • Usuarios registrados (todas las cuentas de Vento Nube) y los equipos donde se abre Vento.
//   • Soporte: casos que escriben los clientes desde la app; el administrador responde.
//   • Recuperar la contraseña de un cliente: enlace por correo, o contraseña temporal para mandarle por mensaje
//     de texto (SMS) o WhatsApp (la app le pide cambiarla al entrar).
//   • Licencias: solo el administrador las crea (duración + correos con los que se comparte).
// =====================================================================
import type { Db } from "../vento-pagos/db.ts";
import { type Env, ErrorVento, pedir } from "../vento-pagos/util.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAJES_EXTRA: Record<string, [number, string]> = {
  dias_invalidos: [400, "La duración debe estar entre 1 día y 100 años."],
  usos_invalidos: [400, "Máximo 1.000 usos por licencia."],
  licencia_inexistente: [404, "Ese código de licencia no existe. Revisa que esté bien escrito."],
  licencia_revocada: [409, "Esa licencia fue anulada por el proveedor."],
  licencia_vencida: [409, "Esa licencia ya venció."],
  licencia_agotada: [409, "Esa licencia ya se usó todas las veces permitidas."],
  licencia_ya_usada: [409, "Esa licencia ya se activó en esta cuenta."],
  licencia_otro_correo: [403, "Esa licencia es para otro correo. Entra con el correo al que te la enviaron."],
  licencia_un_correo: [400, "Una licencia es para un solo cliente: ponle máximo un correo."],
  imagen_invalida: [400, "La imagen debe ser una foto o pantallazo JPG, PNG o WebP de máximo 3 MB."],
  push_invalido: [400, "Este navegador no entregó una suscripción de notificaciones válida."],
  un_negocio_por_cuenta: [409, "Tu cuenta ya tiene su negocio. Para otra sede u otro negocio se necesita otra cuenta con su propia suscripción o licencia."],
  mensaje_invalido: [400, "Escribe el mensaje (máximo 2.000 letras)."],
  demasiados: [429, "Demasiados mensajes seguidos. Espera un rato."],
  telefono_invalido: [400, "Escribe el celular con su indicativo, solo números (ej. 573001234567)."],
  equipo_invalido: [400, "Equipo inválido."],
};

const uuid = (v: unknown, que = "usuario") => {
  const s = String(v || "").trim();
  if (!UUID.test(s)) throw new ErrorVento("falta_" + que, "Falta el " + que, 400);
  return s.toLowerCase();
};

// API de administración de cuentas de Supabase Auth (GoTrue) con la llave de servicio.
async function auth(env: Env, metodo: string, ruta: string, cuerpo?: unknown): Promise<Record<string, unknown>> {
  const k = env.SUPABASE_SERVICE_ROLE_KEY || env.VENTO_SERVICE_KEY || "";
  const r = await pedir((env.SUPABASE_URL || "").replace(/\/+$/, "") + "/auth/v1" + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", apikey: k, Authorization: "Bearer " + k },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const txt = await r.text();
  let j: Record<string, unknown> = {};
  try { j = txt ? JSON.parse(txt) : {}; } catch { /* texto */ }
  if (!r.ok) {
    const m = String(j.msg || j.message || j.error_description || j.error || txt || r.status);
    if (/already been registered|already registered|email_exists/i.test(m + " " + (j.error_code || j.code || ""))) throw new ErrorVento("correo_existe", "Ya hay una cuenta con ese correo.", 409);
    if (/password/i.test(m)) throw new ErrorVento("clave_debil", "La contraseña debe tener al menos 6 caracteres.", 400);
    throw new ErrorVento("auth", "Cuentas: " + m, r.status >= 500 ? 502 : 400);
  }
  return j;
}

// Contraseña temporal fácil de dictar o escribir (sin letras que se confundan).
export function claveTemporal(): string {
  const a = "abcdefghjkmnpqrstuvwxyz", n = "23456789", b = new Uint32Array(8);
  crypto.getRandomValues(b);
  return "Vento-" + Array.from(b.slice(0, 4), (x) => a[x % a.length]).join("") + Array.from(b.slice(4), (x) => n[x % n.length]).join("");
}

export async function accionAdmin(env: Env, db: Db, adminId: string, accion: string, b: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  switch (accion) {
    case "resumen":
      return { ok: true, resumen: await db.rpc("srv_admin_resumen") };
    case "usuarios":
      return { ok: true, usuarios: await db.rpc("srv_admin_usuarios", { p_buscar: b.buscar ? String(b.buscar).slice(0, 80) : null, p_limite: Number(b.limite) || 500 }) };
    case "usuario": {
      const u = await db.rpc<Record<string, unknown> | null>("srv_admin_usuario", { p_usuario: uuid(b.usuario) });
      if (!u) throw new ErrorVento("no_existe", "No se encontró esa cuenta.", 404);
      return { ok: true, usuario: u };
    }
    case "equipos":
      return { ok: true, equipos: await db.rpc("srv_admin_equipos", { p_solo_locales: !!b.solo_locales }) };
    case "usuario_clave_temporal": {
      const id = uuid(b.usuario), clave = claveTemporal();
      await auth(env, "PUT", "/admin/users/" + id, { password: clave });
      await db.rpc("srv_marcar_cambiar_clave", { p_usuario: id, p_si: true });
      return { ok: true, clave };
    }
    case "usuario_enlace_clave": {
      const email = String(b.email || "").trim().toLowerCase();
      if (!CORREO.test(email)) throw new ErrorVento("correo_invalido", "Correo inválido.", 400);
      await auth(env, "POST", "/recover", { email });
      return { ok: true };
    }
    case "usuario_bloquear": {
      const id = uuid(b.usuario);
      if (id === adminId) throw new ErrorVento("sin_permiso", "No puedes bloquear tu propia cuenta.", 400);
      await auth(env, "PUT", "/admin/users/" + id, { ban_duration: b.bloquear === false ? "none" : "876000h" });
      return { ok: true, bloqueado: b.bloquear !== false };
    }
    case "usuario_confirmar":
      await auth(env, "PUT", "/admin/users/" + uuid(b.usuario), { email_confirm: true });
      return { ok: true };
    case "usuario_crear": {
      // El administrador crea la cuenta de un cliente (con su negocio) y le da la contraseña para entrar.
      const email = String(b.email || "").trim().toLowerCase();
      if (!CORREO.test(email)) throw new ErrorVento("correo_invalido", "Escribe un correo válido.", 400);
      const clave = b.clave ? String(b.clave) : claveTemporal();
      if (clave.length < 6) throw new ErrorVento("clave_debil", "La contraseña debe tener al menos 6 caracteres.", 400);
      const u = await auth(env, "POST", "/admin/users", { email, password: clave, email_confirm: true, user_metadata: { nombre: b.nombre ? String(b.nombre).slice(0, 60) : undefined } });
      const id = String(u.id || (u.user as Record<string, unknown> | undefined)?.id || "");
      let negocio: string | null = null;
      if (b.negocio) negocio = await db.rpc<string>("srv_negocio_crear", { p_usuario: id, p_nombre: String(b.negocio).slice(0, 80) });
      if (!b.clave) await db.rpc("srv_marcar_cambiar_clave", { p_usuario: id, p_si: true });
      return { ok: true, id, email, clave, negocio };
    }
    case "soporte":
      return { ok: true, casos: await db.rpc("srv_soporte_lista", { p_estado: b.estado ? String(b.estado) : "abiertos" }) };
    case "soporte_responder":
      return { ok: true, caso: await db.rpc("srv_soporte_responder", { p_caso: uuid(b.caso, "caso"), p_texto: b.texto ? String(b.texto) : "", p_estado: b.estado ? String(b.estado) : null, p_admin: adminId }) };
    case "licencias":
      return { ok: true, licencias: await db.rpc("srv_lic_lista") };
    case "licencia_crear":
      return { ok: true, licencia: await db.rpc("srv_lic_crear", { p: b.licencia && typeof b.licencia === "object" ? b.licencia : {}, p_admin: adminId }) };
    case "licencia_correos":
      return { ok: true, licencia: await db.rpc("srv_lic_correos", { p_id: uuid(b.licencia, "licencia"), p_agregar: b.agregar || [], p_quitar: b.quitar || [], p_admin: adminId }) };
    case "errores":
      return { ok: true, errores: await db.rpc("srv_admin_errores", { p_estado: b.estado ? String(b.estado) : "abiertos", p_limite: Number(b.limite) || 200 }) };
    case "errores_abiertos":
      return { ok: true, abiertos: await db.rpc("srv_admin_errores_abiertos") };
    case "error_resolver":
      if (!b.huella) throw new ErrorVento("falta_huella", "Falta el error.", 400);
      return { ok: true, r: await db.rpc("srv_admin_error_resolver", { p_huella: String(b.huella).slice(0, 200), p_resuelto: b.resuelto !== false }) };
    case "licencia_revocar":
      return { ok: true, licencia: await db.rpc("srv_lic_revocar", { p_id: uuid(b.licencia, "licencia"), p_quitar_acceso: !!b.quitar_acceso, p_admin: adminId }) };
  }
  return null;
}
