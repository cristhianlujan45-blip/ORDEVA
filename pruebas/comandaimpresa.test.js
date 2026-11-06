// 🖨️ ORDEVA 1.82.0 · Comanda impresa en la cocina y en la barra. Antes la impresora solo imprimía la factura.
// La impresora se simula: lo que ORDEVA le manda queda guardado (window.__impreso) en vez de salir por el cable.
//  1. Ajustes → Balanza, impresora y cajón: «🍳 Comanda impresa», con dónde va lo de la cocina y lo de la barra, y cada
//     categoría con «Cocina / Barra / No imprimir» (las de bebidas, solas en la barra).
//  2. «🍳 Enviar a cocina» con 2 bandejas y 1 limonada: la cocina recibe «COCINA · Mesa 1 · 2 x Bandeja paisa» y la barra
//     «BARRA · Mesa 1 · 1 x Limonada», cada una en su impresora (la de la barra, de red con su IP).
//  3. Lo siguiente que se manda solo imprime lo nuevo.
//  4. Se quita algo ya mandado: sale «ANULAR - COCINA» con eso.
//  5. Categoría cambiada a «No imprimir»: no sale en papel (sí llega a la pantalla de la cocina).
//  6. Con la comanda impresa apagada (como antes) no se imprime nada.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      // App Android con una impresora de mentira: guarda lo que se le manda (texto legible) y responde «ok».
      window.__impreso = [];
      window.VentoEquipos = { imprimir: (cfg, b64, cb) => { const c = JSON.parse(cfg), t = atob(b64).replace(/[^\x20-\x7e\n]/g, ''); window.__impreso.push({ via: c.via, host: c.host || '', t });
        setTimeout(() => { try{ window.__ventoEquipos('impreso', { cb, ok: true }); }catch(e){} }, 10); } }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'restaurante'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Restaurante Comanda'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.categories = [{ id: 'c-pl', name: 'Platos fuertes' }, { id: 'c-be', name: 'Bebidas' }, { id: 'c-po', name: 'Postres' }];
      data.products = [{ id: 'bj', name: 'Bandeja paisa', price: 28000, categoryId: 'c-pl' }, { id: 'li', name: 'Limonada', price: 6000, categoryId: 'c-be' }, { id: 'fl', name: 'Flan', price: 7000, categoryId: 'c-po' }]; saveData(); });
    await p.waitForFunction(() => !!window.ventoComanda && !!window.vitoPedidos && !!window.ventoEquipos, null, { timeout: 10000 });
    // ===== 1 =====
    await p.evaluate(() => { const c = window.ventoEquipos.cfg(); c.impresora = Object.assign(c.impresora, { via: 'bt', ancho: 32 }); window.ventoEquipos.guardarCfg(c); });
    await p.evaluate(() => document.querySelector('nav button[data-view="ajustes"]').click());
    // La sección «🔌 Balanza, impresora y cajón» se agrega a Ajustes un momento después de abrir: se espera a que esté.
    await p.waitForFunction(() => !!document.querySelector('.ajustes-cat[data-cat="equipos"]'), null, { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => { const k = document.querySelector('.ajustes-cat[data-cat="equipos"]'); if(k) k.click(); });
    await p.waitForFunction(() => !!document.getElementById('vqComOn'), null, { timeout: 10000 }).catch(() => {});
    let v = await p.evaluate(() => ({ sec: !!document.getElementById('vqComanda'), on: !!document.getElementById('vqComOn') }));
    chk('1. Ajustes: sale «🍳 Comanda impresa (cocina y barra)»', v.sec && v.on, v);
    await p.evaluate(() => { const t = document.getElementById('vqComOn'); t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForFunction(() => !!document.getElementById('vqComBarra'), null, { timeout: 10000 }).catch(() => {});
    v = await p.evaluate(() => ({ cocina: !!document.getElementById('vqComCocina'), barra: !!document.getElementById('vqComBarra'),
      cats: [...document.querySelectorAll('[data-catdest]')].map(s => s.dataset.catdest + '=' + s.value).join(',') }));
    chk('1. Prendida: elegir dónde va lo de la cocina y lo de la barra', v.cocina && v.barra, v);
    chk('1. Cada categoría con su lugar: Platos y Postres a la cocina, Bebidas a la barra', v.cats === 'c-pl=cocina,c-be=barra,c-po=cocina', v);
    await p.evaluate(() => { const s = document.getElementById('vqComBarra'); s.value = 'red'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForFunction(() => !!document.getElementById('vqComBarraHost'), null, { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => { const i = document.getElementById('vqComBarraHost'); i.value = '192.168.1.77'; i.dispatchEvent(new Event('change', { bubbles: true })); });
    v = await p.evaluate(() => window.ventoEquipos.cfg().comanda);
    chk('1. Queda guardado en este equipo: comanda prendida, barra en la impresora de red 192.168.1.77', v.on && v.barra === 'red' && v.barraHost === '192.168.1.77' && v.cocina === 'factura', v);
    // ===== 2 =====
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); document.querySelector('nav button[data-view="mesas"]') && document.querySelector('nav button[data-view="mesas"]').click();
      window.__impreso = []; openTableModal(1); addFavoriteToTable('bj'); addFavoriteToTable('bj'); addFavoriteToTable('li'); });
    await pausa(800);
    await p.evaluate(() => window.ventoComanda.enviar(1));
    await pausa(800);
    v = await p.evaluate(() => ({ imp: window.__impreso.map(x => ({ via: x.via, host: x.host, t: x.t.replace(/\s+/g, ' ').trim() })), ult: window.__ultimaComanda }));
    const coc = v.imp.find(x => /COCINA/.test(x.t)), bar = v.imp.find(x => /BARRA/.test(x.t));
    chk('2. Cocina: «COCINA · Mesa 1 · 2 x Bandeja paisa» (sin la limonada) en la impresora de facturas', coc && /Mesa 1/.test(coc.t) && /2 x Bandeja paisa/.test(coc.t) && !/Limonada/.test(coc.t) && coc.via === 'bt', v);
    chk('2. Barra: «BARRA · Mesa 1 · 1 x Limonada» en la impresora de red 192.168.1.77', bar && /1 x Limonada/.test(bar.t) && !/Bandeja/.test(bar.t) && bar.via === 'red' && bar.host === '192.168.1.77', v);
    chk('2. Dos papeles, uno por impresora', v.imp.length === 2, v.imp.length);
    // ===== 3 =====
    await p.evaluate(() => { window.__impreso = []; addFavoriteToTable('fl'); });
    await pausa(500);
    await p.evaluate(() => window.ventoComanda.enviar(1)); await pausa(800);
    v = await p.evaluate(() => window.__impreso.map(x => x.t.replace(/\s+/g, ' ').trim()));
    chk('3. Lo siguiente solo imprime lo nuevo: «1 x Flan» en la cocina (nada en la barra)', v.length === 1 && /COCINA/.test(v[0]) && /1 x Flan/.test(v[0]) && !/Bandeja/.test(v[0]), v);
    // ===== 4 =====
    await p.evaluate(() => { window.__impreso = []; const t = data.tables[1]; const it = t.items.find(i => i.productId === 'bj'); it.qty -= 1; saveData(); window.ventoComanda.anular(1); });
    await pausa(800);
    v = await p.evaluate(() => window.__impreso.map(x => x.t.replace(/\s+/g, ' ').trim()));
    chk('4. Se quitó 1 bandeja ya mandada: sale «ANULAR - COCINA · 1 x … Bandeja paisa»', v.length === 1 && /ANULAR - COCINA/.test(v[0]) && /1 x .*Bandeja paisa/.test(v[0]), v);
    // ===== 5 =====
    await p.evaluate(() => { data.categories.find(c => c.id === 'c-po').destino = 'no'; saveData(); window.__impreso = []; addFavoriteToTable('fl'); });
    await pausa(500);
    await p.evaluate(() => window.ventoComanda.enviar(1)); await pausa(800);
    v = await p.evaluate(() => ({ imp: window.__impreso.length, cocina: window.vitoPedidos.lista().filter(x => x.mesa === 1).length }));
    chk('5. Categoría «No imprimir»: no sale en papel, pero sí llega a la pantalla de la cocina', v.imp === 0 && v.cocina >= 3, v);
    // ===== 6 =====
    await p.evaluate(() => { const c = window.ventoEquipos.cfg(); c.comanda.on = false; window.ventoEquipos.guardarCfg(c); window.__impreso = []; addFavoriteToTable('bj'); });
    await pausa(500);
    await p.evaluate(() => window.ventoComanda.enviar(1)); await pausa(800);
    chk('6. Con la comanda impresa apagada (como antes) no se imprime nada', (await p.evaluate(() => window.__impreso.length)) === 0);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
