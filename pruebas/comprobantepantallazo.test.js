// Pantallazo del comprobante (📎 Comprobante en la cuenta y «🔎 Verificar un comprobante»), con capturas simuladas del
// tamaño de un celular (1080×2400) de Nequi (claro y oscuro), DaviPlata y Bancolombia:
//  1. El valor que sale es el de la imagen (DaviPlata: antes salía el SALDO «$ 1.250.300» en vez de «$ 65.000»).
//  2. La pantalla no se traba mientras lee (ninguna tarea larga de la página).
//  3. En la cuenta: el pantallazo queda adjunto, «Registrar» pone el valor de la imagen y el pago lleva el pantallazo.
//  4. Un comprobante repetido dice «NO LO ACEPTES», pero el pantallazo NO se quita solo: se quita con su botón.
//  5. Lectura del texto: lo de debajo de «Saldo» no es el valor, «S 65.000» es $ 65.000, hora corrida y un número mal
//     leído se revisan (no se acusan de falsos).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.VENTO_BASE || 'http://localhost:8765';
const RECIBOS = {
  nequiClaro: { monto: 71800, bg: '#ffffff', fg: '#200020', acc: '#da0081', lineas: [['Nequi', 60, 1], ['¡Listo! Envío exitoso', 62, 1], ['Para', 40], ['CRISTHIAN LUJAN', 48, 1], ['¿Cuánto?', 40], ['$ 71.800,00', 90, 1], ['Número Nequi', 40], ['300 123 4567', 48, 1], ['Fecha', 40], ['@FECHA', 42, 1], ['Referencia', 40], ['M17933329', 48, 1], ['¿De dónde salió la plata?', 40], ['Disponible', 48, 1]] },
  nequiOscuro: { monto: 25000, bg: '#1a0a24', fg: '#ffffff', acc: '#ff4fb0', lineas: [['Nequi', 60, 1], ['¡Listo! Envío exitoso', 62, 1], ['Para', 40], ['MARIA PEREZ', 48, 1], ['¿Cuánto?', 40], ['$ 25.000,00', 90, 1], ['Número Nequi', 40], ['300 123 4567', 48, 1], ['Fecha', 40], ['@FECHA', 42, 1], ['Referencia', 40], ['M88123456', 48, 1]] },
  davi: { monto: 65000, bg: '#f4f4f4', fg: '#222222', acc: '#e1251b', lineas: [['DaviPlata', 60, 1], ['Transacción exitosa', 56, 1], ['Valor', 40], ['$ 65.000', 84, 1], ['Saldo disponible', 40], ['$ 1.250.300', 48, 1], ['Costo de la transacción', 40], ['$ 0', 48], ['Número de aprobación', 40], ['482913', 48, 1], ['@FECHA', 42]] },
  bancol: { monto: 148500, bg: '#ffffff', fg: '#2c2a29', acc: '#fdda24', lineas: [['Bancolombia', 56, 1], ['¡Transferencia exitosa!', 58, 1], ['Comprobante No. 0012345678', 40], ['@FECHA', 40], ['Valor enviado', 40], ['$ 148.500,00', 84, 1], ['Costo de la transferencia', 40], ['$ 0,00', 44], ['Producto origen', 40], ['Ahorros *4321', 44]] },
};
(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 900) : '')); } };
  try{
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento_nube_cfg', JSON.stringify({ url: '', key: '' })); }catch(e){} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
    await p.fill('#authBiz', 'Bar Pantallazo'); await p.fill('#authUser', 'ana'); await p.fill('#authPass', 'clave123'); await p.click('#authBtn'); await p.waitForTimeout(1500);
    await p.click('#onbSaltar', { timeout: 3000 }).catch(() => {});
    await p.evaluate(R => {
      window.__R = R;
      window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] });
      // La fecha del comprobante es la de ahora (hace 2 minutos), como la escribe cada app.
      const f = new Date(Date.now() - 2 * 60e3), dd = String(f.getDate()), mm = String(f.getMonth() + 1).padStart(2, '0'), yy = f.getFullYear();
      let h = f.getHours(); const ap = h >= 12 ? 'p. m.' : 'a. m.'; h = h % 12 || 12; const hm = String(h).padStart(2, '0') + ':' + String(f.getMinutes()).padStart(2, '0');
      const mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][f.getMonth()];
      const FECHA = { nequiClaro: dd + ' de ' + mes + ' de ' + yy + ' a las ' + hm + ' ' + ap, davi: dd.padStart(2, '0') + '/' + mm + '/' + yy + ' ' + hm + ' ' + ap, bancol: dd + ' ' + mes.slice(0, 3)[0].toUpperCase() + mes.slice(1, 3) + ' ' + yy + ' - ' + hm + ' ' + ap };
      FECHA.nequiOscuro = FECHA.nequiClaro;
      window.__archivo = async n => {
        const r = R[n], W = 1080, H = 2400, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        x.fillStyle = r.bg; x.fillRect(0, 0, W, H); x.fillStyle = r.acc; x.fillRect(0, 0, W, 180);
        let y = 330; x.textAlign = 'center';
        for(const [t0, s, bold] of r.lineas){ const t = t0 === '@FECHA' ? FECHA[n] : t0; x.fillStyle = bold ? r.fg : (r.fg === '#ffffff' ? '#bbbbbb' : '#777777'); x.font = (bold ? 'bold ' : '') + s + 'px Arial'; x.fillText(t, W / 2, y); y += s * 1.9; }
        return new File([await new Promise(z => c.toBlob(z, 'image/png'))], 'Screenshot_' + n + '.png', { type: 'image/png' });
      };
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'));
      data.nequiNumber = '3001234567';
      data.pagos = data.pagos || {}; data.pagos.on = true; data.pagos.espera = {}; data.pagos.comprobantes = [];
      data.pagos.lista = [{ id: 'and-d1', app: 'DaviPlata', monto: 65000, t: Date.now() - 60e3, estado: 'ok' }];
      data.tables = data.tables || {}; data.tables[1] = { items: [{ productId: 'p1', name: 'Cerveza', price: 65000, qty: 1 }], payments: [], people: [] };
      saveData();
    }, RECIBOS);

    // ===== 0. Con la cuenta de una mesa abierta y la pantalla quieta, el lector queda cargado solo =====
    chk('0. Al abrir ORDEVA el lector de comprobantes (12 MB) todavía no se carga', await p.evaluate(() => !window.__VITO_OCR2__));
    await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(400);
    const pre = await p.waitForFunction(() => !!window.__VITO_OCR2__, null, { timeout: 15000 }).then(() => true, () => false);
    chk('0. Con la cuenta abierta y sin tocar la pantalla, se deja cargado (el primer pantallazo ya no espera)', pre);
    await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));

    // ===== 1 y 2. El valor de la imagen, sin trabar la pantalla =====
    await p.evaluate(() => window.comprobantePrecalentar()); await p.waitForTimeout(300);
    for(const n of Object.keys(RECIBOS)){
      const r = await p.evaluate(async n => {
        const f = await window.__archivo(n); window.__lt.length = 0; const t0 = performance.now();
        let res = null, err = null;
        try{ res = await window.comprobanteVerificar(f, null, { mostrar: false }); }catch(e){ err = e.message; }
        data.pagos.comprobantes = [];   // que no cuente como «ya usado» en lo que sigue
        return { ms: Math.round(performance.now() - t0), err, monto: res && res.info.monto, porEtiqueta: res && res.info.porEtiqueta, ref: res && res.info.ref, nivel: res && res.nivel, lt: Math.max(0, ...window.__lt) };
      }, n);
      chk('1. ' + n + ': el valor es el de la imagen (' + RECIBOS[n].monto + ')', r.monto === RECIBOS[n].monto && r.porEtiqueta, r);
      chk('2. ' + n + ': la pantalla no se traba al leer (tarea más larga ' + r.lt + ' ms) y tarda ' + r.ms + ' ms', r.lt < 200 && r.ms < 8000, r);
    }

    // ===== 3. En la cuenta: 📎 Comprobante → ✅ → Registrar =====
    await p.evaluate(() => openTableModal(1)); await p.waitForTimeout(400);
    const archivoEn = async (sel, n) => {
      const datos = await p.evaluate(async n => { const f = await window.__archivo(n); return Array.from(new Uint8Array(await f.arrayBuffer())); }, n);
      await p.setInputFiles(sel, { name: 'Screenshot_' + n + '.png', mimeType: 'image/png', buffer: Buffer.from(datos) });
    };
    await p.evaluate(() => { window.__lt.length = 0; window.__clic = true; });
    // El clic en 📎 abre el selector de archivos del sistema: aquí se toma el archivo directo.
    await p.evaluate(() => { const i = document.getElementById('rcptInput'); i.click = () => {}; });
    await p.click('#payRcptBtn');
    await archivoEn('#rcptInput', 'davi');
    await p.waitForFunction(() => { const o = document.getElementById('compOv'); return o && o.classList.contains('show'); }, null, { timeout: 30000 }).catch(() => {});
    let v = await p.evaluate(() => ({ ov: document.getElementById('compOv').innerText.replace(/\s+/g, ' '), adj: !!pendingReceipt.table, info: document.getElementById('payPickInfo').textContent, lt: Math.max(0, ...window.__lt) }));
    chk('3. ✅ Pago verificado por $65.000 (no el saldo $1.250.300)', /Pago verificado/.test(v.ov) && /\$65\.000/.test(v.ov) && !/1\.250\.300/.test(v.ov), v);
    chk('3. El pantallazo queda adjunto a la cuenta («📎 Comprobante adjunto»)', v.adj && /Comprobante adjunto/.test(v.info), v);
    chk('3. Sin trabar la cuenta mientras lee (tarea más larga ' + v.lt + ' ms)', v.lt < 200, v);
    await p.click('#compReg');
    await p.waitForTimeout(500);
    v = await p.evaluate(() => ({ pagos: (data.tables[1].payments || []).map(q => ({ amount: q.amount, rid: !!q.receiptId, note: q.note })) }));
    chk('3. «Registrar» anota $65.000 con el pantallazo adjunto', v.pagos.length === 1 && Number(v.pagos[0].amount) === 65000 && v.pagos[0].rid, v);

    // ===== 4. Comprobante repetido: «NO LO ACEPTES», el pantallazo sigue adjunto hasta que se quite =====
    await p.evaluate(() => { document.getElementById('compOv').classList.remove('show'); data.tables[1].items.push({ productId: 'p2', name: 'Picada', price: 30000, qty: 1 }); });
    await p.click('#payRcptBtn');
    await archivoEn('#rcptInput', 'davi');
    await p.waitForFunction(() => { const o = document.getElementById('compOv'); return o && o.classList.contains('show') && /NO LO ACEPTES/.test(o.innerText); }, null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(300);
    v = await p.evaluate(() => ({ ov: document.getElementById('compOv').innerText.replace(/\s+/g, ' '), adj: !!pendingReceipt.table, quitar: !!document.getElementById('compQuitar') }));
    chk('4. Repetido: «NO LO ACEPTES · YA SE USÓ»', /NO LO ACEPTES/.test(v.ov) && /YA SE US/.test(v.ov), v);
    chk('4. El pantallazo NO se quita solo (antes desaparecía)', v.adj, v);
    await p.click('#compQuitar').catch(() => {});
    await p.waitForTimeout(200);
    v = await p.evaluate(() => ({ adj: !!pendingReceipt.table, info: document.getElementById('payPickInfo').textContent }));
    chk('4. «🗑 Quitar el pantallazo» lo quita de la cuenta', !v.adj && !/Comprobante adjunto/.test(v.info), v);

    // ===== 5. Lectura del texto =====
    v = await p.evaluate(() => {
      const L = window.comprobanteLeer;
      const ahora = new Date(), en = min => { const f = new Date(ahora.getTime() + min * 60e3); return String(f.getDate()).padStart(2, '0') + '/' + String(f.getMonth() + 1).padStart(2, '0') + '/' + f.getFullYear() + ' ' + String(f.getHours()).padStart(2, '0') + ':' + String(f.getMinutes()).padStart(2, '0'); };
      data.pagos.comprobantes = [];
      const ver = t => window.comprobanteVerificar(t, null, { mostrar: false });
      return Promise.all([
        L('DaviPlata\nTransacción exitosa\nValor\nSaldo disponible\n$ 1.250.300\nCosto de la transacción\n$ 0').monto,
        L('Nequi\nEnvío exitoso\n¿Cuánto?\nS 65.000,00\nReferencia\nM12345678').monto,
        L('Nequi\n¡Listo! Envío exitoso\n¿Cuánto?\n$ 71.800,00\nSaldo disponible\n$ 2.400.000').monto,
        ver('DaviPlata\nTransacción exitosa\nValor $ 65.000\nNúmero de aprobación 777111\n' + en(120)).then(r => r.nivel),
        ver('DaviPlata\nTransacción exitosa\nValor $ 65.000\nNúmero de aprobación 777222\n' + en(60 * 24 * 3)).then(r => r.nivel),
        ver('Nequi\nEnvío exitoso\nPara\nNúmero Nequi 300 123 4587\n¿Cuánto?\n$ 9.000\nReferencia M55500011\n' + en(-1)).then(r => r.nivel),
        ver('Nequi\nEnvío exitoso\nPara\nNúmero Nequi 300 123 9999\n¿Cuánto?\n$ 9.000\nReferencia M55500022\n' + en(-1)).then(r => r.nivel),
      ]);
    });
    chk('5. Lo que va debajo de «Saldo disponible» no es el valor (no inventa: queda sin valor)', v[0] == null, v);
    chk('5. «S 65.000,00» (el $ mal leído) es $65.000', v[1] === 65000, v);
    chk('5. Con valor y saldo, el valor es el de «¿Cuánto?»', v[2] === 71800, v);
    chk('5. Hora 2 h adelantada (reloj del equipo corrido): se revisa, no es «falso»', v[3] === 'revisar', v);
    chk('5. Fecha 3 días en el futuro: «falso» (editado)', v[4] === 'falso', v);
    chk('5. Un número del destino mal leído (4587 vs 4567): se revisa, no es «falso»', v[5] === 'revisar', v);
    chk('5. Otro número de verdad (9999 vs 4567): «falso»', v[6] === 'falso', v);

    // ===== 6. Sin «¿Cuánto?» / «Valor» junto al valor: con internet también lo lee la IA (🤖), sin inventar =====
    const sinEtq = { monto: 65000, bg: '#ffffff', fg: '#222222', acc: '#e1251b', lineas: [['DaviPlata', 60, 1], ['Transacción exitosa', 56, 1], ['$ 65.000', 84, 1], ['Saldo disponible', 40], ['$ 1.250.300', 48, 1]] };
    v = await p.evaluate(async R => {
      window.__R.sinEtq = R; data.pagos.comprobantes = [];
      const hk = window.hasAIKey, at = window.aiText; let pedidos = 0;
      const prueba = async resp => { window.hasAIKey = () => true; window.aiText = async o => { pedidos++; window.__img = !!o.imageDataUrl; return JSON.stringify(resp); };
        const f = await window.__archivo('sinEtq'); const r = await window.comprobanteVerificar(f, 1, { mostrar: false }); data.pagos.comprobantes = []; return { monto: r.info.monto, porIA: !!r.info.porIA, visto: !!r.info.iaVisto, nivel: r.nivel, motivos: r.motivos.join(' | ') }; };
      const a = await prueba({ monto: 65000, referencia: null, fecha: null, app: 'DaviPlata', destino: null, exitoso: true });
      const b = await prueba({ monto: 70000, referencia: null, fecha: null, app: 'DaviPlata', destino: null, exitoso: true });
      window.hasAIKey = hk; window.aiText = at;
      return { a, b, pedidos, img: window.__img };
    }, sinEtq);
    chk('6. Sin la palabra «Valor», la IA lee el pantallazo (con la imagen) y da $65.000 marcado 🤖, que también está en el texto', v.pedidos === 2 && v.img && v.a.monto === 65000 && v.a.porIA && v.a.visto && /leyó la IA/.test(v.a.motivos), v);
    chk('6. Coincide con el pago que de verdad llegó → ✅ verificado', v.a.nivel === 'ok', v.a);
    chk('6. Si la IA da otro valor ($70.000) que no llegó: no se verifica ni se registra (no inventa un pago)', v.b.monto === 70000 && !v.b.visto && v.b.nivel !== 'ok', v.b);
    v = await p.evaluate(async () => { const hk = window.hasAIKey; let n = 0; window.hasAIKey = () => true; const at = window.aiText; window.aiText = async () => { n++; return '{}'; };
      const f = await window.__archivo('nequiClaro'); const r = await window.comprobanteVerificar(f, null, { mostrar: false }); data.pagos.comprobantes = []; window.hasAIKey = hk; window.aiText = at; return { n, monto: r.info.monto }; });
    chk('6. Con «¿Cuánto?» bien leído no se gasta la IA', v.n === 0 && v.monto === 71800, v);
    chk('Sin errores de página', !errs.length, errs);
  }catch(e){ mal++; console.log('❌ Error: ' + (e && e.stack || e)); }
  await b.close();
  console.log('RESULTADO ' + ok + ' bien ' + mal + ' mal');
  process.exit(mal ? 1 : 0);
})();
