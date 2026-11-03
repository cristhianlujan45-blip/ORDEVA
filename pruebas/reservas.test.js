// 📅 Reservas en la app (ORDEVA 1.73.0), de punta a punta: PostgreSQL REAL + Servidor ORDEVA + la app de verdad, con un hotel.
//  1. «📅 Reservas» aparece en Cuentas (hotel). Reserva nueva desde la app: queda en el servidor.
//  2. Otra que se cruza: NO se guarda y dice con cuál choca.
//  3. «🤖 En línea»: se prende y sale el link del agente.
//  4. Una reserva que entra por el agente (en línea): la app avisa (voz y aviso) y la tarjeta de la habitación dice
//     «📅 Reservada…».
//  5. Atender = ocupada: al anotar en la habitación 2 (sin reserva), queda ocupada en el servidor y el agente ya no la ofrece;
//     al cobrar (cuenta vacía) se libera.
//  6. «✅ Llegó» en una reserva de hoy: pasa a ocupada y abre la cuenta de esa habitación.
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
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 200 }).then(() => true, () => false);
    const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento_vista_sencilla', '0'); }catch(e){} window.__voz = []; window.speakVoice = t => { window.__voz.push(String(t)); }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'hotel'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Hotel Reservas'); await p.fill('#authUser', 'dueno@reservas.co'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    chk('El hotel crea la cuenta en la nube y entra', await esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000));
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { window.speakVoice = t => { window.__voz.push(String(t)); }; document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await esperar(p, () => !!window.ventoNube.negocio() && !!window.ventoReservas && window.ventoReservas.activo(), null, 15000);
    const NEG = (await p.evaluate(() => window.ventoNube.negocio().id));
    await p.evaluate(() => document.querySelector('nav button[data-view="mesas"]').click());
    chk('1. Hotel: «📅 Reservas» en Cuentas', await esperar(p, () => !!document.getElementById('rsBarra'), null, 10000));

    // ===== 1. Reserva desde la app =====
    await p.evaluate(() => window.ventoReservas.abrir('hoy'));
    await esperar(p, () => !!document.getElementById('rsRec'), null, 10000);
    const manana = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(15, 0, 0, 0); const l = x => new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); const h = new Date(d.getTime() + 2 * 864e5); h.setHours(12, 0, 0, 0); return [l(d), l(h)]; });
    await p.evaluate(() => { document.querySelector('.rs-nueva').open = true; });
    await p.selectOption('#rsRec', '1'); await p.fill('#rsDesde', manana[0]); await p.fill('#rsHasta', manana[1]);
    await p.fill('#rsCli', 'Ana Ruiz'); await p.fill('#rsTel', '3001234567'); await p.fill('#rsPer', '2');
    await p.click('[data-rs="guardar"]');
    let filas = [];
    for(let i = 0; i < 30; i++){ filas = await sb.sql("select recurso, cliente, estado from reservas where negocio_id = $1", [NEG]); if(filas.length) break; await new Promise(r => setTimeout(r, 300)); }
    chk('1. Reserva nueva de la habitación 1 (mañana, 2 noches): queda en el servidor', filas.length === 1 && filas[0].cliente === 'Ana Ruiz' && filas[0].estado === 'confirmada', filas);

    // ===== 2. Se cruza =====
    await p.evaluate(() => { document.querySelector('.rs-nueva').open = true; });
    await p.selectOption('#rsRec', '1'); await p.fill('#rsDesde', manana[0]); await p.fill('#rsHasta', manana[1]); await p.fill('#rsCli', 'Luis'); await p.click('[data-rs="guardar"]');
    chk('2. Otra en la misma habitación y fechas: NO se guarda y dice que ya está reservada', await esperar(p, () => /ya está reservada/.test((document.getElementById('rsMsg') || {}).textContent || ''), null, 8000) &&
      (await sb.sql("select count(*)::int n from reservas where negocio_id = $1", [NEG]))[0].n === 1, await p.evaluate(() => (document.getElementById('rsMsg') || {}).textContent));

    // ===== 3. En línea =====
    await p.evaluate(() => document.querySelector('#rsOv [data-rsv="linea"]').click());
    await esperar(p, () => !!document.getElementById('rsActivo'), null, 5000);
    await p.check('#rsActivo'); await p.click('[data-rs="guardarcfg"]');
    chk('3. «Recibir reservas en línea»: queda prendido y sale el link del agente', await esperar(p, () => /agente\.html\?n=[0-9a-f]{12}/.test((document.querySelector('.rs-link input') || {}).value || ''), null, 8000));
    const PUB = (await sb.sql("select publico, activo, jsonb_array_length(recursos) n from reservas_config where negocio_id = $1", [NEG]))[0];
    chk('3. … en el servidor: activo y con las habitaciones del hotel', PUB && PUB.activo && PUB.n >= 3, PUB);

    // ===== 4. Entra una reserva por el agente =====
    await p.evaluate(() => { document.getElementById('rsOv').classList.remove('show'); document.querySelector('nav button[data-view="mesas"]').click(); });
    const hoy = await p.evaluate(() => { const d = new Date(Date.now() + 2 * 36e5); const h = new Date(); h.setDate(h.getDate() + 1); h.setHours(12, 0, 0, 0); return [d.toISOString(), h.toISOString()]; });
    const anon = { apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + sb.anonKey };
    const pub = await fetch(sb.url + '/rest/v1/rpc/reserva_publica_crear', { method: 'POST', headers: anon, body: JSON.stringify({ p_publico: PUB.publico, p_recurso: '3', p_desde: hoy[0], p_hasta: hoy[1], p_cliente: 'Carlos Pérez', p_telefono: '3105550000', p_personas: 2, p_nota: 'Llega en bus' }) }).then(r => r.json());
    chk('4. El agente reserva la habitación 3 para hoy', pub && pub.ok, pub);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('vento-aviso-vivo')));
    chk('4. La app avisa «Reserva nueva» (aviso y voz)', await esperar(p, () => /Reserva nueva/.test((document.getElementById('toast') || {}).textContent || '') && window.__voz.some(t => /Reserva nueva/.test(t)), null, 10000), await p.evaluate(() => ({ t: document.getElementById('toast').textContent, v: window.__voz })));
    chk('4. La tarjeta de la habitación 3 dice «📅 Reservada hoy … · Carlos Pérez»', await esperar(p, () => [...document.querySelectorAll('#tableGrid .ticket')].some(c => /Reservada hoy/.test(c.textContent) && /Carlos/.test(c.textContent)), null, 8000));

    // ===== 5. Atender = ocupada =====
    await p.evaluate(() => { data.products = data.products && data.products.length ? data.products : [{ id: 'hab', name: 'Habitación doble', price: 120000 }]; saveData(); openTableModal(2); addFavoriteToTable(data.products[0].id); });
    let oc = [];
    for(let i = 0; i < 40; i++){ oc = await sb.sql("select estado, origen from reservas where negocio_id = $1 and recurso = '2' and estado = 'ocupada'", [NEG]); if(oc.length) break; await new Promise(r => setTimeout(r, 300)); }
    chk('5. Se anota en la habitación 2 (sin reserva): queda OCUPADA en el servidor', oc.length === 1 && oc[0].origen === 'ocupacion', oc);
    const disp = await fetch(sb.url + '/rest/v1/rpc/reservas_disponibles', { method: 'POST', headers: anon, body: JSON.stringify({ p_publico: PUB.publico, p_desde: new Date().toISOString(), p_hasta: new Date(Date.now() + 3 * 36e5).toISOString(), p_personas: 1 }) }).then(r => r.json());
    chk('5. … y el agente ya no la ofrece (ni la 3, que está reservada)', Array.isArray(disp) && !disp.some(x => x.id === '2') && !disp.some(x => x.id === '3') && disp.some(x => x.id === '1'), disp);
    await p.evaluate(() => { try{ closeModal(); }catch(e){} data.tables[2].items = []; saveData(); });
    let lib = [];
    for(let i = 0; i < 40; i++){ lib = await sb.sql("select count(*)::int n from reservas where negocio_id = $1 and recurso = '2' and estado = 'ocupada'", [NEG]); if(!lib[0].n) break; await new Promise(r => setTimeout(r, 300)); }
    chk('5. Al cobrar (cuenta vacía), la habitación 2 queda libre', lib[0].n === 0, lib);

    // ===== 6. Llegó =====
    await p.evaluate(() => window.ventoReservas.abrir('hoy'));
    await esperar(p, () => [...document.querySelectorAll('#rsOv [data-rs="llego"]')].length > 0, null, 10000);
    await p.evaluate(() => { const f = [...document.querySelectorAll('#rsOv .rs-fila')].find(x => /Carlos/.test(x.textContent)); f.querySelector('[data-rs="llego"]').click(); });
    let est = [];
    for(let i = 0; i < 30; i++){ est = await sb.sql("select estado from reservas where negocio_id = $1 and cliente = 'Carlos Pérez'", [NEG]); if(est[0] && est[0].estado === 'ocupada') break; await new Promise(r => setTimeout(r, 300)); }
    chk('6. «✅ Llegó»: la reserva pasa a ocupada y se abre la cuenta de la habitación 3', est[0] && est[0].estado === 'ocupada' && await esperar(p, () => document.getElementById('overlay').classList.contains('show') && String(currentTable) === '3', null, 6000), est);

    // ===== 7. 🔧 Fuera de servicio (1.75.0): bloqueada en el servidor hasta su reserva =====
    await p.evaluate(() => { try{ closeModal(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); openTableModal(1); });
    await esperar(p, () => { const b = document.getElementById('mpAseo'); return !!b && !b.hidden; }, null, 6000);
    await p.click('#mpAseo [data-mapa="mant"]');
    let bl = [];
    for(let i = 0; i < 30; i++){ bl = await sb.sql("select r.estado, r.hasta = a.desde as hasta_reserva from reservas r, reservas a where r.negocio_id = $1 and r.recurso = '1' and r.nota = 'bloqueo' and a.negocio_id = $1 and a.cliente = 'Ana Ruiz'", [NEG]); if(bl.length) break; await new Promise(r => setTimeout(r, 300)); }
    chk('7. «Fuera de servicio»: la habitación 1 queda bloqueada en el servidor hasta la reserva de Ana (no la pisa)', bl.length === 1 && bl[0].estado === 'confirmada' && bl[0].hasta_reserva === true, bl);
    const disp2 = await fetch(sb.url + '/rest/v1/rpc/reservas_disponibles', { method: 'POST', headers: anon, body: JSON.stringify({ p_publico: PUB.publico, p_desde: new Date().toISOString(), p_hasta: new Date(Date.now() + 3 * 36e5).toISOString(), p_personas: 1 }) }).then(r => r.json());
    chk('7. … y el agente ya no la ofrece', Array.isArray(disp2) && !disp2.some(x => x.id === '1'), disp2);
    chk('7. La tarjeta no dice «Reservada» por el bloqueo y la barra no lo cuenta como reserva de hoy', await p.evaluate(() => { const c = document.querySelector('#tableGrid .ticket[data-id="1"]'); return !!c && c.dataset.est === 'mant' && !/Reservada hoy/.test(c.innerText) && !/2 hoy/.test((document.getElementById('rsBarra') || {}).textContent || ''); }), await p.evaluate(() => [(document.querySelector('#tableGrid .ticket[data-id="1"]') || {}).innerText, (document.getElementById('rsBarra') || {}).textContent]));
    await p.click('#mpAseo [data-mapa="limpia"]');
    for(let i = 0; i < 30; i++){ bl = await sb.sql("select estado from reservas where negocio_id = $1 and recurso = '1' and nota = 'bloqueo'", [NEG]); if(bl[0] && bl[0].estado === 'cancelada') break; await new Promise(r => setTimeout(r, 300)); }
    const disp3 = await fetch(sb.url + '/rest/v1/rpc/reservas_disponibles', { method: 'POST', headers: anon, body: JSON.stringify({ p_publico: PUB.publico, p_desde: new Date().toISOString(), p_hasta: new Date(Date.now() + 3 * 36e5).toISOString(), p_personas: 1 }) }).then(r => r.json());
    chk('7. «Limpia»: se quita el bloqueo y el agente la vuelve a ofrecer', bl[0] && bl[0].estado === 'cancelada' && Array.isArray(disp3) && disp3.some(x => x.id === '1'), [bl, disp3]);
  }
})();
