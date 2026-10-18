/* =====================================================================
   Vento · 🔌 Equipos del punto de venta: balanza, impresora de facturas y cajón de dinero

   ⚖️ Balanza
   • Productos «por kilo» o «por libra» (libra de 500 g, como en Colombia): al venderlos se pesan. Con la balanza conectada
     el peso sale solo («0,750 kg · estable»); sin balanza se escribe (gramos, kilos, libras) o se pide por plata
     («$2.000 de tomate»).
   • Etiquetas de las balanzas que imprimen código de barras (EAN-13 que empieza por 2): el lector las lee y mete el
     producto con su peso o su precio.
   • Conexión: computador (Chrome/Edge) por USB o puerto COM; app Android por USB o Bluetooth.
   🧾 Impresora de facturas (térmica 58 u 80 mm, ESC/POS): computador por USB o COM; app Android por Bluetooth, USB o
     red (wifi/cable, puerto 9100). Si no hay, la ventana de imprimir de siempre.
   💵 Cajón: conectado a la impresora (cable RJ11, lo abre la impresora) o aparte por USB (puerto serial). Se abre solo al
     cobrar en efectivo y con «💵 Abrir cajón» (queda en la actividad del equipo).
   Lo de cada aparato se guarda en ESTE equipo (cada caja tiene su impresora y su balanza).
   ===================================================================== */
