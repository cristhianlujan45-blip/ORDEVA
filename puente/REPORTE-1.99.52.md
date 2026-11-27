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

## 1.99.59 — Venta rápida sin los datos del domicilio
- Error real (desde la 1.95.0): «⚡ Venta rápida» de mostrador mostraba siempre «Nombre del cliente», «Teléfono», «Dirección de entrega» y el valor del envío en 0. El estilo display:flex de la etiqueta le ganaba a hidden. Ahora solo salen en «🛵 Domicilio».
- Revisado también: con dos productos del mismo nombre la búsqueda muestra el tamaño de cada uno y se vende el que se escoge.
- Prueba: pruebas/ventarapida1959.test.js 5/5.
- El mismo error en otras ventanas (buscado en toda la app: elementos con hidden y display escrito en la etiqueta):
  - «Exportar ventas a Excel»: los campos de rango de fechas y de cierre salían siempre, aunque se eligiera «Hoy» o «Mes».
  - «🐞 Reportar un problema»: el recuadro de la captura automática salía vacío (imagen rota) cuando no había captura.
  - Los demás casos ya se manejaban bien (cambian style.display); no se tocaron.
- Prueba: ventarapida1959 9/9 (con el código de antes: 4 bien 5 mal). erroresreal 33, ventanas1933 9.

## 1.99.60 — Caja: misma cifra en Cuadre y en Laya, y el negativo se entiende
- «Efectivo que debe haber» en negativo se veía «$-20.000». Ahora «−$20.000» con la nota «Salió más efectivo del que entró…» (si esos pagos no salieron del cajón, márcalos como transferencia en la libreta).
- Laya «¿cuánto hay en caja?» sin caja abierta decía solo el efectivo de las ventas de HOY; «Cuadre» decía otra cifra (desde el último cierre, con fiados cobrados y pagos de la libreta). Ahora las dos usan la misma cuenta (window.ventoCuentaCaja) y Laya dice el detalle.
- Prueba: libretacaja1955 17/17; laya1953 6, propinas1957 13, cuadre1954 5, vistasencilla 45, cuadrefiados1946 8.

## 1.99.61 — El arqueo del cierre cuenta los fiados cobrados y los pagos de la libreta
- Error real (el dueño cierra sin abrir la caja con base): el arqueo del cierre decía «Debía haber» = solo lo vendido en efectivo. Con un fiado pagado en efectivo ese día, al contar salía «sobran»; con un pago a proveedor desde la libreta, «faltan». En la prueba: debía haber $10.000 y al contar $36.000 → «sobran $26.000».
- Ahora, sin caja abierta, el arqueo (y el cierre automático sin contar) suma «Fiados que pagaron en efectivo» como entrada y resta «Pagos en efectivo de la libreta» como salida, del mismo periodo. Quedan en el resumen del cierre (WhatsApp e imagen). Con la caja abierta no cambia nada (eso ya lo llevan sus entradas y salidas).
- Una sola cuenta para «Cuadre», Laya y el cierre (window.ventoMovsSinCaja).
- Prueba: pruebas/cierrefuera1961.test.js 8/8 (con el código de antes: 3 bien 5 mal). Y 22 pruebas de caja y cierre bien (cajagastos, cajamas, cajapro, cajateclado, cerrarcaja, contraste, cuadre1954, cuadrefiados1946, doscierres, laya1953, libretacaja1955, mejoras, pagocuenta1948, propinas, salidas, sincstress, v184, v190, v193, v1954, vistasencilla, cierreauto1947).

## 1.99.62 — «¿Quién me debe?» dice lo mismo que la libreta
- Error real: el asistente («¿quién me debe?», «¿cuánto me deben?») sumaba solo las cuentas fiadas del Historial. La libreta «Me deben» suma también lo anotado en ella («Rosa me debe 20 mil»). Con los datos reales del negocio: Historial $328.600, libreta $355.125.
- Ahora el asistente usa la misma lista de la libreta (window.libretaDeudores): total, personas y lo de cada una.
- Prueba: pruebas/fiadostotal1962.test.js 6/6; cierrefuera1961 8, cuadre1954 5, cuadrefiados1946 8, fiadosnombres 28, laya1953 6, libreta 24, libretacaja1955 17, pagocuenta1948 8.

