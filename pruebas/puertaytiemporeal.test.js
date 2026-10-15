// Puerta + tiempo real (lib/vento-puerta.js y nube/vento-suscripcion.js):
//  • sin cuenta de Vento Nube la app queda tapada («Conecta Vento a tu cuenta»);
//  • con cuenta y estado firmado por el servidor, la app abre;
//  • cuando la base de datos avisa un cambio (activar, cambiar plan, cancelar), la app lo toma AL INSTANTE, sin
//    tocar nada y sin esperar los refrescos de respaldo;
//  • sin internet se sigue con el último estado firmado; vencido y sin poder renovarlo → «Sin conexión con Vento»;
//    al volver la conexión la app abre sola.
// El servidor y Realtime se simulan (llave ECDSA temporal). No usa internet. La puerta se fuerza con ?puerta=1.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { webcrypto } = require('crypto');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const NEG = '7b0c2a51-4d3e-4f6a-9b1c-2d3e4f5a6b7c';
const DIA = 864e5, H = 3600e3;
const ENTS = { free: ['pos_basic', 'tables', 'inventory', 'expenses'], pro: ['pos_basic', 'inventory', 'tables', 'expenses', 'invoices', 'ocr', 'ai_camera', 'voice', 'advanced_reports', 'employee_management'] };
const PLANES = [
  { id: 'free', name: 'Gratis', price: 0, currency: 'COP', period_months: 1, active: true, sort: 0, description: '', entitlements: ENTS.free },
  { id: 'pro', name: 'Pro', price: 59900, currency: 'COP', period_months: 1, active: true, sort: 2, description: '', entitlements: ENTS.pro }
];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const S = webcrypto.subtle;
  const llave = await S.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pubJwk = await S.exportKey('jwk', llave.publicKey), PUB = { kty: 'EC', crv: 'P-256', x: pubJwk.x, y: pubJwk.y };
  const firmar = async pl => { const a = b64u(JSON.stringify(pl)); const sig = await S.sign({ name: 'ECDSA', hash: 'SHA-256' }, llave.privateKey, Buffer.from(a)); return a + '.' + b64u(Buffer.from(sig)); };

  // «Base de datos» simulada: la suscripción del negocio. Cambiarla aquí = que el administrador la cambie.
  const bd = { sub: { status: 'active', plan: 'free', expiry: 0 }, offline: false, vidaToken: 72 * H, pedidos: 0, rol: 'dueno', ultimo: null, pendiente: null, lic: null, movidas: [], equipos: [] };
  async function respEstado(eq){
    bd.equipos.push(eq);
    // Licencia con código en otro equipo: «otro_equipo», sin funciones (como el servidor de verdad)
    if(bd.lic && bd.lic.equipo !== eq){
      const now = Date.now(), token = await firmar({ t: 'vento-sub', n: NEG, p: 'free', s: 'otro_equipo', e: [], v: 0, i: now, h: now + bd.vidaToken });
      return { ok: true, subscription: { id: 'sub-1', status: 'otro_equipo', plan_id: 'pro', source: 'admin', expiry_date: new Date(now + 30 * DIA).toISOString() }, plan_efectivo: 'free',
        pending_payment: null, last_payment: null, renew_notice: false, rol: bd.rol, token, licencia_equipo: { codigo: bd.lic.codigo, desde: new Date(now - DIA).toISOString(), mover_desde: new Date(bd.lic.moverDesde || now).toISOString() } };
    }
    const now = Date.now(), s = bd.sub, activo = s.status === 'active' && (!s.expiry || s.expiry > now), pe = activo ? s.plan : 'free';
    const token = await firmar({ t: 'vento-sub', n: NEG, p: pe, s: s.status, e: ENTS[pe], v: s.expiry || 0, i: now, h: now + bd.vidaToken });
    return { ok: true, subscription: { id: 'sub-1', status: s.status, plan_id: s.plan, source: 'admin', expiry_date: s.expiry ? new Date(s.expiry).toISOString() : null, updated_at: new Date(now).toISOString() },
      plan_efectivo: pe, pending_payment: bd.pendiente, last_payment: bd.ultimo, renew_notice: false, rol: bd.rol, token };
  }
  async function celular(b, o){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', async r => {
      const req = r.request(), u = new URL(req.url());
      if(u.hostname === 'localhost') return r.continue();
      const m = /^\/functions\/v1\/vento-suscripciones\/([\w-]+)$/.exec(u.pathname);
      if(!/supabase\.co$/.test(u.hostname) || !m) return r.abort();
      if(req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      if(bd.offline) return r.abort('internetdisconnected');
      const json = (status, j) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(j) });
      if(m[1] === 'clave') return json(200, { ok: true, jwk: PUB });
      if(m[1] === 'planes') return json(200, { ok: true, planes: PLANES, config: {}, proveedores: ['manual'] });
      let cuerpo = {}; try{ cuerpo = JSON.parse(req.postData() || '{}'); }catch(e){}
      if(m[1] === 'estado'){ bd.pedidos++; return json(200, await respEstado(cuerpo.equipo)); }
      if(m[1] === 'licencia-mover'){ bd.movidas.push(cuerpo); bd.lic.equipo = cuerpo.equipo; return json(200, { ok: true, codigo: bd.lic.codigo, repetido: false }); }
      return json(404, { ok: false });
    });
    await ctx.addInitScript(({ neg, nube }) => {
      if(nube){ try{ if(!localStorage.getItem('vento_nube_estado')) localStorage.setItem('vento_nube_estado', JSON.stringify({ email: 'dueno@bar.co', negocio: { id: neg, nombre: 'Bar Nube', rol: 'dueno' }, version: 1 })); }catch(e){} }
      const q = () => { const o = { select(){ return o; }, eq(){ return o; }, order(){ return o; }, limit(){ return o; }, maybeSingle: async () => ({ data: { version: 1 } }), single: async () => ({ data: { datos: null, version: 1 } }), then(f, g){ return Promise.resolve({ data: [] }).then(f, g); } }; return o; };
      // Realtime simulado: guarda quién escucha y deja que la prueba «mande el aviso de la base de datos».
      window.__rt = { canales: {}, quitados: 0 };
      const canal = nombre => { const c = { nombre, cbs: [], on(tipo, filtro, cb){ c.cbs.push({ tipo, filtro, cb }); return c; }, subscribe(f){ window.__rt.canales[nombre] = c; setTimeout(() => f && f('SUBSCRIBED'), 10); return c; } }; return c; };
      window.__rtAviso = (nombre, evento) => { const c = window.__rt.canales[nombre]; if(!c) return false; c.cbs.filter(x => x.tipo === 'broadcast' && x.filtro.event === evento).forEach(x => x.cb({ event: evento, payload: {} })); return true; };
      window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'TOK' } } }), onAuthStateChange(){ return { data: { subscription: { unsubscribe(){} } } }; }, signOut: async () => ({}) },
        from: () => q(), rpc: async () => ({ data: [] }), channel: canal, removeChannel: async c => { window.__rt.quitados++; delete window.__rt.canales[c.nombre]; } }) };
    }, { neg: NEG, nube: o.nube !== false });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html?puerta=1'); await p.waitForTimeout(1800);
    return { ctx, p };
  }
  const listo = (p, cond, ms) => p.waitForFunction(cond, null, { timeout: ms || 6000 }).then(() => true, () => false);
  const puerta = p => p.evaluate(() => { const o = document.getElementById('vpOv'); return o ? { motivo: document.documentElement.getAttribute('data-vento-puerta'), txt: o.innerText } : null; });
  const estado = p => p.evaluate(() => { const s = ventoSuscripcion.estado(); return { status: s.status, plan: s.plan }; });

  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + x : '')); } };
  try{
    // ---------- Sin cuenta de Vento Nube ----------
    { const { ctx, p } = await celular(b, { nube: false });
      const g = await puerta(p);
      chk('Sin cuenta de Vento Nube: la app queda tapada con «Conecta Vento a tu cuenta»', !!g && g.motivo === 'cuenta' && /Conecta Vento a tu cuenta/.test(g.txt), JSON.stringify(g));
      chk('…con el botón para entrar o crear la cuenta', await p.evaluate(() => !!document.querySelector('#vpOv [data-vp="cuenta"]')));
      chk('…y la tapa cubre toda la pantalla, por encima de la app', await p.evaluate(() => { const r = document.getElementById('vpOv').getBoundingClientRect(); return r.width >= innerWidth && r.height >= innerHeight && +getComputedStyle(document.getElementById('vpOv')).zIndex > 9999; }));
      await p.evaluate(() => document.querySelector('#vpOv [data-vp="cuenta"]').click()); await p.waitForTimeout(500);
      chk('El botón abre Vento Nube por encima de la tapa', await p.evaluate(() => { const n = document.getElementById('nubeOv'); return !!n && n.classList.contains('show') && +getComputedStyle(n).zIndex > +getComputedStyle(document.getElementById('vpOv')).zIndex; }));
      await ctx.close(); }

    // ---------- Con cuenta: abre, y todo cambia al instante ----------
    const { ctx, p } = await celular(b, {});
    chk('Con cuenta y estado firmado del servidor: la app abre (sin tapa)', await listo(p, () => window.ventoSuscripcion && ventoSuscripcion.verificado() && !document.getElementById('vpOv')), JSON.stringify(await puerta(p)));
    chk('Plan gratis al empezar', (await estado(p)).plan === 'free');
    await p.waitForTimeout(500);
    chk('Escucha el canal en tiempo real del negocio (vs-<negocio>)', await p.evaluate(id => !!window.__rt.canales['vs-' + id], NEG));

    // El administrador activa PRO en la base de datos → la app lo toma sola.
    const antes = bd.pedidos;
    bd.sub = { status: 'active', plan: 'pro', expiry: Date.now() + 30 * DIA };
    const t0 = Date.now();
    await p.evaluate(id => { __rtAviso('vs-' + id, 's'); __rtAviso('vs-' + id, 's'); __rtAviso('vs-' + id, 's'); }, NEG);   // tres avisos seguidos
    chk('Activar PRO: la app lo toma al instante, sin tocar nada', await listo(p, () => ventoSuscripcion.estado().plan === 'pro', 4000), JSON.stringify(await estado(p)));
    const seg = (Date.now() - t0) / 1000;
    chk('…en menos de 3 s (no espera el refresco de respaldo)', seg < 3, seg + ' s');
    chk('…con voz y cámara con IA ya habilitadas', await p.evaluate(() => ventoSuscripcion.tiene('voice') && ventoSuscripcion.tiene('ai_camera')));
    await p.waitForTimeout(600);
    chk('…tres avisos seguidos = una sola consulta al servidor', bd.pedidos - antes === 1, 'consultas: ' + (bd.pedidos - antes));

    // El administrador cancela → la app queda BLOQUEADA y solo ofrece pagar para reactivar.
    const aviso = () => p.evaluate(id => __rtAviso('vs-' + id, 's'), NEG);
    bd.sub = { status: 'canceled', plan: 'pro', expiry: Date.now() + 30 * DIA };
    await aviso();
    chk('Cancelar: la app pasa a «cancelada» al instante', await listo(p, () => ventoSuscripcion.estado().status === 'canceled', 4000), JSON.stringify(await estado(p)));
    chk('…y queda bloqueada: «Tu suscripción fue cancelada»', await listo(p, () => document.documentElement.getAttribute('data-vento-puerta') === 'pago' && /Tu suscripción fue cancelada/.test(document.getElementById('vpOv').innerText), 4000), JSON.stringify(await puerta(p)));
    chk('…con UNA sola opción: «💳 Pagar para reactivar» (nada de la nube ni más botones)', await p.evaluate(() => { const b = [...document.querySelectorAll('#vpOv button')]; return b.length === 1 && b[0].dataset.vp === 'pagar' && /Pagar para reactivar/.test(b[0].textContent) && !/nube|cuenta/i.test(document.getElementById('vpOv').innerText); }));
    await p.evaluate(() => document.querySelector('#vpOv [data-vp="pagar"]').click());
    chk('Pagar abre los planes por encima del bloqueo', await listo(p, () => { const o = document.getElementById('vsOv'); return !!o && o.classList.contains('show') && +getComputedStyle(o).zIndex > +getComputedStyle(document.getElementById('vpOv')).zIndex; }, 4000));
    chk('…solo planes pagos con su botón de pagar (sin el plan gratis ni el código de licencia)', await listo(p, () => !!document.querySelector('#vsOv [data-pagar="pro"]'), 5000) &&
      await p.evaluate(() => !document.querySelector('#vsOv .vs-plan[data-plan="free"]') && !document.getElementById('vsLicBtn') && /Paga tu plan para reactivar/.test(document.getElementById('vsOv').innerText)));
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    chk('Cerrar los planes NO abre la app: sigue bloqueada', !!(await puerta(p)) && (await puerta(p)).motivo === 'pago');

    // Paga → pago en revisión: sigue bloqueada, sin botón de pagar otra vez
    bd.sub = { status: 'payment_review', plan: 'pro', expiry: Date.now() + 30 * DIA }; bd.pendiente = { id: 'pay-1', status: 'review', plan_id: 'pro', method: 'NEQUI', amount: 59900 };
    await aviso();
    chk('Pago en revisión: «Tu pago está en revisión», sin botón de pagar', await listo(p, () => /Tu pago está en revisión/.test((document.getElementById('vpOv') || {}).innerText || '') && !document.querySelector('#vpOv [data-vp="pagar"]'), 4000), JSON.stringify(await puerta(p)));
    // El administrador aprueba → se abre sola
    bd.sub = { status: 'active', plan: 'pro', expiry: Date.now() + 30 * DIA }; bd.pendiente = null;
    await aviso();
    chk('Aprobado / activado: la app se abre sola al instante con PRO', await listo(p, () => !document.getElementById('vpOv') && ventoSuscripcion.estado().plan === 'pro', 4000), JSON.stringify(await puerta(p)));

    // Vencida y pago rechazado: también bloquean
    bd.sub = { status: 'expired', plan: 'pro', expiry: Date.now() - DIA };
    await aviso();
    chk('Vencida: bloqueada con «Tu suscripción venció» y solo pagar', await listo(p, () => /Tu suscripción venció/.test((document.getElementById('vpOv') || {}).innerText || '') && document.querySelectorAll('#vpOv button').length === 1, 4000), JSON.stringify(await puerta(p)));
    bd.sub = { status: 'rejected', plan: 'pro', expiry: 0 }; bd.ultimo = { id: 'pay-2', status: 'rejected', plan_id: 'pro', method: 'NEQUI', amount: 59900, reject_reason: 'No llegó el dinero' };
    await aviso();
    chk('Pago rechazado: bloqueada con el motivo y solo pagar', await listo(p, () => /Tu pago no fue aprobado/.test((document.getElementById('vpOv') || {}).innerText || '') && /No llegó el dinero/.test(document.getElementById('vpOv').innerText) && !!document.querySelector('#vpOv [data-vp="pagar"]'), 4000), JSON.stringify(await puerta(p)));
    // Un cajero (no puede pagar): bloqueado y sin botón
    bd.rol = 'caja';
    await aviso();
    chk('Cajero con la suscripción sin pagar: bloqueado, sin botón (le toca al dueño)', await listo(p, () => /el dueño o el administrador del negocio debe pagar/.test((document.getElementById('vpOv') || {}).innerText || '') && !document.querySelector('#vpOv button'), 4000), JSON.stringify(await puerta(p)));
    bd.rol = 'dueno'; bd.ultimo = null;

    // ---------- Licencia con código en OTRO equipo ----------
    bd.sub = { status: 'active', plan: 'pro', expiry: Date.now() + 30 * DIA };
    const miEquipo = await p.evaluate(() => ventoSuscripcion.equipo());
    chk('La app manda el código de este equipo al servidor', /^[A-Za-z0-9_-]{6,64}$/.test(miEquipo) && bd.equipos.includes(miEquipo), miEquipo);
    bd.lic = { codigo: 'VENTO-ABCD-EFGH-JKLM', equipo: 'OTRO-9999', moverDesde: 0 };
    await aviso();
    chk('Licencia en otro equipo: bloqueada con «Tu licencia está en otro equipo» y el código', await listo(p, () => /Tu licencia está en otro equipo/.test((document.getElementById('vpOv') || {}).innerText || '') && /VENTO-ABCD-EFGH-JKLM/.test(document.getElementById('vpOv').innerText), 4000), JSON.stringify(await puerta(p)));
    chk('…con el botón «📲 Pasar mi licencia a este equipo» (y dice que otra sede = otra licencia)', await p.evaluate(() => !!document.querySelector('#vpOv [data-vp="mover"]') && /otra sede, compra otra licencia/.test(document.getElementById('vpOv').innerText)));
    p.once('dialog', d => d.accept());
    await p.evaluate(() => document.querySelector('#vpOv [data-vp="mover"]').click());
    chk('Pasarla: le pide al servidor moverla a ESTE equipo', await listo(p, () => true, 100) && await (async () => { for(let i = 0; i < 40 && !bd.movidas.length; i++) await p.waitForTimeout(100); return bd.movidas.length === 1 && bd.movidas[0].equipo === miEquipo && bd.movidas[0].negocio === NEG; })(), JSON.stringify(bd.movidas));
    chk('…y la app se abre en este equipo con PRO', await listo(p, () => !document.getElementById('vpOv') && ventoSuscripcion.estado().plan === 'pro', 5000), JSON.stringify(await puerta(p)));
    // Si ya se cambió hace poco: no hay botón, dice desde cuándo
    bd.lic = { codigo: 'VENTO-ABCD-EFGH-JKLM', equipo: 'OTRO-9999', moverDesde: Date.now() + 20 * DIA };
    await aviso();
    chk('Cambiada hace poco: sin botón y con la fecha desde la que podrá pasarla', await listo(p, () => /podrás pasarla desde el/.test((document.getElementById('vpOv') || {}).innerText || '') && !document.querySelector('#vpOv [data-vp="mover"]'), 4000), JSON.stringify(await puerta(p)));
    bd.lic = null;

    // El administrador vuelve a activar → se abre sola
    bd.sub = { status: 'active', plan: 'pro', expiry: Date.now() + 30 * DIA };
    await aviso();
    chk('Volver a activar: PRO otra vez al instante y sin bloqueo', await listo(p, () => ventoSuscripcion.estado().status === 'active' && ventoSuscripcion.estado().plan === 'pro' && !document.getElementById('vpOv'), 4000));

    // ---------- Sin internet ----------
    bd.offline = true;
    await p.evaluate(() => ventoSuscripcion.refrescar(true)); await p.waitForTimeout(2200);
    chk('Sin internet con el estado firmado vigente (72 h): la app sigue abierta', !(await puerta(p)));

    // Estado firmado de corta vida: vence sin poder renovarlo → bloqueo.
    bd.offline = false; bd.vidaToken = 2500;
    await p.evaluate(() => ventoSuscripcion.refrescar(true)); await p.waitForTimeout(300);
    bd.offline = true;
    await p.waitForTimeout(3000);
    await p.evaluate(() => ventoSuscripcion.refrescar(true)); await p.waitForTimeout(2200);
    const g2 = await puerta(p);
    chk('Estado firmado vencido y sin poder renovarlo: «Sin conexión con Vento»', !!g2 && g2.motivo === 'sinconexion' && /Sin conexión con Vento/.test(g2.txt), JSON.stringify(g2));
    bd.offline = false; bd.vidaToken = 72 * H;
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    chk('Vuelve el internet: la app abre sola', await listo(p, () => !document.getElementById('vpOv'), 6000), JSON.stringify(await puerta(p)));
    await ctx.close();
    chk('Sin errores de página', errs.length === 0, errs.join(' | '));
  }catch(e){ mal++; console.log('❌ ' + e.stack); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal'); process.exit(mal ? 1 : 0);
})();
