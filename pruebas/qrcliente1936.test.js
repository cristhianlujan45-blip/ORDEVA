// 📲 1.99.36 · «Continúa con la siguiente auditoría» (22/11). La página del QR (pedido.html) que usan los clientes en sus
// celulares (de todos los tamaños y letras). Revisa en 412, 360 y 320 px, sin y con «Letra grande»:
//  1. Las pestañas «Pedido · Canción · Mi cuenta» no se cortan (antes «Mi cue…» desde 412 px y, con «Letra grande»,
//     «Pe… Ca… Mi …»).
//  2. Idioma, moneda y «Letra grande» de 44 px (antes 37–39).
//  3. Carta: categorías y «Cerrar» de 44 px (36 y 40), el «+» de cada plato se toca en 44 × 44 (32), detalles en 12 px (11,5).
//  4. Tu pedido: − / + (38) y la ✕ para quitar (34) de 44 px.
// No depende de la letra (revisa que el texto quepa), así que en GitHub revisa con la letra ancha.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const C = 'PRUEBAqrCLIENTE36';
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/pedido.html?mesa=4&c=' + C;
const CARTA = { y: 'restaurante', t: 'Menú', n: 'Restaurante La Esquina de Doña Rosa', p: [
  ['Bandeja paisa especial de la casa', 28000, 'Platos fuertes', 0, 0, 'Frijoles, arroz, chicharrón, huevo, carne molida, maduro y arepa'],
  ['Sancocho de gallina', 22000, 'Platos fuertes', 0, 0, 'Con arroz y aguacate'], ['Empanada', 2500, 'Entradas', 0, 0, ''], ['Cerveza Águila', 4000, 'Bebidas', 0, 0, ''] ] };
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    for(const [w, grande] of [[412, false], [360, false], [320, false], [360, true], [320, true]]){
      const et = w + ' px' + (grande ? ' con «Letra grande»' : '');
      const ctx = await b.newContext({ viewport: { width: w, height: 760 }, isMobile: true, hasTouch: true, locale: 'es-CO' });
      await ctx.route('**/*', r => { const u = r.request().url();
        if(/rpc\/canal_leer/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        if(/rpc\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"1","time":1,"event":"message"}' });
        return new URL(u).hostname === 'localhost' ? r.continue() : r.abort(); });
      await ctx.addInitScript(([c, carta]) => { try{ localStorage.setItem('cat_' + c, JSON.stringify(carta)); }catch(e){} }, [C, CARTA]);
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(et + ': ' + e.message));
      await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
      if(grande){ await p.evaluate(() => document.getElementById('easyBtn').click()); await p.waitForTimeout(400); }
      // ===== 1 =====
      const tabs = await p.evaluate(() => [...document.querySelectorAll('.tabs .t:not([hidden]) span')].filter(s => s.getBoundingClientRect().width).map(s => ({ t: s.textContent.trim(), sw: s.scrollWidth, cw: s.clientWidth, sh: s.scrollHeight, ch: s.clientHeight })));
      chk(et + ' · 1. Pestañas «Pedido · Canción · Mi cuenta» sin cortarse', tabs.length >= 3 && tabs.every(x => x.sw <= x.cw + 1 && x.sh <= x.ch + 1), tabs);
      // (con zoom de «Letra grande» los tamaños medidos ya vienen aumentados)
      const alto = sel => p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width).map(e => ({ t: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 18), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })), sel);
      if(!grande){
        // ===== 2 =====
        const top = await alto('#lang, #curr, #easyBtn');
        chk(et + ' · 2. Idioma, moneda y «Letra grande» de 44 px', top.length === 3 && top.every(x => x.h >= 44), top);
      }
      // ===== 3 =====
      await p.evaluate(() => document.getElementById('catBtn').click()); await p.waitForTimeout(600);
      const cats = await alto('.cat-tab, .carta .x');
      chk(et + ' · 3. Carta: categorías y «Cerrar» de 44 px', cats.length >= 3 && cats.every(x => x.h >= 44), cats.filter(x => x.h < 44));
      const mas = await p.evaluate(() => [...document.querySelectorAll('.pcard .padd')].filter(e => e.getBoundingClientRect().width).slice(0, 2).map(e => { const r = e.getBoundingClientRect();
        const toca = (x, y) => { const t = document.elementFromPoint(x, y); return t === e || e.contains(t); };
        return { w: Math.round(r.width), toca: toca(r.left - 1.5, r.top - 1.5) && toca(r.right + 1.5, r.bottom + 1.5) && toca(r.left + r.width / 2, r.top + r.height / 2) }; }));
      chk(et + ' · 3. El «+» de cada plato se toca en 44 × 44', mas.length === 2 && mas.every(x => x.toca && x.w >= 40), mas);
      const det = await p.evaluate(() => [...document.querySelectorAll('.pcard .pdet')].filter(e => e.getBoundingClientRect().width).map(e => parseFloat(getComputedStyle(e).fontSize)));
      chk(et + ' · 3. Los detalles del plato en 12 px o más', det.length >= 1 && det.every(f => f >= 12), det);
      // ===== 4 =====
      await p.evaluate(() => [...document.querySelectorAll('.pcard .padd')].slice(0, 2).forEach(b => b.click())); await p.waitForTimeout(400);
      await p.evaluate(() => { const c = document.querySelector('.carta .x'); c && c.click(); }); await p.waitForTimeout(500);
      const ped = await alto('#lines .step button, #lines .ln > .x');
      chk(et + ' · 4. Tu pedido: − / + y la ✕ de 44 px', ped.length >= 6 && ped.every(x => x.w >= 44 && x.h >= 44), ped.filter(x => x.w < 44 || x.h < 44).concat([{ n: ped.length }]));
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
