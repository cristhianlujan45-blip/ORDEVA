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
    chk('1. App de Android con el zoom de pantalla al 125 %: la página se arma a 450 de ancho (como con el tamaño normal)', v.vp === 'width=450, viewport-fit=cover' && v.ancho === 450 && v.esc === '1.25', v);
    v = await abrir(1.25, 'mesero.html');
    chk('1. … lo mismo en la app de meseros', v.vp === 'width=450, viewport-fit=cover' && v.ancho === 450, v);
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
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
