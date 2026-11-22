# ORDEVA 1.99.31 · Nueva medición de diseño: lo real que quedaba

## Pedido del dueño (22/11): «Continúa con lo siguiente de la auditoría»
Con la 1.99.30 se cerraron los puntos de `puente/AUDITORIA-DISENO-1.99.27.md`. Se volvió a medir todo en 390 y 320 px:
- botones pequeños;
- letra chica;
- contraste;
- lo que se sale de la pantalla;
- nombres viejos.

### Lo que era real y se arregló
| Dónde | Qué pasaba | Ahora |
|---|---|---|
| Entrar (y todas las contraseñas) › ojo «Ver la contraseña» | Se tocaba en 35 × 31 px | 44 × 44, dentro del campo; se ve igual |
| Cuenta de la mesa › número de la cantidad (entre − y +) | 20 px de alto: costaba tocarlo para escribir | 40 px, como los botones; se ve igual |
| Contabilidad › tarjeta «Te quedó» / «Resultado» | Textos grises en el límite de contraste (4,49 : 1) sobre fondo gris | Gris más oscuro (4,5 : 1 o más) |
| Cobrar con teclado (computador) › «Enter», «Esc» | 11 px | 12 px |

### Falsos avisos de la medición (no se tocaron)
- **Contraste de 1,08 a 1,11** (Productos, Estadísticas, Cobrar…): textos escondidos o sobre fondos que el medidor no lee.
- **«Se sale» en Productos:** el detalle de cada producto cerrado. Abierto, los números caben (47–343 px).
- **«Se sale» en Estadísticas y Contabilidad:** la lista de movimientos y los periodos, que se desplazan de lado a propósito.
- **«?» de la voz, 28 px:** se ve de 28 px, pero se toca en 44 × 44 (1.99.29).
- **Letra de 11 px en la barra de abajo en 320 px:** a propósito, para que no se corte.
- **El nombre del negocio arriba:** es el título (se puede editar), no un botón.

### Comprobado
- Fotos de antes y después: ojo de la contraseña y cantidad de la mesa (se ven igual).
- **Prueba nueva:** `pruebas/auditoria1931.test.js` (6/6). Con la 1.99.30 fallan 4 de 6.
