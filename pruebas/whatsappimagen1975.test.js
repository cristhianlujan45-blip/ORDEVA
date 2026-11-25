// 📲 1.99.75 · Mandar la imagen de la factura / cuenta / cierre por WhatsApp. Dentro de la app de Android, «Compartir» del
// navegador no existe: la imagen se creaba pero no había cómo mandarla. Revisa:
//  1. En la app (con VentoAndroid.compartirArchivo): la factura se manda a la app con la imagen PNG, su nombre y el texto;
//     un domicilio con celular va con «57» + el número (para abrir su chat).
//  2. El cierre de caja igual.
//  3. App vieja (solo guardarArchivo): la guarda en Descargas y dice que actualice la app.
//  4. Navegador sin «Compartir»: se descarga (como antes).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const abrir = async (puente) => {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, acceptDownloads: true });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(pz => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-guia-tour', '1'); }catch(e){}
      window.__llamadas = [];
      // html2canvas viene de internet (cdnjs), bloqueado en la prueba: uno mínimo que dibuja una imagen de muestra.
      window.html2canvas = async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 480; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 480); g.fillStyle = '#000'; g.font = '20px sans-serif'; for(let i = 0; i < 20; i++) g.fillText('Factura ' + i + ' ' + Math.random(), 10, 22 * (i + 1)); return c; };
      if(pz === 'nuevo') window.VentoAndroid = { compartirArchivo: (n, t, b64, tx, tel) => window.__llamadas.push({ f: 'compartir', n, t, len: b64.length, png: b64.slice(0, 8), tx, tel }), guardarArchivo: () => window.__llamadas.push({ f: 'guardar' }) };
      if(pz === 'viejo') window.VentoAndroid = { guardarArchivo: (n, t, b64) => window.__llamadas.push({ f: 'guardar', n, t, len: b64.length }) };
    }, puente);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(async () => { await enterApp('test', null); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      window.__toasts = []; const st = window.showToast; window.showToast = (m, ms) => { window.__toasts.push(m); try{ st(m, ms); }catch(e){} };
      data.businessName = 'Agro Prueba';
      data.history = [{ id: 'd1', invoiceNo: 'FV-9', date: new Date().toISOString(), table: null, tableName: '🛵 Domicilio: Ana', total: 35000, debt: 0, items: [{ productId: 'pa5', name: 'Purina', size: '5 kg', price: 35000, qty: 1 }], payments: [{ method: 'efectivo', amount: 35000 }], delivery: { cliente: 'Ana', telefono: '300 123 4567' } }];
      data.closures = [{ id: 'c1', date: new Date().toISOString(), from: null, ticketCount: 1, totalSold: 35000, totalEfectivo: 35000, totalTransferencia: 0, totalDebe: 0, hourly: [], z: 1 }];
      await saveData(); });
    return { ctx, p };
  };
  const espera = (p, n) => p.waitForFunction(k => window.__llamadas.length >= k || window.__toasts.some(t => /descarg|Descargas/.test(t)), n, { timeout: 15000 }).catch(() => {});
  try{
    // 1 y 2: app nueva
    let { ctx, p } = await abrir('nuevo');
    await p.evaluate(() => { shareReceiptImage(histReceiptData(data.history[0])); }); await espera(p, 1);
    await p.evaluate(() => { shareClosureImage(data.closures[0]); }); await espera(p, 2);
    let L = await p.evaluate(() => window.__llamadas);
    chk('1. Factura: va a la app con la imagen PNG (no se descarga)', L[0] && L[0].f === 'compartir' && L[0].t === 'image/png' && L[0].png === 'iVBORw0K' && L[0].len > 1000 && /^factura-\d+\.png$/.test(L[0].n), L[0]);
    chk('1. … con el texto (negocio · domicilio) y el celular del cliente con 57', L[0] && /Agro Prueba · 🛵 Domicilio: Ana/.test(L[0].tx) && L[0].tel === '573001234567', L[0]);
    chk('2. Cierre de caja: también va a la app', L[1] && L[1].f === 'compartir' && /^cierre-caja-\d+\.png$/.test(L[1].n) && /Cierre de caja · Agro Prueba/.test(L[1].tx) && L[1].tel === '', L[1]);
    // 1.99.76: la factura en TEXTO de un domicilio abre el chat del cliente; el cierre (sin cliente) deja escoger
    const urls = await p.evaluate(() => { const u = []; const o = window.open; window.open = x => { u.push(x); return null; };
      const rd = histReceiptData(data.history[0]); whatsappShareText(buildReceiptText(rd), rd.telefono); whatsappShareText(buildClosureText(data.closures[0])); window.open = o; return u; });
    chk('1. Texto de la factura del domicilio: abre el chat de Ana (wa.me/573001234567)', /^https:\/\/wa\.me\/573001234567\?text=/.test(urls[0] || ''), urls);
    chk('2. Texto del cierre: WhatsApp pregunta a quién (wa.me/?text=)', /^https:\/\/wa\.me\/\?text=/.test(urls[1] || ''), urls);
    await ctx.close();
    // 3: app vieja
    ({ ctx, p } = await abrir('viejo'));
    await p.evaluate(() => { shareReceiptImage(histReceiptData(data.history[0])); }); await espera(p, 1);
    L = await p.evaluate(() => ({ l: window.__llamadas, t: window.__toasts }));
    chk('3. App vieja: la guarda en Descargas y dice que actualice la app', L.l[0] && L.l[0].f === 'guardar' && L.l[0].len > 1000 && L.t.some(x => /Actualiza la app ORDEVA/.test(x)), L);
    await ctx.close();
    // 4: navegador
    ({ ctx, p } = await abrir('ninguno'));
    const dl = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await p.evaluate(() => { shareReceiptImage(histReceiptData(data.history[0])); });
    const d = await dl;
    chk('4. Navegador sin «Compartir»: se descarga la imagen', !!d && /^factura-\d+\.png$/.test(d.suggestedFilename()), d && d.suggestedFilename());
    await ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs.join(' | '));
  await b.close(); console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
