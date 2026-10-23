/* =====================================================================
   ORDEVA · 🛰️ Tablero (arriba de Estadísticas)
   El dueño mandó un tablero de referencia (astracore.lat) y pidió «que ORDEVA tenga las mismas funciones, mejoradas las
   estadísticas, y dale esta apariencia». Todo sale de lo que ya guarda la app (data.history, pedidos por QR de
   window.vitoPedidos y las devoluciones de cada venta); no se guarda nada nuevo ni se cambia ninguna cuenta.
     • 4 tarjetas: Pedidos, Ingresos, Ticket promedio y Productos vendidos, con ▲/▼ % contra el período anterior.
     • Ingresos por hora (o por día / mes): en mesas y en caja (mostrador y domicilios), con el cruce al tocar.
       Hoy, además, el ESTIMADO del resto del día (promedio de los mismos días de semanas anteriores), siempre marcado
       como estimado: nunca se mezcla con lo real.
     • Productos más vendidos (dona + lista), Carga de trabajo (finalizados vs. cancelados/devueltos),
       Últimos movimientos (tarjetas que se deslizan) y Órdenes recientes (tabla con páginas).
     • «Lo que ve Laya»: 3 frases con cifras reales del período (sin inventar).
   Usa el período de arriba (Hoy / 7 días / 30 días / Todo) y los colores de la paleta elegida (oscura o clara).
   ===================================================================== */
