// 📧 ORDEVA 1.99.18 · «Que sea un correo que sí exista» (lib/vento-correo.js) — con la app real y el «Supabase local» REAL.
//  1. Error de dedo («juan@gmial.com»): no crea la cuenta, dice «¿Quisiste decir juan@gmail.com?» y un toque lo corrige.
//  2. Dominio que no existe (el DNS dice que no): no crea la cuenta.
//  3. Correo desechable (mailinator): no.
//  4. Correo con dominio real (el DNS dice que recibe correos): crea la cuenta y su negocio queda en la nube.
//  5. Al entrar con un correo con error de dedo y no encontrarlo: ofrece la corrección.
//  6. Con «el servidor ya manda correos» encendido (ORDEVA Admin): la cuenta se crea SOLO con el código que llega al correo; con un
//     código malo no; con el bueno sí, y después se entra con la contraseña que se escribió.
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
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 200 }).then(() => true, () => false);
    // DNS simulado: estos dominios reciben correo; los demás no existen.
    const REALES = ['empresa.co', 'tienda-real.com'];
    async function equipo(nombre, cfg){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => {
        const u = new URL(rt.request().url());
        if(u.hostname === 'dns.google' || u.hostname === 'cloudflare-dns.com'){
          const n = (u.searchParams.get('name') || '').toLowerCase(), t = u.searchParams.get('type');
          const real = REALES.includes(n);
          const body = real ? { Status: 0, Answer: t === 'MX' ? [{ name: n, type: 15, data: '10 mx.' + n + '.' }] : [{ name: n, type: 1, data: '1.2.3.4' }] } : { Status: 3 };
          return rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
        }
        return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort();
      });
      await enrutar(ctx, sb);
      await ctx.addInitScript(c => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); if(c) localStorage.setItem('vento-cfg', JSON.stringify(c)); }catch(e){} window.__ventoExigirCorreo = true; window.__ventoRevisarCorreo = true; }, cfg || null);
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      return { ctx, p };
    }
    const crear = async (p, correo, clave) => { await p.fill('#authBiz', 'Tienda Real'); await p.fill('#authUser', correo); await p.fill('#authPass', clave || 'clave-real-1'); await p.click('#authBtn'); };
    const err = p => p.evaluate(() => document.getElementById('authErr').textContent);
    const fuera = p => p.evaluate(() => !document.getElementById('authOverlay').hidden);
    const cuentaEnNube = async correo => !!(await sb.sql('select 1 from auth.users where lower(email) = lower($1)', [correo]))[0];

    const A = await equipo('A');
    await crear(A.p, 'juan@gmial.com');
    chk('1. «juan@gmial.com»: no crea la cuenta y pregunta «¿Quisiste decir juan@gmail.com?»', await esperar(A.p, () => /Quisiste decir juan@gmail\.com/.test(document.getElementById('authErr').textContent)) && await fuera(A.p) && !(await cuentaEnNube('juan@gmial.com')), await err(A.p));
    await A.p.click('#authErr button');
    chk('1. …y un toque lo corrige', await A.p.evaluate(() => document.getElementById('authUser').value === 'juan@gmail.com'));

    await crear(A.p, 'pepe@dominio-inventado-xyz.com');
    chk('2. Dominio que no existe: no crea la cuenta y lo dice', await esperar(A.p, () => /no existe o no recibe correos/.test(document.getElementById('authErr').textContent)) && await fuera(A.p) && !(await cuentaEnNube('pepe@dominio-inventado-xyz.com')), await err(A.p));

    await crear(A.p, 'pepe@mailinator.com');
    chk('3. Correo desechable: no', await esperar(A.p, () => /correo temporal/.test(document.getElementById('authErr').textContent)) && !(await cuentaEnNube('pepe@mailinator.com')), await err(A.p));

    await crear(A.p, 'dueno@empresa.co');
    chk('4. Correo con dominio real: crea la cuenta y entra', await esperar(A.p, () => document.getElementById('authOverlay').hidden, null, 20000) && await esperar(A.p, () => !!window.ventoNube.negocio(), null, 20000) && await cuentaEnNube('dueno@empresa.co'), await err(A.p));
    await A.ctx.close();

    // 5. Entrar con error de dedo
    const E = await equipo('E');
    await E.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await E.p.fill('#authUser', 'dueno@hotmial.com'); await E.p.fill('#authPass', 'clave-real-1'); await E.p.click('#authBtn');
    chk('5. Al entrar con «dueno@hotmial.com» ofrece «Usar dueno@hotmail.com»', await esperar(E.p, () => /Usar dueno@hotmail\.com/.test(document.getElementById('authErr').textContent), null, 15000), await err(E.p));
    await E.ctx.close();

    // 6. Con código al correo
    const C = await equipo('C', { correos: true });
    await crear(C.p, 'nuevo@tienda-real.com', 'clave-nueva-1');
    chk('6. Con «el servidor ya manda correos», pide el código que llegó al correo', await esperar(C.p, () => document.querySelector('#promptOverlay.show') && /código/i.test(document.getElementById('promptTitle').textContent), null, 15000));
    await C.p.fill('#promptInput', '000000'); await C.p.click('#promptOkBtn');
    chk('6. Con un código malo no crea la cuenta y lo vuelve a pedir (sin mandar otro correo)', await esperar(C.p, () => document.querySelector('#promptOverlay.show') && /no es correcto/.test(document.getElementById('promptMessage').textContent), null, 15000) && await fuera(C.p) && sb.recuperaciones.filter(x => x.email === 'nuevo@tienda-real.com').length === 1, await err(C.p));
    const cod = (sb.recuperaciones.filter(x => x.email === 'nuevo@tienda-real.com' && x.codigo).pop() || {}).codigo;
    chk('6. (el código llegó al «correo»)', !!cod, JSON.stringify(sb.recuperaciones.slice(-3)));
    await C.p.fill('#promptInput', String(cod)); await C.p.click('#promptOkBtn');
    chk('6. Con el código bueno crea la cuenta, entra y su negocio queda en la nube', await esperar(C.p, () => document.getElementById('authOverlay').hidden, null, 20000) && await esperar(C.p, () => !!window.ventoNube.negocio(), null, 20000), await err(C.p));
    const confirmado = (await sb.sql('select email_confirmed_at from auth.users where email = $1', ['nuevo@tienda-real.com']))[0];
    chk('6. El correo queda confirmado en la nube', !!(confirmado && confirmado.email_confirmed_at));
    await C.ctx.close();
    // Otro celular: entra con la contraseña que se escribió al crearla
    const D = await equipo('D');
    await D.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await D.p.fill('#authUser', 'nuevo@tienda-real.com'); await D.p.fill('#authPass', 'clave-nueva-1'); await D.p.click('#authBtn');
    chk('6. En otro celular entra con la contraseña de esa cuenta', await esperar(D.p, () => document.getElementById('authOverlay').hidden, null, 20000), await err(D.p));
    await D.ctx.close();
  }
})();
