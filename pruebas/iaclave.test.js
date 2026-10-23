// La clave de IA del negocio ya no viaja a los celulares (ORDEVA 1.53.0), probado en la app contra el «Supabase local» REAL
// y un Gemini de mentiras (Google de verdad está bloqueado en la prueba: si algo llama directo, falla).
//  1. Un celular que traía la clave copiada (versiones anteriores) la sube al servidor, la borra de su memoria y los
//     datos del negocio no la llevan.
//  2. La IA funciona por el servidor con la clave del negocio, también en el celular del mesero (que nunca la recibe).
//  3. Ajustes → IA: dice que está en el servidor (con el final), «Guardar» con el campo vacío no la borra, una clave
//     nueva la cambia para todos y «🗑️ Quitar» deja la IA de ORDEVA.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'), http = require('http');
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
const CLAVE = 'AIzaSyPRUEBA-app-0123456789-abcd';
const NUEVA = 'AIzaSyNUEVA-app-9876543210-wxyz';
const vistos = [];

(async () => {
  if(!hayPostgres()){ console.log('RESULTADO 0 bien 0 mal (este equipo no tiene PostgreSQL: se omitió esta prueba)'); process.exit(0); }
  const { iniciar, enrutar } = require('./servidor/supabase-local');
  const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
  let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); } };
  const gem = http.createServer((req, rsp) => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
    vistos.push({ k: req.headers['x-goog-api-key'] || '', url: req.url });
    rsp.writeHead(200, { 'content-type': 'application/json' });
    rsp.end(req.method === 'GET' ? '{"models":[{"name":"models/gemini-3.5-flash-lite"}]}' : '{"candidates":[{"content":{"parts":[{"text":"OK"}]}}],"usageMetadata":{}}');
  }); });
  await new Promise(r => gem.listen(0, '127.0.0.1', r));
  const sb = await iniciar({ env: { VENTO_GEMINI_URL: 'http://127.0.0.1:' + gem.address().port } });
  const b = await chromium.launch();
  try{ await pruebas(); }
  catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close().catch(() => {}); await sb.cerrar().catch(() => {}); gem.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);

  async function pruebas(){
    const uno = async (q, p) => (await sb.sql(q, p))[0];
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 200 }).then(() => true, () => false);
    const directo = [];
    async function equipo(nombre){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); if(u.hostname === 'generativelanguage.googleapis.com') directo.push(nombre + ' ' + u.pathname); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(BASE + '/index.html');
      await p.waitForSelector('#authOverlay:not([hidden])', { timeout: 15000 });
      await p.waitForFunction(() => window.ventoNube && window.ventoNube.crearCuenta, null, { timeout: 15000 });
      return p;
    }
    const cerrarTodo = p => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const docServidor = async (n) => (await uno('select datos from datos_negocio where negocio_id = $1', [n])).datos;
    const pedirIA = p => p.evaluate(() => aiText({ prompt: 'Responde solo con la palabra OK.', timeoutMs: 15000, retries: 0 }).then(t => String(t), e => 'ERROR ' + (e && e.message || e)));

    // ===== 1. El dueño, con la clave copiada en su celular por una versión anterior =====
    const D = await equipo('dueño');
    await D.fill('#authBiz', 'Bar IA'); await D.fill('#authUser', 'dueno@ia.co'); await D.fill('#authPass', 'clave123'); await D.click('#authBtn');
    chk('1. El dueño crea la cuenta y queda en la nube', await esperar(D, () => document.getElementById('authOverlay').hidden && !!window.ventoNube.negocio(), null, 20000));
    await D.click('#onbSaltar', { timeout: 4000 }).catch(() => {}); await cerrarTodo(D);
    const NEG = await D.evaluate(() => window.ventoNube.negocio().id);
    await D.evaluate(k => { localStorage.setItem('bar-gemini-api-key', k); data.iaClave = k; saveData(); }, CLAVE);   // como lo dejaba la 1.52
    await D.waitForTimeout(1500);
    chk('1. Aunque un celular viejo la meta en los datos, el servidor no la deja en el documento', !('iaClave' in await docServidor(NEG)));
    await D.evaluate(() => iaNegRevisar());
    const g = await uno("select publico from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG]);
    chk('1. La clave quedó en el servidor (termina en «abcd»)', g && g.publico.final === 'abcd', g);
    const d1 = await D.evaluate(() => ({ local: localStorage.getItem('bar-gemini-api-key') || '', doc: 'iaClave' in data, k: getGeminiKey() }));
    chk('1. … y se borró del celular y de los datos del negocio (la IA usa «la del negocio»)', !d1.local && !d1.doc && d1.k === 'vento-negocio', d1);

    vistos.length = 0;
    let t = await pedirIA(D);
    chk('2. La IA del dueño funciona por el servidor', /OK/.test(t) && vistos.some(v => v.k === CLAVE && /generateContent/.test(v.url)), [t, vistos]);
    chk('2. Ningún celular llamó a Google directo con la clave', !directo.length, directo);

    // ===== 2. El mesero: nunca recibe la clave =====
    await sb.sql("insert into invitaciones(codigo, negocio_id, rol) values ('MESEROIA', $1, 'mesero')", [NEG]);
    const M = await equipo('mesero');
    await M.click('#authNube'); await M.waitForSelector('#nubeOv.show #nubeEmail');
    await M.fill('#nubeEmail', 'mesero@ia.co'); await M.fill('#nubePass', 'clave123'); await M.fill('#nubeNombre', 'Pedro');
    await M.click('#nubeCrear'); await M.waitForSelector('#nubeCodigo', { state: 'visible' });
    await M.fill('#nubeCodigo', 'MESEROIA'); await M.click('#nubeUnirme');
    chk('2. El mesero se une al negocio', await esperar(M, n => { const x = window.ventoNube.negocio(); return x && x.id === n && x.rol === 'mesero'; }, NEG, 20000));
    await cerrarTodo(M);
    await M.evaluate(() => iaNegRevisar());
    const m1 = await M.evaluate(() => ({ local: localStorage.getItem('bar-gemini-api-key') || '', doc: JSON.stringify(data).includes('AIzaSy'), k: getGeminiKey(), est: JSON.parse(localStorage.getItem('vento-ia-negocio') || '{}') }));
    chk('2. El celular del mesero no tiene la clave en ninguna parte (ni sabe cómo termina)', !m1.local && !m1.doc && m1.k === 'vento-negocio' && !m1.est.final, m1);
    vistos.length = 0;
    t = await pedirIA(M);
    chk('2. … y aun así la IA le funciona (con la clave del negocio, por el servidor)', /OK/.test(t) && vistos.some(v => v.k === CLAVE), [t, vistos]);

    // ===== 3. Ajustes → IA =====
    await D.evaluate(() => openAIConfigDialog());
    await D.waitForSelector('#aiCfgStatus');
    const aj = await D.evaluate(() => ({ st: document.getElementById('aiCfgStatus').textContent, ph: document.getElementById('aiCfgKey').placeholder, val: document.getElementById('aiCfgKey').value,
      quitar: [...document.querySelectorAll('button')].some(x => /Quitar la clave del negocio/.test(x.textContent) && !x.hidden) }));
    chk('3. Ajustes dice que la clave está en el servidor, con el final, y el campo queda vacío', /Servidor ORDEVA/.test(aj.st) && /abcd/.test(aj.st) && /servidor/.test(aj.ph) && !aj.val && aj.quitar, aj);
    await D.click('#aiCfgSave');
    await D.waitForFunction(() => /Listo|funcionó|⚠️|❌/.test(document.getElementById('aiCfgStatus').textContent), null, { timeout: 15000 }).catch(() => {});
    let e = (await uno("select secreto is not null s from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG]));
    chk('3. «Guardar» con el campo vacío NO borra la clave del negocio', e && e.s === true, e);
    await D.evaluate(() => { document.getElementById('aiCfgStatus').textContent = ''; });   // que no cuente el «Listo» de antes
    await D.fill('#aiCfgKey', NUEVA); await D.click('#aiCfgSave');
    const listo = await esperar(D, () => /Listo/.test(document.getElementById('aiCfgStatus').textContent), null, 15000);
    const n3 = { listo, st: await D.evaluate(() => document.getElementById('aiCfgStatus').textContent), fin: (await uno("select publico from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG])).publico.final, local: await D.evaluate(() => localStorage.getItem('bar-gemini-api-key')) };
    chk('3. Una clave nueva se guarda en el servidor y el celular no se queda con ella', n3.listo && n3.fin === 'wxyz' && !n3.local, n3);
    vistos.length = 0;
    t = await pedirIA(M);
    chk('3. El mesero pasa a usar la nueva sin hacer nada', /OK/.test(t) && vistos.some(v => v.k === NUEVA), vistos);
    await D.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => /Quitar la clave del negocio/.test(b.textContent)); x.click(); });
    await D.waitForSelector('.overlay.show .btn-primary, #confirmOk', { timeout: 5000 }).catch(() => {});
    await D.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => /Sí, quitar/.test(b.textContent)); if(x) x.click(); });
    chk('3. «🗑️ Quitar» la quita del servidor', await esperar(D, () => getGeminiKey() !== 'vento-negocio', null, 8000)
      && (await uno("select secreto is null s from integraciones where negocio_id = $1 and tipo = 'ia'", [NEG])).s === true);
    t = await pedirIA(M);
    chk('3. El mesero ya no usa la clave quitada (el servidor dice «sin clave»)', !/OK/.test(t) || !vistos.slice(-1).some(v => v.k === NUEVA), t);
    chk('Nunca hubo clave en el documento del servidor', !JSON.stringify(await docServidor(NEG)).includes('AIzaSy'));
  }
})();
