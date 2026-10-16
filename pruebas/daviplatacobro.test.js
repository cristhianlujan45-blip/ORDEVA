// DaviPlata con código (API oficial «Pago con DaviPlata») de punta a punta en la APP contra el «Supabase local» REAL
// (PostgreSQL 16 + la Edge Function vento-pagos de verdad + supabase-js de verdad). Solo DaviPlata se simula, con el punto
// de inyección del transporte del servidor (pruebas/servidor/daviplata-simulado.js revisa cabeceras y cuerpos exactos).
//  1. El dueño crea su negocio, su cuenta de Vento Nube y lo sube.
//  2. Ajustes → 💜 Pagos → Conectar DaviPlata: sin TLS mutuo disponible → mensaje claro de usar el puente; archivo que no es
//     llave → aviso; certificado .cer BINARIO (DER) → se convierte a PEM; Comprobar → «DaviPlata: 🔵 conectado».
//  3. Mesa 1 → producto → «💜 Cobrar Nequi / DaviPlata» → «🔐 DaviPlata con código» → CC + número → «Enviar código» →
//     código de prueba del laboratorio → código equivocado («Te quedan 2 intentos») → código bueno → «✅ Pago aprobado ·
//     N.º de aprobación …» y la mesa queda pagada UNA sola vez (aunque se sincronice y llegue otra vez).
//  4. DaviPlata aprobó pero la respuesta se perdió → «Sin confirmar: revisa con el cliente» (nunca «Venció»).
//  5. Sin errores de página.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