## 1.99.63 — Devoluciones y caja; la libreta no se cuenta dos veces
- Error real: con la caja abierta, devolver plata en efectivo restaba dos veces: bajaba el pago de la venta (eso ya baja lo que la caja espera) Y anotaba la salida completa. Venta $70.000 en efectivo, devuelve $35.000 → la caja esperaba $0 (al contar: «sobran $35.000»). Ahora en efectivo baja primero el pago en efectivo y solo lo que se había pagado por otro medio es salida. Sin efectivo (saldo a favor / otro medio) baja primero lo fiado y los otros medios; si toca el efectivo, queda como entrada («esa plata sigue en la caja»).
- Una devolución en efectivo (y la venta de un bono en efectivo) con la caja cerrada ABRÍA una caja sola con base $0 (movimiento() abre una si no hay). Ahora solo con la caja abierta.
- Error mío de la 1.99.55: con la caja abierta, pagar en efectivo desde la libreta a un proveedor o empleado se contaba DOS veces en Contabilidad (el gasto de la libreta y el de la salida de caja). Ahora la salida de caja de la libreta no crea otro gasto (movimiento(..., { sinContab: true })).
- Prueba: pruebas/devolucioncaja1963.test.js 7/7 (con el código de antes: 2 bien 5 mal). 46 pruebas relacionadas bien. mejoras paso 4 esperaba la salida de caja de la doble resta: ahora revisa que la caja espere $58.000 (base 50.000 + 13.000 − 5.000).
- CI de la 1.99.62 falló en dos pruebas por cómo están escritas (aquí pasan):
  - mejoras paso 3: la ventana del producto se redibujó por un aviso de Laya y borró «desde» antes del toque (ya había pasado en la 1.99.43). Ahora reescribe y reintenta hasta 3 veces.
  - stocklogpartes paso 3: comparaba dos consumos por día calculados con milisegundos de diferencia con tolerancia 1e-9 (difieren en la 8.ª cifra). Ahora tolerancia relativa de una millonésima.

## 1.99.64 — Borrar y unir productos
- «¿Eliminar producto?» decía solo el nombre («Purina»): con dos del mismo nombre no se sabía cuál. Ahora dice el tamaño («Purina 5 kg») y avisa si está dentro de un combo (al venderlo ya no se descontaría) y si está en cuentas abiertas.
- Unir productos repetidos (Productos → duplicados, y Laya «fusionar»): los combos que traían el producto que se va quedaban apuntando a un producto que ya no existe (dejaban de descontarlo). Ahora pasan al que se queda, igual que su kárdex y sus lotes con vencimiento.
- Prueba: pruebas/productosborrar1964.test.js 8/8 (con el código de antes: 2 bien 6 mal). diseno199 50, inventariodevuelve1958 10, memoria1940 10, productosorden1942 12, recetas 21, sincroniza 27.

## 1.99.65 — Las ventas de las cuentas guardan qué producto y qué tamaño
- Error real: al cobrar una CUENTA (mesa o cuenta de persona), la venta guardaba solo el nombre del producto (sin su id ni su tamaño). Por eso el arreglo de la 1.99.58 no aplicaba a esas ventas: anular, corregir o devolver devolvía el inventario al PRIMER producto con ese nombre (Purina 1 kg en vez de Purina 5 kg). Y «lo más vendido» sumaba los tamaños como un solo producto («6 × Purina»).
- Ahora las ventas de cuentas y de venta rápida guardan el id y el tamaño. «Lo más vendido» (Estadísticas, asistente, Laya, resumen del cierre) separa los tamaños; en ventas viejas con id, el tamaño sale del producto.
- Liberar una venta (volver a su cuenta) buscaba el producto por nombre y perdía el tamaño: ahora usa el id.
- Prueba: pruebas/tamanosventas1965.test.js 8/8 (con el código de antes: 1 bien 6 mal); anularventas, inventariodevuelve1958.
- Error real (ventas por kilo): «Corregir venta» redondeaba las cantidades a entero. Al corregir OTRO renglón, 2,5 kg de maíz pasaban a 3 kg: subía el total y se descontaba medio kilo de más. Ahora acepta decimales (y coma). La devolución también acepta medio kilo.
- Prueba: pruebas/pesocorregir1966.test.js 4/4; anularventas 27, inventariodevuelve1958 10, devolucioncaja1963 7, mejoras 32, cajamas 45.
- Venta rápida: la cantidad se leía con parseInt: 2,5 kg cobraba 2 kg sin avisar (y «+» con 2,5 daba 3). Ahora acepta decimales y el total se redondea a pesos. Si se escribe a mano «purina» y hay dos tamaños, pide escoger en la lista (antes tomaba la primera); «Purina 5 kg» escrito completo sí la agrega.
- Prueba: ventarapida1959 13/13.

