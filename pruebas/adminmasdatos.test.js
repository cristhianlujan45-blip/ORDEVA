// ORDEVA Admin 1.72.4 (PostgreSQL REAL + Edge Function + supabase-js de verdad):
//  1. Entrar con Enter (una sola vez) y la contraseña se le pasa al administrador de contraseñas del equipo
//     («¿Guardar contraseña?»; en el celular la pone con la huella). Un cliente no la guarda (no entró).
//  2. Al volver a abrir sin sesión: el correo de la última vez ya está; con la contraseña guardada en el equipo entra solo.
//  3. La ficha de la cuenta: perfil (contraseña puesta, si debe cambiarla), «📊 Cómo va su negocio» (ventas de hoy y de 30
//     días, cuentas abiertas, productos), «🐞 Errores de sus equipos», y que la contraseña no se puede ver.
//  4. El error: modelo del celular, desde cuándo, y «👤 Ver la cuenta» abre la cuenta de quien lo tuvo.
//  5. «✏️ Ponerle una contraseña» a su propia cuenta de cliente (+cliente): la casilla «pedirle que la cambie» va sin marcar.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){ if(process.env.VENTO_PG_URL || fs.existsSync('/usr/lib/postgresql')) return true; return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0; }
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const orig = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); }; }
const ADMIN = 'cristhianwkh@gmail.com', CLAVE_ADMIN = 'Clave-de-prueba-77';
(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (sin PostgreSQL: se omitió)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0;
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally{ await b.close().catch(() => {}); await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const cab = tok => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
    const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
    await sb.usuario(ADMIN, CLAVE_ADMIN);
    const dueno = await sb.usuario('cristhianwkh+cliente@gmail.com', 'clave123');
    const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Las Palmas', p_datos: {} }, dueno.token)).j;
    await rpc('guardar_datos', { p_negocio: NEG, p_datos: { businessName: 'Bar Las Palmas', businessType: 'bar', products: [{ id: 'a', name: 'Águila', price: 3500 }],
      tables: { 1: { items: [{ name: 'Águila', qty: 2, price: 3500 }] } }, history: [{ id: 'v1', total: 7000, date: new Date().toISOString() }] }, p_version: 1 }, dueno.token);
    await sb.sql("insert into app_errores(huella, tipo, mensaje, equipo, negocio, negocio_id, usuario, usuario_id, version, plataforma, modelo, veces, primero, ultimo) values ('h-adm', 'js', 'Cannot read properties of null', 'eq-9', 'Bar Las Palmas', $1, 'cristhianwkh+cliente@gmail.com', $2, '1.72.4', 'apk', 'Samsung A15', 4, now() - interval '1 day', now())", [NEG, dueno.id]);

    // Contraseñas guardadas del equipo, simuladas (Chrome / Android): lo que se guarda y lo que se devuelve.
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => {
      window.PasswordCredential = function(o){ this.type = 'password'; this.id = o.id; this.password = o.password; this.name = o.name; };
      const guardadas = JSON.parse(localStorage.getItem('__cred') || '[]');
      Object.defineProperty(navigator, 'credentials', { configurable: true, value: {
        store: async c => { window.__guardadas = (window.__guardadas || 0) + 1; localStorage.setItem('__cred', JSON.stringify([{ id: c.id, password: c.password }])); return c; },
        get: async o => { if(!(o && o.password)) return null; const g = JSON.parse(localStorage.getItem('__cred') || '[]')[0]; window.__pedidas = (window.__pedidas || 0) + 1; return g ? Object.assign(new window.PasswordCredential(g)) : null; } } });
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    const esperar = (fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 12000 }).then(() => true, () => false);
    let logins = 0; await p.route('**/auth/v1/token?grant_type=password', rt => { logins++; return rt.fallback(); });

    // ===== 1 =====
    await p.goto(BASE + '/admin.html');
    await esperar(() => !document.getElementById('lock').hidden && !document.getElementById('lkEntrar').hidden);
    chk('1. La entrada es un formulario (usuario y contraseña con su autocompletar)', await p.evaluate(() => { const f = document.getElementById('lkForm'); return !!f && f.contains(document.getElementById('lkClave')) && document.getElementById('lkClave').autocomplete === 'current-password' && document.getElementById('lkGo').type === 'submit'; }));
    await p.fill('#lkCorreo', 'cristhianwkh+cliente@gmail.com'); await p.fill('#lkClave', 'clave123'); await p.press('#lkClave', 'Enter');
    await esperar(() => /no es administradora/.test(document.getElementById('lkMsg').textContent));
    chk('1. Un cliente no entra y su contraseña NO se guarda en el equipo', !(await p.evaluate(() => window.__guardadas || 0)));
    logins = 0;
    await p.fill('#lkCorreo', ADMIN); await p.fill('#lkClave', CLAVE_ADMIN); await p.press('#lkClave', 'Enter');
    chk('1. Enter en la contraseña entra al panel', await esperar(() => document.getElementById('lock').hidden, null, 15000));
    chk('1. …una sola vez (no dos inicios de sesión)', logins === 1, logins);
    chk('1. …y la contraseña se le pasa al equipo para guardarla («¿Guardar contraseña?»)', (await p.evaluate(() => window.__guardadas || 0)) === 1);
    // ===== 2 =====
    await p.evaluate(() => { Object.keys(localStorage).filter(k => /^vento-admin-nube|auth-token|^sb-/i.test(k)).forEach(k => localStorage.removeItem(k)); });
    await p.reload();
    chk('2. Sin sesión, con la contraseña guardada en el equipo: entra solo', await esperar(() => document.getElementById('lock').hidden, null, 15000));
    chk('2. …(la pidió al equipo una vez)', (await p.evaluate(() => window.__pedidas || 0)) >= 1);
    await p.evaluate(() => { localStorage.removeItem('__cred'); Object.keys(localStorage).filter(k => /^vento-admin-nube|auth-token|^sb-/i.test(k)).forEach(k => localStorage.removeItem(k)); });
    await p.reload(); await esperar(() => !document.getElementById('lock').hidden);
    chk('2. Sin contraseña guardada: el correo de la última vez ya está escrito', (await p.inputValue('#lkCorreo')) === ADMIN);
    await p.fill('#lkClave', CLAVE_ADMIN); await p.click('#lkGo'); await esperar(() => document.getElementById('lock').hidden, null, 15000);
    // ===== 3 =====
    await p.evaluate(() => document.querySelector('button[data-t="usuarios"]').click());
    await esperar(id => !!document.querySelector('[data-us="' + id + '"]'), dueno.id, 15000);
    await p.evaluate(id => document.querySelector('[data-us="' + id + '"]').click(), dueno.id);
    await esperar(() => /Cómo va su negocio/.test(document.getElementById('usCuerpo').innerText), null, 15000);
    let t = await p.evaluate(() => document.getElementById('usCuerpo').innerText);
    chk('3. Ficha: contraseña puesta y si debe cambiarla', /Contraseña puesta/.test(t) && /Debe cambiarla al entrar/.test(t), t.slice(0, 600));
    chk('3. «📊 Cómo va su negocio»: ventas de hoy 1 · $7.000, cuentas abiertas 1, productos 1', /Ventas de hoy\s*1 · \$7\.000/.test(t) && /Cuentas abiertas\s*1/.test(t) && /Productos\s*1/.test(t), t.slice(0, 900));
    chk('3. «🐞 Errores de sus equipos» con el modelo del celular', /Errores de sus equipos \(1\)/.test(t) && /Samsung A15/.test(t), t.slice(0, 900));
    chk('3. Dice que la contraseña no se puede ver (y cómo darle una)', /La contraseña no se puede ver/.test(t) && /Ponerle una contraseña/.test(t));
    // ===== 4 =====
    await p.click('#usCuerpo [data-error="h-adm"]');
    await esperar(() => document.getElementById('dlgEr').open, null, 15000);
    t = await p.evaluate(() => document.getElementById('erInfo').innerText);
    chk('4. El error: modelo y desde cuándo', /Samsung A15/.test(t) && /desde /.test(t), t.slice(0, 600));
    await p.click('#erInfo [data-ver-cuenta]');
    chk('4. «👤 Ver la cuenta» abre la cuenta de quien lo tuvo', await esperar(id => document.getElementById('dlgUs').open && /cristhianwkh\+cliente/.test(document.getElementById('usTit').textContent), dueno.id, 15000));
    // ===== 5 =====
    await esperar(() => /Cómo va su negocio/.test(document.getElementById('usCuerpo').innerText), null, 15000);
    await p.click('#usCuerpo [data-ua="poner"]');
    chk('5. Su propia cuenta de cliente: «pedirle que la cambie» va sin marcar', await esperar(() => !!document.getElementById('upPedir') && document.getElementById('upPedir').checked === false));
    chk('Sin errores de página', !errs.length, errs);
  }
})();
