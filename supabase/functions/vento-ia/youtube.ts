// Búsqueda de canciones en YouTube SIN gastar el cupo de la API de YouTube.
//
// La API de YouTube (YouTube Data API v3) da 10.000 unidades al día por proyecto y cada búsqueda cuesta 100: con
// ~50 búsquedas desde el QR de las mesas (que buscaba canciones Y artistas en cada búsqueda) YouTube respondía
// «se alcanzó el límite» y ya no se encontraba nada hasta el otro día, en TODOS los negocios.
// Aquí se lee la página pública de resultados de youtube.com (lo mismo que ve cualquier persona, y lo mismo que ya
// hace la app Android de ORDEVA): no tiene cupo. Se responde con la misma forma de la API para que la app no cambie.
//   GET /vento-ia/yt/buscar?q=…&tipo=video|canal|lista
//   GET /vento-ia/yt/lista?id=…   → canciones de una playlist (respaldo: la app las lee primero con la API, que para
//                                    playlists casi no gasta cupo: 1 unidad por cada 50 canciones)

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
// Filtros de la página de resultados: solo videos / solo canales.
const FILTRO: Record<string, string> = { video: "EgIQAQ%3D%3D", canal: "EgIQAg%3D%3D", lista: "EgIQAw%3D%3D" };
const CACHE_MS = 30 * 60e3;
const cache = new Map<string, { t: number; r: Resultado }>();

export type Video = { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } }; duracion: number | null };
export type Canal = { id: { channelId: string }; snippet: { title: string; thumbnails: { default: { url: string } } } };
export type Resultado = { items: Array<Video | Canal | Lista>; fuente: "youtube.com"; titulo?: string };

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

// Saca el objeto ytInitialData de la página. YouTube lo manda de dos formas (va cambiando):
//  • <script id="yt-initial-data" type="application/json">{…}</script>
//  • var ytInitialData = {…};
export function datosIniciales(html: string): any {
  const el = /<script[^>]*id="yt-initial-data"[^>]*>/.exec(html);
  if (el) {
    const fin = html.indexOf("</script>", el.index + el[0].length);
    try { return JSON.parse(html.slice(el.index + el[0].length, fin)); } catch { /* sigue con la otra forma */ }
  }
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

export type Lista = { id: { playlistId: string }; snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } }; canciones: number | null };

// Formato nuevo de YouTube («lockupViewModel»): sirve para videos y playlists.
const primero = (x: any, clave: string, prof = 0): any => {
  if (!x || typeof x !== "object" || prof > 25) return undefined;
  if (Array.isArray(x)) { for (const y of x) { const r = primero(y, clave, prof + 1); if (r !== undefined) return r; } return undefined; }
  if (clave in x) return x[clave];
  for (const k in x) { const r = primero(x[k], clave, prof + 1); if (r !== undefined) return r; }
  return undefined;
};
function deLockup(l: any) {
  const md = (l.metadata && l.metadata.lockupMetadataViewModel) || {};
  const filas = (primero(md, "metadataRows") || []) as any[];
  const partes = filas.flatMap((f: any) => f.metadataParts || []).map((p: any) => (p.text && p.text.content) || "").filter(Boolean);
  const badge = primero(l.contentImage, "thumbnailBadgeViewModel");
  const fuentes = primero(l.contentImage, "sources") || [];
  let foto = String((fuentes[0] && fuentes[0].url) || "");
  if (foto.startsWith("//")) foto = "https:" + foto;
  return { id: String(l.contentId || ""), tipo: String(l.contentType || ""), titulo: String((md.title && md.title.content) || ""), canal: partes[0] || "", badge: String((badge && badge.text) || ""), foto };
}
const numero = (t: string): number | null => { const m = /(\d[\d.,]*)/.exec(String(t || "")); return m ? Number(m[1].replace(/[.,]/g, "")) : null; };

