# ORDEVA 1.99.10 · Botones de 44 px en Mesas y Caja (auditoría de diseño, hallazgo 7, primera tanda)

- Medido en un celular de 390 px: en Mesas y en la Caja había botones de uso diario de 32 px de alto (lo cómodo para el
  dedo es 44): «⚡ Venta rápida», «🧾 Caja (POS)», «♻️ Reiniciar», «⋯ Más opciones», Lista/Plano, las categorías, el + y −
  del carrito, Descuento · Nota · Suspender · Cliente · Cotizar, «💵 Abrir caja», «Vaciar», y los íconos de arriba de la Caja
  medían 35–42 px de ancho.
- Ahora, en pantallas táctiles (o de menos de 1024 px), todos miden al menos 44 × 44 px. En el computador con mouse no cambia.
- Para que el carrito no tape los productos con botones más altos, Descuento · Nota · Suspender · Cliente · Cotizar van en una
  sola fila que se desliza de lado (antes se partían en dos filas).
- Solo CSS (`index.html`); colores y textos iguales. Falta la segunda parte del hallazgo 7 (unificar colores y bordes de los
  botones en el resto de pantallas).
- Pruebas: diseno199 45/0 (punto 12 nuevo: tamaños en Mesas y Caja, una sola fila, nada se sale de lado), cajapos 27/0,
  cajapro 56/0, cajamas 45/0, cajateclado 17/0, cajaextra 14/0, cajalibre 29/0, cajavoz 59/0, mesa 51/0, mesacomoda 16/0,
  vistasencilla 45/0, modos 55/0, plano 19/0, ordeva2pantallas 20/0, escanercaja 15/0, contraste 17/0.
- No probado: teléfonos reales.
