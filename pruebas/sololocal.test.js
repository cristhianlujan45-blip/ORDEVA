// 📱 ORDEVA 1.99.14 · Aviso «este negocio está guardado solo en este equipo» (lib/vento-solo-local.js).
//  1. Con la nube configurada y el negocio SIN vincular a una cuenta, el dueño ve el aviso arriba de Inicio con cuántos
//     productos y ventas tiene, y «☁️ Guardarlo en mi cuenta» abre el panel de la cuenta.
//  2. Si la cuenta ya guarda OTRO negocio (otra sede de este equipo), lo dice con su nombre.
//  3. Si este ES el negocio que la cuenta guarda en la nube, no hay aviso.
//  4. Sin nube configurada, negocio vacío o un empleado: no hay aviso. «Hoy no» lo oculta por hoy.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  const pausa = ms => new Promise(r => setTimeout(r, ms));
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    // Nube «configurada» (una dirección que no responde): así se prueba el aviso sin un servidor.
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: 'https://nube-prueba.invalid', key: 'x'.repeat(40) })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await pausa(1000);
    await p.evaluate(() => { const s = document.getElementById('authType'); s.value = 'tienda'; s.dispatchEvent(new Event('change')); });
    await p.fill('#authBiz', 'Tienda Inventario'); await p.fill('#authUser', 'ana@tienda.co'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await pausa(2500);   // 1.99.15: con la nube disponible se pide correo (aquí la nube no responde: queda en el equipo)
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    const inicio = () => p.evaluate(() => { document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); const b2 = document.querySelector('nav button[data-view="inicio"]') || document.querySelector('.more-tile[data-go="inicio"]'); b2 && b2.click(); });
    const aviso = () => p.evaluate(() => { window.ventoSoloLocal.pintar(); const a = document.getElementById('soloLocalAviso'); return a && a.offsetParent ? a.innerText.replace(/\s+/g, ' ') : null; });

    await p.evaluate(async () => { data.products = []; data.history = []; await saveData(); });
    await inicio(); await pausa(400);
    chk('4. Negocio vacío: sin aviso (no hay nada que perder)', !(await aviso()));

    await p.evaluate(async () => { data.products = Array.from({ length: 120 }, (_, i) => ({ id: 'p' + i, name: 'Producto ' + i, price: 1000, stock: 5 })); data.history = [{ id: 'h1', date: new Date().toISOString(), total: 1000, items: [], payments: [{ method: 'efectivo', amount: 1000 }] }]; await saveData(); });
    let t = await aviso();
    chk('1. Sin vincular a una cuenta: «está guardado solo en este equipo», con 120 productos y 1 venta, y «Guardarlo en mi cuenta»', !!t && /solo en este equipo/.test(t) && /120 productos y 1 venta/.test(t) && /Guardarlo en mi cuenta/.test(t), t);
    let v = await p.evaluate(() => { let abrio = false; const o = window.ventoNube.abrir; window.ventoNube.abrir = () => { abrio = true; }; document.querySelector('#soloLocalAviso [data-sl="nube"]').click(); window.ventoNube.abrir = o; return abrio; });
    chk('1. «☁️ Guardarlo en mi cuenta» abre el panel de la cuenta (no sube nada solo)', v === true);

    // 2 · La cuenta guarda OTRO negocio (otra sede de este equipo)
    await p.evaluate(() => { window.__neg = window.ventoNube.negocio; window.__sede = window.ventoNube.sede; window.ventoNube.negocio = () => ({ id: 'n1', nombre: 'Mi Bar', rol: 'dueno' }); window.ventoNube.sede = () => 'sede-otra'; });
    t = await aviso();
    chk('2. La cuenta guarda otro negocio: lo dice con su nombre («Mi Bar») y que este sigue solo en el equipo', !!t && /Mi Bar/.test(t) && /solo en este equipo/.test(t) && /Ver mi cuenta/.test(t), t);
    // 3 · Este ES el negocio de la cuenta
    await p.evaluate(() => { window.ventoNube.sede = () => (localStorage.getItem('bar-current-sede') || 'default'); });
    chk('3. Este es el negocio que la cuenta guarda en la nube: sin aviso', !(await aviso()));
    await p.evaluate(() => { window.ventoNube.negocio = window.__neg; window.ventoNube.sede = window.__sede; });

    // 4 · Empleado y «Hoy no»
    await p.evaluate(() => { window.__esJefe = window.ventoRoles.esJefe; window.ventoRoles.esJefe = () => false; });
    chk('4. Un empleado no ve el aviso', !(await aviso()));
    await p.evaluate(() => { window.ventoRoles.esJefe = window.__esJefe; });
    await aviso();
    await p.click('#soloLocalAviso [data-sl="luego"]'); await pausa(200);
    chk('4. «Hoy no» lo oculta por hoy', !(await aviso()));
    v = await p.evaluate(() => [...document.querySelectorAll('#soloLocalAviso button')].length);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.message)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