## 1.99.66 — Volver a la app después de conectar YouTube
- La batería COMPLETA de pruebas (246, no terminaba desde el 22 de nov. porque las publicaciones la cancelaban) pasó la 1.99.65 salvo appoweb, que falla también aquí (no es casualidad).
- Causa: cuando Google devuelve al navegador una conexión de YouTube empezada en la app, la página saltaba a la app a los 300 ms pasara lo que pasara. Con la página aún cargando, el salto cortaba la carga (y la pantalla «Google listo» con su botón podía no alcanzar a salir). Ahora salta 300 ms después de que la página cargó.
- Prueba: appoweb 25/25, googlevuelta 6/6.

## 1.99.67 — Libreta por voz con productos de distinto tamaño
- Errores reales:
  - «José me debe 2 purinas» → $16.000 (la Purina 1 kg, sin preguntar).
  - «José me debe 2 purinas de 5 kilos» → a «José 2 Kilos», 5 × Purina 1 kg = $40.000 (el tamaño se tomaba como cantidad y como nombre).
  - «José me debe una purina de 1 kg» → a «José Kg».
  - «Pedro me debe 5 kilos de maíz» → a «Pedro Kilos».
- Ahora: el tamaño de un producto que se nombró se quita de la frase y escoge el producto («2 × Purina 5 kg» = $70.000 a José). Sin tamaño y con dos del mismo nombre a distinto precio, pregunta cuál y no anota nada. Por kilo: «5 kilos de maíz» = 5 kg a Pedro.
- Prueba: pruebas/libretatamano1966.test.js 7/7. libreta 24, fiadosnombres 28, libretanombres1942 12, vozcomandos 109, cajavoz 59 y 9 más de libreta/caja.

## 1.99.68 — Pedidos por voz con productos de distinto tamaño
- Error real: por voz, TODAS las frases con «purina» agregaban la Purina 1 kg, aunque se dijera «purina de 5 kilos». Además el lector partía «dos purinas de 5 kilos» en dos productos («purinas» × 2 y «kilos» × 5).
- Ahora el tamaño dicho después del nombre de un producto que tiene ese tamaño se pega al producto antes de partir la frase, y escoge el producto («dos purinas de 5 kilos a la mesa 3» → 2 × Purina 5 kg, y lo dice con el tamaño). Sin tamaño y con varios, no agrega nada y pregunta cuál («¿Cuál? Hay varios tamaños…»). «5 kilos de maíz» (por kilo) no cambia.
- Prueba: pruebas/voztamano1968.test.js 5/5; cajavoz 59, comanda 12, escanercaja 15, microfono 68, pasos 14, suscripnube 67, vozundo sin errores, comandaimpresa 14, facil 47, modos 55, sonidos 38, vozcomandos 109, codigobarras 25.
- codigobarras era intermitente (también sin este cambio): el lector escribía con 8 ms entre teclas y, con la máquina cargada, parecía alguien escribiendo a mano. Ahora escribe sin pausa y espera a que la cuenta se actualice.

## 1.99.69 — El asistente con productos de distinto tamaño
- Error real: «sube el precio de la purina de 5 kilos a 36000» proponía cambiarle el precio a la Purina 1 kg; «llegaron 10 purinas de 5 kilos» las sumaba a la de 1 kg (asisFindProduct no miraba el tamaño).
- Ahora el tamaño dicho escoge el producto; sin tamaño, pregunta «¿Cuál Purina? 1 kg ($8.000) o 5 kg ($35.000)…» y no deja nada para aplicar.
- Prueba: pruebas/asistamano1969.test.js 6/6; inventariodevuelve1958 10, laya1953 6, agente 17.

