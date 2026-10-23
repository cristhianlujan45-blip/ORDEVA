// =====================================================================
//  Facturación electrónica DIAN por MATIAS API (proveedor tecnológico autorizado; ORDEVA como casa de software)
//   • armar(): de una venta de la app al JSON de MATIAS (P.O.S. electrónico tipo 20, factura tipo 7, notas 94 / 5).
//     Los precios de la app traen el impuesto por dentro: aquí se separan base e impuesto (IVA o INC) línea por línea,
//     con 2 decimales y sumas que cuadran (la DIAN revisa la aritmética: FAS01A, DEAS07…).
//   • enviar(): POST a MATIAS y lectura de la respuesta (aceptado / rechazado / en proceso). Ante un tiempo agotado o
//     un error del servidor NUNCA se reenvía a ciegas: primero se consulta si la DIAN ya lo tiene (GET /status).
//   • Token: MATIAS_TOKEN (token personal) o MATIAS_EMAIL + MATIAS_PASSWORD (inicia sesión y guarda el token cifrado,
//     se renueva solo). Nada de esto llega a la app ni a los registros.
// =====================================================================
import type { Db } from "./db.ts";
import { cifrar, descifrar } from "./cifrado.ts";
import { type Env, ErrorVento, log } from "./util.ts";

export const SANDBOX = "https://sandbox-api.matias-api.com/api/ubl2.1";

// Catálogos de MATIAS (ids de su base, NO los códigos DIAN): GET /document-type, /payment-means, /quantity-units,
// /taxes, /correction-notes, /identity-documents (revisados en el sandbox).
export const TIPO_DOC = { factura: 7, pos: 20, nota_pos: 94, nota_factura: 5 } as const;
export const IMPUESTO = { iva: "1", inc: "4" } as const;
const UNIDAD: Record<string, string> = { und: "1093", kg: "767", lb: "802", g: "692", l: "821" };
const MEDIO: Record<string, number> = { efectivo: 10, nequi: 31, daviplata: 31, transferencia: 31, breb: 31, bancolombia: 31, tarjeta: 48, datafono: 48, debito: 49, credito: 48, bono: 76, vale: 77 };
const IDENTIDAD: Record<string, number> = { CC: 1, CE: 2, NIT: 3, RC: 6, TI: 7, PP: 5, PEP: 10, DIE: 9 };

export type Cfg = {
  negocio_id: string; negocio_nombre?: string; activo: boolean; client_uuid?: string | null;
  razon_social?: string | null; nit?: string | null; dv?: string | null; direccion?: string | null; correo?: string | null;
  impuesto: "ninguno" | "iva" | "inc"; tarifa: number;
  pos_resolucion?: string | null; pos_prefijo?: string; pos_desde?: number | null; pos_hasta?: number | null; pos_siguiente?: number | null; pos_vence?: string | null;
  fe_resolucion?: string | null; fe_prefijo?: string; fe_desde?: number | null; fe_hasta?: number | null; fe_siguiente?: number | null; fe_vence?: string | null;
  nc_prefijo?: string; caja?: string;
};
export type Item = { name: string; qty: number; price: number; unidad?: string | null; codigo?: string | null; tarifa?: number | null };
export type Cliente = { tipo?: string; numero?: string; dv?: string; nombre?: string; correo?: string; telefono?: string; direccion?: string };
export type Venta = { id: string; fecha?: string; items: Item[]; payments?: Array<{ method?: string; amount?: number }>; total?: number;
  cliente?: Cliente | null; factura?: boolean; cajero?: string | null; mesa?: string | null; nota?: string | null };
export type Doc = { id: string; negocio_id: string; venta_id: string; tipo: "pos" | "factura" | "nota"; referencia_id?: string | null; prefijo: string; numero: number;
  resolucion?: string | null; estado: string; total: number; cliente?: Cliente | null; cuerpo?: Record<string, unknown> | null; cude?: string | null; qr?: string | null;
  pdf?: string | null; mensaje?: string | null; errores?: string[]; intentos: number; creado_en: string; aceptado_en?: string | null };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const d2 = (n: number) => r2(n).toFixed(2);
