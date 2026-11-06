# Revisión Goldfish de POS-COMPLETO.md (borrador 1)

**Cómo se revisó:** cuatro revisores del plugin EGM leyeron el borrador y el código, sin la conversación anterior:
- **Zoom Out:** simplicidad y alcance.
- **Design:** arquitectura.
- **Codebase Details:** exactitud técnica.
- **Implementation Readiness:** listo para construir.

Abajo, lo que se sostuvo al revisarlo contra el código. Las rutas y líneas son las del código de la 1.82.2.

## A. Lo que el borrador decía mal (ya existe)
1. **P1.1 · DIAN con INC.** El servidor ya manda el INC: `supabase/functions/vento-pagos/dian.ts:20`
   (`IMPUESTO = { iva: "1", inc: "4" }`), y lo usa en las líneas 170 y 189. La pantalla lo ofrece en `nube/vento-dian.js:317`.
   - **El problema real:** hay DOS ajustes que no se hablan, y eso se volvió el error B1.
2. **P1.2 · Estado de resultados en Excel.** Ya existe `ctExcel()` (`app/12-fotos-productos-fondo.js:3044`), con cinco hojas:
   Resumen (con costo, utilidad y resultado), Ventas, Productos, Gastos e IVA.
   - **Falta solo:** el mes anterior al lado y la fila del INC.
3. **P2.6 · Alertas.** Ya existen en el inicio:
   - «Existencias bajas» (`lib/ordeva2.js:143`);
   - lotes por vencer a 15 días (`lib/vento-finanzas.js:214-216`).

   La caja marca «poco» (`lib/vento-pos.js:1310`). **Falta solo:** los botones «pedir al proveedor» y «poner en promoción».
4. **Rutas equivocadas en la tabla «lo que ya tiene»:**
   - el corte X y el CSV de cierres están en `lib/vento-caja-mas.js`;
   - los pedidos al proveedor en `app/23-cerebro-app-ventas.js`;
   - el PIN en `app/04h` y su migración;
   - los combos en `app/04d`;
   - la pantalla de cocina en `app/04b`;
   - el iCal en `lib/vento-ical.js`.

## B. Errores reales del código que encontró la revisión (no estaban en el borrador)
- **B1 · 🔴 INC: el recibo y la DIAN usan ajustes distintos.**
  - **Dónde:** el recibo sale de `data.impuestoConsumo` (`app/04h:1742`) y la DIAN de su propia configuración del
    servidor (`dian_config.impuesto`).
  - **Qué pasa:** un restaurante puede prender el INC en uno y no en el otro. El cliente recibe «INC 8 %» y a la DIAN le
    llega IVA, o al revés.
  - **Riesgo:** legal.
- **B2 · 🔴 El número de factura se puede repetir entre equipos.**
  - **Dónde:** `invoiceNextNo` es un número suelto en el documento (`app/04a:989-990`) y no es contador.
  - **Qué pasa:** dos equipos que venden a la vez emiten la misma «Factura de venta N.º». La numeración DIAN la reserva
    el servidor (`srv_dian_reservar`), así que esto afecta el recibo interno, no el documento electrónico.
- **B3 · 🟠 Juntar cierres repetidos (1.82.2) deja un faltante falso.**
  - **Dónde:** `juntarCierresRepetidos` recalcula las ventas, pero conserva el «debía haber» y la diferencia del equipo
    que contó (`app/04g`).
  - **Qué pasa:** si ese equipo no tenía las ventas en efectivo del otro, sale «faltan» a nombre del cajero sin que
    falte nada.
  - **Corrección:** recalcular lo esperado y la diferencia al juntar.
- **B4 · 🟠 Las unidades de cada lote no suman entre equipos.**
  - **Dónde:** `l.q` de los lotes no es contador (`nube/vento-nube.js:287` solo cuenta `stock`).
  - **Qué pasa:** dos equipos que venden del mismo lote pierden un descuento del lote. Además, la toma de inventario y la
    entrada de mercancía cambian el stock sin tocar los lotes: puede salir «por vencer 10 u» con stock 0.

## C. Riesgos de diseño que el borrador subestimó
- **Apartados.**
  - Un vencimiento automático en cada equipo devolvería el stock dos veces.
  - Convertirlo en venta desde dos equipos haría dos ventas. Se necesitan:
    - un id fijo para la venta («apt-<id>»);
    - los abonos como lista, cada uno con su id;
    - el vencimiento a mano.
  - **Mejor:** reutilizar la cotización (`cotizar`, `pasarAVenta`, `abonar` en `lib/vento-caja-mas.js`) en vez de crear algo
    nuevo.
- **Comisiones:** no es de riesgo bajo.
  - Hoy la venta solo guarda quién cobró (`h.by`), no quién hizo cada servicio. Hay que guardar el barbero y la comisión
    en cada renglón al vender, para que cambiar el porcentaje no cambie el pasado.
  - **Además:** el catálogo ya promete comisiones a barberías, salones y lavaderos (`app/03:98`).
- **Arqueo ciego:** lo esperado se ve en cinco lugares, no en uno:
  - el arqueo;
  - el panel;
  - `bloqueHoy`;
  - la confirmación del cierre;
  - el corte X.

  Lo esperado y la diferencia deben calcularse al mostrar el cierre, no guardarse fijos.
- **Bonos:** el saldo en el servidor es correcto, pero faltan tres cosas:
  - redimir de forma idempotente (bono + venta);
  - devolver el saldo al anular la venta;
  - tratar el bono vendido como lo que es (le debes ese valor al cliente: no es venta ni ingreso hasta que lo usa).
- **Traslados entre sedes:** cada sede es otra cuenta y otro negocio, sin relación entre ellas. Es un proyecto grande:
  sale de la lista hasta que se decida soportar varias sedes.
- **T1 · Ventas fuera del documento:** hoy sacar ventas del documento se toma como borrado. Pasa en:
  - la proyección;
  - el freno de «vaciado»;
  - el «parece reiniciado»;
  - los respaldos.

  Hace falta un «archivar ventas» en el servidor con fecha de corte. No se hace sin un plan propio.
- **Estado de resultados:**
  - una devolución de noviembre de una venta de octubre cambia el Excel de octubre ya entregado al contador;
  - la hoja «Ventas» lleva propinas y «Vendido» no.

## D. Lo que la revisión NO cambió
- El arqueo ciego es útil.
- Los apartados y las comisiones son promesas del catálogo que no se cumplen.
- La DIAN con INC era el punto de más riesgo legal. Resultó más fácil de lo pensado: es el error B1.
