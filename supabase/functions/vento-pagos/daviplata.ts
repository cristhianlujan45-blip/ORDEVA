// API oficial «Pago con DaviPlata» de Davivienda (Developer Portal conectesunegocio.daviplata.com, API 37).
//  • Bases:      laboratorio https://apislab.daviplata.com · producción https://apis.daviplata.com
//                TODAS las llamadas exigen TLS MUTUO (certificado de cliente .cer + llave .pem del Developer Portal);
//                sin él DaviPlata responde 401 «Application is not registered with mutual tls» o «Invalid client certificate is provided».
//  • 1) Token:   POST /oauth2Provider/type1/v1/token  (application/x-www-form-urlencoded)
//                grant_type=client_credentials&client_id=…&client_secret=…&scope=daviplata → {token_type, access_token, expires_in: 900}
//  • 2) Compra:  POST /daviplata/v1/compra   Authorization: Bearer <token>, x-ibm-client-id: <client_id>
//                {"valor": "12000" (texto), "numeroIdentificacion": "…", "tipoDocumento": "01"|"02"|"04"} → {idSessionToken, fechaExpiracionToken}
//                DaviPlata le manda un código OTP por mensaje al celular del CLIENTE.
//  • 3) OTP:     POST /otpSec/v1/read  (SOLO laboratorio) x-ibm-client-id {typeDocument, numberDocument, notificationType: "API_DAVIPLATA"} → {otp}
//  • 4) Confirmar: POST /daviplata/v1/confirmarCompra  (mismas cabeceras que la compra)
//                {otp, idSessionToken, idComercio, idTerminal, idTransaccion: ENTERO 1..999999 único por terminal y por día}
//                → {fechaTransaccion, estado: "Aprobado", numAprobacion, idTransaccionAutorizador}
//  • No hay webhook: la «notificación» del pago es la respuesta «Aprobado» de confirmarCompra (en el mismo momento).
//  • idComercio e idTerminal los asigna Redeban (laboratorio: "0010203040" y "ESB10934").
//  • Laboratorio: lunes a viernes de 8:00 a 17:00 (hora de Colombia). Datos de prueba: CC 01 1134568019 · CE 02 786630 · TI 04 1389123506.
//
//  TLS mutuo, dos modos (se elige en Ajustes → 💜 Pagos → Conectar DaviPlata):
//   • «directo»: Deno.createHttpClient({ cert, key }) desde la Edge Function (si el entorno no lo permite → «mtls_no_disponible»).
//   • «puente»:  un Cloudflare Worker propio (puente/daviplata-worker.js) con el certificado subido a Cloudflare
//                (enlace mtls_certificates) que reenvía SOLO estas 4 rutas; Vento le habla con un secreto compartido.
import { ErrorVento, pedir } from "./util.ts";

export type Ambiente = "sandbox" | "produccion";
export type DaviCred = {
  client_id: string; client_secret: string; cert: string; key: string;
  id_comercio: string; id_terminal: string; puente_secreto?: string;
};
export type DaviConf = { ambiente: Ambiente; transporte: "directo" | "puente"; puente_url?: string | null };
type EnvLike = Record<string, string | undefined>;

export const DAVIPLATA = { sandbox: "https://apislab.daviplata.com", produccion: "https://apis.daviplata.com" };
export const RUTAS = {
  token: "/oauth2Provider/type1/v1/token",
  compra: "/daviplata/v1/compra",
  otp: "/otpSec/v1/read",
  confirmar: "/daviplata/v1/confirmarCompra",
};
export const LAB = { id_comercio: "0010203040", id_terminal: "ESB10934" };
export const TIPOS: Record<string, string> = { "01": "CC", "02": "CE", "04": "TI" };
const MAX_INTENTOS_RED = 0;   // compra y confirmación NO se reintentan solas (no cobrar dos veces)

export function baseDe(amb: Ambiente, env: EnvLike = {}): string {
  return ((amb === "sandbox" ? env.VENTO_DAVIPLATA_URL_SANDBOX : env.VENTO_DAVIPLATA_URL) || DAVIPLATA[amb]).replace(/\/+$/, "");
}

export function confDe(ambiente: string, publico: Record<string, unknown> | null | undefined): DaviConf {
  const p = publico || {};
  return {
    ambiente: ambiente === "produccion" ? "produccion" : "sandbox",
    transporte: p.transporte === "puente" ? "puente" : "directo",
    puente_url: p.puente_url ? String(p.puente_url) : null,
  };
}

