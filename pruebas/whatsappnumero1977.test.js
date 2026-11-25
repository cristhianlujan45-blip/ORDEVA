// 📲 1.99.77 · El WhatsApp de respaldo de los pedidos por QR / domicilio web: si se escribió el celular sin el 57
// (3001234567), wa.me no abría el chat del negocio. Revisa:
//  1. El botón de domicilio por WhatsApp (domWaUrl) agrega el 57 a un celular de 10 dígitos.
//  2. Si ya trae el 57, no lo repite.
//  3. pedido.html con &w=3001234567: el «enviar por WhatsApp» va a 573001234567.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const B = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(B + '/index.html'); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const url = await p.evaluate(() => { const real = window.vitoQCfg; window.vitoQCfg = () => Object.assign({}, real ? real() : {}, { url: location.origin + '/pedido.html', topic: 'abc', wa: '3001234567' }); const u = domWaUrl(); window.vitoQCfg = real; return u; });
    chk('1. domicilio por WhatsApp con 57', /^https:\/\/wa\.me\/573001234567\?text=/.test(url), url);
    const url2 = await p.evaluate(() => { const real = window.vitoQCfg; window.vitoQCfg = () => ({ url: location.origin + '/pedido.html', topic: 'abc', wa: '573001234567' }); const u = domWaUrl(); window.vitoQCfg = real; return u; });
    chk('2. ya con 57 no se repite', /^https:\/\/wa\.me\/573001234567\?text=/.test(url2), url2);
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
    await p2.addInitScript(() => { window.__nav = []; });
    await p2.goto(B + '/pedido.html?dom=1&c=abc&w=3001234567'); await p2.waitForTimeout(900);
    const fuente = await p2.evaluate(() => { try{ return typeof wa !== 'undefined' ? wa : null; }catch(e){ return 'err'; } });
    chk('3. pedido.html usa 573001234567', fuente === '573001234567', fuente);
    chk('4. sin errores de página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ excepción: ' + e.message); }
  await b.close();
  console.log("RESULTADO", ok, "bien", mal, "mal"); process.exit(mal ? 1 : 0);
})();
