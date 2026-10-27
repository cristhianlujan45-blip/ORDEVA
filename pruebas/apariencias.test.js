// 🎨 Las apariencias (Ajustes → Apariencia, ORDEVA 1.65.6), revisadas como lo haría un diseñador:
//  1. En TODAS se lee bien (contraste WCAG): la letra sobre el fondo 7:1 o más, la letra suave sobre las tarjetas 4,5:1,
//     el texto de los botones sobre el acento 4,5:1 (blanco u oscuro, el que se lea mejor), rojo y verde 3:1.
//  2. Ninguna se parece a otra: fondo y acento distintos (distancia de color CIE Lab), y nombres sin repetir.
//  3. La galería sale por grupos (claras, oscuras, fechas especiales) con una vista previa de verdad de cada una.
//  4. Al elegir una, la app toma sus colores (también el del texto sobre el acento); la predeterminada es «🌙 Noche violeta».
//  5. La página de pedidos de los clientes (pedido.html) conoce todas las apariencias (con «Noche» y la personal usa su
//     diseño propio).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 900) : '')); } };
  // Colores: contraste WCAG y distancia CIE Lab (ΔE 1976).
  const hex = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) / 255);
  const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = h => { const [r, g, bb] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * bb; };
  const cr = (x, y) => { const a = lum(x), c = lum(y); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); };
  const lab = h => { const [r, g, bb] = hex(h).map(lin); const X = (r * 0.4124 + g * 0.3576 + bb * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + bb * 0.0722, Z = (r * 0.0193 + g * 0.1192 + bb * 0.9505) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
  const dE = (x, y) => { const a = lab(x), c = lab(y); return Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]); };
  try{
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    await p.fill('#authBiz', 'Bar Colores'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    const P = await p.evaluate(() => Object.fromEntries(Object.entries(PALETTES).map(([k, x]) => [k, { name: x.name, grupo: x.grupo, recommended: x.recommended, vars: x.vars }])));
    const negocio = Object.entries(P).filter(([k]) => k !== 'matrix');   // «Original (Matrix)» es la personal, aparte
    chk('Hay ' + negocio.length + ' apariencias para el negocio en 3 grupos', negocio.length >= 12 && ['claro', 'oscuro', 'fecha'].every(g => negocio.some(([, x]) => x.grupo === g)), negocio.map(([k, x]) => k + ':' + x.grupo));

    // ===== 1. Contraste =====
    const malas = [];
    for(const [k, x] of Object.entries(P)){
      const v = x.vars, c = { letra: cr(v['--ink'], v['--bg']), suave: cr(v['--ink-soft'], v['--surface']), boton: cr(v['--on-amber'] || '#ffffff', v['--amber']), rojo: cr(v['--brick'], v['--surface']), verde: cr(v['--paid'], v['--surface']) };
      const f = [c.letra < 7 && 'letra', c.suave < 4.5 && 'suave', c.boton < 4.5 && 'botón', c.rojo < 3 && 'rojo', c.verde < 3 && 'verde'].filter(Boolean);
      if(f.length) malas.push(k + ' (' + f.join(', ') + ') ' + JSON.stringify(Object.fromEntries(Object.entries(c).map(([n, y]) => [n, +y.toFixed(1)]))));
    }
    chk('1. En todas se lee bien: letra 7:1, letra suave 4,5:1, texto del botón sobre el acento 4,5:1, rojo y verde 3:1', !malas.length, malas);
    chk('1. El texto sobre el acento se elige solo: oscuro en los acentos claros (lima, ámbar, velitas), blanco en los oscuros', P.grafito.vars['--on-amber'] !== '#ffffff' && P.velitas.vars['--on-amber'] !== '#ffffff' && P.noche.vars['--on-amber'] === '#ffffff' && P.apple.vars['--on-amber'] === '#ffffff',
      ['grafito', 'velitas', 'noche', 'apple'].map(k => k + ':' + P[k].vars['--on-amber']));

    // ===== 2. Ninguna se parece a otra =====
    const parecidas = [];
    for(let i = 0; i < negocio.length; i++) for(let j = i + 1; j < negocio.length; j++){
      const [ka, a] = negocio[i], [kb, c] = negocio[j];
      const d = { fondo: dE(a.vars['--bg'], c.vars['--bg']), acento: dE(a.vars['--amber'], c.vars['--amber']) };
      if((d.fondo < 10 && d.acento < 35) || d.fondo + d.acento < 40) parecidas.push(ka + '/' + kb + ' ' + JSON.stringify(d));
    }
    chk('2. Ninguna se parece a otra (fondo y acento distintos)', !parecidas.length, parecidas);
    const nombres = negocio.map(([, x]) => x.name.replace(/^\S+\s/, '').toLowerCase());
    chk('2. Ningún nombre repetido', new Set(nombres).size === nombres.length, nombres);
    const acentos = negocio.map(([, x]) => x.vars['--amber'].toLowerCase());
    chk('2. Ningún color de acento repetido', new Set(acentos).size === acentos.length, acentos);

    // ===== 3. La galería =====
    await p.evaluate(() => { const b = document.querySelector('.more-tile[data-go="ajustes"]') || document.querySelector('[data-go="ajustes"]'); if(b) b.click(); renderPaletteOptions(); });
    const gal = await p.evaluate(() => ({ grupos: [...document.querySelectorAll('#paletteGrid .palette-grupo')].map(x => x.textContent), tarjetas: [...document.querySelectorAll('#paletteGrid .palette-card')].map(x => x.dataset.key), previas: document.querySelectorAll('#paletteGrid .palette-card .palette-prev .pp-btn').length, personal: [...document.querySelectorAll('#palettePersonalGrid .palette-card')].map(x => x.dataset.key) }));
    chk('3. La galería sale por grupos: claras, oscuras y fechas especiales', gal.grupos.length === 3 && /Claras/.test(gal.grupos[0]) && /Oscuras/.test(gal.grupos[1]) && /Fechas/.test(gal.grupos[2]), gal.grupos);
    chk('3. Cada apariencia una sola vez, con su vista previa (fondo, tarjeta y botón «Cobrar»)', gal.tarjetas.length === negocio.length && new Set(gal.tarjetas).size === gal.tarjetas.length && gal.previas === negocio.length, gal);
    chk('3. «Original (Matrix)» aparte, en la sección personal', gal.personal.length === 1 && gal.personal[0] === 'matrix' && !gal.tarjetas.includes('matrix'), gal.personal);

    // ===== 4. Elegir una =====
    const raiz = () => p.evaluate(() => { const s = getComputedStyle(document.documentElement); return { bg: s.getPropertyValue('--bg').trim(), amber: s.getPropertyValue('--amber').trim(), on: s.getPropertyValue('--on-amber').trim(), tema: data.theme }; });
    chk('4. La predeterminada es «🌙 Noche violeta» (marcada «Predeterminada»)', P.noche.recommended && Object.values(P).filter(x => x.recommended).length === 1 && await p.evaluate(() => !!document.querySelector('#paletteGrid .palette-card[data-key="noche"] .palette-badge')));
    for(const k of ['grafito', 'claro', 'velitas']){
      await p.evaluate(k => document.querySelector('#paletteGrid .palette-card[data-key="' + k + '"]').click(), k);
      await p.waitForTimeout(200);
      const r = await raiz();
      chk('4. Elegir «' + P[k].name + '»: la app toma su fondo, su acento y el color del texto sobre el acento', r.tema === k && r.bg === P[k].vars['--bg'] && r.amber === P[k].vars['--amber'] && r.on === P[k].vars['--on-amber'] &&
        await p.evaluate(k => document.querySelector('#paletteGrid .palette-card[data-key="' + k + '"]').classList.contains('selected'), k), r);
    }
    // El botón principal usa el color de texto del tema (no el blanco fijo de antes) en un acento claro.
    const btn = await p.evaluate(() => { const x = document.createElement('button'); x.className = 'btn-primary'; x.textContent = 'Cobrar'; document.body.appendChild(x); const s = getComputedStyle(x); const r = { bg: s.backgroundColor, color: s.color }; x.remove(); return r; });
    const rgb = s => '#' + (s.match(/\d+/g) || []).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
    chk('4. En «Día de las Velitas» (acento dorado claro) los botones se leen: letra oscura sobre el dorado', cr(rgb(btn.color), rgb(btn.bg)) >= 4.5, btn);

    // ===== 5. pedido.html =====
    const ped = fs.readFileSync(__dirname + '/../pedido.html', 'utf8');
    const i = ped.indexOf('const TH = {'), th = ped.slice(i, ped.indexOf('\n};', i));
    const faltan = Object.keys(P).filter(k => !['noche', 'matrix'].includes(k)).filter(k => !new RegExp('(^|[\\s{,])' + k + '\\s*:').test(th));
    chk('5. La página de pedidos conoce todas las apariencias (con el color del texto sobre el acento)', i > 0 && !faltan.length && /--on-gold/.test(th), faltan);
  } catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
