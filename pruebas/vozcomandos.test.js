// TODOS los comandos de voz, dichos por el micrófono de la app Android (reconocedor simulado como la app instalada):
// básicos, con pausas, cantidades grandes, correcciones, deshacer, cuentas, mesas con nombre, cambiar/juntar mesas,
// personas, abonos, inventario, preguntas, libreta, calculadora, quitar mesa con «sí»/«no», producto por voz y botón IA.
// En cada orden además: un solo pitido, la app nativa no reabre el micrófono, se procesa una vez y el micrófono queda cerrado.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(require('./simandroidvoz'));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar C'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.__habla = []; window.speakVoice = t => __habla.push(String(t));
      window.__toasts = []; const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); s(m, ms); };
      const h = window.handleVoiceTranscript; window.handleVoiceTranscript = function(t){ __sim.procesados.push(t); return h.apply(this, arguments); };
      data.products = [{ id: 'ag', name: 'Águila', price: 3300, stock: 500 }, { id: 'pk', name: 'Póker', price: 3500, stock: 500 }, { id: 'cc', name: 'Club Colombia', price: 4000, stock: 500 }, { id: 'co', name: 'Coca Cola', price: 3000, stock: 500 }];
      for(let i = 1; i <= 5; i++) data.tables[i] = { items: [], people: [] }; data.tableCount = 5; saveData(); });
    await p.waitForTimeout(400);
    const estado = () => p.evaluate(() => {
      const m = {}; Object.keys(data.tables).forEach(k => { const t = data.tables[k]; m[k] = { items: (t.items || []).map(i => i.qty + '×' + i.name).sort().join(', '), nombre: t.name || '', gente: (t.people || []).map(x => x.name), pagos: (t.payments || []).map(x => x.amount) }; });
      return { m, toasts: __toasts.slice(), habla: __habla.slice(), abiertos: [...document.querySelectorAll('.overlay.show')].map(o => o.id), cur: typeof currentTable !== 'undefined' ? currentTable : null,
        beeps: __sim.beeps, reintentos: __sim.reintentos, vivo: __sim.vivo, mudo: __sim.mudo, escuchando: voiceListening, procesados: __sim.procesados.slice() };
    });
    const decir = async (guion, ia) => {
      await p.evaluate(([g, ia]) => { Object.assign(__sim, { guion: Array.isArray(g) ? g.slice() : [g], beeps: 0, reintentos: 0, procesados: [] }); __toasts.length = 0; __habla.length = 0; startVoiceCommand(!!ia); }, [guion, !!ia]);
      await p.waitForFunction(() => !voiceListening, null, { timeout: 30000 });
      await p.waitForTimeout(700);
      const e = await estado();
      await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
      return e;
    };
    const eq = (a, x) => String(a).split(', ').sort().join(', ') === String(x).split(', ').sort().join(', ');   // sin importar el orden
    const dice = (e, re) => e.toasts.concat(e.habla).some(t => re.test(t));
    const casos = [
      // — Básicos —
      ['mesa 1 dos águilas', e => eq(e.m[1].items, '2×Águila')],
      [['mesa 1 tres póker', 'y una club colombia'], e => eq(e.m[1].items, '1×Club Colombia, 2×Águila, 3×Póker')],
      ['dos póker para la mesa 3', e => eq(e.m[3].items, '2×Póker')],
      ['la 3 dos águilas', e => eq(e.m[3].items, '2×Águila, 2×Póker')],
      ['5 una coca cola', e => eq(e.m[5].items, '1×Coca Cola')],
      ['3 dos águilas', e => eq(e.m[3].items, '2×Póker, 4×Águila')],
      ['que sean dos águilas para la mesa 2', e => eq(e.m[2].items, '2×Águila')],
      ['regáleme una coca para la 2', e => eq(e.m[2].items, '1×Coca Cola, 2×Águila')],
      ['son tres póker para la mesa 2', e => eq(e.m[2].items, '1×Coca Cola, 2×Águila, 3×Póker')],
      // — Pedidos largos, pausas y cantidades grandes —
      [['mesa 4 dos águilas', 'tres póker', 'ocho póker', 'cinco águilas'], e => eq(e.m[4].items, '11×Póker, 7×Águila')],
      ['mesa 4 cuarenta póker y treinta águilas', e => eq(e.m[4].items, '37×Águila, 51×Póker')],
      [['mesa 5 veinte póker y', { t: 'quince águilas', tarde: 700 }], e => eq(e.m[5].items, '1×Coca Cola, 15×Águila, 20×Póker')],
      // — Corregir y deshacer —
      ['quita una póker de la mesa 1', e => eq(e.m[1].items, '1×Club Colombia, 2×Águila, 2×Póker')],
      ['la mesa 1 son diez águilas', e => eq(e.m[1].items, '1×Club Colombia, 10×Águila, 2×Póker')],
      ['no, eran tres águilas mesa 1', e => eq(e.m[1].items, '1×Club Colombia, 2×Póker, 3×Águila')],
      ['menos una águila la 3', e => eq(e.m[3].items, '2×Póker, 3×Águila')],
      ['deshacer', e => eq(e.m[3].items, '2×Póker, 4×Águila') && dice(e, /Deshecho/)],
      ['borra lo último', e => eq(e.m[1].items, '1×Club Colombia, 10×Águila, 2×Póker')],
      // — Cuentas y totales —
      ['cuenta de la mesa 1', e => e.abiertos.includes('billSummaryOverlay') && dice(e, /La cuenta de .*1 es/)],
      ['cuánto debe la 3', e => dice(e, /La cuenta de .*3 es 20\.200 pesos/)],
      ['la 2 pagó', e => e.abiertos.includes('billSummaryOverlay')],
      ['total de todas las mesas', e => dice(e, /cuenta general/i)],
      ['cuánto vendí hoy', e => dice(e, /Hoy llevas/)],
      // — Mesas: crear, nombre, cambiar, juntar, abrir, quitar —
      ['agrégame una mesa a nombre de Juan y agrégale dos póker', e => e.m[6] && e.m[6].nombre === 'Juan' && eq(e.m[6].items, '2×Póker')],
      ['cámbiale el nombre a la mesa 1 por Pedro', e => e.m[1].nombre === 'Pedro'],
      ['quítale el nombre a la mesa 1', e => !e.m[1].nombre],
      ['misma ronda para la mesa 6', e => eq(e.m[6].items, '4×Póker')],
      ['otra la 3', e => /Misma ronda/.test(e.toasts.join(' '))],
      ['pasa la mesa 3 a la 4', e => !e.m[3].items && /Pasé la cuenta/.test(e.toasts.join(' '))],
      ['junta la mesa 4 con la 5', e => !e.m[4].items && /junté/.test(e.toasts.join(' '))],
      ['mesa 2', e => e.cur === 2],
      ['abre la mesa 1', e => e.cur === 1],
      ['agrega una mesa', e => !!e.m[7]],
      ['quitar mesa 7', e => !e.m[7]],
      ['quitar la mesa 2', e => !!e.m[2] && dice(e, /di "sí"/)],
      ['no', e => !!e.m[2] && dice(e, /no quité la mesa/)],
      ['quitar la mesa 2', e => !!e.m[2]],
      ['sí', e => !e.m[2] && dice(e, /Quité la Mesa 2/)],
      // — Personas y abonos —
      ['agrega a Juan a la mesa 1', e => e.m[1].gente.includes('Juan')],
      ['pon a María en la mesa 1', e => e.m[1].gente.includes('María')],
      ['la mesa 1 abona 20 mil', e => e.m[1].pagos.includes(20000)],
      ['Juan paga 10 mil de la mesa 1 por Nequi', e => e.m[1].pagos.includes(10000) && dice(e, /por transferencia/)],
      // — Preguntas, inventario, recordar —
      ['cuántas póker quedan', e => dice(e, /De Póker quedan \d+ unidades/)],
      ['recuérdame el pedido de la mesa 1', e => dice(e, /En total lleva/)],
      ['qué lleva la mesa 1', e => dice(e, /En total lleva/)],
      ['recuérdame el pedido', e => dice(e, /Tu último pedido fue/)],
      ['qué mesas están abiertas', e => dice(e, /mesas abiertas/)],
      ['comandos', e => e.abiertos.includes('voiceHelpOverlay')],
      // — Libreta y calculadora —
      ['Julián quedó debiendo 30 mil', e => dice(e, /Julián te debe \$30\.000/)],
      ['quién me debe', e => dice(e, /Te deben/)],
      ['súmame 3500 más 4000', e => dice(e, /7\.500/)],
      // — Cobrar —
      ['cobra la mesa 5', e => e.cur === 5 && dice(e, /Confirma el cobro/)],
    ];
    for(const [g, ok2] of casos){
      const e = await decir(g);
      const n = '«' + (Array.isArray(g) ? g.map(x => typeof x === 'string' ? x : x.t).join(' · ') : g) + '»';
      let bien = false; try{ bien = !!ok2(e); }catch(err){}
      chk(n, bien, { m: e.m, toasts: e.toasts, habla: e.habla, abiertos: e.abiertos, cur: e.cur });
      chk(n + ' — un pitido, sin reabrirse, una sola vez, micrófono cerrado', e.beeps === 1 && e.reintentos === 0 && e.procesados.length === 1 && !e.vivo && !e.escuchando && !e.mudo, { beeps: e.beeps, reintentos: e.reintentos, procesados: e.procesados, vivo: e.vivo, mudo: e.mudo });
      await p.evaluate(() => { try{ closeModal && closeModal(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    }

    // Botón IA sin clave: usa la voz clásica y lo anota igual
    let e = await decir('mesa 1 una águila', true);
    chk('Botón IA sin clave → «La IA no está conectada… Usé la voz clásica» y anota igual', /11×Águila/.test(e.m[1].items) && dice(e, /IA no está conectada/), e.toasts);

    // Producto por voz: lo que se oye a medias («precio cinco») no guarda nada; con la frase final, UNA vez a $5.000
    await p.evaluate(() => { Object.assign(__sim, { guion: [{ t: 'agregar producto Pilsen precio cinco mil', parcial: 'agregar producto Pilsen precio cinco' }], beeps: 0, reintentos: 0 }); startVoiceProductCreation(); });
    await p.waitForFunction(() => !voiceProductListening, null, { timeout: 15000 }); await p.waitForTimeout(1500);
    const pil = await p.evaluate(() => data.products.filter(x => /pilsen/i.test(x.name)).map(x => ({ n: x.name, precio: x.price })));
    chk('Producto por voz: «Pilsen, precio cinco mil» → UN producto a $5.000 (no a $5)', pil.length === 1 && Number(pil[0].precio) === 5000, pil);
    e = await estado();
    chk('Producto por voz: micrófono cerrado sin reabrirse y sin pitidos de más', !e.vivo && e.reintentos === 0 && e.beeps === 1 && !e.mudo, e);
    // Y después el micrófono de pedidos sigue funcionando normal (la escucha compartida queda bien)
    e = await decir('mesa 1 una póker');
    chk('Después del producto por voz, el micrófono de pedidos sigue igual', /3×Póker/.test(e.m[1].items) && e.beeps === 1 && e.reintentos === 0, e.m[1]);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
