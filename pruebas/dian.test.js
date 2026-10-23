// Facturación electrónica DIAN de punta a punta (PostgreSQL REAL + Servidor ORDEVA + la app de verdad + MATIAS
// simulado, que revisa campos y aritmética como la DIAN):
//  1. Ajustes → 🧾 Facturación electrónica DIAN: el dueño escribe los datos y la resolución, guarda y la prende.
//  2. Una venta en la caja (POS) → documento P.O.S. electrónico validado: número, CUDE y QR en el historial, en el
//     recibo (pantalla / WhatsApp / impresora térmica ESC/POS con el QR nativo).
//  3. «↩ Deshacer» el cobro → nota crédito (anulación) validada.
//  4. Sin internet: la venta queda «enviando» en la cola y sale sola al volver la conexión.
//  5. «🧾 Factura a nombre de…» en el historial: anula el P.O.S. y saca la factura electrónica del cliente.
//  6. En la caja: «🧾 Factura electrónica (datos del cliente)» antes de cobrar.
//  7. Corregir una venta validada: nota crédito del documento viejo + el documento nuevo.
//  8. El cajero ve la facturación pero no la cambia.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const { crearMatias } = require('./servidor/matias-simulado');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); } };
  const sb = await iniciar({ env: { MATIAS_EMAIL: 'vento@casa.co', MATIAS_PASSWORD: 'clave-matias' } });
  const F = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', 'vento-pagos', 'dian.ts')).href);
  const M = crearMatias({ email: 'vento@casa.co', password: 'clave-matias', resoluciones: ['18764071164948', '18760000001'] });
  F.usarTransportePruebas(M.simular);
  const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('MATIAS simulado: ningún documento con errores de campos o aritmética', M.malos.length === 0, M.malos);
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 12000, polling: 200 }).then(() => true, () => false);
    async function equipo(nombre){
      const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      p.on('dialog', d => d.accept());
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta && window.ventoDian, null, { timeout: 15000 });
      return { ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const docs = (q, args) => sb.sql(q, args);

    // ===== Dueño: cuenta y negocio =====
    const { p } = await equipo('dueño');
    await p.fill('#authBiz', 'Tienda La 14'); await p.fill('#authUser', 'dueno@la14.co'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    chk('El dueño crea la cuenta y entra a ORDEVA Nube', await esperar(p, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(p);
    const NEG = (await p.evaluate(() => window.ventoNube.negocio())).id;
    chk('Apagada al empezar: la venta no sale a la DIAN', await p.evaluate(() => window.ventoDian.activo() === false));

    // ===== 1. Ajustes → Negocio → 🧾 Facturación electrónica DIAN =====
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="ajustes"]'); if(b) b.click(); });
    await p.evaluate(() => { const b = document.querySelector('.ajustes-cat[data-cat="negocio"]'); b && b.click(); });
    chk('1. Sale la sección «🧾 Facturación electrónica DIAN» con los pasos y el interruptor', await esperar(p, () => { const g = document.getElementById('dianGrupo'); return g && !g.hidden && g.offsetParent !== null && !!document.getElementById('vdOn') && /resolución de numeración/.test(g.textContent); }, null, 10000));
    await p.fill('#vdRazon', 'TIENDA LA 14 SAS');
    await p.fill('#vdNit', '901091403');
    chk('1. El DV del NIT se calcula solo (901091403 → 2)', await p.inputValue('#vdDv') === '2', await p.inputValue('#vdDv'));
    await p.fill('#vdDir', 'Calle 14 # 5-20, Bogotá'); await p.fill('#vdCorreo', 'tienda@la14.co');
    await p.selectOption('#vdImp', 'iva19');
    await p.fill('#vdPosRes', '18764071164948'); await p.fill('#vdPosPre', 'fpos'); await p.fill('#vdPosDesde', '1'); await p.fill('#vdPosHasta', '5000'); await p.fill('#vdPosVence', '2030-12-31');
    await p.click('#vdGuardar');
    chk('1. «Guardar»: queda guardado en el servidor (aún apagada)', await esperar(p, () => /Guardado/.test(document.getElementById('vdMsg').textContent), null, 10000) &&
      (await docs('select nit, pos_prefijo, activo from dian_config where negocio_id = $1', [NEG]))[0].pos_prefijo === 'FPOS');
    await p.click('label.switch:has(#vdOn)');
    chk('1. Prender: «está prendida» y el aviso de ambiente de pruebas', await esperar(p, () => /Prendida/.test(document.getElementById('dianCaja').textContent) && /Ambiente de pruebas/i.test(document.getElementById('dianCaja').textContent), null, 10000) &&
      await p.evaluate(() => window.ventoDian.activo() === true));
    await p.click('#vdProbar');
    chk('1. «Probar conexión»: conectado con MATIAS (falta que ORDEVA Admin conecte el NIT)', await esperar(p, () => /Conexión con MATIAS lista/.test(document.getElementById('vdMsg').textContent), null, 10000));

    // ===== 2. Venta en la caja → P.O.S. electrónico =====
    const vender = (items, pago) => p.evaluate(async ([items, pago]) => {
      const ids = [];
      for(const it of items){ let pr = data.products.find(x => x.name === it.name); if(!pr){ pr = { id: 'p' + Math.random().toString(36).slice(2), name: it.name, price: it.price, cost: 0 }; if(it.iva != null) pr.iva = it.iva; data.products.push(pr); } ids.push([pr.id, it.qty]); }
      saveData(); window.ventoPOS.vaciar();
      ids.forEach(([id, n]) => window.ventoPOS.agregar(id, n));
      const e = await window.ventoPOS.cobrar({ pago });
      return e && e.id;
    }, [items, pago]);
    const venta1 = await vender([{ name: 'Gaseosa 400', price: 3500, qty: 2 }, { name: 'Arroz Diana 1kg', price: 4800, qty: 1, iva: 5 }], { method: 'efectivo', nota: 'Efectivo', metodo: 'efectivo', vueltas: 0 });
    chk('2. Cobrar en la caja: la venta queda «enviando» y sale sola a la DIAN', !!venta1);
    chk('2. …validada: FPOS1 con CUDE y QR de la DIAN en la venta', await esperar(p, id => { const h = data.history.find(x => x.id === id); return h && h.dian && h.dian.estado === 'aceptado' && h.dian.documento === 'FPOS1' && /^[0-9a-f]{96}$/.test(h.dian.cude) && /catalogo-vpfe/.test(h.dian.qr); }, venta1, 15000),
      await p.evaluate(id => data.history.find(x => x.id === id).dian, venta1));
    const env1 = M.de(l => l.ruta === '/invoice')[0];
    chk('2. A la DIAN fue lo cobrado: 2 gaseosas (IVA 19 %) + arroz con su IVA del 5 % del producto, total $11.800', env1 && env1.cuerpo.lines.length === 2 && env1.cuerpo.lines[1].tax_totals[0].percent === 5 &&
      Math.abs(Number(env1.cuerpo.legal_monetary_totals.payable_amount) - 11800) < 0.05 && env1.cuerpo.payments[0].means_payment_id === 10, env1 && env1.cuerpo);
    const rec = await p.evaluate(id => { const h = data.history.find(x => x.id === id), rd = histReceiptData(h); return { html: buildReceiptHTML(rd), txt: buildReceiptText(rd) }; }, venta1);
    chk('2. Recibo: «Documento equivalente electrónico P.O.S. N.º FPOS1», resolución con rango y vigencia, CUDE y QR', /Documento equivalente electrónico P\.O\.S\. N\.º FPOS1/.test(rec.html) && /Resolución DIAN N\.º 18764071164948 · del FPOS1 al FPOS5000 · vigente hasta 2030-12-31/.test(rec.html) &&
      /CUDE: [0-9a-f]{96}/.test(rec.html) && /<img src="data:image\/png;base64,[^"]+" alt="QR DIAN"/.test(rec.html) && /IVA 19%: base/.test(rec.html) && !/Factura de venta N\.º FV-/.test(rec.html), rec.html.slice(-1500));
    chk('2. Recibo por WhatsApp (texto): número DIAN, CUDE y el enlace de consulta de la DIAN', /FPOS1/.test(rec.txt) && /CUDE:/.test(rec.txt) && /Consulta en la DIAN: https:\/\/catalogo-vpfe/.test(rec.txt) && /AMBIENTE DE PRUEBAS/.test(rec.txt), rec.txt);
    const esc = await p.evaluate(id => { const h = data.history.find(x => x.id === id), by = Array.from(window.ventoEscPos.recibo(histReceiptData(h), { ancho: 48 })); const s = String.fromCharCode.apply(null, by.map(c => c < 128 ? c : 63));
      let qr = false; for(let i = 0; i < by.length - 6; i++) if(by[i] === 0x1D && by[i + 1] === 0x28 && by[i + 2] === 0x6B && by[i + 6] === 0x50) qr = true; return { s, qr }; }, venta1);
    chk('2. Impresora térmica (ESC/POS): el documento DIAN, el CUDE y el código QR nativo (GS ( k)', /FPOS1/.test(esc.s) && /CUDE:/.test(esc.s) && esc.qr, esc.s.slice(-600));
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="historial"]'); if(b) b.click(); });
    await p.evaluate(() => { renderHistorial(); const r = document.querySelector('.hist-row'); r && r.click(); });
    chk('2. Historial: «✅ Validado por la DIAN», PDF, «Factura a nombre de…» y «Anular»', await esperar(p, () => { const d = document.querySelector('.hist-row .hist-dian'); return d && /Validado por la DIAN/.test(d.textContent) && !!d.querySelector('[data-dian="factura"]') && !!d.querySelector('[data-dian="anular"]') && /PDF/.test(d.textContent); }, null, 8000));

    // ===== 3. Deshacer el cobro → nota crédito =====
    const venta2 = await vender([{ name: 'Gaseosa 400', price: 3500, qty: 1 }], { method: 'transferencia', nota: 'Nequi', metodo: 'nequi', vueltas: 0 });
    await esperar(p, id => { const h = data.history.find(x => x.id === id); return h && h.dian && h.dian.estado === 'aceptado'; }, venta2, 15000);
    await p.click('#pzDeshacer .pz-dbtn:not(.pz-dextra)', { timeout: 5000 }).catch(() => {});
    let nc = null; for(let i = 0; i < 40 && !nc; i++){ nc = (await docs("select prefijo || numero n, estado from dian_documentos where negocio_id = $1 and tipo = 'nota'", [NEG]))[0]; if(!nc || nc.estado !== 'aceptado'){ nc = null; await new Promise(r => setTimeout(r, 300)); } }
    chk('3. «↩ Deshacer» el cobro (ya validado): nota crédito NC1 validada y el documento queda anulado', nc && nc.n === 'NC1' && (await docs("select estado from dian_documentos where venta_id = $1 and tipo = 'pos'", [venta2]))[0].estado === 'anulado' &&
      !(await p.evaluate(id => data.history.some(x => x.id === id), venta2)), nc);

    // ===== 4. Sin internet =====
    const sinRed = r => r.abort('internetdisconnected');
    await p.route(/\/functions\/v1\/vento-pagos\/dian\/emitir/, sinRed);
    const venta3 = await vender([{ name: 'Pan', price: 500, qty: 6 }], { method: 'efectivo', nota: 'Efectivo', metodo: 'efectivo', vueltas: 0 });
    await new Promise(r => setTimeout(r, 1500));
    const c4 = await p.evaluate(id => ({ estado: (data.history.find(x => x.id === id).dian || {}).estado, cola: window.ventoDian.cola().length }), venta3);
    chk('4. Sin conexión: la venta queda «enviando» en la cola (no se pierde ni se repite)', c4.estado === 'enviando' && c4.cola === 1, c4);
    await p.unroute(/\/functions\/v1\/vento-pagos\/dian\/emitir/, sinRed);
    await p.evaluate(() => { const c = window.ventoDian.cola(); c.forEach(x => { x.prox = 0; }); localStorage.setItem('vento_dian_cola:' + window.ventoNube.negocio().id, JSON.stringify(c)); window.dispatchEvent(new Event('online')); });
    chk('4. Vuelve la conexión: sale sola y queda validada (FPOS3)', await esperar(p, id => { const h = data.history.find(x => x.id === id); return h.dian.estado === 'aceptado' && h.dian.documento === 'FPOS3'; }, venta3, 15000) &&
      await p.evaluate(() => window.ventoDian.cola().length === 0), await p.evaluate(id => data.history.find(x => x.id === id).dian, venta3));

    // ===== 5. «🧾 Factura a nombre de…» desde el historial =====
    await sb.sql("update dian_config set fe_resolucion = '18760000001', fe_prefijo = 'FE', fe_desde = 100, fe_hasta = 200, fe_siguiente = 100, fe_vence = '2030-01-01' where negocio_id = $1", [NEG]);
    await p.evaluate(() => window.ventoDian.cargar());
    await p.evaluate(id => { renderHistorial(); const r = [...document.querySelectorAll('.hist-row')].find(x => x.querySelector('[data-dian="factura"][data-id="' + id + '"]')); if(r && !r.classList.contains('open')) r.click(); }, venta1);
    await p.evaluate(id => document.querySelector('[data-dian="factura"][data-id="' + id + '"]').click(), venta1);
    await p.waitForSelector('#vdcNum', { timeout: 5000 });
    await p.fill('#vdcNum', '1063279307'); await p.fill('#vdcNom', 'Lewis López');
    await p.click('#vdcSi');
    chk('5. Sin correo no deja sacar la factura (la DIAN se la manda al cliente)', /correo/.test(await p.textContent('#vdcErr')));
    await p.fill('#vdcCorreo', 'lewis@correo.co'); await p.click('#vdcSi');
    chk('5. Sale la FACTURA ELECTRÓNICA FE100 a nombre del cliente…', await esperar(p, id => { const h = data.history.find(x => x.id === id); return h.dian.tipo === 'factura' && h.dian.estado === 'aceptado' && h.dian.documento === 'FE100'; }, venta1, 15000),
      await p.evaluate(id => data.history.find(x => x.id === id).dian, venta1));
    let fe = null; for(let i = 0; i < 40 && !fe; i++){ const r = await docs("select estado from dian_documentos where venta_id = $1 and tipo = 'pos'", [venta1]); if(r[0] && r[0].estado === 'anulado') fe = r[0]; else await new Promise(r2 => setTimeout(r2, 300)); }
    const feEnv = M.de(l => l.ruta === '/invoice' && l.cuerpo.type_document_id === 7)[0];
    chk('5. …el P.O.S. FPOS1 queda anulado con su nota crédito, y la factura lleva cédula y correo', !!fe && feEnv && feEnv.cuerpo.customer.dni === '1063279307' && feEnv.cuerpo.customer.email === 'lewis@correo.co' &&
      (await docs("select count(*)::int n from dian_documentos where negocio_id = $1 and tipo = 'nota' and estado = 'aceptado'", [NEG]))[0].n === 2);

    // ===== 6. En la caja: factura con los datos del cliente antes de cobrar =====
    const pz = p.evaluate(() => { window.ventoPOS.vaciar(); const pr = data.products.find(x => x.name === 'Pan'); window.ventoPOS.agregar(pr.id, 4); return window.ventoPOS.cobrar({}).then(e => e && e.id); });
    await p.waitForSelector('.pz-dian-cli', { timeout: 5000 });
    chk('6. «¿Cómo pagó?» tiene «🧾 Factura electrónica (datos del cliente)»', /Factura electrónica \(datos del cliente\)/.test(await p.textContent('.pz-dian-cli')));
    await p.click('.pz-dian-cli');
    await p.selectOption('#vdcTipo', 'NIT'); await p.fill('#vdcNum', '900123456');
    chk('6. Con NIT, el DV se calcula solo', await p.inputValue('#vdcDv') === '8', await p.inputValue('#vdcDv'));
    await p.fill('#vdcNom', 'Empresa SAS'); await p.fill('#vdcCorreo', 'compras@empresa.co'); await p.click('#vdcSi');
    chk('6. El botón queda «Factura a nombre de Empresa SAS ✓»', await esperar(p, () => /Empresa SAS ✓/.test((document.querySelector('.pz-dian-cli') || {}).textContent || ''), null, 3000));
    await p.click('.pz-met[data-m="efectivo"]');
    const venta6 = await pz;
    chk('6. Cobrado: sale directo como factura electrónica FE101 a nombre de la empresa (NIT)', await esperar(p, id => { const h = data.history.find(x => x.id === id); return h && h.dian && h.dian.tipo === 'factura' && h.dian.estado === 'aceptado' && h.dian.documento === 'FE101'; }, venta6, 15000) &&
      M.de(l => l.ruta === '/invoice' && l.cuerpo.type_document_id === 7 && l.cuerpo.customer.dni === '900123456' && l.cuerpo.customer.identity_document_id === 3).length === 1);

    // ===== 7. Corregir una venta validada =====
    await p.evaluate(id => { const h = data.history.find(x => x.id === id); h.items[0].qty = 4; h.total = 2000; h.payments[0].amount = 2000; window.ventoDian.alCorregir(h); saveData(); }, venta3);
    chk('7. Corregir: el documento viejo (FPOS3) se anula y sale uno nuevo por $2.000', await esperar(p, id => { const h = data.history.find(x => x.id === id); return h.dian.estado === 'aceptado' && h.dian.documento === 'FPOS4' && /~c/.test(h.dian.venta); }, venta3, 15000) &&
      await (async () => { for(let i = 0; i < 40; i++){ const r = await docs("select estado from dian_documentos where venta_id = $1 and tipo = 'pos'", [venta3]); if(r[0] && r[0].estado === 'anulado') return true; await new Promise(r2 => setTimeout(r2, 300)); } return false; })(),
      await p.evaluate(id => data.history.find(x => x.id === id).dian, venta3));

    // ===== 8. El cajero: ve, no cambia =====
    const cod = await p.evaluate(async () => { const c = await window.ventoNube.cliente(); const r = await c.rpc('crear_invitacion', { p_negocio: window.ventoNube.negocio().id, p_rol: 'cajero' }); return r.data; });
    const caj = await sb.usuario('caja@la14.co');
    await fetch(sb.url + '/rest/v1/rpc/unirse_con_codigo', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + caj.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_codigo: cod, p_nombre: 'Caja' }) });
    const r8 = await fetch(sb.url + '/functions/v1/vento-pagos/dian/config', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + caj.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ negocio: NEG, accion: 'guardar', config: { activo: false } }) });
    chk('8. El cajero no puede apagar ni cambiar la facturación (403)', r8.status === 403);
    const tot = (await docs("select count(*) filter (where estado = 'aceptado')::int a, count(*) filter (where estado = 'anulado')::int an, count(*)::int t from dian_documentos where negocio_id = $1", [NEG]))[0];
    chk('Al final en el servidor: cada documento validado o anulado, nada pendiente', tot.a + tot.an === tot.t && tot.t >= 9, tot);
  }
})();
