// Búsqueda de canciones en YouTube SIN gastar el cupo de la API de YouTube.
//
// La API de YouTube (YouTube Data API v3) da 10.000 unidades al día por proyecto y cada búsqueda cuesta 100: con
// ~50 búsquedas desde el QR de las mesas (que buscaba canciones Y artistas en cada búsqueda) YouTube respondía
// «se alcanzó el límite» y ya no se encontraba nada hasta el otro día, en TODOS los negocios.
// Aquí se lee la página pública de resultados de youtube.com (lo mismo que ve cualquier persona, y lo mismo que ya
// hace la app Android de Vento): no tiene cupo. Se responde con la misma forma de la API para que la app no cambie.
//   GET /vento-ia/yt/buscar?q=…&tipo=video|canal

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
// Filtros de la página de resultados: solo videos / solo canales.
const FILTRO: Record<string, string> = { video: "EgIQAQ%3D%3D", canal: "EgIQAg%3D%3D" };
const CACHE_MS = 30 * 60e3;
const cache = new Map<string, { t: number; r: Resultado }>();

export type Video = { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } }; duracion: number | null };
export type Canal = { id: { channelId: string }; snippet: { title: string; thumbnails: { default: { url: string } } } };
export type Resultado = { items: Array<Video | Canal>; fuente: "youtube.com" };

const texto = (x: any): string => !x ? "" : typeof x.simpleText === "string" ? x.simpleText : Array.isArray(x.runs) ? x.runs.map((r: any) => r.text || "").join("") : "";
const miniatura = (x: any): string => {
  const l = (x && x.thumbnails) || [];
  const u = String((l[0] && l[0].url) || "");
  return u.startsWith("//") ? "https:" + u : u;
};
const segundos = (s: string): number | null => {
  const p = String(s || "").split(":").map(Number);
  return p.length > 1 && p.every((n) => !isNaN(n)) ? p.reduce((t, n) => t * 60 + n, 0) : null;
};

// Saca el objeto ytInitialData de la página (JSON dentro de un <script>).
export function datosIniciales(html: string): any {
  const i = html.search(/(?:var |window\["?)ytInitialData"?\]?\s*=\s*\{/);
  if (i < 0) return null;
  const ini = html.indexOf("{", i);
  let d = 0, str = false, esc = false;
  for (let k = ini; k < html.length; k++) {
    const c = html[k];
    if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true;
    else if (c === "{") d++;
    else if (c === "}" && --d === 0) { try { return JSON.parse(html.slice(ini, k + 1)); } catch { return null; } }
  }
  return null;
}

// Recorre los resultados en orden y toma los videos (videoRenderer) o los canales (channelRenderer).
export function leerResultados(html: string, tipo: "video" | "canal", max = 10): Array<Video | Canal> {
  const raiz = datosIniciales(html);
  const out: Array<Video | Canal> = [], vistos = new Set<string>();
  const visitar = (x: any, prof: number) => {
    if (!x || typeof x !== "object" || out.length >= max || prof > 40) return;
    if (Array.isArray(x)) { for (const y of x) visitar(y, prof + 1); return; }
    if (tipo === "video" && x.videoRenderer && x.videoRenderer.videoId) {
      const v = x.videoRenderer;
      if (!vistos.has(v.videoId)) {
        vistos.add(v.videoId);
        out.push({ id: { videoId: v.videoId }, snippet: { title: texto(v.title), channelTitle: texto(v.ownerText || v.longBylineText), thumbnails: { default: { url: miniatura(v.thumbnail) } } }, duracion: segundos(texto(v.lengthText)) });
      }
      return;
    }
    if (tipo === "canal" && x.channelRenderer && x.channelRenderer.channelId) {
      const c = x.channelRenderer;
      if (!vistos.has(c.channelId)) {
        vistos.add(c.channelId);
        out.push({ id: { channelId: c.channelId }, snippet: { title: texto(c.title), thumbnails: { default: { url: miniatura(c.thumbnail) } } } });
      }
      return;
    }
    for (const k in x) visitar(x[k], prof + 1);
  };
  visitar(raiz, 0);
  return out;
}

export async function buscar(q: string, tipo: "video" | "canal", traer: typeof fetch = fetch): Promise<Resultado> {
  const clave = tipo + ":" + q.toLowerCase();
  const c = cache.get(clave);
  if (c && Date.now() - c.t < CACHE_MS) return c.r;
  const url = "https://www.youtube.com/results?hl=es&gl=CO&search_query=" + encodeURIComponent(q) + "&sp=" + FILTRO[tipo];
  const r = await traer(url, { headers: { "User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9", "Cookie": "CONSENT=YES+1" } });
  if (!r.ok) throw new Error("YouTube respondió " + r.status);
  const items = leerResultados(await r.text(), tipo, 10);
  const res: Resultado = { items, fuente: "youtube.com" };
  if (items.length) { cache.set(clave, { t: Date.now(), r: res }); if (cache.size > 3000) cache.clear(); }
  return res;
}
