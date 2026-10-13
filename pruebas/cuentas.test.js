// Cuentas con correo = UNA cuenta en todos los celulares (contra el «Supabase local» REAL: PostgreSQL + supabase-js).
//  1. Celular A crea la cuenta con su correo desde la pantalla de entrada → queda en la nube con su negocio.
//  2. Celular B intenta CREAR otra cuenta con el mismo correo: no se crea otra (con otra contraseña la rechaza;
//     con la misma contraseña entra a la que ya existe y ve los mismos datos).
//  3. Celular C (nuevo) «¿Ya tienes cuenta?» → entra con el correo y baja los mismos datos; contraseña mala → error.
//  4. Lo que cambia un celular le llega al otro.
//  5. Una cuenta vieja con correo que solo estaba en un celular se sube sola a la nube al entrar.
//  6. Dos cuentas con correo en el mismo celular: cada una sincroniza con SU negocio (no se mezclan).
//  7. Con un servidor que pide confirmar el correo tampoco se repite la cuenta.
// Sin PostgreSQL en el equipo se omite (como «flujocompleto»).
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
    const uno = async (q, p) => (await sb.sql(q, p))[0];
    const usuarios = async email => Number((await uno('select count(*) n from auth.users where lower(email) = $1', [email])).n);
    const nubeDe = async neg => uno('select datos, version from datos_negocio where negocio_id = $1', [neg]);
    const nombres = d => ((d && d.products) || []).map(p => p.name);
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000 }).then(() => true, () => false);
    async function esperarNube(neg, fn, ms){ const t = Date.now(); while(Date.now() - t < (ms || 10000)){ const n = await nubeDe(neg); if(n && fn(n.datos)) return true; await new Promise(r => setTimeout(r, 250)); } return false; }

    async function celular(nombre){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return { nombre, ctx, p };
    }
    const cerrarTodo = p => p.evaluate(() => { localStorage.setItem('cm-tutorial-seen', '1'); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });
    const dentro = p => esperar(p, () => document.getElementById('authOverlay').hidden, null, 15000);
    async function crear(p, biz, email, pass){
      await p.fill('#authBiz', biz); await p.fill('#authUser', email); await p.fill('#authPass', pass);
      await p.click('#authBtn');
    }
    async function entrar(p, email, pass){
      await p.fill('#authUser', email); await p.fill('#authPass', pass);
      await p.click('#authBtn');
    }
    const errorEntrada = p => esperar(p, () => !!document.getElementById('authErr').textContent && !document.getElementById('authBtn').disabled, null, 10000).then(() => p.textContent('#authErr'));
    const negocio = p => p.evaluate(() => window.ventoNube.negocio());
    const agregar = (p, nom) => p.evaluate(n => { data.products.push({ id: 'p-' + n.replace(/\W/g, ''), name: n, price: 4000, categoryId: null }); saveData(); }, nom);
    const salirApp = async p => { await p.evaluate(() => { localStorage.removeItem('cm-session'); }); await p.reload(); await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 }); await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta); };

    // ===== 1. Celular A crea la cuenta con su correo =====
    const A = await celular('celular A');
    chk('1. Pantalla de primera vez: dice «Correo o usuario» y ofrece «¿Ya tienes cuenta?»', /Correo o usuario/.test(await A.p.textContent('#authForm')) && /Ya tienes cuenta/.test(await A.p.textContent('#authNueva')) && await A.p.isVisible('#authNueva'));
    await crear(A.p, 'Bar Ana', 'Ana@Bar.co', 'clave123');
    chk('1. Celular A entra a la app', await dentro(A.p));
    await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(A.p);
    chk('1. Queda conectado a su negocio en la nube', await esperar(A.p, () => !!window.ventoNube.negocio(), null, 10000), await A.p.evaluate(() => window.ventoNube.estado()));
    const NEG = (await negocio(A.p)).id;
    const fila = await uno('select n.nombre, m.rol, u.email from negocios n join miembros m on m.negocio_id = n.id join auth.users u on u.id = m.usuario_id where n.id = $1', [NEG]);
    chk('1. En la base: el correo (en minúsculas) es dueño de «Bar Ana»', fila && fila.nombre === 'Bar Ana' && fila.rol === 'dueno' && fila.email === 'ana@bar.co', fila);
    await agregar(A.p, 'Club Ana');
    chk('1. Lo que se crea en A sube a la nube', await esperarNube(NEG, d => nombres(d).includes('Club Ana')));

    // ===== 2. Celular B intenta crear OTRA cuenta con el mismo correo =====
    const B = await celular('celular B');
    await crear(B.p, 'Bar Copia', 'ana@bar.co', 'otraclave9');
    const e2 = await errorEntrada(B.p);
    chk('2. Mismo correo con otra contraseña: no deja crear otra cuenta', /ya tiene una cuenta/i.test(e2) && !(await B.p.evaluate(() => document.getElementById('authOverlay').hidden)), e2);
    chk('2. En la base sigue habiendo UNA sola cuenta con ese correo', await usuarios('ana@bar.co') === 1);
    await crear(B.p, 'Bar Copia', 'ana@bar.co', 'clave123');
    chk('2. Mismo correo y su contraseña: entra a la cuenta que ya existe (no crea otra)', await dentro(B.p));
    await cerrarTodo(B.p);
    chk('2. B quedó en el MISMO negocio de la nube', await esperar(B.p, n => (window.ventoNube.negocio() || {}).id === n, NEG, 10000));
    chk('2. B ve los datos de A («Club Ana», nombre «Bar Ana»)', await esperar(B.p, () => data.products.some(p => p.name === 'Club Ana') && data.businessName === 'Bar Ana', null, 10000), await B.p.evaluate(() => data.businessName));
    chk('2. No se creó ningún negocio «Bar Copia»', Number((await uno("select count(*) n from negocios where nombre = 'Bar Copia'")).n) === 0);

    // ===== 3. Celular C: «¿Ya tienes cuenta?» → entra con el correo =====
    const C = await celular('celular C');
    await C.p.click('#authNueva');
    chk('3. «¿Ya tienes cuenta?» pasa a «Iniciar sesión»', /Iniciar sesión/.test(await C.p.textContent('#authTitle')) && !(await C.p.isVisible('#authBiz')));
    await entrar(C.p, 'ana@bar.co', 'malamala1');
    const e3 = await errorEntrada(C.p);
    chk('3. Contraseña mala: «Correo o contraseña incorrectos.»', /Correo o contraseña incorrectos/.test(e3), e3);
    await entrar(C.p, 'ana@bar.co', 'clave123');
    chk('3. Con la contraseña buena entra', await dentro(C.p));
    await cerrarTodo(C.p);
    chk('3. C baja los datos de la cuenta (mismo negocio, «Club Ana»)', await esperar(C.p, n => (window.ventoNube.negocio() || {}).id === n && data.products.some(p => p.name === 'Club Ana'), NEG, 10000));
    chk('3. C no ve el tutorial de bienvenida del negocio nuevo (ya tiene datos)', !(await C.p.evaluate(() => !!document.querySelector('#onbSaltar') && document.querySelector('#onbSaltar').offsetParent)));
    await salirApp(C.p);
    await entrar(C.p, 'ana@bar.co', 'clave123');
    chk('3. Al volver a entrar en C (usuario ya guardado) sigue igual', await dentro(C.p) && await esperar(C.p, () => data.products.some(p => p.name === 'Club Ana'), null, 8000));
    await cerrarTodo(C.p);

    // ===== 4. Lo que cambia un celular le llega al otro =====
    await agregar(B.p, 'Poker de B');
    chk('4. El cambio de B sube a la nube', await esperarNube(NEG, d => nombres(d).includes('Poker de B')));
    await A.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    chk('4. A recibe lo que agregó B', await esperar(A.p, () => data.products.some(p => p.name === 'Poker de B'), null, 12000));
    await agregar(A.p, 'Aguardiente de A');
    await esperarNube(NEG, d => nombres(d).includes('Aguardiente de A'));
    await C.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    chk('4. C recibe lo que agregó A', await esperar(C.p, () => data.products.some(p => p.name === 'Aguardiente de A') && data.products.some(p => p.name === 'Poker de B'), null, 12000));

    // ===== 5. Cuenta vieja con correo que solo estaba en un celular =====
    const D = await celular('celular D');
    await D.p.evaluate(() => localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })));   // como antes: sin nube
    await D.p.reload(); await D.p.waitForSelector('#authOverlay:not([hidden])');
    await crear(D.p, 'Tienda Vieja', 'viejo@tienda.co', 'clave456');
    chk('5. Sin nube: la cuenta se crea solo en el celular (como antes)', await dentro(D.p));
    await D.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(D.p);
    await agregar(D.p, 'Arroz Viejo');
    chk('5. … y no está en la nube', await usuarios('viejo@tienda.co') === 0);
    await D.p.evaluate(() => { localStorage.removeItem('vento_nube_cfg'); localStorage.removeItem('cm-session'); });
    await D.p.reload(); await D.p.waitForSelector('#authOverlay:not([hidden])'); await D.p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta);
    await entrar(D.p, 'viejo@tienda.co', 'clave456');
    chk('5. Con nube entra con su usuario de siempre', await dentro(D.p));
    chk('5. La cuenta queda creada en la nube con su negocio y sus datos', await esperar(D.p, () => !!window.ventoNube.negocio(), null, 12000) && await usuarios('viejo@tienda.co') === 1);
    const NEGD = (await negocio(D.p)).id;
    chk('5. Sus datos («Arroz Viejo», «Tienda Vieja») están en la nube', await esperarNube(NEGD, d => nombres(d).includes('Arroz Viejo') && d.businessName === 'Tienda Vieja'));
    const E = await celular('celular E');
    await E.p.click('#authNueva'); await entrar(E.p, 'viejo@tienda.co', 'clave456');
    chk('5. Y en otro celular se ven los mismos datos', await dentro(E.p) && await esperar(E.p, () => data.products.some(p => p.name === 'Arroz Viejo'), null, 10000));
    await cerrarTodo(E.p);

    // ===== 6. Dos cuentas con correo en el mismo celular =====
    await salirApp(A.p);
    await A.p.click('#authNueva');   // «➕ Crear cuenta nueva» (otro negocio en este celular)
    await crear(A.p, 'Bar Otro', 'otro@bar.co', 'clave789');
    chk('6. En A se crea otra cuenta con otro correo', await dentro(A.p));
    await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(A.p);
    chk('6. A queda conectado al negocio de la cuenta nueva', await esperar(A.p, n => { const x = window.ventoNube.negocio(); return !!x && x.id !== n && x.nombre === 'Bar Otro'; }, NEG, 12000));
    const NEGO = (await negocio(A.p)).id;
    await agregar(A.p, 'Solo de Otro');
    chk('6. Lo nuevo va al negocio de esa cuenta', await esperarNube(NEGO, d => nombres(d).includes('Solo de Otro')));
    const ana = await nubeDe(NEG);
    chk('6. El negocio de Ana no se mezcló con el otro', !nombres(ana.datos).includes('Solo de Otro') && ana.datos.businessName === 'Bar Ana', nombres(ana.datos));
    await salirApp(A.p);
    await entrar(A.p, 'ana@bar.co', 'clave123');
    chk('6. Ana vuelve a entrar en A y ve sus datos (y no los del otro)', await dentro(A.p) && await esperar(A.p, () => data.products.some(p => p.name === 'Poker de B') && !data.products.some(p => p.name === 'Solo de Otro'), null, 10000));
    await cerrarTodo(A.p);
    chk('6. … y A vuelve a sincronizar con el negocio de Ana', await esperar(A.p, n => (window.ventoNube.negocio() || {}).id === n, NEG, 12000));
    await agregar(A.p, 'Ana otra vez');
    chk('6. Lo que agrega Ana va a SU negocio', await esperarNube(NEG, d => nombres(d).includes('Ana otra vez')));
    const otro = await nubeDe(NEGO);
    chk('6. … y no al del otro', !nombres(otro.datos).includes('Ana otra vez') && !nombres(otro.datos).includes('Poker de B'), nombres(otro.datos));
    chk('Una sola cuenta por correo en toda la base', Number((await uno('select count(*) n from (select lower(email) from auth.users group by 1 having count(*) > 1) x')).n) === 0);

    // ===== 7. Servidor que pide confirmar el correo (Supabase no dice «ya existe») =====
    const sb2 = await iniciar({ autoconfirmar: false });
    try{
      const cel2 = async nombre => {
        const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
        await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
        await enrutar(ctx, sb2);
        const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
        await p.goto(BASE + '/index.html'); await p.waitForSelector('#authOverlay:not([hidden])'); await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta);
        return p;
      };
      const F = await cel2('celular F');
      await crear(F, 'Bar Confirma', 'confirma@bar.co', 'clave321');
      chk('7. Con confirmación por correo: la cuenta se crea y entra en el celular', await dentro(F));
      chk('7. … y avisa que hay que confirmar el correo', await esperar(F, () => /confirmar la cuenta/.test(document.body.innerText), null, 5000));
      const G = await cel2('celular G');
      await crear(G, 'Bar Otro', 'confirma@bar.co', 'otra1234');
      const e7 = await errorEntrada(G);
      chk('7. Otro celular no puede crear otra cuenta con ese correo (aunque Supabase no diga «ya existe»)', /ya tiene una cuenta|confirmar el correo/i.test(e7) && Number((await sb2.sql("select count(*) n from auth.users where email = 'confirma@bar.co'"))[0].n) === 1, e7);
    }finally{ await sb2.cerrar().catch(() => {}); }
  }
})();
