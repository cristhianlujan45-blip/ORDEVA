// ORDEVA Admin conectado al servidor (PostgreSQL REAL + Edge Function + supabase-js de verdad):
//  1. Entrar: crear la cuenta de administrador con su correo (la contraseña la pone él), salir y volver a entrar.
//     Un cliente no puede entrar al panel.
//  2. 📊 Resumen: usuarios registrados, negocios, equipos, soporte por responder.
//  3. 👥 Usuarios: aparecen TODAS las cuentas (también sin negocio), buscar, ficha con equipos, contraseña temporal
//     (con botón de mensaje de texto), bloquear, crear la cuenta de un cliente con licencia.
//  4. 🎧 Soporte: ver el caso, responder (le llega al cliente), cerrar.
//  5. 🔑 Licencias: crear con duración y correos, se activa sola al cliente, agregar correo, anular.
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
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  finally{ await b.close().catch(() => {}); await sb.cerrar().catch(() => {}); }
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const F = sb.url + '/functions/v1/vento-suscripciones';
    const cab = tok => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
    const api = async (ruta, cuerpo, tok) => { const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
    const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return { st: r.status, j: await r.json().catch(() => null) }; };
    const entrar = async (email, clave) => { const r = await fetch(sb.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: cab(), body: JSON.stringify({ email, password: clave }) }); return { st: r.status, j: await r.json() }; };
    // Clientes
    const dueno = await sb.usuario('dueno@bar.co', 'clave123');
    const NEG = (await rpc('crear_negocio', { p_nombre: 'Bar Las Palmas', p_datos: {} }, dueno.token)).j;
    await rpc('perfil_guardar', { p: { telefono: '3001234567' } }, dueno.token);
    await rpc('registrar_instalacion', { p: { equipo: 'EQ-dueno-0001', negocio: 'Bar Las Palmas', negocio_id: NEG, plataforma: 'apk', version: '1.34.0' } }, dueno.token);
    await sb.usuario('solo.registro@x.co', 'clave123');
    await rpc('registrar_instalacion', { p: { equipo: 'EQ-local-0001', negocio: 'Tienda Doña Rosa', usuario: 'rosa', plataforma: 'web' } });
    const caso = (await rpc('soporte_crear', { p: { asunto: 'No me sale la factura', mensaje: 'Hola, no me sale la factura escaneada', negocio_id: NEG } }, dueno.token)).j;

    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    let respuestaDialogo = true; p.on('dialog', d => { if(d.type() === 'prompt') d.accept('nuevo.socio@bar.co'); else respuestaDialogo ? d.accept() : d.dismiss(); });
    const esperar = (fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 12000 }).then(() => true, () => false);
    const texto = sel => p.$eval(sel, e => e.textContent).catch(() => '');

    // ===== 1. Entrar =====
    await p.goto(BASE + '/admin.html');
    chk('1. Pide correo y contraseña del administrador (ya no un código)', await esperar(() => !document.getElementById('lock').hidden && !document.getElementById('lkEntrar').hidden));
    await p.fill('#lkCorreo', 'dueno@bar.co'); await p.fill('#lkClave', 'clave123'); await p.click('#lkGo');
    chk('1. Un cliente no puede entrar al panel', await esperar(() => /no es administradora/.test(document.getElementById('lkMsg').textContent)) && !(await p.evaluate(() => document.getElementById('lock').hidden)));
    await p.click('#lkCrear');
    await p.fill('#lkNCorreo', 'otro@x.co'); await p.fill('#lkNClave', 'clave-larga-1'); await p.fill('#lkNClave2', 'clave-larga-1'); await p.click('#lkNGo');
    chk('1. Crear cuenta de admin con un correo que no es de administrador: no deja', await esperar(() => /no es de un administrador/.test(document.getElementById('lkMsg').textContent)));
    await p.fill('#lkNCorreo', ADMIN); await p.fill('#lkNClave', 'corta'); await p.fill('#lkNClave2', 'corta'); await p.click('#lkNGo');
    chk('1. Contraseña corta: pide mínimo 8', await esperar(() => /al menos 8/.test(document.getElementById('lkMsg').textContent)));
    await p.fill('#lkNClave', CLAVE_ADMIN); await p.fill('#lkNClave2', CLAVE_ADMIN); await p.click('#lkNGo');
    chk('1. El administrador crea su cuenta con su correo y entra', await esperar(() => document.getElementById('lock').hidden));
    chk('1. La contraseña no queda en la página ni en el equipo', await p.evaluate(c => !document.documentElement.outerHTML.includes(c) && !JSON.stringify(localStorage).includes(c), CLAVE_ADMIN));
    await Promise.all([p.waitForNavigation(), p.click('#salir')]); await p.waitForTimeout(600);
    chk('1. Al salir vuelve a pedir la contraseña', await esperar(() => !document.getElementById('lock').hidden && !document.getElementById('lkEntrar').hidden));
    await p.fill('#lkCorreo', ADMIN); await p.fill('#lkClave', CLAVE_ADMIN); await p.click('#lkGo');
    chk('1. Vuelve a entrar con su correo y contraseña', await esperar(() => document.getElementById('lock').hidden));

    // ===== 2. Resumen =====
    chk('2. Resumen: 3 usuarios registrados (todos, del servidor)', await esperar(() => /3\s*Usuarios registrados/.test(document.getElementById('rsKpis').textContent)), await texto('#rsKpis'));
    const rs = await texto('#rsKpis');
    chk('2. Resumen: negocios, equipos sin nube y soporte por responder', /1\s*Negocios/.test(rs) && /1\s*Equipos sin cuenta/.test(rs) && /1\s*Soporte sin responder/.test(rs), rs);
    chk('2. Últimos registrados con su negocio', /dueno@bar\.co/.test(await texto('#rsRecientes')) && /Bar Las Palmas/.test(await texto('#rsRecientes')));
    chk('2. Soporte por responder en el resumen', /No me sale la factura/.test(await texto('#rsSoporte')));
    chk('2. Aviso de soporte en la pestaña', (await texto('#spBadge')) === '1');

    // ===== 3. Usuarios =====
    await p.click('#tabs [data-t="usuarios"]');
    chk('3. Usuarios: aparecen las 3 cuentas, también la que no tiene negocio', await esperar(() => document.querySelectorAll('#usLista [data-us]').length === 3) && /solo\.registro@x\.co/.test(await texto('#usLista')) && /sin negocio/.test(await texto('#usLista')));
    await p.fill('#usBuscar', 'palmas');
    chk('3. Buscar por negocio', await esperar(() => document.querySelectorAll('#usLista [data-us]').length === 1));
    await p.click('#usLista [data-us]');
    chk('3. Ficha: correo, celular, negocio y equipos', await esperar(() => document.getElementById('dlgUs').open && /3001234567/.test(document.getElementById('usCuerpo').textContent) && /App Android/.test(document.getElementById('usCuerpo').textContent)), await texto('#usCuerpo'));
    await p.click('#usCuerpo [data-ua="temp"]');
    chk('3. Contraseña temporal con botón para mandarla por mensaje de texto al celular', await esperar(() => !!document.querySelector('#usRes .clave-temp') && /^sms:3001234567\?body=/.test(document.querySelector('#usRes a[href^="sms:"]').getAttribute('href'))));
    const temp = (await texto('#usRes .clave-temp')).trim();
    chk('3. Con esa contraseña el cliente entra', (await entrar('dueno@bar.co', temp)).st === 200, temp);
    await p.click('#usCuerpo [data-ua="bloq"]');
    chk('3. Bloquear la cuenta', await esperar(() => /Desbloquear la cuenta/.test(document.getElementById('usCuerpo').textContent)));
    chk('3. La cuenta bloqueada ya no entra', (await entrar('dueno@bar.co', temp)).st === 400);
    await p.click('#usCuerpo [data-ua="bloq"]');
    await esperar(() => /Bloquear la cuenta/.test(document.getElementById('usCuerpo').textContent));
    chk('3. Desbloquearla', (await entrar('dueno@bar.co', temp)).st === 200);
    await p.click('#dlgUs [data-cerrar]');
    await p.fill('#usBuscar', '');
    // Crear cuenta con licencia
    await p.click('#usNuevo');
    await p.fill('#unCorreo', 'nuevo@cafe.co'); await p.fill('#unNegocio', 'Café Central'); await p.fill('#unTel', '3109876543'); await p.selectOption('#unLic', '12');
    await p.click('#unGo');
    chk('3. Crear la cuenta de un cliente: muestra la contraseña y botones para mandarla', await esperar(() => !document.getElementById('unRes').hidden && !!document.querySelector('#unRes .clave-temp') && !!document.querySelector('#unRes a[href^="sms:3109876543"]')));
    const claveNuevo = (await texto('#unRes .clave-temp')).trim();
    const en = await entrar('nuevo@cafe.co', claveNuevo);
    const negNuevo = (await sb.sql("select negocio_id from miembros m join auth.users u on u.id = m.usuario_id where u.email = 'nuevo@cafe.co'"))[0].negocio_id;
    const est = await api('/estado', { negocio: negNuevo }, en.j.access_token);
    chk('3. El cliente entra y su plan PRO de 1 año se activa solo', en.st === 200 && est.j.plan_efectivo === 'pro' && Math.abs(Date.parse(est.j.subscription.expiry_date) - (Date.now() + 365 * 864e5)) < 3 * 864e5, est.j.subscription);
    await p.click('#dlgUsNuevo [data-cerrar]');
    chk('3. Equipos sin cuenta en la nube', /Tienda Doña Rosa/.test(await texto('#usLocales')));

    // ===== 4. Soporte =====
    await p.click('#tabs [data-t="soporte"]');
    chk('4. Soporte: el caso del cliente', await esperar(() => document.querySelectorAll('#spLista [data-caso]').length === 1));
    await p.click('#spLista [data-caso]');
    chk('4. Abre el caso con el mensaje y los datos del cliente', await esperar(() => document.getElementById('dlgSp').open && /no me sale la factura escaneada/.test(document.getElementById('spHilo').textContent) && /Bar Las Palmas/.test(document.getElementById('spInfo').textContent)));
    await p.fill('#spTexto', 'Hola, ya lo revisé: toca «Facturas anteriores» y ahí está.'); await p.click('#spResponder');
    chk('4. Responder: queda en el hilo', await esperar(() => document.querySelectorAll('#spHilo .sp-m.adm').length === 1));
    const visto = (await rpc('soporte_mis_casos', { p_claves: [] }, (await entrar('dueno@bar.co', temp)).j.access_token)).j;
    chk('4. Al cliente le llega la respuesta en su app', visto[0].mensajes.some(m => m.autor === 'admin' && /Facturas anteriores/.test(m.texto)) && visto[0].sin_leer === 1, visto);
    // El cliente manda un pantallazo: el panel se entera al instante (aviso «soporte» del tiempo real), avisa con una
    // notificación del celular (app Android: VentoAdmin.notificar) y la imagen se abre en el caso.
    await p.evaluate(() => { window.__avisos = []; window.VentoAdmin = Object.assign(window.VentoAdmin || {}, { notificar: (t, c, g) => window.__avisos.push([t, c, g]) }); });
    const tokDueno = (await entrar('dueno@bar.co', temp)).j.access_token;
    const zlib = require('zlib');
    const png = (w, h) => { const T = []; for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
      const crc = b => { let c = 0xffffffff; for(const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
      const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
      const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h);
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = 200; raw[i + 1] = x % 255; raw[i + 2] = y % 255; }
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
    const subida = await api('/soporte-adjunto', { caso: caso.id, imagen: { base64: png(60, 40).toString('base64') }, texto: 'Mira el error' }, tokDueno);
    chk('4. El cliente manda un pantallazo al caso', subida.st === 200, subida);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-admin-cambio', { detail: { k: 'soporte' } })));
    chk('4. Llega la notificación del mensaje nuevo (con 📷) al celular del administrador', await esperar(() => (window.__avisos || []).some(a => /📷 Mira el error/.test(a[1]))), await p.evaluate(() => window.__avisos));
    chk('4. …y el caso abierto se actualiza solo con la imagen', await esperar(() => !!document.querySelector('#spHilo [data-spimg]')));
    await p.click('#spHilo [data-spimg]');
    chk('4. «🖼 Ver imagen» la muestra en el caso', await esperar(() => { const i = document.querySelector('#spHilo img'); return !!i && i.complete && i.naturalWidth === 60; }));
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-admin-cambio', { detail: { k: 'soporte' } })));
    await p.waitForTimeout(800);
    chk('4. El mismo mensaje no avisa dos veces', await p.evaluate(() => window.__avisos.filter(a => /Mira el error/.test(a[1])).length === 1));
    await p.click('#spCerrar');
    chk('4. Cerrar el caso', await esperar(() => /Abrir otra vez/.test(document.getElementById('spCerrar').textContent)));
    await p.click('#dlgSp [data-cerrar]');

    // ===== 5. Licencias =====
    await p.click('#tabs [data-t="licencias"]');
    chk('5. Licencias: la de la cuenta creada aparece', await esperar(() => /nuevo@cafe\.co/.test(document.getElementById('lsLista').textContent)));
    await p.selectOption('#lsTipo', 'm'); await p.fill('#lsCant', '3'); await p.fill('#lsCorreos', 'dueno@bar.co'); await p.fill('#lsNota', 'Venta prueba');
    await p.click('#lsCrear');
    chk('5. Crear licencia de 3 meses para el correo del cliente: muestra el código para enviar', await esperar(() => !document.getElementById('lsRes').hidden && /VENTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(document.getElementById('lsRes').textContent)) && /3 meses/.test(await texto('#lsRes')), await texto('#lsRes'));
    chk('5. Botón para mandarla por WhatsApp', /^https:\/\/wa\.me\/\?text=/.test(await p.getAttribute('#lsWa', 'href')));
    const cod = /VENTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/.exec(await texto('#lsRes'))[0];
    const e2 = await api('/estado', { negocio: NEG }, (await entrar('dueno@bar.co', temp)).j.access_token);
    chk('5. Al dueño (correo de la lista) se le activa sola por 3 meses', e2.j.plan_efectivo === 'pro' && Math.abs(Date.parse(e2.j.subscription.expiry_date) - (Date.now() + 91 * 864e5)) < 3 * 864e5, e2.j.subscription);
    await p.click('#lsRef');
    chk('5. En la lista se ve que el dueño ya la usó', await esperar(c => { const card = [...document.querySelectorAll('#lsLista [data-lic]')].find(x => x.textContent.includes(c)); return card && /Activada/.test(card.textContent) && /Bar Las Palmas/.test(card.textContent); }, cod));
    chk('5. Licencia de un solo cliente: con su correo ya no ofrece «➕ Correo»', await p.evaluate(c => { const card = [...document.querySelectorAll('#lsLista [data-lic]')].find(x => x.textContent.includes(c)); return !!card && !card.querySelector('[data-la="correo"]'); }, cod));
    await p.evaluate(c => { const card = [...document.querySelectorAll('#lsLista [data-lic]')].find(x => x.textContent.includes(c)); card.querySelector('[data-la="anular"]').click(); }, cod);
    chk('5. Anular la licencia (y quitar el plan)', await esperar(c => { const card = [...document.querySelectorAll('#lsLista [data-lic]')].find(x => x.textContent.includes(c)); return card && /Anulada/.test(card.textContent); }, cod));
    const e3 = await api('/estado', { negocio: NEG }, (await entrar('dueno@bar.co', temp)).j.access_token);
    chk('5. El negocio vuelve al plan gratis', e3.j.plan_efectivo !== 'pro' || e3.j.subscription.source === 'trial', e3.j.subscription);

    // Suscripciones sigue funcionando sin pedir otra vez la contraseña
    await p.click('#tabs [data-t="subs"]');
    chk('💳 Suscripciones abre directo (ya entró)', await esperar(() => !document.getElementById('sxPanel').hidden));
    chk('Sin errores de página', !errs.length, errs);
  }
})();
