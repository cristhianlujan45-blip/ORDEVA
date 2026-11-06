# ORDEVA 1.83.0 · Errores de plata y legales primero

**Pedido del dueño:** «Prefijo por equipo, empieza la 1.83». Es la sección 2 del plan `puente/egm/POS-COMPLETO.md`.

## 1. Errores arreglados

### B2 · 🔴 El número de factura ya no se repite entre equipos
- **Antes:** había un solo `invoiceNextNo` para todo el negocio. Si dos equipos vendían a la vez, los dos sacaban la
  misma «Factura de venta N.º».
- **Ahora:** cada equipo lleva su propio consecutivo (`data.facturaEquipos`), con su letra:
  - el primer equipo sigue con la numeración de siempre (FV-0042, FV-0043…);
  - cada equipo nuevo toma la siguiente letra libre y empieza en 1 (FV-B-0001, FV-C-0001…);
  - si dos equipos nuevos toman la misma letra a la vez, el que llegó después pasa a la siguiente.
- Funciona sin internet.
- «Deshacer» una venta devuelve el número solo si fue la última de ese equipo.
- En Ajustes, el «siguiente número» es el de este equipo.
- La factura electrónica DIAN no cambia: su número ya lo daba el servidor.

### B1 · 🔴 El INC del recibo y el de la DIAN ya no se contradicen
- **Antes:** el «INC 8 %» del recibo y el impuesto de la factura electrónica eran dos ajustes sueltos.
- **Ahora:** con la factura electrónica activa, el impuesto de la DIAN manda:
  - al cargar o guardar la configuración DIAN, el recibo toma el mismo impuesto y la misma tarifa;
  - si alguien intenta poner otro en el recibo, sale un aviso que lleva a «Ajustes → Facturación electrónica», y no se
    cambia.

### B3 · 🟠 Juntar dos cierres repetidos ya no deja un faltante falso
- Al juntar los cierres hechos a la vez en dos equipos, se recalculan:
  - lo que debía haber (base + ventas en efectivo de los dos + entradas − salidas);
  - la diferencia con lo contado.
- Si contaron los dos, quedan los dos conteos.

### B4 · 🟠 Los lotes cuadran entre equipos y con la toma de inventario
- Cada lote tiene un id (los viejos lo reciben al abrir ORDEVA).
- Las unidades de cada lote se suman entre equipos, como el stock.
- La toma de inventario ajusta los lotes, empezando por el que vence primero. Ya no sale «por vencer 10 u» con stock 0.

## 2. Ajustes pequeños
- **Excel de Contabilidad** (hoja Resumen):
  - columnas «Período anterior» y «Cambio»;
  - las propinas aparte (son de los empleados, no son venta);
  - la fila «INC por pagar» cuando hay ventas con INC.
- **Stock bajo:** un solo criterio en todo ORDEVA. Cuenta el mínimo del producto (5 si no tiene) o que se acabe en 2 días
  o menos.
- **«🛒 Pedir»** en la alerta de existencias bajas del inicio: abre la lista para pedir al proveedor.

## 3. Pruebas
- **Prueba nueva `v183`:** 18 de 18. Revisa:
  - dos equipos que venden a la vez sin repetir número;
  - el INC de la DIAN en el recibo;
  - el cierre juntado sin faltante falso;
  - los lotes;
  - el Excel;
  - el stock bajo.
- **`ordeva2`:** se ajustó para que toque «Ver» y no el botón nuevo «Pedir».
- **La lista completa (106 pruebas, todas las de GitHub + `facturascan`):** 2.488 revisiones bien, 0 mal.
- **Las 27 del servidor:** pasan.
- **Android (`javaavisos`, con la librería `android-all`):** 328 de 328.
- **No se probó con equipos de verdad.**

## 4. Lo que sigue (plan, sección 3)
- **1.84:**
  - comisiones por persona en cada renglón de la venta;
  - arqueo ciego.
- **1.85:** apartados sobre la cotización.
