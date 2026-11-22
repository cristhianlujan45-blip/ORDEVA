// 🔎 1.99.31 · «Continúa con lo siguiente de la auditoría» (pedido del dueño, 22/11). Nueva medición de diseño después de
// la 1.99.30. Lo real que quedaba (lo demás eran falsos avisos: textos escondidos o en listas que se desplazan de lado):
//  1. El ojo «Ver la contraseña» de la pantalla de entrar medía 35 × 31 px → 44 × 44, dentro del campo.
//  2. El número de la cantidad en la cuenta de la mesa (entre − y +) medía 20 px de alto → 40.
//  3. Contabilidad: los textos grises de la tarjeta «Te quedó» / «Resultado» quedaban justo en el límite de contraste → 4,5 : 1 o más.
//  4. Las teclas «Enter» / «Esc» de la ayuda al cobrar con teclado: 12 px.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
    // ===== 1. Pantalla de entrar =====
    const ojo = await p.evaluate(() => { const i = document.getElementById('authPass'); const w = i && i.parentElement; const o = w && w.querySelector('.ojo-clave, .pw-ojo'); if(!o) return null;
      const r = o.getBoundingClientRect(), ri = i.getBoundingClientRect(); return { w: r.width, h: r.height, dentro: r.right <= ri.right + 0.5 && r.left >= ri.left, centroY: Math.abs((r.top + r.bottom) / 2 - (ri.top + ri.bottom) / 2) }; });
    chk('1. El ojo «Ver la contraseña» se toca en 44 × 44 y queda dentro del campo', ojo && ojo.w >= 44 && ojo.h >= 44 && ojo.dentro && ojo.centroY < 2, ojo);
    await p.fill('#authPass', 'clave123'); await p.click('#authPass + .ojo-clave, .pw-wrap .pw-ojo, #authPass ~ button').catch(() => p.evaluate(() => document.getElementById('authPass').parentElement.querySelector('button').click()));
    chk('1. … y sigue mostrando la contraseña al tocarlo', await p.evaluate(() => document.getElementById('authPass').type === 'text'));
    // ===== 2. Cantidad en la cuenta de la mesa =====
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'p0', name: 'Bandeja paisa', price: 28000, stock: 10 }]; data.tables[1] = { items: [], payments: [], people: [] }; await saveData(); openTableModal(1); });
    await p.waitForTimeout(700);
    const q = await p.evaluate(() => { const i = document.getElementById('addQty'), m = document.getElementById('qtyMinusBtn'); const r = i.getBoundingClientRect(), rm = m.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), btn: Math.round(rm.height) }; });
    chk('2. El número de la cantidad mide 40 px de alto, como los botones − y +', q.h >= 40 && q.btn >= 40, q);
    // ===== 3. Contabilidad =====
    await p.evaluate(async () => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.history = [{ id: 'h1', date: new Date().toISOString(), table: 1, items: [{ name: 'X', qty: 1, price: 50000 }], payments: [{ method: 'efectivo', amount: 50000 }], total: 50000, debt: 0 }]; await saveData();
      document.querySelector('[data-view="contabilidad"]').click(); });
    await p.waitForTimeout(1200);
    const ct = await p.evaluate(() => { const lin = c => { const m = c.match(/[\d.]+/g).map(Number); const f = m.length >= 3 && /color\(/.test(c) ? m.slice(0, 3).map(x => x * 255) : m.slice(0, 3); return f.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); };
      const L = c => { const [r, g, b] = lin(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      return [...document.querySelectorAll('.ct-kpi.res small, .ct-kpi.res span')].filter(e => e.getBoundingClientRect().width && e.textContent.trim()).map(e => { let bg = null; for(let x = e; x; x = x.parentElement){ const c = getComputedStyle(x).backgroundColor; if(c !== 'rgba(0, 0, 0, 0)'){ bg = c; break; } }
        const a = L(getComputedStyle(e).color), z = L(bg); return { t: e.textContent.trim().slice(0, 24), ratio: +((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)).toFixed(2) }; }); });
    chk('3. Contabilidad › «Te quedó» / «Resultado»: los textos grises con contraste de 4,5 : 1 o más', ct.length > 0 && ct.every(x => x.ratio >= 4.5), ct);
    // ===== 4. Teclas de la ayuda al cobrar =====
    const kbd = await p.evaluate(() => { const d = document.createElement('div'); d.className = 'pz-kb-ayuda'; d.innerHTML = '<kbd>Enter</kbd> <kbd>Esc</kbd>'; document.body.appendChild(d); const f = [...d.querySelectorAll('kbd')].map(k => parseFloat(getComputedStyle(k).fontSize)); d.remove(); return f; });
    chk('4. Las teclas «Enter» / «Esc» de la ayuda al cobrar: 12 px', kbd.length === 2 && kbd.every(f => f >= 12), kbd);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
