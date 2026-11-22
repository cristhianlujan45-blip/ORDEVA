// 🔊 1.99.38 · «Y continúa» (22/11): botones y campos que no decían qué hacen a quien usa el lector de pantalla del celular
// (TalkBack): solo un símbolo («✕», «−», «+», «⏭») o un campo sin nombre. Revisa que ahora tengan nombre:
//  1. Cuenta de la mesa: la ✕ de cada producto dice «Quitar de la cuenta».
//  2. Venta rápida: «Uno menos», «Cantidad», «Uno más».
//  3. Campos: nombre del negocio, categoría del producto, tipo de etiqueta y los de Contabilidad (categoría, fecha, medio de pago).
//  4. Reproductor de música: «Siguiente canción».
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'p0', name: 'Bandeja paisa', price: 28000, stock: 12 }]; data.tables[1] = { items: [{ productId: 'p0', name: 'Bandeja paisa', price: 28000, qty: 2, history: [] }], payments: [], people: [] }; await saveData(); });
    const nombre = sel => p.evaluate(sel => { const e = document.querySelector(sel); return e ? (e.getAttribute('aria-label') || '') : null; }, sel);
    // ===== 1 =====
    await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(600);
    chk('1. Cuenta de la mesa: la ✕ dice «Quitar de la cuenta»', (await nombre('#overlay .li-remove')) === 'Quitar de la cuenta', await nombre('#overlay .li-remove'));
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    // ===== 2 y 3 =====
    const n = {}; for(const [id, esperado] of [['qsQtyMinus', 'Uno menos'], ['qsQty', 'Cantidad'], ['qsQtyPlus', 'Uno más'], ['brandName', 'Nombre del negocio'], ['prodCategory', 'Categoría del producto'], ['labelTypeSelect', 'Tipo de etiqueta'], ['ctCat', 'Categoría del movimiento'], ['ctFecha', 'Fecha del movimiento'], ['ctMetodo', 'Medio de pago']]) n[id] = [await nombre('#' + id), esperado];
    const malos = Object.entries(n).filter(([, [v, e]]) => v !== e);
    chk('2–3. Venta rápida y los campos dicen qué son (9 nombres)', !malos.length, malos);
    // ===== 4 =====
    await p.evaluate(() => vitoPanel.abrir()); await p.waitForTimeout(800);
    chk('4. Reproductor de música: «Siguiente canción»', (await nombre('#ypSig')) === 'Siguiente canción', await nombre('#ypSig'));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