const limpio = (t: unknown, max = 200) => String(t ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const soloDig = (t: unknown) => String(t ?? "").replace(/\D/g, "");
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fecha y hora de Colombia (la DIAN las quiere en hora local).
export function fechaBogota(iso?: string | null): { fecha: string; hora: string } {
  const t = iso ? new Date(iso) : new Date();
  const d = isNaN(t.getTime()) ? new Date() : t;
  const b = new Date(d.getTime() - 5 * 3600e3);
  return { fecha: b.toISOString().slice(0, 10), hora: b.toISOString().slice(11, 19) };
}

// ---------- Validar lo que manda la app ----------
export function leerVenta(v: unknown): Venta {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const id = limpio(o.id, 80);
  if (!id) throw new ErrorVento("dian_venta_invalida", "Falta el número de la venta", 400);
  const items = Array.isArray(o.items) ? o.items : [];
  if (!items.length || items.length > 300) throw new ErrorVento("dian_venta_invalida", "La venta no tiene productos", 400);
  const its: Item[] = items.map((x) => {
    const i = (x || {}) as Record<string, unknown>;
    const qty = Number(i.qty), price = Number(i.price);
    if (!isFinite(qty) || qty <= 0 || qty > 100000 || !isFinite(price) || Math.abs(price) > 100000000) throw new ErrorVento("dian_venta_invalida", "Hay un producto con cantidad o precio inválido", 400);
    const u = String(i.unidad || "").toLowerCase();
    const t = i.tarifa == null || i.tarifa === "" ? null : Number(i.tarifa);
    return { name: limpio(i.name, 150) || "Producto", qty: Math.round(qty * 1000) / 1000, price: Math.round(price), unidad: UNIDAD[u] ? u : null,
      codigo: limpio(i.codigo, 40) || null, tarifa: t != null && [0, 5, 8, 19].includes(t) ? t : null };
  });
  let cliente: Cliente | null = null;
  if (o.cliente && typeof o.cliente === "object") {
    const c = o.cliente as Record<string, unknown>;
    const numero = soloDig(c.numero);
    if (numero) {
      const tipo = String(c.tipo || "CC").toUpperCase();
      cliente = { tipo: IDENTIDAD[tipo] ? tipo : "CC", numero: numero.slice(0, 15), dv: soloDig(c.dv).slice(0, 1) || undefined, nombre: limpio(c.nombre, 120) || undefined,
        correo: CORREO.test(String(c.correo || "").trim()) ? String(c.correo).trim().slice(0, 120) : undefined, telefono: soloDig(c.telefono).slice(0, 15) || undefined,
        direccion: limpio(c.direccion, 160) || undefined };
    }
  }
  const pays = Array.isArray(o.payments) ? (o.payments as Array<Record<string, unknown>>).slice(0, 20).map((p) => ({ method: String(p.method || "efectivo").toLowerCase(), amount: Math.max(0, Number(p.amount) || 0) })) : [];
  return { id, fecha: typeof o.fecha === "string" ? o.fecha : undefined, items: its, payments: pays, total: Number(o.total) || undefined, cliente,
    factura: o.factura === true, cajero: limpio(o.cajero, 60) || null, mesa: limpio(o.mesa, 40) || null, nota: limpio(o.nota, 300) || null };
}

// ---------- Líneas, impuestos y totales ----------
type Linea = { qty: number; unidad: string; nombre: string; codigo: string; unitario: number; base: number; impuesto: number; tarifa: number; gravada: boolean };
export function calcular(cfg: Cfg, items: Item[]) {
  const responsable = cfg.impuesto !== "ninguno";
  const lineas: Linea[] = [];
  // Las líneas de descuento (precio negativo) se reparten en el precio de los productos: la base y el impuesto quedan
  // sobre lo que de verdad se cobró (un descuento comercial baja la base del IVA).
  const positivos = items.filter((it) => it.price > 0 && !/propina/i.test(it.name));
  const bruto0 = positivos.reduce((s, it) => s + it.price * it.qty, 0);
  const desc0 = Math.min(items.filter((it) => it.price < 0).reduce((s, it) => s - it.price * it.qty, 0), bruto0);
  const factor = bruto0 > 0 ? (bruto0 - desc0) / bruto0 : 1;
  items.forEach((it, n) => {
    const esPropina = /propina/i.test(it.name);
    if (it.price <= 0) return;
    const precio = esPropina ? it.price : it.price * factor;
    const tarifa = !responsable || esPropina ? 0 : (it.tarifa != null && (cfg.impuesto === "iva" ? [0, 5, 19] : [0, 8]).includes(it.tarifa) ? it.tarifa : Number(cfg.tarifa) || 0);
    const unitario = tarifa > 0 ? r2(precio / (1 + tarifa / 100)) : r2(precio);
    const base = r2(unitario * it.qty);
    const imp = tarifa > 0 ? r2(base * tarifa / 100) : 0;
    lineas.push({ qty: it.qty, unidad: UNIDAD[it.unidad || "und"] || UNIDAD.und, nombre: it.name, codigo: it.codigo || "V" + String(n + 1).padStart(3, "0"),
      unitario, base, impuesto: imp, tarifa, gravada: responsable && !esPropina });
  });
  if (!lineas.length) throw new ErrorVento("dian_venta_invalida", "La venta no tiene productos con valor", 400);
  const bruto = r2(lineas.reduce((s, l) => s + l.base, 0));
  const gravable = r2(lineas.filter((l) => l.gravada).reduce((s, l) => s + l.base, 0));
  const impuestos = r2(lineas.reduce((s, l) => s + l.impuesto, 0));
  const conImp = r2(bruto + impuestos);
  const descuento = r2(desc0);
  const pagar = conImp;
  // Totales por tarifa (IVA 19 % y 5 % van aparte; INC 8 %)
  const grupos = new Map<number, { base: number; imp: number }>();
  lineas.filter((l) => l.gravada).forEach((l) => { const g = grupos.get(l.tarifa) || { base: 0, imp: 0 }; g.base = r2(g.base + l.base); g.imp = r2(g.imp + l.impuesto); grupos.set(l.tarifa, g); });
  return { lineas, bruto, gravable, impuestos, conImp, descuento, pagar, grupos };
}

function pagosDe(v: Venta, total: number) {
  const ps = (v.payments || []).filter((p) => (p.amount || 0) > 0);
  const lista = ps.length ? ps : [{ method: "efectivo", amount: total }];
  const suma = lista.reduce((s, p) => s + (p.amount || 0), 0) || 1;
  let usado = 0;
  return lista.map((p, i) => {
    const valor = i === lista.length - 1 ? r2(total - usado) : r2(total * (p.amount || 0) / suma);
    usado = r2(usado + valor);
    const fiado = p.method === "debe" || p.method === "fiado";
    const x: Record<string, unknown> = { payment_method_id: fiado ? 2 : 1, means_payment_id: fiado ? 10 : (MEDIO[String(p.method)] || 10), value_paid: d2(valor) };
    if (fiado) x.payment_due_date = fechaBogota(new Date(Date.now() + 30 * 86400e3).toISOString()).fecha;
    return x;
  });
}

function clienteMatias(c: Cliente | null | undefined, tipo: "pos" | "factura" | "nota") {
  if (!c || !c.numero) return { company_name: "Consumidor final", dni: "222222222222", points: 0 };
  const nombre = c.nombre || "Cliente";
  if (tipo !== "factura") { const x: Record<string, unknown> = { company_name: nombre, dni: c.numero, points: 0 }; if (c.correo) x.email = c.correo; return x; }
  const x: Record<string, unknown> = {
    identity_document_id: IDENTIDAD[c.tipo || "CC"] || 1, type_organization_id: c.tipo === "NIT" ? 1 : 2, tax_regime_id: 2, tax_level_id: 5,
    company_name: nombre, dni: c.numero, email: c.correo, country_id: "45",
  };
  if (c.dv) x.dv = c.dv;
  if (c.direccion) x.address = c.direccion;
  if (c.telefono) x.mobile = c.telefono;
  return x;
}

export function fabricante(env: Env) {
  return {
    owner_name: limpio(env.VENTO_FABRICANTE_DUENO || env.VENTO_FABRICANTE || "Vento", 100),
    company_name: limpio(env.VENTO_FABRICANTE || "Vento", 100),
    software_name: limpio(env.VENTO_SOFTWARE || "Vento POS", 100),
  };
}

// El JSON del documento para MATIAS. doc: el número ya reservado. ref: el documento original (para la nota crédito).
export function armar(env: Env, cfg: Cfg, doc: Doc, v: Venta, ref?: Doc | null, parcial = false): Record<string, unknown> {
  const k = calcular(cfg, v.items);
  const { fecha, hora } = fechaBogota(v.fecha);
  const tipo = doc.tipo;
  const lineas = k.lineas.map((l) => {
    const x: Record<string, unknown> = {
      invoiced_quantity: String(l.qty), base_quantity: String(l.qty), quantity_units_id: l.unidad, line_extension_amount: d2(l.base),
      free_of_charge_indicator: false, description: l.nombre, code: l.codigo, type_item_identifications_id: "4", reference_price_id: "1",
      price_amount: d2(l.unitario),
    };
    if (l.gravada) x.tax_totals = [{ tax_id: cfg.impuesto === "inc" ? IMPUESTO.inc : IMPUESTO.iva, tax_amount: l.impuesto, taxable_amount: l.base, percent: l.tarifa }];
    return x;
  });
  const cuerpo: Record<string, unknown> = {
    resolution_number: String(doc.resolucion || ""),
    prefix: doc.prefijo || undefined,
    document_number: String(doc.numero),
    date: fecha, time: hora,
    graphic_representation: 1,
    send_email: v.cliente && v.cliente.correo ? 1 : 0,
    operation_type_id: 1,
    type_document_id: tipo === "factura" ? TIPO_DOC.factura : TIPO_DOC.pos,
    payments: pagosDe(v, k.pagar),
    lines: lineas,
    legal_monetary_totals: {
      line_extension_amount: d2(k.bruto), tax_exclusive_amount: d2(k.gravable), tax_inclusive_amount: d2(k.conImp),
      total_allowance: "0.00", total_charges: "0.00", payable_amount: d2(k.pagar),
    },
  };
  if (k.grupos.size) cuerpo.tax_totals = Array.from(k.grupos.entries()).map(([t, g]) => ({ tax_id: cfg.impuesto === "inc" ? IMPUESTO.inc : IMPUESTO.iva, tax_amount: g.imp, taxable_amount: g.base, percent: t }));
  const notas = [v.nota, v.mesa ? "Mesa: " + v.mesa : ""].filter(Boolean).join(" · ");
  if (notas) cuerpo.notes = notas;
  const cli = clienteMatias(v.cliente, tipo);
  cuerpo.customer = cli;
  const caja = limpio(cfg.caja || "CAJA 1", 30);
  cuerpo.document_signature = { cashier: v.cajero || caja, seller: v.cajero || caja };
  if (tipo === "pos") {
    cuerpo.point_of_sale = { cashier_name: v.cajero || caja, terminal_number: caja.replace(/\s+/g, "").toUpperCase().slice(0, 20) || "CAJA1", cashier_type: "Caja principal",
      sales_code: limpio(v.id, 30), address: limpio(cfg.direccion || "", 160) || "Colombia", sub_total: d2(k.bruto) };
    cuerpo.software_manufacturer = fabricante(env);
  }
  if (tipo === "nota") referenciar(cuerpo, ref, !parcial);
  return cuerpo;
}

// La nota crédito apunta al documento original (su número, fecha y CUDE/CUFE) y dice qué corrige.
function referenciar(cuerpo: Record<string, unknown>, ref: Doc | null | undefined, total: boolean) {
  if (!ref || !ref.cude) throw new ErrorVento("dian_espera", "La venta todavía no está validada por la DIAN", 409);
  const esPos = ref.tipo === "pos";
  cuerpo.type_document_id = esPos ? TIPO_DOC.nota_pos : TIPO_DOC.nota_factura;
  cuerpo.operation_type_id = esPos ? 11 : 12;
  // Corrección (GET /correction-notes): P.O.S. 16 = anulación, 15 = devolución parcial; factura 2 = anulación, 1 = devolución parcial.
  cuerpo.discrepancy_response = { reference_id: (ref.prefijo || "") + ref.numero, response_id: esPos ? (total ? "16" : "15") : (total ? "2" : "1") };
  cuerpo.billing_reference = { number: (ref.prefijo || "") + ref.numero, date: String((ref.cuerpo && (ref.cuerpo as Record<string, unknown>).date) || fechaBogota(ref.creado_en).fecha), uuid: ref.cude, scheme_name: esPos ? "CUDE-SHA384" : "CUFE-SHA384" };
  delete cuerpo.point_of_sale;
  delete cuerpo.software_manufacturer;
}

// Anulación completa: la nota crédito lleva EXACTAMENTE las líneas, impuestos, pagos y totales del documento original.
export function armarAnulacion(cfg: Cfg, doc: Doc, ref: Doc, cajero?: string | null, motivo?: string | null): Record<string, unknown> {
  const o = (ref.cuerpo || null) as Record<string, unknown> | null;
  if (!o || !Array.isArray(o.lines)) throw new ErrorVento("dian_sin_cuerpo", "No se encontró el documento original para anularlo", 409);
  const { fecha, hora } = fechaBogota();
  const caja = limpio(cfg.caja || "CAJA 1", 30);
  const cuerpo: Record<string, unknown> = {
    resolution_number: String(doc.resolucion || ""), prefix: doc.prefijo || undefined, document_number: String(doc.numero), date: fecha, time: hora,
    graphic_representation: 1, send_email: o.send_email || 0, payments: o.payments, lines: o.lines, legal_monetary_totals: o.legal_monetary_totals,
    customer: o.customer || { company_name: "Consumidor final", dni: "222222222222", points: 0 },
    document_signature: { cashier: limpio(cajero, 60) || caja, seller: limpio(cajero, 60) || caja },
    notes: limpio(motivo, 300) || "Anulación de " + (ref.prefijo || "") + ref.numero,
  };
  if (o.tax_totals) cuerpo.tax_totals = o.tax_totals;
  referenciar(cuerpo, ref, true);
  return cuerpo;
}

// ---------- Conexión con MATIAS ----------
type Transporte = (url: string, init: RequestInit) => Promise<Response>;
let transporte: Transporte = (u, i) => fetch(u, i);
export function usarTransportePruebas(t: Transporte | null) { transporte = t || ((u, i) => fetch(u, i)); tokenMem = null; tokenFijoMalo = false; }

export function base(env: Env) { return String(env.MATIAS_URL || SANDBOX).replace(/\/+$/, ""); }
export const esPruebas = (env: Env) => /sandbox/i.test(base(env));
export const configurado = (env: Env) => !!(env.MATIAS_TOKEN || (env.MATIAS_EMAIL && env.MATIAS_PASSWORD));

let tokenMem: { tok: string; vence: number; base: string } | null = null;
let tokenFijoMalo = false;   // MATIAS rechazó MATIAS_TOKEN: se sigue con la cuenta (correo y contraseña)
async function iniciarSesion(env: Env, db: Db): Promise<string> {
  if (!env.MATIAS_EMAIL || !env.MATIAS_PASSWORD) throw new ErrorVento("dian_sin_proveedor", "El servidor no tiene la cuenta de MATIAS (facturación electrónica)", 503);
  const r = await llamar(env, "POST", "/auth/login", { email: env.MATIAS_EMAIL, password: env.MATIAS_PASSWORD, remember_me: 0 }, null, 20000);
  const tok = r.j && typeof r.j.access_token === "string" ? r.j.access_token : "";
  if (!r.ok || !tok) throw new ErrorVento("dian_proveedor_clave", "MATIAS no aceptó la cuenta de ORDEVA (revisa MATIAS_EMAIL / MATIAS_PASSWORD)", 502);
  const vence = Date.parse(String(r.j.expires_at || "").replace(" ", "T") + "-05:00") || Date.now() + 7 * 86400e3;
  tokenMem = { tok, vence, base: base(env) };
  try { await db.rpc("srv_config_poner", { p_clave: "matias_token", p_valor: { cifrado: await cifrar(env, { tok }), vence, base: base(env) } }); } catch (e) { log("warn", "dian_token_guardar", { error: String(e) }); }
  log("info", "dian_sesion", { vence: new Date(vence).toISOString() });
  return tok;
}
// nuevo = MATIAS dijo 401 con el token de ahora: se inicia sesión otra vez.
export async function token(env: Env, db: Db, nuevo = false): Promise<string> {
  if (nuevo && env.MATIAS_TOKEN && !tokenFijoMalo) tokenFijoMalo = true;
  if (env.MATIAS_TOKEN && !tokenFijoMalo) return env.MATIAS_TOKEN;
  const margen = Date.now() + 2 * 86400e3;
  if (!nuevo && tokenMem && tokenMem.base === base(env) && tokenMem.vence > margen) return tokenMem.tok;
  if (!nuevo) {
    try {
      const g = await db.rpc<{ cifrado: string; vence: number; base: string } | null>("srv_config", { p_clave: "matias_token" });
      if (g && g.base === base(env) && g.vence > margen) { const t = (await descifrar<{ tok: string }>(env, g.cifrado)).tok; tokenMem = { tok: t, vence: g.vence, base: g.base }; return t; }
    } catch { /* se inicia sesión otra vez */ }
  }
  return await iniciarSesion(env, db);
}

type Resp = { ok: boolean; status: number; j: Record<string, unknown>; red?: boolean };
async function llamar(env: Env, metodo: string, ruta: string, cuerpo: unknown, tok: string | null, tiempo = 45000, cliente?: string | null): Promise<Resp> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), tiempo);
  const url = base(env) + ruta + (cliente ? (ruta.includes("?") ? "&" : "?") + "client_uuid=" + encodeURIComponent(cliente) : "");
  try {
    const h: Record<string, string> = { Accept: "application/json" };
    if (cuerpo != null) h["Content-Type"] = "application/json";
    if (tok) h.Authorization = "Bearer " + tok;
    const r = await transporte(url, { method: metodo, headers: h, body: cuerpo != null ? JSON.stringify(cuerpo) : undefined, signal: ctrl.signal });
    const txt = await r.text();
    let j: Record<string, unknown> = {};
    try { j = txt ? JSON.parse(txt) : {}; } catch { j = { message: txt.slice(0, 300) }; }
    return { ok: r.ok, status: r.status, j };
  } catch (e) {
    return { ok: false, status: 0, j: { message: e instanceof Error ? e.message : String(e) }, red: true };
  } finally { clearTimeout(t); }
}
// Con el token (si MATIAS dice 401, se inicia sesión otra vez y se repite UNA vez).
async function conToken(env: Env, db: Db, metodo: string, ruta: string, cuerpo: unknown, cliente?: string | null, tiempo?: number): Promise<Resp> {
  let r = await llamar(env, metodo, ruta, cuerpo, await token(env, db), tiempo, cliente);
  if (r.status === 401 && env.MATIAS_EMAIL && env.MATIAS_PASSWORD) r = await llamar(env, metodo, ruta, cuerpo, await token(env, db, true), tiempo, cliente);
  return r;
}

