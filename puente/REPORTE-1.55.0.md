# Vento 1.55.0 · Lo del Nequi solo para el jefe, el equipo no cambia precios, recetas con insumos y 🎓 practicar una venta

Esta versión trae seis cosas:
- **D5:** los datos de quien paga solo los ven el dueño y el administrador.
- **D2:** el equipo no reescribe precios, costos ni permisos.
- **🧾 Recetas e insumos.**
- **🎓 Practicar una venta** en la guía para mayores.
- **D10:** restaurar un respaldo de forma limpia y probada.
- **🔒 Cerrar caja:** el botón a la vista, una pregunta antes de cerrar y, si el dueño quiere, una clave (pedido del dueño).

## 1. Lo del Nequi solo para el dueño y el administrador (D5)
Regla del dueño: «solamente el administrador puede ver lo del Nequi».

- **Antes:**
  - La app escondía a meseros, cajeros y empleados el nombre de quien pagó y el texto del banco, pero el servidor
    se los entregaba igual.
  - Esos datos también iban en los datos del negocio que se copian a todos los celulares (`data.pagos.lista`: «de»,
    «txt», «fuente»).
- **Ahora, en el servidor** (`supabase/migrations/20261105000000_pagos_privados.sql`):
  - A quien no es dueño ni administrador, el servidor le da el pago **sin pagador, teléfono, documento ni texto del
    banco**.
    - Sí le da el valor, la mesa y el estado: «✅ Mesa 3 ya pagó» y la voz siguen igual.
    - Quien creó un cobro lo ve completo, porque es su cobro.
  - La tabla `pagos` ya no se lee directo si no es dueño, administrador o quien creó el cobro.
  - En cada guardado, «de», «txt» y «fuente» salen de los avisos y quedan aparte, en `pago_avisos_detalle`.
    - Solo los leen el dueño y el administrador.
    - Nada se pierde: lo que ya había se migró igual.
  - `vento-pagos` (servidor 1.23.0): `/estado` también entrega el pago recortado a quien no es jefe.
- **Ahora, en la app** (`index.html`, `nube/vento-pagos.js`, `lib/vento-confirma.js`):
  - **El dueño y el administrador** ven todo como antes. El nombre sale del celular, del servidor o del detalle
    guardado aparte.
  - **Los demás** ven «Llegó un pago de $…», sin el nombre.
  - **La nota del pago en la mesa** ya no lleva el nombre de quien pagó.
  - **Juntar avisos repetidos:** cada aviso lleva una huella del texto, así se siguen juntando sin duplicarse.
  - **Celulares que no son de dueño ni administrador:** revisan los pagos cada 6 s.

## 2. El equipo no reescribe precios ni permisos desde su celular (D2)
`supabase/migrations/20261106000000_equipo_no_reescribe.sql`

El servidor aplica los mismos permisos que el dueño da en «👥 Permisos del equipo». Los compara con lo que ya estaba
en el servidor, no con lo que manda el celular.

- **Precio y nombre:** solo se cambian con el permiso «productos».
- **Costo:** con «productos» o con «inventario».
- **Si no tiene permiso,** el servidor deja los valores de antes. Los productos borrados sin permiso vuelven.
- **Stock y productos nuevos:** como siempre.
- **Permisos del equipo y clave de autorización:** solo el dueño o el administrador.
- **Ventas que borra el equipo** (con la clave del dueño): no se bloquean, pero cada una queda **completa en la
  auditoría** (`venta_borrada_equipo`). No se pierde historia.
- **Si algo falla aquí,** el guardado sigue igual que antes, sin bloquear la venta.
- **Rapidez:** un guardado del mesero en un negocio con 8.000 ventas tarda unos 55 ms en el servidor.

## 3. 🧾 Recetas e insumos (`lib/vento-recetas.js`)
- **Insumos** (Inventario → «🧂 Insumos»): harina, queso, carne, leche, café…
  - Cada uno con su unidad (kg, g, l, ml o und), cuánto hay, cuándo avisar y lo que cuesta cada unidad.
  - Se puede agregar, ajustar y sumar con «➕ Llegó».
  - No se borra un insumo que esté en una receta.
  - No salen en la carta, las mesas, la caja, el QR ni la app de meseros.
- **Receta de un producto:** en «Editar producto» → «🧾 Receta».
  - Al vender se descuenta sola de cada insumo (o producto, por ejemplo la botella de un cóctel).
  - Al quitar de la cuenta, vuelve.
  - Si el producto no tenía costo, el costo sale de la receta.
- **«🚫 No vender si faltan ingredientes»:** lo prende el dueño.
  - En las mesas no deja agregar el plato y dice qué falta. Eso vale para toques, favoritos, voz, escáner, QR y
    meseros.
  - En la venta rápida de caja solo avisa, para no dañar el cobro.
- No cambia nada para quien no use recetas.

## 4. 🎓 Practicar una venta (guía para mayores, `lib/vento-guia.js`)
- **Dónde está:** en «Más» del modo fácil y en «🙋 Ayúdame» («quiero practicar una venta»).
- **Cómo es:** un ensayo completo con los productos del negocio y la voz.
  - Pasos: mesa → productos → Cobrar → cómo pagan → billete → cuánto devolver, o el aviso de Nequi tal como llega
    de verdad.
  - Cada error da una pista amable.
  - Al final dice cuántas veces ha practicado.
