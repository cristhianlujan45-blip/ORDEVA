# ORDEVA 1.99.6 · Botones de las ventanas con 44 px fijos

- En GitHub, «Pruebas de la app» de la 1.99.5 (commit 2acc76c) falló en una sola prueba: `diseno199` punto 10. Los botones
  de la ventana «Escribe el dato» medían 43 px en la máquina de GitHub (allá la letra se dibuja un poco distinta); aquí
  medían 44,96 px. Todo lo demás pasó.
- Arreglo (`index.html`): los botones de la ventana nueva y de la de confirmar tienen `min-height: 44px`, así que no dependen
  de la letra.
- Pruebas: `diseno199` 40/0, `cerrarcaja` 26/0. Medido aquí: 44,96 px con la letra normal y con la letra 15 % más grande.
- La página de la 1.99.5 ya estaba publicada y funcionando; esto es solo el tamaño de los botones.
