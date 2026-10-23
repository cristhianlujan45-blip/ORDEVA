# Vento 1.54.0 · Con el QR de una mesa ya no se pueden leer los pedidos del negocio

Es la parte **D8** de la Fase 3 · Seguridad.

## El problema (verificado en el código)
- El QR de cada mesa lleva el nombre del **canal de pedidos** del negocio. Ese nombre era la única llave.
- Con ese nombre, cualquiera con el QR (o con una foto del QR) podía **leer 8 días de pedidos de todo el negocio**:
  - domicilios con **nombre, teléfono y dirección**;
  - avisos de pago de los clientes y las canciones pedidas.
- El cliente nunca necesitó leer ese canal: solo **escribe** ahí. Lo que él lee son otros canales: el estado de su
  pedido, la carta, las fotos, el ambiente y la cuenta de su mesa.

## El arreglo
- **El servidor sabe de qué negocio es cada canal de pedidos.**
  - Los toma de los datos del negocio (`qrCanales` y `qrFijo`) y los anota solo al guardar.
  - El primero que lo anota se queda con él. Si otro negocio pone ese canal en sus datos, no se lo apropia ni puede
    leerlo.
- **Leer un canal de pedidos exige la sesión de un miembro de ese negocio.**
  - La app del local ya la tiene: ahora lee con ella (`lib/vento-canal.js`).
  - Si la sesión falla, lee como antes.
- **Lo que no cambia:**
  - **El cliente del QR:** sigue pidiendo comida y canciones y mandando avisos de pago. Recibe el estado de su pedido,
    la carta y su cuenta.
  - **Meseros, preparación y TV:** leen sus propios canales, que no cambian.
  - **El puente de WhatsApp y MacroDroid:** siguen igual.
- **7 días de gracia desde esta versión.**
  - Mientras tanto se lee como antes, para que ningún celular del local con la versión anterior (que lee sin sesión)
    se quede sin recibir pedidos.
  - Los canales que se creen después de esa fecha quedan cerrados de una vez.
  - **Importante:** antes de 7 días, actualicen Vento en todos los celulares del local con el aviso verde «Hay una
    versión nueva de Vento → Actualizar ahora».
- **Negocios sin cuenta de Vento** (solo en un equipo): sus datos no están en el servidor y su canal sigue como antes.

Archivos:
- `supabase/migrations/20261104000000_canal_pedidos_privado.sql`: tabla `canal_privado`, `canal_leer` revisa el
  negocio, y `guardar_datos` anota los canales (y sigue quitando la clave de IA);
- `lib/vento-canal.js`.

## Pruebas
- **Nueva, `servidor/canalprivado`:** 17 comprobaciones contra PostgreSQL real.
  - Los canales se anotan al guardar.
  - Durante la gracia se lee como antes.
  - Cerrado: con la clave pública no se leen pedidos, domicilios ni canciones; el cliente sí recibe su estado y la
    carta.
  - Dueño y mesero del negocio sí leen; el dueño de otro negocio no.
  - Nadie se apropia de un canal ajeno.
  - Un canal nuevo después de la gracia queda cerrado.
  - Los canales que no son de pedidos se leen como siempre.
  - La migración se puede correr otra vez.
- **Nueva, `qrprivado`:** 9 comprobaciones en la app con el navegador y el canal ya cerrado.
  - El cliente recibe la carta, pide, y el estado le vuelve.
  - La app del local recibe el pedido y la canción.
  - Con el QR no se lee nada, ni el domicilio.
- **`canalvivo`** (17 comprobaciones), con todo el recorrido del QR, meseros, preparación, TV, MacroDroid y WhatsApp:
  pasa.
- **Todas las pruebas del servidor pasan:** `admin` 142, `avisos` 27, `bloqueos` 18, `daviplata` 101, `dian` 69,
  `errores` 30, `iaclave` 34, `proyeccion` 66, `repasos` 20 y `suscripciones` 154.
- `revisar-migraciones`: no borra datos y las 29 migraciones se aplican con RLS en todas las tablas.
