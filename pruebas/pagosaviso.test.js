// Pagos: «me sonó una vez cuando llegó el pago, pusieron otra y no volvió a sonar».
// La app Android (VentoEscucha) ya dice en voz alta «Pago confirmado. 200 pesos desde DaviPlata» y saca el aviso del
// celular (también en segundo plano); la página registra el pago. Aquí se simula el puente nativo y se revisa la página:
//  1. Dos pagos IGUALES seguidos (mismo valor y persona; cada aviso con su propio ID) → DOS pagos, cada uno suena.
//  2. Aviso que Android ya dijo (voz:true) → la página no lo repite (ni voz ni aviso del celular) pero sí lo registra y lo muestra.
//  3. Aviso sin voz de Android (app vieja) → la página dice «Pago confirmado. 200 pesos desde DaviPlata».
//  4. Un pago propio enlazado al servidor no se come el segundo pago igual; uno que reenvió OTRO celular sí evita repetirlo.
//  5. El aviso se reenvía al servidor con su ID; el interruptor «Avisos de pagos» llega a Android (pagosNotif).
//  6. Nequi: «… desde Nequi».
//  7. Publicidad del banco («¿Te llegó la prima?…») NO es un pago: ni se registra ni suena.
//  8. Aviso de una app con nombre de banco que NO es la oficial (Android lo marca «revisar") → «⚠️ Revisar», nunca «confirmado».
//  9. Volumen de la voz de los pagos (Ajustes → Pagos): se guarda, llega a Android y «▶ Probar» la dice; hasta 150 % en la app.
// 10. En la app, los pagos que llegan por otro camino (otro celular / servidor) también usan la voz de pagos de Android.
// 11. En el navegador, la voz de los pagos sale con el volumen elegido.
// 12. SMS del banco (los lee la app): del código corto → «⚠️ Revisar»; si el dueño eligió confirmarlos → confirmado; desde un
//     celular → FALSO. El mismo pago por SMS y por la app → uno solo (confirmado). Interruptor «📩 Confirmar los SMS».
// 13. «🔎 Este equipo: App Vento para Android» al final del paso a paso.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      const A = window.__and = { on: true, permiso: true, cola: [], notifs: [], voz: [], sonidos: 0, notifPagos: [], reenvios: [] };
      window.VentoAndroid = {
        pagosAvisos: v => { A.on = !!v; }, pagosAvisosEstado: () => JSON.stringify({ on: A.on, permiso: A.permiso }),
        pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
        mediosPermiso: () => {}, notificar: (t, x, c) => { A.notifs.push({ t, x, c }); return true; },
        pagosNotif: v => { A.notifPagos.push(!!v); },
        pagosVolumen: v => { A.vol = v; }, pagosProbarVoz: () => { A.probo = (A.probo || 0) + 1; },
        pagosSmsConfiar: v => { A.smsOk = !!v; }, pagosSmsConfiarActual: () => !!A.smsOk,
      };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Pagos'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.pagos = data.pagos || {}; data.pagos.on = true; saveData();
      const h = window.ventoHablar; window.ventoHablar = (t, o) => { window.__and.voz.push(String(t)); };
      if(window.ventoSonidos){ const s0 = window.ventoSonidos.success; window.ventoSonidos.success = () => { window.__and.sonidos++; }; }
      window.ventoPagosReenviarAviso = (txt, id) => window.__and.reenvios.push({ txt, id });
      window.__toasts = []; const st = window.showToast; window.showToast = (m, d) => { window.__toasts.push(String(m)); try{ st(m, d); }catch(e){} };
    });
    chk('5. Al entrar, la página le dice a Android si el aviso de pagos está prendido (pagosNotif)', (await p.evaluate(() => window.__and.notifPagos)).includes(true));

    const TXT = 'DaviPlata | ¡Le llegó plata! | JUAN PEREZ le pasó $200 a su DaviPlata';
    const llega = (id, voz, txt) => p.evaluate(([id, voz, txt]) => { window.__and.cola.push({ id, txt, t: Date.now(), voz }); window.ventoAvisosNativos(); }, [id, voz, txt || TXT]);
    const estado = () => p.evaluate(() => ({ n: (data.pagos.lista || []).filter(x => x.monto === 200).length, voz: window.__and.voz.slice(), notifs: window.__and.notifs.slice(), sonidos: window.__and.sonidos, toasts: window.__toasts.slice(), reenvios: window.__and.reenvios.slice() }));

    // 3. App vieja (sin voz de Android): la página lo dice
    await llega('k1:1000:-55', false);
    let e = await estado();
    chk('3. Sin voz de Android, la página dice «Pago confirmado. 200 pesos desde DaviPlata, de Juan Perez»', e.voz.some(t => /^Pago confirmado\. 200 pesos desde DaviPlata, de Juan Perez/.test(t)), e.voz);
    chk('3. … con el sonido de éxito y el aviso del celular «💜 Pagaron $200 por DaviPlata»', e.sonidos === 1 && e.notifs.some(n => /Pagaron \$200 por DaviPlata/.test(n.t)), e);
    chk('5. El aviso se reenvía al servidor CON su ID', e.reenvios.length === 1 && e.reenvios[0].id === 'and-k1:1000:-55' && e.reenvios[0].txt === TXT, e.reenvios);

    // 1. Segundo pago IGUAL (otro aviso, otro ID) poco después
    await p.evaluate(() => { const x = data.pagos.lista[0]; x.srv = 'uuid-1'; saveData(); });   // el servidor enlazó el primero
    await llega('k1:2000:-55', false);
    e = await estado();
    chk('1. Segundo pago igual → OTRO pago registrado (2 de $200)', e.n === 2, e.n);
    chk('1. … y vuelve a sonar (voz y sonido otra vez)', e.voz.filter(t => /^Pago confirmado\. 200 pesos desde DaviPlata/.test(t)).length === 2 && e.sonidos === 2, e);
    chk('4. Un pago propio enlazado al servidor no se come el segundo pago igual', e.reenvios.length === 2, e.reenvios);
    // El mismo aviso otra vez (mismo ID) → no se repite
    await llega('k1:2000:-55', false);
    e = await estado();
    chk('1. El mismo aviso otra vez (mismo ID) no se cuenta ni suena dos veces', e.n === 2 && e.sonidos === 2, e);

    // 2. Android ya lo dijo (voz:true): la página no repite la voz ni el aviso del celular
    const v0 = e.voz.length, n0 = e.notifs.length;
    await llega('k1:3000:-55', true);
    e = await estado();
    chk('2. Aviso que Android ya dijo en voz alta → la página NO lo repite', e.voz.length === v0, e.voz.slice(v0));
    chk('2. … ni saca otro aviso del celular', e.notifs.length === n0, e.notifs.slice(n0));
    chk('2. … pero SÍ queda registrado (3 de $200), con sonido y en pantalla', e.n === 3 && e.sonidos === 3 && e.toasts.some(t => /Pago confirmado · \$200 por DaviPlata/.test(t)), e);

    // 4. Pago que reenvió OTRO celular (llegó del servidor) y luego el mismo aviso aquí → no se repite
    await p.evaluate(() => window.ventoPagos && window.ventoPagos.recibir({ id: 'p-otro', estado: 'aprobado', confianza: 'app', verificado: false, proveedor: 'dispositivo', metodo: 'NEQUI', monto: 9000, pagador: 'Ana Gomez', creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }, true));
    const conSrv = await p.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 9000).length);
    const s0 = (await estado()).sonidos;
    await llega('k9:1:-9', false, 'Nequi | Nequi | ANA GOMEZ te envió $9.000');
    const n9 = await p.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 9000).length);
    chk('4. Un pago que OTRO celular ya reenvió (vino del servidor) no se repite al leerlo aquí', conSrv === 1 && n9 === 1, { conSrv, n9 });

    // 6. Nequi
    await llega('k8:1:-8', false, 'Nequi | Nequi | PEDRO RUIZ te envió $15.000');
    e = await estado();
    chk('6. Nequi: «Pago confirmado. 15000 pesos desde Nequi, de Pedro Ruiz»', e.voz.some(t => /^Pago confirmado\. 15000 pesos desde Nequi, de Pedro Ruiz/.test(t)), e.voz);

    // 5. Interruptor del aviso de pagos → Android
    await p.evaluate(() => { window.__and.notifPagos = []; });
    const cambio = await p.evaluate(() => { const i = document.querySelector('[data-notif="pagos"]'); if(!i) return 'sin interruptor'; i.checked = false; i.dispatchEvent(new Event('change')); return 'ok'; });
    chk('5. Apagar «Avisos de pagos» le avisa a Android (no saca el aviso del celular)', cambio === 'ok' && (await p.evaluate(() => window.__and.notifPagos)).includes(false), cambio);

    // 7. Publicidad
    const antes7 = await p.evaluate(() => ({ n: data.pagos.lista.length, v: window.__and.voz.length }));
    await llega('k7:1:-7', false, 'Nequi | Nequi | ¿Te llegó la prima? Guárdala en un colchón y gana hasta $50.000');
    await llega('k7:2:-7', false, 'DaviPlata | DaviPlata | Te prestamos hasta $5.000.000, ¡le llegó la oportunidad!');
    const desp7 = await p.evaluate(() => ({ n: data.pagos.lista.length, v: window.__and.voz.length }));
    chk('7. Publicidad del banco que parece pago → no se registra ni suena', desp7.n === antes7.n && desp7.v === antes7.v, { antes7, desp7 });

    // 8. App que no es la oficial
    await llega('k8:9:-1', true, 'DaviPlata | ¡Le llegó plata! | PEDRO le pasó $33.000 a su DaviPlata');
    await p.evaluate(() => { window.__and.cola.push({ id: 'k8:10:-1', txt: 'DaviPlata | ¡Le llegó plata! | LUIS le pasó $44.000 a su DaviPlata', t: Date.now(), voz: true, revisar: 'La app «DaviPlata» de este celular no es la oficial (no se instaló desde la tienda): míralo en la app del banco' }); window.ventoAvisosNativos(); });
    const r8 = await p.evaluate(() => (data.pagos.lista || []).find(x => x.monto === 44000));
    const t8 = await p.evaluate(() => window.__toasts.slice(-3).join(' | '));
    chk('8. App que no es la oficial → pago «⚠️ Revisar» (no «confirmado»), con el motivo', r8 && r8.estado === 'revisar' && /no es la oficial/.test(r8.fuente), r8);
    chk('8. … y en pantalla sale «⚠️», no «Pago confirmado»', /⚠️ DaviPlata: \$44\.000/.test(t8) && !/Pago confirmado · \$44\.000/.test(t8), t8);
    chk('8. La app oficial sí queda confirmada', await p.evaluate(() => { const x = data.pagos.lista.find(y => y.monto === 33000); return !!x && x.estado === 'app'; }));

    // 9. Volumen
    const ui9 = await p.evaluate(() => { const v = document.getElementById('pgVol'); return v ? { max: v.max, min: v.min, txt: document.getElementById('pgVolTxt').textContent, desc: document.getElementById('pgVolFila').textContent } : null; });
    chk('9. Ajustes → Pagos: «🔊 Volumen de la voz de los pagos» de 10 a 150 % en la app (más fuerte de lo normal)', ui9 && ui9.min === '10' && ui9.max === '150' && /100 %/.test(ui9.txt) && /más fuerte de lo normal/i.test(ui9.desc), ui9);
    await p.evaluate(() => { const v = document.getElementById('pgVol'); v.value = '130'; v.dispatchEvent(new Event('input')); v.dispatchEvent(new Event('change')); });
    let v9 = await p.evaluate(() => ({ ls: localStorage.getItem('vento_pagos_vol'), and: window.__and.vol, txt: document.getElementById('pgVolTxt').textContent }));
    chk('9. Subirlo a 130 % → se guarda, le llega a Android y dice «más fuerte de lo normal»', v9.ls === '130' && v9.and === 130 && /130 % · más fuerte de lo normal/.test(v9.txt), v9);
    await p.evaluate(() => { document.getElementById('pgVolMas').click(); document.getElementById('pgVolMas').click(); document.getElementById('pgVolMas').click(); });
    v9 = await p.evaluate(() => ({ ls: localStorage.getItem('vento_pagos_vol'), and: window.__and.vol }));
    chk('9. «🔊 Más alto» sube de a 10 y no pasa de 150 %', v9.ls === '150' && v9.and === 150, v9);
    await p.evaluate(() => { document.getElementById('pgVolMenos').click(); });
    chk('9. «🔉 Más bajo» lo baja', await p.evaluate(() => localStorage.getItem('vento_pagos_vol') === '140' && window.__and.vol === 140));
    await p.evaluate(() => document.getElementById('pgVolProbar').click());
    chk('9. «▶ Probar la voz» la dice en Android con ese volumen', await p.evaluate(() => window.__and.probo === 1));

    // 10. Con la voz de pagos de Android: los pagos de otro camino también la usan
    await p.evaluate(() => { window.__and.decir = []; window.VentoAndroid.pagosDecir = t => window.__and.decir.push(String(t)); });
    const v10 = (await estado()).voz.length;
    await llega('k10:1:-1', false, 'Nequi | Nequi | SARA te envió $12.000');
    await p.evaluate(() => window.ventoPagos && window.ventoPagos.recibir({ id: 'p-srv-10', estado: 'aprobado', confianza: 'app', verificado: false, proveedor: 'dispositivo', metodo: 'DAVIPLATA', monto: 7000, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }, true));
    const d10 = await p.evaluate(() => window.__and.decir.slice());
    chk('10. En la app, «Pago confirmado» sale por la voz de pagos de Android (con su volumen), no por la de la página', d10.some(t => /^Pago confirmado\. 12000 pesos desde Nequi/.test(t)) && d10.some(t => /^Pago confirmado\. 7000 pesos desde DaviPlata/.test(t)) && (await estado()).voz.length === v10, d10);

    // 12. SMS del banco
    await llega('S:1', true, 'SMS | 85888 | DaviPlata: Le llegó plata. Recibió $21.000 de JUAN PEREZ');
    let x12 = await p.evaluate(() => (data.pagos.lista || []).find(x => x.monto === 21000));
    chk('12. SMS del código corto del banco → registrado «⚠️ Revisar» (por SMS)', x12 && x12.estado === 'revisar' && /SMS/.test(x12.fuente), x12);
    await llega('S:2', true, 'SMS | 85888 | DaviPlata: Le llegó plata. Recibió $22.000 de ANA');
    await p.evaluate(() => { window.__and.cola.push({ id: 'S:3', txt: 'SMS | 85888 | DaviPlata: Le llegó plata. Recibió $23.000 de ANA', t: Date.now(), voz: true, smsOk: true }); window.ventoAvisosNativos(); });
    x12 = await p.evaluate(() => (data.pagos.lista || []).find(x => x.monto === 23000));
    chk('12. Con «Confirmar los SMS del banco» → el SMS del código corto queda ✅ confirmado', x12 && x12.estado === 'app' && /SMS del banco/.test(x12.fuente), x12);
    await p.evaluate(() => { window.__and.cola.push({ id: 'S:4', txt: 'SMS | +57 300 123 4567 | Nequi: te llegó plata $90.000', t: Date.now(), voz: true, smsOk: true }); window.ventoAvisosNativos(); });
    x12 = await p.evaluate(() => (data.pagos.lista || []).find(x => x.monto === 90000));
    chk('12. SMS desde un número de celular → 🚨 FALSO aunque se confíe en los SMS', x12 && x12.estado === 'falso', x12);
    // El mismo pago: primero el SMS (revisar), luego la app del banco (confirma y reemplaza)
    await llega('S:5', true, 'SMS | 85888 | DaviPlata: Le llegó plata. Recibió $24.000 de LUIS');
    await p.evaluate(() => { window.__and.cola.push({ id: 'k24:1:-1', txt: 'DaviPlata | ¡Le llegó plata! | LUIS le pasó $24.000 a su DaviPlata', t: Date.now(), voz: true, reemplaza: 'S:5' }); window.ventoAvisosNativos(); });
    const l24 = await p.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 24000).map(x => x.estado));
    chk('12. El mismo pago por SMS y por la app del banco → queda UNO, confirmado', l24.length === 1 && l24[0] === 'app', l24);
    const sw = await p.evaluate(() => { const i = document.getElementById('pgSmsOk'); if(!i) return null; const antes = i.checked; i.checked = true; i.dispatchEvent(new Event('change')); return { antes, ahora: window.__and.smsOk, dis: i.disabled }; });
    chk('12. Ajustes → Pagos: «📩 Confirmar también los SMS del banco» (apagado por defecto) le llega a Android', sw && sw.antes === false && sw.ahora === true && !sw.dis, sw);

    // 13. Diagnóstico en el paso a paso
    await p.evaluate(() => window.ventoPagosGuia()); await p.waitForTimeout(300);
    const g13 = await p.evaluate(() => document.getElementById('pgGuiaOv').innerText);
    chk('13. Paso a paso: «🔎 Este equipo: App Vento para Android» y el paso de los SMS', /Este equipo: App Vento para Android/.test(g13) && /te avisa por SMS/.test(g13), g13.slice(-400));
    await p.evaluate(() => document.getElementById('pgGuiaOv').classList.remove('show'));

    // 11. Navegador (sin la app): la voz sale con el volumen elegido (hasta 100 %)
    const ctx2 = await b.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx2.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx2.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); localStorage.setItem('vento_pagos_vol', '50'); }catch(e){} });
    const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.message));
    await p2.goto(BASE + '/index.html'); await p2.waitForTimeout(1500);
    await p2.fill('#authBiz', 'Bar Web'); await p2.fill('#authUser', 'leo'); await p2.fill('#authPass', 'clave123'); await p2.click('#authBtn'); await p2.waitForTimeout(1500);
    const r11 = await p2.evaluate(() => {
      const voces = []; window.ventoHablar = (t, o) => voces.push({ t: String(t), vol: o && o.volumen });
      data.pagos = data.pagos || {}; data.pagos.on = true;
      window.pagosRecibirTexto('Nequi | Nequi | MARTA te envió $5.000', 'web-1');
      const v = document.getElementById('pgVol');
      return { voces, max: v && v.max };
    });
    chk('11. En el navegador: «Pago confirmado. 5000 pesos desde Nequi» al 50 %', r11.voces.some(x => /^Pago confirmado\. 5000 pesos desde Nequi/.test(x.t) && x.vol === 0.5), r11);
    chk('11. En el navegador el volumen llega hasta 100 % (más de eso es en la app Android)', r11.max === '100', r11.max);
    await p2.evaluate(() => window.ventoPagosGuia()); await p2.waitForTimeout(300);
    chk('13. En el computador: «🔎 Este equipo: Vento Web en …»', /Este equipo: Vento Web en (Chrome|navegador)/.test(await p2.evaluate(() => document.getElementById('pgGuiaOv').innerText)));
    await ctx2.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
