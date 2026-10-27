// Usuarios del equipo creados solo con un nombre («juan»), en TODOS los equipos del negocio (ORDEVA 1.60.0),
// con la app real y el «Supabase local» REAL:
//  1. El dueño crea a «juan» en un celular → llega al servidor (huella, no la contraseña).
//  2. Otro celular del mismo negocio lo recibe y juan entra ahí con su contraseña (en modo equipo, no de dueño).
//  3. El dueño le cambia la contraseña en el primero → en el otro, juan (que estaba adentro) sale con el aviso, la vieja
//     ya no sirve y la nueva sí.
//  4. El dueño lo quita → en el otro también desaparece (y sale si estaba adentro).
//  5. Los datos del negocio no se tocan en nada de esto.
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
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    // Si la página se recarga justo mientras se espera (al sacar la sesión), lo de adentro todavía no existe: se sigue esperando.
    const esperar = (p, fn, arg, ms) => p.waitForFunction(([f, a]) => { try{ return (0, eval)('(' + f + ')')(a); }catch(e){ return false; } }, [String(fn), arg], { timeout: ms || 12000, polling: 250 }).then(() => true, () => false);
    const uno = async (q, pr) => (await sb.sql(q, pr))[0];
    async function equipo(nombre){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta && window.ventoUsuariosEquipo, null, { timeout: 15000 });
      return { ctx, p };
    }
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    const afuera = p => esperar(p, () => !document.getElementById('authOverlay').hidden, null, 20000);
    const sinc = p => p.evaluate(() => window.ventoUsuariosEquipo.sincronizar());
    const usuarios = p => p.evaluate(() => JSON.parse(localStorage.getItem('cm-users') || '[]').map(u => u.user + ':' + (u.role || '')));
    const entrar = async (p, u, c) => { await p.fill('#authUser', u); await p.fill('#authPass', c); await p.click('#authBtn'); };
    const salir = async p => { await p.evaluate(() => { try{ saveData(); }catch(e){} localStorage.removeItem('cm-session'); }); await p.reload(); await p.waitForSelector('#authOverlay:not([hidden])'); await p.waitForFunction(() => window.ventoUsuariosEquipo, null, { timeout: 15000 }); };
    const filaJuan = (p, sel) => p.evaluate(s => { const r = [...document.querySelectorAll('#accUsersList .acc-user')].find(x => /^juan/.test(x.querySelector('b').textContent)); const bt = r && [...r.querySelectorAll('button')].find(x => x.textContent.trim() === s); if(bt) bt.click(); return !!bt; }, sel);

    // ===== 1. El dueño crea a «juan» en el primer celular =====
    const A = await equipo('celular del dueño');
    await A.p.fill('#authBiz', 'Bar Equipo'); await entrar(A.p, 'dueno@equipo.co', 'clave-dueno-1');
    chk('El dueño crea su cuenta y queda conectado', await dentro(A.p) && await esperar(A.p, () => !!window.ventoNube.negocio(), null, 15000));
    const NEG = (await uno("select n.id from negocios n join miembros m on m.negocio_id = n.id join auth.users u on u.id = m.usuario_id where u.email = 'dueno@equipo.co'")).id;
    await A.p.evaluate(() => { document.getElementById('accNewUser').value = 'Juan'; document.getElementById('accNewPass').value = 'juan-clave-1'; document.getElementById('accNewRole').value = 'staff'; document.getElementById('accAddBtn').click(); });
    chk('1. Agrega a «juan» (mesero) en Ajustes', await esperar(A.p, () => JSON.parse(localStorage.getItem('cm-users') || '[]').some(u => u.user === 'juan' && u.role === 'staff')));
    await sinc(A.p);
    const fila = await uno('select * from usuarios_equipo where negocio_id = $1 and usuario = $2', [NEG, 'juan']);
    chk('1. «juan» llega al servidor con la huella (PBKDF2), no con la contraseña', fila && /^p2:[0-9a-f]{64}$/.test(fila.hash) && fila.rol === 'staff' && !JSON.stringify(fila).includes('juan-clave-1'), fila);
    const yaEstaba = (await uno('select count(*)::int n from usuarios_equipo where negocio_id = $1 and usuario = $2', [NEG, 'dueno@equipo.co'])).n;
    chk('1. La cuenta con correo del dueño no se guarda ahí (esa ya es la misma en todos)', yaEstaba === 0);
    const datosAntes = (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos;

    // ===== 2. Otro celular del mismo negocio =====
    const B = await equipo('celular de la barra');
    await B.p.click('#authTabs [data-tab="entrar"]');
    await entrar(B.p, 'dueno@equipo.co', 'clave-dueno-1');
    chk('2. El dueño entra en otro celular con su cuenta', await dentro(B.p) && await esperar(B.p, () => !!window.ventoNube.negocio(), null, 15000));
    await sinc(B.p);
    chk('2. «juan» aparece solo en ese celular', (await usuarios(B.p)).includes('juan:staff'), await usuarios(B.p));
    chk('2. …y en la lista de usuarios de Ajustes', await esperar(B.p, () => [...document.querySelectorAll('#accUsersList .acc-user b')].some(x => x.textContent === 'juan')));
    await salir(B.p);
    await entrar(B.p, 'juan', 'juan-clave-1');
    chk('2. Juan entra en el otro celular con SU contraseña', await dentro(B.p));
    chk('2. …como equipo (no como dueño)', await esperar(B.p, () => document.body.classList.contains('modo-mesero')));

    // ===== 2b. 1.62.0: el PIN que el dueño le pone en un celular sirve en el otro =====
    A.p.once('dialog', d => d.accept('1357'));
    await A.p.evaluate(() => { const b = document.querySelector('nav button[data-view="ajustes"]'); if(b) b.click(); try{ accUsuariosPintar(); }catch(e){} });
    chk('2b. El dueño le pone PIN a juan (🔢) en el primer celular', await filaJuan(A.p, '🔢') && await A.p.waitForFunction(() => { const u = JSON.parse(localStorage.getItem('cm-users')).find(x => x.user === 'juan'); return !!(u && u.pin); }, null, { timeout: 8000 }).then(() => true, () => false));
    await sinc(A.p);
    chk('2b. Llega al servidor (su huella, no el PIN)', await (async () => { const f = await uno('select pin from usuarios_equipo where negocio_id = $1 and usuario = $2', [NEG, 'juan']); return !!(f && f.pin && f.pin.h) && !JSON.stringify(f).includes('1357'); })());
    await B.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));
    chk('2b. El otro celular lo recibe, y juan (que estaba adentro) sigue adentro', await B.p.waitForFunction(() => { const u = JSON.parse(localStorage.getItem('cm-users')).find(x => x.user === 'juan'); return !!(u && u.pin && u.pin.h); }, null, { timeout: 10000 }).then(() => true, () => false) &&
      await B.p.evaluate(() => document.getElementById('authOverlay').hidden));
    await salir(B.p);
    await entrar(B.p, 'juan', '1357');
    chk('2b. Juan entra en el otro celular con su PIN', await dentro(B.p));

    // ===== 3. El dueño le cambia la contraseña en el primero =====
    A.p.once('dialog', d => d.accept('juan-clave-2'));
    await A.p.evaluate(() => { const b = document.querySelector('nav button[data-view="ajustes"]'); if(b) b.click(); try{ accUsuariosPintar(); }catch(e){} });
    chk('3. El dueño toca 🔑 en la fila de juan', await filaJuan(A.p, '🔑'));
    await esperar(A.p, () => /Contraseña de juan cambiada/.test(document.body.innerText), null, 8000);
    await sinc(A.p);
    chk('3. El cambio llega al servidor (versión 3: 1 crear, 2 el PIN, 3 la contraseña)', (await uno('select version from usuarios_equipo where negocio_id = $1 and usuario = $2', [NEG, 'juan'])).version === 3);
    await B.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));   // aquí no hay tiempo real: el aviso se simula
    chk('3. En el otro celular, juan (que estaba adentro) sale con el aviso', await afuera(B.p) && await esperar(B.p, () => /cambió la contraseña a juan/.test(document.getElementById('authErr').textContent)), await B.p.textContent('#authErr').catch(() => ''));
    await entrar(B.p, 'juan', 'juan-clave-1');
    chk('3. La contraseña vieja ya no entra', await esperar(B.p, () => /incorrectos/.test(document.getElementById('authErr').textContent) && !document.getElementById('authBtn').disabled, null, 15000), await B.p.textContent('#authErr'));
    await entrar(B.p, 'juan', 'juan-clave-2');
    chk('3. Entra con la nueva', await dentro(B.p));

    // ===== 4. El dueño lo quita =====
    await A.p.evaluate(() => { try{ accUsuariosPintar(); }catch(e){} });
    chk('4. El dueño toca «Quitar» en la fila de juan', await filaJuan(A.p, 'Quitar'));
    await A.p.click('#confirmOkBtn');
    await esperar(A.p, () => !JSON.parse(localStorage.getItem('cm-users') || '[]').some(u => u.user === 'juan'));
    await sinc(A.p);
    chk('4. En el servidor queda la marca «borrado» (no se pierde el registro)', (await uno('select borrado, hash from usuarios_equipo where negocio_id = $1 and usuario = $2', [NEG, 'juan'])).borrado === true);
    await B.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));
    chk('4. En el otro celular juan sale con el aviso', await afuera(B.p) && await esperar(B.p, () => /quitó el usuario juan/.test(document.getElementById('authErr').textContent)), await B.p.textContent('#authErr').catch(() => ''));
    chk('4. …y ya no está en ese celular', !(await usuarios(B.p)).some(x => /^juan:/.test(x)), await usuarios(B.p));
    await entrar(B.p, 'juan', 'juan-clave-2');
    chk('4. Ya no puede entrar', await esperar(B.p, () => /incorrectos|no existe|no encontr/i.test(document.getElementById('authErr').textContent) && !document.getElementById('authBtn').disabled, null, 15000) && !(await B.p.evaluate(() => document.getElementById('authOverlay').hidden)), await B.p.textContent('#authErr'));
    await entrar(B.p, 'dueno@equipo.co', 'clave-dueno-1');
    chk('4. El dueño sigue entrando en ese celular', await dentro(B.p));

    // ===== 5. Los datos del negocio no cambiaron por los usuarios =====
    const datosDespues = (await uno('select datos from datos_negocio where negocio_id = $1', [NEG])).datos;
    chk('5. Los productos y el nombre del negocio siguen iguales', JSON.stringify(datosDespues.products) === JSON.stringify(datosAntes.products) && datosDespues.businessName === datosAntes.businessName);
    chk('5. Los datos del negocio no llevan usuarios ni contraseñas', !/juan-clave|p2:[0-9a-f]{64}/.test(JSON.stringify(datosDespues).replace(/"clave":\{[^}]*\}/g, '')));
    await A.ctx.close(); await B.ctx.close();
  }
})();
