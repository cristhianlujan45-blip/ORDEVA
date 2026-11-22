# ORDEVA 1.99.36 · La página del QR en los celulares de los clientes

## Pedido del dueño (22/11): «Y continúa con la siguiente auditoría»
La página del QR (`pedido.html`) la usan los **clientes** en sus propios celulares, de todos los tamaños y letras. Antes
solo se había medido vacía. Ahora se midió así:
- con una carta de prueba de 8 platos, en 412, 390, 360 y 320 px;
- con la letra angosta (Inter) y con la ancha (DejaVu, la de muchos Android);
- al abrir, con la carta abierta, con productos en el pedido y en cada pantalla que se abre al tocar un botón.

### Lo que se arregló
| Dónde | Antes | Ahora |
|---|---|---|
| Pestañas «Pedido · Canción · Mi cuenta» | «Mi cue…» cortado desde 412 px. Con **«Letra grande»** (la ayuda para personas mayores) se leía «Pe… Ca… Mi …» | En celulares el ícono va arriba del nombre y el nombre puede usar dos renglones: se leen completas |
| Idioma, moneda y «Letra grande» | 37–39 px | 44 px |
| Carta: categorías (Platos fuertes, Bebidas…) y «Cerrar» | 36 y 40 px | 44 px |
| Carta: «+» de cada plato | 32 × 32 | Se ve de 40 y se toca en 44 × 44 |
| Carta: detalles del plato («Frijoles, arroz…») | 11,5 px | 12 px |
| Tu pedido: − / + y la ✕ para quitar | 38 y 34 px | 44 px |
| Sugerencias y géneros de canciones | 42 px | 44 px |

### Comprobado
- Fotos de antes y después con la letra ancha en 360 px y con «Letra grande» en 320 px.
- Repitiendo la medición con la letra ancha no queda nada pequeño ni cortado. La única excepción es el «+» de los platos,
  que se ve de 40 px a propósito pero se toca en 44.
- **Prueba nueva:** `pruebas/qrcliente1936.test.js` (29/29 con las dos letras). Con la 1.99.35, con la letra ancha, pasa
  solo 4 de 29.
