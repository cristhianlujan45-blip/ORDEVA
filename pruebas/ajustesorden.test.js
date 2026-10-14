// Ajustes ordenados, sin repetidos y fáciles de buscar; cada notificación se prende o apaga.
//  1. Pagos (pasarela Nequi y avisos de pagos) juntos en «💜 Pagos»; domicilios por web y WhatsApp en «Pedidos».
//  2. «🔔 Notificaciones del celular» tiene un interruptor por cada aviso (pedidos, cuenta, domicilios, música, soporte, IA).
//     Ya no hay avisos sueltos en «Pedidos» ni la sección de la app ntfy.
//  3. Apagar un aviso: ya no sale ni suena; prenderlo: vuelve. «Probar canción» manda la notificación de música al celular.
//  4. Ningún ajuste repetido (mismo título dos veces) y el buscador lleva a la categoría correcta.
//  5. «Anunciar los pedidos en voz alta» también está en Ajustes → Voz (el mismo de la campana).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      window.__cel = []; window.VentoAndroid = { notificar: (t, x, c, s) => { window.__cel.push({ t, x, c, s }); return true; }, avisosEstado: () => '{"prendidos":true,"permiso":true,"canales":{}}', info: () => '{}' }; });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.evaluate(() => { const s = document.getElementById('authType'); if(s){ s.value = 'restaurante'; s.dispatchEvent(new Event('change')); } });
    await p.fill('#authBiz', 'Bar Ajustes'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    const cat = (sel) => p.evaluate(s => { const e = document.querySelector(s); const g = e && (e.closest('.settings-group') || e); return g ? g.dataset.cat : null; }, sel);
    await p.waitForFunction(() => document.getElementById('pgGrupo') || true);
    await p.waitForTimeout(1500);
    // 1.
    chk('1. Categoría «💜 Pagos» siempre en el menú', await p.evaluate(() => !!document.querySelector('#ajustesCats .ajustes-cat[data-cat="pagos"]')));
    chk('1. La pasarela de Nequi está en Pagos', await cat('#nequiOnToggle') === 'pagos');
    chk('1. Los avisos de pagos al instante están en Pagos', await p.evaluate(() => !document.getElementById('pgGrupo') || document.getElementById('pgGrupo').dataset.cat === 'pagos'));
    chk('1. Domicilios por la página web y WhatsApp están en Pedidos', await cat('#domGrupoWeb') === 'pedidos' && await p.evaluate(() => !document.getElementById('waGrupo') || document.getElementById('waGrupo').dataset.cat === 'pedidos'));
    // 2.
    const tipos = await p.evaluate(() => [...document.querySelectorAll('#avTipos input[data-notif]')].map(i => i.dataset.notif));
    chk('2. Un interruptor por aviso en Notificaciones', JSON.stringify(tipos) === JSON.stringify(['pedidos', 'cuenta', 'domicilios', 'musica', 'soporte', 'ia']) && await cat('#avTipos') === 'avisos', tipos);
    chk('2. Ya no hay avisos sueltos en Pedidos ni la sección de ntfy', await p.evaluate(() => !/Avisos dentro de la app/.test(document.getElementById('view-ajustes').textContent) && !/ntfy/i.test(document.getElementById('view-ajustes').innerHTML)));
    // 3.
    const toasts = () => p.evaluate(() => [...document.querySelectorAll('.toast, #toast, .vito-toast')].map(t => t.textContent).join(' | '));
    await p.evaluate(() => { const i = document.querySelector('#avTipos input[data-notif="cuenta"]'); i.checked = false; i.dispatchEvent(new Event('change')); window.__cel = []; });
    chk('3. Apagar «Piden la cuenta» queda guardado', await p.evaluate(() => window.ventoAvisoOn('cuenta') === false && window.ventoAvisoOn('pedidos') === true));
    await p.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (t, ms) => { window.__toasts.push(t); return o(t, ms); }; window.vitoMod.procesar('CUENTA MESA 3'); });
    await p.waitForTimeout(400);
    chk('3. Con el aviso apagado no sale ni llega al celular', await p.evaluate(() => !window.__toasts.some(t => /pide la cuenta/.test(t)) && !window.__cel.some(c => /pide la cuenta/.test(c.t))), await p.evaluate(() => ({ t: window.__toasts, c: window.__cel })));
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const i = document.querySelector('#avTipos input[data-notif="cuenta"]'); i.checked = true; i.dispatchEvent(new Event('change')); window.__toasts = []; window.__cel = []; window.vitoMod.procesar('CUENTA MESA 4'); });
    await p.waitForTimeout(400);
    chk('3. Prendido otra vez: sale y llega al celular', await p.evaluate(() => window.__toasts.some(t => /pide la cuenta/.test(t)) && window.__cel.some(c => /pide la cuenta/.test(c.t) && c.c === 'pedidos')), await p.evaluate(() => ({ t: window.__toasts, c: window.__cel })));
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.__cel = []; document.querySelector('[data-notif-probar="musica"]').click(); });
    chk('3. «Probar canción» manda la notificación de MÚSICA al celular (siempre)', await p.evaluate(() => window.__cel.length === 1 && window.__cel[0].c === 'musica' && window.__cel[0].s === true) && /Te llegó la notificación/.test(await p.textContent('#avTiposMsg')));
    await p.evaluate(() => { const i = document.querySelector('#avTipos input[data-notif="musica"]'); i.checked = false; i.dispatchEvent(new Event('change')); window.__cel = []; window.__toasts = []; window.vitoMod.procesar(JSON.stringify({ t: 'cancion', v: 2, id: 'c1', mesa: 2, s: 'Karol G - Provenza', at: Date.now() })); });
    await p.waitForTimeout(400);
    chk('3. Avisos de música apagados: la canción entra a la cola pero sin aviso', await p.evaluate(() => !window.__cel.some(c => c.c === 'musica') && JSON.stringify(window.vitoMod.cola()).includes('Provenza')));
    // 4.
    const dup = await p.evaluate(() => { const vistos = {}, d = [];
      document.querySelectorAll('#view-ajustes .settings-group[data-cat] .settings-row-text > strong').forEach(s => { const t = s.textContent.replace(/\s+/g, ' ').trim().toLowerCase(); if(!t) return; if(vistos[t]) d.push(t); vistos[t] = 1; }); return d; });
    chk('4. Ningún ajuste repetido', !dup.length, dup);
    const buscar = async q => { await p.evaluate(() => { const b = document.querySelector('nav button[data-view="ajustes"]'); if(b) b.click(); }); await p.waitForTimeout(300); await p.fill('#ajBuscar', q); await p.waitForTimeout(400); return p.evaluate(() => [...document.querySelectorAll('#ajBuscarRes button')].map(b => b.textContent).slice(0, 3)); };
    let r = await buscar('notificaciones de música');
    chk('4. Buscar «notificaciones de música» lleva a Notificaciones', r.length && /Notificaciones/.test(r[0]), r);
    r = await buscar('nequi');
    chk('4. Buscar «nequi» lleva a Pagos', r.length && /Pagos/.test(r[0]), r);
    r = await buscar('voz pedidos');
    chk('4. Buscar «voz pedidos» encuentra «Anunciar los pedidos en voz alta»', r.some(x => /Anunciar los pedidos|Voz/.test(x)), r);
    // 5.
    await p.evaluate(() => { const t = document.getElementById('vozPedidosOn'); t.checked = false; t.dispatchEvent(new Event('change')); });
    chk('5. «Anunciar los pedidos en voz alta» en Ajustes → Voz usa el mismo ajuste de la campana', await cat('#vozPedidosOn') === 'voz' && await p.evaluate(() => JSON.parse(localStorage.getItem('vito_notif_cfg')).voz === false));
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
