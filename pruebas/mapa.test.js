// 🗺️ ORDEVA 1.74.0 · Mapa profesional de mesas y habitaciones (lib/vento-mapa.js). Sin internet.
//  Restaurante:
//   1. Cada mesa dice su estado con color: libre («Libre»), ocupada («Ocupada · 35 min»).
//   2. Arriba, el conteo por estado; al tocar «ocupadas» solo se ven esas; al tocarlo otra vez, todas.
//   3. Pedido listo en cocina: la mesa avisa «🔔 Pedido listo para servir» (y cuenta en «para atender»).
//   4. Reserva en 2 horas: la mesa libre queda «Reservada · …» (azul).
//   5. Mapa del local: los mismos estados (borde de color, insignia, «Libre» en vez de «Vacía»).
//  Hotel:
//   6. Habitaciones 101, 102, 201, 202: agrupadas por piso.
//   7. Al cobrar, la habitación queda «🧹 Por limpiar», con «✅ Ya está limpia» en la tarjeta. Al tocarlo, queda libre.
//   8. En una habitación vacía: «Estado de la habitación: Limpia / Por limpiar / Fuera de servicio».
//   9. Sin errores en la página.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  async function abrir(tipo, nombre){
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nombre + ': ' + e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1000);
    await p.evaluate(t => { const s = document.getElementById('authType'); if(s){ s.value = t; s.dispatchEvent(new Event('change')); } }, tipo);
    await p.fill('#authBiz', nombre); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
    await p.waitForFunction(() => !!window.ventoMapa, null, { timeout: 10000 });
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); });
    await p.waitForTimeout(500);
    return { ctx, p };
  }
  const tarjetas = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#tableGrid .ticket')].map(c => [c.dataset.id, { est: c.dataset.est, vis: getComputedStyle(c).display !== 'none', txt: c.innerText.replace(/\s+/g, ' ') }])));
  try{
    // ================= Restaurante =================
    const { p, ctx } = await abrir('restaurante', 'Restaurante El Fogón');
    await p.evaluate(() => {
      const pr = data.products[0], hace = Date.now() - 35 * 6e4;
      data.tables[2] = { items: [{ productId: pr.id, name: pr.name, price: pr.price, size: '', qty: 2, personId: null, history: [{ qty: 2, at: hace, k: 'a' }] }], payments: [], people: [] };
      saveData(); renderMesas();
    });
    await p.waitForTimeout(300);
    let t = await tarjetas(p);
    chk('1. Mesa libre: estado «libre» y dice «Libre»', t[1] && t[1].est === 'libre' && /Libre/.test(t[1].txt) && !/Vacía/.test(t[1].txt), t[1]);
    chk('1. Mesa abierta hace 35 min: «Ocupada · 35 min»', t[2] && t[2].est === 'ocupada' && /Ocupada · 3[4-6] min/.test(t[2].txt), t[2]);
    let v = await p.evaluate(() => [...document.querySelectorAll('#mesasSummary [data-mpf]')].map(x => x.dataset.mpf + ':' + x.querySelector('b').innerText.trim()));
    const nMesas = Object.keys(t).length;
    chk('2. Conteo arriba: ' + (nMesas - 1) + ' libres y 1 ocupada', v.includes('libre:' + (nMesas - 1)) && v.includes('ocupada:1'), v);
    await p.click('#mesasSummary [data-mpf="ocupada"]'); await p.waitForTimeout(300);
    t = await tarjetas(p);
    chk('2. Al tocar «ocupadas» solo se ve la mesa 2', t[2].vis && Object.keys(t).filter(k => t[k].vis).length === 1, Object.keys(t).filter(k => t[k].vis));
    v = await p.evaluate(() => (document.getElementById('mpFiltro') || {}).innerText || '');
    chk('2. Dice «Mostrando: Ocupadas (1) · Ver todas»', /Mostrando: Ocupadas \(1\)/.test(v), v);
    await p.click('#mesasSummary [data-mpf="ocupada"]'); await p.waitForTimeout(300);
    t = await tarjetas(p);
    chk('2. Al tocarlo otra vez se ven todas', Object.keys(t).every(k => t[k].vis) && !(await p.$('#mpFiltro')), Object.keys(t).filter(k => !t[k].vis));

    // 3. Pedido listo en cocina
    await p.evaluate(() => { const E = window.vitoPedidos; E.entrante({ id: 'mp1', mesa: 2, items: [{ n: 'Café', q: 1 }] }, 'mesero:Ana'); E.cambiar('mp1', 'listo'); renderMesas(); });
    await p.waitForTimeout(300);
    t = await tarjetas(p);
    v = await p.evaluate(() => ({ al: document.querySelector('#tableGrid .ticket[data-id="2"]').classList.contains('mp-alerta'), cnt: (document.querySelector('#mesasSummary [data-mpf="alerta"] b') || {}).innerText }));
    chk('3. Pedido listo: la mesa 2 avisa «🔔 Pedido listo para servir» y resalta', /Pedido listo para servir/.test(t[2].txt) && v.al, { t: t[2], v });
    chk('3. Arriba: «1 para atender»', /1/.test(v.cnt || ''), v);
    await p.evaluate(() => { window.vitoPedidos.cambiar('mp1', 'entregado'); renderMesas(); });

    // 4. Reserva en 2 horas para la mesa 3
    await p.evaluate(() => {
      const st = window.ventoReservas.estado(), d = new Date(Date.now() + 2 * 36e5), h = new Date(d.getTime() + 2 * 36e5);
      st.lista = [{ id: 'r1', recurso: '3', estado: 'confirmada', origen: 'agente', desde: d.toISOString(), hasta: h.toISOString(), cliente: 'Carlos', personas: 4 }];
      window.ventoReservas.activo = () => true;
      renderMesas();
    });
    await p.waitForTimeout(300);
    t = await tarjetas(p);
    chk('4. La mesa 3 queda «Reservada» en azul, con «Carlos (4)»', t[3].est === 'reservada' && /Reservada/.test(t[3].txt) && !/Libre/.test(t[3].txt) && /Carlos/.test(t[3].txt), t[3]);
    v = await p.evaluate(() => [...document.querySelectorAll('#mesasSummary [data-mpf]')].map(x => x.dataset.mpf + ':' + x.querySelector('b').innerText.trim()));
    chk('4. Arriba: «1 reservada»', v.includes('reservada:1'), v);

    // 5. Mapa del local
    await p.evaluate(() => { data.tableViewMode = 'map'; updateMesaViewUI(); }); await p.waitForTimeout(400);
    v = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#floorPlan .floor-table')].map(e => [e.dataset.id, { est: e.dataset.est, s: (e.querySelector('.ft-status') || {}).innerText, badge: (e.querySelector('.ft-badge') || {}).innerText || '', borde: getComputedStyle(e).borderTopColor }])));
    chk('5. Mapa: mesa 1 libre («Libre», borde verde)', v[1] && v[1].est === 'libre' && v[1].s === 'Libre' && /22, 163, 74/.test(v[1].borde), v[1]);
    chk('5. Mapa: mesa 2 ocupada con el valor y el tiempo', v[2] && v[2].est === 'ocupada' && /\$/.test(v[2].s) && /3[4-6]′/.test(v[2].s), v[2]);
    chk('5. Mapa: mesa 3 reservada con insignia 📅', v[3] && v[3].est === 'reservada' && v[3].badge === '📅' && /37, 99, 235/.test(v[3].borde), v[3]);
    await p.click('#mesasSummary [data-mpf="reservada"]'); await p.waitForTimeout(300);
    v = await p.evaluate(() => [...document.querySelectorAll('#floorPlan .floor-table')].filter(e => !e.classList.contains('mp-tenue')).map(e => e.dataset.id));
    chk('5. Mapa: al filtrar «reservadas» solo la mesa 3 queda resaltada', v.length === 1 && v[0] === '3', v);
    await p.click('#mesasSummary [data-mpf="reservada"]');
    await p.evaluate(() => { data.tableViewMode = 'list'; updateMesaViewUI(); }); await p.waitForTimeout(300);
    await p.screenshot({ path: (process.env.CAPTURAS || '/tmp') + '/mapa-restaurante.png' }).catch(() => {});
    await ctx.close();

    // ================= Hotel =================
    const H = await abrir('hotel', 'Hotel Las Palmas'); const q = H.p;
    await q.evaluate(() => {
      const nombres = ['101', '102', '201', '202'];
      Object.keys(data.tables).forEach(k => delete data.tables[k]);
      nombres.forEach((n, i) => { data.tables[i + 1] = { name: 'Habitación ' + n, items: [], payments: [], people: [] }; });
      data.tableCount = 4;
      const pr = data.products[0];
      data.tables[2].items = [{ productId: pr.id, name: pr.name, price: pr.price, size: '', qty: 1, personId: null, history: [{ qty: 1, at: Date.now() - 36e5, k: 'a' }] }];
      saveData(); renderMesas();
    });
    await q.waitForTimeout(300);
    v = await q.evaluate(() => [...document.querySelectorAll('#tableGrid > *')].map(e => e.classList.contains('mp-piso') ? '[' + e.innerText + ']' : e.dataset.id));
    chk('6. Hotel: agrupadas por piso «Piso 1: 101, 102 · Piso 2: 201, 202»', JSON.stringify(v) === JSON.stringify(['[PISO 1]', '1', '2', '[PISO 2]', '3', '4']) || JSON.stringify(v) === JSON.stringify(['[Piso 1]', '1', '2', '[Piso 2]', '3', '4']), v);
    // 7. Cobrar la 102
    await q.evaluate(() => openTableModal(2)); await q.waitForTimeout(500);
    await q.evaluate(() => { const b = [document.getElementById('vsCobrarBtn'), document.getElementById('chargeBtn')].find(x => x && x.offsetParent); b.click(); }); await q.waitForTimeout(500);
    await q.evaluate(() => { const b = [...document.querySelectorAll('button[data-m="efectivo"]')].find(x => x.offsetParent); b && b.click(); }); await q.waitForTimeout(700);
    await q.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); renderMesas(); }); await q.waitForTimeout(300);
    t = await tarjetas(q);
    chk('7. Cobrada: la 102 queda «Por limpiar» con «✅ Ya está limpia»', t[2] && t[2].est === 'sucia' && /Por limpiar/.test(t[2].txt) && /Ya está limpia/.test(t[2].txt), t[2]);
    v = await q.evaluate(() => [...document.querySelectorAll('#mesasSummary [data-mpf]')].map(x => x.dataset.mpf + ':' + x.querySelector('b').innerText.trim()));
    chk('7. Arriba: «1 por limpiar»', v.includes('sucia:1'), v);
    await q.click('#tableGrid .ticket[data-id="2"] [data-mapa="limpia"]'); await q.waitForTimeout(300);
    t = await tarjetas(q);
    v = await q.evaluate(() => ({ modal: document.getElementById('overlay').classList.contains('show'), aseo: data.tables[2].aseo }));
    chk('7. «Ya está limpia»: queda libre, sin abrir la cuenta', t[2].est === 'libre' && !v.modal && !v.aseo, { t: t[2], v });
    // 8. Estado de la habitación vacía
    await q.evaluate(() => openTableModal(4)); await q.waitForTimeout(800);
    v = await q.evaluate(() => { const b = document.getElementById('mpAseo'); return b && !b.hidden ? b.innerText.replace(/\s+/g, ' ') : ''; });
    chk('8. Habitación vacía: «Estado de la habitación: Limpia · Por limpiar · Fuera de servicio»', /Estado de la habitación/.test(v) && /Limpia/.test(v) && /Por limpiar/.test(v) && /Fuera de servicio/.test(v), v);
    await q.click('#mpAseo [data-mapa="mant"]'); await q.waitForTimeout(300);
    await q.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); renderMesas(); }); await q.waitForTimeout(300);
    t = await tarjetas(q);
    chk('8. «Fuera de servicio»: la 202 queda en gris y lo dice', t[4].est === 'mant' && /Fuera de servicio/.test(t[4].txt), t[4]);
    await q.screenshot({ path: (process.env.CAPTURAS || '/tmp') + '/mapa-hotel.png' }).catch(() => {});
    chk('9. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
