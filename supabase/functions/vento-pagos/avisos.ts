// Avisos reenviados desde el celular del negocio (método auxiliar, p. ej. MacroDroid):
// «origen | título | texto» de la notificación de la app del banco. Es la misma lectura que hace la app
// (index.html → pgLeer / pgFuente), aquí en el servidor para que quede centralizada.

const APPS: Array<[RegExp, string]> = [[/daviplata/i, "DAVIPLATA"], [/nequi/i, "NEQUI"], [/bancolombia/i, "BANCOLOMBIA"], [/movii/i, "MOVII"], [/\bdale\b/i, "DALE"], [/davivienda/i, "DAVIVIENDA"], [/bre-?b/i, "BRE-B"]];
const SMS = /^(sms|mensajes?|messages?|google messages|mensajes de samsung|samsung messages|mensajes de texto|textra)$/i;

// La misma regla de la app (index.html → PG_PROMO) y de la app Android (AvisoPago.PROMO).
const NUNCA = /solicitud|(?:te|le) pide|(?:te|le) pidi[oó]|(?:te|le) cobr|cobro pendiente|rechazad|fall[oó]|no se pudo|reversad|programad/i;
const FUERTE = /(?:te|le) (?:envi[oó]|enviaron|pas[oó]|pasaron|transfiri[oó]|transfirieron|consign[oó]|consignaron|mand[oó]|mandaron|gir[oó]|giraron|pag[oó]|pagaron)|(?:recibiste|recibi[oó]|ha recibido|has recibido)\s+(?:\$|cop|\d|una transferencia|un pago|dinero|plata)|transferencia recibida|pago recibido|a (?:tu|su) llave|(?:te|le) lleg[oó]\s+(?:\$|cop|\d|plata|dinero)/i;
const PROMO = /¿|pr[eé]stamo|te prestamos|le prestamos|cr[eé]dito (?:de libre|pre|para|f[aá]cil|aprobado|express|r[aá]pido)|tarjeta de cr[eé]dito|colch[oó]n|oferta|promo|descuento|cashback|sorteo|particip|\bgan(?:a|e|ar)\b|aprovecha|beneficio|invit|hasta \$|\bcupo\b|activa tu|desc[aá]rga/i;
// 1.55.1: «Recarga desde Bancolombia» (transferencia de un banco a Nequi) es plata que llegó; nunca la recarga de un celular,
// una fallida o pendiente, ni «Recarga tu Nequi…» (la misma regla de la app: index.html → PG_RECARGA, y de AvisoPago.RECARGA).
const RECARGA = /recarga(?:ste)?\b[^|\n]{0,60}?\b(?:(?:desde|de|por|con)\s+(?:tu\s+|su\s+)?(?:cuenta\s+(?:de\s+)?)?)?(?:bancolombia|davivienda|daviplata|bbva|scotiabank|colpatria|av villas|ita[uú]|banco\s+(?:de\s+)?\w+|pse|otr[oa]s?\s+(?:entidad|banco))\b|recibiste\s+una\s+recarga|(?:te|le)\s+recargaron/i;
const RECARGA_NO = /\brecarga\s+(?:tu|su)\b|celular|minutos|paquete|recarga(?:ste)?\s+(?:de\s+)?(?:datos|plan|m[oó]vil)\b|\b(?:claro|tigo|movistar|wom|virgin|etb|avantel|kalley)\b|(?:a|al|para)\s+(?:el\s+)?(?:n[uú]mero\s+)?(?:\+?57\s?)?3\d{2}\s?\d{3}\s?\d{4}|fallid|no exitosa|pendiente|compraste|compra de/i;

export type Aviso = { monto: number; metodo: string; de: string; confianza: "app" | "revisar" | "falso"; fuente: string };

