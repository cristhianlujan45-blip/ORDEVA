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

  window.ventoFinanzas = { utilidad, margen, recargo, precioParaMargen, precioParaRecargo, redondeoComercial, pasoComercial, separarIva, preciosSugeridos };
})();
