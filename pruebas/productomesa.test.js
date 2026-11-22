// 📦 1.99.27 · «Que los productos nuevos que uno agrega en la mesa también queden inventariados de una vez» (pedido del
// dueño, 22/11). El producto nuevo que se crea desde la mesa («📷 … no está — tómale una foto para agregarlo») quedaba SIN
// control de inventario (stock vacío). Revisa:
//  1. Con «¿Cuántas tienes?» = 24: queda en el inventario con 24 y, al ir a la mesa, baja a 23.
//  2. Sin escribir la cantidad: queda en el inventario con 0 (para ponerle la cantidad), no sin inventario.
//  3. Un producto que ya existía SIN inventario: con la cantidad escrita, queda inventariado.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.waitForTimeout(500);
    const crear = async (nombre, precio, cantidad) => {
      await p.evaluate(() => { data.tables[1] = data.tables[1] || { items: [], people: [] }; currentTable = 1; window.showToast = t => { (window.__toasts = window.__toasts || []).push(t); }; });
      await p.evaluate(n => openQuickProductOverlay(n), nombre);
      await p.fill('#qpPrice', String(precio));
      if(cantidad != null) await p.fill('#qpStock', String(cantidad));
      await p.click('#qpAddBtn'); await p.waitForTimeout(500);
      return p.evaluate(n => { const pr = data.products.find(x => x.name === n); return pr ? { stock: pr.stock, estado: invStatus(pr), enMesa: (data.tables[1].items || []).some(i => i.productId === pr.id) } : null; }, nombre);
    };
    // ===== 1 =====
    const r1 = await crear('Galleta Prueba Mesa', 2500, 24);
    chk('1. Con «¿Cuántas tienes?» = 24: queda en el inventario y, al ir a la mesa, baja a 23', r1 && r1.stock === 23 && r1.estado !== 'none' && r1.enMesa, r1);
    // ===== 2 =====
    const r2 = await crear('Chicle Prueba Mesa', 500, null);
    chk('2. Sin escribir la cantidad: queda EN el inventario (con 0, para ponerle la cantidad), no sin control', r2 && r2.stock === 0 && r2.estado !== 'none' && r2.enMesa, r2);
    chk('2. … y avisa que escriba cuántas tiene', await p.evaluate(() => (window.__toasts || []).some(t => /quedó en el inventario/.test(t) && /cuántas tienes/.test(t))), await p.evaluate(() => window.__toasts));
    // ===== 3 =====
    await p.evaluate(() => { data.products.push({ id: 'viejo1', name: 'Mani Prueba Mesa', price: 1000, categoryId: null, size: '', stock: null }); saveData(); });
    const r3 = await crear('Mani Prueba Mesa', 1000, 10);
    chk('3. Un producto que ya existía sin inventario: con la cantidad escrita queda inventariado (10, y 9 al ir a la mesa)', r3 && r3.stock === 9 && r3.enMesa, r3);
    chk('3. … sin duplicar el producto', await p.evaluate(() => data.products.filter(x => x.name === 'Mani Prueba Mesa').length === 1));
    // Vuelve a abrir el formulario: el campo de la cantidad empieza vacío
    await p.evaluate(() => openQuickProductOverlay('Otro'));
    chk('El formulario vuelve a abrir con «¿Cuántas tienes?» vacío', await p.evaluate(() => document.getElementById('qpStock').value === ''));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
