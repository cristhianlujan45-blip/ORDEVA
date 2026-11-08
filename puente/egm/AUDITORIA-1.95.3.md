# Auditoría completa de la 1.95.3 (modelo Elephant Goldfish)

**Pedido del dueño:** «vuelve a hacer una auditoría completa y mira qué está fallando».

**Cómo se hizo:**
- **Cuatro revisores sin la conversación (goldfish),** cada uno con un área:
  - la plata y la caja;
  - la sincronización entre equipos;
  - el QR, los canales y la seguridad;
  - el celular y el menú.
- **Además, revisiones propias:**
  - las pruebas de GitHub (al publicar y cada noche);
  - el servidor;
  - la APK;
  - las 11 páginas publicadas, abiertas como celular.
- **Cada hallazgo grave se verificó contra el código o con una prueba** antes de darlo por cierto. Uno no se confirmó: Y1.

## Lo que está bien
- **Pruebas al publicar:** verdes de la 1.95.0 a la 1.95.3, y la lista completa local pasa 121 de 121.
- **Servidor:** las migraciones están aplicadas; la salud de los pagos, la IA, las suscripciones y el calendario está bien.
- **APK de Android:** se construyó bien (1.88).
- **Sitio publicado:** las 11 páginas abren en un celular sin errores, sin archivos que fallen y sin ser más anchas que
  la pantalla.
- **Seguridad:**
  - ninguna clave privada en el repositorio (solo la pública `anon`);
  - todas las tablas con RLS;
  - ningún negocio puede ver los datos de otro;
  - el texto remoto siempre se escapa (sin XSS);
  - ntfy no se usa.

## Lo que fallaba y ya se arregló en esta auditoría
- **La corrida de cada noche estaba roja desde el 5/11:**
  - `adminsub` tenía una fecha fija que se venció; ahora pasa 71 de 71;
  - a la máquina de GitHub le faltaba `pdfinfo` para `facturascan`;
  - `adminreal` y `cuentas` pasan aquí (fallaron por tiempos de la máquina).

