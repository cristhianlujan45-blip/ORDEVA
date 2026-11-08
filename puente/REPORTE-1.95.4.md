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
| M5 | Al cerrar la caja, «Cancelar» en el conteo del efectivo igual cerraba las cuentas abiertas como «debe», sin dejar el cierre. | Cancelar el conteo deja las cuentas abiertas como estaban, con sus abonos y con lo que entró mientras se contaba. Los números de factura vuelven. |
| M1 | «Deshacer» un cobro perdía parte de la cuenta: el consumo mínimo propio, la plataforma, el huésped, la hora de entrada, los viajeros y la nota. | «Deshacer» devuelve la cuenta completa. |
| M2 | El total podía cambiar después de que se decía cómo pagan: lo cambiaban las horas del motel, el consumo mínimo u otro equipo que agregaba algo. El efectivo, las vueltas o lo que entró por Nequi y tarjeta quedaban mal. | Si el total cambia mientras se elige cómo pagan, no se cobra con ningún medio menos el fiado. Por voz, no se cobra si el cobro traía efectivo y vueltas. Sale el aviso con el total nuevo para volver a cobrar. Si el cambio es porque el cajero aceptó «Sumar y cobrar» (motel, consumo mínimo), se cobra el total nuevo. |
| M4 | Si se cancelaba el cobro, la propina quedaba en la cuenta y al volver a cobrar se sumaba otra vez. | Al cancelar cualquier paso, la propina sale, aunque mientras tanto lleguen datos de la nube. También sale el pago «Pagó todo» que no llegó a cobrarse. |
| M3 | Bonos: un reintento después de un corte de internet podía descontar el bono dos veces. Un «Cancelar» mientras se usaba el bono podía descontarlo sin que hubiera venta. | El reintento usa la misma referencia y el servidor no descuenta dos veces. «Cancelar» espera mientras se usa el bono (15 s como mucho). Al cerrar la ventana de cobro, cada bono que no quedó en la venta se devuelve. Sin internet, la devolución queda guardada y se reintenta sola. |
| M6 | La diferencia del consumo mínimo le daba comisión al mesero. | Ya no da comisión. |
| M7 | En las agencias, «Agregar» con cantidad se saltaba los cupos del plan. | También revisa los cupos. |

## 🎵 Música por el QR
| Qué pasaba | Qué cambió |
|---|---|
| Las canciones no traían el código secreto de la mesa, como sí los pedidos. Quien conociera el canal podía pedir con mesas inventadas: cada mesa falsa tenía su propio cupo y se colaba en la fila. El formato de texto viejo creaba la mesa (hasta la 500). | Una canción sin el código de su mesa solo entra si la mesa existe, y todas esas canciones comparten un solo cupo. El texto viejo ya no crea mesas. |
| El cliente tocaba el video oficial y el local buscaba otra vez: podía sonar un cover o la versión con letra. | El video que tocó el cliente viaja con la canción. Se pone si sale en la búsqueda de esa misma canción (con las revisiones de siempre); si no, se busca como antes. Así nadie pone en el TV un video cualquiera. |
| El cliente solo veía «Enviado». No sabía si su canción estaba en la cola, si sonó o si nadie la recibió. | En «Tus pedidos» ve cada paso: 🎵 En la cola, 🔊 Sonando ahora, ✅ Ya sonó, 🚫 La quitaron, ⚠️ No se pudo poner. Si el local no responde, la canción se reenvía y sale el aviso, como los pedidos. |
| Con la música apagada en Ajustes, igual entraban canciones. | No entran, y el cliente ve «El local tiene la música apagada». |
| Una canción guardada sin conexión podía sonar hasta 12 horas después. Un equipo recién abierto volvía a poner las canciones de la noche. | El celular ya no manda canciones guardadas más de 20 minutos. El local no procesa mensajes de más de 20 minutos (hora del servidor, no la del celular). |
| Con varios equipos, cada uno contaba el cupo a su manera y le contestaba al cliente; el equipo de la música no avisaba «sin cupo», y las respuestas salían por el canal equivocado. | Solo el equipo de la música decide el cupo y le contesta al cliente, por el canal de ese cliente. En el celular, los estados solo avanzan. |
| Si la búsqueda fallaba (servidor o internet caídos), la canción quedaba en la cola sin video y nunca sonaba. | Se vuelve a buscar sola cada minuto, hasta 10 veces; después el cliente ve «No se pudo poner». |
| Las canciones quitadas o que no se pudieron poner seguían gastando cupo de la mesa. | Ya no gastan cupo, ni en el local ni en el celular del cliente. |
| La misma canción repetida desaparecía sin aviso, pero contaba en el celular. | El cliente ve «Esa canción ya está en la cola» y no le cuenta. |
| Con muchas búsquedas en el mismo Wi-Fi, el servidor frena y el cliente veía «No encontramos nada». | Ve «Hay muchas búsquedas en este momento, espera un minuto». |

## Varios equipos, celular y mensajes falsos
- **Y2 · Menú del día:** al empezar el día, un equipo ponía las porciones de ayer en 0. Al mezclar con otro equipo que ya había
  puesto el menú de hoy, se perdían porciones. Ahora solo las pone en 0 si alcanzó a traer los datos de la nube y otro equipo
  no puso todavía el de hoy. **Lo que cuesta:** sin internet, el menú de ayer se sigue vendiendo hasta que vuelva la conexión.
  Arreglarlo del todo necesita «poner» en vez de «sumar» en el inventario (en el plan).
