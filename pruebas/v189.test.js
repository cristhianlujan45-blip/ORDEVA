// 🧭 ORDEVA 1.89.0 · Los menús en el orden en que se usan (lib/vento-orden.js + index.html).
//  1. Ajustes: primero Negocio, Mi cuenta y mi equipo, Pedidos y caja, Pagos; al final Datos, Guía y Zona de riesgo.
//     Las categorías que agregan otros módulos (ORDEVA IA, balanza e impresora) también quedan en su sitio.
//  2. «Más»: Inicio, Historial, Estadísticas, Contabilidad, Libreta, Pagos… (lo de cada día primero), y Contabilidad ya
//     no tiene el mismo ícono que Libreta.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html?demo=restaurante');
    await p.waitForFunction(() => !!document.getElementById('demoBanda'), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1500);
    let v = await p.evaluate(() => [...document.querySelectorAll('#ajustesCats > .ajustes-cat')].map(x => x.dataset.cat));
    chk('1. Ajustes empieza por Negocio, Mi cuenta y mi equipo, Pedidos y caja, Pagos', v.slice(0, 4).join() === 'negocio,nube,pedidos,pagos', v);
    chk('1. … y termina con Datos, Guía y Zona de riesgo', v.slice(-3).join() === 'datos,ayuda,peligro', v);
    chk('1. ORDEVA IA (que se agrega después) quedó cerca del final, no de primera', v.indexOf('laya') > v.indexOf('sonidos') && v.indexOf('laya') < v.indexOf('datos'), v);
    chk('1. Ninguna categoría se perdió ni se repitió', new Set(v).size === v.length && v.length >= 13, v);
    v = await p.evaluate(() => [...document.querySelectorAll('#navMoreSheet .more-tile[data-go]')].map(x => x.dataset.go).slice(0, 8));
    chk('2. «Más»: Inicio, Historial, Estadísticas, Contabilidad, Libreta, Pagos, Carta, Música', v.join() === 'inicio,historial,estadisticas,contabilidad,libreta,pagos,carta,musica', v);
    v = await p.evaluate(() => ['contabilidad', 'libreta'].map(g => document.querySelector('#navMoreSheet .more-tile[data-go="' + g + '"] .more-ic').textContent));
    chk('2. Contabilidad (💰) ya no tiene el mismo ícono que Libreta (📒)', v[0] === '💰' && v[1] === '📒', v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
