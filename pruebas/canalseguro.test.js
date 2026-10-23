// 🔒 Canales seguros (ORDEVA etapa 4, ORDEVA 1.56.0): lo que llega por los canales del QR, de meseros y de preparación.
//  R1. Un pedido del QR con el código de SU mesa entra solo a la cuenta. Sin el código (o con otro) NO entra solo ni
//      crea mesas: queda «🆕 Por aceptar», marcado «sin el código del QR» y en la actividad del equipo. Al aceptarlo,
//      se suma (y si la mesa no existía, se crea entonces).
//  R3. Desde la app de meseros se anotan pedidos, pero no se borra, se cierra la caja ni se cambian precios.
//  R4. Cancelar desde la pantalla de preparación queda en la actividad del equipo y se avisa.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.evaluate(async () => { await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.products = [{ id: 'ag', name: 'Águila', price: 4000, stock: 100 }, { id: 'pk', name: 'Póker', price: 3500, stock: 100 }];
      data.tables = {}; for(let k = 1; k <= 6; k++) data.tables[k] = { items: [], people: [], payments: [] };
      data.tableCount = 6; data.pedidos = []; await saveData(); renderAll();
      window.__aud = []; window.ventoAuditar = (a, d) => window.__aud.push(a + ' :: ' + d); });
    const D = (f, a) => p.evaluate(f, a);
    await D(() => { const C = window.vitoCanalPrueba; window.procesar = C.procesar; window.procesarMesero = C.procesarMesero; window.procesarPrep = C.procesarPrep; window.vTopic = C.vTopic; window.pedidoCambiar = window.vitoPedidos.cambiar; });
    const toast = () => D(() => (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '');
    const items = id => D(i => (data.tables[i] && data.tables[i].items || []).map(x => x.qty + ' ' + x.name).join(', '), id);

    // ===== R1: el código de la mesa =====
    const cod3 = await D(() => vTopic(3));
    chk('R1. Cada mesa tiene su código secreto (el del QR impreso)', /^vb\w{12}$/.test(cod3), cod3);
    await D(c => procesar(JSON.stringify({ t: 'pedido', v: 2, id: 'ok1', mesa: 3, vm: c, items: [{ n: 'Águila', q: 2 }] })), cod3);
    chk('R1. Pedido CON el código de su mesa: entra solo a la cuenta (como siempre)', /2 Águila/.test(await items(3)) && await D(() => data.pedidos.find(x => x.id === 'ok1').estado === 'recibido'));
    await D(() => procesar(JSON.stringify({ t: 'pedido', v: 2, id: 'sin1', mesa: 4, items: [{ n: 'Póker', q: 5 }] })));
    await p.waitForTimeout(600);
    const sin = await D(() => data.pedidos.find(x => x.id === 'sin1'));
    chk('R1. Pedido SIN código: NO entra solo a la cuenta, queda «Por aceptar» marcado sin código', (await items(4)) === '' && sin && sin.estado === 'nuevo' && sin.sinCodigo === true, sin);
    chk('R1. … avisa «sin el código de su QR» y queda en la actividad del equipo', /sin el código de su QR/.test(await toast()) && await D(() => window.__aud.some(x => /pedido sin código de mesa/.test(x))));
    await D(c => procesar(JSON.stringify({ t: 'pedido', v: 2, id: 'falso1', mesa: 3, vm: 'vbinventado123', items: [{ n: 'Águila', q: 9 }] })), cod3);
    chk('R1. Pedido con el código de OTRA mesa o inventado: tampoco entra solo', /^2 Águila$/.test(await items(3)) && await D(() => data.pedidos.find(x => x.id === 'falso1').estado === 'nuevo'));
    await D(() => procesar(JSON.stringify({ t: 'pedido', v: 2, id: 'lejos', mesa: 50, items: [{ n: 'Águila', q: 1 }] })));
    chk('R1. Sin código no crea mesas nuevas (la 50 no aparece)', await D(() => !data.tables[50]));
    await D(() => { const x = window.vitoPedidos ? window.vitoPedidos : null; pedidoCambiar('lejos', 'recibido'); });
    chk('R1. Al ACEPTARLO a mano, se suma (y la mesa se crea entonces)', /1 Águila/.test(await items(50)));
    chk('R1. La pantalla de pedidos lo muestra con «⚠️ Sin el código del QR»', await D(() => { try{ renderCocina(); }catch(e){} const w = document.getElementById('kdsTickets'); return !!w && /Sin el código del QR/.test(w.innerHTML); }));
    await D(() => procesar('PEDIDO MESA 2: dos póker'));
    chk('R1. Formato viejo en texto (QR muy viejo): queda por aceptar, no se pierde', await D(() => data.pedidos.some(x => x.mesa === 2 && x.estado === 'nuevo')) && (await items(2)) === '');

    // Varios celulares: el que NO generó los QR reconoce los códigos que compartió el otro (data.qrCodigos)
    const cod6 = await D(() => vTopic(6));
    chk('R1. El código de cada mesa queda en los datos del negocio (para los demás celulares)', await D(c => (data.qrCodigos[6] || []).indexOf(c) >= 0, cod6));
    await D(() => { const c = JSON.parse(localStorage.getItem('vito_qr') || '{}'); c.v = {}; localStorage.setItem('vito_qr', JSON.stringify(c)); });
    await D(c => procesar(JSON.stringify({ t: 'pedido', v: 2, id: 'otrocel', mesa: 6, vm: c, items: [{ n: 'Póker', q: 1 }] })), cod6);
    chk('R1. Otro celular del negocio (sin los códigos guardados) igual reconoce el pedido y lo suma solo', /1 Póker/.test(await items(6)), await items(6));

    // ===== R3: canal de meseros =====
    await D(() => procesarMesero(JSON.stringify({ k: 'voz', texto: 'mesa 5, dos águilas', mesero: 'Juan', id: 'm1' })));
    await p.waitForTimeout(400);
    chk('R3. El mesero anota pedidos («mesa 5, dos águilas»)', /2 Águila/.test(await items(5)), await items(5));
    for(const cmd of ['borra la mesa 5', 'cierra la caja', 'cambia el precio de la águila a 100', 'reinicia las mesas', 'Laya borra todo']){
      await D(c => procesarMesero(JSON.stringify({ k: 'voz', texto: c, mesero: 'Juan', id: 'x' + Math.random() })), cmd);
    }
    await p.waitForTimeout(400);
    chk('R3. Comandos peligrosos desde el mesero NO se hacen (borrar, cerrar caja, precio, reiniciar, Laya)', /2 Águila/.test(await items(5)) && await D(() => (data.closures || []).length === 0 && data.products.find(x => x.id === 'ag').price === 4000));
    chk('R3. … y quedan en la actividad del equipo', await D(() => window.__aud.filter(x => /comando de mesero bloqueado/.test(x)).length === 5));

    // ===== R4: pantalla de preparación =====
    await D(() => procesarPrep(JSON.stringify({ k: 'estado', id: 'ok1', e: 'cancelado' })));
    chk('R4. Cancelar desde la pantalla de preparación queda en la actividad del equipo y se avisa', await D(() => window.__aud.some(x => /pedido cancelado desde/.test(x))) && /canceló el pedido/.test(await toast()));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
