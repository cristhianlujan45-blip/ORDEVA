# ORDEVA 1.95.2 · 🛍️ Pedidos del QR en las tiendas: aceptar, rechazar y entregar, sin cocina

**Pedido del dueño:** «cuando me llega un pedido de una persona que me hizo un pedido por QR, se queda pedido en la cocina.
Rectifica eso porque estamos en una tienda. Y no me deja aceptar o declinar el pedido. Corrige todo para que quede muy
cómodo».

## Qué pasaba
Los pedidos del QR seguían el camino de un restaurante:
- **Entraban solos a la cuenta** y quedaban «Recibido / En preparación», esperando que alguien los pasara a «Listo» en la
  pantalla de cocina.
- **Una tienda no tiene esa pantalla:** los pedidos quedaban «en la cocina» para siempre, en la campana y en el Inicio.
- **«Aceptar / Rechazar» no aparecía nunca**, porque solo sale cuando el pedido espera que lo acepten, y en la tienda
  entraba solo.

## Qué cambió
En los negocios sin pantalla de cocina que no son de comida ni bar (tiendas, minimercados, droguerías, ferreterías…):

- **El pedido no entra solo a la cuenta:** espera «🆕 Por aceptar».
- **Aviso grande abajo:** «🛒 Pedido nuevo · Cuenta 2», con lo que pidió, el precio de cada cosa, el total y la nota. Trae
  dos botones grandes:
  - **✅ Aceptar:** el pedido entra a la cuenta y queda «Aceptado: lo estamos alistando»;
  - **❌ Rechazar:** pregunta antes, y no entra nada a la cuenta.
  - **Si el pedido no trae el código del QR,** el aviso lo dice para que se confirme con el cliente.
- **«Después»** esconde el aviso hasta que llegue otro pedido.
- **Al llegar un pedido suena y lo dice en voz.** El mensaje pequeño y el micrófono ya no tapan los botones.
- **Panel «🛍️ Pedidos»:** se abre desde el aviso, la campana o el Inicio. Tiene tres partes:
  - **por aceptar;**
  - **aceptados, por entregar,** con «📦 Entregado», «Ver la cuenta» y «Cancelar»;
  - **los de hoy.**
- **La campana** dice «Por aceptar» con «✅ Aceptar» (antes decía «Enviar pedido») y «📦 Entregado» en los aceptados.
- **El Inicio** dice «N pedidos por aceptar» y «N aceptados por entregar», en vez de «en preparación».
- **El cliente ve en su celular cada paso:** «Esperando que lo acepten», «Aceptado: lo estamos alistando», «Entregado» o
  «Rechazado».
- **Restaurantes, bares y negocios con pantalla de cocina siguen igual.** Si el dueño de la tienda prende el interruptor de
  Ajustes para que los pedidos entren solos, eso manda: entran a la cuenta como «Aceptado».

## Cómo está hecho
- `app/09-cuentas-mesa-modulo.js`:
  - `pedidosSimple()` decide qué negocios siguen el camino de tienda;
  - `pedidosAuto()` deja de aceptar solo en esos negocios, salvo que el dueño lo haya cambiado;
  - en esos negocios, aceptar es `listo`;
  - el cliente recibe el nombre y el ícono de cada paso.
- `lib/vento-pedidos-tienda.js`: el aviso de abajo y el panel «🛍️ Pedidos».
- `app/06-campana-notificaciones-pedidos.js`: las palabras y los botones de la campana; no repite el aviso.
- `lib/ordeva2.js`: las alertas del Inicio.
- `pedido.html`: muestra el ícono que manda la tienda.
- **Sin cambios en el servidor.**

## Revisión goldfish (EGM) antes de publicar
Tres revisores sin la conversación (Codebase Details, Design y Zoom Out) revisaron este cambio. Detalle:
`puente/egm/REVISION-GOLDFISH-1.95.2.md`.
- **El error grave:** cancelar un pedido ya aceptado dejaba sus productos cobrados en la cuenta. Ya está corregido.
- **También se corrigió:**
  - **El camino sin cocina** depende solo de la pantalla de cocina. Esperar a aceptar es solo para tiendas: hoteles,
    moteles, billares y bares siguen entrando solos, pero ya no quedan «en preparación» para siempre.
  - **Los celulares con versión anterior** tampoco aceptan solos.
  - **Suena en todos los equipos.**
  - **Con la Caja abierta** sale una pastilla arriba.
  - **Los avisos pequeños** ya no tapan los botones.
  - **Al cobrar la cuenta,** los pedidos quedan «Entregado» solos.
  - **«Después»** vuelve a avisar a los 3 minutos.
  - **Laya y Ajustes** usan las palabras de la tienda.

## Pruebas
- **Nueva:** `pedidostienda` (29; eran 19 antes de la revisión goldfish), contra el servidor de pruebas, con la app y `pedido.html` de verdad (el cliente pide
  escribiendo, como en el celular). Cubre aceptar, entregar, rechazar, «Después», el panel, la campana y lo que ve el
  cliente en cada paso. También revisa que el restaurante siga igual.
- RESULTADOS_AQUI
- **No se probó en una tienda de verdad.**
