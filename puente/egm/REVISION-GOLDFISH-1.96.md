# Revisión Goldfish de la 1.96 (canales del negocio, Nequi, bonos y búsquedas)

**Por qué:** la 1.96 cambia el servidor y la seguridad de los pagos. La regla del plan es revisión goldfish del plan **y** del
cambio antes de publicar.

## Ronda 1 · El plan (Design + Implementation Readiness)
| Hallazgo | Gravedad | Qué se hizo |
|---|---|---|
| «El primero que registra se queda con el canal»: un atacante registraba `X` o `Xf` y se volvía dueño de escribir el QR de pago, o se lo escondía a los clientes. | 🔴 Bloqueante | Manda el canal de pedidos registrado; no se registra el derivado de otro. |
| La fecha de la gracia era ambigua: copiar `cerrar_desde` la cerraba de una (caída en producción). | 🔴 Bloqueante | Una fecha propia (`canal_escribir_desde`, 72 h). Sin fila o con una fecha mala, no cierra. |
| La ruta abierta `/vento-pagos/canal/…` publica con `service_role`. | Mayor | Sin excepción: cuenta como desconocido. Probado. |
| Los mensajes falsos sobrevivían a la gracia. | Mayor | Mensajes firmados; después del cierre solo se entregan los firmados. |
| Sin sesión, los estados se perdían en silencio. | Mayor | Espera la sesión en los canales del negocio, error claro (42501), reintentos y aviso. |
| Bonos: `bono_lista` y `bono_devolver` abiertos a todos. | Mayor | Por rol, y la devolución también para quien hizo la redención. |
| El nombre de la migración, cómo actualizar la app y cómo hacer exacto S10. | Mayor | En el plan y en el código. |

## Ronda 2 · El cambio (Codebase Details + Design)
| Hallazgo | Gravedad | Qué se hizo |
|---|---|---|
| **Registro «al revés»:** un atacante registraba el nombre del canal de pedidos de otro sin la última letra (pasa en el 11 % de los canales) y le cortaba los pedidos. | 🔴 Bloqueante | El canal de pedidos registrado primero manda (`canal_dueno_derivado`). No se registra en ninguna dirección contra otro negocio. Prueba con un registro que ya estaba de antes. |
| **La versión no se había subido:** los celulares seguían publicando sin sesión y a las 72 h perdían la carta y el QR. | 🔴 Bloqueante | Sube a 1.96.0 en el mismo envío que la migración. |
| Registros viejos del derivado (de antes de la 1.96): los clientes no podían leer la carta ni el QR. | Mayor | `canal_leer` siempre deja leer los canales del negocio. Probado. |
| La mitad de B1-b (registros sobre canales con mensajes de otro) no existía. | Mayor | `canal_registros_sospechosos()`. Rechazarlos de una va al plan (falta la prueba de que el canal es suyo). |
| Con la sesión vencida se publicaba sin firmar, y se perdía en el cierre; el QR quedaba «hecho» sin firmar; carta, fotos y ambiente no se volvían a publicar; el cliente guardaba el QR viejo. | Mayor | Sin publicar sin firma en los canales del negocio; `canal_publicar` devuelve `firmado`; el QR cuenta como hecho solo si salió firmado; las fotos y la carta se vuelven a publicar; el QR viejo se olvida a las 12 h. |
| Una devolución de bono sin permiso se reintentaba 30 días con «sin conexión». | Mayor | `sin_permiso` aparte: no se reintenta y dice a quién pedirlo. Prueba: el cajero devuelve la de otro. |
| Los códigos de los bonos seguían en los datos que ve todo el equipo (caja, auditoría, pagos). | Mayor | Tapados: `•••ABC`. |
| Cualquier miembro (un mesero) podía publicar un QR de pago firmado. | Menor | Solo dueño o administrador. Probado. |
| La espera de 15 s era para todos los canales. | Menor | Solo los del negocio (`e`, `k`, `f`, `a`). |
| Leer podía recorrer muchos mensajes sin firmar. | Menor | Un índice de los firmados. |
| Una fecha mala rompía todo. | Menor | Si la fecha es mala, no se cierra. |
| No había forma de contar los mensajes sin firmar. | Menor | `canal_sin_firmar_resumen()`. |
| YouTube: el caché gastaba del límite y los vacíos se guardaban en el celular. | Menor | El caché no gasta del límite y los vacíos no se guardan. |
| El aviso decía «cierra sesión» también cuando no era eso. | Menor | Dice las dos causas y qué hacer. |
| Faltaban pruebas: registro «al revés», registros viejos, la configuración de pagos con todos los roles, la devolución del cajero. | Menor | Agregadas: `canalescritura` pasó de 36 a 49. |

## Al plan (`REPORTE-1.96.0.md`, «Lo que queda»)
- Los canales `pt…` y `v`.
- Una prueba de que el canal es suyo para los negocios sin nube.
- Una cola guardada para los estados.
- La firma con el negocio.
- El PIN en el botón de bonos.
- La devolución de un bono atada a deshacer la venta.