export function leerAviso(txt: string): Aviso | null {
  const t = String(txt || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // Nequi habla de «tú» («Te llegó plata»); DaviPlata y varios bancos de «usted» («Le llegó plata», «Le pasaron», «Recibió»,
  // «Ha recibido»). Antes el servidor solo entendía la forma de «tú»: los pagos de DaviPlata no llegaban a los demás celulares.
  const recibido = /(recibiste|has recibido|ha recibido|(?:te|le) lleg(?:[oó]|aron)|(?:te|le) pas(?:[oó]|aron)|pasaron plata|(?:te|le) envi(?:[oó]|aron)|(?:te|le) transfiri(?:[oó]|eron)|(?:te|le) pag(?:[oó]|aron)|(?:te|le) consign|(?:te|le) abon|consignaron|abonaron|entr[oó] plata|lleg[oó] plata|ingres[oó]|recibi[oó]|recepci[oó]n|pago recibido|dinero recibido|transferencia recibida|abono a (?:tu|su) cuenta|(?:te|le) mand(?:o|ó|aron)|(?:te|le) gir(?:o|ó|aron)|(?:te|le) deposit|dep[oó]sito recibido|(?:te|le|se) acredit|acredit\w*\s+(?:a|en)\s+(?:tu|su)\s+(?:cuenta|llave|nequi|daviplata)|lleg(?:o|ó|aron)\s+(?:\$|cop|plata|dinero)|a (?:tu|su) llave|(?:recib|lleg|entr|ingres)[^.]{0,40}bre-?b|bre-?b[^.]{0,40}(?:recib|lleg|entr|ingres)|entr[oó] dinero|lleg[oó] dinero)/i.test(t) || (RECARGA.test(t) && !RECARGA_NO.test(t));
  const salida = /(enviaste|pagaste|transferiste|retiraste|compraste|sacaste|usted (?:envi|pag|transfiri|pas)|c[oó]digo|clave din|otp|contrase)/i.test(t);
  if (!recibido || (salida && !/(recibiste|recibi[oó]|ha recibido|(?:te|le) lleg)/i.test(t))) return null;
  // Publicidad del banco que se parece a un pago («¿Te llegó la prima?…», «Te prestamos hasta $5.000.000»): NO es plata.
  if (NUNCA.test(t)) return null;                        // solicitudes, cobros, rechazados: nunca es plata que llegó
  if (PROMO.test(t) && !FUERTE.test(t)) return null;     // un «¿…?» junto a un pago de verdad no lo vuelve publicidad
  const m = t.match(/(?:\$|\bCOP)\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/i) || t.match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:pesos|cop)\b/i) || t.match(/\b(?:recibiste|por|de)\s+(\d{1,3}(?:[.,]\d{3})+)\b/i);
  if (!m) return null;
  const monto = Number(m[1].replace(/[.,]/g, ""));
  if (!(monto > 0)) return null;
  const metodo = (APPS.find(([re]) => re.test(t)) || [null, "TRANSFERENCIA"])[1];
  const NOM = "[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'.]+(?:\\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'.]+){0,3}";
  let de = (t.match(new RegExp("(" + NOM + ")\\s+(?:te|le)\\s+(?:envi|transfiri|pag|pas|consign|abon|mand|gir)")) || [])[1] ||
    (t.match(new RegExp("\\bde\\s+(" + NOM + ")")) || [])[1] || "";
  if (/^(nequi|daviplata|bancolombia|tu|su|la|el|le|dinero|plata|recibiste|te|usted)$/i.test(de.split(" ")[0])) de = "";
  de = de.split(" ").map((x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join(" ");
  const f = fuente(txt);
  return { monto, metodo, de, confianza: f.nivel, fuente: f.txt };
}

// Lo que entendió la app Vento del celular que leyó el aviso (su lectura se actualiza con cada versión y con las frases del
// administrador; la del servidor puede ir atrás: «$ 50 000», «movimiento recibido», «+$20.000»). Llega de un celular
// autorizado por el dueño. El valor de la app manda; «falso» de cualquiera de los dos gana; si no, el nivel de la app
// (p. ej. el dueño eligió confirmar los SMS del banco).
export type Pista = { monto?: unknown; app?: unknown; de?: unknown; nivel?: unknown };
export function conPista(a: Aviso | null, pista: Pista | null, txt: string): Aviso | null {
  const monto = pista ? Number(pista.monto) : 0;
  if (!pista || !Number.isInteger(monto) || monto <= 0 || monto > 100000000) return a;
  const nivel = String(pista.nivel || "");
  const f = fuente(txt);
  const metodo = (APPS.find(([re]) => re.test(String(pista.app || ""))) || APPS.find(([re]) => re.test(txt)) || [null, a ? a.metodo : "TRANSFERENCIA"])[1];
  const confianza = (a && a.confianza === "falso") || nivel === "falso" || f.nivel === "falso" ? "falso"
    : nivel === "app" || nivel === "revisar" ? nivel : (a ? a.confianza : f.nivel);
  const de = String(pista.de || "").replace(/\s+/g, " ").trim().slice(0, 80) || (a ? a.de : "");
  return { monto, metodo, de, confianza, fuente: a ? a.fuente : f.txt };
}

// Una notificación de la APP del banco solo la puede mostrar esa app → confiable.
// Un SMS desde un celular común es falso (los bancos escriben desde códigos cortos); desde un código corto: revisar.
export function fuente(txt: string): { nivel: "app" | "revisar" | "falso"; txt: string } {
  const partes = String(txt || "").split("|").map((x) => x.trim());
  const origen = partes[0] || "", t1 = partes[1] || "";
  const esSms = SMS.test(origen) || /^sms$/i.test(t1);
  if (!esSms) {
    if (/nequi|daviplata|bancolombia|davivienda|movii|\bdale\b|bre-?b|banco|\bnu\b|lulo|rappipay|powwi|ual[aá]|bbva|scotiabank|av villas|colpatria|occidente|popular|caja social/i.test(origen)) return { nivel: "app", txt: "Confirmado por la app de " + origen };
    return { nivel: "revisar", txt: "Aviso de «" + (origen || "otra app") + "»: confírmalo en la app del banco" };
  }
  const quien = /^sms$/i.test(t1) ? "" : t1;
  if (quien.replace(/\D/g, "").length >= 7) return { nivel: "falso", txt: "SMS desde un número de celular (" + quien + "): los bancos no escriben desde celulares" };
  return { nivel: "revisar", txt: "Llegó por SMS" + (quien ? " (" + quien + ")" : "") + ": confírmalo en la app del banco antes de entregar" };
}
