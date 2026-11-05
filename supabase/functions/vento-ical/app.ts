// ORDEVA 1.76.0 · 🔗 vento-ical: el calendario de las habitaciones con Booking, Airbnb y otras plataformas (iCal).
//  GET  /vento-ical/salud
//  GET  /vento-ical/cal/<publico>/<habitación>.ics → el calendario de ORDEVA para pegar en Booking / Airbnb. Solo las
//       fechas ocupadas («Reservado - ORDEVA»): nunca el nombre, el celular ni nada del cliente.
//  POST /vento-ical/leer {url} → trae el calendario de Booking / Airbnb para la app (el navegador no puede leerlo directo).
//  POST /vento-ical/sincronizar → 1.77.0: el SERVIDOR lee los calendarios y actualiza las reservas. Con «x-vento-cron» (el
//       repaso de cada 5 minutos de pg_cron): todos los negocios. Con la sesión de alguien del equipo y {negocio}: ese, ya.
//       Solo deja leer las plataformas conocidas, por https, hasta 1 MB y con tiempo límite: no sirve para leer otras páginas.
import type { Env } from "../vento-pagos/util.ts";
import { igualesSeguro } from "../vento-pagos/util.ts";

const VERSION = "1.77.0";
const HOSTS = ["booking.com", "airbnb.com", "airbnb.com.co", "airbnb.mx", "airbnb.es", "vrbo.com", "homeaway.com", "expedia.com",
  "tripadvisor.com", "google.com", "googleusercontent.com", "despegar.com", "hostelworld.com", "agoda.com", "lodgify.com", "smoobu.com",
  "beds24.com", "cloudbeds.com", "icloud.com", "outlook.com", "office365.com", "live.com"];

function origenes(env: Env): string[] {
  return (env.VENTO_ORIGENES || "https://cristhianlujan45-blip.github.io,http://localhost:8765,http://127.0.0.1:8765").split(",").map((x) => x.trim()).filter(Boolean);
}
function cors(req: Request, env: Env): Record<string, string> {
  const o = req.headers.get("origin") || "";
  const h: Record<string, string> = { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Max-Age": "86400", Vary: "Origin" };
  if (o && origenes(env).includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
function json(status: number, cuerpo: unknown, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...extra, "Content-Type": "application/json; charset=utf-8" } });
}
export function hostPermitido(u: string, env: Env): boolean {
  let x: URL;
  try { x = new URL(u); } catch (_e) { return false; }
  const extra = (env.VENTO_ICAL_HOSTS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);   // solo para pruebas
  const h = x.hostname.toLowerCase();
  if (extra.includes(h) && (x.protocol === "https:" || x.protocol === "http:")) return true;
  if (x.protocol !== "https:" || x.username || x.password || (x.port && x.port !== "443")) return false;
  return HOSTS.some((d) => h === d || h.endsWith("." + d));
}

