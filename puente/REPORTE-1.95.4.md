# ORDEVA 1.95.4 · 🧾 Arreglos de la auditoría y 🎵 música por QR que funcione bien

**Pedido del dueño:** «Continuemos, recuerda trabajar siempre con Elephant Goldfish, y revisa que poner música a través del
código QR funcione perfectamente».

**De dónde salen los arreglos:**
- la auditoría de la 1.95.3 (`puente/egm/AUDITORIA-1.95.3.md`);
- un revisor goldfish solo para la música por QR, que leyó el código sin la conversación y encontró 13 fallas.

Cada falla se revisó contra el código antes de arreglarla.

## La caja y la plata
| # | Qué pasaba | Qué cambió |
|---|---|---|
| M5 | Al cerrar la caja, «Cancelar» en el conteo del efectivo igual cerraba las cuentas abiertas como «debe», sin dejar el cierre. | Cancelar el conteo deja las cuentas abiertas como estaban, con sus abonos. |
| M1 | «Deshacer» un cobro perdía parte de la cuenta: el consumo mínimo propio, la plataforma, el huésped, la hora de entrada, los viajeros y la nota. | «Deshacer» devuelve la cuenta completa. |
| M2 | El total podía cambiar después de que se decía con cuánto pagan: lo cambiaban las horas del motel, el consumo mínimo u otro equipo que agregaba algo. El efectivo y las vueltas quedaban mal. | Si el total cambia, no se cobra. Sale el aviso con el total nuevo para volver a cobrar. |
| M4 | Si se cancelaba el cobro, la propina quedaba en la cuenta y al volver a cobrar se sumaba otra vez. | Al cancelar cualquier paso, la propina sale. También sale el pago «Pagó todo» que no llegó a cobrarse. |
| M3 | Bonos: un reintento después de un corte de internet podía descontar el bono dos veces. Un «Cancelar» mientras se usaba el bono podía descontarlo sin que hubiera venta. | El reintento usa la misma referencia y el servidor no descuenta dos veces. «Cancelar» espera mientras se usa el bono. Si la venta no queda, el saldo vuelve al bono. |
| M6 | La diferencia del consumo mínimo le daba comisión al mesero. | Ya no da comisión. |
| M7 | En las agencias, «Agregar» con cantidad se saltaba los cupos del plan. | También revisa los cupos. |

## 🎵 Música por el QR
| Qué pasaba | Qué cambió |
|---|---|
| Las canciones no traían el código secreto de la mesa, como sí los pedidos. Quien conociera el canal podía pedir con mesas inventadas: cada mesa falsa tenía su propio cupo y se colaba en la fila. El formato de texto viejo creaba la mesa (hasta la 500). | Una canción sin el código de su mesa solo entra si la mesa existe, y todas esas canciones comparten un solo cupo. El texto viejo ya no crea mesas. |
| El cliente tocaba el video oficial y el local buscaba otra vez: podía sonar un cover o la versión con letra. | El video que tocó el cliente viaja con la canción y es el que se pone. Si no se deja poner, se busca otra versión como antes. |
| El cliente solo veía «Enviado». No sabía si su canción estaba en la cola, si sonó o si nadie la recibió. | En «Tus pedidos» ve cada paso: 🎵 En la cola, 🔊 Sonando ahora, ✅ Ya sonó, 🚫 La quitaron, ⚠️ No se pudo poner. Si el local no responde, la canción se reenvía y sale el aviso, como los pedidos. |
| Con la música apagada en Ajustes, igual entraban canciones. | No entran, y el cliente ve «El local tiene la música apagada». |
| Una canción guardada sin conexión podía sonar hasta 12 horas después. | Si llega más de 20 minutos tarde, no entra, y el cliente ve que llegó tarde. |
| En un equipo que no pone la música, una canción rechazada por el cupo mostraba «canción nueva». El equipo de la música no le avisaba al cliente que la mesa no tenía cupo. | El aviso de «sin cupo» le llega al cliente desde cualquier equipo. |
| Si la búsqueda fallaba (servidor o internet caídos), la canción quedaba en la cola sin video y nunca sonaba. | Se vuelve a buscar sola cada minuto. |
| Las canciones quitadas o que no se pudieron poner seguían gastando cupo de la mesa. | Ya no gastan cupo. |
| La misma canción repetida desaparecía sin aviso, pero contaba en el celular. | El cliente ve «Esa canción ya está en la cola» y no le cuenta. |
| Con muchas búsquedas en el mismo Wi-Fi, el servidor frena y el cliente veía «No encontramos nada». | Ve «Hay muchas búsquedas en este momento, espera un minuto». |

