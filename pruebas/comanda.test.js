// 🍳 ORDEVA 1.72.3 · Auditoría de restaurantes: lo que el cajero anota en la mesa llega a la cocina. Sin internet.
// Antes solo llegaban a la pantalla de preparación los pedidos del QR y de la app de meseros.
//  1. Mesa con 2 bandejas y 1 limonada: «🍳 Enviar a Cocina · 3 nuevos».
//  2. Al enviarlo: un pedido «Recibido» en la Cocina con eso, la cuenta NO cambia; «✅ Todo está en Cocina».
//  3. Se suma 1 limonada: solo esa va en el siguiente envío. Un doble toque no manda dos.
//  4. Lo que llega por la app de meseros ya está en cocina: el botón no lo vuelve a mandar.
//  5. Cancelar desde la cocina descuenta de la cuenta (como con los meseros) y no queda nada «nuevo».
//  6. Se cobra la mesa y se abre otra cuenta: empieza de cero (lo de la cuenta anterior no cuenta).
//  7. Sin la pantalla de preparación (tienda) no aparece.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products = [{ id: 'bj', name: 'Bandeja paisa', price: 28000 }, { id: 'li', name: 'Limonada', price: 6000 }, { id: 'aj', name: 'Ajiaco', price: 22000 }]; saveData(); });
    await p.waitForFunction(() => !!window.ventoComanda && !!window.vitoPedidos, null, { timeout: 10000 });
    await pausa(500);
    return { ctx, p };
  }
  const caja = p => p.evaluate(() => { const h = document.getElementById('ckCocina'); return { vis: !!h && !h.hidden && h.offsetParent !== null, t: h ? h.innerText.replace(/\s+/g, ' ') : '' }; });
  const cocina = p => p.evaluate(() => window.vitoPedidos.lista().filter(x => x.mesa === 1 && x.estado !== 'cancelado').map(x => x.estado + ':' + x.items.map(i => i.qty + ' ' + i.name).join('+')));
  const cuenta = p => p.evaluate(() => (data.tables[1].items || []).map(i => i.qty + ' ' + i.name).join(', '));
  try{
    const { p } = await abrir('restaurante', 'Restaurante La Fonda');
    // ===== 1 =====
    await p.evaluate(() => { openTableModal(1); addFavoriteToTable('bj'); addFavoriteToTable('bj'); addFavoriteToTable('li'); });
    await pausa(800);
    let v = await caja(p);
    chk('1. La mesa muestra «🍳 Enviar a Cocina · 3 nuevos» con lo que va', v.vis && /Enviar a Cocina 3 nuevos/.test(v.t) && /2 Bandeja paisa, 1 Limonada/.test(v.t), v);
    // ===== 2 =====
    const total0 = await p.evaluate(() => tableTotal(1));
    await p.click('#ckCocina [data-ck="enviar"]'); await pausa(600);
    v = { cocina: await cocina(p), cuenta: await cuenta(p), total: await p.evaluate(() => tableTotal(1)), caja: await caja(p) };
    chk('2. En la Cocina: un pedido «recibido» con 2 Bandeja paisa + 1 Limonada', v.cocina.length === 1 && v.cocina[0] === 'recibido:2 Bandeja paisa+1 Limonada', v);
    chk('2. La cuenta no cambia (no se suma dos veces)', v.cuenta === '2 Bandeja paisa, 1 Limonada' && v.total === total0, v);
    chk('2. El botón queda «✅ Todo está en Cocina»', /Todo está en Cocina/.test(v.caja.t), v.caja);
    v = await p.evaluate(() => { renderCocina(); return document.getElementById('kdsTickets').innerText; });
    chk('2. El tablero de la Cocina lo muestra en «Recibidos» (de ana)', /Recibidos/.test(v) && /2× Bandeja paisa/.test(v) && /ana/.test(v), v.slice(0, 300));
    // ===== 3 =====
    await p.evaluate(() => addFavoriteToTable('li')); await pausa(700);
    v = await caja(p);
    chk('3. Se suma 1 limonada: «1 nuevo» (solo la limonada)', /1 nuevo/.test(v.t) && /1 Limonada/.test(v.t) && !/Bandeja/.test(v.t), v);
    await p.dblclick('#ckCocina [data-ck="enviar"]'); await pausa(600);
    v = await cocina(p);
    chk('3. Va solo la limonada, y un doble toque manda UNA comanda', v.length === 2 && v[1] === 'recibido:1 Limonada', v);
    // ===== 4 =====
    await p.evaluate(() => { window.__pedidoOrigen = 'mesero:Juan'; try{ applyVoiceItems(1, [{ productText: 'Ajiaco', qty: 2 }], 'add'); }finally{ window.__pedidoOrigen = null; } renderModalItems(); });
    await pausa(700);
    v = { cocina: await cocina(p), caja: await caja(p), cuenta: await cuenta(p) };
    chk('4. Lo de la app de meseros (2 ajiacos) ya va a cocina y el botón no lo repite', v.cocina.length === 3 && /2 Ajiaco/.test(v.cocina[2]) && /Todo está en Cocina/.test(v.caja.t) && /2 Ajiaco/.test(v.cuenta), v);
    // ===== 5 =====
    await p.evaluate(() => { const x = window.vitoPedidos.lista().find(q => q.mesa === 1 && /Bandeja/.test(q.items.map(i => i.name).join())); window.vitoPedidos.cambiar(x.id, 'cancelado'); renderModalItems(); });
    await pausa(700);
    v = { cuenta: await cuenta(p), caja: await caja(p) };
    chk('5. Cancelar desde la cocina descuenta de la cuenta y no queda nada «nuevo»', !/Bandeja/.test(v.cuenta) && /Todo está en Cocina/.test(v.caja.t), v);
    // ===== 6 =====
    await p.evaluate(() => { closeTableToHistory(1); saveData(); renderMesas(); });
    await pausa(1200);
    await p.evaluate(() => { openTableModal(1); addFavoriteToTable('li'); }); await pausa(700);
    v = await caja(p);
    chk('6. Cuenta nueva en la misma mesa: empieza de cero («1 nuevo»: la limonada)', /1 nuevo/.test(v.t) && /1 Limonada/.test(v.t), v);
    // ===== 7 =====
    const t = await abrir('tienda', 'Tienda Don Pepe');
    v = await t.p.evaluate(async () => { openTableModal(1); addFavoriteToTable('li'); await new Promise(r => setTimeout(r, 800)); const h = document.getElementById('ckCocina'); return { on: window.ventoComanda.on(), vis: !!h && !h.hidden }; });
    chk('7. Sin pantalla de preparación (tienda) no aparece', !v.on && !v.vis, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Excepción: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
