# Revisión Goldfish de la 1.95.2 (pedidos del QR en tiendas)

**Por qué:** el dueño pidió revisar que se esté trabajando con el modelo Elephant Goldfish. Desde la 1.88 los cambios se
hacían directo desde el chat, sin plan ni revisión. La 1.95.2 todavía no estaba publicada, así que se revisó antes de
publicarla.

**Cómo:** tres revisores del plugin EGM sin la conversación leyeron el reporte y el código:
- **Codebase Details:** exactitud técnica.
- **Design:** arquitectura.
- **Zoom Out:** alcance, y qué se desvió del plan.

## Lo que encontraron y qué se hizo
| # | Hallazgo | Quién | Gravedad | Qué se hizo |
|---|---|---|---|---|
| 1 | Cancelar un pedido ya aceptado (estado `listo`) dejaba sus productos cobrados en la cuenta (`app/09`, `pedidoCambiar`). | Los 3 | 🔴 Bloqueante | Corregido: sin cocina, cancelar desde `listo` descuenta. Prueba 6a. |
| 2 | La frontera estaba mal en las dos direcciones: <br>• metía hoteles, moteles, billares y tejo en «esperar a aceptar»; <br>• dejaba atascados los bares y restaurantes sin pantalla de cocina. | Design, Zoom Out, Codebase | Mayor | Ahora el camino «sin cocina» depende solo de la pantalla de cocina, y esperar a aceptar es solo para la familia «tienda». Prueba 6g. |
| 3 | Los celulares con una versión anterior seguían aceptando solos. | Design | Mayor | En las tiendas queda escrito `data.pedidosAuto = false`. Prueba 6f. |
| 4 | Un equipo que se entera del pedido por la nube no sonaba. | Design, Codebase | Mayor | Ahora suenan todos los equipos (`window.__ptSonado` evita que suene dos veces). Prueba 6d. |
| 5 | Dos avisos pequeños («sin código», «no está en tus productos») tapaban los botones. | Codebase | Debe arreglarse | Esos avisos van dentro del aviso grande. Prueba 6e. |
| 6 | El aviso quedaba escondido detrás de la Caja POS y de las cuentas abiertas. | Design, Codebase | Mayor | Con una ventana abierta sale arriba una pastilla («🛒 N por aceptar · Ver») y el panel se abre encima de la Caja. Prueba 6b. |
| 7 | Los pedidos «por entregar» se iban a amontonar. | Design | Mayor | Al cobrar la cuenta quedan «Entregado» solos, y solo se cuentan los de las últimas 24 h. Prueba 6c. |
| 8 | «Después» los escondía para siempre. | Design | Después | Vuelve a avisar a los 3 minutos. |
| 9 | Laya y el texto de Ajustes usaban las palabras de restaurante. | Design, Codebase | Menor | Corregido. |
| 10 | La prueba no cancelaba un pedido aceptado ni recorría el camino del restaurante. | Codebase | Hueco | Se agregaron 10 revisiones: `pedidostienda` pasó de 19 a 29. |

## Lo que queda para después (anotado en el plan, sección 6c)
- **Un ajuste guardado** del camino de los pedidos (`data.pedidosFlujo`), en vez de deducirlo cada vez.
- **Un solo lugar** con la lista de estados «activos» y sus nombres, que hoy está en 6 sitios.
- **Revisar cómo se mezclan** dos copias del mismo pedido aceptadas a la vez en dos equipos: no se verificó.
- **Menos lugares para aceptar:** hoy son el aviso, el panel y la campana. No se debe agregar más.
