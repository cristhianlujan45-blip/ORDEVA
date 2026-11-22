// 📱 1.99.32 · «Continúa con lo siguiente de la auditoría» (22/11). Hasta la 1.99.31 todo se midió en celular (390 y 320 px).
// Medido en tableta (768 px de pie y 1024 px acostada, táctiles) y computador (1280 px, con mouse):
//  1. Cuenta de la mesa en tableta: − y + de cada producto (30 px), la ✕ (21 px), el 🕐 (24 × 17), «Enviar captura» e
//     «Imprimir recibo» (32 px) → 44 px, sin salirse.
//     En el computador con mouse siguen como estaban.
//  2. Caja POS: «Quedan 5» / «Agotado» (10 px), «TOTAL» y la ayuda de teclas (11 a 11,5 px) → 12 px.
//  3. Fecha del reloj de arriba (10,5 px), «Tu negocio, en control», el nombre del negocio del menú lateral y «unidades»
//     de la tabla de productos en el computador → 12 px. Ninguna pantalla con texto de menos de 12 px.
//  4. En tableta: flechas de los movimientos de Estadísticas (34 px) y los enlaces de la pantalla de entrar → 44 px.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const chicos = p => p.evaluate(sel => { const raiz = sel ? document.querySelector(sel) : document.body; const vis = el => { const r = el.getBoundingClientRect(); if(r.width < 1 || r.height < 1) return false; for(let e = el; e; e = e.parentElement){ const c = getComputedStyle(e); if(c.display === 'none' || c.visibility === 'hidden' || +c.opacity < .05) return false; } return true; };
    return [...raiz.querySelectorAll('*')].filter(e => !e.closest('svg') && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1) && parseFloat(getComputedStyle(e).fontSize) < 12 && parseFloat(getComputedStyle(e).fontSize) > 0 && vis(e))
      .map(e => (e.className || e.tagName) + ' ' + getComputedStyle(e).fontSize + ' «' + e.textContent.trim().slice(0, 18) + '»'); });
  try{
    for(const [ANCHO, ALTO, TACTIL] of [[768, 1024, true], [1024, 768, true], [1280, 800, false]]){
      const et = ANCHO + ' px ' + (TACTIL ? 'táctil' : 'con mouse');
      const ctx = await b.newContext({ viewport: { width: ANCHO, height: ALTO }, hasTouch: TACTIL });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(ANCHO + ': ' + e.message));
      await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
      if(TACTIL){
        const ln = await p.evaluate(() => ['authNube', 'authRestoreBtn'].map(id => { const e = document.getElementById(id); return e && e.offsetParent ? Math.round(e.getBoundingClientRect().height) : null; }));
        chk(et + ' · 4. Entrar: «Me invitaron a un negocio» y «¿Ya tenías una cuenta?» de 44 px', ln.every(h => h === null || h >= 44) && ln.some(h => h !== null), ln);
      }
      await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
        data.products = [['Bandeja paisa especial de la casa', 28000, 12], ['Cerveza Águila', 4000, 5], ['Limonada de coco', 9000, 0]].map(([n, pr, s], i) => ({ id: 'p' + i, name: n, price: pr, stock: s, cost: 1000 }));
        const H = []; for(let i = 0; i < 14; i++) H.push({ id: 'h' + i, date: new Date(Date.now() - i * 3600e3).toISOString(), table: 1 + i % 4, tableName: 'Mesa ' + (1 + i % 4), items: [{ name: 'Cerveza Águila', qty: 2, price: 4000 }], payments: [{ method: 'efectivo', amount: 8000, note: 'Pagó' }], total: 8000, debt: 0 });
        data.history = H; data.tables[1] = { items: [{ productId: 'p0', name: 'Bandeja paisa especial de la casa', price: 28000, qty: 2, history: [] }, { productId: 'p1', name: 'Cerveza Águila', price: 4000, qty: 14, history: [] }], payments: [], people: [] };
        await saveData(); try{ renderAll(); }catch(e){} });
      await p.waitForTimeout(500);
      // ===== 1 =====
      await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(800);
      const m = await p.evaluate(() => [...document.querySelectorAll('#overlay .line-item')].map(r => { const t = s => { const e = r.querySelector(s); const x = e.getBoundingClientRect(); return Math.round(Math.min(x.width, x.height)); }; const rr = r.getBoundingClientRect(); return { menos: t('.li-qty-btn'), x: t('.li-remove'), reloj: t('.li-clock'), fuera: [...r.querySelectorAll('*')].some(e => e.getBoundingClientRect().right > rr.right + 1) }; }));
      if(TACTIL) chk(et + ' · 1. Cuenta de la mesa: −, +, ✕ y 🕐 de 44 px, sin salirse del renglón', m.length === 2 && m.every(x => x.menos >= 44 && x.x >= 44 && x.reloj >= 44 && !x.fuera), m);
      if(TACTIL){ const sh = await p.evaluate(() => ['shareImageBtn', 'printReceiptBtn'].map(id => { const e = document.getElementById(id); return e && e.offsetParent ? Math.round(e.getBoundingClientRect().height) : null; }));
        chk(et + ' · 1. … y «Enviar captura por WhatsApp» / «Imprimir recibo» de 44 px', sh.every(h => h !== null && h >= 44), sh); }
      else chk(et + ' · 1. Cuenta de la mesa con mouse: sigue como estaba (− y + de 30 px) y sin salirse', m.length === 2 && m.every(x => x.menos === 30 && !x.fuera), m);
      // ===== 2 =====
      await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); ventoPOS.abrirCaja(); }); await p.waitForTimeout(1100);
      const cp = await chicos(p);
      chk(et + ' · 2. Caja POS: ningún texto de menos de 12 px («Quedan 5», «Agotado», «TOTAL», teclas)', !cp.length && await p.evaluate(() => [...document.querySelectorAll('#pzCajaOv .pz-stock')].filter(e => e.offsetParent).length >= 2), cp.slice(0, 6));
      await p.evaluate(() => ventoPOS.cerrarCaja());
      // ===== 3 =====
      const malas = {};
      for(const v of ['inicio', 'mesas', 'productos', 'estadisticas', 'contabilidad', 'historial', 'musica', 'ajustes']){
        await p.evaluate(v => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b = document.querySelector('[data-view="' + v + '"]'); b && b.click(); }, v); await p.waitForTimeout(900);
        const c = (await chicos(p)).filter(x => !/^voice-fab|nav/.test(x)); if(c.length) malas[v] = c.slice(0, 4);
      }
      chk(et + ' · 3. Ninguna pantalla con texto de menos de 12 px (reloj, menú lateral, tabla de productos…)', !Object.keys(malas).length, malas);
      // ===== 4 =====
      if(TACTIL){
        await p.evaluate(() => document.querySelector('[data-view="estadisticas"]').click()); await p.waitForTimeout(1200);
        const fl = await p.evaluate(() => [...document.querySelectorAll('#tableroVento .tb-flecha')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().width)));
        chk(et + ' · 4. Estadísticas: flechas de los movimientos de 44 px', fl.length >= 1 && fl.every(w => w >= 44), fl);
      }
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
