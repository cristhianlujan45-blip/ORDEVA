# ORDEVA 1.65.7 · Pagos que suenan aunque el celular esté en uso, y el lector de códigos de un toque

## Qué pidió el dueño
- «Antes las notificaciones llegaban más rápido; ahora se demoran más de 5 segundos. En el Xiaomi, si no lo bloqueo, no
  suena. Que funcione en todo tipo de celular (Huawei…), bloqueado o no, con Bancolombia, recargas, todo.»
- «El lector de QR: que sea un solo botón y que abra la cámara de una. Lo presiono varias veces y no abre. Auditoría.»

## Lo que mostraron los datos (diagnóstico de solo lectura)
- **El servidor es rápido:** del aviso del celular al pago aprobado pasan entre 0,08 y 0,17 s.
- **Quién lee:** los avisos del banco los lee el Samsung A34. El Xiaomi solo recibe.
- **Lectura desconectada:** «Android desconectó la lectura de avisos de pago» pasó 10 veces en el día. Mientras está
  desconectada no se lee ningún pago, y se reconectaba solo cada minuto.
- **Motor de voz:** «El motor de voz no respondió» (13 veces). Android cerró el motor y el pago esperó a que arrancara
  otro, varios segundos.
- **Xiaomi en uso:** «La ventana no se abrió (usando otra app, Xiaomi Android 16, falta el permiso *encima*)». Ese
  permiso solo se le pedía al celular que lee los avisos, nunca a los que reciben.
- **Avisos no tomados:** los que ORDEVA no tomó estaban bien descartados. Eran plata enviada («Pasaste $… a…», «Envío
  exitoso… en el Nequi destino»), publicidad o «Aprueba tu pago».

## Pagos
| Problema | Arreglo |
|---|---|
| Xiaomi desbloqueado con ORDEVA abierta: no sonaba | La página reclamaba el pago y lo sonaba ella; si algo suyo fallaba, quedaba en silencio. Ahora **en la app Android suena siempre Android**, bloqueado o no, por el camino que ya funcionaba bloqueado. La página solo lo muestra. Si Android no responde, suena la página: nunca queda en silencio. |
| Android no le pasa el aviso del banco a ORDEVA con el celular en uso (Xiaomi) | La barra se revisa cada **2,5 s** (antes cada 10 s). |
| La lectura de avisos se desconecta | Se le pide a Android reconectarla cada **5 s** (antes cada minuto). Solo se pide; no se apaga y prende el componente seguido, porque en la 1.55.4 eso empeoraba todo con el celular bloqueado. |
| El motor de voz muerto demoraba el pago | Cada 30 s se revisa, sin sonido, que siga vivo. Si no, se prepara otro antes del siguiente pago. |
| Ventana del pago en Xiaomi o Huawei en uso | El aviso rojo que pide «Aparecer encima» o las «ventanas emergentes» de Xiaomi sale también en los celulares que solo reciben. |
| Saber de dónde viene una demora | Cada aviso lleva cuándo lo leyó el celular y la hora del banco. El diagnóstico muestra «banco → celular» y «celular → servidor». |

## Lector de códigos (auditoría)
| Lo que pasaba | Arreglo |
|---|---|
| En la caja, **la cámara se abría detrás de la caja** (capa 60 contra 8500): no se veía y parecía que no abría | La cámara, «¿Qué producto es?» y «Producto nuevo» van encima de la caja. |
| Cada toque cerraba la apertura en curso y pedía la cámara otra vez: «No se pudo abrir la cámara» | Otro toque mientras abre ya no la reinicia. |
| Tocar el fondo oscuro cerraba la cámara (los toques repetidos caían ahí) | Se cierra con ✕ o «Cerrar». |
| Cámara ocupada un momento (NotReadableError) | Reintenta sola y, al final, abre cualquier cámara. |
| Sin permiso: mensaje confuso | Dice cómo permitirla y sale «🔄 Reintentar». En la app Android, si Android ya no pregunta, abre los permisos de ORDEVA en Ajustes. |
| App Android: dos peticiones de cámara a la vez dejaban una colgada y la otra «negada» | Las peticiones quedan en fila y se responde según el permiso real. |
| Muchos botones («📷», «📱 Celular lector», «📱 Celular») | **Un solo botón «📷»** en la caja, la venta rápida y el inventario. El celular como lector está dentro de la cámara. |