// ---------- Transporte (TLS mutuo) ----------
export type Peticion = { url: string; ruta: string; ambiente: Ambiente; headers: Record<string, string>; body: string };
export type Respuesta = { status: number; texto: string; puente_error?: string | null };
export type Transporte = (p: Peticion) => Promise<Respuesta>;

let transportePruebas: Transporte | null = null;
/**
 * SOLO PARA PRUEBAS (Node, pruebas/servidor/daviplata.test.js): reemplaza el envío con TLS mutuo por uno simulado que
 * recibe la petición EXACTA (URL, cabeceras y cuerpo) que iría a DaviPlata. En producción nadie lo llama.
 * `null` vuelve al envío real. También vacía la caché de tokens y de clientes TLS.
 */
export function usarTransportePruebas(t: Transporte | null) { transportePruebas = t; tokens.clear(); clientes.clear(); }

const MSG_MTLS = "Este servidor no puede presentar el certificado de DaviPlata (TLS mutuo). Elige el modo «Por mi puente de Cloudflare» " +
  "en Ajustes → 💜 Pagos → Conectar DaviPlata (ver supabase/LEEME.md → Puente DaviPlata)";

type DenoMtls = { createHttpClient?: (o: Record<string, unknown>) => unknown };
const clientes = new Map<string, unknown>();

function clienteMtls(c: DaviCred): unknown {
  const D = (globalThis as unknown as { Deno?: DenoMtls }).Deno;
  if (!D || typeof D.createHttpClient !== "function") throw new ErrorVento("mtls_no_disponible", MSG_MTLS, 400);
  if (!c.cert || !c.key) throw new ErrorVento("daviplata_certificado", "Falta el certificado (.cer) o la llave (.pem) de DaviPlata", 400);
  const k = c.client_id + "\n" + c.cert + "\n" + c.key;
  if (clientes.has(k)) return clientes.get(k);
  let cli: unknown;
  try { cli = D.createHttpClient({ cert: c.cert, key: c.key }); }
  catch (e1) {
    // Nombres de versiones viejas de Deno.
    try { cli = D.createHttpClient({ certChain: c.cert, privateKey: c.key }); }
    catch { throw new ErrorVento("mtls_no_disponible", MSG_MTLS + ". Detalle: " + String(e1 instanceof Error ? e1.message : e1).slice(0, 160), 400); }
  }
  clientes.set(k, cli);
  return cli;
}

async function enviar(conf: DaviConf, c: DaviCred, env: EnvLike, ruta: string, headers: Record<string, string>, body: string, reintentos = MAX_INTENTOS_RED): Promise<Respuesta> {
  const p: Peticion = { url: baseDe(conf.ambiente, env) + ruta, ruta, ambiente: conf.ambiente, headers, body };
  if (transportePruebas) {
    try { return await transportePruebas(p); }
    catch (e) { if (e instanceof ErrorVento) throw e; throw new ErrorVento("red", "No se pudo conectar: " + (e instanceof Error ? e.message : String(e)), 502); }
  }
  if (conf.transporte === "puente") {
    const u = String(conf.puente_url || "");
    if (!u) throw new ErrorVento("daviplata_puente", "Falta la dirección del puente de DaviPlata (Cloudflare Worker)", 400);
    const r = await pedir(u, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Vento-Puente": c.puente_secreto || "" },
      body: JSON.stringify({ ambiente: p.ambiente, ruta, headers, cuerpo: body }),
      reintentos, tiempo: 25000,
    });
    return { status: r.status, texto: await r.text(), puente_error: r.headers.get("x-puente-error") };
  }
  const client = clienteMtls(c);
  const r = await pedir(p.url, { method: "POST", headers, body, reintentos, tiempo: 25000, client } as RequestInit & { reintentos?: number; tiempo?: number });
  return { status: r.status, texto: await r.text() };
}

// ---------- Errores de DaviPlata en español ----------
// Bogotá es UTC−5 todo el año (sin horario de verano).
export function enHorarioLab(d: Date = new Date()): boolean {
  const b = new Date(d.getTime() - 5 * 3600e3);
  const dia = b.getUTCDay(), h = b.getUTCHours();
  return dia >= 1 && dia <= 5 && h >= 8 && h < 17;
}

export function mensajeNoDisponible(amb: Ambiente, ahora: Date = new Date()): string {
  if (amb === "sandbox" && !enHorarioLab(ahora)) return "El laboratorio de DaviPlata solo atiende de lunes a viernes de 8:00 a 17:00 (hora de Colombia). Prueba en ese horario.";
  return "DaviPlata no está disponible en este momento. Intenta de nuevo en unos minutos.";
}

