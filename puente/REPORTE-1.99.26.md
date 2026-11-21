# ORDEVA 1.99.26 · Tu precio de venta manda · Voz de los pagos por SMS sin «revísalo» y sin repetir · Inventario más liviano

## 1. «Pongo el precio al que lo vendo y me deja el sugerido» (pedido del dueño, 21/11)
- **Factura de compra:** el campo «Precio actual» solo se comparaba con el costo, y lo que se guardaba era el precio
  sugerido. Además, cada cambio de costo, cantidad o cajas volvía a poner el sugerido.
- **«Revisar precio» con la cámara:** cambiar el costo también reemplazaba el precio escrito.
- **Ahora** (`app/04e`):
  - El campo se llama «A cómo lo vendes (si lo escribes, se guarda este)», y lo escrito ahí o en el precio es lo que se
    guarda. Lo dice: «✅ Precio que se guarda: el TUYO».
  - Cambiar el costo o la cantidad solo ajusta el margen.
  - El sugerido vuelve si se borra el precio o se cambia el margen a mano.
  - Editar un producto ya estaba bien: el sugerido solo se pone con «Usar».
- **Prueba nueva:** `preciotuyo` (10/10). Con el código anterior: escribías $2.800 y quedaba $1.500.

## 2. Transferencias por SMS: solo la VOZ (pedido del dueño: «el texto no lo cambies, solo el audio»)
- **La voz** dice «Llegaron 31000 pesos por Nequi», sin «revísalo antes de entregar». Así es en el celular que lee el SMS,
  en Android de fondo (`Cruce.java`) y en el computador o la tablet (`nube/vento-pagos.js`).
- **Los textos no cambian:** las notificaciones «⚠️ … revísalo», la pantalla «Esperando el pago», los avisos escritos y el
  servidor quedan igual.
- **No se repite la voz.** El banco avisa por SMS y por su app, y el mismo pago sonaba dos veces («Llegó un aviso… Revísalo…»
  y luego «Llegaron…»). Ahora la voz suena una vez y las notificaciones salen como siempre:
  - En el celular, el SMS queda anotado como «ya sonó».
  - En Android de fondo y en la página, el SMS y el aviso de la app se juntan uno con uno (mismo valor, menos de 5 min).
  - Dos clientes que pagan lo mismo suenan los dos.
- **Pruebas:**
  - Las de Android pasan 367/367. Las nuevas fallan con el código anterior, que sonaba dos veces.
  - `pagosequipos` 5e: el computador dice el pago una vez.
  - Las demás de pagos pasan: `confirmapago`, `pagosaviso`, `pagostodos`, `pagosprivados`, `pagossuenan`, `alertaspagos`.
- **Hace falta el APK nuevo**, que GitHub compila solo. Con el APK viejo, ese celular dice la frase de antes con la app de
  fondo.
- **Diagnóstico:** `diagnostico-pagos.yml` tiene una sección nueva, «posibles_repetidos»: el mismo valor en menos de 10 min,
  sin nombres.

## 3. Inventario: la nube sube solo el movimiento nuevo
- **Antes**, con cada producto vendido se subía entera la lista de movimientos del inventario (`data.stockLog`, hasta 3.000)
  a la nube y a los otros equipos. En el negocio real fueron unas 130 veces en una tarde.
- **Ahora** (`app/04c`):
  - Cada movimiento lleva un id y lo nuevo va al comienzo, como el historial. Se sube solo lo nuevo.
  - La lista vieja se convierte con ids sacados de su contenido, iguales en todos los equipos: no se duplica.
  - Tope de 2.600, para que las versiones anteriores nunca recorten.
  - «Días de inventario» toma el movimiento más viejo por fecha.
  - Al juntar listas se busca por id con un índice (`nube/vento-nube.js`).
- **Revisión independiente:**
  - Bloqueante: una mezcla sin copia de referencia duplicaba la lista. → Corregido.
  - Bloqueante: una versión anterior podía borrar los movimientos más nuevos. → Corregido con el tope.
- **Las pruebas encontraron un error antes de publicar:** en un negocio sin movimientos, la venta no descontaba el
  inventario. → Corregido, con su prueba.
- **Prueba nueva:** `stocklogpartes` (13/13). Las de inventario y sincronización pasan.
- **Mientras un celular tenga la versión anterior**, puede marcar «⚠️ poco inventario» de más. No borra datos y se corrige
  al actualizarse.

## Pruebas
- La lista completa de GitHub (143) corrió aquí: todas bien, salvo 4 que faltaron por la copia de prueba (sin la carpeta
  `android`). Esas 4 pasan en el repositorio completo.

## Revisión del 21/11 (solo lectura)
- **Pruebas de la noche (1.99.25):** en verde.
- **«negocioCodigo»:** no se guarda desde el 20/11 18:11 (antes 274 veces en 2 h).
- **Fiados:** 17 cuentas deben $499.500. Las 2 nuevas tienen nombre; quedan 7 viejas sin nombre para «✏️ ¿Quién es?».
- **Errores:** nada nuevo (el Xiaomi tuvo 2 cierres por memoria y 1 caída del navegador, de madrugada y con la app de fondo).
