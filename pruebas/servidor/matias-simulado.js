/* =====================================================================
   MATIAS API simulado (facturación electrónica DIAN) para las pruebas del servidor de Vento.
   Revisa lo que revisaría la DIAN / MATIAS en cada documento:
     • autenticación (POST /auth/login → token; Bearer en todo lo demás) y client_uuid de la casa de software
     • campos obligatorios por tipo: P.O.S. 20 (point_of_sale y software_manufacturer completos), factura 7 (cliente
       con correo), notas crédito 94 / 5 (billing_reference con el CUDE/CUFE de un documento validado)
     • aritmética: línea = cantidad × precio, impuesto = base × tarifa, sumas de líneas, impuestos por tarifa,
       totales y pagos (tolerancia de 1 centavo por operación, como la DIAN)
     • numeración: prefijo + número no se repite (400 «ya se encuentra validado»), resolución conocida
   Modos para forzar fallas (sim.modo): 'rechazo' (422), '500', 'red' (no responde), 'perdida' (la DIAN lo valida pero
   la respuesta se pierde), '98' (en proceso), 'sin_folios' (402). sim.vencerToken() invalida el token actual.
   ===================================================================== */
'use strict';
const crypto = require('crypto');

function crearMatias(opts = {}) {
  const sim = {
    cuenta: { email: opts.email || 'vento@casa.co', password: opts.password || 'clave-matias' },
    clientes: opts.clientes || {},                      // client_uuid → { dni, company_name }
    resoluciones: new Set(opts.resoluciones || []),
    tokens: new Set(), docs: new Map(), malos: [], llamadas: [], logins: 0, modo: null, modoVeces: 0,
  };
  const dif = (a, b) => Math.abs(Number(a) - Number(b));
  const num = (x) => Number(x);
  function malo(m) { sim.malos.push(m); return m; }
  function revisar(b, ruta) {
    const e = [];
    const t = Number(b.type_document_id);
    const esNota = ruta === '/notes/credit';
    if (esNota ? ![94, 5].includes(t) : ![20, 7].includes(t)) e.push('type_document_id ' + t + ' no va en ' + ruta);
    if (!b.resolution_number || !sim.resoluciones.has(String(b.resolution_number))) e.push('Resolución desconocida: ' + b.resolution_number);
    if (!/^\d+$/.test(String(b.document_number || ''))) e.push('document_number debe ser numérico');
    if (![1, 11, 12].includes(Number(b.operation_type_id))) e.push('operation_type_id inválido');
    if (!Array.isArray(b.lines) || !b.lines.length) e.push('Sin líneas');
    if (!Array.isArray(b.payments) || !b.payments.length) e.push('Sin pagos');
    if (!b.legal_monetary_totals) e.push('Sin legal_monetary_totals');
    if (!b.customer || !b.customer.company_name || !b.customer.dni) e.push('Falta el cliente (company_name, dni)');
    if (t === 20) {
      const p = b.point_of_sale || {};
      for (const k of ['cashier_name', 'terminal_number', 'cashier_type', 'sales_code', 'address', 'sub_total']) if (!p[k]) e.push('point_of_sale.' + k + ' obligatorio');
      const s = b.software_manufacturer || {};
      for (const k of ['owner_name', 'company_name', 'software_name']) if (!s[k]) e.push('software_manufacturer.' + k + ' obligatorio');
    }
    if (t === 7) { if (!b.customer || !b.customer.email) e.push('La factura necesita el correo del cliente'); if (!b.customer || !b.customer.identity_document_id) e.push('identity_document_id'); }
    if (esNota) {
      const r = b.billing_reference || {}, d = b.discrepancy_response || {};
      const orig = [...sim.docs.values()].find((x) => x.cude === r.uuid);
      if (!orig) e.push('billing_reference.uuid no corresponde a un documento validado');
      else {
        if (r.number !== orig.numero) e.push('billing_reference.number no coincide');
        if (d.reference_id !== orig.numero) e.push('discrepancy_response.reference_id no coincide');
        if (t === 94 && (orig.tipo !== 20 || r.scheme_name !== 'CUDE-SHA384' || Number(b.operation_type_id) !== 11 || !['15', '16'].includes(String(d.response_id)))) e.push('Nota P.O.S. mal referenciada');
        if (t === 5 && (orig.tipo !== 7 || r.scheme_name !== 'CUFE-SHA384' || Number(b.operation_type_id) !== 12 || !['1', '2'].includes(String(d.response_id)))) e.push('Nota de factura mal referenciada');
        const yaNotas = [...sim.docs.values()].filter((x) => x.ref === orig.cude).reduce((s, x) => s + x.total, 0);
        if (yaNotas + num(b.legal_monetary_totals && b.legal_monetary_totals.payable_amount) > orig.total + 0.01) e.push('Las notas superan el valor del documento');
      }
    }
    // Aritmética
    let sumLin = 0, sumGrav = 0, sumImp = 0; const grupos = {};
    (b.lines || []).forEach((l, i) => {
      const q = num(l.invoiced_quantity), p = num(l.price_amount), le = num(l.line_extension_amount);
      if (!(q > 0)) e.push('Línea ' + (i + 1) + ': cantidad');
      if (!/^\d+\.\d{2}$/.test(String(l.line_extension_amount)) || !/^\d+\.\d{2}$/.test(String(l.price_amount))) e.push('Línea ' + (i + 1) + ': valores con 2 decimales');
      if (dif(q * p, le) > 0.01 + q * 0.005) e.push('FAU05 Línea ' + (i + 1) + ': cantidad × precio (' + (q * p).toFixed(2) + ') ≠ ' + le);
      if (!l.description || !l.code || !l.quantity_units_id) e.push('Línea ' + (i + 1) + ': descripción, código y unidad');
      sumLin += le;
      (l.tax_totals || []).forEach((tx) => {
        if (dif(num(tx.taxable_amount) * num(tx.percent) / 100, num(tx.tax_amount)) > 0.01) e.push('FAX07 Línea ' + (i + 1) + ': impuesto mal calculado');
        if (dif(num(tx.taxable_amount), le) > 0.01) e.push('Línea ' + (i + 1) + ': base del impuesto ≠ valor de la línea');
        sumGrav += num(tx.taxable_amount); sumImp += num(tx.tax_amount);
        const k = tx.tax_id + '|' + tx.percent; grupos[k] = grupos[k] || { b: 0, i: 0 }; grupos[k].b += num(tx.taxable_amount); grupos[k].i += num(tx.tax_amount);
      });
    });
    const T = b.legal_monetary_totals || {};
    if (dif(sumLin, T.line_extension_amount) > 0.01) e.push('FAU02 Suma de líneas ≠ line_extension_amount');
    if (dif(sumGrav, T.tax_exclusive_amount) > 0.01) e.push('FAU04 Base gravable ≠ tax_exclusive_amount');
    if (dif(num(T.line_extension_amount) + sumImp, T.tax_inclusive_amount) > 0.01) e.push('FAU06 tax_inclusive_amount');
    if (dif(num(T.tax_inclusive_amount) - num(T.total_allowance || 0) + num(T.total_charges || 0), T.payable_amount) > 0.01) e.push('FAU14 payable_amount');
    const tt = b.tax_totals || [];
    const kt = Object.keys(grupos);
    if (kt.length !== tt.length) e.push('FAS01 tax_totals no agrupa los impuestos de las líneas');
    tt.forEach((x) => { const g = grupos[x.tax_id + '|' + x.percent]; if (!g || dif(g.b, x.taxable_amount) > 0.01 || dif(g.i, x.tax_amount) > 0.01) e.push('FAS01A Total del impuesto ' + x.tax_id + ' ' + x.percent + '%'); });
    const pag = (b.payments || []).reduce((s, p) => s + num(p.value_paid), 0);
    if (dif(pag, T.payable_amount) > 0.01) e.push('Los pagos (' + pag.toFixed(2) + ') no suman el total (' + T.payable_amount + ')');
    (b.payments || []).forEach((p) => { if (![1, 2].includes(p.payment_method_id) || !p.means_payment_id) e.push('Pago inválido'); if (p.payment_method_id === 2 && !p.payment_due_date) e.push('Pago a crédito sin fecha'); });
    return e;
  }
  const responder = (st, j) => new Response(JSON.stringify(j), { status: st, headers: { 'Content-Type': 'application/json' } });
  function validar(b, ruta, cliente) {
    const pre = (b.prefix || '') + b.document_number;
    const clave = (cliente || '-') + '|' + Number(b.type_document_id) + '|' + pre;
    if (sim.docs.has(clave)) return { st: 400, j: { success: false, message: 'El documento (Factura electrónica) con numero ' + pre + ', ya se encuentra validado' } };
    const errs = revisar(b, ruta);
    if (errs.length) { malo({ ruta, numero: pre, errs }); return { st: 422, j: { message: 'El documento ha sido rechazado por la DIAN.', send_to_queue: 0, response: { IsValid: 'false', StatusCode: '99', StatusDescription: 'Documento con errores en campos obligatorios.', ErrorMessage: { string: errs } } } }; }
    const cude = crypto.createHash('sha384').update(JSON.stringify([cliente, pre, b.legal_monetary_totals.payable_amount, b.date, b.time])).digest('hex');
    const doc = { numero: pre, tipo: Number(b.type_document_id), cude, total: num(b.legal_monetary_totals.payable_amount), cliente, ref: b.billing_reference ? b.billing_reference.uuid : null, cuerpo: b, prefix: b.prefix || '', resolution: String(b.resolution_number) };
    sim.docs.set(clave, doc);
    return { st: 200, doc, j: { message: 'El documento ha sido procesado por la DIAN.', send_to_queue: 0, XmlDocumentKey: cude,
      response: { ErrorMessage: { string: ['Regla: RUT01, Notificación: La validación del estado del RUT próximamente estará disponible.'] }, IsValid: 'true', StatusCode: '00', StatusDescription: 'Procesado Correctamente.', StatusMessage: 'El documento ' + pre + ', ha sido autorizado.', XmlDocumentKey: cude, XmlFileName: 'fv' + pre },
      AttachedDocument: { url: 'https://api-v2.matias-api.com/attachments/1/ad/ad' + pre + '.xml' }, qr: { qrDian: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=' + cude, url: 'https://api-v2.matias-api.com/qr/1/' + pre + '.png' },
      pdf: { url: 'https://api-v2.matias-api.com/pdf/1/' + pre + '.pdf' }, success: true } };
  }
  sim.simular = async (url, init = {}) => {
    const u = new URL(url), ruta = u.pathname.replace(/^\/api\/ubl2\.1/, ''), metodo = (init.method || 'GET').toUpperCase();
    const h = init.headers || {}, auth = String(h.Authorization || h.authorization || '');
    let b = null; try { b = init.body ? JSON.parse(init.body) : null; } catch (e) { malo({ ruta, error: 'JSON inválido' }); }
    const cliente = u.searchParams.get('client_uuid');
    sim.llamadas.push({ metodo, ruta, cliente, url: u.toString(), cuerpo: b, auth: auth ? 'Bearer …' : '' });
    if (!/^https:\/\/sandbox-api\.matias-api\.com\/api\/ubl2\.1\//.test(url) && !(opts.base && url.startsWith(opts.base))) malo({ url, error: 'URL inesperada' });
    if (h.Accept !== 'application/json') malo({ ruta, error: 'Falta Accept: application/json' });
    if (ruta === '/auth/login' && metodo === 'POST') {
      sim.logins++;
      if (!b || b.email !== sim.cuenta.email || b.password !== sim.cuenta.password || b.remember_me !== 0) return responder(401, { message: 'Credenciales inválidas', success: false });
      const tok = 'jwt-' + crypto.randomBytes(12).toString('hex'); sim.tokens.add(tok);
      const v = new Date(Date.now() + 30 * 86400e3 - 5 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
      return responder(200, { access_token: tok, token_type: 'Bearer', expires_at: v, user: { id: 1, email: b.email } });
    }
    const tok = auth.replace(/^Bearer\s+/, '');
    if (!sim.tokens.has(tok)) return responder(401, { message: 'Unauthenticated.' });
    if (cliente && !sim.clientes[cliente]) return responder(404, { message: 'Cliente no encontrado', success: false });
    if (ruta === '/auth/user') return responder(200, { id: 1, email: sim.cuenta.email });
    if (ruta === '/company/customers') return responder(200, { dataRecords: { data: Object.entries(sim.clientes).map(([k, c]) => ({ client_uuid: k, company_name: c.company_name, dni: c.dni, is_active: true })) } });
    if (ruta === '/company') { const c = cliente ? sim.clientes[cliente] : { dni: '900000001', company_name: 'VENTO CASA DE SOFTWARE' }; return responder(200, { company: c, success: true }); }
    if (ruta === '/status' && metodo === 'GET') {
      const n = u.searchParams.get('number');
      const d = [...sim.docs.values()].find((x) => x.numero === n && (x.cliente || null) === (cliente || null));
      if (!d) return responder(404, { success: false, message: 'Documento no encontrado' });
      return responder(200, { document: { uuid: 'x', document_number: d.numero, document_key: d.cude, is_valid: true, qr: { qrDian: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=' + d.cude } }, status: 'Validado por la DIAN', message: 'Consulta exitosa', success: true });
    }
    if ((ruta === '/invoice' || ruta === '/notes/credit') && metodo === 'POST') {
      if (h['Content-Type'] !== 'application/json') malo({ ruta, error: 'Content-Type' });
      const modo = sim.modo;
      if (modo && sim.modoVeces > 0) { sim.modoVeces--; if (!sim.modoVeces) sim.modo = null; }
      if (modo === 'red') throw new Error('fetch failed: ECONNRESET');
      if (modo === '500') return responder(503, { message: 'Servicio DIAN no disponible' });
      if (modo === 'sin_folios') return responder(402, { message: 'Saldo insuficiente de folios', success: false });
      if (modo === 'rechazo') return responder(422, { message: 'El documento ha sido rechazado por la DIAN.', response: { IsValid: 'false', StatusCode: '99', StatusDescription: 'Documento con errores en campos obligatorios.', ErrorMessage: { string: ['Regla: FAJ43b, Rechazo: Nombre o razón social del emisor no corresponde al RUT.'] } } });
      if (modo === '98') return responder(200, { message: 'Solicitud procesada por la DIAN.', response: { IsValid: 'false', StatusCode: '98', StatusDescription: 'En Proceso', XmlDocumentKey: null } });
      const r = validar(b, ruta, cliente);
      if (modo === 'perdida' && r.st === 200) throw new Error('The operation was aborted due to timeout');
      return responder(r.st, r.j);
    }
    return responder(404, { message: 'The route api/ubl2.1' + ruta + ' could not be found.' });
  };
  sim.vencerToken = () => sim.tokens.clear();
  sim.de = (filtro) => sim.llamadas.filter(filtro);
  sim.forzar = (modo, veces = 1) => { sim.modo = modo; sim.modoVeces = veces; };
  return sim;
}

module.exports = { crearMatias };
