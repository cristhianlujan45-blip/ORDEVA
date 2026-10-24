/* ORDEVA · app/18-laya-asistente-cerebro.js — antes estaba dentro de index.html (línea 30924). Se carga en el mismo lugar y orden. */
/* ================= LAYA IA — el asistente y el cerebro de ORDEVA =================
   ORDEVA responde y actúa con los DATOS REALES del negocio: facturas, inventario, proveedores, costos,
   IVA, pedidos, pantalla de preparación y música. Nunca inventa: si un dato no está, lo dice.
   • Motor local (este bloque): entiende frases en español natural («ORDEVA, ¿cuánto IVA pagué este
     mes?», «¿qué hay en la barra?», «busca productos duplicados»), calcula y responde al instante,
     también sin internet. Propone acciones (unir duplicados, marcar pedidos, saltar canciones,
     aplicar la factura) y para lo importante pide confirmación antes de hacerlo.
   • Facturas e imágenes: la cámara + el lector de ORDEVA (sin internet) o la IA de visión que el
     negocio conecte en ⚙️ Configurar IA. ORDEVA cuadra cantidades, cajas, IVA y costos (fiCuadrar).
   • Motor de decisiones ORDEVA (opcional, puente/laya-worker.js): desempata productos parecidos.
   • Avisos: stock bajo o agotado, duplicados, cambios de precio, facturas con errores, pedidos
     esperando, canciones que no sonaron y problemas de conexión — pocos y sin repetirse. */
