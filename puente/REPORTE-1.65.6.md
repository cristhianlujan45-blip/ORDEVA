# ORDEVA 1.65.6 · Lista de equipos clara con «🔔 Probar», el celular como lector en la caja y el inventario, apariencias rediseñadas y vista sencilla de fábrica

## Qué pidió el dueño
- «Déjame en modo sencillo, como predeterminado de apariencias.»
- «Organízame las apariencias, que no haya repetidas, que cada paleta sea diferente, como un diseñador profesional.»
- «Escanear los códigos de barras con el celular para hacer inventario o para la caja POS, inalámbrico (Bluetooth, HTTP,
  lo que sea mejor) y también por USB.»
- «Todavía me salen los dispositivos así (todos “Dueño · Android”). Que salga el nombre del dispositivo y solo los
  conectados a mi cuenta. Que yo pueda probar cada equipo; si le quito que suene, que no suene, y si lo vuelvo a activar,
  que suene otra vez.»

## 1. «🔊 Celulares y dónde suenan los pagos»
**Nombre de verdad.** Cada equipo se pone solo su nombre al entrar:
- `📱 Samsung Galaxy A34 (SM-A346M) · app ORDEVA`
- `💻 Computador Windows · programa ORDEVA`
- `📱 Xiaomi 24090RA29G · Chrome`

Chrome en Android esconde el modelo, así que se le pregunta al navegador. Si el dueño le puso un nombre propio con
✏️ (por ejemplo «Caja»), ese no se toca. Los equipos que todavía tienen el nombre viejo («Dueño · Android») muestran el
modelo que guardó el servidor.

**Solo los de la cuenta:**
- Arriba, «Tus equipos»: los de su cuenta que se están usando.
- Si hay empleados, sus equipos aparecen en «De tu equipo de trabajo».
- Aparte y cerrado, «🗂️ Equipos viejos o repetidos (N)». Ahí van los que llevan más de 14 días sin abrir ORDEVA, el
  mismo celular registrado otra vez al reinstalar y los de cuentas que ya no están en el negocio. Tiene un botón
  **«🧹 Retirar los viejos»**.

**«🔔 Probar» en cada equipo:**
- Hace sonar en ESE equipo un pago de prueba de $1.000 por Nequi, con ventana o notificación, sonido y voz, y no crea
  ningún pago.
- Llega por el mismo canal en vivo de los pagos (migración `20261121000000_dispositivo_probar.sql`).
- En la app Android la atiende el servicio de fondo, así que suena aunque el celular esté bloqueado.
- Respeta «🔕 NO SUENA»: en ese caso solo avisa «está en NO SUENA».
- La prueba lleva desde el servidor si ese equipo suena, así que un cambio hecho hace un segundo ya cuenta.
- Pueden probar el dueño, el administrador y quien usa ese equipo. Un empleado no puede hacer sonar el celular del
  dueño, y nadie de otro negocio puede probar nada.

## 2. El celular como lector de códigos (caja e inventario)
Los códigos que lee el celular entran solos a lo que esté abierto en el computador, en este orden:
1. La **caja** (POS de tienda y modo fácil).
2. La **cuenta de una mesa**.
3. La **venta rápida**.
4. La **toma de inventario**.

Si no hay nada abierto, el celular avisa «allá no había nada abierto».

Hay un botón «📱 Celular lector» en la barra de la caja, en el modo fácil, en el inventario y en la venta rápida. Muestra
si hay un celular conectado (🟢).

| Conexión | Cómo |
|---|---|
| 📶 **Inalámbrico (wifi o datos)** | Se escanea el QR con el celular y se abre el lector. Es lo recomendado: no se instala nada. |
| 🔵 **Bluetooth, sin internet** | La app ORDEVA se presenta al computador como un teclado Bluetooth (Android 9 o más, `TecladoBT.java`). Se empareja una vez y cada código se «escribe» seguido de Enter, igual que una pistola lectora. Sirve también en otros programas. |
| 🔌 **Cable USB** | Android 14 o más: el celular como cámara web (aviso «USB» → Cámara web) y luego «📷 Cámara» en «🔳 Escanear código». También sirven DroidCam o Iriun. |

