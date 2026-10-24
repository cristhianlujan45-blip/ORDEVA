// 🧭 Vista sencilla (Ajustes → Apariencia, ORDEVA 1.63.0): opcional, el diseño de siempre sigue igual.
//  1. De fábrica está apagada: la barra de abajo y los menús quedan como siempre.
//  2. Se prende en Ajustes → Apariencia: abajo solo Cuentas · Productos · Caja · Más; «Más» por grupos con su nombre.
//  3. 💵 Caja: lo vendido desde el último cierre (efectivo, transferencias, fiado) y lo que falta en las cuentas abiertas,
//     con las mismas cifras del cierre de caja; «Cerrar caja del día» pregunta como siempre.
//  4. La cuenta: «⋯ Opciones» con cada acción con nombre (hace lo mismo que el icono de antes) y abajo «Falta por pagar»
//     con «Cobrar» (pone el total en el pago; no registra nada solo).
//  5. Un empleado no ve la Caja.  6. Se apaga y todo vuelve a como estaba. Celular y computador.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const FOTOS = process.env.VENTO_FOTOS || '';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 700) : '')); } };
  const foto = async (p, n) => { if(FOTOS) await p.screenshot({ path: FOTOS + '/vs-' + n + '.png' }); };
  try{
    for(const [ancho, alto, nom] of [[390, 844, 'celular'], [1280, 800, 'pc']]){
      const ctx = await b.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
      await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(nom + ': ' + e.message));
      await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
      await p.fill('#authBiz', 'Bar Sencillo'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
      await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
      await p.evaluate(() => {
        document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
        const hoy = Date.now();
        data.closures = [{ date: new Date(hoy - 5 * 3600e3).toISOString() }];
        data.history = [
          { date: new Date(hoy - 6 * 3600e3).toISOString(), total: 99000, payments: [{ method: 'efectivo', amount: 99000 }] },   // antes del cierre: no cuenta
          { date: new Date(hoy - 2 * 3600e3).toISOString(), total: 30000, payments: [{ method: 'efectivo', amount: 30000 }] },
          { date: new Date(hoy - 3600e3).toISOString(), total: 25000, payments: [{ method: 'transferencia', amount: 20000 }, { method: 'debe', amount: 5000 }] },
        ];
        data.tables[1] = { items: [{ productId: 'p1', name: 'Cerveza', price: 4000, qty: 3 }], payments: [{ method: 'efectivo', amount: 2000 }], people: [] };
        saveData(); renderMesas();
      });
      const visibles = () => p.evaluate(() => [...document.querySelectorAll('.tabbar nav > button, .nav-more')].filter(x => x.offsetParent !== null).map(x => (x.querySelector('.nav-lbl') || x).textContent.trim()));

      // 1. Apagada de fábrica
      let v = await p.evaluate(() => ({ on: window.ventoVistaSencilla.on(), clase: document.body.classList.contains('vs-on') }));
      chk(nom + ' · 1. De fábrica la vista sencilla está apagada', !v.on && !v.clase, v);
      const antes = await visibles();
      chk(nom + ' · 1. Apagada: la barra de siempre (sin «Caja»)', !antes.includes('Caja') && antes.length >= 3, antes);

      // 2. Se prende en Ajustes → Apariencia
      await p.evaluate(() => { const b = document.querySelector('nav button[data-view="ajustes"]'); b.click(); document.querySelector('.ajustes-cat[data-cat="apariencia"]').click(); });
      await p.waitForTimeout(300);
      v = await p.evaluate(() => { const g = document.getElementById('vsGrupo'); return { visible: !!g && !g.hidden && g.offsetParent !== null, primero: g && g === document.querySelector('#view-ajustes .settings-group[data-cat="apariencia"]') }; });
      chk(nom + ' · 2. Ajustes → Apariencia tiene «🧭 Vista sencilla», de primera', v.visible && v.primero, v);
      await p.click('#vsOn + .switch-slider').catch(async () => { await p.evaluate(() => { const c = document.getElementById('vsOn'); c.checked = true; c.dispatchEvent(new Event('change')); }); });
      await p.waitForTimeout(250);
      await p.evaluate(() => document.querySelector('nav button[data-view="mesas"]').click()); await p.waitForTimeout(300);
      const despues = await visibles();
      chk(nom + ' · 2. Prendida: abajo solo 4 (Mesas/Cuentas · Productos · Caja · Más)', despues.length === 4 && despues[1] === 'Productos' && despues[2] === 'Caja' && despues[3] === 'Más', despues);
      v = await p.evaluate(() => ({ guardada: localStorage.getItem('vento_vista_sencilla'), general: getComputedStyle(document.getElementById('generalBillBtn')).display, masop: !!document.getElementById('vsMasOp') && document.getElementById('vsMasOp').offsetParent !== null, cierre: getComputedStyle(document.getElementById('closeDayTop')).display }));
      chk(nom + ' · 2. Cuentas: «Cuenta general» y lo poco usado quedan en «⋯ Más opciones»; «Cerrar caja» pasa a la Caja', v.guardada === '1' && v.general === 'none' && v.masop && v.cierre === 'none', v);
      await p.click('#vsMasOp'); await p.waitForTimeout(150);
      v = await p.evaluate(() => getComputedStyle(document.getElementById('generalBillBtn')).display);
      chk(nom + ' · 2. «⋯ Más opciones» los muestra', v !== 'none', v);
      await p.click('#vsMasOp');
      await foto(p, nom + '-cuentas');
      await p.click('#navMoreBtn'); await p.waitForTimeout(300);
      v = await p.evaluate(() => {
        const g = [...document.querySelectorAll('#navMoreSheet .vs-grp')].filter(x => x.offsetParent !== null).map(x => x.textContent);
        const filas = [...document.querySelectorAll('#navMoreSheet .more-grid > *')].filter(x => x.offsetParent !== null).sort((a, b) => (+a.style.order || 0) - (+b.style.order || 0)).map(x => x.classList.contains('vs-grp') ? '#' + x.textContent : x.dataset.go);
        return { g, filas, lista: getComputedStyle(document.querySelector('#navMoreSheet .more-grid')).flexDirection };
      });
      chk(nom + ' · 2. «Más» en lista por grupos: Mi negocio · Ayudantes · Mi cuenta', v.g.join() === 'Mi negocio,Ayudantes,Mi cuenta' && v.lista === 'column' && v.filas.indexOf('#Mi cuenta') < v.filas.indexOf('ajustes') && v.filas.indexOf('#Ayudantes') < v.filas.indexOf('ia') && v.filas.indexOf('historial') < v.filas.indexOf('#Ayudantes'), v);
      await foto(p, nom + '-mas');
      await p.evaluate(() => document.querySelector('#navMoreSheet .more-tile[data-go="historial"]').click()); await p.waitForTimeout(300);
      v = await p.evaluate(() => ({ hist: document.getElementById('view-historial').classList.contains('active'), mas: document.getElementById('navMoreSheet').classList.contains('show') }));
      chk(nom + ' · 2. Desde «Más» se llega a Historial igual que antes', v.hist && !v.mas, v);
      await p.evaluate(() => document.querySelector('nav button[data-view="mesas"]').click());

      // 3. Caja
      await p.click('#vsCajaNav'); await p.waitForTimeout(250);
      v = await p.evaluate(() => { const t = document.getElementById('vsCajaOv').innerText.replace(/\s+/g, ' '); return t; });
      chk(nom + ' · 3. Caja: $55.000 vendidos desde el último cierre en 2 cuentas (no suma lo de antes del cierre)', /\$\s?55\.000/.test(v) && /2 cuentas cerradas/.test(v) && !/99\.000/.test(v), v);
      chk(nom + ' · 3. Caja: efectivo $30.000, transferencias $20.000, debiendo $5.000 y falta cobrar $10.000 en 1 cuenta abierta', /Efectivo \$\s?30\.000/.test(v) && /transferencias \$\s?20\.000/.test(v) && /debiendo \$\s?5\.000/.test(v) && /1 cuenta abierta \$\s?10\.000/.test(v), v);
      await foto(p, nom + '-caja');
      await p.evaluate(() => document.querySelector('#vsCajaOv [data-c="cerrar"]').click()); await p.waitForTimeout(400);
      v = await p.evaluate(() => ({ pregunta: !!document.querySelector('.overlay.show') && /cerrar la caja/i.test(document.querySelector('.overlay.show').innerText), cierres: data.closures.length }));
      chk(nom + ' · 3. «Cerrar caja del día» pregunta antes (no cierra solo)', v.pregunta && v.cierres === 1, v);
      await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => { const c = o.querySelector('#confirmCancel, .btn-close, [data-x]'); if(c) c.click(); o.classList.remove('show'); }));
      await p.waitForTimeout(200);
      chk(nom + ' · 3. Al decir que no, la caja sigue igual', await p.evaluate(() => data.closures.length === 1));

      // 4. La cuenta
      await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(900);
      v = await p.evaluate(() => ({ iconos: [...document.querySelectorAll('#overlay .mesa-acts > .mesa-ico')].filter(x => x.offsetParent !== null).map(x => x.id), falta: (document.getElementById('vsFalta') || {}).textContent, cobrar: !!document.getElementById('vsCobrarBtn') && document.getElementById('vsCobrarBtn').offsetParent !== null }));
      chk(nom + ' · 4. En la cuenta solo «⋯ Opciones» arriba (los iconos sin nombre quedan adentro)', v.iconos.join() === 'vsOpcBtn', v);
      chk(nom + ' · 4. Abajo «Falta por pagar $10.000» con «Cobrar»', /10\.000/.test(v.falta || '') && v.cobrar, v);
      await foto(p, nom + '-cuenta');
      await p.click('#vsOpcBtn'); await p.waitForTimeout(200);
      v = await p.evaluate(() => [...document.querySelectorAll('#vsOpcOv .vs-acc')].map(x => x.textContent.trim()));
      chk(nom + ' · 4. «Opciones» con nombre: cambiar el nombre, pasar a otra mesa, juntar… y «Vaciar la mesa» de último', v.some(t => /Cambiar el nombre/.test(t)) && v.some(t => /Pasar a otra mesa/.test(t)) && v.some(t => /Juntar con otra mesa/.test(t)) && /Vaciar la mesa/.test(v[v.length - 1]), v);
      await foto(p, nom + '-opciones');
      await p.evaluate(() => { window.__ren = 0; const b = document.getElementById('renameTableBtn'); b.addEventListener('click', () => { window.__ren++; }, { once: true }); });
      await p.evaluate(() => [...document.querySelectorAll('#vsOpcOv .vs-acc')].find(x => /Cambiar el nombre/.test(x.textContent)).click()); await p.waitForTimeout(250);
      chk(nom + ' · 4. «Cambiar el nombre» hace lo mismo que el icono de antes', await p.evaluate(() => window.__ren === 1));
      await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => { if(o.id !== 'overlay'){ const c = o.querySelector('#confirmCancel, .btn-close, .btn-ghost'); o.classList.remove('show'); } }));
      await p.click('#vsCobrarBtn'); await p.waitForTimeout(400);
      v = await p.evaluate(() => ({ monto: document.getElementById('paymentAmount').value, pagos: data.tables[1].payments.length }));
      chk(nom + ' · 4. «Cobrar» pone lo que falta ($10.000) en el pago, sin registrarlo solo', Number(v.monto) === 10000 && v.pagos === 1, v);
      await p.evaluate(() => { try{ closeModal(); }catch(e){} document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); });

      // 5. Un empleado no ve la Caja
      v = await p.evaluate(() => { const r = window.ventoRoles; const orig = r && r.esJefe; if(r) r.esJefe = () => false;
        document.querySelector('nav button[data-view="mesas"]').click();
        return new Promise(z => setTimeout(() => { const vis = document.getElementById('vsCajaNav').offsetParent !== null; if(r) r.esJefe = orig; document.querySelector('nav button[data-view="mesas"]').click(); z({ vis, hay: !!r }); }, 300)); });
      chk(nom + ' · 5. Un empleado (no dueño ni administrador) no ve la Caja', v.hay && !v.vis, v);

      // 6. Se apaga y vuelve todo
      await p.evaluate(() => window.ventoVistaSencilla.poner(false)); await p.waitForTimeout(250);
      const otraVez = await visibles();
      v = await p.evaluate(() => ({ clase: document.body.classList.contains('vs-on'), general: getComputedStyle(document.getElementById('generalBillBtn')).display, grupos: [...document.querySelectorAll('#navMoreSheet .vs-grp')].filter(x => getComputedStyle(x).display !== 'none').length }));
      chk(nom + ' · 6. Apagada otra vez: la barra, «Cuenta general» y «Más» como siempre', JSON.stringify(otraVez) === JSON.stringify(antes) && !v.clase && v.general !== 'none' && v.grupos === 0, { otraVez, antes, v });
      await ctx.close();
    }
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