// Recorre los resultados en orden y toma los videos, los canales o las playlists (formato viejo y nuevo).
export function leerResultados(html: string, tipo: "video" | "canal" | "lista", max = 10): Array<Video | Canal | Lista> {
  return leerDatos(datosIniciales(html), tipo, max);
}
export function leerDatos(raiz: any, tipo: "video" | "canal" | "lista", max = 10): Array<Video | Canal | Lista> {
  const out: Array<Video | Canal | Lista> = [], vistos = new Set<string>();
  const visitar = (x: any, prof: number) => {
    if (!x || typeof x !== "object" || out.length >= max || prof > 40) return;
    if (Array.isArray(x)) { for (const y of x) visitar(y, prof + 1); return; }
    const pv = x.playlistVideoRenderer || x.playlistPanelVideoRenderer;
    if (tipo === "video" && pv && pv.videoId) {
      if (!vistos.has(pv.videoId)) {
        vistos.add(pv.videoId);
        out.push({ id: { videoId: pv.videoId }, snippet: { title: texto(pv.title), channelTitle: texto(pv.shortBylineText), thumbnails: { default: { url: miniatura(pv.thumbnail) } } }, duracion: Number(pv.lengthSeconds) || segundos(texto(pv.lengthText)) });
      }
      return;
    }
    if (x.lockupViewModel) {
      const l = deLockup(x.lockupViewModel);
      if (l.id && !vistos.has(l.id)) {
        if (tipo === "video" && /VIDEO/.test(l.tipo)) { vistos.add(l.id); out.push({ id: { videoId: l.id }, snippet: { title: l.titulo, channelTitle: l.canal, thumbnails: { default: { url: l.foto } } }, duracion: segundos(l.badge) }); }
        if (tipo === "lista" && /PLAYLIST|ALBUM|MIX/.test(l.tipo)) { vistos.add(l.id); out.push({ id: { playlistId: l.id }, snippet: { title: l.titulo, channelTitle: l.canal, thumbnails: { default: { url: l.foto } } }, canciones: numero(l.badge) }); }
      }
      return;
    }
    if (tipo === "lista" && x.playlistRenderer && x.playlistRenderer.playlistId) {
      const p = x.playlistRenderer;
      if (!vistos.has(p.playlistId)) {
        vistos.add(p.playlistId);
        out.push({ id: { playlistId: p.playlistId }, snippet: { title: texto(p.title), channelTitle: texto(p.shortBylineText || p.longBylineText), thumbnails: { default: { url: miniatura((p.thumbnails || [])[0]) } } }, canciones: Number(p.videoCount) || null });
      }
      return;
    }
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

// Búsqueda SIN el cupo de Google, por dos caminos (si uno falla o viene vacío, el otro):
//  1. la página pública de resultados (youtube.com/results);
//  2. el mismo servicio interno con el que la página de YouTube pide más resultados (youtubei/v1/search, sin clave de API).
// Si los dos fallan (YouTube caído o bloqueando un rato), se devuelve lo último que se encontró para esa búsqueda, aunque
// sea viejo: mejor una canción de hace un rato que nada.
const VERSION_WEB = "2.20250101.00.00";
export async function buscar(q: string, tipo: "video" | "canal" | "lista", traer: typeof fetch = fetch): Promise<Resultado> {
  const clave = tipo + ":" + q.toLowerCase();
  const c = cache.get(clave);
  if (c && Date.now() - c.t < CACHE_MS) return c.r;
  const h = { "User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9", "Cookie": "CONSENT=YES+1" };
  let items: Array<Video | Canal | Lista> = [], error = "";
  try {
    const r = await traer("https://www.youtube.com/results?hl=es&gl=CO&search_query=" + encodeURIComponent(q) + "&sp=" + FILTRO[tipo], { headers: h });
    if (r.ok) items = leerResultados(await r.text(), tipo, 10); else error = "YouTube respondió " + r.status;
  } catch (e) { error = e instanceof Error ? e.message : String(e); }
  const primeraBien = !error;                               // la página respondió (aunque sin resultados)
  if (!items.length) {
    try {
      const r = await traer("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", { method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: VERSION_WEB, hl: "es", gl: "CO" } }, query: q, params: decodeURIComponent(FILTRO[tipo]) }) });
      if (r.ok) items = leerDatos(await r.json().catch(() => null), tipo, 10); else error = error || "YouTube respondió " + r.status;
    } catch (e) { error = error || (e instanceof Error ? e.message : String(e)); }
  }
  if (!items.length && c) return c.r;                       // lo último que se encontró (aunque sea viejo)
  if (!items.length && error && !primeraBien) throw new Error(error);   // si la página respondió sin resultados: lista vacía
  const res: Resultado = { items, fuente: "youtube.com" };
  if (items.length) { cache.set(clave, { t: Date.now(), r: res }); if (cache.size > 3000) cache.clear(); }
  return res;
}

// La «continuación» de la lista de canciones: el último elemento de la lista que tiene las canciones (en la página
// hay otras continuaciones —recomendados, comentarios— que no sirven).
function tokenDeLista(raiz: any): string | undefined {
  let tok: string | undefined;
  const visitar = (x: any, prof: number) => {
    if (tok || !x || typeof x !== "object" || prof > 40) return;
    if (Array.isArray(x)) {
      const ult = x[x.length - 1];
      if (ult && (ult.continuationItemRenderer || ult.continuationItemViewModel) && x.some((y: any) => y && (y.playlistVideoRenderer || y.lockupViewModel))) {
        const t = primero(ult, "token"); if (t) { tok = String(t); return; }
      }
      for (const y of x) visitar(y, prof + 1);
      return;
    }
    for (const k in x) visitar(x[k], prof + 1);
  };
  visitar(raiz, 0);
  return tok;
}

// Canciones de una playlist (hasta `max`). La página trae las primeras; las demás se piden con la «continuación»
// (lo mismo que hace youtube.com al bajar en la lista).
export async function lista(id: string, traer: typeof fetch = fetch, max = 200): Promise<Resultado> {
  const clave = "lista:" + id;
  const c = cache.get(clave);
  if (c && Date.now() - c.t < CACHE_MS) return c.r;
  const h = { "User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9", "Cookie": "CONSENT=YES+1" };
  const r = await traer("https://www.youtube.com/playlist?hl=es&gl=CO&list=" + encodeURIComponent(id), { headers: h });
  if (!r.ok) throw new Error("YouTube respondió " + r.status);
  const html = await r.text();
  const datos = datosIniciales(html);
  const items = leerDatos(datos, "video", max) as Video[];
  const titulo = String(primero(datos && datos.metadata, "title") || primero(datos && datos.header, "pageTitle") || "");
  const version = (/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(html) || [])[1] || "2.20250101.00.00";
  let token = tokenDeLista(datos && datos.contents);
  for (let n = 0; token && items.length < max && n < 8; n++) {
    const rr = await traer("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", { method: "POST", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: version, hl: "es", gl: "CO" } }, continuation: token }) });
    if (!rr.ok) break;
    const j = await rr.json().catch(() => null);
    const mas = leerDatos(j && j.onResponseReceivedActions, "video", max) as Video[];
    const ya = new Set(items.map((x) => x.id.videoId));
    const nuevos = mas.filter((x) => !ya.has(x.id.videoId));
    if (!nuevos.length) break;
    items.push(...nuevos.slice(0, max - items.length));
    token = tokenDeLista(j && j.onResponseReceivedActions);
  }
  const res: Resultado = { items, fuente: "youtube.com", titulo };
  if (items.length) { cache.set(clave, { t: Date.now(), r: res }); if (cache.size > 3000) cache.clear(); }
  return res;
}
