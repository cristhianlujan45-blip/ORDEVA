// 🐞 Errores de los equipos → ORDEVA Admin, de punta a punta (PostgreSQL REAL + Edge Function + la app de verdad):
//  1. Un error de la app en el equipo de un negocio llega al servidor (con negocio, usuario, versión y la línea).
//     Nunca va el link secreto (#… de la dirección) ni datos del negocio.
//  2. Vigía de la música: canciones esperando sin reproductor, y reproductor prendido que no arranca → reporte.
//  3. Página del QR (celular del cliente): el local no confirmó el pedido en 3 min → reporte.
//  4. ORDEVA Admin → 🐞 Errores: los ve agrupados, con el globito; el detalle dice dónde pasó; «✅ Ya lo arreglé».
//  5. 💜 Frases de pago: un aviso que ORDEVA no entiende → «Enseñar esta frase» en el panel → el siguiente aviso igual ya es
//     un pago en la app del negocio (sin reinstalar).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }
const ADMIN = 'cristhianwkh@gmail.com', CLAVE_ADMIN = 'Clave-de-prueba-77';

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página (fuera del error de prueba)', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const filas = async (q, p) => sb.sql(q, p);
    const hasta = async (fn, ms) => { const fin = Date.now() + (ms || 15000); while(Date.now() < fin){ if(await fn()) return true; await new Promise(r => setTimeout(r, 400)); } return false; };
    async function pagina(nombre, url){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => { if(!/vamosMal|nada is not a function|reading 'nada'/.test(e.message)) errs.push(nombre + ': ' + e.message); });
      await p.goto(url);
      return { ctx, p };
    }

    // ===== 1. Error de la app =====
    const A = await pagina('negocio', BASE + '/index.html#lic=VENTO-SECRETO-1234-ABCD');
    await A.p.waitForSelector('#authOverlay:not([hidden])');
    await A.p.fill('#authBiz', 'Bar Errores'); await A.p.fill('#authUser', 'ana'); await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    await A.p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await A.p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await A.p.addScriptTag({ content: 'setTimeout(function vamosMal(){ var o = null; o.nada(); }, 0);' });
    await A.p.waitForTimeout(300);
    await A.p.evaluate(() => window.ventoErrores.enviar());
    const llego = await hasta(async () => (await filas("select 1 from app_errores where tipo = 'js' and negocio = 'Bar Errores'")).length > 0);
    chk('1. El error de la app llegó al servidor', llego);
    const e1 = (await filas("select * from app_errores where tipo = 'js' and negocio = 'Bar Errores'"))[0] || {};
    chk('1. Con negocio, usuario, versión, página y la línea del error', e1.usuario === 'ana' && /^\d+\.\d+\.\d+$/.test(e1.version || '') && e1.pagina === 'index' && e1.detalle && e1.detalle.linea > 0 && /nada/.test(e1.mensaje), e1);
    chk('1. Nunca va el link secreto de la dirección', !JSON.stringify(e1).includes('SECRETO'), e1.detalle);
    chk('1. Ni datos del negocio (productos, ventas)', !/products|ventas|tables/.test(JSON.stringify(e1.detalle || {})));
    await A.p.evaluate(() => { for(let i = 0; i < 5; i++) setTimeout(function vamosMal(){ var o = null; o.nada(); }, 0); });
    await A.p.addScriptTag({ content: 'setTimeout(function vamosMal(){ var o = null; o.nada(); }, 0);' });
    await A.p.waitForTimeout(400);
    chk('1. El mismo error repetido no se manda cada vez: se juntan las veces', await A.p.evaluate(() => (window.ventoErrores.pendientes()[0] || {}).veces >= 1) && (await filas("select count(*)::int n from app_errores where tipo = 'js' and negocio = 'Bar Errores'"))[0].n === 1);

    // ===== 2. Vigía de la música =====
    await A.p.evaluate(() => {
      const M = window.vitoMod; data.musicOn = true; saveData();
      M.SS('vito_cola', [{ id: 'c1', mesa: 2, mesaNombre: 'Mesa 2', song: 'Joe Arroyo - La Rebelion', title: 'La Rebelion', vid: 'rebelion001', ok: true, ts: Date.now() - 5 * 6e4, status: 'approved', done: false }]);
      M.SS('vito_auto_play', { on: false });
      window.__mzVigia.sinrep = Date.now() - 10 * 6e4; window.vitoMusicaVigilar();
      window.ventoErrores.enviar();
    });
    chk('2. Canciones esperando y ningún reproductor prendido → reporte', await hasta(async () => (await filas("select 1 from app_errores where huella = 'musica|sin-reproductor' and negocio = 'Bar Errores'")).length > 0));
    await A.p.evaluate(() => {
      window.vitoMod.SS('vito_auto_play', { on: true });               // el reproductor de YouTube no carga (sin internet a youtube.com)
      window.__mzVigia.quieto = Date.now() - 10 * 6e4; window.vitoMusicaVigilar();
      window.ventoErrores.enviar();
    });
    chk('2. Reproductor prendido que no arranca → reporte con el estado del reproductor', await hasta(async () => (await filas("select 1 from app_errores where huella = 'musica|no-arranca' and (detalle->>'yListo') = 'false'")).length > 0),
      await filas("select huella, detalle from app_errores where tipo = 'musica'"));

    // ===== 3. Página del QR: el local no confirma =====
    await A.p.evaluate(base => { const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c); M.reconectarPedidos(); }, BASE);
    const link = await A.p.evaluate(() => window.vitoMod.linkMesa(window.vitoMod.qCfg(), 1));
    await A.ctx.close();                                                   // el local cerró ORDEVA: nadie confirma
    const C = await pagina('cliente', link);
    await C.p.fill('#p', '2 Águila'); await C.p.click('#b');
    await C.p.waitForTimeout(800);
    await C.p.evaluate(() => { const l = jget(MISK, []); l.forEach(x => { x.at = Date.now() - 200000; x.re = 1; }); jset(MISK, l); });
    await C.p.waitForFunction(() => /no ha confirmado|not confirmed|confirm/i.test(document.getElementById('m').textContent), null, { timeout: 15000 }).catch(() => {});
    await C.p.evaluate(() => window.ventoErrores.enviar());
    chk('3. El celular del cliente reporta que el local no confirmó el pedido', await hasta(async () => (await filas("select 1 from app_errores where huella = 'pedido|sin-confirmar' and pagina = 'pedido' and (detalle->>'mesa') = '1'")).length > 0),
      await filas("select huella, pagina, detalle from app_errores where tipo = 'pedido'"));

    // ===== 4. ORDEVA Admin =====
    await sb.usuario(ADMIN, CLAVE_ADMIN);
    const D = await pagina('admin', BASE + '/admin.html');
    await D.p.waitForFunction(() => !document.getElementById('lock').hidden && !document.getElementById('lkEntrar').hidden, null, { timeout: 12000 });
    await D.p.fill('#lkCorreo', ADMIN); await D.p.fill('#lkClave', CLAVE_ADMIN); await D.p.click('#lkGo');
    await D.p.waitForFunction(() => document.getElementById('lock').hidden, null, { timeout: 12000 });
    chk('4. Globito en la pestaña 🐞 Errores con los errores sin resolver', await D.p.waitForFunction(() => +document.getElementById('erBadge').textContent >= 4, null, { timeout: 12000 }).then(() => true, () => false), await D.p.textContent('#erBadge'));
    await D.p.click('#tabs [data-t="errores"]');
    await D.p.waitForSelector('#erLista [data-error]');
    const lista = await D.p.textContent('#erLista');
    chk('4. Se ven: el error de la app, la música y el pedido sin confirmar', /nada/.test(lista) && /reproductor no arranca/.test(lista) && /ningún reproductor/.test(lista) && /no confirmó un pedido/.test(lista), lista.slice(0, 600));
    await D.p.selectOption('#erTipo', 'musica');
    chk('4. Filtrar por tipo (🎵 Música)', await D.p.$$eval('#erLista [data-error]', l => l.length) === 2);
    await D.p.click('#erLista [data-error="musica|no-arranca"] .t');
    await D.p.waitForSelector('#dlgEr[open]');
    const det = await D.p.textContent('#erInfo');
    chk('4. El detalle dice dónde pasó (negocio, usuario) y el estado del reproductor', /Bar Errores/.test(det) && /ana/.test(det) && /yListo/.test(det), det.slice(0, 500));
    await D.p.click('#erResolver');
    chk('4. «✅ Ya lo arreglé» lo quita de los sin resolver', await D.p.waitForFunction(() => !document.querySelector('#erLista [data-error="musica|no-arranca"]'), null, { timeout: 8000 }).then(() => true, () => false));
    chk('4. … y en el servidor quedó resuelto', (await filas("select bool_and(resuelto) r from app_errores where huella = 'musica|no-arranca'"))[0].r === true);
    await D.p.evaluate(() => document.getElementById('dlgEr').open && document.getElementById('dlgEr').close());

    // ===== 5. 💜 Frases de pago: el banco escribe el aviso distinto → el administrador lo enseña y le llega al instante =====
    const N = await pagina('negocio-frases', BASE + '/index.html');
    await N.p.waitForSelector('#authOverlay:not([hidden])');
    await N.p.fill('#authBiz', 'Bar Frases'); await N.p.fill('#authUser', 'leo'); await N.p.fill('#authPass', 'clave123'); await N.p.click('#authBtn');
    await N.p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await N.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await N.p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const avisar = id => N.p.evaluate(id => { window.pagosRecibirTexto('Bancolombia | Bancolombia | Movimiento en tu cuenta por $4.000 de JUAN PEREZ', id); }, id);
    await avisar('and-frase-1');
    chk('5. Un aviso que ORDEVA no entiende («Movimiento en tu cuenta por $4.000») no se toma como pago…', await N.p.waitForTimeout(1500).then(() => N.p.evaluate(() => !(data.pagos.lista || []).some(x => x.monto === 4000))));
    chk('5. … y le llega al administrador (sin nombres ni valores)', await hasta(async () => (await filas("select 1 from app_errores where tipo = 'pago' and negocio = 'Bar Frases' and detalle->>'texto' like '%Movimiento en tu cuenta por $# de NOMBRE%'")).length > 0),
      await filas("select mensaje, detalle from app_errores where tipo = 'pago'"));
    await D.p.selectOption('#erTipo', 'pago'); await D.p.click('#erRef');
    await D.p.waitForSelector('#erLista [data-error] .t');
    await D.p.click('#erLista [data-error] .t');
    await D.p.waitForSelector('#dlgEr[open]');
    chk('5. En el aviso: «💜 Enseñar esta frase»', await D.p.isVisible('#erEnsenar'));
    await D.p.click('#erEnsenar');
    chk('5. … llena la frase con el texto fijo del aviso («Movimiento en tu cuenta por») y el banco', await D.p.inputValue('#frTexto') === 'Movimiento en tu cuenta por' && await D.p.inputValue('#frBanco') === 'Bancolombia', [await D.p.inputValue('#frTexto'), await D.p.inputValue('#frBanco')]);
    await D.p.click('#frAgregar');
    chk('5. Queda en «💜 Frases de pago» del panel', await D.p.waitForFunction(() => /Movimiento en tu cuenta por/.test(document.getElementById('frLista').textContent), null, { timeout: 8000 }).then(() => true, () => false));
    await N.p.waitForTimeout(10500);   // la app pide las frases otra vez cuando le llega un aviso que no entiende (cada 10 s como mucho)
    await N.p.evaluate(() => { window.__voz5 = []; const d = window.ventoDecirPago; window.ventoDecirPago = f => { window.__voz5.push(String(f)); }; });
    await avisar('and-frase-2');
    chk('5. El siguiente aviso igual ya es un pago en la app del negocio, sin reinstalar: $4.000 por Bancolombia', await N.p.waitForFunction(() => (data.pagos.lista || []).some(x => x.monto === 4000 && x.app === 'Bancolombia'), null, { timeout: 8000 }).then(() => true, () => false));
    chk('5. … y lo dice en voz alta («Recibiste 4000 pesos por Bancolombia»)', await N.p.evaluate(() => window.__voz5.some(x => /^Llegaron 4000 pesos por Bancolombia/.test(x))), await N.p.evaluate(() => window.__voz5));

    // ===== 6. 🐞 Reportar un problema (Más → 🐞): lo que escribe el cliente llega a 🐞 Errores con sus códigos =====
    await N.p.addScriptTag({ content: 'setTimeout(function vamosMal(){ var o = null; o.nada(); }, 0);' });   // un error justo antes
    await N.p.waitForTimeout(300);
    await N.p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await N.p.click('#navMoreBtn');
    await N.p.click('#navMoreSheet .more-tile[data-go="reportar"]');
    await N.p.waitForSelector('#vcRepOv.show');
    await N.p.fill('#vcRepMsg', 'Al cobrar la mesa 3 se quedó pegado');
    await N.p.click('#vcRepSi');
    await N.p.evaluate(() => window.ventoErrores.enviar());
    chk('6. «🐞 Reportar un problema» llega al servidor con lo que escribió y los códigos de sus errores', await hasta(async () => (await filas("select 1 from app_errores where negocio = 'Bar Frases' and (detalle->>'reporte') = 'true' and detalle->>'texto' like '%se quedó pegado%' and jsonb_array_length(detalle->'codigos') >= 1")).length > 0),
      await filas("select mensaje, detalle from app_errores where negocio = 'Bar Frases'"));
    const cerro6 = await N.p.waitForFunction(() => !document.getElementById('vcRepOv').classList.contains('show'), null, { timeout: 10000 }).then(() => true, () => false);
    chk('6. Se cierra y le dice que ya llegó', cerro6, await N.p.textContent('#vcRepEstado'));
    chk('6. … y queda como caso de soporte (con los códigos para el administrador)', await hasta(async () => (await filas("select 1 from soporte_casos where asunto like '🐞 Al cobrar%'").catch(() => [])).length > 0), await filas("select table_name from information_schema.tables where table_name like 'soporte%'"));

    // ===== 7. La app Android / el programa de PC se cerró por un error suyo: llega al abrir, con su pila =====
    const P = await pagina('programa', 'about:blank');
    await P.p.addInitScript(() => { window.ventoPC = { plataforma: 'darwin', version: () => '1.0.9', errores: () => [{ tipo: 'programa', mensaje: "TypeError: Cannot read properties of undefined (reading 'show')", pila: 'TypeError: x\n    at mostrar (main.js:44:12)', app: '1.0.9', so: 'darwin 14.6', t: Date.now() }] }; });
    await P.p.goto(BASE + '/index.html'); await P.p.waitForTimeout(6800);
    await P.p.evaluate(() => window.ventoErrores.enviar());
    chk('7. El error del programa de Mac llega a 🐞 Errores marcado «[Mac]», con la pila y la plataforma', await hasta(async () => (await filas("select 1 from app_errores where mensaje like '[Mac]%' and (detalle->>'nativo') = 'Mac' and detalle->>'pila' like '%main.js:44%' and plataforma = 'mac-programa'")).length > 0),
      await filas("select mensaje, plataforma, detalle from app_errores where mensaje like '[%'"));

    // ===== 8. En el panel: qué significa, dónde, y «📋 Copiar para arreglar» =====
    await D.p.selectOption('#erTipo', 'reporte'); await D.p.click('#erRef');
    await D.p.waitForFunction(() => /se quedó pegado/.test(document.getElementById('erLista').textContent), null, { timeout: 8000 }).catch(() => {});
    chk('8. Filtro «📝 Reportados por el cliente»', /se quedó pegado/.test(await D.p.textContent('#erLista')) && !/reproductor/.test(await D.p.textContent('#erLista')), await D.p.textContent('#erLista'));
    await D.p.selectOption('#erTipo', ''); await D.p.click('#erRef');
    await D.p.waitForSelector('#erLista [data-error] .t');
    await D.p.evaluate(() => { const it = [...document.querySelectorAll('#erLista [data-error]')].find(x => /reading 'nada'|nada/.test(x.textContent) && !/Mac/.test(x.textContent)); it.querySelector('.t').click(); });
    await D.p.waitForSelector('#dlgEr[open]');
    const info8 = await D.p.textContent('#erInfo');
    chk('8. El detalle dice en palabras qué significa y dónde (archivo:línea y la función)', /Qué significa:.*algo que no existía/.test(info8) && /Dónde:.*index\.html:\d+/.test(info8), info8.slice(0, 500));
    await D.p.evaluate(() => { window.__copiado = ''; try{ Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copiado = t; return Promise.resolve(); } } }); }catch(e){} });
    await D.p.click('#erCopiar'); await D.p.waitForTimeout(200);
    const txt8 = await D.p.evaluate(() => window.__copiado);
    chk('8. «📋 Copiar para arreglar»: código E-XXXX, mensaje, qué significa, dónde, pila y los equipos', /E-[0-9A-Z]{4}/.test(txt8) && /Mensaje:/.test(txt8) && /Qué significa:/.test(txt8) && /Dónde: index\.html:\d+/.test(txt8) && /Pila:/.test(txt8) && /Bar Errores|Bar Frases/.test(txt8), txt8.slice(0, 800));
    await D.p.evaluate(() => document.getElementById('dlgEr').close());
    await D.p.selectOption('#erTipo', 'nativo');
    chk('8. Filtro «📲 Del programa / app Android» con el de Mac', /\[Mac\]/.test(await D.p.textContent('#erLista')), await D.p.textContent('#erLista'));
  }
})();
