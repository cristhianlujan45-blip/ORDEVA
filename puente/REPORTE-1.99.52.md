# ORDEVA 1.99.52 — Un pago por SMS ya no vuelve a sonar cuando llega el siguiente

## La causa real del «me sonó 3.500 y después 1.400 que habían puesto antes» (23/11)
Registros del servidor de esa franja (sin nombres): en el Samsung los pagos de Nequi llegan por SMS (código 890806).
- 3:31:29 p. m. llega el SMS de $1.400 → se toma y suena (bien).
- 3:37:36 p. m. llega el SMS de $3.500 → suena (bien).
- 3:37:41 p. m. el de $1.400 se toma OTRA VEZ (mismo texto, misma hora del banco 3:31) → sonó y quedó anotado dos veces.
Igual con $6.000 (3:25 → otra vez 3:28) y $8.100 (3:28 → otra vez 3:30).

Por qué: el SMS llega por dos lados (directo y en el aviso de la app de mensajes). El lector directo dejaba una marca para
que el aviso no lo repitiera, y el aviso la GASTABA. Cuando llegaba el SMS siguiente, la app de mensajes volvía a publicar la
conversación con el SMS anterior; ya no había marca y ese pago viejo se tomaba como nuevo.

Arreglo: cada mensaje de la conversación (su hora + su texto) se maneja una sola vez. Dos pagos iguales de verdad (dos SMS
de $1.400 a distinta hora) siguen sonando los dos.

## Pruebas
- Android (sin celular): 380/380, con el caso real (antes: «1400, 3500, 1400, 3500»; ahora «1400, 3500»). Sin el arreglo la
  prueba falla.

## Diagnósticos nuevos (solo lectura)
- `diagnostico-pagos`: ventana de tiempo de un negocio (eventos y pagos con hora del banco y del celular, sin nombres).
- `diagnostico-formatos`: ¿se escapó un pago? (avisos no entendidos por las reglas, solo palabras clave, nunca el texto).
- `diagnostico-fiados`: integridad de los datos y qué parte pesa más.

# 1.99.53 — Auditoría de la Caja POS y de Laya
- **Caja POS (un día simulado en la agropecuaria):** efectivo con vueltas, pago mixto, descuento 10 % y fiado a Tania →
  FV-0001 a FV-0004, inventario descontado, caja $88.000, Contabilidad $73.000 vendido / $15.000 por cobrar / costo
  $49.000. Todo cuadra, sin errores.
- **Laya («no debe inventar cifras»):** a «¿cuánto hay en caja?» respondía $73.000 (TODO lo vendido, con transferencias y
  fiado). Ahora dice el efectivo del cajón: «En la caja debe haber $88.000 en efectivo: base $50.000 + ventas en efectivo
  $38.000», y aclara que lo de transferencias y lo fiado no está en la caja. Sin caja abierta, el efectivo que entró.
- «¿Cuánto vendí hoy?» decía «4 cuentas cobradas» aunque una quedó fiada: ahora «4 ventas (de eso $15.000 quedó fiado)».
- «¿Cómo va todo?» decía «0 facturas este mes» (eran las de proveedor): ahora «facturas de proveedor».
- Aviso «el equipo de la música no da señales»: se recuerda en el equipo (antes volvía a salir a los 5 min de abrir ORDEVA).
- Pruebas: `laya1953` 6/6 (nueva), musicaautoplay 13, layafinanzas 10, vozcomandos 109, guia 47, resumendia 7, agencia 13,
  musicaanuncios 22, pagosguia 29, proveedores 8.

## 1.99.54 — Cuadre de caja (vista sencilla)
- Problema: la pestaña «Cuadre» solo contaba el efectivo de las ventas. Los fiados que pagaron en efectivo (libreta, «Ya pagó», abonos de crédito) no aparecían en ningún lado, y si no se abre caja con base, esa plata no cuadraba.
- Arreglo: nueva fila «📒 Fiados que pagaron (efectivo X · otros Y)» y fila resaltada «💵 Efectivo que debe haber»: con caja abierta usa lo esperado del turno (base + ventas + entradas − salidas); sin caja, efectivo de ventas + fiados cobrados en efectivo.
- Prueba: pruebas/cuadre1954.test.js 5/5. También pasan cajateclado 17, vistasencilla 45, cuadrefiados1946 8, cerrarcaja 27, mejoras 32, cajamas 45.

## 1.99.55 — Anular una factura de proveedor
- Problema: una factura de proveedor aplicada por error (por ejemplo dos veces) no se podía quitar: el inventario quedaba inflado y el gasto contado doble en Contabilidad.
- Arreglo (autorizado por el dueño): en «📚 Facturas anteriores» → la factura → «🚫 Anular esta factura». Pide la autorización (el jefe pasa; el equipo con la clave del dueño) y el motivo, igual que anular una venta.
  - Sale de las compras (deja de contar como gasto e IVA). Lo que sumó al inventario se descuenta, sin bajar de 0 (avisa cuáles no alcanzan).
  - Se quitan sus movimientos de inventario y su lote con vencimiento (desde ahora cada lote guarda de qué factura vino).
  - Si estaba enlazada a un pago a proveedor de la libreta, el pago pasa a otra factura igual del mismo proveedor (la buena); si no hay, el pago cuenta solo.
  - Queda en data.anuladas (tipo 'compra') y se ve en Historial → «Anuladas». La nube (ventoQuitarAnuladas) la quita si otro equipo todavía la tiene, así no vuelve.
  - El costo de los productos no se toca.
