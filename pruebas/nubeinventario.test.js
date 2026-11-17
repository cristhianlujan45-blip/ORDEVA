// ☁️ ORDEVA 1.99.15 · «Se perdieron los productos inventariados» — con la app real y el «Supabase local» REAL.
//  1. Un equipo con algo VACÍO guardado como conexión (de una versión vieja) usa igual la conexión que viene con la app:
//     queda «conectado» sin pedir los datos de Supabase.
//  2. El caso del dueño: su cuenta tiene en la nube un negocio con 2 productos; en OTRO equipo (que tenía la nube apagada)
//     el mismo correo tiene un negocio con 30 productos inventariados y 3 ventas. Al entrar con la nube encendida, el equipo
//     se vincula a la cuenta y los 30 productos (y las 3 ventas) se AGREGAN y suben a la nube: no se pierden (antes
//     mandaba la nube y quedaban solo los 2). Los 2 de la nube siguen ahí.
//  3. Los productos de muestra que la app pone al crear el negocio (id «prod-…») no se suben, y uno con el mismo nombre
//     que ya está en la nube no se repite.
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
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const sb = await iniciar(); const b = await chromium.launch();
  try{ await pruebas(); } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {});
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const esperar = (p, fn, arg, ms) => p.waitForFunction(([f, a]) => { try{ return (0, eval)('(' + f + ')')(a); }catch(e){ return false; } }, [String(fn), arg], { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    const uno = async (q, pr) => (await sb.sql(q, pr))[0];
    async function equipo(nombre, cfgInicial, exigirCorreo){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(c => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); if(c && !sessionStorage.getItem('cfg-puesta')){ localStorage.setItem('vento_nube_cfg', JSON.stringify(c)); sessionStorage.setItem('cfg-puesta', '1'); } }catch(e){} }, cfgInicial || null);
      if(exigirCorreo) await ctx.addInitScript(() => { window.__ventoExigirCorreo = true; });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      return { ctx, p };
    }
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    const entrar = async (p, u, c) => { await p.fill('#authUser', u); await p.fill('#authPass', c); await p.click('#authBtn'); };
    const datosNube = async email => (await uno("select d.datos from datos_negocio d join miembros m on m.negocio_id = d.negocio_id join auth.users u on u.id = m.usuario_id where u.email = $1", [email])).datos;

    // ===== 1 + preparación: el negocio de la cuenta en la nube, con 2 productos =====
    const A = await equipo('celular A', { url: '', key: '' });     // algo vacío guardado: igual usa la conexión de la app
    chk('1. Con una conexión vacía guardada, ORDEVA usa la que viene con la app (no pide Supabase)', await A.p.evaluate(() => window.ventoNube.configurada()));
    await A.p.fill('#authBiz', 'Tienda Inventario'); await entrar(A.p, 'dueno@inventario.co', 'clave-dueno-1');
    chk('Celular A: crea la cuenta y su negocio queda en la nube', await dentro(A.p) && await esperar(A.p, () => !!window.ventoNube.negocio(), null, 20000));
    await A.p.evaluate(async () => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.products = [{ id: 'nube1', name: 'Arroz', price: 3000, stock: 4 }, { id: 'nube2', name: 'Aceite', price: 9000, stock: 2 }]; data.categories = [{ id: 'cat-inv', name: 'Entradas' }]; await saveData(); });   // «cat-inv» con OTRO nombre
    chk('Celular A: la nube queda con 2 productos', await (async () => { for(let i = 0; i < 60; i++){ const d = await datosNube('dueno@inventario.co'); if(d && (d.products || []).length === 2) return true; await new Promise(r => setTimeout(r, 500)); } return false; })());
    await A.ctx.close();

    // ===== 2. Otro equipo, con la nube apagada, tiene el negocio inventariado del mismo correo =====
    const B = await equipo('celular B', { url: '', key: '', off: true });
    await B.p.fill('#authBiz', 'Tienda Inventario'); await entrar(B.p, 'dueno@inventario.co', 'clave-dueno-1');
    chk('Celular B (sin nube): entra y trabaja solo en el equipo', await dentro(B.p) && !(await B.p.evaluate(() => window.ventoNube.configurada())));
    await B.p.evaluate(async () => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      const P = Array.from({ length: 30 }, (_, i) => ({ id: 'inv' + i, name: 'Producto inventariado ' + i, price: 1000 + i, stock: 10 + i, categoryId: 'cat-inv' }));
      P.push({ id: 'prod-muestra-1', name: 'Hamburguesa de muestra', price: 1 });            // de muestra y sin usar: no sube
      P.push({ id: 'prod-cerveza', name: 'Cerveza Club', price: 4000, stock: 24 });           // de muestra PERO inventariada: sube
      P.push({ id: 'otroId', name: 'arroz', price: 3100 });                                   // mismo nombre que en la nube: no se repite
      data.products = P; data.categories = [{ id: 'cat-inv', name: 'Inventario' }];
      const ahora = Date.now();
      data.history = [1, 2, 3].map(i => ({ id: 'vb' + i, date: new Date(ahora - i * 36e5).toISOString(), total: 5000, items: [{ name: 'Producto inventariado 1', qty: 1, price: 5000 }], payments: [{ method: 'efectivo', amount: 5000 }] }));
      await saveData();
    });
    // Se enciende la nube (como al actualizar a esta versión: lo guardado vacío ya no la apaga) y vuelve a entrar.
    await B.p.evaluate(() => { localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); localStorage.removeItem('cm-session'); try{ saveData(); }catch(e){} });
    await B.p.reload(); await B.p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    chk('Celular B: al actualizar, la nube queda encendida sola', await B.p.evaluate(() => window.ventoNube.configurada()));
    await entrar(B.p, 'dueno@inventario.co', 'clave-dueno-1');
    chk('Celular B: entra y se vincula a la cuenta', await dentro(B.p) && await esperar(B.p, () => !!window.ventoNube.negocio(), null, 25000));
    const listo = await (async () => { for(let i = 0; i < 80; i++){ const d = await datosNube('dueno@inventario.co'); if(d && (d.products || []).length >= 33 && (d.history || []).length >= 3) return d; await new Promise(r => setTimeout(r, 500)); } return datosNube('dueno@inventario.co'); })();
    const ids = (listo.products || []).map(x => x.id);
    chk('2. En la nube: los 30 productos inventariados de B + la cerveza de muestra inventariada + los 2 que ya estaban (33), con su stock', ids.length === 33 && ids.includes('prod-cerveza') && ids.includes('nube1') && ids.includes('nube2') && Array.from({ length: 30 }, (_, i) => 'inv' + i).every(x => ids.includes(x)) && (listo.products.find(x => x.id === 'inv5') || {}).stock === 15, { n: ids.length, ids: ids.slice(0, 40) });
    chk('2. …y las 3 ventas de B', ['vb1', 'vb2', 'vb3'].every(x => (listo.history || []).some(h => h.id === x)), (listo.history || []).map(h => h.id));
    const catInv = (listo.categories || []).find(c => c.name === 'Inventario'), p5 = (listo.products || []).find(x => x.id === 'inv5') || {};
    chk('2. …y su categoría «Inventario»: como en la nube «cat-inv» es «Entradas», va con otro id y los productos apuntan a ella (no quedan en «Entradas»)', !!catInv && catInv.id !== 'cat-inv' && p5.categoryId === catInv.id && (listo.categories || []).some(c => c.id === 'cat-inv' && c.name === 'Entradas'), { cats: listo.categories, cat5: p5.categoryId });
    chk('3. El de muestra no subió y «arroz» (mismo nombre que «Arroz») no se repitió', !ids.includes('prod-muestra-1') && !ids.includes('otroId'), ids.filter(x => !/^inv/.test(x)));
    chk('2. El celular B también ve los 33', await esperar(B.p, () => data.products.filter(p => !/^prod-/.test(p.id) || p.id === 'prod-cerveza').length >= 33, null, 10000), await B.p.evaluate(() => data.products.length));

    // ===== 4. Crear una cuenta nueva con un usuario sin correo, con la nube disponible: pide el correo =====
    const D = await equipo('celular D', null, true);
    await D.p.fill('#authBiz', 'Otro Negocio'); await entrar(D.p, 'pepito', 'clave-pepito-1');
    chk('4. Con la nube disponible, crear un negocio con un usuario sin correo pide el correo (no queda solo en el equipo)', await esperar(D.p, () => /Escribe tu correo/.test(document.getElementById('authErr').textContent), null, 5000) && !(await D.p.evaluate(() => document.getElementById('authOverlay').hidden)));
    await D.ctx.close();

    // ===== Un tercer equipo nuevo entra con el correo y tiene TODO =====
    const C = await equipo('celular C');
    await C.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await entrar(C.p, 'dueno@inventario.co', 'clave-dueno-1');
    chk('Un celular nuevo: entra con el correo y tiene los 33 productos y las 3 ventas', await dentro(C.p) && await esperar(C.p, () => data.products.filter(p => !/^prod-/.test(p.id) || p.id === 'prod-cerveza').length >= 33 && ['vb1', 'vb2', 'vb3'].every(x => data.history.some(h => h.id === x)), null, 25000),
      await C.p.evaluate(() => ({ p: data.products.length, h: data.history.length })));
  }
})();