function leer(texto: string): Record<string, unknown> | null {
  try { const j = JSON.parse(texto); return j && typeof j === "object" ? j as Record<string, unknown> : null; } catch { return null; }
}
const limpio = (s: unknown) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

export function traducir(paso: "token" | "compra" | "otp" | "confirmar", r: Respuesta, amb: Ambiente, ahora: Date = new Date()): ErrorVento {
  const j = leer(r.texto) || {};
  const codigo = limpio(j.codigoError ?? j.errorCode ?? j.httpCode ?? "");
  const mensaje = limpio(j.mensajeError ?? j.errorMessage ?? j.moreInformation ?? j.httpMessage ?? j.error_description ?? j.error ?? (leer(r.texto) ? "" : r.texto));
  const todo = (codigo + " " + mensaje + " " + (leer(r.texto) ? "" : r.texto)).toLowerCase();
  if (r.puente_error) {
    const pe = r.puente_error;
    if (pe === "secreto") return new ErrorVento("daviplata_puente", "El puente de DaviPlata rechazó el secreto: pega en Vento el mismo VENTO_PUENTE_SECRETO del Worker", 400);
    if (pe === "sin_certificado") return new ErrorVento("daviplata_puente", "Al puente de DaviPlata le falta el certificado (enlace mtls_certificates «DAVIPLATA» en Cloudflare)", 400);
    if (pe === "sin_secreto") return new ErrorVento("daviplata_puente", "Al puente de DaviPlata le falta el secreto VENTO_PUENTE_SECRETO (wrangler secret put)", 400);
    if (pe === "red") return new ErrorVento("daviplata_no_disponible", mensajeNoDisponible(amb, ahora), 502);
    return new ErrorVento("daviplata_puente", "El puente de DaviPlata respondió «" + limpio(pe) + "»", 502);
  }
  if (/mutual tls/.test(todo)) return new ErrorVento("daviplata_mtls", "Tu aplicación del Developer Portal de DaviPlata no tiene el certificado cargado (TLS mutuo). Cárgalo en conectesunegocio.daviplata.com", 400);
  if (/client certificate/.test(todo)) return new ErrorVento("daviplata_certificado", "DaviPlata rechazó el certificado: usa el .cer y la llave .pem que descargaste del Developer Portal para este ambiente (" + (amb === "sandbox" ? "laboratorio" : "producción") + ")", 400);
  if (/invalid_client|invalid client|client id or secret|id del cliente/.test(todo)) return new ErrorVento("daviplata_credenciales", "DaviPlata rechazó el Client ID o el Client Secret", 400);
  if (/invalid_scope|invalid scope/.test(todo)) return new ErrorVento("daviplata_scope", "Tu aplicación no tiene el producto «Pago con DaviPlata» (scope daviplata): inscríbela en el API Market del Developer Portal", 400);
  if (paso === "token" && (r.status === 400 || r.status === 401)) return new ErrorVento("daviplata_credenciales", "DaviPlata no entregó el token: revisa el Client ID y el Client Secret", 400);
  if (/saldo insuficiente/.test(todo)) return new ErrorVento("daviplata_saldo", "El DaviPlata del cliente no tiene saldo suficiente para este cobro", 400);
  if (codigo === "1304" || codigo === "321" || /daviplata inv[aá]lido|producto no existe/.test(todo)) return new ErrorVento("daviplata_documento", "Ese documento no tiene DaviPlata: revisa el tipo y el número", 400);
  if (codigo === "4001" || /no existe en la cache/.test(todo)) return new ErrorVento("daviplata_vencido", "El código de DaviPlata venció: crea un cobro nuevo", 400);
  if (paso === "confirmar" && (codigo === "401" || /autenticaci[oó]n denegada/.test(todo))) return new ErrorVento("daviplata_otp", "El código no es correcto", 400);
  if (r.status === 403) return new ErrorVento("daviplata_scope", "DaviPlata no dejó usar «Pago con DaviPlata» con esta aplicación (permiso o scope)", 400);
  if (r.status === 422 || /vac[ií]o|validate rest/.test(todo)) return new ErrorVento("daviplata_datos", "DaviPlata rechazó los datos enviados" + (mensaje ? ": " + mensaje : ""), 400);
  if (r.status >= 500 || ["91", "2100", "2103", "3200", "6842"].includes(codigo) || /no responde|no disponible|timeout/.test(todo)) {
    return new ErrorVento("daviplata_no_disponible", mensajeNoDisponible(amb, ahora), 502);
  }
  if (r.status === 401) return new ErrorVento("daviplata_acceso", "DaviPlata rechazó el acceso (token)", 400);
  return new ErrorVento("daviplata_error", "DaviPlata respondió " + r.status + (mensaje ? ": " + mensaje : ""), 502);
}