- Prueba: pruebas/anularcompra1955.test.js 14/14.

## 1.99.55 — Libreta y caja
- Error real: en la libreta por voz, «… por Nequi / por transferencia / con DaviPlata» quedaba como parte del nombre («Pedro Nequi», «Agro Sur Transferencia»), y después «le pagué a Pedro» se iba a «Pedro Nequi». Ahora se quita antes de leer el nombre y el pago queda como transferencia.
- Con la caja abierta, pagarle en efectivo a un empleado o a un proveedor desde la libreta es una salida de la caja (antes solo entraban los fiados cobrados, y el cuadre decía que debía haber más plata). Por transferencia no sale; «me equivoqué» quita la salida.
- Sin caja abierta, «Cuadre» resta lo pagado en efectivo desde la libreta en su propio renglón («💸 Pagos en efectivo de la libreta»).
- Prueba: pruebas/libretacaja1955.test.js 12/12. También pasan cuadre1954, libreta, libretanombres1942, fiadosnombres, pagocuenta1948, cuadrefiados1946, laya1953, mejoras, vistasencilla, cerrarcaja, y para lo de anular facturas: anularventas, esquinas, facturascan, finanzas, girofactura, guia, inventario5, ivaexcel, proveedores, salidas, sincroniza.

## 1.99.56 — Formulario de la libreta: efectivo o transferencia
- Los botones «Me pagaron», «Pagué a un empleado» y «Pagué a un proveedor» ahora preguntan cómo fue: 💵 Efectivo (por defecto) o 📱 Transferencia. Con la 1.99.55 el efectivo entra o sale de la caja, así que hacía falta poder decir que fue por transferencia sin hablar.
- Diagnóstico real (solo conteos): la libreta del negocio no tiene ningún nombre con «nequi/transferencia» pegado (3 apuntes, todos «me debe»). No hay nada que limpiar.
- Prueba: libretacaja1955 16/16; libreta 24, libretanombres1942 12, fiadosnombres 28, pagocuenta1948 8, cuadrefiados1946 8.

## 1.99.57 — Las propinas no son venta (mismas cifras en todas las pantallas)
- Auditoría de consistencia: las mismas ventas del día deben dar lo mismo en Cierre, Contabilidad, Estadísticas, Corte X, «Hoy» del punto de venta, el asistente y Laya.
- El cierre de caja y Contabilidad ya sacaban la propina de «Vendido» (es de los empleados). Pero la sumaban como venta:
  - Estadísticas («💰 Ventas», horas, mesas, empleados, comparativo semana/mes, vs. período anterior) y mostraba «🙏 Propina» como producto vendido.
  - El análisis de ventas (app/23): la sumaba a las ventas y a la GANANCIA.
  - Laya «¿cuánto hay en caja?» («Hoy vendiste…»), el asistente («¿cuánto vendí?», ventas de hoy/semana) y el total por voz.
  - El Corte X (total y por cajero) y la pantalla «Hoy» del punto de venta.
- Ahora todas usan la venta sin propina. El Corte X muestra «🤝 Propinas» en su renglón (ya van dentro de los medios de pago, como en el cierre). La descarga de Excel de Estadísticas sigue con lo cobrado renglón por renglón.
- También el «Total vendido» de arriba del Historial. Y en «Anuladas» las facturas de proveedor se cuentan aparte con su valor.
- Prueba: pruebas/propinas1957.test.js 13/13; anularcompra1955 15/15; anularventas 27/27; equipoactividad 32; historialorden1947 9; y ajustesequipo, cerrarcaja, cobrosimple, confirmapago, facil, finanzas, flujocompleto, guia, impuestoconsumo, inventario5, laya1953, layafinanzas, musicaanuncios, pagosguia, practica, propinas, tablero, v183, v195, v1954 todas bien.

## 1.99.58 — El inventario vuelve al producto que se vendió
- Error real (el negocio tiene 4 productos con el mismo nombre y distinto tamaño): al anular o corregir una venta, el inventario volvía buscando el producto por NOMBRE → iba al primero con ese nombre (Purina 1 kg en vez de Purina 5 kg). Si el producto se había renombrado, no volvía a ninguno. Un combo no devolvía sus productos.
- La devolución buscaba «mismo id O mismo nombre» y se quedaba con el primero de la lista: el mismo problema.
- Ahora anular y corregir van por invOnSale (como la venta: por id, combos a sus productos, de vuelta a su lote) y la devolución busca primero por id y reparte los combos.
- Anular un día entero sigue sin devolver inventario (así lo dice el mensaje; no se cambió).
- Prueba: pruebas/inventariodevuelve1958.test.js 7/7 (con el código de antes: 2 bien 5 mal, todo iba a la Purina 1 kg).
- Además: editar un producto por voz o con el asistente («súbele el precio a Purina», «súmale 4 a Purina») tomaba el PRIMER producto con ese nombre. Ahora usa el tamaño que se dijo; si no se dijo y hay varios, pregunta cuál y no cambia nada. El asistente pasa el id del producto que ya escogió y muestra el tamaño al confirmar («Voy a sumar 4 unidades a Purina 5 kg»).
- Prueba: inventariodevuelve1958 10/10.
