# ORDEVA 1.79.0 · 🧮 Caja como calculadora · 💸 todas las salidas en Contabilidad · 📦 Tarifas simples

## 1. 🧮 Caja POS: valor libre y cantidad (pedido del dueño)
«Si quiero poner 5000, por ir sumando, no me deja. Que yo vaya diciendo 5000 como una calculadora, y que pueda poner la
cantidad, no solo el producto.»

**Antes:** la caja solo vendía productos creados. Escribir 5000 no hacía nada.

**Ahora (`lib/vento-pos.js`):**
- **Teclado en la caja:**
  - 7 8 9 ⌫ / 4 5 6 × / 1 2 3 C / 00 0 000 ➕ Agregar, con la pantalla del número arriba.
  - Se puede esconder con un toque y queda guardado así.
- **Como una calculadora:**
  - «5000 ➕» agrega «Varios $5.000».
  - «3000 ➕» lo va sumando, y el TOTAL dice $8.000.
- **Cantidad:**
  - «3 × 1500 ➕» son 3 de $1.500.
  - «3» y luego tocar un producto lleva 3 de ese producto, sin tocarlo 3 veces.
  - «4 ×» y luego tocar el producto hace lo mismo.
- **Escribiendo en el buscador (teclado del computador):**
  - «5000», «$5.000», «5000+3000», «2*2500» o «120000», + Enter.
  - «3» + Enter sigue siendo la cantidad del último producto.
  - Un código de barras largo sigue siendo código, no un valor.
- **Por voz:** «cinco mil», «más tres mil», «tres por mil quinientos», «varios ocho mil». «Dos empanadas» sigue igual.
- **«Varios»:**
  - No es un producto, así que no descuenta inventario ni tiene costo.
  - Al tocar su precio se le pone qué es («Recarga», «Fotocopias») y su valor.
- **✏️ Precio solo en esta venta** (lo tienen todos los POS y faltaba):
  - Al tocar «$3.500 c/u ✏️» en la venta se cambia el precio solo para esa venta.
  - El producto sigue con su precio, y la venta guarda el precio normal para verlo después.
  - Un empleado necesita la clave del dueño, y el cambio queda en la auditoría.
  - Está el botón «Volver a $3.500».

## 2. 💸 Todas las salidas quedan en Contabilidad
«Cuando uno saca plata de los bancos del negocio… todas las salidas deben quedar registradas para la contabilidad.
Como este que dice *Pasaste $10.000*: tiene que quedar bien contabilizado.»

**Sobre las dos capturas:**
- ORDEVA leyó bien que **«Pasaste $10.000 a otro DaviPlata» es plata que SALE**, no un pago recibido.
- El aviso morado «💜 Recibiste $10.000 por DaviPlata» corresponde a la plata que **entró** a un DaviPlata del negocio.
- Por eso se ven las dos cosas.

**Antes:** las salidas esperaban en una lista a que alguien las clasificara. Si nadie lo hacía, no llegaban a la
contabilidad.

**Ahora (`lib/vento-salidas.js`):**
- **Cada salida que lee el celular del dueño queda anotada en Contabilidad apenas llega.** Las que se leen son:
  - enviaste, pasaste, pagaste o transferiste;
  - compra exitosa o compra aprobada;
  - retiros en cajero o corresponsal;
  - débitos («se debitó»).
- **Cómo queda anotada:**
  - como gasto de la categoría que se sugiera: proveedor si ya se le pagó antes o tiene el nombre de una factura;
  - si no hay sugerencia, como «Otros gastos».
- **🏧 Los retiros de cajero o corresponsal no son gasto.** Quedan como «Retiro: de banco a efectivo». No suman a gastos
  ni a entradas, y en la lista se ven con 🏧 y «no es gasto».
- **En Contabilidad, «Salidas del banco por revisar» dice cómo quedó cada una.** Con un toque se puede:
  - ✅ dejarla así;
  - 📦 pasarla a proveedor o 🗂️ a otra categoría;
  - 🏧 marcarla como retiro a efectivo, o 🙋 como retiro del dueño;
  - 🔗 marcarla como «ya estaba anotada»;
  - 🙈 marcarla como «no es del negocio» (pide confirmación).

  Al cambiarla se reemplaza el movimiento, nunca se duplica.
- **No se anota sola** cuando parece el pago de una factura que ya se escaneó (para no contarla dos veces) ni cuando va a
  alguien que ya se marcó como «no es del negocio».
- **➖ La salida de efectivo de la caja** (pago a proveedor, domicilio, gastos…) **también queda en Contabilidad**,
  pagada en efectivo:
  - «Retiro del dueño» queda como retiro y no como gasto;
  - la devolución no se duplica, porque ya baja las ventas.
- **Android:** reconoce también «Retiro exitoso por… en corresponsal», «Se debitó…» y «Compra aprobada…» como plata
  que sale.