## 1.99.70 — Avisos de inventario y lista de compras con el tamaño
- «Se está acabando Purina», «Por agotarse: Purina: quedan 2», «Te quedan 2 de Purina», la lista de compras / pedido a proveedores («10 × Purina») no decían cuál de las dos: con dos tamaños se podía pedir el equivocado. Ahora dicen el tamaño cuando hay otro producto con el mismo nombre («Purina 5 kg»); los demás siguen igual.
- Pedidos recibidos escritos: un producto con varios tamaños sale «purina (¿1 kg o 5 kg?)» en la vista previa (antes solo «⚠️»).
- Prueba: asistamano1969 9/9; laya1953 6, layafinanzas 10, agente 17, tablero 26, mejoras 32, pedidostienda 29, comanda 12, canalseguro 16, herramientas 28, opciones 20.

## 1.99.71 — Recibo de una cuenta con el tamaño
- El recibo de una cuenta abierta (compartir por WhatsApp / imprimir) no pasaba el tamaño de cada renglón: salía «2 x Purina». Ahora «2 x Purina (5 kg)», igual que el del Historial (que ya lo trae desde la 1.99.65). Carta (QR), etiquetas y la caja POS ya mostraban el tamaño.
- Prueba: tamanosventas1965 9/9; agencia 13, cajamas 45, cajapos 27, cajapro 56, dian 29, equipos 35, impuestoconsumo 10, mesacomoda 16, tableta1932 16, v183 18.

## 1.99.72 — Buscar en el Historial por tamaño
- El buscador del Historial miraba el nombre del producto pero no su tamaño: «purina 5 kg» no encontraba esa venta. Ahora sí (ventas desde la 1.99.65, que guardan el tamaño).
- Diagnóstico (solo conteos): renglones vendidos con y sin id de producto por día, para confirmar con datos reales que desde la 1.99.65 las ventas guardan el producto.
- Diagnóstico real (conteos de renglones vendidos con/sin id): 21 nov 0/42, 22 nov 0/17, 23 nov 3/1, 24 nov (después de la 1.99.65) 3/0. Las ventas nuevas ya guardan el producto.
- Prueba: tamanosventas1965 10/10; historialorden1947 9.

## 1.99.73 — Preguntas por un producto al asistente
- Error real: «¿cuánto vendí de purina esta semana?» respondía el TOTAL de todas las ventas (otra cifra que la pedida). «¿Cuánto gano con la purina?» daba la de 1 kg sin decirlo. «¿A cómo está la purina?» no respondía sin internet.
- Ahora: si la pregunta nombra un producto, responde las unidades y la plata de ESE producto en el periodo (hoy, ayer, semana, mes; si no se dice, 30 días), por tamaño; las ventas viejas sin tamaño salen aparte («sin tamaño registrado»). Precio, existencias y ganancia: cada tamaño. Sin nombrar producto sigue dando el total.
- Prueba: pruebas/asisproducto1973.test.js 9/9; asistamano1969 9, fiadostotal1962 6, laya1953 6, layafinanzas 10, libretacaja1955 17, musicaanuncios 22, pagosguia 29, propinas1957 13, tamanosventas1965 10.

## 1.99.74 — Detalle de la venta en el Historial
- El detalle de cada venta («Productos vendidos») no decía el tamaño: «Purina ×2». Ahora «Purina 5 kg ×2» (ventas desde la 1.99.65). También en «Anuladas».
- Seguridad: el nombre de cada producto en ese detalle y el motivo de un descuento se ponían en la página sin escapar. Un nombre con código (p. ej. leído de una factura escaneada) se pintaba como imagen o etiqueta. Ahora se muestran como texto.
- Prueba: tamanosventas1965 12/12 (con el código de antes: 10 bien 2 mal); historialorden1947 9, anularventas 27, equipoactividad 32, propinas1957 13, anularcompra1955 15, dian 29.