// ---------- Validaciones ----------
export function pareceCertificado(s: string): boolean { return /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(s || ""); }
export function pareceLlave(s: string): boolean { return /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]+-----END (RSA |EC )?PRIVATE KEY-----/.test(s || ""); }

// Dirección del puente: solo https a un nombre de dominio público. Nada de localhost, IPs ni nombres internos: el servidor
// le manda el Client ID y el Client Secret, así que no puede servir para hablarle a la red interna del servidor (SSRF).
// http://localhost solo con VENTO_DAVIPLATA_PUENTE_LOCAL=1 (pruebas automáticas).
export function puenteValido(u: string, env: EnvLike = {}): boolean {
  let x: URL;
  try { x = new URL(u); } catch { return false; }
  if (x.username || x.password || x.search || x.hash) return false;
  const h = x.hostname.toLowerCase();
  if (env.VENTO_DAVIPLATA_PUENTE_LOCAL === "1" && (h === "localhost" || h === "127.0.0.1") && /^https?:$/.test(x.protocol)) return true;
  if (x.protocol !== "https:") return false;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return false;                       // sin IPv6 ni nombres de una sola palabra
  if (/^\d+(\.\d+){3}$/.test(h) || /^\d+$/.test(h.split(".").pop() || "")) return false;  // sin IPs (ni 0x7f.1, 2130706433…)
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|svc|cluster)$/.test(h)) return false;
  return true;
}

export function revisar(c: DaviCred, conf: DaviConf, env: EnvLike = {}): string[] {
  const p: string[] = [];
  if (!c.client_id) p.push("Falta el Client ID");
  if (!c.client_secret) p.push("Falta el Client Secret");
  if (!/^[0-9A-Za-z]{1,20}$/.test(c.id_comercio || "")) p.push("Falta el código de comercio (idComercio) que asigna Redeban");
  if (!/^[0-9A-Za-z]{1,20}$/.test(c.id_terminal || "")) p.push("Falta el código de terminal (idTerminal) que asigna Redeban");
  if (conf.transporte === "directo") {
    if (!pareceCertificado(c.cert)) p.push("El certificado no parece un .cer/.pem (debe decir BEGIN CERTIFICATE)");
    if (/ENCRYPTED PRIVATE KEY/.test(c.key || "")) p.push("La llave tiene contraseña: expórtala sin contraseña");
    else if (!pareceLlave(c.key)) p.push("La llave no parece un .pem (debe decir BEGIN PRIVATE KEY)");
    if ((c.cert || "").length > 20000 || (c.key || "").length > 20000) p.push("El certificado o la llave son demasiado grandes");
  } else {
    const u = String(conf.puente_url || "");
    if (!puenteValido(u, env)) p.push("La dirección del puente debe ser la de tu Worker de Cloudflare (https://…workers.dev o tu dominio), sin IPs ni direcciones internas");
    if ((c.puente_secreto || "").length < 16) p.push("El secreto del puente debe tener al menos 16 caracteres");
  }
  return p;
}

// Tipo (CC/CE/TI o 01/02/04) y número (solo dígitos, sin espacios, máx. 14). Devuelve también la versión enmascarada.
export function normalizarDocumento(tipo: unknown, numero: unknown): { tipo: string; numero: string; mascara: string } {
  const t0 = String(tipo ?? "").trim().toUpperCase();
  const t = ({ CC: "01", CE: "02", TI: "04", "1": "01", "2": "02", "4": "04" } as Record<string, string>)[t0] || t0;
  if (!TIPOS[t]) throw new ErrorVento("documento_tipo", "Elige el tipo de documento: CC, CE o TI", 400);
  const n = String(numero ?? "").replace(/[\s.\-]/g, "");
  if (!/^\d{3,14}$/.test(n)) throw new ErrorVento("documento_invalido", "Escribe el número de documento del cliente (solo números, máximo 14)", 400);
  return { tipo: t, numero: n, mascara: TIPOS[t] + " •••" + n.slice(-4) };
}

