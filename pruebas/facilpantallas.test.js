// 🧓 Modo fácil en todo tipo de pantalla: celulares de 320 a 412 px, celular acostado, tablet vertical y acostada, y
// computador. En cada una y en cada pantalla (mesas, vender, hoy, más): nada se sale por los lados, los botones de abajo
// se ven completos, ningún botón es más chico que un dedo (40 px), el nombre del negocio no queda tapado por «Ayúdame»
// y, con la pantalla acostada, los productos quedan AL LADO de la cuenta (antes, en el celular acostado, la cuenta los
// tapaba). Parado (celular o tablet), los productos van arriba y la cuenta queda fija abajo.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
const VPS = [['celular 320', 320, 568], ['celular 360', 360, 640], ['celular 390', 390, 844], ['celular 412', 412, 915], ['celular acostado', 844, 390], ['tablet vertical', 768, 1024], ['tablet acostada', 1180, 820], ['computador', 1366, 768]];
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    for(const [n, w, h] of VPS){
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 1300 });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message));
      await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(2000);
      await p.evaluate(async () => { await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
        document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
        data.businessName = 'Cervecería La Esquina del Barrio';
        data.products = Array.from({ length: 14 }, (_, i) => ({ id: 'p' + i, name: ['Águila', 'Empanada con carne', 'Gaseosa Postobón 400', 'Pony Malta', 'Arepa con queso', 'Tinto', 'Agua Cristal', 'Pandebono', 'Cerveza Club Colombia Dorada', 'Papas', 'Chocorramo', 'Jugo de mora', 'Buñuelo', 'Café'][i], price: 1000 + i * 700 }));
        data.tables = {}; for(let k = 1; k <= 12; k++) data.tables[k] = { items: [], people: [], payments: [] };
        data.tableCount = 12; data.history = []; data.easyMode = false; delete data.modoOperacion; await saveData(); renderAll();
        const c = document.getElementById('easyModeToggle'); c.checked = true; c.dispatchEvent(new Event('change')); });
      await p.waitForTimeout(500);
      await p.evaluate(() => document.querySelectorAll('.toast, #toast').forEach(t => t.remove()));
      const medir = () => p.evaluate(() => {
        const W = innerWidth, H = innerHeight, vis = e => e.checkVisibility && e.checkVisibility();
        const fuera = [...document.querySelectorAll('#facilApp *')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && (r.right > W + 1 || r.left < -1); }).map(e => e.className || e.tagName).slice(0, 4);
        const chicos = [...document.querySelectorAll('#facilApp button')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).map(e => e.textContent.trim().slice(0, 16)).slice(0, 4);
        const nav = document.querySelector('#facilApp .fz-nav').getBoundingClientRect(), ay = document.querySelector('#facilApp .fz-ayuda').getBoundingClientRect(), tit = document.querySelector('#facilApp .fz-tit').getBoundingClientRect();
        return { scroll: document.documentElement.scrollWidth > W + 1, fuera, chicos, nav: nav.top >= 0 && nav.bottom <= H + 1, tapado: tit.right > ay.left + 1 };
      });
      const pantallas = {};
      pantallas.mesas = await medir();
      await p.evaluate(() => [...document.querySelectorAll('#facilApp .fz-nav button')][0].click()); await p.waitForTimeout(200);
      await p.evaluate(() => { const m = document.querySelector('#facilApp [data-mesa], #facilApp .fz-mesa'); m && m.click(); }); await p.waitForTimeout(300);
      pantallas.vender = await medir();
      const lado = await p.evaluate(() => { const a = document.querySelector('#facilApp .pz-prod'), c = document.querySelector('#facilApp .pz-cart'); if(!a || !c) return null; const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect(); return { alLado: rc.left >= ra.right - 1, prodArriba: ra.top < innerHeight * 0.6 }; });
      await p.evaluate(() => [...document.querySelectorAll('#facilApp .fz-nav button')][1].click()); await p.waitForTimeout(200);
      pantallas.hoy = await medir();
      await p.evaluate(() => [...document.querySelectorAll('#facilApp .fz-nav button')][2].click()); await p.waitForTimeout(200);
      pantallas.mas = await medir();
      const L = Object.entries(pantallas);
      chk(n + ': nada se sale por los lados (mesas, vender, hoy, más)', L.every(([, m]) => !m.scroll && !m.fuera.length), L.filter(([, m]) => m.scroll || m.fuera.length));
      chk(n + ': los botones de abajo se ven completos y ningún botón es más chico que un dedo', L.every(([, m]) => m.nav && !m.chicos.length), L.filter(([, m]) => !m.nav || m.chicos.length));
      chk(n + ': el nombre del negocio no queda tapado por «Ayúdame»', L.every(([, m]) => !m.tapado));
      if(w >= 560 && w > h) chk(n + ': al vender (pantalla acostada), los productos quedan al lado de la cuenta', lado && lado.alLado && lado.prodArriba, lado);
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
