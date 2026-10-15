// «Conectar mi cuenta de YouTube»: la vuelta de Google (#access_token=…&state=vento-yt.…) se tomaba como si fuera el
// enlace del correo para recuperar la contraseña: se borraba de la dirección y salía «📧 El enlace no sirvió»; la cuenta
// de YouTube nunca se conectaba (pasaba en el navegador, p. ej. Brave).
//  1. Vuelta de Google con el permiso → «🟢 Google conectado», queda el acceso y NO sale «El enlace no sirvió».
//  2. Google cancelado (#error=access_denied&state=vento-yt…) → aviso de Google, sin «El enlace no sirvió».
//  3. El enlace del correo de verdad (#access_token=…&type=recovery) sigue funcionando como siempre.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  async function abrir(hash, vuelta){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(v => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1');
      if(v && !sessionStorage.getItem('ya')){ localStorage.setItem('vito_ytvuelta', JSON.stringify(Object.assign({ at: Date.now() }, v))); sessionStorage.setItem('ya', '1'); }
      window.__toasts = []; const t = setInterval(() => { if(window.showToast && !window.showToast.__x){ const s = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(String(m)); return s(m, ms); }; window.showToast.__x = 1; clearInterval(t); } }, 20); }catch(e){} }, vuelta || null);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html' + hash);
    await p.waitForTimeout(4500);
    const r = await p.evaluate(() => ({ dialogo: document.body.innerText.includes('El enlace no sirvió'), toasts: window.__toasts, tok: localStorage.getItem('vito_ytok') || sessionStorage.getItem('vito_ytok'), hash: location.hash }));
    await ctx.close();
    return r;
  }
  try{
    let r = await abrir('#access_token=TOKEN-DE-YOUTUBE&token_type=Bearer&expires_in=3599&scope=https://www.googleapis.com/auth/youtube&state=vento-yt.abc123', { nonce: 'abc123', cid: 'cid-prueba', hora: true });
    chk('1. Vuelta de Google: NO sale «📧 El enlace no sirvió»', !r.dialogo, r);
    chk('1. La cuenta de YouTube queda conectada (acceso guardado) y avisa «🟢 Google conectado»', /TOKEN-DE-YOUTUBE/.test(r.tok || '') && r.toasts.some(t => /Google conectado/.test(t)), r);
    chk('1. El permiso no queda a la vista en la dirección', !/access_token/.test(r.hash), r.hash);
    r = await abrir('#error=access_denied&state=vento-yt.abc123', { nonce: 'abc123', cid: 'cid-prueba', hora: true });
    chk('2. Si cancelas en Google: aviso de Google y sin «El enlace no sirvió»', !r.dialogo && r.toasts.some(t => /Google: access_denied/.test(t)), r);
    r = await abrir('#access_token=ENLACE-DEL-CORREO&type=recovery&expires_in=3600', null);
    chk('3. El enlace del correo de verdad se sigue procesando (aquí sin servidor: «El enlace no sirvió»)', r.dialogo, r);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
