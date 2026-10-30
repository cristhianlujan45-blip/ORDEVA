/* =====================================================================
   ORDEVA · 🧮 Motor financiero (1.67.0)
   Las mismas fórmulas para todas las pantallas (ficha del producto, facturas, Laya, estadísticas). Funciones puras: no
   leen ni cambian los datos del negocio y nunca cambian un precio solas.
   • Margen bruto  = (precio − costo) / precio      → lo que queda de cada peso vendido
   • Recargo       = (precio − costo) / costo       → cuánto se le sube al costo
     Ej.: costo $8.000, precio $10.000 → utilidad $2.000, margen 20 %, recargo 25 %.
   • Precio para un margen objetivo = costo / (1 − margen)  (costo $8.000, 30 % → $11.428,57)
   • Precio comercial: el anterior redondeado hacia arriba a un valor de vitrina ($11.500).
   • IVA: si el negocio es responsable de IVA, el margen se calcula sin IVA (precio y costo netos); si no, el IVA de la
     compra es parte del costo. Es una ayuda: no reemplaza la asesoría contable o tributaria.
   ===================================================================== */
(function(){
  'use strict';
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const r2 = n => Math.round(n * 100) / 100;

  function utilidad(precio, costo){ return num(precio) - num(costo); }
  // En porcentaje (20 = 20 %). null si no se puede calcular (sin precio o sin costo).
  function margen(precio, costo){ precio = num(precio); costo = num(costo); return precio > 0 && costo >= 0 ? r2((precio - costo) / precio * 100) : null; }
  function recargo(precio, costo){ precio = num(precio); costo = num(costo); return costo > 0 ? r2((precio - costo) / costo * 100) : null; }
  // Precio exacto para un margen objetivo (en %, de 0 a 95).
  function precioParaMargen(costo, margenPct){
    costo = num(costo); const m = Math.max(0, Math.min(95, num(margenPct))) / 100;
    return costo > 0 ? r2(costo / (1 - m)) : 0;
  }
  function precioParaRecargo(costo, recargoPct){ costo = num(costo); return costo > 0 ? r2(costo * (1 + Math.max(0, num(recargoPct)) / 100)) : 0; }
  // Redondeo hacia arriba a precios de vitrina en pesos colombianos (nunca baja: no se pierde margen al redondear).
  function pasoComercial(v){ return v < 2000 ? 50 : v < 10000 ? 100 : v < 50000 ? 500 : v < 200000 ? 1000 : 5000; }
  function redondeoComercial(v){ v = num(v); if(!(v > 0)) return 0; const p = pasoComercial(v); return Math.ceil(Math.round(v * 100) / 100 / p) * p; }
  // IVA incluido en un precio: { base, iva }.
  function separarIva(precioConIva, ivaPct){ const t = num(precioConIva), f = 1 + Math.max(0, num(ivaPct)) / 100; const base = t / f; return { base: r2(base), iva: r2(t - base) }; }

  /* Las tres sugerencias de precio para un costo (por unidad, tal como se compra):
     • minimo: no perder plata (cubre el costo; con IVA de venta, cubre también el IVA que se le entrega a la DIAN).
     • objetivo: el margen que quiere el negocio (data.margenObjetivo, 30 % si no hay).
     • comercial: el objetivo redondeado a un precio de vitrina.
     o.ivaVenta (%): IVA que se cobra al vender (si el negocio es responsable). o.responsable: si puede descontar el IVA
     de la compra; entonces el costo que cuenta es sin IVA (o.ivaCompra %). */
  function preciosSugeridos(costo, o){
    o = o || {}; costo = num(costo); if(!(costo > 0)) return null;
    const mo = o.margenObjetivo != null ? Math.max(1, Math.min(90, num(o.margenObjetivo))) : 30;
    const ivaV = Math.max(0, num(o.ivaVenta)), ivaC = o.ivaCompra != null ? Math.max(0, num(o.ivaCompra)) : ivaV;
    const costoReal = o.responsable && ivaC > 0 ? costo / (1 + ivaC / 100) : costo;   // el IVA descontable no es costo
    const conIva = p => o.responsable && ivaV > 0 ? p * (1 + ivaV / 100) : p;
    const minimo = r2(conIva(costoReal)), objetivo = r2(conIva(precioParaMargen(costoReal, mo)));
    return { margenObjetivo: mo, costoReal: r2(costoReal), minimo, objetivo, comercial: redondeoComercial(objetivo) };
  }

  /* ---------- 1.67.2 · Resultado, rentabilidad, inventario y alertas (fase 2) ----------
     • Compras de mercancía (proveedores y las de cada tipo de negocio: mercancía, insumos, licores…) NO son gasto
       operativo: ese costo ya entra en el «costo de lo vendido». Restarlas otra vez daba una utilidad más baja de la real.
     • Resultado neto estimado = (vendido − costo de lo vendido) − gastos operativos.
     • Flujo de caja (lo que entró − lo que salió) es otra cosa y se muestra aparte (Contabilidad). */
  const COMPRAS_INV = ['proveedores', 'mercancia', 'insumos', 'licores', 'harinas', 'laboratorios', 'insumos_med', 'medicamentos', 'alimento', 'productos_bar'];
  function esCompraInventario(cat){ return COMPRAS_INV.indexOf(String(cat || '')) >= 0; }
  // gastos: [{ cat, monto }]
  function resultado(vendido, costoVendido, gastos){
    vendido = num(vendido); costoVendido = num(costoVendido);
    let operativos = 0, compras = 0;
    (gastos || []).forEach(g => { const m = num(g.monto); if(esCompraInventario(g.cat)) compras += m; else operativos += m; });
    const bruta = vendido - costoVendido;
    return { vendido, costoVendido, utilidadBruta: bruta, margenBruto: vendido > 0 ? r2(bruta / vendido * 100) : null,
      gastosOperativos: operativos, comprasInventario: compras, resultadoNeto: bruta - operativos };
  }
  const sinT = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  // Lo que dejó cada producto y cada categoría en las ventas del rango (con el costo GUARDADO en cada venta: los cambios
  // de costo de después no cambian el pasado). r = { ini, fin } en ms (opcional).
  function rentabilidad(history, products, categories, r){
    const porId = {}, porNom = {}, cats = {};
    (products || []).forEach(p => { porId[p.id] = p; porNom[sinT(p.name)] = p; });
    (categories || []).forEach(c => { cats[c.id] = c.name; });
    const prod = {}, cat = {};
    let sinCosto = 0;
    (history || []).forEach(h => {
      const t = new Date(h.date).getTime();
      if(r && !(t >= r.ini && t < r.fin)) return;
      (h.items || []).forEach(it => {
        const q = num(it.qty), v = q * num(it.price); if(!(q > 0) || !(v > 0)) return;
        if(/domicilio|propina/i.test(it.name || '')) return;
        const p = porId[it.productId] || porNom[sinT(it.name)] || null;
        const k = p ? p.id : 'n:' + sinT(it.name);
        const c = it.cost != null && it.cost !== '' ? num(it.cost) * q : null;
        const x = prod[k] || (prod[k] = { id: p ? p.id : null, nombre: p ? p.name : it.name, cat: p && p.categoryId ? (cats[p.categoryId] || 'Sin categoría') : 'Sin categoría', q: 0, ventas: 0, costo: 0, conCosto: 0 });
        x.q += q; x.ventas += v;
        if(c != null){ x.costo += c; x.conCosto += v; } else sinCosto += v;
      });
    });
    const lista = Object.values(prod).map(x => Object.assign(x, { utilidad: x.conCosto ? x.conCosto - x.costo : null, margen: x.conCosto ? r2((x.conCosto - x.costo) / x.conCosto * 100) : null }));
    lista.forEach(x => {
      const c = cat[x.cat] || (cat[x.cat] = { nombre: x.cat, ventas: 0, costo: 0, conCosto: 0 });
      c.ventas += x.ventas; if(x.conCosto){ c.costo += x.costo; c.conCosto += x.conCosto; }
    });
    const categorias = Object.values(cat).map(c => Object.assign(c, { utilidad: c.conCosto ? c.conCosto - c.costo : null, margen: c.conCosto ? r2((c.conCosto - c.costo) / c.conCosto * 100) : null }));
    return { productos: lista, categorias, ventasSinCosto: sinCosto };
  }
  // Plata metida en la bodega y lo que dejaría venderla toda a los precios de hoy.
  function inventario(products){
    let inversion = 0, venta = 0, sinCosto = 0, unidades = 0;
    (products || []).forEach(p => {
      const q = p.stock == null || p.stock === '' ? 0 : Math.max(0, num(p.stock)); if(!q) return;
      unidades += q; venta += q * num(p.price);
      if(p.cost != null && p.cost !== '' && num(p.cost) > 0) inversion += q * num(p.cost); else sinCosto++;
    });
    return { inversion: Math.round(inversion), ventaPotencial: Math.round(venta), gananciaPotencial: Math.round(venta - inversion), productosSinCosto: sinCosto, unidades };
  }
  /* Alertas (solo con datos reales; cada una dice por qué):
     perdida: precio ≤ costo · margen: margen por debajo de la mitad del objetivo · costo: la última compra costó ≥ 5 % más
     que la anterior (últimos 45 días) y el margen quedó bajo el objetivo (precio desactualizado) · gastos: gastos
     operativos del mes > 30 % sobre el promedio de los 3 meses anteriores · categoria: el margen de una categoría bajó
     ≥ 5 puntos frente al mes anterior (con ventas en los dos). */
  function alertas(d, o){
    o = o || {}; d = d || {};
    const out = [], mo = num(d.margenObjetivo) > 0 ? num(d.margenObjetivo) : 30, ahora = o.ahora || Date.now();
    const prods = (d.products || []).filter(p => num(p.price) > 0 && p.cost != null && p.cost !== '' && num(p.cost) > 0);
    const perdidas = prods.filter(p => num(p.price) <= num(p.cost));
    if(perdidas.length) out.push({ k: 'perdida', c: 'mal', ic: '🔻', t: perdidas.length + ' producto' + (perdidas.length === 1 ? '' : 's') + ' con pérdida (precio ≤ costo)', s: perdidas.slice(0, 3).map(p => p.name).join(' · '), ir: 'inventario', ids: perdidas.map(p => p.id) });
    const bajos = prods.filter(p => num(p.price) > num(p.cost) && margen(p.price, p.cost) < mo / 2);
    if(bajos.length) out.push({ k: 'margen', c: 'ojo', ic: '📉', t: bajos.length + ' con margen bajo (menos de ' + Math.round(mo / 2) + ' %)', s: bajos.slice(0, 3).map(p => p.name + ' ' + Math.round(margen(p.price, p.cost)) + ' %').join(' · '), ir: 'inventario', ids: bajos.map(p => p.id) });
    // Costo que subió (de las facturas registradas)
    const compras = {};
    (d.purchases || []).forEach(pu => { const t = new Date(pu.at || pu.date).getTime(); (pu.items || []).forEach(it => { if(it.productId && num(it.cost) > 0) (compras[it.productId] = compras[it.productId] || []).push({ t, c: num(it.cost) }); }); });
    const subio = [];
    Object.keys(compras).forEach(id => {
      const l = compras[id].sort((a, b) => a.t - b.t); if(l.length < 2) return;
      const u = l[l.length - 1], a = l[l.length - 2]; if(ahora - u.t > 45 * 864e5 || !(u.c >= a.c * 1.05)) return;
      const p = (d.products || []).find(x => x.id === id); if(!p || !(num(p.price) > 0)) return;
      if(margen(p.price, u.c) < mo) subio.push({ p, de: a.c, a: u.c });
    });
    if(subio.length) out.push({ k: 'costo', c: 'ojo', ic: '📈', t: subio.length + ' producto' + (subio.length === 1 ? '' : 's') + ' subió de costo: revisa el precio', s: subio.slice(0, 3).map(x => x.p.name + ' (' + Math.round((x.a / x.de - 1) * 100) + ' %)').join(' · '), ir: 'inventario', ids: subio.map(x => x.p.id) });
    // Gastos y categorías: por mes calendario
    const mes = k => { const x = new Date(ahora); x.setDate(1); x.setHours(0, 0, 0, 0); x.setMonth(x.getMonth() - k); return x.getTime(); };
    const rango = k => ({ ini: mes(k), fin: k === 0 ? ahora + 1 : mes(k - 1) });
    const gOp = r => (d.contab || []).filter(g => g.tipo === 'gasto' && !esCompraInventario(g.cat)).reduce((s, g) => { const t = new Date(g.fecha + 'T12:00').getTime(); return t >= r.ini && t < r.fin ? s + num(g.monto) : s; }, 0);
    const actual = gOp(rango(0)), prev = [1, 2, 3].map(k => gOp(rango(k))), conDatos = prev.filter(x => x > 0);
    if(conDatos.length >= 2){
      const prom = conDatos.reduce((a, b) => a + b, 0) / conDatos.length;
      if(actual > prom * 1.3) out.push({ k: 'gastos', c: 'ojo', ic: '💸', t: 'Gastos del mes por encima de lo normal', s: 'Van ' + Math.round(actual).toLocaleString('es-CO') + ' frente a un promedio de ' + Math.round(prom).toLocaleString('es-CO') + ' (' + Math.round((actual / prom - 1) * 100) + ' % más)', ir: 'contabilidad' });
    }
    const ra = rentabilidad(d.history, d.products, d.categories, rango(0)).categorias, rp = rentabilidad(d.history, d.products, d.categories, rango(1)).categorias;
    const peor = ra.filter(c => c.margen != null && c.conCosto > 0).map(c => { const p = rp.find(x => x.nombre === c.nombre && x.margen != null); return p ? { c, baja: p.margen - c.margen, antes: p.margen } : null; }).filter(x => x && x.baja >= 5);
    if(peor.length) out.push({ k: 'categoria', c: 'ojo', ic: '🗂️', t: 'Margen más bajo que el mes pasado en ' + peor.length + ' categoría' + (peor.length === 1 ? '' : 's'), s: peor.slice(0, 3).map(x => x.c.nombre + ' ' + Math.round(x.antes) + ' % → ' + Math.round(x.c.margen) + ' %').join(' · '), ir: 'estadisticas' });
    const V = vencimientos(d.products, { ahora });
    if(V.vencidos.length) out.push({ k: 'vencido', c: 'mal', ic: '⛔', t: V.vencidos.length + ' lote' + (V.vencidos.length === 1 ? '' : 's') + ' vencido' + (V.vencidos.length === 1 ? '' : 's') + ' con unidades', s: V.vencidos.slice(0, 3).map(x => x.nombre + ' (' + x.q + ' u)').join(' · '), ir: 'inventario' });
    if(V.pronto.length) out.push({ k: 'vence', c: 'ojo', ic: '⏳', t: V.pronto.length + ' lote' + (V.pronto.length === 1 ? '' : 's') + ' por vencer (15 días)', s: V.pronto.slice(0, 3).map(x => x.nombre + ' ' + (x.dias === 0 ? 'hoy' : 'en ' + x.dias + ' d')).join(' · '), ir: 'inventario' });
    return out;
  }

  /* ---------- 1.67.6 · Fase 5: costo de compra, proveedores y vencimientos ----------
     Método de valoración (data.costoMetodo): 'ultimo' (el de siempre: el costo es el de la última compra) o 'promedio'
     (promedio ponderado: lo que hay en bodega a su costo + lo que llega a su costo, entre el total). Nunca cambia ventas
     pasadas: cada venta guardó su costo. */
  function costoTrasCompra(stockAntes, costoAntes, qty, costoCompra, metodo){
    stockAntes = Math.max(0, num(stockAntes)); costoAntes = num(costoAntes); qty = Math.max(0, num(qty)); costoCompra = num(costoCompra);
    if(!(costoCompra > 0)) return costoAntes || 0;
    if(metodo !== 'promedio' || !(stockAntes > 0) || !(costoAntes > 0) || !(qty > 0)) return costoCompra;
    return r2((stockAntes * costoAntes + qty * costoCompra) / (stockAntes + qty));
  }
  // Compras por proveedor y, por producto, el último costo de cada proveedor (para comparar).
  function proveedores(purchases, products){
    const prov = {}, porProd = {};
    const nom = s => String(s || '').trim() || 'Sin proveedor';
    (purchases || []).forEach(pu => {
      const n = nom(pu.supplier), t = new Date(pu.at || pu.date).getTime() || 0;
      const x = prov[n] || (prov[n] = { nombre: n, compras: 0, total: 0, ultima: 0, productos: {} });
      x.compras++; x.total += num(pu.total); if(t > x.ultima) x.ultima = t;
      (pu.items || []).forEach(it => {
        if(!it.productId || !(num(it.cost) > 0)) return;
        x.productos[it.productId] = 1;
        const m = porProd[it.productId] || (porProd[it.productId] = {});
        if(!m[n] || t >= m[n].t) m[n] = { proveedor: n, costo: num(it.cost), t };
      });
    });
    const lista = Object.values(prov).map(x => Object.assign(x, { productos: Object.keys(x.productos).length, total: Math.round(x.total) })).sort((a, b) => b.total - a.total);
    const comparar = id => { const m = porProd[id]; if(!m) return []; return Object.values(m).sort((a, b) => a.costo - b.costo); };
    return { lista, comparar };
  }
  // Variación entre las dos últimas compras de un producto (%), o null.
  function variacionCosto(purchases, productId){
    const l = []; (purchases || []).forEach(pu => (pu.items || []).forEach(it => { if(it.productId === productId && num(it.cost) > 0) l.push({ t: new Date(pu.at || pu.date).getTime() || 0, c: num(it.cost) }); }));
    if(l.length < 2) return null; l.sort((a, b) => a.t - b.t);
    const a = l[l.length - 2].c, u = l[l.length - 1].c; return r2((u - a) / a * 100);
  }
  // Lotes con fecha de vencimiento que todavía tienen unidades: vencidos y por vencer (en «dias»).
  function vencimientos(products, o){
    o = o || {}; const hoy = new Date(o.ahora || Date.now()); hoy.setHours(0, 0, 0, 0); const lim = hoy.getTime() + (o.dias || 15) * 864e5;
    const vencidos = [], pronto = [];
    (products || []).forEach(p => (p.lotes || []).forEach(l => {
      if(!(num(l.q) > 0) || !l.vence) return;
      const t = new Date(l.vence + 'T00:00').getTime(); if(!t) return;
      const x = { id: p.id, nombre: p.name, q: num(l.q), vence: l.vence, dias: Math.round((t - hoy.getTime()) / 864e5) };
      if(t < hoy.getTime()) vencidos.push(x); else if(t <= lim) pronto.push(x);
    }));
    const ord = (a, b) => a.dias - b.dias;
    return { vencidos: vencidos.sort(ord), pronto: pronto.sort(ord) };
  }
  // Una venta (o salida) descuenta primero el lote que vence antes (FEFO). Devuelve los lotes nuevos.
  function descontarLotes(lotes, qty){
    let q = num(qty); if(!(q > 0) || !Array.isArray(lotes)) return lotes;
    const out = lotes.map(l => Object.assign({}, l)).sort((a, b) => String(a.vence || '9999').localeCompare(String(b.vence || '9999')) || (a.t || 0) - (b.t || 0));
    for(const l of out){ if(q <= 0) break; const u = Math.min(num(l.q), q); l.q = r2(num(l.q) - u); q -= u; }
    return out.filter(l => num(l.q) > 0);
  }

  window.ventoFinanzas = { utilidad, margen, recargo, precioParaMargen, precioParaRecargo, redondeoComercial, pasoComercial, separarIva, preciosSugeridos,
    esCompraInventario, resultado, rentabilidad, inventario, alertas, costoTrasCompra, proveedores, variacionCosto, vencimientos, descontarLotes };
})();
