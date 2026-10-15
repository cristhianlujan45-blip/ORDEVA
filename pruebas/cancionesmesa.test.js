// 10 canciones POR MESA (no por celular), contra el «Supabase local» REAL:
//  1. Dos celulares en la misma mesa: lo que pide uno cuenta para el otro (la cuenta en vivo lleva el cupo de la mesa).
//  2. Llegando a 10 entre los dos, ninguno puede pedir la 11.ª: «Esta mesa ya pidió 10 canciones…».
//  3. Si un celular no alcanzó a ver el cupo (sin cuenta en vivo) y la manda igual, Vento la rechaza y le avisa a ESE
//     celular (estado «limite»): sale el aviso y su contador no se queda con una canción que no entró.
//  4. Otra mesa no se ve afectada.
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
    const esperar = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 15000, polling: 250 }).then(() => true, () => false);
    async function pagina(nombre, url){
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/*', rt => { const u = new URL(rt.request().url()); return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') ? rt.continue() : rt.abort(); });
      await enrutar(ctx, sb);
      await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
      await p.goto(url);
      return { ctx, p };
    }
    const A = await pagina('negocio', BASE + '/index.html');
    await A.p.waitForSelector('#authOverlay:not([hidden])');
    await A.p.fill('#authBiz', 'Bar Canciones'); await A.p.fill('#authUser', 'ana'); await A.p.fill('#authPass', 'clave123'); await A.p.click('#authBtn');
    await A.p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await A.p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await A.p.evaluate(base => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      for(let i = 1; i <= 3; i++) data.tables[i] = data.tables[i] || { items: [], people: [] };
      // Ajustes → Música: 10 por mesa (así viene)
      saveData();
      const M = window.vitoMod, c = M.qCfg(); c.url = base + '/pedido.html'; c.live = true; M.SS('vito_qr', c);
      M.reconectarPedidos();
    }, BASE);
    const link = m => A.p.evaluate(m => window.vitoMod.linkMesa(window.vitoMod.qCfg(), m), m);
    const l1 = await link(1);
    const enCola = m => A.p.evaluate(m => window.vitoMod.cola().filter(x => x.mesa === m).length, m);
    async function pedir(C, nombre){
      await C.p.click('#tc'); await C.p.fill('#s', nombre); await C.p.click('#b');
      await esperar(C.p, () => !document.getElementById('b').disabled, null, 15000);
    }

    // ===== 1. Dos celulares, misma mesa =====
    const C1 = await pagina('cliente1', l1), C2 = await pagina('cliente2', l1);
    for(let i = 1; i <= 6; i++) await pedir(C1, 'Cancion uno numero ' + i);
    chk('1. Las 6 canciones del primer celular llegan a la mesa 1', await esperar(A.p, () => window.vitoMod.cola().filter(x => x.mesa === 1).length === 6, null, 20000), await enCola(1));
    await C2.p.click('#tc');
    chk('1. El segundo celular ve que la MESA ya lleva 6 (sin haber pedido nada)', await esperar(C2.p, () => usadas() === 6, null, 20000), await C2.p.evaluate(() => [usadas(), snap && snap.cs]));
    chk('1. … y los cupos pintados son 6 de 10', await C2.p.evaluate(() => document.querySelectorAll('#cupos i.on').length === 6 && document.querySelectorAll('#cupos i').length === 10));

    // ===== 2. Llegando a 10 =====
    for(let i = 1; i <= 4; i++) await pedir(C2, 'Cancion dos numero ' + i);
    chk('2. Entre los dos celulares la mesa llega a 10', await esperar(A.p, () => window.vitoMod.cola().filter(x => x.mesa === 1).length === 10, null, 20000), await enCola(1));
    chk('2. El primer celular también ve 10 (aunque él solo pidió 6)', await esperar(C1.p, () => usadas() === 10, null, 20000), await C1.p.evaluate(() => usadas()));
    await C1.p.fill('#s', 'Cancion once'); await C1.p.click('#b');
    const msg1 = await C1.p.evaluate(() => document.getElementById('m').textContent);
    chk('2. El primer celular ya no puede pedir la 11.ª: «Esta mesa ya pidió 10 canciones»', /(Esta mesa ya pidió|This table has already requested) 10/.test(msg1), msg1);
    await A.p.waitForTimeout(2500);
    chk('2. La 11.ª no llegó a Vento', await enCola(1) === 10, await enCola(1));

    // ===== 3. Celular sin cuenta en vivo: Vento la rechaza y le avisa =====
    const C3 = await pagina('cliente3', l1);
    await C3.p.evaluate(() => { try{ es && es.close(); }catch(e){} es = { close(){} }; snap = null; });
    await pedir(C3, 'Cancion del tercero');
    chk('3. Vento la rechaza (la mesa sigue en 10)', await enCola(1) === 10, await enCola(1));
    chk('3. … y le avisa a ESE celular: «Esta mesa ya pidió 10 canciones»', await esperar(C3.p, () => /(Esta mesa ya pidió|This table has already requested) 10/.test(document.getElementById('m').textContent), null, 20000), await C3.p.evaluate(() => document.getElementById('m').textContent));
    chk('3. Su contador no se queda con la canción que no entró', await C3.p.evaluate(() => recLocal().length === 0), await C3.p.evaluate(() => recLocal().length));
    chk('3. En Vento no sale aviso de canción nueva por la rechazada', await A.p.evaluate(() => !window.vitoMod.cola().some(x => /tercero/.test(x.song))));

    // ===== 4. Otra mesa =====
    const C4 = await pagina('cliente4', await link(2));
    await pedir(C4, 'Cancion de la mesa dos');
    chk('4. Otra mesa pide sin problema', await esperar(A.p, () => window.vitoMod.cola().some(x => x.mesa === 2), null, 20000));
    chk('4. … y su cupo es el suyo (1 de 10)', await C4.p.evaluate(() => usadas() === 1), await C4.p.evaluate(() => usadas()));

    // ===== 5. «Sin límite» (Ajustes → Música) =====
    await A.p.evaluate(() => { const sel = document.getElementById('cancionesMesaSel'); sel.value = '0'; sel.dispatchEvent(new Event('change')); });
    chk('5. El QR se entera de que ya no hay límite', await esperar(C1.p, () => MAXC() === 0, null, 25000), await C1.p.evaluate(() => [MAXC(), cat && cat.cl, snap && snap.cm]));
    await pedir(C1, 'Cancion once sin limite');
    chk('5. Sin límite: la mesa que ya tenía 10 pide la 11.ª y entra', await esperar(A.p, () => window.vitoMod.cola().some(x => /once sin limite/i.test(x.song)), null, 20000), await enCola(1));
    chk('5. … y el QR ya no muestra cupos («Pide las canciones que quieras»)', await C1.p.evaluate(() => { info(); return document.getElementById('cupos').hidden && /(quieras|as you like)/.test(document.getElementById('m').textContent); }));
  }
})();