// ---------- ICS ----------
const dosD = (n: number) => String(n).padStart(2, "0");
function fechaIcs(iso: string): string {
  const d = new Date(iso);
  return d.getUTCFullYear() + dosD(d.getUTCMonth() + 1) + dosD(d.getUTCDate()) + "T" + dosD(d.getUTCHours()) + dosD(d.getUTCMinutes()) + dosD(d.getUTCSeconds()) + "Z";
}
function diaIcs(iso: string): string {
  // Las plataformas bloquean por NOCHES: la fecha de Colombia (UTC-5) de llegada y de salida.
  const d = new Date(new Date(iso).getTime() - 5 * 3600e3);
  return d.getUTCFullYear() + dosD(d.getUTCMonth() + 1) + dosD(d.getUTCDate());
}
const escIcs = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
export function armarIcs(nombre: string, recurso: string, eventos: Array<{ uid: string; desde: string; hasta: string }>): string {
  const ahora = fechaIcs(new Date().toISOString());
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ORDEVA//Reservas " + VERSION + "//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + escIcs((nombre ? nombre + " - " : "") + recurso)];
  for (const e of eventos) {
    let ini = diaIcs(e.desde), fin = diaIcs(e.hasta);
    if (fin <= ini) { const d = new Date(Date.UTC(+ini.slice(0, 4), +ini.slice(4, 6) - 1, +ini.slice(6, 8) + 1)); fin = d.getUTCFullYear() + dosD(d.getUTCMonth() + 1) + dosD(d.getUTCDate()); }
    L.push("BEGIN:VEVENT", "UID:" + escIcs(e.uid) + "@ordeva", "DTSTAMP:" + ahora, "DTSTART;VALUE=DATE:" + ini, "DTEND;VALUE=DATE:" + fin, "SUMMARY:Reservado - ORDEVA", "TRANSP:OPAQUE", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map((l) => { const out: string[] = []; let s = l; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); }).join("\r\n") + "\r\n";
}

// ---------- Leer un .ics (lo mismo que hace la app, ahora en el servidor) ----------
type Ev = { uid: string; desde: string; hasta: string; detalle: string };
function fechaDe(valor: string, params: string, hora: string): Date | null {
  const v = String(valor || "").trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m || /VALUE=DATE(?!-)/i.test(params || "")) {
    if (!m) m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    const [hh, mm] = String(hora || "12:00").split(":").map(Number);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (hh || 0) + 5, mm || 0));   // hora del hotel en Colombia (UTC-5)
  }
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  return m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))) : new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 5, +m[5], +(m[6] || 0)));
}
const NO_ES_NOMBRE = /reserv|closed|not available|no disponible|bloque|blocked|booked|ocupad|unavailable|airbnb|booking|vrbo|expedia/i;
// Lo que se puede saber del huésped: Airbnb trae el código de la reserva y los últimos 4 dígitos del celular; otras
// plataformas (Lodgify, Vrbo, gestores) traen el nombre en el título.
export function detalleDe(resumen: string, desc: string): string {
  const p: string[] = [];
  const r = String(resumen || "").trim();
  if (r && !NO_ES_NOMBRE.test(r) && r.length <= 60) p.push(r);
  const cod = /reservations\/details\/([A-Z0-9]{6,14})/i.exec(desc || "") || /\b(HM[A-Z0-9]{6,12})\b/.exec(desc || "");
  if (cod) p.push(cod[1].toUpperCase());
  const tel = /(?:Phone Number \(Last 4 Digits\)|Últimos 4 dígitos[^:]*)\s*:\s*(\d{4})/i.exec(desc || "");
  if (tel) p.push("cel …" + tel[1]);
  // Booking exporta sus reservas DE VERDAD como «CLOSED - Not available»: eso no es un bloqueo. En Airbnb, «Airbnb (Not
  // available)» sí es un día que cerró el dueño.
  if ((/^airbnb\s*\(not available\)$/i.test(r) || /\bblocked\b|bloquead/i.test(r)) && !cod) p.push("bloqueado");
  return p.join(" · ").slice(0, 60);
}
export function leerIcs(txt: string, entrada: string, salida: string): Ev[] {
  const lineas = String(txt || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: Ev[] = []; let cur: Record<string, unknown> | null = null;
  for (const l of lineas) {
    if (/^BEGIN:VEVENT/i.test(l)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(l)) {
      if (cur && cur.uid && cur.desde && cur.hasta && !/CANCELLED/i.test(String(cur.status || ""))) {
        let d = cur.desde as Date, h = cur.hasta as Date;
        if (h <= d) h = new Date(d.getTime() + 864e5);
        if (!/@ordeva$/.test(String(cur.uid))) out.push({ uid: String(cur.uid), desde: d.toISOString(), hasta: h.toISOString(), detalle: detalleDe(String(cur.resumen || ""), String(cur.desc || "")) });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = l.indexOf(":"); if (i < 0) continue;
    const [nom, ...ps] = l.slice(0, i).split(";"); const val = l.slice(i + 1), params = ps.join(";"), k = nom.toUpperCase();
    const des = (x: string) => x.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\;/g, ";").trim();
    if (k === "UID") cur.uid = val.trim();
    else if (k === "DTSTART") cur.desde = fechaDe(val, params, entrada);
    else if (k === "DTEND") cur.hasta = fechaDe(val, params, salida);
    else if (k === "SUMMARY") cur.resumen = des(val);
    else if (k === "DESCRIPTION") cur.desc = des(val);
    else if (k === "STATUS") cur.status = val;
  }
  return out.slice(0, 500);
}

async function traerIcs(u: string, env: Env): Promise<string> {
  if (!hostPermitido(u, env)) throw new Error("link_no_permitido");
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(u, { signal: ctl.signal, redirect: "follow", headers: { Accept: "text/calendar, text/plain, */*", "User-Agent": "ORDEVA-Calendario/" + VERSION } });
    if (!hostPermitido(r.url || u, env)) throw new Error("link_no_permitido");
    if (!r.ok) throw new Error("La plataforma respondió " + r.status);
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 1024 * 1024) throw new Error("muy_grande");
    const txt = new TextDecoder().decode(buf);
    if (!/BEGIN:VCALENDAR/i.test(txt)) throw new Error("Ese link no es un calendario iCal");
    return txt;
  } finally { clearTimeout(t); }
}
async function rpcServidor(env: Env, fn: string, args: unknown): Promise<unknown> {
  const k = env.SUPABASE_SERVICE_ROLE_KEY || env.VENTO_SERVICE_KEY || "";
  const r = await fetch((env.SUPABASE_URL || "") + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j as { message?: string }).message) || ("rpc " + fn + " " + r.status));
  return j;
}
type Link = { negocio: string; recurso: string; recurso_nombre: string; fuente: string; url: string; entrada: string; salida: string };
export async function sincronizar(env: Env, negocio: string | null) {
  const links = (await rpcServidor(env, "srv_ical_pendientes", { p_negocio: negocio })) as Link[];
  const res = { ok: true, links: 0, nuevas: 0, cambiadas: 0, canceladas: 0, choques: [] as unknown[], errores: 0 };
  const lista = (links || []).slice(0, 120);
  let i = 0;
  const trabajar = async () => {
    while (i < lista.length) {
      const l = lista[i++];
      try {
        const ev = leerIcs(await traerIcs(l.url, env), l.entrada, l.salida);
        const r = (await rpcServidor(env, "srv_reserva_ical_sincronizar", { p_negocio: l.negocio, p_recurso: l.recurso, p_recurso_nombre: l.recurso_nombre || l.recurso, p_fuente: l.fuente, p_eventos: ev })) as { nuevas: number; cambiadas: number; canceladas: number; choques: unknown[] };
        res.nuevas += r.nuevas || 0; res.cambiadas += r.cambiadas || 0; res.canceladas += r.canceladas || 0;
        (r.choques || []).forEach((c) => res.choques.push({ negocio: l.negocio, recurso: l.recurso, fuente: l.fuente, ...(c as object) }));
        await rpcServidor(env, "srv_ical_link_estado", { p_negocio: l.negocio, p_recurso: l.recurso, p_url: l.url, p_error: null, p_n: ev.length, p_choques: r.choques || [] });
      } catch (e) {
        res.errores++;
        await rpcServidor(env, "srv_ical_link_estado", { p_negocio: l.negocio, p_recurso: l.recurso, p_url: l.url, p_error: e instanceof Error ? e.message : String(e), p_n: null, p_choques: [] }).catch(() => null);
      }
      res.links++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, lista.length) }, trabajar));
  return res;
}

