// 🌗 ORDEVA 1.70.1 · Lo que se escribe SIEMPRE se ve, en todos los diseños (claros, oscuros y de fecha). Sin internet.
// Reporte del dueño: «cuando voy a poner el nombre o escribir un texto, no se ve el texto» (Renombrar mesa con un diseño
// oscuro: el campo tenía fondo blanco fijo y la letra del diseño, clara). Revisa el contraste (WCAG ≥ 3) de TODOS los
// campos y listas de la app, también los de las ventanas que se crean al usar la caja (cobro, pago mixto, fiado, abrir
// caja) y la ficha del producto.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1100);
    await p.fill('#authBiz', 'Tienda Contraste'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1400);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const r = await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      try{ data.products = [{ id: 'a', name: 'Águila', price: 3500 }]; saveData(); window.ventoPOS.abrirCaja(); window.ventoPOS.agregar('a'); window.ventoPOS.cobrar(); }catch(e){}
      try{ window.ventoTurno.panel(); }catch(e){}
      try{ document.getElementById('renameOverlay').classList.add('show'); }catch(e){}
      try{ openEditProductModal('a'); }catch(e){}
      try{ document.querySelector('.pz-pago-ov .pz-mixto-btn').click(); document.querySelector('.pz-pago-ov .pz-fiado').click(); }catch(e){}
      const rgb = s => { const m = String(s).match(/[\d.]+/g); return m ? m.map(Number) : null; };
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const fondo = el => { for(let e = el; e; e = e.parentElement){ const c = rgb(getComputedStyle(e).backgroundColor); if(c && (c.length < 4 || c[3] > 0.5)) return c; } return [255, 255, 255]; };
      const out = {}; let campos = 0;
      Object.keys(PALETTES).forEach(k => {
        try{ document.body.classList.toggle('o2', k === 'ordeva2'); data.theme = k; applyPalette(k); }catch(e){ out[k] = ['error ' + e.message]; return; }
        const malos = [];
        document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=hidden]), select, textarea').forEach(el => {
          const cs = getComputedStyle(el), c = rgb(cs.color), bg = rgb(cs.backgroundColor);
          const q = ratio(c, bg && (bg.length < 4 || bg[3] > 0.5) ? bg : fondo(el.parentElement));
          if(q < 3) malos.push((el.id || el.className || el.tagName) + ' ' + q.toFixed(1));
        });
        campos = Math.max(campos, document.querySelectorAll('input, select, textarea').length);
        out[k] = malos;
      });
      return { out, campos, renombrar: !!document.getElementById('renameTableInput'), editar: !!document.querySelector('#editProdName'), cobro: !!document.querySelector('.pz-pago-ov #pzPagaCon') };
    });
    chk('Se revisan los campos de la app y de las ventanas de la caja (' + r.campos + ' campos)', r.campos > 100 && r.renombrar && r.editar && r.cobro, r);
    for(const k of Object.keys(r.out)) chk('Diseño «' + k + '»: todo lo escrito se ve (contraste ≥ 3)', !r.out[k].length, r.out[k]);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