const lista = (x: unknown): string[] => {
  if (!x) return [];
  if (Array.isArray(x)) return x.map((y) => limpio(typeof y === "string" ? y : JSON.stringify(y), 300)).filter(Boolean);
  if (typeof x === "object") { const o = x as Record<string, unknown>; return lista(o.string ?? Object.values(o)); }
  return [limpio(x, 300)];
};

export type Resultado = { estado: "aceptado" | "rechazado" | "en_proceso" | "pendiente"; cude?: string | null; qr?: string | null; pdf?: string | null; xml?: string | null; mensaje: string; errores: string[]; codigo?: string };

// Lee la respuesta de MATIAS (POST /invoice o /notes/credit).
export function leerRespuesta(r: Resp): Resultado {
  const j = r.j || {}, d = (j.response || {}) as Record<string, unknown>;
  const qr = (j.qr || {}) as Record<string, unknown>, pdf = (j.pdf || {}) as Record<string, unknown>, ad = (j.AttachedDocument || {}) as Record<string, unknown>;
  const cude = String(j.XmlDocumentKey || d.XmlDocumentKey || "") || null;
  const msg = limpio(d.StatusMessage || d.StatusDescription || j.message || "", 300);
  const errs = lista(d.ErrorMessage);
  if (r.red || r.status === 0) return { estado: "pendiente", mensaje: "Sin respuesta de MATIAS: " + limpio(j.message, 120), errores: [], codigo: "red" };
  if (r.status === 402) return { estado: "pendiente", mensaje: "La cuenta de facturación se quedó sin documentos (folios). Avísale al proveedor de ORDEVA.", errores: [], codigo: "sin_folios" };
  if (r.status >= 500 || r.status === 429) return { estado: "pendiente", mensaje: "La DIAN o MATIAS no respondió (" + r.status + "). Se reintenta solo.", errores: [], codigo: "servidor" };
  const valido = String(d.IsValid) === "true" || d.IsValid === true;
  if (r.ok && valido && cude) return { estado: "aceptado", cude, qr: String(qr.qrDian || "") || null, pdf: String(pdf.url || "") || null, xml: String(ad.url || "") || null, mensaje: msg || "Validado por la DIAN", errores: errs };
  if (String(d.StatusCode) === "98") return { estado: "en_proceso", cude, mensaje: "La DIAN lo tiene en proceso", errores: [], codigo: "98" };
  if (/ya se encuentra validado/i.test(String(j.message || ""))) return { estado: "en_proceso", mensaje: "Ya estaba validado: se consulta", errores: [], codigo: "duplicado" };
  if (r.status === 401 || r.status === 403) return { estado: "pendiente", mensaje: "MATIAS no aceptó la conexión de ORDEVA (" + r.status + ")", errores: [], codigo: "auth" };
  // 400 / 422: rechazo de validación (datos). Se puede corregir y volver a mandar con el mismo número.
  const extra = j.errors && typeof j.errors === "object" ? lista(Object.values(j.errors as Record<string, unknown>).flat()) : [];
  return { estado: "rechazado", cude: null, mensaje: msg || "La DIAN rechazó el documento", errores: errs.concat(extra).slice(0, 20), codigo: String(d.StatusCode || r.status) };
}