## 1.99.75 — Mandar la factura, la cuenta y el cierre por WhatsApp (imagen)
- Pedido del dueño: «me crea la imagen pero no me da la opción de mandarla directamente por WhatsApp».
- Causa: para compartir la imagen se usaba «Compartir» del navegador (navigator.share), que dentro de la app de Android (WebView) NO existe. Siempre caía al respaldo: una descarga que en la app no hace nada.
- Arreglo:
  - App de Android (APK nuevo): VentoAndroid.compartirArchivo(nombre, tipo, base64, texto, teléfono) guarda la imagen en la caché («compartir/», FileProvider de siempre) y abre WhatsApp (o WhatsApp Business) con la imagen y el texto; con el celular del cliente (domicilios), en su chat. Sin WhatsApp: el menú «Enviar». Manifiesto: <queries> para com.whatsapp y com.whatsapp.w4b.
  - Página: ventoCompartirImagen() para la factura/cuenta y el cierre: en la app → compartirArchivo; en el navegador → «Compartir»; app vieja (sin compartirArchivo) → se guarda en Descargas/Vento y avisa que actualice la app; si nada → descarga como antes. Celular de 10 dígitos que empieza en 3 → se le pone 57.
- Compilado: javac del paquete Android con android-all.jar (solo faltan las librerías externas de siempre: androidx, BuildConfig, Cast). El APK lo compila GitHub al publicar.
- Prueba: pruebas/whatsappimagen1975.test.js 6/6; cerrarcaja 27, doscierres 7, cajapos 27, dian 29 (una vez intermitente, luego 29/29 dos veces), tamanosventas1965 12, mejoras 32.

## 1.99.76 — Factura en texto por WhatsApp al chat del cliente
- El texto de la factura por WhatsApp (Historial «WhatsApp», recibo de la caja POS) abría siempre «¿a quién?». Si la venta es un domicilio con el celular del cliente, ahora abre SU chat (wa.me/57…). El cierre y lo demás siguen igual (WhatsApp pregunta a quién).
- Revisado: el texto por WhatsApp sí funciona dentro de la app (window.open → la app de Android lo abre con WhatsApp).
- Prueba: whatsappimagen1975 8/8; cajapos 27, cerrarcaja 27, agencia 13.

## 1.99.77 — WhatsApp de respaldo con 57 y descargas a Excel seguras
- **WhatsApp de respaldo de los pedidos por QR / domicilio web**: si el número se guardó sin el 57 (3001234567), wa.me no abría el chat del negocio. Ahora `pedido.html` y el botón de domicilio por WhatsApp le agregan el 57 a un celular de 10 dígitos (si ya lo trae, no lo repite).
- **Descargas a Excel (.csv)**: un nombre que llegue de afuera (p. ej. un pedido por QR) como `=HYPERLINK(...)` Excel lo ejecutaba como fórmula. Ahora todas las descargas (ventas, libro de facturas, contabilidad, cierres, inventario) le ponen `'` delante a un texto que empiece por `= + - @`. Los números (también negativos) no cambian.
- Ventas a Excel, libro de facturas e inventario muestran el **tamaño** del producto (Purina 1 kg / Purina 5 kg).
- Revisión de todos los enlaces wa.me: los demás ya agregaban el 57.
- Errores reales en producción (48 h): ningún error de JavaScript; solo avisos de pagos (no se tocan) y cierres de Android por memoria.
- Pruebas nuevas: `whatsappnumero1977` (4), `csvseguro1977` (6). Probadas también 31 relacionadas (QR, pedidos, facturas, inventario, caja): todas bien.

## 1.99.78 — Un pago ya no suena dos veces (SMS de Nequi)
- **Qué pasaba (datos reales del 25/11, negocio adc9bb00, Samsung, SMS de Nequi 890806):** cada SMS nuevo hacía sonar OTRA VEZ el anterior unos 3 s después (5.600 → 4.600 → 5.600 otra vez; 6.000 → 7.100 → 6.000…). En el servidor quedaban dos pagos «revisar» del mismo valor. 23 parejas así en los últimos días.
- **Por qué:** cuando llega un SMS nuevo, la app de mensajes vuelve a mostrar la conversación con el SMS de antes, pero con otra hora (la del celular y no la del banco) o con el texto completo cuando antes venía cortado. La marca «hora + texto» de la 1.99.52 no lo reconocía y la marca del lector directo de SMS ya se había gastado: el SMS viejo se tomaba como pago nuevo, sonaba en este celular y, por el servidor, también en los demás.
- **Arreglo (app Android, VentoEscucha):** cada SMS tomado (por el lector directo o por el aviso de mensajes) queda marcado por su texto durante 30 min. Un SMS de ANTES en la conversación que ya se tomó no vuelve a sonar. El más nuevo sigue su camino de siempre: dos pagos iguales de verdad siguen sonando los dos.
- No cambia nada más de los pagos (ni la lectura de Nequi/DaviPlata por la app, ni Bre-B, ni el servidor, ni el latido del servicio).
- Pruebas: 4 casos nuevos en la simulación de Android (`EscuchaPrueba`): fallaban antes del arreglo (daban 5.600 dos veces) y ahora pasan. Toda la simulación: 384 bien, 0 mal.
- **Hay que actualizar la app ORDEVA en el Samsung** (y en el Xiaomi) para que tome el arreglo.

