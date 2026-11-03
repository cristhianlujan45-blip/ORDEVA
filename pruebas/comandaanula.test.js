// ❌ ORDEVA 1.75.0 · Anular en cocina lo que se quitó de la cuenta (lib/vento-comanda.js). Sin internet.
//  1. Se mandan 2 bandejas y 1 limonada; se quita 1 bandeja: «❌ Avisar a Cocina: no preparar · Quitaste 1 Bandeja paisa».
//  2. Al avisar: la Cocina recibe «❌ ANULAR Bandeja paisa» (1), la cuenta NO cambia y queda «✅ Todo está en Cocina».
//  3. La Cocina marca la anulación como entregada o la cancela: la cuenta sigue igual (no suma ni resta).
//  4. Si la Cocina cancela la anulación, vuelve a pedir avisar (no se pierde).
//  5. Se quita TODO de la cuenta (sin cobrar): pide anular lo que quedaba.
//  6. Se vuelve a anotar lo anulado: va como nuevo a la Cocina.
//  7. Al cobrar no pide anular nada. Sin errores.
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
    await p.evaluate(() => { openTableModal(1); addFavoriteToTable('bj'); addFavoriteToTable('bj'); addFavoriteToTable('li'); });
    await pausa(700);
    await p.click('#ckCocina [data-ck="enviar"]'); await pausa(600);
    const quitar = (n, q) => p.evaluate(([n, q]) => { const t = data.tables[1]; const it = t.items.find(i => i.name === n); if(q <= 0) t.items = t.items.filter(i => i !== it); else it.qty = q; saveData(); renderModalItems(); }, [n, q]);
    await quitar('Bandeja paisa', 1); await pausa(800);
    let v = await caja(p);
    chk('1. Se quitó 1 bandeja ya enviada: «Avisar a Cocina: no preparar · Quitaste 1 Bandeja paisa»', v.vis && /Avisar a Cocina: no preparar/.test(v.t) && /Quitaste 1 Bandeja paisa que ya estaba en Cocina/.test(v.t), v);
    const total0 = await p.evaluate(() => tableTotal(1));
    await p.click('#ckCocina [data-ck="anular"]'); await pausa(700);
    v = { cocina: await cocina(p), cuenta: await cuenta(p), total: await p.evaluate(() => tableTotal(1)), caja: await caja(p) };
    chk('2. La Cocina recibe «ANULAR Bandeja paisa» (1)', v.cocina.length === 2 && v.cocina[1] === 'recibido:1 ❌ ANULAR Bandeja paisa', v);
    chk('2. La cuenta no cambia y queda «✅ Todo está en Cocina»', v.cuenta === '1 Bandeja paisa, 1 Limonada' && v.total === total0 && /Todo está en Cocina/.test(v.caja.t) && !/Avisar/.test(v.caja.t), v);
    v = await p.evaluate(() => { renderCocina(); return document.getElementById('kdsTickets').innerText; });
    chk('2. El tablero de la Cocina lo muestra con la nota «ya no lo preparen»', /ANULAR Bandeja paisa/.test(v) && /ya no lo preparen/.test(v), v.slice(0, 400));
    const idA = await p.evaluate(() => window.vitoPedidos.lista().find(x => x.anula).id);
    await p.evaluate(id => { window.vitoPedidos.cambiar(id, 'preparacion'); window.vitoPedidos.cambiar(id, 'entregado'); }, idA); await pausa(400);
    v = { cuenta: await cuenta(p), total: await p.evaluate(() => tableTotal(1)) };
    chk('3. La Cocina la marca entregada: la cuenta sigue igual (no se sumó «ANULAR»)', v.cuenta === '1 Bandeja paisa, 1 Limonada' && v.total === total0, v);
    // Una anulación nueva para probar cancelarla
    await quitar('Limonada', 0); await pausa(800);
    await p.click('#ckCocina [data-ck="anular"]'); await pausa(600);
    const idB = await p.evaluate(() => window.vitoPedidos.lista().filter(x => x.anula).pop().id);
    await p.evaluate(id => window.vitoPedidos.cambiar(id, 'cancelado'), idB); await pausa(800);
    v = { cuenta: await cuenta(p), caja: await caja(p) };
    chk('3. La Cocina cancela la anulación: la cuenta sigue igual', v.cuenta === '1 Bandeja paisa', v);
    chk('4. …y vuelve a pedir «Avisar a Cocina» por la limonada', /Avisar a Cocina/.test(v.caja.t) && /1 Limonada/.test(v.caja.t), v.caja);
    await p.click('#ckCocina [data-ck="anular"]'); await pausa(600);
    // 5. Quitar todo
    await quitar('Bandeja paisa', 0); await pausa(900);
    v = await caja(p);
    chk('5. Se quitó todo de la cuenta: pide anular la bandeja que quedaba', v.vis && /Avisar a Cocina/.test(v.t) && /1 Bandeja paisa/.test(v.t), v);
    await p.click('#ckCocina [data-ck="anular"]'); await pausa(600);
    v = await caja(p);
    chk('5. Avisado: ya no queda nada por avisar', !v.vis || !/Avisar/.test(v.t), v);
    // 6. Volver a anotar lo anulado
    await p.evaluate(() => addFavoriteToTable('bj')); await pausa(800);
    v = await caja(p);
    chk('6. Se vuelve a anotar 1 bandeja: va como nueva a la Cocina', /Enviar a Cocina 1 nuevo/.test(v.t) && !/Avisar/.test(v.t), v);
    await p.click('#ckCocina [data-ck="enviar"]'); await pausa(600);
    // 7. Cobrar
    await p.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }); await pausa(500);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button[data-m="efectivo"]')].find(x => x.offsetParent); b && b.click(); }); await pausa(700);
    await p.evaluate(() => openTableModal(1)); await pausa(800);
    v = await caja(p);
    chk('7. Después de cobrar: no pide anular nada', !v.vis || !/Avisar/.test(v.t), v);
    chk('7. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
