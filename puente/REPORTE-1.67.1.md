# ORDEVA 1.67.1 · 🇨🇴 Productos colombianos reconocidos por su código de barras (también sin internet)

## Qué se pidió
- Que al escanear un producto colombiano ORDEVA diga de una vez qué es: nombre, marca, cantidad (gramos, mililitros…)
  y presentación.
- Que ponga esos datos solos al inventariar o agregar productos.
- Que lea los códigos «todos de una vez».

## Qué quedó

### 1. Catálogo de productos colombianos dentro de ORDEVA (`lib/catalogo-co.json`)
- **6.254 productos**, sacados de las bases libres Open Food Facts, Open Beauty Facts y Open Products Facts (licencia
  ODbL; la fuente se cita en el archivo):

  | Grupo | Productos |
  |---|---|
  | Códigos 770 (GS1 Colombia) de Open Food Facts | 5.167 |
  | Otros marcados como vendidos en Colombia | 819 |
  | Cuidado personal | 223 |
  | Aseo y hogar | 45 |

- Cada producto trae nombre, marca, contenido, categoría y presentación:
  - **Contenido** normalizado: «1,75 L», «135 g», «900 ml», «1 libra (500 g)».
  - **Categoría** en español; cuando la base no la trae, se deduce del nombre.
  - **Presentación** (botella, lata, bolsa…), cuando el nombre la dice.
- **Cobertura:**

  | Dato | Productos que lo traen |
  |---|---|
  | Categoría | 4.258 (68 %) |
  | Contenido | 2.835 (45 %) |

- **Sin precios:** cambian por tienda; ORDEVA nunca los inventa.
- 378 KB. Se baja solo, en segundo plano, a los 20 s de abrir la app (no lo hace con «ahorro de datos»). Queda
  guardado: **funciona sin internet** y responde al instante.
- Se actualiza con `python3 puente/catalogo-co/generar.py`. Con `CRUDO=/ruta.json` guarda lo descargado para
  reprocesarlo sin volver a bajar todo.

### 2. Orden de búsqueda al escanear un código desconocido (`lib/vento-producto-codigo.js`)
1. 🇨🇴 Catálogo colombiano de ORDEVA (nuevo, sin internet).
2. 📚 Lo que ORDEVA aprendió de otros negocios.
3. 🌐 Bases libres en línea.
4. 🤖 IA buscando el código en internet.
5. 📷 Foto con IA.

Un código leído como UPC-A (12 cifras) también encuentra su EAN-13 con 0 adelante.

### 3. Ficha del producto nuevo, llena sola
- Se llenan solos:
  - el nombre con la marca («Postobón Kola Román»);
  - **Contenido** («1,75 L») y **Presentación** (campos nuevos, uno al lado del otro);
  - la categoría.
- Si la categoría no existe en el negocio, sale **«🆕 Gaseosas (nueva, se crea al guardar)»** y se crea una sola vez.
- Al guardar, el producto queda con su código, contenido, presentación y marca, y ORDEVA lo aprende para los demás
  negocios (como antes).
- En la entrada de mercancía sigue preguntando «¿Cuántas llegaron?».

### 4. Varios códigos a la vez en la cámara (`app/04g`)
- Antes se tomaba solo el primer código de cada imagen. Ahora se leen **todos los que se vean juntos** (varios
  productos frente a la cámara).
- Cada código cuenta una vez mientras sigue en cámara. Para sumar otra unidad del mismo, se retira y se vuelve a
  mostrar, como siempre.

## Pruebas
- `pruebas/catalogoco.test.js` (12 ✅, nueva, en CI). Cubre:
  - el archivo;
  - Kola Román sin internet;
  - UPC-A → EAN-13;
  - la ficha llena con la categoría nueva y la cantidad;
  - que el producto quede con su código;
  - un código desconocido: no se inventa nada;
  - **la cámara de prueba con dos códigos reales en la misma imagen: se leen los dos, una vez cada uno**.
- Las demás pruebas que tocan el lector están en el mensaje de publicación.

## Lo que hay que saber
- Las bases libres no tienen todos los productos colombianos. Si un código no está, siguen las demás fuentes, y cada
  producto que un negocio registra queda aprendido para todos.
- No se probó con un celular real ni con un lector físico. Sí se probó con una cámara de prueba que muestra códigos
  EAN-13 reales.
