// Agregar DaviPlata (y Nequi) para que ORDEVA avise «Pagaron $X» UNA vez por pago.
// El puente nativo (VentoAndroid: VentoEscucha + notificar + permisos) se simula; lo demás es la app de verdad.
//  1. DaviPlata escribe de «usted» («¡Le llegó plata!», «MARIA LOPEZ le pasó $30.000», «Recibió $15.000»): ahora sí se entiende.
//     Lo que SALE («Usted pasó $10.000 a…») y los códigos no se toman.
//  2. Notificación del celular «💜 Recibiste $30.000 por DaviPlata» (se puede apagar en Notificaciones).
//  3. Una sola vez: el mismo aviso que llega por la app y por MacroDroid no se repite; dos clientes que pagan lo mismo sí son dos pagos.
//  4. Paso a paso (Ajustes → 💜 Pagos, panel de pagos y asistente): cada paso con su estado y botones que hacen el paso.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      const A = window.__and = { on: false, permiso: false, bateria: false, cola: [], notifs: [], permisoAbierto: 0, bateriaAbierta: 0 };
      window.VentoAndroid = {
        pagosAvisos: v => { A.on = !!v; }, pagosAvisosEstado: () => JSON.stringify({ on: A.on, permiso: A.permiso }),
        pagosAvisosTomar: () => { const s = JSON.stringify(A.cola); A.cola = []; return s; },
        mediosPermiso: () => { A.permisoAbierto++; }, notificar: (t, x, c, s) => { A.notifs.push({ t, x, c, s }); return true; },
        permisos: () => JSON.stringify({ microfono: true, camara: true, avisos: true, bateria: A.bateria, fondo: true }),
        ajustesBateria: () => { A.bateriaAbierta++; },
      };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Davi'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.pagos = { on: true, topic: '', lista: [], vistos: [], espera: {} }; saveData(); });
    const lista = () => p.evaluate(() => (data.pagos.lista || []).map(x => ({ monto: x.monto, app: x.app, de: x.de, estado: x.estado })));
    const notifs = () => p.evaluate(() => window.__and.notifs.slice());

    // ===== 1. Textos de DaviPlata =====
    const casos = [
      ['DaviPlata | ¡Le llegó plata! | MARIA LOPEZ le pasó $30.000 a su DaviPlata', 30000, 'Maria Lopez'],
      ['DaviPlata | DaviPlata | Recibió $15.000 de CARLOS RUIZ', 15000, 'Carlos Ruiz'],
      ['DaviPlata | Movimiento | Ha recibido una transferencia por $8.500', 8500, ''],
      ['DaviPlata | ¡Le pasaron plata! | Le enviaron $12.000 a su DaviPlata', 12000, ''],
    ];
    for(const [txt, monto, de] of casos){
      const r = await p.evaluate(t => window.pagosLeer(t), txt);
      chk('1. «' + txt.split('|').slice(1).join('|').trim() + '» → ' + monto + (de ? ' de ' + de : ''), r && r.monto === monto && r.app === 'DaviPlata' && r.de === de, r);
    }
    for(const txt of ['DaviPlata | Pago | Usted pasó $10.000 a JUAN PEREZ', 'DaviPlata | Código | Su código de seguridad es 123456 para recibir $5.000', 'DaviPlata | Compra | Compraste $20.000 en Tienda']){
      chk('1. No se toma: «' + txt.split('|').slice(2).join('|').trim() + '»', await p.evaluate(t => window.pagosLeer(t), txt) === null);
    }
    chk('1. Nequi sigue igual («JUAN PEREZ te envió $25.000»)', await p.evaluate(() => { const r = window.pagosLeer('Nequi | ¡Te llegó plata! | JUAN PEREZ te envió $25.000'); return r && r.monto === 25000 && r.de === 'Juan Perez'; }));

    // ===== 2 y 3. Llega por la app Android =====
    await p.evaluate(() => { window.__and.cola.push({ id: 'k1:1', txt: 'DaviPlata | ¡Le llegó plata! | MARIA LOPEZ le pasó $30.000 a su DaviPlata', t: Date.now() }); window.ventoAvisosNativos(); });
    let l = await lista(), n = await notifs();
    chk('2. El pago de DaviPlata queda confirmado', l.length === 1 && l[0].monto === 30000 && l[0].estado === 'app' && l[0].de === 'Maria Lopez', l);
    chk('2. Notificación del celular: «💜 Recibiste $30.000 por DaviPlata» (de Maria Lopez)', n.length === 1 && n[0].t === '💜 Recibiste $30.000 por DaviPlata' && /Maria Lopez/.test(n[0].x), n);
    await p.evaluate(() => window.pagosRecibirTexto('DaviPlata | ¡Le llegó plata! | MARIA LOPEZ le pasó $30.000 a su DaviPlata', 'canal-77'));
    l = await lista(); n = await notifs();
    chk('3. El mismo aviso por MacroDroid (otro camino) no se repite', l.length === 1 && n.length === 1, { l, n });
    await p.evaluate(() => { window.__and.cola.push({ id: 'k2:1', txt: 'DaviPlata | ¡Le pasaron plata! | Le enviaron $12.000 a su DaviPlata', t: Date.now() }, { id: 'k3:1', txt: 'DaviPlata | ¡Le pasaron plata! | Le enviaron $12.000 a su DaviPlata', t: Date.now() }); window.ventoAvisosNativos(); });
    l = await lista();
    chk('3. Dos clientes que pagan lo mismo (dos avisos distintos) sí son dos pagos', l.filter(x => x.monto === 12000).length === 2, l);
    // Apagar el aviso de pagos en Notificaciones
    await p.evaluate(() => { const i = document.getElementById('notifPagosOn'); i.checked = false; i.dispatchEvent(new Event('change')); });
    const antes = (await notifs()).length;
    await p.evaluate(() => { window.__and.cola.push({ id: 'k4:1', txt: 'DaviPlata | DaviPlata | Recibió $15.000 de CARLOS RUIZ', t: Date.now() }); window.ventoAvisosNativos(); });
    chk('2. Con «💜 Pagos que te llegan» apagado en Notificaciones, ya no sale el aviso del celular (el pago sí queda)', (await notifs()).length === antes && (await lista()).some(x => x.monto === 15000), await notifs());
    await p.evaluate(() => { const i = document.getElementById('notifPagosOn'); i.checked = true; i.dispatchEvent(new Event('change')); });

    // ===== 4. Paso a paso =====
    await p.evaluate(() => { data.pagos.on = false; window.__and.on = false; saveData(); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.click('#navMoreBtn'); await p.click('.more-tile[data-go="ajustes"]');
    if(await p.isVisible('#ajustesBackBtn')) await p.click('#ajustesBackBtn');
    await p.click('.ajustes-cat[data-cat="pagos"]');
    chk('4. En Ajustes → 💜 Pagos está el botón «📘 Paso a paso: agregar DaviPlata o Nequi»', await p.isVisible('#pgGuiaBtn'));
    await p.click('#pgGuiaBtn');
    await p.waitForSelector('#pgGuiaOv.show .gp-paso', { timeout: 4000 });
    let txt = await p.textContent('#pgGuiaOv');
    chk('4. Explica que NO necesita convenio con Davivienda y que avisa una sola vez', /No necesitas convenio con Davivienda/.test(txt) && /una sola vez/.test(txt), txt.slice(0, 300));
    chk('4. Tiene los 6 pasos (app, prender, permiso, notificaciones de DaviPlata, batería, prueba)', await p.$$eval('#pgGuiaOv .gp-paso', x => x.length) === 6 && /Acceso a notificaciones/.test(txt) && /Aplicaciones → DaviPlata → Notificaciones/.test(txt));
    chk('4. Paso 1 ya está listo (estás en la app ORDEVA)', /Ya estás en la app ORDEVA/.test(txt));
    await p.click('#pgGuiaOv [data-gp="prender"]'); await p.waitForTimeout(600);
    let A = await p.evaluate(() => window.__and);
    chk('4. «Prender ahora» prende los avisos y abre el permiso «Acceso a notificaciones»', A.on && A.permisoAbierto >= 1 && await p.evaluate(() => data.pagos.on === true), A);
    txt = await p.textContent('#pgGuiaOv');
    chk('4. El paso 3 dice que falta el permiso', /Falta el permiso/.test(txt));
    await p.evaluate(() => { window.__and.permiso = true; });
    await p.waitForFunction(() => /Permiso dado/.test(document.getElementById('pgGuiaOv').textContent), null, { timeout: 5000 }).catch(() => {});
    chk('4. Al volver con el permiso dado, el paso 3 se marca ✅ solo', /Permiso dado/.test(await p.textContent('#pgGuiaOv')));
    await p.click('#pgGuiaOv [data-gp="bateria"]');
    chk('4. «Quitar el ahorro de batería» abre los ajustes del celular', await p.evaluate(() => window.__and.bateriaAbierta === 1));
    const n0 = (await lista()).length;
    await p.click('#pgGuiaOv [data-gp="probar"]'); await p.waitForTimeout(500);
    chk('4. «Ver cómo se ve» muestra un pago de prueba de DaviPlata', (await lista()).length === n0 + 1 && /Pago confirmado · \$1\.000 por DaviPlata/.test(await p.evaluate(() => document.body.innerText)));
    chk('4. El paso 6 reconoce el pago REAL de DaviPlata que ya llegó (no el de prueba)', /Ya llegó un pago real de DaviPlata/.test(await p.textContent('#pgGuiaOv')));
    await p.click('#pgGuiaOv [data-gp="cerrar"]');
    chk('4. «Listo» cierra el paso a paso', !(await p.evaluate(() => document.getElementById('pgGuiaOv').classList.contains('show'))));

    // Desde el asistente
    const r = await p.evaluate(() => { const x = window.Laya.responder('cómo agrego david plata'); return x && { text: x.text, run: typeof x.run }; });
    chk('4. Asistente: «cómo agrego David Plata» → abre el paso a paso', r && /paso a paso/i.test(r.text) && r.run === 'function', r);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.Laya.responder('quiero que me avise cuando me paguen por nequi').run(); });
    chk('4. … y «que me avise cuando me paguen» también', await p.waitForFunction(() => document.getElementById('pgGuiaOv').classList.contains('show'), null, { timeout: 3000 }).then(() => true, () => false));
    // Desde el panel de pagos con los avisos apagados
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.pagos.on = false; saveData(); window.pagosAbrirPanel(); });
    await p.click('#pagosPanelOv [data-pp="guia"]');
    chk('4. Panel de pagos (avisos apagados) → «📘 Paso a paso» abre la guía', await p.evaluate(() => document.getElementById('pgGuiaOv').classList.contains('show') && !document.getElementById('pagosPanelOv').classList.contains('show')));
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.pagosAbrirPanel(); });
    await p.click('#pagosPanelOv [data-pp="config"]'); await p.waitForTimeout(900);
    chk('4. «⚙️ Ajustes de pagos» abre Ajustes → 💜 Pagos (antes abría «Negocio»)', await p.evaluate(() => { const g = document.getElementById('pgGrupo'); return !!g && !g.hidden && g.offsetParent !== null; }));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
