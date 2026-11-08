# Plan de la 1.96 · El servidor (lo que queda de la auditoría 1.95.3)

**Pedido del dueño:** «continúa» → el siguiente punto del plan (`POS-COMPLETO.md`, 6c, punto 0).
**Regla:** cambio en el servidor → revisión goldfish del plan (este documento) **y** del cambio, antes de publicar.
Publicar = subir a la rama principal. El flujo `Servidor Vento` aplica las migraciones y las funciones a producción
después de probarlas sobre un PostgreSQL vacío.

## 1. S1 · El QR de pago y los canales del negocio solo los escribe el negocio
**Hoy:**
- `canal_publicar` no pide sesión: lo usa el cliente del QR para mandar pedidos al canal `c`.
- Los canales del negocio derivados de `c` son públicos para escribir:
  - `c+'e'`: estados de pedidos y canciones;
  - `c+'k'`: la carta;
  - `c+'f'`: las fotos y el QR de pago `__qrpago__`, con la llave Bre-B;
  - `c+'a'`: el ambiente o vitrina.
- Quien vea el QR de una mesa conoce `c`. Puede publicar en `c+'f'` un QR de pago falso, y los clientes le pagarían a otro.

**Cambio:**
- **En el servidor (migración nueva):**
  - si el canal es `X + e|k|f|a` y `X` es un canal de pedidos registrado en `canal_privado`, publicar pide la sesión de un
    miembro de ese negocio (`es_miembro`);
  - si el canal mismo está en `canal_privado` (es un canal de pedidos), sigue abierto: el cliente del QR escribe ahí;
  - los canales que no están registrados siguen como hoy: negocios sin nube y pruebas locales.
- **7 días de gracia** (`servidor_config.canal_escribir_desde`, como hizo la 1.54 con la lectura). Un celular del negocio
  con la versión anterior, que publica sin sesión, no se queda sin carta, estados ni QR de pago mientras se actualiza.
- **En la app (`lib/vento-canal.js`):** publicar con la sesión de ORDEVA cuando la hay, igual que ya hace al leer. Si la
  sesión falla (401/403), se reintenta sin sesión, como ahora.

**Quién publica en esos canales hoy** (revisado en el código): solo `index.html`, que tiene sesión:
- `app/09`: estados y carta;
- `app/12`: fotos;
- `app/16`: QR de pago;
- `app/25`: vitrina.

`pedido.html`, `mesero.html`, `preparacion.html` y `tv.html` no escriben en `e`, `k`, `f` ni `a`.

**No cubre (al plan):** los canales de la cuenta en vivo de cada mesa (el código `v`). No están registrados; van con S2
(códigos por cuenta abierta).

## 2. S10 · Nequi solo para el administrador
**Hoy:** `pagos_estado` les devuelve a todos los miembros `publico` de cada proveedor: el código de comercio de Nequi, la
terminal y el comercio de DaviPlata, y la llave pública y el comercio de Wompi. Así lo ve el mesero.

**Regla del dueño:** «solamente el administrador puede ver lo del Nequi».

**Cambio:**
- `publico` completo solo para el dueño y el administrador;
- a los demás roles solo les llega lo que necesita `resumen()` (`vento-pagos/app.ts`), que es la lista de métodos de Wompi;
- el resto, `{}`.

El mesero sigue viendo si Nequi o DaviPlata están conectados: el botón «Cobrar cuenta» no cambia.

## 3. S6 · Bonos: solo el dueño, el administrador o el cajero los crean
**Hoy:** cualquier miembro (un mesero) puede crear bonos con valor (`bono_crear` solo pide `es_miembro`).

**Cambio:**
- `bono_crear` pide el rol `dueno`, `admin` o `cajero` (`rol_en`);
- usar un bono (`bono_redimir`) y devolverlo siguen abiertos a cualquier miembro, porque un mesero también cobra;
- en la app, el error `sin_permiso` dice «Solo el dueño, el administrador o el cajero pueden vender bonos».

**Límite conocido:** los empleados que entran con PIN en el equipo del dueño usan la sesión del dueño. Para el servidor son
el dueño. Esto solo protege a los miembros invitados con su propia cuenta.

## 4. Límite de búsquedas de música
**Hoy:** `vento-ia` permite 40 búsquedas de YouTube por minuto por IP, el mismo contador que la IA. Todo el Wi-Fi de un bar
comparte una IP, y cada búsqueda del cliente son 2 llamadas: con 20 clientes buscando a la vez, todos ven «muchas
búsquedas».

**Cambio:**
- un contador aparte para YouTube: 150 por minuto por IP (la IA sigue en 40);
- en `pedido.html`, las búsquedas ya hechas se recuerdan 10 minutos en ese celular, para no repetirlas.

**No es «por mesa»:** el servidor no puede comprobar el código de una mesa sin abrir otra puerta. Por mesa queda en el
plan con S2 y S3.

## 5. Pruebas
- **Servidor nueva:** `canalescritura`, contra PostgreSQL de verdad:
  - el cliente del QR publica en `c`;
  - sin sesión no publica en `c+'f'` (después de la gracia), pero sí durante la gracia;
  - un miembro sí publica;
  - un miembro de otro negocio no publica;
  - un canal no registrado sigue abierto;
  - un canal de pedidos que termina en `e`, `k`, `f` o `a` sigue abierto.
- **Servidor, ampliar:**
  - `pagosprivados`: el mesero no recibe `publico`, salvo los métodos de Wompi;
  - `bonos`: el mesero no crea bonos; el cajero sí; el mesero sí redime.
- **App:** una prueba de punta a punta (con `supabase-local`): la app del negocio con sesión publica la carta, el QR de
  pago y los estados; el QR de pago que manda un desconocido no llega al cliente.
- **Lista completa**, las 29 pruebas del servidor y `revisar-migraciones` (ninguna migración borra datos).

## 6. Riesgos y cómo se cubren
- **Un celular del negocio con versión vieja deja de publicar.** Cubierto con los 7 días de gracia y con la app que se
  actualiza sola al abrir.
- **Sesión vencida.** La app reintenta sin sesión (falla después de la gracia). `ventoNube` renueva la sesión sola, y el
  canal reintenta en la siguiente publicación.
- **Mezclar canales de dos negocios.** Si dos negocios tuvieran registrados `X` y `Xe`, el canal `Xe` es de pedidos y
  queda abierto (punto 1).
- **No se borra nada:** la migración solo agrega una fila de configuración y reemplaza funciones.
