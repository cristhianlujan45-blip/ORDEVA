// Modo fácil para personas mayores: la guía de Vento (lib/vento-guia.js).
//  1. La primera vez: recorrido con señalador (mesas → Hoy → Más → Ayúdame) y voz; no vuelve a salir solo.
//  2. «🙋 Ayúdame» siempre arriba: se dice o escribe qué se necesita y abre la guía de esa tarea; la voz lo dice.
//  3. Agregar un producto paso a paso (nombre → precio → cuántas → foto → ✅), contestando también con la voz.
//  4. Si el producto ya existe: ofrece sumar las que llegaron o cambiar el precio (sin crear repetidos).
//  5. Llegó mercancía, cambiar un precio (también en la mesa abierta) y foto a un producto.
//  6. Escanear una factura (abre la cámara y acompaña la revisión) y Mis facturas (con pista y voz).
//  7. ¿Cuánto vendí hoy?, ¿Cómo vendo? (señala la mesa y sigue al tocarla), voz apagada, letra grande, botón Atrás del celular.
//  8. Todo con botones de 56 px o más y sin desbordar la pantalla del celular.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){}
      window.__dicho = [];
      // Micrófono simulado: lo que «dice» la persona sale de window.__voz
      window.__voz = [];
      window.SpeechRecognition = window.webkitSpeechRecognition = function(){ this.start = () => { const t = window.__voz.shift() || ''; setTimeout(() => { if(t && this.onresult) this.onresult({ results: [[{ transcript: t }]] }); this.onend && this.onend(); }, 60); }; this.abort = () => {}; this.stop = () => {}; };
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Tienda de Doña Rosa'); await p.fill('#authUser', 'rosa'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1200);
    await p.click('#onbSaltar').catch(() => {});
    await p.evaluate(() => {
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      window.ventoHablar = t => window.__dicho.push(String(t));
      data.products = [{ id: 'ag', name: 'Águila', price: 3300, stock: 10 }, { id: 'gs', name: 'Gaseosa Colombiana', price: 2500, stock: 5 }];
      for(let i = 1; i <= 4; i++) data.tables[i] = { items: [], people: [] };
      data.tables[2].items = [{ productId: 'gs', name: 'Gaseosa Colombiana', price: 2500, qty: 2 }];
      data.easyMode = true; saveData(); applyEasyMode();
    });
    const dijo = re => p.evaluate(s => window.__dicho.some(t => new RegExp(s, 'i').test(t)), re.source);
    const limpiarVoz = () => p.evaluate(() => { window.__dicho.length = 0; });

    // ===== 1. Recorrido de la primera vez =====
    await p.waitForSelector('#gzTour', { timeout: 5000 }).catch(() => {});
    chk('1. La primera vez sale el recorrido: «¡Hola! Soy Vento»', await p.isVisible('#gzTour') && /Hola! Soy Vento/.test(await p.textContent('#gzTour .gz-gt')));
    chk('1. … y lo dice en voz alta', await dijo(/Hola.*Soy Vento.*muy fácil/));
    await p.click('#gzTour .gz-gsig'); await p.waitForTimeout(450);
    let hueco = await p.evaluate(() => { const h = document.querySelector('#gzTour .gz-hueco').getBoundingClientRect(), m = document.querySelector('#facilApp .fz-mesa').getBoundingClientRect(); return { dx: Math.abs((h.left + 8) - m.left), dy: Math.abs((h.top + 8) - m.top), t: document.querySelector('#gzTour .gz-gt').textContent }; });
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/gz-tour.png' });
    chk('1. Señala una mesa: «Aquí vende»', hueco.t === 'Aquí vende' && hueco.dx < 3 && hueco.dy < 3, hueco);
    const vistos = [];
    for(let i = 0; i < 4; i++){ await p.click('#gzTour .gz-gsig'); await p.waitForTimeout(400); vistos.push(await p.evaluate(() => document.querySelector('#gzTour') && document.querySelector('#gzTour .gz-gt').textContent)); }
    chk('1. Sigue con Hoy → Más → Ayúdame → «¡Eso es todo!»', vistos.join('|') === 'Hoy|Más|Ayúdame|¡Eso es todo! 🎉', vistos);
    await p.click('#gzTour .gz-gsig'); await p.waitForTimeout(200);
    chk('1. «Entendido» cierra el recorrido', !(await p.$('#gzTour')));
    await p.evaluate(() => { window.ventoFacil.aplicar(); }); await p.waitForTimeout(1200);
    chk('1. No vuelve a salir solo', !(await p.$('#gzTour')));

    // ===== 2. Ayúdame =====
    const ay = await p.evaluate(() => { const b = document.querySelector('#facilApp .fz-ayuda'); const r = b.getBoundingClientRect(); return { t: b.textContent, h: r.height, vis: r.width > 0 }; });
    chk('2. «🙋 Ayúdame» siempre arriba, grande', ay.vis && /Ayúdame/.test(ay.t) && ay.h >= 56, ay);
    await limpiarVoz(); await p.click('#facilApp .fz-ayuda');
    chk('2. Abre «¿En qué le ayudo?» con micrófono grande y opciones', await p.isVisible('#gzOv.show .gz-mic-grande') && /En qué le ayudo/.test(await p.textContent('#gzOv .gz-preg')) && (await p.$$('#gzOv .gz-ops button')).length >= 8);
    chk('2. … y lo dice en voz alta', await dijo(/En qué le ayudo/));
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/gz-ayuda.png' });
    const rutas = await p.evaluate(() => ['¿dónde veo las facturas?', 'quiero tomarle foto a la factura', 'me llegaron 3 canastas de cerveza', '¿cuánto vendí hoy?', 'ponle foto a la gaseosa', 'cambiar el precio de la póker', 'cómo cobro una mesa', 'pon música', 'quiero agregar una cerveza nueva'].map(t => window.ventoGuia.ruta(t)));
    chk('2. Entiende lo que se le pide (9 formas de decirlo)', rutas.join(',') === 'facturas,factura,llego,cuanto,foto,precio,vender,musica,producto', rutas);
    await p.evaluate(() => { window.__voz.push('quiero agregar una cerveza'); });
    await p.click('#gzOv .gz-mic-grande'); await p.waitForTimeout(1200);
    chk('2. Dicho con la voz «quiero agregar una cerveza» → abre la guía «Agregar un producto»', /Cómo se llama el producto/.test(await p.textContent('#gzOv .gz-preg')), await p.textContent('#gzOv .gz-preg'));

    // ===== 3. Agregar un producto =====
    await p.evaluate(() => { window.__voz.push('cerveza club colombia'); });
    await p.click('#gzOv .gz-campo .gz-mic'); await p.waitForTimeout(300);
    chk('3. El nombre se puede decir con 🎤 (queda escrito)', (await p.inputValue('#gzOv .gz-in')) === 'Cerveza club colombia', await p.inputValue('#gzOv .gz-in'));
    await limpiarVoz(); await p.click('#gzOv .gz-sig'); await p.waitForTimeout(200);
    chk('3. Paso 2: «¿A cuánto vende Cerveza club colombia?» (y lo dice)', /A cuánto vende Cerveza club colombia/.test(await p.textContent('#gzOv .gz-preg')) && await dijo(/A cuánto vende/));
    await p.click('#gzOv .gz-sig'); await p.waitForTimeout(150);
    chk('3. Sin precio no deja seguir y explica por qué', /A cuánto vende/.test(await p.textContent('#gzOv .gz-preg')) && await dijo(/Escriba el precio/));
    await p.click('#gzOv .gz-chips [data-n="3500"]');
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/gz-precio.png' });
    chk('3. Toca el precio rápido $3.500 y se ve grande «$3.500»', (await p.textContent('#gzOv .gz-ver')) === '$3.500');
    await p.click('#gzOv .gz-sig'); await p.waitForTimeout(150);
    await p.evaluate(() => { window.__voz.push('veinticuatro'); }); await p.click('#gzOv .gz-mic-ancho'); await p.waitForTimeout(250);
    chk('3. «¿Cuántas tiene ahora?» se contesta diciendo «veinticuatro»', (await p.inputValue('#gzOv .gz-num')) === '24');
    await p.click('#gzOv .gz-sig'); await p.waitForTimeout(150);
    chk('3. Paso de la foto: «¿Le tomamos una foto?»', /Le tomamos una foto/.test(await p.textContent('#gzOv .gz-preg')));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGklEQVR4nGP4z8DwnwECGP7/BzMYGBj+MwAAqWQJ+SkZfzIAAAAASUVORK5CYII=', 'base64');
    await p.setInputFiles('#gzOv .gz-foto label:first-child input', { name: 'club.png', mimeType: 'image/png', buffer: png });
    await p.waitForSelector('#gzOv .gz-foto-ver img', { timeout: 5000 }).catch(() => {});
    chk('3. La foto se ve antes de guardar', await p.isVisible('#gzOv .gz-foto-ver img'));
    await limpiarVoz(); await p.click('#gzOv .gz-sig'); await p.waitForTimeout(300);
    const club = await p.evaluate(() => { const x = data.products.find(y => /club/i.test(y.name)); return x && { n: x.name, p: x.price, s: x.stock, f: !!x.foto && !!fotosCache[x.id] }; });
    chk('3. ✅ Guardado: Cerveza club colombia, $3.500, 24 unidades, con foto', club && club.p === 3500 && club.s === 24 && club.f, club);
    chk('3. Lo dice: «Guardé … Ya lo puede vender»', /Guardé Cerveza club colombia a \$3\.500, con 24 unidades, con su foto/.test(await p.textContent('#gzOv .gz-resumen')) && await dijo(/Guardé Cerveza club colombia a 3500 pesos/));
    await p.click('#gzOv [data-listo]');
    chk('3. «👍 Listo» cierra la guía', !(await p.isVisible('#gzOv.show')));

    // ===== 4. Producto que ya existe =====
    await p.evaluate(() => window.ventoGuia.iniciar('producto'));
    await p.fill('#gzOv .gz-in', 'aguila'); await p.click('#gzOv .gz-sig'); await p.waitForTimeout(200);
    chk('4. «aguila» ya existe: «Ya tiene «Águila» en sus productos»', /Ya tiene «Águila»/.test(await p.textContent('#gzOv .gz-preg')));
    await p.click('#gzOv .gz-campo [data-k="0"]'); await p.waitForTimeout(200);
    chk('4. «Sumar las que llegaron» → pregunta cuántas Águila llegaron (ahora tiene 10)', /Cuántas Águila llegaron/.test(await p.textContent('#gzOv .gz-preg')) && /Ahora tiene 10/.test(await p.textContent('#gzOv .gz-ayuda')));
    await p.click('#gzOv .gz-chips [data-n="12"]'); await p.click('#gzOv .gz-sig'); await p.waitForTimeout(250);
    const ag = await p.evaluate(() => ({ s: data.products.find(x => x.id === 'ag').stock, n: data.products.filter(x => /águila|aguila/i.test(x.name)).length, mov: (data.inventarioMov || []).filter(m => m.productId === 'ag').length }));
    chk('4. Águila quedó en 22, sin crear otra «aguila», y queda el movimiento de inventario', ag.s === 22 && ag.n === 1 && ag.mov === 1, ag);
    await p.click('#gzOv [data-listo]');

    // ===== 5. Llegó mercancía (desde la tarjeta de Más), precio y foto =====
    await p.click('#facilApp [data-fz="mas"]'); await p.waitForTimeout(200);
    const tarjetas = await p.evaluate(() => [...document.querySelectorAll('#facilApp .fz-tarea')].map(b => ({ t: b.textContent, h: b.getBoundingClientRect().height })));
    if(process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/gz-mas.png' });
    chk('5. «Más» con tarjetas grandes (≥ 140 px): agregar, llegó mercancía, foto, precio, factura, mis facturas…', tarjetas.length >= 8 && tarjetas.every(x => x.h >= 140) && /Llegó mercancía/.test(tarjetas.map(x => x.t).join('|')), tarjetas);
    await p.click('#facilApp [data-ir="g-llego"]'); await p.waitForTimeout(200);
    await p.fill('#gzOv .gz-in', 'gaseo');
    chk('5. Busca el producto escribiendo y lo muestra en tarjetas grandes', (await p.$$('#gzOv .gz-prod')).length === 1);
    await p.click('#gzOv .gz-prod'); await p.waitForTimeout(150);
    await p.fill('#gzOv .gz-num', '6'); await p.click('#gzOv .gz-sig'); await p.waitForTimeout(250);
    chk('5. Llegó mercancía: Gaseosa Colombiana 5 + 6 = 11', (await p.evaluate(() => data.products.find(x => x.id === 'gs').stock)) === 11 && /Ahora tiene 11/.test(await p.textContent('#gzOv .gz-resumen')));
    await p.click('#gzOv [data-listo]');
    await p.click('#facilApp [data-ir="g-precio"]'); await p.waitForTimeout(200);
    await p.click('#gzOv .gz-prod[data-id="gs"]'); await p.waitForTimeout(150);
    chk('5. Cambiar precio: muestra el precio de ahora ($2.500)', (await p.inputValue('#gzOv .gz-num')) === '2500' && /Ahora está a \$2\.500/.test(await p.textContent('#gzOv .gz-ayuda')));
    await p.fill('#gzOv .gz-num', '2800'); await p.click('#gzOv .gz-sig'); await p.waitForTimeout(250);
    const pr = await p.evaluate(() => ({ p: data.products.find(x => x.id === 'gs').price, mesa: data.tables[2].items[0].price }));
    chk('5. Precio nuevo $2.800 guardado (también en la mesa abierta)', pr.p === 2800 && pr.mesa === 2800, pr);
    await p.click('#gzOv [data-listo]');
    await p.click('#facilApp [data-ir="g-foto"]'); await p.waitForTimeout(200);
    await p.click('#gzOv .gz-prod[data-id="ag"]'); await p.waitForTimeout(150);
    await p.click('#gzOv .gz-sig'); await p.waitForTimeout(150);
    chk('5. Foto: sin tomarla no deja guardar', /Tómele la foto a Águila/.test(await p.textContent('#gzOv .gz-preg')));
    await p.setInputFiles('#gzOv .gz-foto label:nth-child(2) input', { name: 'ag.png', mimeType: 'image/png', buffer: png });
    await p.waitForSelector('#gzOv .gz-foto-ver img', { timeout: 5000 }).catch(() => {});
    await p.click('#gzOv .gz-sig'); await p.waitForTimeout(250);
    chk('5. Foto guardada en el producto', await p.evaluate(() => { const x = data.products.find(y => y.id === 'ag'); return !!x.foto && !!fotosCache.ag; }));
    await p.click('#gzOv [data-listo]');

    // ===== 6. Facturas =====
    await p.evaluate(() => { window.__camara = 0; document.getElementById('invoiceCamInput').click = () => { window.__camara++; }; });
    await limpiarVoz(); await p.click('#facilApp [data-ir="g-factura"]'); await p.waitForTimeout(200);
    chk('6. Escanear factura: explica (estirada sobre una mesa —el mueble, sin cambiarle la palabra—, buena luz) y lo dice', /estirada sobre una mesa/.test(await p.textContent('#gzOv .gz-campo')) && await dijo(/Ponga la factura sobre una mesa/));
    await p.click('#gzOv [data-fact="cam"]'); await p.waitForTimeout(200);
    chk('6. «📷 Tomar la foto» abre la cámara del lector de facturas', (await p.evaluate(() => window.__camara)) === 1 && !(await p.isVisible('#gzOv.show')));
    await limpiarVoz();
    await p.evaluate(() => invoiceOpen({ supplier: 'Distribuidora Rosa', items: [{ original: 'AGUILA LATA', name: 'Águila', qty: 24, unit_cost: 2500, line_total: 60000 }] }));
    await p.waitForTimeout(1300);
    chk('6. En la revisión de la factura sale la pista «Revise los productos… Aplicar al inventario» y la voz', await p.isVisible('#invoiceOverlay .gz-pista') && await dijo(/Ya leí la factura/));
    await p.evaluate(() => { window.showConfirm = async () => true; }); await limpiarVoz();
    await p.click('#invoiceApplyBtn'); await p.waitForTimeout(1800);
    chk('6. Al aplicar: «Listo. La factura quedó guardada…»', await dijo(/La factura quedó guardada/));
    await limpiarVoz(); await p.click('#facilApp [data-ir="g-facturas"]'); await p.waitForTimeout(300);
    chk('6. Mis facturas: se abren con la pista «Toque una factura…» y la voz', await p.isVisible('#fiHistOv.show') && /Toque una factura/.test(await p.textContent('#fiHistOv .gz-pista')) && await dijo(/Aquí están sus facturas/));
    await p.evaluate(() => document.getElementById('fiHistOv').classList.remove('show'));

    // ===== 7. Hoy, vender, voz, letra, botón Atrás =====
    await limpiarVoz(); await p.evaluate(() => window.ventoGuia.iniciar('cuanto')); await p.waitForTimeout(200);
    chk('7. «¿Cuánto vendí hoy?» → pestaña Hoy y lo dice', (await p.evaluate(() => window.ventoFacil.estado().tab)) === 'hoy' && await dijo(/Hoy ha vendido/));
    await p.evaluate(() => window.ventoGuia.iniciar('vender')); await p.waitForTimeout(700);
    chk('7. «¿Cómo vendo?» señala las mesas con el nombre del negocio («Toque la cuenta»)', await p.isVisible('#gzTour') && (await p.textContent('#gzTour .gz-gt')) === 'Toque la cuenta');
    await p.click('#facilApp .fz-mesa[data-mesa="1"]'); await p.waitForTimeout(900);
    chk('7. Al tocar la mesa sigue solo: «Toque los productos»', (await p.evaluate(() => document.querySelector('#gzTour .gz-gt') && document.querySelector('#gzTour .gz-gt').textContent)) === 'Toque los productos');
    await p.click('#gzTour .gz-gsaltar'); await p.waitForTimeout(150);
    await p.click('#facilApp .fz-ayuda'); await p.waitForTimeout(200);
    await p.click('#gzOv [data-a="voz"]'); await limpiarVoz();
    await p.evaluate(() => window.ventoGuia.iniciar('precio')); await p.waitForTimeout(200);
    chk('7. «Vento me habla: NO» → ya no habla', !(await dijo(/./)));
    await p.evaluate(() => { localStorage.setItem('vento-guia-voz', '1'); window.ventoGuia.ayudame(); });
    await p.click('#gzOv [data-a="grande"]');
    chk('7. «Letra más grande» agranda la pantalla', await p.evaluate(() => document.body.classList.contains('gz-grande')));
    await p.click('#gzOv [data-a="grande"]');
    await p.fill('#gzOv .gz-pregunta input', 'xqzw blup'); await p.click('#gzOv .gz-pregunta button'); await p.waitForTimeout(500);
    chk('7. Si no entiende, lo dice amable y ofrece las opciones o una persona', /No le entendí bien/.test(await p.textContent('#gzOv .gz-respuesta')));
    // Lo mismo que hace el botón Atrás de la app Android (window.ventoAtras): cierra la ventana de arriba con su «_fin».
    const atras = await p.evaluate(() => { const ab = [...document.querySelectorAll('.overlay.show')], a = ab[ab.length - 1]; if(!a) return false; if(typeof a._fin === 'function'){ a._fin(null); return a.id === 'gzOv'; } a.classList.remove('show'); return false; });
    chk('7. El botón Atrás del celular cierra la guía', atras === true && !(await p.isVisible('#gzOv.show')));

    // ===== 8. Tamaños =====
    await p.evaluate(() => window.ventoGuia.iniciar('producto'));
    const chicos = await p.evaluate(() => [...document.querySelectorAll('#gzOv button, #gzOv .gz-in')].filter(x => x.offsetParent).map(x => Math.round(x.getBoundingClientRect().height)).filter(h => h < 56));
    chk('8. Botones y campos de 56 px o más', !chicos.length, await p.evaluate(() => [...document.querySelectorAll('#gzOv button, #gzOv .gz-in')].filter(x => x.offsetParent && x.getBoundingClientRect().height < 56).map(x => x.className + ':' + x.textContent.slice(0, 20) + ':' + Math.round(x.getBoundingClientRect().height))));
    chk('8. Sin desbordar la pantalla del celular', await p.evaluate(() => document.documentElement.scrollWidth <= 392 && document.getElementById('gzOv').scrollWidth <= 392));
    const n = await p.evaluate(() => [window.ventoGuia.numeroDicho('dos mil quinientos'), window.ventoGuia.numeroDicho('tres mil'), window.ventoGuia.numeroDicho('24 unidades'), window.ventoGuia.numeroDicho('treinta y seis')]);
    chk('8. Entiende números dichos: dos mil quinientos, tres mil, 24, treinta y seis', n.join(',') === '2500,3000,24,36', n);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
