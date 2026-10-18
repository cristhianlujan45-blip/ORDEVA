// Confirmación de pagos (Nequi, DaviPlata, Bre-B), con la página de verdad y el puente de la app Android simulado:
//  1. ⏳ «Esperando el pago»: el valor en grande; al llegar la plata se pone verde «✅ PAGADO», se registra sola en esa
//     cuenta (sin otra ventana encima) y «↩ Deshacer» la quita. Abono → «Falta $…» y sigue esperando; propina → al día.
//  2. La mesa correcta: dos mesas que deben lo mismo → se pregunta con botones; la que se está cobrando gana; abono y
//     propina solo en la mesa atenta; otra pantalla esperando en otro equipo → se registra allá.
//  3. Aviso sin el valor: en la pantalla «✅ Sí, llegó $…»; sin pantalla, a los 20 s salen las mesas; si el valor llega
//     antes, no pregunta; si llega después de ponerlo a mano, se junta (no cuenta dos veces).
//  4. (Mesero: «✅ Mesa 3 ya pagó» sin el valor → pagosaviso, prueba 17.)
//  5. Cuadre en «📊 Caja de hoy»: llegó, registrado, sin registrar (con «Registrar») y por revisar.
//  6. El mismo pago por SMS y por la app → uno solo (en los dos órdenes), uno con uno.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    for(const [nombre, vp, ua] of [['celular', { width: 390, height: 844 }, ''], ['tablet', { width: 820, height: 1180 }, 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36']]){
      const ctx = await b.newContext({ viewport: vp, ...(ua ? { userAgent: ua } : {}) });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(() => {
        try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
        const A = window.__and = { cola: [], notifs: [], pagos: [], decir: [] };
        window.VentoAndroid = {
          pagosAvisos: () => {}, pagosAvisosEstado: () => JSON.stringify({ on: true, permiso: true, vivo: true }),
          pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
          notificar: (t, x, c, s) => { A.notifs.push({ t, x, c }); return true; },
          pagoNotificar: (t, f, o, v, bco, tipo) => { A.pagos.push({ t, v, tipo }); },
          pagosDecir: t => { A.decir.push(String(t)); }, pagosNotif: () => {}, pagosVolumen: () => {}, ventanaPagoOn: () => {}, alFrente: () => true,
        };
      });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
      await p.fill('#authBiz', 'Bar Confirma'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
      await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
      await p.waitForFunction(() => !!window.ventoConfirma && window.pagoLlego && window.pagoLlego._vc, null, { timeout: 10000 });
      const N = '[' + nombre + '] ';
      await p.evaluate(() => {
        document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
        data.pagos = data.pagos || {}; data.pagos.on = true; data.pagos.lista = []; data.pagos.espera = {};
        const it = (n, precio) => [{ productId: 'p' + n, name: 'Cosa ' + n, price: precio, qty: 1 }];
        data.tables = data.tables || {};
        [[1, 45000], [2, 20000], [3, 20000], [4, 30000], [5, 15000], [6, 11000], [7, 9000]].forEach(([m, v]) => { data.tables[m] = { items: it(m, v), payments: [], people: [] }; });
        saveData();
      });
      const llega = (id, txt, voz) => p.evaluate(([id, txt, voz]) => { window.__and.cola.push({ id, txt, t: Date.now(), voz: voz !== false }); window.ventoAvisosNativos(); }, [id, txt, voz]);
      const pagado = m => p.evaluate(m => (data.tables[m].payments || []).reduce((a, q) => a + (Number(q.amount) || 0), 0), m);
      const pantalla = () => p.evaluate(() => { const v = document.getElementById('vcEspera'); return v ? { cls: v.className, txt: v.innerText.replace(/\s+/g, ' ') } : null; });
      const modalPago = () => p.evaluate(() => { const o = document.getElementById('pagoOv'); return o && o.classList.contains('show') ? o.innerText.replace(/\s+/g, ' ') : ''; });
      const cerrarModales = () => p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const v = document.getElementById('pgVentana'); if(v) v.remove(); });
      const lbl = m => p.evaluate(m => tableLabel(m), m);

      // ===== 1. ⏳ Esperando el pago =====
      await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(300);
      const btn = await p.evaluate(() => { const b = document.getElementById('vcEsperarBtn'); return b ? { vis: !b.hidden && b.offsetParent !== null, txt: b.textContent } : null; });
      chk(N + '1. En la cuenta: «⏳ Esperando pago por Nequi / DaviPlata»', btn && btn.vis && /Esperando pago por Nequi/.test(btn.txt), btn);
      await p.click('#vcEsperarBtn');
      let s = await pantalla();
      chk(N + '1. Sale la pantalla con el valor en grande ($45.000) y la mesa', s && /Esperando el pago/.test(s.txt) && /\$45\.000/.test(s.txt) && s.txt.includes(await lbl(1)), s);
      chk(N + '1. Los demás equipos saben que esa mesa espera el pago', await p.evaluate(() => !!(data.pagos.pantallas || {})[1] && !!data.pagos.espera[1]));
      await llega('c1:1', 'Nequi | Nequi | ANA RUIZ te envió $45.000');
      await p.waitForTimeout(400);
      s = await pantalla();
      chk(N + '1. Llega la plata → «✅ PAGADO $45.000 · Nequi · de Ana Ruiz» y «Quedó al día»', s && /vc-ok/.test(s.cls) && /PAGADO/.test(s.txt) && /\$45\.000/.test(s.txt) && /Ana Ruiz/.test(s.txt) && /al día/.test(s.txt), s);
      chk(N + '1. Se registró sola en esa cuenta', (await pagado(1)) === 45000);
      chk(N + '1. Sin otra ventana encima (ni «Llegó un pago» ni la ventana emergente)', !(await modalPago()) && !(await p.evaluate(() => !!document.getElementById('pgVentana'))));
      await p.click('#vcEspera [data-vc="deshacer"]');
      s = await pantalla();
      chk(N + '1. «↩ Deshacer» lo quita de la cuenta y vuelve a esperar', (await pagado(1)) === 0 && s && /Esperando el pago/.test(s.txt) && await p.evaluate(() => !data.pagos.lista.find(x => x.id === 'and-c1:1').aplicado), s);
      // Abono y lo que falta
      await llega('c1:2', 'Nequi | Nequi | PEDRO te envió $25.000');
      await p.waitForTimeout(400); s = await pantalla();
      chk(N + '1. Abono de $25.000 → «Falta $20.000» y se registra', /Falta \$20\.000/.test(s.txt) && (await pagado(1)) === 25000, s);
      await p.click('#vcEspera [data-vc="seguir"]'); s = await pantalla();
      chk(N + '1. «⏳ Esperar lo que falta» → $20.000 y «Ya llegó: $25.000»', /\$20\.000/.test(s.txt) && /Ya llegó: \$25\.000/.test(s.txt), s);
      await llega('c1:3', 'Nequi | Nequi | LUIS te envió $20.000');
      await p.waitForTimeout(400); s = await pantalla();
      chk(N + '1. El resto ($20.000) va a ESA cuenta aunque otras dos deban lo mismo', (await pagado(1)) === 45000 && (await pagado(2)) === 0 && (await pagado(3)) === 0 && /al día/.test(s.txt), s);
      await p.click('#vcEspera [data-vc="listo"]');
      chk(N + '1. «Listo» cierra la pantalla y la mesa deja de estar esperando en los demás equipos', !(await pantalla()) && await p.evaluate(() => !(data.pagos.pantallas || {})[1]));
      // Propina
      await p.evaluate(() => window.ventoConfirma.abrir(4));
      await llega('c4:1', 'Nequi | Nequi | SARA te envió $32.000');
      await p.waitForTimeout(400); s = await pantalla();
      chk(N + '1. Propina: $32.000 en una cuenta de $30.000 → al día y «$2.000 de más (propina)»', (await pagado(4)) === 32000 && /2\.000 de más/.test(s.txt), s);
      await p.evaluate(() => window.ventoConfirma.cerrar());
      // Un SMS en la pantalla: «⚠️ Llegó por SMS» y «✅ Lo vi en la app»
      await p.evaluate(() => { data.tables[8] = { items: [{ productId: 'p8', name: 'Cosa 8', price: 17300, qty: 1 }], payments: [], people: [] }; saveData(); window.ventoConfirma.abrir(8); });
      await llega('c8:1', 'SMS | 85954 | Bancolombia: Recibiste $17.300 en tu cuenta');
      await p.waitForTimeout(400); s = await pantalla();
      chk(N + '1. Llega por SMS: la pantalla dice «⚠️ Llegó por SMS · míralo en la app» y no lo registra todavía', /vc-rev/.test(s.cls) && /Llegó por SMS/.test(s.txt) && (await pagado(8)) === 0, s);
      await p.click('#vcEspera [data-vc="lovi"]'); await p.waitForTimeout(300); s = await pantalla();
      chk(N + '1. «✅ Lo vi en la app» → PAGADO y registrado', /PAGADO/.test(s.txt) && (await pagado(8)) === 17300, s);
      await p.evaluate(() => window.ventoConfirma.cerrar());

      // ===== 2. La mesa correcta =====
      await cerrarModales();
      await llega('c2:1', 'Nequi | Nequi | JUAN te envió $20.000');
      await p.waitForTimeout(400);
      const m2 = await modalPago();
      chk(N + '2. Dos mesas deben $20.000 → «¿De cuál cuenta es?» con las dos', /De cuál cuenta es/.test(m2) && m2.includes(await lbl(2)) && m2.includes(await lbl(3)), m2);
      await p.evaluate(() => { const b = [...document.querySelectorAll('#pagoOv .pago-go')].find(x => x.dataset.m === '3'); b && b.click(); });
      await p.waitForTimeout(300);
      chk(N + '2. Toca la de la Mesa 3 → queda en esa', (await pagado(3)) === 20000 && (await pagado(2)) === 0);
      await p.evaluate(() => { data.tables[3] = { items: [{ productId: 'p3', name: 'Cosa 3', price: 20000, qty: 1 }], payments: [], people: [] }; data.tables[2].cobrando = { u: 'ana', t: Date.now() }; saveData(); });
      const mp = await p.evaluate(() => { const r = { exacta: window.ventoConfirma.mesaPara(20000), abono: window.ventoConfirma.mesaPara(5000) }; const c = data.tables[2].cobrando; delete data.tables[2].cobrando; r.nada = window.ventoConfirma.mesaPara(7777); data.tables[2].cobrando = c; return r; });
      chk(N + '2. La que se está cobrando gana el empate; un abono va a la que se cobra; sin nadie cobrando, un valor que no es de nadie no va a ninguna', mp.exacta === 2 && mp.abono === 2 && mp.nada === null, mp);
      await p.evaluate(() => { delete data.tables[2].cobrando; data.pagos.pantallas = { 6: { eq: 'otro-equipo', t: Date.now() } }; saveData(); });
      await cerrarModales();
      await llega('c6:1', 'Nequi | Nequi | ROSA te envió $11.000');
      await p.waitForTimeout(400);
      const t6 = await p.evaluate(() => window.__toastsVc || [...document.querySelectorAll('.toast,#toast')].map(x => x.innerText).join(' | '));
      chk(N + '2. Otra pantalla espera esa mesa en otro equipo → aquí no sale «Llegó un pago» (se registra allá)', !(await modalPago()) && (await pagado(6)) === 0, { m: await modalPago(), t6 });
      await p.evaluate(() => { data.pagos.pantallas = {}; saveData(); });

      // ===== 3. Aviso sin el valor =====
      await cerrarModales();
      await p.evaluate(() => window.ventoConfirma.abrir(5));
      await llega('c5:1', 'DaviPlata | ¡Recibiste plata! | Recibiste plata usando Llaves');
      await p.waitForTimeout(400); s = await pantalla();
      chk(N + '3. En la pantalla: «Llegó plata por DaviPlata · ¿llegó $15.000?»', s && /Llegó plata por DaviPlata/.test(s.txt) && /Sí, llegó \$15\.000/.test(s.txt), s);
      await p.click('#vcEspera [data-vc="sinvalor"]'); await p.waitForTimeout(300); s = await pantalla();
      chk(N + '3. «✅ Sí, llegó» → PAGADO y registrado, marcado «✍️ puesto a mano»', /PAGADO/.test(s.txt) && (await pagado(5)) === 15000 && await p.evaluate(() => data.pagos.lista.some(x => x.aMano && x.monto === 15000 && x.aplicado === 5)), s);
      await p.evaluate(() => window.ventoConfirma.cerrar());
      await llega('c5:2', 'DaviPlata | DaviPlata | Recibiste $15.000 de MARIA LOPEZ');
      await p.waitForTimeout(400);
      const j5 = await p.evaluate(() => ({ n: data.pagos.lista.filter(x => x.monto === 15000).length, srv: data.pagos.lista.find(x => x.id === 'and-c5:2'), pag: (data.tables[5].payments || []).length }));
      chk(N + '3. Llega después el valor → se junta con el de a mano: un solo pago, registrado una sola vez', j5.n === 1 && j5.srv && j5.srv.aplicado === 5 && j5.pag === 1 && !(await modalPago()), j5);
      // Sin pantalla: a los 20 s, las mesas
      await p.evaluate(() => { data.tables[7].cobrando = { u: 'ana', t: Date.now() }; saveData(); });
      await llega('c7:1', 'DaviPlata | ¡Recibiste plata! | Recibiste plata usando Llaves');
      await p.waitForTimeout(1000);
      chk(N + '3. Sin pantalla: no pregunta enseguida (casi siempre el valor llega a los pocos segundos)', !(await p.evaluate(() => !!document.getElementById('vcSinValor'))));
      await p.waitForTimeout(20500);
      const sv = await p.evaluate(() => { const o = document.getElementById('vcSinValor'); return o ? { txt: o.innerText.replace(/\s+/g, ' '), primera: (o.querySelector('[data-sv]') || {}).dataset } : null; });
      chk(N + '3. A los 20 s: «Llegó plata por DaviPlata · toca la cuenta que pagó», primero la que se está cobrando', sv && /Llegó plata por DaviPlata/.test(sv.txt) && sv.primera && sv.primera.sv === '7', sv);
      await p.click('#vcSinValor [data-sv="7"]'); await p.waitForTimeout(300);
      chk(N + '3. Tocar la cuenta → registrado con lo que debía ($9.000)', (await pagado(7)) === 9000);
      await llega('c7:2', 'DaviPlata | ¡Recibiste plata! | Recibiste plata usando Llaves');
      await p.waitForTimeout(800);
      await llega('c7:3', 'DaviPlata | DaviPlata | Recibiste $3.300 de LUZ');
      await p.waitForTimeout(20500);
      chk(N + '3. Si el valor llega antes de los 20 s, no pregunta', !(await p.evaluate(() => !!document.getElementById('vcSinValor'))));
      await cerrarModales();

      // ===== 6. El mismo pago por SMS y por la app =====
      await llega('c9:1', 'SMS | 85954 | Bancolombia: Recibiste $12.000 en tu cuenta');
      await llega('c9:2', 'Bancolombia | Bancolombia | Recibiste $12.000 de PEDRO GIL');
      const p9 = await p.evaluate(() => data.pagos.lista.filter(x => x.monto === 12000).map(x => ({ id: x.id, estado: x.estado, f: x.fuente })));
      chk(N + '6. Primero el SMS («⚠️ Revisar») y luego la app → queda UNO, confirmado', p9.length === 1 && p9[0].id === 'and-c9:2' && p9[0].estado === 'app', p9);
      await cerrarModales();
      await llega('c10:1', 'Nequi | Nequi | LUIS te envió $13.000');
      await llega('c10:2', 'SMS | 85954 | Nequi: LUIS te envió $13.000');
      let p10 = await p.evaluate(() => data.pagos.lista.filter(x => x.monto === 13000).length);
      chk(N + '6. Primero la app y luego el SMS → uno solo (el SMS no deja otro «⚠️ Revisar»)', p10 === 1, p10);
      await llega('c10:3', 'SMS | 85954 | Nequi: LUIS te envió $13.000');
      p10 = await p.evaluate(() => data.pagos.lista.filter(x => x.monto === 13000).length);
      chk(N + '6. Uno con uno: otro SMS igual sí es otro pago (queda por revisar)', p10 === 2, p10);
      await cerrarModales();

      // ===== 5. Cuadre en «📊 Caja de hoy» =====
      await llega('c11:1', 'Nequi | Nequi | TOMAS te envió $6.400');            // nadie debe eso: queda sin registrar
      await cerrarModales();
      await p.evaluate(() => { const b = document.getElementById('posCajaBtn'); if(b) b.click(); else window.ventoPOS && window.ventoPOS.abrirCaja && window.ventoPOS.abrirCaja(); });
      await p.waitForTimeout(500);
      await p.evaluate(() => { const b = document.querySelector('[data-hoy]'); b && b.click(); });
      await p.waitForTimeout(400);
      const cu = await p.evaluate(() => { const c = document.querySelector('.pz-hoy-ov .vc-cuadre'); return c ? c.innerText.replace(/\s+/g, ' ') : null; });
      chk(N + '5. «📊 Caja de hoy» trae el cuadre: llegó, registrado, sin registrar y por revisar', cu && /Nequi · DaviPlata · Bre-B/.test(cu) && /Llegó confirmado/.test(cu) && /Registrado en cuentas/.test(cu) && /Sin registrar/.test(cu) && /6\.400/.test(cu) && /Por revisar/.test(cu), cu);
      await p.evaluate(() => { const b = document.querySelector('.vc-cuadre [data-cuadre-reg="and-c11:1"]'); b && b.click(); });
      await p.waitForTimeout(300);
      chk(N + '5. «Registrar» abre «Llegó un pago» para elegir la cuenta', /Llegó un pago/.test(await modalPago()) && /6\.400/.test(await modalPago()));
      await cerrarModales();
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
