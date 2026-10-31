// 🎙️⌨️ ORDEVA · Caja Inteligente 2.0: voz y teclado sobre la MISMA caja (lib/vento-caja-voz.js). Sin internet.
// El dictado se simula con un SpeechRecognition falso (el de Chrome/Android no existe en el navegador de pruebas):
// se prueba TODO lo que hace ORDEVA con el texto, el micrófono y sus estados, no la calidad del reconocedor.
//  1. Micrófono en la caja, aviso de privacidad antes del primer uso, estado «Escuchando…» y transcripción.
//  2. Agregar, quitar, cambiar cantidad, quitar lo último; totales; números en palabras.
//  3. Productos parecidos: pregunta «¿Cuál…?» y se responde con la voz o con un botón. Nunca inventa productos.
//  4. Dinero recibido y vueltas; cobro por voz con confirmación obligatoria; pago mixto; inventario descontado.
//  5. Mesas: agregar, saldo, mesa inexistente (no toca otra), cobrar una mesa con confirmación.
//  6. Interrumpir, permiso negado y recuperar el micrófono, sin internet (orden escrita), sin duplicados.
//  7. Confirmaciones sensibles (vaciar), descuento solo con la ventana de autorización.
//  8. Teclado: F1, F2 (Enter seguro), F4, F5, F8, F9, Esc. Micrófono flotante con la caja abierta.
//  9. Sin «Pedidos por voz» en la suscripción, el micrófono de la caja no se abre.
// 10. Peso por voz: «medio kilo de queso», «dos libras de carne», «300 gramos de jamón», «kilo y medio».
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      // Reconocedor de voz falso: «__decir(texto)» entrega la frase como la entregaría Chrome o Android.
      window.__sr = { modo: 'ok', creados: 0, inst: null };
      class SRFalso {
        constructor(){ window.__sr.creados++; window.__sr.inst = this; }
        start(){
          const m = window.__sr.modo;
          if(m !== 'ok'){ setTimeout(() => { this.onerror && this.onerror({ error: m }); this.onend && this.onend(); }, 10); return; }
          setTimeout(() => this.onstart && this.onstart(), 5);
        }
        stop(){ setTimeout(() => this.onend && this.onend(), 5); }
        abort(){ this.onend && this.onend(); }
      }
      window.SpeechRecognition = SRFalso;
      window.__decir = t => { const s = window.__sr.inst; const r = [{ transcript: t }]; r.isFinal = true; s.onresult({ results: [r] }); s.stop(); };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Voz'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [
        { id: 'a', name: 'Águila', price: 3500, cost: 2000, stock: 10 }, { id: 'al', name: 'Águila Light', price: 3600, stock: 10 },
        { id: 'p', name: 'Póker', price: 3500, cost: 2000, stock: 10 }, { id: 'c1', name: 'Coca-Cola', size: '400 ml', price: 2500 },
        { id: 'c2', name: 'Coca-Cola', size: '1.5 L', price: 6000 }, { id: 'e', name: 'Empanada', price: 2000 }
      ];
      data.history = []; data.tables = { 1: { items: [], payments: [], people: [] }, 3: { items: [], payments: [], people: [] } };
      saveData(); window.ventoPOS.abrirCaja();
      window.__dicho = []; window.ventoHablar = t => window.__dicho.push(String(t));
    });
    await p.waitForTimeout(400);
    const R = '#pzCajaOv .pz-caja-root';
    const pausa = ms => p.waitForTimeout(ms || 250);
    const decir = async t => { await p.click(R + ' .cv-mic'); await pausa(60); await p.evaluate(t => window.__decir(t), t); await pausa(300); };
    const carrito = () => p.evaluate(() => window.ventoPOS.carrito().map(l => [l.id, l.qty]));
    const est = () => p.evaluate(() => window.ventoCajaVoz.estado());
    const dicho = () => p.evaluate(() => window.__dicho[window.__dicho.length - 1] || '');

    // ===== 1. Micrófono, privacidad, estados =====
    let v = await p.evaluate(R => ({ mic: !!document.querySelector(R + ' .pz-buscar .cv-mic'), barra: !!document.querySelector(R + ' .cv-barra'), at: (document.querySelector(R + ' .cv-atajos') || {}).textContent || '' }), R);
    chk('1. La caja tiene micrófono junto al buscador, la barra de voz y los atajos F1–F9', v.mic && v.barra && /F2/.test(v.at) && /F9/.test(v.at), v);
    await p.click(R + ' .cv-mic'); await pausa(150);
    v = await p.evaluate(() => ({ priv: !!document.querySelector('.cv-priv-ov'), txt: (document.querySelector('.cv-priv') || {}).textContent || '', creados: window.__sr.creados }));
    chk('1. Antes del primer uso: aviso de privacidad («no graba ni guarda audio») y el micrófono NO se abre aún', v.priv && /no graba ni guarda audio/.test(v.txt) && v.creados === 0, v);
    await p.click('.cv-priv-ov [data-si]'); await pausa(150);
    v = await est();
    chk('1. Al aceptar: estado «escuchando» (botón rojo ⏹)', v.estado === 'escuchando' && await p.evaluate(R => document.querySelector(R + ' .cv-mic').classList.contains('on'), R), v);

    // ===== 2. Agregar, quitar, cantidad, totales =====
    await p.evaluate(() => window.__decir('dos águilas y una póker')); await pausa(350);
    v = { c: await carrito(), d: await dicho(), e: await est() };
    chk('2. «dos águilas y una póker» → Águila 2 y Póker 1 (Águila Light no se confunde)', JSON.stringify(v.c) === JSON.stringify([['a', 2], ['p', 1]]), v);
    chk('2. Responde en voz alta con el total ($10.500) y muestra lo que oyó', /10[.\s]?500|diez mil quinientos/.test(v.d) && v.e.oido === 'dos águilas y una póker', v);
    await decir('quita una póker');
    chk('2. «quita una póker» → la Póker sale de la venta', JSON.stringify(await carrito()) === JSON.stringify([['a', 2]]), await carrito());
    await decir('que sean tres águilas');
    chk('2. «que sean tres águilas» → Águila en 3', JSON.stringify(await carrito()) === JSON.stringify([['a', 3]]), await carrito());
    await decir('agrega treinta y dos empanadas');
    chk('2. Números en palabras: «treinta y dos empanadas» → 32', (await carrito()).some(x => x[0] === 'e' && x[1] === 32), await carrito());
    await decir('quita lo último');
    chk('2. «quita lo último» → se quitan las 32 empanadas', JSON.stringify(await carrito()) === JSON.stringify([['a', 3]]), await carrito());
    await decir('cuánto es');
    v = await dicho();
    chk('2. «¿cuánto es?» → «Total … 10.500, 3 productos»', /Total/.test(v) && /3 productos/.test(v), v);

    // ===== 3. Parecidos y productos que no existen =====
    await decir('una coca cola');
    v = await est();
    chk('3. «una coca cola» (hay 400 ml y 1.5 L) → pregunta «¿Cuál…?» con 2 opciones y no agrega nada', v.pregunta && v.pregunta.tipo === 'producto' && v.pregunta.opciones.length === 2 && !(await carrito()).some(x => /^c/.test(x[0])), v);
    await decir('la de 400');
    chk('3. Responde «la de 400» → Coca-Cola 400 ml', (await carrito()).some(x => x[0] === 'c1' && x[1] === 1) && !(await est()).pregunta, await carrito());
    await decir('una coca cola');
    await p.click(R + ' .cv-preg [data-id="c2"]'); await pausa();
    chk('3. También se responde tocando la opción (Coca-Cola 1.5 L)', (await carrito()).some(x => x[0] === 'c2' && x[1] === 1), await carrito());
    const antesInv = await carrito();
    await decir('dos chocorramos');
    chk('3. «dos chocorramos» (no existe) → no agrega nada (nunca inventa productos)', JSON.stringify(await carrito()) === JSON.stringify(antesInv), await carrito());
    await decir('quita la coca cola de 1.5 litros');
    await p.evaluate(() => { window.ventoPOS.fijar('c1', 0); window.ventoPOS.fijar('c2', 0); });

    // ===== 4. Recibido, vueltas, cobro con confirmación =====
    await decir('me paga con cincuenta mil');
    v = { e: await est(), d: await dicho() };
    chk('4. «me paga con cincuenta mil» → recibido $50.000 y dice cuánto devolver ($39.500)', v.e.recibido === 50000 && /Devuelve/.test(v.d) && /39[.\s]?500|treinta y nueve mil quinientos/.test(v.d), v);
    await decir('cuánto devuelvo');
    chk('4. «¿cuánto devuelvo?» → repite las vueltas', /Devuelve/.test(await dicho()), await dicho());
    const hAntes = await p.evaluate(() => data.history.length);
    await decir('cobrar en efectivo');
    v = await p.evaluate(R => ({ conf: window.ventoCajaVoz.estado().confirmar, vis: !document.querySelector(R + ' .cv-conf').hidden, h: data.history.length }), R);
    chk('4. «cobrar en efectivo» → confirmación financiera a la vista; la venta AÚN no se registra', v.conf && v.conf.nivel === 'financiera' && /10\.500/.test(v.conf.texto) && /Vueltas \$\s?39\.500/.test(v.conf.texto) && v.vis && v.h === hAntes, v);
    await decir('sí confirmo');
    await pausa(400);
    v = await p.evaluate(() => { const h = data.history[0]; return { n: data.history.length, total: h.total, m: h.method || h.paymentMethod, rec: h.efectivoRecibido, vu: h.vueltas, stock: data.products.find(x => x.id === 'a').stock, cart: window.ventoPOS.carrito().length }; });
    chk('4. «sí, confirmo» → UNA venta de $10.500 en efectivo con recibido $50.000 y vueltas $39.500; la caja queda vacía', v.n === hAntes + 1 && v.total === 10500 && v.rec === 50000 && v.vu === 39500 && v.cart === 0, v);
    chk('4. El inventario se descontó con el mismo motor (Águila 10 → 7)', v.stock === 7, v);
    await decir('sí confirmo');
    chk('4. Un segundo «sí» no cobra otra vez (sin duplicados)', await p.evaluate(() => data.history.length) === hAntes + 1);
    await decir('dos águilas');
    await decir('veinte mil en efectivo y el resto por nequi');
    v = await est();
    chk('4. Pago mixto: «veinte mil en efectivo y el resto por nequi» (total $7.000) → pide confirmar', v.confirmar && /Pago mixto/.test(v.confirmar.texto), v);
    await decir('no');
    chk('4. «no» cancela el cobro: nada registrado', await p.evaluate(() => data.history.length) === hAntes + 1 && !(await est()).confirmar);
    await decir('dos mil en efectivo y el resto por nequi');
    await decir('confirma la venta'); await pausa(400);
    v = await p.evaluate(() => { const h = data.history[0]; return { total: h.total, pagos: h.pagos || h.payments || null, m: h.method }; });
    chk('4. Pago mixto confirmado: $2.000 efectivo + $5.000 Nequi', v.total === 7000 && JSON.stringify(v).includes('5000') && JSON.stringify(v).includes('2000'), v);
    await decir('cobrar');
    v = await est();
    chk('4. «cobrar» con la venta vacía → no pide nada ni registra', !v.confirmar && /vacía/.test(v.respuesta), v);

    // ===== 5. Mesas =====
    await decir('mesa 3 dos águilas');
    v = await p.evaluate(() => (data.tables[3].items || []).map(i => [i.name, i.qty]));
    chk('5. «mesa 3 dos águilas» → van a la Mesa 3 (no a la caja)', JSON.stringify(v) === JSON.stringify([['Águila', 2]]) && (await carrito()).length === 0, v);
    await decir('cuánto debe la mesa 3');
    chk('5. «¿cuánto debe la mesa 3?» → $7.000', /7[.\s]?000|siete mil/.test(await dicho()), await dicho());
    await decir('mesa 9 una póker');
    v = await p.evaluate(() => ({ t: Object.keys(data.tables), m1: data.tables[1].items.length, m3: data.tables[3].items.length }));
    chk('5. Mesa 9 no existe → no toca ninguna otra mesa', v.m1 === 0 && v.m3 === 1 && !v.t.includes('9') && /No encontré/.test(await dicho()), v);
    const hM = await p.evaluate(() => data.history.length);
    await decir('cobra la mesa 3 por nequi');
    chk('5. «cobra la mesa 3 por nequi» → confirmación (aún abierta)', !!(await est()).confirmar && await p.evaluate(() => data.tables[3].items.length) === 1);
    await p.click(R + ' .cv-conf [data-cv="si"]'); await pausa(600);
    v = await p.evaluate(() => ({ n: data.history.length, items: (data.tables[3].items || []).length, total: data.history[0].total }));
    chk('5. Al tocar «Confirmar venta» la Mesa 3 se cierra con su venta de $7.000', v.n === hM + 1 && v.items === 0 && v.total === 7000, v);

    // ===== 6. Interrumpir, permiso, sin internet, duplicados =====
    await p.click(R + ' .cv-mic'); await pausa(80);
    await p.keyboard.press('Escape'); await pausa(150);
    chk('6. Esc mientras escucha → micrófono apagado sin procesar nada', (await est()).estado === 'apagado' && (await carrito()).length === 0, await est());
    await p.evaluate(() => { window.__sr.modo = 'not-allowed'; });
    await p.click(R + ' .cv-mic'); await pausa(200);
    v = await est();
    chk('6. Permiso negado → estado «sin permiso» y lo explica', v.estado === 'sin_permiso' && /permiso/.test(v.respuesta), v);
    await p.evaluate(() => { window.__sr.modo = 'ok'; });
    await decir('una empanada');
    chk('6. Al dar el permiso, el micrófono se recupera con el mismo botón', JSON.stringify(await carrito()) === JSON.stringify([['e', 1]]), await carrito());
    await p.evaluate(() => { window.__sr.modo = 'network'; });
    await p.click(R + ' .cv-mic'); await pausa(200);
    v = await p.evaluate(R => ({ e: window.ventoCajaVoz.estado().estado, f: !document.querySelector(R + ' .cv-escrito').hidden }), R);
    chk('6. Sin internet → estado «sin red» y se abre la orden escrita', v.e === 'sin_red' && v.f, v);
    await p.fill(R + ' .cv-in', '2 empanadas'); await p.press(R + ' .cv-in', 'Enter'); await pausa();
    chk('6. La orden escrita usa el mismo intérprete (sin internet): Empanada 3', JSON.stringify(await carrito()) === JSON.stringify([['e', 3]]), await carrito());
    await p.evaluate(() => { window.__sr.modo = 'ok'; window.ventoCajaVoz.procesar('una póker'); window.ventoCajaVoz.procesar('una póker'); });
    chk('6. La misma frase dos veces seguidas (eco del dictado) se aplica una sola vez', (await carrito()).find(x => x[0] === 'p')[1] === 1, await carrito());

    // ===== 7. Confirmaciones sensibles =====
    await decir('vacía la venta');
    v = await est();
    chk('7. «vacía la venta» → pide confirmar (modificación) y no borra todavía', v.confirmar && v.confirmar.nivel === 'modificacion' && (await carrito()).length === 2, v);
    await decir('sí');
    chk('7. «sí» → venta vacía', (await carrito()).length === 0);
    await decir('una águila');
    await p.evaluate(() => { window.ventoRoles && (window.__esJefe = window.ventoRoles.esJefe, window.ventoRoles.esJefe = () => false); });
    await decir('ponle un descuento');
    v = await p.evaluate(R => ({ ov: !!document.querySelector('.pz-mini-ov'), desc: !!document.querySelector(R + ' .pz-desc') }), R);
    chk('7. «descuento» solo abre la ventana de siempre (pide la clave del dueño al equipo); la voz no lo aplica', v.ov && !v.desc, v);
    await p.evaluate(() => { document.querySelectorAll('.pz-mini-ov').forEach(o => o.remove()); if(window.__esJefe) window.ventoRoles.esJefe = window.__esJefe; });

    // ===== 8. Teclado y micrófono flotante =====
    await p.keyboard.press('F1'); await pausa(100);
    chk('8. F1 → cursor en el buscador', await p.evaluate(R => document.activeElement === document.querySelector(R + ' .pz-q'), R));
    await p.keyboard.press('F9'); await pausa(100);
    chk('8. F9 → dice el total ($3.500)', /3[.\s]?500|tres mil quinientos/.test(await dicho()), await dicho());
    const hK = await p.evaluate(() => data.history.length);
    await p.keyboard.press('F2'); await pausa(80); await p.keyboard.press('Enter'); await pausa(300);
    v = await p.evaluate(() => ({ ov: !!document.querySelector('.pz-pago-ov.show'), n: data.history.length }));
    chk('8. F2 abre el cobro y un Enter inmediato NO cobra (Enter seguro)', v.ov && v.n === hK, v);
    await p.keyboard.press('Escape'); await pausa(150);
    chk('8. Esc cierra la ventana de cobro sin cobrar', !(await p.evaluate(() => !!document.querySelector('.pz-pago-ov.show'))) && await p.evaluate(() => data.history.length) === hK);
    await p.keyboard.press('F6'); await pausa(200);
    v = await p.evaluate(() => ({ ov: !!document.querySelector('.pz-pago-ov.show'), foco: document.activeElement && document.activeElement.id }));
    chk('8. F6 → cobro con el cursor en «¿Con cuánto paga?»', v.ov && v.foco === 'pzPagaCon', v);
    await p.keyboard.type('5000'); await pausa(100); await p.keyboard.press('Enter'); await pausa(400);
    v = await p.evaluate(() => ({ n: data.history.length, vu: data.history[0].vueltas }));
    chk('8. Escribir 5000 + Enter cobra en efectivo con vueltas $1.500', v.n === hK + 1 && v.vu === 1500, v);
    await p.evaluate(() => window.ventoPOS.agregar('e', 1)); await pausa(100);
    await p.keyboard.press('F5'); await pausa(150);
    chk('8. F5 (limpiar) pide confirmación antes de vaciar', !!(await est()).confirmar && (await carrito()).length === 1);
    await p.keyboard.press('Escape'); await pausa(100);
    chk('8. Esc cancela esa confirmación', !(await est()).confirmar && (await carrito()).length === 1);
    await p.keyboard.press('F4'); await pausa(200);
    chk('8. F4 → ventana «Suspender la venta»', await p.evaluate(() => !!document.querySelector('.pz-mini-ov .pz-sn')));
    await p.evaluate(() => document.querySelectorAll('.pz-mini-ov').forEach(o => o.remove()));
    await p.keyboard.press('F8'); await pausa(150);
    chk('8. F8 → abre el micrófono', (await est()).estado === 'escuchando');
    await p.keyboard.press('F8'); await pausa(150);
    chk('8. F8 otra vez → lo cierra', (await est()).estado !== 'escuchando', await est());
    await p.evaluate(async () => { window.speakVoice = () => {}; await handleVoiceTranscript('cuánto es'); });
    chk('8. El micrófono flotante con la caja abierta también entiende «¿cuánto es?» (mismo intérprete)', /Total/.test(await dicho()), await dicho());
    await p.evaluate(async () => { await handleVoiceTranscript('dos águilas'); }); await pausa();
    chk('8. …y «dos águilas» del micrófono flotante va a la misma venta', (await carrito()).some(x => x[0] === 'a' && x[1] === 2), await carrito());
    v = await p.evaluate(R => [...document.querySelectorAll(R + ' .pz-cats button')].map(b => b.textContent), R);
    chk('8. Chip «🕘 Recientes» (lo de las últimas ventas)', v.some(x => /Recientes/.test(x)), v);

    // ===== 9. Suscripción =====
    v = await p.evaluate(async R => {
      // Plan verificado en la nube SIN «voice» (lo mismo que mira subAcceso de app/12).
      const S = window.ventoSuscripcion, guard = {}, n0 = window.__sr.creados; window.__fp = 0;
      ['enCuenta', 'verificado', 'tiene', 'funcionPro'].forEach(k => guard[k] = S[k]);
      S.enCuenta = () => true; S.verificado = () => true; S.tiene = f => f !== 'voice'; S.funcionPro = () => { window.__fp++; };
      window.ventoCajaVoz.apagar(); document.querySelector(R + ' .cv-mic').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      const res = { creados: window.__sr.creados - n0, estado: window.ventoCajaVoz.estado().estado, fp: window.__fp };
      Object.assign(S, guard); return res;
    }, R);
    chk('9. Sin «Pedidos por voz» en el plan: el micrófono de la caja no se abre y muestra el plan', v.creados === 0 && v.estado !== 'escuchando' && v.fp === 1, v);
    // ===== 10. Peso por voz (1.69.0) =====
    await p.evaluate(() => {
      data.products.push({ id: 'q', name: 'Queso', price: 20000, porPeso: 'kg' }, { id: 'k', name: 'Carne', price: 12000, porPeso: 'lb' }, { id: 'j', name: 'Jamón', price: 30000, porPeso: 'kg' });
      saveData(); window.ventoPOS.vaciar(); window.ventoCajaVoz.reiniciar();
    });
    await p.evaluate(() => window.ventoCajaVoz.procesar('medio kilo de queso')); await pausa(300);
    await p.evaluate(() => window.ventoCajaVoz.procesar('dos libras de carne')); await pausa(300);
    await p.evaluate(() => window.ventoCajaVoz.procesar('agrega 300 gramos de jamón')); await pausa(300);
    v = await p.evaluate(() => ({ c: window.ventoPOS.carrito().map(l => [l.id, Math.round(l.qty * 1000) / 1000]), t: window.ventoPOS.resumen().total }));
    chk('10. «medio kilo de queso», «dos libras de carne», «300 gramos de jamón» → 0,5 kg, 2 lb y 0,3 kg', JSON.stringify(v.c) === JSON.stringify([['q', 0.5], ['k', 2], ['j', 0.3]]), v);
    chk('10. Total con el peso: $10.000 + $24.000 + $9.000 = $43.000', v.t === 43000, v);
    await p.evaluate(() => window.ventoCajaVoz.procesar('kilo y medio de queso')); await pausa(300);
    chk('10. «kilo y medio de queso» suma 1,5 kg (queso en 2 kg)', await p.evaluate(() => window.ventoPOS.carrito().find(l => l.id === 'q').qty === 2));
    await p.evaluate(() => window.ventoCajaVoz.procesar('300 gramos de empanada')); await pausa(300);
    v = await est();
    chk('10. Peso para un producto por unidad: no lo agrega y dice «se vende por unidad»', /por unidad/.test(v.respuesta) && !(await carrito()).some(x => x[0] === 'e'), v.respuesta);
    await p.evaluate(() => window.ventoCajaVoz.procesar('un queso')); await pausa(400);
    v = await p.evaluate(() => ({ r: window.ventoCajaVoz.estado().respuesta, pesar: !!document.querySelector('.overlay.show [data-q="peso"], .overlay.show input[data-q]') }));
    chk('10. «un queso» (sin peso): abre la ventana para pesarlo y lo dice', /se vende por peso/.test(v.r) && v.pesar, v);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => { if(o.id !== 'pzCajaOv') o.remove(); }));

    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
