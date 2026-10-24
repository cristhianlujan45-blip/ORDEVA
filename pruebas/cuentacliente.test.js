// La app del negocio conectada con ORDEVA Admin (contra el «Supabase local» REAL):
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
    chk('2. Ajustes → Guía y soporte: «🎧 Soporte de ORDEVA»', await esperar(A.p, () => !!document.getElementById('vcSoporte') && document.getElementById('vcSoporte').offsetParent !== null));
    // Un error que registró la app en este equipo (el cliente no ve su código)
    const codErr = await A.p.evaluate(() => window.mesoraLogError('imprimir', 'La impresora no respondió (timeout)', 'imprimirCuenta'));
    await A.p.click('#vcNuevo');
    await A.p.fill('#vcAsunto', 'No me imprime'); await A.p.fill('#vcMsg', 'Hola, no me imprime la cuenta de la mesa 3'); await A.p.fill('#vcTel', '3001112233');
    // Pantallazo del error (PNG de verdad, 900×600): la app lo achica y lo manda con el mensaje
    const zlib = require('zlib');
    const png = (w, h) => { const T = []; for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
      const crc = b => { let c = 0xffffffff; for(const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
      const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
      const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h);
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = x % 255; raw[i + 1] = y % 255; raw[i + 2] = 120; }
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
    await A.p.setInputFiles('#vcFotos', { name: 'pantallazo.png', mimeType: 'image/png', buffer: png(900, 600) });
    chk('2. Adjunta un pantallazo (se ve «1 imagen lista»)', await esperar(A.p, () => /1 imagen lista/.test(document.getElementById('vcFotosTxt').textContent)));
    await A.p.click('#vcEnviar');
    chk('2. Mensaje enviado', await esperar(A.p, () => /Enviado/.test(document.getElementById('vcEstado').textContent), null, 20000), await A.p.evaluate(() => document.getElementById('vcEstado').textContent));
    const caso = await uno("select c.* from soporte_casos c join auth.users u on u.id = c.usuario_id where u.email = 'dueno@soporte.co'");
    chk('2. El caso llega al servidor con su cuenta, negocio y celular', caso && caso.asunto === 'No me imprime' && caso.negocio_id === NEG && caso.telefono === '3001112233', caso);
    chk('2. El reporte lleva solo el diagnóstico del equipo con el código del error (para el administrador)', caso && caso.diagnostico && caso.diagnostico.errores.some(e => e.cod === codErr && /impresora no respondió/.test(e.msg)) && caso.diagnostico.version, caso && caso.diagnostico);
    chk('2. El cliente nunca ve el código del error en su pantalla', !(await A.p.evaluate(c => document.body.innerText.includes(c), codErr)) && /^E-[0-9A-Z]{4}$/.test(codErr), codErr);
    const casoAdm = ((await api('/admin/soporte', {}, adm.token)).j.casos || []).find(c => c.id === caso.id) || {};
    chk('2. El administrador lo ve en el caso, con el código', casoAdm.diagnostico && casoAdm.diagnostico.errores.some(e => e.cod === codErr), casoAdm.diagnostico);
    chk('2. …y el error también le llega a «🐞 Errores» con su código', await (async () => { for(let i = 0; i < 30; i++){ await A.p.evaluate(() => window.ventoErrores && window.ventoErrores.enviar()); const r = await uno("select count(*)::int n from app_errores where mensaje like $1", ['[' + codErr + ']%']).catch(() => ({ n: -1 })); if(r.n > 0) return true; await new Promise(x => setTimeout(x, 700)); } return false; })());
    const imgMsg = await uno('select id, adjunto, adjunto_tipo from soporte_mensajes where caso_id = $1 and adjunto is not null', [caso.id]);
    chk('2. El pantallazo llega al servidor (JPEG achicado, almacenamiento privado)', imgMsg && imgMsg.adjunto_tipo === 'image/jpeg' && /^soporte\//.test(imgMsg.adjunto), imgMsg);
    const fImg = await api('/admin/soporte_imagen', { mensaje: imgMsg && imgMsg.id }, adm.token);
    chk('2. El administrador lo abre desde el panel (enlace firmado)', fImg.st === 200 && /object\/sign\/soporte/.test(fImg.j.url), fImg);
    await api('/admin/soporte_responder', { caso: caso.id, texto: 'Revisa que la impresora esté prendida y vuelve a intentar.' }, adm.token);
    await A.p.evaluate(() => window.ventoCuenta.soporte.revisar());
    chk('2. La respuesta llega con aviso y «1 nueva»', await esperar(A.p, () => /1 nueva/.test(document.getElementById('vcCasos').textContent) && !document.getElementById('vcBadge').hidden));
    await A.p.click('#vcCasos [data-vccaso]');
    chk('2. Al abrirla se ve la conversación', await esperar(A.p, () => document.getElementById('vcCasoOv').classList.contains('show') && /impresora esté prendida/.test(document.getElementById('vcHilo').textContent)));
    await A.p.fill('#vcResp', 'Ya funcionó, gracias'); await A.p.click('#vcResponder');
    chk('2. El cliente contesta (le llega al administrador)', await esperar(A.p, () => document.querySelectorAll('#vcHilo .vc-m.yo').length === 2) &&
      (await api('/admin/soporte', {}, adm.token)).j.casos.some(c => c.id === caso.id && c.estado === 'abierto' && c.mensajes.length === 4));
    chk('2. Ya no sale como nueva', await esperar(A.p, () => !/nueva/.test(document.getElementById('vcCasos').textContent)));
    await cerrarTodo(A.p);

    // ===== 5. Celular de la cuenta =====
    await irAjustes(A.p, 'negocio');
    chk('5. Ajustes → Negocio: «📱 Celular de la cuenta»', await esperar(A.p, () => !document.getElementById('vcPerfil').hidden));
    await A.p.fill('#vcPerfilTel', '300 111 2233'); await A.p.click('#vcPerfilOk');
    chk('5. Se guarda en el servidor', await (async () => { for(let i = 0; i < 20; i++){ const r = await uno("select p.telefono from perfiles p join auth.users u on u.id = p.usuario_id where u.email = 'dueno@soporte.co'"); if(r && r.telefono === '3001112233') return true; await new Promise(x => setTimeout(x, 300)); } return false; })());

    // ===== 4. Contraseña temporal =====
    await A.p.evaluate(() => window.ventoCuenta.revisarClave(true));
    chk('4b. El primer celular anota la hora de la contraseña con la que entró', await A.p.evaluate(() => { try{ return 'dueno@soporte.co' in JSON.parse(localStorage.getItem('vento-clave-vista')); }catch(e){ return false; } }));
    const uid = (await uno("select id from auth.users where email = 'dueno@soporte.co'")).id;
    const temp = (await api('/admin/usuario_clave_temporal', { usuario: uid }, adm.token)).j.clave;
    const B = await equipo('otro celular');
    await B.p.click('#authTabs [data-tab="entrar"]');
    await B.p.fill('#authUser', 'dueno@soporte.co'); await B.p.fill('#authPass', temp); await B.p.click('#authBtn');
    chk('4. Entra en otro celular con la contraseña temporal', await dentro(B.p));
    chk('4. Le pide poner su propia contraseña', await esperar(B.p, () => !!document.getElementById('vcClaveOv'), null, 15000));
    await B.p.fill('#vcCl1', 'mi-clave-nueva'); await B.p.fill('#vcCl2', 'mi-clave-nueva'); await B.p.click('#vcClOk');
    chk('4. Queda guardada (ya no la pide) y sirve para entrar', await esperar(B.p, () => !document.getElementById('vcClaveOv'), null, 10000) &&
      (await entrar('dueno@soporte.co', 'mi-clave-nueva')).st === 200 && (await entrar('dueno@soporte.co', temp)).st === 400);
    chk('4b. El celular donde la cambió NO se saca a sí mismo', (await B.p.evaluate(() => window.ventoCuenta.revisarClave(true))) === false && await B.p.evaluate(() => document.getElementById('authOverlay').hidden));
    await B.ctx.close();

    // ===== 4b. El celular que seguía ADENTRO con la contraseña vieja sale solo (el aviso en vivo lo hace revisar) =====
    await A.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));
    chk('4b. El primer celular, que seguía adentro, sale solo: «La contraseña … cambió»', await esperar(A.p, () => !document.getElementById('authOverlay').hidden && /cambió/.test(document.getElementById('authErr').textContent), null, 20000), await A.p.textContent('#authErr').catch(() => ''));
    await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    chk('4b. … y la contraseña vieja ya no entra ahí', await esperar(A.p, () => /incorrectos/.test(document.getElementById('authErr').textContent) && !document.getElementById('authBtn').disabled, null, 15000), await A.p.textContent('#authErr'));
    await A.p.fill('#authPass', 'mi-clave-nueva'); await A.p.click('#authBtn');
    chk('4b. Entra con la nueva, con sus datos, y ya no lo vuelve a sacar', await dentro(A.p) && await esperar(A.p, () => !!window.ventoNube.negocio(), null, 15000) &&
      (await A.p.evaluate(() => window.ventoCuenta.revisarClave(true))) === false && await A.p.evaluate(() => document.getElementById('authOverlay').hidden && data.businessName === 'Bar Soporte'), await A.p.evaluate(() => data && data.businessName));

    // ===== 4d. 1.61.0: «Cerrar sesión en todos sus equipos» (Admin) y «en mis otros equipos» (la persona) =====
    const rc = await api('/admin/usuario_cerrar_sesiones', { usuario: uid }, adm.token);
    chk('4d. El administrador cierra la sesión de la cuenta en todos sus equipos', rc.st === 200, rc);
    await A.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));
    chk('4d. El celular que estaba adentro sale: «Se cerró la sesión… Tu contraseña es la misma»', await esperar(A.p, () => !document.getElementById('authOverlay').hidden && /Se cerró la sesión/.test(document.getElementById('authErr').textContent), null, 20000), await A.p.textContent('#authErr').catch(() => ''));
    await A.p.fill('#authPass', 'mi-clave-nueva'); await A.p.click('#authBtn');
    chk('4d. Entra otra vez con la MISMA contraseña y ya no lo saca', await dentro(A.p) && await esperar(A.p, () => !!window.ventoNube.negocio(), null, 15000) && (await A.p.evaluate(() => window.ventoCuenta.revisarClave(true))) === false);
    const W = await equipo('celular nuevo');
    await W.p.click('#authTabs [data-tab="entrar"]');
    await W.p.fill('#authUser', 'dueno@soporte.co'); await W.p.fill('#authPass', 'mi-clave-nueva'); await W.p.click('#authBtn');
    chk('4d. Otro celular entra con la cuenta', await dentro(W.p) && await esperar(W.p, () => !!window.ventoNube.negocio(), null, 15000));
    chk('4d. Ajustes → Cuenta tiene «🚪 Cerrar sesión en mis otros equipos»', await esperar(W.p, () => !!document.getElementById('vcOtrosBtn') && !document.getElementById('vcOtros').hidden, null, 15000));
    await W.p.evaluate(() => document.getElementById('vcOtrosBtn').click());
    await W.p.click('#confirmOkBtn');
    chk('4d. Lo confirma y queda listo', await esperar(W.p, () => /en tus otros equipos se cierra la sesión/.test(document.body.innerText), null, 10000));
    await A.p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));
    chk('4d. El primer celular sale', await esperar(A.p, () => !document.getElementById('authOverlay').hidden && /Se cerró la sesión/.test(document.getElementById('authErr').textContent), null, 20000));
    chk('4d. El celular desde donde lo pidió sigue adentro', (await W.p.evaluate(() => window.ventoCuenta.revisarClave(true))) === false && await W.p.evaluate(() => document.getElementById('authOverlay').hidden));
    await W.ctx.close();

    // ===== 4c. El administrador le PONE una contraseña: la vieja deja de servir también donde ya había entrado =====
    const V = await equipo('celular con la vieja');
    await V.p.click('#authTabs [data-tab="entrar"]');
    await V.p.fill('#authUser', 'dueno@soporte.co'); await V.p.fill('#authPass', 'mi-clave-nueva'); await V.p.click('#authBtn');
    chk('4c. Un celular entra con su contraseña (queda guardada en el celular)', await dentro(V.p));
    await V.p.evaluate(() => { localStorage.removeItem('cm-session'); }); await V.p.reload(); await V.p.waitForSelector('#authOverlay:not([hidden])');
    await V.p.waitForFunction(() => window.ventoNube && window.ventoNube.verificarClave, null, { timeout: 15000 });
    const rp = await api('/admin/usuario_clave_poner', { usuario: uid, clave: 'Puesta-Por-El-Admin', pedir_cambio: false }, adm.token);
    chk('4c. El administrador le pone «Puesta-Por-El-Admin»', rp.st === 200, rp);
    await V.p.fill('#authUser', 'dueno@soporte.co'); await V.p.fill('#authPass', 'mi-clave-nueva'); await V.p.click('#authBtn');
    chk('4c. En ese celular, la vieja ya no sirve (con internet): «La contraseña … cambió. Entra con la nueva.»', await esperar(V.p, () => !document.getElementById('authOverlay').hidden && /cambió/.test(document.getElementById('authErr').textContent), null, 20000), await V.p.textContent('#authErr').catch(() => ''));
    await V.p.fill('#authPass', 'mi-clave-nueva'); await V.p.click('#authBtn');
    chk('4c. … ni intentándolo otra vez', await esperar(V.p, () => /incorrectos/.test(document.getElementById('authErr').textContent) && !document.getElementById('authBtn').disabled, null, 15000), await V.p.textContent('#authErr'));
    await V.p.fill('#authPass', 'Puesta-Por-El-Admin'); await V.p.click('#authBtn');
    chk('4c. Entra con la que puso el administrador y ve su negocio', await dentro(V.p) && await esperar(V.p, () => !!window.ventoNube.negocio(), null, 15000));
    await V.ctx.close();

    // ===== 5. Recuperar por mensaje de texto (sin entrar) =====
    const C = await equipo('olvidó');
    await C.p.click('#authTabs [data-tab="entrar"]');
    await C.p.fill('#authUser', 'dueno@soporte.co');
    await C.p.evaluate(() => { const f = document.getElementById('authForgot'); f.hidden = false; f.click(); });
    chk('5. «¿Olvidaste tu contraseña?» → «Otras formas» tiene «📱 Por mensaje de texto»', await esperar(C.p, () => !document.getElementById('recForm').hidden && !!document.getElementById('vcSmsBox')));
    await C.p.evaluate(() => { document.getElementById('recOtras').open = true; });   // está en «Otras formas de recuperarla»
    await C.p.fill('#vcSmsTel', '3001112233'); await C.p.click('#vcSmsBtn');
    chk('5. Pide la contraseña por SMS: le llega al soporte de ORDEVA', await esperar(C.p, () => /Listo/.test(document.getElementById('vcSmsTxt').textContent)) &&
      (await api('/admin/soporte', {}, adm.token)).j.casos.some(c => c.tipo === 'clave' && c.telefono === '3001112233' && c.email === 'dueno@soporte.co' && c.telefono_de_la_cuenta === '3001112233'));
    await C.ctx.close();

    // ===== 6. Correo del administrador en la app =====
    // El administrador tenía su negocio con su correo de administrador (antes de esta versión)
    const negAdm = (await rpc('crear_negocio', { p_nombre: 'Bar del Admin', p_datos: { products: [{ id: 'pa', name: 'Club Colombia Admin', price: 4000 }] } }, adm.token)).j;
    const D = await equipo('admin como cliente');
    await D.p.click('#authTabs [data-tab="entrar"]');
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
    chk('6. El administrador sigue entrando a ORDEVA Admin con su contraseña', (await api('/admin/yo', {}, (await entrar(ADMIN, 'Clave-Admin-99')).j.access_token)).j.admin === true);
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
