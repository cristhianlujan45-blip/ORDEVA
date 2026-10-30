# ORDEVA 1.67.6 · 📦 Fase 5: costo promedio, proveedores, lotes y vencimientos

## Qué quedó

### Costo de lo que compras (Ajustes → Negocio)
- Nuevo selector **«Costo de lo que compras»** (`data.costoMetodo`), con dos opciones:
  - **Último costo**: el de siempre, y sigue siendo el valor por defecto.
  - **Promedio ponderado**: (lo que hay en bodega × su costo + lo que llega × su costo) ÷ total de unidades.
- Si no hay existencias o el producto no tenía costo, se usa el costo de la compra.
- Se aplica en tres lugares:
  - al aplicar una factura escaneada (`app/04e`);
  - en la entrada de mercancía (`lib/vento-inventario.js`);
  - en «¿Cuántas llegaron?» (`lib/vento-producto-codigo.js`).
- Cada producto guarda también `costoUltimo`.
- **No cambia ventas pasadas**: cada venta ya guardó su costo.

### Lotes y vencimientos
- Al aplicar una factura, cada renglón tiene un campo opcional **«Vence»**. Si se llena, se crea un lote
  (`p.lotes = [{ q, vence, t }]`).
- «¿Cuántas llegaron?» también pregunta «Vence».
- **Al vender sale primero el lote que vence antes (FEFO)** (`invOnSale`). Si una venta se deshace, las unidades
  vuelven al lote más próximo a vencer.
- Los productos sin lotes funcionan exactamente igual que antes.
- **Alertas** (Inicio, solo dueño o administrador):
  - ⛔ lotes vencidos que todavía tienen unidades;
  - ⏳ lotes que vencen en los próximos 15 días.

### Proveedores
- **Estadísticas** tiene dos tarjetas nuevas:
  - **«🏭 Proveedores (compras registradas)»**: compras, total y productos por proveedor;
  - **«⏳ Vencimientos»**.
- **Ficha del producto → historial de costos**:
  - la variación en % entre compras;
  - **«🏭 Comparar proveedores»**: el último costo de cada proveedor, con el más barato marcado.

### Motor (`lib/vento-finanzas.js`)
- Funciones nuevas: `costoTrasCompra`, `proveedores` (lista y comparar), `variacionCosto`, `vencimientos` y
  `descontarLotes`.
- `alertas()` suma las alertas `vencido` y `vence`.

## Archivos
- `lib/vento-finanzas.js`
- `lib/vento-inventario.js`
- `lib/vento-producto-codigo.js`
- `app/04c-personas-voz-ia.js` (FEFO)
- `app/04d-combos-estadisticas-carta.js` (tarjetas)
- `app/04e-facturas-mostrador-domicilios.js` (factura, campo «Vence»)
- `app/04g-productos-historial-caja.js` (comparar proveedores)
- `app/04h-comprobantes-acceso-negocio.js` (Ajustes)
- `index.html` (selector)

## Pruebas
- `pruebas/inventario5.test.js`: **15 ✅** (nueva, en CI). Cubre:
  - el promedio ponderado y el último costo;
  - los proveedores y la comparación;
  - los vencimientos;
  - FEFO;
  - el selector de Ajustes;
  - la factura con lote;
  - la venta que descuenta lotes;
  - «¿Cuántas llegaron?» con «Vence»;
  - la alerta de Inicio;
  - la ficha y las Estadísticas.
- Las demás pruebas están en el mensaje de publicación.

## Sin cambios de datos
- No hay migración: los productos sin `lotes` ni `costoMetodo` se comportan como antes.
- No se modificó ningún registro histórico.
