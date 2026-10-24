// Un pago de Nequi / DaviPlata / Bre-B que lee UN celular les llega a TODOS los equipos del negocio (otros celulares,
// tablet, computador), de punta a punta (PostgreSQL REAL + Servidor ORDEVA + la app de verdad):
//  1. El celular de la caja (app Android) lee el aviso real de la llave Bre-B de Nequi → lo manda al Servidor ORDEVA con
//     lo que entendió (valor, banco, quién).
//  2. La tablet (app Android): la notificación de pagos con la 🪟 ventana del valor y la voz «Llegaron 300 pesos por
//     Nequi», aunque ORDEVA esté de fondo (el latido de la app la despierta).
//  3. El computador (navegador): la 🪟 ventana con el valor y «Pago confirmado».
//  4. El celular que lo leyó no lo repite (ni otra notificación ni otra voz).
//  5. Sin internet en el celular cuando llega el aviso: queda en espera y se manda solo al volver → les llega a los demás.
//  6. El servidor usa el valor que entendió la app cuando su propia lectura no lo entiende.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página en ningún equipo', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 250 }).then(() => true, () => false);
    async function equipo(nombre, ancho, android){
      const ctx = await b.newContext({ viewport: { width: ancho, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(android => {
        try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){}
        const A = window.__and = { cola: [], notifs: [], pagos: [], decir: [] };
        if(android) window.VentoAndroid = {
          pagosAvisos: () => {}, pagosAvisosEstado: () => JSON.stringify({ on: true, permiso: true, vivo: true }),
          pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
          notificar: (t, x, c, s) => { A.notifs.push({ t, x, c, s }); return true; },
          pagoNotificar: (t, f, o, v, bco, tipo) => { A.pagos.push({ t, f, o, v, bco, tipo }); },
          pagosDecir: t => { A.decir.push(String(t)); },
          pagosNotif: () => {}, pagosVolumen: () => {}, ventanaPagoOn: () => {}, alFrente: () => false,
          pagosCruce: j => { A.cruce = j; }, pagosCruceEstado: () => '{}',
          pagoReclamar: id => { A.reclamados = A.reclamados || []; if(A.androidYaLoDijo || A.reclamados.includes(id)) return false; A.reclamados.push(id); return true; },
          pagosVozOn: v => { A.vozOn = !!v; }, pagosVozEstado: () => A.vozOn !== false,
          permisos: () => JSON.stringify({ avisos: true, bateria: A.bateria === true, fondo: true }), fabricante: () => 'Xiaomi|Redmi',
          ajustesBateria: () => { A.abrioBateria = (A.abrioBateria || 0) + 1; }, abrirInicioAutomatico: () => { A.abrioAuto = (A.abrioAuto || 0) + 1; return true; },
        };
      }, !!android);
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { nombre, ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    async function entrar(E){
      await E.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
      await E.p.fill('#authUser', 'dueno@equipos.co'); await E.p.fill('#authPass', 'clave123'); await E.p.click('#authBtn');
      const d = await dentro(E.p); await E.p.click('#onbSaltar', { timeout: 3000 }).catch(() => {}); await cerrarTodo(E.p);
      return d;
    }
    const and = E => E.p.evaluate(() => JSON.parse(JSON.stringify(window.__and)));

    // ===== Tres equipos del mismo negocio: celular de la caja, tablet y computador =====
    const CEL = await equipo('celular', 390, true);
    await CEL.p.fill('#authBiz', 'Bar Equipos'); await CEL.p.fill('#authUser', 'dueno@equipos.co'); await CEL.p.fill('#authPass', 'clave123'); await CEL.p.click('#authBtn');
    chk('El celular crea la cuenta y entra', await dentro(CEL.p));
    await CEL.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(CEL.p);
    chk('El celular queda en la nube y autorizado para mandar los avisos (solo)', await esperar(CEL.p, () => !!window.ventoNube.negocio() && !!localStorage.getItem('vento_pagos_dev'), null, 15000));
    const NEG = (await CEL.p.evaluate(() => window.ventoNube.negocio())).id;
    const TAB = await equipo('tablet', 800, true), PC = await equipo('computador', 1280, false);
    chk('La tablet entra con la misma cuenta', await entrar(TAB));
    chk('El computador entra con la misma cuenta', await entrar(PC));
    chk('Los tres en el MISMO negocio, como administradores', (await Promise.all([TAB, PC].map(E => E.p.evaluate(() => (window.ventoNube.negocio() || {}).id + '|' + (window.ventoNube.negocio() || {}).rol)))).every(x => x === NEG + '|dueno'));
    // Ya revisaron los pagos una vez (desde ahí, lo nuevo avisa).
    for(const E of [TAB, PC]) await esperar(E.p, () => window.ventoPagos && window.ventoPagos.estado().ultimoSync > 0, null, 15000);

    // ===== 1. El celular lee el aviso real de la llave Bre-B de Nequi (la app Android ya lo dijo en voz alta) =====
    const BREB = 'Nequi Colombia | Te enviaron plata por Bre-B | Te enviaron $300. Entra a tu app y revisa tu saldo.';
    await CEL.p.evaluate(t => { window.__and.cola.push({ id: 'kbreb:1:1', txt: t, t: Date.now(), voz: true }); window.ventoAvisosNativos(); }, BREB);
    const enServidor = async m => (await sb.sql("select monto::int monto, estado, metodo, confianza from pagos where negocio_id = $1 and proveedor = 'dispositivo' and monto = $2", [NEG, m]));
    let llego = false; for(let i = 0; i < 40 && !llego; i++){ llego = (await enServidor(300)).length === 1; if(!llego) await new Promise(r => setTimeout(r, 250)); }
    const s1 = await enServidor(300);
    chk('1. El aviso llegó al Servidor ORDEVA: $300 por Nequi, aprobado y confiable', llego && s1[0].estado === 'aprobado' && s1[0].metodo === 'NEQUI' && s1[0].confianza === 'app', s1);

    // ===== 2. La tablet (app Android de fondo): el latido de la app la despierta =====
    const t0 = Date.now();
    const latir = E => E.p.evaluate(() => window.ventoLatido && window.ventoLatido());
    let tab = null;
    for(let i = 0; i < 90; i++){ await latir(TAB); tab = await and(TAB); if(tab.pagos.length) break; await new Promise(r => setTimeout(r, 500)); }
    chk('2. Tablet: notificación de pagos con la 🪟 ventana del valor «$300» por Nequi', tab.pagos.length === 1 && /^💜 Recibiste \$300 por Nequi/.test(tab.pagos[0].t) && tab.pagos[0].v === '$300' && tab.pagos[0].bco === 'Nequi' && tab.pagos[0].tipo === 'ok', tab.pagos);
    chk('2. Tablet: la voz de los pagos dice «Llegaron 300 pesos por Nequi»', tab.decir.some(t => /^Llegaron 300 pesos por Nequi/.test(t)), tab.decir);
    chk('2. Tablet: llegó en menos de 30 s con ORDEVA de fondo', Date.now() - t0 < 30000, Date.now() - t0);
    chk('2. Tablet: sale en el canal de pagos, no como un aviso cualquiera', !tab.notifs.some(n => /\$300/.test(n.t + n.x) && n.c !== 'pagos'), tab.notifs);

    // ===== 3. El computador (navegador): la ventana con el valor =====
    chk('3. Computador: sale la 🪟 ventana con «$300» y Nequi', await esperar(PC.p, () => { const v = document.getElementById('pgVentana'); return !!v && /\$300/.test(v.textContent) && /Nequi/.test(v.textContent); }, null, 35000));
    chk('3. Computador: el pago queda en su lista de pagos', await PC.p.evaluate(() => (data.pagos.lista || []).some(x => x.monto === 300 && /nequi/i.test(x.app))));

    // ===== 4. El celular que lo leyó no lo repite =====
    await latir(CEL); await new Promise(r => setTimeout(r, 1500)); await CEL.p.evaluate(() => window.ventoPagos.sincronizar()); await new Promise(r => setTimeout(r, 1000));
    const cel = await and(CEL);
    chk('4. El celular que lo leyó: ni otra ventana, ni otra voz (la app Android ya lo dijo)', cel.pagos.length === 0 && !cel.decir.some(t => /300 pesos/.test(t)), cel);
    chk('4. … y queda un solo pago de $300 en su lista', await CEL.p.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 300).length === 1));

    // ===== 5. Sin internet cuando llega el aviso =====
    const sinRed = r => r.abort('internetdisconnected');
    await CEL.p.route(/\/functions\/v1\/vento-pagos\/aviso\//, sinRed);
    await CEL.p.evaluate(() => { window.__and.cola.push({ id: 'kdav:2:2', txt: 'DaviPlata | ¡Le llegó plata! | MARIA LOPEZ le pasó $45.000 a su DaviPlata', t: Date.now(), voz: true }); window.ventoAvisosNativos(); });
    await new Promise(r => setTimeout(r, 1200));
    { const q5 = await CEL.p.evaluate(() => localStorage.getItem('vento_pagos_reenvio')); chk('5. Sin internet: el aviso queda en espera en el celular', JSON.parse(q5 || '[]').length === 1 && (await enServidor(45000)).length === 0, q5); }
    await CEL.p.unroute(/\/functions\/v1\/vento-pagos\/aviso\//, sinRed);
    await CEL.p.evaluate(() => window.dispatchEvent(new Event('online')));
    llego = false; for(let i = 0; i < 40 && !llego; i++){ llego = (await enServidor(45000)).length === 1; if(!llego){ await latir(CEL); await new Promise(r => setTimeout(r, 500)); } }
    chk('5. Vuelve el internet: se manda solo y llega al servidor ($45.000 por DaviPlata)', llego && (await enServidor(45000))[0].metodo === 'DAVIPLATA');
    chk('5. … y la espera queda vacía', await esperar(CEL.p, () => JSON.parse(localStorage.getItem('vento_pagos_reenvio') || '[]').length === 0, null, 5000));
    tab = null; for(let i = 0; i < 90; i++){ await latir(TAB); tab = await and(TAB); if(tab.pagos.some(x => x.v === '$45.000')) break; await new Promise(r => setTimeout(r, 500)); }
    chk('5. La tablet recibe ese pago: «Llegaron 45000 pesos por DaviPlata» (sin el nombre)', tab.pagos.some(x => x.v === '$45.000' && x.bco === 'DaviPlata') && tab.decir.some(t => /^Llegaron 45000 pesos por DaviPlata/.test(t)) && !tab.decir.some(t => /Maria/.test(t)), tab);

    // ===== 5b. Bre-B por la LLAVE a DaviPlata (1.58.2): el aviso de la app SIN valor y luego el SMS 85888 CON el valor =====
    // Lo que la app Android deja en la cola: primero el aviso de la llave (sin valor; Android ya dijo «Llegó plata por
    // Bre-B») y después el SMS juntado con ese aviso (con el valor). El computador debe decirlo y mostrarlo.
    await PC.p.evaluate(() => { window.__voz = []; const s0 = window.speakVoice; window.speakVoice = (t, o) => { window.__voz.push(String(t)); try{ return s0 && s0(t, o); }catch(e){} }; });
    await CEL.p.evaluate(() => {
      window.__and.cola.push({ id: 'kllave:1:1', txt: 'DaviPlata | DaviPlata | Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.', t: Date.now(), voz: true });
      window.ventoAvisosNativos();
    });
    await new Promise(r => setTimeout(r, 1500));
    await CEL.p.evaluate(() => {
      window.__and.cola.push({ id: 'M:' + Date.now() + ':77', txt: 'DaviPlata | DaviPlata | Recibiste $65.000 por Bre-B · Recibiste  65,000. Para saber mas, consulta tus movimientos.', t: Date.now(), voz: true });
      window.ventoAvisosNativos();
    });
    llego = false; for(let i = 0; i < 40 && !llego; i++){ llego = (await enServidor(65000)).length === 1; if(!llego){ await latir(CEL); await new Promise(r => setTimeout(r, 250)); } }
    const s5b = await enServidor(65000);
    chk('5b. Bre-B por la llave a DaviPlata: llega al servidor $65.000 por DaviPlata, confirmado', llego && s5b[0].metodo === 'DAVIPLATA' && s5b[0].confianza === 'app' && s5b[0].estado === 'aprobado', s5b);
    chk('5b. Computador: sale la 🪟 ventana con «$65.000» y DaviPlata', await esperar(PC.p, () => { const v = document.getElementById('pgVentana'); return !!v && /\$65\.000/.test(v.textContent) && /DaviPlata/.test(v.textContent); }, null, 35000));
    chk('5b. Computador: lo DICE en voz alta («Llegaron 65000 pesos por DaviPlata»)', await esperar(PC.p, () => (window.__voz || []).some(t => /65000 pesos por DaviPlata/.test(t)), null, 10000), await PC.p.evaluate(() => window.__voz));
    tab = null; for(let i = 0; i < 60; i++){ await latir(TAB); tab = await and(TAB); if(tab.decir.some(t => /65000/.test(t))) break; await new Promise(r => setTimeout(r, 500)); }
    chk('5b. Tablet: también lo dice («Llegaron 65000 pesos por DaviPlata»)', tab.decir.some(t => /^Llegaron 65000 pesos por DaviPlata/.test(t)), tab.decir);

    // ===== 5c. Primero el SMS 85888 (con valor) y después el aviso de la llave: también suena en el computador =====
    await PC.p.evaluate(() => { window.__voz = []; });
    await CEL.p.evaluate(() => {
      window.__and.cola.push({ id: 'M:' + Date.now() + ':88', txt: 'SMS | 85888 | DaviPlata: Recibiste  72,000. Para saber mas, consulta tus movimientos.', t: Date.now(), voz: true, smsOk: true });
      window.ventoAvisosNativos();
    });
    llego = false; for(let i = 0; i < 40 && !llego; i++){ llego = (await enServidor(72000)).length === 1; if(!llego){ await latir(CEL); await new Promise(r => setTimeout(r, 250)); } }
    const s5c = await enServidor(72000);
    chk('5c. SMS 85888 primero: llega al servidor $72.000 por DaviPlata', llego && s5c[0].metodo === 'DAVIPLATA' && s5c[0].estado === 'aprobado', s5c);
    chk('5c. … y como CONFIRMADO (85888 es el número oficial de DaviPlata, igual que en el celular)', llego && s5c[0].confianza === 'app', s5c);
    chk('5c. Computador: lo dice en voz alta (72000 pesos)', await esperar(PC.p, () => (window.__voz || []).some(t => /72000 pesos/.test(t)), null, 35000), await PC.p.evaluate(() => window.__voz));
    // ===== 5d. Solo el aviso de la llave, SIN SMS: el computador también se entera («Llegó plata por Bre-B en DaviPlata») =====
    // (con «Recibir avisos de pagos» prendido, como lo tiene el negocio: es un ajuste compartido por todos los equipos)
    await CEL.p.evaluate(() => { data.pagos = data.pagos || {}; data.pagos.on = true; saveData(); });
    chk('5d. El ajuste «Recibir avisos de pagos» llega al computador', await esperar(PC.p, () => !!(data.pagos && data.pagos.on), null, 20000));
    await new Promise(r => setTimeout(r, 17000));              // el computador se conecta al canal de pagos (cada 15 s revisa)
    await PC.p.evaluate(() => { window.__voz = []; });
    await CEL.p.evaluate(() => {
      window.__and.cola.push({ id: 'kllave:2:2', txt: 'DaviPlata | DaviPlata | Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.', t: Date.now(), voz: true });
      window.ventoAvisosNativos();
    });
    chk('5d. Solo la llave (sin valor): el computador dice que llegó plata por Bre-B en DaviPlata', await esperar(PC.p, () => (window.__voz || []).some(t => /Bre-?B/i.test(t) && /DaviPlata/i.test(t)), null, 35000), await PC.p.evaluate(() => window.__voz));

    // ===== 7. ⏳ El computador espera el pago de la Mesa 4; el celular lo lee =====
    await CEL.p.evaluate(() => { data.pagos = data.pagos || {}; data.pagos.on = true; data.tables[4] = { items: [{ productId: 'p4', name: 'Bandeja', price: 27300, qty: 1 }], payments: [], people: [] }; saveData(); });
    chk('7. La mesa llega al computador', await esperar(PC.p, () => !!(data.tables[4] && data.tables[4].items.length), null, 15000));
    await PC.p.evaluate(() => window.ventoConfirma.abrir(4));
    chk('7. Computador: «⏳ Esperando el pago · $27.300»', await esperar(PC.p, () => /Esperando el pago/.test((document.getElementById('vcEspera') || {}).innerText || '') && /27\.300/.test(document.getElementById('vcEspera').innerText), null, 5000));
    chk('7. El celular y la tablet saben que el computador espera esa mesa', await esperar(CEL.p, () => !!((data.pagos || {}).pantallas || {})[4], null, 15000) && await esperar(TAB.p, () => !!((data.pagos || {}).pantallas || {})[4], null, 15000));
    await CEL.p.evaluate(() => { window.__and.cola.push({ id: 'k7:7:7', txt: 'Nequi | Nequi | CAMILO ROJAS te envió $27.300', t: Date.now(), voz: true }); window.ventoAvisosNativos(); });
    let verde7 = false; for(let i = 0; i < 90 && !verde7; i++){ await latir(PC); verde7 = await PC.p.evaluate(() => /PAGADO/.test((document.getElementById('vcEspera') || {}).innerText || '')); if(!verde7) await new Promise(r => setTimeout(r, 500)); }
    chk('7. Computador: la pantalla se pone verde «✅ PAGADO $27.300» y lo registra en la Mesa 4', verde7 && await PC.p.evaluate(() => (data.tables[4].payments || []).reduce((a, q) => a + q.amount, 0) === 27300));
    const modal7 = E => E.p.evaluate(() => { const o = document.getElementById('pagoOv'); return !!o && o.classList.contains('show') && /27\.300/.test(o.innerText); });
    for(let i = 0; i < 6; i++){ await latir(TAB); await new Promise(r => setTimeout(r, 500)); }
    chk('7. El celular y la tablet NO abren «Llegó un pago» para esa mesa (se registra en el computador)', !(await modal7(CEL)) && !(await modal7(TAB)));
    chk('7. Queda registrado UNA sola vez en todos los equipos', await esperar(CEL.p, () => (data.tables[4].payments || []).length === 1, null, 15000) && await esperar(TAB.p, () => (data.tables[4].payments || []).length === 1, null, 15000));

    // ===== 6. El valor que entendió la app manda cuando el servidor no entiende el aviso =====
    const dev = await CEL.p.evaluate(() => JSON.parse(localStorage.getItem('vento_pagos_dev')));
    const F = sb.url + '/functions/v1/vento-pagos/aviso/' + dev.token;
    const r6 = await (await fetch(F, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ text: 'Nequi | Nequi | Movimiento recibido por $ 18 500', id: 'and-k6:1', pista: { monto: 18500, app: 'Nequi', de: 'Luis Gil', nivel: 'app' } }) })).json();
    chk('6. «Movimiento recibido por $ 18 500» con lo que entendió la app → $18.500 por Nequi de Luis Gil', r6.ok && r6.monto === 18500 && (await sb.sql("select pagador from pagos where id = $1", [r6.pago]))[0].pagador === 'Luis Gil', r6);
    const r6b = await (await fetch(F, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ text: 'Nequi | Nequi | Tu saldo es $ 18 500', id: 'and-k6:2' }) })).json();
    chk('6. Sin lo que entendió la app, lo que no es un pago sigue sin ser un pago', r6b.ok && r6b.ignorado && !r6b.pago, r6b);

    // ===== 8. Android pregunta por los pagos él mismo (Cruce), celular retirado, voz apagada y chequeo =====
    const cruce = await CEL.p.evaluate(() => { try{ return JSON.parse(window.__and.cruce || '{}'); }catch(e){ return {}; } });
    chk('8. La página le pasa a Android la dirección, la llave pública y el token del celular', cruce.token === dev.token && /^https:\/\/.+supabase\.co/.test(cruce.url) && !!cruce.key, cruce);
    const rpcAnon = async (tok, desde) => (await fetch(sb.url + '/rest/v1/rpc/pagos_dispositivo', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + sb.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: tok, p_desde: desde || null }) })).json();
    const devTab = await TAB.p.evaluate(() => JSON.parse(localStorage.getItem('vento_pagos_dev')));
    const q1 = await rpcAnon(devTab.token), p300 = (q1.pagos || []).find(x => Number(x.monto) === 300);
    chk('8. Con el token de la tablet (sin sesión) Android ve los pagos del negocio, y de cuál celular vino cada uno', q1.ok && q1.rol === 'dueno' && q1.dispositivo === devTab.id && p300 && p300.de_dispositivo === dev.id, { ok: q1.ok, rol: q1.rol, n: (q1.pagos || []).length, p300 });
    const q2 = await rpcAnon('x'.repeat(40));
    chk('8. Con un token que no es de un celular autorizado: nada', q2.ok === false && q2.error === 'dispositivo_no_autorizado' && !q2.pagos, q2);
    const visto = (await sb.sql('select extract(epoch from now() - ultimo_visto)::int s from dispositivos where id = $1', [devTab.id]))[0].s;
    chk('8. Cada pregunta deja la tablet «vista» (el chequeo sabe que está escuchando)', visto <= 5, visto);
    const lee = (id, txt) => CEL.p.evaluate(([id, txt]) => { window.__and.cola.push({ id, txt, t: Date.now(), voz: true }); window.ventoAvisosNativos(); }, [id, txt]);
    // Llegó POR EL SERVIDOR a la tablet (no solo la copia de la lista de pagos que viene de otro equipo).
    const llegaTab = async (v) => { for(let i = 0; i < 90; i++){ await latir(TAB); const t = await TAB.p.evaluate(v => Object.values(window.ventoPagos._cache).some(x => Number(x.monto) === v), v); if(t){ await new Promise(r => setTimeout(r, 300)); return true; } await new Promise(r => setTimeout(r, 500)); } return false; };
    // Android ya lo anunció → la página no lo repite
    await TAB.p.evaluate(() => { window.__and.androidYaLoDijo = true; window.__and.pagos = []; window.__and.decir = []; });
    await lee('k8:61:1', 'Nequi | Nequi | SOFIA te envió $61.000');
    const t8 = await llegaTab(61000);
    let a8 = await and(TAB);
    chk('8. Si Android ya lo anunció (con la página dormida), la página no lo repite: ni otra ventana ni otra voz', t8 && !a8.pagos.some(x => x.v === '$61.000') && !a8.decir.some(x => /61000/.test(x)), { t8, a8: a8.pagos });
    await TAB.p.evaluate(() => { window.__and.androidYaLoDijo = false; });
    // Celular retirado: se vuelve a autorizar solo y el aviso igual llega
    await sb.sql('update dispositivos set revocado_en = now() where id = $1', [dev.id]);
    await lee('k8:62:1', 'Nequi | Nequi | RAUL te envió $62.000');
    let ok62 = false; for(let i = 0; i < 40 && !ok62; i++){ ok62 = (await enServidor(62000)).length === 1; if(!ok62) await new Promise(r => setTimeout(r, 400)); }
    const dev2 = await CEL.p.evaluate(() => JSON.parse(localStorage.getItem('vento_pagos_dev')));
    chk('8. Celular retirado: se vuelve a autorizar solo (token nuevo) y el aviso llega igual al servidor', ok62 && dev2.token !== dev.token, { ok62, nuevo: dev2.token !== dev.token });
    chk('8. … y la tablet lo recibe', await llegaTab(62000));
    chk('8. … y Android queda con el token nuevo', await CEL.p.evaluate(t => JSON.parse(window.__and.cruce || '{}').token === t, dev2.token));
    // Voz apagada en la tablet
    await TAB.p.evaluate(() => { window.ventoPagosVozOn(false); window.__and.pagos = []; window.__and.decir = []; });
    chk('8. «Decir los pagos en voz alta» apagado le llega a Android', await TAB.p.evaluate(() => window.__and.vozOn === false));
    await lee('k8:63:1', 'Nequi | Nequi | ELENA te envió $63.000');
    const t63 = await llegaTab(63000); await new Promise(r => setTimeout(r, 300));
    a8 = await and(TAB);
    chk('8. Con la voz apagada: llega con su notificación y su ventana, sin voz', t63 && a8.pagos.some(x => x.v === '$63.000') && !a8.decir.some(x => /63000/.test(x)), { t63, recl: a8.reclamados, ya: a8.androidYaLoDijo, cache: await TAB.p.evaluate(() => Object.values(window.ventoPagos._cache).filter(x => x.monto == 63000).map(x => x.id + ':' + x.estado + ':' + x.actualizado_en)), pagos: a8.pagos, lista: await TAB.p.evaluate(() => (data.pagos.lista || []).filter(x => x.monto === 63000)) });
    await TAB.p.evaluate(() => window.ventoPagosVozOn(true));
    // Chequeo
    await PC.p.evaluate(() => window.ventoPagosChequeo());
    const ck = await esperar(PC.p, () => { const o = document.getElementById('vpChequeo'); return !!o && /Equipos de la cuenta/.test(o.innerText) && /\(este\)/.test(o.innerText); }, null, 15000);
    const ckTxt = await PC.p.evaluate(() => (document.getElementById('vpChequeo') || {}).innerText || '');
    // Chequeo en un celular Xiaomi con ahorro de batería: lo dice y abre dónde arreglarlo
    await CEL.p.evaluate(() => window.ventoPagosChequeo());
    await esperar(CEL.p, () => /Equipos de la cuenta/.test((document.getElementById('vpChequeo') || {}).innerText || ''), null, 15000);
    const ckCel = await CEL.p.evaluate(() => document.getElementById('vpChequeo').innerText);
    chk('8. 🩺 Chequeo en el celular (Xiaomi con ahorro de batería): «ORDEVA sin ahorro de batería» en rojo con «Arreglar», servicio de fondo y «Inicio automático» de Xiaomi', /❌\s*🔋 ORDEVA sin ahorro de batería/.test(ckCel) && /Arreglar/.test(ckCel) && /ORDEVA trabajando de fondo/.test(ckCel) && /Xiaomi: inicio automático/.test(ckCel), ckCel.slice(0, 800));
    await CEL.p.click('#vpChequeo [data-ck="bat"]'); await CEL.p.click('#vpChequeo [data-ck="auto"]');
    chk('8. … «Arreglar» abre el ahorro de batería y «Abrir inicio automático» el de la marca', await CEL.p.evaluate(() => window.__and.abrioBateria === 1 && window.__and.abrioAuto === 1));
    chk('8. 🩺 Chequeo: servidor, este equipo autorizado y los 3 equipos de la cuenta con «escuchando»', ck && /Servidor ORDEVA/.test(ckTxt) && /Este equipo autorizado/.test(ckTxt) && (ckTxt.match(/🟢/g) || []).length >= 3, ckTxt.slice(0, 900));
  }
})();
