// 🔒 1.99.61 · Cerrar la caja sin haberla abierto con base (como el dueño de la agropecuaria): el arqueo decía «debía haber»
// = solo lo vendido en efectivo. Si ese día pagaron un fiado en efectivo, al contar salía «sobran»; si se le pagó a un
// proveedor desde la libreta, «faltan». Ahora entran como entradas/salidas (igual que en «Cuadre» y en Laya). Revisa:
//  Venta en efectivo $10.000 · Juan paga en la libreta $30.000 (efectivo) · Rosa paga $5.000 por Nequi · se le pagan $4.000
//  en efectivo a Agro Sur desde la libreta → Cuadre y el arqueo: debía haber $36.000; al contar $36.000 «cuadra».
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_vista_sencilla', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; window.showConfirm = async () => true;
      const ayer = new Date(Date.now() - 864e5).toISOString();
      data.closures = [{ id: 'c0', date: new Date(Date.now() - 3600e3).toISOString(), from: null, ticketCount: 0, totalSold: 0, z: 1 }];
      data.tables = {}; data.turno = null; data.libreta = { movs: [] };
      data.history = [{ id: 'f1', invoiceNo: 'FV-1', date: ayer, table: 1, total: 30000, debt: 30000, items: [{ name: 'x', price: 30000, qty: 1 }], payments: [{ method: 'debe', amount: 30000, note: 'Juan' }] },
        { id: 'f2', invoiceNo: 'FV-2', date: ayer, table: 2, total: 5000, debt: 5000, items: [{ name: 'x', price: 5000, qty: 1 }], payments: [{ method: 'debe', amount: 5000, note: 'Rosa' }] },
        { id: 'v1', invoiceNo: 'FV-3', date: new Date().toISOString(), table: null, tableName: 'Mostrador', total: 10000, debt: 0, items: [{ name: 'x', price: 10000, qty: 1 }], payments: [{ method: 'efectivo', amount: 10000 }] }];
      await saveData();
      await window.libretaEntender('Juan me pagó 30000'); await window.libretaEntender('Rosa me pagó 5000 por nequi'); await window.libretaEntender('le pagué al proveedor Agro Sur 4000'); });
    await p.waitForTimeout(400);
    const cu = await p.evaluate(() => { const C = window.ventoCuentaCaja(); return C && C.debeHaber; });
    chk('Cuadre: debe haber $36.000 (10.000 + 30.000 − 4.000; lo de Nequi no)', cu === 36000, cu);
    // Cerrar la caja contando $36.000
    await p.evaluate(() => { closeCashRegister(); });
    await p.waitForSelector('#vtTotal', { timeout: 8000 });
    const arq = await p.evaluate(() => document.getElementById('vtTotal').closest('.overlay, .modal').innerText.replace(/\s+/g, ' '));
    chk('El arqueo muestra las entradas y salidas de fuera de las ventas', /Entradas \$\s?30\.000/.test(arq) && /Salidas −\$\s?4\.000/.test(arq), arq.slice(0, 400));
    await p.fill('#vtTotal', '36000'); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('[data-si]').click()); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const c = data.closures[0]; return { esperado: c.caja && c.caja.esperado, dif: c.caja && c.caja.diferencia, z: c.z, txt: buildClosureText(c), html: buildClosureHTML(c).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }; });
    chk('Cierre: «debía haber» $36.000 y cuadra exacto', r.esperado === 36000 && r.dif === 0, r);
    chk('Resumen del cierre (WhatsApp): dice los fiados que pagaron y el pago de la libreta, y «cuadra»', /\+ \$\s?30\.000 Fiados que pagaron en efectivo/.test(r.txt) && /− \$\s?4\.000 Pagos en efectivo de la libreta/.test(r.txt) && /Debía haber: \$\s?36\.000/.test(r.txt) && /cuadra/.test(r.txt), r.txt);
    chk('Imagen del cierre: «Debía haber» $36.000', /Debía haber \$\s?36\.000/.test(r.html), r.html.slice(0, 500));
    // Cierre automático (sin contar): misma cuenta
    const auto = await p.evaluate(() => window.ventoTurno.sinContar(10000, { movs: [{ tipo: 'entrada', monto: 30000, motivo: 'a' }, { tipo: 'salida', monto: 4000, motivo: 'b' }] }).esperado);
    chk('Cierre automático (sin contar): debía haber $36.000', auto === 36000, auto);
    // Con la caja abierta no se suma nada de fuera (ya lo llevan sus entradas y salidas)
    const abierta = await p.evaluate(() => { ventoTurno.ponerTurno({ abierto_en: new Date().toISOString(), base: 50000, por: 'ana', movs: [] }); const x = window.ventoTurno.sinContar(10000, { movs: [{ tipo: 'entrada', monto: 30000 }] }).esperado; ventoTurno.ponerTurno(null); return x; });
    chk('Con la caja abierta no se suma lo de fuera (ya está en la caja)', abierta === 60000, abierta);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