// ¿Ya lo tiene la DIAN? (antes de reenviar tras un tiempo agotado). GET /status?number=PREFIJONUMERO&prefix=&resolution=
export async function consultar(env: Env, db: Db, cfg: Cfg, doc: Doc): Promise<Resultado | null> {
  const q = "/status?number=" + encodeURIComponent((doc.prefijo || "") + doc.numero) + "&prefix=" + encodeURIComponent(doc.prefijo || "") + "&resolution=" + encodeURIComponent(doc.resolucion || "");
  const r = await conToken(env, db, "GET", q, null, cfg.client_uuid || null, 20000);
  if (!r.ok) return null;
  const dd = (r.j.document || {}) as Record<string, unknown>;
  const qr = (dd.qr || {}) as Record<string, unknown>;
  if (dd.is_valid === true && dd.document_key) return { estado: "aceptado", cude: String(dd.document_key), qr: String(qr.qrDian || "") || null, mensaje: limpio(r.j.status || "Validado por la DIAN", 200), errores: [] };
  return null;
}

export async function enviar(env: Env, db: Db, cfg: Cfg, doc: Doc): Promise<Resultado> {
  if (!doc.cuerpo) throw new ErrorVento("dian_sin_cuerpo", "El documento no tiene datos para enviar", 500);
  // Reintento de algo que pudo llegar: primero se pregunta (nunca dos documentos con el mismo número).
  if (doc.intentos > 0 && doc.estado !== "rechazado") {
    const ya = await consultar(env, db, cfg, doc).catch(() => null);
    if (ya) return ya;
  }
  const ruta = doc.tipo === "nota" ? "/notes/credit" : "/invoice";
  const r = await conToken(env, db, "POST", ruta, doc.cuerpo, cfg.client_uuid || null);
  let res = leerRespuesta(r);
  if (res.codigo === "duplicado" || res.codigo === "98") { const ya = await consultar(env, db, cfg, doc).catch(() => null); if (ya) res = ya; }
  log(res.estado === "rechazado" ? "warn" : "info", "dian_envio", { negocio: doc.negocio_id, doc: doc.id, tipo: doc.tipo, numero: (doc.prefijo || "") + doc.numero, estado: res.estado, http: r.status, codigo: res.codigo || null, errores: res.errores.length });
  return res;
}

