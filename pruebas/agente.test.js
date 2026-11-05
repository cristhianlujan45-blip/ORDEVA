// 🤖 El agente de ORDEVA (agente.html, 1.73.0) de punta a punta: PostgreSQL REAL + Servidor ORDEVA + la página de verdad.
// La IA (Gemini) se simula aquí con respuestas como las de verdad; la disponibilidad, las reservas y los pedidos son reales.
//  1. Hotel: «una habitación para 2 del … al …» → el agente muestra la disponibilidad REAL con precios (2 noches) y la
//     reserva solo queda cuando el cliente toca «✅ Confirmar»: código de reserva y en el servidor con origen «agente».
//  2. Otro cliente pide las mismas fechas cuando ya no queda nada: «no hay disponibles» (nunca reserva doble).
//  3. Consultar y cancelar la reserva con el código y el celular.
//  4. Restaurante: «mesa para 4 mañana a las 8 pm» → reserva de mesa.
//  5. Domicilio: «2 hamburguesas y una gaseosa» → arma el pedido con la CARTA del negocio (precios y total del sistema),
//     pide nombre, celular y dirección, y al confirmar le llega al negocio como cualquier domicilio.
//  6. Sin IA (falla la IA): igual se puede reservar y pedir con las opciones.
//  7. Un link que no existe o está apagado: lo dice.
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
    const cab = tok => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || sb.anonKey) });
    const rpc = async (fn, args, tok) => { const r = await fetch(sb.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: cab(tok), body: JSON.stringify(args || {}) }); return r.json().catch(() => null); };
    const ymd = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    // Hotel con 2 habitaciones
    const u1 = await sb.usuario('hotel@agente.co'); const HOTEL = await rpc('crear_negocio', { p_nombre: 'Hotel El Mirador', p_datos: {} }, u1.token);
    const ch = await rpc('reservas_config_guardar', { p_negocio: HOTEL, p_activo: true, p_tipo: 'habitacion', p_nombre: 'Hotel El Mirador',
      p_recursos: [{ id: '1', nombre: 'Habitación 101 doble', capacidad: 2, precio: 150000, detalle: 'Cama doble, baño privado' }, { id: '2', nombre: 'Habitación 102 familiar', capacidad: 4, precio: 220000 }],
      p_reglas: { entrada: '15:00', salida: '12:00', wa: '3001234567', info: 'Calle 5 # 10-20, parqueadero gratis' } }, u1.token);
    // Restaurante con 1 mesa y domicilios
    const u2 = await sb.usuario('resto@agente.co'); const RESTO = await rpc('crear_negocio', { p_nombre: 'Asadero La Brasa', p_datos: {} }, u2.token);
    const CANAL = 'vitopruebaagente' + Date.now().toString(36);
    const cr = await rpc('reservas_config_guardar', { p_negocio: RESTO, p_activo: true, p_tipo: 'mesa', p_nombre: 'Asadero La Brasa',
      p_recursos: [{ id: '1', nombre: 'Mesa 1 (terraza)', capacidad: 4 }], p_reglas: { abre: '12:00', cierra: '22:00', duracion_min: 120, domicilios: true, c: CANAL } }, u2.token);
    const carta = { y: 'restaurante', t: 'Menú', n: 'Asadero La Brasa', p: [['Hamburguesa sencilla', 18000, 'Hamburguesas', 0], ['Gaseosa 400 ml', 4000, 'Bebidas', 0], ['Papas a la francesa', 7000, 'Acompañantes', 2]] };
    await rpc('canal_publicar', { p_canal: CANAL + 'k', p_cuerpo: JSON.stringify(carta), p_titulo: null });

    const D1 = ymd(10), D2 = ymd(12), MANANA = ymd(1);
    let iaFalla = false;
    async function abrir(pub){
      const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, locale: 'es-CO', timezoneId: 'America/Bogota' });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.route(/vento-ia\/v1beta\/models\//, rt => {
        if(iaFalla) return rt.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"message":"saturado"}}' });
        const body = JSON.parse(rt.request().postData() || '{}'), ult = (body.contents || []).filter(c => c.role === 'user').pop().parts[0].text.toLowerCase();
        let r = { respuesta: 'Con gusto te ayudo.', intencion: 'pregunta' };
        if(/habitaci/.test(ult)) r = { respuesta: '¡Claro! Reviso la disponibilidad para esas fechas.', intencion: 'reserva', reserva: { desde: D1, hasta: D2, personas: 2 } };
        else if(/mesa para 4/.test(ult)) r = { respuesta: 'Perfecto, miro las mesas.', intencion: 'reserva', reserva: { desde: MANANA + 'T20:00', personas: 4 } };
        else if(/hamburguesa/.test(ult)) r = { respuesta: '¡Listo! Te armo el pedido.', intencion: 'domicilio', domicilio: { items: [{ nombre: 'Hamburguesa sencilla', cantidad: 2 }, { nombre: 'Gaseosa 400 ml', cantidad: 1 }, { nombre: 'Langosta', cantidad: 1 }] } };
        return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] } }] }) });
      });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + '/agente.html?n=' + pub);
      await p.waitForFunction(() => document.querySelectorAll('.m.bot').length > 0 && !/Cargando/.test(document.getElementById('nom').textContent), null, { timeout: 15000 });
      return { ctx, p };
    }
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 200 }).then(() => true, () => false);
    const escribir = async (p, t) => { await p.fill('#txt', t); await p.click('#f button[type=submit]'); };

    // ===== 1. Hotel =====
    let { ctx, p } = await abrir(ch.publico);
    chk('1. El agente saluda con el nombre del hotel y ofrece reservar', /Hotel El Mirador/.test(await p.textContent('#chat')) && /Reservar habitación/.test(await p.textContent('#chat')));
    await escribir(p, 'Hola, quiero una habitación para 2 personas del ' + D1 + ' al ' + D2);
    chk('1. Muestra la disponibilidad REAL con el precio de 2 noches (101 doble: $300.000)', await esperar(p, () => /Hay disponibilidad/.test(document.getElementById('chat').innerText) && /300\.000/.test(document.getElementById('chat').innerText), null, 10000), await p.textContent('#chat'));
    chk('1. … y todavía NO reservó nada (falta confirmar)', (await sb.sql("select count(*)::int n from reservas where negocio_id = $1", [HOTEL]))[0].n === 0);
    await p.fill('.card [data-k="nombre"]', 'Laura Gómez'); await p.fill('.card [data-k="telefono"]', '3015556677');
    await p.click('.card [data-a="confirmar"]');
    chk('1. «✅ Confirmar»: reserva confirmada con su código', await esperar(p, () => /Reserva confirmada/.test(document.getElementById('chat').innerText) && /[A-Z2-9]{6}/.test((document.querySelector('.cod') || {}).textContent || ''), null, 10000), await p.textContent('#chat'));
    const COD = (await p.textContent('.cod')).trim();
    const r1 = await sb.sql("select recurso, cliente, telefono, origen, estado from reservas where negocio_id = $1", [HOTEL]);
    chk('1. En el servidor: habitación 101, a nombre de Laura, origen «agente»', r1.length === 1 && r1[0].recurso === '1' && r1[0].cliente === 'Laura Gómez' && r1[0].origen === 'agente', r1);
    await ctx.close();

    // ===== 2. Sin disponibilidad =====
    await rpc('reserva_publica_crear', { p_publico: ch.publico, p_recurso: '2', p_desde: new Date(D1 + 'T15:00:00').toISOString(), p_hasta: new Date(D2 + 'T12:00:00').toISOString(), p_cliente: 'Otro Cliente', p_telefono: '3020000000', p_personas: 2, p_nota: null });
    ({ ctx, p } = await abrir(ch.publico));
    await escribir(p, 'Necesito una habitación para 2 del ' + D1 + ' al ' + D2);
    chk('2. Ya no queda nada en esas fechas: «No hay habitaciones libres» (no reserva doble)', await esperar(p, () => /No hay habitaciones libres/.test(document.getElementById('chat').innerText), null, 10000), await p.textContent('#chat'));

    // ===== 3. Consultar y cancelar =====
    await p.evaluate(() => [...document.querySelectorAll('.chips button')].find(x => /Mi reserva/.test(x.textContent)).click());
    await p.fill('.card [data-c="cod"]', COD); await p.click('.card:last-of-type [data-a="ver"]');
    chk('3. Consultar con el código: «Confirmada»', await esperar(p, () => /Confirmada/.test((document.querySelector('[data-c="res"]') || {}).textContent || ''), null, 8000));
    await p.fill('.card [data-c="tel"]', '3015556677'); await p.click('.card:last-of-type [data-a="cancelar"]');
    chk('3. Cancelar con el celular: queda cancelada en el servidor', await esperar(p, () => /cancelada/.test((document.querySelector('[data-c="res"]') || {}).textContent || ''), null, 8000) &&
      (await sb.sql("select estado from reservas where codigo = $1", [COD]))[0].estado === 'cancelada');
    await ctx.close();

    // ===== 4. Mesa =====
    ({ ctx, p } = await abrir(cr.publico));
    chk('4. Restaurante: ofrece reservar mesa y pedir domicilio', /Reservar mesa/.test(await p.textContent('#chat')) && /Pedir domicilio/.test(await p.textContent('#chat')));
    await escribir(p, 'Quiero una mesa para 4 mañana a las 8 pm');
    await esperar(p, () => !!document.querySelector('.card [data-a="confirmar"]'), null, 10000);
    await p.fill('.card [data-k="nombre"]', 'Jorge'); await p.fill('.card [data-k="telefono"]', '3104445566'); await p.click('.card [data-a="confirmar"]');
    chk('4. Reserva de la mesa 1 para mañana a las 8 p. m.', await esperar(p, () => /Reserva confirmada/.test(document.getElementById('chat').innerText), null, 10000) &&
      (await sb.sql("select count(*)::int n from reservas where negocio_id = $1 and recurso = '1' and extract(hour from desde at time zone 'America/Bogota') = 20", [RESTO]))[0].n === 1, await p.textContent('#chat'));

    // ===== 5. Domicilio =====
    await escribir(p, 'Me mandas 2 hamburguesas, una gaseosa y una langosta');
    chk('5. Arma el pedido con la carta: 2 × Hamburguesa $36.000 + Gaseosa $4.000 = $40.000 (lo que no está en la carta no entra)', await esperar(p, () => { const t = document.getElementById('chat').innerText; return /2 × Hamburguesa sencilla/.test(t) && /40\.000/.test(t) && !/Langosta/.test(t.split('Tu domicilio').pop()); }, null, 10000), await p.textContent('#chat'));
    await p.fill('.card [data-k="nombre"]', 'Camila'); await p.fill('.card [data-k="telefono"]', '3157778899'); await p.fill('.card [data-k="direccion"]', 'Carrera 7 # 45-12, Chapinero');
    await p.click('.card [data-a="enviar"]');
    chk('5. «✅ Enviar pedido»: dice que ya le llegó al negocio', await esperar(p, () => /Pedido enviado/.test(document.getElementById('chat').innerText), null, 10000));
    const pedidos = await rpc('canal_leer', { p_canales: [CANAL], p_desde_id: null, p_desde: 0, p_limite: 50 });
    const txt = JSON.stringify(pedidos);
    chk('5. Le llega al negocio como domicilio: nombre, celular, dirección y productos', /DOMICILIO: Camila \| 3157778899 \| Carrera 7 # 45-12, Chapinero \| 2 Hamburguesa sencilla, 1 Gaseosa 400 ml/.test(txt), txt.slice(0, 400));
    await ctx.close();

    // ===== 6. Sin IA =====
    iaFalla = true;
    ({ ctx, p } = await abrir(ch.publico));
    await escribir(p, 'hola quiero reservar');
    chk('6. Si la IA falla: lo dice y deja las opciones para hacerlo directo', await esperar(p, () => /no logro entenderte/.test(document.getElementById('chat').innerText) && [...document.querySelectorAll('.chips button')].some(x => /Reservar habitación/.test(x.textContent)), null, 15000));
    await p.evaluate(() => [...document.querySelectorAll('.chips button')].find(x => /Reservar habitación/.test(x.textContent)).click());
    await p.fill('.card [data-k="desde"]', ymd(30)); await p.fill('.card [data-k="hasta"]', ymd(31)); await p.click('.card [data-a="ver"]');
    chk('6. … con la tarjeta de reserva (sin IA) se ve la disponibilidad', await esperar(p, () => /Hay disponibilidad/.test(document.getElementById('chat').innerText), null, 10000));
    await ctx.close();
    iaFalla = false;

    // ===== 7. Link que no existe =====
    ({ ctx, p } = await abrir('noexiste123'));
    chk('7. Un link que no existe o está apagado: lo dice', /no está recibiendo reservas/.test(await p.textContent('#chat')));
    await ctx.close();
  }
})();
