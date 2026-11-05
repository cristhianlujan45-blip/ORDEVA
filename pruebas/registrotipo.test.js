// 🏷️ ORDEVA 1.76.0 · Al crear la cuenta se ELIGE el tipo de negocio (app/04h). Sin internet.
//  (Esta prueba se hace pasar por una persona: navigator.webdriver = false. Las demás pruebas siguen con «Tienda» por defecto.)
//  1. Arriba: 🍽️ Restaurante · 🏨 Hotel · 🛒 Tienda · 🔎 Otro. Sin elegir, «Crear cuenta» no crea nada y lo pide.
//  2. Con «🏨 Hotel»: se crea un hotel (habitaciones). 3. «🔎 Otro» abre el buscador de tipos. Sin errores.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    let v = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#authTipoRapido [data-tipo-r]')].map(x => x.textContent.trim()), grande: !document.getElementById('authTypePick').hidden }));
    chk('1. Arriba: Restaurante, Hotel, Tienda y Otro (sin el botón grande)', JSON.stringify(v.chips) === JSON.stringify(['🍽️Restaurante', '🏨Hotel', '🛒Tienda', '🔎Otro']) && !v.grande, v);
    await p.fill('#authBiz', 'Hotel Las Palmas'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(800);
    v = await p.evaluate(() => ({ err: document.getElementById('authErr').textContent, abierto: !document.getElementById('authOverlay').hidden }));
    chk('1. Sin elegir: no crea la cuenta y dice «👆 Elige qué negocio tienes…»', v.abierto && /Elige qué negocio tienes/.test(v.err), v);
    await p.click('#authTipoRapido [data-tipo-r="otro"]'); await p.waitForTimeout(400);
    v = await p.evaluate(() => !!document.getElementById('tipoSheet') && document.getElementById('tipoSheet').classList.contains('show'));
    chk('3. «🔎 Otro» abre el buscador de tipos', v);
    await p.evaluate(() => document.getElementById('tipoSheet').classList.remove('show'));
    await p.click('#authTipoRapido [data-tipo-r="hotel"]'); await p.waitForTimeout(200);
    v = await p.evaluate(() => ({ val: document.getElementById('authType').value, on: (document.querySelector('#authTipoRapido .on') || {}).textContent, err: document.getElementById('authErr').textContent }));
    chk('2. «🏨 Hotel» queda marcado y se quita el aviso', v.val === 'hotel' && /Hotel/.test(v.on || '') && !v.err, v);
    await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    v = await p.evaluate(() => ({ t: data.businessType, nav: [...document.querySelectorAll('nav button[data-view]')].filter(x => x.offsetParent).map(x => x.textContent.trim()).join(' ') }));
    chk('2. Se creó un hotel (con «Habitaciones»)', v.t === 'hotel' && /Habitaci/.test(v.nav), v);
    chk('3. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
