# ORDEVA 1.99.2 · Anuladas protegidas en el servidor + segundo lote de la auditoría de diseño

**Pedido del dueño:** «Protege en el servidor el registro de ventas anuladas … hazlo; el segundo déjalo así, y sigue la
auditoría del diseño». (El segundo era dejar que el dueño de cada negocio anule un día completo: queda como está, solo el
proveedor de ORDEVA.)

## 1 · El registro de anuladas, protegido en el servidor
- **Qué cambia:** alguien del equipo (mesero, cajero, empleado…) puede **agregar** anulaciones, pero **no quitar ni cambiar**
  las que ya están en «Facturas → Anuladas», aunque sepa manipular la app. Si lo intenta, el servidor deja la lista como
  estaba y lo anota en la auditoría («anuladas_revertidas»).
- Lo único que se puede anotar en una anulada ya guardada es la respuesta de la DIAN (la nota crédito llega después).
- **El dueño y el administrador** siguen pudiendo todo, como antes.
- **Cómo:** `supabase/migrations/20261205000000_anuladas_protegidas.sql` vuelve a crear `datos_proteger_equipo` con un
  bloque más al final. Lo demás de la función queda igual. No borra ni cambia datos.
- **Revisión goldfish:** la primera versión tenía **un bloqueante**: un dato armado a propósito (`venta: []`) hacía
  fallar la función y el guardado pasaba sin NINGUNA protección (ni permisos ni precios). También era lenta (con 10.000
  anuladas se acercaba al límite de 8 s). Se reescribió: solo revisa si la lista cambió, cruza por id, y si algo falla deja
  la lista vieja (y lo anota). Segunda revisión: sin bloqueantes ni mayores. Menores que quedan: ids repetidos en una lista
  vieja o anuladas sin id (los clientes reales siempre ponen id).
- **Pruebas del servidor:** `equiponoreescribe` 42 bien, 0 mal (10.000 anuladas: unos 240 ms). Las 32 pruebas del
  servidor, bien.

## 2 · Diseño (auditoría `puente/egm/AUDITORIA-1.98-DISENO.md`, segundo lote)
- **Hallazgo 1 · La pantalla de entrar** ya usa los colores de ORDEVA 2.0 (fondo claro, tarjeta blanca, botón negro), los
  mismos de adentro. Antes tomaba la paleta violeta oscura y parecía otro producto.
- **Hallazgo 10 · «Más»:** tiene una ✕ para cerrar, y en la vista sencilla va por grupos: **Cada día** (Inicio, Facturas,
  Libreta, Pagos, Productos), **Mi negocio** (Contabilidad, Estadísticas, Menú, Pantalla de pedidos), **Extras** (Música,
  Play, Bonos, Asistencia), Ayudantes y Mi cuenta. «Historial» ahora se llama **«Facturas»** en ese menú.
- **Hallazgo 18 · Inicio en el celular:** primero cómo va el negocio (ventas, caja, por cobrar, gastos) y después el
  bloque negro de atajos. Antes los atajos mandaban las ventas fuera de la pantalla.
- **Hallazgo 14 · Caja en el celular:** con la venta vacía, el carrito ya no tapa los productos: los 3 pasos en una línea y
  las herramientas (Cotizaciones, Devolución, Recibos…) en una fila que se desliza de lado. Con productos, igual que antes.
- **Hallazgo 15 · Contraste:** el verde de «pagado» y el naranja de «Enviar a Pantalla» son más oscuros, para que se lean
  sobre blanco.
- **Prueba nueva:** `pruebas/diseno199.test.js`, 10 bien, 0 mal (entra a la lista de GitHub).

## Lo que sigue de la auditoría de diseño
- 12 · Encabezado (nombre cortado, «cerrar sesión» al lado de la campana).
- 5 · Partir Ajustes › Negocio (11 pantallas) en sub-páginas.
- 7 y 8 · Un solo sistema de botones y una sola tarjeta de «cómo va el negocio».
- 17 · Página del cliente (QR) y Play con el mismo estilo.
- 19 y 20 · Formularios con etiquetas, ventanas propias en vez de las del navegador, Libreta y tipos de negocio.

## Pruebas
- **Lista completa:** 140 pruebas, 3179 bien y 3 mal. Las 3 eran de las pruebas, no de la app: `vistasencilla` (2, esperaba los grupos viejos de «Más»; actualizada) y `cerrarcaja` (1, buscaba «4321» como subcadena en todo el JSON y una fecha o id al azar lo contenía; ahora busca el valor exacto). Ambas pasan solas después del arreglo (45/0 y 26/0, cerrarcaja dos veces 26/0 antes del arreglo).
- **No se probó** en un celular de verdad ni con la base de datos de producción.