## 3. Apariencias
Están rediseñadas como un sistema, en tres grupos: ☀️ Claras, 🌙 Oscuras y 🎉 Fechas especiales.
- **Que se lean bien (contraste WCAG):**
  - La letra se lee 7:1 o más.
  - La letra suave, 4,5:1.
  - El texto de los botones sobre el color de acento, 4,5:1. Se elige solo blanco u oscuro; antes era blanco fijo y en
    los acentos claros no se leía.
- **Ninguna se parece a otra:** se mide la distancia de color CIE Lab de fondo y acento.
  - Antes «Cervecería» y «Velitas» eran casi iguales.
  - «Navidad» y «Turquesa» tenían el mismo fondo, y también «Noche» y «Halloween».
- **Nuevas:** 🌿 Menta fresca y ⚫ Grafito y lima.
- **Vista previa de verdad:** cada tarjeta muestra el fondo, una tarjeta y el botón «Cobrar».
- **Página de pedidos de los clientes:** usa los mismos colores.

## 4. Vista sencilla de fábrica
- Viene **prendida**.
- Quien ya la había apagado la sigue teniendo apagada.
- Se apaga en Ajustes → Apariencia.

**Error corregido.** Con la vista sencilla prendida, el menú «Más» le mostraba **Ajustes** al cajero, y también lo que
el plan o el rol esconden. La regla de estilo de la lista le ganaba a la que los esconde. Venía de la 1.63.0, pero ahora
que la vista sencilla es la de fábrica habría salido en todos los equipos. Quedó cubierto en `vistasencilla` y en
`flujocompleto`.

## Pruebas
- **`equiposprobar` (nueva, 19 ✅):** PostgreSQL real, Servidor ORDEVA y la app en un celular Android, un computador y
  una tableta, con el Realtime simulado.
  - Nombres de verdad, incluido el modelo que Chrome esconde.
  - Equipos viejos, repetidos y de cuentas que ya no están, aparte. «Retirar los viejos» los retira de verdad.
  - «Probar» suena solo en ese equipo y no crea pagos. En el celular Android se lo deja a Android.
  - En NO SUENA no suena; con SUENA otra vez, suena.
- **`pagosprivados` del servidor (42 ✅):** quién puede probar, qué sale por el canal (solo el id del equipo y si suena)
  y que no crea pagos.
- **`apariencias` (nueva, 16 ✅):** contraste, que ninguna se parezca a otra, grupos, vista previa, colores aplicados y
  pedido.html.
- **`lectorcel` (24 ✅):** el celular manda códigos a la caja y a la toma de inventario.
- **`vistasencilla` (45 ✅):** prendida de fábrica; se apaga y todo vuelve a como estaba. Un empleado no ve Ajustes en
  «Más».
- **Pruebas de la vista completa** (`cerrarcaja`, `mesa`, `mesarepetida`, `sonidomesa`): ahora la piden explícitamente,
  porque en la sencilla esos botones están en «💵 Caja» y «⋯ Opciones».
- **Esperas más firmes** en `cuentacliente`, `usuariosequipo` y `pinempleado`. Fallaban al azar, también en la 1.65.5,
  si la página se recargaba justo al sacar la sesión.
- **Toda la batería, sin fallas:**
  - Las 38 de la integración continua y las otras 71.
  - Las 21 del servidor, con PostgreSQL real.
  - La revisión de las 47 migraciones.
- **`javaenvivo` (13 ✅):** la conexión en vivo de Android con la prueba.

## Lo que no se pudo probar
- **El Bluetooth de verdad**, porque aquí no hay celular ni computador con Bluetooth. Está escrito con la API oficial de
  Android (`BluetoothHidDevice`). Algunos celulares (pocos) traen el perfil de teclado apagado de fábrica; en esos
  queda el modo 📶.
- **Lo publicado:** la lista del pantallazo es la versión publicada. Estos cambios salen cuando esta rama se une a la
  principal; la app Android y el programa de PC se actualizan con su release.