## 1.99.79 — La cuenta de la mesa con los tamaños
- El **resumen de la cuenta** y **«Pagar por productos»** mostraban «Purina» dos veces cuando la mesa tenía Purina 1 kg y Purina 5 kg. Ahora sale cada uno con su tamaño (también en la línea «Paga: …»).
- Esos dos lugares ya no meten el nombre del producto como HTML: un nombre raro (de una foto de factura o un texto pegado) sale como texto.
- Diagnóstico de pagos (25/11 tarde): los SMS repetidos siguieron porque el Samsung sigue con la app vieja (reporta 1.99.73). El arreglo de la 1.99.78 empieza a funcionar cuando se instale la app nueva.
- Prueba nueva: `cuentatamano1979` (4). Probadas también 10 relacionadas (cuentas, mesas, pagos por partes, QR): todas bien.

## 1.99.80 — El servidor ya no recibe el mismo aviso de pago cientos de veces
- **Qué se vio (diagnóstico de pagos, 25/11 noche):** en `pago_eventos` cada aviso del Samsung tenía cientos de «· duplicado»: el mismo aviso llegaba otra vez cada pocos segundos durante 30 min. El servidor lo contaba UNA vez (no había pagos de más por esto), pero era tráfico y batería gastados, y la fila de la página quedaba trabada en el primer aviso.
- **Por qué:** la ruta `/aviso` del servidor de pagos respondía sin `Access-Control-Allow-Origin`. La página de ORDEVA (también dentro de la app Android) manda desde `cristhianlujan45-blip.github.io`: el aviso SÍ se guardaba, pero el navegador no dejaba leer la respuesta, la página creía que había fallado y lo volvía a mandar.
- **Arreglo (servidor `vento-pagos`):** `/aviso` responde con las mismas cabeceras CORS que las demás rutas (solo para los orígenes de ORDEVA; un sitio ajeno no). No cambia cómo se leen ni se cuentan los pagos.
- Prueba: `pruebas/servidor/avisos.test.js` 2b/2c (fallaba antes del arreglo; ahora 36 bien). Probadas también las del servidor de pagos privados, canal, permisos, aislamiento y errores: todas bien.
- Sobre los SMS repetidos: a las 9:32 p. m. del 25/11 volvió a pasar (4.000 sonó otra vez al llegar 3.500): el Samsung todavía no tiene la app Android 1.99.78.

## 1.99.81 — Fechas con la hora de Colombia (no la de UTC)
- Varias partes sacaban «hoy» con la hora de UTC: después de las **7 p. m.** de Colombia ya era «mañana».
  - **Vitrina (página de pedidos):** una promo «hasta hoy» dejaba de publicarse a las 7 p. m. de su último día. Ahora dura hasta la medianoche.
  - **Ventas a Excel → Rango:** después de las 7 p. m. proponía la fecha de mañana (y salía «No hay ventas»). Ahora propone hoy. Los nombres de los archivos (hoy-, ayer-, mes-, cierre-) también salen con la fecha de Colombia.
  - **Copias automáticas del día:** el punto del día cambiaba a las 7 p. m.; ahora a la medianoche.
  - **Modo fácil (entrada de inventario):** la fecha del movimiento salía de mañana después de las 7 p. m.
- Prueba nueva: `fechacolombia1981` (3), con el reloj a las 8:30 p. m. de Colombia: fallaba antes del arreglo y ahora pasa. Probadas también 9 relacionadas: todas bien.