### Cómo lo hacen los sistemas POS que ya funcionan (Loyverse, Square, Shopify POS, Bold)
1. **Lector de código de barras USB o Bluetooth como teclado:** no hay botón. Se dispara y el producto entra a la venta.
   ORDEVA ya lo hace en la caja y el inventario. Con la app ORDEVA, el celular también sirve así por Bluetooth.
2. **Cámara del celular con un solo botón:** abre de una a pantalla completa, lee seguido con pitido y vibración,
   tiene linterna y la opción de escribir el código a mano. Así queda ORDEVA ahora.
3. **Lector por hardware de la caja:** el datáfono o la tablet con escáner, que también escribe como teclado.

## Facturas y menú de Productos
- **«The PDF file is empty» al subir una factura en PDF:** el PDF llegaba **vacío (0 bytes)** desde el selector de
  Android. Pasaba con WhatsApp, Drive, Descargas y otras apps que no dicen el tamaño del archivo; el lector y la IA
  estaban bien.
  - Ahora la app copia el archivo elegido dentro de ORDEVA y le pasa la copia, con su tamaño y su nombre reales.
  - Si igual llega vacío (por ejemplo, desde la app vieja), sale un mensaje en español con qué hacer.
- **IA de facturas «sin límite»:** los topes del día de la IA de ORDEVA quedan tan altos que un negocio no los toca:
  5.000 lecturas al día por conexión y 200.000 en total. Queda solo el freno por minuto, para que nadie en internet gaste
  la clave.
- **🧂 Insumos y recetas solo para restaurantes:** ya no se prende con «Mostrar todas las funciones» ni en negocios sin
  tipo. Si el negocio ya tiene insumos o recetas, se siguen viendo.
  - Botón «🙈 No lo uso: ocultar» en la misma tarjeta.
  - Se vuelve a prender en Ajustes → Negocio → 🧩 Funciones.
- **Menú «Factura del proveedor» limpio:** sin el título repetido. Las etiquetas con código tienen su propia tarjeta
  «🏷️ Etiquetas con código».

## Pruebas
- **`escanear` (nueva, 13 ✅):** cámara de prueba que muestra un EAN-13 de verdad, leído por el mismo lector de ORDEVA.
  - Un toque abre en unos 300 ms, se ve encima de la caja y la «Gaseosa» entra a la venta. Al cerrar, la cámara se apaga.
  - Cinco toques seguidos abren una sola cámara.
  - Con permiso lento y varios toques, abre igual.
  - Con la cámara ocupada, reintenta.
  - Sin permiso dice cómo y sale «Reintentar».
  - Hay un solo botón.
- **`pagostodos` (17 ✅):**
  - Con ORDEVA abierta en Android, la página le pide a Android que suene y no lo suena ella.
  - Si Android no responde, suena la página.
- **`facturapdf` (nueva, 6 ✅):** un PDF de factura de verdad por «Galería o PDF».
  - Con la IA, la IA recibe el texto del PDF y salen productos, cantidades y costos.
  - Sin internet también se lee.
  - Un PDF vacío da un mensaje claro.
- **`modulosnegocio` (33 ✅):**
  - Una tienda con «todas las funciones» no ve Insumos.
  - El restaurante lo oculta y lo vuelve a prender.
  - El menú de facturas queda limpio.
- Más las pruebas de pagos, caja, lector, inventario, mesa y servidor (ver el commit).

## Lo que no se pudo probar aquí
- **Celulares reales:** Xiaomi, Huawei y Samsung, bloqueados y en uso. Los arreglos atacan lo que mostraron los datos de
  producción.
- **Permisos de cada marca:** si un Xiaomi o un Huawei tiene a ORDEVA con ahorro de batería o sin «Inicio
  automático», la marca la congela. ORDEVA lo avisa con su guía de cada marca.