// «2020-05-14T16:30:05.137-05:00» → ISO. Sin zona horaria se toma como hora de Colombia.
export function fechaDe(s: unknown): string | null {
  const x = String(s ?? "").trim();
  if (!x) return null;
  const conZona = /([zZ]|[+-]\d\d:?\d\d)$/.test(x) ? x : x + "-05:00";
  const t = Date.parse(conZona);
  return isNaN(t) ? null : new Date(t).toISOString();
}

// ---------- Token OAuth2 (en caché por proceso hasta expires_in − 60 s) ----------
const tokens = new Map<string, { token: string; vence: number }>();
// La llave incluye el secreto: otro negocio que escriba el mismo Client ID (sin el secreto) nunca reutiliza este token.
const llaveToken = (conf: DaviConf, c: DaviCred) => conf.ambiente + ":" + conf.transporte + ":" + (conf.puente_url || "") + ":" + c.client_id + ":" + c.client_secret;

export async function token(conf: DaviConf, c: DaviCred, env: EnvLike = {}, forzar = false): Promise<string> {
  const k = llaveToken(conf, c);
  const t = tokens.get(k);
  if (!forzar && t && t.vence > Date.now()) return t.token;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: c.client_id, client_secret: c.client_secret, scope: "daviplata" }).toString();
  const r = await sinRed(conf, () => enviar(conf, c, env, RUTAS.token, { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, 1));
  const j = leer(r.texto);
  if (r.status !== 200 || r.puente_error || !j || !j.access_token) throw traducir("token", r, conf.ambiente);
  const seg = Number(j.expires_in) || 900;
  tokens.set(k, { token: String(j.access_token), vence: Date.now() + Math.max(30, seg - 60) * 1000 });
  return String(j.access_token);
}

// Sin conexión con DaviPlata (o con el puente): se explica en español (y el horario del laboratorio).
async function sinRed<T>(conf: DaviConf, f: () => Promise<T>): Promise<T> {
  try { return await f(); }
  catch (e) {
    if (e instanceof ErrorVento && e.codigo === "red") throw new ErrorVento("daviplata_no_disponible", mensajeNoDisponible(conf.ambiente), 502);
    throw e;
  }
}

// 401 del portal de APIs por token vencido o inválido (no es un error de DaviPlata ni del certificado).
function tokenRechazado(r: Respuesta): boolean {
  if (r.status !== 401 || r.puente_error) return false;
  const j = leer(r.texto) || {};
  if (j.codigoError !== undefined) return false;
  return !/mutual tls|client certificate|client id|autenticaci/i.test(r.texto);
}

async function conToken(conf: DaviConf, c: DaviCred, env: EnvLike, ruta: string, cuerpo: Record<string, unknown>): Promise<Respuesta> {
  const cab = (tok: string) => ({ Authorization: "Bearer " + tok, "x-ibm-client-id": c.client_id, "Content-Type": "application/json", Accept: "application/json" });
  let r = await enviar(conf, c, env, ruta, cab(await token(conf, c, env)), JSON.stringify(cuerpo));
  if (tokenRechazado(r)) {
    // El portal rechazó el token antes de llegar a DaviPlata: se pide otro y se repite UNA vez (no se cobró nada).
    tokens.delete(llaveToken(conf, c));
    r = await enviar(conf, c, env, ruta, cab(await token(conf, c, env, true)), JSON.stringify(cuerpo));
  }
  return r;
}

// Comprueba las credenciales y el certificado sin cobrar nada: pide un token nuevo.
export async function verificar(conf: DaviConf, c: DaviCred, env: EnvLike = {}): Promise<true> {
  await token(conf, c, env, true);
  return true;
}

// 2) Compra: DaviPlata manda el código al celular del cliente.
export async function compra(conf: DaviConf, c: DaviCred, o: { monto: number; tipo: string; numero: string }, env: EnvLike = {}) {
  const r = await sinRed(conf, () => conToken(conf, c, env, RUTAS.compra, { valor: String(Math.round(o.monto)), numeroIdentificacion: o.numero, tipoDocumento: o.tipo }));
  const j = leer(r.texto);
  if (r.status !== 200 || r.puente_error || !j || !j.idSessionToken) throw traducir("compra", r, conf.ambiente);
  return { id_sesion: String(j.idSessionToken), expira: fechaDe(j.fechaExpiracionToken) };
}

