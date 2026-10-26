// 🔋 1.65.1: con el celular bloqueado no llegaban pedidos ni pagos porque Android congela a ORDEVA cuando su trabajo de
// fondo está apagado o tiene ahorro de batería. Con la app Android simulada (window.VentoAndroid):
//  1. Trabajo de fondo apagado sin querer → al abrir ORDEVA se prende solo, avisa y queda en 🐞 Errores.
//  2. Apagado a propósito en Ajustes → se respeta (no se prende solo).
//  3. Con ahorro de batería → sale «Para que te lleguen los avisos con el celular bloqueado» con «Arreglar», que abre el ajuste.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  async function abrir(est){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(est => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); if(est.aPropos) localStorage.setItem('vento-fondo-apagado', '1'); }catch(e){}
      window.__and = { fondo: est.fondo, activar: [], bateria: 0, errores: [] };
      window.VentoAndroid = {
        fondo: () => window.__and.fondo,
        fondoActivar: si => { window.__and.activar.push(si); window.__and.fondo = !!si; },
        permisos: () => JSON.stringify({ microfono: true, camara: true, avisos: true, bateria: est.bateria, fondo: window.__and.fondo }),
        ajustesBateria: () => { window.__and.bateria++; }
      };
      Object.defineProperty(window, 'ventoError', { configurable: true, get(){ return (t, m) => window.__and.errores.push(t + ': ' + m); }, set(){} });
    }, est);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    await p.evaluate(async () => { await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.waitForTimeout(6500);
    return { ctx, p };
  }
  try{
    // 1. Apagado sin querer
    let { ctx, p } = await abrir({ fondo: false, bateria: true });
    let r = await p.evaluate(() => ({ a: window.__and.activar, e: window.__and.errores, t: document.body.innerText }));
    chk('1. Trabajo de fondo apagado sin querer: al abrir ORDEVA se prende solo', r.a.includes(true), r.a);
    chk('1. … avisa en pantalla', /vuelve a trabajar de fondo/.test(r.t));
    chk('1. … y queda en 🐞 Errores del panel', r.e.some(x => /trabajo de fondo estaba apagado/.test(x)), r.e);
    await ctx.close();
    // 2. Apagado a propósito
    ({ ctx, p } = await abrir({ fondo: false, bateria: true, aPropos: true }));
    r = await p.evaluate(() => window.__and.activar);
    chk('2. Apagado a propósito en Ajustes: no se prende solo', !r.includes(true), r);
    await ctx.close();
    // 3. Ahorro de batería
    ({ ctx, p } = await abrir({ fondo: true, bateria: false }));
    const t3 = await p.evaluate(() => document.body.innerText);
    chk('3. Con ahorro de batería sale el aviso «con el celular bloqueado»', /celular bloqueado/.test(t3) && /Sin restricciones/.test(t3), t3.slice(0, 300));
    const btn = await p.$('#confirmOkBtn');
    if(btn) await btn.click();
    await p.waitForTimeout(300);
    r = await p.evaluate(() => ({ b: window.__and.bateria, e: window.__and.errores }));
    chk('3. … «Arreglar» abre el ajuste de batería del celular y queda en 🐞 Errores', r.b === 1 && r.e.some(x => /ahorro de batería/.test(x)), r);
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
