# ORDEVA 1.85.0 · Motel por horas y un arreglo de estabilidad

**Pedido del dueño:** «Haz lo que creas mejor y avanza en el proyecto». Los negocios que usan ORDEVA son la tienda de
barrio, el bar, el restaurante, la agencia de viajes, el hotel y el motel. El plan se reordenó en
`puente/egm/POS-COMPLETO.md`, sección 6b.

## 1. ⏱️ Motel por horas
- **Antes:** el catálogo prometía «tiempo por habitación (horas)», pero nada cobraba el tiempo. El mapa solo decía
  «Ocupada».
- **El plan sale del nombre de la tarifa:**
  - «Rato (3 horas)» = 3 h; «Suite 4 horas» = 4 h;
  - «Noche» = 12 h, y se cambia en Ajustes;
  - la «Hora adicional» es la tarifa que se suma cuando se pasa del tiempo.
- **En la cuenta de la habitación:**
  - dice cuándo entró, cuánto lleva y hasta qué hora va el plan, por ejemplo: «🕒 Entró 9:10 p. m. · lleva 3 h 25 min ·
    Rato (3 horas) hasta 12:10 a. m.»;
  - se puede corregir la hora de entrada;
  - si se pasó del tiempo, avisa con «⚠️ Se pasó 25 min: falta cobrar 1 hora adicional ($15.000)» y el botón «Sumar».
- **En el mapa de habitaciones:**
  - dentro del tiempo: «⏳ Sale 12:10 a. m.»;
  - cuando se pasa: el aviso resaltado «⏰ Se pasó 25 min · 1 hora adicional».
- **Avisos en pantalla:**
  - 10 minutos antes de que se acabe el tiempo;
  - cuando se pasa.
- **Al cobrar,** si falta cobrar tiempo, pregunta:
  - «Sumar 1 hora adicional ($15.000) y cobrar»;
  - «Cobrar sin sumar»;
  - «Cancelar».

  Dentro del tiempo no pregunta nada.
- **No se suman solas.** Si cada celular o caja las sumara por su cuenta, con dos equipos prendidos se cobrarían dos
  veces. Por eso solo avisa, y las suma el que cobra.
- **Tolerancia:** 10 minutos antes de cobrar la hora adicional; se cambia en Ajustes → Negocio.
- **La venta guarda** la hora de entrada, la de salida y los minutos.

## 2. 🔴 Arreglo: ORDEVA se iba poniendo más pesado y, a la media hora, no dejaba cerrar cuentas
- **Qué pasaba:**
  - Varias partes de ORDEVA (mapa, caja, hotel, huéspedes, agencia, opciones) agregan lo suyo a «cerrar cuenta» y a
    «agregar producto a la cuenta».
  - Cada una revisaba cada medio segundo si ya lo había puesto, pero solo miraba la última capa. Por eso se volvían a
    poner una encima de la otra, sin fin.
  - **Medido en la 1.84 (la que estaba publicada):** «cerrar cuenta» ganaba unas 4 capas por segundo y «agregar
    producto», unas 2. En un minuto la llamada ya tenía 511 niveles. El navegador aguanta unas 11.000 capas antes de dar
    «Maximum call stack size exceeded».
  - **La cuenta:** a esa velocidad, se calculaba que cerrar una cuenta fallaría a los 35–40 minutos con ORDEVA abierto sin
    recargar. En la prueba en vivo falló antes, a los 20 minutos (abajo). Agregar productos a la cuenta iba por el mismo
    camino: se calcula que fallaría a la hora y media. Puede ser una de las causas de «Error en la aplicación, se
    recargará».
- **Arreglo:**
  - cada capa lleva las marcas de las demás, así nadie se vuelve a poner;
  - ahora queda fijo en 12 niveles, también después de un minuto;
  - lo revisa la prueba `v185`.
- **Confirmado en vivo con la 1.84.0 publicada,** con ORDEVA abierto sin recargar:
  - **minutos 5, 10 y 15:** cerrar cuenta, bien;
  - **minuto 20:** cerrar cuenta da «Maximum call stack size exceeded».
- **Por eso el arreglo salió antes, solo, como 1.84.1** (`puente/REPORTE-1.84.1.md`). La 1.85 lo trae también.

## 3. Pruebas
- **Prueba nueva `v185`:** 17 de 17 (motel, y que las capas ya no crecen).
- **Las 15 pruebas de lo que toca la 1.85:** pasan. Son `agencia`, `hotel`, `hoteldia`, `huespedes`, `mapa`, `mesa`,
  `mesapersonas`, `opciones`, `reservas`, `sincmesas`, `v183`, `v184`, `cajamas`, `contraste` y `doscierres`.
- **La lista completa (108 pruebas, todas las de GitHub + `facturascan`):** 2.529 revisiones bien, 0 mal.
- **Las 27 del servidor:** pasan.
- **Android (`javaavisos`, con la librería `android-all`):** 328 de 328.
- **No se probó con equipos de verdad.**

## 4. Lo que sigue
- **1.86:** domicilios con estados para la tienda, el restaurante y el bar.
- **1.87:** hoteles: tarifas por temporada y la comisión de Booking o Airbnb.