// Para «Probar conexión»: inicia sesión y, si el negocio ya tiene su empresa en MATIAS, la lee.
export async function probar(env: Env, db: Db, cfg: Cfg | null) {
  if (!configurado(env)) return { ok: false, mensaje: "El servidor de ORDEVA todavía no tiene la cuenta de MATIAS." };
  const r = await conToken(env, db, "GET", "/auth/user", null, null, 15000);
  if (!r.ok) return { ok: false, mensaje: "MATIAS no respondió bien (" + r.status + ")." };
  if (!cfg || !cfg.client_uuid) return { ok: true, empresa: null, mensaje: "Conexión con MATIAS lista. Falta que ORDEVA Admin conecte tu empresa (NIT)." };
  const e = await conToken(env, db, "GET", "/company", null, cfg.client_uuid, 15000);
  const emp = (e.j && (e.j.company || (e.j.dataRecords as Record<string, unknown> | undefined)?.data || e.j.data)) as Record<string, unknown> | undefined;
  const dni = emp ? soloDig((emp as Record<string, unknown>).dni) : "";
  return { ok: e.ok, empresa: emp ? { nombre: limpio((emp as Record<string, unknown>).company_name, 120), nit: dni } : null,
    coincide: !cfg.nit || !dni || dni === soloDig(cfg.nit), mensaje: e.ok ? "Conectado con MATIAS." : "No se pudo leer tu empresa en MATIAS (" + e.status + ")." };
}

// ORDEVA Admin: las empresas cliente de la casa de software en MATIAS (para conectar cada negocio con su NIT).
export async function clientesMatias(env: Env, db: Db) {
  if (!configurado(env)) return [];
  const r = await conToken(env, db, "GET", "/company/customers", null, null, 20000);
  if (!r.ok) throw new ErrorVento("dian_proveedor", "MATIAS no respondió la lista de empresas (" + r.status + ")", 502);
  const dr = (r.j.dataRecords || {}) as Record<string, unknown>;
  const lista = (Array.isArray(dr.data) ? dr.data : Array.isArray(r.j.data) ? r.j.data : []) as Array<Record<string, unknown>>;
  return lista.slice(0, 500).map((c) => ({ client_uuid: String(c.client_uuid || ""), nombre: limpio(c.company_name, 120), nit: soloDig(c.dni), activo: c.is_active !== false }));
}