## Hallazgos (verificado = revisado contra el código o con una prueba)
| # | Área | Hallazgo | Gravedad | Estado |
|---|---|---|---|---|
| M5 | Caja | Cancelar el conteo del cierre igual cierra las mesas abiertas como «debe», sin dejar cierre. | 🔴 | Arreglado en la 1.95.4 |
| M1 | Caja | «Deshacer» un cobro pierde datos de la cuenta: el consumo mínimo propio, la plataforma, el huésped, la hora de entrada y los viajeros. | 🔴 | Arreglado en la 1.95.4 |
| M2 | Caja | El cobro por voz confirma un total, y después el mínimo o el motel lo cambian: el efectivo y las vueltas quedan mal. | 🔴 | Arreglado en la 1.95.4 |
| M3 | Bonos | Un reintento o un «Cancelar» mientras se redime puede descontar el bono sin que haya venta. | 🔴 | Arreglado en la 1.95.4 |
| M4 | Caja | Si se cancela el cobro, la propina queda en la cuenta y se vuelve a sumar. | 🟠 | Arreglado en la 1.95.4 |
| M6 | Comisiones | La diferencia del consumo mínimo da comisión al mesero. | 🟠 | Arreglado en la 1.95.4 |
| M7 | Agencias | «Agregar» con cantidad se salta los cupos. | 🟠 | Arreglado en la 1.95.4 en «Agregar»; la voz y la caja POS, al plan |
| S1 | Seguridad | Cualquiera que conozca el canal del negocio puede cambiar el **QR de pago y la llave Bre-B** que ven los clientes (canal `c+'f'` sin protección). | 🔴 | Verificado. Necesita un cambio en el servidor con revisión goldfish. |
| S10 | Seguridad | `pagos_estado` les muestra a todos los miembros (también al mesero) el código de Nequi. La regla del dueño es que solo lo vea el administrador. | 🟠 | Por arreglar (servidor) |
| S6 | Seguridad | Cualquier miembro (un mesero) puede crear bonos con valor. | 🟠 | Por arreglar (servidor) |
| S4 | Seguridad | Los mensajes falsos de domicilios o de pedidos sin código se guardan sin tope en los datos del negocio. | 🟠 | Arreglado en la 1.95.4 |
| S2 | Seguridad | Los códigos de las mesas nunca cambian: una foto vieja del QR sigue sirviendo. | 🟠 | Al plan: necesita su propio diseño |
| S3 | Seguridad | El límite por conexión del canal se puede saltar por la ruta del servidor. | 🟠 | Al plan (servidor) |
| S5 | Seguridad | Las reservas públicas se pueden usar para bloquear habitaciones (con el celular que quieran). | 🟠 | Al plan |
| Y1 | Sincronización | «Un pedido del QR se suma en cada equipo». | — | **No se confirmó:** con dos equipos de verdad la mesa queda con 2 y el inventario baja 2. La prueba `dosequiposqr` lo vigila. |
| Y2 | Sincronización | El menú del día pone las porciones en 0 como valor fijo, pero la mezcla trata el inventario como suma: se pueden perder porciones. | 🟠 | Achicado en la 1.95.4; el arreglo completo («poner» en vez de «sumar» en el inventario) va al plan |
| Y3 | Sincronización | Un domicilio se puede facturar dos veces desde dos equipos. | 🟠 | Achicado en la 1.95.4; el arreglo completo necesita el servidor (plan) |
| Y7 | Sincronización | Con más de 8 códigos por mesa entre equipos, los equipos se los quitan entre sí sin parar (de la 1.95.1). | 🟡 | Arreglado en la 1.95.4 |
| P1 | Celular | **La causa más probable de que no salgan Productos, Inventario ni Ajustes:** el celular entra con un usuario de **empleado** (mesero, cajero) y no del dueño. `app/27` esconde justo eso, y también el botón IA. Se puede llegar por «Hacer mesero» sobre el propio usuario (la regla «debe quedar un administrador» solo cuenta los de ese equipo) o al entrar con el PIN de un empleado. | 🔴 para el dueño | 1.95.4: ya no se puede quitar uno mismo el administrador; falta confirmarlo en su celular |
| P2 | Celular | `hidden` no esconde los botones del menú (`nav button{display:flex}`): el mesero sin permiso igual ve «Caja POS». | 🟠 | Arreglado en la 1.95.4 |
| P3 | Celular | Entre 761 y 1023 px (celular acostado, plegables) el menú de abajo no queda fijo. | 🟠 | Arreglado en la 1.95.4 |
| P4 | Celular | «Más» no tiene la tarjeta de Productos/Inventario. | 🟡 | Arreglado en la 1.95.4 |
| P5 | Celular | El diagnóstico de «Reportar un problema» no manda el rol, el ancho ni la escala, que es lo que haría falta para confirmar P1 desde lejos. | 🟡 | Arreglado en la 1.95.4 |
| Y5 | Sincronización | Lo que se está escribiendo (viajeros) se pierde si llegan datos de otro equipo. | 🟡 | Al plan (POS-COMPLETO 6c, 0b) |

## Orden de los arreglos
**Estado al 08/11:** la 1.95.4 hizo el punto 1 (`puente/REPORTE-1.95.4.md`, revisión goldfish en
`puente/egm/REVISION-GOLDFISH-1.95.4.md`). Sigue la 1.96 (servidor).

1. **1.95.4, en la app,** con pruebas:
   - M5, M1, M2, M4 y M6;
   - M3 (bonos), M7 y S4;
   - Y2, Y3 y Y7.
2. **1.96, en el servidor,** con revisión goldfish antes de publicar:
   - S1: el QR de pago y los canales del negocio solo los escribe el negocio;
   - S10: Nequi solo para el administrador;
   - S6: bonos solo dueño, administrador o cajero.
3. **Al plan (`POS-COMPLETO.md`),** cada uno con su propio diseño:
   - S2: códigos de mesa por cuenta abierta;
   - S3: límites del canal por conexión en el servidor;
   - S5: reservas públicas pendientes o con código.
