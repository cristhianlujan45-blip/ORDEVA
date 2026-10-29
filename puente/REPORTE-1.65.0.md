# ORDEVA 1.65.0 · 📱 Escanear con otro celular · Productos reconocidos por su código · Diagnóstico de los pagos

## 1. 📱 Escanear con otro celular (QR)

### Lo que pasaba
- ORDEVA no tenía una función para escanear con otro celular.
- Con el otro celular conectado al mismo negocio, cada código viajaba con la sincronización general de los datos.
  Eso es lento y no está hecho para un código detrás de otro: «solo detectó uno y después no mandaba más».
- Además, el escáner se cerraba al leer un código desconocido.

### Lo nuevo
- Hay un botón **«📱 Escanear con otro celular»** en dos lugares:
  - en la ventana del escáner de siempre;
  - en Inventario → Agregar producto («📱 Con otro celular»).
- Muestra un QR. El otro celular lo lee con la cámara y se abre `escaner.html`:
  - no hay que iniciar sesión;
  - el canal es privado y nuevo cada vez.
- **Cada código llega al instante por el canal en vivo.**
  - Del celular a la cuenta tardó 0,7 s en la prueba.
  - Mientras el escáner está conectado, las dos puntas revisan el canal cada 0,8 s, y el servidor además avisa en vivo.
    Lo demás del canal sigue igual.
- **No se pierde ninguno:**
  - lo leído se manda en orden;
  - si se cae la señal, el celular reintenta solo y lo dice en pantalla.
- **🛒 Vender:**
  - el producto va a la cuenta abierta o, si no hay una, a la caja;
  - el celular ve el nombre y dónde quedó;
  - «Cada lectura cuenta» (1, 2, 3…) para vender varios de una vez.
- **📥 Llegó mercancía:**
  - la caja pregunta cuántas llegaron, el costo (si cambió) y el precio;
  - suma al inventario y queda en el kárdex;
  - se puede quitar la pregunta para que cada lectura sume de una.
- La caja sigue trabajando mientras tanto. Una pastilla «📱 Escáner conectado · N» abre el panel, y «Terminar» le
  avisa al celular.
- **Celulares sin lector de códigos en el navegador** (iPhone, por ejemplo): se escribe el código y se manda igual.

## 2. 🇨🇴 Reconocer el producto por su código (canasta colombiana)

### Cómo se llena la ficha de un código nuevo
Ya no hay que escribirlo todo. La ficha se llena sola, de lo más confiable a lo menos:
1. **Lo que ORDEVA ya aprendió** (catálogo compartido, nuevo).
   - Cada vez que un negocio enlaza un código con su producto, ORDEVA guarda solo el código, el nombre, la marca, el
     tamaño y la categoría. Nunca precios, costos ni existencias.
   - El siguiente negocio que escanee esa misma gaseosa o ese arroz ya lo encuentra.
   - Así ORDEVA va conociendo la canasta colombiana (códigos 770…), que las bases mundiales casi no tienen.
   - Si dos negocios lo llaman distinto, queda el nombre que más veces se ha puesto.
2. **Las bases libres:** Open Food Facts (comida), Open Products Facts (aseo y hogar) y Open Beauty Facts.
3. **Con la IA del negocio:**
   - la IA busca el código en internet, en supermercados colombianos y en el fabricante;
   - solo vale si encuentra una página con ESE código, y sale marcado «🤖 revísalo».
4. **Si nadie lo conoce:** el celular muestra «📷 Foto del producto» y la IA lo reconoce en la foto.

### Reglas de la ficha
- Dice si el producto es colombiano (código 770…) y de dónde salió cada dato.
- **El precio y el costo los pones tú:** ORDEVA nunca inventa precios.
- Al guardar, el código queda enlazado y ORDEVA lo aprende.
- El escáner de siempre (Productos → Código de barras y «Vender escaneando») usa la misma búsqueda y también enseña al
  catálogo.

### En el servidor
- Migración `20261118000000_catalogo_codigos.sql`: tablas nuevas con RLS y sin acceso directo, solo por las funciones.
- `catalogo_buscar` es para cualquier usuario con sesión.
- `catalogo_aportar`:
  - solo miembros de un negocio;
  - máximo 300 aportes por hora por usuario;
  - códigos o nombres raros no entran.
- No toca nada de lo que ya existe.

## 3. 💜 Diagnóstico de los avisos de pago (solo lectura, 25 oct)
- Nuevo flujo de GitHub «Diagnóstico de pagos» (`.github/workflows/diagnostico-pagos.yml`). Se corre a mano, solo lee
  y muestra cuentas y conteos, sin nombres ni teléfonos.
- **Lo que mostró:**
  - Los avisos SÍ están llegando al servidor: 162 pagos en 7 días, todos desde el celular que lee los avisos de Nequi
    y DaviPlata. El último fue el 25 oct a la 1:58 p. m.
  - Ningún equipo tiene los pagos callados.
  - Ningún equipo tiene activada la notificación con la app cerrada (Web Push).
- **El problema está en el celular que lee los avisos (Xiaomi, Android 16):**
  - a veces ORDEVA los leyó tarde: 103 s, y una vez 1.215 s (20 min);
  - la ventana del pago no se abrió por falta del permiso «Mostrar encima de otras apps».
  - Eso es el ahorro de batería de Xiaomi frenando a ORDEVA.
- **Qué hacer en ese celular:** Ajustes → 💜 Pagos → revisar la lista y tocar «Arreglar» en lo que falte:
  - Inicio automático;
  - batería «Sin restricciones»;
  - mostrar encima de otras apps;
  - y dejar ORDEVA con candado en las apps recientes.

## Pruebas
- **`escanerremoto` 19/19 (nueva):**
  - la caja y el celular de verdad, con el canal simulado;
  - 10 lecturas seguidas y fallas de señal;
  - llegó mercancía con el kárdex;
  - código nuevo con la ficha llena, el colombiano y sin precio inventado;
  - código desconocido, la venta a la caja y «Terminar».
- **`servidor/catalogo` 12/12 (nueva):** aportar y buscar, el nombre más votado, sin sesión, sin negocio, códigos
  raros, el tope por hora y sin acceso directo.
- **Servidor:** 22/22 archivos.
- **Migraciones:** las 44 se aplican sobre una base vacía, todas con RLS.
- **App:** 103 archivos de prueba, en 4 partes a la vez.
  - Las que fallaron por la carga de la máquina pasan corridas solas: appoweb 25/25, cuentas 43/43, entrar 35/35,
    adminsub 71/71 y pagosequipos 49/49.
  - `almacen` sigue fallando a veces, igual que con la 1.62.0 (ver el reporte de la 1.63.0).

