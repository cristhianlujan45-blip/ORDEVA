# ORDEVA 1.99.34 · Arreglos para que las pruebas de GitHub queden en verde

## Qué pasó
Desde la 1.99.27, cada publicación nueva cancelaba la revisión de GitHub de la anterior. La 1.99.33 fue la primera
corrida completa, y fallaron 3 pruebas:

1. **mesacomoda: tableta acostada (1180 × 820), la cuenta de la mesa.** Lo causó la 1.99.32. Con − / + de 44 px, los
   renglones de los productos pasaron de 48 a 62 px. Con 7 productos, «Cerrar» quedaba debajo de la pantalla.
   - **Arreglo** (`lib/vento-mesa-comoda.js`): en tabletas, el relleno del renglón baja de 9 a 2 px.
   - El renglón vuelve a medir 48 px y los botones siguen de 44.
2. **graficas1929: Historial › 30 días, dos fechas encimadas.** GitHub usa otra letra, más ancha (DejaVu Sans, la de muchos
   Android). La primera fecha iba pegada al borde y tocaba la siguiente.
   - **Arreglo** (`app/09`): cuántas fechas se muestran se calcula con el largo de la fecha, contando con letras anchas.
   - Cada fecha va centrada en su barra, sin salirse de los bordes.
3. **diseno1927: celular de 320 px, «Productos» cortado en la barra de abajo.** Pasaba por la misma letra ancha.
   - **Arreglo** (`index.html`, solo en pantallas de 350 px o menos): «Más» cede ancho a los otros cuatro botones.
   - La barra pierde 4 px de relleno por lado y las letras se juntan un poco.

## Comprobado
Las fallas se reprodujeron aquí con la misma letra de GitHub (DejaVu Sans) y luego se probaron los arreglos con las dos
letras, Inter y DejaVu:
- mesacomoda 16/16;
- graficas1929 45/45;
- diseno1927 14/14;
- diseno199 50/50;
- facilpantallas 28/28;
- ordeva2pantallas 20/20;
- tableta1932 16/16;
- ventanas1933 9/9;
- flujocompleto 88/88.

En GitHub, `ordeva2` pasó 30/30: la caída que se veía aquí era del entorno local, no de la app.

## Encontrado de paso (no se tocó, ya estaba antes)
- Con la letra ancha (DejaVu), en celulares de 360 px, «Personas» y «Cliente» de la cuenta de la mesa no caben en
  una línea (`pruebas/mesa.test.js`, 50/51).
- Pasa igual en la 1.99.27. Con la letra normal pasa 51/51.
- Esa prueba no está en la lista de GitHub. Queda para revisar aparte.
