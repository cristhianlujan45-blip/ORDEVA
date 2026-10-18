// 🔌 Balanza, impresora de facturas y cajón (lib/vento-equipos.js + lib/vento-pos.js), con los aparatos simulados:
//  1. Lo que mandan las balanzas: «0.750 kg», «ST,GS,+0001.250kg» (estable), «US…» (moviéndose), Toledo «STX 00750 ETX»
//     (gramos), «1.5 lb», «750 g».
//  2. La factura ESC/POS: empieza con ESC @, tildes y ñ en PC850, nunca más ancha que el papel (58 y 80 mm), «750 g x
//     $4.100/kg», TOTAL, corte, y el pulso del cajón cuando se pide.
//  3. Etiqueta de la balanza (EAN-13 que empieza por 2): PLU + gramos → el producto con su peso; dígito malo → nada.
//  4. Computador (Chrome): balanza por puerto COM (Web Serial) → al tocar el producto sale el peso solo y se agrega;
//     a mano (libras) y por plata ($2.000 de tomate); la etiqueta por el lector; cobrar en efectivo → la impresora USB
//     (WebUSB) saca la factura y abre el cajón en el mismo envío; «💵 Cajón» en la caja.
//  5. Ajustes → «🔌 Balanza, impresora y cajón» y «⚖️ Se vende por kilo» en el producto.
//  6. App Android: impresora Bluetooth (lista de emparejadas, prueba), balanza Bluetooth (peso que llega de Android).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = (process.env.VENTO_BASE || 'http://localhost:8765') + '/index.html';

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const errs = [];
  const chk = (n, c, x) => { if(c){ ok++; console.log('✅ ' + n); } else { mal++; console.log('❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
  const abrir = async (vp, init) => {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    await ctx.addInitScript(() => { try{ localStorage.setItem('vento-hola', '0'); localStorage.setItem('cm-tutorial-seen', '1'); localStorage.setItem('vento-pp-oculta', '1'); }catch(e){} });
    if(init) await ctx.addInitScript(init);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.evaluate(async () => {
      await enterApp('test', null);
      document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')); window.speakVoice = () => {};
      data.products = [
        { id: 'to', name: 'Tomate', price: 4100, porPeso: 'kg', codigo: '01234', stock: 50 },
        { id: 'pa', name: 'Papa', price: 1500, porPeso: 'lb' },
        { id: 'ag', name: 'Águila', price: 4000, barcodes: ['7702004003508'] }];
      data.tables = {}; for(let k = 1; k <= 2; k++) data.tables[k] = { items: [], people: [], payments: [] };
      data.tableCount = 2; data.tipsOn = false; data.loyaltyOn = false; data.history = []; delete data.modoOperacion; await saveData(); renderAll(); ventoPOS.vaciar();
    });
    await p.waitForFunction(() => window.ventoEquipos && window.ventoEscPos, null, { timeout: 10000 });
    return { ctx, p };
  };
  try{
    // ===== Computador con Chrome: balanza por COM y la impresora por USB =====
    const { ctx, p } = await abrir({ width: 1280, height: 800 }, () => {
      const W = window.__eq = { usb: [], com: [], fuera: [] };
      const lect = { q: [], esperando: null };
      W.pesa = t => { const u = new TextEncoder().encode(t); if(lect.esperando){ const f = lect.esperando; lect.esperando = null; f({ value: u, done: false }); } else lect.q.push(u); };
      const puerto = {
        readable: null, writable: null, getInfo: () => ({ usbVendorId: 0x1A86, usbProductId: 0x7523 }),
        async open(o){ W.baud = o.baudRate; this.readable = { getReader: () => ({ read: () => lect.q.length ? Promise.resolve({ value: lect.q.shift(), done: false }) : new Promise(r => { lect.esperando = r; }), releaseLock(){} }) };
          this.writable = { getWriter: () => ({ write: async v => { W.com.push(Array.from(v)); }, releaseLock(){} }) }; },
        async close(){ this.readable = null; this.writable = null; }
      };
      Object.defineProperty(navigator, 'serial', { value: { requestPort: async () => puerto, getPorts: async () => [puerto] } });
      const imp = { vendorId: 0x0416, productId: 0x5011, productName: 'POS-80', opened: false, configuration: null,
        async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = { interfaces: [{ interfaceNumber: 0, claimed: false, alternates: [{ endpoints: [{ direction: 'out', type: 'bulk', endpointNumber: 1 }] }] }] }; },
        async claimInterface(){ this.configuration.interfaces[0].claimed = true; }, async transferOut(ep, d){ W.usb.push(...Array.from(d)); return { status: 'ok' }; } };
      Object.defineProperty(navigator, 'usb', { value: { requestDevice: async () => imp, getDevices: async () => [imp] } });
    });
    const E = (f, a) => p.evaluate(f, a);

    // ---------- 1. Lo que mandan las balanzas ----------
    const tr = await E(() => ['  0.750 kg', 'ST,GS,+0001.250kg', 'US,GS,+0000.480kg', ' 00750', '1.5 lb', '750 g', 'basura'].map(t => window.ventoEquipos._trama(t)));
    chk('1. «0.750 kg» → 0,75 kg', tr[0] && tr[0].kg === 0.75, tr[0]);
    chk('1. «ST,GS,+0001.250kg» → 1,25 kg y estable', tr[1] && tr[1].kg === 1.25 && tr[1].quieto, tr[1]);
    chk('1. «US,GS,…» → moviéndose (no estable)', tr[2] && tr[2].mueve && tr[2].kg === 0.48, tr[2]);
    chk('1. Toledo «00750» (sin decimales = gramos) → 0,75 kg', tr[3] && tr[3].kg === 0.75, tr[3]);
    chk('1. «1.5 lb» → 0,680 kg; «750 g» → 0,75 kg; texto sin número → nada', tr[4].kg === 0.68 && tr[5].kg === 0.75 && tr[6] === null, [tr[4], tr[5], tr[6]]);
    const st = await E(() => { window.ventoEquipos._leer('\x02 00500\x03'); window.ventoEquipos._leer('\x02 00500\x03'); const b = window.ventoEquipos.balanza; return { kg: b.kg, est: b.estable }; });
    chk('1. El mismo peso dos veces seguidas → estable', st.kg === 0.5 && st.est, st);

    // ---------- 2. La factura ESC/POS ----------
    const fx = await E(() => {
      const rd = { businessName: 'Fruver Doña Ñata', nit: '900.123', tableLabel: 'Mostrador', dateStr: '18/10/2026 10:00', invoiceNo: 15,
        items: [{ name: 'Tomate chonto de primera calidad extra grande', qty: 0.75, price: 4100, unidad: 'kg' }, { name: 'Águila', qty: 2, price: 4000 }],
        payments: [{ note: 'Venta', amount: 11075, method: 'efectivo' }], total: 11075, debt: 0 };
      const dec = u8 => { const L = []; let l = []; for(let i = 0; i < u8.length; i++){ const c = u8[i];
          if(c === 0x1B || c === 0x1D){ const n = { 0x40: 1, 0x74: 2, 0x61: 2, 0x45: 2, 0x21: 2, 0x64: 2, 0x56: 3, 0x70: 4 }[u8[i + 1]] || 1; i += n; continue; }
          if(c === 10){ L.push(String.fromCharCode(...l)); l = []; } else l.push(c); } return L; };
      const r58 = window.ventoEscPos.recibo(rd, { ancho: 32 }), r80 = window.ventoEscPos.recibo(rd, { ancho: 48, cajon: true });
      const L58 = dec(r58), L80 = dec(r80), has = (u8, seq) => { for(let i = 0; i + seq.length <= u8.length; i++) if(seq.every((v, k) => u8[i + k] === v)) return true; return false; };
      return { ini: r58[0] === 0x1B && r58[1] === 0x40, ene: Array.from(r58).includes(0xA4), max58: Math.max(...L58.map(x => x.length)), max80: Math.max(...L80.map(x => x.length)),
        peso: L58.some(x => /750 g x \$ ?4\.100\/kg/.test(x)), total: L58.some(x => /^TOTAL\s+\$ ?11\.075$/.test(x)), corte: has(r58, [0x1D, 0x56, 0x42]),
        cajon58: has(r58, [0x1B, 0x70]), cajon80: has(r80, [0x1B, 0x70, 0x00, 0x19, 0xFA]), L58,
        sinT: Array.from(window.ventoEscPos.recibo(rd, { ancho: 32, tildes: false })).every(c => c < 0x80 || c === 0xFA) };
    });
    chk('2. Empieza con ESC @ y trae la ñ en PC850', fx.ini && fx.ene, fx);
    chk('2. Ninguna línea pasa del ancho del papel (32 en 58 mm, 48 en 80 mm)', fx.max58 <= 32 && fx.max80 <= 48, { m58: fx.max58, m80: fx.max80, L: fx.L58 });
    chk('2. El producto por peso: «750 g x $4.100/kg»; «TOTAL $11.075»; corta el papel', fx.peso && fx.total && fx.corte, fx.L58);
    chk('2. El pulso del cajón (ESC p) solo cuando se pide', !fx.cajon58 && fx.cajon80);
    chk('2. «Sin tildes» → solo letras sencillas (para impresoras que no tienen PC850)', fx.sinT);

    // ---------- 3. Etiqueta de la balanza ----------
    const ean = (base) => { let s = 0; for(let i = 0; i < 12; i++) s += Number(base[i]) * (i % 2 ? 3 : 1); return base + ((10 - s % 10) % 10); };
    const ET = ean('200123400750'), MAL = ET.slice(0, 12) + ((Number(ET[12]) + 1) % 10);
    const et = await E(([a, m]) => { const r = window.ventoEquipos.etiqueta(a); return { id: r && r.p.id, qty: r && r.qty, mal: window.ventoEquipos.etiqueta(m), otro: window.ventoEquipos.etiqueta('7702004003508') }; }, [ET, MAL]);
    chk('3. «' + ET + '» → Tomate (PLU 01234) con 750 g', et.id === 'to' && et.qty === 0.75, et);
    chk('3. Con el dígito de control malo, o un código normal → no es etiqueta', et.mal === null && et.otro === null, et);

    // ---------- 4. La caja con la balanza por COM y la impresora USB ----------
    await E(() => window.ventoEquipos.guardarCfg({ impresora: { via: 'webusb', vid: 0x0416, pid: 0x5011, ancho: 48, auto: true, tildes: true }, cajon: { via: 'impresora', alCobrar: true }, balanza: { via: 'serial', vid: 0x1A86, pid: 0x7523, baud: 9600, pedir: 'auto' }, etiquetas: { on: true, modo: 'peso', plu: 5 } }));
    await E(() => window.ventoEquipos.conectarBalanza(false));
    await E(() => { window.ventoEquipos.balanza.t = 0; window.ventoEquipos.balanza.kg = null; });
    await p.click('#posCajaBtn'); await p.waitForTimeout(400);
    await p.click('#pzCajaOv .pz-tile:has-text("Tomate")'); await p.waitForTimeout(300);
    chk('4. Tocar «Tomate» (por kilo) abre «⚖️ Tomate · $4.100 el kilo»', await E(() => { const v = document.getElementById('vqPesar'); return !!v && /Tomate/.test(v.innerText) && /4\.100 el kilo/.test(v.innerText); }));
    await E(() => { window.__eq.pesa('ST,GS,+0000.750kg\r\n'); });
    await p.waitForTimeout(300);
    const pe = await E(() => { const v = document.getElementById('vqPesar'); return v.innerText.replace(/\s+/g, ' '); });
    chk('4. El peso sale solo de la balanza: «750 g · ✅ Estable · $3.075»', /750 g/.test(pe) && /Estable/.test(pe) && /\$ ?3\.075/.test(pe), pe);
    chk('4. A la balanza se le pide el peso (ENQ, «P»…) mientras la ventana está abierta', await E(() => window.__eq.com.length > 0));
    await p.click('#vqPesar [data-q="ok"]'); await p.waitForTimeout(300);
    let car = await E(() => ventoPOS.carrito().map(x => x.id + ':' + x.qty));
    chk('4. Queda en la venta: Tomate 0,75 kg', car.join() === 'to:0.75', car);
    chk('4. En la caja se ve «750 g» y el total $3.075', await E(() => /750 g/.test(document.querySelector('#pzCajaOv .pz-lineas').innerText) && /3\.075/.test(document.querySelector('#pzCajaOv .pz-total').innerText)));
    // A mano, en libras
    await p.click('#pzCajaOv .pz-tile:has-text("Papa")'); await p.waitForTimeout(300);
    await p.fill('#vqPesar [data-q="peso"]', '2');
    chk('4. Papa (por libra): escribir «2» libras → $3.000', await E(() => document.querySelector('#vqPesar [data-q="u"]').value === 'lb' && /2 lb = \$ ?3\.000/.test(document.querySelector('#vqPesar [data-q="tot"]').innerText)), await E(() => document.querySelector('#vqPesar [data-q="tot"]').innerText));
    await p.click('#vqPesar [data-q="ok"]'); await p.waitForTimeout(300);
    // Por plata
    await p.click('#pzCajaOv .pz-tile:has-text("Tomate")'); await p.waitForTimeout(300);
    await p.fill('#vqPesar [data-q="plata"]', '2000'); await p.waitForTimeout(100);
    await p.click('#vqPesar [data-q="ok"]'); await p.waitForTimeout(300);
    const tot = await E(() => Math.round(ventoPOS.carrito().reduce((s, x) => s + x.price * x.qty, 0)));
    chk('4. «$2.000 de tomate» suma exactamente $2.000 (total $3.075 + $3.000 + $2.000 = $8.075)', tot === 8075, tot);
    // Etiqueta por el lector
    await E(() => { if(document.activeElement) document.activeElement.blur(); });
    await p.keyboard.type(ET, { delay: 8 }); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    car = await E(() => ventoPOS.carrito().map(x => x.id + ':' + Math.round(x.qty * 1000) / 1000));
    chk('4. El lector lee la etiqueta de la balanza → +750 g de Tomate', car.some(x => /^to:1\.98/.test(x) || /^to:1\.99/.test(x)), car);
    // Cobrar en efectivo: factura + cajón en un solo envío
    await E(() => { window.__eq.usb = []; });
    await p.click('#pzCajaOv .pz-cobrar'); await p.waitForTimeout(300);
    await p.click('.pz-pago button[data-m="efectivo"]'); await p.waitForTimeout(900);
    const usb = await E(() => { const u = window.__eq.usb, s = String.fromCharCode(...u); const has = seq => { for(let i = 0; i + seq.length <= u.length; i++) if(seq.every((v, k) => u[i + k] === v)) return true; return false; }; return { n: u.length, tomate: /Tomate/.test(s), papa: /Papa/.test(s), cajon: has([0x1B, 0x70]), corte: has([0x1D, 0x56, 0x42]) }; });
    chk('4. Cobrar en efectivo → la impresora USB saca la factura (Tomate, Papa) y la corta', usb.n > 100 && usb.tomate && usb.papa && usb.corte, usb);
    chk('4. … y abre el cajón en el mismo envío', usb.cajon, usb);
    const h = await E(() => { const x = data.history[0]; return { total: x.total, items: x.items.map(i => i.name + ':' + i.qty + ':' + (i.unidad || '')), pago: x.payments.map(q => q.amount) }; });
    chk('4. La venta queda sin centavos y con la unidad de cada producto por peso', Number.isInteger(h.total) && h.items.some(x => /^Tomate:.*:kg$/.test(x)) && h.items.some(x => /^Papa:2:lb$/.test(x)) && h.pago[0] === h.total, h);
    // Botón del cajón
    await E(() => { window.__eq.usb = []; });
    chk('4. En la caja sale «💵 Cajón»', await E(() => { const b = document.querySelector('#pzCajaOv .pz-cajon-btn'); return !!b && !b.hidden; }));
    await p.click('#pzCajaOv .pz-cajon-btn'); await p.waitForTimeout(400);
    chk('4. «💵 Cajón» manda a abrirlo (ESC p por la impresora)', await E(() => { const u = window.__eq.usb; return u.length === 5 && u[0] === 0x1B && u[1] === 0x70; }), await E(() => window.__eq.usb));
    await p.click('#pzCajaOv [data-pzx]').catch(() => {});

    // ---------- 5. Ajustes y el producto ----------
    await E(() => { try{ asisGoView('ajustes'); }catch(e){ document.querySelector('nav button[data-view="ajustes"]').click(); } });
    await p.waitForTimeout(400);
    chk('5. Ajustes: «🔌 Balanza, impresora y cajón»', await E(() => !!document.querySelector('#ajustesCats [data-cat="equipos"]')));
    await p.click('#ajustesCats [data-cat="equipos"]'); await p.waitForTimeout(300);
    const aj = await E(() => document.getElementById('vqGrupo').innerText.replace(/\s+/g, ' '));
    chk('5. Trae la impresora (USB, prueba), el cajón (por la impresora, al cobrar en efectivo) y la balanza (peso en vivo, etiquetas)', /Impresora de facturas/.test(aj) && /Imprimir prueba/.test(aj) && /Cajón de dinero/.test(aj) && /Abrirlo solo al cobrar en efectivo/.test(aj) && /Balanza/.test(aj) && /Leer las etiquetas/.test(aj), aj);
    await E(() => { window.__eq.usb = []; });
    await p.click('#vqGrupo [data-vq="probarimp"]'); await p.waitForTimeout(400);
    chk('5. «🧪 Imprimir prueba» llega a la impresora', await E(() => /Prueba de impresi/.test(String.fromCharCode(...window.__eq.usb))));
    await E(() => { const pr = data.products.find(x => x.id === 'ag'); openEditProductModal ? openEditProductModal(pr.id) : null; });
    await p.waitForTimeout(300);
    const tiene = await E(() => !!document.getElementById('vqPorPeso') && document.getElementById('editProductOverlay').classList.contains('show'));
    if(tiene){
      await p.selectOption('#vqPorPeso', 'kg'); await p.click('#editProdSaveBtn'); await p.waitForTimeout(300);
      chk('5. Producto: «⚖️ Se vende por kilo» queda guardado', await E(() => data.products.find(x => x.id === 'ag').porPeso === 'kg'));
    } else chk('5. Producto: «⚖️ Se vende» en la ventana de editar', false, 'no abrió');
    await ctx.close();

    // ===== App Android: impresora y balanza Bluetooth =====
    const A = await abrir({ width: 390, height: 844 }, () => {
      const W = window.__an = { imp: [], abre: [], env: [] };
      window.VentoAndroid = { pagosAvisos(){}, pagosAvisosEstado: () => '{}', pagosAvisosTomar: () => '[]', notificar: () => true, pagosNotif(){}, pagosVolumen(){} };
      window.VentoEquipos = {
        lista: () => JSON.stringify({ btPermiso: true, bt: true, btPrendido: true, emparejados: [{ nombre: 'PT-210', mac: '66:22:11:AA:BB:CC' }, { nombre: 'Balanza BT', mac: '00:11:22:33:44:55' }], usb: [] }),
        imprimir: (cfg, b64, cb) => { W.imp.push({ cfg: JSON.parse(cfg), n: atob(b64).length, txt: atob(b64) }); setTimeout(() => window.__ventoEquipos('impreso', { cb, ok: true }), 50); },
        balanzaAbrir: c => { W.abre.push(JSON.parse(c)); }, balanzaEnviar: x => { W.env.push(x); }, balanzaCerrar(){}, pedirBluetooth(){}, pedirUsb(){}
      };
    });
    const a = A.p, EA = (f, x) => a.evaluate(f, x);
    await EA(() => { try{ asisGoView('ajustes'); }catch(e){ document.querySelector('nav button[data-view="ajustes"]').click(); } });
    await a.waitForTimeout(300);
    await a.click('#ajustesCats [data-cat="equipos"]'); await a.waitForTimeout(300);
    await a.selectOption('#vqImpVia', 'bt'); await a.waitForTimeout(300);
    const op = await EA(() => [...document.querySelectorAll('#vqGrupo [data-vq-ap="impresora"] option')].map(o => o.textContent));
    chk('6. App: Bluetooth → la lista de impresoras emparejadas', op.includes('PT-210'), op);
    await a.selectOption('#vqGrupo [data-vq-ap="impresora"]', '66:22:11:AA:BB:CC'); await a.waitForTimeout(200);
    await a.click('#vqGrupo [data-vq="probarimp"]'); await a.waitForTimeout(400);
    const im = await EA(() => window.__an.imp[0]);
    chk('6. App: «Imprimir prueba» va por Bluetooth a la PT-210', im && im.cfg.via === 'bt' && im.cfg.mac === '66:22:11:AA:BB:CC' && /Prueba de impresi/.test(im.txt), im && im.cfg);
    await a.selectOption('#vqBalVia', 'bt'); await a.waitForTimeout(300);
    await a.selectOption('#vqGrupo [data-vq-ap="balanza"]', '00:11:22:33:44:55'); await a.waitForTimeout(200);
    await a.click('#vqGrupo [data-vq="conbal"]'); await a.waitForTimeout(300);
    chk('6. App: «Conectar» abre la balanza Bluetooth', await EA(() => { const c = window.__an.abre.slice(-1)[0]; return !!c && c.via === 'bt' && c.mac === '00:11:22:33:44:55'; }));
    await EA(() => { window.__ventoEquipos('balanza', { t: '  1.250 kg\r\n' }); window.__ventoEquipos('balanza', { t: '  1.250 kg\r\n' }); });
    await a.waitForTimeout(200);
    chk('6. App: el peso que manda Android se ve en Ajustes («1,250 kg ✅»)', await EA(() => /1,250 kg ✅/.test(document.getElementById('vqVivo').textContent)), await EA(() => document.getElementById('vqVivo').textContent));
    await A.ctx.close();
  }catch(e){ mal++; console.log('❌ La prueba se cayó: ' + (e && e.stack || e)); }
  chk('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log('RESULTADO', ok, 'bien', mal, 'mal'); process.exit(mal ? 1 : 0);
})();
