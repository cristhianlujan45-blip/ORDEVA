// 🗺️ 1.99.41 · «Agrégame otra vez la opción de mapear los locales: las tiendas, los restaurantes, las mesas… muy profesional
// y fácil de usar» (pedido del dueño, 23/11). Su negocio es una agropecuaria (tipo tienda): ahí el plano estaba escondido.
// Revisa:
//  1. «🗺️ Mapa del local» está en «Más» en un restaurante y en una agropecuaria, y el interruptor de Ajustes viene prendido.
//  2. Apagar «Mapa del local» en Ajustes lo esconde (y prenderlo lo vuelve a mostrar).
//  3. En el celular (390 px) el plano cabe en la pantalla (antes medía 560 px y había que deslizarlo): las 4 mesas se ven, con
//     el nombre de 11 px o más (antes 8,5).
//  4. «🔍 Acercar» lo agranda (se desliza de lado) y «🔍 Alejar» lo devuelve.
//  5. Agropecuaria: el plano de tienda pone 3 góndolas con su nombre completo (a lo largo), sin las cuentas encima.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const abrir = async (tipo, nombre) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '', off: true })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tipo + ': ' + e.message));
    await p.goto(BASE); await p.waitForTimeout(1200);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const x = document.querySelector('#primerosPasos .pp-x'); x && x.click(); });
    return { ctx, p };
  };
  const casilla = p => p.evaluate(() => { document.getElementById('navMoreBtn').click(); return new Promise(r => setTimeout(() => { const t = document.querySelector('#navMoreSheet [data-go="plano"]'); const v = !!(t && t.offsetParent && !t.hidden); document.getElementById('navMoreSheet').classList.remove('show'); r(v); }, 300)); });
  try{
    // ===== Restaurante =====
    const R = await abrir('restaurante', 'Restaurante Mapa'); const p = R.p;
    chk('1. Restaurante: «🗺️ Mapa del local» está en «Más»', await casilla(p));
    chk('1. … y el interruptor «Mapa del local» de Ajustes viene prendido', await p.evaluate(() => usaMod('p')));
    await p.evaluate(() => { data.modulos = Object.assign({}, data.modulos, { p: false }); aplicarModulos(); });
    chk('2. Apagarlo en Ajustes lo esconde de «Más»', !(await casilla(p)) && !(await p.evaluate(() => ventoPlano.disponible())));
    await p.evaluate(() => { data.modulos.p = true; aplicarModulos(); });
    chk('2. … y prenderlo lo vuelve a mostrar', await casilla(p));
    await p.evaluate(() => { ventoPlano.abrir(); }); await p.waitForTimeout(500);
    await p.evaluate(() => { const b = document.querySelector('#plHoja [data-pl="plantilla"][data-v="restaurante"]'); b && b.click(); }); await p.waitForTimeout(500);
    await p.evaluate(() => { const b = document.querySelector('[data-pl="listo"]'); b && b.click(); }); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const l = document.getElementById('plLienzo'), sc = l.parentElement, lr = l.getBoundingClientRect();
      const ms = [...l.querySelectorAll('.pl-mesa')].map(x => { const r = x.getBoundingClientRect(), n = x.querySelector('.ft-name'); return { dentro: r.left >= lr.left - 1 && r.right <= lr.right + 1, letra: parseFloat(getComputedStyle(n).fontSize) }; });
      return { ancho: Math.round(lr.width), vw: innerWidth, desliza: sc.scrollWidth > sc.clientWidth + 1, mesas: ms }; });
    chk('3. En el celular el plano cabe en la pantalla (sin deslizar de lado)', m.ancho <= m.vw && !m.desliza, m);
    chk('3. … las 4 mesas se ven completas, con el nombre de 11 px o más', m.mesas.length === 4 && m.mesas.every(x => x.dentro && x.letra >= 11), m.mesas);
    await p.click('[data-pl="zoom"]'); await p.waitForTimeout(300);
    const z = await p.evaluate(() => ({ ancho: Math.round(document.getElementById('plLienzo').getBoundingClientRect().width), txt: document.querySelector('[data-pl="zoom"]').textContent }));
    chk('4. «🔍 Acercar» lo agranda (720 px, se desliza) y cambia a «Alejar»', z.ancho >= 720 && /Alejar/.test(z.txt), z);
    await p.click('[data-pl="zoom"]'); await p.waitForTimeout(300);
    chk('4. … «🔍 Alejar» lo devuelve al ancho de la pantalla', await p.evaluate(() => document.getElementById('plLienzo').getBoundingClientRect().width <= innerWidth));
    await R.ctx.close();
    // ===== Agropecuaria (tienda) =====
    const A = await abrir('agropecuaria', 'Agro La Finca'); const a = A.p;
    chk('1. Agropecuaria: «🗺️ Mapa del local» está en «Más» (antes escondido)', await casilla(a));
    chk('1. … con el interruptor de Ajustes prendido', await a.evaluate(() => usaMod('p') && window.ventoModulos ? true : usaMod('p')));
    await a.evaluate(() => ventoPlano.abrir()); await a.waitForTimeout(500);
    await a.evaluate(() => { const b = document.querySelector('#plHoja [data-pl="plantilla"][data-v="tienda"]'); b && b.click(); }); await a.waitForTimeout(500);
    const g = await a.evaluate(() => { const L = [...document.querySelectorAll('#plLienzo .pl-el-estante span')].map(s => ({ t: s.textContent, corta: s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1 }));
      return { gondolas: L, mesas: document.querySelectorAll('#plLienzo .pl-mesa').length, caja: !!(document.getElementById('posPanel') || {}).offsetParent }; });
    chk('5. Plano de tienda: 3 góndolas con el nombre completo, sin las cuentas encima y sin la caja', g.gondolas.length === 3 && g.gondolas.every(x => /Góndola \d/.test(x.t) && !x.corta) && g.mesas === 0 && !g.caja, g);
    await A.ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