function hayPostgres(){
  if(process.env.VENTO_PG_URL) return true;
  if(fs.existsSync('/usr/lib/postgresql')) return true;
  return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0;
}
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){
  const orig = console[k].bind(console);
  console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); };
}
const RAIZ = path.resolve(__dirname, '..');

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (este equipo no tiene PostgreSQL: se omitió esta prueba)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const { crearDavi, CRED, DOC } = require('./servidor/daviplata-simulado');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  const CAP = process.env.VENTO_CAPTURAS || '';
  let ok = 0, mal = 0;
  const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar();
  // El mismo módulo que carga la función vento-pagos dentro del arnés (misma URL → misma instancia).
  const D = await import(pathToFileURL(path.join(RAIZ, 'supabase', 'functions', 'vento-pagos', 'daviplata.ts')).href);
  const { descifrar } = await import(pathToFileURL(path.join(RAIZ, 'supabase', 'functions', 'vento-pagos', 'cifrado.ts')).href);
  const davi = crearDavi();
  const b = await chromium.launch();
  try{ await pruebas(); }
  catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  D.usarTransportePruebas(null);
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const uno = async (q, p) => (await sb.sql(q, p))[0];
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    const p = await ctx.newPage();
    const respuestas = [];
    p.on('pageerror', e => { errs.push(e.message); if(process.env.VENTO_DEBUG) console.log('PAGEERROR', e.stack); });
    p.on('dialog', d => d.accept(d.type() === 'prompt' ? (respuestas.shift() || d.defaultValue()) : undefined));
    const esperar = (fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000 }).then(() => true, () => false);
    const captura = async (nombre) => { if(CAP){ fs.mkdirSync(CAP, { recursive: true }); await p.screenshot({ path: path.join(CAP, nombre + '.png') }); } };
    const cerrarTodo = () => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    async function irAjustes(cat){
      await cerrarTodo();
      await p.click('#navMoreBtn'); await p.click('.more-tile[data-go="ajustes"]');
      if(await p.isVisible('#ajustesBackBtn')) await p.click('#ajustesBackBtn');
      await p.click('.ajustes-cat[data-cat="' + cat + '"]');
    }

    // ===================== 1. Negocio + Vento Nube =====================
    await p.goto(BASE + '/index.html');
    await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => window.ventoNube && window.ventoPagos, null, { timeout: 15000 });
    await p.fill('#authBiz', 'Bar Davi'); await p.fill('#authUser', 'dora'); await p.fill('#authPass', 'clave123');
    await p.click('#authTypePick .tp-btn'); await p.fill('#tipoSheet .tp-q', 'bar');
    await p.click('#tipoSheet .tp-it:has-text("Bar / Cervecería")');
    await p.click('#authBtn');
    await p.waitForSelector('#authOverlay', { state: 'hidden' });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await irAjustes('nube'); await p.click('#nubeAbrirAj'); await p.waitForSelector('#nubeOv.show #nubeCuerpo');
    await p.fill('#nubeEmail', 'dora@bardavi.co'); await p.fill('#nubePass', 'clave123'); await p.fill('#nubeNombre', 'Dora');
    await p.click('#nubeCrear'); await p.waitForSelector('#nubeSubirEste', { state: 'visible' });
    respuestas.push('Bar Davi');
    await p.click('#nubeSubirEste');
    const subido = await esperar(() => { const x = window.ventoNube.negocio(); return !!x && /quedó en tu cuenta/.test(document.getElementById('nubeMsg').textContent); });
    const NEG = await p.evaluate(() => (window.ventoNube.negocio() || {}).id);
    chk('1. Negocio subido a Vento Nube (dueña)', subido && /^[0-9a-f-]{36}$/.test(NEG || ''), NEG);
    // Al volver a abrir Vento arranca el módulo de pagos con el negocio (registra el celular y consulta el servidor).
    await p.reload();
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.negocio() && window.ventoPagos, null, { timeout: 15000 });
    const listo = await esperar(() => window.ventoPagos.estado().servidor === true && !!document.getElementById('vpCobrarCuenta'), null, 15000);
    await esperar(() => !!localStorage.getItem('vento_pagos_dev'), null, 10000);
    const devs = (await uno('select count(*)::int n from dispositivos where negocio_id = $1', [NEG])).n;
    chk('1. Servidor Vento de pagos activo y celular autorizado', listo && devs >= 1, { listo, devs, est: await p.evaluate(() => ({ s: window.ventoPagos.estado().servidor, b: !!document.getElementById('vpCobrarCuenta') })) });

    // ===================== 2. Ajustes → 💜 Pagos → Conectar DaviPlata =====================
    await irAjustes('pagos');
    await p.waitForSelector('#vpConDavi', { timeout: 10000 });
    await p.click('#vpConDavi');
    await p.waitForSelector('#vpAsisOv.show #vpFormD');
    const f0 = await p.evaluate(() => ({ amb: vpDamb.value, com: vpDcom.value, ter: vpDter.value, tr: vpDtr.value, puenteOculto: document.getElementById('vpDpte').hidden, wompi: !!document.getElementById('vpFormW') }));
    chk('2. Formulario «Conectar DaviPlata (API oficial)»: laboratorio con los códigos de Redeban de prueba, conexión directa, y Wompi como otra vía',
      f0.amb === 'sandbox' && f0.com === '0010203040' && f0.ter === 'ESB10934' && f0.tr === 'directo' && f0.puenteOculto && f0.wompi, f0);
    const txtForm = await p.textContent('#vpFormD');
    chk('2. Explica los requisitos (convenio con Davivienda, Developer Portal, certificado, Redeban)', /convenio con Davivienda/.test(txtForm) && /Developer Portal/.test(txtForm) && /certificado/.test(txtForm) && /Redeban/.test(txtForm), txtForm.slice(0, 300));
    await p.selectOption('#vpDtr', 'puente');
    chk('2. «Por mi puente de Cloudflare» pide la dirección y el secreto del puente', await p.isVisible('#vpDurl') && await p.isVisible('#vpDpsec') && !(await p.isVisible('#vpDcer')));
    await p.selectOption('#vpDtr', 'directo');
    await p.fill('#vpDcid', CRED.client_id); await p.fill('#vpDsec', CRED.client_secret);
    // Un .cer BINARIO (DER) como el que a veces entrega el Developer Portal, y una llave .pem.
    const der = Buffer.concat([Buffer.from([0x30, 0x82, 0x01, 0x22]), crypto.randomBytes(290)]);
    const llave = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
    await p.setInputFiles('#vpDkey', { name: 'nota.pem', mimeType: 'text/plain', buffer: Buffer.from('esto no es una llave') });
    chk('2. Un archivo que no es llave → aviso claro', await esperar(() => /no parece una llave/.test(document.getElementById('vpDkeyOk').textContent)));
    await p.setInputFiles('#vpDcer', { name: 'BancoDaviviendalab_2022.cer', mimeType: 'application/x-x509-ca-cert', buffer: der });
    await p.setInputFiles('#vpDkey', { name: 'BancoDaviviendalab_2022.pem', mimeType: 'application/x-pem-file', buffer: Buffer.from(llave) });
    chk('2. Certificado y llave leídos', await esperar(() => /leído/.test(document.getElementById('vpDcerOk').textContent) && /leído/.test(document.getElementById('vpDkeyOk').textContent)));
    // Sin el transporte simulado el servidor (Node) no tiene Deno.createHttpClient: debe decir que use el puente.
    D.usarTransportePruebas(null);
    await p.click('#vpDok');
    const mtls = await esperar(() => /TLS mutuo/.test(document.getElementById('vpAsisMsg').textContent) && /puente/.test(document.getElementById('vpAsisMsg').textContent), null, 15000);
    chk('2. Sin TLS mutuo disponible → «…no puede presentar el certificado… usa el puente»', mtls, await p.textContent('#vpAsisMsg'));
    D.usarTransportePruebas(davi.simular);
    await p.fill('#vpDsec', CRED.client_secret);
    await p.click('#vpDok');
    const conectado = await esperar(() => /DaviPlata: 🔵 conectado/.test(document.getElementById('vpAsisMsg').textContent), null, 15000);
    chk('2. «Comprobar y conectar» → verificado con DaviPlata: «DaviPlata: 🔵 conectado»', conectado, await p.textContent('#vpAsisMsg'));
    await captura('davi-1-conectar');
    const fila = await uno("select estado, ambiente, secreto, publico from pago_proveedores where negocio_id = $1 and proveedor = 'daviplata'", [NEG]);
    const guardada = fila ? await descifrar({ SUPABASE_SERVICE_ROLE_KEY: sb.serviceKey }, fila.secreto) : {};
    const pemEsperado = '-----BEGIN CERTIFICATE-----\n' + der.toString('base64').replace(/(.{64})/g, '$1\n').replace(/\n$/, '') + '\n-----END CERTIFICATE-----';
    chk('2. En el servidor: conectado (laboratorio), cifrado; el .cer binario llegó convertido a PEM y la llave tal cual',
      fila && fila.estado === 'conectado' && fila.ambiente === 'sandbox' && fila.secreto.startsWith('v1:') && guardada.cert === pemEsperado && guardada.key === llave.trim() &&
      guardada.id_comercio === '0010203040' && guardada.id_terminal === 'ESB10934', fila && { estado: fila.estado, cert: (guardada.cert || '').slice(0, 40) });
    chk('2. Los campos secretos se vacían después de guardar', await p.evaluate(() => [...document.querySelectorAll('#vpAsisOv input[type=password]')].every(i => !i.value)));
    await p.click('#vpAsisX');
    const tarjeta = await esperar(() => /Cobros por API DaviPlata \(laboratorio\)/.test((document.getElementById('vpGrupo') || {}).textContent || ''), null, 10000);
    chk('2. La tarjeta DAVIPLATA dice «Conectado · Cobros por API DaviPlata (laboratorio)»', tarjeta, await p.evaluate(() => (document.querySelector('#vpGrupo .vp-cards') || {}).textContent));

    // ===================== 3. Cobrar la mesa 1 con código =====================
    await cerrarTodo();
    await p.click('nav button[data-view="mesas"]');
    await p.click('#tableGrid .ticket >> nth=0');
    await p.click('#addProductSearch'); await p.fill('#addProductSearch', 'Aguila');
    await p.click('#addProductSuggestions .product-suggestion-item >> nth=0');
    await p.click('#qtyPlusBtn');
    await p.click('#addItemBtn');
    const saldo = await p.evaluate(() => tableTotal(1) - tablePaid(1));
    chk('3. Mesa 1 con productos y saldo pendiente', saldo > 0, saldo);
    await p.waitForSelector('#vpCobrarCuenta:not([hidden])', { timeout: 8000 });
    await p.click('#vpCobrarCuenta');
    await p.waitForSelector('#vpCobroOv.show [data-c="otp"]');
    const monto = await p.inputValue('#vpMonto');
    chk('3. «🔐 DaviPlata con código» aparece en el cobro con el saldo de la mesa', +monto === saldo && /DaviPlata con código/.test(await p.textContent('#vpCobroOv [data-c="otp"]')), monto);
    await p.click('#vpCobroOv [data-c="otp"]');
    await p.waitForSelector('#vpDnum');
    await p.selectOption('#vpDtipo', '01');
    await p.fill('#vpDnum', '1.134.568.019');
    await captura('davi-2-documento');
    await p.click('#vpDenviar');
    await p.waitForSelector('#vpDotp', { timeout: 10000 });
    const sesion = [...davi.sesiones.values()].slice(-1)[0] || {};
    const prueba = await p.textContent('#vpDprueba').catch(() => '');
    chk('3. «Enviar código al celular del cliente» → campo grande para el código y, en laboratorio, el código de prueba',
      sesion.doc === DOC && sesion.valor === String(saldo) && prueba.includes(sesion.otp) && await p.evaluate(() => getComputedStyle(document.getElementById('vpDotp')).fontSize === '34px'), { prueba, sesion });
    chk('3. En la pantalla del código ya no se ven las otras opciones y el valor queda fijo', !(await p.isVisible('#vpCobroOv [data-c="otp"]')) && await p.isDisabled('#vpMonto'));
    chk('3. Muestra el documento enmascarado (CC •••8019), nunca el número completo', /CC •••8019/.test(await p.textContent('#vpCobroRes')) && !(await p.textContent('#vpCobroOv')).includes(DOC));
    await captura('davi-3-codigo');
    await p.fill('#vpDotp', '000000');
    await p.click('#vpDconf');
    chk('3. Código equivocado → «El código no es correcto. Te quedan 2 intentos.»', await esperar(() => /Te quedan 2 intentos/.test(document.getElementById('vpDmsg').textContent)), await p.textContent('#vpDmsg'));
    await p.click('#vpDusar');
    await p.click('#vpDconf');
    const aprobado = await esperar(() => { const e = document.getElementById('vpAprobado'); return !!e && /✅ Pago aprobado · N\.º de aprobación \d{6}/.test(e.textContent); }, null, 10000);
    const P = await uno("select * from pagos where negocio_id = $1 and proveedor = 'daviplata' order by creado_en desc limit 1", [NEG]);
    chk('3. «Confirmar pago» → «✅ Pago aprobado · N.º de aprobación …» (el de DaviPlata)', aprobado && P && P.estado === 'aprobado' && (await p.textContent('#vpAprobado')).includes(P.aprobacion), await p.textContent('#vpCobroRes'));
    await captura('davi-4-aprobado');
    const registrada = await esperar(() => (data.tables[1].payments || []).filter(x => x.pagoDigital).length === 1, null, 8000);
    let pagosMesa = await p.evaluate(() => (data.tables[1].payments || []).map(x => ({ amount: x.amount, method: x.method, note: x.note, dig: !!x.pagoDigital })));
    chk('3. Se registra en la cuenta de la mesa 1 por el camino de siempre (💜 DaviPlata, verificado) y la mesa queda al día',
      registrada && pagosMesa.length === 1 && pagosMesa[0].amount === saldo && /DaviPlata/.test(pagosMesa[0].note) && await p.evaluate(() => tableTotal(1) - tablePaid(1)) === 0, pagosMesa);
    const enBase = await uno('select aplicado_en, aplicado_mesa from pagos where id = $1', [P.id]);
    chk('3. En el servidor queda aplicado a la mesa 1 (una sola vez)', enBase.aplicado_en && enBase.aplicado_mesa === '1', enBase);
    // Llega otra vez (sincronización / tiempo real de otro celular): no se duplica.
    await p.evaluate(() => { localStorage.removeItem('vento_pagos_visto'); return window.ventoPagos.sincronizar(); });
    await p.evaluate(id => window.ventoPagos.recibir(Object.assign({}, window.ventoPagos._cache[id]), true), P.id);
    await p.waitForTimeout(1500);
    pagosMesa = await p.evaluate(() => (data.tables[1].payments || []).filter(x => x.pagoDigital).length);
    chk('3. Aunque el pago llegue otra vez (sincronizar / tiempo real) la mesa lo tiene UNA sola vez', pagosMesa === 1, pagosMesa);
    const hist = await p.evaluate(() => { const l = (data.pagos && data.pagos.lista) || []; return l.filter(x => x.srv).map(x => ({ app: x.app, fuente: x.fuente, aplicado: x.aplicado })); });
    chk('3. En «💜 Pagos» queda como DaviPlata verificado por DaviPlata con su N.º', hist.length === 1 && hist[0].app === 'DaviPlata' && /Verificado por DaviPlata · N\.º \d{6}/.test(hist[0].fuente) && hist[0].aplicado === 1, hist);
    chk('3. DaviPlata simulado: todas las peticiones cumplieron la especificación', davi.malos.length === 0, davi.malos);

    // ===================== 4. DaviPlata aprobó pero la respuesta se perdió =====================
    // Nunca debe decir «venció»/«rechazado» (la caja cobraría otra vez): «Sin confirmar: revisa con el cliente».
    await cerrarTodo();
    let cortar = 'despues';
    D.usarTransportePruebas(async (q) => {
      if(cortar && q.ruta === '/daviplata/v1/confirmarCompra'){ const m = cortar; cortar = null; if(m === 'despues') await davi.simular(q); throw new Error('socket hang up'); }
      return davi.simular(q);
    });
    await p.evaluate(() => window.ventoPagosCobrar(null, 4500));
    await p.click('#vpCobroOv [data-c="otp"]');
    await p.fill('#vpDnum', '1134568019');
    await p.click('#vpDenviar');
    await p.waitForSelector('#vpDotp', { timeout: 10000 });
    await p.click('#vpDusar');
    await p.click('#vpDconf');
    const inc = await esperar(() => /no se sabe si aprobó/.test(document.getElementById('vpDmsg').textContent) && document.getElementById('vpDotp').value.length === 6 && !document.getElementById('vpDconf').disabled);
    chk('4. Sin respuesta de DaviPlata → «no se sabe si aprobó… pregúntale al cliente» y el MISMO código queda para reintentar', inc, await p.textContent('#vpDmsg').catch(() => ''));
    await p.click('#vpDconf');
    const sinConf = await esperar(() => { const t = document.getElementById('vpCobroRes').textContent; return /Sin confirmar: revisa con el cliente/.test(t) && /cobrarle otra vez/.test(t) && !/Venció|Rechazado/.test(t); });
    chk('4. Al reintentar (DaviPlata ya la había usado) → «⚠️ Sin confirmar: revisa con el cliente», nunca «Venció»', sinConf, await p.textContent('#vpCobroRes').catch(() => ''));
    const PI = await uno("select estado, incierto from pagos where negocio_id = $1 and proveedor = 'daviplata' and monto = 4500", [NEG]);
    chk('4. En el servidor: «error» con incierto = true', PI && PI.estado === 'error' && PI.incierto === true, PI);
    D.usarTransportePruebas(davi.simular);
    await ctx.close();
  }
})();
