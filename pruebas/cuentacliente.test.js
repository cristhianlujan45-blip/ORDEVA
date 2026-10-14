// La app del negocio conectada con Vento Admin (contra el «Supabase local» REAL):
//  1. Cada equipo avisa al servidor que existe (el administrador ve a todos los usuarios).
//  2. 🎧 Soporte dentro de la app: escribir, ver la respuesta del administrador (con aviso) y contestar.
//  3. Licencia del proveedor por link (#lic=…) y con el código en «Mi plan»: se activa en el negocio.
//  4. Contraseña temporal del soporte: al entrar con ella pide poner una propia.
//  5. Celular de la cuenta (Ajustes → Negocio) y recuperar la contraseña por mensaje de texto (desde la entrada).
//  6. El correo del administrador NO entra como cliente: se ofrece la cuenta de cliente (otra contraseña) y pasar
//     el negocio que tenía con ese correo, sin perder datos. La cuenta de cliente no puede tener la misma contraseña.
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
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const F = sb.url + '/functions/v1/vento-suscripciones';
    const cab = tok => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
    const api = async (ruta, cuerpo, tok) => { const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
    const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
    const entrar = async (email, clave) => { const r = await fetch(sb.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: cab(), body: JSON.stringify({ email, password: clave }) }); return { st: r.status, j: await r.json() }; };
    const uno = async (q, p) => (await sb.sql(q, p))[0];
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 12000, polling: 250 }).then(() => true, () => false);
    async function equipo(nombre, hash){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html' + (hash || ''));
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta && window.ventoCuenta, null, { timeout: 15000 });
      return { ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    const irAjustes = async (p, cat) => { await cerrarTodo(p); await p.evaluate(c => { const b = document.querySelector('nav button[data-view="ajustes"]') || document.querySelector('[data-go="ajustes"]'); if(b) b.click(); if(typeof showView === 'function') try{ showView('ajustes'); }catch(e){} setTimeout(() => { const x = document.querySelector('.ajustes-cat[data-cat="' + c + '"]'); if(x) x.click(); }, 200); }, cat); await p.waitForTimeout(600); };

    // El administrador (su cuenta) y una licencia compartida por link
    const adm = await sb.usuario(ADMIN, 'Clave-Admin-99');
    const lic = (await api('/admin/licencia_crear', { licencia: { plan: 'pro', dias: 60, usos_max: 1 } }, adm.token)).j.licencia;

    // ===== 1 y 3. Cliente nuevo que abre el link de su licencia =====
    const A = await equipo('cliente', '#lic=' + lic.codigo);
    await A.p.fill('#authBiz', 'Bar Soporte'); await A.p.fill('#authUser', 'dueno@soporte.co'); await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    chk('Cliente: crea su cuenta y entra', await dentro(A.p));
    await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(A.p);
    chk('Cliente: queda en la nube', await esperar(A.p, () => !!window.ventoNube.negocio(), null, 12000));
    const NEG = (await A.p.evaluate(() => window.ventoNube.negocio())).id;
    chk('1. Este equipo aparece en el servidor con su cuenta y su negocio', await (async () => { for(let i = 0; i < 30; i++){ const r = await uno("select count(*) n from instalaciones i join auth.users u on u.id = i.usuario_id where u.email = 'dueno@soporte.co' and i.negocio_id = $1", [NEG]); if(r.n === 1) return true; await new Promise(x => setTimeout(x, 500)); } return false; })());
    chk('3. La licencia del link se activa sola al entrar (PRO 60 días)', await esperar(A.p, () => window.ventoSuscripcion && window.ventoSuscripcion.planEfectivo() === 'pro', null, 20000) &&
      (await uno('select count(*) n from licencia_usos where negocio_id = $1', [NEG])).n === 1);
    chk('3. El link de la licencia se quita de la dirección', await A.p.evaluate(() => !/lic=/.test(location.hash)));
    chk('Aceptó la licencia de uso al crear la cuenta', await (async () => { for(let i = 0; i < 20; i++){ const r = await uno("select p.acepto_licencia from perfiles p join auth.users u on u.id = p.usuario_id where u.email = 'dueno@soporte.co'"); if(r && r.acepto_licencia) return true; await new Promise(x => setTimeout(x, 500)); } return false; })());
    // Código en Mi plan: una segunda licencia por código
    const lic2 = (await api('/admin/licencia_crear', { licencia: { plan: 'pro', dias: 30, usos_max: 1 } }, adm.token)).j.licencia;
    const r3 = await A.p.evaluate(c => window.ventoSuscripcion.canjear(c).then(r => ({ ok: true, hasta: r.hasta }), e => ({ ok: false, m: e.message })), lic2.codigo.toLowerCase());
    chk('3. «Tengo un código de licencia» en Mi plan: se activa con el código', r3.ok, r3);
    const r4 = await A.p.evaluate(c => window.ventoSuscripcion.canjear(c).then(() => ({ ok: true }), e => ({ ok: false, m: e.message })), lic2.codigo);
    chk('3. Un código ya usado: mensaje claro', !r4.ok && /ya se (activó|usó)/.test(r4.m), r4);
    await A.p.evaluate(() => window.ventoSuscripcion.abrirPlanes(''));
    chk('3. «Mi plan» tiene el botón «🔑 Tengo un código de licencia»', await esperar(A.p, () => !!document.getElementById('vsLicBtn')));
    await cerrarTodo(A.p);

    // ===== 2. Soporte =====
    await irAjustes(A.p, 'ayuda');
    chk('2. Ajustes → Guía y soporte: «🎧 Soporte de Vento»', await esperar(A.p, () => !!document.getElementById('vcSoporte') && document.getElementById('vcSoporte').offsetParent !== null));
    await A.p.click('#vcNuevo');
    await A.p.fill('#vcAsunto', 'No me imprime'); await A.p.fill('#vcMsg', 'Hola, no me imprime la cuenta de la mesa 3'); await A.p.fill('#vcTel', '3001112233');
    await A.p.click('#vcEnviar');
    chk('2. Mensaje enviado', await esperar(A.p, () => /Enviado/.test(document.getElementById('vcEstado').textContent)));
    const caso = await uno("select c.* from soporte_casos c join auth.users u on u.id = c.usuario_id where u.email = 'dueno@soporte.co'");
    chk('2. El caso llega al servidor con su cuenta, negocio y celular', caso && caso.asunto === 'No me imprime' && caso.negocio_id === NEG && caso.telefono === '3001112233', caso);
    await api('/admin/soporte_responder', { caso: caso.id, texto: 'Revisa que la impresora esté prendida y vuelve a intentar.' }, adm.token);
    await A.p.evaluate(() => window.ventoCuenta.soporte.revisar());
    chk('2. La respuesta llega con aviso y «1 nueva»', await esperar(A.p, () => /1 nueva/.test(document.getElementById('vcCasos').textContent) && !document.getElementById('vcBadge').hidden));
    await A.p.click('#vcCasos [data-vccaso]');
    chk('2. Al abrirla se ve la conversación', await esperar(A.p, () => document.getElementById('vcCasoOv').classList.contains('show') && /impresora esté prendida/.test(document.getElementById('vcHilo').textContent)));
    await A.p.fill('#vcResp', 'Ya funcionó, gracias'); await A.p.click('#vcResponder');
    chk('2. El cliente contesta (le llega al administrador)', await esperar(A.p, () => document.querySelectorAll('#vcHilo .vc-m.yo').length === 2) &&
      (await api('/admin/soporte', {}, adm.token)).j.casos.some(c => c.id === caso.id && c.estado === 'abierto' && c.mensajes.length === 3));
    chk('2. Ya no sale como nueva', await esperar(A.p, () => !/nueva/.test(document.getElementById('vcCasos').textContent)));
    await cerrarTodo(A.p);

    // ===== 5. Celular de la cuenta =====
    await irAjustes(A.p, 'negocio');
    chk('5. Ajustes → Negocio: «📱 Celular de la cuenta»', await esperar(A.p, () => !document.getElementById('vcPerfil').hidden));
    await A.p.fill('#vcPerfilTel', '300 111 2233'); await A.p.click('#vcPerfilOk');
    chk('5. Se guarda en el servidor', await (async () => { for(let i = 0; i < 20; i++){ const r = await uno("select p.telefono from perfiles p join auth.users u on u.id = p.usuario_id where u.email = 'dueno@soporte.co'"); if(r && r.telefono === '3001112233') return true; await new Promise(x => setTimeout(x, 300)); } return false; })());

    // ===== 4. Contraseña temporal =====
    const uid = (await uno("select id from auth.users where email = 'dueno@soporte.co'")).id;
    const temp = (await api('/admin/usuario_clave_temporal', { usuario: uid }, adm.token)).j.clave;
    const B = await equipo('otro celular');
    await B.p.click('#authNueva').catch(() => {});
    await B.p.evaluate(() => { const b = document.getElementById('authNueva'); if(b && /Ya tengo|Iniciar/.test(b.textContent)) b.click(); });
    await B.p.fill('#authUser', 'dueno@soporte.co'); await B.p.fill('#authPass', temp); await B.p.click('#authBtn');
    chk('4. Entra en otro celular con la contraseña temporal', await dentro(B.p));
    chk('4. Le pide poner su propia contraseña', await esperar(B.p, () => !!document.getElementById('vcClaveOv'), null, 15000));
    await B.p.fill('#vcCl1', 'mi-clave-nueva'); await B.p.fill('#vcCl2', 'mi-clave-nueva'); await B.p.click('#vcClOk');
    chk('4. Queda guardada (ya no la pide) y sirve para entrar', await esperar(B.p, () => !document.getElementById('vcClaveOv'), null, 10000) &&
      (await entrar('dueno@soporte.co', 'mi-clave-nueva')).st === 200 && (await entrar('dueno@soporte.co', temp)).st === 400);
    await B.ctx.close();

    // ===== 5. Recuperar por mensaje de texto (sin entrar) =====
    const C = await equipo('olvidó');
    await C.p.click('#authNueva').catch(() => {});
    await C.p.evaluate(() => { const b = document.getElementById('authNueva'); if(b && /Ya tengo|Iniciar/.test(b.textContent)) b.click(); });
    await C.p.fill('#authUser', 'dueno@soporte.co');
    await C.p.evaluate(() => { const f = document.getElementById('authForgot'); f.hidden = false; f.click(); });
    chk('5. «¿Olvidaste tu contraseña?» tiene «📱 Por mensaje de texto»', await esperar(C.p, () => !document.getElementById('recForm').hidden && !!document.getElementById('vcSmsBox')));
    await C.p.fill('#vcSmsTel', '3001112233'); await C.p.click('#vcSmsBtn');
    chk('5. Pide la contraseña por SMS: le llega al soporte de Vento', await esperar(C.p, () => /Listo/.test(document.getElementById('vcSmsTxt').textContent)) &&
      (await api('/admin/soporte', {}, adm.token)).j.casos.some(c => c.tipo === 'clave' && c.telefono === '3001112233' && c.email === 'dueno@soporte.co' && c.telefono_de_la_cuenta === '3001112233'));
    await C.ctx.close();

    // ===== 6. Correo del administrador en la app =====
    // El administrador tenía su negocio con su correo de administrador (antes de esta versión)
    const negAdm = (await rpc('crear_negocio', { p_nombre: 'Bar del Admin', p_datos: { products: [{ id: 'pa', name: 'Club Colombia Admin', price: 4000 }] } }, adm.token)).j;
    const D = await equipo('admin como cliente');
    await D.p.click('#authNueva').catch(() => {});
    await D.p.evaluate(() => { const b = document.getElementById('authNueva'); if(b && /Ya tengo|Iniciar/.test(b.textContent)) b.click(); });
    await D.p.fill('#authUser', ADMIN); await D.p.fill('#authPass', 'Clave-Admin-99'); await D.p.click('#authBtn');
    chk('6. Con el correo de administrador no entra como cliente: explica y ofrece la cuenta de cliente', await esperar(D.p, () => document.getElementById('vcAdmOv') && document.getElementById('vcAdmOv').classList.contains('show') && /cristhianwkh\+cliente@gmail\.com/.test(document.getElementById('vcAdmOv').textContent)) &&
      !(await D.p.evaluate(() => document.getElementById('authOverlay').hidden)));
    await D.p.click('#vcAdmPasar');
    await D.p.fill('#vcPaCl1', 'Clave-Admin-99'); await D.p.fill('#vcPaCl2', 'Clave-Admin-99'); await D.p.click('#vcPaGo');
    chk('6. La contraseña de cliente no puede ser la misma de administrador', await esperar(D.p, () => /DIFERENTE/.test(document.getElementById('vcPaErr').textContent)));
    await D.p.fill('#vcPaCl1', 'clave-cliente-1'); await D.p.fill('#vcPaCl2', 'clave-cliente-1'); await D.p.click('#vcPaGo');
    chk('6. Pasa su negocio a la cuenta de cliente y entra con ella', await dentro(D.p) && await esperar(D.p, () => window.ventoNube.correo() === 'cristhianwkh+cliente@gmail.com', null, 15000));
    chk('6. Ve los datos de su negocio (no perdió nada)', await esperar(D.p, () => data.products.some(p => p.name === 'Club Colombia Admin'), null, 15000));
    const m = await sb.sql("select u.email, m.rol from miembros m join auth.users u on u.id = m.usuario_id where m.negocio_id = $1", [negAdm]);
    chk('6. En el servidor: el negocio ahora es de la cuenta de cliente (el administrador ya no está)', m.length === 1 && m[0].email === 'cristhianwkh+cliente@gmail.com' && m[0].rol === 'dueno', m);
    chk('6. El administrador sigue entrando a Vento Admin con su contraseña', (await api('/admin/yo', {}, (await entrar(ADMIN, 'Clave-Admin-99')).j.access_token)).j.admin === true);
    await D.ctx.close();
    // Crear la cuenta de cliente con la MISMA contraseña de administrador: no deja
    const E = await equipo('cliente nuevo');
    await E.p.fill('#authBiz', 'Otro bar'); await E.p.fill('#authUser', 'cristhianwkh+bar2@gmail.com'); await E.p.fill('#authPass', 'Clave-Admin-99'); await E.p.click('#authBtn');
    chk('6. Cuenta de cliente nueva con la contraseña de administrador: no deja', await esperar(E.p, () => /DIFERENTE/.test(document.getElementById('authErr').textContent)) && !(await E.p.evaluate(() => document.getElementById('authOverlay').hidden)));
    await E.p.fill('#authPass', 'otra-clave-22'); await E.p.click('#authBtn');
    chk('6. Con otra contraseña sí la crea', await dentro(E.p));
    await E.ctx.close();
  }
})();
