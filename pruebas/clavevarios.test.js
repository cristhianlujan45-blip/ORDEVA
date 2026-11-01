// 🔑 ORDEVA 1.72.4 · «Pongo la misma contraseña en otros equipos y no funciona; la cambio, funciona una vez y después deja
// de funcionar». Contra el «Supabase local» REAL (PostgreSQL + canal en vivo).
//  1. A y B entran con la misma cuenta. A cambia la contraseña (Ajustes → Usuarios → 🔑): B sale y pide la nueva.
//  2. B entra con la nueva y SIGUE adentro: al revisar la contraseña otra vez, al recargar la app y al pasar el tiempo.
//  3. B cierra sesión y vuelve a entrar con la nueva: entra (también una tercera vez).
//  4. Un equipo nuevo C entra con la nueva; la vieja ya no sirve en ningún lado.
//  5. A (el que la cambió) recarga y sigue adentro.
//  6. (1.72.4) ORDEVA Admin pone la contraseña con «pedir una propia»: escribir la MISMA ya no traba la ventana, y
//     «Seguir con la que acabo de usar» deja esa en todos los equipos.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){ const o = console[k].bind(console); console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; o(...a); }; }
(async () => {
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 200 }).then(() => true, () => false);
  async function equipo(nombre){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb, { enVivo: true });
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ').replace(/https?:\/\/[^/]+\//g, '')));
    p.on('dialog', d => d.accept(p.__clave || ''));
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    return { ctx, p };
  }
  // Con resguardo: mientras la página se recarga, la pantalla de entrada todavía no existe.
  const adentro = p => p.evaluate(() => { const o = document.getElementById('authOverlay'); return !!o && o.hidden && typeof authUser !== 'undefined' && !!authUser; });
  const dentro = p => esperar(p, () => { const o = document.getElementById('authOverlay'); return !!o && o.hidden && typeof authUser !== 'undefined' && !!authUser; }, null, 20000);
  const fuera = (p, ms) => esperar(p, () => { const o = document.getElementById('authOverlay'); return !!o && !o.hidden && !!document.getElementById('authUser'); }, null, ms || 20000);
  const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
  const entrar = async (p, clave) => {
    await p.waitForSelector('#authUser', { timeout: 15000 }).catch(() => {});
    await p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await p.fill('#authUser', CORREO); await p.fill('#authPass', clave); await p.click('#authBtn');
    const r = await dentro(p); if(r) await cerrarTodo(p);
    return r || (await p.evaluate(() => document.getElementById('authErr').textContent));
  };
  // Lo que hace el equipo solo: revisar si la contraseña cambió (al volver a la app, con el aviso en vivo, cada 3 min).
  const revisar = p => p.evaluate(() => window.dispatchEvent(new Event('vento-aviso-vivo')));
  const CORREO = 'dueno@clave.co';
  try{
    const A = await equipo('A');
    await A.p.fill('#authBiz', 'Bar Clave'); await A.p.fill('#authUser', CORREO); await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    await dentro(A.p); await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(A.p);
    await esperar(A.p, () => !!window.ventoNube.negocio(), null, 10000);
    const B = await equipo('B');
    chk('0. B entra con la contraseña de la cuenta', (await entrar(B.p, 'clave123')) === true);
    await pausa(5000);
    // ===== 1 =====
    A.p.__clave = 'nueva456';
    await A.p.evaluate(() => { document.querySelector('nav button[data-view="ajustes"]').click(); try{ accUsuariosPintar(); }catch(e){} });
    await A.p.waitForTimeout(500);
    const pw = await A.p.evaluate(() => { const b = [...document.querySelectorAll('button[title="Poner contraseña nueva"]')].find(x => x.closest('div') && x.closest('div').textContent.includes('dueno@clave.co')); if(b){ b.click(); return true; } return false; });
    await pausa(3000);
    chk('1. A cambia la contraseña en Ajustes → Usuarios (🔑)', pw, pw);
    await revisar(B.p);
    chk('1. B sale y pide la contraseña nueva', await fuera(B.p, 20000));
    // ===== 2 =====
    let r = await entrar(B.p, 'nueva456');
    chk('2. B entra con la nueva', r === true, r);
    await pausa(1500); await revisar(B.p); await pausa(4000);
    chk('2. …y sigue adentro después de revisar la contraseña', await adentro(B.p));
    await B.p.reload(); await pausa(6000); await revisar(B.p); await pausa(4000);
    chk('2. …y sigue adentro al recargar la app', await adentro(B.p));
    await B.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await pausa(35000); await revisar(B.p); await pausa(4000);
    chk('2. …y sigue adentro 40 s después', await adentro(B.p));
    // ===== 3 =====
    for(const vez of [1, 2]){
      await B.p.evaluate(() => window.ventoSalir()); await fuera(B.p, 15000); await pausa(1000);
      r = await entrar(B.p, 'nueva456');
      chk('3. B cierra sesión y vuelve a entrar con la nueva (vez ' + vez + ')', r === true, r);
      await pausa(1500); await revisar(B.p); await pausa(4000);
      chk('3. …y sigue adentro (vez ' + vez + ')', await adentro(B.p));
    }
    // ===== 4 =====
    const C = await equipo('C');
    r = await entrar(C.p, 'clave123');
    chk('4. La vieja ya no sirve en un equipo nuevo', r !== true, r);
    r = await entrar(C.p, 'nueva456');
    chk('4. Un equipo nuevo C entra con la nueva', r === true, r);
    await pausa(1500); await revisar(C.p); await pausa(4000);
    chk('4. …y sigue adentro', await adentro(C.p));
    // ===== 5 =====
    await A.p.reload(); await pausa(6000); await revisar(A.p); await pausa(4000);
    chk('5. A (el que la cambió) recarga y sigue adentro', await adentro(A.p));
    // ===== 6 · (1.72.4) ORDEVA Admin le pone la contraseña marcando «pedirle que ponga una propia» =====
    // Antes: el primer equipo obligaba a cambiarla; si se escribía la MISMA, el servidor la rechazaba y la ventana quedaba
    // trabada; si se ponía otra, la que dio el administrador dejaba de servir en los demás equipos.
    const ponerAdmin = async clave => {
      const uid = (await sb.sql('select id from auth.users where email = $1', [CORREO]))[0].id;
      await sb.sql("update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 4)) where id = $1", [uid, clave]);
      await sb.sql('select public.srv_marcar_cambiar_clave($1, true)', [uid]);
      await sb.sql('update public.perfiles set clave_puesta_en = now() where usuario_id = $1', [uid]);
    };
    const ventana = p => esperar(p, () => !!document.getElementById('vcClaveOv'), null, 15000);
    await ponerAdmin('admin789x');
    await revisar(B.p); await fuera(B.p, 20000);
    r = await entrar(B.p, 'admin789x');
    chk('6. B entra con la que puso el administrador', r === true, r);
    chk('6. …y le pide poner una propia', await ventana(B.p));
    await B.p.fill('#vcCl1', 'admin789x'); await B.p.fill('#vcCl2', 'admin789x'); await B.p.click('#vcClOk');
    const cerro = await esperar(B.p, () => !document.getElementById('vcClaveOv'), null, 10000);
    chk('6. Escribe la MISMA: no se traba («sigues con la misma»)', cerro, await B.p.evaluate(() => (document.getElementById('vcClErr') || {}).textContent));
    r = await entrar(C.p, 'admin789x').catch(e => String(e));
    if(r !== true){ await C.p.evaluate(() => window.ventoSalir()).catch(() => {}); await fuera(C.p, 15000); r = await entrar(C.p, 'admin789x'); }
    chk('6. Otro equipo (C) entra con esa misma después', r === true, r);
    await pausa(3000);
    chk('6. …sin que le pida cambiarla otra vez', !(await C.p.evaluate(() => !!document.getElementById('vcClaveOv'))));
    // «Seguir con la que acabo de usar» (antes, C y B ya revisaron su contraseña una vez, como lo hacen solos al abrir)
    await revisar(C.p); await revisar(B.p); await pausa(3000);
    await ponerAdmin('otra4567x');
    await revisar(C.p); await fuera(C.p, 20000);
    r = await entrar(C.p, 'otra4567x');
    chk('6. Otra vez desde Admin: C entra y le pide poner una propia', r === true && await ventana(C.p), r);
    await C.p.click('#vcClIgual');
    chk('6. «Seguir con la que acabo de usar» cierra la ventana', await esperar(C.p, () => !document.getElementById('vcClaveOv'), null, 10000));
    await revisar(B.p); await fuera(B.p, 20000);
    r = await entrar(B.p, 'otra4567x');
    chk('6. …y esa misma sirve en B, sin pedir cambiarla', r === true && !(await B.p.evaluate(() => !!document.getElementById('vcClaveOv'))), r);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close(); try{ await sb.cerrar(); }catch(e){}
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