(function(){
  'use strict';
  if(window.ventoTablero) return;
  const $ = id => document.getElementById(id);
  const D = () => (typeof data !== 'undefined' && data) ? data : null;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CO');
  const corto = n => { n = Math.round(Number(n) || 0); const a = Math.abs(n);
    return a >= 1e6 ? '$' + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' M' : a >= 1e4 ? '$' + Math.round(n / 1e3) + ' mil' : plata(n); };
  const DIA = 864e5;
  const DSEM = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  const t0 = h => { const t = Date.parse(h.date || h.closedAt || 0); return isNaN(t) ? 0 : t; };
  const valida = h => !h.anulada && !h.voided;
  const esCaja = h => h.table == null;                            // mostrador, venta rápida y domicilios
  const lugar = h => h.tableName || (h.table != null ? ((typeof tableLabel === 'function' ? (() => { try{ return tableLabel(h.table); }catch(e){ return ''; } })() : '') || 'Mesa ' + h.table) : 'Mostrador');
  const orden = h => h.invoiceNo || ('#' + String(h.id || '').replace(/\D/g, '').slice(-5));
  const noEsProducto = n => /^\s*(🛵|propina\b|servicio voluntario)/i.test(String(n || ''));
  const unidades = h => (h.items || []).reduce((s, it) => noEsProducto(it.name) ? s : s + (it.unidad ? 1 : Number(it.qty) || 0), 0);

  // ---------- Período ----------
  function rango(per){
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const ahora = Date.now();
    if(per === 'hoy') return { per, desde: +d0, hasta: +d0 + DIA, previo: [+d0 - DIA, +d0], vs: 'vs. ayer' };
    if(per === '7' || per === '30'){ const n = +per, desde = +d0 - (n - 1) * DIA; return { per, n, desde, hasta: +d0 + DIA, previo: [desde - n * DIA, desde], vs: 'vs. ' + n + ' días antes' }; }
    return { per: 'todo', desde: 0, hasta: ahora + DIA, previo: null, vs: '' };
  }
  function ventas(desde, hasta){ const d = D(); return ((d && d.history) || []).filter(h => { const t = t0(h); return valida(h) && t >= desde && t < hasta; }); }
  function totales(H){
    let ing = 0, mesas = 0, caja = 0, u = 0, fiado = 0;
    H.forEach(h => { const v = Number(h.total) || 0; ing += v; if(esCaja(h)) caja += v; else mesas += v; u += unidades(h); fiado += Number(h.debt) || 0; });
    return { n: H.length, ing, mesas, caja, u, fiado, ticket: H.length ? ing / H.length : 0 };
  }
  // ▲/▼ contra el período anterior de igual duración (solo con cifras reales).
  function cambio(cur, prev){
    if(prev == null) return null;
    if(!prev && !cur) return { txt: '0%', dir: 0 };
    if(!prev) return { txt: 'nuevo', dir: 1 };
    const p = Math.round((cur - prev) / prev * 100);
    return { txt: Math.abs(p) + '%', dir: p > 0 ? 1 : p < 0 ? -1 : 0 };
  }

  // ---------- Barras de tiempo (horas, días o meses) ----------
  function cubetas(r, H){
    const B = [];
    if(r.per === 'hoy'){
      const horas = H.map(h => new Date(t0(h)).getHours()), ini = Math.min(6, ...(horas.length ? horas : [6]));
      for(let i = ini; i < 24; i++){ const a = r.desde + i * 36e5; B.push({ a, b: a + 36e5, l: i + 'h', t: i + ':00 – ' + (i + 1) + ':00', hora: i }); }
    } else if(r.per === 'todo'){
      const ts = H.map(t0), min = ts.length ? Math.min(...ts) : Date.now(), d = new Date(min); d.setDate(1); d.setHours(0, 0, 0, 0);
      const hoy = new Date();
      while(d <= hoy){ const a = +d; d.setMonth(d.getMonth() + 1); B.push({ a, b: +d, l: (new Date(a).getMonth() + 1) + '/' + String(new Date(a).getFullYear()).slice(2), t: new Date(a).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) }); }
      if(B.length > 24) B.splice(0, B.length - 24);
    } else {
      for(let i = 0; i < r.n; i++){ const a = r.desde + i * DIA, x = new Date(a); B.push({ a, b: a + DIA, l: x.getDate() + '/' + (x.getMonth() + 1), t: x.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) }); }
    }
    B.forEach(c => { c.mesas = 0; c.caja = 0; c.fin = 0; c.can = 0; });
    const donde = t => { for(let i = B.length - 1; i >= 0; i--) if(t >= B[i].a && t < B[i].b) return B[i]; return null; };
    H.forEach(h => { const c = donde(t0(h)); if(!c) return; const v = Number(h.total) || 0; if(esCaja(h)) c.caja += v; else c.mesas += v; c.fin++; });
    // Cancelados: pedidos por QR cancelados y ventas con devolución (a la hora en que se hicieron).
    let ped = []; try{ ped = (window.vitoPedidos && window.vitoPedidos.lista()) || []; }catch(e){}
    ped.forEach(p => { if(p && p.estado === 'cancelado'){ const c = donde(Number(p.at) || 0); if(c) c.can++; } });
    const d = D(); ((d && d.history) || []).forEach(h => (h.devoluciones || []).forEach(x => { const c = donde(Number(x.t) || 0); if(c) c.can++; }));
    return B;
  }
  // Hoy: lo que falta del día, estimado con los mismos días de semana anteriores (hasta 4) que sí tuvieron ventas.
  function estimado(B){
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const semanas = [];
    for(let k = 1; k <= 4; k++){ const a = +d0 - 7 * k * DIA, H = ventas(a, a + DIA); if(H.length) semanas.push({ a, H }); }
    if(semanas.length < 2) return null;
    const ahoraH = new Date().getHours();
    const porHora = Array(24).fill(0);
    semanas.forEach(s => s.H.forEach(h => { porHora[new Date(t0(h)).getHours()] += (Number(h.total) || 0) / semanas.length; }));
    const resto = porHora.reduce((s, v, i) => i > ahoraH ? s + v : s, 0);
    return { semanas: semanas.length, porHora, ahoraH, resto, dia: DSEM[d0.getDay()] };
  }

  // ---------- Colores (validados con el método de dataviz: oscuro sobre #17171f y claro sobre blanco) ----------
  function claro(){
    try{
      const c = getComputedStyle(document.body).backgroundColor, m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c);
      if(m) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 > 0.55;
    }catch(e){}
    return false;
  }
  const PAL = { oscuro: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'], claro: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] };
  const BIEN = '#0ca30c', MAL = '#d03b3b';

  // ---------- Piezas ----------
  const ICO = {
    pedidos: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    ingresos: '<svg viewBox="0 0 24 24"><path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.6 5 3.2 5 1.4 5 3.3-2.2 3.3-5 3.3-5-1.4-5-3.3"/></svg>',
    ticket: '<svg viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z"/><path d="M14 4v12" stroke-dasharray="2 2"/></svg>',
    productos: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>'
  };
  function kpi(k, color, titulo, valor, c, vs, sub){
    return '<div class="tb-kpi"><div class="tb-kpi-top"><span class="tb-ico" style="--c:' + color + '">' + ICO[k] + '</span><span class="tb-kpi-l">' + esc(titulo) + '</span></div>' +
      '<b class="tb-kpi-v">' + esc(valor) + '</b>' +
      '<div class="tb-kpi-pie">' + (c ? '<span class="tb-cambio ' + (c.dir > 0 ? 'sube' : c.dir < 0 ? 'baja' : 'igual') + '">' + (c.dir > 0 ? '▲ ' : c.dir < 0 ? '▼ ' : '● ') + esc(c.txt) + '</span><small>' + esc(vs) + '</small>' : '<small>' + esc(sub || '') + '</small>') + '</div></div>';
  }
  function tarjeta(clase, titulo, cuerpo, codigo){ return '<div class="tb-card ' + clase + '"><div class="tb-card-h"><div>' + (codigo ? '<span class="tb-cod">' + codigo + '</span>' : '') + '<h3>' + titulo + '</h3></div></div>' + cuerpo + '</div>'; }

  // Ingresos: dos áreas (mesas y caja) + estimado punteado; cruce con ventanita al tocar o pasar el mouse.
  function graficaIngresos(B, est, pal, ancho){
    const W = Math.max(280, Math.round(ancho)), H = 230, iz = 50, de = 10, ar = 14, ab = 26, w = W - iz - de, h = H - ar - ab;
    const futuro = i => est && B[i].hora != null && B[i].hora > est.ahoraH;
    const eV = i => futuro(i) ? est.porHora[B[i].hora] : null;
    let max = 0; B.forEach((c, i) => { max = Math.max(max, c.mesas, c.caja, eV(i) || 0); });
    if(!max) max = 1;
    const paso = Math.pow(10, Math.floor(Math.log10(max))), tope = Math.ceil(max / paso / 2) * paso * 2 || 1;
    const X = i => iz + (B.length < 2 ? w / 2 : i * w / (B.length - 1)), Y = v => ar + h - v / tope * h;
    const linea = (k, hasta) => B.map((c, i) => [i, c[k]]).filter(p => hasta == null || p[0] <= hasta).map((p, j) => (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    const ultimo = est ? B.reduce((u, c, i) => c.hora != null && c.hora <= est.ahoraH ? i : u, B.length - 1) : B.length - 1;
    const area = k => { const l = linea(k, ultimo); return l ? l + ' L' + X(ultimo).toFixed(1) + ' ' + (ar + h) + ' L' + X(0).toFixed(1) + ' ' + (ar + h) + ' Z' : ''; };
    let g = '';
    for(let i = 0; i <= 4; i++){ const v = tope * i / 4, y = Y(v); g += '<line x1="' + iz + '" x2="' + (W - de) + '" y1="' + y + '" y2="' + y + '" class="tb-gl"/><text x="' + (iz - 6) + '" y="' + (y + 4) + '" class="tb-eje" text-anchor="end">' + esc(corto(v)) + '</text>'; }
    const cada = Math.max(1, Math.ceil(B.length / Math.max(3, Math.floor(w / 46))));
    B.forEach((c, i) => { if(i % cada === 0 || i === B.length - 1) g += '<text x="' + X(i) + '" y="' + (H - 8) + '" class="tb-eje" text-anchor="middle">' + esc(c.l) + '</text>'; });
    let e = '';
    if(est){
      const pts = B.map((c, i) => i === ultimo ? [i, c.mesas + c.caja] : futuro(i) ? [i, eV(i)] : null).filter(Boolean);
      if(pts.length > 1) e = '<path d="' + pts.map((p, j) => (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ') + '" class="tb-est"/>';
    }
    return '<div class="tb-plot" data-w="' + W + '"><svg class="tb-svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Ingresos en mesas y en caja">' +
      '<defs><linearGradient id="tbG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal[0] + '" stop-opacity=".32"/><stop offset="1" stop-color="' + pal[0] + '" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="tbG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal[1] + '" stop-opacity=".26"/><stop offset="1" stop-color="' + pal[1] + '" stop-opacity="0"/></linearGradient></defs>' + g +
      '<path d="' + area('mesas') + '" fill="url(#tbG1)"/><path d="' + area('caja') + '" fill="url(#tbG2)"/>' +
      '<path d="' + linea('mesas', ultimo) + '" class="tb-l" stroke="' + pal[0] + '"/><path d="' + linea('caja', ultimo) + '" class="tb-l" stroke="' + pal[1] + '"/>' + e +
      '<line class="tb-cruz" y1="' + ar + '" y2="' + (ar + h) + '" x1="-9" x2="-9"/><circle class="tb-pt" r="5" cx="-9" cy="-9" fill="' + pal[0] + '"/><circle class="tb-pt" r="5" cx="-9" cy="-9" fill="' + pal[1] + '"/>' +
      '<rect class="tb-hit" x="' + iz + '" y="0" width="' + w + '" height="' + (ar + h) + '" fill="transparent"/></svg><div class="tb-tip" hidden></div></div>';
  }
  function cruce(plot, B, est, pal){
    const svg = plot.querySelector('svg'), tip = plot.querySelector('.tb-tip'), hit = plot.querySelector('.tb-hit');
    if(!svg || !hit) return;
    const W = +plot.dataset.w, iz = 50, de = 10, w = W - iz - de;
    const cz = plot.querySelector('.tb-cruz'), pts = plot.querySelectorAll('.tb-pt');
    const mover = ev => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W;
      const i = Math.max(0, Math.min(B.length - 1, Math.round(B.length < 2 ? 0 : (x - iz) / w * (B.length - 1)))), c = B[i];
      const X = iz + (B.length < 2 ? w / 2 : i * w / (B.length - 1));
      cz.setAttribute('x1', X); cz.setAttribute('x2', X);
      const yDe = v => plot._Y ? plot._Y(v) : 0;
      const fut = est && c.hora != null && c.hora > est.ahoraH;
      pts[0].setAttribute('cx', fut ? -9 : X); pts[0].setAttribute('cy', yDe(c.mesas));
      pts[1].setAttribute('cx', fut ? -9 : X); pts[1].setAttribute('cy', yDe(c.caja));
      tip.hidden = false;
      tip.innerHTML = '<b>' + esc(c.t) + '</b>' + (fut
        ? '<div><i class="tb-sw tb-sw-est"></i>Estimado <b>' + esc(plata(est.porHora[c.hora])) + '</b></div><small>Estimado, no es real todavía</small>'
        : '<div><i class="tb-sw" style="background:' + pal[0] + '"></i>En mesas <b>' + esc(plata(c.mesas)) + '</b></div><div><i class="tb-sw" style="background:' + pal[1] + '"></i>En caja <b>' + esc(plata(c.caja)) + '</b></div><div class="tb-tip-t">Total <b>' + esc(plata(c.mesas + c.caja)) + '</b> · ' + c.fin + ' venta' + (c.fin === 1 ? '' : 's') + '</div>');
      const px = (X / W) * r.width, tw = tip.offsetWidth || 160;
      tip.style.left = Math.max(4, Math.min(r.width - tw - 4, px + (px > r.width / 2 ? -tw - 12 : 12))) + 'px';
      tip.style.top = '8px';
    };
    const fuera = () => { tip.hidden = true; cz.setAttribute('x1', -9); cz.setAttribute('x2', -9); pts.forEach(p => p.setAttribute('cx', -9)); };
    hit.addEventListener('pointermove', mover); hit.addEventListener('pointerdown', mover); hit.addEventListener('pointerleave', fuera);
  }

  function dona(lista, pal){
    const tot = lista.reduce((s, x) => s + x.q, 0);
    if(!tot) return '<div class="tb-vacio">Todavía no hay productos vendidos en este período.</div>';
    const R = 62, C = 2 * Math.PI * R, gap = lista.length > 1 ? 2.5 : 0;
    let off = 0;
    const segs = lista.map((x, i) => {
      const largo = x.q / tot * C, d = Math.max(0.01, largo - gap), col = x.otros ? 'var(--ink-soft)' : pal[i % pal.length];
      const s = '<circle r="' + R + '" cx="80" cy="80" fill="none" stroke="' + col + '" stroke-width="22" stroke-dasharray="' + d.toFixed(2) + ' ' + (C - d).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" data-i="' + i + '"><title>' + esc(x.n + ': ' + fmtQ(x.q) + ' u · ' + plata(x.v)) + '</title></circle>';
      off += largo; return s;
    }).join('');
    return '<div class="tb-dona"><svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Productos más vendidos"><g transform="rotate(-90 80 80)">' + segs + '</g>' +
      '<text x="80" y="76" text-anchor="middle" class="tb-dona-n">' + esc(fmtQ(tot)) + '</text><text x="80" y="96" text-anchor="middle" class="tb-eje">unidades</text></svg>' +
      '<ol class="tb-top">' + lista.map((x, i) => '<li data-i="' + i + '"><i class="tb-sw" style="background:' + (x.otros ? 'var(--ink-soft)' : pal[i % pal.length]) + '"></i><span class="tb-top-n">' + esc(x.n) + '</span><span class="tb-top-v"><b>' + esc(fmtQ(x.q)) + ' u</b><small>' + Math.round(x.q / tot * 100) + '% · ' + esc(corto(x.v)) + '</small></span></li>').join('') + '</ol></div>';
  }
  const fmtQ = q => (Math.round(q * 100) / 100).toLocaleString('es-CO');
  function masVendidos(H){
    const m = {};
    H.forEach(h => (h.items || []).forEach(it => {
      if(noEsProducto(it.name)) return;
      let n = it.name; try{ if(typeof nombreVigente === 'function') n = nombreVigente(it.name); }catch(e){}
      const x = m[n] = m[n] || { n, q: 0, v: 0 }; x.q += it.unidad ? 1 : Number(it.qty) || 0; x.v += (Number(it.qty) || 0) * (Number(it.price) || 0);
    }));
    const L = Object.values(m).sort((a, b) => b.q - a.q || b.v - a.v), top = L.slice(0, 5), resto = L.slice(5);
    if(resto.length) top.push({ n: 'Otros (' + resto.length + ')', q: resto.reduce((s, x) => s + x.q, 0), v: resto.reduce((s, x) => s + x.v, 0), otros: true });
    return top;
  }

  function barrasCarga(B, ancho){
    const fin = B.reduce((s, c) => s + c.fin, 0), can = B.reduce((s, c) => s + c.can, 0);
    if(!fin && !can) return '<div class="tb-vacio">Sin movimiento en este período.</div>';
    const W = Math.max(260, Math.round(ancho)), H = 190, iz = 28, de = 6, ar = 10, ab = 24, w = W - iz - de, h = H - ar - ab;
    const max = Math.max(1, ...B.map(c => Math.max(c.fin, c.can))), tope = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    const gw = w / B.length, bw = Math.max(2, Math.min(16, (gw - 4) / 2 - 1));
    const Y = v => ar + h - v / tope * h;
    let g = '';
    for(let i = 0; i <= 4; i++){ const v = tope * i / 4, y = Y(v); g += '<line x1="' + iz + '" x2="' + (W - de) + '" y1="' + y + '" y2="' + y + '" class="tb-gl"/><text x="' + (iz - 5) + '" y="' + (y + 4) + '" class="tb-eje" text-anchor="end">' + v + '</text>'; }
    const cada = Math.max(1, Math.ceil(B.length / Math.max(3, Math.floor(w / 40))));
    const barra = (x, v, col) => { if(!v) return ''; const y = Y(v), hh = ar + h - y, r = Math.min(4, bw / 2, hh);
      return '<path d="M' + x + ' ' + (ar + h) + 'V' + (y + r) + 'q0 -' + r + ' ' + r + ' -' + r + 'h' + (bw - 2 * r) + 'q' + r + ' 0 ' + r + ' ' + r + 'V' + (ar + h) + 'Z" fill="' + col + '"/>'; };
    B.forEach((c, i) => {
      const cx = iz + gw * i + gw / 2;
      g += '<g class="tb-bar"><title>' + esc(c.t + ': ' + c.fin + ' finalizado' + (c.fin === 1 ? '' : 's') + ', ' + c.can + ' cancelado' + (c.can === 1 ? '' : 's') + ' o devuelto' + (c.can === 1 ? '' : 's')) + '</title>' +
        '<rect x="' + (iz + gw * i) + '" y="' + ar + '" width="' + gw + '" height="' + h + '" fill="transparent"/>' + barra(cx - bw - 1, c.fin, BIEN) + barra(cx + 1, c.can, MAL) + '</g>';
      if(i % cada === 0 || i === B.length - 1) g += '<text x="' + cx + '" y="' + (H - 7) + '" class="tb-eje" text-anchor="middle">' + esc(c.l) + '</text>';
    });
    return '<div class="tb-ley"><span><i class="tb-sw" style="background:' + BIEN + '"></i>✅ Finalizado <b>' + fin + '</b></span><span><i class="tb-sw" style="background:' + MAL + '"></i>✖ Cancelado o devuelto <b>' + can + '</b></span></div>' +
      '<svg class="tb-svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Carga de trabajo">' + g + '</svg>';
  }

  const metodo = h => { const p = (h.payments || [])[0], m = p && p.method; return h.debt > 0 ? '📝 Fiado' : m === 'efectivo' ? '💵 Efectivo' : m ? '📲 ' + (p.note && !/venta|pag[oó]/i.test(p.note) ? p.note : 'Digital') : ''; };
  const estado = h => (h.devoluciones || []).length ? ['DEVOLUCIÓN', 'mal'] : h.debt > 0 ? ['FIADO', 'ojo'] : ['FINALIZADO', 'bien'];
  const fecha = h => { const d = new Date(t0(h)); return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); };
  function movimientos(H){
    if(!H.length) return '<div class="tb-vacio">Aquí verás cada venta apenas se cobre.</div>';
    return '<div class="tb-mov-wrap"><button type="button" class="tb-flecha" data-mov="-1" aria-label="Anteriores">‹</button><div class="tb-mov" tabindex="0">' + H.slice(0, 12).map(h => { const e = estado(h);
      return '<div class="tb-mv"><div class="tb-mv-l">' + esc(lugar(h)) + '</div><div class="tb-mv-o">Orden ' + esc(orden(h)) + '</div><span class="tb-chip ' + e[1] + '">' + e[0] + '</span><b class="tb-mv-v">' + esc(plata(h.total)) + '</b><small>' + esc(fecha(h)) + (metodo(h) ? ' · ' + esc(metodo(h)) : '') + '</small></div>'; }).join('') +
      '</div><button type="button" class="tb-flecha" data-mov="1" aria-label="Siguientes">›</button></div>';
  }
  const POR_PAG = 8;
  function tabla(H, pag){
    if(!H.length) return '<div class="tb-vacio">No hay órdenes en este período.</div>';
    const n = Math.ceil(H.length / POR_PAG); pag = Math.max(1, Math.min(n, pag || 1));
    const F = H.slice((pag - 1) * POR_PAG, pag * POR_PAG);
    const nums = []; for(let i = Math.max(1, pag - 2); i <= Math.min(n, pag + 2); i++) nums.push(i);
    return '<div class="tb-tabla-wrap"><table class="tb-tabla"><thead><tr><th>Orden</th><th>Dónde</th><th class="num">Precio</th><th>Fecha</th><th>Estatus</th></tr></thead><tbody>' +
      F.map(h => { const e = estado(h); return '<tr><td><b>' + esc(orden(h)) + '</b></td><td>' + esc(lugar(h)) + '</td><td class="num">' + esc(plata(h.total)) + '</td><td>' + esc(fecha(h)) + '</td><td><span class="tb-chip ' + e[1] + '">' + e[0] + '</span></td></tr>'; }).join('') +
      '</tbody></table></div><div class="tb-pag" role="navigation" aria-label="Páginas"><button type="button" data-pag="' + (pag - 1) + '"' + (pag <= 1 ? ' disabled' : '') + '>‹ Anterior</button>' +
      nums.map(i => '<button type="button" data-pag="' + i + '"' + (i === pag ? ' class="on" aria-current="page"' : '') + '>' + i + '</button>').join('') +
      '<button type="button" data-pag="' + (pag + 1) + '"' + (pag >= n ? ' disabled' : '') + '>Siguiente ›</button><small>' + H.length + ' órdenes · página ' + pag + ' de ' + n + '</small></div>';
  }
  // «Lo que ve Laya»: solo cifras que salen de las ventas guardadas.
  function laya(r, T, P, B, top, est){
    const L = [];
    if(!T.n) return L;
    const pico = B.reduce((m, c) => (c.mesas + c.caja) > (m ? m.mesas + m.caja : 0) ? c : m, null);
    if(pico && pico.mesas + pico.caja > 0) L.push((r.per === 'hoy' ? '🕒 La hora más fuerte fue ' : r.per === 'todo' ? '📅 El mejor mes fue ' : '📅 El mejor día fue ') + pico.t + ' con ' + plata(pico.mesas + pico.caja) + '.');
    if(top[0] && !top[0].otros) L.push('🏆 Lo que más salió: ' + top[0].n + ' (' + fmtQ(top[0].q) + ' u, ' + plata(top[0].v) + ').');
    if(P && P.ing) { const c = cambio(T.ing, P.ing); L.push((c.dir >= 0 ? '📈 Vendiste ' : '📉 Vendiste ') + c.txt + (c.dir > 0 ? ' más' : c.dir < 0 ? ' menos' : ' igual') + ' que ' + r.vs.replace(/^vs\. /, '') + ' (' + plata(P.ing) + ').'); }
    if(T.ing) L.push('🧾 El ' + Math.round(T.caja / T.ing * 100) + '% entró por caja y el ' + Math.round(T.mesas / T.ing * 100) + '% por ' + (typeof espacioN === 'function' ? (() => { try{ return String(espacioN()).toLowerCase() + 's'; }catch(e){ return 'mesas'; } })() : 'mesas') + '.');
    if(est) L.push('🔮 Estimado al cierre: ' + plata(T.ing + est.resto) + ' (ESTIMADO con ' + est.semanas + ' ' + est.dia + ' anteriores; no es una cifra real).');
    if(T.fiado > 0) L.push('📝 Quedaron fiados ' + plata(T.fiado) + '.');
    return L.slice(0, 5);
  }

  // ---------- Pintar ----------
  let ultimoPer = 'hoy', pagina = 1;
  function pintar(per){
    const box = $('tableroVento'), d = D(); if(!box || !d) return;
    if(per && per !== ultimoPer) pagina = 1;
    ultimoPer = per || ultimoPer;
    const r = rango(ultimoPer), H = ventas(r.desde, r.hasta).sort((a, b) => t0(b) - t0(a)), T = totales(H);
    const P = r.previo ? totales(ventas(r.previo[0], r.previo[1])) : null;
    const pal = claro() ? PAL.claro : PAL.oscuro;
    box.classList.toggle('tb-claro', pal === PAL.claro);
    const B = cubetas(r, H), est = r.per === 'hoy' ? estimado(B) : null, top = masVendidos(H);
    const ancho = (box.clientWidth || 360);
    const anchoGraf = ancho >= 900 ? ancho * 8 / 12 - 48 : ancho - 34, anchoCarga = ancho >= 900 ? ancho / 2 - 48 : ancho - 34;
    const per2 = { hoy: 'por hora', '7': 'por día', '30': 'por día', todo: 'por mes' }[r.per];
    const L = laya(r, T, P, B, top, est);
    box.innerHTML =
      '<div class="tb-kpis">' +
        kpi('pedidos', pal[0], 'Pedidos totales', T.n.toLocaleString('es-CO'), P && cambio(T.n, P.n), r.vs, 'cuentas cobradas') +
        kpi('ingresos', pal[2], 'Ingresos totales', plata(T.ing), P && cambio(T.ing, P.ing), r.vs, 'todo lo cobrado') +
        kpi('ticket', pal[1], 'Ticket promedio', plata(T.ticket), P && cambio(T.ticket, P.ticket), r.vs, 'por cuenta') +
        kpi('productos', pal[4], 'Productos vendidos', fmtQ(T.u), P && cambio(T.u, P.u), r.vs, 'unidades') +
      '</div><div class="tb-grid">' +
      tarjeta('tb-ing', '📈 Ingresos ' + per2,
        '<div class="tb-dos"><div><small><i class="tb-sw" style="background:' + pal[0] + '"></i>Ingresos totales en ' + esc((() => { try{ return String(espacioN()).toLowerCase() + 's'; }catch(e){ return 'mesas'; } })()) + '</small><b>' + esc(plata(T.mesas)) + '</b></div>' +
        '<div><small><i class="tb-sw" style="background:' + pal[1] + '"></i>Ingresos totales en caja</small><b>' + esc(plata(T.caja)) + '</b></div>' +
        (est ? '<div class="tb-est-box"><small><i class="tb-sw tb-sw-est"></i>Estimado al cierre</small><b>' + esc(plata(T.ing + est.resto)) + '</b><em>ESTIMADO</em></div>' : '') + '</div>' +
        graficaIngresos(B, est, pal, anchoGraf) +
        (est ? '<p class="tb-nota">La línea punteada es un <b>estimado</b>: el promedio de los últimos ' + est.semanas + ' ' + esc(est.dia) + ' a esa hora. No es plata que ya entró.</p>' : ''), 'SALES//01') +
      tarjeta('tb-mas', '🏆 Productos más vendidos', dona(top, pal), 'STOCK//02') +
      tarjeta('tb-carga', '🛠️ Carga de trabajo', barrasCarga(B, anchoCarga), 'OPS//03') +
      tarjeta('tb-movs', '⚡ Últimos movimientos', movimientos(H), 'LIVE//04') +
      (L.length ? tarjeta('tb-laya', '🧠 Lo que ve Laya', '<ul class="tb-laya-l">' + L.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><p class="tb-nota">Cifras de tus ventas guardadas. Lo estimado siempre dice «estimado».</p>', 'LAYA//05') : '') +
      tarjeta('tb-ord', '🧾 Órdenes recientes', '<div class="tb-ord-body">' + tabla(H, pagina) + '</div>', 'VAULT//06') +
      '</div>';
    const plot = box.querySelector('.tb-plot');
    if(plot){
      // misma escala que la gráfica, para poner los puntos del cruce
      const ar = 14, h = 230 - ar - 26;
      let max = 0; B.forEach(c => { max = Math.max(max, c.mesas, c.caja, est && c.hora != null && c.hora > est.ahoraH ? est.porHora[c.hora] : 0); }); if(!max) max = 1;
      const paso = Math.pow(10, Math.floor(Math.log10(max))), tope = Math.ceil(max / paso / 2) * paso * 2 || 1;
      plot._Y = v => ar + h - v / tope * h;
      cruce(plot, B, est, pal);
    }
    box.querySelectorAll('.tb-top li').forEach(li => {
      const seg = box.querySelector('.tb-dona circle[data-i="' + li.dataset.i + '"]');
      li.addEventListener('pointerenter', () => { if(seg) seg.classList.add('on'); box.querySelector('.tb-dona').classList.add('foco'); });
      li.addEventListener('pointerleave', () => { if(seg) seg.classList.remove('on'); box.querySelector('.tb-dona').classList.remove('foco'); });
    });
    box._H = H;
  }
  function clic(e){
    const box = $('tableroVento'); if(!box) return;
    const p = e.target.closest('[data-pag]');
    if(p && !p.disabled){ pagina = +p.dataset.pag; const b = box.querySelector('.tb-ord-body'); if(b) b.innerHTML = tabla(box._H || [], pagina); return; }
    const m = e.target.closest('[data-mov]');
    if(m){ const l = box.querySelector('.tb-mov'); if(l) l.scrollBy({ left: +m.dataset.mov * Math.max(200, l.clientWidth * 0.8), behavior: 'smooth' }); }
  }

  // ---------- Estilos («apariencia» del tablero de referencia, con los colores de la paleta de ORDEVA) ----------
  function estilos(){
    if($('tbCss')) return;
    const s = document.createElement('style'); s.id = 'tbCss';
    s.textContent =
      '#tableroVento{display:flex;flex-direction:column;gap:14px;margin:6px 0 18px;--tb-bg:color-mix(in srgb,var(--surface) 88%,var(--amber) 12%)}' +
      '#tableroVento .tb-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}' +
      '#tableroVento .tb-kpi,#tableroVento .tb-card{background:linear-gradient(160deg,var(--tb-bg),var(--surface) 70%);border:1px solid var(--line);border-radius:18px;box-shadow:0 10px 28px rgba(0,0,0,.18);min-width:0}' +
      '#tableroVento .tb-kpi{padding:14px 16px;display:flex;flex-direction:column;gap:8px}' +
      '#tableroVento .tb-kpi-top{display:flex;align-items:center;gap:10px}' +
      '#tableroVento .tb-ico{flex:0 0 auto;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c)}' +
      '#tableroVento .tb-ico svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
      '#tableroVento .tb-kpi-l{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}' +
      '#tableroVento .tb-kpi-v{font-size:clamp(20px,5.2vw,30px);font-weight:900;color:var(--ink);line-height:1.1;overflow-wrap:anywhere}' +
      '#tableroVento .tb-kpi-pie{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--ink-soft)}' +
      '#tableroVento .tb-cambio{padding:2px 8px;border-radius:999px;font-weight:900;font-size:12px}' +
      '#tableroVento .tb-cambio.sube{background:color-mix(in srgb,#0ca30c 18%,transparent);color:var(--ink)}#tableroVento .tb-cambio.sube::first-letter{color:#0ca30c}' +
      '#tableroVento .tb-cambio.baja{background:color-mix(in srgb,#d03b3b 18%,transparent);color:var(--ink)}#tableroVento .tb-cambio.igual{background:var(--surface-2);color:var(--ink)}' +
      '#tableroVento .tb-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}' +
      '#tableroVento .tb-card{padding:14px 16px;grid-column:span 12;position:relative}' +
      '@media (min-width:900px){#tableroVento .tb-ing{grid-column:span 8}#tableroVento .tb-mas{grid-column:span 4}#tableroVento .tb-carga,#tableroVento .tb-movs{grid-column:span 6}}' +
      '@media (max-width:700px){#tableroVento .tb-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#tableroVento .tb-kpi{padding:12px}}' +
      '#tableroVento .tb-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}#tableroVento .tb-card-h h3{margin:0;font-size:16px;font-weight:900;color:var(--ink)}' +
      '#tableroVento .tb-cod{display:block;font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.32em;color:var(--ink-soft);margin-bottom:2px}' +
      /* Apariencia neón (como el tablero de referencia), solo con las paletas oscuras: borde cian con brillo, cuadrícula de fondo y el código de cada tarjeta en cian */
      '#tableroVento:not(.tb-claro) .tb-kpi,#tableroVento:not(.tb-claro) .tb-card{background:linear-gradient(rgba(34,211,238,.035) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(90deg,rgba(34,211,238,.035) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(160deg,#0b1220,#0a0a12 70%);border-color:rgba(34,211,238,.28);box-shadow:0 0 0 1px rgba(34,211,238,.06),0 0 22px rgba(34,211,238,.08),0 10px 28px rgba(0,0,0,.35)}' +
      '#tableroVento:not(.tb-claro) .tb-cod{color:#22d3ee;text-shadow:0 0 8px rgba(34,211,238,.55)}' +
      '#tableroVento:not(.tb-claro) .tb-kpi-v{text-shadow:0 0 14px rgba(255,255,255,.12)}' +
      '#tableroVento:not(.tb-claro) .tb-kpi:nth-child(2){border-color:rgba(236,72,153,.32);box-shadow:0 0 22px rgba(236,72,153,.08),0 10px 28px rgba(0,0,0,.35)}' +
      '#tableroVento:not(.tb-claro) .tb-pag button.on{background:#22d3ee;border-color:#22d3ee;color:#04121a;box-shadow:0 0 12px rgba(34,211,238,.5)}' +
      '#tableroVento .tb-dos{display:flex;flex-wrap:wrap;gap:10px 22px;margin-bottom:6px}#tableroVento .tb-dos>div{display:flex;flex-direction:column;gap:2px}' +
      '#tableroVento .tb-dos small{font-size:12px;color:var(--ink-soft);display:flex;align-items:center;gap:6px}#tableroVento .tb-dos b{font-size:20px;color:var(--ink)}' +
      '#tableroVento .tb-est-box em{font-style:normal;font-size:10px;font-weight:900;letter-spacing:.08em;color:var(--ink-soft);border:1px dashed var(--ink-soft);border-radius:6px;padding:1px 6px;align-self:flex-start}' +
      '#tableroVento .tb-sw{display:inline-block;width:10px;height:10px;border-radius:3px;flex:0 0 auto}#tableroVento .tb-sw-est{background:transparent;border:2px dashed var(--ink-soft);width:8px;height:8px}' +
      '#tableroVento .tb-plot{position:relative}#tableroVento .tb-svg{display:block;overflow:visible;touch-action:pan-y}' +
      '#tableroVento line.tb-gl{stroke:var(--line);stroke-width:1}#tableroVento .tb-eje{fill:var(--ink-soft);font-size:11px;font-family:var(--font-main)}' +
      '#tableroVento .tb-l{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}#tableroVento .tb-est{fill:none;stroke:var(--ink-soft);stroke-width:2;stroke-dasharray:5 5}' +
      '#tableroVento .tb-cruz{stroke:var(--ink-soft);stroke-width:1;stroke-dasharray:3 3}#tableroVento .tb-pt{stroke:var(--surface);stroke-width:2}#tableroVento .tb-pt[cx="-9"],#tableroVento .tb-cruz[x1="-9"]{visibility:hidden}' +
      '#tableroVento .tb-tip{position:absolute;z-index:2;min-width:150px;padding:9px 11px;border-radius:12px;background:var(--surface-2);border:1px solid var(--line);color:var(--ink);font-size:12px;box-shadow:0 10px 24px rgba(0,0,0,.3);pointer-events:none;display:flex;flex-direction:column;gap:3px}' +
      '#tableroVento .tb-tip div{display:flex;align-items:center;gap:6px}#tableroVento .tb-tip div b{margin-left:auto}#tableroVento .tb-tip-t{border-top:1px solid var(--line);padding-top:4px;margin-top:2px}#tableroVento .tb-tip small{color:var(--ink-soft)}' +
      '#tableroVento .tb-nota{margin:6px 0 0;font-size:12px;color:var(--ink-soft)}' +
      '#tableroVento .tb-dona{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px}#tableroVento .tb-dona svg{flex:0 0 auto}' +
      '#tableroVento .tb-dona circle{transition:opacity .15s}#tableroVento .tb-dona.foco circle{opacity:.35}#tableroVento .tb-dona.foco circle.on{opacity:1}' +
      '#tableroVento .tb-dona-n{fill:var(--ink);font-size:24px;font-weight:900;font-family:var(--font-main)}' +
      '#tableroVento .tb-top{list-style:none;margin:0;padding:0;flex:1 1 180px;min-width:0;display:flex;flex-direction:column;gap:6px}' +
      '#tableroVento .tb-top li{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px}#tableroVento .tb-top li:hover{background:var(--surface-2)}' +
      '#tableroVento .tb-top-n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--ink)}' +
      '#tableroVento .tb-top-v{display:flex;flex-direction:column;align-items:flex-end;font-size:13px;color:var(--ink)}#tableroVento .tb-top-v small{font-size:11px;color:var(--ink-soft)}' +
      '#tableroVento .tb-ley{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--ink-soft);margin-bottom:6px}#tableroVento .tb-ley span{display:flex;align-items:center;gap:6px}#tableroVento .tb-ley b{color:var(--ink)}' +
      '#tableroVento .tb-bar:hover rect{fill:color-mix(in srgb,var(--ink) 6%,transparent)}' +
      '#tableroVento .tb-mov-wrap{display:flex;align-items:center;gap:6px}#tableroVento .tb-mov{flex:1;min-width:0;display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 8px;scrollbar-width:thin}' +
      '#tableroVento .tb-mv{scroll-snap-align:start;flex:0 0 170px;display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px;background:var(--surface-2);border:1px solid var(--line)}' +
      '#tableroVento .tb-mv-l{font-weight:900;color:var(--ink);font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#tableroVento .tb-mv-o{font-size:12px;color:var(--ink-soft)}' +
      '#tableroVento .tb-mv-v{font-size:20px;color:var(--ink)}#tableroVento .tb-mv small{font-size:11px;color:var(--ink-soft)}' +
      '#tableroVento .tb-flecha{flex:0 0 auto;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);font-size:20px;cursor:pointer}' +
      '@media (max-width:600px){#tableroVento .tb-flecha{display:none}}' +
      '#tableroVento .tb-chip{align-self:flex-start;display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.06em;border:1px solid}' +
      '#tableroVento .tb-chip.bien{color:var(--ink);border-color:#0ca30c;background:color-mix(in srgb,#0ca30c 16%,transparent)}' +
      '#tableroVento .tb-chip.ojo{color:var(--ink);border-color:#fab219;background:color-mix(in srgb,#fab219 16%,transparent)}' +
      '#tableroVento .tb-chip.mal{color:var(--ink);border-color:#d03b3b;background:color-mix(in srgb,#d03b3b 16%,transparent)}' +
      '#tableroVento .tb-tabla-wrap{overflow-x:auto}#tableroVento .tb-tabla{width:100%;border-collapse:collapse;font-size:13px;min-width:460px}' +
      '#tableroVento .tb-tabla th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);font-weight:800;padding:8px;border-bottom:1px solid var(--line)}' +
      '#tableroVento .tb-tabla td{padding:9px 8px;border-bottom:1px solid var(--line);color:var(--ink);white-space:nowrap}#tableroVento .tb-tabla .num{text-align:right;font-variant-numeric:tabular-nums}' +
      '#tableroVento .tb-tabla tbody tr:hover td{background:var(--surface-2)}' +
      '#tableroVento .tb-pag{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}#tableroVento .tb-pag small{margin-left:auto;font-size:12px;color:var(--ink-soft)}' +
      '#tableroVento .tb-pag button{min-width:36px;min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
      '#tableroVento .tb-pag button.on{background:var(--amber);border-color:var(--amber);color:#fff}#tableroVento .tb-pag button:disabled{opacity:.4;cursor:default}' +
      '#tableroVento .tb-laya-l{margin:0;padding-left:4px;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--ink)}' +
      '#tableroVento .tb-vacio{padding:18px 8px;text-align:center;color:var(--ink-soft);font-size:14px}';
    document.head.appendChild(s);
  }

  function iniciar(){
    estilos();
    const box = $('tableroVento');
    if(box && !box._tb){ box._tb = true; box.addEventListener('click', clic); }
  }
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const b = $('tableroVento'); if(b && b.offsetParent && b.innerHTML) try{ pintar(); }catch(e){} }, 250); });
  window.ventoTablero = { pintar: per => { iniciar(); pintar(per); }, rango, cubetas, estimado, totales, ventas };
  if(document.readyState !== 'loading') iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
