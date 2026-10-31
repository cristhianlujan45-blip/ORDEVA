// 🔄 Sincronización que no se traba (1.65.10), contra el «Supabase local» REAL (PostgreSQL + supabase-js).
// Antes, si una llamada al servidor no contestaba o la copia local (IndexedDB) no respondía, ese equipo dejaba de subir
// y de revisar la nube hasta cerrar la app: lo de una cuenta no se veía en los otros equipos.
//  1. Celular A: el guardado no contesta (se queda colgado) → a los segundos se da por perdido y se vuelve a intentar:
//     lo que agregó A le llega a B.
//  2. Celular A: el guardado se cuelga y no hay tope para la llamada → el vigilante suelta la sincronización trabada,
//     vuelve a subir y lo anota en los errores del equipo (para el administrador).
//  3. Celular C: su copia local (IndexedDB) nunca contesta → igual sube y baja: lo de C le llega a B, y lo de B a C.
//  4. Una mesa: lo que A agrega a una cuenta abierta se ve en B.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const { spawnSync } = require('child_process');
function hayPostgres(){
  if(process.env.VENTO_PG_URL) return true;
  if(fs.existsSync('/usr/lib/postgresql')) return true;
  return spawnSync('bash', ['-c', 'command -v psql || command -v pg_ctl'], { stdio: 'ignore' }).status === 0;
}
if(!process.env.VENTO_LOGS) for(const k of ['log', 'warn', 'error']){
  const orig = console[k].bind(console);
  console[k] = (...a) => { if(typeof a[0] === 'string' && a[0].startsWith('{"t":"')) return; orig(...a); };
}

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (este equipo no tiene PostgreSQL: se omitió esta prueba)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar();
  const b = await chromium.launch();
  try{ await pruebas(); }
  catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página en ningún celular', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000 }).then(() => true, () => false);
    async function celular(nombre, init){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      if(init) await ctx.addInitScript(init);
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { nombre, ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => { localStorage.setItem('cm-tutorial-seen', '1'); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    async function crear(p, biz, email, pass){ await p.fill('#authBiz', biz); await p.fill('#authUser', email); await p.fill('#authPass', pass); await p.click('#authBtn'); }
    const agregar = (p, nom) => p.evaluate(n => { data.products.push({ id: 'p-' + n.replace(/\W/g, ''), name: n, price: 4000, categoryId: null }); saveData(); }, nom);
    const tiene = (p, nom, ms) => { const vis = () => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {}); vis(); return esperar(p, n => data.products.some(x => x.name === n), nom, ms || 15000); };
    // Cuelga (sin contestar nunca) las próximas «n» llamadas a guardar_datos o guardar_cambios (1.69.0: subir por partes) de ese celular.
    async function colgarGuardado(c, n){
      let quedan = n; c.colgadas = c.colgadas || 0;
      await c.p.route(/\/rest\/v1\/rpc\/guardar_(datos|cambios)/, rt => { if(quedan > 0){ quedan--; c.colgadas++; return; } return rt.fallback(); });
    }

    // Preparar: A crea la cuenta, B entra a la misma
    const A = await celular('celular A');
    await crear(A.p, 'Bar Trabado', 'trabado@bar.co', 'clave123');
    await dentro(A.p); await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(A.p);
    await esperar(A.p, () => !!window.ventoNube.negocio(), null, 10000);
    await agregar(A.p, 'Club Inicio');
    const B = await celular('celular B');
    await crear(B.p, 'Otro', 'trabado@bar.co', 'clave123');
    await dentro(B.p); await cerrarTodo(B.p);
    chk('Preparación: A y B en la misma cuenta, B ve lo de A', await tiene(B.p, 'Club Inicio'));

    // ===== 1. El guardado no contesta: tope y nuevo intento =====
    await A.p.evaluate(() => { const T = window.ventoNube._tiempos; T.rpc = 2500; T.reintento = 1500; });
    await colgarGuardado(A, 1);
    await agregar(A.p, 'Hielo de A');
    chk('1. El primer guardado de A se quedó colgado (sin respuesta del servidor)', await esperar(A.p, () => true, null, 1000) && await new Promise(r => setTimeout(r, 1200)).then(() => A.colgadas === 1), A.colgadas);
    chk('1. Igual a B le llega lo que agregó A (A dio por perdido el guardado y lo volvió a intentar)', await tiene(B.p, 'Hielo de A', 20000));
    chk('1. A no quedó ocupado subiendo', await esperar(A.p, () => !window.ventoNube._ocupado().subiendo, null, 8000));

    // ===== 2. Sin tope en la llamada: el vigilante suelta la sincronización trabada =====
    await A.p.evaluate(() => { const T = window.ventoNube._tiempos; T.rpc = 1e9; T.trabada = 4000; });
    await colgarGuardado(A, 1);
    await agregar(A.p, 'Limón de A');
    chk('2. A quedó trabado subiendo (la llamada nunca vuelve)', await esperar(A.p, () => window.ventoNube._ocupado().subiendo, null, 3000));
    chk('2. El vigilante lo suelta y a B le llega lo que agregó A', await tiene(B.p, 'Limón de A', 25000));
    const anotado = await A.p.evaluate(() => (window.ventoErrores ? window.ventoErrores.pendientes() : []).concat(window.__errEnviados || []).map(e => JSON.stringify(e)).join(' '));
    chk('2. Quedó anotado en los errores del equipo («sincronización estaba trabada»)', /sincronizaci[oó]n estaba trabada/i.test(anotado) || await A.p.evaluate(() => { try{ return /trabada/.test(localStorage.getItem('vento_errores_enviados') || ''); }catch(e){ return false; } }), anotado.slice(0, 300));
    await A.p.evaluate(() => { const T = window.ventoNube._tiempos; T.rpc = 20000; T.trabada = 60000; });

    // ===== 3. La copia local (IndexedDB) no contesta =====
    const C = await celular('celular C', () => {
      const orig = indexedDB.open.bind(indexedDB);
      indexedDB.open = function(nombre, v){ if(nombre === 'vento-nube'){ return {}; } return orig(nombre, v); };   // nunca contesta
    });
    await crear(C.p, 'Otro', 'trabado@bar.co', 'clave123');
    await dentro(C.p); await cerrarTodo(C.p);
    chk('3. C (sin copia local que conteste) baja los datos de la cuenta', await tiene(C.p, 'Limón de A', 20000));
    await agregar(C.p, 'Sal de C');
    chk('3. Lo que agrega C le llega a B', await tiene(B.p, 'Sal de C', 25000));
    await agregar(B.p, 'Tajín de B');
    chk('3. Y lo de B le llega a C', await tiene(C.p, 'Tajín de B', 25000));

    // ===== 4. Una cuenta (mesa) abierta en A se ve en B =====
    await A.p.evaluate(() => { data.tables[7] = { items: [{ productId: 'p-HielodeA', name: 'Hielo de A', price: 4000, qty: 3 }], payments: [], people: [] }; saveData(); });
    await B.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    chk('4. La cuenta 7 que abrió A (Hielo ×3) se ve en B', await esperar(B.p, () => !!(data.tables[7] && data.tables[7].items.some(i => i.name === 'Hielo de A' && i.qty === 3)), null, 20000),
      await B.p.evaluate(() => data.tables[7] || null));
  }
})();
