// ✈️ ORDEVA 1.94.0 · El agente para AGENCIAS DE VIAJES, de punta a punta: la app de verdad con su cuenta en la nube
// (PostgreSQL REAL + Servidor ORDEVA de pruebas) y agente.html. La IA se simula; los cupos, la carta y el canal son reales.
//  1. La agencia publica sus planes con la carta: destino, salida, duración, precio, por cuántas personas y los cupos que quedan.
//  2. Ajustes del agente (Inicio → 🤖 Agente): «✈️ Recibir solicitudes de planes» → el link queda activo.
//  3. El cliente abre el link: «✈️ Ver planes» muestra los planes, los cupos que quedan y «Sin cupos» donde no hay.
//  4. Más personas que cupos: no deja enviar. Con cupos: «Solicitud enviada» y le llega a la agencia («✈️ Solicitudes»).
//  5. La misma solicitud dos veces queda una. «✅ Crear la cuenta»: la cuenta del cliente con el plan y los viajeros, y los
//     cupos quedan apartados (el agente ya muestra los que quedan).
//  6. Con la IA: «quiero ir a Cartagena con mi esposa» → el plan, para 2 personas (precio por 2 personas → 1 cupo).
//  7. Descartar una solicitud. Un negocio que no es agencia no publica planes.
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
  const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 20000, polling: 300 }).then(() => true, () => false);
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function contexto(){
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, locale: 'es-CO', timezoneId: 'America/Bogota' });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.route(/vento-ia\/v1beta\/models\//, rt => {
      const body = JSON.parse(rt.request().postData() || '{}'), ult = (body.contents || []).filter(c => c.role === 'user').pop().parts[0].text.toLowerCase();
      let r = { respuesta: 'Con gusto te ayudo.', intencion: 'pregunta' };
      if(/cartagena/.test(ult)) r = { respuesta: '¡Qué buen plan! Te dejo los datos para apartarlo.', intencion: 'plan', plan: { plan: 'Cartagena pareja', personas: 2, nombre: 'Luis' } };
      return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] } }] }) });
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    return ctx;
  }
  async function pruebas(){
    // ===== La agencia (la app de verdad, con su cuenta en la nube) =====
    const ctxA = await contexto(), A = await ctxA.newPage(); A.on('pageerror', e => errs.push('app: ' + e.message));
    await A.goto(BASE + '/index.html');
    await A.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
    await A.fill('#authBiz', 'Viajes Caribe'); await A.fill('#authUser', 'dueno@viajes.co'); await A.fill('#authPass', 'clave123'); await A.click('#authBtn');
    chk('0. Se crea la cuenta de la agencia en la nube', await esperar(A, () => document.getElementById('authOverlay').hidden));
    await A.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await esperar(A, () => !!window.ventoNube.negocio());
    await A.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.businessType = 'agencia_viajes';
      data.products = [
        { id: 'sa', name: 'San Andrés 4 días', price: 1800000, det: { destino: 'San Andrés', dias: '4 días, 3 noches', salida: '15 de junio', cupos: '10', incluye: 'vuelo, hotel y traslados' } },
        { id: 'gu', name: 'Tour Guatapé', price: 120000, det: { destino: 'Guatapé', dias: '1 día', cupos: '2' } },
        { id: 'ca', name: 'Cartagena pareja', price: 2000000, det: { destino: 'Cartagena', dias: '3 noches', personas: '2', cupos: '5' } },
        { id: 'ej', name: 'Eje cafetero', price: 900000, det: { destino: 'Salento', salida: '1 de julio', cupos: '1' } },
        { id: 'tq', name: 'Tiquete aéreo', price: 400000 }];
      data.tables = { 1: { name: 'Pedro', items: [{ productId: 'ej', name: 'Eje cafetero', price: 900000, qty: 1, personId: null, history: [] }], people: [] } };
      data.tableCount = 6; saveData();
      const M = window.vitoMod, c = M.qCfg(); c.live = true; M.SS('vito_qr', c);
    });
    let v = await A.evaluate(() => window.ventoAgencia.paraCarta());
    chk('1. Los planes viajan con la carta: destino, salida, duración, cupos que quedan, incluye y por cuántas personas',
      v && v['San Andrés 4 días'].join('|') === 'San Andrés|15 de junio|4 días, 3 noches|10|vuelo, hotel y traslados|1' && v['Eje cafetero'][3] === 0 && v['Cartagena pareja'][5] === 2 && v['Tour Guatapé'][3] === 2 && !v['Tiquete aéreo'], v);

    // ===== 2. Ajustes del agente =====
    chk('2. El agente se puede usar en agencias (Inicio → 🤖 Agente)', await A.evaluate(() => window.ventoReservas.agenteActivo()));
    await A.evaluate(() => window.ventoReservas.abrir());
    chk('2. Ajustes del agente: «🤖 Agente de planes» con «✈️ Recibir solicitudes de planes»', await esperar(A, () => !!document.getElementById('rsPlanes') && /Agente de planes/.test(document.querySelector('#rsOv h2').textContent)));
    await A.check('#rsPlanes'); await A.fill('#rsWa', '3009998877'); await A.click('#rsOv [data-rs="guardarcfg"]');
    chk('2. … al guardar, el link del agente queda activo con los planes', await esperar(A, () => { const c = window.ventoReservas.estado().cfg; return !!(c && c.activo && c.publico && c.reglas && c.reglas.planes && c.reglas.c); }));
    const PUB = await A.evaluate(() => window.ventoReservas.estado().cfg.publico);
    const TOPIC = await A.evaluate(() => window.vitoMod.qCfg().topic);
    await A.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); return window.vitoPublicarCatalogo(true); });
    await A.waitForTimeout(800);

    // ===== 3. El cliente abre el link =====
    const ctxC = await contexto();
    const abrirAgente = async () => { const C = await ctxC.newPage(); C.on('pageerror', e => errs.push('agente: ' + e.message)); await C.goto(BASE + '/agente.html?n=' + PUB); await esperar(C, () => [...document.querySelectorAll('.chips button')].some(x => /Ver planes/.test(x.textContent))); return C; };
    let C = await abrirAgente();
    chk('3. El agente saluda con «ver nuestros planes y apartar tu cupo»', /planes y apartar tu cupo/.test(await C.textContent('#chat')), await C.textContent('#chat'));
    await C.evaluate(() => [...document.querySelectorAll('.chips button')].find(x => /Ver planes/.test(x.textContent)).click());
    await esperar(C, () => /Nuestros planes/.test(document.getElementById('chat').innerText));
    let t = await C.evaluate(() => [...document.querySelectorAll('.card')].pop().innerText);
    chk('3. «✈️ Ver planes»: San Andrés con salida, duración, lo que incluye, precio y «Quedan 10 cupos»', /San Andrés 4 días/.test(t) && /Salida: 15 de junio/.test(t) && /4 días, 3 noches/.test(t) && /vuelo, hotel/.test(t) && /1\.800\.000/.test(t) && /Quedan 10 cupos/.test(t), t);
    chk('3. … «Eje cafetero» sale «Sin cupos» (el último está en la cuenta de Pedro) y Cartagena «Precio por 2 personas»', /Eje cafetero[\s\S]*Sin cupos/.test(t) && /Cartagena pareja[\s\S]*Precio por 2 personas/.test(t) && !/Tiquete aéreo/.test(t), t);
    chk('3. … sin botón para pedir el que no tiene cupos', await C.evaluate(() => [...document.querySelectorAll('.plan')].filter(x => /Eje cafetero/.test(x.innerText)).every(x => !x.querySelector('[data-plan]'))));

    // ===== 4. Más personas que cupos / con cupos =====
    await C.evaluate(() => [...document.querySelectorAll('.plan')].find(x => /Tour Guatapé/.test(x.innerText)).querySelector('[data-plan]').click());
    await C.fill('.card [data-k="personas"]', '3'); await C.fill('.card [data-k="nombre"]', 'Ana'); await C.fill('.card [data-k="telefono"]', '3001112233'); await C.click('.card [data-a="solicitar"]');
    chk('4. Tour Guatapé para 3 personas: «no alcanzan los cupos: quedan 2» (no se envía)', await esperar(C, () => /no alcanzan los cupos: quedan 2/.test(document.getElementById('chat').innerText), null, 5000));
    await C.close(); C = await abrirAgente();
    await C.evaluate(() => [...document.querySelectorAll('.chips button')].find(x => /Ver planes/.test(x.textContent)).click());
    await esperar(C, () => !!document.querySelector('.plan'));
    await C.evaluate(() => [...document.querySelectorAll('.plan')].find(x => /San Andrés/.test(x.innerText)).querySelector('[data-plan]').click());
    await C.fill('.card [data-k="personas"]', '3'); await C.fill('.card [data-k="nombre"]', 'Ana'); await C.fill('.card [data-k="telefono"]', '3001112233'); await C.fill('.card [data-k="nota"]', 'viajamos con un niño');
    t = await C.evaluate(() => [...document.querySelectorAll('.card')].pop().innerText);
    chk('4. San Andrés para 3: valor aproximado $5.400.000 («el abono y tu cupo los confirma la agencia»)', /5\.400\.000/.test(t) && /confirma la agencia/.test(t), t);
    await C.click('.card [data-a="solicitar"]');
    chk('4. «Solicitud enviada»: la agencia te escribe para el valor y el abono', await esperar(C, () => /Solicitud enviada/.test(document.getElementById('chat').innerText) && /abono/.test(document.getElementById('chat').innerText), null, 10000));
    const canal = JSON.stringify(await (await fetch(sb.url + '/rest/v1/rpc/canal_leer', { method: 'POST', headers: { apikey: sb.anonKey, Authorization: 'Bearer ' + sb.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_canales: [TOPIC], p_desde_id: null, p_desde: 0, p_limite: 50 }) })).json().catch(() => null)) +
      JSON.stringify(await sb.sql('select cuerpo from canal_mensajes where canal = $1', [TOPIC]));
    chk('4. … le llega por el canal del negocio: «PLAN: Ana | 3001112233 | San Andrés 4 días | 3 | | viajamos con un niño»', /PLAN: Ana \| 3001112233 \| San Andrés 4 días \| 3 \| {2}\| viajamos con un niño/.test(canal), canal.slice(0, 500));
    chk('4. … y a la app de la agencia: «✈️ 1 solicitud nueva del agente»', await esperar(A, () => (data.solicitudesPlan || []).length === 1 && /1 solicitud nueva/.test((document.getElementById('spBarra') || {}).textContent || ''), null, 20000),
      await A.evaluate(() => ({ s: data.solicitudesPlan, barra: (document.getElementById('spBarra') || {}).textContent })));
    v = await A.evaluate(() => data.solicitudesPlan[0]);
    chk('4. … con nombre, celular, plan, personas y nota', v && v.nombre === 'Ana' && v.tel === '3001112233' && v.plan === 'San Andrés 4 días' && v.personas === 3 && v.nota === 'viajamos con un niño' && v.estado === 'nueva', v);

    // ===== 5. Repetida / crear la cuenta =====
    v = await A.evaluate(() => { const s = data.solicitudesPlan[0]; window.__canalMsgId = s.id.slice(2); const r = window.ventoAgencia.recibir('Ana | 3001112233 | San Andrés 4 días | 3 |  | viajamos con un niño'); window.__canalMsgId = null; return { r, n: data.solicitudesPlan.length }; });
    chk('5. La misma solicitud otra vez (el mismo mensaje en otro equipo) queda una sola', v.r === null && v.n === 1, v);
    await A.click('#spBarra');
    await esperar(A, () => document.getElementById('spOv') && document.getElementById('spOv').classList.contains('show'));
    t = await A.evaluate(() => ({ txt: document.getElementById('spOv').innerText, wa: (document.querySelector('#spOv .sp-wa') || {}).href || '' }));
    chk('5. «✈️ Solicitudes del agente»: Ana, el plan, 3 personas, $5.400.000, cupos que quedan y WhatsApp al 57 3001112233', /Ana/.test(t.txt) && /San Andrés 4 días · 3 personas/.test(t.txt) && /5\.400\.000/.test(t.txt) && /quedan 10 cupos/.test(t.txt) && /wa\.me\/573001112233/.test(t.wa), t);
    await A.click('#spOv [data-sp="cuenta"]');
    v = await A.evaluate(() => { const ks = Object.keys(data.tables).filter(k => /^Ana/.test(data.tables[k].name || '')); const tb = ks.length ? data.tables[ks[0]] : null;
      return { n: ks.length, k: ks[0], name: tb && tb.name, items: tb && tb.items.map(i => i.name + '×' + i.qty), viajeros: tb && tb.viajeros, nota: tb && tb.nota, est: data.solicitudesPlan[0].estado,
        quedan: window.ventoAgencia.cupos(data.products.find(p => p.id === 'sa')).quedan, abierta: document.getElementById('overlay').classList.contains('show'), barra: !!document.getElementById('spBarra') }; });
    chk('5. «✅ Crear la cuenta»: «Ana · 3001112233» con San Andrés × 3, 3 viajeros (Ana el primero) y la nota', v.n === 1 && v.k !== '1' && v.name === 'Ana · 3001112233' && v.items.join() === 'San Andrés 4 días×3' && v.viajeros.length === 3 && v.viajeros[0].nombre === 'Ana' && /viajamos con un niño/.test(v.nota || ''), v);
    chk('5. … los cupos quedan apartados (quedan 7), la solicitud queda «cuenta», se abre la cuenta y se va el aviso', v.quedan === 7 && v.est === 'cuenta' && v.abierta && !v.barra, v);
    await A.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await A.waitForTimeout(1500);
    await C.close(); C = await abrirAgente();
    await C.evaluate(() => [...document.querySelectorAll('.chips button')].find(x => /Ver planes/.test(x.textContent)).click());
    chk('5. El agente ya muestra los cupos que quedan: San Andrés «Quedan 7 cupos»', await esperar(C, () => /San Andrés 4 días[\s\S]*Quedan 7 cupos/.test(document.getElementById('chat').innerText), null, 10000), await C.textContent('#chat'));

    // ===== 6. Con la IA =====
    await C.fill('#txt', 'Quiero ir a Cartagena con mi esposa'); await C.press('#txt', 'Enter');
    await esperar(C, () => [...document.querySelectorAll('.card h3')].some(h => /Cartagena pareja/.test(h.textContent)), null, 10000);
    t = await C.evaluate(() => ({ txt: [...document.querySelectorAll('.card')].pop().innerText, personas: [...document.querySelectorAll('.card')].pop().querySelector('[data-k="personas"]').value, nombre: [...document.querySelectorAll('.card')].pop().querySelector('[data-k="nombre"]').value }));
    chk('6. IA: «quiero ir a Cartagena con mi esposa» → Cartagena pareja, 2 personas, nombre Luis y $2.000.000 (precio por 2 personas)', t.personas === '2' && t.nombre === 'Luis' && /2\.000\.000/.test(t.txt) && !/4\.000\.000/.test(t.txt), t);
    await C.locator('.card').last().locator('[data-k="telefono"]').fill('3125556677'); await C.locator('.card').last().locator('[data-a="solicitar"]').click();
    chk('6. … y llega a la agencia', await esperar(A, () => (data.solicitudesPlan || []).some(s => s.plan === 'Cartagena pareja' && s.personas === 2 && s.nombre === 'Luis'), null, 20000));
    v = await A.evaluate(() => { const s = data.solicitudesPlan.find(x => x.plan === 'Cartagena pareja'); const n = window.ventoAgencia.crearCuenta(s.id); return { n, items: n && data.tables[n].items.map(i => i.name + '×' + i.qty), quedan: window.ventoAgencia.cupos(data.products.find(p => p.id === 'ca')).quedan }; });
    chk('6. … su cuenta: Cartagena pareja × 1 (un cupo para las 2 personas): quedan 4', v.n && v.items.join() === 'Cartagena pareja×1' && v.quedan === 4, v);

    // ===== 7. Descartar / sin cupos / otro negocio =====
    v = await A.evaluate(() => { window.__canalMsgId = 'otro-equipo-77'; const s = window.ventoAgencia.recibir('Marta | 3000000000 | Tour Guatapé | 5 | | '); window.__canalMsgId = null;
      const sinCupo = window.ventoAgencia.crearCuenta(s.id); const d = window.ventoAgencia.descartar(s.id);
      return { sinCupo, d, est: s.estado, mesas: Object.keys(data.tables).filter(k => /^Marta/.test(data.tables[k].name || '')).length }; });
    chk('7. Tour Guatapé para 5 (quedan 2): no crea la cuenta; «Descartar» la deja descartada', v.sinCupo === null && v.d === true && v.est === 'descartada' && v.mesas === 0, v);
    v = await A.evaluate(() => { data.businessType = 'tienda'; const r = window.ventoAgencia.paraCarta(); data.businessType = 'agencia_viajes'; return r; });
    chk('7. Un negocio que no es agencia no publica planes', v === null, v);
    await ctxC.close(); await ctxA.close();
  }
})();
