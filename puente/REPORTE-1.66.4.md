# ORDEVA 1.66.4 · 🎨 Diseño ORDEVA 2.0 en Caja, Cuentas, Cocina y Estadísticas

## Qué se pidió
Pasar el diseño de la imagen de referencia (ORDEVA 2.0) a todas las pantallas de la app real. Esta versión cubre:
- el punto de venta con fotos y carrito;
- las mesas y los pedidos;
- la cocina por estados;
- la contabilidad y los reportes.

## Qué quedó

### 1. 🧾 Caja / punto de venta (`lib/vento-pos.js` + `lib/ordeva2.css`)
- Cada producto es una tarjeta con **la foto grande arriba**: 4:3 en el computador y cuadrada en el celular.
  - Debajo van el nombre y el precio, con un **«+» negro** en la esquina.
  - Sin foto, sale el dibujo o la letra de siempre, sobre gris claro.
- Categorías en píldoras; la elegida va en negro.
- Carrito:
  - En el computador, cada renglón lleva **la miniatura del producto**. En el celular no, porque no cabe.
  - Abajo, el total grande y **COBRAR negro a todo lo ancho**.
- Lo que está en el carrito se marca con borde negro y el número.
- Sirve igual en la Caja de pantalla completa, en el modo tienda y en el mixto.
- Lo que hace la caja no cambió: cobrar, el lector, la báscula, fiados y el QR siguen igual.

### 2. 🧾 Cuentas (mesas)
- Cada cuenta abierta dice **«⏱ Desde las 9:05 a. m.»**.
  - La hora sale del primer producto anotado en la cuenta (el historial de cada producto).
  - Si no hay ese dato, no se muestra ninguna hora (nada inventado).

### 3. 👩‍🍳 Cocina / preparación por estados
- En el computador es un tablero de **4 columnas lado a lado**:
  - Por aceptar;
  - Recibidos;
  - En preparación;
  - Listos para entregar.
- Las columnas vacías dicen «Nada aquí».
- Cada pedido es una tarjeta blanca con:
  - una franja del color de su estado (rojo, azul, naranja, verde);
  - la mesa, de dónde vino y hace cuánto (en rojo si va tarde);
  - lo pedido;
  - el botón negro para pasarlo al siguiente estado.
- En el celular los estados van uno debajo del otro.
- Con otra apariencia, la pantalla se ve exactamente como antes: las columnas usan `display: contents`.

### 4. 📊 Estadísticas y 💼 Contabilidad
- Las tarjetas de Estadísticas son blancas y planas, sin el degradado ni los códigos «SALES//01».
- **Arreglo:** debajo de la gráfica de ingresos se veía una píldora blanca vacía. Era el globo del gráfico, que
  quedaba visible aunque estaba escondido. Ya no se ve, en ninguna apariencia.
- En Contabilidad, «Gasto / Otro ingreso» ahora es un interruptor negro.

## Pruebas
- Nueva: `pruebas/ordeva2pantallas.test.js` (17 ✅), en la lista de CI. Cubre:
  - la caja en el computador y en el celular: foto, «+», miniaturas, COBRAR y que tocar siga sumando;
  - «Desde las…» con y sin dato;
  - la cocina: las 4 columnas, el orden, el pedido en su columna, «Nada aquí» y que el botón lo avance;
  - la cocina igual que antes en otra apariencia;
  - el globo escondido del gráfico.
- Siguen bien: cajapos, cajaqr, confirmapago, dian, equipos, escanear, facil, facilpantallas, herramientas,
  lectorcel, mejoras, modos y ordeva2.
- Los resultados del resto de la suite están en el mensaje de publicación.

## Lo que no se pudo probar
- En un celular Android de verdad. Se probó en el navegador con el tamaño de un celular (390 × 844). La app Android
  carga estas mismas páginas, así que el cambio llega sin reinstalar.
