// 🎓 Practicar una venta (ORDEVA 1.55.0, guía para mayores): un ensayo completo con los productos del negocio y la voz,
// SIN tocar los datos del negocio.
//  1. Sale en «Más» del modo fácil y en «🙋 Ayúdame» («quiero practicar una venta»).
//  2. Mesa → productos → Cobrar → cómo pagan → billete → cuánto devolver (efectivo) o el aviso de Nequi.
//  3. Cada error da una pista amable (mesa equivocada, cantidades, forma de pago, billete, cambio).
//  4. Al final: cuántas veces ha practicado; los datos del negocio quedan EXACTAMENTE igual (sin ventas, sin mesas, sin
//     inventario descontado).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Tienda Doña Rosa'); await p.fill('#authUser', 'rosa'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn');
    await p.waitForFunction(() => document.getElementById('authOverlay').hidden, null, { timeout: 15000 });
    await p.click('#onbSaltar', { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.products.push({ id: 'pa', name: 'Águila', price: 3500, stock: 40, favorite: true }, { id: 'pb', name: 'Gaseosa', price: 2500, stock: 30 }, { id: 'pc', name: 'Papas', price: 2000, stock: 20 }); saveData(); });
    await p.waitForFunction(() => !!(window.ventoGuia && window.ventoGuia.practicar), null, { timeout: 10000 });
    const toast = () => p.evaluate(() => (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '');
    const preg = () => p.evaluate(() => document.querySelector('#gzOv .gz-preg').textContent);
    const clic = sel => p.evaluate(s => document.querySelector('#gzOv ' + s).click(), sel);

    // ===== 1. Dónde está =====
    chk('1. «🙋 Ayúdame»: «quiero practicar una venta» lleva a la práctica', await p.evaluate(() => window.ventoGuia.ruta('quiero practicar una venta') === 'practica' && window.ventoGuia.ruta('cómo vendo') === 'vender'));
    await p.evaluate(() => { data.easyMode = true; window.ventoFacil.aplicar(); window.ventoFacil.ir('mas'); });
    const tarjeta = await p.evaluate(() => { const x = Array.from(document.querySelectorAll('#facilApp .fz-tarea')).find(b => /Practicar una venta/.test(b.textContent)); if(x) x.click(); return !!x; });
    chk('1. Sale como tarjeta en «Más» del modo fácil, y abre la práctica', tarjeta && await p.evaluate(() => document.getElementById('gzOv').classList.contains('show') && /practicar una venta/i.test(document.querySelector('#gzOv .gz-preg').textContent)));
    await p.evaluate(() => window.ventoGuia.cerrar());
    await p.waitForTimeout(300);
    // Al abrir, algunos módulos crean su configuración unos segundos después (pagos, WhatsApp…): se espera a que los
    // datos dejen de cambiar solos antes de tomar la foto de «antes» (en GitHub, más lento, caían en plena práctica).
    await p.evaluate(async () => { let ult = JSON.stringify(data), quieto = 0; for(let i = 0; i < 40 && quieto < 6; i++){ await new Promise(z => setTimeout(z, 500)); const a = JSON.stringify(data); if(a === ult) quieto++; else { quieto = 0; ult = a; } } });
    const antes = await p.evaluate(() => JSON.stringify(data));

    async function practica(azar, ronda){
      await p.evaluate(v => { window.__rnd = Math.random; Math.random = () => v; }, azar);
      await p.evaluate(() => window.ventoGuia.practicar());
      await p.evaluate(() => { Math.random = window.__rnd; });
      chk(ronda + ' Empieza diciendo que es un ensayo y no se guarda nada', /practicar una venta/i.test(await preg()) && await p.evaluate(() => /no se guarda nada/.test(document.querySelector('#gzOv .gz-ayuda').textContent)));
      await clic('[data-pr="ir"]');
      const mesa = +((await preg()).match(/(\d+)$/) || [])[1];
      await clic('[data-mesa="' + (mesa === 1 ? 2 : 1) + '"]');
      chk(ronda + ' Mesa equivocada: pista amable («Busque la que dice…»)', /Busque la que dice/.test(await toast()));
      await clic('[data-mesa="' + mesa + '"]');
      const pide = await preg();
      const nombres = await p.evaluate(() => data.products.map(x => x.name));
      chk(ronda + ' Dice qué le piden, con los productos del negocio', /^Le piden: \d+ \S/.test(pide) && nombres.some(n => pide.includes(n)), pide);
      await clic('[data-pr="listo"]');
      chk(ronda + ' «Ya está» sin tocar nada: dice qué falta', /le pidieron/.test(await toast()));
      const items = [...pide.replace(/^Le piden: /, '').split(' y ')].map(s => { const m = /^(\d+) (.+)$/.exec(s.trim()); return { n: +m[1], name: m[2] }; });
      for(const it of items) for(let k = 0; k < it.n; k++) await p.evaluate(nm => Array.from(document.querySelectorAll('#gzOv [data-pr-mas]')).find(x => x.querySelector('b').textContent === nm).click(), it.name);
      await clic('[data-pr="listo"]');
      const cuenta = await preg();
      const precios = await p.evaluate(() => Object.fromEntries(data.products.map(x => [x.name, Math.round(x.price)])));
      const total = items.reduce((s, it) => s + precios[it.name] * it.n, 0);
      chk(ronda + ' La cuenta da bien (' + total + ')', cuenta.replace(/\D/g, '') === String(total), cuenta);
      await clic('[data-pr="cobrar"]');
      const como = await preg();
      const efectivo = /efectivo/.test(como);
      await clic('[data-como="fiado"]');
      chk(ronda + ' Forma de pago equivocada: pista', /Efectivo|Nequi o QR/.test(await toast()));
      await clic('[data-como="' + (efectivo ? 'efectivo' : 'nequi') + '"]');
      if(efectivo){
        const bill = +(await preg()).replace(/\D/g, '');
        await clic('[data-bill="' + (bill === 10000 ? 20000 : 10000) + '"]');
        chk(ronda + ' Billete equivocado: pista', /Busque el de/.test(await toast()));
        await clic('[data-bill="' + bill + '"]');
        const cambio = bill - total;
        const otro = await p.evaluate(c => { const x = Array.from(document.querySelectorAll('#gzOv [data-cambio]')).find(b => +b.dataset.cambio !== c); return x ? +x.dataset.cambio : null; }, cambio);
        if(otro != null){ await clic('[data-cambio="' + otro + '"]'); chk(ronda + ' Cambio equivocado: le explica la cuenta', /menos/.test(await toast())); }
        await clic('[data-cambio="' + cambio + '"]');
      } else {
        await p.waitForSelector('#gzOv [data-pr="llego"]', { timeout: 6000 });
        chk(ronda + ' Nequi: muestra «Llegaron $… por Nequi» como el aviso de verdad', await p.evaluate(() => /Llegaron \$[\d.]+ por Nequi/.test(document.getElementById('prAviso').textContent)));
        await clic('[data-pr="llego"]');
      }
      const fin = await p.evaluate(() => ({ preg: document.querySelector('#gzOv .gz-preg').textContent, ay: document.querySelector('#gzOv .gz-ayuda').textContent }));
      chk(ronda + ' Termina: «Venta lista», cuánto vendió y cuántas veces ha practicado', /Venta lista|Excelente/.test(fin.preg) && /Vendió \$/.test(fin.ay) && /Ha practicado \d+ ve/.test(fin.ay), fin);
      return efectivo;
    }
    const e1 = await practica(0.1, '2.');
    chk('2. Primera práctica: en efectivo (billete y cambio)', e1 === true);
    await clic('[data-pr="otra"]');
    await p.evaluate(() => { document.querySelector('#gzOv').classList.remove('show'); window.ventoGuia.cerrar(); });
    const e2 = await practica(0.95, '3.');
    chk('3. Segunda práctica: por Nequi (el aviso de pago)', e2 === false);
    chk('4. Cuenta cuántas veces ha practicado (en este celular)', await p.evaluate(() => localStorage.getItem('vento-practicas') === '2'));
    await clic('[data-pr="fin"]');
    const despues = await p.evaluate(() => JSON.stringify(data));
    const dif = await p.evaluate(a => { const A = JSON.parse(a); return Object.keys(Object.assign({}, A, data)).filter(k => JSON.stringify(A[k]) !== JSON.stringify(data[k])); }, antes);
    chk('4. Los datos del negocio quedan EXACTAMENTE igual (sin ventas, mesas ni inventario)', antes === despues, dif);
    chk('4. La ventana de la guía se cierra', await p.evaluate(() => !document.getElementById('gzOv').classList.contains('show')));
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