## Varios equipos, celular y mensajes falsos
- **Y2 · Menú del día:** al empezar el día, un equipo ponía las porciones de ayer en 0. Al mezclar con otro equipo que ya había
  puesto el menú de hoy, se perdían porciones. Ahora primero trae los datos de la nube (5 s como mucho). Si otro equipo ya
  puso el de hoy, no lo toca, y sin internet espera.
- **Y3 · Domicilios:** antes de facturar un domicilio se traen los datos de la nube (4 s como mucho). Si otro equipo ya lo
  facturó, no se factura dos veces.
- **Y7 · Códigos de mesa:** se guardan hasta 32 por mesa entre equipos (antes 8). Con más de 8, los equipos se los quitaban
  entre sí sin parar.
- **S4 · Mensajes falsos:**
  - con los domicilios apagados, el link no guarda nada;
  - como mucho 40 domicilios del link por facturar;
  - como mucho 30 pedidos sin código esperando que los acepten;
  - como mucho 50 solicitudes de planes sin atender.
- **P1 · Rol:** ya no se puede quitar uno mismo el administrador. Eso escondía Productos, Inventario y Ajustes, y es la causa
  más probable de lo que pasaba en el celular del dueño.
- **P2 · Menú del mesero:** un botón escondido del menú ya no se ve. Antes el mesero sin permiso veía «Caja POS».
- **P3 · Menú de abajo:** con el celular acostado, en plegables y en tabletas (761 a 1023 px), queda fijo abajo.
- **P4 · Más:** «Más» trae Productos e Inventario.
- **P5 · Reportar un problema:** el diagnóstico lleva el rol, los menús escondidos y el tamaño de la pantalla, para
  confirmar desde lejos por qué no sale un menú.

## Cómo está hecho
- **La caja:**
  - `app/04g` (M5): respaldo de las cuentas antes de cerrarlas, y `deshacerCierreAbiertas`;
  - `lib/vento-pos.js` `cobrarMesa` (M1, M2, M3);
  - `app/04c` (M4, M7);
  - `lib/vento-comisiones.js` (M6);
  - `lib/vento-bonos.js` (M3: una referencia por bono en cada ventana de cobro, `ov._ocupado` y `devolverSinVenta`).
- **La música:**
  - `app/09`: `procesar` (código de mesa, música apagada, muy tarde), `agregarCancion` (cupo compartido sin código, `vid0`,
    respuestas), `mzResponder` y `mzAvisarCliente` (canal de estados `c+'e'`, igual que los pedidos), `mqComando`, `ytUno`
    y el reintento cada minuto;
  - `pedido.html`: manda `vid`, muestra las canciones en «Tus pedidos», atiende los estados nuevos, distingue el 429 y trae
    4 textos nuevos en los 6 idiomas.
- **Varios equipos y mensajes falsos:**
  - `lib/vento-menudia.js` (Y2);
  - `app/04f` (Y3);
  - `app/09` (Y7 y el tope de pedidos sin código);
  - `app/04e` y `lib/vento-agencia.js` (S4).
- **El celular:**
  - `index.html` (P2, P3, P4);
  - `lib/vento-cuenta.js` (P5);
  - `app/04h` (P1).
- **Sin cambios en el servidor.** Las canciones usan el mismo canal de estados que ya usaban los pedidos.

## Pruebas
- **Nuevas:**
  - `v1954` (20): cada arreglo de la caja, los bonos (con un servidor de bonos de mentira), los topes, el menú y el rol;
  - `musicaqr` (20): contra el servidor de pruebas, con la app y `pedido.html` de verdad. Cubre los estados que ve el
    cliente, la quitada que no gasta cupo, el video elegido, las canciones sin código, la música apagada, la que llega tarde,
    la repetida y el 429.
- **Al CI de cada publicación** se suman `v1954`, `musicaqr` y tres de música que solo corrían de noche: `cancionesmesa`,
  `pedidomusica` y `musicaequipo`.
- **Resultados:** se anotan abajo cuando termine la lista completa.
- **No se probó con celulares ni con un televisor de verdad.**

## Lo que queda para el plan (no entra en la 1.95.4)
- **Un televisor emparejado con un equipo que no es el de la música** no recibe nada.
- **Los mensajes del televisor** («sonando», «terminó») no se reintentan.
- **Al recargar** se pierde la canción que sonaba.
- **El cambio de equipo de la música** depende de un latido por minuto.
- **El límite de búsquedas** del servidor es por IP (todo el Wi-Fi del bar comparte una): va con la 1.96, en el servidor.