(function(){
  const listo = () => typeof data !== 'undefined' && data && Array.isArray(data.products);
  const N = s => normVoiceText(String(s == null ? '' : s));
  const plata = n => fmt(Math.round(n || 0));
  const DIA = 864e5;
  const bul = arr => arr.map(x => '• ' + x).join('\n');
  const fechaTxt = f => { const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(f)) ? f + 'T12:00' : f); return isNaN(d) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); };
  const cuando = p => { const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '')) ? p.date + 'T12:00' : (p.date || p.at)); return isNaN(t) ? Date.parse(p.at) || 0 : t; };

  // ---------- Periodo pedido en la frase ----------
  function rango(t){
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const h = d0.getTime();
    if(/\bhoy\b/.test(t)) return { desde: h, hasta: Date.now() + 1, nom: 'hoy' };
    if(/\bayer\b/.test(t)) return { desde: h - DIA, hasta: h, nom: 'ayer' };
    if(/\b(esta semana|la semana|semanal|ultimos 7 dias|7 dias)\b/.test(t)) return { desde: Date.now() - 7 * DIA, hasta: Date.now() + 1, nom: 'en los últimos 7 días' };
    if(/\b(mes pasado|el mes anterior)\b/.test(t)){ const a = new Date(d0); a.setDate(1); const b = new Date(a); b.setMonth(b.getMonth() - 1); return { desde: b.getTime(), hasta: a.getTime(), nom: 'el mes pasado' }; }
    if(/\b(este mes|del mes|el mes|mensual|en el mes)\b/.test(t)){ const a = new Date(d0); a.setDate(1); return { desde: a.getTime(), hasta: Date.now() + 1, nom: 'en lo que va del mes' }; }
    if(/\b(este ano|del ano|el ano|anual)\b/.test(t)){ const a = new Date(d0.getFullYear(), 0, 1); return { desde: a.getTime(), hasta: Date.now() + 1, nom: 'en lo que va del año' }; }
    if(/\b(ultima factura|la factura)\b/.test(t)) return { ultima: true, nom: 'en la última factura' };
    return null;
  }
  // ---------- Compras / facturas ----------
  function compras(r){
    const l = (data.purchases || []).slice().sort((a, b) => cuando(b) - cuando(a));
    if(!r) return l; if(r.ultima) return l.slice(0, 1);
    return l.filter(p => { const t = cuando(p); return t >= r.desde && t < r.hasta; });
  }
  const totItem = i => i.total != null ? i.total : (i.qty || 0) * (i.cost || 0);
  const ivaItem = i => i.ivaTotal != null ? i.ivaTotal : (() => { const t = totItem(i), r = (i.taxRate || 0) / 100; return r > 0 ? t - t / (1 + r) : 0; })();
  const sinIvaU = i => i.costoUnitSinIva != null ? i.costoUnitSinIva : (i.cost || 0) / (1 + (i.taxRate || 0) / 100);
  function resumenCompras(r){
    const l = compras(r); let total = 0, iva = 0, und = 0;
    l.forEach(p => (p.items || []).forEach(i => { total += totItem(i); iva += ivaItem(i); und += i.qty || 0; }));
    return { n: l.length, total, iva, sub: total - iva, und, l };
  }
  function historialDe(prod){                // compras de un producto, de la más vieja a la más nueva
    const out = [];
    (data.purchases || []).forEach(p => (p.items || []).forEach(i => {
      if(i.productId === prod.id || N(i.name) === N(prod.name)) out.push({ t: cuando(p), prov: p.supplier || '', fact: p.invoiceNumber || '', qty: i.qty, cost: i.cost, sin: sinIvaU(i), iva: (i.cost || 0) - sinIvaU(i), tasa: i.taxRate || 0 });
    }));
    return out.sort((a, b) => a.t - b.t);
  }
  function cambiosPrecio(){
    return data.products.map(p => { const h = historialDe(p); if(h.length < 2) return null; const a = h[h.length - 2], b = h[h.length - 1];
      if(!(a.cost > 0) || Math.abs(b.cost - a.cost) < 1) return null; return { p, de: a.cost, a: b.cost, pct: Math.round((b.cost - a.cost) / a.cost * 100), prov: b.prov, t: b.t }; })
      .filter(Boolean).sort((x, y) => y.pct - x.pct);
  }
  function proveedores(){
    const m = {};
    (data.purchases || []).forEach(p => { const k = (p.supplier || 'Sin proveedor').trim(); const x = m[k] = m[k] || { nombre: k, total: 0, iva: 0, n: 0, ult: 0, prods: new Set() };
      x.n++; x.ult = Math.max(x.ult, cuando(p)); (p.items || []).forEach(i => { x.total += totItem(i); x.iva += ivaItem(i); x.prods.add(i.name); }); });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }
  function buscarProveedor(t){
    const ps = proveedores(); let mejor = null, sc = 0;
    ps.forEach(x => { const pal = N(x.nombre).split(' ').filter(w => w.length >= 4 && !/^(s a s|sas|ltda|distribuidora|comercializadora)$/.test(w)); const s = pal.filter(w => t.includes(w)).length; if(s > sc){ sc = s; mejor = x; } });
    return mejor;
  }
  // ---------- Productos ----------
  // Producto nombrado en la frase: el que más palabras propias (marca, sabor, tamaño) comparte con ella.
  const prodDe = t => {
    const pal = new Set(t.split(' ').filter(w => w.length >= 3));
    let mejor = null, sc = 0;
    data.products.forEach(p => { const f = firma(p); const ws = f.pal.map(w => w.toLowerCase());
      const hit = ws.filter(w => pal.has(w) || [...pal].some(v => v.length >= 4 && w.length >= 4 && fiLev(v, w) <= 1)).length;
      const s2 = hit + (f.tam && t.includes(String(f.tam).replace(/[a-z]+$/, '')) ? 0.5 : 0) - ws.length * 0.01;
      if(hit && s2 > sc){ sc = s2; mejor = p; } });
    if(mejor) return mejor;
    try{ return asisFindProduct(t); }catch(e){ return null; }
  };
  const agotados = () => data.products.filter(p => !p.combo && invStatus(p) === 'out');
  const bajos = () => data.products.filter(p => !p.combo && invStatus(p) === 'low');
  const GENERICAS = new Set(['CERVEZA', 'LATA', 'BOTELLA', 'UND', 'UNIDAD', 'X', 'DE', 'LA', 'EL', 'CON', 'SIN', 'PET', 'VIDRIO', 'ML', 'G', 'L', 'KG', 'CC', 'GR', 'PAQUETE', 'CAJA']);
  function firma(p){
    const n = fiNormalizar((p.name || '') + ' ' + (p.size || ''));
    const pal = n.palabras.filter(w => !GENERICAS.has(w) && !/^\d/.test(w));
    const tam = n.pres && n.pres.contenido != null ? n.pres.contenido + (n.pres.unidadContenido || '') : '';
    return { pal, tam, marca: n.marca || '' };
  }
  // Duplicados: los idénticos (mismo nombre normalizado) y los muy parecidos (misma presentación y casi
  // las mismas palabras, ej. «Cerveza Águila 330 ml», «Aguila 330ML», «Cerveza Aguila Lata 330 ml»).
  function duplicados(){
    const ps = data.products.filter(p => !p.combo), grupos = [], usado = new Set();
    const fs = ps.map(p => [p, firma(p)]);
    for(let i = 0; i < fs.length; i++){
      if(usado.has(fs[i][0].id)) continue;
      const g = [fs[i][0]], [, a] = fs[i]; let conf = 100;
      for(let j = i + 1; j < fs.length; j++){
        const [q, b] = fs[j]; if(usado.has(q.id)) continue;
        if(a.tam !== b.tam) continue;
        const A = new Set(a.pal), B = new Set(b.pal); if(!A.size || !B.size) continue;
        const inter = [...A].filter(w => B.has(w) || [...B].some(v => v.length >= 4 && w.length >= 4 && fiLev(w, v) <= 1)).length;
        const jac = inter / (A.size + B.size - inter);
        if(jac >= 0.99 || (jac >= 0.66 && (a.tam || a.marca && a.marca === b.marca))){ g.push(q); usado.add(q.id); conf = Math.min(conf, Math.round(70 + jac * 30) - (a.tam ? 0 : 10)); }
      }
      if(g.length > 1){ usado.add(fs[i][0].id); grupos.push({ productos: g, conf }); }
    }
    return grupos;
  }
  // ---------- Pedidos, preparación, música ----------
  const P = () => window.vitoPedidos;
  const pedidos = () => (P() ? P().lista() : []);
  const activos = () => pedidos().filter(p => ['nuevo', 'recibido', 'preparacion', 'listo'].includes(p.estado));
  const txtPed = p => tableLabel(p.mesa) + ': ' + p.items.map(i => i.qty + ' ' + i.name).join(', ') + ' (' + (P() ? P().EST[p.estado] : p.estado) + ')';
  const M = () => window.vitoMusica || null;

  // ---------- Informes ----------
  const INFORMES = {
    inventario(){ const ps = data.products.filter(p => !p.combo), con = ps.filter(p => p.stock != null);
      const valor = con.reduce((s, p) => s + Math.max(0, p.stock) * (p.cost || 0), 0);
      return '📦 Inventario: ' + ps.length + ' productos, ' + con.length + ' con control de stock. Valor a costo: ' + plata(valor) + '.\n' +
        bul([agotados().length + ' agotados' + (agotados().length ? ' (' + agotados().slice(0, 5).map(p => p.name).join(', ') + ')' : ''), bajos().length + ' por agotarse' + (bajos().length ? ' (' + bajos().slice(0, 5).map(p => p.name + ': ' + p.stock).join(', ') + ')' : ''), duplicados().length + ' grupo(s) de productos repetidos']); },
    facturas(r){ const x = resumenCompras(r); if(!x.n) return 'No hay facturas aplicadas' + (r ? ' ' + r.nom : '') + '.';
      return '🧾 Facturas' + (r ? ' ' + r.nom : '') + ': ' + x.n + ' por ' + plata(x.total) + ' (sin IVA ' + plata(x.sub) + ' + IVA ' + plata(x.iva) + ').\n' + bul(x.l.slice(0, 8).map(p => (p.supplier || 'Proveedor') + (p.invoiceNumber ? ' #' + p.invoiceNumber : '') + ' · ' + fechaTxt(p.date || p.at) + ' · ' + plata(p.total))); },
    compras(r){ const x = resumenCompras(r); if(!x.n) return 'No hay compras registradas' + (r ? ' ' + r.nom : '') + '.';
      const top = {}; x.l.forEach(p => (p.items || []).forEach(i => { top[i.name] = (top[i.name] || 0) + totItem(i); }));
      return '🛒 Compras' + (r ? ' ' + r.nom : '') + ': ' + plata(x.total) + ' en ' + x.n + ' factura(s), ' + Math.round(x.und) + ' unidades.\nEn lo que más gastaste:\n' + bul(Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ': ' + plata(v))); },
    iva(r){ const x = resumenCompras(r); if(!x.n) return 'No hay facturas' + (r ? ' ' + r.nom : '') + ' para calcular el IVA.';
      return '🧮 IVA pagado en compras' + (r ? ' ' + r.nom : '') + ': ' + plata(x.iva) + ' (sobre ' + plata(x.sub) + ' sin IVA; total ' + plata(x.total) + ', ' + x.n + ' factura' + (x.n === 1 ? '' : 's') + ').'; },
    costos(){ const l = data.products.filter(p => p.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 8);
      if(!l.length) return 'Todavía no hay costos guardados. Llegan solos al aplicar una factura.';
      return '💰 Lo que más te cuesta por unidad (con IVA):\n' + bul(l.map(p => p.name + ': ' + plata(p.cost) + (p.costSinIva ? ' (' + plata(p.costSinIva) + ' sin IVA)' : '') + (p.price ? ' · lo vendes a ' + plata(p.price) + (p.price < p.cost ? ' ⚠️ pierdes' : '') : ''))); },
    nuevos(){ const lim = Date.now() - 30 * DIA, l = data.products.filter(p => { const m = /(\d{12,13})/.exec(String(p.id)); return m && +m[1] >= lim; });
      return l.length ? '🆕 Productos nuevos (últimos 30 días): ' + l.length + '\n' + bul(l.slice(-10).map(p => p.name)) : 'No hay productos nuevos en los últimos 30 días.'; },
    agotados(){ const l = agotados(); return l.length ? '🚫 Agotados (' + l.length + '):\n' + bul(l.map(p => p.name)) : 'No hay productos agotados. ✅'; },
    bajos(){ const l = bajos(); return l.length ? '⚠️ Por agotarse (' + l.length + '):\n' + bul(l.map(p => p.name + ': quedan ' + p.stock)) : 'Nada se está agotando. ✅'; },
    precios(){ const l = cambiosPrecio(); if(!l.length) return 'No veo cambios de precio de compra: hace falta al menos dos facturas del mismo producto.';
      const sub = l.filter(x => x.pct > 0), baj = l.filter(x => x.pct < 0);
      return (sub.length ? '📈 Subieron de precio:\n' + bul(sub.slice(0, 8).map(x => x.p.name + ': ' + plata(x.de) + ' → ' + plata(x.a) + ' (+' + x.pct + '%)' + (x.prov ? ' · ' + x.prov : ''))) : 'Ningún producto subió de precio.') +
        (baj.length ? '\n📉 Bajaron:\n' + bul(baj.slice(0, 5).map(x => x.p.name + ': ' + plata(x.de) + ' → ' + plata(x.a) + ' (' + x.pct + '%)')) : ''); },
    proveedores(){ const l = proveedores(); if(!l.length) return 'Todavía no hay compras a proveedores.';
      return '🏭 Compras por proveedor:\n' + bul(l.slice(0, 10).map(x => x.nombre + ': ' + plata(x.total) + ' en ' + x.n + ' factura' + (x.n === 1 ? '' : 's') + ' · última ' + fechaTxt(x.ult))); },
    pedidos(){ const l = pedidos(), hoy = new Date().setHours(0, 0, 0, 0), h = l.filter(p => p.at >= hoy), a = activos();
      return '🛎️ Pedidos de hoy: ' + h.length + ' (' + plata(h.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + p.total, 0)) + '). Pendientes: ' + a.length + '.' + (a.length ? '\n' + bul(a.slice(0, 10).map(txtPed)) : ''); },
    musica(){ const m = M(); if(!m) return 'La música no está disponible en este equipo.';
      const act = m.actual(), cola = m.cola().filter(x => !x.done), h = m.hist(), err = h.filter(x => x.status === 'error' && Date.now() - (x.endedAt || 0) < DIA);
      return '🎵 Música: ' + (act ? 'suena «' + (act.title || act.song) + '» (' + tableLabel(act.mesa) + ')' : 'no está sonando nada') + '. En cola: ' + cola.length + '.' +
        (cola.length ? '\n' + bul(cola.slice(0, 6).map((x, i) => (i + 1) + '. ' + (x.title || x.song) + ' · ' + tableLabel(x.mesa))) : '') + (err.length ? '\n⚠️ Hoy no se pudieron reproducir: ' + err.map(x => x.title || x.song).join(', ') : '') +
        '\nModo: ' + (m.tv() ? 'TV' : m.auto() ? 'automático en este celular' : 'manual (YouTube Music)') + '.'; },
    preparacion(){ const n = prepNombre(); if(!prepOn()) return 'La pantalla de preparación está desactivada. Los pedidos llegan directo a las cuentas.';
      const a = activos(); if(!a.length) return 'En ' + n + ' no hay pedidos pendientes. 🎉';
      const por = e => a.filter(p => p.estado === e);
      return '🍳 ' + n + ': ' + a.length + ' pedido(s).\n' + bul([['nuevo', 'Por aceptar'], ['recibido', 'Recibidos'], ['preparacion', 'En preparación'], ['listo', 'Listos para entregar']].filter(([e]) => por(e).length).map(([e, t]) => t + ': ' + por(e).map(p => tableLabel(p.mesa) + ' (' + p.items.map(i => i.qty + ' ' + i.name).join(', ') + ')').join('; '))); },
    general(r){ return [INFORMES.inventario(), INFORMES.compras(r || rango('este mes')), INFORMES.precios(), INFORMES.pedidos(), INFORMES.preparacion(), INFORMES.musica()].join('\n\n'); }
  };

  const U = () => getServiceUnitName(), UP = () => getServiceUnitNamePlural();
  const art = () => espacio()[3] === 'm' ? 'el' : 'la', arts = () => espacio()[3] === 'm' ? 'los' : 'las';
  // ---------- Terminología: «silla 4», «cabina 2», «habitación 3», «puesto VIP 1» → mesa N ----------
  // (Por dentro las unidades se llaman igual; así ORDEVA y la voz entienden el nombre que use el negocio.)
  function normUnidad(t){
    const sg = N(getServiceUnitName()), pl = N(getServiceUnitNamePlural());
    const seguros = ['silla', 'cabina', 'habitacion', 'sala', 'pista', 'puesto', 'consultorio', 'estacion', 'cancha', 'espacio'];
    const esc5 = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if(pl && pl !== 'mesas') t = t.replace(new RegExp('\\b' + esc5(pl) + '\\b', 'g'), 'mesas');
    if(sg && sg !== 'mesa') t = t.replace(new RegExp('\\b' + esc5(sg) + '\\b', 'g'), 'mesa');
    t = t.replace(new RegExp('\\b(' + seguros.join('|') + ')s?\\b(?=\\s+(\\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\\b)', 'g'), 'mesa');
    t = t.replace(new RegExp('\\b(' + seguros.map(x => x + 's').concat(['habitaciones', 'estaciones']).join('|') + ')\\b', 'g'), 'mesas');
    if(['cuenta', 'pedido', 'orden', 'caja', 'reserva'].includes(sg)) t = t.replace(new RegExp('\\b' + esc5(sg) + 's?\\s+(\\d+)', 'g'), 'mesa $1');
    return t;
  }
  // Números de unidad nombrados en la frase: «mesa 4 con la 5», «mesas 4, 5 y 6», «la de Juan»
  function unidadesDe(t){
    const NW = typeof NUM_WORDS_VOICE !== 'undefined' ? NUM_WORDS_VOICE : {};
    const out = [], i = t.search(/\bmesas?\b/); if(i < 0) return out;
    t.slice(i).replace(/\b(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince)\b/g, (m, w) => { const n = /^\d+$/.test(w) ? +w : NW[w]; if(n && !out.includes(n)) out.push(n); return m; });
    if(!out.length){ const n = asisMesaNum(t); if(n) out.push(n); }
    return out;
  }
  const G = () => window.vitoGrupos;
  // ---------- Registro de actividad de ORDEVA (trazabilidad) ----------
  function registrar(clase, txt){
    if(!listo()) return;
    data.layaLog = Array.isArray(data.layaLog) ? data.layaLog : [];
    data.layaLog.push({ t: Date.now(), clase, txt: String(txt || '').slice(0, 240), usuario: (typeof authUser !== 'undefined' && authUser) || '—' });
    if(data.layaLog.length > 800) data.layaLog = data.layaLog.slice(-600);
    try{ saveData(); }catch(e){}
  }
  const esAdminL = () => { try{ return typeof authIsAdmin !== 'function' || authIsAdmin(); }catch(e){ return true; } };
  // ---------- Estimación de agotamiento (consumo de los últimos 14 días) ----------
  function prediccion(){
    const desde = Date.now() - 14 * DIA, vendido = {};
    (data.history || []).forEach(h => { if(Date.parse(h.date) >= desde) (h.items || []).forEach(i => { vendido[N(i.name)] = (vendido[N(i.name)] || 0) + (Number(i.qty) || 0); }); });
    Object.values(data.tables || {}).forEach(t => (t.items || []).forEach(i => { vendido[N(i.name)] = (vendido[N(i.name)] || 0) + (Number(i.qty) || 0); }));
    return data.products.filter(p => p.stock != null && !p.combo).map(p => { const v = vendido[N(p.name)] || 0, porDia = v / 14; if(!(porDia > 0)) return null;
      return { p, porDia, dias: p.stock / porDia }; }).filter(Boolean).sort((a, b) => a.dias - b.dias);
  }
  // ---------- Tiempos de los pedidos ----------
  function tiempos(){
    const durs = [];
    pedidos().forEach(p => { const a = p.hist.find(h => h.e === 'recibido'), b = p.hist.find(h => h.e === 'listo'); if(a && b && b.at > a.at) durs.push((b.at - a.at) / 6e4); });
    durs.sort((a, b) => a - b); const med = durs.length ? durs[Math.floor(durs.length / 2)] : null;
    const act = activos().map(p => { const ult = p.hist[p.hist.length - 1] || { at: p.at }; const total = (Date.now() - (p.recibidoEn || p.at)) / 6e4;
      return { p, enEstado: Math.round((Date.now() - ult.at) / 6e4), total: Math.round(total), lento: med != null ? total > Math.max(10, med * 2) : total > 20 }; }).sort((a, b) => b.total - a.total);
    return { med, act };
  }
  // ---------- Auditoría inteligente ----------
  function auditoria(){
    const out = [];
    const fs = data.purchases || [], vistas = {};
    fs.forEach(f => { const k1 = N(f.supplier) + '|' + N(f.invoiceNumber), k2 = N(f.supplier) + '|' + Math.round(f.total || 0) + '|' + (f.date || '');
      if(f.invoiceNumber && vistas[k1]) out.push('🧾 Factura posiblemente duplicada: ' + (f.supplier || 'proveedor') + ' #' + f.invoiceNumber + ' (aplicada dos veces).');
      else if(vistas[k2] && f.total > 0) out.push('🧾 Dos facturas de ' + (f.supplier || 'proveedor') + ' con el mismo total (' + plata(f.total) + ') y fecha: ¿es la misma?');
      vistas[k1] = vistas[k2] = 1;
      (f.items || []).forEach(i => { if(!(i.qty > 0) || !(i.cost > 0)) out.push('🧾 ' + (f.supplier || '') + ': «' + i.name + '» quedó con cantidad o costo en cero.');
        if(i.qty > 2000) out.push('🧾 Cantidad extraña: «' + i.name + '» × ' + i.qty + ' en ' + (f.invoiceNumber || 'una factura') + '.'); });
      (f.avisos || []).filter(a => /no cuadra|diferencia/i.test(a)).slice(0, 1).forEach(a => out.push('🧮 ' + (f.invoiceNumber || f.supplier || 'Factura') + ': ' + a));
    });
    const ps = pedidos(); ps.forEach((p, i) => { const dup = ps.slice(Math.max(0, i - 15), i).find(q => q.mesa === p.mesa && q.estado !== 'cancelado' && p.estado !== 'cancelado' && Math.abs(q.at - p.at) < 3 * 6e4 && JSON.stringify(q.items.map(x => [x.name, x.qty])) === JSON.stringify(p.items.map(x => [x.name, x.qty])));
      if(dup) out.push('🛎️ Pedido posiblemente repetido en ' + tableLabel(p.mesa) + ': ' + p.items.map(x => x.qty + ' ' + x.name).join(', ') + '.'); });
    ps.filter(p => !data.tables[p.mesa] && p.estado !== 'cancelado').forEach(p => out.push('🛎️ Pedido de ' + U() + ' ' + p.mesa + ' que ya no existe.'));
    ps.filter(p => ['recibido', 'preparacion', 'listo', 'entregado'].includes(p.estado) && !p.aplicado).forEach(p => out.push('🛎️ Pedido de ' + tableLabel(p.mesa) + ' marcado «' + P().EST[p.estado] + '» pero no está en la cuenta.'));
    activos().filter(p => p.items.some(i => !i.ok)).forEach(p => out.push('🛎️ ' + tableLabel(p.mesa) + ' pidió algo que no existe en tus productos: ' + p.items.filter(i => !i.ok).map(i => i.name).join(', ') + '.'));
    (G() ? G().lista() : []).forEach(g => { if(g.miembros.some(id => !data.tables[id])) out.push('🔗 El grupo ' + G().etiqueta(g) + ' tiene ' + UP().toLowerCase() + ' que ya no existen.'); });
    duplicados().filter(x => x.conf >= 90).slice(0, 3).forEach(x => out.push('📦 Productos duplicados: ' + x.productos.map(p => p.name).join(' = ') + '.'));
    data.products.filter(p => p.stock != null && p.stock < 0).forEach(p => out.push('📦 ' + p.name + ' tiene stock negativo (' + p.stock + ').'));
    data.products.filter(p => p.cost > 0 && p.price > 0 && p.price < p.cost).forEach(p => out.push('💰 ' + p.name + ' se vende por debajo del costo (' + plata(p.price) + ' < ' + plata(p.cost) + ').'));
    if(window.__ventoSinConexionDesde) out.push('📶 Sin conexión desde ' + new Date(window.__ventoSinConexionDesde).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + ': los pedidos esperan en el canal de ORDEVA (hasta 12 h).');
    return [...new Set(out)];
  }
  // ---------- Centro de control ----------
  function centro(){
    const a = activos(), g = G() ? G().lista() : [], ocup = Object.keys(data.tables).filter(id => (data.tables[id].items || []).length).length;
    const b = bajos().length, ag = agotados().length, aud = auditoria().length, t = tiempos().act.filter(x => x.lento).length;
    const c = resumenCompras(rango('este mes'));
    return '🧠 ' + [a.length + ' pedido' + (a.length === 1 ? '' : 's') + ' pendiente' + (a.length === 1 ? '' : 's') + (prepOn() ? ' en ' + prepNombre() : ''),
      ocup + ' ' + (ocup === 1 ? U() : UP()).toLowerCase() + ' con cuenta abierta', g.length + ' grupo' + (g.length === 1 ? '' : 's') + ' de ' + UP().toLowerCase() + ' combinad' + (espacio()[3] === 'm' ? 'os' : 'as'),
      ag + ' agotado' + (ag === 1 ? '' : 's') + ' y ' + b + ' con stock bajo', c.n + ' factura' + (c.n === 1 ? '' : 's') + ' este mes (' + plata(c.total) + ', IVA ' + plata(c.iva) + ')',
      (t ? t + ' pedido' + (t === 1 ? '' : 's') + ' demorado' + (t === 1 ? '' : 's') : 'ningún pedido demorado'), (aud ? aud + ' cosa' + (aud === 1 ? '' : 's') + ' por revisar (di «ORDEVA, audita»)' : 'sin problemas detectados')].join(' · ') + '.';
  }
  // ---------- Búsqueda externa (Open Food Facts: base pública de productos, sin clave) ----------
  async function buscarFuera(q){
    const code = (q.match(/\b\d{8,14}\b/) || [])[0];
    const url = code ? 'https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=product_name,product_name_es,brands,quantity'
      : 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=5&fields=product_name,product_name_es,brands,quantity,code&countries_tags_en=colombia';
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 9000);
    try{ const j = await (await fetch(url, { signal: ctrl.signal })).json(); clearTimeout(tm);
      const l = code ? (j.product ? [Object.assign({ code }, j.product)] : []) : (j.products || []);
      if(!l.length) return 'No encontré «' + q + '» en Open Food Facts (base pública de productos). No invento datos: revisa el nombre o el código de barras.';
      return '🌐 En Open Food Facts encontré:\n' + bul(l.slice(0, 5).map(x => (x.product_name_es || x.product_name || 'Sin nombre') + (x.brands ? ' · ' + x.brands : '') + (x.quantity ? ' · ' + x.quantity : '') + (x.code ? ' · código ' + x.code : ''))) + '\n(Fuente externa: verifica antes de crear el producto.)';
    }catch(e){ clearTimeout(tm); return 'IA temporalmente no disponible para buscar afuera (sin conexión o la base no respondió). Puedes continuar manualmente.'; }
  }
  // ---------- Intenciones de unidades, reinicio, control y auditoría ----------
  function responderUnidades(t, raw){
    const ids = unidadesDe(t);
    // Combinar
    if(/\b(combina|combinar|combinalas|combinalos|agrupa|agrupar|vincula|vincular)\b/.test(t)){
      if(ids.length < 2) return { text: 'Dime cuáles ' + UP().toLowerCase() + ' combino, por ejemplo: «combina ' + art() + ' ' + U().toLowerCase() + ' 4 con ' + art() + ' 5».' };
      const falt = ids.filter(id => !data.tables[id]); if(falt.length) return { text: 'No existe: ' + falt.map(id => U() + ' ' + id).join(', ') + '.' };
      const activas = ids.filter(id => (data.tables[id].items || []).length);
      return { text: '¿Quieres combinar ' + arts() + ' ' + UP().toLowerCase() + ' ' + ids.join(', ') + '? Sus pedidos y cuentas se mostrarán como una operación conjunta (' + U().toLowerCase() + ' ' + ids[0] + ' principal). ' + (activas.length ? 'Tienen ' + plata(ids.reduce((s, id) => s + tableTotal(id), 0)) + ' en total; cada ' + U().toLowerCase() + ' conserva lo suyo.' : 'Están libres.'),
        actions: [{ tipo: 'laya', op: 'combinar', ids, label: '🔗 Combinar ' + U().toLowerCase() + ' ' + ids.join(' + ') }] };
    }
    if(/\b(separa|separar|descombina|descombinar|desvincula|desagrupa|desune)\b/.test(t)){
      const g = ids.map(id => G().de(id)).find(Boolean);
      if(!g) return { text: (ids.length ? tableLabel(ids[0]) + ' no está combinada.' : 'No hay ' + UP().toLowerCase() + ' combinad' + (espacio()[3] === 'm' ? 'os' : 'as') + '.') };
      const r = G().separar(g.principal); registrar('ejecución', 'Separó ' + r.etiqueta);
      return { text: '✂️ Separé ' + r.etiqueta + '. Cada ' + U().toLowerCase() + ' conserva sus productos, pedidos y abonos; no se perdió ni se duplicó nada.' };
    }
    if(/\b(combinad[oa]s|agrupad[oa]s|juntas|en grupo|grupos)\b/.test(t) && /\b(que|cuales|hay|cuantos|cuantas|muestra)\b/.test(t)){
      const l = G().lista(); if(!l.length) return { text: 'No hay ' + UP().toLowerCase() + ' combinad' + (espacio()[3] === 'm' ? 'os' : 'as') + '.' };
      return { text: '🔗 ' + UP() + ' combinad' + (espacio()[3] === 'm' ? 'os' : 'as') + ':\n' + bul(l.map(g => G().etiqueta(g) + ': total ' + plata(G().total(g)) + ', falta ' + plata(G().saldo(g)))) };
    }
    if(ids.length >= 2 && /\b(total|cuanto|cuenta|deben|llevan|suma)\b/.test(t)){
      const g = G().de(ids[0]); const mismos = g && ids.every(id => g.miembros.includes(id));
      const tot = ids.reduce((s, id) => s + tableTotal(id), 0), sal = ids.reduce((s, id) => s + tableBalance(id), 0);
      return { text: (mismos && g.miembros.length === ids.length ? G().etiqueta(g) : UP() + ' ' + ids.join(' + ') + (mismos ? ' (del grupo ' + G().etiqueta(g) + ')' : '')) + ': total ' + plata(tot) + ', falta pagar ' + plata(sal) + '.\n' + bul(ids.map(id => tableLabel(id) + ': ' + plata(tableTotal(id)))) };
    }
    if(ids.length && /\b(originalmente|de donde|origen|que pidio)\b/.test(t) && /\b(originalmente|origen|de donde)\b/.test(t)){
      const id = ids[0], propios = (data.tables[id] && data.tables[id].items || []).filter(i => i.origen == null || i.origen === id);
      const enOtra = []; Object.keys(data.tables).forEach(k => (data.tables[k].items || []).forEach(i => { if(i.origen === id && +k !== id) enOtra.push(i.qty + ' × ' + i.name + ' (ahora en ' + tableLabel(+k) + ')'); }));
      const pm = pedidos().filter(p => p.mesa === id && Date.now() - p.at < DIA);
      return { text: 'Lo que pidió ' + tableLabel(id) + ':\n' + (propios.length || enOtra.length ? bul(propios.map(i => i.qty + ' × ' + i.name).concat(enOtra)) : '• Nada en la cuenta.') + (pm.length ? '\nPedidos de hoy: ' + pm.map(p => p.items.map(i => i.qty + ' ' + i.name).join(', ') + ' (' + P().EST[p.estado] + ')').join('; ') + '.' : '') };
    }
    // Reiniciar
    if(/\b(reinicia|reiniciar|reinicie|resetea|resetear|limpia|limpiar)\b/.test(t) && /\bmesas?\b/.test(t)){
      const todas = /\b(todas|todos)\b/.test(t), el = todas ? Object.keys(data.tables).map(Number) : ids;
      if(!el.length) return { text: '¿Cuáles ' + UP().toLowerCase() + ' reinicio? Ej.: «reinicia ' + art() + ' ' + U().toLowerCase() + ' 5» o «reinicia todas ' + arts() + ' ' + UP().toLowerCase() + '».' };
      if(!esAdminL()) return { text: '🔒 Solo un administrador puede reiniciar ' + UP().toLowerCase() + '.' };
      const R = window.vitoReinicio, av = [];
      el.forEach(id => { const e = R.estado(id); if(e.saldo > 0) av.push(tableLabel(id) + ' tiene ' + plata(e.saldo) + ' sin pagar'); if(e.pedidos + e.prep) av.push(tableLabel(id) + ' tiene ' + (e.pedidos + e.prep) + ' pedido(s) activo(s)'); });
      return { text: '⚠️ Acción crítica: reiniciar ' + (todas ? 'todas ' + arts() + ' ' + UP().toLowerCase() : U().toLowerCase() + ' ' + el.join(', ')) + '. Se borran los pedidos activos, productos, cantidades, totales, abonos y nombres de ' + (el.length === 1 ? 'esa' : 'esas') + ' ' + (el.length === 1 ? U() : UP()).toLowerCase() + '. NO se borran inventario, productos, facturas, proveedores, historial, configuración ni QR.' + (av.length ? '\nOjo: ' + av.join('; ') + '.' : '') + '\n¿Lo hago?',
        actions: [{ tipo: 'laya', op: 'reiniciar', ids: el, critica: true, label: '♻️ Sí, reiniciar ' + (todas ? 'todas' : el.join(', ')) }] };
    }
    return null;
  }

  // ---------- Entender la frase ----------
  function responder(raw){
    if(!listo()) return null;
    let t = normUnidad(N(raw).replace(/^((oye|hola|ok|okey|ey|hey),? )?(laya|vento|bento|ordeva|hordeva|or deva)\b[ ,]*/, '').trim());
    if(!t) return { text: '¡Aquí estoy! Pregúntame por facturas, IVA, costos, proveedores, inventario, pedidos, ' + UP().toLowerCase() + ', ' + prepNombre().toLowerCase() + ' o música.' };
    const r = rango(t), pn = N(prepNombre());
    const ru = responderUnidades(t, raw); if(ru) return ru;
    // Centro de control, auditoría, estimaciones, tiempos
    if(/\b(centro de control|como va todo|como vamos|que esta pasando|estado general|resumen general|panorama)\b/.test(t)) return { text: centro() };
    if(/\b(audita|auditar|auditoria|revisa (los )?errores|hay (algun )?problemas?|que problemas|anomalias|inconsistencias)\b/.test(t)){
      const a = auditoria(); registrar('consulta', 'Auditoría: ' + a.length + ' hallazgo(s)');
      return { text: a.length ? '🔍 Encontré ' + a.length + ' cosa' + (a.length === 1 ? '' : 's') + ' por revisar:\n' + bul(a.slice(0, 15)) : '🔍 Revisé facturas, pedidos, ' + UP().toLowerCase() + ', productos y conexión: no encontré problemas. ✅' };
    }
    if(/\b(se va a agotar|se van a agotar|va a faltar|prediccion|predice|proyeccion|cuanto me dura|cuantos dias|alcanza)\b/.test(t)){
      const l = prediccion().filter(x => x.dias < 21); if(!l.length) return { text: 'Con las ventas de los últimos 14 días, ningún producto con control de stock parece agotarse en las próximas 3 semanas. (Es una estimación, no una certeza.)' };
      return { text: '📈 Estimación (según el consumo de los últimos 14 días, no es una certeza):\n' + bul(l.slice(0, 10).map(x => x.p.name + ': quedan ' + x.p.stock + ', se venden ~' + (Math.round(x.porDia * 10) / 10) + ' al día → ' + (x.dias < 1 ? 'podría agotarse hoy' : 'alcanza para ~' + Math.round(x.dias) + ' día(s)'))) };
    }
    if(/\b(cuanto (lleva|llevan|tarda|tardan)|tiempos?|demora\w*|atrasad\w*|lento|lentos|cuanto se demoran)\b/.test(t) && /\b(pedido|pedidos|preparacion|cocina|barra|despacho|mesa)\b/.test(t + ' ' + pn)){
      const x = tiempos(); if(!x.act.length) return { text: 'No hay pedidos activos ahora.' + (x.med != null ? ' Normalmente un pedido tarda ~' + Math.round(x.med) + ' min en estar listo.' : '') };
      return { text: '⏱️ Tiempos (desde que llegó):\n' + bul(x.act.slice(0, 10).map(y => (window.vitoGrupos ? window.vitoGrupos.etiquetaDe(y.p.mesa) : tableLabel(y.p.mesa)) + ': ' + y.total + ' min · ' + P().EST[y.p.estado] + ' hace ' + y.enEstado + ' min' + (y.lento ? ' ⚠️ demorado' : ''))) + (x.med != null ? '\nLo normal en este local: ~' + Math.round(x.med) + ' min.' : '') };
    }
    if(/\b(falta por preparar|que falta|por preparar|pendiente por preparar)\b/.test(t)) return { text: INFORMES.preparacion() };
    if(/\b(cuanto inventario|inventario queda|que inventario|valor del inventario)\b/.test(t)) return { text: INFORMES.inventario() };
    // Búsqueda externa (base pública de productos)
    const mBus = t.match(/\b(busca|buscar|investiga|consulta)\b.*\b(internet|afuera|en la web|en linea|open food|codigo de barras)\b\s*(.*)$/) || t.match(/^(?:que producto es|que es el codigo)\s+(.+)$/);
    if(mBus){ const q = (mBus[3] || mBus[1] || '').replace(/\b(el|la|de|del|producto|codigo|barras)\b/g, ' ').trim() || raw.replace(/.*(internet|afuera|web|linea)/i, '').trim();
      return { text: '🌐 Busco «' + q + '» en Open Food Facts (base pública de productos)…', run: async () => { const r2 = await buscarFuera(q); registrar('consulta', 'Búsqueda externa: ' + q); try{ asisBot(r2); }catch(e){ showToast(r2.slice(0, 200), 9000); } } }; }
    // Pedido por chat o voz: «agrega cinco Águilas a la mesa 2», «repite el pedido anterior»
    if(/\b(agrega|agregale|agregame|anota|anotale|pon|ponle|sirve|sirvele|suma|sumale)\b/.test(t) && /\bmesa\b/.test(t) && typeof parseVoiceCommand === 'function'){
      const pv = parseVoiceCommand(t); const id = pv.tableId || unidadesDe(t)[0];
      if(pv.items && pv.items.length && id && data.tables[id]){ const r3 = applyVoiceItems(id, pv.items, pv.mode || 'add'); registrar('ejecución', 'Agregó a ' + tableLabel(id) + ': ' + r3.added.map(a => a.qty + ' ' + a.name).join(', '));
        return { text: r3.added.length ? '✅ ' + tableLabel(id) + ': ' + r3.added.map(a => a.qty + ' ' + a.name).join(', ') + '.' + (r3.notFound.length ? ' No encontré: ' + r3.notFound.join(', ') + '.' : '') : 'No encontré esos productos: ' + r3.notFound.join(', ') + '.' }; }
    }
    if(/\b(repite|repetir|repita)\b.*\b(pedido|orden|ronda)\b/.test(t) && typeof handleVoiceTranscriptLocal === 'function'){ setTimeout(() => handleVoiceTranscriptLocal(raw.replace(/^\s*(laya|vento|bento|ordeva|hordeva|or deva)[ ,]*/i, '')), 0); return { text: '🔁 Repito el pedido anterior.' }; }
    // Facturas: leer una nueva o aplicar la que está en revisión
    if(/\b(revisa|lee|leer|escanea|escanear|procesa|procesar|toma|tomale|analiza)\b.*\bfactura\b/.test(t) || /^factura nueva$/.test(t))
      return { text: '📷 Abro la cámara: tómale la foto a la factura. Yo leo los productos, cantidades, IVA y costo por unidad, y te muestro todo para confirmar.', run: () => { try{ asisClose(); }catch(e){} asisGoView('inventario'); setTimeout(() => { const b = document.getElementById('invInvoiceCamBtn'); if(b) b.click(); }, 400); } };
    if(/\b(agrega|agregame|anade|mete|pasa|carga|aplica|aplicar|guarda|sube)\b.*\b(productos?|factura|inventario)\b/.test(t) && typeof invoiceDraft !== 'undefined' && invoiceDraft && document.getElementById('invoiceOverlay').classList.contains('show')){
      const it = invoiceDraft.items.filter(x => x.include), av = fiValidar(invoiceDraft);
      return { text: 'La factura tiene ' + it.length + ' producto(s) por ' + plata(it.reduce((s, x) => s + x.qty * x.cost, 0)) + '.' + (av.length ? ' Ojo, hay ' + av.length + ' aviso(s): ' + av.slice(0, 2).map(a => a.txt).join(' ') : ' Todo cuadra.') + ' ¿La aplico al inventario?',
        actions: [{ tipo: 'laya', op: 'aplicarFactura', label: '📥 Aplicar la factura al inventario' }] };
    }
    if(/\b(agrega|agregame|anade)\b.*\b(estos|los) productos\b.*\binventario\b/.test(t))
      return { text: 'Primero tómale la foto a la factura (dime «ORDEVA, revisa esta factura»). Cuando la revises, te la aplico al inventario.' };
    // Costo por unidad / último precio
    const pr = prodDe(t);
    if(/\b(cada unidad|por unidad|costo unitario|costo real|cuanto me costo|cuanto me cuesta|ultimo precio|precio de compra|a como lo compre|a como la compre|cuanto pague por)\b/.test(t)){
      if(pr){ const h = historialDe(pr), u = h[h.length - 1];
        if(!u) return { text: pr.cost > 0 ? pr.name + ': te cuesta ' + plata(pr.cost) + ' por unidad (dato guardado; no hay facturas de este producto).' : 'No tengo el costo de ' + pr.name + ': aplica una factura o ponlo en el producto.' };
        return { text: pr.name + ': la última compra' + (u.prov ? ' a ' + u.prov : '') + ' (' + fechaTxt(u.t) + ') salió a ' + plata(u.cost) + ' por unidad con IVA = ' + plata(u.sin) + ' sin IVA + ' + plata(u.iva) + ' de IVA (' + u.tasa + '%).' + (h.length > 1 ? ' La vez anterior: ' + plata(h[h.length - 2].cost) + '.' : '') }; }
      const c = compras({ ultima: true })[0];
      if(!c) return { text: 'Todavía no hay facturas aplicadas. Dime «ORDEVA, revisa esta factura» y la leo.' };
      return { text: 'Costo por unidad en la última factura (' + (c.supplier || 'proveedor') + (c.invoiceNumber ? ' #' + c.invoiceNumber : '') + '):\n' + bul((c.items || []).map(i => i.name + ': ' + i.qty + ' unid. × ' + plata(i.cost) + ' (' + plata(sinIvaU(i)) + ' + IVA ' + plata((i.cost || 0) - sinIvaU(i)) + ')')) };
    }
    if(/\biva\b/.test(t) && /\b(pague|pagado|pagamos|cuanto|total|llevo|he pagado)\b/.test(t)) return { text: INFORMES.iva(r) };
    // Proveedores
    const prov = /\b(proveedor|proveedores|le compre|le he comprado|compre a|comprado a|distribuidor)\b/.test(t) ? buscarProveedor(t) : null;
    if(prov) return { text: 'A ' + prov.nombre + ' le has comprado ' + plata(prov.total) + ' en ' + prov.n + ' factura' + (prov.n === 1 ? '' : 's') + ' (IVA ' + plata(prov.iva) + '). Última: ' + fechaTxt(prov.ult) + '. Productos: ' + [...prov.prods].slice(0, 8).join(', ') + '.' };
    if(/\b(proveedores|compras por proveedor|a quien le compro)\b/.test(t)) return { text: INFORMES.proveedores() };
    // Precios que cambiaron
    if(/\b(subieron|subio|aumento|aumentaron|mas caro|encarecio|cambio de precio|cambios de precio|bajaron|bajo de precio)\b/.test(t)){
      if(pr){ const h = historialDe(pr); if(h.length < 2) return { text: 'Solo tengo ' + h.length + ' compra(s) de ' + pr.name + '; necesito al menos dos para comparar.' };
        const a = h[h.length - 2], b = h[h.length - 1], pct = Math.round((b.cost - a.cost) / a.cost * 100);
        return { text: pr.name + ': pasó de ' + plata(a.cost) + ' a ' + plata(b.cost) + ' por unidad (' + (pct > 0 ? '+' : '') + pct + '%).' + (pct > 0 && pr.price ? ' Lo vendes a ' + plata(pr.price) + ': ganas ' + plata(pr.price - b.cost) + ' por unidad.' : '') }; }
      return { text: INFORMES.precios() };
    }
    if(/\b(me (estan|esta) costando mas|mas costosos?|mas caros?|que me cuesta mas)\b/.test(t)) return { text: INFORMES.costos() };
    // Inventario
    if(/\b(agotad\w*|sin stock|se acabaron|no hay de)\b/.test(t)) return { text: INFORMES.agotados() };
    if(/\b(bajo stock|stock bajo|se estan? acabando|por agotarse|poco stock|quedan pocos)\b/.test(t)) return { text: INFORMES.bajos() };
    if(/\b(duplicad\w*|repetid\w*|parecidos|iguales)\b/.test(t) && /\b(productos?|busca|hay|revisa)\b/.test(t)){
      const g = duplicados(); if(!g.length) return { text: 'No encontré productos duplicados. ✅' };
      const seguros = g.filter(x => x.conf >= 90);
      return { text: '🔎 Encontré ' + g.length + ' grupo(s) que parecen el mismo producto:\n' + bul(g.slice(0, 8).map(x => x.productos.map(p => p.name + (p.size ? ' ' + p.size : '')).join(' = ') + ' (' + x.conf + '% seguro)')) +
        (seguros.length ? '\n¿Los uno? Se suma el stock en uno solo y se borran los repetidos.' : '\nNo estoy segura de que sean el mismo: revísalos en Inventario → «Unir repetidos».'),
        actions: seguros.slice(0, 5).map(x => ({ tipo: 'laya', op: 'fusionar', keep: x.productos[0].id, gone: x.productos.slice(1).map(p => p.id), label: '🔗 Unir ' + x.productos.map(p => '«' + p.name + '»').join(' + ') })) };
    }
    // Pedidos y mesas
    const mesaN = typeof asisMesaNum === 'function' ? asisMesaNum(t) : null;
    // Acciones sobre pedidos: «marca listo el pedido de la mesa 3», «entregado mesa 2»
    const mEst0 = /\b(listo|lista|entregad[oa]|en preparacion|preparando|cancela\w*)\b/.exec(t);
    if(mEst0 && mesaN && /\bpedido\b|\bmarca\b|\bpon\b/.test(t)){
      const e = /listo|lista/.test(mEst0[1]) ? 'listo' : /entreg/.test(mEst0[1]) ? 'entregado' : /prepar/.test(mEst0[1]) ? 'preparacion' : 'cancelado';
      const p = activos().filter(x => x.mesa === mesaN).pop();
      if(!p) return { text: tableLabel(mesaN) + ' no tiene pedidos pendientes.' };
      if(e === 'cancelado') return { text: '¿Cancelo el pedido de ' + tableLabel(mesaN) + ' (' + p.items.map(i => i.qty + ' ' + i.name).join(', ') + ')? Si ya estaba en la cuenta, se descuenta.', actions: [{ tipo: 'laya', op: 'pedido', id: p.id, e, label: '✕ Cancelar el pedido de ' + tableLabel(mesaN) }] };
      P().cambiar(p.id, e); try{ renderCocina(); }catch(x){}
      return { text: '✅ Pedido de ' + tableLabel(mesaN) + ': ' + P().EST[e] + '.' };
    }
    if(mesaN && /\b(pidio|pidieron|pedido|pedidos|lleva|tiene|ordeno|consumio|que hay)\b/.test(t)){
      const tb = data.tables[mesaN]; const pm = pedidos().filter(p => p.mesa === mesaN && Date.now() - p.at < DIA).slice(-5);
      if(!tb && !pm.length) return { text: 'No tengo ' + art() + ' ' + tableLabel(mesaN) + '.' };
      const its = (tb && tb.items) || [];
      return { text: tableLabel(mesaN) + (its.length ? ' lleva:\n' + bul(its.map(i => i.qty + ' × ' + i.name)) + '\nTotal ' + plata(tableTotal(mesaN)) + ', falta pagar ' + plata(tableBalance(mesaN)) + '.' : ': sin nada en la cuenta.') +
        (pm.length ? '\nPedidos de hoy: ' + pm.map(p => p.items.map(i => i.qty + ' ' + i.name).join(', ') + ' (' + P().EST[p.estado] + ')').join('; ') + '.' : '') };
    }
    if(/\b(pedidos? (pendientes?|activos?|sin entregar|por entregar|nuevos)|cuantos pedidos|pedidos recientes|ultimos pedidos|que mesas tienen pedidos|mesas con pedidos)\b/.test(t)){
      if(/\b(recientes|ultimos)\b/.test(t)){ const l = pedidos().slice(-8).reverse(); return { text: l.length ? '🛎️ Pedidos recientes:\n' + bul(l.map(p => new Date(p.at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + ' · ' + txtPed(p))) : 'Todavía no hay pedidos.' }; }
      if(/\bmesas\b/.test(t)){ const ms = [...new Set(activos().map(p => p.mesa))]; return { text: ms.length ? UP() + ' con pedidos pendientes: ' + ms.map(m => tableLabel(m)).join(', ') + '.' : 'Ningun' + (espacio()[3] === 'm' ? '' : 'a') + ' ' + U().toLowerCase() + ' tiene pedidos pendientes.' }; }
      return { text: INFORMES.pedidos() };
    }
    if(/\b(cuantos productos se han pedido|productos pedidos|que se ha pedido|lo mas pedido)\b/.test(t)){
      const hoy = new Date().setHours(0, 0, 0, 0), c = {}; pedidos().filter(p => p.at >= hoy && p.estado !== 'cancelado').forEach(p => p.items.forEach(i => { c[i.name] = (c[i.name] || 0) + i.qty; }));
      const tot = Object.values(c).reduce((s, v) => s + v, 0);
      return { text: tot ? 'Hoy se han pedido ' + tot + ' productos:\n' + bul(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => v + ' × ' + k)) : 'Hoy todavía no hay pedidos.' };
    }
    // Pantalla de preparación (con el nombre de este local: cocina, barra, despacho…)
    const enPrep = new RegExp('\\b(' + pn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '|cocina|barra|preparacion|despacho|produccion|comandas)\\b').test(t);
    if(enPrep && /\b(que hay|hay|pendientes?|pedidos?|como va|como esta|que falta|listos?|en preparacion)\b/.test(t)) return { text: INFORMES.preparacion() };
    // Música
    if(/\b(musica|cancion|canciones|cola de musica|sonando|suena|playlist)\b/.test(t)){
      const m = M(); if(!m) return { text: 'La música no está disponible en este equipo.' };
      if(/\b(salta|saltar|siguiente|pasa la|quita la que suena|cambia la cancion)\b/.test(t)){ const a = m.actual(); m.saltar(); return { text: a ? '⏭ Salté «' + (a.title || a.song) + '».' : '▶ Pongo la siguiente de la cola.' }; }
      if(/\b(cancela|quita|borra|elimina)\b/.test(t) && mesaN){ const x = m.cola().filter(y => !y.done && y.mesa === mesaN).pop();
        return x ? { text: '¿Quito «' + (x.title || x.song) + '» de ' + tableLabel(mesaN) + ' de la cola?', actions: [{ tipo: 'laya', op: 'cancion', id: x.id, label: '🗑 Quitar «' + (x.title || x.song) + '»' }] } : { text: tableLabel(mesaN) + ' no tiene canciones en la cola.' }; }
      if(/\b(activa|enciende|pon|arranca)\b.*\b(automatica|sola|musica)\b/.test(t)) return { text: 'Te llevo a Música: toca «Música automática» una vez y desde ahí suena sola.', run: () => { try{ asisClose(); }catch(e){} asisGoView('musica'); } };
      return { text: INFORMES.musica() };
    }
    // Informes
    if(/\b(informe|reporte|resumen|balance)\b/.test(t)){
      const k = /\binventario\b/.test(t) ? 'inventario' : /\bfacturas?\b/.test(t) ? 'facturas' : /\bcompras?\b/.test(t) ? 'compras' : /\biva\b/.test(t) ? 'iva' : /\bcostos?\b/.test(t) ? 'costos' : /\bnuevos?\b/.test(t) ? 'nuevos' :
        /\bagotad/.test(t) ? 'agotados' : /\b(bajo|poco) stock\b/.test(t) ? 'bajos' : /\bprecios?\b/.test(t) ? 'precios' : /\bproveedor/.test(t) ? 'proveedores' : /\bpedidos?\b/.test(t) ? 'pedidos' :
        /\bmusica\b/.test(t) ? 'musica' : (enPrep || /\bpreparacion\b/.test(t)) ? 'preparacion' : (/\b(ventas?|vendi)\b/.test(t) ? null : 'general');
      if(k) return { text: INFORMES[k](r) };
    }
    return null;
  }
  // ---------- Acciones confirmadas desde el chat ----------
  function ejecutar(a){
    const criticas = ['reiniciar', 'fusionar'];
    if(criticas.includes(a.op) && !esAdminL()){ registrar('crítica', 'Denegado (sin permiso): ' + (a.label || a.op)); return '🔒 Esa acción es solo para un administrador.'; }
    registrar(criticas.includes(a.op) ? 'crítica' : 'ejecución', 'Confirmado: ' + (a.label || a.op));
    if(a.op === 'combinar' && G()){ const r = G().combinar(a.ids, a.ids[0]); return r.error ? '⚠️ ' + r.error : '🔗 ' + r.etiqueta + ' combinad' + (espacio()[3] === 'm' ? 'os' : 'as') + '. Total: ' + plata(G().total(r.grupo)) + '. Cada ' + U().toLowerCase() + ' conserva su origen.'; }
    if(a.op === 'reiniciar' && window.vitoReinicio){ const r = window.vitoReinicio.reiniciar(a.ids); return r.error ? '🔒 ' + r.error : '♻️ Reinicié ' + r.n + ' ' + (r.n === 1 ? U() : UP()).toLowerCase() + '. Inventario, productos, facturas e historial intactos.'; }
    if(a.op === 'fusionar'){ const keep = data.products.find(p => p.id === a.keep); if(!keep) return 'Ya no encontré ese producto.';
      const nombres = []; (a.gone || []).forEach(id => { const g = data.products.find(p => p.id === id); if(g){ nombres.push(g.name); (g.skus || []).forEach(s => { keep.skus = keep.skus || []; if(!keep.skus.includes(s)) keep.skus.push(s); }); (g.barcodes || []).forEach(s => { keep.barcodes = keep.barcodes || []; if(!keep.barcodes.includes(s)) keep.barcodes.push(s); }); dupMerge(keep, g); } });
      Object.keys(data.equivalencias || {}).forEach(k => { if((a.gone || []).includes(data.equivalencias[k].productId || data.equivalencias[k])) { if(typeof data.equivalencias[k] === 'object') data.equivalencias[k].productId = keep.id; else data.equivalencias[k] = keep.id; } });
      return '🔗 Uní ' + nombres.map(n => '«' + n + '»').join(', ') + ' en «' + keep.name + '» (stock ahora: ' + (keep.stock != null ? keep.stock : '—') + ').'; }
    if(a.op === 'pedido' && P()){ const p = P().cambiar(a.id, a.e); try{ renderCocina(); }catch(e){} return p ? 'Pedido de ' + tableLabel(p.mesa) + ': ' + P().EST[p.estado] + '.' : 'No encontré ese pedido.'; }
    if(a.op === 'cancion' && M()){ M().cancelar(a.id); return '🗑 Canción quitada de la cola.'; }
    if(a.op === 'aplicarFactura'){ setTimeout(() => { const b = document.getElementById('invoiceApplyBtn'); if(b) b.click(); }, 300); return 'Aplicando la factura…'; }
    return 'No supe hacer eso.';
  }

  // ---------- Avisos proactivos (útiles, sin repetirse) ----------
  const vistos = {}; let ultimoToast = 0; const recientes = [];
  function avisar(k, txt, cada){
    if(vistos[k] && Date.now() - vistos[k] < (cada || 6 * 36e5)) return;
    vistos[k] = Date.now(); recientes.unshift({ t: Date.now(), txt }); recientes.length = Math.min(recientes.length, 30);
    if(Date.now() - ultimoToast < 45000) return;                 // máximo un aviso cada 45 s
    if(typeof data !== 'undefined' && data && data.layaAuto && data.layaAuto.avisos === false) return;   // avisos de ORDEVA apagados (quedan en «Avisos recientes»)
    if(window.ventoAvisoOn && !window.ventoAvisoOn('ia')) return;                                         // apagado en Ajustes → Notificaciones
    ultimoToast = Date.now(); try{ showToast('🧠 ORDEVA: ' + txt, 7000); }catch(e){}
    try{ window.ventoAvisoCel && window.ventoAvisoCel('🧠 ORDEVA', txt, 'avisos'); }catch(e){}
  }
  function revisar(){
    if(!listo()) return;
    agotados().slice(0, 3).forEach(p => avisar('ago-' + p.id + '-' + (p.stock || 0), 'se agotó ' + p.name + '.'));
    const b = bajos(); if(b.length) avisar('bajo-' + b.map(p => p.id).join(','), b.length === 1 ? 'se está acabando ' + b[0].name + ' (quedan ' + b[0].stock + ').' : b.length + ' productos se están acabando: ' + b.slice(0, 3).map(p => p.name).join(', ') + '.');
    const d = duplicados().filter(x => x.conf >= 90); if(d.length) avisar('dup-' + d.length, 'hay ' + d.length + ' producto(s) que parecen repetidos. Dime «ORDEVA, busca productos duplicados».', DIA);
    const c = cambiosPrecio().filter(x => x.pct >= 10 && Date.now() - x.t < 3 * DIA); c.slice(0, 2).forEach(x => avisar('pre-' + x.p.id + '-' + x.a, x.p.name + ' subió ' + x.pct + '% en la última factura (' + plata(x.de) + ' → ' + plata(x.a) + ').', 7 * DIA));
    const f = (data.purchases || [])[0]; if(f && f.avisos && f.avisos.length && Date.now() - Date.parse(f.procesadaEn || f.at) < 36e5) avisar('fac-' + f.id, 'la factura ' + (f.invoiceNumber || '') + ' de ' + (f.supplier || 'proveedor') + ' se guardó con ' + f.avisos.length + ' aviso(s). Revísala en Facturas anteriores.', DIA);
    activos().filter(p => p.estado === 'nuevo' && Date.now() - p.recibidoEn > 3 * 6e4).slice(0, 2).forEach(p => avisar('pna-' + p.id, tableLabel(p.mesa) + ' tiene un pedido esperando que lo acepten.', 10 * 6e4));
    activos().filter(p => ['recibido', 'preparacion'].includes(p.estado) && Date.now() - p.recibidoEn > 20 * 6e4).slice(0, 2).forEach(p => avisar('ptarde-' + p.id, 'el pedido de ' + tableLabel(p.mesa) + ' lleva más de 20 minutos en ' + prepNombre() + '.', 30 * 6e4));
    activos().filter(p => p.items.some(i => !i.ok)).slice(0, 1).forEach(p => avisar('pmal-' + p.id, tableLabel(p.mesa) + ' pidió algo que no está en tus productos: ' + p.items.filter(i => !i.ok).map(i => i.name).join(', ') + '.', DIA));
    const m = M(); if(m){ m.hist().filter(x => x.status === 'error' && Date.now() - (x.endedAt || 0) < 15 * 6e4).slice(0, 1).forEach(x => avisar('mzerr-' + x.id, 'no se pudo reproducir «' + (x.title || x.song) + '» de ' + tableLabel(x.mesa) + '; pasé a la siguiente.', DIA)); }
    const est = document.getElementById('qrEstado') || document.getElementById('liveEstado');
    if(window.__ventoSinConexionDesde && Date.now() - window.__ventoSinConexionDesde > 3 * 6e4) avisar('sync', 'no hay conexión para recibir pedidos y canciones. Se reconecta sola; los pedidos quedan guardados en el canal de ORDEVA hasta 12 horas.', 30 * 6e4);
  }
  setInterval(() => { try{ revisar(); }catch(e){} }, 90000);
  setTimeout(() => { try{ revisar(); }catch(e){} }, 20000);
  window.addEventListener('offline', () => { window.__ventoSinConexionDesde = Date.now(); });
  window.addEventListener('online', () => { window.__ventoSinConexionDesde = 0; });

  // ---------- Registro de mesas unificadas (lo usa «juntar mesas») ----------
  window.registrarUnificacion = function(r){
    if(!listo() || !r || !r.juntada) return;
    data.unificaciones = data.unificaciones || [];
    data.unificaciones.unshift({ t: Date.now(), mesas: [r.lblO, r.lblD], a: r.destino, empleado: (typeof authUser !== 'undefined' && authUser) || '—', total: typeof tableTotal === 'function' ? tableTotal(r.destino) : 0 });
    if(data.unificaciones.length > 300) data.unificaciones.length = 300;
    try{ saveData(); }catch(e){}
  };

  // ---------- Panel de ORDEVA en Ajustes ----------
  const e2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function crearPanel(){
    const cats = document.getElementById('ajustesCats'); if(!cats || document.getElementById('layaGrupo')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ajustes-cat'; b.dataset.cat = 'laya';
    b.innerHTML = '<span class="ac-icon">🧠</span><span class="ac-label">ORDEVA IA · informes y avisos</span><span class="ac-arrow">›</span>';
    cats.insertBefore(b, cats.firstChild);
    const g = document.createElement('div'); g.className = 'settings-group'; g.id = 'layaGrupo'; g.hidden = true; g.dataset.cat = 'laya';
    const BOT = [['general', '📊 Resumen general'], ['inventario', '📦 Inventario'], ['facturas', '🧾 Facturas'], ['compras', '🛒 Compras'], ['iva', '🧮 IVA pagado'], ['costos', '💰 Costos'], ['precios', '📈 Cambios de precio'], ['proveedores', '🏭 Proveedores'], ['nuevos', '🆕 Productos nuevos'], ['agotados', '🚫 Agotados'], ['bajos', '⚠️ Bajo stock'], ['pedidos', '🛎️ Pedidos'], ['preparacion', '🍳 Preparación'], ['musica', '🎵 Música']];
    g.innerHTML = '<h2>🧠 ORDEVA IA</h2><div class="settings-desc">ORDEVA lee tus facturas, cuadra cantidades e IVA, vigila el inventario, los pedidos, la pantalla de preparación y la música, y te avisa lo importante. Pregúntale con tus palabras tocando la carita de «IA» arriba (o di «ORDEVA…» en el micrófono). Todo sale de tus datos reales: si algo no está, te lo dice.</div>' +
      '<div class="mz-actions" id="layaInfBtns" style="flex-wrap:wrap">' + BOT.map(([k, l]) => '<button type="button" class="btn-ghost" data-inf="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<pre class="laya-inf" id="layaInf" hidden></pre><div class="jm-card"><b>🧠 Centro de control</b><div id="layaCentro" class="settings-desc"></div></div>' +
      '<div class="jm-card"><b>🔔 Avisos recientes de ORDEVA</b><div id="layaAvisos" class="settings-desc"></div></div>' +
      '<div class="jm-card"><b>📜 Actividad de ORDEVA y auditoría</b><div class="settings-desc">Qué consultó, sugirió y ejecutó ORDEVA, y las acciones importantes (combinar, separar, reiniciar, cobrar grupos) con usuario, fecha y hora.</div><div id="layaActividad" class="jm-tabla jm-act"></div></div><div class="jm-card" id="layaUnif"></div>';
    const ref = document.querySelector('#view-ajustes .settings-group[data-cat]'); ref.parentNode.insertBefore(g, ref);
    b.addEventListener('click', () => { if(typeof mostrarCategoriaAjustes === 'function') mostrarCategoriaAjustes('laya'); pintar(); });
    g.querySelector('#layaInfBtns').addEventListener('click', ev => { const x = ev.target.closest('[data-inf]'); if(!x) return; const box = g.querySelector('#layaInf'); box.hidden = false; box.textContent = INFORMES[x.dataset.inf](x.dataset.inf === 'compras' || x.dataset.inf === 'iva' || x.dataset.inf === 'facturas' ? rango('este mes') : null); });
  }
  function pintar(){
    const g = document.getElementById('layaGrupo'); if(!g || !listo()) return;
    try{ g.querySelector('#layaCentro').textContent = centro(); }catch(e){}
    const act = (data.layaLog || []).map(x => ({ t: x.t, a: 'ORDEVA · ' + x.clase, d: x.txt, u: x.usuario })).concat((data.auditoria || []).map(x => ({ t: x.t, a: x.accion, d: x.detalle, u: x.usuario }))).sort((a, b) => b.t - a.t).slice(0, 80);
    g.querySelector('#layaActividad').innerHTML = act.length ? act.map(x => '<div><span>' + new Date(x.t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '</span><span><b>' + e2(x.a) + '</b> ' + e2(x.d) + '</span><span>' + e2(x.u) + '</span></div>').join('') : '<div class="settings-desc">Todavía no hay actividad.</div>';
    g.querySelector('#layaAvisos').innerHTML = recientes.length ? recientes.slice(0, 12).map(a => '<div>' + new Date(a.t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + ' · ' + e2(a.txt) + '</div>').join('') : 'Sin avisos por ahora.';
    const u = data.unificaciones || [];
    g.querySelector('#layaUnif').innerHTML = '<b>🔀 Mesas unificadas</b>' + (u.length ? '<div class="jm-tabla">' + u.slice(0, 100).map(x => '<div><span>' + new Date(x.t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '</span><span>' + e2(x.mesas.join(' + ')) + '</span><span>' + e2(x.empleado) + '</span><span>' + plata(x.total) + '</span></div>').join('') + '</div>' : '<div class="settings-desc">Todavía no se han juntado mesas.</div>');
  }
  const st = document.createElement('style');
  st.textContent = '.jm-card{border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0;background:var(--surface)}.jm-card>b{display:block;margin-bottom:6px}.laya-inf{white-space:pre-wrap;font:inherit;font-size:14px;line-height:1.5;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface);margin:10px 0}.jm-tabla div{display:grid;grid-template-columns:1.2fr 1.5fr 1fr .8fr;gap:6px;font-size:12.5px;padding:4px 0;border-top:1px solid var(--line)}.jm-act div{grid-template-columns:5.5em 1fr 4.5em;overflow-wrap:anywhere}.jm-act{max-height:50vh;overflow:auto}';
  document.head.appendChild(st);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crearPanel); else crearPanel();
  window.Laya = { responder, ejecutar, registrar, centro, auditoria, prediccion, tiempos, buscarFuera, informe: (k, r) => INFORMES[k] ? INFORMES[k](r) : '', duplicados, cambiosPrecio, proveedores, resumenCompras, avisos: () => recientes.slice(), revisar };
})();
