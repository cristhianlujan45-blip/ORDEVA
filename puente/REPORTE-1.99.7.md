# ORDEVA 1.99.7 · Página del cliente (QR): pestañas en una sola fila (auditoría de diseño, hallazgo 17)

- Con la pestaña 🎮 Play activada, la barra de la página del QR tenía 4 pestañas en una cuadrícula de 3: «Play» bajaba a un
  segundo renglón (medido: 100 px de alto, Play 46 px más abajo). Ahora las pestañas se reparten solas en una fila
  (64 px de alto); en celulares de 430 px o menos, con Play, el ícono va arriba del nombre para que quepa completo.
  Sin Play, se ven igual que antes (3 en una fila).
- Las descripciones pequeñas de los productos en esa página suben de 11,5 a 12,5 px.
- Solo CSS de `pedido.html`: no cambia cómo funciona el menú, los pedidos ni los pagos.
- Pruebas: `diseno199` 42/0 (nuevo punto 11, a 320 y 390 px), qrprivado 9/0, seguridadqr 6/0, qrcuenta 12/0, play 38/0,
  pedidostienda 29/0, musicaqr 26/0, qrrapido 6/0, cuentacliente 57/0.
- No probado: teléfonos reales; navegadores muy viejos sin `:has()` (ahí las 4 pestañas igual van en una fila, solo que
  con el ícono al lado del nombre).
