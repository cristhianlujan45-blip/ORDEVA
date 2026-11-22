# Auditoría de diseño · 22/11/2026 (ORDEVA 1.99.26 → 1.99.27)

**Pedido del dueño:** «mira qué hay para corregir, haz otra auditoría en el diseño».

## Cómo se hizo
Un programa abrió la app de verdad con un restaurante de ejemplo y recorrió 10 pantallas y 5 ventanas:
- **Pantallas:** Inicio, Mesas, Carta, Productos, Historial, Estadísticas, Contabilidad, Música y Ajustes, además de la
  página del QR.
- **Ventanas:** la cuenta de la mesa, «Más», la Libreta, «Producto nuevo» y Cobrar.

Lo hizo en dos celulares, de 390 y de 320 px. En cada pantalla midió:
- lo que se sale de lado;
- los botones de menos de 44 px para el dedo;
- la letra de menos de 12 px;
- el contraste;
- lo que flota encima;
- los nombres viejos.

Después se revisaron capturas de cada hallazgo. Las alarmas que resultaron falsas no se cuentan:
- el detalle plegado de cada producto;
- el contraste de la pantalla de bienvenida;
- el botón «Caja POS» resaltado por el mouse de la prueba;
- «Laya», que es el nombre actual del asistente.

## Lo que ya estaba bien (de la auditoría 1.98)
- La entrada con la paleta de ORDEVA.
- «Más» agrupado y con ✕.
- La cuenta de la mesa, la Caja, Facturas, Contabilidad y Ajustes con botones de 44 px.
- Nada se sale de lado en 390 px.
- La página del QR: sin problemas medidos.
- Al final de las páginas largas, el micrófono no tapa la última línea.

## Hallazgos y qué se hizo
| # | Dónde | Qué estaba mal | Arreglo (1.99.27) |
|---|---|---|---|
| 1 | Libreta, celular de 320 px | El 3.er botón («Pagué a un empleado») se salía de la ventana | Los botones se acomodan solos en 2 o 3 columnas |
| 2 | Contabilidad › IVA | «IVA generado$0»: el valor pegado a la etiqueta (su estilo solo llegaba al abrir la caja) | El renglón «etiqueta · valor» tiene su estilo siempre |
| 3 | Inicio | «Hoy / 7 días / Mes / Fechas» de 29 px; «Contabilidad ›», «Historial ›», «Ver todo ›» de 21 px; botones de las alertas de 25 px | 44 px en el celular |
| 4 | Música | 8 botones de 32 px y un enlace de 16 px | 44 px |
| 5 | Mesas (primeros pasos), Estadísticas, Carta, Libreta, «Producto nuevo» | ✕ de 26 a 28 px; «Exportar ventas», «Imprimir» y «Pagó todo» de 32 px | 44 px |
| 6 | Inicio, Contabilidad, Estadísticas, Mesas, Música, Productos | Letra de 10 a 11,5 px en tarjetas, «vs. 7 días antes», la tabla, el Menú del día y las etiquetas | 12 px; los números de las barras, de 9 a 11 px |
| 7 | Celular de 320 px | El nombre del negocio y la barra de abajo se cortaban («Caja P…», «Produ…») | Letra un poco menor solo en pantallas de 350 px o menos |

**Antes → después (390 px):**
- Botones chicos: Inicio 11 → 2, Música 12 → 2.
- Letra chica: Estadísticas 56 → 32, Contabilidad 21 → 13, Productos 17 → 8.
- Lo que queda son letras de los ejes de las gráficas y encabezados de tablas (11 px; más grandes se enciman) y el «?» de
  ayuda del micrófono (24 px, pegado al botón del micrófono).

## Queda para otra vez (no se tocó)
- El sistema de botones del hallazgo 7 de la 1.98 (unificar colores y bordes): sigue a medias. Los tamaños ya están; los
  colores y bordes, no.
- Las gráficas con letra de 11 px.
- El «?» de la ayuda de voz (24 px).

## Prueba
`pruebas/diseno1927.test.js` (14/14). Con el código anterior fallan 13 de las 14 comprobaciones.
