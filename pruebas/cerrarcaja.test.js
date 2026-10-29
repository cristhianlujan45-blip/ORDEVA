// 🔒 Cerrar caja (ORDEVA 1.55.0): el botón está a la vista y antes de cerrar pregunta, con el resumen.
//  1. «🔒 Cerrar caja del día» arriba en Mesas (la pantalla de todo el día), además del de Historial.
//  2. Sin nada que cerrar: avisa y no pregunta.
//  3. Pregunta «¿Cerrar la caja del día?» con las ventas desde el último cierre (cuántas, total, efectivo) y las mesas
//     abiertas (que se cierran y lo no pagado queda como «Debe»). «No, todavía no» no cierra nada.
//  4. «🔒 Sí, cerrar caja» cierra: guarda el resumen y muestra el cierre. El botón de Historial también pregunta.
//  5. El cierre automático programado no pregunta.
//  6. Quien no tiene permiso de ver el historial no ve el botón.
//  7. Modo fácil: «🔒 Cerrar caja del día» en «Hoy», con la misma pregunta.
//  8. 🔑 Clave para cerrar la caja (Ajustes → Negocio): una clave propia (solo se guarda su huella) o la contraseña de
//     quien usa ORDEVA. Se pide después de la pregunta; clave mala no cierra; «Cancelar» no cierra; el automático no la
//     pide; «Sin clave» la quita.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 500) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('vento-guia-tour', '1'); localStorage.setItem('vento_vista_sencilla', '0'); }catch(e){} });   // sin el recorrido automático; la vista completa (en la sencilla el cierre está en «💵 Caja»: vistasencilla.test.js)
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.evaluate(async () => { await enterApp('test', null); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1');
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.products = [{ id: 'ag', name: 'Águila', price: 4000, stock: 50 }, { id: 'em', name: 'Empanada', price: 2500, stock: 50 }];
      data.tables = {}; for(let k = 1; k <= 4; k++) data.tables[k] = { items: [], people: [], payments: [] };
      data.tableCount = 4; data.history = []; data.closures = []; data.turno = null; await saveData(); renderAll(); });
    await p.waitForTimeout(400);
    const D = (f, a) => p.evaluate(f, a);
    const toast = () => D(() => (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '');
    const sinContar = async () => { await p.waitForSelector('.vt-ov [data-sin]', { timeout: 4000 }); await p.click('.vt-ov [data-sin]'); await p.waitForTimeout(400); };   // el arqueo de siempre
    const pregunta = () => D(() => document.getElementById('confirmOverlay').classList.contains('show'));
    const venta = (total, metodo) => D(([t, m]) => { data.history.unshift({ id: 'v' + Math.random().toString(36).slice(2), date: new Date().toISOString(), total: t, table: null, items: [{ productId: 'ag', name: 'Águila', price: 4000, qty: t / 4000 }], payments: [{ amount: t, method: m }] }); saveData(); }, [total, metodo]);

    // ===== 1. A la vista en Mesas =====
    const pos = await D(() => { const x = document.getElementById('closeDayTopBtn'), r = x.getBoundingClientRect(); return { vis: !!x.offsetParent, top: r.top, txt: x.textContent, mesas: document.getElementById('view-mesas').classList.contains('active') }; });
    chk('1. En Mesas (la pantalla de todo el día) se ve «🔒 Cerrar caja del día» arriba, sin buscarlo', pos.mesas && pos.vis && pos.top < 400 && /Cerrar caja del día/.test(pos.txt), pos);

    // ===== 2. Nada que cerrar =====
    await p.click('#closeDayTopBtn'); await p.waitForTimeout(300);
    chk('2. Sin ventas ni mesas abiertas: avisa que la caja está al día y no pregunta', /ya está al día/.test(await toast()) && !(await pregunta()) && await D(() => data.closures.length === 0));

    // ===== 3. Pregunta con el resumen; «No, todavía no» no cierra =====
    await venta(8000, 'efectivo'); await venta(5000, 'transferencia');
    await D(() => { data.tables[2].items = [{ productId: 'ag', name: 'Águila', price: 4000, qty: 2, personId: null }]; saveData(); renderMesas(); });
    await p.click('#closeDayTopBtn'); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 });
    const q = await D(() => ({ t: document.getElementById('confirmTitle') ? document.getElementById('confirmTitle').textContent : document.querySelector('#confirmOverlay h2, #confirmOverlay h3').textContent, m: document.getElementById('confirmMessage').textContent, si: document.getElementById('confirmOkBtn').textContent, no: document.getElementById('confirmCancelBtn').textContent }));
    chk('3. Pregunta «¿Cerrar la caja del día?» con botones claros', /¿Cerrar la caja del día\?/.test(q.t) && /Sí, cerrar caja/.test(q.si) && /todavía no/.test(q.no), q);
    chk('3. Dice las ventas desde el comienzo: 2 cuentas por $13.000 (efectivo $8.000)', /2 cuentas por \$\s?13\.000/.test(q.m) && /efectivo \$\s?8\.000/.test(q.m), q.m);
    chk('3. Dice que después se cuenta el efectivo (el arqueo de siempre)', /cuenta el efectivo/.test(q.m), q.m);
    chk('3. Avisa de la mesa abierta (Mesa 2, $8.000): se cierra y lo no pagado queda como «Debe»', /1 mesa abierta \(Mesa 2\) por \$\s?8\.000/.test(q.m) && /Debe/.test(q.m), q.m);
    await p.click('#confirmCancelBtn'); await p.waitForTimeout(300);
    chk('3. «No, todavía no»: no cierra nada y la mesa sigue abierta', !(await pregunta()) && await D(() => data.closures.length === 0 && data.tables[2].items.length === 1));

    // ===== 4. Sí, cerrar =====
    await p.click('#closeDayTopBtn'); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 });
    await p.click('#confirmOkBtn'); await sinContar();
    const c1 = await D(() => ({ n: data.closures.length, c: data.closures[0] && { tickets: data.closures[0].ticketCount, total: data.closures[0].totalSold, debe: data.closures[0].totalDebe }, mesa: data.tables[2].items.length, rep: document.getElementById('closureOverlay').classList.contains('show') }));
    chk('4. «Sí, cerrar caja»: cierra las 3 cuentas (con la mesa, $21.000; $8.000 quedan como «Debe») y muestra el cierre', c1.n === 1 && c1.c.tickets === 3 && c1.c.total === 21000 && c1.c.debe === 8000 && c1.mesa === 0 && c1.rep, c1);
    await D(() => document.getElementById('closureOverlay').classList.remove('show'));
    await venta(2500, 'efectivo');
    await D(() => { const x = document.querySelector('nav button[data-view="historial"]'); x && x.click(); });
    await p.click('#closeDayBtn'); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 });
    const q2 = await D(() => document.getElementById('confirmMessage').textContent);
    chk('4. El de Historial también pregunta, con las ventas desde el último cierre (1 cuenta, $2.500)', /desde el último cierre/.test(q2) && /1 cuenta por \$\s?2\.500/.test(q2), q2);
    await p.click('#confirmOkBtn'); await sinContar();
    chk('4. …y cierra', await D(() => data.closures.length === 2));
    await D(() => { document.getElementById('closureOverlay').classList.remove('show'); const x = document.querySelector('nav button[data-view="mesas"]'); x && x.click(); });

    // ===== 5. Cierre automático: no pregunta =====
    await venta(4000, 'efectivo');
    await D(() => closeCashRegister({ auto: true })); await p.waitForTimeout(300);
    chk('5. El cierre automático programado cierra sin preguntar', !(await pregunta()) && await D(() => data.closures.length === 3));
    await D(() => document.getElementById('closureOverlay').classList.remove('show'));

    // ===== 6. Sin permiso de historial =====
    const sinPermiso = await D(() => { document.body.classList.add('hist-hoy'); const v = !!document.getElementById('closeDayTopBtn').offsetParent; document.body.classList.remove('hist-hoy'); return v; });
    chk('6. Quien no tiene permiso de ver el historial no ve el botón', sinPermiso === false);

    // ===== 7. Modo fácil =====
    await venta(5000, 'efectivo');
    await D(() => { data.easyMode = true; window.ventoFacil.aplicar(); window.ventoFacil.ir('hoy'); });
    await p.waitForTimeout(300);
    chk('7. Modo fácil: «🔒 Cerrar caja del día» en «Hoy»', await p.isVisible('#facilApp [data-fz-cerrar]'));
    await p.click('#facilApp [data-fz-cerrar]'); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 });
    const encima = await D(() => { const r = document.getElementById('confirmOkBtn').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(e && e.closest('#confirmOverlay')); });
    chk('7. La pregunta sale encima del modo fácil, con la venta de $5.000', encima && /1 cuenta por \$\s?5\.000/.test(await D(() => document.getElementById('confirmMessage').textContent)));
    await p.click('#confirmOkBtn'); await sinContar();
    chk('7. …y cierra la caja', await D(() => data.closures.length === 4 && data.closures[0].totalSold === 5000));

    // ===== 8. 🔑 Clave para cerrar la caja =====
    await D(() => { data.easyMode = false; window.ventoFacil.aplicar(); document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.ventoCierreClave.pintar(); const m = document.querySelector('nav button[data-view="mesas"]'); m && m.click(); });
    await p.waitForTimeout(300);
    chk('8. Ajustes → Negocio: «🔒 Clave para cerrar la caja» con 3 opciones (sin clave marcado)', await D(() => { const b = document.getElementById('cierreClaveBox'); return !!b && b.querySelectorAll('input[name="ccModo"]').length === 3 && b.querySelector('input[value="no"]').checked; }));
    await D(() => { document.querySelector('#cierreClaveBox input[value="propia"]').click(); document.getElementById('ccIn').value = '4321'; document.getElementById('ccGo').click(); });
    await p.waitForTimeout(800);
    const cc = await D(() => ({ c: window.ventoRoles.permisos().cierre, todo: JSON.stringify(data), modo: window.ventoCierreClave.modo() }));
    chk('8. Una clave solo para cerrar la caja: se guarda solo su huella (no «4321»)', cc.modo === 'propia' && cc.c.h && cc.c.h.length === 64 && !cc.todo.includes('4321'), cc.c);
    const cerrarCon = async (clave) => {
      await p.click('#closeDayTopBtn'); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 }); await p.click('#confirmOkBtn');
      await p.waitForSelector('#vfOv.show #ccClave', { timeout: 4000 });
      if(clave === null){ await p.click('#ccNo'); await p.waitForTimeout(300); return; }
      for(const k of [].concat(clave)){ await p.fill('#ccClave', k); await p.click('#ccSi'); await p.waitForTimeout(400); }
    };
    let n0 = await D(() => data.closures.length);
    await venta(4000, 'efectivo');
    await cerrarCon(null);
    chk('8. Después de la pregunta pide la clave; «Cancelar» no cierra', await D(() => data.closures.length) === n0);
    await cerrarCon('1111');
    chk('8. Clave equivocada: «Clave equivocada (4 intentos más)» y no cierra', /Clave equivocada \(4 intentos más\)/.test(await D(() => document.getElementById('ccErr').textContent)) && await D(() => data.closures.length) === n0);
    await p.fill('#ccClave', '4321'); await p.click('#ccSi'); await sinContar();
    chk('8. Con la clave correcta cierra la caja', await D(() => data.closures.length) === n0 + 1);
    await D(() => document.getElementById('closureOverlay').classList.remove('show'));
    await venta(4000, 'efectivo'); n0 = await D(() => data.closures.length);
    await D(() => closeCashRegister({ auto: true })); await p.waitForTimeout(300);
    chk('8. El cierre automático programado no pide la clave', await D(() => data.closures.length) === n0 + 1 && !(await D(() => (document.getElementById('vfOv') || { classList: { contains: () => false } }).classList.contains('show'))));
    await D(() => document.getElementById('closureOverlay').classList.remove('show'));
    // La contraseña de quien usa ORDEVA
    await D(async () => { await authAddUser('cajera1', 'secreta1', 'admin'); authUser = 'cajera1'; document.querySelector('#cierreClaveBox input[value="usuario"]').click(); });
    await p.waitForTimeout(300);
    chk('8. «La contraseña de quien está usando ORDEVA» queda activa', await D(() => window.ventoCierreClave.modo() === 'usuario'));
    await venta(4000, 'efectivo'); n0 = await D(() => data.closures.length);
    await cerrarCon('4321');
    chk('8. …la clave propia de antes ya no sirve', await D(() => data.closures.length) === n0 && /Clave equivocada/.test(await D(() => document.getElementById('ccErr').textContent)));
    await p.fill('#ccClave', 'secreta1'); await p.click('#ccSi'); await sinContar();
    chk('8. …y con la contraseña del usuario (la misma con la que entra) cierra', await D(() => data.closures.length) === n0 + 1);
    await D(() => { document.getElementById('closureOverlay').classList.remove('show'); document.querySelector('#cierreClaveBox input[value="no"]').click(); });
    await p.waitForTimeout(300);
    await venta(4000, 'efectivo'); n0 = await D(() => data.closures.length);
    await p.click('#closeDayTopBtn'); await p.waitForSelector('#confirmOverlay.show', { timeout: 4000 }); await p.click('#confirmOkBtn'); await sinContar();
    chk('8. «Sin clave»: vuelve a cerrar solo con la pregunta', await D(() => window.ventoCierreClave.modo() === 'no' && !window.ventoRoles.permisos().cierre) && await D(() => data.closures.length) === n0 + 1);
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
