# ORDEVA 1.58.1 · Toques al instante (agregar cerveza, +, −, cobrar…)

## Qué pasaba
Al agregar productos (cervezas) u oprimir botones, la pantalla tardaba en responder, sobre todo en negocios con muchas
ventas guardadas. Se midió con el medidor del propio navegador («Event Timing»: del toque hasta que la pantalla se
pinta), con el procesador 4 veces más lento (como un celular de gama media) y 5.000 ventas en el historial.

## Por qué (medido, no supuesto)
1. **Guardar en cada toque.** Antes de pintar la pantalla se convertía TODO el negocio a texto (1,3 MB con 5.000
   ventas).
2. **La actividad del equipo.** 0,3 s después de cada toque armaba el texto de los productos de TODAS las ventas para
   compararlas. Además leía y reescribía su cola completa una vez por cada cosa anotada. Si se tocaba rápido, el
   siguiente toque esperaba.
3. **La lluvia del fondo.** Se redibujaba 22 veces por segundo siempre, aunque no se viera (modo fácil, otra temática,
   app escondida). Con una ventana abierta (la mesa, cobrar), cada cuadro obligaba a recalcular el desenfoque de toda la
   pantalla. El aviso «Agregado…» también tenía su propio desenfoque.

## Qué cambia
1. **Primero se pinta y enseguida se guarda.** Es en el mismo instante, pero ya no antes de mostrar el toque. Varios
   toques seguidos se guardan juntos una sola vez. Se guarda de inmediato:
   - al esconder o cerrar la app;
   - al cambiar de sede o de negocio (lo pendiente queda en su sede);
   - antes de leer lo guardado.
2. **La actividad del equipo** compara solo los totales. El texto de los productos se arma solo para lo que se anota, y
   la cola se escribe una vez por comparación. Anota exactamente lo mismo que antes.
3. **La lluvia del fondo** no se dibuja cuando no se ve ni con una ventana abierta, y se queda quieta 0,4 s cada vez que
   se toca la pantalla.
4. **El aviso «Agregado…»** ya no tiene desenfoque detrás. Su fondo ya era 90 % opaco y se ve igual.

## Resultado (CPU 4× más lenta, 5.000 ventas; mediana)
| Toque | 1.58.0 | 1.58.1 |
|---|---|---|
| Agregar cerveza (favorito) | 184 ms | 136 ms |
| Botón + | 200 ms | 144 ms |
| Botón − | 184 ms | 136 ms |
| Trabajo de la página en cada toque | 108 ms | 45 ms (ya no crece con las ventas) |

- **Abrir una mesa:** quedó igual (unos 150 ms en ambas).
- **Desenfoques:** quitarlos ayuda sobre todo a la tarjeta gráfica del celular real, que aquí no se puede medir.
- **Lo demás ya estaba bien:** los botones ya respondían sin la espera de 0,3 s del navegador (`touch-action:
  manipulation`) y ya se achican al oprimirlos.
- **App Android:** sus revisiones de fondo también corrían en el mismo hilo de la pantalla cada 5 y 10 s. Eso ya volvió
  a como era en la 1.57.1 (app 1.0.62).
