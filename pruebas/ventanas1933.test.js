// 🪟 1.99.33 · «Continúa con lo siguiente de la auditoría» (22/11). Recorrido automático por las ventanas que se abren
// encima (tocando cada botón de cada pantalla). En el celular (táctil) quedaban botones y campos de 26 a 39 px. Revisa que
// ahora midan 44 px:
//  1. Venta rápida: − y + (30), buscador, cantidad y «Agregar» (37–39).
//  2. Escanear código: la ✕ de cerrar (26).
//  3. Exportar ventas: Hoy · Ayer · Este mes · Rango · Por cierre (32).
//  4. Reproductor de música: Cerrar (38), pestañas (37), «Siguiente» (38), géneros (32) y «Ver todas →» (28).
//  5. Buscadores de Facturas anteriores e Historial de música (39), y el 👁 de las mesas en la Caja POS (33 de ancho).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'p0', name: 'Bandeja paisa', price: 28000, stock: 12 }, { id: 'p1', name: 'Cerveza Águila', price: 4000, stock: 5 }];
      data.tables[1] = { items: [{ productId: 'p0', name: 'Bandeja paisa', price: 28000, qty: 1, history: [] }], payments: [], people: [] }; await saveData(); try{ renderAll(); }catch(e){} });
    const cerrar = () => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const medir = sels => p.evaluate(sels => sels.map(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent || getComputedStyle(e).position === 'fixed').map(e => { const r = e.getBoundingClientRect(); return { s, t: (e.textContent || e.placeholder || e.id).trim().slice(0, 14), w: Math.round(r.width), h: Math.round(r.height) }; })).flat(), sels);
    const todos44 = (L, minAncho) => L.length > 0 && L.every(x => x.h >= 44 && (!minAncho || x.w >= 44));
    // ===== 1 =====
    await p.evaluate(() => qsOpen()); await p.waitForTimeout(600);
    const qs = await medir(['#qsSearch', '#qsQty', '#qsAddBtn']), qsb = await medir(['#qsQtyMinus', '#qsQtyPlus']);
    chk('1. Venta rápida: buscador, cantidad y «Agregar» de 44 px', todos44(qs) && qs.length === 3, qs);
    chk('1. … y − / + de 44 × 44', todos44(qsb, true) && qsb.length === 2, qsb);
    await cerrar();
    // ===== 2 =====
    await p.evaluate(() => document.getElementById('scanOverlay').classList.add('show')); await p.waitForTimeout(300);
    const sc = await medir(['#scanCloseBtn']);
    chk('2. Escanear código: la ✕ de cerrar de 44 × 44 (antes 26)', todos44(sc, true), sc);
    await cerrar();
    // ===== 3 =====
    await p.evaluate(() => exportOverlayShow()); await p.waitForTimeout(400);
    const ex = await medir(['#exportOverlay [data-per]']);
    chk('3. Exportar ventas: Hoy · Ayer · Este mes · Rango · Por cierre de 44 px', todos44(ex) && ex.length === 5, ex);
    await cerrar();
    // ===== 4 =====
    await p.evaluate(() => vitoPanel.abrir()); await p.waitForTimeout(900);
    const yp = await medir(['#ypCerrar', '.yp-nav > button', '.yp-chip', '.yp-vermas']);
    const ypx = yp.filter(x => x.s === '#ypCerrar');
    chk('4. Reproductor de música: Cerrar, pestañas, géneros y «Ver todas →» de 44 px', todos44(yp) && ypx.length === 1 && ypx[0].w >= 44 && yp.some(x => x.s === '.yp-chip'), yp.filter(x => x.h < 44 || x.s === '#ypCerrar'));
    const sig = await p.evaluate(() => { const e = document.getElementById('ypSig'); if(!e) return 'no hay'; e.hidden = false; e.style.display = ''; const r = e.getBoundingClientRect(); return r.width ? { w: Math.round(r.width), h: Math.round(r.height) } : 'escondido'; });
    chk('4. … y «⏭ Siguiente» de 44 × 44', typeof sig === 'string' ? sig === 'escondido' : sig.w >= 44 && sig.h >= 44, sig);
    await p.evaluate(() => { try{ vitoPanel.cerrar(); }catch(e){} }); await cerrar();
    // ===== 5 =====
    const bus = await p.evaluate(() => ['mzHistQ', 'fi-hbus'].map(k => { const e = document.createElement('input'); e.type = 'search'; if(k === 'mzHistQ') e.id = k; else e.className = k; e.style.cssText = k === 'mzHistQ' ? 'width:100%;margin:6px 0' : ''; const box = document.createElement('div'); box.className = 'overlay show'; box.appendChild(e); document.body.appendChild(box); const h = Math.round(e.getBoundingClientRect().height); box.remove(); return h; }));
    chk('5. Buscadores de Historial de música y Facturas anteriores de 44 px', bus.every(h => h >= 44), bus);
    await p.evaluate(() => ventoPOS.abrirCaja()); await p.waitForTimeout(1000);
    const ojo = await medir(['.pz-mesa-v']);
    chk('5. Caja POS: el 👁 de las mesas por cobrar de 44 px de ancho', ojo.length >= 1 && ojo.every(x => x.w >= 44), ojo);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
