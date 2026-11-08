// 📱 ORDEVA 1.88.0 · Igual en todos los celulares (lib/vento-igual.js + la app de Android).
//  1. Dentro de la app de Android, con el «zoom de pantalla» del celular al 125 %, la página pide el ancho de siempre
//     (360 × 1,25 = 450) y se ve igual que con el tamaño normal.
//  2. Con el tamaño normal no cambia nada. En el navegador (sin la app) tampoco.
//  3. Todas las páginas tienen text-size-adjust: 100 % (la letra grande del celular no las agranda) y el ajuste del zoom.
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const abrir = async (escala, pagina) => {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(e => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(x){}
      if(e != null) window.VentoAndroid = { escalaPantalla: () => e, notificar(){}, erroresNativos: () => '[]' }; }, escala);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/' + (pagina || 'index.html')); await p.waitForTimeout(800);
    const v = await p.evaluate(() => ({ vp: document.querySelector('meta[name="viewport"]').getAttribute('content'), ancho: window.innerWidth, esc: document.documentElement.getAttribute('data-escala') }));
    await ctx.close(); return v;
  };
  try{
    let v = await abrir(1.25);
    // 🚑 1.95.3: ya no se cambia el ancho (en algunos celulares el menú de abajo quedaba por fuera de la pantalla).
    chk('1. App de Android con el zoom de pantalla al 125 %: ORDEVA ya NO cambia el ancho de la página (360, el menú cabe); solo anota la escala', /device-width/.test(v.vp) && v.ancho === 360 && v.esc === '1.25', v);
    v = await abrir(1.25, 'mesero.html');
    chk('1. … lo mismo en la app de meseros', /device-width/.test(v.vp) && v.ancho === 360, v);
    v = await abrir(1);
    chk('2. Con el tamaño normal no cambia nada (360 de ancho)', /device-width/.test(v.vp) && v.ancho === 360 && !v.esc, v);
    v = await abrir(null);
    chk('2. En el navegador (sin la app de Android) no cambia nada', /device-width/.test(v.vp) && v.ancho === 360, v);
    const raiz = path.join(__dirname, '..'), faltan = [];
    ['index.html', 'mesero.html', 'admin.html', 'lector.html', 'preparacion.html', 'pantalla.html', 'tv.html', 'agente.html', 'negocios.html', 'pedido.html'].forEach(f => {
      const s = fs.readFileSync(path.join(raiz, f), 'utf8');
      if(!/text-size-adjust:\s*100%/.test(s) || !/lib\/vento-igual\.js/.test(s)) faltan.push(f);
    });
    chk('3. Todas las páginas: la letra del celular no las agranda y tienen el ajuste del zoom', !faltan.length, faltan);
    const java = fs.readFileSync(path.join(raiz, 'android/app/src/main/java/co/vento/app/VentoApp.java'), 'utf8');
    chk('3. La app de Android no sigue el tamaño de letra del celular (setTextZoom(100)) y da la escala de la pantalla', /setTextZoom\(100\)/.test(java) && /public double escalaPantalla\(\)/.test(java), null);
    // ===== 4. 🎬 Modo demo =====
    { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(() => { try{ if(!localStorage.getItem('real-dato')) localStorage.setItem('real-dato', 'mi negocio de verdad'); }catch(x){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push('demo: ' + e.message));
      await p.goto(BASE + '/index.html?demo=restaurante');
      await p.waitForFunction(() => !!document.getElementById('demoBanda'), null, { timeout: 20000 }).catch(() => {});
      v = await p.evaluate(() => ({ banda: (document.getElementById('demoBanda') || {}).innerText || '', neg: ((typeof data !== 'undefined' && data) || {}).businessName, prods: (((typeof data !== 'undefined' && data) || {}).products || []).length,
        ventas: (((typeof data !== 'undefined' && data) || {}).history || []).length, mesa: ((((typeof data !== 'undefined' && data) || {}).tables || {})[1] || {}).items, real: localStorage.getItem('real-dato'), tipo: ((typeof data !== 'undefined' && data) || {}).businessType }));
      chk('4. Demo de restaurante: entra solo con «Restaurante La Sazón (demo)», 8 productos, las ventas de la semana y una mesa abierta', /Modo demo/.test(v.banda) || /Demo/.test(v.banda) && /demo/.test(v.neg || '') && v.prods === 8 && v.ventas >= 28 && v.mesa && v.mesa.length === 1 && v.tipo === 'restaurante', v);
      chk('4. … el demo no ve los datos guardados del equipo (vive en la memoria)', v.real === null, v.real);
      v = await p.evaluate(async () => { const e = window.qsRegistrarVenta([{ productId: 'dp5', name: 'Limonada', price: 6000, qty: 2 }], { method: 'efectivo' }); return { tot: e && e.total, n: data.history.length }; });
      chk('4. En el demo se puede vender (la venta queda en el demo)', v.tot === 12000 && v.n >= 29, v);
      await p.close();
      const p2 = await ctx.newPage(); await p2.goto(BASE + '/404.html');
      v = await p2.evaluate(() => ({ real: localStorage.getItem('real-dato'), usuarios: localStorage.getItem('cm-users'), claves: Object.keys(localStorage).filter(k => /demo|cm-users|vento_datos|data/i.test(k)) }));
      chk('4. Al cerrar el demo, el equipo sigue igual: sus datos están y el demo no dejó nada guardado', v.real === 'mi negocio de verdad' && v.usuarios === null && !v.claves.length, v);
      await ctx.close(); }
    { const s = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
      chk('4. ORDEVA Admin: «🎬 Links de demo» (copiar, WhatsApp, abrir) y «🎬 Dar prueba» en cada negocio', /id="demoLinks"/.test(s) && /index\.html\?demo=/.test(s) && (s.match(/data-sxa="prueba"/g) || []).length === 2, null); }
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