// 3) Solo laboratorio: el código de prueba que «le llegó» al cliente.
export async function leerOtp(conf: DaviConf, c: DaviCred, tipo: string, numero: string, env: EnvLike = {}): Promise<string | null> {
  if (conf.ambiente !== "sandbox") return null;
  const r = await enviar(conf, c, env, RUTAS.otp, { "x-ibm-client-id": c.client_id, "Content-Type": "application/json", Accept: "application/json" },
    JSON.stringify({ typeDocument: tipo, numberDocument: numero, notificationType: "API_DAVIPLATA" }));
  const j = leer(r.texto);
  return r.status === 200 && j && j.otp && /^\d{4,8}$/.test(String(j.otp)) ? String(j.otp) : null;
}

// 4) Confirmar con el código. «Aprobado» = pago hecho (es la notificación del pago).
//  Si NO se sabe qué pasó con confirmarCompra (se cortó la red o venció el tiempo después de mandarla, el puente no
//  alcanzó a DaviPlata, DaviPlata respondió un error interno/timeout o algo ilegible), DaviPlata PUDO haber aprobado:
//  se lanza «daviplata_sin_respuesta» (incierto) y nunca un error que haga creer que el cobro no se hizo.
//  Los errores ANTES de mandar confirmarCompra (token, certificado, puente mal configurado) sí son seguros.
const SEGUROS = new Set(["daviplata_otp", "daviplata_vencido", "daviplata_documento", "daviplata_saldo", "daviplata_datos", "daviplata_mtls",
  "daviplata_certificado", "daviplata_credenciales", "daviplata_scope", "daviplata_acceso"]);
const PUENTE_SEGUROS = new Set(["secreto", "sin_secreto", "sin_certificado", "ruta", "pedido"]);
export const MSG_INCIERTO = "DaviPlata no respondió y no se sabe si aprobó el pago. Pregúntale al cliente si le llegó el mensaje de compra aprobada " +
  "o si se le descontó: si NO, toca otra vez «Confirmar pago» con el mismo código; si SÍ, no le cobres otra vez";

function incierto(detalle: string): ErrorVento {
  return new ErrorVento("daviplata_sin_respuesta", MSG_INCIERTO + (detalle ? " (" + limpio(detalle) + ")" : ""), 502);
}

export async function confirmar(conf: DaviConf, c: DaviCred, o: { otp: string; id_sesion: string; id_transaccion: number }, env: EnvLike = {}) {
  if (!Number.isInteger(o.id_transaccion) || o.id_transaccion < 1 || o.id_transaccion > 999999) throw new ErrorVento("daviplata_consecutivo", "Número de transacción fuera de rango", 500);
  const cuerpo = JSON.stringify({ otp: o.otp, idSessionToken: o.id_sesion, idComercio: c.id_comercio, idTerminal: c.id_terminal, idTransaccion: o.id_transaccion });
  const cab = (tok: string) => ({ Authorization: "Bearer " + tok, "x-ibm-client-id": c.client_id, "Content-Type": "application/json", Accept: "application/json" });
  // El envío de confirmarCompra: un fallo de red aquí es INCIERTO (pudo llegar). Lo demás (sin certificado, sin puente) es seguro.
  const mandar = async (tok: string) => {
    try { return await enviar(conf, c, env, RUTAS.confirmar, cab(tok), cuerpo); }
    catch (e) { if (e instanceof ErrorVento && e.codigo === "red") throw incierto(e.message); throw e; }
  };
  let r = await mandar(await sinRed(conf, () => token(conf, c, env)));
  if (tokenRechazado(r)) {
    // El portal rechazó el token antes de llegar a DaviPlata: se pide otro y se repite UNA vez (no se cobró nada).
    tokens.delete(llaveToken(conf, c));
    r = await mandar(await sinRed(conf, () => token(conf, c, env, true)));
  }
  const j = leer(r.texto);
  if (r.status === 200 && !r.puente_error && j && j.estado !== undefined) {
    const estado = limpio(j.estado);
    if (!/^aprobad[oa]$/i.test(estado)) throw new ErrorVento("daviplata_rechazo", "DaviPlata no aprobó el pago (" + (estado || "sin estado") + ")", 400);
    return {
      estado, fecha: fechaDe(j.fechaTransaccion), num: limpio(j.numAprobacion), autorizador: limpio(j.idTransaccionAutorizador),
    };
  }
  const e = traducir("confirmar", r, conf.ambiente);
  if (r.puente_error ? PUENTE_SEGUROS.has(r.puente_error) : SEGUROS.has(e.codigo)) throw e;
  throw incierto(e.message);
}
