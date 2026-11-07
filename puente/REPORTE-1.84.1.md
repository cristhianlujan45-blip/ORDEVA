# ORDEVA 1.84.1 · Arreglo urgente: a los 20 minutos ya no dejaba cerrar cuentas

**Cómo salió:** al hacer la 1.85 (motel), una prueba mostró que «cerrar cuenta» se envolvía una y otra vez. Se midió en la
versión publicada (1.84.0) y el error se confirmó en vivo.

## 1. El error
- **Qué pasaba:**
  - Varias partes de ORDEVA agregan lo suyo a «cerrar cuenta» y a «agregar producto a la cuenta»: el mapa, la caja, el
    hotel, los huéspedes, la agencia y las opciones.
  - Cada una revisaba cada medio segundo si ya lo había puesto, pero solo miraba la última capa. Por eso se volvían a
    poner una encima de la otra, sin fin: unas 4 capas por segundo en «cerrar cuenta» y unas 2 en «agregar producto».
  - Pasaba en todos los tipos de negocio.
- **Lo que se vio en la 1.84.0 publicada, con ORDEVA abierto sin recargar:**
  - **minutos 5, 10 y 15:** cerrar cuenta y agregar producto, bien;
  - **minuto 20:** cerrar cuenta da **«Maximum call stack size exceeded»**. La cuenta no se cierra y la venta no queda en
    el historial.
  - **Agregar producto:** a esa velocidad, se calcula que fallaría pasada la hora y media.
- **Qué se notaba:** después de un rato con ORDEVA abierto, cobrar una mesa no funcionaba hasta recargar. Puede ser una
  de las causas de «Error en la aplicación, se recargará».

## 2. El arreglo
- Cada capa lleva las marcas de las demás, así nadie se vuelve a poner.
- La llamada queda fija en 11 niveles. Antes, al minuto ya iba en 511 y seguía subiendo.
- Son 7 renglones en 6 archivos: `lib/vento-mapa.js`, `vento-opciones.js`, `vento-caja-mas.js`, `vento-hotel.js`,
  `vento-huespedes.js` y `vento-agencia.js`. No cambia nada más.

## 3. Pruebas
- **La medición:** a los 10 y a los 60 segundos, 11 niveles. En la 1.84.0 eran 111 y 511.
- RESULTADOS_AQUI
- **La prueba que lo revisa de ahora en adelante** (que «cerrar cuenta» y «agregar producto» no se vuelvan a envolver)
  está en `v185`, con la 1.85.
- **No se probó con equipos de verdad.**
