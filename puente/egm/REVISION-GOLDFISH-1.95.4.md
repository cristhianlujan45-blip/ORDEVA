# Revisión Goldfish de la 1.95.4 (arreglos de la auditoría y música por QR)

**Por qué:** la 1.95.4 toca la plata: el cierre de caja, el cobro, los bonos, la propina y las comisiones. La regla del plan
dice que estos cambios pasan por una revisión goldfish antes de publicarse.

**Cómo:**
- **Antes de escribir el código:** un revisor goldfish solo para la música por QR leyó el código de la 1.95.3 y encontró 13
  fallas.
- **Después, sobre el cambio terminado:** tres revisores del plugin EGM, sin la conversación:
  - **Codebase Details:** exactitud técnica;
  - **Design:** arquitectura;
  - **Zoom Out:** alcance, y si quedó algo por fuera del plan.

Cada hallazgo se revisó contra el código antes de corregirlo.

## Lo que encontraron y qué se hizo
| Hallazgo | Quién | Gravedad | Qué se hizo |
|---|---|---|---|
| El video que manda el cliente se usaba sin revisarlo: cualquiera que conozca el canal podía poner cualquier video en el TV del bar con un nombre inocente. | Design, Codebase | 🔴 Bloqueante | Solo se usa si la canción trae el código de su mesa **y** el video sale en la búsqueda de esa misma canción, con las revisiones de siempre. Si no, se busca como antes. Prueba `musicaqr` 3. |
| Los estados de la canción salían por el canal del último mensaje, no por el del cliente (puede haber varios canales del QR). | Design, Codebase | Mayor | Cada canción guarda su canal, y viaja al equipo de la música. |
| Varios equipos le contestaban al cliente, y uno que no pone la música contaba el cupo con una copia incompleta de la cola. | Design | Mayor | Solo el equipo de la música decide el cupo y le contesta al cliente. En el celular del cliente los estados solo avanzan. |
| Una canción quitada o que no se pudo poner seguía gastando el cupo **en el celular del cliente**. La prueba lo escondía (borraba el celular). | Zoom Out | Mayor | El celular devuelve el cupo con «quitada» y «no se pudo poner». La prueba ya no borra nada. |
| Cancelar el conteo del cierre gastaba números de factura (huecos en el consecutivo). | Los 3 | Mayor | Los números vuelven, el último primero. Prueba `v1954` M5. |
| Cancelar el conteo del cierre pisaba la cuenta: se perdía lo que entraba mientras tanto (un pedido del QR, algo de otro equipo). | Design, Codebase | Mayor | Se juntan las dos: lo de antes más lo que entró. |
| Bono: si el servidor sí descontaba pero la respuesta se perdía, «Cancelar» no lo devolvía. Sin tiempo límite, la caja podía quedar bloqueada. | Design, Codebase | Mayor | Al cerrar la ventana de cobro, cada bono que se intentó y no quedó en la venta se devuelve (el servidor no hace nada si no se había descontado). Después de 15 s se toma como sin conexión. Las devoluciones sin internet quedan guardadas y se reintentan solas. Prueba `v1954` M3. |
| El total que cambia mientras se cobra solo se revisaba con efectivo y bono. Nequi, tarjeta y QR cobraban el total nuevo. La voz no revisaba después de «quién atendió». | Design, Codebase | Mayor | Con cualquier medio, menos el fiado, no se cobra si cambió el total. También en la voz, después de la comisión. Prueba `v1954` M2. |
| La propina se buscaba por el objeto: si llegaban datos de la nube con la ventana abierta, ya no se encontraba y se quedaba en la cuenta. | Codebase | Mayor | Se busca por una marca. Prueba `v1954` M4. |
| Los domicilios del **agente** se perdían si Ajustes → Domicilios estaba apagado (el agente tiene su propio interruptor). | Codebase | Mayor | Ya no depende de ese interruptor. Queda el tope de 40. |
| Menú del día: si la nube no respondía en 5 s, igual ponía las porciones en 0. | Design | Mayor | Solo las pone en 0 si alcanzó a traer los datos de la nube. Si no, reintenta a los 30 s. |
| Domicilio: durante la espera de la nube, un segundo toque o un cambio en el carrito se podía facturar. | Design, Codebase | Mayor | El botón se bloquea. Si el carrito cambió, no factura y avisa. |
| «Llegó tarde» usaba el reloj del celular del cliente. | Los 3 | Menor | Usa la hora del servidor. Además, el celular ya no manda canciones guardadas más de 20 min (con su propio reloj). |
| Un equipo recién abierto relee las últimas 12 h y contestaba mal a canciones viejas. | Codebase | Menor | Los mensajes de más de 20 min (hora del servidor) no se procesan. |
| La búsqueda que falla se reintentaba sin fin. | Design | Menor | Hasta 10 veces; después, «No se pudo poner». |
| Sin código y a una mesa que no existe: no había respuesta (el cliente esperaba 3 min). | Zoom Out | Menor | Responde «Esa mesa no está en el local». |
| Una reenviada de una canción quitada contestaba «en la cola». | Codebase | Menor | Contesta su estado real. |
| «Deshacer» dejaba la propina en la cuenta, y al volver a cobrar se pedía otra. La habitación quedaba «sucia». | Codebase | Menor | Si la cuenta ya trae propina, no se pregunta otra vez. «Deshacer» devuelve todo como estaba. |
| El tope de 30 pedidos sin código no tenía ventana de tiempo, y los topes no dejaban rastro. | Codebase | Menor | 24 h, y queda anotado en la auditoría. |
| Entre 761 y 1023 px los avisos podían quedar debajo de la barra. | Codebase | Menor | Suben por encima de la barra. Revisado con una captura a 900 px. |
| «Más» tenía dos botones que abren la misma pantalla. El diagnóstico listaba botones que el celular esconde a propósito. | Codebase | Menor | Un solo botón, «Productos e inventario». El diagnóstico ya no los lista. |
| El reporte decía más de lo que hace: Y3 («no se factura dos veces»), P1 («arreglado»), y no decía que sin internet el menú de ayer se sigue vendiendo. | Zoom Out | Menor | El reporte ya lo dice como es. |
| El plan no tenía lo que se deja para después. | Zoom Out, Design | Menor | `POS-COMPLETO.md`, 6c, puntos 0 y 0b. |

## Lo que queda para después (en el plan)
- **«Una sola vez» en el servidor** para los domicilios.
- **Bonos con «apartar y confirmar».**
- **El límite de búsquedas** por código de mesa.
- **El código de mesa (`vm`) a la vista** en el canal.
- **El inventario con «poner»** en vez de «sumar».
- **Contar la caja antes de cerrar las cuentas.**
- **La música:** el televisor emparejado con otro equipo, el cambio de equipo de la música y la canción que se pierde al
  recargar.
- **Los cupos en la voz y en la caja POS.**
- **Y5.**
