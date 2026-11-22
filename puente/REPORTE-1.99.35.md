# ORDEVA 1.99.35 · Textos cortados con letras anchas (y en 360 px)

## Pedido del dueño (22/11): «Continúa con la auditoría y los arreglos»
Las fallas de GitHub en la 1.99.33 mostraron que muchas pantallas solo se habían medido con una letra angosta (Inter).
Muchos Android y GitHub usan una letra más ancha (DejaVu Sans). Se repitió la medición con las dos letras:
- celulares de 390, 360 y 320 px;
- 11 pantallas y 9 ventanas;
- se buscaron textos cortados («…») y textos que se salen de la pantalla.

### Lo que se arregló
| Dónde | Qué pasaba | Arreglo |
|---|---|---|
| **Barra de abajo** (todos los celulares) | En **360 px**, el ancho de la mayoría de los Android, salía «Produ…» **aun con la letra angosta**. Con la ancha también «Caja P…» (360) y «Productos» (390, 412) | En celulares de hasta 430 px: «Más» cede ancho, la barra tiene menos relleno, las letras van un poco más juntas y la vista sencilla queda en 12 px (subía a 12,5) |
| **Cobrar** › montos rápidos | «+$100.000» perdía el último número (320 y 360 px) | 12 px hasta 400 px de ancho y dos columnas en 340 px o menos |
| **Cuenta de la mesa** › «Personas» y «Cliente» (360 px) | Con la letra ancha no cabían por 2 px (ya pasaba en la 1.99.27) | Un poco menos de relleno y de espacio |
| **Contabilidad** › movimientos | «Ventas cobradas del día» se cortaba en 320 y 360 px | Hasta tres líneas |
| **Música** › frase bajo «Nada suena todavía» | Se cortaba en todos los celulares («Las canciones que pidan las m…») | Hasta dos líneas |

Los «…» que quedan son a propósito: nombres largos de productos, del cliente, de la canción y el subtítulo del negocio.

### Comprobado
- La medición de textos cortados quedó en 0 con las dos letras, en las 3 anchuras.
- Fotos con la letra ancha en 360 px (Cobrar, Contabilidad, Música y la barra de abajo).
- **Prueba nueva:** `pruebas/letraancha1935.test.js` (11/11 con las dos letras). No depende de la letra, así que en GitHub
  revisa con la ancha. Con la 1.99.34 falla 9 de 11 con la letra ancha y 5 de 11 con la angosta.