- **No se guarda nada:** ni ventas, ni mesas, ni inventario, ni impresora, ni cajón, ni DIAN.
- **Arreglo de paso:** el recorrido automático de la primera vez ya no cierra una guía que la persona abrió.

## 5. Restaurar un respaldo, limpio y probado (D10)
`supabase/migrations/20261107000000_restaurar_respaldo_limpio.sql`

- **Pasa por la misma limpieza que un guardado.** Un respaldo de antes de la 1.53 o de esta versión no vuelve a meter
  en los datos compartidos:
  - la clave de IA, que queda en el servidor;
  - el nombre de quien pagó, que queda aparte.
  - Además, anota los canales de pedidos del respaldo.
- **Auditoría:** queda quién restauró (`respaldo_restaurado`).
- **Sigue igual:**
  - solo el dueño o el administrador restauran (con el arreglo de permisos de la 1.54.0);
  - el estado de antes queda como respaldo, así que se puede deshacer.

## 6. 🔒 Cerrar caja: a la vista y con pregunta antes de cerrar
Pedido del dueño: «mueve el botón de cerrar caja a una zona más visible y un mensaje de confirmación».

- **Dónde está:**
  - **Arriba en «Mesas»**, la pantalla que se usa todo el día: grande, debajo del resumen (libres, abiertas, por
    cobrar).
  - **En «Historial»** sigue el de siempre.
  - **En el modo fácil**, en «Hoy».
- **Antes de cerrar pregunta** «¿Cerrar la caja del día?» y muestra:
  - las ventas desde el último cierre (cuántas, el total y el efectivo);
  - las mesas abiertas, que se cierran (lo que no esté pagado queda como «Debe»);
  - que después se cuenta el efectivo (el arqueo de siempre, o «Cerrar sin contar»).
- **Botones:** «🔒 Sí, cerrar caja» y «No, todavía no». «No» no toca nada.
- **Si no hay nada que cerrar,** avisa «La caja ya está al día» sin preguntar.
- **El cierre automático programado** no pregunta, igual que antes.
- **Quien no tiene permiso de ver el historial** no ve el botón, igual que antes.
- **🔑 Clave para cerrar la caja (opcional).** Pedido del dueño: «la opción de ponerle clave para cerrar la caja,
  una clave diferente o la misma del usuario».
  - Se elige en Ajustes → Negocio → «🔒 Clave para cerrar la caja». Solo la ven el dueño y el administrador.
  - **Opciones:**
    - sin clave (como siempre);
    - **la contraseña de quien está usando Vento**, la misma con la que entra en ese celular;
    - **una clave solo para cerrar la caja**.
  - **Cuándo se pide:** después de la pregunta, a todos, también al dueño.
  - **Lo que no la pide:** el cierre automático programado.
  - **5 claves malas** → espera 5 minutos.
  - **Cómo se guarda:** solo la huella de la clave (PBKDF2, igual que la clave de autorización), dentro de los
    permisos del equipo. Así el servidor (D2) no deja que el equipo la cambie ni la quite.
  - **Queda en la actividad del equipo:** cada clave mala y cada cambio.
- **Prueba nueva, `cerrarcaja`:** 26 comprobaciones.
  - Incluye la clave propia (solo la huella), la clave mala, «Cancelar», la contraseña del usuario, que el cierre
    automático no la pide y «Sin clave».
  - **Actualizada:** `mejoras` (acepta la pregunta antes del arqueo).
  - **Pasan:** `facil`, `cajapos`, `cajaqr`, `guia`, `practica` y `equipoactividad`.

## Pruebas
- **Nuevas pruebas del servidor**, contra PostgreSQL real:
  - `pagosprivados`: 25.
  - `equiponoreescribe`: 20.
  - `respaldos`: 15. Restaurar, deshacer, permisos, auditoría, que las tablas de reportes queden iguales y que se
    guarden solo los últimos 48.
- **Nuevas pruebas de la app:**
  - `pagosprivados`: 12.
  - `recetas`: 21.
  - `practica`: 25.
- **Actualizadas:** `daviplata` (servidor 1.23.0 y el pago recortado) y `facil`.
- **Servidor:** las 16 pruebas pasan, incluidas `respaldos`, `permisos` (1.54.0) y `proyeccion` (66, con el cambio
  de precio hecho por el dueño).
  - `revisar-migraciones` también pasa: 32 migraciones, sin borrar datos y con RLS en todas las tablas.
- **App:** de las 86 pruebas, 83 pasan en la corrida completa. Las otras se revisaron una por una:
  - **`appoweb`:** pasa sola (25 de 25). Falló por la carga de este computador, con dos corridas a la vez.
  - **`dian`:** pasa sola (29 de 29).
  - **`cuentas`:** falla a veces, en el paso de cambiar de cuenta en el mismo celular. Falla igual con la 1.53.2
    publicada, y pasó completa dos veces seguidas (43 de 43) con esta versión.
