# Vento 1.46.0 · Balanza, venta por peso, impresora de facturas y cajón de dinero

El dueño: «Hay tiendas que manejan verduras: el sistema tiene que conectarse con una balanza. Mira Siigo POS y la
competencia para agregarle lo que le falta. Y que se conecte una caja para meter billetes por USB, y la impresora de
facturas».

## ⚖️ 1. Venta por peso
- **En el producto:** Editar producto → **«⚖️ Se vende»**:
  - Por unidad.
  - **Por kilo:** el precio es el del kilo.
  - **Por libra:** el precio es el de la libra de 500 g, como se vende en Colombia.
- **En la caja**, al tocar un producto por peso sale **«⚖️ Tomate · $4.100 el kilo»**:
  - **Con la balanza conectada**, el peso sale solo: «750 g · ✅ Estable · $3.075». Se toca «✅ Agregar».
    - Si la balanza todavía se mueve, pregunta antes de agregar.
  - **Sin balanza**, se escribe el peso en gramos, kilos o libras, o se toca uno de los atajos: 250 g, 1 libra,
    1 kilo, 2 kilos.
  - **Por plata:** «o por plata $2.000» calcula el peso, y esa línea vale justo $2.000.
- **En la venta:**
  - Sale «750 g» o «2 lb».
  - El «+» vuelve a pesar y el «−» quita la línea.
  - El total nunca queda con centavos.
  - La venta guarda la unidad, y el inventario baja en kilos o libras.
- **Etiquetas de las balanzas que imprimen código de barras** (EAN-13 que empieza por 2):
  - El lector las lee en la caja y mete el producto con su peso.
  - El código del producto (PLU) va en «Código». Se elige si la etiqueta trae el peso o el precio, y si el PLU es de 4,
    5 o 6 dígitos.
  - Se revisa el dígito de control, para no meter un código mal leído.

## 🔌 2. Balanza, impresora y cajón: Ajustes → «🔌 Balanza, impresora y cajón»
Cada aparato queda guardado en **ese** equipo, porque cada caja tiene los suyos.

| | 💻 Computador (Chrome o Edge) | 📱 App Vento para Android |
|---|---|---|
| ⚖️ Balanza | Puerto COM o USB-serial | Bluetooth o USB, con cable OTG |
| 🧾 Impresora de facturas | USB o puerto COM | **Bluetooth** (las de 58 mm), USB o **red** (wifi o cable, IP y puerto 9100) |
| 💵 Cajón | Por la impresora, o aparte por puerto COM | Por la impresora, o aparte por USB |

### ⚖️ Balanza
- **Velocidad:** 9600 casi siempre; las Toledo a veces van a 2400 o 4800.
- **Cómo pide el peso:**
  - «Automático» prueba solo los pedidos de siempre: ENQ (Toledo, Moresco), «P», «W», «SI» y «$».
  - También se puede elegir «la balanza lo manda sola».
- **Formatos que entiende:**
  - «0.750 kg».
  - «ST,GS,+0001.250kg» (estable) y «US,…» (se está moviendo).
  - Toledo «00750» (gramos sin decimales).
  - Libras, gramos y onzas.
- **El peso se ve en vivo** en Ajustes, con lo que manda la balanza, para saber si quedó bien conectada.
- La balanza que ya estaba elegida se conecta sola al abrir Vento.

### 🧾 Impresora de facturas (térmica ESC/POS, la de los supermercados)
- **La factura:** nombre del negocio en grande, NIT, número de factura, productos (los de peso como «750 g x
  $4.100/kg»), IVA, TOTAL, pagos, vueltas y «¡Gracias por su compra!». Al final corta el papel.
- **Ancho del papel:** 58 mm (32 letras) u 80 mm (48 letras). Ninguna línea se sale del papel.
- **Tildes y ñ:** salen con la página de códigos PC850. Si una impresora saca letras raras, se apaga «Con tildes».
- **«Imprimir la factura sola al cobrar».**
- **«🖨️ Imprimir recibo»** de las mesas y de la caja usa esta impresora. Si no responde, se abre la ventana de imprimir de
  siempre.
- **«🧪 Imprimir prueba».**
- **Sin impresora elegida**, todo sigue igual que antes (la ventana de imprimir).

### 💵 Cajón de dinero
- **Casi todos los cajones van conectados a la impresora** con un cable de teléfono (RJ11). Vento le dice a la impresora
  que lo abra.
