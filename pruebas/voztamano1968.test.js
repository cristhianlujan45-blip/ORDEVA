// 🎙️ 1.99.68 · Pedir por voz productos del mismo nombre y distinto tamaño (Purina 1 kg y Purina 5 kg). Antes TODAS las
// frases agregaban la de 1 kg, aunque se dijera «purina de 5 kilos». Revisa:
//  1. «dos purinas de 5 kilos a la mesa 3» → 2 × Purina 5 kg en la mesa 3, y lo dice con el tamaño.
//  2. «una purina de un kilo a la mesa 3» → 1 × Purina 1 kg.
//  3. «dos purinas a la mesa 3» (sin tamaño) → no agrega nada y pregunta cuál.
//  4. Un producto sin tamaños repetidos sigue igual («tres vasijas a la mesa 3»).
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
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      window.__dicho = []; window.speakVoice = t => window.__dicho.push(t); window.__toasts = []; const st = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(m); try{ st(m, ms); }catch(e){} };
      data.products = [{ id: 'pa1', name: 'Purina', size: '1 kg', price: 8000, stock: 10 }, { id: 'pa5', name: 'Purina', size: '5 kg', price: 35000, stock: 10 }, { id: 'v', name: 'Vasija', price: 5000, stock: 10 }];
      data.tables = data.tables || {}; data.tables[3] = { items: [], payments: [], people: [] }; await saveData(); });
    const decir = async f => p.evaluate(async f => { window.__dicho = []; window.__toasts = []; await handleVoiceTranscriptLocal(f); await new Promise(r => setTimeout(r, 200));
      return { items: (data.tables[3].items || []).map(it => it.productId + ':' + it.qty), dicho: window.__dicho.join(' | '), toasts: window.__toasts.join(' | ') }; }, f);
    let r = await decir('dos purinas de 5 kilos a la mesa 3');
    chk('1. «dos purinas de 5 kilos» → 2 × Purina 5 kg, y lo dice con el tamaño', JSON.stringify(r.items) === '["pa5:2"]' && /Purina 5 kg/.test(r.dicho + r.toasts), r);
    r = await decir('una purina de un kilo a la mesa 3');
    chk('2. «una purina de un kilo» → 1 × Purina 1 kg', r.items.includes('pa1:1') && r.items.includes('pa5:2'), r);
    r = await decir('dos purinas a la mesa 3');
    chk('3. Sin tamaño: no agrega y pregunta cuál', r.items.length === 2 && r.items.includes('pa1:1') && r.items.includes('pa5:2') && /Hay varios tamaños/.test(r.dicho) && /1 kg o 5 kg/.test(r.toasts), r);
    r = await decir('tres vasijas a la mesa 3');
    chk('4. «tres vasijas» sigue igual', r.items.includes('v:3') && /3 Vasija agregado/.test(r.dicho + r.toasts), r);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
