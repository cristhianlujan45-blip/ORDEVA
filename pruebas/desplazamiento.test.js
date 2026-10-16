// «Cuando bajo en un menú, se vuelve a subir arriba solito»: partes de Vento que se refrescan solas rehacían su
// contenido y la lista volvía al principio.
//  1. Paso a paso de DaviPlata/Nequi (se revisa cada 3 s): bajar y esperar → se queda donde iba; si el estado cambia
//     (llega el permiso), se repinta SIN volver arriba.
//  2. Cualquier bloque que se refresca solo (pagos, cocina, música…): la lista interna se queda donde iba.
//  3. Lo que manda arriba a propósito (cambiar de pestaña o de paso) sigue funcionando.
//  4. Panel de YouTube «🎵 En cola»: bajar y tocar 🗑 / ⏭ (o que llegue una canción) → no vuelve arriba.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' }));
        const l = []; for(let i = 0; i < 40; i++) l.push({ id: 'c' + i, song: 'Canción ' + i, title: 'Canción ' + i, vid: ('vid' + i + 'xxxxxxxxxx').slice(0, 11), mesa: 1, t: Date.now() - (40 - i) * 1000 });
        localStorage.setItem('vito_cola', JSON.stringify(l)); }catch(e){}
      const A = window.__and = { on: true, permiso: false };
      window.VentoAndroid = { pagosAvisos: v => { A.on = !!v; }, pagosAvisosEstado: () => JSON.stringify({ on: A.on, permiso: A.permiso }), pagosAvisosTomar: () => '[]', mediosPermiso: () => {}, notificar: () => true,
        pagosNotif: () => {}, pagosVolumen: () => {}, pagosSmsConfiar: () => {}, pagosSmsConfiarActual: () => false, fabricante: () => 'Xiaomi|Redmi', abrirInicioAutomatico: () => true,
        permisos: () => JSON.stringify({ bateria: false }), ajustesBateria: () => {} };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Scroll'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); data.pagos = data.pagos || {}; data.pagos.on = true; data.musicOn = true; saveData(); });

    // ---------- 1. Paso a paso de pagos ----------
    await p.evaluate(() => window.ventoPagosGuia()); await p.waitForTimeout(400);
    const sc = await p.evaluate(() => { const ov = document.getElementById('pgGuiaOv'); const el = [ov, ov.firstElementChild].find(x => x && x.scrollHeight > x.clientHeight + 50); if(!el) return null; el.scrollTop = 500; window.__sc = el === ov ? 0 : 1; return { top: el.scrollTop, h: el.scrollHeight }; });
    chk('1. El paso a paso se puede bajar (es más largo que la pantalla)', sc && sc.top > 300, sc);
    const leer = () => p.evaluate(() => { const ov = document.getElementById('pgGuiaOv'); return (window.__sc ? ov.firstElementChild : ov).scrollTop; });
    await p.waitForTimeout(3600);
    chk('1. Bajé y esperé (se revisa cada 3 s): sigue donde iba, NO vuelve arriba', Math.abs((await leer()) - sc.top) < 3, await leer());
    // Lo que se ve: el paso que se está leyendo (el primero que empieza en la pantalla) y dónde está.
    const viendo = () => p.evaluate(() => { const ps = [...document.querySelectorAll('#pgGuiaOv .gp-paso')]; const i = ps.findIndex(x => x.getBoundingClientRect().top >= 0); return { i, y: i >= 0 ? Math.round(ps[i].getBoundingClientRect().top) : null }; });
    const antes = await viendo();
    await p.evaluate(() => { window.__and.permiso = true; });                  // cambia el estado → se repinta (el paso 3 se achica)
    await p.waitForTimeout(3600);
    const txt = await p.evaluate(() => document.getElementById('pgGuiaOv').innerText), despues = await viendo();
    chk('1. Llegó el permiso (cambió el estado, el paso de arriba se achicó): se repintó y el paso que leía queda quieto', /Permiso dado/.test(txt) && despues.i === antes.i && Math.abs(despues.y - antes.y) < 3, { antes, despues, permiso: /Permiso dado/.test(txt) });
    await p.evaluate(() => document.getElementById('pgGuiaOv').classList.remove('show'));

    // ---------- 2 y 3. Cualquier bloque que se refresca solo ----------
    const g = await p.evaluate(() => {
      const caja = document.createElement('div'); caja.id = 'cajaPrueba'; document.body.appendChild(caja);
      const pintar = () => { caja.innerHTML = '<div class="lista-x" style="height:200px;overflow:auto">' + Array.from({ length: 60 }, (_, i) => '<p>Fila ' + i + ' · ' + Date.now() + '</p>').join('') + '</div>'; };
      pintar(); const l = caja.firstElementChild; l.scrollTop = 700; const antes = l.scrollTop;
      pintar(); const despues = caja.firstElementChild.scrollTop;
      pintar(); caja.firstElementChild.scrollTop = 0; const aProposito = caja.firstElementChild.scrollTop;   // mandar arriba a propósito
      caja.remove();
      return { antes, despues, aProposito };
    });
    chk('2. Un bloque que se rehace solo: la lista interna se queda donde iba', g.antes > 600 && Math.abs(g.despues - g.antes) < 3, g);
    chk('3. Mandar arriba a propósito (cambiar de pestaña) sigue funcionando', g.aProposito === 0, g);

    // ---------- 4. Panel de YouTube «🎵 En cola» ----------
    await p.evaluate(() => { const b = document.querySelector('.more-tile[data-go="musica"]') || document.querySelector('nav button[data-view="musica"]'); b && b.click(); });
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.click('#view-musica [data-yp-abrir]');
    await p.click('#ypOv [data-yp-tab="cola"]'); await p.waitForTimeout(300);
    const c0 = await p.evaluate(() => { const c = document.getElementById('ypCuerpo'); c.scrollTop = 900; return { top: c.scrollTop, h: c.scrollHeight, filas: c.querySelectorAll('.yp-fila').length }; });
    chk('4. «🎵 En cola» con 40 canciones: se puede bajar', c0.top > 800 && c0.filas >= 30, c0);
    await p.evaluate(() => { const f = [...document.querySelectorAll('#ypCuerpo .yp-fila')].slice(-3)[0]; [...f.querySelectorAll('button')].find(x => x.textContent === '🗑').click(); });
    await p.waitForTimeout(200);
    const c1 = await p.evaluate(() => document.getElementById('ypCuerpo').scrollTop);
    chk('4. Tocar 🗑 en una canción de abajo: la lista NO vuelve arriba', Math.abs(c1 - c0.top) < 60 && c1 > 700, { antes: c0.top, despues: c1 });
    await p.evaluate(() => { const f = [...document.querySelectorAll('#ypCuerpo .yp-fila')].slice(-5)[0]; [...f.querySelectorAll('button')].find(x => x.textContent === '⏭').click(); });
    await p.waitForTimeout(200);
    const c2 = await p.evaluate(() => document.getElementById('ypCuerpo').scrollTop);
    chk('4. Tocar ⏭ en una canción de abajo: la lista NO vuelve arriba', c2 > 700, { despues: c2 });
    await p.click('#ypOv [data-yp-tab="inicio"]'); await p.click('#ypOv [data-yp-tab="cola"]'); await p.waitForTimeout(200);
    chk('4. Cambiar de pestaña sí empieza arriba (a propósito)', (await p.evaluate(() => document.getElementById('ypCuerpo').scrollTop)) === 0);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
