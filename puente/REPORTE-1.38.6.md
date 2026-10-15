# Vento 1.38.6 — Suena siempre (pantalla bloqueada o Vento cerrada), Bre-B de otros bancos, Nequi y menús que ya no saltan arriba

## 1. Que suene con la pantalla bloqueada o Vento cerrada
- **Qué pasaba:** con la pantalla bloqueada, Android congelaba la app apenas leía el aviso del banco, antes de que la
  voz alcanzara a hablar. Y con Vento cerrada (quitada de recientes), algunas marcas, como Xiaomi, apagaban el servicio
  de fondo.
- **Ahora:**
  - **El procesador se mantiene despierto** mientras se prepara y se dice «Pago confirmado» (máximo 45 s).
  - **Hay un canal propio «💜 Pagos que te llegan»**, de prioridad alta, visible en la pantalla de bloqueo y con
    vibración. Si la voz no alcanza a sonar, el aviso del celular suena igual.
  - **Al llegar un pago, si el servicio de fondo se había cerrado, se vuelve a prender**, y también cuando Android
    reconecta a Vento.
  - **Paso 5 del paso a paso, «Que suene siempre»:**
    - botón **«⚡ Quitar el ahorro de batería»**;
    - botón **«🚀 Permitir Inicio automático»**, que abre la pantalla de Xiaomi, OPPO, vivo, Huawei, Honor…;
    - los pasos de la marca del celular (Xiaomi / Redmi / POCO, Samsung, OPPO, vivo, Huawei, Motorola);
    - «🔒 Bloquear» Vento en recientes.

## 2. Transferencias de otros bancos por la llave Bre-B
- **Ahora se entienden:** «Llegaron $50.000 a tu llave», «Recibiste $X por Bre-B», «Recibió $X a través de Bre-B»,
  «Transferencia Bre-B recibida», «Te mandó», «Te giró», «Se acreditaron $X en tu cuenta» y «Ingresó dinero».
- Funcionan igual en la app Android, la página y el servidor.

## 3. Nequi no sonaba
- **Un «¿» en el aviso** («¡Te llegó plata! … te envió $20.000. ¿La guardas en un bolsillo?») hacía que se tomara por
  publicidad. Ahora, si el aviso trae una frase de pago de verdad («te envió $X», «recibiste $X», «a tu llave»), cuenta
  como pago. La publicidad sigue sin contar.
- **Avisos sin el valor** («¡Te llegó plata! Entra a Nequi»): ahora suena **«Llegó plata por Nequi. Mira el valor en la
  aplicación.»**, con su aviso en el celular.
- **Nunca cuentan como pago:** las **solicitudes** («JUAN te pidió $20.000», «Recibiste una solicitud»), los cobros y
  las transferencias rechazadas, fallidas, reversadas o programadas.

## 4. Los menús ya no se suben solos al bajar
- **El paso a paso de DaviPlata/Nequi** se rehacía cada 3 s (para revisar el permiso, la batería…) y mandaba al
  principio mientras uno bajaba. Ahora solo se rehace si algo cambió, y se queda donde ibas.
- **Panel de YouTube «🎵 En cola»:** cada canción que llegaba (o que ponía el equipo de la música) y cada 🗑 / ⏭
  mandaban la lista arriba. Ahora se queda donde ibas. Cambiar de pestaña sí empieza arriba, a propósito.
- **Para todos los menús:** cualquier parte de Vento que se refresca sola (pagos, cocina, música, avisos…) guarda dónde
  iba la lista y la deja ahí mismo. Lo que manda arriba a propósito (cambiar de pestaña o de paso) sigue igual.
- **Prueba nueva `desplazamiento`** (10 comprobaciones): con el código anterior falla en 5 de ellas (la lista volvía a
  0) y con el arreglo pasan todas.

## Pruebas
- **Java `AvisoPagoPrueba`:** 85 comprobaciones (Bre-B, Nequi con «¿», solicitudes y avisos sin valor).
- **`servidor/avisos`:** 23 comprobaciones.
- **`pagosaviso`:** 41 comprobaciones (Bre-B, Nequi, solicitudes y el paso 5 con los botones).
- **Siguen pasando:** `avisosandroid`, `pagosguia`, `appoweb` y `daviplatacobro`.
- **El código de Android compila** contra Android 14.
