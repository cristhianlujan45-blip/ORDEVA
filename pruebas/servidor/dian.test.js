// Pruebas del SERVIDOR de facturación electrónica DIAN (vento-pagos /dian/* + migración 20261029000000) contra
// PostgreSQL 16 REAL y MATIAS API simulado (pruebas/servidor/matias-simulado.js), que revisa campos y aritmética como la
// DIAN. Corre solo:   node pruebas/servidor/dian.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { iniciar } = require('./supabase-local');
const { crearMatias } = require('./matias-simulado');

const RAIZ = path.resolve(__dirname, '..', '..');
let ok = 0, mal = 0;
const chk = (n, c, x) => {
  if (c) { ok++; console.log('✅ ' + n); }
  else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); }
};
const LOGS = [];
for (const k of ['log', 'warn', 'error']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":"')) { LOGS.push(a[0]); if (process.env.VENTO_LOGS) orig(...a); return; } orig(...a); };
}
const CLIENTE_UUID = '546fe314-7ca2-11f0-be83-d843ae899220';
const ENV = { MATIAS_EMAIL: 'vento@casa.co', MATIAS_PASSWORD: 'clave-matias', VENTO_FABRICANTE: 'Vento SAS', VENTO_FABRICANTE_DUENO: 'Dueño de Vento' };

