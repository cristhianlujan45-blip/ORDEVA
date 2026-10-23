// «Ya no me llega nada, ya no me pide permiso y me dice "instala la app" y ya está instalada».
// En Android hay dos «ORDEVA»: la APP (lee los avisos del banco) y VENTO WEB (navegador o su acceso directo), que no
// puede leerlos. Antes se llamaban igual y el paso a paso decía «Falta instalarla» con la app instalada.
//  1. ORDEVA Web en Android: el paso a paso dice «Estás en ORDEVA Web» y «📲 Abrir la app ORDEVA» (enlace a la app que,
//     si no está, la descarga); Ajustes → Pagos lo avisa; un aviso al entrar (una vez).
//  2. En la app: «Ya estás en la app». La app sin su puente: «ábrela otra vez» + reporte a ORDEVA Admin.
//  3. «Conectar mi cuenta de YouTube» empezado en la APP: Google vuelve al navegador → de ahí a la app (con el código o
//     el token) y ORDEVA Web no lo procesa. En la app se termina de conectar.
//  4. El acceso directo de la web se llama «ORDEVA Web» (ya no se confunde con la app; ORDEVA etapa 8).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const UA_CHROME = 'Mozilla/5.0 (Linux; Android 14; 23108RN04Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const UA_APP = UA_CHROME.replace('Mobile Safari/537.36', 'Mobile Safari/537.36 VentoAndroid/1.0.25');

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  const nuevo = async (ua, app, url) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(([app]) => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      window.__abrir = []; window.__errores = [];
      if(app){ const A = window.__and = { on: true, permiso: true };
        window.VentoAndroid = { pagosAvisos: v => { A.on = !!v; }, pagosAvisosEstado: () => JSON.stringify({ on: A.on, permiso: A.permiso }), pagosAvisosTomar: () => '[]', mediosPermiso: () => {}, notificar: () => true, pagosNotif: () => {}, pagosVolumen: () => {} }; }
    }, [app]);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(url || BASE + '/index.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    return { ctx, p };
  };
  const entrar = async (p, biz) => {
    await p.fill('#authBiz', biz); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.ventoAbrirApp = c => window.__abrir.push(window.ventoIntentApp(c || '')); const e0 = window.ventoError; window.ventoError = (...a) => { window.__errores.push(a); }; });
  };
  try{
    // ---------- 1. ORDEVA Web en Android ----------
    let { ctx, p } = await nuevo(UA_CHROME, false);
    await entrar(p, 'Bar Web');
    chk('1. Se reconoce ORDEVA Web en Android (sin la app)', await p.evaluate(() => window.ventoAndroidWeb() && !window.ventoEnApp() && !window.ventoAppSinPuente()));
    await p.evaluate(() => { data.pagos = data.pagos || {}; data.pagos.on = true; saveData(); window.ventoPagosGuia(); });
    await p.waitForTimeout(300);
    let g = await p.evaluate(() => document.getElementById('pgGuiaOv').innerText);
    chk('1. Paso a paso: ya NO dice «Falta instalarla»; dice «Estás en ORDEVA Web» y que solo la app lee los avisos', !/Falta instalarla/.test(g) && /Estás en ORDEVA Web/.test(g) && /solo los puede leer la app ORDEVA/.test(g), g.slice(0, 400));
    const bajar = await p.evaluate(() => { const a = [...document.querySelectorAll('#pgGuiaOv a')].find(x => /Descargar la app \(vento\.apk\)/.test(x.textContent)); return a ? a.getAttribute('href') : null; });
    chk('1. Botón directo «⬇️ Descargar la app (vento.apk)» con el enlace del APK (no la web) y cómo instalarlo', bajar === 'https://github.com/cristhianlujan45-blip/ORDEVA/releases/latest/download/vento.apk' && /Permitir de esta fuente/.test(g) && /Instalar/.test(g), bajar);
    await p.click('[data-gp="abrirapp"]');
    let ab = await p.evaluate(() => window.__abrir.slice());
    chk('1. «📲 Abrir la app ORDEVA» abre la app (intent vento://abrir del paquete co.vento.app; si no está, la descarga)', ab.length === 1 && /^intent:\/\/abrir#Intent;scheme=vento;package=co\.vento\.app;S\.browser_fallback_url=https%3A%2F%2Fgithub\.com%2F.*vento\.apk;end$/.test(ab[0]), ab);
    await p.evaluate(() => { document.getElementById('pgGuiaOv').classList.remove('show'); try{ pgPintar(); }catch(e){} });
    await p.evaluate(() => { const i = document.getElementById('pgOn'); i.checked = true; i.dispatchEvent(new Event('change')); });
    const aj = await p.evaluate(() => { const a = document.getElementById('pgWebAviso'); return a ? { hidden: a.hidden, txt: a.innerText, est: document.getElementById('pgEstado').textContent } : null; });
    chk('1. Ajustes → Pagos: «📲 Estás en ORDEVA Web, no en la app» con botón para abrirla', aj && !aj.hidden && /Estás en ORDEVA Web/.test(aj.txt) && /ORDEVA Web/.test(aj.est), aj);
    chk('1. … y botón «⬇️ Descargar la app (vento.apk)» con el enlace del APK', await p.evaluate(() => { const a = document.getElementById('pgBajarApk'); return !!a && /releases\/latest\/download\/vento\.apk$/.test(a.href); }));
    // Al volver a abrir ORDEVA Web (los pagos ya prendidos): aviso una vez
    await p.reload(); await p.waitForTimeout(1500);
    const t1 = await p.evaluate(() => new Promise(r => { const vistos = []; const st = window.showToast; window.showToast = (m, d) => { vistos.push(String(m)); try{ st(m, d); }catch(e){} }; setTimeout(() => r(vistos.join(' | ') + ' | ' + document.body.innerText), 5000); }));
    chk('1. Al entrar a ORDEVA Web con los pagos prendidos, avisa que para que suenen hay que abrir la app', /Estás en ORDEVA Web: aquí no se leen los avisos/.test(t1));
    await ctx.close();

    // ---------- 2. En la app ----------
    ({ ctx, p } = await nuevo(UA_APP, true));
    await entrar(p, 'Bar App');
    await p.evaluate(() => { data.pagos = data.pagos || {}; data.pagos.on = true; saveData(); window.ventoPagosGuia(); });
    await p.waitForTimeout(300);
    g = await p.evaluate(() => document.getElementById('pgGuiaOv').innerText);
    chk('2. En la app: «Ya estás en la app ORDEVA» (no «ORDEVA Web»)', /Ya estás en la app ORDEVA/.test(g) && !/Estás en ORDEVA Web/.test(g), g.slice(0, 300));
    chk('2. En la app no sale el aviso de ORDEVA Web', await p.evaluate(() => { const a = document.getElementById('pgWebAviso'); return !a || a.hidden; }));
    await ctx.close();
    ({ ctx, p } = await nuevo(UA_APP, false));
    chk('2. La app sin su puente se reconoce (y no se toma como ORDEVA Web)', await p.evaluate(() => window.ventoAppSinPuente() && !window.ventoAndroidWeb()));
    await entrar(p, 'Bar Rota');
    await p.evaluate(() => { data.pagos = data.pagos || {}; data.pagos.on = true; window.ventoPagosGuia(); });
    await p.waitForTimeout(300);
    g = await p.evaluate(() => document.getElementById('pgGuiaOv').innerText);
    chk('2. … el paso a paso dice que la cierre del todo y la abra otra vez', /no cargó bien/.test(g) && /Ábrela de nuevo/.test(g), g.slice(0, 300));
    await ctx.close();

    // ---------- 2b. App VIEJA (antes del 13 de octubre): tiene puente pero no lee avisos ----------
    {
      const c = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA_APP.replace('1.0.25', '1.0.9') });
      await c.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await c.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} window.VentoAndroid = { notificar: () => true, hablar: () => {}, callar: () => {} }; window.__abrir = []; window.__errores = []; });
      const pv = await c.newPage(); pv.on('pageerror', e => errs.push(e.message));
      await pv.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' }); await pv.waitForTimeout(1500);
      await entrar(pv, 'Bar Vieja');
      chk('2b. La app vieja se reconoce como app (no como ORDEVA Web)', await pv.evaluate(() => window.ventoAppVieja() && !window.ventoAndroidWeb() && !window.ventoAppSinPuente()));
      await pv.evaluate(() => { data.pagos = data.pagos || {}; data.pagos.on = true; saveData(); window.ventoPagosGuia(); });
      await pv.waitForTimeout(300);
      const gv = await pv.evaluate(() => document.getElementById('pgGuiaOv').innerText);
      chk('2b. Paso a paso: «Estás en la app ORDEVA, pero es una versión VIEJA (1.0.9)» + «⬇️ Descargar la app nueva (vento.apk)», NO «ORDEVA Web»', /versión VIEJA \(1\.0\.9\)/.test(gv) && /Descargar la app nueva \(vento\.apk\)/.test(gv) && /App vieja: actualízala/.test(gv) && !/Estás en ORDEVA Web/.test(gv), gv.slice(0, 600));
      chk('2b. … con qué hacer si dice «No se instaló la app»', /No se instaló la app/.test(gv));
      chk('2b. «🔎 Este equipo: App ORDEVA para Android 1.0.9 — VIEJA…»', /Este equipo: App ORDEVA para Android 1\.0\.9 — VIEJA/.test(gv), gv.slice(-300));
      await pv.evaluate(() => { document.getElementById('pgGuiaOv').classList.remove('show'); const i = document.getElementById('pgOn'); i.checked = true; i.dispatchEvent(new Event('change')); });
      const av = await pv.evaluate(() => ({ h: document.getElementById('pgWebAviso').hidden, t: document.getElementById('pgWebAviso').innerText, e: document.getElementById('pgEstado').textContent }));
      chk('2b. Ajustes → Pagos: «Tu app ORDEVA es una versión vieja… actualízala» con el botón del APK', !av.h && /versión vieja/.test(av.t) && /Descargar la app \(vento\.apk\)/.test(av.t) && /app ORDEVA es vieja/.test(av.e), av);
      await c.close();
    }

    // ---------- 3. Conectar YouTube empezado en la app ----------
    ({ ctx, p } = await nuevo(UA_APP, true));
    await p.evaluate(() => { try{ window.ytConectarHora(); }catch(e){ window.__e = e.message; } });
    const nonceApp = await p.evaluate(() => (JSON.parse(localStorage.getItem('vito_ytvuelta') || 'null') || {}).nonce || '');
    chk('3. Empezado en la app: la conexión queda marcada «app…»', /^app[0-9a-f]{24}$/.test(nonceApp), nonceApp);
    await ctx.close();
    ({ ctx, p } = await nuevo(UA_CHROME, false));
    await p.evaluate(() => { try{ window.ytConectarHora(); }catch(e){} });
    const nonceWeb = await p.evaluate(() => (JSON.parse(localStorage.getItem('vito_ytvuelta') || 'null') || {}).nonce || '');
    chk('3. Empezado en ORDEVA Web: sin la marca (se termina en la web, como antes)', /^[0-9a-f]{24}$/.test(nonceWeb), nonceWeb);
    await ctx.close();
    // Google vuelve al NAVEGADOR con el código de una conexión de la app
    ({ ctx, p } = await nuevo(UA_CHROME, false, BASE + '/index.html?code=4%2F0AQabc&scope=x&state=vento-yt.app123abc'));
    let v3 = await p.evaluate(() => ({ ir: window.__ventoVolverApp || '', btn: (document.getElementById('ventoVolverAppBtn') || {}).href || '', txt: (document.getElementById('ventoVolverApp') || {}).innerText || '', url: location.search + location.hash }));
    chk('3. Vuelta de Google en el navegador → «📲 Volver a la app ORDEVA» con el código para la app', /^intent:\/\/abrir\?code=4%2F0AQabc&scope=x&state=vento-yt\.app123abc#Intent;scheme=vento;package=co\.vento\.app;end$/.test(v3.ir) && v3.btn === v3.ir && /Volver a la app ORDEVA/.test(v3.txt), v3);
    chk('3. … y ORDEVA Web no la procesa (la dirección queda limpia, sin «no corresponde»)', v3.url === '' && !/no corresponde/.test(await p.evaluate(() => document.body.innerText)), v3.url);
    await ctx.close();
    ({ ctx, p } = await nuevo(UA_CHROME, false, BASE + '/index.html#access_token=ya29.tok&token_type=Bearer&expires_in=3599&state=vento-yt.app9'));
    v3 = await p.evaluate(() => window.__ventoVolverApp || '');
    chk('3. Con token (#access_token…): va a la app dentro de «_h» (el # no cabe en el enlace)', /^intent:\/\/abrir\?_h=access_token%3Dya29\.tok%26token_type%3DBearer%26expires_in%3D3599%26state%3Dvento-yt\.app9#Intent;scheme=vento;package=co\.vento\.app;end$/.test(v3), v3);
    await ctx.close();
    // En la app: llega «?_h=…» → se termina de conectar
    ({ ctx, p } = await nuevo(UA_APP, true, BASE + '/index.html'));
    await p.evaluate(() => localStorage.setItem('vito_ytvuelta', JSON.stringify({ nonce: 'app9', cid: 'x.apps.googleusercontent.com', redir: location.origin + '/', at: Date.now(), hora: true })));
    await p.goto(BASE + '/index.html?_h=' + encodeURIComponent('access_token=ya29.tok&token_type=Bearer&expires_in=3599&state=vento-yt.app9'));
    await p.waitForTimeout(2500);
    const v4 = await p.evaluate(() => ({ tok: localStorage.getItem('vito_ytok') || '', on: (JSON.parse(localStorage.getItem('vito_yt') || '{}')).on, url: location.search + location.hash, txt: document.body.innerText }));
    chk('3. En la app, la vuelta se termina: Google conectado con ese token', /ya29\.tok/.test(v4.tok) && v4.on === true && /Google conectado/.test(v4.txt), { tok: v4.tok, on: v4.on });
    chk('3. … y la dirección queda limpia', v4.url === '', v4.url);
    await ctx.close();

    // ---------- 4. Nombre del acceso directo de la web ----------
    const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8'));
    chk('4. El acceso directo de la web se llama «ORDEVA Web» (no se confunde con la app), con los íconos de ORDEVA', man.name === 'ORDEVA Web' && man.short_name === 'ORDEVA Web' && man.icons.every(i => /^icons\/ordeva/.test(i.src) && fs.existsSync(path.join(__dirname, '..', i.src))), man);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
