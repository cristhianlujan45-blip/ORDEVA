// ORDEVA 1.76.0 · 🔗 vento-ical: el calendario de las habitaciones con Booking, Airbnb y otras plataformas (iCal).
//  GET  /vento-ical/salud
//  GET  /vento-ical/cal/<publico>/<habitación>.ics → el calendario de ORDEVA para pegar en Booking / Airbnb. Solo las
//       fechas ocupadas («Reservado - ORDEVA»): nunca el nombre, el celular ni nada del cliente.
//  POST /vento-ical/leer {url} → trae el calendario de Booking / Airbnb para la app (el navegador no puede leerlo directo).
//       Solo deja leer las plataformas conocidas, por https, hasta 1 MB y con tiempo límite: no sirve para leer otras páginas.
import type { Env } from "../vento-pagos/util.ts";

const VERSION = "1.76.0";
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