- **Y3 · Domicilios:** antes de facturar un domicilio se traen los datos de la nube (4 s como mucho), con el botón bloqueado.
  Si otro equipo ya lo facturó, no se factura dos veces. **No lo cierra del todo:** si dos equipos lo facturan en el mismo
  segundo, todavía puede pasar. Eso necesita el servidor (en el plan de la 1.96).
- **Y7 · Códigos de mesa:** se guardan hasta 32 por mesa entre equipos (antes 8). Con más de 8, los equipos se los quitaban
  entre sí sin parar.
- **S4 · Mensajes falsos:**
  - como mucho 40 domicilios del link y del agente por facturar en 24 h;
  - como mucho 30 pedidos sin código esperando que los acepten (en 24 h);
  - como mucho 50 solicitudes de planes sin atender.

  Lo que se deja por fuera queda anotado en la auditoría del negocio.
- **P1 · Rol:** ya no se puede quitar uno mismo el administrador. Eso escondía Productos, Inventario y Ajustes, y es la causa
  más probable de lo que pasaba en el celular del dueño. **No arregla un celular que ya quedó como mesero** ni uno que entró
  con el PIN de un empleado. Para eso: mirar arriba si dice «· Mesero» o «· Cajero» y entrar con el usuario del dueño. El
  diagnóstico nuevo (P5) lo confirma desde lejos cuando se use «Reportar un problema».
- **P2 · Menú del mesero:** un botón escondido del menú ya no se ve. Antes el mesero sin permiso veía «Caja POS».
- **P3 · Menú de abajo:** con el celular acostado, en plegables y en tabletas (761 a 1023 px), queda fijo abajo.
- **P4 · Más:** «Más» trae «Productos e inventario» (es una sola pantalla).
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

## Revisión goldfish (EGM) antes de publicar
Tres revisores sin la conversación (Codebase Details, Design y Zoom Out) revisaron el cambio terminado. Detalle:
`puente/egm/REVISION-GOLDFISH-1.95.4.md`.
- **El bloqueante:** el video que manda el cliente se usaba sin revisarlo. Ya está corregido (arriba, en la música).
- **También se corrigió:**
  - el canal de cada canción;
  - un solo equipo le contesta al cliente;
  - el cupo en el celular del cliente;
  - los números de factura y lo que entra mientras se cuenta la caja;
  - el bono cuya respuesta se pierde;
  - el total que cambia con cualquier medio de pago;
  - la propina después de datos de la nube;
  - los domicilios del agente;
  - el menú del día y el domicilio sin respuesta de la nube.

  Cada uno, contra el código y con su prueba.

## Pruebas
- **Nuevas:**
  - `v1954` (23): cada arreglo de la caja, los bonos (con un servidor de bonos de mentira), los topes, el menú y el rol;
  - `musicaqr` (26): contra el servidor de pruebas, con la app y `pedido.html` de verdad. Cubre los estados que ve el
    cliente, la quitada que no gasta cupo, el video elegido, las canciones sin código, la música apagada, la que llega tarde,
    la repetida y el 429.
- **Al CI de cada publicación** se suman `v1954`, `musicaqr` y tres de música que solo corrían de noche: `cancionesmesa`,
  `pedidomusica` y `musicaequipo`.
- **Las 12 pruebas de música de antes** pasan: `cancionesmesa`, `musicaanuncios`, `musicaautoplay`, `musicaequipo`,
  `musicafacil`, `musicafondo`, `panelyoutube`, `pedidomusica`, `puertaytiemporeal`, `tvocupado`, `ventanayoutube` y
  `youtubesincupo`.
- **Lista completa (127 pruebas, la misma del CI con `facturascan`):**
  - **Primera corrida:** 2.808 revisiones bien y 7 mal, en 3 pruebas:
    - `v185` y `v195`: el arreglo M2 rechazaba el cobro por voz cuando el cajero aceptaba «Sumar y cobrar» (horas del motel,
      consumo mínimo). Ahí el cajero acepta el total nuevo a sabiendas. Ahora, por voz, solo se rechaza si hay efectivo y
      vueltas de por medio. Desde la ventana de cobro se rechaza con cualquier medio menos el fiado.
    - `v189`: espera un orden fijo en «Más». El botón «Productos e inventario» quedó después de Música.
  - **Esas 3 otra vez, junto con `v1954`, `cajavoz` y `cobrosimple`:** todas bien (`v185` 17, `v189` 7, `v195` 22).
  - **Las 124 restantes:** pasaron en la primera corrida.
- **No cambia el servidor ni Android:** valen los de la 1.94.0 (servidor 29 de 29, Android 328 de 328).
- **No se probó con celulares ni con un televisor de verdad.**

## Lo que queda para después
Está en el plan (`puente/egm/POS-COMPLETO.md`, sección 6c, puntos 0 y 0b). Lo principal:
- **Lo que puede dejar el bar en silencio:**
  - el televisor emparejado con un equipo que no es el de la música;
  - el cambio de equipo de la música.
- **Va con la 1.96 (servidor):**
  - el límite de búsquedas por Wi-Fi;
  - «una sola vez» en el servidor para facturar un domicilio;
  - los bonos con «apartar y confirmar»;
  - el código de mesa a la vista en el canal.
- **El inventario con «poner»** en vez de «sumar».
- **Contar la caja antes de cerrar las cuentas.**
