// Entrar a Vento (contra el «Supabase local» REAL: PostgreSQL + supabase-js):
//  1. Pestañas «🔑 Iniciar sesión | ➕ Crear cuenta» siempre a la vista (en un celular nuevo arranca en «Crear cuenta»).
//  2. 📲 Entrar fácil con un código al correo (sin contraseña): celular nuevo → baja la cuenta y entra.
//     Correo sin cuenta → lo dice; código malo → lo dice. Sin SMS en el servidor, «📱 Al celular» avisa y no deja pedir.
//  3. ¿Olvidaste tu contraseña? → código temporal al correo + contraseña nueva → entra de una y la contraseña cambia
//     en la cuenta (la vieja deja de servir).
//  4. Con SMS en el servidor: se une el celular a la cuenta con un código y después se entra con un SMS.
//  5. Al salir, la pantalla vuelve a «Iniciar sesión / Crear cuenta» (no se queda en la del código).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }
(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 }).then(() => true, () => false);
    const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.checkVisibility(); }, sel);
    const claveSirve = async (email, clave) => (await fetch(sb.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: sb.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: clave }) })).status === 200;
    const codigo = async (fn, ms) => { const t = Date.now(); while(Date.now() - t < (ms || 8000)){ const r = sb.recuperaciones.filter(fn).pop(); if(r && r.codigo) return r.codigo; await new Promise(r => setTimeout(r, 150)); } return null; };
    async function celular(){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.codigoEntrar, null, { timeout: 15000 });
      return { ctx, p };
    }
    // La cuenta ya existe en la nube con su negocio (la creó en otro celular).
    await sb.usuario('ana@tienda.co', 'vieja123');

    // ===== 1. Pestañas =====
    const A = await celular(), p = A.p;
    let r = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('#authTabs [data-tab]')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')).join('|'), t: document.getElementById('authTitle').textContent }));
    chk('Celular nuevo: pestañas «🔑 Iniciar sesión | ➕ Crear cuenta» con «Crear cuenta» marcada', r.tabs === '🔑 Iniciar sesión|➕ Crear cuenta*' && r.t === 'Crear cuenta', r);
    chk('«Crear cuenta»: pide el nombre del negocio; sin «Entrar con un código»', await vis(p, '#authBiz') && !(await vis(p, '#authCodigo')));
    await p.click('#authTabs [data-tab="entrar"]');
    r = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('#authTabs .on')].map(b => b.dataset.tab).join(), t: document.getElementById('authTitle').textContent, btn: document.getElementById('authBtn').textContent }));
    chk('«🔑 Iniciar sesión»: correo y contraseña, botón «Entrar»', r.tabs === 'entrar' && r.t === 'Iniciar sesión' && r.btn === 'Entrar' && await vis(p, '#authUser') && await vis(p, '#authPass') && !(await vis(p, '#authBiz')), r);
    chk('…con «📲 Entrar fácil con un código» y «¿Olvidaste tu contraseña?»', await vis(p, '#authCodigo') && await vis(p, '#authForgot'));
    chk('El botón viejo de abajo ya no se ve (las pestañas lo reemplazan)', !(await vis(p, '#authNueva')));
    await p.click('#authTabs [data-tab="crear"]');
    chk('Volver a «➕ Crear cuenta» funciona', await vis(p, '#authBiz') && (await p.textContent('#authTitle')) === 'Crear cuenta');
    await p.click('#authTabs [data-tab="entrar"]');

    // ===== 2. Entrar con un código al correo =====
    await p.click('#authCodigo');
    chk('«Entrar con un código»: «📧 Al correo» marcado y pide el correo', await vis(p, '#otpForm') && !(await vis(p, '#authForm')) && /Al correo/.test(await p.textContent('#otpTabs .on')) && (await p.textContent('#otpDestTxt')) === 'Tu correo');
    // Sin SMS en el servidor: «Al celular» lo dice y no deja pedir
    await p.click('#otpTabs [data-por="celular"]');
    chk('Sin mensajes de texto en el servidor: «📱 Al celular» avisa que no está activado y no deja pedir', await esperar(p, () => /todavía no está activado/.test(document.getElementById('otpHint').textContent) && document.getElementById('otpEnviar').disabled, null, 5000), await p.textContent('#otpHint'));
    await p.click('#otpTabs [data-por="correo"]');
    await p.fill('#otpDest', 'nadie@tienda.co'); await p.click('#otpEnviar');
    chk('Correo sin cuenta: «no tiene cuenta de Vento»', await esperar(p, () => /no tiene cuenta/.test(document.getElementById('otpErr').textContent), null, 8000), await p.textContent('#otpErr'));
    await p.fill('#otpDest', 'ana@tienda.co'); await p.click('#otpEnviar');
    chk('Pide el código: «✅ Te mandamos el código a a***@tienda.co»', await esperar(p, () => !document.getElementById('otpPaso2').hidden && /Te mandamos el código a a\*\*\*@tienda\.co/.test(document.getElementById('otpEnviado').textContent), null, 8000), await p.textContent('#otpEnviado'));
    const c1 = await codigo(x => x.ruta === '/otp' && x.email === 'ana@tienda.co');
    chk('El servidor manda el código solo a una cuenta que existe (sin crear otra)', !!c1 && Number((await sb.sql("select count(*) n from auth.users where lower(email) = 'nadie@tienda.co'"))[0].n) === 0);
    chk('«Mandarme otro código» espera 30 s', await p.evaluate(() => document.getElementById('otpOtro').disabled && /en \d+ s/.test(document.getElementById('otpOtro').textContent)));
    await p.fill('#otpCode', String((Number(c1) + 1) % 1e6).padStart(6, '0'));
    chk('Código malo: «no sirve o ya venció»', await esperar(p, () => /no sirve o ya venció/.test(document.getElementById('otpErr').textContent), null, 8000), await p.textContent('#otpErr'));
    await p.fill('#otpCode', c1 || '');
    chk('Con el código bueno (6 números, sin tocar «Entrar») entra a Vento', await esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000), await p.textContent('#otpErr'));
    r = await p.evaluate(() => ({ u: authUser, n: window.ventoNube.negocio(), c: window.ventoNube.correo() }));
    chk('…con la cuenta ana@tienda.co y su negocio en la nube', r.u === 'ana@tienda.co' && r.c === 'ana@tienda.co' && !!(r.n && r.n.id), r);
    chk('Entrar con código no cambia la contraseña de la cuenta', await claveSirve('ana@tienda.co', 'vieja123'));

    // ===== 5. Al salir vuelve la pantalla de siempre =====
    await p.evaluate(() => { localStorage.removeItem('cm-session'); }); await p.reload();
    await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    r = await p.evaluate(() => ({ af: !document.getElementById('authForm').hidden, otp: document.getElementById('otpForm').hidden, rec: document.getElementById('recForm').hidden, tab: (document.querySelector('#authTabs .on') || {}).dataset }));
    chk('Al volver a la entrada: «Iniciar sesión» (ni la del código ni la de recuperar)', r.af && r.otp && r.rec && r.tab && r.tab.tab === 'entrar', r);
    // Y en este celular ya entra con la contraseña de siempre (la de la cuenta)
    await p.fill('#authUser', 'ana@tienda.co'); await p.fill('#authPass', 'vieja123'); await p.click('#authBtn');
    chk('Después del código, también entra con su contraseña de la cuenta', await esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000), await p.textContent('#authErr'));

    // ===== 3. ¿Olvidaste tu contraseña? con código temporal (celular nuevo) =====
    const B = await celular(), q = B.p;
    await q.click('#authTabs [data-tab="entrar"]');
    await q.click('#authForgot');
    chk('«¿Olvidaste tu contraseña?»: correo, «Enviarme un código al correo», código temporal y contraseña nueva dos veces', await vis(q, '#recUser') && /Enviarme un código/.test(await q.textContent('#recMailBtn')) && await vis(q, '#recCode') && await vis(q, '#recNew') && await vis(q, '#recNew2'));
    chk('Los códigos de recuperación y el SMS del soporte quedan en «Otras formas»', await q.evaluate(() => { const d = document.getElementById('recOtras'); return !!d && !d.open && !!d.querySelector('#vcSmsBox'); }));
    sb.recuperaciones.length = 0;
    await q.fill('#recUser', 'ana@tienda.co'); await q.click('#recMailBtn');
    chk('Manda un código temporal al correo de la cuenta', await esperar(q, () => /código temporal a a\*\*\*@tienda\.co/.test(document.getElementById('recMailTxt').textContent), null, 8000), await q.textContent('#recMailTxt'));
    const c3 = await codigo(x => x.ruta === '/otp' && x.email === 'ana@tienda.co');
    chk('…es un código (no un enlace de «recover»)', !!c3 && !sb.recuperaciones.some(x => x.ruta === '/recover'));
    await q.fill('#recCode', c3 || ''); await q.fill('#recNew', 'nueva789'); await q.fill('#recNew2', 'nueva780');
    await q.click('#recOk');
    chk('Contraseñas distintas: lo dice y no cambia nada', await esperar(q, () => /no son iguales/.test(document.getElementById('recErr').textContent), null, 5000) && await claveSirve('ana@tienda.co', 'vieja123'));
    await q.fill('#recNew2', 'nueva789'); await q.click('#recOk');
    chk('Código + contraseña nueva: entra de una a Vento', await esperar(q, () => document.getElementById('authOverlay').hidden, null, 20000), await q.textContent('#recErr'));
    chk('La contraseña nueva queda en la cuenta y la vieja ya no sirve', await claveSirve('ana@tienda.co', 'nueva789') && !(await claveSirve('ana@tienda.co', 'vieja123')));
    r = await q.evaluate(() => ({ u: authUser, n: !!window.ventoNube.negocio() }));
    chk('…con su cuenta y su negocio', r.u === 'ana@tienda.co' && r.n, r);

    // ===== 2b. El enlace del correo de «Entrar con un código» también entra (celular nuevo) =====
    const L = await celular(), l = L.p;
    await l.click('#authTabs [data-tab="entrar"]'); await l.click('#authCodigo');
    sb.recuperaciones.length = 0;
    await l.fill('#otpDest', 'ana@tienda.co'); await l.click('#otpEnviar');
    await esperar(l, () => !document.getElementById('otpPaso2').hidden, null, 8000);
    const rl = sb.recuperaciones.filter(x => x.ruta === '/otp').pop() || {};
    chk('El correo del código trae un enlace que vuelve a Vento con «nubecodigo=1»', rl.volver === BASE + '/?nubecodigo=1', rl);
    const tokL = (await sb.entrar('ana@tienda.co', 'nueva789')).sesion;
    await l.goto(BASE + '/?nubecodigo=1#access_token=' + tokL.access_token + '&refresh_token=' + tokL.refresh_token + '&expires_in=3600&token_type=bearer&type=magiclink');
    chk('Al tocar el enlace entra directo a la cuenta (sin pedir contraseña nueva)', await esperar(l, () => document.getElementById('authOverlay').hidden && authUser === 'ana@tienda.co', null, 20000) && !/access_token/.test(l.url()), l.url());
    await L.ctx.close();

    // ===== 4. Con SMS en el servidor: unir el celular y entrar con un mensaje de texto =====
    sb.authCfg.telefono = true;
    await q.evaluate(() => window.ventoNube.celularUnir('300 123 4567'));
    const c4 = await codigo(x => x.ruta === '/user' && x.phone === '573001234567');
    chk('Unir el celular manda un SMS al +57 300 123 4567', !!c4);
    let unido = await q.evaluate(c => window.ventoNube.celularConfirmar('3001234567', c).then(() => true, e => e.message), c4);
    chk('Con el código del SMS el celular queda unido a la cuenta', unido === true && (await sb.sql("select phone from auth.users where lower(email) = 'ana@tienda.co'"))[0].phone === '573001234567', unido);
    const C = await celular(), w = C.p;
    await w.click('#authTabs [data-tab="entrar"]'); await w.click('#authCodigo'); await w.click('#otpTabs [data-por="celular"]');
    chk('Con SMS activado: «📱 Al celular» pide el número y deja pedir', await esperar(w, () => !document.getElementById('otpEnviar').disabled && /celular/.test(document.getElementById('otpDestTxt').textContent), null, 5000));
    await w.fill('#otpDest', '311 000 0000'); await w.click('#otpEnviar');
    chk('Celular que no está unido a ninguna cuenta: «no tiene cuenta»', await esperar(w, () => /no tiene cuenta/.test(document.getElementById('otpErr').textContent), null, 8000), await w.textContent('#otpErr'));
    sb.recuperaciones.length = 0;
    await w.fill('#otpDest', '300 123 4567'); await w.click('#otpEnviar');
    chk('Pide el SMS: «✅ Te mandamos el código a •••4567»', await esperar(w, () => /•••4567/.test(document.getElementById('otpEnviado').textContent), null, 8000), await w.textContent('#otpErr'));
    const c5 = await codigo(x => x.ruta === '/otp' && x.phone === '573001234567');
    await w.fill('#otpCode', c5 || '');
    chk('Con el código del SMS entra a la cuenta ana@tienda.co', await esperar(w, () => document.getElementById('authOverlay').hidden && authUser === 'ana@tienda.co', null, 20000), await w.textContent('#otpErr'));
    sb.authCfg.telefono = false;
  }
})();
