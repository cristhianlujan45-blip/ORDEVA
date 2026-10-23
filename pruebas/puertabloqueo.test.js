// Bloquear desde ORDEVA Admin y «sin base de datos no funciona» (lib/vento-puerta.js y nube/vento-suscripcion.js):
//  • Negocio bloqueado → «🔒 Esta cuenta está bloqueada» con el motivo, AL INSTANTE (aviso en vivo), en todos sus
//    equipos; sigue bloqueado al volver a abrir sin internet; desbloqueado → abre solo.
//  • Usuario bloqueado → «🔒 Tu usuario está bloqueado».
//  • Sin poder hablar con la base de datos más de 60 s (aquí acortado) → «📡 Sin conexión con ORDEVA», aunque el
//    estado firmado siga vigente; vuelve la conexión → abre sola.
// (Mismo simulador que puertaytiemporeal.)
// Puerta + tiempo real (lib/vento-puerta.js y nube/vento-suscripcion.js):
//  • sin cuenta de ORDEVA Nube la app queda tapada («Conecta ORDEVA a tu cuenta»);
//  • con cuenta y estado firmado por el servidor, la app abre;
//  • cuando la base de datos avisa un cambio (activar, cambiar plan, cancelar), la app lo toma AL INSTANTE, sin
//    tocar nada y sin esperar los refrescos de respaldo;
//  • sin internet se sigue con el último estado firmado; vencido y sin poder renovarlo → «Sin conexión con ORDEVA»;
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
  const bd = { sub: { status: 'active', plan: 'free', expiry: 0 }, offline: false, vidaToken: 72 * H, pedidos: 0, rol: 'dueno', ultimo: null, pendiente: null, bloqueado: null };
  async function respEstado(){
    const now = Date.now(), s = bd.sub, activo = s.status === 'active' && (!s.expiry || s.expiry > now), pe = activo ? s.plan : 'free';
    const token = await firmar({ t: 'vento-sub', n: NEG, p: pe, s: s.status, e: ENTS[pe], v: s.expiry || 0, i: now, h: now + bd.vidaToken });
    if(bd.bloqueado) return { ok: true, plan_efectivo: pe, rol: bd.rol, bloqueado: bd.bloqueado };
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
      if(m[1] === 'estado'){ bd.pedidos++; return json(200, await respEstado()); }
      return json(404, { ok: false });
    });
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento_sin_red_ms', '2500'); }catch(e){} });
    await ctx.addInitScript(({ neg, nube }) => {
      if(nube){ try{ if(!localStorage.getItem('vento_nube_estado')) localStorage.setItem('vento_nube_estado', JSON.stringify({ email: 'dueno@bar.co', negocio: { id: neg, nombre: 'Bar Nube', rol: 'dueno' }, version: 1 })); }catch(e){} }
      const q = () => { const o = { select(){ return o; }, eq(){ return o; }, order(){ return o; }, limit(){ return o; }, maybeSingle: async () => ({ data: { version: 1 } }), single: async () => ({ data: { datos: null, version: 1 } }), then(f, g){ return Promise.resolve({ data: [] }).then(f, g); } }; return o; };
      // Realtime simulado: guarda quién escucha y deja que la prueba «mande el aviso de la base de datos».
      window.__rt = { canales: {}, quitados: 0 };
      const canal = nombre => { const c = { nombre, cbs: [], on(tipo, filtro, cb){ c.cbs.push({ tipo, filtro, cb }); return c; }, subscribe(f){ c.f = f; window.__rt.canales[nombre] = c; setTimeout(() => f && f('SUBSCRIBED'), 10); return c; } }; return c; };
      window.__rtAviso = (nombre, evento) => { const c = window.__rt.canales[nombre]; if(!c) return false; c.cbs.filter(x => x.tipo === 'broadcast' && x.filtro.event === evento).forEach(x => x.cb({ event: evento, payload: {} })); return true; };
      window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'TOK' } } }), onAuthStateChange(){ return { data: { subscription: { unsubscribe(){} } } }; }, signOut: async () => ({}) },
        from: () => q(), rpc: async () => ({ data: [] }), channel: canal, removeChannel: async c => { window.__rt.quitados++; delete window.__rt.canales[c.nombre]; } }) };
    }, { neg: NEG, nube: o.nube !== false });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html?puerta=1'); await p.waitForTimeout(1800);
    // Ya entró a la app (en la pantalla de entrada la tapa se aparta: ahí se entra o se cambia de cuenta).
    if(!o.entrada) await p.evaluate(() => { const a = document.getElementById('authOverlay'); if(a) a.hidden = true; });
    await p.waitForTimeout(o.entrada ? 0 : 1700);
    return { ctx, p };
  }
  const listo = (p, cond, ms) => p.waitForFunction(cond, null, { timeout: ms || 6000 }).then(() => true, () => false);
  const puerta = p => p.evaluate(() => { const o = document.getElementById('vpOv'); return o ? { motivo: document.documentElement.getAttribute('data-vento-puerta'), txt: o.innerText } : null; });
  const estado = p => p.evaluate(() => { const s = ventoSuscripcion.estado(); return { status: s.status, plan: s.plan }; });

  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + x : '')); } };
  try{
    const { ctx, p } = await celular(b, {});
    chk('Con cuenta y estado firmado: la app abre', !(await puerta(p)));
    // ---------- Negocio bloqueado ----------
    bd.bloqueado = { tipo: 'negocio', motivo: 'Pago pendiente del mes' };
    const t0 = Date.now();
    await p.evaluate(n => window.__rtAviso('vs-' + n, 's'), NEG);
    const ok1 = await listo(p, () => document.documentElement.getAttribute('data-vento-puerta') === 'bloqueado', 4000);
    let g = await puerta(p);
    chk('ORDEVA Admin bloquea el negocio → la app queda tapada AL INSTANTE («🔒 Esta cuenta está bloqueada»)', ok1 && /Esta cuenta está bloqueada/.test(g.txt) && Date.now() - t0 < 3000, JSON.stringify(g));
    chk('…con el motivo que escribió el administrador', /Pago pendiente del mes/.test(g.txt), g && g.txt.slice(0, 200));
    chk('…solo «Volver a revisar» y «Cerrar sesión»', await p.evaluate(() => [...document.querySelectorAll('#vpOv [data-vp]')].map(x => x.dataset.vp).sort().join(',') === 'reintentar,salir'));
    chk('…y queda guardado en el equipo (sin token del plan)', await p.evaluate(n => !!localStorage.getItem('vento_sub_bloqueo:' + n) && !localStorage.getItem('vento_sub_token:' + n), NEG));
    // Se vuelve a abrir SIN internet: sigue bloqueado
    bd.offline = true;
    await p.reload(); await p.waitForTimeout(1500);
    await p.evaluate(() => { const a = document.getElementById('authOverlay'); if(a) a.hidden = true; });
    chk('Se vuelve a abrir sin internet: sigue bloqueado', await listo(p, () => document.documentElement.getAttribute('data-vento-puerta') === 'bloqueado', 5000), JSON.stringify(await puerta(p)));
    bd.offline = false; bd.bloqueado = null;
    await p.click('#vpOv [data-vp="reintentar"]');
    chk('Desbloqueado → «Volver a revisar» y la app abre sola', await listo(p, () => !document.getElementById('vpOv'), 6000), JSON.stringify(await puerta(p)));
    chk('…y se olvida el bloqueo guardado', await p.evaluate(n => !localStorage.getItem('vento_sub_bloqueo:' + n), NEG));
    // ---------- Usuario bloqueado ----------
    bd.bloqueado = { tipo: 'usuario' };
    await p.evaluate(n => window.__rtAviso('vs-' + n, 's'), NEG);
    await listo(p, () => document.documentElement.getAttribute('data-vento-puerta') === 'bloqueado', 4000);
    g = await puerta(p);
    chk('Usuario bloqueado → «🔒 Tu usuario está bloqueado»', !!g && /Tu usuario está bloqueado/.test(g.txt), JSON.stringify(g));
    bd.bloqueado = null;
    await p.evaluate(n => window.__rtAviso('vs-' + n, 's'), NEG);
    chk('Desbloqueado el usuario (aviso en vivo) → abre solo', await listo(p, () => !document.getElementById('vpOv'), 6000));
    // ---------- Sin base de datos, no funciona ----------
    bd.offline = true; await ctx.setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline')));
    chk('Sin internet (con el estado firmado todavía vigente): al pasar el tiempo sin la base de datos → «📡 Sin conexión con ORDEVA»',
      await listo(p, () => document.documentElement.getAttribute('data-vento-puerta') === 'sinconexion' && /necesita estar conectada/.test((document.getElementById('vpOv') || {}).innerText || ''), 9000), JSON.stringify(await puerta(p)));
    bd.offline = false; await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online')));
    chk('Vuelve el internet → la app abre sola', await listo(p, () => !document.getElementById('vpOv'), 9000), JSON.stringify(await puerta(p)));
    await ctx.close();
  }catch(e){ mal++; console.log('❌ ' + e.stack); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal'); process.exit(mal ? 1 : 0);
})();
