// 🤖 1.99.73 · Preguntas por UN producto al asistente. Antes «¿cuánto vendí de purina esta semana?» respondía el total de
// TODAS las ventas; «¿cuánto gano con la purina?» daba la de 1 kg sin decirlo; «¿a cómo está la purina?» no respondía.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    { const m = new Date(); m.setHours(12, 0, 0, 0); await p.clock.install({ time: m }); await p.clock.resume(); }   // las ventas «de hace un rato» siempre de hoy, corra a la hora que corra la prueba
    await p.goto(BASE); await p.waitForTimeout(1000);
    const r = await p.evaluate(async () => { await enterApp('test', null);
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, cost: 6000, stock: 10 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, cost: 28000, stock: 4 }, { id: 'v', name: 'Vasija', price: 5000, cost: 3000, stock: 7 }];
      const v = (id, items, dias) => ({ id, invoiceNo: 'FV-' + id, date: new Date(Date.now() - (dias || 0) * 864e5 - 3600e3).toISOString(), table: 2, total: items.reduce((s, i) => s + i.qty * i.price, 0), debt: 0, items, payments: [{ method: 'efectivo', amount: items.reduce((s, i) => s + i.qty * i.price, 0) }] });
      data.history = [v('a', [{ productId: 'pa1', name: 'Purina', size: '1 kg', price: 8000, qty: 2 }, { productId: 'v', name: 'Vasija', price: 5000, qty: 1 }]), v('b', [{ productId: 'pa5', name: 'Purina', size: '5 kg', price: 35000, qty: 3 }]),
        v('c', [{ name: 'Purina', price: 8000, qty: 1 }], 3), v('d', [{ productId: 'pa5', name: 'Purina', price: 35000, qty: 1 }], 20)];
      await saveData();
      const a = q => asisLocalMas(q) || asisLocal(q) || '';
      return { semana: a('cuánto vendí de purina esta semana'), hoy: a('cuántas purinas vendí hoy'), mes: a('cuánto vendí de purina este mes'), vasija: a('cuántas vasijas vendí hoy'),
        gano: a('cuánto gano con la purina'), precio: a('a cómo está la purina'), total: a('cuánto vendí hoy'), nada: a('cuánto vendí de vasija ayer') }; });
    chk('Semana: Purina por tamaño (1 kg: 2, 5 kg: 3) + 1 vieja sin tamaño; no el total de todo', /1 kg: 2 unidades \(\$\s?16\.000\)/.test(r.semana) && /5 kg: 3 unidades \(\$\s?105\.000\)/.test(r.semana) && /1 sin tamaño registrado/.test(r.semana) && /Total: 6/.test(r.semana) && !/5\.000\)/.test(r.semana.replace(/105\.000|16\.000|8\.000|129\.000/g, '')), r.semana);
    chk('Hoy: solo las de hoy (1 kg: 2, 5 kg: 3)', /1 kg: 2 unidades/.test(r.hoy) && /5 kg: 3 unidades/.test(r.hoy) && !/sin tamaño/.test(r.hoy), r.hoy);
    chk('Mes: incluye la de hace 20 días si es de este mes (o 30 días)', /5 kg: [34] unidades/.test(r.mes), r.mes);
    chk('Un producto sin tamaños: «De Vasija vendiste 1 unidad ($5.000) hoy»', /De Vasija vendiste 1 unidad \(\$\s?5\.000\) hoy/.test(r.vasija), r.vasija);
    chk('Ganancia: la de cada tamaño', /1 kg: .*ganas \$\s?2\.000 \(25%\)/.test(r.gano) && /5 kg: .*ganas \$\s?7\.000 \(20%\)/.test(r.gano), r.gano);
    chk('Precio: el de cada tamaño con lo que queda', /1 kg: \$\s?8\.000 · quedan 10/.test(r.precio) && /5 kg: \$\s?35\.000 · quedan 4/.test(r.precio), r.precio);
    chk('Sin nombrar producto sigue dando el total del día', /Hoy llevas \$\s?126\.000/.test(r.total), r.total);
    chk('Sin ventas de ese producto: lo dice', /No vendiste Vasija ayer/.test(r.nada), r.nada);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