## 1.99.82 — Saber qué versión de la app Android tiene cada celular
- El servidor no sabía qué app Android tenía cada equipo: la versión va al final de la descripción del navegador y se cortaba a los 120 caracteres. Por eso no se podía confirmar si el Samsung ya tenía la 1.99.78 (la de los SMS repetidos).
- Ahora el aviso de instalación y el de errores mandan «VentoAndroid/1.99.xx · …» al PRINCIPIO, y la instalación se vuelve a avisar cuando cambia la app Android (no solo la página).
- `diagnostico-pagos` (solo lectura) muestra `apps_android`: versión de la app, modelo del celular y versión de la página de cada equipo con app (sin nombres).
- No toca los pagos ni el registro de los celulares autorizados (no cambia su token).
- Probadas 12 pruebas relacionadas (errores, admin, equipos, pagos) y las del servidor de errores: todas bien.

## 1.99.83 — La app Android se actualiza de madrugada · pruebas automáticas al día
- **Por qué el Samsung no se actualizaba:** ORDEVA deja la pantalla prendida (`FLAG_KEEP_SCREEN_ON`) y el actualizador solo instalaba cuando ORDEVA NO estaba en pantalla. En un negocio con el celular siempre en ORDEVA, nunca era «buen momento»: el Samsung se quedó sin la 1.99.78 (la de los SMS repetidos).
- **Arreglo (`PlanActualizar`, `Actualizador`, `Arranque`, `MainActivity`):** de **3:00 a 4:59 a. m.** se instala aunque ORDEVA esté en pantalla, si nadie la tocó ni llegó un pago en los últimos 30 min (de 1 a 3 a. m. no, por los bares). Al terminar, ORDEVA se vuelve a abrir sola. De día sigue igual: se instala cuando no está en pantalla, o con «Actualizar ahora».
- Prueba nueva `PlanActualizarPrueba` (9 casos: de día, de madrugada, bar abierto a la 1-2 a. m., 5 a. m., la tocaron hace 10 min, pago hace 20 min). Toda la simulación de Android: 393 bien.
- **Pruebas automáticas:** la batería completa de la noche va en su propia fila y ya no la cancela cada publicación (de 21 noches casi ninguna había terminado). Las acciones de GitHub pasan a las versiones con Node 24 (checkout v5, setup-node v5, cache v5, setup-java v5, upload-artifact v6, setup-gradle v5): GitHub avisaba que las de Node 20 dejan de funcionar.
- Esta actualización de la app Android hay que instalarla UNA vez más con «Actualizar ahora» (Ajustes) en el Samsung: desde esta versión, las siguientes llegan solas de madrugada.

## 1.99.84 — Lista blanca (CSP) en la página pública de pedidos
- `pedido.html` (la que abren los clientes con el QR) ahora trae su **Content-Security-Policy**: solo carga código de ORDEVA (nada de otros sitios), solo se conecta con el servidor de ORDEVA (Supabase), las búsquedas de YouTube y el cambio de moneda; sin `<object>`, sin cambiar la base de la página ni mandar formularios a otro lado. Imágenes de cualquier sitio seguro (las fotos de las canciones vienen de YouTube).
- Como la página tiene código dentro de ella misma (3 bloques y 29 botones con `onclick`), se deja `'unsafe-inline'`: la lista no frena un texto que se cuele como código, pero sí que ese código traiga más código de afuera o se lleve datos a otro servidor (lo más dañino).
- Si algo queda bloqueado, se anota en el registro de errores («Bloqueado por la lista blanca (CSP) en pedidos: …») para revisarlo.
- Prueba nueva `cspedido1984` (5). Probadas las 29 pruebas que usan la página de pedidos (QR, música, PLAY, tienda, cuentas, WhatsApp…): todas bien.
- Pendiente para más adelante (más grande): pasar el código de los botones a archivos aparte para quitar `'unsafe-inline'`, y luego hacer lo mismo en la app (index.html).

## 1.99.85 — La plata escrita con puntos de miles («8.000») ya no queda en $8
- **Qué pasaba (probado en el navegador):** en los campos de número, el punto es el decimal. Escribir **«8.000»** en el valor de un pago dejaba **8** (y «1.500.000» quedaba en 1,5). Igual en el precio y el costo del producto, el gasto de contabilidad, el envío, la libreta, la caja, las reservas…
- **Arreglo (app/01):** en los campos de PLATA el punto y la coma de miles se ignoran al escribir (computador y celular) y al pegar: «8.000» → 8000, «1.500.000» → 1500000, pegar «12.500» → 12500. Se reconocen por su nombre (precio, costo, monto, valor, pago, abono, envío…) o por su paso (de a 50, 100, 500…), también los que se crean después.
- Los de **porcentaje, retención, IVA, cantidad, peso, días** y el costo por kg de las recetas no se tocan (ahí sí hay decimales: «2.5» sigue 2.5).
- Prueba nueva `plata1985` (10): fallaba antes del arreglo. Probadas también 20 relacionadas (cobrar, mesas, libreta, caja, contabilidad, reservas, IVA, venta rápida, propinas): todas bien.

