// Recuperar la cuenta por correo (antes el enlace del correo abría «404»), contra el «Supabase local» REAL:
//  • el correo se pide con la dirección de vuelta de Vento (la carpeta de la app, nunca una página que no existe):
//    clientes → «…/?nubeclave=1» o «…/?recuperar=usuario», administrador → «…/admin.html?adminclave=1»;
//  • en un celular NUEVO (sin la cuenta guardada) también se puede pedir con el correo;
//  • al abrir el enlace, Vento pide la contraseña nueva, la cambia en la cuenta y se entra con ella;
//  • un enlace vencido o ya usado dice «El enlace no sirvió» (no queda en blanco ni en 404);
//  • el panel de administrador también recibe el enlace y deja poner la contraseña nueva;
//  • 404.html: cualquier dirección de Vento que no exista vuelve a la app con lo que traía.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }
const ADMIN = 'cristhianwkh@gmail.com';
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
    const cab = tok => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
    const entrar = async (email, clave) => { const r = await fetch(sb.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: cab(), body: JSON.stringify({ email, password: clave }) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    async function celular(){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
      return { ctx, p };
    }
    const ultima = () => sb.recuperaciones[sb.recuperaciones.length - 1] || {};

    // ===== Cliente con cuenta, en un celular NUEVO =====
    await sb.usuario('ana@tienda.co', 'vieja123');
    const A = await celular(), p = A.p;
    await p.goto(BASE + '/index.html');
    await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.enlaceClave, null, { timeout: 15000 });
    await p.click('#authTabs [data-tab="entrar"]');
    await p.click('#authForgot');
    await p.fill('#recUser', 'ana@tienda.co'); await p.click('#recMailBtn');
    chk('Celular nuevo: se puede pedir el correo con solo el correo de la cuenta', await esperar(p, () => /^✅/.test(document.getElementById('recMailTxt').textContent), null, 10000), await p.textContent('#recMailTxt'));
    const r1 = ultima();
    chk('…llega un código temporal y el enlace del mismo correo vuelve a Vento (la carpeta de la app, con «nubeclave=1»), no a una página que no existe', r1.ruta === '/otp' && !!r1.codigo && r1.email === 'ana@tienda.co' && r1.volver === BASE + '/?nubeclave=1', r1);

    // Abrir el enlace del correo (Supabase devuelve con #access_token=…&type=recovery)
    const tok = (await entrar('ana@tienda.co', 'vieja123')).j.access_token;
    await p.goto(BASE + '/?nubeclave=1#access_token=' + tok + '&refresh_token=x&expires_in=3600&token_type=bearer&type=recovery');
    chk('Al abrir el enlace, Vento pide la contraseña nueva (con el correo comprobado)', await esperar(p, () => [...document.querySelectorAll('form b')].some(b => /Contraseña nueva/.test(b.textContent)) && /ana@tienda\.co/.test(document.body.innerText), null, 15000));
    chk('…y el permiso del enlace se borra de la dirección', !/access_token/.test(p.url()), p.url());
    chk('…sin volver a pedir el correo: solo la contraseña dos veces, cada una con 👁 para verla', await p.evaluate(() => { const f = [...document.querySelectorAll('form')].find(f => f.a && f.b);
      return !!f && !f.querySelector('input[type="email"]') && f.querySelectorAll('.ojo-clave').length === 2; }));
    await p.evaluate(() => { const f = [...document.querySelectorAll('form')].find(f => f.a && f.b); f.a.value = 'nueva456'; f.querySelector('.ojo-clave').click(); });
    chk('…y el 👁 deja ver lo que se escribe (y 🙈 lo vuelve a tapar)', await p.evaluate(() => { const f = [...document.querySelectorAll('form')].find(f => f.a && f.b); const ok1 = f.a.type === 'text'; f.querySelector('.ojo-clave').click(); return ok1 && f.a.type === 'password'; }));
    await p.evaluate(() => { const f = [...document.querySelectorAll('form')].find(f => f.a && f.b); f.a.value = 'nueva456'; f.b.value = 'otra999'; f.requestSubmit(); });
    chk('…si las dos no son iguales, lo dice y no cambia nada', await esperar(p, () => [...document.querySelectorAll('form .auth-err')].some(e => /no son iguales/.test(e.textContent)), null, 5000));
    await p.evaluate(() => { const f = [...document.querySelectorAll('form')].find(f => f.a && f.b); f.a.value = 'nueva456'; f.b.value = 'nueva456'; f.requestSubmit(); });
    chk('La contraseña nueva queda en la cuenta (se entra con ella y no con la vieja)', await (async () => { for(let i = 0; i < 20; i++){ if((await entrar('ana@tienda.co', 'nueva456')).st === 200) return (await entrar('ana@tienda.co', 'vieja123')).st >= 400; await p.waitForTimeout(400); } return false; })());
    // Y en la app se entra con la contraseña nueva (celular nuevo: vuelven los datos de la cuenta)
    await p.goto(BASE + '/index.html'); await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await p.click('#authTabs [data-tab="entrar"]');
    await p.fill('#authUser', 'ana@tienda.co'); await p.fill('#authPass', 'nueva456'); await p.click('#authBtn');
    chk('En la app se entra con el correo y la contraseña nueva', await esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000), await p.textContent('#authErr').catch(() => ''));

    // Enlace del código (?recuperar=correo) abierto en un celular sin esa cuenta: igual solo pide la contraseña
    const E = await celular(), e2 = E.p;
    const tokE = (await entrar('ana@tienda.co', 'nueva456')).j.access_token;
    await e2.goto(BASE + '/?recuperar=' + encodeURIComponent('ana@tienda.co') + '#access_token=' + tokE + '&refresh_token=x&expires_in=3600&token_type=bearer&type=magiclink');
    chk('Enlace «?recuperar=correo» en un celular sin la cuenta: pide solo la contraseña nueva (no «Abrir en la app»)', await esperar(e2, () => [...document.querySelectorAll('form b')].some(b => /Contraseña nueva/.test(b.textContent)) && !/Abrir en la app/.test(document.body.innerText), null, 15000));
    await e2.evaluate(() => { const f = [...document.querySelectorAll('form')].find(f => f.a && f.b); f.a.value = 'tercera789'; f.b.value = 'tercera789'; f.requestSubmit(); });
    chk('…la cambia en la cuenta y deja el correo listo para entrar', await (async () => { for(let i = 0; i < 20; i++){ if((await entrar('ana@tienda.co', 'tercera789')).st === 200) return true; await e2.waitForTimeout(400); } return false; })() && await e2.evaluate(() => document.getElementById('authUser').value === 'ana@tienda.co'));
    await E.ctx.close();
    chk('La pantalla de entrada y la de recuperar también tienen 👁', await p.evaluate(() => ['authPass', 'recNew', 'recNew2'].every(id => { const x = document.getElementById(id); return x && x.parentNode.querySelector('.ojo-clave'); })));

    // Enlace vencido o ya usado
    const B = await celular(), q = B.p;
    await q.goto(BASE + '/?nubeclave=1#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    chk('Enlace vencido: «El enlace no sirvió» y pedir otro (no queda en blanco)', await esperar(q, () => /El enlace no sirvió/.test(document.body.innerText), null, 10000));
    await q.goto(BASE + '/?nubeclave=1#access_token=no-sirve&type=recovery');
    chk('Enlace con un permiso falso: también «El enlace no sirvió»', await esperar(q, () => /El enlace no sirvió/.test(document.body.innerText), null, 10000));
    await B.ctx.close();

    // ===== Panel de administrador =====
    const adm = await sb.usuario(ADMIN, 'Clave-Admin-99');
    await fetch(sb.url + '/functions/v1/vento-suscripciones/admin/yo', { method: 'POST', headers: cab(adm.token), body: '{}' });
    const C = await celular(), a = C.p;
    await a.goto(BASE + '/admin.html');
    await a.waitForSelector('#lkOlvide', { state: 'visible', timeout: 15000 });
    await a.click('#lkOlvide'); await a.fill('#lkOCorreo', ADMIN); await a.click('#lkOEnviar');
    await esperar(a, () => /correo/.test(document.getElementById('lkMsg').textContent), null, 10000);
    const r2 = ultima();
    chk('Administrador: el correo vuelve al panel («admin.html?adminclave=1»)', r2.ruta === '/otp' && r2.email === ADMIN && r2.volver === BASE + '/admin.html?adminclave=1', r2);
    const t2 = (await entrar(ADMIN, 'Clave-Admin-99')).j;
    await a.goto(BASE + '/admin.html?adminclave=1#access_token=' + t2.access_token + '&refresh_token=' + t2.refresh_token + '&expires_in=3600&token_type=bearer&type=magiclink');
    chk('Al abrir el enlace, el panel pide la contraseña nueva', await esperar(a, () => { const x = document.getElementById('lkOEnlace'); return x && !x.hidden; }, null, 15000) && !/access_token/.test(a.url()));
    chk('…sin volver a pedir el correo del administrador: solo la contraseña dos veces, con 👁', await a.evaluate(() => document.getElementById('lkOlvBox').hidden && document.getElementById('lkEntrar').hidden &&
      !document.getElementById('lkOEClave2').closest('[hidden]') && document.querySelectorAll('#lkOEnlace .ojo').length === 2));
    await a.fill('#lkOEClave', 'Admin-Nueva-2026'); await a.fill('#lkOEClave2', 'Admin-Otra-2026'); await a.click('#lkOEGo');
    chk('…si no son iguales, lo dice', await esperar(a, () => /no son iguales/.test(document.getElementById('lkMsg').textContent), null, 5000));
    await a.click('#lkOEnlace .ojo');
    chk('…el 👁 deja ver la contraseña', await a.evaluate(() => document.getElementById('lkOEClave').type === 'text'));
    await a.fill('#lkOEClave2', 'Admin-Nueva-2026'); await a.click('#lkOEGo');
    chk('…la guarda y entra al panel', await esperar(a, () => document.getElementById('lock').hidden, null, 15000) && (await entrar(ADMIN, 'Admin-Nueva-2026')).st === 200);
    await a.goto(BASE + '/admin.html?adminclave=1#error=access_denied&error_code=otp_expired');
    await a.evaluate(() => { try{ localStorage.clear(); }catch(e){} }); await a.reload();
    await a.goto(BASE + '/admin.html?adminclave=1#error=access_denied&error_code=otp_expired');
    chk('Panel con el enlace vencido: lo dice y deja pedir otro', await esperar(a, () => /ya se usó o venció/.test(document.getElementById('lkMsg').textContent) && !document.getElementById('lkOlvBox').hidden, null, 10000));
    await C.ctx.close();

    // ===== 404.html =====
    const D = await celular(), d = D.p;
    const urls = []; d.on('framenavigated', f => { if(f === d.mainFrame()) urls.push(f.url()); });
    await d.goto(BASE + '/404.html?recuperar=ana#x=1');
    await d.waitForTimeout(1500);
    chk('404.html vuelve a la app con lo que traía el enlace', urls.some(u => { const x = new URL(u); return x.pathname === '/' && x.search === '?recuperar=ana'; }), urls);
    const html = fs.readFileSync(require('path').join(__dirname, '..', '404.html'), 'utf8');
    chk('404.html del sitio: …/cuentas/lo-que-sea → …/cuentas/ (y lo del panel → admin.html)', /location\.replace\(dest \+ location\.search \+ location\.hash\)/.test(html) && /admin\.html/.test(html));
    await D.ctx.close(); await A.ctx.close();

    // ===== El flujo del servidor deja la dirección del sitio siempre en Vento =====
    const wf = fs.readFileSync(require('path').join(__dirname, '..', '.github', 'workflows', 'servidor-vento.yml'), 'utf8');
    chk('«Servidor Vento» pone la dirección del sitio de Supabase siempre en Vento (no solo si estaba vacía)', /\{uri_allow_list:\$l, site_url:\$s\}/.test(wf) && /admin\.html/.test(wf));
  }
})();
