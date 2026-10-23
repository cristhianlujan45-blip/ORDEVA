// Supabase Edge Function «vento-ia»: la IA de ORDEVA YA CONFIGURADA para todos los negocios.
//
// La app (GitHub Pages / APK) no lleva ninguna clave. Cuando un negocio no puso su propia clave de Gemini,
// la app le pide aquí: esta función agrega la clave del PROVEEDOR (secreto GEMINI_API_KEY del servidor, que
// se carga desde GitHub → Settings → Secrets → GEMINI_API_KEY) y reenvía la petición tal cual a Gemini.
//
// Rutas:
//   GET  /vento-ia/salud                                   → { ok, gemini }  (¿hay clave en el servidor?)
//   GET  /vento-ia/v1beta/models?pageSize=…                → lista de modelos
//   GET  /vento-ia/v1beta/models/<modelo>                  → (calentar conexión)
//   POST /vento-ia/v1beta/models/<modelo>:generateContent
//   POST /vento-ia/v1beta/models/<modelo>:streamGenerateContent?alt=sse
//   GET  /vento-ia/yt/buscar?q=…&tipo=video|canal|lista    → canciones/artistas/playlists de YouTube SIN gastar cupo (youtube.ts)
//   GET  /vento-ia/yt/lista?id=…                           → canciones de una playlist de YouTube, sin cupo
// Solo se aceptan pedidos desde la página de ORDEVA (VENTO_ORIGENES), modelos «gemini-…», cuerpos de hasta
// 8 MB (fotos de facturas) y un máximo de pedidos por minuto por IP, para que nadie más gaste la clave.

import * as YT from "./youtube.ts";

const GEMINI = "https://generativelanguage.googleapis.com";
const MAX_BYTES = 8 * 1024 * 1024;
const POR_MINUTO = 40;
const visitas = new Map<string, number[]>();

