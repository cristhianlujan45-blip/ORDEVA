# Auditoría 1.98 · Diseño de la aplicación

**Pedido del dueño (13/11):** «También haz una auditoría del diseño de la aplicación».
Un revisor abrió la app de verdad (sin internet, con un restaurante de ejemplo) y tomó 103 pantallazos en celular (390 y
320 px), tema oscuro y computador. Midió botones, letras y contraste con un programa. No cambió nada.
**No alcanzó:** `tv.html` y `admin.html` por dentro, los juegos de Play, Música, Asistencia, Bonos, y el teclado del celular
tapando campos (no se puede probar así).

## Hallazgos, por impacto
| # | Pantalla | Qué está mal | Arreglo | Tamaño |
|---|---|---|---|---|
| 1 | Entrar / crear cuenta | Es violeta oscura y la app por dentro es blanca y negra: parecen dos productos. El botón principal tiene poco contraste y el enlace de la licencia casi no se lee. | Misma paleta de ORDEVA 2.0 y enlace con estilo. | Pequeño |
| 2 | Agregar producto; Ajustes › Plan | Dos botones se ven aplastados: «Agregar» (el que guarda el producto) y «💳 Planes y pagos» (22 px de alto). | Darles el estilo de botón principal. | Pequeño |
| 3 | Cuenta de la mesa (la más usada) | La barra «Falta por pagar / Cobrar» y el micrófono tapan el contenido; en un celular angosto tapan los productos y sus + y −. | La barra como pie de la ventana; esconder el micrófono con una ventana abierta. | Mediano |
| 4 | Cuenta de la mesa y Caja | Botones demasiado pequeños para el dedo: 21 de 24 en la cuenta y 30 de 44 en la Caja (+ y − de 30 px, la ✕ de 21). | Mínimo 44 px en pantallas táctiles. | Mediano |
| 5 | Ajustes › Negocio y facturación | Una sola sección mide 11 pantallas de celular, con 62 campos. | Partirla en sub-páginas. | Grande |
| 6 | Ajustes › Negocio; Pedidos | Un elemento escondido ensancha la página a 567 px en un celular de 390: riesgo de que se mueva de lado. | Limitar su ancho. | Pequeño |
| 7 | Toda la app | No hay un solo sistema de botones: 151 estilos de botón, 38 tamaños de letra, 321 colores. | 4 botones en 3 tamaños en `ordeva2.css`, y migrar pantalla por pantalla. | Grande |
| 8 | Inicio, Contabilidad, Estadísticas | Tres pantallas dicen «cómo va el negocio» con tres diseños y tres palabras (Ventas / Vendido / Ingresos). | Una sola tarjeta y un solo vocabulario. | Mediano |
| 9 | Historial (facturas) | «Borrar historial de un día» es un botón grande arriba, antes de la lista; no se ve ninguna factura sin bajar. Se llama «Historial», no «Facturas». | Primero la lista; lo peligroso a un menú «⋯». | Mediano |
| 10 | Menú «Más» | 19 renglones en pantalla y media, sin ✕. Lo de cada día (Historial, Libreta) mezclado con lo raro (Bonos, Asistencia). | Reagrupar: «Cada día», «Mi negocio», «Extras». | Mediano |
| 11 | Cobrar | Los botones de billetes se cortan («+$100.000» pierde el último número). «Cancelar» queda fuera de la pantalla. | Letra que quepa y una ✕ arriba. | Pequeño |
| 12 | Encabezado | El nombre del negocio se corta; hay tres botones sin texto (cerrar sesión al lado de la campana); el subtítulo gasta espacio en todas las pantallas. | Nombre en dos renglones; sacar «cerrar sesión» del encabezado. | Mediano |
| 13 | Ajustes | Un renglón suelto «ORDEVA · versión…» encima de cada sección; «Volver» mide 32 px. | Mover la versión; botón de 44 px. | Pequeño |
| 14 | Caja en celular | El carrito tapa casi todos los productos; en 320 px los nombres quedan «Ba…» y el total se corta. | Carrito plegado en una barra. | Mediano |
| 15 | Contraste y letra pequeña | Verde sobre blanco y blanco sobre naranja no alcanzan el contraste mínimo; 68 textos de menos de 12 px. | Verde y naranja más oscuros; mínimo 12 px. | Pequeño |
| 16 | Nombres viejos a la vista | «vento.apk», «Laya», «mesora-…», «Vito» (incluso en el primer campo al crear la cuenta: «Ej: Cafetería Vito»). | Cambiar los textos. | Pequeño |
| 17 | Página del cliente (QR) y Play | Otro estilo (rosado y violeta). Con la pestaña Play, la barra de pestañas se parte en dos renglones. Descripciones de 11,5 px. | Pestañas que se repartan solas; letra de 13 px. | Mediano |
| 18 | Inicio en celular | Un bloque negro de 7 atajos repite la barra de abajo y manda las ventas fuera de la pantalla. | Esconderlo en celular. | Pequeño |
| 19 | Formularios y ventanas | Campos sin etiqueta; ventanas sin marca para lectores de pantalla; quedan 31 «confirm», 15 «prompt» y 5 «alert» del navegador. | Etiquetas visibles y ventanas propias. | Mediano |
| 20 | Libreta; primera vez | La Libreta abre con 11 renglones de ejemplos; la lista de tipos de negocio empieza por «Abogados». | Plegar los ejemplos; los 6 tipos más comunes primero. | Pequeño |

## Toques para lo de cada día (celular)
| Tarea | Toques |
|---|---|
| Abrir una mesa y agregar algo | 4 |
| Cobrar | 2 a 3 |
| Ver las ventas de hoy | 2 («Más» › Inicio; no está en la barra de abajo) |
| Agregar un producto | 2 y el formulario (el botón de guardar es el aplastado) |
| Ver las facturas | 2 y bajar (5.º renglón de «Más», debajo de 4 botones) |

## Opinión del revisor
La capa ORDEVA 2.0 es buena: el Inicio en computador, las mesas y el cobro se ven como un POS moderno y sobrio. Debajo hay
varias generaciones de diseño: la entrada violeta, botones sueltos naranjas y verdes, y la página del cliente en neón. Lo
más débil: botones pequeños, cosas flotando encima del contenido y páginas de ajustes de 6 a 11 pantallas.

## Los 5 primeros
1. La entrada con el mismo diseño de adentro (1).
2. Los dos botones aplastados, el ancho de Ajustes y el renglón de la versión (2, 6, 13).
3. La cuenta de la mesa: barra de pie, sin micrófono encima y botones de 44 px (3, 4).
4. Un solo sistema de botones y tarjetas (7, 8, 15).
5. Reordenar Historial y «Más» y partir los Ajustes gigantes (5, 9, 10).