- **Cajón aparte por USB:** se maneja como puerto serial.
- **Se abre solo al cobrar en efectivo**, también en un pago mixto con efectivo. Si además se imprime la factura, va en
  el mismo envío y sale más rápido.
- **«💵 Cajón»** en la barra de la caja.
- **Cada vez que se abre queda en la actividad del equipo**, con el motivo: cobro en efectivo, botón de la caja o prueba.
- **Si no abre**, se prueba «el otro contacto» (pin 5).

### Lo nuevo en la app Android (versión nueva)
- `Equipos.java`:
  - Bluetooth (SPP, con los 3 intentos que necesitan las impresoras chinas de 58 mm).
  - Red (TCP 9100).
  - Impresora USB (clase impresora).
- `UsbSerial.java`: puerto serial por USB para balanzas y cajones, con los chips CH340/CH341, PL2303, CP210x, FTDI y
  CDC/ACM.
- **Permisos:**
  - «Dispositivos cercanos» (Bluetooth) solo cuando se va a usar.
  - El USB lo pregunta Android una vez por aparato.

## Pruebas
- **`equipos` (nueva):** 35 comprobaciones con los aparatos simulados.
  - Las tramas de las balanzas.
  - La factura ESC/POS: ancho, tildes, peso, total, corte y cajón.
  - Las etiquetas, con el dígito de control.
  - **En el computador**, la balanza por COM: el peso sale solo y se agrega.
    - También a mano en libras, por plata ($2.000 exactos) y la etiqueta por el lector.
    - Al cobrar en efectivo, la impresora USB saca la factura, la corta y abre el cajón en el mismo envío.
    - El botón «💵 Cajón».
    - Ajustes, la prueba de impresión y «⚖️ Se vende por kilo» en el producto.
  - **En la app Android:** la lista de impresoras Bluetooth emparejadas, la prueba por Bluetooth, la balanza Bluetooth y
    el peso que llega de Android.
- **Repetidas y bien:** `cajapos`, `modos`, `facil`, `herramientas`, `confirmapago`, `facturarapida` y `facturascan`.
- Compila todo el código Android (con `android-all`, Android 14).
- Suite completa.

**Ojo:** no hay aparatos de verdad en la máquina de pruebas. Los mensajes de cada chip USB son los mismos de Linux y de
la librería usb-serial de Android, pero conviene probar la primera vez con «🧪 Imprimir prueba» y con el peso en vivo de
Ajustes.

## Lo que no cambió
- La venta por peso es en la caja (POS) y en el modo tienda. En las cuentas de las mesas los productos siguen por unidad.
- Sin aparatos configurados, Vento funciona exactamente igual.

## 🔎 Comparación con Siigo POS y la competencia (Alegra POS, Loggro, Vendty, Treinta)
**Lo que Vento ya tiene:**
- Inventario con aviso de stock bajo y vencimientos.
- Proveedores.
- Pago mixto.
- Fiados.
- Lector de códigos.
- Cierre de caja.
- IVA en el recibo.
- Varios equipos en vivo.
- Pagos Nequi/DaviPlata confirmados.

**Lo que le falta (recomendado, en este orden):**
1. **Factura electrónica DIAN** (documento equivalente POS). Siigo y Alegra son proveedores DIAN. Vento hoy solo hace el
   recibo, y en Ajustes lo dice. Se puede conectar con la API de un proveedor autorizado (Factus, Alegra, Siigo…) para
   que cada venta salga con CUFE/CUDE.
2. **Apertura de caja con base y arqueo.** Siigo maneja apertura, cierre y turnos:
   - Base inicial.
   - Contar los billetes al cerrar y ver «sobra / falta».
   - Turnos por cajero.
3. **Entradas y salidas de caja:** sacar plata para un proveedor, o meter sencillo, sin que se vuelva un descuadre.
4. **Devoluciones y notas crédito:** devolver un producto de una venta, que el inventario y la caja vuelvan, y el
   comprobante.
5. **Precios por cantidad y listas de precios:** mayorista y minorista, «3 por $10.000», promociones 2x1 y combos.
6. **Comanda a la cocina** por la impresora térmica, una segunda impresora para restaurantes, ahora que ya hay
   impresión directa.
7. **Varias bodegas o sucursales** con traslados.

## Lo que necesita el dueño
- **La app Android nueva:** se instala sola, con «Actualizar ahora» en la 🔔 campanita.
- **En el computador:** usar Chrome o Edge.
- **Bluetooth:** emparejar la impresora o la balanza primero en los ajustes del celular. La clave suele ser 0000 o
  1234.
- **USB en el celular:** un cable OTG.
