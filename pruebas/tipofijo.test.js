// Tipo de negocio FIJO (cambiarlo necesita permiso del administrador de Vento) y los tipos nuevos de ropa con tragos,
// contra el «Supabase local» REAL:
//  • al registrarse avisa que el tipo después no se cambia sin permiso; los tipos «Segunda Vuelta» (ropa de segunda y
//    tragos) y la Boutique (ropa nueva), sin tipos repetidos, con música y barra opcionales, se encuentran y siembran su carta;
//  • en Ajustes, elegir otro tipo NO lo cambia: pide confirmación y manda la solicitud (le llega al panel);
//  • el administrador la aprueba → la app cambia sola; la rechaza → la app lo avisa con el motivo y no cambia.
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
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const F = sb.url + '/functions/v1/vento-suscripciones';
    const cab = tok => ({ apikey: sb.anonKey, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
    const api = async (ruta, cuerpo, tok) => { const r = await fetch(F + ruta, { method: 'POST', headers: cab(tok), body: JSON.stringify(cuerpo || {}) }); return { st: r.status, j: await r.json().catch(() => ({})) }; };
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    const adm = await sb.usuario(ADMIN, 'Clave-Admin-99');
    await api('/admin/yo', {}, adm.token);

    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
    await enrutar(ctx, sb);
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });

    // Tipos nuevos en el catálogo
    const tipos = await p.evaluate(() => ['ropa_segunda', 'ropa', 'ropa', 'ropa_segunda'].map(k => { const t = window.VENTO_NEGOCIOS.get(k); return t && { k: t.k, n: t.nombre, fam: t.fam, fun: t.fun, esp: t.esp[0], prods: t.prods, campos: (t.campos || []).map(c => c[0]) }; }));
    chk('Tipo «Segunda Vuelta · Ropa de segunda» (tienda con música, barra y eventos: caja y mesas)', tipos[0] && /Segunda Vuelta/.test(tipos[0].n) && tipos[0].fam === 'tienda' && /m/.test(tipos[0].fun) && tipos[0].esp === 'Mesa' && /Michelada/.test(tipos[0].prods) && tipos[0].campos.includes('estado'), tipos[0]);
    chk('«Tienda de ropa / Boutique» (ropa nueva) también con música y barra opcionales', tipos[1] && /Boutique/.test(tipos[1].n) && /m/.test(tipos[1].fun) && tipos[1].campos.includes('tallas'), tipos[1]);
    chk('Sin tipos repetidos: el duplicado viejo apunta a la Boutique (y el de segunda al nuevo)', tipos[2] && tipos[2].k === 'ropa' && tipos[3] && tipos[3].k === 'ropa_segunda' &&
      await p.evaluate(() => window.VENTO_NEGOCIOS.CAT.filter(t => /ropa/i.test(t.k) && !/sastre|lavand/i.test(t.k)).map(t => t.k).sort().join() === 'ropa,ropa_segunda'), tipos);
    const busca = await p.evaluate(() => { const h = document.createElement('div'); document.body.appendChild(h); let r = []; window.ventoTipoPicker(h, 'tienda', () => {}, {}); const q = h.querySelector('.tp-q');
      const de = t => { q.value = t; q.dispatchEvent(new Event('input')); return [...h.querySelectorAll('.tp-it[data-k]')].map(b => b.dataset.k); };
      r = { usada: de('ropa usada'), paca: de('paca'), nueva: de('ropa nueva') }; h.remove(); return r; });
    chk('Se encuentran escribiendo «ropa usada», «paca» o «ropa nueva»', busca.usada.includes('ropa_segunda') && busca.paca.includes('ropa_segunda') && busca.nueva.includes('ropa'), busca);

    // Registro con el tipo nuevo: aviso de que queda fijo
    chk('Al elegir el tipo avisa que después solo se cambia con permiso del administrador', await p.evaluate(() => /solo se puede cambiar con permiso del administrador/.test((document.getElementById('authTipoAviso') || {}).textContent || '')));
    await p.evaluate(() => { document.getElementById('authType').value = 'ropa_segunda'; });
    await p.fill('#authBiz', 'La Paca Bar'); await p.fill('#authUser', 'dueno@paca.co'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    chk('Crea su cuenta y entra', await esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000));
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    chk('Queda en la nube', await esperar(p, () => !!window.ventoNube.negocio(), null, 12000));
    chk('Negocio «Segunda Vuelta» con su carta sembrada (ropa y tragos) y el tipo FIJO', await esperar(p, () => data.businessType === 'ropa_segunda' && data.tipoFijo === true && window.ventoTipo.fijo() &&
      data.products.some(x => /Michelada/.test(x.name)) && data.products.some(x => /segunda/.test(x.name)), null, 8000), await p.evaluate(() => ({ t: data.businessType, f: data.tipoFijo, n: data.products.map(x => x.name) })));

    // Ajustes: elegir otro tipo pide permiso y NO lo cambia
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="ajustes"]'); if(b) b.click(); try{ pintarPickerTipo(); }catch(e){} });
    chk('En Ajustes dice que el tipo está fijo', await esperar(p, () => /tipo de negocio está fijo/.test((document.getElementById('accTipoEstado') || {}).textContent || '')));
    await p.evaluate(() => { const q = document.querySelector('#accTypePick .tp-q'); q.value = 'boutique'; q.dispatchEvent(new Event('input')); });
    await p.evaluate(() => document.querySelector('#accTypePick .tp-it[data-k="ropa"]').click());
    chk('Elegir otro tipo pide confirmación para pedir permiso', await esperar(p, () => document.getElementById('confirmOverlay').classList.contains('show') && /permiso del administrador/.test(document.getElementById('confirmOverlay').textContent)));
    await p.click('#confirmOkBtn');
    chk('…manda la solicitud (pendiente) y el tipo NO cambia', await esperar(p, () => /esperando la aprobación/.test((document.getElementById('accTipoEstado') || {}).textContent || '')) && await p.evaluate(() => data.businessType === 'ropa_segunda'));
    let l = (await api('/admin/tipos', {}, adm.token)).j.solicitudes || [];
    const s1 = l.find(x => x.a === 'ropa');
    chk('Le llega al panel del administrador (de → a, con el negocio)', !!s1 && s1.de === 'ropa_segunda' && s1.negocio === 'La Paca Bar', l);
    // Cambiar el tipo «a mano» en los datos tampoco sirve: el selector lo devuelve
    await p.evaluate(() => { const sel = document.getElementById('accType'); sel.value = 'tienda'; sel.dispatchEvent(new Event('change')); });
    chk('El selector escondido tampoco lo cambia', await p.evaluate(() => data.businessType === 'ropa_segunda'));

    // El administrador lo aprueba → la app cambia sola
    await api('/admin/tipo_resolver', { solicitud: s1.id, aprobar: true }, adm.token);
    await p.evaluate(() => window.ventoTipo.revisar());
    chk('Aprobado: la app cambia sola a «Boutique» y lo marca aplicado', await esperar(p, () => data.businessType === 'ropa', null, 10000) &&
      (await sb.sql('select estado from cambios_tipo where id = $1', [s1.id]))[0].estado === 'aplicado');

    // Otra solicitud, rechazada con motivo
    await p.evaluate(() => { window.ventoTipo.pedir('bar'); });
    await esperar(p, () => document.getElementById('confirmOverlay').classList.contains('show'));
    await p.click('#confirmOkBtn');
    await esperar(p, () => /esperando la aprobación/.test((document.getElementById('accTipoEstado') || {}).textContent || ''));
    l = (await api('/admin/tipos', {}, adm.token)).j.solicitudes || [];
    const s2 = l.find(x => x.a === 'bar');
    await api('/admin/tipo_resolver', { solicitud: s2.id, aprobar: false, respuesta: 'Sigue con la ropa' }, adm.token);
    await new Promise(x => setTimeout(x, 3200));
    await p.evaluate(() => window.ventoTipo.revisar());
    chk('Rechazado: avisa con el motivo y el tipo NO cambia', await esperar(p, () => /no aprobó el cambio/.test((document.getElementById('accTipoEstado') || {}).textContent || '') && /Sigue con la ropa/.test(document.getElementById('accTipoEstado').textContent), null, 10000) &&
      await p.evaluate(() => data.businessType === 'ropa'));
  }
})();