(function(){
  'use strict';
  const K = 'vento_equipos';
  const D = () => (typeof data !== 'undefined' && data) ? data : null;
  const plata = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => { try{ showToast(t, ms || 5000); }catch(e){} };
  const AND = () => window.VentoEquipos || null;
  const DEF = { impresora: { via: 'navegador', ancho: 32, auto: false, tildes: true }, cajon: { via: 'no', alCobrar: true, pin: 0 }, balanza: { via: 'no', baud: 9600, pedir: 'auto' }, etiquetas: { on: true, modo: 'peso', plu: 5 } };
  function cfg(){
    let c = {}; try{ c = JSON.parse(localStorage.getItem(K) || '{}') || {}; }catch(e){}
    const r = {}; Object.keys(DEF).forEach(k => { r[k] = Object.assign({}, DEF[k], c[k] || {}); });
    return r;
  }
  function guardarCfg(c){ try{ localStorage.setItem(K, JSON.stringify(c)); }catch(e){} }

  // ---------------------------------------------------------------- Pesos
  // Unidad de venta de un producto: 'kg' (precio del kilo) o 'lb' (precio de la libra: 500 g). '' = por unidad.
  const unidadDe = p => p && (p.porPeso === 'kg' || p.porPeso === 'lb') ? p.porPeso : '';
  const KG_POR = { kg: 1, lb: 0.5 };
  const kgAUnidad = (kg, u) => Math.round(kg / (KG_POR[u] || 1) * 1000) / 1000;
  function pesoTxt(cant, u){
    const kg = cant * (KG_POR[u] || 1);
    if(u === 'lb') return (Math.round(cant * 100) / 100).toLocaleString('es-CO') + ' lb';
    return kg < 1 ? Math.round(kg * 1000) + ' g' : kg.toLocaleString('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
  }

  // ---------------------------------------------------------------- 🧾 ESC/POS
  // Página de códigos PC850 (ESC t 2): la que traen casi todas las térmicas para el español.
  const PC850 = { 'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3, 'ñ': 0xA4, 'Ñ': 0xA5, 'ü': 0x81, 'Ü': 0x9A, 'Á': 0xB5, 'É': 0x90, 'Í': 0xD6, 'Ó': 0xE0, 'Ú': 0xE9, '¿': 0xA8, '¡': 0xAD, '°': 0xF8, 'º': 0xA7, 'ª': 0xA6 };
  const sinTildes = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿¡]/g, '');
  function bytesDe(txt, tildes){
    const out = [];
    for(const ch of String(txt)){
      const c = ch.codePointAt(0);
      if(c === 10 || (c >= 32 && c < 127)) out.push(c);
      else if(tildes && PC850[ch]) out.push(PC850[ch]);
      else { const b = sinTildes(ch); if(b && b.charCodeAt(0) < 127 && b.charCodeAt(0) >= 32) out.push(b.charCodeAt(0)); else if(/\s/.test(ch)) out.push(32); }
    }
    return out;
  }
  const limpiar = s => String(s == null ? '' : s).replace(/[*_~]/g, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  function partir(t, ancho){
    const out = []; let l = '';
    String(t).split(' ').forEach(w => {
      while(w.length > ancho){ if(l){ out.push(l); l = ''; } out.push(w.slice(0, ancho)); w = w.slice(ancho); }
      if(!w) return;
      if((l ? l.length + 1 : 0) + w.length > ancho){ out.push(l); l = w; } else l = l ? l + ' ' + w : w;
    });
    if(l) out.push(l);
    return out.length ? out : [''];
  }
  const dos = (a, b, ancho) => { a = String(a); b = String(b); const esp = ancho - a.length - b.length; return esp >= 1 ? a + ' '.repeat(esp) + b : partir(a, ancho).join('\n') + '\n' + ' '.repeat(Math.max(0, ancho - b.length)) + b; };
  const ESC = 0x1B, GS = 0x1D;
  const CMD = {
    ini: [ESC, 0x40], pc850: [ESC, 0x74, 2], centro: [ESC, 0x61, 1], izq: [ESC, 0x61, 0],
    negrilla: [ESC, 0x45, 1], normal: [ESC, 0x45, 0], grande: [GS, 0x21, 0x11], chico: [GS, 0x21, 0x00],
    corte: [ESC, 0x64, 4, GS, 0x56, 0x42, 0x00]
  };
  const cajonBytes = pin => [ESC, 0x70, pin ? 1 : 0, 0x19, 0xFA];      // ESC p: pulso al pin 2 (o 5) del cajón
  /** Factura en ESC/POS. rd: lo mismo que la factura de siempre (histReceiptData / receiptData). */
  function recibo(rd, o){
    o = Object.assign({ ancho: 32, tildes: true, cajon: false, pin: 0 }, o || {});
    const W = o.ancho >= 48 ? 48 : 32, out = [], txt = t => out.push(...bytesDe(t, o.tildes)), c = a => out.push(...a), ln = t => { txt(t); out.push(10); };
    const raya = () => ln('-'.repeat(W));
    const f = n => { try{ return fmt(n); }catch(e){ return plata(n); } };
    c(CMD.ini); if(o.tildes) c(CMD.pc850);
    if(o.cajon) c(cajonBytes(o.pin));
    c(CMD.centro); c(CMD.negrilla); c(CMD.grande); partir(limpiar(rd.businessName || 'Vento'), W / 2).forEach(ln); c(CMD.chico); c(CMD.normal);
    if(rd.nit) ln('NIT/CC: ' + limpiar(rd.nit));
    if(rd.bizAddress) partir(limpiar(rd.bizAddress), W).forEach(ln);
    if(rd.invoiceNo) ln('Factura de venta N.º ' + rd.invoiceNo);
    if(rd.dianResolucionText) partir(limpiar(rd.dianResolucionText), W).forEach(ln);
    c(CMD.izq);
    if(rd.tableLabel) ln(limpiar(rd.tableLabel));
    if(rd.dateStr) ln(limpiar(rd.dateStr));
    raya();
    (rd.items || []).forEach(it => {
      const u = it.unidad || '', q = Number(it.qty) || 0;
      partir(limpiar(it.name + (it.size ? ' (' + it.size + ')' : '') + (it.person ? ' - ' + it.person : '')), W).forEach(ln);
      ln(dos('  ' + (u ? pesoTxt(q, u) + ' x ' + f(it.price) + '/' + u : q + ' x ' + f(it.price)), f((Number(it.price) || 0) * q), W));
    });
    raya();
    if(rd.ivaResponsable){ try{ const b = ivaBreakdown(rd.total, rd.ivaRate); ln(dos('Subtotal', f(b.base), W)); ln(dos('IVA (' + rd.ivaRate + '%)', f(b.iva), W)); }catch(e){} }
    c(CMD.negrilla); c([GS, 0x21, 0x01]); ln(dos('TOTAL', f(rd.total), W)); c(CMD.chico); c(CMD.normal);
    (rd.payments || []).forEach(p => { let m = ''; try{ m = methodLabelShort(p.method); }catch(e){ m = p.method || ''; } ln(dos(limpiar((p.note ? p.note + ' ' : '') + '(' + m + ')').slice(0, W - 12), f(p.amount), W)); });
    if(o.vueltas > 0) ln(dos('Vueltas', f(o.vueltas), W));
    if(rd.debt > 0){ c(CMD.negrilla); ln(dos('Queda debiendo', f(rd.debt), W)); c(CMD.normal); }
    if(!rd.ivaResponsable) ln('No responsable de IVA');
    out.push(10); c(CMD.centro); ln('¡Gracias por su compra!'); c(CMD.izq);
    c(CMD.corte);
    return new Uint8Array(out);
  }
  function prueba(o){
    o = Object.assign({ ancho: 32, tildes: true }, o || {});
    const W = o.ancho >= 48 ? 48 : 32, out = [...CMD.ini, ...(o.tildes ? CMD.pc850 : []), ...CMD.centro, ...CMD.negrilla];
    out.push(...bytesDe('Vento · Prueba de impresión\n', o.tildes), ...CMD.normal, ...CMD.izq);
    out.push(...bytesDe('-'.repeat(W) + '\nÁÉÍÓÚ ñÑ ¿? ¡! $12.500\n' + dos('Tomate 0,750 kg', '$3.000', W) + '\n' + '-'.repeat(W) + '\n', o.tildes));
    out.push(...bytesDe('Si ves bien las tildes y la ñ,\nla impresora quedó lista.\n', o.tildes), ...CMD.corte);
    return new Uint8Array(out);
  }

  // ---------------------------------------------------------------- Mandar bytes (Android, USB, COM)
  const b64 = u8 => { let s = ''; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const esperas = {};
  let nEspera = 0;
  window.__ventoEquipos = function(tipo, d){
    d = d || {};
    if(tipo === 'impreso' && esperas[d.cb]){ const f = esperas[d.cb]; delete esperas[d.cb]; f(d); return; }
    if(tipo === 'balanza') return lector.poner(d.t || '');
    if(tipo === 'balanzaEstado'){ bal.conectada = !!d.ok; bal.error = d.ok ? '' : (d.error || 'No conectó'); pintarEstado(); return; }
    if(tipo === 'usb' || tipo === 'bt'){ const f = esperas[tipo]; if(f){ delete esperas[tipo]; f(d); } return; }
  };
  const andEsperar = (clave, ms) => new Promise(res => { esperas[clave] = res; setTimeout(() => { if(esperas[clave]){ delete esperas[clave]; res({ ok: false, error: 'No respondió' }); } }, ms || 30000); });
  const filtroUsb = [{ classCode: 7 }, { vendorId: 0x04B8 }, { vendorId: 0x0416 }, { vendorId: 0x0483 }, { vendorId: 0x0FE6 }, { vendorId: 0x1FC9 }, { vendorId: 0x28E9 }, { vendorId: 0x6868 }, { vendorId: 0x154F }, { vendorId: 0x1504 }, { vendorId: 0x0519 }, { vendorId: 0x0DD4 }, { vendorId: 0x20D1 }, { vendorId: 0x1A86 }];
  async function webusbMandar(dev, bytes){
    if(!dev.opened) await dev.open();
    if(!dev.configuration) await dev.selectConfiguration(1);
    let itf = null, ep = null;
    for(const i of dev.configuration.interfaces){ for(const a of i.alternates){ const e = a.endpoints.find(x => x.direction === 'out' && x.type === 'bulk'); if(e){ itf = i; ep = e; break; } } if(ep) break; }
    if(!ep) throw new Error('La impresora USB no tiene salida de datos');
    if(!itf.claimed) await dev.claimInterface(itf.interfaceNumber);
    for(let i = 0; i < bytes.length; i += 4096) await dev.transferOut(ep.endpointNumber, bytes.subarray(i, i + 4096));
  }
  async function puertoSerial(info){
    if(!('serial' in navigator)) throw new Error('Este navegador no conecta aparatos por COM: usa Chrome o Edge en el computador');
    const ps = await navigator.serial.getPorts();
    return ps.find(p => { const i = p.getInfo ? p.getInfo() : {}; return info && i.usbVendorId === info.vid && i.usbProductId === info.pid; }) || (ps.length === 1 ? ps[0] : null);
  }
  async function serialMandar(info, bytes, baud){
    const p = await puertoSerial(info); if(!p) throw new Error('Vuelve a elegir el puerto en Ajustes → Balanza, impresora y cajón');
    const abierto = !!p.writable;
    if(!abierto) await p.open({ baudRate: baud || 9600 });
    const w = p.writable.getWriter();
    try{ await w.write(bytes); } finally { w.releaseLock(); if(!abierto) await p.close().catch(() => {}); }
  }
  /** Manda bytes por donde esté conectada la impresora (o el cajón aparte). */
  async function mandar(c, bytes){
    if(c.via === 'bt' || c.via === 'usb' || c.via === 'red'){
      const A = AND(); if(!A) throw new Error('Eso funciona con la app Vento para Android');
      const cb = 'i' + (++nEspera);
      const r = andEsperar(cb, 40000);
      A.imprimir(JSON.stringify(c), b64(bytes), cb);
      const d = await r; if(!d.ok) throw new Error(d.error || 'No imprimió');
      return;
    }
    if(c.via === 'webusb'){
      if(!navigator.usb) throw new Error('Este navegador no conecta impresoras USB: usa Chrome o Edge');
      const ds = await navigator.usb.getDevices();
      const dev = ds.find(x => x.vendorId === c.vid && x.productId === c.pid) || ds[0];
      if(!dev) throw new Error('Vuelve a elegir la impresora en Ajustes');
      return webusbMandar(dev, bytes);
    }
    if(c.via === 'serial') return serialMandar(c, bytes, c.baud || 9600);
    throw new Error('Sin impresora directa');
  }
  const directa = c => c && c.via && c.via !== 'navegador' && c.via !== 'no';
  async function imprimirRecibo(rd, extra){
    const c = cfg(), im = c.impresora;
    const conCajon = !!(extra && extra.cajon) && c.cajon.via === 'impresora';
    await mandar(im, recibo(rd, { ancho: im.ancho, tildes: im.tildes !== false, cajon: conCajon, pin: c.cajon.pin, vueltas: extra && extra.vueltas }));
    return conCajon;
  }

  // ---------------------------------------------------------------- 💵 Cajón
  async function abrirCajon(motivo){
    const c = cfg(), cj = c.cajon;
    if(cj.via === 'no') throw new Error('No hay cajón configurado');
    const bytes = new Uint8Array(cajonBytes(cj.pin));
    if(cj.via === 'impresora'){ if(!directa(c.impresora)) throw new Error('El cajón va por la impresora: primero conecta la impresora'); await mandar(c.impresora, bytes); }
    else await mandar(Object.assign({}, cj, { via: cj.conexion || 'serial', serial: true }), bytes);   // cajón aparte: puerto serial
    try{ window.ventoAuditar && window.ventoAuditar('cajón abierto', motivo || 'a mano'); }catch(e){}
    return true;
  }
  /** Después de cobrar: abre el cajón si fue en efectivo y saca la factura si está prendido «imprimir al cobrar». */
  async function alCobrar(entry, pago){
    const c = cfg(); if(!entry) return;
    const efectivo = !!pago && (pago.method === 'efectivo' || (pago.pagos || []).some(x => x.method === 'efectivo'));
    const quiereCajon = efectivo && c.cajon.via !== 'no' && c.cajon.alCobrar !== false;
    let cajonListo = false;
    if(c.impresora.auto && directa(c.impresora)){
      try{ const rd = typeof histReceiptData === 'function' ? histReceiptData(entry) : null; if(rd) cajonListo = await imprimirRecibo(rd, { cajon: quiereCajon, vueltas: pago && pago.vueltas }); }
      catch(e){ toast('🧾 No se imprimió: ' + (e.message || e), 7000); }
    }
    if(quiereCajon && !cajonListo){ try{ await abrirCajon('cobro en efectivo ' + plata(entry.total)); }catch(e){ toast('💵 No se abrió el cajón: ' + (e.message || e), 7000); } }
    else if(cajonListo){ try{ window.ventoAuditar && window.ventoAuditar('cajón abierto', 'cobro en efectivo ' + plata(entry.total)); }catch(e){} }
  }

  // ---------------------------------------------------------------- ⚖️ Lo que manda la balanza
  // Casi todas mandan el peso como texto: «  0.750 kg», «ST,GS,+0000.750kg», «\x02 00750\x03» (gramos, Toledo)…
  // Se toma el último número de cada línea; sin decimales y sin unidad son gramos. «US»/«?» = moviéndose.
  const bal = { kg: null, estable: false, t: 0, crudo: '', conectada: false, error: '', oyentes: [] };
  function leerTrama(f){
    const t = String(f).replace(/[\x00-\x09\x0B-\x1F]/g, ' ').trim(); if(!t) return null;
    const m = t.match(/([-+]?\s*\d+(?:[.,]\d+)?)\s*(kg|g|lb|oz)?\s*[A-Za-z?]*\s*$/i) || t.match(/([-+]?\s*\d+(?:[.,]\d+)?)\s*(kg|g|lb|oz)?/i);
    if(!m) return null;
    const crudo = m[1].replace(/\s+/g, ''), u = (m[2] || '').toLowerCase();
    let v = Number(crudo.replace(',', '.')); if(!isFinite(v)) return null;
    const conDecimal = /[.,]/.test(crudo);
    let kg = u === 'g' ? v / 1000 : u === 'lb' ? v * 0.45359237 : u === 'oz' ? v * 0.0283495 : u === 'kg' || conDecimal ? v : v / 1000;
    kg = Math.round(kg * 1000) / 1000;
    const mueve = /\bUS\b|\?|\bM\b|MOTION|INESTABLE/i.test(t), quieto = /\bST\b|STABLE|ESTABLE/i.test(t);
    return { kg, mueve, quieto };
  }
  const lector = {
    buf: '', ultimo: null, iguales: 0,
    poner(chunk){
      this.buf = (this.buf + chunk).slice(-400);
      const partes = this.buf.split(/[\r\n\x03\x02]+/);
      this.buf = partes.pop();
      // Sin separadores (algunas mandan el peso sin enter): se toma lo que ya parece completo.
      if(!partes.length && /\d[.,]?\d*\s*(kg|g|lb)\b/i.test(this.buf)){ partes.push(this.buf); this.buf = ''; }
      partes.forEach(f => {
        const r = leerTrama(f); if(!r) return;
        this.iguales = this.ultimo === r.kg ? this.iguales + 1 : 0; this.ultimo = r.kg;
        bal.kg = Math.max(0, r.kg); bal.t = Date.now(); bal.crudo = f.trim().slice(0, 40); bal.conectada = true; bal.error = '';
        bal.estable = !r.mueve && (r.quieto || this.iguales >= 1);
        bal.oyentes.forEach(fn => { try{ fn(bal); }catch(e){} });
      });
    }
  };
  // Algunas balanzas solo mandan el peso cuando se lo piden. «auto»: se prueban los pedidos de siempre hasta que conteste.
  const PEDIDOS = { enq: [0x05], p: [0x50], w: [0x57, 0x0D], si: [0x53, 0x49, 0x0D, 0x0A], dolar: [0x24] };
  let pidiendo = null, nPedido = 0;
  function pedirPeso(){
    const c = cfg().balanza;
    if(c.pedir === 'nada') return;
    let k = c.pedir;
    if(k === 'auto'){ if(bal.t && Date.now() - bal.t < 2500) return; const ks = Object.keys(PEDIDOS); k = ks[nPedido++ % ks.length]; }
    const bytes = new Uint8Array(PEDIDOS[k] || []); if(!bytes.length) return;
    if(AND() && (c.via === 'bt' || c.via === 'usb')) try{ AND().balanzaEnviar(b64(bytes)); }catch(e){}
    else if(serial.puerto && serial.puerto.writable){ const w = serial.puerto.writable.getWriter(); w.write(bytes).catch(() => {}).finally(() => w.releaseLock()); }
  }
  const serial = { puerto: null, leyendo: false };
  async function conectarBalanza(elegir){
    const c = cfg(), b = c.balanza;
    desconectarBalanza();
    if(b.via === 'no') return false;
    if(b.via === 'bt' || b.via === 'usb'){
      const A = AND(); if(!A) throw new Error('Eso funciona con la app Vento para Android');
      A.balanzaAbrir(JSON.stringify(Object.assign({ serial: true }, b)));
      return true;
    }
    if(b.via === 'serial'){
      if(!('serial' in navigator)) throw new Error('Este navegador no conecta la balanza: usa Chrome o Edge en el computador');
      let p = elegir ? await navigator.serial.requestPort() : await puertoSerial(b);
      if(!p) return false;
      if(elegir){ const i = p.getInfo ? p.getInfo() : {}; b.vid = i.usbVendorId; b.pid = i.usbProductId; guardarCfg(c); }
      await p.open({ baudRate: Number(b.baud) || 9600 });
      serial.puerto = p; serial.leyendo = true; bal.conectada = true; bal.error = ''; pintarEstado();
      (async () => {
        const dec = new TextDecoder('latin1');
        while(serial.leyendo && p.readable){
          const r = p.readable.getReader();
          try{ for(;;){ const { value, done } = await r.read(); if(done) break; if(value) lector.poner(dec.decode(value)); } }
          catch(e){ bal.error = 'Se desconectó la balanza'; }
          finally{ r.releaseLock(); }
          if(!serial.leyendo) break;
        }
        bal.conectada = false; pintarEstado();
      })();
      return true;
    }
    return false;
  }
  function desconectarBalanza(){
    try{ AND() && AND().balanzaCerrar(); }catch(e){}
    serial.leyendo = false;
    if(serial.puerto){ const p = serial.puerto; serial.puerto = null; p.close().catch(() => {}); }
    bal.conectada = false;
  }

  // ---------------------------------------------------------------- 🏷️ Etiquetas de la balanza (EAN-13 que empieza por 2)
  // 2 · d · PLU (5) · valor (5) · dígito de control. Valor = peso en gramos (o precio en pesos, según la balanza).
  function controlEan(d){ let s = 0; for(let i = 0; i < 12; i++) s += Number(d[i]) * (i % 2 ? 3 : 1); return (10 - s % 10) % 10; }
  function etiqueta(codigo){
    const c = cfg().etiquetas; if(c.on === false) return null;
    const d = String(codigo || '').trim();
    if(!/^2\d{12}$/.test(d) || controlEan(d) !== Number(d[12])) return null;
    const n = Number(c.plu) === 4 ? 4 : Number(c.plu) === 6 ? 6 : 5;
    const plu = Number(d.slice(2, 2 + n)), valor = Number(d.slice(2 + n, 12));
    const prods = ((D() || {}).products || []);
    const p = prods.find(x => x && ((x.plu != null && x.plu !== '' && Number(x.plu) === plu) || (x.codigo && /^\d+$/.test(String(x.codigo)) && Number(x.codigo) === plu)));
    if(!p || !(valor > 0)) return null;
    const u = unidadDe(p) || 'kg';
    if(c.modo === 'precio'){ const precio = Number(p.price) || 0; if(!precio) return null; return { p, qty: Math.round(valor / precio * 1000) / 1000, precio: valor }; }
    return { p, qty: kgAUnidad(valor / 1000, u), kg: valor / 1000 };
  }

  // ---------------------------------------------------------------- ⚖️ Pesar (ventana)
  function estilos(){
    if(document.getElementById('vqEstilos')) return;
    const st = document.createElement('style'); st.id = 'vqEstilos';
    st.textContent =
      '#vqPesar{z-index:9600}#vqPesar .modal{max-width:440px;width:100%}#vqPesar .vq-peso{font:800 44px/1.1 var(--font-main,system-ui);text-align:center;margin:10px 0 2px;letter-spacing:-.02em}' +
      '#vqPesar .vq-est{text-align:center;font-size:14px;min-height:18px;opacity:.85}#vqPesar .vq-tot{text-align:center;font:800 24px var(--font-main,system-ui);margin:8px 0}' +
      '#vqPesar .vq-fila{display:flex;gap:8px;align-items:center;margin-top:8px}#vqPesar .vq-fila input{flex:1;min-width:0;font-size:22px;min-height:52px;text-align:center}' +
      '#vqPesar .vq-fila select{min-height:52px;font-size:16px}#vqPesar .vq-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#vqPesar .vq-chips button{flex:1 1 auto;min-height:44px;border-radius:12px}' +
      '#vqPesar .vq-bts{display:grid;gap:8px;margin-top:12px}#vqPesar .vq-bts button{min-height:54px;font-size:17px;border-radius:14px}' +
      '.vq-sec{border:1px solid var(--line,rgba(127,127,127,.3));border-radius:14px;padding:12px;margin:10px 0}.vq-sec h3{margin:0 0 6px;font-size:16px}' +
      '.vq-sec label{display:block;font-size:13px;opacity:.8;margin:8px 0 3px}.vq-sec select,.vq-sec input[type=text],.vq-sec input[type=number]{width:100%;box-sizing:border-box;min-height:44px}' +
      '.vq-sec .vq-ck{display:flex;gap:8px;align-items:center;margin:8px 0;font-size:14px;opacity:1}.vq-sec .vq-ck input{width:auto}' +
      '.vq-sec .vq-bt{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.vq-sec .vq-bt button{min-height:44px}.vq-sec small{display:block;opacity:.75;margin-top:6px;line-height:1.4}' +
      '.vq-vivo{font:800 30px var(--font-main,system-ui);text-align:center;margin:8px 0}.pz-cajon-btn[hidden]{display:none!important}';
    document.head.appendChild(st);
  }
  /** Pide el peso de un producto «por kilo / por libra». Devuelve la cantidad en su unidad (0 = cancelado). */
  function pesar(p){
    return new Promise(res => {
      estilos();
      const u = unidadDe(p) || 'kg', precio = Number(p.price) || 0, c = cfg();
      const conBalanza = c.balanza.via !== 'no';
      const ov = document.createElement('div'); ov.id = 'vqPesar'; ov.className = 'overlay show'; ov.setAttribute('data-novocab', '');
      ov.innerHTML = '<div class="modal" role="dialog" aria-label="Pesar"><h2>⚖️ ' + esc(p.name) + '</h2><div class="modal-sub">' + plata(precio) + (u === 'lb' ? ' la libra (500 g)' : ' el kilo') + '</div>' +
        (conBalanza ? '<div class="vq-peso" data-q="vivo">— kg</div><div class="vq-est" data-q="est">' + (bal.conectada ? 'Pon el producto en la balanza' : 'Conectando la balanza…') + '</div>' : '') +
        '<div class="vq-fila"><input type="number" inputmode="decimal" min="0" step="any" data-q="peso" placeholder="' + (conBalanza ? 'O escribe el peso' : 'Peso') + '"><select data-q="u"><option value="g">gramos</option><option value="kg">kilos</option><option value="lb">libras</option></select></div>' +
        '<div class="vq-chips"><button type="button" class="btn-ghost" data-g="250">250 g</button><button type="button" class="btn-ghost" data-g="500">1 libra</button><button type="button" class="btn-ghost" data-g="1000">1 kilo</button><button type="button" class="btn-ghost" data-g="2000">2 kilos</button></div>' +
        '<div class="vq-fila"><span style="font-size:15px">o por plata $</span><input type="number" inputmode="numeric" min="0" step="100" data-q="plata" placeholder="Ej. 2000"></div>' +
        '<div class="vq-tot" data-q="tot">' + plata(0) + '</div>' +
        '<div class="vq-bts"><button type="button" class="btn-primary" data-q="ok">✅ Agregar</button><button type="button" class="btn-close" data-q="x">Cancelar</button></div></div>';
      document.body.appendChild(ov);
      const $q = k => ov.querySelector('[data-q="' + k + '"]');
      $q('u').value = u === 'lb' ? 'lb' : 'g';
      let fuente = conBalanza ? 'balanza' : 'mano';
      const kgEscrito = () => { const v = Number(String($q('peso').value).replace(',', '.')) || 0, uu = $q('u').value; return uu === 'g' ? v / 1000 : uu === 'lb' ? v * 0.5 : v; };
      const kgActual = () => {
        if(fuente === 'plata'){ const pl = Number($q('plata').value) || 0; return precio ? pl / precio * (KG_POR[u] || 1) : 0; }
        if(fuente === 'balanza') return bal.kg || 0;
        return kgEscrito();
      };
      const pintar = () => {
        const kg = Math.max(0, kgActual()), cant = kgAUnidad(kg, u);
        if(conBalanza){ $q('vivo').textContent = bal.kg != null ? pesoTxt(kgAUnidad(bal.kg, 'kg'), 'kg') : '— kg'; $q('est').textContent = !bal.conectada && bal.kg == null ? (bal.error || 'Conectando la balanza…') : bal.estable ? '✅ Estable' : '⏳ Esperando que quede quieto…'; }
        $q('tot').textContent = kg > 0 ? pesoTxt(cant, u) + ' = ' + plata(cant * precio) : plata(0);
      };
      const oyente = () => { if(fuente === 'balanza') pintar(); };
      bal.oyentes.push(oyente);
      if(conBalanza && !bal.conectada) conectarBalanza(false).catch(e => { bal.error = e.message || String(e); pintar(); });
      if(conBalanza){ clearInterval(pidiendo); pidiendo = setInterval(pedirPeso, 600); pedirPeso(); }
      const fin = v => { bal.oyentes = bal.oyentes.filter(f => f !== oyente); clearInterval(pidiendo); pidiendo = null; ov.remove(); res(v); };
      $q('peso').addEventListener('input', () => { fuente = $q('peso').value ? 'mano' : (conBalanza ? 'balanza' : 'mano'); $q('plata').value = ''; pintar(); });
      $q('u').addEventListener('change', () => { if($q('peso').value) fuente = 'mano'; pintar(); });
      $q('plata').addEventListener('input', () => { fuente = $q('plata').value ? 'plata' : (conBalanza ? 'balanza' : 'mano'); $q('peso').value = ''; pintar(); });
      ov.addEventListener('click', e => {
        if(e.target === ov) return fin(0);
        const g = e.target.closest('[data-g]'); if(g){ $q('u').value = 'g'; $q('peso').value = g.dataset.g; $q('plata').value = ''; fuente = 'mano'; pintar(); return; }
        const b = e.target.closest('[data-q]'); if(!b) return;
        if(b.dataset.q === 'x') return fin(0);
        if(b.dataset.q === 'ok'){
          const kg = kgActual();
          if(!(kg > 0)) return toast(fuente === 'balanza' ? 'Pon el producto en la balanza o escribe el peso.' : 'Escribe el peso o el valor.');
          if(fuente === 'balanza' && !bal.estable && !confirm('La balanza todavía se está moviendo. ¿Agregar ' + pesoTxt(kgAUnidad(kg, 'kg'), 'kg') + '?')) return;
          // Por plata: la cantidad exacta para que esa línea valga justo lo que pidió («$2.000 de tomate» = $2.000).
          fin(fuente === 'plata' && precio ? Math.round((Number($q('plata').value) || 0) / precio * 1e6) / 1e6 : kgAUnidad(kg, u));
        }
      });
      setTimeout(() => { try{ if(!conBalanza) $q('peso').focus(); }catch(e){} }, 50);
      pintar();
    });
  }

  // ---------------------------------------------------------------- ⚙️ Ajustes → 🔌 Balanza, impresora y cajón
  let gr = null;
  function pintarEstado(){ try{ if(gr && !gr.hidden) pintarAjustes(); }catch(e){} }
  function entorno(){ const A = AND(); return { app: !!A, serial: 'serial' in navigator, usb: !!navigator.usb }; }
  function lista(){ try{ return JSON.parse(AND().lista() || '{}'); }catch(e){ return {}; } }
  function opcionesVia(tipo){
    const E = entorno(), o = [];
    if(tipo === 'impresora') o.push(['navegador', 'La ventana de imprimir del equipo (la de siempre)']);
    else o.push(['no', tipo === 'cajon' ? 'No tengo cajón' : 'No tengo / la uso aparte (escribo el peso)']);
    if(tipo === 'cajon') o.push(['impresora', 'Conectado a la impresora (cable de teléfono RJ11)']);
    if(E.app && tipo !== 'cajon') o.push(['bt', 'Bluetooth']);
    if(E.app) o.push(['usb', 'USB (cable)']);
    if(E.app && tipo === 'impresora') o.push(['red', 'Red: wifi o cable (IP)']);
    if(E.usb && tipo === 'impresora') o.push(['webusb', 'USB (cable) en este computador']);
    if(E.serial) o.push(['serial', 'Puerto COM / USB-serial en este computador']);
    return o;
  }
  function selectVia(id, tipo, val){ return '<select id="' + id + '">' + opcionesVia(tipo).map(([v, t]) => '<option value="' + v + '"' + (v === val ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>'; }
  function aparatos(tipo, c){
    if(!AND() || !(c.via === 'bt' || c.via === 'usb')) return '';
    const L = lista();
    if(c.via === 'bt'){
      if(!L.btPermiso) return '<small>Falta el permiso de Bluetooth.</small><div class="vq-bt"><button type="button" class="btn-ghost" data-vq="permbt">🔓 Dar el permiso</button></div>';
      if(!L.btPrendido) return '<small>Prende el Bluetooth del celular.</small>';
      const e = L.emparejados || [];
      return '<label>¿Cuál?</label><select data-vq-ap="' + tipo + '">' + (e.length ? e.map(d => '<option value="' + esc(d.mac) + '"' + (d.mac === c.mac ? ' selected' : '') + '>' + esc(d.nombre) + '</option>').join('') : '<option value="">Ninguno emparejado</option>') + '</select>' +
        '<small>¿No sale? Emparéjala primero en los ajustes de Bluetooth del celular (la clave suele ser 0000 o 1234).</small>';
    }
    const us = L.usb || [];
    return '<label>¿Cuál?</label><select data-vq-ap="' + tipo + '">' + (us.length ? us.map(d => '<option value="' + esc(d.id) + '" data-vid="' + d.vid + '" data-pid="' + d.pid + '"' + (d.id === c.id || (d.vid === c.vid && d.pid === c.pid) ? ' selected' : '') + '>' + esc(d.nombre + ' (' + d.tipo + ')' + (d.permiso ? '' : ' · falta permiso')) + '</option>').join('') : '<option value="">Nada conectado por USB</option>') + '</select>' +
      '<small>Conéctala con un cable OTG (USB a USB-C o micro USB). Android pregunta una vez si Vento la puede usar.</small>';
  }
  function pintarAjustes(){
    if(!gr) return;
    estilos();
    const c = cfg(), E = entorno();
    const vel = v => '<select id="vqBaud">' + [2400, 4800, 9600, 19200, 38400, 115200].map(x => '<option' + (x === Number(v) ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>';
    gr.innerHTML = '<h2>🔌 Balanza, impresora y cajón</h2>' +
      '<div class="modal-sub" style="margin-bottom:6px">' + (E.app ? '📱 App Vento para Android: Bluetooth, USB (con cable OTG) y red.' : E.serial || E.usb ? '💻 Computador con Chrome o Edge: por USB o puerto COM.' : '⚠️ Este navegador no conecta aparatos. Usa la app Vento para Android, o Chrome o Edge en el computador. Imprimir con la ventana de siempre sí funciona.') + ' Lo que elijas aquí es solo para ESTE equipo.</div>' +
      // Impresora
      '<div class="vq-sec"><h3>🧾 Impresora de facturas</h3><label>¿Cómo está conectada?</label>' + selectVia('vqImpVia', 'impresora', c.impresora.via) + aparatos('impresora', c.impresora) +
      (c.impresora.via === 'red' ? '<label>IP de la impresora</label><input type="text" id="vqImpHost" inputmode="decimal" placeholder="192.168.1.100" value="' + esc(c.impresora.host || '') + '"><label>Puerto</label><input type="number" id="vqImpPuerto" value="' + esc(c.impresora.puerto || 9100) + '">' : '') +
      (directa(c.impresora) ? '<label>Ancho del papel</label><select id="vqImpAncho"><option value="32"' + (Number(c.impresora.ancho) < 48 ? ' selected' : '') + '>58 mm (la pequeña)</option><option value="48"' + (Number(c.impresora.ancho) >= 48 ? ' selected' : '') + '>80 mm (la grande)</option></select>' +
        '<label class="vq-ck"><input type="checkbox" id="vqImpAuto"' + (c.impresora.auto ? ' checked' : '') + '> Imprimir la factura sola al cobrar</label>' +
        '<label class="vq-ck"><input type="checkbox" id="vqImpTildes"' + (c.impresora.tildes !== false ? ' checked' : '') + '> Con tildes y ñ (si salen letras raras, apágalo)</label>' : '') +
      '<div class="vq-bt">' + (c.impresora.via === 'webusb' ? '<button type="button" class="btn-ghost" data-vq="buscarusb">🔎 Buscar impresora USB</button>' : '') + (c.impresora.via === 'serial' ? '<button type="button" class="btn-ghost" data-vq="buscarcomimp">🔎 Elegir el puerto</button>' : '') +
        '<button type="button" class="btn-primary" data-vq="probarimp">🧪 Imprimir prueba</button></div></div>' +
      // Cajón
      '<div class="vq-sec"><h3>💵 Cajón de dinero</h3><label>¿Cómo está conectado?</label>' + selectVia('vqCajVia', 'cajon', c.cajon.via) + (c.cajon.via === 'usb' ? aparatos('cajon', c.cajon) : '') +
      (c.cajon.via !== 'no' ? '<label class="vq-ck"><input type="checkbox" id="vqCajAuto"' + (c.cajon.alCobrar !== false ? ' checked' : '') + '> Abrirlo solo al cobrar en efectivo</label>' +
        '<label class="vq-ck"><input type="checkbox" id="vqCajPin"' + (c.cajon.pin ? ' checked' : '') + '> No abre: probar el otro contacto (pin 5)</label>' : '') +
      '<div class="vq-bt">' + (c.cajon.via === 'serial' ? '<button type="button" class="btn-ghost" data-vq="buscarcomcaj">🔎 Elegir el puerto</button>' : '') + (c.cajon.via !== 'no' ? '<button type="button" class="btn-primary" data-vq="probarcaj">🧪 Abrir el cajón</button>' : '') + '</div>' +
      '<small>Casi todos los cajones se conectan a la impresora con un cable de teléfono: la impresora lo abre. Cada vez que se abre queda en la actividad del equipo.</small></div>' +
      // Balanza
      '<div class="vq-sec"><h3>⚖️ Balanza</h3><label>¿Cómo está conectada?</label>' + selectVia('vqBalVia', 'balanza', c.balanza.via) + aparatos('balanza', c.balanza) +
      (c.balanza.via !== 'no' ? '<label>Velocidad (casi siempre 9600; Toledo a veces 2400 o 4800)</label>' + vel(c.balanza.baud) +
        '<label>¿Cómo pide el peso?</label><select id="vqBalPedir">' + [['auto', 'Automático (lo prueba solo)'], ['nada', 'La balanza lo manda sola'], ['enq', 'ENQ (Toledo, Moresco)'], ['p', '«P»'], ['w', '«W»'], ['si', '«SI»'], ['dolar', '«$»']].map(([v, t]) => '<option value="' + v + '"' + (c.balanza.pedir === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
        '<div class="vq-vivo" id="vqVivo">' + (bal.kg != null ? pesoTxt(bal.kg, 'kg') + (bal.estable ? ' ✅' : ' ⏳') : '— kg') + '</div><small id="vqCrudo">' + (bal.error ? '⚠️ ' + esc(bal.error) : bal.crudo ? 'La balanza dice: «' + esc(bal.crudo) + '»' : bal.conectada ? 'Conectada. Pon algo encima.' : 'Toca «Conectar» y pon algo encima.') + '</small>' +
        '<div class="vq-bt">' + (c.balanza.via === 'serial' ? '<button type="button" class="btn-ghost" data-vq="buscarcombal">🔎 Elegir el puerto y conectar</button>' : '<button type="button" class="btn-primary" data-vq="conbal">🔌 Conectar</button>') + '</div>' : '') +
      '<label class="vq-ck"><input type="checkbox" id="vqEtiOn"' + (c.etiquetas.on !== false ? ' checked' : '') + '> 🏷️ Leer las etiquetas de la balanza (código de barras que empieza por 2)</label>' +
      (c.etiquetas.on !== false ? '<label>La etiqueta trae</label><select id="vqEtiModo"><option value="peso"' + (c.etiquetas.modo !== 'precio' ? ' selected' : '') + '>El peso (en gramos)</option><option value="precio"' + (c.etiquetas.modo === 'precio' ? ' selected' : '') + '>El precio</option></select>' +
        '<label>Dígitos del código del producto (PLU)</label><select id="vqEtiPlu">' + [4, 5, 6].map(n => '<option' + (Number(c.etiquetas.plu) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' : '') +
      '<small>Para vender por peso: en el producto elige «⚖️ Se vende por kilo» o «por libra». El PLU de la balanza va en «Código».</small></div>';
  }
  function leerAjustes(){
    const c = cfg(), v = id => { const e = document.getElementById(id); return e ? e.value : undefined; }, ck = id => { const e = document.getElementById(id); return e ? e.checked : undefined; };
    if(v('vqImpVia') != null) c.impresora.via = v('vqImpVia');
    if(v('vqImpHost') != null) c.impresora.host = v('vqImpHost').trim();
    if(v('vqImpPuerto') != null) c.impresora.puerto = Number(v('vqImpPuerto')) || 9100;
    if(v('vqImpAncho') != null) c.impresora.ancho = Number(v('vqImpAncho'));
    if(ck('vqImpAuto') != null) c.impresora.auto = ck('vqImpAuto');
    if(ck('vqImpTildes') != null) c.impresora.tildes = ck('vqImpTildes');
    if(v('vqCajVia') != null) c.cajon.via = v('vqCajVia');
    if(ck('vqCajAuto') != null) c.cajon.alCobrar = ck('vqCajAuto');
    if(ck('vqCajPin') != null) c.cajon.pin = ck('vqCajPin') ? 1 : 0;
    if(v('vqBalVia') != null) c.balanza.via = v('vqBalVia');
    if(v('vqBaud') != null) c.balanza.baud = Number(v('vqBaud'));
    if(v('vqBalPedir') != null) c.balanza.pedir = v('vqBalPedir');
    if(ck('vqEtiOn') != null) c.etiquetas.on = ck('vqEtiOn');
    if(v('vqEtiModo') != null) c.etiquetas.modo = v('vqEtiModo');
    if(v('vqEtiPlu') != null) c.etiquetas.plu = Number(v('vqEtiPlu'));
    gr.querySelectorAll('[data-vq-ap]').forEach(s => {
      const k = s.dataset.vqAp, o = s.selectedOptions[0], x = c[k]; if(!o || !o.value) return;
      if(x.via === 'bt'){ x.mac = o.value; x.nombre = o.textContent; }
      else { x.id = o.value; x.vid = Number(o.dataset.vid); x.pid = Number(o.dataset.pid); x.nombre = o.textContent; if(k === 'cajon') x.conexion = 'usb'; }
    });
    if(c.cajon.via === 'serial') c.cajon.conexion = 'serial';
    guardarCfg(c);
    return c;
  }
  async function usbPermiso(x){
    const A = AND(); if(!A || x.via !== 'usb' || !x.id) return true;
    const r = andEsperar('usb', 60000); A.pedirUsb(x.id); const d = await r; return !!d.ok;
  }
  async function accion(a){
    const c = leerAjustes();
    try{
      if(a === 'permbt'){ const r = andEsperar('bt', 60000); AND().pedirBluetooth(); await r; return pintarAjustes(); }
      if(a === 'buscarusb'){ const dev = await navigator.usb.requestDevice({ filters: filtroUsb }); c.impresora.vid = dev.vendorId; c.impresora.pid = dev.productId; c.impresora.nombre = dev.productName || 'Impresora USB'; guardarCfg(c); toast('🧾 Impresora elegida: ' + c.impresora.nombre); return pintarAjustes(); }
      if(a === 'buscarcomimp' || a === 'buscarcomcaj'){ const p = await navigator.serial.requestPort(); const i = p.getInfo ? p.getInfo() : {}; const x = a === 'buscarcomimp' ? c.impresora : c.cajon; x.vid = i.usbVendorId; x.pid = i.usbProductId; guardarCfg(c); toast('✅ Puerto elegido'); return pintarAjustes(); }
      if(a === 'buscarcombal'){ await conectarBalanza(true); toast('⚖️ Balanza conectada: pon algo encima.'); clearInterval(pidiendo); pidiendo = setInterval(pedirPeso, 600); setTimeout(() => { clearInterval(pidiendo); pidiendo = null; }, 15000); return pintarAjustes(); }
      if(a === 'conbal'){ if(!(await usbPermiso(c.balanza))) return toast('Android no dio el permiso USB.'); await conectarBalanza(false); toast('⚖️ Conectando… pon algo encima.'); clearInterval(pidiendo); pidiendo = setInterval(pedirPeso, 600); setTimeout(() => { clearInterval(pidiendo); pidiendo = null; }, 15000); return; }
      if(a === 'probarimp'){
        if(!directa(c.impresora)){ try{ window.print(); }catch(e){} return; }
        if(!(await usbPermiso(c.impresora))) return toast('Android no dio el permiso USB.');
        await mandar(c.impresora, prueba({ ancho: c.impresora.ancho, tildes: c.impresora.tildes !== false })); toast('🧾 Prueba enviada a la impresora.'); return;
      }
      if(a === 'probarcaj'){ if(c.cajon.via === 'usb' && !(await usbPermiso(c.cajon))) return toast('Android no dio el permiso USB.'); await abrirCajon('prueba en Ajustes'); toast('💵 Listo: se mandó a abrir el cajón.'); return; }
    }catch(e){ if(e && e.name === 'NotFoundError') return; toast('⚠️ ' + (e.message || e), 8000); }
  }
  function crearAjustes(){
    const cats = document.getElementById('ajustesCats'); if(!cats || document.getElementById('vqGrupo')) return !!document.getElementById('vqGrupo');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ajustes-cat'; b.dataset.cat = 'equipos'; b.setAttribute('data-novocab', '');
    b.innerHTML = '<span class="ac-icon">🔌</span><span class="ac-label">Balanza, impresora y cajón</span><span class="ac-arrow">›</span>';
    const ref = cats.querySelector('[data-cat="pedidos"]'); cats.insertBefore(b, ref ? ref.nextSibling : null);
    const otro = document.querySelector('#view-ajustes .settings-group[data-cat]'); if(!otro) return false;
    gr = document.createElement('div'); gr.className = 'settings-group'; gr.id = 'vqGrupo'; gr.dataset.cat = 'equipos'; gr.hidden = true; gr.setAttribute('data-novocab', '');
    otro.parentNode.insertBefore(gr, otro);
    b.addEventListener('click', () => { pintarAjustes(); if(window.mostrarCategoriaAjustes) window.mostrarCategoriaAjustes('equipos'); });
    gr.addEventListener('change', e => { if(e.target.matches('select,input')){ leerAjustes(); if(/Via$/.test(e.target.id) || e.target.id === 'vqEtiOn') pintarAjustes(); pintarCajonBtn(); } });
    gr.addEventListener('click', e => { const x = e.target.closest('[data-vq]'); if(x) accion(x.dataset.vq); });
    bal.oyentes.push(() => { const v = document.getElementById('vqVivo'), cr = document.getElementById('vqCrudo'); if(v) v.textContent = pesoTxt(bal.kg, 'kg') + (bal.estable ? ' ✅' : ' ⏳'); if(cr) cr.textContent = 'La balanza dice: «' + bal.crudo + '»'; });
    return true;
  }

  // ---------------------------------------------------------------- ⚖️ «Se vende por kilo / libra» en el producto
  function campoProducto(){
    const ov = document.getElementById('editProductOverlay'); if(!ov || document.getElementById('vqPorPeso')) return !!ov;
    const ref = document.getElementById('editProdCodigo'); const lbl = ref && ref.closest('.iv-codewrap'); if(!lbl) return false;
    const w = document.createElement('div'); w.setAttribute('data-novocab', '');
    w.innerHTML = '<label for="vqPorPeso">⚖️ Se vende</label><select id="vqPorPeso"><option value="">Por unidad</option><option value="kg">Por kilo (el precio es el del kilo)</option><option value="lb">Por libra (el precio es el de la libra, 500 g)</option></select>';
    lbl.parentNode.insertBefore(w, lbl.nextSibling);
    const prod = () => { try{ return editingProductId ? (data.products || []).find(p => p.id === editingProductId) : null; }catch(e){ return null; } };
    new MutationObserver(() => { if(ov.classList.contains('show')){ const p = prod(); document.getElementById('vqPorPeso').value = p ? unidadDe(p) : ''; } }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    // Antes de que «Guardar cambios» cierre la ventana (fase de captura).
    document.addEventListener('click', e => { if(e.target && e.target.closest && e.target.closest('#editProdSaveBtn')){ const p = prod(); if(p){ const v = document.getElementById('vqPorPeso').value; if(v) p.porPeso = v; else delete p.porPeso; } } }, true);
    return true;
  }

  // ---------------------------------------------------------------- 🧾 Imprimir con la impresora directa (si hay)
  function envolverImprimir(){
    const orig = window.printReceipt;
    if(typeof orig !== 'function' || orig._vq) return typeof orig === 'function';
    const nuevo = function(rd){
      if(!directa(cfg().impresora)) return orig.apply(this, arguments);
      const self = this, args = arguments;
      imprimirRecibo(rd).then(() => toast('🧾 Factura impresa.'), e => { toast('🧾 La impresora no respondió (' + (e.message || e) + '). Se abre la ventana de imprimir.', 7000); orig.apply(self, args); });
    };
    nuevo._vq = true; window.printReceipt = nuevo; try{ printReceipt = nuevo; }catch(e){}
    return true;
  }
  // «💵 Abrir cajón» en la caja (solo si hay cajón)
  function pintarCajonBtn(){ const on = cfg().cajon.via !== 'no'; document.querySelectorAll('.pz-cajon-btn').forEach(b => { b.hidden = !on; }); }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.pz-cajon-btn'); if(!b) return;
    abrirCajon('botón de la caja').then(() => toast('💵 Cajón abierto.'), x => toast('💵 ' + (x.message || x), 7000));
  });

  const arr = setInterval(() => {
    if(!D()) return;
    const a = crearAjustes(), b = campoProducto(), c = envolverImprimir();
    pintarCajonBtn();
    if(a && b && c){ clearInterval(arr); setInterval(pintarCajonBtn, 3000);
      // La balanza que ya estaba elegida se conecta sola (computador: el puerto ya autorizado; app: el de siempre).
      const bz = cfg().balanza; if(bz.via === 'serial' || (AND() && bz.via === 'bt')) setTimeout(() => conectarBalanza(false).catch(() => {}), 1500);
    }
  }, 700);

  window.ventoEquipos = { cfg, guardarCfg, pesar, etiqueta, unidadDe, pesoTxt, alCobrar, abrirCajon, imprimirRecibo, conectarBalanza, desconectarBalanza, balanza: bal, _leer: t => lector.poner(t), _trama: leerTrama };
  window.ventoEscPos = { recibo, prueba, cajon: cajonBytes, bytesDe };
})();
