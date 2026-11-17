// 📱 ORDEVA 1.99.16 · «Entré con la cuenta de Cristian WKH en el Xiaomi y me salen otros datos (Cervecería)» — con la app
// real y el «Supabase local» REAL.
//  1. Un celular conectado a la cuenta «otra» (su negocio con 1 producto). En ESE celular se entra con la cuenta «wkh»
//     (que en la nube tiene «Tienda Vito» con 40 productos y 5 ventas): baja «Tienda Vito» completo y NO mezcla los dos
//     negocios (el producto de la otra cuenta no pasa a «Tienda Vito»).
//  2. Lo guardado en el celular quedó como «null» (lo que tenía el Xiaomi): la app ya no se cae al abrir
//     («reading 'tables'»): arranca y baja el negocio de la nube.
//  3. Si la sesión es de una cuenta y el celular está conectado a otra: aviso «Este celular está conectado a otra
//     cuenta» con «Ver los datos de …», que pide la contraseña y trae los datos de la cuenta con la que se entró.
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
    const datosNube = async email => (await uno("select d.datos from datos_negocio d join miembros m on m.negocio_id = d.negocio_id join auth.users u on u.id = m.usuario_id where u.email = $1", [email])).datos;
    async function equipo(nombre){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      return { ctx, p };
    }
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 20000);
    const entrar = async (p, u, c) => { await p.fill('#authUser', u); await p.fill('#authPass', c); await p.click('#authBtn'); };
    const cerrar = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // ===== La cuenta «wkh» con su «Tienda Vito» en la nube (desde otro celular) =====
    const S = await equipo('Samsung');
    await S.p.fill('#authBiz', 'Tienda Vito'); await entrar(S.p, 'wkh+cliente@prueba.co', 'clave-wkh-1');
    chk('Samsung: crea «wkh» y su negocio queda en la nube', await dentro(S.p) && await esperar(S.p, () => !!window.ventoNube.negocio(), null, 20000));
    await cerrar(S.p);
    await S.p.evaluate(async () => { data.businessName = 'Tienda Vito'; data.products = Array.from({ length: 40 }, (_, i) => ({ id: 'tv' + i, name: 'Producto Vito ' + i, price: 2000, stock: 5 })); const t = Date.now(); data.history = [1, 2].map(i => ({ id: 'vv' + i, date: new Date(t - i * 36e5).toISOString(), total: 2000, items: [{ name: 'Producto Vito 1', qty: 1, price: 2000 }], payments: [{ method: 'efectivo', amount: 2000 }] })); await saveData(); });
    chk('Samsung: la nube de «wkh» queda con 40 productos y 2 ventas', await (async () => { for(let i = 0; i < 60; i++){ const d = await datosNube('wkh+cliente@prueba.co'); if(d && (d.products || []).length === 40 && (d.history || []).length === 2) return true; await new Promise(r => setTimeout(r, 500)); } return false; })());
    await S.ctx.close();

    // ===== 1. El Xiaomi: conectado a la cuenta «otra»; luego entra con «wkh» =====
    const X = await equipo('Xiaomi');
    await X.p.fill('#authBiz', 'Cervecería'); await entrar(X.p, 'otra@prueba.co', 'clave-otra-1');
    chk('Xiaomi: entra con «otra» y queda conectado a su negocio', await dentro(X.p) && await esperar(X.p, () => !!window.ventoNube.negocio() && window.ventoNube.correo() === 'otra@prueba.co', null, 20000));
    await cerrar(X.p);
    await X.p.evaluate(async () => { data.products = [{ id: 'solo-otra', name: 'Producto de la otra cuenta', price: 1000, stock: 1 }]; await saveData(); });
    await esperar(X.p, () => true, null, 500);
    // En este celular también existe el usuario «wkh» (ya había entrado antes): se entra con él.
    await X.p.evaluate(async () => { await authAddUser('wkh+cliente@prueba.co', 'clave-wkh-1', 'admin'); try{ saveData(); }catch(e){} localStorage.removeItem('cm-session'); });
    await X.p.reload(); await X.p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
    await X.p.click('#authTabs [data-tab="entrar"]').catch(() => {});
    await entrar(X.p, 'wkh+cliente@prueba.co', 'clave-wkh-1');
    chk('1. Xiaomi: entra con «wkh» y queda conectado a SU negocio', await dentro(X.p) && await esperar(X.p, () => window.ventoNube.correo() === 'wkh+cliente@prueba.co', null, 25000));
    chk('1. …y ve «Tienda Vito» con sus 40 productos y 2 ventas', await esperar(X.p, () => data.businessName === 'Tienda Vito' && data.products.filter(p => /^tv/.test(p.id)).length === 40 && data.history.length === 2, null, 25000), await X.p.evaluate(() => ({ n: data.businessName, p: data.products.length, h: data.history.length })));
    await new Promise(r => setTimeout(r, 2500));
    const vito = await datosNube('wkh+cliente@prueba.co');
    chk('1. No mezcla los negocios: el producto de «otra» no pasó a «Tienda Vito» (ni en el celular ni en la nube)', !(vito.products || []).some(p => p.id === 'solo-otra') && !(await X.p.evaluate(() => data.products.some(p => p.id === 'solo-otra'))), (vito.products || []).length);
    const otra = await datosNube('otra@prueba.co');
    chk('1. Lo de «otra» sigue en su nube', (otra.products || []).some(p => p.id === 'solo-otra'));

    // ===== 2. Lo guardado quedó «null» =====
    await X.p.evaluate(async () => { await storageSet(STORAGE_KEY, 'null'); try{ localStorage.setItem(STORAGE_KEY, 'null'); }catch(e){} });
    const errsAntes = errs.length;
    await X.p.reload();
    chk('2. Con lo guardado en «null», la app abre sin caerse y vuelve a bajar «Tienda Vito»', await esperar(X.p, () => !!data && data.businessName === 'Tienda Vito' && data.products.filter(p => /^tv/.test(p.id)).length === 40, null, 25000) && errs.length === errsAntes,
      { errs: errs.slice(errsAntes), d: await X.p.evaluate(() => data && { n: data.businessName, p: data.products.length }) });
    await new Promise(r => setTimeout(r, 3000));
    const nube2 = await datosNube('wkh+cliente@prueba.co');
    chk('2. …y la nube NO se pisó con los datos de muestra (sigue «Tienda Vito» con sus 40 productos y 2 ventas)', nube2.businessName === 'Tienda Vito' && (nube2.products || []).filter(p => /^tv/.test(p.id)).length === 40 && (nube2.history || []).length === 2, { n: nube2.businessName, p: (nube2.products || []).length, h: (nube2.history || []).length });

    // ===== 2b. Lo mismo, pero SIN internet al abrir: se alcanza a guardar algo sobre los datos de muestra y se vuelve a
    // abrir (ya con internet). La nube tampoco se pisa y vuelve «Tienda Vito» (con solo 2 ventas, la red de seguridad
    // vieja de «se borraron las ventas» no alcanzaba a protegerla).
    const corte = r => r.abort('internetdisconnected');
    await X.ctx.route(/^https:\/\/[\w-]+\.supabase\.co\/rest\//, corte);
    await X.p.evaluate(async () => { await storageSet(STORAGE_KEY, 'null'); try{ localStorage.setItem(STORAGE_KEY, 'null'); }catch(e){} });
    await X.p.reload();
    await esperar(X.p, () => !!data && document.getElementById('authOverlay').hidden, null, 20000);
    await new Promise(r => setTimeout(r, 3500));
    await X.p.evaluate(async () => { data.products.push({ id: 'sin-red', name: 'Hecho sin internet', price: 500 }); await saveData(); });
    await new Promise(r => setTimeout(r, 1500));
    await X.ctx.unroute(/^https:\/\/[\w-]+\.supabase\.co\/rest\//, corte);
    const errsAntes2 = errs.length;
    await X.p.reload();
    await X.p.evaluate(async () => { try{ data.products.push({ id: 'al-abrir', name: 'Tocado al abrir', price: 1 }); await saveData(); }catch(e){} });
    chk('2b. Sin internet al abrir y vuelta a abrir: baja otra vez «Tienda Vito»', await esperar(X.p, () => !!data && data.businessName === 'Tienda Vito' && data.products.filter(p => /^tv/.test(p.id)).length === 40, null, 25000) && errs.length === errsAntes2,
      { errs: errs.slice(errsAntes2), d: await X.p.evaluate(() => data && { n: data.businessName, p: data.products.length }) });
    await new Promise(r => setTimeout(r, 3000));
    const nube3 = await datosNube('wkh+cliente@prueba.co');
    chk('2b. …y la nube sigue intacta (sin los datos de muestra)', nube3.businessName === 'Tienda Vito' && (nube3.products || []).filter(p => /^tv/.test(p.id)).length === 40 && (nube3.history || []).length === 2 && !(nube3.products || []).some(p => p.id === 'sin-red'), { n: nube3.businessName, p: (nube3.products || []).length, h: (nube3.history || []).length });
    chk('2b. Lo que se hizo sobre los datos de muestra quedó en un punto de restauración', await X.p.evaluate(async () => { try{ const l = JSON.stringify(await autoBackupPoints()); return l.indexOf('sin-red') >= 0; }catch(e){ return 'err ' + e.message; } }));

    // ===== 3. Sesión de una cuenta, celular conectado a otra =====
    await X.p.evaluate(() => { authUser = 'otra@prueba.co'; document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b2 = document.querySelector('nav button[data-view="inicio"]') || document.querySelector('.more-tile[data-go="inicio"]'); b2 && b2.click(); window.ventoSoloLocal.pintar(); });
    const t3 = await X.p.evaluate(() => { const a = document.getElementById('soloLocalAviso'); return a && a.offsetParent ? a.innerText.replace(/\s+/g, ' ') : null; });
    chk('3. Aviso «Este celular está conectado a otra cuenta» con «Ver los datos de otra@prueba.co»', !!t3 && /conectado a otra cuenta/.test(t3) && /Ver los datos de otra@prueba\.co/.test(t3), t3);
    await X.p.click('#soloLocalAviso [data-sl="conectar"]');
    await X.p.waitForSelector('#promptOverlay.show', { timeout: 5000 });
    await X.p.fill('#promptInput', 'clave-otra-1'); await X.p.click('#promptOkBtn');
    chk('3. Con la contraseña, el celular pasa a la cuenta «otra» y trae su negocio (y el aviso se va)', await esperar(X.p, () => window.ventoNube.correo() === 'otra@prueba.co' && data.products.some(p => p.id === 'solo-otra') && !data.products.some(p => /^tv/.test(p.id)) && (window.ventoSoloLocal.pintar(), !document.getElementById('soloLocalAviso')), null, 25000),
      await X.p.evaluate(() => ({ c: window.ventoNube.correo(), p: data.products.map(p => p.id).slice(0, 5) })));

    // ===== 4. Contraseña mal puesta primero (eso suelta la conexión con «otra») y luego la buena: tampoco mezcla =====
    await X.p.evaluate(async () => { try{ await window.ventoNube.entrarCuenta('wkh+cliente@prueba.co', 'clave-MAL'); }catch(e){} });
    chk('4. Con la contraseña mal, el celular queda sin conexión (y anotado a qué negocio pertenece lo de aquí)', await X.p.evaluate(() => !window.ventoNube.negocio() && !!(window.ventoNube.previo && window.ventoNube.previo())));
    await X.p.evaluate(async () => { await authConectarNube('wkh+cliente@prueba.co', 'clave-wkh-1', false); });
    chk('4. Con la buena: trae «Tienda Vito» y no le pasa lo de «otra»', await esperar(X.p, () => window.ventoNube.correo() === 'wkh+cliente@prueba.co' && data.businessName === 'Tienda Vito' && !data.products.some(p => p.id === 'solo-otra'), null, 25000),
      await X.p.evaluate(() => ({ c: window.ventoNube.correo(), n: data.businessName })));
    await new Promise(r => setTimeout(r, 3000));
    const vito4 = await datosNube('wkh+cliente@prueba.co');
    chk('4. …ni en la nube de «Tienda Vito»', !(vito4.products || []).some(p => p.id === 'solo-otra') && vito4.businessName === 'Tienda Vito', (vito4.products || []).length);
  }
})();
