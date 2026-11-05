// ⚡ ORDEVA 1.77.0 · Reservas de Booking / Airbnb al instante con los datos del huésped (lib/vento-reservas-avisos.js,
// migración 20261127000000_reservas_instantaneo, vento-ical/sincronizar). PostgreSQL REAL + Servidor ORDEVA + la app.
//  1. Se entienden los avisos de Booking.com Pulse y Airbnb (español e inglés): nueva / cancelada, nombre, fechas, personas.
//  2. El servidor lee los calendarios solo (repaso de cada 5 min, con la clave del repaso); sin la clave, no.
//  3. Llega el aviso de Booking «Nueva reserva de Juan Pérez»: el servidor lee el calendario YA y la reserva queda en su
//     habitación CON el nombre y las personas (sin duplicar).
//  4. Primero el aviso de Airbnb y el calendario después: al llegar, la reserva toma el nombre del aviso.
//  5. Un aviso que el calendario no trae: «📲 Avisos» lo muestra «sin habitación» y se asigna con un toque.
//  6. Cancelación: avisa al instante. 7. Sin errores.
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
  // 🔗 1.76.0: un «Booking» de mentira en este equipo sirve el calendario de cada habitación.
  const http = require('http'); const ICS = {};
  const booking = http.createServer((req, res) => { const k = (/\/ical\/(\w+)\.ics/.exec(req.url) || [])[1]; res.writeHead(ICS[k] ? 200 : 404, { 'Content-Type': 'text/calendar' }); res.end(ICS[k] || ''); });
  await new Promise(r => booking.listen(0, '127.0.0.1', r)); const PB = booking.address().port;
  const sb = await iniciar({ env: { VENTO_ICAL_HOSTS: '127.0.0.1' } }); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {}); booking.close();
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
    await p.fill('#authBiz', 'Hotel Avisos'); await p.fill('#authUser', 'dueno@avisos.co'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    chk('El hotel crea la cuenta en la nube y entra', await esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000));
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { window.speakVoice = t => { window.__voz.push(String(t)); }; document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    await esperar(p, () => !!window.ventoNube.negocio() && !!window.ventoReservas && window.ventoReservas.activo(), null, 15000);
    const NEG = (await p.evaluate(() => window.ventoNube.negocio().id));
    await p.evaluate(() => document.querySelector('nav button[data-view="mesas"]').click());
    chk('1. Hotel: «📅 Reservas» en Cuentas', await esperar(p, () => !!document.getElementById('rsBarra'), null, 10000));

    const ymd = n => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0'); };
    const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], MESC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], MEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dia = n => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
    const cal = evs => ['BEGIN:VCALENDAR', 'VERSION:2.0'].concat(...evs.map(([uid, a, z, extra]) => ['BEGIN:VEVENT', 'UID:' + uid, 'DTSTART;VALUE=DATE:' + ymd(a), 'DTEND;VALUE=DATE:' + ymd(z), 'SUMMARY:CLOSED - Not available'].concat(extra || [], ['END:VEVENT'])), ['END:VCALENDAR']).join('\r\n');

    // ===== 1. Entender los avisos =====
    const casos = await p.evaluate(([d6, d8, d10, d12]) => {
      const E = window.ventoReservasAvisos.entender, f = x => x ? x.toISOString().slice(0, 10) : null;
      const r = [
        E({ f: 'Booking', ti: '¡Nueva reserva!', tx: 'Juan Pérez reservó del ' + d6.d + ' al ' + d8.d + ' de ' + d8.m + '. 2 huéspedes. Reserva n.º 4567891234' }),
        E({ f: 'Booking', ti: 'New booking', tx: 'New booking from John Smith, ' + d6.en + ' ' + d6.d + ' - ' + d8.en + ' ' + d8.d + ', 3 guests' }),
        E({ f: 'Airbnb', ti: 'Reserva confirmada', tx: 'María Gómez llega el ' + d10.d + ' ' + d10.mc + '. 2 noches · 2 huéspedes · HMABC12345' }),
        E({ f: 'Booking', ti: 'Reserva cancelada', tx: 'Juan Pérez canceló su reserva del ' + d6.d + ' de ' + d6.m }),
        E({ f: 'Airbnb', ti: 'Carlos', tx: 'Hola, ¿a qué hora es el check-in?' }),
      ];
      return r.map(x => ({ t: x.tipo, c: x.cliente, p: x.personas, d: f(x.desde), h: f(x.hasta), k: x.codigo }));
    }, [6, 8, 10, 12].map(n => { const x = dia(n); return { d: x.getDate(), m: MES[x.getMonth()], mc: MESC[x.getMonth()], en: MEN[x.getMonth()] }; }));
    const iso = n => { const x = dia(n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    chk('1. Booking (español): nueva, «Juan Pérez», 2 personas, fechas y código', casos[0].t === 'nueva' && casos[0].c === 'Juan Pérez' && casos[0].p === 2 && casos[0].d === iso(6) && casos[0].h === iso(8) && casos[0].k === '4567891234', casos[0]);
    chk('1. Booking (inglés): «John Smith», 3 personas', casos[1].t === 'nueva' && casos[1].c === 'John Smith' && casos[1].p === 3 && casos[1].d === iso(6) && casos[1].h === iso(8), casos[1]);
    chk('1. Airbnb: «María Gómez», llega y «2 noches», código HM…', casos[2].t === 'nueva' && casos[2].c === 'María Gómez' && casos[2].d === iso(10) && casos[2].h === iso(12) && casos[2].k === 'HMABC12345', casos[2]);
    chk('1. Cancelación de Booking: «cancelada» de Juan Pérez', casos[3].t === 'cancelada' && casos[3].c === 'Juan Pérez', casos[3]);
    chk('1. Un mensaje del chat de Airbnb no es una reserva', casos[4].t === 'otro', casos[4]);

    // Calendarios de mentira y links en el servidor
    ICS['b2'] = cal([['bk-1@booking.com', 6, 8]]);
    ICS['a3'] = cal([]);
    await p.evaluate(port => { data.icalLinks = { '2': [{ fuente: 'Booking', url: 'http://127.0.0.1:' + port + '/ical/b2.ics' }], '3': [{ fuente: 'Airbnb', url: 'http://127.0.0.1:' + port + '/ical/a3.ics' }] }; saveData(); return window.ventoIcal.subirLinks(); }, PB);
    let links = await sb.sql("select recurso, fuente from reservas_ical_links where negocio_id = $1 order by recurso", [NEG]);
    chk('Los links de calendario quedan en el servidor', links.length === 2 && links[0].recurso === '2' && links[1].fuente === 'Airbnb', links);

    // ===== 2. El repaso del servidor =====
    const cron = (s) => fetch(sb.url + '/functions/v1/vento-ical/sincronizar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vento-cron': s } }).then(async r => ({ st: r.status, j: await r.json().catch(() => null) }));
    let r = await cron('no-es-la-clave-del-repaso');
    chk('2. El repaso sin la clave: no deja (401)', r.st === 401, r);

    // ===== 3. Llega el aviso de Booking (antes de que el servidor haya leído el calendario) =====
    const av = (f, ti, tx) => ({ id: 'x' + Math.random(), f, app: f, ti, tx, t: Date.now() });
    const d6 = dia(6), d8 = dia(8), d10 = dia(10), d12 = dia(12), d20 = dia(20), d22 = dia(22);
    await p.evaluate(a => { window.__avisos = [a]; window.VentoAndroid = Object.assign(window.VentoAndroid || {}, { reservasAvisosTomar: () => JSON.stringify(window.__avisos.splice(0)), notificar: () => true }); window.__voz = []; window.ventoReservasAvisosNativos(); },
      av('Booking', '¡Nueva reserva!', 'Juan Pérez reservó del ' + d6.getDate() + ' de ' + MES[d6.getMonth()] + ' al ' + d8.getDate() + ' de ' + MES[d8.getMonth()] + '. 2 huéspedes.'));
    let fila = [];
    for(let i = 0; i < 40; i++){ fila = await sb.sql("select recurso, cliente, personas, estado from reservas where negocio_id = $1 and nota like 'ical:Booking:%'", [NEG]); if(fila.length && fila[0].cliente === 'Juan Pérez') break; await new Promise(r => setTimeout(r, 300)); }
    chk('3. Al llegar el aviso, el servidor lee el calendario YA: la reserva queda en la habitación 2 con «Juan Pérez» y 2 personas', fila.length === 1 && fila[0].recurso === '2' && fila[0].cliente === 'Juan Pérez' && fila[0].personas === 2 && fila[0].estado === 'confirmada', fila);
    chk('3. Avisa: «🏨 Booking: reserva de Juan Pérez · … · Habitación 2» y con voz', await esperar(p, () => /Booking: reserva de Juan Pérez .*Habitación 2/.test((document.getElementById('toast') || {}).textContent || '') && window.__voz.some(t => /Reserva nueva de Booking, Juan Pérez/.test(t)), null, 8000), await p.evaluate(() => [(document.getElementById('toast') || {}).textContent, window.__voz]));
    await p.evaluate(a => { window.__avisos.push(a); window.ventoReservasAvisosNativos(); }, av('Booking', '¡Nueva reserva!', 'Juan Pérez reservó del ' + d6.getDate() + ' de ' + MES[d6.getMonth()] + ' al ' + d8.getDate() + ' de ' + MES[d8.getMonth()] + '. 2 huéspedes.'));
    await new Promise(r => setTimeout(r, 1500));
    let n = await sb.sql("select (select count(*)::int from reservas_avisos where negocio_id = $1) a, (select count(*)::int from reservas where negocio_id = $1 and nota like 'ical:%' and estado <> 'cancelada') r", [NEG]);
    chk('3. El mismo aviso otra vez (otro celular): no se duplica nada', n[0].a === 1 && n[0].r === 1, n);

    // ===== 4. Primero el aviso de Airbnb, el calendario después =====
    await p.evaluate(a => { window.__avisos.push(a); window.ventoReservasAvisosNativos(); }, av('Airbnb', 'Reserva confirmada', 'María Gómez llega el ' + d10.getDate() + ' ' + MESC[d10.getMonth()] + '. 2 noches · 3 huéspedes · HMXYZ98765'));
    let a4 = [];
    for(let i = 0; i < 30; i++){ a4 = await sb.sql("select cliente, reserva_id from reservas_avisos where negocio_id = $1 and fuente = 'Airbnb'", [NEG]); if(a4.length) break; await new Promise(r => setTimeout(r, 300)); }
    chk('4. El aviso de Airbnb queda guardado (el calendario todavía no la trae: sin habitación)', a4.length === 1 && a4[0].cliente === 'María Gómez' && !a4[0].reserva_id, a4);
    ICS['a3'] = cal([['ab-77@airbnb.com', 10, 12, ['DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMXYZ98765\\nPhone Number (Last 4 Digits): 4321']]]);
    r = await cron(sb.cron);
    fila = await sb.sql("select recurso, cliente, personas from reservas where negocio_id = $1 and nota like 'ical:Airbnb:%'", [NEG]);
    chk('2. El repaso del servidor (con la clave) lee todos los calendarios', r.st === 200 && r.j.ok && r.j.links === 2, r);
    chk('4. Llega el calendario: la reserva de la habitación 3 toma «María Gómez» y 3 personas del aviso', fila.length === 1 && fila[0].recurso === '3' && fila[0].cliente === 'María Gómez' && fila[0].personas === 3, fila);

    // ===== 5. Un aviso que ningún calendario trae: asignarlo =====
    await p.evaluate(a => { window.__avisos.push(a); window.ventoReservasAvisosNativos(); }, av('Booking', 'New booking', 'New booking from Peter Brown, ' + MEN[d20.getMonth()] + ' ' + d20.getDate() + ' - ' + MEN[d22.getMonth()] + ' ' + d22.getDate() + ', 1 guest'));
    await new Promise(r => setTimeout(r, 2500));
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.ventoReservasAvisos.abrir(); });
    await esperar(p, () => /Peter Brown/.test((document.getElementById('raOv') || {}).innerText || ''), null, 8000);
    let v = await p.evaluate(() => document.getElementById('raOv').innerText.replace(/\s+/g, ' '));
    chk('5. «📲 Avisos de reservas»: Juan y María en su habitación; Peter Brown «Asignar»', /Juan Pérez/.test(v) && /María Gómez/.test(v) && /Peter Brown/.test(v) && /Asignar/.test(v), v.slice(0, 600));
    const idP = await p.evaluate(() => { const b = [...document.querySelectorAll('#raOv [data-ra="asignar"]')][0]; return b && b.dataset.id; });
    await p.selectOption('#raOv [data-ra-hab="' + idP + '"]', '4');
    await p.click('#raOv [data-ra="asignar"][data-id="' + idP + '"]');
    fila = [];
    for(let i = 0; i < 30; i++){ fila = await sb.sql("select recurso, cliente, estado from reservas where negocio_id = $1 and cliente = 'Peter Brown'", [NEG]); if(fila.length) break; await new Promise(r => setTimeout(r, 300)); }
    chk('5. «Asignar» a la habitación 4: queda reservada con «Peter Brown»', fila.length === 1 && fila[0].recurso === '4' && fila[0].estado === 'confirmada', fila);

    // ===== 6. Cancelación =====
    await p.evaluate(a => { window.__voz = []; window.__avisos.push(a); window.ventoReservasAvisosNativos(); }, av('Booking', 'Reserva cancelada', 'Juan Pérez canceló su reserva del ' + d6.getDate() + ' de ' + MES[d6.getMonth()]));
    chk('6. Cancelación: avisa al instante «Booking canceló de Juan Pérez»', await esperar(p, () => /Booking canceló de Juan Pérez/.test((document.getElementById('toast') || {}).textContent || ''), null, 8000), await p.evaluate(() => (document.getElementById('toast') || {}).textContent));
  }
})();
