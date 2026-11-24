// ⚡ 1.99.59 · «Venta rápida» (mostrador) mostraba siempre los datos del domicilio (cliente, teléfono, dirección y envío):
// el display:flex de la etiqueta le ganaba a «hidden» (desde la 1.95.0). Revisa también que con dos productos del mismo
// nombre la búsqueda muestre el tamaño de cada uno y que se venda el que se escogió.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {}; window.showConfirm = async () => true;
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, stock: 10 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, stock: 10 }]; data.history = []; await saveData(); });
    const vis = () => p.evaluate(() => { const el = document.getElementById('qsDomicilioFields'); return !!el.getClientRects().length && getComputedStyle(el).display !== 'none'; });
    await p.evaluate(() => qsOpen('mostrador')); await p.waitForTimeout(200);
    chk('Venta rápida (mostrador): NO muestra cliente, teléfono, dirección ni envío', !(await vis()));
    await p.evaluate(() => document.getElementById('quickSaleOverlay') && document.getElementById('quickSaleOverlay').classList.remove('show'));
    await p.evaluate(() => qsOpen('domicilio')); await p.waitForTimeout(200);
    chk('Domicilio: sí los muestra', await vis());
    await p.evaluate(() => qsOpen('mostrador')); await p.waitForTimeout(200);
    await p.fill('#qsSearch', 'purina'); await p.waitForTimeout(300);
    const sug = await p.evaluate(() => [...document.querySelectorAll('#qsSuggestions > *')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    chk('La búsqueda muestra las dos Purina con su tamaño', sug.length >= 2 && sug.some(x => /1 kg/.test(x)) && sug.some(x => /5 kg/.test(x)), sug);
    const i5 = sug.findIndex(x => /5 kg/.test(x));
    if(i5 >= 0){
      await p.evaluate(i => document.querySelectorAll('#qsSuggestions > *')[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) || document.querySelectorAll('#qsSuggestions > *')[i].click(), i5);
      await p.evaluate(i => { const x = document.querySelectorAll('#qsSuggestions > *')[i]; if(x) x.click(); }, i5);
      await p.waitForTimeout(200);
      const pid = await p.evaluate(() => document.getElementById('qsProductId').value);
      chk('Al escoger «Purina 5 kg» queda ese producto', pid === 'pa5', pid);
    }
    // El mismo error en otras dos ventanas
    const ex = await p.evaluate(async () => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const v = id => { const el = document.getElementById(id); return !!el.getClientRects().length && getComputedStyle(el).display !== 'none'; };
      exportOverlayShow(); const r = { inicio: [v('exportRangeFields'), v('exportClosureFields')] };
      document.querySelector('#exportPeriodBtns button[data-per="rango"]').click(); r.rango = [v('exportRangeFields'), v('exportClosureFields')];
      const bc = document.querySelector('#exportPeriodBtns button[data-per="cierre"]'); if(bc){ bc.click(); r.cierre = [v('exportRangeFields'), v('exportClosureFields')]; }
      exportOverlayClose();
      try{ window.ventoReportarProblema(); }catch(e){} await new Promise(r2 => setTimeout(r2, 300));
      const bx = document.getElementById('vcRepAutoBox'); r.rep = bx ? v('vcRepAutoBox') : 'sin-caja';
      return r; });
    chk('Exportar: al abrir no salen los campos de rango ni de cierre', JSON.stringify(ex.inicio) === '[false,false]', ex);
    chk('Exportar: «Rango» muestra solo las fechas', JSON.stringify(ex.rango) === '[true,false]', ex);
    if(ex.cierre) chk('Exportar: «Cierre» muestra solo los cierres', JSON.stringify(ex.cierre) === '[false,true]', ex);
    chk('Reportar un problema: sin captura no sale el recuadro vacío', ex.rep === false || ex.rep === 'sin-caja', ex);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
