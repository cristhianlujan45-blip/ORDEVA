// ⚡ Toques al instante sin perder nada (ORDEVA 1.58.1): guardar ya no frena el toque (se pinta primero y se guarda
// enseguida, varios toques juntos una vez), pero nunca se pierde lo tocado.
//  1. Agregar 5 cervezas seguidas: las 5 quedan guardadas (al leer lo guardado, aunque se lea de una).
//  2. Agregar y cerrar la app de una (recargar): al volver siguen ahí.
//  3. Agregar y esconder la app (pasar a otra): queda guardado en ese momento.
//  4. Cambiar de sede justo después de tocar: lo tocado queda en SU sede (no en la otra) y la otra se carga bien.
//  5. La actividad del equipo sigue anotando lo mismo (pedido a la mesa, venta).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const entrar = async () => { await p.goto(BASE + '/index.html'); await p.waitForTimeout(2000);
      if(await p.isVisible('#authBiz')){ await p.fill('#authBiz', 'Bar Rápido'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500); }
      else if(await p.isVisible('#authPass')){ await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500); }
      await p.click('#onbSaltar').catch(() => {}); await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'))); };
    await entrar();
    await p.evaluate(() => { data.modoCompleto = true; try{ aplicarModulos(); }catch(e){} data.products = [{ id: 'ag', name: 'Águila', price: 4000, stock: 100, favorite: true }]; data.tables = { 1: { items: [], people: [], payments: [] }, 2: { items: [], people: [], payments: [] } }; saveData(); renderMesas(); openTableModal(1); });
    await p.waitForTimeout(600);
    const guardadas = (mesa) => p.evaluate(async m => { const r = await storageGet(STORAGE_KEY); const d = JSON.parse(r.value); return ((d.tables[m] || {}).items || []).reduce((s, i) => s + i.qty, 0); }, mesa);
    // 1
    for(let i = 0; i < 5; i++) await p.tap('#favChips .fav-chip[data-id="ag"]');
    chk('1. Cinco toques seguidos: las 5 cervezas en pantalla', await p.evaluate(() => data.tables[1].items.reduce((s, i) => s + i.qty, 0)) === 5);
    chk('1. … y las 5 guardadas (leyendo lo guardado de una, sin esperar)', await guardadas(1) === 5, await guardadas(1));
    await p.waitForTimeout(700);    // la actividad compara 0,3 s después del último toque (como antes)
    const act = await p.evaluate(() => { try{ return JSON.parse(localStorage.getItem('vento-actividad-cola') || '[]').map(x => x.a + ': ' + x.d); }catch(e){ return []; } });
    chk('5. La actividad del equipo sigue anotando el pedido a la mesa (5 Águila)', act.some(x => /^pedido: .*5 Águila/.test(x)), act.slice(-5));
    // 2
    await p.tap('#favChips .fav-chip[data-id="ag"]');
    await p.reload(); await p.waitForTimeout(500); await entrar();
    chk('2. Agregar y cerrar la app de una: al volver sigue ahí (6)', await p.evaluate(() => data.tables[1].items.reduce((s, i) => s + i.qty, 0)) === 6, await p.evaluate(() => data.tables[1]));
    // 2b. Lo más extremo: tocar y recargar en el MISMO instante (el celular cierra la app justo al tocar).
    //      Antes de 1.59.2 lo último se perdía a veces: se escribía primero en IndexedDB y la página se iba antes.
    for(let k = 0; k < 3; k++){
      await p.evaluate(() => { data.tables[2].items.push({ productId: 'ag', name: 'Águila', price: 4000, qty: 1, personId: null }); saveData(); location.reload(); }).catch(() => {});
      await p.waitForLoadState('load'); await p.waitForTimeout(500); await entrar();
    }
    chk('2b. Tocar y que la app se cierre en el mismo instante, 3 veces: las 3 quedan guardadas', await p.evaluate(() => (data.tables[2].items || []).reduce((s, i) => s + i.qty, 0)) === 3, await p.evaluate(() => data.tables[2]));
    await p.evaluate(() => { data.tables[2] = { items: [], people: [], payments: [] }; saveData(); });
    // 3
    await p.evaluate(() => { openTableModal(1); });
    await p.waitForTimeout(400);
    await p.tap('#favChips .fav-chip[data-id="ag"]');
    const enLs = await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); return true; });
    await p.waitForTimeout(150);
    chk('3. Agregar y esconder la app: queda guardado en ese momento (7)', enLs && await p.evaluate(() => { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v).tables[1].items.reduce((s, i) => s + i.qty, 0) : -1; }) === 7);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
    // 4
    const r4 = await p.evaluate(async () => {
      const s = await addSede('Sede Norte'); const claveA = STORAGE_KEY;
      data.tables[2].items.push({ productId: 'ag', name: 'Águila', price: 4000, qty: 3, personId: null }); saveData();   // tocado y de una a la otra sede
      await switchToSede(s);
      const enB = JSON.stringify(data.tables || {}).includes('"qty":3');
      const a = JSON.parse((await storageGet(claveA)).value);
      return { claveB: STORAGE_KEY, claveA, enA: a.tables[2].items.reduce((x, i) => x + i.qty, 0), enB };
    });
    chk('4. Cambiar de sede justo después de tocar: lo tocado queda en SU sede y la otra no lo trae', r4.claveA !== r4.claveB && r4.enA === 3 && !r4.enB, r4);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
