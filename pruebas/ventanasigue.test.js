// 🔑 1.99.24: al cambiar de sede (pasa solo al entrar con un correo de otro negocio), las ventanas abiertas se cierran,
// pero «Pon tu propia contraseña» (data-sigue) se queda. Antes se escondía y la persona ya no podía escribir su
// contraseña (falló clavevarios en GitHub: «element is not visible»).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('cm-tutorial-seen', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await p.waitForTimeout(500);
    const r = await p.evaluate(async () => {
      const a = document.createElement('div'); a.id = 'pruebaClave'; a.className = 'overlay show'; a.setAttribute('data-sigue', ''); a.innerHTML = '<div class="modal"><input id="pruebaCampo"></div>'; document.body.appendChild(a);
      const o = document.createElement('div'); o.id = 'pruebaOtra'; o.className = 'overlay show'; o.innerHTML = '<div class="modal">otra</div>'; document.body.appendChild(o);
      await switchToSede({ id: 'sede-prueba', key: STORAGE_KEY + '-sede-prueba', name: 'Sede prueba' });
      const campo = document.getElementById('pruebaCampo');
      return { sigue: a.classList.contains('show') && !!campo.offsetParent, otra: o.classList.contains('show') };
    });
    chk('Al cambiar de sede, «Pon tu propia contraseña» (data-sigue) sigue a la vista y se puede escribir', r.sigue, r);
    chk('…y las demás ventanas se cierran como siempre', !r.otra, r);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