export async function manejar(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("vento-ical");
  const ruta = i >= 0 ? partes.slice(i + 1) : partes;
  const h = cors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  try {
    const r0 = ruta[0] || "salud";
    if (r0 === "salud") return json(200, { ok: true, servicio: "vento-ical", version: VERSION }, h);
    if (r0 === "cal" && req.method === "GET") {
      const pub = String(ruta[1] || ""), rec = decodeURIComponent(String(ruta[2] || "").replace(/\.ics$/i, ""));
      if (!/^[0-9a-f]{12}$/.test(pub) || !rec || rec.length > 40) return new Response("No existe", { status: 404, headers: h });
      const r = await fetch((env.SUPABASE_URL || "") + "/rest/v1/rpc/reservas_ical_exportar", {
        method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY || "", Authorization: "Bearer " + (env.SUPABASE_ANON_KEY || ""), "Content-Type": "application/json" },
        body: JSON.stringify({ p_publico: pub, p_recurso: rec }),
      });
      if (!r.ok) return new Response("No existe", { status: 404, headers: h });
      const d = await r.json() as { nombre: string; eventos: Array<{ uid: string; desde: string; hasta: string; recurso: string }> };
      const nombreRec = (d.eventos[0] && d.eventos[0].recurso) || ("Habitación " + rec);
      return new Response(armarIcs(d.nombre, nombreRec, d.eventos || []), { status: 200, headers: { ...h, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=300" } });
    }
    if (r0 === "sincronizar" && req.method === "POST") {
      const cron = req.headers.get("x-vento-cron") || "";
      if (cron) {
        if (!env.VENTO_CRON_SECRETO || !igualesSeguro(cron, env.VENTO_CRON_SECRETO)) return json(401, { ok: false, error: "sin_permiso" }, h);
        return json(200, await sincronizar(env, null), h);
      }
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      const anon = req.headers.get("apikey") || env.SUPABASE_ANON_KEY || "";
      if (!jwt || jwt === anon) return json(401, { ok: false, error: "sin_sesion" }, h);
      const neg = await req.json().then((x) => String((x as { negocio?: string }).negocio || "")).catch(() => "");
      if (!/^[0-9a-f-]{36}$/i.test(neg)) return json(400, { ok: false, error: "negocio" }, h);
      const p = await fetch((env.SUPABASE_URL || "") + "/rest/v1/rpc/reservas_ical_puede", { method: "POST", headers: { apikey: anon, Authorization: "Bearer " + jwt, "Content-Type": "application/json" }, body: JSON.stringify({ p_negocio: neg }) });
      if (!p.ok || (await p.json().catch(() => false)) !== true) return json(403, { ok: false, error: "sin_permiso" }, h);
      return json(200, await sincronizar(env, neg), h);
    }
    if (r0 === "leer" && req.method === "POST") {
      // Solo con la sesión de un usuario de ORDEVA (no con la clave pública sola).
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!jwt || jwt === (req.headers.get("apikey") || env.SUPABASE_ANON_KEY || "")) return json(401, { ok: false, error: "sin_sesion" }, h);
      const yo = await fetch((env.SUPABASE_URL || "") + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY || "", Authorization: "Bearer " + jwt } }).catch(() => null);
      if (!yo || !yo.ok) return json(401, { ok: false, error: "sin_sesion" }, h);
      const u = await req.json().then((x) => String((x as { url?: string }).url || "").trim()).catch(() => "");
      if (!hostPermitido(u, env)) return json(400, { ok: false, error: "link_no_permitido", mensaje: "Pega el link de calendario (iCal) que te da Booking, Airbnb u otra plataforma." }, h);
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
      try {
        const r = await fetch(u, { signal: ctl.signal, redirect: "follow", headers: { Accept: "text/calendar, text/plain, */*", "User-Agent": "ORDEVA-Calendario/" + VERSION } });
        if (!hostPermitido(r.url || u, env)) return json(400, { ok: false, error: "link_no_permitido" }, h);
        if (!r.ok) return json(502, { ok: false, error: "plataforma_" + r.status, mensaje: "La plataforma respondió " + r.status + ". Revisa que el link esté bien copiado." }, h);
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length > 1024 * 1024) return json(413, { ok: false, error: "muy_grande" }, h);
        const txt = new TextDecoder().decode(buf);
        if (!/BEGIN:VCALENDAR/i.test(txt)) return json(422, { ok: false, error: "no_es_ical", mensaje: "Ese link no es un calendario iCal." }, h);
        return json(200, { ok: true, ics: txt }, h);
      } finally { clearTimeout(t); }
    }
    return json(404, { ok: false, error: "no_existe" }, h);
  } catch (e) {
    return json(500, { ok: false, error: "interno", mensaje: e instanceof Error ? e.message : String(e) }, h);
  }
}