function origenes(): string[] {
  return String(Deno.env.get("VENTO_ORIGENES") || "").split(",").map((s) => s.trim()).filter(Boolean);
}
function cors(origin: string): Record<string, string> {
  const ok = !origenes().length || origenes().includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? (origin || "*") : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
const json = (o: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(o), { status, headers: { ...h, "content-type": "application/json" } });

// 1.57.0 (auditoría ORDEVA R7): el límite de verdad está en la base de datos (srv_ia_cupo), compartido por todas las
// instancias: por conexión (minuto y día) y un tope del día para toda la IA de ORDEVA (la clave del proveedor). Si la base
// no responde, queda el de memoria de abajo (la IA no se cae por eso).
async function cupo(clave: string, porMin: number, porDia: number): Promise<{ ok: boolean; tope?: string } | null> {
  const url = Deno.env.get("SUPABASE_URL"), sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !sk) return null;
  try {
    const r = await fetch(url.replace(/\/+$/, "") + "/rest/v1/rpc/srv_ia_cupo", { method: "POST", headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" },
      body: JSON.stringify({ p_clave: clave, p_max_min: porMin, p_max_dia: porDia }), signal: AbortSignal.timeout(2500) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function sinCupo(ip: string): Promise<string | null> {
  const n = (k: string, d: number) => Number(Deno.env.get(k) || d);
  const c = await cupo("vento-ia:" + ip, n("VENTO_IA_IP_MIN", POR_MINUTO), n("VENTO_IA_IP_DIA", 600));
  if (c && !c.ok) return c.tope === "dia" ? "Llegaste al límite de hoy de la IA de ORDEVA en esta conexión. Pon tu propia clave de Gemini en Ajustes → IA, o vuelve mañana." : "Demasiadas peticiones seguidas. Espera un momento.";
  if (!c && demasiados(ip)) return "Demasiadas peticiones seguidas. Espera un momento.";
  const g = await cupo("vento-ia:todos", 0, n("VENTO_IA_DIA", 20000));
  if (g && !g.ok) return "La IA de ORDEVA llegó al límite de hoy. Pon tu propia clave de Gemini en Ajustes → IA, o vuelve mañana.";
  return null;
}

function demasiados(ip: string): boolean {
  const ahora = Date.now(), l = (visitas.get(ip) || []).filter((t) => ahora - t < 60000);
  l.push(ahora); visitas.set(ip, l);
  if (visitas.size > 5000) visitas.clear();
  return l.length > POR_MINUTO;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  const key = Deno.env.get("GEMINI_API_KEY") || "";
  const u = new URL(req.url);
  const ruta = u.pathname.replace(/^.*?\/vento-ia/, "");
  if (ruta === "/salud" || ruta === "" || ruta === "/") return json({ ok: true, gemini: !!key }, 200, h);
  if (origin && origenes().length && !origenes().includes(origin)) return json({ error: { message: "Origen no permitido." } }, 403, h);
  // Buscar canciones en YouTube sin gastar el cupo de la API de YouTube (ver youtube.ts). No necesita la clave de Gemini.
  if (ruta === "/yt/buscar" && req.method === "GET") {
    const q = String(u.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const t0 = u.searchParams.get("tipo");
    const tipo = t0 === "canal" ? "canal" : t0 === "lista" ? "lista" : "video";
    if (q.length < 2) return json({ items: [] }, 200, h);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "?";
    if (demasiados("yt:" + ip)) return json({ error: { code: 429, message: "Demasiadas búsquedas seguidas. Espera un momento." } }, 429, h);
    try {
      return json(await YT.buscar(q, tipo), 200, { ...h, "cache-control": "public, max-age=600" });
    } catch (e) {
      return json({ error: { code: 502, message: "No se pudo buscar en YouTube: " + (e instanceof Error ? e.message : String(e)) } }, 502, h);
    }
  }
  // Canciones de una playlist de YouTube (sin cupo).
  if (ruta === "/yt/lista" && req.method === "GET") {
    const id = String(u.searchParams.get("id") || "").replace(/[^\w-]/g, "").slice(0, 60);
    if (id.length < 10) return json({ error: { code: 400, message: "Esa no es una playlist de YouTube." } }, 400, h);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "?";
    if (demasiados("yt:" + ip)) return json({ error: { code: 429, message: "Demasiadas búsquedas seguidas. Espera un momento." } }, 429, h);
    try {
      return json(await YT.lista(id), 200, { ...h, "cache-control": "public, max-age=600" });
    } catch (e) {
      return json({ error: { code: 502, message: "No se pudo leer la playlist: " + (e instanceof Error ? e.message : String(e)) } }, 502, h);
    }
  }
  if (!key) return json({ error: { message: "La IA de ORDEVA todavía no tiene clave en el servidor (secreto GEMINI_API_KEY)." } }, 503, h);
  const m = /^\/v1beta\/models(?:\/(gemini-[\w.-]+)(:generateContent|:streamGenerateContent)?)?$/.exec(ruta);
  if (!m || (req.method === "POST" && !m[2]) || (req.method === "GET" && m[2])) return json({ error: { message: "Ruta no permitida." } }, 404, h);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "?";
  const no = req.method === "POST" ? await sinCupo(ip) : (demasiados(ip) ? "Demasiadas peticiones seguidas. Espera un momento." : null);   // solo las preguntas (POST) gastan cupo
  if (no) return json({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: no } }, 429, h);
  let cuerpo: string | undefined;
  if (req.method === "POST") {
    cuerpo = await req.text();
    if (cuerpo.length > MAX_BYTES) return json({ error: { message: "La foto es demasiado grande." } }, 413, h);
  }
  const q = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (k === "alt" || k === "pageSize" || k === "pageToken") q.set(k, v);
  const destino = GEMINI + ruta + (q.toString() ? "?" + q.toString() : "");
  const r = await fetch(destino, {
    method: req.method,
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: cuerpo,
  });
  const out = new Headers(h);
  out.set("content-type", r.headers.get("content-type") || "application/json");
  out.set("cache-control", "no-store");
  return new Response(r.body, { status: r.status, headers: out });
});
