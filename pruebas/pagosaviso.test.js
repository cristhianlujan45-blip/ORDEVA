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
// 14. Bre-B (de otros bancos por la llave) y Nequi con «¿…?» en el aviso: suenan. Solicitudes («te pidió») no.
// 15. Paso 5 «Que suene siempre»: ahorro de batería, «🚀 Inicio automático» y los pasos de la marca (Xiaomi).
// 19. Avisos «crudos» (la app no los entendió): la página los revisa y, si son pago, los dice.
// 22. Frases de pago del administrador: «es un pago» (con o sin valor) y «no es un pago».
// 21. DaviPlata y Nequi con ahorro de batería → aviso fijo y botón que abre su ajuste («Sin restricciones»).
// 20. Lectura apagada al reinstalar → se prende sola; sin permiso / desconectada / app vieja → aviso fijo para arreglarlo.
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
        fabricante: () => 'Xiaomi|Redmi', abrirInicioAutomatico: () => { A.autoinicio = (A.autoinicio || 0) + 1; return true; },
        permisos: () => JSON.stringify({ bateria: false, fondo: true }), ajustesBateria: () => { A.bateria = (A.bateria || 0) + 1; },
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
    chk('3. Sin voz de Android, la página dice «Pago confirmado. 200 pesos desde DaviPlata, de Juan Perez»', e.voz.some(t => /^Recibiste 200 pesos por DaviPlata, de Juan Perez/.test(t)), e.voz);
    chk('3. … con el sonido de éxito y el aviso del celular «💜 Pagaron $200 por DaviPlata»', e.sonidos === 1 && e.notifs.some(n => /Pagaron \$200 por DaviPlata/.test(n.t)), e);
    chk('5. El aviso se reenvía al servidor CON su ID', e.reenvios.length === 1 && e.reenvios[0].id === 'and-k1:1000:-55' && e.reenvios[0].txt === TXT, e.reenvios);

    // 1. Segundo pago IGUAL (otro aviso, otro ID) poco después
    await p.evaluate(() => { const x = data.pagos.lista[0]; x.srv = 'uuid-1'; saveData(); });   // el servidor enlazó el primero
    await llega('k1:2000:-55', false);
    e = await estado();
    chk('1. Segundo pago igual → OTRO pago registrado (2 de $200)', e.n === 2, e.n);
    chk('1. … y vuelve a sonar (voz y sonido otra vez)', e.voz.filter(t => /^Recibiste 200 pesos por DaviPlata/.test(t)).length === 2 && e.sonidos === 2, e);
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
    chk('6. Nequi: «Pago confirmado. 15000 pesos desde Nequi, de Pedro Ruiz»', e.voz.some(t => /^Recibiste 15000 pesos por Nequi, de Pedro Ruiz/.test(t)), e.voz);

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
    chk('10. En la app, «Pago confirmado» sale por la voz de pagos de Android (con su volumen), no por la de la página', d10.some(t => /^Recibiste 12000 pesos por Nequi/.test(t)) && d10.some(t => /^Recibiste 7000 pesos por DaviPlata/.test(t)) && (await estado()).voz.length === v10, d10);

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

    // 14. Bre-B y Nequi
    const v14 = (await p.evaluate(() => (window.__and.decir || []).length));
    await llega('b1', false, 'DaviPlata | DaviPlata | Llegaron $51.000 a tu llave @juan');
    await llega('b2', false, 'Nequi | Nequi | ¡Te llegó plata! ANA RUIZ te envió $52.000. ¿La guardas en un bolsillo?');
    await llega('b3', false, 'Nequi | ¡Te llegó plata por Bre-B! | MARIA LOPEZ te envió $53.000');
    await llega('b4', false, 'Nequi | Nequi | JUAN PEREZ te pidió $54.000');
    const l14 = await p.evaluate(() => [51000, 52000, 53000, 54000].map(m => (data.pagos.lista || []).filter(x => x.monto === m).length));
    const vz14 = await p.evaluate(n => (window.__and.decir || []).slice(n), v14);   // en la app: la voz de pagos de Android
    chk('14. Bre-B a la llave de DaviPlata: «Llegaron $51.000 a tu llave» → pago registrado', l14[0] === 1, l14);
    chk('14. Nequi con «¿La guardas en un bolsillo?» en el aviso → SÍ es pago (antes se tomaba por publicidad)', l14[1] === 1, l14);
    chk('14. Bre-B a Nequi → registrado', l14[2] === 1, l14);
    chk('14. «JUAN te pidió $54.000» (solicitud) NO es pago', l14[3] === 0, l14);
    chk('14. … y suenan: «Pago confirmado. 52000 pesos desde Nequi» y «… 51000 pesos por Bre-B, en DaviPlata»', vz14.some(t => /^Recibiste 52000 pesos por Nequi/.test(t)) && vz14.some(t => /^Recibiste 51000 pesos por Bre-B, en DaviPlata/.test(t)), vz14);

    // 16. Más formas de DaviPlata, Nequi y la llave Bre-B; avisos que no se tomaron
    const r16 = await p.evaluate(() => {
      const si = ['JUAN PEREZ le envió $30.000 a su DaviPlata. Nunca comparta su clave', 'Te llegaron $12.000 a tu llave 3001234567. No compartas tu clave con nadie',
        'Transferencia entrante por $40.000 desde Banco de Bogotá', 'Abono recibido $25.000 por Bre-B', 'Recibiste un pago de $18.000 en tu llave @tienda',
        'Llegó una transferencia de $33.000 a tu Nequi', 'DaviPlata: Recibio $5.000 de MARIA'];
      const no = ['Enviaste $20.000 a la llave @juan. Nunca compartas tu clave', 'Tu código de verificación es 123456. Te llegó por Bre-B'];
      return { si: si.filter(t => !window.pagosLeer(t)), no: no.filter(t => window.pagosLeer(t)), breb: window.pagosLeer('Recibiste un pago de $18.000 en tu llave @tienda').breb === true,
        fuente: window.pagosFuente('Itaú | Itaú | Recibiste $10.000 por Bre-B').nivel };
    });
    chk('16. Pagos que antes no sonaban (con «nunca comparta su clave», transferencia entrante, abono Bre-B, «Recibio» sin tilde…)', !r16.si.length, r16.si);
    chk('16. Lo que sale o los códigos NO son pago', !r16.no.length, r16.no);
    const r16b = await p.evaluate(() => ({
      sms1: window.pagosLeer('SMS | 85888 | DaviPlata: recibiste  100,000 en tu DaviPlata. Usalos de forma segura para pagar, comprar y mucho mas!'),
      sms2: window.pagosLeer('SMS | 85888 | DaviPlata: Recibiste  140,000. Para saber mas, consulta tus movimientos.'),
      junto: window.pagosLeer('DaviPlata | DaviPlata | Recibiste $140.000 por Bre-B · Recibiste 140,000. Para saber mas, consulta tus movimientos.'),
      pasaste: window.pagosLeer('DaviPlata | DaviPlata | Pasaste $100 a otro DaviPlata. Para saber mas, consulta tus movimientos.'),
      compra: window.pagosLeer('SMS | 85888 | DaviPlata: Compra exitosa en la Tienda Virtual por  20,000. Para saber mas'),
      llaves: window.pagosLeer('DaviPlata | DaviPlata | Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.') }));
    chk('16. SMS reales de DaviPlata (85888) sin $: 100,000 y 140,000', r16b.sms1 && r16b.sms1.monto === 100000 && r16b.sms1.app === 'DaviPlata' && r16b.sms2 && r16b.sms2.monto === 140000, r16b);
    chk('16. La llave + el SMS juntos (los junta la app): $140.000 por Bre-B en DaviPlata', r16b.junto && r16b.junto.monto === 140000 && r16b.junto.breb && r16b.junto.app === 'DaviPlata', r16b.junto);
    chk('16. «Pasaste $100 a otro DaviPlata» y «Compra exitosa» NO son pago; la llave sin valor no inventa uno', !r16b.pasaste && !r16b.compra && !r16b.llaves, r16b);
    chk('16. Se sabe que llegó por la llave Bre-B, y la app de Itaú cuenta como banco', r16.breb && r16.fuente === 'app', r16);
    await p.evaluate(() => { window.__errs16 = []; const e0 = window.ventoError; window.ventoError = (a, b, c, d) => { window.__errs16.push({ a, b, c, d }); return e0 && e0(a, b, c, d); };
      window.VentoAndroid.pagosAvisosDiag = () => JSON.stringify({ ultimo: Date.now() - 60000, vivo: true, lista: [{ app: 'DaviPlata', txt: 'Movimiento NOMBRE $# @llave', motivo: 'no parece plata recibida', t: Date.now() }] });
      window.VentoAndroid.pagosAvisosEstado = () => JSON.stringify({ on: true, permiso: true, vivo: false }); });
    await p.evaluate(() => { try{ window.ventoPagosAbrir ? window.ventoPagosAbrir() : null; }catch(e){} });
    const d16 = await p.evaluate(() => { try{ document.querySelector('.ajustes-cat[data-cat="pagos"]') && document.querySelector('.ajustes-cat[data-cat="pagos"]').click(); }catch(e){}
      const ev = new Event('x'); try{ window.pagosRecibirTexto('Nequi | Nequi | Te llegaron $1 a tu llave', 'z16'); }catch(e){}
      const box = document.getElementById('pgDiag'), t = document.getElementById('pgAndTxt');
      return { diag: box ? box.innerText : '', txt: t ? t.textContent : '', errs: window.__errs16.filter(x => x.a === 'pago').map(x => x.b) }; });
    chk('16. Ajustes → Pagos: «🔎 Avisos del banco que Vento no tomó» (sin datos) y se reportan para aprender el formato', /Avisos del banco que Vento no tomó/.test(d16.diag) && /Último aviso de un banco/.test(d16.diag) && d16.errs.some(x => /no tomó/.test(x)), d16);
    chk('16. Si Android desconectó la lectura, se dice y se pide reconectar', /desconectó la lectura/.test(d16.txt), d16.txt);

    // 15. Paso 5: que suene siempre
    await p.evaluate(() => window.ventoPagosGuia()); await p.waitForTimeout(300);
    const g15 = await p.evaluate(() => document.getElementById('pgGuiaOv').innerText);
    chk('15. Paso 5 «Que suene siempre»: ahorro de batería + «🚀 Inicio automático» + pasos de Xiaomi + bloquear en recientes', /Que suene siempre/.test(g15) && /Quitar el ahorro de batería/.test(g15) && /Inicio automático/.test(g15) && /Xiaomi \/ Redmi \/ POCO/.test(g15) && /Bloquear/.test(g15), g15.slice(0, 100));
    await p.click('[data-gp="autoinicio"]'); await p.click('[data-gp="bateria"]');
    chk('15. Los botones abren «Inicio automático» y el ahorro de batería en Android', await p.evaluate(() => window.__and.autoinicio === 1 && window.__and.bateria === 1));
    await p.evaluate(() => document.getElementById('pgGuiaOv').classList.remove('show'));

    // 17. El aviso del pago solo le sale al dueño/administrador y a quien cobra o atiende ESA mesa (no a todos los meseros)
    const r17 = await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const jefe0 = window.ventoRoles.esJefe; window.ventoRoles.esJefe = () => false;          // este celular es de un mesero
      const P = id => data.products[id], m = (id, n) => { data.tables[id] = data.tables[id] || { items: [], people: [] }; data.tables[id].items = [{ productId: P(0).id, name: P(0).name, price: 7100, size: '', qty: n, personId: null, history: [] }]; data.tables[id].payments = []; delete data.tables[id].atiende; delete data.tables[id].cobrando; };
      m(1, 1); m(2, 2);                                    // mesa 1: $7.100 (la atiende este mesero) · mesa 2: $14.200 (otro mesero)
      window.ventoAtiende.marcar(1, 'pedido');
      data.tables[2].atiende = { u: 'pedro', e: 'pedro@bar.co', t: Date.now() };
      window.__and.decir = []; window.__toasts = [];
      window.pagosRecibirTexto('Nequi | Nequi | ANA RUIZ te envió $7.100', 'mq-17a');            // por el canal: de SU mesa
      const mia = { d: window.__and.decir.slice(), t: window.__toasts.slice() };
      window.__and.decir = []; window.__toasts = [];
      window.pagosRecibirTexto('Nequi | Nequi | LUIS te envió $14.200', 'mq-17b');              // por el canal: de la mesa de otro
      const otra = { d: window.__and.decir.slice(), t: window.__toasts.slice(), reg: data.pagos.lista.some(x => x.monto === 14200) };
      const sinMesa = window.ventoPagoParaMi(99999, null), suMesa = window.ventoPagoParaMi(7100, null), mesa2 = window.ventoPagoParaMi(14200, 2);
      window.ventoAtiende.marcar(2, 'cobro');                                                     // ahora él cobra la mesa 2
      const cobra2 = window.ventoPagoParaMi(14200, 2);
      window.ventoRoles.esJefe = jefe0;
      const dueno = window.ventoPagoParaMi(14200, 2) && window.ventoPagoParaMi(99999, null);
      return { mia, otra, sinMesa, suMesa, mesa2, cobra2, dueno, at1: data.tables[1].atiende && data.tables[1].atiende.u };
    });
    chk('17. Mesero: el pago de SU mesa le suena («Recibiste 7100 pesos…»)', r17.mia.d.some(t => /^Recibiste 7100 pesos/.test(t)) && r17.at1 === 'ana', r17);
    chk('17. Mesero: el pago de la mesa de OTRO mesero no le sale ni le suena (pero queda registrado)', !r17.otra.d.length && !r17.otra.t.some(t => /14\.200/.test(t)) && r17.otra.reg, r17.otra);
    chk('17. Mesero: un pago que no es de ninguna mesa suya no le llega; si cobra esa mesa, sí', !r17.sinMesa && r17.suMesa && !r17.mesa2 && r17.cobra2, r17);
    chk('17. Dueño / administrador: le llegan todos', r17.dueno, r17);

    // 18. Prueba piloto y registro de cada aviso del banco (Ajustes → Pagos)
    const r18 = await p.evaluate(async () => {
      const A = window.VentoAndroid; window.__piloto = [];
      A.pagosAvisosEstado = () => JSON.stringify({ on: true, permiso: true, vivo: true });
      A.pagosPrueba = (app, tit, txt, sms) => { window.__piloto.push([app, tit, txt, sms]); return JSON.stringify({ ok: true, r: sms ? '🔊 junto con el aviso de DaviPlata: Recibiste 3000 pesos por Bre-B, en DaviPlata.' : '🔊 Recibiste 1000 pesos por DaviPlata.' }); };
      A.pagosAvisosDiag = () => JSON.stringify({ ultimo: Date.now(), vivo: true, lista: [], traza: [{ t: Date.now() - 5000, app: 'DaviPlata', txt: 'Pasaste $# a otro DaviPlata', r: '🚫 plata que SALE (pasaste, enviaste, compra…)' }, { t: Date.now(), app: 'Nequi', txt: '¡Te llegó plata! NOMBRE te envió $#', r: '🔊 Recibiste 2500 pesos por Nequi.' }] });
      window.ventoPagosDiag();
      const box = document.getElementById('pgDiag');
      const tieneTraza = !!box && /Últimos avisos del banco y qué hizo Vento/.test(box.innerHTML) && /plata que SALE/.test(box.innerHTML);
      const btn = box && box.querySelector('[data-piloto="davi"]'); if(btn) btn.click();
      const res1 = (document.getElementById('pgPilotoRes') || {}).textContent || '';
      const antes = data.pagos.lista.length;
      window.__and.cola.push({ id: 'PRUEBA:1:abc', txt: 'DaviPlata | DaviPlata | ¡Le llegó plata! JUAN PEREZ le pasó $1.000 a su DaviPlata', voz: true });
      window.__toasts = []; window.ventoAvisosNativos();
      return { tieneTraza, res1, piloto: window.__piloto.slice(), registro: data.pagos.lista.length - antes, toast: window.__toasts.find(t => /Prueba piloto/.test(t)) || '' };
    });
    chk('18. Ajustes → Pagos: «📋 Últimos avisos del banco y qué hizo Vento» (con el porqué)', r18.tieneTraza, r18);
    chk('18. «🧪 Prueba piloto»: pasa un aviso de DaviPlata por el mismo camino y muestra lo que dijo', r18.piloto.length === 1 && /JUAN PEREZ le pasó \$1\.000/.test(r18.piloto[0][2]) && /Recibiste 1000 pesos por DaviPlata/.test(r18.res1), r18);
    chk('18. La prueba piloto NO se registra como pago (solo avisa «🧪 Prueba piloto»)', r18.registro === 0 && /Prueba piloto: Vento entendió \$1\.000 por DaviPlata/.test(r18.toast), r18);

    // 19. Avisos «crudos»: la app Android no entendió el aviso del banco y se lo pasa a la página, que lo revisa con sus
    //     reglas (siempre al día) y, si es plata recibida, lo dice. Si tampoco lo entiende, lo reporta (sin datos).
    const r19 = await p.evaluate(() => {
      window.__and.decir = []; window.__errs19 = []; const e0 = window.ventoError; window.ventoError = (a, b, c, d) => { window.__errs19.push({ a, b, c, d }); };
      window.__and.cola.push({ id: 'k19:R:1', txt: 'Bancolombia | Bancolombia | Te llegaron $9.900 a tu llave', t: Date.now(), voz: false, crudo: true });
      window.__and.cola.push({ id: 'k19:R:2', txt: 'Bancolombia | Bancolombia | Movimiento en tu cuenta por $4.000', t: Date.now(), voz: false, crudo: true });
      window.ventoAvisosNativos();
      window.ventoError = e0;
      return { voz: window.__and.decir.slice(), reg: data.pagos.lista.some(x => x.monto === 9900), noReg: data.pagos.lista.some(x => x.monto === 4000), errs: window.__errs19.map(x => x.b) };
    });
    chk('19. Aviso crudo que la página sí entiende: se registra y suena «Recibiste 9900 pesos por Bre-B…»', r19.reg && r19.voz.some(t => /^Recibiste 9900 pesos por Bre-B/.test(t)), r19);
    chk('19. Aviso crudo que tampoco entiende: no suena ni se registra, y se reporta para aprender el formato', !r19.noReg && !r19.voz.some(t => /4000/.test(t)) && r19.errs.some(x => /no entendió/.test(x)), r19);

    // 20. ¿Este celular sí lee los avisos de pago? Al reinstalar la app la lectura quedaba apagada y los pagos no sonaban.
    const r20 = await p.evaluate(() => {
      const A = window.VentoAndroid, S = window.__and, ban = () => { const b = document.getElementById('pgSalud'); return b && !b.hidden ? b.innerText : ''; };
      A.pagosLectura = () => 2; S.on = false; S.permiso = true; S.vivo = true;
      A.pagosAvisosEstado = () => JSON.stringify({ on: S.on, permiso: S.permiso, vivo: S.vivo });
      delete data.pagos.andOff;
      const k1 = window.ventoPagosSalud(), prendio = S.on, b1 = ban();
      S.permiso = false; const k2 = window.ventoPagosSalud(), b2 = ban();
      S.permiso = true; delete A.pagosLectura; const k3 = window.ventoPagosSalud(), b3 = ban(), apk = !!document.querySelector('#pgSalud a[href$="vento.apk"]');
      A.pagosLectura = () => 2; S.vivo = false; window.ventoPagosSalud(); const k4 = window.ventoPagosSalud(), b4 = ban();
      S.vivo = true; data.pagos.andOff = true; S.on = false; const k5 = window.ventoPagosSalud(), siguioApagada = !S.on;
      delete data.pagos.andOff;
      const j0 = window.ventoRoles.esJefe; window.ventoRoles.esJefe = () => false; S.on = false;
      const k6 = window.ventoPagosSalud(), mesero = { on: S.on, ban: ban() };
      window.ventoRoles.esJefe = j0; S.on = true; window.ventoPagosSalud();
      return { k1, prendio, b1, k2, b2, k3, b3, apk, k4, b4, k5, siguioApagada, k6, mesero, fin: ban() };
    });
    chk('20. La lectura apagada (se reinstaló la app) se vuelve a prender sola, sin aviso', r20.prendio && r20.k1 === '' && !r20.b1, r20);
    chk('20. Sin el permiso «Acceso a notificaciones»: aviso fijo «Los pagos no van a sonar» con «🔓 Dar el permiso»', r20.k2 === 'permiso' && /no van a sonar/.test(r20.b2) && /Dar el permiso/.test(r20.b2), r20);
    chk('20. App Android vieja: aviso fijo con «⬇️ Instalar la nueva» (vento.apk)', r20.k3 === 'vieja' && /Actualiza la app Vento/.test(r20.b3) && r20.apk, r20);
    chk('20. Android desconectó la lectura (dos revisiones seguidas): «🔄 Reconectar»', r20.k4 === 'desconectada' && /Reconectar/.test(r20.b4), r20);
    chk('20. Si el dueño la apagó a propósito, no se prende sola', r20.k5 === '' && r20.siguioApagada, r20);
    chk('20. En el celular de un mesero no se prende sola ni sale el aviso', r20.k6 === '' && !r20.mesero.on && !r20.mesero.ban && !r20.fin, r20);

    // 21. 🔋 DaviPlata y Nequi con ahorro de batería: Android retrasa sus avisos de pago. Vento lo detecta, lo dice con un
    //     aviso fijo y abre el ajuste de esa app para elegir «Sin restricciones».
    const r21 = await p.evaluate(async () => {
      const A = window.VentoAndroid, S = window.__and, ban = () => { const b = document.getElementById('pgSalud'); return b && !b.hidden ? b.innerText : ''; };
      try{ localStorage.removeItem('vento-bancos-bat-luego'); }catch(e){}
      S.on = true; S.permiso = true; S.vivo = true; A.pagosLectura = () => 2;
      A.pagosAvisosEstado = () => JSON.stringify({ on: S.on, permiso: S.permiso, vivo: S.vivo });
      S.bancos = [{ pkg: 'com.davivienda.daviplataapp', nombre: 'DaviPlata', sinRestriccion: false }, { pkg: 'com.nequi.MobileApp', nombre: 'Nequi', sinRestriccion: false }];
      S.abiertos = [];
      A.bancosBateria = () => JSON.stringify(S.bancos);
      A.bancoAjustes = pkg => { S.abiertos.push(pkg); return true; };
      window.__toasts = [];
      const k1 = window.ventoPagosSalud(), b1 = ban();
      document.querySelector('#pgSalud [data-banco]').click();
      const abrio = S.abiertos.slice(), toast = window.__toasts.find(t => /Sin restricciones/.test(t)) || '';
      // Volvió de los ajustes: DaviPlata ya quedó sin restricciones → el aviso ahora pide arreglar Nequi
      S.bancos[0].sinRestriccion = true;
      const k2 = window.ventoPagosSalud(), b2 = ban();
      // «Luego»: no vuelve a salir (3 días)
      document.querySelector('#pgSalud [data-pgs="cerrar"]').click();
      const k3 = window.ventoPagosSalud(), b3 = ban();
      // Ajustes → Pagos y el paso a paso muestran cada app con su estado y el botón
      window.ventoPagosDiag();
      const diag = (document.getElementById('pgDiag') || {}).innerText || '';
      await window.ventoPagosGuia(); await new Promise(r => setTimeout(r, 300));
      const guia = document.getElementById('pgGuiaOv').innerText;
      document.getElementById('pgGuiaOv').classList.remove('show');
      S.bancos[1].sinRestriccion = true; window.ventoPagosSalud();
      try{ localStorage.removeItem('vento-bancos-bat-luego'); }catch(e){}
      return { k1, b1, abrio, toast, k2, b2, k3, b3, diag, guia, fin: ban() };
    });
    chk('21. DaviPlata y Nequi con ahorro de batería: aviso fijo «tienen ahorro de batería… Sin restricciones»', r21.k1 === 'bancos' && /DaviPlata y Nequi/.test(r21.b1) && /ahorro de batería/.test(r21.b1) && /Arreglar DaviPlata/.test(r21.b1), r21);
    chk('21. «🔋 Arreglar DaviPlata» abre el ajuste de DaviPlata y explica Batería → Sin restricciones', r21.abrio[0] === 'com.davivienda.daviplataapp' && /Batería/.test(r21.toast), r21);
    chk('21. Al volver con DaviPlata arreglada, el aviso pasa a Nequi', r21.k2 === 'bancos' && /Nequi/.test(r21.b2) && !/DaviPlata/.test(r21.b2), r21);
    chk('21. «Luego» lo deja quieto (no vuelve a salir enseguida)', r21.k3 === '' && !r21.b3, r21);
    chk('21. Ajustes → Pagos y el paso a paso muestran cada app: ✅ sin restricciones / ⚠️ con ahorro', /DaviPlata: sin restricciones/.test(r21.diag) && /Nequi: con ahorro de batería/.test(r21.diag) && /Que DaviPlata y Nequi avisen al instante/.test(r21.guia), r21);

    // 22. 💜 Frases de pago del administrador: «es un pago» (con o sin valor) y «no es un pago»
    const r22 = await p.evaluate(() => {
      window.ventoFrasesPago.poner([{ t: 'Abono a tu DaviPlata', tipo: 'pago', banco: 'DaviPlata' }, { t: 'tu saldo es', tipo: 'ignorar' }, { t: 'Movimiento recibido', tipo: 'pago', banco: 'Bancolombia' }]);
      window.__and.decir = []; window.__toasts = [];
      window.__and.cola.push({ id: 'k22:R:1', txt: 'SMS | 85888 | DaviPlata: Abono a tu DaviPlata por transferencia: 8,000', t: Date.now(), voz: false, crudo: true, smsOk: true });
      window.__and.cola.push({ id: 'k22:R:2', txt: 'Nequi | Nequi | Te llegó plata $50.000. Tu saldo es $80.000', t: Date.now(), voz: false });
      window.__and.cola.push({ id: 'k22:R:3', txt: 'Bancolombia | Bancolombia | Movimiento recibido en tu cuenta', t: Date.now(), voz: false, crudo: true });
      window.ventoAvisosNativos();
      const l = data.pagos.lista || [];
      window.ventoFrasesPago.poner([]);
      return { pago: l.some(x => x.monto === 8000 && x.app === 'DaviPlata'), ignorado: !l.some(x => x.monto === 50000), voz: window.__and.decir.slice(), toasts: window.__toasts.slice() };
    });
    chk('22. Frase «Abono a tu DaviPlata» (es un pago): el SMS con 8,000 se registra y suena «Recibiste 8000 pesos por DaviPlata»', r22.pago && r22.voz.some(x => /^Recibiste 8000 pesos por DaviPlata/.test(x)), r22);
    chk('22. Frase «Tu saldo es» (no es un pago): el aviso no se registra ni suena', r22.ignorado && !r22.voz.some(x => /50000/.test(x)), r22);
    chk('22. Frase de pago sin valor en el aviso: «Llegó plata por Bancolombia. Mira el valor en la aplicación.»', r22.voz.some(x => /^Llegó plata por Bancolombia/.test(x)) && r22.toasts.some(x => /Llegó plata por Bancolombia/.test(x)), r22);

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
    chk('11. En el navegador: «Pago confirmado. 5000 pesos desde Nequi» al 50 %', r11.voces.some(x => /^Recibiste 5000 pesos por Nequi/.test(x.t) && x.vol === 0.5), r11);
    chk('11. En el navegador el volumen llega hasta 100 % (más de eso es en la app Android)', r11.max === '100', r11.max);
    await p2.evaluate(() => window.ventoPagosGuia()); await p2.waitForTimeout(300);
    chk('13. En el computador: «🔎 Este equipo: Vento Web en …»', /Este equipo: Vento Web en (Chrome|navegador)/.test(await p2.evaluate(() => document.getElementById('pgGuiaOv').innerText)));
    await ctx2.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