## 1.99.86 — Lo mismo en ORDEVA Admin
- El arreglo de la 1.99.85 pasa a su propio archivo (`lib/vento-plata.js`) y se carga también en **ORDEVA Admin** (precio del plan, valor de un pago, precio de la licencia: «120.000» → 120000). Los días, sedes y cantidades del admin no se tocan.
- Probadas: plata1985, modulos, adminreal, adminmasdatos, appoweb, v196, cobrosimple: todas bien.

## 1.99.87 — Asistencia sin horas infladas · tasa del dólar con decimales
- **Asistencia:** si alguien marcaba la entrada y se olvidaba de la salida, el turno seguía sumando hasta hoy (entró ayer a las 8 a. m. = 30 o 40 h) y el resumen de horas para la nómina salía inflado. Ahora un turno sin salida cuenta **máximo 16 h** y sale «⚠️ no marcó la salida»; si la salida se marca al día siguiente, también cuenta 16 h y sale «⚠️ … revisa». A la persona le aparece «entraste el … y no marcaste la salida: márcala ahora». También en «📋 Copiar el resumen».
- **Dólares:** la tasa se escribía en un campo que quitaba todo lo que no fuera cifra: «4152.35» o «4.152,35» (como la dan las noticias o el banco) quedaba en **415.235** pesos por dólar (100 veces más) y el total en dólares salía 100 veces más bajo. Ahora se leen bien: 4152. Si la tasa queda fuera de lo normal (menos de $1.000 o más de $10.000) avisa «revisa la tasa».
- Revisados sin cambios: comisiones (el % se calcula sobre el precio completo aunque la venta tenga descuento: es una decisión del negocio, queda igual) y domicilios.
- Prueba nueva `asistenciadolar1987` (6): fallaba antes del arreglo. `v192` (asistencia) sigue bien.

## 1.99.88 — La plata pegada con centavos («$ 8.000,00») ya no sale 100 veces más
- Varios campos de texto para plata quitaban todo lo que no fuera cifra: «8.000» quedaba bien (8000), pero «**$ 8.000,00**» (como lo copia la app del banco) quedaba en **800000**, 100 veces más. Pasaba en: movimientos y arqueo de la caja (`vento-turno`), caja ampliada (`vento-caja-mas`), precio en esta venta / valor libre de la caja POS, consumo mínimo de las mesas, bonos de regalo y pagos de comisión.
- Ahora todos usan `ventoLeerPlata` (lib/vento-plata.js): «8.000», «$ 8.000», «8000», «8.000,00», «8000.50», «1.500.000», «1,500,000.00» → pesos enteros (los centavos del final no cuentan).
- Prueba nueva `leerplata1988` (4). Probadas también 20 relacionadas (caja, cuadre, gastos, salidas, devoluciones, propinas, libreta, Laya, mínimo, bonos…): todas bien.
- Diagnóstico de hoy: el Xiaomi ya tiene la app Android 1.0.94; el Samsung sigue con la vieja (4 SMS repetidos hoy). Sin bloqueos de la CSP en pedidos.

## Pruebas automáticas con la hora de Colombia (después de la 1.99.88)
- El CI de la 1.99.88 salió en rojo en `propinas1957`, `tamanosventas1965` y `asisproducto1973`: la corrida pasó la medianoche UTC (7 p. m. de Colombia) y esas pruebas crean ventas «de hace 20-50 minutos», que en UTC quedaban como de ayer. Reproducido aquí a las 00:21 UTC: en UTC fallan (6/13, 5/9); con la hora de Colombia pasan (13/13, 9/9, 12/12). No era un error de la app.
- `pruebas-app.yml` corre ahora con `TZ: America/Bogota` (la hora donde se usa ORDEVA).
