// 📊 ORDEVA 1.76.0 · Resumen del día al cerrar la caja (lib/vento-resumen-dia.js). Sin internet.
//  1. El informe del cierre trae «📊 Resumen para el dueño»: ganancia, frente al cierre anterior, lo más vendido y lo que se
//     está acabando; «📲 Enviar resumen por WhatsApp» con el texto completo (y la caja: «Faltaron …»).
//  2. Un cierre nuevo que llega de otro equipo: el dueño recibe UNA notificación con el resumen corto.
//  3. Lo que ya estaba la primera vez en el equipo no se avisa; los meseros no reciben nada. Sin errores.
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
    await p.waitForFunction(() => !!window.ventoResumenDia, null, { timeout: 10000 });
    await p.evaluate(() => { const b = document.querySelector('nav button[data-view="mesas"]'); if(b) b.click(); });
    await p.waitForTimeout(500);
    return { ctx, p };
  }
  try{
    const { p } = await abrir('restaurante', 'Restaurante La Fonda');
    await p.evaluate(() => {
      window.__notif = []; window.VentoAndroid = Object.assign(window.VentoAndroid || {}, { notificar: (t, m) => { window.__notif.push(t + ' | ' + m); return true; } });
      window.__abiertos = []; window.open = u => { window.__abiertos.push(String(u)); return null; };
      const ahora = Date.now(), h = n => new Date(ahora - n * 36e5).toISOString();
      data.products = [{ id: 'bj', name: 'Bandeja paisa', price: 28000, cost: 15000, stock: 30 }, { id: 'li', name: 'Limonada', price: 6000, cost: 2000, stock: 2, minStock: 6 }];
      data.history = [
        { date: h(3), total: 62000, payments: [{ method: 'efectivo', amount: 62000 }], items: [{ name: 'Bandeja paisa', qty: 2, price: 28000, cost: 15000 }, { name: 'Limonada', qty: 1, price: 6000, cost: 2000 }] },
        { date: h(1), total: 34000, payments: [{ method: 'transferencia', amount: 34000 }], items: [{ name: 'Bandeja paisa', qty: 1, price: 28000, cost: 15000 }, { name: 'Limonada', qty: 1, price: 6000, cost: 2000 }] }];
      data.closures = [{ id: 'c0', date: h(20), from: h(30), ticketCount: 3, totalSold: 80000 }];
      saveData();
      window.ventoResumenDia.revisar();   // primera vez en este equipo: no avisa lo de antes
      const c = { id: 'c1', date: new Date(ahora).toISOString(), from: h(20), ticketCount: 2, totalSold: 96000, totalEfectivo: 62000, totalTransferencia: 34000, totalDebe: 0, hourly: [], caja: { esperado: 62000, contado: 57000, diferencia: -5000, movs: [] } };
      data.closures.unshift(c); saveData(); openClosureReport(c);
    });
    await p.waitForTimeout(300);
    let v = await p.evaluate(() => (document.querySelector('#closureReportBody .rd-box') || {}).innerText || '');
    v = v.replace(/\s+/g, ' ');
    chk('1. El informe trae «📊 Resumen para el dueño» con ganancia ~$47.000 y +20% frente al anterior', /Resumen para el dueño/i.test(v) && /Ganancia estimada \$\s?47\.000/.test(v) && /\+20%/.test(v), v);
    chk('1. … lo más vendido (Bandeja paisa 3) y lo que se acaba (Limonada)', /Bandeja paisa \(3\)/.test(v) && /Se está acabando Limonada/.test(v), v);
    await p.click('#closureReportBody [data-rd="wa"]'); await p.waitForTimeout(200);
    v = await p.evaluate(() => decodeURIComponent(window.__abiertos[0] || ''));
    chk('1. «📲 Enviar por WhatsApp»: el resumen completo con efectivo, transferencias y «Faltaron $5.000 en la caja»', /Vendido: \$\s?96\.000 en 2 cuentas \(\+20% que el cierre anterior\)/.test(v) && /Efectivo \$\s?62\.000/.test(v) && /Transferencias \$\s?34\.000/.test(v) && /Faltaron \$\s?5\.000 en la caja/.test(v), v);
    v = await p.evaluate(() => { window.ventoResumenDia.revisar(); return window.__notif.slice(); });
    chk('2. El dueño recibe UNA notificación: «📊 Cierre de caja | $96.000 en 2 cuentas (+20%) · ganancia ~$47.000 · más vendido: Bandeja paisa · faltaron $5.000»', v.length === 1 && /📊 Cierre de caja \| \$\s?96\.000 en 2 cuentas \(\+20%\)/.test(v[0]) && /ganancia ~\$\s?47\.000/.test(v[0]) && /faltaron \$\s?5\.000/.test(v[0]), v);
    v = await p.evaluate(() => { window.ventoResumenDia.revisar(); return window.__notif.length; });
    chk('2. No se repite', v === 1, v);
    v = await p.evaluate(() => { document.body.classList.add('modo-mesero'); data.closures.unshift({ id: 'c2', date: new Date().toISOString(), from: data.closures[0].date, ticketCount: 1, totalSold: 6000 }); const r = window.ventoResumenDia.revisar(); document.body.classList.remove('modo-mesero'); return { r, n: window.__notif.length }; });
    chk('3. En el celular de un mesero no avisa', v.r === null && v.n === 1, v);
    chk('3. Sin errores en la página', errs.length === 0, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e.stack || e)); }
  await b.close();
  console.log('\nRESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
