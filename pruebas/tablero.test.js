// 🛰️ Tablero de Estadísticas (lib/vento-tablero.js), con la hora fija (jueves 22 oct 2026, 3:30 p. m. en Colombia) y
// ventas sembradas en mesas y en caja: las 4 tarjetas (pedidos, ingresos, ticket, productos) con su ▲/▼ contra ayer,
// la gráfica de ingresos por hora (mesas y caja) con el cruce al tocar, el ESTIMADO del resto del día (con los 4 jueves
// anteriores, marcado como estimado y separado de lo real), los más vendidos con «Otros», la carga de trabajo
// (finalizados vs. cancelados por QR y devoluciones), los últimos movimientos (FINALIZADO / FIADO / DEVOLUCIÓN), las
// órdenes recientes con páginas, «Lo que ve Laya» con cifras reales, el cambio de período, la paleta clara y que nada
// se salga de la pantalla en celular, tablet y computador.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
const FOTOS = process.env.VENTO_FOTOS || '';
const AHORA = new Date('2026-10-22T15:30:00-05:00');
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const abrir = async (w, h) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900, timezoneId: 'America/Bogota', locale: 'es-CO' });
    await ctx.clock.setFixedTime(AHORA);
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1800);
    await p.evaluate(async () => {
      await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      const at = (dias, h, m) => { const d = new Date(Date.now()); d.setDate(d.getDate() - dias); d.setHours(h, m || 0, 0, 0); return d.toISOString(); };
      const it = (name, qty, price) => ({ name, qty, price, cost: null });
      const H = [];
      let n = 0;
      const venta = (dias, h, m, mesa, items, extra) => { n++; const total = items.reduce((s, x) => s + x.qty * x.price, 0);
        H.push(Object.assign({ id: String(1760000000000 + n) + (mesa == null ? '-qs' : ''), table: mesa, tableName: mesa == null ? 'Mostrador' : 'Mesa ' + mesa, invoiceNo: mesa == null ? undefined : 'FV-' + String(1000 + n),
          total, debt: 0, items, payments: [{ note: 'Pagó', amount: total, method: 'efectivo' }], date: at(dias, h, m) }, extra || {})); };
      // HOY: 11 ventas (8 en mesas y 3 en caja), una fiada y una con devolución
      venta(0, 10, 5, 1, [it('Águila', 4, 3500)]);                                   // 14000
      venta(0, 11, 20, 2, [it('Águila', 2, 3500), it('Empanada', 3, 2500)]);        // 14500
      venta(0, 12, 10, null, [it('Gaseosa', 2, 3000)]);                              // 6000 caja
      venta(0, 12, 40, 3, [it('Club Colombia', 6, 4500)]);                           // 27000
      venta(0, 13, 0, 4, [it('Papas', 2, 2000), it('Águila', 1, 3500)], { debt: 7500, payments: [{ note: 'Juan', amount: 7500, method: 'debe' }] });   // 7500
      venta(0, 13, 30, null, [it('Tinto', 3, 1500), it('🛵 Domicilio', 1, 4000)]);    // 8500 caja (4500 + domicilio)
      venta(0, 14, 0, 5, [it('Pandebono', 4, 1800)]);                                // 7200
      venta(0, 14, 15, 6, [it('Águila', 3, 3500)], { devoluciones: [{ t: Date.parse(at(0, 14, 50)), items: [], total: 0 }] });   // 10500
      venta(0, 14, 45, null, [it('Chocorramo', 2, 2500)]);                           // 5000 caja
      venta(0, 15, 0, 7, [it('Jugo de mora', 2, 5000)]);                             // 10000
      venta(0, 15, 20, 8, [it('Buñuelo', 5, 1200)]);                                 // 6000
      // AYER: 4 ventas (60000)
      venta(1, 12, 0, 1, [it('Águila', 10, 3500)]); venta(1, 13, 0, 2, [it('Águila', 5, 2000)]); venta(1, 14, 0, null, [it('Tinto', 5, 1000)]); venta(1, 19, 0, 3, [it('Papas', 5, 2000)]);
      // Los 4 jueves anteriores: a las 18 h (20000) y a las 20 h (10000) → estimado del resto = 30000
      for(const s of [7, 14, 21, 28]){ venta(s, 18, 0, 1, [it('Águila', 4, 5000)]); venta(s, 20, 0, null, [it('Tinto', 10, 1000)]); }
      data.history = H.sort((a, c) => Date.parse(c.date) - Date.parse(a.date));
      window.__pedidosFalsos = [{ estado: 'cancelado', at: Date.parse(at(0, 11, 50)), items: [] }, { estado: 'entregado', at: Date.parse(at(0, 12, 0)), items: [] }];
      window.vitoPedidos = Object.assign(window.vitoPedidos || {}, { lista: () => window.__pedidosFalsos });
      await saveData(); renderAll();
      document.querySelector('nav button[data-view="estadisticas"]').click();
      const b2 = document.querySelector('#stPer button[data-p="hoy"]'); b2 && b2.click();
    });
    await p.waitForTimeout(400);
    return { ctx, p };
  };
  try{
    // ---------------- Computador ----------------
    let { ctx, p } = await abrir(1366, 900);
    const r = await p.evaluate(() => {
      const box = document.getElementById('tableroVento'), q = s => box.querySelector(s), qa = s => [...box.querySelectorAll(s)];
      return {
        kpis: qa('.tb-kpi').map(k => ({ l: k.querySelector('.tb-kpi-l').textContent, v: k.querySelector('.tb-kpi-v').textContent, c: (k.querySelector('.tb-cambio') || {}).textContent || '', vs: (k.querySelector('.tb-kpi-pie small') || {}).textContent || '' })),
        dos: qa('.tb-dos > div').map(d => d.textContent),
        lineas: qa('.tb-l').length, est: !!q('.tb-est'), nota: (q('.tb-ing .tb-nota') || {}).textContent || '',
        top: qa('.tb-top li').map(li => li.textContent), carga: (q('.tb-ley') || {}).textContent || '',
        movs: qa('.tb-mv').map(m => m.textContent), filas: qa('.tb-tabla tbody tr').length, pag: (q('.tb-pag small') || {}).textContent || '',
        laya: qa('.tb-laya-l li').map(x => x.textContent), stats: !!document.querySelector('#statsBody .st-kpis'), claro: box.classList.contains('tb-claro')
      };
    });
    const K = Object.fromEntries(r.kpis.map(k => [k.l, k]));
    // Hoy: 11 ventas; ingresos 14000+14500+6000+27000+7500+8500+7200+10500+5000+10000+6000 = 116200; ayer 60000 en 4
    chk('Tarjeta «Pedidos totales»: 11, ▲ 175% vs. ayer (4)', K['Pedidos totales'] && K['Pedidos totales'].v === '11' && /▲\s*175%/.test(K['Pedidos totales'].c) && /ayer/.test(K['Pedidos totales'].vs), K['Pedidos totales']);
    chk('Tarjeta «Ingresos totales»: $116.200, ▲ 94% vs. ayer ($60.000)', K['Ingresos totales'] && K['Ingresos totales'].v === '$116.200' && /▲\s*94%/.test(K['Ingresos totales'].c), K['Ingresos totales']);
    chk('Tarjeta «Ticket promedio»: $10.564 (116200 / 11), ▼ 30% vs. ayer ($15.000)', K['Ticket promedio'] && K['Ticket promedio'].v === '$10.564' && /▼\s*30%/.test(K['Ticket promedio'].c), K['Ticket promedio']);
    // Unidades (sin el domicilio): 4+5+2+6+3+3+4+3+2+2+5 = 39; ayer 25
    chk('Tarjeta «Productos vendidos»: 39 (sin contar el domicilio), ▲ 56% vs. ayer (25)', K['Productos vendidos'] && K['Productos vendidos'].v === '39' && /▲\s*56%/.test(K['Productos vendidos'].c), K['Productos vendidos']);
    // Mesas: 14000+14500+27000+7500+7200+10500+10000+6000 = 96700; caja 6000+8500+5000 = 19500
    chk('Ingresos en mesas ($96.700) y en caja ($19.500), por separado', r.dos.some(t => /mesas/i.test(t) && t.includes('$96.700')) && r.dos.some(t => /caja/i.test(t) && t.includes('$19.500')), r.dos);
    chk('ESTIMADO al cierre $146.200 (real $116.200 + $30.000 de los 4 jueves anteriores), marcado «ESTIMADO»', r.dos.some(t => /Estimado al cierre/.test(t) && t.includes('$146.200') && /ESTIMADO/.test(t)), r.dos);
    chk('La gráfica tiene las dos líneas (mesas y caja) y el estimado aparte, punteado, con su nota «no es plata que ya entró»', r.lineas === 2 && r.est && /estimado/.test(r.nota) && /4 jueves/.test(r.nota), r);
    chk('Más vendidos: Águila primero (10 u) y «Otros» al final', /Águila/.test(r.top[0] || '') && /10 u/.test(r.top[0] || '') && /Otros/.test(r.top[r.top.length - 1] || '') && r.top.length === 6, r.top);
    chk('Carga de trabajo: 11 finalizados y 2 cancelados o devueltos (1 pedido QR cancelado + 1 devolución)', /Finalizado\s*11/.test(r.carga) && /devuelto\s*2/.test(r.carga), r.carga);
    chk('Últimos movimientos: 11 tarjetas, la primera es la más nueva (Mesa 8, $6.000)', r.movs.length === 11 && /Mesa 8/.test(r.movs[0]) && /\$6\.000/.test(r.movs[0]), r.movs.slice(0, 2));
    chk('… con su estado: FINALIZADO, FIADO (Mesa 4) y DEVOLUCIÓN (Mesa 6)', r.movs.some(m => /Mesa 4/.test(m) && /FIADO/.test(m)) && r.movs.some(m => /Mesa 6/.test(m) && /DEVOLUCIÓN/.test(m)) && r.movs.some(m => /FINALIZADO/.test(m)), r.movs);
    chk('Órdenes recientes: 8 por página, «11 órdenes · página 1 de 2»', r.filas === 8 && /11 órdenes · página 1 de 2/.test(r.pag), r);
    chk('«Lo que ve Laya» con cifras reales (hora más fuerte 12:00 con $33.000, Águila, +94% que ayer) y el estimado dicho como estimado',
      r.laya.some(x => /12:00/.test(x) && /\$33\.000/.test(x)) && r.laya.some(x => /Águila/.test(x)) && r.laya.some(x => /94%/.test(x)) && r.laya.some(x => /ESTIMADO/.test(x) && /no es una cifra real/.test(x)), r.laya);
    chk('Las estadísticas de siempre siguen debajo del tablero', r.stats);
    chk('Con la paleta oscura usa los colores para fondo oscuro', !r.claro);
    // Página 2
    await p.evaluate(() => document.querySelector('#tableroVento .tb-pag button[data-pag="2"]').click()); await p.waitForTimeout(100);
    const p2 = await p.evaluate(() => ({ filas: document.querySelectorAll('#tableroVento .tb-tabla tbody tr').length, pag: document.querySelector('#tableroVento .tb-pag small').textContent, ultima: [...document.querySelectorAll('#tableroVento .tb-tabla tbody tr')].pop().textContent }));
    chk('Página 2: las 3 órdenes más viejas («página 2 de 2»), la última es la primera venta del día (Mesa 1, 10:05)', p2.filas === 3 && /página 2 de 2/.test(p2.pag) && /Mesa 1/.test(p2.ultima) && /10:05/.test(p2.ultima), p2);
    // Cruce de la gráfica
    await p.evaluate(() => { document.querySelectorAll('.voice-fab-wrap,.voice-fab-tab,#libretaFab').forEach(e => e.style.display = 'none'); document.querySelector('#tableroVento .tb-plot').scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(100);
    const caja = await p.locator('#tableroVento .tb-hit').boundingBox();
    await p.mouse.move(caja.x + caja.width * 0.33, caja.y + caja.height / 2); await p.waitForTimeout(80);
    const tip = await p.evaluate(() => { const t = document.querySelector('#tableroVento .tb-tip'); return { vis: !t.hidden, txt: t.textContent }; });
    chk('Al pasar por la gráfica sale la ventanita con la hora, en mesas, en caja y el total', tip.vis && /En mesas/.test(tip.txt) && /En caja/.test(tip.txt) && /Total/.test(tip.txt), tip);
    await p.mouse.move(caja.x + caja.width * 0.85, caja.y + caja.height / 2); await p.waitForTimeout(80);
    const tip2 = await p.evaluate(() => document.querySelector('#tableroVento .tb-tip').textContent);
    chk('… y en una hora que no ha llegado dice «Estimado, no es real todavía»', /Estimado/.test(tip2) && /no es real/.test(tip2), tip2);
    if(FOTOS) await p.locator('#view-estadisticas').screenshot({ path: FOTOS + '/tablero-1366.png' });
    // 7 días
    await p.evaluate(() => document.querySelector('#stPer button[data-p="7"]').click()); await p.waitForTimeout(200);
    const r7 = await p.evaluate(() => ({ k: [...document.querySelectorAll('#tableroVento .tb-kpi')].map(k => k.querySelector('.tb-kpi-v').textContent + '|' + ((k.querySelector('.tb-kpi-pie small') || {}).textContent || '')), est: !!document.querySelector('#tableroVento .tb-est'), ing: document.querySelector('#tableroVento .tb-card-h h3').textContent }));
    // 7 días: hoy (11) + ayer (4) + el jueves de hace 7 días cae fuera (empieza hace 6 días) → 15
    chk('7 días: 15 pedidos «vs. 7 días antes», ingresos por día y sin estimado', /^15\|vs\. 7 días antes/.test(r7.k[0]) && /por día/.test(r7.ing) && !r7.est, r7);
    // Paleta clara
    await p.evaluate(() => { try{ applyPalette('claro'); }catch(e){} document.querySelector('#stPer button[data-p="hoy"]').click(); });
    await p.waitForTimeout(200);
    chk('Con la paleta clara cambia a los colores para fondo claro', await p.evaluate(() => document.getElementById('tableroVento').classList.contains('tb-claro')));
    if(FOTOS) await p.locator('#view-estadisticas').screenshot({ path: FOTOS + '/tablero-claro.png' });
    await ctx.close();
    // ---------------- Celulares y tablet ----------------
    for(const [w, h] of [[320, 640], [390, 844], [768, 1024]]){
      ({ ctx, p } = await abrir(w, h));
      const m = await p.evaluate(() => {
        const W = innerWidth, box = document.getElementById('tableroVento');
        const fuera = [...box.querySelectorAll('*')].filter(e => !e.closest('.tb-mov') && !e.closest('.tb-tabla-wrap') && e.checkVisibility && e.checkVisibility()).filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && (r.right > W + 1 || r.left < -1); }).map(e => e.className.baseVal != null ? e.className.baseVal || e.tagName : e.className || e.tagName).slice(0, 5);
        const k = [...box.querySelectorAll('.tb-kpi')].map(x => x.getBoundingClientRect());
        return { scroll: document.documentElement.scrollWidth > W + 1, fuera, dosCol: k.length === 4 && Math.abs(k[0].top - k[1].top) < 2 && k[2].top > k[0].bottom - 1 };
      });
      chk(w + ' px: nada del tablero se sale por los lados (la tabla y los movimientos se deslizan dentro de su tarjeta)', !m.scroll && !m.fuera.length, m);
      if(w < 700) chk(w + ' px: las 4 tarjetas van de a 2', m.dosCol, m);
      if(FOTOS) await p.locator('#view-estadisticas').screenshot({ path: FOTOS + '/tablero-' + w + '.png' });
      await ctx.close();
    }
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