async function pruebas(sb) {
  const F = await import(pathToFileURL(path.join(RAIZ, 'supabase', 'functions', 'vento-pagos', 'dian.ts')).href);
  const M = crearMatias({ email: ENV.MATIAS_EMAIL, password: ENV.MATIAS_PASSWORD, resoluciones: ['18764071164948', '18760000001'],
    clientes: { [CLIENTE_UUID]: { dni: '901091403', company_name: 'BAR LA 14 SAS' } } });
  F.usarTransportePruebas(M.simular);
  const FN = sb.url + '/functions/v1/vento-pagos';
  const cab = (tok) => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
  const api = async (ruta, cuerpo, tok, extra) => {
    const r = await fetch(FN + ruta, { method: cuerpo === undefined ? 'GET' : 'POST', headers: { ...cab(tok), ...(extra || {}) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    return { st: r.status, j: await r.json().catch(() => ({})) };
  };
  const rpc = async (fn, args, tok) => {
    const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok || sb.anonKey), body: JSON.stringify(args || {}) });
    return { st: r.status, j: await r.json().catch(() => null) };
  };
  const uno = async (q, p) => (await sb.sql(q, p))[0];
  const canon = (x) => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((y) => [y, v[y]])) : v);
  const invoices = (num) => M.de((l) => l.ruta === '/invoice' && l.cuerpo && (l.cuerpo.prefix || '') + l.cuerpo.document_number === num);

  // ---------- Usuarios y negocio ----------
  const dueno = await sb.usuario('dueno@bar.co');
  const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar La 14', p_datos: {} }, dueno.token)).j;
  const unir = async (email, rol) => {
    const u = await sb.usuario(email);
    const cod = (await rpc('crear_invitacion', { p_negocio: NEG, p_rol: rol }, dueno.token)).j;
    await rpc('unirse_con_codigo', { p_codigo: cod, p_nombre: rol }, u.token);
    return u;
  };
  const cajero = await unir('caja@bar.co', 'cajero');
  const ajeno = await sb.usuario('ajeno@otro.co');
  await rpc('crear_negocio', { p_nombre: 'Otro', p_datos: {} }, ajeno.token);
  chk('Negocio con dueño y cajero', /^[0-9a-f-]{36}$/.test(NEG) && (await uno('select count(*)::int n from miembros where negocio_id = $1', [NEG])).n === 2);

  // ---------- Sin cuenta de MATIAS en el servidor ----------
  let r = await api('/salud');
  chk('/salud: «dian_matias» y la facturación aún sin cuenta del proveedor', r.st === 200 && r.j.integraciones.includes('dian_matias') && r.j.dian.listo === false && r.j.dian.ambiente === 'pruebas', r.j);
  Object.assign(sb.env, ENV);
  r = await api('/salud');
  chk('Con MATIAS_EMAIL / MATIAS_PASSWORD: listo, ambiente de PRUEBAS (sandbox)', r.j.dian.listo === true && r.j.dian.ambiente === 'pruebas', r.j.dian);

  // ---------- Configuración (Ajustes) ----------
  const CFG = { razon_social: 'BAR LA 14 SAS', nit: '901.091.403', dv: '2', direccion: 'Calle 14 # 5-20, Bogotá', correo: 'bar@la14.co', impuesto: 'iva', tarifa: 19,
    pos_resolucion: '18764071164948', pos_prefijo: 'fpos', pos_desde: 1, pos_hasta: 5000, pos_vence: '2030-12-31', caja: 'Caja 1' };
  r = await api('/dian/config', { negocio: NEG, accion: 'ver' }, cajero.token);
  chk('El cajero ve la configuración (apagada) con su rol', r.st === 200 && r.j.config.activo === false && r.j.config.rol === 'cajero' && r.j.servidor === true, r.j);
  r = await api('/dian/config', { negocio: NEG, accion: 'guardar', config: CFG }, cajero.token);
  chk('El cajero NO puede cambiar la facturación (403)', r.st === 403 && r.j.error === 'sin_permiso', r.j);
  r = await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { activo: true, razon_social: 'X' } }, dueno.token);
  chk('Prender sin NIT ni resolución → dice qué falta (400)', r.st === 400 && r.j.error === 'dian_faltan_datos' && /NIT/.test(r.j.mensaje), r.j);
  r = await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { impuesto: 'iva', tarifa: 8 } }, dueno.token);
  chk('IVA del 8 % → tarifa inválida (400)', r.st === 400 && r.j.error === 'dian_tarifa_invalida', r.j);
  r = await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { ...CFG, activo: true } }, dueno.token);
  chk('El dueño la prende: NIT sin puntos, prefijo en mayúscula y consecutivo = inicio del rango', r.st === 200 && r.j.config.activo === true && r.j.config.nit === '901091403' &&
    r.j.config.pos_prefijo === 'FPOS' && Number(r.j.config.pos_siguiente) === 1 && r.j.config.conectado === false && !('client_uuid' in r.j.config), r.j.config);
  r = await api('/dian/config', { negocio: NEG, accion: 'probar' }, dueno.token);
  chk('«Probar conexión»: inicia sesión en MATIAS y avisa que falta conectar la empresa', r.st === 200 && r.j.prueba.ok === true && /Vento Admin/.test(r.j.prueba.mensaje) && M.logins === 1, r.j.prueba);
  const tokFila = await uno("select valor from servidor_config where clave = 'matias_token'");
  chk('El token de MATIAS queda CIFRADO en la base (no en texto plano)', tokFila && /^v1:/.test(tokFila.valor.cifrado) && !JSON.stringify(tokFila.valor).includes('jwt-'), tokFila);

  // ---------- Una venta → P.O.S. electrónico ----------
  const venta = (id, extra) => ({ id, fecha: new Date().toISOString(), cajero: 'Ana', mesa: '4',
    items: [{ name: 'Cerveza Club Colombia', qty: 2, price: 5900 }, { name: 'Tomate', qty: 0.75, price: 4100, unidad: 'kg' }, { name: 'Picada', qty: 1, price: 28000, codigo: 'P01' }],
    payments: [{ method: 'efectivo', amount: 30000 }, { method: 'nequi', amount: 12875 }], total: 42875, ...(extra || {}) });
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-1') }, cajero.token);
  const d1 = r.j.documento;
  chk('El cajero cobra: documento P.O.S. electrónico FPOS1 ACEPTADO por la DIAN con CUDE, QR y PDF', r.st === 200 && d1 && d1.estado === 'aceptado' && d1.documento === 'FPOS1' &&
    /^[0-9a-f]{96}$/.test(d1.cude) && /catalogo-vpfe\.dian\.gov\.co/.test(d1.qr) && /\.pdf$/.test(d1.pdf), r.j);
  const env1 = invoices('FPOS1')[0];
  const c1 = env1 && env1.cuerpo;
  chk('Se mandó a POST /invoice con type_document_id 20, resolución, prefijo y número', c1 && c1.type_document_id === 20 && c1.resolution_number === '18764071164948' && c1.prefix === 'FPOS' && c1.document_number === '1', c1 && { t: c1.type_document_id, p: c1.prefix });
  chk('IVA 19 % separado línea por línea (5.900 → base 4.957,98 + IVA 942,02 c/u) y el kilo de tomate en KGM', c1 && c1.lines[0].price_amount === '4957.98' && c1.lines[0].line_extension_amount === '9915.96' &&
    c1.lines[0].tax_totals[0].tax_id === '1' && c1.lines[0].tax_totals[0].percent === 19 && c1.lines[1].quantity_units_id === '767' && c1.lines[1].invoiced_quantity === '0.75' && c1.lines[2].code === 'P01', c1 && c1.lines);
  chk('Totales que cuadran con lo cobrado ($42.875 ± centavos) y los pagos suman el total', c1 && Math.abs(Number(c1.legal_monetary_totals.payable_amount) - 42875) < 0.1 &&
    Math.abs(c1.payments.reduce((s, p) => s + Number(p.value_paid), 0) - Number(c1.legal_monetary_totals.payable_amount)) < 0.005 && c1.payments[0].means_payment_id === 10 && c1.payments[1].means_payment_id === 31, c1 && { t: c1.legal_monetary_totals, p: c1.payments });
  chk('Punto de venta (caja, cajero, dirección, subtotal) y fabricante del software', c1 && c1.point_of_sale.cashier_name === 'Ana' && c1.point_of_sale.terminal_number === 'CAJA1' && /Calle 14/.test(c1.point_of_sale.address) &&
    c1.point_of_sale.sub_total === c1.legal_monetary_totals.line_extension_amount && c1.software_manufacturer.company_name === 'Vento SAS' && c1.software_manufacturer.software_name === 'Vento POS', c1 && c1.point_of_sale);
  chk('Sin datos del cliente: consumidor final 222222222222 (sin correo, no se manda email)', c1 && c1.customer.dni === '222222222222' && c1.send_email === 0 && /Mesa: 4/.test(c1.notes), c1 && c1.customer);
  chk('Sin empresa conectada todavía: sin client_uuid', env1 && env1.cliente === null, env1 && env1.url);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-1') }, dueno.token);
  chk('La MISMA venta otra vez (otro celular / reintento): mismo FPOS1, no se manda de nuevo', r.st === 200 && r.j.repetido === true && r.j.documento.documento === 'FPOS1' && invoices('FPOS1').length === 1, r.j);

  // ---------- Dos cajas cobrando a la vez ----------
  const varias = await Promise.all([2, 3, 4, 5, 6, 7].map((n) => api('/dian/emitir', { negocio: NEG, venta: venta('v-p' + n) }, n % 2 ? cajero.token : dueno.token)));
  const nums = varias.map((x) => x.j.documento && x.j.documento.numero).sort((a, b) => a - b);
  chk('6 ventas al mismo tiempo: números 2…7 sin repetir ni saltar, todas aceptadas', JSON.stringify(nums) === '[2,3,4,5,6,7]' && varias.every((x) => x.j.documento.estado === 'aceptado'), varias.map((x) => x.j));

  // ---------- Impuesto al consumo, no responsable y descuento ----------
  await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { impuesto: 'inc', tarifa: 8 } }, dueno.token);
  r = await api('/dian/emitir', { negocio: NEG, venta: { id: 'v-inc', items: [{ name: 'Almuerzo', qty: 3, price: 18000 }], payments: [{ method: 'tarjeta', amount: 54000 }] } }, cajero.token);
  let cu = invoices(r.j.documento && r.j.documento.documento)[0];
  chk('Restaurante con impuesto al consumo 8 %: tax_id 4 (INC), tarjeta = medio 48', r.j.documento && r.j.documento.estado === 'aceptado' && cu.cuerpo.lines[0].tax_totals[0].tax_id === '4' && cu.cuerpo.lines[0].tax_totals[0].percent === 8 &&
    cu.cuerpo.tax_totals[0].tax_id === '4' && cu.cuerpo.payments[0].means_payment_id === 48, r.j);
  await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { impuesto: 'ninguno' } }, dueno.token);
  r = await api('/dian/emitir', { negocio: NEG, venta: { id: 'v-nr', items: [{ name: 'Pan', qty: 10, price: 500 }, { name: 'Descuento', qty: 1, price: -1000 }, { name: 'Propina voluntaria', qty: 1, price: 2000 }], payments: [{ method: 'debe', amount: 6000 }] } }, cajero.token);
  cu = invoices(r.j.documento && r.j.documento.documento)[0];
  chk('No responsable de IVA: sin impuestos (base 0), el descuento baja el precio y el fiado va a crédito con fecha', r.j.documento && r.j.documento.estado === 'aceptado' && !cu.cuerpo.tax_totals &&
    cu.cuerpo.legal_monetary_totals.tax_exclusive_amount === '0.00' && cu.cuerpo.legal_monetary_totals.payable_amount === '6000.00' && cu.cuerpo.lines.length === 2 && cu.cuerpo.lines[0].price_amount === '400.00' &&
    cu.cuerpo.payments[0].payment_method_id === 2 && /^\d{4}-\d\d-\d\d$/.test(cu.cuerpo.payments[0].payment_due_date), cu && cu.cuerpo);
  await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { impuesto: 'iva', tarifa: 19 } }, dueno.token);
  r = await api('/dian/emitir', { negocio: NEG, venta: { id: 'v-mix', items: [{ name: 'Arroz (excluido)', qty: 2, price: 3000, tarifa: 0 }, { name: 'Café (5 %)', qty: 1, price: 10500, tarifa: 5 }, { name: 'Gaseosa', qty: 3, price: 3333 }], payments: [] } }, cajero.token);
  cu = invoices(r.j.documento && r.j.documento.documento)[0];
  chk('Tarifas por producto (0 %, 5 % y 19 %): un total de impuesto por tarifa y todo cuadra (la DIAN lo aceptó)', r.j.documento && r.j.documento.estado === 'aceptado' && cu.cuerpo.tax_totals.length === 3 &&
    cu.cuerpo.tax_totals.map((x) => x.percent).sort((a, b) => a - b).join() === '0,5,19', cu && cu.cuerpo.tax_totals);

  // ---------- Factura electrónica (el cliente la pide) ----------
  const cli = { tipo: 'CC', numero: '1.063.279.307', nombre: 'Lewis López', correo: 'lewis@correo.co', telefono: '3001234567' };
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-fe', { factura: true, cliente: cli }) }, cajero.token);
  chk('Pedir factura sin resolución de factura → aviso claro (409), no sale nada', r.st === 409 && r.j.error === 'dian_sin_factura', r.j);
  await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { fe_resolucion: '18760000001', fe_prefijo: 'FE', fe_desde: 100, fe_hasta: 200, fe_vence: '2030-01-01' } }, dueno.token);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-fe', { factura: true, cliente: { ...cli, correo: '' } }) }, cajero.token);
  chk('Factura sin correo del cliente → 400 «faltan los datos del cliente»', r.st === 400 && r.j.error === 'dian_cliente_incompleto', r.j);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-fe', { factura: true, cliente: cli }) }, cajero.token);
  cu = invoices('FE100')[0];
  chk('Factura electrónica FE100 (tipo 7) con cédula, nombre y correo del cliente, y se le manda al correo', r.j.documento && r.j.documento.estado === 'aceptado' && r.j.documento.tipo === 'factura' && cu &&
    cu.cuerpo.type_document_id === 7 && cu.cuerpo.customer.dni === '1063279307' && cu.cuerpo.customer.identity_document_id === 1 && cu.cuerpo.customer.email === 'lewis@correo.co' && cu.cuerpo.send_email === 1 && !cu.cuerpo.point_of_sale, r.j);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-pos-cli', { cliente: { tipo: 'NIT', numero: '900123456', nombre: 'Empresa SAS', correo: 'compras@empresa.co' } }) }, cajero.token);
  cu = invoices(r.j.documento && r.j.documento.documento)[0];
  chk('P.O.S. con datos del cliente (sin pedir factura): lleva su NIT y le llega al correo', cu && cu.cuerpo.type_document_id === 20 && cu.cuerpo.customer.dni === '900123456' && cu.cuerpo.send_email === 1, cu && cu.cuerpo.customer);

  // ---------- La DIAN rechaza, se corrige y se vuelve a mandar con el MISMO número ----------
  M.forzar('rechazo');
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-rech') }, cajero.token);
  const numRech = r.j.documento && r.j.documento.documento;
  chk('Rechazo de la DIAN: queda «rechazado» con la regla que falló', r.st === 200 && r.j.documento.estado === 'rechazado' && /FAJ43b/.test(r.j.documento.errores.join(' ')), r.j);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-rech') }, cajero.token);
  chk('…al volver a mandarlo sale ACEPTADO con el mismo número', r.j.documento.estado === 'aceptado' && r.j.documento.documento === numRech, r.j.documento);

  // ---------- Sin respuesta: nunca dos documentos con el mismo número ----------
  M.forzar('perdida');
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-perdida') }, cajero.token);
  const numP = r.j.documento && r.j.documento.documento;
  chk('La respuesta se pierde (la DIAN sí lo validó): queda «pendiente», la venta no se pierde', r.st === 200 && r.j.documento.estado === 'pendiente' && r.j.documento.intentos === 1, r.j);
  r = await api('/dian/estado', { negocio: NEG, ventas: ['v-perdida'] }, cajero.token);
  const dP = (r.j.documentos || [])[0];
  chk('Al pedir el estado se reintenta: primero CONSULTA (GET /status) y lo encuentra validado → aceptado sin reenviarlo', dP && dP.estado === 'aceptado' && dP.cude && invoices(numP).length === 1 &&
    M.de((l) => l.ruta === '/status' && /number=FPOS/.test(l.url)).length >= 1, { dP, envios: invoices(numP).length });
  M.forzar('500', 1);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-500') }, cajero.token);
  chk('DIAN caída (503): pendiente', r.j.documento.estado === 'pendiente', r.j);
  await sb.sql("update dian_documentos set proximo_intento = now() - interval '1 second' where venta_id = 'v-500'");
  r = await api('/sync', {}, null, { 'x-vento-cron': sb.cron });
  const d500 = await uno("select estado, cude from dian_documentos where venta_id = 'v-500'");
  chk('El repaso cada 10 minutos (X-Vento-Cron) lo reenvía y queda aceptado', r.st === 200 && r.j.dian && r.j.dian.aceptados >= 1 && d500.estado === 'aceptado' && d500.cude, { r: r.j, d500 });
  M.forzar('98');
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-98') }, cajero.token);
  chk('DIAN «98 en proceso»: queda en proceso para consultarlo después', r.j.documento.estado === 'en_proceso', r.j.documento);
  M.forzar('sin_folios');
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-folios') }, cajero.token);
  chk('Sin documentos en el paquete (402): pendiente con el aviso de folios', r.j.documento.estado === 'pendiente' && /folios/.test(r.j.documento.mensaje), r.j.documento);

  // ---------- Token vencido ----------
  M.vencerToken();
  const l0 = M.logins;
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-tok') }, cajero.token);
  chk('Token de MATIAS vencido (401): inicia sesión otra vez solo y la venta sale aceptada', r.j.documento.estado === 'aceptado' && M.logins === l0 + 1, { j: r.j, logins: M.logins });

  // ---------- Empresa conectada (Vento Admin) → client_uuid ----------
  await sb.sql('select srv_dian_admin_cliente($1, $2, null)', [NEG, CLIENTE_UUID]);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-cli') }, cajero.token);
  const conCli = M.de((l) => l.ruta === '/invoice' && l.cuerpo && l.cuerpo.point_of_sale && l.cuerpo.point_of_sale.sales_code === 'v-cli')[0];
  chk('Con la empresa conectada, cada documento va a nombre del negocio (?client_uuid=…)', r.j.documento.estado === 'aceptado' && conCli && conCli.cliente === CLIENTE_UUID, conCli && conCli.url);
  r = await api('/dian/config', { negocio: NEG, accion: 'probar' }, dueno.token);
  chk('«Probar conexión» lee la empresa en MATIAS y confirma que el NIT coincide', r.j.prueba.ok === true && r.j.prueba.empresa.nit === '901091403' && r.j.prueba.coincide === true, r.j.prueba);

  // ---------- Anular y devolver (nota crédito) ----------
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-cli', motivo: 'Cobro equivocado', cajero: 'Ana' }, cajero.token);
  const nc = r.j.documento;
  const ncEnv = M.de((l) => l.ruta === '/notes/credit').slice(-1)[0];
  const orig = invoices((await uno("select prefijo || numero n from dian_documentos where venta_id = 'v-cli' and tipo = 'pos'")).n)[0];
  chk('Deshacer lo recién cobrado: nota crédito P.O.S. (94) aceptada', r.st === 200 && nc && nc.estado === 'aceptado' && nc.tipo === 'nota' && nc.documento === 'NC1' && ncEnv && ncEnv.cuerpo.type_document_id === 94, r.j);
  chk('…referencia el CUDE y el número del original, «16 anulación», y lleva EXACTAMENTE sus líneas y totales', ncEnv && orig && ncEnv.cuerpo.billing_reference.uuid === (await uno("select cude from dian_documentos where venta_id='v-cli' and tipo='pos'")).cude &&
    ncEnv.cuerpo.discrepancy_response.response_id === '16' && ncEnv.cuerpo.operation_type_id === 11 && canon(ncEnv.cuerpo.lines) === canon(orig.cuerpo.lines) &&
    canon(ncEnv.cuerpo.legal_monetary_totals) === canon(orig.cuerpo.legal_monetary_totals) && ncEnv.cuerpo.notes === 'Cobro equivocado' && ncEnv.cliente === CLIENTE_UUID, ncEnv && ncEnv.cuerpo);
  chk('…y la venta original queda «anulado»', (await uno("select estado from dian_documentos where venta_id = 'v-cli' and tipo = 'pos'")).estado === 'anulado');
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-cli' }, cajero.token);
  chk('Anular otra vez: la misma nota (no se manda otra)', r.j.repetido === true && M.de((l) => l.ruta === '/notes/credit').length === 1, r.j);
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-98' }, cajero.token);
  chk('Anular algo que la DIAN aún no valida → 409 (Vento lo anula cuando responda)', r.st === 409 && r.j.error === 'dian_espera', r.j);
  await sb.sql("update dian_documentos set estado = 'rechazado' where venta_id = 'v-folios'");
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-folios' }, cajero.token);
  chk('Anular algo que la DIAN rechazó: queda anulado sin nota crédito', r.j.documento && r.j.documento.estado === 'anulado' && M.de((l) => l.ruta === '/notes/credit').length === 1, r.j);
  await sb.sql("update dian_documentos set creado_en = now() - interval '20 minutes' where venta_id = 'v-p2'");
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-p2' }, cajero.token);
  chk('El cajero NO anula una venta de hace 20 minutos (403)…', r.st === 403 && r.j.error === 'sin_permiso', r.j);
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-p2', items: [{ name: 'Cerveza Club Colombia', qty: 1, price: 5900 }], nota_id: 'dev1' }, dueno.token);
  const dev = M.de((l) => l.ruta === '/notes/credit').slice(-1)[0];
  chk('…el dueño sí: devolución de 1 cerveza = nota crédito parcial «15» por $5.900', r.j.documento && r.j.documento.estado === 'aceptado' && dev.cuerpo.discrepancy_response.response_id === '15' &&
    Math.abs(Number(dev.cuerpo.legal_monetary_totals.payable_amount) - 5900) < 0.02 && (await uno("select estado from dian_documentos where venta_id = 'v-p2' and tipo='pos'")).estado === 'aceptado', r.j);
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-p3', items: [{ name: 'Cerveza', qty: 100, price: 5900 }], nota_id: 'dev2' }, dueno.token);
  chk('Devolver más de lo vendido → 400', r.st === 400 && r.j.error === 'dian_devolucion_grande', r.j);
  r = await api('/dian/anular', { negocio: NEG, venta_id: 'v-fe' }, dueno.token);
  const ncFe = M.de((l) => l.ruta === '/notes/credit').slice(-1)[0];
  chk('Anular la factura electrónica: nota crédito tipo 5 con CUFE y «2 anulación»', r.j.documento && r.j.documento.estado === 'aceptado' && ncFe.cuerpo.type_document_id === 5 && ncFe.cuerpo.billing_reference.scheme_name === 'CUFE-SHA384' &&
    ncFe.cuerpo.discrepancy_response.response_id === '2' && ncFe.cuerpo.operation_type_id === 12, r.j);

  // ---------- Rango, vigencia y consecutivo ----------
  const sig = Number((await uno('select pos_siguiente from dian_config where negocio_id = $1', [NEG])).pos_siguiente);
  r = await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { pos_siguiente: 3 } }, dueno.token);
  chk('No se puede volver a un consecutivo ya usado (409)', r.st === 409 && r.j.error === 'dian_numero_usado', r.j);
  await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { pos_hasta: sig + 10 } }, dueno.token);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-aviso') }, cajero.token);
  chk('Quedando pocos números del rango, avisa que pida resolución nueva', r.j.aviso && /Quedan 10 números/.test(r.j.aviso), r.j);
  await sb.sql('update dian_config set pos_hasta = pos_siguiente - 1 where negocio_id = $1', [NEG]);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-agotado') }, cajero.token);
  chk('Rango agotado → 409 con qué hacer (y no se gasta número)', r.st === 409 && r.j.error === 'dian_rango_agotado' && /resolución nueva/.test(r.j.mensaje) && !(await uno("select 1 x from dian_documentos where venta_id = 'v-agotado'")), r.j);
  await sb.sql("update dian_config set pos_hasta = 5000, pos_vence = current_date - 1 where negocio_id = $1", [NEG]);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-vencida') }, cajero.token);
  chk('Resolución vencida → 409', r.st === 409 && r.j.error === 'dian_resolucion_vencida', r.j);
  await sb.sql("update dian_config set pos_vence = '2030-12-31' where negocio_id = $1", [NEG]);

  // ---------- Seguridad ----------
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-ajeno') }, ajeno.token);
  chk('Alguien de otro negocio NO puede facturar a nombre de este (403)', r.st === 403, r.j);
  r = await rpc('dian_documentos_de', { p_negocio: NEG, p_ventas: null }, ajeno.token);
  chk('…ni ver sus documentos', r.st >= 400, r.j);
  r = await fetch(sb.url + '/rest/v1/dian_documentos?select=*', { headers: cab(ajeno.token) }).then((x) => x.json());
  chk('La tabla de documentos con sesión de otro negocio: vacía (RLS)', Array.isArray(r) && r.length === 0, r);
  r = await rpc('srv_dian_reservar', { p_negocio: NEG, p_venta: 'x', p_tipo: 'pos', p_total: 1, p_cliente: null, p_usuario: null, p_referencia: null }, dueno.token);
  chk('Las funciones srv_dian_* no se pueden llamar desde la app', r.st >= 400, r);
  r = await rpc('dian_documentos_de', { p_negocio: NEG, p_ventas: ['v-1'] }, cajero.token);
  chk('El cajero ve el documento de su venta (sin el cuerpo completo)', r.st === 200 && r.j.length === 1 && r.j[0].documento === 'FPOS1' && !('cuerpo' in r.j[0]), r.j);
  await api('/dian/config', { negocio: NEG, accion: 'guardar', config: { activo: false } }, dueno.token);
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-apagado') }, cajero.token);
  chk('Facturación apagada → 409 «está apagada»', r.st === 409 && r.j.error === 'dian_inactivo', r.j);
  delete sb.env.MATIAS_EMAIL; delete sb.env.MATIAS_PASSWORD;
  r = await api('/dian/emitir', { negocio: NEG, venta: venta('v-sin') }, cajero.token);
  chk('Sin la cuenta de MATIAS en el servidor → 503 claro', r.st === 503 && r.j.error === 'dian_sin_proveedor', r.j);

  // ---------- Vento Admin ----------
  const adm = (await uno('select srv_dian_admin($1) j', [NEG])).j;
  chk('Vento Admin: resumen del negocio (aceptados, anulados, pendientes) y sus documentos', adm.config.client_uuid === CLIENTE_UUID && adm.resumen.aceptados >= 10 && adm.resumen.anulados >= 2 && adm.documentos.length >= 10, adm.resumen);
  const lista = (await uno('select srv_dian_admin_lista() j')).j;
  chk('Vento Admin: lista de negocios con facturación', lista.length === 1 && lista[0].nombre === 'Bar La 14' && lista[0].conectado === true, lista);

  // ---------- MATIAS simulado, registros y migración ----------
  chk('MATIAS simulado: ningún documento con errores de campos o aritmética (salvo los rechazos forzados)', M.malos.length === 0, M.malos);
  const todo = LOGS.join('\n');
  chk('Los registros no tienen el token, la contraseña de MATIAS ni el cuerpo de los documentos', LOGS.some((l) => l.includes('dian_envio')) && !/jwt-[0-9a-f]{8}/.test(todo) && !todo.includes(ENV.MATIAS_PASSWORD) && !todo.includes('Club Colombia'), LOGS.filter((l) => /jwt-|Club/.test(l)).slice(0, 2));
  let errMig = null;
  try { await sb.sql(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261029000000_dian.sql'), 'utf8')); } catch (e) { errMig = e.message; }
  chk('La migración se vuelve a correr sin errores y conserva los documentos', !errMig && (await uno("select count(*)::int n from dian_documentos where estado in ('aceptado','anulado')")).n >= 12, errMig);
}

(async () => {
  let sb = null;
  try {
    sb = await iniciar({ env: {} });
    console.log('ℹ️ Base de prueba ' + sb.base + ' (' + sb.migraciones.length + ' archivos SQL aplicados)');
    await pruebas(sb);
  } catch (e) {
    mal++; console.log('❌ Error inesperado → ' + (e && e.stack || e));
  } finally {
    if (sb) await sb.cerrar().catch(() => {});
  }
  console.log('RESULTADO', ok, 'bien', mal, 'mal');
  process.exit(mal ? 1 : 0);
})();
