// ✏️ ORDEVA 1.99.95 · Nombres que «aparecen solos» en las cuentas.
// Caso real (Xiaomi del dueño): la cuenta 4 quedó llamándose «P una buscamos un abogado que se mueve l» (40 letras, el
// tope de la casilla «¿A nombre de quién?») y la 5 «Ño». El dictado por voz del teclado oyó la radio/TV y al salir de la
// casilla se guardó solo. Ahora:
//  1. Una frase (más de 4 palabras) que llega solo al salir de la casilla PREGUNTA antes de guardarse; con «No» la
//     cuenta queda como estaba.
//  2. Un pedazo de menos de 3 letras («Ño») también pregunta; con «Sí, ponerlo» sí se guarda.
//  3. Un nombre normal («Ana Pérez») al salir de la casilla se guarda directo, sin preguntar (como siempre).
//  4. Con el botón «Guardar» o Enter se guarda directo aunque sea largo (lo pidió la persona).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento_vista_sencilla', '0'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(2000);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'agropecuaria'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Agro Nombres'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(500);
    const abrir = async id => { await p.evaluate(id => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.modoCompleto = true; try{ aplicarModulos(); }catch(e){}
      data.products = [{ id: 'ar', name: 'Arroz', price: 3500, stock: 50 }];
      if(!data.tables[id]) data.tables[id] = { items: [], people: [], payments: [] };
      data.tables[id].items = [{ productId: 'ar', name: 'Arroz', price: 3500, qty: 7, personId: null, history: [] }];
      saveData(); renderMesas(); openTableModal(id); }, id);
      await p.waitForTimeout(300); await p.click('#clienteToggle'); await p.waitForTimeout(200); };
    const salir = async () => { await p.evaluate(() => { const i = document.getElementById('clienteNombre'); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); }); await p.waitForTimeout(300); };
    const pregunta = () => p.evaluate(() => { const o = document.getElementById('confirmOverlay'); return { abierta: o.classList.contains('show'), t: document.getElementById('confirmTitle').textContent }; });
    // ===== 1 =====
    await abrir(4);
    await p.fill('#clienteNombre', 'P una buscamos un abogado que se mueve l'); await salir();
    let q = await pregunta();
    chk('1. Una frase que llega al salir de la casilla pregunta antes de guardarse', q.abierta && /nombre a la cuenta/.test(q.t), q);
    chk('1. … y mientras pregunta, la cuenta no ha cambiado', await p.evaluate(() => !data.tables[4].name));
    await p.click('#confirmCancelBtn'); await p.waitForTimeout(300);
    let v = await p.evaluate(() => ({ n: data.tables[4].name || null, campo: document.getElementById('clienteNombre').value, items: data.tables[4].items.length }));
    chk('1. Con «No» la cuenta queda como estaba (sin nombre, con sus productos) y la casilla se limpia', v.n === null && v.campo === '' && v.items === 1, v);
    // ===== 2 =====
    await abrir(5);
    await p.fill('#clienteNombre', 'Ño'); await salir();
    q = await pregunta();
    chk('2. «Ño» (menos de 3 letras) también pregunta', q.abierta, q);
    await p.click('#confirmOkBtn'); await p.waitForTimeout(300);
    chk('2. Con «Sí, ponerlo» sí se guarda', await p.evaluate(() => data.tables[5].name === 'Ño'));
    // ===== 3 =====
    await abrir(6);
    await p.fill('#clienteNombre', 'Ana Pérez'); await salir();
    q = await pregunta();
    v = await p.evaluate(() => ({ n: data.tables[6].name, titulo: document.getElementById('modalTitle').textContent }));
    chk('3. «Ana Pérez» al salir de la casilla se guarda directo, sin preguntar', !q.abierta && v.n === 'Ana Pérez' && v.titulo === 'Ana Pérez', { q, v });
    // ===== 4 =====
    await abrir(7);
    await p.fill('#clienteNombre', 'Don Pedro el de la finca grande'); await p.click('#clienteGuardar'); await p.waitForTimeout(300);
    q = await pregunta();
    chk('4. Con el botón «Guardar» se guarda directo aunque sea largo', !q.abierta && await p.evaluate(() => data.tables[7].name === 'Don Pedro el de la finca grande'), q);
    await abrir(8);
    await p.fill('#clienteNombre', 'Do'); await p.press('#clienteNombre', 'Enter'); await p.waitForTimeout(300);
    q = await pregunta();
    chk('4. Con Enter también se guarda directo («Do»)', !q.abierta && await p.evaluate(() => data.tables[8].name === 'Do'), q);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ Error: ' + e.message); }
  chk('Sin errores de página', errs.length === 0, errs);
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
