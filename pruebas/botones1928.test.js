// 🎨 1.99.28 · «Continúa con lo de los colores de los botones» (pedido del dueño, 22/11). Un solo sistema de botones en la
// apariencia ORDEVA 2.0: el mismo color, borde y esquina para el mismo tipo de botón. Revisa:
//  1. «Cerrar» / «✕» (btn-close): fondo transparente, letra oscura y el mismo borde gris claro que los demás (antes: borde negro y letra gris).
//  2. «📷 Tomar foto» (btn-camera): blanco, sin degradado, con el mismo borde.
//  3. Esquinas: btn-primary, btn-ghost, btn-close, btn-camera y «Eliminar» tienen la misma esquina (12 px).
//  4. Los periodos de Inicio (Hoy · 7 días · Mes) son píldoras, como los demás periodos.
//  5. Los enlaces de las tarjetas («Contabilidad ›») no son azules.
//  6. Caja POS: el ✕ de arriba y los botones de herramientas con la misma esquina.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.waitForTimeout(500);
    chk('0. La apariencia ORDEVA 2.0 está puesta', await p.evaluate(() => document.body.classList.contains('o2')));
    // Estilo de un botón de muestra (creado dentro del cuerpo, fuera de cualquier ventana)
    const estilo = (cls, txt) => p.evaluate(([cls, txt]) => {
      const host = document.createElement('div'); host.className = 'card'; document.body.appendChild(host);
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = cls; bt.textContent = txt || 'Botón'; host.appendChild(bt);
      const s = getComputedStyle(bt); const r = { radio: s.borderTopLeftRadius, borde: s.borderTopColor, ancho: s.borderTopWidth, fondo: s.backgroundColor, img: s.backgroundImage, letra: s.color, linea: s.color };
      host.remove(); return r; }, [cls, txt]);
    const linea = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--line').trim());
    const tinta = await p.evaluate(() => { const d = document.createElement('div'); d.style.color = 'var(--ink)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    const colorLinea = await p.evaluate(() => { const d = document.createElement('div'); d.style.color = 'var(--line)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    const cerrar = await estilo('btn-close', 'Cerrar'), camara = await estilo('btn-camera', '📷 Tomar foto'), prim = await estilo('btn-primary'), fant = await estilo('btn-ghost'), elim = await estilo('btn-danger-outline', 'Eliminar');
    // ===== 1 =====
    chk('1. «Cerrar»: fondo transparente, letra oscura (no gris) y el borde gris claro de los demás (no negro)',
      /rgba\(0, 0, 0, 0\)|transparent/.test(cerrar.fondo) && cerrar.letra === tinta && cerrar.borde === colorLinea && cerrar.ancho === '1px', { cerrar, tinta, colorLinea, linea });
    // ===== 2 =====
    chk('2. «Tomar foto»: blanco, sin degradado y con el mismo borde', camara.img === 'none' && camara.borde === colorLinea && camara.letra === tinta, camara);
    chk('2. … el mismo borde que «Cerrar» y que los botones claros', camara.borde === cerrar.borde && fant.borde === cerrar.borde, { camara: camara.borde, cerrar: cerrar.borde, fant: fant.borde });
    // ===== 3 =====
    const radios = [prim, fant, cerrar, camara, elim].map(x => x.radio);
    chk('3. Botón negro, claro, «Cerrar», «Tomar foto» y «Eliminar»: la misma esquina (12 px)', radios.every(r => r === '12px'), radios);
    // ===== 4 =====
    await p.evaluate(() => document.querySelector('[data-view="inicio"]').click()); await p.waitForTimeout(700);
    const chips = await p.evaluate(() => [...document.querySelectorAll('.o2-chips button')].filter(x => x.offsetParent).map(x => getComputedStyle(x).borderTopLeftRadius));
    chk('4. Periodos de Inicio (Hoy · 7 días · Mes): píldoras, como los demás periodos', chips.length >= 3 && chips.every(r => parseFloat(r) >= 100), chips);
    // ===== 5 =====
    const enlaces = await p.evaluate(() => [...document.querySelectorAll('.o2-card h2 button')].map(x => getComputedStyle(x).color));
    const azul = c => { const m = c.match(/\d+/g); return m && +m[2] > +m[0] + 60 && +m[2] > +m[1] + 30; };
    chk('5. Los enlaces de las tarjetas («Contabilidad ›») no son azules', enlaces.length > 0 && !enlaces.some(azul), enlaces);
    // ===== 6 =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); ventoPOS.abrirCaja(); }); await p.waitForTimeout(900);
    const caja = await p.evaluate(() => [...document.querySelectorAll('#pzCajaOv .pz-caja-top > button, #pzCajaOv .pz-herr2 > button')].filter(x => x.offsetParent).map(x => ({ t: x.textContent.trim().slice(0, 14), r: getComputedStyle(x).borderTopLeftRadius, b: getComputedStyle(x).borderTopColor })));
    chk('6. Caja POS: los botones de arriba (✕ incluido) y las herramientas con la misma esquina', caja.length >= 3 && caja.every(x => x.r === '12px'), caja);
    const x = caja.find(c => /✕/.test(c.t));
    chk('6. … y el ✕ con el mismo borde claro (no negro)', x && x.b === colorLinea, { x, colorLinea });
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