## 3. 📦 Productos / Tarifas simples y elegantes (lo de la captura del hotel)
- «Precio y margen con foto» ya no es una tarjeta enorme arriba. Ahora es un botón pequeño «📸 Precio con foto IA» en una
  fila de herramientas, junto a «🧩 Unir repetidos» y «🛒 Pedido a proveedores».
- **Lo principal es «➕ Agregar».** Lo demás va en una sola lista, una línea por opción, como los ajustes de un celular:
  - inventario por código;
  - insumos y recetas;
  - factura del proveedor;
  - etiquetas.
- **Hoteles:** sus tarifas no son mercancía. No se muestran stock, agotados, «sin control de stock», etiquetas, pedido a
  proveedores ni precio con foto.

## Pruebas
- **Nuevas o actualizadas:**
  - `cajalibre` (nueva, 28 ✅, en el celular): teclado, suma, cantidad × producto, ⌫ y C, buscador, voz, cantidad de
    «Varios», cobro sin tocar el inventario, precio solo en esta venta, nombre de «Varios», esconder el teclado.
  - `salidas` (26 ✅): anotar al llegar, cambiar sin duplicar, factura ya escaneada, «no es del negocio» que se recuerda,
    retiros a efectivo que no son gasto, salida de caja en Contabilidad.
  - Reglas de Android (`javaavisos`, 262 ✅, con 4 casos nuevos de retiros y débitos).
- **Siguen bien:** `cajapro` (56), `cajateclado` (17), `cajapos` (27), `cajaextra` (14), `cajavoz` (59), `escanercaja`
  (15), `cajaqr` (13), `cerrarcaja` (26), `cajagastos` (10), `finanzas` (17), `layafinanzas` (10), `pagosaviso` (94) y
  las demás de la lista de la app.

## 🔎 Análisis de la caja: qué tienen los sistemas de caja y qué le falta a ORDEVA
### Lo que ORDEVA ya tiene (como Siigo POS, Alegra, Loyverse o Square)
- **Vender:**
  - lector de código de barras, cámara como escáner y báscula con etiqueta de peso;
  - productos por kilo o libra, precio por cantidad (mayorista), favoritos, categorías y recientes;
  - atajos de teclado (F1 a F9), venta por voz y, desde ahora, valor libre y cantidad.
- **Cobrar:**
  - billetes rápidos, vuelto en grande, pago combinado;
  - Nequi, DaviPlata, Bre-B, tarjeta y QR de pago;
  - fiado y factura electrónica DIAN.
- **Durante la venta:** descuento con clave del dueño, nota, cliente, suspender y recuperar, repetir una venta, anular con
  permiso, recuperar la venta si se cierra la app.
- **Equipos:** cajón de dinero e impresora térmica.
- **Caja del día:** abrir con base, entradas y salidas de efectivo, arqueo de billetes al cerrar, «Caja de hoy» y
  resumen del día.

### Lo que le falta, por orden de impacto
1. **Cotización:** armar la venta y mandarla por WhatsApp o en PDF sin cobrarla; con un toque pasa a venta. Lo usan
   ferreterías, depósitos y distribuidoras.
2. **Devolución desde la caja:** buscar la venta (o leer el recibo), elegir qué se devuelve y devolver en efectivo o como
   saldo a favor, con nota crédito DIAN si tenía factura. Hoy la devolución está en Inventario, no en la caja.
3. **Corte X (corte parcial) por cajero:** ver lo vendido hasta ahora y por cada medio de pago sin cerrar la caja, y el
   cambio de turno entre cajeros con su propio arqueo.
4. **Teclas de acceso rápido configurables** (las de las registradoras): «Recarga», «Fotocopia», «Bolsa» a un toque, con
   su valor fijo o abierto.
5. **Lista de precios por cliente:** precio de mayorista o de cliente especial que se pone solo al elegir el cliente.
6. **Puntos o saldo a favor** del cliente: que se acumulen solos al vender y se usen como medio de pago.
7. **IVA por tarifa en el recibo:** hoy el recibo saca la base y el IVA con una sola tarifa (19 %). Falta separarlos
   cuando la venta tiene productos al 19 %, al 5 % y exentos, como ya lo hace el informe de IVA.
8. **Pantalla del cliente:** una segunda pantalla o tablet donde el cliente ve lo que se registra, el total y el QR para
   pagar.
9. **Propina sugerida en la caja (para restaurantes):** 10 % que el cliente acepta o no, aparte de las ventas, porque es
   de los empleados.
10. **Reporte de lo que más se vende por hora:** ayuda a saber cuándo poner más gente en la caja.

**Recomendación:** hacer primero la 1 (cotización) y la 2 (devolución desde la caja). Son las que más piden las tiendas
y ya se puede reutilizar lo que existe: suspender la venta, recibo por WhatsApp y DIAN.
